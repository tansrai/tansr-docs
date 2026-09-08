import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { CATEGORY_VALUES, DATE_PATTERN, SLUG_PATTERN, SOURCE_PATTERN, ZONE_VALUES } from './lib/contract.mjs';

/**
 * 文章 frontmatter 契约(在 Starlight 原生 title / description 之上):
 * - zone:所属区(开发者文档 / 帮助中心)
 * - category:11 类之一
 * - related:站内 slug(如 `errors/codes`),文章页尾「相关文章」据此渲染;slug 不存在构建期抛
 * - sources:该文引用的事实源(`contract/…` 或 `tansr-cli:` / `tansr-api:` / `tansr-android:` / `tansr-ios:` + 仓内路径),`pnpm frontmatter` 门核存在 / 核形
 * - lastVerified:最近一次对表事实源的日期
 * - generated:生成页 true(由生成脚本产出,不手改)
 * 常量在 src/lib/contract.mjs,与 scripts/check/frontmatter.mjs 同源。
 */
export const articleSchema = z.object({
  zone: z.enum(ZONE_VALUES as unknown as [string, ...string[]]),
  category: z.enum(CATEGORY_VALUES as unknown as [string, ...string[]]),
  related: z.array(z.string().regex(SLUG_PATTERN, 'related 须为站内 slug,如 errors/codes')).optional(),
  sources: z
    .array(z.string().regex(SOURCE_PATTERN, 'sources 须为 contract/<path> 或 tansr-cli: / tansr-api: / tansr-android: / tansr-ios: 前缀 + 仓内路径'))
    .optional(),
  // YAML 里 `lastVerified: 2026-09-08` 会被解析成 Date;`'2026-09-08'`(带引号)是字符串。两形都收,统一为 YYYY-MM-DD 字符串
  lastVerified: z.union([
    z.string().regex(DATE_PATTERN, 'lastVerified 须为 YYYY-MM-DD'),
    z.date().transform((d) => d.toISOString().slice(0, 10)),
  ]),
  generated: z.boolean().optional(),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: articleSchema }) }),
};
