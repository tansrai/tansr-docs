// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, EXTRA_LOCALES, OPENAPI_PUBLIC, ROOT_LOCALE, hasOpenApi } from './src/lib/categories.mjs';
import { META_WEIGHTS } from './src/lib/search-weights.mjs';

/**
 * REST 参考(/api/)来自 vendored 公开子集 `contract/openapi.public.json`。
 * 文件由 `pnpm vendor` + `pnpm gen` 产出;缺席时不挂插件、不加侧栏组,构建照常通过。
 */
const openApiPresent = hasOpenApi(import.meta.url);

/**
 * 「TS / Node SDK」组:手写指南(与 autogenerate 同序——无 sidebar.order 时按文件名字母序)+「API 参考」一条(总览)。
 * API 参考成员页(`sdk/api/<kind>/**`,DS-16 由 typedoc 生成,每导出一页,482 页)**不进侧栏**:Starlight 把整个侧栏
 * 渲染进每一页 HTML,482 条 × 1197 页曾把每页撑到 ~200 KB、全站 39 MB → 248 MB(P2 收编实测);成员页由总览页的分类索引、
 * 站内搜索(DS-27 `keys` 元权重)与页内「上一页 / 下一页」到达。生成页缺席(未跑 `pnpm gen`)时不加该条,构建照常。
 * 分类口径(KINDS)只在总览页与生成器里用(scripts/gen/sdk-api.mjs),侧栏不再引用。
 */
function sdkSidebarItems() {
  const sdkDir = fileURLToPath(new URL('./src/content/docs/sdk/', import.meta.url));
  const guides = readdirSync(sdkDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => `sdk/${f.replace(/\.mdx?$/, '')}`)
    .sort();
  const apiDir = `${sdkDir}api/`;
  if (!existsSync(`${apiDir}index.md`)) return guides;
  return [...guides, { slug: 'sdk/api', label: 'API 参考(总览)', translations: { en: 'API reference (overview)', ja: 'API リファレンス（概要）', ko: 'API 참조(개요)' } }];
}

/**
 * 12 类侧栏组(zh-CN 根;en 标签走 translations),顺序即侧栏顺序。
 * 「REST 参考」位放 starlight-openapi 的占位组:插件的路由中间件在 /api/** 页面把它换成完整操作树(总览 + 各 tag 组 + 170 个操作);
 * 其余页面由 src/lib/rest-sidebar.mjs(下方 routeMiddleware,先于插件跑)换成「REST 参考 → 总览」一条——
 * 否则 170 条操作链接(每页 ~78 KB)会渲进全站每一页(getting-started 曾 123 KB,其中六成是它)。
 */
const sidebar = CATEGORIES.flatMap((c) => {
  if (c.directory === 'api' && openApiPresent) return openAPISidebarGroups;
  return [
    {
      label: c.label,
      translations: { en: c.en, ja: c.ja, ko: c.ko },
      items: c.directory === 'sdk' ? sdkSidebarItems() : [{ autogenerate: { directory: c.directory } }],
    },
  ];
});

export default defineConfig({
  site: 'https://docs.tansr.com',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'tansr 资料站',
      description: 'tansr 开发者文档与帮助中心:SDK · 会话服务 · CLI · Android / iOS · REST 参考 · 错误码 · 发布说明。',
      defaultLocale: 'root',
      locales: { root: { ...ROOT_LOCALE }, ...EXTRA_LOCALES },
      sidebar,
      /**
       * 搜索权重(DS-27):排序参数沿 Starlight 缺省(pageLength 0.1 · termFrequency 0.1 · termSaturation 2 · termSimilarity 9),
       * 只加元权重——查表页行键元字段 `keys`(MarkdownContent.astro 挂)8 > 标题 5;理由与实测见 src/lib/search-weights.mjs。
       */
      pagefind: { ranking: { metaWeights: { ...META_WEIGHTS } } },
      editLink: { baseUrl: 'https://github.com/cpple/tansr-docs/edit/main/' },
      lastUpdated: true,
      customCss: ['./src/styles/custom.css'],
      components: {
        Header: './src/components/Header.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        Footer: './src/components/Footer.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
      /**
       * REST 参考侧栏瘦身(DS-30):插件 0.26 的 sidebar 配置(collapsed / label / group / operations.{badges,labels,sort} / tags.sort,
       * 见 node_modules/starlight-openapi/libs/schemas/schema.ts)没有「不列操作」开关,collapsed 只改 <details> 的 open 属性、字节不变;
       * 侧栏手写 link 项会被 Starlight 加 locale 前缀成 /en/api/(插件不产多语言路由,即死链)。故用路由中间件:
       * /api/** 之外把占位组换成「总览」一条(href 恒 /api/),/api/** 内保留完整操作树与上下页。理由与实测见 src/lib/rest-sidebar.mjs。
       */
      routeMiddleware: openApiPresent ? ['./src/lib/rest-sidebar.mjs'] : [],
      plugins: openApiPresent
        ? [
            starlightOpenAPI([
              {
                base: 'api',
                schema: `./${OPENAPI_PUBLIC}`,
                sidebar: { label: 'REST 参考', collapsed: false },
              },
            ]),
          ]
        : [],
    }),
  ],
});
