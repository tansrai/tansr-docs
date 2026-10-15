---
title: Android 接入指南
description: Kotlin SDK 的模块切层、事件归约与 SessionView、连接状态机与三级恢复链、前后台与 Doze 策略、错误呈现、本地工具与双桥、语音两条链、推送唤醒自接，以及凭据与日志纪律。
zone: docs
category: android
related:
  - sdk/system-prompts
  - getting-started/android
  - ios
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-android:doc/report/ANDROID-MEDIA-03-0.4.0-发布记录.md
  - tansr-android:doc/report/REL-ANDROID-05-0.5.0-发布记录.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

Android SDK（Maven 坐标 `com.tansr.sdk:core` / `:client` / `:compose`，可选 `:receiver-android`，包名前缀 `com.tansr.sdk`）是会话服务的薄协议客户端：实现 Agent 会话服务契约，全部请求经统一调用面 `/api` 出线。这一篇讲快速开始之后你会遇到的全部设计点：事件怎么变成 UI 状态、断线怎么恢复、前后台怎么处理、错误怎么呈现、工具与对话框怎么接、语音与推送怎么接。本页按已发布的 **0.5.0**（Maven Central，2026-10-07；四模块同版）核对，服务端按 `@tansr/serve` 0.15.1（npm latest，2026-10-10）。

## 版本与服务端前缀（2026-10-13 核对）

- 0.5.0（2026-10-07 上架 Maven Central，源码 `50306a2c`）起，SDK 的全部 HTTP 请求只走服务端 0.13.0 起提供的统一调用面 `/api`（D10：立即切换，不保留 `/v2` 回退）。路径、方法与头名来自按 manifest revision 7 生成的 `ApiContract` / `ApiOps`（81 个操作）；会话族不再由路径区分，而由请求头 `tansr-session-family: sdk1 | sdk2-offload-v1` 显式携带。服务端须已装配 `/api` 门面（`@tansr/serve` 0.13.0 起；r7 自 0.14.0 起）。
- 随 0.5.0 一起发布的还有：统一错误码为主的公开异常模型（D19，相对 0.4.0 是破坏性变更，旧族密封型 `@Deprecated` 保留一版）、SDK1 成功响应与事件流的统一响应头门（D10 / D38）、三个请求头 `Idempotency-Key` / `If-Match` / `deadline` 的 `ApiCallOptions`。本页按这些行为描述。
- 更早的 0.1.0 – 0.4.0 仍直连 `/v2`。服务端 `/v2` 自 0.13.0 起只是内部适配入口，1.0.0 移除外部入口；仍在这些版本上的 App 请升级到 0.5.0，时间表见[部署与鉴权](/serve/deploy-and-auth/)。

## 手机端发送用户消息，服务端配置系统提示词

`CreateSessionRequest(prompt=...)` 与 `session.send(...)` 都发送普通用户消息；Android / iOS 不经 `/api` 的会话请求传入 `system`。共享角色由平台应用配置管理，代码定制角色由 serve 的 `platform.system` 提供，宿主说明用 `platform.systemAppend`。

提示词与策略功能自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线；默认 `fallback` 下 SDK 显式 `system`（包括空数组）替代平台段，`prepend` 下保留平台段在前。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；前后台重连、SSE 恢复和 attach 可以保留原会话与历史，无需重开来取得更新。请由应用管理员消除业务段冲突，权限仍走独立机制。详见[应用系统提示词](/sdk/system-prompts/)。

## 模块切层

| 模块 | 类型 | 内容 |
|---|---|---|
| `:core` | 纯 Kotlin/JVM，零 Android 依赖 | 契约常量与 `/api` 合同生成物（`ApiContract` / `ApiOps` 81 操作、`UnifiedCode` 19 统一码、`UnifiedRetryAction`）、`ApiCallOptions`、`KernelEvent` 密封类系（47 型 + `Unknown` 容忍）、IR 消息模型、SSE 解析 / 分派、`SessionView` reducer 与 `viewStateFromHistory`、工具卡产物解析 `toolCardArtifact` 与搜索 / 网络结果投影 `SearchResultDetails` / `NetworkResultDetails`、协议客户端逻辑与传输抽象、音频直连面 `AudioClient`、重连状态机、`defineTool` 与远程工具桥、权限 / 提问桥 `SessionBridges`、`BridgeDialogState`；SDK 2.0 薄客户端 `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSyncClient` 与终端服务客户端 `TerminalClient` |
| `:client` | 纯 Kotlin/JVM | OkHttp 传输实现、`TansrAgent` 入口工厂 |
| `:compose` | Android 库 | Compose 绑定薄层：`collect*AsStateWithLifecycle`、`TansrSessionLifecycle`、缺省权限 / 提问对话框、`TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`；皆可替换，不绑主题，零播放器零权限；错误文案按统一码 + `retryAction` 呈现 |
| `:receiver-android` | Android 库（可选，0.5.0 首发） | SDK 2.0 端侧持久层：SQLite 档案接收器、同步库与耐久执行日志（`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteSyncArchiveStore` / `Sdk2SqliteExecutionJournal`）；不替代三模块，只在接入 SDK 2.0 端侧执行时引入 |

