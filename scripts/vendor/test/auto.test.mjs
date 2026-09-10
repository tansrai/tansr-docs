/**
 * auto.sh 假件卷(上游变更自动 vendor,资料站 DS-31):PATH 上放假 pnpm / git / gh(只记录调用、按环境变量装状态 / 失败),核
 *   ① 无变化(git status 空)→ 退 0,只跑 vendor + gen,不过门、不提交、不推、不触发;
 *   ② 有变化且门绿 → pnpm gate → git add 限 contract src/content → 以 github-actions[bot] 身份提交
 *      `chore(vendor): tansr-api@<sha12> · tansr-cli@<sha12> —— N 文件再生` → git push origin HEAD:main → gh workflow run deploy.yml --ref main;
 *   ③ 有变化门红 → 退 1,零 git add / commit / push / gh;
 *   ④ 参数校验(少参 / 目录不存在)→ 退 2,零外部调用。
 * 另核 .github/workflows/vendor.yml 的形(触发 · 权限 · 并发 · secret 缺席即 notice 空跑 · 两私有仓 checkout · 调用形)与 package.json 脚本名。
 * 需要 bash(CI ubuntu 自带;Windows 用 Git Bash);找不到 bash 时 auto.sh 各例 skip 并说明。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const AUTO = resolve(HERE, '..', 'auto.sh');

/** 找 bash(与 scripts/deploy/test/publish.test.mjs 同律:Windows 只认 Git 的 usr\bin\bash.exe,bin\bash.exe 会丢 PATH) */
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
const toBash = (p) => p.split('\\').join('/');

function envWithPath(prepend, extra = {}) {
  const env = { ...process.env, ...extra };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  const orig = env[key] ?? '';
  delete env[key];
  env.PATH = [...prepend, FOUND?.extraPath, orig].filter(Boolean).join(SEP);
  return env;
}

const API_SHA = 'a1b2c3d4e5f6';
const CLI_SHA = 'f6e5d4c3b2a1';

