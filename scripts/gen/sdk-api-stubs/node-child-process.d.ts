/** `node:child_process` 类型骨架(仅供 sdk-api 生成器解析 d.ts 顶部 import;`typeof spawn` 只需一个稳定签名)。 */
export declare class ChildProcess {}
export declare function spawn(command: string, args?: readonly string[], options?: object): ChildProcess;
