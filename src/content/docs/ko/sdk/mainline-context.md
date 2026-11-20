---
title: 메인라인의 컨텍스트와 서브에이전트
description: tansr-cli 메인라인에 이미 있고 CHANGELOG 버전 번호에는 아직 없는 호출면. 핸드오프 옵션과 거부 이유, 분기 요약, 컴팩션 수위, ToolSearch, Task와 상주 제어, Codemode 한도, 쓰기 뒤 검증. 공개된 SDK 0.20.1과 CLI 0.11.0에는 없습니다.
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

아래 동작은 `tansr-cli` 메인라인에 이미 들어가 있지만, **공개된 릴리스의 CHANGELOG에는 아직 없습니다**. npm의 `@tansr/sdk` 0.20.1과 CLI 0.11.0에는 없습니다. 이 변경이 들어 있는 패키지로 올리기 전에는 이 절의 호출을 작성하지 마세요. 생성된 SDK 기호 페이지는 공개된 계약을 그대로 따릅니다.

## 세션 핸드오프

`createSession`으로 만든 세션은 `handoffSession(session, options)`로 새 목표에 넘길 수 있습니다. 원본 세션은 읽기만 합니다(가장 최근 컴팩션 요약, 남겨 둔 꼬리 기록, 짝이 맞는 파일 목록). 새 목표를 향한 브리핑을 만들고, 시드 메시지 하나만 가진 새 세션을 만듭니다. 새 세션은 `parentSessionId`를 기록합니다. 원본의 메모리, 스냅샷, 영속 기록은 바꾸지 않으며 나중에 다시 열 수 있습니다.

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

옵션은 다음과 같습니다.

- `goal`은 필수이며, 공백을 뺀 뒤 비어 있으면 안 됩니다. 비어 있으면 `rejected`이고 이유는 `invalid_goal`이며, 모델을 호출하지 않습니다.
- `instructions`는 브리핑 생성에 더하는 선택 힌트입니다. `signal`이 중간 점검에서 중단되면 `cancelled`가 되고 새 세션은 남지 않습니다.
- `reviewDraft`는 `parentSessionId`, `goal`, `briefing`, `fileInventory`를 받습니다. 브리핑을 바꾸거나 `{ action: 'cancel' }`을 반환할 수 있습니다. 바꾼 본문이 비어 있으면 `rejected` / `empty_briefing`입니다.
- `newSessionId`의 기본값은 새 UUID입니다. `title`의 기본값은 목표 텍스트이고, 64자를 넘으면 자릅니다. `cwd`의 기본값은 원본 세션입니다. `meta`는 저장 메타데이터에 합쳐지며, `parentSessionId`와 `handoffGoal`은 항상 기록됩니다.
- `client`, `model`, `store`, `maxSummaryTokens`는 선택입니다. 루트 `createSession`으로 만들지 않았고 쓸 수 있는 모델도 넣지 않은 세션은 `rejected` / `unsupported_session`입니다.
- 닫힌 세션은 `session_closed`입니다. 아직 도는 턴은 `turn_running`입니다. 둘 다 모델을 호출하지 않습니다. 모델을 조립하지 못하면 `model_resolution_failed`입니다. 새 세션 생성이 실패하면 `failed` / `session_create_failed`입니다. 브리핑 생성 실패는 `failed`이며 `reason`과 `message`가 붙습니다.

`created`에는 `parentSessionId`, `sessionId`, `handoffGoal`, `briefing`, `fileInventory`, `seedMessage`가 있고, `session`과 `usage`가 붙을 수도 있습니다. 취소, 거부, 실패는 새 세션을 남기지 않습니다.

같은 팩토리로 만든 세션에는 열거되지 않는 `session.handoff(options)`도 붙습니다. 의미는 `handoffSession`과 같습니다. 타입에서는 내보낸 함수를 호출하세요. 같은 내보내기에는 `HANDOFF_PROVENANCE_TAG`(시드 메시지 표식 `tansr-handoff-v1`), `buildHandoffSeedMessage`, `readHandoffProvenance`도 있습니다.

CLI 대화 화면에는 `/handoff <goal>`이 추가되었습니다. 빈 목표는 사용법 `/handoff <goal>`만 보여 주고, 모델을 호출하지 않으며 현재 세션도 바꾸지 않습니다. 검토 중에는 Esc 또는 Ctrl+C로 취소할 수 있습니다. 확인하면 화면은 새 세션으로 바뀝니다. 원본 세션은 디스크에 남고 `/resume`으로 다시 찾습니다.

## 커밋된 노드에서의 분기

공개된 `session.fork(checkpointId)`는 여전히 스냅샷에서의 분기입니다. 이 페이지는 그 계약을 바꾸지 않습니다. 메인라인에 새로 생긴 면은 `restoreWithBranchSummary`입니다.

