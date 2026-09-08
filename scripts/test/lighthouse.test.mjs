/**
 * Lighthouse CI 配置卷(资料站 DS-21):lighthouserc.json 与 .github/workflows/lighthouse.yml 的形不走样。
 * 只查形(阈值 · url 三条 · 移动端 · 不外传 · actions pin sha · @lhci/cli 固定版本);分数本身由 CI / 本机 `npx @lhci/cli autorun` 出。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';

const root = repoRootFrom(import.meta.url);
const rc = JSON.parse(readFileSync(join(root, 'lighthouserc.json'), 'utf8'));
const wf = readFileSync(join(root, '.github', 'workflows', 'lighthouse.yml'), 'utf8');
const ci = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

test('lighthouserc:staticDistDir dist · 三条 url · numberOfRuns 1 · 移动端模拟', () => {
  assert.equal(rc.ci.collect.staticDistDir, 'dist');
  assert.deepEqual(rc.ci.collect.url, ['/', '/errors/codes/', '/support/']);
  assert.equal(rc.ci.collect.numberOfRuns, 1);
  assert.equal(rc.ci.collect.settings.formFactor, 'mobile');
  assert.equal(rc.ci.collect.settings.screenEmulation.mobile, true);
});

test('lighthouserc:阈值 performance ≥ 0.9,accessibility / best-practices / seo ≥ 0.95,全部 error 级', () => {
  const a = rc.ci.assert.assertions;
  assert.deepEqual(a['categories:performance'], ['error', { minScore: 0.9 }]);
  for (const c of ['accessibility', 'best-practices', 'seo']) assert.deepEqual(a[`categories:${c}`], ['error', { minScore: 0.95 }], c);
});

test('lighthouserc:报告只落本地文件系统,不外传', () => {
  assert.equal(rc.ci.upload.target, 'filesystem');
  assert.equal(rc.ci.upload.outputDir, '.lighthouseci');
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^\.lighthouseci\/$/m);
});

test('lighthouse.yml:main push + workflow_dispatch;install → build → 固定版本 autorun', () => {
  assert.match(wf, /^on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/m);
  const runs = [...wf.matchAll(/^\s+- run: (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(runs, ['pnpm install --frozen-lockfile', 'pnpm build', 'npx --yes @lhci/cli@0.15.1 autorun']);
  assert.match(wf, /^permissions:\n  contents: read$/m);
});

test('lighthouse.yml:actions 全部 pin 到 40 位 commit sha,且与 ci.yml 同一组 pin', () => {
  const uses = (s) => [...s.matchAll(/uses: ([^@\s]+)@([0-9a-f]+)/g)].map((m) => [m[1], m[2]]);
  const mine = uses(wf);
  assert.ok(mine.length >= 4);
  for (const [name, sha] of mine) assert.match(sha, /^[0-9a-f]{40}$/, `${name} 未 pin 到 commit sha`);
  const ciPins = new Map(uses(ci));
  for (const [name, sha] of mine) if (ciPins.has(name)) assert.equal(sha, ciPins.get(name), `${name} 与 ci.yml pin 不同`);
  assert.ok(!/uses: [^@\s]+@v\d/.test(wf), '不得以 @vN 标签引用');
});
