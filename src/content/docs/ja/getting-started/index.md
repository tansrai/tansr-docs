---
title: 'クイックスタート：道を 1 つ選び、5 分で動かす'
description: 'tansr には 6 つの利用形態があります——Node SDK、CLI、セルフホストのセッションサービス、Android、iOS、HarmonyOS。このページでは、どの記事から始めるべきかを判断し、6 つの道が共有するアカウントと認証情報のモデルを説明します。'
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/cli
  - getting-started/serve
  - getting-started/android
  - getting-started/harmony
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-15'
---

tansr はエージェントランタイムです。同じ 1 つのカーネル（クエリループ、ツールスケジューリング、権限エンジン、コンテキスト圧縮）を、いくつかの異なる形態で提供します。すべてを理解する必要はありません。「エージェントをどこで動かしたいか」に合わせて道を 1 つ選ぶだけです。中立な橋、Harness、Skill とランタイムの分担、今の 2 ステップ、そしてまだ提供していない計画は[技術上の立場](/ja/getting-started/principles/)にあります。プログラミング助手が収集する同じ条文は [`/llms.txt`](/llms.txt) にあります。資料サイトの最初の画面には出さず、ページ末尾の折りたたみに置きます。

## まず 1 つ答える：エージェントはどこで動く？

| あなたの状況 | おすすめの入口 | 対応する記事 |
|---|---|---|
| ターミナルで直接エージェントと対話し、コードを直し、スクリプトを実行したい | `tansr` CLI | [CLI を 5 分で動かす](/ja/getting-started/cli/) |
| Node.js / Electron プログラムを書いていて、エージェントを自分のプロセスに組み込みたい | `@tansr/sdk` | [Node SDK を 5 分で動かす](/ja/getting-started/sdk/) |
| 自分のモバイル / Web ユーザーにエージェントを提供したい。マルチユーザーのバックエンドが必要 | `@tansr/serve` セルフホストのセッションサービス | [セッションサービスを 5 分で動かす](/ja/getting-started/serve/) |
| Android アプリを書いていて、バックエンドは `@tansr/serve` を使う（予定） | Kotlin SDK `com.tansr.sdk`（0.4.0） | [Android と iOS を 5 分で動かす](/ja/getting-started/android/) |
| iOS / macOS アプリを書いていて、バックエンドは上と同じ | Swift バイナリパッケージ `tansr-ios-spm`（0.3.0） | 同じ記事の「iOS でも同じ手順」節 |
| ネイティブ HarmonyOS アプリを書いていて、バックエンドは上と同じ | ArkTS HAR `@tansr/harmony` | [HarmonyOS SDK を 5 分で動かす](/ja/getting-started/harmony/) |

経験則は 2 つです。

- **自分ひとりで使うなら CLI、他人に使わせるなら SDK かセッションサービス。** CLI は開発者本人のためのもの、SDK とセッションサービスはあなたのプロダクトのユーザーのためのものです。
- **モバイルは必ずあなた自身のサーバーを経由する。** Android / iOS / HarmonyOS SDK は薄いプロトコルクライアントで、プラットフォームの認証情報を一切持ちません。エージェントのカーネルは、あなたがデプロイした `@tansr/serve` の中で動きます。Android 互換スタックだけの古い HarmonyOS 端末は引き続き Android SDK を使います。

## 6 つの道が共有するアカウントモデル

どの道を選んでも、認証情報は 3 層に分かれ、下に行くほど外に漏らしてはいけません。

1. **個人アクセストークン（PAT）**：コンソールで作成し、`tansr init` でローカルの CLI にログインするためだけに使います。あなた本人を表します。
2. **アプリキー（appid / appkey）**：コンソールで 1 つの「アプリ」に対して発行します。appkey はあなたのサーバー側（Node プロセスまたは `@tansr/serve`）にしか置けず、エンドユーザー向けの短期トークンを発行するために使います。**appkey は端末デバイスに配布しない、ログに書かない、リポジトリに入れない。**
3. **短期 app_user トークン**：あなたのサーバーが appkey で発行し、端末（Electron のメインプロセス、または `@tansr/serve` 内部）に渡します。期限が来れば失効し、漏洩しても影響範囲は TTL で抑えられます。

CLI ユーザーに必要なのは第 1 層だけです。SDK とセッションサービスの開発者には第 2・3 層が必要です。置き場所とローテーションの詳細は[セキュリティとプライバシー](/ja/security/)を参照してください。

