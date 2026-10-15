---
title: 언어별 클라이언트
description: Node @tansr/api-client 0.4.0 정식판. ./api 사용법과 내보내기는 0.3.0과 같고, 동결된 진입점의 기본 경로는 /api. .NET 0.2.0, Android 0.5.0, iOS 0.4.0, HarmonyOS HAR 0.2.0, Go v0.3.0, Rust / Python / C++ 0.1.0 등 공개된 클라이언트의 설치 명령, 런타임 요건, 릴리스 날짜. 모든 클라이언트가 공통으로 지키는 생성된 경로 모듈, 폴백 없는 응답 게이트, 통합 코드 판정, 세 요청 헤더의 로컬 검증.
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
  - tansr-cli:packages/api-client/package.json
  - tansr-cli:packages/api-client/src/api/client.ts
  - tansr-cli:packages/api-client/src/api/index.ts
  - tansr-cli:packages/api-client/src/api/errors.ts
  - tansr-cli:packages/api-client/src/api/types.ts
  - tansr-cli:packages/api-client/src/api/operations-generated.ts
  - tansr-cli:examples/serve-demo/unified-client.ts
  - tansr-cli:doc/release/REL-14-2026.10统一API发行车-发行说明-2026-10-02.md
  - tansr-cli:doc/report/UAPI-统一API合同-开发方案-2026-09-30.md
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-ios:doc/report/REL-FULL-20261010-iOS-0.4.0.md
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
lastVerified: '2026-10-13'
---

아홉 클라이언트는 모두 같은 계약에 따라 `unified-v1`을 구현하지만 **릴리스 주기는 다릅니다**. 아래 표는 2026-10-13 기준입니다. 버전 번호와 날짜는 그날 읽은 레지스트리 기록(npm, NuGet, Maven Central, `tansrai/tansr-ios-spm`의 GitHub Release, Go 모듈 프록시, crates.io, PyPI, `tansrai/tansr-cpp`의 GitHub Release)대로 적었고, 날짜는 레지스트리 기록의 UTC 날짜입니다. HarmonyOS는 공개 패키지 레지스트리가 없으므로 공식 다운로드 페이지와 함께 배포되는 HAR로 적습니다. 각 행 끝에는 공개 채널에서 이전 접두사를 쓰는 마지막 버전을 적었습니다. 그 버전 이하를 설치한 앱은 업그레이드한 뒤에야 이 장의 설명대로 동작합니다.

| 클라이언트 | 공개 릴리스물 | `/api`(unified-v1) 지원 |
|---|---|---|
| Node `@tansr/api-client` | 0.4.0 정식판(npm, 2026-10-06, `latest`) | **릴리스됨**: `./api`는 0.3.0과 같고 매니페스트 revision 7에 맞음. `routePrefixes`를 넘기지 않는 동결된 `./sdk2` / `./terminal`은 기본적으로 `/api`. 이전 접두사가 필요하면 `LEGACY_ROUTE_PREFIXES`를 넘김. `./api`는 0.3.0부터 제공되며 0.2.0에는 이 진입점이 없음 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet **0.2.0**(2026-10-07. 0.1.0.2도 남아 있음) | **릴리스됨**. 0.2.0은 매니페스트 revision 7에 맞음. 0.1.0.2는 그 정렬보다 앞서며 아직 이전 접두사 |
| Android `com.tansr.sdk:core / client / compose` | Maven Central **0.5.0**(2026-10-07. 선택 모듈 `receiver-android`도 같은 버전으로 처음 게시) | **릴리스됨**. 0.5.0은 매니페스트 revision 7에 맞고 오류는 통합 코드가 주. 0.4.0 이하는 아직 이전 접두사 |
| iOS `tansrai/tansr-ios-spm` | 공개 바이너리 SPM **0.4.0**(2026-10-09) | **릴리스됨**. 0.4.0은 매니페스트 revision 7에 맞고 SDK2 클라이언트, 아카이브 동기화, 터미널 인터페이스를 처음으로 함께 제공. 0.3.0은 아직 이전 접두사 |
| HarmonyOS HAR `@tansr/harmony` | 번들 HAR **0.2.0**(2026-10-10. 공식 다운로드 페이지의 HarmonyOS 데모 패키지에 담아 배포, OHPM 채널 없음) | **릴리스됨(번들)**. 0.2.0은 unified-v1 계약에 들어왔고 업무 코드는 `/api`만 거침. 0.1.0은 아직 이전 접두사 |
| Go `github.com/tansrai/tansr-go` | 모듈 **v0.3.0**(2026-10-07) | **릴리스됨**. v0.2.0부터 상위 세션, 실행기, 아카이브가 `/api`를 통과. v0.3.0은 모듈 경로만 `github.com/cpple/tansr-go`에서 옮김 |
| Rust `tansr-sdk` / `tansr-sdk-demo` | crates.io **0.1.0**(2026-10-08) | **릴리스됨**. 비동기 클라이언트가 통합 `/api`를 사용 |
| Python `tansr-sdk` / `tansr-sdk-demo` | PyPI **0.1.0**(2026-10-08) | **릴리스됨**. 동기 API와 asyncio가 같은 `/api` 구현을 공유 |
| C++ `tansrai/tansr-cpp` | GitHub Release **v0.1.0**(2026-10-08) | **릴리스됨**. 정적 SDK와 독립 데모 세 개. Conan Center와 공개 vcpkg 색인에는 아직 없음 |

