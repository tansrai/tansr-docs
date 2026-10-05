---
title: Clients by language
description: Usage and exports of the Node @tansr/api-client/api 0.3.0 stable release; where the .NET, Android, iOS, HarmonyOS and Go clients stand on unified-v1 (manifest revision 7), distinguishing released versions from mainline source; and the rules every client shares, namely generated path modules, a zero-fallback response gate, unified-code-first error handling and local validation of the three request headers.
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
  - tansr-cli:packages/api-client/src/api/client.ts
  - tansr-cli:packages/api-client/src/api/index.ts
  - tansr-cli:examples/serve-demo/unified-client.ts
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
lastVerified: '2026-10-05'
---

All six clients implement `unified-v1` against the same contract, but their **release status differs**. The table below states the facts as of 2026-10-05 for each repository's mainline and its public release artefacts; "mainline aligned, unreleased" means the version you install from the public channel does not go through `/api` yet.

| Client | Public release | `/api` (unified-v1) support |
|---|---|---|
| Node `@tansr/api-client` | 0.3.0 stable (npm, 2026-10-04) | **Released**: `@tansr/api-client/api` entry, aligned with manifest revision 7 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet 0.1.0.2 | Mainline aligned with revision 7 (2026-10-03), **unreleased**; 0.1.0.2 still uses the old prefixes |
| Android `com.tansr.sdk:core / client / compose` | Maven Central 0.4.0 | Mainline aligned with revision 7 (2026-10-03), **unreleased**; 0.4.0 still uses the old prefixes |
| iOS `tansrai/tansr-ios-spm` | Public binary SPM 0.3.0 | Mainline aligned with revision 7, **unreleased**; 0.3.0 still uses the old prefixes |
| HarmonyOS HAR `@tansr/harmony` | Bundled HAR 0.1.0 (no OHPM channel) | Mainline aligned with revision 7 (2026-10-04), **unreleased**; 0.1.0 still uses the old prefixes |
| Go `github.com/cpple/tansr-go` | Tag `v0.1.0` (with the 2026-10-02 release train) | `v0.1.0` is a skeleton: `api` / `canonical` / `sse` are implemented and tested, `executor` / `archive` are interfaces only; the mainline has since aligned with revision 7 and the three request headers (2026-10-03, including breaking changes to the error types) with no new tag yet |

## Rules every client shares

Whatever the language, the official clients all do the following; it doubles as a checklist when you write your own:

- **Paths come only from generated code.** Every repository holds a path module generated from `api-manifest.json` (Node `API_OPERATIONS`, .NET `Tansr.Sdk.Api.ApiRoutes`, Android `ApiOps`, iOS `ApiOps`, HarmonyOS `ApiOps`, Go `api/operations_gen.go`); no `/v2`, `/v3/sdk2` or `/v3/terminal` literal appears in source, and the generated code is locked in the repository together with the upstream commit so that CI can detect drift.
- **Zero-fallback response gate.** Every response (including 2xx and SSE opening) must carry all of `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`; a missing, duplicate or malformed header, or a `tansr-*` header outside the vocabulary, fails explicitly (Node `ContractUnavailableError`, .NET `ContractUnavailableException`, Android `TansrAgentException.ContractUnavailable` / `ApiContractException`, iOS `.contractUnavailable`, HarmonyOS `ApiContractError('contract_unavailable')`, Go `*api.ContractUnavailableError`) with no parser switch, no fallback to the old prefixes and no automatic retry.
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

- Options of `createApiClient`: `baseUrl` (origin only), `token` or `authorize`, an injectable `fetch`, `sessionFamily`, `eventEnvelope`, `maxResponseBytes` (default 2 MiB), `maxEventFrameBytes` (default 2 MiB), `onContract`.
- Methods: `manifest()`, `capabilities()`, `sessionCapabilities(sessionId)` (returns `{ closure, closureId, meta }`, having checked that the response header and the `closureId` in the body agree), `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`, `events(name, { params, query, lastEventId, signal, onOpen })`; `locked` and `observed()` give the build-time locked and the runtime observed revision / `schemaHash`.
- Result shape `{ status, body, meta }`; `meta` holds `contract`, `manifestRevision`, `domain`, `schemaHash`, `closureId`, `eventEnvelope`, `traceId`, `etag`, `retryAfterMs`. A 202 is acceptance, not completion.
- Error types: `ApiError` (unified envelope: `code`, `status`, `retryAction`, `traceId`, `requestId`, `domainCode`, `detail`), `DomainError` (an un-normalised family envelope, today only `archive-sync-v1`), `ContractUnavailableError`, `ApiClientError` (local: `aborted`, `network_error`, `envelope_not_negotiated`, `payload_too_large`, `invalid_response`, `deadline_exceeded`, `if_match_not_applicable` and so on).
- `API_OPERATIONS` is the catalogue of 81 operations (revision 7), each with `method`, `apiPath`, `query`, `kind`, `sse`, `etagPath`, `expectedRevision`, `requestIdPath`; request bodies of the strict families (`sdk2-*`, `terminal-*`, `archive-sync-v1`) are encoded by the SDK as canonical JSON.
- The old entries `./sdk2`, `./sdk2/node`, `./terminal` and `./terminal/node` are frozen in 0.3.0: still shipped, no further changes.

