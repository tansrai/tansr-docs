---
title: Troubleshooting
description: 'How to read each section of tansr doctor and which ones are blocking versus mere attribution; the ten most common error codes with their meaning and first fix (deep-linked to the error codes table); and the first troubleshooting step for the CLI, the SDK, the session service and mobile.'
zone: support
category: support
related:
  - support
  - errors/codes
  - cli/settings-and-doctor
  - sdk/errors-and-retries
  - support/contact
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

The order of troubleshooting: look at `tansr doctor` (CLI) or the error code (other forms) first, then find the fix in the tables below; nine times out of ten you will not need to contact anyone.

## Step one: `tansr doctor`

```bash
tansr doctor          # 人读报告
tansr doctor --json   # 机器可读
```

Zero model calls, zero network, read-only (it creates no directories); **exit code 0 = usable, 1 = there is a blocking problem**. It shows the facts from the most recent assembly fetch — after changing configuration in the console, run the CLI once to refresh. `/doctor` inside the TUI is a separate, shorter assembly checklist (see below) and does not affect the exit code.

### What counts as blocking

`tansr doctor` counts only four kinds of problem as blocking (exit code 1): `no_provider` (no usable provider at all), `unresolved_model` (the default alias does not resolve to a model), `missing_credential` (the resolved provider's API key environment variable is missing) and `session_store_unwritable` (the session storage directory is not writable). When you pass `--connectors` explicitly to probe deployment connectors, their blocking problems are folded into the same verdict. Every other section is attribution and hints and does not change the exit code.

### Report section reference

| Section | What healthy looks like | What to do when it is not | Blocking? |
|---|---|---|---|
| Config sources and diagnostics | Each of the five layers loaded / absent, none skipped; 0 error-level diagnostics | skipped = that layer has a JSONC syntax error or a non-object root, fix or delete the file; each diagnostic names layer / key path / expected type, and invalid values have been dropped and fall back to a lower layer | No |
| Provider / model resolution / credentials | Default alias → provider / model; the credential is present and shown only as `sk-...last4` | "Unknown model alias or ref": check `modelAliases` and `providers.models`; "Missing API key: environment variable X is not set": export that variable | Yes (`no_provider` / `unresolved_model` / `missing_credential`) |
| `localProviders` (attribution) | Platform mode: local providers pruned, as expected; escape hatch: a banner | For "no provider configured", look here first to tell "not configured" from "pruned" | No |
| Credential storage (attribution) | OS keychain | If it fell back to a plaintext file, check the directory permissions; rerun `tansr init` | No |
| Model selection attribution | The `model.selected` value and the layer that provided it; suppressed state | When the project layer pins `modelAliases.main`, the user layer's sticky choice is suppressed — expected | No |
| Plan | "Personal (CLI only, no plan fee)" or "tier · expiry · state" | The Personal tier is not a fault; for grace / fallen-back states renew in the console | No |
| Media tools | Four facets, each `byo` / `platform` / `none` | All `none` comes with enablement guidance: the three variables for your own endpoint, or ask the administrator to enable a media pool | No |
| Unattended baseline | `auto` with signs of isolation | Without such signs a prominent notice; once you have confirmed isolation, suppress with `TANSR_ISOLATED=1` | No |
| Context / memory | Both window values and the clamp side, the active scheme, compaction statistics for the last 7 days; memory directory and index footprint | Unknown window → declare `maxContext` for the model; a non-production scheme is only a warning | No |
| Session storage | Session count, bytes, sidecar-only directories, corrupted directories; the writability probe passes | Read-only, deletes nothing on your behalf; clean up with `tansr sessions prune`; if the directory is not writable, fix its permissions or point `TANSR_STORAGE_ROOT` elsewhere | Not writable is blocking (`session_store_unwritable`) |
| Workspace trust | Trusted | Untrusted is your explicit choice, not a fault; to lift it, run `/trust grant` in the TUI | No |

### `/doctor` inside the TUI

`/doctor` in the TUI is a separate assembly self-check with zero network and zero subprocesses, one ✓ / ✗ per item; the list is whatever the actual output shows (11 items at the time of writing): `node_version` (≥ 22.19), `config_sources` (none of the five layers skipped), `config_diagnostics` (no error-level diagnostics), `model_resolution`, `context_window`, `context_scheme` (a non-production scheme is flagged), `custom_commands` (no command source skipped), `mcp_connections` (a lazy server not yet connected still counts as healthy; for a failed server look at its error code, `/mcp reconnect`), `terminal` (TTY and size), `workspace_trust`, `output_style` (a non-existent style name is reported honestly). A ✗ is only a hint and is not the same as a `tansr doctor` blocking problem.

### Common CLI messages

| Symptom | Fix |
|---|---|
| "Cannot start the interactive UI: this is not an interactive terminal (TTY)" | You started `tansr` inside a pipe; for scripts and pipes use `tansr -p "<prompt>"` instead |
| "Missing API token: pass --token <value> or set TANSR_SERVE_TOKEN" | `tansr serve` fails closed and will not start an unauthenticated service |
| "Server failed to start" / "Invalid value for --port" | The port is in use or invalid |
| "Session does not exist" / "Cannot resume session" | The `--resume` id is wrong or the directory is in use; run `tansr --resume` without an argument to pick from a list |
| Exit code 5 pointing to `tansr init` | An unattended form was started before initializing; sign in first, or set `TANSR_ESCAPE_LOCAL=1` for local mode |
| Exit code 3 | A limit was reached: `--max-turns` / budget / tool rounds; raise it or split the task |
| Exit code 4 | The prompt is too long and compaction is unavailable; switch to a model with a larger window |
| "Concurrency has reached the plan limit" banner | Only new sessions are rejected; send again after 30 seconds or upgrade the plan |

## The ten most common error codes

The authoritative table of every code is [Error codes](/errors/codes); here are only the ten you hit most often, with the first thing to do.

| Code | HTTP | Where you see it | First fix |
|---|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) | 401 | Token expired or revoked; the session service's `authenticate` returned null | CLI: sign in again with `tansr init`. SDK: go back to your backend and mint a new token. Mobile: fix the login state, then reconnect explicitly. **This is the only code that means the token is bad** |
| [`token_expired`](/errors/codes#token_expired) | 401 | The login token expired | Sign in again / refresh |
| [`invalid_api_key`](/errors/codes#invalid_api_key) | 401 | The PAT is invalid | Recreate the PAT in the console, `tansr init --fresh` |
| [`rate_limited`](/errors/codes#rate_limited) | 429 | Platform rate limiting, or the session-service host's rate limit / plan quota (`detail.scope: 'plan'`) | Wait the whole number of seconds in `Retry-After`, then retry; do not resend more densely |
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | The plan's concurrency hard cap | Only new sessions are rejected; send again by hand after 30 seconds; consider upgrading |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | Balance exhausted | Top up; retrying does not help |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | The model is not in the app's authorized set | Grant the app that model in the console |
| [`validation_failed`](/errors/codes#validation_failed) | 400 | The request payload has an invalid shape | Read `message` and fix the request; it is not a network problem |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | A body cap was exceeded (e.g. raw voice audio > 24 MiB) | Split or compress; not retryable |
| [`session_archived`](/errors/codes#session_archived) | 410 | The platform session was archived (30 days inactive) | Create a new session; this one cannot be continued |

A few more that are frequent but self-explanatory: [`upstream_error`](/errors/codes#upstream_error) (502, upstream model failure, back off and retry), [`upstream_timeout`](/errors/codes#upstream_timeout) (504, same), [`quota_exceeded`](/errors/codes#quota_exceeded) (429, daily quota), [`forbidden`](/errors/codes#forbidden) (403, a capability flag is off or ownership does not match), [`context_window_exceeded`](/errors/codes#context_window_exceeded) (400, compact first).

## The first troubleshooting step per form

**SDK (Node / Electron)**: tell assembly time from run time. At assembly time read `TansrSdkError.code` (`invalid_options`: fix the code; `assembly_failed`: look at `cause`; `capability_disabled`: enable the flag in the console); at run time look at `turn.error.recoverable` in the event stream — `true` is advisory, only `false` is a failure. An event stream that "hangs" is almost always a missing `session.close()`; "every tool is denied" is almost always a missing `permission.askUser`. Details in [Errors and retries](/en/sdk/errors-and-retries/).

**Session service (`@tansr/serve`)**: look at `GET /readyz` first (a 503 carries `reasons`); then at the structured log entries `request.completed` / `store.commit_failed` / `session.rejected`, correlated by the `x-request-id` response header. `resume` always returning `409 resume_unavailable` = no store wired; `500 store_corrupted` is common with a shared storage directory (an unsafe configuration); on session creation, `503 upstream_unavailable` means token minting on the platform side is unavailable, `503 overloaded` is this host's admission cap, and `503 draining` means a graceful shutdown is in progress.

**Mobile (Android / iOS / HarmonyOS)**: look at connection state first. On Android / iOS, `connectionState`: `Retrying` is the normal L1 reconnect; `Recovering` is the L2 rebuild; `AuthExpired → Failed(Unauthorized)` means the token was refreshed 2 times and is still 401 — fix the login state, then call `start()` explicitly. On HarmonyOS, watch `session.onState`: `retrying` / `recovering` / `failed`. 401 as soon as it connects usually means the auth headers are not accepted by the server's `authenticate`. An emulator that cannot connect: Android used `127.0.0.1` instead of `10.0.2.2`; HarmonyOS loopback is local debugging only, and reaching a private address on the development machine needs `allowPrivateNetworkHttp`.

## Bring these when you contact support

- The output of `tansr doctor --json` (it contains no key values; credentials appear as fingerprints).
- The error code and the full `message`; for the session service, also the `x-request-id`.
- Steps to reproduce and the time; for billing issues, the order number or billing month.
- If convenient, the transcript from `tansr sessions export <id>` (keys are redacted automatically).

Entry points are in [Contact support](/en/support/contact/).
