---
title: Clients by language
description: The Node @tansr/api-client 0.4.0 stable release. Usage and exports of ./api match 0.3.0, and the frozen entries now default to /api. Install commands, runtime requirements and release dates of the released clients, .NET 0.2.0, Android 0.5.0, iOS 0.4.0, HarmonyOS HAR 0.2.0, Go v0.3.0 and Rust / Python / C++ 0.1.0; and the shared rules of generated path modules, a zero-fallback response gate, unified-code-first errors and local checks of the three request headers.
zone: docs
category: unified-api
sidebar:
  order: 7
related:
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/discovery-and-closure
  - unified-api/migration
  - getting-started/sdk
  - android
  - ios
  - harmony
  - releases/sdk
sources:
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/api-client/package.json
  - tansr-cli:packages/api-client/src/api/client.ts
  - tansr-cli:packages/api-client/src/api/index.ts
  - tansr-cli:packages/api-client/src/api/errors.ts
  - tansr-cli:packages/api-client/src/api/types.ts
  - tansr-cli:packages/api-client/src/api/operations-generated.ts
  - tansr-cli:examples/serve-demo/unified-client.ts
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-ios:doc/report/REL-FULL-20261010-iOS-0.4.0.md
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
lastVerified: '2026-10-13'
---

Nine clients implement `unified-v1` against the same contract, but their **release cadence differs**. The table is current as of 2026-10-13. Version numbers and dates are taken from the registry records read that day (npm, NuGet, Maven Central, the GitHub Releases of `tansrai/tansr-ios-spm`, the Go module proxy, crates.io, PyPI and the GitHub Releases of `tansrai/tansr-cpp`), and each date is the UTC date of the registry record; HarmonyOS has no public package registry, so it is listed by the HAR shipped with the official download page. Each row ends with the last version on the public channel that still uses the old prefixes: an app installed at that version or earlier works as this chapter describes only after upgrading.

| Client | Public release | `/api` (unified-v1) support |
|---|---|---|
| Node `@tansr/api-client` | 0.4.0 stable (npm, 2026-10-06, `latest`) | **Released**: `./api` is unchanged from 0.3.0 and still aligned with manifest revision 7. Frozen `./sdk2` / `./terminal` default to `/api` when `routePrefixes` is omitted; pass `LEGACY_ROUTE_PREFIXES` to keep the old prefixes. `./api` exists since 0.3.0; 0.2.0 has no such entry |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet **0.2.0** (2026-10-07; 0.1.0.2 remains listed) | **Released**: 0.2.0 matches manifest revision 7; 0.1.0.2 predates that alignment and still uses the old prefixes |
| Android `com.tansr.sdk:core / client / compose` | Maven Central **0.5.0** (2026-10-07; the optional module `receiver-android` is first published at the same version) | **Released**: 0.5.0 matches manifest revision 7 with unified codes as the primary error signal; 0.4.0 and earlier still use the old prefixes |
| iOS `tansrai/tansr-ios-spm` | Public binary SPM **0.4.0** (2026-10-09) | **Released**: 0.4.0 matches manifest revision 7 and is the first to ship the SDK2 client, archive sync and the terminal interfaces; 0.3.0 still uses the old prefixes |
| HarmonyOS HAR `@tansr/harmony` | Bundled HAR **0.2.0** (2026-10-10; shipped inside the HarmonyOS demo package on the official download page, no OHPM channel) | **Released (bundled)**: 0.2.0 is on the unified-v1 contract and business code goes only through `/api`; 0.1.0 still uses the old prefixes |
| Go `github.com/tansrai/tansr-go` | Module **v0.3.0** (2026-10-07) | **Released**: from v0.2.0 the high-level session, executor and archive go through `/api`; v0.3.0 only moves the module path off `github.com/cpple/tansr-go` |
| Rust `tansr-sdk` / `tansr-sdk-demo` | crates.io **0.1.0** (2026-10-08) | **Released**: the async client uses the unified `/api` |
| Python `tansr-sdk` / `tansr-sdk-demo` | PyPI **0.1.0** (2026-10-08) | **Released**: sync and asyncio share one `/api` implementation |
| C++ `tansrai/tansr-cpp` | GitHub Release **v0.1.0** (2026-10-08) | **Released**: a static SDK and three standalone demos; not yet in the Conan Center or public vcpkg indexes |

