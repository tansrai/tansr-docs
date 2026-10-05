---
title: Node SDK 5 分钟跑通
description: 在自己的 Node.js 或 Electron 程序里嵌入 tansr 智能体——安装 @tansr/sdk、拿到令牌、创建第一个会话并打印事件流。
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - sdk/sessions-and-events
  - sdk/platform-bundle
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/sdk-0.18.1.md
lastVerified: '2026-10-05'
---

`@tansr/sdk` 是 tansr 内核的 headless 语言绑定：prompt 进、事件流出，零 UI 依赖。查询环、工具调度、权限引擎、上下文压缩全部来自内核并已编译内联，你拿到的是与 `tansr` 命令行同一套运行时，以库的形态嵌进你的应用。本文按 `@tansr/sdk` **0.18.1**（2026-10-04 发布）核对；进程内 `createSession` 的用法自 0.13.0 以来未变。

## 应用提示词从哪里设置

平台应用的 `systemPrompt` 用于共享角色，SDK 的 `system` 用于代码管理的业务段；默认 `fallback` 下显式 `system`（包括 `[]`）替代平台段。平台选择 `prepend` 后先保留平台段，再追加 SDK 段，`[]` 也保留平台段。宿主环境说明放 `systemAppend`，不触发默认覆盖。

Windows Electron 仍由主进程运行 SDK，renderer 发送的是用户输入。应用提示词及策略功能自 `@tansr/sdk` 0.13.0 起提供（平台侧已于 2026-09-14 上线）；可通过只读 `session.applicationPrompt` 核对来源与策略，不会返回正文。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；原会话与历史保留，无需重开。完整真值表、平台 PUT / GET 与可运行示例见[应用系统提示词](/sdk/system-prompts/)。

## 前提

任务运行中需要补充要求时，使用 [同轮追加输入](/sdk/midturn-input/) 的 `getInputTarget` / `submitInput` 与回执查询；无需中断当前执行或新建会话。首期仅 memory 文本，自 `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 / 命令行 0.6.0 起提供。

| 要求 | 值 |
|---|---|
| Node.js | ≥ 22.19 |
| Electron（如适用） | ≥ 39，SDK 运行在主进程 |
| 模块制式 | ESM only（`"type": "module"`；不支持 CJS `require()`） |
| TypeScript | target ≥ ES2022；Electron 项目建议 `skipLibCheck: true` |

发布产物是单文件 ESM bundle 加单文件 `.d.ts`。第三方运行时依赖只有 `undici`、`zod`、`zod-to-json-schema`；可选依赖 `@vscode/ripgrep` 装不上会自动降级，无需处理。

## 安装

```bash
npm install @tansr/sdk        # 现行 0.18.1
```

0.18.0 起包内另有子入口 `@tansr/sdk/extensions`（归档宿主 / 缓存宿主）与 9 处可选签名加法，全部是加法——本文的根入口用法与行为不变，不用它们就不必读。要把智能体放到服务端、让 Android / iOS / 鸿蒙或 `@tansr/api-client` 这类薄客户端经 HTTP 接入，走 [`@tansr/serve`](/getting-started/serve/)，新集成用统一调用面 `/api`。

## 凭据：三档模型来源，选一档

SDK 从哪里拿模型，决定你需要什么凭据：

| 档 | 传什么 | 适用 |
|---|---|---|
| **令牌档** | `{ token, baseUrl }` | 终端分发（Electron / 桌面）；模型目录与能力位由平台按应用配置下发，本地零配置 |
| **托管档（BYOK）** | `model: '别名'` + 本地 `.tansr/settings.json` | 自己的服务器 / 脚本，自带模型 API key |
| **注入档** | `{ client, model }` 成对 | 测试（脚本化模型）或自定义接入 |

三档互斥，混用会在装配期以 `invalid_options` 拒绝。本文以**令牌档**为例，因为它是把智能体交给终端用户时的正确形态。

令牌档的凭据流是「三方闭环」：

1. 你在控制台创建一个**桌面应用**（或服务端应用），拿到 `appid` 与 `appkey`。appkey 只放在你的服务端。
2. 终端应用用自家登录态请求你的服务端；你的服务端以 appkey 调用 `POST /v1/app-tokens`，为该用户换一枚短期 `app_user` 令牌（`ttlSeconds` 60–86400），只把 `{ token, expiresAt }` 下发终端。
3. 终端应用把这枚令牌交给 SDK。

官方样板 `examples/token-server` 演示了换发端点的完整写法（含请求签名）。**appkey 永远不出你的服务端**——不下发终端、不打日志、不进错误响应、不进版本库。

如果你只是在自己机器上做个脚本，也可以先用托管档：在 `.tansr/settings.json` 里声明 provider（API key 只写环境变量名，值走环境变量），然后 `createSession({ model: 'main' })`。

## 第一个会话

```ts
import { createSession } from '@tansr/sdk';

