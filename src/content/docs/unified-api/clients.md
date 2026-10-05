---
title: 各语言客户端
description: Node @tansr/api-client/api 0.3.0 正式版的用法与导出；.NET、Android、iOS、鸿蒙、Go 各客户端对 unified-v1（manifest revision 7）的对齐状态——已发布版本与主线源码的差别；以及所有客户端共同遵守的生成式路径模块、零回退响应门、统一码判定与三个请求头的本地校验。
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

六个客户端对 `unified-v1` 的实现都遵守同一份合同，但**发布状态不同**。下表是截至 2026-10-05 各仓库主线与公开发布物的事实；写着「主线已对齐、未发布」的，意味着你从公开渠道装到的版本还不走 `/api`。

| 客户端 | 公开发布物 | `/api`（unified-v1）支持 |
|---|---|---|
| Node `@tansr/api-client` | 0.3.0 正式版（npm，2026-10-04） | **已发布**：`@tansr/api-client/api` 子入口，对齐 manifest revision 7 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet 0.1.0.2 | 主线已对齐 revision 7（2026-10-03），**未发布**；0.1.0.2 仍走旧前缀 |
| Android `com.tansr.sdk:core / client / compose` | Maven Central 0.4.0 | 主线已对齐 revision 7（2026-10-03），**未发布**；0.4.0 仍走旧前缀 |
| iOS `tansrai/tansr-ios-spm` | 公开二进制 SPM 0.3.0 | 主线已对齐 revision 7，**未发布**；0.3.0 仍走旧前缀 |
| 鸿蒙 HAR `@tansr/harmony` | 随包 HAR 0.1.0（无 OHPM 渠道） | 主线已对齐 revision 7（2026-10-04），**未发布**；0.1.0 仍走旧前缀 |
| Go `github.com/cpple/tansr-go` | 标签 `v0.1.0`（随 2026-10-02 发行车） | `v0.1.0` 为骨架：`api` / `canonical` / `sse` 有实现与测试，`executor` / `archive` 仅接口；主线此后对齐 revision 7 与三个请求头（2026-10-03，含破坏性的错误类型改动），尚无新标签 |

## 所有客户端共同的实现纪律

无论哪种语言，官方客户端都做到以下几点；自己写客户端时这也是对照清单：

- **路径只来自生成物。** 各仓都有一份从 `api-manifest.json` 生成的路径模块（Node `API_OPERATIONS`、.NET `Tansr.Sdk.Api.ApiRoutes`、Android `ApiOps`、iOS `ApiOps`、鸿蒙 `ApiOps`、Go `api/operations_gen.go`），源码里不出现 `/v2`、`/v3/sdk2`、`/v3/terminal` 字面量；生成物连同上游提交号一起锁在仓内，CI 核对不漂移。
- **响应门零回退。** 每个响应（含 2xx 与 SSE 打开）必须带齐 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`，缺头、重复、形变、词表外的 `tansr-*` 头一律显式失败（Node `ContractUnavailableError`、.NET `ContractUnavailableException`、Android `TansrAgentException.ContractUnavailable` / `ApiContractException`、iOS `.contractUnavailable`、鸿蒙 `ApiContractError('contract_unavailable')`、Go `*api.ContractUnavailableError`），不换解析器、不退旧前缀、不自动重试。
- **统一码为主位。** 错误以 19 个统一码 + 6 种 `retryAction` 判定，族码只是 `detail.domainCode` 里的细节；旧的按族码分支的异常类型保留一版作过渡桥并标废弃。
- **三个请求头先本地校验。** `Idempotency-Key` 形不合、`If-Match` 弱校验器或用在没有 `expectedRevision` 的操作上、`deadline` 已过期，都在发出前就被拒绝（不出网），重试沿用同一组选项、不换键、不延长截止。
- **金向量回放。** 每个客户端都以 `unified-v1.golden.json` 的 165 条向量经真实解码器回放，并登记与自身声明能力交集之外的分歧。

## Node：`@tansr/api-client/api`

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

要点：

- `createApiClient` 的选项：`baseUrl`（仅 origin）、`token` 或 `authorize`、`fetch` 注入、`sessionFamily`、`eventEnvelope`、`maxResponseBytes`（缺省 2 MiB）、`maxEventFrameBytes`（缺省 2 MiB）、`onContract`。
- 方法：`manifest()`、`capabilities()`、`sessionCapabilities(sessionId)`（返回 `{ closure, closureId, meta }`，已核对响应头与体内 `closureId` 一致）、`call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`、`events(name, { params, query, lastEventId, signal, onOpen })`；`locked` 与 `observed()` 分别给出构建期锁定与运行期观察到的 revision / `schemaHash`。
- 结果形 `{ status, body, meta }`；`meta` 含 `contract`、`manifestRevision`、`domain`、`schemaHash`、`closureId`、`eventEnvelope`、`traceId`、`etag`、`retryAfterMs`。202 是受理不是完成。
- 错误类型：`ApiError`（统一信封：`code`、`status`、`retryAction`、`traceId`、`requestId`、`domainCode`、`detail`）、`DomainError`（未归一的族原信封，今日只有 `archive-sync-v1`）、`ContractUnavailableError`、`ApiClientError`（本地：`aborted`、`network_error`、`envelope_not_negotiated`、`payload_too_large`、`invalid_response`、`deadline_exceeded`、`if_match_not_applicable` 等）。
- `API_OPERATIONS` 是 81 条操作的目录（revision 7），每条带 `method`、`apiPath`、`query`、`kind`、`sse`、`etagPath`、`expectedRevision`、`requestIdPath`；严格族（`sdk2-*`、`terminal-*`、`archive-sync-v1`）的请求体由 SDK 以 canonical JSON 编码。
- 旧入口 `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` 在 0.3.0 冻结：仍随包发布，不再增改。

## .NET

主线（未发布）下 SDK 只走 `/api`：路径常量 `Tansr.Sdk.Api.ApiRoutes` 由 `node scripts/generate-api-routes.mjs` 从仓内 vendored 的 `contract/api-manifest.json` 生成；通用入口 `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`；围栏经 `client.GetCapabilityClosureAsync(sessionId)`；统一信封解码为 `UnifiedApiException`（`Code` / `StatusCode` / `RetryAction` 为主位，族事实在 `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`），`UnifiedRetry.Advice(error)` 与 `UnifiedRetry.RetrySameRequestAsync(...)` 承担重试纪律；`TansrClientOptions.NegotiateEventEnvelope` 显式协商事件包络，未回响抛 `EnvelopeNotNegotiatedException`。NuGet 上的 0.1.0.2 早于这些改动。

## Android

主线（未发布）下全部 HTTP 请求只走 `/api`：生成物 `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt`（`ApiContract` 常量与 `ApiOps` 81 个操作，含 `etagPath` / `expectedRevision`）与 `UnifiedContract.kt`（`UnifiedCode` 19 码、`UnifiedRetryAction` 6 动作）；响应门 `ApiContractGate.requireUnifiedValues`；错误落 `TansrAgentException.Unified`（SDK1）或 `ApiFacadeException`（SDK2 / 终端），旧的 33 个密封型标废弃；三个请求头经 `ApiCallOptions(idempotencyKey, ifMatch, deadline)` 在 `Sdk2Client.createBinding / acknowledge / closeBinding` 与 `TerminalClient.configure / memoryCommand` 上可选携带；生成器 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>`，`:core:contractCheck` 含同源对表与 165 条金向量回放。Maven Central 上的 0.4.0 早于这些改动。接入基础见 [Android SDK](/android/)。

