// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, EXTRA_LOCALES, OPENAPI_PUBLIC, ROOT_LOCALE, hasOpenApi } from './src/lib/categories.mjs';
import { KINDS as SDK_API_KINDS } from './scripts/gen/sdk-api.mjs';
import { META_WEIGHTS } from './src/lib/search-weights.mjs';

/**
 * REST 参考(/api/)来自 vendored 公开子集 `contract/openapi.public.json`。
 * 文件由 `pnpm vendor` + `pnpm gen` 产出;缺席时不挂插件、不加侧栏组,构建照常通过。
 */
const openApiPresent = hasOpenApi(import.meta.url);

/**
 * 「TS / Node SDK」组:手写指南(与 autogenerate 同序——无 sidebar.order 时按文件名字母序)+「API 参考」子组。
 * API 参考页(`sdk/api/**`,DS-16 由 typedoc 生成,每导出一页)若用 autogenerate 整个 `sdk` 目录,子目录会以目录名
 * `api` / `classes` … 作组名且不可译,故手写页按 slug 明列、生成页按分类目录各自 autogenerate;生成页缺席(未跑 `pnpm gen`)时不加子组,构建照常。
 */
function sdkSidebarItems() {
  const sdkDir = fileURLToPath(new URL('./src/content/docs/sdk/', import.meta.url));
  const guides = readdirSync(sdkDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => `sdk/${f.replace(/\.mdx?$/, '')}`)
    .sort();
  const apiDir = `${sdkDir}api/`;
  if (!existsSync(`${apiDir}index.md`)) return guides;
  const kinds = SDK_API_KINDS.filter((k) => existsSync(`${apiDir}${k.dir}`)).map((k) => ({
    label: k.label,
    translations: { en: k.en },
    collapsed: true,
    items: [{ autogenerate: { directory: `sdk/api/${k.dir}` } }],
  }));
  return [
    ...guides,
    {
      label: 'API 参考',
      translations: { en: 'API reference' },
      collapsed: true,
      items: ['sdk/api', ...kinds],
    },
  ];
}

/** 11 类侧栏组(zh-CN 根;en 标签走 translations),顺序即侧栏顺序 */
const sidebar = CATEGORIES.flatMap((c) => {
  if (c.directory === 'api' && openApiPresent) return openAPISidebarGroups;
  return [
    {
      label: c.label,
      translations: { en: c.en },
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
