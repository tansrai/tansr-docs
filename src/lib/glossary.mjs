/**
 * 中英术语表(单一事实源):en 正文逐字用表;`scripts/gen/i18n-coverage.mjs` 把它渲染成覆盖率页的术语节;
 * `scripts/test/i18n.test.mjs` 以 `avoid` 变体扫 en 正文(出现即红),以 `en` 主形保证同词同译。
 * 只用 node 内建能力;不 import astro。
 *
 * 字段:zh(中文主形)· en(英文主形,正文逐字用)· avoid?(禁用的英文变体,整词、不分大小写)· note?(用法注)
 */

/** @type {readonly { zh: string, en: string, avoid?: readonly string[], note?: string }[]} */
export const GLOSSARY = Object.freeze([
  // 产品面 / 形态
  { zh: '智能体', en: 'agent' },
  { zh: '内核', en: 'kernel', note: '查询环 / 工具调度 / 权限引擎 / 上下文压缩所在的运行时' },
  { zh: '形态', en: 'form', note: '同一内核对外的五种形态:SDK · CLI · session service · Android · iOS', avoid: ['modality', 'form factor'] },
  { zh: '命令行', en: 'CLI', note: '包 `@tansr/cli`,命令 `tansr`;泛指时可写 the command line', avoid: ['commandline', 'command-line tool'] },
  { zh: '交互式终端', en: 'interactive terminal (TUI)' },
  { zh: '无头模式', en: 'headless mode' },
  { zh: '单文件可执行版', en: 'single-file executable (SEA)' },
  { zh: '会话服务', en: 'session service', note: '`@tansr/serve`;恒不写 server / gateway', avoid: ['session server', 'conversation service', 'agent server'] },
  { zh: '控制台', en: 'console', avoid: ['dashboard', 'control panel', 'admin panel'] },
  { zh: '平台网关', en: 'platform gateway', note: '`api.tansr.com`' },
  { zh: '门户', en: 'portal' },
  { zh: '开发者文档', en: 'developer docs' },
  { zh: '帮助中心', en: 'help center', avoid: ['support center', 'help desk'] },
  { zh: '资料站', en: 'docs site' },

  // 凭据
  { zh: '密钥', en: 'key', note: '泛指;具体形态见下四条', avoid: ['secret key'] },
  { zh: '个人访问令牌', en: 'personal access token (PAT)', avoid: ['personal token', 'private access token'] },
  { zh: '应用密钥', en: 'app key (appid / appkey)', note: '代表应用;只在服务端', avoid: ['application secret', 'app secret', 'API secret', 'application key'] },
  { zh: '终端令牌 / 短期 app_user 令牌', en: 'end-user token (`app_user` token)', avoid: ['terminal token', 'client token', 'device token'] },
  { zh: '派生键 / 本机派生应用键', en: 'derived key (device key)', avoid: ['derivative key', 'derivation key'] },
  { zh: '装置 id', en: 'device id' },
  { zh: '密钥库', en: 'OS keychain', note: 'macOS Keychain / Linux secret-service / Windows DPAPI', avoid: ['keystore', 'credential vault'] },
  { zh: '账号指纹', en: 'account fingerprint' },
  { zh: '摘要卡', en: 'summary card' },
  { zh: '掩码输入', en: 'masked input' },
  { zh: '三方闭环', en: 'three-party loop' },
  { zh: '换发 / 铸', en: 'mint', note: '服务端以 appkey 为终端用户换出短期令牌', avoid: ['issue a token'] },
  { zh: '吊销', en: 'revoke' },
  { zh: '轮换', en: 'rotate' },
  { zh: '会话污点', en: 'session taint' },

  // 模式 / 治理
  { zh: '平台模式', en: 'platform mode' },
  { zh: '逃生态 / 完全本地模式', en: 'escape hatch (fully local mode)', note: '`TANSR_ESCAPE_LOCAL=1`', avoid: ['escape state', 'escape mode'] },
  { zh: '套餐', en: 'plan', avoid: ['pricing package', 'subscription package', 'bundle plan'] },
  { zh: '档 / 档位', en: 'tier' },
  { zh: '并发', en: 'concurrency' },
  { zh: '硬帽', en: 'hard cap' },
  { zh: '准入帽', en: 'admission cap' },
  { zh: '宽限期', en: 'grace period' },
  { zh: '余额', en: 'balance' },
  { zh: '充值', en: 'top up' },
  { zh: '账单', en: 'bill' },
  { zh: '发票', en: 'invoice' },
  { zh: '用量', en: 'usage' },
  { zh: '牌价', en: 'list price' },
  { zh: '协议价', en: 'negotiated price' },
  { zh: '计费闸', en: 'billing gate' },
  { zh: '出网白名单', en: 'egress allowlist', avoid: ['egress whitelist', 'outbound whitelist', 'network whitelist'] },
  { zh: '出网', en: 'egress', avoid: ['outbound network access'] },
  { zh: '保留期', en: 'retention period' },
  { zh: '治理', en: 'governance' },
  { zh: '审计', en: 'audit' },

  // 会话 / 协议
  { zh: '会话', en: 'session' },
  { zh: '轮', en: 'turn' },
  { zh: '轮末', en: 'end of turn' },
  { zh: '事件流', en: 'event stream' },
  { zh: '检查点', en: 'checkpoint' },
  { zh: '恢复', en: 'resume', note: '动词与端点同词' },
  { zh: '三级恢复链', en: 'three-level recovery chain', note: 'L1 重连 / L2 重建 / L3 store resume' },
  { zh: '环形缓冲', en: 'ring buffer' },
  { zh: '心跳', en: 'heartbeat' },
  { zh: '控制帧', en: 'control frame' },
  { zh: '平台装配 / 装配', en: 'assembly', note: '装配期 = assembly time' },
  { zh: '配置束 / bundle', en: 'bundle' },
  { zh: '能力位', en: 'capability flags', avoid: ['capability bits', 'feature flags'] },
  { zh: '工具三环', en: 'three tool rings' },
  { zh: '裁决人', en: 'adjudicator' },
  { zh: '权限询问', en: 'permission prompt' },
  { zh: '提问', en: 'question', note: '智能体向人提问(ask user)' },
  { zh: '应答', en: 'response', note: '工具 / 权限 / 提问的上行回复' },
  { zh: '双桥', en: 'two bridges', note: '工具桥 + 对话框桥' },
  { zh: '视图归约', en: 'view reduction' },
  { zh: '上下文压缩', en: 'context compaction', avoid: ['context compression'] },
  { zh: '上下文方案', en: 'context scheme' },
  { zh: '钳位', en: 'clamp' },
  { zh: '剪枝', en: 'pruned' },
  { zh: '落盘', en: 'persisted to disk' },
  { zh: '冷层', en: 'cold tier' },
  { zh: '分片', en: 'sharding' },
  { zh: '优雅关闭', en: 'graceful shutdown' },
  { zh: '鉴权缝', en: 'authentication hook', note: '`authenticate` 回调', avoid: ['auth seam'] },
  { zh: '推送唤醒', en: 'push wake-up' },

  // 排障
  { zh: '排障', en: 'troubleshooting' },
  { zh: '阻断', en: 'blocking', note: 'doctor 退出码 1' },
  { zh: '归因', en: 'attribution' },
  { zh: '装配自检', en: 'assembly self-check', note: '`tansr doctor`' },
  { zh: '错误码', en: 'error code' },
  { zh: '可重试', en: 'retryable' },
  { zh: '退避', en: 'back off' },
  { zh: '脱敏', en: 'redact', avoid: ['desensitize', 'desensitise'] },
  { zh: '转录', en: 'transcript' },
  { zh: '工单', en: 'ticket' },
  { zh: '工单编号', en: 'ticket id' },
  { zh: '相关文章', en: 'related articles' },
  { zh: '本文是否有帮助', en: 'Was this page helpful?' },
  { zh: '即将随 … 提供', en: 'coming in …', note: '未发能力恒写 coming in <pkg> <version>', avoid: ['will be available soon'] },
]);

/** 整词、不分大小写地找 en 正文里的禁用变体;返回 [{ zh, en, variant, index }]。 */
export function findGlossaryViolations(text) {
  const out = [];
  for (const term of GLOSSARY) {
    for (const variant of term.avoid ?? []) {
      const re = new RegExp(`(^|[^A-Za-z0-9_-])${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) out.push({ zh: term.zh, en: term.en, variant, index: m.index + m[1].length });
    }
  }
  return out;
}

/** 去掉 Markdown 代码块 / 行内代码 / 链接目标后的正文(供禁用变体与 CJK 扫描)。 */
export function proseOnly(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/^import .*$/gm, '');
}

export const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