`:core` / `:client` 刻意做成纯 JVM，协议面无需设备即可单测。公开 API 面受 binary-compatibility-validator 守护，变更恒显式过 diff。四个模块共用一个版本号，升级时一起升级。

## 事件归约：三个流

```kotlin
session.events          // SharedFlow<KernelEvent>(replay = 0;历史语义归 view 与恢复链)
session.view            // StateFlow<SessionViewState>(reducer 投影,conflated)
session.connectionState // StateFlow<ConnectionState>
```

- `events` 是原始内核事件，与服务端 SSE 一帧一条；未知类型解码为 `Unknown(type, raw)` 恒不抛，坏 JSON 只计数上报诊断位、不断流。会话契约 revision 9（0.5.0 随包 vendored）登记 55 型事件，SDK 解码其中 47 型；新增的 SDK 专属事件 `session.events_dropped`（contract-v0.27，Node SDK 进程内背压兜底）serve 恒不发出、`/v2` 流恒无，即便出现也按 `Unknown` 容忍，端侧零渲染义务。
- `view` 是**已归约的视图状态**：消息列表（用户 / 助手 / 工具卡）、待办、用量、`lastError`、`notices`。多数 UI 直接订阅它，不要自己拼 `msg.text.delta`。reducer 与 TS / Swift 实现共用同一份金样夹具，三端投影语义一致。
- 呈现档 `SessionViewOptions(delivery = …)`：文本与思考各自选 `stream` / `final`（思考另有 `off`），运行中 `setDelivery` 块粒度切换。

工具卡产物用 `toolCardArtifact(data)` 按形状解出：图像 / 视频 / 联网搜索的 URL 产物，语音的 `Transcript(model, text, language?, durationSec?)` / `Speech(model, url?, b64?, mime, format, durationMs?, billedChars)`;`errorCode` 在场恒判空。`TansrToolCard` 缺省渲染这些形；`messageActions` / `speechAction` 两槽位供你挂「播放 / 停止」按钮。

## 连接状态机与三级恢复链

```text
Idle → Connecting → Live
Live → Retrying(指数退避,尊重服务端 retry 首帧)→ Live          // L1:携 Last-Event-ID 重连,重放按 seq 去重
Live → Recovering(拉 /history 重建)→ Live                        // L2:重连首帧收到 gap
401 → AuthExpired(回调 authProvider 重取)→ 刷够仍 401 → Failed(Unauthorized)
200 流缺统一响应头 → Failed(ContractUnavailable)                   // D38:部署形态错误,不退避不重连
```

| 级 | 触发 | SDK 做什么 |
|---|---|---|
| L1 | 闪断 / 网络切换 / 回前台 | 自动重连携 `Last-Event-ID=<最后消费 seq>`，收帧按 seq 去重 |
| L2 | 重连首帧收到 `server.replay.gap` | 弃当前投影 → `GET /api/sessions/:id` → `GET …/history` → `viewStateFromHistory` 重建 → 自 `lastSeq` 续订 |
| L3 | 元信息 404 或 `live = false`，或冷启动只持 sessionId | `POST /api/sessions { resume }` → `resumed = true, lastSeq = <新纪元起点水位>` → 弃旧游标按 L2 重建（锚取 `history.lastSeq`，不读该响应值） |

全程业务零码。冷启动接着上次聊：`CreateSessionRequest(resumeSessionId = savedId)`——SDK 缺省 **attach-first**：先 GET 元信息探针，活跃则 attach（零上游成本），不活跃才 resume 重灌，store 无档才新建。会话终结（`Closed`）后不会自动复活。

