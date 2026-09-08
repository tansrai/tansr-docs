#!/usr/bin/env node
/**
 * vendored 契约副本更新 / 对表(资料站 DS-06)。
 *
 *   node scripts/vendor/index.mjs --api <apiRepo> --cli <cliRepo> [--no-build]
 *     从两个兄弟仓**只读**拷入契约副本到 `contract/`,并登记 `contract/vendored.json`:
 *       openapi.json           ← <api>/openapi/openapi.json
 *       serve.env.example      ← <cli>/packages/server/.env.example
 *       changelog/cli.md       ← <cli>/CHANGELOG.md
 *       changelog/sdk.md       ← <cli>/packages/sdk/CHANGELOG.md
 *       changelog/serve.md     ← <cli>/packages/server/CHANGELOG.md
 *       cli-help.json          ← 采集:<cli>/dist/tansr.mjs --help 与各子命令 --help(scripts/vendor/cli-help.mjs)
 *       sdk-index.d.ts         ← <cli>/packages/sdk/dist/index.d.ts
 *     构建物(dist/tansr.mjs · packages/sdk/dist/index.d.ts)缺省每次在 cli 仓就地重建(它们被 cli 仓 gitignore,
 *     不算改仓;`--no-build` 跳过)。两仓工作区须干净(tracked 文件零改动),source 才能指向真实提交。
 *
 *   node scripts/vendor/index.mjs --check
 *     逐文件 sha256 对 `contract/vendored.json`;任一缺席 / 不符 / 未登记即 exit 1。
 *
 * 登记形(契约 5,沿 tansr-api `src/util/vendored.json`):
 *   { "<文件名>": { "source": "tansr-api@<sha12>:openapi/openapi.json" | "tansr-cli@<sha12>:<路径>",
 *                    "revision": <int,内容变才 +1>, "sha256": "<hex>", "vendoredAt": "YYYY-MM-DD" } }
 *   内容逐字节不变的文件其登记项原样保留(source / revision / vendoredAt 都不动),脚本对同一输入幂等。
 *
 * 字节律:副本一律 LF、无 BOM、末行换行(sha256 取落盘文本)。`contract/openapi.public.json` 是本仓生成物
 * (scripts/gen/openapi-public.mjs),不在登记表内,--check 跳过它。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  isMainModule,
  jsonText,
  parseArgs,
  readJson,
  readTextIfExists,
  repoRootFrom,
  sha256Hex,
  toLf,
  today,
  writeLf,
} from '../lib/text.mjs';
import { CLI_BUNDLE_REL, collectCliHelp } from './cli-help.mjs';

export const VENDORED_FILE = 'vendored.json';
/** 生成物,不登记、不对表 */
export const GENERATED_IN_CONTRACT = new Set(['openapi.public.json']);

/** 登记表(键序 = 落盘序) */
export const VENDOR_TABLE = [
  { name: 'openapi.json', repo: 'api', path: 'openapi/openapi.json' },
  { name: 'serve.env.example', repo: 'cli', path: 'packages/server/.env.example' },
  { name: 'changelog/cli.md', repo: 'cli', path: 'CHANGELOG.md' },
  { name: 'changelog/sdk.md', repo: 'cli', path: 'packages/sdk/CHANGELOG.md' },
  { name: 'changelog/serve.md', repo: 'cli', path: 'packages/server/CHANGELOG.md' },
  { name: 'cli-help.json', repo: 'cli', path: CLI_BUNDLE_REL, collect: 'cli-help' },
  { name: 'sdk-index.d.ts', repo: 'cli', path: 'packages/sdk/dist/index.d.ts', build: 'sdk' },
];

const REPO_LABEL = { api: 'tansr-api', cli: 'tansr-cli' };

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function assertRepo(label, dir) {
  if (!dir || !existsSync(join(dir, '.git'))) {
    throw new Error(`--${label} 须指向 git 仓根(got ${JSON.stringify(dir)})`);
  }
  const dirty = git(dir, ['status', '--porcelain', '--untracked-files=no']);
  if (dirty !== '') {
    throw new Error(`${REPO_LABEL[label]} 工作区有未提交改动,source 无法指向真实提交;先提交或还原:\n${dirty}`);
  }
  const sha = git(dir, ['rev-parse', '--short=12', 'HEAD']);
  if (!/^[0-9a-f]{12}$/.test(sha)) throw new Error(`${REPO_LABEL[label]} rev-parse 异常:${sha}`);
  return sha;
}

function runBuild(cliRepo, what, log) {
  if (what === 'cli') {
    log(`[vendor] build cli bundle: node build/build.mjs --only-tansr (cwd ${cliRepo})`);
    execFileSync(process.execPath, ['build/build.mjs', '--only-tansr'], { cwd: cliRepo, stdio: 'inherit' });
  } else if (what === 'sdk') {
    log(`[vendor] build sdk dist: node packages/sdk/build.mjs (cwd ${cliRepo}/packages/sdk)`);
    execFileSync(process.execPath, ['build.mjs'], { cwd: join(cliRepo, 'packages', 'sdk'), stdio: 'inherit' });
  }
}

function listContractFiles(contractDir) {
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir)) {
      const p = join(dir, ent);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(contractDir, p).split('\\').join('/'));
    }
  };
  if (existsSync(contractDir)) walk(contractDir);
  return out.sort();
}

