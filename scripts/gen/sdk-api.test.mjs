import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { KINDS, OUT_DIR, SCRIPT, SOURCE, countExports, escapeEmptyLinks, generate, rewriteLinks, transformPage } from './sdk-api.mjs';

const root = repoRootFrom(import.meta.url);
const vendored = JSON.parse(readFileSync(join(root, 'contract', 'vendored.json'), 'utf8'));
const dts = readFileSync(join(root, 'contract', SOURCE), 'utf8');

/**
 * 导出数卷锁:与 sdk-index.d.ts 尾部 export 行对表(INJ 在 ARC-01 的 499 上新增 7 个 SessionInput 类型 = 506;
 * tansr-cli@c5219e02 再 vendor(sdk 0.14.0 候选)新增 5 值 + 14 类型 = 525:值 AppConfigRequestError / applicationPromptFailureMessage /
 * countSpeechCharacters / describeApplicationPromptFailure / planSpeechInput;类型 ApplicationPromptFailure(+Reason / Retry)/ ContextBudgetState /
 * ModelTransitionBackup / SendBlocksResult / SessionBudgetOptions / SessionContextState / SessionModelState / SessionUserBlock /
 * SpeechInputPlan(+Result)/ SwitchModelOptions / SwitchModelResult;零删除);
 * tansr-cli@76e3c0df 再 vendor(sdk 0.16.0 已发)新增 1 值 + 2 类型 = 528:值 SESSION_RECOVERY_VERSION;类型 SessionRecoveryPolicy /
 * SessionRecoveryReport(0.15.0 文件存储有界容错读取);零删除;
 * tansr-cli@01204b14 再 vendor(2026-10-05;sdk 0.18.1 已发 + 其后 main 上未发布加法)新增 13 值 + 40 类型 = 581,零删除:
 *   - 已发(sdk 0.18.0,2026-10-02)4 类型:AppBundleAdapterDiagnosticStatus / AppBundleRequestAdapterDiagnostic /
 *     AppBundleBillingAdapterDiagnostic / AppBundleModelAdapterDiagnostics(0.17.0 → 0.18.0 根入口 528 → 532;0.18.1 零差量);
 *   - 未发布(0.18.1 之后,尚无版本号)13 值 + 36 类型:非对话操作客户端 createPlatformNonchatClient / PlatformNonchatError /
 *     NONCHAT_PROTOCOL / NONCHAT_OPERATION_PATHS 及 Nonchat* / Document* / Music* / Voice* / Embeddings* / Rerank* / PlatformVideoInput /
 *     PlatformOperationModel 类型与 *Schema 值,实时会话 REALTIME_SUBPROTOCOL / Realtime* 类型,配额 AppQuota / AppQuotaSchema。
 *     资料站按事实源法照常生成这些页;发行说明不把它们记作 0.18.1 已发特性。
 */
export const EXPECTED_EXPORTS = 581;
export const EXPECTED_EXPORT_SPLIT = { values: 212, types: 369 };

function fm(content) {
  const lines = content.split('\n');
  assert.equal(lines[0], '---');
  const end = lines.indexOf('---', 1);
  return { fields: lines.slice(1, end), afterLine: lines[end + 1], body: lines.slice(end + 2).join('\n') };
}

test('sdk-api:countExports 数 export { } / export type { } 两行的名字数 = 581(值212 · 类型369)', () => {
  const c = countExports(dts);
  assert.deepEqual(c, { ...EXPECTED_EXPORT_SPLIT, total: EXPECTED_EXPORTS });
  const valueExports = dts.match(/^export \{ ([^}]+) \};$/m)?.[1].split(',').map((name) => name.trim());
  assert.ok(valueExports?.includes('SESSION_RECOVERY_VERSION'), 'sdk 0.15.0 起导出 SESSION_RECOVERY_VERSION');
  const typeExports = dts.match(/^export type \{ ([^}]+) \};$/m)?.[1].split(',').map((name) => name.trim());
  assert.ok(typeExports, '须保留独立的类型导出行');
  for (const name of ['AppBundleAdapterDiagnosticStatus', 'AppBundleRequestAdapterDiagnostic', 'AppBundleBillingAdapterDiagnostic', 'AppBundleModelAdapterDiagnostics']) {
    assert.ok(typeExports.includes(name), `sdk 0.18.0 起导出 ${name}`);
  }
  assert.deepEqual(typeExports.filter((name) => name.startsWith('SessionInput')).sort(), [
    'SessionInputCapabilities', 'SessionInputContent', 'SessionInputReceipt', 'SessionInputRejectCode',
    'SessionInputResult', 'SessionInputSubmission', 'SessionInputTarget',
  ], 'INJ 仅新增这7个宿主输入类型;不以提高总数代替逐项登记');
  assert.deepEqual(countExports('export { A, B };\nexport type { C };\n'), { values: 2, types: 1, total: 3 });
  assert.deepEqual(countExports('declare const x: 1;\n'), { values: 0, types: 0, total: 0 });
});

