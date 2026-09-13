#!/usr/bin/env node
/**
 * 发布说明页生成器(资料站 DS-09 → DS-23 用户口吻层)。
 *   contract/changelog/{cli,sdk,serve}.md + contract/release-notes.json → src/content/docs/releases/{cli,sdk,serve}.md
 *
 * 页形(自 DS-23 起):
 *   1. 顶部「用户口吻层」——按 CHANGELOG 的版本段顺序,每版一节 `## <version>(<日期> | 未发)`,
 *      正文取 `contract/release-notes.json`(手维护)的 added / changed / fixed 三段(空段不出),零内部卡号;
 *      三段皆空时须有 `note`(如「无用户可见变更」),`note` 在场则作末段说明。「未发」按三种信号之一标:
 *      候选段标题 `## <version> — 候选…`、版本名 `Unreleased` / `未发布…`、或版本段首段引言含「未发」;未发版本恒不带日期。
 *   2. `<details><summary>工程变更原文(CHANGELOG)</summary> … </details>` 折叠段——CHANGELOG 去 H1 后逐字放入,
 *      仅把标题层级整体下调两级(`##` → `####`),免得折叠段的版本标题挤进本页目录(Starlight 目录只取 h2 / h3);
 *      折叠段以 `<!-- internal-changelog -->` / `<!-- /internal-changelog -->` 包夹,内部编号门(scripts/check/release-notes.mjs)据此跳过。
 *   CHANGELOG 首行 `# <包名> Changelog` 作为页题进 frontmatter。只加 frontmatter(契约 3)与生成头(契约 4)。
 *
 *   node scripts/gen/releases.mjs [--check]
 */
import { join } from 'node:path';
import { isMainModule } from '../lib/text.mjs';
import { DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, readContractJson, readContractText, runGenerator } from './lib.mjs';

export const SCRIPT = 'scripts/gen/releases.mjs';
export const NOTES_SOURCE = 'release-notes.json';
export const UNRELEASED_NOTE = '无用户可见变更';
export const INTERNAL_OPEN = '<!-- internal-changelog -->';
export const INTERNAL_CLOSE = '<!-- /internal-changelog -->';
export const DETAILS_SUMMARY = '工程变更原文(CHANGELOG)';

export const PACKAGES = [
  { id: 'cli', source: 'changelog/cli.md', label: '@tansr/cli' },
  { id: 'sdk', source: 'changelog/sdk.md', label: '@tansr/sdk' },
  { id: 'serve', source: 'changelog/serve.md', label: '@tansr/serve' },
];

/** 用户口吻层的三段(顺序即页面顺序) */
export const SECTIONS = Object.freeze([
  { key: 'added', label: '新增' },
  { key: 'changed', label: '变更' },
  { key: 'fixed', label: '修复' },
]);

export function outRel(id) {
  return join(DOCS_DIR, 'releases', `${id}.md`);
}

/** 拆 H1 与正文;H1 缺席则页题用包名。 */
export function splitChangelog(text) {
  const m = /^# (.+)\n/.exec(text);
  if (!m) return { title: undefined, body: text };
  return { title: m[1].trim(), body: text.slice(m[0].length).replace(/^\n+/, '') };
}

export function countVersionSections(body) {
  return [...body.matchAll(/^## .+$/gm)].length;
}

/** 版本名本身即宣告未发:`Unreleased` / `未发布…`(上游 CHANGELOG 的两种候选段命名) */
export const UNRELEASED_VERSION = /^(?:unreleased|未发布)/i;

/**
 * 解析 CHANGELOG 版本段:兼容裸版本 / 圆括号日期、`## <version> — YYYY-MM-DD`,以及候选段 `## <version> — 候选…`。
 * 返回 [{ version, heading, date, unreleased, body }];`date` 取 em-dash 后的 ISO 日期或标题括注里的首个 YYYY-MM-DD(无则 undefined);
 * `unreleased` = 候选段标题、版本名为 `Unreleased` / `未发布…`,或段体首个引言块(`> …`)含「未发」。
 * 候选段(`— 候选`)恒不取日期:候选只写「候选」不写发布日期,标题里的日期是候选登记日,不是发版日。
 */
export function parseVersionSections(body) {
  const lines = body.split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    const c = /^## (\S+)\s+—\s+候选.*$/.exec(line);
    if (c) {
      cur = { version: c[1], heading: line.slice(3).trim(), date: undefined, unreleased: true, candidate: true, body: [] };
      out.push(cur);
      continue;
    }
    const h = /^## (\S+)(?:\s+\((.*)\)|\s+—\s+(\d{4}-\d{2}-\d{2}))?\s*$/.exec(line);
    const isoDate = h?.[3];
    const timestamp = isoDate === undefined ? undefined : Date.parse(`${isoDate}T00:00:00.000Z`);
    // Only the new ISO-date form is strict; preserve the existing parenthesized metadata contract.
    if (h && (isoDate === undefined || (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === isoDate))) {
      cur = { version: h[1], heading: line.slice(3).trim(), date: isoDate ?? /\d{4}-\d{2}-\d{2}/.exec(h[2] ?? '')?.[0], unreleased: false, body: [] };
      out.push(cur);
      continue;
    }
    if (cur) cur.body.push(line);
  }
  for (const s of out) {
    const firstQuote = s.body.find((l) => /^\s*>/.test(l)) ?? '';
    s.unreleased = s.candidate === true || UNRELEASED_VERSION.test(s.version) || /未发/.test(firstQuote);
    s.body = s.body.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  }
  return out;
}

/** 折叠段内标题整体下调两级(`##` → `####`,最深到 `######`);围栏代码块内不动。 */
export function demoteHeadings(md, by = 2) {
  let inFence = false;
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const m = /^(#{1,6})(\s+\S)/.exec(line);
      if (!m) return line;
      return '#'.repeat(Math.min(6, m[1].length + by)) + m[2] + line.slice(m[0].length);
    })
    .join('\n');
}

