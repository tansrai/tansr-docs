---
title: 체크포인트와 재개
description: 세션이 재시작을 넘어 살아남게 하기——SessionStore와 resume, rewritten 시 볼륨 전체 교체 규율, 수동 압축과 컨텍스트 스냅숏(checkpoint / restore), 기록 페이징, 그리고 fork와 스냅숏 내보내기 / 가져오기.
zone: docs
category: sdk
related:
  - sdk/sessions-and-events
  - sdk/errors-and-retries
  - serve/retention-and-governance
  - security
sources:
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/sdk/CHANGELOG.md
  - tansr-cli:packages/server/CHANGELOG.md
lastVerified: '2026-10-13'
---

세션은 기본적으로 메모리 안에만 있습니다. 프로세스 재시작 후에도 이어서 대화하려면 두 가지가 필요합니다. `SessionStore`(어디에 저장할지)와 `createSession`의 `store` / `resume` 두 필드(언제 저장하고 언제 꺼낼지)입니다. 컨텍스트 압축 뒤에는 원문이 기록에 남지 않으므로 스냅숏(checkpoint)도 있습니다. 어느 시점의 완전한 컨텍스트를 자체 완결된 읽기 전용 사본으로 담은 것으로, 열거 · 복구 · 삭제가 가능합니다.

## SessionStore와 resume

```ts
import { createFileSessionStore, createSession } from '@tansr/sdk';

const store = createFileSessionStore({ dir: app.getPath('userData') }); // 目录显式传,恒不隐式扫用户目录

// 落卷:store 在场即自动接管「会话登记 + 每轮落卷」
const session = await createSession({ token, baseUrl, store });
session.send('记住:发射码是 7-4-1');
await session.idle();
const savedId = session.sessionId; // 逻辑会话 id(UUID 形制),跨重启凭它取回

// 进程重启后:resume 一等恢复(取回历史 + 配对治理 + 预载)
const resumed = await createSession({
  token, baseUrl,
  resume: { sessionId: savedId, store }, // 只恢复;要继续落卷,store 字段同时传
  store,
});
resumed.send('复述发射码'); // 前文事实已在上下文

// 枚举与删除经 store 接口面(list 只有元数据,没有内容)
const sessions = await store.list({ limit: 20 }); // SessionRecordMeta[]
await store.delete(savedId);
```

의미론의 요점:

- **resume은 항상 구조화된 오류를 냅니다**: 대상이 없으면 `session_not_found`를 throw하고, 저장소 손상(중간의 깨진 줄 / 해시 체인 단절 / 깨진 payload)이면 `session_store_corrupted`를 throw합니다. 조용히 빈 세션을 시작하는 일은 결코 없습니다.
- **페어링 거버넌스 내장**: 복구 시 꼬리가 끊긴 `tool_call`에는 isError 자리표시자를 보충하고 고아 `tool_result`는 깨끗한 경계까지 잘라 내므로, 복구한 기록을 그대로 모델에 보내도 400이 나지 않습니다. `initialMessages`의 저수준 재주입 경로는 거버넌스를 거치지 **않습니다**.
- **크래시 자가 복구**: `FileSessionStore`는 커널의 journal 원시 기능(해시 체인 / 크래시 시 잘라 내기 복구 / 파일 잠금)을 물려받아 정전으로 반 줄만 쓰인 경우 자동으로 잘라 내며 손상으로 치지 않습니다.
- **플랫폼 그림자**(토큰 방식): 각 세션은 플랫폼 세션 ULID 하나를 발급해 요청에 실어 보내며, 매핑은 `SessionRecordMeta.platformSessionId`에 저장됩니다. resume 시 같은 것을 재사용해 캐시 친화성이 재시작을 넘어 이어집니다. 플랫폼 쪽 임대 = 30일 비활성 창이며 대화 활동이 있으면 암묵적으로 연장됩니다.

"먼저 재개하고, 재개할 수 없을 때만 새로 만든다"의 표준 작성법:

```ts
import { TansrSdkError, createFileSessionStore, createSession } from '@tansr/sdk';

async function openOrResume(lastId: string | undefined) {
  if (lastId === undefined) return createSession({ token, baseUrl, store });
  try {
    return await createSession({ token, baseUrl, store, resume: { sessionId: lastId, store } });
  } catch (e) {
    // 只有「确实不在 store」才新建;session_store_corrupted 等恒上抛
    if (e instanceof TansrSdkError && e.code === 'session_not_found') return createSession({ token, baseUrl, store });
    throw e;
  }
}
```

## 자체 저장소: 5메서드와 두 가지 규율

