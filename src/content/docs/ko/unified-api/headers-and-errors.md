---
title: 통합 요청 헤더, 응답 헤더와 오류 봉투
description: /api 요청이 붙일 수 있는 헤더(Authorization, x-request-id, tansr-session-family, tansr-closure-id, tansr-event-envelope, Idempotency-Key, If-Match / ETag, deadline), 모든 응답이 반드시 가지는 4개의 tansr-* 헤더, 그리고 400 이상일 때의 통합 오류 봉투. 19개 통합 코드, 6종 retryAction, detail.domainCode 읽는 법과 상태 재작성 규칙.
zone: docs
category: unified-api
sidebar:
  order: 4
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/events
  - unified-api/clients
  - errors/codes
  - sdk/errors-and-retries
  - serve/v2-and-webhooks
sources:
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-error-map.json
  - tansr-cli:packages/server/src/api/request-headers.ts
  - tansr-cli:packages/server/src/api/error-envelope.ts
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-13'
---

`/api`는 "요청 한 번을 어떻게 표현하는가"와 "실패 한 번을 어떻게 표현하는가"를 각 도메인 하위 계약에서 꺼내 통일되게 정의합니다. 이 페이지는 그 두 가지의 사실표입니다. 성공 응답 본문은 이 페이지의 범위 밖이며, 각 도메인 하위 계약이 정하고 이전 접두사와 바이트 단위로 동일합니다.

## 요청 헤더

| 헤더 | 적용 범위 | 의미 |
|---|---|---|
| `Authorization: Bearer <token>` | 모든 요청 | 신원은 여기에만 있습니다. 누락이거나 유효하지 않으면 401 `unauthorized`(응답에 `www-authenticate: Bearer`), 인증 소스를 사용할 수 없으면 503 `capacity_exceeded`(`retry-after` 포함). 본문의 신원 필드는 인증 결과와 일치해야 하며 아니면 거부됩니다 |
| `x-request-id`(또는 W3C `traceparent`) | 선택 | 추적 식별자. 올바른 형태의 `x-request-id`(영숫자와 `._-`로 1~128자)는 그대로 채택되고, 아니면 `traceparent`의 trace-id, 그것도 없으면 서버가 생성합니다. 응답 헤더 `x-request-id`와 오류 봉투의 `traceId`는 같은 값입니다. 업무용 멱등 키 `requestId`와는 무관합니다 |
| `tansr-session-family: sdk1 \| sdk2-offload-v1` | 선택. 세션 도메인과 실행 도메인 | 세션 패밀리를 선언합니다. 기본값은 배포의 선호 패밀리. 어휘 밖이면 400 `invalid_request`, 조립되지 않았으면 `capability_unavailable`(`detail.reason: not_installed`) |
| `tansr-closure-id: <closureId>` | 선택. 세션 안의 쓰기 작업만 | 클로저 전제 조건. 불일치면 412 `precondition_failed` / `rediscover`. `GET`이나 세션 밖 경로에 붙이면 400. [디스커버리와 능력 클로저](/ko/unified-api/discovery-and-closure/) 참고 |
| `tansr-event-envelope: unified-v1` | 선택. 스트림 작업에 유효 | 통합 이벤트 봉투의 명시적 협상. 서버가 같은 이름의 헤더를 되돌려주면 확인입니다. 어휘 밖의 값으로 어떤 `/api` 경로에 접근하든 400. [이벤트 스트림과 통합 이벤트 봉투](/ko/unified-api/events/) 참고 |
| `Idempotency-Key: <key>` | 선택. 쓰기 작업만 | 쓰기 작업의 멱등 키. `@tansr/serve` 0.14.0부터 유효. 다음 절 참고 |
| `If-Match: "<revision>"` | 선택. `expectedRevision`이 등록된 9개 쓰기 작업만 | 리소스 버전 전제 조건. 0.14.0부터 유효. 다음 절 참고 |
| `deadline: <RFC 3339>` | 선택 | 요청의 절대 마감 시각. 0.14.0부터 유효. 다음 절 참고 |

## 세 요청 헤더: 멱등성, 조건부 쓰기, 마감

이 세 헤더는 모두 **명시적 협상**입니다. 형태가 틀리거나 적용할 수 없는 헤더는 무시되지 않고 400 `invalid_request`가 되며, `detail.reason`이 세부 사유(`idempotency_key_invalid` / `idempotency_key_not_applicable` / `if_match_invalid` / `if_match_not_applicable` / `deadline_invalid`)를, `detail.header`가 헤더 이름을 알려 줍니다.

### `Idempotency-Key`

