# 资料站 · DS-G(i18n 覆盖率分母 · REST 参考侧栏重量 · 上游变更自动 vendor)· P3 终报

> 仓 `tansr-docs` · 分支 `lane/ds/G` · worktree `J:\tansr\worktrees\ds-G` · 基线 main `14a46b5` · 2026-09-10 17:20–18:15 CST。
> 派单:`J:\tansr\.square-tmp\ds\P3-共同派单.md` §1 DS-G 行 + §2 DS-29 / DS-30 / DS-31 逐字 DoD + §3 环境提示 + §4 终报形;契约沿 `P1-共同派单.md` 1–7;前车沿 `资料站-P2-收编回执-2026-09-09.md` 与 `资料站-DS-F-P2-终报.md`。
> 恒未 push / 未部署 / 未碰 ECS / 未改兄弟仓 / 未建 secret 与密钥 / 未改 `src/content/docs/en|ja|ko/**` · `src/lib/glossary.mjs` · `src/components/*.astro` / `astro.config.mjs` 的 `locales` 行与 `translations: { en: c.en }` 行零改动 / `package.json` 只加脚本名 `vendor:auto`、lockfile 未动。

## 〇 结论一页

- 卡数 3 / 完成 3(DS-29 · DS-30 · DS-31);代码提交 4(三卡各一 + DS-30 补一)+ 本终报 1;`git status --short` 空。
- 门终态(HEAD `20283fc`,18:07):`pnpm gate` 一次全绿 —— check 65 文件 0 errors / 0 warnings / 0 hints · build 1252 页 · gen:check 全部生成物零 diff · lint:text 631 文件 0 违反 · links 1252 页 113035 链 0 死(1984 外链未查)· frontmatter 550 文件 0 错 · release-notes 3 包 10 版 10 条 0 违反 · i18n:coverage en 13 / 24 手写页(54.2%)· 含生成页 13 / 536(2.4%),只报不红。`pnpm test` 133 / 133(基线 112 + DS-29 +2 + DS-30 +9 + DS-31 +10)。
- DS-29:覆盖率拆两口径——主表以手写页(`generated !== true`)为分母(24 篇,en 13 → 54.2%),生成页(512)只报数量一行、逐页行归末尾 `<details><summary>生成页(512,不计覆盖率)</summary>` 折叠段;`scripts/check/i18n-coverage.mjs` 打印两口径两行;stats 加 `handwritten` / `generated`;`releases/i18n-coverage.md` 再生提交,`gen --check` 零 diff。先红(7 / 13)再绿(13 / 13)。
- DS-30:`getting-started/index.html` **126633 → 49645 B(123.7 → 48.5 KiB,≤ 60 KB ✓)**;`sdk/api/index.html` 163793 → 86805 B;`en/getting-started` 127526 → 50543 B;`api/operations/healthz` 127061 B 不变(REST 区内按设计保留完整操作树与上下页);`api/index.html` 252617 B 不变;**`du -sh dist` 165M → 87M**(160.2 → 81.6 MiB;`sdk/api` 61M → 24M · `en` 66M → 27M · `api` 29M 不变)。手段:① 插件 `sidebar` 配置无「不列操作」项(读 `node_modules/starlight-openapi/libs/schemas/schema.ts` 确认;`collapsed` 只改 `<details open>`、字节不变)→ 弃;② 侧栏手写 link 项会被 Starlight 加 locale 前缀成 `/en/api/` 死链、slug 项又需内容集合条目 → 纯配置做不到;③ **Starlight 路由中间件 `src/lib/rest-sidebar.mjs`**:`/api/**` 之外把插件占位组换成「REST 参考 → 总览」一条(href 恒 `/api/`),占位组不在场插件便不再注入;`/api/**` 页面原样交给插件。可达性:`/api/` 总览列全 170 操作 · links 0 死 · Pagefind 搜 `docs/feedback` 首位仍 `/api/operations/v1docsfeedback/` · search-rank 五词全首位 · 相邻页上下页连续(ios → 总览 → errors/codes)。
- DS-31:`.github/workflows/vendor.yml`(`repository_dispatch` `upstream-updated` + `workflow_dispatch` api_ref=master / cli_ref=main;`contents: write` + `actions: write`;`concurrency: vendor-main` 不取消在途;`UPSTREAM_READ_TOKEN` 缺席 → `::notice::` 空跑成功、后续 7 步 if 守卫;在场 → 两私有仓 checkout → cli `pnpm install --frozen-lockfile` → `bash scripts/vendor/auto.sh ../upstream/api ../upstream/cli`);`scripts/vendor/auto.sh`(vendor → gen → 无变化退 0 | 有变化 gate 红退 1 不提交 | 绿则 `github-actions[bot]` 提交 `chore(vendor): tansr-api@<sha12> · tansr-cli@<sha12> —— N 文件再生` 推 main → `gh workflow run deploy.yml --ref main`,注释写明 GITHUB_TOKEN 的 push 不触发 `on: push`);假件卷 10 例(先红 0 / 10 再绿 10 / 10);README「部署」段加「### 上游接线」;`package.json` 只加 `vendor:auto`。**未建任何 secret / 密钥;两把 token(`UPSTREAM_READ_TOKEN` · 兄弟仓 `DOCS_DISPATCH_TOKEN`)均候拍。**
- 与派单不符 8 条(§四 4.1):DS-30 走手段 ③ 并新增两文件(派单文件域未列)· `astro.config.mjs` 加 `routeMiddleware` 一行(在 `plugins:` 前,非 `sidebar` 数组内)· `/api/**` 页体积不变 · DS-31 `permissions` 加 `actions: write` · 本仓检出到 `docs/` 且 auto.sh 以 `../upstream/…` 调用 · `git status --porcelain=v1 -uall -- …` 形 · 卷 10 例(派单三例)· DS-29 check 输出与 `--json` 结构变。代拍 7 条(§四 4.2)。
- 敞口(§五):与 DS-H 的 `astro.config.mjs` 合并面(不同 hunk,预计无冲突)· DS-H 合入后主线须 `pnpm gen` 再生覆盖率页 · vendor.yml 首跑候两把凭据与 main 分支保护规则 · 真实 vendor 链只有假件 dry-run 未真跑 · `/api/**` 页仍 124–250 KB · api 侧 openapi summary 含内部编号(「P2 DS-17」)出现在操作页标题。

