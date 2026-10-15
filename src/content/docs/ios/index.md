---
title: iOS 接入指南
description: Swift 包的三模块切层、视图流与事件归约、连接状态机与三级恢复链、scenePhase 前后台策略、乐观落帐、错误呈现、本地工具与双桥、语音两条链、推送唤醒自接，以及 Windows 上构建纯 Swift 逻辑层的注意事项。
zone: docs
category: ios
related:
  - sdk/system-prompts
  - getting-started/android
  - android
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-ios:doc/report/REL-FULL-20261010-iOS-0.4.0.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

iOS SDK 是 Android SDK 的 Swift 镜像，三端同律：同一份会话契约常量对表（revision 9）、同一份 `/api` 合同生成物（manifest revision 7）、同一份视图归约金样、同一份帧序夹具。这一篇按与 Android 指南相同的顺序展开，方便双端团队对照；差异点（SwiftUI 接线、乐观落帐、Info.plist 声明、Windows 构建）单独标出。本页按公开二进制包 `tansr-ios-spm` **0.4.0**（GitHub Release，2026-10-09）核对，服务端按 `@tansr/serve` 0.15.1（npm latest，2026-10-10）。

## 版本与服务端前缀（2026-10-13 核对）

- 公开二进制包 0.4.0（2026-10-09 发布，源码 `f3f31a6`）起，SDK 的全部 HTTP 请求只走服务端 0.13.0 起提供的统一调用面 `/api`（D10：立即切换，源码内不再有 `/v2`、`/v3/sdk2`、`/v3/terminal` 路由字面量）。路径、方法与头名来自按 manifest revision 7 生成的 `ApiContract` / `ApiOps`（81 个操作）；会话族由请求头 `tansr-session-family: sdk1 | sdk2-offload-v1` 显式携带。服务端须已装配 `/api` 门面（`@tansr/serve` 0.13.0 起；r7 自 0.14.0 起），响应头 revision 与本地 r7 不同时 `TansrAgentClient.onManifestRevisionDrift` / `AudioClient.onManifestRevisionDrift` 每客户端触发一次。
- 随 0.4.0 一起发布的还有：统一错误码为主的错误模型（D19：`TansrAgentError.kind == .unified` / `.contractUnavailable`，SDK 2.0 与终端服务面 `ApiFacadeError`）、SDK1 成功响应与事件流的统一响应头门（D38）、三个请求头 `Idempotency-Key` / `If-Match` / `deadline` 的 `ApiCallOptions`，以及 SDK 2.0 端侧接口。本页按这些行为描述。
- 更早的 0.3.0 仍直连 `/v2`。服务端 `/v2` 自 0.13.0 起只是内部适配入口，1.0.0 移除外部入口；仍在 0.3.0 上的 App 请升级到 0.4.0，时间表见[部署与鉴权](/serve/deploy-and-auth/)。

## 手机端发送用户消息，服务端配置系统提示词

`CreateSessionRequest(prompt=...)` 与 `session.send(...)` 都发送普通用户消息；Android / iOS 不经 `/api` 的会话请求传入 `system`。共享角色由平台应用配置管理，代码定制角色由 serve 的 `platform.system` 提供，宿主说明用 `platform.systemAppend`。

提示词与策略功能自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线；默认 `fallback` 下 SDK 显式 `system`（包括空数组）替代平台段，`prepend` 下保留平台段在前。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；前后台重连、SSE 恢复和 attach 可以保留原会话与历史，无需重开来取得更新。请由应用管理员消除业务段冲突，权限仍走独立机制。详见[应用系统提示词](/sdk/system-prompts/)。

## 模块切层

