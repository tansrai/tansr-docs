---
title: 用编程助手做产品
description: 在 Codex、Cursor 等编程助手里安装已发布的 @tansr/skill 0.1.6，用一句话描述产品，由助手完成界面、业务工具和 Tansr 接线。安装不创建账号、不调用模型、不部署应用。
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/serve
  - unified-api/clients
  - security
lastVerified: '2026-10-13'
---

Tansr Skill 是装进编程助手的开发指引，不是应用运行时里的技能，也不是 `@tansr/sdk`。你描述想做的产品，助手按这份指引完成可运行的界面、业务数据和 Tansr 接线。安装本身不创建平台账号、不调用模型、不部署应用。

已发布的安装包是 npm 上的 `@tansr/skill` **0.1.6**（2026-10-09 起 `latest` 与 `next` 都指向它）。包内有 .NET、Go、Rust、Python、C++ 的参考；公开包版本仍以本站[各语言客户端](/unified-api/clients/)为准。不要安装 `0.1.5`：它在写入前以 `INVALID_RELEASE` 退出，并已标记废弃。`0.1.4` 没有作为 `latest` 分发。

## 安装

需要 Node.js ≥ 22.19 和 npm。在准备开发产品的目录执行。下面以 Codex 的项目范围为例；换助手时只改 `--host`，换「所有项目都能用」时把 `project` 改成 `user`。

```sh
npx --yes @tansr/skill@0.1.6 hosts
npx --yes @tansr/skill@0.1.6 preview --host codex --scope project
npx --yes @tansr/skill@0.1.6 install --host codex --scope project --yes
```

先看 `preview` 要写入的路径。有冲突时安装器保留已有内容。一次只安装所选的一处。

| 助手 | `--host` | 项目目录 | 用户目录 |
|---|---|---|---|
| Codex | `codex` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |
| WorkBuddy | `workbuddy` | `.codebuddy/skills/tansr` | `~/.workbuddy/skills/tansr` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/tansr` | `~/.codebuddy/skills/tansr` |
| Claude Code | `claude-code`（别名 `claude`） | `.claude/skills/tansr` | `~/.claude/skills/tansr` |
| Cursor | `cursor` | `.cursor/skills/tansr` | `~/.cursor/skills/tansr` |
| TRAE 国内版 | `trae` | `.trae/skills/tansr` | `~/.trae-cn/skills/tansr` |
| TraeCode CLI | `trae-cli` | `.traecli/skills/tansr` | `~/.traecli/skills/tansr` |
| Qoder 国际版 | `qoder` | `.qoder/skills/tansr` | `~/.qoder/skills/tansr` |
| Qoder 国内版 | `qoder-cn` | `.lingma/skills/tansr` | `~/.lingma/skills/tansr` |
| ZCode | `zcode` | 不支持 | `~/.zcode/skills/tansr` |
| Kimi Code | `kimi` | `.kimi-code/skills/tansr` | `~/.kimi-code/skills/tansr` |
| MiniMax Code CLI | `minimax` | `.minimax/skills/tansr` | `~/.minimax/skills/tansr` |
| 千问 Qwen Code | `qwen-code` | `.qwen/skills/tansr` | `~/.qwen/skills/tansr` |
| 通用目录 | `generic` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |

`generic` 与 Codex 写到同一目录，不是「装进所有助手」。WorkBuddy 与 CodeBuddy 的项目目录相同，用户目录不同；安装器不会自动搬走旧的用户目录。ZCode 只能装用户目录。`feishu`、`yuanbao`、`doubao`、`volcengine`、`trae-global` 不执行目录安装。写入成功不等于助手已经加载；装完后在该助手里确认能读到 `SKILL.md`。

Kimi 的项目安装要从 Git 根目录执行。自定义配置根、环境变量覆盖和各助手的重载方式，以安装包里的助手说明为准。

## 描述产品

回到同一个助手，说明谁在用、输入是什么、要完成什么动作。例如：

> 使用 Tansr Skill，帮我做一个运行在 Windows 上的学习计划助手，能记录目标、安排每日任务并回顾进展。先做出能运行的第一版，并展示真实工具执行的进度和结果。

已有项目保留原来的技术栈、登录、数据库和锁文件：

> 使用 Tansr Skill，为当前订单系统加入自然语言查询，沿用原登录和数据库，保留我的现有修改。

助手应交付可运行的界面和业务结果，而不是只给一段聊天回答或 SDK 片段。一句普通需求就是有效输入，不必先写成平台或流程指令。产品需要本机后端时，先复用项目里已有的受控后端；没有时再按 Skill 内的起步资产建立 `serve` 或 token-server，接线并在本机启动。这不创建平台账号，不发起付费调用，也不等于已经部署到公网。Electron 的完整 SDK 仍在主进程。应用密钥留在服务端；不要把 `appkey` 发到聊天里。平台接入见 [Node SDK 5 分钟跑通](/getting-started/sdk/) 与 [会话服务 5 分钟跑通](/getting-started/serve/)。产品若是 .NET、Go、Rust、Python 或 C++，锁定[各语言客户端](/unified-api/clients/)里已经发布的包，不要改写成 Node，也不要用移动端的 Maven / SPM / HAR 代替它们。

## 检查、更新与卸载

把 `--host` 和 `--scope` 换成安装时的同一组：

```sh
npx --yes @tansr/skill@0.1.6 status --host codex --scope project
npx --yes @tansr/skill@0.1.6 update --host codex --scope project --yes
npx --yes @tansr/skill@0.1.6 rollback --host codex --scope project --yes
npx --yes @tansr/skill@0.1.6 uninstall --host codex --scope project --yes
```

`status` 只检查文件，不证明助手已加载。`rollback` 回到登记的前一版。卸载保留你改过的文件、其他技能，以及已经做出来的产品。上次安装中断时，先看 `status`，再按提示对同一目标执行 `recover --yes`。