## 一 卡与提交

| 卡 | 提交 | 时间 | 改动 | 一句话 |
|---|---|---|---|---|
| DS-29 | `3c09b75` | 17:45 | `scripts/gen/i18n-coverage.mjs` · `scripts/gen/i18n-coverage.test.mjs` · `scripts/check/i18n-coverage.mjs` · `scripts/check/test/i18n-coverage.test.mjs` · `src/content/docs/releases/i18n-coverage.md`(再生);5 文件 +212 −51 | 覆盖率分母排除生成页;两口径;折叠段;check 两行 |
| DS-30 | `320ae1e` | 17:53 | `astro.config.mjs`(REST 段 +14 −1)· 新 `src/lib/rest-sidebar.mjs` · 新 `scripts/test/rest-sidebar.test.mjs`;3 文件 +198 −1 | 路由中间件瘦身 REST 侧栏;getting-started 123.7 → 48.5 KB;dist 165M → 87M |
| DS-31 | `62a11fc` | 18:03 | 新 `.github/workflows/vendor.yml` · 新 `scripts/vendor/auto.sh` · 新 `scripts/vendor/test/auto.test.mjs` · `README.md` +14 · `package.json` +1;5 文件 +449 | 上游变更自动 vendor 工作流 + 可测脚本 + 假件卷 + 上游接线说明 |
| DS-30 补 | `20283fc` | 18:09 | `src/lib/rest-sidebar.mjs` +7 −2 · `scripts/test/rest-sidebar.test.mjs` +10 | 「总览」链接文字补 ja / ko(Starlight 内建同字),ja / ko 上线后不回落英文 |
| 终报 | (本提交) | — | `doc/report/资料站-DS-G-P3-终报.md` | — |

合计 `git diff main --stat`:13 文件 +872 −52。提交信息均经 UTF-8 无 BOM 文件 `git -c i18n.commitEncoding=utf-8 commit -F`;全部新文件 LF、无 BOM、有末行换行(node 逐字节核)。

## 二 门与卷数字

### 2.1 每卡收口时 `pnpm gate` / `pnpm test`

