---
title: 'HarmonyOS 연동 가이드'
description: '네이티브 ArkTS HAR의 공개면, SessionView 환원, 연결 상태와 3단계 복구, 생명주기, 로컬 도구와 두 개의 브리지, 두 갈래 음성 체인과 낭독의 두 상한, 미디어 다운로드 경계, 그리고 자격 증명과 로그 규율.'
zone: docs
category: harmony
related:
  - sdk/system-prompts
  - getting-started/harmony
  - getting-started/android
  - android
  - ios
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-harmony:doc/HM-01-Demo接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

HarmonyOS SDK(HAR 좌표 `@tansr/harmony`, 현재 독립 배포 버전 0.2.0, `harmony-sdk.zip`으로 배포, 공개 OHPM 미등록)는 세션 서비스의 네이티브 ArkTS 얇은 클라이언트입니다. 에이전트 세션 서비스 계약을 구현하며 모든 요청은 통합 호출면 `/api`로 나갑니다. 최소 HarmonyOS 6.0 / API 20(`compatibleSdkVersion`)을 선언하고 API 22 툴체인으로 빌드하며 Stage 모델을 사용합니다. 이 페이지는 빠른 시작 이후에 마주치는 설계 쟁점을 다룹니다. 이벤트가 어떻게 UI 상태가 되는지, 끊긴 뒤 어떻게 복구하는지, 도구와 대화 상자를 어떻게 연결하는지, 음성과 미디어를 어떻게 붙이는지. HAR은 ArkUI 페이지를 제공하지 않으며 마이크를 자동으로 요청하지도 않습니다. 서버 쪽은 `@tansr/serve` 0.15.1(npm latest, 2026-10-10)에 맞춰 2026-10-13에 확인했습니다. 0.2.0 HAR(2026-10-10 배포 후보 `88d917c`, 바이트코드 HAR SHA-256 `7d5deedb…`)부터 클라이언트는 서버가 0.13.0부터 제공하는 `/api` 접두사로만 요청을 보냅니다(D10, `/v2`로 폴백하지 않음). 경로, 메서드, 별칭, 응답 헤더 이름은 manifest revision 7에서 생성된 `ApiContractGenerated` / `ApiOps`에서 나오고, 세션 패밀리는 요청 헤더 `tansr-session-family: sdk1 | sdk2-offload-v1`로 전달합니다. 400 이상의 오류 본문은 통합 봉투이며 통합 코드 + `retryAction`으로 판정합니다(D19). 2xx와 이벤트 스트림에 통합 응답 헤더가 없으면 명시적으로 실패하고 폴백하지 않습니다(D38). 0.1.0 HAR은 여전히 `/v2`에 직접 연결합니다 — 서버의 `/v2`는 0.13.0부터 내부 어댑터 입구에 불과하며 1.0.0에서 외부 입구가 제거되므로 0.2.0으로 업그레이드하십시오. 일정은 [배포와 인증](/ko/serve/deploy-and-auth/)을 참조하십시오.

Android 호환 구형 HarmonyOS 기기는 계속 [Android SDK](/ko/android/)를 사용합니다. HarmonyOS 5.x 네이티브 호환은 후속 작업이며 현재 사용 가능하다고 주장하지 않습니다. 현재 산출물은 독립 배포된 버전 지정 release 바이트코드 HAR이며 아직 공개 OHPM에 등록되지 않았습니다. 서명 설치와 실기기 매트릭스는 이 문서의 범위 밖입니다(0.2.0 배포 영수증에는 서명된 HAP 없음, 실기기 실행 없음으로 등재). 연동 단계는 [HarmonyOS SDK 5분 만에 실행하기](/ko/getting-started/harmony/)를 참조하십시오.

## 휴대폰은 사용자 메시지를 보내고, 서버가 시스템 프롬프트를 설정한다

`createSession`과 `session.send(...)`는 모두 일반 사용자 메시지를 보냅니다. HarmonyOS SDK는 `/api` 세션 요청으로 `system`을 전달하지 않습니다. 공유 역할은 플랫폼 앱 설정에서 관리하고, 코드로 맞춤화하는 역할은 serve의 `platform.system`이 제공하며, 호스트 설명은 `platform.systemAppend`를 사용합니다.

