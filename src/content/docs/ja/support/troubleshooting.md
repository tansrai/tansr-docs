---
title: 'トラブルシューティングガイド'
description: 'tansr doctor の各セクションの読み方、何がブロッキングで何が帰属情報にすぎないか。最もよく見る 10 個のエラーコードの意味と対処（エラーコード表へのディープリンク付き）。そして CLI、SDK、セッションサービス、モバイルそれぞれのトラブルシューティングの第一歩。'
zone: support
category: support
related:
  - support
  - errors/codes
  - cli/settings-and-doctor
  - sdk/errors-and-retries
  - support/contact
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-10'
---

トラブルシューティングの順序：まず `tansr doctor`（CLI）またはエラーコード（他の形態）を見て、次に下の表で対処を探します。十中八九、人に連絡する必要はありません。

## 第一歩：`tansr doctor`

```bash
tansr doctor          # 人读报告
tansr doctor --json   # 机器可读
```

モデル呼び出しゼロ、ネットワークゼロ、子プロセスゼロ。**終了コード 0 = 利用可能、1 = ブロッキングの問題あり**。TUI 内の `/doctor` も同じものです。表示されるのは最後にアセンブリを取得したときの事実です——コンソールで設定を変えたら、CLI を一度実行すれば更新されます。

### セクション対照表

| セクション | 正常なときの見え方 | 異常時の対処 | ブロッキング？|
|---|---|---|---|
| `node_version` | ≥ 22.19 | Node をアップグレードするか、単一ファイル実行版（ランタイム同梱）に切り替える | はい |
| `config_sources` | 5 層それぞれ loaded / absent で、skipped なし | skipped = その層の JSONC に構文エラーがあるか、ルートノードがオブジェクトでない。ファイルを直すか削除する | はい |
| `config_diagnostics` | 0 件または info レベル | 1 件ごとに層 / キーパス / 期待される型を示す。不正な値は除外され、より低い層にフォールバック済み | error レベルはブロッキング |
| `model_resolution` | エイリアス → provider / モデル | 「不明なモデルエイリアスまたは ref」なら `modelAliases` と `providers.models` を照合。「API キーがありません：環境変数 X が未設定」ならその変数をエクスポート | はい |
| `context_window` / `context_scheme` | ウィンドウの 2 つの値とクランプ側。スキームは `production` | ウィンドウ不明 → モデルに `maxContext` を宣言する。production 以外のスキームは警告にすぎない | いいえ |
| `custom_commands` / `mcp_connections` | skipped なし。遅延接続の未接続も健全と見なす | MCP の失敗はエラーコードを見る。`/mcp reconnect` | いいえ |
| `terminal` / `workspace_trust` / `output_style` | TTY とサイズ。信頼済み。スタイルが存在 | 未信頼 = 読み取り専用サンドボックス、`/trust grant`。スタイル名が存在しない場合は正直にエラーを報告 | いいえ |
| `localProviders`（帰属） | プラットフォームモード：ローカル providers の枝刈りは想定どおり。エスケープハッチ：バナーが出る | 「provider が未設定」はまずここを見て、未設定なのか枝刈りされたのかを見分ける | いいえ |
| 認証情報ストレージ（帰属） | キーチェーン | 平文ファイルにフォールバックしているときはディレクトリの権限を確認。`tansr init` を再実行 | いいえ |
| モデル選択の帰属 | `model.selected` の値と提供層。抑制状態 | プロジェクト層が `modelAliases.main` を固定しているとき、ユーザー層の粘着的な選択は抑制される。想定どおり | いいえ |
| プラン | 「個人（CLI のみ、プラン料金なし）」または「ティア名 · 期限 · 状態」 | 個人ティアは故障ではない。猶予 / フォールバック状態はコンソールで更新する | いいえ |
| メディアツール | 4 面それぞれ `byo` / `platform` / `none` | すべて `none` なら有効化の案内が付く：自前エンドポイントの 3 つの変数、または管理者にメディアプールの開放を依頼 | いいえ |
| 無人運転ベースライン | `auto` で分離の兆候あり | 兆候がなければ目立つ通知。分離済みを確認したら `TANSR_ISOLATED=1` で抑制 | いいえ |
| セッションストレージ / memory | セッション数、バイト数、成果物ディレクトリ、壊れたディレクトリ | 読み取りのみで代わりに削除はしない。クリーンアップは `tansr sessions prune` | いいえ |

### CLI でよく見るメッセージ

| 症状 | 対処 |
|---|---|
| 「TUI には対話式ターミナル（TTY）が必要です」 | パイプの中で `tansr` を起動している。非対話の場面では `-p` を使う |
| 「API token がありません：--token <値> を渡すか TANSR_SERVE_TOKEN を設定してください」 | `tansr serve` は fail-closed で、認証なしのサービスは起動しない |
| 「サーバーの起動に失敗しました」/「--port の値が無効です」 | ポートが使用中か不正 |
| 「セッションが存在しません」/「セッションを再開できません」 | `--resume` の id が間違っているか、ディレクトリが使用中。引数なしの `tansr --resume` でセレクターを開いて確認する |
| 終了コード 5 で `tansr init` を促される | 無人運転の形態で未初期化。まずログインするか、`TANSR_ESCAPE_LOCAL=1` を設定してローカルモードにする |
| 終了コード 3 | 上限到達：`--max-turns` / 予算 / ツールのターン数。上げるか、タスクを分割する |
| 終了コード 4 | prompt が長すぎ、圧縮も使えない。より大きなウィンドウのモデルに替える |
| 「同時実行数がプランの上限に達しました」のバナー | 新しいセッションだけを拒否。30 秒後に再送するか、プランをアップグレードする |

