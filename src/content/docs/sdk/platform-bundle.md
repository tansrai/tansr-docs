---
title: 平台装配与 bundle
description: 令牌档下发了什么——应用配置束（bundle）里的模型目录、能力位、媒体授权集与套餐投影；工具三环怎么选；能力位关了会发生什么；以及 onPlatformWarning 通报了什么。
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - getting-started/sdk
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

令牌档的核心承诺是**本地零配置**：模型目录、能力位、媒体授权集、套餐状态都由平台按「应用」配置成一份 bundle，SDK 使用令牌读取它，并在装配期完成裁剪。不同字段有各自的生效边界：应用提示词与策略在每轮开始前核验，不能据此推断其他配置也会在同一会话中热更新。这一篇讲 bundle 里有什么、工具怎么选、位关了会怎样。版本基线：`@tansr/sdk` 0.19.0 / `@tansr/serve` 0.15.1（均已于 2026-10-10 发布）。

## 应用系统提示词也是装配配置

`systemPrompt` / `systemPromptPolicy` 由应用配置进入 bundle（`@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线）。默认 `fallback` 在 SDK 未传 `system` 时使用平台段；`prepend` 即使 SDK 显式传 `[]` 也保留平台段，再接 SDK 非空业务段。宿主 `systemAppend` 排在所选业务段后，不触发覆盖；其后才是该入口实际装配的工具、Skills 或 MCP 指南。

这两项在后续新一轮前刷新，当前执行轮保持已选配置；不会清空历史，也不要求重开会话。通过 `session.applicationPrompt` 查看只读来源 / 策略摘要，不含正文。完整表格、管理 API 与冲突处理边界见[应用系统提示词](/sdk/system-prompts/)。

## 先在控制台建对应用类型

创建应用时先选平台类型，它决定「能力与配额」页可配的位与缺省档，并随 bundle 的 `app.platform` 下发：

| 类型 | 适用 | 能力面 |
|---|---|---|
| 桌面应用 | Electron 等，SDK 进程内形态 | 全部工具位与平台位可配 |
| 移动应用 | Android / iOS / 鸿蒙，经你的 `@tansr/serve` 会话服务 | 文件 / 命令族固定关；公网工具 WebFetch / Http / WebSearch 按位开启，缺省关（见下文[移动应用的公网工具](#移动应用的公网工具)） |
| 服务端应用 | Node 后端嵌本 SDK | 能力面同桌面 |

把**移动应用**的凭据拿到本 SDK 进程内装配不会失败，但文件族等位已按拓扑归一为关，并收到平台提示帧 `app_platform_mismatch`。请为每种接入形态各建一个应用：一应用一平台，多端多 appid，分吊销面、分用量归因。

移动应用另可经平台 `PATCH /v1/apps/:id`（携 `x-tansr-client-features: bound-device-v1`）配置 `execution: { version: 'bound-device-v1', boundDevice: { tools } }` 段，为会话服务的 SDK 2.0 显式执行档授予绑定设备上的工具。`@tansr/sdk` 0.18.0 起 `AppCapabilitiesSchema` 认得该段并原样保留，但**进程内 SDK 不消费它**：设备工具授权只在 `@tansr/serve` 的 SDK2 执行档生效，旧应用类型与旧 `tools` 位不推导设备授权，缺位 = 未授权、绝不合并回进程内 `tools`。见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。

## 工具三环：一个 `tools` 入口

```ts
await createSession({
  token, baseUrl,
  tools: {
    builtin: ['read', 'glob', 'grep', 'imageGen'], // 环 2:内置工具(本地工具跑在终端用户机器)
    custom:  [searchOrders],                        // 环 1:defineTool 业务函数(你的代码)
  },
});
```

- `tools` 整个缺席 = 装配能力位放行的**全部本地**内置工具（媒体四名恒不在缺省全集）。
- `tools: { builtin: [] }` = 零内置，纯自定义工具场景，最小暴露面。
- `builtin` 词表 16 名：`read` `write` `edit` `glob` `grep` `list` `shell` `todoWrite` `askUser` `webFetch` `webSearch` `http` + 媒体四名 `imageGen` `videoGen` `speechToText` `textToSpeech`。
- 词表外名字 → `invalid_options`；位关而显式选择 → `capability_disabled`，消息含控制台修复指引。**恒 fail-fast 可读错，恒不静默缺工具。**
- 媒体四名是计费工具，定义进每次 prompt 有 token 成本，**缺省全集恒不装**，要用必须显式列在 `builtin`。
- `tools.platform` 保留为兼容别名（deprecated），与 `builtin` 同名四值等价；别名在场时每次装配出一条 `tools_platform_deprecated` 结构化告警。新写法请用 `builtin`。

媒体四工具本身是内核的系统工具，平台负责的是授权模型、凭据与计量；能力位字段仍叫 `capabilities.platform`，这只是授权位的名字，不代表另有一类「平台工具」。工具产物（图片 / 视频 / 转写 / 语音卡）也不等于支持原生实时音视频消息：`sendBlocks` 只接受文本与图片，`audio` / `video` 原生块在写入历史、调用模型之前就返回 `invalid_blocks`；录音转写与朗读按钮请走独立的音频直连接口。

环 1 的 `defineTool` 是「注册即说明书」：一次声明同时产出模型可见 schema 与人读文档，JSON 参数表与 zod 双档。MCP 外接用 `createMcpHost({ servers })`（应用级共享）或 `mcp: { servers }`（会话级），配置与业界 `mcpServers` 同形。skills 用 `defineSkill` 内联或 `dirs` 目录装载，恒不扫用户目录。

## 能力位：工具位与平台位

能力位回答「这个应用有没有该能力」，在控制台按应用配置，经 bundle 下发，SDK 装配期裁剪（合约面）+ 网关硬校验（平台资源强制面）。**令牌档能力位恒由 bundle 供给**，选项传 `capabilities` 会被拒；托管 / 注入档可传 `capabilities` 自管。

平台缺省档（保守）：

| 位 | 缺省 | | 位 | 缺省 |
|---|---|---|---|---|
| `tools.read` | 开 | | `tools.http` | 关 |
| `tools.write` | **关** | | `tools.todoWrite` | 开 |
| `tools.edit` | **关** | | `tools.askUser` | 开 |
| `tools.glob` | 开 | | `tools.agent`（Task 子代理族） | 关 |
| `tools.grep` | 开 | | `tools.skills` | 关 |
| `tools.list` | 开 | | `tools.mcp` | 关 |
| `tools.shell` | **关** | | `tools.customTools`（环 1 总开关） | 开 |
| `tools.process`（预留） | 关 | | `platform.imageGen` | 关 |
| `tools.webFetch` | 关 | | `platform.videoGen` | 关 |
| `tools.webSearch` | 关 | | `platform.webSearch` | 关 |

平台位另有 `platform.speechToText` / `platform.textToSpeech`（缺省关），以上五个是聊天会话会消费的平台位。`@tansr/sdk` 0.19.0 起 `AppCapabilitiesSchema` 再认六个可选平台位 `platform.embedding` / `rerank` / `document` / `music` / `voiceCreate` / `realtimeAudio`，共十一位：它们只授权对应的独立非聊天 HTTP 操作（经 `createPlatformNonchatClient` 显式调用），**不装配任何聊天工具、不进会话**；bundle 里缺席等效 `false`（`DEFAULT_APP_CAPABILITIES.platform` 仍只列前五位），消费方只能以 `=== true` 判开。这六位随 `x-tansr-client-features` 里新增的 `nonchat-operations-v1` 协商下发，`CLIENT_FEATURES` 词表变化会让升级后的首次装配重新拉取 bundle 而不命中旧缓存。`CAPABILITY_TOOL_KEYS` / `CAPABILITY_PLATFORM_KEYS` 是事实源。`tools.agent` 位开时 Task 子代理族自动装配，子代理沿用会话模型与权限门。

## webSearch 为什么有两个位

联网搜索是全表唯一同时占用两个平面能力位的能力。两个位不是两件工具，是**同一件工具的两道门**：

- `tools.webSearch`（治理面）：这个应用的会话装配词表里允不允许出现 WebSearch 工具。
- `platform.webSearch`（通道面）：平台计费搜索通道对这个应用开没开通。

原因是 webSearch 的工具本体在环 2（与命令行同一件 `WebSearch`），后端却恒是平台通道——SDK 形态没有 BYO 搜索端点，终端持搜索商密钥正是应用密钥防盗模型要消灭的反模式。装配矩阵一句话：**缺席选择 = 有则用之，按位静默收缩；显式选择 = 主张必须有，不满足即 fail-fast 分因可读错**（`capability_disabled` 或 `invalid_options`）。

## 移动应用的公网工具

移动应用的会话装配在你的 `@tansr/serve` 上（托管拓扑）。这类应用可勾选的工具位只有 `todoWrite`、`askUser`、`customTools`、`webFetch`、`http`、`webSearch` 与平台位，文件、命令等本地族固定关；`customTools` 经 `clientTools` 远程工具通路申报，由手机执行。

- **版本**：`tools.webFetch`（网页抓取 WebFetch）与 `tools.http`（HTTP 请求 Http）由 `@tansr/serve` 0.12.0 / `@tansr/sdk` 0.17.0 起装配（2026-09-16 发布，现行 0.15.1 / 0.19.0 同样适用）；0.11.0 及更早的 serve 不为移动应用装配这两件。两位缺省关，须在控制台为该应用显式开启；`tools.webSearch` 另需 `platform.webSearch` 通道开通（见上节）。
- **在哪执行**：三件工具都在**你的会话服务主机**上执行，沿用同一核心工具与权限链；Android / iOS / 鸿蒙 SDK 不在手机上代发网络请求，也不自动批准。服务端显式配置的工具白名单只能进一步收窄。
- **何时生效**：改能力位后，新建会话或从存储重新装配的会话才生效；换票与提示词刷新不会改动活动会话的工具表。紧急撤回须停止对应会话。
- **执行边界**：托管 Http 不能引用宿主环境变量里的凭据，模型也不能自行解除宿主的私网访问上限；配置出网代理时，须在代理侧同样限制私网目标。WebFetch 沿用原有出网规则，跨主机跳转可能触发新的权限询问——按错误里给出的公开目标另发一次明确请求，不要自动批准跳转。
- **结果怎么读**：已知网址优先让智能体用 WebFetch，排查接口响应用 Http。Http 的 4xx / 5xx 是需要检查的响应，工具执行完成不等于远端 HTTP 成功；搜索空结果只说明本次查询没有匹配，不证明网站不存在。界面须保留截断提示。

## bundle 还下发了什么

- **模型目录**：别名 / handle / `displayName` / `manufacturer` / `family`;`setModel` 传 handle。`model.modelId` 为可选字段，读它的调用方按 `string | undefined` 处置。`@tansr/sdk` 0.18.0 起另有只读投影 `model.adapterDiagnostics?`（`request` / `billing` 两段各携 `adapterId` / `operation` / `status ∈ 'ready' | 'review' | 'unresolved'`，加 `conflicts[]`），描述当前目录证据是否足以选择请求 / 计费适配器，供界面展示模型的调用 / 计量能力；不携供应商凭据、价格原文或可执行适配器对象，平台未下发时 `undefined`，段坏形只丢诊断不丢模型条目。
- **媒体授权集** `platformModels`：四媒体工具描述自动列出集内模型名，顺位第一即缺省；集成方恒不手配模型名。0.19.0 起令牌档直连 `session.platform.speak()` 的 `SpeakInput` 多一个可选 `voiceRef`（应用私有音色资源 id，与系统 `voice` 互斥；作用域与目标模型由平台验证），私有音色本身经非聊天客户端创建与查询，不在 bundle 内下发。
- **套餐投影** `plan`:`{ tier, caps{ concurrency, apps, orgMembers, monthlyEndUsers, gatewayLane }, status: 'active' | 'grace' | 'lapsed', expiresAt }`,`null` = 个人档无套餐。它只是投影，硬执行恒在服务端，SDK 恒不本地判限。
- **裁决人档** `adjudicator`：令牌档缺省装配控制台任命的裁决人，资格档 `tier` 决定它能把多大半径的「询问」软化为放行。

## onPlatformWarning：非致命降级怎么告诉你

bundle 解析与装配期的非致命事实经 `createSession({ onPlatformWarning })` / `onWarning` 通报，缺席时回落会话事件流 `turn.error { scope: 'sdk.notice', recoverable: true }`，恒不 console、恒不改装配结果。常见码：

| 码 | 含义 |
|---|---|
| `app_platform_mismatch` | 应用平台类型与接入形态不符 |
| `tools_platform_deprecated` | 用了 `tools.platform` 旧别名 |
| `capabilities_unparsed` | bundle `capabilities` 段在场却解析失败（`detail.issues` 携 zod 问题）。**SDK 0.13.0 已提供**：该形回落零能力档（`tools` 全 false），不再回落缺省档；0.11.x 曾回落缺省档 |
| `adjudicator_unavailable` / `adjudicator_model_unavailable` / `adjudicator_budget_exhausted` / `adjudicator_breaker_tripped` | 裁决人缺席 / 模型不可用 / 预算耗尽 / 熔断 |
| `adjudicator_skipped_by_mode` | 显式 `permission.mode` 导致裁决人不装。**SDK 0.13.0 已提供**：显式 `permission.mode` 采用自管模式并发出该通报；显式 `adjudication` 与模式同时设置仍拒绝。0.11.x 的缺省裁决人与模式冲突限制已收回 |

## 计量与对账

`cost.usage.updated` 逐请求到事件流。终端自查用 `GET /v1/my-usage`（恒无金额字段）；开发者对账用 `GET /v1/app-usage/by-end-user`（含金额，恒不代理给终端）。计量与计费分离——对终端如何转售由你自主。

0.19.0 起 SDK 导出应用配额的字段形 `AppQuotaSchema` / `AppQuota`（`dailyTokens` / `endUserDailyTokens` / `rpm` 恒在场可 `null`，`tpm` 与媒体、非聊天操作次数的 `endUserDaily*` / `dailyOperationUnits` 等为可选），供读写平台应用配置时校验。配额**不随 bundle 下发**，硬执行恒在平台；本地持有的配额值不是剩余额度，SDK 不据此本地判限。
