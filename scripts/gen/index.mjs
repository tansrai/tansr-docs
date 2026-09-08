/**
 * 生成物入口(空壳):`pnpm gen` / `pnpm gen --check`。
 * 生成器(错误码 / 公开 openapi / serve env / CLI 命令 / 发布说明)落地后本文件由其实现替换;
 * 落地前恒返 0,好让 `pnpm gate` 的 gen:check 一步可以先串起来。
 */
import process from 'node:process';

const check = process.argv.includes('--check');
console.log(`[gen] no generators yet${check ? ' (--check: nothing to compare)' : ''}`);
process.exit(0);
