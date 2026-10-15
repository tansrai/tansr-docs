---
title: Security and privacy
description: 'What you can do as a user — where each tansr form sends traffic, where credentials belong, where data is kept and for how long, and how to rotate and revoke PATs, app keys, end-user tokens and session-service tokens.'
zone: docs
category: security
related:
  - getting-started
  - cli/settings-and-doctor
  - serve/deploy-and-auth
  - serve/retention-and-governance
  - serve/v2-and-webhooks
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - support/account
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

This page covers only **what you can do**: know where traffic goes, put credentials in the right place, know where data is kept, and rotate. tansr's internal defenses (permission engine, protected paths, hard security red lines, audit chain) are laid out in the guides for each form; here they are cited only where they touch your own actions. Version baseline: `tansr` CLI 0.10.3, `@tansr/sdk` 0.19.0, `@tansr/serve` 0.15.1 (all released 2026-10-10).

## Egress: where traffic goes and how to narrow it

### What the CLI connects to

| Destination | When | Can it be turned off |
|---|---|---|
| The tansr platform gateway `api.tansr.com` | After signing in to platform mode: model calls, bundle fetch, heartbeat, usage reporting, balance | Set `TANSR_ESCAPE_LOCAL=1` for fully local mode and it is disabled as a whole |
| Update check: the npm install queries the npm registry `registry.npmjs.org`; the single-file executable (SEA) queries the signed pointer on the official distribution point `bash.tansr.com` | Only when you explicitly run `/update` or `tansr update`; never checked automatically at startup | `TANSR_UPDATE_CHANNEL=none` or `TANSR_NO_UPDATE_CHECK=1`; companies can point to a self-hosted manifest with `TANSR_UPDATE_MANIFEST_URL` (when present, both forms connect only to it) |
| The model providers you configure | `providers.*.baseUrl` in fully local mode | Your decision |
| The MCP servers / your own search and media endpoints you configure | Tool calls within a session | Your decision; project-level MCP servers must be trusted explicitly |
| Any URL the model reaches through tools (WebFetch / Http) | Within a session | Governed by permission rules; a `deny` rule can disable the whole tool |

The recommended baseline for unattended deployments (`tansr serve` / headless with permissions set to `auto`) is an **egress allowlist**: allow only necessary destinations such as the model API, and deny by default beyond DNS and already-established connections; combine it with a container or a least-privilege dedicated user, and limit filesystem writes to the working directory. Reference templates are in the repository under `deploy/serve/`.

Two user-visible defenses already in place: a single command that both references a secret file (`.env`, keys, `.aws/credentials`) and performs an outbound action (`curl` / `scp` / `git push` …) is always refused, and no mode or rule can override that; and once a session has read a secret file, every later outbound action turns into a prompt (session taint). **Since tansr CLI 0.6.0**: all egress (WebFetch / Http / hooks / audio download) goes through one unified exit that resolves DNS first and then rejects private, loopback and link-local addresses, so fetches aimed at internal or metadata addresses are refused with a reason; and the credential environment variables the Http tool and hooks may reference are narrowed to the `http.allowedAuthEnvVars` allowlist — nothing outside it is sent.

### What the SDK and the session service connect to

- With the token source, `@tansr/sdk` connects only to the `baseUrl` you pass (the platform gateway) and the MCP servers you configure explicitly; the SDK never scans the user's home directory and never has a built-in search endpoint.
- The upstream chain of `@tansr/serve` is `appid/appkey → POST /v1/app-tokens → GET /t1/config + POST /t1/heartbeat → POST /t1/exchange`, all against `apiBaseUrl`; plus the end-of-turn webhook URL you configure (outbound requests never carry any authentication header — authenticity is proven by the signature) and the optional cold-tier object storage.
- Once a mobile app enables web fetch (WebFetch) or HTTP requests (Http) in the console (`@tansr/serve` 0.12.0 and later, off by default), those two tools access the target URL directly from the host running the session service and follow the same egress rules: hosted Http cannot reference credentials from host environment variables, and the model cannot lift the host's private-network limits; if you use an egress proxy, restrict private-network targets on the proxy as well. See [Public-network tools for mobile apps](/en/sdk/platform-bundle/#移动应用的公网工具).
- The mobile SDKs and `@tansr/api-client` connect only to your session service's `baseUrl`, never directly to the platform, and never issue those tool requests from the device.

## The unified call surface `/api`: headers, closure and legacy prefixes

