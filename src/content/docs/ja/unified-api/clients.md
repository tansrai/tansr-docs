---
title: 各言語のクライアント
description: Node @tansr/api-client/api 0.3.0 正式版の使い方とエクスポート。.NET 0.2.0、Go v0.3.0、Rust / Python / C++ 0.1.0 など公開済みのクライアントと、Android、iOS、HarmonyOS の未切替リリース。全クライアント共通の生成パスモジュール、フォールバックしないレスポンスゲート、統一コード判定、3 つのリクエストヘッダーのローカル検証。
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
lastVerified: '2026-10-09'
---

9 つのクライアントはどれも同じ契約に従って `unified-v1` を実装していますが、**リリース状況は異なります**。下の表は 2026-10-09 時点です。Android、iOS、HarmonyOS の 3 行は 2026-10-05 に確認した公開物のままで、この回では Maven、SPM、HAR を再確認していません。「メインラインは整合済み、未リリース」とあるものは、公開チャネルからインストールできるバージョンがまだ `/api` を経由しないことを意味します。

| クライアント | 公開リリース物 | `/api`（unified-v1）対応 |
|---|---|---|
| Node `@tansr/api-client` | 0.3.0 正式版（npm、2026-10-04） | **リリース済み**：`@tansr/api-client/api` エントリ、マニフェスト revision 7 に整合 |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet **0.2.0**（2026-10-07。0.1.0.2 も残存） | **リリース済み**。0.2.0 はマニフェスト revision 7 に整合。0.1.0.2 はその前 |
| Android `com.tansr.sdk:core / client / compose` | Maven Central 0.4.0 | メインラインは revision 7 に整合済み（2026-10-03）、**未リリース**。0.4.0 はまだ旧プレフィックス |
| iOS `tansrai/tansr-ios-spm` | 公開バイナリ SPM 0.3.0 | メインラインは revision 7 に整合済み、**未リリース**。0.3.0 はまだ旧プレフィックス |
| HarmonyOS HAR `@tansr/harmony` | 同梱 HAR 0.1.0（OHPM チャネルなし） | メインラインは revision 7 に整合済み（2026-10-04）、**未リリース**。0.1.0 はまだ旧プレフィックス |
| Go `github.com/tansrai/tansr-go` | モジュール **v0.3.0**（2026-10-07） | **リリース済み**。v0.2.0 から高水準のセッション、実行器、アーカイブが `/api` を経由。v0.3.0 はモジュールパスを `github.com/cpple/tansr-go` から移しただけ |
| Rust `tansr-sdk` / `tansr-sdk-demo` | crates.io **0.1.0**（2026-10-08） | **リリース済み**。非同期クライアントは統一 `/api` を使う |
| Python `tansr-sdk` / `tansr-sdk-demo` | PyPI **0.1.0**（2026-10-08） | **リリース済み**。同期と asyncio が同じ `/api` 実装を共有 |
| C++ `tansrai/tansr-cpp` | GitHub Release **v0.1.0**（2026-10-08） | **リリース済み**。静的 SDK と 3 つの独立 Demo。Conan Center と公開 vcpkg 索引には未収録 |

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

NuGet の現行公開版は **0.2.0**（`Tansr.Sdk` と `Tansr.Sdk.Windows`、2026-10-07）です。`/api` だけを経由します。パス定数 `Tansr.Sdk.Api.ApiRoutes` は `node scripts/generate-api-routes.mjs` がリポジトリ内に vendored された `contract/api-manifest.json` から生成します。汎用入口は `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`、クロージャは `client.GetCapabilityClosureAsync(sessionId)` で取得し、統一エンベロープは `UnifiedApiException` にデコードされます（`Code` / `StatusCode` / `RetryAction` が主、ファミリーの事実は `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`）。`UnifiedRetry.Advice(error)` と `UnifiedRetry.RetrySameRequestAsync(...)` が再試行の規律を担い、`TansrClientOptions.NegotiateEventEnvelope` がイベントエンベロープを明示的に交渉し、返ってこなければ `EnvelopeNotNegotiatedException` をスローします。より古い 0.1.0.2 も NuGet に残っていますが、この契約整合より前なので `/api` クライアントとして扱わないでください。

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

`github.com/tansrai/tansr-go` **v0.3.0**（2026-10-07、MIT、Go 1.25 以上、標準ライブラリのみ、実行時のサードパーティ依存なし）。モジュールパスは `github.com/cpple/tansr-go` から移りました。`v0.1.0` は `api` / `canonical` / `sse` だけです。`v0.2.0` から `session`、`executor`、`archive` が実装になり、`go-chat` / `go-tools` / `go-archive` が付きます。`v0.3.0` が変えるのはモジュールパスだけで、プロトコルの挙動は `v0.2.0` と同じです。上げるときは `go.mod` とすべての import を一緒に直し、新旧モジュールの型を混ぜないでください。導入は `go get github.com/tansrai/tansr-go@v0.3.0` です。

## Rust

```sh
cargo add tansr-sdk@=0.1.0
```

`tansr-sdk` と `tansr-sdk-demo` の **0.1.0** は crates.io にあります（2026-10-08、MIT）。Rust 1.85 以上が必要です。Windows では MSVC のビルドツールに加え、いまのシェルの PATH に NASM が要ります。非同期クライアントは統一 `/api` を使い、高水準セッション、明示的な業務ツール、単一デバイスの暗号化アーカイブが同梱されます。例のコマンドは `tansr-chat`、`tansr-tools`、`tansr-archive` です。ソースは `tansrai/tansr-rust` にあります。

## Python

```sh
python -m pip install tansr-sdk==0.1.0
```

`tansr-sdk` と `tansr-sdk-demo` の **0.1.0** は PyPI にあります（2026-10-08、MIT、ソースは `tansrai/tansr-python`）。公開範囲は Python 3.7 以上です。Windows でインタプリタ同梱の古い OpenSSL では HTTPS を開けません。発行説明にある隔離ランタイムを使ってください。同期 API と asyncio は同じ `/api` 実装を共有します。例のコマンド `tansr-py-chat`、`tansr-py-tools`、`tansr-py-archive` は `tansr-sdk-demo` に入っています。

## C++

```cmake
find_package(TansrSDK 0.1.0 EXACT CONFIG REQUIRED)
target_link_libraries(my_app PRIVATE tansr::sdk)
```

`tansrai/tansr-cpp` の GitHub Release **v0.1.0**（2026-10-08、MIT）はソースパッケージと、Windows x64、Linux x64、macOS arm64 の静的 SDK および独立 Demo を配ります。Conan Center と公開 vcpkg 索引にはまだ入っていません。言語水準は C++17 です。依存は発行一覧に従って自分で用意し、CMake は自動ダウンロードしません。例は `tansr-chat`、`tansr-tools`、`tansr-archive` です。

## 次のステップ

- 各クライアントが同じように判定するエラーと動作を理解するには、[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を読んでください。
- モバイルやデスクトップで `/api` に先行して整合させるには、各リポジトリのメインラインからビルドしてください。公開チャネルの新しいバージョンは各リポジトリのリリース記録とこのサイトの[リリースノート](/releases/sdk/)に登録されます。