/**
 * 拷入。返回 { wrote: string[], unchanged: string[], vendored }。
 */
export function vendor({ root, apiRepo, cliRepo, build = true, log = console.log }) {
  const shas = { api: assertRepo('api', apiRepo), cli: assertRepo('cli', cliRepo) };
  const repos = { api: apiRepo, cli: cliRepo };
  const contractDir = join(root, 'contract');
  const vendoredPath = join(contractDir, VENDORED_FILE);
  const prevText = readTextIfExists(vendoredPath);
  const prev = prevText ? JSON.parse(prevText) : {};
  if ('source' in prev && typeof prev.source === 'string') throw new Error('vendored.json 为单记录旧形,须多文件 map 形');

  if (build) {
    runBuild(cliRepo, 'cli', log);
    runBuild(cliRepo, 'sdk', log);
  }

  const next = {};
  const wrote = [];
  const unchanged = [];
  const repaired = [];
  const date = today();
  for (const row of VENDOR_TABLE) {
    const repoDir = repos[row.repo];
    let text;
    if (row.collect === 'cli-help') {
      text = jsonText(collectCliHelp(cliRepo));
    } else {
      const src = join(repoDir, ...row.path.split('/'));
      const raw = readTextIfExists(src);
      if (raw === undefined) throw new Error(`上游文件缺席:${src}`);
      text = toLf(raw);
    }
    const localPath = join(contractDir, ...row.name.split('/'));
    const current = readTextIfExists(localPath);
    const entry = prev[row.name];
    const sha = sha256Hex(text);
    // 「内容变」以登记的 sha256 为准:上游内容与登记一致即 revision 不动;本地副本若被改坏则只修复文件,不算变。
    if (entry && entry.sha256 === sha) {
      if (current !== text) {
        writeLf(localPath, text);
        repaired.push(row.name);
      }
      next[row.name] = entry;
      unchanged.push(row.name);
      continue;
    }
    writeLf(localPath, text);
    next[row.name] = {
      source: `${REPO_LABEL[row.repo]}@${shas[row.repo]}:${row.path}`,
      revision: entry ? entry.revision + 1 : 0,
      sha256: sha,
      vendoredAt: date,
    };
    wrote.push(row.name);
  }
  const nextText = jsonText(next);
  if (nextText !== prevText) writeLf(vendoredPath, nextText);
  for (const n of wrote) log(`[vendor] wrote     contract/${n}  ${next[n].source}  revision=${next[n].revision}`);
  for (const n of unchanged) {
    const tag = repaired.includes(n) ? 'repaired ' : 'unchanged';
    log(`[vendor] ${tag} contract/${n}  ${next[n].source}  revision=${next[n].revision}`);
  }
  return { wrote, unchanged, repaired, vendored: next };
}

/**
 * 对表。返回 { ok: boolean, problems: string[] }。
 */
export function check({ root, log = console.log }) {
  const contractDir = join(root, 'contract');
  const vendoredPath = join(contractDir, VENDORED_FILE);
  const problems = [];
  if (!existsSync(vendoredPath)) {
    return { ok: false, problems: [`contract/${VENDORED_FILE} 缺席`] };
  }
  const vendored = readJson(vendoredPath);
  for (const [name, entry] of Object.entries(vendored)) {
    const text = readTextIfExists(join(contractDir, ...name.split('/')));
    if (text === undefined) {
      problems.push(`MISSING   contract/${name}`);
      log(`[vendor:check] MISSING   contract/${name}`);
      continue;
    }
    const got = sha256Hex(text);
    if (got !== entry.sha256) {
      problems.push(`MISMATCH  contract/${name}  expected ${entry.sha256} got ${got}`);
      log(`[vendor:check] MISMATCH  contract/${name}\n  expected ${entry.sha256}\n  got      ${got}`);
    } else {
      log(`[vendor:check] ok        contract/${name}  ${entry.source}  revision=${entry.revision}`);
    }
  }
  for (const rel of listContractFiles(contractDir)) {
    if (rel === VENDORED_FILE || GENERATED_IN_CONTRACT.has(rel)) continue;
    if (!(rel in vendored)) {
      problems.push(`UNLISTED  contract/${rel}`);
      log(`[vendor:check] UNLISTED  contract/${rel}(不在 vendored.json)`);
    }
  }
  return { ok: problems.length === 0, problems };
}

function usage() {
  console.error('用法:node scripts/vendor/index.mjs --api <apiRepo> --cli <cliRepo> [--no-build] | --check   [--root <docsRepo>]');
}

if (isMainModule(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = typeof args.root === 'string' ? args.root : repoRootFrom(import.meta.url);
  try {
    if (args.check) {
      const r = check({ root });
      if (!r.ok) {
        console.error(`[vendor:check] FAIL ${r.problems.length} 项:\n  ${r.problems.join('\n  ')}`);
        process.exit(1);
      }
      console.log('[vendor:check] ok(全部 sha256 对表一致)');
    } else if (typeof args.api === 'string' && typeof args.cli === 'string') {
      const r = vendor({ root, apiRepo: args.api, cliRepo: args.cli, build: args['no-build'] !== true });
      console.log(`[vendor] done  wrote=${r.wrote.length}  unchanged=${r.unchanged.length}`);
    } else {
      usage();
      process.exit(2);
    }
  } catch (err) {
    console.error(`[vendor] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
