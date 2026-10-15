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

`@tansr/serve` is tansr's **agent session engine**: an npm package you embed in your own Node service. Outward it exposes a multi-session REST + SSE protocol surface — the unified call surface `/api` (GA since 0.13.0) and the `/v2` session protocol behind it; inward it connects to the tansr platform with your app key and makes real model calls. It is **not a gateway** — how your users sign in, how you rate-limit, how you bill are all yours; the engine only does transport, protocol and session governance. This page is verified against `@tansr/serve` **0.15.1** (released 2026-10-10, the current npm `latest`).

The released Android / iOS / HarmonyOS SDKs connect to this service (over `/v2`); the Node-side thin client is `@tansr/api-client` 0.4.0 (sub-entry `./api`; released 2026-10-06 — since this version the frozen sub-entries `./sdk2` / `./terminal` also target `/api` by default when no `routePrefixes` is passed). **New integrations should go straight to `/api`**: same sessions, same payload bytes, plus four `tansr-*` response headers and the unified error envelope. `/v2` is defined as an internal adapter entry since 0.13.0 and its external entry is removed in 1.0.0. Since 0.15.0, responses on the legacy prefixes `/v2` and `/v3/*` carry `Deprecation` / `Link` retirement headers, but the legacy-prefix window still defaults to `readwrite` as of 0.15.1 (reads and writes are served as before), so `/v2` calls already in production do not need to change today; the window knob and timetable are in [Deployment and authentication](/en/serve/deploy-and-auth/).

## Configure the application role on the platform or host

Configure mobile system prompts in the platform application or serve host, not in a `/v2` `prompt`. Omit `platform.system` to use the platform default. Use `platform.system` for code-managed business instructions and `platform.systemAppend` for host notes. Default `fallback` lets explicit business segments (including `[]`) replace the platform segment; `prepend` keeps the platform segment first, including when the SDK supplies `[]`.

These options are available since `@tansr/serve` 0.8.0; the platform side has been live since 2026-09-14. They control text composition, not permissions. Platform prompts and policies refresh before a subsequent turn; the executing turn keeps its configuration. Existing sessions, live attach, and conversation history remain usable without reopening to change the role. See the complete serve example in [Application system prompts](/en/sdk/system-prompts/).

## Prerequisites

- Node.js ≥ 22.19.
- In the console, create a **mobile app** (for Android / iOS / HarmonyOS) or a server app and obtain `appid` and `appkey`.
- Your own login system: the engine needs you to map a request to an `endUserId`, nothing more.

## Install

```bash
npm install @tansr/serve        # 现行 0.15.1
```

The only third-party runtime dependency is `zod`; tansr's internal packages are compiled inline and do not appear in your dependency tree. Since 0.13.0 the package also ships the sub-entries `@tansr/serve/extensions` (SDK2 archive / cache / terminal-service hosts, explicit assembly required) and `@tansr/serve/process`; nothing on this page depends on them.

## Credentials: appid / appkey stay on the server

Authentication in the session service has three layers; remember who owns each and nothing ends up in the wrong place:

| Layer | Credential | Owner |
|---|---|---|
| Client ↔ session service (`/api`, `/v2`) | Your own login token (JWT, session cookie, OAuth — anything) | Entirely yours; the engine only reads `endUserId` through the `authenticate` hook |
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

Always wire the `store`: without it, one process restart wipes the context of every active session, and clients get `409 resume_unavailable` on every `resume`.

Process signals belong to the host: the engine does not listen for SIGTERM on your behalf. At minimum call `server.drain({ timeoutMs: 30_000 })` before exiting; see [Deployment and authentication](/en/serve/deploy-and-auth/).

Want to see the protocol with a ready-made sample? In the in-repo sample `examples/serve-demo`, `pnpm start` (identical to `pnpm real`) runs the real-model entry `agent-real.ts`, which reads `TANSR_APP_KEY_ID` / `TANSR_APP_KEY` (optionally `TANSR_API_BASE`) from `examples/serve-demo/.env`; with no credentials it exits instead of falling back to an echo. Without the long-running switch it only runs one automatic smoke turn and exits; to keep a server up for curl or mobile integration, add `DEMO_SERVE_ONLY=1` to `.env` and pick the port with `DEMO_PORT` (source default `8799`; the sample README uses `8788`). Since 2026-09-14 the echo agent is only an in-repo test fixture with no public offline start command.

