---
title: '작업 진행 중 입력 추가'
description: '같은 실행 안에서 요구 사항을 보충합니다. 도구를 중단하지 않고 세션을 다시 열지 않습니다. SDK, CLI, serve, ACP, headless의 연결, 영수증, 실패 경계를 설명합니다.'
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/system-prompts
  - sdk/lifecycle
  - getting-started/serve
sources:
  - tansr-cli:doc/INJ-同轮追加输入手册.md
  - tansr-cli:packages/kernel/src/query/session-input-delivery.ts
  - tansr-cli:packages/cli/src/headless/input-control.ts
  - tansr-cli:packages/server/src/v2/routes.ts
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-05'
---

이 페이지는 `@tansr/sdk@0.13.0`, `@tansr/cli@0.6.0`, `@tansr/serve@0.8.0` 이상을 기준으로 하며, 해당 버전은 npm에 게시되었습니다(현재 0.18.1 / 0.10.1 / 0.14.0, 2026-10-04 게시. 그 사이 이 페이지 인터페이스의 시그니처, 영수증, 실패 경계에는 변화가 없습니다). 모바일 앱에도 기능 탐색과 동일 턴 입력을 구현한 클라이언트 버전이 필요합니다(각 클라이언트 연동 가이드 참고). 소스 코드와 문서 검증은 휴대폰 실제 기기 검수를 의미하지 않습니다.

**`submitInput`은 지정한 실행 중인 턴에만 사용자 입력을 추가합니다.** 현재 모델 스트림이나 도구를 끊지 않고, 새 세션을 만들지 않으며, 대상 턴이 닫힌 뒤 자동으로 다음 턴을 열지도 않습니다. 이미 시작된 요청은 다시 쓰이지 않습니다. 추가한 텍스트는 안전한 입력 배리어에서 기록에 들어가고, 그 뒤에야 다음 모델 호출에 쓰일 수 있습니다.

## SDK: "작업 시작"과 "요구 사항 보충"을 분리

유휴 상태에서는 계속 `session.send()`로 작업을 시작합니다. 보충 버튼은 그 클릭 시점에 얻은 대상과 안정적인 입력 ID를 사용합니다. 실패 분기에서 `send()`로 폴백하지 마세요.

```ts
import { randomUUID } from 'node:crypto';
import { createSession } from '@tansr/sdk';

const session = await createSession({ token, baseUrl });
const pump = (async () => {
  for await (const event of session.events) render(event);
})();
session.send('审阅合同并整理待确认条款');

// 由 UI 的“补充”操作调用；SDK 在 Electron 主进程/Node 宿主运行。
async function supplement(text: string) {
  const target = session.getInputTarget();
  if (target === null) return { outcome: 'closed' as const, code: 'turn_closed' };
  const request = { inputId: randomUUID(), target, content: { text }, ack: 'memory' as const };
  await retainInputDraft(request); // 宿主先保留原 ID、目标和内容；保存失败则不提交。
  const result = await session.submitInput(request);
  // 网络抛错时原 request 仍在宿主，先查询；成功时按 result 更新显示。
  return { request, result };
}

// 在后续 UI 事件或显式查询动作中，使用原 ID 与原目标。
// session.getInputStatus(request.inputId, request.target)
// 退出时另行 await session.closeAsync()，并核对其真实收尾回执。
```

`token`, `baseUrl`, `render`, `retainInputDraft`는 앱이 제공합니다. `retainInputDraft`는 호스트의 초안 저장 함수이며 SDK API가 아닙니다. 제출 전에 완료되어야 하며, 네트워크 실패 후에도 원래 요청을 삭제하지 마세요. 이벤트 펌프는 턴을 넘어 유지됩니다. 보충할 때마다 새 `createSession()`, `query()`를 만들거나 `interrupt()`를 호출하지 마세요. `query()`의 간편 이벤트 생성기에는 이 세션 인터페이스가 없습니다. 저수준 `runAgent()`의 `QueryHandle`은 `reserveUserInput` 등 커널 기능을 제공하지만, 소비와 라이프사이클은 직접 책임져야 합니다.

| 인터페이스 | 반환과 용도 |
| --- | --- |
| `inputCapabilities()` | `version: 1`, 텍스트 / 텍스트 블록과 memory 지원, `durableAck: false`, `image: false`, 현재 대상과 영수증 보존 범위 |
| `getInputTarget()` | `{ historyEpoch, turnId }` 또는 `null`. 대상이 닫혔을 때 슬며시 새 턴으로 바꾸면 안 됨 |
| `submitInput({ inputId, target, content, ack? })` | `accepted`는 `receipt`를 동반. `closed` / `rejected`는 기계 판독 `code`를 동반 |
| `getInputStatus(inputId, target)` | 영수증 또는 `null`. 조회 자체는 입력이나 도구를 재생하지 않음 |

