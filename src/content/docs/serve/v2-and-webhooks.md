---
title: v2 协议与 webhook
description: /v2 会话面的 21 个端点与错误信封、SSE 帧形与 Last-Event-ID 重放、远程工具与权限 / 提问双桥、三级恢复链，以及轮末出站 webhook 的载荷、签名与投递纪律。
zone: docs
category: serve
related:
  - sdk/system-prompts
  - getting-started/serve
  - serve/deploy-and-auth
  - serve/retention-and-governance
  - serve/env
  - errors/codes
  - android
  - ios
  - sdk/sdk2-preview
sources:
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/.env.example
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-android:README.md
lastVerified: '2026-10-15'
---

`/v2` 是 `@tansr/serve` 的多会话协议面：SSE 下行、POST 上行，内核事件直接下发、由客户端归约。更早的公开包（Android 0.4.0 及以前、iOS 0.3.0、鸿蒙 HAR 0.1.0）封装的正是这套协议；Android 0.5.0、iOS 0.4.0、鸿蒙 HAR 0.2.0 起只走 `/api`。如果你自己写客户端，或者要接服务端半场的 webhook，这一篇是你需要的全部事实。本页按 `@tansr/serve` 0.15.1（2026-10-10 发布，当前 npm `latest`）核对；`/v2` 的端点、载荷与 SSE 帧字节自 0.9.0 以来未变，0.15.0 起只在响应头上多了退役标记（见下段）。

**新集成请改走统一调用面 `/api`**（`@tansr/serve` 0.13.0 起 GA，2026-10-02 发布）：同一组会话操作在 `/api/sessions/**` 上可达，领域载荷字节不变，但错误改为统一信封、响应携统一头，并有 manifest 与会话级能力围栏可供发现。`/v2` 自 0.13.0 起定义为**内部适配入口**，至 1.0.0（`unified-v1` 冻结）移除外部入口；截至 0.15.1 没有移除任何 `/v2` 路由。0.15.0 起旧前缀有了退役窗口旋钮 `legacyPrefixes` / `TANSR_SERVE_LEGACY_PREFIX`：缺省 `readwrite`（0.15.1 未变）读写照常受理；显式 `readonly` 时 `/v2` 上 manifest `kind: write` 的操作改答 `410 gone` 统一信封（`detail.domainCode: legacy_prefix_retired`、`retryAction: rediscover`），读与事件流仍受理；`off` 时旧前缀全部 404。门面在场时 `/v2` 的每个响应（含 SSE）另附 `Deprecation: @1790900340` 与 `Link: </api/manifest>; rel="deprecation"`（配置了 `TANSR_SERVE_LEGACY_SUNSET` 再附 `Sunset`），`readwrite` 下响应体与状态码逐字节不变；同一会话 id 在 `/api` 与 `/v2` 之间交叉访问会记一条 `api.legacy_prefix_mixed` 告警，缺省不拒绝。本页下文的 `/v2` 事实在外部入口移除之前继续成立，只是请不要在新代码里手写 `/v2` 前缀，也不要在同一会话族里新旧前缀混用。`/api` 的路由表、统一头与错误信封见[统一 API](/unified-api/)与[统一 API 的请求头与错误信封](/unified-api/headers-and-errors/)。

## 在平台或宿主配置应用角色

移动端的系统提示词在平台应用配置或 serve 宿主中设置，不放入 `/v2` 的 `prompt`。省略 `platform.system` 使用平台默认；代码管理的业务段放 `platform.system`，宿主补充说明放 `platform.systemAppend`。默认 `fallback` 允许显式业务段（包括 `[]`）替代平台段；`prepend` 保留平台段在前，即使 SDK 段是 `[]`。

这些选项自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线。它们只控制文本组合，不替代权限。平台提示词与策略在后续新一轮前刷新，当前执行轮保持既有配置；已有会话、attach 和历史可继续使用，无需为了改角色重开会话。参见[应用系统提示词与 SDK 拼接策略](/sdk/system-prompts/)中的 serve 完整示例。

