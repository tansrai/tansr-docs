---
title: 호출 표면, 도메인과 작업 카탈로그
description: /api 아래의 9개 도메인, 매니페스트 revision 7의 11개 패밀리와 81개 작업(읽기 39 / 쓰기 38 / 스트림 4), 작업 명명과 경로 템플릿, 쿼리 문자열의 리비전 식별자, 세션 패밀리 요청 헤더, 그리고 /api에 속하지 않는 경로.
zone: docs
category: unified-api
sidebar:
  order: 2
related:
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - serve/env
sources:
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/src/api/route-table.ts
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
lastVerified: '2026-10-13'
---

`/api`의 호출 가능한 표면 전체는 기계가 읽을 수 있는 하나의 능력 매니페스트(manifest)로 정의됩니다. 각 작업에는 안정적인 이름, HTTP 메서드, 경로 템플릿, 허용되는 쿼리 키, 읽기 / 쓰기 / 스트림 분류가 있습니다. 공식 클라이언트의 경로 모듈은 모두 이 매니페스트에서 생성되며, 이 페이지는 그중 "어떻게 호출하는가"와 관련된 사실을 펼쳐 보입니다.

## 조립 조건과 접두사

- `/api`는 `/v2` 세션 표면과 함께 조립됩니다. 라이브러리 형태에서는 `startServer({ v2: … })`, CLI 형태에서는 `tansr serve --v2`(또는 `TANSR_SERVE_V2=1`)입니다. `--v2` 없이 SDK1만 켠 `tansr serve`에는 `/api`가 없습니다.
- `/api`가 유일한 공개 접두사입니다. `/v2`, `/v3/sdk2`, `/v3/terminal`, `/v3/terminal-observation`, `/v3/terminal-profile`은 프로세스 안에 남지만 내부 어댑터 진입점으로만 쓰이며 1.0.0에서 외부 도달성이 제거됩니다. [마이그레이션과 폐기 일정](/ko/unified-api/migration/)을 보세요.
- `/healthz`, `/readyz`, `/metrics`는 `/api` 아래에 있지 않고 이 계약의 대상도 아닙니다. 배포 표면은 [배포와 인증](/ko/serve/deploy-and-auth/)을 보세요.
- 경로 매개변수는 서버에서 퍼센트 디코딩한 뒤 매칭됩니다. 디코딩할 수 없는 세그먼트는 존재하지 않는 리소스로 처리되며(404 `not_found`) 내부 경로가 새지 않습니다.

## 9개 도메인

| 도메인(`tansr-domain`) | 작업 수 | 범위 | 소속 패밀리 |
|---|---|---|---|
| `discovery` | 3 | 매니페스트, 전역 능력, 세션 단위 능력 클로저 | `unified-v1` |
| `session` | 26 | 세션 수명 주기, 메시지, 이벤트 스트림, 도구 / 권한 / 질문 응답, 스냅샷, 오디오, 입력, 승인 자격 증명 | `agent-session-v1` |
| `execution` | 9 | 실행 초기화와 경계, 실행 바인딩, 실행기 등록 / 하트비트 / 수령 / 영수증 | `sdk2-ext-v1` |
| `archive` | 16 | 아카이브 바인딩, 아카이브 상태와 레코드, ACK 커밋과 리베이스, 자료 응답과 업로드 | `sdk2-ext-v1`, `sdk2-archive-recovery-v1` |
| `archive-sync` | 1 | 아카이브 동기화 | `archive-sync-v1` |
| `cache` | 10 | 캐시 바인딩의 열기 / 갱신 / 재바인딩 / 교체 / 닫기, 진단 | `sdk2-cache-v1`, `sdk2-cache-core-v1` |
| `terminal` | 12 | 터미널 바인딩, 실행기 이벤트 스트림, 출력 배치와 관찰, 세션 구성과 메모리 | `terminal-services-v1` |
| `terminal-observation` | 2 | 리소스와 출력 상관 조회 | `terminal-observation-v1` |
| `terminal-profile` | 2 | 프로필 카탈로그와 사용량 | `terminal-profile-v1` |

