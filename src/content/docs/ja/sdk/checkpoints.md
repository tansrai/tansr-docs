---
title: チェックポイントと再開
description: セッションを再起動をまたいで生き残らせる——SessionStore と resume、rewritten 時のボリューム全体の入れ替え規律、手動圧縮とコンテキストスナップショット（checkpoint / restore）、履歴のページング、そして fork とスナップショットのエクスポート / インポート。
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - serve/retention-and-governance
  - security
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

セッションはデフォルトではメモリ内にしかありません。プロセスの再起動後も続きを話せるようにするには 2 つのものが必要です。`SessionStore`（どこに保存するか）と、`createSession` の `store` / `resume` の 2 つのフィールド（いつ保存し、いつ取り出すか）です。コンテキスト圧縮の後は原文が履歴に残らないため、スナップショット（checkpoint）もあります。ある時点の完全なコンテキストの自己完結した読み取り専用コピーで、列挙・復旧・削除ができます。

## SessionStore と resume

```ts
import { createFileSessionStore, createSession } from '@tansr/sdk';

const store = createFileSessionStore({ dir: app.getPath('userData') }); // 目录显式传,恒不隐式扫用户目录

// 落卷:store 在场即自动接管「会话登记 + 每轮落卷」
const session = await createSession({ token, baseUrl, store });
session.send('记住:发射码是 7-4-1');
await session.idle();
const savedId = session.sessionId; // 逻辑会话 id(UUID 形制),跨重启凭它取回

// 进程重启后:resume 一等恢复(取回历史 + 配对治理 + 预载)
const resumed = await createSession({
  token, baseUrl,
  resume: { sessionId: savedId, store }, // 只恢复;要继续落卷,store 字段同时传
  store,
});
resumed.send('复述发射码'); // 前文事实已在上下文

// 枚举与删除经 store 接口面(list 只有元数据,没有内容)
const sessions = await store.list({ limit: 20 }); // SessionRecordMeta[]
await store.delete(savedId);
```

意味論の要点：

- **resume は常に構造化エラーを出す**：対象が存在しなければ `session_not_found` を throw し、ストレージの破損（途中の壊れた行 / ハッシュチェーンの断絶 / 壊れた payload）なら `session_store_corrupted` を throw します。黙って空のセッションを始めることは決してありません。
- **ペアリングのガバナンスは組み込み**：復旧時に末尾が欠けた `tool_call` には isError のプレースホルダーを補い、孤児の `tool_result` はきれいな境界まで切り詰めるので、復旧した履歴をそのままモデルに送っても 400 にはなりません。`initialMessages` の低レベルの再投入径はガバナンスを**通りません**。
- **クラッシュからの自己修復**：`FileSessionStore` はカーネルの journal プリミティブ（ハッシュチェーン / クラッシュ時の切り詰め修復 / ファイルロック）を継承し、停電で半行だけ書かれた場合は自動で切り詰め、破損とは数えません。
- **プラットフォームのシャドウ**（トークン方式）：各セッションはプラットフォームセッション ULID を 1 つ発行してリクエストに乗せ、対応は `SessionRecordMeta.platformSessionId` に保存されます。resume 時には同じものを再利用し、キャッシュの親和性が再起動をまたいで続きます。プラットフォーム側のリースは 30 日の非アクティブ窓で、会話の活動があれば暗黙に延長されます。

「まず再開し、再開できないときだけ新規作成する」標準的な書き方：

```ts
import { TansrSdkError, createFileSessionStore, createSession } from '@tansr/sdk';

async function openOrResume(lastId: string | undefined) {
  if (lastId === undefined) return createSession({ token, baseUrl, store });
  try {
    return await createSession({ token, baseUrl, store, resume: { sessionId: lastId, store } });
  } catch (e) {
    // 只有「确实不在 store」才新建;session_store_corrupted 等恒上抛
    if (e instanceof TansrSdkError && e.code === 'session_not_found') return createSession({ token, baseUrl, store });
    throw e;
  }
}
```

## 自前のストレージ：5 メソッドと 2 つの規律