- 형태: 인쇄 가능한 ASCII 문자 1~128자(`^[\x21-\x7e]{1,128}$`). 매니페스트에서 **쓰기**로 분류된 작업에만 유효합니다.
- 서버는 이것을 해당 패밀리의 도메인 내 멱등 키에 매핑합니다(`sdk2-ext-v1` 등 패밀리는 `request.requestId`, 터미널 세 패밀리는 `requestId`. `agent-session-v1`은 본문 쪽 자리가 없어 헤더만 인식). 본문에 같은 이름의 키가 이미 있고 헤더와 다르면 409 `conflict`(`detail.reason: idempotency_key_mismatch`)입니다.
- **같은 키, 같은 의미**(같은 사용자, 같은 작업, 같은 매니페스트 리비전, 같은 요청 지문)면 첫 실행의 원래 영수증을 돌려주고 부작용은 정확히 한 번입니다. **같은 키, 다른 의미**면 409 `conflict`(`detail.domainCode: request_id_conflict`, `detail.reason: idempotency_key_reused`). 같은 키의 요청이 아직 처리 중이면 첫 결과를 기다린 뒤 같은 영수증을 돌려줍니다.
- 영수증 캐시에는 한계가 있습니다. 사용자당 256개, 전체 4096개, 10분 보존. 원래 영수증이 이미 밀려났으면 503 `result_unknown`(`retryAction: query-status`, `detail.reason: receipt_not_retained`), 처리 중 윈도가 가득 찼으면 503 `result_unknown`(`detail.reason: receipt_window_full`, `retry-after` 포함). 두 경우 모두 **재전송할 수 없으며** 도메인의 조회 작업(`archive.operation.query`, `cache.operation.query`, `terminal.memory.receipt` 등)으로 결과를 확인할 수 있을 뿐입니다.

### `If-Match`와 `ETag`

- 강한 검증자 `"<10진 revision>"`만 받습니다. 약한 검증자(`W/`), 와일드카드, 숫자가 아닌 값은 모두 400입니다.
- 매니페스트에 `expectedRevision`이 등록된 9개 쓰기 작업에만 유효합니다. `archive.binding.create`, `archive.binding.close`, `archive.ack.commit`, `cache.binding.renew`, `cache.binding.rebind`, `cache.binding.rotate`, `cache.binding.close`, `terminal.configuration.commit`, `terminal.memory.command`. 다른 작업에 붙이면 400 `if_match_not_applicable`입니다.
- 서버는 이것을 본문의 `expectedRevision`에 매핑합니다(없으면 채우고, 있는데 다르면 412 `precondition_failed`, `detail.reason: if_match_body_mismatch`). 리소스 버전이 이미 앞서 갔으면 412 `precondition_failed`, `retryAction: refresh`, `detail.domainCode`는 원래 패밀리 코드(`revision_conflict` / `stale_revision` / `binding_conflict`), `detail.reason: if_match_stale`이며 **아무것도 쓰이지 않았습니다**.
- 버전이 있는 리소스의 2xx 응답은 `ETag: "<revision>"`을 가지며 15개 작업이 돌려줍니다(아카이브 바인딩과 상태, 캐시 바인딩, 터미널 구성과 메모리의 읽기와 쓰기). 올바른 사용법은 읽기, `ETag` 가져오기, 그것을 `If-Match`로 삼아 쓰기입니다. 412를 받으면 다시 읽으세요. revision을 1 올려서 맞혀 보면 안 됩니다.

### `deadline`

- 형태: RFC 3339 날짜 시각(`2026-10-05T08:00:00Z` 또는 오프셋 포함)으로 절대 마감 시각을 나타냅니다.
- 서버에 도달했을 때 이미 만료되었으면 408 `invalid_request`(`detail.reason: deadline_exceeded`)이며 수리되지 않고 하류에도 닿지 않습니다. 만료 전이면 서버는 그대로 도메인 핸들러에 위임하며 하류 시간 측정을 대신하지 않습니다.
- 재시도는 마감을 **연장하지 않습니다**. 공식 클라이언트는 만료된 요청을 보내기 전에 로컬에서 거부하고, `retrySameRequest`는 대기 후 마감을 넘기면 바로 포기합니다.

### 세 헤더 공통의 본문 상한

`Idempotency-Key` 또는 `If-Match`를 붙인 요청에서는 서버가 지문 계산과 본문 매핑을 위해 요청 본문을 전부 읽어야 하며 상한은 1 MiB입니다. 넘으면 413 `payload_too_large`(`detail.reason: header_body_limit`, `detail.limitBytes: 1048576`)입니다. 대용량 업로드 작업(`material.upload.chunk` 등)에는 이 두 헤더를 붙이지 마세요.

## 응답 헤더

