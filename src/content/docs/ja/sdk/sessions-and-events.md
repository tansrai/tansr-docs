---
title: セッションとイベントストリーム
description: '@tansr/sdk の 3 段階 API、AgentSession のマルチターンの意味論、イベントエンベロープと主なイベントファミリー、そして SessionView と Narrator でイベントストリームを描画できる状態に変える方法を理解します。'
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - getting-started/sdk
  - sdk/checkpoints
  - sdk/platform-bundle
  - sdk/errors-and-retries
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
lastVerified: '2026-10-13'
---

SDK の役割分担を一言でいえば、**エージェントループは SDK が担い、インタラクションの体験はあなたが担う**ということです。あなたは UI（または UI なし）、業務関数、権限確認のやり取りを用意し、SDK はモデルへの接続、ツールの実行、イベントストリーム、状態の投影を提供します。このページでは、その幹であるイベントストリームを扱います。

このページは npm に公開済みの `@tansr/sdk@0.13.0` 以降（現行 **0.19.0**、2026-10-10 公開。`@tansr/serve` 0.15.1 と `tansr` CLI 0.10.3 が対になります）に対応します。0.18.0 / 0.18.1 / 0.19.0 は、このページのプロセス内 API に**挙動の変化をもたらしません**。`createSession` / `query` / `runAgent` の 3 段階、イベントエンベロープ、`SessionView` はいずれも 0.14.0 以来そのままです。統一 HTTP 呼び出し面 `/api` はセッションサービス側の話であり、Electron / Node に組み込んだ SDK はそこを通りません。バージョンごとの差分は、このページ末尾の「0.18.x での追加」と「0.19.0 での追加」の 2 節にだけあります。

## system と通常の入力の境界

`query.prompt` と `session.send()` はユーザーメッセージであり、system ロールを変更しません。新しいプロンプト機能に対応したビルドでは、アセンブリ時にプラットフォームの `fallback` / `prepend` ポリシーに従ってプラットフォームセグメントと SDK の `system` を選び、その後に `systemAppend` と該当するガイドを追加します。この機能は `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 以降で提供され、プラットフォーム側は 2026-09-14 に本番公開済みです。

`session.applicationPrompt` は読み取り専用の `{ source, policy }` サマリーで、本文は含まず、`systemAppend` を業務由来とは数えません。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、実行中のターンは設定を保ち、元のインスタンスと履歴は保持されます。ホストの system / systemAppend は引き続きコードとセッション設定で管理します。注入方式の query と低レベルの runAgent はプラットフォーム設定を自動で取得しないので、`resolveApplicationSystem` を手動で使ってください。完全なコードは[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照してください。

## 3 段階の API

| API | シグネチャの形 | 用途 |
|---|---|---|
| `query(options)` | `AsyncGenerator<KernelEvent, QueryResult>` | 1 ターンの一問一答（ツールループを含む）。`return` 値が構造化された最終結果 |
| `createSession(options)` | `Promise<AgentSession>`（async。必ず `await`） | マルチターンのセッション：`send` / `events` / `interrupt` / `messages` / `setModel` / `close` |
| `runAgent(options)` | `QueryHandle` | 低レベルのパススルー：client / executor / tools を自前で渡す、アセンブリなし |

`query` は 1 ターン用の便利な面で、カーネルのイベントストリームをそのまま通します。アセンブリ層が合成するイベント（`hook.*`、ToDo 台帳など）は `createSession` のセッションイベントストリームにだけ現れます。ほとんどのアプリは `createSession` を使います。

```ts
import { query } from '@tansr/sdk';

const run = query({ token, baseUrl, prompt: '用一句话说明 Electron 是什么。' });
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
const result = step.value; // QueryResult:reason / finalText / messages / usage / counters
```

`query` を途中で `break` するとクエリループは自動的に中止され、宙に浮いたターンは残りません。アセンブリ系のエラーは最初の `next()` で `TansrSdkError('assembly_failed')` として reject されます。

## AgentSession のマルチターンの意味論

アプリを終了したり共有 MCP host を閉じたりする前に、新しく追加された [closeAsync / drain による実際の終了処理の受領結果](/ja/sdk/lifecycle/)を使ってください。以下の close の例は従来のイベント終端のみを示すもので、非同期ストレージや下層リソースの完了を保証するものではありません。

```ts
const session = await createSession({ token, baseUrl });

const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();

