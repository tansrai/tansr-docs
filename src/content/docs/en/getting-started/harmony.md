---
title: HarmonyOS SDK in 5 minutes
description: 'Integrate @tansr/harmony in a native HarmonyOS app: depend on a local HAR, provide your own login credential, create the first session and reduce the event stream into SessionView.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - harmony
  - android
  - ios
  - getting-started/serve
  - serve/v2-and-webhooks
sources:
  - tansr-harmony:README.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-16'
---

`@tansr/harmony` is a **native ArkTS thin client** (HAR) of the session service `/v2` protocol: it sends input, reduces the event stream, runs the local tools you explicitly register, and answers permission and question prompts. The agent kernel, permission engine and context governance all run in the `@tansr/serve` you deploy; the phone holds no platform credential. View reduction shares the same golden samples as Android / iOS. The HAR **does not include ArkUI pages**; recording, playback and list virtualization belong to the host.

Devices that only run the Android-compatible HarmonyOS stack keep using the [Android SDK](/en/getting-started/android/). The current minimum is HarmonyOS 6.0 / API 20 (Stage model). Native HarmonyOS 5.x compatibility is follow-on work; this article does not claim it is available. The package is not published to OHPM; integrate a local HAR.

## Send user messages on the phone; configure system prompts on the server

`createSession` and `session.send(...)` send ordinary user messages. The HarmonyOS SDK does not submit `system` through `/v2`. Manage the shared role in platform application settings, a code-managed role in serve `platform.system`, and host notes in `platform.systemAppend`.

The prompt and policy features are available since `@tansr/serve` 0.8.0; the platform side has been live since 2026-09-14. Default `fallback` lets explicit SDK `system` (including an empty array) replace the platform segment; `prepend` retains the platform segment first. Platform prompts and policies refresh before a subsequent turn, while an executing turn keeps its configuration. Foreground reconnects, SSE recovery, and live attach preserve the session and history without reopening to get an update. Application managers must resolve conflicting business instructions, and permissions remain separate. See [Application system prompts](/en/sdk/system-prompts/).

## Prerequisites

- A reachable `@tansr/serve` service (see [Session service in 5 minutes](/en/getting-started/serve/)). For local development you can start the in-repo sample `examples/serve-demo` (default `127.0.0.1:8788`).
- DevEco Studio 6.0+, HarmonyOS SDK API 20+; the host HAP declares `ohos.permission.INTERNET`. Recording and similar permissions are declared and requested by the host that actually uses them.
- Your own login system: on every request the SDK takes a short-lived auth header from `AuthProvider` (usually `Authorization: Bearer <your login token>`), and the server's `authenticate` hook resolves it to an `endUserId`. Do not hold a platform AppKey, upstream model key, or server signing private key on the client.

## Install

In the SDK repository, DevEco or `./scripts/native.ps1 -Action har` produces `tansr/build/default/outputs/default/tansr.har`. Copy it to the business module as `libs/tansr.har`, then:

```json
{ "dependencies": { "@tansr/harmony": "file:./libs/tansr.har" } }
```

Run `ohpm install`. The SDK has no external runtime dependency and does not include Node.js, React Native, WebView, or an Android compatibility runtime. Consuming the HAR from a separate project is enough to prove the wiring; you do not need to embed the demo HAP in your app.

## Credentials: only your own login state

The SDK **never persists credentials**: each request takes headers once from `AuthProvider.headers()` and discards them. In production wrap your `CredentialIssuer` with `RefreshingAuthProvider` to handle expiry, concurrent refresh, and identity change. Do not silently replay a password login after a refresh failure; an identity change after minting must tear down that instance.

```typescript
import { NativeHttpTransport, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient(
  'https://agent.example.com',
  new NativeHttpTransport(),
  new StaticAuthProvider(headers),
);
```

`StaticAuthProvider` is only for short debugging. HTTPS is required by default; loopback HTTP is for local debugging only. When a real device reaches a private address on your development machine, turn on intranet HTTP explicitly with `NativeHttpOptions.allowPrivateNetworkHttp` — ordinary public cleartext HTTP is not allowed, and TLS certificate errors are not ignored.

## First session

After a successful create, **write the confirmed sessionId into the original login scope first**, then bind the UI. If persistence fails or the response is unconfirmed, report it to the user; do not automatically create another session. `verifiedEndUserId` must come from a verified login receipt.