## どのクイックスタートも同じ骨格

5 本の形態別記事（Android と iOS は 1 本にまとめています。HarmonyOS は独立した 1 本です）は同じ順序で展開するので、形態間で対照しやすくなっています。

1. **前提**：実行環境とバージョン要件（Node ≥ 22.19 が共通のベースライン）。
2. **インストール**：`npm i -g @tansr/cli`、`npm install @tansr/sdk`、`npm install @tansr/serve`、または Maven / SwiftPM / 独立公開 HAR の座標。
3. **認証情報**：その形態にどの層の認証情報が必要で、どこから取得するか。
4. **最初のセッション**：動く最短のコード。
5. **イベントを見る**：エージェントの出力はすべてイベントストリーム（`msg.text.delta`、`tool.completed` など）です。このステップで自分の目で確認します。
6. **次のステップ**：対応する詳細ガイドへの案内。

## 実行環境の早見表

| 形態 | 最低要件 |
|---|---|
| CLI | npm パッケージは Node.js ≥ 22.19 が必要で、Windows / macOS / Linux に対応。単一ファイル実行版（SEA）はランタイムを同梱しており、現時点では Linux x64 / arm64 向けだけ提供 |
| `@tansr/sdk` | Node.js ≥ 22.19。Electron ≥ 39。ESM only。TypeScript target ≥ ES2022 |
| `@tansr/serve` | Node.js ≥ 22.19。サードパーティのランタイム依存は `zod` のみ |
| Android SDK | minSdk 26。Kotlin コルーチン + kotlinx.serialization + OkHttp |
| iOS SDK | iOS 16+ / macOS 13+。SwiftPM |
| HarmonyOS SDK | HarmonyOS 6.0 / API 20。Stage モデル。独立公開 HAR `@tansr/harmony` 0.2.0（2026-10-10、OHPM 未掲載） |

## 一度動いたら、次に読むもの

| 知りたいこと | 行き先 |
|---|---|
| セッションをどう永続化し、切断後にどう復旧するか | [チェックポイントと再開](/ja/sdk/checkpoints/)（SDK）· [v2 プロトコルと webhook](/ja/serve/v2-and-webhooks/)（セッションサービス） |
| プラットフォームが自分のアプリにどんな機能を配布しているか、コンソールでどう切り替えるか | [プラットフォームアセンブリとバンドル](/ja/sdk/platform-bundle/) |
| あるエラーコードの意味、再試行できるか | [エラー処理と再試行](/ja/sdk/errors-and-retries/) · [エラーコード表](/errors/codes) |
| サーバーのデプロイ、グレースフルシャットダウン、複数レプリカでのシャーディング | [デプロイと認証](/ja/serve/deploy-and-auth/) |
| セッションサービスの HTTP 面（`/api`）を直接呼びたい、または自分でクライアントを書きたい | [統一 API（/api）](/ja/unified-api/) |
| プログラミング助手に、自分の説明から動く製品を作ってほしい（`@tansr/skill` 0.1.6） | [プログラミング助手で製品を作る](/ja/getting-started/skill/) |
| 形態をなぜ分けるのか、2 ステップと計画がそれぞれ何を意味するか | [技術上の立場](/ja/getting-started/principles/) |
| SDK 2.0 の拡張入口（アーカイブホスト、キャッシュホスト、統一 API）のうち、どこまでが正式公開済みか | [SDK 2.0 拡張の入口](/ja/sdk/sdk2-preview/) |
| セッションはいつまで保持され、いつ回収されるか | [保持期間とガバナンス](/ja/serve/retention-and-governance/) |
| CLI の設定ファイルはどこか、`tansr doctor` の出力をどう読むか | [設定と doctor](/ja/cli/settings-and-doctor/) |
| データはどこに保存されるか、キーをどうローテーションするか、通信はどこへ向かうか | [セキュリティとプライバシー](/ja/security/) |

## 困ったとき

- CLI 側ではまず `tansr doctor` を実行してください。ネットワークを使わないアセンブリ自己診断です。読み方は[トラブルシューティング](/ja/support/troubleshooting/)を参照。
- すべてのエラーには安定した機械可読コードがあり、[エラーコード表](/errors/codes)でコードから意味を調べられます。
- アカウント、キー、プランの問題は[アカウントと請求](/ja/support/account/)へ。解決しなければ[サポートに連絡](/ja/support/contact/)してください。
