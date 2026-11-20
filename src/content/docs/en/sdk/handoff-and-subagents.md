---
title: Long sessions, handoff, and subagents
description: Open a new session that carries only what the new goal needs, keep an in-progress turn intact when context compaction runs, look up tools on demand, and run subagents in a chain, in parallel, or as residents you can redirect. The SDK 0.20.1 and CLI 0.11.0 you install today do not include these calls yet.
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

You already open multi-turn sessions with `createSession`, and you already save and resume them with [checkpoints](/en/sdk/checkpoints/). This page is the next three situations: the goal changed and you want a fresh session, the conversation is so long that an in-progress turn might get sliced apart, and you want to hand work to subagents — one after another, side by side, or as a resident you can redirect.

Check the package you actually have installed. `@tansr/sdk` 0.20.1 and CLI 0.11.0 from npm **do not include** the calls below yet. Code written from this page will not run until you upgrade to a release that contains them. The generated symbol pages are still built from the package you can install, so these names are not listed there either.

## The goal changed: hand this session off

The session you are in already has conclusions, files you changed, and a context compaction summary, but the next job is a different goal. Do not bend the old session around the new goal, and do not make the new session reread the whole history. `handoffSession` only reads the current session, writes a briefing aimed at the new goal, and opens a new session that carries that briefing and nothing else. The original session's memory, checkpoints, and files on disk stay as they are, so you can come back to it.

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

You pass the new goal in `goal`. After trimming, it must not be blank. A blank goal does not call the model. The result is `rejected` with reason `invalid_goal`.

The optional fields:

- `instructions` is an extra note for the briefing. If `signal` aborts at any step, the result is `cancelled` and no half-created session is left behind.
- `reviewDraft` lets you read the briefing before the new session exists. The callback receives the original session id, the goal, the briefing text, and the file inventory. You can replace the text and confirm, or return `{ action: 'cancel' }`. A blank replacement is `rejected` with reason `empty_briefing`.
- If you omit them, the new session id is a fresh UUID, the title is the goal text (cut at 64 characters), and the working directory is the current session's. Fields you put in `meta` are stored on the new session. `parentSessionId` and `handoffGoal` are always stored, so you can see which session handed off and what the goal was.
- Pass `client`, `model`, `store`, or `maxSummaryTokens` only when you want a different model, a different store, or a cap on the briefing. If this session was not created by the root `createSession` and no usable model is available, the result is `rejected` with reason `unsupported_session`.

These cases also skip the model call and do not create a session: the session is already closed (`session_closed`), or the current turn is still running (`turn_running`). A model that cannot be assembled is `model_resolution_failed`. A briefing that could not be written is `failed`; read `reason` and `message`. Failure to create the new session is `failed` with reason `session_create_failed`.

On success, `status` is `created`. You get both session ids, the goal, the briefing, the file inventory, and the seed message. Sometimes you also get an opened `session` and the `usage` spent on the briefing.

A session from the same `createSession` also has a non-enumerable `session.handoff(options)` that does the same thing. In types, call the exported `handoffSession`. The same exports include the seed-message tag `HANDOFF_PROVENANCE_TAG` (the value `tansr-handoff-v1`), plus `buildHandoffSeedMessage` and `readHandoffProvenance` to build and read that message.

In the CLI conversation UI, `/handoff <goal>` is the same path. If you type the command with no goal, it only shows the usage `/handoff <goal>`. It does not call the model, and it does not change the session you are looking at. After the briefing appears, Esc or Ctrl+C cancels. When you confirm, the UI switches to the new session. The original one is still on disk; open it with `/resume`.

## Branch off from an earlier point

`session.fork(checkpointId)` on the [checkpoints](/en/sdk/checkpoints/) page is unchanged: it copies a new session from a snapshot. When you want to leave from a point that was already committed, and the summary should cover only what was added after the split, use `restoreWithBranchSummary`.

- Pass only `checkpointId` and you still restore straight back along the same line.
- Pass `allowSibling: true`, or put the other history in `targetMessages`, and you switch to a sibling that shares the same origin. The summary covers only the delta after the two histories split, plus a file inventory. Cold segments from before the split are not scanned in full again.
- On success, `status` is `installed`. You get the protective checkpoint taken before the restore (`preRestoreCheckpointId`), the message counts before and after, and sometimes the split index `lcaIndex`. There is one summary message. Ordinary `session.restore` behaves as before.
- Invalid arguments are `rejected` / `invalid_options`. A session that was not created by the root entry is `unsupported_session`. Material that no longer matches is `source_invalidated`. If you cancel, the result is `cancelled`.

## The turn is not finished, and the context is full

If context compaction happens in the middle of a turn, the summary the later model sees is written as two parts: history that has already finished, and the unfinished prefix of this turn (what you asked, the actions already run, and the scene that still has to continue). A tool call and its result are not split onto opposite sides of the summary. The next compaction unwraps that wrapper first, instead of nesting the same prefix again and again.

You can start compaction earlier, but that is not the default. Add `backgroundCompactMargin` (how many tokens earlier) to the context thresholds. When usage reaches that earlier line, the request you are making still goes out immediately, and a background task summarizes the read-only snapshot from that moment. The margin must be a finite number greater than 0. `0`, a negative number, or NaN throws. Leave the field out and the behavior matches the package you use today: there is no extra watermark.

The next barrier checks that this is still the same version. If you have cleared or rewound the session, or a synchronous compaction has already moved past that snapshot, the background summary is discarded and is not inserted. When you close the session, `closeAsync()` waits for that work to finish and records the usage.

Context compaction, a branch summary, and a one-off title or classification do not write a cache marker. The main conversation will not read those helper calls back as if they were part of the transcript. Your own session requests, and a resident subagent's own turn, keep the cache behavior you already have.