| 收口 | HEAD | check | build | gen:check | lint:text | links | frontmatter | release-notes | i18n:coverage | test |
|---|---|---|---|---|---|---|---|---|---|---|
| 基线 | `14a46b5` | — | 1252 页 | — | — | 1252 页 301355 链 0 死 | — | — | en 13 / 536(2.4%,旧单口径,生成页在分母) | 112 |
| DS-29 | `3c09b75` | 62 文件 0/0/0 | 1252 页 | 514 文件零 diff | 626 / 0 | 1252 页 301355 链 0 死 | 550 / 0 | 10 / 10 | en 13 / 24 手写 · 13 / 536 全部 | 114 / 114 |
| DS-30 | `320ae1e` | 64 文件 0/0/0 | 1252 页 | 零 diff | 628 / 0 | 1252 页 **113035** 链 0 死 | 550 / 0 | 10 / 10 | 同上 | 122 / 122 |
| DS-31 | `62a11fc` | 65 文件 0/0/0 | 1252 页 | 零 diff | 631 / 0 | 1252 页 113035 链 0 死 | 550 / 0 | 10 / 10 | 同上 | 132 / 132 |
| DS-30 补 | `20283fc` | 65 文件 0/0/0 | 1252 页 | 零 diff | 631 / 0 | 1252 页 113035 链 0 死 | 550 / 0 | 10 / 10 | 同上 | **133 / 133** |

links 检查数 301355 → 113035:少的全是各页侧栏里重复的 170 条操作链接(1252 页 × ~150),死链恒 0。

### 2.2 先红再绿

| 卡 | 红(修前实跑) | 绿 |
|---|---|---|
| DS-29 | `node --test` 两卷 13 例 → **6 过 / 7 红**(summary 无 `handwritten` · report 分母 1 / 3 而实得 1 / 5 且未翻译清单含 `errors/codes` · 输出仅一行…;`.lane-tmp/ds29-red.log`) | 13 / 13;再生后 `gen --check` 零 diff |
| DS-30 | `rest-sidebar.test.mjs` 修前:模块不存在 → 8 例全红;构建级例对旧 dist 实跑红:`getting-started/index.html` 126633 B > 61440(`.lane-tmp/ds30-red.log`) | 单元 8 / 8;重建后构建级例绿(49645 B,侧栏 `/api/` 链接恰 1 条,操作页仍 ≥ 100 条操作链接);补卷后 9 / 9 |
| DS-31 | `auto.test.mjs` 修前(auto.sh / vendor.yml 缺席)**0 / 10**(`.lane-tmp/ds31-red.log`);实现后首跑 9 / 10——白名单卷把 bash 内建 `mapfile` 误判为外部命令(卷自身的红,补内建清单) | 10 / 10(`.lane-tmp/ds31-green.log`) |

### 2.3 DS-30 体积(同 1252 页;字节 = `(Get-Item).Length`;`du -sh` 为 Git Bash 实跑)

| 文件 | 改前(基线 `14a46b5`) | 改后(`320ae1e` / `20283fc`) | 变化 |
|---|---|---|---|
| `dist/getting-started/index.html` | 126633 B(123.7 KiB;侧栏 `<nav>` 91743 B,其中 REST 组 77744 B / 177 条 `/api/` 链接) | **49645 B(48.5 KiB;侧栏 14755 B,`/api/` 链接 1 条)** | −60.8% |
| `dist/en/getting-started/index.html` | 127526 B | 50543 B | −60.4% |
| `dist/sdk/api/index.html` | 163793 B | 86805 B | −47.0% |
| `dist/errors/codes/index.html` | 259730 B | 182186 B | −29.9% |
| `dist/api/operations/healthz/index.html` | 127061 B | 127061 B | 0(REST 区内按设计不变) |
| `dist/api/operations/readyz/index.html` | 149067 B | 149067 B | 0 |
| `dist/api/index.html` | 252617 B | 252617 B | 0(总览 `<main>` 列全 170 操作 / 172 条 href) |
| `dist/index.html` | 27456 B | 27456 B | 0(splash 无侧栏) |
| `dist` 合计 | 167936553 B = 160.2 MiB;`du -sh` **165M**(api 29M · sdk/api 61M · en 66M · pagefind 5.3M) | 85563088 B = 81.6 MiB;`du -sh` **87M**(api 29M · sdk/api 24M · en 27M · pagefind 5.3M) | −49.1% |

可达性:`/api/` 总览列全 170 操作;`links` 0 死;Pagefind `docs/feedback` → 2 命中,首位 `/api/operations/v1docsfeedback/`(改前后同,`.lane-tmp/ds30-search-{before,after}.log`);`scripts/check/search-rank` 五词全首位(`.lane-tmp/ds30-search-rank-5.log`);上下页:`getting-started/ios` → 下一页「总览」、`errors/codes` ← 上一页「总览」;操作页上下页保留(`healthz` ← `v1app-usageby-end-user` → `readyz`)。

## 三 实现要点

### DS-29 覆盖率分母(`3c09b75`)

