---
title: 鸿蒙接入指南
description: 原生 ArkTS HAR 的公开面、SessionView 归约、连接状态与三级恢复、生命周期、本地工具与双桥、语音两条链与朗读双帽、媒体下载边界，以及凭据与日志纪律。
zone: docs
category: harmony
related:
  - sdk/system-prompts
  - getting-started/harmony
  - getting-started/android
  - android
  - ios
  - serve/v2-and-webhooks
  - serve/deploy-and-auth
  - security
sources:
  - tansr-harmony:README.md
  - tansr-harmony:doc/HM-01-SDK接入手册.md
  - tansr-harmony:doc/HM-01-Demo接入手册.md
  - tansr-cli:examples/serve-demo/README.md
lastVerified: '2026-09-16'
---

鸿蒙 SDK（HAR 坐标 `@tansr/harmony`，当前独立发布版本 0.1.0）是会话服务 `/v2` 的原生 ArkTS 薄客户端。最低 HarmonyOS 6.0 / API 20，Stage 模型。这一篇讲快速开始之后你会遇到的设计点：事件怎么变成 UI 状态、断线怎么恢复、工具与对话框怎么接、语音与媒体怎么接。HAR 不提供 ArkUI 页面，也不自动申请麦克风。

兼容 Android 的旧鸿蒙设备继续使用 [Android SDK](/android/)。HarmonyOS 5.x 原生兼容是后续工作，当前不宣称可用。当前交付是独立发布的版本化 release 字节码 HAR，尚未上架公共 OHPM；签名安装与真机矩阵不在本文范围。接入步骤见[鸿蒙 SDK 5 分钟跑通](/getting-started/harmony/)。

## 手机端发送用户消息，服务端配置系统提示词

`createSession` 与 `session.send(...)` 都发送普通用户消息；鸿蒙 SDK 不经 `/v2` 传入 `system`。共享角色由平台应用配置管理，代码定制角色由 serve 的 `platform.system` 提供，宿主说明用 `platform.systemAppend`。

提示词与策略功能自 `@tansr/serve` 0.8.0 起提供，平台侧已于 2026-09-14 上线；默认 `fallback` 下 SDK 显式 `system`（包括空数组）替代平台段，`prepend` 下保留平台段在前。平台提示词与策略在后续新一轮前刷新，当前执行轮固定；前后台重连、SSE 恢复和 attach 可以保留原会话与历史。详见[应用系统提示词](/sdk/system-prompts/)。

## 公开面

| 导出 | 职责 |
|---|---|
| `TansrAgentClient` | `/v2` 纯合同客户端：建会 / 元信息 / 历史 / 发消息 / 同轮输入 / 音频直连。网络不确定时不自动重发变更请求 |
| `NativeHttpTransport` | 系统 RCP 传输；选项控制 HTTPS、回环 HTTP、内网 HTTP、超时与响应帽 |
| `AuthProvider` / `RefreshingAuthProvider` / `StaticAuthProvider` | 按次取认证头。刷新包装处理有效期、并发与身份变化 |
| `AgentSession` | 一条事件泵：`start` / `stop` / `close`、`send` / `sendBlocks`、桥运行时 |
| `SessionView` | 纯事件归约。JSON 快照与 Android / iOS 金样同形 |
| `SpeechPlan` | 朗读预检：平台加权帽与供应商原子 `inputLimit` 双帽；显式同意后分段 |
| `historyArtifactData` / `isRenderableArtifact` | 历史工具产物投影；坏媒体预览不改写工具原始成功 / 失败 |

SDK 没有外部运行依赖。宿主 HAP 必须声明 `ohos.permission.INTERNET`。

## 事件归约

```typescript
session.onFrame = (eventName, data, seq) => { /* 原始 SSE 帧 */ };
session.onHistory = (history) => view.restoreHistory(history.messages);
view.onChange = () => render(view.state);
session.onState = (state) => { /* idle / connecting / live / retrying / recovering / failed / closed */ };
```

