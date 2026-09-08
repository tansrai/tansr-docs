# 资料站 · DS-A(骨架 / 门 / 部署)· P1 终报

> 仓 `tansr-docs` · 分支 `lane/ds/A` · worktree `J:\tansr\worktrees\ds-A` · 基线 main `4a709d3` · 2026-09-08/09。
> 派单:`J:\tansr\.square-tmp\ds\P1-共同派单.md` + tansr-cli 仓 doc/133 §三 / §四 / §六 / §七 · doc/134 §二 DS-01…05 · §三 DS-A 行。
> 恒未 push / 未部署 / 未碰 ECS / 未改兄弟仓。

## 〇 结论一页

- 卡数 5 / 完成 5(DS-01 → 05);提交 6(五卡 + 1 片段 `DS-04/片段(sources 前缀)` 应主线 00:32 令)+ 本终报 1。
- 门终态(HEAD `2c9ba75`,01:03):`pnpm gate` 一次全绿 —— check 0 errors / 0 warnings / 0 hints · build 9 页(含 `/404.html`、`dist/pagefind/`)· gen:check「no generators yet」· lint:text 34 文件 0 违反 · links 153 链 0 死 · frontmatter 4 文件 0 错;`pnpm test` 15 / 15。
- 先红再绿证据条数 13(逐卡见 §二;均写在提交正文)。
- 新卷 4(`scripts/check/test/{lint-text,links,frontmatter}.test.mjs` · `scripts/deploy/test/publish.test.mjs`),15 例。
- 交付下游:package.json 全部脚本名 · frontmatter 契约 schema(`src/lib/contract.mjs` 单一事实源)· 11 类信息架构模块 `src/lib/categories.mjs` · 组件挂点(Header / MobileMenuFooter / Footer / MarkdownContent 覆写,Related / Feedback 挂文章页尾)· openapi 守卫(`hasOpenApi()` + `openAPISidebarGroups`)· 三门 CLI 形与退出码 · `publish.sh` 契约(与 DS-D 对齐:`--chmod=D755,F644`、相对链接 `ln -sfn releases/<sha>` + `mv -Tf`、`/404.html`、尾斜杠)。
- 与派单不符 3 条(§五):typescript 取 6.0.3 而非最新 7.0.2(`astro check` 硬约束)· `src/lib/` 目录(契约 1 未列)· 本机需 `--node-linker=hoisted`(机器残留,非仓问题)。
- 代拍 4 条(§六):内容未落地不产死链的「构建期存在性解析」· `lastVerified` 收 YAML Date · 生成页双向律 · 清理「当前 sha 恒保留」。
- 敞口(§七):Starlight 空侧栏组在 DS-B / DS-C 内容合入前显示为空组;`i18n` 集合 WARN;移动端 splash 页两区入口只在 hero action;CI 未真跑(泳道不 push);部署未真跑(无 secrets、不碰 ECS)。

## 一 提交清单

| 卡 | 提交 | 一句话 |
|---|---|---|
| DS-01 | `4f2bda1` | 仓与骨架:pnpm · Astro 7.3.1 · Starlight 0.42.0 · TS strict · 11 类侧栏 · openapi 守卫 · 脚本名全预留 · 空壳 gen / vendor |
| DS-02 | `44786e6` | 首页与两区:hero 搜索 + 11 类卡片 + 热门 · `/support/` FAQ 分组 · 顶栏两入口 · 页脚法律条目 · 品牌 CSS · 375 px 截图 |
| DS-03 | `afd43bf` | frontmatter 契约 schema · Related / Feedback 挂文章页尾 · 两篇样板 |
| DS-04 | `492ef11` | 三门 + node:test 一红一绿 + `pnpm gate` + ci.yml(actions pin sha)+ favicon(links 门真抓) |
| DS-05 | `71ba9f6` | publish.sh 原子切换 + dry-run 卷 + deploy.yml |
| DS-04/片段 | `2c9ba75` | sources 前缀放行 `tansr-android:` / `tansr-ios:`(主线 00:32 令) |

## 二 逐卡 DoD 与先红证据

