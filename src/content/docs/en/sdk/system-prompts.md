---
title: Application system prompts and SDK composition
description: Configure application prompts, choose fallback or prepend, distinguish SDK system and host systemAppend from user messages, and load platform changes while preserving session history.
zone: docs
category: sdk
related:
  - getting-started/sdk
  - getting-started/serve
  - getting-started/android
  - sdk/platform-bundle
  - sdk/sessions-and-events
  - security
sources:
  - tansr-api:src/control/apps-routes.ts
  - tansr-api:src/contract/schemas.ts
  - tansr-cli:packages/sdk/src/platform/system-prompt.ts
  - tansr-cli:packages/sdk/src/platform/application-prompt-turn.ts
  - tansr-cli:packages/sdk/src/session.ts
  - tansr-cli:packages/sdk/src/query.ts
  - tansr-cli:packages/sdk/src/run-agent.ts
  - tansr-cli:packages/server/src/v2/agent-session-factory.ts
  - tansr-cli:packages/server/src/v2/platform-session-factory.ts
lastVerified: '2026-09-09'
---

This guide describes application prompt composition under development. **It does not claim that the npm packages or production platform have shipped this feature.** Deploy an API that supports these fields and use SDK / serve builds that support `systemPromptPolicy`, `systemAppend`, and `applicationPrompt` together. Older consumers may ignore the platform prompt or lack the policy; an existing package version alone is not proof of support.

Application managers maintain a shared role, response style, and business guidance in **Applications → Overview → Application system prompt**. Developers can also supply `system` in code. The platform policy decides how those sources combine.

## Where each kind of text belongs

| Text | Input | Purpose |
|---|---|---|
| Platform business prompt P | Platform `systemPrompt` | Shared application role and business guidance, editable without rebuilding the client |
| SDK business prompt S | `query` / `createSession` `system`, or serve `platform.system` | Business guidance managed with code or customized for an assembly |
| Host guidance A | `systemAppend`, or serve `platform.systemAppend` | Environment or presentation guidance appended without overriding the platform default |
| User input | `query.prompt`, `session.send()`, `/v2` `prompt` | The user's question or conversational content, always a user message |

Platform configuration suits centrally managed changes and fewer client releases. Code-supplied `system` suits code review, version control, and scenario-specific instructions. Compatible API and consumer versions load platform changes before a subsequent turn, preserving the session and its history. Code changes generally require publishing the host and can unintentionally replace a platform default. Putting the shared role on the platform and host notes in `systemAppend` avoids that accidental replacement.

Prompts enter model requests and must not contain secrets. Desktop SDKs also receive the application bundle, so a platform prompt is not confidential from the client.

## fallback / prepend truth table

P is a non-empty platform prompt; S is an explicitly supplied, non-empty SDK segment list. This table shows business segments only, before A and tool guidance.

| Platform policy | SDK `system` | P exists | No P |
|---|---|---|---|
| `fallback` (default) | Omitted / `undefined` | P | No business segments |
| `fallback` | S | S | S |
| `fallback` | `[]` | No business segments | No business segments |
| `prepend` | Omitted / `undefined` | P | No business segments |
| `prepend` | S | P → S | S |
| `prepend` | `[]` | P | No business segments |

The console checkbox **Keep the platform prompt when the SDK supplies one** selects `prepend`; turning it off selects `fallback`. A missing policy in an older bundle means `fallback`. An explicit `[]` is an intentional empty business segment list; it does not remove `systemAppend` or independently assembled tool guidance.

The full order is **policy-selected P / S → `systemAppend` → applicable tool / Skills / MCP guidance**. Those final guides depend on the entry point, capability flags, and registrations; not every entry assembles all of them. Do not manually add the same platform prompt again: the SDK does not deduplicate similar text.

This order specifies request construction. **It does not guarantee how a model resolves contradictory instructions.** `prepend` is not permission enforcement. Application managers must resolve contradictions between P and S; capability flags, tool permissions, the adjudicator, and human confirmation retain their own enforcement paths. The existing application purpose field guides the adjudicator's business-boundary decisions and does not replace the main agent's system prompt.

## Set and read platform configuration

Use an application manager's login access token for these management endpoints. An end user's `app_user` token or the application appkey is not a replacement for that management identity. Organization applications also require the target organization's `x-tansr-org` header; the API enforces write permissions.