## 总纪律

- `/v2`、`/api` 与（若开启的）`/v1` 同进程同端口；`/v1` 与 `/v2` 两面身份体系互不相通。**`/v1` 单租户面在装配了 `/api` 门面的部署（`options.v2` 在场）缺省关闭**（`@tansr/serve` 0.13.0 起，对外契约变更）：`/v1/sessions*`、`/v1/status`、`/v1/approvals/:id/credential` 缺省 404。确需保留的部署显式 `disableV1: false`（npm 嵌入形）或 `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1`（命令行形态）——该过渡旋钮自 0.14.0 / 命令行 0.10.1 起**已标废弃、1.0.0 移除**，显式开启时出一条结构化 `warn` 事件 `server.deprecated_option`（字段 `option` / `env` / `source: flag|env` / `deprecatedSince: "0.14.0"` / `removal: "1.0.0"` / `replacement: "approval.credential.submit"` / `replacementPath`）。0.13.0 时接审批凭证投递的 `--v2` 部署还须 `--legacy-v1`；0.14.0 起 manifest revision 7 新增 `approval.credential.submit`（`POST /api/approvals/:id/credential`），不再需要。只装 SDK1 `/v1`、不带 `/v2` 的部署不受影响，`/v1` 保留至独立退役项。健检一律改走免 Bearer 的 `/healthz` `/readyz`，不要再探 `GET /v1/status`。
- 错误信封恒 `{ "error": { "code": "<机器码>", "message": "<本地化文案>", "detail"?: {…} } }`。`code` 稳定可判，`message` 不承诺字面，`detail` 是可选结构化位，在场才落键。经 `/api` 调用时同一错误改为统一信封 `{ contract: 'unified-v1', code, status, retryAction, detail: { domainCode, domainStatus, … } }`，本页的 `code` 落在 `detail.domainCode`；`/v2` 直连面的错误体字节不变。
- 载荷演进：请求端未知键忽略；响应端新增键不通知；客户端对未知事件类型与未知字段恒容忍。
- 体帽：缺省 1 MiB；`messages` 与 `tool-results` 两端点 20 MiB；快照导入与音频两端点 32 MiB。超限恒 `413 payload_too_large`。

## 端点全形

