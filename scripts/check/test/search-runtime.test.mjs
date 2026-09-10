import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { searchRank } from '../search-rank.mjs';

function fixture(source, extra = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'tansr-search-空 格 #%-'));
  mkdirSync(join(dist, 'pagefind'));
  mkdirSync(join(dist, '_astro'));
  writeFileSync(join(dist, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(dist, '_astro', 'Search.astro-fixture.js'), 'const options={ranking:{metaWeights:{keys:8,title:5}}};\n');
  writeFileSync(join(dist, 'pagefind', 'pagefind.js'), source);
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dist, 'pagefind', name), body);
  return { dist, cleanup: () => rmSync(dist, { recursive: true, force: true }) };
}

function checkDiagnostic(error, fx, source, phase) {
  assert.equal(error.code, 'SEARCH_RUNTIME_FAILED');
  assert.equal(error.diagnostic.phase, phase);
  assert.equal(error.diagnostic.node, process.version);
  assert.equal(error.diagnostic.entryModule.url, pathToFileURL(join(fx.dist, 'pagefind', 'pagefind.js')).href);
  assert.equal(error.diagnostic.entryModule.bytes, Buffer.byteLength(source));
  assert.equal(error.diagnostic.entryModule.sha256, createHash('sha256').update(source).digest('hex'));
  assert.ok(error.message.length < 1200, '说明须有界，不输出原始模块正文');
  assert.ok(!error.message.includes(source), '模块正文不回显');
}

test('search runtime:损坏顶层模块仍拒绝，保留 SyntaxError cause 与原文件字节指纹', async () => {
  const source = 'export const broken = (';
  const fx = fixture(source);
  try {
    await assert.rejects(searchRank({ dist: fx.dist }), error => {
      checkDiagnostic(error, fx, source, 'import');
      assert.ok(error.cause instanceof SyntaxError);
      assert.match(error.cause.message, /Unexpected end of input/);
      return true;
    });
  } finally { fx.cleanup(); }
});

test('search runtime:二次模块损坏不误称顶层字节损坏，仍保留原始编译异常', async () => {
  const source = 'import "./secondary.mjs"; export const options = () => {};\n';
  const fx = fixture(source, { 'secondary.mjs': 'export const broken = (' });
  try {
    await assert.rejects(searchRank({ dist: fx.dist }), error => {
      checkDiagnostic(error, fx, source, 'import');
      assert.ok(error.cause instanceof SyntaxError);
      assert.equal(error.diagnostic.entryModule.observation, 'after-failure');
      return true;
    });
  } finally { fx.cleanup(); }
});

for (const [phase, cause] of [['options', new Error('options fixture')], ['init', null], ['search', { fixture: 'search' }], ['data', 'data fixture']]) {
  test(`search runtime:${phase} 阶段单次失败上浮，保留原抛值且不重试或回落`, async () => {
    const key = `__searchRuntimeFixture_${phase}`;
    const state = { calls: [], cause };
    globalThis[key] = state;
    const source = `const state=globalThis[${JSON.stringify(key)}];
const visit=phase=>{state.calls.push(phase);if(phase===${JSON.stringify(phase)})throw state.cause;};
export const options=()=>visit('options');
export const init=()=>visit('init');
export const search=()=>{visit('search');return {results:[{score:1,data:()=>{visit('data');return {url:'/errors/codes/',meta:{title:'fixture'}};}}]};};
export const destroy=()=>visit('destroy');
`;
    const fx = fixture(source);
    try {
      await assert.rejects(searchRank({ dist: fx.dist, terms: ['rate_limited'] }), error => {
        checkDiagnostic(error, fx, source, phase);
        assert.equal(error.cause, cause);
        return true;
      });
      const expected = ['options', 'init', 'search', 'data'];
      assert.deepEqual(state.calls, [...expected.slice(0, expected.indexOf(phase) + 1), 'destroy']);
    } finally {
      delete globalThis[key];
      fx.cleanup();
    }
  });
}
