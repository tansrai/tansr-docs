---
title: 事件流与统一事件包络
description: '/api 的四条 SSE 路由、tansr-event-envelope: unified-v1 的显式协商与回响、7 键事件包络的每个字段、五个互不替代的游标各自从哪里来、terminalStatus 的判定表，以及 Last-Event-ID 续流与心跳、gap 帧的处理。'
zone: docs
category: unified-api
sidebar:
  order: 5
related:
  - unified-api/headers-and-errors
  - unified-api/discovery-and-closure
  - unified-api/surface
  - unified-api/clients
  - serve/v2-and-webhooks
  - sdk/sessions-and-events
sources:
  - tansr-cli:packages/server/src/api/event-envelope.ts
  - tansr-cli:packages/api-client/src/api/envelope.ts
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

`/api` 下有四条事件流，各自的帧载荷由所属领域子合同定义。统一事件包络不改变这些载荷，而是在你**显式要求**时给每一帧套上一层同形的外壳，让不同领域的流可以用同一段代码判断「这是哪个领域、游标到哪了、有没有终态」。

## 四条事件流

| 操作 | 路径 | 领域 | 帧里有什么 |
|---|---|---|---|
| `session.events.observe` | `GET /api/sessions/:id/events` | `session` | 内核事件（`msg.*`、`tool.*`、`turn.*`、`session.*`）与 `server.*` 控制帧 |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | `archive` | `archive.status`、`archive.records-available`、`material.request`、`material.status`、`binding.status` |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | `terminal` | `operations-available`、`operation-cancelled`、`reconcile-required` |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | `terminal` | `output.block`、`output.status` |

传输层与旧前缀相同：`text/event-stream`，首帧 `retry:`，注释帧 `: hb` 心跳，断线后以 `Last-Event-ID` 续流。会话流的帧形与重放细节见 [v2 协议与 webhook](/serve/v2-and-webhooks/)。

## 显式协商

- 请求头 `tansr-event-envelope: unified-v1`，大小写敏感、精确匹配。服务端在流响应上**回响同名头**，这是协商成立的唯一信号——没有回响就按未协商处理（`@tansr/api-client/api` 抛 `envelope_not_negotiated`），不要猜。
- 不带头：`/api` 的流与 `/v2`、`/v3/sdk2` 的流**逐字节相同**，便于你用旧的解析器先切前缀、再切包络。
- 带头访问非流路由（例如 `GET /api/sessions/:id`）：头被忽略，不回响、不改体。你可以用同一份请求头配置访问同一会话的 JSON 与 SSE 端点。
- 值不是 `unified-v1`（含空串、重复头）：访问任何 `/api` 路由都 400 `invalid_request`（`detail.header: tansr-event-envelope`）。

## 7 键包络

协商成立后，每一帧的 `data:` 变成一个固定 7 键的对象；`id:`、`event:`、`retry:` 行与注释帧原位保留。

```json
{
  "contract": "unified-v1",
  "eventId": "42",
  "domain": "session",
  "type": "turn.completed",
  "cursorSet": {
    "eventCursor": "42",
    "archiveCoverage": null,
    "outputWatermark": null,
    "materialConsumed": null,
    "ackReceipt": null
  },
  "terminalStatus": "completed",
  "raw": { "type": "turn.completed", "seq": 42, "sessionId": "0a1b2c3d", "turnId": "t-3" }
}
```

| 键 | 含义 |
|---|---|
| `contract` | 恒 `unified-v1` |
| `eventId` | 本帧的 SSE `id:`；没有 `id:` 的帧（如 gap 帧）为 `null`，不合成、不继承上一帧 |
| `domain` | 受理领域，与响应头 `tansr-domain` 同源 |
| `type` | 事件类型：取 SSE `event:` 名，缺席时取 `raw.type` / `raw.eventType`，再缺席为 `null`（视为未知事件） |
| `cursorSet` | 五个游标位，不适用的位为 `null`，见下节 |
| `terminalStatus` | `null` / `accepted` / `completed` / `aborted` / `unknown`，见下节 |
| `raw` | 原 `data:` 对象原样放入——**每一帧都有**，包括服务端不认识的事件类型；内部结构仍由各领域子合同约束 |

包络不输出 `payload` 或 `seq`：载荷就在 `raw`，流位置由 `cursorSet.eventCursor` 表达。只有 `data:` 是 JSON 对象的帧会被包络；非 JSON 文本、数组、标量、空 `data:` 的帧原样透传。

## 五个游标

