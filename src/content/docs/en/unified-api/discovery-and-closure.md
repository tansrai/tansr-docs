---
title: Discovery and the capability closure
description: Semantics of the three discovery endpoints to call at startup, GET /api/manifest, GET /api/capabilities and the per-session GET /api/sessions/:id/capabilities; how closureId is computed and how the tansr-closure-id precondition works; the responses for the enabled / disabled / unavailable states; what a client should do when the manifest revision drifts.
zone: docs
category: unified-api
sidebar:
  order: 3
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/deploy-and-auth
  - errors/codes
sources:
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/src/api/closure.ts
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
lastVerified: '2026-10-13'
---

The capabilities of `/api` are **discoverable**: the manifest tells you which operations this server version defines, the deployment-wide capabilities tell you which domains this server has assembled, and the per-session capability closure tells you which operations are allowed right now, in a given session, under the current authorisation. All three endpoints are read-only, require authentication and return no navigable URL.

## The three discovery endpoints

| Operation | Path | Question it answers | Response highlights |
|---|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | What this server version defines | The whole manifest (`format: tansr-api-manifest-v1`, `revision`, `schemaHash`, `families`, `operations`, `capabilities`, `platformApi`) plus `runtime.installed` (whether each domain is assembled; for the session domain the preferred family name or `null`) |
| `discovery.capabilities` | `GET /api/capabilities` | What this server has assembled | `{ contract, manifestRevision, schemaHash, domains }`; each domain gives `installed`, `contract` (family name), `status` and `schemaHash`, and the session domain adds `family: { preferred, available }` |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | What can be done in this session right now | The capability closure (next section); the response header `tansr-closure-id` equals `closureId` in the body |

Shared rules:

- `GET` only; any other method is 405 `method_not_allowed` (with `allow: GET`).
- No query string and no request body; sending either is 400 `invalid_request`.
- Responses carry `cache-control: no-store`: rediscover on every start or reconnect, never cache to disk.
- `tansr-domain` is `discovery` on all three, and `tansr-schema-hash` is the aggregate manifest `schemaHash`; on responses of other domains that header is the digest of the family's source file and is not comparable with the aggregate value.
- The bodies contain **no** navigation fields such as URLs, `href` or `links`. Paths are instantiated only on the client, from manifest templates plus path parameters.

## The per-session capability closure

The capability closure is a deterministic snapshot the server takes of operation availability for "this session, this user, right now":

```json
{
  "contract": "unified-v1",
  "closureId": "<sha256 hex>",
  "authorizationRevision": "<string or null>",
  "domains": {
    "session": { "installed": true, "revision": "<family revision>" },
    "archive": { "installed": false, "revision": null }
  },
  "operations": {
    "session.message.send": "enabled",
    "session.audio.speak": "disabled",
    "archive.binding.create": "unavailable"
  }
}
```

- `operations` covers 77 operations (the 81 of manifest revision 7 minus the 3 discovery endpoints and the deployment-wide `session.capabilities`, i.e. `GET /api/capabilities/sessions`), each in one of three states:
  - `enabled`: inside the closure, may be called;
  - `disabled`: the capability exists on this server but the current authorisation or session state does not allow it (for example the session has ended, a required capability is not granted, the archive binding has not reached a writable epoch);
  - `unavailable`: the capability does not exist at the boundary of this server or this session (domain not assembled, audio / input source not wired, and so on).
- `closureId = sha256(UTF8('tansr.unified.closure.v1') ‖ 0x00 ‖ canonical({ authorizationRevision, domains, operations }))`, where `canonical` is the strict JSON encoding of `@tansr/protocol/canonical`. A client may recompute it locally as a check, but it never needs to derive the closure itself: the closure content is always what the server answered.
- Session not found, or not owned by the current user: 404 `not_found`, with no distinction between the two cases; session domain not assembled or closure source not wired: `capability_unavailable` (`detail.reason: not_installed`); closure source temporarily unavailable: 503 `upstream_unavailable` (with `retry-after`).

## Using `tansr-closure-id` as a precondition on writes

Once you hold a closure, send the request header `tansr-closure-id: <closureId>` on **session-scoped write operations**. Before delegating to the domain handler the server performs two checks:

| Check | Response when it fails |
|---|---|
| Does the `closureId` in the header equal the current closure? | 412 `precondition_failed`, `retryAction: rediscover`, `detail.domainCode: closure_stale`; the response header `tansr-closure-id` carries the current value |
| Is the operation `enabled` in the current closure? | `disabled`: 403 `capability_unavailable`; `unavailable`: 404 `capability_unavailable`; in both cases `detail` is `{ reason: 'outside_closure', operation, state, closureId }` |

Three points to note:

- The header only makes sense on session-scoped writes. On `GET` / `HEAD`, or on a non-session path (for example `POST /api/executors/connections`), it is 400 `invalid_request` (`detail.header: tansr-closure-id`).
- Without the header the server skips the closure check, and the domain handler remains the final authority: it rejects unauthorised requests according to its own subcontract. The closure lets a client receive a uniformly shaped rejection **earlier**; it never relaxes any check.
- There is exactly one correct reaction to a 412: call `GET /api/sessions/:id/capabilities` again and retry with the new `closureId`. Do not guess, do not keep the old value, do not fall back to an old prefix.

## Revision drift

Every `/api` response carries `tansr-manifest-revision`. Official clients lock the revision and `schemaHash` they were generated against at build time (for example `@tansr/api-client/api` exposes them as `client.locked`, with the runtime observation in `client.observed()`). If at runtime the server's revision differs from the locked one:

- **Log it, do not switch logic.** Revision advances are additive (new operations, new fields); an older client keeps calling according to its own catalogue, and operations it lacks show up as `unavailable` in the closure or answer `capability_unavailable` / `not_found` when called.
- Do not change the parser because of it, and do not "try" the old prefix: that is exactly the silent downgrade forbidden by rule one.
- When you need new operations, upgrade the client to the version aligned with that revision (`@tansr/api-client` has been aligned with revision 7 since 0.3.0; the `./api` entry is unchanged in 0.4.0).

`@tansr/api-client/api` offers an `onContract` callback through which the `{ manifestRevision, schemaHash, domain }` of every response passes; it is a good hook for your diagnostics log.