### DS-01 仓与骨架(`4f2bda1`)
- DoD:`astro check` 0 · `pnpm build` 出 `dist/` 含 `dist/pagefind/`(Starlight 0.42 内建 Pagefind 目录名为 `pagefind/`,非 doc/134 写的 `_pagefind/`)· package.json 预留契约 2 全部 12 个脚本名 · `pnpm-lock.yaml` 首建(唯一锁文件例外)。
- 先红:
  - `pnpm check` on typescript 7.0.2 → ✖ 「The TypeScript module loaded (found 7.0.2) does not expose the programmatic API that `astro check` relies on … run with 6.x」→ `pnpm add -D typescript@^6`(6.0.3)→ ✔ 0 / 0 / 0。
  - `pnpm build` → ✖ 「Named export 'parseCookie' not found. The requested module 'cookie' is a CommonJS module」。根因:本机盘根 `J:\node_modules`(孤儿 express 安装,`cookie` 0.7.2 CJS)污染 Node 解析——Vite 只外置「从项目根可解析」的依赖,`cookie` 被误判可解析而外置,预渲染时 Node 加载到 0.7.2。仓内无此问题(干净机器 / CI 会打包 `cookie` 2.0.1)。本地对策 `pnpm install --node-linker=hoisted`(不改仓文件,lockfile 零 diff)→ ✔ 3 页。
- 文档 ☑:astro.config.mjs 头注(openapi 守卫语义)。

### DS-02 首页与两区(`44786e6`)
- DoD:构建绿 · 375 px 卡片单列(`doc/report/assets/ds-02-home-375.png` · `ds-02-support-375.png`;1280 三列 `ds-02-home-1280.png`)· 顶栏两入口 · 页脚条款 / 隐私 / ICP 占位。
- 先红:
  - `pnpm check` → ✖ 12 × ts(2307) `virtual:starlight/components/*`(覆写组件沿内部源码用 virtual id,用户侧无类型)→ 改公开路径 `@astrojs/starlight/components/*.astro` → ✔。
  - 375 px 首截:内容溢出、站名被挤。① 桌面 Chrome 最小窗宽 ≈ 500 px,`--window-size=375` 实为 500 px 排版后裁切 → 改 375 px iframe 包裹截图;② `ZoneNav` 自带 `display:flex` 压过 Starlight `sl-hidden` 工具类 → 去掉自带 display,由调用方 `sl-flex / md:sl-flex` 决定 → 复截单列无溢出。
- 设计要点:卡片 / 热门 / FAQ 组的链接在构建期按内容集合解析存在性(`src/lib/resolve.ts`),未落地 → 卡片保留标「即将上线」不带链接、热门榜只列存在页;DS-C 内容合入后自动指向真实页,`links` 门恒 0 死链。

### DS-03 文章模板与 frontmatter 契约(`afd43bf`)
- DoD:`docsSchema({ extend })` 逐字契约 3 · Related(slug 不存在构建期抛)· Feedback(localStorage + 感谢,零网络)· 只挂文章页(`template: doc` 且非 404),splash 不挂 · 两篇样板(`getting-started/index.md` · `support/faq-sample.md`)。
- 先红:
  - 探针缺 zone / category / lastVerified → `pnpm build` ✖ `[InvalidContentEntryDataError] docs → support/red-probe data does not match collection schema`(zone: Invalid option …;category: Invalid option …;lastVerified: Did not match union)。
  - 探针 `related: [errors/does-not-exist]` → ✖ `[Related] support/red-probe: related slug "errors/does-not-exist" 不存在于 src/content/docs` → Caught error rendering `/support/red-probe/`。
  - `lastVerified` 首版只收 string → 真页裸日期 `2026-09-08`(YAML Date)✖ 「Expected type "string", received "object"」→ 改 union(string | Date → 归一 YYYY-MM-DD)→ ✔。
  - `astro check` 12 hints ts(6385) `'z' is deprecated`(`astro:content` 的 z 在 Astro 7 弃用)→ `import { z } from 'astro/zod'` → ✔ 0 hints。
