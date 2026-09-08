# @tansr/serve Changelog

> 发版门(`scripts/release/gate.mjs`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> ④ 步以 `packages/server/exports.snapshot.json` 与上一 tag 比判 semver——**0.x 期任何导出集变化(增 / 删 / 签名变)至少 minor,patch 不得携新导出**
> (doc/89 §3.3「0.x minor = breaking」)。发版回执落 `doc/release/serve-<version>.md`;无回执无 tag(tag 形 `@tansr/serve@<version>`)。
> 0.6.x 及更早版本为追溯登记(当时无本文件;本文件由十王修案第五波 C-γ「CHANGELOG 三包就位」建立,**不发版**)。

面向 serve 宿主(自托管 `@tansr/serve` 库 / `tansr serve` 运维方 / tansrd 池)的公共面变更登记:公共导出(`packages/server/src/index.ts`)、
/v1 · /v2 HTTP 面、进程协议帧、运维旋钮(`SERVE_RUNTIME_ENV` 表)、指标 / 结构化日志事件、webhook 出线形。kernel / sdk 内部改动不入此表
(sdk 面见 `packages/sdk/CHANGELOG.md`)。版本号 = `packages/server/package.json`(包目录 `server`,发布名 `@tansr/serve`);
每条写「变了什么 · 对你意味着什么 · 迁移方式」。0.6.0 之前的历史见 git(`git log -- packages/server`)。

## 0.7.0

> 未发(十王修案 W1–W4 已收编于 cli main `9f09c1b7`,随 cli monorepo 一版 / 二版 / 三版子集候「发」:protocol → kernel → sdk 0.12.0 → serve 0.7.0 → cli)。
> 导出集:`exports.snapshot.json` 由发版门首版基线 364(0.6.1 dist,W2 FX-C-25)→ W2 收编 375 → W3 收编 395(W3 回执 §一)→ W4 收编 395
> (导出数不变,`AssembledSessionModel` / `AgentSessionRetentionSweepInput` 两签名变;W4 回执 §一)。以下逐条按波次的收编回执与 C-α / C-β 终报为事实源;
> 每条括注卡号(FX-C-nn)与所属波次。

### 发版门接管(FX-C-25 · W2)

- `prepublishOnly` 恒过 `scripts/release/gate.mjs --package server` 六步;`exports.snapshot.json` 基线入仓,自本版起导出集变化由门判 semver;
  tag 形 `@tansr/serve@<version>`(非目录名 `server`);发版回执 `doc/release/serve-<version>.md`。本文件即门 ③ 所指。

### 行为变化(收紧 / 修正;宿主须知)

- **建会临界区改票据形 `beginCreate`**(FX-C-01 · W1):/v2 注册仓「合并 / 预留 / 登记」收为单一同步调用,`AdoptFailure` 经票据双向传,
  同 `sessionId` 并发建会**后到者 200 attach**(此前 `routes.ts:529` 裸拒绝 → 500 / `unhandledRejection`)。宿主若自实现注册仓,按
  `BeginCreateResult` / `CreateTicket` 形(registry 内部型,非公共导出)对齐;HTTP 消费方无需改动。
- **/v2 注册仓事件泵抛错即关闭句柄**(FX-C-03 · W1):泵死驱动死(`driver.status()` → `'ended'`),不再静默挂起;新增计数
  `pumpErrors`(治理统计)+ 指标 `tansr_serve_pump_errors_total`。
- **/v2 四处兜底信封 `message` 改固定 i18n 词条**(FX-C-04 · W1):错误原文(含本机路径)只进结构化日志 `store.error` / `session.rejected`,
  不再出线到客户端;此前信封曾回显 `open '/home/…/.tansr/sessions/x'`。依赖 message 原文判因的客户端改读 `error.code` / `detail`。
- **裁决装配与 sdk 同源**(FX-C-50 · W1 → W2 切换;M-01):`PlatformAdjudicationOptions = Omit<AdjudicationOptions,'endUser'>`;裁决段缺席通报
  `adjudicator_unavailable`(`ADJUDICATOR_UNAVAILABLE_CODE` / `_MESSAGE` 与 sdk `ADJUDICATOR_UNAVAILABLE_WARNING` 同值);开发者向通报码
  (`DEVELOPER_ONLY_ADJUDICATOR_WARNINGS`,六码)只走宿主 `onAdjudicationWarning` 通道不下发端上;姿态 / 模式经 kernel `derivePosture` /
  `modeUnderAdjudicator({ posture, tier })` 单点推导——**B 姿态 × 资格档 `none` 的会话不再切 `auto`**(cwd 内写删从零咨询放行变为 ask → 无通道
  deny),与 sdk 0.12.0 同律;机器放行帧 `tool.permission.decided{allow, decisionSource}` 经既有 driver 出线。
- **/v2 纪元 gap 单点**(FX-C-05 · W2):`subscribe` 判 `afterSeq > lastSeq`(客户端超前)亦发 gap 帧,`ReplayGapNotice.reason?` 加法键
  (取值含 `'ahead_of_log'`);`MemorySessionEventLog.readAfter` 同律双保险。此前超前订阅静默无 gap。
- **会话 store 切 kernel 单核**(FX-C-06 · W2;R-11):serve 文件店改经 kernel `createSessionStoreCore`(`pendingRewrite` 持久闩 + 前缀校验 +
  rotate / append 单实现),与 sdk `file-store` 过同一份 `runSessionStoreConformance`;快照三法经 `#checkpointQueue` 串行。应急开关
  `TANSR_SESSION_STORE_CORE=legacy`(常量 `SESSION_STORE_CORE_ENV`,与 sdk 同名同值;一版后删)。
- **落卷失败可见帧**(FX-C-07 · W2;R-03 B 形):会话落盘失败不再只进日志——经 `driver.pushBody` 出 `turn.error{ scope:'server.persistence',
  recoverable:true, errorKind:'store_commit_failed' | 'store_create_failed' }`;sdk 0.12.0 reducer 把 `recoverable:true` 归 `SessionView.notices`
  不落 `lastError`。**不**新增 `server.platform.warning` 控制帧。端侧按 `recoverable` 位区分咨询 / 失败。
- **恢复会话的 cwd 缺省翻为 `'stored'`**(FX-C-08 · W2 → W3 切换;R-04):配置了 `cwdPolicy` 的宿主 `cwdOnResume` 缺省由 `'current'` 改 `'stored'`,
  且 `'stored'` 重过策略闸——拒绝 → 409 `cwd_unavailable{ detail.reason: 'not_allowed' | 'not_allowed_on_resume' | 'missing' | 'not_absolute' }`
  (四值来自 kernel `resolveSessionCwdSync` / `toSessionCwdGateResult`,serve 不自写词表)。旋钮 `TANSR_SERVE_CWD_ON_RESUME` 可显式回 `current`。
- **会话保留期**(FX-C-09 · W2 → W4 收尾;M-05):`sessions.retention{ maxAgeDays, maxPerEndUser, maxBytes }`(缺席 = 零删除)+
  `store.sweepRetention`(serve 侧唯一物理删除点,日志事件 `session.retention_swept`)+ 注册仓第 ⑤ 段 `onSweep` 缝 + `checkpoints.retention` 透传;
  旋钮 `TANSR_SERVE_SESSION_MAX_AGE_DAYS` / `TANSR_SERVE_SESSION_MAX_PER_END_USER`。**W4 起 `maxAgeDays` 按 endUser 域真读 bundle
  `governance.sessionRetentionDays`**(sdk `AssembledPlatformModel.governance` 透传;api R4 表行 tiers `[owner, app_user]`):装配产物
  `AssembledSessionModel.sessionRetentionDays?`;`store.sweepRetention({ policy, policyFor })` 中 `AgentSessionRetentionSweepInput.policyFor?:
  (endUserKey) => AgentSessionRetentionPolicy | undefined`(自实现 store 缺席该缝 = 现状);键缺席 / 坏形 → 30 d 兜底不变。进程重启后
  `retentionDaysByEndUser` 热缓存为空 → 该域首扫按 30 d 直至再建会(W5 C-α「保留期落盘 meta.retentionDays」闭合)。
- **令牌失效反馈缝**(FX-C-15 · W2 → W3 切换;R-02 / M-13):`refreshingFetch` 对携 `x-tansr-app-token` 的请求收到 401 且
  `error.code ∈ TOKEN_INVALIDATING_CODES`(今日 `['unauthorized']`)且 `detail.reason ≠ 'check_unavailable'` → `AppTokenMinter.invalidate?` 逐出 +
  重铸 + 同请求重试恰一次;指标 `tansr_serve_token_invalidations_total{reason}`,`AppTokenMinterStats.invalidations?`。W3 起常量与谓词
  (`isTokenInvalidatingCode` / `isTransientAppTokenReason`)**由 sdk `platform/error-codes.generated.ts` 生成件同源**(api openapi
  `x-tansr-error-codes[].x-invalidates-token`),serve 不再手写码集(`TOKEN_INVALIDATING_CODES` / `TOKEN_CHECK_UNAVAILABLE_REASON` 仍从 serve 出口)。
- **bundle 缓存键四维**(FX-C-16 · W2;S-08):`bundleKey(base, appId, scope, featuresFingerprint)`,不同径别 / 能力位组合不再串档;
  `resolve` / `invalidate` 入参 `scope` / `clientFeatures`,`fetchAppBundle` / `fetchTwpHeartbeat` 尾参。自实现 bundle 缓存的宿主按四维键改。
- **R-18 α serve 半边真消费**(FX-C-11 / FX-C-12 · W2):`contextScheme` → 压缩方案选项的唯一消费点落 `createPlatformSessionAssembler`
  (经 kernel `contextSchemeToSchemeOptions`,坏形 `CONTEXT_SCHEME_UNPARSED` 只走宿主通道);`assembleAdjudicator({ postureExplicit? })`
  随行 `pricing`(金额 `budgets.maxUsd / maxCny` 折算 callBudget 上界;不可折算通报);serve 声明集 `CONSUMED_BUNDLE_KEYS` 加
  `contextScheme` / `adjudicator.budgets` / `adjudicator.escalation` / `adjudicator.callBudget` / `governance.sessionRetentionDays`,
  与 api 消费方表(`bundle-consumers.json` revision 4)逐键对表(parity 卷 serve 侧零台账)。
- **历史分页对 fork 会话禁用尾装载快径**(FX-B-24 serve 同形 · W2;C-09):`getHistoryPage` 对 `forkedFrom` 会话恒全量读,修正 `total` 偏 1 → 翻页洞;
  新增 `readForkedFrom` 单点。API 形不变。
- **控制帧 wire 恒携 `ts`;三请求帧携 `ttlMs`**(FX-C-22 serve 半边 · W3;contract-v0.26 / E2-12):`registry.ts encodeAgentStreamFrame` 控制帧
  data = `{ ...payload, ts }`(`CONTROL_FRAME_TS_KEY`,不属任一载荷键集);`server.tool.request` / `permission.request` / `question.request`
  加 `ttlMs`(与 `expiresAt` 同在场性);权限回执 `PermissionReceiptSchema.reason?`(词表 `PERMISSION_DENY_REASON = { expiredOnArrival:
  'expired_on_arrival' }`,词表外 400,allow 携 reason 被忽略);`AgentSessionBridgeOptions.onPermissionReceipt` 缝 → 工厂结构化日志
  `bridge.permission_receipt`。sdk `contract/MANIFEST.json` revision 2 → 3;端侧按 `ttlMs` 优先、`expiresAt − skew` 回落判期。
- **/v2 观测路由单源**(FX-C-45 · W3;S-04):`V2_ROUTE_TABLE`(21 端点)+ `V2_SESSION_ACTIONS`(11 动作)导出;`request-context.ts` 的
  `route` 模板与分发正则皆从表生成——**指标 / 日志 `route` 标签值集变 9 条**(此前手写 7 动作模板与实际路径不一),仪表板 / 告警按新表随动。
- **webhook 轮末通知双签一版**(FX-C-43 · W3):`x-tansr-signature: v2=…, v1=…`(v2 = protocol `WEBHOOK_SIGNATURE_V2` canonical + `x-tansr-timestamp`
  / `x-tansr-nonce` 两头;v1 保留一版供旧接收方)+ `webhook.signatureVersions` 配置(`TurnEndNotifierOptions.signatureVersions?`,缺省
  `DEFAULT_WEBHOOK_SIGNATURE_VERSIONS = ['v2','v1']`;词表 `WEBHOOK_SIGNATURE_VERSIONS`);导出 `signWebhookDelivery`。接收方(tansrd /
  orchestrator `parseSignatureHeader`)任一版本接受、v2 在场只校 v2(防降级)、300 s 窗。v1 弃用时间表归发版令。
- **进程协议:就绪帧 `TANSR_READY {json}` + `/readyz` 探针 + 建会退避**(FX-C-42 · W3;撤 FX-C-47 止血正则):`ready-frame.ts` 为唯一形态源
  (`TANSR_READY_PREFIX` / `TANSR_READY_FRAME_VERSION` / `formatReadyFrame` / `parseReadyFrame` / `emitReadyFrame` + 型 `ReadyFrame` /
  `ReadyFrameSink`;`StartServerOptions.readyFrame?`);tansrd 池 `readyFrom(line)` 三形逐行消费(① 帧 → ② JSON 行 → ③ 文案行,③ 为旧 serve 兼容一版);
  `/readyz` 探针与 `/healthz` 在 CLI 入口恒开;建会 429 / 503 携 `Retry-After` → 池侧实例冷却(`PoolLease.release({ retryAfterMs })`)。
  部署件探针建议由 `/healthz` 改 `/readyz`。
- **指标暴露拆旋钮**(FX-C-42 · W3):`TANSR_SERVE_EXPOSE_METRICS`(独立于 `TANSR_SERVE_EXPOSE_OBSERVABILITY`)+ `TANSR_SERVE_READY_STREAM`
  (就绪帧写 stdout / stderr);`SERVE_RUNTIME_ENV` 表 23(W2 建表)→ 26(W2 C-α 三旋钮)→ 28 键,`packages/server/README.md` 区段与 `.env.example` 由表生成
  (`pnpm env:example` / `env:check` / `docs:check` 锁住)。
- **轮末 webhook 出站两 env 旋钮**(FX-C-09/续 · W5 续):`SERVE_RUNTIME_ENV` 28 → 30 键,新组 `notify`——`TANSR_SERVE_NOTIFY_URL`(新 kind `string`,
  绝对 http(s) URL;非法忽略并告警)/ `TANSR_SERVE_NOTIFY_SECRET`(新 kind `secret`,取值恒不入告警 / 日志 / 生成物;只在 URL 生效时生效)→
  `resolveServeRuntimeOptions().v2.onTurnEndNotify?: { url, secret? }`;`tansr serve --v2` 透传进 `startServer({ v2 })` 既有缝(serve 进程自此可自发
  双签 webhook;此前只有库缝 / demo 宿主);**无 URL = 不出站**。新导出 `SECRET_WARNING_VALUE` + 型 `ServeRuntimeEnvStringFormat`;
  `ServeRuntimeEnvKind` 加 `'string' | 'secret'`,`ServeRuntimeEnvSpec` 加 `format?` / `requires?`,`ServeRuntimeV2Options` 加 `onTurnEndNotify?`。
- **进程级兜底须由宿主入口安装**(FX-C-02 · W1;S1):库内不自挂 `unhandledRejection` / `uncaughtException`;新导出 `installProcessGuards` +
  `PROCESS_GUARD_POLICIES` / `DEFAULT_PROCESS_GUARD_DRAIN_TIMEOUT_MS` / `PROCESS_GUARD_STACK_MAX_CHARS` / `processGuardRecordOf` + 型
  `ProcessGuard*`;`tansr serve` / tansrd 入口安装 drain-exit 策略,acp / mcp-serve / headless / demo 安装 log 策略;旋钮
  `TANSR_SERVE_ON_UNHANDLED`;日志事件 `process.unhandled_rejection` / `process.uncaught_exception` / `process.drain_failed`。自托管
  `@tansr/serve` 的宿主须在入口调 `installProcessGuards`,否则未处理拒绝按 Node 缺省崩溃(0.6.x 同,无回归)。

### 加法(公共导出;皆可选,缺席 = 现状)

- `AgentSessionFactory.sweepRetention?` / `AgentSessionFactoryBuild.sweepSessionRetention` / `sessions.retention` 选项 + 5 型 + 2 常量(FX-C-09)。
- `AppTokenMinter.invalidate?` / `AppTokenMinterStats.invalidations?` / `CreatePlatformSessionAssemblerOptions.metrics?`(FX-C-15)。
- `AssembledSessionModel.onAdjudicationWarning?` / `PlatformServeSessionFactoryOptions.onDecision?`(FX-C-50 审计缝)。
- `AssembledSessionModel.sessionRetentionDays?` / `AgentSessionRetentionSweepInput.policyFor?`(FX-C-09 收尾 M-05;W4 两签名变)。
- `ReplayGapNotice.reason?`(FX-C-05)· `PermissionReceiptSchema.reason?` / `PermissionDenyReason` / `PERMISSION_DENY_REASON`(FX-C-22)。
- `ready-frame.ts` 7 项 + `StartServerOptions.readyFrame?`(FX-C-42)· `WEBHOOK_SIGNATURE_VERSIONS` / `DEFAULT_WEBHOOK_SIGNATURE_VERSIONS` /
  `signWebhookDelivery` / `TurnEndNotifierOptions.signatureVersions?`(FX-C-43)· `V2_ROUTE_TABLE` / `V2_SESSION_ACTIONS` + 型 `V2RouteEntry` /
  `V2RouteMethod` / `V2SessionAction`(FX-C-45)。
- `installProcessGuards` 一族(FX-C-02)· `SESSION_STORE_CORE_ENV`(FX-C-06)· `TOKEN_INVALIDATING_CODES` / `TOKEN_CHECK_UNAVAILABLE_REASON`
  (FX-C-15;W3 起转出口 sdk 生成件)· `ADJUDICATOR_UNAVAILABLE_CODE` / `ADJUDICATOR_UNAVAILABLE_MESSAGE` / `DEVELOPER_ONLY_ADJUDICATOR_WARNINGS`
  (FX-C-50)。
- 指标:`tansr_serve_pump_errors_total`(FX-C-03)· `tansr_serve_token_invalidations_total{reason}`(FX-C-15)。日志事件:`process.*` 三名(FX-C-02)·
  `store.error`(FX-C-04)· `session.retention_swept`(FX-C-09)· `bridge.permission_receipt`(FX-C-22)。

### 随包(发布链;FX-C-28 / FX-C-29 · W4)

- tarball 随附 `NOTICE`(`files` +NOTICE;内联第三方 `undici` / `zod-to-json-schema` 版本 · 许可 · 许可文本,由 `pnpm release:verify-notice`
  按真构建 metafile 生成,`--check` 逐字节幂等);运行时外部依赖恒 = `package.json dependencies`(今日 `zod`),`build.mjs` external 由此生成,
  banner 改口指向 NOTICE(此前误称「唯一第三方依赖 zod」)。`pack-serve` 守卫 ⓪ verify-notice / ② external 同源 / ④ 白名单 +NOTICE。

### 配套(CLI 宿主面;详见仓根 `CHANGELOG.md`)

- `tansr serve --v2` / `TANSR_SERVE_V2=1` 显式挂 /v2 面(缺省关零变;鉴权 = 同一 Bearer + `x-tansr-end-user` 自报分域)+ 工厂 `cwdRebinder`
  缺省接线(FX-C-46 · W3);acp `session/new | load` cwd 经同一 kernel 闸(FX-C-44 · W3);`tansr serve` 入口安装进程守卫(FX-C-02)。

## 0.6.1 (2026-09-06)

- 追溯登记(FX-C-25;当时未发回执、无 tag):IO-14 存储出口补齐——`createFsBlobStore` / `createChaosBlobStore` / `runStorageConformance` 及类型经
  `@tansr/serve` 再出口(与 `@tansr/sdk@0.11.1` 同笔;此前 demo 与第三方适配器被迫直装私有 kernel)。**patch 却携新公共导出**,按 doc/89 §3.3 0.x
  口径应为 minor;误发已成事实,不回收,自 0.7.0 起由发版门 ④ 步机器禁止。发版门首版基线 364 导出即以本版 dist 为准。
- 无其他行为变化。

## 0.6.0 (2026-09-06;随 @tansr/cli 0.4.0 / @tansr/sdk 0.11.0 发版)

- 追溯登记:自 0.5.0(2026-09-02,/v2 控制帧四族七名 `server.platform.warning` 下发端上)以来——会话持久化一期二期(/v2 会话 store / fork /
  resume)、权限裁决姿态与裁决协议 v4 / 应用协议、音频模态与媒体能力内核化、套餐 plan 端上、MCP 重连契约 v0.21–v0.24;详见 doc/98(/v2 契约)与
  doc/49 回执。本文件自 0.7.0 起逐版机器化。
