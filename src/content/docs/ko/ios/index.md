---
title: 'iOS 연동 가이드'
description: 'Swift 패키지의 세 모듈 분할, 뷰 스트림과 이벤트 환원, 연결 상태 머신과 3단계 복구 체인, scenePhase 포그라운드/백그라운드 정책, 낙관적 기록, 오류 표시, 로컬 도구와 두 개의 브리지, 두 갈래 음성 체인, 직접 연결하는 푸시 깨우기, 그리고 Windows에서 순수 Swift 로직 층을 빌드할 때의 유의 사항.'
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

iOS SDK는 Android SDK의 Swift 거울이며 세 클라이언트는 같은 규율을 따릅니다. 같은 세션 계약 상수표(revision 9), 같은 `/api` 계약 생성물(manifest revision 7), 같은 뷰 환원 골든 픽스처, 같은 프레임 순서 픽스처. 이 페이지는 양쪽 플랫폼 팀이 대조하기 쉽도록 Android 가이드와 같은 순서로 전개하며, 차이점(SwiftUI 배선, 낙관적 기록, Info.plist 선언, Windows 빌드)은 따로 표시합니다. 이 페이지는 공개 바이너리 패키지 `tansr-ios-spm` **0.4.0**(GitHub Release, 2026-10-09)에 맞춰 확인했고, 서버 쪽은 `@tansr/serve` 0.15.1(npm latest, 2026-10-10)에 맞췄습니다.

## 버전과 서버 접두사(2026-10-13 확인)

- 공개 바이너리 패키지 0.4.0(2026-10-09 배포, 소스 `f3f31a6`)부터 SDK의 모든 HTTP 요청은 서버가 0.13.0부터 제공하는 통합 호출면 `/api`만 거칩니다(D10: 즉시 전환, 소스 안에 `/v2`, `/v3/sdk2`, `/v3/terminal` 경로 리터럴이 더 이상 없음). 경로, 메서드, 헤더 이름은 manifest revision 7에서 생성된 `ApiContract` / `ApiOps`(81개 작업)에서 나오며, 세션 패밀리는 요청 헤더 `tansr-session-family: sdk1 | sdk2-offload-v1`로 명시적으로 전달합니다. 서버에는 `/api` 파사드가 조립되어 있어야 하며(`@tansr/serve` 0.13.0 이상, r7은 0.14.0 이상), 응답 헤더 revision이 로컬 r7과 다르면 `TansrAgentClient.onManifestRevisionDrift` / `AudioClient.onManifestRevisionDrift`가 클라이언트마다 한 번 발화합니다.
- 0.4.0과 함께 배포된 것: 통합 오류 코드를 주축으로 삼는 오류 모델(D19: `TansrAgentError.kind == .unified` / `.contractUnavailable`, SDK 2.0과 터미널 서비스 면의 `ApiFacadeError`), SDK1 성공 응답과 이벤트 스트림에 대한 통합 응답 헤더 게이트(D38), 요청 헤더 `Idempotency-Key` / `If-Match` / `deadline` 세 개를 나르는 `ApiCallOptions`, 그리고 SDK 2.0 단말 측 인터페이스. 이 페이지는 이 동작들에 맞춰 서술합니다.
- 더 오래된 0.3.0은 여전히 `/v2`에 직접 연결합니다. 서버의 `/v2`는 0.13.0부터 내부 어댑터 입구에 불과하며 1.0.0에서 외부 입구가 제거됩니다. 0.3.0에 머물러 있는 앱은 0.4.0으로 업그레이드하십시오. 일정은 [배포와 인증](/ko/serve/deploy-and-auth/)을 참조하십시오.

## 휴대폰은 사용자 메시지를 보내고, 서버가 시스템 프롬프트를 설정한다