## iOS

主线（未发布）下路径单源 `Sources/TansrCore/Api/ApiContract.swift`（`ApiContract`、`ApiOps` 81 个操作）；响应头门 `ApiContractGate.requireUnified` 覆盖 SDK1 每个 2xx 响应、事件流打开与音频客户端，违例 → `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable`，事件泵对 2xx 形的合同不可用直接进入 `failed` 终态；错误模型 `TansrAgentError.kind == .unified`（`unifiedCode` + `retryAction`）与 `ApiFacadeError`；`ApiCallOptions` 承载三个请求头；`onManifestRevisionDrift` 在响应 revision 与本地 revision 7 不同时每客户端触发一次；CI `contract:check` 与全包 `swift test` 含金向量回放。公开二进制 SPM 0.3.0 早于这些改动。接入基础见 [iOS SDK](/ios/)。

## 鸿蒙

主线（未发布）下业务代码只引用 `ApiOps.*.apiPath` / `apiPath()`，生成物 `tansr/src/main/ets/core/api/ApiContractGenerated.ets`、`core/api/UnifiedContractGenerated.ets`、`core/sdk2/client/SchemaGenerated.ets` 由 `node scripts/api/generate-api-contract.mjs --cli <tansr-cli 根>` 从 manifest、`sdk2-ext-v1.schema.json`、`unified-v1.schema.json`、`unified-v1.golden.json` 同源生成，`pnpm check:contract` 核对产物与锁自洽；四个统一响应头缺一即 `contract_unavailable`（携 `reason`），会话泵对 2xx 形的合同不可用直接终态 `failed`；SDK1 以 `AgentError` 还原（`error.unified`、`error.retryAction`、`error.domainCode`），SDK2 / 终端直抛 `ApiFacadeError`；三个请求头经 `ApiCallOptions(idempotencyKey, ifMatch, deadline)` 本地先判。随包 HAR 0.1.0 早于这些改动。接入基础见[鸿蒙 SDK](/harmony/)。

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/cpple/tansr-go`（标准库实现，零第三方依赖）：子包 `api`（发现 / `Call` / `Events` / 错误信封 / 重试建议）、`canonical`、`sse` 有实现与测试，`executor`、`archive` 只有接口定义，真实会话服务联调仍待进行。标签 `v0.1.0` 随 2026-10 发行车打出；主线此后把 `APIError.Code` / `RetryAction` 改为类型化常量（`api.Code*` 19 个、`api.Action*` 6 个，`Detail.DomainCode` 为次级字段）、接入三个请求头（`CallOptions.IfMatch` / `Deadline` / `IdempotencyKey`，`Meta.ETag` 只收强形），这些改动相对 `v0.1.0` 是破坏性的，且尚未打新标签。

## 下一步

- 要理解各端共同判定的错误与动作，读[统一请求头、响应头与错误信封](/unified-api/headers-and-errors/)。
- 要在移动端或桌面端提前对齐 `/api`，以各仓主线为准编译；公开渠道的新版本会在各自的发布记录与本站[发布说明](/releases/sdk/)登记。
