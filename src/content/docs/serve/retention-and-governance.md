---
title: 保留期与治理
description: 会话在 @tansr/serve 里活多久、什么时候被回收、存在哪、谁删——/v2 多会话治理表、/v1 终结记录保留窗、会话存储与冷层、以及可配置的存储保留期扫描。
zone: docs
category: serve
related:
  - serve/deploy-and-auth
  - serve/v2-and-webhooks
  - serve/env
  - sdk/checkpoints
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/.env.example
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-13'
---

一个会话在会话服务里有三种存在状态：**运行态**（内存里有驱动、有环形缓冲）、**终结残影**（轮已结束或已关闭，内存记录还在保留窗内可重放）、**休眠态**（只在 store 里，resume 可复活）。治理就是决定每种状态活多久、由谁回收。原则：**机器恒不物理删除业务主数据，除非运维显式配置。** 本页按 `@tansr/serve` 0.15.1（2026-10-10 发布，当前 npm `latest`）核对；治理表的冻结缺省自 0.8.0 以来未变，0.13.0 – 0.15.0 的加法单列于下文「0.13.0 – 0.15.0 的加法」；0.15.1 只含 Go / Rust / C++ 消费对照发现的四项服务端修复（设备绑定能力前置、工具实时输出、统一错误状态与重试动作映射、检查点恢复的材料结算），不改本页任何缺省。

## `/v2` 多会话治理表（冻结缺省）

| 参数 | 缺省 | 语义 |
|---|---|---|
| `retentionMs` | 30 min | 终结会话内存记录保留窗，到点逐出（重放责任移交 store） |
| `idleTimeoutMs` | 24 h | 闲置（无输入 / 无订阅活动）会话自动 close 落 store，resume 可复活；兜从未订阅过的 REST-only 会话 |
| `maxSessionsPerEndUser` | 8 | 每终端用户并发活跃会话帽，超限 `429 session_limit_exceeded` |
| `orphanGraceMs` | 60 s | 曾有订阅者又全部离场的会话，运行中的轮再跑多久被 interrupt（轮末 store 提交照走；webhook 按 `turn.aborted` 出站） |
| `idleAfterGoneMs` | 5 min | 订阅者离场后会话 idle 持续多久 close 落 store |
| `sweepIntervalMs` | 10 s | 治理扫描间隔 |
| `maxBodyBytes` / `mediaMaxBodyBytes` | 1 MiB / 20 MiB | 体帽 |
| `toolTimeoutMs` 缺省 / 帽 | 120 s / 600 s | 远程工具超时 |
| `permissionTimeoutMs` / `questionGraceMs` | 120 s / 60 s | 权限桥到点 deny-and-continue / 提问桥无订阅者宽限 |
| `eventBufferSize` | 1024 | 逐会话环形缓冲条数 |

三个**无冻结缺省**的治理位（缺省不设 = 无限；唯一例外见表后），数值随租户与容量决定：

