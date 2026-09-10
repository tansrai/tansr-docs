/**
 * 多语言首批译文卷(资料站 en 首批 + ja / ko 首批):13 篇 × { en, ja, ko } 与 zh-CN 源同 slug / 同扩展名 / 同 frontmatter 契约
 * (zone · category · related · sources 逐字同),代码块与 zh-CN 源**逐字节相同**(含代码块内中文注释 / 提示词——用户拍板:代码块严守照抄),
 * 内链指 /<locale>/...(无译文的生成页 / 根路径例外)且目标存在;正文按语言各有「真译」守卫:
 *   en:零 CJK、零术语禁用变体;
 *   ja:零谚文、零简体中文专用字、假名占比 ≥ 40%、句末 / 括号用全角标点;
 *   ko:零汉字、零假名、含谚文、不用全角标点(韩文用半角标点与空格惯例);
 *   ja / ko:正文不出现任何内部编号 / 流程词。
 * 先红再绿:红例用内置坏样本(CJK 残留 + 「session server」;日文残留简体字 / 半角句号;韩文残留汉字 / 全角句号);
 * 首次运行时 ja / ko 26 页缺失即红,补页后绿。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { CJK_PATTERN, findGlossaryViolations, GLOSSARY, proseOnly } from '../../src/lib/glossary.mjs';
import { CATEGORIES, EXTRA_LOCALES, uiLocale } from '../../src/lib/categories.mjs';
import { buildCoverage, fileToSlug } from '../gen/i18n-coverage.mjs';
import { DOCS_DIR } from '../gen/lib.mjs';

const root = repoRootFrom(import.meta.url);
const docs = join(root, DOCS_DIR);

/** 首批 13 篇(en / ja / ko 同集) */
export const FIRST_BATCH = Object.freeze([
  'getting-started/index.md',
  'getting-started/sdk.md',
  'getting-started/cli.md',
  'getting-started/serve.md',
  'getting-started/android.md',
  'sdk/lifecycle.md',
  'sdk/midturn-input.md',
  'sdk/system-prompts.md',
  'security/index.md',
  'support/index.mdx',
  'support/account.md',
  'support/troubleshooting.md',
  'support/contact.mdx',
]);

export const TRANSLATED_LOCALES = Object.freeze(['en', 'ja', 'ko']);

/** 字符类 */
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const KANA = /[\u3040-\u30ff]/;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
/** 简体中文专用字(日文正字法不用,日文正文出现即为未译残留) */
const SIMPLIFIED_ONLY = /[们这个时务应从请见让说认设记该还经过后发对开关门问间键权联络线组织级统编码试调语读证识议论访计图术处电环网页单输击复显备选择换释错误检查现实际层态满压缩续够亲]/;
/** 日文正文里紧跟日文字的半角句读(逗号 / 句号 / 分号 / 冒号 / 感叹 / 问号后接空白或行末) */
const JA_ASCII_PUNCT = /[\u3040-\u30ff\u4e00-\u9fff][,.;:!?](?=\s|$)/m;
/** 日文正文里与日文字相邻的半角括号 */
const JA_ASCII_PAREN = /[\u3040-\u30ff\u4e00-\u9fff]\(|\)[\u3040-\u30ff\u4e00-\u9fff]/;
/** 韩文正文不用的全角标点 */
const KO_FULLWIDTH_PUNCT = /[\uff0c\u3002\u3001\uff1a\uff1b\uff01\uff1f\uff08\uff09\u300c\u300d\u300e\u300f\u3010\u3011]/;
/** 内部编号 / 流程词(内容律 6):译文正文零出现 */
const INTERNAL_PATTERN = /\b(FX|DS|W[1-5]|ED|INJ|ARC|CM|PM|AP)-[A-Z0-9]{1,8}\b|\bINJ\b|泳道|收编|派单|十王修案/;

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

