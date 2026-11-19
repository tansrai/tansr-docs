---
title: 메인라인의 컨텍스트와 서브에이전트
description: tansr-cli 메인라인에 이미 있고 CHANGELOG 버전 번호에는 아직 없는 컨텍스트와 서브에이전트 동작. 세션 핸드오프, 컴팩션, 캐시, 도구 발견, Task 오케스트레이션, Codemode, 쓰기 뒤 검증. 공개된 SDK 0.20.1과 CLI 0.11.0에는 없습니다.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

아래 동작은 `tansr-cli` 메인라인에 이미 들어가 있지만, **공개된 릴리스의 CHANGELOG에는 아직 없습니다**. npm의 `@tansr/sdk` 0.20.1과 CLI 0.11.0에는 없습니다. 이 변경이 들어 있는 패키지로 올리기 전에는 이 절의 호출을 작성하지 마세요.

## 세션 핸드오프

`createSession`으로 만든 세션은 `handoffSession(session, options)`로 새 목표에 넘길 수 있습니다. 원본 세션은 읽기만 합니다(가장 최근 컴팩션 요약, 남겨 둔 꼬리 기록, 짝을 이룬 파일 목록). 새 목표를 위한 브리핑을 만들고, 시드 메시지 하나만 가진 새 세션을 만듭니다. 새 세션은 `parentSessionId`를 기록합니다. 원본 세션은 다시 쓰이지 않으며 나중에 재개할 수 있습니다.

```ts
import { handoffSession } from '@tansr/sdk';

const next = await handoffSession(session, {
  goal: 'ship the retry change',
  reviewDraft: (draft) => ({ action: 'confirm', briefing: draft.briefing }),
});
if (next.status === 'created') {
  console.log(next.sessionId, next.parentSessionId);
}
```

- `goal`은 필수이며 공백만이면 안 됩니다. `reviewDraft`는 브리핑 본문을 바꿀 수 있습니다. `{ action: 'cancel' }`을 반환하면 중단입니다. 중단, 거부, 실패 모두 새 세션을 남기지 않습니다.
- 같은 팩토리로 만든 세션에는 열거되지 않는 `session.handoff(options)`도 붙습니다. 의미는 `handoffSession`과 같습니다. 타입에서는 내보낸 함수를 호출하세요.
- 같은 내보내기에는 `HANDOFF_PROVENANCE_TAG`(시드 메시지의 인수인계 표식 `tansr-handoff-v1`), `buildHandoffSeedMessage`, `readHandoffProvenance`도 있습니다. 생성된 SDK 기호 페이지는 공개된 0.20.1을 따르며 이 이름은 아직 없습니다.
- CLI 대화 화면에는 `/handoff <goal>`이 추가되었습니다. 목표가 비어 있으면 사용법만 보여 주고, 모델을 호출하지 않으며 현재 세션도 바꾸지 않습니다. 확인하면 화면은 새 세션으로 넘어갑니다. 원본은 디스크에 남고 `/resume`으로 다시 열 수 있습니다.

## 커밋된 노드에서 분기

스냅숏에서의 `fork` 외에, 메인라인은 커밋된 아무 노드에서나 가지를 나눌 수 있습니다. 요약은 원래 가지를 벗어난 차이와 파일 목록만 다룹니다. 분기 지점 이전의 콜드 구간은 통째로 읽지 않습니다.

## 컴팩션

턴 도중에 컴팩션이 돌면 요약은 둘로 나뉩니다. 이미 끝난 기록과, 아직 끝나지 않은 현재 턴의 앞부분(원래 요청, 이미 실행한 동작, 이어서 맞출 현장)입니다. 도구 호출과 그 결과는 요약 경계에서 갈라지지 않습니다. 다음 컴팩션은 이전 포장을 먼저 풀므로, 같은 앞부분이 여러 겹으로 쌓이지 않습니다.

백그라운드 사전 컴팩션은 기본이 아닙니다. `backgroundCompactMargin`을 둔 경우에만, 더 이른 수위에 닿아도 본 요청은 바로 나가고 백그라운드가 읽기 전용 스냅숏을 요약합니다. 다음 장벽에서 세대와 재료가 아직 맞는지 봅니다. 세션이 지워졌거나, 되감겼거나, 동기 컴팩션이 그 스냅숏을 넘겼으면 그 요약은 버립니다. `closeAsync()`는 마무리를 기다리고 사용량을 기록합니다.

