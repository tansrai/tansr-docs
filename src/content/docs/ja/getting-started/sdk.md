---
title: 'Node SDK を 5 分で動かす'
description: '自分の Node.js または Electron プログラムに tansr エージェントを組み込む——@tansr/sdk をインストールし、トークンを取得し、最初のセッションを作ってイベントストリームを表示します。'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - sdk/sessions-and-events
  - sdk/platform-bundle
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/sdk-0.18.1.md
lastVerified: '2026-10-05'
---

`@tansr/sdk` は tansr カーネルの headless な言語バインディングです。prompt を入れるとイベントが流れ出てくる、UI 依存ゼロのライブラリです。クエリループ、ツールスケジューリング、権限エンジン、コンテキスト圧縮はすべてカーネル由来でコンパイル時にインライン化されており、手に入るのは `tansr` CLI と同じランタイムを、ライブラリの形態であなたのアプリに組み込んだものです。本ページは `@tansr/sdk` **0.18.1**（2026-10-04 公開）に基づいて確認しています。プロセス内の `createSession` の使い方は 0.13.0 以降変わっていません。

## アプリケーションプロンプトはどこで設定するか

プラットフォームアプリの `systemPrompt` は共有の役割設定に、SDK の `system` はコードで管理する業務セグメントに使います。デフォルトの `fallback` では、明示した `system`（`[]` を含む）がプラットフォームのセグメントを置き換えます。プラットフォームで `prepend` を選ぶと、先にプラットフォームのセグメントを保持し、その後に SDK のセグメントを追加します。`[]` でもプラットフォームのセグメントは保持されます。ホスト環境の説明は `systemAppend` に置いてください。デフォルトの上書きは発生しません。

