---
title: 移行と廃止のタイムテーブル
description: /v2、/v3/sdk2、/v3/terminal* から /api へ切り替えるときのパス対応表とリクエスト / エラー形の違い。@tansr/serve 0.13.0 以降、/api を組み込んだデプロイでセッションサービスの /v1 が既定でオフになることと --legacy-v1 による移行期間。0.14.0 時点での 6 ステップ移行の進み具合。/v2 と /v3/* の廃止スケジュール、そしてサーバーとクライアントをペアでロールバックする規律。
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
lastVerified: '2026-10-09'
---

`/api` は新しいプロトコルではなく、既存のドメインサブ契約を同じプレフィックス、同じエンベロープの下に集めたものです。したがって移行の主な作業はパス、ヘッダー、エラー判定の置き換えであって、業務ロジックの書き直しではありません。成功レスポンス本文とイベントペイロードは 1 バイトも変わりません。

## パス対応表

旧プレフィックスと `/api` の対応はマニフェストの各操作の `legacy` フィールドに登録されています。よく使うものを挙げます。

| 旧パス | `/api` | 備考 |
|---|---|---|
| `POST /v2/sessions` | `POST /api/sessions` | セッションファミリー `sdk1`（既定） |
| `POST /v3/sdk2/sessions` | `POST /api/sessions` + `tansr-session-family: sdk2-offload-v1` | パスは同じで、ファミリーはリクエストヘッダーが宣言する |
| `GET /v2/sessions/:id/events` | `GET /api/sessions/:id/events` | 交渉ヘッダーなしならフレームはバイト単位で同一 |
| `POST /v2/sessions/:id/permission/:requestId` | `POST /api/sessions/:id/permission/:ticketId` | プレースホルダー名が `:ticketId` に変更（`:id` は引き続きセッション id） |
| `POST /v1/approvals/:id/credential` | `POST /api/approvals/:id/credential` | `/v1` から移された唯一の操作（0.14.0） |
| `GET /v3/sdk2/session-capabilities` | `GET /api/capabilities/sessions?protocol=sdk2-ext-v1` | |
| `GET /v3/sdk2/capabilities` | `GET /api/capabilities/archive` | クエリ文字列なし |
| `POST /v3/sdk2/bindings` | `POST /api/archive/bindings` | |
| `GET /v3/sdk2/bindings/:id` | `GET /api/archive/bindings/:id?protocol=sdk2-ext-v1` | GET 読みは `protocol` を付ける |
| `POST /v3/sdk2/bindings/:id/archive/acks` | `POST /api/archive/bindings/:id/archive/acks` | |
| `POST /v3/sdk2/archive-sync/:id` | `POST /api/archive/sync/:id` | エラー本文は引き続き `archive-sync-v1` の元のエンベロープ |
| `GET /v3/sdk2/cache/capabilities` | `GET /api/capabilities/cache` | |
| `POST /v3/sdk2/cache/bindings` | `POST /api/cache/bindings` | |
| `POST /v2/executors/connections` | `POST /api/executors/connections` | |
| `GET /v3/terminal/capabilities` | `GET /api/capabilities/terminal?contract=terminal-services-v1` | |
| `POST /v3/terminal/bindings` | `POST /api/terminal/bindings` | |
| `GET /v3/terminal/sessions/:id/tool-output` | `GET /api/terminal/sessions/:id/tool-output?contract=…&sessionContract=…` | |
| `GET /v3/terminal-observation/sessions/:id/resources` | `GET /api/terminal/observation/sessions/:id/resources` | プレフィックスのセグメントが `terminal/observation` に |
| `GET /v3/terminal-profile/sessions/:id/catalog` | `GET /api/terminal/profile/sessions/:id/catalog` | プレフィックスのセグメントが `terminal/profile` に |

この表を手で保守しないでください。公式クライアントのパスモジュールはマニフェストから生成されており、自分でクライアントを書くときも `GET /api/manifest` またはリポジトリ内の `api-manifest.json` から生成すべきです。

## リクエストとエラー形の違い

| 観点 | 旧プレフィックス | `/api` |
|---|---|---|
| セッションファミリー | パスで区別（`/v2` と `/v3/sdk2`） | パスは同じで、リクエストヘッダー `tansr-session-family` |
| サブ契約のリビジョン | 一部はパスや本文に | GET 読みはクエリ文字列 `protocol=` / `contract=`、POST 書きはクエリ文字列を受け付けない |
| レスポンスヘッダー | 統一ヘッダーなし | すべてのレスポンスが `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` を持つ |
| エラー本文 | `{ error: { code, message, detail? } }`、コードは各ファミリーの語彙 | 8 キーの統一エンベロープ。`code` は 19 の統一コードで、ファミリーコードは `detail.domainCode` に下がる |
| 一部エラーのステータス | `session_ended` 409、`binding_closed` 409、`unsupported_capability` 422 / 409 | 410 `gone`、410 `gone`、404 `capability_unavailable`（元のステータスは `detail.domainStatus`） |
| イベントフレーム | 各ドメインの元のフレーム | 交渉ヘッダーなしなら同一。`tansr-event-envelope: unified-v1` を付けると 7 キーのエンベロープ |
| 冪等 / 条件付き書き込み / 期限 | 本文内の `requestId` / `expectedRevision` だけ | さらに `Idempotency-Key` / `If-Match` / `deadline` ヘッダーが使える（0.14.0 以降）。サーバーが本文内の位置に写す |
| 2xx レスポンス本文 | — | **バイト単位で同一** |

移行で最も見落としやすいのはエラー判定です。`error.code === 'session_ended'` のような分岐を統一コード `gone` での判定に改め、`retryAction` で動作を決め、細かく分けたいときにだけ `detail.domainCode` を読んでください。詳しくは[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を参照してください。

## セッションサービスの `/v1`

セッションサービスのプロセス内にある `/v1`（`/v1/status`、`/v1/sessions` ファミリーなどのシングルテナント Bearer ルート）と `/api` は 2 つの別々のアイデンティティ体系で、`/api` の下にそれらの対応物はありません。`@tansr/serve` 0.13.0 以降は次のとおりです。

- **`/api` を組み込んだデプロイでは `/v1` が既定でオフ**です。ライブラリ形態で `startServer({ v2: … })` を使うと `disableV1` の既定は `true` になり、`/v1*` へのリクエストは 404 を受け取ります。CLI 形態の `tansr serve --v2` も同じです。
- 移行期間の維持：ライブラリには `disableV1: false` を渡します。CLI では `--legacy-v1` を付けるか、環境変数 `TANSR_SERVE_LEGACY_V1=1` を設定します（フラグが環境変数より優先）。
- `--v2` を付けない SDK1 だけの `tansr serve` には `/api` がなく、影響も受けません。`/v1` はこれまでどおりです。
- `@tansr/serve` 0.14.0 と `@tansr/cli` 0.10.1（2026-10-04）は `--legacy-v1` / `TANSR_SERVE_LEGACY_V1` を**非推奨**にしました。引き続き有効ですが、起動時に非推奨の告知が出ます。これは独立した廃止項目で、取り除く時点は 1.0.0 より前に別途告知されます。

このサイトの REST リファレンスにある `/v1` はプラットフォーム側のインターフェースで、ここで述べたセッションサービスの `/v1` とは無関係です。

## 6 ステップの移行と現在の進み具合

| ステップ | 内容 | `@tansr/serve` 0.14.0 時点の状況 |
|---|---|---|
| 1 | 内部アダプター：`/api` が書き換えて既存のドメインハンドラーに委譲し、旧プレフィックスはバイト単位で不変 | 完了（0.13.0） |
| 2 | 二重書き込み / シャドウ読み取り：同じゴールデンベクターを旧入口と `/api` の両方で走らせ、成功本文はバイト単位で同一、エラー本文はフィールド単位で同じ出所 | Node と .NET には同一出所の対応表と適合性リプレイがある。Android / iOS / HarmonyOS / Go は 165 本のゴールデンベクターのリプレイで整合 |
| 3 | クライアントの切り替え：各クライアントのソースに旧プレフィックスのリテラルが残らない | Node `@tansr/api-client` 0.3.0 正式版は切り替え済み（`./api`）。.NET NuGet 0.2.0、Go `github.com/tansrai/tansr-go` v0.3.0、Rust / Python / C++ 0.1.0 は公開パッケージで `/api` に載っています。Android、iOS、HarmonyOS のリリース状況は[各言語のクライアント](/ja/unified-api/clients/)を参照。`examples/serve-demo` は公開 SDK 経由に変更 |
| 4 | 新旧混用の禁止：同じセッションファミリーが 2 種類のプレフィックスで交差アクセスされたら構造化された警告を出す（拒否はしない） | 未着手 |
| 5 | 旧入口の読み取り専用ウィンドウ：`/v2`、`/v3/*` の書き操作は 410 を返し、読みは引き続き受け付け、レスポンスに廃止ヘッダーを付ける | 未着手。**0.14.0 では始まらず、最も早くて 0.15.0** |
| 6 | クローズ：`/v2`、`/v3/*` の外部から到達できる入口を取り除き、旧プレフィックスは統一エンベロープの 404 を返す | 1.0.0 |

セルフホストの複数レプリカ構成では、ステップ 3 の前にリバースプロキシを調整する必要があります。`/api/sessions/:id/**` は `/v2/sessions/:id/**` と同じシャードアフィニティで流し、`/api` の下の 4 本の SSE パスは同じ長時間接続の規律に従わせてください。そうしないと切り替え後にレプリカをまたいだ 404 が起きます。

## 廃止のタイムテーブル

| マイルストーン | リリース | 公開契約の変化 |
|---|---|---|
| 2026-10-02 | `@tansr/serve` 0.13.0、`@tansr/protocol` 0.2.0、`@tansr/cli` 0.10.0 | `/api` が正式に利用可能。`/api` を組み込んだデプロイで `/v1` が既定でオフ。`/v2`、`/v3/*` の 1.0.0 での廃止を予告 |
| 2026-10-04 | `@tansr/serve` 0.14.0、`@tansr/cli` 0.10.1、`@tansr/api-client` 0.3.0 | マニフェスト revision 7、3 つのリクエストヘッダー。`--legacy-v1` を非推奨に |
| 0.15.0 以降（未定） | `@tansr/serve` | ステップ 4 の警告とステップ 5 の読み取り専用ウィンドウを最も早く始められる時点。読み取り専用ウィンドウは対応するリリースノートに明記される |
| 1.0.0 | `@tansr/serve` 1.0.0、`@tansr/api-client` 1.0.0 | `/v2`、`/v3/*` の外部入口を取り除き、`/api` が唯一の呼び出し面になる。`unified-v1` ファミリーが `candidate` から `frozen` に。`@tansr/api-client` の SDK1 エントリが非推奨になり、2.0 で削除 |

`/v1` のオフと `/v2`、`/v3/*` の廃止は 2 つの独立した公開契約の変更で、それぞれにリリースノートがあります。

## ペアでのロールバック

- **サーバーのロールバックはクライアントとペアでなければなりません。** 0.12.0 には `/api` がありません。`/api` に切り替え済みのクライアントは `tansr-contract` ヘッダーのない旧形の 404 を受け取り、規律に従って「契約が利用できない」と報告し、自動では旧プレフィックスに戻りません。サーバーを 0.12.0 に戻すときは、Node は `@tansr/api-client` 0.2.0 と旧入口に戻し、モバイルは 1 つ前のリリースに戻してください。
- **クライアントは単独でロールバックできます。** 0.13.0 / 0.14.0 のサーバーは `/v2`、`/v3/*` を保持しており、古いクライアントにプロトコルの断絶はありません。これは 1.0.0 の前まで保たれます。
- 0.13.0 と 0.14.0 にストレージ形式の変更はありません。セッションストア、アーカイブホスト、キャッシュ媒体はロールバック中に移行を必要としません。
- リバースプロキシのテンプレートとクライアントの切り替えは同じ方向に動かす必要があります。クライアントが `/api` に切り替え済みなのにテンプレートを戻すと、シャードアフィニティが失われます。

## Node クライアントのエントリ移行

`@tansr/api-client` 0.3.0 は 4 つの旧エントリ `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` を**凍結**し（パッケージとともに配布、変更なし、削除なし）、`./api` を追加しました。移行の推奨手順：

1. 新しいコードは必ず `import { createApiClient } from '@tansr/api-client/api'` を使い、操作名で呼び、パスを組み立てません。
2. 旧エントリの呼び出し箇所を操作名ごとに `api.call(...)` へ移します。アーカイブ / キャッシュ / ターミナルの GET 読みでは `protocol` / `contract` を手で埋める必要はなく、SDK が操作ごとに既定のリビジョン値を注入します。
3. エラー処理をファミリーコードから統一コード + `retryAction` に改め、必要なら `error.domainCode` を読みます。
4. 同じプロセス、同じセッションファミリーの中で新旧エントリを併用しないでください。それこそがステップ 4 で警告される「混用」です。
