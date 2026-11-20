---
title: メインラインのコンテキストとサブエージェント
description: tansr-cli のメインラインには既にあるが、CHANGELOG の版番号にはまだ載っていない呼び出し面。ハンドオフの選択肢と拒否理由、分岐要約、コンパクションの水位、ToolSearch、Task と常駐制御、Codemode の上限、書き込み後の検証。公開済みの SDK 0.20.1 と CLI 0.11.0 には含まれません。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/extensions/branch-summary.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/kernel/src/tools/task/agent-tools.ts
  - tansr-cli:packages/kernel/src/tools/codemode/codemode-tool.ts
  - tansr-cli:packages/kernel/src/tools/discovery/tool-search.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

ここにある挙動は `tansr-cli` のメインラインに既に入っていますが、**公開済みリリースの CHANGELOG にはまだ載っていません**。npm の `@tansr/sdk` 0.20.1 と CLI 0.11.0 にはありません。これらの変更を含むパッケージへ上げるまでは、この節の呼び出しを書かないでください。生成された SDK の記号ページは、公開済みの契約のままです。

## セッションのハンドオフ

`createSession` で作ったセッションは、`handoffSession(session, options)` で新しい目標へ渡せます。元のセッションは読み取りだけです（直近のコンパクション要約、残した末尾の履歴、対になったファイル一覧）。新しい目標向けの要旨を作り、種メッセージを 1 本だけ持つ新しいセッションを作ります。新しいセッションは `parentSessionId` を記録します。元のメモリ、スナップショット、永続記録は書き換えず、あとから再開できます。

```ts
import { handoffSession } from '@tansr/sdk';

const next = await handoffSession(session, {
  goal: 'ship the retry change',
  reviewDraft: (draft) => ({ action: 'confirm', briefing: draft.briefing }),
});
if (next.status === 'created') {
  console.log(next.sessionId, next.parentSessionId);
}
```

選択肢は次のとおりです。

- `goal` は必須で、空白を除いたあと空であってはなりません。空なら `rejected`、理由は `invalid_goal` で、モデルは呼びません。
- `instructions` は要旨生成への任意の追加です。`signal` が途中で中止されると `cancelled` になり、新しいセッションは残りません。
- `reviewDraft` は `parentSessionId`、`goal`、`briefing`、`fileInventory` を受け取ります。要旨を書き換えるか、`{ action: 'cancel' }` を返せます。書き換えた本文が空白なら `rejected` / `empty_briefing` です。
- `newSessionId` の既定は新しい UUID です。`title` の既定は目標テキストで、64 文字を超えると切ります。`cwd` の既定は元のセッションです。`meta` は保存メタデータへ合流し、`parentSessionId` と `handoffGoal` は必ず書かれます。
- `client`、`model`、`store`、`maxSummaryTokens` は任意です。ルートの `createSession` 以外で作られ、使えるモデルも渡されていないセッションは `rejected` / `unsupported_session` です。
- 閉じたセッションは `session_closed` です。進行中のターンは `turn_running` です。どちらもモデルを呼びません。モデルを組み立てられないときは `model_resolution_failed` です。新しいセッションの作成失敗は `failed` / `session_create_failed` です。要旨の生成失敗は `failed` で、`reason` と `message` が付きます。

`created` には `parentSessionId`、`sessionId`、`handoffGoal`、`briefing`、`fileInventory`、`seedMessage` があり、`session` と `usage` が付くこともあります。取消、拒否、失敗では新しいセッションは残りません。

同じファクトリで作ったセッションには、列挙されない `session.handoff(options)` も付きます。意味は `handoffSession` と同じです。型の上ではエクスポートされた関数を呼んでください。同じエクスポートには `HANDOFF_PROVENANCE_TAG`（種メッセージの印 `tansr-handoff-v1`）、`buildHandoffSeedMessage`、`readHandoffProvenance` もあります。

CLI の対話画面には `/handoff <goal>` が増えています。空の目標は使い方 `/handoff <goal>` を示すだけで、モデルは呼ばず、今のセッションも変わりません。確認の途中は Esc または Ctrl+C で取り消せます。確認すると画面は新しいセッションへ移ります。元のセッションはディスクに残り、`/resume` で戻れます。

## コミット済みノードからの分岐

