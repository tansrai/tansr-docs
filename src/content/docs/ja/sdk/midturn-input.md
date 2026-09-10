---
title: 'タスクの実行中に入力を追加する'
description: '同じ実行の中で要件を追加する。ツールを中断せず、セッションを作り直さない。SDK、CLI、serve、ACP、headless での接続方法、受領証、失敗の境界を説明します。'
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - sdk/lifecycle
  - getting-started/serve
sources:
  - tansr-cli:doc/INJ-同轮追加输入手册.md
  - tansr-cli:packages/kernel/src/query/session-input-delivery.ts
  - tansr-cli:packages/cli/src/headless/input-control.ts
  - tansr-cli:packages/server/src/v2/routes.ts
lastVerified: '2026-09-10'
---

このページは開発中のソースコードに追加された機能を説明します。対応する SDK、CLI、serve、クライアントのリリース後に利用できます。ドキュメントとソースコードの検証は、npm に公開済みであることや、スマートフォンのインストールパッケージが実機で受け入れ検証を終えたことを意味しません。

**`submitInput` は、指定した実行中のターンにユーザー入力を追加するだけです。** 現在のモデルストリームやツールを中断せず、新しいセッションも作らず、対象のターンが閉じた後に自動で次のターンを開くこともありません。すでに開始されたリクエストは書き換えられません。追加したテキストは安全な入力バリアで履歴に入り、その後に次のモデル呼び出しで使われる可能性があります。

## SDK：「タスクを開始する」と「要件を追加する」を分ける

アイドル時は引き続き `session.send()` でタスクを開始します。追加ボタンは、そのクリック時に取得したターゲットと安定した入力 ID を使います。失敗分岐で `send()` にフォールバックしないでください。

```ts
import { randomUUID } from 'node:crypto';
import { createSession } from '@tansr/sdk';

const session = await createSession({ token, baseUrl });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('审阅合同并整理待确认条款');

// 由 UI 的“补充”操作调用；SDK 在 Electron 主进程/Node 宿主运行。
async function supplement(text: string) {
  const target = session.getInputTarget();
  if (target === null) return { outcome: 'closed' as const, code: 'turn_closed' };
  const request = { inputId: randomUUID(), target, content: { text }, ack: 'memory' as const };
  await retainInputDraft(request); // 宿主先保留原 ID、目标和内容；保存失败则不提交。
  const result = await session.submitInput(request);
  // 网络抛错时原 request 仍在宿主，先查询；成功时按 result 更新显示。
  return { request, result };
}

// 在后续 UI 事件或显式查询动作中，使用原 ID 与原目标。
// session.getInputStatus(request.inputId, request.target)
// 退出时另行 await session.closeAsync()，并核对其真实收尾回执。
```

`token`、`baseUrl`、`render`、`retainInputDraft` はアプリが提供します。`retainInputDraft` はホストの下書き保存関数で、SDK の API ではありません。送信前に完了していなければならず、ネットワーク障害の後も元のリクエストを削除しないでください。イベントポンプはターンをまたいで維持します。追加のたびに新しい `createSession()` や `query()` を作ったり、`interrupt()` を呼んだりしないでください。`query()` の簡易イベントジェネレーターにはこのセッションインターフェースはありません。低レベルの `runAgent()` の `QueryHandle` は `reserveUserInput` などのカーネル機能を提供しますが、消費とライフサイクルは自分で管理する必要があります。

| インターフェース | 戻り値と用途 |
| --- | --- |
| `inputCapabilities()` | `version: 1`、テキスト／テキストブロックと memory のサポート、`durableAck: false`、`image: false`、現在のターゲットと受領証の保持範囲 |
| `getInputTarget()` | `{ historyEpoch, turnId }` または `null`。ターゲットが閉じているときに、黙って新しいターンに差し替えてはならない |
| `submitInput({ inputId, target, content, ack? })` | `accepted` は `receipt` を伴う。`closed` / `rejected` は機械可読な `code` を伴う |
| `getInputStatus(inputId, target)` | 受領証または `null`。照会自体は入力やツールを再実行しない |

`content` は `{ text: '补充要求' }` でも、`{ blocks: [{ t: 'text', text: '第一点' }, { t: 'text', text: '第二点' }] }` でも構いません。後者は改行で連結されます。空のテキスト、画像ブロックの混在、サポートされない内容は黙って切り捨てられません。今期は `ack: 'memory'` のみで、省略した場合も memory です。`durable` は明示的に拒否され、`SessionStore` を設定してもこのインターフェースが永続的な配信に格上げされることはありません。

## 受領証、再試行、復旧

