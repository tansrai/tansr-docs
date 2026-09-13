---
title: '세션 닫기와 리소스 정리 대기'
description: 'closeAsync, drain, MCP 완료 영수증으로 종료, 시간 초과, 실패, 재시도를 처리하고, Electron과 Android, iOS의 책임 경계를 설명합니다.'
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - getting-started/sdk
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-09-13'
---

이 페이지는 `@tansr/sdk@0.13.0`과 `@tansr/serve@0.8.0`을 기준으로 하며, 해당 버전은 npm에 게시되었습니다. "0.14.0 후보"로 표시한 부분은 아직 게시되지 않았습니다. 업무 이벤트의 종료와 리소스의 실제 종료는 서로 다른 시점입니다. 아래 인터페이스에는 해당 호환 버전이 필요합니다.

| 작업 | 용도 |
| --- | --- |
| `idle()`, `close()`, `session.ended` | 기존 업무 종료 상태를 유지. 저장소와 하위 리소스의 완료를 증명하지 않음 |
| `session.drain(options?)` | 현재 쿼리, 유휴 작업, 커밋, 이미 시작된 정리를 기다림. 세션은 닫지 않음 |
| `session.closeAsync(options?)` | 먼저 논리적으로 닫은 뒤, 같은 예산으로 실제 정리를 기다림 |
| `drain({ force: true })` / `closeAsync({ force: true })` | **0.14.0 후보**: 예산을 다 쓴 뒤 정리 배리어를 풀고 자체 리소스를 직접 해제. 계약을 어긴 어댑터가 정리를 영원히 붙잡아 둘 수 없게 됨. 결과는 항상 `status: 'failed'` |
| `host.dispose()` | 앱이 대여한 모든 세션이 완료된 뒤 공유 MCP host를 닫음 |

```ts
const session = await createSession({ token, baseUrl, store });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('整理这次工作记录');
await session.idle();
const result = await session.closeAsync({ timeoutMs: 30_000, flushStore: true });
await pump;
if (result.status !== 'completed') {
  showCleanupState(result.status, result.pending, result.failureCount);
  // 保留 session，稍后继续：await session.drain({ timeoutMs: 30_000 });
}
```

`status`는 `completed`, `failed`, `timeout` 또는 `cancelled`입니다. `pending`은 각 단계의 수량이고, `failures`는 크기가 제한된 진단 창이며, 누적 수는 `failureCount` / `omittedFailures`에 있습니다. 원시 `cause`에는 민감한 정보가 들어 있을 수 있으므로 웹 페이지, renderer, 로그에 직접 보내지 마세요.

관찰 기본값은 30초입니다. `0`은 현재 상태만 읽고, `Infinity`는 호스트가 실제 의존성 체인을 명확히 관리할 때만 사용합니다. 시간 초과나 `signal`은 이번 대기만 끝내며, 하위 작업은 계속되고 다른 대기자는 영향을 받지 않습니다. `flushStore`의 기본값은 false이며, SDK는 대여한 store를 닫지 않습니다. `retryPersistence: true`는 복구 대기 중인 최신 전체 기록 커밋을 명시적으로 재시도하되 업무 콜백은 재생하지 않습니다. 성공하면 이전 오류는 유지되면서 `recovered`로 표시됩니다. `onHistoryCommit` 안에서 같은 세션의 `drain()`을 기다리지 마세요.

**`force`(`@tansr/sdk` 0.14.0 후보, 미게시)**: 기본 `drain()`은 관찰만 하고 자체 리소스를 해제하지 않으므로, 계약을 어긴 저장소 / MCP 어댑터(`settle()`가 `pending > 0`을 반환하거나 시간 초과)를 만나면 정리가 계속 매달려 있게 됩니다. `drain({ force: true })` / `closeAsync({ force: true })` / 단일 턴 `cleanup.drain({ force: true })`는 예산을 다 쓴 뒤 배리어를 풀고, 아직 진행 중인 정리에 `query_settlement_forced` / `compaction_settlement_forced`를 기록한 다음, 자체 리소스를 직접 해제(세션 수준 MCP host의 `close` 호출)하고 같은 예산으로 완료를 기다립니다. 결과는 항상 `status: 'failed'`이며 구조화된 실패를 동반합니다. 아직 닫히지 않은 세션에는 효과가 없습니다. 먼저 `close()`를 호출하거나 `closeAsync({ force: true })`를 사용하세요. 같은 후보에서 `query()` 정리 실패 시의 `SdkLifecycleError`에 `error.result`(완료된 `QueryResult`, `onLifecycleError`에도 전달)가 추가되어, 최종 텍스트가 필요한 호출자는 `error.result?.finalText`를 읽습니다.

## 세션 저장소를 삭제하거나 이전하기 전에

