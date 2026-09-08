/**
 * 构建期把「目录 / slug」解析成站内真实存在的链接:内容尚未落地时不产死链(卡片降级为「即将上线」),
 * 内容合入后自动指向真实页面。只读内容集合与 vendored 文件,不访问网络。
 */
import { sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCollection, type CollectionEntry } from 'astro:content';
import { EXTRA_LOCALES, hasOpenApi } from './categories.mjs';

export type DocEntry = CollectionEntry<'docs'>;

const EXTRA_LOCALE_KEYS = Object.keys(EXTRA_LOCALES);

/** 当前语言下的文章(root 语言 = 不带任何语言前缀;其他语言 = 去前缀后的 id) */
export async function localeEntries(locale: string | undefined): Promise<Array<{ id: string; entry: DocEntry }>> {
  const all = await getCollection('docs');
  const out: Array<{ id: string; entry: DocEntry }> = [];
  for (const entry of all) {
    if (locale) {
      if (entry.id === locale) out.push({ id: '', entry });
      else if (entry.id.startsWith(`${locale}/`)) out.push({ id: entry.id.slice(locale.length + 1), entry });
    } else if (!EXTRA_LOCALE_KEYS.some((k) => entry.id === k || entry.id.startsWith(`${k}/`))) {
      out.push({ id: entry.id, entry });
    }
  }
  return out;
}

export function localePrefix(locale: string | undefined): string {
  return locale ? `/${locale}` : '';
}

/** slug(如 `errors/codes`,不含前后斜杠)→ 站内路径(带尾斜杠);slug 为空 = 首页 */
export function slugToHref(locale: string | undefined, slug: string): string {
  const s = slug.replace(/^\/+|\/+$/g, '');
  return s ? `${localePrefix(locale)}/${s}/` : `${localePrefix(locale)}/`;
}

/**
 * 目录 → 落地链接:目录 index 在场取之;否则取目录下按 id 排序的首篇;都没有返 null。
 * `api` 目录由 starlight-openapi 生成(不在内容集合里),vendored 契约在场即视为存在。
 */
export async function resolveDirectoryHref(locale: string | undefined, directory: string): Promise<string | null> {
  if (directory === 'api' && hasOpenApi(pathToFileURL(process.cwd() + sep))) return slugToHref(locale, 'api');
  const entries = await localeEntries(locale);
  if (entries.some((e) => e.id === directory)) return slugToHref(locale, directory);
  const first = entries
    .filter((e) => e.id.startsWith(`${directory}/`))
    .map((e) => e.id)
    .sort()[0];
  return first ? slugToHref(locale, first) : null;
}

/** 候选 slug 列表 → 只保留真实存在的,返回 { slug, href, title } */
export async function resolveExisting(
  locale: string | undefined,
  slugs: readonly string[],
): Promise<Array<{ slug: string; href: string; title: string }>> {
  const entries = await localeEntries(locale);
  const byId = new Map(entries.map((e) => [e.id, e.entry]));
  const out: Array<{ slug: string; href: string; title: string }> = [];
  for (const slug of slugs) {
    const entry = byId.get(slug);
    if (entry) out.push({ slug, href: slugToHref(locale, slug), title: entry.data.title });
  }
  return out;
}
