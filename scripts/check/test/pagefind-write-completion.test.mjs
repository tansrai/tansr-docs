import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercise the installed, locked integration body. Only its Pagefind and fs
// dependencies are replaced, so a missing/ignored pnpm patch fails these tests.
async function integration(deps) {
  const entry = import.meta.resolve('@astrojs/starlight');
  let source = readFileSync(new URL('./integrations/pagefind.js', entry), 'utf8');
  const key = `__pagefindWrite_${randomUUID()}`;
  const pagefindImport = 'import * as pagefind from "pagefind";';
  assert.ok(source.includes(pagefindImport), 'review the integration if upstream imports change');
  source = source.replace(pagefindImport, `const pagefind = globalThis[${JSON.stringify(key)}].pagefind;`);
  source = source.replace('import { mkdir, writeFile } from "node:fs/promises";', `const { mkdir, writeFile } = globalThis[${JSON.stringify(key)}].fs;`);
  globalThis[key] = deps;
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return { run: module.starlightPagefind, dispose: () => { delete globalThis[key]; } };
}

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function fixture({ files = [{ path: 'pagefind-entry.json', content: new Uint8Array([123, 125]) }], errors = [], writeError } = {}) {
  const started = deferred();
  const release = deferred();
  const secondStarted = deferred();
  const secondRelease = deferred();
  const calls = [];
  let pending = 0;
  let writeCount = 0;
  const deps = {
    pagefind: {
      createIndex: async () => ({ errors: [], index: {
        addDirectory: async () => ({ errors: [], page_count: 1 }),
        getFiles: async () => { calls.push('getFiles'); return { errors, files }; },
        // Old upstream acknowledges a logical write before its background IO
        // finishes; close can then cut that IO short. This is the red control.
        writeFiles: async () => { calls.push('writeFiles'); pending++; started.resolve(); return { errors: [] }; },
      } }),
      close: async () => { calls.push(`close:${pending}`); },
    },
    fs: {
      mkdir: async () => { calls.push('mkdir'); },
      writeFile: async (path, content) => {
        calls.push(`write:${content.length}`);
        pending++;
        const second = ++writeCount === 2;
        (second ? secondStarted : started).resolve();
        try { await (second ? secondRelease : release).promise; if (writeError) throw writeError; }
        finally { pending--; calls.push('write:finished'); }
      },
    },
  };
  const logger = { fork: () => logger, info() {}, error() {} };
  return { deps, started, release, secondStarted, secondRelease, calls, options: { dir: pathToFileURL(resolve('fixture-output') + sep), logger } };
}

test('Pagefind output: build and backend close wait for actual Node write completion', async () => {
  const fx = fixture({ files: [
    { path: 'pagefind-entry.json', content: new Uint8Array([123, 125]) },
    { path: 'fragment/index.pf', content: new Uint8Array([1, 2, 3]) },
  ] });
  const hook = await integration(fx.deps);
  const run = hook.run(fx.options);
  let settled = false;
  run.then(() => { settled = true; }, () => { settled = true; });
  try {
    await fx.started.promise;
    await Promise.resolve();
    assert.equal(settled, false, 'build must remain pending while owned write is pending');
    assert.equal(fx.calls.some(c => c.startsWith('close:')), false, 'backend must not close before write completion');
    fx.release.resolve();
    await fx.secondStarted.promise;
    assert.equal(settled, false, 'the remaining file must also finish before build completes');
    assert.equal(fx.calls.some(c => c.startsWith('close:')), false);
    fx.secondRelease.resolve();
    await run;
    assert.deepEqual(fx.calls, ['getFiles', 'mkdir', 'write:2', 'write:finished', 'mkdir', 'write:3', 'write:finished', 'close:0']);
  } finally { fx.release.resolve(); fx.secondRelease.resolve(); await run.catch(() => {}); hook.dispose(); }
});

test('Pagefind output: getFiles errors fail the build without writing files', async () => {
  const fx = fixture({ errors: ['index fixture failed'] });
  const hook = await integration(fx.deps);
  try {
    await assert.rejects(hook.run(fx.options), e => e.cause?.message === 'Pagefind response contained errors.');
    assert.deepEqual(fx.calls, ['getFiles', 'close:0']);
  } finally { hook.dispose(); }
});

test('Pagefind output: a rejected write preserves its cause and closes only after completion', async () => {
  const failure = new Error('disk fixture failed');
  const fx = fixture({ writeError: failure });
  const hook = await integration(fx.deps);
  fx.release.resolve();
  try {
    await assert.rejects(hook.run(fx.options), e => e.cause === failure);
    assert.deepEqual(fx.calls, ['getFiles', 'mkdir', 'write:2', 'write:finished', 'close:0']);
  } finally { hook.dispose(); }
});

test('Pagefind output: a generated path outside the output directory fails before mkdir or write', async () => {
  const fx = fixture({ files: [{ path: '../escape.json', content: new Uint8Array() }] });
  const hook = await integration(fx.deps);
  try {
    await assert.rejects(hook.run(fx.options), e => /outside the output directory/.test(e.cause?.message));
    assert.deepEqual(fx.calls, ['getFiles', 'close:0']);
  } finally { hook.dispose(); }
});