단일 `store.get(sessionId)`는 이미 store에 들어간 작업 뒤에만 배치됩니다. 이전 턴의 `onHistoryCommit` 콜백이 아직 끝나지 않았을 때, 다음 턴의 커밋은 여전히 세션 큐에 머물러 있을 수 있습니다. `idle()`과 이벤트 스트림이 모두 끝났더라도 다시 읽으면 이전 기록을 얻을 수 있습니다.

이 세션 전용 디렉터리를 삭제 또는 이전하거나 최종 기록으로 세션을 재구축하기 전에, `closeAsync({ timeoutMs: 30_000, flushStore: true })`를 호출하고 `status === 'completed'`를 확인하세요. 시간 초과, 취소 또는 실패 시에는 세션과 디렉터리를 유지하고, 나중에 계속 기다리거나 실패를 처리하세요. 여러 세션이 저장소를 공유할 때는 모든 사용자의 완료를 하나씩 확인한 뒤 호스트가 공유 store를 관리하세요. 어느 한 세션의 영수증을 전체 디렉터리에 쓰기가 없다는 증거로 삼지 마세요.

## 단일 턴 query와 오류 채널

`query()`를 중간에 break하면 쿼리가 중단되고 `cleanupTimeoutMs` 안에서 정리를 관찰합니다. 소비 코드 자체가 예외를 던지면 JavaScript는 그 예외를 우선 보존할 수 있습니다. `onLifecycleError`로 다른 하나의 정리 오류와 계속 관찰할 진입점을 저장하세요.

```ts
let cleanup;
for await (const event of query({ token, baseUrl, prompt: '总结目录',
  cleanupTimeoutMs: 30_000,
  onLifecycleError(error) { cleanup = error.cleanup; showFailure(error.code); },
})) {
  render(event);
  if (userStopped()) break;
}
if (cleanup) showCleanupReceipt(await cleanup.drain({ timeoutMs: 30_000 }));
```

관리형 / 토큰 방식 query는 `skills`와 `mcp`를 명시적으로 제공할 수 있으며, createSession과 기능 플래그 검사 및 소유권 규칙을 공유합니다. 확장을 생략하면 스킬 디렉터리를 능동적으로 읽지 않습니다. 주입 client 방식은 확장을 암묵적으로 어셈블리하지 않습니다.

## MCP 소유권과 크로스 플랫폼

`mcp: { servers }`는 현재 세션 / 쿼리가 소유합니다. 명시적으로 전달한 `McpHost`는 대여입니다. 공유 host는 모든 사용자가 실제로 완료된 뒤에야 dispose해야 합니다. 동시 dispose와 성공 후 중복 dispose는 합류합니다. 확정 실패 후 다시 명시적으로 호출하면 확인되지 않은 리소스만 재시도합니다.

`cleanupEvidence`의 `transport-completion`은 로컬 전송 완료 층까지 기다렸음을 나타내고, `connector-close-promise`는 서드파티 연결의 close Promise만을 나타냅니다. 자체 stdio 등 로컬 child와 스트림은 종료를 기다리고, HTTP 등은 로컬의 진행 중인 스트림을 기다린 뒤 최선을 다해 DELETE합니다. 이들 모두 등록되지 않은 임의의 프로세스나 HTTP 원격 서비스가 이미 종료되었음을 보장하지 않습니다.

Electron 예제는 메인 프로세스에서 closeAsync를 사용하며, 미완료 세션과 host를 유지합니다. 바깥의 유한한 관찰이 시간 초과되면 다시 기다리기를 표시하고, 사용자가 바로 종료를 선택할 때만 남은 정리를 건너뜁니다. Android / iOS는 기존 serve 프로토콜을 사용합니다: 연결 끊김과 재연결은 세션 삭제와 같지 않으며, DELETE 응답과 session.ended는 하위 프로세스 종료를 증명하지 않습니다. Node 호스트는 먼저 기존 drain 예산으로 정지한 뒤 `server.settleResources()`를 기다리고, 마지막으로 공유 리소스를 닫습니다.

CLI, ACP, headless의 MCP 새 관찰 상한은 10초이며, 기존 프로토콜과 도구 종료 정책은 유지됩니다. 내장 Task / 이어갈 수 있는 에이전트는 중첩 쿼리 영수증을 부모 리소스 도메인에 넘깁니다. TUI는 추가로 백그라운드 Task, 메모리 추출 / 고정 / 승격, 선택기의 실제 완료 지점을 기다리고, serve / ACP는 메모리 owner가 활동 목록에서 빠진 뒤에도 세션 닫기 체인이 그것을 보유합니다. 직접 추가한 백그라운드 작업은 명시적으로 연결해야 합니다. abort를 무시하는 서드파티 도구는 계속 pending일 수 있으며, 어떤 영수증도 등록되지 않은 임의의 자식 프로세스가 이미 종료되었음을 증명할 수 없습니다.
