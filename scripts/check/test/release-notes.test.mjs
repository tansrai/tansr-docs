import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CODES, findInternalCodes, judgeEntry, runReleaseNotesCheck, stripDetails } from '../release-notes.mjs';
import { generate, PACKAGES } from '../../gen/releases.mjs';

const CHANGELOGS = {
  cli: '# @tansr/cli Changelog\n\n> 门说明(FX-C-25)。\n\n## 0.5.0\n\n> 未发。\n\n- 内部条(FX-B-12 · W1)。\n\n## 0.4.0 (2026-09-06)\n\n- 追溯。\n',
  sdk: '# @tansr/sdk Changelog\n\n## 0.12.0\n\n> 未发。\n\n- x\n\n## 0.11.0 (2026-09-06)\n\n- y\n',
  serve: '# @tansr/serve Changelog\n\n## 0.7.0\n\n> 未发。\n\n- z\n',
};

const GOOD_NOTES = {
  cli: {
    '0.5.0': { added: ['新能力甲。'], changed: [], fixed: ['修了乙。'] },
    '0.4.0': { date: '2026-09-06', added: [], changed: [], fixed: [], note: '无用户可见变更' },
  },
  sdk: {
    '0.12.0': { added: ['丙'], changed: ['丁'], fixed: [] },
    '0.11.0': { date: '2026-09-06', added: ['戊'], changed: [], fixed: [] },
  },
  serve: { '0.7.0': { added: ['己'], changed: [], fixed: [] } },
};

