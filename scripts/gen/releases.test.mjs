import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, PACKAGES, parseVersionSections, renderUserSection } from './releases.mjs';
import { runReleaseNotesCheck } from '../check/release-notes.mjs';

// Exact headings from tansr-cli main 5d235a7e's three release changelogs.
const CURRENT = [
  { id: 'cli', heading: '## 0.6.0 — 2026-09-10', version: '0.6.0', previous: '0.5.0' },
  { id: 'sdk', heading: '## 0.13.0 — 2026-09-10', version: '0.13.0', previous: '0.12.0' },
  { id: 'serve', heading: '## 0.8.0 — 2026-09-10', version: '0.8.0', previous: '0.7.0' },
];

for (const { id, heading, version } of CURRENT) {
  test(`releases ${id}: real em-dash release heading is visible with its date`, () => {
    const sections = parseVersionSections(`${heading}\n\n- 新版本内容。\n`);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].version, version);
    assert.equal(sections[0].date, '2026-09-10');
    assert.equal(sections[0].unreleased, false);
    const visible = renderUserSection(sections[0], { added: ['用户可见能力。'], changed: [], fixed: [] });
    assert.ok(visible.startsWith(`## ${version}(2026-09-10)`));
    assert.ok(visible.includes('用户可见能力。'));
  });
}

test('releases keeps bare/unreleased and parenthesized headings compatible', () => {
  const sections = parseVersionSections('## 0.12.0\n\n> 未发。\n\n- 候选。\n\n## 0.11.1 (2026-09-06; 追溯)\n\n- 原版。\n');
  assert.deepEqual(sections.map(({ version, date, unreleased }) => ({ version, date, unreleased })), [
    { version: '0.12.0', date: undefined, unreleased: true },
    { version: '0.11.1', date: '2026-09-06', unreleased: false },
  ]);
});

test('releases em-dash extension rejects non-ISO and impossible dates without guessing prose', () => {
  for (const suffix of ['2026/09/10', '2026-9-10', '2026-00-10', '2026-13-10', '2026-02-30', '2026-09-31', '2026-09-10 extra']) {
    assert.deepEqual(parseVersionSections(`## 0.13.0 — ${suffix}\n\n- 内容。\n`), [], suffix);
  }
  assert.deepEqual(parseVersionSections('## 0.13.0 - 2026-09-10\n\n- 内容。\n'), []);
});

test('releases generation and coverage gate include all three current versions and explicit historical candidates', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-release-heading-'));
  try {
    mkdirSync(join(root, 'contract', 'changelog'), { recursive: true });
    mkdirSync(join(root, 'src', 'content', 'docs', 'releases'), { recursive: true });
    const notes = {};
    const vendored = {};
    for (const { id, heading, version, previous } of CURRENT) {
      writeFileSync(join(root, 'contract', 'changelog', `${id}.md`), `# ${id} Changelog\n\n${heading}\n\n- 新内容。\n\n## ${previous}\n\n> 历史候选归档：${previous} 没有单独发布，以下内容并入 ${version}。\n\n- 旧内容。\n`);
      notes[id] = {
        [version]: { added: ['用户可见新能力。'], changed: [], fixed: [] },
        [previous]: { added: [], changed: [], fixed: [], note: `历史候选，未单独发布；相关能力并入 ${version}。` },
      };
      vendored[`changelog/${id}.md`] = { source: 'fixture', revision: 1, sha256: 'fixture', vendoredAt: '2026-09-10' };
    }
    writeFileSync(join(root, 'contract', 'vendored.json'), JSON.stringify(vendored));
    writeFileSync(join(root, 'contract', 'release-notes.json'), JSON.stringify(notes));
    for (const page of generate(root)) writeFileSync(join(root, page.rel), page.content);
    const checked = runReleaseNotesCheck({ root });
    assert.deepEqual(checked.violations, []);
    assert.equal(checked.summary.versions, 6);
    assert.equal(checked.summary.entries, 6);
    assert.equal(checked.summary.packages, PACKAGES.length);
    for (const page of generate(root)) assert.ok(page.content.includes('历史候选，未单独发布；'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
