#!/usr/bin/env node
/**
 * REST 公开子集生成器(资料站 DS-08)。
 *   contract/openapi.json → contract/openapi.public.json(供 starlight-openapi 挂 /api/)
 *
 * 过滤律(方案 doc/133 §五;规则常量即锁卷登记面):
 *   1. 路径前缀白名单 `/v1` `/t1` `/healthz` `/readyz`(前缀按路径段匹配,`/v1x` 不算);
 *   2. tag 黑名单 `admin` `ops` `webhooks`:路径下任一操作命中即整条路径不出;
 *      例外:`/healthz` `/readyz` 是白名单点名的健康探针,虽 tag 为 ops 仍保留(TAG_BLACKLIST_EXEMPT_PATHS);
 *   3. 去顶层内部扩展(`x-tansr-flags` 等一切非 KEEP_TOP_EXTENSIONS 的 `x-*`),去操作级一切 `x-tansr-*`;
 *      保留 `x-tansr-enums` 全部、`x-tansr-error-codes` 中被公开操作说明整词引用的子集;
 *   4. `components` 只留公开操作可达的 schema(`$ref` 闭包)与被公开操作 `security` 引用的 securityScheme;
 *   5. `tags` 只留公开操作用到的;`servers` 去掉本机 / 私网地址;`info.title` 改「tansr 平台 REST API(公开面)」,
 *      `info.description` 改为公开面口径(原文提及管理面)。
 * 输出键序沿源;JSON 两空格缩进、LF、末行换行;再生零 diff 是门。
 *
 *   node scripts/gen/openapi-public.mjs [--check]
 */
import { isMainModule } from '../lib/text.mjs';
import { CONTRACT_DIR, mentionsWord, readContractJson, runGenerator } from './lib.mjs';

export const SCRIPT = 'scripts/gen/openapi-public.mjs';
export const SOURCE = 'openapi.json';
export const OUT_REL = `${CONTRACT_DIR}/openapi.public.json`;

export const PATH_PREFIX_ALLOWLIST = ['/v1', '/t1', '/healthz', '/readyz'];
export const TAG_BLOCKLIST = ['admin', 'ops', 'webhooks'];
export const TAG_BLACKLIST_EXEMPT_PATHS = ['/healthz', '/readyz'];
export const KEEP_TOP_EXTENSIONS = ['x-tansr-error-codes', 'x-tansr-enums'];
export const PUBLIC_TITLE = 'tansr 平台 REST API(公开面)';
export const PUBLIC_DESCRIPTION =
  'tansr 平台面向开发者的公开 REST 接口:数据面(OpenAI / Anthropic 兼容)、twp 协议面、控制面(认证 / 组织 / 应用 / 配置 / 用量)与健康探针。错误响应统一为 { error: { code, message, requestId, detail? } },错误码见「错误码参考」。';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
/** 公开面不列的方法:CORS 预检(OPTIONS)是浏览器自动发的握手,不是开发者可调用的接口(api 侧为覆盖律必须入册 openapi,资料站 P2 A-L1)。 */
export const METHOD_BLOCKLIST = new Set(['options']);

function pathAllowed(path) {
  return PATH_PREFIX_ALLOWLIST.some((p) => path === p || path.startsWith(p + '/'));
}

function opsOf(item) {
  return Object.entries(item).filter(([m, op]) => METHODS.has(m) && op && typeof op === 'object');
}

function pathBlockedByTag(path, item) {
  if (TAG_BLACKLIST_EXEMPT_PATHS.includes(path)) return false;
  return opsOf(item).some(([, op]) => (op.tags ?? []).some((t) => TAG_BLOCKLIST.includes(t)));
}

function stripOpExtensions(op) {
  const out = {};
  for (const [k, v] of Object.entries(op)) {
    if (k.startsWith('x-tansr-')) continue;
    out[k] = v;
  }
  return out;
}

function collectRefs(value, into) {
  if (Array.isArray(value)) for (const v of value) collectRefs(v, into);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === '$ref' && typeof v === 'string') into.add(v);
      else collectRefs(v, into);
    }
  }
  return into;
}

function opText(op) {
  const texts = [op.summary ?? '', op.description ?? ''];
  for (const p of op.parameters ?? []) texts.push(p.description ?? '');
  texts.push(op.requestBody?.description ?? '');
  for (const r of Object.values(op.responses ?? {})) texts.push(r.description ?? '');
  return texts.join('\n');
}