```bash
# ACCESS_TOKEN is a manager login access token; APP_ID identifies the application.
curl --fail-with-body -X PUT "https://api.tansr.com/v1/apps/$APP_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt":"You are an order assistant. Be concise and never invent order status.","systemPromptPolicy":"prepend"}'

# Read the application detail; the fields are under config in its response.
curl --fail-with-body "https://api.tansr.com/v1/apps/$APP_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

For an organization, add `-H "x-tansr-org: $ORG_ID"` to both requests. Omit that header for a personal application.

- `systemPrompt` accepts up to 16000 Unicode characters and trims leading / trailing whitespace. `null` or whitespace-only text clears it.
- `systemPromptPolicy` accepts only `fallback` / `prepend`, defaults to `fallback`, and does not accept `null`.
- An omitted PUT field stays unchanged. Send `{"systemPromptPolicy":"prepend"}` to change only the policy, or `{"systemPrompt":null}` to clear text without resetting the policy.
- When an older API omits the prompt field, the console prevents blind writes. If only the policy field is missing, text remains editable but the policy checkbox is unavailable.

## Node / Windows Electron: assemble in the SDK host

Your backend mints the short-lived token for the signed-in user. In Windows Electron, run the SDK in the main process and expose view data and user input over IPC. Never bundle an appkey or management access token in the renderer.

For a single `query`, omit `system` to use the platform default and add host notes through `systemAppend`:

```ts
import { query } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const run = query({
  token,
  baseUrl: 'https://api.tansr.com',
  prompt: 'What information do you need before checking an order?',
  systemAppend: [{ text: 'Use plain text; do not rely on interactive web controls.' }],
  tools: { builtin: [] },
});
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
console.log(step.value.reason);
```

For multiple turns, explicitly supply `system` only when you want SDK business guidance:

```ts
import { createSession } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const session = await createSession({
  token,
  baseUrl: 'https://api.tansr.com',
  system: [{ text: 'This integration handles after-sales questions. Clarify the problem first.' }],
  systemAppend: [{ text: 'The UI supports Markdown lists but not HTML.' }],
  tools: { builtin: [] },
});
console.log(session.applicationPrompt); // source / policy only, no prompt body.
const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();
try {
  session.send('What should I prepare before returning an item?');
  await session.idle();
} finally {
  session.close();
  await pump;
}
```

`AgentSession.applicationPrompt` is a read-only source summary, such as `{ policy: 'prepend', source: 'platform+sdk' }`. Its source is `none`, `platform`, `sdk`, or `platform+sdk`. It describes P / S selection only: no prompt text, and `systemAppend` is not counted as a source. Under `fallback`, explicit `[]` has source `sdk` despite contributing no business segments. Under `prepend`, P plus explicit `[]` has source `platform`.

## Low-level runAgent: select business segments yourself

`runAgent` does not fetch a bundle or append tool, Skills, or MCP guidance; the caller provides the complete system segments through `system`. Injected `query({ client, model, ... })` also skips platform and tool-guide assembly, but appends an explicit `systemAppend` after `system`. In both paths, the caller owns platform configuration loading and refresh.

After fetching and validating configuration in a trusted host, call `resolveApplicationSystem` yourself. The complete function below receives `client` / `model` from your model adapter. Its `platform` argument must come from validated configuration or a bundle, not an unchecked client request.

The management API returns `null` for an unset prompt. Convert that with `config.systemPrompt ?? undefined` before calling the helper; a bundle already represents an absent prompt by omitting the key.

```ts
import {
  resolveApplicationSystem,
  runAgent,
  type IRSystemSegment,
  type ModelClient,
  type ResolvedModel,
  type SystemPromptPolicy,
} from '@tansr/sdk';

