#!/usr/bin/env node
/**
 * 多语言覆盖率页生成器(资料站 DS-19;两口径 DS-29)。
 *   扫 src/content/docs/**(zh-CN 根 + en/**)的 slug 集 → src/content/docs/releases/i18n-coverage.md
 *   表:slug / zh-CN ✓ / en ✓|回落;附 src/lib/glossary.mjs 术语表。
 *
 * 两口径(DS-29):覆盖率主表只以**手写页**(frontmatter `generated !== true` 的根页)为分母——翻译进度只看人写的文章;
 *   生成页(sdk/api 导出参考、错误码表、命令参考、环境变量表、发布说明;覆盖率页自身不进表)随契约再生、不逐篇翻译,
 *   在主表单独一行只报数量、不计覆盖率;逐页表保留全部行,生成页归到末尾 `<details>` 折叠段。
 *   `summary` 同时保留全部根页口径(`total` / `summary[locale]`,旧算法)供对照;`stats` 的语言计数走主口径(手写页)。
 *
 * 事实源是本仓内容集合本身(不读 contract/),lastVerified 取全部被扫文章 lastVerified 的最大值(不凭空造日期,`--check` 跨日零 diff)。
 *
 *   node scripts/gen/i18n-coverage.mjs [--check] [--root <docsRepo>]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isMainModule } from '../lib/text.mjs';
import { DOCS_DIR, cell, frontmatter, generatedHeader, runGenerator, slug } from './lib.mjs';
import { GLOSSARY } from '../../src/lib/glossary.mjs';
import { EXTRA_LOCALES, ROOT_LOCALE } from '../../src/lib/categories.mjs';

export const SCRIPT = 'scripts/gen/i18n-coverage.mjs';
export const SOURCE = 'src/content/docs';
export const OUT_REL = join(DOCS_DIR, 'releases', 'i18n-coverage.md');
export const OUT_SLUG = 'releases/i18n-coverage';

/** 列出 docs 下 md / mdx(相对 docs 目录,`/` 分隔,已排序) */
export function listDocs(root) {
  const base = join(root, DOCS_DIR);
  if (!existsSync(base)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.mdx?$/i.test(name)) out.push(relative(base, full).split('\\').join('/'));
    }
  };
  walk(base);
  return out.sort();
}

/** 文件相对路径 → Starlight slug(各路径段小写;index → 目录;根 index → '') */
export function fileToSlug(file) {
  let s = file.replace(/\.mdx?$/i, '').split('/').map(slug).join('/');
  if (s === 'index') return '';
  if (s.endsWith('/index')) s = s.slice(0, -'/index'.length);
  return s;
}

/** 只取 frontmatter 里 title / lastVerified / generated 三个标量(不引 YAML 库) */
export function readMeta(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^\uFEFF/, ''));
  const meta = { title: '', lastVerified: '', generated: false };
  if (!m) return meta;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(title|lastVerified|generated):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const raw = kv[2].trim();
    const val = /^(['"])(.*)\1$/.test(raw) ? raw.replace(/^(['"])(.*)\1$/, '$2').replace(/''/g, "'") : raw;
    if (kv[1] === 'generated') meta.generated = val === 'true';
    else meta[kv[1]] = val;
  }
  return meta;
}

/** 手写页 = 根页 frontmatter 无 `generated: true`(生成页随契约再生,不逐篇翻译,不计覆盖率) */
export function isHandwritten(row) {
  return row.generated !== true;
}

/**
 * 覆盖模型:{ locales: ['en'], rows: [{ slug, title, root: true, generated, translated: { en: '<title>' } }], orphans,
 *   summary: { total, handwritten, generated, <locale>: n, byScope: { handwritten: { <locale>: n }, generated: { <locale>: n } } }, lastVerified }
 * 只以根语言(zh-CN)的 slug 集为分母;en 独有的 slug(无对应根页)另列 orphan。
 * 两口径:`handwritten`(主表分母)= generated !== true 的根页数;`total` / `summary[locale]` = 全部根页口径(旧算法,供对照);
 *   `byScope.handwritten[locale]` 是主表分子,`byScope.generated[locale]` 只报数量。
 */
