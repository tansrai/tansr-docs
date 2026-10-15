---
title: 코딩 도우미로 제품 만들기
description: 공개된 @tansr/skill 0.1.6을 Codex, Cursor 같은 코딩 도우미에 설치하고 제품을 한 번 설명하면, 도우미가 화면, 업무 도구, Tansr 연결을 만듭니다. 설치는 계정을 만들지 않고, 모델을 호출하지 않으며, 앱을 배포하지 않습니다.
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/serve
  - unified-api/clients
  - security
lastVerified: '2026-10-13'
---

Tansr Skill은 코딩 도우미에 넣는 개발 안내입니다. 앱 런타임의 스킬이 아니고 `@tansr/sdk`도 아닙니다. 만들 제품을 적으면 도우미가 그 안내에 따라 실행되는 화면, 업무 데이터, Tansr 연결을 만듭니다. 설치만으로 플랫폼 계정이 생기지 않고, 모델을 부르지 않으며, 앱을 배포하지 않습니다.

npm의 공개 패키지는 `@tansr/skill` **0.1.6**입니다(2026-10-09부터 `latest`와 `next`가 모두 이것을 가리킵니다). 패키지 안에 .NET, Go, Rust, Python, C++ 참고가 있습니다. 공개 패키지 버전은 이 사이트의 [언어별 클라이언트](/ko/unified-api/clients/)를 따르세요. `0.1.5`는 파일을 쓰기 전에 `INVALID_RELEASE`로 끝나고 폐기 표시가 있으니 설치하지 마세요. `0.1.4`는 `latest`로 배포되지 않았습니다.

## 설치

Node.js 22.19 이상과 npm이 필요합니다. 제품을 만들 디렉터리에서 실행합니다. 예는 Codex의 프로젝트 범위입니다. 도우미를 바꿀 때는 `--host`만 바꾸고, 모든 프로젝트에서 쓰려면 `project`를 `user`로 바꿉니다.

```sh
npx --yes @tansr/skill@0.1.6 hosts
npx --yes @tansr/skill@0.1.6 preview --host codex --scope project
npx --yes @tansr/skill@0.1.6 install --host codex --scope project --yes
```

먼저 `preview`가 쓸 경로를 확인합니다. 충돌이 있으면 기존 내용을 남깁니다. 고른 한곳만 설치합니다.

