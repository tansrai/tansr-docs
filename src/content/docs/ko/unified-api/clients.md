---
title: 언어별 클라이언트
description: Node @tansr/api-client/api 0.3.0 정식판의 사용법과 내보내기. .NET, Android, iOS, HarmonyOS, Go 각 클라이언트의 unified-v1(매니페스트 revision 7) 정렬 현황을 릴리스된 버전과 메인라인 소스의 차이와 함께 제시. 그리고 모든 클라이언트가 공통으로 지키는 생성된 경로 모듈, 폴백 없는 응답 게이트, 통합 코드 판정, 세 요청 헤더의 로컬 검증.
zone: docs
category: unified-api
sidebar:
  order: 7
related:
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/discovery-and-closure
  - unified-api/migration
  - getting-started/sdk
  - android
  - ios
  - harmony
  - releases/sdk
sources:
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:packages/api-client/src/api/client.ts
  - tansr-cli:packages/api-client/src/api/index.ts
  - tansr-cli:examples/serve-demo/unified-client.ts
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
lastVerified: '2026-10-05'
---

여섯 클라이언트는 모두 같은 계약에 따라 `unified-v1`을 구현하지만 **릴리스 상태는 다릅니다**. 아래 표는 2026-10-05 시점 각 저장소 메인라인과 공개 릴리스물의 사실입니다. "메인라인 정렬 완료, 미릴리스"라고 적힌 것은 공개 채널에서 설치할 수 있는 버전이 아직 `/api`를 거치지 않는다는 뜻입니다.

| 클라이언트 | 공개 릴리스물 | `/api`(unified-v1) 지원 |
|---|---|---|
| Node `@tansr/api-client` | 0.3.0 정식판(npm, 2026-10-04) | **릴리스됨**: `@tansr/api-client/api` 진입점, 매니페스트 revision 7에 정렬 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet 0.1.0.2 | 메인라인은 revision 7에 정렬 완료(2026-10-03), **미릴리스**. 0.1.0.2는 아직 이전 접두사 |
| Android `com.tansr.sdk:core / client / compose` | Maven Central 0.4.0 | 메인라인은 revision 7에 정렬 완료(2026-10-03), **미릴리스**. 0.4.0은 아직 이전 접두사 |
| iOS `tansrai/tansr-ios-spm` | 공개 바이너리 SPM 0.3.0 | 메인라인은 revision 7에 정렬 완료, **미릴리스**. 0.3.0은 아직 이전 접두사 |
| HarmonyOS HAR `@tansr/harmony` | 번들 HAR 0.1.0(OHPM 채널 없음) | 메인라인은 revision 7에 정렬 완료(2026-10-04), **미릴리스**. 0.1.0은 아직 이전 접두사 |
| Go `github.com/cpple/tansr-go` | 태그 `v0.1.0`(2026-10-02 릴리스 트레인과 함께) | `v0.1.0`은 뼈대: `api` / `canonical` / `sse`는 구현과 테스트가 있고 `executor` / `archive`는 인터페이스만. 메인라인은 그 뒤 revision 7과 세 요청 헤더에 정렬(2026-10-03, 오류 타입의 파괴적 변경 포함)했으나 새 태그는 아직 없음 |

## 모든 클라이언트에 공통인 구현 규율

언어와 무관하게 공식 클라이언트는 다음을 지킵니다. 직접 클라이언트를 작성할 때의 점검표이기도 합니다.

