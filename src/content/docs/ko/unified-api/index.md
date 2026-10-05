---
title: 통합 API 계약(/api) 개요
description: '@tansr/serve 0.13.0부터 /api는 세션 서비스의 유일한 공개 HTTP 호출 표면입니다(계약명 unified-v1). 이 페이지는 3개 계약 계층, 각 버전의 도달 시점, 가장 짧은 실행 가능 예제, 개발자 7대 규율을 제시하고 디스커버리와 능력 클로저, 통합 헤더와 오류 봉투, 이벤트 봉투, 마이그레이션, 언어별 클라이언트로 안내합니다.'
zone: docs
category: unified-api
sidebar:
  order: 1
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - unified-api/clients
  - serve/v2-and-webhooks
  - getting-started/serve
  - releases/serve
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api`는 `@tansr/serve`가 외부에 공개하는 **유일한** HTTP 호출 표면입니다. 세션, 실행, 아카이브, 캐시, 터미널 등 모든 도메인이 이 하나의 접두사 아래에 있으며 같은 요청 헤더, 응답 헤더, 오류 봉투, 이벤트 봉투를 공유합니다. 계약명은 `unified-v1`이고, `@tansr/serve` 0.13.0(2026-10-02 릴리스)부터 정식으로 사용할 수 있습니다. 그 이전에 도메인별로 나뉘어 있던 `/v2`, `/v3/sdk2`, `/v3/terminal*`는 프로세스 안에 남아 있지만 내부 어댑터 진입점으로만 쓰입니다. `/v1`은 `/api`를 조립한 배포에서 기본적으로 꺼져 있습니다.

세션 서비스를 처음 접한다면 먼저 [세션 서비스 5분 만에 실행하기](/ko/getting-started/serve/)로 서버를 띄운 뒤 여기로 돌아오세요. 이미 `/v2` 프로토콜을 쓰고 있다면 바로 [마이그레이션과 폐기 일정](/ko/unified-api/migration/)으로 가세요.

## 3개 계약 계층

| 계층 | 내용 | 무엇이 정하는가 |
|---|---|---|
| 공통 봉투(Common Envelope) | 요청 헤더, 응답 헤더, 통합 오류 봉투, 통합 이벤트 봉투, 멱등성과 전제 조건 의미론 | 이 장의 각 페이지. 와이어 형태는 `doc/rfc/unified-v1.schema.json`과 165개의 골든 벡터가 기준 |
| 능력 매니페스트(Capability Manifest) | 경로 템플릿, 메서드, 쿼리 키, 읽기 / 쓰기 / 스트림 분류, 능력 항목과 한계값 | `packages/server/contract/api-manifest.json`(현재 revision 7) |
| 도메인 하위 계약(Domain Subcontracts) | 각 도메인의 요청 / 응답 본문, 이벤트 페이로드, 도메인 내 오류 코드 | `agent-session-v1`, `sdk2-ext-v1`, `terminal-services-v1` 등 11개 패밀리 |

세 계층의 분담은 고정되어 있습니다. 공통 봉투는 **어떻게 호출하는지**를, 능력 매니페스트는 **무엇을 호출할 수 있는지**를, 도메인 하위 계약은 **본문에 무엇이 들어가는지**를 정합니다. `/api`는 어떤 도메인 하위 계약의 성공 응답 본문도 다시 쓰지 않습니다. 같은 작업을 `/api`로 호출하든 이전 접두사로 호출하든 2xx 본문은 바이트 단위로 동일하며, 바뀌는 것은 헤더, 오류 형태, 그리고 (명시적으로 협상한 경우) 이벤트 프레임의 바깥 형태뿐입니다.

## 호출 한 번은 이렇게 생겼습니다

```http
POST /api/sessions/0a1b2c3d/messages HTTP/1.1
Authorization: Bearer <short-lived token>
Content-Type: application/json
tansr-closure-id: 9f3c…e1

