// @ts-check
import { existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';

/**
 * REST 参考(/api/)来自 vendored 公开子集 `contract/openapi.public.json`。
 * 文件由 `pnpm vendor` + `pnpm gen` 产出;缺席时不挂插件、不加侧栏组,构建照常通过。
 */
const OPENAPI_PUBLIC = 'contract/openapi.public.json';
const hasOpenApi = existsSync(new URL(OPENAPI_PUBLIC, import.meta.url));

/** 11 类信息架构(zh-CN 根;en 标签走 translations),顺序即侧栏顺序 */
const CATEGORIES = [
  { directory: 'getting-started', label: '快速开始', en: 'Getting started' },
  { directory: 'sdk', label: 'TS / Node SDK', en: 'TypeScript SDK' },
  { directory: 'serve', label: '会话服务 @tansr/serve', en: 'Session service (@tansr/serve)' },
  { directory: 'cli', label: 'CLI 手册', en: 'CLI manual' },
  { directory: 'android', label: 'Android SDK', en: 'Android SDK' },
  { directory: 'ios', label: 'iOS SDK', en: 'iOS SDK' },
  { directory: 'api', label: 'REST 参考', en: 'REST reference' },
  { directory: 'errors', label: '错误码与排障', en: 'Errors & troubleshooting' },
  { directory: 'security', label: '安全与隐私', en: 'Security & privacy' },
  { directory: 'releases', label: '发布说明', en: 'Release notes' },
  { directory: 'support', label: '帮助中心', en: 'Help center' },
];

const sidebar = CATEGORIES.flatMap((c) => {
  if (c.directory === 'api' && hasOpenApi) return openAPISidebarGroups;
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
  integrations: [
    starlight({
      title: 'tansr 资料站',
      description: 'tansr 开发者文档与帮助中心:SDK · 会话服务 · CLI · Android / iOS · REST 参考 · 错误码 · 发布说明。',
      defaultLocale: 'root',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
        en: { label: 'English', lang: 'en' },
      },
      sidebar,
      pagefind: true,
      editLink: { baseUrl: 'https://github.com/cpple/tansr-docs/edit/main/' },
      lastUpdated: true,
      customCss: ['./src/styles/custom.css'],
      plugins: hasOpenApi
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
