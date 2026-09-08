/**
 * vendored 契约入口(空壳):`pnpm vendor --api <repo> --cli <repo>` / `pnpm vendor --check`。
 * 拷入与 sha256 对表的实现落地后本文件由其替换;落地前 `--check` 返 0(无登记即无可对表),
 * 非 `--check` 调用提示尚未实现并返 2,避免误以为已拷入。
 */
import process from 'node:process';

const check = process.argv.includes('--check');
if (check) {
  console.log('[vendor] no vendored.json yet (--check: nothing to compare)');
  process.exit(0);
}
console.error('[vendor] not implemented yet: contract/ copy-in lands with the vendoring script');
process.exit(2);
