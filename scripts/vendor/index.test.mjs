import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonText, repoRootFrom, sha256Hex } from '../lib/text.mjs';
import { parseSubcommands } from './cli-help.mjs';
import { check, VENDOR_TABLE } from './index.mjs';

const root = repoRootFrom(import.meta.url);
const script = fileURLToPath(new URL('./index.mjs', import.meta.url));

function runCheck(dir) {
  return spawnSync(process.execPath, [script, '--check', '--root', dir], { encoding: 'utf8' });
}

function makeFixtureRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'tansr-docs-vendor-test-'));
  const contract = join(dir, 'contract');
  mkdirSync(join(contract, 'changelog'), { recursive: true });
  const files = {
    'openapi.json': '{"openapi":"3.1.0"}\n',
    'changelog/cli.md': '# @tansr/cli Changelog\n\n## 0.1.0\n\n- 首发\n',
  };
  const vendored = {};
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(contract, ...name.split('/')), text, 'utf8');
    vendored[name] = {
      source: `tansr-api@0123456789ab:${name}`,
      revision: 0,
      sha256: sha256Hex(text),
      vendoredAt: '2026-09-08',
    };
  }
  writeFileSync(join(contract, 'vendored.json'), jsonText(vendored), 'utf8');
  return dir;
}

test('parseSubcommands:从顶层 help 的 Modes 块解析命令名与 also: 追加', () => {
  const help = [
    'Tansr - agent CLI platform (v0.4.0)',
    '',
    'Modes:',
    '  (default)          interactive terminal session (TUI)',
    '  -p, --prompt       one-shot headless query',
    '  serve              REST + SSE server (--port --host --token)',
    '  policy pull        pull policy bundles from tansrd',
    '  mcp serve          expose built-in tools as an MCP stdio server',
    '  bg [show <id>]     background task registry (list / log tail; --json)',
    ' sessions <export|prune> session transcript export / storage prune',
    '  login              sign in (also: logout, whoami)',
    '',
    'Flags:',
    '  --json             NDJSON',
    '',
  ].join('\n');
  const subs = parseSubcommands(help);
  assert.deepEqual(
    subs.map((s) => s.command),
    ['serve', 'policy pull', 'mcp serve', 'bg', 'sessions', 'login', 'logout', 'whoami'],
  );
  assert.equal(subs.find((s) => s.command === 'bg').summary, 'background task registry (list / log tail; --json)');
  assert.equal(subs.find((s) => s.command === 'sessions').summary, 'session transcript export / storage prune');
});

test('vendor --check:登记一致 → 绿(exit 0)', () => {
  const dir = makeFixtureRoot();
  try {
    const r = runCheck(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\[vendor:check\] ok\(/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('vendor --check:改一字节 → 红(exit 1,列出 MISMATCH 文件)', () => {
  const dir = makeFixtureRoot();
  try {
    const p = join(dir, 'contract', 'openapi.json');
    const text = readFileSync(p, 'utf8');
    writeFileSync(p, text.replace('3.1.0', '3.1.1'), 'utf8');
    const r = runCheck(dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /MISMATCH\s+contract\/openapi\.json/);
    assert.doesNotMatch(r.stdout + r.stderr, /MISMATCH\s+contract\/changelog\/cli\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('vendor --check:登记文件缺席 / 未登记文件 → 红', () => {
  const dir = makeFixtureRoot();
  try {
    rmSync(join(dir, 'contract', 'changelog', 'cli.md'));
    writeFileSync(join(dir, 'contract', 'stray.txt'), 'x\n', 'utf8');
    const r = check({ root: dir, log: () => {} });
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.startsWith('MISSING') && p.includes('changelog/cli.md')));
    assert.ok(r.problems.some((p) => p.startsWith('UNLISTED') && p.includes('stray.txt')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('vendor --check:本仓 contract/ 对表一致,且登记项齐全、形合契约 5', () => {
  const vendoredPath = join(root, 'contract', 'vendored.json');
  assert.ok(existsSync(vendoredPath), 'contract/vendored.json 须已随 DS-06 提交');
  const r = check({ root, log: () => {} });
  assert.deepEqual(r.problems, []);
  const vendored = JSON.parse(readFileSync(vendoredPath, 'utf8'));
  assert.deepEqual(Object.keys(vendored), VENDOR_TABLE.map((row) => row.name));
  for (const [name, entry] of Object.entries(vendored)) {
    assert.deepEqual(Object.keys(entry), ['source', 'revision', 'sha256', 'vendoredAt'], name);
    assert.match(entry.source, /^tansr-(api|cli)@[0-9a-f]{12}:[^\s]+$/, name);
    assert.ok(Number.isInteger(entry.revision) && entry.revision >= 0, name);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, name);
    assert.match(entry.vendoredAt, /^\d{4}-\d{2}-\d{2}$/, name);
  }
});

test('contract/cli-help.json:顶层 help 退出码 0,子命令集非空且每条带 command/help/exitCode', () => {
  const p = join(root, 'contract', 'cli-help.json');
  assert.ok(existsSync(p));
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(doc.top.exitCode, 0);
  assert.ok(doc.commands.length > 0);
  for (const c of doc.commands) {
    assert.equal(typeof c.command, 'string');
    assert.equal(typeof c.help, 'string');
    assert.equal(typeof c.exitCode, 'number');
    assert.doesNotMatch(c.help, /\u001B\[/, `${c.command} help 含 ANSI`);
    assert.doesNotMatch(c.help, /\r/, `${c.command} help 含 CR`);
  }
});
