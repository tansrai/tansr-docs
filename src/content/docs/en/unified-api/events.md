---
title: Event streams and the unified event envelope
description: 'The four SSE routes of /api, explicit negotiation and echo of tansr-event-envelope: unified-v1, every field of the 7-key event envelope, where each of the five non-interchangeable cursors comes from, the terminalStatus decision table, and how to handle Last-Event-ID resumption, heartbeats and gap frames.'
zone: docs
category: unified-api
sidebar:
  order: 5
related:
  - unified-api/headers-and-errors
  - unified-api/discovery-and-closure
  - unified-api/surface
  - unified-api/clients
  - serve/v2-and-webhooks
  - sdk/sessions-and-events
sources:
  - tansr-cli:packages/server/src/api/event-envelope.ts
  - tansr-cli:packages/api-client/src/api/envelope.ts
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

There are four event streams under `/api`, and the payload of each frame is defined by the owning domain subcontract. The unified event envelope does not change those payloads; when you **explicitly ask for it**, it wraps every frame in an outer shell of the same shape, so that streams from different domains can be handled by one piece of code that asks "which domain is this, where is the cursor, is there a terminal state".

## The four event streams

| Operation | Path | Domain | What the frames contain |
|---|---|---|---|
| `session.events.observe` | `GET /api/sessions/:id/events` | `session` | Kernel events (`msg.*`, `tool.*`, `turn.*`, `session.*`) and `server.*` control frames |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | `archive` | `archive.status`, `archive.records-available`, `material.request`, `material.status`, `binding.status` |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | `terminal` | `operations-available`, `operation-cancelled`, `reconcile-required` |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | `terminal` | `output.block`, `output.status` |

The transport is the same as on the old prefixes: `text/event-stream`, a leading `retry:` frame, `: hb` comment frames as heartbeat, and resumption with `Last-Event-ID` after a disconnect. For the frame shapes and replay details of the session stream see [v2 protocol and webhooks](/en/serve/v2-and-webhooks/).

## Explicit negotiation

- Request header `tansr-event-envelope: unified-v1`, case-sensitive, exact match. The server **echoes the same header** on the stream response, and that echo is the only signal that negotiation succeeded. Without the echo treat it as not negotiated (`@tansr/api-client/api` throws `envelope_not_negotiated`); never guess.
- Without the header, the streams on `/api` are **byte-identical** to those on `/v2` and `/v3/sdk2`, so you can keep your old parser while switching the prefix first and the envelope later.
- With the header on a non-stream route (for example `GET /api/sessions/:id`): the header is ignored, not echoed, and the body is unchanged. One header configuration can therefore serve both the JSON and the SSE endpoints of a session.
- A value other than `unified-v1` (including the empty string and duplicate headers) on any `/api` route: 400 `invalid_request` (`detail.header: tansr-event-envelope`).

## The 7-key envelope

Once negotiated, the `data:` of every frame becomes an object with a fixed set of 7 keys; the `id:`, `event:` and `retry:` lines and the comment frames stay in place.

```json
{
  "contract": "unified-v1",
  "eventId": "42",
  "domain": "session",
  "type": "turn.completed",
  "cursorSet": {
    "eventCursor": "42",
    "archiveCoverage": null,
    "outputWatermark": null,
    "materialConsumed": null,
    "ackReceipt": null
  },
  "terminalStatus": "completed",
  "raw": { "type": "turn.completed", "seq": 42, "sessionId": "0a1b2c3d", "turnId": "t-3" }
}
```

| Key | Meaning |
|---|---|
| `contract` | Always `unified-v1` |
| `eventId` | The SSE `id:` of this frame; `null` for frames without `id:` (such as gap frames), never synthesised, never inherited from the previous frame |
| `domain` | The handling domain, same source as the `tansr-domain` response header |
| `type` | Event type: the SSE `event:` name, else `raw.type` / `raw.eventType`, else `null` (treated as an unknown event) |
| `cursorSet` | The five cursor slots, `null` where not applicable; see the next section |
| `terminalStatus` | `null` / `accepted` / `completed` / `aborted` / `unknown`; see below |
| `raw` | The original `data:` object as is, present on **every** frame including event types the server does not recognise; its inner structure is still governed by the domain subcontract |

The envelope emits no `payload` or `seq`: the payload is in `raw` and the stream position is expressed by `cursorSet.eventCursor`. Only frames whose `data:` is a JSON object are wrapped; frames with non-JSON text, arrays, scalars or empty `data:` pass through unchanged.

## The five cursors