const fences = (s) => s.match(/```[\s\S]*?```/g) ?? [];
const count = (s, re) => (s.match(new RegExp(re.source, 'g')) ?? []).length;
const around = (s, re, n = 20) => s.match(new RegExp(`.{0,${n}}${re.source}.{0,${n}}`))?.[0];

/** 各语言「真译」守卫(正文 prose,已去代码块 / 行内代码 / 链接目标) */
const PROSE_GUARDS = {
  en(prose, where) {
    assert.equal(around(prose, CJK_PATTERN), undefined, `${where}: en 正文残留 CJK:${around(prose, CJK_PATTERN)}`);
    const v = findGlossaryViolations(prose);
    assert.deepEqual(v, [], `${where}: 术语禁用变体 ${JSON.stringify(v)}`);
  },
  ja(prose, where) {
    assert.equal(around(prose, HANGUL), undefined, `${where}: ja 正文含谚文:${around(prose, HANGUL)}`);
    assert.equal(around(prose, SIMPLIFIED_ONLY), undefined, `${where}: ja 正文残留简体中文专用字:${around(prose, SIMPLIFIED_ONLY)}`);
    const kana = count(prose, KANA);
    const han = count(prose, HAN);
    assert.ok(kana > 0 && kana / (kana + han) >= 0.4, `${where}: ja 假名占比过低(假名 ${kana} / 汉字 ${han}),疑似未译`);
    assert.equal(around(prose, JA_ASCII_PUNCT), undefined, `${where}: ja 句读须用全角:${around(prose, JA_ASCII_PUNCT)}`);
    assert.equal(around(prose, JA_ASCII_PAREN), undefined, `${where}: ja 括号须用全角:${around(prose, JA_ASCII_PAREN)}`);
  },
  ko(prose, where) {
    assert.equal(around(prose, HAN), undefined, `${where}: ko 正文残留汉字:${around(prose, HAN)}`);
    assert.equal(around(prose, KANA), undefined, `${where}: ko 正文含假名:${around(prose, KANA)}`);
    assert.ok(HANGUL.test(prose), `${where}: ko 正文无谚文,疑似未译`);
    assert.equal(around(prose, KO_FULLWIDTH_PUNCT), undefined, `${where}: ko 标点须用半角:${around(prose, KO_FULLWIDTH_PUNCT)}`);
  },
};

/** frontmatter 里 title / description 的语言守卫(较正文宽松:只看字符类) */
const META_GUARDS = {
  en: (v, where) => assert.doesNotMatch(v, CJK_PATTERN, `${where} 含 CJK`),
  ja: (v, where) => {
    assert.ok(KANA.test(v) || HAN.test(v), `${where} 无日文`);
    assert.doesNotMatch(v, HANGUL, `${where} 含谚文`);
    assert.doesNotMatch(v, SIMPLIFIED_ONLY, `${where} 残留简体中文专用字`);
  },
  ko: (v, where) => {
    assert.ok(HANGUL.test(v), `${where} 无谚文`);
    assert.doesNotMatch(v, HAN, `${where} 残留汉字`);
    assert.doesNotMatch(v, KO_FULLWIDTH_PUNCT, `${where} 用了全角标点`);
  },
};

const coverage = buildCoverage(root);
const rootSlugs = new Set(coverage.rows.map((r) => r.slug));
/** 生成页(errors/codes · cli/commands · serve/env · releases/*)无手写译文:译文页链根路径;其余内容页链 /<locale>/...(Starlight 回落保证存在) */
const generatedSlugs = new Set(coverage.rows.filter((r) => r.generated).map((r) => r.slug));