일회성 보조 요청(컴팩션, 가지 요약, 한 번의 제목이나 분류)은 더 이상 캐시 표시를 쓰지 않습니다. 본 세션 요청과 상주 서브에이전트의 본 턴은 이전 캐시 정책을 유지합니다.

첫 턴의 도구 정의는 캐시 앞부분으로 고정됩니다. 나중에 켠 도구는 그 뒤에만 붙으므로, 앞부분 전체를 무효로 만들지 않아도 됩니다.

## 지연 도구 발견

지연 후보 도구가 16개에 도달하거나 명시적으로 강제하면 `ToolSearch`가 등록됩니다. 그 설명 문장은 고정입니다. 도중에 MCP를 붙이거나 떼도 이 문장은 바뀌지 않습니다. 모델은 검색한 다음 도구를 켭니다. 서브에이전트는 각자 목록을 가지며, 다른 서브에이전트가 켠 도구는 보지 못합니다. 실제 실행은 기존 권한 게이트를 그대로 통과합니다.

## Task와 상주 서브에이전트

상주 서브에이전트는 동시에 최대 4개입니다. 슬롯은 그 서브에이전트가 멈추고 뒷정리가 끝난 뒤에만 반환할 수 있습니다. 부모 세션은 자신이 직접 만든 서브에이전트만 다룰 수 있습니다. 진행 중인 턴은 현재 도구 묶음 뒤에 `steer`로 방향을 바꾸거나 `followup`을 대기열에 넣을 수 있습니다. 모델이 보는 조작은 `status`, `list`, `stop`, `release`입니다.

`Task`는 단일 작업을 이전과 같이 받습니다. 다른 형태는 서로 배타적입니다.

- `chain`: 1에서 6단계. 다음 단계는 `{previous}`로 이전 출력을 받습니다. 중간 본문은 부모 세션 기록에 쓰지 않습니다.
- `tasks`: 1에서 8개를 병렬로. `concurrency` 기본값은 4, 상한은 8입니다. `policy`는 `allSettled` 또는 `failFast`입니다. `failFast`이거나 부모가 취소하면 끝나지 않은 형제를 멈추고, 자원 정리가 끝날 때까지 기다립니다.

상주 서브에이전트는 명시한 디렉터리에 서브볼륨을 쓸 수 있습니다. 프로세스 재시작 뒤 그 서브볼륨에서 웜 재개를 할 수 있습니다. 연속 크래시는 기본 5회에 도달하면 잠기고, 재시작을 넘어도 잠긴 채로 남습니다. 그 슬롯을 `release`하기 전에는 돌아오지 않습니다. 디스크가 없는 세션 서비스는 이 서브볼륨을 디스크에 쓰지 않습니다.

## Codemode와 구조화 결과

도구는 선택적 `outputSchema`를 선언할 수 있습니다. 성공한 결과는 `structuredData`를 가질 수 있습니다. 이 데이터는 모델에 보내는 메시지에 들어가지 않습니다. 이후 훅이 본문을 바꾸고 `structuredData`를 맞추지 않으면 구조화 데이터는 제거됩니다.

`Codemode`는 기본 도구가 아닙니다. 어셈블리한 뒤에만 나타납니다. 스크립트는 전용 워커에서 돌며 시간과 메모리에 단단한 상한이 있습니다. 스크립트 안의 `tools.<name>()`도 호스트 권한 게이트를 통과합니다. 스크립트 자신의 상태는 디스크에 쓰지 않습니다.

## 쓰기 뒤 검증

`afterRun`은 `createSession` 필드가 아닙니다. 커널 쿼리 루프 옵션에만 있습니다. 설정하지 않으면 전혀 돌지 않습니다. 이 턴에서 설정된 파일 쓰기 도구(기본은 `Edit`와 `Write`)가 성공한 뒤에만, 쿼리가 끝나기 전 세션이 아직 바쁜 동안 `verify`가 호출됩니다. `{ action: 'pass' }`이면 끝입니다. `{ action: 'followup', prompt }`는 같은 쿼리 안에서 고치며, 기본 최대 2회, 단단한 상한은 5회이고, 턴 수, 예산, 취소 신호에도 묶입니다. 읽기만 하거나 질문만 하면 일어나지 않습니다.
