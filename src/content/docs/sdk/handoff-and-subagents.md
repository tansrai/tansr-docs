---
title: 长对话、交接与子代理
description: 目标变了就开一场带着必要上下文的新会话；对话太长时怎样压缩正在进行的一轮；工具太多时怎样按需查找；子代理怎样串行、并行或常驻。你现在安装的 SDK 0.20.1 与命令行 0.11.0 还没有这些调用。
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

你已经会用 `createSession` 做多轮会话，用[检查点](/sdk/checkpoints/)保存和恢复。这一篇讲后面三件你真会碰到的事：目标变了，要不要另开一场；对话太长，正在做的那一轮会不会被切碎；活要分给子代理时，是串着做、并排做，还是留一个可以中途改方向的。

先对一下你手里的包。现在用 npm 安装的 `@tansr/sdk` 0.20.1 和命令行 0.11.0 **还没有**下面这些调用。升级到包含它们的版本之前，按本节写的代码运行不了。符号参考页也还按你能装到的那个包生成，里面还查不到这些名字。

## 目标变了，把这场会话交出去

当前这场会话里已经有结论、改过的文件和压缩过的摘要，但下一步要做的事已经不是原来的目标。不要在原会话里硬拐弯，也不要让新会话把整段历史再读一遍。`handoffSession` 只读当前会话，写成一份面向新目标的简报，然后另开一场只带这一份简报的会话。原来那场的内存、快照和磁盘记录都不改，你之后还能回到它。

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

你要给的是新目标 `goal`，去掉空白后不能为空。空目标不会去调用模型，结果是 `rejected`，原因 `invalid_goal`。

可选的几项：

- `instructions` 是写给简报的额外要求。`signal` 在任何一步中止，结果都是 `cancelled`，不会留下半场新会话。
- `reviewDraft` 让你在创建之前看简报。回调收到原会话 id、目标、简报正文和文件清单。你可以把正文改掉再确认，也可以返回 `{ action: 'cancel' }`。改完若是空白，结果是 `rejected`，原因 `empty_briefing`。
- 不指定时，新会话 id 是新的 UUID，标题是目标文本（超过 64 个字符会截断），工作目录沿用当前会话。你放进 `meta` 的字段会写进新会话，其中 `parentSessionId` 和 `handoffGoal` 一定会写上，用来说明这场是从谁交过来的、当时的目标是什么。
- `client`、`model`、`store`、`maxSummaryTokens` 只在你要换模型、换存储或限制简报长度时才传。这场会话如果不是根上的 `createSession` 创建的，又没有可用的模型，结果是 `rejected`，原因 `unsupported_session`。

下面几种情况也不会去调用模型，也不会新建会话：会话已经关掉（`session_closed`），或者这一轮还在跑（`turn_running`）。模型装不上是 `model_resolution_failed`。简报没写成是 `failed`，看 `reason` 和 `message`。新会话没创建成是 `failed`，原因 `session_create_failed`。

成功时 `status` 为 `created`。里面有新旧两个会话 id、目标、简报、文件清单和那条种子消息，有时还有打开好的 `session` 和这次简报花掉的 `usage`。

同一个 `createSession` 创建出来的会话上，还有一个枚举不到的 `session.handoff(options)`，做的是同一件事。写类型时调用导出的 `handoffSession`。一起导出的还有种子消息上的标记 `HANDOFF_PROVENANCE_TAG`（值是 `tansr-handoff-v1`），以及用来组装、读回这条消息的 `buildHandoffSeedMessage` 和 `readHandoffProvenance`。

在命令行的对话界面里，输入 `/handoff <goal>` 是同一条路。什么都不写时，它只告诉你用法是 `/handoff <goal>`，不调用模型，也不改你正在看的这场。简报出来之后，Esc 或 Ctrl+C 取消。确认后界面切到新会话；原来那场还在磁盘上，用 `/resume` 打开。

## 从以前某个节点另开一条

[检查点](/sdk/checkpoints/)里的 `session.fork(checkpointId)` 没有变：它从一张快照复制出新会话。你要的是「从已经提交过的某个节点分出去，摘要只讲分叉之后多出来的那段」，用 `restoreWithBranchSummary`。

