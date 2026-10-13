---
title: 各言語のクライアント
description: Node @tansr/api-client 0.4.0 正式版。./api の使い方とエクスポートは 0.3.0 と同じで、凍結入口の既定は /api。.NET 0.2.0、Android 0.5.0、iOS 0.4.0、HarmonyOS HAR 0.2.0、Go v0.3.0、Rust / Python / C++ 0.1.0 など公開済みクライアントのインストールコマンド、ランタイム要件、リリース日。全クライアント共通の生成パスモジュール、フォールバックしないレスポンスゲート、統一コード判定、3 つのリクエストヘッダーのローカル検証。
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

9 つのクライアントはどれも同じ契約に従って `unified-v1` を実装していますが、**リリースの歩調は異なります**。下の表は 2026-10-13 時点です。バージョン番号と日付は当日に読んだレジストリの記録（npm、NuGet、Maven Central、`tansrai/tansr-ios-spm` の GitHub Release、Go モジュールプロキシ、crates.io、PyPI、`tansrai/tansr-cpp` の GitHub Release）どおりに記入し、日付はレジストリ記録の UTC 日付を採ります。HarmonyOS には公開パッケージレジストリがないため、公式ダウンロードページとともに配布される HAR で登録します。各行の末尾には、公開チャネル上で旧プレフィックスを使う最後のバージョンを書いています。そのバージョン以前をインストールしているアプリは、アップグレードして初めてこの章の説明どおりに動きます。

| クライアント | 公開リリース物 | `/api`（unified-v1）対応 |
|---|---|---|
| Node `@tansr/api-client` | 0.4.0 正式版（npm、2026-10-06、`latest`） | **リリース済み**：`./api` は 0.3.0 から不変で、マニフェスト revision 7 に整合。`routePrefixes` を渡さない凍結済み `./sdk2` / `./terminal` は既定で `/api`。旧プレフィックスが必要なら `LEGACY_ROUTE_PREFIXES` を明示。`./api` は 0.3.0 から提供され、0.2.0 にはこの入口がない |
| .NET `Tansr.Sdk` / `Tansr.Sdk.Windows` | NuGet **0.2.0**（2026-10-07。0.1.0.2 も残存） | **リリース済み**。0.2.0 はマニフェスト revision 7 に整合。0.1.0.2 はその整合より前で、まだ旧プレフィックス |
| Android `com.tansr.sdk:core / client / compose` | Maven Central **0.5.0**（2026-10-07。任意モジュール `receiver-android` も同じバージョンで初公開） | **リリース済み**。0.5.0 はマニフェスト revision 7 に整合し、エラーは統一コードが主。0.4.0 以前はまだ旧プレフィックス |
| iOS `tansrai/tansr-ios-spm` | 公開バイナリ SPM **0.4.0**（2026-10-09） | **リリース済み**。0.4.0 はマニフェスト revision 7 に整合し、SDK2 クライアント、アーカイブ同期、ターミナルインターフェースを初めて同梱。0.3.0 はまだ旧プレフィックス |
| HarmonyOS HAR `@tansr/harmony` | 同梱 HAR **0.2.0**（2026-10-10。公式ダウンロードページの HarmonyOS Demo パッケージに同梱して配布、OHPM チャネルなし） | **リリース済み（同梱）**。0.2.0 は unified-v1 契約に入り、業務コードは `/api` だけを経由。0.1.0 はまだ旧プレフィックス |
| Go `github.com/tansrai/tansr-go` | モジュール **v0.3.0**（2026-10-07） | **リリース済み**。v0.2.0 から高水準のセッション、実行器、アーカイブが `/api` を経由。v0.3.0 はモジュールパスを `github.com/cpple/tansr-go` から移しただけ |
| Rust `tansr-sdk` / `tansr-sdk-demo` | crates.io **0.1.0**（2026-10-08） | **リリース済み**。非同期クライアントは統一 `/api` を使う |
| Python `tansr-sdk` / `tansr-sdk-demo` | PyPI **0.1.0**（2026-10-08） | **リリース済み**。同期と asyncio が同じ `/api` 実装を共有 |
| C++ `tansrai/tansr-cpp` | GitHub Release **v0.1.0**（2026-10-08） | **リリース済み**。静的 SDK と 3 つの独立 Demo。Conan Center と公開 vcpkg 索引には未収録 |

