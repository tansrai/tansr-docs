#!/usr/bin/env node
/**
 * serve 环境变量表生成器(资料站 DS-09)。
 *   contract/serve.env.example → src/content/docs/serve/env.md
 *
 * `.env.example` 由 cli 仓 `packages/server/src/runtime-options.ts` 的表生成,注释形固定:
 *   头注(`# …` 若干行;含「不在表内 … :KEY / KEY …」与「共 N 键」)
 *   `# ———— <组名>(<组 id>)————`                     组头
 *   `# <运行时选项路径>(<取值形>)[ # sensitive]`          键注(敏感键尾标 `# sensitive`)
 *   `KEY=<缺省,留空 = 库缺省>`                           键行
 * 生成:`## 键一览` 总表(键 · 组 · 类型 · 缺省 · 敏感,键链到锚点)→ 逐组 `## <组名>` → `### <KEY>`(锚点 `#<小写键名>`)
 * + 单行表(组 · 类型 · 缺省 · 说明 · 敏感);头注点名「不在表内」的入口级键另立 `## 入口级键` 一节只登记键名(锚点同律)。
 * 键数与头注「共 N 键」对表,不一致即抛。
 *
 *   node scripts/gen/serve-env.mjs [--check]
 */
import { join } from 'node:path';
import { isMainModule } from '../lib/text.mjs';
import { cell, DOCS_DIR, frontmatter, generatedHeader, lastVerifiedFor, readContractText, runGenerator } from './lib.mjs';

export const SCRIPT = 'scripts/gen/serve-env.mjs';
export const SOURCE = 'serve.env.example';
export const OUT_REL = join(DOCS_DIR, 'serve', 'env.md');

const GROUP_RE = /^#\s*—+\s*(.+?)\((\S+?)\)\s*—+\s*$/u;
const KEYNOTE_RE = /^#\s+(\S+?)\((.*)\)\s*(#\s*sensitive)?\s*$/u;
const KEYLINE_RE = /^([A-Z][A-Z0-9_]*)=(.*)$/;

