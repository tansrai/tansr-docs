---
title: 部署与鉴权
description: 把 @tansr/serve 跑上生产——三层鉴权与 authenticate 缝、应用密钥放置、优雅关闭与信号接线、观测端点暴露纪律、准入帽与运维旋钮、多副本分片路由，以及命令行 tansr serve 的无人值守基线。
zone: docs
category: serve
related:
  - sdk/system-prompts
  - getting-started/serve
  - serve/v2-and-webhooks
  - serve/retention-and-governance
  - serve/env
  - cli/settings-and-doctor
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/.env.example
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-13'
---

`@tansr/serve` 以 npm 包嵌进你的 Node 进程。它负责传输与协议机器（路由、SSE 编帧与重放、三类桥应答、多会话治理、轮末 webhook），**不负责**网关职责——TLS 终结、IP 级限流、WAF、用户登录都归你的边缘与登录态体系。这一篇把生产部署要决定的事按顺序讲一遍。版本基线：`@tansr/serve` 0.15.1 与 `tansr` 命令行 0.10.3（均 2026-10-10 发布，当前 npm `latest`）；标注版本号的段落只对该版本及更高成立。

## 在平台或宿主配置应用角色

移动端的系统提示词在平台应用配置或 serve 宿主中设置，不放入 `/v2` 的 `prompt`。省略 `platform.system` 使用平台默认；代码管理的业务段放 `platform.system`，宿主补充说明放 `platform.systemAppend`。默认 `fallback` 允许显式业务段（包括 `[]`）替代平台段；`prepend` 保留平台段在前，即使 SDK 段是 `[]`。

这些选项自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线。它们只控制文本组合，不替代权限。平台提示词与策略在后续新一轮前刷新，当前执行轮保持既有配置；已有会话、attach 和历史可继续使用，无需为了改角色重开会话。参见[应用系统提示词与 SDK 拼接策略](/sdk/system-prompts/)中的 serve 完整示例。

## 鉴权：三层，各归各位

| 层 | 凭据 | 归属 |
|---|---|---|
| 客户端 ↔ 会话服务（`/api`、`/v2`） | 你自定的登录态 token | 完全开发者侧；引擎只经 `authenticate` 缝取 `endUserId` |
| 会话服务 ↔ tansr 平台 | `appid` + `appkey`（控制台「应用」颁发） | 服务进程持有；用 appkey 为每个终端用户换 `app_user` 令牌，计费按 endUser 归因 |
| 客户端持 `appid` | 公开应用标识 | 可下发，恒非凭据 |

红线：appkey 恒不下发到端；`app_user` 令牌恒不出会话服务；`/api` / `/v2` 恒不受理 `/v1` 的 Bearer；会话 id 恒非鉴权因子，每个 `:id` 端点独立校验归属，跨用户恒 403；`/api` 上体内任何身份字段都不被当作身份，`endUserId` 恒由 `Authorization` 背后的鉴权缝裁定。

`authenticate` 是 `/v2` 与 `/api` 会话域的**唯一**鉴权面。它的职责只有一个：把你的登录态映射到 `endUserId`（形制 `^[\x21-\x7E]{1,128}$`，创建后恒不变）。返回 `null` 或抛错一律 401。0.13.0 起的 `/api` 门面对委托径**不重复鉴权**（由域 handler 即此缝裁定），门面自有端点（`/api/manifest`、`/api/capabilities`、`/api/sessions/:id/capabilities`）先鉴权再作答；0.14.0 起携 `Idempotency-Key` 的请求门面会先鉴权一次、域 handler 再鉴权一次。SDK2 执行 / 归档 / 缓存装配在场时，基础认证源另有限界：缺省 128 个未结束认证源、每请求 10 s（`AgentSessionsOptions.authentication: { maxPending?, timeoutMs? }`，旋钮 `TANSR_SERVE_AUTH_MAX_PENDING` / `TANSR_SERVE_AUTH_TIMEOUT_MS`）；只装 SDK1 的部署缺席零变化。

```ts
v2: {
  authenticate: async (req) => {
    const token = bearerOf(req.headers.authorization);
    const endUserId = token ? await verifyToken(token) : null;
    return endUserId ? { endUserId } : null; // null = 401,fail-closed
  },
  // ...
}
```

JWT、session cookie、OAuth access token、甚至「签发时写一行簿记、校验时查表」都行，引擎一概不知也不管。

appid / appkey 从环境变量读（官方样板用 `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`），恒不入代码、不入日志、不入版本库。泄露即整个应用失守，立刻到控制台轮换。

## `/v1` 面与 `token`

