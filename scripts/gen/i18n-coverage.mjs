#!/usr/bin/env node
/**
 * 多语言覆盖率页生成器(资料站 DS-19)。
 *   扫 src/content/docs/**(zh-CN 根 + en/**)的 slug 集 → src/content/docs/releases/i18n-coverage.md
 *   表:slug / zh-CN ✓ / en ✓|回落;附 src/lib/glossary.mjs 术语表。
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

/**
 * 覆盖模型:{ locales: ['en'], rows: [{ slug, title, root: true, en: true|false }], summary: { total, en: n } , lastVerified }
 * 只以根语言(zh-CN)的 slug 集为分母;en 独有的 slug(无对应根页)另列 orphan。
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
  const summary = { total: rows.length };
  for (const l of locales) summary[l] = rows.filter((r) => r.translated[l] !== undefined).length;
  return { locales, rows, orphans, summary, lastVerified: lastVerified || '1970-01-01' };
}

function pct(n, d) {
  return d === 0 ? '0%' : `${Math.round((n / d) * 1000) / 10}%`;
}

function hrefFor(slug) {
  return slug === '' ? '/' : `/${slug}/`;
}

export function render(cov) {
  const { locales, rows, orphans, summary } = cov;
  const out = [];
  out.push(
    frontmatter({
      title: '多语言覆盖率',
      description: `资料站各语言的翻译进度:${rows.length} 篇中文文章中 ${locales.map((l) => `${EXTRA_LOCALES[l].label} ${summary[l]} 篇`).join('、')};未翻译的页面显示中文原文并提示。附中英术语表。`,
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
  out.push('| 语言 | 已翻译 / 总数 | 覆盖率 |');
  out.push('|---|---|---|');
  for (const l of locales) out.push(`| ${EXTRA_LOCALES[l].label}(\`${l}\`) | ${summary[l]} / ${summary.total} | ${pct(summary[l], summary.total)} |`);
  out.push('');
  out.push('## 逐页');
  out.push('');
  out.push(`| 页面 | ${ROOT_LOCALE.lang} | ${locales.map((l) => `\`${l}\``).join(' | ')} |`);
  out.push(`|---|---|${locales.map(() => '---').join('|')}|`);
  for (const r of rows) {
    const name = r.generated ? `${cell(r.title)}(生成页)` : cell(r.title);
    const cells = locales.map((l) => (r.translated[l] !== undefined ? `✓ [${cell(r.translated[l])}](/${l}${hrefFor(r.slug)})` : '回落'));
    out.push(`| [${name}](${hrefFor(r.slug)}) \`${r.slug === '' ? '/' : r.slug}\` | ✓ | ${cells.join(' | ')} |`);
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
  return [{ rel: OUT_REL, content: render(cov), stats: { total: cov.summary.total, ...Object.fromEntries(cov.locales.map((l) => [l, cov.summary[l]])), glossary: GLOSSARY.length } }];
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
