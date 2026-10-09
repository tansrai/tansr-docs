---
title: プログラミング助手で製品を作る
description: 公開済みの @tansr/skill 0.1.3 を Codex や Cursor などのプログラミング助手へ入れ、製品を一文で頼むと、助手が画面、業務ツール、Tansr の接続を作ります。インストールはアカウント作成、モデル呼び出し、配備をしません。
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/serve
  - unified-api/clients
  - security
lastVerified: '2026-10-09'
---

Tansr Skill はプログラミング助手に入れる開発手順です。アプリ実行時のスキルではなく、`@tansr/sdk` でもありません。作りたい製品を書くと、助手がその手順で動く画面、業務データ、Tansr の接続を作ります。インストールだけではプラットフォームのアカウントはできず、モデルも呼ばず、アプリも配備しません。

npm の公開パッケージは `@tansr/skill` **0.1.3** です（`latest` と `next` はどちらもこれを指します）。その後のソースには .NET、Go、Rust、Python、C++ の参照が増えました。**0.1.3 のパッケージにはその頁は入っていません。** 言語は当サイトの[各言語のクライアント](/ja/unified-api/clients/)で選んでください。未公開の `0.1.4` をインストール版にしないでください。

## インストール

Node.js 22.19 以上と npm が必要です。製品を作るディレクトリで実行します。例は Codex のプロジェクト範囲です。助手を変えるときは `--host` だけを替え、全プロジェクトで使うときは `project` を `user` にします。

```sh
npx --yes @tansr/skill@0.1.3 hosts
npx --yes @tansr/skill@0.1.3 preview --host codex --scope project
npx --yes @tansr/skill@0.1.3 install --host codex --scope project --yes
```

先に `preview` の書き込み先を見ます。衝突があるときは既存の中身を残します。選んだ一箇所だけを入れます。

| 助手 | `--host` | プロジェクト | ユーザー |
|---|---|---|---|
| Codex | `codex` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |
| WorkBuddy | `workbuddy` | `.codebuddy/skills/tansr` | `~/.workbuddy/skills/tansr` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/tansr` | `~/.codebuddy/skills/tansr` |
| Claude Code | `claude-code`（別名 `claude`） | `.claude/skills/tansr` | `~/.claude/skills/tansr` |
| Cursor | `cursor` | `.cursor/skills/tansr` | `~/.cursor/skills/tansr` |
| TRAE 中国版 | `trae` | `.trae/skills/tansr` | `~/.trae-cn/skills/tansr` |
| TraeCode CLI | `trae-cli` | `.traecli/skills/tansr` | `~/.traecli/skills/tansr` |
| Qoder 国際版 | `qoder` | `.qoder/skills/tansr` | `~/.qoder/skills/tansr` |
| Qoder 中国版 | `qoder-cn` | `.lingma/skills/tansr` | `~/.lingma/skills/tansr` |
| ZCode | `zcode` | 非対応 | `~/.zcode/skills/tansr` |
| Kimi Code | `kimi` | `.kimi-code/skills/tansr` | `~/.kimi-code/skills/tansr` |
| MiniMax Code CLI | `minimax` | `.minimax/skills/tansr` | `~/.minimax/skills/tansr` |
| Qwen Code | `qwen-code` | `.qwen/skills/tansr` | `~/.qwen/skills/tansr` |
| 汎用ディレクトリ | `generic` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |

`generic` は Codex と同じディレクトリです。全部の助手へ入れる意味ではありません。WorkBuddy と CodeBuddy はプロジェクトが同じで、ユーザーディレクトリが違います。0.1.3 は古いユーザーディレクトリを自動では移しません。ZCode はユーザーディレクトリだけです。`feishu`、`yuanbao`、`doubao`、`volcengine`、`trae-global` はディレクトリへ入れません。書き込み成功は、助手が読み込んだ証明ではありません。入れたあと、その助手で `SKILL.md` を読めるか確認してください。

Kimi のプロジェクト導入は Git のルートから実行します。設定ルート、環境変数、再読み込みはパッケージ内の助手説明に従ってください。

## 製品を頼む

同じ助手に戻り、誰が使うか、入力は何か、どの動作で終わるかを書きます。例：

> Tansr Skill を使い、Windows で動く学習計画の助手を作ってください。目標の記録、毎日の予定、ふりかえりができるようにし、まず動く初版と、実際のツール実行の進み具合と結果を見せてください。

既存のプロジェクトでは、技術構成、ログイン、データベース、ロックファイルを残します。

> Tansr Skill を使い、今の注文システムに自然言語の照会を足してください。今のログインとデータベース、私の既存の変更は残してください。

返してほしいのは動く画面と業務の結果であり、チャットの返事や SDK の断片だけではありません。アプリ鍵はサーバー側に置きます。`appkey` をチャットへ貼らないでください。プラットフォーム接続は [Node SDK を 5 分で動かす](/ja/getting-started/sdk/) と [セッションサービスを 5 分で動かす](/ja/getting-started/serve/) を見てください。.NET、Go、Rust、Python、C++ の製品は、[各言語のクライアント](/ja/unified-api/clients/)に公開済みと書いてある包を固定します。Node へ書き換えることも、モバイルの Maven、SPM、HAR で代用することもやめてください。

## 確認、更新、削除

`--host` と `--scope` は入れたときと同じ組にします。

```sh
npx --yes @tansr/skill@0.1.3 status --host codex --scope project
npx --yes @tansr/skill@0.1.3 update --host codex --scope project --yes
npx --yes @tansr/skill@0.1.3 rollback --host codex --scope project --yes
npx --yes @tansr/skill@0.1.3 uninstall --host codex --scope project --yes
```

`status` はファイルだけを見ます。助手が読み込んだ証明にはなりません。`rollback` は記録された前の版へ戻します。削除しても、自分で変えたファイル、ほかのスキル、すでに作った製品は残ります。インストールが途中で止まったときは、先に `status` を見て、同じ対象へ `recover --yes` を実行します。
