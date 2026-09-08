---
title: 常见问题样例
description: 帮助中心文章样板:演示问答式写法、相关文章与「是否有帮助」反馈。
zone: support
category: support
related:
  - getting-started
sources:
  - tansr-cli:doc/11-用户手册.md
lastVerified: 2026-09-08
---

<!-- 样板文章:演示 frontmatter 契约与文章页尾组件;正式内容到位后本文会被删除或覆写。 -->

## 我该从哪里开始?

先读「快速开始总览」,按你的接入方式选一条 5 分钟路径。

## 命令报错了怎么办?

1. 先运行诊断命令,看输出里标红的那一行。
2. 对照错误码表里的说明与处置建议。
3. 仍未解决,把诊断输出与错误码一并发给支持。

## 这个页面的 frontmatter 长什么样?

```yaml
title: 常见问题样例
description: 一句话说明。
zone: support
category: support
related:
  - getting-started
sources:
  - tansr-cli:doc/11-用户手册.md
lastVerified: 2026-09-08
```

- `zone`:`docs`(开发者文档)或 `support`(帮助中心)。
- `category`:十一类之一。
- `related`:站内文章 slug,页尾自动渲染「相关文章」。
- `sources`:这篇文章引用的事实源,发布前会逐条核对。
- `lastVerified`:最近一次核对事实源的日期。
