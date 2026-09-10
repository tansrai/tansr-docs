# 资料站 · DS-H(内容:ja / ko 首批)· P3 终报

> 仓 `tansr-docs` · 分支 `lane/ds/H` · worktree `J:\tansr\worktrees\ds-H` · 基线 main `14a46b5`(2026-09-10 11:59)· 2026-09-10 CST。
> 派单:`J:\tansr\.square-tmp\ds\P3-共同派单.md` DS-32 行(ja / ko 各 13 篇 + 术语 + 类目标签 + 组件四语 + 四语卷 + 覆盖率再生);契约沿 `P1-共同派单.md` §0 · `P2-共同派单.md` §0;en 首批的形沿 `资料站-DS-F-P2-终报.md` 与 `资料站-P2-收编回执-2026-09-09.md` §六 2;用户拍板 2026-09-10「代码块逐字节照抄,含中文注释 / 提示词,适用 en / ja / ko」。
> 恒未 push / 未部署 / 未碰 ECS / 未改兄弟仓 / 未改 `scripts/gen/**` · `scripts/check/**` · `.github/**` / 未改 `package.json` 与 lockfile;`astro.config.mjs` 只动派单允许的两处。

## 〇 结论一页

- 卡数 1 / 完成 1(DS-32);提交 4 + 本终报 1。ja 13 篇 · ko 13 篇(与 en 同一组 slug,同扩展名),以 zh-CN 根页为源逐篇真译;`glossary.mjs` 94 条术语四列齐;`CATEGORIES` 11 类目 ja / ko 标签;9 个组件四语;`scripts/test/i18n.test.mjs` 扩为四语 × 13 篇(先红 122 测 34 过 88 败 → 后绿 122 / 122);`releases/i18n-coverage.md` 再生得 ja / ko 列。
- 门终态(HEAD `401838b`):**`pnpm gate` 一次全绿** —— check 0 errors · build **2326 页 / 47.14 s**(gate 全程 103 s)· gen:check 514 生成物零 diff · lint:text 652 文件 0 违反 · links 2326 页 557,906 链 **0 死**(3,440 外链未查)· frontmatter 576 文件 **0 错** · release-notes 0 违反 · i18n:coverage en / ja / ko 各 13 / 536(2.4%)。dist **293.9 MB**(308,174,903 字节;2325 个 `index.html`,en / ja / ko 各 537,根 714)。
- **`pnpm test` 201 测 197 过 2 败 2 跳,未全绿**:红的两例都在 DS-G 的 `scripts/gen/i18n-coverage.test.mjs`(第 65 / 67 / 112 行把语言集与 summary 写死为 `['en']` · `{ total, en }`),`EXTRA_LOCALES` 一加 ja / ko 必红;派单硬约束「不改 `scripts/gen/**`」,本泳道不动它,三行补丁原文在 §五 1 交主线。本泳道自己的 122 例全绿;其余 77 例(P1 / P2 卷)全绿。
- 代码块律:ja / ko 78 个围栏与 zh-CN 源逐字节相同(卷内逐块断言 + 独立脚本二次核)。顺手发现基线 main 上 en `sdk/{lifecycle,midturn-input,system-prompts}` 12 个围栏被译成英文、两页 `related` 与根页不一致 —— 按用户拍板回抄源文并对齐 related,单独一提交(`08e270c`),正文一字未动。
- 与派单不符 / 代拍 8 条(§四):触 en 三页 · 内部编号断言只对 ja / ko(zh / en 正文自带「INJ」)· 链接断言从「集合相等」放为「源链接不漏」(en `getting-started/sdk.md` 比源多一段一链)· 行内代码里的中文占位符改译(围栏不动)· ContactForm 脚本文案改由 `data-cf-*` 下发 · 新增 `uiLocale()` · ja / ko 页反馈 / 工单载荷 `locale` 归一为 zh-CN(api 枚举只认 zh-CN / en)· 韩文 14 个全角标点写成硬断言。
- 敞口(§五):DS-G 卷三行补丁 · zh / en `sdk/midturn-input.md` 正文含内部编号「INJ」· api `locale` 枚举与 `docs-api.mjs` 须扩 ja / ko · `scripts/check/frontmatter.mjs` 的 `extraLocales` 缺省仍 `['en']` · 类目 `description` 仍只有中文 · 覆盖率页术语表只渲染 zh / en 两列 · en `getting-started/sdk.md` 多出的段落待主线定夺 · 站名后缀 · 主线收编 DS-G 后须再 `pnpm gen`。