| 受領証の状態 | 何を示せるか |
| --- | --- |
| `accepted` | メモリ上で受け付けられた。モデルのコンテキストに入ったことはまだ証明しない |
| `consumed` | このターンの履歴に適用された。リクエストが送信済み、モデルが理解済み、業務タスクが完了したことと同じではない |
| `closed` / `cancelled` | 未消費の入力が終了した。`reason` を確認し、タスク完了と見なしてはならない |
| `reserved` | 低レベルカーネルの予約段階。通常の memory ホストの送信は即座に commit され、durable の保証は提供しない |

受領証には `inputId`、`sessionId`、`historyEpoch`、`turnId`、`ordinal`、`revision`、`source`、`state`、`durability: 'memory'`、および任意の `reason` が含まれます。`ordinal` は同一ターン内の受け付け順で、`revision` は状態の更新に伴って進みます。同じ ID、同じターゲット、同じ正規化済みテキストでの再試行は元の受領証を返します。テキストが変わると `input_conflict` になります。重複送信は、すでに `consumed` または `closed` になった元の受領証を返すことがあり、外側の `outcome: 'accepted'` だけを見て「処理待ち」と表示してはいけません。

ネットワークが中断したら、まず元の ID／ターゲットで照会し、必要なら完全に同一のリクエストを再送します。新しい ID を自動生成したり、ターゲットを変えたり、従来の `messages` ルートを呼んだりしないでください。別の入力がもう 1 件生まれる可能性があります。受領証は現在のターンと直近に終了したターンの分しか保持されません。SDK の照会が `null` を返す、または serve が **404 + `{ outcome: 'rejected', code: 'input_not_found' }`** を返すのは、現在の保持ウィンドウに一致する受領証がないことを示すだけで、期限切れ、再起動、無効化のいずれかが起きた可能性があり、「確実に実行されなかった」証明にはなりません。すべての 404 を空の受領証として扱わないでください。従来の `session_not_found`、401/403 などのセッション／認証エラーは引き続き元のエラーとして処理する必要があります。照会で見つかった `closed` の受領証や、送信時のターゲット閉鎖による 409 も「見つからない」と混同してはいけません。

履歴の明示的な復旧／置換やランタイムの再構築は `historyEpoch` を変更します。通常の圧縮ではこの入力エポックは変わりません。スマートフォンが、まだ実行中の同じ serve セッションに再接続した場合は照会を続けられます。serve の再起動や再構築は元の実行ターンを復活させず、memory の受領証も保持を保証しません。クライアントは下書きを保持して未確認と表示し、後続の操作はユーザーに委ね、ツールを自動で再実行してはいけません。

## 5 つの形態と 3 つのクライアント

| 形態 | 入口と境界 |
| --- | --- |
| CLI TUI | 実行中の Enter は厳密な追加入力になる。権限／質問ダイアログ内では `Ctrl+O` で追加入力に切り替え、`Esc` で下書きを消した後も追加入力のフォーカスを維持し、もう一度 `Ctrl+O` を押すと承認に戻る。数字と Enter は追加入力を同意として扱わない |
| SDK | 上記の `AgentSession` の 4 つのメソッドを使う。Windows Electron ではメインプロセスでセッションと ID を束ね、renderer は IPC 経由で呼び出し、長期のプラットフォームキーを保持しない |
| serve | 下記の v2 ルートを使う。Android/iOS は同じ serve セッションに接続し、それぞれ別の Node SDK やカーネルを動かさない |
| ACP | ネゴシエーション済みのプライベート拡張を使う。従来の `session/prompt` はビジー時に引き続き拒否し、新しい拡張は従来の prompt のレスポンス ID や完了結果を置き換えない |
| headless | 明示的な NDJSON 双方向制御モード。1 回の `-p` が 1 回の query に対応し、追加フレームは新しい query を開始しない |

従来の `send()` / serve `messages` の互換入口は残っています。自然な `completed` / `structured_output` のクローズウィンドウにある従来のユーザー入力は次のターンに繰り越せます。同世代の上限、明示的な中止などのハードな終端状態では、自動で別のターンを開いて予算を回避することは許されません。厳密な同一ターンのセマンティクスが必要なときは常に新しい入口を使ってください。CLI のエージェント通知は従来のキュー／確認の規律を独立して維持し、ユーザーの承認としては扱いません。

## serve：認証後に元のセッションに束ねる

その serve デプロイの認証方式をそのまま使います。サーバー側は認証済みのアプリ／エンドユーザーのドメインから所属を決定し、クライアントが `sessionId` を送信してもユーザーをまたいだセッション権限は得られません。

```http
GET /v2/sessions/{sessionId}/input-capabilities
POST /v2/sessions/{sessionId}/inputs
Content-Type: application/json

{"inputId":"ui-001","target":{"historyEpoch":"FROM_CAPABILITIES","turnId":"FROM_CAPABILITIES"},"content":{"text":"请同时核对续约条款"},"ack":"memory"}
```

