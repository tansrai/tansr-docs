---
title: Android integration guide
description: 'Module layering of the Kotlin SDK, event reduction and SessionView, the connection state machine and three-level recovery chain, foreground/background and Doze policy, error presentation, local tools and the two bridges, the two voice links, self-wired push wake-up, and credential and logging discipline.'
zone: docs
category: android
related:
  - sdk/system-prompts
  - getting-started/android
  - ios
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-android:doc/report/ANDROID-MEDIA-03-0.4.0-发布记录.md
  - tansr-android:doc/report/REL-ANDROID-05-0.5.0-发布记录.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

The Android SDK (Maven coordinates `com.tansr.sdk:core` / `:client` / `:compose`, optional `:receiver-android`, package prefix `com.tansr.sdk`) is a thin protocol client of the session service: it implements the agent session service contract, and every request leaves through the unified call surface `/api`. This page covers every design point you meet after the quick start: how events become UI state, how disconnects recover, how foreground/background is handled, how errors are presented, how tools and dialogs are wired, how voice and push are wired. It is verified against the released **0.5.0** (Maven Central, 2026-10-07; four modules at the same version) and against `@tansr/serve` 0.15.1 on the server side (npm latest, 2026-10-10).

## Versions and the server-side prefix (verified 2026-10-13)

- Since 0.5.0 (on Maven Central 2026-10-07, source `50306a2c`), every HTTP request of the SDK goes only through the unified call surface `/api` that the server provides since 0.13.0 (D10: immediate switch, no `/v2` fallback kept). Paths, methods and header names come from `ApiContract` / `ApiOps` (81 operations) generated from manifest revision 7; the session family is no longer distinguished by path but carried explicitly in the request header `tansr-session-family: sdk1 | sdk2-offload-v1`. The server must have the `/api` facade assembled (`@tansr/serve` 0.13.0 or later; r7 since 0.14.0).
- Also shipped with 0.5.0: the public exception model keyed by unified error codes (D19, a breaking change relative to 0.4.0; the old family-specific sealed types are `@Deprecated` and kept for one release), the unified response-header gate on SDK1 success responses and the event stream (D10 / D38), and `ApiCallOptions` for the three request headers `Idempotency-Key` / `If-Match` / `deadline`. This page describes that behavior.
- The older 0.1.0 – 0.4.0 still talk to `/v2` directly. Server-side `/v2` has been only an internal adapter entry since 0.13.0 and its external entry is removed in 1.0.0; apps still on those versions should upgrade to 0.5.0 — see [Deployment and authentication](/en/serve/deploy-and-auth/) for the timeline.

## Send user messages on the phone; configure system prompts on the server

`CreateSessionRequest(prompt=...)` and `session.send(...)` both send ordinary user messages; Android / iOS do not submit `system` through the session requests on `/api`. The shared role is managed in platform application settings, a code-managed role is provided by serve `platform.system`, and host notes go into `platform.systemAppend`.

The prompt and policy features are available since `@tansr/serve` 0.8.0; the platform side has been live since 2026-09-14. Under the default `fallback`, an explicit SDK `system` (including an empty array) replaces the platform segment; under `prepend` the platform segment stays first. Platform prompts and policies refresh before the next new turn while the executing turn stays fixed; foreground reconnects, SSE recovery and attach keep the original session and history, so you do not need to reopen a session to pick up the update. Application administrators resolve conflicts between business segments; permissions still go through their own mechanism. See [Application system prompts](/en/sdk/system-prompts/).

## Module layering

| Module | Type | Contents |
|---|---|---|
| `:core` | Pure Kotlin/JVM, zero Android dependencies | Contract constants and the generated `/api` contract (`ApiContract` / `ApiOps` with 81 operations, `UnifiedCode` with 19 unified codes, `UnifiedRetryAction`), `ApiCallOptions`, the `KernelEvent` sealed class family (47 types + tolerant `Unknown`), the IR message model, SSE parsing / dispatch, the `SessionView` reducer and `viewStateFromHistory`, tool-card artifact parsing `toolCardArtifact` plus the search / network result projections `SearchResultDetails` / `NetworkResultDetails`, protocol client logic and the transport abstraction, the direct audio surface `AudioClient`, the reconnect state machine, `defineTool` and the remote tool bridge, the permission / question bridges `SessionBridges`, `BridgeDialogState`; the SDK 2.0 thin client `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSyncClient` and the terminal-services client `TerminalClient` |
| `:client` | Pure Kotlin/JVM | OkHttp transport implementation, the `TansrAgent` entry factory |
| `:compose` | Android library | Thin Compose binding: `collect*AsStateWithLifecycle`, `TansrSessionLifecycle`, default permission / question dialogs, `TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`; all replaceable, theme-agnostic, no player and no permissions; error copy is presented by unified code + `retryAction` |
| `:receiver-android` | Android library (optional, first released in 0.5.0) | The SDK 2.0 on-device persistence layer: SQLite archive receiver, sync store and durable execution journal (`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteSyncArchiveStore` / `Sdk2SqliteExecutionJournal`); does not replace the three modules, add it only when you integrate SDK 2.0 device execution |

