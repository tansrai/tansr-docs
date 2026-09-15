# @tansr/serve Changelog

> 发版门(`scripts/release/gate.mjs`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> ④ 步以 `packages/server/exports.snapshot.json` 与上一 tag 比判 semver——**0.x 期任何导出集变化(增 / 删 / 签名变)至少 minor,patch 不得携新导出**
> (doc/89 §3.3「0.x minor = breaking」)。发版回执落 `doc/release/serve-<version>.md`;无回执无 tag(tag 形 `@tansr/serve@<version>`)。
> 0.6.x 及更早版本为追溯登记(当时无本文件;本文件由十王修案第五波 C-γ「CHANGELOG 三包就位」建立,**不发版**)。

面向 serve 宿主(自托管 `@tansr/serve` 库 / `tansr serve` 运维方 / tansrd 池)的公共面变更登记:公共导出(`packages/server/src/index.ts`)、
/v1 · /v2 HTTP 面、进程协议帧、运维旋钮(`SERVE_RUNTIME_ENV` 表)、指标 / 结构化日志事件、webhook 出线形。kernel / sdk 内部改动不入此表
(sdk 面见 `packages/sdk/CHANGELOG.md`)。版本号 = `packages/server/package.json`(包目录 `server`,发布名 `@tansr/serve`);
每条写「变了什么 · 对你意味着什么 · 迁移方式」。0.6.0 之前的历史见 git(`git log -- packages/server`)。

## 0.11.0 — 2026-09-15

REL-07 将 AUDIO-01 增量以独立 minor 和 contract-v0.29 发布；实际发布状态以对应 doc/release 操作回执为准。已发 SDK 0.15.0 / serve 0.10.0 及其 tag 保持不变。

- `planSpeechInput` 支持可选原子 `inputLimit`，整批预检拒绝纯空白分段（`empty_segment`）；不自动删除空白、不自动拆分或重试收费请求。宿主的拒绝原因穷举须补齐新值。
- SDK 新增 `AudioTtsConstraints.inputLimit` 与 `tts-input-limit-v1` 协商；旧客户端继续使用保守加权投影。Electron / serve 示例兼容已发布包，遇到无法表达的原子限制时明确要求升级。
- SDK 0.16.0 / serve 0.11.0 承载本次公开签名变化，原子单位支持码点、UTF-16 码元和 UTF-8 字节；旧加权 maxChars 帽与原子帽同时成立，不允许自定义策略放宽厂商上限。详见 `doc/rfc/contract-v0.29.md`。

## 0.10.0 — 2026-09-14

MEDIA-03 已发布；正式源码、门禁及 npm 操作结果见 `doc/release/serve-0.10.0.md`。

历史接口透传 tool_result.artifact，热/冷恢复与 checkpoint 保留媒体产物。含产物存储提升版本 2，旧程序不能继续写升级卷；请备份并统一升级会话 writer。HTTP 路径和事件包络不变，旧文本历史不自动补媒体。发布状态以实际回执为准。

## 0.9.0 — 2026-09-14

REL-06 按 DEC-RF-24 候选版本重新编译；实际发布状态以 `doc/release/serve-0.9.0.md` 操作回执为准。核心组件设计审查整改波(RF-03 / RF-05a / RF-05b / RF-06b / RF-08b / RF-08c / RF-P3a / RF-S1 等,2026-09-11 … 13)。导出集相对
`@tansr/serve@0.8.1`(404 项)→ **413 项**(`exports.snapshot.json` 为准;+9 零删:`AgentStoredSeqWatermark` / `CloseAllOptions` / `CloseAllReport` /
`MemorySessionEventLogOptions` / `V2SessionMediaView` 与 0.8.1 后并入的语音输入规划 `SpeechInputPlan` / `SpeechInputPlanResult` / `countSpeechCharacters` /
`planSpeechInput`;gate ④ 至少 minor)。

- **TypeScript 成品声明可直接检查**(REL-06-03)：从 `index.d.ts` 移除误混入的 `createRequire` 运行时垫片，修复未开启 `skipLibCheck` 的 NodeNext 消费方所遇 TS1046 / TS1254。JavaScript 垫片仍保留，运行时与公开类型签名不变；无需迁移。

- /v2 非活跃会话 `lastSeq` 真值 + `tansr serve` 店告警接线(RF-S1,核心组件设计审查 DEC-RF-30 / 48;doc/98 §二-⑥ / ⑧ · §三-2 改笔;导出集零漂移):GET ⑥ 会话详情 / ⑦ 列表 / ⑧ history 对**非活跃**(不在内存)会话返回的 `lastSeq` 自此 = store meta 持久化水位(RF-05b 落盘的 `lastSeq`:正常关闭封印值或最近轮末 / 改写检查点值),此前恒 0;旧卷 / 无水位记录仍 0,无 meta 记录仍 404,活跃径不变。wire 形 / 键集 / 键序 / 公共类型零变化——`StoredSessionMeta` 形不变,`createAgentSessionFactory` 的 storeReader 以内部加法位回填(自实现 `AgentStoreReader` 不回填 = 仍 0;坏形值按 0);⑧ 非活跃径为取水位在历史在场后多一次 `store.getMeta`(历史缺席 404 先于之;meta 读抛错与既有读拒绝同码 500 `store_corrupted`,原文只进 `store.error` 日志)。对你意味着:客户端(含 Android / iOS)不得再以 `lastSeq === 0` 判「无事件」,应按值作 `Last-Event-ID` 续传起点(封印记录恰续;未封印记录可能收 gap `evicted` 后 L2 重建)。同笔 `tansr serve --v2` 宿主建店接 `onStoreWarning`:店核警告(`store_unknown_kinds` / `store_prefix_mismatch` / `store_pending_rewrite` / `store_seal_failed`)自此不再静默,以 `warn` 级复用既有 `store.error` 事件出线 `{code,message,sessionId?,count?,kinds?}`(`TANSR_SERVE_LOG_FORMAT=json` 一行 JSON 落 stderr;text 形态回落 stderr 同形 JSON 行);`LOG_EVENT` 不加键、字段恒不含消息内容。自托管 `@tansr/serve` 宿主如需同样可观测,自行 `createServeAgentSessionStore({ onStoreWarning })` 接进自己的 logger。
- SSE 有界写(RF-05a,核心组件设计审查 RV-4-01):`maxBufferBytes`(doc/98 §六 2 MiB)自此是**每次 `res.write` 的字节上界**——attach 重放段惰性分片交付(`SseSubscriber.replay?` 可选面;`SubscriberWriter.replay` 必有)、同 tick 批量入队越界即刻分片写出、`flush()` / `end()` 不再整队一次写出;socket 拒收后残量按既有慢消费者判据裁决(`disconnect` / `drop-oldest` 语义、两参数值不变)。帧文本与顺序逐字节不变,小流量零分片。对你意味着:大重放 / 突发不再一次把数 MiB 塞进 socket 缓冲;曾靠「非 paused 期队列无界」吞下超 2 MiB 突发的慢客户端此后可能被判慢消费者并按 `Last-Event-ID` 重连重放。`SubscriberWriterStats` 加 `replaying`。
- /v1 drain 的 `retry:` 帧经 writer 记账(RV-4-08):`sseStats().frames / writes` 自此计入;`http-server.ts` 直接 `res.write` 调用归零。行为不变。
- ⑳㉑ 音频面错误信封(RV-4-05 / V-C-09):上游 `transport_error` 与上游 401 / 403 / 5xx 归一 **503 `upstream_unavailable` 固定词条 + Retry-After**,上游状态 / 码 / 人话只进新结构化日志事件 `upstream.rejected{face,sessionId,upstreamStatus?,upstreamCode,message,status}`;上游业务 4xx(409 / 429 / 400 / 402 …)维持 doc/98 §二-⑳㉑ 原码透传。对你意味着:端侧不再因平台侧 401 `unauthorized` 误判本地令牌失效;此前依赖 403 `model_not_authorized` / 502 `http_502` 原样到端的调用方改读日志。`LOG_EVENT` 加一名。
- `server.replay.gap` 帧形态进契约门(RV-4-06):事件名 / 载荷键集 / `reason` 词表单源于 `v2/contract.ts`(`REPLAY_GAP_EVENT` / `REPLAY_GAP_REASON` / `ReplayGapNoticeSchema`),`ReplayGapNotice` 公共类型由 interface 改为 schema 推导 type(字段与可选性不变);改形不 `pnpm contract:manifest --bump` 即 `contract:check` 红。sdk `contract/MANIFEST.json` revision 随之 +1,端侧 vendored 拷贝由镜像卡更新。
- /v2 seq 会话内单调 + 起点规则(RF-05b,核心组件设计审查 RV-4-02;doc/98 §三-2 改笔,§3 代拍 #2 = B):resume 起的新纪元 seq **不再从 0 起**,起点 = store 持久化水位 + 1——文件 store 在每次轮末 / 改写检查点把 `lastSeq` 落 meta.json(只增不减),正常关闭(`session.ended` 后)落最终值并封印 `seqSealed: true`;播种规则 `seedInitialSeq`:封印 → 恰 `lastSeq + 1`(旧游标 `Last-Event-ID` 续传零 gap),未封印(崩溃 / 旧记录)→ `max(lastSeq + 1, now − createdAt ms)` 守卫地板(单纪元平均 > 1 事件/ms 为唯一理论失效窄窗,见 doc/98 §三-2)。旧游标落在新纪元起点之前 → gap `reason: 'evicted'`;空日志水位 = 起点 − 1;`Last-Event-ID` 缺席恒全量重放。wire 形零改动;resume `201` 响应 `lastSeq` 由恒 0 变为新纪元水位(L3 客户端恒弃游标重建,不读本值)。对你意味着:多设备 / 冷启动持旧游标重连不再必然重建;自实现 `ServeAgentSessionStore` 可选实现 `recordSeqWatermark`(缺席 = 不封印,按守卫地板起新纪元,仍安全)、`commit` 的 meta 多 `lastSeq?`;自实现 `SessionEventLog` 收 `SessionEventLogContext.epochStartSeq?`(可忽略)。加法导出:`ServeSessionDriverOptions.initialSeq?` / `ServeSessionExtras.initialSeq?` / `AgentSessionHandle.firstSeq?()` / `AgentStoredSessionMeta.{lastSeq?,seqSealed?}` / `AgentStoredSeqWatermark` / `MemorySessionEventLogOptions.floorSeq?`。
- 停机 `closeAll` 有界(RF-03,核心组件设计审查 RV-4-03):`server.close()` 等 /v1 store 与 /v2 registry 会话泵收口的末段不再无界——`StartServerOptions.closeAllTimeoutMs`(缺省 5 000 ms;`Infinity` = 旧的无界等待)到点即记一条 `server.close_timeout{face,pending,timeoutMs}`(warn,非失败)并继续停监听 / 切连接;`/readyz` 先 503 的时序不变。库面加法:`SessionStore.closeAll(options?: CloseAllOptions)` / `AgentSessionRegistry.closeAll(options?)` 返回 `CloseAllReport { timedOut, pending }`(缺席 `timeoutMs` = 等到全部落定 = 旧行为);`LOG_EVENT` 加 `server.close_timeout` 与 `process.hard_exit`(后者由 `tansr serve` 等进程入口在 drain 预算到点 / 第二枚信号硬退前留痕)。对你意味着:一个永不落定的会话泵不再能拖住整机停机;自托管宿主若依赖「closeAll 必等全部落定」,显式传 `closeAllTimeoutMs: Infinity`。
- `tansr serve` 每轮墙钟缺省(RF-03,§3 代拍 #9 = A;仅 serve 装配面,库 `startServer` 与 TUI / headless 不受影响):`TANSR_SERVE_TURN_WALL_CLOCK_MS` 缺席时自此为 **1 800 000 ms(30 min)**,显式 `0` = 停用(不再被库解析判为非法值告警),其他值照旧。此前缺省无墙钟,一轮可无限期占用会话并发槽。对你意味着:单轮预期超过 30 min 的部署需显式设更大值或 `0`;`deploy/serve*/README.md`、`.env.example`、doc/11 §5.4 / §6.1 / §7.2 同步改口。
- `tansr serve` 信号矩阵(RF-03):SIGINT / SIGTERM / SIGHUP / SIGBREAK 共用同一 listener,首枚 → 幂等有界 drain(整链预算 `drainTimeoutMs + 15 s`,到点记 `process.hard_exit` 后 exit 2),第二枚 → 立即 exit 2(此前被 `stopping` 位吞掉,只能等 drain 自然结束);SIGHUP 独立紧急预算 ≤ 3 s。退出码沿用 cli `exit-code.ts` 表(2 = 中断 / 外部信号 / 停机)。
- serve `hostShell` 透传(RF-08c / DEC-RF-33,AC-08 08c-2;纯加法,缺省随平台 = 现行):运维旋钮表新增 `TANSR_SERVE_HOST_SHELL=posix|powershell`(group `session`,target `session.hostShell`;`SERVE_RUNTIME_ENV` 31 键,`.env.example` / README 旋钮表随表再生),`ServeRuntimeSessionOptions.hostShell?` / `PlatformAgentSessionOptions.hostShell?` / `PlatformServeSessionFactoryOptions.hostShell?` 三处可选字段同缝展开(`...runtime.session` 既有形零改动),落到会话 `PermissionEngine` 的 `hostShell`(kernel `PermissionEngineConfig`:Shell 命令词法 / 结构树 / hard-safety / 分类器事实所用方言);CLI `tansr serve` 经同一 `session` 段进 `createServeSessionFactory({ hostShell })`。缺席不落键 = kernel 缺省 `detectHostShell()`(win32 → powershell,其余 posix),既有部署零改动。对你意味着:跨平台装配 / 词法对齐时可显式钉方言;它只改判定方言,执行器实际派生的 shell 仍随平台。sdk 侧 `CreateSessionOptions.hostShell?` 归 RF-02c。
- `ServeSessionDriverOptions.toolResultBudget?`(RF-08c,核心组件设计审查 §2.8 装配矩阵;加法字段,一个导出签名变化 → 下一版至少 minor):驱动逐轮把它原样透传 `runQuery.toolResultBudget`(kernel `ToolResultBudgetOptions`:`persist` 落盘存根 / `spill` 内容寻址外置 / `maxChars`),缺席不落键 = kernel 缺省纯截断即此前行为。`tansr serve` / `tansr acp` 装配面自此与 TUI / headless 同款接线:工具结果超帽 → 会话目录 `spill/` 落全文、历史里存根替身;压缩前 `pre_compaction` 快照落 `<sessionDir>/checkpoints/<sid>/`(`--checkpoints-dir` / `TANSR_CHECKPOINTS_DIR` / settings 独立根照旧生效)并签发 `session.checkpointed`。对你意味着:自托管宿主直构 `ServeSessionDriver` 时可选接同一预算件;不传者零变化。/v2 平台工厂自带 `checkpointStore` 时压缩前钩仍以平台持久化钩为准(后绑者胜)。
- /v2 客户端申报工具不受 kernel 中央入参校验影响(RF-08b,核心组件设计审查 RV-2-06;导出集零变化、wire 零变化):申报工具与 MCP 桥同律声明 `argsValidation: 'remote'`——本地 schema 只是申报投影(无 `parameters` 时为空对象 schema),调度器不剥参、不改权限 `digest` 输入,坏参仍由既有 `execute` 内自校以 `tool.completed { isError: true }`(`invalid <name> args: …`)出线,`tool.request` 照旧不下发。无需迁移。
- /v2 平台会话预算账本思考路逐行归账(RF-P3a,contract-v0.27 RFC-RF-3 阶段 2;导出集零变化、wire 零变化):`init.budget` 在场的会话账本自此按**每一行**的 (provider, model) 取 providers 内置能力表 `quirks.reasoningTokens` 处置思考 token——`'separate'` 行的思考量并入该行输出计量与计价,缺席 / `'subset_of_output'` 行照旧(思考 ⊆ 输出,不叠加);会话内模型切换 / 子代理另选模型的行各按自身能力位,工厂不再持会话级能力位(RFC-RF-3 §6 serve 三径「休眠键」闭合)。当前内置表零 `'separate'` 行,已部署会话的 `totalTokens` / 金额逐字节零变化;`server.platform.*` 帧、`GET /v2/sessions/:id` 面不变。无需迁移。

**会话级预算跨重启(RF-06b;五个导出签名变化)**:

- 会话级预算跨重启:`init.budget` 在场的会话每轮末随历史在 store 里落一条**累计用量快照**(内部事件记录,不进消息面 / 不进 SSE 历史页);`resume` 时内层追踪器自该快照续算,闸门读到的是历史消耗而非 0——「会话级预算」在进程重启 / 多实例接管后仍成立。预算缺席的会话零变化(不写、不读、不提示)。
- 快照落后于历史(进程在轮末快照前终止)时,resume 首连重放里多一帧 `server.platform.warning{code:'usage_snapshot_stale'}`(消息携落后消息数,`server.v2.warning.usage_snapshot_stale`);只丢末轮用量,不静默低报。
- 公共面加法字段(既有实现无需迁移;自实现 `ServeAgentSessionStore` 的宿主若想续算需自行保存 / 返回快照,否则退化为「每次 resume 从 0 起算」即此前行为):`AgentStoreCommitMeta.usageSnapshot?`(`UsageSnapshotRecordPayload`,来自 `@tansr/kernel`)、`AgentStoredSessionRecord.usageSnapshot?`(`RestoredUsageSnapshot`:`payload` + `staleMessages`)、`ServeSessionExtras.usageSnapshot?`(`CostSnapshot`,内层工厂续算起点)、`ServeTurnEndInfo.costSnapshot?`(内层预算在场时附带的轮末累计快照)、`V2_CTX_PERSIST_MESSAGE_KEY.usageSnapshotStale`。
- 内置文件 store:带预算的卷尾部含非消息记录(用量快照),历史分页在 RF-06b 时曾因此退出「尾部纯消息」快路全读回退;**RF-P3b 已闭合**(核 commit 的链尾见证 `lastHash + recordCount + messages` 与 `readTail` 吻合即取见证的消息数,快照记录在后缀与被跳过段里自然跳过,不再退全量读),只有无可信见证的旧卷 / 被外部写者动过的卷仍退全量读求精确——结果恒不变,`GET /v2/sessions/:id/history` 大卷读放大只余该兜底径(RF-Z ㉑ 复核)。

## 0.8.1 — 2026-09-11

- 统一系统媒体工具与平台提供方的说明，明确移动端工具在会话服务执行，用户主动转写/朗读与模型工具调用分别保留。
- 同步 SDK 媒体说明修正；不改变会话协议、能力授权、媒体产物、工具执行或计费行为，不新增公共导出。

## 0.8.0 — 2026-09-10

- 汇总此前未发布的 0.7.0 候选能力，并通过 v2 capabilities/inputs/status 接口提供严格同轮文本追加（INJ）；旧 v1/v2 messages 接口兼容。
- SDK 与 serve 共用输入接纳与回执机制，绑定 session/historyEpoch/turnId；丢失响应先查询原票，不通过隐式新轮重试。
- 手机重连原会话后，下一新轮继续自动加载平台提示词；轮中追加不刷新 system，不变更原权限、预算和会话归属。
- 资源排水与真实 settlement 分开；新增公共出口按 minor 推进至 0.8.0。旧 0.7.0 标签保留，正式发布状态以回执为准。

## 0.7.0

- AP-SP：平台工厂按 `systemPromptPolicy=fallback|prepend` 选择或拼接应用 systemPrompt 与 platform.system；prepend 下 [] 仍保留平台。platform.systemAppend 追加指南而不覆盖业务段。存活会话及移动端 attach 后的下一新轮自动条件核验平台正文和策略，轮中不变；失败不带旧配置请求模型，保留历史并可重试，取消/超时与令牌续期沿统一预检。移动端只发用户消息，不新增 system wire 字段。

> 历史候选归档：0.7.0 没有单独发布，以下内容并入 0.8.0；本地旧标签保留在原候选源码。十王修案 W1–W4 原收编于 cli main `9f09c1b7`，实际发布以回执和 registry 为准。
> 导出集:`exports.snapshot.json` 由发版门首版基线 364(0.6.1 dist,W2 FX-C-25)→ W2 收编 375 → W3 收编 395(W3 回执 §一)→ W4 收编 395
> (导出数不变,`AssembledSessionModel` / `AgentSessionRetentionSweepInput` 两签名变;W4 回执 §一)。以下逐条按波次的收编回执与 C-α / C-β 终报为事实源;
> 每条括注卡号(FX-C-nn)与所属波次。

### 核心机制整改（CM；历史候选内容）

- 平台下发的上下文方案与宿主配置合流后，由查询和压缩共同消费，恢复会话沿用同一有效配置；嵌套阈值只覆盖明确提供的值。owner/app_user 均按各自身份投影生效（CM-03）。
- 空闲或自动摘要即使被质量校验拒绝，已报告用量仍计入公共成本；小窗输出回退遵守测得正剩余，零/负估算余量保留原有恢复规则并明确提示（CM-02/06）。
- CLI `serve` 工厂按新会话的组织开关和规范化 cwd 绑定项目记忆，恢复到不匹配项目明确拒绝；独立平台工厂保持原有能力面，未隐式增加 CLI 自动记忆或 Read 工具（CM-01）。
- CLI serve 的 TTS 产物在成功和落盘失败两种情形均保持隐路径；失败仍返回已有音频，原始错误由工厂宿主的可选诊断回调消费。远端 SSE 不携该诊断，CLI 默认只记录安全事件与 errno（CM-10）。
- `/v2` 平台 ASR 代打在向上游发送前检查原始音频和实际 JSON 体积，越限不会发请求或触发无用刷新；入站 HTTP 体帽与出站平台预检分别生效（CM-11）。

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