test('红例:CJK 残留与术语禁用变体都能被抓到(en)', () => {
  const bad = 'Start the session server, then 会话服务 replies. See `会话服务` and [x](/会话/).';
  const prose = proseOnly(bad);
  assert.match(prose, CJK_PATTERN, '正文 CJK 须被抓到');
  assert.ok(!/`会话服务`/.test(prose) && !/\/会话\//.test(prose), '行内代码与链接目标不计入');
  const v = findGlossaryViolations(prose);
  assert.deepEqual(v.map((x) => x.variant), ['session server']);
  assert.equal(v[0].en, 'session service');
  assert.deepEqual(findGlossaryViolations('the session service is up'), []);
});

test('红例:日文守卫抓简体残留 / 半角句读 / 半角括号 / 假名占比;韩文守卫抓汉字 / 全角标点', () => {
  assert.throws(() => PROSE_GUARDS.ja('セッションを开始します。', 'x'), /简体中文专用字/);
  assert.throws(() => PROSE_GUARDS.ja('セッションを開始します. 次へ', 'x'), /全角/);
  assert.throws(() => PROSE_GUARDS.ja('エンドユーザー(短期)トークン', 'x'), /括号/);
  assert.throws(() => PROSE_GUARDS.ja('カーネル権限監査工具調整履歴管理設定構成の', 'x'), /假名占比/);
  assert.doesNotThrow(() => PROSE_GUARDS.ja('エージェントは、あなたがデプロイした `@tansr/serve` の中で動作します（平台側ではありません）。', 'x'));
  assert.throws(() => PROSE_GUARDS.ko('세션 서비스는 网关가 아닙니다.', 'x'), /汉字/);
  assert.throws(() => PROSE_GUARDS.ko('세션 서비스는 게이트웨이가 아닙니다。', 'x'), /半角/);
  assert.throws(() => PROSE_GUARDS.ko('session service only', 'x'), /无谚文/);
  assert.doesNotThrow(() => PROSE_GUARDS.ko('세션 서비스는 게이트웨이가 아닙니다. 인증(로그인)은 여러분의 체계에 속합니다.', 'x'));
});

test('术语表:zh / en / ja / ko 四列非空且 en 主形唯一;avoid 变体不与任何主形重合;ja 全角括号、ko 半角括号', () => {
  const ens = GLOSSARY.map((t) => t.en.toLowerCase());
  assert.equal(new Set(ens).size, ens.length, 'en 主形重复');
  for (const t of GLOSSARY) {
    assert.ok(t.zh && t.en && t.ja && t.ko, `术语缺 zh / en / ja / ko:${JSON.stringify(t)}`);
    for (const a of t.avoid ?? []) assert.ok(!ens.includes(a.toLowerCase()), `avoid「${a}」撞主形`);
    assert.doesNotMatch(t.ja, /[()]/, `ja「${t.ja}」括号须全角`);
    assert.doesNotMatch(t.ja, HANGUL, `ja「${t.ja}」含谚文`);
    assert.doesNotMatch(t.ko, /[（）]/, `ko「${t.ko}」括号须半角`);
    assert.doesNotMatch(t.ko, HAN, `ko「${t.ko}」含汉字`);
  }
  assert.ok(GLOSSARY.some((t) => t.zh === '会话服务' && t.en === 'session service' && t.ja === 'セッションサービス' && t.ko === '세션 서비스'));
  assert.ok(GLOSSARY.some((t) => t.zh === '套餐' && t.en === 'plan'));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('终端令牌') && t.en.startsWith('end-user token')));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('逃生态') && t.en.startsWith('escape hatch')));
  assert.ok(GLOSSARY.some((t) => t.zh.includes('派生键') && t.en.startsWith('derived key')));
  assert.ok(GLOSSARY.some((t) => t.zh === '出网白名单' && t.en === 'egress allowlist'));
});

