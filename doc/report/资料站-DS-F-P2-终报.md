# 资料站 · DS-F(反馈 / 联系表单接 api · en 首批 · Lighthouse CI)· P2 终报

> 仓 `tansr-docs` · 分支 `lane/ds/F` · worktree `J:\tansr\worktrees\ds-F` · 基线 main `3215c42` · 2026-09-09 03:00–05:00 CST。
> 派单:`J:\tansr\.square-tmp\ds\P2-共同派单.md` §0「api ↔ docs 端点契约」四条 + 「docs 侧消费形」+ 主线裁定「en 首批 10 篇」「Lighthouse CI」+ §1 DS-F 行;契约沿 `P1-共同派单.md` 1–7;执行律沿 tansr-cli 仓 doc/133 / doc/134 §0。
> 恒未 push / 未部署 / 未碰 ECS / 未改兄弟仓 / 未改 `package.json` 与 lockfile / 未改 `astro.config.mjs` · `scripts/gen/{releases,sdk-api}.mjs` · `contract/release-notes.json` · `scripts/deploy/**` · `.github/workflows/deploy.yml` · `README.md`。

## 〇 结论一页

- 卡数 3 / 完成 3(DS-28 · DS-19 · DS-21);提交 3 卡 + 本终报 1。
- 门终态(HEAD `1a4b58b`,04:53):`pnpm gate` 一次全绿 —— check 51 文件 0 errors / 0 warnings / 0 hints · build 230 页 · gen:check 8 生成物零 diff · lint:text 102 文件 0 违反 · links 230 页 56344 链 0 死(444 外链未查)· frontmatter 38 文件 0 错 · i18n:coverage en 10 / 27(37%,只报不红)。`pnpm test` 95 / 95(P1 41 + DS-28 7 + DS-19 42 + DS-21 5)。
- Lighthouse 本机(`@lhci/cli@0.15.1`,Chrome 本机,移动端模拟,dist 构建产物):**/ 100·100·100·100 · /errors/codes/ 100·100·100·100 · /support/ 100·100·100·100**(performance · accessibility · best-practices · seo;首跑 /errors/codes/ performance 0.97,其余同;断言两次全过)。a11y 先红一处(`label-content-name-mismatch`,HeroSearch 的 `aria-label="搜索"` 不含可见文字)→ 去 aria-label 后绿。
- DS-28:`Feedback.astro` 接 `POST /v1/docs/feedback`,非 2xx / 网络错回落 P1 localStorage,界面恒显感谢;新 `ContactForm.astro` 接 `POST /v1/support/tickets`(四字段 + 蜜罐 `website` + 三态),`support/contact.md → .mdx` 挂组件;api 端点未上线,本机假 http 服务(node 内建)模拟 202 / 429 / 503 + 真 Chrome 端到端 11 / 11 过(§二 逐条入出)。
- DS-19:en 首批 10 篇落地(路径 §四 4.1),`src/lib/glossary.mjs` 94 条术语 + 禁用变体(DS-19 提交信息误写 99,以本文与 `GLOSSARY.length` 为准),`releases/i18n-coverage` 生成页(表 slug / zh-CN ✓ / en ✓|回落 + 术语表)入 `gen` 注册且 `--check` 零 diff,`scripts/check/i18n-coverage.mjs` 只报不红入 `gate` 末尾。
- 与派单不符 6 条(§五):`scripts/gen/index.mjs` 实为 +1 import 行 + GENERATORS 数组行尾追加(非严格「只加一行」)· `scripts/gen/index.test.mjs` 生成物计数 7 → 8 · `src/lib/contract.mjs` GENERATED_MARKER 放行 `from src/content/docs` · `gate.mjs` 以 DIRECT_STEPS 直跑脚本(不占 package.json)· `.gitignore` +1 行 · 触 DS-A 组件 `HeroSearch.astro`(a11y,派单允许)。
- 代拍 3 条(§六):en 代码块**含中文注释 / 提示词一并照抄**(严守「代码块照抄」律;是否放宽为「注释可译」待用户拍板)· 内容页内链恒 `/en/...`(Starlight 回落保证存在)而生成页链根路径 · coverage 页 `lastVerified` 取被扫文章最大值而非当日。
- 敞口(§七):en 页 `<title>` 后缀仍为「tansr 资料站」(站名在 `astro.config.mjs`,DS-E / 主线域)· api 端点上线前反馈走 localStorage、工单显失败 + mailto(设计如此)· api 侧须放行 CORS origin `https://docs.tansr.com` · `lighthouse.yml` 首跑候 main 推送 · 主线收编 DS-E 后须 `pnpm gen` 再生 `releases/i18n-coverage.md`(slug 集变)· 本机误杀 ds-A worktree 的 `astro preview` 进程一次(已登记)。

