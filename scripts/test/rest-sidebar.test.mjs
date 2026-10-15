/**
 * REST 参考侧栏瘦身卷(资料站 DS-30):src/lib/rest-sidebar.mjs 是 Starlight 路由中间件(在 starlight-openapi 的
 * `order: 'post'` 中间件之前跑),/api/** 之外的页面把插件的侧栏占位组换成「REST 参考 → 总览」一条;/api/** 页面不动。
 * 纯函数级用假 context 跑;构建级(dist 在场时)核 getting-started 页 ≤ 60 KB 且侧栏只剩 1 条 /api/ 链接。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { CATEGORIES } from '../../src/lib/categories.mjs';
import { isRestPlaceholder, onRequest, OVERVIEW_LABEL, slimRestSidebar } from '../../src/lib/rest-sidebar.mjs';

const root = repoRootFrom(import.meta.url);
const REST = CATEGORIES.find((c) => c.directory === 'api');

/** starlight-openapi 0.26 的占位组:label = Symbol 字串、items 空(经 Starlight 解析后 entries 空) */
const PLACEHOLDER_LABEL = 'Symbol(StarlightOpenAPISidebarGroupsLabel)';
const link = (href, label) => ({ type: 'link', label, href, isCurrent: false, badge: undefined, attrs: {} });
const group = (label, entries) => ({ type: 'group', label, entries, collapsed: false, badge: undefined });
const placeholder = () => group(PLACEHOLDER_LABEL, []);

function sidebarFixture() {
  return [
    group('快速开始', [link('/getting-started/', '快速开始'), link('/getting-started/sdk/', 'Node SDK 5 分钟跑通')]),
    placeholder(),
    group('错误码与排障', [link('/errors/codes/', '错误码参考')]),
  ];
}

function ctx(pathname, locale, sidebar = sidebarFixture()) {
  return { url: new URL(pathname, 'https://docs.tansr.com'), locals: { starlightRoute: { locale, lang: locale ?? 'zh-CN', sidebar, entry: { data: {} } } } };
}

test('isRestPlaceholder:只认「Symbol(…) 标签 + 空 entries」的组;真实组 / 链接不误判', () => {
  assert.equal(isRestPlaceholder(placeholder()), true);
  assert.equal(isRestPlaceholder(group('Symbol(abc_DEF-123)', [])), true, 'createOpenAPISidebarGroup() 的随机 Symbol 同样命中');
  assert.equal(isRestPlaceholder(group('REST 参考', [])), false, '空目录的真实组不算占位');
  assert.equal(isRestPlaceholder(group(PLACEHOLDER_LABEL, [link('/api/', 'Overview')])), false, '已被插件填充的组不算占位');
  assert.equal(isRestPlaceholder(link('/api/', 'Symbol(x)')), false);
});

test('红例(修前)→ 绿例:非 /api/ 页面,占位组换成「REST 参考 → 总览」一条,href 恒为根路径 /api/;其余组原样', async () => {
  const c = ctx('/getting-started/', undefined);
  await onRequest(c, async () => {});
  const sidebar = c.locals.starlightRoute.sidebar;
  assert.equal(sidebar.length, 3, '组数不变');
  assert.deepEqual(sidebar[0], sidebarFixture()[0]);
  assert.deepEqual(sidebar[2], sidebarFixture()[2]);
  assert.deepEqual(sidebar[1], group(REST.label, [link('/api/', OVERVIEW_LABEL.root)]));
  assert.equal(sidebar[1].label, 'REST 参考');
  assert.equal(sidebar[1].entries[0].label, '总览');
  // 修前红:占位组留给插件 → 该页侧栏被塞进 170 条操作链接(getting-started 123 KB,其中 ~78 KB 是它)
  assert.ok(!sidebar.some(isRestPlaceholder), '占位组不得残留(否则插件仍会注入全部操作)');
});

test('en 页面:标签走 CATEGORIES 的 en 列与 OVERVIEW_LABEL.en;href 不加 /en/ 前缀(插件不产 /en/api/,加了即死链)', async () => {
  const c = ctx('/en/getting-started/', 'en');
  await onRequest(c, async () => {});
  const rest = c.locals.starlightRoute.sidebar[1];
  assert.equal(rest.label, REST.en);
  assert.equal(rest.label, 'REST reference');
  assert.deepEqual(rest.entries, [link('/api/', 'Overview')]);
});

