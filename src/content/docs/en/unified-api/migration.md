---
title: Migration and retirement timetable
description: Path mapping and request / error shape differences when moving from /v2, /v3/sdk2 and /v3/terminal* to /api; the session service's /v1 being off by default since @tansr/serve 0.13.0 on deployments with /api, and the --legacy-v1 transition; progress of the six-step migration as of 0.15.0; the retirement cadence for /v2 and /v3/*, and the discipline of rolling server and clients back in pairs.
zone: docs
category: unified-api
sidebar:
  order: 6
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
  - releases/serve
  - releases/cli
sources:
  - tansr-cli:doc/report/UAPI-迁移与退役-2026-10-01.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-12'
---

`/api` is not a new protocol; it gathers the existing domain subcontracts under one prefix and one envelope. Most of the migration therefore consists of changing paths, headers and error handling rather than rewriting business logic; success bodies and event payloads do not change by a single byte.

## Path mapping

The relation between the old prefixes and `/api` is recorded in the `legacy` field of every manifest operation. The most common entries:

| Old path | `/api` | Notes |
|---|---|---|
| `POST /v2/sessions` | `POST /api/sessions` | Session family `sdk1` (default) |
| `POST /v3/sdk2/sessions` | `POST /api/sessions` + `tansr-session-family: sdk2-offload-v1` | Same path; the family is declared by the header |
| `GET /v2/sessions/:id/events` | `GET /api/sessions/:id/events` | Byte-identical frames without the negotiation header |
| `POST /v2/sessions/:id/permission/:requestId` | `POST /api/sessions/:id/permission/:ticketId` | Placeholder renamed to `:ticketId` (`:id` is still the session id) |
| `POST /v1/approvals/:id/credential` | `POST /api/approvals/:id/credential` | The only operation moved in from `/v1` (0.14.0) |
| `GET /v3/sdk2/session-capabilities` | `GET /api/capabilities/sessions?protocol=sdk2-ext-v1` | |
| `GET /v3/sdk2/capabilities` | `GET /api/capabilities/archive` | No query string |
| `POST /v3/sdk2/bindings` | `POST /api/archive/bindings` | |
| `GET /v3/sdk2/bindings/:id` | `GET /api/archive/bindings/:id?protocol=sdk2-ext-v1` | GET reads carry `protocol` |
| `POST /v3/sdk2/bindings/:id/archive/acks` | `POST /api/archive/bindings/:id/archive/acks` | |
| `POST /v3/sdk2/archive-sync/:id` | `POST /api/archive/sync/:id` | Error bodies stay in the original `archive-sync-v1` envelope |
| `GET /v3/sdk2/cache/capabilities` | `GET /api/capabilities/cache` | |
| `POST /v3/sdk2/cache/bindings` | `POST /api/cache/bindings` | |
| `POST /v2/executors/connections` | `POST /api/executors/connections` | |
| `GET /v3/terminal/capabilities` | `GET /api/capabilities/terminal?contract=terminal-services-v1` | |
| `POST /v3/terminal/bindings` | `POST /api/terminal/bindings` | |
| `GET /v3/terminal/sessions/:id/tool-output` | `GET /api/terminal/sessions/:id/tool-output?contract=…&sessionContract=…` | |
| `GET /v3/terminal-observation/sessions/:id/resources` | `GET /api/terminal/observation/sessions/:id/resources` | Prefix segment becomes `terminal/observation` |
| `GET /v3/terminal-profile/sessions/:id/catalog` | `GET /api/terminal/profile/sessions/:id/catalog` | Prefix segment becomes `terminal/profile` |

Do not maintain this table by hand: the path modules of the official clients are generated from the manifest, and a client of your own should likewise be generated from `GET /api/manifest` or the in-repo `api-manifest.json`.

## Request and error shape differences

