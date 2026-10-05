---
title: Unified API (/api) overview
description: Since @tansr/serve 0.13.0, /api is the only public HTTP surface of the session service (contract unified-v1). This page lays out the three contract layers, when each version landed, the shortest runnable example and the seven developer rules, then points to discovery and closure, unified headers and the error envelope, the event envelope, migration and the per-language clients.
zone: docs
category: unified-api
sidebar:
  order: 1
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - unified-api/clients
  - serve/v2-and-webhooks
  - getting-started/serve
  - releases/serve
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api` is the **only** public HTTP surface of `@tansr/serve`: sessions, execution, archive, cache, terminal and every other domain live under this one prefix and share the same request headers, response headers, error envelope and event envelope. The contract is named `unified-v1` and has been generally available since `@tansr/serve` 0.13.0 (released 2026-10-02). The older per-domain prefixes `/v2`, `/v3/sdk2` and `/v3/terminal*` are still inside the process but only as internal adapter entries; `/v1` is off by default on deployments that assemble `/api`.

If this is your first contact with the session service, start with [Session service in 5 minutes](/en/getting-started/serve/) to get a server running, then come back here. If you already use the `/v2` protocol, go straight to [Migration and retirement timetable](/en/unified-api/migration/).

## Three contract layers

| Layer | Contents | Constrained by |
|---|---|---|
| Common Envelope | Request headers, response headers, the unified error envelope, the unified event envelope, idempotency and precondition semantics | The pages of this chapter; the wire shape is fixed by `doc/rfc/unified-v1.schema.json` and 165 golden vectors |
| Capability Manifest | Path templates, methods, query keys, read / write / stream classification, capability entries and limits | `packages/server/contract/api-manifest.json` (currently revision 7) |
| Domain Subcontracts | Request / response bodies, event payloads and in-domain error codes per domain | 11 families such as `agent-session-v1`, `sdk2-ext-v1`, `terminal-services-v1` |

The division of labour is fixed: the common envelope decides **how to call**, the capability manifest decides **what can be called**, and the domain subcontracts decide **what is in the body**. `/api` does not rewrite any domain subcontract's success body: the same operation called through `/api` and through the old prefix returns byte-identical 2xx bodies; only headers, the error shape and (after explicit negotiation) the outer shape of event frames change.

## What one call looks like

```http
POST /api/sessions/0a1b2c3d/messages HTTP/1.1
Authorization: Bearer <short-lived token>
Content-Type: application/json
tansr-closure-id: 9f3c…e1

{"prompt":"hi"}
```

```http
HTTP/1.1 202 Accepted
tansr-contract: unified-v1
tansr-manifest-revision: 7
tansr-domain: session
tansr-schema-hash: sha256:6e1876ed…
content-type: application/json

{"sessionId":"0a1b2c3d","accepted":true}
```

Every `/api` response (including 2xx and the opening of an SSE stream) carries the four headers `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`. If any of them is missing, a client must treat the contract as unavailable instead of parsing further. See [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/).

## When each version landed

| Release | Date | Changes relevant to `/api` |
|---|---|---|
| `@tansr/serve` 0.13.0 | 2026-10-02 | `/api` generally available; unified error envelope (19 unified codes, 6 `retryAction` values); explicitly negotiated 7-key event envelope; discovery endpoints and the per-session capability closure; `/v1` off by default on deployments that assemble `/api` (library option `disableV1`; `tansr serve --legacy-v1` or `TANSR_SERVE_LEGACY_V1=1` keeps it during the transition) |
| `@tansr/protocol` 0.2.0 | 2026-10-02 | First public release, `@tansr/protocol/canonical` entry (canonical encoding and decoding of strict JSON plus domain digests) |
| `@tansr/serve` 0.14.0 | 2026-10-04 | Manifest revision 7: 81 operations, new `approval.credential.submit` (`POST /api/approvals/:id/credential`), permission and question answers switch to the `:ticketId` placeholder; the three request headers `Idempotency-Key`, `If-Match` (with `ETag`) and `deadline` are wired; `--legacy-v1` / `TANSR_SERVE_LEGACY_V1` deprecated with a startup warning |
| `@tansr/cli` 0.10.1 | 2026-10-04 | `tansr serve --legacy-v1` deprecated (still effective) |
| `@tansr/api-client` 0.3.0 | 2026-10-04 | Stable release: `@tansr/api-client/api` entry (`createApiClient`), operation catalogue aligned to revision 7, the three request headers exposed as call options; the old entries `./sdk2`, `./sdk2/node`, `./terminal` and `./terminal/node` are frozen, not removed |

Every page in this chapter states facts as of the **released** versions above; everything described is available on `@tansr/serve` 0.14.0, with no "candidate" items.

## Shortest runnable example (Node)

```ts
import { createApiClient, ApiError } from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'http://127.0.0.1:8787',
  token: () => loadEndUserToken(), // your own loader for the short-lived bearer token
  eventEnvelope: 'unified-v1',
});

