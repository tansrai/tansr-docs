import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { report } from '../i18n-coverage.mjs';

const script = fileURLToPath(new URL('../i18n-coverage.mjs', import.meta.url));

/** 夹具:根 2 手写页 + 1 生成页(errors/codes);可选 en/a 译文 */
function fixture(withEn, withGenerated = true) {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-i18n-check-'));
  const docs = join(tmp, 'src', 'content', 'docs');
  const page = (rel, title, extra = '') => {
    mkdirSync(join(docs, rel, '..'), { recursive: true });
    writeFileSync(join(docs, rel), `---\ntitle: '${title}'\ndescription: x\nzone: docs\ncategory: sdk\nlastVerified: '2026-09-09'\n${extra}---\n\nbody\n`, 'utf8');
  };
  page('index.md', '首页');
  page('a.md', '甲');
  if (withGenerated) page('errors/codes.md', '错误码参考', 'generated: true\n');
  if (withEn) page('en/a.md', 'A');
  return tmp;
}

test('report:两口径——主口径以手写页为分母(未翻译清单只列手写页);all 口径含生成页;根 index 显示为 /', () => {
  const tmp = fixture(true);
  try {
    const r = report(tmp);
    // 修前红:旧算法把生成页 errors/codes 计入分母(1 / 3)且列进未翻译清单
    assert.deepEqual(r.locales.en, {
      translated: 1,
      total: 2,
      pct: 50,
      missing: ['/'],
      all: { translated: 1, total: 3, pct: 33.3 },
    });
    assert.equal(r.generated, 1);
    assert.deepEqual(r.orphans, []);
    assert.equal(r.page, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('report:无生成页时两口径相同', () => {
  const tmp = fixture(true, false);
  try {
    const r = report(tmp);
    assert.equal(r.generated, 0);
    assert.deepEqual(r.locales.en.all, { translated: 1, total: 2, pct: 50 });
    assert.equal(r.locales.en.total, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('只报不红:0% 覆盖仍 exit 0;打印手写页口径与含生成页口径两行', () => {
  const tmp = fixture(false);
  try {
    const p = spawnSync(process.execPath, [script, '--root', tmp], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    assert.match(p.stdout, /\[i18n-coverage\] en: 0 \/ 2 \(0%\) handwritten pages translated; 2 fall back to zh-CN/);
    assert.match(p.stdout, /\[i18n-coverage\] en incl\. 1 generated page\(s\): 0 \/ 3 \(0%\)/);
    assert.match(p.stdout, /^  - \/$/m);
    assert.match(p.stdout, /^  - a$/m);
    assert.doesNotMatch(p.stdout, /^  - errors\/codes$/m, '生成页不进未翻译清单');
    assert.match(p.stdout, /not generated yet/);
    const j = spawnSync(process.execPath, [script, '--root', tmp, '--json'], { encoding: 'utf8' });
    assert.equal(j.status, 0);
    const parsed = JSON.parse(j.stdout);
    assert.equal(parsed.locales.en.total, 2);
    assert.equal(parsed.locales.en.all.total, 3);
    assert.equal(parsed.generated, 1);
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
