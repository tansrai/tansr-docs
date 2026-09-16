---
title: HarmonyOS SDK 5분 안에 실행하기
description: '네이티브 HarmonyOS 앱에 @tansr/harmony를 연결합니다. 로컬 HAR 의존성을 넣고, 자신의 로그인 자격 증명을 제공하고, 첫 세션을 만든 뒤 이벤트 스트림을 SessionView로 리덕션합니다.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - harmony
  - android
  - ios
  - getting-started/serve
  - serve/v2-and-webhooks
sources:
  - tansr-harmony:README.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-16'
---

`@tansr/harmony`는 세션 서비스 `/v2`의 **네이티브 ArkTS 얇은 프로토콜 클라이언트**(HAR)입니다. 입력을 보내고, 이벤트 스트림을 리덕션하고, 당신이 명시적으로 등록한 로컬 도구를 실행하며, 권한과 질문에 응답합니다. 에이전트 커널, 권한 엔진, 컨텍스트 거버넌스는 모두 당신이 배포한 `@tansr/serve`에서 실행되고, 휴대폰에는 플랫폼 자격 증명이 전혀 없습니다. 뷰 리덕션은 Android / iOS와 같은 골든 샘플을 공유합니다. HAR는 **ArkUI 페이지를 포함하지 않습니다**. 녹음, 재생, 리스트 가상화는 호스트가 담당합니다.

Android 호환 스택만 있는 이전 HarmonyOS 기기는 계속 [Android SDK](/ko/getting-started/android/)를 사용합니다. 현재 최솟값은 HarmonyOS 6.0 / API 20(Stage 모델)입니다. HarmonyOS 5.x 네이티브 호환은 후속 작업이며, 이 문서는 사용 가능하다고 주장하지 않습니다. 패키지는 OHPM에 게시되지 않았고, 로컬 HAR로 연결합니다.

## 휴대폰은 사용자 메시지를 보내고, 서버가 시스템 프롬프트를 설정한다

`createSession`과 `session.send(...)`는 모두 일반 사용자 메시지를 보냅니다. HarmonyOS SDK는 `/v2`를 통해 `system`을 전달하지 않습니다. 공유 역할은 플랫폼 앱 설정이 관리하고, 코드로 맞춤 설정하는 역할은 serve의 `platform.system`이 제공하며, 호스트 설명은 `platform.systemAppend`를 사용합니다.

프롬프트와 정책 기능은 `@tansr/serve` 0.8.0부터 제공되며, 플랫폼 측은 2026-09-14에 이미 온라인입니다. 기본 `fallback`에서는 SDK가 명시한 `system`(빈 배열 포함)이 플랫폼 세그먼트를 대체하고, `prepend`에서는 플랫폼 세그먼트를 앞에 유지합니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 새로 고치고, 현재 실행 중인 턴은 고정됩니다. 포그라운드 재연결, SSE 복구, attach는 원래 세션과 이력을 유지할 수 있어, 업데이트를 받으려고 세션을 다시 열 필요는 없습니다. 업무 세그먼트 충돌은 앱 관리자가 해소해야 하며, 권한은 계속 독립 메커니즘입니다. 자세한 내용은 [애플리케이션 시스템 프롬프트](/ko/sdk/system-prompts/)를 참고하세요.

## 전제 조건

- 도달 가능한 `@tansr/serve` 서비스([세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/) 참고). 로컬 개발에서는 저장소 안의 `examples/serve-demo`를 먼저 띄워도 됩니다(기본 `127.0.0.1:8788`).
- DevEco Studio 6.0 이상, HarmonyOS SDK API 20 이상. 호스트 HAP는 `ohos.permission.INTERNET`을 선언합니다. 녹음 등 권한은 그 능력을 실제로 쓰는 호스트가 선언하고 요청합니다.
- 당신 자신의 로그인 체계: SDK는 요청마다 `AuthProvider`에서 단기 인증 헤더(보통 `Authorization: Bearer <당신의 로그인 token>`)를 받고, 서버 쪽 `authenticate` 훅이 그것으로 `endUserId`를 풀어냅니다. 플랫폼 AppKey, 업스트림 모델 키, 서버 서명 개인 키를 클라이언트에 두지 마세요.

