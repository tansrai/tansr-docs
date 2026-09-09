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
  - security
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/.env.example
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-09-09'
---

`@tansr/serve` 以 npm 包嵌进你的 Node 进程。它负责传输与协议机器（路由、SSE 编帧与重放、三类桥应答、多会话治理、轮末 webhook），**不负责**网关职责——TLS 终结、IP 级限流、WAF、用户登录都归你的边缘与登录态体系。这一篇把生产部署要决定的事按顺序讲一遍。

## 在平台或宿主配置应用角色

移动端的系统提示词在平台应用配置或 serve 宿主中设置，不放入 `/v2` 的 `prompt`。省略 `platform.system` 使用平台默认；代码管理的业务段放 `platform.system`，宿主补充说明放 `platform.systemAppend`。默认 `fallback` 允许显式业务段（包括 `[]`）替代平台段；`prepend` 保留平台段在前，即使 SDK 段是 `[]`。

这些新增选项尚待 API 与 serve 配套发布。它们只控制文本组合，不替代权限。平台提示词与策略在后续新一轮前刷新，当前执行轮保持既有配置；已有会话、attach 和历史可继续使用，无需为了改角色重开会话。参见[应用系统提示词与 SDK 拼接策略](/sdk/system-prompts/)中的 serve 完整示例。

## 鉴权：三层，各归各位

| 层 | 凭据 | 归属 |
|---|---|---|
| 客户端 ↔ 会话服务（`/v2`） | 你自定的登录态 token | 完全开发者侧；引擎只经 `authenticate` 缝取 `endUserId` |
| 会话服务 ↔ tansr 平台 | `appid` + `appkey`（控制台「应用」颁发） | 服务进程持有；用 appkey 为每个终端用户换 `app_user` 令牌，计费按 endUser 归因 |
| 客户端持 `appid` | 公开应用标识 | 可下发，恒非凭据 |

红线：appkey 恒不下发到端；`app_user` 令牌恒不出会话服务；`/v2` 恒不受理 `/v1` 的 Bearer；会话 id 恒非鉴权因子，每个 `:id` 端点独立校验归属，跨用户恒 403。

`authenticate` 是 `/v2` 的**唯一**鉴权面。它的职责只有一个：把你的登录态映射到 `endUserId`（形制 `^[\x21-\x7E]{1,128}$`，创建后恒不变）。返回 `null` 或抛错一律 401。

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

进程级兜底：引擎导出 `installProcessGuards({ logger, onFatal })` 供宿主入口安装一次，任何逃逸到进程级的拒绝 / 异常恒记一条结构化事件后按策略 `log` 或 `drain-exit`。**即将随 @tansr/serve 0.7.0 提供**；在此之前请自行挂 `unhandledRejection` / `uncaughtException`。

## 观测端点与暴露纪律

三端点免 Bearer：`GET /healthz`（存活）、`GET /readyz`（就绪，`!closing ∧ 全部就绪探针 ready`）、`GET /metrics`（OpenMetrics 文本）。因为免鉴权，暴露面必须显式：`host` 为回环时缺省暴露；绑 `0.0.0.0` 时缺省**不暴露**，须 [`TANSR_SERVE_EXPOSE_OBSERVABILITY=1`](/serve/env#tansr_serve_expose_observability) 或 `observability: { expose: true }`。未暴露时这三条路径与任何未知路径响应一致，不泄漏存在性。反代恒不把 `/metrics` 转到公网；探针与抓取器走内网直连副本。

每个请求采纳合法入站 `x-request-id`（否则取 `traceparent` 的 trace-id，再否则自铸 UUID），恒回响应头 `x-request-id`，作 `request.completed{ requestId, method, route, status, durationMs }` 的关联键。结构化日志走 [`TANSR_SERVE_LOG_FORMAT=json`](/serve/env#tansr_serve_log_format)，字段恒不含令牌与消息内容。

## 准入帽与运维旋钮

引擎的全部运维位都是库选项；进程形态经 `resolveServeRuntimeOptions(process.env)` 一次解析成结构化结果再展开，与命令行 `tansr serve` 同名同义。纪律：**任一变量缺席 / 空串即不落键 = 库缺省，行为零漂移**；非法值进 `warnings` 由宿主一行告警后忽略，恒不拒启。全表见[环境变量表](/serve/env)，这里点名生产最常调的几组：

| 目的 | 变量 |
|---|---|
| 有界拒绝而非拖垮 | [`TANSR_SERVE_MAX_ACTIVE_SESSIONS`](/serve/env#tansr_serve_max_active_sessions) · [`TANSR_SERVE_MAX_SSE_CONNECTIONS`](/serve/env#tansr_serve_max_sse_connections) · [`TANSR_SERVE_MAX_INFLIGHT_BODY_BYTES`](/serve/env#tansr_serve_max_inflight_body_bytes) · [`TANSR_SERVE_ELD_THRESHOLD_MS`](/serve/env#tansr_serve_eld_threshold_ms) |
| 上游连接隔离舱 | [`TANSR_SERVE_UPSTREAM_MAX_INFLIGHT`](/serve/env#tansr_serve_upstream_max_inflight) |
| 分层超时与每轮墙钟 | [`TANSR_SERVE_UPSTREAM_CONNECT_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_connect_timeout_ms) · [`TANSR_SERVE_UPSTREAM_IDLE_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_idle_timeout_ms) · [`TANSR_SERVE_UPSTREAM_TOTAL_TIMEOUT_MS`](/serve/env#tansr_serve_upstream_total_timeout_ms) · [`TANSR_SERVE_TURN_WALL_CLOCK_MS`](/serve/env#tansr_serve_turn_wall_clock_ms) |
| SSE 背压 | [`TANSR_SERVE_SSE_MAX_BUFFER_BYTES`](/serve/env#tansr_serve_sse_max_buffer_bytes) · [`TANSR_SERVE_SSE_SLOW_POLICY`](/serve/env#tansr_serve_sse_slow_policy)（`disconnect` 缺省 / `drop-oldest`）· [`TANSR_SERVE_SSE_RETRY_MS`](/serve/env#tansr_serve_sse_retry_ms) |
| 重放窗字节帽 | [`TANSR_SERVE_EVENT_BUFFER_MAX_BYTES`](/serve/env#tansr_serve_event_buffer_max_bytes)（部署建议 4 MiB / 会话） |

准入拒绝恒 `503 overloaded` 携 `Retry-After`（「本机忙，稍后再来」）；平台铸令牌撞 429 / 5xx / 网络错则 `503 upstream_unavailable`（「上游坏，加压无益」），两者刻意分开。缺省全部不设硬帽。

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

`--token` 与 `TANSR_SERVE_TOKEN` 皆缺即用法错误拒启；缺省仅回环监听，外部接入须显式 `--host 0.0.0.0`；全部端点要求 `Authorization: Bearer <token>`，未带或不匹配一律 401。它是「一容器一智能体实例」的 `/v1` 形态（参考模板 `deploy/serve/`），无询问通道，权限落到「询问」时降级拒绝。放权（`defaultMode: "auto"`）要用环境隔离兜底：容器或最小权限专用用户；文件系统写面限工作目录；网络出口白名单。`tansr doctor` 的「无人值守基线」检查会在 `auto` 且探测不到隔离迹象时给显著提示（不阻断）；确认已隔离后设 `TANSR_ISOLATED=1` 压制提示。`tansr serve --v2` 把 `/v2` 面挂进命令行形态（同一 Bearer + `x-tansr-end-user` 头自报分域），**即将随 tansr 命令行 0.5.0 提供**。
