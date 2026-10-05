---
title: 이벤트 스트림과 통합 이벤트 봉투
description: '/api의 4개 SSE 라우트, tansr-event-envelope: unified-v1의 명시적 협상과 되돌림, 7키 이벤트 봉투의 각 필드, 서로 대체할 수 없는 다섯 커서가 어디에서 오는지, terminalStatus 판정표, 그리고 Last-Event-ID 재개와 하트비트, gap 프레임 처리.'
zone: docs
category: unified-api
sidebar:
  order: 5
related:
  - unified-api/headers-and-errors
  - unified-api/discovery-and-closure
  - unified-api/surface
  - unified-api/clients
  - serve/v2-and-webhooks
  - sdk/sessions-and-events
sources:
  - tansr-cli:packages/server/src/api/event-envelope.ts
  - tansr-cli:packages/api-client/src/api/envelope.ts
  - tansr-cli:doc/rfc/RFC-UAPI-1-统一信封与canonical单模块.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-05'
---

`/api` 아래에는 4개의 이벤트 스트림이 있고 각 프레임의 페이로드는 소속 도메인 하위 계약이 정의합니다. 통합 이벤트 봉투는 그 페이로드를 바꾸지 않습니다. 여러분이 **명시적으로 요구했을 때** 모든 프레임에 같은 형태의 바깥 껍질을 씌워, 서로 다른 도메인의 스트림을 같은 코드로 "이것은 어느 도메인인가, 커서는 어디까지 왔는가, 종료 상태가 있는가"라고 판단할 수 있게 합니다.

## 4개 이벤트 스트림

| 작업 | 경로 | 도메인 | 프레임에 담긴 것 |
|---|---|---|---|
| `session.events.observe` | `GET /api/sessions/:id/events` | `session` | 커널 이벤트(`msg.*`, `tool.*`, `turn.*`, `session.*`)와 `server.*` 제어 프레임 |
| `archive.events.observe` | `GET /api/archive/bindings/:id/events` | `archive` | `archive.status`, `archive.records-available`, `material.status`, `binding.status` |
| `terminal.executor.events.observe` | `GET /api/terminal/executors/:id/events` | `terminal` | `operations-available`, `operation-cancelled`, `reconcile-required` |
| `terminal.output.observe` | `GET /api/terminal/sessions/:id/tool-output` | `terminal` | `output.block`, `output.status` |

