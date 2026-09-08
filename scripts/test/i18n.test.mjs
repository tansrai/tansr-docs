/**
 * en 首批译文卷(资料站 DS-19):10 篇与 zh-CN 同 slug / 同扩展名 / 同 frontmatter 契约(zone · category · related · sources),
 * 正文零 CJK、零术语禁用变体,内链指 /en/...(无 en 版的生成页 / 根路径例外)且目标存在。
 * 先红再绿:红例用内置坏样本(CJK 残留 + 「session server」)。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { CJK_PATTERN, findGlossaryViolations, GLOSSARY, proseOnly } from '../../src/lib/glossary.mjs';
import { buildCoverage, fileToSlug } from '../gen/i18n-coverage.mjs';
import { DOCS_DIR } from '../gen/lib.mjs';

const root = repoRootFrom(import.meta.url);
const docs = join(root, DOCS_DIR);

export const FIRST_10 = Object.freeze([
  'getting-started/index.md',
  'getting-started/sdk.md',
  'getting-started/cli.md',
  'getting-started/serve.md',
  'getting-started/android.md',
  'support/index.mdx',
  'support/account.md',
  'support/troubleshooting.md',
  'support/contact.mdx',
  'security/index.md',
]);

function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text.replace(/^\uFEFF/, ''));
  assert.ok(m, 'frontmatter 缺失');
  return { fm: m[1], body: m[2] };
}

/** 取 frontmatter 里一个键的「块」(标量一行,或列表多行),供逐字比较 */
function fmBlock(fm, key) {
  const lines = fm.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return null;
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length && /^\s+-\s/.test(lines[j]); j++) out.push(lines[j]);
  return out.join('\n');
}

const coverage = buildCoverage(root);
const rootSlugs = new Set(coverage.rows.map((r) => r.slug));
/** 生成页(errors/codes · cli/commands · serve/env · releases/*)无手写 en 版:英文页链根路径;其余内容页链 /en/...(Starlight 回落保证存在) */
const generatedSlugs = new Set(coverage.rows.filter((r) => r.generated).map((r) => r.slug));

test('红例:CJK 残留与术语禁用变体都能被抓到', () => {
  const bad = 'Start the session server, then 会话服务 replies. See `会话服务` and [x](/会话/).';
  const prose = proseOnly(bad);
  assert.match(prose, CJK_PATTERN, '正文 CJK 须被抓到');
  assert.ok(!/`会话服务`/.test(prose) && !/\/会话\//.test(prose), '行内代码与链接目标不计入');
  const v = findGlossaryViolations(prose);
  assert.deepEqual(v.map((x) => x.variant), ['session server']);
  assert.equal(v[0].en, 'session service');
  assert.deepEqual(findGlossaryViolations('the session service is up'), []);
});

test('术语表:zh / en 非空且 en 主形唯一;avoid 变体不与任何主形重合', () => {
  const ens = GLOSSARY.map((t) => t.en.toLowerCase());
  assert.equal(new Set(ens).size, ens.length, 'en 主形重复');
  for (const t of GLOSSARY) {
    assert.ok(t.zh && t.en, `术语缺 zh / en:${JSON.stringify(t)}`);
    for (const a of t.avoid ?? []) assert.ok(!ens.includes(a.toLowerCase()), `avoid「${a}」撞主形`);
  }
  assert.ok(GLOSSARY.some((t) => t.zh === '会话服务' && t.en === 'session service'));
  assert.ok(GLOSSARY.some((t) => t.zh === '套餐' && t.en === 'plan'));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('终端令牌') && t.en.startsWith('end-user token')));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('逃生态') && t.en.startsWith('escape hatch')));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('派生键') && t.en.startsWith('derived key')));
  assert.ok(GLOSSARY.some((t) => t.zh === '出网白名单' && t.en === 'egress allowlist'));
});

