# tansr 资料站 · docs.tansr.com

tansr 的开发者文档与帮助中心(一站两区):`/` 开发者文档(SDK · 会话服务 · CLI · Android / iOS · REST 参考 · 错误码 · 发布说明),`/support/` 帮助中心(账号与计费 · 排障 · 联系支持)。

- 站点:Astro + Starlight 静态站,Pagefind 本地搜索,zh-CN 为根、en 第二语言。
- 事实源律:凡能生成的只生成不手写——错误码表、REST 公开子集、`@tansr/serve` 环境变量表、CLI 命令参考、发布说明、SDK 导出参考皆由 `contract/` 下的 vendored 契约副本再生(`pnpm gen`;`pnpm gen --check` 为门)。手写文章只写用法与原理,引用的常量经 frontmatter `sources` 对表。
- 方案与计划:`tansr-cli` 仓 `doc/133-资料站方案.md` · `doc/134-资料站开发计划与执行清单.md`。

## 本地

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm gate         # astro check · build · gen --check · lint:text · links · frontmatter
pnpm vendor --api <tansr-api 检出> --cli <tansr-cli 检出>   # 更新 contract/ 副本(主线跑)
```

## 目录

```
astro.config.mjs       站点 / i18n / 侧栏 / openapi 挂载
src/content/docs/      文章(zh-CN 根;en/ 前缀)
src/components/        首页卡片 · 相关文章 · 有帮助吗 · 联系
contract/              vendored 契约副本 + vendored.json(source / revision / sha256)
scripts/vendor/        契约拷入与对表
scripts/gen/           生成器(错误码 · 公开 openapi · serve env · CLI 命令 · 发布说明)
scripts/check/         门(lint-text · links · frontmatter)
scripts/deploy/        rsync + 原子切换
```

## 部署

GitHub Actions `deploy.yml`:main 推送 → `pnpm gate` → 构建 → `rsync` 到 ECS `/root/tansr/docs/releases/<sha>/` → `ln -sfn` 切 `current`(零停机;回滚 = 回切符号链接)。nginx 侧配置在 `tansr-deploy` 仓 `nginx/conf.d/docs.conf`。

## 许可

站点代码 MIT(见 LICENSE);文档内容 © tansr,保留所有权利,未经许可不得转载。