| 헤더 | 언제 나타나는가 | 내용 |
|---|---|---|
| `tansr-contract` | 모든 `/api` 응답(2xx와 SSE 열기 포함) | 항상 `unified-v1`. 누락은 "계약을 사용할 수 없음"을 뜻합니다. 연결한 곳이 `/api`가 아니거나 거쳐 온 게이트웨이가 헤더를 삼킨 것입니다. 보고하세요. 폴백하면 안 됩니다 |
| `tansr-manifest-revision` | 모든 응답 | 서버의 매니페스트 리비전(현재 `7`) |
| `tansr-domain` | 모든 응답 | 수리한 도메인(9개 도메인 단어 중 하나) |
| `tansr-schema-hash` | 모든 응답 | `sha256:<64 hex>`. 디스커버리 엔드포인트는 매니페스트 집계값, 다른 도메인은 해당 패밀리 소스 파일의 다이제스트 |
| `tansr-closure-id` | 세션 단위 능력 클로저 응답. 412 / 403 / 404의 클로저 거부 | 현재 `closureId` |
| `tansr-event-envelope` | 협상된 이벤트 스트림 | `unified-v1`을 되돌려줌. 협상 성립의 유일한 신호 |
| `ETag` | 버전이 있는 리소스 작업 15개의 2xx | 강한 검증자 `"<revision>"` |
| `x-request-id` | 모든 응답 | 추적 식별자 |
| `retry-after` | 429 / 503 | 초 단위. 공식 클라이언트는 이에 따라 기다리되 로컬 예산과 `deadline`을 넘지 않음 |
| `www-authenticate` | 401 | `Bearer` |
| `allow` | 405 | 허용되는 메서드 |

같은 이름의 중복, 틀린 형태, 어휘 밖의 `tansr-*` 헤더는 공식 클라이언트에서 모두 계약을 사용할 수 없는 것으로 처리됩니다.

## 통합 오류 봉투

`/api`에서 상태 400 이상인 JSON 오류 본문은 모두 같은 형태입니다.

```json
{
  "contract": "unified-v1",
  "traceId": "4f1c0f0e2b7a4d1c",
  "requestId": null,
  "code": "capability_unavailable",
  "status": 403,
  "retryAction": "none",
  "message": "session.audio.speak is disabled for this session",
  "detail": {
    "reason": "outside_closure",
    "operation": "session.audio.speak",
    "state": "disabled",
    "closureId": "9f3c…e1"
  }
}
```

- `code`, `status`, `retryAction`이 **공개된 결정 표면**입니다. `code`로 분기하고 `retryAction`으로 다음 수를 정하세요. HTTP 상태 코드나 `message`로 추측하면 안 됩니다.
- `traceId`는 응답 헤더 `x-request-id`와 같고, `requestId`는 클라이언트의 멱등 키(`Idempotency-Key` 또는 본문의 `requestId`)이며 없으면 `null`입니다.
- `message`는 사람이 읽는 문구로 문자 그대로를 보장하지 않습니다. 내부 경로는 요청된 `/api` 경로로 재작성되어 이전 접두사가 새지 않습니다.
- `detail`은 선택적인 구조화 필드입니다. 도메인 오류가 파사드에서 정규화될 때 원래 패밀리의 사실이 보존됩니다. `detail.domainCode`(원래 패밀리 코드), `detail.domainStatus`(원래 HTTP 상태), `detail.domainRetryAction`(원래 패밀리 동작). 캐시 도메인의 `fallback` 같은 원래 `detail` 키는 그대로 남습니다.
- 유일한 예외는 `archive-sync-v1` 패밀리(`archive.sync`)입니다. 통합 코드표가 없어 오류 본문은 원래 봉투 그대로 통과합니다.

### 19개 통합 코드

