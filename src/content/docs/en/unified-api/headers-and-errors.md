---
title: Unified request headers, response headers and the error envelope
description: The headers a request on /api may carry (Authorization, x-request-id, tansr-session-family, tansr-closure-id, tansr-event-envelope, Idempotency-Key, If-Match / ETag, deadline), the four tansr-* headers every response must carry, and the unified error envelope for status ≥ 400 with its 19 unified codes, 6 retryAction values, how to read detail.domainCode and the status rewrite rules.
zone: docs
category: unified-api
sidebar:
  order: 4
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/events
  - unified-api/clients
  - errors/codes
  - sdk/errors-and-retries
  - serve/v2-and-webhooks
sources:
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-error-map.json
  - tansr-cli:packages/server/src/api/request-headers.ts
  - tansr-cli:packages/server/src/api/error-envelope.ts
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-13'
---

`/api` lifts "how a request is expressed" and "how a failure is expressed" out of the domain subcontracts and defines both uniformly. This page is the fact table for those two things; success bodies are out of scope, since they are constrained by the domain subcontracts and byte-identical to the old prefixes.

## Request headers

| Header | Scope | Semantics |
|---|---|---|
| `Authorization: Bearer <token>` | Every request | Identity lives here only. Missing or invalid: 401 `unauthorized` (response carries `www-authenticate: Bearer`); authentication source unavailable: 503 `capacity_exceeded` (with `retry-after`). An identity field in the body may only agree with the authenticated principal, otherwise the request is rejected |
| `x-request-id` (or W3C `traceparent`) | Optional | Trace identifier. A valid `x-request-id` (1–128 alphanumerics plus `._-`) is adopted as is; otherwise the trace-id of `traceparent`; otherwise the server mints one. The `x-request-id` response header and `traceId` in the error envelope carry the same value. It is unrelated to the business idempotency key `requestId` |
| `tansr-session-family: sdk1 \| sdk2-offload-v1` | Optional; session and execution domains | Declares the session family; defaults to the deployment's preferred family. Outside the vocabulary: 400 `invalid_request`; not assembled: `capability_unavailable` (`detail.reason: not_installed`) |
| `tansr-closure-id: <closureId>` | Optional; session-scoped writes only | Closure precondition; mismatch is 412 `precondition_failed` / `rediscover`. On `GET` or a non-session path: 400. See [Discovery and the capability closure](/en/unified-api/discovery-and-closure/) |
| `tansr-event-envelope: unified-v1` | Optional; effective on stream operations | Explicit negotiation of the unified event envelope; the server echoing the same header is the confirmation. A value outside the vocabulary on any `/api` path: 400. See [Event streams and the unified event envelope](/en/unified-api/events/) |
| `Idempotency-Key: <key>` | Optional; writes only | Idempotency key for writes, effective since `@tansr/serve` 0.14.0. See the next section |
| `If-Match: "<revision>"` | Optional; only the 9 writes with `expectedRevision` registered | Resource-version precondition, effective since 0.14.0. See the next section |
| `deadline: <RFC 3339>` | Optional | Absolute request deadline, effective since 0.14.0. See the next section |

## The three request headers: idempotency, conditional writes and deadline

All three headers are **explicitly negotiated**: a malformed or inapplicable header is not ignored but answered 400 `invalid_request`, with `detail.reason` naming the cause (`idempotency_key_invalid` / `idempotency_key_not_applicable` / `if_match_invalid` / `if_match_not_applicable` / `deadline_invalid`) and `detail.header` naming the header.

### `Idempotency-Key`

- Shape: 1–128 printable ASCII characters (`^[\x21-\x7e]{1,128}$`). Valid only on operations the manifest classifies as **write**.
- The server maps it onto the family's in-domain idempotency key (`request.requestId` for `sdk2-ext-v1` and related families, `requestId` for the three terminal families; `agent-session-v1` has no body slot and recognises the header only). If the body already carries the key with a different value: 409 `conflict` (`detail.reason: idempotency_key_mismatch`).
- **Same key, same meaning** (same user, same operation, same manifest revision, same request fingerprint): the receipt of the first execution is returned and the side effect happens exactly once. **Same key, different meaning**: 409 `conflict` (`detail.domainCode: request_id_conflict`, `detail.reason: idempotency_key_reused`). A request with the same key still in flight waits for the first result and then returns the same receipt.
- The receipt cache is bounded: 256 entries per user, 4096 overall, kept for 10 minutes. If the original receipt has been evicted: 503 `result_unknown` (`retryAction: query-status`, `detail.reason: receipt_not_retained`); if the in-flight window is full: 503 `result_unknown` (`detail.reason: receipt_window_full`, with `retry-after`). Neither case may be **replayed**; confirm the outcome through the domain's query operation (such as `archive.operation.query`, `cache.operation.query`, `terminal.memory.receipt`).