- 只传 `checkpointId`：还是沿着原来那条线往回恢复。
- 传 `allowSibling: true`，或者直接把另一条历史放进 `targetMessages`：切到同源的另一条。摘要只覆盖两条历史分叉之后的差量，并带上文件清单。分叉点之前那些已经收进冷层的段落，不会再整段扫一遍。
- 成功时 `status` 为 `installed`。你会拿到恢复前的保护快照 `preRestoreCheckpointId`、安装前后的消息数，有时还有分叉点 `lcaIndex`。摘要只有一条。平时用的 `session.restore` 行为不变。
- 参数不合法是 `rejected` / `invalid_options`。这场会话不是根入口创建的，是 `unsupported_session`。材料已经对不上，是 `source_invalidated`。你取消了，是 `cancelled`。

## 一轮还没做完，上下文已经满了

压缩如果正好发生在一轮的中途，摘要会分成两段写给你后面的模型看：已经结束的历史，以及这一轮还没做完的前缀（你的原话、已经跑过的动作、还要接着做的现场）。一次工具调用和它的结果不会被拆到摘要的两边。下一次再压缩时，会先拆开上一次的这层包装，不会把同一段前缀套一层又一层。

你可以让压缩更早开始，但那不是默认。在上下文阈值里加上 `backgroundCompactMargin`（提前多少 token）之后，用量到了这条更早的线，当前这次请求仍然马上发出，后台只对当时的只读快照做摘要。这条提前量必须是大于 0 的有限数；写成 `0`、负数或非数会直接抛错。不写这个字段时，行为和现在你用的包一样，不会多一条水位。

下一道关口会核对「还是不是当时那一版」。你如果已经清空、回退，或者同步压缩已经走过那张快照，后台这份摘要就作废，不会被塞进来。关掉会话时，`closeAsync()` 会等它做完，并把用量记上。

压缩、分支摘要、临时起的标题或分类，这些一次性的辅助请求不会再往缓存里写标记，避免后面的主对话把它们当成正文再读一遍。你自己的会话请求，以及常驻子代理自己的那一轮，缓存方式和以前一样。

第一轮用到的工具定义会钉在缓存前缀里。后来才启用的工具接在这段前缀后面，不必把整段前缀作废重写。

## 工具太多，就不要一次全给模型

默认不会多一个搜索工具。只有你在装配时传入 `deferredDiscovery`，延迟加载的工具才会按数量决定要不要收成 `ToolSearch`。

- 延迟候选达到阈值才注册。阈值默认 16，用 `threshold` 改。会话进行中还可能再接 MCP 时，设 `force: true`，不到 16 个也先放上 `ToolSearch`。
- 没到阈值、也没强制时，你直接传进去的工具仍然照常装上。这是 `eagerBelowThreshold` 的默认（`true`）。
- 模型调用时，`query` 不能为空。可以写一句它需要什么能力、一个精确的工具名，或者 `select:tool_a,tool_b` 点名加载。`limit` 默认 5，只能在 1 到 20 之间。找到的工具会加进它当前能直接调用的那一组。
- 这句说明是固定的。中途接上或断开 MCP，不会把整份目录贴进系统提示，也不会改这句说明。
- 每个子代理有自己的目录，看不见别的子代理刚刚启用的工具。真正执行时，仍走你原来的权限确认。

## 把活分给子代理

一次只做一件事，还是用单个 `Task`：`prompt` 和 `description` 都要写。只有这种写法可以 `run_in_background: true`，让它在后台跑。

要按顺序做几步，用 `chain`，1 到 6 步。下一步用 `{previous}` 接上一步的输出。中间那些正文不会写进你这场会话的历史，你最后看到的是整条链的结果。

要并排做几件，用 `tasks`，1 到 8 项。`concurrency` 默认同时 4 个，范围 1 到 8。`policy` 默认 `allSettled`，等每一项都有结果；`failFast` 则第一项失败就停掉还没做完的兄弟，并等到它们的资源收干净。`concurrency` 和 `policy` 只能和 `tasks` 一起用。

