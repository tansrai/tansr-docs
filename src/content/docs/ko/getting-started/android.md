---
title: 'Android와 iOS 5분 안에 실행하기'
description: 'Android 앱에 tansr Kotlin SDK를 연결합니다. Maven 의존성을 추가하고, 자신의 로그인 자격 증명을 제공하고, 첫 세션을 열어 이벤트 스트림을 Compose에 공급합니다. 마지막 절에서 iOS Swift 패키지의 같은 연결 방법을 보여 줍니다.'
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
lastVerified: '2026-09-10'
---

Android와 iOS SDK는 모두 tansr 세션 서비스(`/v2` 프로토콜)의 **얇은 프로토콜 클라이언트**입니다. 입력을 보내고, 이벤트 스트림을 렌더링하고, 당신이 명시적으로 등록한 로컬 도구를 실행하고, 권한과 질문 대화 상자에 응답합니다. 에이전트 커널, 권한 엔진, 컨텍스트 거버넌스는 모두 당신이 배포한 `@tansr/serve` 서버 쪽에서 실행되며, 휴대폰에는 플랫폼 자격 증명이 전혀 없습니다. 두 플랫폼은 같은 계약과 같은 뷰 리덕션 골든 샘플을 공유합니다. 이 문서는 Android를 중심으로 설명하고, 마지막 절에서 iOS의 대응하는 작성법을 제시합니다.

## 휴대폰은 사용자 메시지를 보내고, 서버는 시스템 프롬프트를 설정

`CreateSessionRequest(prompt=...)`와 `session.send(...)`는 모두 일반 사용자 메시지를 보냅니다. Android / iOS는 `/v2`를 통해 `system`을 전달하지 않습니다. 공유 역할은 플랫폼 앱 설정이 관리하고, 코드로 맞춤 설정하는 역할은 serve의 `platform.system`이 제공하며, 호스트 설명은 `platform.systemAppend`를 사용합니다.

프롬프트와 정책의 새 기능은 API / serve 호환 릴리스를 기다리고 있습니다. 기본값 `fallback`에서는 SDK의 명시적인 `system`(빈 배열 포함)이 플랫폼 세그먼트를 대체하고, `prepend`에서는 플랫폼 세그먼트를 앞에 유지합니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 새로 고쳐지고, 현재 실행 중인 턴은 고정됩니다. 포그라운드 / 백그라운드 재연결, SSE 복구, attach는 기존 세션과 기록을 유지할 수 있으며, 업데이트를 받기 위해 다시 열 필요가 없습니다. 업무 세그먼트 충돌은 앱 관리자가 해소해 주세요. 권한은 여전히 독립된 메커니즘을 따릅니다. 자세한 내용은 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참고하세요.

## 전제 조건

- 도달 가능한 `@tansr/serve` 서비스([세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/) 참고). 로컬 개발에서는 먼저 저장소 안의 예제 `examples/serve-demo`를 띄워도 됩니다. 기본으로 `127.0.0.1:8788`에서 수신합니다. Android 에뮬레이터는 `10.0.2.2:8788`로 호스트 머신에 접근하고, iOS 시뮬레이터는 `127.0.0.1`을 그대로 사용합니다.
- Android: minSdk 26. Kotlin 코루틴, kotlinx.serialization, OkHttp. iOS: iOS 16+ / macOS 13+, Xcode 15+.
- 당신의 로그인 체계: SDK는 요청마다 헤더(보통 `Authorization: Bearer <당신의 로그인 token>`)를 제공받아야 하며, 서버 쪽 `authenticate` 훅이 이를 바탕으로 `endUserId`를 풀어냅니다.

## 설치

Maven Central 좌표. 세 가지 중 필요한 것을 선택합니다.

| 좌표 | 내용 |
|---|---|
| `com.tansr.sdk:core` | 순수 Kotlin/JVM: 프로토콜 모델, 이벤트 sealed class(47종 + `Unknown` 허용), `SessionView` reducer, 재연결 상태 기계, `defineTool`과 두 브리지 |
| `com.tansr.sdk:client` | OkHttp 전송 구현, `TansrAgent` 진입 팩토리 |
| `com.tansr.sdk:compose` | Compose 바인딩 얇은 층: 라이프사이클 시작 / 정지, 기본 권한 / 질문 대화 상자, `TansrMessageList` / `TansrToolCard` 등 컴포넌트 |

```kotlin
dependencies {
    implementation("com.tansr.sdk:client:0.1.0")
    implementation("com.tansr.sdk:compose:0.1.0")
}
```

## 자격 증명: 당신의 로그인 상태만

SDK는 **어떤 자격 증명도 영구 저장하지 않습니다.** 요청마다 `authProvider` 콜백으로 헤더를 한 번 가져와 즉시 쓰고 버립니다. SharedPreferences에 쓰지 않고, 파일에 쓰지 않고, 로그에 남기지 않습니다. 당신이 주는 것은 당신 제품의 로그인 token이며, tansr의 어떤 키도 아닙니다. appkey는 서버 쪽에만 있고, `app_user` 토큰도 서버 쪽을 벗어나지 않습니다.

```kotlin
val client = TansrAgent.client(
    baseUrl = "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider = { mapOf("Authorization" to "Bearer ${mySession.jwt()}") },
)
```

## 첫 세션

```kotlin
val session = client.openSession(scope, CreateSessionRequest(prompt = "hi"))
session.start()
session.view            // StateFlow<SessionViewState> — 直接喂进 Compose
session.events          // SharedFlow<KernelEvent>
session.connectionState // Idle → Connecting → Live → Retrying/Recovering/AuthExpired…
session.send("next question")
```

