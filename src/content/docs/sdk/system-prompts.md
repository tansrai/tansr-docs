---
title: 应用系统提示词与 SDK 拼接策略
description: 配置应用默认提示词，选择 fallback 或 prepend，区分 SDK system、宿主 systemAppend 与普通用户消息，并在保留历史的会话中加载后续平台更新。
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

本文对应开发中的应用提示词与拼接策略功能，**不代表 npm 包或线上平台已发布**。使用前需部署支持该字段的 API，并使用同时支持 `systemPromptPolicy`、`systemAppend` 与 `applicationPrompt` 的 SDK / serve 构建；旧版本可能忽略平台段或不支持策略。不要仅凭包名或既有版本号判断支持情况。

应用管理员可以在控制台「应用 → 概览 → 应用系统提示词」集中维护角色、回答风格和业务指引。开发者也可以在 SDK 中传入 `system`。两种来源可以独立使用，或由平台设置选择拼接。

## 三种文本放在哪里

| 文本 | 入口 | 用途 |
|---|---|---|
| 应用业务提示词 P | 平台 `systemPrompt` | 全应用共用的角色、业务说明；修改无需重新打包客户端 |
| SDK 业务提示词 S | `query` / `createSession` 的 `system`，或 serve 的 `platform.system` | 随代码管理、需要本次装配定制的业务指引 |
| 宿主附加指南 A | `systemAppend`，或 serve 的 `platform.systemAppend` | 运行环境、呈现方式等附加说明；不触发平台默认覆盖 |
| 普通用户输入 | `query.prompt`、`session.send()`、`/v2` 请求的 `prompt` | 本轮问题与对话内容，始终是用户消息 |

平台适合运营统一修改、减少客户端发布；SDK 传入适合代码审查、版本管理和按场景构造。平台修改需要 API 与消费端配套，由会话在后续新一轮开始前加载，不要求丢弃历史或重新建会；SDK 写入通常需要发布代码，也可能意外覆盖平台默认。共享角色放平台、宿主说明放 `systemAppend`，能减少这种误覆盖。

提示词会进入模型请求，不应用于保管密钥；桌面 SDK 还会接收到应用 bundle，不能把平台提示词当作对客户端保密的内容。

## fallback / prepend 真值表

P 表示非空平台提示词，S 表示 SDK 显式传入的非空段列表。表内只列业务段，不含后续 A 与工具指南。

| 平台策略 | SDK `system` | P 存在 | P 不存在 |
|---|---|---|---|
| `fallback`（默认） | 未传 / `undefined` | P | 无业务段 |
| `fallback` | S | S | S |
| `fallback` | `[]` | 无业务段 | 无业务段 |
| `prepend` | 未传 / `undefined` | P | 无业务段 |
| `prepend` | S | P → S | S |
| `prepend` | `[]` | P | 无业务段 |

控制台勾选「SDK 传入时保留平台提示词」即 `prepend`，关闭即 `fallback`。旧 bundle 缺少策略时按 `fallback` 处理。`[]` 表示明确传入空业务段，含义随策略不同；它不会移除 `systemAppend` 或独立装配的工具指南。

完整顺序是：**策略选出的 P / S → `systemAppend` → 适用的工具 / Skills / MCP 指南**。后者是否在场取决于入口、能力位及注册项；并非每种入口都会装配所有指南。不要自己再次拼入同一份平台段，SDK 不按相似文本去重。

顺序只定义请求如何组装，**不保证模型会如何裁决相互矛盾的指令**。`prepend` 不是权限强制；应用管理员应消除 P 与 S 的矛盾，能力位、工具权限、裁决人与人工确认仍由各自机制执行。已有「应用用途」供裁决人判断业务边界，也不能替代主智能体的系统提示词。

## 设置与读取平台配置

这是应用管理接口，使用拥有该应用管理权限的登录访问令牌。它不是面向终端的 `app_user` 令牌接口，也不使用 appkey 代替管理身份。组织应用还要携带目标组织的 `x-tansr-org`，写权限由 API 校验。

