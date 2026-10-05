---
title: 统一请求头、响应头与错误信封
description: /api 上每个请求可携的头（Authorization、x-request-id、tansr-session-family、tansr-closure-id、tansr-event-envelope、Idempotency-Key、If-Match / ETag、deadline）、每个响应必带的四个 tansr-* 头，以及 ≥ 400 时的统一错误信封：19 个统一码、6 种 retryAction、detail.domainCode 的读法与状态改写规则。
zone: docs
category: unified-api
sidebar:
  order: 4
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/events
  - unified-api/clients
  - errors/codes
  - sdk/errors-and-retries
  - serve/v2-and-webhooks
sources:
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-error-map.json
  - tansr-cli:packages/server/src/api/request-headers.ts
  - tansr-cli:packages/server/src/api/error-envelope.ts
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-05'
---

`/api` 把「怎么表达一次请求」和「怎么表达一次失败」从各领域子合同里抽出来统一定义。本页是这两件事的事实表；成功响应体不在本页范围——它由各领域子合同约束，且与旧前缀逐字节相同。

## 请求头

| 头 | 适用范围 | 语义 |
|---|---|---|
| `Authorization: Bearer <token>` | 所有请求 | 身份只在这里。缺失或无效 → 401 `unauthorized`（响应带 `www-authenticate: Bearer`）；鉴权源不可用 → 503 `capacity_exceeded`（带 `retry-after`）。体内出现的身份字段只能与鉴权产物一致，否则被拒 |
| `x-request-id`（或 W3C `traceparent`） | 可选 | 链路标识。合法的 `x-request-id`（1–128 位字母数字与 `._-`）原样采纳，否则取 `traceparent` 的 trace-id，再否则服务端自铸；响应头 `x-request-id` 与错误信封 `traceId` 同值。它与业务幂等键 `requestId` 无关 |
| `tansr-session-family: sdk1 \| sdk2-offload-v1` | 可选；会话域与执行域 | 声明会话族；缺省取部署首选族。词表外 → 400 `invalid_request`；未装配 → `capability_unavailable`（`detail.reason: not_installed`） |
| `tansr-closure-id: <closureId>` | 可选；仅会话内写操作 | 围栏前置条件；不等 → 412 `precondition_failed` / `rediscover`。放在 `GET` 或非会话路径上 → 400。见[发现与能力围栏](/unified-api/discovery-and-closure/) |
| `tansr-event-envelope: unified-v1` | 可选；对流操作生效 | 显式协商统一事件包络；服务端回响同名头即为确认。词表外的值访问任何 `/api` 路径 → 400。见[事件流与统一事件包络](/unified-api/events/) |
| `Idempotency-Key: <key>` | 可选；仅写操作 | 写操作幂等键，`@tansr/serve` 0.14.0 起生效。见下节 |
| `If-Match: "<revision>"` | 可选；仅登记了 `expectedRevision` 的 9 个写操作 | 资源版本前置条件，0.14.0 起生效。见下节 |
| `deadline: <RFC 3339>` | 可选 | 请求截止时刻，0.14.0 起生效。见下节 |

## 三个请求头：幂等、条件写与截止

这三个头都是**显式协商**：不合形或不适用的头不会被忽略，而是 400 `invalid_request`，`detail.reason` 给出细因（`idempotency_key_invalid` / `idempotency_key_not_applicable` / `if_match_invalid` / `if_match_not_applicable` / `deadline_invalid`），`detail.header` 给出头名。

### `Idempotency-Key`

- 形：1–128 个可打印 ASCII 字符（`^[\x21-\x7e]{1,128}$`）。只对 manifest 分类为**写**的操作有效。
- 服务端把它映射到该族的域内幂等键（`sdk2-ext-v1` 等族的 `request.requestId`、终端三族的 `requestId`；`agent-session-v1` 无体内位，只认头）。体内已有同名键且与头不等 → 409 `conflict`（`detail.reason: idempotency_key_mismatch`）。
- **同键同义**（同用户、同操作、同 manifest 修订、请求指纹相同）→ 返回首次执行的原回执，副作用恰好一次；**同键异义** → 409 `conflict`（`detail.domainCode: request_id_conflict`，`detail.reason: idempotency_key_reused`）；同键请求仍在飞 → 等待首次结果后同样返回原回执。
- 回执缓存有界：每用户 256 条、全局 4096 条、保留 10 分钟。原回执已被逐出 → 503 `result_unknown`（`retryAction: query-status`，`detail.reason: receipt_not_retained`）；在飞窗口已满 → 503 `result_unknown`（`detail.reason: receipt_window_full`，带 `retry-after`）。两种情况都**不能重放**，只能用领域的查询操作（如 `archive.operation.query`、`cache.operation.query`、`terminal.memory.receipt`）确认结果。

