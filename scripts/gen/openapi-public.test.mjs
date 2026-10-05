import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootFrom } from '../lib/text.mjs';
import { danglingRefs, filterPublic, generate, OUT_REL, PUBLIC_TITLE, publicTags, sanitizeMarkdownText } from './openapi-public.mjs';

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

test('openapi-public:adminKey 鉴权替代项不出公开面(用户拍板 2026-09-10 ④)—— 假契约:含 adminKey 的替代项剔除、匿名 {} 与其余替代项保留、替代项全为 adminKey 的 op 整条不出并计 droppedBySecurity、只剩被剔 op 的路径整条不出、无 / 空 security 的 op 不动、securitySchemes 自然落掉 adminKey', () => {
  const src = {
    openapi: '3.1.0',
    info: { title: 't' },
    paths: {
      '/v1/mixed': { post: { tags: ['control'], security: [{ bearerAuth: [] }, { adminKey: [] }], responses: {} } },
      '/v1/anon-mixed': { get: { tags: ['control'], security: [{}, { bearerAuth: [] }, { adminKey: [] }], responses: {} } },
      '/v1/admin-only-op': {
        post: { tags: ['control'], security: [{ adminKey: [] }], responses: {} },
        get: { tags: ['control'], security: [{ bearerAuth: [] }], responses: {} },
      },
      '/v1/admin-only-path': { post: { tags: ['control'], security: [{ adminKey: [] }, { adminKey: [], bearerAuth: [] }], responses: {} } },
      '/v1/no-security': { get: { tags: ['control'], responses: {} } },
      '/v1/empty-security': { get: { tags: ['control'], security: [], responses: {} } },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        adminKey: { type: 'apiKey', in: 'header', name: 'x-tansr-admin-key' },
        appKey: { type: 'apiKey', in: 'header', name: 'x-tansr-key' },
      },
    },
  };
  const { doc, stats } = filterPublic(src);
  assert.deepEqual(doc.paths['/v1/mixed'].post.security, [{ bearerAuth: [] }], '只剩 bearerAuth');
  assert.deepEqual(doc.paths['/v1/anon-mixed'].get.security, [{}, { bearerAuth: [] }], '匿名 {} 保留、序不变');
  assert.equal(doc.paths['/v1/admin-only-op'].post, undefined, '替代项全为 adminKey 的 op 不出');
  assert.ok(doc.paths['/v1/admin-only-op'].get, '同路径其余 op 仍在');
  assert.equal(doc.paths['/v1/admin-only-path'], undefined, '只剩被剔 op 的路径整条不出');
  assert.equal(doc.paths['/v1/no-security'].get.security, undefined, '无 security 的 op 不动');
  assert.deepEqual(doc.paths['/v1/empty-security'].get.security, [], 'security: [] 原样');
  assert.equal(stats.strippedAdminKey, 2, '剔除替代项后仍出公开面的 op 数');
  assert.equal(stats.droppedBySecurity, 2, '整条不出的 op 数(admin-only-op POST + admin-only-path POST)');
  assert.equal(stats.operations, 5);
  assert.deepEqual(Object.keys(doc.components.securitySchemes), ['bearerAuth'], 'securitySchemes 只留被公开 op 引用者');
  assert.equal(JSON.stringify(doc).includes('adminKey'), false, '公开副本全文不得含 adminKey');
});

test('openapi-public:顶层 security 同法 —— 含 adminKey 的替代项剔除;顶层全为 adminKey 时,未自带 security 的 op 继承的即纯管理鉴权,整条不出并计 droppedBySecurity', () => {
  const base = {
    openapi: '3.1.0',
    info: { title: 't' },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' }, adminKey: { type: 'apiKey', in: 'header', name: 'x-tansr-admin-key' } } },
  };
  const mixedTop = filterPublic({
    ...base,
    security: [{ bearerAuth: [] }, { adminKey: [] }],
    paths: { '/v1/inherit': { get: { tags: ['control'], responses: {} } }, '/v1/own': { get: { tags: ['control'], security: [{ adminKey: [] }], responses: {} } } },
  });
  assert.deepEqual(mixedTop.doc.security, [{ bearerAuth: [] }], '顶层只剩 bearerAuth');
  assert.ok(mixedTop.doc.paths['/v1/inherit'].get, '继承混合鉴权的 op 仍在');
  assert.equal(mixedTop.doc.paths['/v1/own'], undefined);
  assert.equal(mixedTop.stats.droppedBySecurity, 1);
  assert.equal(mixedTop.stats.strippedAdminKey, 0, '顶层剔除不计入 op 数');
  assert.deepEqual(Object.keys(mixedTop.doc.components.securitySchemes), ['bearerAuth']);
  assert.equal(JSON.stringify(mixedTop.doc).includes('adminKey'), false);

  const adminTop = filterPublic({
    ...base,
    security: [{ adminKey: [] }],
    paths: { '/v1/inherit': { get: { tags: ['control'], responses: {} } }, '/v1/own': { get: { tags: ['control'], security: [{ bearerAuth: [] }], responses: {} } } },
  });
  assert.deepEqual(adminTop.doc.security, [], '顶层剔空 → 公开面缺省无鉴权(剩余 op 皆自带 security)');
  assert.equal(adminTop.doc.paths['/v1/inherit'], undefined, '继承纯管理鉴权的 op 不出');
  assert.deepEqual(adminTop.doc.paths['/v1/own'].get.security, [{ bearerAuth: [] }]);
  assert.equal(adminTop.stats.droppedBySecurity, 1);
  assert.equal(JSON.stringify(adminTop.doc).includes('adminKey'), false);
});

