---
title: Context and subagents on the main line
description: Context and subagent behavior implemented on the tansr-cli main line and not yet recorded in a CHANGELOG version — session handoff, compaction, cache, tool discovery, Task orchestration, Codemode, and post-write verification. The published SDK 0.20.1 and CLI 0.11.0 do not include it.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

The behavior below is already on the `tansr-cli` main line and **is not yet recorded in the CHANGELOG of any published release**. `@tansr/sdk` 0.20.1 and CLI 0.11.0 on npm do not include it. Do not call it until you upgrade to a package that contains these changes.

## Session handoff

A session from `createSession` can hand off toward a new goal with `handoffSession(session, options)`. It reads the source session only (the latest compaction summary, the retained tail of history, and the paired file inventory), writes a briefing for the new goal, and creates a new session that carries a single seed message. The new session records `parentSessionId`. The source session is not rewritten and can still be resumed.

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

- `goal` is required and must not be blank. `reviewDraft` may replace the briefing text, or return `{ action: 'cancel' }`. Cancel, rejection, and failure do not leave a new session behind.
- Sessions created by the same factory also have a non-enumerable `session.handoff(options)` with the same behavior. Call the exported function from types.
- The same export surface also includes `HANDOFF_PROVENANCE_TAG` (the seed-message tag `tansr-handoff-v1`), `buildHandoffSeedMessage`, and `readHandoffProvenance`. Generated SDK symbol pages still follow the published 0.20.1 and do not list these names.
- The CLI interactive UI adds `/handoff <goal>`. An empty goal only prints usage: no model call, and the current session is unchanged. After you confirm, the UI switches to the new session. The original stays on disk and `/resume` can open it again.

## Fork from a committed node

Besides `fork` from a snapshot, the main line can branch from any committed node. The summary covers only the delta that left the original branch, plus a file inventory. Cold segments before the fork point are not scanned in full.

## Compaction

When compaction fires in the middle of a turn, the summary is written as two parts: history that has already finished, and the unfinished prefix of the current turn (the original request, actions already run, and the state still to continue). A tool call and its result are not split across the summary boundary. A later compaction unwraps the previous wrapper first, so the same prefix is not nested again and again.

Background pre-compaction is not the default. Only when `backgroundCompactMargin` is set, reaching the earlier watermark still sends the main request immediately, and a background task summarizes a read-only snapshot. The next barrier checks that the generation and the materials still match. If the session was cleared, rewound, or already compacted past that snapshot, the background summary is discarded. `closeAsync()` waits for it to settle and records the usage.

One-shot auxiliary requests (compaction, branch summaries, a one-off title or classification) no longer write cache markers. Main-session requests and the main turn of a resident subagent keep the previous cache policy.

The tool definitions from the first turn are pinned as the cache prefix. Tools activated later are appended after that prefix, so the whole prefix does not have to be invalidated.

## Deferred tool discovery

When deferred tool candidates reach 16, or when you force it on, a `ToolSearch` tool is registered. Its description text stays fixed: connecting or disconnecting MCP later does not change that sentence. The model searches, then activates tools. Each subagent keeps its own catalog and cannot see tools another subagent activated. Real execution still goes through the existing permission gate.

## Task and resident subagents

At most 4 resident subagents run at once. A slot can be released only after that subagent has stopped and its cleanup has finished. A parent session can operate only on subagents it created directly. An in-flight turn can `steer` onto a new direction after the current tool batch, or queue a `followup`. The model-facing controls are `status`, `list`, `stop`, and `release`.

`Task` still accepts a single task. Two further shapes are mutually exclusive:

- `chain`: 1 to 6 steps. The next step receives the previous output through `{previous}`. Intermediate bodies are not written into the parent session history.
- `tasks`: 1 to 8 items in parallel. `concurrency` defaults to 4 and caps at 8. `policy` is `allSettled` or `failFast`. On `failFast` or parent cancellation, unfinished siblings are stopped and resources are waited out.

A resident subagent can write its subvolume to a directory you name explicitly, and warm-resume from that subvolume after a process restart. After 5 consecutive crashes by default it stays locked across restarts until that slot is `release`d. The diskless session service does not write this subvolume to disk.

## Codemode and structured results

A tool may declare an optional `outputSchema`. A successful result may carry `structuredData`. That data is not placed into the messages sent to the model. If a later hook changes the text and does not update `structuredData` to match, the structured data is removed.

`Codemode` is not a default tool; it appears only after you assemble it. The script runs in its own worker, with a hard cap on time and memory. `tools.<name>()` inside the script still goes through the host permission gate. The script's own state is not written to disk.

## Post-write verification

`afterRun` is not a `createSession` field. It exists only on the kernel query-loop options. With no configuration it never runs. Your `verify` is called before the query finishes, while the session is still busy, and only after a configured file-writing tool (by default `Edit` and `Write`) has written successfully in this turn. `{ action: 'pass' }` ends it. `{ action: 'followup', prompt }` repairs inside the same query, at most 2 times by default and never more than 5, and still bounded by turns, budget, and the cancel signal. Read-only turns and plain questions do not trigger it.
