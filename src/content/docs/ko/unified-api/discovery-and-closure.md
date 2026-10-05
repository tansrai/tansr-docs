---
title: 디스커버리와 능력 클로저
description: 시작할 때 먼저 호출하는 세 디스커버리 엔드포인트 GET /api/manifest, GET /api/capabilities, 세션 단위 GET /api/sessions/:id/capabilities의 의미론. closureId 계산 방식과 tansr-closure-id 전제 조건. enabled / disabled / unavailable 세 상태에 대응하는 응답. 매니페스트 리비전이 어긋났을 때 클라이언트가 해야 할 일.
zone: docs
category: unified-api
sidebar:
  order: 3
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/deploy-and-auth
  - errors/codes
sources:
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/src/api/closure.ts
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
lastVerified: '2026-10-05'
---

`/api`의 능력은 **발견 가능**합니다. 매니페스트는 이 버전의 서버가 어떤 작업을 정의하는지, 배포 단위 능력은 이 서버가 어떤 도메인을 조립했는지, 세션 단위 능력 클로저는 어떤 세션 안에서 현재 인가로 지금 어떤 작업이 통과하는지 알려 줍니다. 세 엔드포인트는 모두 읽기 전용이고 인증이 필요하며 탐색 가능한 URL을 전혀 돌려주지 않습니다.

## 세 디스커버리 엔드포인트

| 작업 | 경로 | 답하는 질문 | 응답 요점 |
|---|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | 이 서버 버전은 무엇을 정의하는가 | 매니페스트 전체(`format: tansr-api-manifest-v1`, `revision`, `schemaHash`, `families`, `operations`, `capabilities`, `platformApi`)에 더해 `runtime.installed`(각 도메인이 조립되었는지. 세션 도메인은 선호 패밀리 이름 또는 `null`) |
| `discovery.capabilities` | `GET /api/capabilities` | 이 서버는 무엇을 조립했는가 | `{ contract, manifestRevision, schemaHash, domains }`. 각 도메인에 `installed`, `contract`(패밀리 이름), `status`, `schemaHash`가 있고 세션 도메인에는 추가로 `family: { preferred, available }`가 있음 |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | 이 세션에서 지금 무엇을 할 수 있는가 | 능력 클로저(다음 절). 응답 헤더 `tansr-closure-id`와 본문의 `closureId`는 같은 값 |

공통 규율:

- `GET`만 받습니다. 다른 메서드는 405 `method_not_allowed`(`allow: GET` 포함)입니다.
- 쿼리 문자열과 요청 본문을 받지 않습니다. 붙이면 400 `invalid_request`입니다.
- 응답은 `cache-control: no-store`를 가집니다. 시작이나 재연결 때마다 다시 발견하고 디스크에 캐시하지 마세요.
- 세 엔드포인트의 `tansr-domain`은 모두 `discovery`이고 `tansr-schema-hash`는 집계된 매니페스트 `schemaHash`입니다. 다른 도메인의 응답에서 이 헤더는 그 패밀리 소스 파일의 다이제스트이며 매니페스트 집계값과 비교할 수 없습니다.
- 응답 본문에는 URL, `href`, `links` 같은 탐색 필드가 **없습니다**. 경로는 매니페스트 템플릿과 경로 매개변수로부터 클라이언트에서만 조립합니다.

## 세션 단위 능력 클로저

클로저(capability closure)는 서버가 "이 세션, 이 사용자, 지금 이 순간"에 대해 작업 가용성을 결정론적으로 스냅샷한 것입니다.

```json
{
  "contract": "unified-v1",
  "closureId": "<sha256 hex>",
  "authorizationRevision": "<string or null>",
  "domains": {
    "session": { "installed": true, "revision": "<family revision>" },
    "archive": { "installed": false, "revision": null }
  },
  "operations": {
    "session.message.send": "enabled",
    "session.audio.speak": "disabled",
    "archive.binding.create": "unavailable"
  }
}
```

- `operations`는 77개 작업을 포괄합니다(매니페스트 revision 7의 81개 작업에서 디스커버리 엔드포인트 3개와 배포 단위의 `session.capabilities`, 즉 `GET /api/capabilities/sessions`를 뺀 것). 각 작업은 세 상태 중 하나를 가집니다.
  - `enabled`: 클로저 안이며 호출할 수 있음.
  - `disabled`: 능력이 이 서버에 존재하지만 현재 인가나 세션 상태가 허용하지 않음(예: 세션이 종료됨, 필요한 능력이 부여되지 않음, 아카이브 바인딩이 아직 쓰기 가능한 에포크에 들어가지 않음).
  - `unavailable`: 이 서버 또는 이 세션의 경계에 그 능력이 존재하지 않음(도메인이 조립되지 않음, 오디오 / 입력 소스가 연결되지 않음 등).