公開済みの `session.fork(checkpointId)` は、これまでどおりスナップショットからの分岐です。このページはその契約を変えません。メインラインで増えた面は `restoreWithBranchSummary` です。

- `checkpointId` だけを渡すと、厳密な直線の祖先復元のままです。
- `allowSibling: true`、または `targetMessages` を直接渡すと、同じ起点を持つ兄弟へ切り替えます。要約が覆うのは共通接頭辞から外へ出た差分だけと、ファイル一覧です。分岐点より前の冷たい区間は、まるごと走査しません。
- 成功は `installed` です。保護用スナップショット `preRestoreCheckpointId`、導入前後のメッセージ数、任意の `lcaIndex` を含みます。要約メッセージはちょうど 1 本です。`session.restore` の既定契約は変わりません。
- 選択肢が不正なら `rejected` / `invalid_options` です。ルート入口で作っていないセッションは `unsupported_session` です。材料が失効していれば `source_invalidated` です。中止は `cancelled` です。

## コンパクション

ターンの途中でコンパクションが走ると、要約は二つに分かれます。終わった履歴と、まだ終わっていない現在ターンの接頭辞（元の依頼、済んだ動作、これからつなぐ現場）です。ツール呼び出しとその結果を、要約の両側へ割ることはありません。次のコンパクションは前の包みを先にほどき、同じ接頭辞を重ねてはめません。

バックグラウンドの事前コンパクションは既定ではありません。コンテキスト閾値の `backgroundCompactMargin` が無いとき、より早い水位は作られず、戻り値の形は未設定のときと同じです。値は有限で 0 より大きい数でなければなりません。`0`、負数、非数は例外になります。設定すると、硬い閾値より早く、かつマイクロコンパクションの停止線と自動コンパクションの線のあいだに挟まれた水位へ届いても、本依頼はすぐに送られ、バックグラウンドは読み取り専用スナップショットを要約します。次の関門は世代と材料がまだ合うかを見ます。セッションが空にされた、巻き戻された、または同期コンパクションがスナップショットを越えたときは、その要約は捨てられます。`closeAsync()` は決着を待ち、使用量を記録します。

一度きりの補助依頼（コンパクション、分岐要約、単発の題名や分類）は `skipCacheWrite` を立て、主対話が再び読むキャッシュ印を残しません。主セッションの依頼と、常駐サブエージェントの主ターンは、これまでのキャッシュ方針のままです。

最初のターンのツール定義は、キャッシュ接頭辞として固定されます。あとから有効になったツールは、その接頭辞の後ろへ足すだけです。

## 遅延ツールの発見

`deferredDiscovery` が無いとき、ツールの組み立てはこれまでと同じで、`ToolSearch` は出ません。渡したあとで、遅延候補の数によって登録が決まります。

- 候補が閾値に達したときだけ `ToolSearch` を登録します。閾値の既定は 16 で、`threshold` で変えられます。`force: true` なら足りなくても登録し、途中から MCP を足せます。
- 閾値未満で強制でもないとき、直接渡したツールは既定のまま普通に載ります（`eagerBelowThreshold` の既定は `true`）。
- モデルが `ToolSearch` を呼ぶとき、`query` は必須で空白ではいけません。自然言語のキーワード、正確なツール名、または `select:tool_a,tool_b` です。`limit` の既定は 5 で、範囲は 1 から 20 です。当たったツールは今のツール集合へ足されます。
- 説明文は凍結した定数です。途中で MCP をつないでも外しても、この文は変わらず、目録全体をシステムプロンプトへ貼りもしません。
- サブエージェントは各自の目録を持ち、ほかが有効にしたツールは見えません。実際の実行は、これまでの権限の関門を通ります。

## Task と常駐サブエージェント

常駐サブエージェントは同時に最大 4 つです。親セッションが操作できるのは、自分が直接作った子だけです。モデルから見えるツールは次です。

- `SpawnAgent`：`label` と `prompt` が必須です。`subagent_type` と `tools` は任意です。空の `tools` はテキストだけの常駐エージェントです。
- `AgentFollowup`：`agent_id` と `message` が必須です。`mode` の既定は `followup` で、今のターンの末尾へ並びます。`steer` は今のツール束が終わったあとで向きを変えます。
- `AgentControl`：`action` は `status`、`list`、`stop`、`release` です。`stop` と `release` には `agent_id` が必要です。`list`、または `agent_id` の無い `status` は、今の範囲の子をすべて見ます。
- `release` は、停止が済み、物理的な後始末が終わり、未配送の報告が無く、まだ抱えている子も無いときにだけ成功します。実行中、後始末の途中、または子を抱えているときは `agent_busy` です。遮断で駐車していて進行中の資源が無ければ解放できます。解放は対応する永続サブボリュームを消します。

