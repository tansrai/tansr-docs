# 资料站 · DS-C（内容）· P1 终报

> worktree `J:\tansr\worktrees\ds-C`（仓 `tansr-docs`，分支 `lane/ds/C`，基线 main `4a709d3`）· 2026-09-08 · 泳道恒不 push / 不改兄弟仓 / 不建 package.json / 不装依赖；自查全部用 `node -e` 与仓外 `%TEMP%` 脚本（不入库）。

## 〇 结论一页

- 卡数：DS-10 / DS-11 / DS-12 / DS-13 四卡**全部完成**；派单逐字列出的文章路径 **20 篇**全部落笔（派单标题写「18 篇」，与其自身枚举 5 + 8 + 3 + 4 = 20 不符，见 §五 1；iOS 快速开始按派单并入 `getting-started/android.md` 末节「iOS 同法」，`getting-started/index.md` 保留为选路页）。
- 提交数：5（四卡各一 + 一笔跨卡修正）+ 本终报 1 = 6；HEAD 见 §一。
- 门：本仓无 package.json，`pnpm gate` 不可跑；以仓外 node 脚本代跑两道自查——内容律（LF · 无 BOM · 无 U+FFFD · 末行换行 · frontmatter 契约字段与枚举 · `zone` / `category` 与目录一致 · `lastVerified` · 正文 ≥ 40 有效行 · 代码块标语言 · 中文标点 · 内部编号禁词）**20 files，0 with problems**；链接律（站内 href 全部解析到本泳道 20 slug 或 DS-B 生成页 6 slug；`/errors/codes#<code>` 锚点 ⊆ openapi 85 码；`/serve/env#<key>` 锚点 ⊆ `.env.example` 30 键小写；`related` 全部可解析；主线 rg 门 `FX-|W[1-5] 回执|泳道|收编` 零命中）**20 files，0 with problems**。
- 事实源对表：命令 / 键名 / 端点 / 错误码逐字对 doc/11 · doc/96 · doc/98 · doc/90 · 三 README · `.env.example` · 三 CHANGELOG · openapi · tansr-android / tansr-ios README；**已发 / 未发以 tansr-cli tag `v0.4.0`（sdk 0.11.0 / serve 0.6.0）源码 `git grep` 对表**，未发能力一律写「即将随 … 提供」（清单 §五 3）。
- 对下游交付：20 篇 `src/content/docs/**` + `public/wechat-support.png` 占位图（600×600 纯色 PNG，1892 B）；消费 DS-B 生成页锚点约定与 DS-A frontmatter 门。
- 未闭合：①`sources` 用了 `tansr-android:` / `tansr-ios:` 两个前缀，DS-A frontmatter 门须放行（§五 2）；② `support/index.md` 与 DS-A 卡表里的 `support/index.mdx` 骨架同 slug，收编时二选一（§五 4）；③ 微信二维码实图候操作者（§七）。

## 一 提交清单

| 卡 | 提交 | 一句话 |
|---|---|---|
| DS-10 | `ab0959f` | 快速开始 ×5（总览选路 / Node SDK / 命令行 / 会话服务 / Android 与 iOS） |
| DS-11 | `a688836` | 指南 ×8(sdk ×4 · serve ×3 · cli ×1) |
| DS-12 | `68a5002` | 两端指南 ×2 + 安全与隐私 ×1 |
| DS-13 | `61b1c82` | 帮助中心 ×4 + 微信二维码占位图 |
| 修正 | `f372e87` | Markdown 链接目标括号 68 处回 ASCII；`TANSR_SERVE_TOKEN` 不再深链 `/serve/env` |
| 终报 | （本提交） | `doc/report/资料站-DS-C-P1-终报.md` |

## 二 文章清单（20 篇：路径 / 字数 / sources / related）

字数口径 = 正文（不含 frontmatter）中文字符数 + 英文 / 代码词数；合计 32002。

