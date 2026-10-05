---
title: 'アプリケーションシステムプロンプトと SDK の結合ポリシー'
description: 'アプリのデフォルトプロンプトを設定し、fallback または prepend を選び、SDK の system、ホストの systemAppend、通常のユーザーメッセージを区別し、履歴を保持したセッションで後続のプラットフォーム更新を読み込みます。'
zone: docs
category: sdk
related:
  - getting-started/sdk
  - getting-started/serve
  - getting-started/android
  - getting-started/harmony
  - sdk/platform-bundle
  - sdk/sessions-and-events
  - security
sources:
  - tansr-api:src/control/apps-routes.ts
  - tansr-api:src/contract/schemas.ts
  - tansr-cli:packages/sdk/src/platform/system-prompt.ts
  - tansr-cli:packages/sdk/src/platform/application-prompt-turn.ts
  - tansr-cli:packages/sdk/src/session.ts
  - tansr-cli:packages/sdk/src/query.ts
  - tansr-cli:packages/sdk/src/run-agent.ts
  - tansr-cli:packages/server/src/v2/agent-session-factory.ts
  - tansr-cli:packages/server/src/v2/platform-session-factory.ts
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-05'
---

このページは `@tansr/sdk@0.13.0` 以降（現行 0.18.1）と `@tansr/serve@0.8.0` 以降（現行 0.14.0）に対応し、いずれも npm に公開済みです。tansr CLI も 0.6.0 以降で同じ挙動です（現行 0.10.1）。プラットフォーム側の `systemPrompt` / `systemPromptPolicy`（API とコンソール）は 2026-09-14 に本番公開済みです。SDK 0.14.0 から 0.18.1、serve 0.9.0 から 0.14.0 の間、このページの結合ポリシー、`applicationPrompt` の読み取り専用サマリー、更新のタイミングに変更はありません。それより古い SDK / serve はプラットフォームのプロンプトやポリシーに対応しない場合があり、プラットフォーム側の設定だけでは利用可否を判断できません。セッションサービス側のプロンプト組み立ては、`/v2` 直結面でも 0.13.0 以降の `/api` 統一呼び出し面でも同じ挙動で、ドメインペイロードのバイト列は変わりません。

アプリ管理者はコンソールの「アプリ → 概要 → アプリケーションシステムプロンプト」で、役割、回答スタイル、業務ガイドを一元管理できます。開発者は SDK で `system` を渡すこともできます。2 つのソースは独立して使うことも、プラットフォーム設定で結合方法を選ぶこともできます。

## 3 種類のテキストをどこに置くか

| テキスト | 入口 | 用途 |
|---|---|---|
| アプリ業務プロンプト P | プラットフォームの `systemPrompt` | アプリ全体で共有する役割と業務説明。変更してもクライアントの再パッケージは不要 |
| SDK 業務プロンプト S | `query` / `createSession` の `system`、または serve の `platform.system` | コードで管理し、今回のアセンブリ向けにカスタマイズが必要な業務ガイド |
| ホスト追加ガイド A | `systemAppend`、または serve の `platform.systemAppend` | 実行環境、表示方法などの補足説明。プラットフォームデフォルトの上書きを引き起こさない |
| 通常のユーザー入力 | `query.prompt`、`session.send()`、`/v2` リクエストの `prompt` | このターンの質問と会話内容。常にユーザーメッセージ |

プラットフォームは運用側が一括で変更し、クライアントのリリースを減らすのに向いています。SDK で渡す方法はコードレビュー、バージョン管理、シーンごとの構築に向いています。プラットフォーム側の変更は API と消費側の対応が必要で、セッションが次の新しいターンの開始前に読み込みます。履歴の破棄やセッションの再作成は求められません。SDK での書き込みは通常コードのリリースが必要で、プラットフォームのデフォルトを意図せず上書きする可能性もあります。共有の役割はプラットフォームに、ホストの説明は `systemAppend` に置くと、この誤った上書きを減らせます。

プロンプトはモデルのリクエストに入るため、キーの保管に使ってはいけません。デスクトップ SDK はアプリの bundle も受け取るため、プラットフォームのプロンプトをクライアントに対して秘密にできる内容として扱うことはできません。

## fallback / prepend の真理値表

P は空でないプラットフォームプロンプト、S は SDK が明示的に渡した空でないセグメントのリストを表します。表には業務セグメントだけを載せ、後続の A とツールガイドは含みません。

