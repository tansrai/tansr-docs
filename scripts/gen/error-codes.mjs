#!/usr/bin/env node
/**
 * 错误码参考页生成器(资料站 DS-07)。
 *   contract/openapi.json `x-tansr-error-codes[]` → src/content/docs/errors/codes.md
 *
 * 契约里每码只有 `{ code, status }`(令牌径失效码另携 `x-invalidates-token` / `x-tansr-token-reasons`),没有
 * 「面」「可重试」「说明」字段,故三者按下述**可复现规则**派生(规则本身即页面口径,写进页首):
 *   - 面:扫 openapi 全部操作的 summary / 参数说明 / 响应说明,整词出现该码的操作其 tag 归到的面;
 *         恰一个面 → 该面分组;多个面 → 「通用」;一个都没有 → 「其他」。
 *   - 可重试:HTTP 429 / 502 / 503 / 504 → 是;其余否;例外 device_code_pending(400,轮询语义)→ 是。
 *   - 说明 / 端侧提示:scripts/gen/error-codes.notes.json 的用户口吻文案(缺则按状态给通用一句);
 *         `x-invalidates-token` 码追加「清除令牌并重新登录」提示与 detail.reason 取值。
 * 结构:`## <面>` 分组 → `### <code>`(锚点 `#<code>`)+ 单行表(HTTP 状态 · 可重试 · 说明 · 端侧呈现提示)。
 *
 *   node scripts/gen/error-codes.mjs            生成
 *   node scripts/gen/error-codes.mjs --check    再生与在库文件逐字节比对,差即 exit 1
 */
import { join } from 'node:path';
import { isMainModule, readJson } from '../lib/text.mjs';
import { cell, DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, mentionsWord, readContractJson, runGenerator, slug } from './lib.mjs';

export const SCRIPT = 'scripts/gen/error-codes.mjs';
export const SOURCE = 'openapi.json';
export const OUT_REL = join(DOCS_DIR, 'errors', 'codes.md');

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

/** tag → 面(顺序 = 分组顺序);未登记的 tag 以 tag 名自成一面。 */
export const FACES = [
  { id: 'gateway', label: '数据面', tags: ['gateway'], note: 'OpenAI 与 Anthropic 兼容接口' },
  { id: 'twp', label: 'twp 协议面', tags: ['twp'], note: 'tansr 自有协议 twp 的接口' },
  { id: 'control', label: '控制面', tags: ['auth', 'orgs', 'control', 'apps', 'org-governance'], note: '认证、组织、应用、配置等接口' },
  { id: 'webhooks', label: '支付回调面', tags: ['webhooks'], note: '支付渠道回调' },
  { id: 'admin', label: '管理面', tags: ['admin'], note: '门户管理后台专用接口' },
  { id: 'ops', label: '运维探针', tags: ['ops'], note: '健康检查等探针' },
];
const COMMON = { id: 'common', label: '通用', note: '在多个面的接口说明中都会出现' };
const OTHER = { id: 'other', label: '其他', note: '仅在错误码目录登记,未出现在任一接口说明中' };

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
/** 状态之外的可重试例外(语义显然、契约未标) */
const RETRYABLE_OVERRIDE = { device_code_pending: '是(继续轮询)' };

const STATUS_FALLBACK = {
  400: '请求不合法或参数校验失败。',
  401: '凭据缺失或无效。',
  402: '需要付费或余额不足。',
  403: '没有权限执行该操作。',
  404: '资源不存在。',
  409: '与当前状态冲突。',
  410: '资源已不可用。',
  413: '请求体过大。',
  429: '请求过于频繁或配额用尽。',
  500: '服务端内部错误。',
  502: '上游服务错误。',
  503: '服务暂不可用。',
  504: '上游服务超时。',
};

function faceOfTag(tag) {
  const f = FACES.find((x) => x.tags.includes(tag));
  return f ? f.id : tag;
}

function faceLabel(id) {
  return FACES.find((x) => x.id === id)?.label ?? id;
}

/** 每码 → 出现面 id 集(按 FACES 顺序排;未知 tag 面附后) */
export function facesByCode(openapi) {
  const codes = openapi['x-tansr-error-codes'].map((e) => e.code);
  const hits = new Map(codes.map((c) => [c, new Set()]));
  for (const item of Object.values(openapi.paths ?? {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.has(method) || typeof op !== 'object' || op === null) continue;
      const texts = [op.summary ?? '', op.description ?? ''];
      for (const p of op.parameters ?? []) texts.push(p.description ?? '');
      texts.push(op.requestBody?.description ?? '');
      for (const r of Object.values(op.responses ?? {})) texts.push(r.description ?? '');
      const text = texts.join('\n');
      const faces = new Set((op.tags ?? []).map(faceOfTag));
      for (const c of codes) {
        if (mentionsWord(text, c)) for (const f of faces) hits.get(c).add(f);
      }
    }
  }
  const order = (id) => {
    const i = FACES.findIndex((x) => x.id === id);
    return i === -1 ? FACES.length : i;
  };
  const out = new Map();
  for (const [c, set] of hits) out.set(c, [...set].sort((a, b) => order(a) - order(b) || a.localeCompare(b)));
  return out;
}

export function retryable(entry) {
  if (entry.code in RETRYABLE_OVERRIDE) return RETRYABLE_OVERRIDE[entry.code];
  if (!RETRYABLE_STATUS.has(entry.status)) return '否';
  return entry.status === 429 ? '是(按 Retry-After 退避)' : '是(退避后重试)';
}