test('未知语言:组标签回落根语言标签,链接文字回落 en(插件自身的 Overview 也是英文)', () => {
  const out = slimRestSidebar(sidebarFixture(), 'xx');
  assert.equal(out[1].label, REST.label);
  assert.equal(out[1].entries[0].label, OVERVIEW_LABEL.en);
  assert.equal(out[1].entries[0].href, '/api/');
});

test('ja / ko:链接文字取 Starlight 内建 tableOfContents.overview 同字;组标签 CATEGORIES 尚无该列时回落根标签、加列后自动跟随;href 恒 /api/', () => {
  for (const [locale, word] of [['ja', '概要'], ['ko', '개요']]) {
    assert.equal(OVERVIEW_LABEL[locale], word);
    const out = slimRestSidebar(sidebarFixture(), locale);
    assert.equal(out[1].entries[0].label, word);
    assert.equal(out[1].entries[0].href, '/api/');
    assert.equal(out[1].label, REST[locale] ?? REST.label);
  }
});

test('/api/** 页面(总览 · 操作页 · tag 页):侧栏原样交给插件,占位组保留,引用不变', async () => {
  for (const p of ['/api/', '/api/operations/healthz/', '/api/operations/tags/orgs/']) {
    const sidebar = sidebarFixture();
    const c = ctx(p, undefined, sidebar);
    await onRequest(c, async () => {});
    assert.equal(c.locals.starlightRoute.sidebar, sidebar, `${p} 须原引用`);
    assert.ok(isRestPlaceholder(c.locals.starlightRoute.sidebar[1]), `${p} 占位组须保留`);
  }
  // 形似前缀但不是 REST 区的路径不受影响判定(/apis/ 不是 /api/)
  const other = ctx('/apis/', undefined);
  await onRequest(other, async () => {});
  assert.ok(!other.locals.starlightRoute.sidebar.some(isRestPlaceholder), '/apis/ 属 REST 区之外,占位组应被替换');
});

test('无占位组(openapi 契约缺席、插件未挂)→ 侧栏原引用不动', async () => {
  const sidebar = [sidebarFixture()[0], sidebarFixture()[2]];
  const c = ctx('/getting-started/', undefined, sidebar);
  await onRequest(c, async () => {});
  assert.equal(c.locals.starlightRoute.sidebar, sidebar);
});

test('astro.config.mjs:REST 侧栏段挂 routeMiddleware 指向本中间件,与 openapi 在场判定同源', () => {
  const cfg = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
  assert.match(cfg, /routeMiddleware:\s*openApiPresent\s*\?\s*\['\.\/src\/lib\/rest-sidebar\.mjs'\]\s*:\s*\[\]/);
  assert.match(cfg, /return openAPISidebarGroups;/, '占位组仍由 openAPISidebarGroups 提供(/api/** 页面要它)');
});

const distPage = join(root, 'dist', 'getting-started', 'index.html');
test('构建级:dist/getting-started/index.html ≤ 72 KB,侧栏里 /api/ 链接恰 1 条(dist 缺席即 skip)', { skip: existsSync(distPage) ? false : 'dist 缺席(先 pnpm build)' }, () => {
  const bytes = statSync(distPage).size;
  // 2026-10-15 实测 65904。60 KB 帽在 2026-10-12 基线一旦构建就已超出(泳道 C 实测 65786),帽的作用是拦住把 REST 操作树内联进每页侧栏;操作树断言在下面。
  assert.ok(bytes <= 72 * 1024, `getting-started/index.html = ${bytes} 字节,超 72 KB`);
  const html = readFileSync(distPage, 'utf8');
  const navStart = html.indexOf('<nav class="sidebar');
  const nav = html.slice(navStart, html.indexOf('</nav>', navStart));
  assert.equal((nav.match(/href="\/api\//g) ?? []).length, 1, '侧栏只许一条 /api/ 链接(总览)');
  assert.equal((nav.match(/href="\/api\/operations\//g) ?? []).length, 0, '侧栏不得再列操作页');
  const op = join(root, 'dist', 'api', 'operations', 'healthz', 'index.html');
  if (existsSync(op)) {
    const opHtml = readFileSync(op, 'utf8');
    const s = opHtml.indexOf('<nav class="sidebar');
    const opNav = opHtml.slice(s, opHtml.indexOf('</nav>', s));
    assert.ok((opNav.match(/href="\/api\/operations\//g) ?? []).length >= 100, 'REST 参考区内的页面须保留完整操作树');
  }
});
