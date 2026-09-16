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
  - security
sources:
  - tansr-android:README.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-15'
---

Android SDK（Maven 坐标 `com.tansr.sdk:core` / `:client` / `:compose`，包名前缀 `com.tansr.sdk`）是会话服务 `/v2` 协议的薄客户端。这一篇讲快速开始之后你会遇到的全部设计点：事件怎么变成 UI 状态、断线怎么恢复、前后台怎么处理、错误怎么呈现、工具与对话框怎么接、语音与推送怎么接。

## 手机端发送用户消息，服务端配置系统提示词

`CreateSessionRequest(prompt=...)` 与 `session.send(...)` 都发送普通用户消息；Android / iOS 不经 `/v2` 传入 `system`。共享角色由平台应用配置管理，代码定制角色由 serve 的 `platform.system` 提供，宿主说明用 `platform.systemAppend`。

提示词与策略功能自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线；默认 `fallback` 下 SDK 显式 `system`（包括空数组）替代平台段，`prepend` 下保留平台段在前。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；前后台重连、SSE 恢复和 attach 可以保留原会话与历史，无需重开来取得更新。请由应用管理员消除业务段冲突，权限仍走独立机制。详见[应用系统提示词](/sdk/system-prompts/)。

## 模块切层

| 模块 | 类型 | 内容 |
|---|---|---|
| `:core` | 纯 Kotlin/JVM，零 Android 依赖 | 契约常量、`KernelEvent` 密封类系（47 型 + `Unknown` 容忍）、IR 消息模型、SSE 解析 / 分派、`SessionView` reducer 与 `viewStateFromHistory`、工具卡产物解析 `toolCardArtifact`、协议客户端逻辑与传输抽象、音频直连面 `AudioClient`、重连状态机、`defineTool` 与远程工具桥、权限 / 提问桥 `SessionBridges`、`BridgeDialogState` |
| `:client` | 纯 Kotlin/JVM | OkHttp 传输实现、`TansrAgent` 入口工厂 |
| `:compose` | Android 库 | Compose 绑定薄层：`collect*AsStateWithLifecycle`、`TansrSessionLifecycle`、缺省权限 / 提问对话框、`TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`；皆可替换，不绑主题，零播放器零权限 |

`:core` / `:client` 刻意做成纯 JVM，协议面无需设备即可单测。公开 API 面受 binary-compatibility-validator 守护，变更恒显式过 diff。

## 事件归约：三个流

```kotlin
session.events          // SharedFlow<KernelEvent>(replay = 0;历史语义归 view 与恢复链)
session.view            // StateFlow<SessionViewState>(reducer 投影,conflated)
session.connectionState // StateFlow<ConnectionState>
```

- `events` 是原始内核事件，与服务端 SSE 一帧一条；未知类型解码为 `Unknown(type, raw)` 恒不抛，坏 JSON 只计数上报诊断位、不断流。契约 revision 7 登记 55 型事件，SDK 解码其中 47 型；新增的 SDK 专属事件 `session.events_dropped`（contract-v0.27，Node SDK 进程内背压兜底）serve 恒不发出、`/v2` 流恒无，即便出现也按 `Unknown` 容忍，端侧零渲染义务。
- `view` 是**已归约的视图状态**：消息列表（用户 / 助手 / 工具卡）、待办、用量、`lastError`、`notices`。多数 UI 直接订阅它，不要自己拼 `msg.text.delta`。reducer 与 TS / Swift 实现共用同一份金样夹具，三端投影语义一致。
- 呈现档 `SessionViewOptions(delivery = …)`：文本与思考各自选 `stream` / `final`（思考另有 `off`），运行中 `setDelivery` 块粒度切换。

工具卡产物用 `toolCardArtifact(data)` 按形状解出：图像 / 视频 / 联网搜索的 URL 产物，语音的 `Transcript(model, text, language?, durationSec?)` / `Speech(model, url?, b64?, mime, format, durationMs?, billedChars)`;`errorCode` 在场恒判空。`TansrToolCard` 缺省渲染这些形；`messageActions` / `speechAction` 两槽位供你挂「播放 / 停止」按钮。

## 连接状态机与三级恢复链

```text
Idle → Connecting → Live
Live → Retrying(指数退避,尊重服务端 retry 首帧)→ Live          // L1:携 Last-Event-ID 重连,重放按 seq 去重
Live → Recovering(拉 /history 重建)→ Live                        // L2:重连首帧收到 gap
401 → AuthExpired(回调 authProvider 重取)→ 刷够仍 401 → Failed(Unauthorized)
```

| 级 | 触发 | SDK 做什么 |
|---|---|---|
| L1 | 闪断 / 网络切换 / 回前台 | 自动重连携 `Last-Event-ID=<最后消费 seq>`，收帧按 seq 去重 |
| L2 | 重连首帧收到 `server.replay.gap` | 弃当前投影 → `GET /v2/sessions/:id` → `GET …/history` → `viewStateFromHistory` 重建 → 自 `lastSeq` 续订 |
| L3 | 元信息 404 或 `live = false`，或冷启动只持 sessionId | `POST /v2/sessions { resume }` → `resumed = true, lastSeq = <新纪元起点水位>` → 弃旧游标按 L2 重建（锚取 `history.lastSeq`，不读该响应值） |

