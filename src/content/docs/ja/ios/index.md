---
title: 'iOS 導入ガイド'
description: 'Swift パッケージの 3 モジュール分割、ビューストリームとイベント還元、接続ステートマシンと 3 段階の復旧チェーン、scenePhase によるフォアグラウンド / バックグラウンド方針、楽観的な記帳、エラーの表示、ローカルツールと 2 つのブリッジ、音声の 2 つのチェーン、自前で配線するプッシュ起動、そして Windows で純 Swift ロジック層をビルドするときの注意点。'
zone: docs
category: ios
related:
  - sdk/system-prompts
  - getting-started/android
  - android
  - harmony
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-ios:doc/report/REL-FULL-20261010-iOS-0.4.0.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

iOS SDK は Android SDK の Swift 版の鏡像で、3 つのクライアントは同じ規律に従います。同じセッション契約定数表（revision 9）、同じ `/api` 契約生成物（manifest revision 7）、同じビュー還元のゴールデンフィクスチャ、同じフレーム順序フィクスチャ。このページは両プラットフォームのチームが対照しやすいよう Android ガイドと同じ順序で展開し、相違点（SwiftUI の配線、楽観的な記帳、Info.plist の宣言、Windows でのビルド）は個別に明示します。本ページは公開バイナリパッケージ `tansr-ios-spm` **0.4.0**（GitHub Release、2026-10-09）に照らして確認し、サーバー側は `@tansr/serve` 0.15.1（npm latest、2026-10-10）に照らしています。

## バージョンとサーバー側プレフィックス（2026-10-13 に確認）

- 公開バイナリパッケージ 0.4.0（2026-10-09 公開、ソース `f3f31a6`）以降、SDK のすべての HTTP リクエストはサーバー側が 0.13.0 以降で提供する統一呼び出し面 `/api` だけを通ります（D10：即時切り替え。ソース内に `/v2`、`/v3/sdk2`、`/v3/terminal` のルートリテラルはもうありません）。パス、メソッド、ヘッダー名は manifest revision 7 から生成された `ApiContract` / `ApiOps`（81 操作）に由来し、セッションファミリーはリクエストヘッダー `tansr-session-family: sdk1 | sdk2-offload-v1` で明示的に運ばれます。サーバー側には `/api` ファサードが組み込まれている必要があり（`@tansr/serve` 0.13.0 以降。r7 は 0.14.0 以降）、レスポンスヘッダーの revision がローカルの r7 と異なるときは `TansrAgentClient.onManifestRevisionDrift` / `AudioClient.onManifestRevisionDrift` がクライアントごとに 1 回発火します。
- 0.4.0 と同時に公開されたもの：統一エラーコードを主とするエラーモデル（D19：`TansrAgentError.kind == .unified` / `.contractUnavailable`、SDK 2.0 とターミナルサービス面の `ApiFacadeError`）、SDK1 の成功レスポンスとイベントストリームに対する統一レスポンスヘッダーゲート（D38）、3 つのリクエストヘッダー `Idempotency-Key` / `If-Match` / `deadline` を運ぶ `ApiCallOptions`、そして SDK 2.0 の端末側インターフェース。本ページはこれらの挙動に沿って記述します。
- それより古い 0.3.0 は引き続き `/v2` に直結します。サーバー側の `/v2` は 0.13.0 以降は内部アダプターの入口にすぎず、1.0.0 で外部入口が削除されます。0.3.0 に残っているアプリは 0.4.0 へアップグレードしてください。スケジュールは[デプロイと認証](/ja/serve/deploy-and-auth/)を参照。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`CreateSessionRequest(prompt=...)` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。Android / iOS は `/api` のセッションリクエスト経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持でき、更新を受け取るためにセッションを作り直す必要はありません。業務セグメントの競合はアプリ管理者が解消してください。権限は引き続き独立した仕組みで扱われます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## モジュール分割