| 方法与路径 | 作用 | 成功响应 |
|---|---|---|
| `POST /v2/sessions` | 创建 / attach / resume / fork | 新建 `201 { sessionId, resumed: false, lastSeq: 0 }`;attach（目标仍活跃）`200 { …, lastSeq: <水位> }`;resume 重灌 `201 { …, resumed: true, lastSeq: <新纪元起点水位> }`（0.8.x 恒 `0`;按值续传见下文「`lastSeq` 的值语义」）;fork `201 { …, lastSeq: 1 }` |
| `POST /v2/sessions/:id/messages` | 注入输入 | `202 { sessionId, accepted: true }` |
| `GET /v2/sessions/:id/events` | SSE 事件流 | `200 text/event-stream` |
| `POST /v2/sessions/:id/interrupt` | 中断当前轮（幂等） | `202 { sessionId, accepted: true }` |
| `DELETE /v2/sessions/:id` | 关闭会话（store 内容保留，可 resume） | `202 { sessionId, accepted: true }` |
| `GET /v2/sessions/:id` | 元信息与恢复锚 | `200 { sessionId, endUserId, status: 'running' \| 'idle' \| 'ended', live, lastSeq, createdAt, lastActivityAt, title? }`;休眠会话（`live: false`）的 `lastSeq` 是 store 落盘的真值水位（0.8.x 恒 `0`） |
| `GET /v2/sessions` | 列会话（`?limit=1–200&offset=`） | `200 { sessions: [...], total }` |
| `GET /v2/sessions/:id/history` | 治理后历史快照（`?offset=&limit=` 分页） | `200 { sessionId, lastSeq, messages, total?, offset?, nextOffset? }` |
| `POST /v2/sessions/:id/tool-results/:callId` | 远程工具应答 | `200 { accepted: true }` |
| `POST /v2/sessions/:id/permission/:requestId` | 权限应答（`{ digest, verdict: 'allow' \| 'deny' }`） | `200 { accepted: true }` |
| `POST /v2/sessions/:id/questions/:requestId` | 提问应答（`{ answers: [...] }`） | `200 { accepted: true }` |
| `POST /v2/sessions/:id/compact` | 手动压缩（空闲期） | `200 CompactResult`（三形之一） |
| `GET / POST /v2/sessions/:id/checkpoints` | 列举 / 手动快照 | `200 { checkpoints }` / `201 CheckpointMeta` |
| `POST /v2/sessions/:id/checkpoints/:cid/restore` | 自快照就地换史 | `200 { status: 'restored', fromMessages, toMessages, … }` |
| `DELETE /v2/sessions/:id/checkpoints/:cid` | 删除快照 | `204` |
| `GET /v2/sessions/:id/checkpoints/:cid/export` · `POST /v2/sessions/:id/checkpoints/import` | 快照导出 / 导入（自包含字节） | `200 application/octet-stream` / `201 CheckpointMeta` |
| `POST /v2/sessions/:id/cwd` | 会话工作目录中途切换（空闲期；须宿主配 `cwdPolicy`） | `200 { cwd, from }` |
| `POST /v2/sessions/:id/audio/transcriptions` · `POST /v2/sessions/:id/audio/speech` | 音频直连（服务端代打平台语音面，不进历史不签事件） | `200 TranscriptData` / `200 SpeechData` |

创建请求的关键可选键：`prompt`、`model`、`tools`（只减不增的白名单）、`clientTools`（远程工具申报，见下）、`capabilitiesProfile`（服务端持档名，内置 `mobile-default`）、`thinking: { budget }`、`cwd`（绝对路径；缺省无策略 = 不接受）、`resume: { sessionId }`、`fork: { sessionId, checkpointId }`（与 resume 互斥）。`endUser: { id }` 可省略，在场且与鉴权产物不符即 403。`messages` 支持 `{ prompt }` 或 `{ blocks: [{ t: 'text', text } | { t: 'image', mime, data }] }`，二选一；运行中注入 `blocks` 恒 `422 midturn_blocks_rejected`。

`mobile-default` 档的工具上界是移动应用可勾选的全集：TodoWrite、AskUser、WebFetch、Http、WebSearch 与四个媒体工具（WebFetch / Http 自 `@tansr/serve` 0.12.0 起纳入）；`customTools` 位走 `clientTools` 独立通路。实际装配再与应用能力位取交集，创建请求里的 `tools` 白名单只能继续收窄。能力位改动只对新建会话与从 store 重新装配的会话生效，活动会话的工具表不因换票或提示词刷新而改变，紧急撤回须停止对应会话。WebFetch / Http 在本服务主机上执行：托管 Http 不能引用宿主环境变量里的凭据，也不能解除宿主的私网上限；配了出网代理，须在代理侧同样限制私网目标。详见[移动应用的公网工具](/sdk/platform-bundle/#移动应用的公网工具)。

`GET /v2/sessions/:id?include=applicationPrompt`（0.13.0 起）才返回 `applicationPrompt` 只读摘要（来源 / 策略，不含正文）；其它 `include` 值 400。

### 其它前缀：`/v3/*` 与 `/api`

`@tansr/serve` 0.13.0 起随包的 `@tansr/serve/extensions` 可信宿主扩展在 `/v3/sdk2/**`（归档 / 卸载会话族 / 缓存）与 `/v3/terminal*/**`（终端服务：会话配置、记忆管理、执行器与观测）上挂路由，全部须宿主**显式装配**，`tansr serve --v2` 不自动开启；`/v3/*` 与 `/v2` 一样定义为内部适配入口，门面对应物为 `/api/archive/**`、`/api/cache/**`、`/api/terminal/**` 与会话作用域别名 `/api/sessions/:id/{memory,configuration}`。装配方式见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)与[部署与鉴权](/serve/deploy-and-auth/)。