- `checkpointId`만 넘기면 엄격한 직선 조상 복원 그대로입니다.
- `allowSibling: true`이거나 `targetMessages`를 직접 넘기면, 같은 출발점을 가진 형제로 전환합니다. 요약은 공통 접두사에서 벗어난 차분과 파일 목록만 다룹니다. 분기점 이전의 차가운 구간은 통째로 훑지 않습니다.
- 성공은 `installed`입니다. 보호 스냅샷 `preRestoreCheckpointId`, 설치 전후의 메시지 수, 선택적 `lcaIndex`가 들어 있습니다. 요약 메시지는 정확히 하나입니다. `session.restore`의 기본 계약은 그대로입니다.
- 옵션이 잘못되면 `rejected` / `invalid_options`입니다. 루트 진입점으로 만들지 않은 세션은 `unsupported_session`입니다. 재료가 무효면 `source_invalidated`입니다. 중단은 `cancelled`입니다.

## 컴팩션

턴 도중에 컴팩션이 일어나면 요약은 두 부분으로 나뉩니다. 이미 끝난 기록과, 아직 끝나지 않은 현재 턴의 접두사(원래 요청, 이미 실행한 동작, 이어서 이어야 할 현장)입니다. 도구 호출과 그 결과는 요약의 양쪽으로 쪼개지지 않습니다. 다음 컴팩션은 이전 포장을 먼저 풀고, 같은 접두사를 겹겹이 씌우지 않습니다.

백그라운드 사전 컴팩션은 기본값이 아닙니다. 컨텍스트 임계값의 `backgroundCompactMargin`이 없으면 더 이른 수위는 생기지 않고, 반환 형태는 설정하지 않았을 때와 같습니다. 값은 유한하고 0보다 커야 합니다. `0`, 음수, 숫자가 아닌 값은 예외가 됩니다. 설정한 뒤 그 이른 수위(마이크로컴팩션 정지선과 자동 컴팩션 선 사이에 끼워진 값)에 닿아도 본 요청은 즉시 나가고, 백그라운드는 읽기 전용 스냅샷을 요약합니다. 다음 장벽은 세대와 재료가 아직 맞는지 확인합니다. 세션이 비워졌거나, 되감겼거나, 동기 컴팩션이 스냅샷을 지나갔으면 그 요약은 버려집니다. `closeAsync()`는 정리를 기다리고 사용량을 기록합니다.

한 번의 보조 요청(컴팩션, 분기 요약, 일회성 제목이나 분류)은 `skipCacheWrite`를 세워, 본 대화가 다시 읽을 캐시 표식을 남기지 않습니다. 주 세션 요청과 상주 서브에이전트의 주 턴은 이전 캐시 정책을 유지합니다.

첫 턴의 도구 정의는 캐시 접두사로 고정됩니다. 나중에 켠 도구는 그 접두사 뒤에만 붙습니다.

## 지연 도구 발견

`deferredDiscovery`가 없으면 도구 조립은 이전과 같고 `ToolSearch`는 나타나지 않습니다. 넘긴 뒤에야 지연 후보 수로 등록이 결정됩니다.

- 후보가 임계값에 닿을 때만 `ToolSearch`를 등록합니다. 임계값 기본은 16이고 `threshold`로 바꿀 수 있습니다. `force: true`이면 모자라도 등록해서, 세션 도중에 MCP를 더 붙일 수 있습니다.
- 임계값 미만이고 강제가 아니면, 직접 넘긴 도구는 기본으로 그대로 실립니다(`eagerBelowThreshold` 기본값은 `true`).
- 모델이 `ToolSearch`를 호출할 때 `query`는 필수이고 공백이면 안 됩니다. 자연어 키워드, 정확한 도구 이름, 또는 `select:tool_a,tool_b`입니다. `limit` 기본은 5이고 범위는 1에서 20입니다. 맞은 도구는 현재 도구 집합에 붙습니다.
- 설명 문장은 얼려 둔 상수입니다. 도중에 MCP를 연결하거나 끊어도 이 문장은 바뀌지 않고, 목록 전체를 시스템 프롬프트에 붙이지도 않습니다.
- 서브에이전트는 각자 목록을 가지며, 다른 서브에이전트가 켠 도구는 보지 못합니다. 실제 실행은 기존 권한 문을 통과합니다.

## Task와 상주 서브에이전트

상주 서브에이전트는 동시에 최대 4개입니다. 부모 세션은 자신이 직접 만든 자식만 조작할 수 있습니다. 모델이 보는 도구는 다음과 같습니다.

- `SpawnAgent`: `label`과 `prompt`가 필수입니다. `subagent_type`과 `tools`는 선택입니다. 빈 `tools`는 텍스트만 쓰는 상주 에이전트입니다.
- `AgentFollowup`: `agent_id`와 `message`가 필수입니다. `mode` 기본은 `followup`이며 현재 턴 끝에 줄을 섭니다. `steer`는 현재 도구 묶음이 끝난 뒤 방향을 바꿉니다.
- `AgentControl`: `action`은 `status`, `list`, `stop`, `release`입니다. `stop`과 `release`에는 `agent_id`가 필요합니다. `list`, 또는 `agent_id`가 없는 `status`는 현재 범위의 자식을 모두 봅니다.
- `release`는 멈춤이 끝나고, 물리적 마무리가 끝나고, 아직 전달할 보고가 없고, 계속 소유한 자식도 없을 때만 성공합니다. 아직 도는 중, 마무리 중, 또는 자식을 소유 중이면 `agent_busy`입니다. 차단으로 주차되어 있고 진행 중인 자원이 없으면 해제할 수 있습니다. 해제는 해당하는 영속 서브볼륨을 지웁니다.