`:core` / `:client` are deliberately pure JVM so the protocol surface can be unit-tested without a device. The public API surface is guarded by binary-compatibility-validator; every change goes through an explicit diff. The four modules share one version number; upgrade them together.

## Event reduction: three flows

```kotlin
session.events          // SharedFlow<KernelEvent>(replay = 0;历史语义归 view 与恢复链)
session.view            // StateFlow<SessionViewState>(reducer 投影,conflated)
session.connectionState // StateFlow<ConnectionState>
```

- `events` are the raw kernel events, one per server-side SSE frame; unknown types decode to `Unknown(type, raw)` and never throw, and bad JSON is only counted into a diagnostic field without breaking the stream. Session contract revision 9 (vendored with 0.5.0) registers 55 event types, of which the SDK decodes 47; the newer SDK-only event `session.events_dropped` (contract-v0.27, the in-process back-pressure fallback of the Node SDK) is never emitted by serve and never appears on the `/v2` stream — if it ever shows up it is tolerated as `Unknown`, with no rendering obligation on the device.
- `view` is the **reduced view state**: the message list (user / assistant / tool cards), todos, usage, `lastError`, `notices`. Most UIs subscribe to it directly; do not assemble `msg.text.delta` yourself. The reducer shares one set of golden fixtures with the TS / Swift implementations, so projection semantics are identical on all three clients.
- Presentation profile `SessionViewOptions(delivery = …)`: text and thinking each choose `stream` / `final` (thinking also has `off`); `setDelivery` switches at block granularity while running.

Tool-card artifacts are decoded by shape with `toolCardArtifact(data)`: URL artifacts for image / video / web search, and for voice `Transcript(model, text, language?, durationSec?)` / `Speech(model, url?, b64?, mime, format, durationMs?, billedChars)`; when `errorCode` is present the result is always null. `TansrToolCard` renders these shapes by default; the two slots `messageActions` / `speechAction` let you attach "play / stop" buttons.

## Connection state machine and the three-level recovery chain

```text
Idle → Connecting → Live
Live → Retrying(指数退避,尊重服务端 retry 首帧)→ Live          // L1:携 Last-Event-ID 重连,重放按 seq 去重
Live → Recovering(拉 /history 重建)→ Live                        // L2:重连首帧收到 gap
401 → AuthExpired(回调 authProvider 重取)→ 刷够仍 401 → Failed(Unauthorized)
200 流缺统一响应头 → Failed(ContractUnavailable)                   // D38:部署形态错误,不退避不重连
```

| Level | Trigger | What the SDK does |
|---|---|---|
| L1 | Blip / network switch / return to foreground | Reconnects automatically with `Last-Event-ID=<last consumed seq>`; incoming frames are de-duplicated by seq |
| L2 | First frame after reconnect is `server.replay.gap` | Drops the current projection → `GET /api/sessions/:id` → `GET …/history` → rebuilds via `viewStateFromHistory` → resubscribes from `lastSeq` |
| L3 | Metadata 404 or `live = false`, or a cold start holding only the sessionId | `POST /api/sessions { resume }` → `resumed = true, lastSeq = <new epoch start>` → drops the old cursor and rebuilds per L2 (anchored on `history.lastSeq`, never reading that response value) |

Zero business code throughout. To continue the last chat after a cold start: `CreateSessionRequest(resumeSessionId = savedId)` — the SDK defaults to **attach-first**: a GET metadata probe first; attach if active (zero upstream cost), resume-reload only if inactive, and create a new session only when the store has no record. A terminated session (`Closed`) is never revived automatically.

