---
title: 呼び出し面、ドメインと操作カタログ
description: /api 配下の 9 つのドメイン、マニフェスト revision 7 の 11 ファミリーと 81 操作（読み 39 / 書き 38 / ストリーム 4）、操作の命名とパステンプレート、クエリ文字列のリビジョン識別子、セッションファミリーのリクエストヘッダー、そして /api に属さないパス。
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

`/api` の呼び出し面全体は、機械可読な 1 つの能力マニフェスト（manifest）で定義されています。各操作には安定した名前、HTTP メソッド、パステンプレート、許可されるクエリキー、読み / 書き / ストリームの分類があります。公式クライアントのパスモジュールはすべてこのマニフェストから生成されており、このページではそのうち「どう呼ぶか」に関わる事実を広げて示します。

## 組み込み条件とプレフィックス

- `/api` は `/v2` セッション面と一緒に組み込まれます。ライブラリ形態では `startServer({ v2: … })`、CLI 形態では `tansr serve --v2`（または `TANSR_SERVE_V2=1`）です。`--v2` なしで SDK1 だけを有効にした `tansr serve` には `/api` はありません。
- `/api` が唯一の公開プレフィックスです。`/v2`、`/v3/sdk2`、`/v3/terminal`、`/v3/terminal-observation`、`/v3/terminal-profile` はプロセス内に残りますが、内部アダプターの入口としてだけ使われ、1.0.0 で外部からの到達性が取り除かれます。[移行と廃止のタイムテーブル](/ja/unified-api/migration/)を参照してください。
- `/healthz`、`/readyz`、`/metrics` は `/api` の下になく、この契約の対象でもありません。デプロイ面は[デプロイと認証](/ja/serve/deploy-and-auth/)を参照してください。
- パスパラメータはサーバー側でパーセントデコードしてからマッチングされます。デコードできないセグメントは存在しないリソースとして扱われ（404 `not_found`）、内部パスが漏れることはありません。

## 9 つのドメイン

| ドメイン（`tansr-domain`） | 操作数 | 範囲 | 所属ファミリー |
|---|---|---|---|
| `discovery` | 3 | マニフェスト、全体の能力、セッション単位の能力クロージャ | `unified-v1` |
| `session` | 26 | セッションのライフサイクル、メッセージ、イベントストリーム、ツール / 許可 / 質問への応答、スナップショット、音声、入力、承認クレデンシャル | `agent-session-v1` |
| `execution` | 9 | 実行の初期化と境界、実行バインディング、エグゼキューターの登録 / ハートビート / 取得 / 受領 | `sdk2-ext-v1` |
| `archive` | 16 | アーカイブバインディング、アーカイブの状態とレコード、ACK のコミットとリベース、マテリアルの応答とアップロード | `sdk2-ext-v1`、`sdk2-archive-recovery-v1` |
| `archive-sync` | 1 | アーカイブ同期 | `archive-sync-v1` |
| `cache` | 10 | キャッシュバインディングのオープン / 更新 / 再バインド / ローテーション / クローズ、診断 | `sdk2-cache-v1`、`sdk2-cache-core-v1` |
| `terminal` | 12 | ターミナルバインディング、エグゼキューターのイベントストリーム、出力バッチと観測、セッション設定とメモリ | `terminal-services-v1` |
| `terminal-observation` | 2 | リソースと出力の相関クエリ | `terminal-observation-v1` |
| `terminal-profile` | 2 | プロファイルカタログと使用量 | `terminal-profile-v1` |

ドメインは `/api` 層の概念で、レスポンスヘッダー `tansr-domain`、エラーマトリクスのグループ分け、能力クロージャに使われます。ファミリー（family）はドメインサブ契約のバージョン単位です。マニフェスト revision 7 には 11 のファミリーがあり（上の 10 に加えて、まだ `/api` の入口を持たない `terminal-shell-sandbox-v1`）、各ファミリーの `status` フィールドが成熟度を表します。`agent-session-v1` は `frozen`、`sdk2-ext-v1` は `final`、`unified-v1` と `terminal-services-v1` は `candidate`、`sdk2-cache-v1` は `drafted`、残りは `additive` です。

