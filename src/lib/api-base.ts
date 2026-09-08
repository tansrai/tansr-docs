/**
 * api 基址(Astro 公开 env `PUBLIC_TANSR_API_BASE`,缺省 `https://api.tansr.com`)。
 * 供 Feedback.astro / ContactForm.astro 的浏览器脚本 import;构建期由 Vite 替换 import.meta.env,
 * 本地联调 `.env` 写 `PUBLIC_TANSR_API_BASE=http://127.0.0.1:<port>`(见 .env.example)。
 */
import { DEFAULT_API_BASE, normalizeApiBase } from './docs-api.mjs';

export const API_BASE: string = normalizeApiBase(import.meta.env.PUBLIC_TANSR_API_BASE, DEFAULT_API_BASE);
