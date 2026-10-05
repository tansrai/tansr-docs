---
title: 统一 API 合同（/api）总览
description: 自 @tansr/serve 0.13.0 起，/api 是会话服务唯一的公开 HTTP 调用面（合同 unified-v1）。本页给出三层合同、各版本的落地时间、最短可运行示例与开发者七条纪律，并导航到发现与围栏、统一头与错误信封、事件包络、迁移与各语言客户端。
zone: docs
category: unified-api
sidebar:
  order: 1
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - unified-api/clients
  - serve/v2-and-webhooks
  - getting-started/serve
  - releases/serve
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api` 是 `@tansr/serve` 对外的**唯一** HTTP 调用面：会话、执行、档案、缓存、终端等所有领域都在这一个前缀下，共用同一套请求头、响应头、错误信封与事件包络。合同名为 `unified-v1`，自 `@tansr/serve` 0.13.0（2026-10-02 发布）起正式可用。此前按领域分散的 `/v2`、`/v3/sdk2`、`/v3/terminal*` 仍在进程内，但只作为内部适配入口；`/v1` 在装配了 `/api` 的部署上缺省关闭。

如果你是第一次接触会话服务，先读[会话服务 5 分钟跑通](/getting-started/serve/)把服务跑起来，再回到这里；如果你已经在用 `/v2` 协议，直接看[迁移与退役时间表](/unified-api/migration/)。

## 三层合同

| 层 | 内容 | 由谁约束 |
|---|---|---|
| 公共信封（Common Envelope） | 请求头、响应头、统一错误信封、统一事件包络、幂等与前置条件语义 | 本章各页；wire 形以 `doc/rfc/unified-v1.schema.json` 与 165 条金向量为准 |
| 能力清单（Capability Manifest） | 路径模板、方法、查询键、读 / 写 / 流分类、能力项与限值 | `packages/server/contract/api-manifest.json`（当前 revision 7） |
| 领域子合同（Domain Subcontracts） | 各领域的请求 / 响应体、事件载荷、域内错误码 | `agent-session-v1`、`sdk2-ext-v1`、`terminal-services-v1` 等 11 个族 |

三层的分工是固定的：公共信封决定**怎么调**，能力清单决定**能调什么**，领域子合同决定**体里有什么**。`/api` 不改写任何领域子合同的成功响应体——同一个操作经 `/api` 与经旧前缀得到的 2xx 体逐字节相同；改变的只有头、错误形与（显式协商后的）事件帧外形。

## 一次调用长什么样

```http
POST /api/sessions/0a1b2c3d/messages HTTP/1.1
Authorization: Bearer <short-lived token>
Content-Type: application/json
tansr-closure-id: 9f3c…e1

{"prompt":"hi"}
```

```http
HTTP/1.1 202 Accepted
tansr-contract: unified-v1
tansr-manifest-revision: 7
tansr-domain: session
tansr-schema-hash: sha256:6e1876ed…
content-type: application/json

{"sessionId":"0a1b2c3d","accepted":true}
```

每个 `/api` 响应（含 2xx 与 SSE 打开）都带 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 四个头；缺任何一个，客户端都应判定「合同不可用」而不是继续解析。详见[统一请求头、响应头与错误信封](/unified-api/headers-and-errors/)。

## 版本落地时间

| 发行物 | 日期 | 与 `/api` 有关的变化 |
|---|---|---|
| `@tansr/serve` 0.13.0 | 2026-10-02 | `/api` 正式可用；统一错误信封（19 个统一码、6 种 `retryAction`）；显式协商的 7 键事件包络；发现端点与会话级能力围栏；装配了 `/api` 的部署上 `/v1` 缺省关闭（库选项 `disableV1`，CLI `tansr serve --legacy-v1` 或 `TANSR_SERVE_LEGACY_V1=1` 过渡保留） |
| `@tansr/protocol` 0.2.0 | 2026-10-02 | 首次公开发布，`@tansr/protocol/canonical` 子入口（严格 JSON 的 canonical 编解码与域摘要） |
| `@tansr/serve` 0.14.0 | 2026-10-04 | manifest revision 7：81 个操作，新增 `approval.credential.submit`（`POST /api/approvals/:id/credential`），权限 / 提问应答改用 `:ticketId` 占位；三个请求头 `Idempotency-Key`、`If-Match`（配 `ETag`）、`deadline` 接线；`--legacy-v1` / `TANSR_SERVE_LEGACY_V1` 标废弃并在启动时告警 |
| `@tansr/cli` 0.10.1 | 2026-10-04 | `tansr serve --legacy-v1` 标废弃（仍生效） |
| `@tansr/api-client` 0.3.0 | 2026-10-04 | 正式版：`@tansr/api-client/api` 子入口（`createApiClient`），操作目录对齐 revision 7，三个请求头以调用选项暴露；`./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` 旧入口冻结不删 |

本章所有页面按上表的**已发布**版本写事实；写到的能力都已在 `@tansr/serve` 0.14.0 上可用，没有「候选」项。

## 最短可运行示例（Node）

```ts
import { createApiClient, ApiError } from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'http://127.0.0.1:8787',
  token: () => loadEndUserToken(), // your own loader for the short-lived bearer token
  eventEnvelope: 'unified-v1',
});