Since `@tansr/serve` 0.13.0, a deployment with `options.v2` present mounts the unified call surface `/api` at the head of the chain on the same port (manifest revision 7 in 0.14.0). Only a few points are security-relevant:

- **Identity comes from `Authorization` only.** `/api` and `/v2` share the same `authenticate` hook that decides `endUserId`; the four response headers `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` and the envelope's `traceId` / `requestId` never carry endUserId, tokens or message content. No identity field in a request body is treated as identity. The CLI form `tansr serve --v2` partitions by the same Bearer plus the `x-tansr-end-user` header; that header may only be written by your gateway after your own login, never filled in by the client.
- **Request headers are explicit negotiation, not authentication factors.** `tansr-session-family`, `tansr-closure-id`, `tansr-event-envelope`, `Idempotency-Key` / `If-Match` / `deadline` (the last three since 0.14.0) on a request they do not apply to yield `400 invalid_request` rather than being silently ignored; without any of them, behaviour is byte-for-byte unchanged.
- **Capability closure**: `GET /api/sessions/:id/capabilities` federates the existing capability sources of each domain read-only into one three-state operation table (`enabled` / `disabled` / `unavailable`) plus `tansr-closure-id`; it **introduces no new authorization engine** — operations inside the closure are still decided by the domain handler against app capability flags, user authorization, session state and approvals. A write may carry the last `tansr-closure-id` as a precondition: a changed closure yields `412 precondition_failed` (`rediscover`; rediscover first, never hard-replay with the old value); calling an operation that is `disabled` yields `403 capability_unavailable`. Unknown sessions, other users' sessions and sessions that exist only in the archive host all answer `404 not_found`, without leaking existence.
- **`/v1` is off by default**: with the facade present, `/v1/sessions*`, `/v1/status` and `/v1/approvals/:id/credential` answer 404 by default (always off when an SDK2 explicit host is present). The escape hatch `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` is deprecated since 0.14.0 / CLI 0.10.1 (removed in 1.0.0; enabling it emits the `warn` event `server.deprecated_option`); approval credential submission moves to `POST /api/approvals/:id/credential`. Health checks use `/healthz` `/readyz`; stop probing `/v1/status` with the `/v1` Bearer.
- **The retirement window for the legacy `/v2` and `/v3/*` prefixes is configurable** (`@tansr/serve` 0.15.0 / CLI 0.10.2 and later, effective when the facade is present): `TANSR_SERVE_LEGACY_PREFIX=readwrite|readonly|off` (factory option `legacyPrefixes`) — `readwrite` is the default (still so in 0.15.1) and accepts everything on the legacy prefixes; under `readonly`, operations the manifest registers as writes answer `410 gone` on the legacy prefixes (`message` points to the corresponding `/api` operation) while reads and streams still work; under `off` every legacy-prefix request answers `404 not_found`. Once `TANSR_SERVE_LEGACY_SUNSET` (`legacyPrefixSunset`) names the planned retirement time, legacy-prefix responses carry a `Sunset` header in addition to the existing `Deprecation` / `Link` headers. Mixing the legacy prefixes and `/api` within one session logs the `warn` event `api.legacy_prefix_mixed`; a rejected legacy-prefix request logs `api.legacy_prefix_rejected` — both staying at zero is the evidence that the window can be narrowed. When the default changes is covered in [Migration and retirement timeline](/en/unified-api/migration/).
- In the unified error envelope `message` has no literal guarantee and `detail.path` is rewritten to the requested `/api` path; the internal `/v2` / `/v3` prefixes and host paths do not leak. Headers and the code table are in [Unified API headers and error envelope](/en/unified-api/headers-and-errors/).

## Isolation of system tools and terminal tools (SDK 2.0 remote profile)

SDK 2.0's "unified core, thin terminals" splits tools by **where they execute**, and neither side can execute for the other:

- **System tools run on the session-service host**: WebFetch / Http / WebSearch / media tools and the MCP adapter run inside the serve process under the host's egress rules (private-network limits, credential allowlist, the same on the proxy); the MCP adapter reuses the host's existing connections and cannot start processes from model parameters, and the model cannot lift egress limits.
- **Terminal tools run only on the bound device**: file read / list / write / edit and bound-workspace memory (controlled primitives such as `fs.inspect` / `fs.read` / `fs.list`) exist only after the application explicitly configures `execution.version = 'bound-device-v1'` through the management API and grants them in `boundDevice.tools`; **legacy application types and legacy `tools` flags never imply terminal authorization**. Effective tools = application ceiling ∩ user policy ∩ request narrowing ∩ device primitives; the original Read / List permissions and user approvals still apply, and a configured directory cannot authorize on the user's behalf.
- **Memory and attachments never fall back to the host**: the trusted host's `execution.memoryFor(scope)` selects only relative directories inside the bound workspace and never reads serve's home / env / cwd; missing capability, denial, disconnection or an oversized source only degrades the current turn and never falls back to reading server files. The URL of an external attachment source `trustedAttachmentSourceFor` is only a lookup key: SDK / serve never fetch automatically and never let the model or the client turn an address into a file or network permission.
- **Durable execution records before effects**: the executor persistently claims an operation before executing and saves the result before returning; reconnecting after a disconnect never redoes an operation whose outcome is unknown (SDK side: `GateDecision.executionTarget` / `ToolContext.executionTarget`, since `@tansr/sdk` 0.18.0; always absent for in-process SDK).
- **A trusted host module is trusted like the deployer's own code**: `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>` (CLI 0.10.0 and later) verifies only the digest of the entry file's raw bytes; it does not sign the dependency graph and is not a code sandbox. Path and digest always come from your deployment pipeline, never from the model or over HTTP.

## Credentials: where they go and where they never go

| Credential | Represents | Right place | Never |
|---|---|---|---|
| Personal access token (PAT) | You | Generated in the console, then fed only to `tansr init` (masked input) or the `TANSR_PAT` environment variable in CI | Shell history (`--pat` on the command line leaves a trace), plaintext in scripts, the repository |
| This machine's derived app key | This device of yours | Written by `tansr init` to the OS keychain (macOS Keychain / Linux secret-service / Windows DPAPI); falls back to a 0600 file with a clear warning when unavailable | You never touch it; the credential-storage section of `tansr doctor` shows where it landed |
| Model-provider API key (fully local mode) | Your provider account | An environment variable; the config file holds **only the variable name** in `auth.env` | `settings.json`, error messages, `/config` output (they never carry the value) |
| App key appid / appkey | Your app | Environment variables of your backend process (a Node process or `@tansr/serve`) | Client devices, logs, error responses, the repository (`.env` goes in `.gitignore`) |
| Short-lived `app_user` token | One of your end users | Electron main-process memory; inside the `@tansr/serve` process | The renderer process, persistent storage; mobile **never** touches it |
| Your own login token (mobile) | Your user | Provided per request through `authProvider`; the SDK does not persist it | SharedPreferences / DataStore / UserDefaults / logs |
| Session-service `/v1` Bearer (`--token` / `TANSR_SERVE_TOKEN`) | The operator | An environment variable | Unrelated to the `/v2` / `/api` surfaces; do not reuse it for end users; `/v1` is off by default in `--v2` deployments |
| The `--host-module-sha256` digest | Your deployment pipeline | Generated next to the `.cjs` build artifact and shipped together with it | Never computed at runtime, never supplied by the model or over HTTP |
| Webhook `secret` | Your push backend | Environment variables on the session service and on the receiver, separately | Logs; the engine never prints it |

Three red lines worth repeating: the appkey never leaves your backend; the `app_user` token never leaves the session service; the session id is not an authentication factor.

The CLI adds one more layer of redaction discipline as a safety net: keys in reports, logs and exported transcripts are always redacted to the form `sk-...` plus the last 4 characters; the output of `tansr sessions export` can go straight into a ticket.

<a id="项目层-hooks-的信任门缺省零执行"></a>

## The trust gate for project-level hooks: zero execution by default

**Available since tansr CLI 0.7.0.** A repository's `.tansr/settings.json` / `.tansr/settings.local.json` may declare `command` and `http` hooks — code that could run just because you cloned a repository — so the CLI places project-level hooks behind the **workspace trust gate** and does not run them by default:

