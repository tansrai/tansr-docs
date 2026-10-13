---
title: 'CLI 5분 안에 실행하기'
description: 'tansr CLI를 설치하고, 개인 액세스 토큰으로 플랫폼에 로그인하고, 첫 대화형 세션을 시작하고, 헤드리스 모드에서 NDJSON 이벤트 스트림을 확인합니다.'
zone: docs
category: getting-started
related:
  - cli/settings-and-doctor
  - cli/commands
  - support/troubleshooting
  - support/account
  - serve/deploy-and-auth
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
  - tansr-cli:doc/report/REL-SEA-发行执行单-2026-10-05.md
lastVerified: '2026-10-13'
---

`tansr`는 개발자를 위한 에이전트 CLI입니다. 하나의 커널을 대화형 터미널(TUI), 헤드리스 스크립트(headless), 상주 서비스(serve), 편집기 에이전트(acp), MCP 도구 서비스(mcp serve)의 다섯 가지 형태로 제공합니다. 이 문서는 가장 짧은 경로만 갑니다: 설치하고, 로그인하고, 한마디 대화하고, 이벤트 스트림을 한 번 봅니다. 현재 버전은 **0.10.3**(npm `@tansr/cli`, 2026-10-10 공개. 0.10.2 / 0.10.3은 새 `@tansr/serve`를 인라인했을 뿐이며 명령, 플래그, ACP 면은 0.10.1과 같습니다)입니다.

## 전제 조건

- Node.js ≥ 22.19(npm 패키지 형태). 단일 파일 실행 파일(SEA, Node 런타임 내장)은 현재 Linux x64 / arm64 두 가지만 있습니다. 아래를 참고하세요.
- Windows / macOS / Linux를 모두 지원합니다. Windows에서는 Windows Terminal을 권장합니다. 기존 conhost에서는 자동으로 ASCII 글리프 단계로 전환되며, 기능에는 영향이 없습니다.

## 설치

```bash
npm i -g @tansr/cli
tansr --version          # 0.10.3
```

패키지 이름은 `@tansr/cli`, 명령 이름은 `tansr`입니다. 업그레이드도 똑같이 `npm i -g @tansr/cli@latest`로 합니다. 0.10.1부터 설치한 각 버전의 첫 시작 때 사용자 캐시 디렉터리에 약 2 MB의 Node 컴파일 캐시를 씁니다(같은 버전의 이후 시작이 빨라집니다. `TANSR_COMPILE_CACHE=0`으로 끌 수 있으며, [설정과 doctor](/ko/cli/settings-and-doctor/)를 참고하세요).

**단일 파일 형태(SEA): Linux 두 가지가 공개되어 있습니다.** 공식 배포 지점 `https://bash.tansr.com`의 `stable` 채널은 2026-10-05부터 `tansr-sea-linux-x64`와 `tansr-sea-linux-arm64`(glibc ≥ 2.28)를 제공하며, 현재 0.10.3(2026-10-10, npm 패키지와 같은 소스로 빌드)입니다. Windows 빌드는 코드 서명 인증서가 마련될 때까지 올리지 않고, macOS 빌드는 Apple 개발자 인증서와 공증을 기다리며, musl / alpine은 SEA 약속 범위 밖입니다. 이런 플랫폼에서는 npm 패키지를 쓰세요. 설치는 "다운로드 → 검증 → 배치" 3단계 스크립트로 하며, 먼저 내려받아 검토한 뒤 실행합니다:

```bash
curl -fsSLO https://bash.tansr.com/install.sh
sh install.sh            # 可选参数 stable|beta;缺省落位 ~/.local/bin/tansr
```

스크립트는 채널의 `SHA256SUMS`와 실측 해시를 비교해 다르면 파일을 지우고 설치를 거부합니다. `TANSR_INSTALL_DIR` / `TANSR_CHANNEL`로 기본값을 덮어쓸 수 있습니다. SEA로 설치한 뒤의 `tansr update`(`--install`을 붙여야 설치)는 기본으로 배포 지점의 서명 봉투 `release/{channel}/sea/latest.signed.json`을 읽어 내장 공개 키(`release-signing-v1`)로 검증한 뒤 버전을 비교합니다. npm으로 설치한 경우의 `tansr update`는 npm 레지스트리를 조회하며 이 경로를 쓰지 않습니다.

## 자격 증명: 개인 액세스 토큰으로 로그인

CLI는 **플랫폼 모드**로 동작합니다. 로그인하면 모델 목록과 가격표는 플랫폼이 배포하므로, provider 설정을 손으로 작성할 필요가 없습니다.

1. 콘솔에서 개인 액세스 토큰(PAT)을 만듭니다.
2. 초기화 마법사를 실행하고, 안내에 따라 PAT를 붙여 넣습니다(마스크 입력, 에코되지 않음).

```bash
tansr init
```

마법사는 신원을 확인하고, 이 컴퓨터를 위한 앱 자격 증명을 파생하고, 그 자격 증명을 운영 체제 키체인에 기록하고(사용할 수 없으면 권한 0600 파일로 폴백하며 명확히 알림), 마지막으로 요약 카드를 보여 줍니다: 계정 지문, 잔액, 최근 사용량, 사용 가능한 모델 수, 파생 키 유효 기간. 이 과정에서 모델 호출은 없으며, 반복 실행할 수 있습니다.

스크립트나 CI에서 상호 작용 없이 실행하려면:

```bash
TANSR_PAT=<PAT> tansr init
```

`tansr init --pat <PAT>`로도 값을 직접 줄 수 있지만, shell 기록에 남으므로 권장하지 않습니다.

