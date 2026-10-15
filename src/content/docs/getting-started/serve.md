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
  - getting-started/harmony
  - sdk/sdk2-preview
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-13'
---

`@tansr/serve` 是 tansr 的 **Agent 会话引擎**：一个 npm 包，嵌进你自己的 Node 服务，对外暴露多会话 REST + SSE 协议面——统一调用面 `/api`（0.13.0 起 GA）与它背后的 `/v2` 会话协议——对内用你的应用密钥接通 tansr 平台并真调模型。它**不是网关**——你的用户怎么登录、怎么限流、怎么计费，都归你自己的体系；引擎只做传输、协议与会话治理。本文按 `@tansr/serve` **0.15.1**（2026-10-10 发布，当前 npm `latest`）核对。

Android / iOS / 鸿蒙 SDK 的已发布版本连的就是这个服务（走 `/v2`）；Node 侧的薄客户端是 `@tansr/api-client` 0.4.0（子入口 `./api`；2026-10-06 发布，本版起冻结子入口 `./sdk2` / `./terminal` 不传 `routePrefixes` 时也缺省打 `/api`）。**新集成请直接走 `/api`**：同一会话、同一载荷字节，多四个 `tansr-*` 响应头与统一错误信封；`/v2` 自 0.13.0 起定义为内部适配入口，1.0.0 移除外部入口。0.15.0 起旧前缀 `/v2`、`/v3/*` 的响应附 `Deprecation` / `Link` 退役头，但旧前缀窗口截至 0.15.1 缺省仍是 `readwrite`（读写照常受理），已上线的 `/v2` 调用现在不必改；窗口旋钮与时间表见[部署与鉴权](/serve/deploy-and-auth/)。

## 在平台或宿主配置应用角色

移动端的系统提示词在平台应用配置或 serve 宿主中设置，不放入 `/v2` 的 `prompt`。省略 `platform.system` 使用平台默认；代码管理的业务段放 `platform.system`，宿主补充说明放 `platform.systemAppend`。默认 `fallback` 允许显式业务段（包括 `[]`）替代平台段；`prepend` 保留平台段在前，即使 SDK 段是 `[]`。

这些选项自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线。它们只控制文本组合，不替代权限。平台提示词与策略在后续新一轮前刷新，当前执行轮保持既有配置；已有会话、attach 和历史可继续使用，无需为了改角色重开会话。参见[应用系统提示词与 SDK 拼接策略](/sdk/system-prompts/)中的 serve 完整示例。

## 前提

- Node.js ≥ 22.19。
- 在控制台创建一个**移动应用**（给 Android / iOS / 鸿蒙用）或服务端应用，拿到 `appid` 与 `appkey`。
- 你自己的登录态体系：引擎需要你把一个请求映射成一个 `endUserId`，其余不管。

## 安装

```bash
npm install @tansr/serve        # 现行 0.15.1
```

唯一第三方运行时依赖是 `zod`;tansr 内部包已编译内联，不会出现在你的依赖树里。0.13.0 起包内另有子入口 `@tansr/serve/extensions`（SDK2 归档 / 缓存 / 终端服务宿主，须显式装配）与 `@tansr/serve/process`，本文的根入口用法不依赖它们。

## 凭据：appid / appkey 放在服务端

会话服务的鉴权分三层，记住归属就不会放错：

