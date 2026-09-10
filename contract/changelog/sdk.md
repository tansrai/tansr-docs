# @tansr/sdk Changelog

> 发版门(`scripts/release/gate.mjs`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> ④ 步以 `exports.snapshot.json` 与上一 tag 比判 semver——**0.x 期任何导出集变化(增 / 删 / 签名变)至少 minor,patch 不得携新导出**
> (doc/89 §3.3「0.x minor = breaking」)。发版回执落 `doc/release/sdk-<version>.md`;无回执无 tag。
> 0.11.x 及更早版本为追溯登记(当时无本文件;doc/49 · doc/129 L20 回执位随主线改口)。

面向 SDK 消费方(开发者)的公共面变更登记;kernel / protocol 内部改动不入此表。版本号 = `packages/sdk/package.json`;
每条写「变了什么 · 对你意味着什么 · 迁移方式」。0.11.0 之前的历史见 git(`git log -- packages/sdk`)。
`tansr` 命令行 / `serve` 宿主面分别见仓根 `CHANGELOG.md` 与 `packages/server/CHANGELOG.md`(三包同律,`doc/release/README.md`)。

## 0.12.0

- AP-SP：应用 `systemPromptPolicy` 默认 fallback（SDK 显式 system 含 [] 替代平台），prepend 保留平台段在前、SDK 段在后（[] 也保留平台）。新增 systemAppend 宿主指南缝、resolveApplicationSystem 与只读 applicationPrompt 来源；query 含注入档同步追加指南。已有令牌档会话每个新轮前条件核验平台正文与策略，绕过装配缓存；轮内工具多步固定快照，刷新失败中止并保留历史，取消及30秒超时有界收口。宿主段固定；SDK/serve/Windows/Android/iOS 示例和手册同步。
- 公开 API 的 JSDoc(IDE 悬停 / `index.d.ts` / docs.tansr.com SDK 参考)改写为面向使用者的说明并补齐 94 处缺注释的导出;不再出现内部编号与流程用语。只改注释,导出集与签名不变,无需迁移(DS-33)。

> 未发(十王修案第二波收编后随 cli monorepo 一版候「发」:protocol → kernel → sdk 0.12.0 → serve 0.7.0 → cli)。

### 核心机制整改（CM；未发）

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
