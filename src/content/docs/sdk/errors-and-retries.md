---
title: 错误处理与重试
description: SDK 里的错误分三处出现——装配期 TansrSdkError、运行期事件流 turn.error / tool.failed、平台网关错误码。这一篇按「哪一类、能不能重试、该等多久」逐条给出处置。
zone: docs
category: sdk
related:
  - errors/codes
  - sdk/sessions-and-events
  - sdk/checkpoints
  - support/troubleshooting
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-08'
---

SDK 永不 `process.exit`。错误只从三个口子出来：装配期 / 选项期以 `TansrSdkError` 抛出；运行期的模型与工具错误恒经事件流表达（`turn.error` / `tool.failed` / `turn.aborted`）；平台网关的错误码则藏在这两者的载荷里。先判清是哪一类，再决定重不重试。

## 第一类：TansrSdkError（装配期 / 选项期）

这些都是同步或首次 `next()` / `await createSession()` 时抛出的编程错误或环境错误，**重试无益**，读消息改代码或改环境：

| code | 时点 | 含义与处置 |
|---|---|---|
| `invalid_options` | 同步 | 选项组合非法（三档字段混用 / 词表外工具名 / 令牌档带本地配置 / 显式 `adjudication` 与 `permission.mode` 同现）。读消息改代码 |
| `assembly_failed` | 装配期 | 托管 / 令牌装配失败（配置不可用 / 别名解析失败 / bundle 拉取失败）；`cause` 保真底层错误 |
| `capability_disabled` | 装配期 | 能力位关而被显式选择；消息含控制台修复指引 |
| `session_closed` | 运行期 | `close()` 后仍调用会改状态的方法 |
| `session_not_found` | 装配期 | `resume` 目标不在 store——`list()` 核对或新建 |
| `session_store_corrupted` | 装配期 / 落卷 | 会话存储损坏——恒不静默；删会话目录重新开始 |
| `checkpoints_not_wired` | 运行期 | 快照存储未接线却调了 `checkpoint()` / `listCheckpoints()` / `deleteCheckpoint()` 或显式 `compact({ checkpoint: true })` |
| `checkpoint_store_corrupted` | 运行期 | 快照文件损坏；`deleteCheckpoint()` 该 id 后继续 |
| `turn_running` | 运行期 | 运行中调了空闲期专属方法；`await session.idle()` 后重试——这是唯一「等一下再来」的 SDK 错 |
| `checkpoint_not_found` | 运行期 | `fork()` / `exportCheckpoint()` 指名的快照不存在 |
| `checkpoint_import_invalid` | 运行期 | 导入字节不是合法导出体；篡改即拒，零落盘 |
| `session_store_not_wired` | 运行期 | `fork()` 需要会话 `store` 而未给 |
| `platform_request_failed` | 运行期 | 令牌档直连 `session.platform.transcribe()` / `speak()` 失败；`status` / `platformCode` / `platformMessage` 携网关事实，`status 0` = 未达平台 |

```ts
import { TansrSdkError, createSession } from '@tansr/sdk';

try {
  session = await createSession({ token, baseUrl, store, resume: { sessionId, store } });
} catch (e) {
  if (e instanceof TansrSdkError && e.code === 'session_not_found') {
    session = await createSession({ token, baseUrl, store }); // 确实不在 store 才新建
  } else {
    throw e; // session_store_corrupted 等恒上抛,不静默开空会话
  }
}
```

## 第二类：事件流里的错误

| 事件 | 含义 | 你该做什么 |
|---|---|---|
| `turn.error { scope, message, recoverable, errorKind?, detail? }` | 一轮内的错误 | 看 `recoverable`:`true` 是咨询（持久化失败、压缩失败、平台提示），进 `SessionView.notices`，会话继续；`false` 是本轮失败，进 `lastError` |
| `turn.aborted { reason }` | 一轮被中止 | `reason` 是终局词：用户 `interrupt()` 为 `aborted_*`;`max_turns` / `budget_exceeded` 是触顶；`client_gone` 只在会话服务形态出现 |
| `tool.failed { errorType }` | 工具执行失败 | `timeout` / `unknown_tool` 等；模型会看到结构化失败结果并自行改道，通常不需要你介入 |
| `tool.completed { isError: true }` | 工具跑完但结果是错误 | 媒体四工具的供应商失败与超时走这一形；`data.errorCode` 携平台码 |
| `tool.permission.decided { allow: false, decisionSource }` | 权限拒绝 | `policy` = 没接 `askUser` 的 fail-closed 拒绝；接上 `permission.askUser` 或调整规则 |

`turn.error.detail` 是可选结构化位。**即将随 SDK 0.12.0 提供**：平台套餐四码携 `detail: { scope: 'plan' }`，与会话服务 HTTP 面的 `error.detail.scope` 同键同值，便于端上区分「本机限流」与「套餐配额」。