## すべてのクライアントに共通する実装の規律

言語を問わず、公式クライアントは次のことを守っています。自分でクライアントを書くときのチェックリストでもあります。

- **パスは生成物からだけ。** 各リポジトリには `api-manifest.json` から生成したパスモジュールがあり（Node `API_OPERATIONS`、.NET `Tansr.Sdk.Api.ApiRoutes`、Android `ApiOps`、iOS `ApiOps`、HarmonyOS `ApiOps`、Go `api/operations_gen.go`、Rust `src/api/operations.rs`、Python `tansr_sdk/api/operations.py`、C++ `include/tansr/operations.hpp`）、ソースに `/v2`、`/v3/sdk2`、`/v3/terminal` のリテラルは現れません。生成物は上流のコミット番号とともにリポジトリ内にロックされ、CI がずれていないことを確かめます。
- **レスポンスゲートはフォールバックしない。** すべてのレスポンス（2xx と SSE のオープンを含む）は `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` をそろえて持たなければならず、ヘッダーの欠落、重複、形の崩れ、語彙外の `tansr-*` ヘッダーはすべて明示的に失敗します（Node `ContractUnavailableError`、.NET `ContractUnavailableException`、Android `TansrAgentException.ContractUnavailable` / `ApiContractException`、iOS `.contractUnavailable`、HarmonyOS `ApiContractError('contract_unavailable')`、Go `*api.ContractUnavailableError`、Rust `Error::Contract`、Python は `code == "contract"` の `Error`、C++ `ErrorCode::contract`）。パーサーを替えず、旧プレフィックスに戻らず、自動再試行もしません。
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

- パッケージは MIT で実行時の依存はゼロ、`engines` は Node 20.3 以上を要求します。`./api` サブエントリは `fetch` などの Web 標準 API だけに依存し、Node 固有のモジュールを持ち込まず、エージェントのカーネルも読み込みません。
- `createApiClient` のオプション：`baseUrl`（origin のみ）、`token` または `authorize`、`fetch` の注入、`sessionFamily`、`eventEnvelope`、`maxResponseBytes`（既定 2 MiB）、`maxEventFrameBytes`（既定 2 MiB）、`onContract`。
- メソッド：`manifest()`、`capabilities()`、`sessionCapabilities(sessionId)`（`{ closure, closureId, meta }` を返し、レスポンスヘッダーと本文の `closureId` が一致することを確かめ済み）、`call(name, { params, query, body, closureId, idempotencyKey, ifMatch, deadline, signal })`、`events(name, { params, query, lastEventId, signal, onOpen })`。`locked` と `observed()` はそれぞれビルド時にロックした値と実行時に観測した revision / `schemaHash` を示します。
- 結果の形は `{ status, body, meta }`。`meta` には `contract`、`manifestRevision`、`domain`、`schemaHash`、`closureId`、`eventEnvelope`、`traceId`、`etag`、`retryAfterMs` があります。202 は受理であって完了ではありません。
- エラー型：`ApiError`（統一エンベロープ：`code`、`status`、`retryAction`、`traceId`、`requestId`、`domainCode`、`detail`）、`DomainError`（正規化されていないファミリーの元のエンベロープ。今日は `archive-sync-v1` のみ）、`ContractUnavailableError`、`ApiClientError`（ローカル：`aborted`、`network_error`、`envelope_not_negotiated`、`payload_too_large`、`invalid_response`、`deadline_exceeded`、`if_match_not_applicable` など）。
- `API_OPERATIONS` は 81 操作のカタログ（revision 7）で、各項目に `method`、`path`、`params`、`aliases`、`domain`、`family`、`kind`、`sse`、`query`、`etagPath`、`expectedRevision`、`requestIdPath` があります。厳密なファミリー（`sdk2-*`、`terminal-*`、`archive-sync-v1`）のリクエスト本文は SDK が canonical JSON でエンコードします。
- 旧エントリ `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` は 0.3.0 で凍結され、今も同梱されます。0.4.0 では `routePrefixes` を省略したときの既定ルートが `/api` になりました。旧プレフィックスへ出すには `LEGACY_ROUTE_PREFIXES` を明示してください。エクスポート名の追加や削除はありません。

