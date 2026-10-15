---
title: Errors and retries
description: Errors in the SDK surface in three places — TansrSdkError at assembly time, turn.error / tool.failed in the runtime event stream, and platform gateway error codes. This page gives the handling for each, by "which kind, retryable or not, how long to wait".
zone: docs
category: sdk
related:
  - errors/codes
  - sdk/sessions-and-events
  - sdk/checkpoints
  - support/troubleshooting
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

The SDK never calls `process.exit`. Errors come out of exactly three openings: at assembly / option time they are thrown as `TansrSdkError`; runtime model and tool errors are always expressed through the event stream (`turn.error` / `tool.failed` / `turn.aborted`); platform gateway error codes hide inside the payloads of those two. Decide which kind it is first, then decide whether to retry.

## Kind one: TansrSdkError (assembly / option time)

These are programming or environment errors thrown synchronously or on the first `next()` / `await createSession()`; **retrying does not help** — read the message and fix the code or the environment:

| code | When | Meaning and handling |
|---|---|---|
| `invalid_options` | Synchronous | An illegal option combination (fields of the three tiers mixed / a tool name outside the vocabulary / local configuration on the token tier / explicit `adjudication` together with `permission.mode`). Read the message and fix the code |
| `assembly_failed` | Assembly | Managed / token assembly failed (configuration unavailable / alias resolution failed / bundle fetch failed); `cause` preserves the underlying error |
| `capability_disabled` | Assembly | A capability flag is off but was selected explicitly; the message includes console repair guidance |
| `session_closed` | Runtime | A state-changing method was called after `close()` |
| `session_not_found` | Assembly | The `resume` target is not in the store — check with `list()` or create anew |
| `session_store_corrupted` | Assembly / persisting | The session storage is corrupted — never silent; delete the session directory and start over |
| `checkpoints_not_wired` | Runtime | `checkpoint()` / `listCheckpoints()` / `deleteCheckpoint()` or an explicit `compact({ checkpoint: true })` was called without checkpoint storage wired |
| `checkpoint_store_corrupted` | Runtime | A snapshot file is corrupted; `deleteCheckpoint()` that id and continue |
| `turn_running` | Runtime | An idle-only method was called while a turn was running; retry after `await session.idle()` — the only SDK error that means "come back in a moment" |
| `checkpoint_not_found` | Runtime | The snapshot named by `fork()` / `exportCheckpoint()` does not exist |
| `checkpoint_import_invalid` | Runtime | The imported bytes are not a valid export; tampering is rejected with nothing written to disk |
| `session_store_not_wired` | Runtime | `fork()` needs the session `store` and none was given |
| `platform_request_failed` | Runtime | The token tier's direct `session.platform.transcribe()` / `speak()` failed (`PlatformRequestError`); `status` / `platformCode` / `platformMessage` carry the gateway facts, and `status 0` = the platform was never reached. Since 0.19.0 failures of non-chat operations through `createPlatformNonchatClient` use the same code but throw `PlatformNonchatError` (`status` / `platformCode` / `outcomeUnknown` / `taskId?`): `outcomeUnknown: true` means the outcome of the submission is unknown — keep the original idempotency key and `taskId`, query the original task with `getTask()`, and never resubmit under a new key |
| `lifecycle_failed` | Cleanup | `SdkLifecycleError`: the cleanup settlement of `query()` failed (the session-level `drain()` / `closeAsync()` do not throw; they express it as a result with `status: 'failed'`); `failures` lists each stage and code, `cleanup` can be called again to continue reclaiming when present, and `result` is the completed `QueryResult` when present (see [Lifecycle and cleanup](/en/sdk/lifecycle/)) |

```ts
import { TansrSdkError, createSession } from '@tansr/sdk';

try {
  session = await createSession({ token, baseUrl, store, resume: { sessionId, store } });
} catch (e) {
  if (e instanceof TansrSdkError && e.code === 'session_not_found') {
    session = await createSession({ token, baseUrl, store }); // 确实不在 store 才新建
  } else {
    throw e; // session_store_corrupted 等恒上抛,不静默开空会话
  }
}
```

## Kind two: errors in the event stream