## 操作の命名とパステンプレート

操作名は `ドメイン.リソース.動詞` の形です。`session.message.send`、`archive.binding.create`、`cache.binding.renew`、`terminal.output.observe` のようになります。パステンプレートは `:id`、`:targetId`、`:ticketId`、`:uploadId` のプレースホルダーを使い、クライアントは厳密に埋めます。パラメータの不足や過剰、空セグメント、エンコードされていない `/` はローカルで拒否すべきです。少数の操作にはエイリアスがあり（たとえば `terminal.configuration.read` は `/api/terminal/sessions/:id/configuration` と `/api/sessions/:id/configuration` の両方を受け付けます）、エイリアスは互換性のための入口にすぎず、生成されたクライアントは常に主パスを使います。

以下は各ドメインの代表的な操作です（81 操作すべてはマニフェストが正）。

| 操作 | メソッドとパス | 種別 |
|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | 読み |
| `discovery.capabilities` | `GET /api/capabilities` | 読み |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | 読み |
| `session.create` | `POST /api/sessions` | 書き |
| `session.get` | `GET /api/sessions/:id` | 読み |
| `session.message.send` | `POST /api/sessions/:id/messages` | 書き |
| `session.events.observe` | `GET /api/sessions/:id/events` | ストリーム |
| `session.interrupt` | `POST /api/sessions/:id/interrupt` | 書き |
| `session.tool.result` | `POST /api/sessions/:id/tool-results/:targetId` | 書き |
| `session.permission.decide` | `POST /api/sessions/:id/permission/:ticketId` | 書き |
| `session.question.answer` | `POST /api/sessions/:id/questions/:ticketId` | 書き |
| `session.checkpoint.create` | `POST /api/sessions/:id/checkpoints` | 書き |
| `session.close` | `DELETE /api/sessions/:id` | 書き |
| `approval.credential.submit` | `POST /api/approvals/:id/credential` | 書き |
| `execution.binding.create` | `POST /api/sessions/:id/execution-bindings` | 書き |
| `executor.register` | `POST /api/executors/connections` | 書き |
| `executor.operations.poll` | `GET /api/executors/:id/operations` | 読み |
| `archive.binding.create` | `POST /api/archive/bindings` | 書き |
| `archive.binding.get` | `GET /api/archive/bindings/:id` | 読み |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | ストリーム |
| `archive.records.read` | `GET /api/archive/bindings/:id/archive/records` | 読み |
| `archive.ack.commit` | `POST /api/archive/bindings/:id/archive/acks` | 書き |
| `archive.ack.rebase` | `POST /api/archive/bindings/:id/archive/ack-rebases` | 書き |
| `material.upload.chunk` | `POST /api/archive/bindings/:id/materials/:targetId/uploads/:uploadId/chunks` | 書き |
| `archive.sync` | `POST /api/archive/sync/:id` | 書き |
| `cache.binding.open` | `POST /api/cache/bindings` | 書き |
| `cache.binding.renew` | `POST /api/cache/bindings/:id/renew` | 書き |
| `cache.diagnostics` | `GET /api/cache/bindings/:id/diagnostics` | 読み |
| `terminal.binding.create` | `POST /api/terminal/bindings` | 書き |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | ストリーム |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | ストリーム |
| `terminal.configuration.commit` | `POST /api/terminal/sessions/:id/configuration` | 書き |
| `terminal.memory.command` | `POST /api/terminal/sessions/:id/memory/commands` | 書き |
| `terminal.observation.resources` | `GET /api/terminal/observation/sessions/:id/resources` | 読み |
| `terminal.profile.usage` | `GET /api/terminal/profile/sessions/:id/usage` | 読み |