| プラットフォームのポリシー | SDK の `system` | P あり | P なし |
|---|---|---|---|
| `fallback`（デフォルト） | 未指定 / `undefined` | P | 業務セグメントなし |
| `fallback` | S | S | S |
| `fallback` | `[]` | 業務セグメントなし | 業務セグメントなし |
| `prepend` | 未指定 / `undefined` | P | 業務セグメントなし |
| `prepend` | S | P → S | S |
| `prepend` | `[]` | P | 業務セグメントなし |

コンソールで「SDK から渡されたときもプラットフォームのプロンプトを保持する」にチェックを入れると `prepend`、外すと `fallback` です。古い bundle にポリシーがない場合は `fallback` として扱われます。`[]` は明示的に空の業務セグメントを渡すことを意味し、その意味はポリシーによって異なります。`systemAppend` や独立してアセンブリされるツールガイドは取り除きません。

完全な順序は次のとおりです：**ポリシーで選ばれた P / S → `systemAppend` → 該当するツール / Skills / MCP のガイド**。後者が存在するかどうかは入口、機能フラグ、登録項目に依存し、すべての入口がすべてのガイドをアセンブリするわけではありません。同じプラットフォームのセグメントを自分でもう一度結合しないでください。SDK は類似テキストによる重複排除を行いません。

順序はリクエストの組み立て方を定義するだけで、**矛盾する指示をモデルがどう裁定するかは保証しません**。`prepend` は権限の強制ではありません。アプリ管理者は P と S の矛盾を解消すべきで、機能フラグ、ツール権限、裁定者、人間による確認は引き続きそれぞれの仕組みで実行されます。既存の「アプリの用途」は裁定者が業務の境界を判断するためのもので、メインエージェントのシステムプロンプトの代わりにはなりません。

## プラットフォーム設定の書き込みと読み取り

これはアプリ管理インターフェースで、そのアプリの管理権限を持つログインアクセストークンを使います。エンドユーザー向けの `app_user` トークンのインターフェースではなく、appkey を管理者の身元の代わりに使うこともありません。組織のアプリでは対象組織の `x-tansr-org` も付ける必要があり、書き込み権限は API が検証します。

```bash
# ACCESS_TOKEN 为应用管理者的登录访问令牌；APP_ID 为应用标识。
curl --fail-with-body -X PUT "https://api.tansr.com/v1/apps/$APP_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt":"你是订单助手。回答简洁，不编造订单状态。","systemPromptPolicy":"prepend"}'

# 读取走应用详情，字段位于响应的 config 内。
curl --fail-with-body "https://api.tansr.com/v1/apps/$APP_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

組織のリクエストでは上記 2 つのコマンドの両方に `-H "x-tansr-org: $ORG_ID"` を追加します。個人のリクエストではこのヘッダーを付けません。

- `systemPrompt` は最大 16000 Unicode 文字で、先頭と末尾の空白は取り除かれます。`null` または空白のみのテキストで空になります。
- `systemPromptPolicy` は `fallback` / `prepend` のみを受け付け、デフォルトは `fallback` で、`null` は受け付けません。
- PUT でフィールドを省略すると、そのフィールドは維持されます。ポリシーだけを切り替えるには `{"systemPromptPolicy":"prepend"}` を、テキストを空にするには `{"systemPrompt":null}` を渡せます。後者はポリシーをリセットしません。
- 古い API がプロンプトのフィールドを返さない場合、コンソールは盲目的な書き込みを禁止します。ポリシーのフィールドだけが欠けている場合、テキストは編集できますが、ポリシーの切り替えは使えません。

## Node / Windows Electron：SDK のメインプロセスでのアセンブリ

以下のトークンは、あなたのバックエンドがログイン済みユーザー向けに発行します。Windows Electron ではメインプロセスで SDK を実行し、IPC を通じて renderer にビューと入力チャネルを提供します。appkey や管理アクセストークンを renderer にパッケージしないでください。

単一ターンの `query`。`system` を省略してプラットフォームのデフォルトを使い、ホストの説明だけを追加します。

```ts
import { query } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const run = query({
  token,
  baseUrl: 'https://api.tansr.com',
  prompt: '查询订单前，需要我提供什么信息？',
  systemAppend: [{ text: '输出纯文本，避免依赖网页交互控件。' }],
  tools: { builtin: [] },
});
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
console.log(step.value.reason);
```

マルチターンの `createSession`。SDK 独自の業務セグメントが必要なときは `system` を明示的に渡します。

```ts
import { createSession } from '@tansr/sdk';

