import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EXPECTATIONS, readInlinedPagefindOptions, searchRank } from '../search-rank.mjs';
import { KEYS_META_FIELD, KEY_PAGES, META_WEIGHTS, keyPageOf, keysMetaValue, slugOfPath } from '../../../src/lib/search-weights.mjs';

const dist = resolve('dist');
const built = existsSync(join(dist, 'pagefind', 'pagefind.js'));
const skip = built ? false : 'dist/pagefind 缺席:先 pnpm build 再跑本卷(pnpm gate 的 build 步在前)';

test('search-weights 纯函数:查表页识别(含 en 前缀)、行键层取词(去重 / 去逗号 / 折叠空白)、元权重 keys > title', () => {
  assert.equal(slugOfPath('/en/errors/codes/'), 'errors/codes');
  assert.equal(slugOfPath('/'), '');
  assert.equal(keyPageOf('/errors/codes/')?.depth, 3);
  assert.equal(keyPageOf('/en/serve/env/')?.depth, 3);
  assert.equal(keyPageOf('/cli/commands/')?.depth, 2);
  assert.equal(keyPageOf('/cli/settings-and-doctor/'), undefined);
  assert.equal(keyPageOf('/api/operations/v1authsmsrequest/'), undefined);
  const headings = [
    { depth: 2, text: '通用' },
    { depth: 3, text: 'rate_limited' },
    { depth: 3, text: 'a, b' },
    { depth: 3, text: '  x   y ' },
    { depth: 3, text: 'rate_limited' },
    { depth: 4, text: 'deep' },
  ];
  assert.equal(keysMetaValue(headings, 3), `${KEYS_META_FIELD}:rate_limited a b x y`);
  assert.equal(keysMetaValue(headings, 2), `${KEYS_META_FIELD}:通用`);
  assert.equal(keysMetaValue([], 3), undefined);
  assert.equal(keysMetaValue(undefined, 3), undefined);
  assert.ok(META_WEIGHTS[KEYS_META_FIELD] > META_WEIGHTS.title, 'keys 元权重须高于标题');
  assert.equal(KEY_PAGES.length, 3);
});

test('search-rank:Starlight 内联的 pagefind 排序参数含本仓 metaWeights(keys 8 · title 5)', { skip }, () => {
  const { options } = readInlinedPagefindOptions(dist);
  assert.deepEqual(options.ranking.metaWeights, { ...META_WEIGHTS });
  assert.equal(options.ranking.termSimilarity, 9, 'Starlight 缺省排序参数未动');
});

test('search-rank:三词首位(rate_limited → /errors/codes/;TANSR_SERVE_TOKEN → /serve/env/;doctor → settings-and-doctor | commands)+ 两守卫', { skip }, async () => {
  const { results } = await searchRank({ dist });
  assert.equal(results.length, EXPECTATIONS.length);
  const bad = results.filter((r) => !r.ok).map((r) => `${r.term}: 首位 ${r.top[0]?.url ?? '—'}(目标 ${r.want.join(' | ')};名次 ${JSON.stringify(r.rankOfWant)})`);
  assert.deepEqual(bad, [], bad.join('\n'));
  for (const r of results) assert.ok(r.total >= 1, `${r.term} 零命中`);
});
