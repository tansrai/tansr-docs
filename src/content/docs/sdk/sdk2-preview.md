---
title: SDK 2.0 扩展入口：归档宿主、缓存宿主与统一 API
description: SDK 2.0 已随 @tansr/sdk 0.19.0、@tansr/serve 0.15.1、@tansr/api-client 0.4.0 正式发布的部分——`./extensions` 显式宿主、serve 可信宿主扩展、统一调用面 /api 与 api-client 的 ./api、./sdk2、./terminal 子入口；以及仍按「功能条件交付 + 延期披露」处理的性能门读数。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
  - sdk/platform-bundle
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - cli/settings-and-doctor
  - security
sources:
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/protocol/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/release/USDK-11-0.14.0批-发行说明-2026-10-04.md
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/release/REL-0.15.0批-发行说明-2026-10-06.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
  - tansr-cli:doc/release/REL-SEA-SEA渠道首发-回执-2026-10-05.md
  - tansr-cli:doc/report/PERF-01-正式测量-2026-10-04.md
  - tansr-cli:doc/report/SDK2-09-性能门时间盒-2026-10-01.md
lastVerified: '2026-10-15'
---

SDK 2.0 的目标是**统一核心与薄终端**：智能体循环、会话、上下文、记忆、权限、裁决、工具算法与用量仍由原 serve / kernel 提供；TypeScript、Kotlin、Swift、ArkTS 客户端只消费同一套会话与执行合同；平台只描述客户端事实。Electron 继续用原 `@tansr/sdk` 进程内集成，依赖、主进程与调用生态不变。本页只写**已随 npm 版本发布**的部分；页名沿用历史 slug `sdk2-preview`，内容已不是预览。

## 发布状态（2026-10-13 核对）

