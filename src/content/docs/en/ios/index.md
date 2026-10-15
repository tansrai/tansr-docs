---
title: iOS integration guide
description: The Swift package's three-module split, view stream and event reduction, the connection state machine and three-level recovery chain, the scenePhase foreground/background policy, optimistic posting, error presentation, local tools and the two bridges, the two audio chains, self-wired push wake-up, and notes on building the pure-Swift logic layer on Windows.
zone: docs
category: ios
related:
  - sdk/system-prompts
  - getting-started/android
  - android
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-ios:doc/report/REL-FULL-20261010-iOS-0.4.0.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

The iOS SDK is the Swift mirror of the Android SDK, and the three clients follow the same rules: one session-contract constant table (revision 9), one set of generated `/api` contract artifacts (manifest revision 7), one set of view-reduction golden fixtures, one set of frame-order fixtures. This page follows the same order as the Android guide so that teams on both platforms can compare side by side; the differences (SwiftUI wiring, optimistic posting, the Info.plist declaration, building on Windows) are called out separately. This page was checked against the public binary package `tansr-ios-spm` **0.4.0** (GitHub Release, 2026-10-09), with the server side checked against `@tansr/serve` 0.15.1 (npm latest, 2026-10-10).

## Versions and the server-side prefix (checked 2026-10-13)

- Starting with public binary package 0.4.0 (released 2026-10-09, source `f3f31a6`), every HTTP request from the SDK goes only through the unified call surface `/api` that the server has offered since 0.13.0 (D10: immediate switch; the source no longer contains the `/v2`, `/v3/sdk2` or `/v3/terminal` route literals). Paths, methods and header names come from `ApiContract` / `ApiOps` (81 operations) generated from manifest revision 7; the session family is carried explicitly in the request header `tansr-session-family: sdk1 | sdk2-offload-v1`. The server must have the `/api` facade assembled (`@tansr/serve` 0.13.0 or later; r7 since 0.14.0). When the response-header revision differs from the local r7, `TansrAgentClient.onManifestRevisionDrift` / `AudioClient.onManifestRevisionDrift` fire once per client.
- Also shipped with 0.4.0: the error model centred on unified error codes (D19: `TansrAgentError.kind == .unified` / `.contractUnavailable`, and `ApiFacadeError` for the SDK 2.0 and terminal service surfaces), the unified response-header gate for SDK1 success responses and event streams (D38), `ApiCallOptions` for the three request headers `Idempotency-Key` / `If-Match` / `deadline`, and the SDK 2.0 device-side interfaces. This page describes these behaviours.
- The older 0.3.0 still talks to `/v2` directly. On the server, `/v2` has been an internal adapter entry only since 0.13.0, and 1.0.0 removes the external entry; apps still on 0.3.0 should upgrade to 0.4.0. See [deployment and authentication](/en/serve/deploy-and-auth/) for the timetable.

## The phone sends user messages; the server configures the system prompt

Both `CreateSessionRequest(prompt=...)` and `session.send(...)` send ordinary user messages; Android / iOS do not pass `system` through the `/api` session requests. The shared role is managed in the platform app configuration, a code-customised role is provided by serve's `platform.system`, and host notes use `platform.systemAppend`.

The prompt and policy feature has been available since `@tansr/serve` 0.8.0, and the platform side went live on 2026-09-14. Under the default `fallback`, an explicit SDK `system` (including an empty array) replaces the platform segment; under `prepend`, the platform segment is kept in front. Platform prompts and policies refresh before the next new turn while the currently running turn stays fixed; foreground/background reconnects, SSE recovery and attach can keep the original session and history, so there is no need to reopen a session to pick up the update. Have the app administrator resolve conflicts between business segments; permissions still go through their own independent mechanism. See [application system prompts](/en/sdk/system-prompts/) for details.

## Module split