프롬프트와 정책 기능은 `@tansr/serve` 0.8.0부터 사용할 수 있으며 플랫폼 쪽은 2026-09-14에 프로덕션에 배포되었습니다. 기본 `fallback`에서는 SDK가 명시한 `system`(빈 배열 포함)이 플랫폼 세그먼트를 대체하고, `prepend`에서는 플랫폼 세그먼트를 앞에 유지합니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 갱신되며 실행 중인 턴은 고정됩니다. 포그라운드/백그라운드 재연결, SSE 복구, attach는 원래 세션과 기록을 유지할 수 있습니다. 자세한 내용은 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참조하십시오.

## 공개면

| 내보내기 | 책임 |
|---|---|
| `TansrAgentClient` | 세션 서비스 순수 계약 클라이언트(`/api` 경유): 세션 생성/메타 정보/기록/메시지 전송/같은 턴 입력/음성 직결. 네트워크 결과가 불확실할 때 변경 요청을 자동으로 다시 보내지 않음 |
| `NativeHttpTransport` | 시스템 RCP 전송. 옵션으로 HTTPS, 루프백 HTTP, 사내망 HTTP, 타임아웃과 응답 상한을 제어. `NativeHttpOptions.certificateAuthorityPem`으로 자체 서비스용 PEM CA 번들을 설정할 수 있음(이 전송의 신뢰 루트만 교체하며 인증서 체인과 호스트 이름은 계속 검증) |
| `AuthProvider` / `RefreshingAuthProvider` / `StaticAuthProvider` | 요청마다 인증 헤더를 가져옴. 갱신 래퍼가 유효 기간, 동시성, 신원 변화를 처리 |
| `AgentSession` | 하나의 이벤트 펌프: `start` / `stop` / `close`, `send` / `sendBlocks`, 브리지 런타임 |
| `SessionView` | 순수 이벤트 환원. JSON 스냅샷은 Android / iOS 골든 픽스처와 같은 형태 |
| `SpeechPlan` | 낭독 사전 점검: 플랫폼 가중 상한과 공급자 원자 `inputLimit`의 두 상한. 명시적 동의 후 분할 |
| `historyArtifactData` / `isRenderableArtifact` | 기록 도구 산출물 투영. 손상된 미디어 미리보기는 도구 원래의 성공/실패를 바꾸지 않음 |
| `API_CONTRACT` / `API_MANIFEST_REVISION` / `UnifiedCode` / `UnifiedRetryAction` | `/api` 계약 생성물: 접두사, 헤더 이름, manifest revision과 19개 통합 코드 / 6가지 재시도 동작. 81개 작업의 경로 템플릿은 SDK 내부에서 매니페스트로부터 생성되며 호스트가 `/v2` 같은 옛 경로를 손으로 조립하지 않음 |
| `AgentError` / `ApiFacadeError` / `ApiContractError` | 통합 오류: SDK1의 `AgentError`는 `unified` / `retryAction` / `domainCode`로 통합 봉투를 복원. SDK 2.0과 터미널 서비스 면은 `ApiFacadeError`를 바로 던짐(`Sdk2HttpError`는 사용 중단 표시, 한 버전 유지). 응답 헤더 게이트/봉투 게이트 위반은 `ApiContractError`(`contract_unavailable`) |
| `ApiCallOptions` | 요청 헤더 세 개 `Idempotency-Key` / `If-Match` / `deadline`. 형식이 맞지 않으면 보내기 전에 로컬에서 거부 |
| `Sdk2Client` / `Sdk2Executor` / `NativeSdk2Transport` / `Sdk2ClientToolAdapter` | SDK 2.0 얇은 클라이언트와 명시적 전송 입구. 단말은 명시적으로 승인된 기기 작업만 실행 |
| `openSdk2RdbArchiveReceiver` / `openSdk2EncryptedRdbArchiveReceiver` / `openSdk2RdbExecutionJournal` / `Sdk2ArchiveSyncClient` / `openSdk2RdbArchiveCache` / `Sdk2ReplicatedArchiveReceiver` | 로컬 RDB 아카이브 수신기(본문 암호화 선택, 키는 HUKS가 보관), RDB 내구성 실행 저널, 아카이브 동기화와 복제본 수신기 |
| `TerminalClient` | 터미널 서비스 클라이언트(설정/메모리 명령), `/api/terminal/*` 경유 |

0.2.0 HAR의 공개 내보내기는 모두 116개이며 위는 연동 시 직접 마주치는 부분입니다. SDK에는 외부 런타임 의존성이 없습니다. 호스트 HAP은 `ohos.permission.INTERNET`을 선언해야 합니다.