for (const rel of FIRST_10) {
  test(`en/${rel}:同 slug 同扩展名;zone · category · related · sources 与 zh-CN 逐字同;lastVerified ≥ zh-CN`, () => {
    const zhPath = join(docs, rel);
    const enPath = join(docs, 'en', rel);
    assert.ok(existsSync(zhPath), `zh-CN 源页缺失 ${rel}`);
    assert.ok(existsSync(enPath), `en 页缺失 ${rel}`);
    const zh = splitFrontmatter(readFileSync(zhPath, 'utf8'));
    const en = splitFrontmatter(readFileSync(enPath, 'utf8'));
    for (const key of ['zone', 'category', 'related', 'sources']) assert.equal(fmBlock(en.fm, key), fmBlock(zh.fm, key), `${rel}: frontmatter ${key} 须与 zh-CN 逐字同`);
    const lv = (fm) => /^lastVerified:\s*'?(\d{4}-\d{2}-\d{2})'?$/m.exec(fm)?.[1];
    assert.ok(lv(en.fm) >= lv(zh.fm), `${rel}: en lastVerified 不得早于 zh-CN`);
    for (const key of ['title', 'description']) {
      const v = fmBlock(en.fm, key);
      assert.ok(v && v.length > `${key}: `.length, `${rel}: en ${key} 为空`);
      assert.doesNotMatch(v, CJK_PATTERN, `${rel}: en ${key} 含 CJK`);
    }
    if (rel.endsWith('.mdx')) {
      const imports = (s) => (s.match(/^import .*$/gm) ?? []).map((l) => l.replace(/'(\.\.\/)+/, "'"));
      assert.deepEqual(imports(en.body), imports(zh.body), `${rel}: en 须沿用 zh-CN 同一组组件`);
    }
  });

  test(`en/${rel}:正文零 CJK、零术语禁用变体、代码块与 zh-CN 逐字同`, () => {
    const zhBody = splitFrontmatter(readFileSync(join(docs, rel), 'utf8')).body;
    const enBody = splitFrontmatter(readFileSync(join(docs, 'en', rel), 'utf8')).body;
    const prose = proseOnly(enBody);
    const cjk = prose.match(new RegExp(`.{0,20}${CJK_PATTERN.source}.{0,20}`));
    assert.equal(cjk, null, `${rel}: en 正文残留 CJK:${cjk?.[0]}`);
    const v = findGlossaryViolations(prose);
    assert.deepEqual(v, [], `${rel}: 术语禁用变体 ${JSON.stringify(v)}`);
    const fences = (s) => s.match(/```[\s\S]*?```/g) ?? [];
    assert.deepEqual(fences(enBody), fences(zhBody), `${rel}: 代码块须照抄 zh-CN`);
  });

  test(`en/${rel}:内链指 /en/...(生成页 / api 无 en 版则指根路径);目标页存在`, () => {
    const enBody = splitFrontmatter(readFileSync(join(docs, 'en', rel), 'utf8')).body;
    const links = [...enBody.replace(/```[\s\S]*?```/g, '').matchAll(/\]\((\/[^)\s#]*)(#[^)]*)?\)/g)].map((m) => m[1]);
    for (const href of links) {
      if (/\.(png|svg|jpg|webp|json|txt)$/i.test(href)) continue;
      const isEn = href === '/en/' || href.startsWith('/en/');
      const slug = (isEn ? href.slice('/en/'.length) : href.slice(1)).replace(/\/$/, '');
      if (slug === 'api') continue; // 生成 API 页(DS-E)另有入口
      assert.ok(rootSlugs.has(slug), `${rel}: 链接目标不存在 ${href}`);
      if (generatedSlugs.has(slug)) assert.ok(!isEn, `${rel}: 生成页无 en 版,须链根路径:${href}`);
      else assert.ok(isEn, `${rel}: 内容页须链 /en/${slug}/:${href}`);
    }
  });
}

test('覆盖模型:首批 10 篇全部计入,无孤儿', () => {
  const cov = coverage;
  const want = FIRST_10.map(fileToSlug);
  for (const s of want) assert.ok(cov.rows.find((r) => r.slug === s)?.translated.en, `${s} 未计入 en 覆盖`);
  assert.deepEqual(cov.orphans, []);
});
