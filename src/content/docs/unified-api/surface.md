---
title: 调用面、领域与操作目录
description: /api 下的 9 个领域、manifest revision 7 的 11 个族与 81 个操作（读 39 / 写 38 / 流 4）、操作命名与路径模板、查询串里的修订标识、会话族请求头，以及哪些路径不属于 /api。
zone: docs
category: unified-api
sidebar:
  order: 2
related:
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
sources:
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/src/api/route-table.ts
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
lastVerified: '2026-10-13'
---

`/api` 的全部可调用面由一份机器可读的能力清单（manifest）定义：每个操作有稳定的名字、HTTP 方法、路径模板、允许的查询键和读 / 写 / 流分类。官方客户端的路径模块都是从这份清单生成的，本页把其中与「怎么调」有关的事实摊开。

## 装配条件与前缀

- `/api` 随 `/v2` 会话面一起装配：库形态 `startServer({ v2: … })`，CLI 形态 `tansr serve --v2`（或 `TANSR_SERVE_V2=1`）。只开 SDK1 的 `tansr serve`（无 `--v2`）没有 `/api`。
- `/api` 是唯一的公开前缀。`/v2`、`/v3/sdk2`、`/v3/terminal`、`/v3/terminal-observation`、`/v3/terminal-profile` 仍在进程内，只作内部适配入口，1.0.0 移除外部可达性；见[迁移与退役时间表](/unified-api/migration/)。
- `/healthz`、`/readyz`、`/metrics` 不在 `/api` 下，也不受本合同约束；部署面见[部署与鉴权](/serve/deploy-and-auth/)。
- 路径参数在服务端按百分号编码解码后再匹配；无法解码的段按不存在的资源处理（404 `not_found`），不会泄露内部路径。

## 9 个领域

| 领域（`tansr-domain`） | 操作数 | 覆盖 | 所属族 |
|---|---|---|---|
| `discovery` | 3 | manifest、全局能力、会话级能力围栏 | `unified-v1` |
| `session` | 26 | 会话生命周期、消息、事件流、工具 / 权限 / 提问应答、快照、音频、输入、审批凭据 | `agent-session-v1` |
| `execution` | 9 | 执行初始化与边界、执行绑定、执行器注册 / 心跳 / 领取 / 回执 | `sdk2-ext-v1` |
| `archive` | 16 | 档案绑定、档案状态与记录、ACK 提交与重定基、材料响应与上传 | `sdk2-ext-v1`、`sdk2-archive-recovery-v1` |
| `archive-sync` | 1 | 档案同步 | `archive-sync-v1` |
| `cache` | 10 | 缓存绑定的打开 / 续期 / 重绑 / 轮换 / 关闭、诊断 | `sdk2-cache-v1`、`sdk2-cache-core-v1` |
| `terminal` | 12 | 终端绑定、执行器事件流、输出批次与观察、会话配置与记忆 | `terminal-services-v1` |
| `terminal-observation` | 2 | 资源与输出关联查询 | `terminal-observation-v1` |
| `terminal-profile` | 2 | 画像目录与用量 | `terminal-profile-v1` |

领域是 `/api` 层的概念，用于响应头 `tansr-domain`、错误矩阵分族与能力围栏；族（family）是领域子合同的版本单位。manifest revision 7 共 11 个族（上表 10 个加上尚无 `/api` 入口的 `terminal-shell-sandbox-v1`），各族的 `status` 字段标明成熟度：`agent-session-v1` 为 `frozen`，`sdk2-ext-v1` 为 `final`，`unified-v1` 与 `terminal-services-v1` 为 `candidate`，`sdk2-cache-v1` 为 `drafted`，其余为 `additive`。

## 操作命名与路径模板

操作名形如 `领域.资源.动词`：`session.message.send`、`archive.binding.create`、`cache.binding.renew`、`terminal.output.observe`。路径模板用 `:id`、`:targetId`、`:ticketId`、`:uploadId` 占位，客户端严格填充——缺参、多参、空段、未编码的 `/` 都应在本地拒绝。少数操作有别名（例如 `terminal.configuration.read` 同时接受 `/api/terminal/sessions/:id/configuration` 与 `/api/sessions/:id/configuration`），别名只是兼容入口，生成的客户端一律用主路径。

下面是各领域的代表性操作（完整 81 条以 manifest 为准）：

