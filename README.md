# tansr 资料站 · docs.tansr.com

源码以 [MIT](LICENSE) 协议公开在 [tansrai/tansr-docs](https://github.com/tansrai/tansr-docs)。

tansr 的开发者文档与帮助中心(一站两区):`/` 开发者文档(快速开始 · SDK · 会话服务 · CLI · Android / iOS / 鸿蒙 · 统一 API 合同 · REST 参考 · 错误码 · 安全与隐私 · 发布说明),`/support/` 帮助中心(账号与计费 · 排障 · 联系支持)。

- 站点:Astro + Starlight 静态站,Pagefind 本地搜索,zh-CN 为根,en / ja / ko 三个附加语言走 `/en/` · `/ja/` · `/ko/` 前缀(译文覆盖范围见生成页 `releases/i18n-coverage`)。
- 事实源律:凡能生成的只生成不手写——错误码表、REST 公开子集、`@tansr/serve` 环境变量表、CLI 命令参考、发布说明、SDK 导出参考皆由 `contract/` 下的 vendored 契约副本再生(`pnpm gen`;`pnpm gen --check` 为门)。手写文章只写用法与原理,引用的常量经 frontmatter `sources` 对表。
- 方案与计划:`tansr-cli` 仓 `doc/133-资料站方案.md` · `doc/134-资料站开发计划与执行清单.md`。

## 本地

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm gate         # check · build · gen:check · lint:text · links · frontmatter · release-notes · i18n:coverage
pnpm test         # 放在 gate 构建之后，实际执行依赖 dist 的搜索与侧栏测试
pnpm vendor --api <tansr-api 检出> --cli <tansr-cli 检出>   # 更新 contract/ 副本(主线跑)
```

构建依赖说明(INJ-DOC-01):Astro 7 的预渲染产物直接导入 `cookie`,因此本仓显式声明已锁定的 `cookie@2.0.1`,避免干净检出缺少依赖或解析到上级目录的旧版本。该修复不修改 vendored SDK / CLI / API 源内容,也不改变构建与验收门。

搜索运行时取证(REL-04-DOC-02):`db64cf84` 主线 CI 曾出现一次构建后模块编译 `Unexpected end of input`，目前未确认唯一根因。搜索核验失败现保留原始 `cause`，附加 import/options/init/search/data 阶段、Node 版本与入口模块的失败后指纹，不重试或回落。构建前的 dist 缺席跳过不能作为构建后验收；状态、原红与上游候选边界见[任务回执](doc/report/REL-04-DOC-02-搜索运行时诊断回执-2026-09-10.md)。

索引写入完成屏障(REL-04-DOC-03):Starlight 0.42.0 的固定版本补丁通过 Pagefind `getFiles()` 取出原索引字节，再逐文件等待 Node 写入完成，最后关闭索引后台进程。索引配置、搜索 UI、排名规则和依赖版本保持不变；补丁由 pnpm 锁定，不能直接编辑 node_modules。`8b96ebd8` 的元数据后台拒绝与此前编译红均保留原失败，不据本地通过断言唯一根因。升级 Starlight 时须复核补丁及完成屏障测试，见[修复回执](doc/report/REL-04-DOC-03-Pagefind写入完成屏障-2026-09-10.md)。

## 目录

```
astro.config.mjs       站点 / i18n / 侧栏 / openapi 挂载
src/content/docs/      文章(zh-CN 根;en/ · ja/ · ko/ 前缀)
src/components/        首页卡片 · 相关文章 · 有帮助吗 · 联系
contract/              vendored 契约副本 + vendored.json(source / revision / sha256)
scripts/vendor/        契约拷入与对表
scripts/gen/           生成器(错误码 · 公开 openapi · serve env · CLI 命令 · 发布说明 · SDK 导出参考 · i18n 覆盖表)
scripts/check/         门(gate · lint-text · links · frontmatter · release-notes · i18n-coverage · search-rank)
scripts/test/          站点级测试(i18n 守卫 · 技术立场 / llms.txt · REST 侧栏 · 反馈 / 联系表单客户端 · lighthouse 配置形)
scripts/deploy/        rsync + 原子切换
```

## 部署

GitHub Actions `deploy.yml`:main 推送 → `pnpm gate` → 构建 → `scripts/deploy/publish.sh dist docs-upload docs-switch <sha>`:以专用用户 `docsdeploy` 的两把受限键,`rsync` 到资料站主机 `/srv/tansr-docs/releases/<sha>/`(上传键只能做这一件事),再 `ssh docs-switch switch <sha>` 原子切 `current`(切换键只能做这一件事;零停机、零 reload;只留最近 3 份;回滚 = `switch <旧 sha>`)。secrets(仓级):`DOCS_DEPLOY_KEY`(上传键私钥)· `DOCS_SWITCH_KEY`(切换键私钥)· `DOCS_HOST`(`docsdeploy@120.26.186.214`)· `DOCS_HOST_KEY`(known_hosts 行,可选)。资料站自 2026-09-10 起在**独立主机** `120.26.186.214`(仅 nginx 容器 + 静态文件,无仓检出、无任何私钥),与 api / www 所在 ECS 分离;主机部署件、nginx 站点与两条强制命令在 `tansr-deploy` 仓 `docs-host/`(`docs-host/README.md` · `conf.d/docs.conf` · `scripts/docs-rsync-only.sh` · `scripts/docs-switch.sh` · `scripts/docs-init.sh`)。

### 上游接线

`vendor.yml`:上游变更 → 自动 vendor。触发有二:`repository_dispatch`(事件 `upstream-updated`,`client_payload.api_ref` / `cli_ref` 可选)与手动 `workflow_dispatch`(inputs `api_ref` 缺省 `master`、`cli_ref` 缺省 `main`)。流程 = 检出两私有仓 `cpple/tansr-api`@api_ref 与 `cpple/tansr`@cli_ref → cli 检出 `pnpm install --frozen-lockfile` → `scripts/vendor/auto.sh`(`pnpm vendor` → `pnpm gen` → 无变化退 0 不提交;有变化先 `pnpm gate`,红即退 1 不提交——上游出新版本段而 `contract/release-notes.json` 缺该版本的用户口吻条正是预期的红,补条后重跑;绿则以 `github-actions[bot]` 提交 `chore(vendor): tansr-api@<sha12> · tansr-cli@<sha12> —— N 文件再生` 推 main,再 `gh workflow run deploy.yml --ref main`——Actions 里用 `GITHUB_TOKEN` 做的 push 不触发 `on: push`,显式派发 `workflow_dispatch` 才会真跑)。本地同一链:`pnpm vendor:auto <tansr-api 检出> <tansr-cli 检出>`(会真提交、真推、真派发,不要在脏工作区跑)。

secret 只有一把 `UPSTREAM_READ_TOKEN`(能读两私有仓的 token);未交割时工作流只打 `::notice::` 成功空跑、不标红,交割后自动生效;推 main 与派发 deploy 用 `GITHUB_TOKEN`(`contents: write` · `actions: write`),不另配。同组并发 `vendor-main` 排队、不取消在途。

兄弟仓侧(候拍,本仓不改兄弟仓):tansr-api / tansr-cli 各在 CI 成功后追加一步

```bash
gh api repos/tansrai/tansr-docs/dispatches -f event_type=upstream-updated -f 'client_payload[api_ref]=<sha>'   # cli 仓用 client_payload[cli_ref]
```

需各仓一把能对 `tansrai/tansr-docs` 发 dispatch 的 secret `DOCS_DISPATCH_TOKEN`(`GH_TOKEN` 传入;仓库自带的 `GITHUB_TOKEN` 不能跨仓派发)。两把 token 均未创建、未配置,等拍。

## 许可

站点代码 MIT(见 LICENSE);文档内容 © tansr,保留所有权利,未经许可不得转载。
