---
title: 各言語のクライアント
description: Node @tansr/api-client/api 0.3.0 正式版の使い方とエクスポート。.NET、Android、iOS、HarmonyOS、Go の各クライアントの unified-v1（マニフェスト revision 7）への整合状況を、リリース済みバージョンとメインラインのソースの違いとともに示す。そしてすべてのクライアントが共通して守る、生成されたパスモジュール、フォールバックしないレスポンスゲート、統一コードでの判定、3 つのリクエストヘッダーのローカル検証。
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

6 つのクライアントはどれも同じ契約に従って `unified-v1` を実装していますが、**リリース状況は異なります**。下の表は 2026-10-05 時点の各リポジトリのメインラインと公開リリース物の事実です。「メインラインは整合済み、未リリース」とあるものは、公開チャネルからインストールできるバージョンがまだ `/api` を経由しないことを意味します。

| クライアント | 公開リリース物 | `/api`（unified-v1）対応 |
|---|---|---|
| Node `@tansr/api-client` | 0.3.0 正式版（npm、2026-10-04） | **リリース済み**：`@tansr/api-client/api` エントリ、マニフェスト revision 7 に整合 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet 0.1.0.2 | メインラインは revision 7 に整合済み（2026-10-03）、**未リリース**。0.1.0.2 はまだ旧プレフィックス |
| Android `com.tansr.sdk:core / client / compose` | Maven Central 0.4.0 | メインラインは revision 7 に整合済み（2026-10-03）、**未リリース**。0.4.0 はまだ旧プレフィックス |
| iOS `tansrai/tansr-ios-spm` | 公開バイナリ SPM 0.3.0 | メインラインは revision 7 に整合済み、**未リリース**。0.3.0 はまだ旧プレフィックス |
| HarmonyOS HAR `@tansr/harmony` | 同梱 HAR 0.1.0（OHPM チャネルなし） | メインラインは revision 7 に整合済み（2026-10-04）、**未リリース**。0.1.0 はまだ旧プレフィックス |
| Go `github.com/cpple/tansr-go` | タグ `v0.1.0`（2026-10-02 のリリーストレインと同時） | `v0.1.0` はスケルトン：`api` / `canonical` / `sse` は実装とテストあり、`executor` / `archive` はインターフェースのみ。メインラインはその後 revision 7 と 3 つのリクエストヘッダーに整合（2026-10-03、エラー型の破壊的変更を含む）したが、新しいタグはまだない |

## すべてのクライアントに共通する実装の規律

言語を問わず、公式クライアントは次のことを守っています。自分でクライアントを書くときのチェックリストでもあります。

- **パスは生成物からだけ。** 各リポジトリには `api-manifest.json` から生成したパスモジュールがあり（Node `API_OPERATIONS`、.NET `Tansr.Sdk.Api.ApiRoutes`、Android `ApiOps`、iOS `ApiOps`、HarmonyOS `ApiOps`、Go `api/operations_gen.go`）、ソースに `/v2`、`/v3/sdk2`、`/v3/terminal` のリテラルは現れません。生成物は上流のコミット番号とともにリポジトリ内にロックされ、CI がずれていないことを確かめます。
- **レスポンスゲートはフォールバックしない。** すべてのレスポンス（2xx と SSE のオープンを含む）は `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` をそろえて持たなければならず、ヘッダーの欠落、重複、形の崩れ、語彙外の `tansr-*` ヘッダーはすべて明示的に失敗します（Node `ContractUnavailableError`、.NET `ContractUnavailableException`、Android `TansrAgentException.ContractUnavailable` / `ApiContractException`、iOS `.contractUnavailable`、HarmonyOS `ApiContractError('contract_unavailable')`、Go `*api.ContractUnavailableError`）。パーサーを替えず、旧プレフィックスに戻らず、自動再試行もしません。
- **統一コードが主。** エラーは 19 の統一コード + 6 種の `retryAction` で判定し、ファミリーコードは `detail.domainCode` の中の詳細にすぎません。ファミリーコードで分岐していた古い例外型は移行の橋渡しとして 1 バージョンだけ残し、非推奨にします。
- **3 つのリクエストヘッダーはローカルで先に検証。** 形の不正な `Idempotency-Key`、弱いバリデーターの `If-Match` や `expectedRevision` のない操作への `If-Match`、期限切れの `deadline` は送信前に拒否され（ネットワークに出ません）、再試行は同じオプションを使い続け、キーを替えず、期限を延ばしません。
- **ゴールデンベクターのリプレイ。** 各クライアントは `unified-v1.golden.json` の 165 本のベクターを実際のデコーダーでリプレイし、自身が宣言した能力の交差範囲の外にある相違を記録します。

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