`content`는 `{ text: '补充要求' }`일 수도 있고 `{ blocks: [{ t: 'text', text: '第一点' }, { t: 'text', text: '第二点' }] }`일 수도 있습니다. 후자는 줄 바꿈으로 연결됩니다. 빈 텍스트, 이미지 블록 혼합, 지원하지 않는 내용은 조용히 잘려 나가지 않습니다. 이번 단계에서는 `ack: 'memory'`만 지원하며, 생략해도 memory입니다. `durable`은 명시적으로 거부되며, `SessionStore`를 설정해도 이 인터페이스가 내구성 있는 전달로 격상되지 않습니다.

## 영수증, 재시도, 복구

| 영수증 상태 | 무엇을 말해 주는가 |
| --- | --- |
| `accepted` | 메모리에서 수락됨. 모델 컨텍스트에 들어갔음은 아직 증명하지 않음 |
| `consumed` | 이번 턴 기록에 적용됨. 요청이 발송되었거나, 모델이 이해했거나, 업무 작업이 완료되었음과는 다름 |
| `closed` / `cancelled` | 소비되지 않은 입력이 종료됨. `reason`을 확인하고, 작업 완료로 간주하면 안 됨 |
| `reserved` | 저수준 커널 예약 단계. 일반 memory 호스트 제출은 즉시 commit되며 durable 약속을 제공하지 않음 |

영수증에는 `inputId`, `sessionId`, `historyEpoch`, `turnId`, `ordinal`, `revision`, `source`, `state`, `durability: 'memory'`와 선택적 `reason`이 포함됩니다. `ordinal`은 같은 턴 안의 수락 순서이고, `revision`은 상태 업데이트에 따라 바뀝니다. 같은 ID, 같은 대상, 같은 정규화된 텍스트로 재시도하면 원래 영수증을 반환합니다. 텍스트가 바뀌면 `input_conflict`를 받습니다. 중복 제출은 이미 `consumed` 또는 `closed`된 원래 영수증을 반환할 수 있으므로, 바깥의 `outcome: 'accepted'`만 보고 "처리 대기 중"으로 표시하면 안 됩니다.

네트워크가 끊긴 뒤에는 먼저 원래 ID / 대상으로 조회하고, 필요하면 완전히 같은 요청을 다시 보내세요. 새 ID를 자동 생성하거나, 대상을 바꾸거나, 기존 `messages` 라우트를 호출하지 마세요. 그렇지 않으면 입력이 하나 더 생길 수 있습니다. 영수증은 현재 턴과 가장 최근에 끝난 턴의 것만 보존합니다. SDK 조회가 `null`이거나 serve가 **404 + `{ outcome: 'rejected', code: 'input_not_found' }`**를 반환하는 것은 현재 보존 창에 일치하는 영수증이 없다는 뜻일 뿐이며, 이미 만료되었거나 재시작되었거나 무효화되었을 수 있고, "확실히 실행되지 않았다"는 증명으로 삼을 수 없습니다. 모든 404를 빈 영수증으로 취급하지 마세요. 기존 `session_not_found`, 401/403 등 세션 / 인증 오류는 여전히 원래 오류대로 처리해야 합니다. 조회로 찾은 `closed` 영수증과 제출 시 대상 닫힘으로 인한 409도 "찾을 수 없음"과 뒤섞으면 안 됩니다.

명시적인 기록 복구 / 대체와 런타임 재구축은 `historyEpoch`를 바꿉니다. 일반 압축은 이 입력 에포크를 바꾸지 않습니다. 휴대폰이 아직 실행 중인 같은 serve 세션에 다시 연결하면 계속 조회할 수 있습니다. serve 재시작이나 재구축은 원래 실행 턴을 되살리지 않으며, memory 영수증도 보존을 보장하지 않습니다. 클라이언트는 초안을 유지하고 미확인으로 표시하며, 후속 작업은 사용자가 결정하게 하고, 도구를 자동으로 재생하면 안 됩니다.

## 다섯 형태와 세 클라이언트

