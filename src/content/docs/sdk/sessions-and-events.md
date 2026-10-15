---
title: 会话与事件流
description: 理解 @tansr/sdk 的三档 API、AgentSession 的多轮语义、事件包络与主要事件族，以及用 SessionView 与 Narrator 把事件流变成可渲染状态。
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - getting-started/sdk
  - sdk/checkpoints
  - sdk/platform-bundle
  - sdk/errors-and-retries
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
lastVerified: '2026-10-13'
---

SDK 的一句话分工：**智能体循环归 SDK，交互体验归你**。你提供 UI（或没有 UI）、业务函数、权限确认交互；SDK 提供模型接入、工具执行、事件流与状态投影。这一篇讲事件流这条主干。

本页适用于已在 npm 发布的 `@tansr/sdk@0.13.0` 及更高版本（现行 **0.19.0**，2026-10-10 发布；配套 `@tansr/serve` 0.15.1、`tansr` 命令行 0.10.3）。0.18.0 / 0.18.1 / 0.19.0 对本页的进程内 API **零行为变化**：`createSession` / `query` / `runAgent` 三档、事件包络、`SessionView` 均与 0.14.0 以来一致；统一 HTTP 调用面 `/api` 是会话服务的事，Electron / Node 内嵌 SDK 不经它。版本差异只在本页末尾「0.18.x 的加法」与「0.19.0 的加法」两节。

## system 与普通输入的边界

`query.prompt` 与 `session.send()` 是用户消息，不修改系统角色。支持新提示词功能的构建在装配时按平台 `fallback` / `prepend` 策略选择平台段和 SDK `system`，再追加 `systemAppend` 与适用指南；该功能自 `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线。

`session.applicationPrompt` 是只读的 `{ source, policy }` 摘要，没有正文，也不把 `systemAppend` 算作业务来源。平台提示词与策略在后续新一轮前刷新，当前执行轮保持配置，原实例和历史保留；宿主 system / systemAppend 仍由代码与会话配置管理。注入档 query 与低阶 runAgent 不自动拉平台配置，应手动使用 `resolveApplicationSystem`。完整代码见[应用系统提示词](/sdk/system-prompts/)。

## 三档 API

| API | 签名形态 | 适用 |
|---|---|---|
| `query(options)` | `AsyncGenerator<KernelEvent, QueryResult>` | 单轮一问一答（含工具循环），`return` 值是结构化终值 |
| `createSession(options)` | `Promise<AgentSession>`（async，恒 `await`） | 多轮会话：`send` / `events` / `interrupt` / `messages` / `setModel` / `close` |
| `runAgent(options)` | `QueryHandle` | 低阶直通：自带 client / executor / tools，零装配 |

`query` 是单轮便捷面，直通内核事件流；装配层合成的事件（`hook.*`、待办台账等）只在 `createSession` 的会话事件流里出现。多数应用用 `createSession`。

```ts
import { query } from '@tansr/sdk';

const run = query({ token, baseUrl, prompt: '用一句话说明 Electron 是什么。' });
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
const result = step.value; // QueryResult:reason / finalText / messages / usage / counters
```

对 `query` 提前 `break` 会自动中止查询环，不留悬挂轮；装配类错误在首次 `next()` 以 `TansrSdkError('assembly_failed')` reject。

## AgentSession 的多轮语义

退出应用或关闭共享 MCP host 前，使用新增的 [closeAsync / drain 真实收尾回执](/sdk/lifecycle/)。下面的 close 示例仅说明原有事件终态，不构成异步存储或底层资源完成证明。

```ts
const session = await createSession({ token, baseUrl });

const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();

