/**
 * publish.sh dry-run 卷:PATH 上放假 rsync / ssh(只记录调用、按环境变量装失败),核
 *   成功切换(调用序 + 参数逐字)/ rsync 失败不切 current / ssh 切换失败退非 0 且不清理 / 参数校验 /
 *   清理命令在本地临时 releases/ 上真跑一次(保留数 = KEEP,当前 sha 恒保留)。
 * 需要 bash(CI ubuntu 自带;Windows 用 Git Bash);找不到 bash 时整卷 skip 并说明。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLISH = resolve(HERE, '..', 'publish.sh');

/**
 * 找 bash。Windows 只认 Git 的 usr\bin\bash.exe:bin\bash.exe 是包装器,会丢弃继承的 PATH(bash 退回编译内建缺省路径),
 * 假件永远赢不了真 ssh;System32\bash.exe 是 WSL,路径语义不同,也不用。
 * 返回 { bin, extraPath }:extraPath = 需一并放进 PATH 的 coreutils 目录(ls / awk / xargs / mv)。
 */
function findBash() {
  if (process.platform === 'win32') {
    const usrBin = 'C:\\Program Files\\Git\\usr\\bin';
    const p = `${usrBin}\\bash.exe`;
    return existsSync(p) ? { bin: p, extraPath: usrBin } : null;
  }
  const r = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
  return r.status === 0 ? { bin: 'bash', extraPath: '' } : null;
}
const FOUND = findBash();
const BASH = FOUND?.bin ?? null;
const SEP = process.platform === 'win32' ? ';' : ':';

/** Windows 路径 → bash 可用形(正斜杠;Git Bash 接受 C:/x/y) */
const toBash = (p) => p.split('\\').join('/');

/** Windows 下环境键可能是 `Path`;统一改成单一 `PATH` 键(双键并存时 bash 里 PATH 为空) */
function envWithPath(prepend, extra = {}) {
  const env = { ...process.env, ...extra };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  const orig = env[key] ?? '';
  delete env[key];
  env.PATH = [...prepend, FOUND?.extraPath, orig].filter(Boolean).join(SEP);
  return env;
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'ds-publish-'));
  const bin = join(root, 'bin');
  const dist = join(root, 'dist');
  mkdirSync(bin);
  mkdirSync(dist);
  writeFileSync(join(dist, 'index.html'), '<html></html>\n');
  const log = join(root, 'calls.log');
  const fakeRsync = `#!/usr/bin/env bash
printf 'rsync %s\\n' "$*" >> "$FAKE_LOG"
exit "\${FAKE_RSYNC_EXIT:-0}"
`;
  const fakeSsh = `#!/usr/bin/env bash
printf 'ssh %s\\n' "$*" >> "$FAKE_LOG"
# 最后一个参数 = 远端命令;匹配 FAKE_SSH_FAIL_MATCH 则装失败
cmd="\${@: -1}"
if [[ -n "\${FAKE_SSH_FAIL_MATCH:-}" && "$cmd" =~ \${FAKE_SSH_FAIL_MATCH} ]]; then exit 255; fi
exit 0
`;
  writeFileSync(join(bin, 'rsync'), fakeRsync);
  writeFileSync(join(bin, 'ssh'), fakeSsh);
  chmodSync(join(bin, 'rsync'), 0o755);
  chmodSync(join(bin, 'ssh'), 0o755);
  return { root, bin, dist, log };
}