session.send('第一轮问题');      // 空闲 → 起新一轮
session.send('补充一句');        // 旧兼容入口；严格同轮与回执使用 submitInput
await session.idle();            // 等当前轮(含结转连锁轮)终态
session.interrupt();             // 优雅中止当前轮(事件流走到 turn.aborted),会话可继续
console.log(session.messages()); // 历史快照(深拷贝;可持久化 / 续跑)
session.close();                 // 幂等;运行中先 abort,尾部事件不丢
await pump;
```

メソッドの意味論の要点：

- `send(prompt)`：アイドル時は新しいターンを始めます。実行中は入力バリアを通して消費され、自然な `completed` / `structured_output` のウィンドウ内に消費されなかった古い入力は繰り越されることがあります。上限や明示的な中止などのハードな終端では、予算を回避するために同世代の新ターンを自動で始めることはありません。厳密な同一ターン配送と受領証が必要なら [submitInput](/ja/sdk/midturn-input/) を使い、対象が閉じた後に `send()` へフォールバックしないでください。`close` 後に呼ぶと `session_closed` を throw します。
- `events`：ターンをまたいで連続し、セッション内で `seq` が単調増加する `AsyncIterable<KernelEvent>` です。**複数購読者へのブロードキャスト**：`for await` のたびに独立した購読者となり、SessionView のポンプ、Narrator、あなた自身のループを同時にぶら下げて、それぞれが全量を受け取れます。最初の `send()` より前に付けた購読者はセッション作成以来のすべてのイベントを受け取り、配信中に付けた購読者は購読した時点からになります。
- `setModel(next)`：以降のターンに効きます。トークン / マネージド方式ではエイリアス文字列を渡し（再解決に失敗すると `assembly_failed` を throw し、セッション状態は変わりません）、注入方式では `{ client, model }` を渡します。
- `signal` オプション：AbortSignal で、abort は close を意味します。
- `initialMessages`：履歴の事前ロード（復旧シナリオ向けの低レベル径で、ペアリングのガバナンスを通りません）。
- `onHistoryCommit(history, meta)`：各ターンの終端で全履歴のディープコピーを伴って呼ばれるコールバックです。`meta.rewritten === true` は履歴の前半がその場で書き直されたこと（圧縮による折りたたみ / スタブ化）を意味し、永続化する側はボリューム全体を入れ替えなければなりません。ほとんどの場面では `store` フィールドを使い、組み込み実装に任せてください。[チェックポイントと再開](/ja/sdk/checkpoints/)を参照してください。

`@tansr/sdk` **0.14.0 以降**（2026-09-14 公開）では `createSession` に 4 つの任意キーが追加されました。いずれも純粋な追加で、渡さなければ何も変わりません：

- `trustProjectHooks?: boolean`：プロジェクト層 hooks の信頼ゲートです。デフォルト `false` = ワークスペースの `.tansr/settings.json` / `settings.local.json` で宣言された `command` / `http` hooks は**実行ゼロ・`hook.*` イベントゼロ**（ユーザー層 / マネージド層の hooks は通常どおり）。明示的な `true` = ホストがユーザーに代わってそのワークスペースを信頼し、プロジェクト層 hooks は通常どおり動きます。SDK は信頼を永続化せず、`tansr` CLI の `trust.json` も読みません。信頼の事実はあなたが毎回ユーザーに確認したうえで渡します。ゲートで止められたプロジェクト層 hooks がある場合、`onWarning` で一度だけ `SdkWarning { code: 'project_hooks_untrusted', detail: { cwd, registered: { projectShared?, projectLocal? } } }` が通知され、`onWarning` がなければイベントストリームの `turn.error { scope: 'sdk.notice', recoverable: true }` にフォールバックします。**挙動の引き締め**：以前はリポジトリを clone して `createSession` するだけで動いていたプロジェクト層 hooks は、デフォルトでは実行されなくなりました。単一ターンの `query()` も同じアセンブリを共有してこのゲートの対象になり、信頼フラグはまだないため、`query()` の中でプロジェクト層 hooks が有効になることはありません。CLI 側の同じゲートは[セキュリティとプライバシー](/ja/security/#项目层-hooks-的信任门缺省零执行)を参照してください。
- `hostShell?: 'posix' | 'powershell'`：権限エンジンが Shell コマンドを解析するときの字句の方言です。デフォルトではホストのプラットフォームから自動判定され（組み込み Shell ツールが実際に起動する shell と一致します）、明示的な値はテストやクロスプラットフォームのリハーサル用です（たとえば Windows 上で posix の字句でルールを試す）。実際の実行 shell とずれると字句ガードと実行環境が噛み合わなくなるので、**本番ホストでは設定しないでください**。3 段階すべてに効きます。
- `budget?: { maxUsd?, maxTotalTokens?, onExceeded?: 'block' | 'warn' }`：セッションの予算ゲートで、CLI 設定ファイルの `budget` 節と同じ形です。TUI / headless / serve / acp / SDK の 5 形態がこれ以降同じゲートの意味論を共有します。セッションの累計消費が上限に達すると、`'block'`（デフォルト）は次のモデル呼び出しの前にそのターンを終了し、イベントストリームには `turn.aborted { reason: 'budget_exceeded' }` が流れ、セッションは開いたままで以降のターンも同様に止められます。`'warn'` はクエリごとに最大 1 件の `turn.error { scope: 'budget', recoverable: true }` を出してそのまま続けます。上限が両方ともなければゲートは付きません。`maxTotalTokens` = 入力 + 出力 + キャッシュ読み取り + キャッシュ書き込み（思考トークンは各モデルの機能フラグに従って出力に含め、二重には数えません）。`maxUsd` は USD 建てのモデルにだけ値が出ます。トークン方式はプラットフォームのバンドルで価格が決まり、マネージド / 注入方式の現在の組み込み価格表は CNY なので `maxUsd` では守れません。通貨に依存しない保険は `maxTotalTokens` です。不正な値（正でない / 正の整数でない / 語彙外）は IO の前に `invalid_options` で拒否されます。`thinking.budget`（1 ターンの思考予算）とは無関係で、新しいイベント種別は増えず、セッション再開時に過去の使用量を埋め戻すこともありません。
- `events?: { maxBacklogEvents, maxBacklogBytes }`：イベントのバックログ上限です。最初の購読者が来るまでのバックログは件数と概算バイト数の二重の上限で制約され、デフォルトは 1000 件 / 2 MiB（正の数か `Infinity`。それ以外は `invalid_options`）。超過すると最も古いものから捨てられ、最新の 1 件は必ず残り、キューの先頭にちょうど 1 件の一級イベント `session.events_dropped { scope: 'sdk.events', droppedCount, reason: 'count_limit' | 'bytes_limit', droppedBytes, firstDroppedSeq, lastDroppedSeq, maxEvents?, maxBytes? }` で通知されます。捨てられたイベントは取り直せません。上限の範囲内では「遅れてきた最初の購読者が全量のバックログを受け取る」ことは変わらず、`send()` の前に購読者を付けている既存コードは修正不要です。配信開始後に購読者が全員いなくなっている間に流れたイベントは**保持されません**（意味論ゼロのトリミングで、ドロップとして数えず通知もしません。あとから来た購読者は現在から始まります）。長時間走るセッションでは `send()` の前に購読者を付けるか、必要に応じて上限を上げてください。

同じバージョンでは、知っておく価値のある細かな整理もいくつかあります。`token` は `() => string` のゲッターを受け付け（5 種類のプラットフォームリクエストを発行する時点で現在値を取るので、トークンのローテーションでセッションを作り直す必要がありません）、`close()` 後の `setModel` / `setThinking` / `interrupt` は一律に `session_closed` を throw し、`AgentSession.pushBody` は公開型から外され（もともと約束された面ではありません）、`SessionNotice.message` は任意になった（ホストは `code` で描画し、`message` は保険としてだけ使う）ほか、終了処理を待つ `drain({ force: true })` は[セッションを閉じてリソースの終了を待つ](/ja/sdk/lifecycle/)を参照してください。

セッションはデフォルトで純粋にメモリ内にあります。プラットフォームはエンドユーザーのセッション内容を保存せず、計量だけを行います。

## イベントエンベロープとイベントファミリー

各イベントにはエンベロープのフィールド `type` / `sessionId` / `seq` / `ts` / `v`（契約バージョン）/ `source` が付き、ターン内イベントには `turnId` も付きます。イベントはフラットな判別共用体で、`event.type` で直接分岐してください。セッションサービスの SSE と同じ契約です。

| ファミリー | イベント | いつ見るか |
|---|---|---|
| session | `session.created` `session.resumed` `session.compacted` `session.checkpointed` `session.restored` `session.locale.changed` `session.ended` `session.events_dropped` | ライフサイクルと履歴の書き直し。`session.events_dropped`（contract-v0.27、SDK 0.14.0 以降）は SDK プロセス内でイベントのバックログが上限を超えたことの通知で、`@tansr/serve` が出すことはなく、`/v2` ストリームにも流れません |
| turn | `turn.started` `turn.completed` `turn.aborted` `turn.error` | 1 ターンの境界。`turn.error` には `recoverable` フラグが付きます |
| msg | `msg.block.start` `msg.text.delta` `msg.thinking.delta` `msg.block.end` `msg.retracted` | ストリーミングされる本文と思考。`msg.retracted` は流れ出たブロックが撤回されたことを示します（出力上限に当たってクリーンに再試行した場合など） |
| tool | `tool.proposed` `tool.permission.requested` `tool.permission.decided` `tool.started` `tool.progress` `tool.output.delta` `tool.completed` `tool.failed` | ツールのライフサイクル全体。メディアツールのプロバイダー側の失敗は `tool.completed.isError` として出ます。ツールの `inputSchema` に合わない引数の呼び出しは 0.14.0 以降、実行前にスケジューラーが拒否し、`tool.failed { errorType: 'invalid_args' }` として出て `tool.started` / `tool.completed` はありません（実行に入らず、権限の裁定も起きません） |
| agent | `agent.spawned` `agent.progress` `agent.completed` | Task サブエージェント |
| hook | `hook.triggered` `hook.completed` `hook.blocked` | あなたが設定したフック |
| cost | `cost.usage.updated` `cost.provider.switched` | リクエストごとの使用量。プロバイダーのフォールバック切り替え |
| mcp | `mcp.connected` `mcp.connect_failed` `mcp.closed` `mcp.discovered` など | MCP サーバーの状態 |
| plan | `plan.todo.updated` | ToDo 台帳 |

前方互換性の鉄則：**未知のイベント種別と未知のフィールドは必ず無視する**こと。閉じた列挙で検証してはいけません。契約は「任意項目の追加」で進化します。

## イベントを手で組み立てない：SessionView と Narrator

UI を作るとき、`msg.text.delta` から自分で文字列を連結しないでください。SDK には 2 層の出口が同梱されています：

- `createSessionView(session)`：イベントストリームを**不変のビュースナップショット**（メッセージ一覧、ツールカード、ToDo、使用量、エラーバナー、接続状態）に還元します。structuredClone セーフなので、Electron の IPC でそのまま renderer に渡せます。
- `createNarrator(...)`：人が読めるログ行を生成し、デバッグや監査出力に向いています。

表示プロファイルは任意です：`{ delivery: { text: 'stream' | 'final', thinking: 'stream' | 'final' | 'off' } }` で、本文と思考をそれぞれストリーミングか一括表示かから選べ、思考は丸ごと非表示にもできます。`view.setDelivery(delivery)` で実行中にブロック単位で即座に切り替えられます。生成側の思考予算は `createSession({ thinking: { budget } })` と `session.setThinking(...)` で扱い、表示プロファイルとは直交します。

回復可能な助言系の `turn.error`（`recoverable: true`。たとえば永続化の失敗）は `SessionView.notices`（FIFO、上限 20）に入り、`lastError` を汚しません。`ErrorView.recoverable` は必須フィールドなので、独自の投影では必ず埋めてください。0.14.0 以降は `session.events_dropped` も `notices` に入り（`code: 'session.events_dropped'`、`message` なし、`detail` = ペイロードから `type` / `scope` を除いたもの）、Narrator は `events dropped [scope]: N event(s) dropped (reason)` の 1 行を出します。そのため `SessionNotice.message` は任意になりました。`code` で描画し、`message` は保険としてだけ使ってください（たとえば `notice.message ?? notice.code`）。同じバージョン以降、`turn.error { recoverable: true }` に対する Narrator の 1 行は `… — recoverable, session continues` になりました。SDK が保証するのはセッションがまだ開いていることだけで、再試行するかどうかはあなたが決めます。`notices[].code` / `scope` で判別するコードは変わりません。

0.15.0 以降、画像 / 動画 / 音声ツールの成果物（`artifact`）はセッション履歴とともに保持され、`resume` / チェックポイント復旧の後に `SessionView` が対応するツールカードのプレビューを再構築できます。履歴に成果物があるのにプレビューを安全に復旧できない場合、ツールカードは `artifactUnavailable: true` を設定します（ツールの完了状態は変えず、成果物のない古い履歴では設定しません）。成果物を含むセッションストレージはこれ以降バージョン 2 を使い、アップグレードは全体で行う必要があります。[チェックポイントと再開](/ja/sdk/checkpoints/)を参照してください。

## 権限：ask をあなたの UI へ橋渡しする

`permission: { mode?, rules?, askUser? }`。ツール呼び出しが「確認」に落ちると `askUser` を通じてあなたの UI へ橋渡しされます。`askUser` を付けないとフェイルクローズで拒否に降格し、これが「ツールが全部拒否される」最もよくある原因です。トークン方式ではデフォルトでコンソールで任命した裁定者をアセンブリします（`adjudication?: { posture?, callBudget?, enabled?, endUser? }`）。`permission.mode` を明示すると自己管理モードと見なされ、裁定者はアセンブリされず `adjudicator_skipped_by_mode` が通知されます。`adjudication: {…}` と `permission.mode` の明示的な同居は本当の矛盾なので `invalid_options` を throw します。静かに自己管理したい場合は `adjudication: { enabled: false }` を渡してください。

## 経済性の 3 つの規律

長いセッションの費用は主に**プレフィックスの再送**にかかります。3 つの規律でその大半を節約できます：

1. **resume / attach を常に新規作成より優先する。** 前回の `sessionId` を保持し → まず再開を試し → 再開できないときだけ新規作成します。ページを開くたびに新しいセッションを作るのは、上流で温まったキャッシュを丸ごと捨てることと同じです。
2. **宣言するバイト列を常に安定させる。** ツール名 / 説明 / パラメーターのスキーマ / `builtin` の選択集合 / system セグメントはすべてモデルリクエストのプレフィックスに入り、順序を入れ替えたり説明を一文字変えたりすると、次のターンではプレフィックス全体がミスします。ツールとホストの業務セグメントは安定させてください。プラットフォームのプロンプト変更は以降のターンでプレフィックスを更新するので、キャッシュのヒットと呼び出しコストを同時に評価してください。
3. **アイドルになったら閉じる。放置しない。** `close()` は論理的なクローズと中止を開始します。ホストを終了する前に `closeAsync()` で実際のリソースと必要なストレージの flush の受領結果を確認してください。詳細は[ライフサイクルとリソースの終了](/ja/sdk/lifecycle/)を参照してください。プラットフォームのセッションアーカイブは別の境界で、store の内容は残り、いつでも `resume` できます。

## 0.18.x での追加

`@tansr/sdk` 0.18.0（2026-10-02、「2026.10 統一 API リリーストレイン」）と 0.18.1（2026-10-04、「0.14.0 バッチ」）の、0.17.0 に対するこのページ関連の変化はすべて**任意の追加**で、渡さなければ何も変わりません：

- **サブエントリ `@tansr/sdk/extensions`**（0.18.0 以降同梱）：ローカルアーカイブホスト `createNodeArchiveHost` とローカルキャッシュホスト `createNodeCacheHost`。どちらも明示的にアセンブリするホストで、**`createSession` のデフォルトスイッチではありません**。このサブエントリを import しないコードは変わりません。0.18.1 の `src` は 0.18.0 から変化がなく、`./extensions` のリリース物の内容に差分があったために同乗しただけです。2 つのホストの責務の境界と性能の開示は [SDK 2.0 拡張エントリ](/ja/sdk/sdk2-preview/)を参照してください。
- **`ToolContext.executionTarget?` / `ToolContext.turnId?` と `GateDecision.executionTarget?`**：カスタムの `Tool.execute` とカスタム権限ゲートが読める 3 つの新しい任意キーです。プロセス内 SDK（`createSession` / `query` / `defineTool` / カスタムゲート）ではこの 3 つは**常に不在**で、セッションサービスの SDK2 明示実行プロファイルのスケジューラーだけが埋め、その呼び出しがリモートのバインド済みデバイス / 管理されたサービスで実行されることを示します。カスタムゲートが `executionTarget` を読んだ場合、ホストのローカルリソースへフォールバックしてはいけません（リソースがなければ拒否であって、ホストが肩代わりするのではありません）。
- **`AppBundleModel.adapterDiagnostics?`**：プラットフォームのカタログの根拠がリクエスト / 課金アダプターを選ぶのに十分かを示す読み取り専用の投影（`status ∈ 'ready' | 'review' | 'unresolved'`）で、UI 表示向けです。プロバイダーの資格情報や価格の原文は含まず、プラットフォームが配信しないときは `undefined` です。
- **`CLIENT_FEATURES` に `'bound-device-v1'` を追加**：送信ヘッダー `x-tansr-client-features` のデフォルト宣言文字列がそれに伴って変わり、アップグレード後の最初のアセンブリでは新しいフィンガープリントでバンドルを一度取り直します（古いキャッシュエントリは自然に失効し、手で消す必要はありません）。`ClientFeature` を網羅的に `switch` しているコードは分岐を 1 つ足してください。プロセス内 SDK はバンドルの `execution` 節を消費せず、デバイスツールの認可はセッションサービスの SDK2 実行プロファイルでだけ効きます。[プラットフォームアセンブリとバンドル](/ja/sdk/platform-bundle/)を参照してください。
- **`SessionStore` の任意の機能フラグ `attachmentCheckpoints`**：組み込みの `createFileSessionStore` は実装済みで、`resume` はこれ以降、添付ファイルの受け入れ状態を履歴とともにコールド復旧します。宣言しないカスタムの 5 メソッド Store は 0.17 の挙動のままです。[チェックポイントと再開](/ja/sdk/checkpoints/)を参照してください。

## 0.19.0 での追加

`@tansr/sdk` 0.19.0（2026-10-10、`@tansr/serve` 0.15.1 と CLI 0.10.3 と同じ便）の 0.18.1 に対する `src` の変化はすべて `platform/*` にあり、`session.ts` / `query.ts` / `run-agent.ts` は無変化です。このページにとってはやはり**任意の追加**です：

- **独立したプラットフォーム非チャット操作クライアント `createPlatformNonchatClient({ baseUrl, token, onUnauthorized? })`**：埋め込み / リランキング / ドキュメント抽出 / 音楽 / プライベートボイス / 動画タスクとリアルタイムセッションなどのプラットフォーム操作を明示的に呼ぶ HTTP クライアントです。**`AgentSession` にはぶら下がらず、セッション履歴に入らず、セッションイベントを発行せず、チャットツールを自動登録することもありません**。呼び出し側が明示的に求めた操作だけを送ります。投入系のメソッドは安定した `idempotencyKey` を要求し、`wait()` は `timeoutMs` / `maxPolls` で区切られ、`reason: 'terminal' | 'timeout' | 'poll_limit'` を返します。失敗時は `PlatformNonchatError`（`code: 'platform_request_failed'`。`status` / `platformCode` / `outcomeUnknown` / `taskId?` を伴う）を throw し、対処は[エラー処理と再試行](/ja/sdk/errors-and-retries/)を参照してください。`onUnauthorized` はトークンが無効になった 401 でだけ一度呼ばれ、新しいトークンを発行してから同じキーと同じボディで再送するためのものです。
- **6 つの任意のプラットフォーム機能フラグと、`CLIENT_FEATURES` への `'nonchat-operations-v1'` の追加**：送信ヘッダーのデフォルト宣言文字列が再び変わり、アップグレード後の最初のアセンブリでは新しいフィンガープリントでバンドルを一度取り直します。`ClientFeature` を網羅する `switch` にはもう 1 つ分岐を足してください。6 つのフラグは上記の非チャット操作だけを認可し、不在は `false` と同じです。[プラットフォームアセンブリとバンドル](/ja/sdk/platform-bundle/)を参照してください。
- **`SpeakInput.voiceRef?`**：トークン方式で直接呼ぶ `session.platform.speak()` で、アプリ専用のプライベートボイスリソースを指定できます。システムの `voice` とは排他です。
- **`AppQuotaSchema` / `AppQuota`、リアルタイム接続とドキュメント一時アップロードの契約型**：型と zod の形のエクスポートに過ぎず、プロセス内セッションはそれらを消費しません。

0.19.0 の後もメインラインは進んでいます（たとえばモデルロールの主系 / 待機系の裁定ポリシー、ツールの関数レベルの許可、プライベートボイスをタスクから探し直す機能、トークン更新の同一アイデンティティ隔離）が、これらは**まだどの npm バージョンにも含まれておらず**、このページでは扱いません。

## 関連

- [チェックポイントと再開](/ja/sdk/checkpoints/)：`store`、`resume`、手動の圧縮とスナップショット。
- [プラットフォームアセンブリとバンドル](/ja/sdk/platform-bundle/)：トークン方式で配信されるもの、ツールの 3 リングの選び方。
- [エラー処理と再試行](/ja/sdk/errors-and-retries/)：`turn.error` と `TansrSdkError` の分岐処理。
