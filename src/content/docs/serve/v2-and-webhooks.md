---
title: v2 协议与 webhook
description: /v2 会话面的 21 个端点与错误信封、SSE 帧形与 Last-Event-ID 重放、远程工具与权限 / 提问双桥、三级恢复链，以及轮末出站 webhook 的载荷、签名与投递纪律。
zone: docs
category: serve
related:
  - getting-started/serve
  - serve/deploy-and-auth
  - serve/retention-and-governance
  - serve/env
  - errors/codes
  - android
  - ios
sources:
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/.env.example
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-android:README.md
lastVerified: '2026-09-08'
---

`/v2` 是 `@tansr/serve` 对外的多会话协议面：SSE 下行、POST 上行，内核事件直接下发、由客户端归约。Android / iOS SDK 已把这套协议全部封装；如果你自己写客户端，或者要接服务端半场的 webhook，这一篇是你需要的全部事实。

## 总纪律

- `/v2` 与 `/v1` 同进程同端口，路由顺序恒 `/v1` 先；两面身份体系互不相通。
- 错误信封恒 `{ "error": { "code": "<机器码>", "message": "<本地化文案>", "detail"?: {…} } }`。`code` 稳定可判，`message` 不承诺字面，`detail` 是可选结构化位，在场才落键。
- 载荷演进：请求端未知键忽略；响应端新增键不通知；客户端对未知事件类型与未知字段恒容忍。
- 体帽：缺省 1 MiB；`messages` 与 `tool-results` 两端点 20 MiB；快照导入与音频两端点 32 MiB。超限恒 `413 payload_too_large`。

## 端点全形

| 方法与路径 | 作用 | 成功响应 |
|---|---|---|
| `POST /v2/sessions` | 创建 / attach / resume / fork | 新建 `201 { sessionId, resumed: false, lastSeq: 0 }`;attach（目标仍活跃）`200 { …, lastSeq: <水位> }`;resume 重灌 `201 { …, resumed: true, lastSeq: 0 }` |
| `POST /v2/sessions/:id/messages` | 注入输入 | `202 { sessionId, accepted: true }` |
| `GET /v2/sessions/:id/events` | SSE 事件流 | `200 text/event-stream` |
| `POST /v2/sessions/:id/interrupt` | 中断当前轮（幂等） | `202 { sessionId, accepted: true }` |
| `DELETE /v2/sessions/:id` | 关闭会话（store 内容保留，可 resume） | `202 { sessionId, accepted: true }` |
| `GET /v2/sessions/:id` | 元信息与恢复锚 | `200 { sessionId, endUserId, status: 'running' \| 'idle' \| 'ended', live, lastSeq, createdAt, lastActivityAt, title? }` |
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
| `upstream_unavailable` | 503 | 平台铸令牌 / 配置拉取暂不可用；恒携 `Retry-After` |
| `rate_limited` | 429 | 宿主限流缝拒绝，或平台套餐配额（`detail: { scope: 'plan' }`）；恒携 `Retry-After` |
| `internal_error` | 500 | 路由层统一错误边界兜底，进程恒不退出 |
| `store_corrupted` | 500 | 会话存储损坏，恒不静默回残缺历史 |

客户端退避纪律：429 / 503 携 `Retry-After` 时按整秒值等待；5xx 无 `Retry-After` 时指数退避 + 抖动；未知 code 按状态码兜底。平台原码（`asr_not_configured`、`insufficient_balance`、`plan_required` 等）在音频端点与铸令牌拒绝处原样透传，含义见[错误码表]（/errors/codes）。

## SSE 帧形

- **内核事件帧**：`id: <seq>` + `data: <KernelEvent JSON>`,**不带 `event:` 名**——客户端单一 message 监听、按 `type` 判别。包络 `sessionId / turnId? / seq / ts / v / source` 恒全保。
- **控制帧**：`event: server.<族>.<名>` + `id: <seq>` + `data`，带 id 进环形缓冲（业务往返断线必须重见）。七名：`server.tool.request` / `server.tool.cancel` / `server.permission.request` / `server.permission.closed` / `server.question.request` / `server.question.closed` / `server.platform.warning`。
- **gap 帧**：`event: server.replay.gap`，恒不带 id；`data` 携 `requestedAfterSeq / oldestRetainedSeq? / droppedEvents`。本次丢了多少 = `oldestRetainedSeq − requestedAfterSeq − 1`;`droppedEvents` 是缓冲累计逐出数，不是本次。
- 首帧 `retry: 3000`（可含抖动，客户端恒按实际值重连）；每 15 s 一条 `: hb` 心跳；`?exclude=hook,mcp` 可按前缀过滤内核事件（控制帧与 gap 帧恒不受过滤，被滤事件仍占 seq）。
- 环形缓冲缺省 1024 条，可另配字节帽。