| 卡 | 路径 | 字数 | sources | related |
|---|---|---|---|---|
| DS-10 | src/content/docs/getting-started/index.md | 1105（中文 945 字 + 英文 / 代码 160 词；有效行 48） | tansr-cli:doc/11-用户手册.md · tansr-cli:packages/sdk/README.md · tansr-cli:packages/server/README.md · tansr-cli:doc/90-SDK技术手册.md | getting-started/sdk · getting-started/cli · getting-started/serve · getting-started/android · security |
| DS-10 | src/content/docs/getting-started/sdk.md | 1051（中文 865 字 + 英文 / 代码 186 词；有效行 65） | tansr-cli:packages/sdk/README.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:packages/sdk/CHANGELOG.md | sdk/sessions-and-events · sdk/platform-bundle · sdk/errors-and-retries · security |
| DS-10 | src/content/docs/getting-started/cli.md | 1103（中文 887 字 + 英文 / 代码 216 词；有效行 77） | tansr-cli:doc/11-用户手册.md · tansr-cli:CHANGELOG.md | cli/settings-and-doctor · cli/commands · support/troubleshooting · support/account |
| DS-10 | src/content/docs/getting-started/serve.md | 1135（中文 863 字 + 英文 / 代码 272 词；有效行 100） | tansr-cli:packages/server/README.md · tansr-cli:examples/serve-demo/README.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:doc/11-用户手册.md · tansr-cli:packages/server/CHANGELOG.md | serve/deploy-and-auth · serve/v2-and-webhooks · serve/retention-and-governance · serve/env · getting-started/android |
| DS-10 | src/content/docs/getting-started/android.md | 1331（中文 990 字 + 英文 / 代码 341 词；有效行 96） | tansr-android:README.md · tansr-ios:README.md · tansr-cli:doc/96-Android开发指导书.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:examples/serve-demo/README.md | android · ios · getting-started/serve · serve/v2-and-webhooks |
| DS-11 | src/content/docs/sdk/sessions-and-events.md | 1552（中文 1214 字 + 英文 / 代码 338 词；有效行 74） | tansr-cli:packages/sdk/README.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:doc/11-用户手册.md · tansr-cli:packages/sdk/CHANGELOG.md | getting-started/sdk · sdk/checkpoints · sdk/platform-bundle · sdk/errors-and-retries |
| DS-11 | src/content/docs/sdk/checkpoints.md | 1666（中文 1157 字 + 英文 / 代码 509 词；有效行 106） | tansr-cli:doc/90-SDK技术手册.md · tansr-cli:packages/sdk/README.md · tansr-cli:packages/sdk/CHANGELOG.md | sdk/sessions-and-events · sdk/errors-and-retries · serve/retention-and-governance · security |
| DS-11 | src/content/docs/sdk/platform-bundle.md | 1476（中文 1238 字 + 英文 / 代码 238 词；有效行 63） | tansr-cli:packages/sdk/README.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:packages/sdk/CHANGELOG.md · tansr-api:openapi/openapi.json | getting-started/sdk · sdk/sessions-and-events · sdk/errors-and-retries · security |
| DS-11 | src/content/docs/sdk/errors-and-retries.md | 1642（中文 1311 字 + 英文 / 代码 331 词；有效行 70） | tansr-cli:doc/90-SDK技术手册.md · tansr-cli:doc/11-用户手册.md · tansr-cli:packages/sdk/CHANGELOG.md · tansr-api:openapi/openapi.json | errors/codes · sdk/sessions-and-events · sdk/checkpoints · support/troubleshooting |
| DS-11 | src/content/docs/serve/deploy-and-auth.md | 1855（中文 1443 字 + 英文 / 代码 412 词；有效行 67） | tansr-cli:packages/server/README.md · tansr-cli:packages/server/.env.example · tansr-cli:examples/serve-demo/README.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:doc/11-用户手册.md · tansr-cli:packages/server/CHANGELOG.md | getting-started/serve · serve/v2-and-webhooks · serve/retention-and-governance · serve/env · security |
| DS-11 | src/content/docs/serve/v2-and-webhooks.md | 2295（中文 1661 字 + 英文 / 代码 634 词；有效行 86） | tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:packages/server/README.md · tansr-cli:packages/server/.env.example · tansr-cli:packages/server/CHANGELOG.md · tansr-android:README.md | getting-started/serve · serve/deploy-and-auth · serve/retention-and-governance · serve/env · errors/codes · android · ios |
| DS-11 | src/content/docs/serve/retention-and-governance.md | 1804（中文 1470 字 + 英文 / 代码 334 词；有效行 51） | tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:packages/server/README.md · tansr-cli:packages/server/.env.example · tansr-cli:examples/serve-demo/README.md · tansr-cli:doc/11-用户手册.md · tansr-cli:packages/server/CHANGELOG.md | serve/deploy-and-auth · serve/v2-and-webhooks · serve/env · sdk/checkpoints · security |
| DS-11 | src/content/docs/cli/settings-and-doctor.md | 1861（中文 1506 字 + 英文 / 代码 355 词；有效行 81） | tansr-cli:doc/11-用户手册.md · tansr-cli:CHANGELOG.md | getting-started/cli · cli/commands · serve/env · support/troubleshooting · security |
| DS-12 | src/content/docs/android/index.md | 2170（中文 1644 字 + 英文 / 代码 526 词；有效行 79） | tansr-android:README.md · tansr-cli:doc/96-Android开发指导书.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:examples/serve-demo/README.md | getting-started/android · ios · serve/v2-and-webhooks · serve/deploy-and-auth · security |
| DS-12 | src/content/docs/ios/index.md | 1802（中文 1261 字 + 英文 / 代码 541 词；有效行 69） | tansr-ios:README.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:examples/serve-demo/README.md | getting-started/android · android · serve/v2-and-webhooks · serve/deploy-and-auth · security |
| DS-12 | src/content/docs/security/index.md | 2286（中文 1993 字 + 英文 / 代码 293 词；有效行 61） | tansr-cli:doc/11-用户手册.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:packages/server/README.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-cli:doc/96-Android开发指导书.md · tansr-cli:CHANGELOG.md · tansr-api:openapi/openapi.json | getting-started · cli/settings-and-doctor · serve/deploy-and-auth · serve/retention-and-governance · sdk/platform-bundle · support/account |
| DS-13 | src/content/docs/support/index.md | 1397（中文 1241 字 + 英文 / 代码 156 词；有效行 43） | tansr-cli:doc/11-用户手册.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:packages/server/README.md · tansr-api:openapi/openapi.json | support/account · support/troubleshooting · support/contact · getting-started · errors/codes |
| DS-13 | src/content/docs/support/account.md | 1870（中文 1744 字 + 英文 / 代码 126 词；有效行 43） | tansr-cli:doc/11-用户手册.md · tansr-cli:doc/90-SDK技术手册.md · tansr-api:openapi/openapi.json | support · support/troubleshooting · support/contact · security · getting-started/cli |
| DS-13 | src/content/docs/support/troubleshooting.md | 1560（中文 1280 字 + 英文 / 代码 280 词；有效行 60） | tansr-cli:doc/11-用户手册.md · tansr-cli:doc/90-SDK技术手册.md · tansr-cli:doc/98-Agent会话服务v2契约冻结件.md · tansr-api:openapi/openapi.json | support · errors/codes · cli/settings-and-doctor · sdk/errors-and-retries · support/contact |
| DS-13 | src/content/docs/support/contact.md | 1041（中文 950 字 + 英文 / 代码 91 词；有效行 45） | tansr-cli:doc/11-用户手册.md | support · support/troubleshooting · support/account · security |