## 一 提交清单

| 卡 | 提交 | 时间 | 一句话 |
|---|---|---|---|
| DS-28 | `aba763e` | 04:13 | 反馈 + 联系表单接 api:`api-base.ts` · `docs-api.mjs` 纯函数 · `Feedback.astro` fetch + 回落 · 新 `ContactForm.astro` · `support/contact.mdx` · 7 例卷 · 假 http 端到端 11 / 11 · 两张截图 |
| DS-19 | `e5bea46` | 04:35 | en 首批 10 篇 · `glossary.mjs` · `gen/i18n-coverage.mjs` 生成页 · `check/i18n-coverage.mjs` 只报不红 · gate 末尾一步 · 42 例卷 |
| DS-21 | `1a4b58b` | 04:47 | `lighthouserc.json` · `.github/workflows/lighthouse.yml`(sha pin,`@lhci/cli@0.15.1`)· HeroSearch a11y 修 · 5 例卷 · 本机两跑分数 |
| 终报 | (本提交) | — | `doc/report/资料站-DS-F-P2-终报.md` |

提交信息均经 UTF-8 无 BOM 文件 `git -c i18n.commitEncoding=utf-8 commit -F`;全部新文件 LF 无 BOM 有末行换行(node 逐字节核)。

## 二 逐卡 DoD 与先红证据

### DS-28 反馈 + 联系表单接 api(`aba763e`)

**落地形**

- `src/lib/api-base.ts`:`API_BASE = normalizeApiBase(import.meta.env.PUBLIC_TANSR_API_BASE, 'https://api.tansr.com')`(去尾斜杠、非 http(s) 回缺省);`.env.example` 一行 `PUBLIC_TANSR_API_BASE=https://api.tansr.com`。
- `src/lib/docs-api.mjs`(浏览器 / node 共用纯函数,零依赖,不 import astro):`feedbackUrl / ticketsUrl` · `normalizeLocale`(只认 zh-CN / en)· `feedbackPayload`(`{ path, helpful, locale }`;path 形 `^/[a-z0-9\-/]*$` ≤ 200,不合形 → null 直接回退不发)· `isHoneypotTripped` · `validateTicket`(subject 1–120 · body 1–4000 · email ≤ 254 且合形,可选)· `ticketPayload`(可选项空即省略;`website` 恒不进载荷)· `shouldFallback`(非 2xx / 无响应)· `ticketIdOf`(`tk_<26 位 ulid>`)· `failureKind`(429 → rate-limited,其余 unavailable)· `mailtoFallback`(带主题 / 正文,正文截 1500)。
- `Feedback.astro`:点击 → 先落 localStorage 先显感谢 → `fetch(POST {base}/v1/docs/feedback, { path, helpful, locale })`(`mode: cors` · `keepalive` · 5 s `AbortSignal.timeout`);2xx → `delivered:true`;非 2xx / 网络错 → 保持本地记录 `delivered:false`,界面不变,只 `console.debug` 一条(不暴露状态码以外细节);locale 按 `Astro.currentLocale`(根 = zh-CN)。
- `ContactForm.astro`(新):subject / body / email(可选)/ 蜜罐 `website`(移出视口 + `aria-hidden` + `tabindex=-1` + `autocomplete=off`);状态机 idle → submitting(按钮禁用 · `aria-busy`)→ success(显 `ticketId`)| error(429 显限流文案;其余显「暂时无法提交,请发邮件 support@tansr.com」+ 带主题 / 正文的 mailto);蜜罐命中 → 本地假成功零请求(与服务端「非空即 202 假成功」同律);校验不过不发请求、逐字段 `aria-invalid` + 提示;`<noscript>` 给 mailto;文案两语(zh-CN / en,按 `Astro.currentLocale`);零第三方脚本。
- `src/content/docs/support/contact.md → contact.mdx`(`git mv`;frontmatter 不变,`related` / `sources` 保留)入口二段下挂 `<ContactForm />`;`custom.css` 追加表单 / 状态 / 蜜罐样式(沿 Starlight 变量,深浅色同源)。