## 远程工具桥与双桥

`clientTools` 申报形制：`{ name(^[A-Za-z][A-Za-z0-9_]{0,63}$), description(1–2048), parameters?(参数表档), readOnly?(缺省 false), effects?, timeoutMs?(1000–600000,缺省 120000) }`,≤ 32 个 / 会话，与内置工具撞名即 400。服务端下发 `server.tool.request { callId, name, args, deadlineAt }`，客户端执行后应答 `tool-results/:callId`；六项语义：超时按 `deadlineAt` 自弃；服务端恒不主动重发（靠 SSE 重放重见）；应答第一份有效者终局、重复 409 无害；轮中断下发 `server.tool.cancel`，取消后到达的应答 410；多 in-flight 天然并发；图片应答 base64 走 20 MiB 帽。**即将随 @tansr/serve 0.7.0 提供**：三枚请求帧加相对时长 `ttlMs`，且每枚控制帧 `data` 多一键 `ts`（服务端墙钟），端侧以 `receivedAtLocal + ttlMs` 判期，不再直接比较绝对时刻。

权限桥：`server.permission.request { requestId, name, summary?, attribution, digest, expiresAt }`——完整 args 恒不下发，只有目标摘要；应答须逐字复述 `digest`，不符 409；120 s 到点按 deny-and-continue 收口。提问桥：`server.question.request { requestId, questions }`；无订阅者 60 s 宽限后工具结构化降级「自行决策并继续」，恒不挂起。裁决语义恒在服务端，客户端 UI 只是取答面。

## 三级恢复链

| 级 | 触发 | 客户端 | 服务端 |
|---|---|---|---|
| L1 | SSE 断连 | 携 `Last-Event-ID=<最后消费 seq>` 重连，收帧按 seq 去重 | 环形缓冲重放断点之后 |
| L2 | 重连首帧收到 gap | 弃投影 → `GET /v2/sessions/:id` → `GET …/history` → 重建视图 → 自 `history.lastSeq` 续订 | history 与 lastSeq 同刻一致 |
| L3 | 元信息 404 或 `live: false`，或冷启动只持 sessionId | `POST /v2/sessions { resume: { sessionId } }` → `resumed: true, lastSeq: 0` → 弃旧游标按 L2 重建 | store 取回 → 配对治理 → 重灌；seq 新纪元 |

运行中轮崩溃恒丢本轮（store 轮粒度提交）。resume 目标仍活跃时按 attach 返回 200，零重灌成本——端侧恒「持有上次 sessionId → 先试恢复 → 恢复不了才新建」。

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

**签名**：`secret` 在场时携头 `x-tansr-signature: sha256=<hex>`，值为对原始请求体全文的 HMAC-SHA256；接收端先验签再消费。**即将随 @tansr/serve 0.7.0 提供**双签一版：头改为 `x-tansr-signature: v2=<hex>, v1=<hex>`,`v2` 按 canonical 串（方法 + 路径 + `x-tansr-timestamp` + `x-tansr-nonce` + 体 sha256）签名并随行两个头，`v1` 即今日的原始体 HMAC；接收方 v2 在场只校 v2、不许降级。出站请求恒不带任何鉴权凭据头，真伪凭签名。

**投递纪律**:2xx 即成功；否则指数退避重试（单次 5 s 超时，退避 500 ms ×2，至多重试 3 次）；有界并发 32、有界队列 1024（满则丢最新到达者）、目标级熔断（连续 5 次终败开 30 s）；全程 fire-and-forget，恒不阻断会话主链；终败经 `onDeliveryFailure` 结构化通报；优雅关闭期恒不出站。有订阅者时不立即裁「不发」，延后 2 s 复判（断线事件与终局帧几乎同刻抵达的情形）。

**命令行形态两键**:[`TANSR_SERVE_NOTIFY_URL`]（/serve/env#tansr_serve_notify_url）（绝对 http(s) URL）与 [`TANSR_SERVE_NOTIFY_SECRET`]（/serve/env#tansr_serve_notify_secret）（取值恒不入日志）把同一缝接给 `tansr serve --v2`，无 URL 即不出站——**即将随 @tansr/serve 0.7.0 与 tansr 命令行 0.5.0 提供**；npm 嵌入形今天就用上文的 `onTurnEndNotify` 选项。

你的半场：收 webhook → 验签 → 把 `endUserId` 映射到设备推送令牌 → 发一条只携 `sessionId` 的推送 data 消息 → App 点击后经 SDK 既有三级链恢复（进程还在 → L1；进程已死 → 冷启 resume 即 L3）。全程不涉及新 SDK API。
