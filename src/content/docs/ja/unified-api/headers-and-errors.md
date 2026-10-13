---
title: 統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ
description: /api のリクエストが付けられるヘッダー（Authorization、x-request-id、tansr-session-family、tansr-closure-id、tansr-event-envelope、Idempotency-Key、If-Match / ETag、deadline）、すべてのレスポンスが必ず持つ 4 つの tansr-* ヘッダー、そして 400 以上のときの統一エラーエンベロープ。19 の統一コード、6 種の retryAction、detail.domainCode の読み方とステータス書き換えのルール。
zone: docs
category: unified-api
sidebar:
  order: 4
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/events
  - unified-api/clients
  - errors/codes
  - sdk/errors-and-retries
  - serve/v2-and-webhooks
sources:
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-error-map.json
  - tansr-cli:packages/server/src/api/request-headers.ts
  - tansr-cli:packages/server/src/api/error-envelope.ts
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-13'
---

`/api` は「1 回のリクエストをどう表すか」と「1 回の失敗をどう表すか」を各ドメインサブ契約から取り出して統一的に定義します。このページはその 2 つの事実表です。成功レスポンス本文はこのページの範囲外で、各ドメインサブ契約が決め、旧プレフィックスとバイト単位で同一です。

## リクエストヘッダー

| ヘッダー | 適用範囲 | セマンティクス |
|---|---|---|
| `Authorization: Bearer <token>` | すべてのリクエスト | アイデンティティはここにだけあります。欠落または無効なら 401 `unauthorized`（レスポンスに `www-authenticate: Bearer`）、認証ソースが利用できなければ 503 `capacity_exceeded`（`retry-after` 付き）。本文内のアイデンティティフィールドは認証結果と一致していなければならず、そうでなければ拒否されます |
| `x-request-id`（または W3C `traceparent`） | 任意 | トレース識別子。正しい形の `x-request-id`（英数字と `._-` の 1〜128 文字）はそのまま採用され、そうでなければ `traceparent` の trace-id、それもなければサーバーが生成します。レスポンスヘッダー `x-request-id` とエラーエンベロープの `traceId` は同じ値です。業務上の冪等キー `requestId` とは無関係です |
| `tansr-session-family: sdk1 \| sdk2-offload-v1` | 任意。セッションドメインと実行ドメイン | セッションファミリーを宣言します。既定はデプロイの優先ファミリー。語彙外なら 400 `invalid_request`、組み込まれていなければ `capability_unavailable`（`detail.reason: not_installed`） |
| `tansr-closure-id: <closureId>` | 任意。セッション内の書き操作のみ | クロージャの事前条件。不一致なら 412 `precondition_failed` / `rediscover`。`GET` やセッション外のパスに付けると 400。[ディスカバリーと能力クロージャ](/ja/unified-api/discovery-and-closure/)を参照 |
| `tansr-event-envelope: unified-v1` | 任意。ストリーム操作で有効 | 統一イベントエンベロープの明示的な交渉。サーバーが同名ヘッダーを返せば確認です。語彙外の値で任意の `/api` パスにアクセスすると 400。[イベントストリームと統一イベントエンベロープ](/ja/unified-api/events/)を参照 |
| `Idempotency-Key: <key>` | 任意。書き操作のみ | 書き操作の冪等キー。`@tansr/serve` 0.14.0 から有効。次の節を参照 |
| `If-Match: "<revision>"` | 任意。`expectedRevision` が登録された 9 つの書き操作のみ | リソースバージョンの事前条件。0.14.0 から有効。次の節を参照 |
| `deadline: <RFC 3339>` | 任意 | リクエストの絶対的な期限。0.14.0 から有効。次の節を参照 |

## 3 つのリクエストヘッダー：冪等性、条件付き書き込み、期限

この 3 つのヘッダーはいずれも**明示的な交渉**です。形が不正、または適用できないヘッダーは無視されず、400 `invalid_request` になります。`detail.reason` が細かな理由（`idempotency_key_invalid` / `idempotency_key_not_applicable` / `if_match_invalid` / `if_match_not_applicable` / `deadline_invalid`）を、`detail.header` がヘッダー名を示します。

### `Idempotency-Key`

