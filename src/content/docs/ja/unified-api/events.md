---
title: イベントストリームと統一イベントエンベロープ
description: '/api の 4 本の SSE ルート、tansr-event-envelope: unified-v1 の明示的な交渉と応答、7 キーのイベントエンベロープの各フィールド、互いに代替できない 5 つのカーソルがどこから来るか、terminalStatus の判定表、そして Last-Event-ID による再開とハートビート、gap フレームの扱い。'
zone: docs
category: unified-api
sidebar:
  order: 5
related:
  - unified-api/headers-and-errors
  - unified-api/discovery-and-closure
  - unified-api/surface
  - unified-api/clients
  - serve/v2-and-webhooks
  - sdk/sessions-and-events
sources:
  - tansr-cli:packages/server/src/api/event-envelope.ts
  - tansr-cli:packages/api-client/src/api/envelope.ts
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api` の下には 4 本のイベントストリームがあり、それぞれのフレームのペイロードは所属ドメインのサブ契約が定義します。統一イベントエンベロープはそのペイロードを変えません。あなたが**明示的に要求した**ときに、すべてのフレームに同じ形の外殻をかぶせ、異なるドメインのストリームを同じコードで「これはどのドメインか、カーソルはどこまで進んだか、終端状態はあるか」と判断できるようにします。

## 4 本のイベントストリーム

| 操作 | パス | ドメイン | フレームの中身 |
|---|---|---|---|
| `session.events.observe` | `GET /api/sessions/:id/events` | `session` | カーネルイベント（`msg.*`、`tool.*`、`turn.*`、`session.*`）と `server.*` 制御フレーム |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | `archive` | `archive.status`、`archive.records-available`、`material.status`、`binding.status` |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | `terminal` | `operations-available`、`operation-cancelled`、`reconcile-required` |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | `terminal` | `output.block`、`output.status` |

トランスポート層は旧プレフィックスと同じです。`text/event-stream`、先頭の `retry:` フレーム、コメントフレーム `: hb` によるハートビート、切断後は `Last-Event-ID` で再開します。セッションストリームのフレームの形と再生の詳細は [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/) を参照してください。

## 明示的な交渉

- リクエストヘッダー `tansr-event-envelope: unified-v1`。大文字小文字を区別し、完全一致です。サーバーはストリームのレスポンスで**同名ヘッダーを返し**、これが交渉成立の唯一のシグナルです。返ってこなければ交渉不成立として扱います（`@tansr/api-client/api` は `envelope_not_negotiated` をスロー）。推測してはいけません。
- ヘッダーなし：`/api` のストリームは `/v2`、`/v3/sdk2` のストリームと**バイト単位で同一**です。古いパーサーのままでプレフィックスを先に切り替え、エンベロープは後で切り替えられます。
- ストリームでないルート（たとえば `GET /api/sessions/:id`）にヘッダーを付けた場合：ヘッダーは無視され、返されず、本文も変わりません。同じリクエストヘッダー設定で同じセッションの JSON と SSE の両方のエンドポイントにアクセスできます。
- 値が `unified-v1` でない場合（空文字列や重複ヘッダーを含む）：どの `/api` ルートにアクセスしても 400 `invalid_request`（`detail.header: tansr-event-envelope`）です。

## 7 キーのエンベロープ

交渉が成立すると、各フレームの `data:` は固定 7 キーのオブジェクトになります。`id:`、`event:`、`retry:` の行とコメントフレームは元の位置に残ります。

```json
{
  "contract": "unified-v1",
  "eventId": "42",
  "domain": "session",
  "type": "turn.completed",
  "cursorSet": {
    "eventCursor": "42",
    "archiveCoverage": null,
    "outputWatermark": null,
    "materialConsumed": null,
    "ackReceipt": null
  },
  "terminalStatus": "completed",
  "raw": { "type": "turn.completed", "seq": 42, "sessionId": "0a1b2c3d", "turnId": "t-3" }
}
```

| キー | 意味 |
|---|---|
| `contract` | 常に `unified-v1` |
| `eventId` | このフレームの SSE `id:`。`id:` のないフレーム（gap フレームなど）は `null` で、合成も前のフレームからの継承もしない |
| `domain` | 受理したドメイン。レスポンスヘッダー `tansr-domain` と同じ出所 |
| `type` | イベント種別。SSE の `event:` 名を取り、なければ `raw.type` / `raw.eventType`、それもなければ `null`（未知のイベントと見なす） |
| `cursorSet` | 5 つのカーソル位置。該当しない位置は `null`。次の節を参照 |
| `terminalStatus` | `null` / `accepted` / `completed` / `aborted` / `unknown`。後述 |
| `raw` | 元の `data:` オブジェクトをそのまま収めたもの。サーバーが知らないイベント種別を含め**すべてのフレーム**にある。内部構造は引き続き各ドメインサブ契約が決める |

エンベロープは `payload` や `seq` を出力しません。ペイロードは `raw` にあり、ストリーム上の位置は `cursorSet.eventCursor` が表します。`data:` が JSON オブジェクトであるフレームだけがエンベロープに包まれ、JSON でないテキスト、配列、スカラー、空の `data:` のフレームはそのまま通過します。

## 5 つのカーソル

| カーソル | 出所 | 進めるフレーム |
|---|---|---|
| `eventCursor` | このフレームの SSE `id:`（セッションストリームでは `seq`、アーカイブストリームでは `cursor`、エグゼキューターストリームでは `eventId`） | 各フレームがそれぞれ示す。継承しない |
| `archiveCoverage` | アーカイブストリームの `archive.status` の `payload.acknowledgedCoverage`（`{ fromSequence, throughSequence, headDigest }`） | 確認済みのカバレッジだけが進める。`archive.records-available` の `publishedThroughSequence` は公開の水位であり、ここには入らない |
| `outputWatermark` | ツール出力ストリームの `output.block` の `block.seq` | `afterSeq` で出力を再購読するために使う |
| `materialConsumed` | アーカイブストリームの `material.status` で `state === 'core-consumed'` のときの `payload.materialRequestId` | ほかのマテリアル状態は進めない |
| `ackReceipt` | イベントストリームでは**常に `null`** | ACK の受領結果は HTTP レスポンスまたは `archive.operation.query` で返り、イベントストリームには流れない |

5 つのカーソルは互いに代替できません。セッションストリームの再開には `eventCursor` だけを（`Last-Event-ID` に入れて）、出力ストリームの再開には `outputWatermark` だけを使い、アーカイブがどこまで確認済みかは `archiveCoverage` だけで判断します。1 つを使ってほかを再開するのは「おおよそ正しい」のではなく、契約違反です。

## `terminalStatus` の判定

`terminalStatus` は元のイベントが終端状態を**明確に表している**ときにだけ `null` 以外になります。SSE 接続の終了、サーバーの EOF、HTTP 202 は終端状態を生みません。

| ストリーム | イベント | `terminalStatus` |
|---|---|---|
| セッション | `turn.completed`、`session.ended` | `completed` |
| セッション | `turn.aborted`。`turn.error` で `recoverable === false` | `aborted` |
| セッション | `server.*` 制御フレーム、`msg.*`、`tool.*`、未知の種別 | `null` |
| アーカイブ | `material.status`：`received` は `accepted`（受理を表すだけ）、`core-consumed` は `completed`、`rejected` は `aborted`、`pending` / `verified` は `null` | 左のとおり |
| アーカイブ | `binding.status`：`closed` は `completed`、`active` / `backpressured` / `closing` は `null` | 左のとおり |
| アーカイブ | `archive.status`、`archive.records-available` | `null` |
| エグゼキューター | `operation-cancelled` は `aborted`、`operations-available`、`reconcile-required` は `null`（照合の要求は終端状態ではない） | 左のとおり |
| ツール出力 | `output.status`：`complete` は `completed`、`available` / `receiving` / `truncated` / `gap` / `unavailable` は `null`、`output.block` は `null` | 左のとおり |

`unknown` は結果を判定できない終端状態のために取ってあります。受け取ったら「結果不明」として扱い、再送ではなく状態を照会してください。

## 再開、ハートビート、gap

- 再開：再接続時に最後に消費したフレームの `cursorSet.eventCursor` を `Last-Event-ID` に入れます。再開後のフレームも同じくエンベロープに包まれます。
- ハートビート：`: hb` コメントフレームはそのまま通過し、エンベロープには入りません。イベントとして扱わないでください。業務フレームが長く来ないことを終了と見なしてもいけません。
- gap：セッションストリームの `server.replay.gap` には `id:` がないため、エンベロープ後は `eventId` と `eventCursor` がどちらも `null`、`type` は `server.replay.gap`、`raw` に `requestedAfterSeq`、`oldestRetainedSeq`、`droppedEvents` があります。受け取ったら L2 でビューを再構築します。[v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/) を参照してください。
- フレームサイズ：`@tansr/api-client/api` は既定で 1 フレーム 2 MiB を上限とし（`maxEventFrameBytes`）、超えると黙って切り詰めるのではなくローカルエラー `payload_too_large` をスローします。

## `@tansr/api-client/api` で消費する

```ts
import { createApiClient, isTerminalEvent } from '@tansr/api-client/api';

const api = createApiClient({ baseUrl, token: () => loadEndUserToken(), eventEnvelope: 'unified-v1' });

let lastEventId: string | null = null; // resume cursor = eventCursor of the last consumed frame
const stream = api.events('session.events.observe', {
  params: { id: sessionId },
  ...(lastEventId === null ? {} : { lastEventId }),
});
for await (const frame of stream) {
  const { envelope } = frame;
  if (typeof envelope.cursorSet.eventCursor === 'string') lastEventId = envelope.cursorSet.eventCursor;
  if (envelope.type === 'msg.text.delta') render(String(envelope.raw['text'] ?? ''));
  if (isTerminalEvent(envelope)) break;
}
```

`events()` はサーバーが交渉ヘッダーを返したときにだけ `{ id, event, envelope }` を生成します。終端フレームなしにストリームが自然に終わるとループは抜けますが、`isTerminalEvent` は一度も真になりません。これこそが「EOF は完了ではない」のコード上の表現で、あなたのホストはこれをもとに成功ではなく結果不明を報告すべきです。