- `scripts/gen/i18n-coverage.mjs`:新增 `isHandwritten(row)`(`row.generated !== true`);`buildCoverage` 的 `summary` = `{ total, handwritten, generated, [locale], byScope: { handwritten: {[l]}, generated: {[l]} } }`,`summary[l]` 保留旧全量口径供对照;`render` 主表 `| 语言 | 已翻译 / 手写页 | 覆盖率 |` 以 `byScope.handwritten[l] / handwritten` 计,末行 `| 生成页(不计覆盖率) | N | — |`;逐页表手写行在前,生成行归 `<details><summary>生成页(N,不计覆盖率)</summary>` 折叠段(`<summary>` 后空一行,CommonMark 才把表当 Markdown 解析——与 releases 生成页同形);frontmatter `description` 报「N 篇手写文章中 … 另有 M 篇由脚本生成的页面随源再生,不计覆盖率」;正文加一段用户口吻说明;stats `{ total, handwritten, generated, [l]: byScope.handwritten[l], glossary }`。
- `scripts/check/i18n-coverage.mjs`:`report()` → `locales[l] = { translated, total(手写), pct, missing(只列手写), all: { translated, total, pct } }` + `generated` 计数;打印两行 `[i18n-coverage] en: 13 / 24 (54.2%) handwritten pages translated; 11 fall back to zh-CN` 与 `[i18n-coverage] en incl. 512 generated page(s): 13 / 536 (2.4%)`;仍只报不红(无 docs 目录退 2)。
- 卷:gen 卷新增「红例 → 绿例」(夹具含 `generated: true` 页、其中一篇有 en 译文:total 5 ≠ handwritten 3,主表须 `1 / 3` 而非 `1 / 5` / `2 / 5`,生成行在 `<details>` 内、手写行在前,stats 两口径);本仓例加 `handwritten + generated = total`、`generated ≥ 488`、覆盖率页自身不进表、`byScope.handwritten.en === summary.en`(手写页无 en 差);check 卷夹具加生成页,断言两口径、清单不含生成页、两行输出与 `--json` 形。
- 再生:`pnpm gen` → `releases/i18n-coverage.md` 671 行(手写 24 · 生成 512 · 合计 536 · en 13;折叠段 L50–568),`gen --check` 零 diff。

### DS-30 REST 侧栏(`320ae1e` + `20283fc`)

- 取证(`.lane-tmp/sidebar-bytes.mjs`):starlight-openapi 的路由中间件(`order: 'post'`,恒在用户中间件之后)把 `openAPISidebarGroups` 占位组(`label` 为 `Symbol(StarlightOpenAPISidebarGroupsLabel)` 字串、`entries` 空)替换为完整操作树并重算上下页;Starlight `SidebarSublist.astro` 渲全部条目,`collapsed` 只改 `<details open>`。
- `src/lib/rest-sidebar.mjs`(`defineRouteMiddleware`):`inRestSection(pathname)` 为真(`/api` · `/api/` · `/api/**`)直接放行;否则 `slimRestSidebar(sidebar, locale)` 把占位组换成 `{ type: 'group', label: CATEGORIES.api[locale] ?? label, entries: [{ type: 'link', href: '/api/', label: OVERVIEW_LABEL[locale] ?? en }] }`;占位组不在场时插件中间件不再注入。组标签走 `CATEGORIES` 各语言列(DS-H 加 ja / ko 后自动跟随);链接文字 `{ root: '总览', en: 'Overview', ja: '概要', ko: '개요' }`(ja / ko 取 Starlight 内建 `tableOfContents.overview`),未列语言回落 en。href 恒根路径 `/api/`,与 `resolve.ts` 里 REST 卡片的既有约定一致(插件不产多语言路由)。
- `astro.config.mjs` 只动 REST 侧栏段:`const sidebar` 上方注释扩为四行说明;`plugins:` 前加注释块 + `routeMiddleware: openApiPresent ? ['./src/lib/rest-sidebar.mjs'] : []`。`locales` 行与 `translations: { en: c.en }` 行零改动(`git diff main -- astro.config.mjs` 两 hunk:L34–39 · L75–81)。
- 卷 `scripts/test/rest-sidebar.test.mjs` 9 例:判形 · 非 `/api/` 页替换 · en 标签且 href 不加前缀 · 未知语言回落 · ja / ko 同 Starlight 字 · `/api/**` 三种路径原引用不动 · 无占位组不动 · `astro.config.mjs` 挂载形 · 构建级(dist 缺席 skip):`getting-started` ≤ 61440 B、`<nav class="sidebar` 内 `href="/api/` 恰 1 条、0 条 `/api/operations/`,操作页 nav ≥ 100 条操作链接。