| モジュール | 種別 | 内容 |
|---|---|---|
| `TansrCore` | 純 Swift、任意のプラットフォームでテスト可能 | 契約定数と `/api` 契約生成物（`ApiContract` / `ApiOps` の 81 操作、`UnifiedContract`）、レスポンスヘッダーゲート `ApiContractGate`、`ApiCallOptions`、`KernelEvent` 型族（47 型 + `Unknown` の許容）、IR メッセージモデル、SSE の解析 / 振り分け、`SessionView` reducer と `viewStateFromHistory`、`toolCardArtifact` と `SearchResultDetails` / `NetworkResultDetails`、プロトコルクライアントのロジックとトランスポート抽象、音声直結面 `AudioClient`、再接続ステートマシン（L1 / L2 / L3）、`defineTool` とリモートツールブリッジ、権限 / 質問ブリッジ `SessionBridges`（デフォルトで fail-closed）、`BridgeDialogState`。SDK 2.0 の薄いクライアント `Sdk2Client` / `Sdk2Executor` / `Sdk2ArchiveSync` とターミナルサービスクライアント `TerminalClient` |
| `TansrClient` | 純 Swift | URLSession トランスポート（SSE は delegate ブリッジ経由。Darwin と FoundationNetworking で同じ経路）、`TansrAgent` エントリーファクトリ。SDK 2.0 の SQLite アーカイブレシーバー / 同期ストア / 実行ジャーナル（`Sdk2SqliteArchiveReceiver` / `Sdk2SqliteArchiveSyncStore` / `Sdk2SqliteExecutionJournal`） |
| `TansrUI` | SwiftUI（`#if canImport(SwiftUI)`。Apple 以外のプラットフォームでは空にコンパイル） | `TansrSessionObserver`、`tansrSessionLifecycle`、デフォルトの権限 / 質問ダイアログ `tansrBridgeDialogs`、`TansrMessageList` / `TansrToolCard` / `TansrTodoPanel` / `TansrUsageRow` / `TansrErrorBanner` / `TansrConnectionBanner`。すべて差し替え可能で、テーマに縛られず、AVFoundation 依存ゼロ |

配布チャネルは SwiftPM：公開バイナリパッケージ `tansrai/tansr-ios-spm`（現在 0.4.0、2026-10-09 公開。リモート XCFramework で SDK 実装ソースは含まず、モジュール名は `TansrCore` / `TansrClient` / `TansrUI` のまま。Xcode 26.6 / Swift 6.3.3 により Swift 5 言語モードでビルド）。最低 iOS 16+ / macOS 13+ で、iOS 実機 arm64、シミュレーター arm64 / x86_64、macOS arm64 / x86_64 をカバーします。ソースリポジトリ `tansr-ios` の SPM タグ（0.2.0）はプライベートリポジトリで公開され、リポジトリへのアクセス権が必要で、ソース権限を持つチームの結合テスト向けです。

## ビューストリームとイベント還元

```swift
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState>
session.events()                // AsyncStream<KernelEvent>
session.connectionState         // idle → connecting → live → retrying / recovering / authExpired …
```

SwiftUI ホストは `TansrSessionObserver(session:)` で `view` / `connectionState` / `userSendStates` を `@Published` に変え、再描画へ直接流し込みます。`view` は還元済みのビュー状態で、差分を自分で組み立てないでください。表示プロファイル `SessionViewOptions(delivery: .init(text: .final, thinking: .off))`：`final` プロファイルでは delta が内部バッファに入り、ブロック確定時に一括で画面に出ます。`thinking: .off` では思考 part を実体化しません（状態の導出は引き続き `thinking` を見るので、プレースホルダー UI は作れます）。実行中は `session.setDelivery(...)` でブロック単位に切り替えられ、`.off` に切り替えると既存の思考も直ちに取り除かれます。L2 / L3 の再構築と resume / attach は常に現在のプロファイルを引き継ぎます。

ツールカード成果物 `toolCardArtifact` は imageGen / videoGen / webSearch の URL 成果物と `.transcript(model:text:language:durationSec:)` / `.speech(model:url:b64:mime:format:durationMs:billedChars:)` を取り出します。`TansrToolCard` は 5 つの形をデフォルトで描画し、`.speech` の「再生」ボタンはホストが `onPlaySpeech` スロットを渡したときだけ現れます——`TansrUI` にプレイヤーは内蔵されていません。

## 接続ステートマシンと 3 段階の復旧チェーン