```bash
# ACCESS_TOKEN 为应用管理者的登录访问令牌；APP_ID 为应用标识。
curl --fail-with-body -X PUT "https://api.tansr.com/v1/apps/$APP_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt":"你是订单助手。回答简洁，不编造订单状态。","systemPromptPolicy":"prepend"}'

# 读取走应用详情，字段位于响应的 config 内。
curl --fail-with-body "https://api.tansr.com/v1/apps/$APP_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

组织请求在上述两条命令中都增加 `-H "x-tansr-org: $ORG_ID"`。个人请求不带该头。

- `systemPrompt` 最多 16000 个 Unicode 字符，首尾空白去除；`null` 或纯空白文本清空。
- `systemPromptPolicy` 只接受 `fallback` / `prepend`，缺省 `fallback`，不接受 `null`。
- PUT 中某字段缺席表示保留该字段。仅切策略可传 `{"systemPromptPolicy":"prepend"}`；清空文本可传 `{"systemPrompt":null}`，不会重置策略。
- 旧 API 不返回提示词字段时，控制台禁止盲写；只缺策略字段时，文本仍可编辑，但策略开关不可用。

## Node / Windows Electron：SDK 主进程装配

以下令牌由你的后端为已登录用户换发。Windows Electron 在主进程运行 SDK，通过 IPC 向 renderer 提供视图和输入通道；不要把 appkey 或管理访问令牌打包进 renderer。

单轮 `query`，省略 `system` 使用平台默认，只追加宿主说明：

```ts
import { query } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const run = query({
  token,
  baseUrl: 'https://api.tansr.com',
  prompt: '查询订单前，需要我提供什么信息？',
  systemAppend: [{ text: '输出纯文本，避免依赖网页交互控件。' }],
  tools: { builtin: [] },
});
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
console.log(step.value.reason);
```

多轮 `createSession`，需要 SDK 自定义业务段时显式传入 `system`：

```ts
import { createSession } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const session = await createSession({
  token,
  baseUrl: 'https://api.tansr.com',
  system: [{ text: '本次接入面向售后咨询，请先确认用户的问题。' }],
  systemAppend: [{ text: '界面支持 Markdown 列表，不支持 HTML。' }],
  tools: { builtin: [] },
});
console.log(session.applicationPrompt); // 只有 source / policy，没有提示词正文。
const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();
try {
  session.send('退货前需要准备什么？');
  await session.idle();
} finally {
  session.close();
  await pump;
}
```

`AgentSession.applicationPrompt` 是只读来源摘要，形如 `{ policy: 'prepend', source: 'platform+sdk' }`。`source` 可为 `none` / `platform` / `sdk` / `platform+sdk`，只描述 P / S 的来源选择，不包含正文，也不把 `systemAppend` 计入来源。`fallback` 下显式 `[]` 的来源为 `sdk`，即使业务段为空；`prepend` 下 P 存在且 SDK 为 `[]` 时来源为 `platform`。

## 低阶 runAgent：手动选择业务段

`runAgent` 不拉 bundle，也不自动追加工具、Skills 或 MCP 指南，由调用方通过 `system` 提供完整系统段。注入档 `query({ client, model, ... })` 同样不装配平台配置或工具指南，但会将显式 `systemAppend` 接在 `system` 后。两者都需要调用方自行管理平台配置的读取与刷新。

如果你已在可信宿主中取得并验证应用配置，可以显式调用 `resolveApplicationSystem` 再交给低阶入口。下面是完整函数；`client` / `model` 由你的模型适配层提供，`platform` 来自已验证的配置或 bundle，不直接信任终端提交的值。

管理 API 的未配置正文是 `null`，传入辅助函数前使用 `config.systemPrompt ?? undefined` 转为缺席；bundle 本身以缺键表示没有正文。

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
  const hostGuide = [{ text: '回答须适合纯文本界面。' }];
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
  return selected.info; // 与 applicationPrompt 同形，不含正文。
}
```