**`lastSeq` always continues by value, and the idle criterion is always `live = false`** — never `lastSeq == 0`. Since `@tansr/serve` 0.9.0, the metadata `lastSeq` of an idle session is the true watermark persisted in the store, and the new epoch after resume continues from that watermark + 1 (both were always `0` in 0.8.x); the SDK's L3 already drops the old cursor and anchors on `history.lastSeq`, so neither version needs device-side adaptation. `live = true` with `lastSeq == 0` only goes through L2 and never resumes.

**The 401 convergence rule**: event stream 401 → re-fetch the token through `authProvider` and reconnect, **at most 2 times per connection** (first back-off 0 ms, second 1000 ms; `AgentSessionConfig.authRetry` is configurable but always finite); still 401 means `connectionState = Failed(Unauthorized)` + `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`, the pump stops and never reconnects automatically again; the host must fix the login state and call `start()` explicitly. A 401 after a refreshed token is a revocation or misconfiguration, not jitter.

**The unified response-header gate (D10 / D38)**: every 2xx JSON response and every 200 event stream is checked for the four response headers `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` before the body / frames are read; a missing or malformed header throws `TansrAgentException.ContractUnavailable(status, reason)` (`reason` names the violation, e.g. `missing_header:tansr-contract`) — **not a business success, and no fallback to the old prefixes**. A 2xx-shaped contract-unavailable — typically `baseUrl` not pointing at the `/api` facade, a proxy cache page, a captive portal — sends the pump straight to the terminal `Failed` state: this is a deployment-shape error rather than a transient fault, retrying is pointless, fix it and call `start()` explicitly; ≥400 shapes (proxy 502 / 503 HTML pages and the like) still back off by status-code policy. The unified facade always emits the four headers; only self-built fake servers / test fixtures need to add them.

## Foreground/background and Doze

Long-lived background connections are unreliable and drain battery, so the SDK's policy is **stop the pump and drop the stream when going to the background, and pick the recovery path automatically by recovery window when returning**:

- Warm (back within 60 s by default): L1 direct resumption;
- Over the threshold with a turn running while in the background: L2 `history` rebuild first, avoiding a subscription destined to gap;
- Session reclaimed while idle (server default: reclaimed 5 min after everyone leaves / 24 h idle): 404 → L3 self-heals.

Compose wires it in one line, `TansrSessionLifecycle(session)` (`repeatOnLifecycle(STARTED)` start/stop); non-Compose hosts call `start()` in the foreground and `stop()` in the background, both idempotent, and `stop` does not lose the session. The threshold is tuned via `AgentSessionConfig.warmResumeWindowMs`. The decision is the `:core` pure function `LifecyclePolicy`, covered by JVM unit tests. During Doze forced-idle windows the pump is already stopped (no active subscriber on the server); turning the screen on and returning to the foreground self-heals by the same policy; aggressive vendor background killing is equivalent to a cold-start L3.

Server-side cooperation: 60 s after all subscribers leave, the server interrupts the running turn (end-of-turn persistence still happens) and closes it into the store after 5 min — so "I went to the background and came back to find the turn interrupted" is designed behavior; history is not lost and resume continues. To tell the user "the turn finished" while in the background, use the push wake-up below.

## Error presentation

| Source | Shape | Presentation advice |
|---|---|---|
| In-session errors | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner` renders it by default; when `detail.scope == 'plan'` use "try again later" wording rather than "local rate limit" |
| Advisory | `view.notices` (`turn.error` with `recoverable: true`, e.g. a server-side persistence failure) | Soft hint; do not block input |
| Connection state | `connectionState` | `TansrConnectionBanner`: `Reconnecting…` / `Recovering` / authentication expired |
| HTTP surface | `TansrAgentException.Unified`: `code` is one of the 19 unified codes (`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …), `retryAction` is one of 6 actions (`none` / `same-request` / `query-status` / `rediscover` / `rebind` …), the original family code and status stay in `domainCode` / `domainStatus` (e.g. `session_not_found`, `session_limit_exceeded`), plus `traceId` / `requestId` / `retryAfterSeconds`; a facade contract failure is `ContractUnavailable(status, reason)`; the SDK 2.0 / terminal-services surface throws the same-shaped `ApiFacadeException`. The old family-specific sealed types (`SessionNotFound` and 32 others) and `Unified.toLegacy()` are all `@Deprecated`, kept for one release, and only appear on legacy envelopes without a `tansr-contract` header; `Network` / `Protocol` / `Unauthorized` / `Forbidden` remain | Branch on `code` + `retryAction`; use `domainCode` only for diagnostic detail; stop reconstructing the old types from `domainCode` |

