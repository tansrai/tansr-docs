---
title: '문제 해결 가이드'
description: 'tansr doctor의 각 섹션을 읽는 법, 무엇이 차단이고 무엇이 귀속 정보에 불과한지. 가장 흔한 오류 코드 열 개의 의미와 처리(오류 코드 표 딥링크). 그리고 CLI, SDK, 세션 서비스, 모바일 각각의 문제 해결 첫 단계.'
zone: support
category: support
related:
  - support
  - errors/codes
  - cli/settings-and-doctor
  - sdk/errors-and-retries
  - support/contact
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:doc/98-Agent会话服务v2契约冻结件.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-10'
---

문제 해결 순서: 먼저 `tansr doctor`(CLI) 또는 오류 코드(다른 형태)를 보고, 그다음 아래 표에서 처리를 찾습니다. 열에 아홉은 사람에게 연락할 필요가 없습니다.

## 첫 단계: `tansr doctor`

```bash
tansr doctor          # 人读报告
tansr doctor --json   # 机器可读
```

모델 호출 없음, 네트워크 없음, 자식 프로세스 없음. **종료 코드 0 = 사용 가능, 1 = 차단 문제 있음**. TUI 안의 `/doctor`도 같은 것입니다. 표시되는 것은 가장 최근 어셈블리 가져오기의 사실입니다. 콘솔에서 설정을 바꿨으면 CLI를 한 번 실행하면 새로 고쳐집니다.

### 섹션 대조표

| 섹션 | 정상일 때의 모습 | 이상할 때 어떻게 하나 | 차단?|
|---|---|---|---|
| `node_version` | ≥ 22.19 | Node를 업그레이드하거나, 단일 파일 실행 파일(런타임 내장)로 바꿈 | 예 |
| `config_sources` | 5층 각각 loaded / absent, skipped 없음 | skipped = 그 층의 JSONC 구문 오류 또는 루트 노드가 객체가 아님. 파일을 고치거나 삭제 | 예 |
| `config_diagnostics` | 0건 또는 info 수준 | 건마다 층 / 키 경로 / 기대 타입을 제시. 잘못된 값은 이미 제거되어 더 낮은 층으로 폴백됨 | error 수준은 차단 |
| `model_resolution` | 별칭 → provider / 모델 | "알 수 없는 모델 별칭 또는 ref"면 `modelAliases`와 `providers.models`를 대조. "API key 없음: 환경 변수 X가 설정되지 않음"이면 그 변수를 export | 예 |
| `context_window` / `context_scheme` | 창 두 값과 클램프 쪽. 스킴 `production` | 창 알 수 없음 → 모델에 `maxContext`를 선언. production 아닌 스킴은 경고일 뿐 | 아니요 |
| `custom_commands` / `mcp_connections` | skipped 없음. 지연 연결의 미연결도 정상으로 봄 | MCP 실패는 오류 코드를 봄. `/mcp reconnect` | 아니요 |
| `terminal` / `workspace_trust` / `output_style` | TTY와 크기. 신뢰됨. 스타일 존재 | 신뢰되지 않음 = 읽기 전용 샌드박스, `/trust grant`. 스타일 이름이 없으면 정직하게 오류 보고 | 아니요 |
| `localProviders`(귀속) | 플랫폼 모드: 로컬 providers가 프루닝되는 것은 예상된 동작. 이스케이프 해치: 배너 표시 | "provider가 설정되지 않음"은 먼저 여기를 보고 설정이 안 된 것인지 프루닝된 것인지 구분 | 아니요 |
| 자격 증명 저장소(귀속) | 키체인 | 평문 파일로 폴백되었으면 디렉터리 권한을 확인. `tansr init` 다시 실행 | 아니요 |
| 모델 선택 귀속 | `model.selected` 값과 제공 층. 억제 상태 | 프로젝트 층이 `modelAliases.main`을 고정했을 때 사용자 층의 고착 선택이 억제되는 것은 예상된 동작 | 아니요 |
| 플랜 | "개인(CLI만, 플랜 요금 없음)" 또는 "등급 이름 · 만료 · 상태" | 개인 등급은 고장이 아님. 유예 / 회귀 상태는 콘솔에서 갱신 | 아니요 |
| 미디어 도구 | 네 면 `byo` / `platform` / `none` | 전부 `none`이면 개통 안내가 붙음: 자체 엔드포인트 세 변수, 또는 관리자에게 미디어 풀 개방 요청 | 아니요 |
| 무인 기준선 | `auto`이며 격리 흔적 있음 | 흔적이 없으면 눈에 띄게 안내. 격리를 확인했으면 `TANSR_ISOLATED=1`로 억제 | 아니요 |
| 세션 저장소 / memory | 세션 수, 바이트, 산출물 디렉터리, 손상 디렉터리 | 읽기만 하고 대신 삭제하지 않음. 정리는 `tansr sessions prune` | 아니요 |