- dist 核:两样板页含 `class="related"` + `data-feedback`;首页 / 帮助中心首页不含。截图 `ds-03-article-1280.png`。

### DS-04 门禁与 CI(`492ef11` + 片段 `2c9ba75`)
- DoD:三门各一红一绿(卷 10 例)· `pnpm gate` 串六步首红即停 · ci.yml push / PR · actions 全 pin sha。
- 先红:
  - links 门首跑真 dist → ✖ dead 9:每页 `<link rel="icon" href="/favicon.svg">` 而仓无 `public/favicon.svg`(Starlight 缺省 favicon 指向)→ 加 `public/favicon.svg` → ✔ dead 0。**这是门在真仓抓到的第一条真问题。**
  - lint-text 真仓探针(BOM + CRLF + 无末行)→ ✖ 3 违反(bom / crlf / no-final-newline)→ 删 → ✔ 0。
  - frontmatter 真仓探针 `sources: [contract/nope.json]` → ✖ `source-not-found (contract/nope.json)` → 删 → ✔ 0。
  - links 卷 `resolveInternal('/a/b/', '../c/#h')` 首跑 ✖ 得 `/a/c`(`posix.resolve` 吞尾斜杠)→ 保留目录形尾斜杠 → ✔。
  - 片段:绿例加 `tansr-api:` / `tansr-android:` / `tansr-ios:`,红例加 `tansr-server:` → 旧 SOURCE_PATTERN ✖ 绿例红(bad-source-form)→ 改 `SOURCE_REPOS` → ✔(红例错数 11 → 12)。
- 卷内红例:lint-text 五码各自命中;links 缺页 / 缺锚点 / 同页缺锚点 3 死链、dist 缺席 notBuilt;frontmatter 12 错(缺字段 / 坏枚举 / 坏日期 / related 不存在 / 坏 slug / sources 不存在 / 坏形 ×2 / 生成页缺 generated / generated 缺标记 / 无 frontmatter)。

### DS-05 部署工作流(`71ba9f6`)
- DoD:`publish.sh` 原子切换 · 失败不切 `current` · 只留 5 份 · 外部命令只 rsync / ssh · dry-run 卷 · deploy.yml(main push → gate → publish;secrets `DOCS_DEPLOY_KEY` / `DOCS_HOST`;`DOCS_HOST_KEY` 可选;同分支排队)。
- 先红:卷首跑 ✖ 3 例(成功例退 1「ssh mkdir 失败」、失败例 calls 0):假件从未被调用,真 `/usr/bin/ssh` 被跑。两层根因:① Windows `process.env` 键是 `Path`,再加 `PATH` 键 → 双键并存,bash 内 PATH 为空;② Git 的 `bin\bash.exe` 是包装器,丢弃继承 PATH(bash 退回编译内建缺省路径),假件永远赢不了 `/usr/bin/ssh` → 改用 `usr\bin\bash.exe` + 单一 `PATH` 键 + 并入 Git `usr\bin`(coreutils)→ ✔ 5 / 5。
- 清理例真跑:7 份、当前 sha 放 mtime 中位 → 剩 `[3333333, 4444444, 5555555, 6666666, 7777777]`(当前保留、删最旧两份)。

### 门终态(`pnpm gate`,HEAD `2c9ba75`)
```
[gate] ▶ check        - 0 errors / 0 warnings / 0 hints
[gate] ▶ build        9 page(s) built(/ /support/ /getting-started/ /support/faq-sample/ + en 四页 + /404.html;dist/pagefind/ 在场)
[gate] ▶ gen:check    [gen] no generators yet (--check: nothing to compare)
[gate] ▶ lint:text    {"files":34,"checked":34,"skippedBinary":0,"violations":0}
[gate] ▶ links        {"pages":9,"checked":153,"dead":0,"external":16}
[gate] ▶ frontmatter  {"files":4,"errors":0}
[gate] summary  ✔ check 16253 ms · ✔ build 10781 ms · ✔ gen:check 1134 ms · ✔ lint:text 1154 ms · ✔ links 947 ms · ✔ frontmatter 926 ms
[gate] ✔ all green
pnpm test: # tests 15 · # pass 15 · # fail 0
```

