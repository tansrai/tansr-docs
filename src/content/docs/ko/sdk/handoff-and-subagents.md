---
title: 긴 세션, 핸드오프, 서브에이전트
description: 목표가 바뀌면 필요한 맥락만 가진 새 세션을 엽니다. 컨텍스트가 가득 차면 진행 중인 턴을 자르지 않고 컴팩션합니다. 도구가 너무 많으면 필요한 것만 찾습니다. 서브에이전트는 직렬, 병렬, 또는 중간에 방향을 바꿀 수 있는 상주로 씁니다. 지금 설치하는 SDK 0.20.1과 CLI 0.11.0에는 이 호출이 아직 없습니다.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/checkpoints
  - sdk/lifecycle
sources:
  - tansr-cli:packages/sdk/src/extensions/handoff.ts
  - tansr-cli:packages/sdk/src/extensions/branch-summary.ts
  - tansr-cli:packages/sdk/src/index.ts
  - tansr-cli:packages/kernel/src/query/after-run.ts
  - tansr-cli:packages/kernel/src/tools/task/task-tool.ts
  - tansr-cli:packages/kernel/src/tools/task/agent-tools.ts
  - tansr-cli:packages/kernel/src/tools/codemode/codemode-tool.ts
  - tansr-cli:packages/kernel/src/tools/discovery/tool-search.ts
  - tansr-cli:packages/cli/src/tui/handoff-flow.ts
lastVerified: '2026-11-20'
---

`createSession`으로 여러 턴의 세션을 열고, [체크포인트](/ko/sdk/checkpoints/)로 저장하고 다시 여는 것까지는 이미 쓸 수 있습니다. 이 페이지는 그다음에 만나는 세 가지 상황입니다. 목표가 바뀌어 새 세션이 필요할 때, 대화가 너무 길어 진행 중인 턴이 반으로 갈릴 때, 그리고 일을 서브에이전트에게 넘길 때입니다. 넘긴다면 순서대로 할지, 나란히 할지, 중간에 방향을 바꿀 수 있는 상주로 둘지를 고릅니다.

먼저 지금 설치한 패키지를 확인하세요. npm에서 받는 `@tansr/sdk` 0.20.1과 CLI 0.11.0에는 아래 호출이 **아직 없습니다**. 그 호출이 들어 있는 판으로 올리기 전에는, 이 절의 설명대로 쓴 코드가 실행되지 않습니다. 생성되는 기호 페이지도 지금 설치할 수 있는 패키지에서 만들어지므로, 이 이름들은 거기에도 아직 없습니다.

## 목표가 바뀌면 이 세션을 넘긴다

지금 세션에는 결론도, 바꾼 파일도, 컴팩션이 끝난 요약도 있습니다. 그런데 다음에 할 일은 원래 목표가 아닙니다. 원래 세션을 억지로 꺾지 말고, 새 세션이 기록 전체를 다시 읽게 하지 마세요. `handoffSession`은 지금 세션을 읽기만 합니다. 새 목표를 향한 브리핑을 쓰고, 그 브리핑만 가진 새 세션을 엽니다. 원래의 메모리, 스냅숏, 디스크 기록은 그대로라서 나중에 돌아올 수 있습니다.

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

넘기는 값은 새 목표 `goal`입니다. 공백을 뺀 뒤 비어 있으면 안 됩니다. 비어 있으면 모델을 호출하지 않고, 결과는 `rejected`, 이유는 `invalid_goal`입니다.

선택 항목은 다음과 같습니다.

- `instructions`는 브리핑에 더하는 요청입니다. `signal`이 어느 단계에서 끊겨도 결과는 `cancelled`이고, 절반만 만들어진 새 세션은 남지 않습니다.
- `reviewDraft`는 만들기 전에 브리핑을 읽게 합니다. 콜백은 원래 세션 id, 목표, 브리핑 본문, 파일 목록을 받습니다. 본문을 고쳐 확인하거나 `{ action: 'cancel' }`을 반환할 수 있습니다. 고친 본문이 비어 있으면 `rejected`이고 이유는 `empty_briefing`입니다.
- 지정하지 않으면 새 세션 id는 새 UUID이고, 제목은 목표 텍스트(64자를 넘으면 자름)이며, 작업 디렉터리는 지금 세션 그대로입니다. `meta`에 넣은 항목은 새 세션에 기록됩니다. `parentSessionId`와 `handoffGoal`은 항상 기록되어, 어느 세션에서 넘어왔는지와 그때의 목표가 남습니다.
- `client`, `model`, `store`, `maxSummaryTokens`는 모델이나 저장소를 바꾸거나 브리핑 길이를 제한할 때만 넘깁니다. 이 세션이 루트 `createSession`으로 만들어지지 않았고 쓸 수 있는 모델도 없으면 `rejected`이고 이유는 `unsupported_session`입니다.