- `closureId = sha256(UTF8('tansr.unified.closure.v1') ‖ 0x00 ‖ canonical({ authorizationRevision, domains, operations }))`이며, `canonical`은 `@tansr/protocol/canonical`의 엄격한 JSON 인코딩입니다. 클라이언트는 대조를 위해 로컬에서 다시 계산할 수 있지만 클로저를 직접 유도할 필요는 없습니다. 클로저 내용은 항상 서버의 응답이 기준입니다.
- 세션이 존재하지 않거나 현재 사용자의 것이 아니면 404 `not_found`이며 두 경우는 구분되지 않습니다. 세션 도메인이 조립되지 않았거나 클로저 소스가 연결되지 않았으면 `capability_unavailable`(`detail.reason: not_installed`), 클로저 소스를 일시적으로 사용할 수 없으면 503 `upstream_unavailable`(`retry-after` 포함)입니다.

## `tansr-closure-id`를 쓰기 작업의 전제 조건으로 쓰기

클로저를 얻었으면 **세션 안의 쓰기 작업**에 요청 헤더 `tansr-closure-id: <closureId>`를 붙입니다. 서버는 도메인 핸들러에 위임하기 전에 두 가지를 확인합니다.

| 확인 | 통과하지 못했을 때의 응답 |
|---|---|
| 요청 헤더의 `closureId`가 현재 클로저와 같은가 | 412 `precondition_failed`, `retryAction: rediscover`, `detail.domainCode: closure_stale`. 응답 헤더 `tansr-closure-id`가 현재 값을 바로 알려 줌 |
| 그 작업이 현재 클로저에서 `enabled`인가 | `disabled`면 403 `capability_unavailable`, `unavailable`이면 404 `capability_unavailable`. 둘 다 `detail`은 `{ reason: 'outside_closure', operation, state, closureId }` |

세 가지에 유의하세요.

- 이 헤더는 세션 안의 쓰기 작업에만 의미가 있습니다. `GET` / `HEAD`에 붙이거나 세션 밖 경로(예: `POST /api/executors/connections`)에 붙이면 400 `invalid_request`(`detail.header: tansr-closure-id`)입니다.
- 이 헤더가 없으면 서버는 클로저 확인을 하지 않으며, 도메인 핸들러가 여전히 최종 권위입니다. 핸들러는 자기 하위 계약에 따라 월권 요청을 거부합니다. 클로저는 클라이언트가 통일된 형태의 거부를 **미리** 받게 하는 것이지 어떤 검사도 완화하지 않습니다.
- 412를 받았을 때 올바른 동작은 하나뿐입니다. 다시 `GET /api/sessions/:id/capabilities`를 호출하고 새 `closureId`로 재시도합니다. 추측하지 말고, 이전 값을 계속 쓰지 말고, 이전 접두사로 돌아가지 마세요.

## 리비전 어긋남

모든 `/api` 응답은 `tansr-manifest-revision`을 가집니다. 공식 클라이언트는 생성 시 사용한 리비전과 `schemaHash`를 빌드 시점에 잠그며(예를 들어 `@tansr/api-client/api`는 `client.locked`로 노출하고 런타임 관찰값은 `client.observed()`), 런타임에 서버 리비전이 잠근 값과 다르다는 것을 발견하면 다음과 같이 합니다.

- **기록만 하고 로직은 바꾸지 않는다.** 리비전 전진은 덧셈(새 작업, 새 필드)입니다. 이전 클라이언트는 자기 카탈로그대로 계속 호출하고, 없는 작업은 클로저에서 `unavailable`로 표시되거나 호출 시 `capability_unavailable` / `not_found`를 받습니다.
- 이를 이유로 파서를 바꾸지 말고, 이전 접두사를 "시험해 보지도" 마세요. 그것이 바로 규율 제1조가 금지하는 조용한 다운그레이드입니다.
- 새 작업이 필요하면 해당 리비전에 대응하는 버전으로 클라이언트를 업그레이드하세요(`@tansr/api-client` 0.3.0은 revision 7에 정렬).

`@tansr/api-client/api`는 `onContract` 콜백을 제공하며 모든 응답의 `{ manifestRevision, schemaHash, domain }`이 그것을 거칩니다. 장애 조사 로그에 연결하기에 알맞습니다.