| 도우미 | `--host` | 프로젝트 | 사용자 |
|---|---|---|---|
| Codex | `codex` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |
| WorkBuddy | `workbuddy` | `.codebuddy/skills/tansr` | `~/.workbuddy/skills/tansr` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/tansr` | `~/.codebuddy/skills/tansr` |
| Claude Code | `claude-code` (별칭 `claude`) | `.claude/skills/tansr` | `~/.claude/skills/tansr` |
| Cursor | `cursor` | `.cursor/skills/tansr` | `~/.cursor/skills/tansr` |
| TRAE 중국판 | `trae` | `.trae/skills/tansr` | `~/.trae-cn/skills/tansr` |
| TraeCode CLI | `trae-cli` | `.traecli/skills/tansr` | `~/.traecli/skills/tansr` |
| Qoder 국제판 | `qoder` | `.qoder/skills/tansr` | `~/.qoder/skills/tansr` |
| Qoder 중국판 | `qoder-cn` | `.lingma/skills/tansr` | `~/.lingma/skills/tansr` |
| ZCode | `zcode` | 지원 안 함 | `~/.zcode/skills/tansr` |
| Kimi Code | `kimi` | `.kimi-code/skills/tansr` | `~/.kimi-code/skills/tansr` |
| MiniMax Code CLI | `minimax` | `.minimax/skills/tansr` | `~/.minimax/skills/tansr` |
| Qwen Code | `qwen-code` | `.qwen/skills/tansr` | `~/.qwen/skills/tansr` |
| 공통 디렉터리 | `generic` | `.agents/skills/tansr` | `~/.agents/skills/tansr` |

`generic`은 Codex와 같은 디렉터리입니다. 모든 도우미에 넣는다는 뜻이 아닙니다. WorkBuddy와 CodeBuddy는 프로젝트 디렉터리가 같고 사용자 디렉터리는 다릅니다. 설치기는 이전 사용자 디렉터리를 자동으로 옮기지 않습니다. ZCode는 사용자 디렉터리만 받습니다. `feishu`, `yuanbao`, `doubao`, `volcengine`, `trae-global`은 디렉터리 설치를 하지 않습니다. 쓰기에 성공해도 도우미가 불러왔다는 뜻은 아닙니다. 설치 후 그 도우미에서 `SKILL.md`를 읽는지 확인하세요.

Kimi 프로젝트 설치는 Git 루트에서 실행합니다. 설정 루트, 환경 변수, 다시 불러오기는 패키지 안의 도우미 설명을 따릅니다.

## 제품 설명

같은 도우미로 돌아가 누가 쓰는지, 입력이 무엇인지, 어떤 동작으로 끝나는지 적습니다. 예:

> Tansr Skill로 Windows에서 동작하는 학습 계획 도우미를 만들어 주세요. 목표 기록, 매일 일정, 돌아보기가 되게 하고, 먼저 실행되는 첫 버전과 실제 도구 실행의 진행과 결과를 보여 주세요.

이미 있는 프로젝트는 기술 구성, 로그인, 데이터베이스, 잠금 파일을 유지합니다.

> Tansr Skill로 현재 주문 시스템에 자연어 조회를 추가해 주세요. 현재 로그인과 데이터베이스, 내가 이미 고친 내용은 남겨 주세요.

돌려받을 것은 실행되는 화면과 업무 결과입니다. 채팅 답변이나 SDK 조각만으로는 부족합니다. 평범한 한 문장도 유효한 요청이며, 플랫폼이나 절차 지시를 먼저 적을 필요는 없습니다. 제품에 로컬 백엔드가 필요하면 프로젝트에 이미 있는 통제된 백엔드를 재사용합니다. 없을 때만 Skill에 들어 있는 시작 자산으로 `serve` 또는 token-server를 만들고, 연결한 뒤 이 컴퓨터에서 띄웁니다. 이것은 플랫폼 계정을 만들지 않고, 유료 호출을 하지 않으며, 공개 인터넷에 배포한 것도 아닙니다. Electron의 전체 SDK는 계속 메인 프로세스에 있습니다. 앱 키는 서버에 둡니다. `appkey`를 채팅에 붙여 넣지 마세요. 플랫폼 연결은 [Node SDK 5분 안에 실행하기](/ko/getting-started/sdk/)와 [세션 서비스 5분 안에 실행하기](/ko/getting-started/serve/)를 보세요. .NET, Go, Rust, Python, C++ 제품은 [언어별 클라이언트](/ko/unified-api/clients/)에 공개되었다고 적힌 패키지를 고정합니다. Node로 다시 쓰거나, 모바일 Maven, SPM, HAR로 대신하지 마세요.

## 확인, 업데이트, 제거

`--host`와 `--scope`는 설치할 때와 같은 쌍으로 둡니다.

```sh
npx --yes @tansr/skill@0.1.6 status --host codex --scope project
npx --yes @tansr/skill@0.1.6 update --host codex --scope project --yes
npx --yes @tansr/skill@0.1.6 rollback --host codex --scope project --yes
npx --yes @tansr/skill@0.1.6 uninstall --host codex --scope project --yes
```

`status`는 파일만 봅니다. 도우미가 불러왔다는 증거가 아닙니다. `rollback`은 기록된 이전 버전으로 돌아갑니다. 제거해도 직접 고친 파일, 다른 스킬, 이미 만든 제품은 남습니다. 설치가 중간에 끊기면 먼저 `status`를 보고, 같은 대상에 `recover --yes`를 실행합니다.