/** 解析 .env.example → { header: string[], groups: [{ id, label, keys: [{ key, path, spec, default, sensitive }] }], declaredCount, outside: string[] } */
export function parseEnvExample(text) {
  const lines = text.split('\n');
  const header = [];
  const groups = [];
  let cur = null;
  let pendingNote = null;
  let i = 0;
  for (; i < lines.length && !GROUP_RE.test(lines[i]); i++) {
    if (lines[i].startsWith('#')) header.push(lines[i].replace(/^#\s?/, ''));
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const g = GROUP_RE.exec(line);
    if (g) {
      cur = { id: g[2], label: g[1].trim(), keys: [] };
      groups.push(cur);
      pendingNote = null;
      continue;
    }
    const k = KEYLINE_RE.exec(line);
    if (k) {
      if (!cur) throw new Error(`键 ${k[1]} 出现在任一组头之前`);
      cur.keys.push({
        key: k[1],
        path: pendingNote?.path ?? '',
        spec: pendingNote?.spec ?? '',
        default: k[2].trim(),
        sensitive: pendingNote?.sensitive ?? false,
      });
      pendingNote = null;
      continue;
    }
    const n = KEYNOTE_RE.exec(line);
    if (n) {
      pendingNote = { path: n[1], spec: n[2], sensitive: n[3] !== undefined };
      continue;
    }
    throw new Error(`无法识别的行 ${i + 1}:${line}`);
  }
  const headerText = header.join(' ');
  const declared = /共\s*(\d+)\s*键/.exec(headerText);
  const declaredCount = declared ? Number(declared[1]) : undefined;
  const outsideSeg = /不在表内[^:]*[::]([^。]*)/.exec(headerText);
  const outside = outsideSeg ? [...outsideSeg[1].matchAll(/[A-Z][A-Z0-9_]+/g)].map((m) => m[0]) : [];
  return { header, groups, declaredCount, outside };
}

function kindOf(spec) {
  const s = spec.trim();
  if (/^integer/.test(s)) return '整数';
  if (/^1\|true\|yes\|on/.test(s)) return '布尔';
  if (/string/.test(s)) return '字符串';
  if (/URL/.test(s)) return 'URL';
  if (/^[a-z][a-z0-9-]*(\|[a-z][a-z0-9-]*)+$/.test(s)) return '枚举';
  return '其他';
}

export function render({ parsed, lastVerified }) {
  const keys = parsed.groups.flatMap((g) => g.keys.map((k) => ({ ...k, group: g })));
  const fmtDefault = (k) => (k.default === '' ? '留空(库缺省)' : `\`${k.default}\``);
  const fmtType = (k) => `${kindOf(k.spec)}:\`${k.spec}\``;
  const fmtSensitive = (k) => (k.sensitive ? '是' : '否');
  const anchor = (key) => key.toLowerCase();

  const out = [];
  out.push(
    frontmatter({
      title: 'serve 环境变量',
      description: `\`tansr serve\` 的运行时环境变量(共 ${keys.length} 键):所属组、取值形、缺省与敏感标记。`,
      zone: 'docs',
      category: 'serve',
      sources: ['contract/serve.env.example'],
      lastVerified,
      generated: true,
    }),
  );
  out.push(generatedHeader(SCRIPT, 'contract/serve.env.example'));
  out.push('');
  out.push('这些环境变量调节 `tansr serve` 的准入、超时、事件缓冲、多会话治理与日志形态。全部键都可以不设:留空等于未设,走库内缺省,行为不变;取值非法时忽略并打一条告警,不会拒绝启动。');
  out.push('');
  out.push('- 「类型」列给出取值形;整数类的单位(ms / bytes / days)写在括号里。');
  out.push('- 「敏感」为「是」的键其取值不会进入日志和告警;不要把它写进版本库。');
  out.push(`- 深链锚点为小写键名,例如 \`#${anchor(keys[0]?.key ?? 'tansr_serve_token')}\`。`);
  if (parsed.outside.length) {
    out.push(`- 另有 ${parsed.outside.length} 个键由 \`tansr serve\` 入口自行定义,不在本表(见末节「入口级键」)。`);
  }
  out.push('');
  out.push('## 键一览');
  out.push('');
  out.push('| 键 | 组 | 类型 | 缺省 | 敏感 |');
  out.push('|---|---|---|---|---|');
  for (const k of keys) {
    out.push(`| [\`${k.key}\`](#${anchor(k.key)}) | ${cell(k.group.label)} | ${cell(fmtType(k))} | ${cell(fmtDefault(k))} | ${fmtSensitive(k)} |`);
  }
  out.push('');
  for (const g of parsed.groups) {
    out.push(`## ${g.label}`);
    out.push('');
    out.push(`组 \`${g.id}\`,共 ${g.keys.length} 键。`);
    out.push('');
    for (const k of g.keys) {
      out.push(`### ${k.key}`);
      out.push('');
      out.push('| 组 | 类型 | 缺省 | 说明 | 敏感 |');
      out.push('|---|---|---|---|---|');
      const desc = [`对应运行时选项 \`${k.path}\``];
      if (k.sensitive) desc.push('取值不入日志与告警');
      out.push(`| ${cell(g.label)} | ${cell(fmtType(k))} | ${cell(fmtDefault(k))} | ${cell(desc.join(';'))}。 | ${fmtSensitive(k)} |`);
      out.push('');
    }
  }
  if (parsed.outside.length) {
    out.push('## 入口级键');
    out.push('');
    out.push('下列键由 `tansr serve` 的启动入口直接读取(多数有同义命令行旗标),不在上表的运行时选项表内;这里只登记键名以便深链,用法见 serve 部署指南。');
    out.push('');
    for (const key of parsed.outside) {
      out.push(`### ${key}`);
      out.push('');
      out.push(`入口级键,由 \`tansr serve\` 启动入口读取;不在 \`.env.example\` 运行时选项表内。`);
      out.push('');
    }
  }
  return out.join('\n');
}

export function generate(root) {
  const text = readContractText(root, SOURCE);
  const parsed = parseEnvExample(text);
  const count = parsed.groups.reduce((n, g) => n + g.keys.length, 0);
  if (parsed.declaredCount !== undefined && parsed.declaredCount !== count) {
    throw new Error(`头注声明 ${parsed.declaredCount} 键,实解析 ${count} 键`);
  }
  return [{ rel: OUT_REL, content: render({ parsed, lastVerified: lastVerifiedFor(root, SOURCE) }), stats: { keys: count, outside: parsed.outside.length, groups: parsed.groups.length } }];
}

if (isMainModule(import.meta.url)) runGenerator({ generate, SCRIPT });
