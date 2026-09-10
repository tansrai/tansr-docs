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
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:CHANGELOG.md
lastVerified: '2026-09-10'
---

`tansr`는 개발자를 위한 에이전트 CLI입니다. 하나의 커널을 대화형 터미널(TUI), 헤드리스 스크립트(headless), 상주 서비스(serve), 편집기 에이전트(acp), MCP 도구 서비스(mcp serve)의 다섯 가지 형태로 제공합니다. 이 문서는 가장 짧은 경로만 갑니다: 설치하고, 로그인하고, 한마디 대화하고, 이벤트 스트림을 한 번 봅니다.

## 전제 조건

- Node.js ≥ 22.19(npm 패키지 형태). 단일 파일 실행 파일(SEA)은 Node 런타임을 내장하므로 미리 설치할 필요가 없습니다.
- Windows / macOS / Linux를 모두 지원합니다. Windows에서는 Windows Terminal을 권장합니다. 기존 conhost에서는 자동으로 ASCII 글리프 단계로 전환되며, 기능에는 영향이 없습니다.

## 설치

npm 형태(권장):

```bash
npm i -g @tansr/cli
tansr --version
```

패키지 이름은 `@tansr/cli`, 명령 이름은 `tansr`입니다.

단일 파일 형태: 공식 배포 지점에서 해당 플랫폼의 실행 파일(`tansr-sea-win32-x64.exe` 같은 이름)을 내려받고, `SHA256SUMS`를 검증한 뒤 PATH에 넣으면 됩니다.

```text
https://bash.tansr.com/release/stable/tansr-sea-win32-x64.exe
https://bash.tansr.com/release/stable/SHA256SUMS
```

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
- 다른 사람도 당신의 에이전트를 쓰게 하고 싶나요? [세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/)를 보세요.
