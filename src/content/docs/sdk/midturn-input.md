---
title: 任务进行中追加输入
description: 在同一次执行中补充要求，不中断工具、不重开会话；说明 SDK、CLI、serve、ACP 与 headless 的接入、回执和失败边界。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - sdk/lifecycle
  - getting-started/serve
sources:
  - tansr-cli:doc/INJ-同轮追加输入手册.md
  - tansr-cli:packages/kernel/src/query/session-input-delivery.ts
  - tansr-cli:packages/cli/src/headless/input-control.ts
  - tansr-cli:packages/server/src/v2/routes.ts
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

本页适用于已在 npm 发布的 `@tansr/sdk@0.13.0`、`@tansr/cli@0.6.0` 与 `@tansr/serve@0.8.0` 及更高版本（现行 0.19.0 / 0.10.3 / 0.15.1，2026-10-10 发布；其间本页接口的签名、回执与失败边界无变化）。移动端还须使用实现能力发现与同轮输入接口的客户端版本（见各端接入指南）；源码和文档验证不代表手机安装包已完成真机验收。

**`submitInput` 只向指定的正在执行轮追加用户输入。** 它不打断当前模型流或工具，不新建会话，也不在目标轮关闭后自动开下一轮。已开始的请求不会被改写；追加文本在安全的输入屏障进入历史，随后才可能用于下一次模型调用。

## SDK：把“开始任务”和“补充要求”分开

空闲时继续用 `session.send()` 开始任务。补充按钮使用当次点击取得的目标与稳定的输入 ID；不要在失败分支回落到 `send()`。

```ts
import { randomUUID } from 'node:crypto';
import { createSession } from '@tansr/sdk';

const session = await createSession({ token, baseUrl });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('审阅合同并整理待确认条款');

// 由 UI 的“补充”操作调用；SDK 在 Electron 主进程/Node 宿主运行。
async function supplement(text: string) {
  const target = session.getInputTarget();
  if (target === null) return { outcome: 'closed' as const, code: 'turn_closed' };
  const request = { inputId: randomUUID(), target, content: { text }, ack: 'memory' as const };
  await retainInputDraft(request); // 宿主先保留原 ID、目标和内容；保存失败则不提交。
  const result = await session.submitInput(request);
  // 网络抛错时原 request 仍在宿主，先查询；成功时按 result 更新显示。
  return { request, result };
}

// 在后续 UI 事件或显式查询动作中，使用原 ID 与原目标。
// session.getInputStatus(request.inputId, request.target)
// 退出时另行 await session.closeAsync()，并核对其真实收尾回执。
```

`token`、`baseUrl`、`render` 和 `retainInputDraft` 由应用提供。`retainInputDraft` 是宿主的草稿保存函数，不是 SDK API；必须在提交前完成，网络失败后也不要删除原请求。事件泵跨轮保持；不要每次补充新建一个 `createSession()`、`query()` 或调用 `interrupt()`。`query()` 的便捷事件生成器没有这个会话接口；低阶 `runAgent()` 的 `QueryHandle` 提供 `reserveUserInput` 等内核能力，需自行负责消费和生命周期。

| 接口 | 返回与用途 |
| --- | --- |
| `inputCapabilities()` | `version: 1`、文本/文本块与 memory 支持、`durableAck: false`、`image: false`、当前目标及回执保留范围 |
| `getInputTarget()` | `{ historyEpoch, turnId }` 或 `null`；目标关闭时不得偷偷换成新轮 |
| `submitInput({ inputId, target, content, ack? })` | `accepted` 携 `receipt`；`closed` / `rejected` 携机器 `code` |
| `getInputStatus(inputId, target)` | 回执或 `null`；查询本身不重放输入或工具 |

`content` 可为 `{ text: '补充要求' }`，也可为 `{ blocks: [{ t: 'text', text: '第一点' }, { t: 'text', text: '第二点' }] }`；后者按换行连接。空文本、混合图片块和不支持的内容不会被静默裁掉。本期仅 `ack: 'memory'`，省略时也是 memory；`durable` 明确拒绝，配置 `SessionStore` 也不会把本接口升级为耐久投递。

## 回执、重试与恢复