Tool definitions from the first turn stay pinned as the cache prefix. Tools enabled later are appended after that prefix, so the prefix does not have to be rewritten.

## Too many tools: do not hand the model all of them

Nothing extra appears by default. Only when you pass `deferredDiscovery` at assembly time are deferred tools gathered into `ToolSearch`, and only when there are enough of them.

- `ToolSearch` is registered when the deferred candidates reach the threshold. The threshold defaults to 16. Change it with `threshold`. If more MCP servers may connect while the session is running, set `force: true` so `ToolSearch` is there even below 16.
- Below the threshold, and without force, tools you passed in are still installed as usual. That is the default of `eagerBelowThreshold` (`true`).
- When the model calls it, `query` must not be blank. It can describe the capability in a sentence, name one tool exactly, or load names with `select:tool_a,tool_b`. `limit` defaults to 5 and must be from 1 to 20. Matches are added to the set the model can call directly.
- The description sentence is fixed. Connecting or disconnecting MCP later does not paste the whole catalog into the system prompt, and it does not change that sentence.
- Each subagent has its own catalog. It cannot see tools another subagent just enabled. A real call still goes through the permission check you already configured.

## Hand the work to subagents

For one job, keep using a single `Task`: write both `prompt` and `description`. This is the only shape that accepts `run_in_background: true`, so the job can run in the background.

For several steps in order, use `chain`, from 1 to 6 steps. The next step receives the previous output through `{previous}`. The intermediate bodies are not written into this session's history. What you see at the end is the result of the whole chain.

For several jobs side by side, use `tasks`, from 1 to 8 items. `concurrency` defaults to 4 at a time, from 1 to 8. `policy` defaults to `allSettled`, which waits until every item has a result. `failFast` stops the siblings that have not finished as soon as one fails, and waits until their resources are cleaned up. `concurrency` and `policy` are valid only together with `tasks`.

The three shapes exclude each other. Pass exactly one. Each step may also carry `subagent_type`, `tools`, `model`, and `max_turns`. `max_turns` is clamped from 4 to 32.

Some subagents should stay for the rest of the session so you can send them a new instruction in the middle. At most 4 stay at once, and you can operate only on the ones you created directly. The tools the model uses to manage them are:

- `SpawnAgent`: `label` and `prompt` are required. `subagent_type` and `tools` are optional. An empty `tools` array means it only talks and does not call tools.
- `AgentFollowup`: `agent_id` and `message` are required. Omit `mode` and it is `followup`, delivered at the end of the current turn. `steer` waits until the current batch of tools finishes, then changes direction.
- `AgentControl`: `action` is `status`, `list`, `stop`, or `release`. `stop` and `release` require `agent_id`. `list`, or `status` without an id, shows the subagents that belong to this session.

`release` returns the slot. It succeeds only after that subagent has stopped, its resources are cleaned up, no report is still waiting to be delivered, and it does not still own subagents of its own. If it is still running, still cleaning up, or still owns children, you get `agent_busy`. If it was parked after repeated failures and holds no resource in flight, you can release it. Release deletes the subvolume that belonged to it.

These management tools are not given to the subagent to use on itself.

A subagent lives only in memory unless you say otherwise. To bring it back after a process restart, pass `subvolumeStore` and a `rootDir`. The file is `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json`, and the path cannot leave that parent session's directory. After 5 consecutive crashes by default (`restartLimit`, which must be a positive integer) it stays locked across restarts until you `release` the slot. A session service that does not write to disk has no such store, so it does not write the subvolume either.

## Keep many tool calls inside one short script

Dozens of intermediate results should not pile up in this session's history. After you assemble `createCodemodeTool`, the model can use `Codemode` (you can rename it) to write an async script. The script calls tools inside a one-shot isolated worker. This session receives only the final return value and a bounded log. If you do not assemble the tool, it is not there.

The model passes `code` and an optional `timeout_ms`. The default is 15 seconds, and a value you set is capped at 60 seconds. Text returned to this session defaults to at most 32 KiB. The worker's old-generation heap defaults to 48 MiB. Going over that limit stops only this worker.

`await tools.<name>(args)` and `await callTool(name, args)` inside the script both return to your existing dispatcher. Permission checks still apply. One script defaults to at most 32 such nested calls. The script cannot call `Codemode` again, and it cannot call `Task`, `SpawnAgent`, `AgentFollowup`, or `AskUser`.

`store(key, value)` / `load(key)` inside the script defaults to an in-memory table: at most 64 keys, 1 MiB in total, key names of at most 256 characters, and nothing written to disk. A session service that does not write to disk does not persist this table either.

If you declare `outputSchema` on a tool, a successful result can carry `structuredData` for your program to read. That extra data is not placed in the messages sent to the model. A failed check removes it and turns the result into a structured error. If a later hook changes the text and does not change `structuredData` in the same step, the extra data is removed too, so a redacted sentence cannot sit next to the original structured fields.

## After a file is written, run your check in the same turn

`afterRun` is not a `createSession` argument. Put it on the query-loop options. Leave it out and it never runs. Reading a file, or an ordinary question, does not trigger it either.

Only after a file-writing tool you named succeeds in this turn does your `verify` run, before the query ends and while the session is still busy. The default names are `Edit` and `Write`. Change them with `mutatingToolNames`. An error result, and a placeholder written because the turn was cancelled, do not count as a successful write.

`verify` can see the paths changed this time, which tools did it, which check this is (counting from 1), the messages at that moment, and the abort signal. Return `{ action: 'pass' }` to finish. Return `{ action: 'followup', prompt }` and the same query keeps going, using your prompt to repair. `maxAttempts` defaults to 2. A larger number is clamped to 5. `0` records the write and does not repair. Turn limits, the budget, and the abort signal still apply.
