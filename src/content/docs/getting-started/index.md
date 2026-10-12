---
title: 快速开始：选一条路，5 分钟跑通
description: tansr 有六种接入方式——Node SDK、命令行、自托管会话服务、Android、iOS 与鸿蒙。这一页帮你判断该从哪一篇开始，并说明六条路共用的账号与凭据模型。
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/cli
  - getting-started/serve
  - getting-started/android
  - getting-started/harmony
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-12'
---

tansr 是一套智能体运行时：同一个内核（查询环、工具调度、权限引擎、上下文压缩）以几种不同的形态对外提供。你不需要全部了解，只要按「我要把智能体放在哪里跑」选一条路即可。中立桥梁、Harness、Skill 与运行时的分工、当前两步，以及尚未提供的规划，写在[技术立场](/getting-started/principles/)；给编程助手采集的同一份条文在 [`/llms.txt`](/llms.txt)。首页只在页尾放折叠入口。

## 先回答一个问题：智能体跑在哪里？

| 你的情形 | 推荐入口 | 对应文章 |
|---|---|---|
| 我想在终端里直接和智能体对话、改代码、跑脚本 | `tansr` 命令行 | [命令行 5 分钟跑通](/getting-started/cli/) |
| 我在写 Node.js / Electron 程序，想把智能体嵌进自己的进程 | `@tansr/sdk` | [Node SDK 5 分钟跑通](/getting-started/sdk/) |
| 我要给自己的移动端或 Web 用户提供智能体，需要一个多用户的后端服务 | `@tansr/serve` 自托管会话服务 | [会话服务 5 分钟跑通](/getting-started/serve/) |
| 我在写 Android App，后端已经（或准备）用 `@tansr/serve` | Kotlin SDK `com.tansr.sdk`（0.4.0） | [Android 与 iOS 5 分钟跑通](/getting-started/android/) |
| 我在写 iOS / macOS App，后端同上 | Swift 二进制包 `tansr-ios-spm`（0.3.0） | 同上一篇的「iOS 同法」一节 |
| 我在写原生 HarmonyOS App，后端同上 | ArkTS HAR `@tansr/harmony` | [鸿蒙 SDK 5 分钟跑通](/getting-started/harmony/) |

两条经验法则：

- **单人使用选命令行，给别人用选 SDK 或会话服务。** 命令行是给开发者自己的；SDK 和会话服务是给你的产品用户的。
- **移动端永远经过你自己的服务端。** Android / iOS / 鸿蒙 SDK 是薄协议客户端，不直接持有任何平台凭据；智能体内核跑在你部署的 `@tansr/serve` 里。兼容 Android 的旧鸿蒙设备继续用 Android SDK。

## 六条路共用的账号模型

不论走哪条路，凭据都分三层，越往下越不能外泄：

1. **个人访问令牌（PAT）**：你在控制台创建，只给 `tansr init` 登录本机命令行用。它代表你本人。
2. **应用密钥（appid / appkey）**：你在控制台为一个「应用」签发。appkey 只能放在你的服务端（Node 进程或 `@tansr/serve`），用来为你的终端用户换取短期令牌。**appkey 永远不下发到终端设备、不写日志、不进版本库。**
3. **短期 app_user 令牌**：由你的服务端用 appkey 换出，交给终端（Electron 主进程、或由 `@tansr/serve` 内部持有）。到期即失效，泄露的影响面被 TTL 限住。

命令行用户只需要第 1 层；SDK 与会话服务开发者需要第 2、3 层。详细的放置与轮换建议见[安全与隐私](/security/)。

## 每一篇快速开始都是同一个骨架

五篇形态文章（Android 与 iOS 合为一篇，鸿蒙单独一篇）按同一顺序展开，便于你在不同形态之间对照：

1. **前提**：运行环境与版本要求（Node ≥ 22.19 是共同基线）。
2. **安装**：`npm i -g @tansr/cli`、`npm install @tansr/sdk`、`npm install @tansr/serve`，或 Maven / SwiftPM / 独立发布 HAR 坐标。
3. **凭据**：该形态需要哪一层凭据，从哪里拿。
4. **第一个会话**：最短的可运行代码。
5. **看到事件**：智能体的一切输出都是事件流（`msg.text.delta`、`tool.completed` 等），这一步让你亲眼看到它。
6. **下一步**：指向对应的深入指南。

## 运行环境速查

| 形态 | 最低要求 |
|---|---|
| 命令行（npm 包） | Node.js ≥ 22.19；Windows / macOS / Linux。单文件可执行版（SEA）尚未发布，当前只有 npm 包 |
| `@tansr/sdk` | Node.js ≥ 22.19;Electron ≥ 39;ESM only;TypeScript target ≥ ES2022 |
| `@tansr/serve` | Node.js ≥ 22.19；唯一第三方运行时依赖是 `zod` |
| Android SDK | minSdk 26；Kotlin 协程 + kotlinx.serialization + OkHttp |
| iOS SDK | iOS 16+ / macOS 13+;SwiftPM |
| HarmonyOS SDK | HarmonyOS 6.0 / API 20；Stage 模型；独立发布 HAR `@tansr/harmony` 0.1.0 |

## 一次跑通后，接下来看什么

| 你关心的 | 去哪里 |
|---|---|
| 会话怎么持久化、断线怎么恢复 | [检查点与恢复](/sdk/checkpoints/)(SDK)· [v2 协议与 webhook](/serve/v2-and-webhooks/)（会话服务） |
| 平台给我的应用下发了什么能力、怎么在控制台开关 | [平台装配与 bundle](/sdk/platform-bundle/) |
| 某个错误码是什么意思、能不能重试 | [错误处理与重试](/sdk/errors-and-retries/) · [错误码表](/errors/codes) |
| 服务端怎么部署、怎么优雅关闭、多副本怎么分片 | [部署与鉴权](/serve/deploy-and-auth/) |
| 我想直接调会话服务的 HTTP 接口（`/api`），或自己写一个客户端 | [统一 API 合同（/api）](/unified-api/) |
| 我想让编程助手按我的描述做出可运行的产品 | `@tansr/skill` 0.1.6 | [用编程助手做产品](/getting-started/skill/) |
| 这些形态为什么这样分、两步和规划分别意味着什么 | [技术立场](/getting-started/principles/) |
| SDK 2.0 的扩展入口（归档宿主、缓存宿主、统一 API）哪些已正式发布 | [SDK 2.0 扩展入口](/sdk/sdk2-preview/) |
| 会话保留多久、什么时候被回收 | [保留期与治理](/serve/retention-and-governance/) |
| 命令行配置文件在哪、`tansr doctor` 输出怎么读 | [设置与 doctor](/cli/settings-and-doctor/) |
| 数据存在哪、密钥怎么轮换、出网去了哪 | [安全与隐私](/security/) |

## 遇到问题

- 命令行侧先跑 `tansr doctor`，它是零网络的装配自检；读法见[排障指南](/support/troubleshooting/)。
- 所有错误都有稳定的机器码，可在[错误码表](/errors/codes)按码查含义。
- 账号、密钥、套餐问题见[账号与计费](/support/account/)；仍未解决可[联系支持](/support/contact/)。
