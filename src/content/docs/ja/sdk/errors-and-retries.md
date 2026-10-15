---
title: エラー処理と再試行
description: SDK のエラーは 3 か所に現れます——アセンブリ時の TansrSdkError、実行時のイベントストリームの turn.error / tool.failed、そしてプラットフォームゲートウェイのエラーコード。このページでは「どの種類か、再試行できるか、どれだけ待つべきか」を項目ごとに整理します。
zone: docs
category: sdk
related:
  - errors/codes
  - sdk/sessions-and-events
  - sdk/checkpoints
  - support/troubleshooting
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

SDK は決して `process.exit` しません。エラーは 3 つの出口からしか出てきません。アセンブリ時 / オプション時には `TansrSdkError` として throw され、実行時のモデルとツールのエラーは常にイベントストリームで表現され（`turn.error` / `tool.failed` / `turn.aborted`）、プラットフォームゲートウェイのエラーコードはこの 2 つのペイロードの中に含まれます。まずどの種類かを見極めてから、再試行するかどうかを決めてください。

## 第 1 種：TansrSdkError（アセンブリ時 / オプション時）

これらはすべて同期的に、または最初の `next()` / `await createSession()` の時点で throw されるプログラミングエラーか環境エラーで、**再試行しても無益**です。メッセージを読んでコードか環境を直してください：

| code | 時点 | 意味と対処 |
|---|---|---|
| `invalid_options` | 同期 | オプションの組み合わせが不正（3 方式のフィールドの混用 / 語彙外のツール名 / トークン方式でのローカル設定 / 明示的な `adjudication` と `permission.mode` の同居）。メッセージを読んでコードを直す |
| `assembly_failed` | アセンブリ時 | マネージド / トークン方式のアセンブリ失敗（設定が利用不可 / エイリアス解決の失敗 / バンドル取得の失敗）。`cause` に下層のエラーをそのまま保持 |
| `capability_disabled` | アセンブリ時 | 機能フラグがオフなのに明示的に選択された。メッセージにコンソールでの修復手順を含む |
| `session_closed` | 実行時 | `close()` 後に状態を変えるメソッドを呼んだ |
| `session_not_found` | アセンブリ時 | `resume` の対象が store にない——`list()` で確認するか新規作成する |
| `session_store_corrupted` | アセンブリ時 / 保存時 | セッションストレージの破損——決して黙り込まない。セッションディレクトリを削除してやり直す |
| `checkpoints_not_wired` | 実行時 | スナップショットストレージが未接続なのに `checkpoint()` / `listCheckpoints()` / `deleteCheckpoint()` または明示的な `compact({ checkpoint: true })` を呼んだ |
| `checkpoint_store_corrupted` | 実行時 | スナップショットファイルの破損。`deleteCheckpoint()` でその id を削除して続行する |
| `turn_running` | 実行時 | 実行中にアイドル期専用のメソッドを呼んだ。`await session.idle()` の後に再試行する——「少し待ってからやり直す」唯一の SDK エラー |
| `checkpoint_not_found` | 実行時 | `fork()` / `exportCheckpoint()` が指名したスナップショットが存在しない |
| `checkpoint_import_invalid` | 実行時 | インポートしたバイト列が正当なエクスポート体ではない。改ざんは即拒否、ディスクへの書き込みはゼロ |
| `session_store_not_wired` | 実行時 | `fork()` にはセッションの `store` が必要なのに渡されていない |
| `platform_request_failed` | 実行時 | トークン方式で直接呼ぶ `session.platform.transcribe()` / `speak()` の失敗（`PlatformRequestError`）。`status` / `platformCode` / `platformMessage` がゲートウェイの事実を伴い、`status 0` = プラットフォームに到達していない。0.19.0 以降は `createPlatformNonchatClient` の非チャット操作の失敗もこのコードを使うが、throw されるのは `PlatformNonchatError`（`status` / `platformCode` / `outcomeUnknown` / `taskId?`）：`outcomeUnknown: true` は投入結果が不明であることを示す——元の冪等キーと `taskId` を保持し、`getTask()` で元のタスクを照会すること。キーを変えて再投入しない |
| `lifecycle_failed` | 終了処理時 | `SdkLifecycleError`：`query()` の終了時の精算が失敗した（セッションレベルの `drain()` / `closeAsync()` は throw せず、`status: 'failed'` の結果で表す）。`failures` が段階とコードを項目ごとに列挙し、`cleanup` があれば再度呼んで回収を続けられ、`result` があればそれは完了済みの `QueryResult`（[ライフサイクルとリソースの終了](/ja/sdk/lifecycle/)を参照） |

