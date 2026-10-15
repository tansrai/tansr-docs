---
title: 'SDK 2.0 extension entries: archive host, cache host and the unified API'
description: 'The parts of SDK 2.0 that have shipped with @tansr/sdk 0.19.0, @tansr/serve 0.15.1 and @tansr/api-client 0.4.0 — the explicit ./extensions hosts, the serve trusted-host extensions, the unified call surface /api and the api-client ./api, ./sdk2, ./terminal sub-entries — plus the performance-gate readings still handled as "conditional delivery + deferred disclosure".'
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
  - sdk/platform-bundle
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - cli/settings-and-doctor
  - security
sources:
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/protocol/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/release/USDK-11-0.14.0批-发行说明-2026-10-04.md
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/release/REL-0.15.0批-发行说明-2026-10-06.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
  - tansr-cli:doc/release/REL-SEA-SEA渠道首发-回执-2026-10-05.md
  - tansr-cli:doc/report/PERF-01-正式测量-2026-10-04.md
  - tansr-cli:doc/report/SDK2-09-性能门时间盒-2026-10-01.md
lastVerified: '2026-10-15'
---

SDK 2.0 aims at a **unified core with thin terminals**: the agent loop, sessions, context, memory, permissions, adjudication, tool algorithms and usage accounting are still provided by the existing serve / kernel; the TypeScript, Kotlin, Swift and ArkTS clients consume one and the same session and execution contract; the platform only describes client facts. Electron keeps the existing in-process `@tansr/sdk` integration — dependencies, main process and call ecosystem unchanged. This page describes only what **has shipped in an npm release**; the page keeps its historical slug `sdk2-preview`, but the content is no longer a preview.

## Release status (verified 2026-10-13)