**`lastSeq` 恒按值续传，休眠判据恒 `live = false`**——恒不是 `lastSeq == 0`。`@tansr/serve` 0.9.0 起，休眠会话的元信息 `lastSeq` 是 store 落盘的真值水位、resume 后的新纪元自该水位 + 1 续起（0.8.x 两处恒 `0`）；SDK 的 L3 本就弃旧游标、以 `history.lastSeq` 为锚，两版行为无需端上适配。`live = true` 且 `lastSeq == 0` 只走 L2、恒不 resume。

**401 收敛条**：事件流 401 → 经 `authProvider` 重取令牌再连，**每连接至多 2 次**（第 1 次退避 0 ms、第 2 次 1000 ms；`AgentSessionConfig.authRetry` 可配但恒有限）；仍 401 即 `connectionState = Failed(Unauthorized)` + `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`，泵停、恒不再自动重连，须宿主修好登录态后显式 `start()`。令牌刷了再 401 就是吊销或配置错，不是抖动。

**统一响应头门（D10 / D38）**：每个 2xx JSON 响应与 200 事件流在读体 / 读帧前都核对四个响应头 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`；缺头或异形抛 `TansrAgentException.ContractUnavailable(status, reason)`（`reason` 指明违例，如 `missing_header:tansr-contract`），**不是业务成功，也不回退旧前缀**。2xx 形的合同不可用——典型是 `baseUrl` 没指向 `/api` 门面、代理缓存页、强制门户——让泵直接进入 `Failed` 终态：这是部署形态错误而非瞬时故障，重试无益，修好后显式 `start()`；≥400 形（代理 502 / 503 HTML 页等）仍按状态码策略退避。统一门面恒出四头，只有自建假服务 / 测试夹具需要补头。

## 前后台与 Doze

后台长连接不可靠且耗电，SDK 的策略是**回后台停泵断流、回前台按恢复窗自动选径**：

- 热态（缺省 60 s 内回前台）：L1 直连续传；
- 超阈且后台期有轮在跑：先行 L2 `history` 重建，免一次注定 gap 的订流；
- 会话被闲置回收（服务端缺省 5 min 离场回收 / 24 h 闲置）：404 → L3 自愈。

Compose 一行 `TansrSessionLifecycle(session)`（`repeatOnLifecycle(STARTED)` 收放）；非 Compose 前台 `start()`、后台 `stop()`，幂等，`stop` 不丢会话。阈值经 `AgentSessionConfig.warmResumeWindowMs` 调。决策是 `:core` 纯函数 `LifecyclePolicy`,JVM 单测覆盖。Doze 强制空闲期泵已停（服务端无活跃订阅者），亮屏回前台按同一策略自愈；厂商激进杀后台等同冷启 L3。

服务端半场配合：订阅者全部离场 60 s 后服务端 interrupt 运行中的轮（轮末落盘照走），5 min 后 close 落 store——所以「退后台再回来发现轮被中断」是设计行为，历史不丢，resume 可续。要在后台期把「轮跑完了」告诉用户，走下文的推送唤醒。

## 错误呈现

| 来源 | 形 | 呈现建议 |
|---|---|---|
| 会话内错误 | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner` 缺省渲染；`detail.scope == 'plan'` 时按「稍后重试」而非「本机限流」措辞 |
| 咨询类 | `view.notices`（`recoverable: true` 的 `turn.error`，如服务端落盘失败） | 弱提示，不阻断输入 |
| 连接态 | `connectionState` | `TansrConnectionBanner`:`Reconnecting…` / `Recovering` / 鉴权失效 |
| HTTP 面 | `TansrAgentException.Unified`：`code` 为 19 个统一码之一（`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …），`retryAction` 为 6 个动作之一（`none` / `same-request` / `query-status` / `rediscover` / `rebind` …），原族码与原状态留在 `domainCode` / `domainStatus`（如 `session_not_found`、`session_limit_exceeded`），另携 `traceId` / `requestId` / `retryAfterSeconds`；门面合同不可用为 `ContractUnavailable(status, reason)`；SDK 2.0 / 终端服务面抛同形的 `ApiFacadeException`。旧族密封型（`SessionNotFound` 等 33 型）与 `Unified.toLegacy()` 均 `@Deprecated`、只保留一版，且只在无 `tansr-contract` 头的旧信封上出现；`Network` / `Protocol` / `Unauthorized` / `Forbidden` 保留 | 按 `code` + `retryAction` 分支，`domainCode` 只作诊断细分；不要再按 `domainCode` 还原旧型 |

`capacity_exceeded`（429 形，`retryAction = same-request`）读 `retryAfterSeconds`（取 `Retry-After` 头，缺头时由信封 `retryAfterMs` 上取整）后等待；`domainCode = session_limit_exceeded`（每个终端用户缺省 8 个活跃会话，serve `maxSessionsPerEndUser`）时提示用户关闭不用的会话。错误消息文案恒英文，宿主按 `code` 自行本地化。

## 本地工具与双桥

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) }
}
val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(), bridges = dialogs.bridges(tools = listOf(searchOrders)))
```