## 最もよく見る 10 個のエラーコード

すべてのコードの正式な表は[エラーコード表](/errors/codes)にあります。ここでは最もよく当たる 10 個と最初の対処だけを挙げます。

| コード | HTTP | どこで見るか | 最初の対処 |
|---|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) | 401 | トークンの期限切れまたは失効。セッションサービスの `authenticate` が null を返した | CLI：`tansr init` で再ログイン。SDK：あなたのサーバーに戻ってトークンを再発行。モバイル：ログイン状態を直してから明示的に再接続。**トークンが壊れたことを示す唯一のコード** |
| [`token_expired`](/errors/codes#token_expired) | 401 | ログイン状態の token の期限切れ | 再ログイン / 更新 |
| [`invalid_api_key`](/errors/codes#invalid_api_key) | 401 | PAT が無効 | コンソールで PAT を再作成し、`tansr init --fresh` |
| [`rate_limited`](/errors/codes#rate_limited) | 429 | プラットフォームのレート制限、またはセッションサービスホストのレート制限 / プランのクォータ（`detail.scope: 'plan'`） | `Retry-After` の秒数だけ待ってから再試行する。より高い頻度で再送しない |
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | プランの同時実行数のハードキャップ | 新しいセッションだけを拒否。30 秒後に手動で再送。ティアのアップグレードを検討 |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | 残高不足 | チャージする。再試行は無意味 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | モデルがアプリの認可範囲にない | コンソールでアプリにそのモデルの認可を与える |
| [`validation_failed`](/errors/codes#validation_failed) | 400 | リクエストペイロードの形が不正 | `message` を読んでリクエストを直す。ネットワークの問題ではない |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | サイズ上限超過（例：音声の生データ > 24 MiB） | 分割または圧縮する。再試行不可 |
| [`session_archived`](/errors/codes#session_archived) | 410 | プラットフォームのセッションがアーカイブ済み（30 日間非アクティブ） | 新しいセッションを作る。これは続けられない |

頻度は高いが意味が明快なものをいくつか補足します：[`upstream_error`](/errors/codes#upstream_error)（502、上流モデルの障害、バックオフして再試行）、[`upstream_timeout`](/errors/codes#upstream_timeout)（504、同上）、[`quota_exceeded`](/errors/codes#quota_exceeded)（429、日次クォータ）、[`forbidden`](/errors/codes#forbidden)（403、機能フラグが無効または所属不一致）、[`context_window_exceeded`](/errors/codes#context_window_exceeded)（400、まず圧縮）。

## 各形態のトラブルシューティングの第一歩

**SDK（Node / Electron）**：アセンブリ段階か実行段階かを見分けます。アセンブリ段階の `TansrSdkError` は `code` を読みます（`invalid_options` はコードを直す。`assembly_failed` は `cause` を見る。`capability_disabled` はコンソールでフラグを有効にする）。実行段階ではイベントストリームの `turn.error.recoverable` を見ます——`true` は助言、`false` が失敗です。イベントストリームが「止まったまま」なのはほぼ `session.close()` の忘れ。「ツールがすべて拒否される」のはほぼ `permission.askUser` の未接続です。詳細は[エラー処理と再試行](/ja/sdk/errors-and-retries/)。

**セッションサービス（`@tansr/serve`）**：まず `GET /readyz`（503 は `reasons` 付き）を見て、次に構造化ログの `request.completed` / `store.commit_failed` / `session.rejected` を見ます。レスポンスヘッダー `x-request-id` で関連付けます。`resume` が常に `409 resume_unavailable` = store を接続していない。`500 store_corrupted` は共有ストレージディレクトリ（安全でない構成）でよく起きます。セッション作成時の `503 upstream_unavailable` はプラットフォーム側のトークン発行が利用不可、`503 overloaded` はこのマシンの受け入れ上限、`503 draining` はグレースフルシャットダウン中です。

**モバイル（Android / iOS）**：まず `connectionState` を見ます。`Retrying` は正常な L1 再接続、`Recovering` は L2 再構築。`AuthExpired → Failed(Unauthorized)` はトークンを 2 回更新してもまだ 401 で、ログイン状態を直してから明示的に `start()` します。接続するとすぐ 401 になるのは、通常 `authProvider` が渡すヘッダーをサーバー側の `authenticate` が認めていないためです。エミュレーターから接続できないのは、通常 Android で `10.0.2.2` ではなく `127.0.0.1` を使っているためです。

## これを持ってサポートに連絡する

- `tansr doctor --json` の出力（キーの値は含まれず、認証情報は指紋の形で表示されます）。
- エラーコードと完全な `message`。セッションサービス側では `x-request-id` も添える。
- 再現手順と時刻。課金に関わる場合は注文番号または請求月。
- 可能なら、`tansr sessions export <id>` のトランスクリプト（キーは自動でマスキング済み）。

入口は[サポートに連絡](/ja/support/contact/)を参照。
