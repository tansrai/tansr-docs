---
title: '애플리케이션 시스템 프롬프트와 SDK 결합 정책'
description: '앱 기본 프롬프트를 설정하고, fallback 또는 prepend를 선택하고, SDK system, 호스트 systemAppend, 일반 사용자 메시지를 구분하며, 기록을 유지한 세션에서 후속 플랫폼 업데이트를 불러옵니다.'
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
lastVerified: '2026-10-13'
---

이 페이지는 `@tansr/sdk@0.13.0` 이상(현재 0.19.0)과 `@tansr/serve@0.8.0` 이상(현재 0.15.1)을 기준으로 하며, 모두 npm에 게시되었습니다. tansr CLI도 0.6.0부터 같은 동작을 합니다(현재 0.10.3). 플랫폼 측 `systemPrompt` / `systemPromptPolicy`(API와 콘솔)는 2026-09-14에 프로덕션에 공개되었습니다. SDK 0.14.0부터 0.19.0, serve 0.9.0부터 0.15.1 사이에 이 페이지의 결합 정책, `applicationPrompt` 읽기 전용 요약, 새로 고침 시점에는 변화가 없습니다. 그보다 이전의 SDK / serve는 플랫폼 프롬프트나 정책을 지원하지 않을 수 있으므로 플랫폼 설정만으로 지원 여부를 판단하지 마세요. 세션 서비스 쪽 프롬프트 조립은 `/v2` 직접 연결 표면과 0.13.0부터의 `/api` 통합 호출 표면에서 같은 동작을 하며, 도메인 페이로드 바이트는 변하지 않습니다.

앱 관리자는 콘솔의 "앱 → 개요 → 애플리케이션 시스템 프롬프트"에서 역할, 답변 스타일, 업무 지침을 한곳에서 관리할 수 있습니다. 개발자는 SDK에서 `system`을 전달할 수도 있습니다. 두 출처는 독립적으로 사용할 수도 있고, 플랫폼 설정으로 결합 방식을 선택할 수도 있습니다.

## 세 가지 텍스트를 어디에 두는가

| 텍스트 | 진입점 | 용도 |
|---|---|---|
| 앱 업무 프롬프트 P | 플랫폼 `systemPrompt` | 앱 전체가 공유하는 역할과 업무 설명. 수정해도 클라이언트를 다시 패키징할 필요 없음 |
| SDK 업무 프롬프트 S | `query` / `createSession`의 `system`, 또는 serve의 `platform.system` | 코드로 관리하며 이번 어셈블리에 맞춤이 필요한 업무 지침 |
| 호스트 추가 지침 A | `systemAppend`, 또는 serve의 `platform.systemAppend` | 실행 환경, 표시 방식 등 추가 설명. 플랫폼 기본값 덮어쓰기를 유발하지 않음 |
| 일반 사용자 입력 | `query.prompt`, `session.send()`, `/v2` 요청의 `prompt` | 이번 턴의 질문과 대화 내용. 항상 사용자 메시지 |

플랫폼은 운영 측이 통일해서 수정하고 클라이언트 릴리스를 줄이기에 적합합니다. SDK 전달은 코드 리뷰, 버전 관리, 시나리오별 구성에 적합합니다. 플랫폼 수정은 API와 소비 측의 호환이 필요하며, 세션이 다음 새 턴 시작 전에 불러옵니다. 기록을 버리거나 세션을 다시 만들 것을 요구하지 않습니다. SDK 기록은 보통 코드 릴리스가 필요하며, 플랫폼 기본값을 의도치 않게 덮어쓸 수도 있습니다. 공유 역할은 플랫폼에, 호스트 설명은 `systemAppend`에 두면 이런 잘못된 덮어쓰기를 줄일 수 있습니다.

프롬프트는 모델 요청에 들어가므로 키를 보관하는 데 쓰면 안 됩니다. 데스크톱 SDK는 앱 bundle도 받으므로, 플랫폼 프롬프트를 클라이언트에 대해 비밀인 내용으로 취급할 수 없습니다.

## fallback / prepend 진리표

