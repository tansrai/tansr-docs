# 资料站 · DS-B(vendored 契约 + 生成器)· P1 终报

仓 `tansr-docs` · 分支 `lane/ds/B` · worktree `J:\tansr\worktrees\ds-B` · 基线 main `4a709d3` · 2026-09-08

## 〇 结论一页

- 卡数 4 / 完成 4(DS-06 → 07 → 08 → 09);提交 4 卡 + 本终报 1 = 5;恒未 push、未部署、未改 tansr-cli / tansr-api 仓(只读;cli 的 `dist/` 与 `packages/sdk/dist/` 为 gitignore 构建物,派单授权重建)。
- 门:`node --test scripts/**/*.test.mjs` 25/25 绿;`node scripts/vendor/index.mjs --check` 绿;`node scripts/gen/index.mjs --check` 绿(7 生成物零 diff);`contract/ src/ scripts/` 30 文件 LF 无 BOM 无 U+FFFD 末行换行 0 问题;未建 package.json、未装依赖、未动 astro.config.mjs;全部脚本只用 node 内建模块。
- 先红再绿:4 卡各有「卷先红(产物缺席)→ 生成 → 绿」+ 门「改一字节红 → 再生绿」证据在提交正文(§二)。
- 新卷 4 文件 25 例:`scripts/vendor/index.test.mjs`(6)· `scripts/gen/error-codes.test.mjs`(7)· `scripts/gen/openapi-public.test.mjs`(6)· `scripts/gen/index.test.mjs`(6)。
- 交付下游:`contract/`(7 件 vendored 副本 + `vendored.json`)· `contract/openapi.public.json`(给 DS-A 守卫式挂 `/api/`)· 生成页 7 篇(`errors/codes.md` · `serve/env.md` · `cli/commands.md` · `releases/{cli,sdk,serve}.md`;给 DS-A 侧栏、DS-C 深链)· 脚本名 `vendor` / `vendor:check` / `gen` / `gen:check` 的实际命令(给 DS-A 写 package.json)。
- 计数:错误码 85(公开子集 67)· 公开路径 135 / 操作 167(源 292 / 367)· env 键 30(+5 入口级键只登记名)· 子命令 13 · CHANGELOG 版本段 cli 4 / sdk 3 / serve 3。
- 未闭合:① cli 子命令实为 13 且无分命令 help(派单写 21 / `packages/cli/dist/index.js`,锚点漂移,§五)② 错误码契约无「面 / 可重试 / 说明」字段,三者按规则派生 + 手维护文案(§六)③ `/healthz` `/readyz` tag 为 ops,字面规则会删,点名保留(§六)④ releases 页照抄 CHANGELOG 含内部卡号,与内容律 6 / V-DS-08 冲突(§七)⑤ 终报落本仓 `doc/report/`(派单 §0)而非 doc/133 §七 所写 cli 仓——以派单为准。

## 一 提交清单

| 卡 | 提交 | 一句话 |
|---|---|---|
| DS-06 | `411449f` | vendored 契约与更新脚本(`scripts/vendor/{index,cli-help}.mjs` + `scripts/lib/text.mjs` + `contract/` 首次拷入 7 件 + `vendored.json`) |
| DS-07 | `aa3eb1c` | 错误码表生成(`scripts/gen/error-codes.mjs` + `error-codes.notes.json` + `scripts/gen/lib.mjs` → `errors/codes.md`) |
| DS-08 | `9fca9fb` | REST 公开子集(`scripts/gen/openapi-public.mjs` → `contract/openapi.public.json`) |
| DS-09 | `cd46c27` | serve 环境表 + CLI 命令参考 + 发布说明生成 + `scripts/gen/index.mjs` 总入口(`--check` 汇总门) |
| 终报 | (本提交) | `doc/report/资料站-DS-B-P1-终报.md` |

## 二 逐卡 DoD 对表

### DS-06 vendored 契约与更新脚本 —— `411449f`

