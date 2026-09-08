# 资料站 · DS-E(SDK 参考 + 发布说明用户口吻层 + 搜索权重)· P2 终报

仓 `tansr-docs` · 分支 `lane/ds/E` · worktree `J:\tansr\worktrees\ds-E` · 基线 main `3215c42` · 2026-09-09

## 〇 结论一页

- 卡数 3 / 完成 3(DS-16 → DS-23 → DS-27);提交 3 卡 + 本终报 1 = 4;恒未 push、未部署、未碰 ECS、未改兄弟仓;未改 `src/content/docs/en/**` · `Feedback.astro` · `support/contact.*` · `scripts/deploy/**` · `.github/workflows/deploy.yml` · `README.md`。
- 门:`pnpm gate` 全绿(check · build · gen:check · lint:text · links · frontmatter · **release-notes**〔新〕);`pnpm test` 54/54(P1 收编时 41 → +13:sdk-api 5 · release-notes 4 · search-rank 3 · releases / index 改卷);build 1192 页(P1 228 页;新增 sdk/api 482 × 2 locale);links `checked 848743 · dead 0`;lint-text 573 文件 0 违;gen:check 489 文件差 0 / 缺 0;新文件 LF 无 BOM。
- **DS-16**:`@tansr/sdk` API 参考 **482 页**(481 成员页 + 总览 1)= **导出数 482**(值 189 + 类型 293,与 `contract/sdk-index.d.ts` 尾部两行 `export {…}` / `export type {…}` 名字数对表,卷锁);typedoc 0.28.20 + typedoc-plugin-markdown 4.13.0(锁文件 +136 行,本波唯一例外);每符号一页 < 600 页上限,不必改 modules 合页形;输出确定性(二次生成逐字节相同;无时间戳 / 绝对路径);侧栏「TS / Node SDK → API 参考」折叠子组(总览 + 类 / 接口 / 函数 / 类型别名 / 变量 五自动目录)。
- **DS-23**:`contract/release-notes.json` 手维护,三包 **10 个版本段逐条填写**(cli 4 · sdk 3 · serve 3;0.11.1 / 0.6.1 三段之外以 `note` 说明);`releases/{cli,sdk,serve}.md` 改产为「用户口吻层 + `<details>` 折叠 CHANGELOG 原文」;新门 `scripts/check/release-notes.mjs` 入 gate 第七步(缺版本 / 孤儿 / 坏形 / 内部编号皆红;折叠段按主线裁定跳过)。
- **DS-27**:三词首位实测(同一份 `dist/pagefind/pagefind.js`,`<html lang="zh-CN">` 垫片,排序参数取 Starlight 内联产物):`rate_limited` → **/errors/codes/ 第 1**(改前第 3)· `TANSR_SERVE_TOKEN` → **/serve/env/ 第 1**(改前第 58)· `doctor` → **/cli/commands/ 第 1**、/cli/settings-and-doctor/ 第 2(卡面二者任一);另两守卫 `unauthorized` → codes 第 1、`webhook` → v2-and-webhooks 第 1。手段 = 查表页行键元字段 `keys` + `metaWeights { title 5, keys 8 }`;卡面点名的 `data-pagefind-weight` / `excludeSelectors` 实测无效或不适用,理由见 §二 DS-27 与 `src/lib/search-weights.mjs` 头注。
- 敞口(§七):① sdk/api 50 页的 JSDoc 原文含内部编号词(V-DS-08 `rg` 门形),须主线裁定豁免 `sdk/api/**` 或上游改 JSDoc;② dist 245 MB(sdk/api 190 MB,含 en 回落副本),ECS 静态位容量与发布时长须主线掂量;③ 浏览器实测以「同运行时 Node 复现」代真浏览器(本会话 IDE 浏览器不可用),主线合入后建议 `pnpm preview` 手点一遍;④ 主线再 vendor 新 CHANGELOG 版本段后 `release-notes` 门会红,须同步补 `release-notes.json` 条目(设计如此)。

## 一 提交清单

