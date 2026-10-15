---
title: HarmonyOS integration guide
description: The public surface of the native ArkTS HAR, SessionView reduction, connection state and three-level recovery, lifecycle, local tools and the two bridges, the two audio chains and the two speech caps, media download boundaries, and credential and logging discipline.
zone: docs
category: harmony
related:
  - sdk/system-prompts
  - getting-started/harmony
  - getting-started/android
  - android
  - ios
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-harmony:doc/HM-01-Demo接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

The HarmonyOS SDK (HAR coordinate `@tansr/harmony`, current standalone release 0.2.0, distributed in `harmony-sdk.zip`, not listed on the public OHPM registry) is a thin native ArkTS client for the session service. It implements the agent session service contract, and every request leaves through the unified call surface `/api`. It declares a minimum of HarmonyOS 6.0 / API 20 (`compatibleSdkVersion`), is built with the API 22 toolchain, and uses the Stage model. This page covers the design points you meet after the quick start: how events become UI state, how to recover from disconnects, how to wire tools and dialogs, how to wire audio and media. The HAR provides no ArkUI pages and does not request the microphone on its own. The server side was checked against `@tansr/serve` 0.15.1 (npm latest, 2026-10-10) on 2026-10-13: starting with the 0.2.0 HAR (release candidate `88d917c` of 2026-10-10, bytecode HAR SHA-256 `7d5deedb…`), the client sends requests only to the `/api` prefix that the server has offered since 0.13.0 (D10, no fallback to `/v2`); paths, methods, aliases and response-header names come from `ApiContractGenerated` / `ApiOps` generated from manifest revision 7, and the session family is carried in the request header `tansr-session-family: sdk1 | sdk2-offload-v1`; ≥400 error bodies are the unified envelope and are judged by unified code + `retryAction` (D19); when a 2xx response or the event stream lacks the unified response headers, the client fails explicitly instead of falling back (D38). The 0.1.0 HAR still talks to `/v2` directly — on the server, `/v2` has been an internal adapter entry only since 0.13.0 and 1.0.0 removes the external entry, so upgrade to 0.2.0; see [deployment and authentication](/en/serve/deploy-and-auth/) for the timetable.

Older HarmonyOS devices that remain Android-compatible continue to use the [Android SDK](/en/android/). Native compatibility with HarmonyOS 5.x is future work and is not claimed as available today. The current deliverable is a standalone, versioned release bytecode HAR that is not yet listed on the public OHPM registry; signed installation and the device matrix are outside the scope of this page (the 0.2.0 release receipt records no signed HAP and no device run). For the integration steps see [HarmonyOS SDK in five minutes](/en/getting-started/harmony/).

## The phone sends user messages; the server configures the system prompt

Both `createSession` and `session.send(...)` send ordinary user messages; the HarmonyOS SDK does not pass `system` through the `/api` session requests. The shared role is managed in the platform app configuration, a code-customised role is provided by serve's `platform.system`, and host notes use `platform.systemAppend`.

The prompt and policy feature has been available since `@tansr/serve` 0.8.0, and the platform side went live on 2026-09-14. Under the default `fallback`, an explicit SDK `system` (including an empty array) replaces the platform segment; under `prepend`, the platform segment is kept in front. Platform prompts and policies refresh before the next new turn while the currently running turn stays fixed; foreground/background reconnects, SSE recovery and attach can keep the original session and history. See [application system prompts](/en/sdk/system-prompts/) for details.

## Public surface