Android と完全に同じです。L1 は SSE 切断時に `Last-Event-ID` を付けて再接続し、受信フレームを seq で重複排除。L2 は再接続後の最初のフレームで gap を受けたら → 投影を捨てる → メタ情報 → `/history` → `viewStateFromHistory` で再構築 → `lastSeq` から再購読。L3 はメタ情報が 404 または `live == false`、あるいは sessionId しか持たないコールドスタートのとき → `CreateSessionRequest(resumeSessionId: savedId)` で resume して再ロードし、旧カーソルを捨てて `history.lastSeq` をアンカーにします（resume レスポンスの `lastSeq` は読みません）。切断が業務コードに浮上することはありません。

`lastSeq` は常に値どおりに継続し、休眠の判定は常に `live == false` であって、決して `lastSeq == 0` ではありません。`@tansr/serve` 0.9.0 以降、休眠セッションのメタ情報 `lastSeq` はストアに永続化された真の水位であり、resume 後の新エポックは `0` からではなくその水位 + 1 から続きます（0.8.x では両方とも常に `0`）。どちらのバージョンでも端末側の対応は不要です。`live == true` かつ `lastSeq == 0` のときは L2 だけを通り、resume はしません。セッション契約 revision 9（0.4.0 に同梱の vendored 版）は 55 型のイベントを登録し、`TansrCore` はそのうち 47 型をデコードします。SDK 専用イベント `session.events_dropped`（contract-v0.27）は serve が送出せず、イベントストリームに現れることもなく、仮に現れても `Unknown` として許容されます。

401 の収束ルールも同じです。`authProvider` でトークンを最大 2 回再取得し、それでも 401 なら終端状態 `failed(unauthorized)` に入り、`view.lastError { code: 'unauthorized', scope: 'client.auth', recoverable: false, detail: { attempts: 2 } }` となってポンプが止まります。ホストがログイン状態を直してから明示的に `start()` してください。終端状態は `failed` であって `closed` ではありません——セッションは終了しておらず、サーバー側がまだ保持しています。

統一レスポンスヘッダーゲート（D38、3 クライアント同構造）：`TansrAgentClient.call()` の各 2xx、`openEventStream` の 200 イベントストリーム、`AudioClient` の 2xx はすべて先に `ApiContractGate.requireUnified` を通ります——4 つのヘッダー `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` が揃って正しい形であること。違反は `TansrAgentError.contractUnavailable(status:reason:)` を投げ、**業務上の成功ではなく、フォールバックもしません**。イベントポンプは 2xx 形の契約不可で直ちに `failed` 終端状態に入ります（バックオフも再接続もしません。典型的な原因は `baseUrl` が `/api` ファサードを指していないか、途中にプロキシ / ポータルページがあること）。ホストはデプロイを直してから `start()` します。400 以上の形は引き続きステータスコードの方針に従います。

## フォアグラウンド / バックグラウンド：scenePhase の 1 行配線

```swift
ChatScreen(session: session)
    .tansrSessionLifecycle(session)  // scenePhase 收放;在场即不需手工 start()
```

バックグラウンドに回るとポンプを止めて SSE を切ります（サスペンドは fatal ではなく、`connectionState` は `idle` に戻ります）。フォアグラウンドに戻ると**復旧ウィンドウ**に応じて経路を自動選択します。ウォーム状態（デフォルトでは 60 秒以内）なら L1 で直接継続。しきい値を超え、バックグラウンド中にターンが走っていたなら先に L2 の `history` 再構築。セッションがアイドルで回収されていれば 404 → L3 で自己修復。判断は `TansrCore` の純関数 `LifecyclePolicy` で、しきい値は `AgentSessionConfig.warmResumeWindowMs` で調整できます。SwiftUI 以外のホストの等価な配線：フォアグラウンドで `session.start()`、バックグラウンドで `session.stop()`。冪等で、`stop` はセッションを失いません。セッション終了（`closed`）後にフォアグラウンドへ戻っても自動で復活することはありません。

## 楽観的な記帳（iOS 固有の表示）

