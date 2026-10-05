# @tansr/sdk Changelog

> 发版门(`scripts/release/gate.mjs`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> ④ 步以 `exports.snapshot.json` 与上一 tag 比判 semver——**0.x 期任何导出集变化(增 / 删 / 签名变)至少 minor,patch 不得携新导出**
> (doc/89 §3.3「0.x minor = breaking」)。发版回执落 `doc/release/sdk-<version>.md`;无回执无 tag。
> 0.11.x 及更早版本为追溯登记(当时无本文件;doc/49 · doc/129 L20 回执位随主线改口)。

面向 SDK 消费方(开发者)的公共面变更登记;kernel / protocol 内部改动不入此表。版本号 = `packages/sdk/package.json`;
每条写「变了什么 · 对你意味着什么 · 迁移方式」。0.11.0 之前的历史见 git(`git log -- packages/sdk`)。
`tansr` 命令行 / `serve` 宿主面分别见仓根 `CHANGELOG.md` 与 `packages/server/CHANGELOG.md`(三包同律,`doc/release/README.md`)。

## 0.18.1 — 2026-10-04

「0.14.0 批」(USDK-11;UAPI 方案 §0 D23 / D31,冻结 2026-10-04;发布状态以 `doc/release/sdk-0.18.1.md` 回执为准)。`packages/sdk/src` 自 0.18.0 零改动、导出集相对 `@tansr/sdk@0.18.0`(tag → `29a21769`)**零差量**(gate ④ 所需 patch);随车的原因是**发布物内容有差量**——`./extensions` 子入口把私有工作区包 `@tansr/providers` 打进 dist,而其 `twp/cache-client.ts` / `internal/host-runtime-continuity.ts` / `cache-wire.ts` / `cache-core-wire.ts` 随 PERF-01 (c)(d) 改动(下文第三条);`platform/config-error.ts` 引用的私有 `@tansr/i18n` 其 `catalogs.generated.json` 随 manifest r7 再生。前两条只改仓内测量器与披露口径,包内零字节变化。

- **32 KiB 映射常驻门的测量口径拆分(PERF-01 (b);源 `bench/billing/sdk2-cache-executor.mjs` `measureSdk2CacheMappingMemory`,用例 `scripts/test/sdk2-cache-executor.test.mjs`;`./extensions` 缓存宿主代码零变化,导出集零变化)**:候选臂相对基线臂的额外常驻自此拆为「每映射增量」(阈值不变 **32,768 B**,按原定义)与「常数项」(缓存宿主模块 / JIT / `StatementSync` 容器等一次性固定成本,独立帽 **524,288 B**,单独列项);两臂同法——对已填充映射数档位(n ≥ 1)的常驻中位做最小二乘直线,截距差 = 常数项,各档位 (候选 − 基线 − 常数项) / n = 每映射增量,n = 0 档不参与拟合(一次性成本在首条映射处为阶跃)。历史具名下界 35,395 B 不是新帽。归档 JSON 原字段不改名,新增 `constantTerm` / `constantTermBytes` / `constantCapBytes` / `constantTermVerdict` / `rangeBytesPerMappingExcludingConstant` / `perMappingVerdict`,综合 `verdict` 须两项皆 within;原合并口径保留为 `verdictIncludingConstant`。对你意味着:只改测量器与披露口径,不改阈值、不改宿主行为;0.18.0 段「性能与延期披露」的红数原样保留,新口径读数与结论见 `doc/report/PERF-01-AB-代码缓存与32KiB常数项-2026-10-03.md`(手册 doc/90「公开缓存宿主与受信后端桥」节末)。**正式读数(2026-10-03 空闲窗口,三轮 × 三组中位)**:heap 常数项 1,855–1,881 KB(≈ 3.5× 512 KiB 帽,`constantTermVerdict = regression`);每映射增量(剔常数)heap [−72.6 KB, +8.3 KB],区间跨零,`perMappingVerdict = unknown`(候选臂稳态每映射增长低于基线臂 ≈ 22 KB,非正增量不代签;一组 rss 侧 lower 42.6 KB 判 `regression`);旧口径对照 [34.8 KB, 395.3 KB] 与 0.18.0 段红数一致。**门未过,SDK2-09 的 B 披露维持**,阈值与帽值不改。迁移:无。
- **常数项帽改口径(PERF-01 (b2) / UAPI 方案 §0 D41,用户确认 2026-10-04;源 `bench/billing/sdk2-cache-executor.mjs` · `bench/billing/sdk2-cache-constant-attribution.mjs`,用例 `scripts/test/sdk2-cache-executor.test.mjs`;`./extensions` 缓存宿主代码零变化,导出集零变化)**:上条的常数项「独立帽 524,288 B」自此改口径为「已归因的披露项 + 不回退棘轮」——测量器 `constantCapBytes` **524,288 → 2,097,152**(2 MiB;**非设计帽**:正式三组读数 1.855–1.865 MB + ≈ 12% 余量,JIT 份额随 Node / V8 版本变,任何增长须拍板),归档 JSON 新增加法字段 `constantCapBasis: 'ratchet'`(与 `constantCapBytes` 并列,原字段不改名、不删,判定规则不变)。归因(`sdk2-cache-constant-attribution.mjs`,报告 `doc/report/PERF-01-CD-耐久点合并与冷恢复加法-2026-10-03.md` §4–§5):JIT 机器码 ≈ 700 KB(≈ 49%,单列为诊断数)、vault 打开 155 KB(RFC 信任锚)、首映射对象 406 KB + 首上下文 68 KB(固有);全关 JIT 仍 719 KB > 512 KiB,可惰性化者为无,**不加 JIT 旗标**;D30 原 512 KiB 是归因前为堵「把成本挪进常数项」漏洞所设的守卫数,不是 SDK2-09 产品需求。**每映射帽 32,768 B 一字不改**。对你意味着:只改测量器与披露口径,宿主代码与导出集零变化;常数项判定随之 within,但每映射判定仍 `unknown`(区间跨零 / 一组 rss regression),**SDK2-09 的 B 披露不变**,须空闲窗口正式测量每映射 within 后门才算绿。迁移:无。**正式测量(2026-10-04 空闲窗口,`doc/report/PERF-01-正式测量-2026-10-04.md`)**:候选三有效组每映射剔常数 heap [−71,306, +7,144] B 仍 `unknown`,常数项 heap [1,856,065, 1,866,497] B 在棘轮内;**门不转绿,B 披露不变**。同日用户拍板 (a):`constantTermVerdict` 只对 heap+external 判(棘轮按 heap+external 定义),rss 常数项另列披露字段 **`constantTermRssVerdict`**(加法字段,不进综合 `verdict`;正式读数 2.9–6.6 MB,自 SDK2-09 起即为旁证),`verdictBasis` 字符串随之写明;每映射门不变。
- **缓存宿主 C2 热窗口单一耐久点与冷恢复并行拉取(PERF-01 (c)(d);源 `packages/providers/src/twp/cache-client.ts` · `packages/providers/src/internal/host-runtime-continuity.ts`,经 `./extensions` `createNodeCacheHost` 与 `@tansr/serve` `ServeCacheHost` 共用;导出集零变化、manifest 不 bump)**:(c) 每次 C2 交换的原帧 `exchange/<requestId>`(core 投影时另有 `core-exchange/<requestId>` 与首次迁入的 metadata 升格)与在飞标记 `flight/<requestId>` 由两次 SQLite 事务改为**一次**,仍在 send 完成能力 / 尺寸 / 令牌 / 证明检查之后、交 fetch 之前(RFC-SDK2-缓存连续性 §4.2);恢复语义收紧为「两键皆有或皆无」——prepare 之后、send 之前崩溃的请求不再留下耐久痕迹、不再把从未出网的请求恢复为 `result_unknown`,事务中崩溃由热日志回滚,事务后崩溃与此前相同;metadata 升格为客户端级待办,随首个落盘的交换事务提交(多条 Core 请求先后 prepare、后者先 send 亦不会出现「`core-exchange/` 行 + 旧格式 metadata」的拒读库);旧格式(无 `flight/` 的 `exchange/`)库照常恢复并在首次重放补齐。(d) 冷恢复接续时旧运行 binding 读(GET)与新运行心跳(POST `/heartbeat`)并行发出,心跳由 `source_conflict` 判定之后挪到判定之前(对新运行自身幂等,不触碰 binding / ticket),任一失败整体失败且不发出 continuations 控制 POST;零新增平台 / 门面操作。对你意味着:`createNodeCacheHost` 的调用面、错误码、帽值(128 控制 / 16 交换 / 4096 完成 / 64 MiB)与 `readCacheContinuity` 读面零变化;热窗口少一次 FULL 同步 COMMIT、冷恢复少一次串行往返(空闲机 ≈ 5 ms / ≈ 4 ms,正式读数待 `doc/report/PERF-01-CD-耐久点合并与冷恢复加法-2026-10-03.md` §7 空闲窗口);P95 / 压力门结论不在本条改口。迁移:无;已有缓存库无需转换。

## 0.18.0 — 2026-10-02

已发布(“2026.10 统一 API 发行车”,源码 `29a21769`,npm `@tansr/sdk@0.18.0` dist-tag `latest`;回执 `doc/release/sdk-0.18.0.md`)。导出集相对 `@tansr/sdk@0.17.0`(tag → `e9752cc8`)的**实测差量**(REL-PREP-3,2026-10-01;以 tag 内 `exports.snapshot.json` 与集成分支 `15bcd675` 仓内 `exports.snapshot.json` + `exports.subpaths.snapshot.json` 逐名比对,0.17.0 无子入口快照):**根入口 528 → 532,+4 / −0 / ~9**;新增子入口 `./extensions` 41 快照项(子入口自身 1 + 具名导出 40);合计 +45 / −0 / ~9,与 S10 执行单 §2 对 main `d1818d8f` 的预判一致,所需 minor;gate ④ 至少 minor。发行时以版本 bump 同笔再生的快照为准。本段由 REL-PREP-2(2026-10-01)自发行说明草案附录 A.3 落实;SDK2.0 收口语义条目由 REL-PREP-3 按 S10 执行单 §5.3「A 起草」逐条补入(U 定稿),每条括注卡号 / 提交与源码位置。

- **新增子入口 `@tansr/sdk/extensions`(首次随包;41 快照项 = 子入口 1 + 具名 40,名与签名以 `exports.subpaths.snapshot.json` 为准;根入口零删除)**。两组显式宿主,都**不是** `createSession` 的缺省开关,Electron 完整 SDK / IPC 接线零变化;源码 `packages/sdk/src/extensions/**`,用法见 `packages/sdk/README.md`「SDK2 归档宿主」「SDK2 缓存宿主与后端接续」与 doc/90「SDK2 开发候选」节:
  - **本地归档宿主(SDK2-02 `2699e558` / 03 `9c19a54a` / 05 `269ef440` / 06 `810a0516` / 07 `6d65e3d0` / 08 `b6791ceb`)**:`createNodeArchiveHost(options: NodeArchiveHostOptions): NodeArchiveHost` + `NodeArchiveHostError`。`host.open({ mode: 'fresh' | 'resume', … })` 完成归档安装 / 恢复后返回**原 `AgentSession`**,构造宿主本身不建库、首次 open 才初始化持久介质;`archive.contextMaterials: true` 显式安装材料链,省略 / `false` 只保留归档交接。读面:`readArchiveBinding` / `readArchiveStorageStrategy`(本版固定 `single-authorized-source` + `source-ack-with-durable-spool`,`replication` / `synchronization` 皆 `'none'`——不是备份、不是多设备同步)/ 有界 `readArchiveRecords({ afterSequence, limit, maxBytes })` / `readArchiveArtifact`(复核 SHA / MIME / 长度,单对象 32 MiB 帽)/ `readEffectiveContext`(轮末有效上下文引用:仅空闲已安装会话,未决即拒、不修复不重放,不是防回滚凭证)/ `flushArchive`;同轮插入:`inputCapabilities` / `getInputTarget` / `submitInput` / `getInputStatus`(不回落 cancel + send);材料:`requestMaterials` → 有界分块上传 → `received` 只证送达,`enqueueMaterials` 把原请求与 lease 交给下一查询屏障的唯一 ContextManager 核验代际 / 摘要覆盖 / 预算,完整档案不自动回灌、摘要覆盖的原文不因重开复活。类型:`NodeArchive{Subject,Operation,HostOptions,FreshSessionOptions,ResumeSessionOptions,OpenRequest}`、`ArchiveHost{Quota,Limits}`、`ArchiveCompletionAuthorization`(`finishPendingOnResume` 须另给独立 `authorizeCompletion`)、`ArchiveAttachmentSource`(可信外置图片源:同步 `describe` 给出登记时固定的 MIME / 字节数 / SHA256,异步 `read` 受 `signal` / `maxBytes` 约束;URL 只是查表键,SDK 不自动 fetch、不把地址变成文件 / 网络权限;未配置保持原内联附件行为)、`ArchiveEffectiveContextReference`、`Archive{RecordPage,Artifact,BindingView,StorageStrategyView}`、`ArchiveMaterial{Issue,Request,UploadChunk,UploadStatus,Response,Receipt}`、`ArchiveInput{Capabilities,Target,Submission,Receipt,Result}`。
  - **本地缓存宿主(SDK2-07 `c4d23736` / `66f6e1fb`;SDK2-09 性能卡只调优不改形)**:`createNodeCacheHost(options: NodeCacheHostOptions): NodeCacheHost`。平台令牌档经 `cacheHost.open({ mode: 'fresh' | 'resume', sessionId, session })` 取得原 `AgentSession`(`NodeCacheSessionOptions` 剥除 Store / sessionId / resume / fork / initialMessages 等宿主持有键;令牌档 `baseUrl` 须与宿主一致);须显式传原 `createFileSessionStore`(需其受保护删除能力)、`applicationScopeId` / `endUserId` / `baseUrl`、`cache: { directory(绝对), storeId(稳定), key: { id, bytes(32 字节本地介质密钥,应用安全保存) }, mode: 'create' | 'recover' }` 与同步 `authorize`(对 `open / resume / cold-new / run / delete` 回非负十进制串 `authorizationRevision`,拒绝抛错)。`readCacheContinuity(sessionId)` 纯本地读逻辑缓存连续性(provider 命中 / usage / billing 无上游实报恒 `unknown`);`lookup` 查原 Core 受理 / 已存响应,不清 pending、不当新用户轮执行;`delete({ sessionId, authorization: { token, baseUrl, fetchImpl? } })` 在全部宿主会话 close / drain 之后、`dispose()` 之前执行,经原 Store 排他锁确认远端墓碑再删史,未知结果保留原 `requestId` 与 vault 供同一删除重试,删除进行中拒绝 open / dispose,冷宿主未 open 时直接 `store.delete` 拒 `mapping_unavailable`(不是「没有来源」);`dispose()` 不代替保存 / 未知结果确认 / 删除,也不自动关闭借用的 Store。`continuity`(`NodeCacheContinuityBridge`:`issuerId` / `sourceNamespace` / `credential({ sessionId, intentBytes, signal, assertCurrent })`)缺省同 runtime(`runtimePolicy` 省略或 `'preserve'`),显式 `'renew-on-restore'` 才向持有**同一真实 Store**来源权威的受信后端取短期 grant(issuer 私钥不下终端,本地 vault key 不能替代);`410 session_archived` 为终态,只有显式 `archived: 'cold-new'` 且获当前授权才建独立新关系、不复用旧 logical / group。类型:`NodeCache{HostOptions,OpenRequest,DeleteRequest,LookupRequest,LookupResult,SessionOptions,ContinuityAuthority,ContinuityBridge,ContinuityView}`。
  - **对你意味着**:不 import `@tansr/sdk/extensions` 的消费者零变化;两宿主的冷重开 / 删除 / 跨运行接续责任边界以上述方法注释与 README 为准,接口在场不等于供应商缓存节费已证(见本段末「性能与延期披露」)。**迁移**:无;新消费方按 README 示例显式装配。
- **根导出 9 项签名变化(逐名;0.x 期签名变 = breaking,按 doc/89 §3.3 以 minor 承载。本版 9 项全部是可选键 / 可选尾参 / 常量词表加法,结构实现与位置参调用源兼容,无运行时行为回退)**:
  - **`SessionStore` / `SessionRecord` / `SessionStoreCommitMeta`(USDK-08 `901c8916`;源 `packages/sdk/src/sessions/store.ts`)**——变了什么:`SessionStore.attachmentCheckpoints?: true`(Store 承诺附件准入状态与历史原子保存、按会话域原样恢复);`SessionStoreCommitMeta.attachmentCheckpoint?: unknown`(SDK 生成的不透明值,随 `commit` 的 meta 下发);`SessionRecord.attachmentCheckpoint?: unknown`(`get()` 原样回传 SDK 曾提交的值)+ `attachmentReferencesInvalidated?: boolean`(Store 实际修复过本次历史时置 `true`,SDK 据此失效附件引用但保留累计准入预算)。对你意味着:内置 `createFileSessionStore` 已实现(`file-store.ts` 声明 `attachmentCheckpoints: true`,随卷落 / 读回检查点),`createSession({ resume })` 自此把附件准入状态(累计注入字节 / 拒绝计数 / 条目)随历史冷恢复(`session.ts` 只在 Store 声明该位时启用);**不声明** `attachmentCheckpoints` 的自定义五方法 Store 行为与 0.17 相同(SDK 冷恢复保守失效引用、不伪造缺失状态)。迁移:自定义 Store 无需改动;要承接冷恢复的 Store 声明 `attachmentCheckpoints: true` 并把 `meta.attachmentCheckpoint` 与 `messages` 同次保存、`get()` 原样返回——**不得解析、构造或以客户端元数据替代该值**。
  - **`ToolContext`(kernel `src/tools/types.ts`;USDK-04 `d7c9e9fd` + SRV-06 `3d3ceba6`)· `GateDecision`(kernel `src/tools/dispatch/permission-decider.ts`;USDK-04 `d7c9e9fd` + SDK2-09 `059f8033`)**——变了什么:`ToolContext.executionTarget?: ExecutionTarget`、`ToolContext.turnId?: string`;`GateDecision.executionTarget?: ExecutionTarget`。`ExecutionTarget = { kind: 'device' | 'controlled-service'; executorId; bindingId; bindingRevision; authorizationRevision; workspaceId?; workspaceRevision?; interpreter?: { id; revision; hostShell } }`(kernel `world/execution-boundary.ts`;受信宿主给定的落点事实,不是模型参数、不是客户端自报授权;在 d.ts 内联,不新增根导出名)。对你意味着:进程内 SDK(`createSession` / `query` / `defineTool` / 自定义 `Tool.execute` / 自定义权限门)这三个键**恒缺席**——只有 serve SDK2 显式执行档的调度器会填入,表示该调用将在远端绑定设备 / 受控服务执行,原审批摘要与去重域据此区分;`turnId` 是原查询轮身份,供远端精确重试证明使用。迁移:零;自定义门 / 工具若读到 `executionTarget` 不得回落宿主本机资源(缺资源即拒,不是宿主兜底)。
  - **`AppBundleModel`(+4 新导出 `AppBundleAdapterDiagnosticStatus` / `AppBundleRequestAdapterDiagnostic` / `AppBundleBillingAdapterDiagnostic` / `AppBundleModelAdapterDiagnostics`;`e2124f0c` MODEL-REFACTOR-01,源 `packages/sdk/src/platform/bundle.ts`)**——变了什么:`AppBundleModel.adapterDiagnostics?: AppBundleModelAdapterDiagnostics = { request: { adapterId, operation, status, source?: 'routing' | 'compatibility', reason? }, billing: { adapterId, operation, status, reason? }, conflicts: string[] }`,`status ∈ 'ready' | 'review' | 'unresolved'`。对你意味着:只读投影,描述当前目录证据是否足以选择请求 / 计费适配器,供界面展示模型的调用 / 计量能力;不携供应商凭据、价格原文或可执行适配器对象;平台未下发时 `undefined`,段坏形只丢诊断不丢模型条目,旧 SDK / 旧 bundle 零行为变化。迁移:无。(本仓无 MODEL-REFACTOR-01 卡报告,语义据源码 JSDoc;平台侧下发时点另见 api 仓。)
  - **`AppCapabilitiesSchema` / `CLIENT_FEATURES` / `fetchAppBundle`(USDK-04 `d7c9e9fd`,承 USDK-02 应用授权合同;源 `packages/sdk/src/platform/contract.ts` / `client.ts`)**——变了什么:① `AppCapabilitiesSchema` 加可选段 `execution?: { version: 'bound-device-v1'; boundDevice: { tools: Partial<Pick<CapabilityTools, 'read' | 'write' | 'edit' | 'glob' | 'grep' | 'list' | 'shell' | 'process' | 'skills' | 'mcp' | 'customTools'>> } }`(`.strip()`;缺位 = 未授权,绝不合并回旧进程内 `tools`),推导类型 `AppCapabilities` 随之加键,`normalizeAppCapabilitiesForPlatform` 原样保留该段;② `CLIENT_FEATURES` 由 `['platform-audio', 'tts-input-limit-v1']` 变为 `['platform-audio', 'tts-input-limit-v1', 'bound-device-v1']`,`ClientFeature` 联合多一值,出线头 `x-tansr-client-features` 缺省声明串随之变——bundle 缓存键的 `featuresFingerprint` 由该串派生,**升级后首次装配按新指纹重拉一次 bundle**(旧指纹条目自然失效,无需手清缓存);③ `fetchAppBundle(base, token, fetchImpl, ifNoneMatch?, clientFeatures = CLIENT_FEATURES, requireCapabilities = false)` 新增第 6 个可选参,`true` 时 bundle **缺 `capabilities` 段或段坏形即 throw `AppConfigRequestError({ stage: 'app_config', reason: 'invalid_config', retry: 'check_configuration' })`**,不再回落缺省 / 零能力档(供 serve SDK2 显式远端执行档只接受平台实际下发的有效能力);缺省 `false` = 0.17 行为。对你意味着:进程内 SDK 不消费 `execution` 段(设备工具授权只在 serve SDK2 执行档生效;应用经平台 `PATCH /v1/apps/:id` 携 `x-tansr-client-features: bound-device-v1` 配置,见 `packages/server/README.md`「应用授权与终端能力」);旧 desktop / mobile / server 标签与旧 `tools` 位不推导设备授权。迁移:对 `ClientFeature` 做穷举 `switch` 的代码补 `'bound-device-v1'` 分支;按位置参调用 `fetchAppBundle` 的代码不受影响;直接用 `AppCapabilitiesSchema` 判「未知键必拒」的调用方注意 `execution` 自此是已知键(0.12.0 起本就 `.strip()` 剥未知键)。
- **性能与延期披露(SDK2-09;用户授权代拍 D12「A 时间盒一轮」→ **到期仍红,转 B**)**:本包 `./extensions` 缓存宿主所依赖的三项原性能门——32 KiB 映射常驻归属、缓存局部 hot / cold P95(10 / 50 ms)、1record / 1KiB 同步压力档 2 倍线——截至 2026-09-28 仍红(N1 具名不重叠下界 35,395 B 超 32,768 B 帽 2,627 B;Windows 140 位置 P95 红;centralized 326 ms / offload 3 188 ms 对 2× 652 ms 判 `duration_regressed`;SDK2.0 集中交付计划 §26 / §28),功能条件交付、缺省关闭 / 显式 opt-in 不变。S09 时间盒结算(2026-10-01,空闲主机、三组取中位,既有测量器;报告 `doc/report/SDK2-09-性能门时间盒-2026-10-01.md`):32 KiB 常驻 heap lower **34,837 B/映射**(帽 32,768,`regression`);P95 Δ short-text hot **30.5 ms**(允 10)/ cold-restore hot **27.8 ms**(允 10)/ cold-restore cold **181.9 ms**(允 50);压力 centralized 219 / offload **2,293 ms**(2× 线 438,`duration_regressed`);基线同口径 34,824 B / 30.4 / 24.9 / 221.7 ms / 2,687 ms——两项无语义变化的优化(预算槽记录解码前剪尾部填充、安装就绪记录结构验证备忘)带来 cold −40 ms、压力 −15%,**三门仍红** → 按 B「功能条件交付 + 明确延期披露」关闭、红数原样入账、另开 `PERF-01` 承接,阈值不改。不是外部依赖、不改称通过;供应商缓存净节费未证明(集中计划 §25:实测与披露完成、未证明净节费)。详见 `packages/server/CHANGELOG.md` 0.13.0 同名条。
- **统一 API 合同对本包无行为变化**:Electron 完整 SDK / IPC 模式**不经 `/api`**,本发行车的 `/api` GA、`/v1` 下线、`/v2` `/v3` 退役预告对 `@tansr/sdk` 内嵌 API(手册 §一～§十五)零影响;`/api` 调用面见 `packages/server/CHANGELOG.md` 0.13.0 段、手册第十六章与 `@tansr/api-client/api`。

## 0.17.0 — 2026-09-16

- 平台移动能力合同保留可选 `tools.webFetch` / `tools.http`，与 API、控制台及 serve 装配一致；缺省关闭，现有未启用应用行为保持（MOB-WEB-01 / REL-12）。
- 随包核心 Http 支持宿主私网访问上限；托管服务禁用宿主环境凭据引用，不扩大终端权限。冻结协议及会话合同指纹未变。

## 0.16.0 — 2026-09-15

REL-07 将 AUDIO-01 增量以独立 minor 和 contract-v0.29 发布；实际发布状态以对应 doc/release 操作回执为准。已发 SDK 0.15.0 / serve 0.10.0 及其 tag 保持不变。

- `planSpeechInput` 支持可选原子 `inputLimit`，整批预检拒绝纯空白分段（`empty_segment`）；不自动删除空白、不自动拆分或重试收费请求。宿主的拒绝原因穷举须补齐新值。
- SDK 新增 `AudioTtsConstraints.inputLimit` 与 `tts-input-limit-v1` 协商；旧客户端继续使用保守加权投影。Electron / serve 示例兼容已发布包，遇到无法表达的原子限制时明确要求升级。
- SDK 0.16.0 / serve 0.11.0 承载本次公开签名变化，原子单位支持码点、UTF-16 码元和 UTF-8 字节；旧加权 maxChars 帽与原子帽同时成立，不允许自定义策略放宽厂商上限。详见 `doc/rfc/contract-v0.29.md`。

## 0.15.0 — 2026-09-14

MEDIA-03 已发布；正式源码、门禁及 npm 操作结果见 `doc/release/sdk-0.15.0.md`。

历史媒体产物随 tool_result 保留，恢复后可重建图像、视频、语音工具卡。新增 artifactUnavailable 表达预览缺失；模型仍只消费原 content。含产物的会话存储使用版本 2，升级后不得用旧 writer 写同一目录。详见 doc/rfc/contract-v0.28.md；发布与安装物见本节正式回执。

## 0.14.0 — 2026-09-14

REL-06 按 DEC-RF-24 候选版本重新编译；实际发布状态以 `doc/release/sdk-0.14.0.md` 操作回执为准。核心组件设计审查整改波(RF-01 … RF-11 / RF-P1 … RF-P3 / RF-S1 / RF-Z,2026-09-11 … 13):SDK 资源生命周期整改(RF-04,含代拍 #3 A / #4 B)、
contract-v0.27 换形(RF-P1)、查询计数与事件流关闭即取消(RF-06)、工具入参中央校验(RF-08b)、会话预算闸(RF-P3a)等。导出集相对
`@tansr/sdk@0.13.1`(506 项)→ **525 项**(`exports.snapshot.json` 为准;+19 零删,gate ④ 至少 minor):RF-04 名单零增删、7 项签名变化
(`AgentSession` / `CreateSessionOptions` / `ManagedQueryOptions` / `SessionDrainOptions` / `SdkCleanupHandle` / `SdkLifecycleError` / `SessionNotice`);
+1 `SessionBudgetOptions`(RF-P3a,下文);其余 +18 为 0.13.1 之后并入主线、此前未在本表登记的媒体 / 应用提示词 / 上下文状态面加法
(`AppConfigRequestError` / `ApplicationPromptFailure` / `ApplicationPromptFailureReason` / `ApplicationPromptRetry` / `ContextBudgetState` /
`ModelTransitionBackup` / `SendBlocksResult` / `SessionContextState` / `SessionModelState` / `SessionUserBlock` / `SpeechInputPlan` /
`SpeechInputPlanResult` / `SwitchModelOptions` / `SwitchModelResult` / `applicationPromptFailureMessage` / `countSpeechCharacters` /
`describeApplicationPromptFailure` / `planSpeechInput`;能力见 `examples/electron-chat/README.md` 与仓根 `CHANGELOG.md`)。

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
- **Narrator 咨询帧文案(RF-Z ⑯;仅 `SessionView` 的 `narrate()` 文本,事件形零变化)**:`turn.error { recoverable: true }` 一行由
  `turn notice [scope]: … — recoverable, you can retry` 改为 `… — recoverable, session continues`——SDK 只能担保会话仍开、可继续发送,
  「可重试」是宿主的决定,不再替宿主承诺。按该文案做字符串匹配的宿主(不建议)需改判;按 `notices[].code` / `scope` 判别者零变化。

**查询计数与事件流关闭(RF-06;`QueryCounters` 签名变化)**:

- `QueryCounters` 新增两个可选计数字段 `apiRounds`(模型派发总数,恒不退还)与 `recoveryAttempts`(同轮恢复重试:可恢复错误重发 / 上下文溢出压缩重试 / 输出触帽升档重发);`modelTurns` 仍是预算口径(可恢复错误重试退还),语义不变。只读计数、加法字段,既有消费方无需迁移;用 `deepEqual` 锁定整个计数对象的测试需补这两个字段。
- 查询事件流关闭即取消:对 `events` 调 `return()` / `throw()`(含 `for await` 提前 `break`)现在会取消本轮——在飞模型流与工具经 `signal` 见到中止(reason 为 `'iterator_closed'`),句柄进入终态,不再有事件产出,也不签发终局事件。此前提前退出只在下一个屏障点停下,在飞的模型流 / 工具会不受打扰地跑完。`compactNow()` 对已关闭的查询立即以新增的拒绝原因 `query_closed` 返回(此前可能悬挂到屏障点)。依赖「退出循环后在飞工具仍会跑完」的调用方需改为消费到终局事件再退出。
- 会话预算的 `totalTokens` 口径由 kernel 单点 `budgetSpendOf` 给出:思考(reasoning)token 视为输出的子集不再叠加计入(此前 CLI / serve 装配层各自相加导致重复计费口径);已配置 `budget.maxTotalTokens` 的会话可能比此前更晚触顶,属口径修正。

**工具入参中央校验(RF-08b;`Tool` 签名变化)**:

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