| 模块 | 类型 | 内容 |
|---|---|---|
| `TansrCore` | 纯 Swift，任意平台可测 | 契约常量与 `/api` 合同生成物（`ApiContract` / `ApiOps` 81 操作、`UnifiedContract`）、响应头门 `ApiContractGate`、`ApiCallOptions`、`KernelEvent` 类型系（47 型 + `Unknown` 容忍）、IR 消息模型、SSE 解析 / 分派、`SessionView` reducer 与 `viewStateFromHistory`、`toolCardArtifact` 与 `SearchResultDetails` / `NetworkResultDetails`、协议客户端逻辑与传输抽象、音频直连面 `AudioClient`、重连状态机（L1 / L2 / L3）、`defineTool` 与远程工具桥、权限 / 提问桥 `SessionBridges`（fail-closed 缺省）、`BridgeDialogState`；SDK 2.0 薄客户端 `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSync` 与终端服务客户端 `TerminalClient` |
| `TansrClient` | 纯 Swift | URLSession 传输（SSE 走 delegate 桥，Darwin 与 FoundationNetworking 同径）、`TansrAgent` 入口工厂；SDK 2.0 的 SQLite 档案接收器 / 同步库 / 执行日志（`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteArchiveSyncStore` / `Sdk2SqliteExecutionJournal`） |
| `TansrUI` | SwiftUI（`#if canImport(SwiftUI)`，非 Apple 平台空编译） | `TansrSessionObserver`、`tansrSessionLifecycle`、缺省权限 / 提问对话框 `tansrBridgeDialogs`、`TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`；皆可替换，不绑主题，零 AVFoundation 依赖 |

发布渠道 SwiftPM：公开二进制包 `tansrai/tansr-ios-spm`（当前 0.4.0，2026-10-09 发布；远端 XCFramework，不含 SDK 实现源码，模块名保持 `TansrCore` / `TansrClient` / `TansrUI`；由 Xcode 26.6 / Swift 6.3.3 以 Swift 5 语言模式构建）；最低 iOS 16+ / macOS 13+，覆盖 iOS 真机 arm64、模拟器 arm64 / x86_64 与 macOS arm64 / x86_64。源码仓 `tansr-ios` 的 SPM tag（0.2.0）发布在私有仓库，需要仓库访问权限，面向有源码权限的联调。

## 视图流与事件归约

```swift
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState>
session.events()                // AsyncStream<KernelEvent>
session.connectionState         // idle → connecting → live → retrying / recovering / authExpired …
```

SwiftUI 宿主用 `TansrSessionObserver(session:)` 把 `view` / `connectionState` / `userSendStates` 变成 `@Published` 直喂重组。`view` 是已归约的视图状态，不要自己拼增量。呈现档 `SessionViewOptions(delivery: .init(text: .final, thinking: .off))`:`final` 档 delta 入内部缓冲、块定稿整段上屏；`thinking: .off` 不物化思考 part（状态派生仍见 `thinking`，可做占位 UI）；运行中 `session.setDelivery(...)` 块粒度切换，切 `.off` 时既有思考一并即刻剔除。L2 / L3 重建与 resume / attach 恒沿用当前档位。

工具卡产物 `toolCardArtifact` 解出 imageGen / videoGen / webSearch 的 URL 产物与 `.transcript(model:text:language:durationSec:)` / `.speech(model:url:b64:mime:format:durationMs:billedChars:)`;`TansrToolCard` 缺省渲染五形，`.speech` 的「播放」按钮只在宿主传入 `onPlaySpeech` 槽位时出现——`TansrUI` 不内置播放器。

## 连接状态机与三级恢复链

与 Android 完全一致：L1 SSE 断连携 `Last-Event-ID` 重连、收帧按 seq 去重；L2 重连首帧收到 gap → 弃投影 → 元信息 → `/history` → `viewStateFromHistory` 重建 → 自 `lastSeq` 续订；L3 元信息 404 或 `live == false` 或冷启动只持 sessionId → `CreateSessionRequest(resumeSessionId: savedId)` resume 重灌，弃旧游标、以 `history.lastSeq` 为锚（不读 resume 响应的 `lastSeq`）。断线恒不浮到业务码。

