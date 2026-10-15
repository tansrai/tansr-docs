/**
 * 多语言术语表(单一事实源):en / ja / ko 正文逐字用表;`scripts/gen/i18n-coverage.mjs` 把它渲染成覆盖率页的术语节;
 * `scripts/test/i18n.test.mjs` 以 `avoid` 变体扫 en 正文(出现即红),以 `en` 主形保证同词同译,并核每条 ja / ko 齐备。
 * 只用 node 内建能力;不 import astro。
 *
 * 字段:zh(中文主形)· en(英文主形,正文逐字用)· ja(日文主形)· ko(韩文主形)· avoid?(禁用的英文变体,整词、不分大小写)· note?(用法注)
 * ja / ko 与 en 同形者(如 CLI · Android SDK)也写明,不留空。
 */

/** @type {readonly { zh: string, en: string, ja: string, ko: string, avoid?: readonly string[], note?: string }[]} */
export const GLOSSARY = Object.freeze([
  // 产品面 / 形态
  { zh: '智能体', en: 'agent', ja: 'エージェント', ko: '에이전트' },
  { zh: '内核', en: 'kernel', ja: 'カーネル', ko: '커널', note: '查询环 / 工具调度 / 权限引擎 / 上下文压缩所在的运行时' },
  { zh: '形态', en: 'form', ja: '形態', ko: '형태', note: '同一内核对外的六种形态:SDK · CLI · session service · Android · iOS · HarmonyOS', avoid: ['modality', 'form factor'] },
  { zh: '命令行', en: 'CLI', ja: 'CLI', ko: 'CLI', note: '包 `@tansr/cli`,命令 `tansr`;泛指时可写 the command line', avoid: ['commandline', 'command-line tool'] },
  { zh: '交互式终端', en: 'interactive terminal (TUI)', ja: '対話型ターミナル（TUI）', ko: '대화형 터미널(TUI)' },
  { zh: '无头模式', en: 'headless mode', ja: 'ヘッドレスモード', ko: '헤드리스 모드' },
  { zh: '单文件可执行版', en: 'single-file executable (SEA)', ja: '単一ファイル実行版（SEA）', ko: '단일 파일 실행 파일(SEA)' },
  { zh: '会话服务', en: 'session service', ja: 'セッションサービス', ko: '세션 서비스', note: '`@tansr/serve`;恒不写 server / gateway', avoid: ['session server', 'conversation service', 'agent server'] },
  { zh: '控制台', en: 'console', ja: 'コンソール', ko: '콘솔', avoid: ['dashboard', 'control panel', 'admin panel'] },
  { zh: '平台网关', en: 'platform gateway', ja: 'プラットフォームゲートウェイ', ko: '플랫폼 게이트웨이', note: '`api.tansr.com`' },
  { zh: '门户', en: 'portal', ja: 'ポータル', ko: '포털' },
  { zh: '开发者文档', en: 'developer docs', ja: '開発者ドキュメント', ko: '개발자 문서' },
  { zh: '帮助中心', en: 'help center', ja: 'ヘルプセンター', ko: '도움말 센터', avoid: ['support center', 'help desk'] },
  { zh: '资料站', en: 'docs site', ja: 'ドキュメントサイト', ko: '문서 사이트' },
  { zh: '鸿蒙 SDK', en: 'HarmonyOS SDK', ja: 'HarmonyOS SDK', ko: 'HarmonyOS SDK', note: '原生 ArkTS HAR `@tansr/harmony`;独立发布版本化字节码 HAR 0.2.0(2026-10-10),尚未上架 OHPM;0.1.0 仍走旧前缀;兼容 Android 的旧鸿蒙设备继续用 Android SDK', avoid: ['Harmony SDK', 'OpenHarmony SDK'] },

  // 凭据
  { zh: '密钥', en: 'key', ja: 'キー', ko: '키', note: '泛指;具体形态见下四条', avoid: ['secret key'] },
  { zh: '个人访问令牌', en: 'personal access token (PAT)', ja: '個人アクセストークン（PAT）', ko: '개인 액세스 토큰(PAT)', avoid: ['personal token', 'private access token'] },
  { zh: '应用密钥', en: 'app key (appid / appkey)', ja: 'アプリキー（appid / appkey）', ko: '앱 키(appid / appkey)', note: '代表应用;只在服务端', avoid: ['application secret', 'app secret', 'API secret', 'application key'] },
  { zh: '终端令牌 / 短期 app_user 令牌', en: 'end-user token (`app_user` token)', ja: 'エンドユーザートークン（`app_user` トークン）', ko: '최종 사용자 토큰(`app_user` 토큰)', avoid: ['terminal token', 'client token', 'device token'] },
  { zh: '派生键 / 本机派生应用键', en: 'derived key (device key)', ja: '派生キー（デバイスキー）', ko: '파생 키(디바이스 키)', avoid: ['derivative key', 'derivation key'] },
  { zh: '装置 id', en: 'device id', ja: 'デバイス ID', ko: '디바이스 ID' },
  { zh: '密钥库', en: 'OS keychain', ja: 'OS キーチェーン', ko: 'OS 키체인', note: 'macOS Keychain / Linux secret-service / Windows DPAPI', avoid: ['keystore', 'credential vault'] },
  { zh: '账号指纹', en: 'account fingerprint', ja: 'アカウント指紋', ko: '계정 지문' },
  { zh: '摘要卡', en: 'summary card', ja: 'サマリーカード', ko: '요약 카드' },
  { zh: '掩码输入', en: 'masked input', ja: 'マスク入力', ko: '마스킹 입력' },
  { zh: '三方闭环', en: 'three-party loop', ja: '三者クローズドループ', ko: '3자 폐쇄 루프' },
  { zh: '换发 / 铸', en: 'mint', ja: '発行（ミント）', ko: '발급(민트)', note: '服务端以 appkey 为终端用户换出短期令牌', avoid: ['issue a token'] },
  { zh: '吊销', en: 'revoke', ja: '失効', ko: '폐기' },
  { zh: '轮换', en: 'rotate', ja: 'ローテーション', ko: '교체' },
  { zh: '会话污点', en: 'session taint', ja: 'セッション汚染', ko: '세션 오염' },

  // 模式 / 治理
  { zh: '平台模式', en: 'platform mode', ja: 'プラットフォームモード', ko: '플랫폼 모드' },
  { zh: '逃生态 / 完全本地模式', en: 'escape hatch (fully local mode)', ja: 'エスケープハッチ（完全ローカルモード）', ko: '이스케이프 해치(완전 로컬 모드)', note: '`TANSR_ESCAPE_LOCAL=1`', avoid: ['escape state', 'escape mode'] },
  { zh: '套餐', en: 'plan', ja: 'プラン', ko: '플랜', avoid: ['pricing package', 'subscription package', 'bundle plan'] },
  { zh: '档 / 档位', en: 'tier', ja: 'ティア', ko: '등급' },
  { zh: '并发', en: 'concurrency', ja: '同時実行数', ko: '동시 실행 수' },
  { zh: '硬帽', en: 'hard cap', ja: 'ハードキャップ', ko: '하드 캡' },
  { zh: '准入帽', en: 'admission cap', ja: '受け入れ上限', ko: '허용 상한' },
  { zh: '宽限期', en: 'grace period', ja: '猶予期間', ko: '유예 기간' },
  { zh: '余额', en: 'balance', ja: '残高', ko: '잔액' },
  { zh: '充值', en: 'top up', ja: 'チャージ', ko: '충전' },
  { zh: '账单', en: 'bill', ja: '請求書', ko: '청구서' },
  { zh: '发票', en: 'invoice', ja: 'インボイス', ko: '인보이스' },
  { zh: '用量', en: 'usage', ja: '使用量', ko: '사용량' },
  { zh: '牌价', en: 'list price', ja: '定価', ko: '정가' },
  { zh: '协议价', en: 'negotiated price', ja: '契約価格', ko: '협의 가격' },
  { zh: '计费闸', en: 'billing gate', ja: '課金ゲート', ko: '과금 게이트' },
  { zh: '出网白名单', en: 'egress allowlist', ja: '外向き通信の許可リスト', ko: '아웃바운드 허용 목록', avoid: ['egress whitelist', 'outbound whitelist', 'network whitelist'] },
  { zh: '出网', en: 'egress', ja: '外向き通信', ko: '아웃바운드 통신', avoid: ['outbound network access'] },
  { zh: '保留期', en: 'retention period', ja: '保持期間', ko: '보존 기간' },
  { zh: '治理', en: 'governance', ja: 'ガバナンス', ko: '거버넌스' },
  { zh: '审计', en: 'audit', ja: '監査', ko: '감사' },

  // 会话 / 协议
  { zh: '会话', en: 'session', ja: 'セッション', ko: '세션' },
  { zh: '轮', en: 'turn', ja: 'ターン', ko: '턴' },
  { zh: '轮末', en: 'end of turn', ja: 'ターン終了', ko: '턴 종료' },
  { zh: '事件流', en: 'event stream', ja: 'イベントストリーム', ko: '이벤트 스트림' },
  { zh: '检查点', en: 'checkpoint', ja: 'チェックポイント', ko: '체크포인트' },
  { zh: '恢复', en: 'resume', ja: '再開（resume）', ko: '재개(resume)', note: '动词与端点同词' },
  { zh: '三级恢复链', en: 'three-level recovery chain', ja: '3 段階の復旧チェーン', ko: '3단계 복구 체인', note: 'L1 重连 / L2 重建 / L3 store resume' },
  { zh: '环形缓冲', en: 'ring buffer', ja: 'リングバッファ', ko: '링 버퍼' },
  { zh: '心跳', en: 'heartbeat', ja: 'ハートビート', ko: '하트비트' },
  { zh: '控制帧', en: 'control frame', ja: '制御フレーム', ko: '제어 프레임' },
  { zh: '平台装配 / 装配', en: 'assembly', ja: 'アセンブリ', ko: '어셈블리', note: '装配期 = assembly time' },
  { zh: '配置束 / bundle', en: 'bundle', ja: 'バンドル', ko: '번들' },
  { zh: '能力位', en: 'capability flags', ja: '機能フラグ', ko: '기능 플래그', avoid: ['capability bits', 'feature flags'] },
  { zh: '工具三环', en: 'three tool rings', ja: 'ツールの 3 リング', ko: '도구 3링' },
  { zh: '裁决人', en: 'adjudicator', ja: '裁定者', ko: '판정자' },
  { zh: '权限询问', en: 'permission prompt', ja: '権限確認', ko: '권한 확인' },
  { zh: '提问', en: 'question', ja: '質問', ko: '질문', note: '智能体向人提问(ask user)' },
  { zh: '应答', en: 'response', ja: '応答', ko: '응답', note: '工具 / 权限 / 提问的上行回复' },
  { zh: '双桥', en: 'two bridges', ja: '2 つのブリッジ', ko: '두 브리지', note: '工具桥 + 对话框桥' },
  { zh: '视图归约', en: 'view reduction', ja: 'ビュー還元', ko: '뷰 리덕션' },
  { zh: '上下文压缩', en: 'context compaction', ja: 'コンテキスト圧縮', ko: '컨텍스트 압축', avoid: ['context compression'] },
  { zh: '上下文方案', en: 'context scheme', ja: 'コンテキストスキーム', ko: '컨텍스트 스킴' },
  { zh: '钳位', en: 'clamp', ja: 'クランプ', ko: '클램프' },
  { zh: '剪枝', en: 'pruned', ja: '枝刈り', ko: '프루닝' },
  { zh: '落盘', en: 'persisted to disk', ja: 'ディスクへ永続化', ko: '디스크에 영구 저장' },
  { zh: '冷层', en: 'cold tier', ja: 'コールド層', ko: '콜드 계층' },
  { zh: '分片', en: 'sharding', ja: 'シャーディング', ko: '샤딩' },
  { zh: '优雅关闭', en: 'graceful shutdown', ja: 'グレースフルシャットダウン', ko: '정상 종료(graceful shutdown)' },
  { zh: '鉴权缝', en: 'authentication hook', ja: '認証フック', ko: '인증 훅', note: '`authenticate` 回调', avoid: ['auth seam'] },
  { zh: '推送唤醒', en: 'push wake-up', ja: 'プッシュ起動', ko: '푸시 웨이크업' },

  // 排障
  { zh: '排障', en: 'troubleshooting', ja: 'トラブルシューティング', ko: '문제 해결' },
  { zh: '阻断', en: 'blocking', ja: 'ブロッキング', ko: '차단', note: 'doctor 退出码 1' },
  { zh: '归因', en: 'attribution', ja: '帰属', ko: '귀속' },
  { zh: '装配自检', en: 'assembly self-check', ja: 'アセンブリ自己診断', ko: '어셈블리 자가 점검', note: '`tansr doctor`' },
  { zh: '错误码', en: 'error code', ja: 'エラーコード', ko: '오류 코드' },
  { zh: '可重试', en: 'retryable', ja: '再試行可能', ko: '재시도 가능' },
  { zh: '退避', en: 'back off', ja: 'バックオフ', ko: '백오프' },
  { zh: '脱敏', en: 'redact', ja: 'マスキング', ko: '마스킹', avoid: ['desensitize', 'desensitise'] },
  { zh: '转录', en: 'transcript', ja: 'トランスクリプト', ko: '트랜스크립트' },
  { zh: '工单', en: 'ticket', ja: 'チケット', ko: '티켓' },
  { zh: '工单编号', en: 'ticket id', ja: 'チケット ID', ko: '티켓 ID' },
  { zh: '相关文章', en: 'related articles', ja: '関連記事', ko: '관련 문서' },
  { zh: '本文是否有帮助', en: 'Was this page helpful?', ja: 'このページは役に立ちましたか？', ko: '이 페이지가 도움이 되었나요?' },
  { zh: '即将随 … 提供', en: 'coming in …', ja: '… で提供予定', ko: '…에서 제공 예정', note: '未发能力恒写 coming in <pkg> <version>', avoid: ['will be available soon'] },
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
    .replace(/<[^>\n]*>/g, '')
    .replace(/^import .*$/gm, '');
}

export const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
