/**
 * `tansr --help` 采集器:对 cli 仓的真构建物(`dist/tansr.mjs`,esbuild 单文件束)跑
 * 顶层 `--help` 与每个子命令 `<cmd> --help`,记 `{ command, args, summary, help, exitCode }`。
 *
 * 子命令名不手写:从顶层 help 的「Modes:」块解析(行首命令词 + 描述里的 `also: a, b`),
 * 以真输出为准。help 文本剥 ANSI、LF 归一;采集过程隔离用户目录(TANSR_USER_HOME 指向临时目录),
 * 对 cli 仓零写入(构建物由 `scripts/vendor/index.mjs` 负责构建)。
 *
 * 直跑:`node scripts/vendor/cli-help.mjs <cliRepo>` 把 JSON 打到 stdout(调试用)。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMainModule, stripAnsi, toLf } from '../lib/text.mjs';

export const CLI_BUNDLE_REL = 'dist/tansr.mjs';

/**
 * 从顶层 help 解析子命令。Modes 块每行形如 `  serve              REST + SSE server (...)`;
 * 命令名 = 行首连续的小写词(遇 `<…>` / `[…]` / 两个以上空格即止),`(default)` / `-p` 一类跳过;
 * 描述里的 `also: logout, whoami` 追加为独立命令。
 */
export function parseSubcommands(topHelp) {
  const lines = toLf(topHelp).split('\n');
  const start = lines.findIndex((l) => /^Modes:\s*$/.test(l));
  if (start === -1) throw new Error('顶层 help 缺「Modes:」块,无法解析子命令');
  const out = [];
  const seen = new Set();
  const push = (name, summary) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ command: name, summary });
  };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') break;
    const m = /^\s+(\S.*)$/.exec(line);
    if (!m) break;
    const body = m[1];
    const words = [];
    let rest = body;
    for (;;) {
      const w = /^([a-z][a-z-]*)(\s*)/.exec(rest);
      if (!w) break;
      words.push(w[1]);
      rest = rest.slice(w[0].length);
      if (w[2].length >= 2 || w[2].length === 0) break;
    }
    if (words.length === 0) continue;
    // 跳过带 `<…>` / `[…]` 参数占位后的描述时,描述 = 去掉参数占位起始前的余下文本
    const summary = rest.replace(/^(?:[<[][^\s]*\]?\s*)+/, '').trim();
    push(words.join(' '), summary);
    const also = /\(also:\s*([a-z-]+(?:\s*,\s*[a-z-]+)*)\)/.exec(body);
    if (also) {
      for (const extra of also[1].split(',').map((s) => s.trim())) {
        push(extra, `见「${words.join(' ')}」`);
      }
    }
  }
  return out;
}

function runHelp(cliRepo, args, env) {
  const bundle = join(cliRepo, ...CLI_BUNDLE_REL.split('/'));
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args, '--help'], {
      cwd: cliRepo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
    return { help: toLf(stripAnsi(stdout)), exitCode: 0 };
  } catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return { help: toLf(stripAnsi(text)), exitCode: typeof err.status === 'number' ? err.status : 1 };
  }
}

/** 采集全部 help;返回可直接序列化的 cli-help.json 体。 */
export function collectCliHelp(cliRepo) {
  const bundle = join(cliRepo, ...CLI_BUNDLE_REL.split('/'));
  if (!existsSync(bundle)) throw new Error(`cli 构建物缺席:${bundle}(在 cli 仓跑 node build/build.mjs --only-tansr)`);
  const home = mkdtempSync(join(tmpdir(), 'tansr-docs-vendor-home-'));
  const env = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    TANSR_NO_UPDATE_CHECK: '1',
    TANSR_USER_HOME: home,
  };
  try {
    const top = runHelp(cliRepo, [], env);
    if (top.exitCode !== 0) throw new Error(`tansr --help 退出码 ${top.exitCode}:\n${top.help}`);
    const version = /\(v([0-9A-Za-z.+-]+)\)/.exec(top.help)?.[1] ?? '';
    const subs = parseSubcommands(top.help);
    const commands = subs.map(({ command, summary }) => {
      const args = command.split(' ');
      const r = runHelp(cliRepo, args, env);
      return { command, args: [...args, '--help'], summary, help: r.help, exitCode: r.exitCode };
    });
    return {
      tool: 'tansr',
      version,
      bundle: CLI_BUNDLE_REL,
      top: { command: 'tansr', args: ['--help'], help: top.help, exitCode: top.exitCode },
      commands,
    };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  const cliRepo = process.argv[2];
  if (!cliRepo) {
    console.error('用法:node scripts/vendor/cli-help.mjs <cliRepo>');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(collectCliHelp(cliRepo), null, 2) + '\n');
}
