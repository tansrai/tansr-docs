---
title: プラットフォームアセンブリとバンドル
description: トークン方式で配信されるもの——アプリ設定バンドルの中のモデルカタログ、機能フラグ、メディア認可セット、プランの投影。ツールの 3 リングはどう選ばれるか、機能フラグがオフのときに何が起きるか、onPlatformWarning は何を知らせるか。
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - getting-started/sdk
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - sdk/sdk2-preview
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/server/README.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

トークン方式の中心的な約束は**ローカル設定ゼロ**です。モデルカタログ、機能フラグ、メディア認可セット、プランの状態はすべてプラットフォーム上で「アプリ」ごとに 1 つのバンドルとして設定され、SDK はトークンでそれを読み取り、アセンブリ時にトリミングします。フィールドによって有効になる境界は異なります。アプリのプロンプトとポリシーは各ターンの開始前に確認されますが、そこから他の設定も同一セッション内でホットアップデートされると推測してはいけません。このページではバンドルに何が入っているか、ツールがどう選ばれるか、フラグがオフのときに何が起きるかを扱います。バージョンの基準は `@tansr/sdk` 0.19.0 / `@tansr/serve` 0.15.1（いずれも 2026-10-10 公開）です。

## アプリのシステムプロンプトもアセンブリ設定である