- `defineTool`:`name` / `description` / JSON 参数表 / `readOnly`（缺省 false，保守按写工具）/ `timeoutMs?`;handler 是挂起函数，String 直落、其余 JSON 序列化、抛异常归一为 isError 结构化结果恒不炸会话；`CancellationException` 透传（对应 `server.tool.cancel`）。申报随会话出线，handler 本体恒不出线。
- 六项协议语义由 SDK 代劳：按 `callId` 配对、重放重复帧去重、`deadlineAt` 越线自弃不应答、应答网络失败安全重试、图片结果 base64 化并前置 20 MiB 帽自检、权限 digest 逐字复述。
- 权限 / 提问对话框：`BridgeDialogState` + `TansrBridgeDialogs(dialogs)` 拿缺省 UI，或自写 suspend 回调。**未注册的桥 fail-closed**:SDK 不应答，服务端权限 120 s 到点 deny-and-continue、提问 60 s 宽限后结构化「自行裁决」。
- 权限帧的 `attribution.reason` 在场时（裁决人判为危险）把理由显示给用户终审；机器恒不代批。

## 公网工具：服务端执行

应用在控制台开启 `tools.webFetch`、`tools.http`（需 `@tansr/serve` 0.12.0 起）或 `tools.webSearch` 后，智能体可以读取网页、发起 HTTP 请求或联网搜索。这些工具都在你的会话服务主机上执行：手机不代发网络请求，也不绕过原有权限审批。能力位改动对新建会话或从存储重新装配的会话生效，运行中的会话不会自动增删工具。