Compose 호스트는 한 줄로 라이프사이클에 연결합니다. 백그라운드로 가면 펌프를 멈추고 스트림을 끊으며, 포그라운드로 돌아오면 복구 창에 따라 경로를 골라 자동으로 이어서 전송합니다.

```kotlin
TansrSessionLifecycle(session) // 在场即不需手工 start()
val view by session.collectViewAsStateWithLifecycle()
val connection by session.collectConnectionStateAsStateWithLifecycle()
```

Compose가 아닌 호스트의 동등한 연결: 포그라운드에서 `session.start()`, 백그라운드에서 `session.stop()`. 둘 다 멱등이며, `stop`은 세션을 잃지 않습니다.

## 이벤트 보기

`session.view`는 이미 리덕션된 뷰 상태(메시지 목록, 도구 카드, 할 일, 사용량, 연결 배너)이므로, 대부분의 UI는 이것을 구독하면 됩니다. 원시 이벤트 스트림을 보고 싶으면 `session.events`를 받으세요.

```kotlin
scope.launch {
    session.events.collect { event ->
        Log.d("tansr", "${event.seq} ${event.type}")
    }
}
```

알 수 없는 이벤트 타입은 `Unknown`으로 디코딩되며 예외를 던지지 않습니다. 연결 끊김은 업무 코드까지 올라오지 않습니다. 이벤트 펌프는 `Last-Event-ID`로 재연결하고(L1), 재전송에 빈틈이 있으면 `/history`에서 재구축하고(L2), 서버 재시작 뒤에는 세션 저장소를 통해 resume합니다(L3). 콜드 스타트에서 지난 대화를 이어가려면 `CreateSessionRequest(resumeSessionId = savedId)`를 전달하세요.

## 로컬 도구와 대화 상자

에이전트가 휴대폰의 업무 함수를 호출하게 하려면 `defineTool`로 등록해 세션과 함께 신고합니다. 권한과 질문 대화 상자는 `BridgeDialogState`로 기본 구현을 얻습니다.

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

등록되지 않은 브리지는 fail-closed입니다. SDK는 응답하지 않고, 서버 쪽은 계약에 따라 폴백합니다(권한은 deny-and-continue, 질문은 구조화된 "스스로 판단").

## 처음 흔히 걸리는 문제

| 현상 | 처리 |
|---|---|
| 연결하자마자 401 | `authProvider`가 반환한 헤더를 서버 쪽 `authenticate`가 인정하지 않습니다. SDK는 `authProvider`로 토큰을 다시 받아 최대 2번 재연결하고, 여전히 401이면 `Failed(Unauthorized)` 종료 상태로 들어갑니다. 로그인 상태를 고친 뒤 명시적으로 `start()`하세요 |
| 에뮬레이터에서 연결이 안 됨 | Android는 `127.0.0.1`이 아니라 `10.0.2.2`를 사용합니다. 실제 기기는 서버가 `0.0.0.0`에서 수신하고 평문 http를 허용해야 합니다(또는 TLS 적용) |
| 새 세션이 429 | 최종 사용자당 기본 최대 8개의 활성 세션. 쓰지 않는 세션은 `close()`하세요. 자리를 비우되 저장소는 유지되어 여전히 resume할 수 있습니다 |

## iOS도 같은 방법

Swift 패키지 `tansr-ios`는 SwiftPM으로 추가합니다(git tag가 곧 버전이며, 현재 `0.1.0`). 세 라이브러리 제품이 Android 세 모듈과 하나씩 대응합니다: `TansrCore`(순수 Swift 프로토콜 층), `TansrClient`(URLSession 전송 + `TansrAgent` 팩토리), `TansrUI`(SwiftUI 바인딩과 기본 컴포넌트). Xcode의 "Add Package Dependencies"에 저장소 주소를 입력하면 됩니다.

클라이언트와 첫 세션:

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

SwiftUI 호스트는 한 줄로 scenePhase에 연결합니다: `ChatScreen(session: session).tansrSessionLifecycle(session)`. 그런 다음 `TansrSessionObserver(session:)`로 `view` / `connectionState`를 재구성에 공급합니다. 로컬 도구는 `try defineTool(name:description:)`으로 선언하고, `BridgeDialogState().bridges(tools:)`로 기본 대화 상자를 얻고, `.tansrBridgeDialogs(...)`로 렌더링합니다.

iOS 특유의 주의점 두 가지: 로컬 통합 테스트에서 평문 http를 쓰려면 앱의 Info.plist에서 허용해야 합니다(demo에서만 `NSAllowsArbitraryLoads`를 쓰고, 프로덕션은 항상 TLS). 마이크를 사용하면(음성 직접 연결 체인) 앱 target에 `NSMicrophoneUsageDescription`을 반드시 선언해야 합니다. SwiftPM 패키지에는 Info.plist 의미론이 없어, 선언이 없으면 마이크에 처음 접근하는 순간 프로세스가 종료됩니다. 나머지 의미론(3단계 복구 체인, 낙관적 기록, 401은 2번으로 수렴 후 종료 상태, `Unknown` 이벤트 허용)은 Android와 완전히 같습니다.

## 다음 단계

- [Android 연동 가이드](/ko/android/)와 [iOS 연동 가이드](/ko/ios/): 이벤트 리덕션, 오류 표시, 오프라인과 포그라운드 / 백그라운드, 음성 두 체인, 푸시 웨이크업.
- [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/): 서버 쪽 후반에서 턴 종료 알림을 당신의 푸시 백엔드에 넘기는 방법.