function clientHint(entry, note) {
  const parts = [];
  if (note?.hint) parts.push(note.hint);
  if (entry['x-invalidates-token'] === true) {
    const reasons = entry['x-tansr-token-reasons'];
    let s = '该码使当前令牌失效:清除本地令牌并重新登录。';
    if (reasons?.values?.length) {
      s += `detail.reason 取值:${reasons.values.map((v) => `\`${v}\``).join('、')}`;
      if (reasons.transient?.length) {
        s += `;其中 ${reasons.transient.map((v) => `\`${v}\``).join('、')} 为暂时性原因,令牌仍有效,不应清除`;
      }
      s += '。';
    }
    parts.push(s);
  }
  return parts.length ? parts.join(' ') : '—';
}

export function loadNotes(root) {
  const notes = readJson(join(root, 'scripts', 'gen', 'error-codes.notes.json'));
  delete notes.$comment;
  return notes;
}

export function render({ openapi, notes, lastVerified }) {
  const entries = openapi['x-tansr-error-codes'];
  const faces = facesByCode(openapi);
  const groups = new Map();
  const groupOf = (code) => {
    const f = faces.get(code);
    if (f.length === 0) return OTHER.id;
    if (f.length === 1) return f[0];
    return COMMON.id;
  };
  for (const e of entries) {
    const g = groupOf(e.code);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  const groupOrder = [COMMON.id, ...FACES.map((f) => f.id), ...[...groups.keys()].filter((g) => g !== COMMON.id && g !== OTHER.id && !FACES.some((f) => f.id === g)).sort(), OTHER.id];
  const labelOf = (g) => (g === COMMON.id ? COMMON.label : g === OTHER.id ? OTHER.label : faceLabel(g));
  const noteOf = (g) => (g === COMMON.id ? COMMON.note : g === OTHER.id ? OTHER.note : FACES.find((f) => f.id === g)?.note ?? `tag \`${g}\` 的接口`);

  const out = [];
  out.push(
    frontmatter({
      title: '错误码参考',
      description: `tansr 平台 REST API 错误码目录(共 ${entries.length} 个):HTTP 状态、可重试性、说明与端侧呈现提示。`,
      zone: 'docs',
      category: 'errors',
      sources: ['contract/openapi.json'],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, 'contract/openapi.json'));
  out.push('');
  out.push('所有接口的错误响应都是同一个信封:');
  out.push('');
  out.push('```json');
  out.push('{ "error": { "code": "rate_limited", "message": "…", "requestId": "…", "detail": { } } }');
  out.push('```');
  out.push('');
  out.push(`- \`code\` 取值见下表(共 ${entries.length} 个),每个码有固定的 HTTP 状态;\`message\` 是给人看的文字,不要用它做判断;\`requestId\` 用于联系支持时定位;\`detail\` 可选,按码给出结构化补充。`);
  out.push('- 分组按「面」:一个码只在某一面的接口说明里出现,就归该面;在多个面出现的归「通用」;接口说明里没有出现的归「其他」。');
  out.push('- 「可重试」按 HTTP 状态判定:429 / 502 / 503 / 504 为可重试(429 请按 `Retry-After` 头退避);其余状态不要用同一请求原样重试。');
  out.push(`- 深链锚点为码名本身,例如 \`#rate_limited\`。`);
  out.push('');
  out.push('| 面 | 含义 | 码数 |');
  out.push('|---|---|---|');
  for (const g of groupOrder) if (groups.has(g)) out.push(`| [${labelOf(g)}](#${slug(labelOf(g))}) | ${noteOf(g)} | ${groups.get(g).length} |`);
  out.push('');

  for (const g of groupOrder) {
    if (!groups.has(g)) continue;
    out.push(`## ${labelOf(g)}`);
    out.push('');
    out.push(`${noteOf(g)}。`);
    out.push('');
    for (const e of groups.get(g).sort((a, b) => a.code.localeCompare(b.code))) {
      const note = notes[e.code];
      const text = note?.text ?? STATUS_FALLBACK[e.status] ?? '(契约未附说明)';
      const shown = faces.get(e.code);
      out.push(`### ${e.code}`);
      out.push('');
      if (g === COMMON.id) out.push(`出现于:${shown.map(faceLabel).join('、')}。`);
      else if (g === OTHER.id) out.push('未在任一接口说明中出现;以错误码目录为准。');
      else out.push(`出现于:${faceLabel(g)}。`);
      out.push('');
      out.push('| HTTP 状态 | 可重试 | 说明 | 端侧呈现提示 |');
      out.push('|---|---|---|---|');
      out.push(`| ${e.status} | ${cell(retryable(e))} | ${cell(text)} | ${cell(clientHint(e, note))} |`);
      out.push('');
    }
  }
  return out.join('\n');
}

export function generate(root) {
  const openapi = readContractJson(root, SOURCE);
  const notes = loadNotes(root);
  const stale = Object.keys(notes).filter((k) => !openapi['x-tansr-error-codes'].some((e) => e.code === k));
  if (stale.length) throw new Error(`error-codes.notes.json 有契约里不存在的码:${stale.join(', ')}`);
  const content = render({ openapi, notes, lastVerified: lastVerifiedFor(root, SOURCE) });
  return [{ rel: OUT_REL, content }];
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
