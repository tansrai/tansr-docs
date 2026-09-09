---
title: Session service in 5 minutes
description: 'Run a multi-user agent session service inside your own Node service with @tansr/serve: wire the authentication hook, configure the app key, create the first /v2 session and watch the SSE event stream with curl.'
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
lastVerified: '2026-09-09'
---

`@tansr/serve` is tansr's **agent session engine**: an npm package you embed in your own Node service. Outward it exposes the `/v2` multi-session REST + SSE protocol surface; inward it connects to the tansr platform with your app key and makes real model calls. It is **not a gateway** — how your users sign in, how you rate-limit, how you bill are all yours; the engine only does transport, protocol and session governance.

The Android / iOS SDKs connect to this service.

## Configure the application role on the platform or host

Configure mobile system prompts in the platform application or serve host, not in a `/v2` `prompt`. Omit `platform.system` to use the platform default. Use `platform.system` for code-managed business instructions and `platform.systemAppend` for host notes. Default `fallback` lets explicit business segments (including `[]`) replace the platform segment; `prepend` keeps the platform segment first, including when the SDK supplies `[]`.

These additions await compatible API and serve releases. They control text composition, not permissions. Platform prompts and policies refresh before a subsequent turn; the executing turn keeps its configuration. Existing sessions, live attach, and conversation history remain usable without reopening to change the role. See the complete serve example in [Application system prompts](/en/sdk/system-prompts/).

## Prerequisites

- Node.js ≥ 22.19.
- In the console, create a **mobile app** (for Android / iOS) or a server app and obtain `appid` and `appkey`.
- Your own login system: the engine needs you to map a request to an `endUserId`, nothing more.

## Install

```bash
npm install @tansr/serve
```

The only third-party runtime dependency is `zod`; tansr's internal packages are compiled inline and do not appear in your dependency tree.

## Credentials: appid / appkey stay on the server

Authentication in the session service has three layers; remember who owns each and nothing ends up in the wrong place:

| Layer | Credential | Owner |
|---|---|---|
| Client ↔ session service | Your own login token (JWT, session cookie, OAuth — anything) | Entirely yours; the engine only reads `endUserId` through the `authenticate` hook |
| Session service ↔ tansr platform | `appid` + `appkey` | Held by the service process; the engine uses it to mint an `app_user` token per end user |
| Client holds `appid` | Public app identifier | May be shipped; never a credential |

Three red lines: the appkey is never shipped to clients; the `app_user` token never leaves the session service; the session id is not an authentication factor (every endpoint independently verifies ownership).

Put appid / appkey in environment variables (names are up to you; the examples use the official sample's `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`) — never in code or in the repository.

## First service

The smallest runnable skeleton — authentication hook, built-in real assembly, sessions persisted to disk, start:

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

Always wire the `store`: without it, one process restart wipes the context of every active session, and clients get `409 resume_unavailable` on every `resume`.

Process signals belong to the host: the engine does not listen for SIGTERM on your behalf. At minimum call `server.drain({ timeoutMs: 30_000 })` before exiting; see [Deployment and authentication](/en/serve/deploy-and-auth/).

Want to look at the protocol offline first, without a real platform connection? The in-repo sample `examples/serve-demo` exercises the whole `/v2` protocol layer with an echo agent; start it with one command, `pnpm --filter tansr-example-serve-demo start`, listening on `127.0.0.1:8788` by default.

## First session

Walk through it with curl. `<your login token>` is the one issued by your own system that `authenticate` can verify.

Create a session (with a first prompt):

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

Follow-up input:

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

Returns `202 { "sessionId", "accepted": true }`.

## See the events

Subscribe to the SSE event stream:

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

The first frame is `retry: 3000`; after that, one frame per kernel event: `id: <seq>` plus `data: <KernelEvent JSON>`, with no `event:` name. Only control frames (tool requests, permission requests, questions) carry an `event: server.*` name. A `: hb` comment heartbeat arrives every 15 seconds.

After a disconnect, reconnect with the last consumed seq and the server replays everything after that point from its ring buffer:

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

## serve in CLI form

`tansr serve --token <value>` also starts a long-running service, but it is the single-operator `/v1` surface (`POST /v1/sessions`, `GET /v1/sessions/:id/events` and four more endpoints, one shared Bearer token) — suitable for orchestration systems, not a multi-tenant product backend. `tansr serve --v2`, which mounts the `/v2` surface in the CLI form as well, is **coming in tansr CLI 0.5.0**; until then, use the npm embedding above for multi-tenant `/v2`.

## Next steps

- [Deployment and authentication](/en/serve/deploy-and-auth/): the authentication hook, graceful shutdown, observability endpoints, sharding across replicas.
- [v2 protocol and webhooks](/en/serve/v2-and-webhooks/): the full endpoint set, the three-level recovery chain, end-of-turn outbound notifications and signing.
- [Retention and governance](/en/serve/retention-and-governance/): retention windows, idle reclamation, concurrency caps, session storage.
- [Environment variables](/serve/env): every `TANSR_SERVE_*` knob.