| Package / artifact | Version | Released | SDK 2.0 content |
|---|---|---|---|
| `@tansr/sdk` | 0.18.0 → 0.18.1 → **0.19.0** (`latest`) | 2026-10-02 / 2026-10-04 / 2026-10-10 | Sub-entry `@tansr/sdk/extensions` (41 snapshot items): `createNodeArchiveHost`, `createNodeCacheHost`; 9 optional signature additions on the root entry. 0.18.1 has zero `src` changes and rides along only because the published `./extensions` artifact changed with PERF-01 (c)(d). The 0.19.0 additions all live under `platform/*` (the standalone non-chat operations client and friends, see [Sessions and events](/en/sdk/sessions-and-events/#0190-的加法)); `./extensions` and the two hosts on this page are unchanged |
| `@tansr/serve` | 0.13.0 → 0.14.0 → 0.15.0 → **0.15.1** (`latest`) | 2026-10-02 / 2026-10-04 / 2026-10-06 / 2026-10-10 | Sub-entries `@tansr/serve/extensions` (98 items) and `@tansr/serve/process` (6 items); root entry +18 explicit remote-execution profile / trusted-host / idle-period configuration types and `createServeLogger`; unified call surface `/api` GA (manifest revision 6 → 7, 81 operations). 0.15.0 adds the legacy-prefix retirement-window knob `legacyPrefixes` (default `readwrite`), `Deprecation` / `Link` headers on legacy-prefix responses and a warning log for mixed prefixes; the `/api` surface and manifest r7 are unchanged. 0.15.1 is a fix-only patch (first device binding ordering, controlled output of business tools, unified error mapping, material settlement before checkpoint restore); the default stays `readwrite` |
| `@tansr/api-client` | 0.3.0 → **0.4.0** (`latest`; `next` points to the same 0.4.0) | rc.1 2026-10-02 → GA 2026-10-04 / 2026-10-06 | 0.3.0 added `./api` (`unified-v1` client) and was the first release to ship `./sdk2`, `./sdk2/node`, `./terminal`, `./terminal/node` (frozen, not removed). 0.4.0 only changes the **default route table** of the two frozen entries to the `/api` facade and restores per-family error bodies received through the facade; `./api` and the root entry are unchanged, export set +0 / −0 / ~0 |
| `@tansr/protocol` | **0.2.0** (first public version) | 2026-10-02 | Sub-entry `./canonical`: the single canonical codec module for control DTOs |
| `tansr` CLI | 0.10.0 → 0.10.1 → 0.10.2 → **0.10.3** | 2026-10-02 / 2026-10-04 / 2026-10-06 / 2026-10-10 | `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>` assembles a trusted host module; `--legacy-v1` is deprecated. 0.10.2 / 0.10.3 have zero changes in `packages/cli/src`; they only bump the embedded `@tansr/serve` to 0.15.0 / 0.15.1 (which makes the environment variables `TANSR_SERVE_LEGACY_PREFIX` / `TANSR_SERVE_LEGACY_SUNSET` available), with no new commands or flags |
| Android / iOS / HarmonyOS SDKs | Maven Central **0.5.0** / public binary SPM **0.4.0** / HAR **0.2.0** | 2026-10-07 / 2026-10-09 / 2026-10-10 | These three releases talk only to `/api` (manifest r7, unified codes in the primary position); Android 0.4.0, iOS 0.3.0 and HAR 0.1.0 still use `/v2`. See each client's integration guide |

The SEA single-file executable has been distributed since 2026-10-05 through the OSS channel `https://bash.tansr.com` (`stable` channel, ed25519-signed manifest). The first release was 0.10.1; the current manifest is **0.10.3** (2026-10-10) and contains only the `linux-x64` / `linux-arm64` files. No Windows / macOS single-file build is published — install the CLI from npm on those platforms. The git tags `v0.10.1` / `v0.10.3` that accompanied the SEA releases are pushed to the remote; `v0.10.0` / `v0.10.2` still exist locally only.

## What it is not

- Not a default switch on `createSession`: code that does not `import '@tansr/sdk/extensions'` is unchanged; the Electron full SDK / IPC wiring is unchanged.
- Not a backup, not multi-device sync: the local archive host's storage strategy is fixed at `single-authorized-source` + `source-ack-with-durable-spool`, with `replication` / `synchronization` both `'none'`.
- Not proof of provider-cache savings: the presence of the interfaces does not prove net savings (see "Performance and deferred disclosure" at the end of this page).
- It does not change the bytes of the direct `/v2` surface; `/api` is the call surface for new integrations, and the legacy prefixes stay reachable until 1.0.0 — see below.

## `@tansr/sdk/extensions`: two explicit in-process hosts

### Local archive host `createNodeArchiveHost`

`createNodeArchiveHost(options)` builds the host without creating a database; `host.open({ mode: 'fresh' | 'resume', … })` installs / restores the archive and returns the **original `AgentSession`**, and the persistent medium is initialized only on the first `open`. Archival and model context are enabled separately: `archive.contextMaterials: true` explicitly installs the material chain; omitting it or passing `false` keeps the archive hand-off only.

- Bounded reads: `readArchiveBinding` / `readArchiveStorageStrategy` / `readArchiveRecords({ afterSequence, limit, maxBytes })` / `readArchiveArtifact` (re-verifies SHA / MIME / length, 32 MiB per object) / `readEffectiveContext` (only the end-of-turn effective context reference of an idle installed session — not an anti-rollback credential) / `flushArchive`.
- Materials: "received ≠ consumed". `requestMaterials` → bounded chunked upload → `received` only proves delivery; `enqueueMaterials` hands the original request and lease to the single ContextManager at the next query barrier, which checks generation, summary coverage and budget. The full archive is never re-injected automatically, and source text already covered by a summary does not revive on reopen.
- Same-turn insertion: `inputCapabilities` / `getInputTarget` / `submitInput` / `getInputStatus`, never falling back to cancel + send; semantics as in [Add input to a running task](/en/sdk/midturn-input/).
- Trusted external image source `ArchiveAttachmentSource`: `describe` synchronously returns the MIME / byte count / SHA256 fixed at registration; `read` is bounded by `signal` / `maxBytes`. The URL is only a lookup key: the SDK never fetches automatically and never turns an address into a file or network permission.

### Local cache host `createNodeCacheHost`

The platform token source obtains the original `AgentSession` through `cacheHost.open({ mode: 'fresh' | 'resume', sessionId, session })`. You must explicitly pass the original `createFileSessionStore`, `applicationScopeId` / `endUserId` / `baseUrl`, `cache: { directory (absolute), storeId (stable), key: { id, bytes (32-byte local medium key, stored securely by the application) }, mode: 'create' | 'recover' }` and a synchronous `authorize` (returns a non-negative decimal string `authorizationRevision` for `open / resume / cold-new / run / delete`; throw to refuse).

- `readCacheContinuity(sessionId)` reads logical cache continuity purely locally; provider hits / usage / billing are always `unknown` without an upstream report. `lookup` only consults accepted / stored responses and is never executed as a new turn.
- Continuity across runs: `continuity` (`NodeCacheContinuityBridge`) defaults to the same runtime (`runtimePolicy` omitted or `'preserve'`); only an explicit `'renew-on-restore'` asks a trusted backend that holds source authority over the **same real Store** for a short-lived grant — the issuer private key never reaches the terminal, and the local vault key is no substitute. `410 session_archived` is terminal; only an explicit `archived: 'cold-new'` with current authorization creates an independent new relationship.
- Order of deletion and shutdown: see [Close sessions and await resource cleanup](/en/sdk/lifecycle/) — close and drain every host session → `cacheHost.delete(...)` → `dispose()`.
- Changes riding along in 0.18.1 (PERF-01 (c)(d)): the C2 hot-window exchange frame and in-flight marker go from two SQLite transactions to one, and on cold restore the old-run binding read and the new-run heartbeat are issued in parallel; call surface, error codes and caps (128 control / 16 exchange / 4096 completion / 64 MiB) are unchanged, and existing cache databases need no conversion.

### The 9 optional signature additions on the root entry (0.18.0)

`SessionStore.attachmentCheckpoints?` and two companions (see [Checkpoints and resume](/en/sdk/checkpoints/)); `ToolContext.executionTarget?` / `turnId?` and `GateDecision.executionTarget?` (always absent in-process, see [Sessions and events](/en/sdk/sessions-and-events/#018x-的加法)); `AppBundleModel.adapterDiagnostics?`, the `execution?` section of `AppCapabilitiesSchema` and `'bound-device-v1'` in `CLIENT_FEATURES` (see [Platform assembly and the bundle](/en/sdk/platform-bundle/)); the 6th optional parameter `requireCapabilities` of `fetchAppBundle`. All are optional keys / optional trailing parameters / constant-vocabulary additions with no runtime behaviour regression.

## `@tansr/serve/extensions`: explicit assembly by a trusted host

Everything here is an extension **explicitly assembled by a trusted host** — the root entry is unchanged, SDK1 default behaviour is unchanged, and the `tansr serve` CLI does not enable any of it automatically. By feature group:

| Feature group | Entry | Key points |
|---|---|---|
| Archive host | `createServeArchiveHost({ security: 'trusted-single-application', … })` → `host.start(...)` mounts `/v3/sdk2/**` (facade `/api/archive/**`) | A trusted single-application host, not multi-tenant isolation and not an untrusted tool sandbox; `agent.store` must be the original Store from the same installation's root entry; `rotateOperationEpoch` / `deleteSessionHistory` / `deleteArchiveRecords` / retained-medium authorization callbacks / `readEffectiveContext` / `closeOverlay` |
| Archive sync | `startServeArchiveSync` → `/v3/sdk2/archive-sync/**` (facade `/api/archive/sync/:id`) | `archive-sync-v1` has no code table; in this version error bodies still pass through in the original envelope |
| Explicit offload host | `createServeOffloadArchiveHost` | New clients explicitly choose `sessionContract: 'sdk2-offload-v1'` (query `/api/capabilities/sessions` first); the default `sdk1` is unchanged; `rollbackEffectiveHistory` / `importEffectiveHistory` / `readEffectiveHistoryOrigin` |
| Cache host | `createServeCacheHost(options)` → `{ start, readInventory, dispose }` | Configuration / appKey / encryption key / issuer live only in the trusted service process; `/v3/sdk2/cache/**` (facade `/api/cache/**`); `readInventory()` contains no tickets / bodies |
| Shared transactional Store | `createTransactionalServeAgentSessionStore` / `createMysqlAgentSessionTransactionBackend` | Mutually exclusive with `execution.spoolFor` assembly; does not replace the original file Store and injects no database dependency into terminals. Since 0.14.0 the `leaseMs` floor is 1000 → 5000 (1000–4999 throws `TypeError`; default 30000) |
| Memory lifecycle and publication media | `createPlatformMemoryLifecycle`, `createSqliteMemoryPublicationStore`, … | Terminals only keep publications; the core runs extraction / consolidation / retrieval / promotion. Since 0.14.0 `memoryFor(scope)` may return `deviceIoBudgetMs` (1,000–120,000 ms, default 10,000) |
| Terminal contract anchors | `TERMINAL_CONTRACT_SCHEMA_REVISION` / `TERMINAL_CONTRACT_SCHEMA_SHA256`, `clientToolDefinitionDigest` | Consumed by exact hash from C# / Android / iOS / HarmonyOS |

The root entry's explicit remote-execution profile `AgentExecutionOptions` (`applicationScopeId` / `authorize` / `readPolicy` / `spoolFor` required) is wired through `createAgentSessionFactory({ platform, execution })`: default limits are 256 executor connections / 512 sessions globally and 16 / 8 per user, with `429 capacity_exceeded` beyond; remote Shell requires the application's `execution.boundDevice.tools.shell`, a named policy, a device `process.exec` backend and a trusted `confirmInterpreter` all present at once. Legacy integration paths without `execution` are unchanged. The CLI form assembles the same kind of trusted host module through `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>` (≤ 16 MiB, `.cjs`, exporting `(context) => { agent, authenticate, terminal?, v2?, resources? }`) — see [Deployment and authentication](/en/serve/deploy-and-auth/) and [Settings and doctor](/en/cli/settings-and-doctor/).

`@tansr/serve/process` (`installProcessGuards` / `ProcessGuardOptions` / `LOG_EVENT` / `ServeLogger`) is a narrow exit over the same implementation as the root exports; importing it assembles no HTTP / session / platform runtime. Self-hosted hosts may change `import { installProcessGuards } from '@tansr/serve'` to `'@tansr/serve/process'` to reduce startup imports; the root entry keeps working.

## The unified call surface `/api` and `@tansr/api-client` 0.4.0

Since `@tansr/serve` 0.13.0, a deployment with `options.v2` present mounts the facade at the head of the chain: `/v2/sessions/**` → `/api/sessions/**`, `/v3/sdk2/bindings/**` → `/api/archive/bindings/**`, `/v3/sdk2/cache/**` → `/api/cache/**`, `/v3/terminal*/**` → `/api/terminal/**`. Domain payload bytes are unchanged; every `/api/*` response carries the four headers `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`, and JSON errors ≥ 400 are unified into an envelope with 19 codes / 6 `retryAction` values. Since 0.14.0 `/api` reads the three request headers `Idempotency-Key` / `If-Match`+`ETag` / `deadline`, and manifest revision 7 adds the operation `approval.credential.submit` (`POST /api/approvals/:id/credential`).

- The single-tenant `/v1` surface is **off by default** in deployments where the facade is present (since 0.13.0); the escape hatch `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` is deprecated since 0.14.0 / CLI 0.10.1 and removed in 1.0.0.
- `/v2` and `/v3/*` are defined as **internal adapter entries** since 0.13.0; 0.14.0 through 0.15.1 removed no route and entered no read-only window, and response bodies and status codes are byte-for-byte unchanged. Since 0.15.0 there is a retirement-window knob `StartServerOptions.legacyPrefixes: 'readwrite' | 'readonly' | 'off'` (default `readwrite`; environment variable `TANSR_SERVE_LEGACY_PREFIX`): `readonly` makes the 38 operations registered as `write` in the manifest answer a `410 gone` unified envelope on the legacy prefixes, `off` answers `404 not_found` for all of them; with the facade present every legacy-prefix response carries `Deprecation` / `Link` headers (plus `Sunset` once `legacyPrefixSunset` / `TANSR_SERVE_LEGACY_SUNSET` is set), and mixing prefixes within one session logs an `api.legacy_prefix_mixed` warning. When the default switches to `readonly` is up to each release's CHANGELOG; this page makes no forecast. 1.0.0 (`unified-v1` freeze) removes the external entries. New integrations use `/api` directly.
- `@tansr/api-client/api`: `createApiClient({ baseUrl, token | authorize, … })` → `manifest()` / `capabilities()` / `sessionCapabilities(id)` / `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })` / `events(name, …)`; the operation catalogue `API_OPERATIONS` (81 items generated from manifest r7, each carrying `etagPath` / `expectedRevision` / `requestIdPath`); `ApiError` / `ContractUnavailableError`; a strict 7-key event envelope. `./sdk2` and `./terminal` are frozen legacy-prefix clients: since 0.4.0, when `routePrefixes` is not passed they **default to the `/api` facade** (`API_FACADE_ROUTE_PREFIXES`; session clients add the `tansr-session-family` header). This requires a server running `@tansr/serve ≥ 0.13.0` with the facade present; against a server without the facade they report `invalid_response` instead of silently falling back to the legacy prefixes. Callers that still need the legacy prefixes inject `routePrefixes: LEGACY_ROUTE_PREFIXES` explicitly (request bytes identical to 0.3.x). Family error bodies received through the facade are restored from the unified envelope to the original family `status` / `code` / `retryAction`.
- Deprecation notice: at the `unified-v1` freeze (1.0.0) `./api` becomes 1.0.0, the SDK1 root entry is marked deprecated and removed in 2.0; deprecation always leaves at least one minor release of window.

The route table, discovery and session-level closure, unified headers and the error envelope are documented in full in [Unified API](/en/unified-api/) and [Unified API headers and error envelope](/en/unified-api/headers-and-errors/); the SDK-side handling of errors is in [Errors and retries](/en/sdk/errors-and-retries/#经-api-时的统一错误信封).

## Performance and deferred disclosure (recorded as is, thresholds unchanged)

SDK 2.0's performance gates are handled as "conditional delivery of the feature + explicit deferred disclosure" (SDK2-09, user-authorized proxy decision D12 → B): the features have shipped, remain off by default / explicit opt-in, and are **not relabelled as external dependencies, the thresholds are not changed, and nothing is declared passed**. The latest formal readings come from the PERF-01 formal measurement (2026-10-04, idle window, median of three valid groups each for baseline / candidate):

| Gate | Threshold | Formal reading | Verdict |
|---|---|---|---|
| CLI TUI ready for input (USDK-08) | < 300 ms | Warm cache **287 ms** (first run 361 ms and compile cache off 348 ms are disclosure items) | **Passed** (13 ms margin); first run / cache off do not pass the gate and are disclosed only |
| 32 KiB resident per mapping | ≤ 32,768 B per mapping and lower bound ≥ 0 | Per-mapping heap excluding the constant term [−71,306, +7,144] B (interval spans zero → `unknown`); constant-term heap 1,856,065–1,866,497 B, inside the 2 MiB ratchet (a disclosure item, not a design cap) | **Gate does not turn green**; the SDK2-09 B disclosure is unchanged |
| Cache-local P95 (short-text hot / cold-restore hot / cold-restore cold) | ≤ 10 / 10 / 50 ms | **24.9 / 24.2 / 174.9 ms** (−5.0 / −2.0 / −40.0 ms vs the same-window baseline) | **Still red** |
| 1record / 1KiB sync-pressure profile | ≤ 2× (and no regression vs SDK2-09) | Ratio median 11.3× (baseline 11.0×; SDK2-09 on 2026-10-01 was 10.3–12.4×) | **Still red**, no regression |
| Hot-window durable COMMIT (PERF-01 (c)) | Should be 1 (was 2) | **1** | Passed |

Net provider-cache savings remain unproven (the original 17 h real bill of ¥175.32 covered 2,263 attempts; the 840-cell matrix with 239 pass / 601 fail is a historical final state). The Node compile cache of the CLI since 0.10.1 (currently 0.10.3; `TANSR_COMPILE_CACHE`) is one of the dependencies of the TUI gate passing; the first start writes about 2 MB of disk cache per version — see [Settings and doctor](/en/cli/settings-and-doctor/).