| 卡 | 提交 | 一句话 |
|---|---|---|
| DS-16 | `2c90426` | typedoc 生成 SDK API 参考 482 页(`scripts/gen/sdk-api.mjs` + stubs + 注册 gen + 侧栏 + 卷 + 锁文件) |
| DS-23 | `769e0cf` | `contract/release-notes.json` + `releases.mjs` 改产 + 门 `scripts/check/release-notes.mjs` 入 gate + 卷 |
| DS-27 | `8e07ee4` | 查表页行键元字段 `keys` + `metaWeights` + 卷 `scripts/check/search-rank.mjs`(入 `pnpm test`) |
| 终报 | (本提交) | `doc/report/资料站-DS-E-P2-终报.md` |

## 二 逐卡 DoD 对表

### DS-16 SDK 参考(typedoc)—— `2c90426`

- 门:`pnpm test` 全绿(sdk-api 卷 5 例);`node scripts/gen/index.mjs --check` → `ok 计 489 文件(sdk/api/** 页不逐行打;差 0 / 缺 0)`;`pnpm build` 绿;`links dead 0`。
- 先红:① typedoc 拒 Windows 路径 `The glob "J:\…\sdk-index.d.ts" escapes a non-special character … try posix path separators` → 入口 / tsconfig 一律转 posix;② Starlight ≥ 0.39 侧栏 `Found an autogenerate object with a label … removed` → 改为 `{ label, collapsed, items: [{ autogenerate }] }` 组形;③ 首次 `pnpm links` **704 死链**(typedoc 出的相对 `.md` 链接 vs Starlight 小写目录形 slug;JSDoc 里 `[](…)` 被当空链接;`#constructor` 锚点缺 `api-` 前缀)→ `rewriteLinks`(站内绝对小写 URL)+ `escapeEmptyLinks` + 锚点补前缀 → 0 死;④ 卷「在库零 diff」在临时根红:typedoc 以本机 node_modules 的 zod 4 解析 `z.infer` 折成 `any` → 临时 tsconfig `paths` 钉四份 stub(`zod` / `undici` / `node:stream` / `node:child_process`),与本机装包脱钩;⑤ `AgentSession` 页被 `z.infer` 事件联合内联撑到 1600+ 行 → 预处理 `resolveInferAliases`(TypeScript checker 求出 52 条别名的真实结构改写进临时入口),引用处保留 `KernelEvent` 名字并链到别名页,该页收至 < 800 行。再绿:上列门全绿,`sdk-api:generate … 二次生成逐字节相同` 通过。
- DoD:页数 482(481 + 总览)· 导出数 482 = 189 值 + 293 类型(卷 `countExports` 锁)· frontmatter 逐页 `zone: docs` · `category: sdk` · `sources: ['contract/sdk-index.d.ts']` · `lastVerified: '2026-09-08'`(vendored `vendoredAt`)· `generated: true` · 首行生成头 · 无时间戳 / 无绝对路径(卷正则:盘符反斜杠 · `/Users/` · `/home/` · `node_modules` · 临时目录名 · `worktrees`)· 侧栏子组自动目录 · 页数 < 600 故沿每符号一页(members 形),未改 modules 合页。
- 新卷:`scripts/gen/sdk-api.test.mjs`(countExports 482 / rewriteLinks / transformPage / generate 确定性 / z.infer 预处理)。文档 ☐ `src/content/docs/sdk/api/index.md` 由 typedoc 出,生成头写明来源。

### DS-23 发布说明用户口吻层 —— `769e0cf`

