---
title: 主线上的上下文与子代理
description: tansr-cli 主线已实现、尚未写入 CHANGELOG 版本号的上下文与子代理调用面：交接选项与拒绝原因、分支摘要、压缩水位、ToolSearch、Task 与常驻控制、Codemode 上限、写后验证。已发布的 SDK 0.20.1 与命令行 0.11.0 不包含它们。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/extensions/branch-summary.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/kernel/src/tools/task/agent-tools.ts
  - tansr-cli:packages/kernel/src/tools/codemode/codemode-tool.ts
  - tansr-cli:packages/kernel/src/tools/discovery/tool-search.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

下面这些行为已经在 `tansr-cli` 主线里，**还没有登记进任何已发布版本的 CHANGELOG**。npm 上的 `@tansr/sdk` 0.20.1 和命令行 0.11.0 不包含它们。升级到含这些改动的包之前，不要按本节写调用。生成的 SDK 符号页仍停在已发布契约。

## 会话交接

`createSession` 创建的会话可以用 `handoffSession(session, options)` 做目标导向交接。它只读源会话（最近的压缩摘要、保留的尾部历史、已配对的文件清单），生成面向新目标的简报，再创建一条只带种子消息的新会话。新会话记下 `parentSessionId`。源会话的内存、快照和持久记录都不改写，之后仍可恢复。

```ts
import { handoffSession } from '@tansr/sdk';

const next = await handoffSession(session, {
  goal: 'ship the retry change',
  reviewDraft: (draft) => ({ action: 'confirm', briefing: draft.briefing }),
});
if (next.status === 'created') {
  console.log(next.sessionId, next.parentSessionId);
}
```

选项：

- `goal` 必填，去掉空白后不能为空。空目标直接 `rejected`，原因 `invalid_goal`，不调用模型。
- `instructions` 可选，附加给简报生成。`signal` 在任意检查点中止时得到 `cancelled`，不留下新会话。
- `reviewDraft` 收到 `parentSessionId`、`goal`、`briefing`、`fileInventory`。可以改简报，或返回 `{ action: 'cancel' }`。改完的正文若是空白，结果是 `rejected` / `empty_briefing`。
- `newSessionId` 缺省为新的 UUID。`title` 缺省取目标文本，超过 64 个字符时截断。`cwd` 缺省沿用源会话。`meta` 会并入存储元数据，其中 `parentSessionId` 与 `handoffGoal` 恒写入。
- `client`、`model`、`store`、`maxSummaryTokens` 可选。未通过根 `createSession` 创建的会话，不注入可用模型时得到 `rejected` / `unsupported_session`。
- 会话已关闭是 `session_closed`。本轮仍在跑是 `turn_running`。这两种都不调用模型。模型装不上是 `model_resolution_failed`。新会话创建失败是 `failed` / `session_create_failed`。简报生成失败走 `failed`，并带上 `reason` 与 `message`。

`created` 带有 `parentSessionId`、`sessionId`、`handoffGoal`、`briefing`、`fileInventory`、`seedMessage`，有时还有 `session` 与 `usage`。取消、拒绝和失败都不留下新会话。

同一工厂创建的会话上还有不可枚举的 `session.handoff(options)`，语义与 `handoffSession` 相同。类型上请调用导出的函数。同一批导出还有 `HANDOFF_PROVENANCE_TAG`（种子消息标记 `tansr-handoff-v1`）、`buildHandoffSeedMessage` 与 `readHandoffProvenance`。

命令行交互界面增加了 `/handoff <goal>`。空目标只提示用法 `/handoff <goal>`，不调用模型，也不改当前会话。审阅时可以用 Esc 或 Ctrl+C 取消。确认后界面切到新会话，原会话留在磁盘上，用 `/resume` 找回。

## 在已提交节点上分叉

已发布的 `session.fork(checkpointId)` 仍是从快照分叉，本页不改它的合同。主线上的新增面是 `restoreWithBranchSummary`。

- 只给 `checkpointId` 时，仍是严格的线性祖先恢复。
- `allowSibling: true`，或直接传入 `targetMessages`，才做同源兄弟切换。摘要只覆盖离开公共前缀的那一段差量，并附上文件清单。分叉点之前的冷层段落不会被整段扫进来。
- 成功结果是 `installed`：带保护快照 `preRestoreCheckpointId`、安装前后的消息数，以及可选的 `lcaIndex`。摘要消息恰好一条。`session.restore` 的缺省合同不变。
- 选项不合法是 `rejected` / `invalid_options`。不是根入口创建的会话是 `unsupported_session`。材料已失效是 `source_invalidated`。取消是 `cancelled`。

## 压缩

轮次进行到一半就触发压缩时，摘要把两段分开写：已经结束的历史，以及当前这一轮还没结束的前缀（原始请求、已经执行的动作、待衔接的现场）。工具调用和它的结果不会被拆到摘要两侧。连续压缩会先解开上一代包装，不会把同一段前缀一层层套上去。

后台预压缩不是缺省路径。上下文阈值上的 `backgroundCompactMargin` 缺席时，不派生更早的水位，返回结构与未配置时一致。它必须是有限正数；`0`、负数和非数会抛错。配上之后，用量到达比硬阈值更早、并夹在微压缩停止线与自动压缩线之间的水位时，主请求仍立刻发出，后台对只读快照做摘要。下一道屏障会核代际和材料是否还对得上；会话已被清空、回退或被同步压缩超过时，这份后台摘要作废。`closeAsync()` 会等它结清并记上用量。

