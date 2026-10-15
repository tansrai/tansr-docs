---
title: '보안과 개인정보'
description: '사용자로서 할 수 있는 것. tansr 각 형태가 어디로 아웃바운드 통신하는지, 자격 증명을 어디에 둬야 하는지, 데이터가 어디에 얼마나 보존되는지, 그리고 PAT / 앱 키 / 최종 사용자 토큰 / 세션 서비스 token을 각각 어떻게 교체하고 폐기하는지.'
zone: docs
category: security
related:
  - getting-started
  - cli/settings-and-doctor
  - serve/deploy-and-auth
  - serve/retention-and-governance
  - serve/v2-and-webhooks
  - sdk/platform-bundle
  - sdk/sdk2-preview
  - support/account
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:packages/server/CHANGELOG.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-cli:doc/96-Android开发指导书.md
  - tansr-cli:CHANGELOG.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-10-13'
---

이 페이지는 **당신이 할 수 있는 것**만 씁니다: 트래픽이 어디로 가는지 알기, 자격 증명을 올바른 곳에 두기, 데이터가 어디에 남는지 알기, 교체할 수 있게 되기. tansr 내부의 방어선(권한 엔진, 보호 경로, 하드 보안 레드라인, 감사 체인)은 각 형태의 가이드에서 이미 다루었으며, 여기서는 당신의 조작과 관련될 때만 참조합니다. 버전 기준: `tansr` CLI 0.10.3, `@tansr/sdk` 0.19.0, `@tansr/serve` 0.15.1(모두 2026-10-10 공개).

## 아웃바운드 통신: 트래픽이 어디로 가고, 어떻게 좁히는가

### CLI는 무엇에 연결하는가

| 목적지 | 언제 | 끌 수 있는가 |
|---|---|---|
| tansr 플랫폼 게이트웨이 `api.tansr.com` | 플랫폼 모드 로그인 후: 모델 호출, 설정 번들 가져오기, 하트비트, 사용량 보고, 잔액 | `TANSR_ESCAPE_LOCAL=1`을 설정해 완전 로컬 모드로 들어가면 전체 비활성화 |
| 업데이트 확인: npm 설치 형태는 npm 레지스트리 `registry.npmjs.org`를, 단일 파일 실행 파일(SEA)은 공식 배포 지점 `bash.tansr.com`의 서명된 포인터를 조회 | 당신이 명시적으로 `/update` 또는 `tansr update`를 실행할 때만. 시작 시 자동 확인은 절대 하지 않음 | `TANSR_UPDATE_CHANNEL=none` 또는 `TANSR_NO_UPDATE_CHECK=1`. 기업은 자체 호스팅 매니페스트 `TANSR_UPDATE_MANIFEST_URL`을 지정할 수 있음(지정되어 있으면 두 형태 모두 거기에만 연결) |
| 당신이 설정한 모델 공급자 | 완전 로컬 모드에서 `providers.*.baseUrl` | 당신이 결정 |
| 당신이 설정한 MCP 서버 / 자체 검색과 미디어 엔드포인트 | 세션 안의 도구 호출 | 당신이 결정. 프로젝트 층 MCP 서버는 명시적으로 신뢰를 부여해야 함 |
| 모델이 도구를 통해 접근하는 임의의 URL(WebFetch / Http) | 세션 안 | 권한 규칙의 제약을 받음. `deny` 규칙으로 도구 전체를 비활성화할 수 있음 |

무인 배포(`tansr serve` / headless에서 `auto`로 권한 개방)의 권장 기준선은 **네트워크 출구 허용 목록**입니다: 모델 API 등 필요한 목적지만 허용하고, DNS와 이미 수립된 연결 이외에는 기본적으로 거부합니다. 컨테이너나 최소 권한 전용 사용자와 결합하고, 파일 시스템 쓰기 면은 작업 디렉터리로 제한합니다. 참고 템플릿은 저장소 안 `deploy/serve/`에 있습니다.