## 一 卡与提交

| 卡 | 提交 | 时间 | 一句话 |
|---|---|---|---|
| DS-32(前置修正) | `08e270c` | 18:23 | en `sdk/{lifecycle,midturn-input,system-prompts}.md`:12 个代码块逐字节回抄 zh-CN 源;lifecycle / midturn-input 的 `related` 对齐根页;正文未动;可独立回退 |
| DS-32 | `28e4c8f` | 18:23 | ja 首批 13 篇 `src/content/docs/ja/**`(13 文件 +1619 行) |
| DS-32 | `80b2f8d` | 18:23 | ko 首批 13 篇 `src/content/docs/ko/**`(13 文件 +1619 行) |
| DS-32 | `401838b` | 18:23 | `categories.mjs`(EXTRA_LOCALES ja / ko · 11 类目 ja / ko · `uiLocale()`)· `glossary.mjs` 94 × 4 · `astro.config.mjs` 两处 · 9 组件四语 · `i18n.test.mjs` 四语卷 · `releases/i18n-coverage.md` 再生 |
| 终报 | (本提交) | — | `doc/report/资料站-DS-H-P3-终报.md` |

`git log --oneline main..HEAD` = 上表四个 hash;`git diff --shortstat main..HEAD` = 43 files changed, 4372 insertions(+), 861 deletions(-)。提交顺序刻意为「en 修正 → ja → ko → 基建 + 卷 + 再生」:每个中间提交都可构建,四语卷在它变绿的那个提交才进树。

提交信息均经 UTF-8 无 BOM 文件 `git -c i18n.commitEncoding=utf-8 commit -F <file>`(node 读回 commit 对象核:零 U+FFFD,主题含「四语卷」);全部新文件 LF · 无 BOM · 有末行换行(`eol-check.mjs` 逐字节核 ja / ko / en-sdk 共 29 文件 all clean)。worktree 首次 `pnpm install --frozen-lockfile --node-linker=hoisted`(Lockfile is up to date,+425 包;`install.log` 归档)。

## 二 门与卷数字

### `pnpm gate`(HEAD `401838b`,exit 0,103 s)