| 目的 | 库选项 | 环境变量 |
|---|---|---|
| 终结残影数量帽（LRU 最旧先逐） | `v2.governance.maxRetainedSessions` | [`TANSR_SERVE_MAX_RETAINED_SESSIONS`](/serve/env#tansr_serve_max_retained_sessions) |
| 自纳管起的寿命帽 | `v2.governance.maxSessionLifetimeMs` | [`TANSR_SERVE_MAX_SESSION_LIFETIME_MS`](/serve/env#tansr_serve_max_session_lifetime_ms) |
| 轮数帽 | `v2.governance.maxTurnsPerSession` | [`TANSR_SERVE_MAX_TURNS_PER_SESSION`](/serve/env#tansr_serve_max_turns_per_session) |

例外：显式装配了 SDK2 执行 / 归档 / 缓存 / 同步 / 终端服务宿主（`@tansr/serve/extensions`，0.13.0 起）的服务，`maxRetainedSessions` 缺省改为 **256**——显式值优先，`0` = 终结即逐出；逐出只关闭内存重放窗，不删持久历史，有 store 时元信息 / history / resume 照走存储。只装 SDK1 的部署仍是缺省无限。

孤儿宽限与离场回收也可经 [`TANSR_SERVE_ORPHAN_GRACE_MS`](/serve/env#tansr_serve_orphan_grace_ms) / [`TANSR_SERVE_IDLE_AFTER_GONE_MS`](/serve/env#tansr_serve_idle_after_gone_ms) 调整。容量模型一句话：「挂着的会话数」≠「同时活跃数」——订阅者全部离场 60 s 后中止当前轮、再 5 min 后落盘退出内存，内存与 CPU 只随同时活跃的会话增长。

## 关闭 ≠ 删除

`DELETE /v2/sessions/:id`（经统一调用面即 `DELETE /api/sessions/:id`，语义与字节相同）是**关闭**：释放运行态与并发帽名额，内存记录进保留窗后逐出，**store 内容保留**，随时可 `resume`。真删除只发生在 store 级 `store.delete(endUserId, sessionId)`（热层目录 + 冷层对象级联消失），或下文的保留期扫描。给用户的「结束会话」按钮应当是 close，不是 delete。

## 会话存储：生产恒接

不接 `store` 的会话服务一重启，全部活跃会话的上下文全量灭失，客户端 `resume` 恒 `409 resume_unavailable`,`GET /v2/sessions/:id` 恒 404。这比「缓存重付」贵得多——重付只是重灌一次前缀，灭失是连重灌的机会都没有。

```ts
const store = createServeAgentSessionStore({ dir: STORE_DIR }); // <dir>/agent-sessions/<endUserKey>/sessions/<id>/
const build = createAgentSessionFactory({ platform, store, onStoreError, cwd });
await startServer({ v2: { authenticate, createSession: build.factory, store: build.storeReader } });
```

布局按终端用户物理分域：`endUserKey` 是 `endUserId` 的 sha256 前 16 hex（路径安全，不是身份）。每会话目录 `journal.jsonl`（活段，哈希链）+ `meta.json` + `attachments/`；长会话按阈值封段（缺省 16 MiB / 5000 记录）为 `segments/` + `manifest.json`。每 endUser 域旁挂 `index.jsonl` 供列表 O(1) 读，但**journal + meta.json 是唯一事实源**，索引损坏可随时重建。落盘失败不再只进日志：该会话事件流签发 `turn.error { scope: 'server.persistence', recoverable: true, errorKind: 'store_commit_failed' | 'store_create_failed' }`，端侧归入 notices；下一轮 commit 由持久闩强制整卷轮换补齐，客户端无需动作。

热层恒本地盘、**恒不共享目录**（共享盘是不安全配置，见[部署与鉴权](/serve/deploy-and-auth/)）。

## 冷层：把长会话历史接到对象存储

热层不可能配无限硬盘，所以 `createServeAgentSessionStore` 加了可选冷层：热层达到封段阈值后把这一截封成不可变的段对象（JSONL + gzip，首尾哈希链）上传到你挂的存储，再以 CAS 重写一份清单（唯一提交点）；已提交段可被热盘 LRU 逐出，读侧按需回源。不挂冷层 = 今日行为，字节等价；客户端零感知。

```ts
const store = createServeAgentSessionStore({
  dir: '/var/lib/tansr/hot',                                   // 热层:本地盘,恒不共享
  cold: createS3BlobStore({ bucket, region, credentials }),   // 一级 SegmentBlobStore(S3 / OSS / COS / MinIO / R2 / GCS …)
  policy: { tenant: 'acme', hotRetention: { maxBytes: 20 * 2 ** 30 } },
  logger,
});
```

一级适配器只需五个字节方法 `put / get / head / list / delete` + 一次能力自述，错误分四类 `transient / permanent / not_found / precondition_failed`；随包的 `createFsBlobStore({ dir })` 可作目录模拟对象存储（只可作冷层），`runStorageConformance(store)` 一致性测试套认证你的实现。仓内 `examples/store-s3` 是零依赖 fetch + SigV4 的参考实现。

要点：上传 / 清单提交失败**恒不回滚热层**（轮末已 ack 的历史耐久不变），按预算重试（缺省 8 次 / 退避封顶 60 s），超预算记 `store.commit_failed{ gaveUp: true }` 并经 `onStoreError` 通报，段留在热盘、下次对账补传；热盘触顶 `hotRetention.maxBytes` 时 `/readyz` 翻 503（理由 `store_hot_full`），LB 摘流，**未上传段恒不删**；热层全失（节点重建）后同一冷层重开 store，`GET /v2/sessions` 仍见会话，resume 经清单 → 段 → 重灌成功（只有已封存的段可恢复）。两条告警线：`tansr_kernel_store_backlog_bytes` 持续增长 = 冷层不可达；`tansr_kernel_store_hot_bytes` 逼近上限 = 即将拒新建。

冷层里的段是明文 JSONL（压缩）——加密、密钥管理、驻留地、访问控制归你（`policy.transform` 挂点），用生命周期规则按前缀 `<tenant>/<endUserKey>/<sessionId>/<volumeId>/` 承接保留窗。

## 存储保留期扫描

未配置保留期时，store **缺省永存**：休眠会话不会被服务端自动删除。**@tansr/serve 0.8.0 已提供**存储保留期治理：工厂选项 `sessions.retention{ maxAgeDays, maxPerEndUser, maxBytes }`（缺省缺席 = 零删除 = 现状），任一在场即启用治理扫描的「store 保留」段——按 `meta.updatedAt` 删超龄休眠会话（`maxAgeDays` 缺席按 30 d 兜底，与平台会话租约窗同值）、每终端用户超数时最旧先删（附件与同居快照随删），**在册活跃会话恒不删**；实扫间隔缺省 1 h，每轮有删除即记结构化日志 `session.retention_swept{ scanned, deleted, failures, byReason }`。对应两个环境变量 [`TANSR_SERVE_SESSION_MAX_AGE_DAYS`](/serve/env#tansr_serve_session_max_age_days) / [`TANSR_SERVE_SESSION_MAX_PER_END_USER`](/serve/env#tansr_serve_session_max_per_end_user)。控制台组织治理里配置的会话保留天数（`governance.sessionRetentionDays`）按终端用户域覆写该阈值。被删会话此后 resume → `404 session_not_found`，客户端按 L3 新建，端侧零改动。

## 0.13.0 – 0.15.0 的加法

以下各项只在对应装配在场时生效，**只装 SDK1 `/v1` 的部署与固定使用 `/v2` 的客户端缺省零变化**。

- **旧前缀退役窗口（0.15.0）**：`legacyPrefixes` / `TANSR_SERVE_LEGACY_PREFIX` 取 `readwrite`（缺省，截至 0.15.1 未变）/ `readonly` / `off`，只在 `/api` 门面在场时生效；`readonly` 下 `/v2`、`/v3/*` 的写操作改答 `410 gone`（`detail.domainCode: legacy_prefix_retired`），`off` 下旧前缀全部 404。它只决定旧入口受不受理，**不改变任何会话的保留窗、闲置回收或 store 内容**——被拒的写请求不触及会话，客户端改走 `/api` 后同一会话照常可见。旧前缀响应附 `Deprecation` / `Link`（设 `TANSR_SERVE_LEGACY_SUNSET` 后再附 `Sunset`）。细节见[部署与鉴权](/serve/deploy-and-auth/)。
- **三个请求头与回执缓存（0.14.0）**：`/api` 上的写操作接受 `Idempotency-Key`（ASCII 1–128；同键同义返原回执、副作用恰一次，同键异义 `409 conflict`；回执缓存进程内有界：每用户 256 条 / 全局 4 096 条 / TTL 10 分钟，按 `endUserId` + 操作名 + manifest revision 隔离）、`If-Match` + 响应 `ETag`（只对有版本资源，即 manifest 里带 `expectedRevision` 的写操作；版本陈旧 `412 precondition_failed`、`retryAction: refresh`，一字未写）、`deadline`（RFC 3339；到达时已过期 `408 invalid_request`、`reason: deadline_exceeded`，不受理、不触及下游、不占幂等窗）。三头不新增错误码，`detail.reason` 由 2 枚扩到 17 枚；三头需要体时请求体帽 1 MiB（超出 `413 payload_too_large`、`reason: header_body_limit`）。不携这三个头 = 行为逐字节不变。回执缓存是内存态、随进程消亡，不属于本页的持久化保留窗。
- **审批凭证投递改走 `/api`（0.14.0）**：`POST /api/approvals/:id/credential`（manifest revision 7 的 `approval.credential.submit`，内部径为 manifest 里唯一的 `/v1` 路径）；接审批投递的 `--v2` 部署不再需要 `--legacy-v1`。
- **会话所有权租约（0.14.0 修正）**：启用 `ownership` 的可信宿主在慢盘上不再「无对手却自判死亡」——owner 自身操作只按代际围栏判定、`expiresAt` 只决定他人接管资格、每次持锁 meta 写顺带续约；`ownership.leaseMs` 下限由 1 000 ms 抬到 **5 000 ms**（显式传 1 000–4 999 抛 `TypeError`，缺省 30 000 ms 与 `[5000, 300000]` 区间不变）。带 `runtimeRecovery` 的多 Serve 部署在病态慢盘上仍可能合法接管活 owner（活性损失，非双写），该窗口此前即存在。
- **设备 I/O 预算（0.14.0）**：`memoryFor(scope).deviceIoBudgetMs` 取值 1 000–120 000 ms，缺省 10 000 ms，只对绑定设备执行档的记忆读写生效。
- **SDK2 归档 / 缓存宿主的保留与删除（0.13.0 起，须显式装配）**：`@tansr/serve/extensions` 的归档宿主以「单一授权源 + 源确认落盘」策略保存会话档案，复制 / 同步策略恒 `'none'`——它不是备份，不替代本页的 store 与冷层；缓存宿主的条目由宿主以 `delete({ sessionId, authorization })` 显式删除，`dispose()` 只释放资源不删数据，已归档条目的续约回 `410`（终态）并以 `archived: 'cold-new'` 指示重建。SSE 单帧硬帽 `maxFrameBytes` 缺省 2 MiB（`TANSR_SERVE_SSE_MAX_FRAME_BYTES`）只在这些装配在场时生效。宿主装配方式见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。

## `/v1` 面的终结记录保留窗

`tansr serve` 长驻进程的 `/v1` 面缺省 **30 分钟保留窗 + 最多 10000 条终结记录**（超出按最早终结者先逐出）；到期或被逐出后该会话的 `events` / `messages` / `abort` 一律 `404 session_not_found`——编排方应在会话终结后 30 分钟内取完事件流，或自行持久化。`TANSR_SERVE_V1_RETENTION_MS`（毫秒）与 `TANSR_SERVE_V1_MAX_RETAINED`（条数）可调；取值 `0` 或 `off` = 该级不逐出；非法值静默回落缺省。以 npm 包嵌入时 `/v1` 缺省**不逐出**，由宿主经 `startServer({ v1: { governance } })` 选配。活跃会话恒不受影响。本节只对 `/v1` 面在场的部署成立：0.13.0 起 `--v2` / `options.v2` 在场的部署 `/v1` 缺省关闭，显式开启的 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` 自 0.14.0 起已标废弃（1.0.0 移除），见[部署与鉴权](/serve/deploy-and-auth/)。

## 与平台侧租约的关系

会话服务内存态短窗（保留窗 30 min、闲置 24 h）与平台注册表的 **30 天不活跃租约**层次分明：对话活动即隐式续租，到期归档后平台侧回 `410 session_archived`。终端侧可经 `GET /t1/sessions` 列自己的会话、`POST /t1/sessions/:id/renew` 显式续租、`DELETE /t1/sessions/:id` 归档——这些是平台面端点，与本文的 `/v2` 会话服务面互不替代。