const token = process.env.TANSR_APP_USER_TOKEN;
if (!token) throw new Error('Missing short-lived app_user token');

const session = await createSession({
  token,
  baseUrl: 'https://api.tansr.com',
  system: [{ text: '本次接入面向售后咨询，请先确认用户的问题。' }],
  systemAppend: [{ text: '界面支持 Markdown 列表，不支持 HTML。' }],
  tools: { builtin: [] },
});
console.log(session.applicationPrompt); // 只有 source / policy，没有提示词正文。
const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();
try {
  session.send('退货前需要准备什么？');
  await session.idle();
} finally {
  session.close();
  await pump;
}
```

`AgentSession.applicationPrompt` は読み取り専用のソース概要で、`{ policy: 'prepend', source: 'platform+sdk' }` のような形です。`source` は `none` / `platform` / `sdk` / `platform+sdk` のいずれかで、P / S のソース選択だけを記述し、本文は含まず、`systemAppend` もソースに数えません。`fallback` で明示的に `[]` を渡した場合のソースは `sdk` で、業務セグメントが空でも同じです。`prepend` で P があり SDK が `[]` のときのソースは `platform` です。

## 低レベルの runAgent：業務セグメントを手動で選ぶ

`runAgent` は bundle を取得せず、ツール、Skills、MCP のガイドも自動追加しません。呼び出し側が `system` で完全なシステムセグメントを提供します。注入方式の `query({ client, model, ... })` も同様にプラットフォーム設定やツールガイドをアセンブリしませんが、明示的な `systemAppend` は `system` の後に続けます。どちらも、プラットフォーム設定の読み取りと更新を呼び出し側が自分で管理する必要があります。

信頼できるホストでアプリ設定をすでに取得・検証している場合は、`resolveApplicationSystem` を明示的に呼び出してから低レベルの入口に渡せます。以下は完全な関数です。`client` / `model` はあなたのモデルアダプター層が提供し、`platform` は検証済みの設定または bundle から来ます。クライアントが送信した値を直接信頼しないでください。

管理 API で未設定の本文は `null` です。ヘルパー関数に渡す前に `config.systemPrompt ?? undefined` で省略に変換してください。bundle 自体はキーの欠落で本文なしを表します。

```ts
import {
  resolveApplicationSystem,
  runAgent,
  type IRSystemSegment,
  type ModelClient,
  type ResolvedModel,
  type SystemPromptPolicy,
} from '@tansr/sdk';