### `If-Match` 与 `ETag`

- 只接受强校验器 `"<十进制 revision>"`；弱校验器（`W/`）、通配符、非数值一律 400。
- 只对 manifest 里登记了 `expectedRevision` 的 9 个写操作有效：`archive.binding.create`、`archive.binding.close`、`archive.ack.commit`、`cache.binding.renew`、`cache.binding.rebind`、`cache.binding.rotate`、`cache.binding.close`、`terminal.configuration.commit`、`terminal.memory.command`。其它操作上出现 → 400 `if_match_not_applicable`。
- 服务端把它映射到体内的 `expectedRevision`（缺席则填入；在场且不等 → 412 `precondition_failed`，`detail.reason: if_match_body_mismatch`）。资源版本已前进 → 412 `precondition_failed`，`retryAction: refresh`，`detail.domainCode` 为原族码（`revision_conflict` / `stale_revision` / `binding_conflict`），`detail.reason: if_match_stale`，**一字未写**。
- 有版本资源的 2xx 响应带 `ETag: "<revision>"`，共 15 个操作会给（档案绑定与状态、缓存绑定、终端配置与记忆的读写）。正确用法是：读 → 取 `ETag` → 以它作 `If-Match` 写；收到 412 后重新读，不要自增 revision 猜。

### `deadline`

- 形：RFC 3339 日期时间（`2026-10-05T08:00:00Z` 或带偏移），表示绝对截止时刻。
- 到达服务端时已过期 → 408 `invalid_request`（`detail.reason: deadline_exceeded`），不受理、不触及下游。未过期时服务端原样委托领域处理器，不替下游计时。
- 重试**不延长**截止时刻：官方客户端在本地发出前就拒绝已过期的请求，`retrySameRequest` 在等待后会越过截止时直接放弃。

### 三头共同的体帽

携带 `Idempotency-Key` 或 `If-Match` 的请求，服务端需要读完整请求体做指纹与体内映射，上限 1 MiB；超限 → 413 `payload_too_large`（`detail.reason: header_body_limit`，`detail.limitBytes: 1048576`）。大体量上传操作（如 `material.upload.chunk`）不要带这两个头。

## 响应头

| 头 | 何时出现 | 内容 |
|---|---|---|
| `tansr-contract` | 每个 `/api` 响应（含 2xx 与 SSE 打开） | 恒 `unified-v1`。缺失即「合同不可用」：你连到的不是 `/api`，或经过的网关吞掉了头——上报，不要回退 |
| `tansr-manifest-revision` | 每个响应 | 服务端 manifest 修订（当前 `7`） |
| `tansr-domain` | 每个响应 | 受理领域（9 个领域词之一） |
| `tansr-schema-hash` | 每个响应 | `sha256:<64 hex>`；发现端点给 manifest 聚合值，其它领域给该族源文件摘要 |
| `tansr-closure-id` | 会话级能力围栏响应；412 / 403 / 404 的围栏拒绝 | 当前 `closureId` |
| `tansr-event-envelope` | 已协商的事件流 | 回响 `unified-v1`，是协商成立的唯一信号 |
| `ETag` | 15 个有版本资源操作的 2xx | 强校验器 `"<revision>"` |
| `x-request-id` | 每个响应 | 链路标识 |
| `retry-after` | 429 / 503 | 秒；官方客户端据此等待，且不超过本地预算与 `deadline` |
| `www-authenticate` | 401 | `Bearer` |
| `allow` | 405 | 允许的方法 |

同名重复、形不合、或出现词表外的 `tansr-*` 头，官方客户端一律按合同不可用处理。

## 统一错误信封

`/api` 上所有状态 ≥ 400 的 JSON 错误体都是同一个形：

```json
{
  "contract": "unified-v1",
  "traceId": "4f1c0f0e2b7a4d1c",
  "requestId": null,
  "code": "capability_unavailable",
  "status": 403,
  "retryAction": "none",
  "message": "session.audio.speak is disabled for this session",
  "detail": {
    "reason": "outside_closure",
    "operation": "session.audio.speak",
    "state": "disabled",
    "closureId": "9f3c…e1"
  }
}
```

- `code`、`status`、`retryAction` 是**公开决策面**：按 `code` 分支，按 `retryAction` 决定下一步，不要从 HTTP 状态码或 `message` 推断。
- `traceId` 等于响应头 `x-request-id`；`requestId` 是客户端的幂等键（`Idempotency-Key` 或体内 `requestId`），没有时为 `null`。
- `message` 是给人看的文案，不承诺字面；内部路径已改写为请求的 `/api` 路径，不会泄露旧前缀。
- `detail` 是可选结构化位。领域错误经门面归一时保留原族事实：`detail.domainCode`（原族码）、`detail.domainStatus`（原 HTTP 状态）、`detail.domainRetryAction`（原族动作）；缓存域的 `fallback` 等原 `detail` 键原样保留。
- 唯一例外：`archive-sync-v1` 族（`archive.sync`）没有统一码表，错误体按其原信封透传。

