---
title: 发现与能力围栏
description: 启动时先调的三个发现端点 GET /api/manifest、GET /api/capabilities 与会话级 GET /api/sessions/:id/capabilities 的语义；closureId 的计算方式与 tansr-closure-id 前置条件；enabled / disabled / unavailable 三态对应的应答；manifest 修订漂移时客户端该做什么。
zone: docs
category: unified-api
sidebar:
  order: 3
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/deploy-and-auth
  - errors/codes
sources:
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/src/api/closure.ts
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
lastVerified: '2026-10-13'
---

`/api` 的能力是**可发现**的：清单告诉你这个版本的服务端定义了哪些操作，部署级能力告诉你这台服务端装配了哪些领域，会话级能力围栏告诉你在某个会话里、以当前授权，哪些操作此刻放行。三个端点都只读、都要鉴权、都不返回任何可导航的 URL。

## 三个发现端点

| 操作 | 路径 | 回答的问题 | 响应要点 |
|---|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | 这个服务端版本定义了什么 | 整份 manifest（`format: tansr-api-manifest-v1`、`revision`、`schemaHash`、`families`、`operations`、`capabilities`、`platformApi`），外加 `runtime.installed`（各领域是否装配，会话域为首选族名或 `null`） |
| `discovery.capabilities` | `GET /api/capabilities` | 这台服务端装配了什么 | `{ contract, manifestRevision, schemaHash, domains }`；每个领域给 `installed`、`contract`（族名）、`status`、`schemaHash`，会话域另给 `family: { preferred, available }` |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | 在这个会话里此刻能做什么 | 能力围栏（见下节），响应头 `tansr-closure-id` 与体内 `closureId` 相同 |

共同纪律：

- 只接受 `GET`；其它方法 → 405 `method_not_allowed`（带 `allow: GET`）。
- 不接受查询串与请求体；带了 → 400 `invalid_request`。
- 响应带 `cache-control: no-store`，每次启动或重连都重新发现，不要缓存到磁盘。
- 三个端点的 `tansr-domain` 都是 `discovery`，`tansr-schema-hash` 是聚合的 manifest `schemaHash`；其它领域的响应里这个头是该族源文件的摘要，与 manifest 聚合值不可比。
- 响应体里**没有** URL、`href`、`links` 之类的导航字段。路径只由 manifest 模板加路径参数在客户端本地实例化。

## 会话级能力围栏

围栏（capability closure）是服务端对「这个会话、这个用户、此刻」的操作可用性做出的一次确定性快照：

```json
{
  "contract": "unified-v1",
  "closureId": "<sha256 hex>",
  "authorizationRevision": "<string or null>",
  "domains": {
    "session": { "installed": true, "revision": "<family revision>" },
    "archive": { "installed": false, "revision": null }
  },
  "operations": {
    "session.message.send": "enabled",
    "session.audio.speak": "disabled",
    "archive.binding.create": "unavailable"
  }
}
```

- `operations` 覆盖 77 个操作（manifest revision 7 的 81 个操作去掉 3 个发现端点与部署级的 `session.capabilities`，即 `GET /api/capabilities/sessions`），每个取三态之一：
  - `enabled`：围栏内，可以调用；
  - `disabled`：能力在这台服务端上存在，但当前授权或会话状态不放行（例如会话已结束、所需能力位未授予、档案绑定尚未进入可写纪元）；
  - `unavailable`：这台服务端或这条会话的边界上不存在该能力（领域未装配、音频 / 输入源未接线等）。
- `closureId = sha256(UTF8('tansr.unified.closure.v1') ‖ 0x00 ‖ canonical({ authorizationRevision, domains, operations }))`，其中 `canonical` 是 `@tansr/protocol/canonical` 的严格 JSON 编码。客户端可以本地复算核对，但不需要自己推导围栏——围栏内容恒以服务端应答为准。
- 会话不存在、或不属于当前用户 → 404 `not_found`，两种情况不区分；会话域未装配或围栏源未接线 → `capability_unavailable`（`detail.reason: not_installed`）；围栏源暂时不可用 → 503 `upstream_unavailable`（带 `retry-after`）。

## 用 `tansr-closure-id` 做写操作的前置条件

拿到围栏后，在**会话内的写操作**上携带请求头 `tansr-closure-id: <closureId>`，服务端会在委托领域处理器之前做两件事：

| 复核 | 不通过时的应答 |
|---|---|
| 请求头里的 `closureId` 与当前围栏是否相等 | 412 `precondition_failed`，`retryAction: rediscover`，`detail.domainCode: closure_stale`；响应头 `tansr-closure-id` 直接给出当前值 |
| 该操作在当前围栏里是否 `enabled` | `disabled` → 403 `capability_unavailable`；`unavailable` → 404 `capability_unavailable`；两者 `detail` 都是 `{ reason: 'outside_closure', operation, state, closureId }` |

注意三点：

- 这个头只对会话内的写操作有意义。放在 `GET` / `HEAD` 上，或放在非会话路径（例如 `POST /api/executors/connections`）上 → 400 `invalid_request`（`detail.header: tansr-closure-id`）。
- 不带这个头时服务端不做围栏复核，领域处理器仍是最终权威——它会按自己的子合同拒绝越权请求。围栏是让客户端**提前**得到统一形的拒绝，而不是放宽任何检查。
- 收到 412 后的正确动作只有一个：重新 `GET /api/sessions/:id/capabilities`，用新的 `closureId` 重试。不要猜、不要沿用旧值、不要退回旧前缀。

## 修订漂移

每个 `/api` 响应都带 `tansr-manifest-revision`。官方客户端在构建期锁定自己生成时所用的 revision 与 `schemaHash`（例如 `@tansr/api-client/api` 暴露为 `client.locked`，运行期观察值为 `client.observed()`），运行时如果发现服务端 revision 与锁定值不同：

- **只记录，不切换逻辑。** 修订推进是加法（新操作、新字段），旧客户端继续按自己的目录调用；缺失的操作会在围栏里显示 `unavailable`，或在调用时得到 `capability_unavailable` / `not_found`。
- 不要据此改解析器，也不要去旧前缀「试一试」——那正是纪律第一条禁止的静默降级。
- 需要新操作时，升级客户端到对应 revision 的版本（`@tansr/api-client` 自 0.3.0 起对齐 revision 7，0.4.0 的 `./api` 子入口未变）。

`@tansr/api-client/api` 提供 `onContract` 回调，每个响应的 `{ manifestRevision, schemaHash, domain }` 都会经过它，适合接到你的排障日志。
