import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, neutralizeRelativeLinks, PACKAGES, parseVersionSections, renderUserSection } from './releases.mjs';
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

// Exact candidate / unreleased headings from tansr-cli main c5219e02's three release changelogs.
test('releases candidate heading (`— 候选…`) is a version section without a date', () => {
  const sections = parseVersionSections('## 0.14.0 — 候选(未发版;版本号与发版节奏待用户拍板)— 2026-09-11\n\n- 候选内容。\n\n## 0.13.1 — 2026-09-11\n\n- 已定版内容。\n');
  assert.deepEqual(sections.map(({ version, date, unreleased }) => ({ version, date, unreleased })), [
    { version: '0.14.0', date: undefined, unreleased: true },
    { version: '0.13.1', date: '2026-09-11', unreleased: false },
  ]);
  const visible = renderUserSection(sections[0], { added: ['候选能力。'], changed: [], fixed: [] });
  assert.ok(visible.startsWith('## 0.14.0(未发)\n\n> 本版尚未发布;'));
  assert.ok(!visible.includes('2026-09-11'), 'candidate sections never show a date');
  // A hand-maintained date on a candidate entry is ignored as well: candidates only say 候选, never a release date.
  assert.ok(renderUserSection(sections[0], { date: '2026-09-11', added: ['x'], changed: [], fixed: [] }).startsWith('## 0.14.0(未发)'));
});

test('releases `Unreleased` / `未发布…` version names are unreleased without a quote marker', () => {
  const sections = parseVersionSections('## Unreleased\n\n- 候选内容。\n\n## 未发布(核心组件设计审查整改;版本号与发版节奏待用户拍板)\n\n- 候选内容。\n\n## 0.8.1 — 2026-09-11\n\n- 已定版。\n');
  assert.deepEqual(sections.map(({ version, date, unreleased }) => ({ version, date, unreleased })), [
    { version: 'Unreleased', date: undefined, unreleased: true },
    { version: '未发布(核心组件设计审查整改;版本号与发版节奏待用户拍板)', date: undefined, unreleased: true },
    { version: '0.8.1', date: '2026-09-11', unreleased: false },
  ]);
  const visible = renderUserSection(sections[0], { added: [], changed: ['候选变更。'], fixed: [] });
  assert.ok(visible.startsWith('## Unreleased(未发)\n\n> 本版尚未发布;'));
  assert.ok(renderUserSection(sections[1], { added: [], changed: [], fixed: [], note: '候选。' }).startsWith(`## ${sections[1].version}(未发)\n\n> 本版尚未发布;`));
  // Headings with inner whitespace (`## 未发布(RF-06;… → …)`) are not version sections: they fold into the previous section as before.
  assert.equal(parseVersionSections('## 0.14.0 — 候选(x)\n\n- a\n\n## 未发布(X;`Y` 签名变化 → 下一版至少 minor)\n\n- b\n').length, 1);
});

test('releases em-dash extension rejects non-ISO and impossible dates without guessing prose', () => {
  for (const suffix of ['2026/09/10', '2026-9-10', '2026-00-10', '2026-13-10', '2026-02-30', '2026-09-31', '2026-09-10 extra']) {
    assert.deepEqual(parseVersionSections(`## 0.13.0 — ${suffix}\n\n- 内容。\n`), [], suffix);
  }
  assert.deepEqual(parseVersionSections('## 0.13.0 - 2026-09-10\n\n- 内容。\n'), []);
});

// Exact link shapes from tansr-cli main 76e3c0df's packages/cli/CHANGELOG.md (0.7.0 section, REL-06 line).
test('releases folded CHANGELOG turns repo-relative links into plain text and leaves external / site / anchor links alone', () => {
  const raw = '见 [CLI 回执](doc/release/cli-0.7.0.md)及 [四包发布登记](doc/release/README.md)，见[公开消费验收](doc/release/REL-06-npm公开发布验收-2026-09-14.md)。';
  assert.equal(
    neutralizeRelativeLinks(raw),
    '见 CLI 回执(`doc/release/cli-0.7.0.md`)及 四包发布登记(`doc/release/README.md`)，见公开消费验收(`doc/release/REL-06-npm公开发布验收-2026-09-14.md`)。',
  );
  for (const keep of [
    '[npm](https://www.npmjs.com/package/@tansr/cli)',
    '[安全页](/security/#项目层-hooks)',
    '[同页锚](#0-7-0)',
    '[邮件](mailto:support@tansr.com)',
  ]) assert.equal(neutralizeRelativeLinks(keep), keep, keep);
  // Images and titled links are neutralized the same way; fenced code is untouched.
  assert.equal(neutralizeRelativeLinks('![图](img/a.png "标题")'), '图(`img/a.png`)');
  const fenced = '```md\n[x](doc/y.md)\n```\n[z](doc/z.md)';
  assert.equal(neutralizeRelativeLinks(fenced), '```md\n[x](doc/y.md)\n```\nz(`doc/z.md`)');
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