这三种写法互相排斥，一次只能给一种。每一步还可以带 `subagent_type`、`tools`、`model`、`max_turns`。`max_turns` 会被夹到 4 到 32。

有些子代理不是跑完就消失，而是留在这场会话里，你可以中途给它新指令。同时最多留 4 个，而且你只能操作自己直接创建的那些。模型用来管它们的工具是：

- `SpawnAgent`：`label` 和 `prompt` 必填。可选专家类型 `subagent_type` 和工具名单 `tools`。`tools` 给空数组，就是只说话、不调用工具。
- `AgentFollowup`：`agent_id` 和 `message` 必填。不写 `mode` 时是 `followup`，排到当前这一轮的末尾再送。`steer` 会等当前这批工具跑完，然后改方向。
- `AgentControl`：`action` 取 `status`、`list`、`stop`、`release`。`stop` 和 `release` 必须带 `agent_id`。`list`，或者不带 id 的 `status`，看你这场会话里自己的子代理。

`release` 用来把名额还出来。它只有在对方已经停稳、资源已经收完、没有还没送出的报告、也没有它自己再创建的子代理时才会成功。还在跑、还在收尾，或者名下还有子代理，你会得到 `agent_busy`。因为连续失败被停住、而且没有正在占用的资源时，可以释放。释放会删掉它对应的那份子卷。

这些管理工具不会交给子代理自己用。

子代理默认只活在内存里。你要它在进程重启后还能按原样回来，就传入 `subvolumeStore`，并给出 `rootDir`。文件写在 `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json`，路径出不了这场父会话的目录。连续崩溃默认 5 次（`restartLimit`，必须是正整数）之后它会锁住，重启也不会自己解开，直到你 `release` 这个名额。不落盘的会话服务没有这块存储，也就不会把子卷写到磁盘。

## 用一小段脚本把多次工具调用收在一起

几十次中间结果不该都堆进你这场会话的历史。装上 `createCodemodeTool` 之后，模型可以用 `Codemode`（这个名字可以改）写一段异步脚本：在隔离的一次性 worker 里调用工具，主会话只收回最终返回值和受控日志。不装配的话，没有这个工具。

模型传入 `code`，以及可选的 `timeout_ms`。默认 15 秒，你给的值最高 60 秒。交回主会话的文本默认不超过 32 KiB。worker 的老生代堆默认 48 MiB，超限只停掉这个 worker。

脚本里的 `await tools.<name>(args)` 和 `await callTool(name, args)` 都会回到你原来的调度，该确认权限还是要确认。一次脚本里这种嵌套调用默认最多 32 次。脚本不能再调用 `Codemode` 自己，也不能再去调用 `Task`、`SpawnAgent`、`AgentFollowup`、`AskUser`。

脚本里的 `store(key, value)` / `load(key)` 默认是一张纯内存表：最多 64 个键、合计 1 MiB、键名最长 256 个字符，不写磁盘。不落盘的会话服务同样不把这张表存下来。

如果你给工具声明了 `outputSchema`，成功结果可以带 `structuredData` 给程序读。这份额外数据不会放进发给模型的消息。校验失败会把它拿掉，并变成一条结构化错误。后面的钩子如果改了文本、却没有同时改 `structuredData`，这份额外数据也会被拿掉，避免文本已经脱敏、结构化字段还带着原文。

## 文件写完，让你的检查再跑一轮

`afterRun` 不是 `createSession` 的参数。把它放在查询环的选项里。不写就完全不跑，读文件和普通问答也不会触发。

只有这一轮里、你点名的写文件工具成功写完，才会在查询结束前、会话仍然占着的时候调用你的 `verify`。默认盯着的是 `Edit` 和 `Write`，用 `mutatingToolNames` 改。报错的结果，以及因为取消而补上的占位结果，都不算写成功。

`verify` 看得到这次改过的路径、用了哪些工具、这是第几次检查（从 1 数）、当时的消息和取消信号。返回 `{ action: 'pass' }` 就结束。返回 `{ action: 'followup', prompt }` 会在同一次查询里按你的提示再改。`maxAttempts` 默认最多 2 次，写再大也会夹到 5，写 0 就是只记不修。轮数、预算和取消信号同样有效。
