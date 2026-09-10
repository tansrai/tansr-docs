import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRootFrom } from '../lib/text.mjs';
import { GENERATED_MARKER } from '../../src/lib/contract.mjs';
import { GLOSSARY } from '../../src/lib/glossary.mjs';
import { buildCoverage, fileToSlug, generate, OUT_REL, OUT_SLUG, readMeta, render } from './i18n-coverage.mjs';

const root = repoRootFrom(import.meta.url);

/** 最小内容目录 fixture:根 3 页 + en 1 页翻译 + en 1 页孤儿 */
function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-i18n-'));
  const docs = join(tmp, 'src', 'content', 'docs');
  const page = (rel, title, lastVerified, extra = '') => {
    mkdirSync(join(docs, rel, '..'), { recursive: true });
    writeFileSync(join(docs, rel), `---\ntitle: '${title}'\ndescription: x\nzone: docs\ncategory: sdk\nlastVerified: '${lastVerified}'\n${extra}---\n\nbody\n`, 'utf8');
  };
  page('index.md', '首页', '2026-09-01');
  page('a.md', '甲 | 竖线', '2026-09-03');
  page('b/index.mdx', '乙', '2026-09-02');
  page('en/a.md', 'A', '2026-09-05');
  page('en/orphan.md', 'Orphan', '2026-09-04');
  return { tmp, docs, page };
}

test('fileToSlug:去扩展名;index → 目录;根 index → 空', () => {
  assert.equal(fileToSlug('index.md'), '');
  assert.equal(fileToSlug('a.md'), 'a');
  assert.equal(fileToSlug('b/index.mdx'), 'b');
  assert.equal(fileToSlug('en/support/contact.mdx'), 'en/support/contact');
  assert.equal(fileToSlug('sdk/api/classes/AgentSession.md'), 'sdk/api/classes/agentsession');
  assert.equal(fileToSlug('en/sdk/api/functions/createSession.md'), 'en/sdk/api/functions/createsession');
});

