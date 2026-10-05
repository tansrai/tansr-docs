---
title: ディスカバリーと能力クロージャ
description: 起動時に先に呼ぶ 3 つのディスカバリーエンドポイント GET /api/manifest、GET /api/capabilities、セッション単位の GET /api/sessions/:id/capabilities のセマンティクス。closureId の計算方法と tansr-closure-id 事前条件。enabled / disabled / unavailable の 3 状態に対応する応答。マニフェストのリビジョンがずれたときにクライアントがすべきこと。
zone: docs
category: unified-api
sidebar:
  order: 3
related:
  - unified-api/surface
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/clients
  - serve/deploy-and-auth
  - errors/codes
sources:
  - tansr-cli:packages/server/src/api/facade.ts
  - tansr-cli:packages/server/src/api/closure.ts
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
lastVerified: '2026-10-05'
---

`/api` の能力は**発見可能**です。マニフェストはこのバージョンのサーバーがどの操作を定義しているかを、デプロイ単位の能力はこのサーバーがどのドメインを組み込んでいるかを、セッション単位の能力クロージャはあるセッションの中で、現在の認可のもと、今どの操作が通るかを教えてくれます。3 つのエンドポイントはいずれも読み取り専用で、認証が必要で、ナビゲート可能な URL を一切返しません。

## 3 つのディスカバリーエンドポイント

| 操作 | パス | 答える問い | レスポンスの要点 |
|---|---|---|---|
| `discovery.manifest` | `GET /api/manifest` | このサーバーのバージョンは何を定義しているか | マニフェスト全体（`format: tansr-api-manifest-v1`、`revision`、`schemaHash`、`families`、`operations`、`capabilities`、`platformApi`）に加えて `runtime.installed`（各ドメインが組み込まれているか。セッションドメインは優先ファミリー名または `null`） |
| `discovery.capabilities` | `GET /api/capabilities` | このサーバーは何を組み込んでいるか | `{ contract, manifestRevision, schemaHash, domains }`。各ドメインに `installed`、`contract`（ファミリー名）、`status`、`schemaHash` があり、セッションドメインにはさらに `family: { preferred, available }` がある |
| `discovery.session.capabilities` | `GET /api/sessions/:id/capabilities` | このセッションで今何ができるか | 能力クロージャ（次の節）。レスポンスヘッダー `tansr-closure-id` と本文の `closureId` は同じ値 |

共通の規律：

- `GET` だけを受け付けます。ほかのメソッドは 405 `method_not_allowed`（`allow: GET` 付き）です。
- クエリ文字列とリクエスト本文を受け付けません。付けると 400 `invalid_request` です。
- レスポンスは `cache-control: no-store` を持ちます。起動や再接続のたびに再発見し、ディスクにキャッシュしないでください。
- 3 つのエンドポイントの `tansr-domain` はいずれも `discovery` で、`tansr-schema-hash` は集約されたマニフェストの `schemaHash` です。ほかのドメインのレスポンスではこのヘッダーはそのファミリーのソースファイルのダイジェストであり、マニフェストの集約値とは比較できません。
- レスポンス本文には URL、`href`、`links` のようなナビゲーションフィールドは**ありません**。パスはマニフェストのテンプレートとパスパラメータからクライアント側でだけ組み立てます。

## セッション単位の能力クロージャ

クロージャ（capability closure）は、サーバーが「このセッション、このユーザー、今この瞬間」について操作の利用可否を決定論的にスナップショットしたものです。

```json
{
  "contract": "unified-v1",
  "closureId": "<sha256 hex>",
  "authorizationRevision": "<string or null>",
  "domains": {
    "session": { "installed": true, "revision": "<family revision>" },
    "archive": { "installed": false, "revision": null }
  },
  "operations": {
    "session.message.send": "enabled",
    "session.audio.speak": "disabled",
    "archive.binding.create": "unavailable"
  }
}
```

