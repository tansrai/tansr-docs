/**
 * `pnpm gate`:check → build → gen:check → lint:text → links → frontmatter,顺序执行、首红即停。
 * 每步都走 package.json 的脚本名(与 CI / 本地一致)。末尾打印各步耗时与终态。
 *
 * 用法:node scripts/check/gate.mjs [--from <step>](从某步开始,便于本地重跑后半段)
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

export const STEPS = Object.freeze(['check', 'build', 'gen:check', 'lint:text', 'links', 'frontmatter']);

function parseArgs(argv) {
  const opts = { from: STEPS[0] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from') {
      const s = String(argv[++i] ?? '');
      if (!STEPS.includes(s)) throw new Error(`gate: --from must be one of ${STEPS.join(', ')}`);
      opts.from = s;
    } else throw new Error(`gate: unknown argument ${arg}`);
  }
  return opts;
}

export function runStep(step) {
  const started = Date.now();
  const r = spawnSync('pnpm', ['run', step], { stdio: 'inherit', shell: process.platform === 'win32' });
  return { step, status: r.status ?? 1, ms: Date.now() - started };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results = [];
  let failed = null;
  for (const step of STEPS.slice(STEPS.indexOf(opts.from))) {
    console.log(`\n[gate] ▶ ${step}`);
    const r = runStep(step);
    results.push(r);
    if (r.status !== 0) {
      failed = r;
      break;
    }
  }
  console.log('\n[gate] summary');
  for (const r of results) console.log(`  ${r.status === 0 ? '✔' : '✖'} ${r.step.padEnd(12)} ${String(r.ms).padStart(6)} ms`);
  if (failed) {
    console.error(`[gate] ✖ FAILED at ${failed.step} (exit ${failed.status})`);
    process.exit(1);
  }
  console.log('[gate] ✔ all green');
}

main();
