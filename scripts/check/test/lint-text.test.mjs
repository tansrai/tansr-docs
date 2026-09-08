import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CODES, judgeFile, runLintText, scanBytes } from '../lint-text.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ds-lint-text-'));
  mkdirSync(join(root, 'src', 'a'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'x'), { recursive: true });
  return root;
}

test('lint-text 绿:LF 无 BOM 末行换行的文件 0 违反;二进制与 node_modules 不判', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a', 'ok.md'), '# 标题\n\n正文。\n');
    writeFileSync(join(root, 'scripts', 'ok.mjs'), 'export const x = 1;\n');
    writeFileSync(join(root, 'README.md'), '# 仓\n');
    writeFileSync(join(root, 'src', 'a', 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
    writeFileSync(join(root, 'src', 'a', 'bin.dat'), Buffer.from([0x41, 0x00, 0x0d, 0x0a]));
    writeFileSync(join(root, 'node_modules', 'x', 'bad.js'), 'crlf\r\n');
    const r = runLintText({ root });
    assert.equal(r.violations.length, 0, JSON.stringify(r.violations));
    assert.equal(r.summary.checked, 3);
    assert.equal(r.summary.skippedBinary, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lint-text 红:BOM / CRLF / 孤立 CR / U+FFFD / 无末行 LF 各自出码', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'bom.md'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('x\n')]));
    writeFileSync(join(root, 'src', 'crlf.md'), 'a\r\nb\r\n');
    writeFileSync(join(root, 'src', 'cr.md'), 'a\rb\n');
    writeFileSync(join(root, 'src', 'fffd.md'), 'bad \uFFFD char\n');
    writeFileSync(join(root, 'src', 'nonl.md'), 'no newline');
    const r = runLintText({ root });
    const byPath = Object.fromEntries(r.violations.map((v) => [v.path, v.code]));
    assert.equal(byPath['src/bom.md'], CODES.BOM);
    assert.equal(byPath['src/crlf.md'], CODES.CRLF);
    assert.equal(byPath['src/cr.md'], CODES.LONE_CR);
    assert.equal(byPath['src/fffd.md'], CODES.REPLACEMENT_CHAR);
    assert.equal(byPath['src/nonl.md'], CODES.NO_FINAL_NEWLINE);
    assert.equal(r.summary.violations, 5);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('judgeFile 纯函数:空文件 / 含 NUL 不判', () => {
  assert.deepEqual(judgeFile(scanBytes(Buffer.alloc(0))), []);
  assert.deepEqual(judgeFile(scanBytes(Buffer.from([0x00, 0x0d]))), []);
  assert.deepEqual(judgeFile(scanBytes(Buffer.from('ok\n'))), []);
});