## 三 逐文件改动

| 路径 | 改了什么 | 为何 |
|---|---|---|
| `package.json` | name `tansr-docs`;12 个脚本名(dev / build / check / gen / gen:check / vendor / vendor:check / lint:text / links / frontmatter / gate / test);deps astro 7.3.1 · @astrojs/starlight 0.42.0 · starlight-openapi 0.26.2 · sharp 0.35.4;devDeps @astrojs/check 0.9.10 · typescript 6.0.3 | 契约 2(DS-A 一人写) |
| `pnpm-workspace.yaml` | `allowBuilds: { esbuild: true, sharp: true }` | pnpm 11 不再读 `package.json#pnpm` |
| `pnpm-lock.yaml` | 首建 | 唯一锁文件例外 |
| `tsconfig.json` | 继承 `astro/tsconfigs/strict` | 派单 |
| `astro.config.mjs` | site / title / locales(root zh-CN + en)/ 11 类侧栏(读 `src/lib/categories.mjs`)/ pagefind / editLink / lastUpdated / customCss / `trailingSlash: 'always'` / components 覆写四处 / starlight-openapi 以 `hasOpenApi()` 守卫 | 契约 1 / 4;主线「站内链接带尾斜杠」 |
| `src/lib/categories.mjs` | 11 类单一事实源(directory / zone / zh / en / 描述 / 图标)+ `ROOT_LOCALE` / `EXTRA_LOCALES` + `OPENAPI_PUBLIC` / `hasOpenApi(root)` | 侧栏与卡片同源 |
| `src/lib/contract.mjs` | 契约常量:`CATEGORY_VALUES` / `ZONE_VALUES` / `SOURCE_REPOS` / `SOURCE_PATTERN` / `SLUG_PATTERN` / `DATE_PATTERN` / `GENERATED_PAGES` / `GENERATED_MARKER` / `REQUIRED_FIELDS` | schema 与门同源 |
| `src/lib/resolve.ts` | 构建期解析:`localeEntries` / `slugToHref` / `resolveDirectoryHref` / `resolveExisting` | 内容未落地不产死链 |
| `src/content.config.ts` | `docsSchema({ extend: articleSchema })`(契约 3 逐字;lastVerified 收 string \| Date) | 契约 3 |
| `src/content/docs/index.mdx` | 首页 splash:hero + HeroSearch + CategoryGrid + HotArticles | DS-02 |
| `src/content/docs/support/index.mdx` | 帮助中心首页 splash:hero + HeroSearch + FaqGroups | DS-02(收编时让位 DS-C `support/index.md`,见 §四) |
| `src/content/docs/getting-started/index.md` · `support/faq-sample.md` | 两篇样板 | DS-03(DS-C 覆写 / 删除) |
| `src/components/Header.astro` | 覆写:站名右侧 `ZoneNav`(≥ 50rem) | 顶栏两入口 |
| `src/components/MobileMenuFooter.astro` | 覆写:菜单页脚承接 `ZoneNav` | 窄屏入口 |
| `src/components/ZoneNav.astro` | 「开发者文档 / 帮助中心」两入口,当前区 aria-current,locale 感知 | — |
| `src/components/Footer.astro` | 覆写:默认三件 + 法律行(条款 / 隐私 / `{ICP 备案号待填}` / 版权) | 页脚 |
| `src/components/CategoryGrid.astro` · `HotArticles.astro` · `FaqGroups.astro` · `HeroSearch.astro` | 首页 / 帮助中心组件 | DS-02 |
| `src/components/MarkdownContent.astro` | 覆写:文章页尾挂 `Related` + `Feedback`(`data-pagefind-ignore`) | DS-03 挂点 |
| `src/components/Related.astro` · `Feedback.astro` | 相关文章(不存在即抛)· 有帮助吗(localStorage) | DS-03 |
| `src/styles/custom.css` | 品牌色(深青 accent)· hero 搜索框 · 卡片网格断点 · FAQ 要点 · 热门 · 文章页尾样式 | DS-02 / 03 |
| `public/favicon.svg` | 品牌图标 | links 门真抓的死链 |
| `scripts/gen/index.mjs` · `scripts/vendor/index.mjs` | 空壳(gen 恒 0;vendor `--check` 0、非 check 退 2) | 契约 2;DS-B 替换 |
| `scripts/check/lint-text.mjs` · `links.mjs` · `frontmatter.mjs` · `gate.mjs` | 三门 + 串门 | 契约 7 |
| `scripts/check/test/*.test.mjs` | 三卷 10 例 | 一红一绿 |
| `scripts/deploy/publish.sh` · `scripts/deploy/test/publish.test.mjs` | 发布脚本 + dry-run 卷 5 例 | DS-05 |
| `.github/workflows/ci.yml` · `deploy.yml` | CI 与部署 | DS-04 / 05 |
| `doc/report/assets/*.png` | 4 张截图 | 终报 §二 |

