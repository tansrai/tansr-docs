---
title: Surface, domains and the operation catalogue
description: The 9 domains under /api, the 11 families and 81 operations of manifest revision 7 (39 read / 38 write / 4 stream), operation naming and path templates, revision identifiers in the query string, the session-family request header, and which paths are not part of /api.
zone: docs
category: unified-api
sidebar:
  order: 2
related:
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
sources:
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/src/api/route-table.ts
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
lastVerified: '2026-10-13'
---

The whole callable surface of `/api` is defined by one machine-readable capability manifest: every operation has a stable name, an HTTP method, a path template, the query keys it allows and a read / write / stream classification. The path modules of the official clients are generated from this manifest; this page spreads out the facts in it that concern "how to call".

## Assembly conditions and prefixes

- `/api` is assembled together with the `/v2` session surface: as a library, `startServer({ v2: … })`; from the CLI, `tansr serve --v2` (or `TANSR_SERVE_V2=1`). A SDK1-only `tansr serve` without `--v2` has no `/api`.
- `/api` is the only public prefix. `/v2`, `/v3/sdk2`, `/v3/terminal`, `/v3/terminal-observation` and `/v3/terminal-profile` remain inside the process as internal adapter entries only; 1.0.0 removes their external reachability. See [Migration and retirement timetable](/en/unified-api/migration/).
- `/healthz`, `/readyz` and `/metrics` are not under `/api` and not governed by this contract; for the deployment surface see [Deployment and authentication](/en/serve/deploy-and-auth/).
- Path parameters are percent-decoded on the server before matching; a segment that cannot be decoded is treated as a missing resource (404 `not_found`) and never leaks internal paths.

## The 9 domains

| Domain (`tansr-domain`) | Operations | Covers | Families |
|---|---|---|---|
| `discovery` | 3 | Manifest, deployment-wide capabilities, per-session capability closure | `unified-v1` |
| `session` | 26 | Session lifecycle, messages, event stream, tool / permission / question answers, snapshots, audio, input, approval credentials | `agent-session-v1` |
| `execution` | 9 | Execution initialisation and boundaries, execution bindings, executor registration / heartbeat / claim / receipt | `sdk2-ext-v1` |
| `archive` | 16 | Archive bindings, archive status and records, ACK commit and rebase, material responses and uploads | `sdk2-ext-v1`, `sdk2-archive-recovery-v1` |
| `archive-sync` | 1 | Archive synchronisation | `archive-sync-v1` |
| `cache` | 10 | Open / renew / rebind / rotate / close of cache bindings, diagnostics | `sdk2-cache-v1`, `sdk2-cache-core-v1` |
| `terminal` | 12 | Terminal bindings, executor event stream, output batches and observation, session configuration and memory | `terminal-services-v1` |
| `terminal-observation` | 2 | Resource and output correlation queries | `terminal-observation-v1` |
| `terminal-profile` | 2 | Profile catalogue and usage | `terminal-profile-v1` |

A domain is a concept of the `/api` layer, used for the `tansr-domain` response header, error-matrix grouping and the capability closure; a family is the versioning unit of a domain subcontract. Manifest revision 7 has 11 families (the 10 above plus `terminal-shell-sandbox-v1`, which has no `/api` entry yet). Each family's `status` field states its maturity: `agent-session-v1` is `frozen`, `sdk2-ext-v1` is `final`, `unified-v1` and `terminal-services-v1` are `candidate`, `sdk2-cache-v1` is `drafted`, the rest are `additive`.

## Operation naming and path templates

Operation names read `domain.resource.verb`: `session.message.send`, `archive.binding.create`, `cache.binding.renew`, `terminal.output.observe`. Path templates use the placeholders `:id`, `:targetId`, `:ticketId` and `:uploadId`, and clients fill them strictly: missing or extra parameters, empty segments and unencoded `/` must be rejected locally. A few operations have aliases (for example `terminal.configuration.read` accepts both `/api/terminal/sessions/:id/configuration` and `/api/sessions/:id/configuration`); aliases are compatibility entries only, and generated clients always use the primary path.

Representative operations per domain (the full 81 are in the manifest):