## 이벤트 환원

```typescript
session.onFrame = (eventName, data, seq) => { /* 原始 SSE 帧 */ };
session.onHistory = (history) => view.restoreHistory(history.messages);
view.onChange = () => render(view.state);
session.onState = (state) => { /* idle / connecting / live / retrying / recovering / failed / closed */ };
```

- 알 수 없는 업무 이벤트 타입은 `SessionView`가 무시하며 스트림을 끊지 않습니다. `server.*` 제어 프레임은 `session.bridges`가 소비하므로 일반 `tool.permission.*`으로 승인을 다시 띄우지 마십시오.
- `SessionView(textMode, thinkingMode)`: 텍스트는 `stream` / `final`, 사고에는 `off`도 있습니다. 이는 UI 투영이며 모델 생성 매개변수를 바꾸지 않습니다.
- 도구 카드 산출물은 `historyArtifactData()`로 형태에 따라 꺼냅니다. 서명된 미디어 URL은 보이는 메시지 층에서만 숨겨지며 핵심 기록과 로딩용 원본 영수증은 그대로 유지됩니다.

## 연결 상태와 3단계 복구

```text
idle → connecting → live
live → retrying（指数退避）→ live          // L1:携游标重连,收帧按 seq 去重
live → recovering（拉 /history 重建）→ live // L2:重连首帧收到 gap
404 或 live = false → resume 重灌            // L3:弃旧游标,以 history.lastSeq 为锚
```

`lastSeq`는 항상 값 그대로 이어지고 휴면 판정은 항상 `live = false`이며 결코 `lastSeq == 0`이 아닙니다. `@tansr/serve` 0.9.0부터 휴면 세션 메타 정보의 `lastSeq`는 저장소에 영속화된 실제 수위입니다. `live = true`이면서 `lastSeq == 0`이면 L2만 거치고 resume은 하지 않습니다.

`AgentSession`의 세 번째 인수 `verifiedEndUserId`가 있으면 메타 정보 또는 resume 후 신원이 일치하지 않을 때 실패하며 몰래 세션을 바꾸지 않습니다. sessionId / turnId / inputId / historyEpoch는 불투명 식별자입니다. 구간별로 인코딩하며 trim, 대소문자 접기, Unicode 정규화를 하지 않습니다.

401 또는 프로토콜 오류는 `failed`로 들어가고 펌프가 멈춥니다. 호스트가 로그인 상태를 고친 뒤 명시적으로 `start()`해야 합니다. `stop()` 후 상태는 `idle`로 돌아가며 세션은 끝나지 않았습니다. `close()`만 원격을 DELETE합니다.

## 생명주기

| 입구 | 의미 |
|---|---|
| `start()` | 로컬 구독을 시작하거나 재개. 멱등 |
| `stop()` | 로컬 구독과 브리지를 취소하되 원격 세션은 잃지 않음 |
| `close()` | 먼저 `stop`, 다음에 원격 세션 종료를 요청. 실패는 그대로 돌려주며 종료됨으로 위장하지 않음 |

백그라운드로 가면 펌프를 멈추고 포그라운드로 돌아오면 다시 `start()`합니다. 컴포넌트 해제와 로그아웃은 반드시 이 입구들을 호출해야 합니다. 로컬 구독을 멈춰도 서버 기록이 자동으로 DELETE되지 않습니다. 새 세션: `createSession`이 ID를 확정하면 먼저 원래 인증 범위에 영속화한 뒤 UI에 바인딩합니다. 저장 실패 시 자동으로 다시 만들어서는 안 됩니다. 복구 실패 시 원래 기준점을 유지합니다.

엄격한 같은 턴 추가는 먼저 `inputCapabilities()`의 현재 target을 가져온 뒤 `InputSubmission`을 만듭니다. 첫 POST 전에 원래 ID, target, 본문을 영속화합니다. 미확인 상태는 원래 식별자로만 조회하며 자동 재전송, ID 변경, messages로 강등, interrupt를 하지 않습니다. `accepted`는 영속화됨도 답변됨도 아닙니다.

## 로컬 도구와 두 개의 브리지

```typescript
session.bridges.registerTool(declaration, handler);
session.bridges.onPermission = (request) => {
  // 展示 request.payload 后:
  session.bridges.answerPermission(request.id, 'allow'); // 或 'deny'
};
session.bridges.onQuestion = (request) => { /* answerQuestion */ };
```

