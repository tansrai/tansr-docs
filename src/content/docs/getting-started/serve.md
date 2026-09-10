---
title: 会话服务 5 分钟跑通
description: 用 @tansr/serve 在自己的 Node 服务里跑起一个多用户的智能体会话服务——接鉴权缝、配应用密钥、创建第一个 /v2 会话并用 curl 看到 SSE 事件流。
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - serve/deploy-and-auth
  - serve/v2-and-webhooks
  - serve/retention-and-governance
  - serve/env
  - getting-started/android
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-09-10'
---

`@tansr/serve` 是 tansr 的 **Agent 会话引擎**：一个 npm 包，嵌进你自己的 Node 服务，对外暴露 `/v2` 多会话 REST + SSE 协议面，对内用你的应用密钥接通 tansr 平台并真调模型。它**不是网关**——你的用户怎么登录、怎么限流、怎么计费，都归你自己的体系；引擎只做传输、协议与会话治理。

Android / iOS SDK 连的就是这个服务。

## 在平台或宿主配置应用角色

移动端的系统提示词在平台应用配置或 serve 宿主中设置，不放入 `/v2` 的 `prompt`。省略 `platform.system` 使用平台默认；代码管理的业务段放 `platform.system`，宿主补充说明放 `platform.systemAppend`。默认 `fallback` 允许显式业务段（包括 `[]`）替代平台段；`prepend` 保留平台段在前，即使 SDK 段是 `[]`。

这些新增选项尚待 API 与 serve 配套发布。它们只控制文本组合，不替代权限。平台提示词与策略在后续新一轮前刷新，当前执行轮保持既有配置；已有会话、attach 和历史可继续使用，无需为了改角色重开会话。参见[应用系统提示词与 SDK 拼接策略](/sdk/system-prompts/)中的 serve 完整示例。

## 前提

- Node.js ≥ 22.19。
- 在控制台创建一个**移动应用**（给 Android / iOS 用）或服务端应用，拿到 `appid` 与 `appkey`。
- 你自己的登录态体系：引擎需要你把一个请求映射成一个 `endUserId`，其余不管。

## 安装

```bash
npm install @tansr/serve
```

唯一第三方运行时依赖是 `zod`;tansr 内部包已编译内联，不会出现在你的依赖树里。

## 凭据：appid / appkey 放在服务端

会话服务的鉴权分三层，记住归属就不会放错：

| 层 | 凭据 | 归属 |
|---|---|---|
| 客户端 ↔ 会话服务 | 你自定的登录态 token（JWT、session cookie、OAuth 皆可） | 完全你自己；引擎只经 `authenticate` 缝取 `endUserId` |
| 会话服务 ↔ tansr 平台 | `appid` + `appkey` | 服务进程持有；引擎用它为每个终端用户换取 `app_user` 令牌 |
| 客户端持有 `appid` | 公开应用标识 | 可下发，恒非凭据 |

红线三条：appkey 恒不下发到端；`app_user` 令牌恒不出会话服务；会话 id 不是鉴权因子（每个端点都独立校验归属）。

把 appid / appkey 放进环境变量（名字随你，示例沿用官方样板的 `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`），不要写进代码或仓库。

## 第一个服务

最小可跑骨架——鉴权缝、内置真装配、会话落盘、启动：

```ts
import {
  createAgentSessionFactory,
  createServeAgentSessionStore,
  registerBuiltinLocales,
  startServer,
} from '@tansr/serve';

registerBuiltinLocales(); // 可选:错误体文案本地化

// 真装配:appid/appkey → 每个终端用户一枚短期令牌 → 内核查询环真调模型
const build = createAgentSessionFactory({
  platform: {
    apiBaseUrl: 'https://api.tansr.com',
    appId: process.env.TANSR_APP_KEY_ID!,
    appKey: process.env.TANSR_APP_KEY!, // 恒不下发端、恒不入日志
  },
  store: createServeAgentSessionStore({ dir: '/var/lib/my-agent/sessions' }), // 生产恒接
  cwd: process.cwd(),
});

const server = await startServer({
  host: '127.0.0.1',
  port: 8787,
  token: process.env.MY_V1_TOKEN!, // /v1 面的 Bearer;与 /v2 鉴权互不相通
  createSession: build.factory,
  version: '1.0.0',
  v2: {
    // 唯一鉴权面:你的登录态 → endUserId;返回 null 即 401
    authenticate: async (req) => {
      const user = await myAuth.verify(req.headers['authorization']);
      return user ? { endUserId: user.id } : null;
    },
    createSession: build.factory,
    store: build.storeReader, // 让休眠会话可列表 / 可 resume
  },
});
```

`store` 一定要接：不接的话进程一重启，全部活跃会话的上下文全量灭失，客户端 `resume` 恒 `409 resume_unavailable`。

进程信号归宿主：引擎不会替你监听 SIGTERM。至少接上 `server.drain({ timeoutMs: 30_000 })` 再退出，详见[部署与鉴权](/serve/deploy-and-auth/)。

想先离线看协议、不接真平台？仓内示例 `examples/serve-demo` 用一个回显 Agent 打通了全部 `/v2` 协议层，起服务一条命令：`pnpm --filter tansr-example-serve-demo start`，缺省监听 `127.0.0.1:8788`。

## 第一个会话

用 curl 直接走一遍。`<你的登录 token>` 是你自己体系签发、`authenticate` 能验的那枚。

创建会话（带首条 prompt）：

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

后续输入：

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

返回 `202 { "sessionId", "accepted": true }`。

## 看到事件

订阅 SSE 事件流：

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

首帧是 `retry: 3000`，随后每一条内核事件一帧：`id: <seq>` 加 `data: <KernelEvent JSON>`，不带 `event:` 名；控制帧（工具请求、权限请求、提问）才带 `event: server.*` 名。每 15 秒一条 `: hb` 注释心跳。

断线后带上最后消费的 seq 重连，服务端从环形缓冲重放断点之后的事件：

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

## 命令行形态的 serve

`tansr serve --token <值>` 也能起一个常驻服务，但它是单运维方的 `/v1` 面（`POST /v1/sessions`、`GET /v1/sessions/:id/events` 等六端点，同一枚 Bearer token），适合编排系统接入，不是多租户产品后端。`tansr serve --v2` 把 `/v2` 面也挂进命令行形态，**tansr 命令行 0.6.0 已提供**；也可继续使用上文的 `@tansr/serve@0.8.0` npm 嵌入形。

## 下一步

- [部署与鉴权](/serve/deploy-and-auth/)：鉴权缝、优雅关闭、观测端点、多副本分片。
- [v2 协议与 webhook](/serve/v2-and-webhooks/)：端点全形、三级恢复链、轮末出站通知与签名。
- [保留期与治理](/serve/retention-and-governance/)：保留窗、闲置回收、并发帽、会话存储。
- [环境变量表](/serve/env)：全部 `TANSR_SERVE_*` 旋钮。