**先红再绿**(`scripts/test/docs-api.test.mjs`,7 例:基址归一 · url 形 · 反馈载荷 / locale · 工单校验与载荷 · 蜜罐 · 回退判 / ticketId / failureKind / mailto · 组件静态形)

1. 旧码(无 `src/lib/docs-api.mjs`):`node --test scripts/test/docs-api.test.mjs` → ✖ `ERR_MODULE_NOT_FOUND src/lib/docs-api.mjs`(tests 1 / fail 1)。
2. 纯函数落地、组件未落:→ ✖ 6 / 7,「组件静态形」例 `ENOENT src/components/ContactForm.astro`。
3. 两组件 + `contact.mdx` 落地:→ ✔ 7 / 7;`pnpm test` 48 / 48。

**端到端(api 端点未上线;仓外假 http 服务 node 内建 · 真 Chrome 152 headless(puppeteer-core)· `astro preview`;dist 以 `PUBLIC_TANSR_API_BASE=http://127.0.0.1:8787` 构建,e2e 后按缺省基址重建)**

假服务按 P2 §0 端点契约:CORS 只放 origin `http://localhost:4321` / `https://docs.tansr.com`(预检 OPTIONS → 204);`/v1/docs/feedback` 校 path 形 / helpful 布尔 / locale ∈ {zh-CN, en} → 202 `{ ok: true }`;`/v1/support/tickets` 校 subject / body 长度 → 202 `{ ok: true, ticketId: 'tk_<ulid>' }`,`website` 非空 → 假 202;模式经 `GET /__mode/<202|429|503>` 切换,429 回 `{ error: { code: 'rate_limited' } }`,503 回 `{ error: { code: 'auth_channel_undelivered' } }`。

| # | 输入(页面动作) | 假服务收到(逐字) | 页面结果 |
|---|---|---|---|
| 1 | mode 202;`/support/contact/` 点「有帮助」 | `OPTIONS /v1/docs/feedback` → `POST` body `{"path":"/support/contact/","helpful":true,"locale":"zh-CN"}` | 感谢文案;localStorage `delivered:true` |
| 2 | mode 202;填 subject「[命令行] tansr init 提示 PAT 无效」· body 三行 · email `dev@example.com` 提交 | `OPTIONS /v1/support/tickets` → `POST` body `{"subject":"[命令行] tansr init 提示 PAT 无效","body":"tansr --version 0.4.0\ntansr doctor --json 摘要……\n复现:tansr init --fresh","locale":"zh-CN","email":"dev@example.com","page":"/support/contact/"}` | success 态;显 `tk_` + 26 位 ulid;提交按钮禁用 |
| 3 | mode 429;填「第二次提交 / 限流形」提交 | `POST /v1/support/tickets` body `{"subject":"第二次提交","body":"限流形","locale":"zh-CN","page":"/support/contact/"}`(email 空即省略) | error 态;限流文案;mailto 带主题 / 正文;按钮可再试 |
| 4 | mode 503;填「[会话服务] resume 恒 409 / 邮件通道未配形」提交 | `POST /v1/support/tickets` body `{"subject":"[会话服务] resume 恒 409","body":"邮件通道未配形","locale":"zh-CN","page":"/support/contact/"}` | error 态;「暂时无法提交,请发邮件 support@tansr.com」+ mailto |
| 5 | mode 503;点「没帮助」 | `POST /v1/docs/feedback` body `{"path":"/support/contact/","helpful":false,"locale":"zh-CN"}` | 感谢仍显;`delivered:false`;console.debug 一条 |
| 6 | mode 429;点「有帮助」 | `POST /v1/docs/feedback` body `{"path":"/support/contact/","helpful":true,"locale":"zh-CN"}` | 感谢仍显;`delivered:false` |
| 7 | 蜜罐 `website` 填值提交 | (零请求) | success 态无编号 |
| 8 | 三字段全空提交 | (零请求) | idle;三条字段提示 + `aria-invalid` |
| 9 | 假服务停;点反馈 + 提交工单 | `ERR_CONNECTION_REFUSED` | 反馈感谢仍显;工单 error + mailto |
| 10 | 全程控制台 | — | 只 `console.debug` 6 条;零未捕获错误 |
| 11 | 两语 | `/en/support/contact/` 渲染 `data-contact-locale="en"` 英文文案 | — |

