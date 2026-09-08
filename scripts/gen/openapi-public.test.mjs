import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootFrom } from '../lib/text.mjs';
import { danglingRefs, filterPublic, generate, OUT_REL, PUBLIC_TITLE, sanitizeMarkdownText } from './openapi-public.mjs';

const root = repoRootFrom(import.meta.url);

test('openapi-public:描述 Markdown 安全化——`[](…)` 空链接形转义(收编 links 门实证:context-selection selected 描述「无档回 [](未配置=空集)」曾成死链),其余文本不动;公开副本零残留', () => {
  assert.equal(sanitizeMarkdownText('恒数组,无档回 [](未配置=空集);原样回读'), '恒数组,无档回 []\\(未配置=空集);原样回读');
  assert.equal(sanitizeMarkdownText('正常 [链接](https://example.com) 与 [] 单独'), '正常 [链接](https://example.com) 与 [] 单独');
  const { doc } = filterPublic(source);
  assert.equal(JSON.stringify(doc).includes('[](未配置'), false, '公开副本内不得残留 [](… 形');
});
const script = fileURLToPath(new URL('./openapi-public.mjs', import.meta.url));
const source = JSON.parse(readFileSync(join(root, 'contract', 'openapi.json'), 'utf8'));
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

function opsOf(doc) {
  return Object.entries(doc.paths).flatMap(([p, item]) => Object.entries(item).filter(([m]) => METHODS.has(m)).map(([m, op]) => ({ p, m, op })));
}

test('openapi-public:OPTIONS 预检不出公开面(资料站 P2 A-L1:/v1/docs/feedback · /v1/support/tickets 的 CORS 预检在源契约在册,公开副本只留 POST);只剩预检的路径整条不出', () => {
  const src = {
    openapi: '3.1.0',
    info: { title: 't' },
    paths: {
      '/v1/docs/feedback': { post: { tags: ['control'], responses: {} }, options: { tags: ['control'], responses: {} } },
      '/v1/only-preflight': { options: { tags: ['control'], responses: {} } },
    },
  };
  const { doc, stats } = filterPublic(src);
  assert.deepEqual(Object.keys(doc.paths['/v1/docs/feedback']), ['post']);
  assert.equal(doc.paths['/v1/only-preflight'], undefined);
  assert.equal(stats.droppedByMethod, 2);
  // 真契约:两公开端点的 OPTIONS 在源里在册、公开副本里不在
  const { doc: real } = filterPublic(source);
  for (const p of ['/v1/docs/feedback', '/v1/support/tickets']) {
    if (!source.paths[p]) continue;
    assert.equal(real.paths[p]?.options, undefined, `${p} 预检不得出公开面`);
    assert.ok(real.paths[p]?.post, `${p} POST 须在公开面`);
  }
});

test('openapi-public:锁卷 —— /admin 0 · /webhooks 0 · /metrics 0;全部路径落在白名单前缀', () => {
  const { doc } = filterPublic(source);
  const paths = Object.keys(doc.paths);
  assert.equal(paths.filter((p) => p.startsWith('/admin')).length, 0);
  assert.equal(paths.filter((p) => p.startsWith('/webhooks')).length, 0);
  assert.equal(paths.filter((p) => p.startsWith('/metrics')).length, 0);
  for (const p of paths) assert.ok(/^\/(v1|t1)(\/|$)|^\/(healthz|readyz)$/.test(p), p);
  assert.ok(paths.includes('/healthz') && paths.includes('/readyz'), '健康探针点名保留');
});

test('openapi-public:公开操作零黑名单 tag(探针除外);操作级 x-tansr-* 全去;顶层只留 error-codes / enums 扩展', () => {
  const { doc } = filterPublic(source);
  for (const { p, op } of opsOf(doc)) {
    for (const k of Object.keys(op)) assert.ok(!k.startsWith('x-tansr-'), `${p} 残留 ${k}`);
    if (p === '/healthz' || p === '/readyz') continue;
    for (const t of op.tags ?? []) assert.ok(!['admin', 'ops', 'webhooks'].includes(t), `${p} tag ${t}`);
  }
  const topX = Object.keys(doc).filter((k) => k.startsWith('x-'));
  assert.deepEqual(topX.sort(), ['x-tansr-enums', 'x-tansr-error-codes']);
  assert.ok(!('x-tansr-flags' in doc));
  assert.deepEqual(doc['x-tansr-enums'], source['x-tansr-enums']);
});

test('openapi-public:$ref 全部可解析;components 只含可达 schema(不可达已删)', () => {
  const { doc } = filterPublic(source);
  assert.deepEqual(danglingRefs(doc), []);
  const referenced = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (k === '$ref' ? referenced.add(x.split('/').pop()) : walk(x));
  };
  walk(doc.paths);
  walk(doc.components.schemas);
  for (const name of Object.keys(doc.components.schemas)) assert.ok(referenced.has(name), `${name} 不可达却保留`);
  assert.ok(Object.keys(doc.components.schemas).length < Object.keys(source.components.schemas).length, '应有裁剪');
  const usedSecurity = new Set(opsOf(doc).flatMap(({ op }) => (op.security ?? []).flatMap((s) => Object.keys(s))));
  assert.deepEqual(Object.keys(doc.components.securitySchemes).sort(), [...usedSecurity].sort(), 'securitySchemes = 公开操作实际引用集');
});

test('openapi-public:error-codes 子集 = 被公开操作说明引用的码;info.title 改公开面;servers 无本机地址', () => {
  const { doc } = filterPublic(source);
  const codes = doc['x-tansr-error-codes'].map((e) => e.code);
  assert.ok(codes.length > 0 && codes.length < source['x-tansr-error-codes'].length);
  assert.ok(codes.includes('rate_limited'));
  assert.ok(!codes.includes('admin_key_invalid') || opsOf(doc).some(({ op }) => JSON.stringify(op).includes('admin_key_invalid')));
  assert.equal(doc.info.title, PUBLIC_TITLE);
  for (const s of doc.servers) assert.ok(!/localhost|127\.0\.0\.1/.test(s.url), s.url);
  assert.deepEqual(doc.tags.map((t) => t.name).sort(), [...new Set(opsOf(doc).flatMap(({ op }) => op.tags ?? []))].sort());
});

test('openapi-public:计数登记(路径 / 操作)与源一致的过滤结果', () => {
  const { stats } = filterPublic(source);
  assert.equal(stats.paths + stats.droppedByPrefix + stats.droppedByTag, Object.keys(source.paths).length);
  assert.ok(stats.paths >= 100 && stats.operations >= stats.paths, JSON.stringify(stats));
});

test('openapi-public:在库 contract/openapi.public.json 存在且再生零 diff(--check exit 0)', () => {
  const p = join(root, OUT_REL);
  assert.ok(existsSync(p), `${OUT_REL} 须已生成并提交`);
  const [{ content }] = generate(root);
  assert.equal(readFileSync(p, 'utf8'), content);
  const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
