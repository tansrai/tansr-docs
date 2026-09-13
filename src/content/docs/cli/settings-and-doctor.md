---
title: 设置与 doctor
description: tansr 命令行的五层配置文件与合并规则、常用配置键、环境变量总表的用户面部分，以及 tansr doctor 各段输出怎么读、什么算阻断。
zone: docs
category: cli
related:
  - getting-started/cli
  - cli/commands
  - serve/env
  - support/troubleshooting
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-09-13'
---

命令行的行为由三处决定：配置文件（五层 `settings.json`）、环境变量、命令行旗标。`tansr doctor` 把这三处合并后的装配结果零网络地打印出来，是排障的第一步。

## 五层配置与合并规则

`settings.json` 是 JSONC（允许注释），从五层读取，**高层覆盖低层**：

| 层 | 位置 | 说明 |
|---|---|---|
| managed（最高） | Windows `%PROGRAMDATA%\tansr\managed-settings.json`;POSIX `/etc/tansr/managed-settings.json` | 企业托管层 |
| projectLocal | `<项目根>/.tansr/settings.local.json` | 项目本地层（个人覆写，建议 gitignore） |
| projectShared | `<项目根>/.tansr/settings.json` | 项目共享层（随仓库分发） |
| user | `~/.tansr/settings.json`（可经 `TANSR_CONFIG_DIR` 重定向） | 用户层 |
| builtin（最低） | 内置默认 | 兜底 |

项目根 = 从当前目录向上找**最近的含 `.tansr` 目录的祖先**。注意 `~/.tansr` 本身也是一个「含 `.tansr` 的祖先」：当前目录落在家目录树内且沿途无项目 `.tansr` 时，家目录会被拾为项目根，用户配置随之兼任项目共享层。要隔离就设 `TANSR_CONFIG_DIR`（重定向即隔离），或在项目里放一个空 `.tansr` 目录显式锚定。

合并与容错：常规键深合并，高层胜；**`permissions` / `hooks` / `mcpServers` 三段不走深合并**，由内核逐层抽取并保留层归因。单键取值非法 → 剔除该键并回退更低层的值；未知键 → 告警忽略；整文件语法错误 → 该层整体跳过。一切损坏都不阻止启动，`/config` 可看诊断计数。`$schemaVersion` 当前为 `1`。