`SessionStore` の 5 メソッド `create` / `get` / `list` / `commit` / `delete` を実装すれば注入できます（SQLite、IndexedDB のメインプロセスプロキシ、あなた自身のサーバーサイドも同じ形です）。規律は 2 つ：

1. `commit` が `rewritten = true` を受け取ったら**ボリューム全体を入れ替える**こと。長さで差分追記してはいけません——圧縮による折りたたみやスナップショット復旧は履歴の先頭部分をその場で書き換えます。
2. 破損は常に構造化して throw し、黙り込まないこと。

任意のメンバーが 2 つあります。`getHistoryPage?(sessionId, { offset, limit })`（ページング読み取り。なければ全量スライスにフォールバック）と `checkpoints?: CheckpointStore`（セッションと同じライフサイクルのスナップショットストレージ。なければ = スナップショット未接続）です。

**添付ファイルの受け入れ状態のコールド復旧**（`@tansr/sdk` 0.18.0 以降、2026-10-02 公開）：Store は任意の機能フラグ `attachmentCheckpoints: true` を宣言して、`commit` の `meta.attachmentCheckpoint`（SDK が生成する不透明値）を `messages` と同じ回でアトミックに保存し、`get()` でそのまま返すことを約束できます。`resume` はこれ以降、添付ファイルの受け入れ状態（累計注入バイト数 / 拒否回数 / エントリ）を履歴とともにコールド復旧します。Store が今回の履歴を実際に修復した場合はレコードに `attachmentReferencesInvalidated: true` を置き、SDK はそれに基づいて添付ファイル参照を無効化しつつ累計の受け入れ予算は保持します。組み込みの `createFileSessionStore` は実装済みです。このフラグを**宣言しない**カスタムの 5 メソッド Store の挙動は 0.17 と同じです（コールド復旧では保守的に参照を無効化し、欠けた状態をでっち上げません）。実装側はこの値を解析・構築したり、クライアントのメタデータで代替したりしてはいけません。

## ファイル配置とセグメントの封止

`createFileSessionStore({ dir, segmentation? })` は `<dir>/sessions/<sessionId>/` の下に `journal.jsonl`（アクティブセグメント）+ `meta.json` + `attachments/` を書きます。長いセッションはしきい値に応じて動的に `segments/000001.jsonl…` + `manifest.json` へ封止されます（デフォルトは 16 MiB / 5000 レコードで有効。`segmentation: { enabled: false }` で常に単一ボリューム）。古いディレクトリ（manifest なし）は移行ゼロで読めます。ボリューム全体の入れ替えは常に単一のアクティブセグメントに戻り、**圧縮前のメッセージが復活することはありません**。入れ替えの途中でクラッシュしても次回のアクセスで自動的に補完され、半端なボリュームが見えることはありません。

スナップショットのディレクトリは 3 択で、デフォルトも含めて常に明示的です。なし = セッションと同居の `<sessionDir>/checkpoints/`（`store.delete` とともに消えます）。`checkpoints: { dir }` = 独立したディレクトリ、独立したライフサイクル。`checkpoints: { store }` = 自前の `CheckpointStore`（`put` / `get` / `list` / `delete` の 4 メソッド）。

**メディア成果物とストレージバージョン 2**（`@tansr/sdk` 0.15.0 / `@tansr/serve` 0.10.0 以降）：画像 / 動画 / 音声ツールの成果物（`tool_result.artifact`）はセッション履歴とともに保持され、ホット / コールド復旧とチェックポイントでも一緒に保持されます。`resume` 後に `SessionView` はツールカードのプレビューを再構築できます（プレビューを安全に復旧できないときは `artifactUnavailable: true` を設定）。モデルは引き続き元の `content` だけを消費します。**初めて成果物を書き込んだセッションボリュームはストレージバージョン 2 に上がります**。古いバージョンの writer はアップグレード済みのディレクトリに書き続けられません——アップグレード前にバックアップを取り、同じセッションストレージに書くすべてのプログラム（SDK ホスト / `tansr serve` / コマンドライン）を一緒にアップグレードしてください。古いバージョンへ戻すには元のバックアップを使うか、独立したディレクトリに切り替えます。古いプレーンテキストの履歴にメディアが自動で補われることはありません。