另一非文章件：`public/wechat-support.png`（600×600,8-bit RGB 纯色 #e5e7eb，1892 B；node `zlib` 生成，IHDR / IEND 已核），`contact.md` 图旁明写「二维码待上传」。

## 三 改动摘要逐文件

- `src/content/docs/getting-started/index.md`：选路表（五形态 → 入口）、三层凭据模型、五步骨架说明、运行环境速查、跑通后的导航表。
- `…/getting-started/sdk.md`：前提 → `npm install @tansr/sdk` → 三档模型来源与三方闭环令牌 → `createSession` 最短代码 → 事件序列 → 四个第一坎。
- `…/getting-started/cli.md`:Node ≥ 22.19 / SEA 分发点 → `npm i -g @tansr/cli` → `tansr init`（掩码 / `TANSR_PAT`）→ TUI 首日命令 → `-p … --json` NDJSON 与退出码 → 第一坎。
- `…/getting-started/serve.md`：三层鉴权表 → `createAgentSessionFactory` + `createServeAgentSessionStore` + `startServer` 骨架 → curl 走 `POST /v2/sessions` / `messages` / SSE `events` + `Last-Event-ID` → 命令行 `tansr serve` 形态（`--v2` 写「即将」）。
- `…/getting-started/android.md`:Maven 三坐标 → `authProvider` 凭据律 → `openSession` / `TansrSessionLifecycle` → `defineTool` + `BridgeDialogState` → 第一坎 → 末节「iOS 同法」（SwiftPM 三产品 / `TansrAgent.client` / scenePhase / Info.plist 注意）。
- `…/sdk/sessions-and-events.md`：三档 API、`AgentSession` 方法语义、事件包络与九族表、SessionView / Narrator 与呈现档、权限 ask 桥与裁决人、三条经济性纪律。
- `…/sdk/checkpoints.md`:`SessionStore` / `resume` / `openOrResume` 范式、自建 store 五方法两纪律、文件布局与封段、`compact` / `checkpoint` / `restore` 逐字签名与联合类型、历史分页、fork 与导出导入。
- `…/sdk/platform-bundle.md`：应用平台类型、工具三环与 16 名 `builtin` 词表、能力位缺省档表、webSearch 双位双门、bundle 其余下发物、`onPlatformWarning` 码表、计量对账。
- `…/sdk/errors-and-retries.md`:`TansrSdkError` 13 码表、事件流五形、平台码三分（该重试 / 计划用量零重试 / 不该重试，全部深链 `/errors/codes#<code>`）、内核已代劳的重试、会话服务映射。
- `…/serve/deploy-and-auth.md`：三层鉴权与 `authenticate` 缝、`/v1` token、drain 四步与信号接线、观测端点暴露纪律、准入帽与旋钮表（深链 `/serve/env#…`）、多副本分片与三条禁忌、`tansr serve` 无人值守基线。
- `…/serve/v2-and-webhooks.md`：总纪律、21 端点表、错误码表、SSE 帧形、远程工具桥与双桥、三级恢复链、轮末 webhook 载荷 / 签名 / 投递纪律 / 命令行两键（双签与两键写「即将」）。
- `…/serve/retention-and-governance.md`：治理表与三无缺省位、关闭 ≠ 删除、store 生产恒接与布局、冷层接入与失败语义、存储保留期扫描（写「即将」）、`/v1` 保留窗、平台租约关系。
- `…/cli/settings-and-doctor.md`：五层配置与合并规则、常用配置键表、环境变量用户面速查、`tansr doctor` 检查项表与归因段、其他排障工具。
- `…/android/index.md` / `…/ios/index.md`：模块切层、事件归约、状态机与三级链、401 收敛 2 次、前后台（Doze / scenePhase）、错误呈现、双桥、语音两条链、推送自接、凭据纪律、联调与构建（iOS 另有乐观落帐、Info.plist、Windows 构建拦截处置）。
- `…/security/index.md`：出网目的地表与收窄、八类凭据放置表、三处数据留存与删除、八类凭据轮换表（openapi 路径逐字）、自检清单。
- `…/support/index.md` / `account.md` / `troubleshooting.md` / `contact.md`：六组 FAQ + 三入口；账号 / PAT / 应用密钥 / 套餐档位表（无价格数字）/ 余额账单发票；doctor 段位对照 + 命令行提示 + 十码深链 + 三形态第一步；微信占位 + `mailto:support@tansr.com` + 入口选择表 + 四件事 + 不发密钥清单 + 安全入口。
- `public/wechat-support.png`：占位图。
- 本终报。