## Rules every client shares

Whatever the language, the official clients all do the following; it doubles as a checklist when you write your own:

- **Paths come only from generated code.** Every repository holds a path module generated from `api-manifest.json` (Node `API_OPERATIONS`, .NET `Tansr.Sdk.Api.ApiRoutes`, Android `ApiOps`, iOS `ApiOps`, HarmonyOS `ApiOps`, Go `api/operations_gen.go`, Rust `src/api/operations.rs`, Python `tansr_sdk/api/operations.py`, C++ `include/tansr/operations.hpp`); no `/v2`, `/v3/sdk2` or `/v3/terminal` literal appears in source, and the generated code is locked in the repository together with the upstream commit so that CI can detect drift.
- **Zero-fallback response gate.** Every response (including 2xx and SSE opening) must carry all of `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`; a missing, duplicate or malformed header, or a `tansr-*` header outside the vocabulary, fails explicitly (Node `ContractUnavailableError`, .NET `ContractUnavailableException`, Android `TansrAgentException.ContractUnavailable` / `ApiContractException`, iOS `.contractUnavailable`, HarmonyOS `ApiContractError('contract_unavailable')`, Go `*api.ContractUnavailableError`, Rust `Error::Contract`, Python an `Error` whose `code == "contract"`, C++ `ErrorCode::contract`) with no parser switch, no fallback to the old prefixes and no automatic retry.
- **Unified codes first.** Errors are judged by the 19 unified codes plus the 6 `retryAction` values; the family code is only a detail in `detail.domainCode`. The old exception types that branched on family codes are kept for one version as a transition bridge and marked deprecated.
- **The three request headers are validated locally first.** A malformed `Idempotency-Key`, a weak `If-Match` validator or one used on an operation without `expectedRevision`, or an already expired `deadline` is rejected before sending (no network traffic); a retry keeps the same options, never changes the key and never extends the deadline.
- **Golden vector replay.** Every client replays the 165 vectors of `unified-v1.golden.json` through its real decoders and records any divergence outside the intersection with its declared capabilities.

## Node: `@tansr/api-client/api`

```bash
npm install @tansr/api-client
```

```ts
import {
  createApiClient, ApiError, DomainError, ContractUnavailableError, ApiClientError,
  retryAdvice, retrySameRequest, isTerminalEvent, API_OPERATIONS, API_CONTRACT_LOCK,
} from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'https://serve.example.com',   // origin only: no path, query or credentials
  token: () => loadEndUserToken(),        // or authorize(headers) for custom schemes
  sessionFamily: 'sdk1',                  // optional; omitted = deployment preferred family
  eventEnvelope: 'unified-v1',            // optional; negotiate the 7-key event envelope
  onContract: (seen) => log.debug('contract', seen, API_CONTRACT_LOCK),
});

try {
  const read = await api.call('archive.binding.get', { params: { id: bindingId } });
  await api.call('archive.binding.close', {
    params: { id: bindingId },
    body: { reason: 'done' },
    idempotencyKey: `close-${bindingId}`,
    ifMatch: read.meta.etag ?? undefined,
    deadline: new Date(Date.now() + 30_000),
  });
} catch (error) {
  if (error instanceof ApiError) {
    const advice = retryAdvice(error);
    if (advice.replayable) { /* retrySameRequest(api, { name, options }, error) */ }
    else if (advice.action === 'refresh') { /* re-read, take the new ETag, resubmit */ }
    else if (advice.action === 'rediscover') { /* GET /api/sessions/:id/capabilities again */ }
  }
  if (error instanceof ContractUnavailableError) { /* not a unified-v1 serve or a gateway stripped the headers */ }
}
```