**上限付きの耐障害読み取り**（0.15.0 以降、デフォルトはオフ）：`createFileSessionStore({ recovery: { mode: 'verified-ir', quarantineDir?, onRecovery? } })` は、完全な検証チェーンの中で確実に無効なメッセージレコードを隔離し、元の証拠をセッションディレクトリの外（デフォルトは同階層の `.session-recovery-quarantine`）に書き、`SessionRecoveryReport`（件数、位置、内容のフィンガープリント。本文は含まない）でホストにコールバックします。`onRecovery` が throw すると今回の読み取りは失敗し、黙って降格することはありません。有効にする前に `SESSION_RECOVERY_VERSION` で配布済みの実行パッケージの能力を確認し、古いパッケージがこのオプションを黙って無視するのを防いでください。デフォルトは引き続き厳密な読み取りで、破損は常に構造化して throw されます。

## 手動圧縮とスナップショット

```ts
const session = await createSession({
  token, baseUrl, store,
  checkpoints: { dir: path.join(app.getPath('userData'), 'checkpoints'), max: 20 },
});

// 手动快照(任何空闲时刻;运行中 throw turn_running)
const mark = await session.checkpoint({ label: 'before compaction' });
// → CheckpointMeta { checkpointId(ULID,时间有序), trigger: 'manual', label, messageCount, createdAt, cwd, model, … }

// 手动压缩:缺省先落 pre_compaction 快照,再把历史前缀折叠为摘要
const result = await session.compact({ instructions: 'keep the launch code' });
if (result.status === 'compacted') {
  console.log(result.compactionId, result.removedRange, result.checkpointId);
} else if (result.status === 'rejected') {
  console.log(result.reason); // 'turn_running' | 'empty_history' | 'not_configured' | 'hook_blocked'
} else {
  console.log(result.reason, result.checkpointId); // failed:已落的快照保留
}

for (const cp of await session.listCheckpoints()) console.log(cp.checkpointId, cp.trigger, cp.label, cp.messageCount);

// 恢复:同会话就地换史;缺省先落 pre_restore 快照
const restored = await session.restore(mark.checkpointId);
if (restored.status === 'restored') console.log(restored.fromMessages, '→', restored.toMessages, restored.preRestoreCheckpointId);

await session.deleteCheckpoint(mark.checkpointId); // 幂等
```

シグネチャ（オプションの名前付き型 `CompactOptions` / `CheckpointOptions` / `RestoreOptions` はその場で展開してあります。0.19.0 は 0.18.x と同じです）：

```ts
compact(options?: { instructions?: string; checkpoint?: boolean | { label?: string } }): Promise<CompactResult>;
checkpoint(options?: { label?: string }): Promise<CheckpointMeta>;
listCheckpoints(): Promise<CheckpointMeta[]>;
restore(checkpointId: string, options?: { checkpoint?: boolean }): Promise<RestoreResult>;
deleteCheckpoint(checkpointId: string): Promise<void>;
```

要点：

- **アイドル期の意味論**：`compact` / `checkpoint` / `restore` / `deleteCheckpoint` は実行中には一律に拒否され、キューイングされず、副作用ゼロです——`compact()` / `restore()` は結果 `rejected: 'turn_running'` で表し、`checkpoint()` / `deleteCheckpoint()` は構造化して `turn_running` を throw します。`await session.idle()` の後に再試行してください。
- **スナップショットのスイッチ**：`compact({ checkpoint })` がなければ `checkpoints.autoBeforeCompact`（デフォルト true）に従います。ターン内の自動圧縮も同じ設定に従って `pre_compaction` スナップショットを保存します。未接続のときは `compact()` は通常どおり圧縮しますがスナップショットは保存せず、`restore()` は `rejected: 'store_not_wired'` を返します。
- **失敗の意味論**：`not_configured` = 圧縮がオフかコンテキストウィンドウが不明。`empty_history` = 履歴が空。`failed` はカーネルの理由（`nothing_to_compact` / `summary_malformed` / `model_error` / `before_compact_failed` …）を伴い、`turn.error(scope='compaction', recoverable)` で観測でき、保存済みのスナップショットは残ります。
- **復旧**：まず `sessionId` の照合を行い（別のセッションのスナップショットは `session_mismatch` で拒否）、次に履歴全体を置き換えて `session.restored` を発行し、store はボリューム全体の入れ替えを行います。同じスナップショットを続けて 2 回復旧しても 2 回目もボリュームを入れ替えます。スナップショットの `cwd` ≠ セッションの `cwd` のときは cwd を変えず、`cwd_mismatch_on_restore` の通知を出します。
- **保持**：デフォルトは無制限。`checkpoints.max` に達すると時間順に最も古いものから淘汰し、trigger は区別しません。スナップショットファイルは常に durable に書かれます（temp + fsync + rename）。
- **イベントの順序**：`session.checkpointed → session.compacted`。`session.checkpointed(pre_restore) → session.restored`。