## .NET

```powershell
dotnet add YourApp.csproj package Tansr.Sdk --version 0.2.0
dotnet add YourApp.csproj package Tansr.Sdk.Windows --version 0.2.0
```

NuGet の現行公開版は **0.2.0**（`Tansr.Sdk` と `Tansr.Sdk.Windows`、2026-10-07、MIT、ソースは `tansrai/tansr-net`）です。`Tansr.Sdk` は `netstandard2.0` と `net10.0` を対象にし（`net10.0` では AOT 互換と宣言）、HTTP / SSE、セッション、実行の調整、ストレージインターフェースを担います。`Tansr.Sdk.Windows` は `net48` と `net10.0-windows` を対象にし、Windows のファイル / プロセス、ローカル SQLite、DPAPI のアダプターを加え、コアパッケージに自動で依存します。SDK はライブラリであり、.NET ランタイムを同梱しません。.NET Framework アプリにはシステムのランタイムが必要で、モダン .NET アプリは自己完結型で発行できます。`/api` だけを経由します。パス定数 `Tansr.Sdk.Api.ApiRoutes` は `node scripts/generate-api-routes.mjs` がリポジトリ内に vendored された `contract/api-manifest.json` から生成します。汎用入口は `client.CallAsync(ApiRoutes.X, new ApiCallOptions { IdempotencyKey, IfMatch, Deadline, ClosureId })`、クロージャは `client.GetCapabilityClosureAsync(sessionId)` で取得し、統一エンベロープは `UnifiedApiException` にデコードされます（`Code` / `StatusCode` / `RetryAction` が主、ファミリーの事実は `Detail.DomainCode` / `DomainStatus` / `DomainRetryAction`）。`UnifiedRetry.Advice(error)` と `UnifiedRetry.RetrySameRequestAsync(...)` が再試行の規律を担い、`TansrClientOptions.NegotiateEventEnvelope` がイベントエンベロープを明示的に交渉し、返ってこなければ `EnvelopeNotNegotiatedException` をスローします。より古い 0.1.0.2 も NuGet に残っていますが、この契約整合より前なので `/api` クライアントとして扱わないでください。例は WPF、WinForms（.NET Framework 4.8）、コンソールの 3 種で、ソースリポジトリの `examples/` にあります。

## Android

Maven Central **0.5.0**（2026-10-07）からすべての HTTP リクエストが `/api` だけを経由します。生成物 `core/src/main/kotlin/com/tansr/sdk/api/ApiContract.kt`（`ApiContract` 定数と `ApiOps` の 81 操作、`etagPath` / `expectedRevision` を含む）と `UnifiedContract.kt`（`UnifiedCode` 19 コード、`UnifiedRetryAction` 6 動作）。レスポンスゲートは `ApiContractGate.requireUnifiedValues`。エラーは `TansrAgentException.Unified`（SDK1）または `ApiFacadeException`（SDK2 / ターミナル）に落ち、古い 33 の sealed 型は非推奨にして 1 バージョンだけ残します。3 つのリクエストヘッダーは `ApiCallOptions(idempotencyKey, ifMatch, deadline)` を通じて `Sdk2Client.createBinding / acknowledge / closeBinding` と `TerminalClient.configure / memoryCommand` で任意に付けられます。ジェネレーターは `node scripts/api/generate-api-contract.mjs --cli <tansr-cli>` で、`:core:contractCheck` に同一出所の対応表と 165 本のゴールデンベクターのリプレイが含まれます。0.4.0 以前の成果物はこれらの変更より前のもので、まだ旧プレフィックスを使います。アップグレードでは `core` / `client` / `compose` をそろって 0.5.0 に上げてください。任意の `receiver-android` は同じバージョンで初めて公開されました。導入の基本は [Android SDK](/ja/android/) を参照してください。