| 回执状态 | 可以说明什么 |
| --- | --- |
| `accepted` | 内存中已接纳，尚未证明进入模型上下文 |
| `consumed` | 已应用到本轮历史；不等于请求已发出、模型已理解或业务任务完成 |
| `closed` / `cancelled` | 未消费输入已结束；查看 `reason`，不得当作任务完成 |
| `reserved` | 低阶内核预留阶段；普通 memory 宿主提交立即 commit，不提供 durable 承诺 |

回执含 `inputId`、`sessionId`、`historyEpoch`、`turnId`、`ordinal`、`revision`、`source`、`state`、`durability: 'memory'` 及可选 `reason`。`ordinal` 是同轮接纳顺序，`revision` 随状态更新。同 ID、同目标和同规范化文本重试返回原回执；文本改变会得到 `input_conflict`。重复提交可能返回已 `consumed` 或已 `closed` 的原回执，不能仅按外层 `outcome: 'accepted'` 显示“等待处理”。

网络中断后先查询原 ID/目标，必要时重发完全相同的请求。不要自动生成新 ID、换目标或调用旧 `messages` 路由，否则可能产生另一份输入。回执只保留当前轮与最近结束轮；SDK 查询 `null` 或 serve 返回 **404 + `{ outcome: 'rejected', code: 'input_not_found' }`** 仅表示当前保留窗口没有匹配回执，可能已经过期、重启或失效，不能作为“肯定从未执行”的证明。不要把所有 404 当空回执：原 `session_not_found`、401/403 等会话/鉴权错误仍需按原错误处理；已查到的 `closed` 回执与提交时 409 关闭目标也不能混成“未找到”。

显式恢复/替换历史与运行时重建会更换 `historyEpoch`；普通压缩不换这个输入纪元。手机重新连接同一个仍运行的 serve 会话可以继续查询；serve 重启或重建不会复活原执行轮，memory 回执也不保证保留。客户端应保留草稿并显示未确认，由用户决定后续操作，不能自动重放工具。

## 五种形态与三个终端

| 形态 | 入口与边界 |
| --- | --- |
| CLI TUI | 运行中 Enter 走严格补充；权限/问题对话框内用 `Ctrl+O` 切到补充输入，`Esc` 清草稿后仍保持补充焦点，再按 `Ctrl+O` 才返回审批。数字与 Enter 不会把补充当作同意 |
| SDK | 使用上述 `AgentSession` 四个方法；Windows Electron 在主进程绑定会话和 ID，renderer 经 IPC 调用，不持有长期平台密钥 |
| serve | 使用下面的 v2 路由；Android/iOS 连接同一个 serve 会话，不各自运行另一套 Node SDK 或内核 |
| ACP | 使用协商后的私有扩展；原 `session/prompt` 正忙时仍拒绝，新扩展不替换原 prompt 的响应 ID 或完成结果 |
| headless | 显式 NDJSON 双工控制模式；一次 `-p` 对应一次 query，追加帧不启动新 query |

旧 `send()` / serve `messages` 的兼容入口仍在：自然 `completed` / `structured_output` 封口窗口中的旧用户输入可以结转到下一轮；同代的限额、显式中止等硬终态不允许自动另开一轮绕过预算。需要严格同轮语义时始终使用新入口。CLI 代理通知独立保留原队列/确认纪律，不当作用户授权。

## serve：认证后绑定原会话

沿用该 serve 部署的鉴权方式。服务端从已认证的应用/终端用户域确定归属，客户端提交 `sessionId` 不会获得跨用户会话权限。

```http
GET /v2/sessions/{sessionId}/input-capabilities
POST /v2/sessions/{sessionId}/inputs
Content-Type: application/json

{"inputId":"ui-001","target":{"historyEpoch":"FROM_CAPABILITIES","turnId":"FROM_CAPABILITIES"},"content":{"text":"请同时核对续约条款"},"ack":"memory"}
```

```http
GET /v2/sessions/{sessionId}/inputs/ui-001?historyEpoch=FROM_CAPABILITIES&turnId=FROM_CAPABILITIES
```

对路径和查询值做 URL 编码。成功提交返回 **202 + `{ outcome: 'accepted', receipt }`**；关闭目标/内容冲突为 409，注入配额为 429，不支持能力/内容为 422，格式错误为 400。状态查询成功为 200 + `{ receipt }`，未找到为 404。原 `POST .../messages` 的 202 含义保持兼容，不等同于新输入回执。SSE 继续传原事件协议；本期不新增输入状态 SSE 事件，客户端调用查询接口更新显示。