- `operations` は 77 の操作を網羅します（マニフェスト revision 7 の 81 操作から 3 つのディスカバリーエンドポイントとデプロイ単位の `session.capabilities`、すなわち `GET /api/capabilities/sessions` を除いたもの）。各操作は 3 状態のいずれかを取ります。
  - `enabled`：クロージャ内で、呼び出せる。
  - `disabled`：能力はこのサーバー上に存在するが、現在の認可やセッションの状態が許していない（たとえばセッションが終了している、必要な能力が付与されていない、アーカイブバインディングがまだ書き込み可能なエポックに入っていない）。
  - `unavailable`：このサーバーまたはこのセッションの境界にその能力が存在しない（ドメインが組み込まれていない、音声 / 入力ソースが配線されていないなど）。
- `closureId = sha256(UTF8('tansr.unified.closure.v1') ‖ 0x00 ‖ canonical({ authorizationRevision, domains, operations }))` で、`canonical` は `@tansr/protocol/canonical` の厳密な JSON エンコードです。クライアントは照合のためにローカルで再計算できますが、クロージャを自分で導く必要はありません。クロージャの内容は常にサーバーの応答が正です。
- セッションが存在しない、または現在のユーザーのものでない場合は 404 `not_found` で、2 つのケースは区別されません。セッションドメインが組み込まれていない、またはクロージャのソースが配線されていない場合は `capability_unavailable`（`detail.reason: not_installed`）、クロージャのソースが一時的に利用できない場合は 503 `upstream_unavailable`（`retry-after` 付き）です。

## `tansr-closure-id` を書き操作の事前条件にする

クロージャを取得したら、**セッション内の書き操作**にリクエストヘッダー `tansr-closure-id: <closureId>` を付けます。サーバーはドメインハンドラーに委譲する前に 2 つのことを確かめます。

| 照合 | 通らなかったときの応答 |
|---|---|
| リクエストヘッダーの `closureId` が現在のクロージャと等しいか | 412 `precondition_failed`、`retryAction: rediscover`、`detail.domainCode: closure_stale`。レスポンスヘッダー `tansr-closure-id` が現在の値をそのまま示す |
| その操作が現在のクロージャで `enabled` か | `disabled` なら 403 `capability_unavailable`、`unavailable` なら 404 `capability_unavailable`。どちらも `detail` は `{ reason: 'outside_closure', operation, state, closureId }` |

3 点に注意してください。

- このヘッダーはセッション内の書き操作にだけ意味があります。`GET` / `HEAD` に付けたり、セッション外のパス（たとえば `POST /api/executors/connections`）に付けたりすると 400 `invalid_request`（`detail.header: tansr-closure-id`）です。
- このヘッダーがなければサーバーはクロージャの照合を行わず、ドメインハンドラーが引き続き最終的な権威です。ハンドラーは自身のサブ契約に従って越権リクエストを拒否します。クロージャはクライアントが統一された形の拒否を**先に**受け取るためのものであり、どの検証も緩めません。
- 412 を受け取ったときの正しい動作は 1 つだけです。もう一度 `GET /api/sessions/:id/capabilities` を呼び、新しい `closureId` で再試行します。推測しない、古い値を使い続けない、旧プレフィックスに戻らない。

## リビジョンのずれ

すべての `/api` レスポンスは `tansr-manifest-revision` を持ちます。公式クライアントは生成時に使ったリビジョンと `schemaHash` をビルド時にロックしており（たとえば `@tansr/api-client/api` は `client.locked` として公開し、実行時の観測値は `client.observed()`）、実行時にサーバーのリビジョンがロックした値と異なると分かった場合は次のようにします。

- **記録するだけで、ロジックは切り替えない。** リビジョンの前進は加算的（新しい操作、新しいフィールド）です。古いクライアントは自分のカタログに従って呼び続け、持っていない操作はクロージャで `unavailable` と表示されるか、呼び出し時に `capability_unavailable` / `not_found` が返ります。
- これを理由にパーサーを変えないでください。旧プレフィックスを「試して」もいけません。それこそが規律の第 1 条が禁じる黙ったダウングレードです。
- 新しい操作が必要なら、そのリビジョンに対応するバージョンへクライアントをアップグレードしてください（`@tansr/api-client` 0.3.0 は revision 7 に整合）。

`@tansr/api-client/api` は `onContract` コールバックを提供しており、すべてのレスポンスの `{ manifestRevision, schemaHash, domain }` がそこを通ります。障害調査のログにつなぐのに向いています。