## iOS

公開バイナリ SPM **0.4.0**（2026-10-09、iOS 16 以上、macOS 13 以上）からパスの単一ソースは `Sources/TansrCore/Api/ApiContract.swift`（`ApiContract`、`ApiOps` の 81 操作）です。レスポンスヘッダーのゲート `ApiContractGate.requireUnified` は SDK1 のすべての 2xx レスポンス、イベントストリームのオープン、音声クライアントを覆い、違反は `TansrAgentError.contractUnavailable` / `ApiContractError.contractUnavailable` になり、イベントポンプは 2xx 形の契約不可に対して直接 `failed` の終端状態に入ります。エラーモデルは `TansrAgentError.kind == .unified`（`unifiedCode` + `retryAction`）と `ApiFacadeError`。`ApiCallOptions` が 3 つのリクエストヘッダーを運び、`onManifestRevisionDrift` はレスポンスの revision がローカルの revision 7 と異なるときにクライアントごとに 1 回発火します。CI の `contract:check` とフルパッケージの `swift test` にゴールデンベクターのリプレイが含まれます。0.4.0 は SDK2 クライアント、アーカイブの同期と受信側、実行ジャーナル、ターミナルインターフェースを初めて同梱したリリースでもあります。0.3.0 はこれらの変更より前のもので、まだ旧プレフィックスを使います。0.3.0 から上げるときは、統一コードと `retryAction` を軸にエラー分岐を書き直してください。導入の基本は [iOS SDK](/ja/ios/) を参照してください。

## HarmonyOS

同梱 HAR **0.2.0**（2026-10-10、最低 HarmonyOS 6.0 / API 20、OHPM チャネルなし）から業務コードは `ApiOps.*.apiPath` / `apiPath()` だけを参照します。生成物 `tansr/src/main/ets/core/api/ApiContractGenerated.ets`、`core/api/UnifiedContractGenerated.ets`、`core/sdk2/client/SchemaGenerated.ets` は `node scripts/api/generate-api-contract.mjs --cli <tansr-cli root>` がマニフェスト、`sdk2-ext-v1.schema.json`、`unified-v1.schema.json`、`unified-v1.golden.json` から同一出所で生成し、`pnpm check:contract` が生成物とロックの整合を確かめます。4 つの統一レスポンスヘッダーが 1 つでも欠ければ `contract_unavailable`（`reason` 付き）で、セッションポンプは 2xx 形の契約不可に対して直接 `failed` の終端状態に入ります。SDK1 は `AgentError` で復元し（`error.unified`、`error.retryAction`、`error.domainCode`）、SDK2 / ターミナルは `ApiFacadeError` を直接スローします。3 つのリクエストヘッダーは `ApiCallOptions(idempotencyKey, ifMatch, deadline)` でローカルで先に判定されます。0.1.0 の HAR はこれらの変更より前のもので、まだ旧プレフィックスを使います。導入の基本は [HarmonyOS SDK](/ja/harmony/) を参照してください。

## Go

```go
client, err := api.New(api.Options{BaseURL: "http://127.0.0.1:8787", Token: token, EventEnvelope: true})
closure, err := client.SessionCapabilities(ctx, sessionID)
res, err := client.Call(ctx, api.OpSessionMessageSend, api.CallOptions{
    Params: map[string]string{"id": sessionID}, Body: map[string]any{"prompt": "hi"}, ClosureID: closure.ClosureID,
})
stream, err := client.Events(ctx, api.OpSessionEventsObserve, api.EventsOptions{Params: map[string]string{"id": sessionID}})
```