## First session

Walk through it with curl. `<your login token>` is the one issued by your own system that `authenticate` can verify. The examples below use the unified call surface `/api`; replacing `/api/sessions` with `/v2/sessions` yields the same session and the same response body (minus the four `tansr-*` response headers, and errors come in the legacy envelope).

First, see what this deployment has assembled (manifest revision 7, since `@tansr/serve` 0.14.0 and unchanged in 0.15.1):

```bash
curl -s http://127.0.0.1:8787/api/manifest -H "Authorization: Bearer <你的登录 token>" -D - -o /dev/null
# tansr-contract: unified-v1 / tansr-manifest-revision: 7 / tansr-domain: discovery / tansr-schema-hash: …
```

Create a session (with a first prompt):

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

Follow-up input:

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

Returns `202 { "sessionId", "accepted": true }`. On failure `/api` returns the unified envelope `{ "contract": "unified-v1", "code", "status", "retryAction", "detail": { "domainCode", … } }` — one `switch (code)` covers every domain; the original `/v2` code is in `detail.domainCode`.

## See the events

Subscribe to the SSE event stream:

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

The first frame is `retry: 3000`; after that, one frame per kernel event: `id: <seq>` plus `data: <KernelEvent JSON>`, with no `event:` name. Only control frames (tool requests, permission requests, questions) carry an `event: server.*` name. A `: hb` comment heartbeat arrives every 15 seconds. Frame bytes are identical to `/v2`; only when you additionally send the request header `tansr-event-envelope: unified-v1` is `data:` rewritten into the 7-key unified event envelope (the original event sits in `raw`).

After a disconnect, reconnect with the last consumed seq and the server replays everything after that point from its ring buffer:

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

`lastSeq` is a resume anchor — always resume **by value**: a new session returns `0`; for a dormant session (`live: false`) `GET /v2/sessions/:id` returns the persisted watermark, and the new epoch after a resume continues from that watermark + 1 (both since `@tansr/serve` 0.9.0; 0.8.x returns `0` in both places). Detect dormancy with `live`, never with `lastSeq === 0`. Reconnecting with a stale `Last-Event-ID` yields a `server.replay.gap` frame (`reason: 'evicted'`): drop the projection and rebuild from `/history` — see the three-level recovery chain in [v2 protocol and webhooks](/en/serve/v2-and-webhooks/).

## serve in CLI form

`tansr serve --token <value>` also starts a long-running service, but it is the single-operator `/v1` surface (`POST /v1/sessions`, `GET /v1/sessions/:id/events` and four more endpoints, one shared Bearer token) — suitable for orchestration systems, not a multi-tenant product backend. `tansr serve --v2` mounts the `/v2` surface in the CLI form as well (**available since tansr CLI 0.6.0**); since 0.10.0 it also mounts the `/api` facade, and with `--v2` present the `/v1` surface is off by default — the escape hatch `--legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` is deprecated since 0.10.1 (emits a `server.deprecated_option` warning; removed in 1.0.0). The CLI form is currently **0.10.3** (npm `@tansr/cli`, 2026-10-10; it inlines the same service implementation as `@tansr/serve` 0.15.1, and 0.10.2 / 0.10.3 added no commands or flags); SDK2 archive / cache / terminal-service hosts are reachable in the CLI form only through `--host-module <absolute.cjs> --host-module-sha256 <sha256>`. The `@tansr/serve` npm embedding above remains available (0.8.0 and later, currently 0.15.1).

## Next steps

- [Deployment and authentication](/en/serve/deploy-and-auth/): the authentication hook, `/v1` off by default and the legacy-prefix timetable, graceful shutdown, observability endpoints, sharding across replicas.
- [v2 protocol and webhooks](/en/serve/v2-and-webhooks/): the full endpoint set, the three-level recovery chain, end-of-turn outbound notifications and signing.
- [Retention and governance](/en/serve/retention-and-governance/): retention windows, idle reclamation, concurrency caps, session storage, the three 0.14.0 request headers.
- [Environment variables](/serve/env): every `TANSR_SERVE_*` knob.
- [SDK 2.0 extension entries](/en/sdk/sdk2-preview/): explicit `@tansr/serve/extensions` hosts, `@tansr/api-client` 0.4.0 and the performance disclosure.
