import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { report } from '../i18n-coverage.mjs';

const script = fileURLToPath(new URL('../i18n-coverage.mjs', import.meta.url));

function fixture(withEn) {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-i18n-check-'));
  const docs = join(tmp, 'src', 'content', 'docs');
  const page = (rel, title) => {
    mkdirSync(join(docs, rel, '..'), { recursive: true });
    writeFileSync(join(docs, rel), `---\ntitle: '${title}'\ndescription: x\nzone: docs\ncategory: sdk\nlastVerified: '2026-09-09'\n---\n\nbody\n`, 'utf8');
  };
  page('index.md', '首页');
  page('a.md', '甲');
  if (withEn) page('en/a.md', 'A');
  return tmp;
}

test('report:未翻译清单 + 百分比;根 index 显示为 /', () => {
  const tmp = fixture(true);
  try {
    const r = report(tmp);
    assert.deepEqual(r.locales.en, { translated: 1, total: 2, pct: 50, missing: ['/'] });
    assert.deepEqual(r.orphans, []);
    assert.equal(r.page, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('只报不红:0% 覆盖仍 exit 0 并打印覆盖率', () => {
  const tmp = fixture(false);
  try {
    const p = spawnSync(process.execPath, [script, '--root', tmp], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    assert.match(p.stdout, /\[i18n-coverage\] en: 0 \/ 2 \(0%\) translated; 2 fall back to zh-CN/);
    assert.match(p.stdout, /not generated yet/);
    const j = spawnSync(process.execPath, [script, '--root', tmp, '--json'], { encoding: 'utf8' });
    assert.equal(j.status, 0);
    assert.equal(JSON.parse(j.stdout).locales.en.total, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('跑错目录(无 src/content/docs)→ exit 2;未知参数 → 抛', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-i18n-empty-'));
  try {
    const p = spawnSync(process.execPath, [script, '--root', tmp], { encoding: 'utf8' });
    assert.equal(p.status, 2);
    assert.match(p.stderr, /not found/);
    const bad = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /unknown argument/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