Key points:

- The package is MIT with zero runtime dependencies and its `engines` field requires Node 20.3 or newer; the `./api` sub-entry relies only on `fetch` and other Web standard APIs, pulls in no Node-specific modules and does not load the agent kernel.
- Options of `createApiClient`: `baseUrl` (origin only), `token` or `authorize`, an injectable `fetch`, `sessionFamily`, `eventEnvelope`, `maxResponseBytes` (default 2 MiB), `maxEventFrameBytes` (default 2 MiB), `onContract`.
- Methods: `manifest()`, `capabilities()`, `sessionCapabilities(sessionId)` (returns `{ closure, closureId, meta }`, having checked that the response header and the `closureId` in the body agree), `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`, `events(name, { params, query, lastEventId, signal, onOpen })`; `locked` and `observed()` give the build-time locked and the runtime observed revision / `schemaHash`.
- Result shape `{ status, body, meta }`; `meta` holds `contract`, `manifestRevision`, `domain`, `schemaHash`, `closureId`, `eventEnvelope`, `traceId`, `etag`, `retryAfterMs`. A 202 is acceptance, not completion.
- Error types: `ApiError` (unified envelope: `code`, `status`, `retryAction`, `traceId`, `requestId`, `domainCode`, `detail`), `DomainError` (an un-normalised family envelope, today only `archive-sync-v1`), `ContractUnavailableError`, `ApiClientError` (local: `aborted`, `network_error`, `envelope_not_negotiated`, `payload_too_large`, `invalid_response`, `deadline_exceeded`, `if_match_not_applicable` and so on).
- `API_OPERATIONS` is the catalogue of 81 operations (revision 7), each with `method`, `path`, `params`, `aliases`, `domain`, `family`, `kind`, `sse`, `query`, `etagPath`, `expectedRevision`, `requestIdPath`; request bodies of the strict families (`sdk2-*`, `terminal-*`, `archive-sync-v1`) are encoded by the SDK as canonical JSON.
- The old entries `./sdk2`, `./sdk2/node`, `./terminal` and `./terminal/node` were frozen in 0.3.0 and are still shipped. From 0.4.0, omitting `routePrefixes` sends them to `/api`. Pass `LEGACY_ROUTE_PREFIXES` to keep the old prefixes. Export names were not added or removed.

## .NET

```powershell
dotnet add YourApp.csproj package Tansr.Sdk --version 0.2.0
dotnet add YourApp.csproj package Tansr.Sdk.Windows --version 0.2.0
```

The current public version on NuGet is **0.2.0** (`Tansr.Sdk` and `Tansr.Sdk.Windows`, 2026-10-07, MIT, source `tansrai/tansr-net`). `Tansr.Sdk` targets `netstandard2.0` and `net10.0` (marked AOT-compatible on `net10.0`) and covers HTTP / SSE, sessions, execution coordination and the storage interfaces; `Tansr.Sdk.Windows` targets `net48` and `net10.0-windows`, adds the Windows file / process, local SQLite and DPAPI adapters and depends on the core package automatically. The SDK is a library and does not carry a .NET runtime: .NET Framework apps need the system runtime, modern .NET apps can publish self-contained. It goes only through `/api`: the path constants `Tansr.Sdk.Api.ApiRoutes` are generated by `node scripts/generate-api-routes.mjs` from the vendored `contract/api-manifest.json`; the generic entry is `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`; the closure comes from `client.GetCapabilityClosureAsync(sessionId)`; the unified envelope decodes to `UnifiedApiException` (`Code` / `StatusCode` / `RetryAction` are primary, family facts live in `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`), and `UnifiedRetry.Advice(error)` with `UnifiedRetry.RetrySameRequestAsync(...)` carries the retry rules; `TansrClientOptions.NegotiateEventEnvelope` negotiates the event envelope explicitly and a missing echo throws `EnvelopeNotNegotiatedException`. The older 0.1.0.2 is still on NuGet and predates this contract alignment; do not treat it as an `/api` client. There are three examples, WPF, WinForms (.NET Framework 4.8) and console, under `examples/` in the source repository.