- **경로는 생성물에서만.** 각 저장소에는 `api-manifest.json`에서 생성한 경로 모듈이 있고(Node `API_OPERATIONS`, .NET `Tansr.Sdk.Api.ApiRoutes`, Android `ApiOps`, iOS `ApiOps`, HarmonyOS `ApiOps`, Go `api/operations_gen.go`), 소스에 `/v2`, `/v3/sdk2`, `/v3/terminal` 리터럴이 나타나지 않습니다. 생성물은 상류 커밋 번호와 함께 저장소 안에 잠겨 있고 CI가 어긋나지 않았는지 확인합니다.
- **응답 게이트는 폴백하지 않음.** 모든 응답(2xx와 SSE 열기 포함)은 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`를 모두 갖춰야 하며, 헤더 누락, 중복, 형태 변형, 어휘 밖의 `tansr-*` 헤더는 모두 명시적으로 실패합니다(Node `ContractUnavailableError`, .NET `ContractUnavailableException`, Android `TansrAgentException.ContractUnavailable` / `ApiContractException`, iOS `.contractUnavailable`, HarmonyOS `ApiContractError('contract_unavailable')`, Go `*api.ContractUnavailableError`). 파서를 바꾸지 않고, 이전 접두사로 물러나지 않으며, 자동 재시도도 하지 않습니다.
- **통합 코드가 주.** 오류는 19개 통합 코드 + 6종 `retryAction`으로 판정하며 패밀리 코드는 `detail.domainCode` 안의 세부일 뿐입니다. 패밀리 코드로 분기하던 이전 예외 타입은 전환용 다리로 한 버전만 남기고 사용 중단 표시합니다.
- **세 요청 헤더는 로컬에서 먼저 검증.** 형태가 틀린 `Idempotency-Key`, 약한 검증자이거나 `expectedRevision`이 없는 작업에 쓴 `If-Match`, 만료된 `deadline`은 보내기 전에 거부되며(네트워크로 나가지 않음), 재시도는 같은 옵션을 유지하고 키를 바꾸지 않으며 마감을 연장하지 않습니다.
- **골든 벡터 리플레이.** 각 클라이언트는 `unified-v1.golden.json`의 165개 벡터를 실제 디코더로 리플레이하고, 자신이 선언한 능력의 교집합 밖에 있는 차이를 기록합니다.

## Node: `@tansr/api-client/api`

```bash
npm install @tansr/api-client
```

```ts
import {
  createApiClient, ApiError, DomainError, ContractUnavailableError, ApiClientError,
  retryAdvice, retrySameRequest, isTerminalEvent, API_OPERATIONS, API_CONTRACT_LOCK,
} from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'https://serve.example.com',   // origin only: no path, query or credentials
  token: () => loadEndUserToken(),        // or authorize(headers) for custom schemes
  sessionFamily: 'sdk1',                  // optional; omitted = deployment preferred family
  eventEnvelope: 'unified-v1',            // optional; negotiate the 7-key event envelope
  onContract: (seen) => log.debug('contract', seen, API_CONTRACT_LOCK),
});

