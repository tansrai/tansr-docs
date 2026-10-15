---
title: 'Android 연동 가이드'
description: 'Kotlin SDK의 모듈 분할, 이벤트 환원과 SessionView, 연결 상태 머신과 3단계 복구 체인, 포그라운드/백그라운드와 Doze 정책, 오류 표시, 로컬 도구와 두 개의 브리지, 두 갈래 음성 체인, 직접 연결하는 푸시 깨우기, 그리고 자격 증명과 로그 규율.'
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

Android SDK(Maven 좌표 `com.tansr.sdk:core` / `:client` / `:compose`, 선택 모듈 `:receiver-android`, 패키지 접두사 `com.tansr.sdk`)는 세션 서비스의 얇은 프로토콜 클라이언트입니다. 에이전트 세션 서비스 계약을 구현하며, 모든 요청은 통합 호출면 `/api`로 나갑니다. 이 페이지는 빠른 시작 이후에 마주치는 설계 쟁점을 모두 다룹니다. 이벤트가 어떻게 UI 상태가 되는지, 끊긴 뒤 어떻게 복구하는지, 포그라운드/백그라운드를 어떻게 다루는지, 오류를 어떻게 보여 주는지, 도구와 대화 상자를 어떻게 연결하는지, 음성과 푸시를 어떻게 붙이는지. 이 페이지는 배포된 **0.5.0**(Maven Central, 2026-10-07, 네 모듈 동일 버전)에 맞춰 확인했고, 서버 쪽은 `@tansr/serve` 0.15.1(npm latest, 2026-10-10)에 맞췄습니다.

## 버전과 서버 접두사(2026-10-13 확인)

- 0.5.0(2026-10-07 Maven Central 게시, 소스 `50306a2c`)부터 SDK의 모든 HTTP 요청은 서버가 0.13.0부터 제공하는 통합 호출면 `/api`만 거칩니다(D10: 즉시 전환, `/v2` 폴백은 남기지 않음). 경로, 메서드, 헤더 이름은 manifest revision 7에서 생성된 `ApiContract` / `ApiOps`(81개 작업)에서 나오며, 세션 패밀리는 더 이상 경로로 구분하지 않고 요청 헤더 `tansr-session-family: sdk1 | sdk2-offload-v1`로 명시적으로 전달합니다. 서버에는 `/api` 파사드가 내장되어 있어야 합니다(`@tansr/serve` 0.13.0 이상, r7은 0.14.0 이상).
- 0.5.0과 함께 배포된 것: 통합 오류 코드를 주축으로 삼는 공개 예외 모델(D19, 0.4.0 대비 호환성이 깨지는 변경이며 기존 패밀리별 sealed 타입은 `@Deprecated`로 한 버전만 유지), SDK1 성공 응답과 이벤트 스트림에 대한 통합 응답 헤더 게이트(D10 / D38), 요청 헤더 `Idempotency-Key` / `If-Match` / `deadline` 세 개를 나르는 `ApiCallOptions`. 이 페이지는 이 동작들에 맞춰 서술합니다.
- 더 오래된 0.1.0 – 0.4.0은 여전히 `/v2`에 직접 연결합니다. 서버의 `/v2`는 0.13.0부터 내부 어댑터 입구에 불과하며 1.0.0에서 외부 입구가 제거됩니다. 이 버전들에 머물러 있는 앱은 0.5.0으로 업그레이드하십시오. 일정은 [배포와 인증](/ko/serve/deploy-and-auth/)을 참조하십시오.

## 휴대폰은 사용자 메시지를 보내고, 서버가 시스템 프롬프트를 설정한다

`CreateSessionRequest(prompt=...)`와 `session.send(...)`는 모두 일반 사용자 메시지를 보냅니다. Android / iOS는 `/api` 세션 요청으로 `system`을 전달하지 않습니다. 공유 역할은 플랫폼 앱 설정에서 관리하고, 코드로 맞춤화하는 역할은 serve의 `platform.system`이 제공하며, 호스트 설명은 `platform.systemAppend`를 사용합니다.