- 未知业务事件类型 `SessionView` 忽略、不断流；`server.*` 控制帧由 `session.bridges` 消费，不要用普通 `tool.permission.*` 再弹审批。
- `SessionView(textMode, thinkingMode)`：文本 `stream` / `final`，思考另有 `off`。这是 UI 投影，不修改模型生成参数。
- 工具卡产物经 `historyArtifactData()` 按形状解出；签名媒体 URL 仅在可见消息层隐藏时，核心历史与加载用的原始回执保持不变。

## 连接状态与三级恢复

```text
idle → connecting → live
live → retrying（指数退避）→ live          // L1:携游标重连,收帧按 seq 去重
live → recovering（拉 /history 重建）→ live // L2:重连首帧收到 gap
404 或 live = false → resume 重灌            // L3:弃旧游标,以 history.lastSeq 为锚
```

`lastSeq` 恒按值续传，休眠判据恒 `live = false`，恒不是 `lastSeq == 0`。`@tansr/serve` 0.9.0 起，休眠会话的元信息 `lastSeq` 是 store 落盘的真值水位。`live = true` 且 `lastSeq == 0` 只走 L2、恒不 resume。

`AgentSession` 第三参数 `verifiedEndUserId` 在场时，元信息或 resume 后身份不一致即失败，不偷偷换会。sessionId / turnId / inputId / historyEpoch 是不透明标识：逐段编码，不 trim、不大小写折叠、不做 Unicode 归一。

401 或协议错误进入 `failed`，泵停；须宿主修好登录态后显式 `start()`。`stop()` 后状态归 `idle`，会话未终结。`close()` 才 DELETE 远端。

## 生命周期

| 入口 | 含义 |
|---|---|
| `start()` | 开始或恢复本地订阅；幂等 |
| `stop()` | 取消本地订阅与桥，不丢远端会话 |
| `close()` | 先 `stop`，再请求关闭远端会话；失败如实交回，不伪造已关闭 |

回后台停泵、回前台再 `start()`。组件释放与退出登录必须调用这些入口；停止本地订阅不自动 DELETE 服务端历史。新建会话：`createSession` 确认 ID 后先持久化到原认证作用域，再绑界面。保存失败不能自动再建。恢复失败保留原锚。

严格同轮追加先取 `inputCapabilities()` 的当前 target，再建立 `InputSubmission`。在第一次 POST 前持久化原 ID、target 和正文。未确认状态只按原标识查询；不自动重发、换 ID、降级为 messages 或 interrupt。`accepted` 不等于已持久化或已回答。

## 本地工具与双桥

```typescript
session.bridges.registerTool(declaration, handler);
session.bridges.onPermission = (request) => {
  // 展示 request.payload 后:
  session.bridges.answerPermission(request.id, 'allow'); // 或 'deny'
};
session.bridges.onQuestion = (request) => { /* answerQuestion */ };
```

- 创建 / resume 时传入的 `clientTools` 必须与实际注册的处理器一致。
- `parameters` 是参数名字典；无参数为 `{}`。只读声明不能绕过服务器裁决；处理者必须观察 `CancelToken`。
- 未设置 `onPermission` 默认拒绝。过期请求不能批准。普通 `tool.permission.*` 仅供观察。
- 提问与权限是不同桥族。补充文本、回答问题都不等于批准工具。
- 客户端不对全部工具强制 ask；自动 allow、真实 ask 与 deny 由 serve 复用内核裁决。

## 语音：两条链

音频不是协议级模态（不入消息块、不入事件流）。

1. **工具链**：智能体自行调 `SpeechToText` / `TextToSpeech`，产物随工具完成事件到端，经历史投影渲染。
2. **直连链**（你自己的语音 UX）：

```typescript
const transcript = await client.audioTranscribe(session.sessionId, 'audio/mp4', base64, undefined, cancel, 'zh');
const speech = await client.audioSpeech(session.sessionId, assistantText, undefined, undefined, cancel, 'wav');
```

`audioSpeech` 的 `format` 仅接受 `wav` / `mp3`，不传则省略请求字段。`audioTranscribe` 的 `language` 为 2–16 个 UTF-16 码元，原样传递。两项都追加在 `CancelToken` 之后，旧调用无需调整。参数不合法时，SDK 在鉴权和发请求前返回 `validation_failed`。格式是否采用仍由平台和所选模型决定，不能按请求格式改写回执 MIME。合成回执中的真实音频字段才是下载、播放及计量依据。

