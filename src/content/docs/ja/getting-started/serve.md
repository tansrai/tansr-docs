---
title: 'セッションサービスを 5 分で動かす'
description: '@tansr/serve を使って自分の Node サービス内でマルチユーザーのエージェントセッションサービスを立ち上げる——認証フックを接続し、アプリキーを設定し、最初の /v2 セッションを作成して curl で SSE イベントストリームを確認します。'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - serve/deploy-and-auth
  - serve/v2-and-webhooks
  - serve/retention-and-governance
  - serve/env
  - getting-started/android
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-09-15'
---

`@tansr/serve` は tansr の **Agent セッションエンジン**です。npm パッケージとしてあなた自身の Node サービスに組み込み、外向きには `/v2` のマルチセッション REST + SSE プロトコル面を公開し、内向きにはあなたのアプリキーで tansr プラットフォームに接続して実際にモデルを呼び出します。これは**ゲートウェイではありません**——ユーザーのログイン方法、レート制限、課金はすべてあなた自身の仕組みに属し、エンジンはトランスポート、プロトコル、セッションのガバナンスだけを担います。

Android / iOS SDK が接続するのはこのサービスです。

## プラットフォームまたはホストでアプリの役割を設定する

モバイル向けのシステムプロンプトはプラットフォームのアプリ設定、または serve ホストで設定し、`/v2` の `prompt` には入れません。`platform.system` を省略するとプラットフォームのデフォルトを使います。コードで管理する業務セグメントは `platform.system` に、ホストの補足説明は `platform.systemAppend` に置きます。デフォルトの `fallback` では、明示した業務セグメント（`[]` を含む）がプラットフォームのセグメントを置き換えられます。`prepend` では SDK のセグメントが `[]` であっても、プラットフォームのセグメントを先頭に保持します。

これらのオプションは `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。これらはテキストの組み合わせだけを制御し、権限の代わりにはなりません。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは既存の設定を維持します。既存のセッション、attach、履歴は引き続き使え、役割を変えるためにセッションを作り直す必要はありません。[アプリケーションシステムプロンプトと SDK の結合ポリシー](/ja/sdk/system-prompts/)にある serve の完全な例を参照してください。

## 前提

- Node.js ≥ 22.19。
- コンソールで**モバイルアプリ**（Android / iOS 向け）またはサーバーアプリを作成し、`appid` と `appkey` を取得しておく。
- あなた自身のログイン状態の仕組み：エンジンが必要とするのは、1 つのリクエストを 1 つの `endUserId` に対応付けることだけで、それ以外には関与しません。

## インストール

```bash
npm install @tansr/serve
```

唯一のサードパーティランタイム依存は `zod` です。tansr の内部パッケージはコンパイル時にインライン化されており、あなたの依存ツリーには現れません。

## 認証情報：appid / appkey はサーバー側に置く

セッションサービスの認証は 3 層に分かれます。所属を覚えておけば置き場所を間違えません。

| 層 | 認証情報 | 所属 |
|---|---|---|
| クライアント ↔ セッションサービス | あなたが定義したログイン状態の token（JWT、session cookie、OAuth のいずれでも可） | 完全にあなたのもの。エンジンは `authenticate` フックを通じて `endUserId` を受け取るだけ |
| セッションサービス ↔ tansr プラットフォーム | `appid` + `appkey` | サービスプロセスが保持。エンジンはこれを使って各エンドユーザー向けに `app_user` トークンを発行する |
| クライアントが保持する `appid` | 公開のアプリ識別子 | 配布可能。認証情報ではない |

レッドラインは 3 つ：appkey は決して端末に配らない。`app_user` トークンは決してセッションサービスの外に出さない。セッション id は認証要素ではない（各エンドポイントが独立に所属を検証する）。

appid / appkey は環境変数に入れます（名前は自由。例では公式サンプルの `TANSR_APP_KEY_ID` / `TANSR_APP_KEY` を踏襲）。コードやリポジトリには書かないでください。

## 最初のサービス

動く最小の骨格——認証フック、組み込みの実アセンブリ、セッションのディスク永続化、起動：

```ts
import {
  createAgentSessionFactory,
  createServeAgentSessionStore,
  registerBuiltinLocales,
  startServer,
} from '@tansr/serve';

registerBuiltinLocales(); // 可选:错误体文案本地化

// 真装配:appid/appkey → 每个终端用户一枚短期令牌 → 内核查询环真调模型
const build = createAgentSessionFactory({
  platform: {
    apiBaseUrl: 'https://api.tansr.com',
    appId: process.env.TANSR_APP_KEY_ID!,
    appKey: process.env.TANSR_APP_KEY!, // 恒不下发端、恒不入日志
  },
  store: createServeAgentSessionStore({ dir: '/var/lib/my-agent/sessions' }), // 生产恒接
  cwd: process.cwd(),
});