`CreateSessionRequest(prompt=...)`와 `session.send(...)`는 모두 일반 사용자 메시지를 보냅니다. Android / iOS는 `/api` 세션 요청으로 `system`을 전달하지 않습니다. 공유 역할은 플랫폼 앱 설정에서 관리하고, 코드로 맞춤화하는 역할은 serve의 `platform.system`이 제공하며, 호스트 설명은 `platform.systemAppend`를 사용합니다.

프롬프트와 정책 기능은 `@tansr/serve` 0.8.0부터 사용할 수 있으며 플랫폼 쪽은 2026-09-14에 프로덕션에 배포되었습니다. 기본 `fallback`에서는 SDK가 명시한 `system`(빈 배열 포함)이 플랫폼 세그먼트를 대체하고, `prepend`에서는 플랫폼 세그먼트를 앞에 유지합니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 갱신되며 실행 중인 턴은 고정됩니다. 포그라운드/백그라운드 재연결, SSE 복구, attach는 원래 세션과 기록을 유지할 수 있으므로 갱신을 받기 위해 세션을 다시 만들 필요가 없습니다. 업무 세그먼트 충돌은 앱 관리자가 해결하십시오. 권한은 계속 독립된 메커니즘으로 처리됩니다. 자세한 내용은 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참조하십시오.

## 모듈 분할

| 모듈 | 종류 | 내용 |
|---|---|---|
| `TansrCore` | 순수 Swift, 어떤 플랫폼에서도 테스트 가능 | 계약 상수와 `/api` 계약 생성물(`ApiContract` / `ApiOps` 81개 작업, `UnifiedContract`), 응답 헤더 게이트 `ApiContractGate`, `ApiCallOptions`, `KernelEvent` 타입 계열(47개 타입 + `Unknown` 허용), IR 메시지 모델, SSE 파싱/분배, `SessionView` reducer와 `viewStateFromHistory`, `toolCardArtifact`와 `SearchResultDetails` / `NetworkResultDetails`, 프로토콜 클라이언트 로직과 전송 추상화, 음성 직결면 `AudioClient`, 재연결 상태 머신(L1 / L2 / L3), `defineTool`과 원격 도구 브리지, 권한/질문 브리지 `SessionBridges`(기본 fail-closed), `BridgeDialogState`. SDK 2.0 얇은 클라이언트 `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSync`와 터미널 서비스 클라이언트 `TerminalClient` |
| `TansrClient` | 순수 Swift | URLSession 전송(SSE는 delegate 브리지를 거치며 Darwin과 FoundationNetworking에서 같은 경로), `TansrAgent` 진입 팩토리. SDK 2.0의 SQLite 아카이브 수신기/동기화 저장소/실행 저널(`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteArchiveSyncStore` / `Sdk2SqliteExecutionJournal`) |
| `TansrUI` | SwiftUI(`#if canImport(SwiftUI)`, Apple 외 플랫폼에서는 빈 컴파일) | `TansrSessionObserver`, `tansrSessionLifecycle`, 기본 권한/질문 대화 상자 `tansrBridgeDialogs`, `TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`. 모두 교체 가능하고 테마에 묶이지 않으며 AVFoundation 의존성 없음 |

배포 채널은 SwiftPM: 공개 바이너리 패키지 `tansrai/tansr-ios-spm`(현재 0.4.0, 2026-10-09 배포, 원격 XCFramework로 SDK 구현 소스는 포함하지 않으며 모듈 이름은 `TansrCore` / `TansrClient` / `TansrUI` 유지, Xcode 26.6 / Swift 6.3.3으로 Swift 5 언어 모드에서 빌드). 최소 iOS 16+ / macOS 13+이며 iOS 실기기 arm64, 시뮬레이터 arm64 / x86_64, macOS arm64 / x86_64를 포함합니다. 소스 저장소 `tansr-ios`의 SPM 태그(0.2.0)는 비공개 저장소에 게시되어 저장소 접근 권한이 필요하며 소스 권한이 있는 팀의 연동 테스트용입니다.

## 뷰 스트림과 이벤트 환원