### `If-Match` and `ETag`

- Only the strong validator `"<decimal revision>"` is accepted; weak validators (`W/`), wildcards and non-numeric values are 400.
- Valid only on the 9 writes with `expectedRevision` registered in the manifest: `archive.binding.create`, `archive.binding.close`, `archive.ack.commit`, `cache.binding.renew`, `cache.binding.rebind`, `cache.binding.rotate`, `cache.binding.close`, `terminal.configuration.commit`, `terminal.memory.command`. On any other operation: 400 `if_match_not_applicable`.
- The server maps it onto `expectedRevision` in the body (filled in when absent; when present and different: 412 `precondition_failed`, `detail.reason: if_match_body_mismatch`). If the resource version has moved on: 412 `precondition_failed`, `retryAction: refresh`, `detail.domainCode` is the original family code (`revision_conflict` / `stale_revision` / `binding_conflict`), `detail.reason: if_match_stale`, and **nothing has been written**.
- 2xx responses of versioned resources carry `ETag: "<revision>"`; 15 operations emit it (reads and writes of archive bindings and status, cache bindings, terminal configuration and memory). The correct pattern is: read, take the `ETag`, write with it as `If-Match`; after a 412 read again instead of guessing by incrementing the revision.

### `deadline`

- Shape: an RFC 3339 date-time (`2026-10-05T08:00:00Z` or with an offset), the absolute deadline.
- Already expired when it reaches the server: 408 `invalid_request` (`detail.reason: deadline_exceeded`), not accepted, nothing downstream is touched. If not expired, the server delegates to the domain handler as is and does not time the downstream on your behalf.
- A retry **never extends** the deadline: official clients reject an already expired request locally before sending, and `retrySameRequest` gives up when the wait would cross the deadline.

### The body cap shared by the three headers

For a request carrying `Idempotency-Key` or `If-Match` the server has to read the whole body to fingerprint it and map the header into it; the cap is 1 MiB. Over the cap: 413 `payload_too_large` (`detail.reason: header_body_limit`, `detail.limitBytes: 1048576`). Do not put these two headers on bulk upload operations such as `material.upload.chunk`.

## Response headers

| Header | When present | Contents |
|---|---|---|
| `tansr-contract` | Every `/api` response (including 2xx and SSE opening) | Always `unified-v1`. Missing means the contract is unavailable: you are not talking to `/api`, or a gateway in between swallowed the header. Report it, do not fall back |
| `tansr-manifest-revision` | Every response | The server's manifest revision (currently `7`) |
| `tansr-domain` | Every response | The handling domain (one of the 9 domain words) |
| `tansr-schema-hash` | Every response | `sha256:<64 hex>`; the discovery endpoints give the aggregate manifest value, other domains give the digest of the family's source file |
| `tansr-closure-id` | The per-session capability closure response; closure rejections with 412 / 403 / 404 | The current `closureId` |
| `tansr-event-envelope` | Negotiated event streams | Echoes `unified-v1`, the only signal that negotiation succeeded |
| `ETag` | 2xx of the 15 versioned-resource operations | Strong validator `"<revision>"` |
| `x-request-id` | Every response | Trace identifier |
| `retry-after` | 429 / 503 | Seconds; official clients wait for it, bounded by the local budget and `deadline` |
| `www-authenticate` | 401 | `Bearer` |
| `allow` | 405 | Allowed methods |

Duplicate headers, malformed values or `tansr-*` headers outside the vocabulary are all treated by official clients as contract unavailable.

## The unified error envelope

Every JSON error body with status ≥ 400 on `/api` has the same shape:

```json
{
  "contract": "unified-v1",
  "traceId": "4f1c0f0e2b7a4d1c",
  "requestId": null,
  "code": "capability_unavailable",
  "status": 403,
  "retryAction": "none",
  "message": "session.audio.speak is disabled for this session",
  "detail": {
    "reason": "outside_closure",
    "operation": "session.audio.speak",
    "state": "disabled",
    "closureId": "9f3c…e1"
  }
}
```

- `code`, `status` and `retryAction` are the **public decision surface**: branch on `code`, decide the next step from `retryAction`, never infer from the HTTP status or from `message`.
- `traceId` equals the `x-request-id` response header; `requestId` is the client's idempotency key (`Idempotency-Key` or `requestId` in the body), `null` when there is none.
- `message` is human-readable text with no literal guarantee; internal paths are rewritten to the requested `/api` path and never leak the old prefixes.
- `detail` is an optional structured slot. When a domain error is normalised by the facade the original family facts are kept: `detail.domainCode` (original family code), `detail.domainStatus` (original HTTP status), `detail.domainRetryAction` (original family action); original `detail` keys such as the cache domain's `fallback` are preserved as is.
- The single exception: the `archive-sync-v1` family (`archive.sync`) has no unified code table and its error bodies pass through in their original envelope.