export async function answer(
  client: ModelClient,
  model: ResolvedModel,
  platform: { systemPrompt?: string; systemPromptPolicy?: SystemPromptPolicy },
  prompt: string,
  sdkSystem?: IRSystemSegment[],
) {
  const selected = resolveApplicationSystem(platform, sdkSystem);
  const hostGuide = [{ text: '回答须适合纯文本界面。' }];
  const run = runAgent({
    client,
    model,
    prompt,
    system: [...selected.system, ...hostGuide],
    tools: [],
    maxTurns: 8,
  });
  for await (const event of run.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
  return selected.info; // 与 applicationPrompt 同形，不含正文。
}
```

`resolveApplicationSystem` はセグメントの選択、コピー、結合だけを行い、ネットワークを読まず、業務権限を検証せず、テキストの矛盾も解決しません。呼び出し側がツールガイドを必要とする場合は、ホストガイドの後に該当する内容を自分でアセンブリする必要もあります。

## Android / iOS / HarmonyOS：serve ホストで設定する

Android / iOS / HarmonyOS は `/v2` の薄いクライアントで、メインエージェントはあなたの `@tansr/serve` で動きます。モバイル側は通常のユーザーメッセージを送信し、**`/v2` 経由で `system` や `systemAppend` を設定しません**。Android / iOS は `CreateSessionRequest(prompt=...)`、`session.send(...)` を使い、HarmonyOS は `createSession`、`session.send(...)` を使います。

プラットフォーム共通の役割を使うときは `platform.system` を省略します。ホストの説明は `platform.systemAppend` に置きます。コードで管理する業務上の役割が必要なときだけ `platform.system` を設定し、これは同じ真理値表に従います。

```ts
import { createAgentSessionFactory, createServeAgentSessionStore } from '@tansr/serve';

const appId = process.env.TANSR_APP_KEY_ID;
const appKey = process.env.TANSR_APP_KEY;
if (!appId || !appKey) throw new Error('Missing server-side app credentials');

const build = createAgentSessionFactory({
  platform: {
    apiBaseUrl: 'https://api.tansr.com',
    appId,
    appKey,
    // 可选业务段；不需要宿主覆盖/拼接业务角色时删除这一项。
    system: [{ text: '面向移动端售后咨询，先澄清问题再回答。' }],
    systemAppend: [{ text: '回复适合手机屏幕；需用户确认时使用已接入的交互工具。' }],
  },
  store: createServeAgentSessionStore({ dir: './data/sessions' }),
  cwd: process.cwd(),
});

// 将 build.factory / build.storeReader 接到 startServer 的 v2 配置。
// 完整 authenticate 与启动示例见“会话服务 5 分钟跑通”。
```

[セッションサービスのクイックスタート](/ja/getting-started/serve/)、[Android / iOS のクイックスタート](/ja/getting-started/android/)、[HarmonyOS SDK のクイックスタート](/ja/getting-started/harmony/)を参照してください。appkey とプラットフォームの短期トークンは serve に留まり、デバイスはあなたの業務ログイン状態だけを使います。

## 変更後、いつ有効になるか

プラットフォーム接続モードでは、SDK / serve は**新しいターンの開始前に毎回プラットフォームの `systemPrompt` と `systemPromptPolicy` を検証し、同じセッションと履歴を保持します**。設定が変わっていなければ ETag により 304 が返ります。毎ターン検証するので、60 秒のキャッシュ期限を待つ必要はありません。実行中のターンはそのターンで選ばれた設定を引き続き使い、複数ステップのツールループの途中で置き換わることはありません。更新を受け取るためにセッションを閉じたり、チャット履歴を消したり、新しいセッションを作ったりする必要はありません。

スマートフォンがフォアグラウンドに戻ったとき、SSE の再接続、attach では既存のセッションを引き続き使え、後続のターンはプラットフォームの更新経路を通ります。ストレージからの resume でも既存の履歴が保持されます。ここで更新されるのはプラットフォームの P と policy で、ホストの S（`system`）と A（`systemAppend`）は引き続きコードとセッション設定で管理され、セッション内で S / A を変更するインターフェースは追加されません。

古いメッセージと圧縮サマリーは保持され、新しいプロンプトに従って書き直されることはありません。プラットフォームのプロンプトが変わると後続リクエストのシステムプレフィックスが変わり、プレフィックスキャッシュのヒット率とコストに影響する可能性があります。コンテキストマネージャーも古い token 計測アンカーを無効化し、新しいリクエストに基づいて予算を再見積もりします。累計費用、履歴、添付ファイルの状態、サーキットブレーカーの状態は維持されます。設定変更のない 304 ではこの再見積もりは発生しません。この更新経路はツール、権限、モデル、料金設定を同時にホットアップデートしません。

更新で HTTP エラーや無効な設定に遭遇した場合、そのターンではモデルを呼び出さず、まだ実行されていないこのユーザーメッセージを永続履歴に書き込まず、`applicationPrompt` も更新しません。既存の履歴とそれ以前のソース概要は保持され、ホストはユーザーに元のセッションで再送するよう促せます。イベントはまず `turn.error`（`errorKind: 'application_prompt_refresh_failed'`）を報告し、次に `turn.aborted`（`reason: 'model_error'`）を報告します。失敗イベントを受け取った後に、勝手に成功した返答として表示しないでください。

更新の事前チェックはキャンセルをサポートし、30 秒のタイムアウト後にそのターンを終了します。タイムアウト時の `turn.aborted.reason` は `timeout` です。キャンセルやタイムアウトの後に遅れて届いた設定レスポンスはモデルを起動しません。`applicationPrompt` は新しい設定の選択に成功して使い始めた後に更新されます。更新に失敗した場合に読み取ると、依然として前回成功したソース概要です。

この更新経路は `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 以降で利用できます。それより古いバージョンは、プラットフォームのフィールドが存在するからといって自動的に更新機能を備えるわけではありません。受け入れ検証では、プラットフォームテキストの変更、クリア、ポリシーの切り替え、304、実行中の設定変更、更新の失敗と再試行、キャンセルとタイムアウト、更新前後でメッセージとサマリーが保持されることをカバーすべきです。

トラブルシューティングでは、まず `session.applicationPrompt` の source / policy を確認し、次にプラットフォームのアプリ設定とホストのコードを確認します。この概要はアセンブリのソースを確認するだけで、モデルの回答がすべての指示に従うことは保証しません。チャット欄で「あなたは今から……」と入力してシステム設定が更新されたかを検証しないでください。