| Module | Kind | Contents |
|---|---|---|
| `TansrCore` | Pure Swift, testable on any platform | Contract constants and the generated `/api` contract artifacts (`ApiContract` / `ApiOps` with 81 operations, `UnifiedContract`), the response-header gate `ApiContractGate`, `ApiCallOptions`, the `KernelEvent` type family (47 types + `Unknown` tolerance), the IR message model, SSE parsing / dispatch, the `SessionView` reducer and `viewStateFromHistory`, `toolCardArtifact` with `SearchResultDetails` / `NetworkResultDetails`, protocol-client logic and the transport abstraction, the direct audio surface `AudioClient`, the reconnect state machine (L1 / L2 / L3), `defineTool` and the remote tool bridge, the permission / question bridges `SessionBridges` (fail-closed by default), `BridgeDialogState`; the SDK 2.0 thin clients `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSync` and the terminal service client `TerminalClient` |
| `TansrClient` | Pure Swift | URLSession transport (SSE goes through a delegate bridge, same path on Darwin and FoundationNetworking), the `TansrAgent` entry factory; the SDK 2.0 SQLite archive receiver / sync store / execution journal (`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteArchiveSyncStore` / `Sdk2SqliteExecutionJournal`) |
| `TansrUI` | SwiftUI (`#if canImport(SwiftUI)`, compiles to nothing on non-Apple platforms) | `TansrSessionObserver`, `tansrSessionLifecycle`, the default permission / question dialogs `tansrBridgeDialogs`, `TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`; all replaceable, not tied to a theme, zero AVFoundation dependency |

Distribution channel SwiftPM: the public binary package `tansrai/tansr-ios-spm` (currently 0.4.0, released 2026-10-09; a remote XCFramework without the SDK implementation source, module names kept as `TansrCore` / `TansrClient` / `TansrUI`; built by Xcode 26.6 / Swift 6.3.3 in Swift 5 language mode); minimum iOS 16+ / macOS 13+, covering iOS device arm64, simulator arm64 / x86_64 and macOS arm64 / x86_64. The SPM tag of the source repository `tansr-ios` (0.2.0) is published in a private repository, requires repository access, and is meant for integration work by teams with source access.

## View stream and event reduction

```swift
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState>
session.events()                // AsyncStream<KernelEvent>
session.connectionState         // idle → connecting → live → retrying / recovering / authExpired …
```

A SwiftUI host uses `TansrSessionObserver(session:)` to turn `view` / `connectionState` / `userSendStates` into `@Published` values that feed re-rendering directly. `view` is the already reduced view state; do not assemble deltas yourself. Delivery profile `SessionViewOptions(delivery: .init(text: .final, thinking: .off))`: in the `final` profile, deltas go into an internal buffer and the whole block is shown once finalised; `thinking: .off` does not materialise thinking parts (state derivation still sees `thinking`, so a placeholder UI is possible); `session.setDelivery(...)` switches at block granularity while running, and switching to `.off` immediately removes existing thinking content as well. L2 / L3 rebuilds and resume / attach always keep the current profile.

The tool-card artifact helper `toolCardArtifact` extracts the URL artifacts of imageGen / videoGen / webSearch plus `.transcript(model:text:language:durationSec:)` / `.speech(model:url:b64:mime:format:durationMs:billedChars:)`; `TansrToolCard` renders the five shapes by default, and the "play" button of `.speech` only appears when the host passes the `onPlaySpeech` slot — `TansrUI` has no built-in player.

## Connection state machine and the three-level recovery chain

Identical to Android: L1 reconnects with `Last-Event-ID` after an SSE disconnect and deduplicates received frames by seq; L2 handles a gap in the first frame after reconnecting → discard the projection → metadata → `/history` → rebuild with `viewStateFromHistory` → resubscribe from `lastSeq`; L3 handles metadata 404 or `live == false` or a cold start holding only a sessionId → `CreateSessionRequest(resumeSessionId: savedId)` resumes and reloads, discards the old cursor and anchors on `history.lastSeq` (it does not read `lastSeq` from the resume response). A disconnect never surfaces as a business code.

`lastSeq` always continues by value; the dormancy criterion is always `live == false`, never `lastSeq == 0`. Since `@tansr/serve` 0.9.0, the metadata `lastSeq` of a dormant session is the true watermark persisted in the store, and the new epoch after resume continues from that watermark + 1 rather than from `0` (in 0.8.x both were always `0`); the device needs no adaptation for either server version. `live == true` with `lastSeq == 0` goes through L2 only and never resumes. Session contract revision 9 (vendored with 0.4.0) registers 55 event types, of which `TansrCore` decodes 47; the SDK-only event `session.events_dropped` (contract-v0.27) is never emitted by serve and never appears in the event stream, and even if it did it would be tolerated as `Unknown`.

