---
title: 'HarmonyOS SDK を 5 分で動かす'
description: 'ネイティブ HarmonyOS アプリに @tansr/harmony を組み込む——独立公開のバージョン付き HAR を依存に追加し、自分のログイン認証情報を渡し、最初のセッションを作ってイベントストリームを SessionView に還元します。'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - harmony
  - android
  - ios
  - getting-started/serve
  - serve/v2-and-webhooks
sources:
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-05'
---

`@tansr/harmony` はセッションサービス `/v2` の**ネイティブ ArkTS の薄いプロトコルクライアント**（HAR）です。入力を送り、イベントストリームを還元し、あなたが明示的に登録したローカルツールを実行し、権限と質問に応答します。エージェントのカーネル、権限エンジン、コンテキストのガバナンスはすべてあなたがデプロイした `@tansr/serve` のサーバー側で動き、スマートフォン上にはプラットフォームの認証情報が一切ありません。ビュー還元は Android / iOS と同じゴールデンサンプルを共有します。HAR は **ArkUI のページを含みません**。録音、再生、リストの仮想化はホスト側の仕事です。

Android 互換スタックだけの古い HarmonyOS 端末は引き続き [Android SDK](/ja/getting-started/android/) を使います。現在の最低要件は HarmonyOS 6.0 / API 20（Stage モデル）です。HarmonyOS 5.x のネイティブ互換は後続の作業であり、この記事は利用可能だと主張しません。現在の配布物は独立公開のバージョン付き release バイトコード HAR（0.1.0）です。公共 OHPM には未掲載で、公共チャネルから最新版を自動取得しません（2026-10-05 に確認。引き続き 0.1.0）。サーバー側は `@tansr/serve` 0.14.0 で確認しています。0.13.0 で追加された統一呼び出し面 `/api` は 0.1.0 の HAR に対して透過的で、HAR は引き続き `/v2` に直結します。リポジトリのメインラインで進む `/api` への整合や RDB レシーバー / HUKS 暗号化などの機能はすべてローカルの候補であり、**まだどのバージョンでも公開されていません**。本ページでは説明しません。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`createSession` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。HarmonyOS SDK は `/v2` 経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持でき、更新を受け取るためにセッションを作り直す必要はありません。業務セグメントの競合はアプリ管理者が解消してください。権限は引き続き独立した仕組みで扱われます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## 前提

- 到達可能な `@tansr/serve` サービス（[セッションサービスを 5 分で動かす](/ja/getting-started/serve/)を参照）。ローカル開発では、まずリポジトリ内のサンプル `examples/serve-demo` を起動しても構いません（デフォルト `127.0.0.1:8788`）。
- DevEco Studio 6.0 以上、HarmonyOS SDK API 20 以上。ホスト HAP は `ohos.permission.INTERNET` を宣言します。録音などの権限は、その能力を実際に使うホストが宣言し申請します。
- あなた自身のログインの仕組み：SDK はリクエストごとに `AuthProvider` から短期の認証ヘッダー（通常は `Authorization: Bearer <あなたのログイン token>`）を受け取り、サーバー側の `authenticate` フックがそこから `endUserId` を取り出します。プラットフォームの AppKey、上流モデルのキー、サーバーの署名プライベートキーをクライアントに置かないでください。

## インストール

受け取った独立公開 SDK パッケージから `libs/tansr-harmony-0.1.0.har` を取り出し、同じディレクトリの `SHA256SUMS` を先に照合します。HAR には公式の ABC バイトコードと型宣言が含まれ、SDK 実装の ETS は含みません。バイトコードは絶対的な秘匿を意味しません。業務モジュールへコピーしたあと：

```json
{ "dependencies": { "@tansr/harmony": "file:./libs/tansr-harmony-0.1.0.har" } }
```

アプリの `app.products[].buildOption.strictMode` に `useNormalizedOHMUrl: true` を設定し、`ohpm install` を実行します。アップグレードではバージョン一式のパッケージを差し替え、要約を再照合してください。HAR だけを差し替えたり、要約を書き換えて検査を飛ばしたりしないでください。SDK に外部のランタイム依存はなく、Node.js、React Native、WebView、Android 互換ランタイムは含みません。独立パッケージを受け取れば組み込めます。SDK ソースをビルドする必要はなく、Demo HAP をアプリに埋め込む必要はありません。

## 認証情報：あなた自身のログイン状態だけ

SDK は**認証情報を一切永続化しません**。リクエストごとに `AuthProvider.headers()` からヘッダーを 1 回取得し、使ったら捨てます。本番では `RefreshingAuthProvider` で自分の `CredentialIssuer` を包み、有効期限、同時リフレッシュ、アイデンティティの変化を扱います。リフレッシュ失敗のあとパスワードログインを隠れて再実行しないでください。トークン発行後のアイデンティティ変化はそのインスタンスを破棄します。

```typescript
import { NativeHttpTransport, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient(
  'https://agent.example.com',
  new NativeHttpTransport(),
  new StaticAuthProvider(headers),
);
```

`StaticAuthProvider` は短いデバッグ専用です。デフォルトでは HTTPS が必須で、ループバック HTTP はローカルデバッグだけです。実機が開発マシンのプライベートアドレスへ届くときは `NativeHttpOptions.allowPrivateNetworkHttp` でイントラネット HTTP を明示的にオンにします。通常のパブリックな平文 HTTP は許可せず、TLS 証明書エラーも無視しません。

## 最初のセッション