| 형태 | 진입점과 경계 |
| --- | --- |
| CLI TUI | 실행 중 Enter는 엄격한 보충으로 처리. 권한 / 질문 대화 상자 안에서는 `Ctrl+O`로 보충 입력으로 전환하고, `Esc`로 초안을 지운 뒤에도 보충 포커스를 유지하며, 다시 `Ctrl+O`를 눌러야 승인으로 돌아감. 숫자와 Enter는 보충을 동의로 간주하지 않음 |
| SDK | 위의 `AgentSession` 네 메서드를 사용. Windows Electron은 메인 프로세스에서 세션과 ID를 바인딩하고, renderer는 IPC로 호출하며, 장기 플랫폼 키를 보유하지 않음 |
| serve | 아래의 v2 라우트를 사용. Android/iOS는 같은 serve 세션에 연결하며, 각자 별도의 Node SDK나 커널을 실행하지 않음 |
| ACP | 협상된 비공개 확장을 사용. 기존 `session/prompt`는 바쁠 때 여전히 거부하며, 새 확장은 기존 prompt의 응답 ID나 완료 결과를 대체하지 않음 |
| headless | 명시적인 NDJSON 양방향 제어 모드. 한 번의 `-p`가 한 번의 query에 대응하며, 추가 프레임은 새 query를 시작하지 않음 |

기존 `send()` / serve `messages`의 호환 진입점은 여전히 있습니다. 자연스러운 `completed` / `structured_output` 마감 창 안의 기존 사용자 입력은 다음 턴으로 이월될 수 있습니다. 같은 세대의 한도, 명시적 중단 등 하드 종료 상태에서는 자동으로 다른 턴을 열어 예산을 우회하는 것이 허용되지 않습니다. 엄격한 같은 턴 의미론이 필요하면 항상 새 진입점을 사용하세요. CLI 에이전트 알림은 기존 큐 / 확인 규율을 독립적으로 유지하며, 사용자 승인으로 간주하지 않습니다.

## serve: 인증 후 원래 세션에 바인딩

해당 serve 배포의 인증 방식을 그대로 따릅니다. 서버 쪽은 인증된 앱 / 최종 사용자 도메인에서 소속을 결정하며, 클라이언트가 `sessionId`를 제출해도 사용자 간 세션 권한을 얻지 못합니다.

```http
GET /v2/sessions/{sessionId}/input-capabilities
POST /v2/sessions/{sessionId}/inputs
Content-Type: application/json

{"inputId":"ui-001","target":{"historyEpoch":"FROM_CAPABILITIES","turnId":"FROM_CAPABILITIES"},"content":{"text":"请同时核对续约条款"},"ack":"memory"}
```

```http
GET /v2/sessions/{sessionId}/inputs/ui-001?historyEpoch=FROM_CAPABILITIES&turnId=FROM_CAPABILITIES
```

경로와 쿼리 값은 URL 인코딩하세요. 제출 성공은 **202 + `{ outcome: 'accepted', receipt }`**를 반환합니다. 대상 닫힘 / 내용 충돌은 409, 주입 할당량은 429, 지원하지 않는 기능 / 내용은 422, 형식 오류는 400입니다. 상태 조회 성공은 200 + `{ receipt }`, 찾을 수 없음은 404입니다. 기존 `POST .../messages`의 202 의미는 호환성을 유지하며, 새 입력 영수증과 같지 않습니다. SSE는 기존 이벤트 프로토콜을 계속 전송합니다. 이번 단계에서는 입력 상태 SSE 이벤트를 추가하지 않으며, 클라이언트는 조회 인터페이스를 호출해 표시를 업데이트합니다.

