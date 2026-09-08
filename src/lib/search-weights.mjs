/**
 * 站内搜索权重(资料站 DS-27)——单一事实源:MarkdownContent.astro(给查表页挂 Pagefind 元字段)、astro.config.mjs(`pagefind.ranking.metaWeights`)
 * 与 scripts/check/test/search-rank.test.mjs(三词首位断言)共用。
 *
 * 手段:「查表页行键」作为 Pagefind 元字段 `keys`,并给它高于标题的元权重。理由(实测于 dist/pagefind,Pagefind 1.5.x):
 *   · Starlight 的排序参数(pageLength 0.1 · termFrequency 0.1 · termSaturation 2 · termSimilarity 9)让正文得分趋近 0,
 *     排序几乎只由「查询词命中页面标题」(metaWeights.title = 5)决定——改前:搜 `rate_limited` 首位是标题含 `otp_rate_limited` 的 REST 操作页,
 *     搜 `TANSR_SERVE_TOKEN` 首位是标题「@tansr/serve Changelog」(`tansr` / `serve` 片段命中标题),errors/codes 排第 3、serve/env 排第 58;
 *   · Pagefind 索引正文时把 `_` 连接词拆开(`rate_limited` → `rate` + `limited`),只有标题 / 元字段保留整词;查询侧则保留 `_`
 *     (entry include_characters),整词查不到时才退到拆词——所以 `rate_limited` 改前 136 命中全是 `rate` / `limited` 片段命中;
 *   · 页面级 `data-pagefind-weight`(/api/** 0.3 · /sdk/api/** 0.5 · 查表页 2)实测无效(正文分 ≈ 0,乘零仍是零),不采用;
 *     `excludeSelectors` / pagefind.yml 是 Pagefind CLI 的索引期选项,Starlight 经 Node API 跑索引不读,且排除 /api/** 会让接口名不可搜,不采用;
 *   · 查表页的行键标题(错误码 / serve 环境变量的 h3,CLI 子命令的 h2)写成元字段 `keys`(`data-pagefind-meta="keys:…"`;空元素、不进布局、
 *     不进正文索引),`metaWeights.keys` 取 8 > title 5:搜具体码名 / 变量名 / 子命令名时,查表页的元字段命中压过操作页 / 发布说明页的
 *     标题片段命中;只取行键那一层(env / codes 的 h2 是分组名,如「/v2 轮末 webhook 出站」,取进去会抢走 `webhook` 等泛词);
 *     其余页面与中文按字索引一律不动。
 *   · 代价:整词带 `_` 的查询命中行键后只回查表页一条(正文侧本就没有整词可命中);要看提及该码的接口页可用空格分词搜 `rate limited`。
 */

/** 元字段名与元权重(title 保持 Pagefind 缺省 5;keys 须 > title) */
export const KEYS_META_FIELD = 'keys';
export const META_WEIGHTS = Object.freeze({ title: 5, [KEYS_META_FIELD]: 8 });

/** 挂 `keys` 元字段的查表页(去掉语言前缀与首尾 `/` 的路径)及其行键所在标题层级 */
export const KEY_PAGES = Object.freeze([
  { slug: 'errors/codes', depth: 3, why: '错误码参考:每码一个 h3(h2 是分组名)' },
  { slug: 'serve/env', depth: 3, why: 'serve 环境变量参考:每变量一个 h3(h2 是分组名)' },
  { slug: 'cli/commands', depth: 2, why: 'CLI 命令参考:每子命令一个 h2' },
]);

/** 语言前缀表(与 categories.mjs EXTRA_LOCALES 键同;此处不 import 以免组件侧拉入 node:fs) */
export const LOCALE_PREFIXES = Object.freeze(['en']);

/** `/en/api/operations/x/` → `api/operations/x`;`/` → `` */
export function slugOfPath(pathname) {
  const parts = String(pathname).split('/').filter(Boolean);
  if (parts.length && LOCALE_PREFIXES.includes(parts[0])) parts.shift();
  return parts.join('/');
}

/** 查表页配置(非查表页返回 undefined) */
export function keyPageOf(pathname) {
  const slug = slugOfPath(pathname);
  return KEY_PAGES.find((p) => p.slug === slug);
}

export function isKeyPage(pathname) {
  return keyPageOf(pathname) !== undefined;
}

/**
 * 由页面标题树(Starlight `starlightRoute.headings`:[{ depth, text, slug }])取行键文本:指定层级的标题文字,
 * 去重、去英文逗号(`data-pagefind-meta` 以逗号分隔多字段)、空白折叠。返回 `keys:…` 字面值;无行键返回 undefined。
 */
export function keysMetaValue(headings, depth) {
  const seen = new Set();
  const out = [];
  for (const h of headings ?? []) {
    if (h.depth !== depth) continue;
    const t = String(h.text ?? '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length ? `${KEYS_META_FIELD}:${out.join(' ')}` : undefined;
}
