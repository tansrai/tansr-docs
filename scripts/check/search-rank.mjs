/**
 * 站内搜索首位核(资料站 DS-27):对 `pnpm build` 产出的 dist/pagefind 索引跑查询,报每词前几位与目标页名次。
 *
 * 为什么不用 `pagefind` npm 包的 Node API:那套 API(createIndex / addDirectory / writeFiles)只管建索引,不提供查询;
 * 查询运行时只有随索引一起产出的 `dist/pagefind/pagefind.js`(浏览器里跑的就是它)。本核把 dist 用本机 http 临时端口托起,
 * 在 Node 里 import 同一份 pagefind.js 查——与浏览器差异只剩两处,均按浏览器形补齐:
 *   · 语言:pagefind.js 读 `<html lang>` 选索引(本站中文页 `zh-CN`,索引 zh-cn;Node 下无 document 会落到 `unknown`),
 *     此处以最小 document 垫片报 `zh-CN`(wasm 胶水层另要求 `document.currentScript === null`);
 *   · 排序参数:Starlight 的 Search 组件把 `pagefind.ranking`(含本仓 astro.config 的 metaWeights)内联进 dist/_astro/Search.astro_*.js,
 *     此处从该产物正则抠出同一份对象喂给 `pagefind.options`,不另抄一份常数。
 *
 * 用法:node scripts/check/search-rank.mjs [--dist <dir>] [--json] [词 …](缺省三词 + 两词守卫)
 *   退出码:0 目标页皆首位;1 有词首位不符;2 dist 缺席(先 pnpm build)。
 * 自测卷:scripts/check/test/search-rank.test.mjs。
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 卡面三词 + 守卫两词:目标页(任一命中即过) */
export const EXPECTATIONS = Object.freeze([
  { term: 'rate_limited', want: ['/errors/codes/'], why: '卡面:错误码整词 → 错误码参考' },
  { term: 'TANSR_SERVE_TOKEN', want: ['/serve/env/'], why: '卡面:serve 环境变量整词 → serve 环境变量参考' },
  { term: 'doctor', want: ['/cli/settings-and-doctor/', '/cli/commands/'], why: '卡面:子命令名 → 设置与 doctor 或 CLI 命令参考' },
  { term: 'unauthorized', want: ['/errors/codes/'], why: '守卫:无下划线的码名同样落到错误码参考(元权重而非整词命中在起作用)' },
  { term: 'webhook', want: ['/serve/v2-and-webhooks/'], why: '守卫:泛词不被查表页分组标题(h2「/v2 轮末 webhook 出站」)抢走' },
]);

/** 本站中文页的 `<html lang>`(pagefind.js 据此选索引) */
export const PAGE_LANG = 'zh-CN';

function parseArgs(argv) {
  const opts = { dist: resolve('dist'), json: false, terms: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dist') opts.dist = resolve(String(argv[++i] ?? 'dist'));
    else if (a === '--json') opts.json = true;
    else if (a.startsWith('--')) throw new Error(`search-rank: unknown argument ${a}`);
    else opts.terms.push(a);
  }
  return opts;
}

/** 从 dist/_astro/Search.astro_*.js 抠 Starlight 内联的 `{ranking:{…}}`(与浏览器同一份);抠不到即抛。 */
export function readInlinedPagefindOptions(dist) {
  const astro = join(dist, '_astro');
  const files = existsSync(astro) ? readdirSync(astro).filter((f) => /^Search\.astro.*\.js$/.test(f)) : [];
  for (const f of files) {
    const src = readFileSync(join(astro, f), 'utf8');
    const at = src.indexOf('{ranking:{');
    if (at < 0) continue;
    let depth = 0;
    for (let i = at; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        const literal = src.slice(at, i + 1);
        return { file: `dist/_astro/${f}`, options: new Function(`return ${literal}`)() };
      }
    }
  }
  throw new Error('dist/_astro/Search.astro_*.js 里找不到 `{ranking:{…}}`;Starlight 产物形变了或 dist 未 build');
}