`@tansr/serve` 0.13.0부터(2026-10-02 게시) 새 통합은 통합 호출 표면을 사용합니다. 같은 작업 묶음이 `/api/sessions/{sessionId}/input-capabilities`, `/api/sessions/{sessionId}/inputs`, `/api/sessions/{sessionId}/inputs/{inputId}`에서 도달 가능하며, 요청 본문과 `{ outcome, receipt }` 영수증의 바이트는 변하지 않습니다. 400 이상의 오류는 통합 봉투로 바뀌고(`code`는 통합 코드, 원래 도메인 코드는 `detail.domainCode`), 모든 `/api` 응답에 `tansr-contract` 등 통합 응답 헤더가 붙습니다. `/v2` 직접 연결 표면은 이 버전에서도 사용할 수 있고 바이트도 변하지 않지만, 내부 어댑터 진입점으로 정의되어 1.0.0에서 외부 진입점이 제거됩니다. 같은 세션은 한 가지 접두사만 사용하세요. [통합 API](/ko/unified-api/)와 [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 참고하세요.

## ACP: 확장 협상, 일반 prompt를 동시에 제출하지 않음

먼저 ACP 초기화를 하고, `agentCapabilities._meta['tansr.com'].midTurnInput`에서 확장 버전을 확인한 뒤, `_tansr.com/session/input_capabilities`를 호출해 지정 세션을 조회합니다. 아래는 모두 JSON-RPC 요청이며, 각자 독립된 `id`를 사용합니다.

```json
{"jsonrpc":"2.0","id":"caps","method":"_tansr.com/session/input_capabilities","params":{"sessionId":"SESSION"}}
{"jsonrpc":"2.0","id":"extra","method":"_tansr.com/session/steer","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"补充续约要求"},"ack":"memory"}}
{"jsonrpc":"2.0","id":"status","method":"_tansr.com/session/input_status","params":{"sessionId":"SESSION","inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
```

`steer`의 RPC result는 호스트 `outcome`이고, `input_status`는 `{ receipt }`를 반환합니다(알 수 없으면 `null`). 일반 prompt는 여전히 자신의 최종 응답만 가집니다. 기존 권한 응답 채널만 도구를 승인할 수 있습니다. "허용" 텍스트를 보내도 권한을 승인하는 부작용은 없습니다. 지원을 협상하지 않은 새 클라이언트는 바쁠 때의 `session/prompt`로 추가를 모방하지 마세요.

## headless: 한 번 시작하면 이후에는 제어 프레임만

```sh
tansr -p "审阅合同" --output-format stream-json --input-format ndjson
```

`--cc-compat`, `--bg` 또는 집계된 `json`/`text` 출력과 함께 쓰지 마세요. `--input-format text`는 기존 stdin 텍스트 동작을 유지합니다. 비어 있지 않은 `-p`를 반드시 제공해야 하며, 이번 단계에는 stdin `start` 프레임이 없습니다.

먼저 stdout의 `tansr.input.ready`를 읽어 `capabilities.target`을 얻습니다. 그런 다음 아래 각 JSON 객체를 독립된 한 줄로 stdin에 씁니다.

```json
{"v":1,"id":"a","method":"steer","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"},"content":{"text":"追加要求"},"ack":"memory"}}
{"v":1,"id":"b","method":"input_status","params":{"inputId":"ui-001","target":{"historyEpoch":"EPOCH","turnId":"TURN"}}}
{"v":1,"id":"c","method":"cancel"}
```

위 예시의 세 번째 줄은 명시적 취소 예시이며, 정상적인 추가에서는 보내지 않습니다. 응답은 `tansr.input.response`이며, 프레임 `id`를 그대로 사용하고 `result`에 영수증 / 거부 또는 `cancel_requested`를 담습니다. 이 레코드는 커널 이벤트와 stdout을 공유하며 `type`으로 구분합니다. 마지막에는 기존 `result` 하나만 있으며, 취소는 기존 종료 코드를 따릅니다. UTF-8 분할, LF/CRLF, EOF 앞에 줄 바꿈이 없는 마지막 프레임은 모두 처리할 수 있습니다. 한 줄의 상한은 **65,536 UTF-16 code units**이며 바이트 수가 아닙니다. 잘못된 프레임 / 너무 큰 프레임에는 명확한 거부 레코드가 있습니다.

stdin EOF는 제어 입력만 끝내며 query를 취소하지 않습니다. query가 먼저 끝나면 읽기를 중지하고 EOF를 기다리지 않으며, 최종 결과 뒤에는 늦게 도착한 프레임에 응답하지 않습니다. stdout을 읽을 때는 이벤트와 제어 응답을 계속 비워 내세요. 제어 채널은 쓰기 백프레셔 시 읽기를 일시 중지하며, 이를 전체 모델 이벤트 스트림이 내구성 있는 메시지 큐를 제공하는 것으로 해석하면 안 됩니다.

## 설정, 권한, 예산은 원래 경계를 유지

보충 내용은 사용자 메시지이며 시스템 역할이 아닙니다. 플랫폼 프롬프트, SDK/serve `system`과 `systemAppend`는 이번 턴의 스냅숏을 유지하며, 보충 때문에 다시 가져오거나 다시 어셈블리하지 않습니다. 다음 새 턴에서야 기존 [프롬프트 계층](/ko/sdk/system-prompts/)에 따라 플랫폼 설정을 새로 고칩니다. MCP/skills/도구 집합은 보충 때문에 자동으로 늘어나지 않습니다.

새로운 실제 사용자 의도는 소비 경계에서 판정 / 메모리 선택 프롬프트를 업데이트하지만, 이미 보류 중인 도구를 자동 승인하지는 않습니다. 모델 턴 수, 도구 턴 수, 주입 할당량, 벽시계 시간과 금액 예산은 계속 누적됩니다. `consumed` 뒤에도 한도 때문에 종료되어 다음 요청이 없을 수 있으므로, 영수증과 원래 종료 상태를 함께 보고 결과를 표시해야 합니다.
