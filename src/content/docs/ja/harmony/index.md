---
title: 'HarmonyOS 導入ガイド'
description: 'ネイティブ ArkTS HAR の公開面、SessionView の還元、接続状態と 3 段階の復旧、ライフサイクル、ローカルツールと 2 つのブリッジ、音声の 2 つのチェーンと読み上げの 2 つのキャップ、メディアダウンロードの境界、そして認証情報とログの規律。'
zone: docs
category: harmony
related:
  - sdk/system-prompts
  - getting-started/harmony
  - getting-started/android
  - android
  - ios
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - security
sources:
  - tansr-harmony:README.md
  - tansr-harmony:CHANGELOG.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-harmony:doc/HM-01-Demo接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-10-13'
---

HarmonyOS SDK（HAR 座標 `@tansr/harmony`、現在の独立リリース版は 0.2.0、`harmony-sdk.zip` で配布、公開 OHPM には未掲載）はセッションサービスのネイティブ ArkTS 薄いクライアントです。エージェントセッションサービスの契約を実装し、すべてのリクエストは統一呼び出し面 `/api` から出ていきます。最低要件として HarmonyOS 6.0 / API 20（`compatibleSdkVersion`）を宣言し、API 22 ツールチェーンでビルドされ、Stage モデルを使います。このページではクイックスタートのあとに出会う設計上の論点を扱います。イベントがどう UI 状態になるか、切断からどう復旧するか、ツールとダイアログをどうつなぐか、音声とメディアをどうつなぐか。HAR は ArkUI のページを提供せず、マイクを自動で申請することもありません。サーバー側は `@tansr/serve` 0.15.1（npm latest、2026-10-10）に照らして 2026-10-13 に確認しました。0.2.0 HAR（2026-10-10 のリリース候補 `88d917c`、バイトコード HAR の SHA-256 `7d5deedb…`）以降、クライアントはサーバー側が 0.13.0 以降で提供する `/api` プレフィックスだけにリクエストを送ります（D10。`/v2` へはフォールバックしません）。パス、メソッド、エイリアス、レスポンスヘッダー名は manifest revision 7 から生成された `ApiContractGenerated` / `ApiOps` に由来し、セッションファミリーはリクエストヘッダー `tansr-session-family: sdk1 | sdk2-offload-v1` で運ばれます。400 以上のエラー本文は統一エンベロープで、統一コード + `retryAction` で判定します（D19）。2xx とイベントストリームに統一レスポンスヘッダーが欠けているときは明示的に失敗し、フォールバックしません（D38）。0.1.0 HAR は引き続き `/v2` に直結します——サーバー側の `/v2` は 0.13.0 以降は内部アダプターの入口にすぎず、1.0.0 で外部入口が削除されるので、0.2.0 へアップグレードしてください。スケジュールは[デプロイと認証](/ja/serve/deploy-and-auth/)を参照。

Android 互換の古い HarmonyOS 端末は引き続き [Android SDK](/ja/android/) を使います。HarmonyOS 5.x のネイティブ互換は今後の作業で、現時点では利用可能とは謳いません。現在の成果物は独立リリースされたバージョン付き release バイトコード HAR で、公開 OHPM にはまだ掲載されていません。署名インストールと実機マトリクスは本ページの範囲外です（0.2.0 のリリース受領書には署名済み HAP なし、実機実行なしと登記）。導入手順は [HarmonyOS SDK を 5 分で動かす](/ja/getting-started/harmony/)を参照。

## スマートフォン側はユーザーメッセージを送り、サーバー側がシステムプロンプトを設定する

`createSession` と `session.send(...)` はどちらも通常のユーザーメッセージを送信します。HarmonyOS SDK は `/api` のセッションリクエスト経由で `system` を渡しません。共有の役割はプラットフォームのアプリ設定で管理し、コードでカスタマイズする役割は serve の `platform.system` が提供し、ホストの説明は `platform.systemAppend` を使います。

