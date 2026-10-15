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
  - getting-started/harmony
  - sdk/sdk2-preview
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-15'
---

`@tansr/serve` は tansr の **Agent セッションエンジン**です。npm パッケージとしてあなた自身の Node サービスに組み込み、外向きにはマルチセッションの REST + SSE プロトコル面——統一呼び出し面 `/api`（0.13.0 以降 GA）と、その背後の `/v2` セッションプロトコル——を公開し、内向きにはあなたのアプリキーで tansr プラットフォームに接続して実際にモデルを呼び出します。これは**ゲートウェイではありません**——ユーザーのログイン方法、レート制限、課金はすべてあなた自身の仕組みに属し、エンジンはトランスポート、プロトコル、セッションのガバナンスだけを担います。本ページは `@tansr/serve` **0.15.1**（2026-10-10 公開、現在の npm `latest`）に基づいて確認しています。

Android 0.5.0、iOS 0.4.0、HarmonyOS HAR 0.2.0 以降の公開モバイル SDK は `/api` だけを使い、それより前の公開パッケージは引き続き `/v2` を使います。Node 側の薄いクライアントは `@tansr/api-client` 0.4.0（サブエントリ `./api`。2026-10-06 公開で、このバージョンから凍結サブエントリ `./sdk2` / `./terminal` も `routePrefixes` を渡さなければデフォルトで `/api` を叩きます）です。**新規の統合は直接 `/api` を使ってください**。同じセッション、同じペイロードのバイト列に、4 つの `tansr-*` レスポンスヘッダーと統一エラーエンベロープが加わります。`/v2` は 0.13.0 以降「内部アダプターの入口」と定義され、1.0.0 で外部入口が削除されます。0.15.0 以降、旧プレフィックス `/v2`、`/v3/*` のレスポンスには `Deprecation` / `Link` の廃止ヘッダーが付きますが、旧プレフィックスのウィンドウは 0.15.1 時点でもデフォルトは `readwrite`（読み書きとも従来どおり受け付け）なので、すでに本番で動いている `/v2` 呼び出しを今すぐ変える必要はありません。ウィンドウのノブとスケジュールは[デプロイと認証](/ja/serve/deploy-and-auth/)を参照してください。

## プラットフォームまたはホストでアプリの役割を設定する

モバイル向けのシステムプロンプトはプラットフォームのアプリ設定、または serve ホストで設定し、`/v2` の `prompt` には入れません。`platform.system` を省略するとプラットフォームのデフォルトを使います。コードで管理する業務セグメントは `platform.system` に、ホストの補足説明は `platform.systemAppend` に置きます。デフォルトの `fallback` では、明示した業務セグメント（`[]` を含む）がプラットフォームのセグメントを置き換えられます。`prepend` では SDK のセグメントが `[]` であっても、プラットフォームのセグメントを先頭に保持します。

これらのオプションは `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。これらはテキストの組み合わせだけを制御し、権限の代わりにはなりません。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、現在実行中のターンは既存の設定を維持します。既存のセッション、attach、履歴は引き続き使え、役割を変えるためにセッションを作り直す必要はありません。[アプリケーションシステムプロンプトと SDK の結合ポリシー](/ja/sdk/system-prompts/)にある serve の完全な例を参照してください。

## 前提

- Node.js ≥ 22.19。
- コンソールで**モバイルアプリ**（Android / iOS / HarmonyOS 向け）またはサーバーアプリを作成し、`appid` と `appkey` を取得しておく。
- あなた自身のログイン状態の仕組み：エンジンが必要とするのは、1 つのリクエストを 1 つの `endUserId` に対応付けることだけで、それ以外には関与しません。

## インストール

```bash
npm install @tansr/serve        # 现行 0.15.1
```

唯一のサードパーティランタイム依存は `zod` です。tansr の内部パッケージはコンパイル時にインライン化されており、あなたの依存ツリーには現れません。0.13.0 以降、パッケージにはサブエントリ `@tansr/serve/extensions`（SDK2 のアーカイブ / キャッシュ / ターミナルサービスのホスト。明示的な組み立てが必要）と `@tansr/serve/process` も同梱されていますが、本ページのルートエントリの使い方はそれらに依存しません。

## 認証情報：appid / appkey はサーバー側に置く

セッションサービスの認証は 3 層に分かれます。所属を覚えておけば置き場所を間違えません。

| 層 | 認証情報 | 所属 |
|---|---|---|
| クライアント ↔ セッションサービス（`/api`、`/v2`） | あなたが定義したログイン状態の token（JWT、session cookie、OAuth のいずれでも可） | 完全にあなたのもの。エンジンは `authenticate` フックを通じて `endUserId` を受け取るだけ |
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
  token: process.env.MY_V1_TOKEN!, // /v1 面的 Bearer;fail-closed 必填;v2 在场时 /v1 缺省关闭,与 /api、/v2 鉴权互不相通
  createSession: build.factory,
  version: '1.0.0',
  v2: { // v2 在场 = 同时装配 /api 门面与 /v2 内部入口
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

まず出来合いのサンプルでプロトコルを見たい？リポジトリ内のサンプル `examples/serve-demo` の `pnpm start`（`pnpm real` と同じ）は実モデルのエントリ `agent-real.ts` を実行し、`examples/serve-demo/.env` から `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`（任意で `TANSR_API_BASE`）を読みます。資格情報がなければ終了し、エコーにはフォールバックしません。常駐スイッチを設定しない場合は 1 ターンのスモークを自動実行して終了するだけです。curl やモバイル端末との連携のために常駐サーバーを立てるには、`.env` に `DEMO_SERVE_ONLY=1` を加え、ポートは `DEMO_PORT` で指定します（ソースのデフォルトは `8799`、サンプルの README は `8788` を使用）。エコー Agent は 2026-09-14 以降リポジトリ内のテスト用フィクスチャに過ぎず、公開のオフライン起動コマンドはありません。

## 最初のセッション

curl でそのまま一巡してみましょう。`<あなたのログイン token>` は、あなた自身の仕組みが発行し、`authenticate` が検証できるトークンです。以下では統一呼び出し面 `/api` を使います。`/api/sessions` を `/v2/sessions` に置き換えても同じセッション、同じレスポンスボディが得られます（4 つの `tansr-*` レスポンスヘッダーが付かず、エラーボディは旧エンベロープになります）。

まず、このサービスに何が組み立てられているかを確認します（manifest revision 7。`@tansr/serve` 0.14.0 以降で、0.15.1 でも変更なし）：

```bash
curl -s http://127.0.0.1:8787/api/manifest -H "Authorization: Bearer <你的登录 token>" -D - -o /dev/null
# tansr-contract: unified-v1 / tansr-manifest-revision: 7 / tansr-domain: discovery / tansr-schema-hash: …
```

セッションを作成（最初の prompt 付き）：

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

続きの入力：

```bash
curl -s -X POST http://127.0.0.1:8787/api/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

