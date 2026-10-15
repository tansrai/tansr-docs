---
title: Add input to a running task
description: Continue the same execution without interrupting tools or opening a new session, with SDK, CLI, serve, ACP and headless examples and receipt semantics.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - sdk/lifecycle
  - getting-started/serve
sources:
  - tansr-cli:doc/INJ-同轮追加输入手册.md
  - tansr-cli:packages/kernel/src/query/session-input-delivery.ts
  - tansr-cli:packages/cli/src/headless/input-control.ts
  - tansr-cli:packages/server/src/v2/routes.ts
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

This guide covers `@tansr/sdk@0.13.0`, `@tansr/cli@0.6.0`, and `@tansr/serve@0.8.0` and later (currently 0.19.0 / 0.10.3 / 0.15.1, published 2026-10-10; the same-turn input interfaces are unchanged since then). These versions are published on npm. Mobile apps also require clients that implement capability discovery and same-turn input (see each client's integration guide). Source and documentation validation do not establish acceptance on physical mobile devices.

**`submitInput` appends user input only to the specified running turn.** It does not interrupt the active model stream or tools, create a session, or automatically start another turn when the target closes. An already-started request is unchanged. Input enters history at a safe boundary before it can be used by a subsequent model request.

## SDK: separate starting a task from adding input

Use `session.send()` to start an idle session's next task. A separate supplement action captures the current target and a stable input ID. Do not fall back to `send()` when that action fails.

```ts
import { randomUUID } from 'node:crypto';
import { createSession } from '@tansr/sdk';

const session = await createSession({ token, baseUrl });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('审阅合同并整理待确认条款');

// 由 UI 的“补充”操作调用；SDK 在 Electron 主进程/Node 宿主运行。
async function supplement(text: string) {
  const target = session.getInputTarget();
  if (target === null) return { outcome: 'closed' as const, code: 'turn_closed' };
  const request = { inputId: randomUUID(), target, content: { text }, ack: 'memory' as const };
  await retainInputDraft(request); // 宿主先保留原 ID、目标和内容；保存失败则不提交。
  const result = await session.submitInput(request);
  // 网络抛错时原 request 仍在宿主，先查询；成功时按 result 更新显示。
  return { request, result };
}

// 在后续 UI 事件或显式查询动作中，使用原 ID 与原目标。
// session.getInputStatus(request.inputId, request.target)
// 退出时另行 await session.closeAsync()，并核对其真实收尾回执。
```

The application supplies `token`, `baseUrl`, `render` and `retainInputDraft`. The latter is the host's draft-storage function, not an SDK API. It must finish before submission; a storage failure prevents sending, and a transport error must not delete the original request. Keep the event pump across turns. Do not call `createSession()`, `query()` or `interrupt()` for each supplement. The convenience `query()` event generator does not expose this session API. Low-level `runAgent()` returns a `QueryHandle` with `reserveUserInput` and related kernel capabilities; its caller owns event consumption and cleanup.

| API | Meaning |
| --- | --- |
| `inputCapabilities()` | Version 1, text/text-block and memory support, `durableAck: false`, `image: false`, target and receipt retention |
| `getInputTarget()` | `{ historyEpoch, turnId }` or `null`; never silently replace a closed target |
| `submitInput({ inputId, target, content, ack? })` | `accepted` with a receipt, or `closed` / `rejected` with a machine-readable code |
| `getInputStatus(inputId, target)` | A receipt or `null`; lookup does not replay input or tools |

Content is `{ text: 'Additional requirement' }` or `{ blocks: [{ t: 'text', text: 'First point' }, { t: 'text', text: 'Second point' }] }`. Text blocks are joined with newlines. Empty text, image mixtures and unsupported content are rejected instead of silently dropping blocks. Only `ack: 'memory'` is supported, also the default. `durable` is explicitly rejected; supplying a `SessionStore` does not make this delivery API durable.

## Receipts, retries and recovery

| Receipt state | What it establishes |
| --- | --- |
| `accepted` | Admitted in memory; not yet evidence of inclusion in model context |
| `consumed` | Applied to turn history; not proof that a request was sent, understood, or completed |
| `closed` / `cancelled` | Unconsumed input has terminated; inspect `reason` |
| `reserved` | Low-level kernel reservation; normal memory submissions commit immediately, without a durable guarantee |

Receipts include `inputId`, `sessionId`, `historyEpoch`, `turnId`, `ordinal`, `revision`, `source`, `state`, `durability: 'memory'` and optional `reason`. Ordinals preserve turn admission order; revisions change with state. An identical ID, target and normalized text returns the original receipt. Different text produces `input_conflict`. A duplicate response with outer `outcome: 'accepted'` may contain a receipt that is already `consumed` or `closed`; inspect its state.

After a transport failure, query the original ID and target, then retry exactly the same request if needed. Do not automatically generate a new ID, switch target, or use the legacy messages route. Only the current and last completed turn's receipts are retained. SDK `null` or serve **404 + `{ outcome: 'rejected', code: 'input_not_found' }`** means no matching receipt in the current retention window, possibly after expiry, restart or invalidation. It does not prove the input never ran. Do not treat every 404 as an empty receipt: existing `session_not_found` and 401/403 session/authentication errors retain their normal handling. An actual `closed` receipt and a submission's 409 closed-target result are also distinct from a missing receipt.

Explicit history replacement/restoration and runtime reconstruction create a new `historyEpoch`; ordinary compaction does not. Reconnecting a phone to the same live serve session can preserve lookup. Restarting or reconstructing serve does not revive the old running turn or guarantee its memory receipts. Keep drafts and display uncertainty; do not replay tools automatically.

## Five surfaces and three device platforms

| Surface | Entry point and boundary |
| --- | --- |
| CLI TUI | Enter during execution uses strict input. In a permission/question dialog, `Ctrl+O` focuses supplementary input. `Esc` clears the draft but keeps that focus; `Ctrl+O` explicitly returns to the dialog. Supplementary digits/Enter do not approve tools |
| SDK | The four `AgentSession` APIs above. Windows Electron keeps the session and input ID in the main process and uses IPC from the renderer; do not embed long-lived platform keys in the renderer |
| serve | The v2 routes below. Android/iOS connect to the same serve session rather than running another Node SDK/kernel |
| ACP | Negotiated private extensions. A busy ordinary `session/prompt` remains rejected; steering does not replace its pending response ID or result |
| headless | Explicit NDJSON control input. One `-p` starts one query; subsequent frames never create another query |

Legacy `send()` and serve `messages` remain available. Legacy user input arriving around natural `completed` / `structured_output` termination can carry into another turn. Hard limits or explicit abort do not automatically reopen a same-generation turn to evade budgets. Use the new APIs whenever strict same-turn behavior matters. CLI agent notifications retain their separate queue/acknowledgement rules and do not become user authorization.

## serve: keep the authenticated owner and session

Use the deployment's existing authentication. Session ownership is checked against the authenticated application/end-user domain; supplying a session ID does not grant access to another user's session.

```http
GET /v2/sessions/{sessionId}/input-capabilities
POST /v2/sessions/{sessionId}/inputs
Content-Type: application/json

{"inputId":"ui-001","target":{"historyEpoch":"FROM_CAPABILITIES","turnId":"FROM_CAPABILITIES"},"content":{"text":"请同时核对续约条款"},"ack":"memory"}
```

```http
GET /v2/sessions/{sessionId}/inputs/ui-001?historyEpoch=FROM_CAPABILITIES&turnId=FROM_CAPABILITIES
```

URL-encode path and query values. Submission returns **202 + `{ outcome: 'accepted', receipt }`**; a closed target or content conflict returns 409, injection quota 429, unsupported content/capability 422, malformed input 400. Status lookup returns 200 + `{ receipt }`, or 404 if unknown. The existing messages route's 202 keeps its old meaning and is not an input receipt. SSE keeps the existing event protocol; this batch adds no input-status SSE event. Clients refresh status through the lookup route.

Since `@tansr/serve` 0.13.0 the same three operations are also reachable on the unified call surface `/api` — `GET /api/sessions/{sessionId}/input-capabilities`, `POST /api/sessions/{sessionId}/inputs`, `GET /api/sessions/{sessionId}/inputs/{inputId}` — with identical request and 2xx response bytes; only errors switch to the unified envelope (`code` / `status` / `retryAction`, the original code in `detail.domainCode`). New integrations should use `/api`; `/v2` remains an internal adapter entry until 1.0.0 — still read-write in the current 0.15.1 with unchanged bodies and status codes, but since 0.15.0 legacy-prefix responses carry `Deprecation` / `Link` headers, and mixing prefixes within one session only logs an `api.legacy_prefix_mixed` warning without rejecting the request; keep each session on a single prefix. See [Unified API](/en/unified-api/) and [v2 protocol and webhooks](/en/serve/v2-and-webhooks/).

## ACP: negotiate the extension

Initialize normally and inspect `agentCapabilities._meta['tansr.com'].midTurnInput`. Then query `_tansr.com/session/input_capabilities` for the session. Each JSON-RPC request has its own ID:

```json
{"jsonrpc":"2.0","id":"caps","method":"_tansr.com/session/input_capabilities","params":{"sessionId":"SESSION"}}
{"jsonrpc":"2.0","id":"extra","method":"_tansr.com/session/steer","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"补充续约要求"},"ack":"memory"}}
{"jsonrpc":"2.0","id":"status","method":"_tansr.com/session/input_status","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
```

The steer RPC result carries the host outcome; status returns `{ receipt }`, with `null` for an unknown input. The original prompt retains its own terminal response. Only the original permission-response channel can authorize tools; text such as “allow” is not an approval. Do not emulate steering with concurrent ordinary prompts on servers lacking the extension.

## headless: one start, then control frames

```sh
tansr -p "审阅合同" --output-format stream-json --input-format ndjson
```

Do not combine this with `--cc-compat`, `--bg`, or aggregate `json`/`text` output. `--input-format text` retains legacy stdin text behavior. A nonempty `-p` is required; there is no stdin start frame in this batch.

Read `tansr.input.ready` from stdout and obtain `capabilities.target`. Write each following JSON object as a separate stdin line:

```json
{"v":1,"id":"a","method":"steer","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"追加要求"},"ack":"memory"}}
{"v":1,"id":"b","method":"input_status","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
{"v":1,"id":"c","method":"cancel"}
```

The third line demonstrates explicit cancellation; omit it for normal supplementation. Responses use `type: 'tansr.input.response'`, the frame ID, and a `result` containing a receipt/rejection or `cancel_requested`. Control records and kernel events share stdout; distinguish them by `type`. Exactly one original `result` ends the stream, with existing exit-code semantics.

UTF-8 chunks, LF/CRLF, and an unterminated final frame at EOF are supported. The limit is **65,536 UTF-16 code units per line**, not bytes; malformed or oversized frames produce rejection records. EOF ends control input without cancelling the query. If the query ends first, input reading stops without waiting for EOF and late frames get no responses after the final result. Drain stdout continuously. Control-response backpressure pauses input; this is not a durable queue or an end-to-end backpressure guarantee for all model events.

## Prompts, permissions and budgets

Supplementary text remains a user message. Platform prompts, SDK/serve `system` and `systemAppend` retain the current turn's snapshot. Supplementation does not refetch or reassemble them; the next new turn refreshes platform settings under the existing [prompt layering rules](/en/sdk/system-prompts/). It does not add MCP connections, skills or tools.

Consumed user intent updates adjudication and memory-selection guidance without approving pending tools. Model turns, tool rounds, input quota, elapsed-time and monetary budgets keep accumulating. Even a `consumed` input can be followed by a limit termination before another model request; render both the receipt and the turn's terminal result.
