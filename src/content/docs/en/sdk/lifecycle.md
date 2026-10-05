---
title: Close sessions and await resource cleanup
description: Handle shutdown, timeouts and retries with closeAsync, drain and MCP completion evidence across Electron and mobile serve clients.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - getting-started/sdk
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
lastVerified: '2026-10-05'
---

This guide covers `@tansr/sdk@0.13.0` and later (currently 0.18.1, published 2026-10-04) with `@tansr/serve@0.8.0` and later (currently 0.14.0), all published on npm; anything marked "since 0.14.0" requires `@tansr/sdk` 0.14.0 (published 2026-09-14) or newer. Releases 0.15.0 through 0.18.1 changed neither the signatures nor the behaviour of the cleanup interfaces on this page. A terminal event and completed resource cleanup are separate milestones. The interfaces below require these compatible releases.

| Operation | Contract |
| --- | --- |
| `idle()`, `close()`, `session.ended` | Existing business lifecycle; does not prove storage or resource completion |
| `session.drain(options?)` | Observe current queries, idle operations, commits and cleanup without closing an open session |
| `session.closeAsync(options?)` | Close logically, then wait within the same observation budget |
| `drain({ force: true })` / `closeAsync({ force: true })` | **Since 0.14.0**: once the budget is exhausted, release the settlement barrier and free owned resources directly, so a misbehaving adapter can no longer hang cleanup forever; the result is always `status: 'failed'` |
| `host.dispose()` | Close an application-owned MCP host after all borrowing sessions have finished |

```ts
const session = await createSession({ token, baseUrl, store });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('整理这次工作记录');
await session.idle();
const result = await session.closeAsync({ timeoutMs: 30_000, flushStore: true });
await pump;
if (result.status !== 'completed') {
  showCleanupState(result.status, result.pending, result.failureCount);
  // 保留 session，稍后继续：await session.drain({ timeoutMs: 30_000 });
}
```

The status is `completed`, `failed`, `timeout` or `cancelled`. Pending counts identify unfinished phases. `failures` is a bounded diagnostic window; `failureCount` and `omittedFailures` retain cumulative counts. Original causes can contain sensitive information: do not send them directly to logs, browsers or Electron renderers.

The default observation budget is 30 seconds. Zero reads the current state; explicit Infinity is for a host-managed completion chain. A timeout or signal ends only that observation, leaving the underlying work and other waiters intact. Store flushing is opt-in; the SDK never closes a borrowed store. Explicit `retryPersistence: true` retries the latest complete history commit without replaying application callbacks. Recovered failures remain visible with `recovered: true`. Never await the same session's drain inside its history callback.

**`force` (since `@tansr/sdk` 0.14.0)**: by default `drain()` only observes and never frees owned resources, so a misbehaving storage or MCP adapter (`settle()` returning `pending > 0`, or timing out) can hang cleanup indefinitely. `drain({ force: true })`, `closeAsync({ force: true })` and the single-turn `cleanup.drain({ force: true })` release the barrier once the budget is exhausted, record `query_settlement_forced` / `compaction_settlement_forced` for settlements still in flight, then free owned resources directly (the session-level MCP host's `close` is called) and wait for completion within the same budget; the result is always `status: 'failed'` with structured failures. It has no effect on a session that is still open — call `close()` first, or use `closeAsync({ force: true })`. Since the same version, a failed `query()` settlement (`SdkLifecycleError`) now carries `error.result` (the completed `QueryResult`; `onLifecycleError` receives it too), so callers that need the final text read `error.result?.finalText`.

## Before deleting or moving session storage

A single `store.get(sessionId)` waits only for operations already submitted to that store. While an earlier `onHistoryCommit` callback is still running, a later turn may remain in the session commit queue. A read can therefore return older history even after `idle()` and the event stream have ended.

Before deleting or moving a session-owned directory, or rebuilding from its final stored history, call `closeAsync({ timeoutMs: 30_000, flushStore: true })` and check for `status === 'completed'`. Keep the session and directory after a timeout, cancellation or failure so that cleanup can continue or the failure can be handled. For shared storage, check every user before the host manages the shared store; one session receipt does not establish that the entire directory has no remaining writers.

## Query cleanup and error ownership

Breaking from query still aborts the query and observes cleanup within `cleanupTimeoutMs`. If the consumer itself throws, JavaScript may preserve that original exception. Keep `onLifecycleError` as the separate cleanup error channel.

```ts
let cleanup;
for await (const event of query({ token, baseUrl, prompt: '总结目录',
  cleanupTimeoutMs: 30_000,
  onLifecycleError(error) { cleanup = error.cleanup; showFailure(error.code); },
})) {
  render(event);
  if (userStopped()) break;
}
if (cleanup) showCleanupReceipt(await cleanup.drain({ timeoutMs: 30_000 }));
```

Managed and token query options now accept explicit skills and MCP configuration, using the same capability checks and ownership rules as createSession. Omitting extensions does not read skill directories. The injected-client tier does not silently assemble extensions.

## MCP and platform boundaries

Inline MCP servers belong to the query or session. An explicitly supplied McpHost is borrowed: await all users before disposing it. Pending and successful repeated disposal calls share one Promise; an explicit retry after a confirmed failure handles only resources not yet confirmed closed.

Completion evidence distinguishes `transport-completion` from a third-party `connector-close-promise`. Built-in stdio waits for its local child and streams. HTTP waits for local in-flight streams and attempts DELETE; it does not prove that a remote server process exited. Neither level proves cleanup of arbitrary unregistered descendants.

The Electron demo retains unfinished sessions and the shared host. Its bounded outer observation offers another wait after a timeout; only an explicit user choice forces exit. Android and iOS keep their existing serve protocol: disconnecting or reconnecting does not delete a session, and DELETE or session.ended is not operating-system completion evidence. The Node host drains with the existing budget, awaits server.settleResources, then closes shared resources.

CLI, ACP and headless add a 10-second MCP observation cap while preserving existing protocol and termination policies. Built-in Task and continuable agents transfer nested query receipts into their parent resource scope. TUI also awaits its background Task, memory extraction, consolidation, promotion and selector owners. Serve and ACP retain memory owners in the session cleanup chain after removal from the active list. Custom background work must be connected explicitly. Non-cooperative third-party tools may remain pending; no receipt certifies arbitrary unregistered child processes.

## Shutdown order for SDK 2.0 extension hosts (since 0.18.0)

If you opted into `@tansr/sdk/extensions` (`createNodeArchiveHost` / `createNodeCacheHost`, shipped in `@tansr/sdk` 0.18.0 on 2026-10-02), the host sits on top of the sessions on this page and is torn down after them: close or drain every session opened through the host first, then remove cache entries you no longer need with `cacheHost.delete({ sessionId, authorization })`, and only then call the host's `dispose()`. `dispose()` releases resources; it does not save anything, does not confirm unknown results, does not delete archives or cache entries, and does not close a `SessionStore` that you passed in — the borrowed store stays yours. In-process sessions that never touched the extension entry are unaffected. See [SDK 2.0 extension entries](/en/sdk/sdk2-preview/).