P는 비어 있지 않은 플랫폼 프롬프트, S는 SDK가 명시적으로 전달한 비어 있지 않은 세그먼트 목록을 나타냅니다. 표에는 업무 세그먼트만 나열하며, 후속 A와 도구 지침은 포함하지 않습니다.

| 플랫폼 정책 | SDK `system` | P 있음 | P 없음 |
|---|---|---|---|
| `fallback`(기본값) | 전달 안 함 / `undefined` | P | 업무 세그먼트 없음 |
| `fallback` | S | S | S |
| `fallback` | `[]` | 업무 세그먼트 없음 | 업무 세그먼트 없음 |
| `prepend` | 전달 안 함 / `undefined` | P | 업무 세그먼트 없음 |
| `prepend` | S | P → S | S |
| `prepend` | `[]` | P | 업무 세그먼트 없음 |

콘솔에서 "SDK 전달 시 플랫폼 프롬프트 유지"를 체크하면 `prepend`, 끄면 `fallback`입니다. 이전 bundle에 정책이 없으면 `fallback`으로 처리합니다. `[]`는 빈 업무 세그먼트를 명시적으로 전달한다는 뜻이며, 의미는 정책에 따라 다릅니다. 이것은 `systemAppend`나 독립적으로 어셈블리되는 도구 지침을 제거하지 않습니다.

전체 순서는 다음과 같습니다: **정책이 선택한 P / S → `systemAppend` → 해당하는 도구 / Skills / MCP 지침**. 후자가 존재하는지는 진입점, 기능 플래그, 등록 항목에 따라 다르며, 모든 진입점이 모든 지침을 어셈블리하는 것은 아닙니다. 같은 플랫폼 세그먼트를 직접 다시 결합하지 마세요. SDK는 유사 텍스트로 중복 제거하지 않습니다.

순서는 요청이 어떻게 조립되는지만 정의하며, **모델이 서로 모순되는 지시를 어떻게 판정할지는 보장하지 않습니다.** `prepend`는 권한 강제가 아닙니다. 앱 관리자는 P와 S의 모순을 해소해야 하며, 기능 플래그, 도구 권한, 판정자와 사람의 확인은 여전히 각자의 메커니즘이 실행합니다. 기존의 "앱 용도"는 판정자가 업무 경계를 판단하는 데 쓰이며, 메인 에이전트의 시스템 프롬프트를 대체할 수 없습니다.

## 플랫폼 설정 쓰기와 읽기

이것은 앱 관리 인터페이스이며, 해당 앱의 관리 권한을 가진 로그인 액세스 토큰을 사용합니다. 최종 사용자를 위한 `app_user` 토큰 인터페이스가 아니며, appkey로 관리 신원을 대신하지도 않습니다. 조직 앱은 대상 조직의 `x-tansr-org`도 함께 보내야 하며, 쓰기 권한은 API가 검증합니다.

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

조직 요청은 위 두 명령 모두에 `-H "x-tansr-org: $ORG_ID"`를 추가합니다. 개인 요청은 이 헤더를 붙이지 않습니다.

- `systemPrompt`는 최대 16000 Unicode 문자이며, 앞뒤 공백은 제거됩니다. `null` 또는 공백만 있는 텍스트는 비웁니다.
- `systemPromptPolicy`는 `fallback` / `prepend`만 받으며, 기본값은 `fallback`이고 `null`은 받지 않습니다.
- PUT에서 어떤 필드가 없으면 그 필드는 유지됩니다. 정책만 바꾸려면 `{"systemPromptPolicy":"prepend"}`를, 텍스트를 비우려면 `{"systemPrompt":null}`을 전달할 수 있으며, 후자는 정책을 초기화하지 않습니다.
- 이전 API가 프롬프트 필드를 반환하지 않으면 콘솔은 맹목적 쓰기를 금지합니다. 정책 필드만 없으면 텍스트는 편집할 수 있지만 정책 스위치는 사용할 수 없습니다.

## Node / Windows Electron: SDK 메인 프로세스 어셈블리

