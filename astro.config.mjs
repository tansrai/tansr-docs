// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { CATEGORIES, EXTRA_LOCALES, OPENAPI_PUBLIC, ROOT_LOCALE, hasOpenApi } from './src/lib/categories.mjs';

/**
 * REST 参考(/api/)来自 vendored 公开子集 `contract/openapi.public.json`。
 * 文件由 `pnpm vendor` + `pnpm gen` 产出;缺席时不挂插件、不加侧栏组,构建照常通过。
 */
const openApiPresent = hasOpenApi(import.meta.url);

/** 11 类侧栏组(zh-CN 根;en 标签走 translations),顺序即侧栏顺序 */
const sidebar = CATEGORIES.flatMap((c) => {
  if (c.directory === 'api' && openApiPresent) return openAPISidebarGroups;
  return [
    {
      label: c.label,
      translations: { en: c.en },
      items: [{ autogenerate: { directory: c.directory } }],
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
      pagefind: true,
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
