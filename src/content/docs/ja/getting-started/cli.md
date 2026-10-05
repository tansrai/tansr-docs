---
title: 'CLI を 5 分で動かす'
description: 'tansr CLI をインストールし、個人アクセストークンでプラットフォームにログインし、最初の対話セッションを始め、ヘッドレスモードで NDJSON のイベントストリームを確認します。'
zone: docs
category: getting-started
related:
  - cli/settings-and-doctor
  - cli/commands
  - support/troubleshooting
  - support/account
  - serve/deploy-and-auth
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/report/REL-SEA-发行执行单-2026-10-05.md
lastVerified: '2026-10-05'
---

`tansr` は開発者向けのエージェント CLI です。同じ 1 つのカーネルを、対話式ターミナル（TUI）、ヘッドレススクリプト（headless）、常駐サービス（serve）、エディタエージェント（acp）、MCP ツールサービス（mcp serve）の 5 つの形態で提供します。このページでは最短経路だけを進みます：インストール、ログイン、ひと言話す、イベントストリームを一度見る。現在のバージョンは **0.10.1**（npm `@tansr/cli`、2026-10-04 公開）です。

## 前提

- Node.js ≥ 22.19。現時点で公開されている形態は npm パッケージだけです。単一ファイル実行版（SEA、Node ランタイム同梱）はまだ公開されていません。後述を参照してください。
- Windows / macOS / Linux をサポートします。Windows では Windows Terminal を推奨します。従来の conhost では自動的に ASCII グリフ段階に切り替わりますが、機能に影響はありません。

## インストール

```bash
npm i -g @tansr/cli
tansr --version          # 0.10.1
```

パッケージ名は `@tansr/cli`、コマンド名は `tansr` です。アップグレードも同じく `npm i -g @tansr/cli@latest` で行います。0.10.1 以降、インストールした各バージョンの初回起動時にユーザーキャッシュディレクトリへ約 2 MB の Node コンパイルキャッシュを書き込みます（同じバージョンの 2 回目以降の起動が速くなります。`TANSR_COMPILE_CACHE=0` で無効化できます。[設定と doctor](/ja/cli/settings-and-doctor/)を参照）。

**単一ファイル形態（SEA）と OSS 配布サイト：未公開。** 2026-10-05 時点で、公式配布サイト `bash.tansr.com` には 0.10.x に対応する実行ファイルも `SHA256SUMS` もありません（Windows 版は当面掲載しないことが決まっています）。配布サイトをインストール元として扱わないでください。SEA が公開され次第、本ページにダウンロードと検証の手順を追加します。

## 認証情報：個人アクセストークンでログイン

CLI は**プラットフォームモード**で動きます。ログイン後、モデル一覧と料金表はプラットフォームから配信されるので、provider 設定を手で書く必要はありません。

1. コンソールで個人アクセストークン（PAT）を作成します。
2. 初期化ウィザードを実行し、案内に従って PAT を貼り付けます（マスク入力で、エコーバックされません）。

```bash
tansr init
```

ウィザードは本人確認を行い、このマシン用のアプリ認証情報を派生させ、それを OS のキーチェーンに書き込みます（使えない場合は権限 0600 のファイルにフォールバックし、明示的に通知します）。最後にサマリーカードを表示します：アカウント指紋、残高、最近の使用量、利用可能なモデル数、派生キーの有効期限。この過程でモデル呼び出しは一切発生せず、何度でも実行できます。

スクリプトや CI で対話なしに実行するには：

```bash
TANSR_PAT=<PAT> tansr init
```

`tansr init --pat <PAT>` でも直接値を渡せますが、シェルの履歴に残るため推奨しません。

ログアウトは `tansr logout` です。このマシンの認証情報を消去し、このマシンの派生キーの無効化を試みます。PAT 自体は取り消されません（他のデバイスがまだ使っている可能性があるためです）。

## 最初のセッション

`tansr` をそのまま実行すると対話式ターミナルに入ります。

```bash
tansr
```