## 四 交付下游

### 4.1 给 DS-B(vendored + 生成)
- **脚本名已预留**:`pnpm gen` = `node scripts/gen/index.mjs`,`pnpm gen:check` = `… --check`;`pnpm vendor` / `vendor:check` 同形。DS-B 直接**替换** `scripts/gen/index.mjs` 与 `scripts/vendor/index.mjs` 两个空壳(收编时 add/add 冲突以 B 为准;A 的空壳无逻辑)。`--check` 退 0 = 绿,非 0 = 红;`gate.mjs` 只看退出码。
- **openapi 挂载守卫**(`astro.config.mjs`):`hasOpenApi(import.meta.url)` 检 `contract/openapi.public.json`;在场 → `plugins: [starlightOpenAPI([{ base: 'api', schema: './contract/openapi.public.json', sidebar: { label: 'REST 参考', collapsed: false } }])]` 且侧栏 `api` 位替换为 `...openAPISidebarGroups`;缺席 → 不挂插件、`api` 位为空 autogenerate 组,构建照绿。B 若需改挂载段(如 `sidebar.operations.badges`),只改该对象字面量;守卫与位置不动。首页「REST 参考」卡片在契约在场时自动指向 `/api/`(`resolve.ts` 同一判据)。
- **生成页 frontmatter 律**(`frontmatter.mjs` 强制):契约 4 六个路径(`errors/codes.md` · `serve/env.md` · `cli/commands.md` · `releases/{cli,sdk,serve}.md`)须 `generated: true`;frontmatter 后第一行非空行须逐字匹配 `<!-- generated by scripts/gen/<x>.mjs from contract/<y>; do not edit -->`(`GENERATED_MARKER`);反之带 `generated: true` 的文件须带标记。另需 `zone: docs` · `category`(errors / serve / cli / releases)· `lastVerified` · `title` · `description`;`sources` 建议写 `contract/<文件>`(门会核真存在)。
- **锚点**:`links` 门核 `#锚点` 到目标页 `id=`;Starlight 标题 slug 为小写(`#rate_limited` / `#tansr_serve_token` / `#<cmd>`),生成器产标题时请保证与契约 4 一致,DS-C 深链才不红。
- **vendored 副本**放 `contract/`,`lint:text` 会扫(须 LF 无 BOM 末行换行;二进制按 NUL / 扩展名跳过)。