## 错误码

| code | HTTP | 场景 |
|---|---|---|
| `unauthorized` | 401 | `authenticate` 缝返回 null |
| `forbidden` | 403 | endUser 归属不符（含 resume 他人会话） |
| `session_not_found` | 404 | 会话不在内存也不在 store |
| `session_ended` | 409 | 向终态会话注入输入 |
| `session_limit_exceeded` | 429 | 每终端用户活跃会话超帽（缺省 8）；携 `Retry-After` |
| `resume_unavailable` | 409 | 服务端未接 store 却请求 resume |
| `create_failed` | 400 | 装配失败（未知别名等）；重试无益 |
| `validation_failed` / `invalid_json` / `payload_too_large` | 400 / 400 / 413 | 载荷问题 |
| `turn_running` | 409 | 空闲期端点在轮进行中被调用；不排队，空闲后重试 |
| `checkpoints_not_wired` / `checkpoint_not_found` / `session_mismatch` | 409 / 404 / 409 | 快照面 |
| `cwd_not_allowed` / `cwd_invalid` / `cwd_unavailable` | 400 / 400 / 409 | 工作目录被策略拒 / 形态非法 / resume 时存储目录已失 |
| `overloaded` | 503 | 本机准入或过载拒绝；恒携 `Retry-After` |
| `draining` | 503 | 服务端优雅关闭期；恒携 `Retry-After`，在场 SSE 同时收到长 `retry:` 帧 |
| `upstream_unavailable` | 503 | 平台铸令牌 / 配置拉取暂不可用；恒携 `Retry-After`。0.9.0 起音频直连两端点的上游 401 / 403 / 5xx / 网络故障也收敛到此码（业务 4xx 如 `asr_not_configured` 仍原样透传；上游状态与原文只进结构化日志事件 `upstream.rejected`） |
| `rate_limited` | 429 | 宿主限流缝拒绝，或平台套餐配额（`detail: { scope: 'plan' }`）；恒携 `Retry-After` |
| `internal_error` | 500 | 路由层统一错误边界兜底，进程恒不退出 |
| `store_corrupted` | 500 | 会话存储损坏，恒不静默回残缺历史 |
| `gone`（统一信封，非 `{ error }` 形；原因在 `detail.domainCode: legacy_prefix_retired`） | 410 | 仅 0.15.0 起显式 `TANSR_SERVE_LEGACY_PREFIX=readonly` 时 `/v2` 上的写操作；缺省 `readwrite` 不出现。`retryAction: rediscover`——读 `/api/manifest` 改走对应 `/api` 操作，不要重试旧路径 |

客户端退避纪律：429 / 503 携 `Retry-After` 时按整秒值等待；5xx 无 `Retry-After` 时指数退避 + 抖动；未知 code 按状态码兜底。平台原码（`asr_not_configured`、`insufficient_balance`、`plan_required` 等）在音频端点与铸令牌拒绝处原样透传，含义见[错误码表](/errors/codes)。

## SSE 帧形