/** 临时仓:contract/changelog 三份 + vendored.json + release-notes.json;生成页可选 */
function fixture(notes, { pages = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ds-release-notes-'));
  mkdirSync(join(root, 'contract', 'changelog'), { recursive: true });
  mkdirSync(join(root, 'src', 'content', 'docs', 'releases'), { recursive: true });
  const vendored = {};
  for (const pkg of PACKAGES) {
    writeFileSync(join(root, 'contract', ...pkg.source.split('/')), CHANGELOGS[pkg.id]);
    vendored[pkg.source] = { source: 'x', revision: 0, sha256: '0', vendoredAt: '2026-09-08' };
  }
  writeFileSync(join(root, 'contract', 'vendored.json'), JSON.stringify(vendored));
  writeFileSync(join(root, 'contract', 'release-notes.json'), typeof notes === 'string' ? notes : JSON.stringify(notes, null, 2) + '\n');
  if (pages) for (const o of generate(root)) writeFileSync(join(root, o.rel), o.content);
  return root;
}

function codesOf(r) {
  return r.violations.map((v) => `${v.code} ${v.where}`).sort();
}

test('release-notes 绿:每版本段有条目(三段 / note),生成页折叠段外零内部编号;折叠段内 FX- 原文不算', () => {
  const root = fixture(GOOD_NOTES);
  try {
    const r = runReleaseNotesCheck({ root });
    assert.deepEqual(r.violations, [], JSON.stringify(r.violations));
    assert.deepEqual(r.summary, { packages: 3, versions: 5, entries: 5, violations: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release-notes 红:缺条目 / 孤儿条目 / 三段皆空无 note / date 坏形 / 条目坏形 / 未知包键 各自出码', () => {
  const notes = structuredClone(GOOD_NOTES);
  delete notes.sdk['0.11.0']; // 缺
  notes.cli['0.3.9'] = { added: [], changed: [], fixed: [], note: 'n' }; // 孤儿
  notes.cli['0.4.0'] = { added: [], changed: [], fixed: [] }; // 皆空无 note
  notes.serve['0.7.0'] = { date: '2026/09/06', added: ['a'], changed: [], fixed: [] }; // date 坏
  notes.sdk['0.12.0'] = { added: 'not-array', changed: [], fixed: [] }; // 形坏
  notes.kernel = {}; // 未知包
  const root = fixture(notes, { pages: false });
  try {
    for (const pkg of PACKAGES) writeFileSync(join(root, 'src', 'content', 'docs', 'releases', `${pkg.id}.md`), '---\ntitle: x\n---\n\n正文。\n');
    const r = runReleaseNotesCheck({ root });
    assert.deepEqual(codesOf(r), [
      `${CODES.BAD_DATE} serve 0.7.0`,
      `${CODES.BAD_ENTRY} kernel`,
      `${CODES.BAD_ENTRY} sdk 0.12.0`,
      `${CODES.EMPTY_ENTRY} cli 0.4.0`,
      `${CODES.MISSING_ENTRY} sdk 0.11.0`,
      `${CODES.ORPHAN_ENTRY} cli 0.3.9`,
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release-notes 红:release-notes.json 或生成页折叠段外出现内部编号即红;页缺席即红;JSON 不可读即红', () => {
  const notes = structuredClone(GOOD_NOTES);
  notes.cli['0.5.0'].added.push('修了 FX-B-12 的问题(见 W1 回执)。');
  const root = fixture(notes, { pages: false });
  try {
    for (const pkg of PACKAGES) {
      const md = `---\ntitle: x\n---\n\n## 0.5.0\n\n- ${pkg.id === 'serve' ? '收编后的变化' : '正常条'}\n\n<details>\n<summary>原文</summary>\n\n#### 0.5.0\n\n- 内部条(FX-B-12 · W1 回执)。\n\n</details>\n`;
      if (pkg.id !== 'sdk') writeFileSync(join(root, 'src', 'content', 'docs', 'releases', `${pkg.id}.md`), md);
    }
    const r = runReleaseNotesCheck({ root });
    assert.deepEqual(codesOf(r), [
      `${CODES.INTERNAL_CODE} contract/release-notes.json:${JSON.stringify(notes, null, 2).split('\n').findIndex((l) => l.includes('FX-B-12')) + 1}`,
      `${CODES.INTERNAL_CODE} src/content/docs/releases/serve.md(折叠段外)`,
      `${CODES.PAGE_MISSING} src/content/docs/releases/sdk.md`,
    ]);
    writeFileSync(join(root, 'contract', 'release-notes.json'), '{ not json');
    assert.deepEqual(codesOf(runReleaseNotesCheck({ root })), [`${CODES.NOTES_UNREADABLE} contract/release-notes.json`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release-notes 纯函数:stripDetails 去折叠段(多段 / 未闭合);findInternalCodes 按 V-DS-08 词表;judgeEntry 形判', () => {
  assert.equal(stripDetails('a\n<details>\nFX-1\n</details>\nb\n<details>\nW1 回执\n</details>\nc'), 'a\n\nb\n\nc');
  assert.equal(stripDetails('a\n<details>\n未闭合 FX-'), 'a\n');
  assert.deepEqual(findInternalCodes('用户口吻\nFX-B-12\n泳道 x\n收编\n见 W3 回执\ndoc/134\n复审 Q-05\n卡号').map((h) => h.line), [2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(findInternalCodes('WebFetch / Http 出网\nTANSR_SERVE_V2=1\nW1x'), [], '普通英文词与非词表形不误报');
  assert.deepEqual(judgeEntry({ added: [], changed: [], fixed: [], note: '无用户可见变更' }), []);
  assert.deepEqual(judgeEntry({ added: ['a'], changed: [], fixed: [] }), []);
  assert.deepEqual(judgeEntry({ added: [], changed: [], fixed: [] }), [CODES.EMPTY_ENTRY]);
  assert.deepEqual(judgeEntry({ added: [], changed: [], fixed: [], note: '   ' }), [CODES.EMPTY_ENTRY]);
  assert.deepEqual(judgeEntry({ added: ['a'], changed: [], fixed: [], date: '2026-9-6' }), [CODES.BAD_DATE]);
  assert.deepEqual(judgeEntry({ added: ['a'], changed: [], fixed: [], extra: 1 }), [CODES.BAD_ENTRY]);
  assert.deepEqual(judgeEntry({ added: ['a'], changed: [] }), [CODES.BAD_ENTRY]);
  assert.deepEqual(judgeEntry(null), [CODES.BAD_ENTRY]);
  assert.deepEqual(judgeEntry(['a']), [CODES.BAD_ENTRY]);
});