session.send('第一轮问题');      // 空闲 → 起新一轮
session.send('补充一句');        // 旧兼容入口；严格同轮与回执使用 submitInput
await session.idle();            // 等当前轮(含结转连锁轮)终态
session.interrupt();             // 优雅中止当前轮(事件流走到 turn.aborted),会话可继续
console.log(session.messages()); // 历史快照(深拷贝;可持久化 / 续跑)
session.close();                 // 幂等;运行中先 abort,尾部事件不丢
await pump;
```

方法语义要点：

- `send(prompt)`：空闲起新轮；运行中经输入屏障消费，自然 `completed` / `structured_output` 窗口内未消费的旧输入可结转。限额/显式中止等硬终态不自动新开同代轮逃避预算。需要严格同轮与回执时使用 [submitInput](/sdk/midturn-input/)，不要在关闭目标后回落 `send()`。`close` 后再调用 throw `session_closed`。
- `events`：跨轮连续、会话内 `seq` 单调的 `AsyncIterable<KernelEvent>`。**多消费者广播**：每次 `for await` 都是一个独立订阅者，SessionView 泵、Narrator、你自己的循环可以同时挂，各得全量。首轮 `send()` 前挂上的订阅者得到会话创建以来的全部事件；直播中挂上的自订阅点起。
- `setModel(next)`：对后续轮生效。令牌 / 托管档传别名字符串（重解析失败抛 `assembly_failed`，会话状态不变）；注入档传 `{ client, model }`。
- `signal` 选项：AbortSignal，abort 即 close。
- `initialMessages`：历史预载（恢复场景；低阶径，不过配对治理）。
- `onHistoryCommit(history, meta)`：每轮终态携全量历史深拷贝回调；`meta.rewritten === true` 表示历史前缀被就地改写（压缩折叠 / 存根化），落盘方必须整卷轮换。多数场景直接用 `store` 字段，由内置实现代劳，见[检查点与恢复](/sdk/checkpoints/)。

`@tansr/sdk` **0.14.0 起**（2026-09-14 发布）在 `createSession` 上新增四个可选键，全部纯加法、不传即零变化：

- `trustProjectHooks?: boolean`：项目层 hooks 信任门。缺省 `false` = 工作区 `.tansr/settings.json` / `settings.local.json` 声明的 `command` / `http` hooks **零执行、零 `hook.*` 事件**（用户层 / 托管层 hooks 照常）；显式 `true` = 宿主代表用户为该工作区授信，项目层 hooks 照跑。SDK 恒不持久化信任、恒不读 `tansr` 命令行的 `trust.json`，授信事实由你逐次向用户确认后传入。门住的项目层 hooks 在场时经 `onWarning` 通报一次 `SdkWarning { code: 'project_hooks_untrusted', detail: { cwd, registered: { projectShared?, projectLocal? } } }`，无 `onWarning` 时回落事件流 `turn.error { scope: 'sdk.notice', recoverable: true }`。**行为收紧**：此前克隆仓库、`createSession` 一起就会跑起来的项目层 hooks，现在缺省不再执行。单轮 `query()` 共用同一装配、同受此门，且暂无授信位——项目层 hooks 在 `query()` 内恒不启用。命令行侧的同一道门见[安全与隐私](/security/#项目层-hooks-的信任门缺省零执行)。
- `hostShell?: 'posix' | 'powershell'`：权限引擎解析 Shell 命令的词法方言。缺省随宿主平台自动探测（与内置 Shell 工具实际派生的 shell 一致）；显式值供测试或跨平台演练（如在 Windows 上按 posix 词法演练规则）。与真实执行 shell 错配会让词法守卫与执行环境脱节，**生产宿主不要设置**。三档皆生效。
- `budget?: { maxUsd?, maxTotalTokens?, onExceeded?: 'block' | 'warn' }`：会话预算闸，与命令行配置文件的 `budget` 段同形，TUI / headless / serve / acp / SDK 五形态自此走同一闸门语义。会话累计消耗触顶时，`'block'`（缺省）在下一次模型调用前终止本轮——事件流 `turn.aborted { reason: 'budget_exceeded' }`，会话保持打开、后续轮同拦；`'warn'` 每次查询至多一条 `turn.error { scope: 'budget', recoverable: true }` 后照常继续。两个上限都缺席 = 不接闸。`maxTotalTokens` = 输入 + 输出 + 缓存读 + 缓存写（思考 token 按各模型能力位并入输出、不重复计）；`maxUsd` 只对以 USD 计价的模型出数——令牌档按平台 bundle 计价，托管 / 注入档当前内置价目为 CNY、`maxUsd` 不设防，币种无关的兜底用 `maxTotalTokens`。非法取值（非正数 / 非正整数 / 词表外）在任何 IO 前以 `invalid_options` 拒绝。与 `thinking.budget`（单轮思考预算）无关；不新增事件类型，恢复会话不回填历史用量。
- `events?: { maxBacklogEvents, maxBacklogBytes }`：事件积压上界。首订阅者到来前的积压受条数 / 近似字节双上界约束，缺省 1000 条 / 2 MiB（正数或 `Infinity`，否则 `invalid_options`）；越界丢最旧、最新一条恒保留，并在队首以恰一条一等事件 `session.events_dropped { scope: 'sdk.events', droppedCount, reason: 'count_limit' | 'bytes_limit', droppedBytes, firstDroppedSeq, lastDroppedSeq, maxEvents?, maxBytes? }` 通报，被丢事件不可重取。上界以内「晚到的首订阅者收到全量积压」不变；在 `send()` 前挂上订阅者的既有代码零改动。直播后订阅者全部离场期间推送的事件**不保留**（零语义裁剪，不计丢弃、不通报；再晚到的订阅者自当前起）——长跑会话请在 `send()` 前挂上订阅者，或按需调大上界。

同一版本还有几处值得知道的收边：`token` 接受 `() => string` getter（五类平台请求发起时取现值，令牌轮换无需重建会话）；`close()` 后 `setModel` / `setThinking` / `interrupt` 一律 throw `session_closed`；`AgentSession.pushBody` 自公开类型剥离（从未是承诺面）；`SessionNotice.message` 变为可选，宿主按 `code` 渲染、`message` 只作兜底；等待收尾的 `drain({ force: true })` 见[关闭会话与等待资源收尾](/sdk/lifecycle/)。

会话缺省纯内存；平台不存终端会话内容，只计量。

## 事件包络与事件族

每条事件都带包络字段 `type` / `sessionId` / `seq` / `ts` / `v`（契约版本）/ `source`;`turnId` 在轮内事件上在场。事件是平铺的 discriminated union，直接按 `event.type` 分支，与会话服务的 SSE 是同一份契约。

| 族 | 事件 | 什么时候看它 |
|---|---|---|
| session | `session.created` `session.resumed` `session.compacted` `session.checkpointed` `session.restored` `session.locale.changed` `session.ended` `session.events_dropped` | 生命周期与历史改写；`session.events_dropped`（contract-v0.27，SDK 0.14.0 起）是 SDK 进程内事件积压越界的通报，`@tansr/serve` 恒不发出、`/v2` 流恒无 |
| turn | `turn.started` `turn.completed` `turn.aborted` `turn.error` | 一轮的边界；`turn.error` 带 `recoverable` 位 |
| msg | `msg.block.start` `msg.text.delta` `msg.thinking.delta` `msg.block.end` `msg.retracted` | 流式正文与思考；`msg.retracted` 表示已流出的块被撤回（如触输出帽后干净重试） |
| tool | `tool.proposed` `tool.permission.requested` `tool.permission.decided` `tool.started` `tool.progress` `tool.output.delta` `tool.completed` `tool.failed` | 工具全生命周期；媒体工具的供应商失败以 `tool.completed.isError` 出线；入参不合工具 `inputSchema` 的调用自 0.14.0 起在执行前被调度器拒绝，以 `tool.failed { errorType: 'invalid_args' }` 出线且无 `tool.started` / `tool.completed`（不进执行、不触发权限裁决） |
| agent | `agent.spawned` `agent.progress` `agent.completed` | Task 子代理 |
| hook | `hook.triggered` `hook.completed` `hook.blocked` | 你配置的钩子 |
| cost | `cost.usage.updated` `cost.provider.switched` | 逐请求用量；供应商 fallback 切换 |
| mcp | `mcp.connected` `mcp.connect_failed` `mcp.closed` `mcp.discovered` 等 | MCP 服务器状态 |
| plan | `plan.todo.updated` | 待办台账 |

向前兼容铁律：**未知事件类型与未知字段一律忽略**，不要做封闭枚举校验——契约按「可选位加法」演进。

## 别手拼事件：SessionView 与 Narrator

做 UI 时不要自己从 `msg.text.delta` 拼字符串。SDK 随包提供两层喷口：

- `createSessionView(session)`：把事件流归约成**不可变的视图快照**（消息列表、工具卡、待办、用量、错误横幅、连接状态），structuredClone-safe，可以直接经 Electron IPC 传给 renderer。
- `createNarrator(...)`：生成人类可读的日志行，适合调试与审计输出。

呈现档可选：`{ delivery: { text: 'stream' | 'final', thinking: 'stream' | 'final' | 'off' } }`——文本与思考各自选流式或整段一次性上屏，思考可整体关显；`view.setDelivery(delivery)` 运行中块粒度即时切换。生成面的思考预算走 `createSession({ thinking: { budget } })` 与 `session.setThinking(...)`，与呈现档正交。

可恢复的咨询类 `turn.error`（`recoverable: true`，例如持久化失败）进 `SessionView.notices`（FIFO，上限 20），不污染 `lastError`;`ErrorView.recoverable` 是必填字段，自定义投影请补齐。0.14.0 起 `session.events_dropped` 也归入 `notices`（`code: 'session.events_dropped'`、无 `message`、`detail` = 载荷去 `type` / `scope`），Narrator 出一行 `events dropped [scope]: N event(s) dropped (reason)`；因此 `SessionNotice.message` 变为可选，请按 `code` 渲染、`message` 只作兜底（如 `notice.message ?? notice.code`）。同版起 Narrator 对 `turn.error { recoverable: true }` 的一行文案为 `… — recoverable, session continues`——SDK 只担保会话仍开，是否重试由你决定；按 `notices[].code` / `scope` 判别的代码零变化。

0.15.0 起图像 / 视频 / 语音工具的产物（`artifact`）随会话历史保留，`resume` / 检查点恢复后 `SessionView` 可重建对应工具卡的预览；历史携产物但预览无法安全恢复时工具卡置 `artifactUnavailable: true`（不改变工具完成状态，旧的无产物历史不设置）。含产物的会话存储自此使用版本 2，升级须整体进行，见[检查点与恢复](/sdk/checkpoints/)。

## 权限：ask 桥到你的 UI

`permission: { mode?, rules?, askUser? }`——工具调用落到「询问」时经 `askUser` 桥到你的 UI；不接 `askUser` 则 fail-closed 降级为拒绝，这也是「工具全被拒」最常见的原因。令牌档缺省装配控制台任命的裁决人（`adjudication?: { posture?, callBudget?, enabled?, endUser? }`）；显式给了 `permission.mode` 即视为自管模式，裁决人不装并通报 `adjudicator_skipped_by_mode`；显式 `adjudication: {…}` 与 `permission.mode` 同现是真矛盾，throw `invalid_options`；静默自管请传 `adjudication: { enabled: false }`。

## 三条经济性纪律

长会话的钱主要花在**前缀重灌**上。三条纪律能省下大部分：

1. **resume / attach 恒优先于新建。** 持有上次 `sessionId` → 先试恢复 → 恢复不了才新建；每次进页面开新会话等于把上游已暖的缓存整体作废。
2. **申报字节恒稳定。** 工具名 / 描述 / 参数 schema / `builtin` 选择集 / system 段都进模型请求前缀，顺序换位或描述改一个字，下一轮整前缀 miss。工具与宿主业务段应保持稳定；平台提示词变更会在后续轮次更新前缀，应同时评估缓存命中与调用成本。
3. **闲置即关闭，恒不弃养。** `close()` 发起逻辑关闭与中止；退出宿主前用 `closeAsync()` 核对真实资源及所需存储 flush 回执，详见[生命周期与资源收尾](/sdk/lifecycle/)。平台会话归档是另一条边界，store 内容保留、随时 `resume`。

## 0.18.x 的加法

`@tansr/sdk` 0.18.0（2026-10-02，“2026.10 统一 API 发行车”）与 0.18.1（2026-10-04，「0.14.0 批」）相对 0.17.0 对本页相关的变化全部是**可选加法**，不传即零变化：

- **子入口 `@tansr/sdk/extensions`**（0.18.0 起随包）：本地归档宿主 `createNodeArchiveHost` 与本地缓存宿主 `createNodeCacheHost`，都是显式装配的宿主，**不是 `createSession` 的缺省开关**；不 import 该子入口的代码零变化。0.18.1 的 `src` 相对 0.18.0 零改动，随车只因 `./extensions` 的发布物内容有差量。两宿主的职责边界与性能披露见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。
- **`ToolContext.executionTarget?` / `ToolContext.turnId?` 与 `GateDecision.executionTarget?`**：自定义 `Tool.execute` 与自定义权限门能读到的三个新可选键。进程内 SDK（`createSession` / `query` / `defineTool` / 自定义门）里这三个键**恒缺席**——只有会话服务的 SDK2 显式执行档调度器会填入，表示该调用将在远端绑定设备 / 受控服务执行。自定义门若读到 `executionTarget`，不得回落宿主本机资源（缺资源即拒，不是宿主兜底）。
- **`AppBundleModel.adapterDiagnostics?`**：只读投影，描述平台目录证据是否足以选择请求 / 计费适配器（`status ∈ 'ready' | 'review' | 'unresolved'`），供界面展示；不携供应商凭据或价格原文，平台未下发时 `undefined`。
- **`CLIENT_FEATURES` 新增 `'bound-device-v1'`**：出线头 `x-tansr-client-features` 的缺省声明串随之变化，升级后首次装配会按新指纹重拉一次 bundle（旧缓存条目自然失效，无需手清）；对 `ClientFeature` 做穷举 `switch` 的代码补一个分支。进程内 SDK 不消费 bundle 的 `execution` 段，设备工具授权只在会话服务的 SDK2 执行档生效，见[平台装配与 bundle](/sdk/platform-bundle/)。
- **`SessionStore` 可选能力位 `attachmentCheckpoints`**：内置 `createFileSessionStore` 已实现，`resume` 自此把附件准入状态随历史冷恢复；自定义五方法 Store 不声明即保持 0.17 行为，见[检查点与恢复](/sdk/checkpoints/)。

## 0.19.0 的加法

`@tansr/sdk` 0.19.0（2026-10-10，与 `@tansr/serve` 0.15.1、命令行 0.10.3 同车）相对 0.18.1 的 `src` 改动全部在 `platform/*`，`session.ts` / `query.ts` / `run-agent.ts` 零改动；对本页而言仍是**可选加法**：

- **独立的平台非聊天操作客户端 `createPlatformNonchatClient({ baseUrl, token, onUnauthorized? })`**：嵌入 / 重排 / 文档抽取 / 音乐 / 私有音色 / 视频任务与实时会话等平台操作的显式 HTTP 客户端。它**不挂在 `AgentSession` 上、不进会话历史、不签发会话事件、不自动注册任何聊天工具**——只发送调用方显式请求的操作；提交类方法要求稳定的 `idempotencyKey`，`wait()` 以 `timeoutMs` / `maxPolls` 限界并回 `reason: 'terminal' | 'timeout' | 'poll_limit'`。失败抛 `PlatformNonchatError`（`code: 'platform_request_failed'`，携 `status` / `platformCode` / `outcomeUnknown` / `taskId?`），处置见[错误处理与重试](/sdk/errors-and-retries/)。`onUnauthorized` 只在令牌失效的 401 上被调用一次，用于换发新令牌后重放同键同体。
- **六个可选平台位与 `CLIENT_FEATURES` 新增 `'nonchat-operations-v1'`**：出线头缺省声明串再次变化，升级后首次装配按新指纹重拉一次 bundle；穷举 `ClientFeature` 的 `switch` 再补一个分支。六位只授权上述非聊天操作，缺席等效 `false`，见[平台装配与 bundle](/sdk/platform-bundle/)。
- **`SpeakInput.voiceRef?`**：令牌档直连 `session.platform.speak()` 可指定应用私有音色资源，与系统 `voice` 互斥。
- **`AppQuotaSchema` / `AppQuota`、实时连接与文档临时上传的合同类型**：只是类型与 zod 形的导出，进程内会话不消费它们。

0.19.0 之后主线仍在推进（例如模型角色主备裁决策略、工具函数级许可、私有音色按任务找回与令牌续期的同身份隔离），这些改动**尚未随任何 npm 版本发布**，本页不作描述。

## 相关

- [检查点与恢复](/sdk/checkpoints/)：`store`、`resume`、手动压缩与快照。
- [平台装配与 bundle](/sdk/platform-bundle/)：令牌档下发了什么，工具三环怎么选。
- [错误处理与重试](/sdk/errors-and-retries/)：`turn.error` 与 `TansrSdkError` 的分支处理。