```ts
import { TansrSdkError, createSession } from '@tansr/sdk';

try {
  session = await createSession({ token, baseUrl, store, resume: { sessionId, store } });
} catch (e) {
  if (e instanceof TansrSdkError && e.code === 'session_not_found') {
    session = await createSession({ token, baseUrl, store }); // 确实不在 store 才新建
  } else {
    throw e; // session_store_corrupted 等恒上抛,不静默开空会话
  }
}
```

## 第 2 種：イベントストリームの中のエラー

| イベント | 意味 | あなたがすべきこと |
|---|---|---|
| `turn.error { scope, message, recoverable, errorKind?, detail? }` | 1 ターン内のエラー | `recoverable` を見る：`true` は助言（永続化の失敗、圧縮の失敗、プラットフォームの通知）で `SessionView.notices` に入り、セッションは続く。`false` はこのターンの失敗で `lastError` に入る |
| `turn.aborted { reason }` | ターンが中止された | `reason` は終端の語：ユーザーの `interrupt()` なら `aborted_*`。`max_turns` / `budget_exceeded` は上限到達。`client_gone` はセッションサービス形態でだけ現れる |
| `tool.failed { errorType }` | ツール実行の失敗 | `timeout` / `unknown_tool` など。モデルは構造化された失敗結果を見て自ら進路を変えるので、通常はあなたの介入は不要 |
| `tool.completed { isError: true }` | ツールは完了したが結果がエラー | 4 つのメディアツールのプロバイダー側の失敗とタイムアウトはこの形。`data.errorCode` がプラットフォームコードを伴う |
| `tool.permission.decided { allow: false, decisionSource }` | 権限の拒否 | `policy` = `askUser` を接続していないフェイルクローズの拒否。`permission.askUser` を接続するかルールを調整する |

`turn.error.detail` は任意の構造化フィールドです。**SDK 0.13.0 で提供済み**：プラットフォームのプランに関する 4 つのコードは `detail: { scope: 'plan' }` を伴い、セッションサービスの HTTP 面の `error.detail.scope` と同じキー・同じ値なので、端末側で「ローカルのレート制限」と「プランのクォータ」を区別できます。

## 第 3 種：プラットフォームゲートウェイのエラーコード

トークン方式では、プラットフォームのエラーコードは `turn.error` のメッセージ先頭、`tool.completed.data.errorCode`、`PlatformRequestError.platformCode` / `PlatformNonchatError.platformCode`、そしてあなたのサーバーサイドでトークンを発行し直すレスポンスに現れます。全コードの正式な表は[エラーコード表](/errors/codes)にあり、ここでは最もよく遭遇する十数個と対処だけを扱います：

### 再試行すべき、`Retry-After` に従って待つ

