import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { GENERATED_MARKER } from '../../src/lib/contract.mjs';
import { GLOSSARY } from '../../src/lib/glossary.mjs';
import { buildCoverage, fileToSlug, generate, OUT_REL, OUT_SLUG, readMeta, render } from './i18n-coverage.mjs';

const root = repoRootFrom(import.meta.url);

/** 最小内容目录 fixture:根 3 页 + en 1 页翻译 + en 1 页孤儿 */
function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-i18n-'));
  const docs = join(tmp, 'src', 'content', 'docs');
  const page = (rel, title, lastVerified, extra = '') => {
    mkdirSync(join(docs, rel, '..'), { recursive: true });
    writeFileSync(join(docs, rel), `---\ntitle: '${title}'\ndescription: x\nzone: docs\ncategory: sdk\nlastVerified: '${lastVerified}'\n${extra}---\n\nbody\n`, 'utf8');
  };
  page('index.md', '首页', '2026-09-01');
  page('a.md', '甲 | 竖线', '2026-09-03');
  page('b/index.mdx', '乙', '2026-09-02');
  page('en/a.md', 'A', '2026-09-05');
  page('en/orphan.md', 'Orphan', '2026-09-04');
  return { tmp, docs, page };
}

test('fileToSlug:去扩展名;index → 目录;根 index → 空', () => {
  assert.equal(fileToSlug('index.md'), '');
  assert.equal(fileToSlug('a.md'), 'a');
  assert.equal(fileToSlug('b/index.mdx'), 'b');
  assert.equal(fileToSlug('en/support/contact.mdx'), 'en/support/contact');
});

test('readMeta:只取 title / lastVerified / generated,单引号转义还原', () => {
  const m = readMeta(`---\ntitle: 'It''s'\ndescription: 'ignored'\nlastVerified: '2026-09-09'\ngenerated: true\n---\n`);
  assert.deepEqual(m, { title: "It's", lastVerified: '2026-09-09', generated: true });
  assert.deepEqual(readMeta('no frontmatter'), { title: '', lastVerified: '', generated: false });
});

test('buildCoverage(fixture):分母 = 根 slug 集;en 计数;孤儿另列;lastVerified 取最大', () => {
  const { tmp } = fixture();
  try {
    const cov = buildCoverage(tmp);
    assert.deepEqual(cov.locales, ['en']);
    assert.deepEqual(cov.rows.map((r) => r.slug), ['', 'a', 'b']);
    assert.deepEqual(cov.summary, { total: 3, en: 1 });
    assert.equal(cov.rows.find((r) => r.slug === 'a').translated.en, 'A');
    assert.equal(cov.rows.find((r) => r.slug === 'b').translated.en, undefined);
    assert.deepEqual(cov.orphans.map((o) => o.slug), ['orphan']);
    assert.equal(cov.lastVerified, '2026-09-05');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('render(fixture):frontmatter 契约 + 标记行;表行 ✓ / 回落;标题竖线转义;术语表整表', () => {
  const { tmp } = fixture();
  try {
    const text = render(buildCoverage(tmp));
    const lines = text.split('\n');
    assert.equal(lines[0], '---');
    const end = lines.indexOf('---', 1);
    const fm = lines.slice(1, end).join('\n');
    for (const k of ['title', 'description', 'zone', 'category', 'lastVerified', 'generated']) assert.match(fm, new RegExp(`^${k}:`, 'm'), `frontmatter 缺 ${k}`);
    assert.match(fm, /^lastVerified: '2026-09-05'$/m);
    assert.match(fm, /^generated: true$/m);
    assert.match(lines[end + 1], GENERATED_MARKER, '标记行须匹配 GENERATED_MARKER');
    assert.match(text, /\| English\(`en`\) \| 1 \/ 3 \| 33\.3% \|/);
    assert.match(text, /\| \[甲 \\\| 竖线\]\(\/a\/\) `a` \| ✓ \| ✓ \[A\]\(\/en\/a\/\) \|/);
    assert.match(text, /\| \[乙\]\(\/b\/\) `b` \| ✓ \| 回落 \|/);
    assert.match(text, /\| \[首页\]\(\/\) `\/` \| ✓ \| 回落 \|/);
    assert.match(text, /### 仅存在于翻译语言的页面[\s\S]*\| `orphan` \| `en` \|/);
    for (const t of GLOSSARY) assert.ok(text.includes(`| ${t.zh} | ${t.en} |`), `术语表缺 ${t.zh}`);
    assert.ok(text.endsWith('\n') && !text.includes('\r'), 'LF 收尾');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('自指收敛:生成页写回后再算,行集与正文零 diff(修前红:自身被计成一篇「回落」)', () => {
  const { tmp } = fixture();
  try {
    const first = generate(tmp);
    assert.equal(first.length, 1);
    assert.equal(first[0].rel, OUT_REL);
    mkdirSync(join(tmp, OUT_REL, '..'), { recursive: true });
    writeFileSync(join(tmp, OUT_REL), first[0].content, 'utf8');
    const second = generate(tmp);
    assert.equal(second[0].content, first[0].content, '写回自身后再生成须零 diff');
    assert.ok(!buildCoverage(tmp).rows.some((r) => r.slug === OUT_SLUG), '本页不进表');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('本仓:en 首批 10 篇计入覆盖;已提交生成页与 render 逐字节相同', () => {
  const cov = buildCoverage(root);
  const first10 = ['getting-started', 'getting-started/sdk', 'getting-started/cli', 'getting-started/serve', 'getting-started/android', 'support', 'support/account', 'support/troubleshooting', 'support/contact', 'security'];
  for (const s of first10) {
    const row = cov.rows.find((r) => r.slug === s);
    assert.ok(row, `根页 ${s} 须存在`);
    assert.ok(typeof row.translated.en === 'string' && row.translated.en.length > 0, `${s} 须有 en 译文`);
  }
  assert.ok(cov.summary.en >= 10);
  assert.deepEqual(cov.orphans, [], 'en 不得有无根页的孤儿翻译');
  assert.equal(readFileSync(join(root, OUT_REL), 'utf8'), render(cov));
});