## 履歴のページング

長いセッションの UI が一度に全量を取る必要はありません。`history({ offset, limit })` はメッセージのインデックスでページングし、返されるスライスは常にペアが完全です——始点がツール呼び出しのターンの途中にあれば前方に揃えて `offset` を埋め戻し、終点は後方に揃えます（`limit` は下限です）。

```ts
let cursor = 0;
const first = await session.history({ offset: 0, limit: 50 });
while (cursor < first.total) {
  const p = await session.history({ offset: cursor, limit: 50 });
  render(p.messages);
  cursor = p.nextOffset; // 恒以 nextOffset 推进,不要用 offset + messages.length
}

const { total } = await session.history({ limit: 0 }); // 只取 total
const last = await session.history({ offset: Math.max(0, total - 50), limit: 50 }); // 尾页
```

休止中のセッション（AgentSession を起動していない）には `readHistoryPage(store, sessionId, { offset, limit })` を使います。`createFileSessionStore` の `getHistoryPage` はセグメントのマニフェストに従って飛ばし読みし、コストは末尾の体積に比例して、ボリュームの総長には依存しません。

## fork とスナップショットのエクスポート / インポート

- `session.fork(checkpointId)` はスナップショットから**新しいセッションを生やし**、元のセッションは一切変更しません。新しいレコードを置くためにセッションの `store` が必要で、なければ `session_store_not_wired` を throw します。
- `exportCheckpoint(checkpointId)` は自己完結したバイト列（形式 `tansr-checkpoint/1`、画像の添付ファイルはインライン）を生成します。`importCheckpoint(bytes)` は format / schema / 添付ファイルの sha256 / メッセージの形を検証し、どれか 1 つでも通らなければ `checkpoint_import_invalid` を throw します。改ざんは即拒否、ディスクへの書き込みはゼロです。インポートしたものは対象のセッションに属し、そのまま restore や fork ができます。

## セッションサービスとの関係

`@tansr/serve` の `/v2` 面には同じ一連の機能の HTTP 形態（`compact` / `checkpoints` / `restore` / `history` のページング / fork / export / import）があり、意味論は本ページと一致します。0.13.0 以降、新しい統合は統一呼び出し面 `/api/sessions/**` を通じて同じ一連の操作を呼び、ドメインペイロードのバイト列は変わりません。サーバーサイドのセッション保持と物理削除のポリシーは[保持期間とガバナンス](/ja/serve/retention-and-governance/)を参照してください。

`@tansr/sdk` 0.18.0 以降の `@tansr/sdk/extensions` サブエントリは別に**ローカルアーカイブホスト**（`createNodeArchiveHost`）を提供します。元の `SessionStore` の外側でセッションに永続的なアーカイブの引き渡しと任意の素材チェーンを取り付け、`open` 後も元の `AgentSession` を返し、本ページの `store` / `resume` / チェックポイントの意味論は変わりません。これはバックアップでも複数デバイス間の同期でもありません（ストレージポリシーは `single-authorized-source` 固定、`replication` / `synchronization` はいずれも `'none'`）。[SDK 2.0 拡張エントリ](/ja/sdk/sdk2-preview/)を参照してください。
