# REL-04-DOC-03：Pagefind 索引写入完成屏障

日期：2026-09-10。基线：docs main `8b96ebd8f2b8faace4327c48e41d8b8b1455e770`。使用既有本地隔离树 `worktrees/production-release-docs-20260910`，不修改固定主仓，不推开发分支。原 CI 失败与已定位的输出完成链缺口分别记录，不能相互替代证明。

## 触发与归因边界

主线 [34491249664](https://github.com/cpple/tansr-docs/actions/runs/34491249664) 八步 gate 通过，构建后的 test 为 234 项、233 通过、1 失败、0 跳过/取消。原三词首位加两守卫用例出现 `Failed to load Pagefind metadata`，前置日志为 `SyntaxError: Unexpected end of JSON input`，失败类型 `unhandledRejection`。它来自 Pagefind 后台初始化，未通过 DOC-02 的等待链 catch，所以不能声称该轮已经取得 phase/hash/cause 诊断。该 CI 没有保存失败元数据的原字节，不能仅据 JSON 错误断言磁盘截断。

同 SHA deploy 实际切换 current 并验证 HTTP 200；Lighthouse 独立构建成功、三个页面均采集，只有首页性能 0.82 未过 0.90。三种工作流结论分开保留。父任务独立分析 Lighthouse，不修改其门槛、采集次数、模拟配置或页面内容来掩盖原红。

本机对原生成运行时进行一次只读 fetch 观测：import 不构建实例，options 先保存设置，init 才启动初始化，未先请求 file: 再请求 HTTP。元数据仅一次本地 HTTP 请求，状态 200、359 字节、与磁盘相同且 JSON 合法，五词全通过；共 163 请求、未处理拒绝 0。该结果不能恢复 CI 的 HTTP 正文。Pagefind 默认实例 constructor 的初始化 Promise 未交调用方等待、公开 init 仅启动的上游边界仍存在；本卡没有增加全局 rejection 吞错或重试。

## 已核出的完成链与最小修复

Pagefind 1.5.2 [输出源码](https://github.com/Pagefind/pagefind/blob/v1.5.2/pagefind/src/output/mod.rs#L383-L437)使用 Tokio File.write_all 后未 flush；[Tokio 正式说明](https://docs.rs/tokio/latest/tokio/fs/struct.File.html)指出文件离开作用域时仍可能有未完成 IO。已安装 Starlight 的 writeFiles 返回后立即进入 finally.close，Pagefind Node service 的 close 调用后台进程 kill。这个实际代码链没有等待底层文件写入完成的所有权保证。它与两轮 CI 症状相容，但没有失败原始文件足以证明两轮唯一根因。

固定版本补丁 `patches/@astrojs__starlight@0.42.0.patch` 仅更改原索引集成的写出步骤：保持 createIndex、addDirectory 和全部输入配置，改为官方 [getFiles API](https://pagefind.app/docs/node-api/)取得原生成字节；拒绝越出输出目录的相对路径；逐文件等待 mkdir 和 writeFile；最后才运行原 close。getFiles.errors 与 Node 写入失败仍使构建非零，工作流因此不会发布该失败构建。逐文件等待避免失败时有其他并发写入被遗留。

Node 写入承诺提供文件写入已完成、可读的边界，不是 fsync 或断电耐久承诺。原搜索 UI、排名参数、语言、索引选择、Pagefind/Starlight 版本均不改变。补丁由 pnpm patch/patch-commit 管理，pnpm-workspace 与 lock 固定补丁 hash；没有手改 node_modules、升级依赖或复制另一套 Astro hook。

## 反证与验收入口

- 真实 Pagefind 1.5.2、8 页隔离索引：getFiles 与原 writeFiles 的 21 文件逐字节相同；本机未复现原路径截断，不把此对照写成上游竞态真实复现。
- 实际已安装 Starlight hook 的受控依赖测试先 4/4 有效红，再 4/4 绿：首个与第二个文件未写完时 build/close 均未完成；getFiles 错误拒绝且不写；写入错误保留 cause 且先完成再 close；越界路径在 mkdir/write 前拒绝。首轮 Windows 夹具 file URL 无效造成的 4 cancel 单独保留，不计有效红。
- 原搜索三例与 DOC-02 六例加首轮四例合计 13/13 通过，零跳过。追加第二文件屏障后四例再次 4/4 通过。原排名断言、超时、并发、跳过规则不变。
- `pnpm install --frozen-lockfile` 退出 0，官方 patch-commit 已应用补丁，实际已安装 hook 的测试通过；冻结安装是当前依赖树的 up-to-date 核验，不冒称重新下载的干净安装。版本与包集合没有升级。
- 完整原 `pnpm gate → pnpm test` 于 15:15:14–15:17:49 UTC 正常宿主执行，两步均自然退出 0。gate 八门全过；构建后 **238/238 通过、0 失败/取消/跳过、0 suites**。新四例为第 16–19，原搜索参数/排名为第 25–26，原侧栏构建检查为第 222，均实际执行。测试原生汇总 69,538.5302 ms，不把与旧轮的耗时差当成受控性能收益。
- 构建前后 `_astro`、`pagefind` 与两份索引配置共 2,419 条清单，2,416 文件逐字节相同。所有 Pagefind JS、压缩索引、WASM 字节相同，仅 entry JSON 的原始 hash 改变（原 body 未单独保存，不据此声称只改键序）；索引查询仍按原五词规则通过。另两份 CSS 的 Astro scope ID 与对应文件名改变，字节数相同；从 canonical 旧产物取得与前置清单 hash 完全一致的副本，去 scope ID 后 CSS 逐字节相同，声明内容未改变。不能把构建产物统称全部逐字节相同。
- 主线收编与原 CI/deploy/Lighthouse：待父任务按精确后继 SHA 回填。8b96 的原 ci 和 Lighthouse 红保持，不能拿它的 deploy 绿或本地 238 绿代替后继远端结论。报告后填文字另核文本门，不冒记为测试前已知结果。

原日志与新增证据统一位于 `J:/tansr/archive/20260910-production-release/docs-main-8b96ebd8/`。`pagefind-investigation/` 保存 fetch 观测、21 文件对照、原四红/四绿、补丁生成日志及后续完整本地门，不覆盖 db64 与 8b96 两轮原红。升级 Starlight 时需检查补丁是否仍适用、完成承诺是否已由上游提供，重新过同一组生命周期和实际排名测试后才可移除。
