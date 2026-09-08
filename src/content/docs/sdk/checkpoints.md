---
title: 检查点与恢复
description: 让会话跨重启存活——SessionStore 与 resume、rewritten 整卷轮换纪律、手动压缩与上下文快照（checkpoint / restore）、历史分页，以及 fork 与快照导出导入。
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
lastVerified: '2026-09-08'
---

会话缺省只在内存里。要让它在进程重启后还能接着聊，你需要两件事：一个 `SessionStore`（存到哪），以及 `createSession` 的 `store` / `resume` 两个字段（什么时候存、什么时候取）。上下文压缩之后原文不再在历史里，所以又有了快照（checkpoint）：某时刻完整上下文的自包含只读拷贝，可列举、可恢复、可删除。

## SessionStore 与 resume

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

语义要点：

- **resume 恒结构化报错**：目标不存在抛 `session_not_found`；存储损坏（中段坏行 / 哈希链断裂 / 坏 payload）抛 `session_store_corrupted`。绝不悄悄起一个空会话。
- **配对治理内置**：恢复时断尾的 `tool_call` 补 isError 占位、孤儿 `tool_result` 截断到干净边界，恢复历史直送模型不会 400。`initialMessages` 低阶重灌径**不**过治理。
- **崩溃自愈**：`FileSessionStore` 继承内核 journal 原语（哈希链 / 崩溃截断修复 / 文件锁），断电半行自动截断，不算损坏。
- **平台影子**（令牌档）：每个会话铸一枚平台会话 ULID 随请求出线，映射落 `SessionRecordMeta.platformSessionId`;resume 时复用同一枚，缓存亲和跨重启延续。平台侧租约 = 30 天不活跃窗口，对话活动即隐式续租。

「先恢复，恢复不了才新建」的标准写法：

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

## 自建存储：五方法与两条纪律

实现 `SessionStore` 五方法 `create` / `get` / `list` / `commit` / `delete` 即可注入（SQLite、IndexedDB 主进程代理、你自己的服务端都同形）。两条纪律：

1. `commit` 收到 `rewritten = true` 必须**整卷轮换**，不得按长度增量追加——压缩折叠或快照恢复会就地改写历史前缀。
2. 损坏恒结构化 throw，不静默。

两个可选成员：`getHistoryPage?(sessionId, { offset, limit })`（分页读，缺席回落全量切片）与 `checkpoints?: CheckpointStore`（与会话同生命周期的快照存储，缺席 = 快照未接线）。

## 文件布局与封段

`createFileSessionStore({ dir, segmentation? })` 在 `<dir>/sessions/<sessionId>/` 下写 `journal.jsonl`（活段）+ `meta.json` + `attachments/`。长会话按阈值动态封段为 `segments/000001.jsonl…` + `manifest.json`（缺省 16 MiB / 5000 记录启用；`segmentation: { enabled: false }` 恒单卷）。旧目录（无 manifest）零迁移可读；整卷轮换恒回到单活段，**压缩前消息恒不复活**；轮换中途崩溃由下次访问自动补齐，恒不见半卷。

快照目录三选一，缺省一律显式：缺席 = 与会话同居 `<sessionDir>/checkpoints/`（随 `store.delete` 一并消失）；`checkpoints: { dir }` = 独立目录、独立生命周期；`checkpoints: { store }` = 自建 `CheckpointStore`（`put` / `get` / `list` / `delete` 四方法）。

## 手动压缩与快照

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

签名（逐字）：

```ts
compact(options?: { instructions?: string; checkpoint?: boolean | { label?: string } }): Promise<CompactResult>;
checkpoint(options?: { label?: string }): Promise<CheckpointMeta>;
listCheckpoints(): Promise<CheckpointMeta[]>;
restore(checkpointId: string, options?: { checkpoint?: boolean }): Promise<RestoreResult>;
deleteCheckpoint(checkpointId: string): Promise<void>;
```

要点：

- **空闲期语义**：`compact` / `checkpoint` / `restore` / `deleteCheckpoint` 在运行中一律拒绝、不排队、零副作用——`compact()` / `restore()` 以结果 `rejected: 'turn_running'` 表达，`checkpoint()` / `deleteCheckpoint()` 结构化 throw `turn_running`;`await session.idle()` 后重试。
- **快照开关**：`compact({ checkpoint })` 缺席按 `checkpoints.autoBeforeCompact`（缺省 true）；轮内自动压缩同样按它落 `pre_compaction` 快照。未接线时 `compact()` 照常压缩但不落快照，`restore()` 返回 `rejected: 'store_not_wired'`。
- **失败语义**：`not_configured` = 压缩关闭或上下文窗口未知；`empty_history` = 历史为空；`failed` 携内核原因（`nothing_to_compact` / `summary_malformed` / `model_error` / `before_compact_failed` …），经 `turn.error(scope='compaction', recoverable)` 可观测，已落的快照保留。
- **恢复**：先做 `sessionId` 对账（别的会话的快照拒 `session_mismatch`），再整体替换历史并签发 `session.restored`,store 走整卷轮换。同一快照连续恢复两次，第二次仍换卷。快照 `cwd` ≠ 会话 `cwd` 时不改 cwd，推 `cwd_mismatch_on_restore` 提示。
- **保留**：缺省不限；`checkpoints.max` 到顶按时间序淘汰最旧，不分 trigger。快照文件恒 durable 写（temp + fsync + rename）。
- **事件顺序**：`session.checkpointed → session.compacted`;`session.checkpointed(pre_restore) → session.restored`。

## 历史分页

长会话 UI 不必一次拿全量。`history({ offset, limit })` 按消息索引分页，返回切片恒配对完整——起点若落在一轮工具调用中间会向前对齐并回填 `offset`，终点向后对齐（`limit` 是下限）。

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

休眠会话（未起 AgentSession）用 `readHistoryPage(store, sessionId, { offset, limit })`;`createFileSessionStore` 的 `getHistoryPage` 按段清单跳读，成本与尾部体量相关、与卷总长无关。

## fork 与快照导出 / 导入

- `session.fork(checkpointId)` 从一份快照**长出一条新会话**，源会话零改动；需要会话 `store` 安放新记录，否则抛 `session_store_not_wired`。
- `exportCheckpoint(checkpointId)` 产出自包含字节（格式 `tansr-checkpoint/1`，图像附件内联）；`importCheckpoint(bytes)` 校验 format / schema / 附件 sha256 / 消息形，任一不过抛 `checkpoint_import_invalid`，篡改即拒、零落盘。导入件归目标会话，可直接 restore 或 fork。

## 与会话服务的关系

`@tansr/serve` 的 `/v2` 面有同一组能力的 HTTP 形态（`compact` / `checkpoints` / `restore` / `history` 分页 / fork / export / import），语义与本文一致；服务端的会话保留与物理删除策略见[保留期与治理](/serve/retention-and-governance/)。