`SessionStore`의 5메서드 `create` / `get` / `list` / `commit` / `delete`를 구현하면 주입할 수 있습니다(SQLite, IndexedDB 메인 프로세스 프록시, 여러분 자신의 서버 쪽도 같은 형태). 규율은 두 가지:

1. `commit`이 `rewritten = true`를 받으면 반드시 **볼륨 전체를 교체**해야 하며 길이로 증분 추가해서는 안 됩니다——압축 접기나 스냅숏 복구는 기록의 앞부분을 제자리에서 다시 씁니다.
2. 손상은 항상 구조화해서 throw하고 침묵하지 않습니다.

선택 멤버가 둘 있습니다. `getHistoryPage?(sessionId, { offset, limit })`(페이징 읽기, 없으면 전량 슬라이스로 폴백)와 `checkpoints?: CheckpointStore`(세션과 같은 생명주기의 스냅숏 저장소, 없음 = 스냅숏 미연결)입니다.

**첨부 파일 수용 상태의 콜드 복구**(`@tansr/sdk` 0.18.0부터, 2026-10-02 공개): Store는 선택적 기능 플래그 `attachmentCheckpoints: true`를 선언해 `commit`의 `meta.attachmentCheckpoint`(SDK가 생성하는 불투명 값)를 `messages`와 같은 회차에 원자적으로 저장하고 `get()`에서 그대로 돌려주겠다고 약속할 수 있습니다. `resume`은 이후 첨부 파일 수용 상태(누적 주입 바이트 / 거부 횟수 / 항목)를 기록과 함께 콜드 복구합니다. Store가 이번 기록을 실제로 복구했다면 레코드에 `attachmentReferencesInvalidated: true`를 두고, SDK는 이를 근거로 첨부 파일 참조를 무효화하되 누적 수용 예산은 보존합니다. 내장 `createFileSessionStore`는 구현되어 있습니다. 이 플래그를 **선언하지 않는** 사용자 정의 5메서드 Store의 동작은 0.17과 같습니다(콜드 복구 시 보수적으로 참조를 무효화하고 빠진 상태를 지어내지 않음). 구현 쪽은 이 값을 해석 · 구성하거나 클라이언트 메타데이터로 대체해서는 안 됩니다.

## 파일 배치와 세그먼트 봉인

`createFileSessionStore({ dir, segmentation? })`는 `<dir>/sessions/<sessionId>/` 아래에 `journal.jsonl`(활성 세그먼트) + `meta.json` + `attachments/`를 씁니다. 긴 세션은 임계값에 따라 동적으로 `segments/000001.jsonl…` + `manifest.json`으로 봉인됩니다(기본값 16 MiB / 5000 레코드에서 활성화, `segmentation: { enabled: false }`면 항상 단일 볼륨). 옛 디렉터리(manifest 없음)는 마이그레이션 없이 읽을 수 있습니다. 볼륨 전체 교체는 항상 단일 활성 세그먼트로 돌아가며 **압축 전 메시지가 되살아나는 일은 없습니다**. 교체 도중 크래시가 나도 다음 접근에서 자동으로 보완되어 반쪽짜리 볼륨이 보이는 일은 없습니다.

스냅숏 디렉터리는 셋 중 하나이며 기본값도 항상 명시적입니다. 없음 = 세션과 함께 사는 `<sessionDir>/checkpoints/`(`store.delete`와 함께 사라짐). `checkpoints: { dir }` = 독립 디렉터리, 독립 생명주기. `checkpoints: { store }` = 자체 `CheckpointStore`(`put` / `get` / `list` / `delete` 4메서드).

**미디어 산출물과 저장소 버전 2**(`@tansr/sdk` 0.15.0 / `@tansr/serve` 0.10.0부터): 이미지 / 비디오 / 음성 도구의 산출물(`tool_result.artifact`)은 세션 기록과 함께 보존되고, 핫 / 콜드 복구와 체크포인트에서도 함께 보존되며, `resume` 후 `SessionView`가 도구 카드 미리보기를 재구성할 수 있습니다(미리보기를 안전하게 복구할 수 없으면 `artifactUnavailable: true` 설정). 모델은 여전히 원래 `content`만 소비합니다. **처음으로 산출물을 쓴 세션 볼륨은 저장소 버전 2로 올라갑니다**. 옛 버전의 writer는 업그레이드된 디렉터리에 계속 쓸 수 없습니다——업그레이드 전에 백업하고, 같은 세션 저장소에 쓰는 모든 프로그램(SDK 호스트 / `tansr serve` / 명령줄)을 함께 업그레이드하세요. 옛 버전으로 되돌리려면 원래 백업을 쓰거나 독립 디렉터리로 바꿔야 합니다. 옛 순수 텍스트 기록에 미디어가 자동으로 보충되지는 않습니다.