`startServer` 的 `token` 选项是 `/v1` 单运维方面的 Bearer（`POST /v1/sessions` 等六端点，以及 `GET /v1/status`）。它与 `/v2` 的鉴权互不相通。不需要 `/v1` 面也要给一个强随机值——引擎 fail-closed，不会起无鉴权服务。

**0.13.0 起 `/v1` 在装配了 `/api` 门面的部署缺省关闭**（`options.v2` 在场即 `StartServerOptions.disableV1` 缺省为 `true`；SDK2 显式宿主在场时恒关、不能重开）：`/v1/sessions*`、`/v1/status`、`/v1/approvals/:id/credential` 缺省 404。只装 SDK1 `/v1`、不带 `/v2` 的部署不受影响。确需保留的 npm 嵌入形显式 `disableV1: false`；命令行形态用 `tansr serve --legacy-v1` 或 `TANSR_SERVE_LEGACY_V1=1`——该旋钮自 0.14.0 / 命令行 0.10.1 起**已标废弃、1.0.0 移除**，开启时出恰一条结构化 `warn` 事件 `server.deprecated_option`（`deprecatedSince: "0.14.0"`、`removal: "1.0.0"`、`replacement: "approval.credential.submit"`）。0.14.0 起审批凭证投递改走 `POST /api/approvals/:id/credential`（manifest revision 7 的 `approval.credential.submit`，鉴权 = 多租 Bearer + `x-tansr-end-user`），接审批投递的 `--v2` 部署不再需要 `--legacy-v1`；健检改走免 Bearer 的 `/healthz` `/readyz`，不要再探 `GET /v1/status`。

## `/api` 统一调用面与旧前缀

`options.v2` 在场的部署自 0.13.0 起在链首装配 `/api` 门面（路由表单一事实源 `packages/server/src/api/route-table.ts`）：`/v2/sessions/**` 以外，显式装配的 `/v3/sdk2/**`、`/v3/terminal*/**` 也各有 `/api` 对应物；全部 `/api/*` 响应携 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 四头，错误统一信封。新集成只读一份 `GET /api/manifest`（0.14.0 起为 revision 7：11 族 / 81 操作，0.15.1 未变）与一张路由表；`/v2`、`/v3/*` 定义为内部适配入口，1.0.0 移除外部入口。多副本部署给 nginx / k8s 模板加 `/api` 分片（仓内 `deploy/serve-v2/**` 已含），与客户端切流同向。路由表与迁移时间表见[统一 API](/unified-api/)。

**旧前缀退役窗口（0.15.0 起）**：`StartServerOptions.legacyPrefixes` / 旋钮 `TANSR_SERVE_LEGACY_PREFIX` 取 `readwrite` / `readonly` / `off`，只在 `/api` 门面在场时有消费点。缺省 `readwrite`（截至 0.15.1 未变）：旧前缀读写照常受理。`readonly`：manifest 中 `kind: write` 的 38 个操作在 `/v2`、`/v3/*` 上改答 `410 gone` 统一信封（`code: gone`、`retryAction: rediscover`、`detail.domainCode: legacy_prefix_retired`，`message` 指向对应的 `/api` 操作），39 个读操作与 4 个事件流仍受理，manifest 未登记的旧路径不拒。`off`：旧前缀全部 `404 not_found` 统一信封。三种模式下旧前缀的每个响应（含 SSE、含被拒的响应）都附 `Deprecation: @1790900340`（= `/api` GA 时刻 2026-10-02T00:19Z，RFC 9745）与 `Link: </api/manifest>; rel="deprecation"`；配置了 `legacyPrefixSunset` / `TANSR_SERVE_LEGACY_SUNSET`（HTTP-date 或 ISO-8601；库选项传入非法模式或不可解析日期在 `startServer` 抛 `TypeError`，环境变量非法值则按运行时旋钮纪律告警后忽略）才另附 `Sunset`，缺省不附。`readwrite` 下响应体与状态码逐字节不变；`/api` 响应不带这三头。同一会话 id 先后经 `/api/sessions/:id/**` 与 `/v2/sessions/:id/**`、`/v3/sdk2/sessions/:id/**` 访问时每次切换记一条 `warn` `api.legacy_prefix_mixed`（按会话 id 的 4 096 条 LRU，`readwrite` 下只留痕不拒绝）；`readonly` / `off` 下每个被拒的 `method route` 模板首次记一条 `api.legacy_prefix_rejected`。两事件计数持续为零是把窗口切到 `readonly` 的证据。0.15.0 发行说明曾把「缺省改为 `readonly`」写在后续版本；当前 npm `latest` 的 0.15.1 仍是 `readwrite`，实际切换以届时发布说明为准。命令行 `tansr serve --v2` 同样读这两个环境变量，没有对应旗标。