For `capacity_exceeded` (429 shape, `retryAction = same-request`) read `retryAfterSeconds` (taken from the `Retry-After` header, or rounded up from the envelope `retryAfterMs` when the header is absent) and wait; when `domainCode = session_limit_exceeded` (each end user has 8 active sessions by default, serve `maxSessionsPerEndUser`) ask the user to close unused sessions. Error messages are always English; the host localizes by `code`.

## Local tools and the two bridges

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) }
}
val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(), bridges = dialogs.bridges(tools = listOf(searchOrders)))
```

- `defineTool`: `name` / `description` / JSON parameter table / `readOnly` (default false, conservatively treated as a writing tool) / `timeoutMs?`; the handler is a suspend function — a String is passed through, anything else is JSON-serialized, and a thrown exception is normalized into an isError structured result that never crashes the session; `CancellationException` propagates (matching `server.tool.cancel`). The declaration goes on the wire with the session; the handler body never does.
- Six protocol semantics are handled by the SDK: pairing by `callId`, de-duplicating replayed frames, silently dropping `deadlineAt`-expired calls without a response, safe retry when a response fails on the network, base64-encoding image results with a 20 MiB cap pre-check, and reciting the permission digest verbatim.
- Permission / question dialogs: `BridgeDialogState` + `TansrBridgeDialogs(dialogs)` for the default UI, or write your own suspend callbacks. **Unregistered bridges fail closed**: the SDK does not respond, the server denies-and-continues when the 120 s permission window expires, and a question becomes a structured "decide on your own" after a 60 s grace period.
- When a permission frame carries `attribution.reason` (the adjudicator judged it dangerous), show the reason to the user for final review; the machine never approves on their behalf.

## Public-network tools: server-side execution

Once the application enables `tools.webFetch`, `tools.http` (requires `@tansr/serve` 0.12.0 or later) or `tools.webSearch` in the console, the agent can read web pages, issue HTTP requests or search the web. These tools all execute on your session service host: the phone does not issue network requests on its behalf, and existing permission approval is not bypassed. Capability-flag changes apply to newly created sessions or sessions reassembled from storage; running sessions do not gain or lose tools automatically.

- Results are presented as tool cards as-is, keeping truncation hints; the HTTP status of Http does not stand in for tool success or failure, 4xx / 5xx still need checking; an empty search result only means this query had no match, not that the site is unreachable. When restoring old history, only the actually retained body and status are shown; sources or status codes are never fabricated.
- The dedicated search / web page / HTTP result projections (`com.tansr.sdk.view.SearchResultDetails` / `NetworkResultDetails`) ship with `:core` since 0.5.0: the search card keeps sources, truncation and empty-result hints, the web page and HTTP cards keep the original body and show the actual HTTP status; the existing `toolCardArtifact` usage is unchanged. 0.4.0 and earlier still show results with the original tool cards.
- Capability switches, execution boundaries and the approval rules for cross-host redirects are in [Public-network tools for mobile apps](/en/sdk/platform-bundle/#移动应用的公网工具).

SDK 2.0 has shipped server-side with `@tansr/serve` 0.13.0 / 0.14.0 (the explicit `@tansr/serve/extensions` host and the `/api` unified call surface); on Android the on-device thin client ships since 0.5.0: `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter` in `:core`, archive sync `Sdk2ArchiveSyncClient` / `Sdk2ReplicatedArchiveStore`, the terminal-services client `TerminalClient`, and the SQLite archive receiver / sync store / durable execution journal in the optional `:receiver-android` module. They are additive: apps that do not integrate SDK 2.0 never add `:receiver-android`, and SDK1 session behavior is unchanged. Persistence capabilities that entered the main branch after 2026-10-10 — the encrypted memory publication medium, the encrypted incremental SQLite profile and read-only copies — have **not shipped in any Maven release** and are not described on this page. Assembly and boundaries are in [SDK 2.0 extension entry](/en/sdk/sdk2-preview/).

## Voice: two links

Audio is not a protocol-level input type (it enters neither message blocks nor the event stream).

1. **Tool link**: the agent calls `SpeechToText` / `TextToSpeech` itself, the artifact reaches the device in `tool.completed.data`, `toolCardArtifact` decodes `Transcript` / `Speech`, and `TansrToolCard` renders them by default.
2. **Direct link** (your own voice UX):

```kotlin
val transcript = client.audio.transcribe(session.sessionId, bytes, mime = "audio/mp4") // 转写填框,是否发送归 App
val speech = client.audio.speak(session.sessionId, assistantText)                       // url ?: b64;URL 约 24 h 有效
```

This goes through `POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech` (through the same `call()` and the unified response-header gate); the server calls the platform voice surface on your behalf, gated by the capability flags `platform.speechToText` / `textToSpeech` and the quota. Failures throw `TansrAgentException.Unified`: the unified code is in `code` (e.g. `capability_unavailable` / `invalid_request` / `payload_too_large` / `upstream_unavailable`) and the original platform audio code in `domainCode` (`capability_disabled` / `asr_not_configured` / `tts_quota_exceeded` …; upstream business codes not registered in the facade vocabulary fall back to `internal_error` per the contract, with the original code and status kept in `domainCode` / `domainStatus`). Since `@tansr/serve` 0.9.0, platform upstream 401 / 403 / 5xx and network faults are normalized to `upstream_unavailable` (503) with `Retry-After`. `:compose` ships no player and no permissions: recording / playback belong to the host, and the sample's `AudioRecorderController` / `AudioPlayerController` are reference implementations; recording needs the `RECORD_AUDIO` runtime permission.

## Push wake-up: wire it yourself

The SDK never bundles any push SDK. When a turn reaches a terminal state with no active subscriber, the server POSTs the minimal payload `{ sessionId, endUserId, turnId?, status, reason?, lastSeq, ts }` to your webhook (never message content, never credentials); see [v2 protocol and webhooks](/en/serve/v2-and-webhooks/). Your half: receive the webhook → verify the signature → map `endUserId` to the device's push registration token → send one FCM **data** message carrying only `sessionId` (or a vendor channel) → `onMessageReceived` posts a local notification → the tap recovers through the existing three-level chain (warm: automatic L1 / L2; cold start: `CreateSessionRequest(resumeSessionId = sessionId)`, i.e. L3). No new SDK API is involved.

## Credential and logging discipline

- The device credential = your login state; the SDK only takes it per request via `authProvider` and **never persists it** (no SharedPreferences / DataStore / files / logs) nor caches it beyond a single request's lifetime.
- The appkey has no concept on the SDK / sample-code surface; the `app_user` token is never sent down to the device. In the embedded `@tansr/serve` form this page describes, the end-user identity on the `/api` session surface comes only from your `authenticate` hook; the `tansr serve --v2` single-operator form works with the same Bearer plus the `x-tansr-end-user` partition header and is outside this page.
- SDK debug logs never print auth headers, tokens, full responses or full tool args — only shape summaries; crash reporting cannot obtain credentials.
- Tool responses and tool declarations are both untrusted input: server-side shape validation is mandatory, and the semantic side relies on capability-profile narrowing + the permission bridge + event-stream attribution. Devices can be reverse-engineered; do not lower your guard because it is "our own app".

## Local integration testing

`:sample` (the order assistant) connects to the in-repo `examples/serve-demo` by default: serve-demo runs as a resident service with `DEMO_SERVE_ONLY=1` and `DEMO_PORT=8788` (the source default port is 8799; `pnpm start` / `pnpm real` are both real-model entries, and there is no public echo start command anymore), the sample connects to `http://127.0.0.1:8788` by default, so first run `adb reverse tcp:8788 tcp:8788` to forward the device port to the development machine (the emulator can also switch explicitly to `http://10.0.2.2:8788`, but that is not the sample default); `authProvider` signs locally in the demo's ticket format, and when you switch to the standalone developer login service (`pnpm login`, default `127.0.0.1:8787`) forward 8787 as well. To change the port without rebuilding: `adb reverse tcp:8789 tcp:8789`, then `adb shell am start -n com.tansr.sdk.sample/.OrderAssistantActivity -e baseUrl http://127.0.0.1:8789`. For a real device start the server with `DEMO_HOST=0.0.0.0` and point at the development machine's LAN IP (cleartext http needs a network security config exception; a non-loopback listener requires your own `DEMO_AUTH_SECRET` of at least 32 characters). Gate: `./gradlew build` (assemble + unit tests + ktlint + apiCheck).
