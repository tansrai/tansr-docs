---
title: 主线上的上下文与子代理
description: tansr-cli 主线已实现、尚未写入 CHANGELOG 版本号的上下文与子代理行为：会话交接、压缩、缓存、工具发现、Task 编排、Codemode 与写后验证。已发布的 SDK 0.20.1 与命令行 0.11.0 不包含它们。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

下面这些行为已经在 `tansr-cli` 主线里，**还没有登记进任何已发布版本的 CHANGELOG**。npm 上的 `@tansr/sdk` 0.20.1 和命令行 0.11.0 不包含它们。升级到含这些改动的包之前，不要按本节写调用。

## 会话交接

`createSession` 创建的会话可以用 `handoffSession(session, options)` 做目标导向交接。它只读源会话（最近的压缩摘要、保留的尾部历史、已配对的文件清单），生成面向新目标的简报，再创建一条只带种子消息的新会话。新会话记下 `parentSessionId`。源会话不被改写，之后仍可恢复。

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

- `goal` 必填且不能是空白。`reviewDraft` 可以改简报正文，或返回 `{ action: 'cancel' }`。取消、拒绝和失败都不会留下新会话。
- 同一工厂创建的会话上还有不可枚举的 `session.handoff(options)`，语义与 `handoffSession` 相同。类型上请调用导出的函数。
- 同一批导出还有 `HANDOFF_PROVENANCE_TAG`（种子消息上的交接标记 `tansr-handoff-v1`）、`buildHandoffSeedMessage` 与 `readHandoffProvenance`。生成的 SDK 符号页仍按已发布的 0.20.1，还没有这些名字。
- 命令行的交互界面增加了 `/handoff <goal>`。空目标只提示用法，不调用模型，也不改当前会话。确认后界面切到新会话，原会话留在磁盘上，用 `/resume` 找回。

## 在已提交节点上分叉

除了从快照 `fork`，主线还可以从任意已提交节点分出一支。摘要只覆盖离开原分支的那一段差量，并附上文件清单。分叉点之前的冷层段落不会被整段扫进来。

## 压缩

轮次进行到一半就触发压缩时，摘要把两段分开写：已经结束的历史，以及当前这一轮还没结束的前缀（原始请求、已经执行的动作、待衔接的现场）。工具调用和它的结果不会被拆到摘要两侧。连续压缩会先解开上一代包装，不会把同一段前缀一层层套上去。

后台预压缩不是缺省路径。只有配置了 `backgroundCompactMargin` 时，用量到达比硬阈值更早的水位，主请求仍立刻发出，后台对只读快照做摘要。下一道屏障会核代际和材料是否还对得上；会话已被清空、回退或被同步压缩超过时，这份后台摘要作废。`closeAsync()` 会等它结清并记上用量。

一次性辅助请求（压缩、分支摘要、单次标题或分类）不再写缓存标记。主会话请求和常驻子代理的主轮仍按原来的缓存策略。

首轮的工具定义会被钉成缓存前缀。之后新激活的工具只追加在这个前缀后面，避免整段前缀失效。

## 延迟工具发现

延迟候选工具达到 16 个，或显式强制打开时，会注册一个 `ToolSearch`。它的说明文本保持不变：中途接入或断开 MCP，不改这句说明。模型先检索再激活工具。子代理各自持有自己的目录，不能看见别的子代理激活的工具。真正执行仍走原来的权限门。

## Task 与常驻子代理

常驻子代理同时最多 4 个。槽位可以释放：仅当该子代理已经停稳并且收尾完成。父会话只能操作自己直接创建的子代理。在飞的一轮可以用 `steer` 在当前这批工具结束后改方向，或用 `followup` 排队。模型侧还有 `status` / `list` / `stop` / `release`。

`Task` 仍接受单个任务。另外两种形状互斥：

- `chain`：1 到 6 步。下一步用 `{previous}` 接收上一步的输出。中间正文不写入主会话历史。
- `tasks`：1 到 8 项并行。`concurrency` 缺省 4，最大 8。`policy` 为 `allSettled` 或 `failFast`。`failFast` 或父级取消时，未完成的兄弟会被停掉，并等到资源收尾结束。

常驻子代理可以把子卷写到你显式给出的目录，进程重启后按该子卷温恢复。连续崩溃缺省 5 次后锁定，跨重启仍然锁定，直到 `release` 该槽。无盘的会话服务不把这份子卷写到磁盘。

## Codemode 与结构化结果

工具可以带可选的 `outputSchema`。成功结果可以带 `structuredData`。这份数据不进入发给模型的消息。如果后面的钩子改了文本、却没有同步改 `structuredData`，结构化数据会被去掉。

`Codemode` 不是缺省工具，装配之后才出现。脚本在独立 worker 里运行，时间和内存有硬上限。脚本里的 `tools.<name>()` 仍走宿主的权限门。脚本自己的状态不落盘。

## 写后验证

`afterRun` 不是 `createSession` 的字段，只在内核查询环的选项里。不配置则完全不跑。只有本轮里配置的写文件工具（缺省 `Edit` 与 `Write`）成功写完，才会在查询结束前、会话仍忙着的时候调用你的 `verify`。返回 `{ action: 'pass' }` 即结束；返回 `{ action: 'followup', prompt }` 会在同一次查询里再修，次数缺省最多 2，硬顶 5，并且受轮数、预算和取消信号限制。纯读、纯问答不会触发。
