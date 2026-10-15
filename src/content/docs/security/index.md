---
title: 安全与隐私
description: 作为用户你能做什么——tansr 各形态会往哪些地方出网、凭据该放在哪、数据留存在哪里多久、以及 PAT / 应用密钥 / 终端令牌 / 会话服务 token 各自怎么轮换与吊销。
zone: docs
category: security
related:
  - getting-started
  - cli/settings-and-doctor
  - serve/deploy-and-auth
  - serve/retention-and-governance
  - serve/v2-and-webhooks
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - support/account
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

这一页只写**你能做的事**：知道流量去哪、把凭据放对地方、知道数据留在哪、会轮换。tansr 内部的防线（权限引擎、保护路径、硬安全红线、审计链）在各形态的指南里已经展开，这里只在与你的操作相关时引用。版本基线：`tansr` 命令行 0.10.3、`@tansr/sdk` 0.19.0、`@tansr/serve` 0.15.1（均 2026-10-10 发布）。

## 出网：流量去哪，怎么收窄

### 命令行会连什么

| 目的地 | 何时 | 能否关 |
|---|---|---|
| tansr 平台网关 `api.tansr.com` | 登录平台模式后：模型调用、配置束拉取、心跳、用量上报、余额 | 设 `TANSR_ESCAPE_LOCAL=1` 进完全本地模式即整体停用 |
| 更新检查：npm 安装形态查 npm 注册表 `registry.npmjs.org`，单文件可执行版（SEA）查官方分发点 `bash.tansr.com` 的签名指针 | 只在你显式 `/update` 或 `tansr update` 时；启动期恒不自动检查 | `TANSR_UPDATE_CHANNEL=none` 或 `TANSR_NO_UPDATE_CHECK=1`；企业可指自托管清单 `TANSR_UPDATE_MANIFEST_URL`（在场时两种形态都只连它） |
| 你配置的模型供应商 | 完全本地模式下 `providers.*.baseUrl` | 由你决定 |
| 你配置的 MCP 服务器 / 自带搜索与媒体端点 | 会话内工具调用 | 由你决定；项目层 MCP 服务器须显式授信 |
| 模型经工具访问的任意 URL(WebFetch / Http) | 会话内 | 受权限规则约束；可用 `deny` 规则禁用整个工具 |

无人值守部署（`tansr serve` / headless 放权到 `auto`）的推荐基线是**网络出口白名单**：仅放行模型 API 等必要目的，DNS 与已建连接之外缺省拒绝；配合容器或最小权限专用用户、文件系统写面限工作目录。参考模板在仓内 `deploy/serve/`。

已在场的两道用户可见防线：同一条命令里既引用秘密文件（`.env`、密钥、`.aws/credentials`）又带外发动作（`curl` / `scp` / `git push` …）恒被拒绝，任何模式与规则压不过；会话一旦读过秘密文件，其后的外发动作一律转为询问（会话污点）。**tansr 命令行 0.6.0 起**：全部出网（WebFetch / Http / hooks / 音频下载）改经统一出口，DNS 解析后再判私网、环回、链路本地地址，指向内网或元数据地址的抓取被拒并给出原因；Http 工具与 hooks 可引用的凭据环境变量收敛到白名单 `http.allowedAuthEnvVars`，名单外不发请求。

### SDK 与会话服务会连什么

