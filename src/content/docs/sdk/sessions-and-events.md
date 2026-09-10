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
lastVerified: '2026-09-10'
---

SDK 的一句话分工：**智能体循环归 SDK，交互体验归你**。你提供 UI（或没有 UI）、业务函数、权限确认交互；SDK 提供模型接入、工具执行、事件流与状态投影。这一篇讲事件流这条主干。

## system 与普通输入的边界

`query.prompt` 与 `session.send()` 是用户消息，不修改系统角色。支持新提示词功能的构建在装配时按平台 `fallback` / `prepend` 策略选择平台段和 SDK `system`，再追加 `systemAppend` 与适用指南；该功能尚待配套发布。

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

会话缺省纯内存；平台不存终端会话内容，只计量。

## 事件包络与事件族

每条事件都带包络字段 `type` / `sessionId` / `seq` / `ts` / `v`（契约版本）/ `source`;`turnId` 在轮内事件上在场。事件是平铺的 discriminated union，直接按 `event.type` 分支，与会话服务的 SSE 是同一份契约。

| 族 | 事件 | 什么时候看它 |
|---|---|---|
| session | `session.created` `session.resumed` `session.compacted` `session.checkpointed` `session.restored` `session.locale.changed` `session.ended` | 生命周期与历史改写 |
| turn | `turn.started` `turn.completed` `turn.aborted` `turn.error` | 一轮的边界；`turn.error` 带 `recoverable` 位 |
| msg | `msg.block.start` `msg.text.delta` `msg.thinking.delta` `msg.block.end` `msg.retracted` | 流式正文与思考；`msg.retracted` 表示已流出的块被撤回（如触输出帽后干净重试） |
| tool | `tool.proposed` `tool.permission.requested` `tool.permission.decided` `tool.started` `tool.progress` `tool.output.delta` `tool.completed` `tool.failed` | 工具全生命周期；媒体工具的供应商失败以 `tool.completed.isError` 出线 |
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

可恢复的咨询类 `turn.error`（`recoverable: true`，例如持久化失败）进 `SessionView.notices`（FIFO，上限 20），不污染 `lastError`;`ErrorView.recoverable` 是必填字段，自定义投影请补齐。

## 权限：ask 桥到你的 UI

`permission: { mode?, rules?, askUser? }`——工具调用落到「询问」时经 `askUser` 桥到你的 UI；不接 `askUser` 则 fail-closed 降级为拒绝，这也是「工具全被拒」最常见的原因。令牌档缺省装配控制台任命的裁决人（`adjudication?: { posture?, callBudget?, enabled?, endUser? }`）；显式给了 `permission.mode` 即视为自管模式，裁决人不装并通报 `adjudicator_skipped_by_mode`；显式 `adjudication: {…}` 与 `permission.mode` 同现是真矛盾，throw `invalid_options`；静默自管请传 `adjudication: { enabled: false }`。

## 三条经济性纪律

长会话的钱主要花在**前缀重灌**上。三条纪律能省下大部分：

1. **resume / attach 恒优先于新建。** 持有上次 `sessionId` → 先试恢复 → 恢复不了才新建；每次进页面开新会话等于把上游已暖的缓存整体作废。
2. **申报字节恒稳定。** 工具名 / 描述 / 参数 schema / `builtin` 选择集 / system 段都进模型请求前缀，顺序换位或描述改一个字，下一轮整前缀 miss。工具与宿主业务段应保持稳定；平台提示词变更会在后续轮次更新前缀，应同时评估缓存命中与调用成本。
3. **闲置即关闭，恒不弃养。** `close()` 发起逻辑关闭与中止；退出宿主前用 `closeAsync()` 核对真实资源及所需存储 flush 回执，详见[生命周期与资源收尾](/sdk/lifecycle/)。平台会话归档是另一条边界，store 内容保留、随时 `resume`。

## 相关

- [检查点与恢复](/sdk/checkpoints/)：`store`、`resume`、手动压缩与快照。
- [平台装配与 bundle](/sdk/platform-bundle/)：令牌档下发了什么，工具三环怎么选。
- [错误处理与重试](/sdk/errors-and-retries/)：`turn.error` 与 `TansrSdkError` 的分支处理。
