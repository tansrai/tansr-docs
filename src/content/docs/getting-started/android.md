---
title: Android 与 iOS 5 分钟跑通
description: 在 Android App 里接入 tansr Kotlin SDK——加 Maven 依赖、提供你自己的登录凭据、打开第一个会话并把事件流喂进 Compose；末节给出 iOS Swift 包的同法接线。
zone: docs
category: getting-started
related:
  - android
  - ios
  - getting-started/serve
  - serve/v2-and-webhooks
sources:
  - tansr-android:README.md
  - tansr-ios:README.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-08'
---

Android 与 iOS SDK 都是 tansr 会话服务（`/v2` 协议）的**薄协议客户端**：发送输入、渲染事件流、执行你显式注册的本地工具、应答权限与提问对话框。智能体内核、权限引擎、上下文治理全部跑在你部署的 `@tansr/serve` 服务端；手机上没有任何平台凭据。两端同一套契约、同一份视图归约金样，本文以 Android 为主，末节给 iOS 的对应写法。

## 前提

- 一个可达的 `@tansr/serve` 服务（见[会话服务 5 分钟跑通]（/getting-started/serve/））。本地开发可以先起仓内示例 `examples/serve-demo`，它缺省监听 `127.0.0.1:8788`;Android 模拟器经 `10.0.2.2:8788` 访问宿主机，iOS 模拟器直接用 `127.0.0.1`。
- Android:minSdk 26；Kotlin 协程、kotlinx.serialization、OkHttp。iOS:iOS 16+ / macOS 13+，Xcode 15+。
- 你自己的登录体系：SDK 需要你按次提供请求头（通常是 `Authorization: Bearer <你的登录 token>`），服务端的 `authenticate` 缝据此解出 `endUserId`。

## 安装

Maven Central 坐标，三件按需选：

| 坐标 | 内容 |
|---|---|
| `com.tansr.sdk:core` | 纯 Kotlin/JVM：协议模型、事件密封类（47 型 + `Unknown` 容忍）、`SessionView` reducer、重连状态机、`defineTool` 与双桥 |
| `com.tansr.sdk:client` | OkHttp 传输实现、`TansrAgent` 入口工厂 |
| `com.tansr.sdk:compose` | Compose 绑定薄层：生命周期收放、缺省权限 / 提问对话框、`TansrMessageList` / `TansrToolCard` 等组件 |

```kotlin
dependencies {
    implementation("com.tansr.sdk:client:0.1.0")
    implementation("com.tansr.sdk:compose:0.1.0")
}
```

## 凭据：只有你自己的登录态

SDK **不持久化任何凭据**：每次请求经 `authProvider` 回调取一次头即用即弃，不写 SharedPreferences、不写文件、不进日志。你给的是你自己产品的登录 token，不是 tansr 的任何密钥——appkey 只在服务端，`app_user` 令牌也不出服务端。

```kotlin
val client = TansrAgent.client(
    baseUrl = "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider = { mapOf("Authorization" to "Bearer ${mySession.jwt()}") },
)
```

## 第一个会话

```kotlin
val session = client.openSession(scope, CreateSessionRequest(prompt = "hi"))
session.start()
session.view            // StateFlow<SessionViewState> — 直接喂进 Compose
session.events          // SharedFlow<KernelEvent>
session.connectionState // Idle → Connecting → Live → Retrying/Recovering/AuthExpired…
session.send("next question")
```

Compose 宿主一行接上生命周期，回后台停泵断流、回前台自动按恢复窗选径续传：

```kotlin
TansrSessionLifecycle(session) // 在场即不需手工 start()
val view by session.collectViewAsStateWithLifecycle()
val connection by session.collectConnectionStateAsStateWithLifecycle()
```

非 Compose 宿主等价接线：前台 `session.start()`、后台 `session.stop()`，二者幂等，`stop` 不丢会话。

## 看到事件

