---
title: 'Android 導入ガイド'
description: 'Kotlin SDK のモジュール分割、イベント還元と SessionView、接続ステートマシンと 3 段階の復旧チェーン、フォアグラウンド / バックグラウンドと Doze の方針、エラーの表示、ローカルツールと 2 つのブリッジ、音声の 2 つのチェーン、自前で配線するプッシュ起動、そして認証情報とログの規律。'
zone: docs
category: android
related:
  - sdk/system-prompts
  - getting-started/android
  - ios
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-android:doc/report/ANDROID-MEDIA-03-0.4.0-发布记录.md
  - tansr-android:doc/report/REL-ANDROID-05-0.5.0-发布记录.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

Android SDK（Maven 座標 `com.tansr.sdk:core` / `:client` / `:compose`、任意の `:receiver-android`、パッケージ接頭辞 `com.tansr.sdk`）はセッションサービスの薄いプロトコルクライアントです。エージェントセッションサービスの契約を実装し、すべてのリクエストは統一呼び出し面 `/api` から出ていきます。このページでは、クイックスタートのあとに出会う設計上の論点をすべて扱います。イベントがどう UI 状態になるか、切断からどう復旧するか、フォアグラウンド / バックグラウンドをどう扱うか、エラーをどう表示するか、ツールとダイアログをどうつなぐか、音声とプッシュをどうつなぐか。本ページは公開済みの **0.5.0**（Maven Central、2026-10-07。4 モジュール同一バージョン）に照らして確認し、サーバー側は `@tansr/serve` 0.15.1（npm latest、2026-10-10）に照らしています。

## バージョンとサーバー側プレフィックス（2026-10-13 に確認）

- 0.5.0（2026-10-07 に Maven Central へ掲載、ソース `50306a2c`）以降、SDK のすべての HTTP リクエストは、サーバー側が 0.13.0 以降で提供する統一呼び出し面 `/api` だけを通ります（D10：即時切り替え、`/v2` へのフォールバックは残しません）。パス、メソッド、ヘッダー名は manifest revision 7 から生成された `ApiContract` / `ApiOps`（81 操作）に由来し、セッションファミリーはもうパスでは区別されず、リクエストヘッダー `tansr-session-family: sdk1 | sdk2-offload-v1` で明示的に運ばれます。サーバー側には `/api` ファサードが組み込まれている必要があります（`@tansr/serve` 0.13.0 以降。r7 は 0.14.0 以降）。
- 0.5.0 と同時に公開されたもの：統一エラーコードを主とする公開例外モデル（D19。0.4.0 に対して破壊的変更で、旧来のファミリー別 sealed 型は `@Deprecated` が付いて 1 バージョンだけ残ります）、SDK1 の成功レスポンスとイベントストリームに対する統一レスポンスヘッダーゲート（D10 / D38）、3 つのリクエストヘッダー `Idempotency-Key` / `If-Match` / `deadline` を運ぶ `ApiCallOptions`。本ページはこれらの挙動に沿って記述します。
- それより古い 0.1.0 – 0.4.0 は引き続き `/v2` に直結します。サーバー側の `/v2` は 0.13.0 以降は内部アダプターの入口にすぎず、1.0.0 で外部入口が削除されます。これらのバージョンに残っているアプリは 0.5.0 へアップグレードしてください。スケジュールは[デプロイと認証](/ja/serve/deploy-and-auth/)を参照。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`CreateSessionRequest(prompt=...)` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。Android / iOS は `/api` のセッションリクエスト経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持でき、更新を受け取るためにセッションを作り直す必要はありません。業務セグメントの競合はアプリ管理者が解消してください。権限は引き続き独立した仕組みで扱われます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## モジュール分割