- 门:`node --test scripts/**/*.test.mjs` 6/6;`vendor --check` 绿;字节律 12 文件 0 问题;两兄弟仓 `git status --porcelain --untracked-files=no` 为空(vendor 时)。
- 先红:`node --test`(contract/ 未落)→ ✖ `not ok 5 - vendor --check:本仓 contract/ 对表一致 … 'contract/vendored.json 须已随 DS-06 提交'`、✖ `not ok 6 - contract/cli-help.json …`(# tests 6 pass 4 fail 2)。再绿 6/6。
- `vendor --check` 一红一绿:`contract/serve.env.example` 改一字节(offset 3772)→ `[vendor:check] MISMATCH contract/serve.env.example … FAIL 1 项` exit 1;再 `vendor --no-build` → `repaired … revision=0` → `--check` `ok(全部 sha256 对表一致)` exit 0。
- 实跑:`node scripts/vendor/index.mjs --api J:\tansr\tansr-api --cli J:\tansr\tansr-cli` → wrote 7(api `99ba58dbe7e0` · cli `1f74efd58f9e`);二次运行 `wrote=0 unchanged=7`(幂等)。
- 新卷:`scripts/vendor/index.test.mjs`(Modes 解析 / --check 绿 / 改一字节红 / 缺席 + 未登记红 / 本仓对表 + 契约 5 形 / cli-help 形)。
- V-DS-04(vendor --check 改动任一 vendored 文件即红)。文档 ☑:本终报 §四(vendored.json 全文见 §四 4.4)。

### DS-07 错误码表生成 —— `aa3eb1c`

- 门:7/7(全仓 13/13);`node scripts/gen/error-codes.mjs --check` 绿;字节律 17 文件 0 问题。
- 先红:`node --test scripts/gen/error-codes.test.mjs`(页面未生成)→ ✖ `not ok 7 - 在库页面存在且再生零 diff … 须已生成并提交`;✖ `not ok 2 - frontmatter … 第二行生成头`(首版 frontmatter 尾多一空行,修 `lib.mjs` 转绿);`--check` → `再生有差 src/content/docs/errors/codes.md` exit 1。再绿:生成 → `--check ok(1 文件零 diff)`。
- DoD:码数 85 = vendored 条数(卷钉 85);`### <code>` 锚点 85 唯一;再生零 diff;frontmatter 逐字契约 3,第二行生成头契约 4;分组表链接全部可达。
- 新卷:`scripts/gen/error-codes.test.mjs`。V-DS-04。文档 ☑:`src/content/docs/errors/codes.md` 页首写明派生规则。

### DS-08 REST 公开子集 —— `9fca9fb`

- 门:6/6(全仓 19/19);`node scripts/gen/openapi-public.mjs --check` 绿;`vendor --check` 仍绿(public.json 为生成物,登记表跳过)。
- 先红:`node --test scripts/gen/openapi-public.test.mjs`(public.json 未生成)→ ✖ `not ok 6 … 须已生成并提交`;✖ `not ok 3`(首版断言误判 `adminKey` 不可达——实为两条 `/v1` control 操作把 adminKey 列为可选凭据,断言改为「securitySchemes = 公开操作引用集」);`--check` exit 1。再绿:生成 → `ok(1 文件零 diff)`。
- 锁卷:`/admin` 0 · `/webhooks` 0 · `/metrics` 0;公开路径 135 / 操作 167(前缀淘汰 157 路径,tag 淘汰 0);schema 147/177(不可达 30 删);error-codes 子集 67/85;tags 8;securitySchemes 5;`$ref` 悬空 0;servers 只剩 `https://api.tansr.com`。
- 新卷:`scripts/gen/openapi-public.test.mjs`。V-DS-04。文档 ☑:本终报 §四 4.2(挂载路径与 label 建议)。

### DS-09 serve 环境表 + CLI 命令 + 发布说明 + gen 总入口 —— `cd46c27`

- 门:6/6(全仓 25/25);`node scripts/gen/index.mjs --check` 绿;字节律 30 文件 0 问题。
- 先红:`node --test scripts/gen/index.test.mjs`(5 页未生成)→ ✖ `not ok 5 - gen index … 'src/content/docs/serve/env.md 须已生成并提交'`;✖ `not ok 1 - serve-env 解析`(首版正则把括号写成捕获组致 30 键全判敏感;改 `\(` `\)` 转绿);`index --check` → `MISSING ×5` exit 1。再绿:`index.mjs` → done 7 文件;`--check ok(全部生成物零 diff)`。
- `index --check` 一红一绿:`env.md`「共 30 键」改「共 31 键」→ `DIFF src/content/docs/serve/env.md … FAIL 差 1 / 缺 0` exit 1;再生 → ok exit 0。
- DoD:env 键 30 登记(+5 入口级键只登记名)· 子命令 13 登记(派单 21 见 §五)· 三 releases 页正文与 CHANGELOG 去 H1 后逐字节相等,「未发」段原样 · 每生成器再生零 diff · frontmatter 契约字段齐。
- 新卷:`scripts/gen/index.test.mjs`。V-DS-04。文档 ☑:三生成页页首各写明数据来源与口径。

## 三 改动摘要逐文件

| 路径 | 改了什么 | 为何 |
|---|---|---|
| `scripts/lib/text.mjs` | LF / BOM 归一、sha256、ANSI 剥离、`--k v` 参数解析、`isMainModule`、`writeLf` | vendor 与 gen 共用;只用 node 内建模块 |
| `scripts/vendor/index.mjs` | `--api --cli [--no-build]` 拷入 7 件 + 登记;`--check` sha 对表(缺席 / 不符 / 未登记);`--root` | 契约 5;DS-06 |
| `scripts/vendor/cli-help.mjs` | 对 `dist/tansr.mjs` 采集顶层与子命令 `--help`;Modes 块解析子命令;`TANSR_USER_HOME` 隔离 | 方案 §五「采集脚本 scripts/vendor/cli-help.mjs」 |
| `scripts/vendor/index.test.mjs` | 6 例 | 一红一绿 + 形锁 |
| `contract/openapi.json` 等 7 件 + `contract/vendored.json` | 契约副本与登记 | 派单「本卡实跑一次,产物一并提交」 |
| `scripts/gen/lib.mjs` | frontmatter(契约 3)/ 生成头(契约 4)/ `slug`(github-slugger 同律)/ `runGenerator`(`--check` `--root`) | 五生成器共用 |
| `scripts/gen/error-codes.mjs` + `error-codes.notes.json` | 85 码 → `errors/codes.md`;面 / 可重试规则派生;文案手维护并锁「无陈旧键」 | DS-07 |
| `scripts/gen/openapi-public.mjs` | 前缀白名单 × tag 黑名单(探针点名保留)、扩展键裁剪、`$ref` 闭包、错误码子集、servers / tags / info | DS-08 |
| `scripts/gen/serve-env.mjs` | 解析 `.env.example` 注释形 → `serve/env.md`;头注键数对表;入口级键节 | DS-09 |
| `scripts/gen/cli-commands.mjs` | `cli-help.json` → `cli/commands.md`;同文 help 不重复贴 | DS-09 |
| `scripts/gen/releases.mjs` | 三 CHANGELOG → `releases/{cli,sdk,serve}.md`;H1 进 title,正文逐字节 | DS-09 |
| `scripts/gen/index.mjs` | 跑全部;`--check` 临时目录逐字节比对 | 契约 2 `gen` / `gen:check` 的目标 |
| `scripts/gen/{error-codes,openapi-public,index}.test.mjs` | 19 例 | 各卡卷 |
| `contract/openapi.public.json` | 生成物 | DS-08 |
| `src/content/docs/{errors/codes,serve/env,cli/commands,releases/{cli,sdk,serve}}.md` | 生成页 7 篇 | 契约 4 路径 |

## 四 跨泳道接口

### 4.1 交付给 DS-A(package.json 脚本名 → 实际命令;契约 2)

| 脚本名 | 命令 |
|---|---|
| `vendor` | `node scripts/vendor/index.mjs`(用法 `pnpm vendor --api <apiRepo> --cli <cliRepo> [--no-build]`) |
| `vendor:check` | `node scripts/vendor/index.mjs --check` |
| `gen` | `node scripts/gen/index.mjs` |
| `gen:check` | `node scripts/gen/index.mjs --check` |
| `test` | `node --test scripts/**/*.test.mjs`(本泳道 25 例已在) |

### 4.2 交付给 DS-A(astro.config.mjs openapi 挂载;我未动该文件)

- 文件:`contract/openapi.public.json`(相对仓根;`fs.existsSync` 守卫,缺席不挂)。
- 建议:`starlight-openapi` 的 `schema: './contract/openapi.public.json'`,`base: 'api'`,`label: 'REST API'`(侧栏组名;或「REST 接口参考」);`info.title` 已为「tansr 平台 REST API(公开面)」,`servers` 只剩 `https://api.tansr.com`。
- 侧栏生成页 slug(契约 4):`errors/codes` · `serve/env` · `cli/commands` · `releases/cli` · `releases/sdk` · `releases/serve`。

### 4.3 交付给 DS-C(深链锚点)

- 错误码:`/errors/codes#<code>`(85 个,码名即锚,如 `#rate_limited`);分组锚 `#通用` `#twp-协议面` `#控制面` `#支付回调面` `#管理面` `#其他`(本轮无 gateway 独占码,故无「数据面」分组)。
- env 键:`/serve/env#<小写键名>`(30 键 + 入口级 5 键:`#tansr_serve_token` `#tansr_serve_drain_timeout_ms` `#tansr_serve_v1_retention_ms` `#tansr_serve_v1_max_retained` `#tansr_serve_mcp_connections`)。
- 子命令:`/cli/commands#<cmd>`:`#serve` `#orchestrate` `#approvals` `#policy-pull` `#acp` `#mcp-serve` `#doctor` `#update` `#bg` `#sessions` `#login` `#logout` `#whoami`;`#全局帮助`。
- 发布说明:`/releases/{cli,sdk,serve}`;版本段锚 = Starlight 对 `## 0.5.0` 的 slug(`#050`)。

### 4.4 vendored.json 全文(`411449f`;主线收编时 `pnpm vendor --api J:\tansr\tansr-api --cli J:\tansr\tansr-cli` 再生一次对表)

```json
{
  "openapi.json": {
    "source": "tansr-api@99ba58dbe7e0:openapi/openapi.json",
    "revision": 0,
    "sha256": "6dbec72df8b985339ea006f46ecaa3288e1d5a73918e27061f00e3e672fdf1d0",
    "vendoredAt": "2026-09-08"
  },
  "serve.env.example": {
    "source": "tansr-cli@1f74efd58f9e:packages/server/.env.example",
    "revision": 0,
    "sha256": "bd3baf476c2e89f98848923661161684179b4b457ff72818e5482d942e350120",
    "vendoredAt": "2026-09-08"
  },
  "changelog/cli.md": {
    "source": "tansr-cli@1f74efd58f9e:CHANGELOG.md",
    "revision": 0,
    "sha256": "95a1532f4d1b6ca2d796b8a74b1cf7cfc75352ecbca043c6c9ba9a9f0cab0af6",
    "vendoredAt": "2026-09-08"
  },
  "changelog/sdk.md": {
    "source": "tansr-cli@1f74efd58f9e:packages/sdk/CHANGELOG.md",
    "revision": 0,
    "sha256": "2823896225f6b17d1b5d60629f83ebc244a75f6fcdf2d28c95838329b10eafaf",
    "vendoredAt": "2026-09-08"
  },
  "changelog/serve.md": {
    "source": "tansr-cli@1f74efd58f9e:packages/server/CHANGELOG.md",
    "revision": 0,
    "sha256": "fdf19fe8dd466cb2975bd18eb2140bac57b95090bacd19e4d8de7b634408d454",
    "vendoredAt": "2026-09-08"
  },
  "cli-help.json": {
    "source": "tansr-cli@1f74efd58f9e:dist/tansr.mjs",
    "revision": 0,
    "sha256": "5ee60909bfceb1b53d65e1ed3a8647a4d663312ede8c1e99274766a72f36b5c1",
    "vendoredAt": "2026-09-08"
  },
  "sdk-index.d.ts": {
    "source": "tansr-cli@1f74efd58f9e:packages/sdk/dist/index.d.ts",
    "revision": 0,
    "sha256": "82499ef0a8e2796c5b3de06de5e694d9f255fa06a54b2fcbd14a9356bb627665",
    "vendoredAt": "2026-09-08"
  }
}
```

### 4.5 消费

- 等 DS-A:`package.json`(脚本名见 4.1)、`content.config.ts` 的 frontmatter schema(我按契约 3 逐字写,字符串一律单引号、`lastVerified` 为字符串而非 YAML 日期)、`astro.config.mjs` 守卫挂载(4.2)、`scripts/check/frontmatter.mjs` 对 `sources: ['contract/…']` 的存在性校验(七件副本与 public.json 都在)。
- 等 DS-C:引用错误码 / env 键 / 子命令时用 4.3 锚点;`releases` 页请勿再手写版本内容。

## 五 与派单 / doc/133 / doc/134 不符之处

1. **cli 构建物与 help 形(锚点漂移)**:派单 / doc/134 写「`pnpm --filter @tansr/cli build`(若 `packages/cli/dist` 缺)再跑 `node packages/cli/dist/index.js --help`」——cli 仓 `packages/cli/package.json` 无 `build` 脚本、无 `dist/`;真构建物是仓根 `dist/tansr.mjs`(`node build/build.mjs --only-tansr`)。已按真路径实现(`CLI_BUNDLE_REL = 'dist/tansr.mjs'`),`vendored.json` source 记 `tansr-cli@<sha>:dist/tansr.mjs`。
2. **子命令数 13,非 21;无分命令 help**:`packages/cli/src/main.ts` `hasHelpFlag(argv)` 在路由最前,`--help` 出现在任意位置都打同一份全局帮助(源码注释「不做分命令帮助」);顶层 help「Modes:」块解析得 13 个命令(serve · orchestrate · approvals · policy pull · acp · mcp serve · doctor · update · bg · sessions · login · logout · whoami),13 份子命令 help 全部与顶层逐字相同、退出码 0。派单列的 auth / device / headless / identity / init / org / tui / usage 中:`init` `org` `profile` 是 main.ts 里有路由但**不在 help Modes 块**的命令(未采集——按派单「子命令名从顶层 help 解析」);auth / device / headless / identity / tui / usage 不是命令。`cli-help.json` 如实记录;`cli/commands.md` 对同文 help 不重复贴、写明并链回全局帮助。**建议主线转 cli 仓一卡**:全局帮助补 `init` / `org` / `profile` 行(或做分命令 help),资料站再 vendor 即得。
3. **错误码「面 / 可重试 / 说明 / 端侧提示」字段不存在**:契约 `x-tansr-error-codes[]` 只有 `{ code, status }`(`unauthorized` 另携 `x-invalidates-token` / `x-tansr-token-reasons`);派生规则见 §六 1。
4. **每码标题层级**:派单写「每码一个二级标题」;实现为 `## <面>` + `### <code>`(H1 归页题,面需一层容纳),锚点 `#<code>` 不受影响(Starlight TOC 默认到 h3)。若主线要字面「二级」,改 `render()` 两行即可。
5. **`/healthz` `/readyz` 与 tag 黑名单冲突**:两探针 tag 恰为 `ops`,字面「路径任一 op 命中黑名单 tag 即整条不出」会把白名单点名的两路径删掉;实现加 `TAG_BLACKLIST_EXEMPT_PATHS = ['/healthz','/readyz']` 点名保留(§六 2)。结果 135 路径 / 167 操作;若主线要字面规则,删该常量即 133 / 165。
6. **`x-tansr-error-codes` 公开子集口径**:契约无 op ↔ 码的结构化引用,「被公开 op 引用」实现为「公开 op 的 summary / 参数说明 / 响应说明整词出现该码」,得 67/85;未被文字引用的 18 码(含 `internal_error` `model_not_found` `plan_required` 等)不进 public.json 顶层目录(`ErrorEnvelope.error.code` 枚举 schema 保持原样,仍列全 85)。
7. **`info.description` 与 `servers`**:派单只说改 `info.title`;原 description 提及「管理面(门户 BFF 专用)」与契约 tag,已改为公开面口径;`servers` 去 `http://localhost:8787`(内容律「无内网地址」取宽)。
8. **`adminKey` 留在 public.json**:`/v1/adjudicators/{id}/evaluation-report`(POST)与 `/v1/adjudicator-pool/artifact`(GET)两条 control 操作把 `adminKey` 列为可选凭据,securitySchemes 如实保留 5 个。建议主线知会 api 侧核对这两条是否该出现在公开面。
9. **env 键锚点 `#tansr_serve_token`**:契约 4 举例的 `TANSR_SERVE_TOKEN` 不在 `.env.example` 30 键表内(头注明言「不在表内」的 5 个入口级键);生成页加 `## 入口级键` 一节只登记键名供锚,30 键计数不变。
10. **releases 页 H1**:CHANGELOG 首行 `# @tansr/cli Changelog` 作为 `title` 进 frontmatter(Starlight 由 title 渲染 H1,正文再留会重复),其余逐字节照抄。
11. **终报落点**:doc/133 §七 写「落 cli 仓 doc/report」,派单 §0 写「落本仓 `doc/report/`」;以派单为准落本仓。
12. **估时**:四卡合计 2.75 人日 → 单次会话完成(含读源码勘定 help 形与 openapi 实形)。

## 六 代拍登记

1. **错误码三列派生规则**(设计空白;原则「表生成而非手写」+「真组合」):面 = 扫 openapi 全部操作文本整词出现该码的操作 tag 归面(gateway → 数据面;twp → twp 协议面;auth / orgs / control / apps / org-governance → 控制面;webhooks → 支付回调面;admin → 管理面;ops → 运维探针),恰一面归该面、多面归「通用」、零面归「其他」;可重试 = HTTP 429 / 502 / 503 / 504(`device_code_pending` 400 例外为「继续轮询」);说明 / 端侧提示 = `scripts/gen/error-codes.notes.json` 用户口吻文案(85/85 有,卷锁「无契约外键」;缺则按状态给通用一句),`x-invalidates-token` 码自动追加「清除令牌并重新登录 + detail.reason 取值 + transient 子集不清除」。影响面:分组随 api 描述文字变化而变(生成物,零手改);建议 api 侧日后在目录里加 `x-tansr-surface` / `x-tansr-retryable`,生成器优先读契约字段。
2. **探针点名保留**(§五 5):按「白名单点名 > 黑名单 tag」定;单常量可翻。
3. **vendored 幂等律**:登记 sha 与上游一致即不动登记项(source / revision / vendoredAt 都不变);本地副本被改坏只修复文件不计 revision;`vendoredAt` 只在内容变或新登记时取当日。影响面:`lastVerified` = 该文件内容最后一次变化被拷入的日期,而非最近一次跑 vendor 的日期。
4. **子命令 help 同文不重复贴**(§五 2):页面一份全局帮助 + 每子命令一节说明与链回;`cli-help.json` 仍逐条记全文,契约不缩水。
5. **cli-help.json 增字段**:在 `{ command, help, exitCode }` 之上加 `args`(实际命令行)与 `summary`(Modes 行描述),顶层 `tool` / `version` / `bundle` / `top`;纯加法。
6. **构建物缺省重建**:vendor 每次在 cli 仓就地重建 `dist/tansr.mjs` 与 `packages/sdk/dist/index.d.ts`(两者本次勘定均比 HEAD 旧两天,不重建则 source sha 与内容不对应);`--no-build` 跳过;两仓 tracked 文件须干净否则拒跑(source 须指向真实提交)。

## 七 未完成 / 敞口 / ⏸ 项

- **releases 页含内部编号**(FX-X-nn / W1–W4 / 收编回执 / 泳道语):派单「正文照抄、『未发』段原样」与内容律 6 / doc/134 V-DS-08(`rg` 门 `FX-|W[1-5] 回执|泳道|收编`)直接冲突;本泳道按派单照抄。主线需拍:(a) V-DS-08 对 `releases/**` 豁免;或 (b) cli 仓 CHANGELOG 改口再 vendor;或 (c) 生成器加脱敏规则(我不建议——会改动「照抄」语义)。
- **cli 全局帮助缺 `init` / `org` / `profile`**(§五 2):资料站侧不能凭空补,需 cli 仓补 help 行后再 vendor。
- **`x-tansr-error-codes` 公开子集缺 `internal_error` 等通用码**(§五 6):可由 api 侧在通用响应说明里点名,或主线拍「公开子集 = 全部 85」(改 `filterPublic` 一行)。
- **sdk-index.d.ts 只拷入未消费**:typedoc → starlight-typedoc 属 P2;本轮只做 vendored 副本(23360 行,LF)。导出数 482 未在本泳道复核。
- **tansr-cli 工作区在本泳道收尾时有他人未提交改动**(`doc/report/核心机制复核与整改调优方案-2026-09-08.md`,22:45 改;非本泳道所为,本泳道对 cli 仓零写入):`vendor` 的干净检查会因此拒跑,主线再生前需先让该改动入库或还原(或加 `--allow-dirty`——本轮未加,保守)。
- **未跑**:astro 构建 / `links` / `frontmatter` 三门在 DS-A 侧(本仓无 package.json,派单禁建);生成页的 Markdown 表格与中文锚点在 Starlight 下的渲染由主线收编后 `pnpm gate` 首次验证;若 `lastVerified` 在 `content.config.ts` 被定义为 `z.date()`,我这里的单引号字符串会红——请 DS-A 用 `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`(契约 3 写的是 `'YYYY-MM-DD'` 字符串形)。

## 八 回主线摘要

- 4 卡 4 完成,提交 `411449f` `aa3eb1c` `9fca9fb` `cd46c27` + 终报;恒未 push;兄弟仓零写入(dist 构建物为 gitignore)。
- `DS-06 | 411449f | 卷先红(vendored.json 缺席 6 例 fail 2)→ 实跑 vendor 绿 6/6;--check 改一字节 MISMATCH exit 1 → 修复 revision=0 → ok exit 0 | scripts/vendor/index.test.mjs | V-DS-04 | 终报 §四 4.4`
- `DS-07 | aa3eb1c | 卷先红(codes.md 缺席)+ --check 再生有差 exit 1 → 生成 → 85 码 / 锚点唯一 / 零 diff 7/7 | scripts/gen/error-codes.test.mjs | V-DS-04 | src/content/docs/errors/codes.md 页首规则`
- `DS-08 | 9fca9fb | 卷先红(public.json 缺席)exit 1 → 生成 → /admin 0 · /webhooks 0 · /metrics 0 · 135 路径 / 167 操作 · $ref 悬空 0 · 零 diff 6/6 | scripts/gen/openapi-public.test.mjs | V-DS-04 | 终报 §四 4.2`
- `DS-09 | cd46c27 | 卷先红(5 页 MISSING)exit 1 → 生成 → 30 键 / 13 子命令 / 三 CHANGELOG 逐字节 · index --check 改一字节 DIFF exit 1 → 再生 ok | scripts/gen/index.test.mjs | V-DS-04 | 三生成页页首口径`
- 计数:错误码 85(公开 67)· 公开路径 135 / 操作 167 · env 键 30(+5 入口级)· 子命令 13 · CHANGELOG 段 cli 4 / sdk 3 / serve 3。
- 给 DS-A:脚本名 → 命令表(§四 4.1);`contract/openapi.public.json` 守卫挂 `/api/`,label 建议「REST API」(§四 4.2);`lastVerified` 用字符串 schema。
- 给 DS-C:锚点表(§四 4.3);`#tansr_serve_token` 在「入口级键」节。
- 待主线拍:releases 页内部编号 vs V-DS-08(§七 1);探针点名保留与错误码子集口径(§五 5 / 6);`adminKey` 两条 `/v1` op 是否属公开面(§五 8);cli 仓补 help 行(§五 2)。
- 收编再生:先确认 cli 工作区干净(§七 5),`pnpm vendor --api J:\tansr\tansr-api --cli J:\tansr\tansr-cli` → `pnpm gen` → `pnpm gen:check` / `pnpm vendor:check` → `pnpm test`。