const server = await startServer({
  host: '127.0.0.1',
  port: 8787,
  token: process.env.MY_V1_TOKEN!, // /v1 面的 Bearer;与 /v2 鉴权互不相通
  createSession: build.factory,
  version: '1.0.0',
  v2: {
    // 唯一鉴权面:你的登录态 → endUserId;返回 null 即 401
    authenticate: async (req) => {
      const user = await myAuth.verify(req.headers['authorization']);
      return user ? { endUserId: user.id } : null;
    },
    createSession: build.factory,
    store: build.storeReader, // 让休眠会话可列表 / 可 resume
  },
});
```

`store` は必ず接続してください。接続しないと、プロセスが再起動した瞬間にすべてのアクティブセッションのコンテキストが完全に失われ、クライアントの `resume` は常に `409 resume_unavailable` になります。

プロセスシグナルはホストの責任です。エンジンはあなたの代わりに SIGTERM を監視しません。少なくとも `server.drain({ timeoutMs: 30_000 })` を接続してから終了してください。詳細は[デプロイと認証](/ja/serve/deploy-and-auth/)を参照。

実プラットフォームに接続せず、まずオフラインでプロトコルを見たい？リポジトリ内のサンプル `examples/serve-demo` は、エコー Agent で `/v2` プロトコル層全体を疎通させています。サービス起動はコマンド 1 つ：`pnpm --filter tansr-example-serve-demo start`。デフォルトで `127.0.0.1:8788` を待ち受けます。

## 最初のセッション

curl でそのまま一巡してみましょう。`<あなたのログイン token>` は、あなた自身の仕組みが発行し、`authenticate` が検証できるトークンです。

セッションを作成（最初の prompt 付き）：

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

続きの入力：

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

`202 { "sessionId", "accepted": true }` が返ります。

## イベントを見る

SSE イベントストリームを購読します。

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

最初のフレームは `retry: 3000` で、その後はカーネルイベント 1 件につき 1 フレーム：`id: <seq>` と `data: <KernelEvent JSON>` で、`event:` 名は付きません。制御フレーム（ツール要求、権限要求、質問）だけが `event: server.*` 名を持ちます。15 秒ごとに `: hb` コメントのハートビートが 1 件流れます。

切断後は最後に消費した seq を付けて再接続すると、サーバーはリングバッファから切断点以降のイベントを再送します。

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

`lastSeq` は復旧のアンカーで、端末側は常に**値のまま続きから購読**します。新規セッションは `0` を返し、休眠中のセッション（`live: false`）に対する `GET /v2/sessions/:id` は永続化された実際の水位を返し、resume 後の新しい紀元はその水位 + 1 から続きます（この 2 点は `@tansr/serve` 0.9.0 以降の挙動です。0.8.x はどちらも `0` を返します）。休眠判定は `live` で行い、`lastSeq === 0` で判定しないでください。古すぎる `Last-Event-ID` で再接続すると `server.replay.gap` フレーム（`reason: 'evicted'`）を受け取ります。その場合は投影を捨て、`/history` から再構築します。3 段階の復旧チェーンは[v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)を参照。

## CLI 形態の serve

`tansr serve --token <値>` でも常駐サービスを起動できますが、これは単一運用者向けの `/v1` 面（`POST /v1/sessions`、`GET /v1/sessions/:id/events` などの 6 エンドポイント、同じ 1 つの Bearer token）で、オーケストレーションシステムからの接続に向いており、マルチテナントのプロダクトバックエンドではありません。`tansr serve --v2` は `/v2` 面も CLI 形態に載せるもので、**tansr CLI 0.6.0 以降で利用できます**。上記の `@tansr/serve` npm 組み込み形態（0.8.0 以降、現行 0.11.0）も引き続き利用できます。

## 次のステップ

- [デプロイと認証](/ja/serve/deploy-and-auth/)：認証フック、グレースフルシャットダウン、観測エンドポイント、複数レプリカでのシャーディング。
- [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)：エンドポイントの全形、3 段階の復旧チェーン、ターン終了時のアウトバウンド通知と署名。
- [保持期間とガバナンス](/ja/serve/retention-and-governance/)：保持ウィンドウ、アイドル回収、同時実行数の上限、セッションストレージ。
- [環境変数一覧](/serve/env)：すべての `TANSR_SERVE_*` ノブ。