| モジュール | 種別 | 内容 |
|---|---|---|
| `:core` | 純粋な Kotlin/JVM、Android 依存ゼロ | 契約定数と生成された `/api` 契約（`ApiContract` / `ApiOps` の 81 操作、`UnifiedCode` の 19 統一コード、`UnifiedRetryAction`）、`ApiCallOptions`、`KernelEvent` の sealed class 群（47 型 + `Unknown` の許容）、IR メッセージモデル、SSE の解析 / 振り分け、`SessionView` reducer と `viewStateFromHistory`、ツールカード成果物の解析 `toolCardArtifact` と検索 / ネットワーク結果の投影 `SearchResultDetails` / `NetworkResultDetails`、プロトコルクライアントのロジックとトランスポート抽象、音声直結面 `AudioClient`、再接続ステートマシン、`defineTool` とリモートツールブリッジ、権限 / 質問ブリッジ `SessionBridges`、`BridgeDialogState`。SDK 2.0 の薄いクライアント `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSyncClient` とターミナルサービスクライアント `TerminalClient` |
| `:client` | 純粋な Kotlin/JVM | OkHttp トランスポート実装、`TansrAgent` エントリーファクトリ |
| `:compose` | Android ライブラリ | Compose バインディングの薄い層：`collect*AsStateWithLifecycle`、`TansrSessionLifecycle`、デフォルトの権限 / 質問ダイアログ、`TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`。すべて差し替え可能で、テーマに縛られず、プレイヤーも権限も持ちません。エラー文言は統一コード + `retryAction` に基づいて表示します |
| `:receiver-android` | Android ライブラリ（任意、0.5.0 で初公開） | SDK 2.0 の端末側永続化層：SQLite アーカイブレシーバー、同期ストア、耐久実行ジャーナル（`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteSyncArchiveStore` / `Sdk2SqliteExecutionJournal`）。3 モジュールの代わりではなく、SDK 2.0 の端末実行を組み込むときだけ追加します |

`:core` / `:client` は意図的に純粋な JVM にしてあり、プロトコル面は端末なしで単体テストできます。公開 API 面は binary-compatibility-validator が守り、変更は常に明示的な diff を通ります。4 つのモジュールは同じバージョン番号を共有し、アップグレードは同時に行います。

## イベント還元：3 つのフロー

```kotlin
session.events          // SharedFlow<KernelEvent>(replay = 0;历史语义归 view 与恢复链)
session.view            // StateFlow<SessionViewState>(reducer 投影,conflated)
session.connectionState // StateFlow<ConnectionState>
```

- `events` は生のカーネルイベントで、サーバー側の SSE 1 フレームにつき 1 件です。未知の型は `Unknown(type, raw)` にデコードされ例外を投げず、壊れた JSON は診断用の件数に数えるだけでストリームを切りません。セッション契約 revision 9（0.5.0 に同梱の vendored 版）は 55 型のイベントを登録し、SDK はそのうち 47 型をデコードします。新しい SDK 専用イベント `session.events_dropped`（contract-v0.27、Node SDK のプロセス内バックプレッシャーのフォールバック）は serve が送出せず、`/v2` ストリームにも現れません。仮に現れても `Unknown` として許容し、端末側に描画義務はありません。
- `view` は**還元済みのビュー状態**です。メッセージ一覧（ユーザー / アシスタント / ツールカード）、TODO、使用量、`lastError`、`notices`。多くの UI はこれを直接購読します。`msg.text.delta` を自分で組み立てないでください。reducer は TS / Swift 実装と同じゴールデンフィクスチャを共有し、3 クライアントの投影セマンティクスは一致します。
- 表示プロファイル `SessionViewOptions(delivery = …)`：テキストと思考はそれぞれ `stream` / `final` を選べます（思考にはさらに `off` があります）。実行中は `setDelivery` でブロック単位に切り替えられます。

ツールカード成果物は `toolCardArtifact(data)` で形状に応じて取り出します。画像 / 動画 / ウェブ検索の URL 成果物、音声の `Transcript(model, text, language?, durationSec?)` / `Speech(model, url?, b64?, mime, format, durationMs?, billedChars)`。`errorCode` が存在するときは常に null になります。`TansrToolCard` はこれらの形をデフォルトで描画し、`messageActions` / `speechAction` の 2 つのスロットに「再生 / 停止」ボタンを掛けられます。

## 接続ステートマシンと 3 段階の復旧チェーン

```text
Idle → Connecting → Live
Live → Retrying(指数退避,尊重服务端 retry 首帧)→ Live          // L1:携 Last-Event-ID 重连,重放按 seq 去重
Live → Recovering(拉 /history 重建)→ Live                        // L2:重连首帧收到 gap
401 → AuthExpired(回调 authProvider 重取)→ 刷够仍 401 → Failed(Unauthorized)
200 流缺统一响应头 → Failed(ContractUnavailable)                   // D38:部署形态错误,不退避不重连
```

