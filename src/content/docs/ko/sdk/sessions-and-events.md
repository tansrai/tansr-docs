---
title: 세션과 이벤트 스트림
description: '@tansr/sdk의 3단계 API, AgentSession의 멀티턴 의미론, 이벤트 봉투와 주요 이벤트 패밀리, 그리고 SessionView와 Narrator로 이벤트 스트림을 렌더링 가능한 상태로 바꾸는 방법을 이해합니다.'
zone: docs
category: sdk
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - getting-started/sdk
  - sdk/checkpoints
  - sdk/platform-bundle
  - sdk/errors-and-retries
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/release/REL-FULL-20261010-核心发行准备.md
lastVerified: '2026-10-13'
---

SDK의 역할 분담을 한 문장으로 말하면 **에이전트 루프는 SDK가, 상호작용 경험은 여러분이 맡습니다**. 여러분은 UI(또는 UI 없음), 업무 함수, 권한 확인 대화를 제공하고, SDK는 모델 연결, 도구 실행, 이벤트 스트림, 상태 투영을 제공합니다. 이 페이지는 그 줄기인 이벤트 스트림을 다룹니다.

이 페이지는 npm에 공개된 `@tansr/sdk@0.13.0` 이상(현행 **0.19.0**, 2026-10-10 공개, `@tansr/serve` 0.15.1 및 `tansr` CLI 0.10.3과 짝)에 해당합니다. 0.18.0 / 0.18.1 / 0.19.0은 이 페이지의 프로세스 내 API에 **동작 변화를 가져오지 않습니다**. `createSession` / `query` / `runAgent`의 3단계, 이벤트 봉투, `SessionView`는 모두 0.14.0 이후 그대로입니다. 통합 HTTP 호출 표면 `/api`는 세션 서비스 쪽의 이야기이며, Electron / Node에 내장한 SDK는 그곳을 거치지 않습니다. 버전별 차이는 이 페이지 끝의 "0.18.x의 추가"와 "0.19.0의 추가" 두 절에만 있습니다.

## system과 일반 입력의 경계

`query.prompt`와 `session.send()`는 사용자 메시지이며 system 역할을 바꾸지 않습니다. 새 프롬프트 기능을 지원하는 빌드에서는 어셈블리 시점에 플랫폼의 `fallback` / `prepend` 정책에 따라 플랫폼 세그먼트와 SDK의 `system`을 고른 뒤 `systemAppend`와 해당 가이드를 덧붙입니다. 이 기능은 `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0부터 제공되며 플랫폼 쪽은 2026-09-14에 프로덕션에 공개되었습니다.

`session.applicationPrompt`는 읽기 전용 `{ source, policy }` 요약으로 본문을 포함하지 않으며 `systemAppend`를 업무 출처로 세지 않습니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 갱신되고, 실행 중인 턴은 설정을 유지하며 원래 인스턴스와 기록은 보존됩니다. 호스트의 system / systemAppend는 계속 코드와 세션 설정으로 관리합니다. 주입 방식의 query와 저수준 runAgent는 플랫폼 설정을 자동으로 가져오지 않으므로 `resolveApplicationSystem`을 직접 사용하세요. 전체 코드는 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참고하세요.

## 3단계 API

| API | 시그니처 형태 | 용도 |
|---|---|---|
| `query(options)` | `AsyncGenerator<KernelEvent, QueryResult>` | 한 턴의 일문일답(도구 루프 포함). `return` 값이 구조화된 최종 결과 |
| `createSession(options)` | `Promise<AgentSession>`(async, 반드시 `await`) | 멀티턴 세션: `send` / `events` / `interrupt` / `messages` / `setModel` / `close` |
| `runAgent(options)` | `QueryHandle` | 저수준 패스스루: client / executor / tools를 직접 전달, 어셈블리 없음 |

`query`는 단일 턴용 편의 표면으로 커널 이벤트 스트림을 그대로 통과시킵니다. 어셈블리 계층이 합성하는 이벤트(`hook.*`, ToDo 장부 등)는 `createSession`의 세션 이벤트 스트림에만 나타납니다. 대부분의 앱은 `createSession`을 사용합니다.

```ts
import { query } from '@tansr/sdk';