作成が成功したら、**確定した sessionId を元のログインスコープへ先に書き込み**、それから画面を結びます。保存に失敗した、または応答が未確定ならユーザーへ報告し、自動でもう 1 本つくってはいけません。`verifiedEndUserId` は検証済みのログイン回執から取らねばなりません。

```typescript
import { AgentSession, JsonNode, NativeHttpTransport, SessionHistory,
  SessionView, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient('https://agent.example.com', new NativeHttpTransport(), new StaticAuthProvider(headers));

const created = await client.createSession();
// 已确认的会话 ID 先写入原登录作用域，再绑界面
const session = new AgentSession(client, created.sessionId, verifiedEndUserId);
const view = new SessionView('stream', 'off');
view.onChange = (): void => render(view.state);
session.onHistory = (history: SessionHistory): void => view.restoreHistory(history.messages);
session.onFrame = (eventName: string, data: JsonNode): void => {
  if (!eventName.startsWith('server.')) view.consume(data);
};
session.start();
await session.send('hi');
```

`session.stop()` はローカルの購読とブリッジだけをキャンセルし、リモートセッションは捨てません。`session.start()` が購読を再開します。`close()` がリモートセッションのクローズをリクエストします。フォアグラウンド / バックグラウンド、ログアウト、コンポーネント破棄ではこれらの入口を必ず呼んでください。送信の回執は受け入れだけを意味し、実際の出力はイベントストリームで届きます。

コールドスタートで前回の会話を続けるには、元の sessionId の帰属を調べてから SDK に attach / history / resume を任せます。復旧失敗時は元の ID を残して理由を報告し、forbidden、破損、一時的なネットワーク障害をすべて「新規作成」にまとめてはいけません。

## イベントを見る

`SessionView.state` はすでに還元済みのビュースナップショットです（メッセージ一覧、ツールカード、Todo、使用量、`lastError`）。多くの UI は `onChange` を購読すれば足ります。`onFrame` は生の SSE フレームを届け、`server.*` の制御フレームは `session.bridges` が消費します。通常の `tool.permission.*` イベントで二度目の権限確認を出さないでください。

接続状態は `session.onState` で観察します。`idle` → `connecting` / `recovering` → `live`、瞬断は `retrying`、プロトコルや認証の失敗は `failed`、`close()` のあとは `closed` です。切断は業務コードへ浮かびません。L1 はカーソル付きで再接続し、L2 は gap のあと `/history` から再構築し、L3 はメタ情報が 404 または `live = false` のときに resume します。`lastSeq` は値どおりに継続し、休眠の判定は常に `live = false` です。

## ローカルツールとダイアログ

ローカルツールは `session.bridges.registerTool(declaration, handler)` で登録し、`createSession` / resume では同じ `clientTools` 宣言を渡します。`parameters` は「パラメータ名 → 仕様」の辞書です。パラメータなしは `{}` で、JSON Schema 全体を渡してはいけません。`onPermission` を置かないとデフォルトは拒否です。`server.permission.request` だけが確認を起動し、ユーザー確定後に `answerPermission(id, 'allow' | 'deny')` を呼びます。質問は独立した `onQuestion` / `answerQuestion` で、追記テキストはツール承認ではありません。

```typescript
const declaration = JsonNode.object()
  .set('name', JsonNode.string('searchOrders'))
  .set('description', JsonNode.string('Search the user orders'))
  .set('parameters', JsonNode.object().set('keyword', JsonNode.object()
    .set('type', JsonNode.string('string'))
    .set('description', JsonNode.string('search keyword'))))
  .set('readOnly', JsonNode.boolean(true));
session.bridges.registerTool(declaration, {
  async execute(args, cancel) {
    cancel.throwIfCancelled();
    return JsonNode.object().set('status', JsonNode.string('ok'))
      .set('content', JsonNode.array([
        JsonNode.object().set('t', JsonNode.string('text')).set('text', JsonNode.string(db.search(args.stringAt('keyword')))),
      ]));
  },
});
```

OS のマイク許可とエージェントのツール許可は 2 層であり、一方が他方の代わりにはなりません。サーバーの cwd を任意のローカルパスへ写像しません。

## よくある最初のつまずき

| 現象 | 対処 |
|---|---|
| つなぐとすぐ 401 | `AuthProvider` が返すヘッダーをサーバー側の `authenticate` が認めません。ログイン状態を直してから `start()` します |
| エミュレーター / 実機がつながない | ループバックはローカルデバッグだけです。開発マシンのプライベートアドレスへ届くには `allowPrivateNetworkHttp` が必要です。本番は常に TLS です |
| セッション作成が 400 | `clientTools.parameters` を JSON Schema 全体で書いています。パラメータ名の辞書にしてください |
| 新しいセッションが 429 | エンドユーザーあたり既定で最大 8 本のライブセッションです。使わないセッションは `close()` します |

## 次のステップ

- [HarmonyOS 組み込みガイド](/ja/harmony/)：セッションのライフサイクル、3 段階の復旧、ツールブリッジ、音声の 2 本の鎖、読み上げの二重キャップ、メディアダウンロードの境界。
- [Android と iOS を 5 分で動かす](/ja/getting-started/android/)：3 クライアントの契約を対照します。
- [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)：サーバー側がターン終了の通知をあなたのプッシュバックエンドへ渡す方法。
- [モバイルアプリ向けの公開ネットワークツール](/ja/sdk/platform-bundle/#移动应用的公网工具)：エージェントにウェブページの読み取り、HTTP リクエスト、ウェブ検索をさせる——サーバー側で実行され、デフォルトは無効で、HarmonyOS 側のコード変更は不要です。