### 4.2 给 DS-C(内容)
- **frontmatter 契约**(`src/content.config.ts` + `frontmatter.mjs` 同源 `src/lib/contract.mjs`):`title` · `description` · `zone: docs|support` · `category`(11 类)· `related?: string[]`(站内 slug 形 `errors/codes`,须存在——当前语言或根语言;不存在**构建期抛**)· `sources?: string[]`(`contract/<path>` 核真存在;`tansr-cli:` / `tansr-api:` / **`tansr-android:` / `tansr-ios:`**(主线 00:32 令,片段 `2c9ba75` 已放行)只校形)· `lastVerified`(`'2026-09-08'` 或裸 `2026-09-08` 皆可)· `generated?`(手写文章不写)。
- **文章页尾自动挂** `Related`(有 `related` 才显示)+ `Feedback`(恒显示),DS-C 不必在正文里放组件;`template: splash` 的页不挂。
- **`support/index.mdx` 与 DS-C `support/index.md` 同 slug**:收编时**保留 DS-C 的 `.md`,删本泳道 `src/content/docs/support/index.mdx`**。须并入 DS-C 页的结构(否则帮助中心首页退化为普通文章页):
  1. frontmatter `template: splash` + `hero:`(title「帮助中心」· tagline · action「返回开发者文档」→ `/`,`icon: left-arrow`,`variant: minimal`)+ `zone: support` · `category: support` · `lastVerified`;
  2. 正文 import 与三段:`import HeroSearch from '../../../components/HeroSearch.astro'` · `import FaqGroups from '../../../components/FaqGroups.astro'`;`<HeroSearch placeholder="搜索帮助中心:密钥、套餐、账单、错误码…" />`;`<h2 id="faq" class="home-section-title">常见问题分组</h2>`;`<FaqGroups />`(三组卡:`support/account` / `support/troubleshooting` / `support/contact`,构建期解析存在性;DS-C 三页落地后自动带链接)。
  3. 注意:import 组件需 `.mdx`;若 DS-C 坚持 `.md`,则 FAQ 分组卡改为 DS-C 正文手写的链接列表,并在 `astro.config.mjs` 无需改动。**建议**:主线合并时把 DS-C 的 `support/index.md` 正文并入本泳道 `support/index.mdx`(hero 之后、`<FaqGroups />` 之前),保留 `.mdx`。
- **首页热门榜候选**(`HotArticles.astro` `DEFAULT_SLUGS`):`getting-started` · `getting-started/sdk` · `getting-started/cli` · `errors/codes` · `serve/env` · `cli/commands` · `support/troubleshooting` · `support/account` · `support/contact`——DS-C 若用别的 slug 命名,请在终报告知主线改此表(只影响首页榜单,不影响门)。
- **两篇样板**(`getting-started/index.md` · `support/faq-sample.md`)DS-C 可覆写 / 删除;`faq-sample` 删后请同步删 `getting-started/index.md` 的 `related: [support/faq-sample]`(否则构建期抛)。
- **内容律门**:`lint:text`(LF 无 BOM 末行换行)· `links`(站内死链 0;外链只警告)· `frontmatter`。`rg` 内部编号门(V-DS-08)不在本泳道范围。

### 4.3 给 DS-D / 主线(部署)
- `scripts/deploy/publish.sh <dist> <host> <sha>`:`rsync -az --delete --chmod=D755,F644 dist/ host:/root/tansr/docs/releases/<sha>/` → `ssh host 'ln -sfn releases/<sha> /root/tansr/docs/current.tmp && mv -Tf /root/tansr/docs/current.tmp /root/tansr/docs/current'`(**相对**链接)→ 清理留 5(当前 sha 恒保留)。环境 `DOCS_ROOT` / `KEEP` / `SSH_OPTS`。首发主线手跑:`bash scripts/deploy/publish.sh dist <user@host> $(git rev-parse HEAD)`。
- 站点产 `/404.html`(Starlight 内建);站内链接带尾斜杠(`trailingSlash: 'always'`;`try_files $uri $uri/index.html =404` 对齐);`dist/pagefind/`(非 `_pagefind/`,nginx 缓存策略请按 `pagefind/` 目录名)。
- `deploy.yml` secrets:`DOCS_DEPLOY_KEY`(ed25519 私钥)· `DOCS_HOST`(`host` 或 `user@host`,缺 user 用 root)· `DOCS_HOST_KEY`(可选,known_hosts 行;缺席 `ssh-keyscan`)。`environment: production` 需在仓设置里存在(或删该行)。

### 4.4 消费(等谁的什么)
- 等 DS-B:`contract/openapi.public.json`(守卫自动挂载)· 六个生成页(侧栏 errors / serve / cli / releases 组自动填)。
- 等 DS-C:18 篇文章(侧栏 / 卡片 / 热门自动填)。
- 等操作者:ICP 文本(`src/components/Footer.astro` 常量 `ICP`)· favicon 若有正式品牌图替换 `public/favicon.svg`。