### The 19 unified codes

| `code` | Default status | Default `retryAction` | Meaning |
|---|---|---|---|
| `invalid_request` | 400 (kept when the original status is 422) | `none` | Malformed request: extra query keys, missing `protocol`, malformed header, expired `deadline` (408), and so on |
| `protocol_mismatch` | 400 | `none` | The revision identifier in the query string is not the value registered for the operation |
| `not_canonical` | 400 | `none` | A strict canonical entry rejected a non-canonical body |
| `unauthorized` | 401 | `none` | Not authenticated |
| `forbidden` | 403 | `none` | Ownership mismatch (including access to another user's session / binding) |
| `not_found` | 404 | `none` | The resource does not exist, or there is no such path under `/api` |
| `capability_unavailable` | 404 (403 when the closure says `disabled`) | `none` | Domain not assembled, capability absent, outside the closure |
| `method_not_allowed` | 405 | `none` | Method not allowed (with `allow`) |
| `conflict` | 409 | `none` | Idempotency key reused, state-machine conflict, deployment / ownership condition unmet (such as recovery unavailable) |
| `stale_generation` | 409 | `rebind` | The binding / connection generation has expired; bind again |
| `gap` | 409 | `none` | Sequence gap |
| `gone` | 410 | `none` | Session ended, binding closed |
| `precondition_failed` | 412 | `rediscover` (stale closure) / `refresh` (stale resource version) | A precondition does not hold |
| `payload_too_large` | 413 | `none` | Over a body cap |
| `rejected` | 422 | `none` | Semantic validation failed |
| `capacity_exceeded` | 429 (kept when the original status is 503) | `same-request` | Rate limited, draining, overloaded, authentication source unavailable; with `retry-after` |
| `internal_error` | 500 | `none` | Internal server error, or a domain code not registered in the matrix (the original status is only in `detail.domainStatus`) |
| `upstream_unavailable` | 503 | `same-request` | Upstream / capability source temporarily unavailable |
| `result_unknown` | 503 | `query-status` | The outcome of a side effect is unknown: query only, never replay. `retryAction` is only ever `query-status` or `rebind`; a family action mapping never turns it into a resend suggestion |

Status rewrite rule: every unified code has a default status; when the original family status falls within the alternatives the RFC allows for that code (400/422, 409/412, 409/410, 404/403, 429/503) the original status is kept, otherwise the default applies. Hence `session_ended` (409 on the old prefixes) leaves `/api` as 410 `gone`, `binding_closed` is likewise 410, `unsupported_capability` (422 or 409 on the old prefixes) becomes 404 `capability_unavailable`, and `commit_unknown` becomes 503 `result_unknown`; the original status is always in `detail.domainStatus`. Domain codes not registered in the matrix do not follow this rule: since `@tansr/serve` 0.15.1 they always get 500 `internal_error` (0.15.0 and earlier kept the original status), and the original status is likewise only in `detail.domainStatus`.

The facade itself answers directly with only 8 codes: `unauthorized`, `not_found`, `method_not_allowed`, `invalid_request`, `capability_unavailable`, `capacity_exceeded`, `precondition_failed`, `upstream_unavailable`; all others come from normalised domain errors.

### The 6 `retryAction` values

| `retryAction` | What you should do |
|---|---|
| `none` | Do not retry the same request; fix the request or inform the user |
| `same-request` | Wait for `retry-after` (or back off), then replay **the same request with the same `Idempotency-Key`** once |
| `query-status` | Do not replay; confirm the outcome with the domain's query operation, then decide |
| `rebind` | Re-establish the binding / connection (new generation), then proceed |
| `refresh` | Re-read the resource to obtain the new `ETag` / revision, then resubmit |
| `rediscover` | Call `GET /api/sessions/:id/capabilities` again (or rediscover entirely) and retry with the new closure |

`retryAdvice(error)` in `@tansr/api-client/api` encodes this table as `{ action, stated, replayable, retryAfterMs, closureId, … }`; `retrySameRequest()` replays exactly once, only when `replayable` is true (the server explicitly said `same-request`) and with the same key; `result_unknown` and `commit_unknown` are never replayed.

## Differences from the `/v2` error shape

The old prefixes return `{ "error": { "code", "message", "detail"? } }` with codes from each family's own vocabulary; on `/api` this becomes the eight-key unified envelope with the family code demoted to `detail.domainCode`. If your code used to branch on `error.code === 'session_ended'`, after moving to `/api` it should branch on `code === 'gone'` and look at `detail.domainCode` only when it needs the finer distinction. For the mapping see [Migration and retirement timetable](/en/unified-api/migration/).
