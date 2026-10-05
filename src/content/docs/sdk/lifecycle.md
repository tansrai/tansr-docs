---
title: 关闭会话与等待资源收尾
description: 用 closeAsync、drain 与 MCP 完成回执处理退出、超时、失败和重试，说明 Electron 与 Android、iOS 的责任边界。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - getting-started/sdk
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
lastVerified: '2026-10-05'
---

本页适用于已在 npm 发布的 `@tansr/sdk@0.13.0` 及更高版本（当前 0.18.1，2026-10-04 发布）与 `@tansr/serve@0.8.0` 及更高版本（当前 0.14.0）；标注「0.14.0 起」的部分需要 `@tansr/sdk` 0.14.0（2026-09-14 发布）或更高。0.15.0 … 0.18.1 对本页的收尾接口无签名或行为变化。业务事件结束与资源真正关闭是两个时点；以下接口须使用上述配套版本。

| 操作 | 用途 |
| --- | --- |
| `idle()`、`close()`、`session.ended` | 保留原业务终态；不证明存储和底层资源完成 |
| `session.drain(options?)` | 等待当前查询、空闲操作、提交与已发起清理；不关闭会话 |
| `session.closeAsync(options?)` | 先逻辑关闭，再按同一预算等待真实收尾 |
| `drain({ force: true })` / `closeAsync({ force: true })` | **0.14.0 起**：预算耗尽后释放收尾屏障并直接释放自有资源，违约适配器不再让收尾永久悬挂；结果恒 `status: 'failed'` |
| `host.dispose()` | 应用在全部借用会话完成后，关闭共享 MCP host |

```ts
const session = await createSession({ token, baseUrl, store });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('整理这次工作记录');
await session.idle();
const result = await session.closeAsync({ timeoutMs: 30_000, flushStore: true });
await pump;
if (result.status !== 'completed') {
  showCleanupState(result.status, result.pending, result.failureCount);
  // 保留 session，稍后继续：await session.drain({ timeoutMs: 30_000 });
}
```

`status` 是 `completed`、`failed`、`timeout` 或 `cancelled`。`pending` 是各阶段数量，`failures` 是有界诊断窗口，累计数在 `failureCount` / `omittedFailures`。原始 `cause` 可能含敏感信息，不直接发给网页、renderer 或日志。

观察默认 30 秒，`0` 只读当前状态，`Infinity` 只在宿主明确管理真实依赖链时使用。超时或 `signal` 只终止本次等待，底层工作仍继续，其他等待者不受影响。`flushStore` 默认 false；SDK 不关闭借用的 store。`retryPersistence: true` 显式重试待修复的最新完整历史提交，不重放业务回调；成功后旧错误保留并标记 `recovered`。不要在 `onHistoryCommit` 内等待同一会话的 `drain()`。

**`force`（`@tansr/sdk` 0.14.0 起）**：缺省 `drain()` 只观察、不释放自有资源；遇到违约的存储 / MCP 适配器（`settle()` 回 `pending > 0` 或超时）时，收尾会一直悬挂。`drain({ force: true })` / `closeAsync({ force: true })` / 单轮 `cleanup.drain({ force: true })` 在预算耗尽后释放屏障，对仍在飞的收尾记 `query_settlement_forced` / `compaction_settlement_forced`，随后直接释放自有资源（会话级 MCP host 的 `close` 被调用）并以同一预算等待完成，结果恒 `status: 'failed'` 携结构化失败。它对未关闭的会话无效——先 `close()`，或直接用 `closeAsync({ force: true })`。同一版本起，`query()` 的收尾失败 `SdkLifecycleError` 新增 `error.result`（已完成的 `QueryResult`，`onLifecycleError` 同携），需要终态文本的调用方读 `error.result?.finalText`。

## 删除或迁移会话存储前

单次 `store.get(sessionId)` 只排在已经进入 store 的操作之后。上一轮 `onHistoryCommit` 回调尚未结束时，下一轮提交可能仍停在会话队列中；即使 `idle()` 和事件流都已结束，回读也可能得到旧历史。

删除、迁移本会话专用目录或以最终历史重建会话前，调用 `closeAsync({ timeoutMs: 30_000, flushStore: true })` 并确认 `status === 'completed'`。超时、取消或失败时保留会话与目录，稍后继续等待或处理失败。多个会话共用存储时，逐一确认所有使用者完成，再由宿主管理共享 store；不要把某一个会话的回执当作整个目录已无写入。

## 单轮 query 与错误通道

`query()` 提前 break 会中止查询，并在 `cleanupTimeoutMs` 内观察收尾。消费代码自身抛错时，JavaScript 可能优先保留该异常；用 `onLifecycleError` 保存另一条收尾错误及继续观察入口。

```ts
let cleanup;
for await (const event of query({ token, baseUrl, prompt: '总结目录',
  cleanupTimeoutMs: 30_000,
  onLifecycleError(error) { cleanup = error.cleanup; showFailure(error.code); },
})) {
  render(event);
  if (userStopped()) break;
}
if (cleanup) showCleanupReceipt(await cleanup.drain({ timeoutMs: 30_000 }));
```

托管／令牌档 query 可显式提供 `skills` 和 `mcp`，与 createSession 共用能力位检查及所有权规则。省略扩展不主动读取技能目录；注入 client 档不隐式装配扩展。

## MCP 所有权与跨端

`mcp: { servers }` 由当前会话／查询所有；显式传入的 `McpHost` 是借用。共享 host 必须等全部使用者真实完成后才 dispose。并发及成功后的重复 dispose 合流；确定失败后再次显式调用只重试未确认资源。

`cleanupEvidence` 的 `transport-completion` 表示已等待本地传输完成层，`connector-close-promise` 只表示第三方连接的 close Promise。自带 stdio 等本地 child 与流结束，HTTP 等本地在飞流并尽力 DELETE；这些都不承诺任意未登记进程或 HTTP 远端服务已经退出。

Electron 示例在主进程使用 closeAsync，保留未完成会话和 host；外层有限观察超时后显示再次等待，只有用户选择直接退出才跳过剩余清理。Android／iOS 使用现有 serve 协议：断线、重连不等于删除会话，DELETE 响应及 session.ended 不证明底层进程退出。Node 宿主先按原 drain 预算停机，再等 `server.settleResources()`，最后关闭共享资源。

CLI、ACP、headless 的 MCP 新观察上限为 10 秒，旧协议与工具终止策略保持。内置 Task／可继续代理将嵌套查询回执交给父资源域；TUI 另外等待后台 Task、记忆提取／固化／提升和选择器的实际完成口，serve／ACP 在记忆 owner 退出活动列表后仍由会话关闭链持有它。自行增加的后台任务需显式接入。忽略 abort 的第三方工具可能继续 pending，任何回执都不能证明任意未登记子进程已经退出。

## SDK 2.0 扩展宿主的收尾顺序（0.18.0 起）

`@tansr/sdk/extensions` 的本地归档宿主与缓存宿主（见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)）与会话分开关闭：由宿主 `open` 返回的每个会话先按本页的 `closeAsync({ flushStore: true, … })`，或 `close()` 后 `drain()` 并确认回执 `completed`；全部会话完成后才 `await cacheHost.dispose()`。观察超时时继续保留对象并等待原收尾；`dispose()` 不代替保存、未知结果确认或删除，也不自动关闭借用的原 Store。需要删除缓存关系时，`cacheHost.delete({ sessionId, authorization })` 放在全部宿主会话关闭排空之后、`dispose()` 之前，删除进行中拒绝 `open` / `dispose`。