11 / 11 PASS(第二轮重跑同结果,假服务日志 #9–#14 同形)。截图 `doc/report/assets/ds-28-ticket-{202,503}.png`。

### DS-19 en 首批 10 篇(`e5bea46`)

**落地形**

- 10 篇 `src/content/docs/en/...`(路径 §四 4.1):与 zh-CN 同 slug 同扩展名(`support/index.mdx` · `support/contact.mdx` 沿同一组组件 `HeroSearch` / `ContactForm` 等,import 相对路径多一级);frontmatter `zone / category / related / sources` 与 zh-CN 逐字同,`lastVerified: '2026-09-09'`;`title / description` 英文。译文律:忠实、不增删事实;命令 / 键名 / 错误码不译;**代码块逐字节照抄 zh-CN**(含其中中文注释与提示词,见 §六 1);内链:内容页 → `/en/<slug>/`(Starlight 回落保证存在;未译页显示中文并页顶提示),生成页(`errors/codes` · `cli/commands` · `serve/env` · `releases/*`)→ 根路径(与 zh-CN 同形,不带尾斜杠)。
- `src/lib/glossary.mjs`:94 条 `{ zh, en, avoid?, note? }`(会话服务 = session service · 套餐 = plan · 密钥 = key,PAT = personal access token (PAT),应用密钥 = app key · 终端令牌 = end-user token (`app_user` token) · 逃生态 = escape hatch (fully local mode) · 派生键 = derived key (device key) · 出网白名单 = egress allowlist · 上下文压缩 = context compaction · 能力位 = capability flags · 即将随 … 提供 = coming in … 等);`findGlossaryViolations`(整词不分大小写扫 `avoid` 变体)· `proseOnly`(去代码块 / 行内代码 / 链接目标 / import 行)· `CJK_PATTERN`。
- `scripts/gen/i18n-coverage.mjs`:扫 `src/content/docs` 根 + `en/**` slug 集 → `src/content/docs/releases/i18n-coverage.md`(frontmatter 契约 · 标记行 `<!-- generated by scripts/gen/i18n-coverage.mjs from src/content/docs; do not edit -->` · 覆盖率表 · 逐页表 slug / zh-CN ✓ / en ✓+英文标题链接|回落 · 仅译文语言存在的孤儿页 · 术语表整表);本页自身不进表(自指收敛);`lastVerified` 取被扫文章最大值(跨日 `--check` 零 diff);`scripts/gen/index.mjs` 注册(排在 releases 之后,保证生成页已在 slug 集)。
- `scripts/check/i18n-coverage.mjs`:打印各语言「已翻译 / 总数(%)」与未译 slug(缺省前 10 条,`--list` 全列,`--json` 机器形);**恒 exit 0**;唯一红:无 `src/content/docs`(exit 2,跑错目录)。`scripts/check/gate.mjs` STEPS 末尾加 `i18n:coverage`,以 `DIRECT_STEPS` 直跑脚本文件(不占 `package.json` 脚本名)。

**先红再绿**

1. `scripts/test/i18n.test.mjs` 内置红例:`'Start the session server, then 会话服务 replies. See \`会话服务\` and [x](/会话/).'` → `proseOnly` 后仍命中 CJK(正文)、不命中行内代码与链接目标;`findGlossaryViolations` 返回 `[{ variant: 'session server', en: 'session service' }]`;`'the session service is up'` → `[]`。
2. 首轮跑 42 例 → ✖ 7:
   - `avoid` 变体「access token (PAT)」误伤主形「personal access token (PAT)」(10 篇 en 正文里 PAT 处全红)→ 改为「private access token」;
   - `render` 自指:首轮把 `releases/i18n-coverage` 自身计成一篇「回落」,写回后再生成不收敛 → `buildCoverage` 排除 `OUT_SLUG`(含 `en/` 前缀形),二次生成零 diff(测例「自指收敛」);
   - 「代码块与 zh-CN 逐字同」:sdk 1 块 · cli 2 块 · serve 5 块 · android 5 块 · troubleshooting 1 块(共 14 块)曾译注释 / 提示词 → 按律回抄 zh-CN;
   - 链接测例首版要求尾斜杠、要求「有 en 版才链 /en/」,与 zh-CN 现形(生成页链无尾斜杠)及 Starlight 回落形不符 → 改为「内容页恒 /en/,生成页恒根路径」;
3. 终态 42 / 42(gen 6 · check 3 · i18n 33);`node scripts/gen/index.mjs --check` 8 生成物零 diff;`node scripts/check/i18n-coverage.mjs` → `[i18n-coverage] en: 10 / 27 (37%) translated; 17 fall back to zh-CN`。

**构建核**:`astro build` 230 页(root 27 内容页 + en 27:10 篇实译 + 17 篇回落 + 生成 / 404 / pagefind);`/en/getting-started/` `<title>` = `Getting started: pick a path, run in 5 minutes | tansr 资料站`;`/en/sdk/checkpoints/` 回落显中文标题;`/en/support/contact/` 渲染 `ContactForm` 英文文案;links 0 死。

### DS-21 Lighthouse CI(`1a4b58b`)

**落地形**

- `lighthouserc.json`:`ci.collect.staticDistDir: "dist"` · `url: ["/", "/errors/codes/", "/support/"]` · `numberOfRuns: 1` · `settings: formFactor mobile + screenEmulation 412×823 dpr 1.75 + throttlingMethod simulate + chromeFlags --headless=new --no-sandbox --disable-gpu`;`assert.assertions`:`categories:performance ["error", { minScore: 0.9 }]`,`accessibility / best-practices / seo ["error", { minScore: 0.95 }]`;`upload.target: filesystem → .lighthouseci`(不上传任何外部存储;`.gitignore` +1 行)。
- `.github/workflows/lighthouse.yml`:`on: push branches [main]` + `workflow_dispatch`;`permissions: contents: read`;concurrency 组;`actions/checkout@3d3c42e5…`(v7.0.1)· `pnpm/action-setup@ea17c68d…`(v6.1.0)· `actions/setup-node@82076278…`(v7.0.0)与 `ci.yml` 同一组 sha;`pnpm install --frozen-lockfile → pnpm build → npx --yes @lhci/cli@0.15.1 autorun`;`actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`(v7.0.1,`gh api` 解析 tag → commit)`if: always()` 保留 `.lighthouseci` 14 天。
- `src/components/HeroSearch.astro`:去 `aria-label={isEn ? 'Search' : '搜索'}`,可访问名 = 可见 placeholder 文字(注释注明缘由)。
- `scripts/test/lighthouse.test.mjs` 5 例:rc 形 · 阈值 · 不外传 · 工作流步序 · 全部 `uses` pin 40 位 sha 且与 `ci.yml` 同 pin、无 `@vN` 标签引用。

**先红再绿(本机 `npx --yes @lhci/cli@0.15.1 autorun`,`CHROME_PATH` 指本机 Chrome;dist 为 gate 同源构建)**

| 跑 | url | performance | accessibility | best-practices | seo | 二值审计红 |
|---|---|---|---|---|---|---|
| 1(修前) | `/` | 1.00 | 1.00 | 1.00 | 1.00 | `label-content-name-mismatch`(`button.hero-search` aria-label「搜索」不含可见文字) |
| 1(修前) | `/errors/codes/` | 0.97 | 1.00 | 1.00 | 1.00 | — |
| 1(修前) | `/support/` | 1.00 | 1.00 | 1.00 | 1.00 | `label-content-name-mismatch`(同上) |
| 2(修后) | `/` | **1.00** | **1.00** | **1.00** | **1.00** | 无 |
| 2(修后) | `/errors/codes/` | **1.00** | **1.00** | **1.00** | **1.00** | 无 |
| 2(修后) | `/support/` | **1.00** | **1.00** | **1.00** | **1.00** | 无 |

两跑断言均全过(`assertion-results.json` 空);首跑 a11y 分数已满但二值审计红,按「a11y 若红修到绿」律修 HeroSearch。Web Vitals(修后):`/` FCP 1.0 s · LCP 1.1 s · TBT 0 ms · CLS 0;`/errors/codes/` FCP 1.2 s · LCP 1.4 s · TBT 180 ms · CLS 0;`/support/` FCP 1.3 s · LCP 1.3 s · TBT 0 ms · CLS 0。

### 门终态(HEAD `1a4b58b`,04:47–04:53)

```
[gate] summary
  ✔ check        114177 ms   (51 files: 0 errors / 0 warnings / 0 hints)
  ✔ build        164496 ms   (230 page(s) built)
  ✔ gen:check      2251 ms   (8 生成物零 diff)
  ✔ lint:text      2078 ms   ({"files":102,"checked":102,"violations":0})
  ✔ links         14112 ms   ({"pages":230,"checked":56344,"dead":0,"external":444})
  ✔ frontmatter    1845 ms   ({"files":38,"errors":0})
  ✔ i18n:coverage   269 ms   (en: 10 / 27 (37%) translated; 17 fall back to zh-CN)
[gate] ✔ all green
node --test scripts/**/*.test.mjs → tests 95 / pass 95 / fail 0
```

## 三 逐文件改动

| 文件 | 卡 | 改动 |
|---|---|---|
| `.env.example` | DS-28 | 新;`PUBLIC_TANSR_API_BASE=https://api.tansr.com` |
| `src/lib/api-base.ts` | DS-28 | 新;`API_BASE` 读 `import.meta.env.PUBLIC_TANSR_API_BASE` 归一 |
| `src/lib/docs-api.mjs` | DS-28 | 新;端点 url / 载荷 / 校验 / 蜜罐 / 回退 / mailto 纯函数 |
| `src/components/Feedback.astro` | DS-28 | 改;fetch POST + 回落 + locale |
| `src/components/ContactForm.astro` | DS-28 | 新;四字段 + 蜜罐 + 三态 + 两语 |
| `src/content/docs/support/contact.md → contact.mdx` | DS-28 | 改名 + import + `<ContactForm />` 一处;frontmatter 不变 |
| `src/styles/custom.css` | DS-28 | 追加 `.contact-form` 段 |
| `scripts/test/docs-api.test.mjs` | DS-28 | 新;7 例 |
| `doc/report/assets/ds-28-ticket-{202,503}.png` | DS-28 | 新;端到端截图 |
| `src/content/docs/en/**`(10 篇) | DS-19 | 新;§四 4.1 |
| `src/lib/glossary.mjs` | DS-19 | 新;94 条术语 + 三个辅助函数 |
| `scripts/gen/i18n-coverage.mjs` | DS-19 | 新;覆盖率生成器 |
| `src/content/docs/releases/i18n-coverage.md` | DS-19 | 新;生成页(`gen --check` 零 diff) |
| `scripts/gen/index.mjs` | DS-19 | +1 import 行;`GENERATORS` 数组行尾追加 `i18nCoverage` |
| `scripts/gen/index.test.mjs` | DS-19 | 生成物计数 `7 → 8`(一处) |
| `src/lib/contract.mjs` | DS-19 | `GENERATED_MARKER` 源形放行 `src/content/docs`(注释同步) |
| `scripts/check/i18n-coverage.mjs` | DS-19 | 新;只报不红 |
| `scripts/check/gate.mjs` | DS-19 | STEPS 末尾 `i18n:coverage`;新增 `DIRECT_STEPS`;`runStep` 分流;头注同步 |
| `scripts/gen/i18n-coverage.test.mjs` · `scripts/check/test/i18n-coverage.test.mjs` · `scripts/test/i18n.test.mjs` | DS-19 | 新;6 + 3 + 33 例 |
| `lighthouserc.json` | DS-21 | 新 |
| `.github/workflows/lighthouse.yml` | DS-21 | 新 |
| `.gitignore` | DS-21 | +1 行 `.lighthouseci/` |
| `src/components/HeroSearch.astro` | DS-21 | 去 `aria-label`;+1 注释行 |
| `scripts/test/lighthouse.test.mjs` | DS-21 | 新;5 例 |
| `doc/report/资料站-DS-F-P2-终报.md` | 终报 | 本文 |

未改:`package.json` · `pnpm-lock.yaml` · `astro.config.mjs` · `scripts/gen/{releases,sdk-api}.mjs` · `contract/**` · `scripts/deploy/**` · `.github/workflows/{ci,deploy}.yml` · `README.md`。

## 四 交付下游

### 4.1 en 首批 10 篇(路径)

```
src/content/docs/en/getting-started/index.md
src/content/docs/en/getting-started/sdk.md
src/content/docs/en/getting-started/cli.md
src/content/docs/en/getting-started/serve.md
src/content/docs/en/getting-started/android.md
src/content/docs/en/support/index.mdx
src/content/docs/en/support/account.md
src/content/docs/en/support/troubleshooting.md
src/content/docs/en/support/contact.mdx
src/content/docs/en/security/index.md
```

### 4.2 给主线 / 收编

- **须主线再生的生成物**:`src/content/docs/releases/i18n-coverage.md` —— 收编 DS-E(sdk-api 生成页 / 其他新 slug)或任何泳道新增内容页后,slug 集变,须 `pnpm gen` 再生并随收编提交,否则 `gen:check` 红。生成器已排在 GENERATORS 末位,DS-E 的生成器合入时**须排在它之前**(否则 sdk-api 页不进覆盖表)。
- `scripts/gen/index.mjs`:本泳道 +1 import 行 + `GENERATORS` 行尾追加;DS-E 同形加一行 → 主线合成一行数组时把 `i18nCoverage` 留在末位。
- `scripts/gen/index.test.mjs` L132 计数 `8`:DS-E 合入后按其生成物数再加(sdk-api 多页时该断言会变大)。
- `scripts/check/gate.mjs`:若 DS-E 也改 STEPS,保持 `i18n:coverage` 在末位。
- `src/lib/contract.mjs` `GENERATED_MARKER`:已放行 `from src/content/docs`;若 DS-E 生成器源也非 `contract/`(如 typedoc 直读包),按同形再放行。
- `.github/workflows/lighthouse.yml` 首跑候 main 推送(或 `workflow_dispatch`);runner 自带 Chrome;红则 job 红,报告以 artifact `lighthouse-reports` 留 14 天。

### 4.3 给 api 泳道(A-L1 端点)

- docs 侧消费形已按 P2 §0 四条落地:`POST /v1/docs/feedback { path, helpful, locale }` 期望 202;`POST /v1/support/tickets { subject, body, email?, locale, page, website? }` 期望 202 `{ ok, ticketId }`,429 `rate_limited`,503 任意 → 界面回落。
- **api 须放行 CORS origin `https://docs.tansr.com`**(预检 `OPTIONS` → 204,`access-control-allow-headers: content-type`);本机假服务即按此形。
- 生产基址缺省 `https://api.tansr.com`;构建期可用 `PUBLIC_TANSR_API_BASE` 覆盖(`.env` 不入库)。

### 4.4 消费(等谁的什么)

- 等 api 端点上线:上线前 `Feedback` 全部 `delivered:false`(数据留浏览器),`ContactForm` 恒显失败 + mailto(用户仍可发邮件);上线后零改动即通。
- 等 `astro.config.mjs`(DS-E / 主线):站名两语(`title: { root: 'tansr 资料站', en: 'tansr Docs' }` 形)与 `i18n` 集合 WARN。

## 五 与派单不符

| # | 派单 | 实际 | 缘由 |
|---|---|---|---|
| 1 | `scripts/gen/index.mjs` 注册「只加一行」 | +1 import 行,`GENERATORS` 数组行尾追加一项(该行改动) | ESM 静态 import 与数组注册无法合成单行;DS-E 同形,主线合并时冲突仅此两行 |
| 2 | — | `scripts/gen/index.test.mjs` 生成物计数 `7 → 8` | 既有测例硬编码总数;加生成器必改 |
| 3 | — | `src/lib/contract.mjs` `GENERATED_MARKER` 放行 `from src/content/docs` | 原正则只认 `from contract/…`;覆盖率页事实源是内容目录本身,否则 frontmatter 门 / `generated: true` 校验红 |
| 4 | `scripts/check/i18n-coverage.mjs` 入 `gate` 末尾 | 以 `DIRECT_STEPS` 直跑脚本文件,未加 `package.json` 脚本名 | `package.json` 为 DS-E 独占;主线若愿可补 `"i18n:coverage": "node scripts/check/i18n-coverage.mjs"` 并把它移回 `pnpm run` 形 |
| 5 | — | `.gitignore` +1 行 `.lighthouseci/` | lhci 本地报告目录不入库 |
| 6 | — | 触 DS-A 组件 `HeroSearch.astro`(去 aria-label) | 派单「a11y 若红,修到绿」;改动 2 行 |

## 六 代拍登记

| # | 事项 | 代拍 | 待用户拍板 |
|---|---|---|---|
| 1 | en 代码块内的中文注释 / 提示词(如 `// token 由你的服务端换发`、`session.send('帮我总结这份合同')`) | 严守「代码块照抄」律,**逐字节照抄 zh-CN**(14 块回抄),测例强制 | 是否放宽为「代码块内注释 / 自然语言字串可译,命令 / 键名 / 值不译」;若放宽,改 `scripts/test/i18n.test.mjs` 代码块比对为「去注释与字串后逐字」并重译 14 块 |
| 2 | en 页内链形 | 内容页恒 `/en/<slug>/`(未译页 Starlight 回落显中文 + 页顶提示);生成页 `errors/codes` · `cli/commands` · `serve/env` · `releases/*` 与 `/api/` 恒根路径 | 主线若决定生成页也走 `/en/` 回落,改测例一行即可 |
| 3 | 覆盖率页 `lastVerified` | 取被扫文章 `lastVerified` 最大值(2026-09-09),不取运行当日 | 保证跨日 `gen --check` 零 diff;若主线要求「当日」,须接受每日再生 |

## 七 未完成 / 敞口 / ⏸

- ⏸ en 页 `<title>` 后缀「tansr 资料站」与 Starlight 站名两语:在 `astro.config.mjs`(禁改),留主线 / DS-E。
- ⏸ `lighthouse.yml` 未在 CI 实跑(泳道不 push);本机两跑为据。`ubuntu-latest` Chrome 版本与本机 Chrome 152 不同,分数或有 ±0.03 抖动(`/errors/codes/` 首跑 0.97 即此类);阈值 0.9 留有余量。
- ⏸ api 端点未上线:端到端以假服务为据;上线后建议主线以真端点复跑 §二 DS-28 表 #1–#4 四条。
- 敞口:`scripts/test/i18n.test.mjs` 的「10 篇」清单为常量 `FIRST_10`;后续批次每加一篇须加一行(或改为扫 `en/**` 全量——留给 en 第二批)。
- 敞口:覆盖率页 `zone: docs / category: releases`,沿用 releases 组;若主线另开「站务」类目再迁。
- 事故登记:DS-28 端到端收尾清理本机 `astro preview` 进程时,误杀了 ds-A worktree 正在跑的一个 `astro preview`(非破坏性,无文件改动;ds-A 若发现预览断掉即此因)。
- 本机 `pnpm install --frozen-lockfile --node-linker=hoisted` 仅影响本机安装形,仓文件零 diff(与 P1 同)。

## 八 回主线摘要

DS-F P2 三卡全落、门全绿、可收编:`aba763e`(DS-28 反馈 / 联系表单接 api,含假服务 202 / 429 / 503 端到端 11 / 11)→ `e5bea46`(DS-19 en 首批 10 篇 + `glossary.mjs` 94 条 + `releases/i18n-coverage` 生成页 + 只报不红门)→ `1a4b58b`(DS-21 Lighthouse CI:三 url 移动端 100·100·100·100 ×3,a11y 一处修绿,actions sha pin,`@lhci/cli@0.15.1`)→ 本终报。`pnpm gate` check 0/0/0 · build 230 页 · gen:check 8 零 diff · lint:text 0 · links 56344 / 0 死 · frontmatter 38 / 0 · i18n:coverage en 10 / 27;`pnpm test` 95 / 95。收编要点三条:① 收编 DS-E 后 `pnpm gen` 再生 `releases/i18n-coverage.md`,`i18nCoverage` 留 GENERATORS 末位,`index.test.mjs` 计数随之改;② `scripts/gen/index.mjs` / `gate.mjs` / `contract.mjs` 与 DS-E 的两行级合并;③ api 侧放行 CORS `https://docs.tansr.com`。待拍板一条:en 代码块内中文注释 / 提示词是否放宽可译(现严守照抄)。禁改文件零触碰;未 push / 未部署。