- 门:`node scripts/check/release-notes.mjs` → `{"packages":3,"versions":10,"entries":10,"violations":0}`;`gen --check` 零 diff;`pnpm test` 全绿(release-notes 卷 4 例;releases / index 卷改)。
- 先红:① 门首跑红 `internal-code` ×2:`release-notes.json` 0.5.0 引言写了「发版门 FX-C-25」、serve 0.7.0 写了「权限回执」(`回执` 在词表)→ 改写为用户口吻(「权限请求的应答(`PermissionReceipt`)」);② `pnpm check`(vendor --check)红 `UNLISTED contract/release-notes.json`(手维护件不在 vendored 表)→ `scripts/vendor/index.mjs` 加 `HAND_MAINTAINED_IN_CONTRACT` 白名单并注明其门在 release-notes;③ 卷夹具:缺条目 / 孤儿 / 皆空无 note / date 坏形 / 条目坏形 / 未知包键 / 折叠段外内部编号 / 页缺席 / JSON 不可读 各自出码。再绿:门 0 违、gate 七步绿。
- DoD:三包每版本段有条目(cli 0.5.0〔未发〕· 0.4.0 · 0.3.0 · 0.2.x;sdk 0.12.0〔未发〕· 0.11.1 · 0.11.0;serve 0.7.0〔未发〕· 0.6.1 · 0.6.0)· 「未发」照 CHANGELOG 版本段引言标注并加「候发内容,以实际发版为准」提示 · 页形 = 顶部每版 `## <version>(<日期> | 未发)` + `### 新增 / 变更 / 修复`(空段不出)+ `<details><summary>工程变更原文(CHANGELOG)</summary>`(原文逐字,仅标题整体降两级免入页面目录;`<!-- internal-changelog -->` 包夹)· 折叠段外零内部编号(卷断言 `FX-|W[1-5] 回执|泳道|收编|回执|卡号`)。
- V-DS-08:本仓 `scripts/check/` 原无内部编号扫描,新门即承担——扫 `release-notes.json` 全文与生成页 `<details>` 之外的部分,折叠段跳过(主线 §0 裁定)。词表 = 主线 `rg` 门形 `FX-|W[1-5] 回执|泳道|收编` + 本仓补充 `回执|卡号|复审|十王修案|doc/<n>`。

### DS-27 搜索权重 —— `8e07ee4`