### DS-31 自动 vendor(`62a11fc`)

- `vendor.yml`:布局为本仓 → `docs/`(`fetch-depth: 0` 供 lastUpdated;保留 GITHUB_TOKEN 凭据以推 main),两上游 → 与之并列的 `upstream/api` · `upstream/cli`(`persist-credentials: false`)——不放进本仓目录,否则 `astro check`(tsconfig `include: ["**/*"]`)会把上游几百个 TS 扫进门;`defaults.run.working-directory: docs`。`cfg` 步读 `UPSTREAM_READ_TOKEN` 与 ref(`inputs → client_payload → 缺省`),缺席 → `::notice::` + `configured=false`,后续 7 步 `if: steps.cfg.outputs.configured == 'true'` 全跳、工作流绿。actions 全部 pin 40 位 sha 且与 `deploy.yml` 同组(checkout v7.0.1 · pnpm/action-setup v6.1.0 · setup-node v7.0.0);pnpm 11 / node 22 与 cli 仓 `packageManager: pnpm@11.3.0` · `engines.node >=22.19` 相容。除 `UPSTREAM_READ_TOKEN` / `GITHUB_TOKEN` 不引用任何 secret。
- `auto.sh`:`set -euo pipefail`;两参目录校验(退 2);`pnpm vendor --api A --cli C` → `pnpm gen` → `git status --porcelain=v1 -uall -- contract src/content`(`-uall` 让未跟踪目录内的新生成页逐个计数)空即「无变化」退 0;非空 → `pnpm gate` 红退 1 不提交,提示补 `contract/release-notes.json` 用户口吻条;绿 → `git -C` 两检出 `rev-parse --short=12` → `git add -A -- contract src/content` → `git -c user.name=github-actions[bot] -c user.email=41898282+github-actions[bot]@users.noreply.github.com commit -q -m "chore(vendor): tansr-api@… · tansr-cli@… —— N 文件再生"` → `git push origin HEAD:main` → `gh workflow run deploy.yml --ref main`。外部命令只经 `pnpm` / `git` / `gh`(行数用 `mapfile` 内建数,不用 grep / wc);`AUTO_REMOTE` / `AUTO_BRANCH` / `DEPLOY_WORKFLOW` 可覆写。
- `auto.test.mjs`:PATH 假件 `pnpm` / `git` / `gh` 记录 `"$*"` 到 `$FAKE_LOG`;`pnpm gate` 按 `FAKE_GATE_EXIT` 退;`git status` 打 `FAKE_STATUS`,`git -C <dir> rev-parse` 按目录尾名回固定 sha。① 无变化 → 退 0、调用序恰 `vendor · gen · status`;② 有变化门绿 → 十条调用序逐条相等(含 bot 身份与消息 N=3);③ 门红 → 退 1、四条调用、零 add / commit / push / gh;④ 少参 / 目录不存在 → 退 2 零调用;另 auto.sh 文本形(`set -euo pipefail` · 直呼命令白名单 = bash 内建 + 自定义函数 + pnpm/git/gh)、vendor.yml 形(触发 · 权限 · 并发 · notice 行不退非 0 · 守卫 ≥ 4 · 两 checkout 五键形 · cli install · 调用形 · secrets 集合恰两把)、actions pin 与 deploy.yml 同 sha、package.json 脚本名与依赖集合不变、README 上游接线在场。bash 沿 `publish.test.mjs` 律(Windows 用 `C:\Program Files\Git\usr\bin\bash.exe`,`bin\bash.exe` 会丢 PATH;缺席 skip)。
- README「部署」段新增「### 上游接线」:工作流行为 · 本地 `pnpm vendor:auto <api> <cli>`(真提交真推,勿在脏树跑)· 兄弟仓一行 `gh api repos/cpple/tansr-docs/dispatches -f event_type=upstream-updated -f 'client_payload[api_ref]=<sha>'` · 各仓需 `DOCS_DISPATCH_TOKEN`(仓自带 GITHUB_TOKEN 不能跨仓派发)· 两把 token 均未创建、等拍。

## 四 与派单不符 / 代拍

### 4.1 与派单不符