- **内核事件帧**：`id: <seq>` + `data: <KernelEvent JSON>`,**不带 `event:` 名**——客户端单一 message 监听、按 `type` 判别。包络 `sessionId / turnId? / seq / ts / v / source` 恒全保。
- **控制帧**：`event: server.<族>.<名>` + `id: <seq>` + `data`，带 id 进环形缓冲（业务往返断线必须重见）。七名：`server.tool.request` / `server.tool.cancel` / `server.permission.request` / `server.permission.closed` / `server.question.request` / `server.question.closed` / `server.platform.warning`。
- **gap 帧**：`event: server.replay.gap`，恒不带 id；`data` 携 `{ type, sessionId, requestedAfterSeq, oldestRetainedSeq?, droppedEvents, reason? }`。本次丢了多少 = `oldestRetainedSeq − requestedAfterSeq − 1`;`droppedEvents` 是缓冲累计逐出数，不是本次。`reason` 二值：`'evicted'`（游标早于缓冲 / 纪元起点）、`'ahead_of_log'`（游标超前日志末序——0.9.0 起只见于伪造 / 越界游标与无 store 重启）。帧形单一事实源在契约 `ReplayGapNotice`，随 MANIFEST 门禁演进。
- **慢消费者**：单条连接的待写队列超 `maxSubscriberBufferBytes`（缺省 2 MiB）或持续 paused 超 `slowSubscriberGraceMs`（10 s）按部署策略处置——缺省 `disconnect`（断连，端侧凭 `Last-Event-ID` 走 L1）；可配 `drop-oldest`（保连接、丢该连接最旧的帧，并主动下发一帧 `requestedAfterSeq: -1` 的 gap，`oldestRetainedSeq` 缺席）。客户端恒不得假定 gap 帧只在重连首帧出现。0.9.0 起 `maxSubscriberBufferBytes` 同时是每次 socket 写的字节上界（大重放分片交付；帧文本与顺序逐字节不变）。
- **`session.events_dropped` 恒不出现在 `/v2`**：这是 contract-v0.27 新增的 SDK 专属事件（`scope: 'sdk.events'`，SDK 进程内事件背压的兜底），serve 恒不发出、不进 SSE 流、不进重放窗、不进 journal；客户端不需要为它写分支。契约事件表随此由 54 型增至 55 型（MANIFEST revision 7）。
- 首帧 `retry: 3000`（可含抖动，客户端恒按实际值重连）；每 15 s 一条 `: hb` 心跳；`?exclude=hook,mcp` 可按前缀过滤内核事件（控制帧与 gap 帧恒不受过滤，被滤事件仍占 seq）。
- 环形缓冲缺省 1024 条，可另配字节帽。SDK2 / 执行 / 归档 / 缓存装配在场时另有单帧 UTF-8 字节硬帽（`SseOptions.maxFrameBytes`，缺省 2 MiB，旋钮 `TANSR_SERVE_SSE_MAX_FRAME_BYTES`，0.13.0 起）：超界只断开该订阅、不拆坏 JSON、不伪造完成；SDK1-only 部署缺席零变化。
- **统一事件包络只在 `/api` 上、且显式协商才出现**（0.13.0 起）：经 `/api/sessions/:id/events` 请求并携 `tansr-event-envelope: unified-v1` 头时，服务端回响同名响应头并逐帧把 `data:` 改写为 7 键 `{ contract, eventId, domain, type, cursorSet, terminalStatus, raw }`——`raw` 恒为本页所述的原事件对象，`eventId` = 本帧 `id:`；未携头或未回响 = 未协商，帧字节与 `/v2` 逐字节相同。`/v2` 直连恒不改写。

## 远程工具桥与双桥

`clientTools` 申报形制：`{ name(^[A-Za-z][A-Za-z0-9_]{0,63}$), description(1–2048), parameters?(参数表档), readOnly?(缺省 false), effects?, timeoutMs?(1000–600000,缺省 120000) }`,≤ 32 个 / 会话，与内置工具撞名即 400。服务端下发 `server.tool.request { callId, name, args, deadlineAt }`，客户端执行后应答 `tool-results/:callId`；六项语义：超时按 `deadlineAt` 自弃；服务端恒不主动重发（靠 SSE 重放重见）；应答第一份有效者终局、重复 409 无害；轮中断下发 `server.tool.cancel`，取消后到达的应答 410；多 in-flight 天然并发；图片应答 base64 走 20 MiB 帽。**@tansr/serve 0.8.0 已提供**：三枚请求帧携相对时长 `ttlMs`，且每枚控制帧 `data` 多一键 `ts`（服务端墙钟），端侧以 `receivedAtLocal + ttlMs` 判期，不再直接比较绝对时刻。

