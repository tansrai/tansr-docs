# @tansr/cli Changelog

> 发版门(`scripts/release/gate.mjs --package cli`,十王修案 FX-C-25)③ 步要求:每个发布版本在此有 `## <version>` 段且段体非空;
> cli 为 bin 包,④ 步导出集判 n/a;⑤ 步 tag 形 `v<version>`(沿用既有 `v0.1.0 … v0.4.0`);发版回执落 `doc/release/cli-<version>.md`;无回执无 tag。
> 版本号 = 仓根 `package.json`(`packages/cli/package.json` 为 private 占位;pack-npm / pack-sea / sync-recipes 同源)。
> 0.4.0 及更早版本为追溯登记(当时无本文件;本文件由十王修案第五波 C-γ「CHANGELOG 三包就位」建立,**不发版**)。

面向 `tansr` 命令行使用者与宿主运维方(TUI / `serve` / `acp` / `mcp-serve` / `bg` / `update` / `doctor`)的可见变更登记;`@tansr/sdk` /
`@tansr/serve` 库面见 `packages/sdk/CHANGELOG.md` / `packages/server/CHANGELOG.md`,kernel 内部改动不入此表。每条写「变了什么 · 对你意味着什么 ·
迁移方式」并括注卡号(FX-X-nn)与波次(W1–W4);事实源 = 各波收编回执 `doc/report/十王修案-W{1,2,3,4}-收编回执-*.md` §一与泳道终报。
0.2.0 之前的历史见 git(`git log -- packages/cli`)。

## 未发布(核心组件设计审查整改;版本号与发版节奏待用户拍板)