## 설치

SDK 저장소에서 DevEco 또는 `./scripts/native.ps1 -Action har`가 `tansr/build/default/outputs/default/tansr.har`를 만듭니다. 업무 모듈의 `libs/tansr.har`로 복사한 뒤:

```json
{ "dependencies": { "@tansr/harmony": "file:./libs/tansr.har" } }
```

`ohpm install`을 실행합니다. SDK에는 외부 런타임 의존성이 없고 Node.js, React Native, WebView, Android 호환 런타임도 포함하지 않습니다. 별도 프로젝트에서 HAR만 소비해도 배선을 확인할 수 있으며, Demo HAP를 앱에 넣을 필요는 없습니다.

## 자격 증명: 당신 자신의 로그인 상태만

SDK는 **자격 증명을 전혀 영구 저장하지 않습니다**. 요청마다 `AuthProvider.headers()`에서 헤더를 한 번 받아 쓰고 버립니다. 프로덕션에서는 `RefreshingAuthProvider`로 자신의 `CredentialIssuer`를 감싸 만료, 동시 갱신, 신원 변화를 다룹니다. 갱신 실패 뒤에 비밀번호 로그인을 숨겨 다시 실행하지 마세요. 발급 후 신원이 바뀌면 그 인스턴스를 종료합니다.

```typescript
import { NativeHttpTransport, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient(
  'https://agent.example.com',
  new NativeHttpTransport(),
  new StaticAuthProvider(headers),
);
```

`StaticAuthProvider`는 짧은 디버그 전용입니다. 기본은 HTTPS이며, 루프백 HTTP는 로컬 디버그만 허용합니다. 실기기가 개발 머신의 사설 주소에 닿을 때는 `NativeHttpOptions.allowPrivateNetworkHttp`로 인트라넷 HTTP를 명시적으로 켭니다. 일반 공망 평문 HTTP는 허용하지 않고, TLS 인증서 오류도 무시하지 않습니다.

## 첫 세션

생성이 성공하면 **확인된 sessionId를 원래 로그인 범위에 먼저 저장한 뒤** 화면을 묶습니다. 저장이 실패하거나 응답이 미확인이면 사용자에게 알리고, 자동으로 세션을 하나 더 만들지 마세요. `verifiedEndUserId`는 검증된 로그인 회신에서 와야 합니다.

```typescript
import { AgentSession, JsonNode, NativeHttpTransport, SessionHistory,
  SessionView, StaticAuthProvider, TansrAgentClient } from '@tansr/harmony';

const headers = new Map<string, string>();
headers.set('Authorization', 'Bearer ' + token);
const client = new TansrAgentClient('https://agent.example.com', new NativeHttpTransport(), new StaticAuthProvider(headers));

const created = await client.createSession();
// 已确认的会话 ID 先写入原登录作用域，再绑界面
const session = new AgentSession(client, created.sessionId, verifiedEndUserId);
const view = new SessionView('stream', 'off');
view.onChange = (): void => render(view.state);
session.onHistory = (history: SessionHistory): void => view.restoreHistory(history.messages);
session.onFrame = (eventName: string, data: JsonNode): void => {
  if (!eventName.startsWith('server.')) view.consume(data);
};
session.start();
await session.send('hi');
```

`session.stop()`은 로컬 구독과 브리지만 취소하며 원격 세션은 버리지 않습니다. `session.start()`가 구독을 재개합니다. `close()`가 원격 세션 종료를 요청합니다. 포그라운드/백그라운드, 로그아웃, 컴포넌트 해제는 이 진입점을 반드시 호출해야 합니다. 전송 회신은 수용만 뜻하고, 실제 출력은 이벤트 스트림으로 도착합니다.

콜드 스타트에서 이전 대화를 이어가려면 원래 sessionId의 소유를 확인한 뒤 SDK에 attach / history / resume을 맡깁니다. 복구 실패 시 원래 ID를 남기고 이유를 보고하며, forbidden, 손상, 일시 네트워크 오류를 모두 새로 만들기로 처리하지 마세요.