| 步 | 结果 |
|---|---|
| check | 0 errors |
| build | 2326 page(s) built in 47.14 s;Complete!(预期口径 1214 + 2 × 607 = 2428 是估算,实测根 714 + en / ja / ko 各 537 = 2325 页 + 1 个 404) |
| gen:check | 8 个注册生成物 + sdk/api/** 505 页,共 514 文件零 diff(`releases/i18n-coverage.md` 已再生入库) |
| lint:text | 652 文件 checked 652,violations 0 |
| links | pages 2326,checked 557,906,**dead 0**,external 3,440(未查) |
| frontmatter | files 576,**errors 0** |
| release-notes | packages 3,versions 10,entries 10,violations 0 |
| i18n:coverage | en 13 / 536(2.4%)· ja 13 / 536(2.4%)· ko 13 / 536(2.4%);各 523 篇回落 zh-CN |

dist:293.9 MB(308,174,903 字节;PowerShell 逐文件求和,等价 `du -sh dist`);`index.html` 2325 个(dist/en 537 · dist/ja 537 · dist/ko 537 · 根 714)。

构建产物抽检(读 HTML 字串,非截图):`dist/ja/getting-started/index.html` `lang="ja"` · Feedback「このページは役に立ちましたか？」· Related「関連記事」· Footer「利用規約」· ZoneNav「ヘルプセンター」全在;`dist/ko/cli/settings-and-doctor/index.html`(未译页)`lang="ko"` · Starlight 韩文回落提示在 · Related「관련 문서」与回落标签「중국어」在;`dist/ko/support/index.html` 节标题「자주 묻는 질문」· FaqGroups 组标题「문제 해결」与要点「doctor 출력 읽는 법」· hero「개발자 문서로 돌아가기」在;`dist/ja/support/index.html` FaqGroups「トラブルシューティング」「doctor の出力の読み方」在;根首页语言切换器含「日本語」「한국어」。

### `pnpm test`(HEAD `401838b`,exit 1)

- 总:tests 201 · pass 197 · **fail 2** · skipped 2(P1 既有跳过)· todo 0。
- 败 2 例(均 `scripts/gen/i18n-coverage.test.mjs`,DS-G 域,本泳道未改):
  - #36「buildCoverage(fixture):分母 = 根 slug 集;en 计数;孤儿另列;lastVerified 取最大」—— 第 65 行 `assert.deepEqual(cov.locales, ['en'])`,实得 `['en','ja','ko']`;同例第 67 行 `{ total: 3, en: 1 }` 亦将红(实得多 `ja: 0, ko: 0`)。
  - #38「本轮内存产物:新增页与翻译计数,覆盖旧标题日期,不把非页面文件计入」—— 第 112 行 `{ total: 4, en: 2 }`,实得 `{ total: 4, en: 2, ja: 0, ko: 0 }`。
  - 定性:过期夹具期望,非产品缺陷;生成器本体(`buildCoverage` 用 `Object.keys(EXTRA_LOCALES)`)对多语言是正确的,覆盖率页与 gate 的 `i18n:coverage` 步都已按三语输出。
- `scripts/test/i18n.test.mjs`:**122 / 122**(en / ja / ko 各 13 篇 × 3 例 = 117,另 5 例:守卫红例 2 · 术语表 1 · 语言接线 1 · 覆盖模型 1)。

### 先红再绿(`node --test scripts/test/i18n.test.mjs`,不依赖 node_modules;败例名单由 `.lane-tmp/red-diff.mjs` 从三份 TAP 日志抽出)

| 轮 | 状态 | tests / pass / fail | 红在哪 |
|---|---|---|---|
| 红 1 | 卷重写完,ja / ko 零页 | 122 / 34 / 88 | ja / ko 26 页 × 3 例 = 78;非页面 10 例:en `sdk/lifecycle` 3 · `sdk/midturn-input` 2 · `sdk/system-prompts` 1(related / 代码块 / 链接)· en `security/index` 链接 1 · 守卫红例 1 · 语言接线 1 · 覆盖模型 1 |
| 红 2 | 只改卷(守卫红例、接线正则、链接规则的生成页 / 图片处理);链接例加「链接目标集与 zh-CN 同」 | 122 / 37 / 85 | 78 + 7:en sdk 三页 5 · 覆盖模型 1 · **新红** en `getting-started/sdk.md` 链接集比源多 `/en/sdk/lifecycle/`;红 1 的 4 处卷侧失误(守卫红例 · 接线 · en lifecycle / security 链接)转绿,页面未动 |
| 红 3 | 链接断言改「源链接不漏」 | 122 / 38 / 84 | 恰 = 78(ja / ko 缺页)+ 5(en sdk 三页)+ 1(覆盖模型);en 其余 34 例全绿 —— 红集精确等于「该红的」 |
| 绿 | en 三页回抄 + ja 13 + ko 13 | **122 / 122 / 0** | — |

中途分段核(`--test-name-pattern`):ja getting-started 5 篇 15 / 15;ja sdk 2 篇 6 / 6;ja 9 篇 27 / 27 → ja 13 篇 39 / 39;ko 同序 3 / 3 → 15 / 15 → 27 / 27 → 39 / 39。

### 卷的守卫形(`scripts/test/i18n.test.mjs`)

- 每语言 × 13 篇三例:①与源同 slug 同扩展名存在;`template · zone · category · related · sources` 五块与 zh-CN 逐字同;`lastVerified ≥` 源;title / description 过语言守卫;mdx 的 import 集归一后同源;`support/index.mdx` 的 hero 块在且 `link: /<locale>/`。②正文真译守卫;零内部编号(仅 ja / ko);**代码块数量相等且逐块逐字节相同**。③内链形:内容页 `/<locale>/<slug>/`,生成页 / `/api/` 根路径;目标页存在;**源的每个站内链接目标(含锚点)都在译文里**。
- 语言守卫:en 正文零 CJK + 零术语禁用变体;ja 零谚文、零简体专用字(`们这个时务应从请见让说认设记该还经过后发对开关门问间键权联络线组织级统编码试调语读证识议论访计图术处电环网页单输击复显备选择换释错误检查现实际层态满压缩续够亲`)、假名 /(假名 + 汉字)≥ 0.4、日文旁不得有 ASCII 句读(`,.;:!?` 后接空白 / 行尾)与半角括号;ko 零汉字、零假名、有谚文、零全角标点(`，。、：；！？（）「」『』【】` 14 个)。内部编号守卫 `FX- / DS- / W1-5- / ED- / INJ- / ARC- / CM- / PM- / AP-` 编号 · `INJ` · 泳道 · 收编 · 派单 · 十王修案(ja / ko)。守卫各带红例(照抄中文 / 半译 / 错标点都进不了绿)。
- 接线:`EXTRA_LOCALES` 三键与顺序 = `TRANSLATED_LOCALES`;11 类目有 ja / ko;`uiLocale()` 五种输入;`astro.config.mjs` 正则钉住 `translations: { en: c.en, ja: c.ja, ko: c.ko }` 与 sdk/api 的 ja / ko;组件零 `isEn` / `=== 'en'` 分支,9 个组件含 `uiLocale(` 与 `ja: ` / `ko: `(CategoryGrid 例外,标签来自 CATEGORIES);术语 94 条四列齐,ja 全角括号 / ko 半角括号。
- 覆盖模型:`buildCoverage` 三语各 13,summary 13,零孤儿。

## 三 实现要点

### 3.1 页面(`src/content/docs/{ja,ko}/**`,各 13 篇)

- 篇目:`getting-started/{index,sdk,cli,serve,android}.md` · `sdk/{lifecycle,midturn-input,system-prompts}.md` · `security/index.md` · `support/{index.mdx,account.md,troubleshooting.md,contact.mdx}`。
- 源:zh-CN 根页原文(逐段对照译,不增删事实、不改结构:表格列数、列表项数、标题层级与源一致);en 仅作术语参照。
- frontmatter:title / description 译出(单引号包);`zone / category / related / sources` 从源逐字复制(含 `sources` 里的中文文件名与 `doc/INJ-同轮追加输入手册.md`);`lastVerified: '2026-09-10'`;`support/index.mdx` 的 `template: splash` · hero(`title` / `tagline` / `actions[0].text` 译出,`link: /ja/` · `/ko/`,icon / variant 不变);两 mdx 的 import 相对路径多一级 `../../../../components/`。
- 代码块:78 个围栏(每语言 39)逐字节照抄源,含中文注释与提示词(如 `session.send('帮我总结这份合同')` · `// 恒不下发端、恒不入日志` · `-d '{"prompt":"你好,介绍一下你能做什么"}'`)。
- 不译:命令 / 旗标 / 键名 / 错误码 / 事件名 / 端点 / 产品名(tansr · `@tansr/sdk` · `@tansr/serve` · CLI · doctor · TUI · SEA · PAT · appid / appkey · `app_user`)。
- 行内代码里的中文占位符改译(沿 en 做法):ja `<あなたのログイン token>` · `<アカウント指紋>` · `<作業ディレクトリ>` · `model: 'エイリアス'` · `[--out パス]`;ko `<당신의 로그인 token>` · `<계정 지문>` · `<작업 디렉터리>` · `model: '별칭'` · `[--out 경로]`。围栏内同名占位符保持中文(逐字节律优先)。
- 链接:内容页 `/ja/…` / `/ko/…`(Starlight 回落保证存在);生成页 `errors/codes(#锚)` · `cli/commands` · `serve/env` · `releases/{cli,sdk,serve}` 与 `/api/` 保持根路径,形与源同(不带尾斜杠);`mailto:` 与图片 `/wechat-support.png` 不动。
- 日文:全角「、。：（）」,半角空格隔开拉丁 / 数字与假名(「Node.js ≥ 22.19」「5 分」),术语沿 glossary ja 列(エージェント · カーネル · セッションサービス · 認証情報 · 個人アクセストークン（PAT）· アプリキー · 機能フラグ · ツールの 3 リング · ビュー還元 · 認証フック · 3 段階の復旧チェーン · アセンブリ · エスケープハッチ · 課金ゲート · 受領証 · 定価 / 契約価格 …)。
- 韩文:半角标点与空格惯例,零汉字零假名(「中文」→「중국어」,中文人名 / 产品外的汉字一律不出现),术语沿 glossary ko 列(에이전트 · 커널 · 세션 서비스 · 자격 증명 · 개인 액세스 토큰(PAT) · 앱 키 · 기능 플래그 · 도구 3링 · 뷰 리덕션 · 인증 훅 · 3단계 복구 체인 · 어셈블리 · 이스케이프 해치 · 과금 게이트 · 영수증 · 정가 / 협의 가격 …)。
- 内部编号:源 `sdk/midturn-input.md` 首段「本页描述 INJ 开发源码的新增能力」在 ja / ko 译为「開発中のソースコードに追加された機能」/「개발 중인 소스 코드에 추가된 기능」,正文零 FX- / DS- / INJ / 泳道 / 收编 / 派单(frontmatter `sources` 按律逐字复制,仍含 `doc/INJ-同轮追加输入手册.md`,见 §五 2)。

### 3.2 语言与类目(`src/lib/categories.mjs`)

- `EXTRA_LOCALES`:`en: { label: 'English', lang: 'en' }` · `ja: { label: '日本語', lang: 'ja' }` · `ko: { label: '한국어', lang: 'ko' }`(冻结对象,键序即语言切换器顺序与卷的 `TRANSLATED_LOCALES`)。
- `CATEGORIES` 11 类目各补 `ja` / `ko` 标签(如 getting-started「はじめに」/「시작하기」· serve「セッションサービス（@tansr/serve）」/「세션 서비스(@tansr/serve)」);`description` 仍中文(见 §五 6)。
- 新增 `uiLocale(locale)`:`Astro.locals.starlightRoute.locale`(根为 `undefined`)→ `'zh-CN' | 'en' | 'ja' | 'ko'`,只认 `EXTRA_LOCALES` 的键,其余归 zh-CN。

### 3.3 术语(`src/lib/glossary.mjs`)

- 94 条每条 `{ zh, en, ja, ko, avoid?, note? }`;`findGlossaryViolations` / `proseOnly` / `CJK_PATTERN` 不变。ja 用全角括号(`個人アクセストークン（PAT）` · `エンドユーザートークン（\`app_user\` トークン）` · `再開（resume）`),ko 用半角括号(`개인 액세스 토큰(PAT)` · `정상 종료(graceful shutdown)`)。与 en 同形的条目(CLI · MCP 等)也显式写 ja / ko。

### 3.4 `astro.config.mjs`(恰两行)

- 侧栏 `translations: { en: c.en }` → `{ en: c.en, ja: c.ja, ko: c.ko }`。
- `sdk/api` 条目 `translations` 加 `ja: 'API リファレンス（概要）'` · `ko: 'API 참조(개요)'`。
- `git diff astro.config.mjs` = 2 hunks / 2 行;`locales` 本就展开 `EXTRA_LOCALES`,语言切换器自动出 ja / ko;Starlight 内建 UI 字串(回落提示、目录、搜索、上一页 / 下一页)自带 ja / ko。

### 3.5 组件四语(`src/components/*.astro`)

- 统一形:`const lang = uiLocale(Astro.locals.starlightRoute.locale)` + `STRINGS[lang]`;去掉全部 `isEn` / `=== 'en'` 二元分支。
- Feedback(问句 / 是 / 否 / 感谢;`data-feedback-locale={lang}`,载荷仍经 `docs-api.mjs` 归一)· ContactForm(标签 / 占位 / 按钮 / 三态文案 / 校验提示 / mailto 引导,新增按语言的 `period` 句号;脚本文案改由 `data-cf-submitting` · `data-cf-msg-required` · `data-cf-msg-too-long` · `data-cf-msg-invalid` 下发;`from '../lib/api-base'` · `fetch(` · 蜜罐 `name="website"` · `autocomplete="off"` · `isHoneypotTripped` · `mailtoFallback` · `ticketsUrl` 等 DS-28 卷钉住的静态形不变)· HeroSearch(占位符表,`Astro.props.placeholder` 优先)· Related(标题 / 回落语言名)· Footer(条款 / 隐私 / 导航 aria / 版权)· ZoneNav(两区名 / aria)· CategoryGrid(`c[lang]` 取标签;「即将上线」四语)· HotArticles(标题 / 空态)· FaqGroups(三组标题与要点、「即将上线」四语)。
- Header · MobileMenuFooter · MarkdownContent · `src/lib/resolve.ts` 无文本分支或已按 `EXTRA_LOCALES` 键自动扩展,未动。

### 3.6 覆盖率再生

- `pnpm gen`:`[gen] wrote src\content\docs\releases\i18n-coverage.md {"total":536,"en":13,"ja":13,"ko":13,"glossary":94}`;其余 513 生成物内容不变。页面新增「日本語(`ja`)」「한국어(`ko`)」两行与逐页表两列;`gen:check` 零 diff 入库于 `401838b`。`scripts/gen/i18n-coverage.mjs` 未改。

## 四 与派单不符 / 代拍

1. **触了 en 三页**(`08e270c`):派单只要 ja / ko,但基线 main 的 en `sdk/{lifecycle,midturn-input,system-prompts}.md` 12 个代码块被译成英文,与用户拍板「代码块逐字节照抄,适用 en / ja / ko」相悖,四语卷对 en 也断言逐字节 → 回抄源文;同时 `lifecycle` / `midturn-input` 的 `related` 缺 `sdk/sessions-and-events`(后者还多了根页没有的 `getting-started/sdk`)→ 对齐根页。正文一字未动;单独提交可独立回退。
2. **内部编号断言只对 ja / ko**:zh 根页与 en `sdk/midturn-input.md` 正文含「INJ」(源如此,本泳道不改源、不改 en 正文);ja / ko 译文零内部编号。若对四语一律断言,en 会红在不属本泳道的文本上。登记 §五 2。
3. **链接断言放宽为「源链接不漏」**:原写「集合相等」,红在 en `getting-started/sdk.md` 比源多一段(「For application shutdown, see [session and resource cleanup](/en/sdk/lifecycle/) …」)一链 —— 主线 en 与 zh 源已漂移;改为「zh 源的每个链接目标都在译文里」(不漏链),多链放行并登记 §五 7。ja / ko 实际与源集合相等。
4. **行内代码里的中文占位符改译**(围栏不动):`<你的登录 token>` · `<账号指纹>` · `<工作目录>` · `model: '别名'` · `[--out 路径]` 在正文行内代码中按 en 先例译为目标语言;围栏内同名占位符保持中文(逐字节律)。派单未明说,按「行内代码属正文可读性、围栏属可复制样例」代拍。
5. **ContactForm 脚本文案改由 `data-cf-*` 属性下发**:原内联脚本按 `isEn` 二选一;四语再堆分支不可维护,改为服务端渲染时把四条文案放进 `<form data-cf-…>`,脚本只读 dataset。DS-28 卷(`docs-api.test.mjs`「组件静态形」)钉住的锚点全部保留,7 / 7 仍绿。
6. **新增 `uiLocale()`**(`src/lib/categories.mjs`):派单未列,但 9 个组件都要把 `undefined | 'en' | 'ja' | 'ko'` 归一,放单一真源避免各组件各写一遍。
7. **ja / ko 页的反馈 / 工单载荷 `locale` 归一为 `zh-CN`**:api 契约(P2 §0)`locale?: 'zh-CN' | 'en'`,`docs-api.mjs` `normalizeLocale` 只认这两值;ja / ko 页的 `data-feedback-locale` / `data-contact-locale` 是 ja / ko,进载荷前被归一为 zh-CN(`path` 已带 `/ja/` · `/ko/` 前缀,信息不丢)。不改 `docs-api.mjs`(DS-28 域,且契约在 api 侧);登记 §五 3。
8. **韩文标点写成硬断言**:派单只说「韩文用半角标点与空格惯例」,卷把 `，。、：；！？（）「」『』【】` 14 个全角标点在 ko 正文 / title / description 里一律判红(`·` U+00B7 与 `…` U+2026 不在列,放行)。把「惯例」升为门,属代拍;13 篇按此写成。

## 五 敞口与给主线的切换 TODO

1. **DS-G 卷三行补丁**(`scripts/gen/i18n-coverage.test.mjs`,本泳道禁改,收编 DS-G 与本泳道后由主线打;不打则 `pnpm test` 恒 2 红):
   ```js
   // 第 65 行
   -    assert.deepEqual(cov.locales, ['en']);
   +    assert.deepEqual(cov.locales, Object.keys(EXTRA_LOCALES)); // 现为 ['en', 'ja', 'ko']
   // 第 67 行
   -    assert.deepEqual(cov.summary, { total: 3, en: 1 });
   +    assert.deepEqual(cov.summary, { total: 3, en: 1, ja: 0, ko: 0 });
   // 第 112 行
   -    assert.deepEqual(cov.summary, { total: 4, en: 2 });
   +    assert.deepEqual(cov.summary, { total: 4, en: 2, ja: 0, ko: 0 });
   ```
   (`EXTRA_LOCALES` 需在该卷 import `../../src/lib/categories.mjs`;或直接写 `['en', 'ja', 'ko']`。)`render(fixture)` 例的 `| English(\`en\`) | 1 / 3 |` 与 `✓ | 回落 |` 正则在三语下仍过(表行多两列不影响前缀匹配),已实测绿。
2. **zh / en `sdk/midturn-input.md` 正文含内部编号「INJ」**(首段「本页描述 INJ 开发源码的新增能力」/「This page describes … INJ …」);frontmatter `sources` 亦引 `doc/INJ-同轮追加输入手册.md`(若页脚渲染来源,编号会露出)。属源页与 en 页文本,归内容主线;ja / ko 已译去。
3. **api `locale` 枚举扩 ja / ko**:`tansr-api` 的 `/v1/docs/feedback` · `/v1/support/tickets` 契约 `locale ∈ {zh-CN, en}` → 加 ja / ko;随后 `src/lib/docs-api.mjs` 的 `LOCALES` / `normalizeLocale` 与 `docs-api.test.mjs` 同步。此前 ja / ko 页上报为 zh-CN(路径带语言前缀可反查)。
4. **`scripts/check/frontmatter.mjs` 第 154 行 `checkFrontmatter({ root, extraLocales = ['en'] })`**:该参数只影响 `related` 的同语言解析(`localeOf` 返回 undefined 时只按根 slug 查),ja / ko 页的 related 全是根 slug 所以 576 文件 0 错;但缺省未含 ja / ko,建议改为 `Object.keys(EXTRA_LOCALES)`,与 en 同等对待。
5. **`CATEGORIES[*].description` 仍只有中文**:CategoryGrid 在 en / ja / ko 首页显示中文描述(en 时已如此)。加 `description_en / _ja / _ko` 或改为对象属 DS-G / 主线。
6. **覆盖率页术语表只渲染 zh / en 两列**(`scripts/gen/i18n-coverage.mjs` render);glossary 已有 ja / ko 列,生成器加两列即可(DS-G 域)。
7. **en `getting-started/sdk.md` 比 zh 源多一段一链**(`/en/sdk/lifecycle/` 段):要么回灌 zh 源(再同步 ja / ko),要么从 en 删;主线定夺。卷现按「不漏链」放行。
8. **站名后缀**:ja / ko 页 `<title>` 后缀仍「tansr 资料站」(`astro.config.mjs` `title`,派单不许本泳道动第三处;DS-G / 主线)。
9. **构建告警**(基线已有):`[WARN] [content] The collection "i18n" does not exist or is empty` —— Starlight 的 `i18n` 集合未定义,不影响四语 UI 字串(用的是 Starlight 内建翻译);要静默须在 `src/content.config.ts` 声明空集合(DS-G / 主线域)。
10. **主线收编顺序**:先 DS-G(若改 `scripts/gen/**` / `scripts/check/**`)再本泳道,收编后 **必须再跑 `pnpm gen`**(见 §六)并打 §五 1 补丁,再 `pnpm gate && pnpm test` 取主线实际 SHA 的数字。

## 六 须主线再生 / 拷入的生成物

- `src/content/docs/releases/i18n-coverage.md`:本泳道已按 HEAD 再生入库(`401838b`,en / ja / ko 各 13 / 536,`lastVerified: '2026-09-10'`)。主线合并 DS-G(生成器 / slug 集变)或任何新增页后须 `pnpm gen` 再生并提交;`gen:check` 会在不一致时红。
- 其余 513 个生成物本轮再生内容不变,无需拷入。
- 无 `contract/**` · `scripts/**`(除 `scripts/test/i18n.test.mjs`)· `.github/**` 变更。

## 七 过程教训

1. **先写卷再写页,红集要「精确等于该红的」**:红 1 的 88 里有 4 例是卷自己的问题(守卫红例本身红、接线例的正则、链接例对生成页 / 图片的处理让 en `sdk/lifecycle` 与 `security/index` 误红),红 2 只改卷不改页就转绿;到红 3 时 84 = 78(缺页)+ 5(en sdk)+ 1(覆盖模型)恰好对上,才开始写页。三份 TAP 日志与 `red-diff.mjs` 抽出的败例名单都归档,红不是口头的。
2. **译文守卫要能判「假译」**:仅查「不是中文」挡不住照抄 / 半译;ja 用「假名占比 ≥ 0.4 + 简体专用字黑名单 + 全角标点」,ko 用「零汉字零假名 + 有谚文 + 零全角标点」,13 × 2 篇都是靠它逐篇校出标点与占位符残留(`(任意)` · `例:` · `别名` · `路径`)。
3. **Windows 壳层**:PowerShell `>` 落 UTF-16、`node -e "…$…"` 被吃字符、`git show` 触发分页器把 30 s 会话挂死 —— 一律 `cmd /c "node … > file 2>&1"` + `.lane-tmp/*.mjs` 脚本 + `git --no-pager`;控制台里的中文乱码只是显示层,以 node 读回字节为准(提交信息、页面正文都这样核)。
4. **术语先落 glossary 再写页**:ja 页首批 5 篇写完后与 glossary 对表,改了 10 处(機能ビット → 機能フラグ · 三重リング → 3 リング · 畳み込み → 還元 · フィンガープリント → 指紋);之后 8 篇 + ko 13 篇零返工。
5. **文件所有权硬边界的代价要写清而不是绕过**:`scripts/gen/**` 的 DS-G 卷必红是结构性的(语言集是共享真源),本泳道不越界改它,把补丁原文与行号交主线;`pnpm test` 未全绿在 §〇 第一屏如实写,不把 199 / 201 说成全绿。
6. **源页漂移会先咬到卷**:en 三页代码块被译、`related` 漂移、`getting-started/sdk.md` 多段,都是四语卷对 en 也断言才暴露的;按「源为真」处理(回抄 / 对齐 / 放行并登记),不动正文。

## 八 索引

- 提交:`08e270c` · `28e4c8f` · `80b2f8d` · `401838b`(+ 本终报);分支 `lane/ds/H`;基线 `14a46b5`。
- 页面:`src/content/docs/ja/**`(13)· `src/content/docs/ko/**`(13)· `src/content/docs/en/sdk/{lifecycle,midturn-input,system-prompts}.md`(3,代码块 / related)。
- 基建:`src/lib/categories.mjs` · `src/lib/glossary.mjs` · `astro.config.mjs` · `src/components/{Feedback,ContactForm,HeroSearch,Related,Footer,ZoneNav,CategoryGrid,HotArticles,FaqGroups}.astro` · `scripts/test/i18n.test.mjs` · `src/content/docs/releases/i18n-coverage.md`。
- 归档 `J:\tansr\archive\ds-H-p3\`(不入仓;来源均为 worktree `.lane-tmp/`,HEAD `401838b`):
  - `logs/install.log`(`pnpm install --frozen-lockfile --node-linker=hoisted`,exit 0)
  - `logs/i18n-red-1.txt` · `i18n-red-2.txt` · `i18n-red-3.txt`(`node --test scripts/test/i18n.test.mjs`,红 1 / 2 / 3,exit 1)· `logs/i18n-green-1.txt`(同命令,122 / 122,exit 0)
  - `logs/test-1.txt`(`pnpm test`,201 / 197 / 2,exit 1;#36 · #38 定位见 §二)
  - `logs/gate-1.txt` + `gate-1-meta.txt`(`pnpm gate`,exit 0,103 s)· `logs/gen.txt`(`pnpm gen`)· `logs/red-diff.txt`(三轮红的败例名单与逐轮差集)· `logs/fence-count.txt`(ja / ko 各 39 块)
  - `scripts/*.mjs`(一次性:`tap-summary` · `fence-diff` · `fence-count` · `link-diff` · `red-diff` · `restore-en-fences` · `ja-fix-terms` · `ja-fix-inline{,2}` · `eol-check` · `msg-verify` · `verify-dist`)
- 派单与前序:`J:\tansr\.square-tmp\ds\P3-共同派单.md` · `P1-共同派单.md` §0 · `P2-共同派单.md` §0 · `doc/report/资料站-DS-F-P2-终报.md` · `doc/report/资料站-P2-收编回执-2026-09-09.md` §六 2。