The 401 convergence rule is the same: refresh the token through `authProvider` at most 2 times; if it is still 401, enter the terminal state `failed(unauthorized)` with `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`, the pump stops, and the host must repair the login state and call `start()` explicitly. The terminal state is `failed`, not `closed` — the session has not ended and the server still holds it.

Unified response-header gate (D38, same shape on all three clients): every 2xx from `TansrAgentClient.call()`, the 200 event stream from `openEventStream` and every 2xx from `AudioClient` first pass `ApiContractGate.requireUnified` — the four headers `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` must all be present and well-formed; a violation throws `TansrAgentError.contractUnavailable(status:reason:)`, which is **not a business success and does not fall back**. On a 2xx-shaped contract-unavailable, the event pump enters the `failed` terminal state directly (no backoff, no reconnect; the typical causes are a `baseUrl` that does not point at the `/api` facade, or a proxy / portal page in between), and the host calls `start()` after repairing the deployment; ≥400 shapes still follow the status-code policy.

## Foreground / background: one line of scenePhase wiring

```swift
ChatScreen(session: session)
    .tansrSessionLifecycle(session)  // scenePhase 收放;在场即不需手工 start()
```

Going to the background stops the pump and drops the SSE connection (suspension is not fatal; `connectionState` returns to `idle`); coming back to the foreground picks the route automatically based on the **recovery window**: warm (within 60 s by default) → L1 continues directly; past the threshold with a turn that ran while in the background → an L2 `history` rebuild first; session reclaimed for idleness → 404 → L3 self-heals. The decision is the pure function `LifecyclePolicy` in `TansrCore`; the threshold is adjustable through `AgentSessionConfig.warmResumeWindowMs`. Equivalent wiring for non-SwiftUI hosts: `session.start()` in the foreground, `session.stop()` in the background; both are idempotent and `stop` never loses the session. Once a session has ended (`closed`), returning to the foreground never revives it automatically.

## Optimistic posting (an iOS-specific presentation)

Calling `send` / `sendBlocks` posts the user bubble immediately (`userSendStates` records `sending`) and settles it once HTTP 202 confirms; a failure is marked `failed` and never disappears silently — `retrySend(messageId)` resubmits with the original message id unchanged (no duplicate bubble), and `discardSend(messageId)` withdraws it idempotently. L2 / L3 rebuilds always clear the optimistic ledger to avoid collisions (message ids are renumbered from 1 after a rebuild).

## Error presentation

| Source | Shape | Presentation |
|---|---|---|
| Error inside the session | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner`; when `detail.scope == 'plan'`, use "try again later" wording |
| Advisory | `view.notices` (`recoverable: true`) | Weak hint |
| Connection state | `connectionState` | `TansrConnectionBanner` |
| HTTP surface | `TansrAgentError.kind == .unified`: `unifiedCode` is one of the 19 unified codes (`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …), `retryAction` is one of the 6 actions (`none` / `same-request` / `query-status` / `rediscover` / `rebind` …); the original family code stays in `domainCode` / `domainStatus` / `domainRetryAction`, and `traceId` / `requestId` are carried as well; a facade contract-unavailable is `.contractUnavailable` (`reason` = the violated item); the SDK 2.0 / terminal service surfaces throw the same-shaped `ApiFacadeError` directly (`Sdk2HttpError` is marked deprecated). `toLegacy()`, which restores the old kind from `domainCode`, is a one-version transition only; old `{ error: { code } }` envelopes without the `tansr-contract` header still pass through the transition bridge | Branch on `unifiedCode` + `retryAction`; use `domainCode` only to refine diagnostics |

For `capacity_exceeded` (429 shape, `retryAction = same-request`), wait for the whole-second value of `Retry-After`; the 32 MiB audio body cap is rejected on the device first (`.payloadTooLarge`, no request sent).

## Local tools and the two bridges