## 모든 클라이언트에 공통인 구현 규율

언어와 무관하게 공식 클라이언트는 다음을 지킵니다. 직접 클라이언트를 작성할 때의 점검표이기도 합니다.

- **경로는 생성물에서만.** 각 저장소에는 `api-manifest.json`에서 생성한 경로 모듈이 있고(Node `API_OPERATIONS`, .NET `Tansr.Sdk.Api.ApiRoutes`, Android `ApiOps`, iOS `ApiOps`, HarmonyOS `ApiOps`, Go `api/operations_gen.go`, Rust `src/api/operations.rs`, Python `tansr_sdk/api/operations.py`, C++ `include/tansr/operations.hpp`), 소스에 `/v2`, `/v3/sdk2`, `/v3/terminal` 리터럴이 나타나지 않습니다. 생성물은 상류 커밋 번호와 함께 저장소 안에 잠겨 있고 CI가 어긋나지 않았는지 확인합니다.
- **응답 게이트는 폴백하지 않음.** 모든 응답(2xx와 SSE 열기 포함)은 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`를 모두 갖춰야 하며, 헤더 누락, 중복, 형태 변형, 어휘 밖의 `tansr-*` 헤더는 모두 명시적으로 실패합니다(Node `ContractUnavailableError`, .NET `ContractUnavailableException`, Android `TansrAgentException.ContractUnavailable` / `ApiContractException`, iOS `.contractUnavailable`, HarmonyOS `ApiContractError('contract_unavailable')`, Go `*api.ContractUnavailableError`, Rust `Error::Contract`, Python은 `code == "contract"`인 `Error`, C++ `ErrorCode::contract`). 파서를 바꾸지 않고, 이전 접두사로 물러나지 않으며, 자동 재시도도 하지 않습니다.
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

- 패키지는 MIT이고 런타임 의존성이 없으며 `engines`는 Node 20.3 이상을 요구합니다. `./api` 하위 진입점은 `fetch` 등 웹 표준 API에만 의존하고 Node 전용 모듈을 끌어오지 않으며 에이전트 커널도 로드하지 않습니다.
- `createApiClient`의 옵션: `baseUrl`(origin만), `token` 또는 `authorize`, `fetch` 주입, `sessionFamily`, `eventEnvelope`, `maxResponseBytes`(기본 2 MiB), `maxEventFrameBytes`(기본 2 MiB), `onContract`.
- 메서드: `manifest()`, `capabilities()`, `sessionCapabilities(sessionId)`(`{ closure, closureId, meta }`를 돌려주며 응답 헤더와 본문의 `closureId`가 일치하는지 확인 완료), `call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`, `events(name, { params, query, lastEventId, signal, onOpen })`. `locked`와 `observed()`는 각각 빌드 시 잠근 값과 런타임에 관찰한 revision / `schemaHash`를 알려 줍니다.
- 결과 형태는 `{ status, body, meta }`. `meta`에는 `contract`, `manifestRevision`, `domain`, `schemaHash`, `closureId`, `eventEnvelope`, `traceId`, `etag`, `retryAfterMs`가 있습니다. 202는 수리이지 완료가 아닙니다.
- 오류 타입: `ApiError`(통합 봉투: `code`, `status`, `retryAction`, `traceId`, `requestId`, `domainCode`, `detail`), `DomainError`(정규화되지 않은 패밀리 원래 봉투. 오늘은 `archive-sync-v1`뿐), `ContractUnavailableError`, `ApiClientError`(로컬: `aborted`, `network_error`, `envelope_not_negotiated`, `payload_too_large`, `invalid_response`, `deadline_exceeded`, `if_match_not_applicable` 등).
- `API_OPERATIONS`는 81개 작업의 카탈로그(revision 7)이며 각 항목에 `method`, `path`, `params`, `aliases`, `domain`, `family`, `kind`, `sse`, `query`, `etagPath`, `expectedRevision`, `requestIdPath`가 있습니다. 엄격한 패밀리(`sdk2-*`, `terminal-*`, `archive-sync-v1`)의 요청 본문은 SDK가 canonical JSON으로 인코딩합니다.
- 이전 진입점 `./sdk2`, `./sdk2/node`, `./terminal`, `./terminal/node`는 0.3.0에서 동결되어 여전히 패키지에 포함됩니다. 0.4.0에서는 `routePrefixes`를 생략하면 기본 경로가 `/api`입니다. 이전 접두사를 쓰려면 `LEGACY_ROUTE_PREFIXES`를 넘기세요. 내보내기 이름의 추가나 삭제는 없습니다.

## .NET

```powershell
dotnet add YourApp.csproj package Tansr.Sdk --version 0.2.0
dotnet add YourApp.csproj package Tansr.Sdk.Windows --version 0.2.0
```

NuGet의 현재 공개 버전은 **0.2.0**(`Tansr.Sdk`와 `Tansr.Sdk.Windows`, 2026-10-07, MIT, 소스 `tansrai/tansr-net`)입니다. `Tansr.Sdk`는 `netstandard2.0`과 `net10.0`을 대상으로 하며(`net10.0`에서는 AOT 호환으로 표시) HTTP / SSE, 세션, 실행 조정, 저장소 인터페이스를 맡습니다. `Tansr.Sdk.Windows`는 `net48`과 `net10.0-windows`를 대상으로 하며 Windows 파일 / 프로세스, 로컬 SQLite, DPAPI 어댑터를 더하고 코어 패키지에 자동으로 의존합니다. SDK는 라이브러리이며 .NET 런타임을 담고 있지 않습니다. .NET Framework 앱은 시스템 런타임이 필요하고 현대 .NET 앱은 자체 포함으로 게시할 수 있습니다. `/api`만 거칩니다. 경로 상수 `Tansr.Sdk.Api.ApiRoutes`는 `node scripts/generate-api-routes.mjs`가 저장소 안에 vendored된 `contract/api-manifest.json`에서 생성합니다. 범용 진입점은 `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`, 클로저는 `client.GetCapabilityClosureAsync(sessionId)`로 얻고, 통합 봉투는 `UnifiedApiException`으로 디코딩됩니다(`Code` / `StatusCode` / `RetryAction`이 주, 패밀리 사실은 `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`). `UnifiedRetry.Advice(error)`와 `UnifiedRetry.RetrySameRequestAsync(...)`가 재시도 규율을 맡고, `TansrClientOptions.NegotiateEventEnvelope`가 이벤트 봉투를 명시적으로 협상하며 되돌아오지 않으면 `EnvelopeNotNegotiatedException`을 던집니다. 더 이전인 0.1.0.2도 NuGet에 남아 있지만 이번 계약 정렬보다 앞선 것이므로 `/api` 클라이언트로 쓰지 마세요. 예제는 WPF, WinForms(.NET Framework 4.8), 콘솔 세 가지이며 소스 저장소의 `examples/` 아래에 있습니다.

## Android

Maven Central **0.5.0**(2026-10-07)부터 모든 HTTP 요청은 `/api`만 거칩니다. 생성물 `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt`(`ApiContract` 상수와 `ApiOps` 81개 작업, `etagPath` / `expectedRevision` 포함)와 `UnifiedContract.kt`(`UnifiedCode` 19개 코드, `UnifiedRetryAction` 6개 동작). 응답 게이트는 `ApiContractGate.requireUnifiedValues`. 오류는 `TansrAgentException.Unified`(SDK1) 또는 `ApiFacadeException`(SDK2 / 터미널)으로 떨어지고 이전의 sealed 타입 33개는 사용 중단 표시하고 한 버전만 남깁니다. 세 요청 헤더는 `ApiCallOptions(idempotencyKey, ifMatch, deadline)`을 통해 `Sdk2Client.createBinding / acknowledge / closeBinding`과 `TerminalClient.configure / memoryCommand`에 선택적으로 붙일 수 있습니다. 생성기는 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>`이고 `:core:contractCheck`에 같은 출처의 대응표와 165개 골든 벡터 리플레이가 포함됩니다. 0.4.0 이하의 산출물은 이 변경들보다 앞선 것이며 아직 이전 접두사를 씁니다. 올릴 때는 `core` / `client` / `compose`를 함께 0.5.0으로 올리고, 선택 모듈 `receiver-android`는 같은 버전으로 처음 게시되었습니다. 연동 기본은 [Android SDK](/ko/android/)를 보세요.