- 形：印字可能な ASCII 文字 1〜128 文字（`^[\x21-\x7e]{1,128}$`）。マニフェストで**書き**に分類された操作にだけ有効です。
- サーバーはこれをそのファミリーのドメイン内冪等キーに写します（`sdk2-ext-v1` などのファミリーは `request.requestId`、ターミナル 3 ファミリーは `requestId`。`agent-session-v1` には本文側の位置がなく、ヘッダーだけを認識します）。本文に同名キーがすでにあってヘッダーと等しくなければ 409 `conflict`（`detail.reason: idempotency_key_mismatch`）です。
- **同じキー、同じ意味**（同じユーザー、同じ操作、同じマニフェストリビジョン、同じリクエスト指紋）なら、初回実行の元の受領結果を返し、副作用はちょうど 1 回です。**同じキー、異なる意味**なら 409 `conflict`（`detail.domainCode: request_id_conflict`、`detail.reason: idempotency_key_reused`）。同じキーのリクエストがまだ処理中なら、初回の結果を待ってから同じ受領結果を返します。
- 受領結果のキャッシュには上限があります。ユーザーあたり 256 件、全体で 4096 件、保持 10 分。元の受領結果がすでに追い出されていれば 503 `result_unknown`（`retryAction: query-status`、`detail.reason: receipt_not_retained`）、処理中ウィンドウが満杯なら 503 `result_unknown`（`detail.reason: receipt_window_full`、`retry-after` 付き）。どちらも**再送できません**。ドメインの照会操作（`archive.operation.query`、`cache.operation.query`、`terminal.memory.receipt` など）で結果を確かめるだけです。

### `If-Match` と `ETag`

- 強いバリデーター `"<10 進の revision>"` だけを受け付けます。弱いバリデーター（`W/`）、ワイルドカード、数値でないものはすべて 400 です。
- マニフェストに `expectedRevision` が登録された 9 つの書き操作にだけ有効です。`archive.binding.create`、`archive.binding.close`、`archive.ack.commit`、`cache.binding.renew`、`cache.binding.rebind`、`cache.binding.rotate`、`cache.binding.close`、`terminal.configuration.commit`、`terminal.memory.command`。ほかの操作に付けると 400 `if_match_not_applicable` です。
- サーバーはこれを本文の `expectedRevision` に写します（なければ埋め、あって等しくなければ 412 `precondition_failed`、`detail.reason: if_match_body_mismatch`）。リソースのバージョンがすでに進んでいれば 412 `precondition_failed`、`retryAction: refresh`、`detail.domainCode` は元のファミリーコード（`revision_conflict` / `stale_revision` / `binding_conflict`）、`detail.reason: if_match_stale` で、**何も書き込まれていません**。
- バージョンを持つリソースの 2xx レスポンスは `ETag: "<revision>"` を持ち、15 の操作が返します（アーカイブバインディングと状態、キャッシュバインディング、ターミナル設定とメモリの読み書き）。正しい使い方は、読む、`ETag` を取る、それを `If-Match` にして書く、です。412 を受け取ったら読み直してください。revision を 1 増やして当てにいってはいけません。

### `deadline`

- 形：RFC 3339 の日時（`2026-10-05T08:00:00Z` またはオフセット付き）で、絶対的な期限を表します。
- サーバーに届いた時点で期限切れなら 408 `invalid_request`（`detail.reason: deadline_exceeded`）で、受理されず、下流にも触れません。期限内ならサーバーはそのままドメインハンドラーに委譲し、下流の計時を肩代わりしません。
- 再試行は期限を**延ばしません**。公式クライアントは期限切れのリクエストを送信前にローカルで拒否し、`retrySameRequest` は待機後に期限を越えるならそのまま諦めます。

### 3 ヘッダー共通の本文上限

`Idempotency-Key` または `If-Match` を付けたリクエストでは、サーバーが指紋計算と本文への写し込みのためにリクエスト本文を全部読む必要があり、上限は 1 MiB です。超えると 413 `payload_too_large`（`detail.reason: header_body_limit`、`detail.limitBytes: 1048576`）です。大容量のアップロード操作（`material.upload.chunk` など）にはこの 2 つのヘッダーを付けないでください。

## レスポンスヘッダー