项目层**只能收权，不能扩权**：`defaultMode: auto / acceptEdits / bypassPermissions` 三种扩权模式在项目层声明被忽略并告警；项目层 `allow` 规则冻结不进引擎（经 `/grants` 确认后才升为仓库授权）；`deny` / `ask` 照常即时生效。克隆一个仓库不能给自己授权。**即将随 tansr 命令行下一版候选提供（尚未发版）**：项目层 `hooks` 段跟随工作区信任——`~/.tansr/trust.json` 无记录或记为不信任时项目层 `command` / `http` hooks 零执行，无人值守入口可用 `--trust-project-hooks` / `TANSR_TRUST_PROJECT_HOOKS=1` 仅在无记录时本次放行，判据与边界见[安全与隐私](/security/#项目层-hooks-的信任门缺省零执行)。**即将随 tansr 命令行 0.5.0 提供**更严的层律：`sandbox` / `update` / `http` 三段只认 user 与 managed 层，managed 层是地板、环境变量对它只能收紧，组织在控制台锁定的键压过一切本地层与环境变量。

## 常用配置键

| 键 | 含义 |
|---|---|
| `providers` / `modelAliases` / `fallbacks` | 完全本地模式的模型供给（平台模式下缺省被剪枝）；API key **只写环境变量名** `auth.env` |
| `model.selected` | `/model` 的持久化落点：项目内写 `.tansr/settings.local.json`，项目外写用户层 |
| `locale` | 界面语言 `zh-CN` / `en` / `ja` / `ko` |
| `ui.theme` | `dark` / `light` / `high-contrast` / `colorblind`;`/theme <name>` 持久化到用户层 |
| `permissions.defaultMode` | 六值 `default` / `acceptEdits` / `plan` / `bypassPermissions` / `auto` / `dontAsk` |
| `permissions.allow` / `ask` / `deny` | 规则 DSL：`Read`、`Shell(git *)`、`Read(./.env)` 等 |
| `budget.maxUsd` / `maxTotalTokens` / `onExceeded` | 会话预算熔断（`block` 缺省 / `warn`） |
| `effort` / `outputStyle` | 思考努力档位、输出风格；优先级旗标 > 环境变量 > 本键 |
| `context.activeScheme` | 上下文治理方案（`/context scheme use` 写入） |
| `memory.autoMemory` | 自动记忆开合（`/memory on|off` 写入） |
| `sandbox.mode` / `allowWrite` / `network` | Shell 沙箱（仅 user / managed 层被尊重） |
| `update.manifestUrl` | 企业自托管更新清单地址（`{channel}` 占位） |
| `mcpServers` | MCP 服务器声明；`env` / `headers` 值支持 `${VAR}` 整值引用，凭据不落文件 |
| `http.allowedAuthEnvVars` | Http 工具与 hooks 可引用的凭据环境变量白名单（user / managed 层） |

## 环境变量：用户面速查

「空串视同未设置」适用于全部路径 / 开关类变量。

| 变量 | 用途 |
|---|---|
| `TANSR_USER_HOME` | 配置总根（虚拟用户家目录）：配置目录与存储根统一派生 `<dir>/.tansr`；沙箱 / CI 一键隔离 |
| `TANSR_CONFIG_DIR` / `TANSR_STORAGE_ROOT` | 用户层配置根 / 会话存储根，缺省 `~/.tansr`；显式设置时恒胜总根派生值 |
| `TANSR_PAT` | `tansr init` 免交互 PAT 供给（CI / 脚本） |
| `TANSR_ESCAPE_LOCAL` | 严格 `=1` 进完全本地模式：平台凭据 / 远端模型 / 用量上报整体停用 |
| `TANSR_LANG` | 界面语言（低于 `--lang` 与配置 `locale`） |
| `TANSR_TUI_GLYPHS` / `TANSR_TUI_PASTE_GUARD` | 终端字形档（`unicode` / `ascii`）与多行粘贴守卫覆盖 |
| `TANSR_EFFORT` / `TANSR_OUTPUT_STYLE` | 思考档位 / 输出风格 |
| `TANSR_SANDBOX` | `=1` 开沙箱、`=required` 硬要求 |
| `TANSR_ISOLATED` | `=1` 声明运行环境已隔离，只压制 doctor 的无人值守提示，不改运行时行为 |
| `TANSR_TRUST_PROJECT_HOOKS` | `=1` 在工作区**无信任记录**时本次启用项目层 hooks（等价旗标 `--trust-project-hooks`；不写 `trust.json`、压不过已记录的不信任；其余取值不生效）。下一版候选，尚未发版 |
| `TANSR_UPDATE_CHANNEL` / `TANSR_UPDATE_PINNED_VERSION` / `TANSR_NO_UPDATE_CHECK` / `TANSR_UPDATE_MANIFEST_URL` | 更新通道 / 组织锁定版本 / 个人退出检查 / 自托管清单 |
| `TANSR_WEBSEARCH_ENDPOINT` / `TANSR_WEBSEARCH_API_KEY` | WebSearch 自带端点（显式设置恒压过登录态平台搜索） |
| `TANSR_IMAGEGEN_*` / `TANSR_ASR_*` / `TANSR_TTS_*` | 媒体工具自带端点三件（`_ENDPOINT` / `_API_KEY` / `_MODEL`,+ `TANSR_TTS_VOICE`） |
| `TANSR_SERVE_TOKEN` | `tansr serve` 的 Bearer（`--token` 缺省时回退） |

`tansr serve` 的运维旋钮（准入帽、SSE 背压、日志形态等 `TANSR_SERVE_*`）与 `@tansr/serve` 同名同义，全表见[环境变量表](/serve/env)；例如 [`TANSR_SERVE_LOG_FORMAT`](/serve/env#tansr_serve_log_format)、[`TANSR_SERVE_MAX_ACTIVE_SESSIONS`](/serve/env#tansr_serve_max_active_sessions)。

## `tansr doctor` 怎么读

```bash
tansr doctor          # 人读报告;退出码 0 可用、1 有阻断问题
tansr doctor --json   # 机器可读
```

它零模型调用、零网络、零子进程，全部取装配期缓存事实，适合 CI 预检；TUI 内 `/doctor` 是同一份。命令面参考见[命令参考](/cli/commands#doctor)。

**检查项（按输出序；以实际输出为准）**：

| 段 | 看什么 | 阻断？|
|---|---|---|
| `node_version` | ≥ 22.19 基线 | 是 |
| `config_sources` | 五层各自状态，不应有 skipped | 是（有层被整体跳过） |
| `config_diagnostics` | 逐条被剔除的键（层 / 键路径 / 期望类型）；诊断永不携带字段值 | error 级为阻断 |
| `model_resolution` | 当前别名解析到哪个 provider / 模型 | 是（解析失败） |
| `context_window` / `context_scheme` | 窗口两值（标称 / 有效）与钳位侧；活动方案 id 与阶段，非 production 方案出警示 | 否 |
| `custom_commands` | 自定义命令源无 skipped | 否 |
| `mcp_connections` | 懒台未连 / 已连均健康；失败台报警 | 否 |
| `terminal` / `workspace_trust` / `output_style` | TTY 与尺寸；未信任收紧态；当前风格 | 否 |

**归因段（不计阻断，排障最常看）**：

- **`localProviders`**：逃生态 / 平台混用开关 / 本地 providers 剪枝来源三元组。「未配置 provider」先看这里，分清是没配还是被剪。
- **凭据存储**：凭据落在密钥库还是降级明文文件；派生键有效期。
- **模型选择归因**：`model.selected` 值与提供层、项目是否钉定 `main`、压制态是否命中。
- **套餐**：登录态下一行「套餐：档名（并发上限 N）· 到期 · 状态」；个人档显「个人（仅 CLI，无套餐费）」——**不是故障**。`--json` 在顶层 `plan` 键，`null` = 个人档。
- **媒体工具**：四面来源三态 `byo` / `platform` / `none`；「模型说没有图像工具」先看这行，登录了却是 `none` 通常是管理员尚未为账套开媒体池。
- **无人值守基线**：`defaultMode` 为 `auto` 且探测不到隔离迹象时给显著提示（`--json` 落 `unattended` 字段）；提示不阻断。
- **会话存储 / memory**：会话数、总字节、工件目录数、损坏目录数；记忆索引行数与孤儿目录。只读，不代删——清理走 `tansr sessions prune`。
- **裁决链**：启用 / 降级 / 资格档快照。

doctor 呈现的是最近一次装配拉取的事实：控制台改了套餐或能力位，跑一次 CLI 即刷新。部署连接器（OIDC / 渠道桥 / SIEM）的网络探测要显式 `tansr doctor --connectors`。

## 其他排障工具

- `/config`：合并后配置概要与诊断计数；`/status`：版本 / 通道 / 语言 / 会话 / 模型。
- `tansr -p "…" --json`：完整事件流是最细的排障数据，权限判定、hook 结果、供应商切换全在流内。
- Shell 工具长输出全量落盘到 `<工作目录>/.tansr/shell-output/<toolCallId>.log`。
- `tansr sessions export <id>`：导出转录（密钥自动脱敏），可直接进工单。
- 常见错误码与 doctor 段位的对照表见[排障指南](/support/troubleshooting/)。