## iOS

공개 바이너리 SPM **0.4.0**(2026-10-09, iOS 16 이상, macOS 13 이상)부터 경로의 단일 소스는 `Sources/TansrCore/Api/ApiContract.swift`(`ApiContract`, `ApiOps` 81개 작업)입니다. 응답 헤더 게이트 `ApiContractGate.requireUnified`는 SDK1의 모든 2xx 응답, 이벤트 스트림 열기, 오디오 클라이언트를 덮으며, 위반은 `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable`이 되고 이벤트 펌프는 2xx 형태의 계약 불가에 대해 바로 `failed` 종료 상태로 들어갑니다. 오류 모델은 `TansrAgentError.kind == .unified`(`unifiedCode` + `retryAction`)와 `ApiFacadeError`. `ApiCallOptions`가 세 요청 헤더를 나르고, `onManifestRevisionDrift`는 응답 revision이 로컬 revision 7과 다를 때 클라이언트마다 한 번 발화합니다. CI `contract:check`와 전체 패키지 `swift test`에 골든 벡터 리플레이가 포함됩니다. 0.4.0은 SDK2 클라이언트, 아카이브 동기화와 수신 측, 실행 저널, 터미널 인터페이스를 처음으로 함께 제공한 릴리스이기도 합니다. 0.3.0은 이 변경들보다 앞선 것이며 아직 이전 접두사를 씁니다. 0.3.0에서 올릴 때는 통합 코드와 `retryAction`을 중심으로 오류 분기를 다시 쓰세요. 연동 기본은 [iOS SDK](/ko/ios/)를 보세요.

