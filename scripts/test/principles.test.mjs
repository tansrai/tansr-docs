/**
 * 核心理念只有一份事实源：首页组件与 /llms.txt 都从 src/lib/principles.mjs 来。
 * 英文条文不得撞术语表的禁用变体。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { findGlossaryViolations } from '../../src/lib/glossary.mjs';
import { PRINCIPLES, renderLlmsText } from '../../src/lib/principles.mjs';

const root = repoRootFrom(import.meta.url);

test('principles: 标识唯一，中英条文都在，英文不撞禁用变体', () => {
  const ids = PRINCIPLES.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of PRINCIPLES) {
    assert.ok(item.zh.term && item.zh.statement, item.id);
    assert.ok(item.en.term && item.en.statement, item.id);
    assert.deepEqual(findGlossaryViolations(item.en.statement), [], item.id);
    assert.deepEqual(findGlossaryViolations(item.en.term), [], item.id);
  }
});

test('principles: public/llms.txt 与渲染结果逐字相同，且每条标识都在首部', () => {
  const rendered = renderLlmsText();
  const onDisk = readFileSync(join(root, 'public', 'llms.txt'), 'utf8');
  assert.equal(onDisk, rendered);
  assert.ok(rendered.endsWith('\n'));
  const opening = rendered.slice(0, rendered.indexOf('## Machine-readable copy'));
  for (const item of PRINCIPLES) {
    assert.equal(opening.split(`### principle.${item.id}`).length, 3, item.id);
  }
});

test('principles: 深入页保留每条稳定锚点', () => {
  const page = readFileSync(join(root, 'src', 'content', 'docs', 'getting-started', 'principles.md'), 'utf8');
  for (const item of PRINCIPLES) {
    assert.match(page, new RegExp(`id="${item.id}"`));
  }
});
