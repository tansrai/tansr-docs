/**
 * 文本 / 文件公用件(只用 node 内建模块;vendor 与 gen 两侧共用)。
 * 字节律:仓内一切产物 UTF-8 无 BOM、LF、末行换行。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓根:scripts/<dir>/<file>.mjs → 上两级 */
export function repoRootFrom(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..', '..');
}

/** 归一为仓内字节律:去 BOM、CRLF / CR → LF、保证末行换行(空文本保持空)。 */
export function toLf(text) {
  let t = text.startsWith('\uFEFF') ? text.slice(1) : text;
  t = t.replace(/\r\n?/g, '\n');
  if (t !== '' && !t.endsWith('\n')) t += '\n';
  return t;
}

/** 剥 ANSI 转义(CSI 与 OSC 序列)。 */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '').replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, '');
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function readText(path) {
  return readFileSync(path, 'utf8');
}

export function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

/** 写文件(先建目录);内容须已是 LF 形,这里只做兜底归一。 */
export function writeLf(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toLf(text), 'utf8');
}

export function readJson(path) {
  return JSON.parse(readText(path));
}

/** JSON 落盘形:两空格缩进 + 末行换行(与 api `vendored.json` 同形)。 */
export function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

/** 解析 `--k v` / `--k=v` / `--flag` 形参数;位置参数进 `_`。 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** 模块是否被直跑(而非被 import);win32 盘符大小写不定,归一小写比较。 */
export function isMainModule(importMetaUrl) {
  if (process.argv[1] === undefined) return false;
  const a = fileURLToPath(importMetaUrl);
  const b = resolve(process.argv[1]);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export { join, existsSync };