## .NET

On the mainline (unreleased) the SDK goes only through `/api`: the path constants `Tansr.Sdk.Api.ApiRoutes` are generated by `node scripts/generate-api-routes.mjs` from the vendored `contract/api-manifest.json`; the generic entry is `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`; the closure comes from `client.GetCapabilityClosureAsync(sessionId)`; the unified envelope decodes to `UnifiedApiException` (`Code` / `StatusCode` / `RetryAction` are primary, family facts live in `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`), and `UnifiedRetry.Advice(error)` with `UnifiedRetry.RetrySameRequestAsync(...)` carries the retry rules; `TansrClientOptions.NegotiateEventEnvelope` negotiates the event envelope explicitly and a missing echo throws `EnvelopeNotNegotiatedException`. 0.1.0.2 on NuGet predates these changes.

## Android

On the mainline (unreleased) every HTTP request goes only through `/api`: the generated `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt` (`ApiContract` constants and the 81 `ApiOps` operations with `etagPath` / `expectedRevision`) and `UnifiedContract.kt` (`UnifiedCode` with 19 codes, `UnifiedRetryAction` with 6 actions); the response gate `ApiContractGate.requireUnifiedValues`; errors surface as `TansrAgentException.Unified` (SDK1) or `ApiFacadeException` (SDK2 / terminal), with the 33 old sealed types deprecated; the three request headers travel optionally through `ApiCallOptions(idempotencyKey, ifMatch, deadline)` on `Sdk2Client.createBinding / acknowledge / closeBinding` and `TerminalClient.configure / memoryCommand`; the generator is `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>`, and `:core:contractCheck` includes the same-source mapping table and the 165 golden vector replay. 0.4.0 on Maven Central predates these changes. For the integration basics see [Android SDK](/en/android/).

## iOS

On the mainline (unreleased) the single path source is `Sources/TansrCore/Api/ApiContract.swift` (`ApiContract`, the 81 `ApiOps` operations); the response header gate `ApiContractGate.requireUnified` covers every SDK1 2xx response, the opening of event streams and the audio client, and a violation becomes `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable`, with the event pump entering the `failed` terminal state directly on a 2xx-shaped contract failure; the error model is `TansrAgentError.kind == .unified` (`unifiedCode` + `retryAction`) and `ApiFacadeError`; `ApiCallOptions` carries the three request headers; `onManifestRevisionDrift` fires once per client when the response revision differs from the local revision 7; CI `contract:check` and the full `swift test` include the golden vector replay. The public binary SPM 0.3.0 predates these changes. For the integration basics see [iOS SDK](/en/ios/).

## HarmonyOS

On the mainline (unreleased) business code references only `ApiOps.*.apiPath` / `apiPath()`; the generated `tansr/src/main/ets/core/api/ApiContractGenerated.ets`, `core/api/UnifiedContractGenerated.ets` and `core/sdk2/client/SchemaGenerated.ets` come from `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>` out of the manifest, `sdk2-ext-v1.schema.json`, `unified-v1.schema.json` and `unified-v1.golden.json`, and `pnpm check:contract` verifies that the outputs and the lock agree; a missing one of the four unified response headers is `contract_unavailable` (with a `reason`), and the session pump enters the `failed` terminal state directly on a 2xx-shaped contract failure; SDK1 surfaces errors as `AgentError` (`error.unified`, `error.retryAction`, `error.domainCode`), SDK2 / terminal throw `ApiFacadeError` directly; the three request headers are validated locally through `ApiCallOptions(idempotencyKey, ifMatch, deadline)`. The bundled HAR 0.1.0 predates these changes. For the integration basics see [HarmonyOS SDK](/en/harmony/).

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/cpple/tansr-go` (standard library only, zero third-party dependencies): the sub-packages `api` (discovery / `Call` / `Events` / error envelope / retry advice), `canonical` and `sse` are implemented and tested, `executor` and `archive` are interface definitions only, and validation against a real session service is still pending. The tag `v0.1.0` was cut with the 2026-10 release train; the mainline has since made `APIError.Code` / `RetryAction` typed constants (19 `api.Code*`, 6 `api.Action*`, with `Detail.DomainCode` as the secondary field) and wired the three request headers (`CallOptions.IfMatch` / `Deadline` / `IdempotencyKey`, `Meta.ETag` accepts the strong form only); these changes are breaking relative to `v0.1.0` and no new tag has been cut.

## Next steps

- To understand the errors and actions every client judges the same way, read [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/).
- To align a mobile or desktop app with `/api` ahead of time, build from each repository's mainline; new public versions are recorded in each repository's release history and in this site's [release notes](/releases/sdk/).