const created = await api.call('session.create', { body: {} });
const sessionId = (created.body as { sessionId: string }).sessionId;

const { closureId } = await api.sessionCapabilities(sessionId);
await api.call('session.message.send', { params: { id: sessionId }, body: { prompt: 'hi' }, closureId });

for await (const frame of api.events('session.events.observe', { params: { id: sessionId } })) {
  if (frame.envelope.type === 'msg.text.delta') process.stdout.write(String(frame.envelope.raw['text'] ?? ''));
  if (frame.envelope.terminalStatus !== null) break;
}
```

There is not a single hand-written `/api/...` path in this code: the operation names `session.create`, `session.message.send` and `session.events.observe` come from the operation catalogue generated into the package, and the SDK instantiates paths locally from the manifest templates. Errors are thrown as `ApiError` (the unified envelope); `error.code` is one of the 19 unified codes and `error.retryAction` tells you what to do next. For the state of the other languages see [Clients by language](/en/unified-api/clients/).

## Seven developer rules

These seven rules come from the contract text and every official client implements them; check your own client against them one by one.

1. **No silent downgrade.** A response without the `tansr-contract: unified-v1` header means the contract is unavailable: report it instead of switching to `/v2` or `/v3`. If you requested the event envelope and the server did not echo the header, treat it as not negotiated.
2. **No URLs taken from responses.** The discovery endpoints return no navigable fields; paths are instantiated locally from manifest templates plus path parameters only.
3. **No replay of unknown side effects.** Replay once only when the server explicitly states `retryAction: same-request` and you keep the same `Idempotency-Key`; `result_unknown` may only be followed by a status query.
4. **Identity never goes in the body.** Authentication happens only in the `Authorization` header; an identity field in the body that disagrees with the authenticated principal is rejected.
5. **Neither the end of an SSE stream nor a 202 means completion.** The terminal state of a turn or operation is read only from `terminalStatus` in the event envelope.
6. **The five cursors are not interchangeable.** `eventCursor`, `archiveCoverage`, `outputWatermark`, `materialConsumed` and `ackReceipt` each advance on their own; never use one to resume another.
7. **No hand-written legacy prefixes.** Never put `/v2`, `/v3/sdk2` or `/v3/terminal` literals in source; access one session family through one prefix only.

## Chapter map

| Page | Question it answers |
|---|---|
| [Surface, domains and the operation catalogue](/en/unified-api/surface/) | Which domains and operations exist under `/api`, how paths are assembled, how revision identifiers go in the query string |
| [Discovery and the capability closure](/en/unified-api/discovery-and-closure/) | What to ask at startup, what `closureId` is, what operations outside the closure get back |
| [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/) | Which headers a request may carry, which headers every response must carry, how to read the 19 unified codes and 6 `retryAction` values |
| [Event streams and the unified event envelope](/en/unified-api/events/) | The four SSE routes, explicit negotiation, the 7-key envelope, `terminalStatus` and resuming |
| [Migration and retirement timetable](/en/unified-api/migration/) | How to move from `/v1`, `/v2` and `/v3` to `/api`, when the old prefixes retire, how to roll back in pairs |
| [Clients by language](/en/unified-api/clients/) | Where Node / .NET / Android / iOS / HarmonyOS / Go each stand on unified-v1 |