## Android

From Maven Central **0.5.0** (2026-10-07) every HTTP request goes only through `/api`: the generated `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt` (`ApiContract` constants and the 81 `ApiOps` operations with `etagPath` / `expectedRevision`) and `UnifiedContract.kt` (`UnifiedCode` with 19 codes, `UnifiedRetryAction` with 6 actions); the response gate `ApiContractGate.requireUnifiedValues`; errors surface as `TansrAgentException.Unified` (SDK1) or `ApiFacadeException` (SDK2 / terminal), with the 33 old sealed types deprecated and kept for one version; the three request headers travel optionally through `ApiCallOptions(idempotencyKey, ifMatch, deadline)` on `Sdk2Client.createBinding / acknowledge / closeBinding` and `TerminalClient.configure / memoryCommand`; the generator is `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>`, and `:core:contractCheck` includes the same-source mapping table and the 165 golden vector replay. Artefacts 0.4.0 and earlier predate these changes and still use the old prefixes; when upgrading, move `core` / `client` / `compose` to 0.5.0 together, and the optional `receiver-android` is first published at the same version. For the integration basics see [Android SDK](/en/android/).

## iOS

From the public binary SPM **0.4.0** (2026-10-09, iOS 16 or later, macOS 13 or later) the single path source is `Sources/TansrCore/Api/ApiContract.swift` (`ApiContract`, the 81 `ApiOps` operations); the response header gate `ApiContractGate.requireUnified` covers every SDK1 2xx response, the opening of event streams and the audio client, and a violation becomes `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable`, with the event pump entering the `failed` terminal state directly on a 2xx-shaped contract failure; the error model is `TansrAgentError.kind == .unified` (`unifiedCode` + `retryAction`) and `ApiFacadeError`; `ApiCallOptions` carries the three request headers; `onManifestRevisionDrift` fires once per client when the response revision differs from the local revision 7; CI `contract:check` and the full `swift test` include the golden vector replay. 0.4.0 is also the first release to ship the SDK2 client, archive sync and receiver, the execution journal and the terminal interfaces. 0.3.0 predates these changes and still uses the old prefixes; when upgrading from 0.3.0, rewrite the error branches around the unified codes and `retryAction`. For the integration basics see [iOS SDK](/en/ios/).

## HarmonyOS

