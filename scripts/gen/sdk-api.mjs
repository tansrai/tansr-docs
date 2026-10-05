#!/usr/bin/env node
/**
 * SDK API 参考生成器(资料站 DS-16)。
 *   contract/sdk-index.d.ts(`@tansr/sdk` 打包后的类型声明,vendored 副本)
 *     → typedoc + typedoc-plugin-markdown(内存内跑,临时目录)
 *     → src/content/docs/sdk/api/{index,classes/*,interfaces/*,functions/*,type-aliases/*,variables/*}.md
 *
 * · 每个公共导出一页(typedoc-plugin-markdown `outputFileStrategy: members`),外加一页总览 `sdk/api/index.md`;
 *     总页数 = 有独立页的导出数 + 1(再导出别名 Reference 不单独成页,归入总览)。
 * · 输出确定性——不带时间戳 / 版本 / 源码位置(`disableSources` · `disableGit` · `includeVersion:false`),
 *     不含绝对路径(typedoc 只读 `contract/` 一文件),排序取 typedoc 缺省(kind → 实例优先 → 字母序);
 *     链接 `../<dir>/X.md#a` 一律改写为站内绝对 URL `/sdk/api/<dir>/<x 小写>/#a`(见 rewriteLinks),锚点由 `useHTMLAnchors` 显式落 `<a id="api-…">`;
 *     注释里的 `[](…)` 空链接形转义为 `\[\](…)`(与 openapi-public 同律);
 *     frontmatter 契约 3 + 生成头契约 4;导出数与 `sdk-index.d.ts` 尾部 `export { … }` / `export type { … }` 的名字数对表,不等即抛。
 *
 *   node scripts/gen/sdk-api.mjs [--check]
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../lib/text.mjs';
import { contractPath, DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, readContractText, runGenerator, slug } from './lib.mjs';

export const SCRIPT = 'scripts/gen/sdk-api.mjs';
export const SOURCE = 'sdk-index.d.ts';
export const OUT_DIR = join(DOCS_DIR, 'sdk', 'api');
export const PACKAGE_NAME = '@tansr/sdk';
export const ANCHOR_PREFIX = 'api-';

/**
 * d.ts 顶部四个外部 import 的类型骨架(scripts/gen/sdk-api-stubs/*.d.ts),经临时 tsconfig `paths` 钉死:
 * 输出不随 node_modules 里 zod / undici / @types/node 的在场与版本漂移(仓内 zod 是 astro 带来的 4.x,d.ts 按 zod 3 形写,
 * 对着 4.x 解析会把全部 `z.infer<…>` 折成 `any`)。
 */
export const EXTERNAL_STUBS = Object.freeze({
  zod: 'zod.d.ts',
  undici: 'undici.d.ts',
  'node:stream': 'node-stream.d.ts',
  'node:child_process': 'node-child-process.d.ts',
});

export function stubsDir() {
  return fileURLToPath(new URL('./sdk-api-stubs/', import.meta.url));
}

/** typedoc-plugin-markdown 的分类目录 ↔ 侧栏标签(astro.config.mjs 与本生成器共用;顺序即侧栏顺序)。 */
export const KINDS = Object.freeze([
  { dir: 'classes', label: '类', en: 'Classes' },
  { dir: 'interfaces', label: '接口', en: 'Interfaces' },
  { dir: 'functions', label: '函数', en: 'Functions' },
  { dir: 'type-aliases', label: '类型别名', en: 'Type aliases' },
  { dir: 'variables', label: '变量', en: 'Variables' },
  { dir: 'enumerations', label: '枚举', en: 'Enumerations' },
]);

/**
 * 数 `sdk-index.d.ts` 的公共导出:打包后的 d.ts 只在尾部有 `export { A, B }`(值)与 `export type { X, Y }`(类型)两行。
 * 返回 { values, types, total }。
 */
export function countExports(dts) {
  let values = 0;
  let types = 0;
  for (const m of dts.matchAll(/^export (type )?\{([^}]*)\};?\s*$/gm)) {
    const names = m[2].split(',').map((s) => s.trim()).filter(Boolean);
    if (m[1]) types += names.length;
    else values += names.length;
  }
  return { values, types, total: values + types };
}

