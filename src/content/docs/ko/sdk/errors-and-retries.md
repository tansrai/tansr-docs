---
title: 오류 처리와 재시도
description: SDK의 오류는 세 곳에서 나타납니다——어셈블리 시점의 TansrSdkError, 실행 시점 이벤트 스트림의 turn.error / tool.failed, 그리고 플랫폼 게이트웨이 오류 코드. 이 글은 "어느 종류인지, 재시도할 수 있는지, 얼마나 기다려야 하는지"를 항목별로 정리합니다.
zone: docs
category: sdk
related:
  - errors/codes
  - sdk/sessions-and-events
  - sdk/checkpoints
  - support/troubleshooting
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

SDK는 결코 `process.exit`하지 않습니다. 오류는 세 출구에서만 나옵니다. 어셈블리 시점 / 옵션 시점에는 `TansrSdkError`로 throw되고, 실행 시점의 모델과 도구 오류는 항상 이벤트 스트림으로 표현되며(`turn.error` / `tool.failed` / `turn.aborted`), 플랫폼 게이트웨이의 오류 코드는 이 둘의 페이로드 안에 들어 있습니다. 먼저 어느 종류인지 가린 뒤 재시도 여부를 정하세요.

## 첫째 종류: TansrSdkError(어셈블리 시점 / 옵션 시점)

이들은 모두 동기적으로, 또는 첫 `next()` / `await createSession()` 시점에 throw되는 프로그래밍 오류나 환경 오류로 **재시도해도 소용없습니다**. 메시지를 읽고 코드나 환경을 고치세요:

| code | 시점 | 의미와 대처 |
|---|---|---|
| `invalid_options` | 동기 | 옵션 조합이 잘못됨(세 방식의 필드 혼용 / 어휘 밖 도구 이름 / 토큰 방식에 로컬 설정 동반 / 명시적 `adjudication`과 `permission.mode` 동거). 메시지를 읽고 코드를 고침 |
| `assembly_failed` | 어셈블리 시점 | 관리형 / 토큰 방식 어셈블리 실패(설정 사용 불가 / 별칭 해석 실패 / 번들 가져오기 실패). `cause`에 하위 오류를 그대로 보존 |
| `capability_disabled` | 어셈블리 시점 | 기능 플래그가 꺼져 있는데 명시적으로 선택됨. 메시지에 콘솔 복구 안내 포함 |
| `session_closed` | 실행 시점 | `close()` 후에도 상태를 바꾸는 메서드를 호출함 |
| `session_not_found` | 어셈블리 시점 | `resume` 대상이 store에 없음——`list()`로 확인하거나 새로 만듦 |
| `session_store_corrupted` | 어셈블리 시점 / 저장 시 | 세션 저장소 손상——결코 침묵하지 않음. 세션 디렉터리를 지우고 다시 시작 |
| `checkpoints_not_wired` | 실행 시점 | 스냅숏 저장소가 미연결인데 `checkpoint()` / `listCheckpoints()` / `deleteCheckpoint()` 또는 명시적 `compact({ checkpoint: true })`를 호출함 |
| `checkpoint_store_corrupted` | 실행 시점 | 스냅숏 파일 손상. `deleteCheckpoint()`로 그 id를 지우고 계속 |
| `turn_running` | 실행 시점 | 실행 중에 유휴기 전용 메서드를 호출함. `await session.idle()` 후 재시도——"잠시 뒤 다시"인 유일한 SDK 오류 |
| `checkpoint_not_found` | 실행 시점 | `fork()` / `exportCheckpoint()`가 지명한 스냅숏이 없음 |
| `checkpoint_import_invalid` | 실행 시점 | 가져온 바이트열이 올바른 내보내기 본문이 아님. 변조는 즉시 거부, 디스크 쓰기 0 |
| `session_store_not_wired` | 실행 시점 | `fork()`에는 세션 `store`가 필요한데 주지 않음 |
| `platform_request_failed` | 실행 시점 | 토큰 방식에서 직접 호출하는 `session.platform.transcribe()` / `speak()` 실패(`PlatformRequestError`). `status` / `platformCode` / `platformMessage`가 게이트웨이의 사실을 동반하며, `status 0` = 플랫폼에 도달하지 못함. 0.19.0부터 `createPlatformNonchatClient`의 비채팅 작업 실패도 이 코드를 쓰되 `PlatformNonchatError`(`status` / `platformCode` / `outcomeUnknown` / `taskId?`)를 throw함: `outcomeUnknown: true`는 제출 결과를 알 수 없다는 뜻——원래 멱등 키와 `taskId`를 보관하고 `getTask()`로 원래 작업을 조회할 것. 키를 바꿔 다시 제출하지 말 것 |
| `lifecycle_failed` | 종료 처리 시점 | `SdkLifecycleError`: `query()`의 종료 정산 실패(세션 수준 `drain()` / `closeAsync()`는 throw하지 않고 `status: 'failed'` 결과로 표현). `failures`가 단계와 코드를 항목별로 나열하고, `cleanup`이 있으면 다시 호출해 회수를 계속할 수 있으며, `result`가 있으면 그것은 완료된 `QueryResult`([생명주기와 리소스 종료](/ko/sdk/lifecycle/) 참고) |