전송 계층은 이전 접두사와 같습니다. `text/event-stream`, 첫 `retry:` 프레임, 주석 프레임 `: hb` 하트비트, 끊긴 뒤에는 `Last-Event-ID`로 재개합니다. 세션 스트림의 프레임 형태와 재생 세부는 [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 보세요.

## 명시적 협상

- 요청 헤더 `tansr-event-envelope: unified-v1`. 대소문자를 구분하며 정확히 일치해야 합니다. 서버는 스트림 응답에서 **같은 이름의 헤더를 되돌려주며**, 이것이 협상 성립의 유일한 신호입니다. 되돌아오지 않으면 협상되지 않은 것으로 처리합니다(`@tansr/api-client/api`는 `envelope_not_negotiated`를 던짐). 추측하면 안 됩니다.
- 헤더 없이: `/api`의 스트림은 `/v2`, `/v3/sdk2`의 스트림과 **바이트 단위로 동일**합니다. 이전 파서를 그대로 두고 접두사를 먼저 바꾼 뒤 봉투는 나중에 바꿀 수 있습니다.
- 스트림이 아닌 라우트(예: `GET /api/sessions/:id`)에 헤더를 붙이면: 헤더는 무시되고 되돌려지지 않으며 본문도 바뀌지 않습니다. 같은 요청 헤더 구성으로 같은 세션의 JSON과 SSE 엔드포인트 모두에 접근할 수 있습니다.
- 값이 `unified-v1`이 아니면(빈 문자열과 중복 헤더 포함): 어떤 `/api` 라우트에 접근하든 400 `invalid_request`(`detail.header: tansr-event-envelope`)입니다.

## 7키 봉투

협상이 성립하면 각 프레임의 `data:`는 고정된 7개 키의 객체가 됩니다. `id:`, `event:`, `retry:` 줄과 주석 프레임은 제자리에 남습니다.

```json
{
  "contract": "unified-v1",
  "eventId": "42",
  "domain": "session",
  "type": "turn.completed",
  "cursorSet": {
    "eventCursor": "42",
    "archiveCoverage": null,
    "outputWatermark": null,
    "materialConsumed": null,
    "ackReceipt": null
  },
  "terminalStatus": "completed",
  "raw": { "type": "turn.completed", "seq": 42, "sessionId": "0a1b2c3d", "turnId": "t-3" }
}
```

| 키 | 의미 |
|---|---|
| `contract` | 항상 `unified-v1` |
| `eventId` | 이 프레임의 SSE `id:`. `id:`가 없는 프레임(gap 프레임 등)은 `null`이며 합성하지도, 이전 프레임에서 물려받지도 않음 |
| `domain` | 수리한 도메인. 응답 헤더 `tansr-domain`과 같은 출처 |
| `type` | 이벤트 종류. SSE `event:` 이름을 쓰고, 없으면 `raw.type` / `raw.eventType`, 그것도 없으면 `null`(알 수 없는 이벤트로 간주) |
| `cursorSet` | 다섯 커서 자리. 해당 없는 자리는 `null`. 다음 절 참고 |
| `terminalStatus` | `null` / `accepted` / `completed` / `aborted` / `unknown`. 아래 참고 |
| `raw` | 원래 `data:` 객체를 그대로 담은 것. 서버가 모르는 이벤트 종류를 포함해 **모든 프레임**에 있음. 내부 구조는 여전히 각 도메인 하위 계약이 정함 |

봉투는 `payload`나 `seq`를 출력하지 않습니다. 페이로드는 `raw`에 있고 스트림 위치는 `cursorSet.eventCursor`가 나타냅니다. `data:`가 JSON 객체인 프레임만 봉투에 싸이고, JSON이 아닌 텍스트, 배열, 스칼라, 빈 `data:` 프레임은 그대로 통과합니다.

## 다섯 커서

| 커서 | 출처 | 전진시키는 프레임 |
|---|---|---|
| `eventCursor` | 이 프레임의 SSE `id:`(세션 스트림은 `seq`, 아카이브 스트림은 `cursor`, 실행기 스트림은 `eventId`) | 각 프레임이 각자 제시. 물려받지 않음 |
| `archiveCoverage` | 아카이브 스트림 `archive.status`의 `payload.acknowledgedCoverage`(`{ fromSequence, throughSequence, headDigest }`) | 확인된 커버리지만 전진시킴. `archive.records-available`의 `publishedThroughSequence`는 게시 수위이며 여기에 들어가지 않음 |
| `outputWatermark` | 도구 출력 스트림 `output.block`의 `block.seq` | `afterSeq`로 출력을 다시 구독하는 데 사용 |
| `materialConsumed` | 아카이브 스트림 `material.status`에서 `state === 'core-consumed'`일 때의 `payload.materialRequestId` | 다른 자료 상태는 전진시키지 않음 |
| `ackReceipt` | 이벤트 스트림에서는 **항상 `null`** | ACK 영수증은 HTTP 응답 또는 `archive.operation.query`로 돌아오며 이벤트 스트림으로 흐르지 않음 |

다섯 커서는 서로 대체할 수 없습니다. 세션 스트림 재개에는 `eventCursor`만(`Last-Event-ID`에 넣어서), 출력 스트림 재개에는 `outputWatermark`만 쓰고, 아카이브가 어디까지 확인되었는지는 `archiveCoverage`로만 판단합니다. 하나로 다른 것을 재개하는 것은 "대략 맞는" 것이 아니라 계약 위반입니다.

## `terminalStatus` 판정

`terminalStatus`는 원래 이벤트가 종료 상태를 **명확히 표현할** 때만 `null`이 아닙니다. SSE 연결 종료, 서버 EOF, HTTP 202는 종료 상태를 만들지 않습니다.

| 스트림 | 이벤트 | `terminalStatus` |
|---|---|---|
| 세션 | `turn.completed`, `session.ended` | `completed` |
| 세션 | `turn.aborted`. `turn.error`이면서 `recoverable === false` | `aborted` |
| 세션 | `server.*` 제어 프레임, `msg.*`, `tool.*`, 알 수 없는 종류 | `null` |
| 아카이브 | `material.status`: `received`는 `accepted`(수리만 뜻함), `core-consumed`는 `completed`, `rejected`는 `aborted`, `pending` / `verified`는 `null` | 왼쪽과 같음 |
| 아카이브 | `binding.status`: `closed`는 `completed`, `active` / `backpressured` / `closing`은 `null` | 왼쪽과 같음 |
| 아카이브 | `archive.status`, `archive.records-available` | `null` |
| 실행기 | `operation-cancelled`는 `aborted`, `operations-available`, `reconcile-required`는 `null`(대사 요구는 종료 상태가 아님) | 왼쪽과 같음 |
| 도구 출력 | `output.status`: `complete`는 `completed`, `available` / `receiving` / `truncated` / `gap` / `unavailable`은 `null`, `output.block`은 `null` | 왼쪽과 같음 |

`unknown`은 결과를 판정할 수 없는 종료 상태를 위해 남겨 둔 것입니다. 받으면 "결과 불명"으로 처리하고 재전송 대신 상태를 조회하세요.

## 재개, 하트비트, gap

- 재개: 재연결 시 마지막으로 소비한 프레임의 `cursorSet.eventCursor`를 `Last-Event-ID`에 넣습니다. 재개된 프레임도 똑같이 봉투에 싸입니다.
- 하트비트: `: hb` 주석 프레임은 그대로 통과하며 봉투에 들어가지 않습니다. 이벤트로 취급하지 말고, 업무 프레임이 오래 오지 않는 것을 종료로 간주하지도 마세요.
- gap: 세션 스트림의 `server.replay.gap`에는 `id:`가 없어 봉투 뒤에는 `eventId`와 `eventCursor`가 모두 `null`, `type`은 `server.replay.gap`, `raw`에 `requestedAfterSeq`, `oldestRetainedSeq`, `droppedEvents`가 있습니다. 받으면 L2로 뷰를 재구축합니다. [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)을 보세요.
- 프레임 크기: `@tansr/api-client/api`는 기본적으로 프레임 하나를 2 MiB로 제한하며(`maxEventFrameBytes`), 넘으면 조용히 자르는 대신 로컬 오류 `payload_too_large`를 던집니다.

## `@tansr/api-client/api`로 소비하기

```ts
import { createApiClient, isTerminalEvent } from '@tansr/api-client/api';

const api = createApiClient({ baseUrl, token: () => loadEndUserToken(), eventEnvelope: 'unified-v1' });

let lastEventId: string | null = null; // resume cursor = eventCursor of the last consumed frame
const stream = api.events('session.events.observe', {
  params: { id: sessionId },
  ...(lastEventId === null ? {} : { lastEventId }),
});
for await (const frame of stream) {
  const { envelope } = frame;
  if (typeof envelope.cursorSet.eventCursor === 'string') lastEventId = envelope.cursorSet.eventCursor;
  if (envelope.type === 'msg.text.delta') render(String(envelope.raw['text'] ?? ''));
  if (isTerminalEvent(envelope)) break;
}
```

`events()`는 서버가 협상 헤더를 되돌려줬을 때만 `{ id, event, envelope }`를 산출합니다. 종료 프레임 없이 스트림이 자연스럽게 끝나면 루프는 빠져나오지만 `isTerminalEvent`는 한 번도 참이 되지 않습니다. 이것이 바로 "EOF는 완료가 아니다"의 코드 표현이며, 여러분의 호스트는 이를 근거로 성공이 아니라 결과 불명을 보고해야 합니다.
