---
title: 'セッションを閉じてリソースのクリーンアップを待つ'
description: 'closeAsync、drain、MCP の完了受領証を使って終了、タイムアウト、失敗、再試行を扱い、Electron と Android、iOS の責任境界を説明します。'
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - getting-started/sdk
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-09-10'
---

このページは現在の開発ソースコードに追加されたインターフェースを説明します。対応する SDK／serve のリリース後に利用できます。業務イベントの終了と、リソースが実際に閉じられる時点は別の 2 つの時点です。

| 操作 | 用途 |
| --- | --- |
| `idle()`、`close()`、`session.ended` | 従来の業務上の終端状態を維持する。ストレージと下層リソースの完了は証明しない |
| `session.drain(options?)` | 現在のクエリ、アイドル操作、コミット、すでに開始されたクリーンアップを待つ。セッションは閉じない |
| `session.closeAsync(options?)` | まず論理的に閉じ、次に同じ予算で実際のクリーンアップを待つ |
| `host.dispose()` | アプリが、借用しているすべてのセッションの完了後に共有 MCP host を閉じる |

```ts
const session = await createSession({ token, baseUrl, store });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('整理这次工作记录');
await session.idle();
const result = await session.closeAsync({ timeoutMs: 30_000, flushStore: true });
await pump;
if (result.status !== 'completed') {
  showCleanupState(result.status, result.pending, result.failureCount);
  // 保留 session，稍后继续：await session.drain({ timeoutMs: 30_000 });
}
```

`status` は `completed`、`failed`、`timeout`、`cancelled` のいずれかです。`pending` は各段階の件数、`failures` は上限付きの診断ウィンドウで、累計は `failureCount` / `omittedFailures` にあります。生の `cause` には機密情報が含まれる可能性があるため、Web ページ、renderer、ログに直接送らないでください。

観察のデフォルトは 30 秒です。`0` は現在の状態を読むだけ、`Infinity` はホストが実際の依存チェーンを明確に管理している場合にだけ使います。タイムアウトや `signal` は今回の待機だけを終了させ、下層の作業は続行し、他の待機者には影響しません。`flushStore` のデフォルトは false で、SDK は借用した store を閉じません。`retryPersistence: true` は修復待ちの最新の完全な履歴コミットを明示的に再試行しますが、業務コールバックは再実行しません。成功すると古いエラーは保持されたまま `recovered` とマークされます。`onHistoryCommit` の中で同じセッションの `drain()` を待たないでください。

## セッションストレージを削除または移行する前に

1 回の `store.get(sessionId)` は、すでに store に入った操作の後にしか並びません。前のターンの `onHistoryCommit` コールバックがまだ終わっていないとき、次のターンのコミットはまだセッションキューに留まっている可能性があります。`idle()` とイベントストリームがどちらも終わっていても、読み戻しで古い履歴が返ることがあります。

このセッション専用のディレクトリを削除・移行する前、または最終履歴でセッションを再構築する前に、`closeAsync({ timeoutMs: 30_000, flushStore: true })` を呼び出し、`status === 'completed'` を確認してください。タイムアウト、キャンセル、失敗の場合はセッションとディレクトリを保持し、後で待機を続けるか失敗を処理します。複数のセッションがストレージを共有している場合は、すべての利用者の完了を 1 つずつ確認してから、ホストが共有 store を管理してください。あるセッションの受領証を、ディレクトリ全体に書き込みがなくなった証拠として扱わないでください。

## 単一ターンの query とエラーチャネル

`query()` を途中で break するとクエリは中止され、`cleanupTimeoutMs` の範囲内でクリーンアップを観察します。消費側のコード自身が例外を投げた場合、JavaScript はその例外を優先して保持することがあります。`onLifecycleError` を使って、もう一方のクリーンアップエラーと、観察を続けるための入口を保存してください。

```ts
let cleanup;
for await (const event of query({ token, baseUrl, prompt: '总结目录',
  cleanupTimeoutMs: 30_000,
  onLifecycleError(error) { cleanup = error.cleanup; showFailure(error.code); },
})) {
  render(event);
  if (userStopped()) break;
}
if (cleanup) showCleanupReceipt(await cleanup.drain({ timeoutMs: 30_000 }));
```

マネージド／トークン方式の query では `skills` と `mcp` を明示的に渡せます。機能フラグの検査と所有権のルールは createSession と共通です。拡張を省略した場合、スキルディレクトリを自動的に読み取ることはありません。client 注入方式では拡張を暗黙にアセンブリしません。

## MCP の所有権とクロスプラットフォーム

`mcp: { servers }` は現在のセッション／クエリが所有します。明示的に渡された `McpHost` は借用です。共有 host は、すべての利用者が実際に完了するのを待ってから dispose しなければなりません。並行した dispose や成功後の重複した dispose は合流します。確定的に失敗した後にもう一度明示的に呼び出すと、未確認のリソースだけを再試行します。

`cleanupEvidence` の `transport-completion` はローカルのトランスポート完了層まで待ったことを示し、`connector-close-promise` はサードパーティ接続の close Promise だけを示します。自前の stdio などローカルの child とストリームは終了を待ち、HTTP などはローカルの進行中ストリームを待ってベストエフォートで DELETE します。これらはいずれも、未登録の任意のプロセスや HTTP のリモートサービスが終了したことを保証しません。

Electron の例ではメインプロセスで closeAsync を使い、未完了のセッションと host を保持します。外側の有限な観察がタイムアウトしたら再度待つ選択肢を表示し、ユーザーが直接終了を選んだ場合にだけ残りのクリーンアップをスキップします。Android／iOS は既存の serve プロトコルを使います：切断や再接続はセッションの削除を意味せず、DELETE の応答や session.ended は下層プロセスの終了を証明しません。Node ホストはまず従来の drain 予算で停止し、次に `server.settleResources()` を待ち、最後に共有リソースを閉じます。

CLI、ACP、headless の MCP の新しい観察上限は 10 秒で、従来のプロトコルとツール終了ポリシーは維持されます。組み込みの Task／再開可能なエージェントは、ネストしたクエリの受領証を親のリソースドメインに引き渡します。TUI はさらにバックグラウンドの Task、メモリの抽出／固定化／昇格、セレクターの実際の完了ポイントを待ち、serve／ACP ではメモリの owner がアクティブリストから退出した後もセッションのクローズチェーンがそれを保持します。自分で追加したバックグラウンドタスクは明示的に接続する必要があります。abort を無視するサードパーティのツールは pending のまま残る可能性があり、どの受領証も未登録の任意の子プロセスが終了したことを証明できません。