**경계가 있는 내결함성 읽기**(0.15.0부터, 기본값 꺼짐): `createFileSessionStore({ recovery: { mode: 'verified-ir', quarantineDir?, onRecovery? } })`는 완전한 검증 체인 안에서 확실히 무효한 메시지 레코드를 격리하고, 원본 증거를 세션 디렉터리 밖(기본값은 같은 계층의 `.session-recovery-quarantine`)에 쓰며, `SessionRecoveryReport`(개수, 위치, 내용 지문, 본문 미포함)로 호스트에 콜백합니다. `onRecovery`가 throw하면 이번 읽기는 실패하며 조용히 강등되지 않습니다. 활성화 전에 `SESSION_RECOVERY_VERSION`으로 배포된 실행 패키지의 능력을 확인해 옛 패키지가 이 옵션을 조용히 무시하는 것을 막으세요. 기본값은 여전히 엄격한 읽기로, 손상은 항상 구조화해서 throw됩니다.

## 수동 압축과 스냅숏

```ts
const session = await createSession({
  token, baseUrl, store,
  checkpoints: { dir: path.join(app.getPath('userData'), 'checkpoints'), max: 20 },
});

// 手动快照(任何空闲时刻;运行中 throw turn_running)
const mark = await session.checkpoint({ label: 'before compaction' });
// → CheckpointMeta { checkpointId(ULID,时间有序), trigger: 'manual', label, messageCount, createdAt, cwd, model, … }

// 手动压缩:缺省先落 pre_compaction 快照,再把历史前缀折叠为摘要
const result = await session.compact({ instructions: 'keep the launch code' });
if (result.status === 'compacted') {
  console.log(result.compactionId, result.removedRange, result.checkpointId);
} else if (result.status === 'rejected') {
  console.log(result.reason); // 'turn_running' | 'empty_history' | 'not_configured' | 'hook_blocked'
} else {
  console.log(result.reason, result.checkpointId); // failed:已落的快照保留
}

for (const cp of await session.listCheckpoints()) console.log(cp.checkpointId, cp.trigger, cp.label, cp.messageCount);

// 恢复:同会话就地换史;缺省先落 pre_restore 快照
const restored = await session.restore(mark.checkpointId);
if (restored.status === 'restored') console.log(restored.fromMessages, '→', restored.toMessages, restored.preRestoreCheckpointId);

await session.deleteCheckpoint(mark.checkpointId); // 幂等
```

시그니처(옵션의 이름 붙은 타입 `CompactOptions` / `CheckpointOptions` / `RestoreOptions`는 제자리에 펼쳐 두었으며, 0.19.0은 0.18.x와 같습니다):

```ts
compact(options?: { instructions?: string; checkpoint?: boolean | { label?: string } }): Promise<CompactResult>;
checkpoint(options?: { label?: string }): Promise<CheckpointMeta>;
listCheckpoints(): Promise<CheckpointMeta[]>;
restore(checkpointId: string, options?: { checkpoint?: boolean }): Promise<RestoreResult>;
deleteCheckpoint(checkpointId: string): Promise<void>;
```

요점:

- **유휴기 의미론**: `compact` / `checkpoint` / `restore` / `deleteCheckpoint`는 실행 중에는 일률적으로 거부되고, 큐에 들어가지 않으며, 부작용이 0입니다——`compact()` / `restore()`는 결과 `rejected: 'turn_running'`으로 표현하고, `checkpoint()` / `deleteCheckpoint()`는 구조화해서 `turn_running`을 throw합니다. `await session.idle()` 후 재시도하세요.
- **스냅숏 스위치**: `compact({ checkpoint })`가 없으면 `checkpoints.autoBeforeCompact`(기본값 true)를 따릅니다. 턴 안의 자동 압축도 같은 설정에 따라 `pre_compaction` 스냅숏을 저장합니다. 미연결이면 `compact()`는 평소처럼 압축하되 스냅숏은 저장하지 않고, `restore()`는 `rejected: 'store_not_wired'`를 반환합니다.
- **실패 의미론**: `not_configured` = 압축이 꺼져 있거나 컨텍스트 창을 알 수 없음. `empty_history` = 기록이 비어 있음. `failed`는 커널의 원인(`nothing_to_compact` / `summary_malformed` / `model_error` / `before_compact_failed` …)을 동반하며 `turn.error(scope='compaction', recoverable)`로 관찰할 수 있고, 저장된 스냅숏은 남습니다.
- **복구**: 먼저 `sessionId` 대조를 하고(다른 세션의 스냅숏은 `session_mismatch`로 거부), 그다음 기록 전체를 교체하고 `session.restored`를 발행하며 store는 볼륨 전체 교체를 수행합니다. 같은 스냅숏을 연속으로 두 번 복구해도 두 번째 역시 볼륨을 교체합니다. 스냅숏의 `cwd` ≠ 세션의 `cwd`일 때는 cwd를 바꾸지 않고 `cwd_mismatch_on_restore` 알림을 보냅니다.
- **보존**: 기본값은 무제한. `checkpoints.max`에 이르면 시간순으로 가장 오래된 것부터 제거하며 trigger는 구분하지 않습니다. 스냅숏 파일은 항상 durable하게 씁니다(temp + fsync + rename).
- **이벤트 순서**: `session.checkpointed → session.compacted`. `session.checkpointed(pre_restore) → session.restored`.