## 五 与派单不符

1. **typescript 6.0.3 而非最新 7.0.2**:`astro check`(@astrojs/check 0.9.10 / language-server)明示不支持 TS 7 原生编译器的编程 API(「run with 6.x」)。`pnpm add -D typescript@^6`。待上游支持后再升。
2. **新增 `src/lib/` 目录**(契约 1 目录表未列):`categories.mjs` / `contract.mjs` / `resolve.ts`,为 astro.config、组件、schema、门共用的单一事实源;不与 B / C 文件域重叠。
3. **本机 `pnpm install --node-linker=hoisted`**:盘根 `J:\node_modules`(孤儿 express,cookie 0.7.2)污染 Node 解析致 `astro build` 红。未改仓文件、lockfile 零 diff;CI / 干净机器不需要。**建议操作者删除 `J:\node_modules`**(本泳道不动仓外文件)。
4. **Pagefind 目录名** `dist/pagefind/`(Starlight 0.42 内建),doc/134 DS-01 行写 `_pagefind/`、doc/133 §六 nginx 段写 `_pagefind`——以实际产物为准,DS-D nginx 缓存规则请按 `pagefind/`。
5. **check 脚本落 DS-04 而非 DS-01 建空壳**:派单允许「由本卡建空壳或由 DS-B 填」,DS-01 只建了 gen / vendor 空壳,三门在 DS-04 一次落实。
6. **`sources` 前缀增两仓**(片段 `2c9ba75`):契约 3 原文只列 `tansr-cli:` / `tansr-api:`;按主线 00:32 令放行 `tansr-android:` / `tansr-ios:`,收编时契约文本请同步。
7. **DS-02 / DS-03 三张截图与 DS-04 favicon 入库为二进制**:`.gitattributes` 已标 `*.png binary` / `*.svg` 文本;截图仅供终报。

## 六 代拍登记

1. **内容未落地不产死链**(设计空白:首页 11 卡 / 热门 / FAQ 组指向 DS-C 未写的页,`links` 门会红):按「表生成而非手写 + 先红」原则,卡片链接在构建期按内容集合解析存在性;不存在 → 卡片标「即将上线」无链接、榜单只列存在页。影响面:首页 / 帮助中心首页;DS-C 合入后无需改代码。
2. **`lastVerified` 收 YAML Date**:契约写 `'YYYY-MM-DD'`(带引号),但作者极易写裸日期被 YAML 解析成 Date;schema 收 union 并归一为字符串,门按字符串核形。影响面:DS-B / DS-C 两形皆绿。
3. **生成页双向律**:契约 4 只说生成页须 `generated: true`;门补反向:`generated: true` 必带 `<!-- generated by … -->` 标记(防手写文章误标)。影响面:DS-B 生成器须按契约 4 逐字产标记。
4. **清理「当前 sha 恒保留」**:派单只说「只留最近 5 份」;若以 mtime 排序而回滚重跑旧 sha(mtime 旧),朴素 `tail -n +6` 会删掉正在服务的目录。改为跳过当前 sha 再保留 4 份(合计 5)。影响面:`publish.sh` 清理段;卷已锁。

## 七 未完成 / 敞口 / ⏸