export function buildCoverage(root, generated = []) {
  const locales = Object.keys(EXTRA_LOCALES);
  // 总生成入口尚未写盘:叠加本轮页面及元信息,避免新增 SDK 页后必须二次生成。
  const prefix = DOCS_DIR.split('\\').join('/') + '/';
  const pending = new Map();
  for (const output of generated) {
    const rel = output.rel.split('\\').join('/');
    if (rel.startsWith(prefix) && /\.mdx?$/i.test(rel)) pending.set(rel.slice(prefix.length), output.content);
  }
  const files = [...new Set([...listDocs(root), ...pending.keys()])].sort();
  const bySlug = new Map();
  const orphans = [];
  let lastVerified = '';
  for (const file of files) {
    const slug = fileToSlug(file);
    // 本页自身不进表(否则首次生成前后 slug 集不同,--check 永不收敛)
    if (slug === OUT_SLUG || locales.some((l) => slug === `${l}/${OUT_SLUG}`)) continue;
    const meta = readMeta(pending.get(file) ?? readFileSync(join(root, DOCS_DIR, file), 'utf8'));
    if (meta.lastVerified > lastVerified) lastVerified = meta.lastVerified;
    const locale = locales.find((l) => slug === l || slug.startsWith(`${l}/`));
    if (!locale) {
      const row = bySlug.get(slug) ?? { slug, title: '', translated: {} };
      row.title = meta.title;
      row.generated = meta.generated;
      row.root = true;
      bySlug.set(slug, row);
    } else {
      const rootSlug = slug === locale ? '' : slug.slice(locale.length + 1);
      const row = bySlug.get(rootSlug) ?? { slug: rootSlug, title: '', translated: {} };
      row.translated[locale] = meta.title;
      bySlug.set(rootSlug, row);
    }
  }
  const rows = [];
  for (const row of [...bySlug.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))) {
    if (row.root) rows.push(row);
    else orphans.push(row);
  }
  const handwrittenRows = rows.filter(isHandwritten);
  const generatedRows = rows.filter((r) => !isHandwritten(r));
  const summary = { total: rows.length, handwritten: handwrittenRows.length, generated: generatedRows.length, byScope: { handwritten: {}, generated: {} } };
  const translatedIn = (list, l) => list.filter((r) => r.translated[l] !== undefined).length;
  for (const l of locales) {
    summary[l] = translatedIn(rows, l);
    summary.byScope.handwritten[l] = translatedIn(handwrittenRows, l);
    summary.byScope.generated[l] = translatedIn(generatedRows, l);
  }
  return { locales, rows, orphans, summary, lastVerified: lastVerified || '1970-01-01' };
}

function pct(n, d) {
  return d === 0 ? '0%' : `${Math.round((n / d) * 1000) / 10}%`;
}

function hrefFor(slug) {
  return slug === '' ? '/' : `/${slug}/`;
}

/** 逐页表(表头 + 行);生成页标题带「(生成页)」后缀 */
function pageTable(rows, locales) {
  const out = [`| 页面 | ${ROOT_LOCALE.lang} | ${locales.map((l) => `\`${l}\``).join(' | ')} |`, `|---|---|${locales.map(() => '---').join('|')}|`];
  for (const r of rows) {
    const name = r.generated ? `${cell(r.title)}(生成页)` : cell(r.title);
    const cells = locales.map((l) => (r.translated[l] !== undefined ? `✓ [${cell(r.translated[l])}](/${l}${hrefFor(r.slug)})` : '回落'));
    out.push(`| [${name}](${hrefFor(r.slug)}) \`${r.slug === '' ? '/' : r.slug}\` | ✓ | ${cells.join(' | ')} |`);
  }
  return out;
}