| # | 卡 | 派单 | 实做 | 理由 |
|---|---|---|---|---|
| 1 | DS-30 | 文件域 `astro.config.mjs`(REST 段)· `search-weights.mjs`(若需) | 新增 `src/lib/rest-sidebar.mjs` + `scripts/test/rest-sidebar.test.mjs`;`search-weights.mjs` 未动 | 手段 ①② 纯配置做不到(§〇);中间件须独立模块;搜索排名改前后同,无需调权 |
| 2 | DS-30 | 「只改 REST 侧栏段」 | `routeMiddleware` 一行加在 `plugins:` 之前(`defineConfig.integrations[0]` 的 starlight 选项),不在 `sidebar` 数组内 | Starlight 的 `routeMiddleware` 是 starlight() 顶层选项;语义仍属 REST 侧栏;`locales` / `translations` 行零改动 |
| 3 | DS-30 | DoD 只写 getting-started ≤ 60 KB | `/api/**` 页保留完整操作树,体积不变(124–250 KB) | 操作间上下页与同 tag 导航依赖完整树;若要继续减见 §五 |
| 4 | DS-31 | `permissions: contents: write` | 加 `actions: write` | `gh workflow run`(workflow_dispatch API)要求 `actions: write`,否则 403;派单 ⑥ 与 ① 的权限要求互斥,取 ⑥ |
| 5 | DS-31 | `bash scripts/vendor/auto.sh upstream/api upstream/cli` | 本仓检出到 `docs/`,调用 `../upstream/api ../upstream/cli` | 上游若检出到本仓目录内,`astro check` 会扫进上游 TS(tsconfig `include **/*`),门失真;auto.sh 本身接受任意目录 |
| 6 | DS-31 | `git status --porcelain contract src/content` | `git status --porcelain=v1 -uall -- contract src/content` | 固定输出格式;`-uall` 让未跟踪目录(如新增 releases 页目录)内的文件逐个计入 N |
| 7 | DS-31 | 卷「三例」 | 10 例(三例 + 参数校验 + 6 形卷) | 形卷守住 pin / secrets 集合 / 权限 / 守卫,与 `lighthouse.test.mjs` 同律 |
| 8 | DS-29 | 「check 打印两口径」 | 输出由一行改两行;`--json` 结构 `locales[l].total` 改为手写数,新增 `locales[l].all` 与顶层 `generated` | 两口径需两行;仓内无解析旧格式者(gate 只跑不解析) |

另:代码提交 4 而非 3——DS-30 补提交 `20283fc`(ja / ko 「总览」字)属派单允许的「自然拆分」;每次提交前后 gate / test 皆全绿(§2.1)。

### 4.2 代拍(可改)

| # | 卡 | 代拍 | 说明 |
|---|---|---|---|
| 1 | DS-30 | 「总览」链接 href 恒 `/api/`,不随 locale 加前缀 | 插件无多语言路由;沿 `resolve.ts` REST 卡片既有约定 |
| 2 | DS-30 | ja / ko 链接文字取 Starlight 内建 `tableOfContents.overview`(概要 / 개요) | 与站内 Starlight 自带 UI 串一致;DS-H / 用户可改 |
| 3 | DS-30 | 组标签走 `CATEGORIES.api[locale]`,缺列回落根标签「REST 参考」 | DS-H 给 REST 类目加 ja / ko 后自动跟随 |
| 4 | DS-29 | 覆盖率页说明段与 description 文案(「覆盖率只统计手写文章。由脚本从契约副本生成的页面…随源再生、不逐篇翻译,只报数量,不计入覆盖率。」) | 用户口吻自拟,无内部编号 |
| 5 | DS-31 | bot 提交消息「N 文件再生」的 N = `git status` 行数(含新增未跟踪文件) | 派单写「改动文件数」,取最直观定义 |
| 6 | DS-31 | `timeout-minutes: 40` · 本仓 `fetch-depth: 0` · 上游浅克隆 | cli 构建脚本不读 git 历史(核 `build/build.mjs` · `packages/sdk/build.mjs`) |
| 7 | DS-31 | 门红提示文案「在 contract/release-notes.json 补该版本的用户口吻条(或 note「无用户可见变更」)后重跑」 | 沿 release-notes 门既有规则 |

## 五 敞口与给主线的切换 TODO