/**
 * 夹具:bin/ 三假件 + api/ cli/ 两个「检出目录」+ calls.log。
 *   pnpm:记录;`gate` 按 FAKE_GATE_EXIT 退出
 *   git :记录;`status --porcelain…` 打印 FAKE_STATUS;`-C <dir> rev-parse --short=12 HEAD` 按目录尾名回 api / cli 的 sha
 *   gh  :记录
 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'ds-auto-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  mkdirSync(join(root, 'api'));
  mkdirSync(join(root, 'cli'));
  const log = join(root, 'calls.log');
  const fakePnpm = `#!/usr/bin/env bash
printf 'pnpm %s\\n' "$*" >> "$FAKE_LOG"
if [[ "$1" == "gate" ]]; then exit "\${FAKE_GATE_EXIT:-0}"; fi
exit 0
`;
  const fakeGit = `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$FAKE_LOG"
dir=""
if [[ "$1" == "-C" ]]; then dir="$2"; shift 2; fi
if [[ "$1" == "status" ]]; then printf '%s' "\${FAKE_STATUS:-}"; exit 0; fi
if [[ "$1" == "rev-parse" ]]; then
  case "$dir" in *api) echo "${API_SHA}";; *cli) echo "${CLI_SHA}";; *) echo "000000000000";; esac
  exit 0
fi
exit 0
`;
  const fakeGh = `#!/usr/bin/env bash
printf 'gh %s\\n' "$*" >> "$FAKE_LOG"
exit 0
`;
  for (const [name, body] of [['pnpm', fakePnpm], ['git', fakeGit], ['gh', fakeGh]]) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  return { root, bin, api: join(root, 'api'), cli: join(root, 'cli'), log };
}

function runAuto(fx, args, extraEnv = {}) {
  const env = envWithPath([fx.bin], { FAKE_LOG: toBash(fx.log), ...extraEnv });
  const r = spawnSync(BASH, [toBash(AUTO), ...args], { encoding: 'utf8', env, cwd: ROOT });
  const calls = existsSync(fx.log) ? readFileSync(fx.log, 'utf8').split('\n').filter(Boolean) : [];
  return { status: r.status, stderr: r.stderr, stdout: r.stdout, calls };
}

const skip = BASH ? false : 'bash 不可用';
const CHANGED = ' M contract/openapi.json\n M contract/vendored.json\n?? src/content/docs/releases/i18n-coverage.md\n';

test('auto ①:无变化 → 退 0;只 vendor + gen + status,零 gate / add / commit / push / gh', { skip }, () => {
  const fx = makeFixture();
  try {
    const r = runAuto(fx, [toBash(fx.api), toBash(fx.cli)], { FAKE_STATUS: '' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.calls, [
      `pnpm vendor --api ${toBash(fx.api)} --cli ${toBash(fx.cli)}`,
      'pnpm gen',
      'git status --porcelain=v1 -uall -- contract src/content',
    ]);
    assert.match(r.stderr, /无变化/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('auto ②:有变化且门绿 → gate → add 限 contract src/content → bot 身份提交(消息形 + 文件数)→ push origin HEAD:main → gh workflow run deploy.yml --ref main', { skip }, () => {
  const fx = makeFixture();
  try {
    const r = runAuto(fx, [toBash(fx.api), toBash(fx.cli)], { FAKE_STATUS: CHANGED });
    assert.equal(r.status, 0, r.stderr);
    const c = r.calls;
    assert.equal(c[0], `pnpm vendor --api ${toBash(fx.api)} --cli ${toBash(fx.cli)}`);
    assert.equal(c[1], 'pnpm gen');
    assert.equal(c[2], 'git status --porcelain=v1 -uall -- contract src/content');
    assert.equal(c[3], 'pnpm gate', '有变化才过门');
    assert.equal(c[4], `git -C ${toBash(fx.api)} rev-parse --short=12 HEAD`);
    assert.equal(c[5], `git -C ${toBash(fx.cli)} rev-parse --short=12 HEAD`);
    assert.equal(c[6], 'git add -A -- contract src/content', 'git add 只限两目录,不得 add -A 全仓');
    assert.equal(c[7], `git -c user.name=github-actions[bot] -c user.email=41898282+github-actions[bot]@users.noreply.github.com commit -q -m chore(vendor): tansr-api@${API_SHA} · tansr-cli@${CLI_SHA} —— 3 文件再生`);
    assert.equal(c[8], 'git push origin HEAD:main');
    assert.equal(c[9], 'gh workflow run deploy.yml --ref main');
    assert.equal(c.length, 10, c.join('\n'));
    assert.match(r.stderr, /已提交并推送/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('auto ③:有变化但门红 → 退 1;零 add / commit / push / gh;提示补 release-notes 条', { skip }, () => {
  const fx = makeFixture();
  try {
    const r = runAuto(fx, [toBash(fx.api), toBash(fx.cli)], { FAKE_STATUS: CHANGED, FAKE_GATE_EXIT: '1' });
    assert.equal(r.status, 1);
    assert.deepEqual(r.calls.slice(0, 4), [
      `pnpm vendor --api ${toBash(fx.api)} --cli ${toBash(fx.cli)}`,
      'pnpm gen',
      'git status --porcelain=v1 -uall -- contract src/content',
      'pnpm gate',
    ]);
    assert.equal(r.calls.length, 4, r.calls.join('\n'));
    assert.ok(!r.calls.some((x) => /^git (add|-c .*commit|push)|^gh /.test(x)), '门红不得提交 / 推送 / 触发');
    assert.match(r.stderr, /门红/);
    assert.match(r.stderr, /release-notes\.json/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('auto ④:参数校验——少参 / 检出目录不存在 → 退 2,零外部调用', { skip }, () => {
  const fx = makeFixture();
  try {
    const one = runAuto(fx, [toBash(fx.api)]);
    assert.equal(one.status, 2);
    assert.equal(one.calls.length, 0);
    const missing = runAuto(fx, [toBash(fx.api), toBash(join(fx.root, 'nope'))]);
    assert.equal(missing.status, 2);
    assert.equal(missing.calls.length, 0);
    assert.match(missing.stderr, /不存在/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('auto.sh 文本形:外部命令只经 pnpm / git / gh;set -euo pipefail;注释写明 GITHUB_TOKEN 推送不触发 push 事件', () => {
  const sh = readFileSync(AUTO, 'utf8');
  assert.match(sh, /^set -euo pipefail$/m);
  assert.match(sh, /GITHUB_TOKEN/);
  assert.match(sh, /workflow_dispatch/);
  assert.ok(!sh.includes('\r'), 'LF');
  assert.ok(sh.endsWith('\n'));
  // 除 pnpm / git / gh 外不直呼其他可执行(node 经 pnpm 脚本间接调用;grep / wc 等一律不用);bash 关键字 / 内建与本脚本自定义函数不算
  const cmds = [...sh.matchAll(/^\s*(?:if\s+!?\s*)?([a-z][a-z0-9_-]*)\s/gm)].map((m) => m[1]);
  const builtins = ['set', 'exit', 'printf', 'echo', 'if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'local', 'return', 'mapfile', 'read', 'shift'];
  const functions = ['log', 'die', 'usage', 'validate_dir'];
  const external = ['pnpm', 'git', 'gh'];
  const allowed = new Set([...builtins, ...functions, ...external]);
  for (const c of cmds) assert.ok(allowed.has(c), `auto.sh 直呼了未登记的命令:${c}`);
  for (const e of external) assert.ok(cmds.includes(e), `auto.sh 应直呼 ${e}`);
});

test('vendor.yml:repository_dispatch upstream-updated + workflow_dispatch(api_ref=master · cli_ref=main);contents: write;concurrency vendor-main 不取消在途', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'vendor.yml'), 'utf8');
  assert.match(wf, /^on:\n  repository_dispatch:\n    types: \[upstream-updated\]\n  workflow_dispatch:/m);
  assert.match(wf, /api_ref:[\s\S]*?default: master/);
  assert.match(wf, /cli_ref:[\s\S]*?default: main/);
  assert.match(wf, /^permissions:\n  contents: write\n  actions: write$/m, 'gh workflow run(workflow_dispatch API)需 actions: write');
  assert.match(wf, /^concurrency:\n  group: vendor-main\n  cancel-in-progress: false$/m);
});

test('vendor.yml:UPSTREAM_READ_TOKEN 缺席 → ::notice:: 空跑、后续步 if 守卫;在场 → 两私有仓 checkout(token · 不留凭据)→ cli pnpm install → auto.sh', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'vendor.yml'), 'utf8');
  assert.match(wf, /UPSTREAM_READ_TOKEN: \$\{\{ secrets\.UPSTREAM_READ_TOKEN \}\}/);
  assert.match(wf, /::notice::.*UPSTREAM_READ_TOKEN/);
  assert.match(wf, /configured=false/);
  assert.ok(!/exit 1/.test(wf.split('::notice::')[1]?.split('\n')[0] ?? ''), 'notice 行不得退非 0');
  const guarded = (wf.match(/if: steps\.cfg\.outputs\.configured == 'true'/g) ?? []).length;
  assert.ok(guarded >= 4, `凭据在场才跑的步至少 4 个(两 checkout · cli install · auto.sh),实得 ${guarded}`);
  assert.match(wf, /repository: cpple\/tansr-api\n\s+ref: \$\{\{ steps\.cfg\.outputs\.api_ref \}\}\n\s+token: \$\{\{ secrets\.UPSTREAM_READ_TOKEN \}\}\n\s+path: upstream\/api\n\s+persist-credentials: false/);
  assert.match(wf, /repository: cpple\/tansr\n\s+ref: \$\{\{ steps\.cfg\.outputs\.cli_ref \}\}\n\s+token: \$\{\{ secrets\.UPSTREAM_READ_TOKEN \}\}\n\s+path: upstream\/cli\n\s+persist-credentials: false/);
  assert.match(wf, /working-directory: upstream\/cli\n\s+run: pnpm install --frozen-lockfile/);
  assert.match(wf, /run: bash scripts\/vendor\/auto\.sh \.\.\/upstream\/api \.\.\/upstream\/cli/);
  assert.match(wf, /GH_TOKEN: \$\{\{ (secrets\.GITHUB_TOKEN|github\.token) \}\}/, 'gh workflow run 用 GITHUB_TOKEN');
  // 不新增任何 secret:除 UPSTREAM_READ_TOKEN 与 GITHUB_TOKEN 外不得引用其他 secrets.*
  const secrets = new Set([...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
  assert.deepEqual([...secrets].sort(), ['GITHUB_TOKEN', 'UPSTREAM_READ_TOKEN']);
});

test('vendor.yml:actions 全部 pin 到 40 位 commit sha,且与 deploy.yml 同一组 pin', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'vendor.yml'), 'utf8');
  const dep = readFileSync(join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  const uses = (s) => [...s.matchAll(/uses: ([^@\s]+)@([0-9a-f]+)/g)].map((m) => [m[1], m[2]]);
  const mine = uses(wf);
  assert.ok(mine.length >= 5, '自身 checkout + 两上游 checkout + pnpm + node');
  for (const [name, sha] of mine) assert.match(sha, /^[0-9a-f]{40}$/, `${name} 未 pin 到 commit sha`);
  const pins = new Map(uses(dep));
  for (const [name, sha] of mine) assert.equal(sha, pins.get(name), `${name} 与 deploy.yml pin 不同或 deploy.yml 未用`);
  assert.ok(!/uses: [^@\s]+@v\d/.test(wf), '不得以 @vN 标签引用');
});

test('package.json:只加脚本名 vendor:auto,不加依赖', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['vendor:auto'], 'bash scripts/vendor/auto.sh');
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@astrojs/starlight', 'astro', 'cookie', 'sharp', 'starlight-openapi']);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ['@astrojs/check', 'typedoc', 'typedoc-plugin-markdown', 'typescript']);
});

test('README 部署段:「上游接线」说明在场(dispatch 命令 · DOCS_DISPATCH_TOKEN 候拍 · 不改兄弟仓)', () => {
  const md = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.match(md, /上游接线/);
  assert.match(md, /gh api repos\/cpple\/tansr-docs\/dispatches -f event_type=upstream-updated/);
  assert.match(md, /DOCS_DISPATCH_TOKEN/);
  assert.match(md, /UPSTREAM_READ_TOKEN/);
  assert.match(md, /vendor:auto/);
});