## HarmonyOS

번들 HAR **0.2.0**(2026-10-10, 최소 HarmonyOS 6.0 / API 20, OHPM 채널 없음)부터 업무 코드는 `ApiOps.*.apiPath` / `apiPath()`만 참조합니다. 생성물 `tansr/src/main/ets/core/api/ApiContractGenerated.ets`, `core/api/UnifiedContractGenerated.ets`, `core/sdk2/client/SchemaGenerated.ets`는 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>`가 매니페스트, `sdk2-ext-v1.schema.json`, `unified-v1.schema.json`, `unified-v1.golden.json`에서 같은 출처로 생성하며 `pnpm check:contract`가 생성물과 잠금의 정합을 확인합니다. 네 통합 응답 헤더 중 하나라도 빠지면 `contract_unavailable`(`reason` 포함)이고 세션 펌프는 2xx 형태의 계약 불가에 대해 바로 `failed` 종료 상태로 들어갑니다. SDK1은 `AgentError`로 복원하고(`error.unified`, `error.retryAction`, `error.domainCode`) SDK2 / 터미널은 `ApiFacadeError`를 바로 던집니다. 세 요청 헤더는 `ApiCallOptions(idempotencyKey, ifMatch, deadline)`으로 로컬에서 먼저 판정됩니다. 0.1.0 HAR은 이 변경들보다 앞선 것이며 아직 이전 접두사를 씁니다. 연동 기본은 [HarmonyOS SDK](/ko/harmony/)를 보세요.

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/tansrai/tansr-go` **v0.3.0**(2026-10-07, MIT, Go 1.25 이상, 표준 라이브러리만, 런타임 서드파티 의존성 없음). 모듈 경로는 `github.com/cpple/tansr-go`에서 옮겨졌습니다. `v0.1.0`은 `api` / `canonical` / `sse`만 다룹니다. `v0.2.0`부터 `session`, `executor`, `archive`가 실제 구현이고 `go-chat` / `go-tools` / `go-archive`가 함께 있습니다. `v0.3.0`이 바꾸는 것은 모듈 경로뿐이며 프로토콜 동작은 `v0.2.0`과 같습니다. 올릴 때는 `go.mod`와 모든 import를 함께 고치고 옛 모듈과 새 모듈의 타입을 섞지 마세요. 설치는 `go get github.com/tansrai/tansr-go@v0.3.0`입니다. 예제 세 개는 바로 명령으로 설치할 수 있습니다. 예를 들어 `go install github.com/tansrai/tansr-go/examples/go-chat@v0.3.0`(`go-tools`, `go-archive`도 같은 방식). 소스는 `tansrai/tansr-go`에 있습니다.

