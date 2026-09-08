#!/usr/bin/env node
/**
 * 发布说明页生成器(资料站 DS-09)。
 *   contract/changelog/{cli,sdk,serve}.md → src/content/docs/releases/{cli,sdk,serve}.md
 *
 * 正文照抄:CHANGELOG 首行 `# <包名> Changelog` 作为页题进 frontmatter(Starlight 页面的 H1 由 title 渲染,正文再留 H1 会重复),
 * 其余逐字节保留——包括「未发」段与其口径,不改一字。只加 frontmatter(契约 3)与生成头(契约 4)。
 *
 *   node scripts/gen/releases.mjs [--check]
 */
import { join } from 'node:path';
import { isMainModule } from '../lib/text.mjs';
import { DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, readContractText, runGenerator } from './lib.mjs';

export const SCRIPT = 'scripts/gen/releases.mjs';

export const PACKAGES = [
  { id: 'cli', source: 'changelog/cli.md', label: '@tansr/cli' },
  { id: 'sdk', source: 'changelog/sdk.md', label: '@tansr/sdk' },
  { id: 'serve', source: 'changelog/serve.md', label: '@tansr/serve' },
];

export function outRel(id) {
  return join(DOCS_DIR, 'releases', `${id}.md`);
}

/** 拆 H1 与正文;H1 缺席则页题用包名。 */
export function splitChangelog(text) {
  const m = /^# (.+)\n/.exec(text);
  if (!m) return { title: undefined, body: text };
  return { title: m[1].trim(), body: text.slice(m[0].length).replace(/^\n+/, '') };
}

export function countVersionSections(body) {
  return [...body.matchAll(/^## .+$/gm)].length;
}

export function render({ pkg, text, lastVerified }) {
  const { title, body } = splitChangelog(text);
  const sections = countVersionSections(body);
  const out = [];
  out.push(
    frontmatter({
      title: title ?? `${pkg.label} 发布说明`,
      description: `${pkg.label} 的版本变更记录(${sections} 个版本段),逐字取自包内 CHANGELOG。`,
      zone: 'docs',
      category: 'releases',
      sources: [`contract/${pkg.source}`],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, `contract/${pkg.source}`));
  out.push('');
  out.push(body.replace(/\n$/, ''));
  return out.join('\n') + '\n';
}

export function generate(root) {
  return PACKAGES.map((pkg) => {
    const text = readContractText(root, pkg.source);
    const content = render({ pkg, text, lastVerified: lastVerifiedFor(root, pkg.source) });
    return { rel: outRel(pkg.id), content, stats: { sections: countVersionSections(splitChangelog(text).body) } };
  });
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