{"prompt":"hi"}
```

```http
HTTP/1.1 202 Accepted
tansr-contract: unified-v1
tansr-manifest-revision: 7
tansr-domain: session
tansr-schema-hash: sha256:6e1876ed…
content-type: application/json

{"sessionId":"0a1b2c3d","accepted":true}
```

모든 `/api` 응답(2xx와 SSE 열기 포함)은 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` 네 헤더를 가집니다. 하나라도 빠지면 클라이언트는 계속 파싱하지 말고 "계약을 사용할 수 없음"으로 판정해야 합니다. 자세한 내용은 [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 보세요.

## 각 버전의 도달 시점

| 릴리스 | 날짜 | `/api`와 관련된 변경 |
|---|---|---|
| `@tansr/serve` 0.13.0 | 2026-10-02 | `/api` 정식 사용 가능. 통합 오류 봉투(19개 통합 코드, 6종 `retryAction`). 명시적으로 협상하는 7키 이벤트 봉투. 디스커버리 엔드포인트와 세션 단위 능력 클로저. `/api`를 조립한 배포에서 `/v1` 기본 꺼짐(라이브러리 옵션 `disableV1`, CLI는 `tansr serve --legacy-v1` 또는 `TANSR_SERVE_LEGACY_V1=1`로 전환기 동안 유지) |
| `@tansr/protocol` 0.2.0 | 2026-10-02 | 첫 공개 릴리스. `@tansr/protocol/canonical` 진입점(엄격한 JSON의 canonical 인코딩 / 디코딩과 도메인 다이제스트) |
| `@tansr/serve` 0.14.0 | 2026-10-04 | 매니페스트 revision 7: 81개 작업, `approval.credential.submit`(`POST /api/approvals/:id/credential`) 추가, 권한 / 질문 응답이 `:ticketId` 자리표시자로 변경. 세 요청 헤더 `Idempotency-Key`, `If-Match`(`ETag`와 짝), `deadline` 연결. `--legacy-v1` / `TANSR_SERVE_LEGACY_V1`은 사용 중단 표시되고 시작 시 경고 |
| `@tansr/cli` 0.10.1 | 2026-10-04 | `tansr serve --legacy-v1` 사용 중단 표시(여전히 유효) |
| `@tansr/api-client` 0.3.0 | 2026-10-04 | 정식판: `@tansr/api-client/api` 진입점(`createApiClient`), 작업 카탈로그는 revision 7에 정렬, 세 요청 헤더를 호출 옵션으로 노출. 이전 진입점 `./sdk2`, `./sdk2/node`, `./terminal`, `./terminal/node`는 동결되며 삭제되지 않음 |

이 장의 모든 페이지는 위 표의 **릴리스된** 버전을 기준으로 사실을 기술합니다. 적힌 능력은 모두 `@tansr/serve` 0.14.0에서 사용할 수 있으며 "후보" 항목은 없습니다.

## 가장 짧은 실행 가능 예제(Node)

```ts
import { createApiClient, ApiError } from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'http://127.0.0.1:8787',
  token: () => loadEndUserToken(), // your own loader for the short-lived bearer token
  eventEnvelope: 'unified-v1',
});

const created = await api.call('session.create', { body: {} });
const sessionId = (created.body as { sessionId: string }).sessionId;

const { closureId } = await api.sessionCapabilities(sessionId);
await api.call('session.message.send', { params: { id: sessionId }, body: { prompt: 'hi' }, closureId });

for await (const frame of api.events('session.events.observe', { params: { id: sessionId } })) {
  if (frame.envelope.type === 'msg.text.delta') process.stdout.write(String(frame.envelope.raw['text'] ?? ''));
  if (frame.envelope.terminalStatus !== null) break;
}
```

이 코드에는 손으로 쓴 `/api/...` 경로가 하나도 없습니다. 작업명 `session.create`, `session.message.send`, `session.events.observe`는 패키지에 함께 생성된 작업 카탈로그에서 오고, 경로는 SDK가 매니페스트 템플릿으로부터 로컬에서 조립합니다. 오류는 `ApiError`(통합 봉투)로 던져지며, `error.code`는 19개 통합 코드 중 하나이고 `error.retryAction`이 다음에 무엇을 해야 하는지 알려 줍니다. 다른 언어의 현황은 [언어별 클라이언트](/ko/unified-api/clients/)를 보세요.

## 개발자 7대 규율

이 일곱 조항은 계약 본문에서 온 것이며 모든 공식 클라이언트가 이에 따라 구현되어 있습니다. 직접 클라이언트를 작성할 때도 한 조항씩 대조하세요.

1. **조용히 다운그레이드하지 않는다.** 응답에 `tansr-contract: unified-v1` 헤더가 없으면 계약을 사용할 수 없는 것으로 보고, `/v2`나 `/v3`로 바꿔 가는 대신 보고합니다. 이벤트 봉투를 요청했는데 서버가 같은 이름의 헤더를 되돌려주지 않으면 협상되지 않은 것으로 처리합니다.
2. **응답에서 URL을 가져오지 않는다.** 디스커버리 엔드포인트는 탐색 가능한 필드를 전혀 돌려주지 않습니다. 경로는 매니페스트 템플릿과 경로 매개변수로부터 로컬에서만 조립합니다.
3. **부작용을 알 수 없는 것을 재전송하지 않는다.** 서버가 `retryAction: same-request`를 명시하고 같은 `Idempotency-Key`를 계속 쓰는 경우에만 한 번 재전송합니다. `result_unknown` 뒤에는 상태 조회만 할 수 있습니다.
4. **본문에 신원을 넣지 않는다.** 인증은 `Authorization` 헤더에서만 합니다. 본문의 신원 필드가 인증 결과와 다르면 거부됩니다.
5. **SSE 종료도 202도 완료가 아니다.** 턴 / 작업의 종료 상태는 이벤트 봉투의 `terminalStatus`로만 판단합니다.
6. **다섯 커서는 서로 대체할 수 없다.** `eventCursor`, `archiveCoverage`, `outputWatermark`, `materialConsumed`, `ackReceipt`는 각각 따로 전진합니다. 하나로 다른 것을 재개하면 안 됩니다.
7. **이전 접두사를 손으로 쓰지 않는다.** 소스에 `/v2`, `/v3/sdk2`, `/v3/terminal` 리터럴을 두지 않고, 같은 세션 패밀리에는 한 종류의 접두사로만 접근합니다.

## 이 장의 안내

| 페이지 | 답하는 질문 |
|---|---|
| [호출 표면, 도메인과 작업 카탈로그](/ko/unified-api/surface/) | `/api` 아래에 어떤 도메인과 작업이 있는지, 경로를 어떻게 조립하는지, 쿼리 문자열의 리비전 식별자를 어떻게 붙이는지 |
| [디스커버리와 능력 클로저](/ko/unified-api/discovery-and-closure/) | 시작할 때 무엇을 먼저 물어야 하는지, `closureId`가 무엇인지, 클로저 밖의 작업에는 무엇이 돌아오는지 |
| [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/) | 요청에 붙일 수 있는 헤더, 모든 응답이 반드시 가지는 헤더, 19개 통합 코드와 6종 `retryAction`을 읽는 법 |
| [이벤트 스트림과 통합 이벤트 봉투](/ko/unified-api/events/) | 4개의 SSE 라우트, 명시적 협상, 7키 봉투, `terminalStatus` 판정과 재개 |
| [마이그레이션과 폐기 일정](/ko/unified-api/migration/) | `/v1`, `/v2`, `/v3`에서 `/api`로 어떻게 전환하는지, 이전 접두사는 언제 폐기되는지, 어떻게 짝으로 롤백하는지 |
| [언어별 클라이언트](/ko/unified-api/clients/) | Node / .NET / Android / iOS / HarmonyOS / Go 각각의 unified-v1 정렬 현황 |
