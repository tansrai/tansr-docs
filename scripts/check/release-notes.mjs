/**
 * 发布说明门(资料站 DS-23;入 `pnpm gate`):
 *   ① 覆盖:三包 CHANGELOG(contract/changelog/*.md)的每个 `## <version>` 段,在 contract/release-notes.json 须有条目;
 *      条目形 `{ date?: 'YYYY-MM-DD', added: [], changed: [], fixed: [], note?: string }`,三段皆空须有 `note`(如「无用户可见变更」);
 *      release-notes.json 里 CHANGELOG 没有的版本(孤儿)亦红——手维护条目不得凭空。
 *   ② 内部编号(V-DS-08 `rg` 门形:`FX-|W[1-5] 回执|泳道|收编`,另加 `回执|卡号|复审|十王修案|doc/<n>`):
 *      扫 release-notes.json 全文,与生成页 src/content/docs/releases/*.md 在 `<details>…</details>` 折叠段
 *      (等价:`<!-- internal-changelog -->…<!-- /internal-changelog -->`)之外的部分;折叠段是 CHANGELOG 原文,按主线裁定跳过。
 *
 * 用法:node scripts/check/release-notes.mjs [--root <dir>] [--json]
 *   退出码:0 全绿;1 有违反(逐条 `code where — detail`,末行单行 JSON 汇总)。
 * 自测卷:scripts/check/test/release-notes.test.mjs(夹具在临时目录)。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { NOTES_SOURCE, outRel, PACKAGES, parseVersionSections, SECTIONS, splitChangelog } from '../gen/releases.mjs';

export const CODES = Object.freeze({
  MISSING_ENTRY: 'missing-entry',
  ORPHAN_ENTRY: 'orphan-entry',
  BAD_ENTRY: 'bad-entry',
  EMPTY_ENTRY: 'empty-entry',
  BAD_DATE: 'bad-date',
  INTERNAL_CODE: 'internal-code',
  NOTES_UNREADABLE: 'notes-unreadable',
  PAGE_MISSING: 'page-missing',
});

export const HINTS = Object.freeze({
  [CODES.MISSING_ENTRY]: 'CHANGELOG 有此版本段而 release-notes.json 无条目:补 added / changed / fixed,或 note: "无用户可见变更"',
  [CODES.ORPHAN_ENTRY]: 'release-notes.json 有此版本而 CHANGELOG 无对应 `## <version>` 段:删条目或先 vendor 新 CHANGELOG',
  [CODES.BAD_ENTRY]: '条目形须为 { date?, added: string[], changed: string[], fixed: string[], note?: string }',
  [CODES.EMPTY_ENTRY]: '三段皆空须写 note(如「无用户可见变更」)',
  [CODES.BAD_DATE]: 'date 须为 YYYY-MM-DD',
  [CODES.INTERNAL_CODE]: '用户口吻层不得出现内部编号 / 波次 / 回执 / 卡号等内部用语(V-DS-08);改写为用户可见的「变了什么 · 对你意味着什么 · 迁移方式」',
  [CODES.NOTES_UNREADABLE]: 'contract/release-notes.json 不存在或不是合法 JSON 对象',
  [CODES.PAGE_MISSING]: '生成页缺席:先跑 pnpm gen',
});

/** V-DS-08 `rg` 门形 + 本仓补充词 */
export const INTERNAL_PATTERN = /FX-|W[1-5] 回执|泳道|收编|回执|卡号|复审|十王修案|doc\/\d+/;

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') opts.root = resolve(String(argv[++i] ?? '.'));
    else if (arg === '--json') opts.json = true;
    else throw new Error(`release-notes: unknown argument ${arg}`);
  }
  return opts;
}

/** 去掉 `<details>…</details>` 折叠段(多段皆去;未闭合则去到文末),返回其余文本。 */
export function stripDetails(md) {
  return md.replace(/<details>[\s\S]*?(<\/details>|$)/g, '');
}