## Rust

```sh
cargo add tansr-sdk@=0.1.0
```

`tansr-sdk`와 `tansr-sdk-demo` **0.1.0**이 crates.io에 있습니다(2026-10-08, MIT, edition 2024). Rust 1.85 이상이 필요합니다. Windows 빌드에는 MSVC 빌드 도구와 현재 셸 PATH의 NASM이 필요합니다. 비동기 클라이언트는 통합 `/api`를 쓰고, 상위 세션, 명시적 업무 도구, 단일 기기 암호화 아카이브가 함께 제공됩니다. 예제 명령은 `tansr-chat`, `tansr-tools`, `tansr-archive`이며 `cargo install tansr-sdk-demo --version 0.1.0 --locked`로 설치합니다. 소스는 `tansrai/tansr-rust`에 있습니다.

## Python

```sh
python -m pip install tansr-sdk==0.1.0
```

`tansr-sdk`와 `tansr-sdk-demo` **0.1.0**이 PyPI에 있습니다(2026-10-08, MIT, 소스 `tansrai/tansr-python`). `requires-python`은 `>=3.7,!=3.9.0,!=3.9.1`입니다. CPython 3.7 이상을 지원하되 3.9.0과 3.9.1은 제외합니다. 최소 Python 버전과 TLS 기준선은 별개의 조건입니다. 기본 HTTPS 전송은 먼저 표준 라이브러리의 SSL 런타임을 확인하고, 영향을 받는 것으로 알려진 OpenSSL(Windows 공식 Python 3.7.9에 딸린 1.1.1g 등)은 `unsupported_tls_runtime`으로 거부되며 우회 스위치는 없습니다. 발행 설명의 격리 런타임으로 바꾸고, 새 프로젝트에서는 유지 보수되는 인터프리터를 우선하세요. 동기 API와 asyncio는 같은 `/api` 구현을 공유합니다. 예제 명령 `tansr-py-chat`, `tansr-py-tools`, `tansr-py-archive`는 `tansr-sdk-demo` 패키지 안에 있으며 `python -m pip install tansr-sdk-demo==0.1.0`으로 설치합니다.

## C++

```cmake
find_package(TansrSDK 0.1.0 EXACT CONFIG REQUIRED)
target_link_libraries(my_app PRIVATE tansr::sdk)
```

`tansrai/tansr-cpp`의 GitHub Release **v0.1.0**(2026-10-08, MIT)은 소스 패키지와 Windows x64(MSVC 19.44), Linux x64(Ubuntu 24.04 / GCC 13.3, glibc 2.38 이상), macOS arm64(AppleClang 21, macOS 26.0 이상)용 Release 정적 SDK 및 독립 데모를 배포합니다. Conan / vcpkg 레시피는 릴리스 첨부물로 자체 배포되며 Conan Center와 공개 vcpkg 색인에는 아직 없습니다. 언어 수준은 C++17입니다. 소스에서 빌드하려면 CMake 3.25 이상과 Ninja가 필요하고, 의존성은 curl 8.22.0, c-ares 1.34.8, OpenSSL 3.5.9로 고정되어 있으며 발행 목록에 따라 직접 준비해야 합니다. CMake는 자동으로 받지 않습니다. 예제는 `tansr-chat`, `tansr-tools`, `tansr-archive`입니다.

## 다음 단계

- 각 클라이언트가 같은 방식으로 판정하는 오류와 동작을 이해하려면 [통합 요청 헤더, 응답 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 읽으세요.
- 모바일 SDK 세 가지의 연동 단계는 각각 [Android SDK](/ko/android/), [iOS SDK](/ko/ios/), [HarmonyOS SDK](/ko/harmony/)를 보세요. 각 클라이언트의 새 버전은 각 저장소의 릴리스 기록과 이 사이트의 [릴리스 노트](/releases/sdk/)에 등록됩니다.