test('sdk-api:rewriteLinks 把 .md 相对链接改为站内绝对小写 URL(Starlight slug 小写 + 目录形),外链与纯锚点不动;[](…) 空链接转义', () => {
  assert.equal(rewriteLinks('[A](../interfaces/Foo.md) [B](Bar.md#api-x)', 'classes/TansrSdkError.md'), '[A](/sdk/api/interfaces/foo/) [B](/sdk/api/classes/bar/#api-x)');
  assert.equal(rewriteLinks('[C](https://example.com/a.md) [D](#api-y) [E](classes/Q.md) [F](variables/APP_PLATFORMS.md)', 'index.md'), '[C](https://example.com/a.md) [D](#api-y) [E](/sdk/api/classes/q/) [F](/sdk/api/variables/app_platforms/)');
  assert.equal(rewriteLinks('[I](../index.md)', 'functions/f.md'), '[I](/sdk/api/)');
  assert.equal(rewriteLinks('[G](TansrSdkError.md#constructor)', 'classes/P.md'), '[G](/sdk/api/classes/tansrsdkerror/#api-constructor)', '无前缀锚点补 api-');
  assert.equal(escapeEmptyLinks('返回 [](空集);\n```ts\nconst a = [](x);\n```\n再 [](x) 与 [有字](y)'), '返回 \\[\\](空集);\n```ts\nconst a = [](x);\n```\n再 \\[\\](x) 与 [有字](y)');
});

test('sdk-api:transformPage 对未登记分类目录抛;index 与成员页 frontmatter 契约 + 生成头', () => {
  const stats = { values: 1, types: 0, total: 1, byDir: { classes: 1 } };
  assert.throws(() => transformPage({ rel: 'widgets/X.md', markdown: '', lastVerified: '2026-01-01', stats }), /未登记分类目录/);
  const page = transformPage({ rel: 'classes/X.md', markdown: '\n\n## 属性\n\ntext\n\n', lastVerified: '2026-01-01', stats });
  assert.equal(page.rel, join(OUT_DIR, 'classes', 'X.md'));
  const { fields, afterLine, body } = fm(page.content);
  assert.ok(fields.includes("title: 'X'"));
  assert.ok(fields.includes("category: 'sdk'"));
  assert.ok(fields.includes(`sources: ['contract/${SOURCE}']`));
  assert.ok(fields.includes("lastVerified: '2026-01-01'"));
  assert.ok(fields.includes('generated: true'));
  assert.equal(afterLine, `<!-- generated by ${SCRIPT} from contract/${SOURCE}; do not edit -->`);
  assert.equal(body, '\n## 属性\n\ntext\n');
});

