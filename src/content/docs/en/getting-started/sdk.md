---
title: Node SDK in 5 minutes
description: 'Embed a tansr agent in your own Node.js or Electron program: install @tansr/sdk, obtain a token, create the first session and print the event stream.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - sdk/sessions-and-events
  - sdk/platform-bundle
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
lastVerified: '2026-10-13'
---

`@tansr/sdk` is the headless language binding of the tansr kernel: prompts in, events out, zero UI dependencies. The query loop, tool scheduling, permission engine and context compaction all come from the kernel and are compiled inline; what you get is the same runtime as the `tansr` CLI, embedded in your application as a library. This page is verified against `@tansr/sdk` **0.19.0** (released 2026-10-10); the in-process `createSession` usage has not changed since 0.13.0.

## Where to configure application prompts

Platform `systemPrompt` holds the shared role; SDK `system` holds code-managed business instructions. With the default `fallback` policy, explicit `system` (including `[]`) replaces the platform segment. With `prepend`, the platform segment comes first and stays present even for `[]`. Put environment notes in `systemAppend` to avoid overriding the platform default.

Windows Electron runs the SDK in its main process; renderer input remains a user message. These prompt features are available since `@tansr/sdk` 0.13.0 (the platform side has been live since 2026-09-14). Read-only `session.applicationPrompt` exposes source / policy, without prompt text. Platform prompts and policies refresh before a subsequent turn; an executing turn keeps its configuration, and the same session and history are preserved. See [Application system prompts](/en/sdk/system-prompts/) for the truth table, platform PUT / GET, and complete examples.

## Prerequisites

To add requirements while a task is running, use [same-turn input](/en/sdk/midturn-input/) with `getInputTarget`, `submitInput` and receipt lookup. It does not interrupt the execution or create a session. This first release supports memory text delivery and is available since `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 / CLI 0.6.0.

For application shutdown, see [session and resource cleanup](/en/sdk/lifecycle/). The additive closeAsync / drain APIs distinguish terminal events from actual cleanup; compatible releases are required.

| Requirement | Value |
|---|---|
| Node.js | ≥ 22.19 |
| Electron (if applicable) | ≥ 39; the SDK runs in the main process |
| Module format | ESM only (`"type": "module"`; CJS `require()` is not supported) |
| TypeScript | target ≥ ES2022; Electron projects should set `skipLibCheck: true` |

The published artifact is a single-file ESM bundle plus a single `.d.ts`. The only third-party runtime dependencies are `undici`, `zod` and `zod-to-json-schema`; the optional dependency `@vscode/ripgrep` degrades automatically if it fails to install, nothing to do on your side.

## Install

```bash
npm install @tansr/sdk        # 现行 0.19.0
```

Since 0.18.0 the package also ships the sub-entry `@tansr/sdk/extensions` (archive host / cache host) and 9 optional signature additions; 0.19.0 adds the standalone platform non-chat operations client `createPlatformNonchatClient` (explicit HTTP calls for platform operations such as embeddings, reranking, documents, music, voices and realtime sessions — they never enter the session history and are not assembled as tools). All of it is additive — the root-entry usage and behaviour on this page are unchanged, and you can ignore it unless you need it. To run the agent server-side and let thin clients (Android / iOS / HarmonyOS, or `@tansr/api-client`) reach it over HTTP, use [`@tansr/serve`](/en/getting-started/serve/); new integrations use the unified call surface `/api`.

## Credentials: three model sources, pick one

Where the SDK gets its model decides which credential you need:

| Source | What you pass | Fits |
|---|---|---|
| **Token source** | `{ token, baseUrl }` | Client distribution (Electron / desktop); the model catalog and capability flags are pushed by the platform per app config, zero local config |
| **Managed source (BYOK)** | `model: '<alias>'` + a local `.tansr/settings.json` | Your own servers / scripts, bringing your own model API key |
| **Injected source** | `{ client, model }` as a pair | Tests (scripted models) or custom integrations |

The three are mutually exclusive; mixing them is rejected at assembly time with `invalid_options`. This article uses the **token source**, because that is the right form when handing an agent to end users.

The token source's credential flow is a three-party loop:

1. In the console, create a **desktop app** (or a server app) and obtain `appid` and `appkey`. The appkey stays on your backend only.
2. The client app calls your backend with its own login state; your backend calls `POST /v1/app-tokens` with the appkey to mint a short-lived `app_user` token for that user (`ttlSeconds` 60–86400), and ships only `{ token, expiresAt }` to the client.
3. The client app hands this token to the SDK.

The official sample `examples/token-server` shows a complete mint endpoint (including request signing). **The appkey never leaves your backend** — not shipped to clients, not logged, not in error responses, not committed.

If you are just writing a script on your own machine, you can start with the managed source: declare a provider in `.tansr/settings.json` (write only the environment variable *name* for the API key; the value comes from the environment), then `createSession({ model: 'main' })`.

## First session

```ts
import { createSession } from '@tansr/sdk';

