---
title: '빠른 시작: 길 하나를 골라 5분 안에 실행하기'
description: 'tansr에는 여섯 가지 사용 형태가 있습니다. Node SDK, CLI, 자체 호스팅 세션 서비스, Android, iOS, HarmonyOS. 이 페이지는 어떤 문서부터 시작해야 하는지 판단하도록 돕고, 여섯 가지 길이 공유하는 계정과 자격 증명 모델을 설명합니다.'
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/cli
  - getting-started/serve
  - getting-started/android
  - getting-started/harmony
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-13'
---

tansr는 에이전트 런타임입니다. 하나의 커널(쿼리 루프, 도구 스케줄링, 권한 엔진, 컨텍스트 압축)을 여러 가지 형태로 제공합니다. 전부 이해할 필요는 없습니다. "에이전트를 어디에서 실행할 것인가"에 따라 길 하나만 고르면 됩니다. 중립 다리, Harness, Skill과 런타임의 역할 나눔, 현재의 두 단계, 그리고 아직 제공하지 않은 계획은 [기술 입장](/ko/getting-started/principles/)에 있습니다. 코딩 도우미가 수집하는 같은 문장은 [`/llms.txt`](/llms.txt)에 있습니다. 문서 첫 화면에는 두지 않고 페이지 끝의 접힌 항목에 둡니다.

## 먼저 하나만 답하기: 에이전트는 어디에서 실행되나요?

| 당신의 상황 | 추천 진입점 | 해당 문서 |
|---|---|---|
| 터미널에서 직접 에이전트와 대화하고, 코드를 고치고, 스크립트를 실행하고 싶다 | `tansr` CLI | [CLI 5분 안에 실행하기](/ko/getting-started/cli/) |
| Node.js / Electron 프로그램을 작성 중이며, 에이전트를 내 프로세스에 내장하고 싶다 | `@tansr/sdk` | [Node SDK 5분 안에 실행하기](/ko/getting-started/sdk/) |
| 내 모바일 / 웹 사용자에게 에이전트를 제공하고 싶고, 다중 사용자 백엔드가 필요하다 | `@tansr/serve` 자체 호스팅 세션 서비스 | [세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/) |
| Android 앱을 작성 중이며, 백엔드는 `@tansr/serve`를 사용한다(사용할 예정이다) | Kotlin SDK `com.tansr.sdk`(0.4.0) | [Android와 iOS 5분 안에 실행하기](/ko/getting-started/android/) |
| iOS / macOS 앱을 작성 중이며, 백엔드는 위와 같다 | Swift 바이너리 패키지 `tansr-ios-spm`(0.3.0) | 같은 문서의 "iOS도 같은 방법" 절 |
| 네이티브 HarmonyOS 앱을 작성 중이며, 백엔드는 위와 같다 | ArkTS HAR `@tansr/harmony` | [HarmonyOS SDK 5분 안에 실행하기](/ko/getting-started/harmony/) |

경험 법칙은 두 가지입니다.

- **혼자 쓸 거면 CLI, 다른 사람에게 제공할 거면 SDK나 세션 서비스.** CLI는 개발자 본인을 위한 것이고, SDK와 세션 서비스는 당신 제품의 사용자를 위한 것입니다.
- **모바일은 반드시 당신의 서버를 거칩니다.** Android / iOS / HarmonyOS SDK는 얇은 프로토콜 클라이언트로, 플랫폼 자격 증명을 전혀 가지지 않습니다. 에이전트 커널은 당신이 배포한 `@tansr/serve` 안에서 실행됩니다. Android 호환 스택만 있는 이전 HarmonyOS 기기는 계속 Android SDK를 사용합니다.

## 여섯 가지 길이 공유하는 계정 모델

어떤 길을 택하든 자격 증명은 세 층으로 나뉘며, 아래로 갈수록 밖으로 새면 안 됩니다.

1. **개인 액세스 토큰(PAT)**: 콘솔에서 만들고, `tansr init`으로 로컬 CLI에 로그인할 때만 사용합니다. 당신 본인을 나타냅니다.
2. **앱 키(appid / appkey)**: 콘솔에서 "앱" 하나에 대해 발급합니다. appkey는 당신의 서버 쪽(Node 프로세스 또는 `@tansr/serve`)에만 둘 수 있으며, 최종 사용자를 위한 단기 토큰을 발급하는 데 사용합니다. **appkey는 단말 기기에 배포하지 않고, 로그에 남기지 않고, 저장소에 넣지 않습니다.**
3. **단기 app_user 토큰**: 당신의 서버가 appkey로 발급해 단말(Electron 메인 프로세스 또는 `@tansr/serve` 내부)에 전달합니다. 만료되면 무효화되며, 유출되더라도 영향 범위는 TTL로 제한됩니다.

CLI 사용자는 1층만 필요합니다. SDK와 세션 서비스 개발자는 2층과 3층이 필요합니다. 보관 위치와 교체의 세부 사항은 [보안과 개인정보](/ko/security/)를 참고하세요.

