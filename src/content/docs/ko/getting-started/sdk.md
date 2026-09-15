---
title: 'Node SDK 5분 안에 실행하기'
description: '자신의 Node.js 또는 Electron 프로그램에 tansr 에이전트를 내장합니다. @tansr/sdk를 설치하고, 토큰을 얻고, 첫 세션을 만들어 이벤트 스트림을 출력합니다.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - sdk/midturn-input
  - sdk/sessions-and-events
  - sdk/platform-bundle
  - sdk/errors-and-retries
  - security
sources:
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/CHANGELOG.md
lastVerified: '2026-09-15'
---

`@tansr/sdk`는 tansr 커널의 headless 언어 바인딩입니다. prompt가 들어가면 이벤트가 흘러나오며, UI 의존성은 없습니다. 쿼리 루프, 도구 스케줄링, 권한 엔진, 컨텍스트 압축은 모두 커널에서 오며 컴파일 시 인라인되어 있습니다. 당신이 얻는 것은 `tansr` CLI와 같은 런타임을 라이브러리 형태로 당신의 앱에 내장한 것입니다.

## 애플리케이션 프롬프트는 어디에서 설정하나요

플랫폼 앱의 `systemPrompt`는 공유 역할에, SDK의 `system`은 코드로 관리하는 업무 세그먼트에 사용합니다. 기본값 `fallback`에서는 명시적인 `system`(`[]` 포함)이 플랫폼 세그먼트를 대체합니다. 플랫폼에서 `prepend`를 선택하면 플랫폼 세그먼트를 먼저 유지한 뒤 SDK 세그먼트를 추가하며, `[]`여도 플랫폼 세그먼트는 유지됩니다. 호스트 환경 설명은 `systemAppend`에 두면 기본 덮어쓰기가 발생하지 않습니다.

Windows Electron에서도 SDK는 메인 프로세스에서 실행되며, renderer가 보내는 것은 사용자 입력입니다. 애플리케이션 프롬프트와 정책 기능은 `@tansr/sdk` 0.13.0부터 제공됩니다(플랫폼 측은 2026-09-14에 프로덕션 공개). 읽기 전용 `session.applicationPrompt`로 출처와 정책을 확인할 수 있으며, 본문은 반환하지 않습니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 새로 고쳐지고, 현재 실행 중인 턴은 고정됩니다. 기존 세션과 기록은 유지되므로 다시 열 필요가 없습니다. 전체 진리표, 플랫폼 PUT / GET, 실행 가능한 예시는 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참고하세요.

## 전제 조건

작업 실행 중에 요구 사항을 보충해야 할 때는 [같은 턴에 입력 추가](/ko/sdk/midturn-input/)의 `getInputTarget` / `submitInput`과 영수증 조회를 사용하세요. 현재 실행을 중단하거나 새 세션을 만들 필요가 없습니다. 첫 단계에서는 memory 텍스트만 지원하며, `@tansr/sdk` 0.13.0 / `@tansr/serve` 0.8.0 / CLI 0.6.0부터 제공됩니다.

| 요구 사항 | 값 |
|---|---|
| Node.js | ≥ 22.19 |
| Electron(해당하는 경우) | ≥ 39, SDK는 메인 프로세스에서 실행 |
| 모듈 형식 | ESM only(`"type": "module"`. CJS `require()`는 지원하지 않음) |
| TypeScript | target ≥ ES2022. Electron 프로젝트는 `skipLibCheck: true` 권장 |

릴리스 산출물은 단일 파일 ESM bundle과 단일 파일 `.d.ts`입니다. 서드파티 런타임 의존성은 `undici`, `zod`, `zod-to-json-schema`뿐입니다. 선택적 의존성 `@vscode/ripgrep`은 설치에 실패하면 자동으로 폴백하므로 처리할 필요가 없습니다.

## 설치

```bash
npm install @tansr/sdk
```

## 자격 증명: 모델 출처 세 등급 중 하나를 선택

SDK가 모델을 어디에서 가져오는지가 어떤 자격 증명이 필요한지를 결정합니다.

| 등급 | 전달하는 것 | 용도 |
|---|---|---|
| **토큰 방식** | `{ token, baseUrl }` | 단말 배포(Electron / 데스크톱). 모델 카탈로그와 기능 플래그는 플랫폼이 앱 설정에 따라 배포하며, 로컬 설정은 없음 |
| **관리형 방식(BYOK)** | `model: '별칭'` + 로컬 `.tansr/settings.json` | 자신의 서버 / 스크립트. 모델 API key를 직접 준비 |
| **주입 방식** | `{ client, model }` 쌍 | 테스트(스크립트화된 모델) 또는 사용자 정의 연결 |

세 방식은 상호 배타적이며, 섞어 쓰면 어셈블리 단계에서 `invalid_options`로 거부됩니다. 이 문서는 **토큰 방식**을 예로 듭니다. 에이전트를 최종 사용자에게 전달할 때의 올바른 형태이기 때문입니다.

토큰 방식의 자격 증명 흐름은 "3자 폐쇄 루프"입니다.