`202 { "sessionId", "accepted": true }` が返ります。失敗時、`/api` は統一エンベロープ `{ "contract": "unified-v1", "code", "status", "retryAction", "detail": { "domainCode", … } }` を返します。1 つの `switch (code)` ですべてのドメインを扱え、元の `/v2` コードが必要なら `detail.domainCode` を読みます。

## イベントを見る

SSE イベントストリームを購読します。

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

最初のフレームは `retry: 3000` で、その後はカーネルイベント 1 件につき 1 フレーム：`id: <seq>` と `data: <KernelEvent JSON>` で、`event:` 名は付きません。制御フレーム（ツール要求、権限要求、質問）だけが `event: server.*` 名を持ちます。15 秒ごとに `: hb` コメントのハートビートが 1 件流れます。フレームのバイト列は `/v2` と同一です。リクエストヘッダー `tansr-event-envelope: unified-v1` をさらに付けたときだけ、`data:` が 7 キーの統一イベントエンベロープに書き換えられます（元のイベントは `raw` に入ります）。

切断後は最後に消費した seq を付けて再接続すると、サーバーはリングバッファから切断点以降のイベントを再送します。

```bash
curl -N http://127.0.0.1:8787/api/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

`lastSeq` は復旧のアンカーで、端末側は常に**値のまま続きから購読**します。新規セッションは `0` を返し、休眠中のセッション（`live: false`）に対する `GET /v2/sessions/:id` は永続化された実際の水位を返し、resume 後の新しい紀元はその水位 + 1 から続きます（この 2 点は `@tansr/serve` 0.9.0 以降の挙動です。0.8.x はどちらも `0` を返します）。休眠判定は `live` で行い、`lastSeq === 0` で判定しないでください。古すぎる `Last-Event-ID` で再接続すると `server.replay.gap` フレーム（`reason: 'evicted'`）を受け取ります。その場合は投影を捨て、`/history` から再構築します。3 段階の復旧チェーンは[v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)を参照。

## CLI 形態の serve

`tansr serve --token <値>` でも常駐サービスを起動できますが、これは単一運用者向けの `/v1` 面（`POST /v1/sessions`、`GET /v1/sessions/:id/events` などの 6 エンドポイント、同じ 1 つの Bearer token）で、オーケストレーションシステムからの接続に向いており、マルチテナントのプロダクトバックエンドではありません。`tansr serve --v2` は `/v2` 面も CLI 形態に載せるもので（**tansr CLI 0.6.0 以降で利用できます**）、0.10.0 以降は `/api` ファサードも同時に組み立てます。`--v2` がある構成では `/v1` 面がデフォルトで無効になります——どうしても残す場合の `--legacy-v1` / `TANSR_SERVE_LEGACY_V1=1` は 0.10.1 以降は非推奨です（`server.deprecated_option` の警告を出し、1.0.0 で削除）。CLI 形態の現行は **0.10.3**（npm `@tansr/cli`、2026-10-10。`@tansr/serve` 0.15.1 と同じサービス実装をインライン化しており、0.10.2 / 0.10.3 でコマンドやフラグの追加はありません）です。SDK2 のアーカイブ / キャッシュ / ターミナルサービスのホストは、CLI 形態では `--host-module <absolute.cjs> --host-module-sha256 <sha256>` 経由でのみ利用できます。上記の `@tansr/serve` npm 組み込み形態（0.8.0 以降、現行 0.15.1）も引き続き利用できます。

## 次のステップ

- [デプロイと認証](/ja/serve/deploy-and-auth/)：認証フック、`/v1` のデフォルト無効化と旧プレフィックスのスケジュール、グレースフルシャットダウン、観測エンドポイント、複数レプリカでのシャーディング。
- [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)：エンドポイントの全形、3 段階の復旧チェーン、ターン終了時のアウトバウンド通知と署名。
- [保持期間とガバナンス](/ja/serve/retention-and-governance/)：保持ウィンドウ、アイドル回収、同時実行数の上限、セッションストレージ、0.14.0 の 3 つのリクエストヘッダー。
- [環境変数一覧](/serve/env)：すべての `TANSR_SERVE_*` ノブ。
- [SDK 2.0 拡張エントリ](/ja/sdk/sdk2-preview/)：`@tansr/serve/extensions` の明示的なホスト、`@tansr/api-client` 0.4.0、性能の開示。