| 包 / 产物 | 版本 | 发布日 | SDK 2.0 相关内容 |
|---|---|---|---|
| `@tansr/sdk` | 0.18.0 → 0.18.1 → **0.19.0**（`latest`） | 2026-10-02 / 2026-10-04 / 2026-10-10 | 子入口 `@tansr/sdk/extensions`（41 快照项）：`createNodeArchiveHost`、`createNodeCacheHost`；根入口 9 项可选签名加法。0.18.1 的 `src` 零改动，随车只因 `./extensions` 发布物内容随 PERF-01 (c)(d) 变化。0.19.0 的加法全部在 `platform/*`（独立的非聊天操作客户端等，见[会话与事件流](/sdk/sessions-and-events/#0190-的加法)），`./extensions` 与本页两宿主零变化 |
| `@tansr/serve` | 0.13.0 → 0.14.0 → 0.15.0 → **0.15.1**（`latest`） | 2026-10-02 / 2026-10-04 / 2026-10-06 / 2026-10-10 | 子入口 `@tansr/serve/extensions`（98 项）与 `@tansr/serve/process`（6 项）；根入口 +18 显式远端执行档 / 可信宿主 / 空闲期配置类型与 `createServeLogger`；统一调用面 `/api` GA（manifest revision 6 → 7，81 操作）。0.15.0 加旧前缀退役窗口旋钮 `legacyPrefixes`（缺省 `readwrite`）、旧前缀响应 `Deprecation` / `Link` 头与跨前缀混用告警日志，`/api` 面与 manifest r7 零变化；0.15.1 为修复补丁（设备绑定前置、业务工具受控输出、统一错误映射、检查点恢复材料结算），缺省仍 `readwrite` |
| `@tansr/api-client` | 0.3.0 → **0.4.0**（`latest`；`next` 同指 0.4.0） | rc.1 2026-10-02 → GA 2026-10-04 / 2026-10-06 | 0.3.0 新增 `./api`（`unified-v1` 客户端）；首次随包 `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node`（冻结不删）。0.4.0 只改两冻结入口的**缺省路由表**为 `/api` 门面并还原经门面的各族错误体；`./api` 与根入口零变化，导出集 +0 / −0 / ~0 |
| `@tansr/protocol` | **0.2.0**（首个公开版本） | 2026-10-02 | 子入口 `./canonical`：控制 DTO 的 canonical 编解码单模块 |
| `tansr` 命令行 | 0.10.0 → 0.10.1 → 0.10.2 → **0.10.3** | 2026-10-02 / 2026-10-04 / 2026-10-06 / 2026-10-10 | `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>` 装配可信宿主模块；`--legacy-v1` 已标废弃。0.10.2 / 0.10.3 的 `packages/cli/src` 零改动，只是内嵌 `@tansr/serve` 升至 0.15.0 / 0.15.1（随之可用环境变量 `TANSR_SERVE_LEGACY_PREFIX` / `TANSR_SERVE_LEGACY_SUNSET`），无新命令或旗标 |
| Android / iOS / 鸿蒙 SDK | Maven Central **0.5.0** / 公开二进制 SPM **0.4.0** / HAR **0.2.0** | 2026-10-07 / 2026-10-09 / 2026-10-10 | 这三版只走 `/api`（manifest r7、统一码为主）；Android 0.4.0、iOS 0.3.0、HAR 0.1.0 仍走 `/v2`。见各端接入指南 |

SEA 单文件可执行自 2026-10-05 起经 OSS 渠道 `https://bash.tansr.com`（`stable` 通道，ed25519 签名清单）发布，首发为 0.10.1，现行清单为 **0.10.3**（2026-10-10），只含 `linux-x64` / `linux-arm64` 两件；Windows / macOS 单文件未上架，这两平台的命令行请经 npm 安装。随 SEA 发行的 git tag `v0.10.1` / `v0.10.3` 已推送远端，`v0.10.0` / `v0.10.2` 仍只本地留档。

## 不是什么

- 不是 `createSession` 的缺省开关：不 `import '@tansr/sdk/extensions'` 的代码零变化；Electron 完整 SDK / IPC 接线零变化。
- 不是备份、不是多设备同步：本地归档宿主的存储策略固定 `single-authorized-source` + `source-ack-with-durable-spool`，`replication` / `synchronization` 皆 `'none'`。
- 不是供应商缓存节费的证明：接口在场不等于已证明净节费（见本页末「性能与延期披露」）。
- 不改变 `/v2` 直连面的字节；`/api` 是新集成的调用面，旧前缀在 1.0.0 前仍可达，见下文。

## `@tansr/sdk/extensions`：进程内的两个显式宿主

### 本地归档宿主 `createNodeArchiveHost`

`createNodeArchiveHost(options)` 构造宿主本身不建库，`host.open({ mode: 'fresh' | 'resume', … })` 完成归档安装 / 恢复后返回**原 `AgentSession`**，首次 `open` 才初始化持久介质。归档与模型上下文分开启用：`archive.contextMaterials: true` 显式安装材料链，省略或 `false` 只保留归档交接。

- 读面有界：`readArchiveBinding` / `readArchiveStorageStrategy` / `readArchiveRecords({ afterSequence, limit, maxBytes })` / `readArchiveArtifact`（复核 SHA / MIME / 长度，单对象 32 MiB 帽）/ `readEffectiveContext`（仅空闲已安装会话的轮末有效上下文引用，不是防回滚凭证）/ `flushArchive`。
- 材料是「送达 ≠ 消费」：`requestMaterials` → 有界分块上传 → `received` 只证送达；`enqueueMaterials` 把原请求与 lease 交给下一查询屏障的唯一 ContextManager 核验代际、摘要覆盖与预算。完整档案不自动回灌，摘要覆盖的原文不因重开复活。
- 同轮插入：`inputCapabilities` / `getInputTarget` / `submitInput` / `getInputStatus`，不回落 cancel + send，语义与[任务进行中追加输入](/sdk/midturn-input/)一致。
- 可信外置图片源 `ArchiveAttachmentSource`：`describe` 同步给出登记时固定的 MIME / 字节数 / SHA256，`read` 受 `signal` / `maxBytes` 约束；URL 只是查表键，SDK 不自动 fetch，也不把地址变成文件 / 网络权限。

### 本地缓存宿主 `createNodeCacheHost`

平台令牌档经 `cacheHost.open({ mode: 'fresh' | 'resume', sessionId, session })` 取得原 `AgentSession`。须显式传原 `createFileSessionStore`、`applicationScopeId` / `endUserId` / `baseUrl`、`cache: { directory（绝对）, storeId（稳定）, key: { id, bytes（32 字节本地介质密钥，应用安全保存）}, mode: 'create' | 'recover' }` 与同步 `authorize`（对 `open / resume / cold-new / run / delete` 回非负十进制串 `authorizationRevision`，拒绝抛错）。

- `readCacheContinuity(sessionId)` 纯本地读逻辑缓存连续性，provider 命中 / usage / billing 无上游实报恒 `unknown`；`lookup` 只查已受理 / 已存响应，不当新轮执行。
- 跨运行接续：`continuity`（`NodeCacheContinuityBridge`）缺省同 runtime（`runtimePolicy` 省略或 `'preserve'`）；显式 `'renew-on-restore'` 才向持有**同一真实 Store**来源权威的受信后端取短期 grant，issuer 私钥不下终端，本地 vault key 不能替代。`410 session_archived` 为终态，只有显式 `archived: 'cold-new'` 且获当前授权才建独立新关系。
- 删除与关闭的顺序见[关闭会话与等待资源收尾](/sdk/lifecycle/)：全部宿主会话关闭排空 → `cacheHost.delete(...)` → `dispose()`。
- 0.18.1 随车变化（PERF-01 (c)(d)）：C2 热窗口的交换帧与在飞标记由两次 SQLite 事务改为一次，冷恢复时旧运行 binding 读与新运行心跳并行发出；调用面、错误码、帽值（128 控制 / 16 交换 / 4096 完成 / 64 MiB）零变化，已有缓存库无需转换。

### 根入口的 9 项可选签名加法（0.18.0）

`SessionStore.attachmentCheckpoints?` 等三项（见[检查点与恢复](/sdk/checkpoints/)）；`ToolContext.executionTarget?` / `turnId?` 与 `GateDecision.executionTarget?`（进程内恒缺席，见[会话与事件流](/sdk/sessions-and-events/#018x-的加法)）；`AppBundleModel.adapterDiagnostics?`、`AppCapabilitiesSchema` 的 `execution?` 段与 `CLIENT_FEATURES` 的 `'bound-device-v1'`（见[平台装配与 bundle](/sdk/platform-bundle/)）；`fetchAppBundle` 第 6 可选参 `requireCapabilities`。全部为可选键 / 可选尾参 / 常量词表加法，无运行时行为回退。

## `@tansr/serve/extensions`：可信宿主的显式装配

全部为**可信宿主显式装配**的扩展——不改根入口、不改 SDK1 缺省行为、`tansr serve` 命令行不自动开启。按功能群：

| 功能群 | 入口 | 要点 |
|---|---|---|
| 归档宿主 | `createServeArchiveHost({ security: 'trusted-single-application', … })` → `host.start(...)` 挂 `/v3/sdk2/**`（门面 `/api/archive/**`） | 受信单应用宿主，不是多租户隔离或不受信工具沙箱；`agent.store` 须是同一次安装同包根入口的原 Store；`rotateOperationEpoch` / `deleteSessionHistory` / `deleteArchiveRecords` / 保留介质授权回调 / `readEffectiveContext` / `closeOverlay` |
| 归档同步 | `startServeArchiveSync` → `/v3/sdk2/archive-sync/**`（门面 `/api/archive/sync/:id`） | `archive-sync-v1` 无码表，错误体本版仍透传原信封 |
| 显式卸载宿主 | `createServeOffloadArchiveHost` | 新客户端显式选 `sessionContract: 'sdk2-offload-v1'`（先查 `/api/capabilities/sessions`）；缺省 `sdk1` 不变；`rollbackEffectiveHistory` / `importEffectiveHistory` / `readEffectiveHistoryOrigin` |
| 缓存宿主 | `createServeCacheHost(options)` → `{ start, readInventory, dispose }` | 配置 / appKey / 加密钥 / 签发器只在可信服务进程保存；`/v3/sdk2/cache/**`（门面 `/api/cache/**`）；`readInventory()` 不含票据 / 正文 |
| 共享事务 Store | `createTransactionalServeAgentSessionStore` / `createMysqlAgentSessionTransactionBackend` | 与 `execution.spoolFor` 装配互斥；不替换原文件 Store，不在终端注入数据库依赖。0.14.0 起 `leaseMs` 下限 1000 → 5000（1000–4999 抛 `TypeError`；缺省 30000） |
| 记忆生命周期与发布介质 | `createPlatformMemoryLifecycle`、`createSqliteMemoryPublicationStore` 等 | 终端只保管 publication，核心运行提取 / 固化 / 检索 / 晋升；0.14.0 起 `memoryFor(scope)` 可回 `deviceIoBudgetMs`（1 000–120 000 ms，缺省 10 000） |
| 终端合同锚 | `TERMINAL_CONTRACT_SCHEMA_REVISION` / `TERMINAL_CONTRACT_SCHEMA_SHA256`、`clientToolDefinitionDigest` | C# / Android / iOS / 鸿蒙按精确哈希消费 |

根入口的显式远端执行档 `AgentExecutionOptions`（`applicationScopeId` / `authorize` / `readPolicy` / `spoolFor` 必填）经 `createAgentSessionFactory({ platform, execution })` 接线：缺省限额全局 256 执行器连接 / 512 会话、每用户 16 / 8，越界 `429 capacity_exceeded`；远端 Shell 须应用 `execution.boundDevice.tools.shell` + 具名策略 + 设备 `process.exec` 后端 + 可信 `confirmInterpreter` 四者同时在场。未配置 `execution` 的旧接入路径零变化。命令行形态经 `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>` 装配同一类可信宿主模块（≤ 16 MiB、`.cjs`、导出 `(context) => { agent, authenticate, terminal?, v2?, resources? }`），见[部署与鉴权](/serve/deploy-and-auth/)与[配置与 doctor](/cli/settings-and-doctor/)。

`@tansr/serve/process`（`installProcessGuards` / `ProcessGuardOptions` / `LOG_EVENT` / `ServeLogger`）是与根出口同一实现的窄出口，导入不装配 HTTP / 会话 / 平台运行时；自托管宿主可把 `import { installProcessGuards } from '@tansr/serve'` 改为 `'@tansr/serve/process'` 以减少启动导入，根入口照旧可用。

## 统一调用面 `/api` 与 `@tansr/api-client` 0.4.0

`@tansr/serve` 0.13.0 起 `options.v2` 在场的部署链首装配门面：`/v2/sessions/**` → `/api/sessions/**`、`/v3/sdk2/bindings/**` → `/api/archive/bindings/**`、`/v3/sdk2/cache/**` → `/api/cache/**`、`/v3/terminal*/**` → `/api/terminal/**`；领域 payload 字节不变，全部 `/api/*` 响应携 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 四头，≥ 400 的 JSON 错误统一为 19 码 / 6 `retryAction` 的信封。0.14.0 起 `/api` 读取三个请求头 `Idempotency-Key` / `If-Match`+`ETag` / `deadline`，manifest revision 7 新增操作 `approval.credential.submit`（`POST /api/approvals/:id/credential`）。

- `/v1` 单租户面在门面在场的部署**缺省关闭**（0.13.0 起）；过渡旋钮 `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` 自 0.14.0 / 命令行 0.10.1 起标废弃、1.0.0 移除。
- `/v2`、`/v3/*` 自 0.13.0 定义为**内部适配入口**；0.14.0 … 0.15.1 未移除任何路由、未进入只读窗口，响应体与状态码字节不变。0.15.0 起有退役窗口旋钮 `StartServerOptions.legacyPrefixes: 'readwrite' | 'readonly' | 'off'`（缺省 `readwrite`；环境变量 `TANSR_SERVE_LEGACY_PREFIX`），`readonly` 让 manifest 登记为 `write` 的 38 个操作在旧前缀答 `410 gone` 统一信封、`off` 全部答 `404 not_found`；门面在场时旧前缀的每个响应附 `Deprecation` / `Link` 头（设置 `legacyPrefixSunset` / `TANSR_SERVE_LEGACY_SUNSET` 后再附 `Sunset`），同一会话跨前缀混用记 `api.legacy_prefix_mixed` 告警日志。缺省何时切为 `readonly` 以各版 CHANGELOG 为准，本页不作预告；1.0.0（`unified-v1` 冻结）移除外部入口。新集成直接用 `/api`。
- `@tansr/api-client/api`：`createApiClient({ baseUrl, token | authorize, … })` → `manifest()` / `capabilities()` / `sessionCapabilities(id)` / `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })` / `events(name, …)`；操作目录 `API_OPERATIONS`（81 项，自 manifest r7 生成，每条携 `etagPath` / `expectedRevision` / `requestIdPath`）；`ApiError` / `ContractUnavailableError`；事件包络严格 7 键。`./sdk2` 与 `./terminal` 是冻结的旧前缀客户端：0.4.0 起不传 `routePrefixes` 时**缺省打 `/api` 门面**（`API_FACADE_ROUTE_PREFIXES`，会话客户端随附 `tansr-session-family` 头），要求服务端 `@tansr/serve ≥ 0.13.0` 且门面在场，对无门面的服务端报 `invalid_response` 而不静默退回旧前缀；仍要打旧前缀的调用方显式注入 `routePrefixes: LEGACY_ROUTE_PREFIXES`（请求字节与 0.3.x 逐一相同）。经门面的各族错误体按统一信封还原为原族 `status` / `code` / `retryAction`。
- 弃用预告：`unified-v1` 冻结（1.0.0）时 `./api` 升 1.0.0，SDK1 根入口标 deprecated，2.0 移除；弃用至少给一个 minor 的窗口。

路由表、发现与会话级围栏、统一头与错误信封的完整说明见[统一 API](/unified-api/)与[统一 API 的请求头与错误信封](/unified-api/headers-and-errors/)；错误处置的 SDK 侧写法见[错误处理与重试](/sdk/errors-and-retries/#经-api-时的统一错误信封)。

## 性能与延期披露（如实登记，阈值未改）

SDK 2.0 的性能门按「功能条件交付 + 明确延期披露」处理（SDK2-09，用户授权代拍 D12 转 B）：功能已交付、缺省关闭 / 显式 opt-in 不变，**不改称外部依赖、不改阈值、不改称通过**。最新正式读数为 PERF-01 正式测量（2026-10-04，空闲窗口，基线 / 候选各三有效组取中位）：

| 门 | 阈值 | 正式读数 | 结论 |
|---|---|---|---|
| 命令行 TUI 可输入（USDK-08） | < 300 ms | 热缓存 **287 ms**（首跑 361 ms、关编译缓存 348 ms 为披露项） | **通过**（余量 13 ms）；首跑 / 关缓存不过门、只披露 |
| 32 KiB 映射常驻 | 每映射 ≤ 32,768 B 且下界 ≥ 0 | 每映射剔常数 heap [−71,306, +7,144] B（区间跨零 → `unknown`）；常数项 heap 1,856,065–1,866,497 B，在 2 MiB 棘轮内（披露项，非设计帽） | **门不转绿**，SDK2-09 B 披露不变 |
| 缓存局部 P95（short-text hot / cold-restore hot / cold-restore cold） | ≤ 10 / 10 / 50 ms | **24.9 / 24.2 / 174.9 ms**（相对同窗基线改善 −5.0 / −2.0 / −40.0 ms） | **仍红** |
| 1record / 1KiB 同步压力档 | ≤ 2×（且相对 SDK2-09 不劣化） | 比值中位 11.3×（基线 11.0×；SDK2-09 2026-10-01 为 10.3–12.4×） | **仍红**，不劣化 |
| 热窗口耐久 COMMIT（PERF-01 (c)） | 应为 1（原 2） | **1** | 通过 |

供应商缓存净节费未证明（原 17 h 实账 175.32 元覆盖 2 263 次尝试，840 矩阵 239 pass / 601 fail 为历史终态）。命令行 0.10.1 起（现行 0.10.3）的 Node 编译缓存（`TANSR_COMPILE_CACHE`）是 TUI 门通过的依赖之一，首次启动每版本约 2 MB 磁盘缓存，见[配置与 doctor](/cli/settings-and-doctor/)。
