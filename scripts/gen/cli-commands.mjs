#!/usr/bin/env node
/**
 * CLI 命令参考页生成器(资料站 DS-09)。
 *   contract/cli-help.json → src/content/docs/cli/commands.md
 *
 * cli-help.json 由 scripts/vendor/cli-help.mjs 对真构建物采集:`top`(`tansr --help`)与 `commands[]`
 * (每子命令 `{ command, args, summary, help, exitCode }`)。
 * 页面:`## 全局帮助` 贴顶层 help 原文 → 每子命令 `## <cmd>`(锚点 `#<cmd>`,多词命令如 `mcp serve` → `#mcp-serve`)
 * + 一句摘要 + help 原文代码块;若子命令的 help 与顶层逐字相同(cli 现状:`--help` 在任意位置都打全局帮助),
 * 不重复贴,改为说明并链回全局帮助——如实反映真输出,也不让页面被同一份文本重复十几遍。
 *
 *   node scripts/gen/cli-commands.mjs [--check]
 */
import { join } from 'node:path';
import { isMainModule } from '../lib/text.mjs';
import { DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, readContractJson, runGenerator, slug } from './lib.mjs';

export const SCRIPT = 'scripts/gen/cli-commands.mjs';
export const SOURCE = 'cli-help.json';
export const OUT_REL = join(DOCS_DIR, 'cli', 'commands.md');
const GLOBAL_HEADING = '全局帮助';

/** 摘要进正文 / 表格:转义 `<` `>`(免被当 HTML 标签)与竖线。 */
function prose(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');
}

function codeBlock(text) {
  const body = text.replace(/\n$/, '');
  const fence = body.includes('```') ? '````' : '```';
  return `${fence}text\n${body}\n${fence}`;
}

export function render({ doc, lastVerified }) {
  const out = [];
  out.push(
    frontmatter({
      title: 'CLI 命令参考',
      description: `\`tansr\` 命令行(v${doc.version})的全局帮助与 ${doc.commands.length} 个子命令,内容取自命令的真实 \`--help\` 输出。`,
      zone: 'docs',
      category: 'cli',
      sources: ['contract/cli-help.json'],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, 'contract/cli-help.json'));
  out.push('');
  out.push(`本页内容来自 \`tansr\` v${doc.version} 的真实 \`--help\` 输出(已去除终端控制序列),不做改写。子命令一节的锚点是命令名本身,例如 \`#serve\`、\`#mcp-serve\`。`);
  out.push('');
  out.push('| 子命令 | 作用 |');
  out.push('|---|---|');
  for (const c of doc.commands) out.push(`| [\`tansr ${c.command}\`](#${slug(c.command)}) | ${prose(c.summary)} |`);
  out.push('');
  out.push(`## ${GLOBAL_HEADING}`);
  out.push('');
  out.push(`\`${[doc.top.command, ...doc.top.args].join(' ')}\`(退出码 ${doc.top.exitCode}):`);
  out.push('');
  out.push(codeBlock(doc.top.help));
  out.push('');
  for (const c of doc.commands) {
    out.push(`## ${c.command}`);
    out.push('');
    out.push(`作用(取自全局帮助「Modes」一节):${prose(c.summary)}`);
    out.push('');
    const cmdline = `tansr ${c.args.join(' ')}`;
    if (c.help === doc.top.help) {
      out.push(`\`${cmdline}\`(退出码 ${c.exitCode})打印的是与 [全局帮助](#${slug(GLOBAL_HEADING)}) 逐字相同的文本——\`tansr\` 目前不提供分命令帮助,子命令的旗标以全局帮助「Modes」一节的该行为准。`);
    } else {
      out.push(`\`${cmdline}\`(退出码 ${c.exitCode}):`);
      out.push('');
      out.push(codeBlock(c.help));
    }
    out.push('');
  }
  return out.join('\n');
}

export function generate(root) {
  const doc = readContractJson(root, SOURCE);
  return [{ rel: OUT_REL, content: render({ doc, lastVerified: lastVerifiedFor(root, SOURCE) }), stats: { commands: doc.commands.length } }];
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