### CLI에서 흔한 메시지

| 증상 | 처리 |
|---|---|
| "TUI에는 대화형 터미널(TTY)이 필요합니다" | 파이프 안에서 `tansr`를 시작했습니다. 비대화형 상황에서는 `-p`를 사용 |
| "API token이 없습니다: --token <값>을 전달하거나 TANSR_SERVE_TOKEN을 설정하세요" | `tansr serve`는 fail-closed이며 인증 없는 서비스를 띄우지 않음 |
| "서버 시작 실패" / "--port 값이 유효하지 않음" | 포트가 사용 중이거나 잘못됨 |
| "세션이 존재하지 않음" / "세션을 복구할 수 없음" | `--resume`의 id가 틀렸거나 디렉터리가 사용 중. 인자 없는 `tansr --resume`으로 선택기를 열어 확인 |
| 종료 코드 5이며 `tansr init` 안내 | 무인 형태가 초기화되지 않음. 먼저 로그인하거나 `TANSR_ESCAPE_LOCAL=1`을 설정해 로컬 모드로 |
| 종료 코드 3 | 상한 도달: `--max-turns` / 예산 / 도구 턴 수. 늘리거나 작업을 나눔 |
| 종료 코드 4 | prompt가 너무 길고 압축을 사용할 수 없음. 더 큰 창의 모델로 바꿈 |
| "동시 실행이 플랜 상한에 도달" 배너 | 새 세션만 거부. 30초 뒤 다시 보내거나 플랜 업그레이드 |

## 가장 흔한 오류 코드 열 개

모든 코드의 공식 표는 [오류 코드 표](/errors/codes)에 있습니다. 여기서는 가장 자주 만나는 열 개와 첫 처리만 나열합니다.

