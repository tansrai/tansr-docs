---
title: '세션 서비스 5분 안에 실행하기'
description: '@tansr/serve로 자신의 Node 서비스 안에 다중 사용자 에이전트 세션 서비스를 띄웁니다. 인증 훅을 연결하고, 앱 키를 설정하고, 첫 /v2 세션을 만들고, curl로 SSE 이벤트 스트림을 확인합니다.'
zone: docs
category: getting-started
related:
  - sdk/system-prompts
  - serve/deploy-and-auth
  - serve/v2-and-webhooks
  - serve/retention-and-governance
  - serve/env
  - getting-started/android
sources:
  - tansr-cli:packages/server/README.md
  - tansr-cli:examples/serve-demo/README.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-09-10'
---

`@tansr/serve`는 tansr의 **Agent 세션 엔진**입니다. npm 패키지 하나로 당신의 Node 서비스에 내장되어, 밖으로는 `/v2` 다중 세션 REST + SSE 프로토콜 면을 노출하고, 안으로는 당신의 앱 키로 tansr 플랫폼에 연결해 실제로 모델을 호출합니다. 이것은 **게이트웨이가 아닙니다.** 사용자가 어떻게 로그인하고, 어떻게 속도를 제한하고, 어떻게 과금하는지는 모두 당신의 체계에 속합니다. 엔진은 전송, 프로토콜, 세션 거버넌스만 담당합니다.

Android / iOS SDK가 연결하는 것이 바로 이 서비스입니다.

## 플랫폼 또는 호스트에서 앱 역할 설정

모바일의 시스템 프롬프트는 플랫폼 앱 설정 또는 serve 호스트에서 설정하며, `/v2`의 `prompt`에 넣지 않습니다. `platform.system`을 생략하면 플랫폼 기본값을 사용합니다. 코드로 관리하는 업무 세그먼트는 `platform.system`에, 호스트 보충 설명은 `platform.systemAppend`에 둡니다. 기본값 `fallback`은 명시적인 업무 세그먼트(`[]` 포함)가 플랫폼 세그먼트를 대체하도록 허용합니다. `prepend`는 SDK 세그먼트가 `[]`여도 플랫폼 세그먼트를 앞에 유지합니다.

이 새 옵션들은 API와 serve의 호환 릴리스를 기다리고 있습니다. 이들은 텍스트 조합만 제어하며 권한을 대체하지 않습니다. 플랫폼 프롬프트와 정책은 다음 새 턴 전에 새로 고쳐지고, 현재 실행 중인 턴은 기존 설정을 유지합니다. 기존 세션, attach, 기록은 계속 사용할 수 있으며, 역할을 바꾸기 위해 세션을 다시 열 필요가 없습니다. [애플리케이션 시스템 프롬프트와 SDK 결합 정책](/ko/sdk/system-prompts/)의 serve 전체 예시를 참고하세요.

## 전제 조건

- Node.js ≥ 22.19.
- 콘솔에서 **모바일 앱**(Android / iOS용) 또는 서버 앱을 만들어 `appid`와 `appkey`를 얻습니다.
- 당신의 로그인 상태 체계: 엔진은 요청 하나를 `endUserId` 하나로 매핑해 주기만을 요구하며, 나머지는 관여하지 않습니다.

## 설치

```bash
npm install @tansr/serve
```

유일한 서드파티 런타임 의존성은 `zod`입니다. tansr 내부 패키지는 컴파일 시 인라인되어 당신의 의존성 트리에 나타나지 않습니다.

## 자격 증명: appid / appkey는 서버 쪽에

세션 서비스의 인증은 세 층으로 나뉩니다. 소속을 기억하면 잘못 두지 않습니다.

| 층 | 자격 증명 | 소속 |
|---|---|---|
| 클라이언트 ↔ 세션 서비스 | 당신이 정한 로그인 상태 token(JWT, session cookie, OAuth 모두 가능) | 완전히 당신의 것. 엔진은 `authenticate` 훅을 통해 `endUserId`만 받음 |
| 세션 서비스 ↔ tansr 플랫폼 | `appid` + `appkey` | 서비스 프로세스가 보유. 엔진은 이것으로 각 최종 사용자를 위한 `app_user` 토큰을 발급 |
| 클라이언트가 보유한 `appid` | 공개 앱 식별자 | 내려줄 수 있음. 자격 증명이 아님 |

레드라인 세 가지: appkey는 절대 단말에 내려주지 않습니다. `app_user` 토큰은 절대 세션 서비스 밖으로 나가지 않습니다. 세션 id는 인증 요소가 아닙니다(각 엔드포인트가 독립적으로 소속을 검증합니다).

appid / appkey는 환경 변수에 넣습니다(이름은 자유. 예시는 공식 예제의 `TANSR_APP_KEY_ID` / `TANSR_APP_KEY`를 따름). 코드나 저장소에 쓰지 마세요.

## 첫 서비스

실행되는 최소 뼈대. 인증 훅, 내장 실제 어셈블리, 세션 디스크 저장, 시작:

```ts
import {
  createAgentSessionFactory,
  createServeAgentSessionStore,
  registerBuiltinLocales,
  startServer,
} from '@tansr/serve';

registerBuiltinLocales(); // 可选:错误体文案本地化

// 真装配:appid/appkey → 每个终端用户一枚短期令牌 → 内核查询环真调模型
const build = createAgentSessionFactory({
  platform: {
    apiBaseUrl: 'https://api.tansr.com',
    appId: process.env.TANSR_APP_KEY_ID!,
    appKey: process.env.TANSR_APP_KEY!, // 恒不下发端、恒不入日志
  },
  store: createServeAgentSessionStore({ dir: '/var/lib/my-agent/sessions' }), // 生产恒接
  cwd: process.cwd(),
});

const server = await startServer({
  host: '127.0.0.1',
  port: 8787,
  token: process.env.MY_V1_TOKEN!, // /v1 面的 Bearer;与 /v2 鉴权互不相通
  createSession: build.factory,
  version: '1.0.0',
  v2: {
    // 唯一鉴权面:你的登录态 → endUserId;返回 null 即 401
    authenticate: async (req) => {
      const user = await myAuth.verify(req.headers['authorization']);
      return user ? { endUserId: user.id } : null;
    },
    createSession: build.factory,
    store: build.storeReader, // 让休眠会话可列表 / 可 resume
  },
});
```

`store`는 반드시 연결하세요. 연결하지 않으면 프로세스가 재시작되는 순간 모든 활성 세션의 컨텍스트가 완전히 사라지고, 클라이언트의 `resume`은 항상 `409 resume_unavailable`이 됩니다.

프로세스 시그널은 호스트의 책임입니다. 엔진은 당신을 대신해 SIGTERM을 감시하지 않습니다. 최소한 `server.drain({ timeoutMs: 30_000 })`을 연결한 뒤 종료하세요. 자세한 내용은 [배포와 인증](/ko/serve/deploy-and-auth/)을 참고하세요.

실제 플랫폼에 연결하지 않고 먼저 오프라인으로 프로토콜을 보고 싶나요? 저장소 안의 예제 `examples/serve-demo`는 에코 Agent로 `/v2` 프로토콜 층 전체를 뚫어 놓았습니다. 서비스 시작은 명령 하나입니다: `pnpm --filter tansr-example-serve-demo start`. 기본으로 `127.0.0.1:8788`에서 수신합니다.

## 첫 세션

curl로 직접 한 바퀴 돌아 봅니다. `<당신의 로그인 token>`은 당신의 체계가 발급하고 `authenticate`가 검증할 수 있는 토큰입니다.

세션 만들기(첫 prompt 포함):

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"你好,介绍一下你能做什么"}'
```

```json
{ "sessionId": "…", "resumed": false, "lastSeq": 0 }
```

후속 입력:

```bash
curl -s -X POST http://127.0.0.1:8787/v2/sessions/<sessionId>/messages \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"再简短一点"}'
```

`202 { "sessionId", "accepted": true }`가 반환됩니다.

## 이벤트 보기

SSE 이벤트 스트림을 구독합니다.

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>"
```

첫 프레임은 `retry: 3000`이고, 그 뒤로는 커널 이벤트 하나에 프레임 하나입니다: `id: <seq>`와 `data: <KernelEvent JSON>`이며 `event:` 이름은 붙지 않습니다. 제어 프레임(도구 요청, 권한 요청, 질문)에만 `event: server.*` 이름이 붙습니다. 15초마다 `: hb` 주석 하트비트가 한 건 옵니다.

연결이 끊긴 뒤 마지막으로 소비한 seq를 붙여 다시 연결하면, 서버는 링 버퍼에서 끊긴 지점 이후의 이벤트를 재전송합니다.

```bash
curl -N http://127.0.0.1:8787/v2/sessions/<sessionId>/events \
  -H "Authorization: Bearer <你的登录 token>" \
  -H "Last-Event-ID: 42"
```

## CLI 형태의 serve

`tansr serve --token <값>`으로도 상주 서비스를 띄울 수 있지만, 이것은 단일 운영자용 `/v1` 면(`POST /v1/sessions`, `GET /v1/sessions/:id/events` 등 여섯 엔드포인트, 같은 Bearer token 하나)으로, 오케스트레이션 시스템 연동에 적합하며 다중 테넌트 제품 백엔드가 아닙니다. `tansr serve --v2`는 `/v2` 면도 CLI 형태에 올리는 것으로, **tansr CLI 0.5.0에서 제공 예정**입니다. 그 전까지 다중 테넌트 `/v2`는 위의 npm 내장 형태를 사용하세요.

## 다음 단계

- [배포와 인증](/ko/serve/deploy-and-auth/): 인증 훅, 정상 종료, 관측 엔드포인트, 다중 레플리카 샤딩.
- [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/): 엔드포인트 전체 형태, 3단계 복구 체인, 턴 종료 아웃바운드 알림과 서명.
- [보존 기간과 거버넌스](/ko/serve/retention-and-governance/): 보존 창, 유휴 회수, 동시 실행 상한, 세션 저장소.
- [환경 변수 표](/serve/env): 모든 `TANSR_SERVE_*` 손잡이.