`resolveApplicationSystem` 只选择、复制与拼接段，不读取网络、不校验业务权限、不解决文本冲突。调用方若要工具指南，还需自行在宿主指南之后装配适用内容。

## Android / iOS：在 serve 宿主设置

Android / iOS 是 `/v2` 薄客户端，主智能体运行在你的 `@tansr/serve`。移动端调用 `CreateSessionRequest(prompt=...)`、`session.send(...)` 发送普通用户消息，**不经 `/v2` 设置 `system` 或 `systemAppend`**。

使用平台统一角色时省略 `platform.system`；宿主说明放在 `platform.systemAppend`。需要代码管理的业务角色时才配置 `platform.system`，它遵循同一张真值表。

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
    // 可选业务段；不需要宿主覆盖/拼接业务角色时删除这一项。
    system: [{ text: '面向移动端售后咨询，先澄清问题再回答。' }],
    systemAppend: [{ text: '回复适合手机屏幕；需用户确认时使用已接入的交互工具。' }],
  },
  store: createServeAgentSessionStore({ dir: './data/sessions' }),
  cwd: process.cwd(),
});

// 将 build.factory / build.storeReader 接到 startServer 的 v2 配置。
// 完整 authenticate 与启动示例见“会话服务 5 分钟跑通”。
```

见[会话服务快速入门](/getting-started/serve/)和[Android / iOS 快速入门](/getting-started/android/)。appkey 与平台短期令牌留在 serve；设备只使用你的业务登录态。

## 修改后何时生效

使用平台接入模式时，SDK / serve 在**每个新一轮开始前核验平台 `systemPrompt` 与 `systemPromptPolicy`，保留同一会话和历史**。配置未变时可通过 ETag 得到 304；每轮仍会核验，无需等待 60 秒缓存到期。正在执行的轮次继续使用该轮已选定的配置，不在多步工具循环中途替换。无需关闭会话、清空聊天记录或创建新会话来取得更新。

手机回前台、SSE 重连和 attach 可以继续使用现存会话；后续轮次仍走平台刷新路径。从存储 resume 也保留已有历史。这里刷新的是平台 P 和 policy，宿主的 S（`system`）与 A（`systemAppend`）仍由代码和会话配置管理，不新增会话内修改 S / A 的接口。

旧的消息和压缩摘要会保留，不会按新提示词重写。平台提示词变化会改变后续请求的系统前缀，可能影响前缀缓存命中与成本；上下文管理器也会使旧 token 测量锚失效，按新请求重新估算预算。累计费用、历史、附件状态和熔断状态保持；无配置变化的 304 不触发这项重估。这条刷新路径不同时热更新工具、权限、模型或资费配置。

如果刷新遇到 HTTP 错误或无效配置，本轮不调用模型，不把这次尚未执行的用户消息写入持久历史，也不更新 `applicationPrompt`。已有历史和此前的来源摘要保留，宿主可提示用户在原会话重发。事件先报告 `turn.error`（`errorKind: 'application_prompt_refresh_failed'`），再报告 `turn.aborted`（`reason: 'model_error'`）。不要在收到失败事件后自行显示成成功回复。

刷新预检支持取消，并在 30 秒超时后结束本轮；超时的 `turn.aborted.reason` 为 `timeout`。取消或超时后迟到的配置响应不会启动模型。`applicationPrompt` 在成功选定并开始使用新配置后更新；刷新失败时读取它仍是上次成功的来源摘要。

此功能需要兼容的 SDK / serve 构建，本文不表示已发布；旧版本不能因平台字段存在就自动具备刷新能力。验收应覆盖平台文本变更、清空、策略切换、304、运行中改配置、刷新失败与重试、取消与超时，以及刷新前后消息和摘要保持。

排查时先核对 `session.applicationPrompt` 的 source / policy，再核对平台应用配置与宿主代码；该摘要只确认装配来源，不保证模型回答符合全部指令。不要用聊天框里的“你现在是……”来验证系统配置是否已更新。