// token 由你的服务端换发;baseUrl 是平台网关地址
const session = await createSession({ token, baseUrl: 'https://api.tansr.com' });

session.send('帮我总结这份合同');

for await (const event of session.events) {
  if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  if (event.type === 'turn.completed') break;
}

session.close();
```

Key points:

- `createSession` is async; always `await` it.
- `send()` starts a new turn when idle; calling `send()` again while a turn is running goes through the kernel's injection barrier and joins the current turn — input is never lost.
- `events` is an `AsyncIterable<KernelEvent>` that is continuous across turns with a monotonic `seq`; several consumers can `for await` at the same time and each gets the full stream.
- `close()` is idempotent; without `close()` the `for await` never exits on its own — the most common cause of "the event stream is stuck".

## See the events

Events are a flat discriminated union; branch directly on `event.type`. On your first run, print every type to get a feel for what happens in a turn:

```ts
for await (const event of session.events) {
  console.log(event.seq, event.type);
}
```

You will see roughly this sequence: `session.created` → `turn.started` → some `msg.block.start` / `msg.text.delta` / `msg.block.end` → (if tools are called) `tool.proposed` / `tool.permission.decided` / `tool.started` / `tool.completed` → `cost.usage.updated` → `turn.completed`.

If you are building a UI, do not stitch events by hand: use `createSessionView` to reduce the event stream into immutable view snapshots, then `createNarrator` to produce human-readable log lines. Both ship with the package.

## Common first hurdles

| Symptom | Cause and fix |
|---|---|
| Throws `invalid_options` | Fields from different sources were mixed, or the token source was given `config` / `capabilities` (with the token source, capability flags are always governed by the platform). Read the message and fix the code |
| Throws `assembly_failed` | The managed-source config is unusable, alias resolution failed, or the token-source bundle fetch failed; `cause` keeps the underlying error |
| Every tool is denied | `permission.askUser` is not wired and the tool is not read-only — the default is fail-closed. See [Sessions and events](/en/sdk/sessions-and-events/) |
| The event stream never exits | You forgot `session.close()` |

## Next steps

- [Sessions and events](/en/sdk/sessions-and-events/): multi-turn semantics, event families, the SessionView projection.
- [Checkpoints and resume](/en/sdk/checkpoints/): persistence, recovery across restarts, manual compaction and snapshots.
- [Platform assembly and the bundle](/en/sdk/platform-bundle/): capability flags, the three tool rings, what the token source receives.
- [Errors and retries](/en/sdk/errors-and-retries/): SDK error codes, platform error codes, what to retry and what not to.
- [SDK 2.0 extension entries](/en/sdk/sdk2-preview/): release status, boundaries and performance disclosure of the shipped `@tansr/sdk/extensions`, `@tansr/serve/extensions` and the unified `/api` surface; in-process integrations need no migration.