| 层 | 凭据 | 归属 |
|---|---|---|
| 客户端 ↔ 会话服务（`/api`、`/v2`） | 你自定的登录态 token（JWT、session cookie、OAuth 皆可） | 完全你自己；引擎只经 `authenticate` 缝取 `endUserId` |
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
  token: process.env.MY_V1_TOKEN!, // /v1 面的 Bearer;fail-closed 必填;v2 在场时 /v1 缺省关闭,与 /api、/v2 鉴权互不相通
  createSession: build.factory,
  version: '1.0.0',
  v2: { // v2 在场 = 同时装配 /api 门面与 /v2 内部入口
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

想先用现成示例看协议？仓内示例 `examples/serve-demo` 的 `pnpm start`（与 `pnpm real` 相同）走真模型入口 `agent-real.ts`，从 `examples/serve-demo/.env` 读 `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`（可选 `TANSR_API_BASE`），缺凭据即退出、不回退到回显。未设常驻开关时它只自动跑一轮冒烟便退出；要起一台常驻服务给 curl 或移动端联调，在 `.env` 里加 `DEMO_SERVE_ONLY=1`，端口由 `DEMO_PORT` 指定（源码缺省 `8799`，示例 README 用 `8788`）。回显 Agent 自 2026-09-14 起只是仓内测试夹具，没有公开的离线启动命令。

## 第一个会话

用 curl 直接走一遍。`<你的登录 token>` 是你自己体系签发、`authenticate` 能验的那枚。下面用统一调用面 `/api`；把 `/api/sessions` 换成 `/v2/sessions` 得到的是同一会话、同一响应体（少四个 `tansr-*` 响应头，错误体为旧信封）。

先看一眼这台服务装配了什么（manifest revision 7，自 `@tansr/serve` 0.14.0 起，0.15.1 未变）：

```bash
curl -s http://127.0.0.1:8787/api/manifest -H "Authorization: Bearer <你的登录 token>" -D - -o /dev/null
# tansr-contract: unified-v1 / tansr-manifest-revision: 7 / tansr-domain: discovery / tansr-schema-hash: …
```

创建会话（带首条 prompt）：

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

后续输入：

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

返回 `202 { "sessionId", "accepted": true }`。出错时 `/api` 回统一信封 `{ "contract": "unified-v1", "code", "status", "retryAction", "detail": { "domainCode", … } }`，一套 `switch (code)` 覆盖全部域；需要原 `/v2` 码读 `detail.domainCode`。

## 看到事件

订阅 SSE 事件流：

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

首帧是 `retry: 3000`，随后每一条内核事件一帧：`id: <seq>` 加 `data: <KernelEvent JSON>`，不带 `event:` 名；控制帧（工具请求、权限请求、提问）才带 `event: server.*` 名。每 15 秒一条 `: hb` 注释心跳。帧字节与 `/v2` 逐字节相同；只有显式再加请求头 `tansr-event-envelope: unified-v1` 时，`data:` 才改写为 7 键统一事件包络（原事件在 `raw`）。

断线后带上最后消费的 seq 重连，服务端从环形缓冲重放断点之后的事件：

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

`lastSeq` 是恢复锚，端侧恒**按值续传**：新建会话返回 `0`；`GET /v2/sessions/:id` 对休眠会话（`live: false`）返回落盘的真值水位，resume 重灌后的新纪元自该水位 + 1 起（这两处自 `@tansr/serve` 0.9.0 起生效；0.8.x 恒返回 `0`）。判休眠看 `live`，不看 `lastSeq === 0`。携过旧的 `Last-Event-ID` 重连会收到 `server.replay.gap` 帧（`reason: 'evicted'`），此时弃投影、拉 `/history` 重建——三级恢复链见[v2 协议与 webhook](/serve/v2-and-webhooks/)。

## 命令行形态的 serve

`tansr serve --token <值>` 也能起一个常驻服务，但它是单运维方的 `/v1` 面（`POST /v1/sessions`、`GET /v1/sessions/:id/events` 等六端点，同一枚 Bearer token），适合编排系统接入，不是多租户产品后端。`tansr serve --v2` 把 `/v2` 面挂进命令行形态（**tansr 命令行 0.6.0 起提供**），0.10.0 起同时装配 `/api` 门面，且 `--v2` 在场时 `/v1` 面缺省关闭——确需保留的 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` 自 0.10.1 起已标废弃（出 `server.deprecated_option` 警告，1.0.0 移除）。命令行形态现行 **0.10.3**（npm `@tansr/cli`，2026-10-10；内联 `@tansr/serve` 0.15.1 同一服务实现，0.10.2 / 0.10.3 未新增命令或旗标）；SDK2 归档 / 缓存 / 终端服务宿主在命令行形态只经 `--host-module <absolute.cjs> --host-module-sha256 <sha256>` 可达。也可继续使用上文的 `@tansr/serve` npm 嵌入形（0.8.0 起，现行 0.15.1）。

## 下一步

- [部署与鉴权](/serve/deploy-and-auth/)：鉴权缝、`/v1` 缺省关闭与旧前缀时间表、优雅关闭、观测端点、多副本分片。
- [v2 协议与 webhook](/serve/v2-and-webhooks/)：端点全形、三级恢复链、轮末出站通知与签名。
- [保留期与治理](/serve/retention-and-governance/)：保留窗、闲置回收、并发帽、会话存储、0.14.0 的三个请求头。
- [环境变量表](/serve/env)：全部 `TANSR_SERVE_*` 旋钮。
- [SDK 2.0 扩展入口](/sdk/sdk2-preview/)：`@tansr/serve/extensions` 显式宿主、`@tansr/api-client` 0.4.0 与性能披露。
