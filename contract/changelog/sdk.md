# @tansr/sdk Changelog

> 发版门(`scripts/release/gate.mjs`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> ④ 步以 `exports.snapshot.json` 与上一 tag 比判 semver——**0.x 期任何导出集变化(增 / 删 / 签名变)至少 minor,patch 不得携新导出**
> (doc/89 §3.3「0.x minor = breaking」)。发版回执落 `doc/release/sdk-<version>.md`;无回执无 tag。
> 0.11.x 及更早版本为追溯登记(当时无本文件;doc/49 · doc/129 L20 回执位随主线改口)。

面向 SDK 消费方(开发者)的公共面变更登记;kernel / protocol 内部改动不入此表。版本号 = `packages/sdk/package.json`;
每条写「变了什么 · 对你意味着什么 · 迁移方式」。0.11.0 之前的历史见 git(`git log -- packages/sdk`)。
`tansr` 命令行 / `serve` 宿主面分别见仓根 `CHANGELOG.md` 与 `packages/server/CHANGELOG.md`(三包同律,`doc/release/README.md`)。

## 0.14.0 — 候选(未发版;版本号与发版节奏待用户拍板)— 2026-09-11

SDK 资源生命周期整改(RF-04,含代拍 #3 A / #4 B)+ contract-v0.27 换形(RF-P1)。导出集 506 项名单零增删,7 项签名变化(`AgentSession` /
`CreateSessionOptions` / `ManagedQueryOptions` / `SessionDrainOptions` / `SdkCleanupHandle` / `SdkLifecycleError` / `SessionNotice`),按 0.x 规则至少 minor。

- **会话事件积压有界**:首订阅者到来前的积压受 `CreateSessionOptions.events` 的条数 / 近似字节双上界约束,缺省 1000 条 / 2 MiB;
  超界丢最旧、最新一条恒保留,队首以恰一条一等事件 `session.events_dropped { scope: 'sdk.events', droppedCount, reason: 'count_limit' | 'bytes_limit',
  droppedBytes, firstDroppedSeq, lastDroppedSeq, maxEvents?, maxBytes? }` 通报(protocol contract-v0.27,RFC-RF-1 / DEC-RF-20;`Infinity` 上界以键缺席表达;
  `droppedBytes` / `maxBytes` 为 JSON 文本长度近似度量;`contract/MANIFEST.json` revision 6 → 7,型表 54 → 55)。`SessionView` 把它归入 `notices`
  (`code: 'session.events_dropped'`、无 `message`、`detail` = 载荷去 type / scope),Narrator 出一行 `events dropped [scope]: N event(s) dropped (reason)`。
  上界以内「晚到首订阅者收全量积压」不变;直播后订阅者全部离场期间的事件不再堆积(此前无界增长)。**对你意味着**:长跑会话即便忘记订阅也不会
  耗尽内存;需要更多积压时 `events: { maxBacklogEvents, maxBacklogBytes }`(正数或 `Infinity`)。迁移:在 `send()` 前挂上订阅者的现有代码零改动;
  **按 `type` 判别通报的宿主需改判 `session.events_dropped`**——本候选段此前登记的过渡形 `turn.error { scope: 'sdk.events', errorKind: 'events_dropped' }`
  未随任何已发版本发布,一步换形、不双发、不合成旧形。
- **变更:`SessionNotice.message` 变为可选**(`message?: string`;RFC-RF-1 R2 / DEC-RF-20 QA-RFC-02 (b)):`turn.error{recoverable:true}` 归约仍带
  `message`,`session.events_dropped` 归约不带(零文本事件不合成文案)。**迁移**:宿主按 `code` 渲染、`message` 仅作兜底(如 `notice.message ?? notice.code`)。
- **`signal` 监听释放**:会话级 `signal` 的 abort 监听在 `close()` 时解除;多会话共享 shutdown signal 时已关闭会话可被 GC,abort 后不重复
  close;创建前已 aborted 的信号仍立即 close。无需迁移。
- **fork 事务边界**:`createSession({ fork })` 的新会话记录改在工装 / 模型装配成功后落 store,装配或登记失败时删除已落记录(store 列表
  零净增、无 `meta.cwd` 缺席的孤儿);自建五方法 store 的 fork 回落径 `create()` 同携 `cwd`。无需迁移。
- **close 后全表 `session_closed`**:`setModel` / `setThinking` / `interrupt` 在已关闭会话上改为 throw `session_closed`(此前静默改状态 /
  空操作),`setModel(alias)` 先于别名解析拒绝(不构造新 client,`currentModel()` 不变);只读方法照旧可读。**迁移**:若曾在 close 后调用
  这三者,改为在 close 前调用或捕获 `session_closed`。
- **`pushBody` 弃用**:`AgentSession.pushBody` 自公开类型声明剥离(`@internal`;运行时对象保留一个版本周期,close 后调用 throw
  `session_closed`)。它从未是承诺面(装配层入流口),外部代码请勿依赖;需要向事件流注入自定义通告的宿主请提需求。
- **令牌 getter**:`token` 接受 `() => string`:bundle / heartbeat、模型直连、媒体工具、`session.platform` 直连客户端、提示词刷新器
  五类平台请求发起时取现值携 `x-tansr-app-token`,令牌轮换后无需重建会话;getter 须回非空字符串。字符串形态零变化。`query()` 同律。
- **收尾悬挂有界 + `drain({ force })`**:违约适配器(`settle()` 回 pending>0 / 超时)的收尾不再永久悬挂,改为屏障保护——缺省 `drain()`
  只观察不释放自有资源(既有语义);`drain({ force: true })` / `closeAsync({ force: true })` / 单轮 `cleanup.drain({ force: true })` 在预算
  耗尽后释放屏障、对仍在飞的收尾记 `query_settlement_forced` / `compaction_settlement_forced`,随后直接释放自有资源(会话级 MCP host
  的 `close` 被调用)并以同一预算等待完成,结果 `status: 'failed'` 携结构化失败。对未关闭会话无效。无需迁移。
- **`query()` 结果保真**:收尾观察失败 / 超时时仍以 `SdkLifecycleError` 结束(既有契约),新增 `error.result` 携已完成的 `QueryResult`
  (不整体替换),`onLifecycleError` 同携;消费者自身抛错时缺席。迁移:需要终态文本的调用方读 `error.result?.finalText`。
- **`env` 决定出网代理**:`CreateSessionOptions.env` / `ManagedQueryOptions.env` 的 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 参与
  WebFetch / Http 工具与 hooks http 的代理决策,`process.env` 不再被读取(缺席仍为进程级单例);同一 `env` 对象共享连接池。**迁移**:
  依赖 `process.env` 代理却传了自定义 `env` 的宿主,把代理三变量并入所传 `env`。
- **新增:`CreateSessionOptions.trustProjectHooks?: boolean`——项目层 hooks 信任门(托管档)**:缺席 / `false` 时,工作区
  `.tansr/settings.json` / `settings.local.json` 声明的 command / http hooks 不启用——零执行、零 `hook.*` 事件(user 层 / managed 层 hooks
  照常);`true` = 宿主代表用户为该工作区授信,项目层 hooks 照跑。SDK 不持久化信任、不读 `tansr` 命令行的工作区信任记录,授信事实由宿主
  自行向用户确认并逐次传入;prompt 型 hook 无执行体,抽取期即丢弃(与授信无关)。门住的项目层 hooks 在场时通报一次
  `SdkWarning { source: 'sdk', code: 'project_hooks_untrusted', detail: { cwd, registered: { projectShared?, projectLocal? } } }`(`onWarning`;
  缺席回落事件流 `turn.error { scope: 'sdk.notice', recoverable: true }`,`SessionView.notices` 以 `scope: 'sdk.notice'`、`message` 前缀
  `project_hooks_untrusted:` 收到)。**对你意味着**:此前克隆一个仓库、`createSession` 一起就会跑起来的项目层 hooks,现在缺省不再执行——
  **行为收紧**,user 层 hooks 与注入 / 令牌档零变化。迁移:已向用户确认工作区可信的宿主传 `trustProjectHooks: true`;托管 `query()` 共用
  同一装配、同受此门(`ManagedQueryOptions` 暂无授信位,项目层 hooks 在 `query()` 内恒不启用,通知只经 `onWarning`)。
- **新增:`CreateSessionOptions.hostShell?: 'posix' | 'powershell'`——权限引擎 Shell 命令词法方言**:缺席随平台(kernel `detectHostShell()`,
  与内置 Shell 工具实际派生的 shell 一致,零现状变化);显式值直达 kernel 权限引擎(`PermissionEngineConfig.hostShell`),供测试或跨平台装配
  演练(如在 Windows 上按 posix 词法演练规则)。与真实执行 shell 错配会让 Shell 命令词法守卫与执行环境脱节,生产宿主不应设置;三档皆生效。
  无需迁移。两项均为可选键纯加法:导出名单零增删,`CreateSessionOptions` 与派生的 `AssembleToolingOptions` 两项签名变化。
- **新增:`CreateSessionOptions.budget?: SessionBudgetOptions`——会话预算闸(DEC-RF-29;导出集 +1 名 `SessionBudgetOptions`,
  `CreateSessionOptions` 签名变化)**:形 `{ maxUsd?, maxTotalTokens?, onExceeded?: 'block' | 'warn' }`,与配置文件 `budget` 段同形,`tansr` 命令行
  四形态(TUI / headless / serve / acp)与 SDK 自此读同一段形、走同一 kernel 闸门语义——会话累计消耗触顶时,`'block'`(缺省)在下一次模型调用前
  终止本轮(事件流 `turn.aborted { reason: 'budget_exceeded' }`,会话保持打开、后续轮同拦),`'warn'` 每次查询至多一条
  `turn.error { scope: 'budget', recoverable: true }` 后照常继续;两个上限都缺席 = 不接闸(等价不传)。消耗读会话内部账本(消费本会话
  `cost.usage.updated`,含子代理上卷;思考 token 按各模型能力位并入输出、不重复计):`maxTotalTokens` = 输入 + 输出 + 缓存读 + 缓存写;
  `maxUsd` 只对以 USD 计价的模型出数——令牌档按平台 bundle 计价,托管 / 注入档当前内置价目为 CNY,`maxUsd` 不设防,币种无关兜底用 `maxTotalTokens`。
  选项非法(非正数 / 非正整数 / 词表外)在任何 IO 前以 `TansrSdkError('invalid_options')` 拒绝。与 `thinking.budget`(单轮思考 token 预算)无关。
  可观测面只走既有 `turn.aborted` / `turn.error` 通道,不新增事件类型(DEC-RF-48)。无需迁移:不传 `budget` 零变化。

## 未发布(RF-06;`QueryCounters` 签名变化 → 下一版至少 minor,版本号由发版时定)

- `QueryCounters` 新增两个可选计数字段 `apiRounds`(模型派发总数,恒不退还)与 `recoveryAttempts`(同轮恢复重试:可恢复错误重发 / 上下文溢出压缩重试 / 输出触帽升档重发);`modelTurns` 仍是预算口径(可恢复错误重试退还),语义不变。只读计数、加法字段,既有消费方无需迁移;用 `deepEqual` 锁定整个计数对象的测试需补这两个字段。
- 查询事件流关闭即取消:对 `events` 调 `return()` / `throw()`(含 `for await` 提前 `break`)现在会取消本轮——在飞模型流与工具经 `signal` 见到中止(reason 为 `'iterator_closed'`),句柄进入终态,不再有事件产出,也不签发终局事件。此前提前退出只在下一个屏障点停下,在飞的模型流 / 工具会不受打扰地跑完。`compactNow()` 对已关闭的查询立即以新增的拒绝原因 `query_closed` 返回(此前可能悬挂到屏障点)。依赖「退出循环后在飞工具仍会跑完」的调用方需改为消费到终局事件再退出。
- 会话预算的 `totalTokens` 口径由 kernel 单点 `budgetSpendOf` 给出:思考(reasoning)token 视为输出的子集不再叠加计入(此前 CLI / serve 装配层各自相加导致重复计费口径);已配置 `budget.maxTotalTokens` 的会话可能比此前更晚触顶,属口径修正。

## 未发布(RF-08b;`Tool` 签名变化 → 下一版至少 minor,版本号由发版时定)

- **工具入参由调度器中央校验(只作门、原参下行)**:`Tool.inputSchema` 成为被兑现的契约——每次工具调用执行前,调度器按 `inputSchema`
  校验入参,不合法即以 `tool.failed { errorType: 'invalid_args' }` + `isError` 结果回喂模型;工具 `execute` 不被调用、不触发权限裁决、
  不计入工具执行指标。校验只作门:通过后权限裁决与 `execute` 见到的仍是模型给出的同一个原参对象(不做 zod 缺省补齐、不剥 schema 外键、
  含 `.transform()` 的 schema 其产物也不下行);PreToolUse hook 的 `updatedArgs` 同过校验、同以原对象下行。诊断文案有界(最多 20 条
  issue、约 2 KB,超出附省略标记)。**对你意味着**:`defineTool` 工具的坏参此前走到 `execute` 内自校、以 `tool.completed { isError: true }`
  出线,现在以 `tool.failed` 出线且无 `tool.started` / `tool.completed`;`defineTool` 的 `execute` 内自校仍是约定、仍是 handler 参数的
  唯一来源(handler 拿到的是自校 parse 出的产物,含 transform / 缺省值 / 剥除 schema 外键),坏参不会再触达它;自定义 `Tool` 的 `execute`
  收到的是模型原参,需要产物的请自行 parse。**迁移**:按 `tool.completed.isError` 识别坏参的消费方改看 `tool.failed.errorType === 'invalid_args'`;
  工具 schema 无需为此改动。
- **`Tool.argsValidation?: 'dispatcher' | 'remote'`**(加法可选位;`Tool` 签名变化,导出名单零增删):缺省 = 调度器校验;`'remote'` =
  本地不校验、原参透传由远端按自身契约裁定,用于 `inputSchema` 只是远端契约宽松投影的桥接工具(SDK 内建 MCP 桥与 serve /v2 客户端
  申报工具自动声明,两者行为零变化)。无需迁移。

## 0.13.1 — 2026-09-11

- 统一四媒体的系统工具说明与缺少平台连接时的错误提示，补齐 `tools.builtin` 中英文示例，明确平台提供方授权与工具归属的区别。
- 旧 `tools.platform` 兼容别名、错误码、授权字段、默认显式选择和计费行为保持；无需迁移现有调用。同步此前公共声明注释整理，不新增导出或改变签名。

## 0.13.0 — 2026-09-10

- 汇总此前未发布的 0.12.0 候选能力，并增加 AgentSession 的同轮文本投递、目标、能力发现和状态查询公共接口（INJ）；相对旧候发标签按 minor 推进。
- 文本追加继续当前会话与查询循环；accepted 是内存接纳，consumed 是进入权威历史，不代表模型完成或持久投递。当前及上一轮的有限回执不能作为永久幂等保证。
- AP-SP 平台系统提示词与 SDK system/systemAppend 保持原分层；当前轮快照稳定，下一显式新轮自动刷新平台配置。
- 公开 API 的 JSDoc(IDE 悬停 / `index.d.ts` / docs.tansr.com SDK 参考)改写为面向使用者的说明并补齐 94 处缺注释的导出;不再出现内部编号与流程用语。只改注释,导出集与签名不变,无需迁移(DS-33)。
- 新包携 contract/MANIFEST.json；Demo 在正式 registry 验证后同步依赖。旧 0.12.0 标签和以下候选说明仅作历史记录，真实发布以回执为准。

## 0.12.0

- AP-SP：应用 `systemPromptPolicy` 默认 fallback（SDK 显式 system 含 [] 替代平台），prepend 保留平台段在前、SDK 段在后（[] 也保留平台）。新增 systemAppend 宿主指南缝、resolveApplicationSystem 与只读 applicationPrompt 来源；query 含注入档同步追加指南。已有令牌档会话每个新轮前条件核验平台正文与策略，绕过装配缓存；轮内工具多步固定快照，刷新失败中止并保留历史，取消及30秒超时有界收口。宿主段固定；SDK/serve/Windows/Android/iOS 示例和手册同步。

> 历史候选归档：0.12.0 没有单独发布，以下内容并入 0.13.0；本地旧标签保留在原候选源码。实际发布以回执和 registry 为准。

### 核心机制整改（CM；历史候选内容）

- 自动/空闲摘要被质量校验拒绝时，已报告用量仍进入公共成本事件；拒绝摘要不替换历史。取消前已到达的用量会保全，不臆造尚未报告的费用（CM-02）。
- 直接调用 `runIdleCompaction` 的宿主须消费失败结果的 `events`；`IdleCompactionResult` 失败支路不再保证空数组，可能包含已报告的成本事件。导出名称数量不变，签名快照随本 minor 更新（CM-02/17）。
- 小上下文窗口的输出回退预算尊重自适应下限、调用方上限和测得的正剩余；零/负估算余量明确告知，并保留实际溢出的既有恢复通道（CM-06）。
- 四媒体工具在 provider 调用前校验参数；文件原子写失败保旧，大文件分页窗口驻留有界，工具超时增加残余操作提示。宿主无需新增一层媒体审批，重试有副作用工具前应确认旧操作已停止（CM-04/08/09/15）。
- 平台 ASR 工具、任务提交与 `session.platform.transcribe` 共用实际 JSON 体积预检；原始音频 24 MiB 与 JSON 32 MiB 分开守卫，越限在 fetch 前报错。URL 仍可用，BYO 不套用平台 JSON 帽（CM-11）。

### 发版门接管(FX-C-25)

- `prepublishOnly` 恒过 `gate.mjs` 六步;`exports.snapshot.json` 基线入仓(第二波收编后再生),自本版起导出集变化由门判 semver;
  README「3 平台位」订正为五平台位并写明 `permission.mode` × 裁决人例外。

### 兼容径(收回 0.11.0 的一处 breaking)

- **`permission.mode` 与缺省注入的裁决人不再互斥抛错**(FX-B-06;复审 Q-05)。0.10 的合法输入
  `createSession({ token, baseUrl, permission: { mode: 'acceptEdits' } })` 在 0.11.0 会 throw `invalid_options`;
  自本版起:令牌档 bundle 裁决人是**缺省注入**(平台底档),你显式给了 `permission.mode` 即视为「自管模式」——
  裁决人**不装**、模式按你给的值、`onPlatformWarning` / `onWarning` 收一条 `adjudicator_skipped_by_mode`
  通报(含正道指引)。**显式** `adjudication: { … }` 与 `permission.mode` 同现仍是真矛盾,照旧 fail-fast
  `invalid_options`。要静默自管:`adjudication: { enabled: false }`。

### 行为变化(收紧)

- **B 姿态 × 资格档 `none` 的会话不再切 `auto` 模式**(FX-B-05;复审 J-03)。裁决人在场时的权限模式由 kernel
  `modeUnderAdjudicator({ posture, tier })` 单点推导:`headless` × `none` → `default`,其余 → `auto`。此前一律
  `auto` 连带工作区快路径——cwd 内 Write / Edit / rm / mv **零咨询放行**;而 tier `none` 的裁决人对 safe 零软化权,
  切 auto 换不到任何裁决对价。受影响形:未接 `askUser`、bundle 裁决人档无 `tier` 的会话——cwd 内写删从
  「零咨询放行」变为「ask → 无通道 deny(`decisionSource:'policy'`)」。要保留写删放行:给档授格(控制台 → 应用 →
  裁决人 → 资格档 ≥ low)或接 `permission.askUser`(A 姿态照切 auto)。
- **权限门重判律与 cli 门同源**(FX-B-10;复审 J-04 / J-05):`createSdkPermissionGate` 的「PreToolUse hook 入参
  替换后重判叠加」「hook 明示 `decision:'ask'` 恒不被裁决人代批」「`fallbackRedecide` / `approvalRedecide` 两重判位
  跳过 hooks 重跑与二次咨询」改为 import kernel `permissions/gate-recheck.ts` 同一份实现。可见差异:同严格度重判
  现取替换后参数的真实归因(此前用 `>` 丢弃);两重判位现被识别(此前 hooks 会重跑、审批桥径会二次咨询)。
- **机器放行也出 `tool.permission.decided`**(FX-B-09):裁决人放行恒发 `decided{allow, decisionSource:'classifier'}`;
  模式放行对非只读调用发 `decisionSource:'mode'`;规则 / 用户 / 策略与只读放行不发。`onDecision` 缝形不变。
- **`ErrorView.recoverable` 必填 + `SessionView.notices`**(FX-B-29;R-05 / M-08):可恢复的咨询帧(如 serve 落卷失败
  `turn.error{recoverable:true}`)不再污染 `lastError`,改入 `notices`(FIFO,上限 `SESSION_NOTICES_MAX` = 20);
  `ErrorView.recoverable` 由可选改必填,自定义投影请补该字段。
- **工具失败以 `tool.completed.isError` 出线**(FX-B-25;R-17):四媒体工具超时 / 供应商失败不再伪装成 `tool.failed`,
  reducer 把 `isError:true` 归约为 failed 卡;protocol `ToolCompletedEventSchema.isError?` 为加法。
  `contract/MANIFEST.json` revision 1 → 2。
- **fork 出的会话历史分页不再走尾装载快径**(FX-B-24;C-09 / V-B-44):`getHistoryPage` 对 `forkedFrom` 会话恒全量读,
  修正分页 `total` 少一的缺陷;API 形不变。
- **capabilities 段整段坏形回落零能力档,不再回落平台缺省档**(FX-A-15 sdk 半边;复审 Q-02 / V-A-43)。此前 bundle
  `capabilities` 段在场却解析失败(位非 boolean / 段非对象)→ `DEFAULT_APP_CAPABILITIES`(read / glob / grep / list /
  todoWrite / askUser / customTools 七位**被打开**,hosted 应用回落 embedded 档 = fail-open);自本版起 → `zeroAppCapabilities
  (platform)`(`tools` 全 false;hosted 回落 hosted 档)并经 `onPlatformWarning` / `onWarning` 通报
  `capabilities_unparsed{ detail.issues: ZodIssue[] }`(随 bundle 缓存,每次装配都到)。**段缺席**(旧 api / 装置键径不发段)
  仍回落 `DEFAULT_APP_CAPABILITIES`、零通报(行为不变)。新导出 `zeroAppCapabilities(platform)`;`AppBundle.capabilitiesIssues`
  加法键(null = 解析成功 / 缺席);`PlatformWarning.detail?` 加法键。
- **capabilities 三 schema `.strict()` → `.strip()`**(FX-A-15;段内加键零击穿):`CapabilityToolsSchema` / `CapabilityPlatformSchema`
  / `AppCapabilitiesSchema` 对段内未知键**剥除不炸**(已知位仍逐项 boolean 校验)。此前 api 段内新增任一键会让整段判坏并回落
  缺省档(音频两键教训);自本版起只剥未知键。放宽:直接用三 schema 判「未知键必拒」的调用方须自行加门。
- **`AppBundleModel.modelId` 可选**(M-07;候拍 A22):api 令牌径剥 `models[].modelId` 后条目照收(此前缺键即整条剔除 →
  bundle 模型面蒸发);缺席 / 空串 / 非串 = 键缺席。读 `model.modelId` 的调用方按 `string | undefined` 处置。
- **Read 图片分支按会话当前模型放行**(FX-B-20;T-15 / V-39):`createSession` / `query` 把当前模型的图片输入三态以 getter
  注入 kernel Read 门 2(托管档经 registry 含 capability 覆写,令牌 / 注入档回落 providers 内置能力表;`setModel` 热切换
  即时生效)。此前 SDK 面 Read 图片**恒拒**且文案误称「模型不支持」;现内置表收录且 `inputModalities.image:'supported'`
  的模型返回 image 块,未收录模型仍拒但如实说「本执行面不知道(unknown)」。零配置变化。
- **套餐配额拒绝在事件流面可判**(FX-B-20;M-03,protocol contract-v0.26):`turn.error` 加法可选位 `detail`,
  平台套餐四码(`plan_concurrency_exceeded` / `plan_end_users_exceeded` / `plan_required` / `plan_tier_insufficient`)
  携 `detail: { scope: 'plan' }`——与 serve HTTP 面 `error.detail.scope` 同键同值;reducer 落 `ErrorView.detail`(失败形)
  / `SessionNotice.detail`(咨询形),缺席不落键。`contract/MANIFEST.json` revision 2 → 3(`eventSchemaSha256` 变)。

### 加法(进阶 API)

- `assembleTooling` / `buildSdkToolSet` 选项 `imageInput?: () => InputModalityMode | undefined`(FX-B-20 / T-15):Read 图片门 2
  谓词注入缝;缺席 = 未接线恒拒(与 0.11 同)。`createSession` / `query` 已内部注入,直接调用两函数的进阶用户按需传。
- `ErrorView.detail?: Record<string, unknown>`(FX-B-20 / M-03):`turn.error.detail` 透传;首个取值 `{ scope: 'plan' }`。

- 快照是附属能力(FX-B-23):`listCheckpointsDetailed` / `planCheckpointRetention` / 类型 `CheckpointRetention`,
  `WriteCheckpointResult.retentionWarning`——单档隔离、GC 不再误删、杂散 `notes.json` 不再整体 `CHECKPOINT_INVALID`;
  `listCheckpoints` 数组形保留。
- 裁决人通报码集导出(FX-B-11):`ADJUDICATOR_UNAVAILABLE_WARNING`(冻结 `{ code, message }`)与
  `DEVELOPER_ONLY_ADJUDICATOR_WARNING_CODES`(四码,仅开发者受众)。
- 平台 bundle 缓存键四维 `bundleKey(base, appId, scope, featuresFingerprint)`(FX-C-16;S-08):不同径别 / 能力位组合不再
  串档;`AppTokenMinter.invalidate?`(FX-C-15;R-02)按 api `detail.reason` 逐出失效令牌。
- **令牌径失效码与 `detail.reason` 词表由 api openapi 生成**(FX-C-15/片段;M-13 / R-02):新导出
  `TOKEN_INVALIDATING_CODES`(今日 `['unauthorized']`)/ `APP_TOKEN_REJECT_REASONS`(六值)/ `APP_TOKEN_TRANSIENT_REASONS`
  (`['check_unavailable']`;收到不失效不重铸)+ 谓词 `isTokenInvalidatingCode` / `isTransientAppTokenReason` + 类型
  `TokenInvalidatingCode` / `AppTokenRejectReason`——皆来自 `platform/error-codes.generated.ts`(由 vendored
  `contract/openapi.json` 顶层 `x-tansr-error-codes[]` 经 `scripts/contract-error-codes.mjs` 生成,零时间戳;
  `pnpm contract:check` 再生零 diff 门)。持有 `x-tansr-app-token` 缓存令牌的宿主(serve `refreshingFetch`)据此判失效,
  不再手写码集;api 新增一码带 `x-invalidates-token` → sdk 再生即得。
- **bundle `governance.sessionRetentionDays` 形状级透传**(FX-A-17/片段;M-05):`parseAppBundle` 新增 `governance:
  AppBundleGovernance`(`{ sessionRetentionDays?: number }`;整数 ≥ 1 才落键,段缺席 / 坏形 = `{}`),`assemblePlatformModel`
  产物 `AssembledPlatformModel.governance` 同形透传;新导出类型 `AppBundleGovernance`。SDK 自身零消费——宿主(serve 平台会话
  工厂)据此把会话保留期缺省 30 d 改读 org 配置值;段内其余键(org / licenseStatus / softLock / budgets)仍不解析。

- **平台媒体错误 hint 单源表 + 受众档**(FX-B-26;复审 M-02 / M-08 / M-07 残留):新导出 `hintFor(face, code, audience?)`
  与类型 `MediaHintAudience` / `MediaHintFace`;`PlatformMediaProviderOptions` 加可选键 `audience?: 'app' | 'user'`(缺省
  `'app'`,sdk / serve 令牌档文案逐字不变)与 `hintOf?: (code) => string | undefined`(覆写缝)。**行为变化**:词表外码
  (如 `http_502` / `rate_limited`)的 `MediaProviderError.hint` 从 `''` 变为**缺席**,kernel 工具文本据此回落
  `MEDIA_GENERIC_HINT`(与 BYO 径一致);`not_found` 新增 hint。宿主若按 `hint === ''` 判「无指引」请改判缺席。

### 公共面形变(进阶 API)

- **`assembleTooling` 选项 `adjudicator?: PermissionClassifierConfig` → `adjudication?: AssembleToolingAdjudication`**
  (`{ classifier, posture, tier, explicit }`;FX-B-05 / FX-B-06)。`createSession` / `query` 用户不受影响(两入口内部
  已改传);直接调用 `assembleTooling` 的进阶用户把 `adjudicator: assembled.config` 改为
  `adjudication: { classifier: assembled.config, posture: assembled.posture, tier: assembled.tier, explicit }`
  (`assembled` = `assembleTokenTierAdjudicator` 产物;`explicit` = 开发者是否显式给了 `adjudication` 选项)。
  新导出类型 `AssembleToolingAdjudication`。

## 0.11.1 (2026-09-06)

- 追溯登记(FX-C-25;当时未发回执):本版为 **patch 却携新公共导出 `runStorageConformance`**(会话存储一致性套件)——按 doc/89 §3.3
  0.x 口径应为 0.12.0 的 minor;误发已成事实,不回收,自 0.12.0 起由发版门 ④ 步机器禁止「patch 携新导出」。
- 存储出口补齐:`createFsBlobStore` / `createChaosBlobStore` / `runStorageConformance` 及类型经 `@tansr/sdk` 出口(IO-14)。
- 无其他行为变化。

## 0.11.0 (2026-09-06;随 @tansr/cli 0.4.0 / @tansr/serve 0.6.0 发版)

### Breaking

- **BREAKING:令牌档缺省装配 bundle 裁决人,`permission.mode` 与之同现 fail-fast**(doc/113 §4.4 G-5;复审 Q-05 登记为
  breaking)。`createSession({ token, baseUrl, permission: { mode } })` 这一 0.10 合法输入在本版 throw
  `TansrSdkError('invalid_options', 'assembleTooling: "permission.mode" and an adjudicator are mutually exclusive …')`
  (0.10 及更早:静默择一)。当时的迁移方式:删 `permission.mode`,或传 `adjudication: { enabled: false }` 自管模式。
  **0.12.0 起以兼容径收回**(见上),本条保留为历史登记。

### 加法

- 权限裁决姿态(doc/113):`adjudication?: { posture?: 'human-in-loop' | 'headless'; callBudget?; enabled?; endUser? }`;
  姿态缺席按 `permission.askUser` 在场性推导;`askUser` 第三参 `decision` 携 `source:'classifier'` + `reason`。
- 裁决协议 v4 / 应用协议单阶段;bundle `adjudicator[s].tier` 资格档解析;`onPlatformWarning` 通报码
  `adjudicator_unavailable` / `adjudicator_model_unavailable` / `adjudicator_budget_exhausted` /
  `adjudicator_breaker_tripped` / `adjudicator_evidence_drifted` / `adjudicator_posture_overridden`。
- 会话持久化一期二期(`SessionStore` / `createFileSessionStore` / fork / resume)。
- 其余 0.11.0 变化(令牌档 / 三环工具入口 / 渲染管道等)见 doc/90 技术手册与 doc/49 回执;本文件自 0.12.0 起逐版机器化。