| ヘッダー | いつ現れるか | 内容 |
|---|---|---|
| `tansr-contract` | すべての `/api` レスポンス（2xx と SSE のオープンを含む） | 常に `unified-v1`。欠落は「契約が利用できない」ことを意味します。接続先が `/api` でないか、経由したゲートウェイがヘッダーを落としたかです。報告してください。フォールバックしてはいけません |
| `tansr-manifest-revision` | すべてのレスポンス | サーバーのマニフェストリビジョン（現在 `7`） |
| `tansr-domain` | すべてのレスポンス | 受理したドメイン（9 つのドメイン語のいずれか） |
| `tansr-schema-hash` | すべてのレスポンス | `sha256:<64 hex>`。ディスカバリーエンドポイントはマニフェストの集約値、ほかのドメインはそのファミリーのソースファイルのダイジェスト |
| `tansr-closure-id` | セッション単位の能力クロージャのレスポンス。412 / 403 / 404 のクロージャ拒否 | 現在の `closureId` |
| `tansr-event-envelope` | 交渉済みのイベントストリーム | `unified-v1` を返す。交渉成立の唯一のシグナル |
| `ETag` | バージョンを持つリソースの 15 操作の 2xx | 強いバリデーター `"<revision>"` |
| `x-request-id` | すべてのレスポンス | トレース識別子 |
| `retry-after` | 429 / 503 | 秒。公式クライアントはこれに従って待ち、ローカルの予算と `deadline` を超えない |
| `www-authenticate` | 401 | `Bearer` |
| `allow` | 405 | 許可されるメソッド |

同名の重複、不正な形、語彙外の `tansr-*` ヘッダーは、公式クライアントではすべて契約が利用できないものとして扱われます。

## 統一エラーエンベロープ

`/api` 上のステータス 400 以上の JSON エラー本文はすべて同じ形です。

```json
{
  "contract": "unified-v1",
  "traceId": "4f1c0f0e2b7a4d1c",
  "requestId": null,
  "code": "capability_unavailable",
  "status": 403,
  "retryAction": "none",
  "message": "session.audio.speak is disabled for this session",
  "detail": {
    "reason": "outside_closure",
    "operation": "session.audio.speak",
    "state": "disabled",
    "closureId": "9f3c…e1"
  }
}
```

- `code`、`status`、`retryAction` が**公開された判断面**です。`code` で分岐し、`retryAction` で次の一手を決めてください。HTTP ステータスコードや `message` から推測してはいけません。
- `traceId` はレスポンスヘッダー `x-request-id` と等しく、`requestId` はクライアントの冪等キー（`Idempotency-Key` または本文の `requestId`）で、ないときは `null` です。
- `message` は人が読む文で、字面は保証されません。内部パスはリクエストされた `/api` パスに書き換えられ、旧プレフィックスは漏れません。
- `detail` は任意の構造化フィールドです。ドメインエラーがファサードで正規化されるとき、元のファミリーの事実が保持されます。`detail.domainCode`（元のファミリーコード）、`detail.domainStatus`（元の HTTP ステータス）、`detail.domainRetryAction`（元のファミリーの動作）。キャッシュドメインの `fallback` など元の `detail` キーはそのまま残ります。
- 唯一の例外は `archive-sync-v1` ファミリー（`archive.sync`）です。統一コード表がなく、エラー本文は元のエンベロープのまま通過します。

### 19 の統一コード

