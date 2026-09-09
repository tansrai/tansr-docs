import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateFiles, checkDist, extractHrefs, resolveInternal } from '../links.mjs';

function dist() {
  const d = mkdtempSync(join(tmpdir(), 'ds-links-'));
  mkdirSync(join(d, 'a'), { recursive: true });
  mkdirSync(join(d, 'pagefind'), { recursive: true });
  writeFileSync(join(d, 'pagefind', 'pagefind.js'), '// js\n');
  writeFileSync(join(d, 'a', 'index.html'), '<html><body><h2 id="sec">S</h2><a href="../">up</a><a href="#sec">self</a></body></html>\n');
  return d;
}

test('links 绿:站内页 / 目录形 / 锚点 / 相对路径 / 静态文件 全部存在,外链只记不判', () => {
  const d = dist();
  try {
    writeFileSync(
      join(d, 'index.html'),
      [
        '<html><body>',
        '<a href="/a/">a</a>',
        '<a href="/a/#sec">a-sec</a>',
        '<a href="a/">rel</a>',
        '<a href="/pagefind/pagefind.js">js</a>',
        '<a href="https://www.tansr.com/terms">ext</a>',
        '<a href="mailto:support@example.com">mail</a>',
        '<a href="/">home</a>',
        '</body></html>',
      ].join('\n'),
    );
    const r = checkDist(d);
    assert.equal(r.notBuilt, false);
    assert.deepEqual(r.dead, []);
    assert.deepEqual(r.external, ['https://www.tansr.com/terms']);
    assert.equal(r.pages, 2);
    assert.ok(r.ok);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('links 红:缺页 / 缺锚点 / 同页缺锚点 各计一条死链', () => {
  const d = dist();
  try {
    writeFileSync(
      join(d, 'index.html'),
      '<html><body><a href="/missing/">m</a><a href="/a/#nope">n</a><a href="#none">s</a><a href="/a/">ok</a></body></html>',
    );
    const r = checkDist(d);
    assert.equal(r.ok, false);
    assert.equal(r.dead.length, 3);
    assert.deepEqual(
      r.dead.map((x) => x.href),
      ['/missing/', '/a/#nope', '#none'],
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('links:dist 缺席 → notBuilt', () => {
  const r = checkDist(join(tmpdir(), 'ds-links-does-not-exist-' + Date.now()));
  assert.equal(r.notBuilt, true);
  assert.equal(r.ok, false);
});

test('links 在所有宿主上区分页面目录与静态文件的大小写', () => {
  const d = dist();
  try {
    writeFileSync(join(d, 'pagefind', 'MixedCase.js'), '// exact case\n');
    writeFileSync(
      join(d, 'index.html'),
      '<a href="/A/">wrong page</a><a href="/pagefind/Pagefind.js">wrong asset</a><a href="/pagefind/mixedcase.js">wrong mixed asset</a><a href="/a/">page</a><a href="/pagefind/MixedCase.js">asset</a>',
    );
    const r = checkDist(d);
    assert.equal(r.ok, false);
    assert.deepEqual(r.dead.map((x) => x.href), ['/A/', '/pagefind/Pagefind.js', '/pagefind/mixedcase.js']);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('links 纯函数:href 抽取 / 相对解析 / 候选文件', () => {
  assert.deepEqual(extractHrefs(`<a href="/x/">1</a><link href='/y.css'><a href="/q?x=1&amp;y=2#h">`), ['/x/', '/y.css', '/q?x=1&y=2#h']);
  assert.deepEqual(resolveInternal('/a/b/', '../c/#h'), { path: '/a/c/', hash: 'h' });
  assert.deepEqual(resolveInternal('/a/b/', '#%E6%A6%82%E8%BF%B0'), { path: '/a/b/', hash: '概述' });
  assert.deepEqual(candidateFiles('/x'), ['x/index.html', 'x.html']);
  assert.deepEqual(candidateFiles('/x/'), ['x/index.html']);
  assert.deepEqual(candidateFiles('/_astro/a.css'), ['_astro/a.css']);
  assert.deepEqual(candidateFiles('/'), ['index.html']);
});