```swift
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState>
session.events()                // AsyncStream<KernelEvent>
session.connectionState         // idle → connecting → live → retrying / recovering / authExpired …
```

SwiftUI 호스트는 `TansrSessionObserver(session:)`로 `view` / `connectionState` / `userSendStates`를 `@Published`로 바꿔 다시 그리기에 바로 공급합니다. `view`는 이미 환원된 뷰 상태이므로 증분을 직접 조립하지 마십시오. 표시 프로파일 `SessionViewOptions(delivery: .init(text: .final, thinking: .off))`: `final` 프로파일에서는 delta가 내부 버퍼에 들어가고 블록 확정 시 통째로 화면에 오릅니다. `thinking: .off`는 사고 part를 구체화하지 않습니다(상태 파생은 여전히 `thinking`을 보므로 자리 표시 UI를 만들 수 있음). 실행 중에는 `session.setDelivery(...)`로 블록 단위로 전환하며 `.off`로 바꾸면 기존 사고도 즉시 제거됩니다. L2 / L3 재구성과 resume / attach는 항상 현재 프로파일을 이어받습니다.

도구 카드 산출물 `toolCardArtifact`는 imageGen / videoGen / webSearch의 URL 산출물과 `.transcript(model:text:language:durationSec:)` / `.speech(model:url:b64:mime:format:durationMs:billedChars:)`를 꺼냅니다. `TansrToolCard`는 다섯 형태를 기본으로 그리며 `.speech`의 "재생" 버튼은 호스트가 `onPlaySpeech` 슬롯을 넘길 때만 나타납니다 — `TansrUI`에는 플레이어가 내장되어 있지 않습니다.

## 연결 상태 머신과 3단계 복구 체인

Android와 완전히 같습니다. L1은 SSE가 끊기면 `Last-Event-ID`를 붙여 재연결하고 수신 프레임을 seq로 중복 제거합니다. L2는 재연결 후 첫 프레임에서 gap을 받으면 → 투영을 버림 → 메타 정보 → `/history` → `viewStateFromHistory`로 재구성 → `lastSeq`부터 재구독합니다. L3는 메타 정보가 404이거나 `live == false`이거나 sessionId만 가진 콜드 스타트일 때 → `CreateSessionRequest(resumeSessionId: savedId)`로 resume하여 다시 로드하고, 옛 커서를 버리고 `history.lastSeq`를 기준점으로 삼습니다(resume 응답의 `lastSeq`는 읽지 않음). 끊김은 결코 업무 코드로 떠오르지 않습니다.

`lastSeq`는 항상 값 그대로 이어지고 휴면 판정은 항상 `live == false`이며 결코 `lastSeq == 0`이 아닙니다. `@tansr/serve` 0.9.0부터 휴면 세션 메타 정보의 `lastSeq`는 저장소에 영속화된 실제 수위이며, resume 후 새 에포크는 `0`이 아니라 그 수위 + 1부터 이어집니다(0.8.x에서는 둘 다 항상 `0`). 어느 버전에서도 단말 측 대응은 필요 없습니다. `live == true`이면서 `lastSeq == 0`이면 L2만 거치고 resume은 하지 않습니다. 세션 계약 revision 9(0.4.0에 동봉된 vendored 버전)는 55개 이벤트 타입을 등록하고 `TansrCore`는 그중 47개를 디코딩합니다. SDK 전용 이벤트 `session.events_dropped`(contract-v0.27)는 serve가 내보내지 않고 이벤트 스트림에 나타나지도 않으며, 설령 나타나더라도 `Unknown`으로 허용됩니다.

401 수렴 규칙도 같습니다. `authProvider`로 토큰을 최대 2회 다시 받고 그래도 401이면 종단 상태 `failed(unauthorized)`에 들어가 `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`가 되고 펌프가 멈춥니다. 호스트가 로그인 상태를 고친 뒤 명시적으로 `start()`해야 합니다. 종단 상태는 `failed`이지 `closed`가 아닙니다 — 세션은 끝나지 않았고 서버가 여전히 보유합니다.