function toPosix(p) {
  return p.split('\\').join('/');
}

/** typedoc 选项(与插件选项同表);entryPoints 用 posix 形(typedoc 的 glob 不认反斜杠)。 */
export function typedocOptions({ entry, tsconfig, out }) {
  return {
    name: PACKAGE_NAME,
    entryPoints: [toPosix(entry)],
    tsconfig,
    out,
    plugin: ['typedoc-plugin-markdown'],
    lang: 'zh',
    logLevel: 'Error',
    skipErrorChecking: true,
    readme: 'none',
    disableSources: true,
    disableGit: true,
    githubPages: false,
    includeVersion: false,
    excludeExternals: true,
    // typedoc-plugin-markdown
    outputFileStrategy: 'members',
    entryFileName: 'index',
    hidePageHeader: true,
    hideBreadcrumbs: true,
    hidePageTitle: true,
    useCodeBlocks: true,
    expandObjects: true,
    sanitizeComments: true,
    useHTMLAnchors: true,
    anchorPrefix: ANCHOR_PREFIX,
  };
}

function compilerOptions() {
  return {
    target: 'es2022',
    lib: ['es2022'],
    module: 'esnext',
    moduleResolution: 'bundler',
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
    paths: Object.fromEntries(Object.entries(EXTERNAL_STUBS).map(([mod, file]) => [mod, [toPosix(join(stubsDir(), file))]])),
  };
}

/**
 * 预处理:把 `type X = z.infer<typeof XSchema>;` 形的别名(含 NonNullable 包裹、多个 z.infer 的联合)改写为 TypeScript 求出的真实结构文本。
 * 缘由:`z.infer` 是索引访问(`T['_output']`),TS 不给这种结果挂别名符号,typedoc 遇到引用处就整段内联(`AgentSession.events`
 * 曾被展成 1600 行的事件联合);改成字面结构后别名符号可挂,引用处保留 `KernelEvent` 名字并链到别名页,别名页则显示真实结构。
 * 泛型别名同法(tansr-cli@01204b14 起出现,如 `PlatformNonchatTask<Result> = Omit<z.infer<typeof NonchatTaskSchema>, 'result'> & {…}`):
 * 求值在别名自身作用域内进行,类型参数名原样保留。但 z.infer 的实参依赖类型参数时(如 `(typeof NONCHAT_INPUT_SCHEMAS)[Operation]`)
 * 求出的只是整张 zod 模式表的索引访问(满篇 `z.ZodObject<…>` / `["_output"]`),没有用户可读结构——这类别名**原样保留**(页面仍显示
 * d.ts 原文的 `z.infer<…>`),名字记入 `unresolved` 供测试点名登记,不抛。
 * 返回 { text, rewritten, unresolved }。
 */
export const ZOD_INTERNALS_PATTERN = /\bz\.Zod|\[["']_output["']\]/;

export async function resolveInferAliases(entryPosix, tsconfigPath) {
  const ts = (await import('typescript')).default;
  const cfg = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (cfg.error) throw new Error(`tsconfig 读取失败:${ts.flattenDiagnosticMessageText(cfg.error.messageText, '\n')}`);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, toPosix(join(tsconfigPath, '..')));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entryPosix);
  if (!sf) throw new Error(`typescript 未装载 ${entryPosix}`);
  const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  const edits = [];
  const unresolved = [];
  for (const st of sf.statements) {
    if (!ts.isTypeAliasDeclaration(st)) continue;
    if (!/\bz\.infer</.test(st.type.getText(sf))) continue;
    const type = checker.getTypeAtLocation(st.name);
    const text = checker.typeToString(type, st, flags);
    if (text === 'any' || text.includes('...')) throw new Error(`${st.name.text} 的 z.infer 结构无法求出(${text.slice(0, 80)});stub 需补`);
    if (ZOD_INTERNALS_PATTERN.test(text)) {
      unresolved.push(st.name.text); // 实参依赖类型参数:求值得到的是 zod 模式表而非结构,原样保留
      continue;
    }
    edits.push({ start: st.type.getStart(sf), end: st.type.getEnd(), text });
  }
  let text = sf.getFullText();
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return { text, rewritten: edits.length, unresolved };
}