로그아웃은 `tansr logout`입니다. 이 컴퓨터의 자격 증명을 지우고 이 컴퓨터의 파생 키를 최대한 비활성화합니다. PAT 자체는 폐기되지 않습니다(다른 기기가 아직 사용 중일 수 있습니다).

## 첫 세션

`tansr`를 그대로 실행하면 대화형 터미널로 들어갑니다.

```bash
tansr
```

시작하면 환영 배너와 "기본 설정 요약"(로그인 신원, 포털 주소, 현재 모델, 컨텍스트 스킴, 잔액)이 출력됩니다. 입력 영역에 글자를 치고 Enter를 누르면 대화할 수 있습니다. `@`로 작업 공간 파일을 참조하고, `/`로 슬래시 명령을 호출합니다. 첫날부터 쓰게 될 명령 몇 가지:

| 명령 | 역할 |
|---|---|
| `/help` | 모든 명령 나열 |
| `/status` | 버전 / 언어 / 세션 / 모델 |
| `/model` | 모델 선택기를 열거나, `/model <별칭>`으로 바로 전환 |
| `/cost` `/usage` | 이 세션의 비용과 token 사용량 |
| `/doctor` | 어셈블리 상태 자가 점검 |
| `/quit` | 종료 |

Esc는 현재 턴을 중단하고, Ctrl+T는 전체 화면 트랜스크립트 뷰로 들어가며, Ctrl+C도 중단입니다.

## 이벤트 보기

헤드리스 모드에서는 모든 것이 이벤트입니다. `-p`에 prompt 한 문장을 주고 `--json`을 붙이면 한 줄에 JSON 하나인 NDJSON 이벤트 스트림을 얻습니다. 스트림 끝에는 항상 `type: "result"` 요약 한 건이 있습니다.

```bash
tansr -p "用一句话介绍这个目录" --json
```

```json
{"type":"result","reason":"completed","exitCode":0,"usage":{"inputTokens":1200,"outputTokens":300}}
```

이벤트 봉투 필드는 `type` / `sessionId` / `seq` / `ts` / `v` / `source`입니다. 주요 이벤트 패밀리는 `session.*`, `turn.*`, `msg.*`, `tool.*`, `agent.*`, `hook.*`, `cost.*`, `mcp.*`, `plan.*`입니다. 종료 코드의 의미: 0 성공, 1 모델 또는 내부 오류, 2 중단, 3 상한 도달(턴 수 / 예산), 4 prompt가 너무 김, 5 사용법 오류.

Node로 이 스트림을 소비하는 데는 몇 줄이면 됩니다.

```js
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';

const child = spawn('tansr', ['-p', '总结本仓库', '--json'], { stdio: ['ignore', 'pipe', 'inherit'] });
for await (const line of createInterface({ input: child.stdout })) {
  const ev = JSON.parse(line);
  if (ev.type === 'msg.text.delta') process.stdout.write(ev.text);
  if (ev.type === 'result') console.log('\n退出码:', ev.exitCode, '原因:', ev.reason);
}
```

헤드리스 모드에는 질문 채널이 없습니다. 권한 판정이 "질문"에 이르면 일괄 거부로 폴백합니다(fail-closed). 권한을 열어야 하면 `--allowedTools "Shell(git *),Read"` 같은 세션 수준 규칙을 쓰거나, `--permission-mode`로 초기 모드를 지정하세요.

## 처음 흔히 걸리는 문제

| 현상 | 처리 |
|---|---|
| "TUI에는 대화형 터미널(TTY)이 필요합니다" | 파이프 안에서 `tansr`를 시작했습니다. 비대화형 상황에서는 `-p`를 사용 |
| 초기화하지 않고 바로 시작 | 빈 상태 안내 카드로 들어갑니다. 그 자리에서 `/init`을 입력하면 로그인할 수 있습니다. 무인 형태에서는 종료 코드 5로 종료하며 `tansr init`을 안내 |
| 잔액이 0 | 요약 카드가 경고하지만 차단하지는 않습니다. 플랫폼 모델 호출은 서버 쪽 과금 게이트가 거부하며, 로컬 기능에는 영향이 없음 |
| 플랫폼을 전혀 쓰고 싶지 않음 | `TANSR_ESCAPE_LOCAL=1`을 설정하고, 사용자 매뉴얼에 따라 `.tansr/settings.json`에 로컬 provider를 설정 |

## 다음 단계

- [설정과 doctor](/ko/cli/settings-and-doctor/): 5층 설정, 자주 쓰는 환경 변수, `tansr doctor`의 각 섹션을 읽는 법.
- [명령과 플래그 참조](/cli/commands): 모든 하위 명령과 플래그.
- 다른 사람도 당신의 에이전트를 쓰게 하고 싶나요? [세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/)를 보세요. CLI 형태의 `tansr serve --v2`는 0.10.0부터 통합 호출 표면 `/api`도 함께 마운트합니다(새 통합은 이쪽으로). `--v2` 배포에서는 `/v1` 표면이 기본적으로 꺼지며, 전환용 플래그 `--legacy-v1`은 0.10.1부터 사용 중단 예정입니다. 0.10.2부터는 환경 변수 `TANSR_SERVE_LEGACY_PREFIX`(기본값 `readwrite`, 0.10.3에서도 변동 없음)로 구 `/v2`, `/v3/*` 접두사의 퇴역 창을 제어할 수 있습니다. 자세한 내용은 [배포와 인증](/ko/serve/deploy-and-auth/)을 참고하세요.
