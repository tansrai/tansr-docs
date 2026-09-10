/**
 * 资料站 → api 两端点(`POST /v1/docs/feedback` · `POST /v1/support/tickets`)的客户端纯函数:
 * 载荷成形 / 表单校验 / 蜜罐判 / 回退判 / mailto 回退链接。
 * 只在浏览器脚本(Feedback.astro / ContactForm.astro)与 node:test 卷里用;零依赖、零 IO、不读 import.meta.env
 * (基址由 src/lib/api-base.ts 注入)。契约以 api 端点契约为准,字段长度上限逐字同源。
 */

export const DEFAULT_API_BASE = 'https://api.tansr.com';
export const FEEDBACK_PATH = '/v1/docs/feedback';
export const TICKETS_PATH = '/v1/support/tickets';
export const SUPPORT_MAILBOX = 'support@tansr.com';

/** 端点契约里的上限(逐字) */
export const LIMITS = Object.freeze({ path: 200, subject: 120, body: 4000, email: 254, page: 200 });

/** `path` 形:`^/[a-z0-9\-/]*$`(端点契约逐字) */
export const PATH_PATTERN = /^\/[a-z0-9\-/]*$/;
/** 邮箱形校验(宽松:一处 @、两侧非空且无空白、域名含点);服务端另校 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * api 两端点 `locale` 字段接受的取值(与 api `DOCS_LOCALES` 同集,逐字)。
 * ja / ko 于 2026-09-11 随 api `fe7706e` 上产(DS-39)后加入;此前不加是为免 ja / ko 页向生产端点发契约外的值吃 400。
 * 再扩语言仍循同律:api 先上产、本常量后加项(normalizeLocale / 两载荷随之原样透传)。
 */
export const API_LOCALES = Object.freeze(/** @type {const} */ (['zh-CN', 'en', 'ja', 'ko']));
/** @typedef {typeof API_LOCALES[number]} ApiLocale */

/**
 * 归一 api 基址:空 / 非字符串 → 缺省;去尾斜杠;只收 http(s)。
 * @param {unknown} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeApiBase(raw, fallback = DEFAULT_API_BASE) {
  if (typeof raw !== 'string') return fallback;
  const s = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(s)) return fallback;
  return s;
}

/** @param {string} base */
export function feedbackUrl(base) {
  return `${normalizeApiBase(base)}${FEEDBACK_PATH}`;
}

/** @param {string} base */
export function ticketsUrl(base) {
  return `${normalizeApiBase(base)}${TICKETS_PATH}`;
}

/**
 * 语言归一:∈ `accepted`(缺省 API_LOCALES)原样;其余(含 undefined / `root` / 大小写不合 / api 未收的语言)→ `zh-CN`。
 * `accepted` 只作注入位(卷以此验证「集合窄于 / 宽于常量时归一随集合走」),组件恒走缺省。
 * @param {unknown} locale
 * @param {readonly string[]} [accepted]
 * @returns {ApiLocale}
 */
export function normalizeLocale(locale, accepted = API_LOCALES) {
  return typeof locale === 'string' && accepted.includes(locale) ? /** @type {ApiLocale} */ (locale) : 'zh-CN';
}

/**
 * 反馈载荷:`{ path, helpful, locale }`;path 不合形 / 超长 → null(调用方直接走回退,不发请求)。
 * @param {{ pathname: unknown, value: unknown, locale?: unknown }} input  value = 'yes' | 'no'(按钮 data 值)
 * @returns {{ path: string, helpful: boolean, locale: ApiLocale } | null}
 */
export function feedbackPayload({ pathname, value, locale }) {
  if (typeof pathname !== 'string' || pathname.length > LIMITS.path || !PATH_PATTERN.test(pathname)) return null;
  if (value !== 'yes' && value !== 'no') return null;
  return { path: pathname, helpful: value === 'yes', locale: normalizeLocale(locale) };
}

/**
 * 蜜罐判:隐藏字段 `website` 非空(去首尾空白后)即机器人。
 * @param {unknown} website
 */
export function isHoneypotTripped(website) {
  return typeof website === 'string' && website.trim() !== '';
}