- **五入口进程生命周期统一**(RF-03,RV-5-02 / RV-4-03):TUI / headless / `acp` / `mcp-serve` / `serve` 全部经共享组件 `assembly/process-lifecycle.ts` 处理 SIGINT / SIGTERM / SIGHUP / SIGBREAK——首枚信号触发一次幂等有界收口(headless / acp / mcp-serve 沿各自既有预算;TUI 10 s;serve `drainTimeoutMs + 15 s`),预算到点在 stderr 留一行结构化 `process.hard_exit` 后 exit 2;**第二枚信号立即 exit 2**(此前 acp / mcp-serve 第二枚被吞、headless 只认 SIGINT、TUI 对 TERM / HUP 零处理);SIGHUP 独立紧急预算 ≤ 3 s。退出码统一取 `exit-code.ts` 表(2 = 中断 / 外部信号 / 停机;TUI 未捕获异常仍为 1)。**迁移**:依赖「第二枚 Ctrl+C 无效、必等 drain」的脚本请改为只发一枚或等待退出码 2。
- **TUI Ctrl+C 与终端复位**(RF-03,RV-5-07):Ctrl+C 自管双击语义——运行中一枚 = 中断本轮并提示,空闲一枚 = 提示,1.5 s 窗内二枚 = 同 `/quit`(ink `exitOnCtrlC` 关闭,signal-exit 退为兜底);SIGTERM / SIGHUP 到来时在飞轮以 `emergency_seal` 内部记录幂等紧急封口(已流出文本作 `partialText` 留档、不伪造轮末、resume 自动跳过),随既有收口链释放 MCP 子进程与会话锁;bracketed paste 在任何退出路径(含未捕获异常)先复位再退出。无需迁移。
- **`tansr bg kill` 身份核对**(RF-03,RV-5-01):后台任务记录新增运行器身份(本机 IPC 端点 + 发车端随机令牌,令牌恒不出现在 `bg list / show / --json` 输出);`bg kill` 先核身份再动作——相符 → 停止请求(POSIX SIGTERM / Windows 端点 stop)→ 宽限 5 s → 复核后才 KILL,`--json` 多 `stopped: graceful | exited | forced`;pid 被复用的陌生进程 / 端点不可达 → 显示 `stale`、拒杀、退出码 1 携 `runner_identity_mismatch | runner_unreachable | runner_identity_unverifiable`。**迁移**:升级前发起、无身份块的旧记录 `bg kill` 一律拒杀(`bg list` 仍按 pid 展示),需要时用 OS 手段结束;`bg` 热路径不再派生 PowerShell。
- **`tansr serve` 每轮墙钟缺省 30 min**(RF-03,§3 代拍 #9 = A):`TANSR_SERVE_TURN_WALL_CLOCK_MS` 缺席 = 1 800 000 ms,显式 `0` = 停用;停机 `closeAll` 有界 5 s(`server.close_timeout` warn 后继续)。详见 `packages/server/CHANGELOG.md`。
- **关键状态文件原子写**(RF-07,RV-5-05):`credentials.json`(v2 / v3)、bundle 缓存、init-state 指针改为「同目录临时文件 + fsync + rename」——登录 / 派生键轮换 / 缓存刷新途中断电或进程被杀,文件要么是旧的完整档要么是新的完整档,不再出现读取报 `parse_failed` 的半截档。bundle 缓存文件按 0600 落盘(Windows 上权限位无效,文件保护依赖用户目录 ACL,与凭据档同口径)。无迁移动作。
- **凭据解密单点**(RF-07,RV-5-09):远程装配与裁决人池共享同一进程内凭据读取器,一次启动只解密一次;Windows DPAPI 档(PAT + 派生键)合并为**单次** `powershell.exe` 冷启(此前每处消费方各起一到两次)。行为不变,启动更快;凭据文件被改写(另一进程 login / logout)后自动重读。
- **`tansr logout` 连清 bundle 缓存**(RF-07,RV-5-10;行为变化):此前只有 v2 应用键档登出会清该键缓存,v3(PAT + 派生键)档登出后远端组织配置缓存留在磁盘;现在不分版本一律清除配置根 `bundle-cache/*.json`(含其他 v2 档案簿键的缓存)与活动身份仓 `bundle-cache.json`。缓存恒可重建,重登首拉即复原;会话 / 记忆等身份仓数据仍不删。
- **SEA 自更新换装耐久 + 备份只留 1 份**(RF-07,RV-5-06 fsync / 备份部分):staging 写后先 fsync 再进入 rename 换装;换装成功后同名可执行的历史备份 `<exe>.old-<版本>` 只保留本次这一份(更早的自动修剪,不同名文件不触及)。此前每次升级多留一份旧档。
- **`tansr doctor` 只读**(RF-07,RV-5-10):会话存储可写性探针不再 `mkdir -p sessions/`——改在最近已存在的祖先目录写后即删;doctor 不再创建任何目录,存储根被文件占位仍如实报 `session_store_unwritable`。
- **更新签名指针单调序号(防回放)**(RF-07b,RV-5-06 时效性;代拍 #7 结论 B⁺):官方 SEA 签名指针在被签的指针体内新增加法字段 `sequence`(每通道单调)与信息性 `issuedAt`;客户端在 `${TANSR_CONFIG_DIR || ~/.tansr}/update-state.json` 按「分发点 origin + 通道」记住最近一次完整核验通过的序号——收到更小序号的封套(合法签名的旧封套被重放 / 回滚)拒绝并报 `pointer_sequence_rollback`(文案携两侧序号);无序号旧形封套按迁移律**「视为 0 并警告」**:视 `sequence = 0` 参与比对,本机已核验过序号 > 0 时报 `pointer_sequence_missing`,否则(从未见过带序号封套,或水位恰为 0)放行、不建立水位,成功通知末尾附一行「该源暂无防回放」提示(旧分发点 / 企业自托管平滑迁移)。签名 / 未签名钉死 / semver 降级守卫不变;**不引入 `expires`**(签名私钥不远端托管),`issuedAt` 陈旧不拒绝、只由 `tansr doctor` 呈现封套年龄(超 90 天出提示行,JSON 新增可选 `updateSource` 段)。发布侧:`sign-release.mjs --latest` 写入 `sequence`(`TANSR_RELEASE_SEQUENCE` 或墙钟毫秒),`publish-oss.mjs --yes` 真传前对远端现行封套核序号前进(回退 / 同号异版拒发)。迁移:无需动作;如分发点合法重建序号,删除 `update-state.json` 即重置本机水位。

## 0.6.0 — 2026-09-10

- 汇总此前未发布的 0.5.0 候选能力、AP-SP 应用提示词、ARC 核心治理，以及同轮文本追加（INJ）；旧 v0.5.0 本地候发标签继续保留在原源码，不移动。
- TUI、ACP 与 headless 共用同轮输入接纳；严格目标和有限内存回执不会截断当前任务、重置预算或代替权限审批。headless 新通道须显式 -p 与 stream-json。
- 修正查询自然封口、回调重入、历史纪元和输出背压边界；原工具、压缩、用量、权限及资源收口合同保留。具体自动化范围见同轮追加输入架构验收报告。
- 本批版本与候发源码按 REL-04 推进；真实发布状态以 doc/release 回执和 npm registry 为准。

## 0.5.0

> 历史候选归档：0.5.0 没有单独发布，以下内容并入 0.6.0；本地 v0.5.0 标签保留在原候选源码。
> 十王修案 W1–W4 原收编于 main `9f09c1b7`；原 sdk 0.12.0 / serve 0.7.0 候选由本批 SDK 0.13.0 / serve 0.8.0 接替。实际发布以回执和 registry 为准。

### 核心机制整改（CM；历史候选内容）

- ACP/CLI serve 的新建与恢复会话按当前组织记忆开关和规范化项目目录绑定记忆；恢复到另一项目明确报 `memory_project_mismatch`。同一项目的 worktree 仍共享记忆，历史 junction 别名分片保留，不自动迁移合并；既有会话 `/cd` 语义保持（CM-01）。
- 常驻子代理的 Write/Edit 也执行真实目标记忆围栏，junction 不再绕过；父会话换根不会改写旧代理的围栏材料（CM-05）。
- 召回正文被附件总帽拒载时，不再永久当作已经送达；新触达或新 prefetch 可重试。旧候选日志口径保留，新增准入统计区分正文、短引用与拒载；“准入”不代表远端已接收（CM-07）。
- 摘要质量拒绝和取消之前已经报告的摘要用量计入费用，拒绝的摘要仍不替换历史。工具超时明确提示残余操作可能仍在运行，需确认停止后再重试有副作用操作（CM-02/15）。
- 原子写的临时写入、权限设置或替换失败时保留原文件；大文件分页与整读保持编码语义，选中窗口和超长行驻留有上限，精确指纹仍扫描全文件（CM-04/08）。
- 四媒体工具在执行入口按各自 schema 拒绝坏参数，合法默认值与既有权限/裁决流程保持（CM-09）。
- CLI serve 的 TTS 落盘失败不再把宿主路径放进远端结果；已生成的 base64 音频仍返回，本地记录安全诊断。嵌入工厂可用 `onArtifactSinkError` 消费原始错误，回调异常不会吞掉音频（CM-10）。
- 平台语音识别除原始 24 MiB 音频帽外，发送前还检查实际序列化 JSON 的 32 MiB 体帽；base64 与所有字段均计入。越限时可改用公开 URL 或压缩音频，BYO multipart 原始字节语义保持（CM-11）。
- 新 SEA 默认更新入口改为 `latest.signed.json` 单对象签名封套，缺席或坏签不降级。自托管分发方须随首次升级发布该文件；显式旧 `latest.json` 与企业 manifest 地址仍兼容，旧双对象错配窗口仍可能暂时拒绝更新。版本目录同名不同字节拒绝覆盖，保留材料可用于幂等重试（CM-12；迁移详见 `doc/report/核心机制整改-CM-12-终报.md`）。

### 安全与权限(收紧;默认行为变化)

- **出网单点 + SSRF 三层门**(FX-B-12 / FX-B-13 · W1):WebFetch / Http / hooks 出网 / ASR 音频下载全部改经 kernel `createEgressDispatcher`
  (DNS 解析后再判私网 / 环回 / 链路本地 + 代理复合),cli 进程级单例 `processEgressClient()`;字面量表 `packages/kernel/contract/egress-literals.json`
  生成物 + 零 diff 门。此前五处各自 fetch,私网地址可被 302 / DNS 重绑绕过。用户可见:指向私网 / 元数据地址的抓取被拒并给出原因。
- **凭据出线单一名单 `http.allowedAuthEnvVars`**(FX-B-15 · W1):Http 工具 / hooks 的 `auth` 只能引用名单内的环境变量,名单外 → `auth_env_not_allowed`
  **不发请求**;该段为 user-managed(项目层写入被忽略并诊断 `http_section_layer_ignored`),组织可远程下发收紧。迁移:把原本在 `auth` 里引用的变量名加进
  `~/.tansr/settings` 的 `http.allowedAuthEnvVars`。
- **携凭据的 Http 调用全模式恒 ask**(FX-B-16 · W1;hard-safety 第 0 段):Http 携 `auth` / WebFetch · Http 的污点态在 `auto` / `acceptEdits` / `bypass`
  下仍咨询,任何 deny 不软化,分类器不豁免,`dontAsk` / 无通道地板 deny;TUI 弹卡加「安全层」理由行(携变量名 + 方法 + origin)。
- **裁决姿态单点推导**(FX-B-04 / FX-B-05 · W1 / W2):`derivePosture` 按 `askUser` 在场性判 A / B 姿态;裁决人在场时的权限模式由
  `modeUnderAdjudicator({ posture, tier })` 推导——**B 姿态 × 资格档 `none` 不再切 `auto`**(cwd 内写删从零咨询放行变为 ask → 无通道 deny)。
  受影响:无 `askUser` 通道且 bundle 裁决人档无 `tier` 的宿主(acp / mcp-serve 令牌档);要保留放行请给档授格或接通道。acp `requestPermission`
  加第四参 `attribution`。
- **权限门重判律两门同源**(FX-B-10 · W2):cli 门与 sdk 门 import 同一份 `permissions/gate-recheck.ts`——PreToolUse hook 替换入参后按替换后参数
  真实归因重判、hook 明示 `ask` 恒不被裁决人代批、两重判位不重跑 hooks / 不二次咨询。
- **机器放行也出 `tool.permission.decided`**(FX-B-09 · W2):裁决人放行恒发 `decided{allow, decisionSource:'classifier'}`,模式放行对非只读调用发
  `decisionSource:'mode'`;TUI narrator 加「allowed by adjudicator」句。审计面此前只见拒绝。
- **mcp-serve 提权门前门后各判一次**(FX-B-18 · W3;红线 4):`tools/call` 经 kernel `precheckEscalation` / `postcheckEscalation`,`canAsk=false`
  → 沙箱旁路 / 直接携带 / hook `updatedArgs` 注入三形一律 `[escalation_denied]`(H-2 止血形被替换,语义同)。
- **Shell `escalated` 位只在 capability ≠ none 时落键**(FX-B-20 T-10 · W3);**`tansr bg show / kill` 的 id 先校形再拼路径**(T2-06;id 形
  `bg-<n>-<nnnn>`,旧短形 `bg-1` 不再接受)。

### 工具与执行面(边界卫生;FX-B-20 · W3 除注明外)

- **`/cd` 一处重建全链**(FX-B-17 · W3;R-04 cli 母卡):`assembly/cwd-rebind.ts` 收敛点——hooks 引擎 → 权限门 → `withCwd` 执行器 → Shell 沙箱写边界
  同笔重建;Task 转发门不再传 cwd;checkpoint store 以 cwd 闭包;`/restore` / `/fork` 对账当前 cwd。此前 `/cd` 后五处仍持启动 cwd。
- 常驻子代理帽 `maxResident` + 结构化 `capacity` 拒(T-07);硬超时后独占槽待工具 settle、宽限有界才释放(T-08);每调用信号分叉透传取消原因(T-09);
  文件写入同目录 tmp + rename 原子化 + `contentHash` 第二道守卫,Write / Edit 对「读后被改」按内容哈希判(T-13);超整读帽的大文件 Read 按块流式分页,
  不再整读进内存(T-14);**Read 图片按会话当前模型放行**(T-15;此前 serve / acp / sdk 面恒拒且文案误称「模型不支持」,现按 providers 内置能力表,
  未收录模型如实说 unknown)。
- **四媒体工具失败以 `tool.completed.isError` 出线**(FX-B-25 · W2;R-17):超时 / 供应商失败不再伪装成 `tool.failed`,TUI 归约为 failed 卡;执行器硬帽 =
  预算 + 宽限 + 1 s,超时文案「may still complete and bill」;止血 FX-B-25/H-1 `errorCode:'provider_error'`(W1)并入。
- **媒体错误提示按受众**(FX-B-26 · W3):cli 以 `audience:'user'` 取 hint,词表外码回落通用指引;模型可用性未核验行注记 `[availability unverified]`;
  数据 URI 体积预检 `bad_request`;ASR 原始字节 > 24 MiB 在流中早拒(FX-B-14 · W2 32 MiB 流帽同笔)。BYO 供应商 404 / 错误回显脱敏基址 query 与实际 URL(FX-B-14)。
- Task 派生序围栏就地替换 + MCP `registerExpansion` 同一对象归 `alreadyLoaded` + discover 文案去 TUI 命令(FX-B-19 · W1)。
- **会话锁「pid 存活恒不抢占」**(FX-B-22 · W1):24 h 只对载荷损坏兜底,`lock.touch()` 心跳,只读径 `readAll({ repair:false })` 不抢不删;僵死活 pid
  持锁需人工。会话 store 单核 `createSessionStoreCore`(FX-B-21 · W1):`pendingRewrite` 持久闩 + 前缀校验 + 段感知在场性(H-3 止血并入)。
- 快照是附属能力(FX-B-23 · W2):`listCheckpointsDetailed` 单档隔离、GC 不误删、杂散 `notes.json` 不再整体 `CHECKPOINT_INVALID`;`retention.maxAgeDays`。
- 套餐配额拒绝可判(M-03 · W3;contract-v0.26):平台套餐四码 `turn.error.detail{ scope:'plan' }`;TUI 与端侧同键。

### 帮助

- **分命令 `--help`**(DS-25 · 资料站 P2):`tansr <cmd> --help|-h`(旗标在子命令后任意位置)打该子命令的 usage 段(一句话 / 旗标表 / 例子);无子命令、未知子命令或首参为旗标(`tansr -p serve --help`)仍打全局帮助。全局帮助 Modes 块列全部 16 个子命令(补 `logout / whoami / init / profile / org` 行)。旧调用形行为不变(仍得帮助文本、退出码 0),只是更精准。

### 配置与 `doctor`

- **段策略表 `SECTION_POLICIES` 单一事实源**(FX-B-01 · W2):sandbox / update 两段 user-managed(项目层写入被忽略并诊断
  `sandbox_section_layer_ignored` / `update_section_layer_ignored`);sandbox managed 地板下 **env 只能收紧**(放宽被压 → 归因 `env-suppressed`);
  `doctor` 输出加 `config.ignoredSections` 逐条 + 沙箱行 `env-suppressed` 归因行;`--dump-config` 剥离面由表派生。
- **`update.manifestUrl` 只认 https 绝对 URL,产物地址须与 manifest 同 origin**(FX-B-02 · W2;W-05):项目层 `update.manifestUrl` 不再生效(此前可被仓内
  配置劫持到恶意分发点);`tansr update` 对同主机异端口 / http 地址 → `untrusted_host`。
- **配置层四律与键目录**(FX-B-03 · W4):doc/11 §14.4 补「managed = 地板 / 锁 = 钉值 / env 只收紧 / 组织锁定压 env」+「组织级暂不可配」清单(MCP 白名单 /
  permissions / hooks / skills 目录 / 网络工具整族开关);`lockableSettingsCatalog()`(21 键)/ `orgUndeliverableSettingsSections()` 供控制台键目录与
  api 写面校值(cli 包内导出,非 npm 公共面)。
- `doctor` 段归因与远程 org 半层叠加(FX-B-15 · W1):`http.allowedAuthEnvVars` 三源(user / managed / remote org)逐键叠加,`doctor` 显示生效来源。

### 更新与分发(`tansr update` / SEA)

- **未签名产物缺省拒装**(FX-C-26 · W1):`unsignedPolicy:'reject'` 为唯一缺省;`--allow-unsigned` 须二次确认(确认卡五行 i18n);`assertTrustedUrl`
  三处(manifest / 产物 / 指针)。此前信任缺席时照装。
- **分发点改签名指针 `sea/latest.json`**(FX-C-27 · W1):`update` 缺省读 `release/<channel>/sea/latest.json`,先验 `latest.json.sig`(内置公钥表
  `release-trust.json` 单源,与 `publish-oss` 同文件)再取 `sea/<version>/<name>`;版本目录恒不同名覆盖,保留最近 6 版;旧扁平布局兼容一版
  (`install.sh / install.ps1` 仍读旧形,下一 minor 改读指针)。企业自托管仍可指 `manifest.json`。
- **npm tarball 与 SEA 随附 `NOTICE`**(FX-C-29 · W4):内联第三方 43 包(name@version · license · 许可全文)由真构建 metafile 生成;SEA
  `dist/release/NOTICE` + `manifest.notice`。`recipes/ci` 两份配方钉 `@tansr/cli@0.4.0` 与 action sha(FX-C-30 · W4,`sync-recipes` 写入,勿手改)。

### `serve` / `acp` / `mcp-serve` 宿主入口

- **`tansr serve --v2` / `TANSR_SERVE_V2=1` 显式挂 /v2 面**(FX-C-46 · W3):缺省关 = 行为零变;开时鉴权 = 同一 Bearer token + `x-tansr-end-user`
  自报分域(单运维方形),工厂 `cwdRebinder` 缺省接线,`cwdPolicy` 取启动 cwd 子树;/healthz 与 /readyz 恒开(FX-C-42 · W3)。/v2 面公共变更见
  `packages/server/CHANGELOG.md` 0.7.0。
- **acp `session/new | load` 的 cwd 经 kernel 同一闸**(FX-C-44 · W3;R-04):`createAcpConnection({ cwdPolicy?, closeTimeoutMs? })`,拒绝 → JSON-RPC
  `-32602 data:{ code:'cwd_unavailable', reason }`(四值与 serve /v2 409 逐字同);缺省 `ACP_DEFAULT_CWD_POLICY` 恒等(零回归);连接收口
  `allSettled(泵) → allSettled(会话收尾)` 有界 5 s(`ACP_CLOSE_TIMEOUT_MS`,`acp.close_timeout` 诊断)。`--allowed-roots` 入口旋钮归 W5。
- **四入口安装进程级兜底**(FX-C-02 · W1):`tansr serve` / tansrd 以 drain-exit 策略(`TANSR_SERVE_ON_UNHANDLED`),acp / mcp-serve / headless 以 log
  策略;未处理拒绝不再静默吞掉或裸崩。
- **cli bundle 拉取五处同锚携 `x-tansr-client-features`**(FX-B-28 · W1):`remoteBundleHeaders` 单函数 + 静态守卫;sdk 面 410 `session_archived` 终态。
- **serve 临界区 / 进程守卫 / 保留期 / 落卷失败帧 / TANSR_READY / webhook 双签**等 `@tansr/serve` 0.7.0 变更对 `tansr serve` 运维方同样生效,见
  `packages/server/CHANGELOG.md`;`SERVE_RUNTIME_ENV` 28 键由 `packages/server/README.md` 区段与 `.env.example` 生成(`pnpm env:example`)。

### 事件流与呈现

- `ErrorView.recoverable` 必填 + `SessionView.notices`(FX-B-29 · W2;R-05 / M-08):可恢复咨询帧(如 serve 落卷失败)归 `notices`(FIFO 20)
  不污染 `lastError`;narrator 两句。三端金样 `protocol/test/fixtures/golden/turn-error-{recoverable,fatal}.json`(C-β · W1)。
- 三端同名谓词 `isRenderableArtifact` + 四金样(FX-C-24 · W3):空串 / errorCode 在场 / errorCode null 三形三端同判。
- 控制帧 `ts` + 桥请求帧 `ttlMs`(FX-C-22 · W3):端侧按 `ttlMs` 优先判期;`expired_on_arrival` 不静默。

### 发布链与仓内门(操作者 / 贡献者)

- 统一发版门 `pnpm release:gate --package <cli|sdk|server>` 六步 + 三包 `prepublishOnly` 结构钩 + `doc/release/` 回执律(FX-C-25 · W2);
  `release.yml` 签名步去条件化(缺 `TANSR_RELEASE_SIGN_CMD` 即 fail)+ `exports:check`;`sea.yml` 签名步同律(FX-C-49 · W1)。
- `pnpm release:verify-notice --check`(三包 NOTICE 幂等 + 许可白名单)/ `release:depcheck`(声明 × 真 import,豁免表带 expires 只减)/
  `release:sync-recipes --check` 三门入 `release.yml` 与 `ci-full` supply-chain(FX-C-29 / FX-C-30 · W4);kernel 删 `shell-quote`(B-8)。
- 三级门 `pnpm gate`(lint · typecheck · test · i18n:gate · contract:check · env:check · docs:check)+ `ci.yml` PR / push 必跑 + `ci-full`
  (e2e 真组合 / supply-chain / freshness)(FX-C-41 · W2);`.gitattributes text=auto eol=lf` + `lint-text`(BOM / 孤立 CR / 混合行尾 / 无末行 LF 即红,
  基线只减)(FX-C-36 · W2);`scripts/test.mjs` 按 timings 装箱 + `test/quarantine.json` 只减门(FX-C-38 · W2);i18n 裸串白名单 JSON 化
  `scripts/i18n-allowlist.json` + 只减 + 到期 + ja / ko 阈值(FX-C-37 · W4)。
- sdk 契约 `contract/MANIFEST.json`(revision 3)+ `pnpm contract:manifest [--bump]` / `contract:check`;`error-codes.generated.ts` 由 vendored api openapi
  生成;providers 错误码登记面改读 vendored 全集(85 码)(C-β W1 / B-1 W3 · W4)。
- deploy/serve-v2 nginx / k8s `client_max_body_size 20m → 32m` 与 `contract.ts` 常量对表卷(FX-C-48 · W1)。

## 0.4.0 (2026-09-06;随 @tansr/sdk 0.11.0 / @tansr/serve 0.6.0 发版)

- 追溯登记(FX-C-25;当时未发回执,tag `v0.4.0` 在场):自 0.3.0(2026-09-01)以来——会话持久化一期二期、权限裁决姿态、裁决协议 v4 / v5 与应用协议、
  音频模态、媒体能力内核化、套餐 plan 端上、MCP 重连契约 v0.21–v0.24;examples electron-chat / token-server 补 license MIT(`sbom:verify` 断言 8 释放门禁)。
  详见 doc/49 回执与 doc/90 技术手册;本文件自 0.5.0 起逐版机器化。

## 0.3.0 (2026-09-01;随 @tansr/serve 0.2.0 发版)

- 追溯登记:S-TH1 思考双半场端侧 / S-V 呈现档与动态切换 / S-T2 媒体异步任务 / reminder A 案;serve 0.2.0 reminder 出流滤除;`@tansr/sdk` 0.7.0 不重发。

## 0.2.x (2026-08-23 … 2026-08-28)

- 0.2.3(08-28):fast 系动态供给(切模跟随)+ 记忆治理与缓存优化批量 + 重试可见性与爆炸半径遏制 + PS5.1 TUI 三修 + 上游计数虚报哨兵 + 幂等 409 自愈。
- 0.2.2(08-25):降档守卫 W_run 口径校准(记忆 / 压缩辅助面成本修正)。
- 0.2.1(08-23):版本 bump + doc/24 §10 发布记录(九关全绿 / 产物三件套哈希);0.2.0 未发布即被接替(tag 在案无消费者不补发)。
- 0.2.0(08-23):SEA 冒烟换锚 + doc/24 §9 发布记录。