export function render(cov) {
  const { locales, rows, orphans, summary } = cov;
  const handwrittenRows = rows.filter(isHandwritten);
  const generatedRows = rows.filter((r) => !isHandwritten(r));
  const out = [];
  out.push(
    frontmatter({
      title: '多语言覆盖率',
      description: `资料站各语言的翻译进度:${summary.handwritten} 篇手写文章中 ${locales.map((l) => `${EXTRA_LOCALES[l].label} ${summary.byScope.handwritten[l]} 篇`).join('、')};另有 ${summary.generated} 篇由脚本生成的页面随源再生,不计覆盖率。未翻译的页面显示中文原文并提示。附中英术语表。`,
      zone: 'docs',
      category: 'releases',
      lastVerified: cov.lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, SOURCE));
  out.push('');
  out.push(`资料站以${ROOT_LOCALE.label}(\`${ROOT_LOCALE.lang}\`)为根语言,其他语言逐篇翻译。尚未翻译的页面在对应语言路径下**回落**显示中文原文,并在页顶提示。本页由脚本按内容目录自动生成。`);
  out.push('');
  out.push('## 覆盖率');
  out.push('');
  out.push('覆盖率只统计手写文章。由脚本从契约副本生成的页面(SDK 导出参考、错误码表、命令参考、环境变量表、发布说明)随源再生、不逐篇翻译,只报数量,不计入覆盖率。');
  out.push('');
  out.push('| 语言 | 已翻译 / 手写页 | 覆盖率 |');
  out.push('|---|---|---|');
  for (const l of locales) out.push(`| ${EXTRA_LOCALES[l].label}(\`${l}\`) | ${summary.byScope.handwritten[l]} / ${summary.handwritten} | ${pct(summary.byScope.handwritten[l], summary.handwritten)} |`);
  out.push(`| 生成页(不计覆盖率) | ${summary.generated} | — |`);
  out.push('');
  out.push('## 逐页');
  out.push('');
  out.push(...pageTable(handwrittenRows, locales));
  if (generatedRows.length) {
    // 折叠段:<summary> 后空一行,CommonMark 才把其后的表当 Markdown 解析(与 releases 生成页同形)
    out.push('');
    out.push('<details>');
    out.push(`<summary>生成页(${generatedRows.length},不计覆盖率)</summary>`);
    out.push('');
    out.push(...pageTable(generatedRows, locales));
    out.push('');
    out.push('</details>');
  }
  if (orphans.length) {
    out.push('');
    out.push('### 仅存在于翻译语言的页面');
    out.push('');
    out.push('| slug | 语言 |');
    out.push('|---|---|');
    for (const o of orphans) out.push(`| \`${o.slug}\` | ${Object.keys(o.translated).map((l) => `\`${l}\``).join('、')} |`);
  }
  out.push('');
  out.push('## 术语表');
  out.push('');
  out.push('英文正文逐字使用下表的英文主形;命令、键名、错误码、代码块不翻译。');
  out.push('');
  out.push('| 中文 | English | 说明 |');
  out.push('|---|---|---|');
  for (const g of GLOSSARY) out.push(`| ${cell(g.zh)} | ${cell(g.en)} | ${cell(g.note ?? '')} |`);
  return out.join('\n') + '\n';
}

export function generate(root, generated = []) {
  const cov = buildCoverage(root, generated);
  const { summary } = cov;
  // stats 的语言计数走主口径(手写页);total / handwritten / generated 三数同报
  const perLocale = Object.fromEntries(cov.locales.map((l) => [l, summary.byScope.handwritten[l]]));
  return [{ rel: OUT_REL, content: render(cov), stats: { total: summary.total, handwritten: summary.handwritten, generated: summary.generated, ...perLocale, glossary: GLOSSARY.length } }];
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
