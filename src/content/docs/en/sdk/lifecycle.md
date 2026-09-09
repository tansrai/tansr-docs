---
title: Close sessions and await resource cleanup
description: Handle shutdown, timeouts and retries with closeAsync, drain and MCP completion evidence across Electron and mobile serve clients.
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - getting-started/sdk
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-09-10'
---

These additive APIs describe the current development source and require compatible SDK and serve releases. A terminal event and completed resource cleanup are separate milestones.

| Operation | Contract |
| --- | --- |
| `idle()`, `close()`, `session.ended` | Existing business lifecycle; does not prove storage or resource completion |
| `session.drain(options?)` | Observe current queries, idle operations, commits and cleanup without closing an open session |
| `session.closeAsync(options?)` | Close logically, then wait within the same observation budget |
| `host.dispose()` | Close an application-owned MCP host after all borrowing sessions have finished |

```ts
const session = await createSession({ token, baseUrl, store });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('Summarize this work session.');
await session.idle();
const result = await session.closeAsync({ timeoutMs: 30_000, flushStore: true });
await pump;
if (result.status !== 'completed') {
  showCleanupState(result.status, result.pending, result.failureCount);
  // Keep the session. Later: await session.drain({ timeoutMs: 30_000 });
}
```

The status is `completed`, `failed`, `timeout` or `cancelled`. Pending counts identify unfinished phases. `failures` is a bounded diagnostic window; `failureCount` and `omittedFailures` retain cumulative counts. Original causes can contain sensitive information: do not send them directly to logs, browsers or Electron renderers.

The default observation budget is 30 seconds. Zero reads the current state; explicit Infinity is for a host-managed completion chain. A timeout or signal ends only that observation, leaving the underlying work and other waiters intact. Store flushing is opt-in; the SDK never closes a borrowed store. Explicit `retryPersistence: true` retries the latest complete history commit without replaying application callbacks. Recovered failures remain visible with `recovered: true`. Never await the same session's drain inside its history callback.

## Query cleanup and error ownership

Breaking from query still aborts the query and observes cleanup within `cleanupTimeoutMs`. If the consumer itself throws, JavaScript may preserve that original exception. Keep `onLifecycleError` as the separate cleanup error channel.

```ts
let cleanup;
for await (const event of query({ token, baseUrl, prompt: 'Summarize the directory.',
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