| 코드 | HTTP | 어디에서 보게 되나 | 첫 처리 |
|---|---|---|---|
| [`unauthorized`](/errors/codes#unauthorized) | 401 | 토큰이 만료되었거나 폐기됨. 세션 서비스 `authenticate`가 null 반환 | CLI: `tansr init`으로 다시 로그인. SDK: 당신의 서버로 돌아가 토큰을 다시 발급. 모바일: 로그인 상태를 고친 뒤 명시적으로 재연결. **토큰이 잘못되었음을 나타내는 유일한 코드** |
| [`token_expired`](/errors/codes#token_expired) | 401 | 로그인 상태 token 만료 | 다시 로그인 / 새로 고침 |
| [`invalid_api_key`](/errors/codes#invalid_api_key) | 401 | PAT가 유효하지 않음 | 콘솔에서 PAT를 다시 만들고 `tansr init --fresh` |
| [`rate_limited`](/errors/codes#rate_limited) | 429 | 플랫폼 속도 제한, 또는 세션 서비스 호스트 속도 제한 / 플랜 할당량(`detail.scope: 'plan'`) | `Retry-After`의 초 단위로 기다린 뒤 재시도. 더 촘촘하게 다시 보내지 말 것 |
| [`plan_concurrency_exceeded`](/errors/codes#plan_concurrency_exceeded) | 429 | 플랜 동시 실행 하드 캡 | 새 세션만 거부. 30초 뒤 수동으로 다시 보냄. 등급 상향 고려 |
| [`insufficient_balance`](/errors/codes#insufficient_balance) | 402 | 잔액 부족 | 충전. 재시도는 소용없음 |
| [`model_not_authorized`](/errors/codes#model_not_authorized) | 403 | 모델이 앱 권한 범위에 없음 | 콘솔에서 앱에 그 모델 권한을 부여 |
| [`validation_failed`](/errors/codes#validation_failed) | 400 | 요청 페이로드 형태가 잘못됨 | `message`를 읽고 요청을 수정. 네트워크 문제가 아님 |
| [`payload_too_large`](/errors/codes#payload_too_large) | 413 | 크기 상한 초과(예: 음성 원시 오디오 > 24 MiB) | 나누거나 압축. 재시도 불가 |
| [`session_archived`](/errors/codes#session_archived) | 410 | 플랫폼 세션이 보관 처리됨(30일 비활성) | 새 세션 생성. 이것은 이어갈 수 없음 |

자주 보이지만 의미가 명확한 것 몇 개를 덧붙입니다: [`upstream_error`](/errors/codes#upstream_error)(502, 업스트림 모델 장애, 백오프 후 재시도), [`upstream_timeout`](/errors/codes#upstream_timeout)(504, 위와 같음), [`quota_exceeded`](/errors/codes#quota_exceeded)(429, 일일 할당량), [`forbidden`](/errors/codes#forbidden)(403, 기능 플래그 꺼짐 또는 소속 불일치), [`context_window_exceeded`](/errors/codes#context_window_exceeded)(400, 먼저 압축).

## 각 형태의 문제 해결 첫 단계

**SDK(Node / Electron)**: 어셈블리 단계인지 실행 단계인지 구분합니다. 어셈블리 단계의 `TansrSdkError`는 `code`를 읽습니다(`invalid_options`는 코드 수정. `assembly_failed`는 `cause`를 봄. `capability_disabled`는 콘솔에서 플래그를 켬). 실행 단계에서는 이벤트 스트림의 `turn.error.recoverable`을 봅니다. `true`는 자문이고, `false`가 실패입니다. 이벤트 스트림이 "멈춰서 움직이지 않음"은 거의 `session.close()`를 잊은 것이고, "도구가 모두 거부됨"은 거의 `permission.askUser`를 연결하지 않은 것입니다. 자세한 내용은 [오류 처리와 재시도](/ko/sdk/errors-and-retries/).

**세션 서비스(`@tansr/serve`)**: 먼저 `GET /readyz`(503이면 `reasons` 포함)를 보고, 그다음 구조화 로그의 `request.completed` / `store.commit_failed` / `session.rejected`를 보며, 응답 헤더 `x-request-id`로 연관시킵니다. `resume`이 항상 `409 resume_unavailable` = store를 연결하지 않음. `500 store_corrupted`는 공유 저장소 디렉터리(안전하지 않은 구성)에서 흔합니다. 세션 생성 시 `503 upstream_unavailable`은 플랫폼 쪽 토큰 발급 불가, `503 overloaded`는 이 컴퓨터의 허용 상한, `503 draining`은 정상 종료 진행 중입니다.

**모바일(Android / iOS / HarmonyOS)**: 먼저 연결 상태를 봅니다. Android / iOS는 `connectionState`를 봅니다. `Retrying`은 정상적인 L1 재연결, `Recovering`은 L2 재구축. `AuthExpired → Failed(Unauthorized)`는 토큰을 2번 새로 받았는데도 여전히 401인 것으로, 로그인 상태를 고친 뒤 명시적으로 `start()`합니다. HarmonyOS는 `session.onState`의 `retrying` / `recovering` / `failed`를 봅니다. 연결하자마자 401은 보통 인증 헤더를 서버 쪽 `authenticate`가 인정하지 않는 것입니다. 에뮬레이터에서 연결이 안 되는 경우, Android는 `10.0.2.2` 대신 `127.0.0.1`을 쓴 경우가 많고, HarmonyOS 루프백은 로컬 디버그만이며 개발 머신 사설 주소에 닿으려면 `allowPrivateNetworkHttp`가 필요합니다.

## 이것을 가지고 지원팀에 문의

- `tansr doctor --json`의 출력(키 값은 포함하지 않으며, 자격 증명은 지문 형태로 표시됨).
- 오류 코드와 완전한 `message`. 세션 서비스 쪽은 `x-request-id`도 첨부.
- 재현 단계와 시각. 과금과 관련되면 주문 번호 또는 청구 월.
- 가능하면 `tansr sessions export <id>`의 트랜스크립트(키는 이미 자동 마스킹됨).

진입점은 [지원팀에 문의](/ko/support/contact/)를 참고하세요.