| `code` | 既定ステータス | 既定の `retryAction` | 意味 |
|---|---|---|---|
| `invalid_request` | 400（元が 422 なら維持） | `none` | リクエストの形が不正：余分なクエリキー、`protocol` の欠落、ヘッダーの形の不正、期限切れの `deadline`（408）など |
| `protocol_mismatch` | 400 | `none` | クエリ文字列のリビジョン識別子がその操作に登録された値でない |
| `not_canonical` | 400 | `none` | 厳密な canonical 入口が canonical でない本文を拒否した |
| `unauthorized` | 401 | `none` | 未認証 |
| `forbidden` | 403 | `none` | 所有関係の不一致（他人のセッション / バインディングへのアクセスを含む） |
| `not_found` | 404 | `none` | リソースが存在しない、または `/api` の下にそのパスがない |
| `capability_unavailable` | 404（クロージャが `disabled` なら 403） | `none` | ドメインが組み込まれていない、能力がない、クロージャ外 |
| `method_not_allowed` | 405 | `none` | メソッドが許可されていない（`allow` 付き） |
| `conflict` | 409 | `none` | 冪等キーの再利用、状態機械の衝突、デプロイ / 所有条件の不成立（復旧が利用できないなど） |
| `stale_generation` | 409 | `rebind` | バインディング / 接続の世代が期限切れ。再バインドが必要 |
| `gap` | 409 | `none` | シーケンスの欠落 |
| `gone` | 410 | `none` | セッションが終了した、バインディングが閉じられた |
| `precondition_failed` | 412 | `rediscover`（クロージャが古い）/ `refresh`（リソースバージョンが古い） | 事前条件が成り立たない |
| `payload_too_large` | 413 | `none` | 本文上限を超えた |
| `rejected` | 422 | `none` | セマンティック検証に通らなかった |
| `capacity_exceeded` | 429（元が 503 なら維持） | `same-request` | レート制限、ドレイン中、過負荷、認証ソースが利用できない。`retry-after` 付き |
| `internal_error` | 500 | `none` | サーバー内部エラー、またはマトリクスに登録されていないドメインコード（元のステータスは `detail.domainStatus` にのみ残る） |
| `upstream_unavailable` | 503 | `same-request` | 上流 / 能力ソースが一時的に利用できない |
| `result_unknown` | 503 | `query-status` | 副作用の結果が不明：照会だけ、再送はしない。`retryAction` は `query-status` か `rebind` のどちらかにしかならず、ファミリーの動作マッピングで再送の提案に変わることはない |

ステータス書き換えのルール：各統一コードには既定ステータスが 1 つあります。元のファミリーのステータスが RFC の許す代替列（400/422、409/412、409/410、404/403、429/503）に入っていれば元のステータスを維持し、そうでなければ既定値を取ります。したがって `session_ended`（旧プレフィックスでは 409）は `/api` では 410 `gone` として出て、`binding_closed` も同じく 410、`unsupported_capability`（旧プレフィックスでは 422 または 409）は 404 `capability_unavailable`、`commit_unknown` は 503 `result_unknown` として出ます。元のステータスは常に `detail.domainStatus` にあります。マトリクスに登録されていないドメインコードはこのルールの対象外です。`@tansr/serve` 0.15.1 以降は一律に 500 `internal_error` となり（0.15.0 以前は元のステータスを維持）、元のステータスは同じく `detail.domainStatus` にのみ残ります。

ファサード自身が直接答えるコードは 8 つだけです。`unauthorized`、`not_found`、`method_not_allowed`、`invalid_request`、`capability_unavailable`、`capacity_exceeded`、`precondition_failed`、`upstream_unavailable`。残りはドメインエラーの正規化から来ます。

### 6 種の `retryAction`

| `retryAction` | すべきこと |
|---|---|
| `none` | 同じリクエストを再試行しない。リクエストを直すか、ユーザーに伝える |
| `same-request` | `retry-after`（またはバックオフ）を待ってから、**同じリクエスト、同じ `Idempotency-Key`** で 1 回再送する |
| `query-status` | 再送しない。ドメインの照会操作で結果を確かめてから決める |
| `rebind` | バインディング / 接続を作り直し（新しい世代）、それから行う |
| `refresh` | リソースを読み直して新しい `ETag` / revision を取り、再送信する |
| `rediscover` | もう一度 `GET /api/sessions/:id/capabilities`（または全体を再発見）し、新しいクロージャで再試行する |

`@tansr/api-client/api` の `retryAdvice(error)` はこの表を `{ action, stated, replayable, retryAfterMs, closureId, … }` にエンコードします。`retrySameRequest()` は `replayable` が真（サーバーが `same-request` を明示）で、かつ同じキーを使い続ける場合にだけ 1 回再送し、`result_unknown` と `commit_unknown` は決して再送しません。

## `/v2` のエラー形との違い

旧プレフィックスのエラー本文は `{ "error": { "code", "message", "detail"? } }` で、コードは各ファミリー自身の語彙でした。`/api` では 8 キーの統一エンベロープになり、ファミリーコードは `detail.domainCode` に下がります。これまで `error.code === 'session_ended'` で分岐していたコードは、`/api` に移したら `code === 'gone'` で分岐するように改め、細かく分けたいときにだけ `detail.domainCode` を見てください。対応表は[移行と廃止のタイムテーブル](/ja/unified-api/migration/)を参照してください。