아래 토큰은 당신의 백엔드가 로그인한 사용자를 위해 발급합니다. Windows Electron은 메인 프로세스에서 SDK를 실행하고, IPC로 renderer에 뷰와 입력 채널을 제공합니다. appkey나 관리 액세스 토큰을 renderer에 패키징하지 마세요.

단일 턴 `query`. `system`을 생략해 플랫폼 기본값을 사용하고, 호스트 설명만 추가합니다.

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

다중 턴 `createSession`. SDK 맞춤 업무 세그먼트가 필요할 때 `system`을 명시적으로 전달합니다.

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

`AgentSession.applicationPrompt`는 읽기 전용 출처 요약으로, `{ policy: 'prepend', source: 'platform+sdk' }` 같은 형태입니다. `source`는 `none` / `platform` / `sdk` / `platform+sdk` 중 하나이며, P / S의 출처 선택만 설명하고 본문은 포함하지 않으며, `systemAppend`도 출처에 넣지 않습니다. `fallback`에서 명시적 `[]`의 출처는 `sdk`이며, 업무 세그먼트가 비어 있어도 그렇습니다. `prepend`에서 P가 있고 SDK가 `[]`이면 출처는 `platform`입니다.

## 저수준 runAgent: 업무 세그먼트를 수동으로 선택

`runAgent`는 bundle을 가져오지 않고, 도구, Skills 또는 MCP 지침을 자동으로 추가하지도 않으며, 호출자가 `system`으로 완전한 시스템 세그먼트를 제공합니다. 주입 방식 `query({ client, model, ... })`도 플랫폼 설정이나 도구 지침을 어셈블리하지 않지만, 명시적 `systemAppend`는 `system` 뒤에 이어 붙입니다. 둘 다 호출자가 플랫폼 설정의 읽기와 새로 고침을 직접 관리해야 합니다.

신뢰할 수 있는 호스트에서 앱 설정을 이미 얻어 검증했다면, `resolveApplicationSystem`을 명시적으로 호출한 뒤 저수준 진입점에 넘길 수 있습니다. 아래는 완전한 함수입니다. `client` / `model`은 당신의 모델 어댑터 층이 제공하고, `platform`은 검증된 설정이나 bundle에서 오며, 단말이 제출한 값을 직접 신뢰하지 않습니다.

관리 API에서 설정되지 않은 본문은 `null`이며, 보조 함수에 전달하기 전에 `config.systemPrompt ?? undefined`로 부재로 변환합니다. bundle 자체는 키가 없는 것으로 본문 없음을 나타냅니다.

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

`resolveApplicationSystem`은 세그먼트를 선택, 복사, 결합만 하며, 네트워크를 읽지 않고, 업무 권한을 검증하지 않고, 텍스트 충돌을 해결하지 않습니다. 호출자가 도구 지침을 원하면 호스트 지침 뒤에 해당 내용을 직접 어셈블리해야 합니다.

## Android / iOS / HarmonyOS: serve 호스트에서 설정

Android / iOS / HarmonyOS는 `/v2` 얇은 클라이언트이며, 메인 에이전트는 당신의 `@tansr/serve`에서 실행됩니다. 모바일은 일반 사용자 메시지를 보내며, **`/v2`를 통해 `system`이나 `systemAppend`를 설정하지 않습니다.** Android / iOS는 `CreateSessionRequest(prompt=...)`, `session.send(...)`를 쓰고, HarmonyOS는 `createSession`, `session.send(...)`를 씁니다.

플랫폼 통일 역할을 사용할 때는 `platform.system`을 생략합니다. 호스트 설명은 `platform.systemAppend`에 둡니다. 코드로 관리하는 업무 역할이 필요할 때만 `platform.system`을 설정하며, 이것은 같은 진리표를 따릅니다.

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

[세션 서비스 빠른 시작](/ko/getting-started/serve/), [Android / iOS 빠른 시작](/ko/getting-started/android/), [HarmonyOS SDK 빠른 시작](/ko/getting-started/harmony/)을 참고하세요. appkey와 플랫폼 단기 토큰은 serve에 남고, 기기는 당신의 업무 로그인 상태만 사용합니다.

## 수정 후 언제 적용되는가