| Aspect | Old prefixes | `/api` |
|---|---|---|
| Session family | Distinguished by path (`/v2` vs `/v3/sdk2`) | Same path, request header `tansr-session-family` |
| Subcontract revision | Partly in the path or body | GET reads use the query keys `protocol=` / `contract=`; POST writes accept no query string |
| Response headers | No uniform headers | Every response carries `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` |
| Error body | `{ error: { code, message, detail? } }`, codes from each family's vocabulary | Eight-key unified envelope, `code` is one of 19 unified codes, the family code moves to `detail.domainCode` |
| Status of some errors | `session_ended` 409, `binding_closed` 409, `unsupported_capability` 422 / 409 | 410 `gone`, 410 `gone`, 404 `capability_unavailable` (original status in `detail.domainStatus`) |
| Event frames | Original frames per domain | Identical without the negotiation header; the 7-key envelope with `tansr-event-envelope: unified-v1` |
| Idempotency / conditional write / deadline | Only `requestId` / `expectedRevision` in the body | Additionally the `Idempotency-Key` / `If-Match` / `deadline` headers (since 0.14.0), mapped by the server onto the body slots |
| 2xx body | — | **Byte-identical** |

The part most often missed is error handling: replace branches such as `error.code === 'session_ended'` with a branch on the unified code `gone`, decide the action from `retryAction`, and read `detail.domainCode` only when you need the finer distinction. See [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/).

## The session service's `/v1`

The `/v1` inside the session service process (`/v1/status`, the `/v1/sessions` family and the other single-tenant Bearer routes) and `/api` are two separate identity systems; `/api` has no counterpart for them. Since `@tansr/serve` 0.13.0:

- **`/v1` is off by default on deployments that assemble `/api`**: as a library, `disableV1` defaults to `true` when `startServer({ v2: … })` is used and `/v1*` requests get 404; the CLI form `tansr serve --v2` behaves the same.
- Transition: pass `disableV1: false` to the library; or add `--legacy-v1` to the CLI, or set the environment variable `TANSR_SERVE_LEGACY_V1=1` (the flag takes precedence over the variable).
- A SDK1-only `tansr serve` without `--v2` has no `/api` and is not affected; its `/v1` works as before.
- `@tansr/serve` 0.14.0 and `@tansr/cli` 0.10.1 (2026-10-04) mark `--legacy-v1` / `TANSR_SERVE_LEGACY_V1` as **deprecated**: still effective, but a deprecation notice is printed at startup. It is a separate retirement item whose removal date will be announced before 1.0.0.

The `/v1` in this site's REST reference is the platform-side interface and unrelated to the session service `/v1` discussed here.

## The six-step migration and where it stands

| Step | Content | Status as of `@tansr/serve` 0.15.1 (published 2026-10-10, current npm `latest`) |
|---|---|---|
| 1 | Internal adapter: `/api` rewrites and delegates to the existing domain handlers, old prefixes byte-identical | Done (0.13.0) |
| 2 | Dual write / shadow read: the same golden vectors run through the old entry and `/api`, success bodies byte-identical, error bodies field-for-field from the same source | Node and .NET have the same-source mapping tables and conformance replay; Android / iOS / HarmonyOS / Go align by replaying the 165 golden vectors |
| 3 | Client cut-over: no old prefix literal remains in any client's source | Node `@tansr/api-client` 0.3.0 stable has cut over (`./api`). From 0.4.0 (2026-10-06), the frozen `./sdk2` and `./terminal` entries also default to `/api` when `routePrefixes` is omitted; pass `LEGACY_ROUTE_PREFIXES` to keep the old prefixes. The `./api` entry is unchanged from 0.3.0. .NET NuGet 0.2.0, Go `github.com/tansrai/tansr-go` v0.3.0, and Rust / Python / C++ 0.1.0 ship on `/api`; Android, iOS and HarmonyOS release status is in [Clients by language](/en/unified-api/clients/); `examples/serve-demo` goes through the public SDK |
| 4 | Forbid mixing: a structured warning (no rejection) when the same session family is accessed through both prefixes | Started in 0.15.0: when the same session id is used through both `/api` and `/v2` or `/v3/*`, the server emits `api.legacy_prefix_mixed`. The default `readwrite` mode does not reject the request |
| 5 | Read-only window for the old entries: writes on `/v2` and `/v3/*` answer 410, reads are still served, responses carry a retirement header | The knob shipped in 0.15.0. The default remains `readwrite`, so writes are not answered with 410. Set `TANSR_SERVE_LEGACY_PREFIX=readonly` to open the read-only window; `off` answers 404 for every old prefix. Old-prefix responses also carry `Deprecation` and `Link` (and `Sunset` when `TANSR_SERVE_LEGACY_SUNSET` is set). The 0.15.0 release notes placed a future default of `readonly` on a later version. The current npm release, `@tansr/serve` 0.15.1 (2026-10-10), still defaults to `readwrite` and does not carry out that change. 0.16.0 is not published |
| 6 | Closure: remove the externally reachable `/v2` and `/v3/*` entries; old prefixes answer 404 in the unified envelope | 1.0.0 |