프롬프트와 정책 기능은 `@tansr/serve` 0.8.0부터 사용할 수 있으며 플랫폼 쪽은 2026-09-14에 프로덕션에 배포되었습니다. 기본 `fallback`에서는 SDK가 명시한 `system`(빈 배열 포함)이 플랫폼 세그먼트를 대체하고, `prepend`에서는 플랫폼 세그먼트를 앞에 유지합니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 갱신되며 실행 중인 턴은 고정됩니다. 포그라운드/백그라운드 재연결, SSE 복구, attach는 원래 세션과 기록을 유지할 수 있으므로 갱신을 받기 위해 세션을 다시 만들 필요가 없습니다. 업무 세그먼트 충돌은 앱 관리자가 해결하십시오. 권한은 계속 독립된 메커니즘으로 처리됩니다. 자세한 내용은 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참조하십시오.

## 모듈 분할

| 모듈 | 종류 | 내용 |
|---|---|---|
| `:core` | 순수 Kotlin/JVM, Android 의존성 없음 | 계약 상수와 생성된 `/api` 계약(`ApiContract` / `ApiOps` 81개 작업, `UnifiedCode` 19개 통합 코드, `UnifiedRetryAction`), `ApiCallOptions`, `KernelEvent` sealed class 계열(47개 타입 + `Unknown` 허용), IR 메시지 모델, SSE 파싱/분배, `SessionView` reducer와 `viewStateFromHistory`, 도구 카드 산출물 파싱 `toolCardArtifact`와 검색/네트워크 결과 투영 `SearchResultDetails` / `NetworkResultDetails`, 프로토콜 클라이언트 로직과 전송 추상화, 음성 직결면 `AudioClient`, 재연결 상태 머신, `defineTool`과 원격 도구 브리지, 권한/질문 브리지 `SessionBridges`, `BridgeDialogState`. SDK 2.0 얇은 클라이언트 `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSyncClient`와 터미널 서비스 클라이언트 `TerminalClient` |
| `:client` | 순수 Kotlin/JVM | OkHttp 전송 구현, `TansrAgent` 진입 팩토리 |
| `:compose` | Android 라이브러리 | Compose 바인딩 얇은 층: `collect*AsStateWithLifecycle`, `TansrSessionLifecycle`, 기본 권한/질문 대화 상자, `TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`. 모두 교체 가능하고 테마에 묶이지 않으며 플레이어도 권한도 갖지 않습니다. 오류 문구는 통합 코드 + `retryAction`에 따라 표시합니다 |
| `:receiver-android` | Android 라이브러리(선택, 0.5.0에서 처음 배포) | SDK 2.0 단말 측 영속화 층: SQLite 아카이브 수신기, 동기화 저장소, 내구성 실행 저널(`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteSyncArchiveStore` / `Sdk2SqliteExecutionJournal`). 세 모듈을 대체하지 않으며 SDK 2.0 단말 실행을 연동할 때만 추가합니다 |

`:core` / `:client`는 의도적으로 순수 JVM으로 두어 프로토콜면을 단말 없이 단위 테스트할 수 있습니다. 공개 API 면은 binary-compatibility-validator가 지키므로 변경은 항상 명시적인 diff를 거칩니다. 네 모듈은 같은 버전 번호를 공유하며 업그레이드는 동시에 합니다.

## 이벤트 환원: 세 개의 Flow

```kotlin
session.events          // SharedFlow<KernelEvent>(replay = 0;历史语义归 view 与恢复链)
session.view            // StateFlow<SessionViewState>(reducer 投影,conflated)
session.connectionState // StateFlow<ConnectionState>
```

- `events`는 원시 커널 이벤트로, 서버 SSE 프레임 하나당 한 건입니다. 알 수 없는 타입은 `Unknown(type, raw)`으로 디코딩되어 예외를 던지지 않으며, 손상된 JSON은 진단 카운트에만 계수하고 스트림을 끊지 않습니다. 세션 계약 revision 9(0.5.0에 동봉된 vendored 버전)는 55개 이벤트 타입을 등록하고 SDK는 그중 47개를 디코딩합니다. 새 SDK 전용 이벤트 `session.events_dropped`(contract-v0.27, Node SDK 프로세스 내 백프레셔 폴백)는 serve가 내보내지 않으며 `/v2` 스트림에도 나타나지 않습니다. 설령 나타나더라도 `Unknown`으로 허용하며 단말이 그릴 의무는 없습니다.
- `view`는 **환원된 뷰 상태**입니다. 메시지 목록(사용자/어시스턴트/도구 카드), TODO, 사용량, `lastError`, `notices`. 대부분의 UI는 이를 직접 구독합니다. `msg.text.delta`를 직접 조립하지 마십시오. reducer는 TS / Swift 구현과 같은 골든 픽스처를 공유하므로 세 클라이언트의 투영 의미는 일치합니다.
- 표시 프로파일 `SessionViewOptions(delivery = …)`: 텍스트와 사고는 각각 `stream` / `final`을 고를 수 있습니다(사고에는 `off`도 있음). 실행 중에는 `setDelivery`로 블록 단위로 전환할 수 있습니다.