`lastSeq` 恒按值续传，休眠判据恒 `live == false`、恒不是 `lastSeq == 0`。`@tansr/serve` 0.9.0 起，休眠会话的元信息 `lastSeq` 是 store 落盘的真值水位、resume 后的新纪元自该水位 + 1 续起而非从 `0` 起（0.8.x 两处恒 `0`）；两版行为端上都无需适配。`live == true` 且 `lastSeq == 0` 只走 L2、恒不 resume。会话契约 revision 9（0.4.0 随包 vendored）登记 55 型事件，`TansrCore` 解码其中 47 型；SDK 专属事件 `session.events_dropped`（contract-v0.27）serve 恒不发出、事件流恒无，即便出现也归 `Unknown` 容忍。

401 收敛条同律：经 `authProvider` 重取令牌至多 2 次，仍 401 进入 `failed(unauthorized)` 终态，`view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`，泵停，须宿主修好登录态后显式 `start()`。终态是 `failed` 不是 `closed`——会话未终结，服务端仍持有。

统一响应头门（D38，三端同构）：`TansrAgentClient.call()` 的每个 2xx、`openEventStream` 的 200 事件流与 `AudioClient` 的 2xx 都先过 `ApiContractGate.requireUnified`——四头 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 齐全合形；违例抛 `TansrAgentError.contractUnavailable(status:reason:)`，**不是业务成功，不回退**。事件泵对 2xx 形的合同不可用直接进入 `failed` 终态（不退避不重连；典型原因是 `baseUrl` 没指向 `/api` 门面或中间有代理 / 门户页），宿主修好部署后 `start()`；≥400 形仍按状态码策略。

## 前后台：scenePhase 一行接线

```swift
ChatScreen(session: session)
    .tansrSessionLifecycle(session)  // scenePhase 收放;在场即不需手工 start()
```

回后台停泵断 SSE（挂起非 fatal，`connectionState` 归 `idle`）；回前台按**恢复窗**自动选径：热态（缺省 60 s 内）L1 直连续传；超阈且后台期有轮在跑则先行 L2 `history` 重建；会话被闲置回收时 404 → L3 自愈。决策是 `TansrCore` 纯函数 `LifecyclePolicy`，阈值经 `AgentSessionConfig.warmResumeWindowMs` 可调。非 SwiftUI 宿主等价接线：前台 `session.start()`、后台 `session.stop()`，幂等，`stop` 恒不丢会话。会话终结（`closed`）后回前台恒不自动复活。

## 乐观落帐（iOS 特有呈现）

`send` / `sendBlocks` 调用即落 user 气泡（`userSendStates` 记 `sending`），HTTP 202 确认后出帐；失败标 `failed` 恒不静默消失——`retrySend(messageId)` 原消息 id 原样重投（不重复气泡），`discardSend(messageId)` 幂等撤帐。L2 / L3 重建恒清乐观簿防撞帐（重建后消息 id 自 1 重排）。

## 错误呈现

| 来源 | 形 | 呈现 |
|---|---|---|
| 会话内错误 | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner`;`detail.scope == 'plan'` 时用「稍后重试」措辞 |
| 咨询类 | `view.notices`(`recoverable: true`) | 弱提示 |
| 连接态 | `connectionState` | `TansrConnectionBanner` |
| HTTP 面 | `TansrAgentError.kind == .unified`：`unifiedCode` 为 19 个统一码之一（`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …）、`retryAction` 为 6 个动作之一（`none` / `same-request` / `query-status` / `rediscover` / `rebind` …），原族码留 `domainCode` / `domainStatus` / `domainRetryAction`，另携 `traceId` / `requestId`；门面合同不可用为 `.contractUnavailable`（`reason` = 违例项）；SDK 2.0 / 终端服务面直抛同形的 `ApiFacadeError`（`Sdk2HttpError` 已标废弃）。按 `domainCode` 还原旧 kind 的 `toLegacy()` 只作一版过渡；无 `tansr-contract` 头的旧 `{ error: { code } }` 信封仍过过渡桥 | 按 `unifiedCode` + `retryAction` 分支，`domainCode` 只作诊断细分 |

`capacity_exceeded`（429 形，`retryAction = same-request`）按 `Retry-After` 整秒值等待；32 MiB 音频体帽端侧先拒（`.payloadTooLarge`，不发请求）。

## 本地工具与双桥