- `@tansr/sdk` 令牌档只连你传入的 `baseUrl`（平台网关）以及你显式配置的 MCP 服务器；SDK 恒不扫用户目录、恒无自带搜索端点。
- `@tansr/serve` 上游链是 `appid/appkey → POST /v1/app-tokens → GET /t1/config + POST /t1/heartbeat → POST /t1/exchange`，全部指向 `apiBaseUrl`；另有你配置的轮末 webhook URL（出站请求恒不带任何鉴权凭据头，真伪凭签名）与可选冷层对象存储。
- 移动应用在控制台开启网页抓取（WebFetch）或 HTTP 请求（Http）后（`@tansr/serve` 0.12.0 起，缺省关），这两件工具由会话服务所在主机直接访问目标网址，沿用同一出网规则：托管 Http 不能引用宿主环境变量里的凭据，模型也不能解除宿主的私网访问上限；若配置了出网代理，须在代理侧同样限制私网目标。详见[移动应用的公网工具](/sdk/platform-bundle/#移动应用的公网工具)。
- 移动端 SDK 与 `@tansr/api-client` 只连你的会话服务 `baseUrl`，不直连平台，也不在设备上代发这些工具请求。

## 统一调用面 `/api`：头、围栏与旧前缀

`@tansr/serve` 0.13.0 起，`options.v2` 在场的部署在同一端口链首装配统一调用面 `/api`（0.14.0 为 manifest revision 7）。与安全相关的只有这几条：

- **身份只来自 `Authorization`。** `/api` 与 `/v2` 共用同一条 `authenticate` 缝裁定 `endUserId`；四个响应头 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 与错误信封的 `traceId` / `requestId` 恒不携 endUserId、令牌或消息内容。请求体里的任何身份字段都不被当作身份。`tansr serve --v2` 命令行形态以同一 Bearer + `x-tansr-end-user` 头自报分域，这个头只能由你的网关在自家登录态之后写入，恒不能让终端直填。
- **请求头都是显式协商，不是鉴权因子。** `tansr-session-family`、`tansr-closure-id`、`tansr-event-envelope`、`Idempotency-Key` / `If-Match` / `deadline`（后三者 0.14.0 起）出现在不适用的请求上一律 `400 invalid_request`，不静默忽略；不携任何一头 = 行为逐字节不变。
- **能力闭合围栏**：`GET /api/sessions/:id/capabilities` 只读联邦各域既有能力源，回一张操作三态表（`enabled` / `disabled` / `unavailable`）与 `tansr-closure-id`；它**不新造授权引擎**，围栏内的操作仍由域 handler 按应用能力位、用户授权、会话状态与审批裁决。写操作可携上次的 `tansr-closure-id` 作前置条件：围栏已变 → `412 precondition_failed`（`rediscover`，重新发现后再决定是否重发，不得带旧值硬重放）；越围栏调用已 `disabled` 的操作 → `403 capability_unavailable`。未知会话、他人会话与只存在于档案宿主的会话同答 `404 not_found`，不泄漏存在性。
- **`/v1` 缺省关闭**：门面在场的部署 `/v1/sessions*`、`/v1/status`、`/v1/approvals/:id/credential` 缺省 404（SDK2 显式宿主在场时恒关）。过渡旋钮 `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` 自 0.14.0 / 命令行 0.10.1 起已标废弃（1.0.0 移除，开启时出 `warn` 事件 `server.deprecated_option`）；审批凭证投递改走 `POST /api/approvals/:id/credential`。健检改 `/healthz` `/readyz`，不要再用 `/v1` Bearer 探 `/v1/status`。
- **旧前缀 `/v2`、`/v3/*` 的退役窗口可配**（`@tansr/serve` 0.15.0 / 命令行 0.10.2 起，门面在场时生效）：`TANSR_SERVE_LEGACY_PREFIX=readwrite|readonly|off`（工厂选项 `legacyPrefixes`）——`readwrite` 为缺省（0.15.1 仍是），旧前缀全部受理；`readonly` 下 manifest 登记为写的操作在旧前缀答 `410 gone`（`message` 指向对应的 `/api` 操作），读与流照常；`off` 下旧前缀全部 `404 not_found`。`TANSR_SERVE_LEGACY_SUNSET`（`legacyPrefixSunset`）给出计划退役时刻后，旧前缀响应在既有的 `Deprecation` / `Link` 头之外再附 `Sunset` 头。同一会话混用旧前缀与 `/api` 时日志出 `warn` 事件 `api.legacy_prefix_mixed`，被拒的旧前缀请求出 `api.legacy_prefix_rejected`——两者持续为零是可以收窄窗口的证据。缺省何时改变见[迁移与退役时间表](/unified-api/migration/)。
- 统一错误信封里的 `message` 不承诺字面、`detail.path` 回写为所请求的 `/api` 路径，`/v2` / `/v3` 内部前缀与宿主路径不外泄。各头与码表见[统一 API 的请求头与错误信封](/unified-api/headers-and-errors/)。

## 系统工具与终端工具的隔离（SDK 2.0 远端档）

SDK 2.0 的「统一核心与薄终端」把工具按**执行地**分成两类，谁也不能替谁执行：

- **系统工具在会话服务主机执行**：WebFetch / Http / WebSearch / 媒体工具与 MCP 适配在 serve 进程内按宿主出网规则运行（私网上限、凭据白名单、代理侧同律）；MCP 适配复用宿主既有连接，不能根据模型参数启动进程，模型也不能解除出网上限。
- **终端工具只在绑定设备执行**：文件读取 / 列目录 / 写入 / 编辑与绑定工作区记忆（`fs.inspect` / `fs.read` / `fs.list` 等受控原语）只在应用经管理 API 显式配置 `execution.version = 'bound-device-v1'` 并在 `boundDevice.tools` 授予后才存在；**旧应用类型与旧 `tools` 位不推导终端授权**。有效工具 = 应用上界 ∩ 用户策略 ∩ 请求收窄 ∩ 设备原语；原 Read / List 权限与用户审批照常生效，配置目录不能代用户授权。
- **记忆与附件不回落宿主**：可信宿主 `execution.memoryFor(scope)` 只选择绑定工作区内的相对目录，不读 serve 的 home / env / cwd；缺能力、拒绝、掉线或来源过大都只降级本轮，恒不改读服务端文件。外置附件来源 `trustedAttachmentSourceFor` 的 URL 只是查表键，SDK / serve 不自动 fetch，不接受模型或客户端把地址变成文件或网络权限。
- **耐久执行先记后做**：执行器先持久占用操作再执行、先保存结果再回传；断线重开不重做结果未知的操作（SDK 层对应 `GateDecision.executionTarget` / `ToolContext.executionTarget`，`@tansr/sdk` 0.18.0 起；进程内 SDK 恒缺席）。
- **可信宿主模块与部署者代码同级受信**：`tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>`（命令行 0.10.0 起）只核入口文件原始字节的摘要，不签署依赖图、不是代码沙箱；路径与摘要恒由部署流水线给出，不由模型或 HTTP 提供。

## 凭据：放哪、不放哪

| 凭据 | 代表谁 | 正确位置 | 恒不放 |
|---|---|---|---|
| 个人访问令牌（PAT） | 你本人 | 控制台生成后只喂给 `tansr init`（掩码输入）或 CI 的 `TANSR_PAT` 环境变量 | shell 历史（`--pat` 直给会留痕）、脚本明文、仓库 |
| 本机派生应用键 | 你的这台设备 | `tansr init` 自动写入操作系统密钥库（macOS Keychain / Linux secret-service / Windows DPAPI）；不可用时降级 0600 文件并明确警示 | 不需要你碰；`tansr doctor` 的凭据存储段可看落点 |
| 模型供应商 API key（完全本地模式） | 你的供应商账号 | 环境变量；配置文件里**只写变量名** `auth.env` | `settings.json`、错误消息、`/config` 输出（它们永不携带值） |
| 应用密钥 appid / appkey | 你的应用 | 你的服务端进程环境变量（Node 进程或 `@tansr/serve`） | 终端设备、日志、错误响应、版本库（`.env` 入 `.gitignore`） |
| 短期 `app_user` 令牌 | 你的某个终端用户 | Electron 主进程内存；`@tansr/serve` 进程内部 | renderer 进程、持久化存储；移动端**从不**接触它 |
| 你自己的登录 token（移动端） | 你的用户 | 经 `authProvider` 按次提供，SDK 不持久化 | SharedPreferences / DataStore / UserDefaults / 日志 |
| 会话服务 `/v1` Bearer(`--token` / `TANSR_SERVE_TOKEN`) | 运维方 | 环境变量 | 与 `/v2` / `/api` 面互不相通，不要复用给终端用户；`--v2` 部署 `/v1` 缺省已关 |
| `--host-module-sha256` 的摘要 | 你的部署流水线 | 构建产物旁随 `.cjs` 一起生成、一起下发 | 不由运行时计算、不由模型或 HTTP 提供 |
| webhook `secret` | 你的推送后端 | 会话服务与接收端各自的环境变量 | 日志；引擎恒不打印它 |

三处红线值得反复说：appkey 恒不出你的服务端；`app_user` 令牌恒不出会话服务；会话 id 不是鉴权因子。

命令行还有一层脱敏纪律替你兜底：报告、日志、导出转录里的密钥一律按 `sk-...尾4位` 形态脱敏；`tansr sessions export` 的产物可直接进工单。

## 项目层 hooks 的信任门：缺省零执行

**tansr 命令行 0.7.0 起提供。** 仓库里的 `.tansr/settings.json` / `.tansr/settings.local.json` 可以声明 `command` / `http` 两类 hooks——它们是「克隆一个仓库就可能被执行的代码」，所以命令行把项目层 hooks 放在**工作区信任门**之后，缺省不执行：

- **信任记录在用户层** `~/.tansr/trust.json`，不另设授信文件。工作区已记信任 → 项目层 hooks 照常执行；无记录或记为不信任 → 项目层 `command` / `http` hooks **零执行**（零 `hook.*` 事件），stderr 留一行说明；用户层与托管层 hooks 不受影响。
- **TUI**：首次打开无记录的目录时，用户层 / 托管层的 `SessionStart` hooks 照常在首屏前触发，项目层 `SessionStart` 等你在信任对话框选「信任」之后再补发恰一次（拒绝 / Esc 不补发并进入收紧模式）。
- **无人值守四入口**（headless `-p`、`tansr serve`、`tansr acp`、`tansr mcp serve`）没有交互面，只认 TUI 已落盘的记录：你在 TUI 信任过的仓库，CI / 编辑器接入时项目 hooks 自动生效。无记录而确需本次执行，加 `--trust-project-hooks`（四入口同名旗标）或设 `TANSR_TRUST_PROJECT_HOOKS=1`（其余取值不生效）：只在**无记录**时生效、只对本次运行生效、**不写入** `trust.json`，且**压不过**已记录的不信任。
- **判据是配置锚链，不是当前目录**：锚点 = 从启动目录向上最近的含 `.tansr` 的祖先；锚点或其任一祖先被记为不信任，即使子目录被记为信任也零执行，旗标 / 环境变量同样压不过。信任键按真实路径（realpath）归一：junction / 符号链接 / `subst` / 8.3 短名 / 映射盘指向同一工作区即同一条记录；真实路径解析失败时按字面路径处理、**不视为信任**——历史上按别名字面路径记的信任需重新授信一次。TUI `/cd`、`/v2` 会话中途切 cwd 都不重新裁决。
- 项目层 `http` hook 的请求头里 `${VAR}` 整值写法**不展开、按字面量原样发送**（仓库配置永不读取你的环境变量；请求照发不拒发），用户层 / 托管层照常展开。项目层插件自带的 hooks 已过逐插件授信，不再重复受此门。
- **项目层 MCP 服务器与插件同律**（0.7.0 起）：无人值守四入口对仓库声明的 MCP 服务器与插件同样只认 TUI 落盘的授信记录，顺序为**落盘拒绝（按定义指纹匹配）> 落盘允许 > `TANSR_TRUST_PROJECT_MCP=1` / `TANSR_TRUST_PROJECT_PLUGINS=1` 仅在无记录或指纹失配时放行 > 待授信**；MCP 定义变化视为失配，旧的字面路径记录只认拒绝、不借用放行。此前只靠环境变量越过落盘拒绝的部署自 0.7.0 起被拒——在 TUI 重新授信，或删除该拒绝记录。`tansr acp` 的插件发现 / 授信 / 验签与其他入口共用一套，未授信插件零加载、提示走 stderr（stdout 只写协议帧）。
- **SDK 嵌入方**（`@tansr/sdk` 0.14.0 起）：`createSession({ trustProjectHooks: true })` 即宿主替用户授信，缺省 `false` = 项目层 hooks 零执行、零 `hook.*` 事件；SDK 恒不读命令行的 `trust.json`、恒不持久化信任，授信责任由嵌入方自持。未授信而项目里确有 hooks 时经 `onWarning` 收到一条 `project_hooks_untrusted`（`detail` 携 `cwd` 与登记到的层 `projectShared` / `projectLocal`），无 `onWarning` 时回落为可恢复的 `turn.error { scope: 'sdk.notice' }`；单轮 `query()` 无信任位，项目层 hooks 恒不启用。

## 数据留存：在哪、多久、谁删

### 本机（命令行）

- 会话、配置缓存、用量队列、项目记忆落在 `<storageRoot>/`（缺省 `~/.tansr`，可经 `TANSR_STORAGE_ROOT` 或总根 `TANSR_USER_HOME` 重定向）；登录平台后新数据按账号隔离到 `<storageRoot>/identities/<账号指纹>/`。
- 每会话一目录：`journal.jsonl`（哈希链）、`meta.json`、`attachments/`、超限产物 `spill/`；图片字节缓存在 `<storageRoot>/image-cache/<sessionId>/`;Shell 长输出落 `<工作目录>/.tansr/shell-output/`;TTS 音频落 `<工作目录>/.tansr/artifacts/<sessionId>/`。
- **不会自动删除**。清理走 `tansr sessions prune`（缺省 dry-run 只列清单，`--apply` 才删；保留策略 `--keep-days` 缺省 90 与 `--keep-last` 缺省 500 取并集；今日与使用中的会话恒不删；损坏目录要 `--include-broken`）。`tansr logout` 不删身份仓数据。
- 会话结束时的 `metrics.json` 只有计数与比率，不含路径、命令、规则原文。**对外遥测缺省关闭**：当前版本不存在任何对外上报通道。
- 平台侧**不存终端会话内容，只计量**；平台会话注册表有 30 天不活跃租约，到期归档。

### 会话服务（`@tansr/serve`）

- 会话历史落在你配置的 `store` 目录 `<dir>/agent-sessions/<endUserKey>/sessions/<sessionId>/`,`endUserKey` 是终端用户 id 的哈希，不是身份；可挂冷层到你的对象存储，段是明文 JSONL（压缩）——**加密、密钥管理、驻留地、访问控制归你**（`policy.transform` 挂点）。
- 内存态短窗：终结记录保留 30 min，闲置 24 h 落盘；`DELETE /v2/sessions/:id`（`/api/sessions/:id` 同义）是关闭不是删除。**未配置保留期时 store 缺省永存**；存储保留期扫描（按天龄与每用户条数删休眠会话）**@tansr/serve 0.8.0 起提供**（工厂选项 `sessions.retention` 或两个环境变量，见[保留期与治理](/serve/retention-and-governance/#存储保留期扫描)）。真删除走 `store.delete`。
- 0.14.0 起 `Idempotency-Key` 的回执缓存是进程内内存态（每用户 256 条 / 全局 4 096 条 / 10 分钟），按 `endUserId` 隔离、随进程消亡；显式装配的 SDK2 归档宿主以「单一授权源」策略保存档案，不是备份也不同步到别处，条目删除由宿主显式调用。
- 结构化日志字段恒不含令牌与消息内容（0.13.0 起缺省级别 `warn`，各级别同样脱敏，正文键恒 `[redacted]`）；指标标签恒不含 sessionId / endUserId。
- 下行到终端的权限请求帧恒不携完整工具参数，只有目标摘要；webhook 载荷恒不携消息内容与凭据。

### 端侧

Android / iOS / 鸿蒙 SDK 不缓存凭据；视图状态在内存；是否把 sessionId 落本地（以便冷启 resume）由你决定——只存 id，不存内容，不存凭据。

## 轮换与吊销：每种凭据怎么换

| 凭据 | 怎么换 | 影响面 |
|---|---|---|
| PAT | 控制台新建一枚，本机 `tansr init --fresh` 重新登录，再在控制台删除旧 PAT | PAT 恒不被 `tansr logout` 吊销——其他设备可能还在用同一枚 |
| 本机派生应用键 | 重跑 `tansr init` 即轮换顺延（临期时会话内会有「密钥即将过期」提示）；`tansr logout` 清本地并尽力远程停用；丢失设备可到控制台手动停用该装置键 | 每台装置各持各键（按主机名 + 装置 id 命名），互不顶替 |
| 应用密钥 appkey | 控制台轮换（对应 `POST /v1/apps/:id/rotate`）；更新服务端环境变量后重启进程 | 兜底全断：旧 appkey 立即失效 |
| 某个终端用户的令牌 | 控制台或管理 API 按终端用户定向吊销（`POST /v1/apps/:id/app-user-revocations`），该用户存量令牌即时全拒；停掉他在你系统里的登录态即自然断供（令牌 TTL 60–86400 s，不存在续期） | 只影响该用户 |
| 整个应用 | 控制台停用应用 | 末端全拒 |
| 会话服务 `/v1` Bearer | 换 `TANSR_SERVE_TOKEN` / `--token` 后重启 | `/v1` 面调用方需同步 |
| webhook `secret` | 接收端先同时接受新旧两值，再换会话服务侧，再撤旧值 | 期间投递零丢失 |
| 你自己的登录 token（移动端） | 归你的登录体系；SDK 在 401 时经 `authProvider` 重取至多 2 次，仍 401 进入终态等你显式重连 | 令牌刷了再 401 就是吊销或配置错，不是抖动 |

令牌失效在平台侧只有一个码会触发：`unauthorized`（401）。会话服务收到它会在同一请求内逐出缓存令牌、重铸、重发一次；端侧 SDK 看到它就走上面的 2 次收敛。其他码（403、429、5xx）都不表示令牌坏了，不要因此重铸。

## 快速自检清单

- `tansr doctor`：凭据落在密钥库还是明文文件？`localProviders` 段是否符合你的预期（平台模式 / 逃生态）？无人值守基线有没有提示？
- 仓库里 `grep` 一次 `TANSR_APP_KEY` / `sk-` / `tansr_sk_`，确认没有真值入库。
- 会话服务绑 `0.0.0.0` 时，`/metrics` 是否只暴露给内网？`store` 目录是否本地盘、未共享？
- 你的 token 换发端点是否只在自家登录态之后签发、`endUserId` 恒取服务端会话而不信任请求体？`x-tansr-end-user` 是否只由网关写入？
- `--v2` 部署是否还开着 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1`？日志里有 `server.deprecated_option` 就该排期去掉（1.0.0 移除），审批投递改 `POST /api/approvals/:id/credential`。
- `--host-module-sha256` 是否由部署流水线随 `.cjs` 产物生成，而不是上线时手算？
- 冷层对象存储的生命周期规则与加密是否已配置？