다음 경우에도 모델은 호출되지 않고 새 세션은 만들어지지 않습니다. 이미 닫힘(`session_closed`), 또는 지금 턴이 아직 도는 중(`turn_running`). 모델을 조립하지 못하면 `model_resolution_failed`입니다. 브리핑을 쓰지 못하면 `failed`이며 `reason`과 `message`를 봅니다. 새 세션을 만들지 못하면 `failed`이고 이유는 `session_create_failed`입니다.

성공하면 `status`는 `created`입니다. 이전과 새 세션 id, 목표, 브리핑, 파일 목록, 시드 메시지가 들어 있습니다. 열어 둔 `session`과 브리핑에 쓴 `usage`가 붙을 수도 있습니다.

같은 `createSession`으로 만든 세션에는 열거되지 않는 `session.handoff(options)`도 있으며 같은 일을 합니다. 타입에서는 내보낸 `handoffSession`을 호출하세요. 함께 나오는 것에는 시드 메시지 표식 `HANDOFF_PROVENANCE_TAG`(값은 `tansr-handoff-v1`), 그 메시지를 조립하고 다시 읽는 `buildHandoffSeedMessage`와 `readHandoffProvenance`가 있습니다.

CLI 대화 화면에서 `/handoff <goal>`은 같은 길입니다. 목표를 쓰지 않으면 사용법이 `/handoff <goal>`이라는 것만 보여 주고, 모델을 호출하지 않으며 보고 있는 세션도 바꾸지 않습니다. 브리핑이 나온 뒤 Esc 또는 Ctrl+C로 취소할 수 있습니다. 확인하면 화면은 새 세션으로 바뀝니다. 원래 세션은 디스크에 남으므로 `/resume`으로 엽니다.

## 이전 지점에서 다른 길을 연다

[체크포인트](/ko/sdk/checkpoints/)의 `session.fork(checkpointId)`는 바뀌지 않습니다. 스냅숏에서 새 세션을 복제합니다. 이미 확정된 지점에서 갈라지고, 요약에는 갈라진 뒤에 늘어난 부분만 담으려면 `restoreWithBranchSummary`를 씁니다.

- `checkpointId`만 넘기면 같은 선을 따라 되돌리는 복원 그대로입니다.
- `allowSibling: true`이거나 다른 기록을 `targetMessages`에 직접 넣으면, 같은 출발점을 가진 형제로 바꿉니다. 요약이 다루는 것은 두 기록이 갈라진 뒤의 차분과 파일 목록뿐입니다. 분기점 이전의 차가운 구간을 다시 통째로 훑지 않습니다.
- 성공하면 `status`는 `installed`입니다. 복원 전에 뜬 보호 스냅숏 `preRestoreCheckpointId`, 설치 전후의 메시지 수, 때로는 분기점 `lcaIndex`가 돌아옵니다. 요약은 하나입니다. 평소의 `session.restore` 동작은 그대로입니다.
- 인자가 잘못되면 `rejected` / `invalid_options`입니다. 루트 진입점으로 만들지 않은 세션은 `unsupported_session`입니다. 재료가 더 이상 맞지 않으면 `source_invalidated`입니다. 취소하면 `cancelled`입니다.

## 턴이 끝나지 않았는데 컨텍스트가 가득 찼다

컴팩션이 턴 도중에 일어나면, 이후 모델이 보는 요약은 둘로 나뉘어 쓰입니다. 이미 끝난 기록과, 이 턴에서 아직 끝나지 않은 접두사(당신의 요청, 이미 한 동작, 이어서 해야 할 현장)입니다. 도구 호출과 그 결과가 요약의 양쪽으로 갈라지지 않습니다. 다음 컴팩션은 이 포장을 먼저 풉니다. 같은 접두사를 여러 겹으로 씌우지 않습니다.

컴팩션을 더 일찍 시작할 수 있지만, 그것은 기본이 아닙니다. 컨텍스트 임계값에 `backgroundCompactMargin`(몇 토큰 일찍인지)을 더합니다. 사용량이 그 이른 선에 닿아도, 지금 내는 요청은 그대로 바로 나가고, 백그라운드는 그 시점의 읽기 전용 스냅숏만 요약합니다. 이 앞당김은 0보다 큰 유한한 수여야 합니다. `0`, 음수, 숫자가 아닌 값은 예외가 됩니다. 이 항목을 쓰지 않으면 지금 쓰는 패키지와 같고, 여분의 수위는 생기지 않습니다.

다음 관문은 아직 같은 판인지 봅니다. 세션을 비웠거나, 되감았거나, 동기 컴팩션이 그 스냅숏을 이미 지나갔다면, 백그라운드 요약은 버려지고 끼워 넣지 않습니다. 세션을 닫을 때 `closeAsync()`는 그 일이 끝나기를 기다리고 사용량을 기록합니다.

