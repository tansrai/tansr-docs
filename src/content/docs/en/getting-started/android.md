---
title: Android and iOS in 5 minutes
description: 'Integrate the tansr Kotlin SDK in an Android app: add the Maven dependency, provide your own login credential, open the first session and feed the event stream into Compose; the last section wires the iOS Swift package the same way.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
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
lastVerified: '2026-09-15'
---

The Android and iOS SDKs are both **thin protocol clients** of the tansr session service (`/v2` protocol): they send input, render the event stream, run the local tools you explicitly register, and respond to permission and question dialogs. The agent kernel, permission engine and context governance all run in the `@tansr/serve` you deploy; the phone holds no platform credential at all. Both platforms share one contract and one set of view-reduction golden samples. This article is Android-first, with the iOS equivalents in the last section.

## Send user messages on the phone; configure system prompts on the server

`CreateSessionRequest(prompt=...)` and `session.send(...)` send ordinary user messages. Android / iOS do not submit `system` through `/v2`. Manage the shared role in platform application settings, a code-managed role in serve `platform.system`, and host notes in `platform.systemAppend`.

The prompt and policy features are available since `@tansr/serve` 0.8.0; the platform side has been live since 2026-09-14. Default `fallback` lets explicit SDK `system` (including an empty array) replace the platform segment; `prepend` retains the platform segment first. Platform prompts and policies refresh before a subsequent turn, while an executing turn keeps its configuration. Foreground reconnects, SSE recovery, and live attach preserve the session and history without reopening to get an update. Application managers must resolve conflicting business instructions, and permissions remain separate. See [Application system prompts](/en/sdk/system-prompts/).

## Prerequisites

- A reachable `@tansr/serve` service (see [Session service in 5 minutes](/en/getting-started/serve/)). For local development you can start the in-repo sample `examples/serve-demo`, which listens on `127.0.0.1:8788` by default; the Android emulator reaches the host at `10.0.2.2:8788`, the iOS simulator uses `127.0.0.1` directly.
- Android: minSdk 26; Kotlin coroutines, kotlinx.serialization, OkHttp. iOS: iOS 16+ / macOS 13+, Xcode 15+.
- Your own login system: the SDK asks you for request headers on every call (usually `Authorization: Bearer <your login token>`), and the server's `authenticate` hook resolves them to an `endUserId`.

## Install

Maven Central coordinates, three artifacts, pick what you need:

| Coordinate | Contents |
|---|---|
| `com.tansr.sdk:core` | Pure Kotlin/JVM: protocol models, sealed event classes (47 types + tolerant `Unknown`), the `SessionView` reducer, the reconnect state machine, `defineTool` and the two bridges |
| `com.tansr.sdk:client` | OkHttp transport, the `TansrAgent` entry factory |
| `com.tansr.sdk:compose` | Thin Compose binding: lifecycle start/stop, default permission / question dialogs, components such as `TansrMessageList` / `TansrToolCard` |

```kotlin
dependencies {
    implementation("com.tansr.sdk:client:0.1.0")
    implementation("com.tansr.sdk:compose:0.1.0")
}
```

## Credentials: only your own login state

The SDK **persists no credential**: on every request it calls `authProvider` once, uses the headers and discards them — nothing in SharedPreferences, nothing on disk, nothing in logs. What you provide is your own product's login token, not any tansr key — the appkey stays on the server, and the `app_user` token never leaves the server either.

```kotlin
val client = TansrAgent.client(
    baseUrl = "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider = { mapOf("Authorization" to "Bearer ${mySession.jwt()}") },
)
```

## First session

```kotlin
val session = client.openSession(scope, CreateSessionRequest(prompt = "hi"))
session.start()
session.view            // StateFlow<SessionViewState> — 直接喂进 Compose
session.events          // SharedFlow<KernelEvent>
session.connectionState // Idle → Connecting → Live → Retrying/Recovering/AuthExpired…
session.send("next question")
```

