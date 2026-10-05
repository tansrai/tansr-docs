---
title: 統一 API 契約（/api）の概要
description: '@tansr/serve 0.13.0 以降、/api はセッションサービス唯一の公開 HTTP 呼び出し面です（契約名 unified-v1）。このページでは 3 層の契約、各バージョンの到達日、最短で動く例、開発者の 7 つの規律を示し、ディスカバリーと能力クロージャ、統一ヘッダーとエラーエンベロープ、イベントエンベロープ、移行、各言語クライアントへ案内します。'
zone: docs
category: unified-api
sidebar:
  order: 1
related:
  - unified-api/surface
  - unified-api/discovery-and-closure
  - unified-api/headers-and-errors
  - unified-api/events
  - unified-api/migration
  - unified-api/clients
  - serve/v2-and-webhooks
  - getting-started/serve
  - releases/serve
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:packages/server/contract/api-manifest.json
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/api-client/CHANGELOG.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api` は `@tansr/serve` が外部に公開する**唯一**の HTTP 呼び出し面です。セッション、実行、アーカイブ、キャッシュ、ターミナルなどすべてのドメインがこの 1 つのプレフィックスの下にあり、同じリクエストヘッダー、レスポンスヘッダー、エラーエンベロープ、イベントエンベロープを共有します。契約名は `unified-v1` で、`@tansr/serve` 0.13.0（2026-10-02 リリース）から正式に利用できます。それ以前のドメインごとに分かれていた `/v2`、`/v3/sdk2`、`/v3/terminal*` はプロセス内に残っていますが、内部アダプターの入口としてだけ使われます。`/v1` は `/api` を組み込んだデプロイでは既定でオフです。

セッションサービスに初めて触れるなら、まず[セッションサービスを 5 分で動かす](/ja/getting-started/serve/)でサーバーを起動してからここに戻ってください。すでに `/v2` プロトコルを使っているなら、そのまま[移行と廃止のタイムテーブル](/ja/unified-api/migration/)へ進んでください。

## 3 層の契約

| 層 | 内容 | 何が決めるか |
|---|---|---|
| 共通エンベロープ（Common Envelope） | リクエストヘッダー、レスポンスヘッダー、統一エラーエンベロープ、統一イベントエンベロープ、冪等性と事前条件のセマンティクス | この章の各ページ。ワイヤー上の形は `doc/rfc/unified-v1.schema.json` と 165 本のゴールデンベクターが正 |
| 能力マニフェスト（Capability Manifest） | パステンプレート、メソッド、クエリキー、読み / 書き / ストリームの分類、能力項目と上限値 | `packages/server/contract/api-manifest.json`（現在 revision 7） |
| ドメインサブ契約（Domain Subcontracts） | 各ドメインのリクエスト / レスポンス本文、イベントペイロード、ドメイン内エラーコード | `agent-session-v1`、`sdk2-ext-v1`、`terminal-services-v1` など 11 のファミリー |

3 層の分担は固定です。共通エンベロープは**どう呼ぶか**を、能力マニフェストは**何を呼べるか**を、ドメインサブ契約は**本文に何が入るか**を決めます。`/api` はどのドメインサブ契約の成功レスポンス本文も書き換えません。同じ操作を `/api` 経由で呼んでも旧プレフィックス経由で呼んでも 2xx 本文はバイト単位で同一で、変わるのはヘッダー、エラーの形、そして（明示的に交渉した場合の）イベントフレームの外形だけです。

## 1 回の呼び出しはこう見える

```http
POST /api/sessions/0a1b2c3d/messages HTTP/1.1
Authorization: Bearer <short-lived token>
Content-Type: application/json
tansr-closure-id: 9f3c…e1

{"prompt":"hi"}
```

```http
HTTP/1.1 202 Accepted
tansr-contract: unified-v1
tansr-manifest-revision: 7
tansr-domain: session
tansr-schema-hash: sha256:6e1876ed…
content-type: application/json

{"sessionId":"0a1b2c3d","accepted":true}
```

すべての `/api` レスポンス（2xx と SSE のオープンを含む）は `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash` の 4 つのヘッダーを持ちます。どれか 1 つでも欠けていれば、クライアントは解析を続けずに「契約が利用できない」と判断すべきです。詳しくは[統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/)を参照してください。

## 各バージョンの到達日

| リリース | 日付 | `/api` に関わる変更 |
|---|---|---|
| `@tansr/serve` 0.13.0 | 2026-10-02 | `/api` が正式に利用可能。統一エラーエンベロープ（19 の統一コード、6 種の `retryAction`）。明示的に交渉する 7 キーのイベントエンベロープ。ディスカバリーエンドポイントとセッション単位の能力クロージャ。`/api` を組み込んだデプロイでは `/v1` が既定でオフ（ライブラリのオプション `disableV1`、CLI は `tansr serve --legacy-v1` または `TANSR_SERVE_LEGACY_V1=1` で移行期間中は維持） |
| `@tansr/protocol` 0.2.0 | 2026-10-02 | 初の公開リリース。`@tansr/protocol/canonical` エントリ（厳密な JSON の canonical エンコード / デコードとドメインダイジェスト） |
| `@tansr/serve` 0.14.0 | 2026-10-04 | マニフェスト revision 7：81 操作、`approval.credential.submit`（`POST /api/approvals/:id/credential`）を追加、許可 / 質問への応答が `:ticketId` プレースホルダーに変更。3 つのリクエストヘッダー `Idempotency-Key`、`If-Match`（`ETag` と対）、`deadline` を配線。`--legacy-v1` / `TANSR_SERVE_LEGACY_V1` は非推奨になり、起動時に警告 |
| `@tansr/cli` 0.10.1 | 2026-10-04 | `tansr serve --legacy-v1` が非推奨（引き続き有効） |
| `@tansr/api-client` 0.3.0 | 2026-10-04 | 正式版：`@tansr/api-client/api` エントリ（`createApiClient`）、操作カタログは revision 7 に整合、3 つのリクエストヘッダーを呼び出しオプションとして公開。旧エントリ `./sdk2`、`./sdk2/node`、`./terminal`、`./terminal/node` は凍結され、削除はされない |

この章のすべてのページは上の表の**リリース済み**バージョンに基づいて事実を記述しています。書かれている能力はすべて `@tansr/serve` 0.14.0 で利用でき、「候補」の項目はありません。

## 最短で動く例（Node）

```ts
import { createApiClient, ApiError } from '@tansr/api-client/api';