/** 逐行找内部用语,返回 [{ line, text }](行号 1 起,`text` 为该行去首尾空白) */
export function findInternalCodes(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (INTERNAL_PATTERN.test(line)) hits.push({ line: i + 1, text: line.trim() });
  });
  return hits;
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** 单条目裁决(纯函数):返回违反码列表 */
export function judgeEntry(entry) {
  const codes = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [CODES.BAD_ENTRY];
  const known = new Set(['date', 'note', ...SECTIONS.map((s) => s.key)]);
  if (Object.keys(entry).some((k) => !known.has(k))) codes.push(CODES.BAD_ENTRY);
  for (const s of SECTIONS) if (!isStringArray(entry[s.key])) codes.push(CODES.BAD_ENTRY);
  if ('note' in entry && typeof entry.note !== 'string') codes.push(CODES.BAD_ENTRY);
  if ('date' in entry && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date))) codes.push(CODES.BAD_DATE);
  if (codes.length) return [...new Set(codes)];
  const any = SECTIONS.some((s) => entry[s.key].length > 0);
  if (!any && !(typeof entry.note === 'string' && entry.note.trim())) codes.push(CODES.EMPTY_ENTRY);
  return codes;
}

export function runReleaseNotesCheck({ root }) {
  const violations = [];
  const push = (code, where, detail) => violations.push({ code, where, detail });
  const notesPath = join(root, 'contract', NOTES_SOURCE);
  let notes;
  try {
    notes = JSON.parse(readFileSync(notesPath, 'utf8'));
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) throw new Error('not an object');
  } catch (e) {
    push(CODES.NOTES_UNREADABLE, `contract/${NOTES_SOURCE}`, e.message);
    return { summary: { packages: 0, versions: 0, entries: 0, violations: violations.length }, violations };
  }
  let versions = 0;
  let entries = 0;
  for (const pkg of PACKAGES) {
    const changelog = join(root, 'contract', ...pkg.source.split('/'));
    const sections = existsSync(changelog) ? parseVersionSections(splitChangelog(readFileSync(changelog, 'utf8').replace(/\r\n?/g, '\n')).body) : [];
    const pkgNotes = notes[pkg.id] && typeof notes[pkg.id] === 'object' ? notes[pkg.id] : {};
    const seen = new Set();
    for (const s of sections) {
      versions += 1;
      seen.add(s.version);
      const entry = pkgNotes[s.version];
      if (entry === undefined) {
        push(CODES.MISSING_ENTRY, `${pkg.id} ${s.version}`, `contract/${pkg.source} «## ${s.heading}»`);
        continue;
      }
      entries += 1;
      for (const code of judgeEntry(entry)) push(code, `${pkg.id} ${s.version}`, `contract/${NOTES_SOURCE}`);
    }
    for (const v of Object.keys(pkgNotes)) if (!seen.has(v)) push(CODES.ORPHAN_ENTRY, `${pkg.id} ${v}`, `contract/${NOTES_SOURCE}`);
  }
  for (const k of Object.keys(notes)) {
    if (!PACKAGES.some((p) => p.id === k)) push(CODES.BAD_ENTRY, k, `contract/${NOTES_SOURCE} 未知包键(只认 ${PACKAGES.map((p) => p.id).join(' / ')})`);
  }
  for (const h of findInternalCodes(readFileSync(notesPath, 'utf8'))) push(CODES.INTERNAL_CODE, `contract/${NOTES_SOURCE}:${h.line}`, h.text);
  for (const pkg of PACKAGES) {
    const rel = outRel(pkg.id);
    const full = join(root, rel);
    const relPosix = rel.split('\\').join('/');
    if (!existsSync(full)) {
      push(CODES.PAGE_MISSING, relPosix, '');
      continue;
    }
    const md = readFileSync(full, 'utf8');
    const visible = stripDetails(md);
    for (const h of findInternalCodes(visible)) push(CODES.INTERNAL_CODE, `${relPosix}(折叠段外)`, h.text);
  }
  return { summary: { packages: PACKAGES.length, versions, entries, violations: violations.length }, violations };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runReleaseNotesCheck(opts);
  for (const v of result.violations) console.error(`${v.code} ${v.where}${v.detail ? ` — ${v.detail}` : ''}\n    ${HINTS[v.code]}`);
  if (opts.json) console.log(JSON.stringify(result));
  else console.log(`[release-notes] ${JSON.stringify(result.summary)}`);
  process.exit(result.violations.length === 0 ? 0 : 1);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
