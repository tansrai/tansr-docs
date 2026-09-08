---
title: 联系支持
description: 两个入口——微信扫码进支持群，或发邮件到 support@tansr.com；哪个入口更合适；写清问题的四件事让我们更快帮到你；以及哪些问题不必联系人就能解决。
zone: support
category: support
related:
  - support
  - support/troubleshooting
  - support/account
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
lastVerified: '2026-09-08'
---

在联系我们之前，先花一分钟看看[帮助中心](/support/)的分组问答与[排障指南](/support/troubleshooting/)——多数问题在那里就能解决。确实需要人来看，用下面任一入口。

## 入口一：微信

![微信支持二维码（待上传）](/wechat-support.png)

**二维码待上传。** 上图目前是占位图，正式二维码就位后会替换；在此之前请用下面的邮件入口。

扫码进群后，请直接把问题描述发到群里（见下方「写清四件事」），不必先打招呼等回复。

## 入口二：邮件

[support@tansr.com](mailto:support@tansr.com)

邮件标题建议写成「[形态] 一句话问题」，例如「[命令行] tansr init 提示 PAT 无效」或「[会话服务] resume 恒 409」。我们会在工作时间内尽快回复；非工作时间的邮件按收到顺序处理。

## 哪个入口更合适

| 情形 | 建议 |
|---|---|
| 一句话能说清、想快速确认「是不是我用错了」 | 微信群 |
| 需要附诊断输出、日志、转录等较长材料 | 邮件 |
| 计费、发票、账号归属等需要核对身份的事 | 邮件，请用注册邮箱发出 |
| 安全漏洞 | 邮件，标题以「[安全]」开头，不要发群 |
| 文档错漏 | 邮件，写明页面地址 |

同一个问题请只走一个入口，避免两边重复处理。

## 写清四件事

把这四样带上，大多数问题一轮就能定位：

1. **你在用哪个形态、什么版本。** 命令行跑 `tansr --version`;SDK / 会话服务看 `package.json` 里 `@tansr/sdk` / `@tansr/serve` 的版本；移动端写 SDK 坐标版本与系统版本。
2. **诊断输出。** 命令行贴 `tansr doctor --json`（它不含密钥值，凭据只以指纹形态出现）；会话服务贴 `GET /readyz` 的响应与相关结构化日志行。
3. **错误码与完整消息。** 例如 `429 plan_concurrency_exceeded`、`409 resume_unavailable`；会话服务侧再附响应头 `x-request-id`；移动端附 `connectionState` 的变化序列。
4. **复现步骤与时间点。** 涉及计费带订单号或账单月份，以及账号指纹（`tansr init` 摘要卡上的形态）。

需要给我们看对话内容时，用 `tansr sessions export <id>` 导出转录——密钥已自动按 `sk-...尾4位` 脱敏，可以直接附上。

## 请不要发给我们的东西

- **任何密钥值**：个人访问令牌、应用密钥 appkey、模型供应商 API key、会话服务 Bearer。我们不需要它们就能排障；如果不小心发了，请立刻到控制台轮换。
- `.env` 文件内容。
- 含真实客户数据的完整日志；请脱敏或只截取相关行。

## 收到回复之后

- 我们可能会请你补一次 `tansr doctor --json` 或某个端点的响应，请在同一封邮件 / 同一条群消息串里回复，方便关联。
- 如果问题被确认为缺陷，我们会告诉你修复预计随哪个版本发布；版本发布后可在[发布说明](/releases/cli)（命令行）、[SDK 发布说明](/releases/sdk)与[会话服务发布说明](/releases/serve)里核对。
- 问题解决后如果方便，回一句「已解决」，我们据此关闭跟进。

## 这些问题可以自己解决

| 问题 | 去哪里 |
|---|---|
| 报错码是什么意思、能不能重试 | [错误码表](/errors/codes) · [排障指南](/support/troubleshooting/) |
| PAT / 应用密钥 / 套餐 / 余额 / 发票 | [账号与计费](/support/account/) |
| `tansr doctor` 某一段看不懂 | [设置与 doctor](/cli/settings-and-doctor/) |
| 会话服务部署、优雅关闭、多副本 | [部署与鉴权](/serve/deploy-and-auth/) |
| 移动端断线恢复、前后台、推送 | [Android 接入指南](/android/) · [iOS 接入指南](/ios/) |
| 数据存哪、凭据放哪、怎么轮换 | [安全与隐私](/security/) |

## 安全问题

如果你发现的是安全漏洞（凭据泄露路径、越权、注入面），请**不要**发到群里，直接邮件 [support@tansr.com](mailto:support@tansr.com)，标题以「[安全]」开头。我们会优先处理并在修复前保持沟通。

## 反馈文档

每篇文章底部有「这篇有帮助吗」；文档错漏也欢迎直接邮件说明页面地址与问题所在。