플랫폼 연결 모드를 사용할 때 SDK / serve는 **매 새 턴 시작 전에 플랫폼 `systemPrompt`와 `systemPromptPolicy`를 검증하고, 같은 세션과 기록을 유지합니다.** 설정이 바뀌지 않았으면 ETag로 304를 받을 수 있습니다. 매 턴 검증하므로 60초 캐시 만료를 기다릴 필요가 없습니다. 실행 중인 턴은 그 턴에서 이미 선택된 설정을 계속 사용하며, 다단계 도구 루프 중간에 교체되지 않습니다. 업데이트를 받기 위해 세션을 닫거나, 채팅 기록을 지우거나, 새 세션을 만들 필요가 없습니다.

휴대폰이 포그라운드로 돌아오기, SSE 재연결, attach는 기존 세션을 계속 사용할 수 있으며, 후속 턴은 여전히 플랫폼 새로 고침 경로를 따릅니다. 저장소에서 resume해도 기존 기록이 유지됩니다. 여기서 새로 고쳐지는 것은 플랫폼 P와 policy이며, 호스트의 S(`system`)와 A(`systemAppend`)는 여전히 코드와 세션 설정이 관리하고, 세션 안에서 S / A를 수정하는 인터페이스는 추가되지 않습니다.

이전 메시지와 압축 요약은 유지되며, 새 프롬프트에 따라 다시 쓰이지 않습니다. 플랫폼 프롬프트 변경은 후속 요청의 시스템 접두어를 바꾸므로 접두어 캐시 적중과 비용에 영향을 줄 수 있습니다. 컨텍스트 관리자도 이전 token 측정 앵커를 무효화하고 새 요청에 따라 예산을 다시 추정합니다. 누적 비용, 기록, 첨부 파일 상태, 서킷 브레이커 상태는 유지됩니다. 설정 변경이 없는 304는 이 재추정을 유발하지 않습니다. 이 새로 고침 경로는 도구, 권한, 모델 또는 요금 설정을 동시에 핫 업데이트하지 않습니다.

새로 고침에서 HTTP 오류나 잘못된 설정을 만나면, 이번 턴에는 모델을 호출하지 않고, 아직 실행되지 않은 이번 사용자 메시지를 영구 기록에 쓰지 않으며, `applicationPrompt`도 업데이트하지 않습니다. 기존 기록과 이전 출처 요약은 유지되며, 호스트는 사용자에게 원래 세션에서 다시 보내라고 안내할 수 있습니다. 이벤트는 먼저 `turn.error`(`errorKind: 'application_prompt_refresh_failed'`)를 보고한 뒤 `turn.aborted`(`reason: 'model_error'`)를 보고합니다. 실패 이벤트를 받은 뒤 임의로 성공 답변처럼 표시하지 마세요.

새로 고침 사전 점검은 취소를 지원하며, 30초 시간 초과 후 이번 턴을 끝냅니다. 시간 초과의 `turn.aborted.reason`은 `timeout`입니다. 취소나 시간 초과 후 늦게 도착한 설정 응답은 모델을 시작하지 않습니다. `applicationPrompt`는 새 설정을 성공적으로 선택해 사용하기 시작한 뒤 업데이트됩니다. 새로 고침에 실패하면 읽었을 때 여전히 마지막으로 성공한 출처 요약입니다.

이 새로 고침 경로는 `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0부터 제공됩니다. 이전 버전은 플랫폼 필드가 존재한다고 해서 자동으로 새로 고침 기능을 갖추지 않습니다. 검수는 플랫폼 텍스트 변경, 비우기, 정책 전환, 304, 실행 중 설정 변경, 새로 고침 실패와 재시도, 취소와 시간 초과, 그리고 새로 고침 전후 메시지와 요약 유지를 포함해야 합니다.

문제를 조사할 때는 먼저 `session.applicationPrompt`의 source / policy를 확인한 뒤, 플랫폼 앱 설정과 호스트 코드를 확인하세요. 이 요약은 어셈블리 출처만 확인하며, 모델 답변이 모든 지시에 부합함을 보장하지 않습니다. 채팅창의 "너는 이제부터……"로 시스템 설정이 업데이트되었는지 검증하지 마세요.