| Event | Meaning | What to do |
|---|---|---|
| `turn.error { scope, message, recoverable, errorKind?, detail? }` | An error within a turn | Look at `recoverable`: `true` is advisory (persistence failure, compaction failure, platform notice), goes into `SessionView.notices`, and the session continues; `false` means this turn failed and goes into `lastError` |
| `turn.aborted { reason }` | A turn was aborted | `reason` is a terminal word: a user `interrupt()` gives `aborted_*`; `max_turns` / `budget_exceeded` are caps; `client_gone` only appears in the session service form |
| `tool.failed { errorType }` | Tool execution failed | `timeout` / `unknown_tool` and so on; the model sees a structured failure result and reroutes on its own, so you normally do not need to step in |
| `tool.completed { isError: true }` | The tool ran but the result is an error | Provider failures and timeouts of the four media tools take this shape; `data.errorCode` carries the platform code |
| `tool.permission.decided { allow: false, decisionSource }` | Permission denied | `policy` = the fail-closed denial of a missing `askUser`; wire up `permission.askUser` or adjust the rules |

`turn.error.detail` is an optional structured field. **Available since SDK 0.13.0**: the four platform plan codes carry `detail: { scope: 'plan' }`, the same key and value as `error.detail.scope` on the session service HTTP surface, so the client can tell "local rate limiting" from "plan quota" apart.

## Kind three: platform gateway error codes

On the token tier, platform error codes appear in the first segment of the `turn.error` message, in `tool.completed.data.errorCode`, in `PlatformRequestError.platformCode` / `PlatformNonchatError.platformCode`, and in the response of your server's token minting call. The authoritative table of all codes is the [error code reference](/errors/codes); this page only covers the dozen or so you hit most often and how to handle them:

### Retry, waiting according to `Retry-After`

