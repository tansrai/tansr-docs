---
title: 迁移与退役时间表
description: 从 /v2、/v3/sdk2、/v3/terminal* 切到 /api 的路径对照与请求 / 错误形差异；会话服务 /v1 自 @tansr/serve 0.13.0 起在装配 /api 的部署上缺省关闭与 --legacy-v1 过渡；六步迁移法截至 0.15.1 的进度；/v2 与 /v3/* 的退役节奏，以及服务端与客户端成对回滚的纪律。
zone: docs
category: unified-api
sidebar:
  order: 6
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
  - releases/serve
  - releases/cli
sources:
  - tansr-cli:doc/report/UAPI-迁移与退役-2026-10-01.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-13'
---

`/api` 不是一套新协议，而是把既有领域子合同收到同一个前缀、同一套信封之下。因此迁移的主体工作是换路径、换头、换错误判定，而不是重写业务逻辑；成功响应体与事件载荷一字不变。

## 路径对照

旧前缀与 `/api` 的对应关系登记在 manifest 每个操作的 `legacyPath` / `legacyOffloadPath` 字段里，下面是最常用的一部分：

| 旧路径 | `/api` | 备注 |
|---|---|---|
| `POST /v2/sessions` | `POST /api/sessions` | 会话族 `sdk1`（缺省）|
| `POST /v3/sdk2/sessions` | `POST /api/sessions` + `tansr-session-family: sdk2-offload-v1` | 路径相同，族由请求头声明 |
| `GET /v2/sessions/:id/events` | `GET /api/sessions/:id/events` | 不带协商头时帧逐字节相同 |
| `POST /v2/sessions/:id/permission/:requestId` | `POST /api/sessions/:id/permission/:ticketId` | 占位名改为 `:ticketId`（`:id` 仍是会话 id） |
| `POST /v1/approvals/:id/credential` | `POST /api/approvals/:id/credential` | 唯一一条从 `/v1` 迁入的操作（0.14.0） |
| `GET /v3/sdk2/session-capabilities` | `GET /api/capabilities/sessions?protocol=sdk2-ext-v1` | |
| `GET /v3/sdk2/capabilities` | `GET /api/capabilities/archive` | 不带查询串 |
| `POST /v3/sdk2/bindings` | `POST /api/archive/bindings` | |
| `GET /v3/sdk2/bindings/:id` | `GET /api/archive/bindings/:id?protocol=sdk2-ext-v1` | GET 读带 `protocol` |
| `POST /v3/sdk2/bindings/:id/archive/acks` | `POST /api/archive/bindings/:id/archive/acks` | |
| `POST /v3/sdk2/archive-sync/:id` | `POST /api/archive/sync/:id` | 错误体仍为 `archive-sync-v1` 原信封 |
| `GET /v3/sdk2/cache/capabilities` | `GET /api/capabilities/cache` | |
| `POST /v3/sdk2/cache/bindings` | `POST /api/cache/bindings` | |
| `POST /v2/executors/connections` | `POST /api/executors/connections` | |
| `GET /v3/terminal/capabilities` | `GET /api/capabilities/terminal?contract=terminal-services-v1` | |
| `POST /v3/terminal/bindings` | `POST /api/terminal/bindings` | |
| `GET /v3/terminal/sessions/:id/tool-output` | `GET /api/terminal/sessions/:id/tool-output?contract=…&sessionContract=…` | |
| `GET /v3/terminal-observation/sessions/:id/resources` | `GET /api/terminal/observation/sessions/:id/resources` | 前缀段改为 `terminal/observation` |
| `GET /v3/terminal-profile/sessions/:id/catalog` | `GET /api/terminal/profile/sessions/:id/catalog` | 前缀段改为 `terminal/profile` |

不要手工维护这张表：官方客户端的路径模块都由 manifest 生成，自己写客户端时也应从 `GET /api/manifest` 或仓内的 `api-manifest.json` 生成。

## 请求与错误形的差异

| 方面 | 旧前缀 | `/api` |
|---|---|---|
| 会话族 | 由路径区分（`/v2` 与 `/v3/sdk2`） | 路径相同，请求头 `tansr-session-family` |
| 子合同修订 | 部分在路径或体里 | GET 读与流走查询串 `protocol=` / `contract=`；写操作不接受查询串（唯一例外：`session.checkpoint.import` 的 `label`） |
| 响应头 | 无统一头 | 每个响应必带 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` |
| 错误体 | `{ error: { code, message, detail? } }`，码为各族词表 | 八键统一信封，`code` 为 19 个统一码，族码退到 `detail.domainCode` |
| 部分错误的状态 | `session_ended` 409、`binding_closed` 409、`unsupported_capability` 422 / 409 | 410 `gone`、410 `gone`、404 `capability_unavailable`（原状态在 `detail.domainStatus`） |
| 事件帧 | 各域原帧 | 不带协商头时相同；带 `tansr-event-envelope: unified-v1` 时为 7 键包络 |
| 幂等 / 条件写 / 截止 | 只有体内 `requestId` / `expectedRevision` | 另可用 `Idempotency-Key` / `If-Match` / `deadline` 头（0.14.0 起），服务端映射到体内位 |
| 2xx 响应体 | — | **逐字节相同** |

迁移时最容易漏的是错误判定：把 `error.code === 'session_ended'` 这类分支改成按统一码 `gone` 判、按 `retryAction` 决定动作，需要细分时再读 `detail.domainCode`。详见[统一请求头、响应头与错误信封](/unified-api/headers-and-errors/)。

## 会话服务的 `/v1`

会话服务进程里的 `/v1`（`/v1/status`、`/v1/sessions` 族等单租户 Bearer 路由）与 `/api` 是两套身份体系，`/api` 下没有它们的对应物。自 `@tansr/serve` 0.13.0 起：

- **装配了 `/api` 的部署上 `/v1` 缺省关闭**：库形态 `startServer({ v2: … })` 时 `disableV1` 缺省为 `true`，`/v1*` 请求得到 404；CLI 形态 `tansr serve --v2` 同理。
- 过渡保留：库传 `disableV1: false`；CLI 加 `--legacy-v1`，或设环境变量 `TANSR_SERVE_LEGACY_V1=1`（旗标优先于环境变量）。
- 未开 `--v2` 的 SDK1-only `tansr serve` 既没有 `/api` 也不受影响，`/v1` 照旧。
- `@tansr/serve` 0.14.0 与 `@tansr/cli` 0.10.1（2026-10-04）把 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1` 标为**废弃**：仍然生效，但启动时会打出废弃通告。它是单独的退役项，在 1.0.0 前另行公告移除时点。

本站 REST 参考里的 `/v1` 是平台侧接口，与这里说的会话服务 `/v1` 无关。

## 六步迁移法与当前进度

| 步 | 内容 | 截至 `@tansr/serve` 0.15.1（2026-10-10 发布，当前 npm `latest`）的状态 |
|---|---|---|
| 一 | 内部 adapter：`/api` 改写委托到既有领域处理器，旧前缀逐字节不变 | 完成（0.13.0） |
| 二 | 双写 / 影子读：同一组金向量经旧入口与 `/api` 双跑，成功体逐字节同、错误体逐字段同源 | Node 与 .NET 已建立同源对表与 conformance 回放；Android / iOS / 鸿蒙 / Go 以 165 条金向量回放对齐 |
| 三 | 客户端切流：各端源码不再出现旧前缀字面量 | Node `@tansr/api-client` 0.3.0 正式版已切（`./api`）；0.4.0（2026-10-06）起，不传 `routePrefixes` 的冻结入口 `./sdk2` 与 `./terminal` 也缺省走 `/api`，仍要旧前缀时显式传入 `LEGACY_ROUTE_PREFIXES`。`./api` 子入口相对 0.3.0 无变化。.NET NuGet 0.2.0、Go `github.com/tansrai/tansr-go` v0.3.0、Rust / Python / C++ 0.1.0 已随公开包切到 `/api`；Android、iOS、鸿蒙的发布状态见[各语言客户端](/unified-api/clients/)；`examples/serve-demo` 改经公开 SDK |
| 四 | 禁止新旧混用：同一会话族在两种前缀下交叉访问时出结构化告警（不拒绝） | 已开始（0.15.0）：同一会话 id 先后走 `/api` 与 `/v2` 或 `/v3/*` 时记一条 `api.legacy_prefix_mixed`。缺省 `readwrite` 不拒绝 |
| 五 | 旧入口只读窗口：`/v2`、`/v3/*` 的写操作改答 410，读仍受理，响应附退役头 | 旋钮已随 0.15.0 提供，缺省仍是 `readwrite`，写操作不会因此改答 410。显式 `TANSR_SERVE_LEGACY_PREFIX=readonly` 才进入只读窗口；`off` 则旧前缀全部 404。旧前缀响应另附 `Deprecation` 与 `Link`（设置 `TANSR_SERVE_LEGACY_SUNSET` 后再附 `Sunset`）。0.15.0 发行说明曾把「缺省改为 readonly」写在后续版本。当前 npm 上的 `@tansr/serve` 0.15.1（2026-10-10）仍保持缺省 `readwrite`，没有执行这项迁移。0.16.0 尚未发布 |
| 六 | 关闭：移除 `/v2`、`/v3/*` 的外部可达入口，旧前缀答统一信封 404 | 1.0.0 |

自托管多副本部署在步三之前要先改反代：`/api/sessions/:id/**` 必须与 `/v2/sessions/:id/**` 走同一分片亲和，`/api` 下的四条 SSE 路径沿用同样的长连接纪律，否则切流后会出现跨副本 404。

## 退役时间表

| 里程碑 | 发行物 | 对外合同变化 |
|---|---|---|
| 2026-10-02 | `@tansr/serve` 0.13.0、`@tansr/protocol` 0.2.0、`@tansr/cli` 0.10.0 | `/api` 正式可用；装配 `/api` 的部署上 `/v1` 缺省关闭；预告 `/v2`、`/v3/*` 于 1.0.0 退役 |
| 2026-10-04 | `@tansr/serve` 0.14.0、`@tansr/cli` 0.10.1、`@tansr/api-client` 0.3.0 | manifest revision 7、三个请求头；`--legacy-v1` 标废弃 |
| 2026-10-06 | `@tansr/serve` 0.15.0、`@tansr/cli` 0.10.2、`@tansr/api-client` 0.4.0 | 步四告警已生效，缺省不拒绝；步五只读窗口可显式打开，缺省仍是 `readwrite`；旧前缀响应附 `Deprecation` / `Link`；冻结的 api-client 入口缺省改走 `/api` |
| 2026-10-10 | `@tansr/serve` 0.15.1、`@tansr/cli` 0.10.3 | 旧前缀窗口缺省仍是 `readwrite`；统一错误信封两处映射修正——矩阵未登记的域码一律 500 `internal_error`，`result_unknown` 的 `retryAction` 收敛为 `query-status` / `rebind`；manifest、路径与成功体不变 |
| 1.0.0 | `@tansr/serve` 1.0.0、`@tansr/api-client` 1.0.0 | 移除 `/v2`、`/v3/*` 外部入口，`/api` 成为唯一调用面；`unified-v1` 族由 `candidate` 转 `frozen`；`@tansr/api-client` 的 SDK1 入口标废弃，2.0 移除 |

`/v1` 关闭与 `/v2`、`/v3/*` 退役是两项独立的对外合同变更，各有各的发行说明。

## 成对回滚

- **服务端回滚必须与客户端成对。** 0.12.0 没有 `/api`：已切 `/api` 的客户端会收到旧形 404 且没有 `tansr-contract` 头，按纪律上报「合同不可用」而不会自动退回旧前缀。把服务端回到 0.12.0 时，Node 回到 `@tansr/api-client` 0.2.0 并改回旧入口，移动端回到上一发行物。
- **客户端可以单独回滚。** 0.13.0、0.14.0、0.15.0 与 0.15.1 在缺省 `readwrite` 下仍保留 `/v2`、`/v3/*`，旧客户端没有协议断层；这一点一直保持到 1.0.0 之前。显式把 `TANSR_SERVE_LEGACY_PREFIX` 设成 `readonly` 或 `off` 之后，旧客户端的写操作或全部旧前缀会按该模式被拒绝。
- 0.13.0 与 0.14.0 没有存储格式变化：会话 store、档案宿主、缓存介质在回滚中不需要迁移。0.15.x 的旧前缀窗口旋钮改回 `readwrite` 同样无数据变化。
- 反代模板与客户端切流必须同向：客户端已切 `/api` 而模板回滚，会丢失分片亲和。

## Node 客户端的入口迁移

`@tansr/api-client` 0.3.0 把 `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` 四个旧入口**冻结**（随包发布、不再增改、不删），新增 `./api`。迁移建议：

1. 新代码一律 `import { createApiClient } from '@tansr/api-client/api'`，用操作名调用，不再拼路径。
2. 旧入口的调用点按操作名逐个搬到 `api.call(...)`；档案 / 缓存 / 终端的 GET 读不必手填 `protocol` / `contract`，SDK 按操作注入缺省修订值。
3. 错误处理从族码改为统一码 + `retryAction`，必要时读 `error.domainCode`。
4. 同一进程、同一会话族里不要新旧入口并存——这正是步四要告警的「混用」。
