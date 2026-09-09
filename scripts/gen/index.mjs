#!/usr/bin/env node
/**
 * 生成物总入口(资料站 DS-09;package.json `gen` / `gen:check` 指向这里)。
 *
 *   node scripts/gen/index.mjs            跑全部生成器,写入在库路径
 *   node scripts/gen/index.mjs --check    全部生成到临时目录,与在库文件逐字节对比;任一差 / 缺即 exit 1 并列出文件
 *   可选 --root <docsRepo>(卷用)
 *
 * 生成器顺序 = 依赖顺序;coverage 同时读取本轮内存产物,首次新增页面也可一次收敛。
 * 生成器的 `generate(root)` 同步或返回 Promise 皆可(sdk-api 经 typedoc,异步);本入口统一 await。
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
import * as sdkApi from './sdk-api.mjs';
import * as i18nCoverage from './i18n-coverage.mjs';

// i18nCoverage 恒末位:它扫全部内容页(含 sdkApi 产物)的 slug 集
export const GENERATORS = [openapiPublic, errorCodes, serveEnv, cliCommands, releases, sdkApi, i18nCoverage];

/** 跑全部生成器(纯内存),返回 [{ script, rel, content, stats? }]。 */
export async function generateAll(root) {
  const out = [];
  for (const g of GENERATORS) {
    const pending = g === i18nCoverage ? out : undefined;
    for (const o of await g.generate(root, pending)) out.push({ script: g.SCRIPT, rel: o.rel, content: toLf(o.content), stats: o.stats });
  }
  return out;
}

export async function writeAll(root, log = console.log) {
  const outputs = await generateAll(root);
  let quiet = 0;
  for (const o of outputs) {
    writeLf(join(root, o.rel), o.content);
    if (isSdkApiPage(o.rel) && !o.stats) {
      quiet += 1;
      continue;
    }
    log(`[gen] wrote ${o.rel}${o.stats ? '  ' + JSON.stringify(o.stats) : ''}`);
  }
  if (quiet) log(`[gen] wrote sdk/api/** 另 ${quiet} 页(不逐行打)`);
  return outputs;
}

/**
 * --check:生成到临时目录,再与在库文件逐字节比对。返回 { ok, differing: string[], missing: string[] }。
 * sdk/api/** 页数多,逐页 ok 行不打,只打差 / 缺;末行汇总数。
 */
export async function checkAll(root, log = console.log) {
  const tmp = mkdtempSync(join(tmpdir(), 'tansr-docs-gen-check-'));
  const differing = [];
  const missing = [];
  let okCount = 0;
  try {
    const outputs = await generateAll(root);
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
        okCount += 1;
        if (!isSdkApiPage(o.rel)) log(`[gen:check] ok       ${o.rel}`);
      }
    }
    log(`[gen:check] ok 计 ${okCount} 文件(sdk/api/** 页不逐行打;差 ${differing.length} / 缺 ${missing.length})`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: differing.length === 0 && missing.length === 0, differing, missing };
}

function isSdkApiPage(rel) {
  return rel.split('\\').join('/').includes('/sdk/api/');
}

if (isMainModule(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = typeof args.root === 'string' ? args.root : repoRootFrom(import.meta.url);
  try {
    if (args.check) {
      const r = await checkAll(root);
      if (!r.ok) {
        const list = [...r.differing, ...r.missing];
        const shown = list.length > 20 ? [...list.slice(0, 20), `… 共 ${list.length} 文件`] : list;
        console.error(`[gen:check] FAIL  差 ${r.differing.length} / 缺 ${r.missing.length}:\n  ${shown.join('\n  ')}\n  → 跑 node scripts/gen/index.mjs 再生后提交`);
        process.exit(1);
      }
      console.log('[gen:check] ok(全部生成物零 diff)');
    } else {
      const outputs = await writeAll(root);
      console.log(`[gen] done  ${outputs.length} 文件`);
    }
  } catch (err) {
    console.error(`[gen] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