## 第三类：平台网关错误码

令牌档下，平台的错误码会出现在 `turn.error` 文案首段、`tool.completed.data.errorCode`、`PlatformRequestError.platformCode`，以及你服务端换发令牌的响应里。全部码的权威表在[错误码表](/errors/codes)，这里只讲最常撞到的十几个与处置：

### 该重试，按 `Retry-After` 等

| 码 | HTTP | 处置 |
|---|---|---|
| [`rate_limited`](/errors/codes#rate_limited) | 429 | 平台限流，恒携 `Retry-After`（整秒）。按其值等待后重试；不要更密地重发 |
| [`upstream_error`](/errors/codes#upstream_error) / [`upstream_disconnected`](/errors/codes#upstream_disconnected) | 502 | 上游模型侧故障；指数退避 + 抖动后重试 |
| [`upstream_timeout`](/errors/codes#upstream_timeout) 及 `upstream_connect_timeout` / `upstream_ttfb_timeout` / `upstream_idle_timeout` / `upstream_total_timeout` | 504 | 上游超时；同上退避 |
| [`plan_gate_unavailable`](/errors/codes#plan_gate_unavailable) | 503 | 平台守门依赖瞬态不可用，`Retry-After: 5`；既有会话不受影响 |

### 计划用量类 429：零自动重试

| 码 | HTTP | 处置 |
|---|---|---|
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | 套餐并发硬帽，`Retry-After: 30`。**只拒新会话，运行中的会话恒不断。** SDK 零重试——原样重发在窗内注定再拒，多会话宿主自动重试只会惊群。让用户 30 秒后手动再发；在你的监控上把 `detail.upgradeUrl` 亮出来，这是开发者的升档信号 |
| [`plan_end_users_exceeded`](/errors/codes#plan_end_users_exceeded) | 429 | 测试期月度终端用户数触顶，仅铸令牌径 |
| [`quota_exceeded`](/errors/codes#quota_exceeded) 与各面 `*_quota_exceeded` | 429 | 日配额触顶；等配额窗刷新，不要重试 |

### 不该重试，改配置或改代码

| 码 | HTTP | 处置 |
|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) / [`token_expired`](/errors/codes#token_expired) | 401 | 会话令牌过期或被吊销。**这是唯一会让令牌失效的码**——回你的服务端重新换发。端侧 SDK 经登录态重取令牌至多 2 次，仍 401 即进入终态，由宿主显式重连 |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | 应用钱包余额不足；充值后自愈，重试无益 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | 模型引用名不在应用授权面；控制台开授权 |
| [`forbidden`](/errors/codes#forbidden) | 403 | 环 3 能力位关（网关强制面），`detail` 携开位指引 |
| [`plan_required`](/errors/codes#plan_required) / [`plan_tier_insufficient`](/errors/codes#plan_tier_insufficient) | 403 | 应用所属账号无有效套餐或档位不含该能力——开发者装配错误，不该到终端用户；`detail.upgradeUrl` 指向控制台套餐页 |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | 超体帽（如语音转文字原始音频 > 24 MiB，`detail.maxRawBytes`）；切分或压缩，不可重试 |
| [`validation_failed`](/errors/codes#validation_failed) / [`bad_request`](/errors/codes#bad_request) | 400 | 载荷形状非法；读消息改请求 |
| [`session_archived`](/errors/codes#session_archived) | 410 | 平台会话已归档（30 天不活跃租约到期后）；这条会话不再能续，`resume` 会失败，请新建会话 |
| [`context_window_exceeded`](/errors/codes#context_window_exceeded) | 400 | 请求超出模型上下文窗口；先 `compact()` 或换更大窗口的模型 |

## 内核已经帮你做的重试

模型请求层的瞬态失败**不需要你重试**:fallback 链上每个条目自带重试（退避 500 ms → 30 s、总尝试 3 次、优先尊重 `Retry-After`），耗尽后切下一条目并签发 `cost.provider.switched`（from / to / reason / attempts / failures）。上下文真溢出（上游 413）时内核会强制压缩一次再重试。你的重试逻辑只需要覆盖上面两张「该重试」表里的会话级失败。

## 在会话服务形态怎么看

用 `@tansr/serve` 时，同一批平台码经服务端映射后到达移动端：套餐并发帽映射为 `429 rate_limited` + `Retry-After` + `detail: { scope: 'plan' }`;`plan_required` / `plan_tier_insufficient` 以 403 原码透传 + `detail.scope: 'plan'`；上游限流 / 5xx / 网络错映射为 `503 upstream_unavailable`。端侧退避纪律不变：429 / 503 携 `Retry-After` 时按整秒值等待，5xx 无 `Retry-After` 时指数退避 + 抖动。详见[v2 协议与 webhook](/serve/v2-and-webhooks/)。