`github.com/tansrai/tansr-go` **v0.3.0**（2026-10-07、MIT、Go 1.25 以上、標準ライブラリのみ、実行時のサードパーティ依存なし）。モジュールパスは `github.com/cpple/tansr-go` から移りました。`v0.1.0` は `api` / `canonical` / `sse` だけです。`v0.2.0` から `session`、`executor`、`archive` が実装になり、`go-chat` / `go-tools` / `go-archive` が付きます。`v0.3.0` が変えるのはモジュールパスだけで、プロトコルの挙動は `v0.2.0` と同じです。上げるときは `go.mod` とすべての import を一緒に直し、新旧モジュールの型を混ぜないでください。導入は `go get github.com/tansrai/tansr-go@v0.3.0` です。3 つの例はそのままコマンドとしてインストールできます（例：`go install github.com/tansrai/tansr-go/examples/go-chat@v0.3.0`。`go-tools`、`go-archive` も同様）。ソースは `tansrai/tansr-go` にあります。

## Rust

```sh
cargo add tansr-sdk@=0.1.0
```

`tansr-sdk` と `tansr-sdk-demo` の **0.1.0** は crates.io にあります（2026-10-08、MIT、edition 2024）。Rust 1.85 以上が必要です。Windows では MSVC のビルドツールに加え、いまのシェルの PATH に NASM が要ります。非同期クライアントは統一 `/api` を使い、高水準セッション、明示的な業務ツール、単一デバイスの暗号化アーカイブが同梱されます。例のコマンドは `tansr-chat`、`tansr-tools`、`tansr-archive` で、`cargo install tansr-sdk-demo --version 0.1.0 --locked` でインストールします。ソースは `tansrai/tansr-rust` にあります。

## Python

```sh
python -m pip install tansr-sdk==0.1.0
```

`tansr-sdk` と `tansr-sdk-demo` の **0.1.0** は PyPI にあります（2026-10-08、MIT、ソースは `tansrai/tansr-python`）。`requires-python` は `>=3.7,!=3.9.0,!=3.9.1` です。CPython 3.7 以上をサポートしますが、3.9.0 と 3.9.1 は除きます。最低 Python バージョンと TLS のベースラインは別々の条件です。既定の HTTPS トランスポートはまず標準ライブラリの SSL ランタイムを確かめ、影響を受けることが分かっている OpenSSL（Windows 公式 Python 3.7.9 に同梱の 1.1.1g など）は `unsupported_tls_runtime` として拒否され、回避スイッチはありません。発行説明にある隔離ランタイムに切り替え、新しいプロジェクトでは保守されているインタプリタを優先してください。同期 API と asyncio は同じ `/api` 実装を共有します。例のコマンド `tansr-py-chat`、`tansr-py-tools`、`tansr-py-archive` は `tansr-sdk-demo` に入っており、`python -m pip install tansr-sdk-demo==0.1.0` でインストールします。

## C++

```cmake
find_package(TansrSDK 0.1.0 EXACT CONFIG REQUIRED)
target_link_libraries(my_app PRIVATE tansr::sdk)
```

`tansrai/tansr-cpp` の GitHub Release **v0.1.0**（2026-10-08、MIT）はソースパッケージと、Windows x64（MSVC 19.44）、Linux x64（Ubuntu 24.04 / GCC 13.3、glibc 2.38 以上）、macOS arm64（AppleClang 21、macOS 26.0 以上）向けの Release 静的 SDK および独立 Demo を配ります。Conan / vcpkg のレシピはリリースの添付物として自前で配布され、Conan Center と公開 vcpkg 索引にはまだ入っていません。言語水準は C++17 です。ソースからビルドするには CMake 3.25 以上と Ninja が必要で、依存は curl 8.22.0、c-ares 1.34.8、OpenSSL 3.5.9 に固定されています。発行一覧に従って自分で用意してください。CMake は自動ダウンロードしません。例は `tansr-chat`、`tansr-tools`、`tansr-archive` です。

## 次のステップ

- 各クライアントが同じように判定するエラーと動作を理解するには、[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を読んでください。
- モバイル 3 つの SDK の導入手順はそれぞれ [Android SDK](/ja/android/)、[iOS SDK](/ja/ios/)、[HarmonyOS SDK](/ja/harmony/) を参照してください。各クライアントの新しいバージョンは、各リポジトリのリリース記録とこのサイトの[リリースノート](/releases/sdk/)に登録されます。