통합 응답 헤더 게이트(D38, 세 클라이언트 동형): `TansrAgentClient.call()`의 모든 2xx, `openEventStream`의 200 이벤트 스트림, `AudioClient`의 2xx는 모두 먼저 `ApiContractGate.requireUnified`를 거칩니다 — 헤더 네 개 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`가 모두 있고 형식이 맞아야 합니다. 위반하면 `TansrAgentError.contractUnavailable(status:reason:)`을 던지며 **업무 성공이 아니고 폴백하지 않습니다**. 이벤트 펌프는 2xx 형태의 계약 불가에서 곧바로 `failed` 종단 상태에 들어갑니다(백오프도 재연결도 없음, 전형적인 원인은 `baseUrl`이 `/api` 파사드를 가리키지 않거나 중간에 프록시/포털 페이지가 있는 것). 호스트는 배포를 고친 뒤 `start()`합니다. 400 이상의 형태는 계속 상태 코드 정책을 따릅니다.

## 포그라운드/백그라운드: scenePhase 한 줄 배선

```swift
ChatScreen(session: session)
    .tansrSessionLifecycle(session)  // scenePhase 收放;在场即不需手工 start()
```

백그라운드로 가면 펌프를 멈추고 SSE를 끊습니다(일시 중단은 fatal이 아니며 `connectionState`는 `idle`로 돌아감). 포그라운드로 돌아오면 **복구 창**에 따라 경로를 자동 선택합니다. 웜 상태(기본 60초 이내)면 L1로 바로 이어 감. 임계값을 넘겼고 백그라운드 중에 턴이 실행됐으면 먼저 L2 `history` 재구성. 세션이 유휴로 회수됐으면 404 → L3 자가 복구. 판단은 `TansrCore`의 순수 함수 `LifecyclePolicy`이며 임계값은 `AgentSessionConfig.warmResumeWindowMs`로 조정할 수 있습니다. SwiftUI가 아닌 호스트의 등가 배선: 포그라운드에서 `session.start()`, 백그라운드에서 `session.stop()`. 멱등이며 `stop`은 세션을 잃지 않습니다. 세션 종료(`closed`) 후 포그라운드로 돌아와도 자동으로 되살아나지 않습니다.

## 낙관적 기록(iOS 고유 표시)

`send` / `sendBlocks`를 호출하는 즉시 사용자 말풍선을 기록하고(`userSendStates`에 `sending` 기록) HTTP 202 확인 후 확정합니다. 실패는 `failed`로 표시되며 조용히 사라지지 않습니다 — `retrySend(messageId)`는 원래 메시지 id 그대로 다시 제출하고(말풍선 중복 없음), `discardSend(messageId)`는 멱등하게 철회합니다. L2 / L3 재구성은 충돌을 막기 위해 낙관적 장부를 항상 비웁니다(재구성 후 메시지 id는 1부터 다시 매김).

## 오류 표시

| 출처 | 형태 | 표시 |
|---|---|---|
| 세션 내 오류 | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner`. `detail.scope == 'plan'`이면 "잠시 후 다시 시도" 문구 사용 |
| 조언성 | `view.notices`(`recoverable: true`) | 약한 알림 |
| 연결 상태 | `connectionState` | `TansrConnectionBanner` |
| HTTP 면 | `TansrAgentError.kind == .unified`: `unifiedCode`는 19개 통합 코드 중 하나(`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …), `retryAction`은 6가지 동작 중 하나(`none` / `same-request` / `query-status` / `rediscover` / `rebind` …). 원래 패밀리 코드는 `domainCode` / `domainStatus` / `domainRetryAction`에 남고 추가로 `traceId` / `requestId`를 나릅니다. 파사드 계약 불가는 `.contractUnavailable`(`reason` = 위반 항목). SDK 2.0 / 터미널 서비스 면은 같은 형태의 `ApiFacadeError`를 바로 던집니다(`Sdk2HttpError`는 사용 중단 표시). `domainCode`로 옛 kind를 복원하는 `toLegacy()`는 한 버전 동안의 과도기 조치일 뿐이며, `tansr-contract` 헤더가 없는 옛 `{ error: { code } }` 봉투는 계속 과도기 브리지를 거칩니다 | `unifiedCode` + `retryAction`으로 분기하고 `domainCode`는 진단 세분화에만 사용 |

`capacity_exceeded`(429 형태, `retryAction = same-request`)에서는 `Retry-After`의 정수 초 값만큼 기다립니다. 32 MiB 음성 본문 상한은 단말에서 먼저 거부합니다(`.payloadTooLarge`, 요청을 보내지 않음).

## 로컬 도구와 두 개의 브리지

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

handler는 태스크로 실행되고 `callId`로 대응됩니다. 재전송된 중복 프레임은 중복 제거, `server.tool.cancel`은 태스크 취소, `deadlineAt` 초과는 응답 없이 폐기, 응답의 네트워크 실패는 안전하게 재시도, 이미지 결과는 base64로 바꾸고 20 MiB 상한을 사전 자체 점검, 권한 다이제스트는 SDK가 축자 복창합니다. 등록되지 않은 브리지는 fail-closed: SDK는 응답하지 않고 서버는 계약대로 축소 처리합니다(권한은 deny-and-continue / 질문은 구조화된 "스스로 판단").

## 공개 네트워크 도구: 서버에서 실행

앱이 콘솔에서 `tools.webFetch`, `tools.http`(`@tansr/serve` 0.12.0 이상 필요) 또는 `tools.webSearch`를 켜면 에이전트는 웹 페이지 읽기, HTTP 요청 보내기, 웹 검색을 할 수 있습니다. 이 도구들은 모두 여러분의 세션 서비스 호스트에서 실행됩니다. 휴대폰이 대신 네트워크 요청을 보내지 않으며 기존 권한 승인을 우회하지도 않습니다. 기능 플래그 변경은 새로 만든 세션 또는 저장소에서 다시 조립된 세션에 적용되며 실행 중인 세션에서 도구가 자동으로 늘거나 줄지 않습니다.

- 공개 바이너리 SPM 패키지는 0.3.0부터 `SearchResultDetails` / `NetworkResultDetails` 표시 투영을 포함하며 `ToolCardArtifact`의 기존 사용법은 바뀌지 않습니다. 검색 카드는 출처, 잘림, 빈 결과 힌트를 유지하고 웹 페이지와 HTTP 카드는 원래 본문을 유지하며 실제 HTTP 상태를 표시합니다.
- HTTP 상태는 도구 성패를 대신하지 않으며 4xx / 5xx는 계속 확인해야 합니다. 검색 결과가 비어 있다고 알려진 URL에 접근할 수 없는 것은 아닙니다. 옛 기록에 이 메타데이터가 없으면 알 수 없음으로 두고 지어내지 마십시오.
- 기능 스위치, 실행 경계, 호스트 간 리디렉션 승인 규칙은 [모바일 앱용 공개 네트워크 도구](/ko/sdk/platform-bundle/#移动应用的公网工具)를 참조하십시오.

SDK 2.0은 서버 쪽에서 `@tansr/serve` 0.13.0 / 0.14.0과 함께 배포되었습니다(`@tansr/serve/extensions`의 명시적 호스트와 `/api` 통합 호출면). iOS 쪽에서는 공개 패키지 0.4.0부터 단말 측 인터페이스가 패키지에 포함됩니다. `TansrCore`의 `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`, 아카이브 동기화 `Sdk2ArchiveSync`와 복제본 수신 `Sdk2ReplicatedArchive`, 터미널 서비스 클라이언트 `TerminalClient`, `TansrClient`의 SQLite 아카이브 수신기/동기화 저장소/내구성 실행 저널(비공개 디렉터리, 키는 Data Protection Keychain이 보관). 이는 추가적인 기능이며 명시적으로 조립하지 않으면 동기화 저장소를 만들지 않고 `archive-sync-v1` 요청도 보내지 않으며 SDK1 세션 동작은 변하지 않습니다. 배포 기록에는 이번 라운드가 시뮬레이터 ad-hoc 서명 검수이며 실기기 검증은 없다고 등재되어 있습니다. 2026-10-10 이후 메인라인에 들어간 암호화 메모리 게시, 기기 저장소 원본 보존 마이그레이션, 터미널 영속화 프로파일은 **아직 어떤 SPM 버전으로도 배포되지 않았으며** 이 페이지에서는 설명하지 않습니다. 조립과 경계는 [SDK 2.0 확장 입구](/ko/sdk/sdk2-preview/)를 참조하십시오.

## 음성: 두 갈래 체인

1. **도구 체인**: 에이전트가 `SpeechToText` / `TextToSpeech`를 호출하고, 산출물은 `tool.completed.data`로 단말에 도달하며, `TansrToolCard`가 기본으로 그립니다(전사 본문 + 길이. 음성 행 + 길이 + 모델 + 과금 문자 수).
2. **직결 체인**:

```swift
// 麦克风 → 转写 → 填入输入框(不自动发送);m4a 16 kHz mono 上行 data:audio/mp4;base64,…
let transcript = try await client.audio.transcribe(
    sessionId: session.sessionId, data: m4aBytes, mime: "audio/mp4", language: "zh")
inputText = transcript.text

// 助手回复 → 语音 → 播放(url ?? b64;url 形约 24 h 时效)
let speech = try await client.audio.speak(sessionId: session.sessionId, text: reply, voice: "Cherry")
speech.url ?? speech.b64
```

순수 HTTP 왕복이며(`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`, 2xx도 마찬가지로 통합 응답 헤더 게이트를 거침) 기록에는 결코 들어가지 않습니다. 전사 텍스트를 다음 사용자 입력으로 삼을지는 앱의 결정입니다. 서버가 대신 플랫폼의 `/t1/asr` / `/t1/tts`를 호출하며 기능 플래그 `platform.speechToText` / `textToSpeech`와 할당량이 같은 게이트가 됩니다. 실패는 D19에 따라 `.unified`로 떨어집니다. 통합 코드는 `unifiedCode`에(`capability_unavailable` / `invalid_request` / `upstream_unavailable` 등), 플랫폼 음성면의 원래 코드(`asr_not_configured` / `tts_quota_exceeded` …)는 `domainCode`에 들어갑니다. `@tansr/serve` 0.9.0부터 플랫폼 업스트림의 401 / 403 / 5xx와 네트워크 장애는 `upstream_unavailable`(503)로 정규화되고 `Retry-After`를 동반하므로 단말은 정수 초 값만큼 백오프하면 됩니다.

**마이크 권한 선언**: 앱 타깃의 Info.plist에는 `NSMicrophoneUsageDescription`이 있어야 하며, 없으면 iOS는 첫 마이크 접근에서 프로세스를 종료합니다. 이 저장소는 SwiftPM 패키지이고 `executableTarget`에는 Info.plist 의미가 없습니다 — 예제 `Examples/OrderAssistant/Info.plist`는 `Package.swift`에서 명시적으로 `exclude`되어 있습니다. iOS에서는 Xcode로 앱 프로젝트를 만들어 이 패키지를 붙일 때 그것을 앱 타깃의 Info.plist로 설정하고(또는 키별로 병합), macOS `swift run`에서는 `-Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker <path>`로 삽입합니다. 저장소 안에서는 의도적으로 `linkerSettings.unsafeFlags`를 쓰지 않습니다(의존성으로 쓰일 때 SwiftPM이 거부함).

## 푸시 깨우기: 직접 연결한다

SDK는 어떤 푸시 SDK도 동봉하지 않습니다(APNs / FCM / 제조사 채널은 여러분 몫). 서버의 webhook 훅은 턴이 종단 상태에 도달했고 활성 구독자가 없을 때 최소 페이로드를 POST합니다. [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 참조하십시오. 앱은 푸시로 깨어난 뒤 항상 기존 3단계 체인을 거치며 새 API는 없습니다. 프로세스가 살아 있으면 → 포그라운드 복귀 시 자동 L1 재연결. 프로세스가 죽었으면 → 콜드 스타트로 `openSession(CreateSessionRequest(resumeSessionId: id))`, 즉 L3.

## 연동 테스트와 빌드

- 앱 연동에는 공개 바이너리 SPM 패키지 `tansr-ios-spm`을 사용합니다([빠른 시작의 iOS 절](/ko/getting-started/android/#ios-同法) 참조). 이 절의 `swift build` / `swift test`는 소스 권한이 있는 팀의 연동 테스트용입니다. 같은 앱 의존성 그래프에서 소스 SDK와 바이너리 SDK를 섞어 쓰지 마십시오.
- 저장소 안의 `examples/serve-demo`에 연결하기: `pnpm start` / `pnpm real`(npm은 `npm start` / `npm run real`)은 모두 실제 모델 입구이며, 상주 연동 테스트는 `DEMO_SERVE_ONLY=1`, `DEMO_PORT=8788`로 기동합니다(소스 기본 포트는 8799, 공개된 echo 기동 명령은 더 이상 없음). 독립된 개발자 로그인 서비스 `pnpm login`의 기본값은 `127.0.0.1:8787`. demo 인증 티켓 형식은 `demo1.<b64url(uid)>.<exp>.<hmac-sha256-hex>`입니다. iOS 시뮬레이터에서 호스트 머신으로는 `127.0.0.1`로 바로 연결됩니다. 예제 `OrderAssistant`: `swift run OrderAssistant`, 또는 `TANSR_DEMO_BASE_URL=http://127.0.0.1:8789 swift run OrderAssistant`로 서비스 주소를 덮어씁니다. 평문 http는 demo에서만 `NSAllowsArbitraryLoads`로 허용하며 프로덕션은 항상 TLS를 사용합니다.
- **Windows / Linux에서 로직 층 빌드**: `swift build` / `swift test`(Swift 6.3+)로 `TansrCore` 전체 스위트가 실행됩니다 — 골든 픽스처 대조, 계약표 대조, 펌프 상태 머신, 낙관적 기록, 두 브리지 매트릭스, 음성 직결면. Windows에서 `swift test`를 실행하려면 XCTest 런타임 DLL 디렉터리를 PATH에 추가해야 합니다(`<Swift>\Platforms\<ver>\Windows.platform\Developer\Library\XCTest-<ver>\usr\bin64`).
- Windows에서 패키지 로드 시 바로 `NSCocoaErrorDomain Code=257 "You don't have permission."`이 뜨면 대개 ACL 문제가 아닙니다. SwiftPM은 `Package.swift`를 `%TEMP%` 아래 `<패키지 이름>-manifest.exe`로 컴파일한 뒤 실행하는데, 능동 방어 기능이 있는 보안 소프트웨어가 이를 가로채 격리합니다. 조치는 둘 중 하나: Swift 툴체인 디렉터리를 보안 소프트웨어 신뢰 영역에 추가(근본 해결). 또는 `mklink /J`로 보안 소프트웨어가 허용하는 디렉터리 별칭을 만든 뒤 그 안에서 실행.
- macOS(Xcode 15+): `swift build && swift test`로 `TansrUI`를 포함한 전체를 실행. iOS 시뮬레이터/실기기는 Xcode로 이 패키지를 열어 `OrderAssistant` scheme을 실행합니다.