| `code` | 기본 상태 | 기본 `retryAction` | 의미 |
|---|---|---|---|
| `invalid_request` | 400(원래가 422면 유지) | `none` | 요청 형태가 틀림: 남는 쿼리 키, `protocol` 누락, 헤더 형태 오류, 만료된 `deadline`(408) 등 |
| `protocol_mismatch` | 400 | `none` | 쿼리 문자열의 리비전 식별자가 그 작업에 등록된 값이 아님 |
| `not_canonical` | 400 | `none` | 엄격한 canonical 진입점이 canonical이 아닌 본문을 거부함 |
| `unauthorized` | 401 | `none` | 인증되지 않음 |
| `forbidden` | 403 | `none` | 소유 관계 불일치(다른 사람의 세션 / 바인딩 접근 포함) |
| `not_found` | 404 | `none` | 리소스가 없거나 `/api` 아래에 그 경로가 없음 |
| `capability_unavailable` | 404(클로저가 `disabled`면 403) | `none` | 도메인이 조립되지 않음, 능력이 없음, 클로저 밖 |
| `method_not_allowed` | 405 | `none` | 메서드가 허용되지 않음(`allow` 포함) |
| `conflict` | 409 | `none` | 멱등 키 재사용, 상태 기계 충돌, 배포 / 소유 조건 불충족(복구 불가 등) |
| `stale_generation` | 409 | `rebind` | 바인딩 / 연결 세대가 만료됨. 다시 바인딩 필요 |
| `gap` | 409 | `none` | 시퀀스 결손 |
| `gone` | 410 | `none` | 세션이 종료됨, 바인딩이 닫힘 |
| `precondition_failed` | 412 | `rediscover`(클로저가 오래됨) / `refresh`(리소스 버전이 오래됨) | 전제 조건이 성립하지 않음 |
| `payload_too_large` | 413 | `none` | 본문 상한 초과 |
| `rejected` | 422 | `none` | 의미 검증을 통과하지 못함 |
| `capacity_exceeded` | 429(원래가 503이면 유지) | `same-request` | 속도 제한, 드레인 중, 과부하, 인증 소스 사용 불가. `retry-after` 포함 |
| `internal_error` | 500 | `none` | 서버 내부 오류, 또는 매트릭스에 등록되지 않은 도메인 코드(원래 상태는 `detail.domainStatus`에만 남음) |
| `upstream_unavailable` | 503 | `same-request` | 상류 / 능력 소스를 일시적으로 사용할 수 없음 |
| `result_unknown` | 503 | `query-status` | 부작용 결과를 알 수 없음: 조회만 하고 재전송하지 않음. `retryAction`은 `query-status` 또는 `rebind`만 가능하며, 패밀리 동작 매핑 때문에 재전송 제안으로 바뀌지 않음 |

상태 재작성 규칙: 각 통합 코드에는 기본 상태가 하나 있습니다. 원래 패밀리 상태가 RFC가 허용하는 대체 열(400/422, 409/412, 409/410, 404/403, 429/503)에 들어가면 원래 상태를 유지하고, 아니면 기본값을 가집니다. 따라서 `session_ended`(이전 접두사에서 409)는 `/api`에서 410 `gone`으로 나가고, `binding_closed`도 마찬가지로 410, `unsupported_capability`(이전 접두사에서 422 또는 409)는 404 `capability_unavailable`, `commit_unknown`은 503 `result_unknown`으로 나갑니다. 원래 상태는 항상 `detail.domainStatus`에 있습니다. 매트릭스에 등록되지 않은 도메인 코드는 이 규칙을 따르지 않습니다. `@tansr/serve` 0.15.1부터는 일률적으로 500 `internal_error`가 되며(0.15.0 이전은 원래 상태 유지), 원래 상태는 마찬가지로 `detail.domainStatus`에만 남습니다.

파사드가 직접 답하는 코드는 8개뿐입니다. `unauthorized`, `not_found`, `method_not_allowed`, `invalid_request`, `capability_unavailable`, `capacity_exceeded`, `precondition_failed`, `upstream_unavailable`. 나머지는 도메인 오류의 정규화에서 옵니다.

### 6종 `retryAction`

| `retryAction` | 해야 할 일 |
|---|---|
| `none` | 같은 요청을 재시도하지 않음. 요청을 고치거나 사용자에게 알림 |
| `same-request` | `retry-after`(또는 백오프)를 기다린 뒤 **같은 요청, 같은 `Idempotency-Key`**로 한 번 재전송 |
| `query-status` | 재전송하지 않음. 도메인의 조회 작업으로 결과를 확인한 뒤 결정 |
| `rebind` | 바인딩 / 연결을 다시 만들고(새 세대) 나서 수행 |
| `refresh` | 리소스를 다시 읽어 새 `ETag` / revision을 얻은 뒤 다시 제출 |
| `rediscover` | 다시 `GET /api/sessions/:id/capabilities`(또는 전체를 다시 발견)하고 새 클로저로 재시도 |

`@tansr/api-client/api`의 `retryAdvice(error)`는 이 표를 `{ action, stated, replayable, retryAfterMs, closureId, … }`로 인코딩합니다. `retrySameRequest()`는 `replayable`이 참(서버가 `same-request`를 명시)이고 같은 키를 계속 쓰는 경우에만 한 번 재전송하며, `result_unknown`과 `commit_unknown`은 결코 재전송하지 않습니다.

## `/v2` 오류 형태와의 차이

이전 접두사의 오류 본문은 `{ "error": { "code", "message", "detail"? } }`이고 코드는 각 패밀리 자신의 어휘였습니다. `/api`에서는 8키 통합 봉투가 되고 패밀리 코드는 `detail.domainCode`로 내려갑니다. 지금까지 `error.code === 'session_ended'`로 분기하던 코드는 `/api`로 옮긴 뒤 `code === 'gone'`으로 분기하도록 고치고, 세분이 필요할 때만 `detail.domainCode`를 보세요. 대응표는 [마이그레이션과 폐기 일정](/ko/unified-api/migration/)을 보세요.
