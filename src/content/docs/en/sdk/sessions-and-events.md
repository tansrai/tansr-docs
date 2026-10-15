---
title: Sessions and events
description: Understand the three API tiers of @tansr/sdk, the multi-turn semantics of AgentSession, the event envelope and the main event families, and how SessionView and Narrator turn the event stream into renderable state.
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - getting-started/sdk
  - sdk/checkpoints
  - sdk/platform-bundle
  - sdk/errors-and-retries
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
lastVerified: '2026-10-13'
---

The SDK's division of labour in one sentence: **the agent loop belongs to the SDK, the interaction experience belongs to you**. You provide the UI (or no UI), the business functions and the permission confirmation flow; the SDK provides model access, tool execution, the event stream and state projection. This page is about the event stream, the main trunk.

This page applies to `@tansr/sdk@0.13.0` and later as published on npm (currently **0.19.0**, released 2026-10-10; paired with `@tansr/serve` 0.15.1 and the `tansr` CLI 0.10.3). 0.18.0 / 0.18.1 / 0.19.0 bring **zero behaviour change** to the in-process API on this page: the three tiers `createSession` / `query` / `runAgent`, the event envelope and `SessionView` are all as they have been since 0.14.0; the unified HTTP call surface `/api` is a session service matter, and the SDK embedded in Electron / Node never goes through it. Version differences are confined to the two sections at the end of this page, "Additions in 0.18.x" and "Additions in 0.19.0".

## The boundary between system and ordinary input

`query.prompt` and `session.send()` are user messages and never modify the system role. Builds that support the new prompt feature pick the platform segment and the SDK `system` according to the platform `fallback` / `prepend` policy at assembly time, then append `systemAppend` and the applicable guides; the feature is available since `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0, and the platform side has been live since 2026-09-14.

`session.applicationPrompt` is a read-only `{ source, policy }` summary with no prompt text, and it does not count `systemAppend` as a business source. Platform prompts and policies refresh before the next new turn; the currently executing turn keeps its configuration, and the original instance and history are preserved. The host `system` / `systemAppend` are still managed by code and session configuration. The injected-client `query` tier and the low-level `runAgent` do not pull platform configuration automatically; call `resolveApplicationSystem` yourself. Full code is in [Application system prompts](/en/sdk/system-prompts/).

## Three API tiers

| API | Signature shape | Use it for |
|---|---|---|
| `query(options)` | `AsyncGenerator<KernelEvent, QueryResult>` | A single-turn question and answer (including the tool loop); the `return` value is the structured final result |
| `createSession(options)` | `Promise<AgentSession>` (async, always `await`) | Multi-turn sessions: `send` / `events` / `interrupt` / `messages` / `setModel` / `close` |
| `runAgent(options)` | `QueryHandle` | Low-level passthrough: bring your own client / executor / tools, zero assembly |

`query` is the single-turn convenience surface that passes the kernel event stream straight through; events synthesised by the assembly layer (`hook.*`, the todo ledger, …) only appear in the session event stream of `createSession`. Most applications use `createSession`.

```ts
import { query } from '@tansr/sdk';

const run = query({ token, baseUrl, prompt: '用一句话说明 Electron 是什么。' });
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
const result = step.value; // QueryResult:reason / finalText / messages / usage / counters
```

Breaking out of `query` early aborts the query loop automatically and leaves no dangling turn; assembly errors reject on the first `next()` with `TansrSdkError('assembly_failed')`.

## Multi-turn semantics of AgentSession

Before exiting the application or closing a shared MCP host, use the newer [closeAsync / drain receipts of real cleanup](/en/sdk/lifecycle/). The close example below only illustrates the original event terminal state; it is not proof that asynchronous storage or underlying resources have finished.

```ts
const session = await createSession({ token, baseUrl });

const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();