/**
 * 跑 typedoc 到临时目录,返回 { files: Map<posixRel, markdown>, reflections: { total, byKind }, rewritten }。
 * 只读 contract/sdk-index.d.ts;临时 tsconfig 指向它(skipLibCheck;不 emit;外部 import 钉 stubs)。
 */
export async function runTypedoc(root) {
  const { Application, ReflectionKind } = await import('typedoc');
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-sdk-api-'));
  try {
    const source = toPosix(contractPath(root, SOURCE));
    const tsconfig = join(tmp, 'tsconfig.json');
    const out = join(tmp, 'out');
    writeFileSync(tsconfig, JSON.stringify({ compilerOptions: compilerOptions(), files: [source] }, null, 2));
    const pre = await resolveInferAliases(source, tsconfig);
    const entry = join(tmp, 'index.d.ts');
    writeFileSync(entry, pre.text, 'utf8');
    writeFileSync(tsconfig, JSON.stringify({ compilerOptions: compilerOptions(), files: [toPosix(entry)] }, null, 2));
    const app = await Application.bootstrapWithPlugins(typedocOptions({ entry, tsconfig, out }));
    const project = await app.convert();
    if (!project) throw new Error('typedoc 转换失败(contract/sdk-index.d.ts 不可解析)');
    const byKind = {};
    for (const c of project.children ?? []) {
      const k = ReflectionKind[c.kind];
      byKind[k] = (byKind[k] ?? 0) + 1;
    }
    await app.generateOutputs(project);
    const files = new Map();
    const walk = (dir) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.md')) files.set(toPosix(relative(out, full)), readFileSync(full, 'utf8'));
      }
    };
    walk(out);
    return { files, reflections: { total: project.children?.length ?? 0, byKind }, rewritten: pre.rewritten, unresolved: pre.unresolved };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** 站内 URL 前缀(Starlight 把文件名 slug 化为小写;`trailingSlash: 'always'`)。 */
export const URL_BASE = '/sdk/api/';

/**
 * typedoc 产出的相对链接 `](../interfaces/Foo.md#a)` → 站内绝对 URL `](/sdk/api/interfaces/foo/#a)`。
 * 不能保留相对形:Starlight 页面 URL 是目录形(`/sdk/api/classes/x/`),相对链接会以该目录为基解析而落错层;
 * 且 Astro 内容 slug 一律小写:文件名 `AgentSession.md` 的页面在 `/sdk/api/classes/agentsession/`。
 * 外链与纯锚点链不动。`pageRel` = 该页在 typedoc 输出根下的相对路径(`index.md` / `classes/X.md`)。
 */
export function rewriteLinks(md, pageRel) {
  const baseDir = posix.dirname(pageRel);
  return md.replace(/\]\(([^)\s]+?)\.md(#[^)\s]*)?\)/g, (m, path, hash) => {
    if (/^[a-z]+:/i.test(path)) return m;
    const target = posix.normalize(posix.join(baseDir, path));
    // 插件对「继承于 / 重写了」链接不加 anchorPrefix(如 `#constructor`),而成员锚只以 `<a id="api-…">` 落页;统一补前缀
    const anchor = hash ? (hash.startsWith(`#${ANCHOR_PREFIX}`) ? hash : `#${ANCHOR_PREFIX}${hash.slice(1)}`) : '';
    if (target === 'index' || target === '.') return `](${URL_BASE}${anchor})`;
    const dir = posix.dirname(target);
    const name = posix.basename(target);
    return `](${URL_BASE}${dir}/${slug(name)}/${anchor})`;
  });
}

/**
 * 注释里的 `[](…)` 空链接形(源码里当「空数组」写)在 Markdown 中会成链接且目标是中文文字 → 死链;
 * 逐字转义为 `\[\](…)`(与 openapi-public 生成器同律),围栏代码块内不动。
 */