- **The trust record lives in the user layer**, `~/.tansr/trust.json`; there is no separate grant file. Workspace recorded as trusted → project-level hooks run as usual; no record, or recorded as untrusted → project-level `command` / `http` hooks are **never executed** (zero `hook.*` events) and stderr gets a one-line notice; user-level and managed-level hooks are unaffected.
- **TUI**: the first time you open a directory without a record, user-level / managed-level `SessionStart` hooks still fire before the first screen, while the project-level `SessionStart` is deferred until you choose "Trust" in the trust dialog and then fires exactly once (Decline / Esc: not fired, and the session enters the tightened mode).
- **The four unattended entry points** (headless `-p`, `tansr serve`, `tansr acp`, `tansr mcp serve`) have no interactive surface and honour only the record the TUI persisted: a repository you trusted in the TUI gets its project hooks automatically when CI or an editor connects. If there is no record and you really need them for this run, pass `--trust-project-hooks` (same flag name on all four entry points) or set `TANSR_TRUST_PROJECT_HOOKS=1` (other values are ignored). It applies **only when there is no record**, only to this run, is **never written** to `trust.json`, and **cannot override** a recorded distrust.
- **The criterion is the configuration anchor chain, not the current directory**: the anchor is the nearest ancestor of the start directory that contains `.tansr`; if the anchor or any of its ancestors is recorded as untrusted, hooks stay at zero execution even when a subdirectory is recorded as trusted, and neither the flag nor the variable can override that. Trust keys are normalised by real path (realpath): a junction, symlink, `subst` drive, 8.3 short name or mapped drive pointing at the same workspace is the same record; if the real path cannot be resolved the literal path is used and is **not treated as trusted** — a trust recorded historically under an alias path has to be granted once more. Neither TUI `/cd` nor a mid-session cwd switch over `/v2` re-adjudicates.
- In project-level `http` hooks the whole-value `${VAR}` form in request headers is **not expanded and is sent literally** (repository configuration never reads your environment; the request is still sent, not rejected); user-level / managed-level hooks expand as before. Hooks shipped by project-level plugins have already passed per-plugin trust and are not gated again.
- **Project-level MCP servers and plugins follow the same rule** (since 0.7.0): the four unattended entry points also honour only the trust records the TUI has persisted for MCP servers and plugins declared by the repository, in this order — **persisted deny (matched by definition fingerprint) > persisted allow > `TANSR_TRUST_PROJECT_MCP=1` / `TANSR_TRUST_PROJECT_PLUGINS=1`, which only apply when there is no record or the fingerprint no longer matches > pending**. A changed MCP definition counts as a mismatch, and legacy literal-path records are honoured only for deny, never borrowed for allow. Deployments that relied solely on the environment variable to bypass a persisted deny are refused from 0.7.0 on — re-grant trust in the TUI, or delete that deny record. `tansr acp` shares the same plugin discovery / trust / signature verification with the other entry points; untrusted plugins are never loaded and the notice goes to stderr (stdout carries protocol frames only).
- **SDK embedders** (since `@tansr/sdk` 0.14.0): `createSession({ trustProjectHooks: true })` means the host grants trust on the user's behalf; the default `false` means project-level hooks are never executed and emit zero `hook.*` events. The SDK never reads the CLI's `trust.json` and never persists trust — the embedder owns that responsibility. When trust is not granted but the project does declare hooks, `onWarning` receives one `project_hooks_untrusted` (`detail` carries `cwd` and the layers found, `projectShared` / `projectLocal`); without `onWarning` it falls back to a recoverable `turn.error { scope: 'sdk.notice' }`. Single-turn `query()` has no trust bit, so project-level hooks are never enabled there.

## Data retention: where, how long, who deletes

### Locally (the CLI)

