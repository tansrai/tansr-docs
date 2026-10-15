---
title: 플랫폼 어셈블리와 번들
description: 토큰 방식으로 내려오는 것——앱 설정 번들 속 모델 카탈로그, 기능 플래그, 미디어 인가 집합, 플랜 투영. 도구 3링은 어떻게 고르는지, 기능 플래그가 꺼져 있으면 무슨 일이 일어나는지, onPlatformWarning은 무엇을 알리는지.
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - getting-started/sdk
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

토큰 방식의 핵심 약속은 **로컬 설정 0**입니다. 모델 카탈로그, 기능 플래그, 미디어 인가 집합, 플랜 상태는 모두 플랫폼에서 "앱"별로 하나의 번들에 설정되고, SDK는 토큰으로 이를 읽어 어셈블리 시점에 다듬습니다. 필드마다 적용 경계가 다릅니다. 앱 프롬프트와 정책은 각 턴 시작 전에 확인되지만, 그로부터 다른 설정도 같은 세션 안에서 핫 업데이트된다고 추론해서는 안 됩니다. 이 페이지는 번들에 무엇이 들어 있는지, 도구를 어떻게 고르는지, 플래그가 꺼져 있으면 무슨 일이 일어나는지를 다룹니다. 버전 기준은 `@tansr/sdk` 0.19.0 / `@tansr/serve` 0.15.1(모두 2026-10-10 공개)입니다.

## 앱 시스템 프롬프트도 어셈블리 설정이다

