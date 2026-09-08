#!/usr/bin/env node
/**
 * 生成物总入口(资料站 DS-09;package.json `gen` / `gen:check` 指向这里)。
 *
 *   node scripts/gen/index.mjs            跑全部生成器,写入在库路径
 *   node scripts/gen/index.mjs --check    全部生成到临时目录,与在库文件逐字节对比;任一差 / 缺即 exit 1 并列出文件
 *   可选 --root <docsRepo>(卷用)
 *
 * 生成器顺序 = 依赖顺序(openapi.public 先于其余无关;全部只读 contract/)。
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMainModule, parseArgs, readTextIfExists, repoRootFrom, toLf, writeLf } from '../lib/text.mjs';
import * as errorCodes from './error-codes.mjs';
import * as openapiPublic from './openapi-public.mjs';
import * as serveEnv from './serve-env.mjs';
import * as cliCommands from './cli-commands.mjs';
import * as releases from './releases.mjs';

export const GENERATORS = [openapiPublic, errorCodes, serveEnv, cliCommands, releases];

/** 跑全部生成器(纯内存),返回 [{ script, rel, content, stats? }]。 */
export function generateAll(root) {
  const out = [];
  for (const g of GENERATORS) {
    for (const o of g.generate(root)) out.push({ script: g.SCRIPT, rel: o.rel, content: toLf(o.content), stats: o.stats });
  }
  return out;
}

export function writeAll(root, log = console.log) {
  const outputs = generateAll(root);
  for (const o of outputs) {
    writeLf(join(root, o.rel), o.content);
    log(`[gen] wrote ${o.rel}${o.stats ? '  ' + JSON.stringify(o.stats) : ''}`);
  }
  return outputs;
}

/**
 * --check:生成到临时目录,再与在库文件逐字节比对。返回 { ok, differing: string[], missing: string[] }。
 */
export function checkAll(root, log = console.log) {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-gen-check-'));
  const differing = [];
  const missing = [];
  try {
    const outputs = generateAll(root);
    for (const o of outputs) {
      const tmpPath = join(tmp, o.rel);
      writeLf(tmpPath, o.content);
      const fresh = readFileSync(tmpPath);
      const inRepo = readTextIfExists(join(root, o.rel));
      if (inRepo === undefined) {
        missing.push(o.rel);
        log(`[gen:check] MISSING  ${o.rel}`);
      } else if (!fresh.equals(Buffer.from(inRepo, 'utf8'))) {
        differing.push(o.rel);
        log(`[gen:check] DIFF     ${o.rel}`);
      } else {
        log(`[gen:check] ok       ${o.rel}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: differing.length === 0 && missing.length === 0, differing, missing };
}

if (isMainModule(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = typeof args.root === 'string' ? args.root : repoRootFrom(import.meta.url);
  try {
    if (args.check) {
      const r = checkAll(root);
      if (!r.ok) {
        console.error(`[gen:check] FAIL  差 ${r.differing.length} / 缺 ${r.missing.length}:\n  ${[...r.differing, ...r.missing].join('\n  ')}\n  → 跑 node scripts/gen/index.mjs 再生后提交`);
        process.exit(1);
      }
      console.log('[gen:check] ok(全部生成物零 diff)');
    } else {
      const outputs = writeAll(root);
      console.log(`[gen] done  ${outputs.length} 文件`);
    }
  } catch (err) {
    console.error(`[gen] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
