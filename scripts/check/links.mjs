/**
 * 站内链接门:读 `dist/**\/*.html`,对每个 `href`:
 *   - 站内(`/…` 或相对路径):目标页须在 dist 里(`/x/` → x/index.html;`/x` → x/index.html 或 x.html;带扩展名 → 同名文件);
 *     带 `#锚点` 时目标 HTML 须含同 id(`id="…"` / `name="…"`);死链 0 才绿。
 *   - 外链(http / https):只警告、不访问网络。
 *   - mailto / tel / javascript / data:不判。
 * 须先 `pnpm build`。
 *
 * 用法:node scripts/check/links.mjs [--dist <dir>] [--json]
 *   退出码:0 死链 0;1 有死链;2 dist 不存在(未构建)。
 * 自测卷:scripts/check/test/links.test.mjs(夹具在临时目录)。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const opts = { dist: resolve(process.cwd(), 'dist'), json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dist') opts.dist = resolve(String(argv[++i] ?? 'dist'));
    else if (arg === '--json') opts.json = true;
    else throw new Error(`links: unknown argument ${arg}`);
  }
  return opts;
}

/** 按目录实际名称列出文件,不依赖宿主文件系统的大小写匹配行为。 */
function listFiles(dist) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(relative(dist, full).split('\\').join('/'));
    }
  };
  walk(dist);
  return out.sort();
}

/** 递归列出 dist 下所有 .html(相对 dist,`/` 分隔) */
export function listHtml(dist) {
  return listFiles(dist).filter((file) => file.toLowerCase().endsWith('.html'));
}

/** 抽取 href 值(单双引号皆可;HTML 实体 &amp; 还原) */
export function extractHrefs(html) {
  const out = [];
  const re = /\shref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push((m[2] ?? m[3] ?? '').replace(/&amp;/g, '&').trim());
  return out;
}

/** 抽取页面里所有可作锚点的 id / name */
export function extractIds(html) {
  const ids = new Set();
  const re = /\s(?:id|name)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const v = m[2] ?? m[3];
    if (v) ids.add(v);
  }
  return ids;
}

/** 页面文件路径(相对 dist)→ 该页 URL 路径(目录形 `/x/`;非 index 的 `/x.html` 原样) */
export function pageUrl(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

export function classifyHref(href) {
  if (href === '' || href.startsWith('#')) return 'anchor';
  if (/^(https?:)?\/\//i.test(href)) return 'external';
  if (/^(mailto|tel|sms|javascript|data|blob):/i.test(href)) return 'skip';
  return 'internal';
}

/** 站内 href(相对当前页 URL)→ { path, hash } */
export function resolveInternal(pageUrlPath, href) {
  const [noHash, hash = ''] = href.split('#');
  const noQuery = noHash.split('?')[0];
  let path;
  if (noQuery === '') path = pageUrlPath;
  else if (noQuery.startsWith('/')) path = noQuery;
  else {
    // posix.resolve 会吞掉尾斜杠;目录形 href 须保留,才能落到 <dir>/index.html
    path = posix.resolve(pageUrlPath.endsWith('/') ? pageUrlPath : posix.dirname(pageUrlPath) + '/', noQuery);
    if (noQuery.endsWith('/') && !path.endsWith('/')) path += '/';
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    /* 非法编码:保留原样,交给存在性判断 */
  }
  let decodedHash = hash;
  try {
    decodedHash = decodeURIComponent(hash);
  } catch {
    /* 同上 */
  }
  return { path, hash: decodedHash };
}

/** URL 路径 → dist 内候选文件(相对 dist) */
export function candidateFiles(path) {
  const p = path.replace(/^\/+/, '');
  if (p === '') return ['index.html'];
  if (p.endsWith('/')) return [`${p}index.html`];
  if (/\.[A-Za-z0-9]+$/.test(p)) return [p];
  return [`${p}/index.html`, `${p}.html`];
}

export function checkDist(dist) {
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    return { ok: false, notBuilt: true, dead: [], external: [], checked: 0, pages: 0 };
  }
  const files = new Set(listFiles(dist));
  const pages = [...files].filter((file) => file.toLowerCase().endsWith('.html'));
  const idCache = new Map();
  const idsOf = (file) => {
    if (!idCache.has(file)) idCache.set(file, extractIds(readFileSync(join(dist, file), 'utf8')));
    return idCache.get(file);
  };
  const dead = [];
  const external = new Set();
  let checked = 0;
  for (const file of pages) {
    const html = readFileSync(join(dist, file), 'utf8');
    const from = pageUrl(file);
    for (const href of extractHrefs(html)) {
      const kind = classifyHref(href);
      if (kind === 'skip') continue;
      if (kind === 'external') {
        external.add(href);
        continue;
      }
      checked += 1;
      if (kind === 'anchor') {
        const id = decodeURIComponent(href.slice(1));
        if (id !== '' && !idsOf(file).has(id)) dead.push({ from, href, reason: `anchor #${id} not found in same page` });
        continue;
      }
      const { path, hash } = resolveInternal(from, href);
      // 即使本机是 Windows,也按 Linux 部署目录的精确大小写验链。
      const target = candidateFiles(path).find((c) => files.has(c));
      if (!target) {
        dead.push({ from, href, reason: `no file for ${path} (tried ${candidateFiles(path).join(', ')})` });
        continue;
      }
      if (hash !== '' && target.endsWith('.html') && !idsOf(target).has(hash)) {
        dead.push({ from, href, reason: `anchor #${hash} not found in ${target}` });
      }
    }
  }
  return { ok: dead.length === 0, notBuilt: false, dead, external: [...external].sort(), checked, pages: pages.length };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkDist(opts.dist);
  if (result.notBuilt) {
    console.error(`[links] dist not found at ${opts.dist} — run \`pnpm build\` first`);
    process.exit(2);
  }
  for (const d of result.dead) console.error(`${d.from} → ${d.href}: ${d.reason}`);
  for (const e of result.external) console.warn(`[links] external (not checked): ${e}`);
  if (opts.json) console.log(JSON.stringify(result));
  else console.log(`[links] ${JSON.stringify({ pages: result.pages, checked: result.checked, dead: result.dead.length, external: result.external.length })}`);
  process.exit(result.ok ? 0 : 1);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