| 段階 | トリガー | SDK の動作 |
|---|---|---|
| L1 | 瞬断 / ネットワーク切り替え / フォアグラウンド復帰 | `Last-Event-ID=<最後に消費した seq>` を付けて自動再接続し、受信フレームは seq で重複排除 |
| L2 | 再接続後の最初のフレームが `server.replay.gap` | 現在の投影を捨てる → `GET /api/sessions/:id` → `GET …/history` → `viewStateFromHistory` で再構築 → `lastSeq` から再購読 |
| L3 | メタ情報が 404 または `live = false`、あるいは sessionId しか持たないコールドスタート | `POST /api/sessions { resume }` → `resumed = true, lastSeq = <新エポックの開始水位>` → 旧カーソルを捨てて L2 の手順で再構築（アンカーは `history.lastSeq`。このレスポンスの値は読まない） |

全工程で業務コードはゼロです。コールドスタートで前回の続きから話すには `CreateSessionRequest(resumeSessionId = savedId)` を使います。SDK のデフォルトは **attach-first** です。まず GET でメタ情報を探り、アクティブなら attach（上流コストゼロ）、非アクティブなら resume で再ロードし、ストアに記録がないときだけ新規作成します。終了したセッション（`Closed`）が自動で復活することはありません。

**`lastSeq` は常に値どおりに継続し、休眠の判定は常に `live = false` です**——決して `lastSeq == 0` ではありません。`@tansr/serve` 0.9.0 以降、休眠セッションのメタ情報 `lastSeq` はストアに永続化された真の水位であり、resume 後の新エポックはその水位 + 1 から続きます（0.8.x では両方とも常に `0` でした）。SDK の L3 はもともと旧カーソルを捨てて `history.lastSeq` をアンカーにするので、どちらのバージョンでも端末側の対応は不要です。`live = true` かつ `lastSeq == 0` のときは L2 だけを通り、resume はしません。

**401 の収束ルール**：イベントストリームが 401 → `authProvider` でトークンを再取得して再接続。**1 接続あたり最大 2 回**（1 回目のバックオフ 0 ms、2 回目 1000 ms。`AgentSessionConfig.authRetry` で設定できますが常に有限）。それでも 401 なら `connectionState = Failed(Unauthorized)` + `view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }` となり、ポンプは停止して二度と自動再接続しません。ホストがログイン状態を直してから明示的に `start()` してください。トークンを更新してもなお 401 なら、失効か設定ミスであって揺らぎではありません。

**統一レスポンスヘッダーゲート（D10 / D38）**：すべての 2xx JSON レスポンスと 200 イベントストリームは、本文 / フレームを読む前に 4 つのレスポンスヘッダー `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` を照合します。欠落や不正な形は `TansrAgentException.ContractUnavailable(status, reason)` を投げます（`reason` は `missing_header:tansr-contract` のように違反箇所を示します）。**業務上の成功ではなく、旧プレフィックスへのフォールバックもしません**。2xx 形の契約不可——典型的には `baseUrl` が `/api` ファサードを指していない、プロキシのキャッシュページ、キャプティブポータル——ではポンプが直ちに `Failed` の終端状態に入ります。これはデプロイ形態の誤りであって一時的な障害ではなく、再試行は無意味です。直してから明示的に `start()` してください。400 以上の形（プロキシの 502 / 503 HTML ページなど）は引き続きステータスコードの方針に従ってバックオフします。統一ファサードは常に 4 つのヘッダーを出すので、ヘッダーを補う必要があるのは自作の偽サーバー / テストフィクスチャだけです。

## フォアグラウンド / バックグラウンドと Doze

バックグラウンドの長時間接続は不安定で電池を消耗するため、SDK の方針は**バックグラウンドに回ったらポンプを止めてストリームを切り、フォアグラウンドに戻ったら復旧ウィンドウに応じて経路を自動選択する**ことです。

- ウォーム状態（デフォルトでは 60 秒以内の復帰）：L1 で直接継続。
- しきい値を超え、バックグラウンド中にターンが走っていた：先に L2 の `history` 再構築を行い、gap が確定している購読を避ける。
- アイドルによりセッションが回収された（サーバー側デフォルト：全員離脱から 5 分で回収 / 24 時間アイドル）：404 → L3 で自己修復。