## 优雅关闭：信号归宿主

引擎恒不在 `process` 上注册信号监听器。不接线的后果：`docker stop` / systemd / Kubernetes 缺省发 SIGTERM，进程被硬杀，全部 SSE 连接 reset、在飞轮丢、无收口日志。

`server.drain({ timeoutMs })`（幂等，缺省 30 s）按序做四件事：① 拒新——readiness 翻红、新建 / resume 一律 `503 draining` 携 `Retry-After`、全部在场 SSE 下发长间隔 `retry:` 帧；② 等在飞轮至终态或超时后 `interrupt()` 剩余轮（轮末 store 提交照走）；③ flush 落盘；④ 停监听、掐连接。应答 `{ completedTurns, abortedTurns, flushedCommits, durationMs }` 可入日志。

```ts
let stopping = false;
const shutdown = (signal: NodeJS.Signals): void => {
  if (stopping) return;
  stopping = true;
  console.error(`[my-service] ${signal} received, draining...`);
  server
    .drain({ timeoutMs: 30_000 })
    .then((report) => { console.error('[my-service] drained', report); process.exit(0); })
    .catch((error: unknown) => { console.error('[my-service] shutdown failed', error); process.exit(1); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

部署件口径：容器 `stop_grace_period` / Kubernetes `terminationGracePeriodSeconds` / systemd `TimeoutStopSec` 统一 **45 s**（≥ drain 超时 + 15 s）。容器 `CMD` 用 exec 形（JSON 数组）或 `--init`，不要 `sh -c "node …"`（sh 当 PID 1 不转发信号）。Windows 上 `SIGTERM` 可注册但系统不会发出，本机开发以 Ctrl+C 收束。

进程级兜底：引擎导出 `installProcessGuards({ logger, onFatal })` 供宿主入口安装一次，任何逃逸到进程级的拒绝 / 异常恒记一条结构化事件后按策略 `log` 或 `drain-exit`。**@tansr/serve 0.8.0 已提供**；嵌入式宿主按上述接口接入，旧包仍需自行处理进程级异常。

## 观测端点与暴露纪律

三端点免 Bearer：`GET /healthz`（存活）、`GET /readyz`（就绪，`!closing ∧ 全部就绪探针 ready`）、`GET /metrics`（OpenMetrics 文本）。因为免鉴权，暴露面必须显式：`host` 为回环时缺省暴露；绑 `0.0.0.0` 时缺省**不暴露**，须 [`TANSR_SERVE_EXPOSE_OBSERVABILITY=1`](/serve/env#tansr_serve_expose_observability) 或 `observability: { expose: true }`。未暴露时这三条路径与任何未知路径响应一致，不泄漏存在性。反代恒不把 `/metrics` 转到公网；探针与抓取器走内网直连副本。

每个请求采纳合法入站 `x-request-id`（否则取 `traceparent` 的 trace-id，再否则自铸 UUID），恒回响应头 `x-request-id`，作 `request.completed{ requestId, method, route, status, durationMs }` 的关联键。结构化日志走 [`TANSR_SERVE_LOG_FORMAT=json`](/serve/env#tansr_serve_log_format)，字段恒不含令牌与消息内容。`/api` 与 `/v2`、`/v3/*` 在指标 `route` 标签下分别可见——以 `/v2/` `/v3/` 开头的样本就是尚未迁移到 `/api` 的调用。

**日志级别缺省 `warn`**（`@tansr/serve` 0.13.0 / 命令行 0.10.0 起）：`tansr serve` 入口以 `createServeLogger(sink, { level = 'warn' })` 包装日志，旋钮 `TANSR_SERVE_LOG_LEVEL=info|debug` 放开；固定 10 s 窗口内按（级别、事件、字段）分组限量，超出以 `log.repeated { originalEvent, suppressed, windowMs }` 汇总、组数超 128 以 `log.overflow` 出线；全部级别同样脱敏 / 有界（字段 ≤ 128 个、字符串 ≤ 1 024 字符、整体 ≤ 8 KiB，`prompt / messages / content / body / args / stdout / stderr` 等正文键恒 `[redacted]`）。此前依赖 `info` 级事件做仪表板的部署升级后要显式设 `TANSR_SERVE_LOG_LEVEL=info`。自托管宿主可选用同一 `createServeLogger`，旧自定义 logger 直接注入仍可。新事件名：`execution.rejected` / `execution.result`（SDK2 执行档）、`log.repeated` / `log.overflow`、`server.deprecated_option`（0.14.0）、`api.legacy_prefix_mixed` / `api.legacy_prefix_rejected`（0.15.0，旧前缀窗口）；仪表板 / 告警按名随动。

## 准入帽与运维旋钮

引擎的全部运维位都是库选项；进程形态经 `resolveServeRuntimeOptions(process.env)` 一次解析成结构化结果再展开，与命令行 `tansr serve` 同名同义。纪律：**任一变量缺席 / 空串即不落键 = 库缺省，行为零漂移**；非法值进 `warnings` 由宿主一行告警后忽略，恒不拒启。全表见[环境变量表](/serve/env)，这里点名生产最常调的几组：

| 目的 | 变量 |
|---|---|
| 有界拒绝而非拖垮 | [`TANSR_SERVE_MAX_ACTIVE_SESSIONS`](/serve/env#tansr_serve_max_active_sessions) · [`TANSR_SERVE_MAX_SSE_CONNECTIONS`](/serve/env#tansr_serve_max_sse_connections) · [`TANSR_SERVE_MAX_INFLIGHT_BODY_BYTES`](/serve/env#tansr_serve_max_inflight_body_bytes) · [`TANSR_SERVE_ELD_THRESHOLD_MS`](/serve/env#tansr_serve_eld_threshold_ms) |
| 上游连接隔离舱 | [`TANSR_SERVE_UPSTREAM_MAX_INFLIGHT`](/serve/env#tansr_serve_upstream_max_inflight) |
| 分层超时与每轮墙钟 | [`TANSR_SERVE_UPSTREAM_CONNECT_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_connect_timeout_ms) · [`TANSR_SERVE_UPSTREAM_IDLE_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_idle_timeout_ms) · [`TANSR_SERVE_UPSTREAM_TOTAL_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_total_timeout_ms) · [`TANSR_SERVE_TURN_WALL_CLOCK_MS`](/serve/env#tansr_serve_turn_wall_clock_ms) |
| SSE 背压 | [`TANSR_SERVE_SSE_MAX_BUFFER_BYTES`](/serve/env#tansr_serve_sse_max_buffer_bytes) · [`TANSR_SERVE_SSE_SLOW_POLICY`](/serve/env#tansr_serve_sse_slow_policy)（`disconnect` 缺省 / `drop-oldest`）· [`TANSR_SERVE_SSE_RETRY_MS`](/serve/env#tansr_serve_sse_retry_ms) |
| 重放窗字节帽 | [`TANSR_SERVE_EVENT_BUFFER_MAX_BYTES`](/serve/env#tansr_serve_event_buffer_max_bytes)（部署建议 4 MiB / 会话） |
| 0.13.0 – 0.15.0 新增（`SERVE_RUNTIME_ENV` 表 31 → 36 → 38 键） | `TANSR_SERVE_LOG_LEVEL`（缺省 `warn`）· `TANSR_SERVE_SSE_MAX_FRAME_BYTES`（SDK2 装配缺省 2 MiB 单帧硬帽）· `TANSR_SERVE_AUTH_MAX_PENDING` / `TANSR_SERVE_AUTH_TIMEOUT_MS`（基础认证源限界）· `TANSR_SERVE_LEGACY_V1`（已废弃的 `/v1` 过渡旋钮）· `TANSR_SERVE_LEGACY_PREFIX`（0.15.0；`readwrite` 缺省 / `readonly` / `off`）· `TANSR_SERVE_LEGACY_SUNSET`（0.15.0；旧前缀 `Sunset` 头日期，缺省不发） |

准入拒绝恒 `503 overloaded` 携 `Retry-After`（「本机忙，稍后再来」）；平台铸令牌撞 429 / 5xx / 网络错则 `503 upstream_unavailable`（「上游坏，加压无益」），两者刻意分开。缺省全部不设硬帽——唯一例外是每轮墙钟：**`tansr serve` 命令行形态自 0.9.0 起缺省 30 分钟**（`TANSR_SERVE_TURN_WALL_CLOCK_MS` 缺席 = 1 800 000 ms，显式 `0` = 停用），单轮预期超过 30 分钟的部署需显式设更大值或 `0`；库 `startServer` 与 `resolveServeRuntimeOptions` 不带此缺省，仍是缺席即不设墙钟（且不接受 `0`）。

每条 SSE 占 1 个文件句柄，Linux 缺省 `nofile 1024` 会把并发订阅者卡在一千出头并报 `EMFILE`——按目标并发 ≥ 2× 抬。容量参考（本机现状档，不外推）：单进程 ≈ 2500 活跃 SSE 连接时事件循环延迟 p99 ≈ 190 ms；≈ 35 KiB 堆 / 会话。

## 多副本：分片前缀路由 + 副本私有存储

会话运行态在副本内存 + 私有 store，`/v2/sessions/<id>/…` 必须回到创建它的副本。做法：每副本持分片码 [`TANSR_SERVE_SESSION_SHARD`](/serve/env#tansr_serve_session_shard)（0–255，= 副本序号），引擎给**全新会话**生成的 sessionId 前两位十六进制恒 = 分片码（其余仍是 UUID v4 随机位），反代读 id 前两位做静态 `map` 路由回创建副本；创建请求（路径无 id）任意副本轮询。客户端零改动，无 cookie、无端侧头。

三条禁忌：**不能按路径 sessionId 做一致性哈希**（创建请求没有 id，会话生在随机副本，后续按 id 哈希落别处 → 404 → 分叉）；**恒不共享存储目录**（NFS / EFS / 同一卷挂两副本——会话锁按本机 PID 判活，容器下必然误判，并发写同一 journal → `500 store_corrupted`；这是不安全配置，不是「慢一点」）；自定义 `AgentSessionFactory` 须采用 `init.sessionId`，否则失去粘性。

nginx 只做 SSE 直通（`proxy_buffering off`、读超时 ≥ 心跳 15 s × 4、对 `text/event-stream` 不压缩、`proxy_next_upstream off`）与分片前缀路由，`client_max_body_size` 与引擎体帽对齐。仓内 `deploy/serve-v2/` 是参考宿主部署件（compose N 副本 + nginx 模板；K8s StatefulSet + NetworkPolicy）。

## 命令行形态：`tansr serve` 的无人值守基线

```bash
tansr serve --token my-secret                    # 127.0.0.1:7433
tansr serve --port 8080 --host 0.0.0.0 --token my-secret
TANSR_SERVE_TOKEN=my-secret tansr serve          # token 走环境变量
```

`--token` 与 `TANSR_SERVE_TOKEN` 皆缺即用法错误拒启；缺省仅回环监听，外部接入须显式 `--host 0.0.0.0`；全部端点要求 `Authorization: Bearer <token>`，未带或不匹配一律 401。它是「一容器一智能体实例」的 `/v1` 形态（参考模板 `deploy/serve/`，健检已走 `/healthz` `/readyz`），无询问通道，权限落到「询问」时降级拒绝。放权（`defaultMode: "auto"`）要用环境隔离兜底：容器或最小权限专用用户；文件系统写面限工作目录；网络出口白名单。`tansr doctor` 的「无人值守基线」检查会在 `auto` 且探测不到隔离迹象时给显著提示（不阻断）；确认已隔离后设 `TANSR_ISOLATED=1` 压制提示。

`tansr serve --v2` 把 `/v2` 面挂进命令行形态（同一 Bearer + `x-tansr-end-user` 头自报分域），**tansr 命令行 0.6.0 已提供**；0.10.0 起同一进程链首装配 `/api` 门面，新集成改用 `/api/sessions/**`。注意 `--v2` 在场即门面在场，**`/v1` 面缺省关闭**（见上文）；要同时保留 `/v1` 须显式 `--legacy-v1`（已废弃）。

**可信宿主模块（命令行 0.10.0 起）**：`tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>`（两旗标成对，缺一即用法错误）让运维者显式指定本机绝对路径的 `.cjs` 受信宿主模块与其原始字节 SHA256。入口经同一文件描述符有界读取（≤ 16 MiB），`timingSafeEqual` 核摘要后编译**已验字节**执行（不按文件名 require，避免校验后替换窗口）；模块导出 `(context) => { agent, authenticate, terminal?, v2?, resources? }`，`context` 携 `cwd / env / logger / serve / extensions / own()`。此径只装配公开平台宿主（`createAgentSessionFactory` + 可选终端服务 / 归档 / 缓存 / 记忆 / 可信扩展），不加载旧 CLI 登录 / provider / 本机工具装配；与原入口共用进程守卫与信号预算。它与部署者本机代码同级受信：入口摘要不签署依赖图、不是代码沙箱、路径不由模型或 HTTP 提供。不传两旗标 = 0.9.0 行为；`@tansr/serve/extensions` 的 SDK2 档案 / 缓存 / 终端服务 / 共享事务 Store 等库面能力在命令行形态**只经此径**可达，见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。命令行形态的 serve 日志同样缺省 `warn`（`TANSR_SERVE_LOG_LEVEL`），全部旗标与环境变量见[配置与 doctor](/cli/settings-and-doctor/)。
