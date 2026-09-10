/**
 * 多语言覆盖率报告(资料站 DS-19;两口径 DS-29;`pnpm gate` 末尾一步):扫内容目录,打印各语言「已翻译 / 总数」与未翻译 slug 清单。
 * 两口径:主口径以**手写页**(frontmatter `generated !== true` 的根页)为分母,未翻译清单也只列手写页(生成页随契约再生,不逐篇翻译);
 *   第二行打印含生成页的全部根页口径(旧算法)供对照。
 * **只报不红**:恒退出 0(覆盖率是进度不是缺陷);唯一红的情形是内容目录不存在(退出 2,说明跑错了目录)。
 *
 * 用法:node scripts/check/i18n-coverage.mjs [--root <dir>] [--json] [--list]
 *   --list  逐条打印未翻译 slug(缺省只打印数量与前 10 条)
 * 自测卷:scripts/check/test/i18n-coverage.test.mjs
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildCoverage, isHandwritten, OUT_SLUG } from '../gen/i18n-coverage.mjs';
import { DOCS_DIR } from '../gen/lib.mjs';

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') opts.root = resolve(String(argv[++i] ?? '.'));
    else if (arg === '--json') opts.json = true;
    else if (arg === '--list') opts.list = true;
    else throw new Error(`i18n-coverage: unknown argument ${arg}`);
  }
  return opts;
}

function pct(n, d) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

/**
 * 纯函数:覆盖模型 → 报告
 * { locales: { en: { translated, total, pct, missing: string[], all: { translated, total, pct } } }, generated: n, orphans, page }
 *   translated / total / pct / missing = 主口径(手写页);all = 含生成页的全部根页口径(旧算法);generated = 生成页数(只报数量)
 */
export function report(root) {
  const cov = buildCoverage(root);
  const locales = {};
  for (const l of cov.locales) {
    const missing = cov.rows.filter((r) => isHandwritten(r) && r.translated[l] === undefined).map((r) => (r.slug === '' ? '/' : r.slug));
    const translated = cov.summary.byScope.handwritten[l];
    locales[l] = {
      translated,
      total: cov.summary.handwritten,
      pct: pct(translated, cov.summary.handwritten),
      missing,
      all: { translated: cov.summary[l], total: cov.summary.total, pct: pct(cov.summary[l], cov.summary.total) },
    };
  }
  const page = existsSync(join(root, DOCS_DIR, `${OUT_SLUG}.md`));
  return { locales, generated: cov.summary.generated, orphans: cov.orphans.map((o) => o.slug), page };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(join(opts.root, DOCS_DIR))) {
    console.error(`[i18n-coverage] ${DOCS_DIR} not found under ${opts.root}`);
    process.exit(2);
  }
  const r = report(opts.root);
  if (opts.json) {
    console.log(JSON.stringify(r));
  } else {
    for (const [l, v] of Object.entries(r.locales)) {
      console.log(`[i18n-coverage] ${l}: ${v.translated} / ${v.total} (${v.pct}%) handwritten pages translated; ${v.missing.length} fall back to zh-CN`);
      const shown = opts.list ? v.missing : v.missing.slice(0, 10);
      for (const s of shown) console.log(`  - ${s}`);
      if (!opts.list && v.missing.length > shown.length) console.log(`  … ${v.missing.length - shown.length} more (--list)`);
      console.log(`[i18n-coverage] ${l} incl. ${r.generated} generated page(s): ${v.all.translated} / ${v.all.total} (${v.all.pct}%)`);
    }
    if (r.orphans.length) console.log(`[i18n-coverage] orphan translated slugs (no zh-CN page): ${r.orphans.join(', ')}`);
    if (!r.page) console.log(`[i18n-coverage] note: ${OUT_SLUG}.md not generated yet — run pnpm gen`);
  }
  process.exit(0); // 只报不红
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
