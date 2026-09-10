/**
 * REST 参考侧栏瘦身(Starlight 路由中间件;astro.config.mjs `routeMiddleware` 挂载)。
 *
 * 缘由:starlight-openapi 0.26 把 170 个操作全部渲进**每一页**的侧栏(每页约 78 KB,占 getting-started 123 KB 的六成)。
 * 它的 sidebar 配置(node_modules/starlight-openapi/libs/schemas/schema.ts)只有 collapsed / label / group /
 * operations.{badges,labels,sort} / tags.sort,没有「不列操作 / 只列 tag」的开关;collapsed 只改 <details> 的 open 属性,
 * 条目照渲、字节不变。Starlight 的侧栏 `link` 项又会被自动加 locale 前缀(/en/api/ 不存在,插件不产多语言路由),
 * 所以也不能用一条手写 link 顶替。
 *
 * 做法:插件的中间件以 `order: 'post'` 注册,恒在用户中间件之后跑;它只替换侧栏里自己的占位组(label 为 Symbol 字串、
 * entries 为空)。本中间件在 /api/** 之外的页面先把占位组换成「REST 参考 → 总览」一条(href 恒为根路径 /api/,
 * 与 resolve.ts 里 REST 卡片的口径一致),占位组不在场,插件便不再注入 170 条;/api/** 页面不动,保留完整操作树与上下页。
 *
 * 纯函数 slimRestSidebar / isRestPlaceholder 供卷直接调用(scripts/test/rest-sidebar.test.mjs)。
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { CATEGORIES } from './categories.mjs';

/** @typedef {import('@astrojs/starlight/route-data').StarlightRouteData['sidebar'][number]} SidebarEntry */

const REST = CATEGORIES.find((c) => c.directory === 'api');
if (!REST) throw new Error('categories.mjs 缺 api 类目');

/** REST 参考区根路径(总览页);/api/** 都算区内 */
export const REST_BASE = `/${REST.directory}/`;

/**
 * 「总览」链接文字:根语言 + en / ja / ko(ja / ko 取 Starlight 内建 UI 串 tableOfContents.overview,与站内其他「概要」字样一致);
 * 未列语言回落 en(插件自己的 Overview 链接对所有语言都是英文)。组标签走 CATEGORIES 各语言列,不在此处。
 */
export const OVERVIEW_LABEL = Object.freeze({ root: '总览', en: 'Overview', ja: '概要', ko: '개요' });

/**
 * starlight-openapi 的侧栏占位组:`openAPISidebarGroups` / `createOpenAPISidebarGroup()` 都是
 * `{ label: Symbol(...).toString(), items: [] }`,经 Starlight 解析后为空 entries 的组。不 import 插件(它会把
 * openapi 解析器一并拖进预渲染包),按形识别。
 * @param {SidebarEntry} entry
 */
export function isRestPlaceholder(entry) {
  return entry.type === 'group' && entry.entries.length === 0 && /^Symbol\(.*\)$/.test(entry.label);
}

/**
 * 把侧栏里的占位组换成「REST 参考 → 总览」一条;没有占位组时返回原引用。
 * @param {SidebarEntry[]} sidebar
 * @param {string | undefined} locale 当前语言(根语言为 undefined)
 */
export function slimRestSidebar(sidebar, locale) {
  if (!sidebar.some(isRestPlaceholder)) return sidebar;
  const groupLabel = (locale && /** @type {Record<string, string>} */ (REST)[locale]) || REST.label;
  const linkLabel = (locale ? OVERVIEW_LABEL[/** @type {'en'} */ (locale)] : OVERVIEW_LABEL.root) ?? OVERVIEW_LABEL.en;
  /** @type {SidebarEntry} */
  const slim = {
    type: 'group',
    label: groupLabel,
    collapsed: false,
    badge: undefined,
    entries: [{ type: 'link', label: linkLabel, href: REST_BASE, isCurrent: false, badge: undefined, attrs: {} }],
  };
  return sidebar.map((entry) => (isRestPlaceholder(entry) ? slim : entry));
}

/** 路径是否在 REST 参考区内(/api/ 与 /api/**;/apis/ 不算) */
export function inRestSection(pathname) {
  return pathname === REST_BASE || pathname === REST_BASE.slice(0, -1) || pathname.startsWith(REST_BASE);
}

export const onRequest = defineRouteMiddleware((context) => {
  if (inRestSection(context.url.pathname)) return;
  const { starlightRoute } = context.locals;
  starlightRoute.sidebar = slimRestSidebar(starlightRoute.sidebar, starlightRoute.locale);
});