// token 由你的服务端换发;baseUrl 是平台网关地址
const session = await createSession({ token, baseUrl: 'https://api.tansr.com' });

session.send('帮我总结这份合同');

for await (const event of session.events) {
  if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  if (event.type === 'turn.completed') break;
}

session.close();
```

要点：

- `createSession` 是 async，恒 `await`。
- `send()` 在空闲时起新一轮；运行中再次 `send()` 会经内核注入屏障并入当前轮，输入不丢。
- `events` 是跨轮连续、`seq` 单调的 `AsyncIterable<KernelEvent>`，支持多个消费者同时 `for await`，各得全量。
- `close()` 幂等；不调 `close()` 的话 `for await` 不会自然退出——这是最常见的「事件流卡住」原因。

## 看到事件

事件是平铺的 discriminated union，直接按 `event.type` 分支。第一次跑通时建议把类型全部打印出来，感受一轮里发生了什么：

```ts
for await (const event of session.events) {
  console.log(event.seq, event.type);
}
```

你会看到大致这样的序列：`session.created` → `turn.started` → 若干 `msg.block.start` / `msg.text.delta` / `msg.block.end` →（如有工具调用）`tool.proposed` / `tool.permission.decided` / `tool.started` / `tool.completed` → `cost.usage.updated` → `turn.completed`。

如果你要做 UI，不要手拼事件：用 `createSessionView` 把事件流归约成不可变的视图快照，再用 `createNarrator` 生成人类可读的日志行。两者都随包提供。

## 常见第一坎

| 现象 | 原因与处置 |
|---|---|
| 抛 `invalid_options` | 三档字段混用，或令牌档传了 `config` / `capabilities`（令牌档能力位恒由平台治理）。读消息改代码 |
| 抛 `assembly_failed` | 托管档配置不可用、别名解析失败，或令牌档 bundle 拉取失败；`cause` 保留底层错误 |
| 工具全被拒 | 没接 `permission.askUser` 且工具非只读——缺省 fail-closed。见[会话与事件流](/sdk/sessions-and-events/) |
| 事件流不退出 | 忘了 `session.close()` |

## 下一步

- [会话与事件流](/sdk/sessions-and-events/)：多轮语义、事件族、SessionView 投影。
- [检查点与恢复](/sdk/checkpoints/)：持久化、跨重启恢复、手动压缩与快照。
- [平台装配与 bundle](/sdk/platform-bundle/)：能力位、工具三环、令牌档下发了什么。
- [错误处理与重试](/sdk/errors-and-retries/):SDK 错误码、平台错误码、什么该重试什么不该。
- [SDK 2.0 扩展入口](/sdk/sdk2-preview/)：0.18.x 已发布的 `@tansr/sdk/extensions`、`@tansr/serve/extensions` 与统一调用面 `/api` 的发布状态、边界与性能披露；进程内集成无需迁移。