これらの親の制御ツールは、普通のツールとして子へは渡しません。

`Task` の三つの形は互いに排他で、ちょうど一つだけ渡します。

- 単一タスクは `prompt` と `description` の両方が必須です。`run_in_background: true` を受け付けるのはこの形だけです。
- `chain`：1 から 6 ステップです。次のステップは `{previous}` で前の出力を受け取ります。途中の本文は親の履歴へ書きません。
- `tasks`：1 から 8 件を並行します。`concurrency` の既定は 4 で、範囲は 1 から 8 です。`policy` の既定は `allSettled`、または `failFast` です。`concurrency` と `policy` は `tasks` と一緒のときだけ有効です。`failFast` または親の取消では、未完了の兄弟を止め、資源の後始末が終わるまで待ちます。

各ステップには `subagent_type`、`tools`、`model`、`max_turns` も付けられます。`max_turns` は 4 から 32 へ挟まれます。

常駐サブエージェントは既定ではメモリだけです。`subvolumeStore` と `rootDir` を明示したときだけ、`<rootDir>/subvolumes/<parentSessionId>/<agentId>.json` へ書き、プロセス再起動後にそのサブボリュームから温かく再開します。パスはその親セッションのディレクトリ内に鎖されます。連続クラッシュは既定 5 回（`restartLimit`。正の整数）で鎖され、再起動をまたいでも `release` するまで鎖されたままです。ディスクを持たないセッションサービスはこの保管を提供しないので、サブボリュームをディスクへ書きません。

## Codemode と構造化結果

ツールは任意の `outputSchema` を持てます。成功結果は `structuredData` を持てます。このデータはモデルへ送るメッセージには入りません。検証に失敗すると剥がされ、構造化エラーになります。あとのフックがテキストを変え、同じ段で `structuredData` を更新しないときも、構造化データは除かれます。

`Codemode` は既定のツールではありません。`createCodemodeTool` を組み立てたあとで現れ、ツール名の既定は `Codemode` です。モデルは `code`（非同期関数の本体）と任意の `timeout_ms` を渡します。

- スクリプトは一度きりの worker で動き、終わると終了します。既定の時間切れは 15 秒で、要求値は最大 60 秒へ挟まれます。親セッションへ返すテキストは既定で最大 32 KiB です。worker の旧世代ヒープは既定 48 MiB です。
- `await tools.<name>(args)` と `await callTool(name, args)` はどちらも宿主のディスパッチへ戻り、権限の関門を通ります。1 本のスクリプトの入れ子呼び出しは既定で最大 32 回です。`Codemode` 自身を再び呼ぶことはできず、`Task`、`SpawnAgent`、`AgentFollowup`、`AskUser` を入れ子にもできません。
- `store(key, value)` / `load(key)` の既定は純メモリの表です。鍵は最大 64、合計 1 MiB、鍵名は最大 256 文字です。ディスクへは書きません。ディスクを持たないセッションサービスも永続化しません。

## 書き込み後の検証

`afterRun` は `createSession` のフィールドではありません。カーネルのクエリ環の選択肢にだけあります。設定が無ければまったく走りません。

- `verify` は必須です。文脈には `mutations.mutatedFiles`、`mutations.mutatingTools`、1 から数える `attempt`、その時点のメッセージ、取消シグナルがあります。
- `mutatingToolNames` の既定は `Edit` と `Write` です。これらのツールが成功して書き終えたときだけ数えます。エラー結果と、合成された中止のプレースホルダは数えません。
- 呼び出しはクエリが自然に終わる前、セッションがまだ忙しいあいだです。`{ action: 'pass' }` で終わります。`{ action: 'followup', prompt }` は同じクエリの中で直します。
- `maxAttempts` の既定は 2 で、0 から 5 へ挟まれます。ターン数、予算、取消シグナルにも縛られます。読み取りだけと、ただの質問では走りません。
