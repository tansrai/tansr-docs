/** Starlight 在构建期注入的虚拟模块。本仓 Search 覆写要直接引用,补上 astro check 能看见的类型。 */
declare module 'virtual:starlight/project-context' {
  const project: { trailingSlash: 'always' | 'never' | 'ignore' };
  export default project;
}

declare module 'virtual:starlight/pagefind-config' {
  export const pagefindUserConfig: { ranking?: { metaWeights?: Record<string, number> } };
}