test('语言接线:EXTRA_LOCALES 含 en / ja / ko;11 类四语标签齐;astro.config 侧栏 translations 四语;组件不再有 isEn 二叉分支', () => {
  assert.deepEqual(EXTRA_LOCALES.en, { label: 'English', lang: 'en' });
  assert.deepEqual(EXTRA_LOCALES.ja, { label: '日本語', lang: 'ja' });
  assert.deepEqual(EXTRA_LOCALES.ko, { label: '한국어', lang: 'ko' });
  assert.deepEqual(Object.keys(EXTRA_LOCALES), TRANSLATED_LOCALES);
  assert.equal(CATEGORIES.length, 11);
  for (const c of CATEGORIES) {
    for (const l of TRANSLATED_LOCALES) assert.ok(typeof c[l] === 'string' && c[l].length > 0, `${c.directory} 缺 ${l} 标签`);
    assert.doesNotMatch(c.ja, HANGUL);
    assert.doesNotMatch(c.ko, HAN);
  }
  assert.equal(uiLocale(undefined), 'zh-CN');
  assert.equal(uiLocale('root'), 'zh-CN');
  assert.equal(uiLocale('en'), 'en');
  assert.equal(uiLocale('ja'), 'ja');
  assert.equal(uiLocale('ko'), 'ko');
  const config = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
  assert.match(config, /translations: \{ en: c\.en, ja: c\.ja, ko: c\.ko \}/, '侧栏组 translations 须四语');
  assert.match(config, /slug: 'sdk\/api'[^\n]*translations: \{[^}]*\bja: '[^']+'[^}]*\bko: '[^']+'/, 'sdk/api 条 translations 须含 ja / ko');
  const componentsDir = join(root, 'src', 'components');
  for (const f of readdirSync(componentsDir)) {
    const src = readFileSync(join(componentsDir, f), 'utf8');
    assert.doesNotMatch(src, /\bisEn\b|=== 'en'/, `${f}: 文案分支须四语查表,不得只分 en / 非 en`);
  }
  for (const f of ['Feedback.astro', 'ContactForm.astro', 'HeroSearch.astro', 'Related.astro', 'Footer.astro', 'ZoneNav.astro', 'CategoryGrid.astro', 'HotArticles.astro', 'FaqGroups.astro']) {
    const src = readFileSync(join(componentsDir, f), 'utf8');
    assert.match(src, /uiLocale\(/, `${f}: 须经 uiLocale 查四语文案表`);
    if (f !== 'CategoryGrid.astro') for (const l of ['ja', 'ko']) assert.match(src, new RegExp(`\\b${l}: `), `${f}: 缺 ${l} 文案`);
  }
});

for (const locale of TRANSLATED_LOCALES) {
  for (const rel of FIRST_BATCH) {
    const where = `${locale}/${rel}`;
    const trPath = join(docs, locale, rel);
    const zhPath = join(docs, rel);

    test(`${where}:与源同 slug 同扩展名存在;template · zone · category · related · sources 与 zh-CN 逐字同;lastVerified ≥ zh-CN;title / description 已译`, () => {
      assert.ok(existsSync(zhPath), `zh-CN 源页缺失 ${rel}`);
      assert.ok(existsSync(trPath), `${locale} 页缺失 ${rel}`);
      const zh = splitFrontmatter(readFileSync(zhPath, 'utf8'));
      const tr = splitFrontmatter(readFileSync(trPath, 'utf8'));
      for (const key of ['template', 'zone', 'category', 'related', 'sources']) {
        assert.equal(fmBlock(tr.fm, key), fmBlock(zh.fm, key), `${where}: frontmatter ${key} 须与 zh-CN 逐字同`);
      }
      const lv = (fm) => /^lastVerified:\s*'?(\d{4}-\d{2}-\d{2})'?$/m.exec(fm)?.[1];
      assert.ok(lv(tr.fm) && lv(tr.fm) >= lv(zh.fm), `${where}: lastVerified 缺失或早于 zh-CN`);
      for (const key of ['title', 'description']) {
        const v = fmBlock(tr.fm, key);
        assert.ok(v && v.length > `${key}: `.length, `${where}: ${key} 为空`);
        META_GUARDS[locale](v, `${where}: ${key}`);
      }
      if (rel.endsWith('.mdx')) {
        const imports = (s) => (s.match(/^import .*$/gm) ?? []).map((l) => l.replace(/'(\.\.\/)+/, "'"));
        assert.deepEqual(imports(tr.body), imports(zh.body), `${where}: 须沿用 zh-CN 同一组组件`);
      }
      if (/^hero:/m.test(zh.fm)) {
        assert.match(tr.fm, /^hero:/m, `${where}: 源页有 hero 块,译文须有`);
        assert.match(tr.fm, new RegExp(`^\\s+link: /${locale}/\\s*$`, 'm'), `${where}: hero.actions.link 须指 /${locale}/`);
      }
    });

    test(`${where}:正文真译守卫;零内部编号;代码块与 zh-CN 逐字节相同`, () => {
      const zhBody = splitFrontmatter(readFileSync(zhPath, 'utf8')).body;
      const trBody = splitFrontmatter(readFileSync(trPath, 'utf8')).body;
      PROSE_GUARDS[locale](proseOnly(trBody), where);
      if (locale !== 'en') {
        const hit = trBody.match(INTERNAL_PATTERN);
        assert.equal(hit, null, `${where}: 正文含内部编号 / 流程词「${hit?.[0]}」`);
      }
      const a = fences(zhBody);
      const b = fences(trBody);
      assert.equal(b.length, a.length, `${where}: 代码块数 ${b.length} ≠ zh-CN ${a.length}`);
      a.forEach((f, i) => assert.equal(b[i], f, `${where}: 第 ${i + 1} 个代码块须逐字节照抄 zh-CN`));
    });

    test(`${where}:内链指 /${locale}/...(生成页 / api 无译文则指根路径);目标页存在;zh-CN 源的链接不漏`, () => {
      const zhBody = splitFrontmatter(readFileSync(zhPath, 'utf8')).body;
      const trBody = splitFrontmatter(readFileSync(trPath, 'utf8')).body;
      const internalLinks = (s) => [...s.replace(/```[\s\S]*?```/g, '').matchAll(/\]\((\/[^)\s#]*)(#[^)]*)?\)/g)].map((m) => m[1] + (m[2] ?? ''));
      const prefix = `/${locale}/`;
      const strip = (href) => (href === prefix || href.startsWith(prefix) ? `/${href.slice(prefix.length)}` : href);
      for (const href of internalLinks(trBody)) {
        if (/\.(png|svg|jpg|webp|json|txt)$/i.test(href)) continue;
        const isLocal = href === prefix || href.startsWith(prefix);
        const slug = (isLocal ? href.slice(prefix.length) : href.slice(1)).replace(/#.*$/, '').replace(/\/$/, '');
        if (slug === 'api') continue; // 生成 API 页另有入口
        assert.ok(rootSlugs.has(slug), `${where}: 链接目标不存在 ${href}`);
        if (generatedSlugs.has(slug)) assert.ok(!isLocal, `${where}: 生成页无译文,须链根路径:${href}`);
        else assert.ok(isLocal, `${where}: 内容页须链 ${prefix}${slug}/:${href}`);
      }
      // 忠实:zh-CN 源的每个站内链接目标(含锚点)都须出现在译文里(去语言前缀后比对)——不漏链
      const trSet = new Set(internalLinks(trBody).map(strip));
      const missing = [...new Set(internalLinks(zhBody))].filter((h) => !trSet.has(h));
      assert.deepEqual(missing, [], `${where}: 漏译 zh-CN 源的站内链接 ${missing.join(' ')}`);
    });
  }
}

test('覆盖模型:首批 13 篇在 en / ja / ko 全部计入,无孤儿', () => {
  const want = FIRST_BATCH.map(fileToSlug);
  for (const l of TRANSLATED_LOCALES) {
    for (const s of want) assert.ok(coverage.rows.find((r) => r.slug === s)?.translated[l], `${s} 未计入 ${l} 覆盖`);
    assert.equal(coverage.summary[l], want.length, `${l} 覆盖数 ${coverage.summary[l]} ≠ ${want.length}`);
  }
  assert.deepEqual(coverage.orphans, []);
});