```http
GET /v2/sessions/{sessionId}/inputs/ui-001?historyEpoch=FROM_CAPABILITIES&turnId=FROM_CAPABILITIES
```

パスとクエリの値は URL エンコードしてください。送信成功は **202 + `{ outcome: 'accepted', receipt }`** を返します。ターゲットの閉鎖／内容の競合は 409、注入クォータは 429、サポートされない機能／内容は 422、形式エラーは 400 です。状態照会の成功は 200 + `{ receipt }`、見つからない場合は 404 です。従来の `POST .../messages` の 202 の意味は互換性が維持され、新しい入力受領証とは同じではありません。SSE は従来のイベントプロトコルをそのまま流します。今期は入力状態の SSE イベントを追加せず、クライアントは照会インターフェースを呼んで表示を更新します。

## ACP：拡張をネゴシエートし、通常の prompt を並行送信しない

まず ACP の初期化を行い、`agentCapabilities._meta['tansr.com'].midTurnInput` で拡張のバージョンを確認してから、`_tansr.com/session/input_capabilities` を呼び出して指定セッションを照会します。以下はすべて JSON-RPC リクエストで、それぞれ独立した `id` を使います。

```json
{"jsonrpc":"2.0","id":"caps","method":"_tansr.com/session/input_capabilities","params":{"sessionId":"SESSION"}}
{"jsonrpc":"2.0","id":"extra","method":"_tansr.com/session/steer","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"补充续约要求"},"ack":"memory"}}
{"jsonrpc":"2.0","id":"status","method":"_tansr.com/session/input_status","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
```

`steer` の RPC result はホストの `outcome` で、`input_status` は `{ receipt }` を返します（不明なら `null`）。通常の prompt は引き続き自分の最終レスポンスしか持ちません。ツールを承認できるのは従来の権限レスポンスチャネルだけです。「許可」というテキストを送っても権限を承認する副作用はありません。サポートをネゴシエートしていない新しいクライアントは、ビジー時の `session/prompt` で追加入力を模倣しないでください。

## headless：一度開始したら、その後は制御フレームだけ

```sh
tansr -p "审阅合同" --output-format stream-json --input-format ndjson
```

`--cc-compat`、`--bg`、集約された `json`/`text` 出力とは組み合わせないでください。`--input-format text` は従来の stdin テキストの動作を維持します。空でない `-p` を必ず指定してください。今期は stdin の `start` フレームはありません。

まず stdout の `tansr.input.ready` を読み取り、`capabilities.target` を取得します。次に、以下の各 JSON オブジェクトをそれぞれ独立した 1 行として stdin に書き込みます。

```json
{"v":1,"id":"a","method":"steer","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"追加要求"},"ack":"memory"}}
{"v":1,"id":"b","method":"input_status","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
{"v":1,"id":"c","method":"cancel"}
```

上の例の 3 行目は明示的なキャンセルの例で、通常の追加入力では送信しません。レスポンスは `tansr.input.response` で、フレームの `id` を引き継ぎ、`result` に受領証／拒否または `cancel_requested` を載せます。これらのレコードはカーネルイベントと stdout を共有し、`type` で区別します。最後には従来の `result` が 1 件だけあり、キャンセルは従来の終了コードを引き継ぎます。UTF-8 の分割、LF/CRLF、EOF 前に改行のない最終フレームはいずれも処理できます。1 行の上限は **65,536 UTF-16 code units** で、バイト数ではありません。壊れたフレーム／大きすぎるフレームには明確な拒否レコードがあります。

stdin の EOF は制御入力を終了させるだけで、query をキャンセルしません。query が先に終了した場合は読み取りを停止し、EOF を待ちません。最終結果の後に届いた遅延フレームには応答しません。stdout を読むときはイベントと制御レスポンスを継続的に排出してください。制御チャネルは書き込みのバックプレッシャー時に読み取りを一時停止します。これをモデルイベントストリーム全体が永続的なメッセージキューを提供するものと解釈しないでください。

## 設定、権限、予算は元の境界を維持する

追加した内容はユーザーメッセージであり、システムロールではありません。プラットフォームのプロンプト、SDK/serve の `system` と `systemAppend` はこのターンのスナップショットを維持し、追加入力によって再取得や再アセンブリは行われません。次の新しいターンで初めて、従来の[プロンプト階層](/ja/sdk/system-prompts/)に従ってプラットフォーム設定が更新されます。MCP/skills/ツールセットは追加入力によって自動的に増えません。

新しい実際のユーザー意図は、消費境界で裁定／メモリ選択のプロンプトを更新しますが、保留中のツールを自動承認はしません。モデルのターン数、ツールのターン数、注入クォータ、ウォールクロック、金額の予算は引き続き累積します。`consumed` の後でも上限到達で終了し、次のリクエストが発生しないことがあります。受領証と元の終端状態を組み合わせて結果を表示してください。
