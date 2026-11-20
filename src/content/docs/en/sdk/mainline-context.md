---
title: Context and subagents on the main line
description: Caller-facing context and subagent behavior implemented on the tansr-cli main line and not yet recorded in a CHANGELOG version. Covers handoff options and rejection reasons, branch summaries, compaction watermarks, ToolSearch, Task and resident control, Codemode limits, and post-write verification. The published SDK 0.20.1 and CLI 0.11.0 do not include it.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/extensions/branch-summary.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/kernel/src/tools/task/agent-tools.ts
  - tansr-cli:packages/kernel/src/tools/codemode/codemode-tool.ts
  - tansr-cli:packages/kernel/src/tools/discovery/tool-search.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

The behavior below is already on the `tansr-cli` main line and **is not yet recorded in the CHANGELOG of any published release**. `@tansr/sdk` 0.20.1 and CLI 0.11.0 on npm do not include it. Do not call it until you upgrade to a package that contains these changes. Generated SDK symbol pages still follow the published contract.

## Session handoff

A session from `createSession` can hand off toward a new goal with `handoffSession(session, options)`. It reads the source session only (the latest context compaction summary, the retained tail of history, and the paired file inventory), writes a briefing for the new goal, and creates a new session that carries a single seed message. The new session records `parentSessionId`. The source session's memory, checkpoints, and persisted records stay unchanged and can still be resumed.

```ts
import { handoffSession } from '@tansr/sdk';

const next = await handoffSession(session, {
  goal: 'ship the retry change',
  reviewDraft: (draft) => ({ action: 'confirm', briefing: draft.briefing }),
});
if (next.status === 'created') {
  console.log(next.sessionId, next.parentSessionId);
}
```

Options:

- `goal` is required and must not be blank after trimming. A blank goal is `rejected` with `invalid_goal`, and no model call is made.
- `instructions` is an optional extra hint for the briefing. An aborted `signal` at any check returns `cancelled` and leaves no new session.
- `reviewDraft` receives `parentSessionId`, `goal`, `briefing`, and `fileInventory`. It may replace the briefing, or return `{ action: 'cancel' }`. A blank replacement is `rejected` / `empty_briefing`.
- `newSessionId` defaults to a new UUID. `title` defaults to the goal, truncated at 64 characters. `cwd` defaults to the source session. `meta` is merged into stored metadata, and `parentSessionId` plus `handoffGoal` are always written.
- `client`, `model`, `store`, and `maxSummaryTokens` are optional. A session that was not created by the root `createSession`, and has no usable model injected, is `rejected` / `unsupported_session`.
- A closed session is `session_closed`. A turn that is still running is `turn_running`. Neither makes a model call. A model that cannot be assembled is `model_resolution_failed`. Failure to create the new session is `failed` / `session_create_failed`. A briefing failure is `failed` and includes `reason` and `message`.

`created` includes `parentSessionId`, `sessionId`, `handoffGoal`, `briefing`, `fileInventory`, and `seedMessage`, and may also include `session` and `usage`. Cancel, rejection, and failure do not leave a new session behind.

Sessions created by the same factory also have a non-enumerable `session.handoff(options)` with the same behavior. Call the exported function from types. The same export surface also includes `HANDOFF_PROVENANCE_TAG` (the seed-message tag `tansr-handoff-v1`), `buildHandoffSeedMessage`, and `readHandoffProvenance`.

The CLI interactive UI adds `/handoff <goal>`. An empty goal only prints the usage `/handoff <goal>`: no model call, and the current session is unchanged. Esc or Ctrl+C cancels the review. After you confirm, the UI switches to the new session. The original session stays on disk and can be found with `/resume`.

## Fork from a committed node

The published `session.fork(checkpointId)` is still a fork from a checkpoint. This page does not change that contract. The new surface on the main line is `restoreWithBranchSummary`.

- Passing only `checkpointId` remains a strict linear ancestor restore.
- `allowSibling: true`, or a direct `targetMessages` history, switches to a sibling that shares the same origin. The summary covers only the delta that left the common prefix, plus a file inventory. Cold segments before the fork point are not fully scanned.
- Success is `installed`. It includes the protective checkpoint `preRestoreCheckpointId`, the message counts before and after install, and an optional `lcaIndex`. There is exactly one summary message. The default contract of `session.restore` stays the same.
- Invalid options are `rejected` / `invalid_options`. A session not created by the root entry is `unsupported_session`. Stale material is `source_invalidated`. Abort is `cancelled`.

## Context compaction

When context compaction fires in the middle of a turn, the summary is written as two parts: history that has already finished, and the unfinished prefix of the current turn (the original request, actions already run, and the scene that still has to be continued). A tool call and its result are not split onto opposite sides of the summary. A later compaction unwraps the previous wrapper instead of nesting the same prefix again.

Background pre-compaction is not the default. When `backgroundCompactMargin` is absent from the context thresholds, no earlier watermark is derived, and the returned shape matches the unconfigured path. The margin must be a finite number greater than zero. `0`, a negative number, and NaN throw. Once it is set, reaching that earlier watermark — still clamped between the microcompact stop line and the automatic compaction line — sends the main request immediately, while a background task summarizes a read-only snapshot. The next barrier checks that the epoch and the material still match. Clear, rewind, or a synchronous compaction past the snapshot discards it. `closeAsync()` waits for it to settle and records the usage.