function runPublish(fx, args, extraEnv = {}) {
  const env = envWithPath([fx.bin], { FAKE_LOG: toBash(fx.log), ...extraEnv });
  const r = spawnSync(BASH, [toBash(PUBLISH), ...args], { encoding: 'utf8', env });
  const calls = existsSync(fx.log) ? readFileSync(fx.log, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { status: r.status, stderr: r.stderr, stdout: r.stdout, calls };
}

const SHA = 'abcdef1234567890abcdef1234567890abcdef12';
const HOST = 'deploy@docs-host';
const ROOT = '/root/tansr/docs';

test('publish 绿:mkdir → rsync(--chmod=D755,F644 · releases/<sha>/)→ 相对链接原子切换 → 清理,退 0', { skip: BASH ? false : 'bash 不可用' }, () => {
  const fx = makeFixture();
  try {
    const r = runPublish(fx, [toBash(fx.dist), HOST, SHA]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls.length, 4, r.calls.join('\n'));
    assert.equal(r.calls[0], `ssh ${HOST} mkdir -p '${ROOT}/releases/${SHA}'`);
    assert.equal(r.calls[1], `rsync -az --delete --chmod=D755,F644 ${toBash(fx.dist)}/ ${HOST}:${ROOT}/releases/${SHA}/`);
    assert.equal(r.calls[2], `ssh ${HOST} ln -sfn releases/${SHA} ${ROOT}/current.tmp && mv -Tf ${ROOT}/current.tmp ${ROOT}/current`);
    assert.match(r.calls[3], new RegExp(`^ssh ${HOST} cd ${ROOT}/releases && ls -1t \\| awk -v keep=5 -v cur=${SHA} `));
    assert.match(r.stderr, /✔ 已发布/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('publish 红:rsync 失败 → 退非 0,不切 current、不清理', { skip: BASH ? false : 'bash 不可用' }, () => {
  const fx = makeFixture();
  try {
    const r = runPublish(fx, [toBash(fx.dist), HOST, SHA], { FAKE_RSYNC_EXIT: '23' });
    assert.notEqual(r.status, 0);
    assert.equal(r.calls.length, 2, r.calls.join('\n'));
    assert.ok(r.calls[1].startsWith('rsync '));
    assert.ok(!r.calls.some((c) => c.includes('ln -sfn')), 'must not switch current');
    assert.ok(!r.calls.some((c) => c.includes('rm -rf')), 'must not prune');
    assert.match(r.stderr, /rsync 失败,未切换 current/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('publish 红:切换 ssh 失败 → 退非 0,不清理;releases/<sha> 已上传的提示在场', { skip: BASH ? false : 'bash 不可用' }, () => {
  const fx = makeFixture();
  try {
    const r = runPublish(fx, [toBash(fx.dist), HOST, SHA], { FAKE_SSH_FAIL_MATCH: 'ln -sfn' });
    assert.notEqual(r.status, 0);
    assert.equal(r.calls.length, 3, r.calls.join('\n'));
    assert.ok(!r.calls.some((c) => c.includes('rm -rf')));
    assert.match(r.stderr, /切换 current 失败/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('publish 红:参数校验(坏 sha / dist 缺 index.html)→ 退 2,零外部调用', { skip: BASH ? false : 'bash 不可用' }, () => {
  const fx = makeFixture();
  try {
    const bad = runPublish(fx, [toBash(fx.dist), HOST, 'not-a-sha']);
    assert.equal(bad.status, 2);
    assert.equal(bad.calls.length, 0);
    rmSync(join(fx.dist, 'index.html'));
    const noIndex = runPublish(fx, [toBash(fx.dist), HOST, SHA]);
    assert.equal(noIndex.status, 2);
    assert.equal(noIndex.calls.length, 0);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('publish 清理命令本地真跑:7 份 → 只留 KEEP=5 份,当前 sha 恒保留,删的是最旧的', { skip: BASH ? false : 'bash 不可用' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'ds-prune-'));
  try {
    const releases = join(root, 'releases');
    mkdirSync(releases);
    const shas = ['1111111', '2222222', '3333333', '4444444', '5555555', '6666666', '7777777'];
    // 越靠后越新;当前 sha 故意放在中间(mtime 不是最新)以证「当前恒保留」
    const now = Date.now() / 1000;
    shas.forEach((s, i) => {
      mkdirSync(join(releases, s));
      writeFileSync(join(releases, s, 'index.html'), s);
      utimesSync(join(releases, s), now - (shas.length - i) * 60, now - (shas.length - i) * 60);
    });
    const current = '3333333';
    const env = envWithPath([], { DOCS_ROOT: toBash(root), KEEP: '5' });
    const printed = spawnSync(BASH, [toBash(PUBLISH), '--print-prune-cmd', current], { encoding: 'utf8', env });
    assert.equal(printed.status, 0, printed.stderr);
    const cmd = printed.stdout.trim();
    assert.match(cmd, /ls -1t \| awk -v keep=5 -v cur=3333333/);
    const run = spawnSync(BASH, ['-c', cmd], { encoding: 'utf8', env });
    assert.equal(run.status, 0, run.stderr);
    const left = readdirSync(releases).sort();
    assert.deepEqual(left, ['3333333', '4444444', '5555555', '6666666', '7777777']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