## 四 跨泳道接口

**交付（给 DS-A / 主线）**

- 20 篇 `src/content/docs/{getting-started,sdk,serve,cli,android,ios,security,support}/*.md`,frontmatter 逐字契约 3：`title` `description` `zone` `category` `related[]` `sources[]` `lastVerified: '2026-09-08'`;`support/*` 四篇 `zone: support`，其余 `zone: docs`;`category` 恒 = 一级目录名。
- `public/wechat-support.png` 占位；`contact.md` 以 `![…](/wechat-support.png)` 引用，操作者替换同名文件即生效，无需改文。
- 站内链接形：页面 `/<slug>/`（尾斜杠），生成页锚点 `/errors/codes#<code>` · `/serve/env#<小写键名>` · `/cli/commands#doctor`，生成页无锚链 `/errors/codes` `/serve/env` `/cli/commands` `/releases/{cli,sdk,serve}`。

**消费（等谁的什么）**

- DS-B 生成页 6 slug 与锚点约定（契约 4）：`/errors/codes#<code>`（本泳道用到 24 个码，全部 ∈ openapi 85 码）、`/serve/env#<key>`（用到 22 个键，全部 ∈ 30 键表，小写）、`/cli/commands#doctor`。生成页缺席时 `links` 门会红——按契约由收编时一次再生解决。
- DS-A `content.config.ts` frontmatter schema 与 `scripts/check/frontmatter.mjs`：须接受 `sources` 前缀 `tansr-android:` / `tansr-ios:`（§五 2）。
- DS-A 文章模板的「相关文章」组件读 `related`；「有帮助吗」组件被 `contact.md` 末节提及（「每篇文章底部有『这篇有帮助吗』」）。