Windows の Electron でも SDK はメインプロセスで実行し、renderer が送るのはユーザー入力です。アプリケーションプロンプトとポリシー機能は `@tansr/sdk` 0.13.0 以降で利用できます（プラットフォーム側は 2026-09-14 に本番公開済み）。読み取り専用の `session.applicationPrompt` で出所とポリシーを確認できますが、本文は返しません。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは固定されます。元のセッションと履歴は保持され、セッションを作り直す必要はありません。完全な真理値表、プラットフォームの PUT / GET、実行できるサンプルは[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照してください。

## 前提

タスクの実行中に要件を追加したいときは、[同一ターンへの追加入力](/ja/sdk/midturn-input/)の `getInputTarget` / `submitInput` と受領確認の照会を使います。現在の実行を中断したり、新しいセッションを作ったりする必要はありません。初期版は memory テキストのみで、`@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 / CLI 0.6.0 以降で利用できます。

| 要件 | 値 |
|---|---|
| Node.js | ≥ 22.19 |
| Electron（該当する場合） | ≥ 39。SDK はメインプロセスで実行 |
| モジュール形式 | ESM only（`"type": "module"`。CJS の `require()` は非対応） |
| TypeScript | target ≥ ES2022。Electron プロジェクトでは `skipLibCheck: true` を推奨 |

リリース物は単一ファイルの ESM bundle と単一ファイルの `.d.ts` です。サードパーティのランタイム依存は `undici`、`zod`、`zod-to-json-schema` のみ。オプション依存の `@vscode/ripgrep` はインストールに失敗しても自動でフォールバックするので、対処は不要です。

## インストール

```bash
npm install @tansr/sdk        # 现行 0.18.1
```

0.18.0 以降、パッケージにはサブエントリ `@tansr/sdk/extensions`（アーカイブホスト / キャッシュホスト）と 9 か所の任意のシグネチャ追加が同梱されています。いずれも追加のみで、本ページのルートエントリの使い方と挙動は変わりません。使わないなら読む必要はありません。エージェントをサーバー側に置き、Android / iOS / HarmonyOS や `@tansr/api-client` のような薄いクライアントから HTTP 経由で接続させるには、[`@tansr/serve`](/ja/getting-started/serve/)を使います。新規の統合には統一呼び出し面 `/api` を使ってください。

## 認証情報：モデルの取得元は 3 段階、1 つ選ぶ

SDK がモデルをどこから取得するかで、必要な認証情報が決まります。

| 段階 | 渡すもの | 用途 |
|---|---|---|
| **トークン方式** | `{ token, baseUrl }` | 端末への配布（Electron / デスクトップ）。モデルカタログと機能フラグはプラットフォームがアプリ設定に応じて配信し、ローカル設定はゼロ |
| **マネージド方式（BYOK）** | `model: 'エイリアス'` + ローカルの `.tansr/settings.json` | 自分のサーバー / スクリプト。モデルの API キーを自分で用意 |
| **注入方式** | `{ client, model }` をペアで | テスト（スクリプト化したモデル）またはカスタム接続 |

3 方式は互いに排他で、混在させるとアセンブリ段階で `invalid_options` として拒否されます。このページでは**トークン方式**を例にします。エージェントをエンドユーザーに届けるときの正しい形態だからです。

トークン方式の認証情報フローは「三者クローズドループ」です。

1. コンソールで**デスクトップアプリ**（またはサーバーアプリ）を作成し、`appid` と `appkey` を取得します。appkey はあなたのサーバー側にだけ置きます。
2. 端末アプリは自前のログイン状態であなたのサーバーにリクエストします。あなたのサーバーは appkey で `POST /v1/app-tokens` を呼び出し、そのユーザー向けに短期の `app_user` トークン（`ttlSeconds` 60–86400）を発行し、`{ token, expiresAt }` だけを端末に返します。
3. 端末アプリはこのトークンを SDK に渡します。

公式サンプル `examples/token-server` に、トークン発行エンドポイントの完全な書き方（リクエスト署名を含む）があります。**appkey は決してあなたのサーバーの外に出さない**——端末に配らない、ログに書かない、エラーレスポンスに入れない、リポジトリに入れない。

自分のマシンでスクリプトを動かすだけなら、まずマネージド方式でも構いません。`.tansr/settings.json` に provider を宣言し（API キーは環境変数名だけを書き、値は環境変数で渡す）、`createSession({ model: 'main' })` を呼びます。

## 最初のセッション

```ts
import { createSession } from '@tansr/sdk';

// token 由你的服务端换发;baseUrl 是平台网关地址
const session = await createSession({ token, baseUrl: 'https://api.tansr.com' });

session.send('帮我总结这份合同');

for await (const event of session.events) {
  if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  if (event.type === 'turn.completed') break;
}

session.close();
```

要点：

- `createSession` は async です。常に `await` してください。
- `send()` はアイドル時に新しいターンを開始します。実行中にもう一度 `send()` すると、カーネルの注入バリアを経由して現在のターンに合流し、入力は失われません。
- `events` はターンをまたいで連続し、`seq` が単調増加する `AsyncIterable<KernelEvent>` です。複数のコンシューマーが同時に `for await` でき、それぞれが全量を受け取ります。
- `close()` は冪等です。`close()` を呼ばないと `for await` は自然に終了しません——これが「イベントストリームが止まったまま」の最も多い原因です。

## イベントを見る

イベントはフラットな discriminated union なので、`event.type` で直接分岐できます。最初に動かすときは、型をすべて出力して 1 ターンの中で何が起きるかを見てみるのがおすすめです。

```ts
for await (const event of session.events) {
  console.log(event.seq, event.type);
}
```

おおよそ次のような並びが見えます：`session.created` → `turn.started` → いくつかの `msg.block.start` / `msg.text.delta` / `msg.block.end` →（ツール呼び出しがあれば）`tool.proposed` / `tool.permission.decided` / `tool.started` / `tool.completed` → `cost.usage.updated` → `turn.completed`。

UI を作るなら、イベントを手で組み立てないでください。`createSessionView` でイベントストリームを不変のビュースナップショットに還元し、`createNarrator` で人間が読めるログ行を生成します。どちらもパッケージに同梱されています。

## 最初によくつまずく点

| 現象 | 原因と対処 |
|---|---|
| `invalid_options` が投げられる | 3 方式のフィールドを混在させた、またはトークン方式で `config` / `capabilities` を渡した（トークン方式の機能フラグは常にプラットフォームが管理）。メッセージを読んでコードを直す |
| `assembly_failed` が投げられる | マネージド方式の設定が使えない、エイリアスの解決に失敗した、またはトークン方式で bundle の取得に失敗した。`cause` に下層のエラーが残る |
| ツールがすべて拒否される | `permission.askUser` を接続しておらず、ツールが読み取り専用でない——デフォルトは fail-closed。[セッションとイベントストリーム](/ja/sdk/sessions-and-events/)を参照 |
| イベントストリームが終了しない | `session.close()` を忘れている |

## 次のステップ

- [セッションとイベントストリーム](/ja/sdk/sessions-and-events/)：マルチターンのセマンティクス、イベントファミリー、SessionView への投影。
- [チェックポイントと再開](/ja/sdk/checkpoints/)：永続化、再起動をまたいだ再開、手動の圧縮とスナップショット。
- [プラットフォームアセンブリとバンドル](/ja/sdk/platform-bundle/)：機能フラグ、ツールの 3 リング、トークン方式で配信されるもの。
- [エラー処理と再試行](/ja/sdk/errors-and-retries/)：SDK のエラーコード、プラットフォームのエラーコード、再試行すべきものとすべきでないもの。
- [SDK 2.0 拡張エントリ](/ja/sdk/sdk2-preview/)：0.18.x で公開済みの `@tansr/sdk/extensions`、`@tansr/serve/extensions`、統一呼び出し面 `/api` の公開状況、境界、性能の開示。プロセス内統合に移行は不要です。