try {
  const read = await api.call('archive.binding.get', { params: { id: bindingId } });
  await api.call('archive.binding.close', {
    params: { id: bindingId },
    body: { reason: 'done' },
    idempotencyKey: `close-${bindingId}`,
    ifMatch: read.meta.etag ?? undefined,
    deadline: new Date(Date.now() + 30_000),
  });
} catch (error) {
  if (error instanceof ApiError) {
    const advice = retryAdvice(error);
    if (advice.replayable) { /* retrySameRequest(api, { name, options }, error) */ }
    else if (advice.action === 'refresh') { /* re-read, take the new ETag, resubmit */ }
    else if (advice.action === 'rediscover') { /* GET /api/sessions/:id/capabilities again */ }
  }
  if (error instanceof ContractUnavailableError) { /* not a unified-v1 serve or a gateway stripped the headers */ }
}
```

요점:

- `createApiClient`의 옵션: `baseUrl`(origin만), `token` 또는 `authorize`, `fetch` 주입, `sessionFamily`, `eventEnvelope`, `maxResponseBytes`(기본 2 MiB), `maxEventFrameBytes`(기본 2 MiB), `onContract`.
- 메서드: `manifest()`, `capabilities()`, `sessionCapabilities(sessionId)`(`{ closure, closureId, meta }`를 돌려주며 응답 헤더와 본문의 `closureId`가 일치하는지 확인 완료), `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`, `events(name, { params, query, lastEventId, signal, onOpen })`. `locked`와 `observed()`는 각각 빌드 시 잠근 값과 런타임에 관찰한 revision / `schemaHash`를 알려 줍니다.
- 결과 형태는 `{ status, body, meta }`. `meta`에는 `contract`, `manifestRevision`, `domain`, `schemaHash`, `closureId`, `eventEnvelope`, `traceId`, `etag`, `retryAfterMs`가 있습니다. 202는 수리이지 완료가 아닙니다.
- 오류 타입: `ApiError`(통합 봉투: `code`, `status`, `retryAction`, `traceId`, `requestId`, `domainCode`, `detail`), `DomainError`(정규화되지 않은 패밀리 원래 봉투. 오늘은 `archive-sync-v1`뿐), `ContractUnavailableError`, `ApiClientError`(로컬: `aborted`, `network_error`, `envelope_not_negotiated`, `payload_too_large`, `invalid_response`, `deadline_exceeded`, `if_match_not_applicable` 등).
- `API_OPERATIONS`는 81개 작업의 카탈로그(revision 7)이며 각 항목에 `method`, `apiPath`, `query`, `kind`, `sse`, `etagPath`, `expectedRevision`, `requestIdPath`가 있습니다. 엄격한 패밀리(`sdk2-*`, `terminal-*`, `archive-sync-v1`)의 요청 본문은 SDK가 canonical JSON으로 인코딩합니다.
- 이전 진입점 `./sdk2`, `./sdk2/node`, `./terminal`, `./terminal/node`는 0.3.0에서 동결: 여전히 패키지와 함께 배포되며 변경은 없습니다.

## .NET

메인라인(미릴리스)에서 SDK는 `/api`만 거칩니다. 경로 상수 `Tansr.Sdk.Api.ApiRoutes`는 `node scripts/generate-api-routes.mjs`가 저장소 안에 vendored된 `contract/api-manifest.json`에서 생성합니다. 범용 진입점은 `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`, 클로저는 `client.GetCapabilityClosureAsync(sessionId)`로 얻고, 통합 봉투는 `UnifiedApiException`으로 디코딩됩니다(`Code` / `StatusCode` / `RetryAction`이 주, 패밀리 사실은 `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`). `UnifiedRetry.Advice(error)`와 `UnifiedRetry.RetrySameRequestAsync(...)`가 재시도 규율을 맡고, `TansrClientOptions.NegotiateEventEnvelope`가 이벤트 봉투를 명시적으로 협상하며 되돌아오지 않으면 `EnvelopeNotNegotiatedException`을 던집니다. NuGet의 0.1.0.2는 이 변경들보다 앞선 것입니다.

## Android

메인라인(미릴리스)에서 모든 HTTP 요청은 `/api`만 거칩니다. 생성물 `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt`(`ApiContract` 상수와 `ApiOps` 81개 작업, `etagPath` / `expectedRevision` 포함)와 `UnifiedContract.kt`(`UnifiedCode` 19개 코드, `UnifiedRetryAction` 6개 동작). 응답 게이트는 `ApiContractGate.requireUnifiedValues`. 오류는 `TansrAgentException.Unified`(SDK1) 또는 `ApiFacadeException`(SDK2 / 터미널)으로 떨어지고 이전의 sealed 타입 33개는 사용 중단 표시. 세 요청 헤더는 `ApiCallOptions(idempotencyKey, ifMatch, deadline)`을 통해 `Sdk2Client.createBinding / acknowledge / closeBinding`과 `TerminalClient.configure / memoryCommand`에 선택적으로 붙일 수 있습니다. 생성기는 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>`이고 `:core:contractCheck`에 같은 출처의 대응표와 165개 골든 벡터 리플레이가 포함됩니다. Maven Central의 0.4.0은 이 변경들보다 앞선 것입니다. 연동 기본은 [Android SDK](/ko/android/)를 보세요.

## iOS