One-shot auxiliary requests (context compaction, branch summaries, a one-off title or classification) set `skipCacheWrite`, so they no longer leave a cache marker that the main conversation would read again. Main-session requests and the main turn of a resident subagent keep the previous cache policy.

The tool definitions from the first turn are pinned as the cache prefix. Tools activated later are appended after that prefix.

## Deferred tool discovery

When `deferredDiscovery` is absent, tool assembly matches the previous behavior and `ToolSearch` does not appear. After you pass it, registration depends on the deferred candidate count:

- `ToolSearch` is registered only when the count reaches the threshold. The default threshold is 16, and `threshold` can change it. `force: true` registers it even below that count, so a later MCP connection can join the catalog.
- Below the threshold, and without force, tools you passed in are still installed directly (`eagerBelowThreshold` defaults to `true`).
- A model call to `ToolSearch` requires a non-blank `query`. It may be natural-language keywords, an exact tool name, or `select:tool_a,tool_b`. `limit` defaults to 5 and must be from 1 to 20. Matched tools are appended to the active tool set.
- The description text is a frozen constant. Connecting or disconnecting MCP later does not change that sentence, and the full catalog is not pasted into the system prompt.
- Each subagent keeps its own catalog and cannot see tools another subagent activated. A real call still goes through the permission gate.

## Task and resident subagents

At most 4 resident subagents run at once. A parent session can operate only on subagents it created directly. The model-facing tools are:

- `SpawnAgent`: `label` and `prompt` are required. `subagent_type` and `tools` are optional. An empty `tools` list is a text-only resident agent.
- `AgentFollowup`: `agent_id` and `message` are required. `mode` defaults to `followup`, which queues until the end of the current turn. `steer` changes direction after the current tool batch.
- `AgentControl`: `action` is `status`, `list`, `stop`, or `release`. `stop` and `release` require `agent_id`. `list`, or `status` without `agent_id`, inspects every subagent in the current scope.
- `release` succeeds only after the subagent has stopped, physical cleanup has finished, no report is still waiting to be delivered, and it owns no further subagents. In-flight work, cleanup still running, or owned children return `agent_busy`. A breaker park with no in-flight resources can be released. Release deletes the persisted subvolume.

These parent control tools are not handed to child agents as ordinary tools.

The three `Task` shapes are mutually exclusive. Pass exactly one:

- A single task requires both `prompt` and `description`. Only this shape accepts `run_in_background: true`.
- `chain`: 1 to 6 steps. The next step receives the previous output through `{previous}`. Intermediate bodies are not written into the parent session history.
- `tasks`: 1 to 8 items in parallel. `concurrency` defaults to 4 and must be from 1 to 8. `policy` defaults to `allSettled`, or `failFast`. `concurrency` and `policy` are valid only together with `tasks`. On `failFast` or parent cancellation, unfinished siblings are stopped and resources are waited on until cleanup finishes.

Each step may also carry `subagent_type`, `tools`, `model`, and `max_turns`. `max_turns` is clamped to 4 through 32.

A resident subagent stays in memory by default. Only an explicit `subvolumeStore` with a `rootDir` writes `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json` and warm-resumes from that file after a process restart. The path stays inside that parent session directory. After 5 consecutive crashes by default (`restartLimit`, which must be a positive integer) it stays locked across restarts until you `release` the slot. A diskless session service does not provide this store, so it does not write the subvolume to disk.

## Codemode and structured results

A tool may declare an optional `outputSchema`. A successful result may carry `structuredData`. That data is not placed into the messages sent to the model. A failed check strips it and becomes a structured error. If a later hook changes the text and does not update `structuredData` in the same step, the structured data is removed as well.

`Codemode` is not a default tool. It appears only after `createCodemodeTool` is assembled. The default tool name is `Codemode`. The model passes `code` (an async function body) and an optional `timeout_ms`.

- The script runs in a one-shot worker that ends when the script ends. The default timeout is 15 seconds, and a requested value is clamped to a maximum of 60 seconds. Text returned to the parent session defaults to at most 32 KiB. The worker old-generation heap defaults to 48 MiB.
- `await tools.<name>(args)` and `await callTool(name, args)` both return to the host dispatcher and still go through the permission gate. One script defaults to at most 32 nested calls. It cannot call `Codemode` again, and it cannot nest `Task`, `SpawnAgent`, `AgentFollowup`, or `AskUser`.
- `store(key, value)` / `load(key)` defaults to an in-memory table: at most 64 keys, 1 MiB in total, and key names of at most 256 characters. It does not write to disk. A diskless session service does not persist it either.

## Post-write verification

`afterRun` is not a `createSession` field. It exists only on the kernel query-loop options. With no configuration it never runs.

- `verify` is required. The context includes `mutations.mutatedFiles`, `mutations.mutatingTools`, `attempt` starting at 1, the messages at that moment, and the abort signal.
- `mutatingToolNames` defaults to `Edit` and `Write`. Only a successful write from those tools counts. An error result and a synthetic abort placeholder do not.
- The call happens before the query finishes naturally, while the session is still busy. `{ action: 'pass' }` ends it. `{ action: 'followup', prompt }` repairs inside the same query.
- `maxAttempts` defaults to 2 and is clamped from 0 to 5. Turn limits, the budget, and the abort signal also apply. Read-only work and plain questions do not trigger it.