```swift
let searchOrders = try defineTool(name: "searchOrders", description: "Search the user's orders") { tool in
    try tool.string("keyword", description: "search keyword")
    tool.readOnly = true
    tool.handler { args in try await db.search(keyword: args.string("keyword")) } // async;返回值宽容归一
}

let dialogs = BridgeDialogState() // 或自写 async 回调
let session = try await client.openSession(CreateSessionRequest(), bridges: try dialogs.bridges(tools: [searchOrders]))
// SwiftUI: .tansrBridgeDialogs(TansrBridgeDialogObserver(state: dialogs))
```

handler 以任务运行、按 `callId` 配对：重放的重复帧去重，`server.tool.cancel` 取消任务，`deadlineAt` 越线自弃（不应答），应答网络失败安全重试，图片结果 base64 化并前置 20 MiB 帽自检，权限 digest 由 SDK 逐字复述。未注册的桥 fail-closed:SDK 恒不应答，服务端按契约降级（权限 deny-and-continue / 提问结构化「自行裁决」）。

## 公网工具：服务端执行

应用在控制台开启 `tools.webFetch`、`tools.http`（需 `@tansr/serve` 0.12.0 起）或 `tools.webSearch` 后，智能体可以读取网页、发起 HTTP 请求或联网搜索。这些工具都在你的会话服务主机上执行：手机不代发网络请求，也不绕过原有权限审批。能力位改动对新建会话或从存储重新装配的会话生效，运行中的会话不会自动增删工具。