A Compose host wires the lifecycle in one line: going to the background stops the pump and drops the stream; coming back to the foreground automatically picks the recovery path based on the recovery window:

```kotlin
TansrSessionLifecycle(session) // 在场即不需手工 start()
val view by session.collectViewAsStateWithLifecycle()
val connection by session.collectConnectionStateAsStateWithLifecycle()
```

The non-Compose equivalent: `session.start()` in the foreground, `session.stop()` in the background; both are idempotent, and `stop` does not lose the session.

## See the events

`session.view` is already reduced view state (message list, tool cards, todos, usage, connection banner); most UIs just subscribe to it. To see the raw event stream, collect `session.events`:

```kotlin
scope.launch {
    session.events.collect { event ->
        Log.d("tansr", "${event.seq} ${event.type}")
    }
}
```

Unknown event types decode to `Unknown` and never throw; disconnects never surface to your business code — the event pump reconnects with `Last-Event-ID` (L1), rebuilds from `/history` when the replay has a gap (L2), and resumes through the session store after a server restart (L3). To continue the last conversation after a cold start, pass `CreateSessionRequest(resumeSessionId = savedId)`.

## Local tools and dialogs

To let the agent call business functions on the phone, register them with `defineTool` and declare them with the session; get the default permission and question dialogs from `BridgeDialogState`:

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

Unregistered bridges fail closed: the SDK does not respond, and the server degrades per the contract (permissions become deny-and-continue, questions become a structured "decide on your own").

## Common first hurdles

| Symptom | Fix |
|---|---|
| 401 as soon as it connects | The headers from `authProvider` are not accepted by the server's `authenticate`. The SDK re-fetches the token through `authProvider` and reconnects up to 2 times; if it is still 401 it enters the terminal `Failed(Unauthorized)` state — fix the login state, then call `start()` explicitly |
| The emulator cannot connect | Android must use `10.0.2.2`, not `127.0.0.1`; a real device needs the server to listen on `0.0.0.0` and cleartext http to be allowed (or use TLS) |
| 429 on a new session | Each end user has at most 8 active sessions by default; `close()` sessions you no longer need — that frees the slot but keeps the storage, so they can still be resumed |

## Same on iOS

The Swift package `tansr-ios` is added through SwiftPM (the git tag is the version, currently `0.1.0`). Its three library products map one-to-one to the three Android modules: `TansrCore` (pure Swift protocol layer), `TansrClient` (URLSession transport + the `TansrAgent` factory), `TansrUI` (SwiftUI bindings and default components). In Xcode, "Add Package Dependencies" and enter the repository URL.

Client and first session:

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

A SwiftUI host wires scenePhase in one line — `ChatScreen(session: session).tansrSessionLifecycle(session)` — then uses `TansrSessionObserver(session:)` to feed `view` / `connectionState` into re-rendering. Declare local tools with `try defineTool(name:description:)`, get the default dialogs from `BridgeDialogState().bridges(tools:)`, and render them with `.tansrBridgeDialogs(...)`.

Two iOS-specific notes: cleartext http for local debugging must be allowed in the app's Info.plist (`NSAllowsArbitraryLoads` for the demo only; always use TLS in production); and if you use the microphone (the direct voice link) the app target must declare `NSMicrophoneUsageDescription` — a SwiftPM package has no Info.plist semantics, and without the declaration the process is terminated on first microphone access. Everything else (the three-level recovery chain, optimistic posting, 401 converging after 2 attempts to a terminal state, tolerant `Unknown` events) is identical to Android.

## Next steps

- [Android integration guide](/en/android/) and [iOS integration guide](/en/ios/): event reduction, error presentation, offline and foreground/background, the two voice links, push wake-up.
- [v2 protocol and webhooks](/en/serve/v2-and-webhooks/): how the server side hands end-of-turn notifications to your push backend.