全程业务零码。冷启动接着上次聊：`CreateSessionRequest(resumeSessionId = savedId)`——SDK 缺省 **attach-first**：先 GET 元信息探针，活跃则 attach（零上游成本），不活跃才 resume 重灌，store 无档才新建。会话终结（`Closed`）后不会自动复活。

**`lastSeq` 恒按值续传，休眠判据恒 `live = false`**——恒不是 `lastSeq == 0`。`@tansr/serve` 0.9.0 起，休眠会话的元信息 `lastSeq` 是 store 落盘的真值水位、resume 后的新纪元自该水位 + 1 续起（0.8.x 两处恒 `0`）；SDK 的 L3 本就弃旧游标、以 `history.lastSeq` 为锚，两版行为无需端上适配。`live = true` 且 `lastSeq == 0` 只走 L2、恒不 resume。

**401 收敛条**：事件流 401 → 经 `authProvider` 重取令牌再连，**每连接至多 2 次**（第 1 次退避 0 ms、第 2 次 1000 ms；`AgentSessionConfig.authRetry` 可配但恒有限）；仍 401 即 `connectionState = Failed(Unauthorized)` + `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`，泵停、恒不再自动重连，须宿主修好登录态后显式 `start()`。令牌刷了再 401 就是吊销或配置错，不是抖动。

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
| HTTP 面 | `TansrAgentException(code, message)` 密封（网络 / 鉴权 / 会话不存在 / 越权 …）；词表外码落 `Api` 兜底、`code` 原样 | 按 `code` 分支；未知码按状态码退避 |

429 / 503 携 `Retry-After` 时按整秒值等待；`session_limit_exceeded`（每用户缺省 8 个活跃会话）提示用户关闭不用的会话。错误消息文案恒英文，宿主按 `code` 自行本地化。

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

## 语音：两条链

音频不是协议级模态（不入消息块、不入事件流）。

1. **工具链**：智能体自行调 `SpeechToText` / `TextToSpeech`，产物随 `tool.completed.data` 到端，`toolCardArtifact` 解出 `Transcript` / `Speech`,`TansrToolCard` 缺省渲染。
2. **直连链**（你自己的语音 UX）：

```kotlin
val transcript = client.audio.transcribe(session.sessionId, bytes, mime = "audio/mp4") // 转写填框,是否发送归 App
val speech = client.audio.speak(session.sessionId, assistantText)                       // url ?: b64;URL 约 24 h 有效
```

走 `POST /v2/sessions/:id/audio/transcriptions` / `…/audio/speech`，服务端代打平台语音面，受能力位 `platform.speechToText` / `textToSpeech` 与配额同闸；失败抛 `TansrAgentException` 携服务端 `code`（`capability_disabled` / `asr_not_configured` / `tts_quota_exceeded` / `bad_request` / `upstream_error` 等；`@tansr/serve` 0.9.0 起平台上游 401 / 403 / 5xx 与网络故障归一为 `503 upstream_unavailable` 携 `Retry-After`，业务 4xx 仍原码透传）。`:compose` 零播放器零权限：录音 / 播放归宿主，sample 的 `AudioRecorderController` / `AudioPlayerController` 是参考实现；录音需 `RECORD_AUDIO` 运行时权限。

## 推送唤醒：自接

SDK 恒不内置任何推送 SDK。服务端在轮终态且无活跃订阅者时向你的 webhook POST 最小载荷 `{ sessionId, endUserId, turnId?, status, reason?, lastSeq, ts }`（恒无消息内容、恒无凭据），详见[v2 协议与 webhook](/serve/v2-and-webhooks/)。你这半场：收 webhook → 验签 → `endUserId` 映射到设备推送令牌 → 发一条只携 `sessionId` 的 FCM **data** 消息（或厂商通道）→ `onMessageReceived` 弹本地通知 → 点击后经既有三级链恢复（热态自动 L1 / L2；冷启 `CreateSessionRequest(resumeSessionId = sessionId)` 即 L3）。全程不涉及新 SDK API。

## 凭据与日志纪律

- 设备凭证 = 你的登录态，SDK 只经 `authProvider` 按次取用，**恒不持久化**（不写 SharedPreferences / DataStore / 文件 / 日志），不缓存超出单请求生命周期。
- appkey 在 SDK / 示例代码面恒无此概念；`app_user` 令牌恒不下发设备；会话服务 `/v1` 的 Bearer 恒不受理于 `/v2`。
- SDK debug 日志不打印 auth 头、令牌、应答全文、工具 args 全量，只打形状摘要；崩溃上报拿不到凭证。
- 工具应答与工具申报都是不受信输入：服务端形状校验强制，语义面靠能力档收窄 + 权限桥 + 事件流归因。设备可被逆向改造，不要因「自家 App」降低警惕。

## 联调

`:sample`（订单助手）缺省连仓内 `examples/serve-demo`（`http://10.0.2.2:8788`,`authProvider` 按 demo 的 token 形制本地直签）；改端口免重编：`adb shell am start -n com.tansr.sdk.sample/.OrderAssistantActivity -e baseUrl http://10.0.2.2:8789`。真机以 `DEMO_HOST=0.0.0.0` 起服并指开发机局域网 IP（明文 http 需 network security config 放行）。门禁：`./gradlew build`（assemble + 单测 + ktlint + apiCheck）。