/** 纯函数:源文档 → 公开子集文档 + 统计。 */
export function filterPublic(source) {
  const paths = {};
  const dropped = { prefix: [], tag: [], method: [] };
  for (const [path, item] of Object.entries(source.paths ?? {})) {
    if (!pathAllowed(path)) {
      dropped.prefix.push(path);
      continue;
    }
    if (pathBlockedByTag(path, item)) {
      dropped.tag.push(path);
      continue;
    }
    const out = {};
    for (const [k, v] of Object.entries(item)) {
      if (METHOD_BLOCKLIST.has(k)) {
        dropped.method.push(`${k.toUpperCase()} ${path}`);
        continue;
      }
      out[k] = METHODS.has(k) ? stripOpExtensions(v) : v;
    }
    if (opsOf(out).length === 0) continue; // 只剩预检的路径整条不出公开面
    paths[path] = out;
  }

  const ops = Object.values(paths).flatMap((item) => opsOf(item).map(([, op]) => op));
  const usedTags = new Set(ops.flatMap((op) => op.tags ?? []));
  const usedSecurity = new Set(ops.flatMap((op) => (op.security ?? []).flatMap((s) => Object.keys(s))));
  for (const s of source.security ?? []) for (const k of Object.keys(s)) usedSecurity.add(k);

  // $ref 闭包:从公开路径出发,直到不再新增
  const schemas = source.components?.schemas ?? {};
  const reachable = new Set();
  const queue = [...collectRefs(paths, new Set())];
  while (queue.length) {
    const ref = queue.shift();
    const m = /^#\/components\/schemas\/(.+)$/.exec(ref);
    if (!m) throw new Error(`不支持的 $ref 形:${ref}`);
    const name = decodeURIComponent(m[1].replace(/~1/g, '/').replace(/~0/g, '~'));
    if (reachable.has(name)) continue;
    if (!(name in schemas)) throw new Error(`悬空引用:${ref}`);
    reachable.add(name);
    for (const r of collectRefs(schemas[name], new Set())) queue.push(r);
  }
  const components = {};
  if (source.components?.securitySchemes) {
    const kept = {};
    for (const [k, v] of Object.entries(source.components.securitySchemes)) if (usedSecurity.has(k)) kept[k] = v;
    if (Object.keys(kept).length) components.securitySchemes = kept;
  }
  {
    const kept = {};
    for (const [k, v] of Object.entries(schemas)) if (reachable.has(k)) kept[k] = v;
    components.schemas = kept;
  }

  const allText = ops.map(opText).join('\n');
  const errorCodes = (source['x-tansr-error-codes'] ?? []).filter((e) => mentionsWord(allText, e.code));

  const out = {};
  for (const [k, v] of Object.entries(source)) {
    if (k === 'info') {
      out.info = { ...v, title: PUBLIC_TITLE, description: PUBLIC_DESCRIPTION };
    } else if (k === 'servers') {
      const servers = (v ?? []).filter((s) => !isPrivateServer(s.url));
      if (servers.length) out.servers = servers;
    } else if (k === 'tags') {
      out.tags = (v ?? []).filter((t) => usedTags.has(t.name));
    } else if (k === 'paths') {
      out.paths = paths;
    } else if (k === 'components') {
      out.components = components;
    } else if (k === 'x-tansr-error-codes') {
      out[k] = errorCodes;
    } else if (k.startsWith('x-')) {
      if (KEEP_TOP_EXTENSIONS.includes(k)) out[k] = v;
    } else {
      out[k] = v;
    }
  }
  sanitizeMarkdownInPlace(out);
  return {
    doc: out,
    stats: {
      paths: Object.keys(paths).length,
      operations: ops.length,
      schemas: reachable.size,
      errorCodes: errorCodes.length,
      tags: out.tags?.length ?? 0,
      droppedByPrefix: dropped.prefix.length,
      droppedByTag: dropped.tag.length,
      droppedByMethod: dropped.method.length,
    },
  };
}

/**
 * 描述文本按 Markdown 渲染(starlight-openapi):api 契约里「无档回 [](未配置=空集)」这类 `[](…)` 形会被解析成
 * 空文本链接 → 站内死链(收编 links 门实证)。只对 `description` / `summary` 字段做一处保守转义:紧跟 `[]` 的 `(` 转为 `\(`,
 * 语义不变、其余 Markdown 照旧。源头改口(api 契约文案)另登敞口;本函数保证公开副本可渲染。
 */
export function sanitizeMarkdownText(text) {
  return text.replace(/\[\]\(/g, '[]\\(');
}
function sanitizeMarkdownInPlace(node) {
  if (Array.isArray(node)) { for (const v of node) sanitizeMarkdownInPlace(v); return; }
  if (node === null || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'description' || k === 'summary') && typeof v === 'string') node[k] = sanitizeMarkdownText(v);
    else sanitizeMarkdownInPlace(v);
  }
}

function isPrivateServer(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return true;
  }
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  );
}

/** 全文 $ref 可解析(无悬空引用);返回悬空列表。 */
export function danglingRefs(doc) {
  const out = [];
  for (const ref of collectRefs(doc, new Set())) {
    const parts = ref.replace(/^#\//, '').split('/').map((s) => decodeURIComponent(s.replace(/~1/g, '/').replace(/~0/g, '~')));
    let cur = doc;
    for (const p of parts) {
      cur = cur && typeof cur === 'object' ? cur[p] : undefined;
    }
    if (cur === undefined) out.push(ref);
  }
  return out;
}

export function generate(root) {
  const source = readContractJson(root, SOURCE);
  const { doc, stats } = filterPublic(source);
  const dangling = danglingRefs(doc);
  if (dangling.length) throw new Error(`公开子集有悬空 $ref:${dangling.join(', ')}`);
  return [{ rel: OUT_REL, content: JSON.stringify(doc, null, 2) + '\n', stats }];
}

if (isMainModule(import.meta.url)) {
  runGenerator({
    generate: (root) => {
      const outputs = generate(root);
      const s = outputs[0].stats;
      console.log(`[gen] openapi.public: paths=${s.paths} operations=${s.operations} schemas=${s.schemas} errorCodes=${s.errorCodes} tags=${s.tags} droppedByPrefix=${s.droppedByPrefix} droppedByTag=${s.droppedByTag}`);
      return outputs;
    },
    SCRIPT,
  });
}