test('覆盖率 URL 与 Starlight 小写符号路由一致,不同文件名大小写的翻译仍配对', () => {
  const { tmp, page } = fixture();
  try {
    page('sdk/api/classes/AgentSession.md', 'AgentSession', '2026-09-09');
    page('en/sdk/api/classes/agentsession.md', 'AgentSession EN', '2026-09-09');
    const cov = buildCoverage(tmp);
    const row = cov.rows.find((r) => r.slug === 'sdk/api/classes/agentsession');
    assert.equal(row.translated.en, 'AgentSession EN');
    const text = render(cov);
    assert.match(text, /\[AgentSession\]\(\/sdk\/api\/classes\/agentsession\/\)/);
    assert.match(text, /\[AgentSession EN\]\(\/en\/sdk\/api\/classes\/agentsession\/\)/);
    assert.ok(!text.includes('/AgentSession/'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('readMeta:只取 title / lastVerified / generated,单引号转义还原', () => {
  const m = readMeta(`---\ntitle: 'It''s'\ndescription: 'ignored'\nlastVerified: '2026-09-09'\ngenerated: true\n---\n`);
  assert.deepEqual(m, { title: "It's", lastVerified: '2026-09-09', generated: true });
  assert.deepEqual(readMeta('no frontmatter'), { title: '', lastVerified: '', generated: false });
});

test('buildCoverage(fixture):分母 = 根 slug 集;en 计数;孤儿另列;lastVerified 取最大', () => {
  const { tmp } = fixture();
  try {
    const cov = buildCoverage(tmp);
    assert.deepEqual(cov.locales, ['en']);
    assert.deepEqual(cov.rows.map((r) => r.slug), ['', 'a', 'b']);
    assert.deepEqual(cov.summary, { total: 3, handwritten: 3, generated: 0, en: 1, byScope: { handwritten: { en: 1 }, generated: { en: 0 } } });
    assert.equal(cov.rows.find((r) => r.slug === 'a').translated.en, 'A');
    assert.equal(cov.rows.find((r) => r.slug === 'b').translated.en, undefined);
    assert.deepEqual(cov.orphans.map((o) => o.slug), ['orphan']);
    assert.equal(cov.lastVerified, '2026-09-05');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('红例 → 绿例:含 generated: true 页时,旧算法分母(全部根页)≠ 新算法分母(手写页);手写页口径 = 手写页数', () => {
  const { tmp, page } = fixture();
  try {
    // 生成页两篇:一篇无译文、一篇有 en 译文(译文也是生成页);都不得进覆盖率
    page('errors/codes.md', '错误码参考', '2026-09-06', 'generated: true\n');
    page('sdk/api/x.md', 'X', '2026-09-06', 'generated: true\n');
    page('en/sdk/api/x.md', 'X EN', '2026-09-06', 'generated: true\n');
    const cov = buildCoverage(tmp);
    const handwrittenRows = cov.rows.filter((r) => r.generated !== true);
    assert.equal(cov.rows.length, 5);
    assert.equal(cov.summary.total, 5, '旧算法分母 = 全部根页');
    assert.equal(cov.summary.handwritten, handwrittenRows.length, '新算法分母 = 手写页数');
    assert.equal(cov.summary.handwritten, 3);
    assert.equal(cov.summary.generated, 2);
    assert.notEqual(cov.summary.handwritten, cov.summary.total, '含生成页时两口径分母必然不同(修前红:summary 无 handwritten)');
    // 全部根页口径 en = 2(a + 生成页 x);手写页口径 en = 1(只 a);生成页口径 en = 1(x)
    assert.equal(cov.summary.en, 2);
    assert.deepEqual(cov.summary.byScope, { handwritten: { en: 1 }, generated: { en: 1 } });
    const text = render(cov);
    // 主表以手写页为分母;生成页单独一行只报数量
    assert.match(text, /\| English\(`en`\) \| 1 \/ 3 \| 33\.3% \|/, '主表分母须为手写页数 3,而非 5');
    assert.doesNotMatch(text, /\| 1 \/ 5 \|/);
    assert.doesNotMatch(text, /\| 2 \/ 5 \|/);
    assert.match(text, /^\| 生成页\(不计覆盖率\) \| 2 \| — \|$/m);
    assert.match(text, /^description: .*3 篇手写文章.*English 1 篇.*2 篇.*不计/m);
    // 逐页表:手写行在前、生成行归末尾 <details> 折叠段;全部行都在
    const details = text.indexOf('<details>');
    const summaryLine = '<summary>生成页(2,不计覆盖率)</summary>';
    assert.ok(details > 0 && text.indexOf(summaryLine) > details, '折叠段与 summary 行须在场');
    assert.ok(text.indexOf('</details>') > text.indexOf(summaryLine));
    for (const s of ['(/a/)', '(/b/)', '[首页](/)']) assert.ok(text.indexOf(s) < details, `手写页 ${s} 须在折叠段之前`);
    for (const s of ['(/errors/codes/)', '(/sdk/api/x/)']) assert.ok(text.indexOf(s) > details, `生成页 ${s} 须在折叠段之内`);
    assert.match(text, /\| \[X\(生成页\)\]\(\/sdk\/api\/x\/\) `sdk\/api\/x` \| ✓ \| ✓ \[X EN\]\(\/en\/sdk\/api\/x\/\) \|/);
    assert.match(text, /\| \[错误码参考\(生成页\)\]\(\/errors\/codes\/\) `errors\/codes` \| ✓ \| 回落 \|/);
    // 折叠段内的表须在空行之后(CommonMark HTML 块结束后 Markdown 才生效)
    assert.match(text, new RegExp(`${summaryLine.replace(/[()]/g, '\\$&')}\\n\\n\\| 页面 \\| zh-CN \\| \`en\` \\|\\n`));
    assert.match(text, /\|\n\n<\/details>\n/);
    // 术语表在折叠段之后仍在场
    assert.ok(text.indexOf('## 术语表') > text.indexOf('</details>'));
    // stats 两口径
    const [out] = generate(tmp);
    assert.equal(out.stats.total, 5);
    assert.equal(out.stats.handwritten, 3);
    assert.equal(out.stats.generated, 2);
    assert.equal(out.stats.en, 1, 'stats.en 走主口径(手写页)');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('render(fixture):frontmatter 契约 + 标记行;表行 ✓ / 回落;标题竖线转义;术语表整表', () => {
  const { tmp } = fixture();
  try {
    const text = render(buildCoverage(tmp));
    const lines = text.split('\n');
    assert.equal(lines[0], '---');
    const end = lines.indexOf('---', 1);
    const fm = lines.slice(1, end).join('\n');
    for (const k of ['title', 'description', 'zone', 'category', 'lastVerified', 'generated']) assert.match(fm, new RegExp(`^${k}:`, 'm'), `frontmatter 缺 ${k}`);
    assert.match(fm, /^lastVerified: '2026-09-05'$/m);
    assert.match(fm, /^generated: true$/m);
    assert.match(lines[end + 1], GENERATED_MARKER, '标记行须匹配 GENERATED_MARKER');
    assert.match(text, /\| English\(`en`\) \| 1 \/ 3 \| 33\.3% \|/);
    assert.match(text, /\| \[甲 \\\| 竖线\]\(\/a\/\) `a` \| ✓ \| ✓ \[A\]\(\/en\/a\/\) \|/);
    assert.match(text, /\| \[乙\]\(\/b\/\) `b` \| ✓ \| 回落 \|/);
    assert.match(text, /\| \[首页\]\(\/\) `\/` \| ✓ \| 回落 \|/);
    assert.match(text, /### 仅存在于翻译语言的页面[\s\S]*\| `orphan` \| `en` \|/);
    for (const t of GLOSSARY) assert.ok(text.includes(`| ${t.zh} | ${t.en} |`), `术语表缺 ${t.zh}`);
    assert.ok(text.endsWith('\n') && !text.includes('\r'), 'LF 收尾');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('本轮内存产物:新增页与翻译计数,覆盖旧标题日期,不把非页面文件计入', () => {
  const { tmp } = fixture();
  try {
    const content = (title) => `---\ntitle: '${title}'\nlastVerified: '2026-09-09'\ngenerated: true\n---\n`;
    const pending = [
      { rel: 'src/content/docs/sdk/api/new.md', content: content('New export') },
      { rel: 'src\\content\\docs\\en\\sdk\\api\\new.md', content: content('New export EN') },
      { rel: 'src/content/docs/a.md', content: content('Updated title') },
      { rel: 'contract/openapi.public.json', content: '{}' },
    ];
    const cov = buildCoverage(tmp, pending);
    // 内存产物都带 generated: true:a 被覆盖成生成页、sdk/api/new 为生成页 → 手写只剩 '' 与 b
    assert.deepEqual(cov.summary, { total: 4, handwritten: 2, generated: 2, en: 2, byScope: { handwritten: { en: 0 }, generated: { en: 2 } } });
    assert.equal(cov.rows.find((r) => r.slug === 'a').title, 'Updated title');
    assert.equal(cov.rows.find((r) => r.slug === 'a').generated, true, '内存产物的 generated 须覆盖磁盘');
    assert.equal(cov.rows.find((r) => r.slug === 'sdk/api/new').translated.en, 'New export EN');
    assert.equal(cov.lastVerified, '2026-09-09');
    assert.equal(buildCoverage(tmp).summary.total, 3, '内存覆盖不得改磁盘');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('自指收敛:生成页写回后再算,行集与正文零 diff(修前红:自身被计成一篇「回落」)', () => {
  const { tmp } = fixture();
  try {
    const first = generate(tmp);
    assert.equal(first.length, 1);
    assert.equal(first[0].rel, OUT_REL);
    mkdirSync(join(tmp, OUT_REL, '..'), { recursive: true });
    writeFileSync(join(tmp, OUT_REL), first[0].content, 'utf8');
    const second = generate(tmp);
    assert.equal(second[0].content, first[0].content, '写回自身后再生成须零 diff');
    assert.ok(!buildCoverage(tmp).rows.some((r) => r.slug === OUT_SLUG), '本页不进表');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('本仓:en 首批 10 篇计入覆盖;已提交生成页与 render 逐字节相同', () => {
  const cov = buildCoverage(root);
  const first10 = ['getting-started', 'getting-started/sdk', 'getting-started/cli', 'getting-started/serve', 'getting-started/android', 'support', 'support/account', 'support/troubleshooting', 'support/contact', 'security'];
  for (const s of first10) {
    const row = cov.rows.find((r) => r.slug === s);
    assert.ok(row, `根页 ${s} 须存在`);
    assert.ok(typeof row.translated.en === 'string' && row.translated.en.length > 0, `${s} 须有 en 译文`);
  }
  assert.ok(cov.summary.en >= 10);
  assert.deepEqual(cov.orphans, [], 'en 不得有无根页的孤儿翻译');
  // 两口径:手写页 = generated !== true 的根页;生成页(sdk/api 导出参考 + 错误码 / env / 命令 / 发布说明)只报数量
  assert.equal(cov.summary.handwritten, cov.rows.filter((r) => r.generated !== true).length);
  assert.equal(cov.summary.generated, cov.rows.filter((r) => r.generated === true).length);
  assert.equal(cov.summary.handwritten + cov.summary.generated, cov.summary.total);
  assert.ok(cov.summary.generated >= 482 + 6, `生成页至少 sdk/api 482 + 6 张表页,实得 ${cov.summary.generated}`);
  assert.ok(cov.summary.handwritten < 100, `手写页应远少于生成页,实得 ${cov.summary.handwritten}`);
  assert.ok(!cov.rows.some((r) => r.slug === OUT_SLUG), '覆盖率页自身不进表、不计生成页');
  assert.equal(cov.summary.byScope.handwritten.en, cov.summary.en, '本仓 en 译文全是手写页');
  assert.equal(readFileSync(join(root, OUT_REL), 'utf8'), render(cov));
});