| コード | HTTP | 対処 |
|---|---|---|
| [`rate_limited`](/errors/codes#rate_limited) | 429 | プラットフォームのレート制限。常に `Retry-After`（整数秒）を伴う。その値だけ待ってから再試行し、より密に再送しない |
| [`upstream_error`](/errors/codes#upstream_error) / [`upstream_disconnected`](/errors/codes#upstream_disconnected) | 502 | 上流モデル側の障害。指数バックオフ + ジッターの後に再試行 |
| [`upstream_timeout`](/errors/codes#upstream_timeout) および `upstream_connect_timeout` / `upstream_ttfb_timeout` / `upstream_idle_timeout` / `upstream_total_timeout` | 504 | 上流のタイムアウト。同上のバックオフ |
| [`plan_gate_unavailable`](/errors/codes#plan_gate_unavailable) | 503 | プラットフォームのゲートの依存先が一時的に利用不可、`Retry-After: 5`。既存のセッションには影響しない |

### プラン使用量系の 429：自動再試行ゼロ

| コード | HTTP | 対処 |
|---|---|---|
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | プランの同時実行ハードキャップ、`Retry-After: 30`。**新しいセッションだけを拒否し、実行中のセッションは決して切れない。** SDK は再試行ゼロ——そのまま再送しても窓の中では必ずまた拒否され、複数セッションのホストが自動再試行するとサンダリングハードになるだけ。ユーザーに 30 秒後に手動で再送してもらうこと。あなたの監視には `detail.upgradeUrl` を表示する。これは開発者にとってのアップグレードのシグナル |
| [`plan_end_users_exceeded`](/errors/codes#plan_end_users_exceeded) | 429 | テスト期間の月間エンドユーザー数が上限に達した。トークン発行径のみ |
| [`quota_exceeded`](/errors/codes#quota_exceeded) と各面の `*_quota_exceeded` | 429 | 日次クォータの上限到達。クォータ窓の更新を待ち、再試行しない |

### 再試行すべきでない、設定かコードを直す

| コード | HTTP | 対処 |
|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) / [`token_expired`](/errors/codes#token_expired) | 401 | セッショントークンの期限切れか失効。**トークンを無効にする唯一のコード**——あなたのサーバーサイドに戻って発行し直す。端末側 SDK はログイン状態からトークンを最大 2 回取り直し、それでも 401 なら終端状態に入り、ホストが明示的に再接続する |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | アプリのウォレット残高不足。チャージすれば自然に直り、再試行は無益 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | モデルの参照名がアプリの認可面にない。コンソールで認可を開く |
| [`forbidden`](/errors/codes#forbidden) | 403 | リング 3 の機能フラグがオフ（ゲートウェイの強制面）。`detail` にフラグを開く手順を伴う |
| [`plan_required`](/errors/codes#plan_required) / [`plan_tier_insufficient`](/errors/codes#plan_tier_insufficient) | 403 | アプリの所属アカウントに有効なプランがないか、ティアにその機能が含まれない——開発者のアセンブリエラーで、エンドユーザーに届くべきではない。`detail.upgradeUrl` はコンソールのプランページを指す |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | サイズ上限の超過（たとえば音声認識の生音声 > 24 MiB、`detail.maxRawBytes`）。分割か圧縮を行う。再試行不可 |
| [`validation_failed`](/errors/codes#validation_failed) / [`bad_request`](/errors/codes#bad_request) | 400 | ペイロードの形が不正。メッセージを読んでリクエストを直す |
| [`session_archived`](/errors/codes#session_archived) | 410 | プラットフォームのセッションがアーカイブ済み（30 日の非アクティブリースの満了後）。このセッションはもう続けられず、`resume` は失敗するので、新しいセッションを作る |
| [`context_window_exceeded`](/errors/codes#context_window_exceeded) | 400 | リクエストがモデルのコンテキストウィンドウを超えた。まず `compact()` するか、より大きなウィンドウのモデルに切り替える |

## カーネルがすでに代わりに行っている再試行

モデルリクエスト層の一時的な失敗は**あなたが再試行する必要はありません**。フォールバックチェーンの各エントリには再試行が組み込まれており（バックオフ 500 ms → 30 s、合計 3 回の試行、`Retry-After` を優先的に尊重）、使い切ると次のエントリに切り替えて `cost.provider.switched`（from / to / reason / attempts / failures）を発行します。コンテキストが本当に溢れた場合（上流の 413）、カーネルは強制的に一度圧縮してから再試行します。あなたの再試行ロジックがカバーすべきなのは、上の 2 つの「再試行すべき」表にあるセッションレベルの失敗だけです。

## セッションサービス形態ではどう見えるか

`@tansr/serve` を使う場合、同じ一連のプラットフォームコードはサーバーサイドでマッピングされてからモバイル端末に届きます。プランの同時実行キャップは `429 rate_limited` + `Retry-After` + `detail: { scope: 'plan' }` にマッピングされ、`plan_required` / `plan_tier_insufficient` は 403 のまま元のコードで透過し `detail.scope: 'plan'` を伴い、上流のレート制限 / 5xx / ネットワークエラーは `503 upstream_unavailable` にマッピングされます。端末側のバックオフ規律は変わりません。429 / 503 が `Retry-After` を伴うときは整数秒の値だけ待ち、5xx に `Retry-After` がなければ指数バックオフ + ジッターです。詳細は [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/) を参照してください。

ここで述べたのは `/v2` 直接接続面のエラーボディ `{ error: { code, message, detail? } }` のことで、そのバイト列は `@tansr/serve` 0.13.0 … 0.15.1 で変わっていません。0.15.0 以降、旧プレフィックスのレスポンスには `Deprecation` / `Link` の 2 つのレスポンスヘッダーが加わるだけで（`@tansr/api-client` 0.3.x / 0.4.0 はいずれも無視します）、ボディとステータスコードは変わりません。

## `/api` 経由時の統一エラーエンベロープ

`@tansr/serve` 0.13.0 以降（2026-10-02 公開）、新しい統合は統一呼び出し面 `/api` を通り、400 以上のすべての JSON エラーはファミリーごとに異なる形ではなく、同じ統一エンベロープになります：

```json
{ "contract": "unified-v1", "traceId": "<x-request-id>", "requestId": "<客户端幂等键或 null>", "code": "capacity_exceeded", "status": 429, "retryAction": "same-request", "message": "...", "detail": { "domainCode": "rate_limited", "domainStatus": 429 } }
```

- `code` は **19 個の統一コード**のいずれかです（`invalid_request` / `protocol_mismatch` / `unauthorized` / `forbidden` / `not_found` / `method_not_allowed` / `gone` / `conflict` / `stale_generation` / `gap` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `result_unknown` / `rejected` / `internal_error`、それにファサード固有の `precondition_failed` と `not_canonical`）。元のファミリーコード（このページの上で述べた `rate_limited`、`session_ended`、`session_not_found` など）は `detail.domainCode` にだけ残り、元のワイヤー上のステータスは `detail.domainStatus` にあります。1 つの `switch (code)` で全ドメインをカバーし、ファミリーレベルの細分化が必要なときだけ `domainCode` を読んでください。
- `retryAction` は **6 つの動作**のいずれかで、あなたの次の一手を決めます。`none` は再試行不可。`same-request` は同じキー・同じリクエストの再送（`Retry-After` / `detail.retryAfterMs` を伴うときはまず待つ）。`query-status` はまず受領証 / 状態を照会。`rebind` はバインディングの再構築。`refresh` はリビジョンを読み直してから再試行。`rediscover` は機能の再発見の後に再試行。**`result_unknown` / `commit_unknown` では `query-status` か `rebind` だけが許され、キーを変えての再送は禁止です**——それは重複した副作用を認めることと同じです。
- 0.14.0 以降、3 つのリクエストヘッダー `Idempotency-Key` / `If-Match`+`ETag` / `deadline` の拒否も同じエンベロープを通り、新しいエラーコードは増えず、細かな理由は `detail.reason`（`idempotency_key_reused`、`if_match_stale`、`deadline_exceeded` など）にあります。`412 precondition_failed` はこれ以降、フェンスの陳腐化（`rediscover`）かリソースバージョンの陳腐化（`refresh`）のどちらもあり得るので、`detail.domainCode` で区別してください。
- レスポンスに `tansr-contract` ヘッダーがない、または `/api` が JSON 以外 / プロキシのページを返した場合は、一律に「契約が利用不可」として報告し、それを根拠に旧バージョンのサービスだと推測して `/v2` に戻っては**いけません**。

`@tansr/api-client` 0.3.0 以降（2026-10-04 正式版。現行は 0.4.0、2026-10-06、`./api` サブエントリとルートエントリは変化ゼロ）の `./api` サブエントリはこのデコードを `ApiError`（`code` / `retryAction` / `domainCode` / `domainStatus` / `closureId` の読み方）と `retryAdvice` / `retrySameRequest` ユーティリティとして提供し、`result_unknown` は常に `query-status` に降格されます。統一コードの全表、`retryAction` の由来のマッピング、各ファミリーの `domainCode` の対照表は[統一 API のリクエストヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を参照してください。