컴팩션, 분기 요약, 그때만 쓰는 제목이나 분류는 캐시 표식을 쓰지 않습니다. 본 대화가 그 보조 호출을 본문처럼 다시 읽지 않습니다. 당신 세션의 요청과 상주 서브에이전트 자신의 턴은 지금까지의 캐시 그대로입니다.

첫 턴에 쓴 도구 정의는 캐시 접두사로 고정됩니다. 나중에 켠 도구는 그 접두사 뒤에만 붙으므로, 접두사 전체를 다시 쓰지 않습니다.

## 도구가 너무 많으면 한 번에 다 넘기지 않는다

기본적으로 검색 도구는 늘지 않습니다. 조립할 때 `deferredDiscovery`를 넘긴 경우에만, 지연 적재 도구가 개수에 따라 `ToolSearch`로 모입니다.

- 지연 후보가 임계값에 닿을 때만 `ToolSearch`를 등록합니다. 임계값 기본은 16이고 `threshold`로 바꿉니다. 세션 도중에 MCP를 더 붙일 수 있으면 `force: true`로 두어, 16개 미만이어도 `ToolSearch`를 먼저 둡니다.
- 임계값 미만이고 강제도 아니면, 직접 넘긴 도구는 지금까지처럼 실립니다. 이것이 `eagerBelowThreshold`의 기본(`true`)입니다.
- 모델이 호출할 때 `query`는 비어 있으면 안 됩니다. 필요한 능력을 한 문장으로 쓰거나, 도구 이름을 정확히 쓰거나, `select:tool_a,tool_b`로 이름을 지정해 불러옵니다. `limit` 기본은 5이고 1에서 20까지입니다. 찾은 도구는 지금 바로 직접 호출할 수 있는 집합에 붙습니다.
- 이 설명 문장은 고정입니다. 도중에 MCP를 연결하거나 끊어도 목록 전체가 시스템 프롬프트에 붙지 않고, 이 문장도 바뀌지 않습니다.
- 서브에이전트는 각자 목록을 가집니다. 다른 쪽이 방금 켠 도구는 보이지 않습니다. 실제로 실행할 때는 지금까지 설정한 권한 확인을 통과합니다.

## 일을 서브에이전트에게 넘긴다

일 하나면 지금까지처럼 단일 `Task`입니다. `prompt`와 `description`을 둘 다 씁니다. `run_in_background: true`를 받는 형태는 이것뿐이며, 백그라운드에서 돌릴 수 있습니다.

순서대로 여러 단계면 `chain`이고 1에서 6단계입니다. 다음 단계는 `{previous}`로 이전 출력을 받습니다. 중간 본문은 이 세션 기록에 쓰이지 않습니다. 마지막에 보이는 것은 사슬 전체의 결과입니다.

나란히 여러 건이면 `tasks`이고 1에서 8건입니다. `concurrency` 기본은 동시에 4이고 범위는 1에서 8입니다. `policy` 기본은 `allSettled`이며 모든 결과를 기다립니다. `failFast`는 하나라도 실패하면 아직 끝나지 않은 형제를 멈추고, 자원이 정리될 때까지 기다립니다. `concurrency`와 `policy`는 `tasks`와 함께일 때만 유효합니다.

세 형태는 서로 배타이며 정확히 하나만 넘깁니다. 각 단계에는 `subagent_type`, `tools`, `model`, `max_turns`도 둘 수 있습니다. `max_turns`는 4에서 32로 잘립니다.

끝나고 사라지는 대신, 이 세션에 남겨 두고 중간에 새 지시를 보내고 싶은 서브에이전트도 있습니다. 동시에 남을 수 있는 것은 최대 4개이고, 조작할 수 있는 것은 자신이 직접 만든 것뿐입니다. 모델이 그것들을 다루는 도구는 다음과 같습니다.

- `SpawnAgent`: `label`과 `prompt`가 필수입니다. `subagent_type`과 `tools`는 선택입니다. `tools`를 빈 배열로 두면 말만 하고 도구는 호출하지 않습니다.
- `AgentFollowup`: `agent_id`와 `message`가 필수입니다. `mode`를 쓰지 않으면 `followup`이며 지금 턴 끝에 도착합니다. `steer`는 지금 도구 묶음이 끝난 뒤 방향을 바꿉니다.
- `AgentControl`: `action`은 `status`, `list`, `stop`, `release`입니다. `stop`과 `release`에는 `agent_id`가 필요합니다. `list`, 또는 id가 없는 `status`는 이 세션에 속한 서브에이전트를 봅니다.