이 부모 제어 도구는 일반 도구로 자식에게 넘기지 않습니다.

`Task`의 세 형태는 서로 배타이며 정확히 하나만 넘깁니다.

- 단일 작업은 `prompt`와 `description`이 모두 필수입니다. `run_in_background: true`를 받는 형태는 이것뿐입니다.
- `chain`: 1에서 6단계입니다. 다음 단계는 `{previous}`로 이전 출력을 받습니다. 중간 본문은 부모 기록에 쓰지 않습니다.
- `tasks`: 1에서 8개를 병렬로 둡니다. `concurrency` 기본은 4이고 범위는 1에서 8입니다. `policy` 기본은 `allSettled`이고, 또는 `failFast`입니다. `concurrency`와 `policy`는 `tasks`와 함께일 때만 유효합니다. `failFast` 또는 부모 취소 때는 끝나지 않은 형제를 멈추고, 자원 마무리가 끝날 때까지 기다립니다.

각 단계에는 `subagent_type`, `tools`, `model`, `max_turns`도 둘 수 있습니다. `max_turns`는 4에서 32로 잘립니다.

상주 서브에이전트는 기본적으로 메모리에만 있습니다. `subvolumeStore`와 `rootDir`을 명시할 때만 `<rootDir>/subvolumes/<parentSessionId>/<agentId>.json`에 쓰고, 프로세스 재시작 뒤 그 서브볼륨으로 따뜻하게 재개합니다. 경로는 그 부모 세션 디렉터리 안에 잠깁니다. 연속 충돌은 기본 5회(`restartLimit`, 양의 정수여야 함) 뒤 잠기고, 재시작을 넘어도 `release`할 때까지 잠긴 채로 있습니다. 디스크가 없는 세션 서비스는 이 저장소를 제공하지 않으므로 서브볼륨을 디스크에 쓰지 않습니다.

## Codemode와 구조화 결과

도구는 선택적 `outputSchema`를 가질 수 있습니다. 성공 결과는 `structuredData`를 가질 수 있습니다. 이 데이터는 모델에 보내는 메시지에 들어가지 않습니다. 검사가 실패하면 벗겨지고 구조화 오류가 됩니다. 뒤의 훅이 텍스트를 바꾸고 같은 단계에서 `structuredData`를 갱신하지 않으면, 구조화 데이터도 제거됩니다.

`Codemode`는 기본 도구가 아닙니다. `createCodemodeTool`을 조립한 뒤에만 나타나며, 도구 이름 기본은 `Codemode`입니다. 모델은 `code`(비동기 함수 본문)와 선택적 `timeout_ms`를 넘깁니다.

- 스크립트는 한 번짜리 worker에서 돌고, 끝나면 종료됩니다. 기본 시간 제한은 15초이고, 요청 값은 최대 60초로 잘립니다. 부모 세션에 돌려주는 텍스트는 기본적으로 최대 32 KiB입니다. worker 구세대 힙은 기본 48 MiB입니다.
- `await tools.<name>(args)`와 `await callTool(name, args)`는 둘 다 호스트 디스패처로 돌아가며 권한 문을 통과합니다. 스크립트 하나의 중첩 호출은 기본적으로 최대 32회입니다. `Codemode` 자신을 다시 호출할 수 없고, `Task`, `SpawnAgent`, `AgentFollowup`, `AskUser`를 중첩할 수도 없습니다.
- `store(key, value)` / `load(key)`의 기본은 순수 메모리 표입니다. 키는 최대 64개, 합계 1 MiB, 키 이름은 최대 256자입니다. 디스크에 쓰지 않습니다. 디스크가 없는 세션 서비스도 영속화하지 않습니다.

## 쓰기 뒤 검증

`afterRun`은 `createSession` 필드가 아닙니다. 커널 쿼리 루프 옵션에만 있습니다. 설정이 없으면 전혀 돌지 않습니다.

- `verify`는 필수입니다. 맥락에는 `mutations.mutatedFiles`, `mutations.mutatingTools`, 1부터 세는 `attempt`, 그 시점의 메시지, 취소 신호가 있습니다.
- `mutatingToolNames` 기본은 `Edit`와 `Write`입니다. 이 도구들이 성공적으로 쓰기를 끝낸 경우만 셉니다. 오류 결과와 합성된 중단 자리표시자는 세지 않습니다.
- 호출은 쿼리가 자연히 끝나기 전, 세션이 아직 바쁜 동안입니다. `{ action: 'pass' }`이면 끝납니다. `{ action: 'followup', prompt }`는 같은 쿼리 안에서 고칩니다.
- `maxAttempts` 기본은 2이고 0에서 5로 잘립니다. 턴 수, 예산, 취소 신호도 제한합니다. 읽기만 하거나 평범한 질문이면 트리거되지 않습니다.
