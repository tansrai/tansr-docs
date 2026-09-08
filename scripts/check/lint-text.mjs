/**
 * 文本字节门(沿 tansr-cli `scripts/lint-text.mjs` 律,简化为纯 LF 仓):
 *   BOM / 孤立 CR / CRLF / U+FFFD(替换字符 = 编码事故)/ 无末行 LF → 红。
 * 扫描范围(共同派单契约 7):`src/ scripts/ contract/ .github/` 递归 + 仓根 `*.md`;
 * 二进制(含 NUL 或按扩展名)跳过;node_modules / dist / .astro 不进。
 *
 * 用法:node scripts/check/lint-text.mjs [--root <dir>] [--json]
 *   退出码:0 全绿;1 有违反(逐条 `path: code — hint`,末行单行 JSON 汇总)。
 * 自测卷:scripts/check/test/lint-text.test.mjs(夹具在临时目录)。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const SCAN_DIRS = Object.freeze(['src', 'scripts', 'contract', '.github']);
export const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.git']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip']);

/** 违反码(稿面稳定,自测卷逐字断言) */
export const CODES = Object.freeze({
  BOM: 'bom',
  LONE_CR: 'lone-cr',
  CRLF: 'crlf',
  REPLACEMENT_CHAR: 'replacement-char',
  NO_FINAL_NEWLINE: 'no-final-newline',
});

export const HINTS = Object.freeze({
  [CODES.BOM]: 'UTF-8 BOM(EF BB BF)须去掉;文件恒 LF 无 BOM',
  [CODES.LONE_CR]: '孤立 CR(\\r 后无 \\n):改为 LF',
  [CODES.CRLF]: 'CRLF 行尾:本仓恒 LF(.gitattributes eol=lf),编辑器行尾设置回 LF 后重存',
  [CODES.REPLACEMENT_CHAR]: '含 U+FFFD 替换字符:文件曾被错误编码读写,请从源头重存为 UTF-8',
  [CODES.NO_FINAL_NEWLINE]: '末字节须为 LF(POSIX 文本;diff / 拼接友好)',
});

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') opts.root = resolve(String(argv[++i] ?? '.'));
    else if (arg === '--json') opts.json = true;
    else throw new Error(`lint-text: unknown argument ${arg}`);
  }
  return opts;
}

/** 逐字节扫描:BOM / CRLF / 裸 LF / 孤立 CR / 末字节 / NUL(含 NUL 视同二进制) */
export function scanBytes(buf) {
  const stats = { bom: false, crlf: 0, bareLf: 0, loneCr: 0, endsWithLf: true, nul: false, fffd: false, empty: buf.length === 0 };
  if (buf.length === 0) return stats;
  stats.bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x00) {
      stats.nul = true;
      break;
    }
    if (b === 0x0d) {
      if (buf[i + 1] === 0x0a) {
        stats.crlf += 1;
        i += 1;
      } else stats.loneCr += 1;
    } else if (b === 0x0a) stats.bareLf += 1;
    else if (b === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) stats.fffd = true; // U+FFFD 的 UTF-8 编码
  }
  stats.endsWithLf = buf[buf.length - 1] === 0x0a;
  return stats;
}

/** 单文件裁决(纯函数):返回违反码列表;空文件 / 二进制不判 */
export function judgeFile(stats) {
  const codes = [];
  if (stats.empty || stats.nul) return codes;
  if (stats.bom) codes.push(CODES.BOM);
  if (stats.loneCr > 0) codes.push(CODES.LONE_CR);
  if (stats.crlf > 0) codes.push(CODES.CRLF);
  if (stats.fffd) codes.push(CODES.REPLACEMENT_CHAR);
  if (!stats.endsWithLf) codes.push(CODES.NO_FINAL_NEWLINE);
  return codes;
}

/** 列出待扫文件(仓根相对路径,`/` 分隔) */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(relative(root, full).split('\\').join('/'));
    }
  };
  for (const d of SCAN_DIRS) {
    const full = join(root, d);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full);
  }
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (name.toLowerCase().endsWith('.md') && statSync(full).isFile()) out.push(name);
  }
  return out.sort();
}

export function runLintText({ root }) {
  const files = listFiles(root);
  const violations = [];
  let checked = 0;
  let skippedBinary = 0;
  for (const path of files) {
    if (BINARY_EXT.has(extname(path).toLowerCase())) {
      skippedBinary += 1;
      continue;
    }
    const stats = scanBytes(readFileSync(join(root, path)));
    if (stats.nul) {
      skippedBinary += 1;
      continue;
    }
    checked += 1;
    for (const code of judgeFile(stats)) violations.push({ path, code });
  }
  return { summary: { files: files.length, checked, skippedBinary, violations: violations.length }, violations };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runLintText(opts);
  for (const v of result.violations) console.error(`${v.path}: ${v.code} — ${HINTS[v.code]}`);
  if (opts.json) console.log(JSON.stringify(result));
  else console.log(`[lint-text] ${JSON.stringify(result.summary)}`);
  process.exit(result.violations.length === 0 ? 0 : 1);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
