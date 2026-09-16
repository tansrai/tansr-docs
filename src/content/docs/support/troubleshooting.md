---
title: 排障指南
description: tansr doctor 各段位怎么读、哪些算阻断哪些只是归因；十个最常见错误码的含义与处置（深链错误码表）；以及命令行、SDK、会话服务、移动端各自的排障第一步。
zone: support
category: support
related:
  - support
  - errors/codes
  - cli/settings-and-doctor
  - sdk/errors-and-retries
  - support/contact
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-08'
---

排障的顺序：先看 `tansr doctor`（命令行）或错误码（其他形态），再按下面的表找处置；十之八九不用联系人。

## 第一步：`tansr doctor`

```bash
tansr doctor          # 人读报告
tansr doctor --json   # 机器可读
```

零模型调用、零网络、零子进程；**退出码 0 = 可用，1 = 有阻断问题**。TUI 内 `/doctor` 是同一份。它呈现的是最近一次装配拉取的事实——控制台改了配置，跑一次 CLI 即刷新。

### 段位对照表

| 段 | 正常长什么样 | 异常时怎么办 | 阻断？|
|---|---|---|---|
| `node_version` | ≥ 22.19 | 升级 Node，或改用单文件可执行版（自带运行时） | 是 |
| `config_sources` | 五层各自 loaded / absent，无 skipped | skipped = 该层 JSONC 语法错误或根节点非对象；修文件或删掉 | 是 |
| `config_diagnostics` | 0 条或 info 级 | 逐条给层 / 键路径 / 期望类型；非法值已被剔除并回退更低层 | error 级为阻断 |
| `model_resolution` | 别名 → provider / 模型 | 「未知的模型别名或 ref」核对 `modelAliases` 与 `providers.models`；「缺少 API key：环境变量 X 未设置」导出该变量 | 是 |
| `context_window` / `context_scheme` | 窗口两值与钳位侧；方案 `production` | 窗口未知 → 给模型声明 `maxContext`；非 production 方案只是警示 | 否 |
| `custom_commands` / `mcp_connections` | 无 skipped；懒台未连也算健康 | MCP 失败台看错误码；`/mcp reconnect` | 否 |
| `terminal` / `workspace_trust` / `output_style` | TTY 与尺寸；已信任；风格存在 | 未信任 = 只读沙箱，`/trust grant`；风格名不存在会诚实报错 | 否 |
| `localProviders`（归因） | 平台模式：本地 providers 被剪枝属预期；逃生态：出横幅 | 「未配置 provider」先看这里分清是没配还是被剪 | 否 |
| 凭据存储（归因） | 密钥库 | 降级明文文件时确认目录权限；`tansr init` 重跑 | 否 |
| 模型选择归因 | `model.selected` 值与提供层；压制态 | 项目层钉了 `modelAliases.main` 时用户层粘滞选择被压制，属预期 | 否 |
| 套餐 | 「个人（仅 CLI，无套餐费）」或「档名 · 到期 · 状态」 | 个人档不是故障；宽限 / 回落态到控制台续费 | 否 |
| 媒体工具 | 四面 `byo` / `platform` / `none` | 全 `none` 附开通指引：自带端点三件变量，或请管理员开媒体池 | 否 |
| 无人值守基线 | `auto` 且有隔离迹象 | 无迹象时显著提示；确认已隔离后 `TANSR_ISOLATED=1` 压制 | 否 |
| 会话存储 / memory | 会话数、字节、工件目录、损坏目录 | 只读不代删；清理走 `tansr sessions prune` | 否 |

### 命令行常见提示

| 症状 | 处置 |
|---|---|
| 「TUI 需要交互式终端（TTY）」 | 在管道里启动了 `tansr`；非交互场景用 `-p` |
| 「缺少 API token：请传 --token <值> 或设置 TANSR_SERVE_TOKEN」 | `tansr serve` fail-closed，不会起无鉴权服务 |
| 「服务器启动失败」/ 「--port 的值无效」 | 端口被占或非法 |
| 「会话不存在」/ 「无法恢复会话」 | `--resume` 的 id 不对或目录被占；`tansr --resume` 无参弹选择器核对 |
| 退出码 5 且提示 `tansr init` | 无人值守形态未初始化；先登录或设 `TANSR_ESCAPE_LOCAL=1` 走本地模式 |
| 退出码 3 | 触顶：`--max-turns` / 预算 / 工具轮数；调大或拆任务 |
| 退出码 4 | prompt 过长且压缩不可用；换更大窗口的模型 |
| 「并发已达套餐上限」横幅 | 只拒新会话；30 秒后再发或升级套餐 |

