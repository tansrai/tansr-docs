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
  - sdk/platform-bundle
  - support/account
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-15'
---

这一页只写**你能做的事**：知道流量去哪、把凭据放对地方、知道数据留在哪、会轮换。tansr 内部的防线（权限引擎、保护路径、硬安全红线、审计链）在各形态的指南里已经展开，这里只在与你的操作相关时引用。

## 出网：流量去哪，怎么收窄

### 命令行会连什么

| 目的地 | 何时 | 能否关 |
|---|---|---|
| tansr 平台网关 `api.tansr.com` | 登录平台模式后：模型调用、配置束拉取、心跳、用量上报、余额 | 设 `TANSR_ESCAPE_LOCAL=1` 进完全本地模式即整体停用 |
| 官方分发点 `bash.tansr.com` | 只在你显式 `/update` 或 `tansr update` 时；启动期恒不自动检查 | `TANSR_UPDATE_CHANNEL=none` 或 `TANSR_NO_UPDATE_CHECK=1`；企业可指自托管清单 `TANSR_UPDATE_MANIFEST_URL` |
| 你配置的模型供应商 | 完全本地模式下 `providers.*.baseUrl` | 由你决定 |
| 你配置的 MCP 服务器 / 自带搜索与媒体端点 | 会话内工具调用 | 由你决定；项目层 MCP 服务器须显式授信 |
| 模型经工具访问的任意 URL(WebFetch / Http) | 会话内 | 受权限规则约束；可用 `deny` 规则禁用整个工具 |

无人值守部署（`tansr serve` / headless 放权到 `auto`）的推荐基线是**网络出口白名单**：仅放行模型 API 等必要目的，DNS 与已建连接之外缺省拒绝；配合容器或最小权限专用用户、文件系统写面限工作目录。参考模板在仓内 `deploy/serve/`。

已在场的两道用户可见防线：同一条命令里既引用秘密文件（`.env`、密钥、`.aws/credentials`）又带外发动作（`curl` / `scp` / `git push` …）恒被拒绝，任何模式与规则压不过；会话一旦读过秘密文件，其后的外发动作一律转为询问（会话污点）。**tansr 命令行 0.6.0 起**：全部出网（WebFetch / Http / hooks / 音频下载）改经统一出口，DNS 解析后再判私网、环回、链路本地地址，指向内网或元数据地址的抓取被拒并给出原因；Http 工具与 hooks 可引用的凭据环境变量收敛到白名单 `http.allowedAuthEnvVars`，名单外不发请求。

### SDK 与会话服务会连什么

- `@tansr/sdk` 令牌档只连你传入的 `baseUrl`（平台网关）以及你显式配置的 MCP 服务器；SDK 恒不扫用户目录、恒无自带搜索端点。
- `@tansr/serve` 上游链是 `appid/appkey → POST /v1/app-tokens → GET /t1/config + POST /t1/heartbeat → POST /t1/exchange`，全部指向 `apiBaseUrl`；另有你配置的轮末 webhook URL（出站请求恒不带任何鉴权凭据头，真伪凭签名）与可选冷层对象存储。
- 移动端 SDK 只连你的会话服务 `baseUrl`，不直连平台。

## 凭据：放哪、不放哪

| 凭据 | 代表谁 | 正确位置 | 恒不放 |
|---|---|---|---|
| 个人访问令牌（PAT） | 你本人 | 控制台生成后只喂给 `tansr init`（掩码输入）或 CI 的 `TANSR_PAT` 环境变量 | shell 历史（`--pat` 直给会留痕）、脚本明文、仓库 |
| 本机派生应用键 | 你的这台设备 | `tansr init` 自动写入操作系统密钥库（macOS Keychain / Linux secret-service / Windows DPAPI）；不可用时降级 0600 文件并明确警示 | 不需要你碰；`tansr doctor` 的凭据存储段可看落点 |
| 模型供应商 API key（完全本地模式） | 你的供应商账号 | 环境变量；配置文件里**只写变量名** `auth.env` | `settings.json`、错误消息、`/config` 输出（它们永不携带值） |
| 应用密钥 appid / appkey | 你的应用 | 你的服务端进程环境变量（Node 进程或 `@tansr/serve`） | 终端设备、日志、错误响应、版本库（`.env` 入 `.gitignore`） |
| 短期 `app_user` 令牌 | 你的某个终端用户 | Electron 主进程内存；`@tansr/serve` 进程内部 | renderer 进程、持久化存储；移动端**从不**接触它 |
| 你自己的登录 token（移动端） | 你的用户 | 经 `authProvider` 按次提供，SDK 不持久化 | SharedPreferences / DataStore / UserDefaults / 日志 |
| 会话服务 `/v1` Bearer(`--token` / `TANSR_SERVE_TOKEN`) | 运维方 | 环境变量 | 与 `/v2` 面互不相通，不要复用给终端用户 |
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
- 内存态短窗：终结记录保留 30 min，闲置 24 h 落盘；`DELETE /v2/sessions/:id` 是关闭不是删除。**未配置保留期时 store 缺省永存**；存储保留期扫描（按天龄与每用户条数删休眠会话）**@tansr/serve 0.8.0 起提供**（工厂选项 `sessions.retention` 或两个环境变量，见[保留期与治理](/serve/retention-and-governance/#存储保留期扫描)）。真删除走 `store.delete`。
- 结构化日志字段恒不含令牌与消息内容；指标标签恒不含 sessionId / endUserId。
- 下行到终端的权限请求帧恒不携完整工具参数，只有目标摘要；webhook 载荷恒不携消息内容与凭据。

### 端侧

Android / iOS SDK 不缓存凭据；视图状态在内存；是否把 sessionId 落本地（以便冷启 resume）由你决定——只存 id，不存内容，不存凭据。

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
- 你的 token 换发端点是否只在自家登录态之后签发、`endUserId` 恒取服务端会话而不信任请求体？
- 冷层对象存储的生命周期规则与加密是否已配置？