## 五 与派单不符之处（逐条）

1. **篇数 18 vs 20**：派单标题「写 18 篇」，但 DS-10 ×5 + DS-11 ×8 + DS-12 ×3 + DS-13 ×4 = 20，且各卡路径逐字列出。按逐字路径写齐 20 篇；iOS 快速开始按派单括注并入 `android.md` 末节，`index.md` 保留（派单给的两选一取「保留 index」）。若主线要 18，可删 `getting-started/index.md`（选路内容在 `support/index.md` 与各篇「下一步」有冗余覆盖）与合并 `android/index.md` + `ios/index.md`——本泳道不代删。
2. **`sources` 前缀**：契约 3 只写了 `contract/` / `tansr-cli:` / `tansr-api:` 三形，派单又指定 ios 仓 README 为事实源；两端文章用了 `tansr-android:README.md` / `tansr-ios:README.md`（同形）。DS-A `frontmatter` 门若只放行两前缀会红，请放行 `tansr-android:` / `tansr-ios:`（只校形）。
3. **未发能力写「即将」清单**（以 tansr-cli `v0.4.0` tag = sdk 0.11.0 / serve 0.6.0 源码 `git grep` 对表，三 CHANGELOG「未发」段为准）：
   - `@tansr/serve` 0.7.0:webhook 双签 `x-tansr-signature: v2=…, v1=…` 与 `x-tansr-timestamp` / `x-tansr-nonce`（今写为现行 `sha256=<hex>` 单签）；`TANSR_SERVE_NOTIFY_URL` / `TANSR_SERVE_NOTIFY_SECRET` 两键；控制帧 `ts` 与三请求帧 `ttlMs`;`installProcessGuards` 与 `TANSR_SERVE_ON_UNHANDLED`；存储保留期扫描 `sessions.retention` + `TANSR_SERVE_SESSION_MAX_AGE_DAYS` / `_MAX_PER_END_USER` + 控制台 `governance.sessionRetentionDays` 覆写；gap 帧 `reason:'ahead_of_log'`（未写）；`TANSR_SERVE_EXPOSE_METRICS` / `TANSR_SERVE_READY_STREAM` / `TANSR_SERVE_CWD_ON_RESUME` / `TANSR_READY` 就绪帧（未在文中作为可用能力出现；`/serve/env` 生成页 30 键会含它们，由生成页照 `.env.example` 口径呈现）。
   - `@tansr/sdk` 0.12.0:`permission.mode` 与缺省裁决人的兼容径 `adjudicator_skipped_by_mode`（今写 0.11.x 为 `invalid_options` + 迁移法）；`capabilities_unparsed` 零能力档回落；`turn.error.detail{ scope:'plan' }`。
   - tansr 命令行 0.5.0：`tansr serve --v2` / `TANSR_SERVE_V2=1` 与 `x-tansr-end-user` 分域；配置层四律（`sandbox` / `update` / `http` 段 user-managed、managed 地板、env 只收紧、组织锁定压 env）；统一出口 SSRF 三层门；`http.allowedAuthEnvVars` 名单与携凭据 Http 全模式恒问；`tansr acp --allowed-roots`（未写）。
   - 已核为**已发**并写成可用：`/v2` 全部 21 端点（含 compact / checkpoints / cwd / fork / export / import / audio 两端点——契约文本里的「暂不发版」注记相对 0.6.0 已过时）；`onTurnEndNotify` 库缝与 `sha256=` 单签；`TANSR_SERVE_*` 22 键；`TANSR_SERVE_V1_RETENTION_MS` / `_V1_MAX_RETAINED` / `_DRAIN_TIMEOUT_MS` / `_MCP_CONNECTIONS`;`/healthz` `/readyz` `/metrics`；冷层 `createFsBlobStore` / `runStorageConformance`;SDK `compact` / `checkpoint` / `restore` / `history` / `fork` / `exportCheckpoint` / `importCheckpoint` / `setCwd` / `onWarning` / `PLAN_ERROR_CODES`;Android 0.1.0（Maven Central，README 登记）与 iOS tag `0.1.0`。
