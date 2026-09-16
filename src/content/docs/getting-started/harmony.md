---
title: 鸿蒙 SDK 5 分钟跑通
description: 在原生 HarmonyOS 应用里接入 @tansr/harmony——用本地 HAR 依赖、提供你自己的登录凭据、创建第一个会话并把事件流归约成 SessionView。
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

`@tansr/harmony` 是会话服务 `/v2` 的**原生 ArkTS 薄客户端**（HAR）：发送输入、归约事件流、执行你显式注册的本地工具、应答权限与提问。智能体内核、权限引擎、上下文治理全部跑在你部署的 `@tansr/serve`；手机上没有任何平台凭据。视图归约与 Android / iOS 共用同一份金样。HAR **不包含 ArkUI 页面**，录音 / 播放 / 列表虚拟化由宿主自己接。

兼容 Android 的旧鸿蒙设备继续用 [Android SDK](/getting-started/android/)。当前最低 HarmonyOS 6.0 / API 20（Stage 模型）；HarmonyOS 5.x 原生兼容后续补齐，本文不宣称可用。包尚未发布 OHPM，以本地 HAR 接入。

## 手机端发送用户消息，服务端配置系统提示词

`createSession` 与 `session.send(...)` 都发送普通用户消息；鸿蒙 SDK 不经 `/v2` 传入 `system`。共享角色由平台应用配置管理，代码定制角色由 serve 的 `platform.system` 提供，宿主说明用 `platform.systemAppend`。

提示词与策略功能自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线；默认 `fallback` 下 SDK 显式 `system`（包括空数组）替代平台段，`prepend` 下保留平台段在前。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；前后台重连、SSE 恢复和 attach 可以保留原会话与历史，无需重开来取得更新。请由应用管理员消除业务段冲突，权限仍走独立机制。详见[应用系统提示词](/sdk/system-prompts/)。

## 前提

- 一个可达的 `@tansr/serve` 服务（见[会话服务 5 分钟跑通](/getting-started/serve/)）。本地可先起仓内 `examples/serve-demo`（缺省 `127.0.0.1:8788`）。
- DevEco Studio 6.0+、HarmonyOS SDK API 20+；宿主 HAP 声明 `ohos.permission.INTERNET`。录音等权限由实际使用该能力的宿主声明和申请。
- 你自己的登录体系：SDK 每次请求经 `AuthProvider` 取短期认证头（通常是 `Authorization: Bearer <你的登录 token>`），服务端的 `authenticate` 缝据此解出 `endUserId`。不要在客户端持有平台 AppKey、上游模型密钥或服务端签名私钥。

## 安装

在 SDK 仓用 DevEco 或 `./scripts/native.ps1 -Action har` 产出 `tansr/build/default/outputs/default/tansr.har`，复制到业务模块 `libs/tansr.har` 后：

```json
{ "dependencies": { "@tansr/harmony": "file:./libs/tansr.har" } }
```

执行 `ohpm install`。SDK 没有外部运行依赖，不包含 Node.js、React Native、WebView 或 Android 兼容运行时。HAR 独立工程消费即可验证接线，不必把 Demo HAP 嵌进你的应用。

## 凭据：只有你自己的登录态

SDK **不持久化任何凭据**：每次请求经 `AuthProvider.headers()` 取一次头即用即弃。生产用 `RefreshingAuthProvider` 包装你的 `CredentialIssuer`，处理有效期、并发刷新与身份变化；刷新失败不要暗中重放密码登录，换票后身份变化须终止该实例。

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

`StaticAuthProvider` 只适合短时调试。默认要求 HTTPS；回环 HTTP 仅本地调试。真机连开发机私网地址时，经 `NativeHttpOptions.allowPrivateNetworkHttp` 显式开启内网 HTTP——不允许普通公网明文 HTTP，也不忽略 TLS 证书错误。

## 第一个会话

新建成功后**先把确认的 sessionId 写入原登录作用域**，再绑界面。保存失败或响应未确认要向用户报告，不能自动再建一条。`verifiedEndUserId` 必须来自已验证的登录回执。

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

`session.stop()` 只取消本地订阅与桥，不丢远端会话；`session.start()` 恢复订阅；`close()` 才请求关闭远端会话。前后台、退出登录和组件释放必须接这些入口。发送回执只表示接纳，实际输出通过事件流到达。

冷启动接着上次聊：先按原 sessionId 查归属，再交给 SDK attach / history / resume。恢复失败保留原 ID 并报告原因，不能把 forbidden、损坏和临时断网都处理为新建。

## 看到事件

`SessionView.state` 已经是归约好的视图快照（消息列表、工具卡、待办、用量、`lastError`），多数 UI 订阅 `onChange` 即可。`onFrame` 收到的是原始 SSE 帧；`server.*` 控制帧交给 `session.bridges`，不要用普通 `tool.permission.*` 事件再弹一次审批。

连接态经 `session.onState` 观察：`idle` → `connecting` / `recovering` → `live`，闪断为 `retrying`，协议或鉴权失败为 `failed`，`close()` 后为 `closed`。断线不会浮到业务码：L1 携游标重连，L2 收到 gap 后拉 `/history` 重建，L3 在元信息 404 或 `live = false` 时 resume。`lastSeq` 恒按值续传，休眠判据恒 `live = false`。

## 本地工具与对话框

本地工具用 `session.bridges.registerTool(declaration, handler)` 注册，并在 `createSession` / resume 时传入同一份 `clientTools` 声明。`parameters` 是「参数名 → 参数规格」字典；无参数为 `{}`，不能传整个 JSON Schema。未设置 `onPermission` 时默认拒绝；只响应 `server.permission.request`，用户确认后 `answerPermission(id, 'allow' | 'deny')`。提问走独立的 `onQuestion` / `answerQuestion`，补充文本不代表批准工具。

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

操作系统麦克风授权与智能体工具许可是两层：一层不能替代另一层。服务端 cwd 不映射为任意本地路径。

## 常见第一坎

| 现象 | 处置 |
|---|---|
| 一连就 401 | `AuthProvider` 返回的头不被服务端 `authenticate` 认可。修好登录态后再 `start()` |
| 模拟器 / 真机连不上 | 回环仅本地调试；连开发机私网须 `allowPrivateNetworkHttp`。生产恒上 TLS |
| 建会话 400 | `clientTools.parameters` 误写成了整份 JSON Schema；须为参数名字典 |
| 新会话 429 | 每个终端用户缺省最多 8 个活跃会话；不用的会话请 `close()` |

## 下一步

- [鸿蒙接入指南](/harmony/)：会话生命周期、三级恢复、工具桥、语音两条链、朗读双帽、媒体下载边界。
- [Android 与 iOS 5 分钟跑通](/getting-started/android/)：对照三端同律差异。
- [v2 协议与 webhook](/serve/v2-and-webhooks/)：服务端半场怎么把轮末通知交给你的推送后端。
