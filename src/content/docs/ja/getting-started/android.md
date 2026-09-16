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
sources:
  - tansr-android:README.md
  - tansr-ios:README.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-15'
---

Android と iOS の SDK はどちらも tansr セッションサービス（`/v2` プロトコル）の**薄いプロトコルクライアント**です。入力を送り、イベントストリームを描画し、あなたが明示的に登録したローカルツールを実行し、権限と質問のダイアログに応答します。エージェントのカーネル、権限エンジン、コンテキストのガバナンスはすべてあなたがデプロイした `@tansr/serve` のサーバー側で動き、スマートフォン上にはプラットフォームの認証情報が一切ありません。両プラットフォームは同じ契約と同じビュー還元のゴールデンサンプルを共有します。このページは Android を主に扱い、最後の節で iOS の対応する書き方を示します。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`CreateSessionRequest(prompt=...)` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。Android / iOS は `/v2` 経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持でき、更新を受け取るためにセッションを作り直す必要はありません。業務セグメントの競合はアプリ管理者が解消してください。権限は引き続き独立した仕組みで扱われます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## 前提

- 到達可能な `@tansr/serve` サービス（[セッションサービスを 5 分で動かす](/ja/getting-started/serve/)を参照）。ローカル開発では、まずリポジトリ内のサンプル `examples/serve-demo` を起動しても構いません。デフォルトで `127.0.0.1:8788` を待ち受けます。Android エミュレーターは `10.0.2.2:8788` でホストマシンにアクセスし、iOS シミュレーターは `127.0.0.1` をそのまま使います。
- Android：minSdk 26。Kotlin コルーチン、kotlinx.serialization、OkHttp。iOS：iOS 16+ / macOS 13+、Xcode 15+。
- あなた自身のログインの仕組み：SDK はリクエストごとにヘッダー（通常は `Authorization: Bearer <あなたのログイン token>`）を渡してもらう必要があり、サーバー側の `authenticate` フックがそこから `endUserId` を取り出します。

## インストール

Maven Central の座標。3 つから必要なものを選びます。

| 座標 | 内容 |
|---|---|
| `com.tansr.sdk:core` | 純粋な Kotlin/JVM：プロトコルモデル、イベントの sealed class（47 型 + `Unknown` の許容）、`SessionView` reducer、再接続ステートマシン、`defineTool` と 2 つのブリッジ |
| `com.tansr.sdk:client` | OkHttp トランスポート実装、`TansrAgent` エントリーファクトリ |
| `com.tansr.sdk:compose` | Compose バインディングの薄い層：ライフサイクルの開始 / 停止、デフォルトの権限 / 質問ダイアログ、`TansrMessageList` / `TansrToolCard` などのコンポーネント |

```kotlin
dependencies {
    implementation("com.tansr.sdk:client:0.1.0")
    implementation("com.tansr.sdk:compose:0.1.0")
}
```

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
| 接続するとすぐ 401 | `authProvider` が返すヘッダーをサーバー側の `authenticate` が認めていません。SDK は `authProvider` からトークンを再取得して最大 2 回再接続し、それでも 401 なら `Failed(Unauthorized)` の終端状態に入ります。ログイン状態を直してから明示的に `start()` してください |
| エミュレーターから接続できない | Android では `127.0.0.1` ではなく `10.0.2.2` を使う。実機ではサーバー側が `0.0.0.0` を待ち受け、平文 http を許可する（または TLS を使う）必要があります |
| 新しいセッションが 429 | エンドユーザー 1 人あたりデフォルトで最大 8 つのアクティブセッション。使わないセッションは `close()` してください。枠を解放しつつストレージは保持され、resume は引き続き可能です |

## iOS でも同じ手順

Swift パッケージ `tansr-ios` は SwiftPM で追加します（git tag がそのままバージョンで、現在は `0.1.0`）。3 つのライブラリプロダクトが Android の 3 モジュールに 1 対 1 で対応します：`TansrCore`（純粋な Swift のプロトコル層）、`TansrClient`（URLSession トランスポート + `TansrAgent` ファクトリ）、`TansrUI`（SwiftUI バインディングとデフォルトコンポーネント）。Xcode の「Add Package Dependencies」にリポジトリのアドレスを入力するだけです。

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