test('openapi-public:真契约锁卷 —— 公开 json 全文不含 adminKey;POST /v1/adjudicators/{id}/evaluation-report 只剩 bearerAuth、GET /v1/adjudicator-pool/artifact 保留匿名 {} + bearerAuth;strippedAdminKey 2 · droppedBySecurity 0;securitySchemes 无 adminKey', () => {
  const { doc, stats } = filterPublic(source);
  assert.equal(JSON.stringify(doc).includes('adminKey'), false, '公开副本全文不得含 adminKey');
  assert.deepEqual(doc.paths['/v1/adjudicators/{id}/evaluation-report']?.post?.security, [{ bearerAuth: [] }]);
  assert.deepEqual(doc.paths['/v1/adjudicator-pool/artifact']?.get?.security, [{}, { bearerAuth: [] }]);
  assert.equal(stats.strippedAdminKey, 2);
  assert.equal(stats.droppedBySecurity, 0, '现实契约里没有替代项全为 adminKey 的公开 op');
  assert.ok(!('adminKey' in doc.components.securitySchemes));
  assert.ok('adminKey' in source.components.securitySchemes, '源契约仍定义 adminKey(只在管理面用)');
  // 在库副本同样零残留(再生零 diff 由末例守;这里直接看落盘文本,防生成器与在库件脱节)
  assert.equal(readFileSync(join(root, OUT_REL), 'utf8').includes('adminKey'), false, `${OUT_REL} 在库文本不得含 adminKey`);
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

test('openapi-public:tags 规则 5 —— 声明过的按源序留(含 description)、未用到的去、用到而未声明的补 { name } 按名序附后;真契约 tansr-api@ed26af65 起 4 个未声明 tag(nonchat · sdk2-cache · sdk2-cache-core · sdk2-runtime-continuity)', () => {
  const declared = [{ name: 'twp', description: 'T' }, { name: 'admin', description: 'A' }, { name: 'gateway', description: 'G' }];
  assert.deepEqual(publicTags(declared, new Set(['zeta', 'gateway', 'alpha', 'twp'])), [
    { name: 'twp', description: 'T' },
    { name: 'gateway', description: 'G' },
    { name: 'alpha' },
    { name: 'zeta' },
  ]);
  assert.deepEqual(publicTags(undefined, new Set(['b', 'a'])), [{ name: 'a' }, { name: 'b' }], '源无 tags 声明时全部补 { name }');
  assert.deepEqual(publicTags([{ name: 'x' }], new Set()), [], '无公开操作用到即为空');
  const { doc } = filterPublic(source);
  const declaredNames = new Set((source.tags ?? []).map((t) => t.name));
  const synthesized = doc.tags.filter((t) => !declaredNames.has(t.name));
  assert.deepEqual(synthesized, ['nonchat', 'sdk2-cache', 'sdk2-cache-core', 'sdk2-runtime-continuity'].map((name) => ({ name })), '真契约:4 个只在操作上出现的 tag 以 { name } 补齐;源头补声明后此断言应改为空');
  const declaredKept = doc.tags.slice(0, doc.tags.length - synthesized.length);
  for (const t of declaredKept) assert.deepEqual(t, (source.tags ?? []).find((s) => s.name === t.name), `${t.name} 声明过的须逐字沿源`);
  assert.deepEqual(declaredKept.map((t) => t.name), (source.tags ?? []).map((t) => t.name).filter((n) => doc.tags.some((t) => t.name === n) && declaredNames.has(n)), '声明过的按源序');
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