```ts
import { TansrSdkError, createSession } from '@tansr/sdk';

try {
  session = await createSession({ token, baseUrl, store, resume: { sessionId, store } });
} catch (e) {
  if (e instanceof TansrSdkError && e.code === 'session_not_found') {
    session = await createSession({ token, baseUrl, store }); // 确实不在 store 才新建
  } else {
    throw e; // session_store_corrupted 等恒上抛,不静默开空会话
  }
}
```

## 둘째 종류: 이벤트 스트림 속 오류

| 이벤트 | 의미 | 여러분이 할 일 |
|---|---|---|
| `turn.error { scope, message, recoverable, errorKind?, detail? }` | 한 턴 안의 오류 | `recoverable`을 볼 것: `true`는 자문(영속화 실패, 압축 실패, 플랫폼 알림)으로 `SessionView.notices`에 들어가며 세션은 계속됨. `false`는 이번 턴의 실패로 `lastError`에 들어감 |
| `turn.aborted { reason }` | 턴이 중단됨 | `reason`은 종단어: 사용자의 `interrupt()`면 `aborted_*`. `max_turns` / `budget_exceeded`는 상한 도달. `client_gone`은 세션 서비스 형태에서만 나타남 |
| `tool.failed { errorType }` | 도구 실행 실패 | `timeout` / `unknown_tool` 등. 모델은 구조화된 실패 결과를 보고 스스로 방향을 바꾸므로 보통 여러분이 개입할 필요 없음 |
| `tool.completed { isError: true }` | 도구는 끝났지만 결과가 오류 | 미디어 도구 넷의 공급자 실패와 시간 초과가 이 형태. `data.errorCode`가 플랫폼 코드를 동반 |
| `tool.permission.decided { allow: false, decisionSource }` | 권한 거부 | `policy` = `askUser`를 연결하지 않은 fail-closed 거부. `permission.askUser`를 연결하거나 규칙을 조정 |

`turn.error.detail`은 선택적 구조화 필드입니다. **SDK 0.13.0에서 제공됨**: 플랫폼 플랜 관련 코드 넷은 `detail: { scope: 'plan' }`을 동반하며, 세션 서비스 HTTP 표면의 `error.detail.scope`와 같은 키 · 같은 값이라 단말에서 "로컬 속도 제한"과 "플랜 할당량"을 구분할 수 있습니다.

## 셋째 종류: 플랫폼 게이트웨이 오류 코드

토큰 방식에서 플랫폼 오류 코드는 `turn.error` 메시지 첫 부분, `tool.completed.data.errorCode`, `PlatformRequestError.platformCode` / `PlatformNonchatError.platformCode`, 그리고 여러분 서버 쪽에서 토큰을 다시 발급하는 응답에 나타납니다. 전체 코드의 권위 있는 표는 [오류 코드 표](/errors/codes)에 있으며, 여기서는 가장 자주 마주치는 십수 개와 대처만 다룹니다:

### 재시도해야 함, `Retry-After`에 따라 대기