From the bundled HAR **0.2.0** (2026-10-10, HarmonyOS 6.0 / API 20 at minimum, no OHPM channel) business code references only `ApiOps.*.apiPath` / `apiPath()`; the generated `tansr/src/main/ets/core/api/ApiContractGenerated.ets`, `core/api/UnifiedContractGenerated.ets` and `core/sdk2/client/SchemaGenerated.ets` come from `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>` out of the manifest, `sdk2-ext-v1.schema.json`, `unified-v1.schema.json` and `unified-v1.golden.json`, and `pnpm check:contract` verifies that the outputs and the lock agree; a missing one of the four unified response headers is `contract_unavailable` (with a `reason`), and the session pump enters the `failed` terminal state directly on a 2xx-shaped contract failure; SDK1 surfaces errors as `AgentError` (`error.unified`, `error.retryAction`, `error.domainCode`), SDK2 / terminal throw `ApiFacadeError` directly; the three request headers are validated locally through `ApiCallOptions(idempotencyKey, ifMatch, deadline)`. The 0.1.0 HAR predates these changes and still uses the old prefixes. For the integration basics see [HarmonyOS SDK](/en/harmony/).

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/tansrai/tansr-go` **v0.3.0** (2026-10-07, MIT, Go 1.25 or newer, standard library only, no third-party runtime dependencies). The module path moved off `github.com/cpple/tansr-go`: `v0.1.0` covers only `api` / `canonical` / `sse`; from `v0.2.0`, `session`, `executor` and `archive` are real implementations, with `go-chat`, `go-tools` and `go-archive`. `v0.3.0` changes only the module path; protocol behaviour is unchanged from `v0.2.0`. An upgrade must change `go.mod` and every import together. Do not mix types from the old and new modules. Install with `go get github.com/tansrai/tansr-go@v0.3.0`; the three examples install directly as commands, for example `go install github.com/tansrai/tansr-go/examples/go-chat@v0.3.0` (likewise `go-tools` and `go-archive`). Source is at `tansrai/tansr-go`.

## Rust

```sh
cargo add tansr-sdk@=0.1.0
```

`tansr-sdk` and `tansr-sdk-demo` **0.1.0** are on crates.io (2026-10-08, MIT, edition 2024). Rust 1.85 or newer is required. Windows builds also need the MSVC build tools and NASM on the current shell's PATH. The async client uses the unified `/api`. High-level sessions, explicit business tools and a single-device encrypted archive ship in the crate. The three example commands are `tansr-chat`, `tansr-tools` and `tansr-archive`, installed with `cargo install tansr-sdk-demo --version 0.1.0 --locked`. Source is at `tansrai/tansr-rust`.

## Python

```sh
python -m pip install tansr-sdk==0.1.0
```

`tansr-sdk` and `tansr-sdk-demo` **0.1.0** are on PyPI (2026-10-08, MIT, source `tansrai/tansr-python`). `requires-python` is `>=3.7,!=3.9.0,!=3.9.1`: CPython 3.7 or newer is supported, except 3.9.0 and 3.9.1. The minimum Python version and the TLS baseline are two separate conditions: the default HTTPS transport first checks the standard library's SSL runtime, and a known affected OpenSSL (such as the 1.1.1g bundled with the official Windows Python 3.7.9) is rejected as `unsupported_tls_runtime` with no bypass switch; use the isolated runtime described in the release notes, and prefer a maintained interpreter for new projects. The sync API and asyncio share one `/api` implementation. The example commands `tansr-py-chat`, `tansr-py-tools` and `tansr-py-archive` live in the `tansr-sdk-demo` package, installed with `python -m pip install tansr-sdk-demo==0.1.0`.

## C++

```cmake
find_package(TansrSDK 0.1.0 EXACT CONFIG REQUIRED)
target_link_libraries(my_app PRIVATE tansr::sdk)
```

GitHub Release **v0.1.0** of `tansrai/tansr-cpp` (2026-10-08, MIT) ships a source package plus Release static SDK and standalone demo builds for Windows x64 (MSVC 19.44), Linux x64 (Ubuntu 24.04 / GCC 13.3, glibc 2.38 or newer) and macOS arm64 (AppleClang 21, macOS 26.0 or later); the Conan / vcpkg recipes are distributed as release assets, and neither Conan Center nor the public vcpkg index lists the SDK yet. The language level is C++17; building from source needs CMake 3.25 or newer and Ninja, the dependencies are pinned to curl 8.22.0, c-ares 1.34.8 and OpenSSL 3.5.9, and you prepare them from the release manifest yourself because CMake does not download them. The three examples are `tansr-chat`, `tansr-tools` and `tansr-archive`.

## Next steps

- To understand the errors and actions every client judges the same way, read [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/).
- The integration steps of the three mobile SDKs are in [Android SDK](/en/android/), [iOS SDK](/en/ios/) and [HarmonyOS SDK](/en/harmony/); new versions of every client are recorded in each repository's release history and in this site's [release notes](/releases/sdk/).
