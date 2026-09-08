---
title: 帮助中心
description: 按主题分组的常见问题——上手与安装、账号与密钥、套餐与计费、会话与数据、报错与排障、开发者接入；以及三个入口：账号与计费、排障指南、联系支持。
zone: support
category: support
related:
  - support/account
  - support/troubleshooting
  - support/contact
  - getting-started
  - errors/codes
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/README.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-08'
---

这里是 tansr 帮助中心。开发者文档区讲「怎么用」，这里回答「我遇到了什么、该找谁」。先在下面的分组里找你的问题；找不到就走底部三个入口。

## 三个入口

| 你要解决的 | 去哪里 |
|---|---|
| 登录不上、密钥丢了、余额与套餐、发票 | [账号与计费](/support/account/) |
| 报错了、`tansr doctor` 输出看不懂、某个错误码什么意思 | [排障指南](/support/troubleshooting/) |
| 以上都没解决，或想反馈问题 | [联系支持](/support/contact/) |

## 上手与安装

**我该从哪一篇开始？** 看你要把智能体放在哪里跑：终端里自己用选命令行；嵌进 Node / Electron 程序选 SDK；给自己的用户提供智能体选会话服务；移动端经会话服务接 Android / iOS SDK。选路表在[快速开始](/getting-started/)。

**需要什么运行环境？** 命令行 npm 包与两个 npm 库都要 Node.js ≥ 22.19；单文件可执行版自带运行时。Android minSdk 26；iOS 16+。

**`npm i -g @tansr/cli` 之后命令叫什么？** 包名 `@tansr/cli`，命令名 `tansr`。`tansr --version` 确认安装。

**如何更新？** `tansr update` 检查，加 `--install` 才安装；TUI 内 `/update`。启动期恒不自动检查；组织可用 `TANSR_UPDATE_PINNED_VERSION` 锁版本。

**我不想用平台，只想自带模型 key 可以吗？** 可以：设 `TANSR_ESCAPE_LOCAL=1` 进完全本地模式，在 `.tansr/settings.json` 里声明 provider（API key 只写环境变量名）。平台功能（远端模型、用量、余额）整体停用。

## 账号与密钥

**PAT、应用密钥、终端令牌有什么区别？** PAT 代表你本人，只给 `tansr init` 登录本机用；应用密钥（appid / appkey）代表你的应用，只放服务端；终端令牌是服务端用 appkey 为某个用户换出的短期凭据。详见[账号与计费](/support/account/)与[安全与隐私](/security/)。

**`tansr init` 提示 PAT 无效或过期怎么办？** 到控制台重新创建一枚 PAT，`tansr init --fresh` 重新登录。

**换了电脑要重新登录吗？** 要。每台设备各持自己的派生键，重跑 `tansr init` 即可；旧设备的键不受影响，可在控制台停用。

**`tansr logout` 会吊销我的 PAT 吗？** 不会。它只清本机凭据并停用本机派生键；PAT 由你在控制台自管。

## 套餐与计费

**个人用命令行要付套餐费吗？** 不用。个人档无套餐费，模型按牌价从余额扣；`tansr doctor` 显示「套餐：个人（仅 CLI，无套餐费）」不是故障。

**余额在哪看？** `tansr init` 摘要卡、TUI 状态栏（低于 1 元转为恒可见警示）、控制台。余额耗尽后平台模型调用被计费闸拒绝，本地功能不受影响。

**为什么新会话报 429 而旧会话还能用？** 套餐并发达帽（`plan_concurrency_exceeded`）只拒**新**会话，运行中的不断；30 秒后再试或升级套餐。详见[账号与计费](/support/account/)。

**一次调用花了多少钱？** TUI `/cost` 按模型分行汇总；`/usage` 看 token 明细；`/context` 看钱花在上下文的哪一段。

## 会话与数据

**会话存在哪？会被上传吗？** 命令行会话落在本机 `~/.tansr`（登录后按账号隔离）；平台不存终端会话内容，只计量。详见[安全与隐私](/security/)。

**怎么恢复上次的会话？** TUI `tansr --resume` 弹选择器，或 `/resume`；脚本 `--resume <id>` / `--continue`。

**会话目录越来越大怎么清？** `tansr sessions prune`（缺省只列清单，`--apply` 才删；今日与使用中会话恒不删）。

**上下文满了会怎样？** 轮间按水位自动压缩；也可 `/compact`。压缩摘要尾部附压缩前完整转录的路径，细节可回查。

**我想导出一次对话。** `tansr sessions export <id> [--format md|json] [--out 路径]`，密钥自动脱敏。

## 报错与排障

**第一步做什么？** `tansr doctor`。它零网络地把配置、模型解析、凭据落点、平台模式归因、套餐、媒体工具来源打印出来；退出码 1 才是阻断。读法见[排障指南](/support/troubleshooting/)。

**错误码在哪查？** [错误码表](/errors/codes)列全部机器码、HTTP 状态与可否重试。

**「未配置模型 provider」但我已经登录了。** 看 `tansr doctor` 的 `localProviders` 段：平台模式下本地 providers 缺省被剪枝，这是预期；或者你处在逃生态。

**模型说它没有图像 / 语音工具。** 看 `tansr doctor` 的媒体工具行：`none` 通常是管理员尚未为账套开对应媒体池，或本机还没拉到新配置（重启一次会话）。

**权限总是被拒。** 无头 / 服务形态没有询问通道，「询问」一律降级拒绝；用 `--allowedTools` 或 `--permission-mode` 放权，并配环境隔离。SDK 侧要接 `permission.askUser`。

## 开发者接入

**SDK 三档模型来源该选哪一档？** 终端分发选令牌档 `{ token, baseUrl }`；自己的服务器脚本选托管档 `model: '别名'`；测试选注入档。三档互斥。

**会话服务不接 store 会怎样？** 进程一重启全部活跃会话上下文灭失，`resume` 恒 `409 resume_unavailable`。生产恒接。

**移动端断网了会话会丢吗？** 不会。SDK 以 `Last-Event-ID` 重连、gap 时从 `/history` 重建、服务端重启后从 store resume，三级恢复链全自动。

**推送唤醒要接什么？** 会话服务只留 webhook 缝，推送通道（FCM / APNs / 厂商）由你自接。见[v2 协议与 webhook](/serve/v2-and-webhooks/)。

**appkey 泄露了怎么办？** 立刻到控制台轮换，更新服务端环境变量并重启；旧 appkey 即时失效。

## 还没解决？

带上 `tansr doctor` 的输出（它不含密钥值）和遇到的错误码，去[联系支持](/support/contact/)。