読み / 書き / ストリームの 3 種別の違いはメソッドだけではありません。`Idempotency-Key` を受け付けるのは**書き**操作だけ、`If-Match` を受け付けるのはマニフェストに `expectedRevision` が登録された 9 つの書き操作だけ、イベントエンベロープの交渉に参加するのは 4 つの**ストリーム**操作だけです。[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)と[イベントストリームと統一イベントエンベロープ](/ja/unified-api/events/)を参照してください。

## クエリ文字列のリビジョン識別子

ドメインサブ契約のリビジョンはパスではなくクエリ文字列に置かれ、**GET 操作（読みとストリーム）**にだけ現れます。

| ドメイン | クエリキー | 値 |
|---|---|---|
| `execution`、`archive` の GET 読みとストリーム、および `session.capabilities`（`GET /api/capabilities/sessions`） | `protocol` | `sdk2-ext-v1` |
| `cache` の GET 読み | `protocol` | `sdk2-cache-v1`。`cache.core.diagnostics` は `sdk2-cache-core-v1` |
| `terminal`、`terminal-observation`、`terminal-profile` の GET 読みとストリーム | `contract`、`sessionContract` | `terminal-services-v1` / `terminal-observation-v1` / `terminal-profile-v1`。`sessionContract` はセッションが属するファミリーを指す |

3 つのルール：

- 書き操作はクエリキーを受け付けません（唯一の例外は `session.checkpoint.import` の省略可能な `label`）。3 つのディスカバリーエンドポイント、`GET /api/capabilities/archive`、`GET /api/capabilities/cache` も同様に受け付けません。余分なキーはすべて 400 `invalid_request` です。
- `protocol` を付けたのに値がその操作に登録されたリビジョンでない場合（たとえば `protocol=sdk2-ext-v0`）は 400 `protocol_mismatch` です。
- 各操作が許可するクエリキーは閉じた許可リストです（たとえば `archive.records.read` は `protocol`、`historyEpoch`、`deletionGeneration`、`projectionRevision`、`limit`、`maxBytes`、`afterSequence` を許可します）。リスト外のキーも同様に 400 です。

`@tansr/api-client/api` は操作が属するファミリーに応じて `protocol` / `contract` の既定値を自動で注入します（明示的に渡した値が優先）。あなたが渡すのは業務上のクエリキーだけです。

## セッションファミリー

セッションには 2 つのファミリーがあります。`sdk1`（カーネルがセッションサービスのプロセス内で動く）と `sdk2-offload-v1`（実行をバインドされたターミナルエグゼキューターにオフロードする）です。旧プレフィックスはパスで区別していましたが、`/api` ではパスは同じで、リクエストヘッダー `tansr-session-family: sdk1 | sdk2-offload-v1` が宣言します。このヘッダーがなければサーバーはデプロイの優先ファミリーを使います。優先ファミリーと利用可能なファミリーは `GET /api/capabilities` レスポンスの `domains.session.family.preferred` / `available` から読めます。語彙外の値は 400 `invalid_request`、語彙内だがこのデプロイに組み込まれていないファミリーは `capability_unavailable`（`detail.reason: not_installed`）です。

## `/api` にないもの

- `/v1` の 6 本のシングルテナントルート（`/v1/status`、`/v1/sessions` ファミリーなど）は操作カタログに含まれず、`/api` の下に対応物もありません。`approval.credential.submit` は `/v1` から `/api` に移された唯一の操作です。`/api` を組み込んだデプロイでは `/v1` は既定でオフです。詳しくは[移行と廃止のタイムテーブル](/ja/unified-api/migration/)を参照してください。
- プラットフォーム側のインターフェース（`/t1/*`、`/v1/app-tokens`、`/v1/my-usage` など）はマニフェストの `platformApi` フィールドから読み取り専用で参照されるだけで、ホストはプラットフォームであってあなたのセッションサービスではありません。
- Electron の完全な SDK と IPC モードは `/api` を経由しません。