## 이벤트 보기

`SessionView.state`는 이미 리덕션된 뷰 스냅샷입니다(메시지 목록, 도구 카드, 할 일, 사용량, `lastError`). 대부분의 UI는 `onChange`만 구독하면 됩니다. `onFrame`은 원시 SSE 프레임을 전달하고, `server.*` 제어 프레임은 `session.bridges`가 소비합니다. 보통 `tool.permission.*` 이벤트로 두 번째 권한 확인을 띄우지 마세요.

연결 상태는 `session.onState`로 관찰합니다. `idle` → `connecting` / `recovering` → `live`, 순간 끊김은 `retrying`, 프로토콜이나 인증 실패는 `failed`, `close()` 뒤에는 `closed`입니다. 끊김은 업무 코드로 떠오르지 않습니다. L1은 커서를 들고 재연결하고, L2는 gap 뒤 `/history`로 재구축하며, L3는 메타데이터가 404이거나 `live = false`일 때 resume합니다. `lastSeq`는 값 그대로 이어가고, 휴면 판정은 항상 `live = false`입니다.

## 로컬 도구와 대화 상자

로컬 도구는 `session.bridges.registerTool(declaration, handler)`로 등록하고, `createSession` / resume 때 같은 `clientTools` 선언을 넘깁니다. `parameters`는 "이름 → 명세" 사전입니다. 파라미터가 없으면 `{}`이고, JSON Schema 전체를 넘기면 안 됩니다. `onPermission`을 두지 않으면 기본은 거부입니다. `server.permission.request`만 확인을 띄우고, 사용자가 확정한 뒤 `answerPermission(id, 'allow' | 'deny')`를 호출합니다. 질문은 독립된 `onQuestion` / `answerQuestion`이며, 보충 텍스트는 도구 승인이 아닙니다.

```typescript
const declaration = JsonNode.object()
  .set('name', JsonNode.string('searchOrders'))
  .set('description', JsonNode.string('Search the user orders'))
  .set('parameters', JsonNode.object().set('keyword', JsonNode.object()
    .set('type', JsonNode.string('string'))
    .set('description', JsonNode.string('search keyword'))))
  .set('readOnly', JsonNode.boolean(true));
session.bridges.registerTool(declaration, {
  async execute(args, cancel) {
    cancel.throwIfCancelled();
    return JsonNode.object().set('status', JsonNode.string('ok'))
      .set('content', JsonNode.array([
        JsonNode.object().set('t', JsonNode.string('text')).set('text', JsonNode.string(db.search(args.stringAt('keyword')))),
      ]));
  },
});
```

OS 마이크 권한과 에이전트 도구 허가는 두 층이며, 한쪽이 다른 쪽을 대체하지 않습니다. 서버 cwd를 임의의 로컬 경로로 매핑하지 않습니다.

## 흔한 첫 걸림돌

| 증상 | 조치 |
|---|---|
| 연결하자마자 401 | `AuthProvider`가 준 헤더를 서버 쪽 `authenticate`가 인정하지 않습니다. 로그인 상태를 고친 뒤 `start()`하세요 |
| 에뮬레이터 / 실기기가 연결되지 않음 | 루프백은 로컬 디버그만. 개발 머신 사설 주소에 닿으려면 `allowPrivateNetworkHttp`가 필요합니다. 프로덕션은 항상 TLS |
| 세션 생성이 400 | `clientTools.parameters`를 JSON Schema 전체로 썼습니다. 파라미터 이름 사전이어야 합니다 |
| 새 세션이 429 | 최종 사용자당 기본 최대 8개의 활성 세션입니다. 쓰지 않는 세션은 `close()`하세요 |

## 다음 단계

- [HarmonyOS 연동 가이드](/ko/harmony/): 세션 수명 주기, 3단계 복구, 도구 브리지, 음성 두 갈래, 낭독 이중 캡, 미디어 다운로드 경계.
- [Android와 iOS 5분 안에 실행하기](/ko/getting-started/android/): 세 클라이언트 계약을 대조합니다.
- [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/): 서버 쪽이 턴 종료 알림을 당신의 푸시 백엔드에 넘기는 방법.