权限桥：`server.permission.request { requestId, name, summary?, attribution, digest, expiresAt }`——完整 args 恒不下发，只有目标摘要；应答须逐字复述 `digest`，不符 409；120 s 到点按 deny-and-continue 收口。提问桥：`server.question.request { requestId, questions }`；无订阅者 60 s 宽限后工具结构化降级「自行决策并继续」，恒不挂起。裁决语义恒在服务端，客户端 UI 只是取答面。

## 三级恢复链

| 级 | 触发 | 客户端 | 服务端 |
|---|---|---|---|
| L1 | SSE 断连 | 携 `Last-Event-ID=<最后消费 seq>` 重连，收帧按 seq 去重 | 环形缓冲重放断点之后 |
| L2 | 重连首帧收到 gap | 弃投影 → `GET /v2/sessions/:id` → `GET …/history` → 重建视图 → 自 `history.lastSeq` 续订 | history 与 lastSeq 同刻一致 |
| L3 | 元信息 404 或 `live: false`，或冷启动只持 sessionId | `POST /v2/sessions { resume: { sessionId } }` → `resumed: true, lastSeq: <新纪元起点水位>` → 弃旧游标按 L2 重建 | store 取回 → 配对治理 → 重灌；seq 新纪元自落盘水位 + 1 起 |

运行中轮崩溃恒丢本轮（store 轮粒度提交）。resume 目标仍活跃时按 attach 返回 200，零重灌成本——端侧恒「持有上次 sessionId → 先试恢复 → 恢复不了才新建」。

### `lastSeq` 的值语义：按值续传（0.9.0 起）

以下为 `@tansr/serve` 0.9.0（2026-09-14 发布）起的行为；0.8.x 的非活跃径与 resume 响应 `lastSeq` 恒 `0`。端侧只要一直「按值续传」——把 `lastSeq` 当恢复锚而不是布尔位——两版行为都能正确处理。

- **休眠径读真值**：`GET /v2/sessions/:id`、`GET /v2/sessions` 列表项与 `GET …/history` 对不在内存的会话，`lastSeq` 取 store 元信息里落盘的水位（老卷无该元信息仍为 `0`）。`lastSeq === 0` 不再等价于「无事件」；判休眠的依据恒是 `live: false`，不是 `lastSeq`。
- **seq 跨纪元单调**：resume 重灌后的新纪元不再从 `0` 起，而是从落盘水位 + 1 起——上一纪元已封印（`seqSealed: true`，正常轮末落盘）时精确等于 `lastSeq + 1`；未封印（进程被杀等异常收口）时取 `max(lastSeq + 1, now − createdAt 毫秒)`，保证新事件的 seq 恒大于旧纪元任何游标。`201` 响应里的 `lastSeq` 即新纪元起点水位，端侧自它续订。
- **旧游标恒有明确回应**：携早于纪元起点的 `Last-Event-ID` 重连，服务端回 gap 帧 `reason: 'evicted'`，端侧走 L2；缺 `Last-Event-ID` 或值为 `-1` = 自缓冲最早处全量重放。fork 出的会话自 `lastSeq: 1` 起。
- **用量快照落后的告知**：resume 后的首个连接若发现用量快照落后于历史（进程被杀在轮末与快照之间），重放开头多一帧 `server.platform.warning { code: 'usage_snapshot_stale' }`，`message` 携快照之后落盘的消息条数；只丢末轮用量、不静默低报，历史与 seq 不受影响。端侧按咨询类弱提示处理即可。

### 历史里的媒体产物（0.10.0 起）