`@tansr/serve` 0.13.0 起（2026-10-02 发布）新集成走统一调用面：同一组操作在 `/api/sessions/{sessionId}/input-capabilities`、`/api/sessions/{sessionId}/inputs`、`/api/sessions/{sessionId}/inputs/{inputId}` 上可达，请求体与 `{ outcome, receipt }` 回执字节不变；≥ 400 的错误改为统一信封（`code` 为统一码，原族码在 `detail.domainCode`），全部 `/api` 响应携 `tansr-contract` 等统一响应头。`/v2` 直连面现行 0.15.1 仍可读写、体与状态码不变，但已定义为内部适配入口，1.0.0 移除外部入口；0.15.0 起旧前缀响应附 `Deprecation` / `Link` 响应头，同一会话跨前缀混用只记 `api.legacy_prefix_mixed` 告警日志、不拒绝请求，仍应只经一种前缀。见[统一 API](/unified-api/)与 [v2 协议与 webhook](/serve/v2-and-webhooks/)。

## ACP：扩展协商，不并发提交普通 prompt

先按 ACP 初始化，在 `agentCapabilities._meta['tansr.com'].midTurnInput` 检查扩展版本，然后调用 `_tansr.com/session/input_capabilities` 查询指定会话。以下都是 JSON-RPC 请求，使用各自独立 `id`：

```json
{"jsonrpc":"2.0","id":"caps","method":"_tansr.com/session/input_capabilities","params":{"sessionId":"SESSION"}}
{"jsonrpc":"2.0","id":"extra","method":"_tansr.com/session/steer","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"补充续约要求"},"ack":"memory"}}
{"jsonrpc":"2.0","id":"status","method":"_tansr.com/session/input_status","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
```

`steer` 的 RPC result 是宿主 `outcome`，`input_status` 返回 `{ receipt }`（未知为 `null`）。普通 prompt 仍只有自己的最终响应；只有原权限响应通道能批准工具。发送“允许”文本没有批准权限的副作用。未协商支持的新客户端不要以忙时 `session/prompt` 模拟追加。

## headless：一次开始，后续只有控制帧

```sh
tansr -p "审阅合同" --output-format stream-json --input-format ndjson
```

不要搭配 `--cc-compat`、`--bg` 或聚合 `json`/`text` 输出；`--input-format text` 保留旧的 stdin 文本行为。必须提供非空 `-p`，本期没有 stdin `start` 帧。

先读取 stdout 的 `tansr.input.ready`，取得 `capabilities.target`。再将下列每个 JSON 对象作为独立一行写入 stdin：

```json
{"v":1,"id":"a","method":"steer","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"追加要求"},"ack":"memory"}}
{"v":1,"id":"b","method":"input_status","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
{"v":1,"id":"c","method":"cancel"}
```

上例第三行是显式取消示例，正常追加不发送它。响应为 `tansr.input.response`，沿用帧 `id`，`result` 中携回执/拒绝或 `cancel_requested`。这些记录与内核事件共用 stdout，按 `type` 区分；最后只有一条原有 `result`，取消沿用原退出码。UTF-8 分块、LF/CRLF 与 EOF 前无换行的最后一帧均可处理；每行上限是 **65,536 UTF-16 code units**，不是字节数。坏帧/过大帧有明确拒绝记录。

stdin EOF 只结束控制输入，不取消 query；query 先结束时会停止读取，不等 EOF，最后结果后不会再应答迟到帧。读取 stdout 时持续排空事件与控制响应；控制通道会在写入背压时暂停读取，不应将其解释成整个模型事件流提供耐久消息队列。

## 配置、权限与预算保持原边界

补充内容是用户消息，不是系统角色。平台提示词、SDK/serve `system` 与 `systemAppend` 保持本轮快照，不因补充重新拉取或重装；下一次新轮才按原 [提示词层级](/sdk/system-prompts/) 刷新平台设置。MCP/skills/工具集合不因补充自动增加。

新的真实用户意图在消费边界更新裁决/记忆选择提示，不自动批准已挂起的工具。模型轮数、工具轮数、注入配额、墙钟与金额预算继续累计。`consumed` 后也可能因限额结束而没有下一次请求，应结合回执与原终态显示结果。