`systemPrompt` / `systemPromptPolicy` はアプリ設定からバンドルに入ります（`@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 以降で提供、プラットフォーム側は 2026-09-14 に本番公開済み）。デフォルトの `fallback` は SDK が `system` を渡さないときにプラットフォームセグメントを使い、`prepend` は SDK が明示的に `[]` を渡してもプラットフォームセグメントを保持し、その後ろに SDK の空でない業務セグメントを続けます。ホストの `systemAppend` は選ばれた業務セグメントの後ろに来て、決してそれを上書きしません。その後にようやく、このエントリで実際にアセンブリされたツール、Skills、MCP のガイドが続きます。

どちらの項目も次の新しいターンの前に更新され、実行中のターンは選択済みの設定を保ちます。履歴はクリアされず、セッションを開き直す必要もありません。`session.applicationPrompt` は本文を含まない読み取り専用の source / policy サマリーを公開します。完全な表、管理 API、競合時の処理の境界は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照してください。

## まずコンソールで正しいアプリ種別を作る

アプリ作成時にプラットフォーム種別を選びます。これは「機能とクォータ」ページでどのフラグとデフォルトプロファイルを設定できるかを決め、バンドルでは `app.platform` として配信されます：

| 種別 | 用途 | 機能面 |
|---|---|---|
| デスクトップアプリ | Electron など、SDK のプロセス内形態 | すべてのツールフラグとプラットフォームフラグを設定可能 |
| モバイルアプリ | Android / iOS / HarmonyOS、あなたの `@tansr/serve` セッションサービス経由 | ファイル / コマンド系は固定でオフ。公開ネットワークツール WebFetch / Http / WebSearch はフラグごとに有効化、デフォルトはオフ（下の[モバイルアプリの公開ネットワークツール](#モバイルアプリの公開ネットワークツール)を参照） |
| サーバーアプリ | この SDK を組み込んだ Node バックエンド | デスクトップと同じ機能面 |

**モバイルアプリ**の資格情報をこの SDK プロセス内でアセンブリしても失敗はしませんが、ファイル系などのフラグはトポロジーによってすでにオフに正規化されており、プラットフォーム通知フレーム `app_platform_mismatch` を受け取ります。統合形態ごとに 1 つずつアプリを作ってください。1 アプリ 1 プラットフォーム、複数クライアントには複数の appid——失効面も使用量の帰属も別々になります。

モバイルアプリはさらに、プラットフォームの `PATCH /v1/apps/:id`（`x-tansr-client-features: bound-device-v1` 付き）で `execution: { version: 'bound-device-v1', boundDevice: { tools } }` 節を設定し、バインド済みデバイス上のツールをセッションサービスの SDK 2.0 明示実行プロファイルに付与できます。`@tansr/sdk` 0.18.0 以降、`AppCapabilitiesSchema` はこの節を認識してそのまま保持しますが、**プロセス内 SDK はそれを消費しません**。デバイスツールの認可は `@tansr/serve` の SDK2 実行プロファイルでだけ効き、古いアプリ種別と古い `tools` フラグはデバイスの認可を意味せず、フラグの不在 = 未認可であり、プロセス内の `tools` に合流することは決してありません。[SDK 2.0 拡張エントリ](/ja/sdk/sdk2-preview/)を参照してください。

## ツールの 3 リング：1 つの `tools` エントリ

```ts
await createSession({
  token, baseUrl,
  tools: {
    builtin: ['read', 'glob', 'grep', 'imageGen'], // 环 2:内置工具(本地工具跑在终端用户机器)
    custom:  [searchOrders],                        // 环 1:defineTool 业务函数(你的代码)
  },
});
```

- `tools` がまったくない = 機能フラグが許す**すべてのローカル**組み込みツールをアセンブリします（4 つのメディア名はデフォルトの全集合に決して入りません）。
- `tools: { builtin: [] }` = 組み込みゼロ。露出が最小の純粋なカスタムツールのシナリオです。
- `builtin` の語彙は 16 個の名前です：`read` `write` `edit` `glob` `grep` `list` `shell` `todoWrite` `askUser` `webFetch` `webSearch` `http` と、4 つのメディア名 `imageGen` `videoGen` `speechToText` `textToSpeech`。
- 語彙外の名前 → `invalid_options`。フラグがオフなのに明示的に選択 → `capability_disabled`、メッセージにコンソールでの修復手順を含みます。**常に読めるエラーで即座に失敗し、黙ってツールが欠けることはありません。**
- 4 つのメディア名は課金対象のツールで、その定義は毎回のプロンプトでトークンを消費します。**デフォルトの全集合がそれらをアセンブリすることはありません**——使うには `builtin` に明示的に列挙してください。
- `tools.platform` は互換性のためのエイリアスとして残っています（非推奨）。`builtin` の同じ 4 つの値と等価で、エイリアスがあるとアセンブリのたびに構造化警告 `tools_platform_deprecated` が 1 件出ます。新しいコードは `builtin` を使ってください。

4 つのメディアツール自体はカーネルのシステムツールで、プラットフォームは認可モデル、資格情報、計量を担当します。機能フィールドの名前は引き続き `capabilities.platform` ですが、それは認可フラグの名前に過ぎず、「プラットフォームツール」という別のクラスがあるわけではありません。ツールの成果物（画像 / 動画 / 書き起こし / 音声カード）があることも、ネイティブのリアルタイム音声・動画メッセージに対応していることを意味しません。`sendBlocks` はテキストと画像だけを受け付け、ネイティブの `audio` / `video` ブロックは履歴に書かれモデルに送られる前に `invalid_blocks` を返します。録音の書き起こしや読み上げボタンは独立した直接音声インターフェースを通ります。

リング 1 の `defineTool` は「登録がそのままマニュアル」です。1 つの宣言からモデルに見えるスキーマと人が読めるドキュメントの両方が生まれ、JSON パラメーター表と zod の 2 つの形があります。外部 MCP には `createMcpHost({ servers })`（アプリレベルで共有）か `mcp: { servers }`（セッションレベル）を使い、設定は業界標準の `mcpServers` と同じ形です。Skills は `defineSkill` でインラインに、または `dirs` ディレクトリから読み込み、ユーザーディレクトリは決してスキャンしません。

## 機能フラグ：ツールフラグとプラットフォームフラグ

機能フラグは「このアプリにこの機能があるか」に答えます。コンソールでアプリごとに設定され、バンドルで配信され、SDK がアセンブリ時にトリミングし（契約面）、ゲートウェイがハードチェックします（プラットフォームリソースの強制面）。**トークン方式では機能フラグは常にバンドルから来ます**。オプションで `capabilities` を渡すと拒否されます。マネージド / 注入方式では `capabilities` を渡して自分で管理できます。

プラットフォームのデフォルトプロファイル（保守的）：

| フラグ | デフォルト | | フラグ | デフォルト |
|---|---|---|---|---|
| `tools.read` | オン | | `tools.http` | オフ |
| `tools.write` | **オフ** | | `tools.todoWrite` | オン |
| `tools.edit` | **オフ** | | `tools.askUser` | オン |
| `tools.glob` | オン | | `tools.agent`（Task サブエージェント系） | オフ |
| `tools.grep` | オン | | `tools.skills` | オフ |
| `tools.list` | オン | | `tools.mcp` | オフ |
| `tools.shell` | **オフ** | | `tools.customTools`（リング 1 のマスタースイッチ） | オン |
| `tools.process`（予約） | オフ | | `platform.imageGen` | オフ |
| `tools.webFetch` | オフ | | `platform.videoGen` | オフ |
| `tools.webSearch` | オフ | | `platform.webSearch` | オフ |

プラットフォームフラグには `platform.speechToText` / `platform.textToSpeech`（デフォルトはオフ）もあり、この 5 つがチャットセッションの消費するプラットフォームフラグです。`@tansr/sdk` 0.19.0 以降、`AppCapabilitiesSchema` はさらに 6 つの任意のプラットフォームフラグ `platform.embedding` / `rerank` / `document` / `music` / `voiceCreate` / `realtimeAudio` を認識し、合計 11 個になります。これらは対応する独立した非チャット HTTP 操作（`createPlatformNonchatClient` で明示的に呼ぶ）だけを認可し、**チャットツールを一切アセンブリせず、セッションに入ることもありません**。バンドルに不在なら `false` と同じで（`DEFAULT_APP_CAPABILITIES.platform` は引き続き最初の 5 つだけを列挙）、消費側は `=== true` だけをオンと見なしてください。この 6 つは `x-tansr-client-features` の新しい `nonchat-operations-v1` で交渉・配信され、`CLIENT_FEATURES` の語彙の変化によってアップグレード後の最初のアセンブリでは古いキャッシュに当たらずバンドルを取り直します。`CAPABILITY_TOOL_KEYS` / `CAPABILITY_PLATFORM_KEYS` が正式な情報源です。`tools.agent` がオンのとき Task サブエージェント系は自動的にアセンブリされ、サブエージェントはセッションのモデルと権限ゲートを継承します。

## webSearch になぜ 2 つのフラグがあるのか

ウェブ検索は表全体の中で唯一、両方の面にフラグを占める機能です。2 つのフラグは 2 つのツールではなく、**同じツールの 2 つのゲート**です：

- `tools.webSearch`（ガバナンス面）：WebSearch ツールがこのアプリのセッションアセンブリの語彙に現れてよいか。
- `platform.webSearch`（チャネル面）：プラットフォームの課金対象の検索チャネルがこのアプリに対して有効か。

理由は、webSearch ツール自体はリング 2（CLI と同じ `WebSearch`）にありながら、バックエンドが常にプラットフォームのチャネルだからです——SDK 形態には自前の検索エンドポイントを持ち込む道がなく、クライアントが検索プロバイダーのキーを持つことこそ、アプリキーの盗難防止モデルが排除しようとしているアンチパターンです。アセンブリの行列を一言でいえば、**暗黙の選択 = あるものを使い、フラグに応じて黙って縮む。明示的な選択 = 成り立たなければならない主張で、成り立たないときは読める・帰属のあるエラーで即座に失敗する**（`capability_disabled` か `invalid_options`）。

<a id="移动应用的公网工具"></a>

## モバイルアプリの公開ネットワークツール

モバイルアプリのセッションはあなたの `@tansr/serve` 上でアセンブリされます（ホスト型トポロジー）。この種のアプリがチェックできるツールフラグは `todoWrite`、`askUser`、`customTools`、`webFetch`、`http`、`webSearch` とプラットフォームフラグだけで、ファイルやコマンドなどのローカル系は固定でオフです。`customTools` は `clientTools` のリモートツールチャネルで宣言し、スマートフォンが実行します。

- **バージョン**：`tools.webFetch`（ウェブページ取得、WebFetch）と `tools.http`（HTTP リクエスト、Http）は `@tansr/serve` 0.12.0 / `@tansr/sdk` 0.17.0 以降（2026-09-16 公開。現行の 0.15.1 / 0.19.0 でも同様）でアセンブリされ、serve 0.11.0 以前はモバイルアプリにこの 2 つをアセンブリしません。どちらのフラグもデフォルトはオフで、コンソールでアプリに対して明示的に有効化する必要があります。`tools.webSearch` にはさらに `platform.webSearch` チャネルの有効化が必要です（前節を参照）。
- **どこで実行されるか**：3 つのツールはすべて**あなたのセッションサービスのホスト**で実行され、同じコアツールと権限チェーンを通ります。Android / iOS / HarmonyOS の SDK がスマートフォン上で代理してネットワークリクエストを送ることはなく、自動承認もしません。サーバー側で明示的に設定したツールの許可リストはさらに絞ることしかできません。
- **変更がいつ効くか**：機能フラグを変更しても、新しいセッションまたはストレージから再アセンブリされたセッションだけがそれを取り込みます。トークンの更新やプロンプトの再読み込みは実行中のセッションのツール表を変えません。緊急で取り消すには、該当するセッションを停止する必要があります。
- **実行の境界**：ホスト型の Http はホストの環境変数内の資格情報を参照できず、モデルが自力でホストのプライベートネットワークへのアクセス制限を解除することもできません。エグレスプロキシを設定する際は、プロキシ側でもプライベートネットワークの宛先を制限してください。WebFetch は既存のエグレスルールに従い、ホストをまたぐリダイレクトは新しい権限確認を発生させることがあります——エラーに示された公開の宛先に対して改めて明示的にリクエストしてください。リダイレクトを自動承認しないでください。
- **結果の読み方**：既知の URL にはまずエージェントに WebFetch を使わせ、API レスポンスの確認には Http を使います。Http の 4xx / 5xx は調べる必要のあるレスポンスです——ツールの完了はリモートの HTTP 呼び出しの成功を意味しません。検索結果が空なのはこのクエリに一致がなかったということに過ぎず、サイトが存在しないという意味ではありません。UI は切り詰めのヒントを保持しなければなりません。

## バンドルは他に何を配信するか

- **モデルカタログ**：alias / handle / `displayName` / `manufacturer` / `family`。`setModel` には handle を渡します。`model.modelId` は任意のフィールドで、読む側は `string | undefined` として扱います。`@tansr/sdk` 0.18.0 以降には読み取り専用の投影 `model.adapterDiagnostics?` もあり（`request` / `billing` の各節が `adapterId` / `operation` / `status ∈ 'ready' | 'review' | 'unresolved'` を持ち、加えて `conflicts[]`）、現在のカタログの根拠がリクエスト / 課金アダプターを選ぶのに十分かを示し、UI でモデルの呼び出し / 計量の能力を表示するためのものです。プロバイダーの資格情報、価格の原文、実行可能なアダプターオブジェクトは含まず、プラットフォームが配信しないときは `undefined` で、節の形が不正なら診断だけが落ち、モデルのエントリは落ちません。
- **メディア認可セット** `platformModels`：4 つのメディアツールの説明にはセット内のモデル名が自動的に列挙され、順序の先頭がデフォルトです。統合側がモデル名を手で設定することはありません。0.19.0 以降、トークン方式で直接呼ぶ `session.platform.speak()` の `SpeakInput` に任意の `voiceRef`（アプリ専用のプライベートボイスリソースの id。システムの `voice` とは排他で、スコープと対象モデルはプラットフォームが検証）が加わりました。プライベートボイス自体の作成と照会は非チャットクライアントで行い、バンドルでは配信されません。
- **プランの投影** `plan`：`{ tier, caps{ concurrency, apps, orgMembers, monthlyEndUsers, gatewayLane }, status: 'active' | 'grace' | 'lapsed', expiresAt }`。`null` = プランのない個人プロファイルです。これは投影に過ぎず、強制は常にサーバー側で行われ、SDK がローカルで制限を判断することはありません。
- **裁定者のプロファイル** `adjudicator`：トークン方式はデフォルトでコンソールで任命された裁定者をアセンブリし、その資格 `tier` が「確認」をどれだけの半径まで許可に和らげてよいかを決めます。

## onPlatformWarning：致命的でない降格はどう知らされるか

バンドルの解析とアセンブリにおける致命的でない事実は `createSession({ onPlatformWarning })` / `onWarning` で通知され、なければセッションイベントストリームの `turn.error { scope: 'sdk.notice', recoverable: true }` にフォールバックします。コンソールには出ず、アセンブリ結果も変えません。よくあるコード：

| コード | 意味 |
|---|---|
| `app_platform_mismatch` | アプリのプラットフォーム種別が統合形態と一致しない |
| `tools_platform_deprecated` | 古い `tools.platform` エイリアスが使われた |
| `capabilities_unparsed` | バンドルの `capabilities` 節はあるが解析に失敗した（`detail.issues` に zod の issues）。**SDK 0.13.0 以降で提供**：この場合はデフォルトプロファイルではなくゼロ機能プロファイル（`tools` すべて false）にフォールバックする。0.11.x はデフォルトプロファイルにフォールバックしていた |
| `adjudicator_unavailable` / `adjudicator_model_unavailable` / `adjudicator_budget_exhausted` / `adjudicator_breaker_tripped` | 裁定者が不在 / モデルが利用不可 / 予算の枯渇 / サーキットブレーカーの作動 |
| `adjudicator_skipped_by_mode` | 明示的な `permission.mode` によって裁定者がアセンブリされなかった。**SDK 0.13.0 以降で提供**：明示的な `permission.mode` は自己管理モードを採用してこの通知を出す。明示的な `adjudication` とモードの同居は引き続き拒否される。0.11.x にあったデフォルトの裁定者とモードの競合の制限は撤回された |

## 計量と照合

`cost.usage.updated` はリクエストごとにイベントストリームに届きます。エンドユーザーは `GET /v1/my-usage` で自分で確認し（金額フィールドは決して含まない）、開発者は `GET /v1/app-usage/by-end-user` で照合します（金額を含み、エンドユーザーには決して中継しない）。計量と課金は別物です——エンドユーザーにどう再販するかはあなた次第です。

0.19.0 以降、SDK はアプリのクォータのフィールドの形 `AppQuotaSchema` / `AppQuota`（`dailyTokens` / `endUserDailyTokens` / `rpm` は常に存在し null 許容。`tpm` と、`endUserDaily*` / `dailyOperationUnits` などのメディアと非チャット操作の回数は任意）をエクスポートしており、プラットフォームのアプリ設定を読み書きするときの検証に使えます。クォータは**バンドルでは配信されず**、強制は常にプラットフォーム側です。ローカルに持っているクォータの値は残量ではなく、SDK がそれを基にローカルで制限を判断することもありません。