const api = createApiClient({
  baseUrl: 'http://127.0.0.1:8787',
  token: () => loadEndUserToken(), // your own loader for the short-lived bearer token
  eventEnvelope: 'unified-v1',
});

const created = await api.call('session.create', { body: {} });
const sessionId = (created.body as { sessionId: string }).sessionId;

const { closureId } = await api.sessionCapabilities(sessionId);
await api.call('session.message.send', { params: { id: sessionId }, body: { prompt: 'hi' }, closureId });

for await (const frame of api.events('session.events.observe', { params: { id: sessionId } })) {
  if (frame.envelope.type === 'msg.text.delta') process.stdout.write(String(frame.envelope.raw['text'] ?? ''));
  if (frame.envelope.terminalStatus !== null) break;
}
```

このコードには手書きの `/api/...` パスが 1 つもありません。操作名 `session.create`、`session.message.send`、`session.events.observe` はパッケージに同梱された生成済みの操作カタログに由来し、パスは SDK がマニフェストのテンプレートからローカルで組み立てます。エラーは `ApiError`（統一エンベロープ）としてスローされ、`error.code` は 19 の統一コードのいずれか、`error.retryAction` が次に何をすべきかを教えてくれます。ほかの言語の現状は[各言語のクライアント](/ja/unified-api/clients/)を参照してください。

## 開発者の 7 つの規律

この 7 条は契約の本文に由来し、公式クライアントはすべてこれに従って実装されています。自分でクライアントを書くときも 1 条ずつ照らし合わせてください。

1. **黙ってダウングレードしない。** レスポンスに `tansr-contract: unified-v1` ヘッダーがなければ契約は利用できないと見なし、`/v2` や `/v3` に切り替えるのではなく報告します。イベントエンベロープを要求したのにサーバーが同名ヘッダーを返さなければ、交渉は不成立として扱います。
2. **レスポンスから URL を取らない。** ディスカバリーエンドポイントはナビゲート可能なフィールドを一切返しません。パスはマニフェストのテンプレートとパスパラメータからローカルでだけ組み立てます。
3. **副作用が不明なものを再送しない。** サーバーが `retryAction: same-request` を明示し、かつ同じ `Idempotency-Key` を使い続ける場合にだけ 1 回再送します。`result_unknown` の後にできるのは状態の照会だけです。
4. **本文にアイデンティティを入れない。** 認証は `Authorization` ヘッダーでだけ行います。本文内のアイデンティティフィールドが認証結果と食い違えば拒否されます。
5. **SSE の終了も 202 も完了ではない。** ターン / 操作の終端状態はイベントエンベロープの `terminalStatus` だけで判断します。
6. **5 つのカーソルは互いに代替できない。** `eventCursor`、`archiveCoverage`、`outputWatermark`、`materialConsumed`、`ackReceipt` はそれぞれ独立に進みます。1 つを使ってほかを再開してはいけません。
7. **旧プレフィックスを手書きしない。** ソースに `/v2`、`/v3/sdk2`、`/v3/terminal` のリテラルを置かず、同じセッションファミリーには 1 種類のプレフィックスでだけアクセスします。

## この章の案内

| ページ | 答える問い |
|---|---|
| [呼び出し面、ドメインと操作カタログ](/ja/unified-api/surface/) | `/api` の下にどのドメインと操作があるか、パスをどう組み立てるか、クエリ文字列のリビジョン識別子をどう付けるか |
| [ディスカバリーと能力クロージャ](/ja/unified-api/discovery-and-closure/) | 起動時に何を先に問い合わせるか、`closureId` とは何か、クロージャ外の操作には何が返るか |
| [統一リクエストヘッダー、レスポンスヘッダーとエラーエンベロープ](/ja/unified-api/headers-and-errors/) | リクエストに付けられるヘッダー、すべてのレスポンスが必ず持つヘッダー、19 の統一コードと 6 種の `retryAction` の読み方 |
| [イベントストリームと統一イベントエンベロープ](/ja/unified-api/events/) | 4 本の SSE ルート、明示的な交渉、7 キーのエンベロープ、`terminalStatus` の判定と再開 |
| [移行と廃止のタイムテーブル](/ja/unified-api/migration/) | `/v1`、`/v2`、`/v3` から `/api` へどう切り替えるか、旧プレフィックスはいつ廃止されるか、どうペアでロールバックするか |
| [各言語のクライアント](/ja/unified-api/clients/) | Node / .NET / Android / iOS / HarmonyOS / Go それぞれの unified-v1 への整合状況 |