- 생성/resume 시 넘기는 `clientTools`는 실제로 등록한 처리기와 일치해야 합니다.
- `parameters`는 매개변수 이름 사전이며 매개변수가 없으면 `{}`입니다. 읽기 전용 선언으로 서버 판정을 우회할 수 없습니다. 처리기는 `CancelToken`을 관찰해야 합니다.
- `onPermission`을 설정하지 않으면 기본 거부입니다. 만료된 요청은 승인할 수 없습니다. 일반 `tool.permission.*`은 관찰용일 뿐입니다.
- 질문과 권한은 다른 브리지 계열입니다. 텍스트 보충이나 질문 답변은 도구 승인이 아닙니다.
- 클라이언트는 모든 도구에 ask를 강제하지 않습니다. 자동 allow, 실제 ask, deny는 serve가 커널 판정을 재사용해 결정합니다.

## 공개 네트워크 도구: 서버에서 실행

앱이 콘솔에서 `tools.webFetch`, `tools.http`(`@tansr/serve` 0.12.0 이상 필요) 또는 `tools.webSearch`를 켜면 에이전트는 웹 페이지 읽기, HTTP 요청 보내기, 웹 검색을 할 수 있습니다. 이 도구들은 모두 여러분의 세션 서비스 호스트에서 실행됩니다. HAR이 기기에서 대신 네트워크 요청을 보내지 않으며 도구를 자동으로 승인하지도 않습니다. 기능 플래그 변경은 새로 만든 세션 또는 저장소에서 다시 조립된 세션에 적용되며 실행 중인 세션에서 도구가 자동으로 늘거나 줄지 않습니다.