function serveDist(dist) {
  const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const full = join(dist, ...p.split('/').filter(Boolean));
    if (!existsSync(full) || statSync(full).isDirectory()) {
      res.statusCode = 404;
      res.end();
      return;
    }
    createReadStream(full).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** 只在原失败后取证；入口指纹不代表二次模块或 Node 实际已读取的字节，不重试加载。 */
function runtimeFailure(cause, phase, pagefindJs) {
  const url = pathToFileURL(pagefindJs).href;
  const entryModule = { url: url.slice(0, 768), observation: 'after-failure' };
  if (url.length > 768) entryModule.urlTruncated = true;
  try {
    entryModule.bytes = statSync(pagefindJs).size;
    if (entryModule.bytes <= 1024 * 1024) {
      const bytes = readFileSync(pagefindJs);
      entryModule.bytes = bytes.length;
      entryModule.sha256 = createHash('sha256').update(bytes).digest('hex');
    } else entryModule.hashOmitted = 'over-1-MiB';
  } catch {
    entryModule.readError = 'unavailable';
  }
  const diagnostic = { phase, node: process.version, entryModule };
  return Object.assign(new Error(`[search-rank] ${JSON.stringify(diagnostic)}`, { cause }), {
    code: 'SEARCH_RUNTIME_FAILED', diagnostic,
  });
}

/**
 * 跑查询。返回 { options, results: [{ term, total, top: [{ url, title, score }], want, rankOfWant, ok }] }。
 * `terms` 缺省取 EXPECTATIONS;自定义词无 want 时 ok 恒 true(只看榜)。
 */
export async function searchRank({ dist, terms, topN = 5 } = {}) {
  const pagefindJs = join(dist, 'pagefind', 'pagefind.js');
  if (!existsSync(pagefindJs)) throw Object.assign(new Error(`${pagefindJs} 缺席:先 pnpm build`), { code: 'NO_DIST' });
  const { options } = readInlinedPagefindOptions(dist);
  const expectations = terms?.length ? terms.map((t) => EXPECTATIONS.find((e) => e.term === t) ?? { term: t, want: [] }) : [...EXPECTATIONS];
  const server = await serveDist(dist);
  const hadDocument = 'document' in globalThis;
  const prevDocument = globalThis.document;
  globalThis.document = { currentScript: null, querySelector: () => ({ getAttribute: () => PAGE_LANG }) };
  let pf;
  let phase = 'import';
  try {
    pf = await import(`${pathToFileURL(pagefindJs).href}?t=${Date.now()}`);
    phase = 'options';
    await pf.options({ ...options, basePath: `http://127.0.0.1:${server.address().port}/pagefind/` });
    phase = 'init';
    await pf.init();
    const results = [];
    for (const e of expectations) {
      phase = 'search';
      const r = await pf.search(e.term);
      phase = 'data';
      const all = await Promise.all(r.results.map((x) => x.data()));
      const pathOf = (u) => new URL(u, 'http://x').pathname;
      const top = all.slice(0, topN).map((d, i) => ({ url: pathOf(d.url), title: d.meta?.title ?? '', score: Number(r.results[i].score.toFixed(3)) }));
      const rankOfWant = Object.fromEntries(e.want.map((w) => [w, all.findIndex((d) => pathOf(d.url) === w) + 1 || null]));
      const ok = e.want.length === 0 || (all.length > 0 && e.want.includes(pathOf(all[0].url)));
      results.push({ term: e.term, total: r.results.length, top, want: e.want, rankOfWant, ok });
    }
    return { options, results };
  } catch (cause) {
    throw runtimeFailure(cause, phase, pagefindJs);
  } finally {
    await pf?.destroy?.();
    server.close();
    if (hadDocument) globalThis.document = prevDocument;
    else delete globalThis.document;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let out;
  try {
    out = await searchRank({ dist: opts.dist, terms: opts.terms });
  } catch (e) {
    if (e.code === 'NO_DIST') {
      console.error(`[search-rank] ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
  if (opts.json) {
    console.log(JSON.stringify(out));
  } else {
    console.log(`[search-rank] ranking = ${JSON.stringify(out.options.ranking)}`);
    for (const r of out.results) {
      console.log(`\n${r.term}: ${r.total} 命中${r.want.length ? `;目标 ${r.want.join(' | ')} → ${r.ok ? '首位 ✓' : '首位 ✗'}` : ''}`);
      r.top.forEach((t, i) => console.log(`  ${i + 1}. ${t.url}  score≈${t.score}  ${t.title.slice(0, 40)}`));
      for (const [w, rank] of Object.entries(r.rankOfWant)) if (rank !== 1) console.log(`  → ${w} 排第 ${rank ?? '—(未命中)'}`);
    }
  }
  process.exit(out.results.every((r) => r.ok) ? 0 : 1);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