`send` / `sendBlocks` の呼び出しと同時にユーザーの吹き出しを記帳し（`userSendStates` に `sending` を記録）、HTTP 202 の確認後に確定します。失敗は `failed` と記され、黙って消えることはありません——`retrySend(messageId)` は元のメッセージ id のまま再投稿し（吹き出しは重複しない）、`discardSend(messageId)` は冪等に取り消します。L2 / L3 の再構築では衝突を防ぐため楽観的な帳簿を常にクリアします（再構築後、メッセージ id は 1 から振り直されます）。

## エラーの表示

| 出所 | 形 | 表示 |
|---|---|---|
| セッション内エラー | `view.lastError { code, scope, recoverable: false, detail? }` | `TansrErrorBanner`。`detail.scope == 'plan'` のときは「しばらくしてから再試行」の文言にする |
| 助言系 | `view.notices`（`recoverable: true`） | 弱い通知 |
| 接続状態 | `connectionState` | `TansrConnectionBanner` |
| HTTP 面 | `TansrAgentError.kind == .unified`：`unifiedCode` は 19 の統一コードのいずれか（`invalid_request` / `unauthorized` / `forbidden` / `not_found` / `gone` / `conflict` / `capability_unavailable` / `capacity_exceeded` / `payload_too_large` / `upstream_unavailable` / `internal_error` …）、`retryAction` は 6 つの動作のいずれか（`none` / `same-request` / `query-status` / `rediscover` / `rebind` …）。元のファミリーコードは `domainCode` / `domainStatus` / `domainRetryAction` に残り、さらに `traceId` / `requestId` を運びます。ファサードの契約不可は `.contractUnavailable`（`reason` = 違反項目）。SDK 2.0 / ターミナルサービス面は同じ形の `ApiFacadeError` を直接投げます（`Sdk2HttpError` は非推奨）。`domainCode` から旧 kind を復元する `toLegacy()` は 1 バージョン限りの移行措置で、`tansr-contract` ヘッダーのない旧 `{ error: { code } }` エンベロープは引き続き移行ブリッジを通ります | `unifiedCode` + `retryAction` で分岐し、`domainCode` は診断の細分化にだけ使う |

`capacity_exceeded`（429 形、`retryAction = same-request`）では `Retry-After` の整数秒の値だけ待ちます。32 MiB の音声本文キャップは端末側で先に拒否されます（`.payloadTooLarge`。リクエストは送信されません）。

## ローカルツールと 2 つのブリッジ

```swift
let searchOrders = try defineTool(name: "searchOrders", description: "Search the user's orders") { tool in
    try tool.string("keyword", description: "search keyword")
    tool.readOnly = true
    tool.handler { args in try await db.search(keyword: args.string("keyword")) } // async;返回值宽容归一
}

let dialogs = BridgeDialogState() // 或自写 async 回调
let session = try await client.openSession(CreateSessionRequest(), bridges: try dialogs.bridges(tools: [searchOrders]))
// SwiftUI: .tansrBridgeDialogs(TansrBridgeDialogObserver(state: dialogs))
```

handler はタスクとして実行され `callId` で対応付けられます。再送された重複フレームは重複排除、`server.tool.cancel` はタスクをキャンセル、`deadlineAt` 超過は無応答で破棄、応答のネットワーク失敗は安全に再試行、画像結果は base64 化して 20 MiB キャップを事前に自己チェック、権限ダイジェストは SDK が逐語的に復唱します。未登録のブリッジは fail-closed：SDK は応答せず、サーバー側は契約どおり縮退します（権限は deny-and-continue / 質問は構造化された「自己判断」）。

## 公開ネットワークツール：サーバー側で実行

アプリがコンソールで `tools.webFetch`、`tools.http`（`@tansr/serve` 0.12.0 以降が必要）または `tools.webSearch` を有効にすると、エージェントはウェブページの読み取り、HTTP リクエストの発行、ウェブ検索ができます。これらのツールはすべてあなたのセッションサービスのホストで実行されます。スマートフォンが代わりにネットワークリクエストを出すことはなく、既存の権限承認も迂回しません。機能フラグの変更は新規作成されたセッション、またはストレージから再組み立てされたセッションに適用され、実行中のセッションでツールが自動的に増減することはありません。