1. 콘솔에서 **데스크톱 앱**(또는 서버 앱)을 만들어 `appid`와 `appkey`를 얻습니다. appkey는 당신의 서버 쪽에만 둡니다.
2. 단말 앱은 자체 로그인 상태로 당신의 서버에 요청합니다. 당신의 서버는 appkey로 `POST /v1/app-tokens`를 호출해 그 사용자를 위한 단기 `app_user` 토큰(`ttlSeconds` 60–86400)을 발급하고, `{ token, expiresAt }`만 단말에 내려줍니다.
3. 단말 앱은 이 토큰을 SDK에 넘깁니다.

공식 예제 `examples/token-server`가 발급 엔드포인트의 완전한 작성법(요청 서명 포함)을 보여 줍니다. **appkey는 절대 당신의 서버 밖으로 나가지 않습니다.** 단말에 내려주지 않고, 로그에 남기지 않고, 오류 응답에 넣지 않고, 저장소에 넣지 않습니다.

자기 컴퓨터에서 스크립트만 돌려 볼 거라면 먼저 관리형 방식을 써도 됩니다. `.tansr/settings.json`에 provider를 선언하고(API key는 환경 변수 이름만 쓰고, 값은 환경 변수로 전달), `createSession({ model: 'main' })`을 호출합니다.

## 첫 세션

```ts
import { createSession } from '@tansr/sdk';

// token 由你的服务端换发;baseUrl 是平台网关地址
const session = await createSession({ token, baseUrl: 'https://api.tansr.com' });

session.send('帮我总结这份合同');

for await (const event of session.events) {
  if (event.type === 'msg.text.delta') process.stdout.write(event.text);
  if (event.type === 'turn.completed') break;
}

session.close();
```

요점:

- `createSession`은 async입니다. 항상 `await`하세요.
- `send()`는 유휴 상태에서 새 턴을 시작합니다. 실행 중에 다시 `send()`하면 커널의 주입 배리어를 거쳐 현재 턴에 합류하며, 입력은 잃지 않습니다.
- `events`는 턴을 넘어 연속되고 `seq`가 단조 증가하는 `AsyncIterable<KernelEvent>`입니다. 여러 소비자가 동시에 `for await`할 수 있으며, 각자 전체를 받습니다.
- `close()`는 멱등입니다. `close()`를 호출하지 않으면 `for await`는 자연히 끝나지 않습니다. 이것이 "이벤트 스트림이 멈춤"의 가장 흔한 원인입니다.

## 이벤트 보기

이벤트는 평탄한 discriminated union이므로 `event.type`으로 바로 분기합니다. 처음 실행할 때는 타입을 모두 출력해서 한 턴에 무슨 일이 일어나는지 느껴 보길 권합니다.

```ts
for await (const event of session.events) {
  console.log(event.seq, event.type);
}
```

대략 이런 순서가 보일 것입니다: `session.created` → `turn.started` → 여러 개의 `msg.block.start` / `msg.text.delta` / `msg.block.end` → (도구 호출이 있으면) `tool.proposed` / `tool.permission.decided` / `tool.started` / `tool.completed` → `cost.usage.updated` → `turn.completed`.

UI를 만들 거라면 이벤트를 손으로 조립하지 마세요. `createSessionView`로 이벤트 스트림을 불변 뷰 스냅숏으로 리덕션하고, `createNarrator`로 사람이 읽을 수 있는 로그 줄을 생성하세요. 둘 다 패키지에 포함되어 있습니다.

## 처음 흔히 걸리는 문제

| 현상 | 원인과 처리 |
|---|---|
| `invalid_options`가 발생 | 세 방식의 필드를 섞어 썼거나, 토큰 방식에서 `config` / `capabilities`를 전달했습니다(토큰 방식의 기능 플래그는 항상 플랫폼이 관리). 메시지를 읽고 코드를 수정 |
| `assembly_failed`가 발생 | 관리형 방식의 설정을 사용할 수 없거나, 별칭 해석에 실패했거나, 토큰 방식에서 bundle 가져오기에 실패했습니다. `cause`에 하위 오류가 남아 있음 |
| 도구가 모두 거부됨 | `permission.askUser`를 연결하지 않았고 도구가 읽기 전용이 아닙니다. 기본값은 fail-closed. [세션과 이벤트 스트림](/ko/sdk/sessions-and-events/) 참고 |
| 이벤트 스트림이 끝나지 않음 | `session.close()`를 잊었습니다 |

## 다음 단계

- [세션과 이벤트 스트림](/ko/sdk/sessions-and-events/): 다중 턴 의미론, 이벤트 패밀리, SessionView 투영.
- [체크포인트와 재개](/ko/sdk/checkpoints/): 영구 저장, 재시작을 넘어선 재개, 수동 압축과 스냅숏.
- [플랫폼 어셈블리와 번들](/ko/sdk/platform-bundle/): 기능 플래그, 도구 3링, 토큰 방식으로 배포되는 것.
- [오류 처리와 재시도](/ko/sdk/errors-and-retries/): SDK 오류 코드, 플랫폼 오류 코드, 무엇을 재시도해야 하고 무엇을 하지 말아야 하는지.
