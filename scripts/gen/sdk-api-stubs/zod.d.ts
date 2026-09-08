/**
 * zod 3 类型骨架(仅供 scripts/gen/sdk-api.mjs 跑 typedoc 时解析 `contract/sdk-index.d.ts` 里的 `import { z, ZodIssue } from 'zod'`)。
 *
 * 为何要它:仓内 node_modules 的 zod 是 astro 带来的 4.x,而 SDK 的 d.ts 按 zod 3 形写(`ZodObject<Shape, UnknownKeys, Catchall, Output, Input>` 五参、
 * `ZodTypeAny`),对着 zod 4 解析会把全部 `z.infer<…>` 折成 `any`;不解析则打印 zod 内部形。本骨架只声明 d.ts 用到的构造与 `_output` / `_input` 推导,
 * 让 `z.infer<typeof Schema>` 得到真实输出形,且生成结果不随 node_modules 的 zod 版本漂移(确定性)。不是 zod 的运行时,不被任何代码 import。
 */

export declare namespace z {
  export type UnknownKeysParam = 'passthrough' | 'strict' | 'strip';

  export abstract class ZodType<Output = any, Def = any, Input = Output> {
    readonly _type: Output;
    readonly _output: Output;
    readonly _input: Input;
    readonly _def: Def;
  }
  export type ZodTypeAny = ZodType<any, any, any>;
  export type ZodRawShape = { [k: string]: ZodTypeAny };

  export type infer<T extends ZodType<any, any, any>> = T['_output'];
  export type input<T extends ZodType<any, any, any>> = T['_input'];
  export type output<T extends ZodType<any, any, any>> = T['_output'];

  type optionalKeys<T extends object> = { [k in keyof T]: undefined extends T[k] ? k : never }[keyof T];
  type requiredKeys<T extends object> = { [k in keyof T]: undefined extends T[k] ? never : k }[keyof T];
  type addQuestionMarks<T extends object> = { [k in requiredKeys<T>]: T[k] } & { [k in optionalKeys<T>]?: T[k] };
  type flatten<T> = { [k in keyof T]: T[k] };
  type baseObjectOutputType<Shape extends ZodRawShape> = { [k in keyof Shape]: Shape[k]['_output'] };
  type baseObjectInputType<Shape extends ZodRawShape> = { [k in keyof Shape]: Shape[k]['_input'] };
  type CatchallOutput<T extends ZodTypeAny> = ZodTypeAny extends T ? unknown : { [k: string]: T['_output'] };
  type CatchallInput<T extends ZodTypeAny> = ZodTypeAny extends T ? unknown : { [k: string]: T['_input'] };
  type PassthroughType<T extends UnknownKeysParam> = T extends 'passthrough' ? { [k: string]: unknown } : unknown;

  export type objectOutputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = flatten<
    addQuestionMarks<baseObjectOutputType<Shape>>
  > &
    CatchallOutput<Catchall> &
    PassthroughType<UnknownKeys>;
  export type objectInputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = flatten<
    addQuestionMarks<baseObjectInputType<Shape>>
  > &
    CatchallInput<Catchall> &
    PassthroughType<UnknownKeys>;

  export class ZodString extends ZodType<string, any, string> {}
  export class ZodNumber extends ZodType<number, any, number> {}
  export class ZodBoolean extends ZodType<boolean, any, boolean> {}
  export class ZodUnknown extends ZodType<unknown, any, unknown> {}
  export class ZodNever extends ZodType<never, any, never> {}
  export class ZodLiteral<T> extends ZodType<T, any, T> {}
  export class ZodEnum<T extends [string, ...string[]]> extends ZodType<T[number], any, T[number]> {}
  export class ZodOptional<T extends ZodTypeAny> extends ZodType<T['_output'] | undefined, any, T['_input'] | undefined> {}
  export class ZodNullable<T extends ZodTypeAny> extends ZodType<T['_output'] | null, any, T['_input'] | null> {}
  export class ZodDefault<T extends ZodTypeAny> extends ZodType<Exclude<T['_output'], undefined>, any, T['_input'] | undefined> {}
  export class ZodArray<T extends ZodTypeAny, Cardinality extends 'many' | 'atleastone' = 'many'> extends ZodType<
    Cardinality extends 'atleastone' ? [T['_output'], ...T['_output'][]] : T['_output'][],
    any,
    Cardinality extends 'atleastone' ? [T['_input'], ...T['_input'][]] : T['_input'][]
  > {}
  export class ZodObject<
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = objectOutputType<T, Catchall, UnknownKeys>,
    Input = objectInputType<T, Catchall, UnknownKeys>,
  > extends ZodType<Output, any, Input> {
    readonly shape: T;
  }
  export class ZodRecord<Key extends ZodType<string | number | symbol, any, any> = ZodString, Value extends ZodTypeAny = ZodTypeAny> extends ZodType<
    Record<Key['_output'], Value['_output']>,
    any,
    Record<Key['_input'], Value['_input']>
  > {}
  export class ZodUnion<T extends readonly [ZodTypeAny, ...ZodTypeAny[]]> extends ZodType<T[number]['_output'], any, T[number]['_input']> {}
  export class ZodDiscriminatedUnion<Discriminator extends string, Options extends readonly ZodTypeAny[]> extends ZodType<
    Options[number]['_output'],
    any,
    Options[number]['_input']
  > {}
  export class ZodIntersection<T extends ZodTypeAny, U extends ZodTypeAny> extends ZodType<T['_output'] & U['_output'], any, T['_input'] & U['_input']> {}
  type OutputTypeOfTuple<T extends readonly ZodTypeAny[]> = { [k in keyof T]: T[k] extends ZodTypeAny ? T[k]['_output'] : never };
  type InputTypeOfTuple<T extends readonly ZodTypeAny[]> = { [k in keyof T]: T[k] extends ZodTypeAny ? T[k]['_input'] : never };
  export class ZodTuple<T extends readonly ZodTypeAny[] = [ZodTypeAny, ...ZodTypeAny[]], Rest extends ZodTypeAny | null = null> extends ZodType<
    Rest extends ZodTypeAny ? [...OutputTypeOfTuple<T>, ...Rest['_output'][]] : OutputTypeOfTuple<T>,
    any,
    Rest extends ZodTypeAny ? [...InputTypeOfTuple<T>, ...Rest['_input'][]] : InputTypeOfTuple<T>
  > {}
  export class ZodEffects<T extends ZodTypeAny, Output = output<T>, Input = input<T>> extends ZodType<Output, any, Input> {}

  export interface ZodIssue {
    code: string;
    path: (string | number)[];
    message: string;
  }
  export class ZodError<T = any> extends Error {
    issues: ZodIssue[];
  }
}

export type ZodIssue = z.ZodIssue;
export type ZodError<T = any> = z.ZodError<T>;
export type ZodTypeAny = z.ZodTypeAny;