function versionHeading(section, entry) {
  const date = entry?.date ?? section.date;
  // 未发版本恒不带日期,一律以「(未发)」后缀标注(含版本名本身为 Unreleased / 未发布… 的段,形制统一)。
  if (section.unreleased) return `## ${section.version}(未发)`;
  return date ? `## ${section.version}(${date})` : `## ${section.version}`;
}

/**
 * 渲染一版的用户口吻节。`entry` 缺席即抛(门 scripts/check/release-notes.mjs 先红,此处兜底不让页面静默缺版)。
 */
export function renderUserSection(section, entry) {
  if (!entry) throw new Error(`contract/${NOTES_SOURCE} 缺版本 ${section.version} 的条目`);
  const out = [versionHeading(section, entry)];
  if (section.unreleased) {
    out.push('');
    out.push('> 本版尚未发布;以下为候发内容,以实际发版为准。');
  }
  let any = false;
  for (const s of SECTIONS) {
    const items = Array.isArray(entry[s.key]) ? entry[s.key] : [];
    if (!items.length) continue;
    any = true;
    out.push('');
    out.push(`### ${s.label}`);
    out.push('');
    for (const it of items) out.push(`- ${String(it).trim()}`);
  }
  if (typeof entry.note === 'string' && entry.note.trim()) {
    out.push('');
    out.push(entry.note.trim());
  } else if (!any) {
    throw new Error(`contract/${NOTES_SOURCE} 版本 ${section.version} 三段皆空又无 note`);
  }
  return out.join('\n');
}

export function render({ pkg, text, notes, lastVerified }) {
  const { title, body } = splitChangelog(text);
  const sections = parseVersionSections(body);
  const out = [];
  out.push(
    frontmatter({
      title: title ?? `${pkg.label} 发布说明`,
      description: `${pkg.label} 各版本的用户可见变更(新增 / 变更 / 修复;${sections.length} 个版本),附包内 CHANGELOG 原文折叠段。`,
      zone: 'docs',
      category: 'releases',
      sources: [`contract/${pkg.source}`, `contract/${NOTES_SOURCE}`],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, `contract/${pkg.source}`));
  out.push('');
  out.push(`按版本列出 \`${pkg.label}\` 的用户可见变更;每版分「新增 / 变更 / 修复」三段,涉及迁移的条目写明迁移方式。工程视角的完整变更记录见页末折叠段。`);
  for (const s of sections) {
    out.push('');
    out.push(renderUserSection(s, notes?.[s.version]));
  }
  out.push('');
  out.push('<details>');
  out.push(`<summary>${DETAILS_SUMMARY}</summary>`);
  out.push('');
  out.push('> 以下为工程变更原文,逐字取自包内 CHANGELOG(面向贡献者,含内部编号);仅标题层级整体下调两级。');
  out.push('');
  out.push(INTERNAL_OPEN);
  out.push('');
  out.push(demoteHeadings(body.replace(/\n+$/, '')));
  out.push('');
  out.push(INTERNAL_CLOSE);
  out.push('');
  out.push('</details>');
  return out.join('\n') + '\n';
}

export function generate(root) {
  const notes = readContractJson(root, NOTES_SOURCE);
  return PACKAGES.map((pkg) => {
    const text = readContractText(root, pkg.source);
    const content = render({ pkg, text, notes: notes[pkg.id], lastVerified: lastVerifiedFor(root, pkg.source) });
    return { rel: outRel(pkg.id), content, stats: { sections: countVersionSections(splitChangelog(text).body) } };
  });
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