```typescript
import { AgentSession, JsonNode, NativeHttpTransport, SessionHistory,
  SessionView, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient('https://agent.example.com', new NativeHttpTransport(), new StaticAuthProvider(headers));

const created = await client.createSession();
// 已确认的会话 ID 先写入原登录作用域，再绑界面
const session = new AgentSession(client, created.sessionId, verifiedEndUserId);
const view = new SessionView('stream', 'off');
view.onChange = (): void => render(view.state);
session.onHistory = (history: SessionHistory): void => view.restoreHistory(history.messages);
session.onFrame = (eventName: string, data: JsonNode): void => {
  if (!eventName.startsWith('server.')) view.consume(data);
};
session.start();
await session.send('hi');
```

`session.stop()` only cancels the local subscription and bridges; it does not drop the remote session. `session.start()` resumes the subscription. `close()` is what requests closing the remote session. Foreground/background, sign-out, and component disposal must call these entry points. A send receipt only means acceptance; actual output arrives on the event stream.

To continue a previous chat after a cold start: look up ownership of the original sessionId, then let the SDK attach / history / resume. On restore failure keep the original id and report the reason; do not treat forbidden, corruption, and a temporary network error as "create a new one".

## See the events

`SessionView.state` is already the reduced view snapshot (message list, tool cards, todos, usage, `lastError`). Most UIs subscribe to `onChange`. `onFrame` delivers raw SSE frames; `server.*` control frames go to `session.bridges`. Do not pop a second permission prompt from ordinary `tool.permission.*` events.

Watch connection state through `session.onState`: `idle` → `connecting` / `recovering` → `live`, a blip is `retrying`, protocol or auth failure is `failed`, and `close()` ends in `closed`. Disconnects never surface as business codes: L1 reconnects with the cursor, L2 rebuilds from `/history` after a gap, L3 resumes when metadata is 404 or `live = false`. `lastSeq` always continues by value; the idle criterion is always `live = false`.

## Local tools and dialogs

Register a local tool with `session.bridges.registerTool(declaration, handler)` and pass the same `clientTools` declarations on `createSession` / resume. `parameters` is a "name → spec" dictionary; no parameters is `{}`, never a whole JSON Schema. If `onPermission` is unset, the default is deny. Only `server.permission.request` triggers a prompt; after the user confirms, call `answerPermission(id, 'allow' | 'deny')`. Questions use the separate `onQuestion` / `answerQuestion` pair; extra text is not a tool approval.

```typescript
const declaration = JsonNode.object()
  .set('name', JsonNode.string('searchOrders'))
  .set('description', JsonNode.string('Search the user orders'))
  .set('parameters', JsonNode.object().set('keyword', JsonNode.object()
    .set('type', JsonNode.string('string'))
    .set('description', JsonNode.string('search keyword'))))
  .set('readOnly', JsonNode.boolean(true));
session.bridges.registerTool(declaration, {
  async execute(args, cancel) {
    cancel.throwIfCancelled();
    return JsonNode.object().set('status', JsonNode.string('ok'))
      .set('content', JsonNode.array([
        JsonNode.object().set('t', JsonNode.string('text')).set('text', JsonNode.string(db.search(args.stringAt('keyword')))),
      ]));
  },
});
```

OS microphone permission and agent tool permission are two layers; one cannot replace the other. The server cwd is never mapped to an arbitrary local path.

## Common first hurdles

| Symptom | What to do |
|---|---|
| 401 as soon as it connects | The headers from `AuthProvider` are not accepted by the server's `authenticate`. Fix the login state, then `start()` again |
| Emulator / device cannot connect | Loopback is local debugging only; reaching a private address on the development machine needs `allowPrivateNetworkHttp`. Production always uses TLS |
| createSession returns 400 | `clientTools.parameters` was written as a whole JSON Schema; it must be a parameter-name dictionary |
| New session returns 429 | Each end user has at most 8 live sessions by default; `close()` unused sessions |

## Next steps

- [HarmonyOS integration guide](/en/harmony/): session lifecycle, three-level recovery, tool bridges, the two voice links, dual speech caps, media download bounds.
- [Android and iOS in 5 minutes](/en/getting-started/android/): compare the three-client contract.
- [v2 protocol and webhooks](/en/serve/v2-and-webhooks/): how the server half hands end-of-turn notices to your push backend.