プロンプトとポリシー機能は `@tansr/serve` 0.8.0 以降で利用でき、プラットフォーム側は 2026-09-14 に本番公開済みです。デフォルトの `fallback` では SDK の明示した `system`（空配列を含む）がプラットフォームのセグメントを置き換え、`prepend` ではプラットフォームのセグメントを先頭に保持します。プラットフォームのプロンプトとポリシーは次の新しいターンの前に更新され、実行中のターンは固定されます。フォアグラウンド / バックグラウンドの再接続、SSE の復旧、attach では元のセッションと履歴を保持できます。詳細は[アプリケーションシステムプロンプト](/ja/sdk/system-prompts/)を参照。

## 公開面

| エクスポート | 役割 |
|---|---|
| `TansrAgentClient` | セッションサービスの純粋な契約クライアント（`/api` 経由）：セッション作成 / メタ情報 / 履歴 / メッセージ送信 / 同一ターン入力 / 音声直結。ネットワークの結果が不確かなとき、変更系リクエストを自動で再送しません |
| `NativeHttpTransport` | システム RCP トランスポート。オプションで HTTPS、ループバック HTTP、イントラネット HTTP、タイムアウト、レスポンスキャップを制御。`NativeHttpOptions.certificateAuthorityPem` で自社サービス向けに PEM の CA バンドルを設定できます（このトランスポートの信頼ルートだけを置き換え、証明書チェーンとホスト名は引き続き検証） |
| `AuthProvider` / `RefreshingAuthProvider` / `StaticAuthProvider` | リクエストごとに認証ヘッダーを取得。リフレッシュ用ラッパーが有効期限、並行性、身元の変化を扱います |
| `AgentSession` | 1 本のイベントポンプ：`start` / `stop` / `close`、`send` / `sendBlocks`、ブリッジランタイム |
| `SessionView` | 純粋なイベント還元。JSON スナップショットは Android / iOS のゴールデンフィクスチャと同形 |
| `SpeechPlan` | 読み上げの事前チェック：プラットフォームの加重キャップとベンダーのアトミックな `inputLimit` の 2 つのキャップ。明示的な同意のあとで分割 |
| `historyArtifactData` / `isRenderableArtifact` | 履歴ツール成果物の投影。壊れたメディアプレビューはツール本来の成功 / 失敗を書き換えません |
| `API_CONTRACT` / `API_MANIFEST_REVISION` / `UnifiedCode` / `UnifiedRetryAction` | `/api` 契約生成物：プレフィックス、ヘッダー名、manifest revision、19 の統一コード / 6 つの再試行動作。81 操作のパステンプレートは SDK 内部でマニフェストから生成され、ホストが `/v2` などの旧パスを手で組み立てることはありません |
| `AgentError` / `ApiFacadeError` / `ApiContractError` | 統一エラー：SDK1 の `AgentError` は `unified` / `retryAction` / `domainCode` で統一エンベロープを復元。SDK 2.0 とターミナルサービス面は `ApiFacadeError` を直接投げます（`Sdk2HttpError` は非推奨、1 バージョンだけ保持）。レスポンスヘッダーゲート / エンベロープゲートの違反は `ApiContractError`（`contract_unavailable`） |
| `ApiCallOptions` | 3 つのリクエストヘッダー `Idempotency-Key` / `If-Match` / `deadline`。形が不正なら送信前にローカルで拒否 |
| `Sdk2Client` / `Sdk2Executor` / `NativeSdk2Transport` / `Sdk2ClientToolAdapter` | SDK 2.0 の薄いクライアントと明示的なトランスポート入口。端末側は明示的に許可されたデバイス操作だけを実行 |
| `openSdk2RdbArchiveReceiver` / `openSdk2EncryptedRdbArchiveReceiver` / `openSdk2RdbExecutionJournal` / `Sdk2ArchiveSyncClient` / `openSdk2RdbArchiveCache` / `Sdk2ReplicatedArchiveReceiver` | ローカル RDB アーカイブレシーバー（本文暗号化は任意、鍵は HUKS が保管）、RDB 耐久実行ジャーナル、アーカイブ同期とレプリカレシーバー |
| `TerminalClient` | ターミナルサービスクライアント（設定 / メモリコマンド）、`/api/terminal/*` 経由 |