`GET /v2/sessions/:id/history` 的工具结果自 `@tansr/serve` 0.10.0 起携 `artifact`（图像 / 视频 / 语音工具的产物），热 / 冷恢复与检查点一并保留，端侧恢复后可重建媒体工具卡；HTTP 路径与事件包络不变，旧的纯文本历史不自动补媒体。含产物的会话存储升为版本 2：旧版本程序不能继续写已升级的卷，升级前备份并把写同一存储的 writer（`tansr serve` / 自托管 `@tansr/serve` / SDK 宿主）统一升级。

## 轮末出站 webhook

移动端退后台、SSE 断开后，轮跑完了怎么唤醒用户？引擎恒不内置推送通道（FCM / APNs / 厂商通道归你），只留一条 webhook 缝：`AgentSessionsOptions.onTurnEndNotify` 在场时，会话**轮终局（`turn.completed` / `turn.aborted`）且该刻无活跃 SSE 订阅者**才向你的 URL POST 一份最小载荷；有订阅者恒不发；同轮恒一发。

```ts
const v2: AgentSessionsOptions = {
  // ...authenticate / createSession...
  onTurnEndNotify: {
    url: 'https://your-service.example/tansr/turn-end',
    secret: process.env.NOTIFY_SECRET, // 可选:HMAC-SHA256 签名
  },
};
```

载荷（恒不携消息内容、恒不携凭据）：

```json
{ "sessionId": "…", "endUserId": "u_123", "turnId": "…",
  "status": "completed", "reason": "client_gone", "lastSeq": 1234, "ts": 1712345678901 }
```

`status` 只有 `completed | aborted`;`reason` 是终局词原值（`client_gone` = 订阅者全部离场后被孤儿策略止损，`internal_error`、`max_turns`、`budget_exceeded`、用户中断 `aborted_*` 等），接收方按「已知值专项 + 未知值兜底」消费。`lastSeq` 供客户端比对本地水位判断是否需要重放追赶，`ts` 供弃过期 / 防重放。

**签名**：`secret` 在场时，**@tansr/serve 0.8.0 默认双签**，头为 `x-tansr-signature: v2=<hex>, v1=<hex>`。`v2` 按 canonical 串（协议前缀 + 方法 + 路径 + `x-tansr-timestamp` + `x-tansr-nonce` + 体 sha256，各项以换行连接）签名并随行两个头；`v1` 是原始请求体的 HMAC-SHA256。可通过 `webhook.signatureVersions` 选择签名版本；接收端先验签再消费，v2 在场只校 v2、不许降级。出站请求恒不带任何鉴权凭据头，真伪凭签名。

**投递纪律**:2xx 即成功；否则指数退避重试（单次 5 s 超时，退避 500 ms ×2，至多重试 3 次）；有界并发 32、有界队列 1024（满则丢最新到达者）、目标级熔断（连续 5 次终败开 30 s）；全程 fire-and-forget，恒不阻断会话主链；终败经 `onDeliveryFailure` 结构化通报；优雅关闭期恒不出站。有订阅者时不立即裁「不发」，延后 2 s 复判（断线事件与终局帧几乎同刻抵达的情形）。

**命令行形态两键**:[`TANSR_SERVE_NOTIFY_URL`](/serve/env#tansr_serve_notify_url)（绝对 http(s) URL）与 [`TANSR_SERVE_NOTIFY_SECRET`](/serve/env#tansr_serve_notify_secret)（取值恒不入日志）把同一缝接给 `tansr serve --v2`，无 URL 即不出站——**@tansr/serve 0.8.0 与 tansr 命令行 0.6.0 已提供**；npm 嵌入形使用上文的 `onTurnEndNotify` 选项。

你的半场：收 webhook → 验签 → 把 `endUserId` 映射到设备推送令牌 → 发一条只携 `sessionId` 的推送 data 消息 → App 点击后经 SDK 既有三级链恢复（进程还在 → L1；进程已死 → 冷启 resume 即 L3）。全程不涉及新 SDK API。