| Cursor | Source | Frames that advance it |
|---|---|---|
| `eventCursor` | The SSE `id:` of this frame (`seq` on the session stream, `cursor` on the archive stream, `eventId` on the executor stream) | Each frame states its own value; nothing is inherited |
| `archiveCoverage` | `payload.acknowledgedCoverage` of `archive.status` on the archive stream (`{ fromSequence, throughSequence, headDigest }`) | Only acknowledged coverage advances it; `publishedThroughSequence` of `archive.records-available` is a publication watermark and does not go here |
| `outputWatermark` | `block.seq` of `output.block` on the tool-output stream | Used to resubscribe to output with `afterSeq` |
| `materialConsumed` | `payload.materialRequestId` of `material.status` on the archive stream when `state === 'core-consumed'` | Other material states do not advance it |
| `ackReceipt` | **Always `null`** on event streams | ACK receipts are returned through the HTTP response or `archive.operation.query`, never through the stream |

The five cursors are not interchangeable: resume the session stream only with `eventCursor` (in `Last-Event-ID`), resume the output stream only with `outputWatermark`, and judge whether the archive is acknowledged up to a point only by `archiveCoverage`. Using one to resume another is not "approximately right"; it is a contract violation.

## Deciding `terminalStatus`

`terminalStatus` is non-`null` only when the original event **explicitly expresses** a terminal state; the end of the SSE connection, a server EOF and an HTTP 202 produce no terminal state.

| Stream | Event | `terminalStatus` |
|---|---|---|
| Session | `turn.completed`, `session.ended` | `completed` |
| Session | `turn.aborted`; `turn.error` with `recoverable === false` | `aborted` |
| Session | `server.*` control frames, `msg.*`, `tool.*`, unknown types | `null` |
| Archive | `material.status`: `received` is `accepted` (acceptance only); `core-consumed` is `completed`; `rejected` is `aborted`; `pending` / `verified` is `null` | as stated |
| Archive | `binding.status`: `closed` is `completed`; `active` / `backpressured` / `closing` is `null` | as stated |
| Archive | `archive.status`, `archive.records-available`, `material.request` | `null` |
| Executor | `operation-cancelled` is `aborted`; `operations-available` and `reconcile-required` are `null` (a reconciliation request is not a terminal state) | as stated |
| Tool output | `output.status`: `complete` is `completed`; `available` / `receiving` / `truncated` / `gap` / `unavailable` is `null`; `output.block` is `null` | as stated |

`unknown` is reserved for terminal states whose outcome cannot be determined; when you receive it, treat the result as unknown and query the status instead of resending.

## Resumption, heartbeats and gaps

- Resumption: on reconnect put the `cursorSet.eventCursor` of the last consumed frame into `Last-Event-ID`. Resumed frames are wrapped too.
- Heartbeat: `: hb` comment frames pass through unchanged and are not wrapped; do not treat them as events, and do not treat a long silence without business frames as the end.
- Gap: `server.replay.gap` on the session stream has no `id:`, so after wrapping both `eventId` and `eventCursor` are `null`, `type` is `server.replay.gap`, and `raw` holds `requestedAfterSeq`, `oldestRetainedSeq` and `droppedEvents`. On receiving it rebuild the view through L2; see [v2 protocol and webhooks](/en/serve/v2-and-webhooks/).
- Frame size: `@tansr/api-client/api` caps a single frame at 2 MiB by default (`maxEventFrameBytes`) and throws a local `payload_too_large` error instead of truncating silently.

## Consuming with `@tansr/api-client/api`

```ts
import { createApiClient, isTerminalEvent } from '@tansr/api-client/api';

const api = createApiClient({ baseUrl, token: () => loadEndUserToken(), eventEnvelope: 'unified-v1' });

let lastEventId: string | null = null; // resume cursor = eventCursor of the last consumed frame
const stream = api.events('session.events.observe', {
  params: { id: sessionId },
  ...(lastEventId === null ? {} : { lastEventId }),
});
for await (const frame of stream) {
  const { envelope } = frame;
  if (typeof envelope.cursorSet.eventCursor === 'string') lastEventId = envelope.cursorSet.eventCursor;
  if (envelope.type === 'msg.text.delta') render(String(envelope.raw['text'] ?? ''));
  if (isTerminalEvent(envelope)) break;
}
```

`events()` yields `{ id, event, envelope }` only after the server has echoed the negotiation header. If the stream ends naturally without a terminal frame, the loop exits but `isTerminalEvent` was never true: that is the code form of "EOF is not completion", and your host should report the result as unknown rather than show success.