4. **`support/index` 同 slug**:DS-A 卡表 DS-02 写 `/support/index.mdx` 骨架，派单给本泳道 `support/index.md`（FAQ 分组 + 三入口）。收编时二选一（建议保留本篇 `.md` 内容并入 DS-A 的 `.mdx` 壳，或直接以本篇替代），否则 Starlight 同 slug 冲突构建红。
5. **协议术语「回执」**：契约 6 禁词表含「回执」，而 `/v2` 契约文本把工具 / 权限 / 提问的上行 POST 叫「回执」。全站改用「应答」（`tool-results` = 远程工具应答等），语义不变，词面与契约文本不同。
6. **中文标点转换的一次事故与修正**：本泳道输出的全角标点在写入时被工具链归一为 ASCII，故用仓外脚本二次转换；脚本首版把 `](…)` 链接目标括号一并转全角，致 68 处站内链接与 `mailto:` 失效——被链接自查捕获，`f372e87` 修脚本（`]` 后括号恒不动）并逐文件回修，两道自查复绿。教训：标点转换恒在链接检查之前，且链接检查必须解析 Markdown 目标而非只看文本。
7. `TANSR_SERVE_TOKEN` 不在 30 键表内（`.env.example` 头注「不在表内」），`/serve/env#tansr_serve_token` 锚点将不存在，故 `cli/settings-and-doctor.md` 对它只作代码引用不深链；`TANSR_SERVE_V1_RETENTION_MS` 等四个表外键同律。
8. `doc/90-SDK技术手册.md` 不在派单事实源清单内，但 SDK 四篇仅凭 `packages/sdk/README.md` 不足以逐字对签名 / 错误码 / 分页语义，故读取并列入 `sources`（`tansr-cli:doc/90-SDK技术手册.md`）。`tansr-android/README.md` 同理（Kotlin API 形与 Maven 坐标唯一来源）。

## 六 代拍登记

- **iOS 快速开始并入 android.md 末节而非替代 index**：派单二选一，取「保留选路页」——首页卡片（DS-A）之外，`/getting-started/` 需要一个落地页承接「我该从哪一篇开始」；iOS 与 Android 三端同律，合篇对照更省读者时间。影响面：`related` / 站内链接无 `getting-started/ios` slug。
- **「回执」→「应答」**（§五 5）。
- **套餐价格数字不写**：`support/account.md` 只列档位 / 人群 / 并发 / 应用数 / 资费类型，价格与购买入口指向控制台套餐页——价格属商务面、随时可变，资料站写死即漂移源；并发口径、硬帽 1.1×、宽限 14 天等机制性数字照写。
- **十码选择**（`troubleshooting.md`）：按「用户最先撞到」而非「码表顺序」选 unauthorized / token_expired / invalid_api_key / rate_limited / plan_concurrency_exceeded / insufficient_balance / model_not_authorized / validation_failed / payload_too_large / session_archived，另补五个直白码；全部 ∈ openapi 85 码。
- **占位图颜色 #e5e7eb**、600×600、无文字——图旁文案已明写「二维码待上传」，图内不再叠字（避免与真图替换后残留误导）。