- 公開バイナリ SPM パッケージは 0.3.0 以降 `SearchResultDetails` / `NetworkResultDetails` の表示投影を含み、`ToolCardArtifact` の既存の使い方は変わりません。検索カードは出典、切り詰め、空結果のヒントを保持し、ウェブページと HTTP のカードは元の本文を保持して実際の HTTP ステータスを表示します。
- HTTP ステータスはツールの成否の代わりにはならず、4xx / 5xx は引き続き確認が必要です。検索結果が空でも既知の URL にアクセスできないことにはなりません。古い履歴にこれらのメタデータがないときは未知のままにし、補って作らないでください。
- 機能スイッチ、実行境界、ホストをまたぐリダイレクトの承認ルールは[モバイルアプリ向けの公開ネットワークツール](/ja/sdk/platform-bundle/#移动应用的公网工具)を参照。

SDK 2.0 はサーバー側では `@tansr/serve` 0.13.0 / 0.14.0 とともに公開済みです（`@tansr/serve/extensions` の明示的ホストと `/api` 統一呼び出し面）。iOS 側では公開パッケージ 0.4.0 以降、端末側インターフェースがパッケージに含まれます。`TansrCore` の `Sdk2Client` / `Sdk2Executor` / `Sdk2ClientToolAdapter`、アーカイブ同期 `Sdk2ArchiveSync` とレプリカ受信 `Sdk2ReplicatedArchive`、ターミナルサービスクライアント `TerminalClient`、`TansrClient` の SQLite アーカイブレシーバー / 同期ストア / 耐久実行ジャーナル（プライベートディレクトリ、鍵は Data Protection Keychain が保管）。これらは加法的な機能で、明示的に組み立てなければ同期ストアは作られず `archive-sync-v1` リクエストも送られず、SDK1 のセッション挙動は変わりません。リリース記録にはこのラウンドがシミュレーターの ad-hoc 署名による受け入れで、実機検証なしと登記されています。2026-10-10 より後にメインラインへ入った暗号化メモリ公開、デバイスストレージのソース保持移行、ターミナル永続化プロファイルは**まだどの SPM バージョンでも公開されておらず**、本ページでは説明しません。組み立てと境界は [SDK 2.0 拡張の入口](/ja/sdk/sdk2-preview/)を参照。

## 音声：2 つのチェーン

1. **ツールチェーン**：エージェントが `SpeechToText` / `TextToSpeech` を呼び、成果物は `tool.completed.data` で端末に届き、`TansrToolCard` がデフォルトで描画します（文字起こし本文 + 長さ。音声行 + 長さ + モデル + 課金文字数）。
2. **直結チェーン**：

```swift
// 麦克风 → 转写 → 填入输入框(不自动发送);m4a 16 kHz mono 上行 data:audio/mp4;base64,…
let transcript = try await client.audio.transcribe(
    sessionId: session.sessionId, data: m4aBytes, mime: "audio/mp4", language: "zh")
inputText = transcript.text

// 助手回复 → 语音 → 播放(url ?? b64;url 形约 24 h 时效)
let speech = try await client.audio.speak(sessionId: session.sessionId, text: reply, voice: "Cherry")
speech.url ?? speech.b64
```

純粋な HTTP の往復で（`POST /api/sessions/:id/audio/transcriptions` / `…/audio/speech`。2xx は同様に統一レスポンスヘッダーゲートを通ります）、履歴には決して入りません。文字起こしのテキストを次のユーザー入力にするかどうかはアプリの判断です。サーバーが代わりにプラットフォームの `/t1/asr` / `/t1/tts` を呼び、機能フラグ `platform.speechToText` / `textToSpeech` とクォータが同じゲートになります。失敗は D19 に従って `.unified` に落ちます。統一コードは `unifiedCode` に（`capability_unavailable` / `invalid_request` / `upstream_unavailable` など）、プラットフォーム音声面の元コード（`asr_not_configured` / `tts_quota_exceeded` …）は `domainCode` に入ります。`@tansr/serve` 0.9.0 以降、プラットフォーム上流の 401 / 403 / 5xx とネットワーク障害は `upstream_unavailable`（503）に正規化され `Retry-After` を伴うので、端末側は整数秒の値だけバックオフすれば十分です。

**マイク権限の宣言**：アプリターゲットの Info.plist には `NSMicrophoneUsageDescription` が必要で、欠けていると iOS は最初のマイクアクセスでプロセスを終了させます。本リポジトリは SwiftPM パッケージで、`executableTarget` には Info.plist のセマンティクスがありません——サンプルの `Examples/OrderAssistant/Info.plist` は `Package.swift` で明示的に `exclude` されています。iOS では Xcode でアプリプロジェクトを作って本パッケージを組み込むとき、それをアプリターゲットの Info.plist に設定します（またはキーごとに統合）。macOS の `swift run` では `-Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker <path>` で埋め込みます。リポジトリ内では意図的に `linkerSettings.unsafeFlags` を使っていません（依存として使われるとき SwiftPM に拒否されるため）。

## プッシュ起動：自前で配線する

SDK がプッシュ SDK を同梱することはありません（APNs / FCM / ベンダーチャネルはあなたの担当）。サーバー側の webhook フックはターンが終端状態に達しアクティブな購読者がいないときに最小ペイロードを POST します。詳細は [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/) を参照。アプリはプッシュで起こされたあと常に既存の 3 段階チェーンを通り、新しい API はゼロです。プロセスが生きていれば → フォアグラウンド復帰で自動的に L1 再接続。プロセスが死んでいれば → コールドスタートで `openSession(CreateSessionRequest(resumeSessionId: id))`、つまり L3。

## 結合テストとビルド

- アプリの導入には公開バイナリ SPM パッケージ `tansr-ios-spm` を使います（[クイックスタートの iOS 節](/ja/getting-started/android/#ios-同法)を参照）。本節の `swift build` / `swift test` はソース権限を持つチームの結合テスト向けです。同じアプリの依存グラフでソース SDK とバイナリ SDK を混在させないでください。
- リポジトリ内の `examples/serve-demo` につなぐ場合：`pnpm start` / `pnpm real`（npm では `npm start` / `npm run real`）はどちらも実モデルの入口で、常駐の結合テストでは `DEMO_SERVE_ONLY=1`、`DEMO_PORT=8788` で起動します（ソースのデフォルトポートは 8799。公開された echo 起動コマンドはもうありません）。独立した開発者ログインサービス `pnpm login` のデフォルトは `127.0.0.1:8787`。demo の認証チケット形式は `demo1.<b64url(uid)>.<exp>.<hmac-sha256-hex>` です。iOS シミュレーターからホストマシンへは `127.0.0.1` で直接つながります。サンプル `OrderAssistant`：`swift run OrderAssistant`、または `TANSR_DEMO_BASE_URL=http://127.0.0.1:8789 swift run OrderAssistant` でサービスアドレスを上書き。平文 http は demo だけ `NSAllowsArbitraryLoads` で許可し、本番では常に TLS を使います。
- **Windows / Linux でのロジック層のビルド**：`swift build` / `swift test`（Swift 6.3+）で `TansrCore` の全スイートが走ります——ゴールデンフィクスチャ照合、契約表の照合、ポンプのステートマシン、楽観的な記帳、2 ブリッジのマトリクス、音声直結面。Windows で `swift test` を走らせるには XCTest ランタイム DLL のディレクトリを PATH に加える必要があります（`<Swift>\Platforms\<ver>\Windows.platform\Developer\Library\XCTest-<ver>\usr\bin64`）。
- Windows でパッケージ読み込み時に即座に `NSCocoaErrorDomain Code=257 "You don't have permission."` が出る場合、たいてい ACL の問題ではありません。SwiftPM は `Package.swift` を `%TEMP%` 配下の `<パッケージ名>-manifest.exe` にコンパイルしてから起動するため、能動防御を持つセキュリティソフトがそれを遮断して隔離します。対処は二択：Swift ツールチェーンのディレクトリをセキュリティソフトの信頼ゾーンに加える（根本対策）。または `mklink /J` でセキュリティソフトが許可するディレクトリのエイリアスを作り、その中で実行する。
- macOS（Xcode 15+）：`swift build && swift test` で `TansrUI` を含む全量を実行。iOS シミュレーター / 実機は Xcode で本パッケージを開いて `OrderAssistant` スキームを実行します。