- Sessions, config cache, usage queue and project memory live under `<storageRoot>/` (default `~/.tansr`, redirectable with `TANSR_STORAGE_ROOT` or the overall root `TANSR_USER_HOME`); after signing in to the platform, new data is isolated per account under `<storageRoot>/identities/<account fingerprint>/`.
- One directory per session: `journal.jsonl` (hash chain), `meta.json`, `attachments/`, oversize artifacts in `spill/`; image bytes are cached under `<storageRoot>/image-cache/<sessionId>/`; long Shell output goes to `<working directory>/.tansr/shell-output/`; TTS audio goes to `<working directory>/.tansr/artifacts/<sessionId>/`.
- **Nothing is deleted automatically.** Clean up with `tansr sessions prune` (a dry run listing only by default; `--apply` deletes; the retention policy is the union of `--keep-days`, default 90, and `--keep-last`, default 500; today's sessions and sessions in use are never deleted; corrupted directories need `--include-broken`). `tansr logout` does not delete identity-store data.
- The `metrics.json` written at the end of a session holds only counts and ratios — no paths, commands or rule text. **Outbound telemetry is off by default**: the current version has no outbound reporting channel at all.
- The platform **does not store terminal session content; it only meters**; the platform session registry has a 30-day inactivity lease, after which sessions are archived.

### The session service (`@tansr/serve`)

- Session history lands in the `store` directory you configure, `<dir>/agent-sessions/<endUserKey>/sessions/<sessionId>/`; `endUserKey` is a hash of the end-user id, not an identity. A cold tier can be mounted on your object storage; segments are plaintext JSONL (compressed) — **encryption, key management, residency and access control are yours** (the `policy.transform` hook).
- Short in-memory windows: terminal records are kept for 30 min, idle sessions are written to disk after 24 h; `DELETE /v2/sessions/:id` (same as `/api/sessions/:id`) closes, it does not delete. **With no retention configured the store keeps everything by default**; the storage retention sweep (deleting dormant sessions by age in days and per-user count) is **available since @tansr/serve 0.8.0** (factory option `sessions.retention` or two environment variables — see [Retention and governance](/en/serve/retention-and-governance/#存储保留期扫描)). Real deletion is `store.delete`.
- Since 0.14.0 the `Idempotency-Key` receipt cache is in-process memory (256 per user / 4,096 global / 10 minutes), isolated by `endUserId` and gone with the process; an explicitly assembled SDK2 archive host stores archives under a "single authorized source" strategy — it is not a backup and does not synchronize elsewhere, and entries are deleted only by an explicit host call.
- Structured log fields never contain tokens or message content (default level `warn` since 0.13.0; every level is redacted the same way, body keys are always `[redacted]`); metric labels never contain sessionId / endUserId.
- Permission request frames sent down to clients never carry full tool arguments, only a target summary; webhook payloads never carry message content or credentials.

### On the device

The Android / iOS / HarmonyOS SDKs cache no credentials; view state is in memory; whether to keep the sessionId locally (for resume after a cold start) is your decision — store only the id, not content, not credentials.

## Rotation and revocation: how each credential is replaced

| Credential | How to rotate | Blast radius |
|---|---|---|
| PAT | Create a new one in the console, sign in again locally with `tansr init --fresh`, then delete the old PAT in the console | A PAT is never revoked by `tansr logout` — other devices may still be using the same one |
| This machine's derived app key | Rerun `tansr init` to rotate and extend (near expiry the session shows a "key about to expire" notice); `tansr logout` clears the local copy and does its best to deactivate it remotely; for a lost device, deactivate its device key manually in the console | Every device holds its own key (named by hostname + device id); they never replace each other |
| App key appkey | Rotate in the console (`POST /v1/apps/:id/rotate`); update the backend's environment variable and restart the process | Cuts everything off as a last resort: the old appkey is invalidated immediately |
| One end user's tokens | Revoke per end user in the console or via the management API (`POST /v1/apps/:id/app-user-revocations`); all of that user's existing tokens are rejected at once. Ending their login state in your own system also cuts supply naturally (token TTL 60–86400 s, no renewal) | Affects only that user |
| The whole app | Deactivate the app in the console | Everything downstream is rejected |
| Session-service `/v1` Bearer | Change `TANSR_SERVE_TOKEN` / `--token` and restart | `/v1` callers must switch at the same time |
| Webhook `secret` | The receiver accepts both the old and the new value first, then the session-service side is switched, then the old value is retired | Zero lost deliveries in between |
| Your own login token (mobile) | Belongs to your login system; on 401 the SDK re-fetches through `authProvider` up to 2 times, then enters a terminal state and waits for you to reconnect explicitly | A 401 right after a refresh means revocation or misconfiguration, not jitter |

On the platform side, only one code signals that a token is dead: `unauthorized` (401). When the session service receives it, it evicts the cached token, re-mints and resends once within the same request; a client SDK that sees it runs the 2-attempt convergence described above. Other codes (403, 429, 5xx) do not mean the token is bad — do not re-mint because of them.

## Quick self-check

- `tansr doctor`: did the credential land in the OS keychain or a plaintext file? Does the `localProviders` section match what you expect (platform mode / escape hatch)? Any unattended-baseline notice?
- `grep` your repository once for `TANSR_APP_KEY` / `sk-` / `tansr_sk_` to confirm no real value was committed.
- When the session service binds `0.0.0.0`, is `/metrics` exposed to the internal network only? Is the `store` directory a local disk, not shared?
- Does your token mint endpoint mint only after your own login, and does it always take `endUserId` from the server-side session rather than trusting the request body? Is `x-tansr-end-user` written only by your gateway?
- Is a `--v2` deployment still running with `--legacy-v1` / `TANSR_SERVE_LEGACY_V1`? A `server.deprecated_option` event in the logs means it should be scheduled for removal (gone in 1.0.0); move approval submission to `POST /api/approvals/:id/credential`.
- Is `--host-module-sha256` produced by the deployment pipeline together with the `.cjs` artifact, rather than computed by hand at rollout?
- Are lifecycle rules and encryption configured on the cold-tier object storage?