- `createApiClient` のオプション：`baseUrl`（origin のみ）、`token` または `authorize`、`fetch` の注入、`sessionFamily`、`eventEnvelope`、`maxResponseBytes`（既定 2 MiB）、`maxEventFrameBytes`（既定 2 MiB）、`onContract`。
- メソッド：`manifest()`、`capabilities()`、`sessionCapabilities(sessionId)`（`{ closure, closureId, meta }` を返し、レスポンスヘッダーと本文の `closureId` が一致することを確かめ済み）、`call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`、`events(name, { params, query, lastEventId, signal, onOpen })`。`locked` と `observed()` はそれぞれビルド時にロックした値と実行時に観測した revision / `schemaHash` を示します。
- 結果の形は `{ status, body, meta }`。`meta` には `contract`、`manifestRevision`、`domain`、`schemaHash`、`closureId`、`eventEnvelope`、`traceId`、`etag`、`retryAfterMs` があります。202 は受理であって完了ではありません。
- エラー型：`ApiError`（統一エンベロープ：`code`、`status`、`retryAction`、`traceId`、`requestId`、`domainCode`、`detail`）、`DomainError`（正規化されていないファミリーの元のエンベロープ。今日は `archive-sync-v1` のみ）、`ContractUnavailableError`、`ApiClientError`（ローカル：`aborted`、`network_error`、`envelope_not_negotiated`、`payload_too_large`、`invalid_response`、`deadline_exceeded`、`if_match_not_applicable` など）。
- `API_OPERATIONS` は 81 操作のカタログ（revision 7）で、各項目に `method`、`apiPath`、`query`、`kind`、`sse`、`etagPath`、`expectedRevision`、`requestIdPath` があります。厳密なファミリー（`sdk2-*`、`terminal-*`、`archive-sync-v1`）のリクエスト本文は SDK が canonical JSON でエンコードします。
- 旧エントリ `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` は 0.3.0 で凍結：引き続きパッケージとともに配布され、変更はありません。

## .NET

メインライン（未リリース）では SDK は `/api` だけを経由します。パス定数 `Tansr.Sdk.Api.ApiRoutes` は `node scripts/generate-api-routes.mjs` がリポジトリ内に vendored された `contract/api-manifest.json` から生成します。汎用入口は `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`、クロージャは `client.GetCapabilityClosureAsync(sessionId)` で取得し、統一エンベロープは `UnifiedApiException` にデコードされます（`Code` / `StatusCode` / `RetryAction` が主、ファミリーの事実は `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`）。`UnifiedRetry.Advice(error)` と `UnifiedRetry.RetrySameRequestAsync(...)` が再試行の規律を担い、`TansrClientOptions.NegotiateEventEnvelope` がイベントエンベロープを明示的に交渉し、返ってこなければ `EnvelopeNotNegotiatedException` をスローします。NuGet の 0.1.0.2 はこれらの変更より前のものです。

## Android

メインライン（未リリース）ではすべての HTTP リクエストが `/api` だけを経由します。生成物 `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt`（`ApiContract` 定数と `ApiOps` の 81 操作、`etagPath` / `expectedRevision` を含む）と `UnifiedContract.kt`（`UnifiedCode` 19 コード、`UnifiedRetryAction` 6 動作）。レスポンスゲートは `ApiContractGate.requireUnifiedValues`。エラーは `TansrAgentException.Unified`（SDK1）または `ApiFacadeException`（SDK2 / ターミナル）に落ち、古い 33 の sealed 型は非推奨。3 つのリクエストヘッダーは `ApiCallOptions(idempotencyKey, ifMatch, deadline)` を通じて `Sdk2Client.createBinding / acknowledge / closeBinding` と `TerminalClient.configure / memoryCommand` で任意に付けられます。ジェネレーターは `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>` で、`:core:contractCheck` に同一出所の対応表と 165 本のゴールデンベクターのリプレイが含まれます。Maven Central の 0.4.0 はこれらの変更より前のものです。導入の基本は [Android SDK](/ja/android/) を参照してください。