| 操作 | 方法与路径 | 类型 |
|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | 读 |
| `discovery.capabilities` | `GET /api/capabilities` | 读 |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | 读 |
| `session.create` | `POST /api/sessions` | 写 |
| `session.get` | `GET /api/sessions/:id` | 读 |
| `session.message.send` | `POST /api/sessions/:id/messages` | 写 |
| `session.events.observe` | `GET /api/sessions/:id/events` | 流 |
| `session.interrupt` | `POST /api/sessions/:id/interrupt` | 写 |
| `session.tool.result` | `POST /api/sessions/:id/tool-results/:targetId` | 写 |
| `session.permission.decide` | `POST /api/sessions/:id/permission/:ticketId` | 写 |
| `session.question.answer` | `POST /api/sessions/:id/questions/:ticketId` | 写 |
| `session.checkpoint.create` | `POST /api/sessions/:id/checkpoints` | 写 |
| `session.close` | `DELETE /api/sessions/:id` | 写 |
| `approval.credential.submit` | `POST /api/approvals/:id/credential` | 写 |
| `execution.binding.create` | `POST /api/sessions/:id/execution-bindings` | 写 |
| `executor.register` | `POST /api/executors/connections` | 写 |
| `executor.operations.poll` | `GET /api/executors/:id/operations` | 读 |
| `archive.binding.create` | `POST /api/archive/bindings` | 写 |
| `archive.binding.get` | `GET /api/archive/bindings/:id` | 读 |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | 流 |
| `archive.records.read` | `GET /api/archive/bindings/:id/archive/records` | 读 |
| `archive.ack.commit` | `POST /api/archive/bindings/:id/archive/acks` | 写 |
| `archive.ack.rebase` | `POST /api/archive/bindings/:id/archive/ack-rebases` | 写 |
| `material.upload.chunk` | `POST /api/archive/bindings/:id/materials/:targetId/uploads/:uploadId/chunks` | 写 |
| `archive.sync` | `POST /api/archive/sync/:id` | 写 |
| `cache.binding.open` | `POST /api/cache/bindings` | 写 |
| `cache.binding.renew` | `POST /api/cache/bindings/:id/renew` | 写 |
| `cache.diagnostics` | `GET /api/cache/bindings/:id/diagnostics` | 读 |
| `terminal.binding.create` | `POST /api/terminal/bindings` | 写 |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | 流 |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | 流 |
| `terminal.configuration.commit` | `POST /api/terminal/sessions/:id/configuration` | 写 |
| `terminal.memory.command` | `POST /api/terminal/sessions/:id/memory/commands` | 写 |
| `terminal.observation.resources` | `GET /api/terminal/observation/sessions/:id/resources` | 读 |
| `terminal.profile.usage` | `GET /api/terminal/profile/sessions/:id/usage` | 读 |

读 / 写 / 流三类的区别不只是方法：只有**写**操作接受 `Idempotency-Key`，只有 manifest 里登记了 `expectedRevision` 的 9 个写操作接受 `If-Match`，只有 4 个**流**操作参与事件包络协商。见[统一请求头、响应头与错误信封](/unified-api/headers-and-errors/)与[事件流与统一事件包络](/unified-api/events/)。

## 查询串里的修订标识

领域子合同的修订号不走路径，而走查询串，且只在 **GET 操作（读与流）**上出现：

| 领域 | 查询键 | 取值 |
|---|---|---|
| `execution`、`archive` 的 GET 读与流，以及 `session.capabilities`（`GET /api/capabilities/sessions`） | `protocol` | `sdk2-ext-v1` |
| `cache` 的 GET 读 | `protocol` | `sdk2-cache-v1`；`cache.core.diagnostics` 用 `sdk2-cache-core-v1` |
| `terminal`、`terminal-observation`、`terminal-profile` 的 GET 读与流 | `contract`、`sessionContract` | `terminal-services-v1` / `terminal-observation-v1` / `terminal-profile-v1`；`sessionContract` 指会话所属族 |

三条规则：

- 写操作不接受查询键（唯一例外是 `session.checkpoint.import` 的可选 `label`）；三个发现端点、`GET /api/capabilities/archive`、`GET /api/capabilities/cache` 同样不接受；多余的键一律 400 `invalid_request`。
- 带了 `protocol` 但值不是该操作登记的修订（例如 `protocol=sdk2-ext-v0`）→ 400 `protocol_mismatch`。
- 每个操作允许的查询键是封闭白名单（例如 `archive.records.read` 允许 `protocol`、`historyEpoch`、`deletionGeneration`、`projectionRevision`、`limit`、`maxBytes`、`afterSequence`），白名单之外的键同样 400。

`@tansr/api-client/api` 会按操作所属族自动注入 `protocol` / `contract` 的缺省值（显式传入的值优先），你只需要传业务查询键。

## 会话族

会话有两个族：`sdk1`（内核在会话服务进程内运行）与 `sdk2-offload-v1`（执行卸载到绑定的终端执行器）。旧前缀用不同路径区分它们；`/api` 下路径相同，由请求头 `tansr-session-family: sdk1 | sdk2-offload-v1` 声明。不带这个头时服务端取部署的首选族，首选族与可用族可从 `GET /api/capabilities` 响应的 `domains.session.family.preferred` / `available` 读到。词表外的值 → 400 `invalid_request`；词表内但本部署未装配的族 → `capability_unavailable`（`detail.reason: not_installed`）。

## 不在 `/api` 里的东西

- `/v1` 的六条单租户路由（`/v1/status`、`/v1/sessions` 族等）不在操作目录内，`/api` 下也没有对应物；`approval.credential.submit` 是唯一一条从 `/v1` 迁入 `/api` 的操作。装配了 `/api` 的部署上 `/v1` 缺省关闭，详见[迁移与退役时间表](/unified-api/migration/)。
- 平台侧接口（`/t1/*`、`/v1/app-tokens`、`/v1/my-usage` 等）由 manifest 的 `platformApi` 字段只读引用，宿主是平台而不是你的会话服务。
- Electron 完整 SDK 与 IPC 模式不经 `/api`。
