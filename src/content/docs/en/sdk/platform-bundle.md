---
title: Platform assembly and the bundle
description: What the token tier receives — the model catalogue, capability flags, media authorization set and plan projection in the application configuration bundle; how the three tool rings are chosen; what happens when a capability flag is off; and what onPlatformWarning reports.
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - getting-started/sdk
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

The core promise of the token tier is **zero local configuration**: the model catalogue, capability flags, media authorization set and plan status are all configured per "application" on the platform into one bundle; the SDK reads it with the token and trims at assembly time. Different fields have different effective boundaries: the application prompt and policy are checked before each turn starts, and you cannot infer from that that other configuration is hot-updated within the same session. This page covers what is in the bundle, how tools are chosen and what happens when a flag is off. Version baseline: `@tansr/sdk` 0.19.0 / `@tansr/serve` 0.15.1 (both released 2026-10-10).

## The application system prompt is assembly configuration too

`systemPrompt` / `systemPromptPolicy` enter the bundle from the application configuration (available since `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0; the platform side has been live since 2026-09-14). The default `fallback` uses the platform segment when the SDK passes no `system`; `prepend` keeps the platform segment even when the SDK explicitly passes `[]`, followed by the SDK's non-empty business segment. The host `systemAppend` comes after the selected business segment and never overrides it; only then come the tool, Skills or MCP guides actually assembled for this entry.

Both items refresh before the next new turn; the currently executing turn keeps the configuration it selected. The history is not cleared and the session does not need to be reopened. `session.applicationPrompt` exposes a read-only source / policy summary without the prompt text. The full table, the management API and the conflict handling boundaries are in [Application system prompts](/en/sdk/system-prompts/).

## Create the right application type in the console first

Choose the platform type when creating the application; it decides which flags and default profiles are configurable on the "Capabilities and quotas" page and is sent down as `app.platform` in the bundle:

| Type | Use | Capability surface |
|---|---|---|
| Desktop application | Electron and similar, SDK in-process form | Every tool flag and platform flag configurable |
| Mobile application | Android / iOS / HarmonyOS, through your `@tansr/serve` session service | File / command families fixed off; the public-network tools WebFetch / Http / WebSearch are enabled per flag, off by default (see [Public-network tools for mobile applications](#public-network-tools-for-mobile-applications) below) |
| Server application | A Node backend embedding this SDK | Same capability surface as desktop |

Assembling the credentials of a **mobile application** inside this SDK process does not fail, but flags such as the file family have already been normalised to off by topology, and you receive the platform notice frame `app_platform_mismatch`. Create one application per integration form: one application, one platform; many clients, many appids — separate revocation surfaces and separate usage attribution.

A mobile application may additionally be configured through the platform `PATCH /v1/apps/:id` (with `x-tansr-client-features: bound-device-v1`) with an `execution: { version: 'bound-device-v1', boundDevice: { tools } }` section, granting tools on the bound device to the session service's SDK 2.0 explicit execution profile. Since `@tansr/sdk` 0.18.0 `AppCapabilitiesSchema` recognises the section and keeps it as is, but **the in-process SDK does not consume it**: device tool authorization only takes effect in the SDK2 execution profile of `@tansr/serve`; old application types and the old `tools` flags do not imply device authorization, and a missing flag = not authorized, never merged back into the in-process `tools`. See [SDK 2.0 extension entries](/en/sdk/sdk2-preview/).

## Three tool rings: a single `tools` entry

```ts
await createSession({
  token, baseUrl,
  tools: {
    builtin: ['read', 'glob', 'grep', 'imageGen'], // 环 2:内置工具(本地工具跑在终端用户机器)
    custom:  [searchOrders],                        // 环 1:defineTool 业务函数(你的代码)
  },
});
```

- `tools` entirely absent = assemble **all local** built-in tools that the capability flags allow (the four media names are never in the default full set).
- `tools: { builtin: [] }` = zero built-ins, the pure custom-tool scenario with the smallest exposure.
- The `builtin` vocabulary has 16 names: `read` `write` `edit` `glob` `grep` `list` `shell` `todoWrite` `askUser` `webFetch` `webSearch` `http` plus the four media names `imageGen` `videoGen` `speechToText` `textToSpeech`.
- A name outside the vocabulary → `invalid_options`; a flag that is off but explicitly selected → `capability_disabled`, with console repair guidance in the message. **Always fail fast with a readable error, never silently lack a tool.**
- The four media names are billed tools, and their definitions cost tokens in every prompt; **the default full set never assembles them** — to use them, list them explicitly in `builtin`.
- `tools.platform` remains as a compatibility alias (deprecated), equivalent to the same four values in `builtin`; when the alias is present every assembly emits one `tools_platform_deprecated` structured warning. New code should use `builtin`.

The four media tools themselves are kernel system tools; the platform is responsible for the authorization model, credentials and metering. The capability field is still called `capabilities.platform`, but that is just the name of the authorization flags and does not mean there is a separate class of "platform tools". Tool artifacts (images / videos / transcripts / speech cards) also do not mean native realtime audio or video messages are supported: `sendBlocks` only accepts text and images, and native `audio` / `video` blocks return `invalid_blocks` before anything is written to the history or sent to the model; recording transcription and read-aloud buttons go through the separate direct audio interfaces.

Ring 1's `defineTool` is "registration is the manual": one declaration produces both the model-visible schema and the human-readable documentation, in JSON parameter table and zod form. For external MCP use `createMcpHost({ servers })` (shared at the application level) or `mcp: { servers }` (session level); the configuration has the same shape as the industry `mcpServers`. Skills are loaded inline with `defineSkill` or from `dirs` directories, and the user directory is never scanned.

## Capability flags: tool flags and platform flags

Capability flags answer "does this application have this capability"; they are configured per application in the console, sent down in the bundle, trimmed by the SDK at assembly time (the contract surface) and hard-checked by the gateway (the enforcement surface for platform resources). **On the token tier, capability flags always come from the bundle**; passing `capabilities` in the options is rejected. The managed / injected tiers may pass `capabilities` and manage them themselves.

The platform's default profile (conservative):

| Flag | Default | | Flag | Default |
|---|---|---|---|---|
| `tools.read` | on | | `tools.http` | off |
| `tools.write` | **off** | | `tools.todoWrite` | on |
| `tools.edit` | **off** | | `tools.askUser` | on |
| `tools.glob` | on | | `tools.agent` (Task sub-agent family) | off |
| `tools.grep` | on | | `tools.skills` | off |
| `tools.list` | on | | `tools.mcp` | off |
| `tools.shell` | **off** | | `tools.customTools` (ring 1 master switch) | on |
| `tools.process` (reserved) | off | | `platform.imageGen` | off |
| `tools.webFetch` | off | | `platform.videoGen` | off |
| `tools.webSearch` | off | | `platform.webSearch` | off |

The platform flags also include `platform.speechToText` / `platform.textToSpeech` (off by default); these five are the platform flags that chat sessions consume. Since `@tansr/sdk` 0.19.0 `AppCapabilitiesSchema` recognises six more optional platform flags `platform.embedding` / `rerank` / `document` / `music` / `voiceCreate` / `realtimeAudio`, eleven in total: they only authorize the corresponding standalone non-chat HTTP operations (called explicitly through `createPlatformNonchatClient`) and **assemble no chat tool and never enter a session**; absence in the bundle is equivalent to `false` (`DEFAULT_APP_CAPABILITIES.platform` still lists only the first five), and consumers may only treat `=== true` as on. These six are negotiated and sent down through the new `nonchat-operations-v1` in `x-tansr-client-features`, and the change to the `CLIENT_FEATURES` vocabulary makes the first assembly after upgrading re-fetch the bundle instead of hitting the old cache. `CAPABILITY_TOOL_KEYS` / `CAPABILITY_PLATFORM_KEYS` are the source of truth. When `tools.agent` is on, the Task sub-agent family is assembled automatically, and sub-agents inherit the session model and permission gate.

## Why webSearch has two flags

Web search is the only capability in the whole table that occupies a flag on both planes. The two flags are not two tools; they are **two gates of the same tool**:

- `tools.webSearch` (governance plane): whether the WebSearch tool may appear in this application's session assembly vocabulary.
- `platform.webSearch` (channel plane): whether the platform's billed search channel is enabled for this application.

The reason is that the webSearch tool itself lives in ring 2 (the same `WebSearch` as the CLI) while the backend is always the platform channel — the SDK form has no bring-your-own search endpoint, and a client holding a search provider's key is exactly the anti-pattern that the app key anti-theft model exists to eliminate. The assembly matrix in one sentence: **implicit selection = use what is there and silently shrink by flag; explicit selection = a claim that must hold, failing fast with a readable, attributed error when it does not** (`capability_disabled` or `invalid_options`).

<a id="移动应用的公网工具"></a>

## Public-network tools for mobile applications

Sessions for mobile applications are assembled on your `@tansr/serve` (the hosted topology). The only tool flags such applications can tick are `todoWrite`, `askUser`, `customTools`, `webFetch`, `http`, `webSearch` and the platform flags; local families such as files and commands are fixed off; `customTools` are declared through the `clientTools` remote tool channel and executed by the phone.

- **Versions**: `tools.webFetch` (web page fetching, WebFetch) and `tools.http` (HTTP requests, Http) are assembled since `@tansr/serve` 0.12.0 / `@tansr/sdk` 0.17.0 (released 2026-09-16; the current 0.15.1 / 0.19.0 apply equally); serve 0.11.0 and earlier do not assemble these two for mobile applications. Both flags are off by default and must be enabled explicitly for the application in the console; `tools.webSearch` additionally needs the `platform.webSearch` channel enabled (see the previous section).
- **Where they run**: all three tools run on **your session service host**, through the same core tools and permission chain; the Android / iOS / HarmonyOS SDKs do not send network requests on the phone's behalf and do not approve automatically. A tool allowlist configured explicitly on the server can only narrow further.
- **When changes take effect**: after changing capability flags, only new sessions or sessions re-assembled from storage pick them up; token renewal and prompt refreshes do not alter the tool table of an active session. An emergency withdrawal requires stopping the sessions concerned.
- **Execution boundaries**: the hosted Http cannot reference credentials in the host's environment variables, and the model cannot lift the host's private-network access limits by itself; when configuring an egress proxy, restrict private-network targets on the proxy side as well. WebFetch follows the existing egress rules, and a cross-host redirect may trigger a new permission prompt — issue another explicit request to the public target given in the error; do not approve redirects automatically.
- **Reading results**: for known URLs let the agent use WebFetch first; use Http to inspect API responses. A 4xx / 5xx from Http is a response that needs examination — tool completion does not mean the remote HTTP call succeeded; an empty search result only means this query matched nothing, not that the site does not exist. The UI must keep truncation hints.

## What else the bundle sends down

- **Model catalogue**: alias / handle / `displayName` / `manufacturer` / `family`; `setModel` takes a handle. `model.modelId` is an optional field; callers reading it treat it as `string | undefined`. Since `@tansr/sdk` 0.18.0 there is also the read-only projection `model.adapterDiagnostics?` (the `request` / `billing` sections each carry `adapterId` / `operation` / `status ∈ 'ready' | 'review' | 'unresolved'`, plus `conflicts[]`), describing whether the current catalogue evidence suffices to select the request / billing adapters, for displaying a model's calling / metering ability in the UI; it carries no provider credentials, raw prices or executable adapter objects, is `undefined` when the platform does not send it, and a malformed section drops only the diagnostics, not the model entry.
- **Media authorization set** `platformModels`: the descriptions of the four media tools list the model names in the set automatically, and the first in order is the default; integrators never hand-configure model names. Since 0.19.0 the `SpeakInput` of the token tier's direct `session.platform.speak()` gains an optional `voiceRef` (the id of an application-private voice resource, mutually exclusive with the system `voice`; scope and target model are validated by the platform); private voices themselves are created and queried through the non-chat client and are not sent down in the bundle.
- **Plan projection** `plan`: `{ tier, caps{ concurrency, apps, orgMembers, monthlyEndUsers, gatewayLane }, status: 'active' | 'grace' | 'lapsed', expiresAt }`, with `null` = a personal profile without a plan. It is only a projection; enforcement is always server-side, and the SDK never judges limits locally.
- **Adjudicator profile** `adjudicator`: the token tier assembles the adjudicator appointed in the console by default; its qualification `tier` decides how large a radius of "ask" it may soften into allow.

## onPlatformWarning: how non-fatal degradation is reported

Non-fatal facts from bundle parsing and assembly are reported through `createSession({ onPlatformWarning })` / `onWarning`; when absent they fall back to the session event stream as `turn.error { scope: 'sdk.notice', recoverable: true }`, never to the console and never changing the assembly result. Common codes:

| Code | Meaning |
|---|---|
| `app_platform_mismatch` | The application platform type does not match the integration form |
| `tools_platform_deprecated` | The old `tools.platform` alias was used |
| `capabilities_unparsed` | The bundle `capabilities` section is present but failed to parse (`detail.issues` carries the zod issues). **Available since SDK 0.13.0**: this case falls back to the zero-capability profile (`tools` all false) instead of the default profile; 0.11.x fell back to the default profile |
| `adjudicator_unavailable` / `adjudicator_model_unavailable` / `adjudicator_budget_exhausted` / `adjudicator_breaker_tripped` | Adjudicator absent / model unavailable / budget exhausted / circuit breaker tripped |
| `adjudicator_skipped_by_mode` | An explicit `permission.mode` prevented the adjudicator from being assembled. **Available since SDK 0.13.0**: an explicit `permission.mode` adopts self-managed mode and emits this report; explicit `adjudication` together with the mode is still rejected. The 0.11.x restriction on the default adjudicator conflicting with the mode has been withdrawn |

## Metering and reconciliation

`cost.usage.updated` reaches the event stream per request. End users check themselves with `GET /v1/my-usage` (never any amount fields); developers reconcile with `GET /v1/app-usage/by-end-user` (with amounts, never proxied to end users). Metering and billing are separate — how you resell to end users is up to you.

Since 0.19.0 the SDK exports the field shape of application quotas, `AppQuotaSchema` / `AppQuota` (`dailyTokens` / `endUserDailyTokens` / `rpm` always present and nullable; `tpm` and the media and non-chat operation counts such as `endUserDaily*` / `dailyOperationUnits` optional), for validation when reading or writing the platform application configuration. Quotas are **not sent down in the bundle**; enforcement is always on the platform. A locally held quota value is not a remaining allowance, and the SDK does not judge limits locally from it.