| Operation | Method and path | Kind |
|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | read |
| `discovery.capabilities` | `GET /api/capabilities` | read |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | read |
| `session.create` | `POST /api/sessions` | write |
| `session.get` | `GET /api/sessions/:id` | read |
| `session.message.send` | `POST /api/sessions/:id/messages` | write |
| `session.events.observe` | `GET /api/sessions/:id/events` | stream |
| `session.interrupt` | `POST /api/sessions/:id/interrupt` | write |
| `session.tool.result` | `POST /api/sessions/:id/tool-results/:targetId` | write |
| `session.permission.decide` | `POST /api/sessions/:id/permission/:ticketId` | write |
| `session.question.answer` | `POST /api/sessions/:id/questions/:ticketId` | write |
| `session.checkpoint.create` | `POST /api/sessions/:id/checkpoints` | write |
| `session.close` | `DELETE /api/sessions/:id` | write |
| `approval.credential.submit` | `POST /api/approvals/:id/credential` | write |
| `execution.binding.create` | `POST /api/sessions/:id/execution-bindings` | write |
| `executor.register` | `POST /api/executors/connections` | write |
| `executor.operations.poll` | `GET /api/executors/:id/operations` | read |
| `archive.binding.create` | `POST /api/archive/bindings` | write |
| `archive.binding.get` | `GET /api/archive/bindings/:id` | read |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | stream |
| `archive.records.read` | `GET /api/archive/bindings/:id/archive/records` | read |
| `archive.ack.commit` | `POST /api/archive/bindings/:id/archive/acks` | write |
| `archive.ack.rebase` | `POST /api/archive/bindings/:id/archive/ack-rebases` | write |
| `material.upload.chunk` | `POST /api/archive/bindings/:id/materials/:targetId/uploads/:uploadId/chunks` | write |
| `archive.sync` | `POST /api/archive/sync/:id` | write |
| `cache.binding.open` | `POST /api/cache/bindings` | write |
| `cache.binding.renew` | `POST /api/cache/bindings/:id/renew` | write |
| `cache.diagnostics` | `GET /api/cache/bindings/:id/diagnostics` | read |
| `terminal.binding.create` | `POST /api/terminal/bindings` | write |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | stream |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | stream |
| `terminal.configuration.commit` | `POST /api/terminal/sessions/:id/configuration` | write |
| `terminal.memory.command` | `POST /api/terminal/sessions/:id/memory/commands` | write |
| `terminal.observation.resources` | `GET /api/terminal/observation/sessions/:id/resources` | read |
| `terminal.profile.usage` | `GET /api/terminal/profile/sessions/:id/usage` | read |

The read / write / stream distinction is more than the HTTP method: only **write** operations accept `Idempotency-Key`, only the 9 write operations with `expectedRevision` registered in the manifest accept `If-Match`, and only the 4 **stream** operations take part in event-envelope negotiation. See [Unified request headers, response headers and the error envelope](/en/unified-api/headers-and-errors/) and [Event streams and the unified event envelope](/en/unified-api/events/).

## Revision identifiers in the query string

The revision of a domain subcontract does not go in the path but in the query string, and only on **GET operations (reads and streams)**:

| Domain | Query key | Value |
|---|---|---|
| GET reads and streams of `execution` and `archive`, plus `session.capabilities` (`GET /api/capabilities/sessions`) | `protocol` | `sdk2-ext-v1` |
| GET reads of `cache` | `protocol` | `sdk2-cache-v1`; `cache.core.diagnostics` uses `sdk2-cache-core-v1` |
| GET reads and streams of `terminal`, `terminal-observation`, `terminal-profile` | `contract`, `sessionContract` | `terminal-services-v1` / `terminal-observation-v1` / `terminal-profile-v1`; `sessionContract` names the family the session belongs to |

Three rules:

- Write operations accept no query keys (the only exception is the optional `label` of `session.checkpoint.import`); the three discovery endpoints, `GET /api/capabilities/archive` and `GET /api/capabilities/cache` accept none either; any extra key is 400 `invalid_request`.
- A `protocol` whose value is not the revision registered for the operation (for example `protocol=sdk2-ext-v0`) is 400 `protocol_mismatch`.
- The query keys allowed per operation form a closed allow-list (for example `archive.records.read` allows `protocol`, `historyEpoch`, `deletionGeneration`, `projectionRevision`, `limit`, `maxBytes`, `afterSequence`); keys outside the list are also 400.

`@tansr/api-client/api` injects the default `protocol` / `contract` value according to the operation's family (an explicit value always wins), so you only pass business query keys.

## Session families

A session belongs to one of two families: `sdk1` (the kernel runs inside the session service process) and `sdk2-offload-v1` (execution is offloaded to a bound terminal executor). The old prefixes told them apart by path; under `/api` the path is the same and the request header `tansr-session-family: sdk1 | sdk2-offload-v1` declares the family. Without the header the server uses the deployment's preferred family; the preferred and available families are read from `domains.session.family.preferred` / `available` in the `GET /api/capabilities` response. A value outside the vocabulary is 400 `invalid_request`; a known family that this deployment has not assembled is `capability_unavailable` (`detail.reason: not_installed`).

## What is not in `/api`

- The six single-tenant `/v1` routes (`/v1/status`, the `/v1/sessions` family and so on) are not in the operation catalogue and have no counterpart under `/api`; `approval.credential.submit` is the only operation that moved from `/v1` into `/api`. On deployments that assemble `/api`, `/v1` is off by default; see [Migration and retirement timetable](/en/unified-api/migration/).
- The platform-side endpoints (`/t1/*`, `/v1/app-tokens`, `/v1/my-usage` and so on) are referenced read-only through the manifest's `platformApi` field; their host is the platform, not your session service.
- The full Electron SDK and the IPC mode do not go through `/api`.
