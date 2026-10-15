---
title: 'Android と iOS を 5 分で動かす'
description: 'Android アプリに tansr Kotlin SDK を組み込む——Maven 依存を追加し、自分のログイン認証情報を渡し、最初のセッションを開いてイベントストリームを Compose に流し込みます。最後の節では iOS Swift パッケージでの同じ手順を示します。'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - android
  - ios
  - harmony
  - getting-started/harmony
  - getting-started/serve
  - serve/v2-and-webhooks
  - sdk/platform-bundle
sources:
  - tansr-android:README.md
  - tansr-android:CHANGELOG.md
  - tansr-ios:README.md
  - tansr-ios:CHANGELOG.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

Android と iOS の SDK はどちらも tansr セッションサービスの**薄いプロトコルクライアント**です。入力を送り、イベントストリームを描画し、あなたが明示的に登録したローカルツールを実行し、権限と質問のダイアログに応答します。エージェントのカーネル、権限エンジン、コンテキストのガバナンスはすべてあなたがデプロイした `@tansr/serve` のサーバー側で動き、スマートフォン上にはプラットフォームの認証情報が一切ありません。両プラットフォームは同じ契約と同じビュー還元のゴールデンサンプルを共有します。このページは Android を主に扱い、最後の節で iOS の対応する書き方を示します。バージョンの基準（2026-10-13 に確認）：Android `com.tansr.sdk:*` **0.5.0**（Maven Central、2026-10-07）、iOS の公開バイナリパッケージ `tansr-ios-spm` **0.4.0**（2026-10-09）、サーバー側 `@tansr/serve` 0.15.1（npm latest、2026-10-10）。この 2 つのモバイル SDK バージョンからのリクエストは、サーバー側が 0.13.0 以降で提供する統一呼び出し面 `/api` だけを通ります（manifest revision 7 に整合し、エラーは統一コードを主とし、`ApiCallOptions` が 3 つのリクエストヘッダー `Idempotency-Key` / `If-Match` / `deadline` を運びます）。`/v2` へ直結することはなく、フォールバックもしません。それより古い Android 0.1.0 – 0.4.0 と iOS 0.3.0 は引き続き `/v2` に直結しますが、サーバー側の `/v2` は 0.13.0 以降は内部アダプターの入口にすぎず、1.0.0 で外部入口が削除されます。アップグレードしてください。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`CreateSessionRequest(prompt=...)` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。Android / iOS は `/api` のセッションリクエスト経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持でき、更新を受け取るためにセッションを作り直す必要はありません。業務セグメントの競合はアプリ管理者が解消してください。権限は引き続き独立した仕組みで扱われます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## 前提

- 到達可能な `@tansr/serve` サービス（[セッションサービスを 5 分で動かす](/ja/getting-started/serve/)を参照）で、統一呼び出し面 `/api` が組み込まれていること（0.13.0 以降）。ローカル開発では、まずリポジトリ内のサンプル `examples/serve-demo` を起動しても構いません。`DEMO_SERVE_ONLY=1` と `DEMO_PORT=8788` を指定して常駐サービスとして起動します（ソースコードのデフォルトポートは 8799）。Android 側では先に `adb reverse tcp:8788 tcp:8788` を実行してから `127.0.0.1:8788` に接続し（エミュレーターは `10.0.2.2:8788` でも可）、iOS シミュレーターは `127.0.0.1` をそのまま使います。
- Android：minSdk 26。Kotlin コルーチン、kotlinx.serialization、OkHttp。iOS：iOS 16+ / macOS 13+、Xcode 15+。
- あなた自身のログインの仕組み：SDK はリクエストごとにヘッダー（通常は `Authorization: Bearer <あなたのログイン token>`）を渡してもらう必要があり、サーバー側の `authenticate` フックがそこから `endUserId` を取り出します。

## インストール

Maven Central の座標。4 つから必要なものを選びます。

| 座標 | 内容 |
|---|---|
| `com.tansr.sdk:core` | 純粋な Kotlin/JVM：プロトコルモデルと生成された `/api` 契約、イベントの sealed class（47 型 + `Unknown` の許容）、`SessionView` reducer、再接続ステートマシン、`defineTool` と 2 つのブリッジ、SDK 2.0 の薄いクライアント |
| `com.tansr.sdk:client` | OkHttp トランスポート実装、`TansrAgent` エントリーファクトリ |
| `com.tansr.sdk:compose` | Compose バインディングの薄い層：ライフサイクルの開始 / 停止、デフォルトの権限 / 質問ダイアログ、`TansrMessageList` / `TansrToolCard` などのコンポーネント |
| `com.tansr.sdk:receiver-android` | 任意（0.5.0 で初公開）：SDK 2.0 の端末側 SQLite アーカイブレシーバー、同期ストア、実行ジャーナル。SDK 2.0 の端末実行を組み込むときだけ追加します |