export async function answer(
  client: ModelClient,
  model: ResolvedModel,
  platform: { systemPrompt?: string; systemPromptPolicy?: SystemPromptPolicy },
  prompt: string,
  sdkSystem?: IRSystemSegment[],
) {
  const selected = resolveApplicationSystem(platform, sdkSystem);
  const hostGuide = [{ text: 'Keep the answer suitable for a plain-text interface.' }];
  const run = runAgent({
    client,
    model,
    prompt,
    system: [...selected.system, ...hostGuide],
    tools: [],
    maxTurns: 8,
  });
  for await (const event of run.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
  return selected.info; // Same shape as applicationPrompt; no prompt body.
}
```

`resolveApplicationSystem` only selects, copies, and concatenates segments. It performs no network request, permission check, or conflict resolution. If this low-level host needs tool guidance, assemble applicable instructions after the host notes yourself.

## Android / iOS: configure the serve host

Android and iOS are `/v2` thin clients; your `@tansr/serve` runs the main agent. `CreateSessionRequest(prompt=...)` and `session.send(...)` provide user messages. **They do not configure `system` or `systemAppend` through `/v2`.**

Omit `platform.system` for a platform-managed role and put host notes in `platform.systemAppend`. Configure `platform.system` only for code-managed business guidance; the same truth table applies.

```ts
import { createAgentSessionFactory, createServeAgentSessionStore } from '@tansr/serve';

const appId = process.env.TANSR_APP_KEY_ID;
const appKey = process.env.TANSR_APP_KEY;
if (!appId || !appKey) throw new Error('Missing server-side app credentials');

const build = createAgentSessionFactory({
  platform: {
    apiBaseUrl: 'https://api.tansr.com',
    appId,
    appKey,
    // Optional business role. Remove this property to use the platform role alone.
    system: [{ text: 'Handle mobile after-sales questions; clarify the problem first.' }],
    systemAppend: [{ text: 'Keep replies readable on a phone; use the wired interaction tools for confirmation.' }],
  },
  store: createServeAgentSessionStore({ dir: './data/sessions' }),
  cwd: process.cwd(),
});

// Wire build.factory / build.storeReader into startServer's v2 configuration.
// See the session-service quickstart for authentication and startup.
```

Continue with the [session-service quickstart](/en/getting-started/serve/) and [Android / iOS quickstart](/en/getting-started/android/). Appkeys and platform tokens remain in serve; the device uses your own application login state.

## When changes take effect

With platform integration, SDK / serve **revalidate platform `systemPrompt` and `systemPromptPolicy` before every new turn while preserving the same session and history**. An unchanged configuration can return HTTP 304 through ETag; each turn still checks, without waiting for a 60-second cache expiry. An executing turn keeps its selected configuration throughout its multi-step tool loop. Updating platform guidance does not require closing the session, clearing the conversation, or creating another session.

Foreground reconnects, SSE recovery, and attach can keep using the live session; subsequent turns still follow the platform refresh path. Resume from storage also retains history. This refresh covers platform P and policy only. Host S (`system`) and A (`systemAppend`) remain managed through code and session configuration; no new in-session S / A setter is introduced.

Existing messages and compressed summaries remain intact; they are not rewritten for the new prompt. Platform edits change the system prefix of subsequent requests and may affect prefix-cache hits and cost. The context manager also invalidates the previous token-measurement anchor and estimates the new request budget. Accumulated cost, history, attachment state, and circuit-breaker state remain intact; an unchanged configuration returned as HTTP 304 does not trigger this re-estimation. This refresh path does not also hot-update tools, permissions, models, or pricing configuration.

If refresh receives an HTTP error or invalid configuration, the turn does not call the model, persist the unexecuted user message, or update `applicationPrompt`. Previous history and source metadata remain available, so the host can invite a retry in the same session. Events report `turn.error` with `errorKind: 'application_prompt_refresh_failed'`, followed by `turn.aborted` with `reason: 'model_error'`. Do not present a failed turn as a completed reply.

Refresh preflight supports cancellation and ends the turn after a 30-second timeout; the timeout's `turn.aborted.reason` is `timeout`. A late configuration response after cancellation or timeout cannot start the model. `applicationPrompt` updates when fresh configuration is successfully selected and starts being used; after a refresh failure it still describes the previous successful selection.

This feature requires compatible SDK / serve builds; this guide does not announce a release. The presence of platform fields does not give older consumers refresh support. Acceptance should cover text edits, clearing, policy changes, HTTP 304, edits during an executing turn, refresh failures and retries, cancellation and timeout, and preservation of messages and summaries.

For diagnosis, inspect `session.applicationPrompt` source / policy, then compare the application configuration and host code. The summary confirms assembly choices, not whether a model obeys every instruction. A user's chat message saying “you are now…” is not a test of updated system configuration.