## 기록 페이징

긴 세션의 UI가 한 번에 전량을 가져올 필요는 없습니다. `history({ offset, limit })`는 메시지 인덱스로 페이징하며 반환되는 슬라이스는 항상 페어가 완전합니다——시작점이 도구 호출 턴의 중간에 있으면 앞으로 맞추어 `offset`을 되채우고, 끝점은 뒤로 맞춥니다(`limit`은 하한).

```ts
let cursor = 0;
const first = await session.history({ offset: 0, limit: 50 });
while (cursor < first.total) {
  const p = await session.history({ offset: cursor, limit: 50 });
  render(p.messages);
  cursor = p.nextOffset; // 恒以 nextOffset 推进,不要用 offset + messages.length
}

const { total } = await session.history({ limit: 0 }); // 只取 total
const last = await session.history({ offset: Math.max(0, total - 50), limit: 50 }); // 尾页
```

휴면 세션(AgentSession을 시작하지 않은)에는 `readHistoryPage(store, sessionId, { offset, limit })`를 사용합니다. `createFileSessionStore`의 `getHistoryPage`는 세그먼트 매니페스트에 따라 건너뛰며 읽고, 비용은 꼬리 부분의 크기에 비례하며 볼륨의 총 길이와는 무관합니다.

## fork와 스냅숏 내보내기 / 가져오기

- `session.fork(checkpointId)`는 스냅숏에서 **새 세션을 키워 내며** 원본 세션은 전혀 바꾸지 않습니다. 새 레코드를 둘 세션 `store`가 필요하며 없으면 `session_store_not_wired`를 throw합니다.
- `exportCheckpoint(checkpointId)`는 자체 완결된 바이트열(형식 `tansr-checkpoint/1`, 이미지 첨부 파일은 인라인)을 만듭니다. `importCheckpoint(bytes)`는 format / schema / 첨부 파일 sha256 / 메시지 형태를 검증하며 하나라도 통과하지 못하면 `checkpoint_import_invalid`를 throw합니다. 변조는 즉시 거부, 디스크 쓰기 0. 가져온 것은 대상 세션에 귀속되며 바로 restore하거나 fork할 수 있습니다.

## 세션 서비스와의 관계

`@tansr/serve`의 `/v2` 표면에는 같은 기능 묶음의 HTTP 형태(`compact` / `checkpoints` / `restore` / `history` 페이징 / fork / export / import)가 있으며 의미론은 이 글과 일치합니다. 0.13.0부터 새 통합은 통합 호출 표면 `/api/sessions/**`를 통해 같은 작업 묶음을 호출하며 도메인 페이로드의 바이트는 바뀌지 않습니다. 서버 쪽의 세션 보존과 물리 삭제 정책은 [보존 기간과 거버넌스](/ko/serve/retention-and-governance/)를 참고하세요.

`@tansr/sdk` 0.18.0부터의 `@tansr/sdk/extensions` 하위 진입점은 별도로 **로컬 아카이브 호스트**(`createNodeArchiveHost`)를 제공합니다. 원래 `SessionStore` 바깥에서 세션에 영속 아카이브 인계와 선택적 자료 체인을 설치하고, `open` 후에도 원래 `AgentSession`을 반환하며, 이 페이지의 `store` / `resume` / 체크포인트 의미론은 바뀌지 않습니다. 이것은 백업도, 다중 기기 동기화도 아닙니다(저장 정책은 `single-authorized-source` 고정, `replication` / `synchronization`은 모두 `'none'`). [SDK 2.0 확장 진입점](/ko/sdk/sdk2-preview/)을 참고하세요.