| 游标 | 来源 | 推进它的帧 |
|---|---|---|
| `eventCursor` | 本帧 SSE `id:`（会话流为 `seq`，档案流为 `cursor`，执行器流为 `eventId`） | 每一帧各自给出，不继承 |
| `archiveCoverage` | 档案流 `archive.status` 的 `payload.acknowledgedCoverage`（`{ fromSequence, throughSequence, headDigest }`） | 只有已确认覆盖推进它；`archive.records-available` 的 `publishedThroughSequence` 是发布水位，不填这里 |
| `outputWatermark` | 工具输出流 `output.block` 的 `block.seq` | 用于以 `afterSeq` 续订输出 |
| `materialConsumed` | 档案流 `material.status` 且 `state === 'core-consumed'` 时的 `payload.materialRequestId` | 其它材料状态不推进 |
| `ackReceipt` | 事件流里**恒为 `null`** | ACK 回执经 HTTP 响应或 `archive.operation.query` 返回，不走事件流 |

五个游标互不替代：续订会话流只用 `eventCursor`（放进 `Last-Event-ID`），续订输出流只用 `outputWatermark`，判断档案是否已确认到某处只看 `archiveCoverage`。拿一个去续另一个不是「近似正确」，而是合同违例。

## `terminalStatus` 判定

`terminalStatus` 只在原事件**明确表达**终态时非 `null`；SSE 连接结束、服务端 EOF、HTTP 202 都不产生终态。

| 流 | 事件 | `terminalStatus` |
|---|---|---|
| 会话 | `turn.completed`、`session.ended` | `completed` |
| 会话 | `turn.aborted`；`turn.error` 且 `recoverable === false` | `aborted` |
| 会话 | `server.*` 控制帧、`msg.*`、`tool.*`、未知类型 | `null` |
| 档案 | `material.status`：`received` → `accepted`（只表示受理）；`core-consumed` → `completed`；`rejected` → `aborted`；`pending` / `verified` → `null` | 如左 |
| 档案 | `binding.status`：`closed` → `completed`；`active` / `backpressured` / `closing` → `null` | 如左 |
| 档案 | `archive.status`、`archive.records-available`、`material.request` | `null` |
| 执行器 | `operation-cancelled` → `aborted`；`operations-available`、`reconcile-required` → `null`（对账要求不是终态） | 如左 |
| 工具输出 | `output.status`：`complete` → `completed`；`available` / `receiving` / `truncated` / `gap` / `unavailable` → `null`；`output.block` → `null` | 如左 |

`unknown` 保留给无法判定结果的终态；收到它时按「结果未知」处理——查询状态，而不是重发。

## 续流、心跳与 gap

- 续流：重连时把最后消费帧的 `cursorSet.eventCursor` 放进 `Last-Event-ID`。续流的帧同样会被包络。
- 心跳：`: hb` 注释帧原样透传，不进包络；不要把它当作事件，也不要把长时间没有业务帧当作结束。
- gap：会话流的 `server.replay.gap` 没有 `id:`，包络后 `eventId` 与 `eventCursor` 都是 `null`，`type` 为 `server.replay.gap`，`raw` 里有 `requestedAfterSeq`、`oldestRetainedSeq`、`droppedEvents`。收到它走 L2 重建视图，见 [v2 协议与 webhook](/serve/v2-and-webhooks/)。
- 帧大小：`@tansr/api-client/api` 缺省单帧上限 2 MiB（`maxEventFrameBytes`），超限抛 `payload_too_large` 本地错误而不是静默截断。

## 用 `@tansr/api-client/api` 消费

```ts
import { createApiClient, isTerminalEvent } from '@tansr/api-client/api';

const api = createApiClient({ baseUrl, token: () => loadEndUserToken(), eventEnvelope: 'unified-v1' });

let lastEventId: string | null = null; // resume cursor = eventCursor of the last consumed frame
const stream = api.events('session.events.observe', {
  params: { id: sessionId },
  ...(lastEventId === null ? {} : { lastEventId }),
});
for await (const frame of stream) {
  const { envelope } = frame;
  if (typeof envelope.cursorSet.eventCursor === 'string') lastEventId = envelope.cursorSet.eventCursor;
  if (envelope.type === 'msg.text.delta') render(String(envelope.raw['text'] ?? ''));
  if (isTerminalEvent(envelope)) break;
}
```

`events()` 只在服务端回响了协商头时才产出 `{ id, event, envelope }`；流自然结束而没有终态帧时，循环会退出但 `isTerminalEvent` 从未为真——这正是「EOF 不等于完成」的代码表达，你的宿主应据此报告结果未知，而不是显示成功。