session.send('第一轮问题');      // 空闲 → 起新一轮
session.send('补充一句');        // 旧兼容入口；严格同轮与回执使用 submitInput
await session.idle();            // 等当前轮(含结转连锁轮)终态
session.interrupt();             // 优雅中止当前轮(事件流走到 turn.aborted),会话可继续
console.log(session.messages()); // 历史快照(深拷贝;可持久化 / 续跑)
session.close();                 // 幂等;运行中先 abort,尾部事件不丢
await pump;
```

Method semantics:

- `send(prompt)`: starts a new turn when idle; while a turn is running it is consumed through the input barrier, and old input not consumed within the natural `completed` / `structured_output` window may be carried over. Hard terminal states such as limits or explicit aborts never start a new same-generation turn automatically to escape the budget. When you need strict same-turn delivery with a receipt, use [submitInput](/en/sdk/midturn-input/) and do not fall back to `send()` after the target has closed. Calling it after `close` throws `session_closed`.
- `events`: an `AsyncIterable<KernelEvent>` that is continuous across turns with a monotonic `seq` within the session. **Multi-consumer broadcast**: every `for await` is an independent subscriber — the SessionView pump, the Narrator and your own loop can all be attached at once, each receiving everything. Subscribers attached before the first `send()` get every event since the session was created; subscribers attached mid-stream start from their subscription point.
- `setModel(next)`: takes effect on subsequent turns. Token / managed tiers pass an alias string (a failed re-resolution throws `assembly_failed` and leaves session state unchanged); the injected tier passes `{ client, model }`.
- `signal` option: an AbortSignal; abort means close.
- `initialMessages`: history preload (resume scenarios; low-level path, no pairing governance).
- `onHistoryCommit(history, meta)`: a callback with a deep copy of the full history at every turn terminal state; `meta.rewritten === true` means the history prefix was rewritten in place (compaction fold / stubbing) and whoever persists it must rotate the whole volume. In most scenarios just use the `store` field and let the built-in implementation do this — see [Checkpoints and resume](/en/sdk/checkpoints/).

**Since `@tansr/sdk` 0.14.0** (released 2026-09-14) `createSession` has four new optional keys, all pure additions — omit them and nothing changes:

- `trustProjectHooks?: boolean`: the trust gate for project-level hooks. Default `false` = the `command` / `http` hooks declared in the workspace `.tansr/settings.json` / `settings.local.json` get **zero execution and zero `hook.*` events** (user-level / managed hooks run as usual); explicit `true` = the host vouches for this workspace on the user's behalf and project-level hooks run. The SDK never persists trust and never reads the `tansr` CLI's `trust.json`; you pass in the fact of trust after confirming it with the user each time. When gated project-level hooks are present, `onWarning` reports once with `SdkWarning { code: 'project_hooks_untrusted', detail: { cwd, registered: { projectShared?, projectLocal? } } }`; without `onWarning` this falls back to the event stream as `turn.error { scope: 'sdk.notice', recoverable: true }`. **Behaviour tightened**: project-level hooks that previously ran as soon as a repository was cloned and `createSession` was called no longer run by default. Single-turn `query()` shares the same assembly and the same gate, and has no trust flag yet — project-level hooks are never enabled inside `query()`. The same gate on the CLI side is described in [Security and privacy](/en/security/#项目层-hooks-的信任门缺省零执行).
- `hostShell?: 'posix' | 'powershell'`: the lexical dialect the permission engine uses to parse shell commands. Defaults to auto-detection from the host platform (matching the shell that the built-in Shell tool actually spawns); an explicit value is for tests or cross-platform rehearsal (for example rehearsing rules with posix lexing on Windows). A mismatch with the real execution shell detaches the lexical guard from the execution environment — **do not set it on production hosts**. Effective in all three tiers.
- `budget?: { maxUsd?, maxTotalTokens?, onExceeded?: 'block' | 'warn' }`: the session budget gate, same shape as the `budget` section of the CLI configuration file; TUI / headless / serve / acp / SDK — all five forms now share the same gate semantics. When the session's cumulative spend hits the cap, `'block'` (default) ends the turn before the next model call — the event stream shows `turn.aborted { reason: 'budget_exceeded' }`, the session stays open and later turns are blocked the same way; `'warn'` emits at most one `turn.error { scope: 'budget', recoverable: true }` per query and continues. Both caps absent = no gate. `maxTotalTokens` = input + output + cache reads + cache writes (thinking tokens are folded into output according to each model's capability flags, never double counted); `maxUsd` only produces a number for models priced in USD — the token tier is priced by the platform bundle, while the managed / injected tiers' current built-in price list is in CNY, so `maxUsd` offers no protection there; the currency-independent fallback is `maxTotalTokens`. Illegal values (non-positive / non-integer / outside the vocabulary) are rejected with `invalid_options` before any IO. Unrelated to `thinking.budget` (the per-turn thinking budget); no new event types, and resumed sessions do not backfill historical usage.
- `events?: { maxBacklogEvents, maxBacklogBytes }`: the event backlog bounds. The backlog accumulated before the first subscriber arrives is bounded both by count and by approximate bytes, default 1000 events / 2 MiB (positive numbers or `Infinity`, otherwise `invalid_options`); on overflow the oldest are dropped, the newest event is always kept, and exactly one first-class event `session.events_dropped { scope: 'sdk.events', droppedCount, reason: 'count_limit' | 'bytes_limit', droppedBytes, firstDroppedSeq, lastDroppedSeq, maxEvents?, maxBytes? }` is placed at the head of the queue; dropped events cannot be fetched again. Within the bounds, "a late first subscriber receives the full backlog" is unchanged, and existing code that subscribes before `send()` needs no modification. Events pushed while all live subscribers have left are **not retained** (zero-semantics trimming: not counted as drops, not reported; a later subscriber starts from the present) — for long-running sessions, subscribe before `send()` or raise the bounds as needed.

The same version also tidied a few edges worth knowing: `token` accepts a `() => string` getter (the current value is read when any of the five kinds of platform request is made, so token rotation needs no session rebuild); after `close()`, `setModel` / `setThinking` / `interrupt` all throw `session_closed`; `AgentSession.pushBody` was removed from the public types (it was never a promised surface); `SessionNotice.message` became optional — hosts render by `code` and use `message` only as a fallback; for `drain({ force: true })` while waiting for cleanup see [Closing a session and waiting for cleanup](/en/sdk/lifecycle/).

Sessions are purely in-memory by default; the platform does not store end-user session content, it only meters.

## Event envelope and event families

Every event carries the envelope fields `type` / `sessionId` / `seq` / `ts` / `v` (contract version) / `source`; `turnId` is present on in-turn events. Events are a flat discriminated union — branch directly on `event.type`; it is the same contract as the session service's SSE.

| Family | Events | When to look at it |
|---|---|---|
| session | `session.created` `session.resumed` `session.compacted` `session.checkpointed` `session.restored` `session.locale.changed` `session.ended` `session.events_dropped` | Lifecycle and history rewrites; `session.events_dropped` (contract-v0.27, SDK 0.14.0 and later) reports an in-process SDK event backlog overflow — `@tansr/serve` never emits it and the `/v2` stream never carries it |
| turn | `turn.started` `turn.completed` `turn.aborted` `turn.error` | The boundaries of a turn; `turn.error` carries the `recoverable` flag |
| msg | `msg.block.start` `msg.text.delta` `msg.thinking.delta` `msg.block.end` `msg.retracted` | Streamed text and thinking; `msg.retracted` means an already streamed block was withdrawn (for example a clean retry after hitting the output cap) |
| tool | `tool.proposed` `tool.permission.requested` `tool.permission.decided` `tool.started` `tool.progress` `tool.output.delta` `tool.completed` `tool.failed` | The full tool lifecycle; provider failures of media tools surface as `tool.completed.isError`; since 0.14.0 calls whose arguments do not match the tool's `inputSchema` are rejected by the scheduler before execution and surface as `tool.failed { errorType: 'invalid_args' }` with no `tool.started` / `tool.completed` (no execution, no permission adjudication) |
| agent | `agent.spawned` `agent.progress` `agent.completed` | Task sub-agents |
| hook | `hook.triggered` `hook.completed` `hook.blocked` | The hooks you configured |
| cost | `cost.usage.updated` `cost.provider.switched` | Per-request usage; provider fallback switches |
| mcp | `mcp.connected` `mcp.connect_failed` `mcp.closed` `mcp.discovered` and more | MCP server state |
| plan | `plan.todo.updated` | The todo ledger |

The iron rule of forward compatibility: **ignore unknown event types and unknown fields**; do not validate against a closed enumeration — the contract evolves by "optional additions".

## Do not assemble events by hand: SessionView and Narrator

When building a UI, do not concatenate strings from `msg.text.delta` yourself. The SDK ships two outlets:

- `createSessionView(session)`: reduces the event stream into an **immutable view snapshot** (message list, tool cards, todos, usage, error banner, connection state), structuredClone-safe, so it can be passed to the renderer directly over Electron IPC.
- `createNarrator(...)`: produces human-readable log lines, suitable for debugging and audit output.

The presentation profile is optional: `{ delivery: { text: 'stream' | 'final', thinking: 'stream' | 'final' | 'off' } }` — text and thinking each choose between streaming and one-shot display, and thinking can be hidden entirely; `view.setDelivery(delivery)` switches at block granularity while running. The generation-side thinking budget goes through `createSession({ thinking: { budget } })` and `session.setThinking(...)`, orthogonal to the presentation profile.

Recoverable advisory `turn.error`s (`recoverable: true`, for example a persistence failure) go into `SessionView.notices` (FIFO, capped at 20) without polluting `lastError`; `ErrorView.recoverable` is a required field, so custom projections must fill it in. Since 0.14.0 `session.events_dropped` also goes into `notices` (`code: 'session.events_dropped'`, no `message`, `detail` = the payload minus `type` / `scope`), and the Narrator prints one line `events dropped [scope]: N event(s) dropped (reason)`; for this reason `SessionNotice.message` became optional — render by `code` and use `message` only as a fallback (for example `notice.message ?? notice.code`). Since the same version the Narrator's one-liner for `turn.error { recoverable: true }` reads `… — recoverable, session continues` — the SDK only guarantees that the session is still open; whether to retry is your call. Code that branches on `notices[].code` / `scope` is unaffected.

Since 0.15.0 the artifacts of image / video / speech tools (`artifact`) are kept with the session history; after `resume` / checkpoint restore, `SessionView` can rebuild the preview of the corresponding tool card. When the history carries an artifact but the preview cannot be restored safely, the tool card sets `artifactUnavailable: true` (the tool's completion state is unchanged; old histories without artifacts never set it). Session storage that contains artifacts uses version 2 from then on, and upgrades must be done as a whole — see [Checkpoints and resume](/en/sdk/checkpoints/).

## Permissions: bridging ask to your UI

`permission: { mode?, rules?, askUser? }` — when a tool call lands on "ask", it is bridged to your UI through `askUser`; without `askUser` the SDK fails closed and denies, which is the most common reason for "every tool is denied". The token tier assembles the adjudicator appointed in the console by default (`adjudication?: { posture?, callBudget?, enabled?, endUser? }`); an explicit `permission.mode` is treated as self-managed mode, the adjudicator is not assembled and `adjudicator_skipped_by_mode` is reported; an explicit `adjudication: {…}` together with `permission.mode` is a genuine contradiction and throws `invalid_options`; for silent self-management pass `adjudication: { enabled: false }`.

## Three rules of economy

Most of the money in a long session goes to **re-sending the prefix**. Three rules save most of it:

1. **resume / attach always beats creating anew.** Hold on to the last `sessionId` → try to resume first → create only when resuming fails; opening a new session on every page visit throws away the whole warmed upstream cache.
2. **Keep the declared bytes stable.** Tool names / descriptions / parameter schemas / the `builtin` selection / the system segment all enter the model request prefix; swapping the order or changing one character of a description misses the entire prefix on the next turn. Keep tools and the host business segment stable; a platform prompt change updates the prefix on later turns, so evaluate cache hits and call cost together.
3. **Close when idle, never abandon.** `close()` initiates logical close and abort; before the host exits, use `closeAsync()` to check the receipt of real resources and required storage flushes — see [Lifecycle and resource cleanup](/en/sdk/lifecycle/). Platform session archiving is a separate boundary: the store content remains and can be `resume`d at any time.

<a id="018x-的加法"></a>

## Additions in 0.18.x

Relative to 0.17.0, the changes in `@tansr/sdk` 0.18.0 (2026-10-02, the "2026.10 unified API release train") and 0.18.1 (2026-10-04, the "0.14.0 batch") that concern this page are all **optional additions** — omit them and nothing changes:

- **The sub-entry `@tansr/sdk/extensions`** (shipped since 0.18.0): the local archive host `createNodeArchiveHost` and the local cache host `createNodeCacheHost`, both explicitly assembled hosts and **not default switches of `createSession`**; code that does not import this sub-entry is unaffected. 0.18.1 has zero `src` changes relative to 0.18.0 and rode along only because the published content of `./extensions` differed. The responsibility boundaries and performance disclosure of the two hosts are in [SDK 2.0 extension entries](/en/sdk/sdk2-preview/).
- **`ToolContext.executionTarget?` / `ToolContext.turnId?` and `GateDecision.executionTarget?`**: three new optional keys readable by custom `Tool.execute` and custom permission gates. In the in-process SDK (`createSession` / `query` / `defineTool` / custom gates) these three keys are **always absent** — only the SDK2 explicit-execution scheduler of the session service fills them, meaning the call will run on a remote bound device / controlled service. A custom gate that reads `executionTarget` must not fall back to the host's local resources (a missing resource means deny, not a host fallback).
- **`AppBundleModel.adapterDiagnostics?`**: a read-only projection describing whether the platform catalogue evidence suffices to select the request / billing adapters (`status ∈ 'ready' | 'review' | 'unresolved'`), for display in the UI; it carries no provider credentials or raw prices, and is `undefined` when the platform does not send it.
- **`CLIENT_FEATURES` gains `'bound-device-v1'`**: the default declaration string of the outgoing header `x-tansr-client-features` changes accordingly, so the first assembly after upgrading pulls the bundle once more under the new fingerprint (old cache entries expire naturally, nothing to clean by hand); code doing an exhaustive `switch` over `ClientFeature` adds one branch. The in-process SDK does not consume the bundle's `execution` section; device tool authorization only takes effect in the session service's SDK2 execution profile — see [Platform assembly and the bundle](/en/sdk/platform-bundle/).
- **The optional `SessionStore` capability flag `attachmentCheckpoints`**: implemented by the built-in `createFileSessionStore`; `resume` now cold-restores the attachment admission state together with the history. A custom five-method Store that does not declare it keeps the 0.17 behaviour — see [Checkpoints and resume](/en/sdk/checkpoints/).

<a id="0190-的加法"></a>

## Additions in 0.19.0

Relative to 0.18.1, the `src` changes of `@tansr/sdk` 0.19.0 (2026-10-10, shipped together with `@tansr/serve` 0.15.1 and CLI 0.10.3) are all under `platform/*`; `session.ts` / `query.ts` / `run-agent.ts` are untouched. For this page they are again **optional additions**:

- **The standalone platform non-chat operations client `createPlatformNonchatClient({ baseUrl, token, onUnauthorized? })`**: an explicit HTTP client for platform operations such as embeddings / reranking / document extraction / music / private voices / video tasks and realtime sessions. It is **not attached to `AgentSession`, never enters the session history, never emits session events and never registers any chat tool automatically** — it only sends the operations the caller explicitly requests; submitting methods require a stable `idempotencyKey`, and `wait()` is bounded by `timeoutMs` / `maxPolls` and returns `reason: 'terminal' | 'timeout' | 'poll_limit'`. Failures throw `PlatformNonchatError` (`code: 'platform_request_failed'`, carrying `status` / `platformCode` / `outcomeUnknown` / `taskId?`); handling is described in [Errors and retries](/en/sdk/errors-and-retries/). `onUnauthorized` is called exactly once on a token-invalidating 401, to mint a new token and replay the same key and body.
- **Six optional platform capability flags and `'nonchat-operations-v1'` in `CLIENT_FEATURES`**: the default declaration string of the outgoing header changes again, so the first assembly after upgrading pulls the bundle once more under the new fingerprint; an exhaustive `switch` over `ClientFeature` adds one more branch. The six flags only authorize the non-chat operations above; absence is equivalent to `false` — see [Platform assembly and the bundle](/en/sdk/platform-bundle/).
- **`SpeakInput.voiceRef?`**: the token tier's direct `session.platform.speak()` can name an application-private voice resource, mutually exclusive with the system `voice`.
- **`AppQuotaSchema` / `AppQuota` and the contract types for realtime connections and temporary document uploads**: exports of types and zod shapes only; in-process sessions do not consume them.

The main line keeps moving after 0.19.0 (for example primary / standby adjudication policies for model roles, function-level tool permissions, finding private voices by task and same-identity isolation of token renewal); none of it **has shipped in any npm release**, and this page does not describe it.

## Related

- [Checkpoints and resume](/en/sdk/checkpoints/): `store`, `resume`, manual compaction and snapshots.
- [Platform assembly and the bundle](/en/sdk/platform-bundle/): what the token tier receives and how the three tool rings are chosen.
- [Errors and retries](/en/sdk/errors-and-retries/): branching on `turn.error` and `TansrSdkError`.