原生录音（M4A/AAC，MIME `audio/mp4`）是宿主接线。STT 约束 `formats` 必须明确包含 `m4a`；`maxSeconds` 必须有效且至少 1 秒。转写只填草稿，不自动发送。取消、换会话和退后台后的迟到结果不得串写。HAR 不自动申请麦克风。

朗读用 `SpeechPlan.prepare()` 预览，同时遵守平台加权帽与供应商原子 `inputLimit`。长文须显式同意分段；每段提交前重查授权帽。分段按 Unicode 码点边界。已完成段缓存重播，结果未确认段标 uncertain 并停止，不自动重生成。`SpeechPlan.reset(index)` 只重置一个已确认或 uncertain 段，每段最多 3 次；它不发送请求。宿主必须先确认真实合成 Promise 已结束、核对用量并取得明确重置意愿。允许分段时，首段 120、后续 360 加权字符是与 Android 一致的时延软目标，始终服从硬帽、每段 20000 UTF-16 码元、全文 32000 加权字符与最多 32 段。

## 媒体与观测

媒体授权按 `media.capabilities` / `media.models` 的 `imageGen`、`videoGen`、`speechToText`、`textToSpeech` 读取，不能写成 `image` / `video` 后误判未授权。图片输入是 IR `text` + `image` blocks；主模型原生 audio/video 输入块尚未提供。图片和视频生成由系统工具在服务端执行。

原生媒体下载使用独立 `downloadMedia()`：HTTPS、无认证头、不跟随重定向。默认 16 MiB，已有产物可显式配置至 128 MiB。超时、过期、取消或坏格式均不能触发自动付费重建。较大媒体应由服务提供可访问 URL，不能靠无限扩大手机缓冲绕过。

`meta()` 读取服务端实际模型、上下文及可选媒体观测。缺失保持「未知」。当前 wire 没有会话切模 HTTP。`selected`、`active`、`lastObserved` 是不同事实。不能从计费用量反推窗口占用。供应商 KV 缓存与本地会话 / 音频缓存不同，不能为了命中率发付费保活请求。

## 凭据与日志纪律

- 设备凭证 = 你的登录态，SDK 只经 `AuthProvider` 按次取用，恒不持久化到 Preferences / 文件 / 日志。
- appkey 在 SDK / 示例代码面恒无此概念；`app_user` 令牌恒不下发设备。
- 换票单飞、出站头快照、身份与代际校验：旧票 401 晚到不能重复强制换发，取消与切用户后回包不能复活。
- 工具应答与工具申报都是不受信输入。设备可被逆向改造，不要因「自家 App」降低警惕。

## 端侧资源边界

| 项目 | 当前默认 |
|---|---|
| SSE 帧缓冲 | 16 Mi UTF-16 字符；`AgentSession` 第五参数可调，最大 32 Mi；超帽停止且报告协议错误 |
| JSON | 32 Mi 字符、64 层；拒绝重复键、非有限数值和坏结构 |
| 原生普通响应 | 32 MiB；错误体 64 KiB |
| 媒体下载 | 默认 16 MiB，显式可至 128 MiB |
| 视图局部状态 | 通知 20 条、工具输出尾部 4000 UTF-16 字符；不会自动截断聊天历史 |

这些是端侧资源边界，不是所有上游媒体的最大值。某些上游合法的内联 Base64 仍可能超过该帽；此时明确停流 / 拒绝，不声称已成功接收。`SessionView` 保留完整会话消息投影；超长会话的列表虚拟化由宿主负责。

## 联调与构建

- 对接仓内 `examples/serve-demo`（echo 径缺省端口 8788）。Demo 的 `DeveloperLogin` 是宿主适配器，不是 HAR 内置登录：先向你的登录服务 `POST /login`，再拿短期票访问 `/v2`。自定义登录协议替换该适配器，不修改 SDK 的会话归属。
- 明文 http 仅回环或显式内网；生产恒上 TLS。
- SDK 仓门禁：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm check:contract`。原生：`./scripts/native.ps1 -Action lint` / `har` / `hap`。
- 示例 HAP 展示聊天、连接、详情、媒体、工具五类导航，不是 SDK 保证的 UI 合同。