const created = await api.call('session.create', { body: {} });
const sessionId = (created.body as { sessionId: string }).sessionId;

const { closureId } = await api.sessionCapabilities(sessionId);
await api.call('session.message.send', { params: { id: sessionId }, body: { prompt: 'hi' }, closureId });

for await (const frame of api.events('session.events.observe', { params: { id: sessionId } })) {
  if (frame.envelope.type === 'msg.text.delta') process.stdout.write(String(frame.envelope.raw['text'] ?? ''));
  if (frame.envelope.terminalStatus !== null) break;
}
```

这段代码里没有一处手写 `/api/...` 路径：操作名 `session.create`、`session.message.send`、`session.events.observe` 来自随包生成的操作目录，路径由 SDK 按 manifest 模板本地实例化。错误以 `ApiError`（统一信封）抛出，`error.code` 是 19 个统一码之一，`error.retryAction` 告诉你下一步该做什么。其它语言的现状见[各语言客户端](/unified-api/clients/)。

## 开发者七条纪律

这七条来自合同文本，所有官方客户端都按它们实现；自己写客户端时请逐条对照。

1. **不静默降级。** 响应缺 `tansr-contract: unified-v1` 头即视为合同不可用，上报而不是改走 `/v2` 或 `/v3`；请求了事件包络而服务端未回响同名头，也按未协商处理。
2. **不从响应里取 URL。** 发现端点不返回任何可导航字段；路径只由 manifest 模板加路径参数本地实例化。
3. **不重放未知副作用。** 只有服务端明示 `retryAction: same-request` 且沿用同一 `Idempotency-Key` 时才重放一次；`result_unknown` 只能查询状态。
4. **身份不进体。** 鉴权只在 `Authorization` 头；体内出现身份字段且与鉴权产物不符即被拒。
5. **SSE 结束与 202 都不等于完成。** 轮次 / 操作的终态只看事件包络的 `terminalStatus`。
6. **五个游标互不替代。** `eventCursor`、`archiveCoverage`、`outputWatermark`、`materialConsumed`、`ackReceipt` 各推进各的，不能拿一个去续另一个。
7. **不手写旧前缀。** 不在源码里出现 `/v2`、`/v3/sdk2`、`/v3/terminal` 字面量；同一会话族只经一种前缀访问。

## 本章导航

| 页 | 回答的问题 |
|---|---|
| [调用面、领域与操作目录](/unified-api/surface/) | `/api` 下有哪些领域与操作，路径怎么拼，查询串里的修订标识怎么带 |
| [发现与能力围栏](/unified-api/discovery-and-closure/) | 启动时先问什么，`closureId` 是什么，围栏外的操作会得到什么应答 |
| [统一请求头、响应头与错误信封](/unified-api/headers-and-errors/) | 每个请求能带哪些头，每个响应必带哪些头，19 个统一码与 6 种 `retryAction` 怎么判 |
| [事件流与统一事件包络](/unified-api/events/) | 四条 SSE 路由、显式协商、7 键包络、`terminalStatus` 判定与续流 |
| [迁移与退役时间表](/unified-api/migration/) | 从 `/v1`、`/v2`、`/v3` 怎么切到 `/api`，旧前缀什么时候退役，怎样成对回滚 |
| [各语言客户端](/unified-api/clients/) | Node / .NET / Android / iOS / 鸿蒙 / Go 各自对 unified-v1 的对齐状态 |
