---
title: 마이그레이션과 폐기 일정
description: /v2, /v3/sdk2, /v3/terminal*에서 /api로 전환할 때의 경로 대응표와 요청 / 오류 형태 차이. @tansr/serve 0.13.0부터 /api를 조립한 배포에서 세션 서비스의 /v1이 기본적으로 꺼지는 것과 --legacy-v1 전환기. 0.14.0 시점의 6단계 마이그레이션 진행 상황. /v2와 /v3/*의 폐기 일정, 그리고 서버와 클라이언트를 짝으로 롤백하는 규율.
zone: docs
category: unified-api
sidebar:
  order: 6
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
  - releases/serve
  - releases/cli
sources:
  - tansr-cli:doc/report/UAPI-迁移与退役-2026-10-01.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-05'
---

`/api`는 새 프로토콜이 아니라 기존 도메인 하위 계약을 같은 접두사, 같은 봉투 아래에 모은 것입니다. 따라서 마이그레이션의 주된 작업은 경로, 헤더, 오류 판정을 바꾸는 것이지 업무 로직을 다시 쓰는 것이 아닙니다. 성공 응답 본문과 이벤트 페이로드는 한 바이트도 바뀌지 않습니다.

## 경로 대응표

이전 접두사와 `/api`의 대응은 매니페스트 각 작업의 `legacy` 필드에 등록되어 있습니다. 자주 쓰는 것을 추리면 다음과 같습니다.

| 이전 경로 | `/api` | 비고 |
|---|---|---|
| `POST /v2/sessions` | `POST /api/sessions` | 세션 패밀리 `sdk1`(기본) |
| `POST /v3/sdk2/sessions` | `POST /api/sessions` + `tansr-session-family: sdk2-offload-v1` | 경로는 같고 패밀리는 요청 헤더가 선언 |
| `GET /v2/sessions/:id/events` | `GET /api/sessions/:id/events` | 협상 헤더 없이는 프레임이 바이트 단위로 동일 |
| `POST /v2/sessions/:id/permission/:requestId` | `POST /api/sessions/:id/permission/:ticketId` | 자리표시자 이름이 `:ticketId`로 변경(`:id`는 여전히 세션 id) |
| `POST /v1/approvals/:id/credential` | `POST /api/approvals/:id/credential` | `/v1`에서 옮겨진 유일한 작업(0.14.0) |
| `GET /v3/sdk2/session-capabilities` | `GET /api/capabilities/sessions?protocol=sdk2-ext-v1` | |
| `GET /v3/sdk2/capabilities` | `GET /api/capabilities/archive` | 쿼리 문자열 없음 |
| `POST /v3/sdk2/bindings` | `POST /api/archive/bindings` | |
| `GET /v3/sdk2/bindings/:id` | `GET /api/archive/bindings/:id?protocol=sdk2-ext-v1` | GET 읽기는 `protocol`을 붙임 |
| `POST /v3/sdk2/bindings/:id/archive/acks` | `POST /api/archive/bindings/:id/archive/acks` | |
| `POST /v3/sdk2/archive-sync/:id` | `POST /api/archive/sync/:id` | 오류 본문은 여전히 `archive-sync-v1` 원래 봉투 |
| `GET /v3/sdk2/cache/capabilities` | `GET /api/capabilities/cache` | |
| `POST /v3/sdk2/cache/bindings` | `POST /api/cache/bindings` | |
| `POST /v2/executors/connections` | `POST /api/executors/connections` | |
| `GET /v3/terminal/capabilities` | `GET /api/capabilities/terminal?contract=terminal-services-v1` | |
| `POST /v3/terminal/bindings` | `POST /api/terminal/bindings` | |
| `GET /v3/terminal/sessions/:id/tool-output` | `GET /api/terminal/sessions/:id/tool-output?contract=…&sessionContract=…` | |
| `GET /v3/terminal-observation/sessions/:id/resources` | `GET /api/terminal/observation/sessions/:id/resources` | 접두사 세그먼트가 `terminal/observation`으로 |
| `GET /v3/terminal-profile/sessions/:id/catalog` | `GET /api/terminal/profile/sessions/:id/catalog` | 접두사 세그먼트가 `terminal/profile`로 |

이 표를 손으로 관리하지 마세요. 공식 클라이언트의 경로 모듈은 매니페스트에서 생성되며, 직접 클라이언트를 작성할 때도 `GET /api/manifest` 또는 저장소 안의 `api-manifest.json`에서 생성해야 합니다.

## 요청과 오류 형태의 차이

| 측면 | 이전 접두사 | `/api` |
|---|---|---|
| 세션 패밀리 | 경로로 구분(`/v2`와 `/v3/sdk2`) | 경로는 같고 요청 헤더 `tansr-session-family` |
| 하위 계약 리비전 | 일부는 경로나 본문에 | GET 읽기는 쿼리 문자열 `protocol=` / `contract=`, POST 쓰기는 쿼리 문자열을 받지 않음 |
| 응답 헤더 | 통합 헤더 없음 | 모든 응답이 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`를 가짐 |
| 오류 본문 | `{ error: { code, message, detail? } }`, 코드는 각 패밀리의 어휘 | 8키 통합 봉투. `code`는 19개 통합 코드이고 패밀리 코드는 `detail.domainCode`로 내려감 |
| 일부 오류의 상태 | `session_ended` 409, `binding_closed` 409, `unsupported_capability` 422 / 409 | 410 `gone`, 410 `gone`, 404 `capability_unavailable`(원래 상태는 `detail.domainStatus`) |
| 이벤트 프레임 | 각 도메인의 원래 프레임 | 협상 헤더 없이는 동일. `tansr-event-envelope: unified-v1`을 붙이면 7키 봉투 |
| 멱등 / 조건부 쓰기 / 마감 | 본문 안의 `requestId` / `expectedRevision`뿐 | 추가로 `Idempotency-Key` / `If-Match` / `deadline` 헤더 사용 가능(0.14.0부터). 서버가 본문 안 자리로 매핑 |
| 2xx 응답 본문 | — | **바이트 단위로 동일** |

마이그레이션에서 가장 놓치기 쉬운 것은 오류 판정입니다. `error.code === 'session_ended'` 같은 분기를 통합 코드 `gone` 판정으로 고치고, `retryAction`으로 동작을 정하며, 세분이 필요할 때만 `detail.domainCode`를 읽으세요. 자세한 내용은 [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 보세요.

## 세션 서비스의 `/v1`

세션 서비스 프로세스 안의 `/v1`(`/v1/status`, `/v1/sessions` 패밀리 등 단일 테넌트 Bearer 라우트)과 `/api`는 두 개의 별도 신원 체계이며 `/api` 아래에 그 대응물은 없습니다. `@tansr/serve` 0.13.0부터는 다음과 같습니다.

- **`/api`를 조립한 배포에서 `/v1`은 기본적으로 꺼집니다.** 라이브러리 형태로 `startServer({ v2: … })`를 쓰면 `disableV1`의 기본값은 `true`가 되고 `/v1*` 요청은 404를 받습니다. CLI 형태의 `tansr serve --v2`도 같습니다.
- 전환기 유지: 라이브러리에는 `disableV1: false`를 넘깁니다. CLI에서는 `--legacy-v1`을 붙이거나 환경 변수 `TANSR_SERVE_LEGACY_V1=1`을 설정합니다(플래그가 환경 변수보다 우선).
- `--v2`를 켜지 않은 SDK1 전용 `tansr serve`에는 `/api`가 없고 영향도 받지 않습니다. `/v1`은 예전 그대로입니다.
- `@tansr/serve` 0.14.0과 `@tansr/cli` 0.10.1(2026-10-04)은 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1`을 **사용 중단**으로 표시했습니다. 여전히 유효하지만 시작 시 사용 중단 공지가 출력됩니다. 이것은 별도의 폐기 항목이며 제거 시점은 1.0.0 전에 따로 공지됩니다.

이 사이트 REST 참조의 `/v1`은 플랫폼 측 인터페이스로, 여기서 말하는 세션 서비스 `/v1`과는 무관합니다.

## 6단계 마이그레이션과 현재 진행 상황

| 단계 | 내용 | `@tansr/serve` 0.14.0 시점의 상태 |
|---|---|---|
| 1 | 내부 어댑터: `/api`가 재작성해 기존 도메인 핸들러에 위임하고, 이전 접두사는 바이트 단위로 불변 | 완료(0.13.0) |
| 2 | 이중 쓰기 / 섀도 읽기: 같은 골든 벡터를 이전 진입점과 `/api` 양쪽에서 실행해 성공 본문은 바이트 단위로 동일, 오류 본문은 필드 단위로 같은 출처 | Node와 .NET에는 같은 출처의 대응표와 적합성 리플레이가 있음. Android / iOS / HarmonyOS / Go는 165개 골든 벡터 리플레이로 정렬 |
| 3 | 클라이언트 전환: 각 클라이언트의 소스에 이전 접두사 리터럴이 남지 않음 | Node `@tansr/api-client` 0.3.0 정식판은 전환 완료(`./api`). .NET, Android, iOS, HarmonyOS, Go 메인라인은 전환 완료이며 릴리스 상태는 [언어별 클라이언트](/ko/unified-api/clients/) 참고. `examples/serve-demo`는 공개 SDK 경유로 변경 |
| 4 | 신구 혼용 금지: 같은 세션 패밀리가 두 접두사로 교차 접근되면 구조화된 경고를 냄(거부하지는 않음) | 미착수 |
| 5 | 이전 진입점의 읽기 전용 창: `/v2`, `/v3/*`의 쓰기 작업은 410으로 답하고 읽기는 계속 수리하며 응답에 폐기 헤더를 붙임 | 미착수. **0.14.0에서 시작하지 않으며 빨라야 0.15.0** |
| 6 | 닫기: `/v2`, `/v3/*`의 외부 도달 가능 진입점을 제거하고 이전 접두사는 통합 봉투 404로 답함 | 1.0.0 |

자체 호스팅 다중 레플리카 배포는 3단계 전에 리버스 프록시를 먼저 고쳐야 합니다. `/api/sessions/:id/**`는 `/v2/sessions/:id/**`와 같은 샤드 친화성으로 흘려야 하고, `/api` 아래 4개의 SSE 경로는 같은 장기 연결 규율을 따라야 합니다. 그렇지 않으면 전환 후 레플리카를 가로지르는 404가 발생합니다.

## 폐기 일정

| 마일스톤 | 릴리스 | 공개 계약 변화 |
|---|---|---|
| 2026-10-02 | `@tansr/serve` 0.13.0, `@tansr/protocol` 0.2.0, `@tansr/cli` 0.10.0 | `/api` 정식 사용 가능. `/api`를 조립한 배포에서 `/v1` 기본 꺼짐. `/v2`, `/v3/*`의 1.0.0 폐기 예고 |
| 2026-10-04 | `@tansr/serve` 0.14.0, `@tansr/cli` 0.10.1, `@tansr/api-client` 0.3.0 | 매니페스트 revision 7, 세 요청 헤더. `--legacy-v1` 사용 중단 표시 |
| 0.15.0 이상(미정) | `@tansr/serve` | 4단계 경고와 5단계 읽기 전용 창을 가장 이르게 시작할 수 있는 시점. 읽기 전용 창은 해당 릴리스 노트에 명시됨 |
| 1.0.0 | `@tansr/serve` 1.0.0, `@tansr/api-client` 1.0.0 | `/v2`, `/v3/*` 외부 진입점을 제거하고 `/api`가 유일한 호출 표면이 됨. `unified-v1` 패밀리가 `candidate`에서 `frozen`으로. `@tansr/api-client`의 SDK1 진입점은 사용 중단 표시되고 2.0에서 제거 |

`/v1` 끄기와 `/v2`, `/v3/*` 폐기는 두 개의 독립된 공개 계약 변경이며 각각 릴리스 노트가 있습니다.

## 짝으로 롤백하기

- **서버 롤백은 클라이언트와 짝이어야 합니다.** 0.12.0에는 `/api`가 없습니다. `/api`로 전환한 클라이언트는 `tansr-contract` 헤더가 없는 이전 형태의 404를 받고, 규율에 따라 "계약을 사용할 수 없음"으로 보고하며 자동으로 이전 접두사로 돌아가지 않습니다. 서버를 0.12.0으로 되돌릴 때 Node는 `@tansr/api-client` 0.2.0과 이전 진입점으로 되돌리고 모바일은 이전 릴리스로 되돌리세요.
- **클라이언트는 단독으로 롤백할 수 있습니다.** 0.13.0 / 0.14.0 서버는 `/v2`, `/v3/*`를 유지하므로 이전 클라이언트에 프로토콜 단절이 없습니다. 이는 1.0.0 전까지 유지됩니다.
- 0.13.0과 0.14.0에는 저장 형식 변경이 없습니다. 세션 스토어, 아카이브 호스트, 캐시 매체는 롤백 중 마이그레이션이 필요하지 않습니다.
- 리버스 프록시 템플릿과 클라이언트 전환은 같은 방향으로 움직여야 합니다. 클라이언트가 이미 `/api`로 전환했는데 템플릿을 되돌리면 샤드 친화성을 잃습니다.

## Node 클라이언트의 진입점 마이그레이션

`@tansr/api-client` 0.3.0은 이전 진입점 4개 `./sdk2`, `./sdk2/node`, `./terminal`, `./terminal/node`를 **동결**하고(패키지와 함께 배포, 변경 없음, 삭제 없음) `./api`를 추가했습니다. 권장 마이그레이션 절차:

1. 새 코드는 반드시 `import { createApiClient } from '@tansr/api-client/api'`를 쓰고 작업명으로 호출하며 경로를 조립하지 않습니다.
2. 이전 진입점의 호출 지점을 작업명별로 `api.call(...)`로 옮깁니다. 아카이브 / 캐시 / 터미널의 GET 읽기는 `protocol` / `contract`를 손으로 채울 필요가 없으며 SDK가 작업별 기본 리비전 값을 주입합니다.
3. 오류 처리를 패밀리 코드에서 통합 코드 + `retryAction`으로 고치고 필요하면 `error.domainCode`를 읽습니다.
4. 같은 프로세스, 같은 세션 패밀리 안에서 신구 진입점을 함께 쓰지 마세요. 그것이 바로 4단계가 경고할 "혼용"입니다.