이미 존재하는 사용자에게 보이는 방어선 두 가지: 같은 명령 안에서 비밀 파일(`.env`, 키, `.aws/credentials`)을 참조하면서 외부 전송 동작(`curl` / `scp` / `git push` …)을 동반하면 항상 거부되며, 어떤 모드와 규칙으로도 뒤집을 수 없습니다. 세션이 한 번 비밀 파일을 읽으면 그 이후의 외부 전송 동작은 모두 질문으로 바뀝니다(세션 오염). **tansr CLI 0.6.0부터**: 모든 아웃바운드 통신(WebFetch / Http / hooks / 오디오 다운로드)이 통일된 출구를 거치도록 바뀌고, DNS 해석 후 사설망, 루프백, 링크 로컬 주소를 판정하며, 내부망이나 메타데이터 주소를 가리키는 가져오기는 이유와 함께 거부됩니다. Http 도구와 hooks가 참조할 수 있는 자격 증명 환경 변수는 허용 목록 `http.allowedAuthEnvVars`로 수렴하며, 목록 밖이면 요청을 보내지 않습니다.

### SDK와 세션 서비스는 무엇에 연결하는가

- `@tansr/sdk` 토큰 방식은 당신이 전달한 `baseUrl`(플랫폼 게이트웨이)과 명시적으로 설정한 MCP 서버에만 연결합니다. SDK는 사용자 디렉터리를 스캔하지 않고, 자체 검색 엔드포인트도 없습니다.
- `@tansr/serve`의 업스트림 체인은 `appid/appkey → POST /v1/app-tokens → GET /t1/config + POST /t1/heartbeat → POST /t1/exchange`이며, 모두 `apiBaseUrl`을 가리킵니다. 그 밖에 당신이 설정한 턴 종료 webhook URL(아웃바운드 요청에는 어떤 인증 자격 증명 헤더도 붙지 않으며, 진위는 서명으로 확인)과 선택적 콜드 계층 객체 저장소가 있습니다.
- 모바일 앱이 콘솔에서 웹 페이지 가져오기(WebFetch)나 HTTP 요청(Http)을 켜면(`@tansr/serve` 0.12.0부터, 기본은 꺼짐), 이 두 도구는 세션 서비스가 있는 호스트에서 대상 URL에 직접 접근하며 같은 외부 연결 규칙을 따릅니다. 호스팅된 Http는 호스트 환경 변수의 자격 증명을 참조할 수 없고, 모델도 호스트의 사설망 접근 상한을 풀 수 없습니다. 외부 프록시를 설정했다면 프록시 쪽에서도 똑같이 사설망 대상을 제한하세요. 자세한 내용은 [모바일 앱의 공용 네트워크 도구](/ko/sdk/platform-bundle/#移动应用的公网工具)를 참고하세요.
- 모바일 SDK와 `@tansr/api-client`는 당신의 세션 서비스 `baseUrl`에만 연결하며, 플랫폼에 직접 연결하지 않고, 이 도구들의 요청을 기기에서 대신 보내지도 않습니다.

## 통합 호출 표면 `/api`: 헤더, 울타리, 구 접두사

`@tansr/serve` 0.13.0부터 `options.v2`가 있는 배포는 같은 포트의 체인 맨 앞에 통합 호출 표면 `/api`를 조립합니다(0.14.0은 manifest revision 7). 보안과 관련된 것은 다음 몇 가지뿐입니다:

- **신원은 `Authorization`에서만 옵니다.** `/api`와 `/v2`는 같은 `authenticate` 훅으로 `endUserId`를 판정합니다. 응답 헤더 넷 `tansr-contract` / `tansr-manifest-revision` / `tansr-domain` / `tansr-schema-hash`와 오류 봉투의 `traceId` / `requestId`에는 endUserId, 토큰, 메시지 내용이 절대 들어가지 않습니다. 요청 본문의 어떤 신원 필드도 신원으로 취급되지 않습니다. `tansr serve --v2` CLI 형태는 같은 Bearer + `x-tansr-end-user` 헤더로 분할 도메인을 스스로 신고하는데, 이 헤더는 당신의 게이트웨이가 자체 로그인 상태 뒤에서만 써야 하며 단말이 직접 채우게 해서는 안 됩니다.
- **요청 헤더는 모두 명시적 협상이지 인증 요소가 아닙니다.** `tansr-session-family`, `tansr-closure-id`, `tansr-event-envelope`, `Idempotency-Key` / `If-Match` / `deadline`(뒤의 셋은 0.14.0부터)이 해당하지 않는 요청에 나타나면 일률적으로 `400 invalid_request`이며 조용히 무시되지 않습니다. 어떤 헤더도 붙이지 않으면 동작은 바이트 단위로 변하지 않습니다.
- **기능 폐포 울타리**: `GET /api/sessions/:id/capabilities`는 각 도메인의 기존 기능 소스를 읽기 전용으로 연합해 작업 삼태 표(`enabled` / `disabled` / `unavailable`)와 `tansr-closure-id`를 돌려줍니다. 이것은 **새 인가 엔진을 만들지 않으며**, 울타리 안의 작업은 여전히 도메인 handler가 앱 기능 비트, 사용자 인가, 세션 상태, 승인에 따라 판정합니다. 쓰기 작업은 지난번 `tansr-closure-id`를 전제 조건으로 붙일 수 있습니다. 울타리가 바뀌었으면 `412 precondition_failed`(`rediscover`. 다시 발견한 뒤 재전송 여부를 정하고, 옛 값을 그대로 억지로 재전송하지 마세요), 울타리를 넘어 `disabled`인 작업을 호출하면 `403 capability_unavailable`입니다. 알 수 없는 세션, 타인의 세션, 아카이브 호스트에만 있는 세션은 모두 `404 not_found`로 답해 존재 여부를 누설하지 않습니다.
- **`/v1`은 기본적으로 꺼짐**: 파사드가 있는 배포에서는 `/v1/sessions*`, `/v1/status`, `/v1/approvals/:id/credential`이 기본적으로 404입니다(SDK2 명시적 호스트가 있으면 항상 꺼짐). 전환용 손잡이 `tansr serve --legacy-v1` / `TANSR_SERVE_LEGACY_V1=1`은 0.14.0 / CLI 0.10.1부터 사용 중단 예정입니다(1.0.0에서 제거. 켜면 `warn` 이벤트 `server.deprecated_option`이 나옴). 승인 자격 증명 전달은 `POST /api/approvals/:id/credential`로 옮깁니다. 헬스 체크는 `/healthz` `/readyz`로 바꾸고, `/v1` Bearer로 `/v1/status`를 찔러 보지 마세요.
- **구 접두사 `/v2`, `/v3/*`의 퇴역 창은 설정할 수 있음**(`@tansr/serve` 0.15.0 / CLI 0.10.2부터, 파사드가 있을 때 적용): `TANSR_SERVE_LEGACY_PREFIX=readwrite|readonly|off`(팩토리 옵션 `legacyPrefixes`). `readwrite`가 기본값이며(0.15.1에서도 그대로) 구 접두사의 요청을 모두 받아들입니다. `readonly`에서는 매니페스트가 쓰기로 등록한 작업이 구 접두사에서 `410 gone`을 답하고(`message`는 대응하는 `/api` 작업을 가리킴) 읽기와 스트림은 그대로 동작합니다. `off`에서는 구 접두사의 모든 요청이 `404 not_found`가 됩니다. `TANSR_SERVE_LEGACY_SUNSET`(`legacyPrefixSunset`)로 퇴역 예정 시각을 지정하면 구 접두사 응답에 기존 `Deprecation` / `Link` 헤더 외에 `Sunset` 헤더가 붙습니다. 같은 세션에서 구 접두사와 `/api`를 섞어 쓰면 로그에 `warn` 이벤트 `api.legacy_prefix_mixed`가 나오고, 거부된 구 접두사 요청에는 `api.legacy_prefix_rejected`가 나옵니다. 둘 다 0으로 유지되는 것이 창을 좁혀도 된다는 증거입니다. 기본값이 언제 바뀌는지는 [마이그레이션과 퇴역 일정](/ko/unified-api/migration/)을 참고하세요.
- 통합 오류 봉투의 `message`는 글자 그대로를 보장하지 않고, `detail.path`에는 요청한 `/api` 경로가 되돌려 적히며, `/v2` / `/v3` 내부 접두사와 호스트 경로는 밖으로 새지 않습니다. 각 헤더와 코드 표는 [통합 API의 요청 헤더와 오류 봉투](/ko/unified-api/headers-and-errors/)를 참고하세요.

## 시스템 도구와 터미널 도구의 격리(SDK 2.0 원격 프로필)

SDK 2.0의 "통합 코어와 얇은 터미널"은 도구를 **실행 장소**에 따라 두 부류로 나누며, 어느 쪽도 상대를 대신해 실행할 수 없습니다:

- **시스템 도구는 세션 서비스 호스트에서 실행**: WebFetch / Http / WebSearch / 미디어 도구와 MCP 어댑터는 serve 프로세스 안에서 호스트의 외부 연결 규칙(사설망 상한, 자격 증명 허용 목록, 프록시 쪽 동일 규칙)에 따라 동작합니다. MCP 어댑터는 호스트의 기존 연결을 재사용하며, 모델 매개변수에 따라 프로세스를 시작할 수 없고, 모델도 외부 연결 상한을 풀 수 없습니다.
- **터미널 도구는 바인딩된 기기에서만 실행**: 파일 읽기 / 디렉터리 목록 / 쓰기 / 편집과 바인딩된 작업 공간 메모리(`fs.inspect` / `fs.read` / `fs.list` 같은 통제된 프리미티브)는 앱이 관리 API로 `execution.version = 'bound-device-v1'`을 명시적으로 설정하고 `boundDevice.tools`로 부여했을 때만 존재합니다. **구 앱 유형과 구 `tools` 비트에서 터미널 인가는 도출되지 않습니다.** 유효한 도구 = 앱 상한 ∩ 사용자 정책 ∩ 요청 축소 ∩ 기기 프리미티브. 원래의 Read / List 권한과 사용자 승인은 그대로 적용되며, 설정 디렉터리가 사용자를 대신해 인가할 수 없습니다.
- **메모리와 첨부 파일은 호스트로 되돌아가지 않습니다**: 신뢰된 호스트의 `execution.memoryFor(scope)`는 바인딩된 작업 공간 안의 상대 디렉터리만 고르며 serve의 home / env / cwd를 읽지 않습니다. 기능 부족, 거부, 연결 끊김, 소스 과대는 모두 해당 턴만 격하시키며, 서버 쪽 파일을 읽는 동작으로 바뀌는 일은 절대 없습니다. 외부 첨부 파일 소스 `trustedAttachmentSourceFor`의 URL은 조회 표의 키일 뿐이며, SDK / serve는 자동으로 fetch하지 않고, 모델이나 클라이언트가 주소를 파일 권한이나 네트워크 권한으로 바꾸는 것도 받아들이지 않습니다.
- **내구 실행은 먼저 기록하고 나서 실행**: 실행기는 작업을 먼저 영구적으로 점유한 뒤 실행하고, 결과를 먼저 저장한 뒤 돌려줍니다. 연결이 끊긴 뒤 다시 열어도 결과를 알 수 없는 작업을 다시 하지 않습니다(SDK 층에서는 `GateDecision.executionTarget` / `ToolContext.executionTarget`에 대응하며 `@tansr/sdk` 0.18.0부터. 프로세스 내 SDK에서는 항상 없음).
- **신뢰된 호스트 모듈은 배포자 코드와 같은 수준으로 신뢰됩니다**: `tansr serve --v2 --host-module <absolute.cjs> --host-module-sha256 <sha256>`(CLI 0.10.0부터)은 진입 파일 원시 바이트의 다이제스트만 대조하며, 의존성 그래프에 서명하는 것도 코드 샌드박스도 아닙니다. 경로와 다이제스트는 항상 배포 파이프라인이 제공하며, 모델이나 HTTP가 제공하지 않습니다.

## 자격 증명: 어디에 두고, 어디에 두지 않는가

| 자격 증명 | 누구를 나타내는가 | 올바른 위치 | 절대 두지 않는 곳 |
|---|---|---|---|
| 개인 액세스 토큰(PAT) | 당신 본인 | 콘솔에서 생성한 뒤 `tansr init`(마스크 입력) 또는 CI의 `TANSR_PAT` 환경 변수에만 제공 | shell 기록(`--pat`로 직접 주면 흔적이 남음), 스크립트 평문, 저장소 |
| 이 컴퓨터의 파생 앱 키 | 당신의 이 기기 | `tansr init`이 자동으로 운영 체제 키체인(macOS Keychain / Linux secret-service / Windows DPAPI)에 기록. 사용할 수 없으면 0600 파일로 폴백하며 명확히 경고 | 당신이 건드릴 필요 없음. `tansr doctor`의 자격 증명 저장소 섹션에서 위치를 볼 수 있음 |
| 모델 공급자 API key(완전 로컬 모드) | 당신의 공급자 계정 | 환경 변수. 설정 파일에는 **변수 이름만** `auth.env`에 기록 | `settings.json`, 오류 메시지, `/config` 출력(이들은 값을 절대 포함하지 않음) |
| 앱 키 appid / appkey | 당신의 앱 | 당신의 서버 프로세스 환경 변수(Node 프로세스 또는 `@tansr/serve`) | 단말 기기, 로그, 오류 응답, 저장소(`.env`는 `.gitignore`에) |
| 단기 `app_user` 토큰 | 당신의 어느 최종 사용자 | Electron 메인 프로세스 메모리. `@tansr/serve` 프로세스 내부 | renderer 프로세스, 영구 저장소. 모바일은 **절대** 접촉하지 않음 |
| 당신의 로그인 token(모바일) | 당신의 사용자 | `authProvider`로 요청마다 제공하며, SDK는 영구 저장하지 않음 | SharedPreferences / DataStore / UserDefaults / 로그 |
| 세션 서비스 `/v1` Bearer(`--token` / `TANSR_SERVE_TOKEN`) | 운영자 | 환경 변수 | `/v2` / `/api` 면과 서로 통하지 않음. 최종 사용자에게 재사용하지 말 것. `--v2` 배포에서는 `/v1`이 기본적으로 꺼짐 |
| `--host-module-sha256`의 다이제스트 | 당신의 배포 파이프라인 | 빌드 산출물 옆에서 `.cjs`와 함께 생성하고 함께 배포 | 런타임에 계산하지 않고, 모델이나 HTTP가 제공하지 않음 |
| webhook `secret` | 당신의 푸시 백엔드 | 세션 서비스와 수신 측 각자의 환경 변수 | 로그. 엔진은 절대 출력하지 않음 |

반복해서 말할 가치가 있는 레드라인 세 가지: appkey는 절대 당신의 서버 밖으로 나가지 않습니다. `app_user` 토큰은 절대 세션 서비스 밖으로 나가지 않습니다. 세션 id는 인증 요소가 아닙니다.

CLI에는 당신을 위한 마스킹 규율이 한 층 더 있습니다: 보고서, 로그, 내보낸 트랜스크립트 안의 키는 일괄 `sk-...뒤 4자리` 형태로 마스킹됩니다. `tansr sessions export`의 산출물은 바로 티켓에 첨부할 수 있습니다.

## 프로젝트 층 hooks의 신뢰 게이트: 기본은 실행 0

**tansr CLI 0.7.0부터 제공.** 저장소 안의 `.tansr/settings.json` / `.tansr/settings.local.json`은 `command` / `http` 두 종류의 hooks를 선언할 수 있습니다. 이것은 "저장소를 클론했다는 이유만으로 실행될 수 있는 코드"이므로, CLI는 프로젝트 층 hooks를 **작업 공간 신뢰 게이트** 뒤에 두고 기본으로는 실행하지 않습니다.

- **신뢰 기록은 사용자 층** `~/.tansr/trust.json`에 있으며 별도의 허가 파일을 만들지 않습니다. 작업 공간이 신뢰됨으로 기록됨 → 프로젝트 층 hooks 정상 실행. 기록 없음 또는 불신으로 기록됨 → 프로젝트 층 `command` / `http` hooks는 **실행 0**(`hook.*` 이벤트도 0)이며 stderr에 한 줄 설명을 남깁니다. 사용자 층과 관리 층 hooks는 영향을 받지 않습니다.
- **TUI**: 기록이 없는 디렉터리를 처음 열면 사용자 층 / 관리 층의 `SessionStart` hooks는 종전처럼 첫 화면 전에 실행되고, 프로젝트 층 `SessionStart`는 신뢰 대화 상자에서 "신뢰"를 선택한 뒤 정확히 한 번만 보충 실행됩니다(거부 / Esc는 실행하지 않고 축소 모드로 들어갑니다).
- **무인 4개 진입점**(headless `-p`, `tansr serve`, `tansr acp`, `tansr mcp serve`)에는 대화 면이 없어 TUI가 저장한 기록만 인정합니다. TUI에서 신뢰한 저장소는 CI / 편집기로 연결할 때 프로젝트 hooks가 자동으로 적용됩니다. 기록이 없는데 이번 실행에만 꼭 필요하다면 `--trust-project-hooks`(4개 진입점 동일 플래그) 또는 `TANSR_TRUST_PROJECT_HOOKS=1`(다른 값은 무효)을 사용합니다. 이는 **기록이 없을 때만**, 이번 실행에만 적용되고 `trust.json`에 **기록되지 않으며**, 기록된 불신을 **덮어쓸 수 없습니다**.
- **판정 기준은 설정 앵커 체인이며 현재 디렉터리가 아닙니다**: 앵커 = 시작 디렉터리에서 위로 가장 가까운 `.tansr`를 포함한 상위 디렉터리. 앵커 또는 그 상위 중 하나라도 불신으로 기록되어 있으면 하위 디렉터리가 신뢰됨으로 기록되어 있어도 실행 0이며, 플래그 / 환경 변수로도 덮어쓸 수 없습니다. 신뢰 키는 실제 경로(realpath)로 정규화됩니다. 정션 / 심볼릭 링크 / `subst` / 8.3 짧은 이름 / 매핑된 드라이브가 같은 작업 공간을 가리키면 같은 기록입니다. 실제 경로 해석에 실패하면 문자 그대로의 경로로 처리하며 **신뢰로 보지 않습니다**. 과거에 별칭 경로 문자열로 기록한 신뢰는 한 번 더 부여해야 합니다. TUI `/cd`도, `/v2` 세션 도중의 cwd 전환도 다시 판정하지 않습니다.
- 프로젝트 층 `http` hook의 요청 헤더에 있는 값 전체 `${VAR}` 표기는 **확장하지 않고 문자 그대로 전송**합니다(저장소 설정은 당신의 환경 변수를 절대 읽지 않습니다. 요청은 거부되지 않고 그대로 전송됩니다). 사용자 층 / 관리 층은 종전처럼 확장합니다. 프로젝트 층 플러그인에 딸린 hooks는 이미 플러그인 단위 신뢰를 통과했으므로 이 게이트를 다시 받지 않습니다.
- **프로젝트 층 MCP 서버와 플러그인도 같은 규칙**(0.7.0부터): 무인 실행 네 입구는 저장소가 선언한 MCP 서버 / 플러그인에 대해서도 TUI가 디스크에 기록한 신뢰 레코드만 인정합니다. 순서는 **기록된 거부(정의 지문으로 대조) > 기록된 허용 > `TANSR_TRUST_PROJECT_MCP=1` / `TANSR_TRUST_PROJECT_PLUGINS=1`(레코드가 없거나 지문이 불일치할 때만 적용) > 승인 대기**입니다. MCP 정의가 바뀌면 불일치로 보고, 예전의 리터럴 경로 레코드는 거부에만 쓰며 허용으로 빌려 쓰지 않습니다. 환경 변수만으로 기록된 거부를 넘어가던 배포는 0.7.0부터 거부됩니다. TUI에서 다시 신뢰를 부여하거나 해당 거부 레코드를 삭제하세요. `tansr acp`의 플러그인 탐색 / 신뢰 / 서명 검증은 다른 입구와 같은 한 벌을 쓰며, 신뢰되지 않은 플러그인은 전혀 로드되지 않고 안내는 stderr로 나갑니다(stdout은 프로토콜 프레임만).
- **SDK 내장 측**(`@tansr/sdk` 0.14.0부터): `createSession({ trustProjectHooks: true })`는 호스트가 사용자를 대신해 신뢰를 부여한다는 뜻이며, 기본 `false`에서는 프로젝트 층 hooks가 실행 0, `hook.*` 이벤트도 0입니다. SDK는 CLI의 `trust.json`을 절대 읽지 않고 신뢰를 저장하지도 않으며, 부여 책임은 내장 측이 가집니다. 신뢰를 부여하지 않았는데 프로젝트에 hooks가 있으면 `onWarning`으로 `project_hooks_untrusted` 한 건을 받습니다(`detail`에 `cwd`와 발견된 층 `projectShared` / `projectLocal`). `onWarning`이 없으면 복구 가능한 `turn.error { scope: 'sdk.notice' }`로 대체됩니다. 단일 턴 `query()`에는 신뢰 비트가 없어 프로젝트 층 hooks가 절대 켜지지 않습니다.

## 데이터 보존: 어디에, 얼마나, 누가 삭제하는가

### 로컬 컴퓨터(CLI)

- 세션, 설정 캐시, 사용량 큐, 프로젝트 메모리는 `<storageRoot>/`(기본값 `~/.tansr`. `TANSR_STORAGE_ROOT` 또는 총 루트 `TANSR_USER_HOME`으로 리디렉션 가능)에 저장됩니다. 플랫폼에 로그인한 뒤 새 데이터는 계정별로 `<storageRoot>/identities/<계정 지문>/`에 격리됩니다.
- 세션마다 디렉터리 하나: `journal.jsonl`(해시 체인), `meta.json`, `attachments/`, 한도 초과 산출물 `spill/`. 이미지 바이트는 `<storageRoot>/image-cache/<sessionId>/`에 캐시됩니다. Shell의 긴 출력은 `<작업 디렉터리>/.tansr/shell-output/`에, TTS 오디오는 `<작업 디렉터리>/.tansr/artifacts/<sessionId>/`에 저장됩니다.
- **자동으로 삭제되지 않습니다.** 정리는 `tansr sessions prune`으로 합니다(기본값은 dry-run으로 목록만 나열하고, `--apply`를 붙여야 삭제. 보존 정책 `--keep-days` 기본값 90과 `--keep-last` 기본값 500의 합집합. 오늘의 세션과 사용 중인 세션은 절대 삭제하지 않음. 손상된 디렉터리는 `--include-broken`이 필요). `tansr logout`은 신원 저장소 데이터를 삭제하지 않습니다.
- 세션 종료 시의 `metrics.json`에는 개수와 비율만 있으며, 경로, 명령, 규칙 원문은 없습니다. **외부 텔레메트리는 기본적으로 꺼져 있습니다**: 현재 버전에는 외부 보고 채널이 전혀 존재하지 않습니다.
- 플랫폼 측은 **단말 세션 내용을 저장하지 않고 계량만** 합니다. 플랫폼 세션 레지스트리에는 30일 비활성 임대가 있으며, 만료되면 보관 처리됩니다.

### 세션 서비스(`@tansr/serve`)

- 세션 기록은 당신이 설정한 `store` 디렉터리 `<dir>/agent-sessions/<endUserKey>/sessions/<sessionId>/`에 저장됩니다. `endUserKey`는 최종 사용자 id의 해시이며 신원이 아닙니다. 콜드 계층을 당신의 객체 저장소에 연결할 수 있으며, 세그먼트는 평문 JSONL(압축)입니다. **암호화, 키 관리, 데이터 소재지, 접근 제어는 당신의 책임**입니다(`policy.transform` 연결점).
- 메모리 상태의 짧은 창: 종료 레코드는 30분 보존, 유휴 24시간이면 디스크에 저장. `DELETE /v2/sessions/:id`(`/api/sessions/:id`와 동의)는 닫기이며 삭제가 아닙니다. **보존 기간을 설정하지 않으면 store는 기본적으로 영구 보존**입니다. 저장소 보존 기간 스캔(일 단위 나이와 사용자별 개수로 휴면 세션 삭제)은 **@tansr/serve 0.8.0부터 제공**됩니다(팩토리 옵션 `sessions.retention` 또는 환경 변수 두 개, [보존 기간과 거버넌스](/ko/serve/retention-and-governance/#存储保留期扫描) 참고). 실제 삭제는 `store.delete`로 합니다.
- 0.14.0부터 `Idempotency-Key`의 영수증 캐시는 프로세스 내 메모리 상태이며(사용자당 256개 / 전역 4 096개 / 10분), `endUserId`별로 격리되고 프로세스와 함께 사라집니다. 명시적으로 조립한 SDK2 아카이브 호스트는 "단일 인가 소스" 정책으로 아카이브를 저장하며, 백업이 아니고 다른 곳으로 동기화하지도 않으며, 항목 삭제는 호스트가 명시적으로 호출합니다.
- 구조화 로그 필드에는 토큰과 메시지 내용이 절대 들어가지 않습니다(0.13.0부터 기본 레벨은 `warn`이며, 어느 레벨에서도 똑같이 가려지고 본문 키는 항상 `[redacted]`). 메트릭 라벨에는 sessionId / endUserId가 절대 들어가지 않습니다.
- 단말로 내려가는 권한 요청 프레임에는 완전한 도구 인자가 절대 실리지 않으며, 대상 요약만 있습니다. webhook 페이로드에는 메시지 내용과 자격 증명이 절대 실리지 않습니다.

### 단말 쪽

Android / iOS / HarmonyOS SDK는 자격 증명을 캐시하지 않습니다. 뷰 상태는 메모리에 있습니다. sessionId를 로컬에 저장할지(콜드 스타트 resume을 위해)는 당신이 결정합니다. id만 저장하고, 내용도 자격 증명도 저장하지 않습니다.

## 교체와 폐기: 각 자격 증명을 어떻게 바꾸는가

| 자격 증명 | 어떻게 바꾸는가 | 영향 범위 |
|---|---|---|
| PAT | 콘솔에서 새로 하나 만들고, 이 컴퓨터에서 `tansr init --fresh`로 다시 로그인한 뒤, 콘솔에서 이전 PAT를 삭제 | PAT는 `tansr logout`으로 절대 폐기되지 않음. 다른 기기가 아직 같은 것을 사용 중일 수 있음 |
| 이 컴퓨터의 파생 앱 키 | `tansr init`을 다시 실행하면 교체되어 기간이 연장됨(만료가 가까우면 세션 안에 "키가 곧 만료됩니다" 안내가 표시됨). `tansr logout`은 로컬을 지우고 원격 비활성화를 최대한 시도. 기기를 잃었으면 콘솔에서 해당 디바이스 키를 수동으로 비활성화할 수 있음 | 각 기기가 각자의 키를 보유(호스트 이름 + 디바이스 id로 명명)하며 서로 대체하지 않음 |
| 앱 키 appkey | 콘솔에서 교체(대응하는 `POST /v1/apps/:id/rotate`). 서버 환경 변수를 업데이트한 뒤 프로세스 재시작 | 최후의 전면 차단: 이전 appkey는 즉시 무효화 |
| 어느 최종 사용자의 토큰 | 콘솔 또는 관리 API에서 최종 사용자 단위로 폐기(`POST /v1/apps/:id/app-user-revocations`). 그 사용자의 기존 토큰은 즉시 모두 거부됨. 당신 시스템에서 그의 로그인 상태를 끊으면 자연히 공급이 중단됨(토큰 TTL 60–86400초, 갱신은 없음) | 그 사용자에게만 영향 |
| 앱 전체 | 콘솔에서 앱 비활성화 | 말단 전부 거부 |
| 세션 서비스 `/v1` Bearer | `TANSR_SERVE_TOKEN` / `--token`을 바꾸고 재시작 | `/v1` 면 호출자가 동기화해야 함 |
| webhook `secret` | 수신 측이 먼저 새 값과 이전 값을 동시에 받아들이고, 그다음 세션 서비스 쪽을 바꾸고, 마지막에 이전 값을 철회 | 기간 중 전달 손실 없음 |
| 당신의 로그인 token(모바일) | 당신의 로그인 체계에 속함. SDK는 401 시 `authProvider`로 최대 2번 다시 받고, 여전히 401이면 종료 상태로 들어가 당신의 명시적 재연결을 기다림 | 토큰을 새로 받았는데도 401이면 폐기나 설정 오류이며, 일시적 흔들림이 아님 |

플랫폼 측에서 토큰 무효화를 유발하는 코드는 하나뿐입니다: `unauthorized`(401). 세션 서비스가 이를 받으면 같은 요청 안에서 캐시된 토큰을 내보내고, 다시 발급하고, 한 번 다시 보냅니다. 단말 쪽 SDK가 이를 보면 위의 2번 수렴 절차를 따릅니다. 다른 코드(403, 429, 5xx)는 모두 토큰이 잘못되었음을 의미하지 않으므로, 그 때문에 다시 발급하지 마세요.

## 빠른 자가 점검 목록

- `tansr doctor`: 자격 증명이 키체인에 있는가, 평문 파일에 있는가? `localProviders` 섹션이 당신의 예상과 맞는가(플랫폼 모드 / 이스케이프 해치)? 무인 기준선에 관한 안내가 있는가?
- 저장소에서 `TANSR_APP_KEY` / `sk-` / `tansr_sk_`를 한 번 `grep`해서 실제 값이 들어가지 않았는지 확인.
- 세션 서비스를 `0.0.0.0`에 바인딩할 때 `/metrics`는 내부망에만 노출되는가? `store` 디렉터리는 로컬 디스크이며 공유되지 않는가?
- 당신의 토큰 발급 엔드포인트는 자체 로그인 상태 뒤에서만 발급하고, `endUserId`는 항상 서버 세션에서 가져오며 요청 본문을 신뢰하지 않는가? `x-tansr-end-user`는 게이트웨이만 쓰고 있는가?
- `--v2` 배포에서 아직 `--legacy-v1` / `TANSR_SERVE_LEGACY_V1`을 켜 두고 있지 않은가? 로그에 `server.deprecated_option`이 있으면 제거 일정을 잡아야 하며(1.0.0에서 제거), 승인 전달은 `POST /api/approvals/:id/credential`로 바꿉니다.
- `--host-module-sha256`은 배포 파이프라인이 `.cjs` 산출물과 함께 생성하는가, 출시 때 손으로 계산하지는 않는가?
- 콜드 계층 객체 저장소의 수명 주기 규칙과 암호화는 설정되었는가?