메인라인(미릴리스)에서 경로의 단일 소스는 `Sources/TansrCore/Api/ApiContract.swift`(`ApiContract`, `ApiOps` 81개 작업)입니다. 응답 헤더 게이트 `ApiContractGate.requireUnified`는 SDK1의 모든 2xx 응답, 이벤트 스트림 열기, 오디오 클라이언트를 덮으며, 위반은 `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable`이 되고 이벤트 펌프는 2xx 형태의 계약 불가에 대해 바로 `failed` 종료 상태로 들어갑니다. 오류 모델은 `TansrAgentError.kind == .unified`(`unifiedCode` + `retryAction`)와 `ApiFacadeError`. `ApiCallOptions`가 세 요청 헤더를 나르고, `onManifestRevisionDrift`는 응답 revision이 로컬 revision 7과 다를 때 클라이언트마다 한 번 발화합니다. CI `contract:check`와 전체 패키지 `swift test`에 골든 벡터 리플레이가 포함됩니다. 공개 바이너리 SPM 0.3.0은 이 변경들보다 앞선 것입니다. 연동 기본은 [iOS SDK](/ko/ios/)를 보세요.

## HarmonyOS

메인라인(미릴리스)에서 업무 코드는 `ApiOps.*.apiPath` / `apiPath()`만 참조합니다. 생성물 `tansr/src/main/ets/core/api/ApiContractGenerated.ets`, `core/api/UnifiedContractGenerated.ets`, `core/sdk2/client/SchemaGenerated.ets`는 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>`가 매니페스트, `sdk2-ext-v1.schema.json`, `unified-v1.schema.json`, `unified-v1.golden.json`에서 같은 출처로 생성하며 `pnpm check:contract`가 생성물과 잠금의 정합을 확인합니다. 네 통합 응답 헤더 중 하나라도 빠지면 `contract_unavailable`(`reason` 포함)이고 세션 펌프는 2xx 형태의 계약 불가에 대해 바로 `failed` 종료 상태로 들어갑니다. SDK1은 `AgentError`로 복원하고(`error.unified`, `error.retryAction`, `error.domainCode`) SDK2 / 터미널은 `ApiFacadeError`를 바로 던집니다. 세 요청 헤더는 `ApiCallOptions(idempotencyKey, ifMatch, deadline)`으로 로컬에서 먼저 판정됩니다. 번들 HAR 0.1.0은 이 변경들보다 앞선 것입니다. 연동 기본은 [HarmonyOS SDK](/ko/harmony/)를 보세요.

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/cpple/tansr-go`(표준 라이브러리만 사용, 서드파티 의존성 없음): 하위 패키지 `api`(디스커버리 / `Call` / `Events` / 오류 봉투 / 재시도 조언), `canonical`, `sse`에는 구현과 테스트가 있고 `executor`, `archive`는 인터페이스 정의만 있으며 실제 세션 서비스와의 연동 검증은 아직 진행 전입니다. 태그 `v0.1.0`은 2026-10 릴리스 트레인과 함께 찍혔습니다. 메인라인은 그 뒤 `APIError.Code` / `RetryAction`을 타입이 있는 상수(`api.Code*` 19개, `api.Action*` 6개, `Detail.DomainCode`는 부차 필드)로 고치고 세 요청 헤더(`CallOptions.IfMatch` / `Deadline` / `IdempotencyKey`, `Meta.ETag`는 강한 형태만 받음)를 연결했습니다. 이 변경들은 `v0.1.0`에 대해 파괴적이며 새 태그는 아직 찍히지 않았습니다.

## 다음 단계

- 각 클라이언트가 같은 방식으로 판정하는 오류와 동작을 이해하려면 [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 읽으세요.
- 모바일이나 데스크톱에서 `/api`에 미리 정렬하려면 각 저장소의 메인라인으로 빌드하세요. 공개 채널의 새 버전은 각 저장소의 릴리스 기록과 이 사이트의 [릴리스 노트](/releases/sdk/)에 등록됩니다.