도구 카드 산출물은 `toolCardArtifact(data)`로 형태에 따라 꺼냅니다. 이미지/동영상/웹 검색의 URL 산출물, 음성의 `Transcript(model, text, language?, durationSec?)` / `Speech(model, url?, b64?, mime, format, durationMs?, billedChars)`. `errorCode`가 있으면 항상 null입니다. `TansrToolCard`는 이 형태들을 기본으로 그리며 `messageActions` / `speechAction` 두 슬롯에 "재생/정지" 버튼을 걸 수 있습니다.

## 연결 상태 머신과 3단계 복구 체인

```text
Idle → Connecting → Live
Live → Retrying(指数退避,尊重服务端 retry 首帧)→ Live          // L1:携 Last-Event-ID 重连,重放按 seq 去重
Live → Recovering(拉 /history 重建)→ Live                        // L2:重连首帧收到 gap
401 → AuthExpired(回调 authProvider 重取)→ 刷够仍 401 → Failed(Unauthorized)
200 流缺统一响应头 → Failed(ContractUnavailable)                   // D38:部署形态错误,不退避不重连
```

| 단계 | 트리거 | SDK 동작 |
|---|---|---|
| L1 | 순간 끊김/네트워크 전환/포그라운드 복귀 | `Last-Event-ID=<마지막으로 소비한 seq>`를 붙여 자동 재연결하고 수신 프레임은 seq로 중복 제거 |
| L2 | 재연결 후 첫 프레임이 `server.replay.gap` | 현재 투영을 버림 → `GET /api/sessions/:id` → `GET …/history` → `viewStateFromHistory`로 재구성 → `lastSeq`부터 재구독 |
| L3 | 메타 정보가 404 또는 `live = false`, 혹은 sessionId만 가진 콜드 스타트 | `POST /api/sessions { resume }` → `resumed = true, lastSeq = <새 에포크 시작 수위>` → 옛 커서를 버리고 L2 절차로 재구성(기준점은 `history.lastSeq`이며 이 응답의 값은 읽지 않음) |

전 과정에 업무 코드는 없습니다. 콜드 스타트에서 지난 대화를 이어 가려면 `CreateSessionRequest(resumeSessionId = savedId)`를 사용합니다. SDK 기본값은 **attach-first**입니다. 먼저 GET으로 메타 정보를 살피고, 활성이면 attach(업스트림 비용 0), 비활성이면 resume으로 다시 로드하며, 저장소에 기록이 없을 때만 새로 만듭니다. 종료된 세션(`Closed`)이 자동으로 되살아나는 일은 없습니다.

**`lastSeq`는 항상 값 그대로 이어지고 휴면 판정은 항상 `live = false`입니다** — 결코 `lastSeq == 0`이 아닙니다. `@tansr/serve` 0.9.0부터 휴면 세션 메타 정보의 `lastSeq`는 저장소에 영속화된 실제 수위이며, resume 후 새 에포크는 그 수위 + 1부터 이어집니다(0.8.x에서는 둘 다 항상 `0`이었음). SDK의 L3는 원래부터 옛 커서를 버리고 `history.lastSeq`를 기준으로 삼으므로 어느 버전에서도 단말 측 대응은 필요 없습니다. `live = true`이면서 `lastSeq == 0`이면 L2만 거치고 resume은 하지 않습니다.

**401 수렴 규칙**: 이벤트 스트림이 401 → `authProvider`로 토큰을 다시 받아 재연결. **연결당 최대 2회**(첫 번째 백오프 0 ms, 두 번째 1000 ms, `AgentSessionConfig.authRetry`로 설정 가능하되 항상 유한). 그래도 401이면 `connectionState = Failed(Unauthorized)` + `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }`가 되고 펌프는 멈춰 다시는 자동 재연결하지 않습니다. 호스트가 로그인 상태를 고친 뒤 명시적으로 `start()`하십시오. 토큰을 갱신했는데도 401이면 만료이거나 설정 오류이지 흔들림이 아닙니다.