Compose なら 1 行 `TansrSessionLifecycle(session)`（`repeatOnLifecycle(STARTED)` で開始 / 停止）。Compose 以外ではフォアグラウンドで `start()`、バックグラウンドで `stop()`。どちらも冪等で、`stop` はセッションを失いません。しきい値は `AgentSessionConfig.warmResumeWindowMs` で調整します。判断は `:core` の純関数 `LifecyclePolicy` で、JVM 単体テストで網羅しています。Doze の強制アイドル中はポンプがすでに止まっており（サーバー側にアクティブな購読者はいない）、画面点灯とフォアグラウンド復帰で同じ方針により自己修復します。ベンダーによる積極的なバックグラウンド強制終了はコールドスタートの L3 と同等です。

サーバー側の協調：購読者が全員離脱して 60 秒後にサーバーは実行中のターンを interrupt し（ターン終了時の永続化は行われます）、5 分後に close してストアへ落とします。したがって「バックグラウンドから戻ったらターンが中断されていた」のは設計どおりの挙動で、履歴は失われず、resume で続けられます。バックグラウンド中に「ターンが完了した」ことをユーザーに伝えるには、後述のプッシュ起動を使います。

## エラーの表示

| 出所 | 形 | 表示の指針 |
|---|---|---|
| セッション内エラー | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner` がデフォルトで描画。`detail.scope == 'plan'` のときは「ローカルのレート制限」ではなく「しばらくしてから再試行」の文言にする |
| 助言系 | `view.notices`（`recoverable: true` の `turn.error`。サーバー側の永続化失敗など） | 弱い通知。入力を妨げない |
| 接続状態 | `connectionState` | `TansrConnectionBanner`：`Reconnecting…` / `Recovering` / 認証失効 |
| HTTP 面 | `TansrAgentException.Unified`：`code` は 19 の統一コードのいずれか（`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …）、`retryAction` は 6 つの動作のいずれか（`none` / `same-request` / `query-status` / `rediscover` / `rebind` …）。元のファミリーコードとステータスは `domainCode` / `domainStatus` に残り（`session_not_found`、`session_limit_exceeded` など）、さらに `traceId` / `requestId` / `retryAfterSeconds` を運びます。ファサードの契約不可は `ContractUnavailable(status, reason)`。SDK 2.0 / ターミナルサービス面は同じ形の `ApiFacadeException` を投げます。旧来のファミリー別 sealed 型（`SessionNotFound` など 33 型）と `Unified.toLegacy()` はいずれも `@Deprecated` で 1 バージョンだけ残り、`tansr-contract` ヘッダーのない旧エンベロープでしか現れません。`Network` / `Protocol` / `Unauthorized` / `Forbidden` は残ります | `code` + `retryAction` で分岐し、`domainCode` は診断の細分化にだけ使う。`domainCode` から旧型を復元しない |

`capacity_exceeded`（429 形、`retryAction = same-request`）では `retryAfterSeconds`（`Retry-After` ヘッダーから取得。ヘッダーがなければエンベロープの `retryAfterMs` を切り上げ）を読んで待ちます。`domainCode = session_limit_exceeded`（エンドユーザー 1 人あたりデフォルト 8 つのアクティブセッション、serve の `maxSessionsPerEndUser`）のときは、使っていないセッションを閉じるようユーザーに促します。エラーメッセージの文言は常に英語で、ホストが `code` に基づいてローカライズします。

