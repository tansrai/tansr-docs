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
  - serve/deploy-and-auth
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/report/REL-SEA-发行执行单-2026-10-05.md
lastVerified: '2026-10-13'
---

`tansr` is the developer-facing agent CLI: one kernel offered in five forms — interactive terminal (TUI), headless scripts, a long-running service (serve), an editor agent (acp) and an MCP tool service (mcp serve). This article takes the shortest path only: install, sign in, say one thing, glance at the event stream. Current version: **0.10.3** (npm `@tansr/cli`, released 2026-10-10; 0.10.2 / 0.10.3 only inline a newer `@tansr/serve` — commands, flags and the ACP surface are the same as 0.10.1).

## Prerequisites

- Node.js ≥ 22.19 (npm package form). The single-file executable (SEA, bundling its own Node runtime) is currently available for Linux x64 / arm64 only — see below.
- Windows / macOS / Linux are all supported. On Windows, Windows Terminal is recommended; the legacy conhost automatically switches to the ASCII glyph set, with no loss of functionality.

## Install

```bash
npm i -g @tansr/cli
tansr --version          # 0.10.3
```

The package is `@tansr/cli`; the command is `tansr`. Upgrades go through `npm i -g @tansr/cli@latest` as well. Since 0.10.1 the first start of each installed version writes about 2 MB of Node compile cache into the user cache directory (later starts of the same version are faster; `TANSR_COMPILE_CACHE=0` disables it, see [Settings and doctor](/en/cli/settings-and-doctor/)).

**Single-file form (SEA): two Linux builds are live.** Since 2026-10-05 the `stable` channel of the official distribution point `https://bash.tansr.com` serves `tansr-sea-linux-x64` and `tansr-sea-linux-arm64` (glibc ≥ 2.28), currently 0.10.3 (2026-10-10, built from the same source as the npm package). The Windows build stays off the shelf until a code-signing certificate is in place, the macOS build is waiting for an Apple Developer certificate and notarization, and musl / alpine is outside the SEA commitment — use the npm package on those platforms. Installation is a three-step "download → verify → place" script; download and review it before running:

```bash
curl -fsSLO https://bash.tansr.com/install.sh
sh install.sh            # 可选参数 stable|beta;缺省落位 ~/.local/bin/tansr
```

The script compares the measured hash against the channel's `SHA256SUMS` and deletes the file and refuses to install on a mismatch; `TANSR_INSTALL_DIR` / `TANSR_CHANNEL` can override the defaults. After a SEA install, `tansr update` (it only installs with `--install`) reads the signed envelope `release/{channel}/sea/latest.signed.json` from the distribution point by default, verifies it with the built-in public key (`release-signing-v1`) and then compares versions; `tansr update` on an npm install queries the npm registry and does not use this channel.

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
- Want others to use your agent too? See [Session service in 5 minutes](/en/getting-started/serve/). The CLI form `tansr serve --v2` also mounts the unified call surface `/api` since 0.10.0 (new integrations go there); with `--v2` the `/v1` surface is off by default and the escape hatch `--legacy-v1` is deprecated since 0.10.1; since 0.10.2 the environment variable `TANSR_SERVE_LEGACY_PREFIX` (default `readwrite`, unchanged in 0.10.3) controls the retirement window of the legacy `/v2` and `/v3/*` prefixes — see [Deployment and authentication](/en/serve/deploy-and-auth/).