**통합 응답 헤더 게이트(D10 / D38)**: 모든 2xx JSON 응답과 200 이벤트 스트림은 본문/프레임을 읽기 전에 응답 헤더 네 개 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`를 대조합니다. 누락되거나 형식이 틀리면 `TansrAgentException.ContractUnavailable(status, reason)`을 던집니다(`reason`은 `missing_header:tansr-contract`처럼 위반 지점을 가리킴). **업무 성공이 아니며 옛 접두사로 폴백하지도 않습니다**. 2xx 형태의 계약 불가 — 전형적으로 `baseUrl`이 `/api` 파사드를 가리키지 않거나, 프록시 캐시 페이지, 캡티브 포털 — 에서는 펌프가 즉시 `Failed` 종단 상태로 들어갑니다. 이는 배포 형태 오류이지 일시적 장애가 아니므로 재시도는 무의미하며, 고친 뒤 명시적으로 `start()`하십시오. 400 이상의 형태(프록시의 502 / 503 HTML 페이지 등)는 계속 상태 코드 정책에 따라 백오프합니다. 통합 파사드는 항상 네 헤더를 내보내므로 헤더를 보완해야 하는 것은 직접 만든 가짜 서버/테스트 픽스처뿐입니다.

## 포그라운드/백그라운드와 Doze

백그라운드 장기 연결은 불안정하고 배터리를 소모하므로 SDK 정책은 **백그라운드로 가면 펌프를 멈추고 스트림을 끊으며, 포그라운드로 돌아오면 복구 창에 따라 경로를 자동 선택**하는 것입니다.

- 웜 상태(기본 60초 이내 복귀): L1로 바로 이어 감.
- 임계값을 넘겼고 백그라운드 중에 턴이 실행됨: 먼저 L2 `history` 재구성을 하여 gap이 확정된 구독을 피함.
- 유휴로 세션이 회수됨(서버 기본값: 모두 떠난 뒤 5분 회수 / 24시간 유휴): 404 → L3로 자가 복구.

Compose라면 한 줄 `TansrSessionLifecycle(session)`(`repeatOnLifecycle(STARTED)`로 시작/정지). Compose가 아니면 포그라운드에서 `start()`, 백그라운드에서 `stop()`. 둘 다 멱등이며 `stop`은 세션을 잃지 않습니다. 임계값은 `AgentSessionConfig.warmResumeWindowMs`로 조정합니다. 판단은 `:core`의 순수 함수 `LifecyclePolicy`이며 JVM 단위 테스트로 전부 덮습니다. Doze 강제 유휴 중에는 펌프가 이미 멈춰 있고(서버에 활성 구독자 없음), 화면 켜짐과 포그라운드 복귀가 같은 정책으로 자가 복구합니다. 제조사의 공격적인 백그라운드 강제 종료는 콜드 스타트 L3와 같습니다.

서버 쪽 협조: 구독자가 모두 떠난 뒤 60초가 지나면 서버는 실행 중인 턴을 interrupt하고(턴 종료 시 영속화는 수행됨), 5분 뒤 close하여 저장소에 내립니다. 따라서 "백그라운드에서 돌아오니 턴이 중단되어 있었다"는 것은 설계된 동작이며 기록은 사라지지 않고 resume으로 이어 갈 수 있습니다. 백그라운드 중에 "턴이 완료되었다"고 사용자에게 알리려면 아래의 푸시 깨우기를 사용하십시오.

## 오류 표시

| 출처 | 형태 | 표시 지침 |
|---|---|---|
| 세션 내 오류 | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner`가 기본으로 그림. `detail.scope == 'plan'`이면 "로컬 속도 제한"이 아니라 "잠시 후 다시 시도" 문구를 사용 |
| 조언성 | `view.notices`(`recoverable: true`인 `turn.error`, 서버 영속화 실패 등) | 약한 알림. 입력을 막지 않음 |
| 연결 상태 | `connectionState` | `TansrConnectionBanner`: `Reconnecting…` / `Recovering` / 인증 만료 |
| HTTP 면 | `TansrAgentException.Unified`: `code`는 19개 통합 코드 중 하나(`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …), `retryAction`은 6가지 동작 중 하나(`none` / `same-request` / `query-status` / `rediscover` / `rebind` …). 원래 패밀리 코드와 상태는 `domainCode` / `domainStatus`에 남고(`session_not_found`, `session_limit_exceeded` 등) 추가로 `traceId` / `requestId` / `retryAfterSeconds`를 나릅니다. 파사드 계약 불가는 `ContractUnavailable(status, reason)`. SDK 2.0 / 터미널 서비스 면은 같은 형태의 `ApiFacadeException`을 던집니다. 기존 패밀리별 sealed 타입(`SessionNotFound` 등 33개)과 `Unified.toLegacy()`는 모두 `@Deprecated`로 한 버전만 남으며 `tansr-contract` 헤더가 없는 옛 봉투에서만 나타납니다. `Network` / `Protocol` / `Unauthorized` / `Forbidden`은 유지됩니다 | `code` + `retryAction`으로 분기하고 `domainCode`는 진단 세분화에만 사용. `domainCode`로 옛 타입을 복원하지 말 것 |

`capacity_exceeded`(429 형태, `retryAction = same-request`)에서는 `retryAfterSeconds`(`Retry-After` 헤더에서 얻고, 헤더가 없으면 봉투의 `retryAfterMs`를 올림)를 읽어 기다립니다. `domainCode = session_limit_exceeded`(최종 사용자당 기본 8개 활성 세션, serve의 `maxSessionsPerEndUser`)이면 사용하지 않는 세션을 닫도록 사용자에게 안내하십시오. 오류 메시지 문구는 항상 영어이며 호스트가 `code`에 따라 현지화합니다.

## 로컬 도구와 두 개의 브리지

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) }
}
val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(), bridges = dialogs.bridges(tools = listOf(searchOrders)))
```

- `defineTool`: `name` / `description` / JSON 매개변수 표 / `readOnly`(기본 false, 보수적으로 쓰기 도구로 취급) / `timeoutMs?`. handler는 suspend 함수이며 String은 그대로, 그 외는 JSON 직렬화되고, 던져진 예외는 isError 구조화 결과로 정규화되어 세션을 깨뜨리지 않습니다. `CancellationException`은 통과합니다(`server.tool.cancel`에 대응). 선언은 세션과 함께 전송되지만 handler 본문은 전송되지 않습니다.
- 여섯 가지 프로토콜 의미는 SDK가 대신 처리합니다. `callId` 대응, 재전송된 중복 프레임 제거, `deadlineAt` 초과 시 응답 없이 폐기, 응답의 네트워크 실패 시 안전한 재시도, 이미지 결과의 base64 변환과 20 MiB 상한 사전 검사, 권한 다이제스트의 축자 복창.
- 권한/질문 대화 상자: `BridgeDialogState` + `TansrBridgeDialogs(dialogs)`로 기본 UI를 쓰거나 직접 suspend 콜백을 작성합니다. **등록되지 않은 브리지는 fail-closed**입니다. SDK는 응답하지 않고, 서버는 권한을 120초 뒤 deny-and-continue로, 질문은 60초 유예 후 구조화된 "스스로 판단"으로 처리합니다.
- 권한 프레임에 `attribution.reason`이 있으면(판정자가 위험하다고 판단) 이유를 사용자에게 보여 주고 최종 판단을 맡깁니다. 기계가 대신 승인하지 않습니다.

## 공개 네트워크 도구: 서버에서 실행

앱이 콘솔에서 `tools.webFetch`, `tools.http`(`@tansr/serve` 0.12.0 이상 필요) 또는 `tools.webSearch`를 켜면 에이전트는 웹 페이지 읽기, HTTP 요청 보내기, 웹 검색을 할 수 있습니다. 이 도구들은 모두 여러분의 세션 서비스 호스트에서 실행됩니다. 휴대폰이 대신 네트워크 요청을 보내지 않으며 기존 권한 승인을 우회하지도 않습니다. 기능 플래그 변경은 새로 만든 세션 또는 저장소에서 다시 조립된 세션에 적용되며 실행 중인 세션에서 도구가 자동으로 늘거나 줄지 않습니다.

- 결과는 도구 카드로 그대로 표시되며 잘림 힌트도 유지합니다. Http의 HTTP 상태는 도구 성패를 대신하지 않으며 4xx / 5xx는 계속 확인해야 합니다. 검색 결과가 비어 있는 것은 이번 질의에 일치가 없었다는 뜻일 뿐 사이트에 접근할 수 없다는 뜻이 아닙니다. 옛 기록을 복원할 때는 실제로 보존된 본문과 상태만 표시하고 출처나 상태 코드를 지어내지 않습니다.
- 전용 검색/웹 페이지/HTTP 결과 표시 투영(`com.tansr.sdk.view.SearchResultDetails` / `NetworkResultDetails`)은 0.5.0부터 `:core`와 함께 배포됩니다. 검색 카드는 출처, 잘림, 빈 결과 힌트를 유지하고, 웹 페이지와 HTTP 카드는 원래 본문을 유지하며 실제 HTTP 상태를 표시합니다. `toolCardArtifact`의 기존 사용법은 바뀌지 않습니다. 0.4.0 이전은 계속 기존 도구 카드로 결과를 표시합니다.
- 기능 스위치, 실행 경계, 호스트 간 리디렉션 승인 규칙은 [모바일 앱용 공개 네트워크 도구](/ko/sdk/platform-bundle/#移动应用的公网工具)를 참조하십시오.

SDK 2.0은 서버 쪽에서 `@tansr/serve` 0.13.0 / 0.14.0과 함께 배포되었습니다(`@tansr/serve/extensions`의 명시적 호스트와 `/api` 통합 호출면). Android 쪽에서는 0.5.0부터 단말 측 얇은 클라이언트가 패키지에 포함됩니다. `:core`의 `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`, 아카이브 동기화 `Sdk2ArchiveSyncClient` / `Sdk2ReplicatedArchiveStore`, 터미널 서비스 클라이언트 `TerminalClient`, 그리고 선택 모듈 `:receiver-android`의 SQLite 아카이브 수신기/동기화 저장소/내구성 실행 저널입니다. 이는 추가적인 기능이며 SDK 2.0을 연동하지 않는 앱은 `:receiver-android`를 추가하지 않고 SDK1 세션 동작은 변하지 않습니다. 2026-10-10 이후 메인라인에 들어간 암호화 메모리 공개 미디어, 암호화 증분 SQLite 프로파일, 읽기 전용 복제본 등의 영속화 기능은 **아직 어떤 Maven 버전으로도 배포되지 않았으며** 이 페이지에서는 설명하지 않습니다. 조립과 경계는 [SDK 2.0 확장 입구](/ko/sdk/sdk2-preview/)를 참조하십시오.

## 음성: 두 갈래 체인

음성은 프로토콜 수준의 입력 종류가 아닙니다(메시지 블록에도 이벤트 스트림에도 들어가지 않음).

1. **도구 체인**: 에이전트가 스스로 `SpeechToText` / `TextToSpeech`를 호출하고, 산출물은 `tool.completed.data`로 단말에 도달하며, `toolCardArtifact`가 `Transcript` / `Speech`를 꺼내고 `TansrToolCard`가 기본으로 그립니다.
2. **직결 체인**(여러분 자신의 음성 UX):

```kotlin
val transcript = client.audio.transcribe(session.sessionId, bytes, mime = "audio/mp4") // 转写填框,是否发送归 App
val speech = client.audio.speak(session.sessionId, assistantText)                       // url ?: b64;URL 约 24 h 有效
```

`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`를 거치며(같은 `call()`을 통해 통합 응답 헤더 게이트를 통과), 서버가 대신 플랫폼 음성면을 호출합니다. 기능 플래그 `platform.speechToText` / `textToSpeech`와 할당량이 같은 게이트가 됩니다. 실패하면 `TansrAgentException.Unified`가 던져지고 통합 코드는 `code`에(`capability_unavailable` / `invalid_request` / `payload_too_large` / `upstream_unavailable` 등), 플랫폼 음성면의 원래 코드는 `domainCode`에 들어갑니다(`capability_disabled` / `asr_not_configured` / `tts_quota_exceeded` …; 파사드 어휘에 등록되지 않은 업스트림 업무 코드는 계약에 따라 `internal_error`로 폴백하며 원래 코드와 상태는 `domainCode` / `domainStatus`에 보존됨). `@tansr/serve` 0.9.0부터 플랫폼 업스트림의 401 / 403 / 5xx와 네트워크 장애는 `upstream_unavailable`(503)로 정규화되고 `Retry-After`를 동반합니다. `:compose`는 플레이어도 권한도 갖지 않습니다. 녹음/재생은 호스트의 몫이며 샘플의 `AudioRecorderController` / `AudioPlayerController`는 참고 구현입니다. 녹음에는 `RECORD_AUDIO` 런타임 권한이 필요합니다.

## 푸시 깨우기: 직접 연결한다

SDK가 푸시 SDK를 동봉하는 일은 없습니다. 턴이 종단 상태에 도달했고 활성 구독자가 없으면 서버는 여러분의 webhook에 최소 페이로드 `{ sessionId, endUserId, turnId?, status, reason?, lastSeq, ts }`를 POST합니다(메시지 내용도 자격 증명도 결코 포함하지 않음). 자세한 내용은 [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 참조하십시오. 여러분 쪽에서는 webhook 수신 → 서명 검증 → `endUserId`를 단말의 푸시 등록 토큰에 대응 → `sessionId`만 실은 FCM **data** 메시지(또는 제조사 채널) 전송 → `onMessageReceived`에서 로컬 알림 표시 → 탭 후 기존 3단계 체인으로 복구(웜이면 자동 L1 / L2, 콜드 스타트면 `CreateSessionRequest(resumeSessionId = sessionId)` 즉 L3). 새 SDK API는 전혀 관여하지 않습니다.

## 자격 증명과 로그 규율

- 단말 자격 증명 = 여러분의 로그인 상태. SDK는 `authProvider`를 통해 요청마다 가져올 뿐 **결코 영속화하지 않으며**(SharedPreferences / DataStore / 파일/로그에 쓰지 않음) 한 요청의 수명을 넘겨 캐시하지 않습니다.
- appkey는 SDK / 샘플 코드 면에 애초에 존재하지 않으며 `app_user` 토큰이 단말에 배포되는 일도 없습니다. 이 페이지가 다루는 `@tansr/serve` 내장 형태에서 `/api` 세션면의 최종 사용자 신원은 여러분의 `authenticate` 훅에서만 나옵니다. `tansr serve --v2` 단일 운영자 형태는 같은 Bearer에 `x-tansr-end-user` 구분 헤더를 덧붙여 동작하며 이 페이지의 범위 밖입니다.
- SDK 디버그 로그는 auth 헤더, 토큰, 응답 전문, 도구 args 전체를 출력하지 않고 형태 요약만 냅니다. 크래시 리포트가 자격 증명을 손에 넣는 일은 없습니다.
- 도구 응답도 도구 선언도 신뢰할 수 없는 입력입니다. 서버 쪽 형태 검증은 필수이며 의미 면은 기능 프로파일에 의한 축소 + 권한 브리지 + 이벤트 스트림 귀속에 의존합니다. 단말은 역공학될 수 있으므로 "자사 앱이니까"라며 경계를 늦추지 마십시오.

## 로컬 연동 테스트

`:sample`(주문 어시스턴트)은 기본으로 저장소 안의 `examples/serve-demo`에 연결합니다. serve-demo는 `DEMO_SERVE_ONLY=1`과 `DEMO_PORT=8788`로 상주 기동하며(소스 코드 기본 포트는 8799, `pnpm start` / `pnpm real`은 모두 실제 모델 입구이고 공개된 echo 기동 명령은 더 이상 없음), sample은 기본으로 `http://127.0.0.1:8788`에 연결하므로 먼저 `adb reverse tcp:8788 tcp:8788`로 단말 포트를 개발 머신으로 전달합니다(에뮬레이터는 명시적으로 `http://10.0.2.2:8788`로 바꿀 수도 있지만 sample의 기본 주소는 아님). `authProvider`는 demo 티켓 형식으로 로컬 서명하며, 독립된 개발자 로그인 서비스(`pnpm login`, 기본 `127.0.0.1:8787`)로 바꿀 때는 8787도 전달합니다. 다시 빌드하지 않고 포트를 바꾸려면 `adb reverse tcp:8789 tcp:8789` 뒤에 `adb shell am start -n com.tansr.sdk.sample/.OrderAssistantActivity -e baseUrl http://127.0.0.1:8789`를 실행합니다. 실기기에서는 `DEMO_HOST=0.0.0.0`으로 서버를 띄우고 개발 머신의 LAN IP를 지정합니다(평문 http는 network security config에서 허용해야 하며, 루프백 밖에서 수신하려면 32자 이상의 자체 `DEMO_AUTH_SECRET`이 필수). 게이트: `./gradlew build`(assemble + 단위 테스트 + ktlint + apiCheck).