0.2.0 HAR の公開エクスポートは合計 116 で、上記は導入時に直接触れる部分です。SDK に外部のランタイム依存はありません。ホスト HAP は `ohos.permission.INTERNET` を宣言する必要があります。

## イベント還元

```typescript
session.onFrame = (eventName, data, seq) => { /* 原始 SSE 帧 */ };
session.onHistory = (history) => view.restoreHistory(history.messages);
view.onChange = () => render(view.state);
session.onState = (state) => { /* idle / connecting / live / retrying / recovering / failed / closed */ };
```

- 未知の業務イベント型は `SessionView` が無視し、ストリームは切れません。`server.*` 制御フレームは `session.bridges` が消費するので、通常の `tool.permission.*` で承認を再度ポップアップさせないでください。
- `SessionView(textMode, thinkingMode)`：テキストは `stream` / `final`、思考にはさらに `off` があります。これは UI 投影であり、モデルの生成パラメータは変えません。
- ツールカード成果物は `historyArtifactData()` で形状に応じて取り出します。署名付きメディア URL は可視メッセージ層でだけ隠され、コア履歴と読み込みに使う元の受領書は変わりません。

## 接続状態と 3 段階の復旧

```text
idle → connecting → live
live → retrying（指数退避）→ live          // L1:携游标重连,收帧按 seq 去重
live → recovering（拉 /history 重建）→ live // L2:重连首帧收到 gap
404 或 live = false → resume 重灌            // L3:弃旧游标,以 history.lastSeq 为锚
```

`lastSeq` は常に値どおりに継続し、休眠の判定は常に `live = false` であって、決して `lastSeq == 0` ではありません。`@tansr/serve` 0.9.0 以降、休眠セッションのメタ情報 `lastSeq` はストアに永続化された真の水位です。`live = true` かつ `lastSeq == 0` のときは L2 だけを通り、resume はしません。

`AgentSession` の第 3 引数 `verifiedEndUserId` があるとき、メタ情報取得または resume 後に身元が一致しなければ失敗し、黙ってセッションを差し替えることはありません。sessionId / turnId / inputId / historyEpoch は不透明な識別子です。セグメントごとにエンコードし、trim も大文字小文字の畳み込みも Unicode 正規化も行いません。

401 またはプロトコルエラーは `failed` に入り、ポンプが止まります。ホストがログイン状態を直してから明示的に `start()` してください。`stop()` 後は状態が `idle` に戻り、セッションは終了していません。`close()` だけがリモートを DELETE します。

## ライフサイクル

| 入口 | 意味 |
|---|---|
| `start()` | ローカル購読を開始または再開。冪等 |
| `stop()` | ローカル購読とブリッジを取り消し、リモートセッションは失わない |
| `close()` | まず `stop`、次にリモートセッションの終了を要求。失敗はそのまま返し、終了済みを偽装しない |

バックグラウンドに回ったらポンプを止め、フォアグラウンドに戻ったら再び `start()` します。コンポーネントの解放とログアウトでは必ずこれらの入口を呼びます。ローカル購読を止めてもサーバー側の履歴が自動で DELETE されることはありません。新規セッション：`createSession` で ID が確定したら、まず元の認証スコープに永続化し、それから UI に結び付けます。保存に失敗したら自動で作り直してはいけません。復旧に失敗したら元のアンカーを保持します。

厳密な同一ターン追記では、まず `inputCapabilities()` の現在の target を取得してから `InputSubmission` を組み立てます。最初の POST の前に元の ID、target、本文を永続化します。未確認の状態は元の識別子でだけ照会し、自動再送、ID の変更、messages への縮退、interrupt は行いません。`accepted` は永続化済みでも回答済みでもありません。