- 예제 앱의 도구 페이지는 WebSearch, WebFetch, Http GET 공개 네트워크 예제를 제공합니다. 선택하면 입력 초안에만 채워지고 사용자가 확인한 뒤 보냅니다. 서버가 승인을 요청하면 채팅 페이지 상단에 "확인 대기 요청" 입구가 고정 표시됩니다.
- HTTP 상태, 네트워크 오류, 가져오기 실패는 도구의 실제 결과에 따라 해석합니다. 검색 결과가 비어 있다고 사이트가 없는 것은 아니며, 알려진 도메인은 WebFetch에게 명시적으로 읽게 할 수 있습니다.
- 기능 스위치, 실행 경계, 호스트 간 리디렉션 승인 규칙은 [모바일 앱용 공개 네트워크 도구](/ko/sdk/platform-bundle/#移动应用的公网工具)를 참조하십시오.

SDK 2.0은 서버 쪽에서 `@tansr/serve` 0.13.0 / 0.14.0과 함께 배포되었습니다(`@tansr/serve/extensions`의 명시적 호스트와 `/api` 통합 호출면). HarmonyOS 쪽에서는 0.2.0 HAR부터 명시적 전송 입구 `NativeSdk2Transport`, 얇은 클라이언트 `Sdk2Client` / `Sdk2Executor`, 로컬 RDB 아카이브 수신기(`openSdk2RdbArchiveReceiver`, 본문 암호화 선택 `openSdk2EncryptedRdbArchiveReceiver`, 키는 HUKS가 보관), RDB 내구성 실행 저널 `openSdk2RdbExecutionJournal`, 아카이브 동기화 `Sdk2ArchiveSyncClient`와 복제본 수신기, 그리고 터미널 서비스 클라이언트 `TerminalClient`가 패키지에 포함됩니다. 이는 추가적인 기능이며 명시적으로 조립하지 않으면 동기화 저장소를 만들지 않고 SDK 2.0 요청도 보내지 않으며 SDK1 세션 동작은 변하지 않습니다. 실기기 검수는 배포 영수증 범위 밖입니다. 2026-10-10 배포 후보 이후 메인라인에 들어간 암호화 메모리 게시, 원본 보존 마이그레이션 키 교체, 암호화 증분 RDB 프로파일, 읽기 전용 복제본 등의 영속화 기능은 **아직 어떤 HAR 버전으로도 배포되지 않았으며** 이 페이지에서는 설명하지 않습니다. 조립과 경계는 [SDK 2.0 확장 입구](/ko/sdk/sdk2-preview/)를 참조하십시오.

## 음성: 두 갈래 체인

음성은 프로토콜 수준의 입력 종류가 아닙니다(메시지 블록에도 이벤트 스트림에도 들어가지 않음).

1. **도구 체인**: 에이전트가 스스로 `SpeechToText` / `TextToSpeech`를 호출하고, 산출물은 도구 완료 이벤트로 단말에 도달하며 기록 투영을 거쳐 렌더링됩니다.
2. **직결 체인**(여러분 자신의 음성 UX):

```typescript
const transcript = await client.audioTranscribe(session.sessionId, 'audio/mp4', base64, undefined, cancel, 'zh');
const speech = await client.audioSpeech(session.sessionId, assistantText, undefined, undefined, cancel, 'wav');
```

`audioSpeech`의 `format`은 `wav` / `mp3`만 받으며 넘기지 않으면 요청 필드를 생략합니다. `audioTranscribe`의 `language`는 2–16개의 UTF-16 코드 단위이며 그대로 전달됩니다. 두 항목 모두 `CancelToken` 뒤에 추가되어 기존 호출은 조정할 필요가 없습니다. 매개변수가 유효하지 않으면 SDK는 인증과 요청 전송 전에 `validation_failed`를 반환합니다. 형식 채택 여부는 여전히 플랫폼과 선택한 모델이 결정하며 요청 형식에 맞춰 영수증 MIME을 고쳐 써서는 안 됩니다. 합성 영수증의 실제 음성 필드만이 다운로드, 재생, 계량의 근거입니다.

네이티브 녹음(M4A/AAC, MIME `audio/mp4`)은 호스트 배선입니다. STT 제약 `formats`는 `m4a`를 명시적으로 포함해야 하며 `maxSeconds`는 유효하고 최소 1초여야 합니다. 전사는 초안에만 채우고 자동으로 보내지 않습니다. 취소, 세션 전환, 백그라운드 전환 후 늦게 도착한 결과를 잘못된 곳에 써서는 안 됩니다. HAR은 마이크를 자동으로 요청하지 않습니다.

낭독은 `SpeechPlan.prepare()`로 미리 보며 플랫폼 가중 상한과 공급자 원자 `inputLimit`을 동시에 지킵니다. 긴 글은 명시적으로 분할에 동의해야 하며 각 구간 제출 전에 승인 상한을 다시 확인합니다. 분할은 Unicode 코드 포인트 경계를 따릅니다. 완료된 구간은 캐시하여 재생하고, 결과가 미확인인 구간은 uncertain으로 표시하고 멈추며 자동으로 다시 생성하지 않습니다. `SpeechPlan.reset(index)`는 확인되었거나 uncertain인 구간 하나만 재설정하며 구간당 최대 3회이고 요청을 보내지 않습니다. 호스트는 먼저 실제 합성 Promise가 끝났음을 확인하고 사용량을 대조하며 명확한 재설정 의사를 얻어야 합니다. 분할이 허용될 때 첫 구간 120, 이후 360 가중 문자는 Android와 일치하는 지연 시간 소프트 목표이며, 항상 하드 상한 — 구간당 20000 UTF-16 코드 단위, 전문 32000 가중 문자, 최대 32 구간 — 을 따릅니다.

## 미디어와 관측

미디어 승인은 `media.capabilities` / `media.models`의 `imageGen`, `videoGen`, `speechToText`, `textToSpeech`로 읽으며 `image` / `video`로 쓰고 미승인으로 오판해서는 안 됩니다. 이미지 입력은 IR `text` + `image` 블록입니다. 주 모델의 네이티브 audio/video 입력 블록은 아직 제공되지 않습니다. 이미지와 동영상 생성은 서버의 시스템 도구가 실행합니다.

네이티브 미디어 다운로드는 독립된 `downloadMedia()`를 사용합니다. HTTPS, 인증 헤더 없음, 리디렉션을 따르지 않음. 기본 16 MiB이며 기존 산출물은 명시적으로 128 MiB까지 설정할 수 있습니다. 타임아웃, 만료, 취소, 잘못된 형식 어느 것도 자동 유료 재생성을 일으켜서는 안 됩니다. 큰 미디어는 서비스가 접근 가능한 URL을 제공해야 하며 휴대폰 버퍼를 무한정 키워 우회해서는 안 됩니다.

`meta()`는 서버의 실제 모델, 컨텍스트와 선택적 미디어 관측을 읽습니다. 누락된 값은 "알 수 없음"으로 유지합니다. 현재 wire에는 세션 안에서 모델을 바꾸는 HTTP가 없습니다. `selected`, `active`, `lastObserved`는 서로 다른 사실입니다. 과금 사용량에서 창 점유를 역산할 수 없습니다. 공급자 KV 캐시는 로컬 세션/음성 캐시와 다르며 적중률을 위해 유료 keep-alive 요청을 보내서는 안 됩니다.

## 자격 증명과 로그 규율

- 기기 자격 증명 = 여러분의 로그인 상태. SDK는 `AuthProvider`를 통해 요청마다 가져올 뿐 Preferences / 파일/로그에 결코 영속화하지 않습니다.
- appkey는 SDK / 예제 코드 면에 애초에 개념으로 존재하지 않으며 `app_user` 토큰은 결코 기기에 배포되지 않습니다.
- 티켓 교체 단일 비행, 송신 헤더 스냅샷, 신원과 세대 검증: 옛 티켓의 401이 늦게 도착해도 강제 재발급을 반복해서는 안 되며, 취소와 사용자 전환 후 도착한 응답이 무엇인가를 되살려서는 안 됩니다.
- 도구 응답도 도구 선언도 신뢰할 수 없는 입력입니다. 기기는 역공학으로 개조될 수 있으므로 "자사 앱이니까"라며 경계를 늦추지 마십시오.

## 단말 측 자원 경계

| 항목 | 현재 기본값 |
|---|---|
| SSE 프레임 버퍼 | 16 Mi UTF-16 문자. `AgentSession` 다섯 번째 인수로 조정 가능, 최대 32 Mi. 상한 초과 시 멈추고 프로토콜 오류 보고 |
| JSON | 32 Mi 문자, 64단계. 중복 키, 비유한 수치, 잘못된 구조 거부 |
| 네이티브 일반 응답 | 32 MiB. 오류 본문 64 KiB |
| 미디어 다운로드 | 기본 16 MiB, 명시적으로 128 MiB까지 |
| 뷰 로컬 상태 | 알림 20건, 도구 출력 꼬리 4000 UTF-16 문자. 채팅 기록을 자동으로 자르지 않음 |

이는 단말 측 자원 경계이지 모든 업스트림 미디어의 최댓값이 아닙니다. 업스트림에서 정당한 인라인 Base64가 이 상한을 넘을 수 있으며, 그때는 명시적으로 스트림을 멈추거나 거부하고 수신 성공을 주장하지 않습니다. `SessionView`는 세션 메시지의 완전한 투영을 유지하며 초장기 세션의 목록 가상화는 호스트 책임입니다.

## 연동 테스트와 빌드

- 저장소 안의 `examples/serve-demo`에 연결하기: `pnpm start` / `pnpm real`은 모두 실제 모델 입구이며 상주 연동 테스트는 `DEMO_SERVE_ONLY=1`, `DEMO_PORT=8788`로 기동합니다(소스 기본 포트는 8799, 공개된 echo 기동 명령은 더 이상 없음). 독립된 개발자 로그인 서비스 `pnpm login`의 기본값은 `127.0.0.1:8787`. Demo의 `DeveloperLogin`은 호스트 어댑터이지 HAR 내장 로그인이 아닙니다. 먼저 여러분의 로그인 서비스에 `POST /login`으로 단기 티켓을 받고(`POST /refresh`로 연장), 그 티켓으로 serve의 `/api`에 접근합니다. 맞춤 로그인 프로토콜은 이 어댑터를 교체할 뿐 SDK의 세션 귀속은 바꾸지 않습니다.
- 평문 http는 루프백 또는 명시적 사내망에서만. 프로덕션은 항상 TLS를 사용합니다(자체 CA는 `NativeHttpOptions.certificateAuthorityPem`으로 설정하며 인증서 오류를 무시하지 않음).
- SDK 저장소 게이트: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:contract`. 네이티브: `./scripts/native.ps1 -Action lint` / `har` / `hap` / `test-hap`(툴체인 DevEco Studio 6.0.2 / HarmonyOS SDK API 22).
- 예제 HAP은 채팅, 연결, 상세, 미디어, 도구 다섯 가지 내비게이션을 보여 주며 SDK가 보장하는 UI 계약이 아닙니다. 공개 다운로드 `harmony-demo.zip`의 `libs/`에는 같은 0.2.0 HAR과 `SHA256SUMS`가 동봉되어 있습니다.