## ローカルツールと 2 つのブリッジ

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) }
}
val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(), bridges = dialogs.bridges(tools = listOf(searchOrders)))
```

- `defineTool`：`name` / `description` / JSON パラメータ表 / `readOnly`（デフォルト false。保守的に書き込みツール扱い）/ `timeoutMs?`。handler は suspend 関数で、String はそのまま、それ以外は JSON シリアライズされ、投げられた例外は isError の構造化結果に正規化されてセッションを壊しません。`CancellationException` は透過します（`server.tool.cancel` に対応）。宣言はセッションとともに送信されますが、handler 本体が送信されることはありません。
- 6 つのプロトコルセマンティクスは SDK が肩代わりします。`callId` による対応付け、再送された重複フレームの排除、`deadlineAt` 超過時の無応答での破棄、応答のネットワーク失敗時の安全な再試行、画像結果の base64 化と 20 MiB キャップの事前チェック、権限ダイジェストの逐語的な復唱。
- 権限 / 質問ダイアログ：`BridgeDialogState` + `TansrBridgeDialogs(dialogs)` でデフォルト UI を使うか、自前の suspend コールバックを書きます。**未登録のブリッジは fail-closed** です。SDK は応答せず、サーバー側は権限が 120 秒で deny-and-continue、質問は 60 秒の猶予のあと構造化された「自己判断」になります。
- 権限フレームに `attribution.reason` がある場合（裁定者が危険と判断）は、理由をユーザーに見せて最終判断を委ねます。機械が代わりに承認することはありません。

## 公開ネットワークツール：サーバー側で実行

アプリがコンソールで `tools.webFetch`、`tools.http`（`@tansr/serve` 0.12.0 以降が必要）または `tools.webSearch` を有効にすると、エージェントはウェブページの読み取り、HTTP リクエストの発行、ウェブ検索ができます。これらのツールはすべてあなたのセッションサービスのホストで実行されます。スマートフォンが代わりにネットワークリクエストを出すことはなく、既存の権限承認も迂回しません。機能フラグの変更は新規作成されたセッション、またはストレージから再組み立てされたセッションに適用され、実行中のセッションでツールが自動的に増減することはありません。

- 結果はツールカードとしてそのまま表示され、切り詰めのヒントも保持します。Http の HTTP ステータスはツールの成否の代わりにはならず、4xx / 5xx は引き続き確認が必要です。検索結果が空なのは今回のクエリに一致がなかったというだけで、サイトにアクセスできないことを意味しません。古い履歴を復元するときは実際に保持されている本文とステータスだけを表示し、出典やステータスコードを捏造しません。
- 専用の検索 / ウェブページ / HTTP 結果表示の投影（`com.tansr.sdk.view.SearchResultDetails` / `NetworkResultDetails`）は 0.5.0 以降 `:core` とともに公開されています。検索カードは出典、切り詰め、空結果のヒントを保持し、ウェブページと HTTP のカードは元の本文を保持して実際の HTTP ステータスを表示します。`toolCardArtifact` の既存の使い方は変わりません。0.4.0 以前は引き続き従来のツールカードで結果を表示します。
- 機能スイッチ、実行境界、ホストをまたぐリダイレクトの承認ルールは[モバイルアプリ向けの公開ネットワークツール](/ja/sdk/platform-bundle/#移动应用的公网工具)を参照。

SDK 2.0 はサーバー側では `@tansr/serve` 0.13.0 / 0.14.0 とともに公開済みです（`@tansr/serve/extensions` の明示的ホストと `/api` 統一呼び出し面）。Android 側では 0.5.0 以降、端末側の薄いクライアントがパッケージに含まれます。`:core` の `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`、アーカイブ同期の `Sdk2ArchiveSyncClient` / `Sdk2ReplicatedArchiveStore`、ターミナルサービスクライアント `TerminalClient`、そして任意モジュール `:receiver-android` の SQLite アーカイブレシーバー / 同期ストア / 耐久実行ジャーナルです。これらは加法的な機能で、SDK 2.0 を組み込まないアプリは `:receiver-android` を追加せず、SDK1 のセッション挙動は変わりません。2026-10-10 より後にメインラインへ入った暗号化メモリ公開メディア、暗号化増分 SQLite プロファイル、読み取り専用コピーなどの永続化機能は**まだどの Maven バージョンでも公開されておらず**、本ページでは説明しません。組み立てと境界は [SDK 2.0 拡張の入口](/ja/sdk/sdk2-preview/)を参照。

## 音声：2 つのチェーン

音声はプロトコルレベルの入力種別ではありません（メッセージブロックにもイベントストリームにも入りません）。

1. **ツールチェーン**：エージェントが自ら `SpeechToText` / `TextToSpeech` を呼び、成果物は `tool.completed.data` で端末に届き、`toolCardArtifact` が `Transcript` / `Speech` を取り出し、`TansrToolCard` がデフォルトで描画します。
2. **直結チェーン**（あなた自身の音声 UX）：

```kotlin
val transcript = client.audio.transcribe(session.sessionId, bytes, mime = "audio/mp4") // 转写填框,是否发送归 App
val speech = client.audio.speak(session.sessionId, assistantText)                       // url ?: b64;URL 约 24 h 有效
```

`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech` を通り（同じ `call()` 経由で統一レスポンスヘッダーゲートを通過）、サーバーが代わりにプラットフォームの音声面を呼びます。機能フラグ `platform.speechToText` / `textToSpeech` とクォータが同じゲートになります。失敗時は `TansrAgentException.Unified` が投げられ、統一コードは `code` に（`capability_unavailable` / `invalid_request` / `payload_too_large` / `upstream_unavailable` など）、プラットフォーム音声面の元コードは `domainCode` に入ります（`capability_disabled` / `asr_not_configured` / `tts_quota_exceeded` …。ファサードの語彙に登録されていない上流の業務コードは契約に従って `internal_error` にフォールバックし、元のコードとステータスは `domainCode` / `domainStatus` に保持されます）。`@tansr/serve` 0.9.0 以降、プラットフォーム上流の 401 / 403 / 5xx とネットワーク障害は `upstream_unavailable`（503）に正規化され、`Retry-After` を伴います。`:compose` はプレイヤーも権限も持ちません。録音 / 再生はホストの役目で、サンプルの `AudioRecorderController` / `AudioPlayerController` は参考実装です。録音には `RECORD_AUDIO` の実行時権限が必要です。

## プッシュ起動：自前で配線する

SDK がプッシュ SDK を同梱することはありません。ターンが終端状態に達しアクティブな購読者がいないとき、サーバーはあなたの webhook に最小ペイロード `{ sessionId, endUserId, turnId?, status, reason?, lastSeq, ts }` を POST します（メッセージ内容も認証情報も決して含みません）。詳細は [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/) を参照。あなたの側では、webhook を受信 → 署名を検証 → `endUserId` を端末のプッシュ登録トークンに対応付け → `sessionId` だけを載せた FCM の **data** メッセージ（またはベンダーチャネル）を送信 → `onMessageReceived` でローカル通知を表示 → タップ後は既存の 3 段階チェーンで復旧（ウォームなら自動で L1 / L2、コールドスタートなら `CreateSessionRequest(resumeSessionId = sessionId)` つまり L3）。新しい SDK API は一切関与しません。

## 認証情報とログの規律

- 端末の認証情報 = あなたのログイン状態。SDK は `authProvider` 経由でリクエストごとに取得するだけで、**決して永続化せず**（SharedPreferences / DataStore / ファイル / ログに書かない）、1 リクエストの寿命を超えてキャッシュしません。
- appkey は SDK / サンプルコードの面にはそもそも存在せず、`app_user` トークンが端末に配られることもありません。本ページが扱う `@tansr/serve` の組み込み形では、`/api` セッション面のエンドユーザー身元はあなたの `authenticate` フックからだけ得られます。`tansr serve --v2` の単一運用者形は同じ Bearer に `x-tansr-end-user` 区分ヘッダーを添えて動作し、本ページの範囲外です。
- SDK のデバッグログは auth ヘッダー、トークン、応答の全文、ツール args の全量を出力せず、形状の要約だけを出します。クラッシュレポートが認証情報を手にすることはありません。
- ツールの応答もツールの宣言も信頼できない入力です。サーバー側の形状検証は必須で、意味の面は機能プロファイルによる絞り込み + 権限ブリッジ + イベントストリームの帰属に頼ります。端末はリバースエンジニアリングされ得るので、「自社アプリだから」と警戒を緩めないでください。

## ローカルでの結合テスト

`:sample`（注文アシスタント）はデフォルトでリポジトリ内の `examples/serve-demo` につなぎます。serve-demo は `DEMO_SERVE_ONLY=1` と `DEMO_PORT=8788` で常駐起動し（ソースコードのデフォルトポートは 8799。`pnpm start` / `pnpm real` はどちらも実モデルの入口で、公開された echo 起動コマンドはもうありません）、sample はデフォルトで `http://127.0.0.1:8788` につなぐので、先に `adb reverse tcp:8788 tcp:8788` で端末のポートを開発マシンへ転送します（エミュレーターは明示的に `http://10.0.2.2:8788` へ切り替えることもできますが、sample のデフォルトアドレスではありません）。`authProvider` は demo のチケット形式でローカル署名し、独立した開発者ログインサービス（`pnpm login`、デフォルト `127.0.0.1:8787`）に切り替えるときは 8787 も転送します。再ビルドせずにポートを変えるには、`adb reverse tcp:8789 tcp:8789` のあと `adb shell am start -n com.tansr.sdk.sample/.OrderAssistantActivity -e baseUrl http://127.0.0.1:8789` を実行します。実機では `DEMO_HOST=0.0.0.0` でサーバーを起動し、開発マシンの LAN IP を指定します（平文 http は network security config での許可が必要。ループバック以外で待ち受けるには 32 文字以上の自前の `DEMO_AUTH_SECRET` が必須）。ゲート：`./gradlew build`（assemble + 単体テスト + ktlint + apiCheck）。