const run = query({ token, baseUrl, prompt: '用一句话说明 Electron 是什么。' });
let step = await run.next();
while (!step.done) {
  if (step.value.type === 'msg.text.delta') process.stdout.write(step.value.text);
  step = await run.next();
}
const result = step.value; // QueryResult:reason / finalText / messages / usage / counters
```

`query`를 중간에 `break`하면 쿼리 루프는 자동으로 중단되며 떠 있는 턴은 남지 않습니다. 어셈블리 계열 오류는 첫 `next()`에서 `TansrSdkError('assembly_failed')`로 reject됩니다.

## AgentSession의 멀티턴 의미론

앱을 종료하거나 공유 MCP host를 닫기 전에 새로 추가된 [closeAsync / drain의 실제 종료 처리 영수증](/ko/sdk/lifecycle/)을 사용하세요. 아래 close 예시는 기존 이벤트 종단만 보여 주며 비동기 저장소나 하위 리소스의 완료를 보장하지 않습니다.

```ts
const session = await createSession({ token, baseUrl });

const pump = (async () => {
  for await (const event of session.events) {
    if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  }
})();

session.send('第一轮问题');      // 空闲 → 起新一轮
session.send('补充一句');        // 旧兼容入口；严格同轮与回执使用 submitInput
await session.idle();            // 等当前轮(含结转连锁轮)终态
session.interrupt();             // 优雅中止当前轮(事件流走到 turn.aborted),会话可继续
console.log(session.messages()); // 历史快照(深拷贝;可持久化 / 续跑)
session.close();                 // 幂等;运行中先 abort,尾部事件不丢
await pump;
```

메서드 의미론의 요점:

- `send(prompt)`: 유휴 상태면 새 턴을 시작합니다. 실행 중이면 입력 배리어를 통해 소비되며, 자연스러운 `completed` / `structured_output` 창 안에서 소비되지 않은 오래된 입력은 이월될 수 있습니다. 상한이나 명시적 중단 같은 하드한 종단에서는 예산을 우회하지 않도록 같은 세대의 새 턴을 자동으로 시작하지 않습니다. 엄격한 같은 턴 전달과 영수증이 필요하면 [submitInput](/ko/sdk/midturn-input/)을 사용하고, 대상이 닫힌 뒤 `send()`로 폴백하지 마세요. `close` 후 호출하면 `session_closed`를 throw합니다.
- `events`: 턴을 넘어 연속되고 세션 안에서 `seq`가 단조 증가하는 `AsyncIterable<KernelEvent>`입니다. **다중 구독자 브로드캐스트**: `for await` 하나하나가 독립된 구독자가 되어 SessionView 펌프, Narrator, 여러분 자신의 루프를 동시에 걸어 두고 각자 전량을 받을 수 있습니다. 첫 `send()` 전에 붙은 구독자는 세션 생성 이후의 모든 이벤트를 받고, 전달 중에 붙은 구독자는 구독 시점부터 받습니다.
- `setModel(next)`: 이후 턴에 적용됩니다. 토큰 / 관리형 방식은 별칭 문자열을 전달하고(재해석 실패 시 `assembly_failed`를 throw하며 세션 상태는 바뀌지 않음), 주입 방식은 `{ client, model }`을 전달합니다.
- `signal` 옵션: AbortSignal이며 abort는 close를 의미합니다.
- `initialMessages`: 기록 사전 로드(복구 시나리오용 저수준 경로로 페어링 거버넌스를 거치지 않음).
- `onHistoryCommit(history, meta)`: 각 턴 종단에서 전체 기록의 깊은 복사와 함께 호출되는 콜백입니다. `meta.rewritten === true`는 기록 앞부분이 제자리에서 다시 쓰였음(압축 접기 / 스텁화)을 뜻하며, 영속화하는 쪽은 볼륨 전체를 교체해야 합니다. 대부분의 경우 `store` 필드를 사용해 내장 구현에 맡기세요. [체크포인트와 재개](/ko/sdk/checkpoints/)를 참고하세요.

`@tansr/sdk` **0.14.0부터**(2026-09-14 공개) `createSession`에 선택 키 4개가 추가되었습니다. 모두 순수 추가이며 전달하지 않으면 아무것도 바뀌지 않습니다:

- `trustProjectHooks?: boolean`: 프로젝트 계층 hooks의 신뢰 게이트입니다. 기본값 `false` = 워크스페이스의 `.tansr/settings.json` / `settings.local.json`에 선언된 `command` / `http` hooks는 **실행 0건, `hook.*` 이벤트 0건**(사용자 계층 / 관리형 계층 hooks는 정상). 명시적 `true` = 호스트가 사용자를 대신해 해당 워크스페이스를 신뢰하며 프로젝트 계층 hooks는 정상 동작합니다. SDK는 신뢰를 영속화하지 않고 `tansr` CLI의 `trust.json`도 읽지 않습니다. 신뢰 사실은 여러분이 매번 사용자에게 확인한 뒤 전달합니다. 게이트에 막힌 프로젝트 계층 hooks가 있으면 `onWarning`으로 한 번만 `SdkWarning { code: 'project_hooks_untrusted', detail: { cwd, registered: { projectShared?, projectLocal? } } }`를 알리고, `onWarning`이 없으면 이벤트 스트림의 `turn.error { scope: 'sdk.notice', recoverable: true }`로 폴백합니다. **동작 강화**: 예전에는 저장소를 clone하고 `createSession`만 하면 동작하던 프로젝트 계층 hooks가 기본적으로 더 이상 실행되지 않습니다. 단일 턴 `query()`도 같은 어셈블리를 공유해 이 게이트의 대상이며 신뢰 플래그가 아직 없으므로 `query()` 안에서 프로젝트 계층 hooks가 활성화되는 일은 없습니다. CLI 쪽의 같은 게이트는 [보안과 개인정보](/ko/security/#项目层-hooks-的信任门缺省零执行)를 참고하세요.
- `hostShell?: 'posix' | 'powershell'`: 권한 엔진이 Shell 명령을 해석할 때의 어휘 방언입니다. 기본값은 호스트 플랫폼에서 자동 판별되며(내장 Shell 도구가 실제로 시작하는 shell과 일치), 명시적 값은 테스트나 크로스 플랫폼 리허설용입니다(예: Windows에서 posix 어휘로 규칙 시험). 실제 실행 shell과 어긋나면 어휘 가드와 실행 환경이 맞물리지 않으므로 **프로덕션 호스트에서는 설정하지 마세요**. 3단계 모두에 적용됩니다.
- `budget?: { maxUsd?, maxTotalTokens?, onExceeded?: 'block' | 'warn' }`: 세션 예산 게이트로 CLI 설정 파일의 `budget` 절과 같은 형태입니다. TUI / headless / serve / acp / SDK의 다섯 형태가 이후 같은 게이트 의미론을 공유합니다. 세션 누적 소비가 상한에 이르면 `'block'`(기본값)은 다음 모델 호출 전에 그 턴을 끝내고 이벤트 스트림에 `turn.aborted { reason: 'budget_exceeded' }`가 흐르며, 세션은 열린 채로 이후 턴도 같은 방식으로 막힙니다. `'warn'`은 쿼리당 최대 1건의 `turn.error { scope: 'budget', recoverable: true }`를 내고 그대로 계속합니다. 두 상한이 모두 없으면 게이트가 붙지 않습니다. `maxTotalTokens` = 입력 + 출력 + 캐시 읽기 + 캐시 쓰기(사고 토큰은 각 모델의 기능 플래그에 따라 출력에 포함하며 이중으로 세지 않음). `maxUsd`는 USD 기준 모델에서만 값이 나옵니다. 토큰 방식은 플랫폼 번들로 가격이 정해지고 관리형 / 주입 방식의 현재 내장 가격표는 CNY라 `maxUsd`로는 보호되지 않습니다. 통화에 무관한 보험은 `maxTotalTokens`입니다. 잘못된 값(양수가 아님 / 양의 정수가 아님 / 어휘 밖)은 IO 전에 `invalid_options`로 거부됩니다. `thinking.budget`(한 턴의 사고 예산)과는 무관하고, 새 이벤트 종류가 늘지 않으며, 세션 재개 시 과거 사용량을 되채우지도 않습니다.
- `events?: { maxBacklogEvents, maxBacklogBytes }`: 이벤트 백로그 상한입니다. 첫 구독자가 오기 전까지의 백로그는 건수와 대략적인 바이트 수의 이중 상한으로 제한되며 기본값은 1000건 / 2 MiB(양수 또는 `Infinity`, 그 외는 `invalid_options`)입니다. 초과하면 가장 오래된 것부터 버리고 최신 1건은 반드시 남기며, 큐 머리에 정확히 1건의 일급 이벤트 `session.events_dropped { scope: 'sdk.events', droppedCount, reason: 'count_limit' | 'bytes_limit', droppedBytes, firstDroppedSeq, lastDroppedSeq, maxEvents?, maxBytes? }`로 알립니다. 버려진 이벤트는 되찾을 수 없습니다. 상한 안에서는 "늦게 온 첫 구독자가 전체 백로그를 받는다"가 그대로이며, `send()` 전에 구독자를 붙이는 기존 코드는 수정이 필요 없습니다. 전달 시작 후 구독자가 모두 사라진 동안 흐른 이벤트는 **보존되지 않습니다**(의미론 0의 트리밍으로 드롭으로 세지 않고 알리지도 않으며, 나중에 온 구독자는 현재부터 시작). 오래 도는 세션에서는 `send()` 전에 구독자를 붙이거나 필요에 따라 상한을 올리세요.

같은 버전에는 알아 둘 만한 자잘한 정리도 몇 가지 있습니다. `token`은 `() => string` 게터를 받고(다섯 종류의 플랫폼 요청을 보내는 시점에 현재 값을 읽으므로 토큰 교체 시 세션을 다시 만들 필요가 없음), `close()` 후의 `setModel` / `setThinking` / `interrupt`는 일률적으로 `session_closed`를 throw하며, `AgentSession.pushBody`는 공개 타입에서 빠졌고(원래 약속된 표면이 아님), `SessionNotice.message`는 선택이 되었으며(호스트는 `code`로 렌더링하고 `message`는 보험으로만 사용), 종료 처리를 기다리는 `drain({ force: true })`는 [세션 닫기와 리소스 종료 대기](/ko/sdk/lifecycle/)를 참고하세요.

세션은 기본적으로 순수하게 메모리 안에 있습니다. 플랫폼은 최종 사용자의 세션 내용을 저장하지 않고 계량만 합니다.

## 이벤트 봉투와 이벤트 패밀리

각 이벤트에는 봉투 필드 `type` / `sessionId` / `seq` / `ts` / `v`(계약 버전) / `source`가 붙고, 턴 안의 이벤트에는 `turnId`도 붙습니다. 이벤트는 평평한 판별 유니온이며 `event.type`으로 바로 분기하세요. 세션 서비스의 SSE와 같은 계약입니다.

| 패밀리 | 이벤트 | 언제 보는가 |
|---|---|---|
| session | `session.created` `session.resumed` `session.compacted` `session.checkpointed` `session.restored` `session.locale.changed` `session.ended` `session.events_dropped` | 생명주기와 기록 다시 쓰기. `session.events_dropped`(contract-v0.27, SDK 0.14.0부터)는 SDK 프로세스 안에서 이벤트 백로그가 상한을 넘었다는 알림으로, `@tansr/serve`가 내지 않으며 `/v2` 스트림에도 흐르지 않음 |
| turn | `turn.started` `turn.completed` `turn.aborted` `turn.error` | 한 턴의 경계. `turn.error`에는 `recoverable` 플래그가 붙음 |
| msg | `msg.block.start` `msg.text.delta` `msg.thinking.delta` `msg.block.end` `msg.retracted` | 스트리밍되는 본문과 사고. `msg.retracted`는 흘러나간 블록이 철회되었음을 뜻함(출력 상한에 걸려 깨끗하게 재시도한 경우 등) |
| tool | `tool.proposed` `tool.permission.requested` `tool.permission.decided` `tool.started` `tool.progress` `tool.output.delta` `tool.completed` `tool.failed` | 도구의 전체 생명주기. 미디어 도구의 공급자 쪽 실패는 `tool.completed.isError`로 나옴. 도구 `inputSchema`에 맞지 않는 인자의 호출은 0.14.0부터 실행 전에 스케줄러가 거부해 `tool.failed { errorType: 'invalid_args' }`로 나오며 `tool.started` / `tool.completed`는 없음(실행에 들어가지 않고 권한 판정도 일어나지 않음) |
| agent | `agent.spawned` `agent.progress` `agent.completed` | Task 하위 에이전트 |
| hook | `hook.triggered` `hook.completed` `hook.blocked` | 여러분이 설정한 훅 |
| cost | `cost.usage.updated` `cost.provider.switched` | 요청별 사용량. 공급자 폴백 전환 |
| mcp | `mcp.connected` `mcp.connect_failed` `mcp.closed` `mcp.discovered` 등 | MCP 서버 상태 |
| plan | `plan.todo.updated` | ToDo 장부 |

앞으로의 호환성 철칙: **알 수 없는 이벤트 종류와 알 수 없는 필드는 반드시 무시할 것**. 닫힌 열거로 검증하지 마세요. 계약은 "선택 항목 추가"로 진화합니다.

## 이벤트를 손으로 조립하지 말 것: SessionView와 Narrator

UI를 만들 때 `msg.text.delta`에서 직접 문자열을 이어 붙이지 마세요. SDK에는 두 계층의 출구가 함께 들어 있습니다:

- `createSessionView(session)`: 이벤트 스트림을 **불변 뷰 스냅숏**(메시지 목록, 도구 카드, ToDo, 사용량, 오류 배너, 연결 상태)으로 환원합니다. structuredClone에 안전하므로 Electron의 IPC로 그대로 renderer에 넘길 수 있습니다.
- `createNarrator(...)`: 사람이 읽을 수 있는 로그 줄을 생성하며 디버깅과 감사 출력에 적합합니다.

표시 프로필은 선택입니다: `{ delivery: { text: 'stream' | 'final', thinking: 'stream' | 'final' | 'off' } }`로 본문과 사고를 각각 스트리밍 또는 일괄 표시 중에서 고를 수 있고, 사고는 통째로 숨길 수도 있습니다. `view.setDelivery(delivery)`로 실행 중에 블록 단위로 즉시 전환됩니다. 생성 쪽의 사고 예산은 `createSession({ thinking: { budget } })`과 `session.setThinking(...)`으로 다루며 표시 프로필과는 직교합니다.

복구 가능한 자문성 `turn.error`(`recoverable: true`, 예: 영속화 실패)는 `SessionView.notices`(FIFO, 상한 20)에 들어가며 `lastError`를 더럽히지 않습니다. `ErrorView.recoverable`은 필수 필드이므로 자체 투영에서는 반드시 채우세요. 0.14.0부터 `session.events_dropped`도 `notices`에 들어가고(`code: 'session.events_dropped'`, `message` 없음, `detail` = 페이로드에서 `type` / `scope`를 뺀 것), Narrator는 `events dropped [scope]: N event(s) dropped (reason)` 한 줄을 냅니다. 그래서 `SessionNotice.message`가 선택이 되었습니다. `code`로 렌더링하고 `message`는 보험으로만 쓰세요(예: `notice.message ?? notice.code`). 같은 버전부터 `turn.error { recoverable: true }`에 대한 Narrator의 한 줄은 `… — recoverable, session continues`가 되었습니다. SDK가 보장하는 것은 세션이 아직 열려 있다는 사실뿐이며 재시도 여부는 여러분이 정합니다. `notices[].code` / `scope`로 판별하는 코드는 바뀌지 않습니다.

0.15.0부터 이미지 / 비디오 / 음성 도구의 산출물(`artifact`)은 세션 기록과 함께 보존되며, `resume` / 체크포인트 복구 후 `SessionView`가 해당 도구 카드의 미리보기를 재구성할 수 있습니다. 기록에 산출물이 있는데 미리보기를 안전하게 복구할 수 없으면 도구 카드는 `artifactUnavailable: true`를 설정합니다(도구의 완료 상태는 바꾸지 않고, 산출물이 없는 옛 기록에서는 설정하지 않음). 산출물을 포함하는 세션 저장소는 이후 버전 2를 사용하며 업그레이드는 전체적으로 해야 합니다. [체크포인트와 재개](/ko/sdk/checkpoints/)를 참고하세요.

## 권한: ask를 여러분의 UI로 연결하기

`permission: { mode?, rules?, askUser? }`. 도구 호출이 "확인"으로 떨어지면 `askUser`를 통해 여러분의 UI로 연결됩니다. `askUser`를 붙이지 않으면 fail-closed로 거부로 강등되며, 이것이 "도구가 전부 거부된다"의 가장 흔한 원인입니다. 토큰 방식은 기본적으로 콘솔에서 임명한 판정자를 어셈블리합니다(`adjudication?: { posture?, callBudget?, enabled?, endUser? }`). `permission.mode`를 명시하면 자체 관리 모드로 간주되어 판정자는 어셈블리되지 않고 `adjudicator_skipped_by_mode`가 통지됩니다. `adjudication: {…}`과 `permission.mode`의 명시적 동거는 진짜 모순이므로 `invalid_options`를 throw합니다. 조용히 자체 관리하려면 `adjudication: { enabled: false }`를 전달하세요.

## 경제성의 세 가지 규율

긴 세션의 비용은 주로 **접두사 재전송**에 들어갑니다. 세 가지 규율로 그 대부분을 아낄 수 있습니다:

1. **resume / attach를 항상 새로 만들기보다 우선할 것.** 지난번 `sessionId`를 보관하고 → 먼저 재개를 시도하고 → 재개할 수 없을 때만 새로 만듭니다. 페이지를 열 때마다 새 세션을 만드는 것은 상류에서 데워진 캐시를 통째로 버리는 것과 같습니다.
2. **선언하는 바이트열을 항상 안정시킬 것.** 도구 이름 / 설명 / 매개변수 스키마 / `builtin` 선택 집합 / system 세그먼트는 모두 모델 요청의 접두사에 들어가며, 순서를 바꾸거나 설명 한 글자를 바꾸면 다음 턴에서 접두사 전체가 미스납니다. 도구와 호스트 업무 세그먼트는 안정시키세요. 플랫폼 프롬프트 변경은 이후 턴에서 접두사를 갱신하므로 캐시 적중과 호출 비용을 함께 평가하세요.
3. **유휴가 되면 닫을 것. 방치하지 말 것.** `close()`는 논리적 닫기와 중단을 시작합니다. 호스트를 종료하기 전에 `closeAsync()`로 실제 리소스와 필요한 저장소 flush의 영수증을 확인하세요. 자세한 내용은 [생명주기와 리소스 종료](/ko/sdk/lifecycle/)를 참고하세요. 플랫폼의 세션 아카이브는 별개의 경계로, store의 내용은 남아 있고 언제든 `resume`할 수 있습니다.

## 0.18.x의 추가

`@tansr/sdk` 0.18.0(2026-10-02, "2026.10 통합 API 릴리스 트레인")과 0.18.1(2026-10-04, "0.14.0 배치")이 0.17.0 대비 이 페이지와 관련해 바꾼 것은 모두 **선택적 추가**이며 전달하지 않으면 아무것도 바뀌지 않습니다:

- **하위 진입점 `@tansr/sdk/extensions`**(0.18.0부터 포함): 로컬 아카이브 호스트 `createNodeArchiveHost`와 로컬 캐시 호스트 `createNodeCacheHost`. 둘 다 명시적으로 어셈블리하는 호스트이며 **`createSession`의 기본 스위치가 아닙니다**. 이 하위 진입점을 import하지 않는 코드는 바뀌지 않습니다. 0.18.1의 `src`는 0.18.0에서 변화가 없고 `./extensions` 릴리스 산출물 내용에 차이가 있어 함께 실린 것뿐입니다. 두 호스트의 책임 경계와 성능 공개는 [SDK 2.0 확장 진입점](/ko/sdk/sdk2-preview/)을 참고하세요.
- **`ToolContext.executionTarget?` / `ToolContext.turnId?`와 `GateDecision.executionTarget?`**: 사용자 정의 `Tool.execute`와 사용자 정의 권한 게이트가 읽을 수 있는 새 선택 키 3개입니다. 프로세스 내 SDK(`createSession` / `query` / `defineTool` / 사용자 정의 게이트)에서는 이 셋이 **항상 부재**이며, 세션 서비스의 SDK2 명시 실행 프로필 스케줄러만 채워 그 호출이 원격의 바인딩된 기기 / 관리되는 서비스에서 실행됨을 나타냅니다. 사용자 정의 게이트가 `executionTarget`을 읽었다면 호스트의 로컬 리소스로 폴백해서는 안 됩니다(리소스가 없으면 거부이지 호스트가 대신하는 것이 아님).
- **`AppBundleModel.adapterDiagnostics?`**: 플랫폼 카탈로그의 근거가 요청 / 과금 어댑터를 고르기에 충분한지를 나타내는 읽기 전용 투영(`status ∈ 'ready' | 'review' | 'unresolved'`)으로 UI 표시용입니다. 공급자 자격 증명이나 가격 원문을 포함하지 않으며 플랫폼이 보내지 않으면 `undefined`입니다.
- **`CLIENT_FEATURES`에 `'bound-device-v1'` 추가**: 송신 헤더 `x-tansr-client-features`의 기본 선언 문자열이 따라 바뀌어 업그레이드 후 첫 어셈블리에서는 새 지문으로 번들을 한 번 다시 가져옵니다(옛 캐시 항목은 자연히 만료되며 손으로 지울 필요 없음). `ClientFeature`를 모두 열거하는 `switch`를 쓰는 코드는 분기 하나를 더하세요. 프로세스 내 SDK는 번들의 `execution` 절을 소비하지 않으며 기기 도구 인가는 세션 서비스의 SDK2 실행 프로필에서만 적용됩니다. [플랫폼 어셈블리와 번들](/ko/sdk/platform-bundle/)을 참고하세요.
- **`SessionStore`의 선택적 기능 플래그 `attachmentCheckpoints`**: 내장 `createFileSessionStore`는 구현되어 있으며 `resume`은 이후 첨부 파일 수용 상태를 기록과 함께 콜드 복구합니다. 선언하지 않는 사용자 정의 5메서드 Store는 0.17의 동작 그대로입니다. [체크포인트와 재개](/ko/sdk/checkpoints/)를 참고하세요.

## 0.19.0의 추가

`@tansr/sdk` 0.19.0(2026-10-10, `@tansr/serve` 0.15.1 및 CLI 0.10.3과 같은 편)이 0.18.1 대비 바꾼 `src`는 모두 `platform/*`에 있으며 `session.ts` / `query.ts` / `run-agent.ts`는 변화가 없습니다. 이 페이지에는 역시 **선택적 추가**입니다:

- **독립된 플랫폼 비채팅 작업 클라이언트 `createPlatformNonchatClient({ baseUrl, token, onUnauthorized? })`**: 임베딩 / 리랭킹 / 문서 추출 / 음악 / 전용 음성 / 비디오 작업과 실시간 세션 등 플랫폼 작업을 명시적으로 호출하는 HTTP 클라이언트입니다. **`AgentSession`에 매달리지 않고, 세션 기록에 들어가지 않으며, 세션 이벤트를 발행하지 않고, 채팅 도구를 자동 등록하지도 않습니다**. 호출자가 명시적으로 요청한 작업만 보냅니다. 제출 계열 메서드는 안정된 `idempotencyKey`를 요구하고, `wait()`는 `timeoutMs` / `maxPolls`로 한계가 정해지며 `reason: 'terminal' | 'timeout' | 'poll_limit'`을 반환합니다. 실패 시 `PlatformNonchatError`(`code: 'platform_request_failed'`, `status` / `platformCode` / `outcomeUnknown` / `taskId?` 동반)를 throw하며 대처는 [오류 처리와 재시도](/ko/sdk/errors-and-retries/)를 참고하세요. `onUnauthorized`는 토큰이 무효가 된 401에서만 한 번 호출되며, 새 토큰을 발급한 뒤 같은 키와 같은 본문으로 재전송하기 위한 것입니다.
- **선택적 플랫폼 기능 플래그 6개와 `CLIENT_FEATURES`에 `'nonchat-operations-v1'` 추가**: 송신 헤더의 기본 선언 문자열이 다시 바뀌어 업그레이드 후 첫 어셈블리에서 새 지문으로 번들을 한 번 다시 가져옵니다. `ClientFeature`를 모두 열거하는 `switch`에는 분기를 하나 더 추가하세요. 플래그 6개는 위의 비채팅 작업만 인가하며 부재는 `false`와 같습니다. [플랫폼 어셈블리와 번들](/ko/sdk/platform-bundle/)을 참고하세요.
- **`SpeakInput.voiceRef?`**: 토큰 방식에서 직접 호출하는 `session.platform.speak()`에서 앱 전용 음성 리소스를 지정할 수 있습니다. 시스템 `voice`와는 배타적입니다.
- **`AppQuotaSchema` / `AppQuota`, 실시간 연결과 문서 임시 업로드의 계약 타입**: 타입과 zod 형태의 export일 뿐이며 프로세스 내 세션은 이를 소비하지 않습니다.

0.19.0 이후에도 메인라인은 계속 나아가고 있지만(예: 모델 역할의 주 / 대기 판정 정책, 도구의 함수 수준 허용, 전용 음성을 작업으로 되찾기, 토큰 갱신의 동일 신원 격리), 이들은 **아직 어떤 npm 버전에도 포함되지 않았으며** 이 페이지에서는 다루지 않습니다.

## 관련

- [체크포인트와 재개](/ko/sdk/checkpoints/): `store`, `resume`, 수동 압축과 스냅숏.
- [플랫폼 어셈블리와 번들](/ko/sdk/platform-bundle/): 토큰 방식으로 내려오는 것, 도구 3링을 고르는 방법.
- [오류 처리와 재시도](/ko/sdk/errors-and-retries/): `turn.error`와 `TansrSdkError`의 분기 처리.
