---
title: CLI in 5 minutes
description: 'Install the tansr CLI, sign in to the platform with a personal access token, start your first interactive conversation, and see the NDJSON event stream in headless mode.'
zone: docs
category: getting-started
related:
  - cli/settings-and-doctor
  - cli/commands
  - support/troubleshooting
  - support/account
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-09-09'
---

`tansr` is the developer-facing agent CLI: one kernel offered in five forms — interactive terminal (TUI), headless scripts, a long-running service (serve), an editor agent (acp) and an MCP tool service (mcp serve). This article takes the shortest path only: install, sign in, say one thing, glance at the event stream.

## Prerequisites

- Node.js ≥ 22.19 (npm package form). The single-file executable (SEA) bundles its own Node runtime, nothing to preinstall.
- Windows / macOS / Linux are all supported. On Windows, Windows Terminal is recommended; the legacy conhost automatically switches to the ASCII glyph set, with no loss of functionality.

## Install

npm form (recommended):

```bash
npm i -g @tansr/cli
tansr --version
```

The package is `@tansr/cli`; the command is `tansr`.

Single-file form: download the executable for your platform from the official distribution point (named like `tansr-sea-win32-x64.exe`), verify it against `SHA256SUMS`, and put it on your PATH:

```text
https://bash.tansr.com/release/stable/tansr-sea-win32-x64.exe
https://bash.tansr.com/release/stable/SHA256SUMS
```

## Credentials: sign in with a personal access token

The CLI runs in **platform mode**: once signed in, the model list and price list are pushed by the platform; you never hand-write provider config.

1. Create a personal access token (PAT) in the console.
2. Run the init wizard and paste the PAT when prompted (masked input, not echoed):

```bash
tansr init
```

The wizard verifies your identity, derives an app credential for this machine, writes it to the OS keychain (falling back to a file with mode 0600 and telling you so when the keychain is unavailable), and finally shows a summary card: account fingerprint, balance, recent usage, number of available models, derived-key expiry. The whole process makes zero model calls and can be repeated.

Non-interactive, for scripts or CI:

```bash
TANSR_PAT=<PAT> tansr init
```

Note that `tansr init --pat <PAT>` also works, but leaves the value in your shell history and is not recommended.

Sign out with `tansr logout`: it clears the local credential and does its best to deactivate this machine's derived key; your PAT itself is not revoked (other devices may still be using it).

## First session

Run `tansr` on its own to enter the interactive terminal:

```bash
tansr
```

It opens with a welcome banner and a "basic configuration summary" (signed-in identity, portal address, current model, context scheme and balance). Type in the input area and press Enter to chat; `@` references workspace files, `/` opens slash commands. A few commands you will use on day one:

| Command | Purpose |
|---|---|
| `/help` | List all commands |
| `/status` | Version / language / session / model |
| `/model` | Open the model picker, or `/model <alias>` to switch directly |
| `/cost` `/usage` | Cost and token usage of this session |
| `/doctor` | Assembly self-check |
| `/quit` | Exit |

Esc interrupts the current turn, Ctrl+T opens the full-screen transcript view, Ctrl+C also interrupts.

## See the events

In headless mode everything is an event. Give `-p` a prompt and add `--json`, and you get an NDJSON event stream — one JSON object per line — always ending with a `type: "result"` summary:

```bash
tansr -p "用一句话介绍这个目录" --json
```

```json
{"type":"result","reason":"completed","exitCode":0,"usage":{"inputTokens":1200,"outputTokens":300}}
```

The event envelope fields are `type` / `sessionId` / `seq` / `ts` / `v` / `source`; the main event families are `session.*`, `turn.*`, `msg.*`, `tool.*`, `agent.*`, `hook.*`, `cost.*`, `mcp.*`, `plan.*`. Exit codes: 0 success, 1 model or internal error, 2 interrupted, 3 limit reached (turns / budget), 4 prompt too long, 5 usage error.

Consuming the stream from Node takes a few lines:

```js
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';

const child = spawn('tansr', ['-p', '总结本仓库', '--json'], { stdio: ['ignore', 'pipe', 'inherit'] });
for await (const line of createInterface({ input: child.stdout })) {
  const ev = JSON.parse(line);
  if (ev.type === 'msg.text.delta') process.stdout.write(ev.text);
  if (ev.type === 'result') console.log('\n退出码:', ev.exitCode, '原因:', ev.reason);
}
```

Headless mode has no prompt channel: whenever a permission decision lands on "ask", it degrades to deny (fail-closed). To grant, use session-level rules like `--allowedTools "Shell(git *),Read"`, or `--permission-mode` to set the initial mode.

## Common first hurdles

| Symptom | Fix |
|---|---|
| "The TUI needs an interactive terminal (TTY)" | You started `tansr` inside a pipe; use `-p` for non-interactive runs |
| Started without initializing | You land on an empty-state onboarding card; type `/init` there to sign in. Unattended forms exit with code 5 and point you to `tansr init` |
| Balance is zero | The summary card warns but does not block; platform model calls are rejected by the server-side billing gate, local features are unaffected |
| I do not want the platform at all | Set `TANSR_ESCAPE_LOCAL=1` and configure a local provider in `.tansr/settings.json` as described in the user manual |

## Next steps

- [Settings and doctor](/en/cli/settings-and-doctor/): the five config layers, common environment variables, how to read each section of `tansr doctor`.
- [Commands and flags reference](/cli/commands): every subcommand and flag.
- Want others to use your agent too? See [Session service in 5 minutes](/en/getting-started/serve/).