## 七 未完成 / 敞口 / ⏸ 项

- ⏸ **微信二维码实图**：候操作者放入 `public/wechat-support.png`（≥ 600 px PNG，同名覆盖即可）。
- ⏸ **门未真跑**：`pnpm gate`（astro check / build / gen:check / lint:text / links / frontmatter）归 DS-A 与收编；本泳道两道 node 自查是其近似（`lint-text` 律逐项对齐；`links` 以 slug 表代替 dist 扫描——生成页锚点存在性只校「码 ∈ openapi / 键 ∈ .env.example」，生成页真锚 id 形以 DS-B 产物为准）。
- ⏸ **`related` 中的生成页 slug**（`errors/codes` / `serve/env` / `cli/commands`）在 DS-B 产物到位前，DS-A `frontmatter` 门若校「related 目标存在」会红；契约未要求校 related 目标，如校请在收编后再跑。
- 敞口：`contact.md` 提及「这篇有帮助吗」组件（DS-A DS-03，P1 localStorage 形）；若 DS-A 未落该组件，删该句一行即可。
- 敞口：`serve/env` 生成页将按 `.env.example` 呈现全部 30 键（含 8 个 0.7.0 未发键），与本泳道「未发写即将」口径由生成页头注 / 发布说明「未发」段兜底，本泳道文章对这 8 键均已标「即将」或未提。
- 敞口：en 版本 0 篇（P2 卡）。

## 八 回主线摘要

- `DS-10 | ab0959f | getting-started/{index,sdk,cli,serve,android}.md(iOS 并入 android 末节)| 自查 5/5 绿 | frontmatter 契约 3 逐字 | 「即将」:tansr serve --v2`
- `DS-11 | a688836 | sdk/{sessions-and-events,checkpoints,platform-bundle,errors-and-retries}.md · serve/{deploy-and-auth,v2-and-webhooks,retention-and-governance}.md · cli/settings-and-doctor.md | 自查 13/13 绿 | 错误码锚 /errors/codes#<code> 24 个 ∈ 85;env 锚 /serve/env#<key> 22 个 ∈ 30 | 「即将」:serve 0.7.0 双签 / NOTIFY 两键 / ts+ttlMs / installProcessGuards / 保留期扫描;sdk 0.12.0 三项;cli 0.5.0 --v2 / 四律`
- `DS-12 | 68a5002 | android/index.md · ios/index.md · security/index.md | 自查 16/16 绿 | sources 前缀 tansr-android: / tansr-ios:(请 frontmatter 门放行)| 「即将」:cli 0.5.0 SSRF 三层门 / http.allowedAuthEnvVars;serve 0.7.0 保留期扫描`
- `DS-13 | 61b1c82 | support/{index,account,troubleshooting,contact}.md(zone: support)+ public/wechat-support.png 占位 | 自查 20/20 绿 | 十码深链 ∈ 85;mailto:support@tansr.com;二维码「待上传」明写 | 与 DS-A support/index.mdx 同 slug,收编二选一`
- `修正 | f372e87 | 68 处链接目标括号回 ASCII;TANSR_SERVE_TOKEN 去深链 | 内容自查 20/20 绿 + 链接自查 20/20 绿(站内 href 全解析;related 全解析;主线 rg 门零命中)`
- 收编提示：合入后跑 `pnpm frontmatter`（放行两新前缀）→ `pnpm build` → `pnpm links`（生成页到位后锚点全绿预期）；`support/index` 同 slug 先裁；二维码实图候操作者。
- 篇数按派单逐字路径为 20（标题「18」与枚举不符），多寡由主线裁，本泳道不代删。