1. **与 DS-H 收编顺序**:本泳道对 `astro.config.mjs` 的两 hunk 在 L34–39(`const sidebar` 上方注释)与 L75–81(`plugins:` 前的 `routeMiddleware`);DS-H 改 `translations: { en: c.en }`(sidebar 数组内)与 `locales`——不同 hunk,三方合并预计无冲突;若 DS-H 也在 `plugins:` 附近加行需手合。`src/lib/categories.mjs` 本泳道未动。
2. **DS-H 合入后主线须 `pnpm gen`** 再生 `src/content/docs/releases/i18n-coverage.md`(ja / ko 列 + 计数自动扩列;手写分母 24 不变),否则 `gen:check` 红;随后 `pnpm gate`。
3. **vendor.yml 首跑候两把凭据(用户拍板)**:① `UPSTREAM_READ_TOKEN` —— 能读 `cpple/tansr-api` 与 `cpple/tansr` 的 fine-grained PAT(contents: read),配为 tansr-docs **仓级** secret(与 DOCS_* 同级);② 兄弟仓各一把 `DOCS_DISPATCH_TOKEN`(对 `cpple/tansr-docs` contents: write——`repository_dispatch` 所需)+ 兄弟仓 CI 加一步(不在本卡)。未配前推 main 后可 `gh workflow run vendor.yml` 验证 notice 空跑路径(泳道不推)。
4. **main 分支保护**:若 main 禁止直接推 / 要求 PR,bot 的 `git push origin HEAD:main` 会红——主线确认规则或放行 `github-actions[bot]`。
5. **`actions: write`**:授予 GITHUB_TOKEN 对本仓 Actions 的写权(run / cancel);接受度候主线;不接受则改为 deploy.yml 加 `workflow_run`(vendor 成功后触发)——另一形,未做。
6. **真实 vendor 链未真跑**:本卡只有假件 dry-run;首跑真章在 CI:cli 检出 `pnpm install` → esbuild 构建 → `scripts/vendor/index.mjs` 清洁树校验(若 cli 的 install 改动任何跟踪文件即红)。红点排查从 vendor 步的输出起。
7. **`/api/**` 页仍 124–250 KB**(完整操作树 + 内容);若要继续减,可在同一中间件加分支:操作页只保留当前 tag 组 + 总览——候拍。
8. **api 侧**:`contract/openapi.public.json` 部分 operation `summary` 含内部编号(如 `docs/feedback` 的「P2 DS-17」),直接出现在 `/api/operations/*` 页标题与侧栏——api 仓事,建议 api 泳道与 DS-33 同类清理后再 vendor。
9. **`[i18n-coverage]` 门输出两行**:仓内无解析者;若主线台账脚本抓旧一行格式需跟改。
10. **REST 组标签 ja / ko**:`CATEGORIES.api` 加 `ja` / `ko` 列前,ja / ko 页 REST 组标签回落「REST 参考」(中文);DS-H 加列即自动跟随,无需再改本泳道文件。
11. 证据副本已拷 `J:\tansr\archive\ds-G-p3\`(§八);worktree `.lane-tmp/` 在 `.git/info/exclude`,删 worktree 无需另保。

## 六 须主线再生 / 拷入的生成物

- `src/content/docs/releases/i18n-coverage.md`:已随 DS-29(`3c09b75`)再生提交,当前 `gen --check` 零 diff;**DS-H 合入后再 `pnpm gen` 一次**(§五 2)。
- `contract/**` 未动;`dist/` 不入库;无需向兄弟仓拷入任何文件(README「上游接线」只写文档)。
- 无其他生成物变化(`gen:check` 全部生成物零 diff)。

## 七 过程教训

1. **括号是 ASCII**:键入的「全角」括号到达时为 U+28 / U+29,正则里成了分组——卷首跑假红;转义 `\(…\)` 后绿。仓内既有生成页与脚本同样用 ASCII 括号(码点计数核过),输出保持一致。
2. **PowerShell 的 `>` 写 UTF-16**:提交说明 / 日志经 `cmd /c "… > file 2>&1"` 或 node 落盘再读,`Select-String` 直接过滤 UTF-8 CJK 会乱码。`node -e` 内联含引号 / `$` 一律改成 `.lane-tmp/*.mjs` 文件。
3. **Starlight 发的是编译产物**:`node_modules/@astrojs/starlight` 只有 `dist/`(`dist/utils/navigation.js` · `dist/components/SidebarSublist.astro` · `dist/route-data.js` · `dist/translations/*.js`),按 `.ts` 源路径找不到;侧栏 `<nav>` 实际是 `<nav class="sidebar …" aria-label="主要">`,不是 `aria-label="Main"`。
4. **插件中间件顺序**:starlight-openapi 以 `order: 'post'` 注册,Starlight `applyPluginMiddleware` 把 pre 放前、default / post 放后——用户 `routeMiddleware` 恒先跑,可在插件动手前改侧栏;插件只认自己的占位组,替换后不再注入。
5. **假件卷的白名单要含 bash 内建**:`mapfile` 被卷误判为外部命令——红在卷而非脚本;白名单分「内建 / 自定义函数 / 外部」三组写清。
6. **`defaults.run.working-directory` 对 checkout 之前的步同样生效**:目录未检出即报错;检出步放第一。
7. **`astro check` 扫 `**/*`**:上游检出必须放在本仓目录之外,否则门被上游 TS 污染——工作流布局由此定。
8. `git ls-files -s` 核过 `publish.sh` 为 100644,新 `auto.sh` 同模式,工作流以 `bash …` 调用不依赖可执行位。

## 八 索引

### 8.1 改动文件(按提交)

- `3c09b75` DS-29:`scripts/gen/i18n-coverage.mjs` · `scripts/gen/i18n-coverage.test.mjs` · `scripts/check/i18n-coverage.mjs` · `scripts/check/test/i18n-coverage.test.mjs` · `src/content/docs/releases/i18n-coverage.md`
- `320ae1e` DS-30:`astro.config.mjs` · `src/lib/rest-sidebar.mjs`(新)· `scripts/test/rest-sidebar.test.mjs`(新)
- `62a11fc` DS-31:`.github/workflows/vendor.yml`(新)· `scripts/vendor/auto.sh`(新)· `scripts/vendor/test/auto.test.mjs`(新)· `README.md` · `package.json`
- `20283fc` DS-30 补:`src/lib/rest-sidebar.mjs` · `scripts/test/rest-sidebar.test.mjs`
- 本提交:`doc/report/资料站-DS-G-P3-终报.md`

### 8.2 证据(worktree `.lane-tmp/`,已在 `.git/info/exclude`;副本 `J:\tansr\archive\ds-G-p3\`)

- 门 / 卷全量日志:`ds29-gate.log` · `ds29-test.log` · `ds30-gate.log` · `ds30-test.log` · `ds31-gate.log` · `ds31-test.log` · `ds30b-gate.log` · `ds30b-test.log`
- 先红:`ds29-red.log`(6 / 7)· `ds30-red.log`(旧 dist 126633 B)· `ds31-red.log`(0 / 10);绿:`ds29-green-pre-regen.log` · `ds30-unit.log` · `ds30b-unit.log` · `ds31-green.log`
- DS-29 再生:`ds29-gen.log` · `ds29-gencheck.log`
- DS-30 体积与可达:`build-baseline.log` · `build-ds30.log` · `ds30-before.txt` · `ds30-after.txt` · `ds30-links.log` · `ds30-search-before.log` · `ds30-search-after.log` · `ds30-search-rank-5.log`
- 一次性脚本:`sidebar-bytes.mjs`(侧栏 / REST 组字节与链接计数)· `ds30-verify.mjs`(上下页与总览可达)· `yaml-check.mjs`(vendor.yml 结构解析)· `show-msg.mjs`(读 UTF-8 提交说明)
- 提交说明源文件:`msg-ds29.txt` · `msg-ds30.txt` · `msg-ds31.txt` · `msg-ds30b.txt`

### 8.3 参考

- 派单:`J:\tansr\.square-tmp\ds\P3-共同派单.md`(§1 DS-G 行 · §2 DS-29 / 30 / 31 · §3 · §4)· `P1-共同派单.md` 契约 1–7 · `P2-共同派单.md`
- 前车:`doc/report/资料站-P2-收编回执-2026-09-09.md` · `doc/report/资料站-DS-F-P2-终报.md`
- 依赖源码(只读):`node_modules/starlight-openapi/libs/schemas/schema.ts`(sidebar 配置项)· `node_modules/starlight-openapi/index.ts`(`openAPISidebarGroups` 占位组;`addRouteMiddleware({ order: 'post' })`)· `libs/starlight.ts`(`Symbol('StarlightOpenAPISidebarGroupsLabel')`)· `middleware.ts`(插件中间件)· `node_modules/@astrojs/starlight/dist/utils/navigation.js`(`linkFromSidebarLinkItem` locale 前缀)· `dist/components/SidebarSublist.astro` · `dist/route-data.js`(`defineRouteMiddleware`)· `dist/translations/{ja,ko}.js`
- 同仓范式:`scripts/deploy/publish.sh` + `scripts/deploy/test/publish.test.mjs`(假件 dry-run 卷)· `.github/workflows/deploy.yml`(secrets 缺席即空跑 · sha pin)· `scripts/test/lighthouse.test.mjs`(工作流形卷)
