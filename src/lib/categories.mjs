/**
 * 11 类信息架构的单一事实源:astro.config.mjs(侧栏)与首页 / 帮助中心组件(卡片)共用。
 * 顺序即侧栏与卡片网格顺序;`zone` 标注该类属开发者文档区还是帮助中心区。
 */
import { existsSync } from 'node:fs';

/** vendored 公开 openapi 子集;在场则挂 starlight-openapi 到 /api/ */
export const OPENAPI_PUBLIC = 'contract/openapi.public.json';

/** @param {URL | string} root 仓根(astro.config 用 import.meta.url;组件用 process.cwd()) */
export function hasOpenApi(root) {
  return existsSync(new URL(OPENAPI_PUBLIC, root));
}

/** 根语言 zh-CN(无前缀);其余语言键 = 路径前缀(`/en/`) */
export const ROOT_LOCALE = Object.freeze({ label: '简体中文', lang: 'zh-CN' });
export const EXTRA_LOCALES = Object.freeze({
  en: { label: 'English', lang: 'en' },
});

/**
 * @typedef {object} Category
 * @property {string} directory  src/content/docs/ 下目录名,也是路由前缀
 * @property {'docs' | 'support'} zone
 * @property {string} label       zh-CN 标签
 * @property {string} en          en 标签
 * @property {string} description zh-CN 卡片一句话
 * @property {string} icon        Starlight 内建图标名
 */

/** @type {readonly Category[]} */
export const CATEGORIES = Object.freeze([
  { directory: 'getting-started', zone: 'docs', label: '快速开始', en: 'Getting started', description: '5 分钟跑通:SDK、CLI、会话服务、Android 与 iOS 各一篇。', icon: 'rocket' },
  { directory: 'sdk', zone: 'docs', label: 'TS / Node SDK', en: 'TypeScript SDK', description: '安装、会话与事件流、检查点、平台装配、错误处理。', icon: 'seti:typescript' },
  { directory: 'serve', zone: 'docs', label: '会话服务 @tansr/serve', en: 'Session service (@tansr/serve)', description: '自托管部署、鉴权、v2 接口、webhook、保留期与环境变量。', icon: 'server' },
  { directory: 'cli', zone: 'docs', label: 'CLI 手册', en: 'CLI manual', description: '安装、登录、会话、doctor、设置与命令参考。', icon: 'laptop' },
  { directory: 'android', zone: 'docs', label: 'Android SDK', en: 'Android SDK', description: '接入、事件归约、错误呈现与离线。', icon: 'mobile-android' },
  { directory: 'ios', zone: 'docs', label: 'iOS SDK', en: 'iOS SDK', description: '接入、事件归约、错误呈现与离线。', icon: 'apple' },
  { directory: 'api', zone: 'docs', label: 'REST 参考', en: 'REST reference', description: '公开 REST 接口参考(/v1 · /t1 · /healthz · /readyz)。', icon: 'open-book' },
  { directory: 'errors', zone: 'docs', label: '错误码与排障', en: 'Errors & troubleshooting', description: '错误码表(HTTP 状态、可重试、说明)与排障文章。', icon: 'warning' },
  { directory: 'security', zone: 'docs', label: '安全与隐私', en: 'Security & privacy', description: '出网白名单、凭据、数据留存与密钥轮换。', icon: 'padlock' },
  { directory: 'releases', zone: 'docs', label: '发布说明', en: 'Release notes', description: 'CLI、SDK 与会话服务三包的版本变更。', icon: 'notes' },
  { directory: 'support', zone: 'support', label: '帮助中心', en: 'Help center', description: '账号、密钥、套餐与计费;常见问题排障;联系支持。', icon: 'question-circle' },
]);