export function escapeEmptyLinks(md) {
  let inFence = false;
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : line.replace(/(^|[^\\])\[\]\(/g, '$1\\[\\](');
    })
    .join('\n');
}

function kindOf(rel) {
  const dir = posix.dirname(rel);
  return KINDS.find((k) => k.dir === dir);
}

function symbolName(rel) {
  return posix.basename(rel, '.md');
}

/** 把一页 typedoc markdown 整理成资料站文章(frontmatter + 生成头 + 正文)。 */
export function transformPage({ rel, markdown, lastVerified, stats }) {
  const body = escapeEmptyLinks(rewriteLinks(markdown, rel)).replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
  const out = [];
  if (rel === 'index.md') {
    out.push(
      frontmatter({
        title: 'API 参考总览',
        description: `${PACKAGE_NAME} 全部公共导出(${stats.total} 项:值 ${stats.values} · 类型 ${stats.types})按类 / 接口 / 函数 / 类型别名 / 变量分类索引,由包内类型声明自动生成。`,
        zone: 'docs',
        category: 'sdk',
        related: ['sdk/sessions-and-events', 'sdk/errors-and-retries', 'getting-started/sdk'],
        sources: [`contract/${SOURCE}`],
        lastVerified,
        generated: true,
      }),
    );
    out.push(generatedHeader(SCRIPT, `contract/${SOURCE}`));
    out.push('');
    out.push(
      `本参考由 \`${PACKAGE_NAME}\` 发布包内的类型声明(\`index.d.ts\`)自动生成,逐项列出全部 **${stats.total}** 个公共导出(值 ${stats.values} · 类型 ${stats.types}):`,
    );
    out.push(...KINDS.filter((k) => stats.byDir[k.dir]).map((k) => `- ${k.label}:${stats.byDir[k.dir]} 页`));
    out.push('');
    out.push(
      '每个导出一页,签名与说明取自源码注释;概念与用法请先读手写指南 [会话与事件流](../sessions-and-events/)、[错误处理与重试](../errors-and-retries/) 与 [快速开始 · SDK](../../getting-started/sdk/)。',
    );
    out.push('');
    out.push(body);
    return { rel: join(OUT_DIR, 'index.md'), content: out.join('\n') + '\n' };
  }
  const kind = kindOf(rel);
  if (!kind) throw new Error(`typedoc 产出了未登记分类目录的页面:${rel}(KINDS 表需补)`);
  const name = symbolName(rel);
  out.push(
    frontmatter({
      title: name,
      description: `${PACKAGE_NAME} 公共导出 · ${kind.label} ${name};签名与说明取自包内类型声明,自动生成。`,
      zone: 'docs',
      category: 'sdk',
      sources: [`contract/${SOURCE}`],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, `contract/${SOURCE}`));
  out.push('');
  out.push(body);
  return { rel: join(OUT_DIR, ...rel.split('/')), content: out.join('\n') + '\n' };
}

export async function generate(root) {
  const dts = readContractText(root, SOURCE);
  const counted = countExports(dts);
  const { files, reflections, rewritten, unresolved } = await runTypedoc(root);
  if (reflections.total !== counted.total) {
    throw new Error(`导出数不对表:sdk-index.d.ts 尾部 export 名字 ${counted.total},typedoc 顶层反射 ${reflections.total}(${JSON.stringify(reflections.byKind)})`);
  }
  const byDir = {};
  for (const rel of files.keys()) {
    if (rel === 'index.md') continue;
    const dir = posix.dirname(rel);
    byDir[dir] = (byDir[dir] ?? 0) + 1;
  }
  const stats = { ...counted, byDir, pages: files.size, reflections: reflections.byKind, inferAliasesResolved: rewritten, inferAliasesUnresolved: unresolved };
  const lastVerified = lastVerifiedFor(root, SOURCE);
  const outputs = [];
  for (const [rel, markdown] of [...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const page = transformPage({ rel, markdown, lastVerified, stats });
    if (rel === 'index.md') page.stats = stats;
    outputs.push(page);
  }
  return outputs;
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