## iOS

メインライン（未リリース）ではパスの単一ソースは `Sources/TansrCore/Api/ApiContract.swift`（`ApiContract`、`ApiOps` の 81 操作）です。レスポンスヘッダーのゲート `ApiContractGate.requireUnified` は SDK1 のすべての 2xx レスポンス、イベントストリームのオープン、音声クライアントを覆い、違反は `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable` になり、イベントポンプは 2xx 形の契約不可に対して直接 `failed` の終端状態に入ります。エラーモデルは `TansrAgentError.kind == .unified`（`unifiedCode` + `retryAction`）と `ApiFacadeError`。`ApiCallOptions` が 3 つのリクエストヘッダーを運び、`onManifestRevisionDrift` はレスポンスの revision がローカルの revision 7 と異なるときにクライアントごとに 1 回発火します。CI の `contract:check` とフルパッケージの `swift test` にゴールデンベクターのリプレイが含まれます。公開バイナリ SPM 0.3.0 はこれらの変更より前のものです。導入の基本は [iOS SDK](/ja/ios/) を参照してください。

## HarmonyOS

メインライン（未リリース）では業務コードは `ApiOps.*.apiPath` / `apiPath()` だけを参照します。生成物 `tansr/src/main/ets/core/api/ApiContractGenerated.ets`、`core/api/UnifiedContractGenerated.ets`、`core/sdk2/client/SchemaGenerated.ets` は `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>` がマニフェスト、`sdk2-ext-v1.schema.json`、`unified-v1.schema.json`、`unified-v1.golden.json` から同一出所で生成し、`pnpm check:contract` が生成物とロックの整合を確かめます。4 つの統一レスポンスヘッダーが 1 つでも欠ければ `contract_unavailable`（`reason` 付き）で、セッションポンプは 2xx 形の契約不可に対して直接 `failed` の終端状態に入ります。SDK1 は `AgentError` で復元し（`error.unified`、`error.retryAction`、`error.domainCode`）、SDK2 / ターミナルは `ApiFacadeError` を直接スローします。3 つのリクエストヘッダーは `ApiCallOptions(idempotencyKey, ifMatch, deadline)` でローカルで先に判定されます。同梱 HAR 0.1.0 はこれらの変更より前のものです。導入の基本は [HarmonyOS SDK](/ja/harmony/) を参照してください。

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/cpple/tansr-go`（標準ライブラリのみの実装、サードパーティ依存ゼロ）：サブパッケージ `api`（ディスカバリー / `Call` / `Events` / エラーエンベロープ / 再試行アドバイス）、`canonical`、`sse` には実装とテストがあり、`executor`、`archive` はインターフェース定義だけで、実際のセッションサービスとの結合テストはまだこれからです。タグ `v0.1.0` は 2026-10 のリリーストレインで打たれました。メインラインはその後 `APIError.Code` / `RetryAction` を型付き定数（`api.Code*` 19 個、`api.Action*` 6 個、`Detail.DomainCode` は副次フィールド）に改め、3 つのリクエストヘッダー（`CallOptions.IfMatch` / `Deadline` / `IdempotencyKey`、`Meta.ETag` は強い形だけを受け取る）を配線しました。これらの変更は `v0.1.0` に対して破壊的で、新しいタグはまだ打たれていません。

## 次のステップ

- 各クライアントが同じように判定するエラーと動作を理解するには、[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を読んでください。
- モバイルやデスクトップで `/api` に先行して整合させるには、各リポジトリのメインラインからビルドしてください。公開チャネルの新しいバージョンは各リポジトリのリリース記録とこのサイトの[リリースノート](/releases/sdk/)に登録されます。