一次性辅助请求（压缩、分支摘要、单次标题或分类）写 `skipCacheWrite`，不再留下会被主对话复读的缓存标记。主会话请求和常驻子代理的主轮仍按原来的缓存策略。

首轮的工具定义会被钉成缓存前缀。之后新激活的工具只追加在这个前缀后面。

## 延迟工具发现

`deferredDiscovery` 缺席时，工具装配与原来一致，不会出现 `ToolSearch`。传入之后才按延迟候选数量裁决：

- 候选达到阈值才注册。阈值缺省 16，可用 `threshold` 改。`force: true` 时即使不足也注册，便于会话中途再接 MCP。
- 未达阈值且未强制时，直接传入的工具缺省仍照常装上（`eagerBelowThreshold` 缺省 `true`）。
- 模型调用 `ToolSearch` 时，`query` 必填，不能是空白。可以是自然语言关键词、精确工具名，或 `select:tool_a,tool_b`。`limit` 缺省 5，范围 1 到 20。命中的工具追加到当前工具集。
- 说明文本是冻结常量。中途接入或断开 MCP，不改这句说明，也不把整份目录铺进系统提示。
- 子代理各自持有自己的目录，不能看见别的子代理激活的工具。真正执行仍走原来的权限门。

## Task 与常驻子代理

常驻子代理同时最多 4 个。父会话只能操作自己直接创建的子代理。模型侧工具是：

- `SpawnAgent`：`label` 与 `prompt` 必填。可选 `subagent_type`、`tools`。空的 `tools` 表示纯文本常驻代理。
- `AgentFollowup`：`agent_id` 与 `message` 必填。`mode` 缺省 `followup`，排到当前轮末；`steer` 在当前这批工具结束后改方向。
- `AgentControl`：`action` 为 `status`、`list`、`stop`、`release`。`stop` 与 `release` 必须带 `agent_id`。`list`，或不带 `agent_id` 的 `status`，看本作用域全部子代理。
- `release` 只在已经停稳、物理收尾结束、没有待投递报告、也没有仍拥有的子代理时成功。仍在飞、仍在收尾或仍有后代时得到 `agent_busy`。熔断停车且没有在途资源时可以释放。释放会删掉对应的持久子卷。

这些父级控制工具不会原样交给子代理。

`Task` 的三种形状互斥，必须且只能给一种：

- 单个任务：`prompt` 与 `description` 都必填。只有这种形状可以 `run_in_background: true`。
- `chain`：1 到 6 步。下一步用 `{previous}` 接收上一步的输出。中间正文不写入主会话历史。
- `tasks`：1 到 8 项并行。`concurrency` 缺省 4，范围 1 到 8。`policy` 缺省 `allSettled`，或 `failFast`。`concurrency` 与 `policy` 只能和 `tasks` 一起出现。`failFast` 或父级取消时，未完成的兄弟会被停掉，并等到资源收尾结束。

每一步还可带 `subagent_type`、`tools`、`model`、`max_turns`。`max_turns` 会夹到 4 到 32。

常驻子代理缺省只留在内存。只有显式传入 `subvolumeStore`，并给出 `rootDir` 时，才把子卷写到 `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json`，进程重启后按该子卷温恢复。路径锁在该父会话目录内。连续崩溃次数缺省 5（`restartLimit`，须为正整数）后锁定，跨重启仍然锁定，直到 `release` 该槽。无盘的会话服务不提供这份存储，因此不把子卷写到磁盘。

## Codemode 与结构化结果

工具可以带可选的 `outputSchema`。成功结果可以带 `structuredData`。这份数据不进入发给模型的消息。校验失败会剥掉它并变成结构化错误。如果后面的钩子改了文本、却没有同步改 `structuredData`，结构化数据也会被去掉。

`Codemode` 不是缺省工具。装配 `createCodemodeTool` 之后才出现，工具名缺省 `Codemode`。模型传入 `code`（异步函数体）和可选的 `timeout_ms`。

- 脚本在一次性的 worker 里运行，跑完即结束。缺省超时 15 秒，请求值夹到最大 60 秒。返回给主会话的文本缺省最多 32 KiB。worker 老生代堆缺省 48 MiB。
- `await tools.<name>(args)` 与 `await callTool(name, args)` 都回到宿主调度，仍走权限门。单次脚本嵌套调用缺省最多 32 次。不允许再调用 `Codemode` 自己，也不允许嵌套 `Task`、`SpawnAgent`、`AgentFollowup`、`AskUser`。
- `store(key, value)` / `load(key)` 缺省是纯内存表：最多 64 个键、合计 1 MiB、键名最长 256 个字符。不写磁盘。无盘会话服务同样不落盘。

## 写后验证

`afterRun` 不是 `createSession` 的字段，只在内核查询环的选项里。不配置则完全不跑。

- `verify` 必填。上下文含 `mutations.mutatedFiles`、`mutations.mutatingTools`、从 1 起算的 `attempt`、当时的消息和取消信号。
- `mutatingToolNames` 缺省是 `Edit` 与 `Write`。只有这些工具成功写完（不是错误、也不是合成的中止占位）才计入。
- 调用发生在查询自然结束前，会话仍忙。`{ action: 'pass' }` 结束。`{ action: 'followup', prompt }` 在同一次查询里再修。
- `maxAttempts` 缺省 2，夹到 0 到 5。同时还受轮数、预算和取消信号限制。纯读、纯问答不会触发。