- 公开二进制 SPM 自 0.3.0 起包含 `SearchResultDetails` / `NetworkResultDetails` 显示投影，`ToolCardArtifact` 原有用法不变：搜索卡保留来源、截断与空结果提示，网页与 HTTP 卡保留原正文并显示实际 HTTP 状态。
- HTTP 状态不代替工具成败，4xx / 5xx 仍需检查；搜索空结果不代表已知网址无法访问。旧历史缺少这些元数据时保持未知，不补造。
- 能力开关、执行边界与跨主机跳转的审批规则见[移动应用的公网工具](/sdk/platform-bundle/#移动应用的公网工具)。

SDK 2.0 在服务端已随 `@tansr/serve` 0.13.0 / 0.14.0 发布（`@tansr/serve/extensions` 显式宿主与 `/api` 统一调用面）；iOS 侧自公开包 0.4.0 起随包提供端侧接口：`TansrCore` 的 `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`、档案同步 `Sdk2ArchiveSync` 与副本接收 `Sdk2ReplicatedArchive`、终端服务客户端 `TerminalClient`，`TansrClient` 的 SQLite 档案接收器 / 同步库 / 耐久执行日志（私有目录、Data Protection Keychain 保管密钥）。它们是加法能力：不显式装配就不建同步库、不发 `archive-sync-v1` 请求，SDK1 会话行为不变。发布记录登记本轮为模拟器 ad-hoc 签名验收、无真机验证；2026-10-10 之后进入主线的加密记忆发布、设备存储保源迁移与终端持久化档位**尚未随任何 SPM 版本发布**，本页不描述。装配与边界见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。

## 语音：两条链

1. **工具链**：智能体调 `SpeechToText` / `TextToSpeech`，产物随 `tool.completed.data` 到端，`TansrToolCard` 缺省渲染（转写正文 + 时长；语音行 + 时长 + 模型 + 计费字符）。
2. **直连链**：

```swift
// 麦克风 → 转写 → 填入输入框(不自动发送);m4a 16 kHz mono 上行 data:audio/mp4;base64,…
let transcript = try await client.audio.transcribe(
    sessionId: session.sessionId, data: m4aBytes, mime: "audio/mp4", language: "zh")
inputText = transcript.text

// 助手回复 → 语音 → 播放(url ?? b64;url 形约 24 h 时效)
let speech = try await client.audio.speak(sessionId: session.sessionId, text: reply, voice: "Cherry")
speech.url ?? speech.b64
```

纯 HTTP 往返（`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`，2xx 同样过统一响应头门），恒不进历史；是否把转写文本作为下一条用户输入归 App。服务端代打平台 `/t1/asr` / `/t1/tts`，受能力位 `platform.speechToText` / `textToSpeech` 与配额同闸；失败按 D19 落 `.unified`：统一码在 `unifiedCode`（如 `capability_unavailable` / `invalid_request` / `upstream_unavailable`），平台音频面的原码（`asr_not_configured` / `tts_quota_exceeded` …）在 `domainCode`。`@tansr/serve` 0.9.0 起平台上游 401 / 403 / 5xx 与网络故障归一为 `upstream_unavailable`（503）携 `Retry-After`，端侧按整秒值退避即可。

**麦克风权限声明**:App target 的 Info.plist 必须携 `NSMicrophoneUsageDescription`，缺失时 iOS 在首次访问麦克风即终止进程。本仓是 SwiftPM 包，`executableTarget` 没有 Info.plist 语义——示例 `Examples/OrderAssistant/Info.plist` 在 `Package.swift` 里显式 `exclude`,iOS 经 Xcode 建 App 工程挂本包时把它设为 App target 的 Info.plist（或逐键并入）；macOS `swift run` 用 `-Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker <path>` 嵌入。仓内刻意不用 `linkerSettings.unsafeFlags`（作为依赖时会被 SwiftPM 拒收）。

## 推送唤醒：自接

SDK 恒不内置任何推送 SDK（APNs / FCM / 厂商通道归你）。服务端 webhook 缝在轮终态且无活跃订阅者时 POST 最小载荷，见[v2 协议与 webhook](/serve/v2-and-webhooks/)。App 收到推送唤起后恒走既有三级链，零新 API：进程还在 → 回前台自动 L1 重连；进程已死 → 冷启 `openSession(CreateSessionRequest(resumeSessionId: id))` 即 L3。

## 联调与构建

- 应用接入使用公开二进制 SPM 包 `tansr-ios-spm`（见[快速开始的 iOS 一节](/getting-started/android/#ios-同法)）；本节的 `swift build` / `swift test` 面向有源码权限的联调。同一 App 依赖图里不要混用源码 SDK 与二进制 SDK。
- 对接仓内 `examples/serve-demo`：`pnpm start` / `pnpm real`（npm 对应 `npm start` / `npm run real`）都是真实模型入口，常驻联调以 `DEMO_SERVE_ONLY=1`、`DEMO_PORT=8788` 起服（源码缺省端口 8799；已无公开的 echo 启动命令），独立开发者登录服务 `pnpm login` 缺省 `127.0.0.1:8787`；demo 鉴权票形制 `demo1.<b64url(uid)>.<exp>.<hmac-sha256-hex>`。iOS 模拟器连宿主机直用 `127.0.0.1`。示例 `OrderAssistant`:`swift run OrderAssistant`，或 `TANSR_DEMO_BASE_URL=http://127.0.0.1:8789 swift run OrderAssistant` 覆盖服务地址；明文 http 仅 demo 用 `NSAllowsArbitraryLoads` 放行，生产恒上 TLS。
- **Windows / Linux 上构建逻辑层**：`swift build` / `swift test`（Swift 6.3+）跑 `TansrCore` 全卷——金样对拍、契约对表、泵状态机、乐观落帐、双桥矩阵、音频直连面。Windows 跑 `swift test` 需把 XCTest 运行时 DLL 目录加进 PATH（`<Swift>\Platforms\<ver>\Windows.platform\Developer\Library\XCTest-<ver>\usr\bin64`）。
- Windows 上若在载包处即红 `NSCocoaErrorDomain Code=257 "You don't have permission."`，通常不是 ACL 问题：SwiftPM 会把 `Package.swift` 编成 `%TEMP%` 下的 `<包名>-manifest.exe` 再启动，带主动防御的安全软件会拦截并隔离它。处置二选一：把 Swift 工具链目录加入安全软件信任区（根治）；或 `mklink /J` 一个安全软件放行的目录别名后在其中运行。
- macOS(Xcode 15+):`swift build && swift test` 全量含 `TansrUI`;iOS 模拟器 / 真机经 Xcode 打开本包跑 `OrderAssistant` scheme。