```kotlin
dependencies {
    implementation("com.tansr.sdk:client:0.5.0")
    implementation("com.tansr.sdk:compose:0.5.0")
}
```

現在の公開バージョンは 0.5.0（2026-10-07 に Maven Central へ掲載。`core` / `client` / `compose` は 0.1.0 以降の 5 版がすべて存在し、`receiver-android` は 0.5.0 から）です。4 つのモジュールは同じバージョン番号を共有します。アップグレードは同時に行ってアプリを再ビルドし、異なるバージョンの SDK バイナリを混在させないでください。0.4.0 からのアップグレードは破壊的変更です。HTTP エラーは統一コードを主とする `TansrAgentException.Unified` になり、旧来のファミリー別 sealed 型（`SessionNotFound` など）は `@Deprecated` が付いて 1 バージョンだけ残ります。

## 認証情報：あなた自身のログイン状態だけ

SDK は**認証情報を一切永続化しません**。リクエストごとに `authProvider` コールバックからヘッダーを 1 回取得し、使ったら捨てます。SharedPreferences にもファイルにも書かず、ログにも残しません。渡すのはあなた自身のプロダクトのログイン token であり、tansr のキーではありません——appkey はサーバー側にだけあり、`app_user` トークンもサーバー側から出ません。

```kotlin
val client = TansrAgent.client(
    baseUrl = "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider = { mapOf("Authorization" to "Bearer ${mySession.jwt()}") },
)
```

## 最初のセッション

```kotlin
val session = client.openSession(scope, CreateSessionRequest(prompt = "hi"))
session.start()
session.view            // StateFlow<SessionViewState> — 直接喂进 Compose
session.events          // SharedFlow<KernelEvent>
session.connectionState // Idle → Connecting → Live → Retrying/Recovering/AuthExpired…
session.send("next question")
```

Compose ホストでは 1 行でライフサイクルに接続できます。バックグラウンドに回るとポンプを止めてストリームを切断し、フォアグラウンドに戻ると復旧ウィンドウに応じて経路を選び自動で再送を続けます。

```kotlin
TansrSessionLifecycle(session) // 在场即不需手工 start()
val view by session.collectViewAsStateWithLifecycle()
val connection by session.collectConnectionStateAsStateWithLifecycle()
```

Compose 以外のホストでの同等の接続：フォアグラウンドで `session.start()`、バックグラウンドで `session.stop()`。どちらも冪等で、`stop` はセッションを失いません。

## イベントを見る

`session.view` はすでに還元済みのビュー状態（メッセージ一覧、ツールカード、TODO、使用量、接続バナー）なので、多くの UI はこれを購読するだけで済みます。生のイベントストリームを見たいなら `session.events` を受け取ります。

```kotlin
scope.launch {
    session.events.collect { event ->
        Log.d("tansr", "${event.seq} ${event.type}")
    }
}
```

未知のイベント型は `Unknown` にデコードされ、例外は投げません。切断は業務コードまで上がってきません——イベントポンプは `Last-Event-ID` で再接続し（L1）、再送にギャップがあれば `/history` から再構築し（L2）、サーバーの再起動後はセッションストレージ経由で resume します（L3）。コールドスタートで前回の続きから話したいときは `CreateSessionRequest(resumeSessionId = savedId)` を渡します。

## ローカルツールとダイアログ

エージェントにスマートフォン上の業務関数を呼び出させたいときは、`defineTool` で登録してセッションと共に申告します。権限と質問のダイアログは `BridgeDialogState` でデフォルト実装を取得できます。

```kotlin
val searchOrders = defineTool("searchOrders", "Search the user's orders") {
    string("keyword", "search keyword")
    readOnly = true
    handler { args -> db.search(args.string("keyword")) } // 挂起函数;返回值宽容归一
}

val dialogs = BridgeDialogState()
val session = client.openSession(scope, CreateSessionRequest(),
    bridges = dialogs.bridges(tools = listOf(searchOrders)))
// Compose: TansrBridgeDialogs(dialogs) 渲染缺省权限/提问对话框
```

未登録のブリッジは fail-closed です。SDK は応答せず、サーバー側は契約に従ってフォールバックします（権限は deny-and-continue、質問は構造化された「自己判断」）。

## 最初によくつまずく点