## 十个最常见的错误码

全部码的权威表在[错误码表](/errors/codes)，这里只列最常撞到的十个与第一处置。

| 码 | HTTP | 你在哪会看到 | 第一处置 |
|---|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) | 401 | 令牌过期或被吊销；会话服务 `authenticate` 返回 null | 命令行：`tansr init` 重登。SDK：回你的服务端重新换发令牌。移动端：修好登录态后显式重连。**这是唯一表示令牌坏了的码** |
| [`token_expired`](/errors/codes#token_expired) | 401 | 登录态 token 过期 | 重新登录 / 刷新 |
| [`invalid_api_key`](/errors/codes#invalid_api_key) | 401 | PAT 无效 | 控制台重建 PAT，`tansr init --fresh` |
| [`rate_limited`](/errors/codes#rate_limited) | 429 | 平台限流，或会话服务宿主限流 / 套餐配额（`detail.scope: 'plan'`） | 按 `Retry-After` 整秒等待后重试；不要更密地重发 |
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | 套餐并发硬帽 | 只拒新会话；30 秒后手动再发；考虑升档 |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | 余额不足 | 充值；重试无益 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | 模型不在应用授权面 | 控制台给应用开该模型授权 |
| [`validation_failed`](/errors/codes#validation_failed) | 400 | 请求载荷形状非法 | 读 `message` 改请求；不是网络问题 |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | 超体帽（如语音原始音频 > 24 MiB） | 切分或压缩；不可重试 |
| [`session_archived`](/errors/codes#session_archived) | 410 | 平台会话已归档（30 天不活跃） | 新建会话；这条不能再续 |

再补几个高频但含义直白的：[`upstream_error`](/errors/codes#upstream_error)（502，上游模型故障，退避重试）、[`upstream_timeout`](/errors/codes#upstream_timeout)（504，同上）、[`quota_exceeded`](/errors/codes#quota_exceeded)（429，日配额）、[`forbidden`](/errors/codes#forbidden)（403，能力位关或归属不符）、[`context_window_exceeded`](/errors/codes#context_window_exceeded)（400，先压缩）。

## 各形态的排障第一步

**SDK(Node / Electron)**：分清是装配期还是运行期。装配期 `TansrSdkError` 读 `code`（`invalid_options` 改代码；`assembly_failed` 看 `cause`;`capability_disabled` 去控制台开位）；运行期看事件流 `turn.error.recoverable`——`true` 是咨询，`false` 才是失败。事件流「卡住不动」几乎都是忘了 `session.close()`；「工具全被拒」几乎都是没接 `permission.askUser`。详见[错误处理与重试](/sdk/errors-and-retries/)。

**会话服务（`@tansr/serve`）**：先看 `GET /readyz`（503 带 `reasons`）；再看结构化日志的 `request.completed` / `store.commit_failed` / `session.rejected`，用响应头 `x-request-id` 关联。`resume` 恒 `409 resume_unavailable` = 没接 store；`500 store_corrupted` 常见于共享存储目录（不安全配置）；建会话 `503 upstream_unavailable` 是平台侧铸令牌不可用，`503 overloaded` 是本机准入帽，`503 draining` 是正在优雅关闭。

**移动端（Android / iOS / 鸿蒙）**：先看连接态。Android / iOS 看 `connectionState`：`Retrying` 是正常的 L1 重连；`Recovering` 是 L2 重建；`AuthExpired → Failed(Unauthorized)` 是令牌刷了 2 次仍 401，修登录态后显式 `start()`。鸿蒙看 `session.onState`：`retrying` / `recovering` / `failed`。一连就 401 通常是认证头不被服务端 `authenticate` 认可。模拟器连不上：Android 用了 `127.0.0.1` 而非 `10.0.2.2`；鸿蒙回环仅本地调试，连开发机私网须 `allowPrivateNetworkHttp`。

## 拿着这些去联系支持

- `tansr doctor --json` 的输出（不含密钥值；凭据以指纹形态呈现）。
- 错误码与完整 `message`；会话服务侧再带 `x-request-id`。
- 复现步骤与时间点；涉及计费带订单号或账单月份。
- 如果方便，`tansr sessions export <id>` 的转录（密钥已自动脱敏）。

入口见[联系支持](/support/contact/)。