| Export | Responsibility |
|---|---|
| `TansrAgentClient` | Pure contract client for the session service (via `/api`): create session / metadata / history / send message / mid-turn input / direct audio. Does not automatically resend mutating requests when the network outcome is uncertain |
| `NativeHttpTransport` | System RCP transport; options control HTTPS, loopback HTTP, intranet HTTP, timeouts and response caps; `NativeHttpOptions.certificateAuthorityPem` lets you configure a PEM CA bundle for your own service (replaces only this transport's trust root; the certificate chain and host name are still verified) |
| `AuthProvider` / `RefreshingAuthProvider` / `StaticAuthProvider` | Fetches the auth header per request. The refreshing wrapper handles validity, concurrency and identity changes |
| `AgentSession` | One event pump: `start` / `stop` / `close`, `send` / `sendBlocks`, the bridge runtime |
| `SessionView` | Pure event reduction. JSON snapshots have the same shape as the Android / iOS golden fixtures |
| `SpeechPlan` | Speech pre-check: two caps, the platform weighted cap and the vendor's atomic `inputLimit`; segmentation after explicit consent |
| `historyArtifactData` / `isRenderableArtifact` | History tool-artifact projection; a broken media preview does not rewrite the tool's original success / failure |
| `API_CONTRACT` / `API_MANIFEST_REVISION` / `UnifiedCode` / `UnifiedRetryAction` | `/api` contract artifacts: prefix, header names, manifest revision, and the 19 unified codes / 6 retry actions; the path templates of the 81 operations are generated inside the SDK from the manifest, so the host never hand-builds old paths such as `/v2` |
| `AgentError` / `ApiFacadeError` / `ApiContractError` | Unified errors: SDK1's `AgentError` restores the unified envelope via `unified` / `retryAction` / `domainCode`; the SDK 2.0 and terminal service surfaces throw `ApiFacadeError` directly (`Sdk2HttpError` is marked deprecated and kept for one version); a response-header gate / envelope gate violation is `ApiContractError` (`contract_unavailable`) |
| `ApiCallOptions` | The three request headers `Idempotency-Key` / `If-Match` / `deadline`; malformed values are rejected locally before sending |
| `Sdk2Client` / `Sdk2Executor` / `NativeSdk2Transport` / `Sdk2ClientToolAdapter` | SDK 2.0 thin client and explicit transport entry; the device executes only explicitly authorised device operations |
| `openSdk2RdbArchiveReceiver` / `openSdk2EncryptedRdbArchiveReceiver` / `openSdk2RdbExecutionJournal` / `Sdk2ArchiveSyncClient` / `openSdk2RdbArchiveCache` / `Sdk2ReplicatedArchiveReceiver` | Local RDB archive receiver (optional body encryption, keys kept by HUKS), RDB durable execution journal, archive sync and replica receiver |
| `TerminalClient` | Terminal service client (configuration / memory commands), via `/api/terminal/*` |

The 0.2.0 HAR has 116 public exports in total; the ones above are those you meet directly during integration. The SDK has no external runtime dependencies. The host HAP must declare `ohos.permission.INTERNET`.

## Event reduction

```typescript
session.onFrame = (eventName, data, seq) => { /* 原始 SSE 帧 */ };
session.onHistory = (history) => view.restoreHistory(history.messages);
view.onChange = () => render(view.state);
session.onState = (state) => { /* idle / connecting / live / retrying / recovering / failed / closed */ };
```

- `SessionView` ignores unknown business event types without breaking the stream; `server.*` control frames are consumed by `session.bridges` — do not pop up approvals again from ordinary `tool.permission.*` events.
- `SessionView(textMode, thinkingMode)`: text `stream` / `final`, thinking additionally has `off`. This is a UI projection and does not change the model generation parameters.
- Tool-card artifacts are extracted by shape via `historyArtifactData()`; signed media URLs are hidden only at the visible message layer, while the core history and the original receipt used for loading stay unchanged.

## Connection state and three-level recovery

```text
idle → connecting → live
live → retrying（指数退避）→ live          // L1:携游标重连,收帧按 seq 去重
live → recovering（拉 /history 重建）→ live // L2:重连首帧收到 gap
404 或 live = false → resume 重灌            // L3:弃旧游标,以 history.lastSeq 为锚
```

`lastSeq` always continues by value; the dormancy criterion is always `live = false`, never `lastSeq == 0`. Since `@tansr/serve` 0.9.0, the metadata `lastSeq` of a dormant session is the true watermark persisted in the store. `live = true` with `lastSeq == 0` goes through L2 only and never resumes.

When the third `AgentSession` argument `verifiedEndUserId` is present, an identity mismatch after metadata or resume is a failure; the session is never swapped silently. sessionId / turnId / inputId / historyEpoch are opaque identifiers: encode them segment by segment, with no trimming, no case folding and no Unicode normalisation.

A 401 or a protocol error enters `failed` and the pump stops; the host must repair the login state and call `start()` explicitly. After `stop()` the state returns to `idle` and the session has not ended. Only `close()` DELETEs the remote session.

## Lifecycle

| Entry | Meaning |
|---|---|
| `start()` | Start or resume the local subscription; idempotent |
| `stop()` | Cancel the local subscription and bridges without losing the remote session |
| `close()` | `stop` first, then request closing the remote session; a failure is reported as is, never faked as closed |

Stop the pump when going to the background and `start()` again on returning to the foreground. Component disposal and sign-out must call these entries; stopping the local subscription does not automatically DELETE the server-side history. New sessions: after `createSession` confirms the ID, persist it under the original authentication scope first, then bind the UI. A failed save must not automatically create another session. A failed recovery keeps the original anchor.

For strict mid-turn appends, first fetch the current target from `inputCapabilities()`, then build the `InputSubmission`. Persist the original ID, target and body before the first POST. Query unconfirmed states only by the original identifiers; do not automatically resend, change the ID, degrade to messages or interrupt. `accepted` does not mean persisted or answered.

## Local tools and the two bridges

```typescript
session.bridges.registerTool(declaration, handler);
session.bridges.onPermission = (request) => {
  // 展示 request.payload 后:
  session.bridges.answerPermission(request.id, 'allow'); // 或 'deny'
};
session.bridges.onQuestion = (request) => { /* answerQuestion */ };
```

- The `clientTools` passed at create / resume time must match the handlers actually registered.
- `parameters` is a dictionary of parameter names; use `{}` when there are none. A read-only declaration cannot bypass the server's adjudication; handlers must observe the `CancelToken`.
- Without `onPermission` set, the default is deny. Expired requests cannot be approved. Ordinary `tool.permission.*` events are for observation only.
- Questions and permissions are different bridge families. Supplying text or answering a question never counts as approving a tool.
- The client does not force ask for every tool; automatic allow, real ask and deny are decided by serve reusing the kernel's adjudication.

## Public network tools: executed on the server

Once the app enables `tools.webFetch`, `tools.http` (requires `@tansr/serve` 0.12.0 or later) or `tools.webSearch` in the console, the agent can read web pages, issue HTTP requests or search the web. All of these tools run on your session service host: the HAR does not issue network requests on the device on the agent's behalf, nor does it approve tools automatically. Capability-flag changes take effect for newly created sessions or sessions reassembled from storage; a running session does not gain or lose tools automatically.

- The example app's tools page offers WebSearch, WebFetch and Http GET public-network examples; selecting one only fills the input draft, which the user reviews before sending. When the server raises an approval, the top of the chat page shows a fixed "pending confirmation" entry.
- HTTP status, network errors and fetch failures are interpreted according to the tool's actual result; an empty search result does not mean the site does not exist, and for a known domain you can explicitly have WebFetch read it.
- For the capability switches, execution boundaries and the approval rules for cross-host redirects, see [public network tools for mobile apps](/en/sdk/platform-bundle/#移动应用的公网工具).

SDK 2.0 has shipped on the server with `@tansr/serve` 0.13.0 / 0.14.0 (the explicit host in `@tansr/serve/extensions` and the `/api` unified call surface); on HarmonyOS, starting with the 0.2.0 HAR, the package ships the explicit transport entry `NativeSdk2Transport`, the thin clients `Sdk2Client` / `Sdk2Executor`, the local RDB archive receiver (`openSdk2RdbArchiveReceiver`, with optional body encryption via `openSdk2EncryptedRdbArchiveReceiver`, keys kept by HUKS), the RDB durable execution journal `openSdk2RdbExecutionJournal`, archive sync `Sdk2ArchiveSyncClient` with the replica receiver, and the terminal service client `TerminalClient`. They are additive capabilities: without explicit assembly no sync store is created and no SDK 2.0 request is sent, and SDK1 session behaviour is unchanged; device acceptance is outside the scope of the release receipt. The encrypted memory publishing, source-preserving migration key rotation, encrypted incremental RDB profiles, read-only replicas and other persistence capabilities that entered the mainline after the 2026-10-10 release candidate **have not shipped with any HAR version** and are not described on this page. See [SDK 2.0 extension entry](/en/sdk/sdk2-preview/) for assembly and boundaries.

## Audio: two chains

Audio is not a protocol-level input type (it enters neither message blocks nor the event stream).

1. **Tool chain**: the agent calls `SpeechToText` / `TextToSpeech` itself, the artifact reaches the device with the tool-completed event and is rendered through the history projection.
2. **Direct chain** (your own voice UX):

```typescript
const transcript = await client.audioTranscribe(session.sessionId, 'audio/mp4', base64, undefined, cancel, 'zh');
const speech = await client.audioSpeech(session.sessionId, assistantText, undefined, undefined, cancel, 'wav');
```

The `format` of `audioSpeech` accepts only `wav` / `mp3`; when omitted, the request field is left out. The `language` of `audioTranscribe` is 2–16 UTF-16 code units and is passed through verbatim. Both parameters are appended after the `CancelToken`, so existing calls need no change. When a parameter is invalid, the SDK returns `validation_failed` before authenticating and sending the request. Whether the format is honoured is still decided by the platform and the selected model; the receipt MIME must not be rewritten according to the requested format. The real audio fields in the synthesis receipt are the basis for download, playback and metering.

Native recording (M4A/AAC, MIME `audio/mp4`) is host wiring. The STT constraint `formats` must explicitly include `m4a`; `maxSeconds` must be valid and at least 1 second. Transcription only fills the draft and never sends automatically. Late results after cancellation, switching sessions or going to the background must not be written into the wrong place. The HAR does not request the microphone on its own.

Preview speech with `SpeechPlan.prepare()`, honouring both the platform weighted cap and the vendor's atomic `inputLimit`. Long text requires explicit consent to segmentation; re-check the authorised cap before submitting each segment. Segments are split on Unicode code-point boundaries. Completed segments are cached and replayed; a segment whose result is unconfirmed is marked uncertain and processing stops, with no automatic regeneration. `SpeechPlan.reset(index)` resets only one confirmed or uncertain segment, at most 3 times per segment, and sends no request. The host must first confirm that the real synthesis Promise has finished, check the usage, and obtain an explicit intent to reset. When segmentation is allowed, 120 weighted characters for the first segment and 360 for subsequent ones are the latency soft targets shared with Android, and they always yield to the hard caps: 20000 UTF-16 code units per segment, 32000 weighted characters in total and at most 32 segments.

## Media and observation

Media authorisation is read from the `imageGen`, `videoGen`, `speechToText` and `textToSpeech` fields of `media.capabilities` / `media.models`; do not write `image` / `video` and misjudge them as unauthorised. Image input is IR `text` + `image` blocks; native audio/video input blocks for the main model are not yet available. Image and video generation are executed by system tools on the server.

Native media download uses the separate `downloadMedia()`: HTTPS, no auth header, no redirects followed. The default is 16 MiB, and for existing artifacts it can be configured explicitly up to 128 MiB. Timeouts, expiry, cancellation or a bad format must never trigger an automatic paid regeneration. Larger media should be served by the service as an accessible URL, not worked around by endlessly enlarging the phone's buffer.

`meta()` reads the server's actual model, context and optional media observations. Missing values stay "unknown". The current wire has no HTTP for switching models within a session. `selected`, `active` and `lastObserved` are different facts. Window occupancy cannot be inferred from billing usage. The vendor's KV cache is different from the local session / audio cache; never send paid keep-alive requests for the sake of hit rate.

## Credential and logging discipline

- The device credential = your login state; the SDK only fetches it per request through `AuthProvider` and never persists it to Preferences / files / logs.
- appkey does not exist as a concept on the SDK / sample-code surface; the `app_user` token is never distributed to devices.
- Single-flight ticket refresh, outbound header snapshots, identity and generation checks: a late 401 for an old ticket must not force a repeated refresh, and a response arriving after cancellation or a user switch must not revive anything.
- Tool replies and tool declarations are both untrusted input. Devices can be reverse-engineered and modified; do not lower your guard because it is "our own app".

## Device-side resource boundaries

| Item | Current default |
|---|---|
| SSE frame buffer | 16 Mi UTF-16 characters; adjustable via the fifth `AgentSession` argument, maximum 32 Mi; exceeding the cap stops and reports a protocol error |
| JSON | 32 Mi characters, 64 levels; rejects duplicate keys, non-finite numbers and malformed structures |
| Native ordinary response | 32 MiB; error body 64 KiB |
| Media download | Default 16 MiB, explicitly up to 128 MiB |
| View local state | 20 notices, 4000 UTF-16 characters of tool-output tail; chat history is never truncated automatically |

These are device-side resource boundaries, not the maximum of every upstream medium. Some legitimately inline Base64 from upstream may still exceed the cap; in that case stop the stream / reject explicitly rather than claiming successful reception. `SessionView` keeps the full projection of session messages; list virtualisation for very long sessions is the host's responsibility.

## Integration testing and building

- To work against the in-repo `examples/serve-demo`: `pnpm start` / `pnpm real` are both real-model entry points; for a resident integration server start with `DEMO_SERVE_ONLY=1` and `DEMO_PORT=8788` (the source default port is 8799; there is no longer a public echo start command), and the standalone developer login service `pnpm login` defaults to `127.0.0.1:8787`. The demo's `DeveloperLogin` is a host adapter, not a login built into the HAR: first `POST /login` to your login service to obtain a short-lived ticket (`POST /refresh` to renew), then use the ticket to access serve's `/api`. A custom login protocol replaces that adapter without changing the SDK's session ownership.
- Plain-text http only on loopback or an explicit intranet; production always uses TLS (configure your own CA via `NativeHttpOptions.certificateAuthorityPem`; never ignore certificate errors).
- SDK repository gates: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:contract`. Native: `./scripts/native.ps1 -Action lint` / `har` / `hap` / `test-hap` (toolchain DevEco Studio 6.0.2 / HarmonyOS SDK API 22).
- The example HAP shows five navigation areas — chat, connection, details, media and tools — and is not a UI contract guaranteed by the SDK; the publicly downloadable `harmony-demo.zip` ships the same 0.2.0 HAR and `SHA256SUMS` in its `libs/`.