- 结果按工具卡原样呈现，保留截断提示；Http 的 HTTP 状态不代替工具成败，4xx / 5xx 仍需检查；搜索空结果只说明本次查询没有匹配，不等于网站无法访问。恢复旧历史时只展示真实保留的正文与状态，不补造来源或状态码。
- 专用的搜索 / 网页 / HTTP 结果展示投影（`com.tansr.sdk.view.SearchResultDetails` / `NetworkResultDetails`）自 0.5.0 起随 `:core` 发布：搜索卡保留来源、截断与空结果提示，网页与 HTTP 卡保留原正文并显示实际 HTTP 状态；`toolCardArtifact` 原有用法不变。0.4.0 及更早版本仍按原有工具卡显示结果。
- 能力开关、执行边界与跨主机跳转的审批规则见[移动应用的公网工具](/sdk/platform-bundle/#移动应用的公网工具)。

SDK 2.0 在服务端已随 `@tansr/serve` 0.13.0 / 0.14.0 发布（`@tansr/serve/extensions` 显式宿主与 `/api` 统一调用面）；Android 侧自 0.5.0 起随包提供端侧薄客户端：`:core` 的 `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`、档案同步 `Sdk2ArchiveSyncClient` / `Sdk2ReplicatedArchiveStore`、终端服务客户端 `TerminalClient`，以及可选模块 `:receiver-android` 的 SQLite 档案接收器 / 同步库 / 耐久执行日志。它们是加法能力：不接 SDK 2.0 的 App 不引入 `:receiver-android`，SDK1 会话行为不变。2026-10-10 之后进入主线的加密记忆发布介质、加密增量 SQLite 档位与只读副本等持久化能力**尚未随任何 Maven 版本发布**，本页不描述。装配与边界见 [SDK 2.0 扩展入口](/sdk/sdk2-preview/)。

## 语音：两条链

音频不是协议级模态（不入消息块、不入事件流）。

1. **工具链**：智能体自行调 `SpeechToText` / `TextToSpeech`，产物随 `tool.completed.data` 到端，`toolCardArtifact` 解出 `Transcript` / `Speech`,`TansrToolCard` 缺省渲染。
2. **直连链**（你自己的语音 UX）：

```kotlin
val transcript = client.audio.transcribe(session.sessionId, bytes, mime = "audio/mp4") // 转写填框,是否发送归 App
val speech = client.audio.speak(session.sessionId, assistantText)                       // url ?: b64;URL 约 24 h 有效
```

走 `POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`（经同一 `call()` 过统一响应头门），服务端代打平台语音面，受能力位 `platform.speechToText` / `textToSpeech` 与配额同闸；失败抛 `TansrAgentException.Unified`：统一码在 `code`（如 `capability_unavailable` / `invalid_request` / `payload_too_large` / `upstream_unavailable`），平台音频面的原码在 `domainCode`（`capability_disabled` / `asr_not_configured` / `tts_quota_exceeded` …；门面词表未登记的上游业务码按合同兜底为 `internal_error`，原码与原状态保留在 `domainCode` / `domainStatus`）。`@tansr/serve` 0.9.0 起平台上游 401 / 403 / 5xx 与网络故障归一为 `upstream_unavailable`（503）携 `Retry-After`。`:compose` 零播放器零权限：录音 / 播放归宿主，sample 的 `AudioRecorderController` / `AudioPlayerController` 是参考实现；录音需 `RECORD_AUDIO` 运行时权限。

## 推送唤醒：自接

SDK 恒不内置任何推送 SDK。服务端在轮终态且无活跃订阅者时向你的 webhook POST 最小载荷 `{ sessionId, endUserId, turnId?, status, reason?, lastSeq, ts }`（恒无消息内容、恒无凭据），详见[v2 协议与 webhook](/serve/v2-and-webhooks/)。你这半场：收 webhook → 验签 → `endUserId` 映射到设备推送令牌 → 发一条只携 `sessionId` 的 FCM **data** 消息（或厂商通道）→ `onMessageReceived` 弹本地通知 → 点击后经既有三级链恢复（热态自动 L1 / L2；冷启 `CreateSessionRequest(resumeSessionId = sessionId)` 即 L3）。全程不涉及新 SDK API。

## 凭据与日志纪律

- 设备凭证 = 你的登录态，SDK 只经 `authProvider` 按次取用，**恒不持久化**（不写 SharedPreferences / DataStore / 文件 / 日志），不缓存超出单请求生命周期。
- appkey 在 SDK / 示例代码面恒无此概念；`app_user` 令牌恒不下发设备。本页所述的 `@tansr/serve` 嵌入形里，`/api` 会话面的终端用户身份只来自你的 `authenticate` 缝；`tansr serve --v2` 单运维方形以同一 Bearer 加 `x-tansr-end-user` 分域头工作，不在本页范围。
- SDK debug 日志不打印 auth 头、令牌、应答全文、工具 args 全量，只打形状摘要；崩溃上报拿不到凭证。
- 工具应答与工具申报都是不受信输入：服务端形状校验强制，语义面靠能力档收窄 + 权限桥 + 事件流归因。设备可被逆向改造，不要因「自家 App」降低警惕。

## 联调

`:sample`（订单助手）缺省连仓内 `examples/serve-demo`：serve-demo 以 `DEMO_SERVE_ONLY=1`、`DEMO_PORT=8788` 常驻起服（源码缺省端口 8799；`pnpm start` / `pnpm real` 都是真实模型入口，已无公开的 echo 启动命令），sample 默认连 `http://127.0.0.1:8788`，先 `adb reverse tcp:8788 tcp:8788` 把设备端口转发到开发机（模拟器也可显式改用 `http://10.0.2.2:8788`，但这不是 sample 默认地址）；`authProvider` 按 demo 的票据形制本地直签，改用独立开发者登录服务（`pnpm login`，缺省 `127.0.0.1:8787`）时同样转发 8787。改端口免重编：`adb reverse tcp:8789 tcp:8789` 后 `adb shell am start -n com.tansr.sdk.sample/.OrderAssistantActivity -e baseUrl http://127.0.0.1:8789`。真机以 `DEMO_HOST=0.0.0.0` 起服并指开发机局域网 IP（明文 http 需 network security config 放行；非回环监听须自设不少于 32 字符的 `DEMO_AUTH_SECRET`）。门禁：`./gradlew build`（assemble + 单测 + ktlint + apiCheck）。