```swift
let searchOrders = try defineTool(name: "searchOrders", description: "Search the user's orders") { tool in
    try tool.string("keyword", description: "search keyword")
    tool.readOnly = true
    tool.handler { args in try await db.search(keyword: args.string("keyword")) } // async;返回值宽容归一
}

let dialogs = BridgeDialogState() // 或自写 async 回调
let session = try await client.openSession(CreateSessionRequest(), bridges: try dialogs.bridges(tools: [searchOrders]))
// SwiftUI: .tansrBridgeDialogs(TansrBridgeDialogObserver(state: dialogs))
```

Handlers run as tasks and are matched by `callId`: replayed duplicate frames are deduplicated, `server.tool.cancel` cancels the task, a `deadlineAt` overrun is dropped silently (no reply), a network failure on the reply is retried safely, image results are base64-encoded with an upfront 20 MiB cap self-check, and the permission digest is repeated verbatim by the SDK. An unregistered bridge is fail-closed: the SDK never answers, and the server degrades per the contract (permission → deny-and-continue; question → a structured "decide for yourself").

## Public network tools: executed on the server

Once the app enables `tools.webFetch`, `tools.http` (requires `@tansr/serve` 0.12.0 or later) or `tools.webSearch` in the console, the agent can read web pages, issue HTTP requests or search the web. All of these tools run on your session service host: the phone does not issue network requests on the agent's behalf, nor does it bypass the existing permission approvals. Capability-flag changes take effect for newly created sessions or sessions reassembled from storage; a running session does not gain or lose tools automatically.