### 19 个统一码

| `code` | 缺省状态 | 缺省 `retryAction` | 含义 |
|---|---|---|---|
| `invalid_request` | 400（原状态为 422 时保留） | `none` | 请求形不合：多余查询键、缺 `protocol`、头不合形、过期的 `deadline`（408）等 |
| `protocol_mismatch` | 400 | `none` | 查询串里的修订标识不是该操作登记的值 |
| `not_canonical` | 400 | `none` | 严格 canonical 入口拒收非 canonical 体 |
| `unauthorized` | 401 | `none` | 未鉴权 |
| `forbidden` | 403 | `none` | 归属不符（含访问他人的会话 / 绑定） |
| `not_found` | 404 | `none` | 资源不存在，或 `/api` 下没有这条路径 |
| `capability_unavailable` | 404（围栏 `disabled` 为 403） | `none` | 领域未装配、能力不在、围栏外 |
| `method_not_allowed` | 405 | `none` | 方法不允许（带 `allow`） |
| `conflict` | 409 | `none` | 幂等键复用、状态机冲突、部署 / 归属条件不满足（如恢复不可用） |
| `stale_generation` | 409 | `rebind` | 绑定 / 连接代际已过期，需重新绑定 |
| `gap` | 409 | `none` | 序列断档 |
| `gone` | 410 | `none` | 会话已结束、绑定已关闭 |
| `precondition_failed` | 412 | `rediscover`（围栏陈旧）/ `refresh`（资源版本陈旧） | 前置条件不成立 |
| `payload_too_large` | 413 | `none` | 超过体帽 |
| `rejected` | 422 | `none` | 语义校验未通过 |
| `capacity_exceeded` | 429（原状态为 503 时保留） | `same-request` | 限流、排空中、过载、鉴权源不可用；带 `retry-after` |
| `internal_error` | 500（未登记的族码保留原状态） | `none` | 服务端内部错误，或矩阵未登记的域码 |
| `upstream_unavailable` | 503 | `same-request` | 上游 / 能力源暂不可用 |
| `result_unknown` | 503 | `query-status` | 副作用结果未知：只能查询，不能重放 |

状态改写规则：每个统一码有一个缺省状态；原族状态落在 RFC 允许的备选列内（400/422、409/412、409/410、404/403、429/503）时保留原状态，否则取缺省。因此 `session_ended`（旧前缀 409）经 `/api` 出线为 410 `gone`，`binding_closed` 同样 410，`unsupported_capability`（旧前缀 422 或 409）出线为 404 `capability_unavailable`，`commit_unknown` 出线为 503 `result_unknown`；原状态恒在 `detail.domainStatus`。

门面自己直接作答的只有 8 个码：`unauthorized`、`not_found`、`method_not_allowed`、`invalid_request`、`capability_unavailable`、`capacity_exceeded`、`precondition_failed`、`upstream_unavailable`；其余由领域错误归一而来。

### 6 种 `retryAction`

| `retryAction` | 你该做什么 |
|---|---|
| `none` | 不要重试同一请求；修正请求或告知用户 |
| `same-request` | 等 `retry-after`（或退避）后以**同一请求、同一 `Idempotency-Key`** 重放一次 |
| `query-status` | 不要重放；用领域的查询操作确认结果，再决定 |
| `rebind` | 重新建立绑定 / 连接（新代际），然后再做 |
| `refresh` | 重新读取资源拿到新 `ETag` / revision，再提交 |
| `rediscover` | 重新 `GET /api/sessions/:id/capabilities`（或整体重新发现），用新围栏重试 |

`@tansr/api-client/api` 的 `retryAdvice(error)` 把这张表编码成了 `{ action, stated, replayable, retryAfterMs, closureId, … }`，`retrySameRequest()` 只在 `replayable` 为真（服务端明示 `same-request`）且沿用同一键时重放一次，`result_unknown` 与 `commit_unknown` 永不重放。

## 与 `/v2` 错误形的差异

旧前缀的错误体是 `{ "error": { "code", "message", "detail"? } }`，码是各族自己的词表；`/api` 上变成八键统一信封，族码退到 `detail.domainCode`。如果你的代码过去按 `error.code === 'session_ended'` 分支，迁到 `/api` 后应改为 `code === 'gone'`，需要细分时再看 `detail.domainCode`。对照见[迁移与退役时间表](/unified-api/migration/)。