Self-hosted multi-replica deployments must adjust their reverse proxy before step 3: `/api/sessions/:id/**` must share shard affinity with `/v2/sessions/:id/**`, and the four SSE paths under `/api` follow the same long-connection discipline; otherwise cut-over produces cross-replica 404s.

## Retirement timetable

| Milestone | Releases | Change to the public contract |
|---|---|---|
| 2026-10-02 | `@tansr/serve` 0.13.0, `@tansr/protocol` 0.2.0, `@tansr/cli` 0.10.0 | `/api` generally available; `/v1` off by default on deployments with `/api`; retirement of `/v2` and `/v3/*` announced for 1.0.0 |
| 2026-10-04 | `@tansr/serve` 0.14.0, `@tansr/cli` 0.10.1, `@tansr/api-client` 0.3.0 | Manifest revision 7, the three request headers; `--legacy-v1` deprecated |
| 2026-10-06 | `@tansr/serve` 0.15.0, `@tansr/cli` 0.10.2, `@tansr/api-client` 0.4.0 | Step 4 warnings are on and do not reject by default; the step 5 read-only window can be opened explicitly, and the default remains `readwrite`; old-prefix responses carry `Deprecation` / `Link`; frozen api-client entries default to `/api` |
| 2026-10-10 | `@tansr/serve` 0.15.1, `@tansr/cli` 0.10.3 | The old-prefix window still defaults to `readwrite`. The Go / Rust / C++ consumer fixes in the same release do not change the `/api` envelope |
| 1.0.0 | `@tansr/serve` 1.0.0, `@tansr/api-client` 1.0.0 | External `/v2` and `/v3/*` entries removed, `/api` becomes the only surface; the `unified-v1` family moves from `candidate` to `frozen`; the SDK1 entry of `@tansr/api-client` deprecated, removed in 2.0 |

Turning off `/v1` and retiring `/v2` and `/v3/*` are two independent changes to the public contract, each with its own release notes.

## Rolling back in pairs

- **A server rollback must be paired with a client rollback.** 0.12.0 has no `/api`: a client that has cut over receives old-shape 404s without the `tansr-contract` header and, by the rules, reports "contract unavailable" instead of falling back to the old prefix automatically. When rolling the server back to 0.12.0, roll Node back to `@tansr/api-client` 0.2.0 and the old entries, and mobile clients back to their previous release.
- **A client can roll back on its own.** The 0.13.0, 0.14.0, 0.15.0 and 0.15.1 servers keep `/v2` and `/v3/*` under the default `readwrite` mode, so old clients see no protocol break; this holds until 1.0.0. After `TANSR_SERVE_LEGACY_PREFIX` is set to `readonly` or `off`, old clients' writes, or every old prefix, are rejected in that mode.
- 0.13.0 and 0.14.0 change no storage format: the session store, archive host and cache medium need no migration during a rollback.
- Reverse-proxy templates and client cut-over must move in the same direction: a client already on `/api` with a rolled-back template loses shard affinity.

## Entry migration for the Node client

`@tansr/api-client` 0.3.0 **freezes** the four old entries `./sdk2`, `./sdk2/node`, `./terminal` and `./terminal/node` (shipped with the package, no further changes, not removed) and adds `./api`. Recommended steps:

1. New code always uses `import { createApiClient } from '@tansr/api-client/api'` and calls by operation name instead of assembling paths.
2. Move call sites of the old entries to `api.call(...)` one operation at a time; GET reads in the archive / cache / terminal domains need no hand-filled `protocol` / `contract`, since the SDK injects the default revision per operation.
3. Switch error handling from family codes to unified codes plus `retryAction`, reading `error.domainCode` when needed.
4. Do not let old and new entries coexist for the same session family in one process; that is exactly the "mixing" step 4 will warn about.