## ローカルツールと 2 つのブリッジ

```typescript
session.bridges.registerTool(declaration, handler);
session.bridges.onPermission = (request) => {
  // 展示 request.payload 后:
  session.bridges.answerPermission(request.id, 'allow'); // 或 'deny'
};
session.bridges.onQuestion = (request) => { /* answerQuestion */ };
```

- 作成 / resume 時に渡す `clientTools` は実際に登録したハンドラーと一致していなければなりません。
- `parameters` はパラメータ名の辞書で、パラメータなしは `{}` です。読み取り専用の宣言でサーバーの裁定を回避することはできません。ハンドラーは `CancelToken` を監視する必要があります。
- `onPermission` を設定しなければデフォルトで拒否します。期限切れのリクエストは承認できません。通常の `tool.permission.*` は観察用にすぎません。
- 質問と権限は別のブリッジ族です。テキストの補足も質問への回答もツールの承認にはなりません。
- クライアントはすべてのツールに ask を強制しません。自動 allow、本当の ask、deny は serve がカーネルの裁定を再利用して決めます。

## 公開ネットワークツール：サーバー側で実行

アプリがコンソールで `tools.webFetch`、`tools.http`（`@tansr/serve` 0.12.0 以降が必要）または `tools.webSearch` を有効にすると、エージェントはウェブページの読み取り、HTTP リクエストの発行、ウェブ検索ができます。これらのツールはすべてあなたのセッションサービスのホストで実行されます。HAR が端末上で代わりにネットワークリクエストを出すことはなく、ツールを自動で承認することもありません。機能フラグの変更は新規作成されたセッション、またはストレージから再組み立てされたセッションに適用され、実行中のセッションでツールが自動的に増減することはありません。