| 코드 | HTTP | 대처 |
|---|---|---|
| [`rate_limited`](/errors/codes#rate_limited) | 429 | 플랫폼 속도 제한. 항상 `Retry-After`(정수 초)를 동반. 그 값만큼 기다린 뒤 재시도하고 더 촘촘히 재전송하지 말 것 |
| [`upstream_error`](/errors/codes#upstream_error) / [`upstream_disconnected`](/errors/codes#upstream_disconnected) | 502 | 상류 모델 쪽 장애. 지수 백오프 + 지터 후 재시도 |
| [`upstream_timeout`](/errors/codes#upstream_timeout) 및 `upstream_connect_timeout` / `upstream_ttfb_timeout` / `upstream_idle_timeout` / `upstream_total_timeout` | 504 | 상류 시간 초과. 위와 같은 백오프 |
| [`plan_gate_unavailable`](/errors/codes#plan_gate_unavailable) | 503 | 플랫폼 게이트의 의존 대상이 일시적으로 사용 불가, `Retry-After: 5`. 기존 세션은 영향받지 않음 |

### 플랜 사용량 계열 429: 자동 재시도 0

| 코드 | HTTP | 대처 |
|---|---|---|
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | 플랜 동시성 하드 캡, `Retry-After: 30`. **새 세션만 거부하고 실행 중인 세션은 결코 끊기지 않음.** SDK는 재시도 0——그대로 재전송하면 창 안에서 반드시 다시 거부되고, 다중 세션 호스트의 자동 재시도는 썬더링 허드만 일으킴. 사용자가 30초 뒤 직접 다시 보내게 할 것. 여러분의 모니터링에는 `detail.upgradeUrl`을 표시할 것. 이것이 개발자에게는 등급 상향 신호 |
| [`plan_end_users_exceeded`](/errors/codes#plan_end_users_exceeded) | 429 | 테스트 기간의 월간 최종 사용자 수가 상한에 도달. 토큰 발급 경로에만 해당 |
| [`quota_exceeded`](/errors/codes#quota_exceeded)와 각 표면의 `*_quota_exceeded` | 429 | 일일 할당량 상한 도달. 할당량 창 갱신을 기다리고 재시도하지 말 것 |

### 재시도하면 안 됨, 설정이나 코드를 고칠 것

| 코드 | HTTP | 대처 |
|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) / [`token_expired`](/errors/codes#token_expired) | 401 | 세션 토큰이 만료되었거나 폐기됨. **토큰을 무효화하는 유일한 코드**——여러분 서버 쪽으로 돌아가 다시 발급. 단말 쪽 SDK는 로그인 상태로 토큰을 최대 2회 다시 받고, 그래도 401이면 종단 상태에 들어가 호스트가 명시적으로 재연결 |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | 앱 지갑 잔액 부족. 충전하면 저절로 낫고 재시도는 소용없음 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | 모델 참조 이름이 앱의 인가 표면에 없음. 콘솔에서 인가를 켤 것 |
| [`forbidden`](/errors/codes#forbidden) | 403 | 3링 기능 플래그 꺼짐(게이트웨이 강제 표면). `detail`에 플래그 켜기 안내 동반 |
| [`plan_required`](/errors/codes#plan_required) / [`plan_tier_insufficient`](/errors/codes#plan_tier_insufficient) | 403 | 앱 소속 계정에 유효한 플랜이 없거나 등급에 그 기능이 없음——개발자의 어셈블리 오류로 최종 사용자에게 도달해서는 안 됨. `detail.upgradeUrl`은 콘솔 플랜 페이지를 가리킴 |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | 크기 상한 초과(예: 음성 인식 원시 오디오 > 24 MiB, `detail.maxRawBytes`). 분할하거나 압축할 것, 재시도 불가 |
| [`validation_failed`](/errors/codes#validation_failed) / [`bad_request`](/errors/codes#bad_request) | 400 | 페이로드 형태가 잘못됨. 메시지를 읽고 요청을 고칠 것 |
| [`session_archived`](/errors/codes#session_archived) | 410 | 플랫폼 세션이 아카이브됨(30일 비활성 임대 만료 후). 이 세션은 더 이어 갈 수 없고 `resume`은 실패하므로 새 세션을 만들 것 |
| [`context_window_exceeded`](/errors/codes#context_window_exceeded) | 400 | 요청이 모델의 컨텍스트 창을 초과. 먼저 `compact()`하거나 더 큰 창의 모델로 바꿀 것 |

## 커널이 이미 대신해 주는 재시도

모델 요청 계층의 일시적 실패는 **여러분이 재시도할 필요가 없습니다**. 폴백 체인의 각 항목에는 재시도가 내장되어 있고(백오프 500 ms → 30 s, 총 3회 시도, `Retry-After` 우선 존중), 소진되면 다음 항목으로 전환하며 `cost.provider.switched`(from / to / reason / attempts / failures)를 발행합니다. 컨텍스트가 실제로 넘치면(상류 413) 커널은 강제로 한 번 압축한 뒤 재시도합니다. 여러분의 재시도 로직은 위의 두 "재시도해야 함" 표에 있는 세션 수준 실패만 다루면 됩니다.

## 세션 서비스 형태에서는 어떻게 보이는가

`@tansr/serve`를 쓸 때 같은 플랫폼 코드 묶음은 서버 쪽에서 매핑된 뒤 모바일 단말에 도달합니다. 플랜 동시성 캡은 `429 rate_limited` + `Retry-After` + `detail: { scope: 'plan' }`으로 매핑되고, `plan_required` / `plan_tier_insufficient`는 403 원래 코드로 투과되며 `detail.scope: 'plan'`을 동반하고, 상류 속도 제한 / 5xx / 네트워크 오류는 `503 upstream_unavailable`로 매핑됩니다. 단말 쪽 백오프 규율은 바뀌지 않습니다. 429 / 503이 `Retry-After`를 동반하면 정수 초 값만큼 기다리고, 5xx에 `Retry-After`가 없으면 지수 백오프 + 지터입니다. 자세한 내용은 [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 참고하세요.

위에서 말한 것은 `/v2` 직접 연결 표면의 오류 본문 `{ error: { code, message, detail? } }`이며, 그 바이트는 `@tansr/serve` 0.13.0 … 0.15.1에서 변하지 않았습니다. 0.15.0부터 옛 접두사 응답에는 `Deprecation` / `Link` 두 응답 헤더만 더 붙을 뿐(`@tansr/api-client` 0.3.x / 0.4.0 모두 무시), 본문과 상태 코드는 바뀌지 않습니다.

## `/api` 경유 시의 통합 오류 봉투

`@tansr/serve` 0.13.0부터(2026-10-02 공개) 새 통합은 통합 호출 표면 `/api`를 거치며, 400 이상의 모든 JSON 오류는 패밀리마다 다른 형태가 아니라 하나의 통합 봉투로 나옵니다:

```json
{ "contract": "unified-v1", "traceId": "<x-request-id>", "requestId": "<客户端幂等键或 null>", "code": "capacity_exceeded", "status": 429, "retryAction": "same-request", "message": "...", "detail": { "domainCode": "rate_limited", "domainStatus": 429 } }
```

- `code`는 **통합 코드 19개** 중 하나입니다(`invalid_request` / `protocol_mismatch` / `unauthorized` / `forbidden` / `not_found` / `method_not_allowed` / `gone` / `conflict` / `stale_generation` / `gap` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `result_unknown` / `rejected` / `internal_error`, 그리고 파사드 고유의 `precondition_failed`와 `not_canonical`). 원래 패밀리 코드(이 페이지 위의 `rate_limited`, `session_ended`, `session_not_found` 등)는 `detail.domainCode`에만 남고, 원래 와이어 상태는 `detail.domainStatus`에 있습니다. `switch (code)` 하나로 전체 도메인을 덮고, 패밀리 수준 세분화가 필요할 때만 `domainCode`를 읽으세요.
- `retryAction`은 **동작 6개** 중 하나로 여러분의 다음 단계를 정합니다. `none`은 재시도 불가. `same-request`는 같은 키 · 같은 요청 재전송(`Retry-After` / `detail.retryAfterMs`를 동반하면 먼저 대기). `query-status`는 먼저 영수증 / 상태 조회. `rebind`는 바인딩 재구축. `refresh`는 수정본을 다시 읽은 뒤 재시도. `rediscover`는 기능 재발견 후 재시도. **`result_unknown` / `commit_unknown`에서는 `query-status` 또는 `rebind`만 허용되며 키를 바꿔 재전송하는 것은 금지입니다**——그것은 중복 부작용을 인정하는 것과 같습니다.
- 0.14.0부터 요청 헤더 셋 `Idempotency-Key` / `If-Match`+`ETag` / `deadline`의 거부도 같은 봉투를 거치며 새 오류 코드는 늘지 않고 세부 원인은 `detail.reason`(`idempotency_key_reused`, `if_match_stale`, `deadline_exceeded` 등)에 있습니다. `412 precondition_failed`는 이후 울타리가 낡은 경우(`rediscover`)일 수도, 리소스 버전이 낡은 경우(`refresh`)일 수도 있으므로 `detail.domainCode`로 구분하세요.
- 응답에 `tansr-contract` 헤더가 없거나 `/api`가 JSON이 아닌 것 / 프록시 페이지를 반환하면 일률적으로 "계약 사용 불가"로 보고하고, 이를 근거로 옛 버전 서비스라고 추측해 `/v2`로 되돌아가서는 **안 됩니다**.

`@tansr/api-client` 0.3.0부터(2026-10-04 정식판. 현행 0.4.0, 2026-10-06, `./api` 하위 진입점과 루트 진입점은 변화 0)의 `./api` 하위 진입점은 이 디코딩을 `ApiError`(`code` / `retryAction` / `domainCode` / `domainStatus` / `closureId` 읽기)와 `retryAdvice` / `retrySameRequest` 유틸리티로 제공하며, `result_unknown`은 항상 `query-status`로 강등됩니다. 통합 코드 전체 표, `retryAction` 출처 매핑, 각 패밀리의 `domainCode` 대조는 [통합 API의 요청 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 참고하세요.
