---
title: 命令行 5 分钟跑通
description: 安装 tansr 命令行、用个人访问令牌登录平台、开始第一次交互式对话，并在无头模式下看到 NDJSON 事件流。
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
lastVerified: '2026-10-05'
---

`tansr` 是面向开发者的智能体命令行：同一个内核以交互式终端（TUI）、无头脚本（headless）、常驻服务（serve）、编辑器代理（acp）和 MCP 工具服务（mcp serve）五种形态对外提供。这一篇只走最短路径：装好、登录、聊一句、看一眼事件流。现行版本 **0.10.1**（npm `@tansr/cli`，2026-10-04 发布）。

## 前提

- Node.js ≥ 22.19。当前唯一的发布形态是 npm 包；单文件可执行版（SEA，自带 Node 运行时）尚未发布，见下文。
- Windows / macOS / Linux 都支持。Windows 下建议用 Windows Terminal；传统 conhost 会自动切到 ASCII 字形档，功能不受影响。

## 安装

```bash
npm i -g @tansr/cli
tansr --version          # 0.10.1
```

包名是 `@tansr/cli`，命令名是 `tansr`。升级同样走 `npm i -g @tansr/cli@latest`。0.10.1 起首次启动会在用户缓存目录写入约 2 MB 的 Node 编译缓存（之后同版本启动更快；`TANSR_COMPILE_CACHE=0` 关闭，见[设置与 doctor](/cli/settings-and-doctor/)）。

**单文件形态（SEA）与 OSS 分发点：尚未发布。** 截至 2026-10-05，官方分发点 `bash.tansr.com` 上没有与 0.10.x 对应的可执行文件或 `SHA256SUMS`（Windows 版已拍板暂不上架），不要把分发点当作安装来源；SEA 上架后本页再补下载与校验步骤。

## 凭据：用个人访问令牌登录

命令行走**平台模式**：登录后模型清单与价目由平台下发，你不需要手写任何 provider 配置。

1. 在控制台创建一个个人访问令牌（PAT）。
2. 运行初始化向导，按提示粘贴 PAT（掩码输入，不回显）：

```bash
tansr init
```

向导会验证身份、为本机派生一枚应用凭据、把凭据写进操作系统密钥库（不可用时降级为权限 0600 的文件并明确提示），最后展示摘要卡：账号指纹、余额、近期用量、可用模型数、派生键有效期。整个过程零模型调用，可以重复执行。

脚本或 CI 里免交互：

```bash
TANSR_PAT=<PAT> tansr init
```

注意 `tansr init --pat <PAT>` 也能直接给值，但会留在 shell 历史里，不推荐。

退出登录用 `tansr logout`：清除本机凭据并尽力停用本机派生键；你的 PAT 本身不会被吊销（其他设备可能还在用）。

## 第一个会话

直接运行 `tansr` 进入交互式终端：

```bash
tansr
```

开场会打印欢迎横幅和「基本配置摘要」（登录身份、门户地址、当前模型、上下文方案与余额）。在输入区打字回车即可对话；`@` 引用工作区文件，`/` 呼出斜杠命令。几个第一天就会用到的命令：

| 命令 | 作用 |
|---|---|
| `/help` | 列出全部命令 |
| `/status` | 版本 / 语言 / 会话 / 模型 |
| `/model` | 呼出模型选择器，或 `/model <别名>` 直接切换 |
| `/cost` `/usage` | 本会话成本与 token 用量 |
| `/doctor` | 装配态自检 |
| `/quit` | 退出 |

Esc 中断当前轮，Ctrl+T 进入全屏转录视图，Ctrl+C 同为中断。

## 看到事件

无头模式下一切都是事件。给 `-p` 一句 prompt 并加 `--json`，你会得到一行一个 JSON 的 NDJSON 事件流，流末尾恒有一条 `type: "result"` 汇总：

```bash
tansr -p "用一句话介绍这个目录" --json
```

```json
{"type":"result","reason":"completed","exitCode":0,"usage":{"inputTokens":1200,"outputTokens":300}}
```

事件包络字段是 `type` / `sessionId` / `seq` / `ts` / `v` / `source`；主要事件族有 `session.*`、`turn.*`、`msg.*`、`tool.*`、`agent.*`、`hook.*`、`cost.*`、`mcp.*`、`plan.*`。退出码语义：0 成功、1 模型或内部错误、2 中断、3 触顶（轮数 / 预算）、4 prompt 过长、5 用法错误。

用 Node 消费这条流只需几行：

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

无头模式没有询问通道：权限判定落到「询问」时一律降级为拒绝（fail-closed）。需要放权用 `--allowedTools "Shell(git *),Read"` 这类会话级规则，或 `--permission-mode` 指定初始模式。

## 常见第一坎

| 现象 | 处置 |
|---|---|
| 「TUI 需要交互式终端（TTY）」 | 你在管道里启动了 `tansr`；非交互场景用 `-p` |
| 未初始化直接启动 | 会进入空态引导卡，页内输入 `/init` 即可登录；无人值守形态则以退出码 5 退出并提示 `tansr init` |
| 余额为零 | 摘要卡会警示但不阻断；平台模型调用会被服务端计费闸拒绝，本地功能不受影响 |
| 想完全不用平台 | 设 `TANSR_ESCAPE_LOCAL=1`，并按用户手册在 `.tansr/settings.json` 配本地 provider |

## 下一步

- [设置与 doctor](/cli/settings-and-doctor/)：五层配置、常用环境变量、`tansr doctor` 各段怎么读。
- [命令与旗标参考](/cli/commands)：全部子命令与旗标。
- 想让别人也能用你的智能体？看[会话服务 5 分钟跑通](/getting-started/serve/)。命令行形态 `tansr serve --v2` 自 0.10.0 起同时装配统一调用面 `/api`（新集成走这里），`/v1` 面在 `--v2` 部署缺省关闭、过渡旗标 `--legacy-v1` 自 0.10.1 起已标废弃，详见[部署与鉴权](/serve/deploy-and-auth/)。