도메인은 `/api` 계층의 개념으로 응답 헤더 `tansr-domain`, 오류 매트릭스 그룹 분류, 능력 클로저에 쓰입니다. 패밀리(family)는 도메인 하위 계약의 버전 단위입니다. 매니페스트 revision 7에는 11개 패밀리가 있으며(위의 10개에 더해 아직 `/api` 진입점이 없는 `terminal-shell-sandbox-v1`), 각 패밀리의 `status` 필드가 성숙도를 나타냅니다. `agent-session-v1`은 `frozen`, `sdk2-ext-v1`은 `final`, `unified-v1`과 `terminal-services-v1`은 `candidate`, `sdk2-cache-v1`은 `drafted`, 나머지는 `additive`입니다.

## 작업 명명과 경로 템플릿

작업명은 `도메인.리소스.동사` 형태입니다. `session.message.send`, `archive.binding.create`, `cache.binding.renew`, `terminal.output.observe`처럼 생겼습니다. 경로 템플릿은 `:id`, `:targetId`, `:ticketId`, `:uploadId` 자리표시자를 쓰며 클라이언트는 엄격하게 채웁니다. 매개변수 누락이나 초과, 빈 세그먼트, 인코딩되지 않은 `/`는 로컬에서 거부해야 합니다. 소수의 작업에는 별칭이 있는데(예를 들어 `terminal.configuration.read`는 `/api/terminal/sessions/:id/configuration`과 `/api/sessions/:id/configuration`을 모두 받습니다), 별칭은 호환성을 위한 진입점일 뿐이며 생성된 클라이언트는 항상 주 경로를 씁니다.

아래는 각 도메인의 대표 작업입니다(81개 전체는 매니페스트가 기준).

| 작업 | 메서드와 경로 | 종류 |
|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | 읽기 |
| `discovery.capabilities` | `GET /api/capabilities` | 읽기 |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | 읽기 |
| `session.create` | `POST /api/sessions` | 쓰기 |
| `session.get` | `GET /api/sessions/:id` | 읽기 |
| `session.message.send` | `POST /api/sessions/:id/messages` | 쓰기 |
| `session.events.observe` | `GET /api/sessions/:id/events` | 스트림 |
| `session.interrupt` | `POST /api/sessions/:id/interrupt` | 쓰기 |
| `session.tool.result` | `POST /api/sessions/:id/tool-results/:targetId` | 쓰기 |
| `session.permission.decide` | `POST /api/sessions/:id/permission/:ticketId` | 쓰기 |
| `session.question.answer` | `POST /api/sessions/:id/questions/:ticketId` | 쓰기 |
| `session.checkpoint.create` | `POST /api/sessions/:id/checkpoints` | 쓰기 |
| `session.close` | `DELETE /api/sessions/:id` | 쓰기 |
| `approval.credential.submit` | `POST /api/approvals/:id/credential` | 쓰기 |
| `execution.binding.create` | `POST /api/sessions/:id/execution-bindings` | 쓰기 |
| `executor.register` | `POST /api/executors/connections` | 쓰기 |
| `executor.operations.poll` | `GET /api/executors/:id/operations` | 읽기 |
| `archive.binding.create` | `POST /api/archive/bindings` | 쓰기 |
| `archive.binding.get` | `GET /api/archive/bindings/:id` | 읽기 |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | 스트림 |
| `archive.records.read` | `GET /api/archive/bindings/:id/archive/records` | 읽기 |
| `archive.ack.commit` | `POST /api/archive/bindings/:id/archive/acks` | 쓰기 |
| `archive.ack.rebase` | `POST /api/archive/bindings/:id/archive/ack-rebases` | 쓰기 |
| `material.upload.chunk` | `POST /api/archive/bindings/:id/materials/:targetId/uploads/:uploadId/chunks` | 쓰기 |
| `archive.sync` | `POST /api/archive/sync/:id` | 쓰기 |
| `cache.binding.open` | `POST /api/cache/bindings` | 쓰기 |
| `cache.binding.renew` | `POST /api/cache/bindings/:id/renew` | 쓰기 |
| `cache.diagnostics` | `GET /api/cache/bindings/:id/diagnostics` | 읽기 |
| `terminal.binding.create` | `POST /api/terminal/bindings` | 쓰기 |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | 스트림 |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | 스트림 |
| `terminal.configuration.commit` | `POST /api/terminal/sessions/:id/configuration` | 쓰기 |
| `terminal.memory.command` | `POST /api/terminal/sessions/:id/memory/commands` | 쓰기 |
| `terminal.observation.resources` | `GET /api/terminal/observation/sessions/:id/resources` | 읽기 |
| `terminal.profile.usage` | `GET /api/terminal/profile/sessions/:id/usage` | 읽기 |