test('sdk-api:generate → 每导出一页 + 总览;页数 = 有独立页导出 + 1;frontmatter 契约逐页;无 .md 链接 / 无绝对路径;在库零 diff;二次生成逐字节相同', async () => {
  const outputs = await generate(root);
  const index = outputs.find((o) => o.rel === join(OUT_DIR, 'index.md'));
  assert.ok(index, '须有总览页');
  assert.equal(index.stats.total, EXPECTED_EXPORTS);
  const memberPages = outputs.filter((o) => o !== index);
  const byDirSum = Object.values(index.stats.byDir).reduce((a, b) => a + b, 0);
  assert.equal(memberPages.length, byDirSum);
  assert.equal(outputs.length, byDirSum + 1);
  assert.equal(index.stats.reflections.Reference ?? 0, EXPECTED_EXPORTS - byDirSum, '不单独成页的只能是再导出别名(Reference)');
  assert.ok(outputs.length <= 600, `页数 ${outputs.length} 超 600,须改合页形(派单 DS-16 页数控制)`);
  for (const k of Object.keys(index.stats.byDir)) assert.ok(KINDS.some((x) => x.dir === k), `分类目录 ${k} 须在 KINDS 表`);
  const rels = outputs.map((o) => o.rel);
  assert.equal(new Set(rels).size, rels.length, '页面路径唯一');
  for (const o of outputs) {
    const { fields, afterLine, body } = fm(o.content);
    assert.ok(fields.some((l) => l.startsWith("title: '")), o.rel);
    assert.ok(fields.some((l) => l.startsWith("description: '")), o.rel);
    assert.ok(fields.includes("zone: 'docs'") && fields.includes("category: 'sdk'"), o.rel);
    assert.ok(fields.includes(`sources: ['contract/${SOURCE}']`), o.rel);
    assert.ok(fields.includes(`lastVerified: '${vendored[SOURCE].vendoredAt}'`), o.rel);
    assert.ok(fields.includes('generated: true'), o.rel);
    assert.equal(afterLine, `<!-- generated by ${SCRIPT} from contract/${SOURCE}; do not edit -->`, o.rel);
    assert.doesNotMatch(body, /\]\([^)]*\.md[)#]/, `${o.rel} 仍有 .md 链接`);
    assert.doesNotMatch(o.content, /\b[A-Za-z]:\\|\/Users\/|\/home\/|node_modules|tansr-docs-sdk-api-|worktrees[\\/]/, `${o.rel} 含绝对路径 / 临时目录`);
    assert.doesNotMatch(o.content, /^# /m, `${o.rel} 不应再有 H1(title 归 frontmatter)`);
    assert.ok(o.content.endsWith('\n') && !o.content.includes('\r'), `${o.rel} LF 末行换行`);
    assert.ok(existsSync(join(root, o.rel)), `${o.rel} 须已生成并提交`);
    assert.equal(readFileSync(join(root, o.rel), 'utf8'), o.content, `${o.rel} 在库与再生有差`);
  }
  const again = await generate(root);
  assert.deepEqual(again.map((o) => [o.rel, o.content]), outputs.map((o) => [o.rel, o.content]), '二次生成须逐字节相同(确定性)');
});

/**
 * z.infer 残留点名登记(与生成器 `inferAliasesUnresolved` 严格相等,按 d.ts 出现序;任一侧漂移即红):求值结果泄出 zod 内部结构
 *(`z.Zod…` / `["_output"]`,见 ZOD_INTERNALS_PATTERN)的别名不改写、原样保留 d.ts 原文。
 *   - SegmentManifest(非导出;只被同样非导出的 StoreInput / LoadResult 引用,任何页面都不渲染):`z.infer<typeof SegmentManifestSchema>`
 *     经 zod stub 求值得到 `z.flatten<z.addQuestionMarks<z.baseObjectOutputType<…>>>`(stub 不展开该形)。tansr-cli@76e3c0df 时即如此,
 *     旧生成器把这段 zod 内部文本写回了别名(不可见),现改为原样保留;页面零变化。
 *   - NonchatInput(导出;tansr-cli@01204b14,0.18.1 之后未发布加法):泛型别名 `z.infer<(typeof NONCHAT_INPUT_SCHEMAS)[Operation]>`
 *     的实参依赖类型参数,求值只得整张模式表的索引访问,无用户可读结构;页面显示 d.ts 原文。
 */
export const INFER_RESIDUE_ALLOWLIST = Object.freeze({
  SegmentManifest: { exported: false, original: 'z.infer<typeof SegmentManifestSchema>' },
  // 页面显示的是 typedoc 的打印形(索引访问不加括号);d.ts 原文为 `z.infer<(typeof NONCHAT_INPUT_SCHEMAS)[Operation]>`
  NonchatInput: { exported: true, original: 'z.infer<typeof NONCHAT_INPUT_SCHEMAS[Operation]>' },
});

test('sdk-api:z.infer 别名预处理 → 74 条别名求出真实结构(含泛型 1 条)、2 条点名登记原样保留;引用处保留别名名字;别名页显示结构;全站无 z.infer 残留(登记页除外)/ 无 : any 折塌', async () => {
  const outputs = await generate(root);
  const index = outputs.find((o) => o.rel === join(OUT_DIR, 'index.md'));
  // 53 → 74(tansr-cli@01204b14):69 条 `type X = z.infer<typeof XSchema>`(原 51;新增 19 条非对话操作面别名,SegmentManifest 改计入
  // 原样保留)+ 2 条 NonNullable<z.infer<…>>(不变)+ 2 条由多个 z.infer 组成的联合别名 DocumentOperationInput / MusicOperationInput
  // + 1 条泛型别名 PlatformNonchatTask<Result>(实参 typeof NonchatTaskSchema 不依赖类型参数,可求出结构;皆为 0.18.1 之后未发布加法)。
  assert.equal(index.stats.inferAliasesResolved, 74, '69 条 `type X = z.infer<typeof XSchema>` + 2 条 NonNullable<z.infer<…>> + 2 条 z.infer 联合别名 + 1 条泛型别名');
  assert.deepEqual(index.stats.inferAliasesUnresolved, Object.keys(INFER_RESIDUE_ALLOWLIST), '原样保留的别名须与点名登记严格相等(按 d.ts 出现序)');
  const nonchatTask = outputs.find((o) => o.rel === join(OUT_DIR, 'type-aliases', 'PlatformNonchatTask.md'));
  assert.match(nonchatTask.content, /type PlatformNonchatTask<Result> = Omit<\{\n\s+\w+/, '泛型别名的 z.infer 求出结构(typedoc 按键名排序显示)、类型参数名保留');
  assert.match(nonchatTask.content, /\n\s+taskId: string;\n/, 'PlatformNonchatTask 结构须含 taskId');
  assert.match(nonchatTask.content, /\}, "result"> & \{\n\s+result\?: Result;\n\}/, '泛型参数 Result 在交叉段原样保留');
  const exportedNames = new Set([...dts.matchAll(/^export (?:type )?\{ ([^}]+) \};$/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim())));
  for (const [name, { exported, original }] of Object.entries(INFER_RESIDUE_ALLOWLIST)) {
    assert.equal(exportedNames.has(name), exported, `${name} 的导出状态须与登记一致`);
    const page = outputs.find((o) => o.rel === join(OUT_DIR, 'type-aliases', `${name}.md`));
    if (!exported) {
      assert.equal(page, undefined, `${name} 非导出,不应成页`);
      continue;
    }
    assert.ok(page, `登记的残留别名 ${name} 须有页`);
    assert.ok(page.content.includes(original), `${name} 页须原样显示 d.ts 原文 ${original}`);
    assert.doesNotMatch(page.content, /z\.Zod|_output/, `${name} 页不得泄出 zod 内部结构`);
  }
  // *Schema 变量页本就显示 `z.ZodObject<…>` 等模式类型(d.ts 原文),只守 stub 求值失败才会出现的内部助手类型
  for (const o of outputs) assert.doesNotMatch(o.content, /z\.flatten|addQuestionMarks|baseObjectOutputType|\["_output"\]/, `${o.rel} 泄出 z.infer 求值失败的 zod 内部助手类型`);
  const session = outputs.find((o) => o.rel === join(OUT_DIR, 'classes', 'AgentSession.md'));
  assert.match(session.content, /get events\(\): AsyncIterable<KernelEvent>;/, '引用处须是别名名字而非整段内联');
  // 回归护栏:事件联合被内联时该页曾达 1600+ 行;正常成员增长(tansr-cli@c5219e02 起 +5 成员 → 804 行)不应触发。
  assert.ok(session.content.split('\n').length < 1000, 'AgentSession 页不应再被事件联合撑成 1600+ 行');
  assert.equal(session.content.split('\n').filter((l) => /^\s+type: "/.test(l)).length, 0, 'AgentSession 页不应出现内联的事件联合成员');
  const kernelEvent = outputs.find((o) => o.rel === join(OUT_DIR, 'type-aliases', 'KernelEvent.md'));
  assert.match(kernelEvent.content, /type KernelEvent = \{\n\s+seq: number;/, '别名页显示求出的结构(包络 & 负载联合)');
  assert.match(kernelEvent.content, /type: "session\.created";/);
  const message = outputs.find((o) => o.rel === join(OUT_DIR, 'type-aliases', 'IRMessage.md'));
  assert.match(message.content, /type IRMessage = \{\n\s+blocks: \(/);
  const allowed = new Set(Object.entries(INFER_RESIDUE_ALLOWLIST).filter(([, v]) => v.exported).map(([name]) => join(OUT_DIR, 'type-aliases', `${name}.md`)));
  for (const o of outputs) {
    if (!allowed.has(o.rel)) assert.doesNotMatch(o.content, /z\.infer</, `${o.rel} 仍有 z.infer 残留`);
    assert.doesNotMatch(o.content, /^type [A-Za-z]+(<[^>]*>)? = any;$/m, `${o.rel} 别名折成 any(stub 不足)`);
  }
});