`systemPrompt` / `systemPromptPolicy`는 앱 설정에서 번들로 들어옵니다(`@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0부터 제공, 플랫폼 쪽은 2026-09-14에 프로덕션 공개). 기본값 `fallback`은 SDK가 `system`을 넘기지 않을 때 플랫폼 세그먼트를 쓰고, `prepend`는 SDK가 명시적으로 `[]`를 넘겨도 플랫폼 세그먼트를 유지한 뒤 SDK의 비어 있지 않은 업무 세그먼트를 잇습니다. 호스트의 `systemAppend`는 선택된 업무 세그먼트 뒤에 오며 결코 이를 덮어쓰지 않습니다. 그다음에야 이 진입점에서 실제로 어셈블리된 도구, Skills, MCP 가이드가 옵니다.

두 항목 모두 다음 새 턴 전에 갱신되며 실행 중인 턴은 선택된 설정을 유지합니다. 기록은 지워지지 않고 세션을 다시 열 필요도 없습니다. `session.applicationPrompt`는 본문 없이 읽기 전용 source / policy 요약을 노출합니다. 전체 표, 관리 API, 충돌 처리 경계는 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참고하세요.

## 먼저 콘솔에서 알맞은 앱 유형을 만들 것

앱을 만들 때 플랫폼 유형을 고릅니다. 이는 "기능과 할당량" 페이지에서 어떤 플래그와 기본 프로필을 설정할 수 있는지를 정하고, 번들에서는 `app.platform`으로 내려옵니다:

| 유형 | 용도 | 기능 표면 |
|---|---|---|
| 데스크톱 앱 | Electron 등, SDK 프로세스 내 형태 | 모든 도구 플래그와 플랫폼 플래그 설정 가능 |
| 모바일 앱 | Android / iOS / HarmonyOS, 여러분의 `@tansr/serve` 세션 서비스 경유 | 파일 / 명령 계열은 고정 꺼짐. 공용망 도구 WebFetch / Http / WebSearch는 플래그별로 활성화, 기본값 꺼짐(아래 [모바일 앱의 공용망 도구](#모바일-앱의-공용망-도구) 참고) |
| 서버 앱 | 이 SDK를 내장한 Node 백엔드 | 데스크톱과 같은 기능 표면 |

**모바일 앱**의 자격 증명을 이 SDK 프로세스 안에서 어셈블리해도 실패하지는 않지만, 파일 계열 같은 플래그는 토폴로지에 따라 이미 꺼짐으로 정규화되어 있고 플랫폼 알림 프레임 `app_platform_mismatch`를 받게 됩니다. 통합 형태마다 앱을 하나씩 만드세요. 앱 하나에 플랫폼 하나, 여러 클라이언트에는 여러 appid——폐기 표면도 사용량 귀속도 따로입니다.

모바일 앱은 추가로 플랫폼의 `PATCH /v1/apps/:id`(`x-tansr-client-features: bound-device-v1` 동반)로 `execution: { version: 'bound-device-v1', boundDevice: { tools } }` 절을 설정해, 바인딩된 기기의 도구를 세션 서비스의 SDK 2.0 명시 실행 프로필에 부여할 수 있습니다. `@tansr/sdk` 0.18.0부터 `AppCapabilitiesSchema`는 이 절을 인식하고 그대로 보존하지만 **프로세스 내 SDK는 이를 소비하지 않습니다**. 기기 도구 인가는 `@tansr/serve`의 SDK2 실행 프로필에서만 적용되고, 옛 앱 유형과 옛 `tools` 플래그는 기기 인가를 의미하지 않으며, 플래그 부재 = 미인가이고, 프로세스 내 `tools`로 합쳐지는 일은 결코 없습니다. [SDK 2.0 확장 진입점](/ko/sdk/sdk2-preview/)을 참고하세요.

## 도구 3링: 하나의 `tools` 진입점

```ts
await createSession({
  token, baseUrl,
  tools: {
    builtin: ['read', 'glob', 'grep', 'imageGen'], // 环 2:内置工具(本地工具跑在终端用户机器)
    custom:  [searchOrders],                        // 环 1:defineTool 业务函数(你的代码)
  },
});
```

- `tools`가 아예 없음 = 기능 플래그가 허용하는 **모든 로컬** 내장 도구를 어셈블리합니다(미디어 이름 넷은 기본 전체 집합에 결코 들어가지 않음).
- `tools: { builtin: [] }` = 내장 0개. 노출이 가장 작은 순수 사용자 정의 도구 시나리오입니다.
- `builtin` 어휘는 이름 16개입니다: `read` `write` `edit` `glob` `grep` `list` `shell` `todoWrite` `askUser` `webFetch` `webSearch` `http`와 미디어 이름 넷 `imageGen` `videoGen` `speechToText` `textToSpeech`.
- 어휘 밖 이름 → `invalid_options`. 플래그가 꺼져 있는데 명시적으로 선택 → `capability_disabled`, 메시지에 콘솔 복구 안내 포함. **항상 읽을 수 있는 오류로 즉시 실패하며, 조용히 도구가 빠지는 일은 없습니다.**
- 미디어 이름 넷은 과금 도구이며 그 정의는 매 프롬프트마다 토큰을 씁니다. **기본 전체 집합은 결코 이를 어셈블리하지 않습니다**——쓰려면 `builtin`에 명시적으로 나열하세요.
- `tools.platform`은 호환성 별칭으로 남아 있습니다(사용 중단). `builtin`의 같은 값 넷과 동등하며, 별칭이 있으면 어셈블리마다 구조화 경고 `tools_platform_deprecated`가 1건 나옵니다. 새 코드는 `builtin`을 쓰세요.

미디어 도구 넷 자체는 커널 시스템 도구이며, 플랫폼은 인가 모델, 자격 증명, 계량을 담당합니다. 기능 필드 이름은 여전히 `capabilities.platform`이지만 그것은 인가 플래그의 이름일 뿐 "플랫폼 도구"라는 별도 부류가 있다는 뜻이 아닙니다. 도구 산출물(이미지 / 비디오 / 전사 / 음성 카드)이 있다고 해서 네이티브 실시간 오디오 · 비디오 메시지를 지원하는 것도 아닙니다. `sendBlocks`는 텍스트와 이미지만 받고, 네이티브 `audio` / `video` 블록은 기록에 쓰이고 모델에 보내지기 전에 `invalid_blocks`를 반환합니다. 녹음 전사와 읽어 주기 버튼은 별도의 직접 오디오 인터페이스를 거칩니다.

1링의 `defineTool`은 "등록이 곧 설명서"입니다. 선언 하나에서 모델이 보는 스키마와 사람이 읽는 문서가 함께 나오며, JSON 매개변수 표와 zod 두 형태가 있습니다. 외부 MCP에는 `createMcpHost({ servers })`(앱 수준 공유) 또는 `mcp: { servers }`(세션 수준)를 쓰며, 설정은 업계 표준 `mcpServers`와 같은 형태입니다. Skills는 `defineSkill`로 인라인 로드하거나 `dirs` 디렉터리에서 로드하며, 사용자 디렉터리는 결코 스캔하지 않습니다.

## 기능 플래그: 도구 플래그와 플랫폼 플래그

기능 플래그는 "이 앱에 이 기능이 있는가"에 답합니다. 콘솔에서 앱별로 설정되고, 번들로 내려오며, SDK가 어셈블리 시점에 다듬고(계약 표면), 게이트웨이가 하드 체크합니다(플랫폼 리소스의 강제 표면). **토큰 방식에서 기능 플래그는 항상 번들에서 옵니다**. 옵션으로 `capabilities`를 넘기면 거부됩니다. 관리형 / 주입 방식은 `capabilities`를 넘겨 직접 관리할 수 있습니다.

플랫폼의 기본 프로필(보수적):

| 플래그 | 기본값 | | 플래그 | 기본값 |
|---|---|---|---|---|
| `tools.read` | 켜짐 | | `tools.http` | 꺼짐 |
| `tools.write` | **꺼짐** | | `tools.todoWrite` | 켜짐 |
| `tools.edit` | **꺼짐** | | `tools.askUser` | 켜짐 |
| `tools.glob` | 켜짐 | | `tools.agent`(Task 하위 에이전트 계열) | 꺼짐 |
| `tools.grep` | 켜짐 | | `tools.skills` | 꺼짐 |
| `tools.list` | 켜짐 | | `tools.mcp` | 꺼짐 |
| `tools.shell` | **꺼짐** | | `tools.customTools`(1링 마스터 스위치) | 켜짐 |
| `tools.process`(예약) | 꺼짐 | | `platform.imageGen` | 꺼짐 |
| `tools.webFetch` | 꺼짐 | | `platform.videoGen` | 꺼짐 |
| `tools.webSearch` | 꺼짐 | | `platform.webSearch` | 꺼짐 |

플랫폼 플래그에는 `platform.speechToText` / `platform.textToSpeech`(기본값 꺼짐)도 있으며, 이 다섯이 채팅 세션이 소비하는 플랫폼 플래그입니다. `@tansr/sdk` 0.19.0부터 `AppCapabilitiesSchema`는 선택적 플랫폼 플래그 여섯 개 `platform.embedding` / `rerank` / `document` / `music` / `voiceCreate` / `realtimeAudio`를 더 인식해 모두 열한 개가 됩니다. 이들은 대응하는 독립 비채팅 HTTP 작업(`createPlatformNonchatClient`로 명시적으로 호출)만 인가하며 **채팅 도구를 전혀 어셈블리하지 않고 세션에 들어가지도 않습니다**. 번들에 없으면 `false`와 같고(`DEFAULT_APP_CAPABILITIES.platform`은 여전히 앞의 다섯만 나열), 소비 쪽은 `=== true`만 켜짐으로 간주해야 합니다. 이 여섯은 `x-tansr-client-features`의 새 `nonchat-operations-v1`로 협상 · 전달되며, `CLIENT_FEATURES` 어휘의 변화 때문에 업그레이드 후 첫 어셈블리에서는 옛 캐시를 맞히지 않고 번들을 다시 가져옵니다. `CAPABILITY_TOOL_KEYS` / `CAPABILITY_PLATFORM_KEYS`가 공식 출처입니다. `tools.agent`가 켜져 있으면 Task 하위 에이전트 계열은 자동으로 어셈블리되고, 하위 에이전트는 세션의 모델과 권한 게이트를 물려받습니다.

## webSearch에 왜 플래그가 둘인가

웹 검색은 표 전체에서 유일하게 두 평면 모두에 플래그를 차지하는 기능입니다. 두 플래그는 두 도구가 아니라 **같은 도구의 두 게이트**입니다:

- `tools.webSearch`(거버넌스 평면): WebSearch 도구가 이 앱의 세션 어셈블리 어휘에 나타나도 되는가.
- `platform.webSearch`(채널 평면): 플랫폼의 과금 검색 채널이 이 앱에 대해 켜져 있는가.

이유는 webSearch 도구 자체는 2링(CLI와 같은 `WebSearch`)에 있으면서 백엔드는 항상 플랫폼 채널이기 때문입니다——SDK 형태에는 자체 검색 엔드포인트를 가져오는 길이 없고, 클라이언트가 검색 공급자의 키를 쥐고 있는 것이야말로 앱 키 도난 방지 모델이 없애려는 안티패턴입니다. 어셈블리 행렬을 한 문장으로: **암묵적 선택 = 있는 것을 쓰고 플래그에 따라 조용히 줄어듦. 명시적 선택 = 성립해야 하는 주장으로, 성립하지 않으면 읽을 수 있고 귀속이 분명한 오류로 즉시 실패**(`capability_disabled` 또는 `invalid_options`).

<a id="移动应用的公网工具"></a>

## 모바일 앱의 공용망 도구

모바일 앱의 세션은 여러분의 `@tansr/serve`에서 어셈블리됩니다(호스팅 토폴로지). 이런 앱이 체크할 수 있는 도구 플래그는 `todoWrite`, `askUser`, `customTools`, `webFetch`, `http`, `webSearch`와 플랫폼 플래그뿐이고, 파일과 명령 같은 로컬 계열은 고정 꺼짐입니다. `customTools`는 `clientTools` 원격 도구 채널로 선언하고 휴대폰이 실행합니다.

- **버전**: `tools.webFetch`(웹 페이지 가져오기, WebFetch)와 `tools.http`(HTTP 요청, Http)는 `@tansr/serve` 0.12.0 / `@tansr/sdk` 0.17.0부터(2026-09-16 공개. 현행 0.15.1 / 0.19.0에도 똑같이 적용) 어셈블리되며, serve 0.11.0 이하는 모바일 앱에 이 둘을 어셈블리하지 않습니다. 두 플래그 모두 기본값 꺼짐이며 콘솔에서 앱에 대해 명시적으로 켜야 합니다. `tools.webSearch`는 추가로 `platform.webSearch` 채널을 켜야 합니다(앞 절 참고).
- **어디서 실행되는가**: 세 도구 모두 **여러분의 세션 서비스 호스트**에서 실행되며 같은 코어 도구와 권한 체인을 거칩니다. Android / iOS / HarmonyOS SDK는 휴대폰에서 대신 네트워크 요청을 보내지 않고 자동 승인하지도 않습니다. 서버 쪽에서 명시적으로 설정한 도구 허용 목록은 더 좁힐 수만 있습니다.
- **변경이 언제 적용되는가**: 기능 플래그를 바꾸면 새 세션이나 저장소에서 재어셈블리된 세션만 이를 반영합니다. 토큰 갱신과 프롬프트 새로 고침은 실행 중인 세션의 도구 표를 바꾸지 않습니다. 긴급히 회수하려면 해당 세션을 멈춰야 합니다.
- **실행 경계**: 호스팅된 Http는 호스트 환경 변수 속 자격 증명을 참조할 수 없고, 모델이 스스로 호스트의 사설망 접근 제한을 풀 수도 없습니다. 이그레스 프록시를 설정할 때는 프록시 쪽에서도 사설망 대상을 제한하세요. WebFetch는 기존 이그레스 규칙을 따르며, 호스트를 넘는 리디렉션은 새 권한 확인을 일으킬 수 있습니다——오류에 적힌 공용 대상에 대해 다시 명시적으로 요청하세요. 리디렉션을 자동 승인하지 마세요.
- **결과 읽기**: 알려진 URL에는 먼저 에이전트가 WebFetch를 쓰게 하고, API 응답을 살필 때는 Http를 씁니다. Http의 4xx / 5xx는 살펴봐야 할 응답입니다——도구 완료가 원격 HTTP 호출의 성공을 뜻하지 않습니다. 검색 결과가 비었다는 것은 이 쿼리에 일치가 없었다는 뜻일 뿐 사이트가 없다는 뜻이 아닙니다. UI는 잘림 힌트를 유지해야 합니다.

## 번들은 그 밖에 무엇을 내려 주는가

- **모델 카탈로그**: alias / handle / `displayName` / `manufacturer` / `family`. `setModel`에는 handle을 넘깁니다. `model.modelId`는 선택 필드로 읽는 쪽은 `string | undefined`로 다룹니다. `@tansr/sdk` 0.18.0부터 읽기 전용 투영 `model.adapterDiagnostics?`도 있어(`request` / `billing` 각 절이 `adapterId` / `operation` / `status ∈ 'ready' | 'review' | 'unresolved'`를 가지며 추가로 `conflicts[]`) 현재 카탈로그 근거가 요청 / 과금 어댑터를 고르기에 충분한지를 나타내고, UI에서 모델의 호출 / 계량 능력을 표시하기 위한 것입니다. 공급자 자격 증명, 가격 원문, 실행 가능한 어댑터 객체는 포함하지 않으며, 플랫폼이 보내지 않으면 `undefined`이고, 절의 형태가 잘못되면 진단만 떨어지고 모델 항목은 떨어지지 않습니다.
- **미디어 인가 집합** `platformModels`: 미디어 도구 넷의 설명에는 집합 속 모델 이름이 자동으로 나열되며 순서상 첫 번째가 기본값입니다. 통합 쪽이 모델 이름을 손으로 설정하는 일은 없습니다. 0.19.0부터 토큰 방식에서 직접 호출하는 `session.platform.speak()`의 `SpeakInput`에 선택적 `voiceRef`(앱 전용 음성 리소스의 id. 시스템 `voice`와 배타적이며 범위와 대상 모델은 플랫폼이 검증)가 추가되었습니다. 전용 음성 자체의 생성과 조회는 비채팅 클라이언트로 하며 번들로 내려오지 않습니다.
- **플랜 투영** `plan`: `{ tier, caps{ concurrency, apps, orgMembers, monthlyEndUsers, gatewayLane }, status: 'active' | 'grace' | 'lapsed', expiresAt }`. `null` = 플랜 없는 개인 프로필입니다. 이는 투영일 뿐 강제는 항상 서버 쪽에서 하며, SDK가 로컬에서 한도를 판단하는 일은 없습니다.
- **판정자 프로필** `adjudicator`: 토큰 방식은 기본적으로 콘솔에서 임명한 판정자를 어셈블리하며, 그 자격 `tier`가 "확인"을 어느 반경까지 허용으로 완화해도 되는지를 정합니다.

## onPlatformWarning: 치명적이지 않은 강등은 어떻게 알리는가

번들 해석과 어셈블리의 치명적이지 않은 사실은 `createSession({ onPlatformWarning })` / `onWarning`으로 알리고, 없으면 세션 이벤트 스트림의 `turn.error { scope: 'sdk.notice', recoverable: true }`로 폴백합니다. 콘솔에는 나오지 않고 어셈블리 결과도 바꾸지 않습니다. 흔한 코드:

| 코드 | 의미 |
|---|---|
| `app_platform_mismatch` | 앱 플랫폼 유형이 통합 형태와 맞지 않음 |
| `tools_platform_deprecated` | 옛 `tools.platform` 별칭을 사용함 |
| `capabilities_unparsed` | 번들 `capabilities` 절은 있으나 해석에 실패함(`detail.issues`에 zod issues). **SDK 0.13.0부터 제공**: 이 경우 기본 프로필이 아니라 기능 0 프로필(`tools` 모두 false)로 폴백함. 0.11.x는 기본 프로필로 폴백했음 |
| `adjudicator_unavailable` / `adjudicator_model_unavailable` / `adjudicator_budget_exhausted` / `adjudicator_breaker_tripped` | 판정자 부재 / 모델 사용 불가 / 예산 소진 / 서킷 브레이커 작동 |
| `adjudicator_skipped_by_mode` | 명시적 `permission.mode` 때문에 판정자가 어셈블리되지 않음. **SDK 0.13.0부터 제공**: 명시적 `permission.mode`는 자체 관리 모드를 채택하고 이 알림을 냄. 명시적 `adjudication`과 모드의 동거는 여전히 거부됨. 0.11.x에 있던 기본 판정자와 모드 충돌 제한은 철회됨 |

## 계량과 대조

`cost.usage.updated`는 요청마다 이벤트 스트림에 도달합니다. 최종 사용자는 `GET /v1/my-usage`로 스스로 확인하고(금액 필드는 결코 없음), 개발자는 `GET /v1/app-usage/by-end-user`로 대조합니다(금액 포함, 최종 사용자에게 결코 중계하지 않음). 계량과 과금은 별개입니다——최종 사용자에게 어떻게 재판매할지는 여러분에게 달려 있습니다.

0.19.0부터 SDK는 앱 할당량의 필드 형태 `AppQuotaSchema` / `AppQuota`(`dailyTokens` / `endUserDailyTokens` / `rpm`은 항상 존재하며 null 허용. `tpm`과 `endUserDaily*` / `dailyOperationUnits` 같은 미디어 · 비채팅 작업 횟수는 선택)를 export하여 플랫폼 앱 설정을 읽고 쓸 때의 검증에 쓸 수 있습니다. 할당량은 **번들로 내려오지 않으며** 강제는 항상 플랫폼 쪽입니다. 로컬에 쥔 할당량 값은 남은 양이 아니며, SDK가 그것으로 로컬에서 한도를 판단하지도 않습니다.