| Code | HTTP | Handling |
|---|---|---|
| [`rate_limited`](/errors/codes#rate_limited) | 429 | Platform rate limiting, always with `Retry-After` (whole seconds). Wait for that value and retry; do not resend more densely |
| [`upstream_error`](/errors/codes#upstream_error) / [`upstream_disconnected`](/errors/codes#upstream_disconnected) | 502 | A failure on the upstream model side; retry after exponential backoff with jitter |
| [`upstream_timeout`](/errors/codes#upstream_timeout) and `upstream_connect_timeout` / `upstream_ttfb_timeout` / `upstream_idle_timeout` / `upstream_total_timeout` | 504 | Upstream timeout; same backoff as above |
| [`plan_gate_unavailable`](/errors/codes#plan_gate_unavailable) | 503 | A transient outage of a platform gatekeeping dependency, `Retry-After: 5`; existing sessions are unaffected |

### Plan usage 429s: zero automatic retries

| Code | HTTP | Handling |
|---|---|---|
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | The plan's concurrency hard cap, `Retry-After: 30`. **Only new sessions are rejected; running sessions are never cut.** The SDK does zero retries — resending the same request inside the window is bound to be rejected again, and automatic retries from a multi-session host only cause a thundering herd. Let the user resend manually after 30 seconds; surface `detail.upgradeUrl` in your monitoring, it is the developer's signal to upgrade the tier |
| [`plan_end_users_exceeded`](/errors/codes#plan_end_users_exceeded) | 429 | The monthly end-user count of the test period is exhausted; token minting path only |
| [`quota_exceeded`](/errors/codes#quota_exceeded) and the per-surface `*_quota_exceeded` | 429 | The daily quota is exhausted; wait for the quota window to refresh, do not retry |

### Do not retry; fix the configuration or the code

| Code | HTTP | Handling |
|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) / [`token_expired`](/errors/codes#token_expired) | 401 | The session token expired or was revoked. **This is the only code that invalidates the token** — go back to your server and mint a new one. The client-side SDK re-fetches the token through the login state at most 2 times; if it is still 401 it enters the terminal state and the host reconnects explicitly |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | The application wallet balance is insufficient; it heals after a top up, retrying does not help |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | The model reference is not in the application's authorization set; grant it in the console |
| [`forbidden`](/errors/codes#forbidden) | 403 | A ring-3 capability flag is off (the gateway enforcement surface); `detail` carries guidance on enabling it |
| [`plan_required`](/errors/codes#plan_required) / [`plan_tier_insufficient`](/errors/codes#plan_tier_insufficient) | 403 | The account that owns the application has no valid plan, or its tier does not include the capability — a developer assembly error that should never reach end users; `detail.upgradeUrl` points to the console plan page |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | Over the body cap (for example raw audio for speech-to-text > 24 MiB, `detail.maxRawBytes`); split or compress, not retryable |
| [`validation_failed`](/errors/codes#validation_failed) / [`bad_request`](/errors/codes#bad_request) | 400 | The payload shape is illegal; read the message and fix the request |
| [`session_archived`](/errors/codes#session_archived) | 410 | The platform session has been archived (after the 30-day inactivity lease expired); this session can no longer be renewed, `resume` will fail, create a new session |
| [`context_window_exceeded`](/errors/codes#context_window_exceeded) | 400 | The request exceeds the model's context window; `compact()` first or switch to a model with a larger window |

## Retries the kernel already does for you

Transient failures at the model request layer **need no retry from you**: every entry on the fallback chain has its own retries (backoff 500 ms → 30 s, 3 attempts in total, honouring `Retry-After` first); once exhausted it switches to the next entry and emits `cost.provider.switched` (from / to / reason / attempts / failures). On a genuine context overflow (upstream 413) the kernel forces one compaction and retries. Your retry logic only needs to cover the session-level failures in the two "retry" tables above.

## How it looks in the session service form

With `@tansr/serve`, the same platform codes reach mobile clients after server-side mapping: the plan concurrency cap maps to `429 rate_limited` + `Retry-After` + `detail: { scope: 'plan' }`; `plan_required` / `plan_tier_insufficient` pass through as 403 with the original code + `detail.scope: 'plan'`; upstream rate limiting / 5xx / network errors map to `503 upstream_unavailable`. The client-side backoff discipline is unchanged: when a 429 / 503 carries `Retry-After`, wait for the whole-second value; on a 5xx without `Retry-After`, use exponential backoff with jitter. Details in [v2 protocol and webhooks](/en/serve/v2-and-webhooks/).

The above describes the error body `{ error: { code, message, detail? } }` of the `/v2` direct surface, whose bytes are unchanged from `@tansr/serve` 0.13.0 through 0.15.1; since 0.15.0 legacy-prefix responses only gain the two response headers `Deprecation` / `Link` (ignored by `@tansr/api-client` 0.3.x / 0.4.0), with body and status code unchanged.

## The unified error envelope on `/api`

Since `@tansr/serve` 0.13.0 (released 2026-10-02) new integrations use the unified call surface `/api`, where every JSON error ≥ 400 no longer takes a per-family shape but one unified envelope:

```json
{ "contract": "unified-v1", "traceId": "<x-request-id>", "requestId": "<客户端幂等键或 null>", "code": "capacity_exceeded", "status": 429, "retryAction": "same-request", "message": "...", "detail": { "domainCode": "rate_limited", "domainStatus": 429 } }
```

- `code` is one of **19 unified codes** (`invalid_request` / `protocol_mismatch` / `unauthorized` / `forbidden` / `not_found` / `method_not_allowed` / `gone` / `conflict` / `stale_generation` / `gap` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `result_unknown` / `rejected` / `internal_error`, plus the facade's own `precondition_failed` and `not_canonical`); the original family code (such as `rate_limited`, `session_ended`, `session_not_found` above) is kept only in `detail.domainCode`, and the original wire status in `detail.domainStatus`. One `switch (code)` covers every domain; read `domainCode` only when you need family-level distinctions.
- `retryAction` is one of **6 actions** and decides your next step: `none` not retryable; `same-request` replay the same request under the same key (wait first when `Retry-After` / `detail.retryAfterMs` is present); `query-status` check the receipt / status first; `rebind` rebuild the binding; `refresh` re-read the revision and retry; `rediscover` rerun capability discovery and retry. **`result_unknown` / `commit_unknown` only allow `query-status` or `rebind`; resending under a different key is forbidden** — it amounts to accepting a duplicated side effect.
- Since 0.14.0 rejections of the three request headers `Idempotency-Key` / `If-Match`+`ETag` / `deadline` use this same envelope without new error codes; the detailed reason is in `detail.reason` (such as `idempotency_key_reused`, `if_match_stale`, `deadline_exceeded`); `412 precondition_failed` can since then mean either a stale closure (`rediscover`) or a stale resource revision (`refresh`) — distinguish by `detail.domainCode`.
- A response without the `tansr-contract` header, or `/api` returning non-JSON / a proxy page, is always reported as "contract unavailable"; you **must not** guess that it is an older server and switch back to `/v2`.

The `./api` sub-entry of `@tansr/api-client` 0.3.0 and later (GA 2026-10-04; currently 0.4.0, 2026-10-06, with the `./api` sub-entry and root entry unchanged) packages this decoding as `ApiError` (readers for `code` / `retryAction` / `domainCode` / `domainStatus` / `closureId`) and the `retryAdvice` / `retrySameRequest` helpers, always downgrading `result_unknown` to `query-status`. The full table of unified codes, the `retryAction` source mapping and the per-family `domainCode` cross-reference are in [Unified API headers and error envelope](/en/unified-api/headers-and-errors/).