- ⏸ **CI 未真跑**:泳道不 push;`ci.yml` / `deploy.yml` 语法与步骤在本地以 `pnpm install --frozen-lockfile` → `pnpm gate` → `pnpm test` 同序验证过,actions sha 经 GitHub API 解析(checkout v7.0.1 · pnpm/action-setup v6.1.0 · setup-node v7.0.0)。首次 push 后请看一次 Actions 页。
- ⏸ **部署未真跑**:无 secrets、不碰 ECS;`publish.sh` 只经 dry-run 卷。首发由主线手跑(§四 4.3)。
- **空侧栏组**:DS-B / DS-C 内容合入前,sdk / serve / cli / android / ios / api / errors / security / releases 九组在侧栏显示为空可折叠组(Starlight 行为);合入后自动填。若主线希望空组不显示,可在 `astro.config.mjs` 侧栏生成处按目录是否有文件过滤(未做,避免与 B 的挂载段争改)。
- **`i18n` 集合 WARN**:构建日志 `The collection "i18n" does not exist or is empty` —— Starlight 检 `i18n` 集合(自定义翻译);未定义即 WARN,不影响门。P2 en 上线若要覆盖 UI 文案再加。
- **移动端 splash 页两区入口**:窄屏顶栏只放站名 + 搜索;splash 页无侧栏菜单,两区入口只在 hero action(「前往帮助中心」/「返回开发者文档」)。文章页窄屏在菜单页脚。
- **`lastUpdated`**:本地未提交文件不显示「最近更新」(读 git log);CI `fetch-depth: 0` 已配。
- **本机残留 `J:\node_modules`**(§五 3):建议操作者删除;否则每次在本机重装依赖须带 `--node-linker=hoisted`。
- **`environment: production`**(deploy.yml):仓未建该 environment 时 GitHub 会自动创建;若主线不想用 environment 审批位,删该行即可。

## 八 回主线摘要

| 卡 | 提交 | 先红 → 绿 | 新卷 | V | 文档 ☑ |
|---|---|---|---|---|---|
| DS-01 | `4f2bda1` | TS 7.0.2 无 check API → 6.0.3 ✔;cookie CJS(盘根残留)→ hoisted ✔ | — | — | astro.config 头注 |
| DS-02 | `44786e6` | virtual: 模块无类型 ✖12 → 公开路径 ✔;375 px 溢出(截图法 + sl-hidden 被压)→ 单列 ✔ | — | V-DS-06(375 单列截图 3 张) | — |
| DS-03 | `afd43bf` | 缺字段 ✖ schema;dangling related ✖ throw;Date ✖ → union ✔;z deprecated 12 hints → astro/zod ✔ | — | V-DS-05(契约) | content.config 头注 |
| DS-04 | `492ef11` | links 真抓 favicon 9 死链 → favicon ✔;lint / frontmatter 探针红 → 删 ✔;resolve 尾斜杠 ✔ | `scripts/check/test/{lint-text,links,frontmatter}.test.mjs`(10 例) | V-DS-05 | 三脚本头注 |
| DS-05 | `71ba9f6` | 假件不命中(Path 双键 + bin\bash 包装器丢 PATH)✖3 → usr\bin\bash + 单键 ✔ 5/5;清理留 5 当前恒保留 ✔ | `scripts/deploy/test/publish.test.mjs`(5 例) | V-DS-07(dry-run) | publish.sh 头注 |
| DS-04/片段 | `2c9ba75` | 绿例加 android / ios 前缀在旧 pattern ✖ → SOURCE_REPOS ✔ | 同上卷 +1 断言 | — | contract.mjs |

- 门终态:`pnpm gate` 全绿(check 0/0/0 · build 9 页 · gen:check 空壳 0 · lint:text 34/0 · links 153/0 · frontmatter 4/0)· `pnpm test` 15/15。
- 须主线再生:无(本仓无共享生成物;`pnpm-lock.yaml` 随 DS-01 提交,唯一例外)。
- 收编要点:① `scripts/gen/index.mjs` / `scripts/vendor/index.mjs` add/add 冲突取 B;② `astro.config.mjs` 以 A 为准,B 的挂载段并入 `plugins` 守卫内的对象字面量;③ `support/index.mdx`(A)与 `support/index.md`(C)同 slug:按 §四 4.2 并结构(建议保留 `.mdx`、并入 C 正文);④ DS-C 若删 `support/faq-sample.md`,同删 `getting-started/index.md` 的 `related`;⑤ nginx 缓存规则按 `pagefind/`(非 `_pagefind/`)。
- 留给主线切换的 TODO:无 `TODO(...)` 标记。
- 操作者项:删 `J:\node_modules`(本机);ICP 文本(`Footer.astro` `ICP` 常量);secrets `DOCS_DEPLOY_KEY` / `DOCS_HOST`(/ `DOCS_HOST_KEY`)。