- Since 0.3.0 the public binary SPM package includes the `SearchResultDetails` / `NetworkResultDetails` display projections, and the existing `ToolCardArtifact` usage is unchanged: search cards keep the sources, truncation and empty-result hints, and web-page and HTTP cards keep the original body and show the actual HTTP status.
- The HTTP status does not stand in for tool success or failure; 4xx / 5xx still need checking. An empty search result does not mean a known URL is unreachable. When old history lacks this metadata, keep it unknown rather than inventing it.
- For the capability switches, execution boundaries and the approval rules for cross-host redirects, see [public network tools for mobile apps](/en/sdk/platform-bundle/#移动应用的公网工具).

SDK 2.0 has shipped on the server with `@tansr/serve` 0.13.0 / 0.14.0 (the explicit host in `@tansr/serve/extensions` and the `/api` unified call surface); on iOS, the device-side interfaces ship with the public package since 0.4.0: `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter` in `TansrCore`, archive sync `Sdk2ArchiveSync` and replica reception `Sdk2ReplicatedArchive`, the terminal service client `TerminalClient`, and the SQLite archive receiver / sync store / durable execution journal in `TansrClient` (private directory, keys kept in the Data Protection Keychain). They are additive capabilities: without explicit assembly no sync store is created and no `archive-sync-v1` request is sent, and SDK1 session behaviour is unchanged. The release record logs this round as simulator ad-hoc-signed acceptance with no device verification; the encrypted memory publishing, device-storage source-preserving migration and terminal persistence profiles that entered the mainline after 2026-10-10 **have not shipped with any SPM version** and are not described on this page. See [SDK 2.0 extension entry](/en/sdk/sdk2-preview/) for assembly and boundaries.

## Audio: two chains

1. **Tool chain**: the agent calls `SpeechToText` / `TextToSpeech`, the artifact reaches the device with `tool.completed.data`, and `TansrToolCard` renders it by default (transcript body + duration; speech row + duration + model + billed characters).
2. **Direct chain**:

```swift
// 麦克风 → 转写 → 填入输入框(不自动发送);m4a 16 kHz mono 上行 data:audio/mp4;base64,…
let transcript = try await client.audio.transcribe(
    sessionId: session.sessionId, data: m4aBytes, mime: "audio/mp4", language: "zh")
inputText = transcript.text

// 助手回复 → 语音 → 播放(url ?? b64;url 形约 24 h 时效)
let speech = try await client.audio.speak(sessionId: session.sessionId, text: reply, voice: "Cherry")
speech.url ?? speech.b64
```

A pure HTTP round trip (`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`; 2xx responses pass the unified response-header gate as well) that never enters the history; whether the transcript becomes the next user input is the app's decision. The server calls the platform's `/t1/asr` / `/t1/tts` on your behalf, gated by the capability flags `platform.speechToText` / `textToSpeech` and the quota; failures land in `.unified` per D19: the unified code in `unifiedCode` (for example `capability_unavailable` / `invalid_request` / `upstream_unavailable`), the platform audio surface's original code (`asr_not_configured` / `tts_quota_exceeded` …) in `domainCode`. Since `@tansr/serve` 0.9.0, upstream 401 / 403 / 5xx and network failures from the platform are normalised to `upstream_unavailable` (503) with `Retry-After`; the device simply backs off for the whole-second value.

**Microphone permission declaration**: the app target's Info.plist must carry `NSMicrophoneUsageDescription`; without it, iOS terminates the process on the first microphone access. This repository is a SwiftPM package and an `executableTarget` has no Info.plist semantics — the example `Examples/OrderAssistant/Info.plist` is explicitly `exclude`d in `Package.swift`; on iOS, when you build an app project in Xcode that depends on this package, set it as the app target's Info.plist (or merge it key by key); on macOS, `swift run` embeds it with `-Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker <path>`. The repository deliberately avoids `linkerSettings.unsafeFlags` (SwiftPM rejects it when the package is used as a dependency).

## Push wake-up: wire it yourself

The SDK never bundles any push SDK (APNs / FCM / vendor channels are yours). The server's webhook hook POSTs a minimal payload when a turn reaches a terminal state with no active subscriber; see [v2 protocol and webhooks](/en/serve/v2-and-webhooks/). After the app is woken by a push, it always goes through the existing three-level chain with zero new API: process still alive → automatic L1 reconnect on returning to the foreground; process dead → cold start with `openSession(CreateSessionRequest(resumeSessionId: id))`, i.e. L3.

## Integration testing and building

- App integration uses the public binary SPM package `tansr-ios-spm` (see [the iOS section of the quick start](/en/getting-started/android/#ios-同法)); the `swift build` / `swift test` in this section are for integration work by teams with source access. Do not mix the source SDK and the binary SDK in the same app dependency graph.
- To work against the in-repo `examples/serve-demo`: `pnpm start` / `pnpm real` (`npm start` / `npm run real` for npm) are both real-model entry points; for a resident integration server start with `DEMO_SERVE_ONLY=1` and `DEMO_PORT=8788` (the source default port is 8799; there is no longer a public echo start command), and the standalone developer login service `pnpm login` defaults to `127.0.0.1:8787`; the demo auth ticket format is `demo1.<b64url(uid)>.<exp>.<hmac-sha256-hex>`. The iOS simulator reaches the host machine directly via `127.0.0.1`. Example `OrderAssistant`: `swift run OrderAssistant`, or `TANSR_DEMO_BASE_URL=http://127.0.0.1:8789 swift run OrderAssistant` to override the service address; plain-text http is allowed via `NSAllowsArbitraryLoads` for the demo only, production always uses TLS.
- **Building the logic layer on Windows / Linux**: `swift build` / `swift test` (Swift 6.3+) run the full `TansrCore` suite — golden-fixture comparison, contract table checks, the pump state machine, optimistic posting, the two-bridge matrix, the direct audio surface. Running `swift test` on Windows requires adding the XCTest runtime DLL directory to PATH (`<Swift>\Platforms\<ver>\Windows.platform\Developer\Library\XCTest-<ver>\usr\bin64`).
- If on Windows package loading fails immediately with `NSCocoaErrorDomain Code=257 "You don't have permission."`, it is usually not an ACL problem: SwiftPM compiles `Package.swift` into `<package>-manifest.exe` under `%TEMP%` and launches it, and security software with active defence intercepts and quarantines it. Pick one of two remedies: add the Swift toolchain directory to the security software's trust zone (the root fix), or create a `mklink /J` alias in a directory the security software allows and run from there.
- macOS (Xcode 15+): `swift build && swift test` runs everything including `TansrUI`; for the iOS simulator / device, open this package in Xcode and run the `OrderAssistant` scheme.