起動時にウェルカムバナーと「基本設定サマリー」（ログイン ID、ポータルアドレス、現在のモデル、コンテキスト方式、残高）が表示されます。入力欄に文字を打って Enter を押せば対話できます。`@` でワークスペースのファイルを参照し、`/` でスラッシュコマンドを呼び出します。初日から使うコマンドをいくつか挙げます。

| コマンド | 役割 |
|---|---|
| `/help` | すべてのコマンドを一覧表示 |
| `/status` | バージョン / 言語 / セッション / モデル |
| `/model` | モデルセレクターを開く。`/model <エイリアス>` で直接切り替え |
| `/cost` `/usage` | このセッションのコストと token 使用量 |
| `/doctor` | アセンブリ状態の自己診断 |
| `/quit` | 終了 |

Esc で現在のターンを中断、Ctrl+T でフルスクリーンのトランスクリプト表示、Ctrl+C も中断です。

## イベントを見る

ヘッドレスモードではすべてがイベントです。`-p` に prompt を 1 文渡して `--json` を付けると、1 行 1 JSON の NDJSON イベントストリームが得られます。ストリームの末尾には必ず `type: "result"` のサマリーが 1 件あります。

```bash
tansr -p "用一句话介绍这个目录" --json
```

```json
{"type":"result","reason":"completed","exitCode":0,"usage":{"inputTokens":1200,"outputTokens":300}}
```

イベントのエンベロープフィールドは `type` / `sessionId` / `seq` / `ts` / `v` / `source` です。主なイベントファミリーは `session.*`、`turn.*`、`msg.*`、`tool.*`、`agent.*`、`hook.*`、`cost.*`、`mcp.*`、`plan.*`。終了コードの意味：0 成功、1 モデルまたは内部エラー、2 中断、3 上限到達（ターン数 / 予算）、4 prompt が長すぎる、5 用法エラー。

Node でこのストリームを消費するのは数行で済みます。

```js
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';

const child = spawn('tansr', ['-p', '总结本仓库', '--json'], { stdio: ['ignore', 'pipe', 'inherit'] });
for await (const line of createInterface({ input: child.stdout })) {
  const ev = JSON.parse(line);
  if (ev.type === 'msg.text.delta') process.stdout.write(ev.text);
  if (ev.type === 'result') console.log('\n退出码:', ev.exitCode, '原因:', ev.reason);
}
```

ヘッドレスモードには問い合わせのチャネルがありません。権限判定が「ユーザーに確認」になった場合は一律で拒否にフォールバックします（fail-closed）。権限を開くには `--allowedTools "Shell(git *),Read"` のようなセッション単位のルールを使うか、`--permission-mode` で初期モードを指定してください。

## 最初によくつまずく点

| 現象 | 対処 |
|---|---|
| 「TUI には対話式ターミナル（TTY）が必要です」 | パイプの中で `tansr` を起動しています。非対話の場面では `-p` を使う |
| 初期化せずに起動した | 空状態のガイドカードに入ります。その場で `/init` と入力すればログインできます。無人運転の形態では終了コード 5 で終了し、`tansr init` を促します |
| 残高がゼロ | サマリーカードが警告しますが、処理は止めません。プラットフォームのモデル呼び出しはサーバー側の課金ゲートで拒否され、ローカル機能には影響しません |
| プラットフォームをまったく使いたくない | `TANSR_ESCAPE_LOCAL=1` を設定し、ユーザーマニュアルに従って `.tansr/settings.json` にローカル provider を設定する |

## 次のステップ

- [設定と doctor](/ja/cli/settings-and-doctor/)：5 層の設定、よく使う環境変数、`tansr doctor` の各セクションの読み方。
- [コマンドとフラグのリファレンス](/cli/commands)：すべてのサブコマンドとフラグ。
- 自分のエージェントを他の人にも使わせたい？[セッションサービスを 5 分で動かす](/ja/getting-started/serve/)をご覧ください。CLI 形態の `tansr serve --v2` は 0.10.0 以降、統一呼び出し面 `/api` も同時にマウントします（新規の統合はこちらへ）。`--v2` 構成では `/v1` 面はデフォルトで無効になり、移行用フラグ `--legacy-v1` は 0.10.1 以降は非推奨です。詳しくは[デプロイと認証](/ja/serve/deploy-and-auth/)を参照してください。