`release`는 자리를 돌려줍니다. 상대가 멈춰 있고, 자원 정리가 끝났고, 아직 보내지 않은 보고가 없고, 그 상대가 더 가진 서브에이전트도 없을 때만 성공합니다. 아직 도는 중, 아직 정리 중, 또는 자식을 가지고 있으면 `agent_busy`입니다. 연속 실패로 멈춰 있고 사용 중인 자원이 없으면 해제할 수 있습니다. 해제하면 그에 해당하는 서브볼륨은 지워집니다.

이 관리 도구는 서브에이전트 자신에게 넘기지 않습니다.

서브에이전트는 지정하지 않으면 메모리 안에만 있습니다. 프로세스 재시작 뒤 그대로 되돌리려면 `subvolumeStore`와 `rootDir`을 넘깁니다. 파일은 `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json`이고, 경로는 그 부모 세션 디렉터리 밖으로 나가지 못합니다. 연속 충돌은 기본 5회(`restartLimit`, 양의 정수) 뒤 잠기고, 재시작해도 스스로 풀리지 않으며 당신이 `release`할 때까지 잠긴 채로 있습니다. 디스크에 쓰지 않는 세션 서비스에는 이 보관이 없으므로 서브볼륨도 디스크에 쓰지 않습니다.

## 여러 번 호출하는 도구를 짧은 스크립트 안에 둔다

수십 개의 중간 결과를 이 세션 기록에 쌓지 마세요. `createCodemodeTool`을 조립한 뒤, 모델은 `Codemode`(이름은 바꿀 수 있음)로 비동기 스크립트를 쓸 수 있습니다. 스크립트는 격리된 한 번짜리 worker 안에서 도구를 호출하고, 이 세션이 받는 것은 최종 반환값과 길이가 제한된 로그만입니다. 조립하지 않으면 이 도구는 없습니다.

모델은 `code`와 선택적 `timeout_ms`를 넘깁니다. 기본은 15초이고, 지정한 값의 상한은 60초입니다. 이 세션으로 돌아오는 텍스트는 기본적으로 최대 32 KiB입니다. worker 구세대 힙은 기본 48 MiB이고, 넘어도 멈추는 것은 이 worker뿐입니다.

스크립트 안의 `await tools.<name>(args)`와 `await callTool(name, args)`는 둘 다 기존 디스패처로 돌아갑니다. 권한 확인은 그대로 필요합니다. 스크립트 하나의 중첩 호출은 기본적으로 최대 32회입니다. 스크립트는 `Codemode` 자신을 다시 호출할 수 없고, `Task`, `SpawnAgent`, `AgentFollowup`, `AskUser`도 호출할 수 없습니다.

스크립트 안의 `store(key, value)` / `load(key)` 기본은 순수 메모리 표입니다. 키는 최대 64개, 합계 1 MiB, 키 이름은 최대 256자이고 디스크에는 쓰지 않습니다. 디스크에 쓰지 않는 세션 서비스도 이 표를 남기지 않습니다.

도구에 `outputSchema`를 선언하면 성공 결과는 프로그램이 읽는 `structuredData`를 가질 수 있습니다. 이 추가 데이터는 모델에 보내는 메시지에 들어가지 않습니다. 검사가 실패하면 제거되고 구조화 오류가 됩니다. 뒤의 훅이 텍스트를 바꾸고 같은 단계에서 `structuredData`를 바꾸지 않으면, 추가 데이터도 제거됩니다. 문장은 가렸는데 구조화 필드에 원문이 남는 일을 피하기 위해서입니다.

## 파일을 쓴 뒤, 같은 턴에서 검사를 돌린다

`afterRun`은 `createSession` 인자가 아닙니다. 쿼리 루프 옵션에 둡니다. 쓰지 않으면 전혀 돌지 않고, 파일을 읽기만 하거나 평범한 질문이어도 시작하지 않습니다.

이 턴에서 당신이 이름을 지정한 쓰기 도구가 성공해 쓰기를 끝낸 뒤에만, 쿼리가 끝나기 전이고 세션이 아직 점유된 동안 `verify`가 호출됩니다. 기본적으로 보는 이름은 `Edit`와 `Write`이고 `mutatingToolNames`로 바꿉니다. 오류 결과와, 취소 때문에 채워진 자리표시자는 성공한 쓰기로 세지 않습니다.

`verify`는 이번에 바뀐 경로, 어느 도구가 했는지, 몇 번째 검사인지(1부터 셈), 그 시점의 메시지, 취소 신호를 볼 수 있습니다. `{ action: 'pass' }`를 반환하면 끝납니다. `{ action: 'followup', prompt }`를 반환하면 같은 쿼리 안에서 당신의 지시에 따라 고칩니다. `maxAttempts` 기본은 최대 2회입니다. 더 큰 수는 5로 잘리고, `0`은 기록만 하고 고치지 않습니다. 턴 수, 예산, 취소 신호도 유효합니다.