## 모든 빠른 시작은 같은 뼈대

형태별 문서 다섯 편(Android와 iOS는 한 편으로 합쳤고, HarmonyOS는 따로 한 편입니다)은 같은 순서로 전개되므로 형태 간에 대조하기 쉽습니다.

1. **전제 조건**: 실행 환경과 버전 요구 사항(Node ≥ 22.19가 공통 기준선).
2. **설치**: `npm i -g @tansr/cli`, `npm install @tansr/sdk`, `npm install @tansr/serve`, 또는 Maven / SwiftPM / 독립 배포 HAR 좌표.
3. **자격 증명**: 그 형태에 어느 층의 자격 증명이 필요하고, 어디에서 얻는지.
4. **첫 세션**: 실행되는 가장 짧은 코드.
5. **이벤트 보기**: 에이전트의 출력은 모두 이벤트 스트림(`msg.text.delta`, `tool.completed` 등)입니다. 이 단계에서 직접 눈으로 확인합니다.
6. **다음 단계**: 해당 심화 가이드로 안내.

## 실행 환경 요약표

| 형태 | 최소 요구 사항 |
|---|---|
| CLI | npm 패키지는 Node.js ≥ 22.19가 필요하며 Windows / macOS / Linux 지원. 단일 파일 실행 파일(SEA)은 런타임을 내장하며 현재는 Linux x64 / arm64용만 제공 |
| `@tansr/sdk` | Node.js ≥ 22.19. Electron ≥ 39. ESM only. TypeScript target ≥ ES2022 |
| `@tansr/serve` | Node.js ≥ 22.19. 서드파티 런타임 의존성은 `zod` 하나뿐 |
| Android SDK | minSdk 26. Kotlin 코루틴 + kotlinx.serialization + OkHttp |
| iOS SDK | iOS 16+ / macOS 13+. SwiftPM |
| HarmonyOS SDK | HarmonyOS 6.0 / API 20. Stage 모델. 독립 배포 HAR `@tansr/harmony` 0.1.0 |

## 한 번 실행한 뒤 다음에 읽을 것

| 알고 싶은 것 | 갈 곳 |
|---|---|
| 세션을 어떻게 영구 저장하고, 연결이 끊긴 뒤 어떻게 복구하는가 | [체크포인트와 재개](/ko/sdk/checkpoints/)(SDK) · [v2 프로토콜과 webhook](/ko/serve/v2-and-webhooks/)(세션 서비스) |
| 플랫폼이 내 앱에 어떤 기능을 배포하는지, 콘솔에서 어떻게 전환하는지 | [플랫폼 어셈블리와 번들](/ko/sdk/platform-bundle/) |
| 어떤 오류 코드의 의미, 재시도할 수 있는지 | [오류 처리와 재시도](/ko/sdk/errors-and-retries/) · [오류 코드 표](/errors/codes) |
| 서버 배포, 정상 종료, 다중 레플리카 샤딩 | [배포와 인증](/ko/serve/deploy-and-auth/) |
| 세션 서비스의 HTTP 표면(`/api`)을 직접 호출하거나 직접 클라이언트를 작성하고 싶다 | [통합 API(/api)](/ko/unified-api/) |
| 코딩 도우미가 내 설명대로 실행되는 제품을 만들게 하고 싶다(`@tansr/skill` 0.1.6) | [코딩 도우미로 제품 만들기](/ko/getting-started/skill/) |
| 형태를 왜 나누는지, 두 단계와 계획이 각각 무엇을 뜻하는지 | [기술 입장](/ko/getting-started/principles/) |
| SDK 2.0 확장 진입점(아카이브 호스트, 캐시 호스트, 통합 API) 중 어디까지 정식 출시되었는가 | [SDK 2.0 확장 진입점](/ko/sdk/sdk2-preview/) |
| 세션은 언제까지 보존되고 언제 회수되는가 | [보존 기간과 거버넌스](/ko/serve/retention-and-governance/) |
| CLI 설정 파일은 어디에 있고, `tansr doctor` 출력을 어떻게 읽는가 | [설정과 doctor](/ko/cli/settings-and-doctor/) |
| 데이터는 어디에 저장되고, 키는 어떻게 교체하며, 통신은 어디로 향하는가 | [보안과 개인정보](/ko/security/) |

## 문제가 생겼을 때

- CLI 쪽에서는 먼저 `tansr doctor`를 실행하세요. 네트워크를 쓰지 않는 어셈블리 자가 점검입니다. 읽는 법은 [문제 해결](/ko/support/troubleshooting/)을 참고하세요.
- 모든 오류에는 안정적인 기계 판독 코드가 있으며, [오류 코드 표](/errors/codes)에서 코드로 의미를 찾을 수 있습니다.
- 계정, 키, 플랜 문제는 [계정과 결제](/ko/support/account/)로. 해결되지 않으면 [지원팀에 문의](/ko/support/contact/)하세요.
