import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/** 11 类(与 src/lib/categories.mjs 的 directory 一一对应) */
export const CATEGORY_VALUES = [
  'getting-started',
  'sdk',
  'serve',
  'cli',
  'android',
  'ios',
  'api',
  'errors',
  'security',
  'releases',
  'support',
] as const;

export const ZONE_VALUES = ['docs', 'support'] as const;

/** `sources` 形:`contract/<path>` 或 `tansr-cli:<path>` / `tansr-api:<path>` */
export const SOURCE_PATTERN = /^(contract\/[^\s]+|tansr-(cli|api):[^\s]+)$/;

/** 站内 slug:不含前后斜杠、不含协议 / 锚点 / 查询 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;

/**
 * 文章 frontmatter 契约(在 Starlight 原生 title / description 之上):
 * - zone:所属区(开发者文档 / 帮助中心)
 * - category:11 类之一
 * - related:站内 slug(如 `errors/codes`),文章页尾「相关文章」据此渲染;slug 不存在构建期抛
 * - sources:该文引用的事实源(`contract/…` 或 `tansr-cli:…` / `tansr-api:…`),`pnpm frontmatter` 门核存在 / 核形
 * - lastVerified:最近一次对表事实源的日期
 * - generated:生成页 true(由生成脚本产出,不手改)
 */
export const articleSchema = z.object({
  zone: z.enum(ZONE_VALUES),
  category: z.enum(CATEGORY_VALUES),
  related: z.array(z.string().regex(SLUG_PATTERN, 'related 须为站内 slug,如 errors/codes')).optional(),
  sources: z
    .array(z.string().regex(SOURCE_PATTERN, 'sources 须为 contract/<path> 或 tansr-cli:<path> / tansr-api:<path>'))
    .optional(),
  // YAML 里 `lastVerified: 2026-09-08` 会被解析成 Date;`'2026-09-08'`(带引号)是字符串。两形都收,统一为 YYYY-MM-DD 字符串
  lastVerified: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'lastVerified 须为 YYYY-MM-DD'),
    z.date().transform((d) => d.toISOString().slice(0, 10)),
  ]),
  generated: z.boolean().optional(),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: articleSchema }) }),
};