- 门:`pnpm test` 54/54(search-rank 卷 3 例:纯函数 · 内联排序参数含 metaWeights · 三词首位 + 两守卫);`node scripts/check/search-rank.mjs`(= `pnpm search-rank`)exit 0。
- 先红(改前 dist,同一查询运行时):`rate_limited` 136 命中、首位 `/api/operations/v1authsmsrequest/`(标题含 `otp_rate_limited`),/errors/codes/ 第 3;`TANSR_SERVE_TOKEN` 首位 `/releases/serve/`(`tansr` / `serve` 片段命中标题),/serve/env/ 第 58;`doctor` 首位 /cli/settings-and-doctor/(本就达标)。中途红:首版把 h2 / h3 一并写入 `keys`,`webhook` 被 serve/env 的 h2 分组名「/v2 轮末 webhook 出站」抢走首位(31.6 vs 20.6)→ 改为按页取行键层(codes / env 取 h3,commands 取 h2)→ 再绿(v2-and-webhooks 20.6,env 落至 1.3)。
- 实测(zh-cn 索引,ranking = Starlight 缺省 `pageLength 0.1 · termFrequency 0.1 · termSaturation 2 · termSimilarity 9 · diacriticSimilarity 0.8` + `metaWeights { title 5, keys 8 }`):

  | 词 | 命中 | 第 1 | 第 2 | 第 3 |
  |---|---|---|---|---|
  | `rate_limited` | 1 | **/errors/codes/** 48.97 | — | — |
  | `TANSR_SERVE_TOKEN` | 1 | **/serve/env/** 48.97 | — | — |
  | `doctor` | 16 | **/cli/commands/** 31.05 | /cli/settings-and-doctor/ 20.52 | /support/troubleshooting/ 1.45 |
  | `unauthorized`(守卫) | 137 | **/errors/codes/** 13.17 | /api/operations/t1exchange/ 0.43 | /api/operations/t1asr/ 0.41 |
  | `webhook`(守卫) | 15 | **/serve/v2-and-webhooks/** 20.59 | /releases/serve/ 1.38 | /serve/env/ 1.32 |

- 所选手段与理由:
  - Starlight 的 Pagefind 排序参数让正文得分趋近 0,首位几乎只由「查询词命中标题」决定;Pagefind 索引正文时把 `_` 连接词拆开(`rate_limited` → `rate` + `limited`),只有标题 / 元字段保留整词;查询侧保留 `_`(entry `include_characters`),整词查不到才退到拆词——所以改前 136 命中全是片段命中,查表页正文再多提及也压不过操作页标题。
  - 采用:查表页(错误码 / serve 环境变量 / CLI 子命令)的行键标题写成 Pagefind 元字段 `keys`(`MarkdownContent.astro` 挂 `<span data-pagefind-meta="keys:…" hidden>`,空元素、不进布局、不进正文索引),`astro.config.mjs` `pagefind.ranking.metaWeights.keys = 8 > title 5`;其余页面与中文按字索引一律不动。单一事实源 `src/lib/search-weights.mjs`(组件 / 配置 / 卷共用)。
  - 弃(卡面点名项):页面级 `data-pagefind-weight`(试 /api/** 0.3 · /sdk/api/** 0.5 · 查表页 2)——正文分 ≈ 0,乘零仍是零,实测名次一动不动;`excludeSelectors` / `pagefind.yml exclude_selectors`——是 Pagefind CLI 索引期选项,Starlight 经 Node API 建索引不读,且排除 /api/** 会让接口名不可搜。
  - 代价:带 `_` 的整词命中行键后只回查表页一条(正文本无整词可命中,改前那 136 条本就是噪声);要看提及该码的接口页可搜 `rate limited`(空格分词)。
- 卷形:`pagefind` npm 包的 Node API 只管建索引(createIndex / addDirectory / writeFiles),不提供查询;查询运行时只有随索引产出的 `dist/pagefind/pagefind.js`。卷以本机 http 临时端口托起 dist,在 Node 里 import 同一份 pagefind.js,补两处浏览器差异:`<html lang>` 垫片报 `zh-CN`(wasm 胶水层另要 `document.currentScript === null`)、排序参数从 `dist/_astro/Search.astro_*.js` 正则抠取 Starlight 内联的 `{ranking:{…}}`(不另抄常数)。无 dist 时卷 skip 并提示先 build(gate 的 build 在前,`pnpm gate && pnpm test` 顺序即全跑)。

## 三 改动摘要逐文件

| 文件 | 卡 | 改动 |
|---|---|---|
| `package.json` · `pnpm-lock.yaml` | 16 / 23 / 27 | devDeps `typedoc ^0.28.20` `typedoc-plugin-markdown ^4.13.0`(锁 +136 行);脚本 `release-notes` · `search-rank` |
| `scripts/gen/sdk-api.mjs`(新) | 16 | typedoc 驱动:临时 tsconfig(posix 路径 · skipLibCheck · `paths` 钉 stubs)· `resolveInferAliases` 预处理 · `rewriteLinks` / `escapeEmptyLinks` · frontmatter + 生成头 · `KINDS` 分类目录表(供侧栏)· `countExports` |
| `scripts/gen/sdk-api-stubs/*.d.ts`(新 4) | 16 | zod / undici / node:stream / node:child_process 最小声明,令类型解析与本机装包脱钩 |
| `scripts/gen/index.mjs` · `lib.mjs` | 16 | 注册 `sdkApi`;生成器链转 async;sdk/api/** 不逐行打、只汇总计数 |
| `src/content/docs/sdk/api/**`(新 482) | 16 | 生成物 |
| `astro.config.mjs` | 16 / 27 | `sdkSidebarItems()`:手写页 + 折叠「API 参考」子组(总览 + 五自动目录);`pagefind: { ranking: { metaWeights } }` |
| `contract/release-notes.json`(新) | 23 | 手维护:三包 10 版本 `{ date?, added, changed, fixed, note? }` |
| `scripts/gen/releases.mjs` | 23 | `parseVersionSections` / `demoteHeadings` / `renderUserSection`;页形改产;`sources` 双源 |
| `scripts/check/release-notes.mjs`(新)· `gate.mjs` | 23 | 门(覆盖 / 孤儿 / 形 / 日期 / 内部编号 / 页缺席);gate 第七步 |
| `scripts/vendor/index.mjs` | 23 | `HAND_MAINTAINED_IN_CONTRACT = {release-notes.json}` 免 UNLISTED |
| `src/content/docs/releases/{cli,sdk,serve}.md` | 23 | 生成物 |
| `src/lib/search-weights.mjs`(新) | 27 | `KEY_PAGES`(slug + 行键层 depth)· `META_WEIGHTS` · `keyPageOf` · `keysMetaValue`;头注载理由与弃案 |
| `src/components/MarkdownContent.astro` | 27 | 查表页挂 `data-pagefind-meta="keys:…"` 空元素(其余不动) |
| `scripts/check/search-rank.mjs`(新) | 27 | 首位核 CLI + `searchRank()`(供卷) |
| 卷:`scripts/gen/sdk-api.test.mjs`(新)· `scripts/gen/index.test.mjs` · `scripts/check/test/release-notes.test.mjs`(新)· `scripts/check/test/search-rank.test.mjs`(新) | — | 见 §二 |

## 四 跨泳道接口

### 4.1 与 DS-F(en/** · Feedback · contact)
- 未改 `src/content/docs/en/**` · `Feedback.astro` · `support/contact.*`。**`MarkdownContent.astro` 本波改了 3 行**(import + `keyPage` 两常量 + 一行 JSX);若 DS-F 也动此文件,合入时以「保留 `<slot />` 前的 `keysMeta` span」为准,冲突面极小。
- en 回落:Starlight 对根 locale 页无 en 译文时回落渲染 `/en/**`,故 sdk/api 482 页在 en 下也各有一份(build 1192 页);`keyPageOf` 去掉 `en/` 前缀,`/en/errors/codes/` 等同样挂 `keys`。

### 4.2 与主线 / 部署
- `pnpm gate` 步序改为七步(末步 `release-notes`);`pnpm test` 含 search-rank(无 dist 即 skip,不阻塞纯单测)。
- `astro.config.mjs` 引入 `scripts/gen/sdk-api.mjs`(取 `KINDS`)与 `src/lib/search-weights.mjs`(取 `META_WEIGHTS`);二者无 node 侧副作用(纯常量 + 函数;sdk-api 的 typedoc 动态 import 仅在 `generate` 内)。
- 生成物再生口径见 §八。

### 4.3 交付给内容侧
- 用户口吻层的写法约束(供后续维护 `release-notes.json`):每条写「变了什么 · 对你意味着什么 · 迁移方式」;不写卡号 / 波次 / 回执;三段皆空写 `note`;`date` 只在 CHANGELOG 标题带日期时填。门会逐条核。

## 五 与派单不符之处

1. **DS-27 手段**:派单列的 `data-pagefind-weight` / `excludeSelectors` / `pagefind.yml` 三项实测均不能达标(理由 §二),改用元字段 + `metaWeights`;派单要求「写清所选手段与理由」,已写入 `src/lib/search-weights.mjs` 头注与本报。
2. **DS-27 卷**:派单写「以 Pagefind Node API 对 dist/pagefind 索引跑三词搜索」——`pagefind` 包的 Node API 无查询能力,卷改为 Node 里跑 `dist/pagefind/pagefind.js`(浏览器同一运行时),语义等价且更贴浏览器。
3. **DS-27 `doctor` 首位**:落在 `/cli/commands/`(第 2 为 `/cli/settings-and-doctor/`),派单二者任一皆可;若主线更想让「设置与 doctor」居首,把 `keys` 权重降到 5 以下即可反转(commands 元字段贡献 ≈ 3.26 × 权重),但会同时削弱码名 / 变量名查询的优势,未擅动。
4. **DS-23 `note` 文案**:0.11.1 / 0.6.1 有一条用户可见新增(存储出口再导出),不适用字面「无用户可见变更」,`note` 写「无其他行为变化」;门只要求三段皆空时须有 `note`,此处三段非空,`note` 作末段说明。
5. **DS-16 `lastVerified`**:取 `vendored.json` 中 `sdk-index.d.ts` 的 `vendoredAt = 2026-09-08`(派单原文),非本波日期。
6. **浏览器实测**:派单写 `pnpm preview` 浏览器搜三词;本会话 IDE 浏览器不可用(`No browser tab available`),以同运行时 Node 复现(§二 卷形)代之,建议主线合入后手点复核(§七 ③)。

## 六 代拍登记

均为执行面判断,不涉命名 / 钱 / 对外承诺 / 不可逆 / 架构转向;若主线不认可,逐条可回退:

1. `metaWeights.keys = 8`(title 保持缺省 5):取「压过标题片段命中且不至于让查表页吞掉所有泛词」的最小整数;实测 6–8 三词皆达标,取 8 留余量。
2. 行键层按页指定(codes / env → h3,commands → h2),不取分组 h2(`webhook` 守卫的教训)。
3. 卷多加两守卫词 `unauthorized` / `webhook`(派单只要三词):前者证元权重对无 `_` 码名同样起效,后者防泛词被查表页抢走。
4. `release-notes.json` 落 `contract/` 并进 vendor 白名单(而非另起目录):派单 §0 手维护形写的就是 `contract/release-notes.json`。
5. 内部编号词表在主线 `rg` 门形之上补 `回执|卡号|复审|十王修案|doc/<n>`(本仓 CHANGELOG 原文实有这些词形)。
6. DS-16 `z.infer` 预处理与四份 stub:为确定性与可读性(§二 先红 ④⑤),不改 vendored 源文件一字。
7. DS-16 `expandObjects: true`:内联对象形直接展开,免得每个匿名对象再开一页。
8. `gen` / `gen:check` 对 sdk/api/** 只打汇总(482 行日志淹没其他生成物)。

## 七 未完成 / 敞口 / ⏸ 项

1. **sdk/api JSDoc 内部编号(须主线裁定)**:482 页中 **50 页**的 JSDoc 原文含 `FX-|W[1-5] 回执|泳道|收编` 词形(上游 `packages/sdk` 源码注释,typedoc 逐字带出)。本仓 lint-text 不扫这些词,故 gate 绿;但主线 V-DS-08 `rg` 门形会命中。两条路:(a) 豁免 `src/content/docs/sdk/api/**`(生成物,来源可溯);(b) 上游 tansr-cli 清理 JSDoc 后再 vendor。本泳道不改兄弟仓,未动。
2. **dist 体量**:245 MB(sdk/api 190 MB,含 en 回落副本 ×2;P1 收编时远小于此)。ECS 静态位容量、rsync / 上传时长、`releases/<sha>` 保留份数须主线掂量;可选减法:`outputFileStrategy: modules` 合页(页数 482 → 6 左右,但深链粒度变粗)、或 en 下不回落 sdk/api。属架构 / 部署面,未擅动。
3. **浏览器实测**:见 §五 6。Node 复现与浏览器仅差 ICU 版本(`Intl.Segmenter`,对纯 ASCII 查询词无影响)。
4. **release-notes 门与再 vendor 的耦合**:主线 vendor 到新 CHANGELOG 版本段时门必红,须同波补 `release-notes.json`——这是派单要的「缺即红」,登记提醒而非缺陷。
5. **search-rank 卷依赖 build 产物**:无 dist 时 skip(非 fail);若主线希望「未 build 即红」,把 skip 改成 assert 一行即可。
6. **P1 遗留未动**:cli 子命令 13 vs 派单 21、错误码「面 / 可重试 / 说明」字段手维护等 P1 敞口不在本波卡内。

## 八 回主线摘要

- 合入 `lane/ds/E` 三卡 `2c90426` · `769e0cf` · `8e07ee4` + 终报;基线 `3215c42`,与 DS-F 唯一可能交集为 `src/components/MarkdownContent.astro`(3 行,见 §4.1)。
- **须主线再生的生成物**(合入或再 vendor 后各跑一次 `pnpm gen && pnpm gen:check`):① `src/content/docs/sdk/api/**`(482 文件;源 `contract/sdk-index.d.ts`;typedoc / plugin 版本锁在 lockfile,升级二者须重生并核 `sdk-api` 卷);② `src/content/docs/releases/{cli,sdk,serve}.md`(源 CHANGELOG ×3 + `contract/release-notes.json`);③ `dist/`(部署件;`pnpm build` 后 `pnpm test` 才跑 search-rank 三词断言)。
- **须主线拍板 / 裁定**:§七 ①(sdk/api JSDoc 内部编号:豁免或上游改)· §七 ②(dist 245 MB 的部署容量与是否合页)。
- **主线验收命令**:`pnpm install --frozen-lockfile --node-linker=hoisted && pnpm gate && pnpm test && pnpm search-rank`;期望 gate 七步绿、test 54/54、search-rank 五词首位 ✓。
- **口径变化**:gate 七步(+release-notes);`contract/` 多一份手维护件 `release-notes.json`(vendor --check 白名单);发布说明页形改为「用户口吻层 + 折叠原文」;搜索排序加 `keys` 元权重,其余 Pagefind 行为不变。