| 現象 | 対処 |
|---|---|
| 接続するとすぐ 401 | `authProvider` が返すヘッダーをサーバー側の `authenticate` が認めていません。SDK は `authProvider` からトークンを再取得して最大 2 回再接続し、それでも 401 なら `Failed` の終端状態（`code = unauthorized`）に入ります。ログイン状態を直してから明示的に `start()` してください |
| 接続するとすぐ `ContractUnavailable` | `baseUrl` が `/api` ファサードを指していません（サーバーが 0.13.0 より古い、またはプロキシ / キャプティブポータルのページがレスポンスヘッダーを書き換えている）。SDK は旧プレフィックスへフォールバックせず、ポンプは `Failed` の終端状態に入ります。デプロイを直してから明示的に `start()` してください |
| エミュレーター / USB 実機から接続できない | 先に `adb reverse tcp:8788 tcp:8788` を実行して `127.0.0.1` を使います（エミュレーターは `10.0.2.2` でも可）。LAN 上の実機ではサーバー側が `0.0.0.0` を待ち受け、自前の `DEMO_AUTH_SECRET` を設定し、平文 http を許可する（または TLS を使う）必要があります |
| 新しいセッションが 429 | `capacity_exceeded`（`domainCode = session_limit_exceeded`）：エンドユーザー 1 人あたりデフォルトで最大 8 つのアクティブセッション。使わないセッションは `close()` してください。枠を解放しつつストレージは保持され、resume は引き続き可能です |

## iOS でも同じ手順

iOS は SwiftPM で公開のバイナリパッケージ `tansr-ios-spm`（現在 `0.4.0`、2026-10-09 公開）を追加します。3 つのモジュールが Android の 3 モジュールに 1 対 1 で対応します：`TansrCore`（純粋な Swift のプロトコル層）、`TansrClient`（URLSession トランスポート + `TansrAgent` ファクトリ）、`TansrUI`（SwiftUI バインディングとデフォルトコンポーネント）。`Package.swift` に次のように宣言するか、Xcode の「Add Package Dependencies」に同じリポジトリのアドレスを入力します：

```swift
.package(url: "https://github.com/tansrai/tansr-ios-spm.git", exact: "0.4.0")
// App target dependencies:
.product(name: "TansrClient", package: "tansr-ios-spm")
.product(name: "TansrUI", package: "tansr-ios-spm")
```

公開パッケージには SDK 実装のソースコードは含まれず、iOS 16+ の実機とシミュレーター、および macOS 13+ をカバーします。同じアプリの依存グラフ内でソース版 SDK とバイナリ版 SDK を混在させないでください。0.3.0 からのアップグレードでは、HTTP エラーが `TansrAgentError.kind == .unified`（統一コード + `retryAction`、元のファミリーコードは `domainCode`）になります。旧来の kind で分岐しているコードは移行してください。

クライアントと最初のセッション：

```swift
import TansrCore
import TansrClient

let client = TansrAgent.client(
    baseUrl: "https://agent.example.com",
    // 你自己的登录凭据,逐请求获取——SDK 恒不持久化
    authProvider: { ["Authorization": "Bearer \(await mySession.jwt())"] }
)

let session = try await client.openSession(CreateSessionRequest(prompt: "hi"))
session.start()
session.view                    // 当前视图快照(SessionViewState)
session.viewUpdates()           // AsyncStream<SessionViewState> — 直接喂进 SwiftUI
session.events()                // AsyncStream<KernelEvent>
try await session.send("next question")
```

SwiftUI ホストでは 1 行で scenePhase に接続します：`ChatScreen(session: session).tansrSessionLifecycle(session)`。その上で `TansrSessionObserver(session:)` を使って `view` / `connectionState` を再描画に流し込みます。ローカルツールは `try defineTool(name:description:)` で宣言し、`BridgeDialogState().bridges(tools:)` でデフォルトのダイアログを取得し、`.tansrBridgeDialogs(...)` で描画します。

iOS 特有の注意点は 2 つ：ローカルでの平文 http による結合テストはアプリの Info.plist で許可が必要です（demo でのみ `NSAllowsArbitraryLoads` を使い、本番では常に TLS）。マイクを使う場合（音声直結チェーン）はアプリの target で `NSMicrophoneUsageDescription` を宣言しなければなりません——SwiftPM パッケージには Info.plist のセマンティクスがなく、宣言がないと最初にマイクへアクセスした時点でプロセスが終了します。その他のセマンティクス（3 段階の復旧チェーン、楽観的な記帳、401 は 2 回で終端状態に収束、`Unknown` イベントの許容）は Android と完全に同じです。

## 次のステップ

- [Android 導入ガイド](/ja/android/)、[iOS 導入ガイド](/ja/ios/)、[HarmonyOS 導入ガイド](/ja/harmony/)：イベントの還元、エラーの表示、オフラインとフォアグラウンド / バックグラウンド、音声の 2 つのチェーン、プッシュによる起動。
- [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)：サーバー側の後半で、ターン終了時の通知をあなたのプッシュバックエンドに渡す方法。
- [モバイルアプリ向けの公開ネットワークツール](/ja/sdk/platform-bundle/#移动应用的公网工具)：エージェントにウェブページの読み取り、HTTP リクエスト、ウェブ検索をさせる——サーバー側で実行され、デフォルトは無効です。
