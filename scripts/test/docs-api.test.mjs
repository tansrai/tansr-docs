/**
 * DS-28 卷:反馈 / 联系表单接 api 的客户端纯函数(src/lib/docs-api.mjs)与两组件的静态形。
 * 纯函数:载荷形 / 蜜罐判 / 回退判 / 校验 / mailto 回退;组件:走 api-base、零第三方脚本、蜜罐字段在场。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import {
  DEFAULT_API_BASE,
  FEEDBACK_PATH,
  LIMITS,
  TICKETS_PATH,
  failureKind,
  feedbackPayload,
  feedbackUrl,
  isHoneypotTripped,
  mailtoFallback,
  normalizeApiBase,
  normalizeLocale,
  shouldFallback,
  ticketIdOf,
  ticketPayload,
  ticketsUrl,
  validateTicket,
} from '../../src/lib/docs-api.mjs';

const root = repoRootFrom(import.meta.url);

test('api 基址:缺省 / 去尾斜杠 / 非 http(s) 回缺省;两端点 URL 逐字', () => {
  assert.equal(normalizeApiBase(undefined), DEFAULT_API_BASE);
  assert.equal(normalizeApiBase(''), DEFAULT_API_BASE);
  assert.equal(normalizeApiBase('https://api.tansr.com/'), 'https://api.tansr.com');
  assert.equal(normalizeApiBase('http://127.0.0.1:8787///'), 'http://127.0.0.1:8787');
  assert.equal(normalizeApiBase('ftp://x'), DEFAULT_API_BASE);
  assert.equal(normalizeApiBase('javascript:alert(1)'), DEFAULT_API_BASE);
  assert.equal(feedbackUrl('https://api.tansr.com/'), `https://api.tansr.com${FEEDBACK_PATH}`);
  assert.equal(ticketsUrl(undefined), `${DEFAULT_API_BASE}${TICKETS_PATH}`);
  assert.equal(FEEDBACK_PATH, '/v1/docs/feedback');
  assert.equal(TICKETS_PATH, '/v1/support/tickets');
});

test('反馈载荷形:{ path, helpful, locale };path 不合契约形 / 超 200 / 非 yes|no → null', () => {
  assert.deepEqual(feedbackPayload({ pathname: '/errors/codes/', value: 'yes', locale: undefined }), {
    path: '/errors/codes/',
    helpful: true,
    locale: 'zh-CN',
  });
  assert.deepEqual(feedbackPayload({ pathname: '/en/support/contact/', value: 'no', locale: 'en' }), {
    path: '/en/support/contact/',
    helpful: false,
    locale: 'en',
  });
  assert.equal(feedbackPayload({ pathname: '/Errors/Codes/', value: 'yes' }), null, '大写不合形');
  assert.equal(feedbackPayload({ pathname: '/a?b=1', value: 'yes' }), null, '查询串不合形');
  assert.equal(feedbackPayload({ pathname: 'errors/codes/', value: 'yes' }), null, '须以 / 起头');
  assert.equal(feedbackPayload({ pathname: '/' + 'a'.repeat(LIMITS.path), value: 'yes' }), null, '> 200');
  assert.equal(feedbackPayload({ pathname: '/x/', value: 'maybe' }), null);
  assert.equal(normalizeLocale('zh-CN'), 'zh-CN');
  assert.equal(normalizeLocale('root'), 'zh-CN');
  assert.equal(normalizeLocale('en'), 'en');
});

test('蜜罐判:website 非空(去空白)即机器人;空 / 空白 / 非字符串不算', () => {
  assert.equal(isHoneypotTripped('http://spam.example'), true);
  assert.equal(isHoneypotTripped('  x '), true);
  assert.equal(isHoneypotTripped(''), false);
  assert.equal(isHoneypotTripped('   '), false);
  assert.equal(isHoneypotTripped(undefined), false);
  assert.equal(isHoneypotTripped(null), false);
});

test('工单校验与载荷:必填 / 上限 120 · 4000 · 254 / 邮箱形;可选项空即省略;website 恒不进载荷', () => {
  assert.deepEqual(validateTicket({ subject: '', body: '' }), { ok: false, errors: { subject: 'required', body: 'required' } });
  assert.deepEqual(validateTicket({ subject: 'a'.repeat(121), body: 'b' }).errors, { subject: 'too-long' });
  assert.deepEqual(validateTicket({ subject: 's', body: 'b'.repeat(4001) }).errors, { body: 'too-long' });
  assert.deepEqual(validateTicket({ subject: 's', body: 'b', email: 'not-an-email' }).errors, { email: 'invalid' });
  assert.deepEqual(validateTicket({ subject: 's', body: 'b', email: `${'a'.repeat(250)}@x.io` }).errors, { email: 'too-long' });
  assert.equal(validateTicket({ subject: 's', body: 'b', email: '' }).ok, true);

  assert.deepEqual(
    ticketPayload({ subject: ' [CLI] tansr init 提示 PAT 无效 ', body: ' 复现步骤… ', email: '', page: '/support/contact/', locale: 'zh-CN', website: '' }),
    { subject: '[CLI] tansr init 提示 PAT 无效', body: '复现步骤…', locale: 'zh-CN', page: '/support/contact/' },
  );
  const withEmail = ticketPayload({ subject: 's', body: 'b', email: 'me@example.com', locale: 'en' });
  assert.deepEqual(withEmail, { subject: 's', body: 'b', locale: 'en', email: 'me@example.com' });
  assert.equal('website' in ticketPayload({ subject: 's', body: 'b', website: 'bot' }), false);
  assert.equal(ticketPayload({ subject: '', body: 'b' }), null);
  assert.equal('page' in ticketPayload({ subject: 's', body: 'b', page: '/' + 'p'.repeat(LIMITS.page) }), false, '超长 page 省略');
});

test('回退判:2xx 不回退;400 / 429 / 503 / 网络错(null)回退;失败态 429 → rate-limited,其余 unavailable', () => {
  assert.equal(shouldFallback({ ok: true, status: 202 }), false);
  assert.equal(shouldFallback({ ok: true, status: 200 }), false);
  assert.equal(shouldFallback({ ok: false, status: 400 }), true);
  assert.equal(shouldFallback({ ok: false, status: 429 }), true);
  assert.equal(shouldFallback({ ok: false, status: 503 }), true);
  assert.equal(shouldFallback(null), true);
  assert.equal(shouldFallback(undefined), true);
  assert.equal(failureKind({ status: 429 }), 'rate-limited');
  assert.equal(failureKind({ status: 503 }), 'unavailable');
  assert.equal(failureKind(null), 'unavailable');
});

test('成功响应解析 ticketId 形 tk_<ulid>;mailto 回退带编码主题 / 截断正文', () => {
  assert.equal(ticketIdOf({ ok: true, ticketId: 'tk_01J8Z1X2Y3Z4W5V6U7T8S9R0QP' }), 'tk_01J8Z1X2Y3Z4W5V6U7T8S9R0QP');
  assert.equal(ticketIdOf({ ok: true }), null);
  assert.equal(ticketIdOf({ ticketId: 'evil<script>' }), null);
  assert.equal(ticketIdOf('tk_x'), null);
  assert.equal(mailtoFallback(), 'mailto:support@tansr.com');
  assert.equal(
    mailtoFallback({ subject: '[CLI] 初始化失败', body: 'a b&c' }),
    `mailto:support@tansr.com?subject=${encodeURIComponent('[CLI] 初始化失败')}&body=${encodeURIComponent('a b&c')}`,
  );
  const long = mailtoFallback({ subject: 's', body: 'x'.repeat(5000), maxBody: 100 });
  assert.ok(long.endsWith(`body=${'x'.repeat(100)}`));
});

test('组件静态形:Feedback / ContactForm 走 api-base + 两端点常量、蜜罐 website 在场、零第三方脚本;contact 为 .mdx 挂组件', () => {
  const feedback = readFileSync(join(root, 'src/components/Feedback.astro'), 'utf8');
  const contact = readFileSync(join(root, 'src/components/ContactForm.astro'), 'utf8');
  for (const [name, src] of [['Feedback', feedback], ['ContactForm', contact]]) {
    assert.match(src, /from '\.\.\/lib\/api-base'/, `${name} 须 import API_BASE`);
    assert.match(src, /fetch\(/, `${name} 须发 fetch`);
    assert.doesNotMatch(src, /<script[^>]*\ssrc=/, `${name} 零第三方脚本`);
    assert.doesNotMatch(src, /https?:\/\/(?!api\.tansr\.com)[a-z0-9.-]+\.[a-z]{2,}\/[^\s'"]*\.js/i, `${name} 不引外部 js`);
  }
  assert.match(feedback, /feedbackUrl|FEEDBACK_PATH/);
  assert.match(contact, /ticketsUrl|TICKETS_PATH/);
  assert.match(contact, /name="website"/, '蜜罐字段 website');
  assert.match(contact, /autocomplete="off"/);
  assert.match(contact, /isHoneypotTripped/);
  assert.match(contact, /mailtoFallback/);
  assert.ok(existsSync(join(root, 'src/content/docs/support/contact.mdx')), 'support/contact 须为 .mdx');
  assert.ok(!existsSync(join(root, 'src/content/docs/support/contact.md')), '旧 .md 须移除(同 slug 冲突)');
  assert.match(readFileSync(join(root, 'src/content/docs/support/contact.mdx'), 'utf8'), /<ContactForm\s*\/>/);
  assert.match(readFileSync(join(root, '.env.example'), 'utf8'), /^PUBLIC_TANSR_API_BASE=https:\/\/api\.tansr\.com$/m);
});