/**
 * 表单校验(客户端;服务端另校)。返回 `{ ok, errors }`,errors 键 ∈ subject / body / email,值为错误码:
 * `required` / `too-long` / `invalid`。
 * @param {{ subject?: unknown, body?: unknown, email?: unknown }} fields
 */
export function validateTicket(fields) {
  /** @type {Record<string, 'required' | 'too-long' | 'invalid'>} */
  const errors = {};
  const subject = typeof fields.subject === 'string' ? fields.subject.trim() : '';
  const body = typeof fields.body === 'string' ? fields.body.trim() : '';
  const email = typeof fields.email === 'string' ? fields.email.trim() : '';
  if (subject === '') errors.subject = 'required';
  else if (subject.length > LIMITS.subject) errors.subject = 'too-long';
  if (body === '') errors.body = 'required';
  else if (body.length > LIMITS.body) errors.body = 'too-long';
  if (email !== '') {
    if (email.length > LIMITS.email) errors.email = 'too-long';
    else if (!EMAIL_PATTERN.test(email)) errors.email = 'invalid';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * 工单载荷:`{ subject, body, email?, page?, locale }`;可选项为空即省略(不发空串);`website` 恒不进载荷
 * (蜜罐由 isHoneypotTripped 在发送前裁决)。校验不过 → null。
 * @param {{ subject?: unknown, body?: unknown, email?: unknown, page?: unknown, locale?: unknown }} fields
 */
export function ticketPayload(fields) {
  const v = validateTicket(fields);
  if (!v.ok) return null;
  /** @type {{ subject: string, body: string, email?: string, page?: string, locale: ApiLocale }} */
  const out = {
    subject: /** @type {string} */ (fields.subject).trim(),
    body: /** @type {string} */ (fields.body).trim(),
    locale: normalizeLocale(fields.locale),
  };
  const email = typeof fields.email === 'string' ? fields.email.trim() : '';
  if (email !== '') out.email = email;
  if (typeof fields.page === 'string' && fields.page !== '' && fields.page.length <= LIMITS.page) out.page = fields.page;
  return out;
}

/**
 * 回退判:非 2xx(含 400 / 429 / 503)或无响应(网络错 / 超时 → 传 null)一律回退;2xx 不回退。
 * @param {{ ok?: boolean, status?: number } | null | undefined} response
 */
export function shouldFallback(response) {
  if (!response || typeof response.status !== 'number') return true;
  return !(response.status >= 200 && response.status < 300);
}

/**
 * 解析工单成功响应体:`{ ok: true, ticketId: 'tk_<ulid>' }` → ticketId;形不符 → null(成功态仍显示,只是无编号)。
 * @param {unknown} json
 */
export function ticketIdOf(json) {
  if (!json || typeof json !== 'object') return null;
  const id = /** @type {{ ticketId?: unknown }} */ (json).ticketId;
  return typeof id === 'string' && /^tk_[0-9A-Za-z]{1,64}$/.test(id) ? id : null;
}

/**
 * 失败态文案码:429 → `rate-limited`(稍后再试);其余(含网络错)→ `unavailable`。
 * @param {{ status?: number } | null | undefined} response
 * @returns {'rate-limited' | 'unavailable'}
 */
export function failureKind(response) {
  return response && response.status === 429 ? 'rate-limited' : 'unavailable';
}

/**
 * mailto 回退链接:主题原样、正文截断到 maxBody 字符(mailto 长度受客户端限制),都做 URL 编码。
 * @param {{ subject?: string, body?: string, maxBody?: number, mailbox?: string }} input
 */
export function mailtoFallback({ subject = '', body = '', maxBody = 1500, mailbox = SUPPORT_MAILBOX } = {}) {
  const params = [];
  const s = subject.trim();
  const b = body.trim().slice(0, maxBody);
  if (s !== '') params.push(`subject=${encodeURIComponent(s)}`);
  if (b !== '') params.push(`body=${encodeURIComponent(b)}`);
  return `mailto:${mailbox}${params.length ? `?${params.join('&')}` : ''}`;
}
