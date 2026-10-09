---
title: Build a product with a coding assistant
description: Install the published @tansr/skill 0.1.3 into Codex, Cursor, or another coding assistant, describe the product in one request, and let the assistant build the interface, business tools, and Tansr wiring. Installation does not create an account, call a model, or deploy an app.
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/serve
  - unified-api/clients
  - security
lastVerified: '2026-10-09'
---

Tansr Skill is development guidance installed into a coding assistant. It is not a runtime skill inside your app, and it is not `@tansr/sdk`. You describe the product; the assistant follows that guidance to produce a runnable interface, business data, and Tansr wiring. Installation does not create a platform account, call a model, or deploy an app.

The published package on npm is `@tansr/skill` **0.1.3** (`latest` and `next` both point at it). Source on the main branch later added a reference for .NET, Go, Rust, Python, and C++. **That page is not in the 0.1.3 package.** Choose a language from [Clients by language](/en/unified-api/clients/) on this site. Do not install the unpublished `0.1.4` workspace version.

## Install

You need Node.js ≥ 22.19 and npm. Run the commands in the directory where you will build the product. The example uses Codex at project scope. Change only `--host` for another assistant. Change `project` to `user` when the skill should be available in every project.

```sh
npx --yes @tansr/skill@0.1.3 hosts
npx --yes @tansr/skill@0.1.3 preview --host codex --scope project
npx --yes @tansr/skill@0.1.3 install --host codex --scope project --yes
```

Read the path from `preview` before installing. On a conflict, the installer keeps the existing content. Install only the one location you selected.

| Assistant | `--host` | Project directory | User directory |
|---|---|---|---|
| Codex | `codex` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |
| WorkBuddy | `workbuddy` | `.codebuddy/skills/tansr` | `~/.workbuddy/skills/tansr` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/tansr` | `~/.codebuddy/skills/tansr` |
| Claude Code | `claude-code` (alias `claude`) | `.claude/skills/tansr` | `~/.claude/skills/tansr` |
| Cursor | `cursor` | `.cursor/skills/tansr` | `~/.cursor/skills/tansr` |
| TRAE (China) | `trae` | `.trae/skills/tansr` | `~/.trae-cn/skills/tansr` |
| TraeCode CLI | `trae-cli` | `.traecli/skills/tansr` | `~/.traecli/skills/tansr` |
| Qoder (international) | `qoder` | `.qoder/skills/tansr` | `~/.qoder/skills/tansr` |
| Qoder (China) | `qoder-cn` | `.lingma/skills/tansr` | `~/.lingma/skills/tansr` |
| ZCode | `zcode` | not supported | `~/.zcode/skills/tansr` |
| Kimi Code | `kimi` | `.kimi-code/skills/tansr` | `~/.kimi-code/skills/tansr` |
| MiniMax Code CLI | `minimax` | `.minimax/skills/tansr` | `~/.minimax/skills/tansr` |
| Qwen Code | `qwen-code` | `.qwen/skills/tansr` | `~/.qwen/skills/tansr` |
| Generic directory | `generic` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |

`generic` writes the same directory as Codex. It does not install the skill into every assistant. WorkBuddy and CodeBuddy share the project directory and use different user directories. Version 0.1.3 does not move an older user directory for you. ZCode accepts only the user directory. `feishu`, `yuanbao`, `doubao`, `volcengine`, and `trae-global` do not perform a directory install. A successful write does not mean the assistant has loaded the skill. After installing, confirm in that assistant that it can read `SKILL.md`.

For Kimi, run a project install from the Git root. Custom config roots, environment overrides, and how to reload each assistant are in the assistant notes shipped inside the package.

## Describe the product

Return to the same assistant. Say who uses it, what the input is, and what action should finish. For example:

> Use Tansr Skill to build a study-plan assistant for Windows that records goals, schedules daily tasks, and reviews progress. Ship a runnable first version and show the progress and result of a real tool run.

Keep the existing stack, login, database, and lockfile when the project already exists:

> Use Tansr Skill to add natural-language order lookup to this system. Keep the current login, database, and my existing edits.

The assistant should deliver a runnable interface and a business result, not only a chat reply or an SDK snippet. Keep the app key on the server. Do not paste an `appkey` into chat. Platform wiring is in [Node SDK in 5 minutes](/en/getting-started/sdk/) and [Session service in 5 minutes](/en/getting-started/serve/). For a .NET, Go, Rust, Python, or C++ product, pin a package that [Clients by language](/en/unified-api/clients/) already lists as released. Do not rewrite that product as Node, and do not substitute a mobile Maven, SPM, or HAR package.

## Check, update, and uninstall

Use the same `--host` and `--scope` you installed with:

```sh
npx --yes @tansr/skill@0.1.3 status --host codex --scope project
npx --yes @tansr/skill@0.1.3 update --host codex --scope project --yes
npx --yes @tansr/skill@0.1.3 rollback --host codex --scope project --yes
npx --yes @tansr/skill@0.1.3 uninstall --host codex --scope project --yes
```

`status` checks files only. It does not prove the assistant loaded the skill. `rollback` returns to the recorded previous version. Uninstall keeps files you changed, other skills, and the product you already built. If an install was interrupted, read `status` first, then run `recover --yes` for that same target.