- サンプルアプリのツールページは WebSearch、WebFetch、Http GET の公開ネットワーク例を提供します。選ぶと入力ドラフトに書き込まれるだけで、ユーザーが確認してから送信します。サーバー側が承認を求めたときは、チャットページの上部に「確認待ちのリクエスト」入口が固定表示されます。
- HTTP ステータス、ネットワークエラー、取得失敗はツールの実際の結果に従って解釈します。検索結果が空でもサイトが存在しないことにはならず、既知のドメインは WebFetch に明示的に読ませることができます。
- 機能スイッチ、実行境界、ホストをまたぐリダイレクトの承認ルールは[モバイルアプリ向けの公開ネットワークツール](/ja/sdk/platform-bundle/#移动应用的公网工具)を参照。

SDK 2.0 はサーバー側では `@tansr/serve` 0.13.0 / 0.14.0 とともに公開済みです（`@tansr/serve/extensions` の明示的ホストと `/api` 統一呼び出し面）。HarmonyOS 側では 0.2.0 HAR 以降、明示的なトランスポート入口 `NativeSdk2Transport`、薄いクライアント `Sdk2Client` / `Sdk2Executor`、ローカル RDB アーカイブレシーバー（`openSdk2RdbArchiveReceiver`。本文暗号化は任意で `openSdk2EncryptedRdbArchiveReceiver`、鍵は HUKS が保管）、RDB 耐久実行ジャーナル `openSdk2RdbExecutionJournal`、アーカイブ同期 `Sdk2ArchiveSyncClient` とレプリカレシーバー、そしてターミナルサービスクライアント `TerminalClient` がパッケージに含まれます。これらは加法的な機能で、明示的に組み立てなければ同期ストアは作られず SDK 2.0 リクエストも送られず、SDK1 のセッション挙動は変わりません。実機での受け入れはリリース受領書の範囲外です。2026-10-10 のリリース候補より後にメインラインへ入った暗号化メモリ公開、ソース保持移行の鍵ローテーション、暗号化増分 RDB プロファイル、読み取り専用レプリカなどの永続化機能は**まだどの HAR バージョンでも公開されておらず**、本ページでは説明しません。組み立てと境界は [SDK 2.0 拡張の入口](/ja/sdk/sdk2-preview/)を参照。

## 音声：2 つのチェーン

音声はプロトコルレベルの入力種別ではありません（メッセージブロックにもイベントストリームにも入りません）。

1. **ツールチェーン**：エージェントが自ら `SpeechToText` / `TextToSpeech` を呼び、成果物はツール完了イベントで端末に届き、履歴投影を通じて描画されます。
2. **直結チェーン**（あなた自身の音声 UX）：

```typescript
const transcript = await client.audioTranscribe(session.sessionId, 'audio/mp4', base64, undefined, cancel, 'zh');
const speech = await client.audioSpeech(session.sessionId, assistantText, undefined, undefined, cancel, 'wav');
```

`audioSpeech` の `format` は `wav` / `mp3` だけを受け付け、渡さなければリクエストフィールドは省略されます。`audioTranscribe` の `language` は 2〜16 の UTF-16 コード単位で、そのまま渡されます。どちらも `CancelToken` のあとに追加されており、既存の呼び出しに変更は要りません。パラメータが不正なときは、SDK が認証とリクエスト送信の前に `validation_failed` を返します。フォーマットが採用されるかどうかは引き続きプラットフォームと選択したモデルが決め、リクエストのフォーマットに合わせて受領書の MIME を書き換えてはいけません。合成受領書内の実際の音声フィールドだけがダウンロード、再生、計量の根拠です。

ネイティブ録音（M4A/AAC、MIME `audio/mp4`）はホストの配線です。STT の制約 `formats` は `m4a` を明示的に含む必要があり、`maxSeconds` は有効で 1 秒以上でなければなりません。文字起こしはドラフトに書き込むだけで、自動送信しません。キャンセル、セッション切り替え、バックグラウンド移行後に遅れて届いた結果を誤った場所に書き込んではいけません。HAR はマイクを自動で申請しません。

読み上げは `SpeechPlan.prepare()` でプレビューし、プラットフォームの加重キャップとベンダーのアトミックな `inputLimit` の両方を守ります。長文は分割への明示的な同意が必要で、各セグメントの送信前に許可キャップを再確認します。分割は Unicode コードポイント境界で行います。完了したセグメントはキャッシュして再生し、結果が未確認のセグメントは uncertain と印を付けて停止し、自動では再生成しません。`SpeechPlan.reset(index)` は確認済みまたは uncertain のセグメント 1 つだけをリセットし、各セグメント最大 3 回、リクエストは送りません。ホストは先に実際の合成 Promise が完了したことを確認し、使用量を照合し、明確なリセット意思を得なければなりません。分割が許可されている場合、最初のセグメント 120、以降 360 加重文字は Android と共通のレイテンシのソフトターゲットで、常にハードキャップ——セグメントあたり 20000 UTF-16 コード単位、全文 32000 加重文字、最大 32 セグメント——に従います。

## メディアと観測

メディアの許可は `media.capabilities` / `media.models` の `imageGen`、`videoGen`、`speechToText`、`textToSpeech` から読み取り、`image` / `video` と書いて未許可と誤判定してはいけません。画像入力は IR の `text` + `image` ブロックです。メインモデルのネイティブな audio/video 入力ブロックはまだ提供されていません。画像と動画の生成はサーバー側のシステムツールが実行します。

ネイティブのメディアダウンロードは独立した `downloadMedia()` を使います。HTTPS、認証ヘッダーなし、リダイレクトに従いません。デフォルト 16 MiB、既存の成果物は明示的に 128 MiB まで設定できます。タイムアウト、期限切れ、キャンセル、不正なフォーマットのいずれも自動的な有料再生成を引き起こしてはいけません。大きなメディアはサービス側がアクセス可能な URL を提供すべきで、スマートフォンのバッファを際限なく広げて回避してはいけません。

`meta()` はサーバー側の実際のモデル、コンテキスト、任意のメディア観測を読み取ります。欠けている値は「未知」のままです。現在の wire にはセッション内でモデルを切り替える HTTP はありません。`selected`、`active`、`lastObserved` は別々の事実です。課金使用量からウィンドウ占有を逆算することはできません。ベンダーの KV キャッシュはローカルのセッション / 音声キャッシュとは別物で、ヒット率のために有料のキープアライブリクエストを送ってはいけません。

## 認証情報とログの規律

- 端末の認証情報 = あなたのログイン状態。SDK は `AuthProvider` 経由でリクエストごとに取得するだけで、Preferences / ファイル / ログに決して永続化しません。
- appkey は SDK / サンプルコードの面にはそもそも概念として存在せず、`app_user` トークンが端末に配られることもありません。
- チケット更新の単一飛行、送信ヘッダーのスナップショット、身元と世代の検証：古いチケットの 401 が遅れて届いても強制更新を繰り返してはならず、キャンセルやユーザー切り替えのあとに届いた応答が何かを復活させてはいけません。
- ツールの応答もツールの宣言も信頼できない入力です。端末はリバースエンジニアリングされ改変され得るので、「自社アプリだから」と警戒を緩めないでください。

## 端末側のリソース境界

| 項目 | 現在のデフォルト |
|---|---|
| SSE フレームバッファ | 16 Mi UTF-16 文字。`AgentSession` の第 5 引数で調整可能、最大 32 Mi。キャップ超過で停止しプロトコルエラーを報告 |
| JSON | 32 Mi 文字、64 階層。重複キー、非有限数値、壊れた構造を拒否 |
| ネイティブの通常レスポンス | 32 MiB。エラー本文は 64 KiB |
| メディアダウンロード | デフォルト 16 MiB、明示的に 128 MiB まで |
| ビューのローカル状態 | 通知 20 件、ツール出力の末尾 4000 UTF-16 文字。チャット履歴を自動で切り詰めることはない |

これらは端末側のリソース境界であって、すべての上流メディアの最大値ではありません。上流で正当なインライン Base64 がこのキャップを超えることもあり、その場合は明示的にストリームを止める / 拒否し、受信成功を主張しません。`SessionView` はセッションメッセージの完全な投影を保持し、超長セッションのリスト仮想化はホストの責任です。

## 結合テストとビルド

- リポジトリ内の `examples/serve-demo` につなぐ場合：`pnpm start` / `pnpm real` はどちらも実モデルの入口で、常駐の結合テストでは `DEMO_SERVE_ONLY=1`、`DEMO_PORT=8788` で起動します（ソースのデフォルトポートは 8799。公開された echo 起動コマンドはもうありません）。独立した開発者ログインサービス `pnpm login` のデフォルトは `127.0.0.1:8787`。Demo の `DeveloperLogin` はホストのアダプターであり、HAR 内蔵のログインではありません。まずあなたのログインサービスに `POST /login` して短期チケットを得て（`POST /refresh` で更新）、そのチケットで serve の `/api` にアクセスします。独自のログインプロトコルはこのアダプターを置き換えるだけで、SDK のセッション帰属は変えません。
- 平文 http はループバックまたは明示的なイントラネットだけ。本番では常に TLS を使います（自社 CA は `NativeHttpOptions.certificateAuthorityPem` で設定し、証明書エラーを無視しない）。
- SDK リポジトリのゲート：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm check:contract`。ネイティブ：`./scripts/native.ps1 -Action lint` / `har` / `hap` / `test-hap`（ツールチェーンは DevEco Studio 6.0.2 / HarmonyOS SDK API 22）。
- サンプル HAP はチャット、接続、詳細、メディア、ツールの 5 種のナビゲーションを示すもので、SDK が保証する UI 契約ではありません。公開ダウンロードの `harmony-demo.zip` の `libs/` には同じ 0.2.0 HAR と `SHA256SUMS` が同梱されています。