읽기 / 쓰기 / 스트림 세 종류의 차이는 메서드만이 아닙니다. `Idempotency-Key`를 받는 것은 **쓰기** 작업뿐이고, `If-Match`를 받는 것은 매니페스트에 `expectedRevision`이 등록된 9개 쓰기 작업뿐이며, 이벤트 봉투 협상에 참여하는 것은 4개의 **스트림** 작업뿐입니다. [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)와 [이벤트 스트림과 통합 이벤트 봉투](/ko/unified-api/events/)를 보세요.

## 쿼리 문자열의 리비전 식별자

도메인 하위 계약의 리비전은 경로가 아니라 쿼리 문자열에 들어가며 **GET 작업(읽기와 스트림)**에만 나타납니다.

| 도메인 | 쿼리 키 | 값 |
|---|---|---|
| `execution`, `archive`의 GET 읽기와 스트림, 그리고 `session.capabilities`(`GET /api/capabilities/sessions`) | `protocol` | `sdk2-ext-v1` |
| `cache`의 GET 읽기 | `protocol` | `sdk2-cache-v1`. `cache.core.diagnostics`는 `sdk2-cache-core-v1` |
| `terminal`, `terminal-observation`, `terminal-profile`의 GET 읽기와 스트림 | `contract`, `sessionContract` | `terminal-services-v1` / `terminal-observation-v1` / `terminal-profile-v1`. `sessionContract`는 세션이 속한 패밀리를 가리킴 |

세 가지 규칙:

- 쓰기 작업은 쿼리 키를 받지 않습니다(유일한 예외는 `session.checkpoint.import`의 선택적 `label`). 디스커버리 엔드포인트 3개, `GET /api/capabilities/archive`, `GET /api/capabilities/cache`도 마찬가지로 받지 않습니다. 남는 키는 모두 400 `invalid_request`입니다.
- `protocol`을 붙였는데 값이 그 작업에 등록된 리비전이 아니면(예: `protocol=sdk2-ext-v0`) 400 `protocol_mismatch`입니다.
- 각 작업이 허용하는 쿼리 키는 닫힌 허용 목록입니다(예: `archive.records.read`는 `protocol`, `historyEpoch`, `deletionGeneration`, `projectionRevision`, `limit`, `maxBytes`, `afterSequence`를 허용). 목록 밖의 키도 마찬가지로 400입니다.

`@tansr/api-client/api`는 작업이 속한 패밀리에 따라 `protocol` / `contract`의 기본값을 자동으로 주입합니다(명시적으로 넘긴 값이 우선). 여러분은 업무용 쿼리 키만 넘기면 됩니다.

## 세션 패밀리

세션에는 두 패밀리가 있습니다. `sdk1`(커널이 세션 서비스 프로세스 안에서 실행)과 `sdk2-offload-v1`(실행을 바인딩된 터미널 실행기로 오프로드)입니다. 이전 접두사는 경로로 구분했지만 `/api`에서는 경로가 같고 요청 헤더 `tansr-session-family: sdk1 | sdk2-offload-v1`이 선언합니다. 이 헤더가 없으면 서버는 배포의 선호 패밀리를 쓰며, 선호 패밀리와 사용 가능한 패밀리는 `GET /api/capabilities` 응답의 `domains.session.family.preferred` / `available`에서 읽을 수 있습니다. 어휘 밖의 값은 400 `invalid_request`, 어휘 안이지만 이 배포에 조립되지 않은 패밀리는 `capability_unavailable`(`detail.reason: not_installed`)입니다.

## `/api`에 없는 것

- `/v1`의 단일 테넌트 라우트 6개(`/v1/status`, `/v1/sessions` 패밀리 등)는 작업 카탈로그에 없고 `/api` 아래에 대응물도 없습니다. `approval.credential.submit`은 `/v1`에서 `/api`로 옮겨진 유일한 작업입니다. `/api`를 조립한 배포에서 `/v1`은 기본적으로 꺼져 있습니다. 자세한 내용은 [마이그레이션과 폐기 일정](/ko/unified-api/migration/)을 보세요.
- 플랫폼 측 인터페이스(`/t1/*`, `/v1/app-tokens`, `/v1/my-usage` 등)는 매니페스트의 `platformApi` 필드에서 읽기 전용으로 참조될 뿐이며, 호스트는 플랫폼이지 여러분의 세션 서비스가 아닙니다.
- Electron 전체 SDK와 IPC 모드는 `/api`를 거치지 않습니다.