`session.view` 已经是归约好的视图状态（消息列表、工具卡、待办、用量、连接横幅），多数 UI 直接订阅它即可。想看原始事件流就收 `session.events`:

```kotlin
scope.launch {
    session.events.collect { event ->
        Log.d("tansr", "${event.seq} ${event.type}")
    }
}
```

未知事件类型解码为 `Unknown`，不会抛；断线不会浮到业务代码——事件泵以 `Last-Event-ID` 重连（L1），重放有缺口时从 `/history` 重建（L2），服务端重启后经会话存储 resume（L3）。冷启动想接着上次聊，传 `CreateSessionRequest(resumeSessionId = savedId)`。

## 本地工具与对话框

想让智能体调用手机上的业务函数，用 `defineTool` 注册并随会话申报；权限与提问对话框用 `BridgeDialogState` 拿缺省实现：

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) } // 挂起函数;返回值宽容归一
}

val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(),
    bridges = dialogs.bridges(tools = listOf(searchOrders)))
// Compose: TansrBridgeDialogs(dialogs) 渲染缺省权限/提问对话框
```

未注册的桥 fail-closed:SDK 不应答，服务端按契约降级（权限走 deny-and-continue，提问走结构化「自行裁决」）。

## 常见第一坎

| 现象 | 处置 |
|---|---|
| 一连就 401 | `authProvider` 返回的头不被服务端 `authenticate` 认可。SDK 会经 `authProvider` 重取令牌重连至多 2 次，仍 401 即进入 `Failed(Unauthorized)` 终态，修好登录态后显式 `start()` |
| 模拟器连不上 | Android 用 `10.0.2.2` 而不是 `127.0.0.1`；真机要服务端监听 `0.0.0.0` 并放行明文 http（或上 TLS） |
| 新会话 429 | 每个终端用户缺省最多 8 个活跃会话；不用的会话请 `close()`，它释放名额但保留存储，仍可 resume |

## iOS 同法

Swift 包 `tansr-ios` 经 SwiftPM 添加（git tag 即版本，当前 `0.1.0`），三个库产品与 Android 三模块一一对应：`TansrCore`（纯 Swift 协议层）、`TansrClient`（URLSession 传输 + `TansrAgent` 工厂）、`TansrUI`（SwiftUI 绑定与缺省组件）。在 Xcode「Add Package Dependencies」里填仓库地址即可。

客户端与第一个会话：

```swift
import TansrCore
import TansrClient

let client = TansrAgent.client(
    baseUrl: "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider: { ["Authorization": "Bearer \(await mySession.jwt())"] }
)

let session = try await client.openSession(CreateSessionRequest(prompt: "hi"))
session.start()
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState> — 直接喂进 SwiftUI
session.events()                // AsyncStream<KernelEvent>
try await session.send("next question")
```

SwiftUI 宿主一行接 scenePhase：`ChatScreen(session: session).tansrSessionLifecycle(session)`，再用 `TansrSessionObserver(session:)` 把 `view` / `connectionState` 喂进重组。本地工具用 `try defineTool(name:description:)` 声明，`BridgeDialogState().bridges(tools:)` 拿缺省对话框，`.tansrBridgeDialogs(...)` 渲染。

iOS 特有的两处注意：本地联调明文 http 需在 App 的 Info.plist 放行（仅 demo 用 `NSAllowsArbitraryLoads`，生产恒上 TLS）；用到麦克风（语音直连链）必须在 App target 声明 `NSMicrophoneUsageDescription`——SwiftPM 包没有 Info.plist 语义，缺声明首次访问麦克风即终止进程。其余语义（三级恢复链、乐观落帐、401 收敛 2 次即终态、`Unknown` 事件容忍）与 Android 完全一致。

## 下一步

- [Android 接入指南]（/android/）与[iOS 接入指南]（/ios/）：事件归约、错误呈现、离线与前后台、语音两条链、推送唤醒。
- [v2 协议与 webhook]（/serve/v2-and-webhooks/）：服务端半场怎么把轮末通知交给你的推送后端。
