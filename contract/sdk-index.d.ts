/*!
 * @tansr/sdk — MIT License.
 * Bundled artifact: compiled code and types from the tansr internal workspace
 * packages (@tansr/kernel, @tansr/providers, @tansr/protocol, @tansr/i18n) are
 * inlined into this file and distributed under the MIT license as part of
 * @tansr/sdk. Third-party runtime dependencies (@vscode/ripgrep, undici, zod, zod-to-json-schema)
 * are resolved from npm as regular / optional dependencies; any third-party
 * code compiled into this file is listed in the NOTICE file shipped alongside.
 */
import { z, ZodIssue } from 'zod';
import { Writable, Readable } from 'node:stream';
import { fetch as fetch$1, Dispatcher } from 'undici';
import { spawn } from 'node:child_process';

/**
 * IR(Internal Representation)消息模型
 *
 * 双协议网关与内核共用的中间表示。设计要点:
 * - 内容块 + 类型化流事件基底;
 * - opaque thinking 密文透传对策:reasoning 块保留 provider 原样载荷;
 * - visibility 显式化,不用难组合的布尔标志位。
 *
 * 铁律:providers 依赖本包类型,本包不得反向依赖 providers/kernel。
 */

/** 工具结果内容项(可多模态) */
declare const IRToolContentSchema: z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
    t: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "text";
    text: string;
}, {
    t: "text";
    text: string;
}>, z.ZodObject<{
    t: z.ZodLiteral<"image">;
    mime: z.ZodString;
    data: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "image";
    mime: string;
    data: string;
}, {
    t: "image";
    mime: string;
    data: string;
}>]>;
/** 工具结果内容项:文本或图片(IRToolContentSchema 推导)。 */
type IRToolContent = z.infer<typeof IRToolContentSchema>;
/**
 * 内容块。`thinking` 携带可选 `signature`(Anthropic 多轮需原样回传);
 * `opaque` 用于无法明文还原、必须整体透传的推理载荷(OpenAI Responses reasoning item、
 * DeepSeek/Kimi 的 provider 私有块)——部分厂商要求原样回传 thinking 块,否则 400。
 */
declare const IRBlockSchema: z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
    t: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "text";
    text: string;
}, {
    t: "text";
    text: string;
}>, z.ZodObject<{
    t: z.ZodLiteral<"thinking">;
    text: z.ZodString;
    signature: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    t: "thinking";
    text: string;
    signature?: string | undefined;
}, {
    t: "thinking";
    text: string;
    signature?: string | undefined;
}>, z.ZodObject<{
    t: z.ZodLiteral<"opaque">;
    /** 归属的 provider/协议,回传时据此判断能否透传 */
    provider: z.ZodString;
    /** provider 原样载荷,内核不得解读或改写 */
    payload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    t: "opaque";
    provider: string;
    payload?: unknown;
}, {
    t: "opaque";
    provider: string;
    payload?: unknown;
}>, z.ZodObject<{
    t: z.ZodLiteral<"tool_call">;
    id: z.ZodString;
    name: z.ZodString;
    args: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    t: "tool_call";
    id: string;
    name: string;
    args?: unknown;
}, {
    t: "tool_call";
    id: string;
    name: string;
    args?: unknown;
}>, z.ZodObject<{
    t: z.ZodLiteral<"tool_result">;
    callId: z.ZodString;
    content: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
        t: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "text";
        text: string;
    }, {
        t: "text";
        text: string;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"image">;
        mime: z.ZodString;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "image";
        mime: string;
        data: string;
    }, {
        t: "image";
        mime: string;
        data: string;
    }>]>, "many">;
    isError: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    t: "tool_result";
    callId: string;
    content: ({
        t: "text";
        text: string;
    } | {
        t: "image";
        mime: string;
        data: string;
    })[];
    isError?: boolean | undefined;
}, {
    t: "tool_result";
    callId: string;
    content: ({
        t: "text";
        text: string;
    } | {
        t: "image";
        mime: string;
        data: string;
    })[];
    isError?: boolean | undefined;
}>, z.ZodObject<{
    t: z.ZodLiteral<"image">;
    mime: z.ZodString;
    data: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "image";
    mime: string;
    data: string;
}, {
    t: "image";
    mime: string;
    data: string;
}>]>;
/** 消息内容块:text / thinking / opaque / tool_call / tool_result / image(IRBlockSchema 推导)。 */
type IRBlock = z.infer<typeof IRBlockSchema>;
/** 消息角色词表:user / assistant(system 走 IRRequest.system 分段,不是消息角色)。 */
declare const IRRoleSchema: z.ZodEnum<["user", "assistant"]>;
/** 消息角色(IRRoleSchema 推导)。 */
type IRRole = z.infer<typeof IRRoleSchema>;
declare const IRMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "assistant"]>;
    blocks: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
        t: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "text";
        text: string;
    }, {
        t: "text";
        text: string;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"thinking">;
        text: z.ZodString;
        signature: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    }, {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"opaque">;
        /** 归属的 provider/协议,回传时据此判断能否透传 */
        provider: z.ZodString;
        /** provider 原样载荷,内核不得解读或改写 */
        payload: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        t: "opaque";
        provider: string;
        payload?: unknown;
    }, {
        t: "opaque";
        provider: string;
        payload?: unknown;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"tool_call">;
        id: z.ZodString;
        name: z.ZodString;
        args: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    }, {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"tool_result">;
        callId: z.ZodString;
        content: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
            t: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "text";
            text: string;
        }, {
            t: "text";
            text: string;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"image">;
            mime: z.ZodString;
            data: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "image";
            mime: string;
            data: string;
        }, {
            t: "image";
            mime: string;
            data: string;
        }>]>, "many">;
        isError: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    }, {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"image">;
        mime: z.ZodString;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "image";
        mime: string;
        data: string;
    }, {
        t: "image";
        mime: string;
        data: string;
    }>]>, "many">;
    /** 结构化元数据(contract-v0.15,RFC-CTX12-4;语义见 IRMessageMetaSchema) */
    meta: z.ZodOptional<z.ZodObject<{
        /**
         * 消息种类标记。首值 'compaction_summary' = 压缩摘要消息(防碰撞
         * 文本哨兵的结构化替代);候选扩值 'pinned'/'synthetic' 随
         * 对应消费方另行契约评审(先冻结已验证形态)。
         */
        kind: z.ZodOptional<z.ZodEnum<["compaction_summary"]>>;
        /** 产生本消息的压缩执行 id(RFC-CTX12-2 compactionId 同源;审计链互指) */
        compactionId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind?: "compaction_summary" | undefined;
        compactionId?: string | undefined;
    }, {
        kind?: "compaction_summary" | undefined;
        compactionId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    role: "user" | "assistant";
    blocks: ({
        t: "text";
        text: string;
    } | {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    } | {
        t: "opaque";
        provider: string;
        payload?: unknown;
    } | {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    } | {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    } | {
        t: "image";
        mime: string;
        data: string;
    })[];
    meta?: {
        kind?: "compaction_summary" | undefined;
        compactionId?: string | undefined;
    } | undefined;
}, {
    role: "user" | "assistant";
    blocks: ({
        t: "text";
        text: string;
    } | {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    } | {
        t: "opaque";
        provider: string;
        payload?: unknown;
    } | {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    } | {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    } | {
        t: "image";
        mime: string;
        data: string;
    })[];
    meta?: {
        kind?: "compaction_summary" | undefined;
        compactionId?: string | undefined;
    } | undefined;
}>;
/** IR 消息:角色 + 内容块数组 + 可选结构化元数据(IRMessageSchema 推导)。 */
type IRMessage = z.infer<typeof IRMessageSchema>;
/** 系统提示分段:稳定前缀在前,便于两家 provider 的缓存机制利用 */
declare const IRSystemSegmentSchema: z.ZodObject<{
    text: z.ZodString;
    /** 缓存断点提示——忽略方无害 */
    cacheable: z.ZodOptional<z.ZodBoolean>;
    /**
     * 段语义标签(contract-v0.1):'base'/'tools'/'env'/'memory' 等,
     * 供上下文压缩按语义识别可替换段;消费方忽略无害。
     */
    label: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    cacheable?: boolean | undefined;
    label?: string | undefined;
}, {
    text: string;
    cacheable?: boolean | undefined;
    label?: string | undefined;
}>;
/** 系统提示分段(IRSystemSegmentSchema 推导)。 */
type IRSystemSegment = z.infer<typeof IRSystemSegmentSchema>;
/** 工具定义:内部统一 JSON Schema(各协议在适配器内映射到各自字段) */
declare const IRToolDefSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}, {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}>;
/** 工具定义(IRToolDefSchema 推导)。 */
type IRToolDef = z.infer<typeof IRToolDefSchema>;
/** 已解析的模型定位:provider id + 该 provider 下的具体模型名(别名已解析)。 */
declare const ResolvedModelSchema: z.ZodObject<{
    /** provider registry 内的 id,如 "anthropic" / "aliyun-maas" */
    provider: z.ZodString;
    /** 该 provider 下的具体模型名(已解析别名后) */
    model: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provider: string;
    model: string;
}, {
    provider: string;
    model: string;
}>;
/** 已解析的模型定位(ResolvedModelSchema 推导)。 */
type ResolvedModel = z.infer<typeof ResolvedModelSchema>;
/** 一次模型调用的完整请求:系统分段、消息、工具定义、目标模型与采样 / 思考 / 缓存控制位。 */
declare const IRRequestSchema: z.ZodObject<{
    system: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        /** 缓存断点提示——忽略方无害 */
        cacheable: z.ZodOptional<z.ZodBoolean>;
        /**
         * 段语义标签(contract-v0.1):'base'/'tools'/'env'/'memory' 等,
         * 供上下文压缩按语义识别可替换段;消费方忽略无害。
         */
        label: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        cacheable?: boolean | undefined;
        label?: string | undefined;
    }, {
        text: string;
        cacheable?: boolean | undefined;
        label?: string | undefined;
    }>, "many">;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        blocks: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
            t: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "text";
            text: string;
        }, {
            t: "text";
            text: string;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"thinking">;
            text: z.ZodString;
            signature: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        }, {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"opaque">;
            /** 归属的 provider/协议,回传时据此判断能否透传 */
            provider: z.ZodString;
            /** provider 原样载荷,内核不得解读或改写 */
            payload: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            t: "opaque";
            provider: string;
            payload?: unknown;
        }, {
            t: "opaque";
            provider: string;
            payload?: unknown;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"tool_call">;
            id: z.ZodString;
            name: z.ZodString;
            args: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        }, {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"tool_result">;
            callId: z.ZodString;
            content: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
                t: z.ZodLiteral<"text">;
                text: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                t: "text";
                text: string;
            }, {
                t: "text";
                text: string;
            }>, z.ZodObject<{
                t: z.ZodLiteral<"image">;
                mime: z.ZodString;
                data: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                t: "image";
                mime: string;
                data: string;
            }, {
                t: "image";
                mime: string;
                data: string;
            }>]>, "many">;
            isError: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        }, {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"image">;
            mime: z.ZodString;
            data: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "image";
            mime: string;
            data: string;
        }, {
            t: "image";
            mime: string;
            data: string;
        }>]>, "many">;
        /** 结构化元数据(contract-v0.15,RFC-CTX12-4;语义见 IRMessageMetaSchema) */
        meta: z.ZodOptional<z.ZodObject<{
            /**
             * 消息种类标记。首值 'compaction_summary' = 压缩摘要消息(防碰撞
             * 文本哨兵的结构化替代);候选扩值 'pinned'/'synthetic' 随
             * 对应消费方另行契约评审(先冻结已验证形态)。
             */
            kind: z.ZodOptional<z.ZodEnum<["compaction_summary"]>>;
            /** 产生本消息的压缩执行 id(RFC-CTX12-2 compactionId 同源;审计链互指) */
            compactionId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        }, {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }, {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }>, "many">;
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }, {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>, "many">;
    model: z.ZodObject<{
        /** provider registry 内的 id,如 "anthropic" / "aliyun-maas" */
        provider: z.ZodString;
        /** 该 provider 下的具体模型名(已解析别名后) */
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        model: string;
    }, {
        provider: string;
        model: string;
    }>;
    maxTokens: z.ZodNumber;
    temperature: z.ZodOptional<z.ZodNumber>;
    /**
     * thinking 能力位控制;适配器按 provider capability 改写。
     * `off` 位 = 显式思考关断(fast 形态载体)——
     * 与「缺席」语义不同:缺席 = 上游缺省(openai 兼容面思考模型缺省仍开思考,
     * UCloud 实证),off = 适配器按方言显式关(twp → params.reasoning='off';
     * openai 直连 → enable_thinking:false;anthropic → 不发 thinking 参数)。
     * off 在场时 budget 忽略。
     */
    thinking: z.ZodOptional<z.ZodObject<{
        budget: z.ZodOptional<z.ZodNumber>;
        off: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        budget?: number | undefined;
        off?: boolean | undefined;
    }, {
        budget?: number | undefined;
        off?: boolean | undefined;
    }>>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /**
     * 请求级缓存写抑制(contract-v0.8):true 时显式缓存适配器
     * 不在消息尾落 cache_control 断点(system/工具面断点不受影响)。签发方为
     * 一次性辅助请求(上下文压缩/标题生成)——其消息尾不会被复读,
     * 写缓存纯付费无收益。implicit/ignored 缓存模式的适配器忽略本键。
     */
    skipCacheWrite: z.ZodOptional<z.ZodBoolean>;
    /**
     * 端侧预估的 prompt 侧 token 总量(贴窗防御;加法可选)。
     * 语义:请求面(system+messages+tools)装配定格后、发出前的估算值,
     * 整数 ≥1(向上取整;api TwpParamsSchema.promptTokensEstimate 同下限)。
     * 消费方 = twp 适配器(落 params.promptTokensEstimate,网关侧贴窗拦截,
     * 恒不送上游);其余协议适配器忽略。缺席 = 端侧无估算可用(压缩与窗口
     * 均未接线),服务端仅既有输出钳制,行为零变化。
     */
    promptTokensEstimate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    model: {
        provider: string;
        model: string;
    };
    system: {
        text: string;
        cacheable?: boolean | undefined;
        label?: string | undefined;
    }[];
    messages: {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }[];
    tools: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }[];
    maxTokens: number;
    thinking?: {
        budget?: number | undefined;
        off?: boolean | undefined;
    } | undefined;
    temperature?: number | undefined;
    stopSequences?: string[] | undefined;
    skipCacheWrite?: boolean | undefined;
    promptTokensEstimate?: number | undefined;
}, {
    model: {
        provider: string;
        model: string;
    };
    system: {
        text: string;
        cacheable?: boolean | undefined;
        label?: string | undefined;
    }[];
    messages: {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }[];
    tools: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }[];
    maxTokens: number;
    thinking?: {
        budget?: number | undefined;
        off?: boolean | undefined;
    } | undefined;
    temperature?: number | undefined;
    stopSequences?: string[] | undefined;
    skipCacheWrite?: boolean | undefined;
    promptTokensEstimate?: number | undefined;
}>;
/** 模型调用请求(IRRequestSchema 推导)。 */
type IRRequest = z.infer<typeof IRRequestSchema>;
/** 五路用量归一化(input/output + 缓存读/写细分 + 推理输出)。
 *  inputTokens 为 exclusive 口径(规范语义,见字段注释)。 */
declare const IRUsageSchema: z.ZodObject<{
    /**
     * 主输入计量,**exclusive 口径**(规范语义,contract-v0.15 RFC-CTX12-5
     * 会签):不含 cacheReadInputTokens 与 cacheCreationInputTokens——三路
     * 相加 = 请求输入总量。适配器出口恒为本口径:inclusive 端点(OpenAI 系
     * prompt_tokens,cached ⊆ prompt)在适配器内减法归一,包含关系以 compat
     * 实录核证(见 providers openai/wire.ts exclusiveInputTokens
     * 注释)。消费方(上下文账本/CostTracker/状态栏)三路直加,不得再做
     * inclusive 换算(防双重矫正)。限界注记:端点的缓存写入量不可见时
     * (如 OpenAI Chat 协议无 cache_write 字段),写入量仍含在本键内
     * (cacheCreation 缺席,三路总量不失真)。
     */
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    cacheReadInputTokens: z.ZodOptional<z.ZodNumber>;
    cacheCreationInputTokens: z.ZodOptional<z.ZodNumber>;
    reasoningOutputTokens: z.ZodOptional<z.ZodNumber>;
    /**
     * 缓存删除量(contract-v0.4;cached microcompact):
     * provider 报告的 cache_deleted_input_tokens——服务端缓存段被逐出/失效的
     * 通知量,**非计费维度**(cost-tracker 不入账),上下文账本(context
     * ledger)以此校正窗口水位。观测到该字段的适配器填入;缺省不落键。
     */
    cacheDeletedInputTokens: z.ZodOptional<z.ZodNumber>;
    /**
     * 长尾计量维度桶(CW8 B3 契约 RFC 会签、B7 落地;纯增量可选键,包络 v
     * 不 bump——v0.4 cacheDeletedInputTokens 先例)。键词表与服务端维度
     * 注册表同源(twp 帧 dims 直透):计费长尾排他桶(cache_w_5m/1h、
     * reasoning_out、多模态等)+ `obs_` 前缀观测位(不参与计费,呈现冠
     * 「(观测)」);值为非负整数量(token/次数),非零桶才携带。恒不含
     * 四主键 in/out/cache_r/cache_w 的语义重复(双源漂移防御,服务端
     * schema 拒;适配器入站防御性剔除)。与 reasoningOutputTokens 的关系:
     * 后者是既有专位(v0.x 兼容),gemini 独立计费的 reasoning_out 桶两处
     * 并存时值恒相等(适配器同源填写)。
     */
    dims: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    /**
     * 缓存净省费(CW8 B3 RFC,裁决 16;DECIMAL 串,= readSaved −
     * writePremium,**可为负**——写溢超读省的会话如实呈负,防「只报喜」)。
     * twp 帧 saved 直透,≠0 才携带(缺席 =「无省费故事可讲」,端侧整行
     * 不出);恒服务端权威——本地估算径(server-cost 缺席时)不得拟造本键
     * (恒不猜纪律)。三分量明细(readSaved/writePremium/netSaved)走读面,
     * 不进本键。
     */
    saved: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number | undefined;
    cacheCreationInputTokens?: number | undefined;
    reasoningOutputTokens?: number | undefined;
    cacheDeletedInputTokens?: number | undefined;
    dims?: Record<string, number> | undefined;
    saved?: string | undefined;
}, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number | undefined;
    cacheCreationInputTokens?: number | undefined;
    reasoningOutputTokens?: number | undefined;
    cacheDeletedInputTokens?: number | undefined;
    dims?: Record<string, number> | undefined;
    saved?: string | undefined;
}>;
/** 归一化用量(IRUsageSchema 推导)。 */
type IRUsage = z.infer<typeof IRUsageSchema>;
/**
 * 归一化错误类别。
 * policy_denied:平台策略/账务拒绝(余额/配额/内容
 * 安全/出网/许可证/围栏/价格护栏等用户可行动族)——fail-fast 零重试,
 * 与 invalid_request(请求本身不合法)语义分离;原始码与 detail 经错误
 * 文案(`code: message`)与 twp onPlatformError 旁路直达渲染层。
 * 后增两类(contract 加法演进):
 * - connect:连接建立失败/连接超时(本端建连闸、网关 upstream_connect/
 *   ttfb 归一码)——与 network(本地毫秒级失败)同路由「耐心档」重试,
 *   分列是为观测与文案区分「等墙」与「本机网络故障」两种病灶;
 * - stream_interrupted:已收到部分响应后断流(idle 闸、上游中途掐流、
 *   无 message_stop 收尾)——常规档重试,呈现面可如实说「响应被截断」。
 * 消费方(重试路由/呈现)对枚举外值须按 recoverable 兜底,不做穷举断言。
 */
declare const IRErrorKindSchema: z.ZodEnum<["rate_limited", "context_overflow", "auth", "server", "network", "connect", "stream_interrupted", "invalid_request", "policy_denied"]>;
/** 归一化错误类别(IRErrorKindSchema 推导)。 */
type IRErrorKind = z.infer<typeof IRErrorKindSchema>;
/**
 * 模型侧流事件,与内核 msg.* 事件同构。
 * 适配器把各协议 SSE/delta 解析为本联合;内核只消费本联合。
 */
declare const IRStreamEventSchema: z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
    t: z.ZodLiteral<"message_start">;
    model: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "message_start";
    model: string;
}, {
    t: "message_start";
    model: string;
}>, z.ZodObject<{
    t: z.ZodLiteral<"block_start">;
    index: z.ZodNumber;
    block: z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
        t: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "text";
        text: string;
    }, {
        t: "text";
        text: string;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"thinking">;
        text: z.ZodString;
        signature: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    }, {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"opaque">;
        /** 归属的 provider/协议,回传时据此判断能否透传 */
        provider: z.ZodString;
        /** provider 原样载荷,内核不得解读或改写 */
        payload: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        t: "opaque";
        provider: string;
        payload?: unknown;
    }, {
        t: "opaque";
        provider: string;
        payload?: unknown;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"tool_call">;
        id: z.ZodString;
        name: z.ZodString;
        args: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    }, {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"tool_result">;
        callId: z.ZodString;
        content: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
            t: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "text";
            text: string;
        }, {
            t: "text";
            text: string;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"image">;
            mime: z.ZodString;
            data: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "image";
            mime: string;
            data: string;
        }, {
            t: "image";
            mime: string;
            data: string;
        }>]>, "many">;
        isError: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    }, {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    }>, z.ZodObject<{
        t: z.ZodLiteral<"image">;
        mime: z.ZodString;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        t: "image";
        mime: string;
        data: string;
    }, {
        t: "image";
        mime: string;
        data: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    t: "block_start";
    index: number;
    block: {
        t: "text";
        text: string;
    } | {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    } | {
        t: "opaque";
        provider: string;
        payload?: unknown;
    } | {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    } | {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    } | {
        t: "image";
        mime: string;
        data: string;
    };
}, {
    t: "block_start";
    index: number;
    block: {
        t: "text";
        text: string;
    } | {
        t: "thinking";
        text: string;
        signature?: string | undefined;
    } | {
        t: "opaque";
        provider: string;
        payload?: unknown;
    } | {
        t: "tool_call";
        id: string;
        name: string;
        args?: unknown;
    } | {
        t: "tool_result";
        callId: string;
        content: ({
            t: "text";
            text: string;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        isError?: boolean | undefined;
    } | {
        t: "image";
        mime: string;
        data: string;
    };
}>, z.ZodObject<{
    t: z.ZodLiteral<"text_delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "text_delta";
    text: string;
    index: number;
}, {
    t: "text_delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    t: z.ZodLiteral<"thinking_delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "thinking_delta";
    text: string;
    index: number;
}, {
    t: "thinking_delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    t: z.ZodLiteral<"signature_delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "signature_delta";
    text: string;
    index: number;
}, {
    t: "signature_delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    t: z.ZodLiteral<"tool_args_delta">;
    index: z.ZodNumber;
    json: z.ZodString;
}, "strip", z.ZodTypeAny, {
    t: "tool_args_delta";
    index: number;
    json: string;
}, {
    t: "tool_args_delta";
    index: number;
    json: string;
}>, z.ZodObject<{
    t: z.ZodLiteral<"block_stop">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    t: "block_stop";
    index: number;
}, {
    t: "block_stop";
    index: number;
}>, z.ZodObject<{
    t: z.ZodLiteral<"message_stop">;
    /**
     * 归一化 stop 原因。'unknown' 为文档化取值,X3-2a P-2 起语义收窄:
     * **仅限「协议级语义终止帧缺席」(物理断流)的容错收尾留痕**
     * (现签发点:twp/openai-responses 的 finish() 与 responses 的
     * [DONE]-无-completed 分支);kernel 查询环按「无 message_stop」同律
     * 消费为可恢复错误(run-query consumeModelStream),半截产物不入史。
     * 终止帧在场、仅 stop 元数据缺失的形态(anthropic message_stop 无
     * message_delta / openai chat [DONE] 无 finish_reason)响应已完整,
     * 适配器兜底 'end_turn',不得用 'unknown'(会被当截断误重试)。
     */
    stopReason: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        /**
         * 主输入计量,**exclusive 口径**(规范语义,contract-v0.15 RFC-CTX12-5
         * 会签):不含 cacheReadInputTokens 与 cacheCreationInputTokens——三路
         * 相加 = 请求输入总量。适配器出口恒为本口径:inclusive 端点(OpenAI 系
         * prompt_tokens,cached ⊆ prompt)在适配器内减法归一,包含关系以 compat
         * 实录核证(见 providers openai/wire.ts exclusiveInputTokens
         * 注释)。消费方(上下文账本/CostTracker/状态栏)三路直加,不得再做
         * inclusive 换算(防双重矫正)。限界注记:端点的缓存写入量不可见时
         * (如 OpenAI Chat 协议无 cache_write 字段),写入量仍含在本键内
         * (cacheCreation 缺席,三路总量不失真)。
         */
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodOptional<z.ZodNumber>;
        cacheCreationInputTokens: z.ZodOptional<z.ZodNumber>;
        reasoningOutputTokens: z.ZodOptional<z.ZodNumber>;
        /**
         * 缓存删除量(contract-v0.4;cached microcompact):
         * provider 报告的 cache_deleted_input_tokens——服务端缓存段被逐出/失效的
         * 通知量,**非计费维度**(cost-tracker 不入账),上下文账本(context
         * ledger)以此校正窗口水位。观测到该字段的适配器填入;缺省不落键。
         */
        cacheDeletedInputTokens: z.ZodOptional<z.ZodNumber>;
        /**
         * 长尾计量维度桶(CW8 B3 契约 RFC 会签、B7 落地;纯增量可选键,包络 v
         * 不 bump——v0.4 cacheDeletedInputTokens 先例)。键词表与服务端维度
         * 注册表同源(twp 帧 dims 直透):计费长尾排他桶(cache_w_5m/1h、
         * reasoning_out、多模态等)+ `obs_` 前缀观测位(不参与计费,呈现冠
         * 「(观测)」);值为非负整数量(token/次数),非零桶才携带。恒不含
         * 四主键 in/out/cache_r/cache_w 的语义重复(双源漂移防御,服务端
         * schema 拒;适配器入站防御性剔除)。与 reasoningOutputTokens 的关系:
         * 后者是既有专位(v0.x 兼容),gemini 独立计费的 reasoning_out 桶两处
         * 并存时值恒相等(适配器同源填写)。
         */
        dims: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        /**
         * 缓存净省费(CW8 B3 RFC,裁决 16;DECIMAL 串,= readSaved −
         * writePremium,**可为负**——写溢超读省的会话如实呈负,防「只报喜」)。
         * twp 帧 saved 直透,≠0 才携带(缺席 =「无省费故事可讲」,端侧整行
         * 不出);恒服务端权威——本地估算径(server-cost 缺席时)不得拟造本键
         * (恒不猜纪律)。三分量明细(readSaved/writePremium/netSaved)走读面,
         * 不进本键。
         */
        saved: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }>>;
    ttftMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    t: "message_stop";
    stopReason: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    } | undefined;
    ttftMs?: number | undefined;
}, {
    t: "message_stop";
    stopReason: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    } | undefined;
    ttftMs?: number | undefined;
}>, z.ZodObject<{
    t: z.ZodLiteral<"error">;
    kind: z.ZodEnum<["rate_limited", "context_overflow", "auth", "server", "network", "connect", "stream_interrupted", "invalid_request", "policy_denied"]>;
    message: z.ZodString;
    recoverable: z.ZodBoolean;
    retryAfterMs: z.ZodOptional<z.ZodNumber>;
    /**
     * R-5(doc/77 §五 R6,contract 加法演进):重试层终局错误随行的重试
     * 摘要——attempts 为该逻辑请求的传输尝试总数(含首次),elapsedMs 为
     * 自首次尝试起的墙钟耗时。kernel 据此在最终失败文案组装「已自动重试
     * N 次(历时 T 秒)仍失败」;缺席 = 未经重试层/首次即终局。
     */
    retrySummary: z.ZodOptional<z.ZodObject<{
        attempts: z.ZodNumber;
        elapsedMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        attempts: number;
        elapsedMs: number;
    }, {
        attempts: number;
        elapsedMs: number;
    }>>;
    /**
     * 结构化事实位(contract-v0.26;加法可选):适配器把服务端
     * 信封 `error.detail` 中**机器可判、不含身份 / 内部 id** 的事实原样带到归一错误上,
     * kernel 透传进 `turn.error.detail`。首个签发方 = providers twp 归一层对平台套餐码
     * (`plan_concurrency_exceeded` / `plan_end_users_exceeded` / `plan_required` /
     * `plan_tier_insufficient`)落 `{ scope: 'plan' }`——端侧据此把「开发者套餐配额」与
     * 「模型限流」区分(HTTP 面同键同值;事件流面此前分叉)。缺席 = 无附加事实。
     */
    detail: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /**
     * 传输幂等键已被本次失败尝试烧毁(2026-08-27 幂等 409 事故取证,契约
     * 加法演进):请求已抵达服务端且流式语义下服务端将/已按断链结算并记
     * 「完成不可重放」——同键重发注定 409 idempotency_conflict。重试层
     * 见此标记即换新键重试(= 作为新请求重新执行,计费如实);缺席 =
     * 键仍可复用(纯网络失败/服务端 failed 终态,同键重发是防双计正道)。
     */
    idempotencyConsumed: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    t: "error";
    message: string;
    kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    recoverable: boolean;
    retryAfterMs?: number | undefined;
    retrySummary?: {
        attempts: number;
        elapsedMs: number;
    } | undefined;
    detail?: Record<string, unknown> | undefined;
    idempotencyConsumed?: boolean | undefined;
}, {
    t: "error";
    message: string;
    kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    recoverable: boolean;
    retryAfterMs?: number | undefined;
    retrySummary?: {
        attempts: number;
        elapsedMs: number;
    } | undefined;
    detail?: Record<string, unknown> | undefined;
    idempotencyConsumed?: boolean | undefined;
}>]>;
/** 类型化流事件(IRStreamEventSchema 推导)。 */
type IRStreamEvent = z.infer<typeof IRStreamEventSchema>;

/**
 * 内核事件协议(一份数据三用:UI 渲染 / 审计 / 编排)
 *
 * 设计要点:
 * - 事件族与包络分离;
 * - 一等 error 事件、tombstone→message.retracted;
 * - 审计 schema 的关联链字段:trace/span/prompt/agent。
 *
 * 兼容规则:消费端必须容忍未知事件 type(向前兼容),据包络 `v` 字段判断。
 */

/** 事件包络——每个事件都携带,seq 单调支持断线重放(serve 模式 Last-Event-ID) */
declare const EventEnvelopeSchema: z.ZodObject<{
    sessionId: z.ZodString;
    turnId: z.ZodOptional<z.ZodString>;
    /** 会话内单调递增序号 */
    seq: z.ZodNumber;
    /** UTC 毫秒时间戳 */
    ts: z.ZodNumber;
    /** 协议版本,当前 "v0" */
    v: z.ZodString;
    /** 事件产生源:kernel / tool / provider / hook / extension */
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    seq: number;
    ts: number;
    v: string;
    source: string;
    turnId?: string | undefined;
}, {
    sessionId: string;
    seq: number;
    ts: number;
    v: string;
    source: string;
    turnId?: string | undefined;
}>;
/** 事件包络(EventEnvelopeSchema 推导)。 */
type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
/** 一轮查询的终止原因词表:正常完成、各类上限触顶、模型错误、中断 / 超时 / 关停、hook 阻断等。 */
declare const TerminalReasonSchema: z.ZodEnum<["completed", "blocking_limit", "aborted_streaming", "aborted_tools", "model_error", "prompt_too_long", "max_turns", "max_tool_rounds", "injection_limit", "hook_stopped", "structured_output", "timeout", "shutdown", "budget_exceeded", "stop_hook_limit", "internal_error", "client_gone"]>;
/** 一轮查询的终止原因(TerminalReasonSchema 推导)。 */
type TerminalReason = z.infer<typeof TerminalReasonSchema>;
/**
 * tool.failed 的错误分类(contract-v0.2:由宽 string 收窄)。
 * 取值集合 = kernel 调度器(DispatchingToolExecutor/SequentialToolExecutor)
 * 实际签发全集:参数解析失败 / 未注册工具 / 硬超时 / 外部中断 / 执行抛错。
 */
declare const ToolErrorTypeSchema: z.ZodEnum<["invalid_args", "unknown_tool", "timeout", "aborted", "execution_error"]>;
/** tool.failed 的错误分类(ToolErrorTypeSchema 推导)。 */
type ToolErrorType = z.infer<typeof ToolErrorTypeSchema>;
/** 权限决策三值:allow 放行 / deny 拒绝 / ask 交用户终审。 */
declare const PermissionDecisionSchema: z.ZodEnum<["allow", "deny", "ask"]>;
/** 权限决策(PermissionDecisionSchema 推导)。 */
type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;
/**
 * 决策来源——全部落审计。
 * contract-v0.3:增 'hook'——PreToolUse hook 收紧(deny/升格 ask)
 * 的专属归因;此前临时借记 'policy' 会损失「引擎策略 vs 外部执行体」的审计粒度。
 * contract-v0.7:增 'builtin'——内置安全基线(权限管线
 * 4.5 段)命中的专属归因;此前临时借记 'rule' 会与用户/企业配置规则混淆审计来源。
 * contract-v0.8:增 'classifier'——LLM 权限分类器
 * 裁决的专属归因(auto 模式放行/收紧,或 ask 决策的分类器收紧);借记
 * 'policy'/'mode' 都会损失「机器裁决」这一审计维度。
 */
declare const DecisionSourceSchema: z.ZodEnum<["rule", "user", "mode", "policy", "hook", "builtin", "classifier"]>;
/** 权限决策来源(DecisionSourceSchema 推导)。 */
type DecisionSource = z.infer<typeof DecisionSourceSchema>;
/**
 * hook 执行终态(contract-v0.3):hook.completed 的可选 status 取值。
 * 'blocked' 不在此集合——阻断走独立的 hook.blocked 事件(互斥拆分)。
 */
declare const HookOutcomeStatusSchema: z.ZodEnum<["ok", "error", "timeout", "aborted"]>;
/** hook 执行终态(HookOutcomeStatusSchema 推导)。 */
type HookOutcomeStatus = z.infer<typeof HookOutcomeStatusSchema>;
/** 事件负载联合(不含包络)。命名按 session/turn/msg/tool/agent/hook/cost/plan 分族。 */
declare const EventBodySchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"session.created">;
    cwd: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.created";
    cwd: string;
}, {
    type: "session.created";
    cwd: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.resumed">;
    fromSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.resumed";
    fromSeq: number;
}, {
    type: "session.resumed";
    fromSeq: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.compacted">;
    /** 被移除消息的 index 闭区间 [first, last](原数组坐标) */
    removedRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    /**
     * 被移除消息的精确 index 清单(contract-v0.4):pinned
     * 挖洞时 removedRange 是外包络,重放/审计按本清单才能精确复原折叠面;
     * 表面层折叠计数也应优先取本清单长度。升序;缺省时按 removedRange 连续。
     */
    removedIndices: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** 候选区内整体保留的 pinned 消息数(contract-v0.4;可观测性) */
    keptPinnedCount: z.ZodOptional<z.ZodNumber>;
    /**
     * 压缩执行关联 id(contract-v0.15,RFC-CTX12-2):与 journal
     * compact_boundary 记录、context-events.jsonl 埋点行(T-CTX14a)同源
     * 互指。旧签发方缺省;消费方忽略无害。
     */
    compactionId: z.ZodOptional<z.ZodString>;
    /**
     * 折叠机制标记(P-CTX2 K9,G-A7 纯增量可选键):缺席 = 常规模型压缩;
     * 'breaker_fallback' = 压缩熔断打开时的无模型硬截断保底(blocking 闸门
     * 熔断感知径),表面层据此渲染专用文案。词表锚定 kernel
     * CompactionFoldMechanism,自由文本仅兜底——kernel 扩值不 bump 契约
     * (compact_boundary trigger 同先例)。
     */
    mechanism: z.ZodOptional<z.ZodString>;
    /**
     * 压缩前落盘的上下文快照 id(contract-v0.23,doc/116 §4.1 / doc/117 K-4·K-5):
     * 装配层在本次压缩前写 pre_compaction Checkpoint 时携带,与
     * session.checkpointed / journal compact_boundary.checkpointId 三方互指;
     * 未落快照(选项关闭或未接线)缺席。消费方忽略无害。
     */
    checkpointId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "session.compacted";
    removedRange: [number, number];
    compactionId?: string | undefined;
    removedIndices?: number[] | undefined;
    keptPinnedCount?: number | undefined;
    mechanism?: string | undefined;
    checkpointId?: string | undefined;
}, {
    type: "session.compacted";
    removedRange: [number, number];
    compactionId?: string | undefined;
    removedIndices?: number[] | undefined;
    keptPinnedCount?: number | undefined;
    mechanism?: string | undefined;
    checkpointId?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.checkpointed">;
    checkpointId: z.ZodString;
    trigger: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    messageCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.checkpointed";
    checkpointId: string;
    trigger: string;
    messageCount: number;
    label?: string | undefined;
}, {
    type: "session.checkpointed";
    checkpointId: string;
    trigger: string;
    messageCount: number;
    label?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.restored">;
    checkpointId: z.ZodString;
    fromMessages: z.ZodNumber;
    toMessages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.restored";
    checkpointId: string;
    fromMessages: number;
    toMessages: number;
}, {
    type: "session.restored";
    checkpointId: string;
    fromMessages: number;
    toMessages: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.forked">;
    sourceSessionId: z.ZodString;
    checkpointId: z.ZodString;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.forked";
    sessionId: string;
    checkpointId: string;
    sourceSessionId: string;
}, {
    type: "session.forked";
    sessionId: string;
    checkpointId: string;
    sourceSessionId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.microcompacted">;
    /**
     * 本次存根化淘汰(evict 迁移)的 tool_result 块数。contract-v0.18 起
     * ≥0(纯剪枝屏障为 0);与 prunedBlocks 不同时为零。
     */
    evictedBlocks: z.ZodNumber;
    /** 估算口径淘汰回收量(tokens;Σ 每块存根化前后估算差,非权威计量) */
    recoveredTokens: z.ZodNumber;
    /** 同步执行墙钟耗时(ms;签发方计时,观测口径,不参与决策) */
    durationMs: z.ZodNumber;
    /** 淘汰前本地估算占用(tokens;水位审计) */
    beforeTokens: z.ZodOptional<z.ZodNumber>;
    /** 淘汰后本地估算占用(tokens) */
    afterTokens: z.ZodOptional<z.ZodNumber>;
    /**
     * 本次原位剪枝(prune 迁移:头+尾+标记收束)的 tool_result 块数
     * (contract-v0.18;零剪枝屏障键缺席)。
     */
    prunedBlocks: z.ZodOptional<z.ZodNumber>;
    /** 估算口径剪枝回收量(tokens;与 recoveredTokens 分账不重叠) */
    pruneRecoveredTokens: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "session.microcompacted";
    evictedBlocks: number;
    recoveredTokens: number;
    durationMs: number;
    beforeTokens?: number | undefined;
    afterTokens?: number | undefined;
    prunedBlocks?: number | undefined;
    pruneRecoveredTokens?: number | undefined;
}, {
    type: "session.microcompacted";
    evictedBlocks: number;
    recoveredTokens: number;
    durationMs: number;
    beforeTokens?: number | undefined;
    afterTokens?: number | undefined;
    prunedBlocks?: number | undefined;
    pruneRecoveredTokens?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.locale.changed">;
    locale: z.ZodString;
    previous: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.locale.changed";
    locale: string;
    previous: string;
}, {
    type: "session.locale.changed";
    locale: string;
    previous: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.output_style.changed">;
    style: z.ZodString;
    previous: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.output_style.changed";
    previous: string;
    style: string;
}, {
    type: "session.output_style.changed";
    previous: string;
    style: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.workspace_trust.changed">;
    trusted: z.ZodBoolean;
    persisted: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "session.workspace_trust.changed";
    trusted: boolean;
    persisted?: boolean | undefined;
}, {
    type: "session.workspace_trust.changed";
    trusted: boolean;
    persisted?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.cwd_changed">;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.cwd_changed";
    from: string;
    to: string;
}, {
    type: "session.cwd_changed";
    from: string;
    to: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.ended">;
}, "strip", z.ZodTypeAny, {
    type: "session.ended";
}, {
    type: "session.ended";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.started">;
}, "strip", z.ZodTypeAny, {
    type: "turn.started";
}, {
    type: "turn.started";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.completed">;
    reason: z.ZodEnum<["completed", "blocking_limit", "aborted_streaming", "aborted_tools", "model_error", "prompt_too_long", "max_turns", "max_tool_rounds", "injection_limit", "hook_stopped", "structured_output", "timeout", "shutdown", "budget_exceeded", "stop_hook_limit", "internal_error", "client_gone"]>;
}, "strip", z.ZodTypeAny, {
    type: "turn.completed";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}, {
    type: "turn.completed";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.aborted">;
    reason: z.ZodEnum<["completed", "blocking_limit", "aborted_streaming", "aborted_tools", "model_error", "prompt_too_long", "max_turns", "max_tool_rounds", "injection_limit", "hook_stopped", "structured_output", "timeout", "shutdown", "budget_exceeded", "stop_hook_limit", "internal_error", "client_gone"]>;
}, "strip", z.ZodTypeAny, {
    type: "turn.aborted";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}, {
    type: "turn.aborted";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.error">;
    scope: z.ZodString;
    message: z.ZodString;
    recoverable: z.ZodBoolean;
    /**
     * 错误类别标记(P-CTX2 K10,G-A8 纯增量可选键):scope='model' 时为
     * IRErrorKind 透传('policy_denied'/'context_overflow'/'server'/…),
     * 表面层据此做链路归属([端点]/[平台])与自救指引模板化。缺席 =
     * 旧签发方或非模型 scope,渲染回落 scope 归属。词表锚定 IRErrorKind,
     * 自由文本仅兜底——kind 扩值不 bump 契约(compacted.mechanism 同先例)。
     */
    errorKind: z.ZodOptional<z.ZodString>;
    /**
     * 结构化事实位(contract-v0.26;加法可选键):scope='model' 时
     * = IR error 事件 `detail` 透传(providers 自服务端信封带出的机器可判事实;首个取值
     * `{ scope: 'plan' }` = 平台套餐配额拒绝,与 HTTP 面 `error.detail.scope`
     * 同键同值)。三端 reducer 归约:`recoverable:true` → `SessionNotice.detail`,失败形 →
     * `ErrorView.detail`;端侧 `ErrorEnvelope.scope` 取值器同一读法。缺席 = 无附加事实
     * (既有事件体字节零变)。值恒不含 endUser 身份 / 令牌 / 内部 id。
     */
    detail: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "turn.error";
    recoverable: boolean;
    scope: string;
    detail?: Record<string, unknown> | undefined;
    errorKind?: string | undefined;
}, {
    message: string;
    type: "turn.error";
    recoverable: boolean;
    scope: string;
    detail?: Record<string, unknown> | undefined;
    errorKind?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.block.start">;
    index: z.ZodNumber;
    blockType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.block.start";
    index: number;
    blockType: string;
}, {
    type: "msg.block.start";
    index: number;
    blockType: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.text.delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.text.delta";
    text: string;
    index: number;
}, {
    type: "msg.text.delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.thinking.delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.thinking.delta";
    text: string;
    index: number;
}, {
    type: "msg.thinking.delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.block.end">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "msg.block.end";
    index: number;
}, {
    type: "msg.block.end";
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.retracted">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "msg.retracted";
    index: number;
}, {
    type: "msg.retracted";
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.proposed">;
    toolCallId: z.ZodString;
    name: z.ZodString;
    args: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    type: "tool.proposed";
    name: string;
    toolCallId: string;
    args?: unknown;
}, {
    type: "tool.proposed";
    name: string;
    toolCallId: string;
    args?: unknown;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.permission.requested">;
    toolCallId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.permission.requested";
    name: string;
    toolCallId: string;
}, {
    type: "tool.permission.requested";
    name: string;
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.permission.decided">;
    toolCallId: z.ZodString;
    decision: z.ZodEnum<["allow", "deny", "ask"]>;
    decisionSource: z.ZodEnum<["rule", "user", "mode", "policy", "hook", "builtin", "classifier"]>;
    /**
     * 命中的规则原文(如 `Shell(git *)`;contract-v0.2)。
     * 审计链由此可答"哪条规则拒的";模式短路/兜底 ask 等无规则命中时不落键。
     */
    matchedRule: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "tool.permission.decided";
    toolCallId: string;
    decision: "allow" | "deny" | "ask";
    decisionSource: "user" | "rule" | "mode" | "policy" | "hook" | "builtin" | "classifier";
    matchedRule?: string | undefined;
}, {
    type: "tool.permission.decided";
    toolCallId: string;
    decision: "allow" | "deny" | "ask";
    decisionSource: "user" | "rule" | "mode" | "policy" | "hook" | "builtin" | "classifier";
    matchedRule?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.started">;
    toolCallId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.started";
    toolCallId: string;
}, {
    type: "tool.started";
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.progress">;
    toolCallId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "tool.progress";
    toolCallId: string;
}, {
    message: string;
    type: "tool.progress";
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.output.delta">;
    toolCallId: z.ZodString;
    chunk: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.output.delta";
    toolCallId: string;
    chunk: string;
}, {
    type: "tool.output.delta";
    toolCallId: string;
    chunk: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.completed">;
    toolCallId: z.ZodString;
    durationMs: z.ZodNumber;
    /**
     * ToolResult.data 透传位(contract-v0.3):工具产出的结构化
     * 渲染数据(AGENTS.md「工具只产出结构化数据」铁律的事件流出口)。
     * 表面层按工具名注册渲染器消费;无 data 的工具不落键,消费方忽略无害。
     */
    data: z.ZodOptional<z.ZodUnknown>;
    /**
     * 模型可见文本投影(contract-v0.8):喂回模型的 tool_result
     * 文本(截断后形态)。cc-compat stream-json 包络与 SDK 消费方由此拿到
     * 与模型一致的结果文本,不必反推 data;与 data 正交(结构化渲染 vs
     * 模型文本)。大结果按工具结果预算截断后的文本为准,不另存全量。
     */
    content: z.ZodOptional<z.ZodString>;
    /**
     * 工具结构化失败位(contract-v0.25):`ToolResult.isError`
     * 透传。工具以 **return isError** 表达的业务级失败(非零退出 / 用户中断 / SSRF 拒 /
     * 媒体错误形)与 throw 径的 `tool.failed` 在表面层归约为同一 failed 态——此前 TUI /
     * sdk / 端侧对这类结果一律 ✓。缺席 = 旧签发方或成功完成(completed 语义不变);
     * 消费方(TUI / sdk / Android / iOS reducer)只判 `isError === true → failed`。
     * 纯可选加法,包络 `v` 不 bump;端侧 vendored 同步另行跟进。
     */
    isError: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "tool.completed";
    durationMs: number;
    toolCallId: string;
    data?: unknown;
    content?: string | undefined;
    isError?: boolean | undefined;
}, {
    type: "tool.completed";
    durationMs: number;
    toolCallId: string;
    data?: unknown;
    content?: string | undefined;
    isError?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.failed">;
    toolCallId: z.ZodString;
    errorType: z.ZodEnum<["invalid_args", "unknown_tool", "timeout", "aborted", "execution_error"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "tool.failed";
    toolCallId: string;
    errorType: "aborted" | "timeout" | "invalid_args" | "unknown_tool" | "execution_error";
}, {
    message: string;
    type: "tool.failed";
    toolCallId: string;
    errorType: "aborted" | "timeout" | "invalid_args" | "unknown_tool" | "execution_error";
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.spawned">;
    agentId: z.ZodString;
    parentAgentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "agent.spawned";
    agentId: string;
    parentAgentId?: string | undefined;
}, {
    type: "agent.spawned";
    agentId: string;
    parentAgentId?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.progress">;
    agentId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "agent.progress";
    agentId: string;
}, {
    message: string;
    type: "agent.progress";
    agentId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.completed">;
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.completed";
    agentId: string;
}, {
    type: "agent.completed";
    agentId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.followup">;
    agentId: z.ZodString;
    messageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.followup";
    agentId: string;
    messageId: string;
}, {
    type: "agent.followup";
    agentId: string;
    messageId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.report">;
    agentId: z.ZodString;
    message: z.ZodString;
    wake: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "agent.report";
    agentId: string;
    wake: boolean;
}, {
    message: string;
    type: "agent.report";
    agentId: string;
    wake: boolean;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.settled">;
    agentId: z.ZodString;
    outcome: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.settled";
    agentId: string;
    outcome: string;
}, {
    type: "agent.settled";
    agentId: string;
    outcome: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.interrupted">;
    agentId: z.ZodString;
    by: z.ZodEnum<["user", "parent", "system"]>;
}, "strip", z.ZodTypeAny, {
    type: "agent.interrupted";
    agentId: string;
    by: "user" | "system" | "parent";
}, {
    type: "agent.interrupted";
    agentId: string;
    by: "user" | "system" | "parent";
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.triggered">;
    event: z.ZodString;
    hookId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "hook.triggered";
    event: string;
    hookId: string;
}, {
    type: "hook.triggered";
    event: string;
    hookId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.completed">;
    hookId: z.ZodString;
    event: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["ok", "error", "timeout", "aborted"]>>;
}, "strip", z.ZodTypeAny, {
    type: "hook.completed";
    hookId: string;
    status?: "aborted" | "error" | "timeout" | "ok" | undefined;
    durationMs?: number | undefined;
    event?: string | undefined;
}, {
    type: "hook.completed";
    hookId: string;
    status?: "aborted" | "error" | "timeout" | "ok" | undefined;
    durationMs?: number | undefined;
    event?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.blocked">;
    hookId: z.ZodString;
    event: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "hook.blocked";
    reason: string;
    hookId: string;
    durationMs?: number | undefined;
    event?: string | undefined;
}, {
    type: "hook.blocked";
    reason: string;
    hookId: string;
    durationMs?: number | undefined;
    event?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.usage.updated">;
    model: z.ZodString;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodOptional<z.ZodNumber>;
        cacheCreationInputTokens: z.ZodOptional<z.ZodNumber>;
        reasoningOutputTokens: z.ZodOptional<z.ZodNumber>;
        cacheDeletedInputTokens: z.ZodOptional<z.ZodNumber>;
        dims: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        saved: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }>;
    costUsd: z.ZodOptional<z.ZodNumber>;
    /**
     * 上下文窗口分母(contract-v0.3):签发方(查询环)从装配层
     * 注入的 provider capability.maxContext 透传。状态栏水位 = 最近 prompt
     * 规模 / 本值;缺省时表面层隐藏水位段(或回退装配注入的静态值)。
     * 随 usage 更新携带——/model 热切换后分母随下一轮事件自动矫正。
     */
    contextWindowTokens: z.ZodOptional<z.ZodNumber>;
    /** 签发方 ResolvedModel.provider 透传;缺省时消费端可按 model 反查 */
    provider: z.ZodOptional<z.ZodString>;
    /** 子代理归因(Task 链上抛时由运行器注入;嵌套保留最内层) */
    agentId: z.ZodOptional<z.ZodString>;
    /** 按次计费/按调用归因的工具调用 id(如 Task、WebSearch) */
    toolUseId: z.ZodOptional<z.ZodString>;
    /**
     * 用量目的:非对话主流的模型调用标注来源。词表:'compaction'(上下文
     * 压缩轮)/ 'title'(会话标题生成,contract-v0.8
     * 扩容;辅助任务降档的归因面)/ 'permission_classifier'(LLM 权限
     * 分类器调用)/ 'memory'(记忆四面 fork:提取/固化/晋升/召回
     * 选择;随本地记账闭环扩词)。新目的先扩词表再签发
     * (自由文本仅兜底);缺省即对话主流。
     *
     * 词表分叉注记:同一分类器子系统在 request-
     * measurement 观测面与 TWP 出线面用词 'classifier'(kernel context/
     * request-measurement.ts RequestPurpose、providers twp/contract.ts
     * TWP_PURPOSE_VALUES——现为扁平单表,分版常量已退役),与本词表
     * 'permission_classifier' 属两套近义词并存;且本词当前全仓零签发方
     * (分类器 usage 走遥测与测量面,不落本地 cost 事件)。统一到单一词属
     * 契约面决策,待定;届时 kernel cost/tracker.ts KNOWN_COST_PURPOSES
     * 须同步,勿单侧改词。
     */
    purpose: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cost.usage.updated";
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    };
    provider?: string | undefined;
    agentId?: string | undefined;
    costUsd?: number | undefined;
    contextWindowTokens?: number | undefined;
    toolUseId?: string | undefined;
    purpose?: string | undefined;
}, {
    type: "cost.usage.updated";
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    };
    provider?: string | undefined;
    agentId?: string | undefined;
    costUsd?: number | undefined;
    contextWindowTokens?: number | undefined;
    toolUseId?: string | undefined;
    purpose?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.cache_miss">;
    model: z.ZodString;
    /** 本轮未命中缓存的输入规模(prompt tokens) */
    inputTokens: z.ZodNumber;
    /** 触发告警的输入规模阈值(签发方配置;可观测性) */
    threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "cost.cache_miss";
    model: string;
    inputTokens: number;
    threshold?: number | undefined;
}, {
    type: "cost.cache_miss";
    model: string;
    inputTokens: number;
    threshold?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.model.mismatch">;
    /** 请求申报模型(IRRequest.model.model) */
    requested: z.ZodString;
    /** message_start 实回模型 */
    actual: z.ZodString;
    /** 请求申报 provider(签发方 ResolvedModel.provider 透传;归因辅助) */
    provider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cost.model.mismatch";
    requested: string;
    actual: string;
    provider?: string | undefined;
}, {
    type: "cost.model.mismatch";
    requested: string;
    actual: string;
    provider?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.provider.switched">;
    from: z.ZodString;
    to: z.ZodString;
    /** 切换原因;词表锚定 IRErrorKind(rate_limited/auth/server/…),自由文本仅兜底 */
    reason: z.ZodString;
    /** 全链尝试的 entry 数(含最终命中/耗尽的那个) */
    attempts: z.ZodOptional<z.ZodNumber>;
    /** 各落选 entry 的失败轨迹(按链序;kind 复用 IR 错误归一化枚举) */
    failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        provider: z.ZodString;
        kind: z.ZodEnum<["rate_limited", "context_overflow", "auth", "server", "network", "connect", "stream_interrupted", "invalid_request", "policy_denied"]>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }, {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "cost.provider.switched";
    from: string;
    to: string;
    reason: string;
    attempts?: number | undefined;
    failures?: {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }[] | undefined;
}, {
    type: "cost.provider.switched";
    from: string;
    to: string;
    reason: string;
    attempts?: number | undefined;
    failures?: {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.connected">;
    server: z.ZodString;
    transport: z.ZodEnum<["stdio", "http"]>;
    protocolVersion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "mcp.connected";
    server: string;
    transport: "stdio" | "http";
    protocolVersion: string;
}, {
    type: "mcp.connected";
    server: string;
    transport: "stdio" | "http";
    protocolVersion: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.connect_failed">;
    server: z.ZodString;
    /** 错误码;词表锚定 kernel McpErrorCode(connect_failed/handshake_failed/timeout/…) */
    code: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    type: "mcp.connect_failed";
    server: string;
}, {
    code: string;
    message: string;
    type: "mcp.connect_failed";
    server: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.closed">;
    server: z.ZodString;
    reason: z.ZodEnum<["closed", "server_exit", "error"]>;
    detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.closed";
    server: string;
    reason: "error" | "closed" | "server_exit";
    detail?: string | undefined;
}, {
    type: "mcp.closed";
    server: string;
    reason: "error" | "closed" | "server_exit";
    detail?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.elicitation_declined">;
    server: z.ZodString;
    mode: z.ZodEnum<["form", "url"]>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.elicitation_declined";
    server: string;
    mode: "form" | "url";
    message?: string | undefined;
}, {
    type: "mcp.elicitation_declined";
    server: string;
    mode: "form" | "url";
    message?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.tool_skipped">;
    server: z.ZodString;
    tool: z.ZodString;
    reason: z.ZodEnum<["duplicate_name", "invalid_name"]>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.tool_skipped";
    server: string;
    reason: "duplicate_name" | "invalid_name";
    tool: string;
}, {
    type: "mcp.tool_skipped";
    server: string;
    reason: "duplicate_name" | "invalid_name";
    tool: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.discovered">;
    server: z.ZodString;
    phase: z.ZodEnum<["catalog", "expand"]>;
    origin: z.ZodEnum<["catalog-cache", "live"]>;
    tools: z.ZodArray<z.ZodString, "many">;
    durationMs: z.ZodNumber;
    /** 64 字符帽折叠映射(仅 phase='expand' 且发生折叠时携带;审计面) */
    folds: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        bridged: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tool: string;
        bridged: string;
    }, {
        tool: string;
        bridged: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.discovered";
    tools: string[];
    server: string;
    durationMs: number;
    phase: "catalog" | "expand";
    origin: "catalog-cache" | "live";
    folds?: {
        tool: string;
        bridged: string;
    }[] | undefined;
}, {
    type: "mcp.discovered";
    tools: string[];
    server: string;
    durationMs: number;
    phase: "catalog" | "expand";
    origin: "catalog-cache" | "live";
    folds?: {
        tool: string;
        bridged: string;
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.catalog_updated">;
    server: z.ZodString;
    added: z.ZodNumber;
    removed: z.ZodNumber;
    changed: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.catalog_updated";
    server: string;
    added: number;
    removed: number;
    changed: number;
}, {
    type: "mcp.catalog_updated";
    server: string;
    added: number;
    removed: number;
    changed: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnecting">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempt: z.ZodNumber;
    delayMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnecting";
    server: string;
    connection: number;
    attempt: number;
    delayMs: number;
}, {
    type: "mcp.reconnecting";
    server: string;
    connection: number;
    attempt: number;
    delayMs: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnected">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempt: z.ZodNumber;
    downtimeMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnected";
    server: string;
    connection: number;
    attempt: number;
    downtimeMs: number;
}, {
    type: "mcp.reconnected";
    server: string;
    connection: number;
    attempt: number;
    downtimeMs: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnect_exhausted">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnect_exhausted";
    server: string;
    attempts: number;
    connection: number;
}, {
    type: "mcp.reconnect_exhausted";
    server: string;
    attempts: number;
    connection: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"plan.todo.updated">;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "completed", "cancelled"]>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }, {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "plan.todo.updated";
    items: {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }[];
}, {
    type: "plan.todo.updated";
    items: {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }[];
}>]>;
/** 事件负载联合(EventBodySchema 推导)。 */
type EventBody = z.infer<typeof EventBodySchema>;
/** 完整事件 = 包络 + 负载 */
declare const KernelEventSchema: z.ZodIntersection<z.ZodObject<{
    sessionId: z.ZodString;
    turnId: z.ZodOptional<z.ZodString>;
    /** 会话内单调递增序号 */
    seq: z.ZodNumber;
    /** UTC 毫秒时间戳 */
    ts: z.ZodNumber;
    /** 协议版本,当前 "v0" */
    v: z.ZodString;
    /** 事件产生源:kernel / tool / provider / hook / extension */
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    seq: number;
    ts: number;
    v: string;
    source: string;
    turnId?: string | undefined;
}, {
    sessionId: string;
    seq: number;
    ts: number;
    v: string;
    source: string;
    turnId?: string | undefined;
}>, z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"session.created">;
    cwd: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.created";
    cwd: string;
}, {
    type: "session.created";
    cwd: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.resumed">;
    fromSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.resumed";
    fromSeq: number;
}, {
    type: "session.resumed";
    fromSeq: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.compacted">;
    /** 被移除消息的 index 闭区间 [first, last](原数组坐标) */
    removedRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    /**
     * 被移除消息的精确 index 清单(contract-v0.4):pinned
     * 挖洞时 removedRange 是外包络,重放/审计按本清单才能精确复原折叠面;
     * 表面层折叠计数也应优先取本清单长度。升序;缺省时按 removedRange 连续。
     */
    removedIndices: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** 候选区内整体保留的 pinned 消息数(contract-v0.4;可观测性) */
    keptPinnedCount: z.ZodOptional<z.ZodNumber>;
    /**
     * 压缩执行关联 id(contract-v0.15,RFC-CTX12-2):与 journal
     * compact_boundary 记录、context-events.jsonl 埋点行(T-CTX14a)同源
     * 互指。旧签发方缺省;消费方忽略无害。
     */
    compactionId: z.ZodOptional<z.ZodString>;
    /**
     * 折叠机制标记(P-CTX2 K9,G-A7 纯增量可选键):缺席 = 常规模型压缩;
     * 'breaker_fallback' = 压缩熔断打开时的无模型硬截断保底(blocking 闸门
     * 熔断感知径),表面层据此渲染专用文案。词表锚定 kernel
     * CompactionFoldMechanism,自由文本仅兜底——kernel 扩值不 bump 契约
     * (compact_boundary trigger 同先例)。
     */
    mechanism: z.ZodOptional<z.ZodString>;
    /**
     * 压缩前落盘的上下文快照 id(contract-v0.23,doc/116 §4.1 / doc/117 K-4·K-5):
     * 装配层在本次压缩前写 pre_compaction Checkpoint 时携带,与
     * session.checkpointed / journal compact_boundary.checkpointId 三方互指;
     * 未落快照(选项关闭或未接线)缺席。消费方忽略无害。
     */
    checkpointId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "session.compacted";
    removedRange: [number, number];
    compactionId?: string | undefined;
    removedIndices?: number[] | undefined;
    keptPinnedCount?: number | undefined;
    mechanism?: string | undefined;
    checkpointId?: string | undefined;
}, {
    type: "session.compacted";
    removedRange: [number, number];
    compactionId?: string | undefined;
    removedIndices?: number[] | undefined;
    keptPinnedCount?: number | undefined;
    mechanism?: string | undefined;
    checkpointId?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.checkpointed">;
    checkpointId: z.ZodString;
    trigger: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    messageCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.checkpointed";
    checkpointId: string;
    trigger: string;
    messageCount: number;
    label?: string | undefined;
}, {
    type: "session.checkpointed";
    checkpointId: string;
    trigger: string;
    messageCount: number;
    label?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.restored">;
    checkpointId: z.ZodString;
    fromMessages: z.ZodNumber;
    toMessages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session.restored";
    checkpointId: string;
    fromMessages: number;
    toMessages: number;
}, {
    type: "session.restored";
    checkpointId: string;
    fromMessages: number;
    toMessages: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.forked">;
    sourceSessionId: z.ZodString;
    checkpointId: z.ZodString;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.forked";
    sessionId: string;
    checkpointId: string;
    sourceSessionId: string;
}, {
    type: "session.forked";
    sessionId: string;
    checkpointId: string;
    sourceSessionId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.microcompacted">;
    /**
     * 本次存根化淘汰(evict 迁移)的 tool_result 块数。contract-v0.18 起
     * ≥0(纯剪枝屏障为 0);与 prunedBlocks 不同时为零。
     */
    evictedBlocks: z.ZodNumber;
    /** 估算口径淘汰回收量(tokens;Σ 每块存根化前后估算差,非权威计量) */
    recoveredTokens: z.ZodNumber;
    /** 同步执行墙钟耗时(ms;签发方计时,观测口径,不参与决策) */
    durationMs: z.ZodNumber;
    /** 淘汰前本地估算占用(tokens;水位审计) */
    beforeTokens: z.ZodOptional<z.ZodNumber>;
    /** 淘汰后本地估算占用(tokens) */
    afterTokens: z.ZodOptional<z.ZodNumber>;
    /**
     * 本次原位剪枝(prune 迁移:头+尾+标记收束)的 tool_result 块数
     * (contract-v0.18;零剪枝屏障键缺席)。
     */
    prunedBlocks: z.ZodOptional<z.ZodNumber>;
    /** 估算口径剪枝回收量(tokens;与 recoveredTokens 分账不重叠) */
    pruneRecoveredTokens: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "session.microcompacted";
    evictedBlocks: number;
    recoveredTokens: number;
    durationMs: number;
    beforeTokens?: number | undefined;
    afterTokens?: number | undefined;
    prunedBlocks?: number | undefined;
    pruneRecoveredTokens?: number | undefined;
}, {
    type: "session.microcompacted";
    evictedBlocks: number;
    recoveredTokens: number;
    durationMs: number;
    beforeTokens?: number | undefined;
    afterTokens?: number | undefined;
    prunedBlocks?: number | undefined;
    pruneRecoveredTokens?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.locale.changed">;
    locale: z.ZodString;
    previous: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.locale.changed";
    locale: string;
    previous: string;
}, {
    type: "session.locale.changed";
    locale: string;
    previous: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.output_style.changed">;
    style: z.ZodString;
    previous: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.output_style.changed";
    previous: string;
    style: string;
}, {
    type: "session.output_style.changed";
    previous: string;
    style: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.workspace_trust.changed">;
    trusted: z.ZodBoolean;
    persisted: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "session.workspace_trust.changed";
    trusted: boolean;
    persisted?: boolean | undefined;
}, {
    type: "session.workspace_trust.changed";
    trusted: boolean;
    persisted?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.cwd_changed">;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session.cwd_changed";
    from: string;
    to: string;
}, {
    type: "session.cwd_changed";
    from: string;
    to: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session.ended">;
}, "strip", z.ZodTypeAny, {
    type: "session.ended";
}, {
    type: "session.ended";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.started">;
}, "strip", z.ZodTypeAny, {
    type: "turn.started";
}, {
    type: "turn.started";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.completed">;
    reason: z.ZodEnum<["completed", "blocking_limit", "aborted_streaming", "aborted_tools", "model_error", "prompt_too_long", "max_turns", "max_tool_rounds", "injection_limit", "hook_stopped", "structured_output", "timeout", "shutdown", "budget_exceeded", "stop_hook_limit", "internal_error", "client_gone"]>;
}, "strip", z.ZodTypeAny, {
    type: "turn.completed";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}, {
    type: "turn.completed";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.aborted">;
    reason: z.ZodEnum<["completed", "blocking_limit", "aborted_streaming", "aborted_tools", "model_error", "prompt_too_long", "max_turns", "max_tool_rounds", "injection_limit", "hook_stopped", "structured_output", "timeout", "shutdown", "budget_exceeded", "stop_hook_limit", "internal_error", "client_gone"]>;
}, "strip", z.ZodTypeAny, {
    type: "turn.aborted";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}, {
    type: "turn.aborted";
    reason: "completed" | "blocking_limit" | "aborted_streaming" | "aborted_tools" | "model_error" | "prompt_too_long" | "max_turns" | "max_tool_rounds" | "injection_limit" | "hook_stopped" | "structured_output" | "timeout" | "shutdown" | "budget_exceeded" | "stop_hook_limit" | "internal_error" | "client_gone";
}>, z.ZodObject<{
    type: z.ZodLiteral<"turn.error">;
    scope: z.ZodString;
    message: z.ZodString;
    recoverable: z.ZodBoolean;
    /**
     * 错误类别标记(P-CTX2 K10,G-A8 纯增量可选键):scope='model' 时为
     * IRErrorKind 透传('policy_denied'/'context_overflow'/'server'/…),
     * 表面层据此做链路归属([端点]/[平台])与自救指引模板化。缺席 =
     * 旧签发方或非模型 scope,渲染回落 scope 归属。词表锚定 IRErrorKind,
     * 自由文本仅兜底——kind 扩值不 bump 契约(compacted.mechanism 同先例)。
     */
    errorKind: z.ZodOptional<z.ZodString>;
    /**
     * 结构化事实位(contract-v0.26;加法可选键):scope='model' 时
     * = IR error 事件 `detail` 透传(providers 自服务端信封带出的机器可判事实;首个取值
     * `{ scope: 'plan' }` = 平台套餐配额拒绝,与 HTTP 面 `error.detail.scope`
     * 同键同值)。三端 reducer 归约:`recoverable:true` → `SessionNotice.detail`,失败形 →
     * `ErrorView.detail`;端侧 `ErrorEnvelope.scope` 取值器同一读法。缺席 = 无附加事实
     * (既有事件体字节零变)。值恒不含 endUser 身份 / 令牌 / 内部 id。
     */
    detail: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "turn.error";
    recoverable: boolean;
    scope: string;
    detail?: Record<string, unknown> | undefined;
    errorKind?: string | undefined;
}, {
    message: string;
    type: "turn.error";
    recoverable: boolean;
    scope: string;
    detail?: Record<string, unknown> | undefined;
    errorKind?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.block.start">;
    index: z.ZodNumber;
    blockType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.block.start";
    index: number;
    blockType: string;
}, {
    type: "msg.block.start";
    index: number;
    blockType: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.text.delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.text.delta";
    text: string;
    index: number;
}, {
    type: "msg.text.delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.thinking.delta">;
    index: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "msg.thinking.delta";
    text: string;
    index: number;
}, {
    type: "msg.thinking.delta";
    text: string;
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.block.end">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "msg.block.end";
    index: number;
}, {
    type: "msg.block.end";
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"msg.retracted">;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "msg.retracted";
    index: number;
}, {
    type: "msg.retracted";
    index: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.proposed">;
    toolCallId: z.ZodString;
    name: z.ZodString;
    args: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    type: "tool.proposed";
    name: string;
    toolCallId: string;
    args?: unknown;
}, {
    type: "tool.proposed";
    name: string;
    toolCallId: string;
    args?: unknown;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.permission.requested">;
    toolCallId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.permission.requested";
    name: string;
    toolCallId: string;
}, {
    type: "tool.permission.requested";
    name: string;
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.permission.decided">;
    toolCallId: z.ZodString;
    decision: z.ZodEnum<["allow", "deny", "ask"]>;
    decisionSource: z.ZodEnum<["rule", "user", "mode", "policy", "hook", "builtin", "classifier"]>;
    /**
     * 命中的规则原文(如 `Shell(git *)`;contract-v0.2)。
     * 审计链由此可答"哪条规则拒的";模式短路/兜底 ask 等无规则命中时不落键。
     */
    matchedRule: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "tool.permission.decided";
    toolCallId: string;
    decision: "allow" | "deny" | "ask";
    decisionSource: "user" | "rule" | "mode" | "policy" | "hook" | "builtin" | "classifier";
    matchedRule?: string | undefined;
}, {
    type: "tool.permission.decided";
    toolCallId: string;
    decision: "allow" | "deny" | "ask";
    decisionSource: "user" | "rule" | "mode" | "policy" | "hook" | "builtin" | "classifier";
    matchedRule?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.started">;
    toolCallId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.started";
    toolCallId: string;
}, {
    type: "tool.started";
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.progress">;
    toolCallId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "tool.progress";
    toolCallId: string;
}, {
    message: string;
    type: "tool.progress";
    toolCallId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.output.delta">;
    toolCallId: z.ZodString;
    chunk: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "tool.output.delta";
    toolCallId: string;
    chunk: string;
}, {
    type: "tool.output.delta";
    toolCallId: string;
    chunk: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.completed">;
    toolCallId: z.ZodString;
    durationMs: z.ZodNumber;
    /**
     * ToolResult.data 透传位(contract-v0.3):工具产出的结构化
     * 渲染数据(AGENTS.md「工具只产出结构化数据」铁律的事件流出口)。
     * 表面层按工具名注册渲染器消费;无 data 的工具不落键,消费方忽略无害。
     */
    data: z.ZodOptional<z.ZodUnknown>;
    /**
     * 模型可见文本投影(contract-v0.8):喂回模型的 tool_result
     * 文本(截断后形态)。cc-compat stream-json 包络与 SDK 消费方由此拿到
     * 与模型一致的结果文本,不必反推 data;与 data 正交(结构化渲染 vs
     * 模型文本)。大结果按工具结果预算截断后的文本为准,不另存全量。
     */
    content: z.ZodOptional<z.ZodString>;
    /**
     * 工具结构化失败位(contract-v0.25):`ToolResult.isError`
     * 透传。工具以 **return isError** 表达的业务级失败(非零退出 / 用户中断 / SSRF 拒 /
     * 媒体错误形)与 throw 径的 `tool.failed` 在表面层归约为同一 failed 态——此前 TUI /
     * sdk / 端侧对这类结果一律 ✓。缺席 = 旧签发方或成功完成(completed 语义不变);
     * 消费方(TUI / sdk / Android / iOS reducer)只判 `isError === true → failed`。
     * 纯可选加法,包络 `v` 不 bump;端侧 vendored 同步另行跟进。
     */
    isError: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "tool.completed";
    durationMs: number;
    toolCallId: string;
    data?: unknown;
    content?: string | undefined;
    isError?: boolean | undefined;
}, {
    type: "tool.completed";
    durationMs: number;
    toolCallId: string;
    data?: unknown;
    content?: string | undefined;
    isError?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.failed">;
    toolCallId: z.ZodString;
    errorType: z.ZodEnum<["invalid_args", "unknown_tool", "timeout", "aborted", "execution_error"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "tool.failed";
    toolCallId: string;
    errorType: "aborted" | "timeout" | "invalid_args" | "unknown_tool" | "execution_error";
}, {
    message: string;
    type: "tool.failed";
    toolCallId: string;
    errorType: "aborted" | "timeout" | "invalid_args" | "unknown_tool" | "execution_error";
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.spawned">;
    agentId: z.ZodString;
    parentAgentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "agent.spawned";
    agentId: string;
    parentAgentId?: string | undefined;
}, {
    type: "agent.spawned";
    agentId: string;
    parentAgentId?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.progress">;
    agentId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "agent.progress";
    agentId: string;
}, {
    message: string;
    type: "agent.progress";
    agentId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.completed">;
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.completed";
    agentId: string;
}, {
    type: "agent.completed";
    agentId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.followup">;
    agentId: z.ZodString;
    messageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.followup";
    agentId: string;
    messageId: string;
}, {
    type: "agent.followup";
    agentId: string;
    messageId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.report">;
    agentId: z.ZodString;
    message: z.ZodString;
    wake: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "agent.report";
    agentId: string;
    wake: boolean;
}, {
    message: string;
    type: "agent.report";
    agentId: string;
    wake: boolean;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.settled">;
    agentId: z.ZodString;
    outcome: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "agent.settled";
    agentId: string;
    outcome: string;
}, {
    type: "agent.settled";
    agentId: string;
    outcome: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.interrupted">;
    agentId: z.ZodString;
    by: z.ZodEnum<["user", "parent", "system"]>;
}, "strip", z.ZodTypeAny, {
    type: "agent.interrupted";
    agentId: string;
    by: "user" | "system" | "parent";
}, {
    type: "agent.interrupted";
    agentId: string;
    by: "user" | "system" | "parent";
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.triggered">;
    event: z.ZodString;
    hookId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "hook.triggered";
    event: string;
    hookId: string;
}, {
    type: "hook.triggered";
    event: string;
    hookId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.completed">;
    hookId: z.ZodString;
    event: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["ok", "error", "timeout", "aborted"]>>;
}, "strip", z.ZodTypeAny, {
    type: "hook.completed";
    hookId: string;
    status?: "aborted" | "error" | "timeout" | "ok" | undefined;
    durationMs?: number | undefined;
    event?: string | undefined;
}, {
    type: "hook.completed";
    hookId: string;
    status?: "aborted" | "error" | "timeout" | "ok" | undefined;
    durationMs?: number | undefined;
    event?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"hook.blocked">;
    hookId: z.ZodString;
    event: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "hook.blocked";
    reason: string;
    hookId: string;
    durationMs?: number | undefined;
    event?: string | undefined;
}, {
    type: "hook.blocked";
    reason: string;
    hookId: string;
    durationMs?: number | undefined;
    event?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.usage.updated">;
    model: z.ZodString;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodOptional<z.ZodNumber>;
        cacheCreationInputTokens: z.ZodOptional<z.ZodNumber>;
        reasoningOutputTokens: z.ZodOptional<z.ZodNumber>;
        cacheDeletedInputTokens: z.ZodOptional<z.ZodNumber>;
        dims: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        saved: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    }>;
    costUsd: z.ZodOptional<z.ZodNumber>;
    /**
     * 上下文窗口分母(contract-v0.3):签发方(查询环)从装配层
     * 注入的 provider capability.maxContext 透传。状态栏水位 = 最近 prompt
     * 规模 / 本值;缺省时表面层隐藏水位段(或回退装配注入的静态值)。
     * 随 usage 更新携带——/model 热切换后分母随下一轮事件自动矫正。
     */
    contextWindowTokens: z.ZodOptional<z.ZodNumber>;
    /** 签发方 ResolvedModel.provider 透传;缺省时消费端可按 model 反查 */
    provider: z.ZodOptional<z.ZodString>;
    /** 子代理归因(Task 链上抛时由运行器注入;嵌套保留最内层) */
    agentId: z.ZodOptional<z.ZodString>;
    /** 按次计费/按调用归因的工具调用 id(如 Task、WebSearch) */
    toolUseId: z.ZodOptional<z.ZodString>;
    /**
     * 用量目的:非对话主流的模型调用标注来源。词表:'compaction'(上下文
     * 压缩轮)/ 'title'(会话标题生成,contract-v0.8
     * 扩容;辅助任务降档的归因面)/ 'permission_classifier'(LLM 权限
     * 分类器调用)/ 'memory'(记忆四面 fork:提取/固化/晋升/召回
     * 选择;随本地记账闭环扩词)。新目的先扩词表再签发
     * (自由文本仅兜底);缺省即对话主流。
     *
     * 词表分叉注记:同一分类器子系统在 request-
     * measurement 观测面与 TWP 出线面用词 'classifier'(kernel context/
     * request-measurement.ts RequestPurpose、providers twp/contract.ts
     * TWP_PURPOSE_VALUES——现为扁平单表,分版常量已退役),与本词表
     * 'permission_classifier' 属两套近义词并存;且本词当前全仓零签发方
     * (分类器 usage 走遥测与测量面,不落本地 cost 事件)。统一到单一词属
     * 契约面决策,待定;届时 kernel cost/tracker.ts KNOWN_COST_PURPOSES
     * 须同步,勿单侧改词。
     */
    purpose: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cost.usage.updated";
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    };
    provider?: string | undefined;
    agentId?: string | undefined;
    costUsd?: number | undefined;
    contextWindowTokens?: number | undefined;
    toolUseId?: string | undefined;
    purpose?: string | undefined;
}, {
    type: "cost.usage.updated";
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        reasoningOutputTokens?: number | undefined;
        cacheDeletedInputTokens?: number | undefined;
        dims?: Record<string, number> | undefined;
        saved?: string | undefined;
    };
    provider?: string | undefined;
    agentId?: string | undefined;
    costUsd?: number | undefined;
    contextWindowTokens?: number | undefined;
    toolUseId?: string | undefined;
    purpose?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.cache_miss">;
    model: z.ZodString;
    /** 本轮未命中缓存的输入规模(prompt tokens) */
    inputTokens: z.ZodNumber;
    /** 触发告警的输入规模阈值(签发方配置;可观测性) */
    threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "cost.cache_miss";
    model: string;
    inputTokens: number;
    threshold?: number | undefined;
}, {
    type: "cost.cache_miss";
    model: string;
    inputTokens: number;
    threshold?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.model.mismatch">;
    /** 请求申报模型(IRRequest.model.model) */
    requested: z.ZodString;
    /** message_start 实回模型 */
    actual: z.ZodString;
    /** 请求申报 provider(签发方 ResolvedModel.provider 透传;归因辅助) */
    provider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cost.model.mismatch";
    requested: string;
    actual: string;
    provider?: string | undefined;
}, {
    type: "cost.model.mismatch";
    requested: string;
    actual: string;
    provider?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cost.provider.switched">;
    from: z.ZodString;
    to: z.ZodString;
    /** 切换原因;词表锚定 IRErrorKind(rate_limited/auth/server/…),自由文本仅兜底 */
    reason: z.ZodString;
    /** 全链尝试的 entry 数(含最终命中/耗尽的那个) */
    attempts: z.ZodOptional<z.ZodNumber>;
    /** 各落选 entry 的失败轨迹(按链序;kind 复用 IR 错误归一化枚举) */
    failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        provider: z.ZodString;
        kind: z.ZodEnum<["rate_limited", "context_overflow", "auth", "server", "network", "connect", "stream_interrupted", "invalid_request", "policy_denied"]>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }, {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "cost.provider.switched";
    from: string;
    to: string;
    reason: string;
    attempts?: number | undefined;
    failures?: {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }[] | undefined;
}, {
    type: "cost.provider.switched";
    from: string;
    to: string;
    reason: string;
    attempts?: number | undefined;
    failures?: {
        provider: string;
        kind: "rate_limited" | "context_overflow" | "auth" | "server" | "network" | "connect" | "stream_interrupted" | "invalid_request" | "policy_denied";
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.connected">;
    server: z.ZodString;
    transport: z.ZodEnum<["stdio", "http"]>;
    protocolVersion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "mcp.connected";
    server: string;
    transport: "stdio" | "http";
    protocolVersion: string;
}, {
    type: "mcp.connected";
    server: string;
    transport: "stdio" | "http";
    protocolVersion: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.connect_failed">;
    server: z.ZodString;
    /** 错误码;词表锚定 kernel McpErrorCode(connect_failed/handshake_failed/timeout/…) */
    code: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    type: "mcp.connect_failed";
    server: string;
}, {
    code: string;
    message: string;
    type: "mcp.connect_failed";
    server: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.closed">;
    server: z.ZodString;
    reason: z.ZodEnum<["closed", "server_exit", "error"]>;
    detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.closed";
    server: string;
    reason: "error" | "closed" | "server_exit";
    detail?: string | undefined;
}, {
    type: "mcp.closed";
    server: string;
    reason: "error" | "closed" | "server_exit";
    detail?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.elicitation_declined">;
    server: z.ZodString;
    mode: z.ZodEnum<["form", "url"]>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.elicitation_declined";
    server: string;
    mode: "form" | "url";
    message?: string | undefined;
}, {
    type: "mcp.elicitation_declined";
    server: string;
    mode: "form" | "url";
    message?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.tool_skipped">;
    server: z.ZodString;
    tool: z.ZodString;
    reason: z.ZodEnum<["duplicate_name", "invalid_name"]>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.tool_skipped";
    server: string;
    reason: "duplicate_name" | "invalid_name";
    tool: string;
}, {
    type: "mcp.tool_skipped";
    server: string;
    reason: "duplicate_name" | "invalid_name";
    tool: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.discovered">;
    server: z.ZodString;
    phase: z.ZodEnum<["catalog", "expand"]>;
    origin: z.ZodEnum<["catalog-cache", "live"]>;
    tools: z.ZodArray<z.ZodString, "many">;
    durationMs: z.ZodNumber;
    /** 64 字符帽折叠映射(仅 phase='expand' 且发生折叠时携带;审计面) */
    folds: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        bridged: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tool: string;
        bridged: string;
    }, {
        tool: string;
        bridged: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "mcp.discovered";
    tools: string[];
    server: string;
    durationMs: number;
    phase: "catalog" | "expand";
    origin: "catalog-cache" | "live";
    folds?: {
        tool: string;
        bridged: string;
    }[] | undefined;
}, {
    type: "mcp.discovered";
    tools: string[];
    server: string;
    durationMs: number;
    phase: "catalog" | "expand";
    origin: "catalog-cache" | "live";
    folds?: {
        tool: string;
        bridged: string;
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.catalog_updated">;
    server: z.ZodString;
    added: z.ZodNumber;
    removed: z.ZodNumber;
    changed: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.catalog_updated";
    server: string;
    added: number;
    removed: number;
    changed: number;
}, {
    type: "mcp.catalog_updated";
    server: string;
    added: number;
    removed: number;
    changed: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnecting">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempt: z.ZodNumber;
    delayMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnecting";
    server: string;
    connection: number;
    attempt: number;
    delayMs: number;
}, {
    type: "mcp.reconnecting";
    server: string;
    connection: number;
    attempt: number;
    delayMs: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnected">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempt: z.ZodNumber;
    downtimeMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnected";
    server: string;
    connection: number;
    attempt: number;
    downtimeMs: number;
}, {
    type: "mcp.reconnected";
    server: string;
    connection: number;
    attempt: number;
    downtimeMs: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"mcp.reconnect_exhausted">;
    server: z.ZodString;
    connection: z.ZodNumber;
    attempts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "mcp.reconnect_exhausted";
    server: string;
    attempts: number;
    connection: number;
}, {
    type: "mcp.reconnect_exhausted";
    server: string;
    attempts: number;
    connection: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"plan.todo.updated">;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "completed", "cancelled"]>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }, {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "plan.todo.updated";
    items: {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }[];
}, {
    type: "plan.todo.updated";
    items: {
        status: "completed" | "pending" | "in_progress" | "cancelled";
        id: string;
        content: string;
    }[];
}>]>>;
/** 完整内核事件:包络 + 负载(KernelEventSchema 推导)。 */
type KernelEvent = z.infer<typeof KernelEventSchema>;

/**
 * JournalRecord 存储包络
 *
 * 设计要点:
 * ①统一包络取代多形态裸 JSONL;②显式 visibility 四位取代 isMeta/isVirtual 布尔组合;
 * ③Branch/Fork 一等;④completeness 标记支持启动时半行截断检测;
 * ⑤integrity 前哈希链(审计防篡改)。
 */

/**
 * 显式可见性四位:分别控制是否进模型上下文 / 默认转录 /
 * 展开转录 / SDK 输出。取代难组合的 isMeta/isVisibleInTranscriptOnly/isVirtual。
 */
declare const VisibilitySchema: z.ZodObject<{
    model: z.ZodBoolean;
    defaultTranscript: z.ZodBoolean;
    expandedTranscript: z.ZodBoolean;
    sdk: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    model: boolean;
    defaultTranscript: boolean;
    expandedTranscript: boolean;
    sdk: boolean;
}, {
    model: boolean;
    defaultTranscript: boolean;
    expandedTranscript: boolean;
    sdk: boolean;
}>;
/** 记录可见性四位(VisibilitySchema 推导)。 */
type Visibility = z.infer<typeof VisibilitySchema>;
/** 记录完整性:前哈希链(previousHash)+ 本条规范化 SHA-256(hash)。 */
declare const IntegritySchema: z.ZodObject<{
    /** 前一条记录的 hash,构成链;首条为 null */
    previousHash: z.ZodNullable<z.ZodString>;
    /** 本条记录规范化后的 SHA-256 */
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    previousHash: string | null;
    hash: string;
}, {
    previousHash: string | null;
    hash: string;
}>;
/** 记录完整性字段(IntegritySchema 推导)。 */
type Integrity = z.infer<typeof IntegritySchema>;
/** 日志记录种类词表:用户输入、助手消息、工具结果、事件、队列入 / 确认、压缩边界、分叉、文件检查点。 */
declare const JournalKindSchema: z.ZodEnum<["user_prompt", "assistant_message", "tool_result", "event", "queue_enqueue", "queue_ack", "compact_boundary", "fork", "file_checkpoint"]>;
/** 日志记录种类(JournalKindSchema 推导)。 */
type JournalKind = z.infer<typeof JournalKindSchema>;
/** 日志记录统一包络:会话 / 分支 / 序号 / 种类 / 载荷 / 可见性 / 完整性链 / 尾行完整性标记。 */
declare const JournalRecordSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.ZodString;
    sessionId: z.ZodString;
    /** 分支 id;主干为 "main" */
    branchId: z.ZodString;
    seq: z.ZodNumber;
    kind: z.ZodEnum<["user_prompt", "assistant_message", "tool_result", "event", "queue_enqueue", "queue_ack", "compact_boundary", "fork", "file_checkpoint"]>;
    parentEventId: z.ZodNullable<z.ZodString>;
    payload: z.ZodUnknown;
    producer: z.ZodString;
    visibility: z.ZodObject<{
        model: z.ZodBoolean;
        defaultTranscript: z.ZodBoolean;
        expandedTranscript: z.ZodBoolean;
        sdk: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        model: boolean;
        defaultTranscript: boolean;
        expandedTranscript: boolean;
        sdk: boolean;
    }, {
        model: boolean;
        defaultTranscript: boolean;
        expandedTranscript: boolean;
        sdk: boolean;
    }>;
    integrity: z.ZodObject<{
        /** 前一条记录的 hash,构成链;首条为 null */
        previousHash: z.ZodNullable<z.ZodString>;
        /** 本条记录规范化后的 SHA-256 */
        hash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        previousHash: string | null;
        hash: string;
    }, {
        previousHash: string | null;
        hash: string;
    }>;
    /**
     * 尾行完整性(contract-v0.1 修订语义):写入端 v1 恒写 'complete',
     * 半行截断检测依靠 Reader 的 JSON 解析失败判定;'partial' 保留给未来
     * 两阶段写入端,Reader 对尾条 'partial' 同样按崩溃残留截断。
     */
    completeness: z.ZodEnum<["partial", "complete"]>;
}, "strip", z.ZodTypeAny, {
    kind: "tool_result" | "event" | "user_prompt" | "assistant_message" | "queue_enqueue" | "queue_ack" | "compact_boundary" | "fork" | "file_checkpoint";
    sessionId: string;
    seq: number;
    schemaVersion: 1;
    eventId: string;
    branchId: string;
    parentEventId: string | null;
    producer: string;
    visibility: {
        model: boolean;
        defaultTranscript: boolean;
        expandedTranscript: boolean;
        sdk: boolean;
    };
    integrity: {
        previousHash: string | null;
        hash: string;
    };
    completeness: "partial" | "complete";
    payload?: unknown;
}, {
    kind: "tool_result" | "event" | "user_prompt" | "assistant_message" | "queue_enqueue" | "queue_ack" | "compact_boundary" | "fork" | "file_checkpoint";
    sessionId: string;
    seq: number;
    schemaVersion: 1;
    eventId: string;
    branchId: string;
    parentEventId: string | null;
    producer: string;
    visibility: {
        model: boolean;
        defaultTranscript: boolean;
        expandedTranscript: boolean;
        sdk: boolean;
    };
    integrity: {
        previousHash: string | null;
        hash: string;
    };
    completeness: "partial" | "complete";
    payload?: unknown;
}>;
/** 日志记录(JournalRecordSchema 推导)。 */
type JournalRecord = z.infer<typeof JournalRecordSchema>;

/**
 * 配置 schema(五层合并的目标结构)
 *
 * 设计要点:
 * - Provider Profile + capability + 别名三档 + fallback;
 * - 国内厂商 capability 增补:缓存三态 / thinking 改写器 / must_echo_back / modelModifiers / 峰谷计价。
 *
 * 五层合并顺序:managed > 项目 local > 项目 shared > 用户 > 内置。
 */

/**
 * contract-v0.4:增 'openai-responses'——OpenAI Responses API
 * 与 Chat Completions 是不同线协议(item 流 / reasoning 透传 / hosted tools),
 * 配置文件自此可直接声明;providers registry 的类型加宽过渡随本修订退役。
 *
 * 增 'twp'——TANSR 自有线协议 twp/1(/t1/exchange 的
 * SSE t.* 事件语法);平台模型末端消费自此不再内嵌 openai/anthropic 方言,
 * 上游方言转换收敛在 api 服务器网关层。
 */
declare const ProtocolKindSchema: z.ZodEnum<["anthropic", "openai", "openai-responses", "twp"]>;
/** provider 线协议种类(ProtocolKindSchema 推导)。 */
type ProtocolKind = z.infer<typeof ProtocolKindSchema>;
/** 缓存策略三态——非布尔 */
declare const PromptCachingModeSchema: z.ZodEnum<["explicit", "implicit", "ignored"]>;
/** 提示缓存策略:explicit 显式断点 / implicit 服务端自动 / ignored 不支持(PromptCachingModeSchema 推导)。 */
type PromptCachingMode = z.infer<typeof PromptCachingModeSchema>;
/**
 * contract-v0.5(RFC-B3-1):输入形态三态——supported(声明可用)/ rejected
 * (显式拒绝,fail-fast,安全)/ silently_dropped(发出去 200 但内容被静默
 * 丢弃——最危险态,网关须在装配期告警)。
 * 取舍:三态而非布尔——布尔 vision 表达不了「被拒 vs 被静默丢弃」的差异
 * (DeepSeek 图片替换为占位符不报错,doc/10 §4.1 图片行);与缓存三态
 * (PromptCachingMode,doc/10 §4.3「三态,不是布尔」)同一设计先例。
 */
declare const InputModalityModeSchema: z.ZodEnum<["supported", "rejected", "silently_dropped"]>;
type InputModalityMode = z.infer<typeof InputModalityModeSchema>;
declare const CapabilitySchema: z.ZodObject<{
    maxContext: z.ZodNumber;
    /**
     * 实测质量拐点窗口(tokens;与 maxOutput 同律形态)。可选且**无默认值**——undefined =
     * 未实证,消费方沿标称 maxContext(行为零变);声明时装配层窗口合成
     * 取 min(maxContext, effectiveContext)(合成恒在装配层单点,kernel
     * 冻结面不开位)。数据纪律与 maxOutput 同:手工回填须带公开评测出处,
     * 拿不准宁可不录,杜绝编造。
     */
    effectiveContext: z.ZodOptional<z.ZodNumber>;
    /**
     * 单次响应输出上限(tokens;厂商 max_tokens / max_completion_tokens
     * 限额)。contract-v0.15:可选且**无默认值**——
     * undefined = 未知/未实证,消费方自选保守值(压缩输出预算径回退 20K),
     * 与显式数值(官方文档实证)区分,杜绝编造(hostedTools / quirks
     * 新键同先例)。数据纪律:内置表回填
     * 必须带官方出处与查证日期,拿不准的模型宁可不录。
     */
    maxOutput: z.ZodOptional<z.ZodNumber>;
    /**
     * RFC-M3 B2(2026-08-25):思考/推理模型标记(平台目录 capabilities
     * 顶层 reasoning 键 1:1 直通)。可选**无默认值**——undefined = 未声明
     * (fast 形态判定按「能力未知不放行」恒保守);数据纪律同 maxOutput:
     * 登记须有实证出处,杜绝编造。
     */
    reasoning: z.ZodOptional<z.ZodBoolean>;
    /**
     * RFC-M3 B2:思考可关性(仅 reasoning=true 时有意义)——true = 已实证
     * 该模型经请求参数可关思考(如 UCloud qwen3.8-max/kimi-k3 对
     * enable_thinking:false 的 2026-08-25 真金实证);undefined = 未实证
     * (恒保守判不支持 fast 形态,落兜底组);false = 实证不可关。
     * 刻意不复用 thinking.cannotDisable(其缺省 false 会把「未实证」冒充
     * 「可关」——危险缺省,与本键「可选无默认」的数据纪律相悖)。
     */
    thinkingOptional: z.ZodOptional<z.ZodBoolean>;
    /**
     * contract-v0.5 起为 inputModalities.image 的派生别名
     * (vision === (inputModalities.image === 'supported'),providers 合并器
     * 双向同步、同层冲突以 inputModalities 为准);保留一个契约版本,随
     * contract-v1 退役。
     */
    vision: z.ZodDefault<z.ZodBoolean>;
    /**
     * contract-v0.5(RFC-B3-1):输入形态三态谱系。缺省 rejected(保守:未声明
     * 能力的模型由内核附件门在装配期拦下并提示,而非发出去赌厂商行为——
     * 静默语义损失比 fail-fast 更危险)。
     */
    inputModalities: z.ZodDefault<z.ZodObject<{
        image: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
        document: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
    }, "strip", z.ZodTypeAny, {
        image: "supported" | "rejected" | "silently_dropped";
        document: "supported" | "rejected" | "silently_dropped";
    }, {
        image?: "supported" | "rejected" | "silently_dropped" | undefined;
        document?: "supported" | "rejected" | "silently_dropped" | undefined;
    }>>;
    toolChoice: z.ZodDefault<z.ZodBoolean>;
    promptCaching: z.ZodDefault<z.ZodObject<{
        mode: z.ZodDefault<z.ZodEnum<["explicit", "implicit", "ignored"]>>;
        minCacheableTokens: z.ZodOptional<z.ZodNumber>;
        ttlSeconds: z.ZodOptional<z.ZodNumber>;
        maxBreakpoints: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        mode: "explicit" | "implicit" | "ignored";
        minCacheableTokens?: number | undefined;
        ttlSeconds?: number | undefined;
        maxBreakpoints?: number | undefined;
    }, {
        mode?: "explicit" | "implicit" | "ignored" | undefined;
        minCacheableTokens?: number | undefined;
        ttlSeconds?: number | undefined;
        maxBreakpoints?: number | undefined;
    }>>;
    thinking: z.ZodDefault<z.ZodObject<{
        /** 各家开启思考的枚举值不同:"adaptive" / "enabled" / ... */
        toggleValues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        budgetTokens: z.ZodDefault<z.ZodEnum<["honored", "ignored"]>>;
        /**
         * contract-v0.8(RFC-OPT15-3):thinking 预算数值上限(tokens)。effort
         * 档位映射(OPT-15)的 max 档取本值为封顶;缺省 undefined = 未实证/
         * 无上限声明,消费方按档位内置值直用(不编造厂商限额)。
         */
        budgetMaxTokens: z.ZodOptional<z.ZodNumber>;
        /** 强度参数名(如 reasoning_effort / output_config.effort) */
        effortParam: z.ZodOptional<z.ZodString>;
        /** 多轮工具调用必须原样回传 thinking 块,否则 400(Kimi/MiniMax/DeepSeek) */
        mustEchoBack: z.ZodDefault<z.ZodBoolean>;
        /** 该模型无法关闭思考(如 kimi k2.7-code) */
        cannotDisable: z.ZodDefault<z.ZodBoolean>;
        /**
         * contract-v0.5(RFC-B3-4):thinking 块 signature 字段形态三枚举——
         * opaque(不透明密文,Anthropic 官方)/ always_empty(恒空串,Qwen)/
         * absent(字段缺失,Kimi 直连实证)。可选无默认:undefined=未实证,
         * 与显式枚举值(已实证)区分,杜绝编造。
         */
        signatureShape: z.ZodOptional<z.ZodEnum<["opaque", "always_empty", "absent"]>>;
    }, "strip", z.ZodTypeAny, {
        toggleValues: string[];
        budgetTokens: "ignored" | "honored";
        mustEchoBack: boolean;
        cannotDisable: boolean;
        budgetMaxTokens?: number | undefined;
        effortParam?: string | undefined;
        signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
    }, {
        toggleValues?: string[] | undefined;
        budgetTokens?: "ignored" | "honored" | undefined;
        budgetMaxTokens?: number | undefined;
        effortParam?: string | undefined;
        mustEchoBack?: boolean | undefined;
        cannotDisable?: boolean | undefined;
        signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
    }>>;
    sampling: z.ZodDefault<z.ZodObject<{
        /**
         * contract-v0.5(RFC-B3-2):温度合法域对象——可表达开端点(GLM (0,1)/
         * Qwen [0,2)),闭区间元组 temperatureRange 自此降为输入别名(providers
         * 合并器归一为本对象,min/max 双闭)。
         * 取舍:否决区间微语法字符串 "[0,2)"(需手写 parser+refine,配置手写
         * 易错、diff 不友好);四字段对象自描述、zod 原生校验,取后者。
         * 消费语义:未声明 → 网关不 clamp 直透传(宁可厂商 400 显式暴露,不做
         * 无依据改写——maas 网关代改 kimi t=0 放行的实锤即为反例);声明后越界
         * 入参 clamp 至最近合法值(开端点退 clampEpsilon)并发 warn。
         */
        temperature: z.ZodOptional<z.ZodObject<{
            min: z.ZodDefault<z.ZodNumber>;
            max: z.ZodDefault<z.ZodNumber>;
            minExclusive: z.ZodDefault<z.ZodBoolean>;
            maxExclusive: z.ZodDefault<z.ZodBoolean>;
            /** 开端点 clamp 回退步长:clamp(2.0, [0,2)) → 2.0 - epsilon */
            clampEpsilon: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
            minExclusive: boolean;
            maxExclusive: boolean;
            clampEpsilon: number;
        }, {
            min?: number | undefined;
            max?: number | undefined;
            minExclusive?: boolean | undefined;
            maxExclusive?: boolean | undefined;
            clampEpsilon?: number | undefined;
        }>>;
        /** 兼容别名:旧闭区间元组;合并器归一为 temperature 对象(双闭),既有配置零迁移 */
        temperatureRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        /**
         * 固定温度(如 kimi 固定 1.0)。语义注记(contract-v0.5 直连实证):以
         * 严格协议面(openai)为准声明——kimi openai 面非 1.0 一律 400,而
         * anthropic 面静默容忍属厂商侧忽略,不代表参数生效;网关对 fixed 透传
         * 但告警(最少介入,不伪造)。
         */
        temperatureFixed: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        temperature?: {
            min: number;
            max: number;
            minExclusive: boolean;
            maxExclusive: boolean;
            clampEpsilon: number;
        } | undefined;
        temperatureRange?: [number, number] | undefined;
        temperatureFixed?: number | undefined;
    }, {
        temperature?: {
            min?: number | undefined;
            max?: number | undefined;
            minExclusive?: boolean | undefined;
            maxExclusive?: boolean | undefined;
            clampEpsilon?: number | undefined;
        } | undefined;
        temperatureRange?: [number, number] | undefined;
        temperatureFixed?: number | undefined;
    }>>;
    /** 模型名修饰符,如 "[1m]" 表示 1M 上下文后缀 */
    modelModifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** 不加修饰符时的默认上下文(DeepSeek 不加 [1m] 仅 200K) */
    defaultContextWithoutModifier: z.ZodOptional<z.ZodNumber>;
    /**
     * contract-v0.5(RFC-B3-4):封闭键集合扩容(下方六个可选键)。
     * 取舍:否决 `z.record(z.unknown())` 自由袋——消费方无从解读、契约失去
     * 规范力、doctor/i18n 面无法枚举;封闭键 + RFC 扩容与事件族先例(mcp.*
     * 五型)同路线。新键全部可选且不落默认——undefined=「未实证」,与显式
     * false/枚举值(已实证)区分;兼容矩阵(providers compat REPORT)是唯一
     * 实证回填来源。
     */
    quirks: z.ZodDefault<z.ZodObject<{
        /** 未知模型名静默降级到某默认模型(DeepSeek → v4-flash) */
        unknownModelFallback: z.ZodDefault<z.ZodBoolean>;
        /** claude-* 模型名服务端映射 */
        claudeModelNameMapping: z.ZodDefault<z.ZodBoolean>;
        /** messages 数组内出现 role:"system"(Claude Code ≥2.1.154) */
        systemRoleInMessages: z.ZodDefault<z.ZodBoolean>;
        /** stop_sequences 行为三态:honored=命中且 stop_reason=stop_sequence;
         *  misreported_end_turn=生效但误报 end_turn(Qwen/Kimi);ignored=不生效
         *  (MiniMax/Doubao)。适配器不消费(透传不伪造铁律,doc/10 §4.3),
         *  读者是 doctor 命令/文档面。 */
        stopSequences: z.ZodOptional<z.ZodEnum<["honored", "misreported_end_turn", "ignored"]>>;
        /** anthropic 协议侧流式完整 usage 所在事件(Qwen 仅在 message_delta) */
        streamUsageLocation: z.ZodOptional<z.ZodEnum<["message_delta", "message_start", "both"]>>;
        /** Anthropic 风格 count_tokens 端点可用(仅 MiniMax) */
        countTokensEndpoint: z.ZodOptional<z.ZodBoolean>;
        /** OpenAI 侧 GET /models 可列模型(白名单热更新/capability 比对的机器可读源) */
        modelsEndpoint: z.ZodOptional<z.ZodBoolean>;
        /** 思考首 token 显著慢的建议超时下限(ms;适配器/重试 watchdog 消费) */
        minTimeoutMs: z.ZodOptional<z.ZodNumber>;
        /** max_tokens 限额是否不含 reasoning 预算(doubao true 与 kimi/glm false
         *  相反实证;成本预估与截断防御的消费点) */
        maxTokensExcludesReasoning: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        unknownModelFallback: boolean;
        claudeModelNameMapping: boolean;
        systemRoleInMessages: boolean;
        stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
        streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
        countTokensEndpoint?: boolean | undefined;
        modelsEndpoint?: boolean | undefined;
        minTimeoutMs?: number | undefined;
        maxTokensExcludesReasoning?: boolean | undefined;
    }, {
        stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
        unknownModelFallback?: boolean | undefined;
        claudeModelNameMapping?: boolean | undefined;
        systemRoleInMessages?: boolean | undefined;
        streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
        countTokensEndpoint?: boolean | undefined;
        modelsEndpoint?: boolean | undefined;
        minTimeoutMs?: number | undefined;
        maxTokensExcludesReasoning?: boolean | undefined;
    }>>;
    /**
     * contract-v0.4(RFC-B7-2):provider 侧自执行的 hosted 工具单列(如
     * ['web_search','file_search','code_interpreter']),不混入本地工具面。
     * 刻意可选且**无默认值**——缺省 undefined 即「未声明」,不与「声明为空」
     * 混同(providers capability-merge 需区分用户显式配置与 schema 填充)。
     */
    hostedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /**
     * contract-v0.4:Responses `background:true` 异步任务能力位。
     * 同上,可选且无默认值。
     */
    background: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    thinking: {
        toggleValues: string[];
        budgetTokens: "ignored" | "honored";
        mustEchoBack: boolean;
        cannotDisable: boolean;
        budgetMaxTokens?: number | undefined;
        effortParam?: string | undefined;
        signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
    };
    maxContext: number;
    vision: boolean;
    inputModalities: {
        image: "supported" | "rejected" | "silently_dropped";
        document: "supported" | "rejected" | "silently_dropped";
    };
    toolChoice: boolean;
    promptCaching: {
        mode: "explicit" | "implicit" | "ignored";
        minCacheableTokens?: number | undefined;
        ttlSeconds?: number | undefined;
        maxBreakpoints?: number | undefined;
    };
    sampling: {
        temperature?: {
            min: number;
            max: number;
            minExclusive: boolean;
            maxExclusive: boolean;
            clampEpsilon: number;
        } | undefined;
        temperatureRange?: [number, number] | undefined;
        temperatureFixed?: number | undefined;
    };
    modelModifiers: string[];
    quirks: {
        unknownModelFallback: boolean;
        claudeModelNameMapping: boolean;
        systemRoleInMessages: boolean;
        stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
        streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
        countTokensEndpoint?: boolean | undefined;
        modelsEndpoint?: boolean | undefined;
        minTimeoutMs?: number | undefined;
        maxTokensExcludesReasoning?: boolean | undefined;
    };
    effectiveContext?: number | undefined;
    maxOutput?: number | undefined;
    reasoning?: boolean | undefined;
    thinkingOptional?: boolean | undefined;
    defaultContextWithoutModifier?: number | undefined;
    hostedTools?: string[] | undefined;
    background?: boolean | undefined;
}, {
    maxContext: number;
    thinking?: {
        toggleValues?: string[] | undefined;
        budgetTokens?: "ignored" | "honored" | undefined;
        budgetMaxTokens?: number | undefined;
        effortParam?: string | undefined;
        mustEchoBack?: boolean | undefined;
        cannotDisable?: boolean | undefined;
        signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
    } | undefined;
    effectiveContext?: number | undefined;
    maxOutput?: number | undefined;
    reasoning?: boolean | undefined;
    thinkingOptional?: boolean | undefined;
    vision?: boolean | undefined;
    inputModalities?: {
        image?: "supported" | "rejected" | "silently_dropped" | undefined;
        document?: "supported" | "rejected" | "silently_dropped" | undefined;
    } | undefined;
    toolChoice?: boolean | undefined;
    promptCaching?: {
        mode?: "explicit" | "implicit" | "ignored" | undefined;
        minCacheableTokens?: number | undefined;
        ttlSeconds?: number | undefined;
        maxBreakpoints?: number | undefined;
    } | undefined;
    sampling?: {
        temperature?: {
            min?: number | undefined;
            max?: number | undefined;
            minExclusive?: boolean | undefined;
            maxExclusive?: boolean | undefined;
            clampEpsilon?: number | undefined;
        } | undefined;
        temperatureRange?: [number, number] | undefined;
        temperatureFixed?: number | undefined;
    } | undefined;
    modelModifiers?: string[] | undefined;
    defaultContextWithoutModifier?: number | undefined;
    quirks?: {
        stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
        unknownModelFallback?: boolean | undefined;
        claudeModelNameMapping?: boolean | undefined;
        systemRoleInMessages?: boolean | undefined;
        streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
        countTokensEndpoint?: boolean | undefined;
        modelsEndpoint?: boolean | undefined;
        minTimeoutMs?: number | undefined;
        maxTokensExcludesReasoning?: boolean | undefined;
    } | undefined;
    hostedTools?: string[] | undefined;
    background?: boolean | undefined;
}>;
/** 模型能力位(CapabilitySchema 推导;经 schema parse 后默认值已填充)。 */
type Capability = z.infer<typeof CapabilitySchema>;
/** 单模型价格表:每百万 token 的输入 / 缓存输入 / 输出价,可选峰谷倍率与阶梯计价。 */
declare const PricingSchema: z.ZodObject<{
    /** ¥ 或 $ 每百万 token */
    inputPerMillion: z.ZodNumber;
    cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
    outputPerMillion: z.ZodNumber;
    /** 峰谷时段倍率(DeepSeek 高峰翻倍) */
    peakMultiplier: z.ZodOptional<z.ZodNumber>;
    /**
     * contract-v0.5:阶梯计价。缺省 undefined = 扁平计价(现状零
     * 迁移);声明 tiers 时顶层三价约定为**首档镜像**(文档约定不强 refine)——
     * 向前兼容降级语义:无 tiers 感知的旧消费端仍按顶层价近似计费,不炸不偏零。
     */
    tiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        /** 本档输入上限(请求 prompt tokens ≤ upToInputTokens 落本档;末档省略=∞) */
        upToInputTokens: z.ZodOptional<z.ZodNumber>;
        inputPerMillion: z.ZodNumber;
        cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
        outputPerMillion: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inputPerMillion: number;
        outputPerMillion: number;
        upToInputTokens?: number | undefined;
        cachedInputPerMillion?: number | undefined;
    }, {
        inputPerMillion: number;
        outputPerMillion: number;
        upToInputTokens?: number | undefined;
        cachedInputPerMillion?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    inputPerMillion: number;
    outputPerMillion: number;
    cachedInputPerMillion?: number | undefined;
    peakMultiplier?: number | undefined;
    tiers?: {
        inputPerMillion: number;
        outputPerMillion: number;
        upToInputTokens?: number | undefined;
        cachedInputPerMillion?: number | undefined;
    }[] | undefined;
}, {
    inputPerMillion: number;
    outputPerMillion: number;
    cachedInputPerMillion?: number | undefined;
    peakMultiplier?: number | undefined;
    tiers?: {
        inputPerMillion: number;
        outputPerMillion: number;
        upToInputTokens?: number | undefined;
        cachedInputPerMillion?: number | undefined;
    }[] | undefined;
}>;
/** 单模型价格表(PricingSchema 推导)。 */
type Pricing = z.infer<typeof PricingSchema>;
/** provider 档案:线协议、baseUrl、鉴权 env 变量名、角色别名表、能力位与逐模型价格表。 */
declare const ProviderProfileSchema: z.ZodObject<{
    protocol: z.ZodEnum<["anthropic", "openai", "openai-responses", "twp"]>;
    baseUrl: z.ZodString;
    auth: z.ZodOptional<z.ZodObject<{
        env: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        env: string;
    }, {
        env: string;
    }>>;
    /** 角色别名 → 具体模型名 */
    models: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    capability: z.ZodOptional<z.ZodObject<{
        maxContext: z.ZodNumber;
        /**
         * 实测质量拐点窗口(tokens;与 maxOutput 同律形态)。可选且**无默认值**——undefined =
         * 未实证,消费方沿标称 maxContext(行为零变);声明时装配层窗口合成
         * 取 min(maxContext, effectiveContext)(合成恒在装配层单点,kernel
         * 冻结面不开位)。数据纪律与 maxOutput 同:手工回填须带公开评测出处,
         * 拿不准宁可不录,杜绝编造。
         */
        effectiveContext: z.ZodOptional<z.ZodNumber>;
        /**
         * 单次响应输出上限(tokens;厂商 max_tokens / max_completion_tokens
         * 限额)。contract-v0.15:可选且**无默认值**——
         * undefined = 未知/未实证,消费方自选保守值(压缩输出预算径回退 20K),
         * 与显式数值(官方文档实证)区分,杜绝编造(hostedTools / quirks
         * 新键同先例)。数据纪律:内置表回填
         * 必须带官方出处与查证日期,拿不准的模型宁可不录。
         */
        maxOutput: z.ZodOptional<z.ZodNumber>;
        /**
         * RFC-M3 B2(2026-08-25):思考/推理模型标记(平台目录 capabilities
         * 顶层 reasoning 键 1:1 直通)。可选**无默认值**——undefined = 未声明
         * (fast 形态判定按「能力未知不放行」恒保守);数据纪律同 maxOutput:
         * 登记须有实证出处,杜绝编造。
         */
        reasoning: z.ZodOptional<z.ZodBoolean>;
        /**
         * RFC-M3 B2:思考可关性(仅 reasoning=true 时有意义)——true = 已实证
         * 该模型经请求参数可关思考(如 UCloud qwen3.8-max/kimi-k3 对
         * enable_thinking:false 的 2026-08-25 真金实证);undefined = 未实证
         * (恒保守判不支持 fast 形态,落兜底组);false = 实证不可关。
         * 刻意不复用 thinking.cannotDisable(其缺省 false 会把「未实证」冒充
         * 「可关」——危险缺省,与本键「可选无默认」的数据纪律相悖)。
         */
        thinkingOptional: z.ZodOptional<z.ZodBoolean>;
        /**
         * contract-v0.5 起为 inputModalities.image 的派生别名
         * (vision === (inputModalities.image === 'supported'),providers 合并器
         * 双向同步、同层冲突以 inputModalities 为准);保留一个契约版本,随
         * contract-v1 退役。
         */
        vision: z.ZodDefault<z.ZodBoolean>;
        /**
         * contract-v0.5(RFC-B3-1):输入形态三态谱系。缺省 rejected(保守:未声明
         * 能力的模型由内核附件门在装配期拦下并提示,而非发出去赌厂商行为——
         * 静默语义损失比 fail-fast 更危险)。
         */
        inputModalities: z.ZodDefault<z.ZodObject<{
            image: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
            document: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
        }, "strip", z.ZodTypeAny, {
            image: "supported" | "rejected" | "silently_dropped";
            document: "supported" | "rejected" | "silently_dropped";
        }, {
            image?: "supported" | "rejected" | "silently_dropped" | undefined;
            document?: "supported" | "rejected" | "silently_dropped" | undefined;
        }>>;
        toolChoice: z.ZodDefault<z.ZodBoolean>;
        promptCaching: z.ZodDefault<z.ZodObject<{
            mode: z.ZodDefault<z.ZodEnum<["explicit", "implicit", "ignored"]>>;
            minCacheableTokens: z.ZodOptional<z.ZodNumber>;
            ttlSeconds: z.ZodOptional<z.ZodNumber>;
            maxBreakpoints: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            mode: "explicit" | "implicit" | "ignored";
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        }, {
            mode?: "explicit" | "implicit" | "ignored" | undefined;
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        }>>;
        thinking: z.ZodDefault<z.ZodObject<{
            /** 各家开启思考的枚举值不同:"adaptive" / "enabled" / ... */
            toggleValues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            budgetTokens: z.ZodDefault<z.ZodEnum<["honored", "ignored"]>>;
            /**
             * contract-v0.8(RFC-OPT15-3):thinking 预算数值上限(tokens)。effort
             * 档位映射(OPT-15)的 max 档取本值为封顶;缺省 undefined = 未实证/
             * 无上限声明,消费方按档位内置值直用(不编造厂商限额)。
             */
            budgetMaxTokens: z.ZodOptional<z.ZodNumber>;
            /** 强度参数名(如 reasoning_effort / output_config.effort) */
            effortParam: z.ZodOptional<z.ZodString>;
            /** 多轮工具调用必须原样回传 thinking 块,否则 400(Kimi/MiniMax/DeepSeek) */
            mustEchoBack: z.ZodDefault<z.ZodBoolean>;
            /** 该模型无法关闭思考(如 kimi k2.7-code) */
            cannotDisable: z.ZodDefault<z.ZodBoolean>;
            /**
             * contract-v0.5(RFC-B3-4):thinking 块 signature 字段形态三枚举——
             * opaque(不透明密文,Anthropic 官方)/ always_empty(恒空串,Qwen)/
             * absent(字段缺失,Kimi 直连实证)。可选无默认:undefined=未实证,
             * 与显式枚举值(已实证)区分,杜绝编造。
             */
            signatureShape: z.ZodOptional<z.ZodEnum<["opaque", "always_empty", "absent"]>>;
        }, "strip", z.ZodTypeAny, {
            toggleValues: string[];
            budgetTokens: "ignored" | "honored";
            mustEchoBack: boolean;
            cannotDisable: boolean;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        }, {
            toggleValues?: string[] | undefined;
            budgetTokens?: "ignored" | "honored" | undefined;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            mustEchoBack?: boolean | undefined;
            cannotDisable?: boolean | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        }>>;
        sampling: z.ZodDefault<z.ZodObject<{
            /**
             * contract-v0.5(RFC-B3-2):温度合法域对象——可表达开端点(GLM (0,1)/
             * Qwen [0,2)),闭区间元组 temperatureRange 自此降为输入别名(providers
             * 合并器归一为本对象,min/max 双闭)。
             * 取舍:否决区间微语法字符串 "[0,2)"(需手写 parser+refine,配置手写
             * 易错、diff 不友好);四字段对象自描述、zod 原生校验,取后者。
             * 消费语义:未声明 → 网关不 clamp 直透传(宁可厂商 400 显式暴露,不做
             * 无依据改写——maas 网关代改 kimi t=0 放行的实锤即为反例);声明后越界
             * 入参 clamp 至最近合法值(开端点退 clampEpsilon)并发 warn。
             */
            temperature: z.ZodOptional<z.ZodObject<{
                min: z.ZodDefault<z.ZodNumber>;
                max: z.ZodDefault<z.ZodNumber>;
                minExclusive: z.ZodDefault<z.ZodBoolean>;
                maxExclusive: z.ZodDefault<z.ZodBoolean>;
                /** 开端点 clamp 回退步长:clamp(2.0, [0,2)) → 2.0 - epsilon */
                clampEpsilon: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                min: number;
                max: number;
                minExclusive: boolean;
                maxExclusive: boolean;
                clampEpsilon: number;
            }, {
                min?: number | undefined;
                max?: number | undefined;
                minExclusive?: boolean | undefined;
                maxExclusive?: boolean | undefined;
                clampEpsilon?: number | undefined;
            }>>;
            /** 兼容别名:旧闭区间元组;合并器归一为 temperature 对象(双闭),既有配置零迁移 */
            temperatureRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            /**
             * 固定温度(如 kimi 固定 1.0)。语义注记(contract-v0.5 直连实证):以
             * 严格协议面(openai)为准声明——kimi openai 面非 1.0 一律 400,而
             * anthropic 面静默容忍属厂商侧忽略,不代表参数生效;网关对 fixed 透传
             * 但告警(最少介入,不伪造)。
             */
            temperatureFixed: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            temperature?: {
                min: number;
                max: number;
                minExclusive: boolean;
                maxExclusive: boolean;
                clampEpsilon: number;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        }, {
            temperature?: {
                min?: number | undefined;
                max?: number | undefined;
                minExclusive?: boolean | undefined;
                maxExclusive?: boolean | undefined;
                clampEpsilon?: number | undefined;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        }>>;
        /** 模型名修饰符,如 "[1m]" 表示 1M 上下文后缀 */
        modelModifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** 不加修饰符时的默认上下文(DeepSeek 不加 [1m] 仅 200K) */
        defaultContextWithoutModifier: z.ZodOptional<z.ZodNumber>;
        /**
         * contract-v0.5(RFC-B3-4):封闭键集合扩容(下方六个可选键)。
         * 取舍:否决 `z.record(z.unknown())` 自由袋——消费方无从解读、契约失去
         * 规范力、doctor/i18n 面无法枚举;封闭键 + RFC 扩容与事件族先例(mcp.*
         * 五型)同路线。新键全部可选且不落默认——undefined=「未实证」,与显式
         * false/枚举值(已实证)区分;兼容矩阵(providers compat REPORT)是唯一
         * 实证回填来源。
         */
        quirks: z.ZodDefault<z.ZodObject<{
            /** 未知模型名静默降级到某默认模型(DeepSeek → v4-flash) */
            unknownModelFallback: z.ZodDefault<z.ZodBoolean>;
            /** claude-* 模型名服务端映射 */
            claudeModelNameMapping: z.ZodDefault<z.ZodBoolean>;
            /** messages 数组内出现 role:"system"(Claude Code ≥2.1.154) */
            systemRoleInMessages: z.ZodDefault<z.ZodBoolean>;
            /** stop_sequences 行为三态:honored=命中且 stop_reason=stop_sequence;
             *  misreported_end_turn=生效但误报 end_turn(Qwen/Kimi);ignored=不生效
             *  (MiniMax/Doubao)。适配器不消费(透传不伪造铁律,doc/10 §4.3),
             *  读者是 doctor 命令/文档面。 */
            stopSequences: z.ZodOptional<z.ZodEnum<["honored", "misreported_end_turn", "ignored"]>>;
            /** anthropic 协议侧流式完整 usage 所在事件(Qwen 仅在 message_delta) */
            streamUsageLocation: z.ZodOptional<z.ZodEnum<["message_delta", "message_start", "both"]>>;
            /** Anthropic 风格 count_tokens 端点可用(仅 MiniMax) */
            countTokensEndpoint: z.ZodOptional<z.ZodBoolean>;
            /** OpenAI 侧 GET /models 可列模型(白名单热更新/capability 比对的机器可读源) */
            modelsEndpoint: z.ZodOptional<z.ZodBoolean>;
            /** 思考首 token 显著慢的建议超时下限(ms;适配器/重试 watchdog 消费) */
            minTimeoutMs: z.ZodOptional<z.ZodNumber>;
            /** max_tokens 限额是否不含 reasoning 预算(doubao true 与 kimi/glm false
             *  相反实证;成本预估与截断防御的消费点) */
            maxTokensExcludesReasoning: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            unknownModelFallback: boolean;
            claudeModelNameMapping: boolean;
            systemRoleInMessages: boolean;
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        }, {
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            unknownModelFallback?: boolean | undefined;
            claudeModelNameMapping?: boolean | undefined;
            systemRoleInMessages?: boolean | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        }>>;
        /**
         * contract-v0.4(RFC-B7-2):provider 侧自执行的 hosted 工具单列(如
         * ['web_search','file_search','code_interpreter']),不混入本地工具面。
         * 刻意可选且**无默认值**——缺省 undefined 即「未声明」,不与「声明为空」
         * 混同(providers capability-merge 需区分用户显式配置与 schema 填充)。
         */
        hostedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /**
         * contract-v0.4:Responses `background:true` 异步任务能力位。
         * 同上,可选且无默认值。
         */
        background: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        thinking: {
            toggleValues: string[];
            budgetTokens: "ignored" | "honored";
            mustEchoBack: boolean;
            cannotDisable: boolean;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        };
        maxContext: number;
        vision: boolean;
        inputModalities: {
            image: "supported" | "rejected" | "silently_dropped";
            document: "supported" | "rejected" | "silently_dropped";
        };
        toolChoice: boolean;
        promptCaching: {
            mode: "explicit" | "implicit" | "ignored";
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        };
        sampling: {
            temperature?: {
                min: number;
                max: number;
                minExclusive: boolean;
                maxExclusive: boolean;
                clampEpsilon: number;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        };
        modelModifiers: string[];
        quirks: {
            unknownModelFallback: boolean;
            claudeModelNameMapping: boolean;
            systemRoleInMessages: boolean;
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        };
        effectiveContext?: number | undefined;
        maxOutput?: number | undefined;
        reasoning?: boolean | undefined;
        thinkingOptional?: boolean | undefined;
        defaultContextWithoutModifier?: number | undefined;
        hostedTools?: string[] | undefined;
        background?: boolean | undefined;
    }, {
        maxContext: number;
        thinking?: {
            toggleValues?: string[] | undefined;
            budgetTokens?: "ignored" | "honored" | undefined;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            mustEchoBack?: boolean | undefined;
            cannotDisable?: boolean | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        } | undefined;
        effectiveContext?: number | undefined;
        maxOutput?: number | undefined;
        reasoning?: boolean | undefined;
        thinkingOptional?: boolean | undefined;
        vision?: boolean | undefined;
        inputModalities?: {
            image?: "supported" | "rejected" | "silently_dropped" | undefined;
            document?: "supported" | "rejected" | "silently_dropped" | undefined;
        } | undefined;
        toolChoice?: boolean | undefined;
        promptCaching?: {
            mode?: "explicit" | "implicit" | "ignored" | undefined;
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        } | undefined;
        sampling?: {
            temperature?: {
                min?: number | undefined;
                max?: number | undefined;
                minExclusive?: boolean | undefined;
                maxExclusive?: boolean | undefined;
                clampEpsilon?: number | undefined;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        } | undefined;
        modelModifiers?: string[] | undefined;
        defaultContextWithoutModifier?: number | undefined;
        quirks?: {
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            unknownModelFallback?: boolean | undefined;
            claudeModelNameMapping?: boolean | undefined;
            systemRoleInMessages?: boolean | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        } | undefined;
        hostedTools?: string[] | undefined;
        background?: boolean | undefined;
    }>>;
    pricing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        /** ¥ 或 $ 每百万 token */
        inputPerMillion: z.ZodNumber;
        cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
        outputPerMillion: z.ZodNumber;
        /** 峰谷时段倍率(DeepSeek 高峰翻倍) */
        peakMultiplier: z.ZodOptional<z.ZodNumber>;
        /**
         * contract-v0.5:阶梯计价。缺省 undefined = 扁平计价(现状零
         * 迁移);声明 tiers 时顶层三价约定为**首档镜像**(文档约定不强 refine)——
         * 向前兼容降级语义:无 tiers 感知的旧消费端仍按顶层价近似计费,不炸不偏零。
         */
        tiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 本档输入上限(请求 prompt tokens ≤ upToInputTokens 落本档;末档省略=∞) */
            upToInputTokens: z.ZodOptional<z.ZodNumber>;
            inputPerMillion: z.ZodNumber;
            cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
            outputPerMillion: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }, {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        inputPerMillion: number;
        outputPerMillion: number;
        cachedInputPerMillion?: number | undefined;
        peakMultiplier?: number | undefined;
        tiers?: {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }[] | undefined;
    }, {
        inputPerMillion: number;
        outputPerMillion: number;
        cachedInputPerMillion?: number | undefined;
        peakMultiplier?: number | undefined;
        tiers?: {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }[] | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    protocol: "anthropic" | "openai" | "openai-responses" | "twp";
    baseUrl: string;
    models: Record<string, string>;
    auth?: {
        env: string;
    } | undefined;
    capability?: {
        thinking: {
            toggleValues: string[];
            budgetTokens: "ignored" | "honored";
            mustEchoBack: boolean;
            cannotDisable: boolean;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        };
        maxContext: number;
        vision: boolean;
        inputModalities: {
            image: "supported" | "rejected" | "silently_dropped";
            document: "supported" | "rejected" | "silently_dropped";
        };
        toolChoice: boolean;
        promptCaching: {
            mode: "explicit" | "implicit" | "ignored";
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        };
        sampling: {
            temperature?: {
                min: number;
                max: number;
                minExclusive: boolean;
                maxExclusive: boolean;
                clampEpsilon: number;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        };
        modelModifiers: string[];
        quirks: {
            unknownModelFallback: boolean;
            claudeModelNameMapping: boolean;
            systemRoleInMessages: boolean;
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        };
        effectiveContext?: number | undefined;
        maxOutput?: number | undefined;
        reasoning?: boolean | undefined;
        thinkingOptional?: boolean | undefined;
        defaultContextWithoutModifier?: number | undefined;
        hostedTools?: string[] | undefined;
        background?: boolean | undefined;
    } | undefined;
    pricing?: Record<string, {
        inputPerMillion: number;
        outputPerMillion: number;
        cachedInputPerMillion?: number | undefined;
        peakMultiplier?: number | undefined;
        tiers?: {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }[] | undefined;
    }> | undefined;
}, {
    protocol: "anthropic" | "openai" | "openai-responses" | "twp";
    baseUrl: string;
    auth?: {
        env: string;
    } | undefined;
    models?: Record<string, string> | undefined;
    capability?: {
        maxContext: number;
        thinking?: {
            toggleValues?: string[] | undefined;
            budgetTokens?: "ignored" | "honored" | undefined;
            budgetMaxTokens?: number | undefined;
            effortParam?: string | undefined;
            mustEchoBack?: boolean | undefined;
            cannotDisable?: boolean | undefined;
            signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
        } | undefined;
        effectiveContext?: number | undefined;
        maxOutput?: number | undefined;
        reasoning?: boolean | undefined;
        thinkingOptional?: boolean | undefined;
        vision?: boolean | undefined;
        inputModalities?: {
            image?: "supported" | "rejected" | "silently_dropped" | undefined;
            document?: "supported" | "rejected" | "silently_dropped" | undefined;
        } | undefined;
        toolChoice?: boolean | undefined;
        promptCaching?: {
            mode?: "explicit" | "implicit" | "ignored" | undefined;
            minCacheableTokens?: number | undefined;
            ttlSeconds?: number | undefined;
            maxBreakpoints?: number | undefined;
        } | undefined;
        sampling?: {
            temperature?: {
                min?: number | undefined;
                max?: number | undefined;
                minExclusive?: boolean | undefined;
                maxExclusive?: boolean | undefined;
                clampEpsilon?: number | undefined;
            } | undefined;
            temperatureRange?: [number, number] | undefined;
            temperatureFixed?: number | undefined;
        } | undefined;
        modelModifiers?: string[] | undefined;
        defaultContextWithoutModifier?: number | undefined;
        quirks?: {
            stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
            unknownModelFallback?: boolean | undefined;
            claudeModelNameMapping?: boolean | undefined;
            systemRoleInMessages?: boolean | undefined;
            streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
            countTokensEndpoint?: boolean | undefined;
            modelsEndpoint?: boolean | undefined;
            minTimeoutMs?: number | undefined;
            maxTokensExcludesReasoning?: boolean | undefined;
        } | undefined;
        hostedTools?: string[] | undefined;
        background?: boolean | undefined;
    } | undefined;
    pricing?: Record<string, {
        inputPerMillion: number;
        outputPerMillion: number;
        cachedInputPerMillion?: number | undefined;
        peakMultiplier?: number | undefined;
        tiers?: {
            inputPerMillion: number;
            outputPerMillion: number;
            upToInputTokens?: number | undefined;
            cachedInputPerMillion?: number | undefined;
        }[] | undefined;
    }> | undefined;
}>;
/** provider 档案(ProviderProfileSchema 推导)。 */
type ProviderProfile = z.infer<typeof ProviderProfileSchema>;
/**
 * MCP 逐台连接治理键(contract-v0.21,RFC-SC-2;两 transport 共用,与
 * kernel tools/mcp 池/重连选项同字面量):
 * - pool:连接池——connections 1–16(有会话态的服务器恒 1;stdio 多连 = 多 spawn
 *   同一命令,http 多连 = 多 session 同一 URL)/ 每连接在飞上限 / 排队超时;
 * - reconnect:自动重连——enabled(缺省开)/ 退避 initial→max(ms)/ maxAttempts
 *   (null = 无限;JSON 可表达,不用 Infinity)。
 * 键缺席 = kernel lazy-manager 缺省(与 SC-31 现状逐值相同:connections 1、
 * enabled true、1000→60000、无限;schema 不落默认值——undefined 与显式值可
 * 区分)。优先级:逐台键 > 程序面全体同值 > serve 进程级 env > 缺省。两键组
 * 参与 server 配置指纹(与 load/toolAllowlist 同律)。运行期装配逐层容错抽取
 * (坏键/越界值剔除 + 诊断),不以本 schema parse 失败为准。
 */
declare const McpServerGovernanceOptionKeys: {
    readonly pool: z.ZodOptional<z.ZodObject<{
        connections: z.ZodOptional<z.ZodNumber>;
        maxInflightPerConnection: z.ZodOptional<z.ZodNumber>;
        queueTimeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        connections?: number | undefined;
        maxInflightPerConnection?: number | undefined;
        queueTimeoutMs?: number | undefined;
    }, {
        connections?: number | undefined;
        maxInflightPerConnection?: number | undefined;
        queueTimeoutMs?: number | undefined;
    }>>;
    readonly reconnect: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        initialBackoffMs: z.ZodOptional<z.ZodNumber>;
        maxBackoffMs: z.ZodOptional<z.ZodNumber>;
        maxAttempts: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "strict", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        initialBackoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        maxAttempts?: number | null | undefined;
    }, {
        enabled?: boolean | undefined;
        initialBackoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        maxAttempts?: number | null | undefined;
    }>>;
};
type McpServerPoolConfig = NonNullable<z.infer<typeof McpServerGovernanceOptionKeys.pool>>;
type McpServerReconnectConfig = NonNullable<z.infer<typeof McpServerGovernanceOptionKeys.reconnect>>;
declare const PermissionModeSchema: z.ZodEnum<["default", "acceptEdits", "plan", "bypassPermissions", "auto", "dontAsk"]>;
type PermissionModeName = z.infer<typeof PermissionModeSchema>;
declare const TansrConfigSchema: z.ZodObject<{
    $schemaVersion: z.ZodDefault<z.ZodLiteral<1>>;
    providers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        protocol: z.ZodEnum<["anthropic", "openai", "openai-responses", "twp"]>;
        baseUrl: z.ZodString;
        auth: z.ZodOptional<z.ZodObject<{
            env: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            env: string;
        }, {
            env: string;
        }>>;
        /** 角色别名 → 具体模型名 */
        models: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        capability: z.ZodOptional<z.ZodObject<{
            maxContext: z.ZodNumber;
            /**
             * 实测质量拐点窗口(tokens;与 maxOutput 同律形态)。可选且**无默认值**——undefined =
             * 未实证,消费方沿标称 maxContext(行为零变);声明时装配层窗口合成
             * 取 min(maxContext, effectiveContext)(合成恒在装配层单点,kernel
             * 冻结面不开位)。数据纪律与 maxOutput 同:手工回填须带公开评测出处,
             * 拿不准宁可不录,杜绝编造。
             */
            effectiveContext: z.ZodOptional<z.ZodNumber>;
            /**
             * 单次响应输出上限(tokens;厂商 max_tokens / max_completion_tokens
             * 限额)。contract-v0.15:可选且**无默认值**——
             * undefined = 未知/未实证,消费方自选保守值(压缩输出预算径回退 20K),
             * 与显式数值(官方文档实证)区分,杜绝编造(hostedTools / quirks
             * 新键同先例)。数据纪律:内置表回填
             * 必须带官方出处与查证日期,拿不准的模型宁可不录。
             */
            maxOutput: z.ZodOptional<z.ZodNumber>;
            /**
             * RFC-M3 B2(2026-08-25):思考/推理模型标记(平台目录 capabilities
             * 顶层 reasoning 键 1:1 直通)。可选**无默认值**——undefined = 未声明
             * (fast 形态判定按「能力未知不放行」恒保守);数据纪律同 maxOutput:
             * 登记须有实证出处,杜绝编造。
             */
            reasoning: z.ZodOptional<z.ZodBoolean>;
            /**
             * RFC-M3 B2:思考可关性(仅 reasoning=true 时有意义)——true = 已实证
             * 该模型经请求参数可关思考(如 UCloud qwen3.8-max/kimi-k3 对
             * enable_thinking:false 的 2026-08-25 真金实证);undefined = 未实证
             * (恒保守判不支持 fast 形态,落兜底组);false = 实证不可关。
             * 刻意不复用 thinking.cannotDisable(其缺省 false 会把「未实证」冒充
             * 「可关」——危险缺省,与本键「可选无默认」的数据纪律相悖)。
             */
            thinkingOptional: z.ZodOptional<z.ZodBoolean>;
            /**
             * contract-v0.5 起为 inputModalities.image 的派生别名
             * (vision === (inputModalities.image === 'supported'),providers 合并器
             * 双向同步、同层冲突以 inputModalities 为准);保留一个契约版本,随
             * contract-v1 退役。
             */
            vision: z.ZodDefault<z.ZodBoolean>;
            /**
             * contract-v0.5(RFC-B3-1):输入形态三态谱系。缺省 rejected(保守:未声明
             * 能力的模型由内核附件门在装配期拦下并提示,而非发出去赌厂商行为——
             * 静默语义损失比 fail-fast 更危险)。
             */
            inputModalities: z.ZodDefault<z.ZodObject<{
                image: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
                document: z.ZodDefault<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
            }, "strip", z.ZodTypeAny, {
                image: "supported" | "rejected" | "silently_dropped";
                document: "supported" | "rejected" | "silently_dropped";
            }, {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            }>>;
            toolChoice: z.ZodDefault<z.ZodBoolean>;
            promptCaching: z.ZodDefault<z.ZodObject<{
                mode: z.ZodDefault<z.ZodEnum<["explicit", "implicit", "ignored"]>>;
                minCacheableTokens: z.ZodOptional<z.ZodNumber>;
                ttlSeconds: z.ZodOptional<z.ZodNumber>;
                maxBreakpoints: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                mode: "explicit" | "implicit" | "ignored";
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            }, {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            }>>;
            thinking: z.ZodDefault<z.ZodObject<{
                /** 各家开启思考的枚举值不同:"adaptive" / "enabled" / ... */
                toggleValues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                budgetTokens: z.ZodDefault<z.ZodEnum<["honored", "ignored"]>>;
                /**
                 * contract-v0.8(RFC-OPT15-3):thinking 预算数值上限(tokens)。effort
                 * 档位映射(OPT-15)的 max 档取本值为封顶;缺省 undefined = 未实证/
                 * 无上限声明,消费方按档位内置值直用(不编造厂商限额)。
                 */
                budgetMaxTokens: z.ZodOptional<z.ZodNumber>;
                /** 强度参数名(如 reasoning_effort / output_config.effort) */
                effortParam: z.ZodOptional<z.ZodString>;
                /** 多轮工具调用必须原样回传 thinking 块,否则 400(Kimi/MiniMax/DeepSeek) */
                mustEchoBack: z.ZodDefault<z.ZodBoolean>;
                /** 该模型无法关闭思考(如 kimi k2.7-code) */
                cannotDisable: z.ZodDefault<z.ZodBoolean>;
                /**
                 * contract-v0.5(RFC-B3-4):thinking 块 signature 字段形态三枚举——
                 * opaque(不透明密文,Anthropic 官方)/ always_empty(恒空串,Qwen)/
                 * absent(字段缺失,Kimi 直连实证)。可选无默认:undefined=未实证,
                 * 与显式枚举值(已实证)区分,杜绝编造。
                 */
                signatureShape: z.ZodOptional<z.ZodEnum<["opaque", "always_empty", "absent"]>>;
            }, "strip", z.ZodTypeAny, {
                toggleValues: string[];
                budgetTokens: "ignored" | "honored";
                mustEchoBack: boolean;
                cannotDisable: boolean;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            }, {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            }>>;
            sampling: z.ZodDefault<z.ZodObject<{
                /**
                 * contract-v0.5(RFC-B3-2):温度合法域对象——可表达开端点(GLM (0,1)/
                 * Qwen [0,2)),闭区间元组 temperatureRange 自此降为输入别名(providers
                 * 合并器归一为本对象,min/max 双闭)。
                 * 取舍:否决区间微语法字符串 "[0,2)"(需手写 parser+refine,配置手写
                 * 易错、diff 不友好);四字段对象自描述、zod 原生校验,取后者。
                 * 消费语义:未声明 → 网关不 clamp 直透传(宁可厂商 400 显式暴露,不做
                 * 无依据改写——maas 网关代改 kimi t=0 放行的实锤即为反例);声明后越界
                 * 入参 clamp 至最近合法值(开端点退 clampEpsilon)并发 warn。
                 */
                temperature: z.ZodOptional<z.ZodObject<{
                    min: z.ZodDefault<z.ZodNumber>;
                    max: z.ZodDefault<z.ZodNumber>;
                    minExclusive: z.ZodDefault<z.ZodBoolean>;
                    maxExclusive: z.ZodDefault<z.ZodBoolean>;
                    /** 开端点 clamp 回退步长:clamp(2.0, [0,2)) → 2.0 - epsilon */
                    clampEpsilon: z.ZodDefault<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    min: number;
                    max: number;
                    minExclusive: boolean;
                    maxExclusive: boolean;
                    clampEpsilon: number;
                }, {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                }>>;
                /** 兼容别名:旧闭区间元组;合并器归一为 temperature 对象(双闭),既有配置零迁移 */
                temperatureRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
                /**
                 * 固定温度(如 kimi 固定 1.0)。语义注记(contract-v0.5 直连实证):以
                 * 严格协议面(openai)为准声明——kimi openai 面非 1.0 一律 400,而
                 * anthropic 面静默容忍属厂商侧忽略,不代表参数生效;网关对 fixed 透传
                 * 但告警(最少介入,不伪造)。
                 */
                temperatureFixed: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                temperature?: {
                    min: number;
                    max: number;
                    minExclusive: boolean;
                    maxExclusive: boolean;
                    clampEpsilon: number;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            }, {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            }>>;
            /** 模型名修饰符,如 "[1m]" 表示 1M 上下文后缀 */
            modelModifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** 不加修饰符时的默认上下文(DeepSeek 不加 [1m] 仅 200K) */
            defaultContextWithoutModifier: z.ZodOptional<z.ZodNumber>;
            /**
             * contract-v0.5(RFC-B3-4):封闭键集合扩容(下方六个可选键)。
             * 取舍:否决 `z.record(z.unknown())` 自由袋——消费方无从解读、契约失去
             * 规范力、doctor/i18n 面无法枚举;封闭键 + RFC 扩容与事件族先例(mcp.*
             * 五型)同路线。新键全部可选且不落默认——undefined=「未实证」,与显式
             * false/枚举值(已实证)区分;兼容矩阵(providers compat REPORT)是唯一
             * 实证回填来源。
             */
            quirks: z.ZodDefault<z.ZodObject<{
                /** 未知模型名静默降级到某默认模型(DeepSeek → v4-flash) */
                unknownModelFallback: z.ZodDefault<z.ZodBoolean>;
                /** claude-* 模型名服务端映射 */
                claudeModelNameMapping: z.ZodDefault<z.ZodBoolean>;
                /** messages 数组内出现 role:"system"(Claude Code ≥2.1.154) */
                systemRoleInMessages: z.ZodDefault<z.ZodBoolean>;
                /** stop_sequences 行为三态:honored=命中且 stop_reason=stop_sequence;
                 *  misreported_end_turn=生效但误报 end_turn(Qwen/Kimi);ignored=不生效
                 *  (MiniMax/Doubao)。适配器不消费(透传不伪造铁律,doc/10 §4.3),
                 *  读者是 doctor 命令/文档面。 */
                stopSequences: z.ZodOptional<z.ZodEnum<["honored", "misreported_end_turn", "ignored"]>>;
                /** anthropic 协议侧流式完整 usage 所在事件(Qwen 仅在 message_delta) */
                streamUsageLocation: z.ZodOptional<z.ZodEnum<["message_delta", "message_start", "both"]>>;
                /** Anthropic 风格 count_tokens 端点可用(仅 MiniMax) */
                countTokensEndpoint: z.ZodOptional<z.ZodBoolean>;
                /** OpenAI 侧 GET /models 可列模型(白名单热更新/capability 比对的机器可读源) */
                modelsEndpoint: z.ZodOptional<z.ZodBoolean>;
                /** 思考首 token 显著慢的建议超时下限(ms;适配器/重试 watchdog 消费) */
                minTimeoutMs: z.ZodOptional<z.ZodNumber>;
                /** max_tokens 限额是否不含 reasoning 预算(doubao true 与 kimi/glm false
                 *  相反实证;成本预估与截断防御的消费点) */
                maxTokensExcludesReasoning: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                unknownModelFallback: boolean;
                claudeModelNameMapping: boolean;
                systemRoleInMessages: boolean;
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            }, {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            }>>;
            /**
             * contract-v0.4(RFC-B7-2):provider 侧自执行的 hosted 工具单列(如
             * ['web_search','file_search','code_interpreter']),不混入本地工具面。
             * 刻意可选且**无默认值**——缺省 undefined 即「未声明」,不与「声明为空」
             * 混同(providers capability-merge 需区分用户显式配置与 schema 填充)。
             */
            hostedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            /**
             * contract-v0.4:Responses `background:true` 异步任务能力位。
             * 同上,可选且无默认值。
             */
            background: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            thinking: {
                toggleValues: string[];
                budgetTokens: "ignored" | "honored";
                mustEchoBack: boolean;
                cannotDisable: boolean;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            };
            maxContext: number;
            vision: boolean;
            inputModalities: {
                image: "supported" | "rejected" | "silently_dropped";
                document: "supported" | "rejected" | "silently_dropped";
            };
            toolChoice: boolean;
            promptCaching: {
                mode: "explicit" | "implicit" | "ignored";
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            };
            sampling: {
                temperature?: {
                    min: number;
                    max: number;
                    minExclusive: boolean;
                    maxExclusive: boolean;
                    clampEpsilon: number;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            };
            modelModifiers: string[];
            quirks: {
                unknownModelFallback: boolean;
                claudeModelNameMapping: boolean;
                systemRoleInMessages: boolean;
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            };
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            defaultContextWithoutModifier?: number | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        }, {
            maxContext: number;
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        }>>;
        pricing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            /** ¥ 或 $ 每百万 token */
            inputPerMillion: z.ZodNumber;
            cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
            outputPerMillion: z.ZodNumber;
            /** 峰谷时段倍率(DeepSeek 高峰翻倍) */
            peakMultiplier: z.ZodOptional<z.ZodNumber>;
            /**
             * contract-v0.5:阶梯计价。缺省 undefined = 扁平计价(现状零
             * 迁移);声明 tiers 时顶层三价约定为**首档镜像**(文档约定不强 refine)——
             * 向前兼容降级语义:无 tiers 感知的旧消费端仍按顶层价近似计费,不炸不偏零。
             */
            tiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                /** 本档输入上限(请求 prompt tokens ≤ upToInputTokens 落本档;末档省略=∞) */
                upToInputTokens: z.ZodOptional<z.ZodNumber>;
                inputPerMillion: z.ZodNumber;
                cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
                outputPerMillion: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }, {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        models: Record<string, string>;
        auth?: {
            env: string;
        } | undefined;
        capability?: {
            thinking: {
                toggleValues: string[];
                budgetTokens: "ignored" | "honored";
                mustEchoBack: boolean;
                cannotDisable: boolean;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            };
            maxContext: number;
            vision: boolean;
            inputModalities: {
                image: "supported" | "rejected" | "silently_dropped";
                document: "supported" | "rejected" | "silently_dropped";
            };
            toolChoice: boolean;
            promptCaching: {
                mode: "explicit" | "implicit" | "ignored";
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            };
            sampling: {
                temperature?: {
                    min: number;
                    max: number;
                    minExclusive: boolean;
                    maxExclusive: boolean;
                    clampEpsilon: number;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            };
            modelModifiers: string[];
            quirks: {
                unknownModelFallback: boolean;
                claudeModelNameMapping: boolean;
                systemRoleInMessages: boolean;
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            };
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            defaultContextWithoutModifier?: number | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        auth?: {
            env: string;
        } | undefined;
        models?: Record<string, string> | undefined;
        capability?: {
            maxContext: number;
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }>>>;
    /** 三档别名,内核只认别名 */
    modelAliases: z.ZodDefault<z.ZodObject<{
        main: z.ZodOptional<z.ZodString>;
        fast: z.ZodOptional<z.ZodString>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    }, {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    }>>;
    fallbacks: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
    locale: z.ZodOptional<z.ZodString>;
    /**
     * 生命周期 hooks(contract-v0.3)。分层合并语义特殊:不走深合并,
     * 由 kernel 逐层抽取(条目按层优先级稳定排序、跨层同构去重、managed 控制
     * 位治理),详见 kernel hooks/config.ts。
     */
    hooks: z.ZodOptional<z.ZodObject<{
        SessionStart: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PreToolUse: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PostToolUse: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        Stop: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        SessionEnd: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        /**
         * 权限扩展点两事件(contract-v0.13;
         * 运行期 kernel HOOK_EVENTS 已为八事件,此处规范性描述
         * 补齐;词表一致性由 schema × HOOK_EVENTS 锁测试把守):
         * - PermissionRequest:ask 终局呈现前的最后收紧缝(只收紧,allow 忽略+告警);
         * - PermissionDenied:deny 终局后的纯通知缝(结构化响应不消费)。
         */
        PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PermissionDenied: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** 触发过滤器(PreToolUse/PostToolUse 比对 tool 名等);缺省全匹配 */
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                /** exec-form argv 数组,首元素为可执行文件路径/名;不经系统 shell */
                command: z.ZodArray<z.ZodString, "many">;
                /** 单 hook 超时覆盖(毫秒);缺省用引擎默认(60s) */
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                /** 仅 http/https;私网字面量等执行期边线由引擎把守 */
                url: z.ZodString;
                /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并按秘密脱敏 */
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        /** 禁用一切 hooks;仅 managed 层被尊重(下层声明忽略并示警) */
        disableAllHooks: z.ZodOptional<z.ZodBoolean>;
        /** 仅 managed 层 hooks 生效;仅 managed 层被尊重 */
        allowManagedHooksOnly: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        SessionStart?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PreToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PostToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        Stop?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        SessionEnd?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionRequest?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionDenied?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    }, {
        SessionStart?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PreToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PostToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        Stop?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        SessionEnd?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionRequest?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionDenied?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    }>>;
    /**
     * MCP 服务器清单(contract-v0.4)。分层合并语义特殊:不走深合并,
     * 由 kernel 逐层抽取(跨层同名高层胜 + 信任门分层归因),详见 kernel
     * tools/mcp/config.ts 与 cli assembly/mcp-trust.ts。
     */
    mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<"transport", [z.ZodObject<{
        pool: z.ZodOptional<z.ZodObject<{
            connections: z.ZodOptional<z.ZodNumber>;
            maxInflightPerConnection: z.ZodOptional<z.ZodNumber>;
            queueTimeoutMs: z.ZodOptional<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }>>;
        reconnect: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            initialBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxAttempts: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strict", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }>>;
        load: z.ZodOptional<z.ZodEnum<["lazy", "eager"]>>;
        toolAllowlist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        transport: z.ZodLiteral<"stdio">;
        /** 可执行文件路径/名(单串;参数走 args——不经系统 shell,杜绝注入面) */
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** 子进程附加环境;值恰为 `${VAR}` 形态时执行期从环境解析 */
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }>, z.ZodObject<{
        pool: z.ZodOptional<z.ZodObject<{
            connections: z.ZodOptional<z.ZodNumber>;
            maxInflightPerConnection: z.ZodOptional<z.ZodNumber>;
            queueTimeoutMs: z.ZodOptional<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }>>;
        reconnect: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            initialBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxAttempts: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strict", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }>>;
        load: z.ZodOptional<z.ZodEnum<["lazy", "eager"]>>;
        toolAllowlist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        transport: z.ZodLiteral<"http">;
        /** 仅 http/https;私网/SSRF 边线由执行期把守(与 hooks http 同语义) */
        url: z.ZodString;
        /** 附加请求头;值恰为 `${VAR}` 形态时执行期从环境解析并按秘密脱敏 */
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }, {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }>]>>>;
    /**
     * 权限规则与模式(contract-v0.6,RFC-G1-2)。分层合并语义特殊:不走深合并,
     * 由 kernel 逐层抽取(各层规则保留、按配置层 → 引擎层映射喂权限引擎,
     * defaultMode 取最高有效层),详见 kernel config/permissions.ts。
     */
    permissions: z.ZodOptional<z.ZodObject<{
        /** 允许规则(权限 DSL 串);显式空数组 ≠ 未配置(doc/10 §7.4) */
        allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** 拒绝规则;跨层与 allow/ask 按「最严格者胜」由引擎判定期合并 */
        deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** 询问规则;无交互面时由调度器降级 deny(fail-closed) */
        ask: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** 权限模式;分层取最高有效层(managed 声明即锁定) */
        defaultMode: z.ZodOptional<z.ZodEnum<["default", "acceptEdits", "plan", "bypassPermissions", "auto", "dontAsk"]>>;
        /**
         * 关闭内置安全基线(contract-v0.7,RFC-OPT4-1;基线内容见 kernel
         * permissions/baseline.ts)。分层语义与 defaultMode 同:取最高有效层——
         * managed 显式声明 false 即锁定基线开启,低层无法解除。
         */
        disableBaselineProtection: z.ZodOptional<z.ZodBoolean>;
        /**
         * LLM 权限分类器治理位(contract-v0.8 增 enabled;
         * contract-v0.13 增 tightenOutsideAuto/callBudget 并放宽 enabled 为可选)。
         * 环境变量 TANSR_PERMISSION_CLASSIFIER /
         * TANSR_CLASSIFIER_TIGHTEN_OUTSIDE_AUTO / TANSR_CLASSIFIER_BUDGET 保留为
         * 最高优先覆盖(逐键接管)。仅 user/managed 层被尊重(分类器属
         * 用户/企业的信任与成本决策,项目层声明整段忽略+示警)。
         * 史注:TANSR_CLASSIFIER_ALLOW_UNQUALIFIED(资格越过)曾刻意不进配置
         * (break-glass 性质恒 env-only),已整体退役(任命即授照后无「未达资格」可越)。
         */
        classifier: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            /** 非 auto 模式也咨询分类器(只收紧:unsafe→deny,safe 恒维持 ask) */
            tightenOutsideAuto: z.ZodOptional<z.ZodBoolean>;
            /** 每会话咨询预算:≥1 改上限 / 'off' 不限;缺席用内核缺省 */
            callBudget: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"off">]>>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        }, {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        }>>;
        /**
         * 出厂规则包装载开关(contract-v0.13;出厂包的契约形态)。
         * 缺省 true(装载);false = 卸载。env TANSR_RECOMMENDED_RULES 保留为最高
         * 优先覆盖(精确 '0' 卸载)。仅 user/managed 层被尊重(卸出厂 ask 包属
         * 扩权向,项目层声明忽略+示警)。
         */
        recommendedRules: z.ZodOptional<z.ZodBoolean>;
        /**
         * 项目 ask 注意力预算(contract-v0.13;kernel ask 预算的契约形态)。
         * ≥1 = 每会话项目来源询问上限(缺省 10);'off' = 关闭(回到逐条询问)。
         * env TANSR_PROJECT_ASK_BUDGET 保留为最高优先覆盖。仅 user/managed 层被
         * 尊重(预算防的就是项目层提示风暴,项目自调即越界)。
         */
        projectAskBudget: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"off">]>>;
    }, "strip", z.ZodTypeAny, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    }>>;
    /** 表面层 UI 偏好(contract-v0.4,RFC-E9-1);走常规五层深合并 */
    ui: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodEnum<["dark", "light", "high-contrast", "colorblind"]>>;
    }, "strip", z.ZodTypeAny, {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    }, {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    }>>;
    /** 预算熔断(contract-v0.7,RFC-OPT3-2);走常规五层深合并 */
    budget: z.ZodOptional<z.ZodObject<{
        /**
         * 会话 USD 金额上限(单位:美元)。比对口径 = 成本总账中 USD 币种桶的
         * 纳元累计(kernel cost/tracker.ts)。如实限界:非 USD 计价(内置价格表
         * 当前全为 CNY)与缺价模型不进本口径——跨币种不可折算(不编造汇率),
         * 币种无关的兜底请用 maxTotalTokens。
         */
        maxUsd: z.ZodOptional<z.ZodNumber>;
        /** 会话 token 总量上限(五路 usage 合计:输入+输出+缓存读写+思考) */
        maxTotalTokens: z.ZodOptional<z.ZodNumber>;
        /** 超限动作:block=屏障点终止(budget_exceeded);warn=告警一次照常继续 */
        onExceeded: z.ZodDefault<z.ZodEnum<["block", "warn"]>>;
    }, "strip", z.ZodTypeAny, {
        onExceeded: "block" | "warn";
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
    }, {
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
        onExceeded?: "block" | "warn" | undefined;
    }>>;
    /** 收尾验证约定(contract-v0.7,RFC-OPT2-1);走常规五层深合并 */
    verify: z.ZodOptional<z.ZodObject<{
        /**
         * 项目收尾验证命令(如 `pnpm test`)。当前消费方为装配层:注入 system
         * 工具总则段,要求模型宣告完成前执行取证(OPT-02 的可配置升级);
         * 查询环收尾强制执行属后续演进,本键先行承载约定。
         */
        command: z.ZodOptional<z.ZodString>;
        /** 验证命令的建议超时(毫秒;消费方按需采用) */
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    }, {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    }>>;
    /**
     * effort 档位(contract-v0.8,RFC-OPT15-1);走常规五层深合并。
     * 优先级:--effort 旗标 > TANSR_EFFORT > 本键;缺省不注入任何档位。
     */
    effort: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "max"]>>;
    /**
     * 输出风格名(contract-v0.8,RFC-OPT16-1):内置(default/explanatory/
     * learning)或自定义风格文件名。开放集合不枚举;指名不存在按装配期
     * fail-fast(与 TANSR_OUTPUT_STYLE 同口径)。优先级:--output-style 旗标
     * > TANSR_OUTPUT_STYLE > 本键。走常规五层深合并。
     */
    outputStyle: z.ZodOptional<z.ZodString>;
    /** 审计通道(contract-v0.8,RFC-OPT11-1);走常规五层深合并 */
    audit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        /** 落盘目录(缺省 ~/.tansr/audit);相对路径按进程 cwd 解析 */
        dir: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    }>>;
    /** 策略包验签信任(contract-v0.8,RFC-OPT11-2);仅 managed 层被尊重 */
    policy: z.ZodOptional<z.ZodObject<{
        trust: z.ZodOptional<z.ZodObject<{
            /** keyId → ed25519 SPKI PEM 公钥文本 */
            keys: z.ZodRecord<z.ZodString, z.ZodString>;
            /** 无签名 bundle 处置;缺省 'accept'(向后兼容既有未签名策略) */
            unsignedPolicy: z.ZodOptional<z.ZodEnum<["accept", "reject"]>>;
        }, "strip", z.ZodTypeAny, {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        }, {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    }, {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    }>>;
    /** Shell 沙箱(contract-v0.8);kernel 合并前抽取:user / managed 被尊重,项目层忽略,env 对 managed 只收紧 */
    sandbox: z.ZodOptional<z.ZodObject<{
        /**
         * 生效模式(词表对齐 kernel SandboxMode):off=不碰沙箱(缺省);
         * on=capability ≥ partial 时包装执行,包装失败 fail-closed,capability
         * = none 时按 CC「平台不可用即绕过」语义裸跑;required=企业 fail-closed
         * (SPEC-5.12-5)——capability = none 时 Shell 一律拒绝执行。
         */
        mode: z.ZodOptional<z.ZodEnum<["off", "on", "required"]>>;
        /**
         * 追加的允许写根(绝对路径;**追加**到缺省根 [会话 cwd, 系统临时目录],
         * 非替换——运行必需根不可声明移除,写 = allow-only 语义)。
         */
        allowWrite: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** 网络许可:'deny' = 全断网(缺省,CC 空 allowlist 语义);'allow' = 不限制 */
        network: z.ZodOptional<z.ZodEnum<["allow", "deny"]>>;
    }, "strip", z.ZodTypeAny, {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    }, {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    }>>;
    /** 工作区信任治理(contract-v0.8,RFC-OPT12-2);仅 managed 层被尊重 */
    workspaceTrust: z.ZodOptional<z.ZodObject<{
        /**
         * true = 未信任工作区在一切表面强制受限运行(headless/serve 无交互面
         * 也降权,不再默认视同可信);低层无法解除。缺省 false = 现状语义
         * (仅 TUI 弹窗询问,无交互面按启动参数语义放行)。
         */
        enforce: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enforce?: boolean | undefined;
    }, {
        enforce?: boolean | undefined;
    }>>;
    /** 语义索引对接(contract-v0.11,RFC-WC-1);env 逐键优先,走常规五层深合并 */
    semanticIndex: z.ZodOptional<z.ZodObject<{
        /** indexd 端点(如 http://127.0.0.1:18080);缺省未配置 = 功能关 */
        url: z.ZodOptional<z.ZodString>;
        /** 索引方定义的 repo_id(须与建索引时一致);缺省装配层按 'default' 兜底 */
        repoId: z.ZodOptional<z.ZodString>;
        branch: z.ZodOptional<z.ZodString>;
        /** indexd 调用超时(状态查询与检索各自计时);缺省工具内建 3000ms */
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        /** 检索条数缺省(工具入参 limit 未给时生效;上限对齐工具面收紧值) */
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    }, {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    }>>;
    telemetry: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    $schemaVersion: 1;
    providers: Record<string, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        models: Record<string, string>;
        auth?: {
            env: string;
        } | undefined;
        capability?: {
            thinking: {
                toggleValues: string[];
                budgetTokens: "ignored" | "honored";
                mustEchoBack: boolean;
                cannotDisable: boolean;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            };
            maxContext: number;
            vision: boolean;
            inputModalities: {
                image: "supported" | "rejected" | "silently_dropped";
                document: "supported" | "rejected" | "silently_dropped";
            };
            toolChoice: boolean;
            promptCaching: {
                mode: "explicit" | "implicit" | "ignored";
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            };
            sampling: {
                temperature?: {
                    min: number;
                    max: number;
                    minExclusive: boolean;
                    maxExclusive: boolean;
                    clampEpsilon: number;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            };
            modelModifiers: string[];
            quirks: {
                unknownModelFallback: boolean;
                claudeModelNameMapping: boolean;
                systemRoleInMessages: boolean;
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            };
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            defaultContextWithoutModifier?: number | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }>;
    modelAliases: {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    };
    fallbacks: Record<string, string[]>;
    telemetry: {
        enabled: boolean;
    };
    budget?: {
        onExceeded: "block" | "warn";
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
    } | undefined;
    policy?: {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    } | undefined;
    locale?: string | undefined;
    hooks?: {
        SessionStart?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PreToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PostToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        Stop?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        SessionEnd?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionRequest?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionDenied?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    } | undefined;
    mcpServers?: Record<string, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    } | {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }> | undefined;
    permissions?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    } | undefined;
    ui?: {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    } | undefined;
    verify?: {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    effort?: "max" | "low" | "medium" | "high" | undefined;
    outputStyle?: string | undefined;
    audit?: {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    } | undefined;
    sandbox?: {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    } | undefined;
    workspaceTrust?: {
        enforce?: boolean | undefined;
    } | undefined;
    semanticIndex?: {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    } | undefined;
}, {
    budget?: {
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
        onExceeded?: "block" | "warn" | undefined;
    } | undefined;
    policy?: {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    } | undefined;
    locale?: string | undefined;
    hooks?: {
        SessionStart?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PreToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PostToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        Stop?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        SessionEnd?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionRequest?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionDenied?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    } | undefined;
    $schemaVersion?: 1 | undefined;
    providers?: Record<string, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        auth?: {
            env: string;
        } | undefined;
        models?: Record<string, string> | undefined;
        capability?: {
            maxContext: number;
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                budgetMaxTokens?: number | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }> | undefined;
    modelAliases?: {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    } | undefined;
    fallbacks?: Record<string, string[]> | undefined;
    mcpServers?: Record<string, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    } | {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }> | undefined;
    permissions?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    } | undefined;
    ui?: {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    } | undefined;
    verify?: {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    effort?: "max" | "low" | "medium" | "high" | undefined;
    outputStyle?: string | undefined;
    audit?: {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    } | undefined;
    sandbox?: {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    } | undefined;
    workspaceTrust?: {
        enforce?: boolean | undefined;
    } | undefined;
    semanticIndex?: {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    } | undefined;
    telemetry?: {
        enabled?: boolean | undefined;
    } | undefined;
}>;
/** 五层合并后的完整配置(TansrConfigSchema 推导)。 */
type TansrConfig = z.infer<typeof TansrConfigSchema>;

/**
 * ModelClient — 模型客户端接口(依赖倒置的关键缝)。
 * providers 包实现本接口;kernel 只依赖本接口,经构造注入,绝不 import 具体适配器。
 */

/** 单次模型调用的选项:取消信号与分层超时(总闸 / 建连闸 / 空闲闸)。 */
interface ModelCallOptions {
    signal?: AbortSignal;
    /**
     * 单次尝试总闸(毫秒)。分层超时落地后语义收敛为「总闸兼容位」:
     * 消费分层超时的适配器(openai/openai-responses)把本值并入总闸
     * (totalTimeoutMs 优先);未跟进的适配器沿用「单闸覆盖整次尝试」旧语义。
     * 压缩路径恒传本位(90s 总闸,kernel context/compaction.ts)。
     */
    timeoutMs?: number;
    /**
     * 建连/响应头到达闸(毫秒)。覆盖「发出请求 → 响应头到达」区间;
     * 响应头到达后退场,交棒 idle 闸。缺席时消费方适配器用内建缺省
     * (openai 系 15_000)。
     */
    connectTimeoutMs?: number;
    /**
     * 流式分片间空闲闸(毫秒)。响应头到达后启用,每到一段字节重臂;
     * 分片持续到达的健康慢长流恒不误杀。缺席时消费方适配器用内建缺省
     * (openai 系 90_000)。
     */
    idleTimeoutMs?: number;
    /**
     * 可选总闸(毫秒)。整次尝试(建连 + 流式读取)的绝对上限;
     * 缺省关闭(与 timeoutMs 同给时本位优先)。
     */
    totalTimeoutMs?: number;
}
/** 模型客户端:把一次 IRRequest 变成 IRStreamEvent 流;providers 实现,kernel 经注入消费。 */
interface ModelClient {
    /**
     * 流式调用。实现必须把 wire 协议(SSE/delta)解析为 IRStreamEvent 序列;
     * 可恢复错误以 `{t:'error'}` 事件产出而非 throw(throw 仅保留给编程性错误)。
     * 生成器正常结束 = 流完整;消费方以 message_stop 或 error 事件为语义终点。
     */
    stream(request: IRRequest, options?: ModelCallOptions): AsyncGenerator<IRStreamEvent, void, undefined>;
}

/**
 * 会话历史分层存储的数据契约(contract-v0.22,RFC-SC-4;doc/119 / doc/120)。
 *
 * 只契约化**会在第三方存储中长期存在的格式**:段条目 / 快照条目 / 附件条目 / 清单。
 * 调用契约(SegmentBlobStore / SessionHistoryStore / StoreError …)是运行时接口,
 * 落 kernel `journal/segmented/types.ts`,不在此。wire(doc/98)零改动;端侧零持份。
 *
 * 语义(kernel 载入侧校验,schema 只管形状):
 * - 段 = 一截不可变、内容寻址(sha256)的 JournalRecord 序列(每行 canonical JSON,
 *   整体按 codec 压缩),与前后段以哈希链相接:第 n 段 previousHash === 第 n−1 段 lastHash;
 * - 清单 = 唯一提交点:一卷一份,每次封存整体重写,generation +1,写恒 CAS;
 *   volumeId 为卷代际(压缩 / 清空 / 恢复即换卷);
 * - 前向兼容:读端对未知字段容忍(passthrough);formatVersion 高于支持版本 → 拒绝而非猜;
 *   新增字段恒可选。
 *
 * 词汇对齐(IO-11,doc/119 D-11;同版本 v0.22 内修订,未发布、无消费者):段条目字段名与
 * kernel 热清单 `JournalManifestSegment`(journal/manifest.ts)同一套——`n`(1 起,连续)/
 * `firstSeq` / `lastSeq` / `lastHash`,链首锚点命名 `previousHash`(与 JournalRecord.integrity
 * 同词);冷清单由热清单派生时字段直接搬运,开发者不见两套清单词汇。
 */

declare const SegmentCodecSchema: z.ZodEnum<["jsonl", "jsonl+gzip", "jsonl+zstd"]>;
type SegmentCodec = z.infer<typeof SegmentCodecSchema>;
/**
 * 段条目:卷内序号连续(n 自 1 起,与热清单同)、seq 区间首尾相接、哈希链相接;
 * key 为不透明规范键(推荐形见 doc/120 §5;清单内恒存规范键,keyMapper 只作用于适配器调用)。
 */
declare const SegmentEntrySchema: z.ZodObject<{
    /** 卷内段序号(1 起,连续;=== 热清单 JournalManifestSegment.n) */
    n: z.ZodNumber;
    /** 首记录 seq(含) */
    firstSeq: z.ZodNumber;
    /** 末记录 seq(含);下一段 firstSeq === lastSeq + 1 */
    lastSeq: z.ZodNumber;
    records: z.ZodNumber;
    /** 编码后对象字节数 */
    bytes: z.ZodNumber;
    codec: z.ZodEnum<["jsonl", "jsonl+gzip", "jsonl+zstd"]>;
    /**
     * 段首记录的 integrity.previousHash(链接:=== 前一段 lastHash;卷首段 = 卷首记录的
     * previousHash,自创世起的卷为 null)
     */
    previousHash: z.ZodNullable<z.ZodString>;
    /** 段末记录 hash(=== 热清单 JournalManifestSegment.lastHash) */
    lastHash: z.ZodString;
    /** 编码后对象内容哈希(put 幂等判据) */
    sha256: z.ZodString;
    key: z.ZodString;
    /**
     * 信息位(可选;IO-12):热清单派生时随行,让「热层全失仅凭冷层重建热清单」无损——
     * rawBytes = 段文件明文字节(热清单 bytes);sealedAt = 封段时刻(热清单 sealedAt,ISO-8601)。
     * 旧清单缺席时读端以 0 / 清单 updatedAt 兜底;载入正确性不依赖二者。
     */
    rawBytes: z.ZodOptional<z.ZodNumber>;
    sealedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    previousHash: string | null;
    bytes: number;
    key: string;
    n: number;
    firstSeq: number;
    lastSeq: number;
    records: number;
    codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
    lastHash: string;
    sha256: string;
    rawBytes?: number | undefined;
    sealedAt?: string | undefined;
}, {
    previousHash: string | null;
    bytes: number;
    key: string;
    n: number;
    firstSeq: number;
    lastSeq: number;
    records: number;
    codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
    lastHash: string;
    sha256: string;
    rawBytes?: number | undefined;
    sealedAt?: string | undefined;
}>;
type SegmentEntry = z.infer<typeof SegmentEntrySchema>;
/** 清单 = 提交点(一卷一份;整体重写;CAS) */
declare const SegmentManifestSchema: z.ZodObject<{
    formatVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    /** sha256(endUserId) 前 16 hex(doc/98 §九);sdk 单租户形态 'local' */
    endUserKey: z.ZodString;
    /** 卷代际:压缩 / 清空 / 恢复即换卷 */
    volumeId: z.ZodString;
    /** 清单版本号(CAS);每次重写 +1 */
    generation: z.ZodNumber;
    /** 按 n 升序 */
    segments: z.ZodArray<z.ZodObject<{
        /** 卷内段序号(1 起,连续;=== 热清单 JournalManifestSegment.n) */
        n: z.ZodNumber;
        /** 首记录 seq(含) */
        firstSeq: z.ZodNumber;
        /** 末记录 seq(含);下一段 firstSeq === lastSeq + 1 */
        lastSeq: z.ZodNumber;
        records: z.ZodNumber;
        /** 编码后对象字节数 */
        bytes: z.ZodNumber;
        codec: z.ZodEnum<["jsonl", "jsonl+gzip", "jsonl+zstd"]>;
        /**
         * 段首记录的 integrity.previousHash(链接:=== 前一段 lastHash;卷首段 = 卷首记录的
         * previousHash,自创世起的卷为 null)
         */
        previousHash: z.ZodNullable<z.ZodString>;
        /** 段末记录 hash(=== 热清单 JournalManifestSegment.lastHash) */
        lastHash: z.ZodString;
        /** 编码后对象内容哈希(put 幂等判据) */
        sha256: z.ZodString;
        key: z.ZodString;
        /**
         * 信息位(可选;IO-12):热清单派生时随行,让「热层全失仅凭冷层重建热清单」无损——
         * rawBytes = 段文件明文字节(热清单 bytes);sealedAt = 封段时刻(热清单 sealedAt,ISO-8601)。
         * 旧清单缺席时读端以 0 / 清单 updatedAt 兜底;载入正确性不依赖二者。
         */
        rawBytes: z.ZodOptional<z.ZodNumber>;
        sealedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }>, "many">;
    checkpoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        atSeq: z.ZodNumber;
        key: z.ZodString;
        bytes: z.ZodNumber;
        sha256: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }>, "many">>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sha256: z.ZodString;
        key: z.ZodString;
        bytes: z.ZodNumber;
        mime: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }>, "many">>;
    /** ISO-8601 */
    updatedAt: z.ZodString;
    /** 生命周期提示;不是删除承诺 */
    expiresAt: z.ZodOptional<z.ZodString>;
    /**
     * 会话展示元(可选;IO-13 集成修订):热层 meta.json 的 createdAt / title 等随清单落冷层,
     * 让「热层全失仅凭冷层重建」(A10)与无 index 的 conditional-put 策略下 listSessions 仍能
     * 回展示位。恒不携消息内容;字段全部可选、前向容忍。
     */
    sessionMeta: z.ZodOptional<z.ZodObject<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    formatVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    /** sha256(endUserId) 前 16 hex(doc/98 §九);sdk 单租户形态 'local' */
    endUserKey: z.ZodString;
    /** 卷代际:压缩 / 清空 / 恢复即换卷 */
    volumeId: z.ZodString;
    /** 清单版本号(CAS);每次重写 +1 */
    generation: z.ZodNumber;
    /** 按 n 升序 */
    segments: z.ZodArray<z.ZodObject<{
        /** 卷内段序号(1 起,连续;=== 热清单 JournalManifestSegment.n) */
        n: z.ZodNumber;
        /** 首记录 seq(含) */
        firstSeq: z.ZodNumber;
        /** 末记录 seq(含);下一段 firstSeq === lastSeq + 1 */
        lastSeq: z.ZodNumber;
        records: z.ZodNumber;
        /** 编码后对象字节数 */
        bytes: z.ZodNumber;
        codec: z.ZodEnum<["jsonl", "jsonl+gzip", "jsonl+zstd"]>;
        /**
         * 段首记录的 integrity.previousHash(链接:=== 前一段 lastHash;卷首段 = 卷首记录的
         * previousHash,自创世起的卷为 null)
         */
        previousHash: z.ZodNullable<z.ZodString>;
        /** 段末记录 hash(=== 热清单 JournalManifestSegment.lastHash) */
        lastHash: z.ZodString;
        /** 编码后对象内容哈希(put 幂等判据) */
        sha256: z.ZodString;
        key: z.ZodString;
        /**
         * 信息位(可选;IO-12):热清单派生时随行,让「热层全失仅凭冷层重建热清单」无损——
         * rawBytes = 段文件明文字节(热清单 bytes);sealedAt = 封段时刻(热清单 sealedAt,ISO-8601)。
         * 旧清单缺席时读端以 0 / 清单 updatedAt 兜底;载入正确性不依赖二者。
         */
        rawBytes: z.ZodOptional<z.ZodNumber>;
        sealedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }>, "many">;
    checkpoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        atSeq: z.ZodNumber;
        key: z.ZodString;
        bytes: z.ZodNumber;
        sha256: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }>, "many">>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sha256: z.ZodString;
        key: z.ZodString;
        bytes: z.ZodNumber;
        mime: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }>, "many">>;
    /** ISO-8601 */
    updatedAt: z.ZodString;
    /** 生命周期提示;不是删除承诺 */
    expiresAt: z.ZodOptional<z.ZodString>;
    /**
     * 会话展示元(可选;IO-13 集成修订):热层 meta.json 的 createdAt / title 等随清单落冷层,
     * 让「热层全失仅凭冷层重建」(A10)与无 index 的 conditional-put 策略下 listSessions 仍能
     * 回展示位。恒不携消息内容;字段全部可选、前向容忍。
     */
    sessionMeta: z.ZodOptional<z.ZodObject<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    formatVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    /** sha256(endUserId) 前 16 hex(doc/98 §九);sdk 单租户形态 'local' */
    endUserKey: z.ZodString;
    /** 卷代际:压缩 / 清空 / 恢复即换卷 */
    volumeId: z.ZodString;
    /** 清单版本号(CAS);每次重写 +1 */
    generation: z.ZodNumber;
    /** 按 n 升序 */
    segments: z.ZodArray<z.ZodObject<{
        /** 卷内段序号(1 起,连续;=== 热清单 JournalManifestSegment.n) */
        n: z.ZodNumber;
        /** 首记录 seq(含) */
        firstSeq: z.ZodNumber;
        /** 末记录 seq(含);下一段 firstSeq === lastSeq + 1 */
        lastSeq: z.ZodNumber;
        records: z.ZodNumber;
        /** 编码后对象字节数 */
        bytes: z.ZodNumber;
        codec: z.ZodEnum<["jsonl", "jsonl+gzip", "jsonl+zstd"]>;
        /**
         * 段首记录的 integrity.previousHash(链接:=== 前一段 lastHash;卷首段 = 卷首记录的
         * previousHash,自创世起的卷为 null)
         */
        previousHash: z.ZodNullable<z.ZodString>;
        /** 段末记录 hash(=== 热清单 JournalManifestSegment.lastHash) */
        lastHash: z.ZodString;
        /** 编码后对象内容哈希(put 幂等判据) */
        sha256: z.ZodString;
        key: z.ZodString;
        /**
         * 信息位(可选;IO-12):热清单派生时随行,让「热层全失仅凭冷层重建热清单」无损——
         * rawBytes = 段文件明文字节(热清单 bytes);sealedAt = 封段时刻(热清单 sealedAt,ISO-8601)。
         * 旧清单缺席时读端以 0 / 清单 updatedAt 兜底;载入正确性不依赖二者。
         */
        rawBytes: z.ZodOptional<z.ZodNumber>;
        sealedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }, {
        previousHash: string | null;
        bytes: number;
        key: string;
        n: number;
        firstSeq: number;
        lastSeq: number;
        records: number;
        codec: "jsonl" | "jsonl+gzip" | "jsonl+zstd";
        lastHash: string;
        sha256: string;
        rawBytes?: number | undefined;
        sealedAt?: string | undefined;
    }>, "many">;
    checkpoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        atSeq: z.ZodNumber;
        key: z.ZodString;
        bytes: z.ZodNumber;
        sha256: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }, {
        id: string;
        bytes: number;
        createdAt: string;
        key: string;
        sha256: string;
        atSeq: number;
    }>, "many">>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sha256: z.ZodString;
        key: z.ZodString;
        bytes: z.ZodNumber;
        mime: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }, {
        bytes: number;
        key: string;
        sha256: string;
        mime?: string | undefined;
    }>, "many">>;
    /** ISO-8601 */
    updatedAt: z.ZodString;
    /** 生命周期提示;不是删除承诺 */
    expiresAt: z.ZodOptional<z.ZodString>;
    /**
     * 会话展示元(可选;IO-13 集成修订):热层 meta.json 的 createdAt / title 等随清单落冷层,
     * 让「热层全失仅凭冷层重建」(A10)与无 index 的 conditional-put 策略下 listSessions 仍能
     * 回展示位。恒不携消息内容;字段全部可选、前向容忍。
     */
    sessionMeta: z.ZodOptional<z.ZodObject<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        createdAt: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        platformSessionId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>;
type SegmentManifest = z.infer<typeof SegmentManifestSchema>;

/**
 * 媒体产物形与授权模型描述子(媒体能力内核化 doc/128 §3.1,K-1;加法模块,不占 contract 号)。
 *
 * 本模块是四个媒体工具(ImageGen / VideoGen / SpeechToText / TextToSpeech)`ToolResult.data`
 * 形状的**单源**——此前四形各自散落在 sdk 环3 工具文件(`ImageGenData` / `VideoGenData` /
 * `TranscriptData` / `SpeechData`),sdk 侧改为本模块的类型别名与 re-export(D-M5:形状逐字
 * 不变、不加判别键)。三类内容:
 *
 * - 授权模型描述子 `MediaModelDescriptor<C>` 与四约束型(逐字迁自 sdk `platform/bundle.ts`;
 *   sdk `AppBundleXxxModel` / `XxxConstraints` 改为本类型别名)——工具描述装配的入参形;
 * - 四产物 schema(zod `.passthrough()` 容未知键——端侧/旧消费方对加法键零破坏)与同名接口;
 * - `parseMediaArtifact()`:doc/123 §3.7「端侧形状规则」的 **TS 参考实现**——Android
 *   `ToolCardArtifact.kt` / iOS `ToolCardArtifact.swift` 按形状(不按工具名)识别产物的三端
 *   对表基准(doc/128 D-M5 / D-M10 / A-12)。
 *
 * 契约面(D-M11):不新 KernelEvent、不新 IR 块、`tool.completed.data` 仍 `unknown`、
 * `kernel-event.schema.json` 零 diff;本模块不入 JSON Schema 导出集(产物形随事件 data 位出线,
 * 消费方按形状识别,无独立书写/生成方)。
 */

/**
 * 产出托管地(S-ARCH P2-c 加法键 2026-09-02;平台媒体探针按产出 URL 宿主定性):
 * overseas = 境外托管(中国大陆网络可能无法直接访问)/ domestic / inline(b64 内联返回,
 * 无托管地问题)。缺席 = 未探/未识别。工具描述据此逐模型前置告知。
 */
type MediaOutputHosting = 'domestic' | 'overseas' | 'inline';
/**
 * 授权媒体模型描述子(S-G1 媒体池化顺位取用):`model` = canonical handle(工具/网关
 * `model` 位可直用);`displayName` 异名时描述行附注;`constraints` 按面特化(下方四型),
 * 缺席 = 受理面未实录(描述恒不臆造);序 = 平台收敛稳定序,**顺位第一即 `model` 缺省时
 * 的生效模型**。恒不携价格/成本/供应商内部信息。
 */
interface MediaModelDescriptor<C> {
    model: string;
    displayName: string;
    constraints?: C;
    outputHosting?: MediaOutputHosting;
}
/**
 * 图像模型受理约束(bundle platformModels.imageGen 行 constraints 加法键,2026-09-01;
 * 网关侧单源 = /t1 运行时校验档同一 classify 词表)。工具描述逐模型拼注——智能体首发即中,
 * 不再靠拒收错误试错。
 */
interface ImageModelConstraints {
    /** false = 模型定档分辨率,size 在场即拒。 */
    size: boolean;
    seed: boolean;
    negativePrompt: boolean;
    /** 单请求张数帽(n 超帽由网关钳)。 */
    maxImages: number;
    /** 富输入 imageUrls 受理域(null = 纯文生行,在场即拒)。 */
    imageInput: {
        min: number;
        max: number;
        urlOk: boolean;
        b64Ok: boolean;
    } | null;
    /** false = 动词行(引用既有任务),prompt 在场即拒。 */
    promptRequired: boolean;
    /** 动词行必携 action{taskId,actionId}。 */
    actionRequired?: boolean;
}
/** 视频模型受理约束(同上镜像;时长域/首帧受理/比例域是实测三大拒收源)。 */
interface VideoModelConstraints {
    durations: {
        kind: 'set';
        values: number[];
        defaultSec: number;
    } | {
        kind: 'range';
        min: number;
        max: number;
        defaultSec: number;
    };
    /** 比例词形域(null = ratio 在场即拒;键缺席 = 透传上游,域未实录)。 */
    ratio?: string[] | null;
    negativePrompt: boolean;
    seed: boolean;
    /** 首帧图受理域(required = i2v 专用行必携 imageUrls;null = 纯文生行在场即拒)。 */
    imageInput: {
        required: boolean;
        max: number;
        urlOk: boolean;
        b64Ok: boolean;
    } | null;
    audioInput: boolean;
}
/**
 * ASR(语音转文字)模型受理约束(doc/123 §3.4 / §二「音频面档」):受理格式 / 时长帽 /
 * 语种 / 说话人分离——`diarize:true` 点名不受理家族恒 400 可解释,前置进描述免试错。
 */
interface AudioAsrConstraints {
    /** 受理音频格式(如 wav/mp3/m4a;data URI mime 与之对应) */
    formats: string[];
    /** 单文件时长帽(秒;超帽 bad_request) */
    maxSeconds: number;
    /** 提示语种域(缺席 = 未实录,language 位透传上游) */
    languages?: string[];
    /** 说话人分离受理(false 时 diarize 在场即拒) */
    diarization: boolean;
}
/**
 * TTS(文字转语音)模型受理约束(doc/123 §3.4):音色表(voice 缺席 = defaultVoice;非表内
 * 音色 400 列出可选)/ 受理格式(家族不受理的格式按面档回落,如 dashscope 恒 wav)/ 字数帽。
 */
interface AudioTtsConstraints {
    voices: Array<{
        id: string;
        label: string;
        lang?: string;
    }>;
    defaultVoice: string;
    formats: string[];
    maxChars: number;
}
/** 图片模型目录条目:通用描述符 + 图片受理约束。 */
type ImageModelDescriptor = MediaModelDescriptor<ImageModelConstraints>;
/** 视频模型目录条目:通用描述符 + 视频受理约束。 */
type VideoModelDescriptor = MediaModelDescriptor<VideoModelConstraints>;
/** 语音转文字模型目录条目:通用描述符 + ASR 受理约束。 */
type SpeechToTextModelDescriptor = MediaModelDescriptor<AudioAsrConstraints>;
/** 文字转语音模型目录条目:通用描述符 + TTS 受理约束。 */
type TextToSpeechModelDescriptor = MediaModelDescriptor<AudioTtsConstraints>;
/**
 * ImageGen 产物(表面层渲染用结构化数据;错误时携错误码、`images` 为空数组、`imageCount` 0)。
 * 端侧按形状识别:`images` 数组 → Images 型产物。
 */
interface ImageGenData {
    model: string;
    images: Array<{
        url: string;
    }>;
    imageCount: number;
    /** 错误码(如 forbidden / imagegen_not_configured / model_not_authorized;成功缺席)。 */
    errorCode?: string;
    /**
     * 异步任务号(平台任务径在场时恒携)。预算耗尽/中断时凭此找回产出:
     * GET /t1/imagegen/tasks/{taskId}(服务端照跑照扣,7 天可查)。同步回落径 / BYO 径缺席。
     */
    taskId?: string;
}
/** ImageGenData 的 zod schema(passthrough 容未知键;消费方按需校验 ToolResult.data)。 */
declare const ImageGenDataSchema: z.ZodObject<{
    model: z.ZodString;
    images: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    imageCount: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    model: z.ZodString;
    images: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    imageCount: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    model: z.ZodString;
    images: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    imageCount: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * VideoGen 产物(错误时携错误码、`videos` 为空数组、`videoCount` / `billedSeconds` 0)。
 * 端侧按形状识别:`videos` 数组 → Videos 型产物。
 */
interface VideoGenData {
    model: string;
    videos: Array<{
        url: string;
    }>;
    videoCount: number;
    /** 计费秒数(= 上游成功报量;错误时 0)。 */
    billedSeconds: number;
    /** 错误码(如 forbidden / videogen_not_configured / model_not_authorized;成功缺席)。 */
    errorCode?: string;
    /** 异步任务号(平台任务径在场时恒携;GET /t1/videogen/tasks/{taskId} 可找回)。 */
    taskId?: string;
}
/** VideoGenData 的 zod schema(passthrough 容未知键)。 */
declare const VideoGenDataSchema: z.ZodObject<{
    model: z.ZodString;
    videos: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    videoCount: z.ZodNumber;
    billedSeconds: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    model: z.ZodString;
    videos: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    videoCount: z.ZodNumber;
    billedSeconds: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    model: z.ZodString;
    videos: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    videoCount: z.ZodNumber;
    billedSeconds: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/** 转写分段(speaker 仅说话人分离家族在场) */
interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
    speaker?: string;
}
/** TranscriptSegment 的 zod schema(passthrough 容未知键)。 */
declare const TranscriptSegmentSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
    text: z.ZodString;
    speaker: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    start: z.ZodNumber;
    end: z.ZodNumber;
    text: z.ZodString;
    speaker: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    start: z.ZodNumber;
    end: z.ZodNumber;
    text: z.ZodString;
    speaker: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * SpeechToText 产物(错误时携错误码、`text` 为空串)。端侧按形状
 * 识别:`text` + `model` 且无 images/videos/results/audio → Transcript 型产物。
 * 空串 `text` 本身是合法转写(静音输入),不是零产物。
 */
interface TranscriptData {
    model: string;
    text: string;
    language?: string;
    durationSec?: number;
    segments?: TranscriptSegment[];
    /** 错误码(如 forbidden / asr_not_configured / model_not_authorized;成功缺席)。 */
    errorCode?: string;
    /** 异步任务号(平台任务径在场时恒携;GET /t1/asr/tasks/{taskId} 可找回)。 */
    taskId?: string;
}
/** TranscriptData 的 zod schema(passthrough 容未知键)。 */
declare const TranscriptDataSchema: z.ZodObject<{
    model: z.ZodString;
    text: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    durationSec: z.ZodOptional<z.ZodNumber>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    model: z.ZodString;
    text: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    durationSec: z.ZodOptional<z.ZodNumber>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    model: z.ZodString;
    text: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    durationSec: z.ZodOptional<z.ZodNumber>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        speaker: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * 合成产物(SpeechData.audio;`url` 与 `b64` 恒至少一个在场)。
 * `path` 为加法可选键:cli 内联产物落盘后的本地路径(kernel 工具 `artifactSink` 在场且
 * `b64` 在场时写入);sdk / serve 恒不接 sink,径上恒缺席——端侧形状识别不受影响。
 */
interface SpeechAudio {
    /** 托管形直链(上游域内 OSS,约 24h 失效) */
    url?: string;
    /** 内联形 base64(无 data: 前缀;mime 见同级键) */
    b64?: string;
    mime: string;
    format: string;
    durationMs?: number;
    sampleRate?: number;
    /** 本地落盘路径(仅 cli artifactSink 径出现) */
    path?: string;
}
/** SpeechAudio 的 zod schema(passthrough 容未知键)。 */
declare const SpeechAudioSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    b64: z.ZodOptional<z.ZodString>;
    mime: z.ZodString;
    format: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
    sampleRate: z.ZodOptional<z.ZodNumber>;
    path: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    url: z.ZodOptional<z.ZodString>;
    b64: z.ZodOptional<z.ZodString>;
    mime: z.ZodString;
    format: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
    sampleRate: z.ZodOptional<z.ZodNumber>;
    path: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    url: z.ZodOptional<z.ZodString>;
    b64: z.ZodOptional<z.ZodString>;
    mime: z.ZodString;
    format: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
    sampleRate: z.ZodOptional<z.ZodNumber>;
    path: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * TextToSpeech 产物。端侧按形状识别:`audio.mime` 在场 → Speech 型
 * 产物。**错误形 `audio` 缺席**(恒不伪造音频对象),`billedChars` 为 0。
 */
interface SpeechData {
    model: string;
    audio?: SpeechAudio;
    /** 计费字符数(= 上游成功报量;错误时 0)。 */
    billedChars: number;
    /** 错误码(如 forbidden / tts_not_configured / model_not_authorized;成功缺席)。 */
    errorCode?: string;
    /** 异步任务号(平台任务径在场时恒携;GET /t1/tts/tasks/{taskId} 可找回)。 */
    taskId?: string;
}
/** SpeechData 的 zod schema(passthrough 容未知键)。 */
declare const SpeechDataSchema: z.ZodObject<{
    model: z.ZodString;
    audio: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    billedChars: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    model: z.ZodString;
    audio: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    billedChars: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    model: z.ZodString;
    audio: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        b64: z.ZodOptional<z.ZodString>;
        mime: z.ZodString;
        format: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        path: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    billedChars: z.ZodNumber;
    errorCode: z.ZodOptional<z.ZodString>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/** 产物判别结果:kind 判别 + 原 data(未经 schema 剥离,unknown 键原样保留) */
type MediaArtifact = {
    kind: 'image';
    data: ImageGenData;
} | {
    kind: 'video';
    data: VideoGenData;
} | {
    kind: 'transcript';
    data: TranscriptData;
} | {
    kind: 'speech';
    data: SpeechData;
};
/**
 * 三端共享谓词:
 * 「产物可渲染为成功」的**单一判定**——Kotlin `isRenderableArtifact` / Swift `isRenderableArtifact` 同名同语义,
 * 四金样 `test/fixtures/golden/tool-card-artifact-{speech-empty,image-errorcode,video-errorcode,errorcode-null}.json`
 * 三端逐字 `[false, false, false, true]`。语义逐字:
 *
 * - `errorCode == null`(键缺席 / 值 `null` / 空串皆视为**无错**;任何其它值 = 错误响应,不论产物位是否非空——
 *   此前两端 image / video 分支**不查** `errorCode`,携 url 的错误响应被渲染为成功;Android 用 `containsKey`,
 *   `errorCode: null` 被当失败)
 * - 且 `kind ∉ {image, video} || url/path 非空`(`images` / `videos` 键在场即按该形判;空数组 / 全坏 / 全空串 = 不可渲染)
 * - 且 `kind ≠ speech || url/b64 至少一非空`(`audio` 键在场即按 speech 判;此前 iOS 对 `url: ""` 放行为 Speech)
 * - 其余形(transcript / search / 未知)只受 `errorCode` 一条约束(空 `text` 转写仍是合法产物)。
 *
 * 只判「可不可以当成功渲染」,不判「是什么形」——形由 [parseMediaArtifact] 判;本谓词为其前置门。
 */
declare function isRenderableArtifact(data: unknown): boolean;
/**
 * `tool.completed.data` / `ToolResult.data` → 媒体产物判别(**规则与判序逐字对齐
 * Android `toolCardArtifact` / iOS `toolCardArtifact` 现行实现**):
 *
 * - 非对象(含 null / 数组)→ null;
 * - `errorCode` 为字符串 → 恒 null(错误响应不是产物,即使携空产物位);
 * - 判序 image → video → speech → transcript(端侧同序:URL 集形 → 音频 → 排他的裸文本形);
 * - image:`model` 为字符串,且 `images` 为数组并至少一条目携字符串 `url`(空数组 / 全坏条目 = 零产物 → 不判);
 * - video:`model` 为字符串,且 `videos` 同上;
 * - speech:`model` 为字符串,`audio` 为对象、`audio.mime` 为字符串,且 `audio.url` / `audio.b64` 至少一者为
 *   非空字符串(皆缺 / 皆空 = 零产物 → 不判);
 * - transcript:`text` 与 `model` 皆字符串,且无 `images` / `videos` / `results` / `audio` 键
 *   (`results` 排 WebSearchData;三端同四键——tansr-android 补 `audio` 后与 iOS / 本实现一致);
 * - 其余 null。
 *
 * 判序 image-first 以实现为准、三端一致。
 * 只判形不校验(不经 zod 剥离未知键):返回的 data 是原对象的类型收窄视图,消费方按需再过
 * 对应 *DataSchema。端侧两卷(Android `ToolCardArtifactsTest` / iOS `ToolCardArtifactsTests`)**既有 17 例**
 * 在本函数上同判(protocol `media.test.ts` ⑤ 镜像收录);空串 / errorCode 判型两类异形**已以四金样
 * 三端同源镜像**(`test/fixtures/golden/tool-card-artifact-*.json`;三端共享谓词 [isRenderableArtifact])。
 */
declare function parseMediaArtifact(data: unknown): MediaArtifact | null;

/**
 * Q4-6/Q4-7(EW-1/EW-2)— 执行世界抽象:FsLike / SpawnLike 两缝(doc/44 §4.1、
 * synth-C2 §2.1)。
 *
 * 定位:L2 内部接口,**非 wire 契约**(protocol 零变更)。把「模型能对世界做
 * 什么」(工具语义)与「在哪个世界做」(执行底座)正交分解:工具与执行器只
 * 依赖本文件的抽象面,缺省实现(default-fs.ts / default-spawn.ts)是
 * node:fs/promises 与 node:child_process 的直通薄壳——第一步只做接口收敛,
 * 零远程依赖、零行为漂移;远程/容器世界实现候商业需求实证(W4 触发 B),
 * 且未锚定远端路径判定语义前一切路径判定保守 ask(红线 3)。
 *
 * 纪律(doc/46 §7 已裁决):只开 fs/spawn 两缝,不照抄 dsh 8 seam
 * (terminal/lsp/code-runtime 无装配需求不建缝);不引入运行期热替换注册表
 * (注入恒走构造期/调用期参数)。
 *
 * 红线 3(换世界不绕策略层)的结构保证:FsLike/SpawnLike 在工具 execute 内部
 * 消费,而权限判定(gate.decide)由调度器在 execute 之前完成——换世界改变的
 * 只是副作用落点,不改变任何判定次序(调用序锁测见 test/world/)。
 */

/** stat/lstat 结果的最小面(node fs.Stats 结构性满足) */
interface FsStatLike {
    size: number;
    mtimeMs: number;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
}
/** readdir(withFileTypes)条目的最小面(node fs.Dirent 结构性满足) */
interface FsDirEntryLike {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
}
/**
 * 文件系统缝:九方法面(synth-C2 §2.1 签名)+ 一可选加法(readFileRange)。
 * 方法语义 = node:fs/promises 对应原语(错误以 NodeJS.ErrnoException 形态抛出,
 * `code` 字段是消费方的判定依据——fsErrorCode 亲和);实现方必须保持同形。
 * readFilePrefix 是唯一的必备组合原语(BOM 探测:只读前 N 字节,不读全文)。
 */
interface FsLike {
    stat(path: string): Promise<FsStatLike>;
    /** real-target-guard 链检锚点探测(不跟随链接) */
    lstat(path: string): Promise<FsStatLike>;
    /** 真实目标守卫依赖(symlink/junction 解析) */
    realpath(path: string): Promise<string>;
    readFile(path: string): Promise<Buffer>;
    /** 读文件前 bytes 字节(BOM 探测;返回实际读到的字节,可短于请求) */
    readFilePrefix(path: string, bytes: number): Promise<Buffer>;
    /**
     * 可选加法:读 [start, start+length) 区间字节(返回实际读到的
     * 字节,EOF 时可短于请求;短于请求即 EOF)。Read 工具对超整读帽的分页读取据此
     * 按块流式扫描,不把整文件装入内存。实现方缺席 → Read 回落整读(旧行为)。
     */
    readFileRange?(path: string, start: number, length: number): Promise<Buffer>;
    /**
     * 写全文。缺省世界(default-fs)为**同目录临时文件 + rename** 原子替换
     * (半写不落到目标路径;rename 不可用时回落直写)——实现方语义要求只是
     * 「完成后目标路径内容 = data」,原子性是缺省世界的强化承诺。
     */
    writeFile(path: string, data: Buffer): Promise<void>;
    appendFile(path: string, data: Buffer): Promise<void>;
    mkdir(path: string, opts: {
        recursive: true;
    }): Promise<void>;
    readdir(path: string): Promise<FsDirEntryLike[]>;
}
/**
 * 待启动的子进程计划(WrappableSpawnSpec 升格:file/args/cwd/env 结构同形,
 * 增 stdio 形态与受信环境键申报)。file/args 为平台 shell 展开后的最终形态
 * (shell 包装、沙箱 wrapSpawn 都发生在本缝之前——spec 是「最后一刻」的事实)。
 */
interface SpawnSpec {
    file: string;
    args: readonly string[];
    /** 生效工作目录(缺省 = 宿主进程当前目录,与 node spawn 缺省一致) */
    cwd?: string;
    /** 完整子进程环境(缺省实现 spawn 前必经 cleanSensitiveEnv 卫生段,见下) */
    env: Record<string, string | undefined>;
    /**
     * stdio 形态(现两形态):'pipe' = stdin 管道全双工(MCP stdio / hooks
     * 写入载荷);'ignore-stdin' = stdin 立即 EOF(shell / rg,防交互挂死)。
     * stdout 恒 pipe(消费方自接流)。
     */
    stdio: 'pipe' | 'ignore-stdin';
    /** stderr 形态(缺省 'pipe';探测类一次性 spawn 可 'ignore') */
    stderr?: 'pipe' | 'ignore';
    /** POSIX:子进程成为进程组组长(整组击杀的前提);Windows 恒不脱离 */
    detached?: boolean;
    /**
     * Windows:命令行逐字节直通(libuv 不再按 CommandLineToArgvW 规则给 args
     * 加引号)。仅 MCP stdio 的 .cmd/.bat cmd.exe 包装路径设置(CW18-H2,调用
     * 方已自行完成引号安全转义);缺席 = 既有引号规则,非 win32 平台 node 忽略。
     */
    windowsVerbatimArguments?: boolean;
    /**
     * 受信环境键申报(Q4-7 卫生单点化):缺省实现 spawn 前统一
     * cleanSensitiveEnv 清洗凭据形态变量,**此处申报的键豁免**——申报语义 =
     * 调用方显式声明该值是受信投递(MCP config.env 显式声明值经 `${VAR}` 注入
     * 的服务密钥属受信申报,清洗即断连;shell 执行器的 FORCE_COLOR/NO_COLOR/
     * CI/PYTHONUTF8 注入同为显式申报)。只回注 env 中实际存在的键。
     */
    trustedEnvKeys?: readonly string[];
}
/**
 * 已启动子进程的最小句柄面(node ChildProcess 结构性满足——缺省实现零包装
 * 直接返回 spawn() 产物)。刻意保持 raw 形态:输出泵/杀树/终局语义等管理层
 * 防御各消费方自持(shell 执行器的 ShellProcessHandle 句柄契约不变,在本缝
 * 之上构建),保证五个 spawn 点的既有行为逐字节保留。
 * 注:进程树击杀(taskkill / 进程组信号)是宿主进程控制原语,留在各消费方
 * (远程世界的句柄须在其实现内封装对等的 kill 语义,W4 随远程卡重设计)。
 */
interface SpawnedProcessLike {
    /** 可选同 node ChildProcess(spawn 失败时不存在) */
    readonly pid?: number | undefined;
    /** stdio='pipe' 时在场;'ignore-stdin' 恒 null */
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    readonly exitCode: number | null;
    readonly signalCode: NodeJS.Signals | null;
    kill(signal?: NodeJS.Signals | number): boolean;
    on(event: 'spawn', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    once(event: 'spawn', listener: () => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    once(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    removeListener(event: 'spawn', listener: () => void): this;
    removeListener(event: 'error', listener: (err: Error) => void): this;
}
/**
 * 子进程缝:单方法 launch(synth-C2 §2.1)。
 * 缺省实现(default-spawn.ts)= 卫生段 + node spawn 直通;调用方对返回句柄
 * 的事件/流消费与直接 spawn 完全同形。launch 的同步抛错语义与 node spawn
 * 一致(参数级错误同步抛,运行期错误经 'error' 事件)。
 */
interface SpawnLike {
    launch(spec: SpawnSpec): SpawnedProcessLike;
}

/** 段间链接符(结构树用;'&' 表示前一段被后台化,'newline' 为换行拆段) */
type ShellChainOperator = ';' | '&&' | '||' | '&' | '|' | '|&' | 'newline';
interface ShellRedirect {
    /** 操作符原形('>' '>>' '<' '<<<' '&>' '&>>';fd 复制形态带尾 '&',如 '>&') */
    op: string;
    /** 紧随其后的目标词(去引号值);fd 复制(2>&1)与悬空重定向无目标 */
    target?: string;
}

/**
 * OPT-18 — 命令结构解析(最小命令结构树;doc/07 §5.9 的 AST 形态落地)。
 *
 * 在既有词法器(shell-match.ts,单一事实源)的结构化扫描之上建树:
 * - 顺序链(`;` `&&` `||` `&` 换行)拆成管道节点序列,管道段(`|` `|&`)
 *   归组为同一 PipelineNode 的并列子命令;
 * - 每个子命令产出 argv(去引号词序)、entity(deny 侧归一形态:小写 +
 *   迭代剥赋值前缀/包装器 + 可执行体 basename/扩展名归一,与
 *   restrictCandidates 同源)、重定向目标、替换/子 shell 标记;
 * - 注入痕迹检测(injectionSuspect):参数位藏 `$(...)`/反引号命令替换、
 *   词值内嵌换行(引号走私第二命令的素材)、eval 族实体(eval/source/.)、
 *   嵌套 shell 载荷(sh -c / powershell -Command / cmd /c 等)。
 *
 * 边界与铁律:
 * - **纯描述产物,不参与 decide() 判定**——权限判定语义(allow 保守聚合 /
 *   deny 激进拆段 / 不可解析拒绝)仍由词法器 + 引擎既有路径独担,红线语料
 *   零漂移;本产物供 LLM 分类器输入与(未来 auto/dontAsk 模式)消费;
 * - 解析上限继承词法器(命令 ≤10000 字、段 ≤50、可疑 Unicode/未闭合引号/
 *   heredoc → unparsable),单趟线性扫描,无需 wall-clock 护栏;
 * - 单引号内的 `$(...)`/反引号是字面量(hasExpansion=false),刻意不标记
 *   替换痕迹;转义反引号同理——只标真正会执行的形态。
 */

/** 注入痕迹原因码(机读;进结构化产物供分类器/审计消费) */
type InjectionSuspectReason = 
/** 词值含会执行的 `$(...)` 或反引号命令替换(含双引号内形态) */
'command-substitution'
/** 词值内嵌换行/回车(引号或转义走私,重新插值时可拼接第二命令) */
 | 'embedded-newline'
/** 实体命令是 eval 族(eval/source/.)——载荷对规则匹配不可见 */
 | 'eval-entity'
/** 实体命令是带执行旗标的嵌套 shell(sh -c / powershell -Command 等) */
 | 'nested-shell';
/** 单个子命令(一个词法段)的结构节点 */
interface SimpleCommandNode {
    /** 去引号 argv(与词法段 words 同序;重定向目标词照词法现状仍在其中) */
    argv: string[];
    /**
     * deny 侧归一形态的实体命令词序(小写;剥赋值前缀与 sudo/env/xargs 等
     * 包装器到固定点;可执行体 basename + 扩展名归一)。与规则匹配的
     * restrictCandidates 同源,不另造第二套剥离逻辑。
     */
    entity: string[];
    redirects: ShellRedirect[];
    hasRedirect: boolean;
    /** 存在会执行的命令替换(`$(...)`/反引号;单引号字面量不算) */
    hasSubstitution: boolean;
    /** 段内出现裸 ( )(子 shell/函数定义残余) */
    hasSubshell: boolean;
    /** 词法器既有 unsafe 判定原样透出(不放松) */
    unsafe: boolean;
    injectionSuspect: boolean;
    suspectReasons: InjectionSuspectReason[];
}
/** 管道节点:`|`/`|&` 相连的子命令组;chainOp 为与前一节点的链接符 */
interface PipelineNode {
    /** ';' '&&' '||' '&'(前段后台化)'newline';首节点 null */
    chainOp: ShellChainOperator | null;
    commands: SimpleCommandNode[];
}
type CommandStructure = {
    ok: true;
    /** 顺序链(结构树主干) */
    pipelines: PipelineNode[];
    /** 全部子命令按出现序展平(逐段消费的快捷面) */
    commands: SimpleCommandNode[];
    /** 任一子命令带注入痕迹 */
    injectionSuspect: boolean;
} | {
    ok: false;
    reason: 'unparsable';
};

/**
 * OPT-04 — 内置安全保护基线(默认基线集;doc/07 §5.4 决策链 + doc/optimize/02 OPT-04)。
 *
 * 语义定位(引擎接入见 engine.ts 管线 4.5 段):
 * - 基线 deny 压过模式放行(plan 只读 / acceptEdits)、allow 规则与会话缓存 allow;
 *   让位于配置层 deny/ask 与 bypassPermissions;
 * - 任一配置层显式 allow 规则命中目标 → 跳过基线(用户/企业写进配置的意图优先;
 *   会话缓存 allow 不算——防"本会话总是允许 Shell(*)"顺手放走 rm -rf /);
 * - exceptions 仅中和基线 deny,不等于放行:命中例外后继续走管线第 5 步及以后。
 *
 * 表达面收敛(按匹配器真实能力如实记录,不编造):
 * - 路径规则经 canonicalizePattern 按 cwd 锚定:`**` 前缀形态覆盖工作区(cwd 子树)
 *   内任意深度。**已知限界**:cwd 以外的绝对路径(如家目录 `~/.aws/credentials`、
 *   异盘绝对路径)不被基线覆盖——路径规则无 `~` 展开(`~` 会被当作 cwd 下的字面段),
 *   平台无关的家目录形态无法表达;需要时由用户在配置层自行补绝对路径 deny。
 * - Shell 规则是位置化前缀匹配(shell-match.ts):deny 侧大小写不敏感、自动做
 *   basename/扩展名归一并迭代剥离 sudo/env/xargs 等包装器,故 `sudo rm -rf /`、
 *   `/bin/rm.exe -rf /` 等变体天然被覆盖;子 shell/命令替换/heredoc 等花活由词法器
 *   判 unsafe/不可解析,引擎本就保守落 ask,基线不重复硬凑。
 * - `rm -rf /*` 的 `*` 在 DSL token 内恒为通配、无字面转义,以 `/?`(恰好两字符的
 *   根级项,如 `/*`、`/a`)收敛表达——其全部可命中面都是根级删除,不构成误伤;
 *   `rm -r -f /` 等拆分旗标形态、`dd` 的 `of=` 位于第 6 词位及以后的形态未覆盖
 *   (位置化匹配的表达边界),此类残余走兜底 ask 而非放行,方向安全。
 */
/** 基线规则集(规则为既有 DSL 字符串形态,与配置层同一解析/匹配管道) */
interface BaselineRules {
    /** 基线 deny(deny/ask 侧激进匹配语义,同配置层 deny) */
    deny: readonly string[];
    /** 基线例外:命中则中和基线 deny(仅中和,不放行) */
    exceptions: readonly string[];
}

/** hard-safety 追加面(managed/装配层注入;项目层永不可触) */
interface HardSafetyConfig {
    /** 追加 egress 命令实体(小写 basename) */
    extraEgressCommands?: readonly string[];
    /** 审计目录 canonical 绝对路径集(命中即 audit.modify 面) */
    auditDirs?: readonly string[];
}

/**
 * 权限引擎类型契约(纯类型,零运行时逻辑)。
 *
 * 设计要点:
 * - 判定管线与规则层;
 * - 决策链顺序与四模式语义;
 * - 多规则冲突时最严格者胜(deny > ask > allow)。
 *
 * 引擎只产出结构化决策,不含任何 UI/询问逻辑;询问由调度器执行,
 * 结果经 recordUserDecision() 回写会话缓存。
 */

/**
 * 六档权限模式(contract-v0.8 起直接别名 protocol PERMISSION_MODES 的推导
 * 类型——词表唯一事实源在契约,类型别名使漂移在编译期不可能发生;
 * config/permissions.ts 的双向 satisfies 断言保留为回归哨兵)。
 * 语义:四经典档见 engine.ts 头注释;'auto'/'dontAsk'(RFC-OPT18-1)为
 * would-ask 的两种终裁策略——auto = 工作区快路径(管线第 5 段,A 档对齐,
 * 见 workspace-fast-path.ts)+ 残余 would-ask 交 LLM 分类器裁决
 * (consultClassifier 缝),dontAsk 一律降 deny(decide 内同步变换),
 * 详见 protocol config.ts 词表注释。
 */
type PermissionMode = PermissionModeName;
/** 规则行为三值,严格度排序 deny > ask > allow */
type RuleBehavior = 'allow' | 'deny' | 'ask';
/**
 * 规则层,优先级从高到低(doc/06 §3.3;policy 来自二期策略包,一期先落数据结构)。
 * 合并语义 = 最严格者胜:任一层 deny 即 deny,任一层 ask 即至多 ask;
 * 层优先级只用于命中归因(同严格度时归因到更高层)。
 */
type RuleLayerName = 'policy' | 'projectLocal' | 'projectShared' | 'user';
/** 单层规则集合(规则字符串为 DSL 形态:`ToolName` 或 `ToolName(specifier)`) */
interface PermissionRules {
    allow?: readonly string[];
    deny?: readonly string[];
    ask?: readonly string[];
}
interface PermissionEngineConfig {
    /** 缺省 'default' */
    mode?: PermissionMode;
    layers?: Partial<Record<RuleLayerName, PermissionRules>>;
    /**
     * 内置安全基线(OPT-04):缺省 enabled=true 用 DEFAULT_BASELINE;rules 传入
     * 即整体替换默认集;enabled=false 时引擎行为与无基线实现逐字节一致。
     * 这是 kernel 级注入缝(测试/特殊装配用);面向用户的配置键
     * `permissions.disableBaselineProtection` 属 contract-v0.7 RFC 池,不在本卡。
     */
    baseline?: {
        enabled?: boolean;
        rules?: BaselineRules;
    };
    /**
     * LLM 权限分类器注入缝(OPT-18,classifier.ts):缺省不注入 = 无分类器
     * 路径(decide/consultClassifier 行为与从前逐字节一致,auto 模式亦然)。
     * 消费语义:ask 裁决可被收紧为 deny(一切模式);auto 模式下 safe 裁定
     * 可放行(资格守卫见 engine.consultClassifier 注释)。面向用户的配置键
     * `permissions.classifier` 已入契约(contract-v0.8,RFC-OPT18-2);装配层
     * 现以 TANSR_PERMISSION_CLASSIFIER=1 环境开关构造注入。
     */
    classifier?: PermissionClassifierConfig;
    /**
     * TMEM/1 记忆写 carve-out 缝(doc/38 §4.2 写回-1②):门开时装配层注入
     * 记忆目录绝对路径集;Write/Edit 目标 canonical 前缀命中 → 具名放行
     * `memory_carve_out`(管线 4.95 段,语义与先后序见 engine.decideBase
     * 该段注释)。缺省/空集 = 零行为(与无此缝逐字节一致)。
     * caseInsensitivePaths 缺省 win32 不敏感(放行方向的大小写语义必须与
     * 文件系统一致:NTFS 下敏感比对会漏配,POSIX 下不敏感比对是扩权)。
     */
    memoryWriteCarveOut?: {
        dirs: readonly string[];
        caseInsensitivePaths?: boolean;
    };
    /**
     * 家目录注入(protected paths 的 shell rc 保护面锚点;缺省
     * os.homedir())。仅测试与特殊装配需要注入;与基线同开关。
     */
    homedir?: string;
    /**
     * hard-safety 层追加面(INV-2)。内置子集恒启用、
     * **不受 baseline.enabled 与 disableBaselineProtection 影响**(绝对
     * 禁止面);本配置只允许 managed/装配层**追加**(egress 命令、审计目录),
     * 项目层永不可触(INV-4,由 config 抽取层保证)。缺省仅内置子集。
     */
    hardSafety?: HardSafetyConfig;
}
/** 判定输入(供调度器消费;isReadOnly 取自工具静态声明) */
interface DecideInput {
    toolName: string;
    args: unknown;
    isReadOnly: boolean;
    cwd: string;
    /**
     * 分类器软化抑制位:auto 下子代理调用的
     * `safe→allow` 裁决位让位派生裁决链的父终审——置位时 consultClassifier
     * 的软化面关闭(收紧方向 unsafe→deny **不受影响**,收紧不设门
     * 槛)。仅子代理执行器在「auto × 裁决链 × 父终审开」形态下经门 hints
     * 置位;缺省 = 现状(分类器全权)。**纯收紧方向**:置位只可能把 allow
     * 变 ask,永不反向。
     */
    suppressClassifierSoften?: boolean;
    /**
     * 工具元数据(协议 v4 / 应用协议,doc/121 V4-1):宿主网关自工具注册表取
     * description 与 effects(kernel ToolEffect 词表)透传;引擎**只投影进
     * ClassifierInput.tool**,不参与任何判定。缺席 = 旧宿主,行为零漂移。
     */
    toolMeta?: {
        description?: string;
        effects?: readonly string[];
    };
}
/**
 * 分类器裁决意见段(CW19-U3a,RFC-U3 §十:decisions.jsonl 审计词表归一)。
 * 与派生裁决链的 AdjudicationChainEntry(tools/dispatch/ask-router.ts)
 * **同构**——同一裁决体系两条路径共用统一动词链目形;分类器咨询恒
 * adjudicator='classifier'、via='model'(结构性出口不产意见,见
 * PermissionDecisionResult.adjudication 附着纪律)。纯审计观测位,
 * 恒不参与任何判定;protocol 事件面零改动(不进 tool.permission.decided)。
 */
interface PermissionAdjudicationEntry {
    /** 裁决人身份(分类器咨询恒 'classifier') */
    adjudicator: string;
    /** 统一裁决动词(64 §三;词表外脏值已经 classifierOpinion 归一 escalate) */
    verdict: AdjudicationVerdictKind;
    /** 裁决理由(模型原话;落盘经写入器随记录整体 redactDeep,INV-10) */
    reason: string;
    /** 意见途径(真实模型咨询恒 'model';与链目 AdjudicationVia 同词表) */
    via: 'model';
    /** 咨询耗时(毫秒;config.now 时钟源与熔断记账同源) */
    elapsedMs: number;
}
/** 判定结果——纯结构化数据,由调度器负责落审计事件 */
interface PermissionDecisionResult {
    decision: PermissionDecision;
    source: DecisionSource;
    /** 命中的规则原文(模式短路 / 最终兜底 ask 无此字段) */
    matchedRule?: string;
    /**
     * 命中规则所在层(归因;仅配置规则命中出口携带——模式短路/基线/
     * protected-path/会话缓存/分类器出口缺省)。契约事件不携带本位(源扁平化
     * 的完整解法在 DecisionRecord);当前消费方:询问面的项目来源展示。
     */
    sourceLayer?: RuleLayerName;
    /**
     * 裁决理由(自由文本;不进 tool.permission.decided 事件,契约零改动)。
     * 携带出口:
     * - source='classifier' 的 **deny**(deny-and-continue):调度器把理由
     *   并入 isError tool_result 文本回喂模型,模型据此调整路线继续本轮;
     * - source='classifier' 的 **ask**(姿态 rejectEffect='ask'):
     *   裁决人判为危险但升到询问面——理由经 GateDecision.reason 透传到
     *   askUser 第三参,询问面据此呈现「裁决人判为危险:…」供用户终审;
     * - source='classifier' 的 allow(safe 放行)同携理由(审计/日志消费);
     * - hard-safety deny(§0)携带内置理由(deny-and-continue 同径)。
     */
    reason?: string;
    /**
     * 分类器裁决意见段(RFC-U3 §十)。附着纪律(冻结):仅**真实模型咨询**
     * 归一意见后的出口携带——reject→deny 行(或 rejectEffect='ask' 姿态下的
     * reject→ask 行)、endorse→allow 行、endorse 未达半径/escalate→幸存 ask
     * (随后的用户答复/headless 降级终局行同段透传);**不附着**:窄缓存
     * 命中重放(无新咨询)、预算耗尽/熔断跳过(未起咨询)、超时/抛错
     * (结构性终局非模型意见)。调度器把本段并入决策记录 adjudicationChain
     * (与 Task 链共存时分类器条目在前)。
     */
    adjudication?: PermissionAdjudicationEntry;
}

/** 授格档三值(资格工件条目可登记的档位;16 §4.4) */
type ClassifierQualificationTier = 'low' | 'medium' | 'high';
/** 生效档四值(= 授格档 ∪ 'none';none = 无授格,恒只收紧) */
type EffectiveQualificationTier = 'none' | ClassifierQualificationTier;

/** 不入围原因(机读枚举;内核判定层无用户可见串,渲染由表面层负责) */
type ReadOnlyRejectReason = 
/** 无有效段/剥包裹后无命令 */
'empty'
/** 段含重定向/进程替换/子 shell/命令替换(词法 unsafe 位) */
 | 'unsafe-structure'
/** 命令不在只读集(含 docker 全形态、cd、写类 cmdlet 等) */
 | 'not-listed'
/** 可执行体/包装器非字面词,或路径形式调用 */
 | 'non-literal-command'
/** 命中写能/执行面旗标守卫(git branch -D、find -delete、--output 类) */
 | 'blocked-flag'
/** 实参含变量/命令替换展开 */
 | 'expansion-arg'
/** 实参为 UNC 形态(`\` 或 `//` 开头) */
 | 'unc-arg'
/** 探针候选实参为 `~` 家目录形态(canonical 不展开,探针致盲) */
 | 'home-arg'
/** 内容读取类命令带通配实参,或搜索/git 命中可疑通配 */
 | 'glob-arg'
/** 搜索类路径实参为点头隐路径段(递归进隐目录是秘密放大面) */
 | 'hidden-path-arg'
/** env 包裹携带白名单外赋值或旗标(LD_PRELOAD 类注入面) */
 | 'env-wrapper';

/**
 * shell 目标的结论级事实(协议 v5,doc/optimize/38 O-3):`command-structure` 是原料
 * (分段树),本段是引擎对各段的**结论**——哪些段在只读集内、哪些段因何不入围、
 * 有无重定向/注入痕迹。V9 余下超时 10/15 在 F5 面:模型在自行推演复合链各段性质。
 */
interface ClassifierShellFacts {
    segments: number;
    /** 只读集内的段(引擎只读快路标签) */
    readOnlySegments: readonly string[];
    /** 不入围的段:实体命令词序 + 原因码(与只读快路同一判定) */
    nonReadOnlySegments: readonly {
        entity: string;
        reason: ReadOnlyRejectReason;
    }[];
    redirects: number;
    injectionSuspect: boolean;
}
/** 变体/形态信号词表(模型可见;冻结) */
type TargetFactSignal = 'dot-segments' | 'case-variant-of-workspace' | 'trailing-dot-or-space' | 'device-name' | 'unc-path' | 'long-path-prefix';
/** 路径不可安全解析的原因词表(模型可见;冻结;与 resolveForPermission 判 unsafe 的分支一一对应) */
type TargetUnresolvableReason = 'empty' | 'control-chars' | 'volume-guid' | 'dos-short-name' | 'alternate-data-stream' | 'drive-relative' | 'malformed';
interface ClassifierTargetFacts {
    /** 判定目标种类(rules.ts resolveTarget 同词表) */
    kind: 'path' | 'url' | 'shell' | 'none' | 'unresolvable';
    /** 原始 specifier(路径/URL 工具的入参原文;脱敏由装配层 redactDeep 统一做) */
    raw?: string;
    /** 规范化绝对路径(posix 视图;仅 path 且可解析) */
    resolved?: string;
    /** 工作区根(规范化 cwd;仅 path 且 cwd 可解析) */
    workspaceRoot?: string;
    /** 精确、大小写敏感的工作区包含判定(仅 path 且两侧可解析) */
    insideWorkspace?: boolean;
    /** 形态信号(可为空数组) */
    signals: readonly TargetFactSignal[];
    /** 不可解析原因(仅 kind='unresolvable' 且为路径工具时) */
    unresolvableReason?: TargetUnresolvableReason;
    /** shell 目标的结论级事实(仅 kind='shell') */
    shell?: ClassifierShellFacts;
}

/**
 * LLM 权限分类器注入缝(机制层)。
 *
 * 接缝风格照 BundleSignatureVerifier:内核只定义接口与消费语义,
 * 实现体(LLM 调用、prompt、模型选择)由装配层注入——内核零模型依赖。
 * 姿态(block-list,「该不该拦」)与两阶段裁决(stage1 偏拦 → stage2 复审)
 * 属实现体职责(装配层 permission-classifier.ts);内核消费的三值词表不变:
 * unsafe = 该拦,safe = 不拦,unsure = 裁决不能(维持 ask 交人工)。
 *
 * 消费语义(engine.consultClassifier;contract-v0.8 起含 auto 模式):
 * - **仅当引擎裁决为 ask 时才咨询**;allow/deny 路径零开销直通,不咨询;
 * - **auto-only 缺省**:仅 auto 模式咨询;其余模式同步直通 ask
 *   (询问面本就有人裁,不花模型钱)。`tightenOutsideAuto=true` 时其余
 *   模式也咨询,但**只收紧**(unsafe→deny),safe 恒维持 ask;
 * - 分类器 `unsafe` → 收紧(归因 'classifier',RFC-OPT18-3),在咨询发生的
 *   模式下生效;**落地形按姿态**(doc/113 §二,`rejectEffect`):缺省 'deny'
 *   = deny-and-continue(调度器把 reason 并入 isError tool_result 文本,模型
 *   据此调整路线);'ask' = 升到询问面(source='classifier' + reason 携裁决
 *   理由,交用户终审;询问面缺席时由调度器既有地板降 deny)。两姿态的
 *   结果均携带 reason,契约事件零改动;
 * - `safe`:仅 auto 模式(RFC-OPT18-1)放行为 allow(归因 'classifier',
 *   且须过引擎的资格守卫——可解析/非 UNC/基线复查,见 engine 注释);
 *   其余模式 safe 恒维持 ask(**分类器绝不放行**的既有铁律);
 * - `unsure`/超时/抛错 → 维持 ask;
 * - **熔断**:分类器 reject(unsafe)连续 3 次 → 熔断
 *   30 分钟(冷却期满自动复位);会话累计 20 次 → 本会话停用。记账**按
 *   裁决人 reject 计**,与 rejectEffect 落地形无关(doc/113:熔断保护的是
 *   裁决人质量——'ask' 姿态下连续判危险同样跳闸)。熔断期间
 *   consultClassifier 同步原样返回 ask(交回询问面,headless 按既有语义降
 *   deny);跳闸经 onBreakerTrip 回调上报(装配层负责通知面,内核零 IO);
 *   人工恢复口 engine.resetClassifierBreaker(批准即恢复:两档皆
 *   复位、计数归零;仅交互面在用户显式批准后可调,无人值守入口无通道);
 * - deny 规则与内置基线永不受分类器软化(deny 路径不进咨询口);
 * - 机制默认关闭(不注入即无分类器路径;auto 未注入时 = 快路径 + 残余 ask)。
 *
 * CW19-U1(64 §三):分类器自此是「会话裁决链」统一裁决动词的一个
 * 裁决人档实现——三态在引擎咨询点经 adjudication-verdict.ts 归一
 * (safe→endorse、unsafe→reject、unsure→escalate)再落权限效果;本文件
 * 对外词表(safe/unsafe/unsure)与一切消费语义恒不变(实现体两阶段
 * 结构 = 该档内部细节)。
 */

/**
 * 分类器裁定三值(unsure 恒维持 ask;safe 仅 auto 模式放行,其余模式同
 * unsure)。统一裁决动词映射(CW19-U1):safe→endorse、unsafe→reject、
 * unsure→escalate(adjudication-verdict.ts;对外词表恒为本三值)。
 */
type ClassifierVerdict = 'safe' | 'unsafe' | 'unsure';
/**
 * 单阶段观测终态(遥测命名记「观测到什么」,不猜原因——
 * 「无事件」不得直称网络故障,「见 thinking」不证明 thinking 是唯一瓶颈):
 * - completed:流正常收到 message_stop(产出是否可解析另由 reason 表达);
 * - deadline_before_any_event:中止时未收到任何载荷事件(排队/连接/首推理均可能);
 * - deadline_after_thinking_before_text:中止时只见 thinking 未见正文;
 * - deadline_after_text_before_stop:中止时正文已开始未到 stop;
 * - stream_ended_without_stop:流自然耗尽但无 message_stop(截断);
 * - stream_error(<kind>):流内结构化 error 事件(kind 为 IR 归一化错误类)
 *   或本地异常(kind=exception);
 * - completed_reason_truncated(协议 v4 判词先结):截止
 *   到来时判词 `<block>…</block>` 已可解析、理由未收口——判词有效交付,
 *   **不是可用性损耗**(不以 `deadline_` 开头,G5 谓词不计),单列以便统计
 *   「理由被截」占比。
 */
type ClassifierStageOutcome = 'completed' | 'completed_reason_truncated' | 'deadline_before_any_event' | 'deadline_after_thinking_before_text' | 'deadline_after_text_before_stop' | 'stream_ended_without_stop' | `stream_error(${string})`;
/**
 * 单阶段遥测:**只记计时/枚举/用量计数,不落 thinking 正文或
 * prompt 内容**(脱敏纪律 INV-10 同向)。评估 harness 与装配层日志消费;
 * 引擎不读取。
 */
interface ClassifierStageTelemetry {
    /** 两阶段协议的 stage1/stage2;'single' = 单阶段对照协议(eval-only) */
    stage: 'stage1' | 'stage2' | 'single';
    outcome: ClassifierStageOutcome;
    /** 阶段耗时(ms,本地时钟) */
    elapsedMs: number;
    /**
     * 该阶段模型调用的五路归一化用量(IR message_stop.usage 透出才在场):
     * 成本可见性采纳(doc/optimize/15 对照 Claude Code 决策级成本遥测)——
     * 裁决人的每次咨询花了多少 token 必须可审计,候选授格后的运营成本
     * 才有据可查。纯计数无内容,INV-10 不受影响;引擎不消费。
     */
    usage?: IRUsage;
    /** 首个流事件相对阶段起点的毫秒(未观测到则缺席) */
    firstEventMs?: number;
    /** 首个 thinking_delta 相对毫秒(未观测到则缺席) */
    firstThinkingMs?: number;
    /** 首个正文事件(text_delta / 非空 text block_start)相对毫秒 */
    firstTextMs?: number;
    /** message_stop 携带的归一化 stop 原因(completed 时通常在场) */
    stopReason?: string;
    /** message_stop 携带的 TTFT(适配器测量;在场才记) */
    ttftMs?: number;
    /** 判词先结时刻(协议 v4):累积正文首次可解析出闭合判词的相对毫秒 */
    verdictSettledMs?: number;
    /**
     * 首字对冲(协议 v4 A-1 / v5 O-9):本阶段是否发出了对冲请求及胜出方;或首事件
     * 超上限却因会话对冲预算耗尽而未对冲(`skipped`)。缺席 = 首事件在上限内到达。
     */
    hedge?: {
        fired: true;
        winner: 'primary' | 'hedge';
    } | {
        fired: false;
        skipped: 'budget-exhausted';
    };
    /**
     * 不可解析**正文**的脱敏定长摘要(协议 v3,doc/optimize/20 G-3①):仅
     * 装配层解析失败(unparsable)分支写入——正常裁决不留正文,INV-10
     * 「不落 thinking 正文」纪律不破(这里是 text 面且过密钥脱敏、定长
     * 256);评估侧据此区分「格式漂移」与「预算耗尽无正文」,不再靠猜。
     */
    rawDigest?: {
        /** 正文总长(字符;0 = 完成但零正文,reasoning_exhausted 的锚) */
        textLength: number;
        /** 脱敏后前 256 字符 */
        head: string;
        /** 正文中出现的 XML 样式标签名去重清单(协议标签漂移取证) */
        tags: readonly string[];
    };
}
interface ClassifierResult {
    verdict: ClassifierVerdict;
    /** 一句话理由(deny-and-continue 回传模型 + 装配层日志;内核不渲染) */
    reason: string;
    /**
     * 协议 v5 三值判词(doc/optimize/38 O-1):`unsure` 由模型**主动**答 `ask`(交人)
     * 而非裁决不能(超时/不可解析/流错)时置 true。引擎消费不变(unsure 恒维持
     * 询问);评估侧据此把「模型主动交人」从 G3「裁决不能」中剔除、另列 askRate。
     */
    escalatedByModel?: true;
    /**
     * 逐阶段观测遥测(可选):装配层实现按实际执行的阶段附带;
     * 引擎裁决不消费本字段(纯观测面),评估 harness 落盘作续轮证据。
     */
    telemetry?: readonly ClassifierStageTelemetry[];
}
/**
 * transcript 切片:**仅用户 prompt 文本**——助手文本与工具结果刻意
 * 排除在外(注入防御:被污染的工具产出不得成为分类器的指令面);截断与
 * 条数上限由装配层记录器负责。
 */
interface ClassifierTranscript {
    userPrompts: readonly string[];
}
/**
 * 权限策略语境(协议 v2):引擎在咨询时把「模型据以裁决
 * 的治理事实」随载荷注入——多轮漏放归因实证:考官(引擎)拿规则
 * 算期望、考生(分类器)没拿到规则,deny 混淆变体/越界读/隐私面被模型按
 * 「通用危险性」世界观放行(对照 CC 把 policy spec 喂进裁决 prompt 的
 * 做法采纳)。字段全部来自引擎已有状态,零新 IO:
 * - 规则列表 = **与本工具相关**(ruleMatchesTool)的生效规则原文,按层序;
 *   allow 取 auto 求值视图(宽 allow 丢弃后)——语境必须与判定语义一致;
 * - 会话层授权缓存刻意不注入(其命中早于咨询口,到分类器的调用必然未中);
 * - 每类条数截断(rulesTruncated 如实标注,渲染侧提示列表不全;不禁 safe
 *   ——规则超界是配置形态而非载荷截断,「截断禁 safe」语义不扩权)。
 */
interface ClassifierPolicyContext {
    /** 咨询发生时的权限模式(引擎定格值;auto 之外 = tightenOutsideAuto 面) */
    mode: string;
    /** 引擎走到 ask 的归因(PermissionDecisionResult.source) */
    decisionSource: string;
    /** 归因命中的规则原文(builtin/mode 兜底时缺席) */
    matchedRule?: string;
    deny: readonly string[];
    ask: readonly string[];
    allow: readonly string[];
    /** 任一类列表被条数上限截断(如实标注;完整列表见配置) */
    rulesTruncated?: boolean;
}
/**
 * 工具元数据(协议 v4 / 应用协议 v1,doc/121 V4-1):宿主网关自工具注册表
 * 取值经 DecideInput.toolMeta 透传,引擎原样投影——`<tool>` 段(应用协议)
 * 的数据源。effects 是开发者声明的效应信号(kernel ToolEffect 词表),
 * **只进语境与遥测,不进任何确定性判定**(doc/optimize/37 P-5)。
 */
interface ClassifierToolMeta {
    description?: string;
    readOnly: boolean;
    effects?: readonly string[];
}
/**
 * 应用语境(应用协议 v1):bundle `app.name` / `app.purpose`。装配层闭包
 * 提供(生产恒为会话常量);评估 harness 逐例注入以变换语境三态。
 */
interface ClassifierAppContext {
    name: string | null;
    purpose: string | null;
    /**
     * 终端用户身份(应用协议 v2,doc/optimize/38 O-4):serve /v2 取会话 endUserId,SDK 令牌档
     * 由开发者经 `adjudication.endUser` 提供的不透明标识;渲染 `<app>` 段 `end-user:` 行,
     * 供模型比对 arguments 中的归属字段(客户/用户/租户 id)。缺席渲染 "(not declared)"。
     */
    endUser?: string | null;
}
interface ClassifierInput {
    toolName: string;
    args: unknown;
    /** Shell 工具的命令结构树(逐段实体 + 注入痕迹);其余工具缺席 */
    commandStructure?: CommandStructure;
    /** 当前轮用户请求切片(注入了 transcript 提供器且非空时附带) */
    transcript?: ClassifierTranscript;
    /** 权限策略语境(协议 v2;引擎注入,harness 从语料同形构造) */
    policyContext?: ClassifierPolicyContext;
    /**
     * 判定目标事实(协议 v4,target-facts.ts 投影):规范化路径 / 工作区包含 /
     * 变体信号 / 不可解析原因——引擎已算出的确定性结果,模型只判意图不算路径。
     */
    targetFacts?: ClassifierTargetFacts;
    /** 工具元数据(宿主网关透传;缺席 = 旧宿主,渲染侧按缺席处理) */
    tool?: ClassifierToolMeta;
    /** 应用语境(应用协议;评估逐例注入,生产由装配闭包补齐) */
    app?: ClassifierAppContext;
}
/** 单分类器接口(装配层实现:LLM 调用须尊重 signal,超时由引擎强制) */
interface PermissionClassifier {
    classify(input: ClassifierInput, signal: AbortSignal): Promise<ClassifierResult>;
}
/** 熔断跳闸事件(consecutive=3 连拒进 30min 冷却;total=会话累计 20 拒停用) */
interface ClassifierBreakerTrip {
    kind: 'consecutive' | 'total';
}
/** 熔断状态快照(getClassifierBreakerState 查询口;测试与状态面消费) */
interface ClassifierBreakerState {
    totalDenies: number;
    consecutiveDenies: number;
    tripped: 'none' | 'cooldown' | 'session';
    /** 本会话累计跳闸次数(指标口;人工复位不清零) */
    trips: number;
}
interface PermissionClassifierConfig {
    classifier: PermissionClassifier;
    /** 咨询超时(毫秒),缺省 DEFAULT_CLASSIFIER_TIMEOUT_MS;超时维持 ask */
    timeoutMs?: number;
    /**
     * 三级资格档动态解析闭包:返回当前生效档
     * (= min(授格档, 天花板, 会话覆盖),合成在装配层)。引擎**每次咨询
     * 现算**(含窄缓存命中路径)——validUntil 会话中越期、天花板/覆盖变更
     * 均即刻生效,无缓存陈旧窗口。软化谓词 =
     * `mode==='auto' ∧ SOFTEN_RADIUS[resolveTier()][face] ∧ ¬explicitConfigAsk`
     * + 既有 taint 豁免与 classifierAllowEligible 守卫。闭包抛错/返回词表外
     * 值按 'none' 处理(fail-closed);unsafe→deny 与 unsure→ask
     * 不经本位,收紧方向不设资格门槛。
     */
    resolveQualificationTier?: () => EffectiveQualificationTier;
    /**
     * transcript 提供器:每次咨询时取当前轮用户 prompt 切片附进
     * ClassifierInput;缺省或返回 undefined/空集不附。装配层典型实现为
     * createClassifierTranscriptRecorder(入口在轮起跑时回填)。
     */
    transcript?: () => ClassifierTranscript | undefined;
    /** 熔断跳闸回调:装配层接通知面;内核零 IO,不注入即静默 */
    onBreakerTrip?: (trip: ClassifierBreakerTrip) => void;
    /** 时钟注入(熔断冷却窗口计时;缺省 Date.now。测试用) */
    now?: () => number;
    /**
     * 非 auto 模式收紧开关:缺省 false = auto-only(其余模式不咨询,
     * 询问面有人裁不花模型钱)。true 时其余模式的 ask 也咨询,但只允许
     * unsafe 收紧(落地形按 rejectEffect:'deny' 收紧为 deny;'ask' 落为携
     * 裁决理由的 ask——本就是 ask,等价于维持,只多了 source='classifier'
     * 与 reason 素材);safe 恒维持 ask(放行仍是 auto × 资格的专属)。
     */
    tightenOutsideAuto?: boolean;
    /**
     * reject(unsafe)的落地效果(doc/113 权限裁决姿态):
     * - `'deny'`(缺省 = 现状):收紧为 deny,deny-and-continue——调度器把
     *   reason 并入 isError tool_result 回喂模型;B 无人环姿态(headless /
     *   acp / 未接 askUser 的 SDK / 无订阅者的 /v2)所用;
     * - `'ask'`:升到询问面——出口 `{ decision:'ask', source:'classifier',
     *   reason, matchedRule 保留 }`,交用户终审(用户拒即 deny;机器恒不代批);
     *   A 人在环姿态(TUI / 接了 askUser 的 SDK / 有权限桥的 /v2)所用;询问
     *   面缺席时由调度器 ask-router 既有地板降 deny(fail-closed 不变)。
     * 只改 reject 的落地形:endorse/escalate 语义、资格制、tightenOutsideAuto、
     * 窄缓存(仅 safe)、callBudget 直通 ask 均不受影响;熔断按 reject 计与本位
     * 无关。hard-safety / 显式 deny 规则 / 内置基线(秘密面、灾难集)在 decide
     * 主管线即 deny,根本不进咨询口——任何姿态不软化(地板三层不变量)。
     */
    rejectEffect?: 'deny' | 'ask';
    /**
     * 每会话咨询调用预算(成本控制):计**实际发起的模型咨询**
     * (缓存命中与各类直通不计)。耗尽后咨询口同步直通 ask(超限改询问,
     * 方向安全);缺省 DEFAULT_CLASSIFIER_CALL_BUDGET,非有限值 = 不限。
     */
    callBudget?: number;
    /** 预算耗尽单次回调(装配层接通知面;内核零 IO) */
    onBudgetExhausted?: () => void;
    /**
     * 缓存版本标签(窄缓存「策略与模型/提示词版本」键分量):
     * 装配层以协议指纹+stage 模型对构造;缺省空串。变更即全部缓存键失配。
     * 另接受函数形——/model 切换后 stage 模型对活值贯通时,
     * 标签必须随现值换代(否则旧模型时代的 safe 裁定会以同键命中回放到新
     * 模型时代)。引擎每次构键现算;静态装配仍传字符串(零漂移)。
     */
    cacheVersionTag?: string | (() => string);
}
/** 窄缓存统计(getClassifierCacheStats 查询口;命中率数据 = DoD 证据) */
interface ClassifierCacheStats {
    hits: number;
    misses: number;
    size: number;
}
/**
 * 咨询用量快照(T-K19b getClassifierUsage 查询口):consultCount 计实际
 * 发起的模型咨询(缓存命中与各类直通不计,与预算记账同口径);budget 为
 * 生效预算(config.callBudget ?? 缺省;Infinity = 不限);budgetExhausted
 * 即「已计满、后续咨询同步直通 ask」的现状位(不限预算恒 false)。
 */
interface ClassifierUsage {
    consultCount: number;
    budget: number;
    budgetExhausted: boolean;
}

/**
 * CW19-U1 — 统一会话裁决动词与咨询共形(doc/64 §三「三态动词归一」;
 * kernel 内部抽象,恒不入 packages/protocol)。
 *
 * 「会话裁决链」上的一切裁决人档(权限分类器 / 派生裁决链父代理 / 后续
 * 裁决人池成员)对一次权限咨询只说三个动词:
 * - `endorse`:担保——恒有界(铁轨 1),效果半径恒由 SOFTEN_RADIUS
 *   单一事实源裁定(铁轨 4):分类器面 = safe 软化资格位,链面 = 半径内
 *   父终审;半径外担保自动转上升;
 * - `reject`:拒绝——收紧不设门(铁轨 2):分类器面 = unsafe→收紧(落地形
 *   按表面姿态 rejectEffect:deny 或携理由升人终审,doc/113 §二),
 *   链面 = 任意级即终局短路;
 * - `escalate`:上升——不能决/失败恒朝严(铁轨 3):分类器面 = 维持
 *   ask 交询问面,链面 = 上一级接力,链尽落链顶(用户终审或地板)。
 *
 * 分类器三态映射(64 §三,D 组已拍板):safe→endorse、unsafe→reject、
 * unsure→escalate;词表外脏值(运行期模型输出未收敛)→ escalate,与
 * 引擎既有「词表外维持 ask」逐字节同效(金样 classifier-consult-edges
 * 锁样)。
 *
 * 本词表与派生裁决链的 AdjudicationVerdictKind 是**同一类型**——
 * ask-router.ts 自本文件再导出(类型归一非重造)。对外契约(protocol
 * 的权限三态 allow/deny/ask 与分类器三态 safe/unsafe/unsure)恒零改动。
 */

/** 统一裁决三态动词(会话裁决链全体裁决人档共用词表;kernel 内部) */
type AdjudicationVerdictKind = 'endorse' | 'reject' | 'escalate';
/**
 * 统一裁决咨询意见(最小共形):动词 + 理由。派生裁决链的审计条目
 * (AdjudicationChainEntry)在此之上扩责任人/途径/耗时字段;分类器
 * 咨询结果经 classifierOpinion 归一到此形。
 */
interface AdjudicationOpinion {
    verdict: AdjudicationVerdictKind;
    /** 裁决理由(模型原话;进审计留痕与 deny-and-continue 回喂载荷) */
    reason: string;
}

/**
 * token 估算器接口(可替换缝)。
 * 契约:三个方法都返回非负整数;estimateMessage ≥ Σ estimateBlock(消息定额
 * 不为负)——账本按块分路时用两者之差归入 overhead 路。
 * profileId(可选):估算配置指纹(系数集哈希)——测量结果与埋点携带,
 * 系数漂移可观测;自定义实现可缺省。
 */
interface TokenEstimator {
    /** 估算配置指纹(可选;createDefaultEstimator 恒携带) */
    readonly profileId?: string;
    /** 纯文本估算(system 段、摘要文本等无块结构的文本) */
    estimateText(text: string): number;
    /** 单内容块估算(按块类型分派系数) */
    estimateBlock(block: IRBlock): number;
    /** 整条消息估算 = Σ estimateBlock + 消息定额 */
    estimateMessage(message: IRMessage): number;
}

interface RequestBasis {
    readonly key: string | undefined;
    readonly system: IRSystemSegment[];
    readonly tools: IRToolDef[];
    readonly systemTokens: number;
    readonly toolTokens: number;
}

/** 等待资源收尾的选项:超时上限与只取消本次等待的信号。 */
interface ResourceSettleOptions {
    /** 缺省30秒；0只观察，Infinity须显式给。超时不取消底层清理。 */
    timeoutMs?: number;
    /** 只取消此次等待，不abort查询、不影响其他等待者。 */
    signal?: AbortSignal;
}
/** 单条资源收尾失败:来源令牌、作用域、操作号、阶段与原抛值。 */
interface ResourceSettlementFailure {
    /** 进程内稳定来源令牌；空对象只用于身份比较，不写协议/日志。 */
    sourceId?: object;
    /** 合并查询/压缩结算结果时标明局部operationId的来源；单scope结算可缺省。 */
    scope?: 'query' | 'compaction';
    operationId: number;
    phase: 'model_stream' | 'tool_executor';
    /** 原抛值（包括undefined）；调用方不得未经处理序列化到日志。 */
    cause: unknown;
}
/** 资源收尾结算结果:终态、仍在途的计数、失败窗口与累计失败数。 */
interface ResourceSettlementResult {
    status: 'completed' | 'failed' | 'timeout' | 'cancelled';
    pending: {
        execution: number;
        modelStreams: number;
        toolExecutors: number;
    };
    /** 最近32项；累计失败事实不会因窗口滚动消失。 */
    failures: readonly ResourceSettlementFailure[];
    failureCount: number;
    omittedFailures: number;
    /** 每个真实scope的累计失败；旧第三方结算结果可缺席，由消费者提供稳定owner。 */
    sources?: readonly ResourceSettlementSource[];
}
interface ResourceSettlementSource {
    readonly sourceId: object;
    readonly failureCount: number;
}

type AnchorSource = 'pin' | 'extracted';
interface AnchorEntry {
    /** 单注册表内单调 id(`a<seq>`;/unpin 与列表的稳定句柄) */
    id: string;
    source: AnchorSource;
    /** 折叠空白 + 截断后的锚点文本 */
    text: string;
    /** 登记/最近复述时的会话 round 序(新鲜度基准;ledger cumulative.rounds) */
    round: number;
    /** 被复述次数(单次扫描批内重复出现计入;跨批取 max 不累计,防重试扫描通胀) */
    refCount: number;
    /** 登记时一次性估算 tokens(base 估算器口径,不随校准因子漂移) */
    estTokens: number;
}

/** MEM-08：仅对同主题同版本的记忆正文共享准入；来源开场不参与版本。 */
interface AttachmentSemanticIdentity {
    namespace: 'memory-topic';
    /** 生产者已有读取路径的规范身份；不为去重另行扫描或realpath。 */
    identity: string;
    /** 实际加载正文（含as-of和截断状态）的sha256。不同版本不能相互引用。 */
    version: string;
    source: 'paths' | 'selector';
    /** 只供引用说明；具体触达文件不参与主题版本去重键。 */
    triggerPath?: string;
}
/** 附件输入(content 为拟注入的全文文本) */
interface AttachmentInput {
    /** 附件类型(如 'file' / 'diagnostic' / 'todo' / 'task_notification') */
    type: string;
    /** 来源标识(如文件绝对路径、任务 id) */
    sourceIdentity: string;
    content: string;
    semanticIdentity?: AttachmentSemanticIdentity;
}
/** 三元签名(doc/07 §3.6⑦) */
interface AttachmentSignature {
    type: string;
    sourceIdentity: string;
    /** content 的 sha256 十六进制 */
    contentHash: string;
}
/** 注入决定:首见(或 TTL 过期再现)→ 注入全文 */
interface AttachmentInjectDecision {
    kind: 'inject';
    signature: AttachmentSignature;
    /** 注入全文的 UTF-8 字节数(已计入 session 预算) */
    bytes: number;
}
/** 注入决定:TTL 内重复 → 引用化(不重复注入全文) */
interface AttachmentReferenceDecision {
    kind: 'reference';
    signature: AttachmentSignature;
    /** 首次注入发生的 round */
    firstSeenRound: number;
    /** 首次注入时的来源标识(同内容不同名时与本次输入不同) */
    firstSeenSourceIdentity: string;
    /** 可直接注入的短引用文本(调用方也可自行渲染) */
    referenceText: string;
}
/** 注入决定:session 字节预算耗尽 → 拒绝 */
interface AttachmentRejectedDecision {
    kind: 'rejected_budget';
    signature: AttachmentSignature;
    budgetBytes: number;
    usedBytes: number;
}
type AttachmentDecision = AttachmentInjectDecision | AttachmentReferenceDecision | AttachmentRejectedDecision;
interface AttachmentRegistryOptions {
    /** 同签名去重的存活轮数;默认 10 */
    ttlRounds?: number;
    /** session 注入字节预算;默认 256 KiB */
    sessionBudgetBytes?: number;
    /**
     * 注入内容的 tokens 估算缝(观测口径,不参与三态裁决)。
     * manager 构造注册表时以自身估算器填充;缺席时快照不产 tokens 字段
     * (不虚构数字)。
     */
    estimateTokens?: (content: string) => number;
}
/** 快照中的在场附件条目(TTL 内;/context 逐条行数据源) */
interface AttachmentActiveEntry {
    type: string;
    sourceIdentity: string;
    firstSeenRound: number;
    /** 距 TTL 失效剩余轮数(≥1;推进到 0 即从在场清单消失) */
    ttlRemainingRounds: number;
    /** 注入全文的 UTF-8 字节数 */
    bytes: number;
    /** 注入时估算 tokens(estimateTokens 缝在场才有;未校准口径) */
    estimatedTokens?: number;
}
/**
 * 注册表只读快照(/context 附件行真实化的数据源)。
 * 语义注记:entries 只含 TTL 内在场者;injectedBytes 是 session 累计
 * (含已过 TTL/已被压缩失效的历史注入,预算口径);estimatedTokens 为
 * 在场条目合计,压缩成功清签名后归零(引用目标已被摘要替换,如实)。
 */
interface AttachmentStats {
    round: number;
    injectedBytes: number;
    budgetBytes: number;
    ttlRounds: number;
    /** TTL 内在场附件数(= entries.length) */
    activeCount: number;
    /** 在场附件估算 tokens 合计(estimateTokens 缝在场才有) */
    estimatedTokens?: number;
    /**
     * X3-3 C3(K-6)— session 累计预算拒绝次数(rejected_budget 裁决数)。
     * >0 = 预算已开始拒载,后续同量级诊断注入将持续静默丢弃至会话结束
     * (预算只增不减);/context 警示行与首拒 advisory 的数据源。
     */
    rejectedCount: number;
    entries: AttachmentActiveEntry[];
}

/**
 * 校准桶词表(观测/快照/事件按此词表点名;扩桶走 kernel API 评审)。
 * plain=拉丁散文;cjk=CJK 码点主导;json=工具载荷主导;mixed=CJK 掺杂。
 */
declare const CALIBRATION_BUCKETS: readonly ["plain", "cjk", "json", "mixed"];
type CalibrationBucket = (typeof CALIBRATION_BUCKETS)[number];
/** 单桶校准态(快照/观测投影的公共形态) */
interface BucketCalibrationState {
    bucket: CalibrationBucket;
    /** 桶内 EWMA 因子(恒钳 [CALIBRATION_FACTOR_MIN, MAX];1 = 未观测) */
    factor: number;
    /** 桶内已入 EWMA 的观测数(置信度分子) */
    observations: number;
}
/**
 * 跨 manager 重建搬运快照(driver 切方案携带;切模不携带——因子是
 * tokenizer 词元密度的观测,换模型即失效)。
 */
interface CalibrationSnapshot {
    /** 门关(标量)路径的 EWMA 因子(单标量校准现状态) */
    factor: number;
    /** 门开(分桶)路径的桶态(仅有观测的桶入快照) */
    buckets: BucketCalibrationState[];
    /** 最近一次测量的归桶(应用缝的当前档) */
    lastBucket: CalibrationBucket;
}
/** 水位评估的校准明细(门开时随 ContextAssessment 在场;纯观测口径) */
interface AssessmentCalibrationDetail {
    bucket: CalibrationBucket;
    factor: number;
    confidence: number;
    /** 本次评估施加的置信度安全边际(tokens;决策口径,不改测量) */
    marginTokens: number;
}
/** 压缩观测材料的校准明细(门开时在场;started 事件同源投影) */
interface CompactionCalibrationDetail {
    bucket: CalibrationBucket;
    factor: number;
    confidence: number;
    observations: number;
}

/**
 * token 六路账本
 *
 * 分路规格:uncached / cacheRead / cacheWrite(cacheCreation)/
 * cacheDeleted / output / 本地估算尾部,六路分列不得合并。
 *
 * 「当前上下文占用」口径:取最近 assistant round 的
 * `input + cache_creation + cache_read`(provider 权威计量,**不含 output**)
 * + 上次实发输入结束后消息的本地估算尾部（含上一 assistant）。无有效锚点
 * (会话开头/锚点失效/刚压缩完)
 * 时退化为全量本地估算,整体记入 estimatedTail 路。
 *
 * cacheDeleted 路说明:contract-v0.4 起 IRUsage 原生携带可选
 * cacheDeletedInputTokens(cached microcompact),缺席恒 0。
 * 语义验证(哪些 provider 真报该字段)未完成前,contextTokens 不做
 * cacheDeleted 扣减(避免对未验证语义提前建模)。
 *
 * 确定性:同输入必同输出;不读时钟。
 */

/**
 * usage 入账形态。contract-v0.4 起 IRUsage 已含 cacheDeletedInputTokens,
 * 本别名保留以稳定既有引用面(此前为扩展接口)。
 */
type LedgerUsageInput = IRUsage;
/** 一次完整 API round 的入账记录 */
interface RoundUsageInput {
    usage: LedgerUsageInput;
    /**
     * 该 round 的 assistant 消息在会话消息数组中的 index(锚点定位)。
     * measure 时按此切分「权威计量段 / 本地估算尾部」。
     */
    anchorIndex: number;
    /** CM14：由实际发送方准备的一次性凭据；缺席仍累计，但不得补绑当前输入。 */
    receipt?: SentRequestReceipt;
}
/** 仅当前 ledger 签发的对象可消费；字段只读，不进入协议或历史持久化。 */
interface SentRequestReceipt {
    readonly sequence: number;
    readonly basis: RequestBasis;
    readonly generation: number;
    readonly inputEndExclusive: number;
    readonly boundary: string | undefined;
    readonly ephemeral: boolean;
}
/** 六路分解(doc/07 §3.6① 的固定分路,任何聚合都从这六路算起) */
interface LedgerBreakdown {
    /** 输入中未命中缓存的部分(usage.inputTokens) */
    uncachedInput: number;
    /** 缓存读命中(usage.cacheReadInputTokens) */
    cacheRead: number;
    /** 缓存写入/创建(usage.cacheCreationInputTokens;即 §3.6① 的 cacheWrite) */
    cacheCreation: number;
    /** 缓存删除(cached microcompact;IRUsage 契约缺口,见文件头注释) */
    cacheDeleted: number;
    /** 模型输出(当前上下文口径恒 0——doc/07 §3.1「不含 output」;累计口径为真实累计) */
    output: number;
    /** 本地估算尾部(上次实发输入结束后消息;无锚点时为全量估算) */
    estimatedTail: number;
}
/** 会话累计用量(六路累计 + reasoning 细分注脚 + round 计数) */
interface CumulativeUsage extends LedgerBreakdown {
    /** output 中的推理部分(usage.reasoningOutputTokens 累计;是 output 的细分,非第七路) */
    reasoningOutput: number;
    /** 已入账的 API round 数 */
    rounds: number;
}
/** 测量输入：system + messages + tools；basis 是本屏障内核自有快照。 */
interface ContextView {
    system: readonly IRSystemSegment[];
    messages: readonly IRMessage[];
    /** 父请求工具数组，首轮及无有效authority时完整计额。 */
    tools?: readonly IRToolDef[];
    basis?: RequestBasis;
}
/**
 * 本地估算尾部的来源细分(任务卡「工具结果/系统注入等按文档分路」的
 * 尾部子账;/context 命令与压缩策略诊断用)。
 * 不变量:toolResults + systemInjected + other + systemSegments + toolDefinitions + overhead
 * = estimatedTail(估算器满足「estimateMessage ≥ Σ estimateBlock」契约时)。
 */
interface TailDetail {
    /** tool_result 块(工具结果路) */
    toolResults: number;
    /** `<system-reminder>` 包裹的注入文本(系统注入路;makeReminder 形态) */
    systemInjected: number;
    /** 其余块(用户输入文本/图片/锚点后 assistant 输出等) */
    other: number;
    /** system 段估算(仅无锚点全量估算时非零;有锚点时 system 已含在权威 input 内) */
    systemSegments: number;
    /** 固定工具定义估算（有相容authority时为0）。 */
    toolDefinitions?: number;
    /** 消息定额合计(estimateMessage 与 Σ estimateBlock 之差,按契约非负) */
    overhead: number;
}
/** 测量结果:当前上下文占用 + 六路分解 + 累计快照 */
interface ContextMeasurement {
    /** 当前上下文占用(进阈值代数的唯一数字) */
    contextTokens: number;
    /** 当前上下文的六路分解(output 恒 0,见 LedgerBreakdown.output 注释) */
    breakdown: LedgerBreakdown;
    /** estimatedTail 路的来源细分 */
    tailDetail: TailDetail;
    /** 是否存在有效锚点(false = 全量本地估算) */
    anchored: boolean;
    /** 有效锚点的消息 index(无则 null) */
    anchorIndex: number | null;
    /** 会话累计六路(压缩不清零——成本视角是会话生命周期累计) */
    cumulative: CumulativeUsage;
    /**
     * 产出本测量的估算器配置指纹(TokenEstimator.profileId 透传;
     * 估算器未携带指纹时缺席)。压缩埋点与阈值漂移归因消费。
     */
    estimatorProfileId?: string;
    /** 仅消息尾部的基础估算，不含system/tools或校准因子。 */
    rawMessageTailTokens?: number;
    /** CM14：固定面；供同屏障复用，不是已发送证据。 */
    basis?: RequestBasis;
}

/**
 * 请求目的归属(⑤ §2.1 统一维度;词表冻结,扩值走 kernel API 评审——
 * TM-9 扩 'memory' 与契约词表 TWP_PURPOSES 同步,值级发送门在 providers/
 * cli 出线面,kernel 本地观测恒全量归因)。
 *
 * 词表分叉登记(R8 核实,2026-08-26):本词表 'classifier' 与 cost 事件面
 * 词 'permission_classifier'(protocol events.ts purpose 注释词表、kernel
 * cost/tracker.ts KNOWN_COST_PURPOSES)近义并存——两面词表历史各自扩,
 * 统一候拍板;在此之前跨面对账须显式换算,勿单侧改词。
 */
type RequestPurpose = 'main' | 'compaction' | 'title' | 'classifier' | 'memory';
/**
 * 请求终态三分(流终态口径,与业务结局解耦):
 * - success:message_stop 达成(usage 若 provider 上报则在场)——质量门
 *   拒绝(summary_malformed 等)不改变本口径,请求本身已成功计费;
 * - error:流内 error 事件或 ModelClient 契约违约(无 message_stop 收尾);
 * - aborted:调用方中断或超时守门放弃(无 terminal usage 可配对)。
 * E4 可校准覆盖率的分母 = success 行(⑤ §2.3:失败/中断无 message_stop
 * 的样本不进 E1–E3,只进缺失统计)。
 */
type RequestOutcome = 'success' | 'error' | 'aborted';
/**
 * 请求估算特征向量(⑤ P0-2 建议特征的落地形态)。**零原文不变量**:全部
 * 字段为计数/估算值/指纹,不含任何消息文本、工具参数、路径或摘要内容
 * (锁测断言序列化后不含语料子串)。
 */
interface RequestFeatures {
    /** 消息条数(不含 system 段) */
    messageCount: number;
    /** system 段数 */
    systemSegmentCount: number;
    /** 工具定义数量 */
    toolCount: number;
    /** 各类型块计数(tool_result 按块计,其内嵌 item 不重复计) */
    blockCounts: {
        text: number;
        thinking: number;
        toolCall: number;
        toolResult: number;
        image: number;
        opaque: number;
    };
    /** 文本类字符数(text/thinking 块 + system 段;UTF-16 单元口径,与 estimator 同源) */
    textChars: number;
    /** 文本类中的 CJK 码点数(estimator splitCharClasses 同一判定) */
    textCjkChars: number;
    /** JSON 类字符数(tool_call name+args 序列化 + tool_result 文本 + opaque 序列化) */
    jsonChars: number;
    /** JSON 类中的 CJK 码点数 */
    jsonCjkChars: number;
    /** 工具定义 JSON 序列化总字符数(tool schema bytes 的字符口径) */
    toolSchemaChars: number;
    /** 图片块数(顶层 image 块 + tool_result 内嵌 image item) */
    imageCount: number;
    /** estimator 全量估算(system + messages + tools;E1 的 E 值) */
    estimatedTokens: number;
    /** 分项:system 段估算 */
    estimatedSystemTokens: number;
    /** 分项:messages 估算(含消息定额) */
    estimatedMessageTokens: number;
    /** 分项:tools 估算(opaque 块口径,与 eval-context gate-helpers 同径) */
    estimatedToolTokens: number;
    /** 估算配置指纹(estimator.profileId;自定义估算器可缺席) */
    estimatorProfileId?: string;
}
/**
 * 构成段 id(六段口径,决策冻结):
 * - system:系统提示全部段(cacheable 与否均计,回答「提示词占多少」);
 * - tools:工具定义面(JSON schema 序列化口径,与 features.estimatedToolTokens
 *   同径);
 * - history:对话史正文——user/assistant 文本、thinking、tool_call
 *   (name+args;模型自产调用属对话史);
 * - toolResults:tool_result 块全量(内嵌文本与图片一并归此);
 * - reminders:提醒与附件——`<system-reminder>`/`<attachment …>` 包裹段
 *   (整块或块内 span)、`<context-budget …/>` 请求副本尾块、附件引用存根;
 * - other:图片块、opaque 块、消息结构定额(estimateMessage 与 Σ
 *   estimateBlock 之差)等未分类项。
 * 粒度纪律:恒为六段级合计,不下钻单消息(事件体积纪律)。
 */
declare const MANIFEST_SEGMENT_IDS: readonly ["system", "tools", "history", "toolResults", "reminders", "other"];
type ManifestSegmentId = (typeof MANIFEST_SEGMENT_IDS)[number];
/** 单段测量:bytes = UTF-8 字节(图片为 base64 串字节);tokens 与 features 同源 estimator */
interface RequestManifestSegmentMeasure {
    bytes: number;
    estimatedTokens: number;
}
/** 六段全覆盖(键集冻结;零值段如实为 0,不缺键) */
type RequestManifestSegments = Record<ManifestSegmentId, RequestManifestSegmentMeasure>;
/**
 * cacheable 前缀指纹(断裂归因线索的素材):对「按设计应会话内字节稳定」
 * 的请求头——工具定义(wire 序列化序)+ cacheable=true 的 system 段——做
 * sha256 截断指纹。同会话相邻请求指纹变化即前缀断裂线索;env/记忆等
 * 非 cacheable 段刻意不入指纹(它们不承载缓存断点,W1 §3.2 段序纪律)。
 */
interface RequestPrefixInfo {
    /** sha256 hex 截断 16 字符(长度框定拼接,无歧义;W1 无既有指纹产物,此处新建) */
    fingerprint: string;
    /** 被指纹覆盖材料的 UTF-8 字节合计 */
    bytes: number;
    /** cacheable=true 的 system 段数(0 = 无显式缓存头,指纹仅覆盖工具面) */
    cacheableSegments: number;
}
/** 上下文构成清单(纯函数产物;确定性:同输入恒同输出,零原文不变量同 features) */
interface RequestManifest {
    segments: RequestManifestSegments;
    prefix: RequestPrefixInfo;
}
/** 请求测量观测事件(started 特征 + terminal usage 合并为单事件,⑤ P0-2) */
interface RequestMeasuredEvent {
    /** 单次请求关联 id(crypto.randomUUID;E4 配对键) */
    requestId: string;
    purpose: RequestPurpose;
    /** 已解析模型标识(IRRequest.model 透传;不含端点 URL) */
    provider: string;
    model: string;
    /** 发出前提取的估算特征向量(零原文) */
    features: RequestFeatures;
    outcome: RequestOutcome;
    /**
     * 失败/中断归因(outcome≠success 时在场):error → IRErrorKind 或
     * 'contract'(流无 terminal 收尾);aborted → 'aborted'(调用方中断)/
     * 'timeout'(超时守门)。
     */
    errorKind?: string;
    /** begin→finish 墙钟时长(ms;观测口径) */
    durationMs: number;
    /** provider 上报的首 token 延迟(message_stop.ttftMs 透传;在场才落) */
    ttftMs?: number;
    /** terminal usage 五路原样(provider 上报才在场;恒 exclusive 语义) */
    usage?: IRUsage;
    /**
     * 输出侧本地估算(tokens;estimator 与输入侧特征同源):调用方在
     * terminal 随 responseBlocks 提供响应材料时计算。上游缺报 usage 的请求
     * (D4 客户端计量)以「features.estimatedTokens(输入)+ 本值(输出)」
     * 构成估算对;terminal 无响应材料(error/aborted)时缺席。零原文不变量
     * 不破:本值是计数,响应文本不入事件。
     */
    estimatedOutputTokens?: number;
    /** purpose='compaction' 时关联压缩生命周期事件(started/finished 同 id) */
    compactionId?: string;
    /**
     * 子代理归因标识(与 CompactionStartedEvent.agentId 同语义):
     * kernel 签发方恒不落本键;子代理运行器包装 compaction.observer 时对
     * onRequestMeasured 一并注入(子代理压缩 fork 的配对行可与父会话区分)。
     */
    agentId?: string;
    /**
     * CW13-N1 — 上下文构成清单(纯追加可选;begin 时点与 features 同一请求面
     * 同一 estimator 计算)。缺席 = 构成测量异常的如实降级(features 半边
     * 照常),旧消费方按已知字段投影零受累。
     */
    manifest?: RequestManifest;
}
/**
 * 请求测量只读观测缝(kernel 公共 API;装配层实现并写 context-events.jsonl)。
 * 消费侧应自行 fail-open;kernel 侧 begin/finish 包装亦吞回调异常(双保险,
 * 对齐 CompactionObserver 纪律)。
 */
interface RequestMeasurementObserver {
    onRequestMeasured(event: RequestMeasuredEvent): void;
}

/**
 * 产物种类(观测归因用;恒不参与路径计算——kind 入名会破坏跨消费方
 * 同内容去重)。'compaction-segment' 为 N5 预留(API 就位,本波不接线)。
 */
type SpillKind = 'tool-result' | 'tool-result-prune' | 'subagent-summary' | 'compaction-segment';
/** put 负载:content 定寻址,kind 定命名空间与观测归因 */
interface SpillPayload {
    content: string;
    kind: SpillKind;
}
/** put 成果:真实存在的绝对路径 + 寻址 hash + 字节数 + 去重命中标记 */
interface SpillEntry {
    path: string;
    hash: string;
    /** 内容 UTF-8 字节数(观测口径;字符数由调用方自持) */
    bytes: number;
    /** true = 同内容已在盘(跳写,零 IO 写放大) */
    deduplicated: boolean;
}
/**
 * 会话级 spill store 接口(kernel 消费面)。实现约定:任何失败(目录不可
 * 建/磁盘满/闭包抛错)返回 undefined,恒不抛——调用方降级为无指针存根。
 */
interface SpillStore {
    put(payload: SpillPayload): SpillEntry | undefined;
}

/** CW14-N5 — 压缩段落盘观测材料(成功结局随 outcome 带出) */
interface CompactionSegmentSpillDetail {
    path: string;
    hash: string;
    bytes: number;
    /** 渲染文本字符数(与 bytes 并列;观测口径) */
    chars: number;
    deduplicated: boolean;
}
/** 压缩失败的结构化原因词表(session.compaction_failed 事件与诊断消费)。 */
type CompactionFailureReason = 'nothing_to_compact' | 'model_error' | 'aborted' | 'empty_summary' | 'unexpected_tool_use'
/**
 * 模型以 stopReason='max_tokens' 收尾 = 摘要被输出
 * 预算截断。九段模板的尾部锚点段(用户原话/未竟事项/当前工作/下一步)
 * 恰在末尾最先被切,截断摘要不得用于替换历史(静默截断即记忆损坏)。
 */
 | 'summary_truncated'
/**
 * 压缩调用独立超时(缺省 90s)触发。与 model_error
 * 分立——超时是资源隔离守门的主动放弃,归因可分辨(表面层文案/熔断
 * 遥测按此区分网络故障与压缩超时)。
 */
 | 'timeout'
/**
 * 摘要结构校验不达标(九段标题命中 < 阈值,或长度
 * 低于下限)。结构崩坏的摘要(模型退化输出/答非所问)替换历史 = 记忆
 * 损坏,拒绝进入替换链路。阈值取弱校验起步值
 * (≥6/9 段 + 500 字符,误杀率随遥测再收紧)。
 */
 | 'summary_malformed'
/**
 * estimator(摘要消息) ≥ estimator(被移除区)——压缩
 * 不减反增,替换只会劣化(占用不降 + 细节全丢),宁可不压(Gemini
 * 门禁先例)。
 */
 | 'summary_bloated'
/**
 * CompactRequest.beforeCompact 钩子
 * (装配层注入的压缩前快照落盘等)抛错——压缩尚未发出请求即放弃,历史
 * 不变(快照写失败时不得让「无可恢复拷贝」的压缩继续)。manager 只调用
 * 不知快照语义;归因可分辨(表面层文案/遥测与模型故障分立)。
 */
 | 'before_compact_failed';
/**
 * T-CTX14b(⑤ §2.4)— 压缩尝试的计费状态:失败无 provider usage 时**不得**
 * 断言零成本,三态如实分列:
 * - `reported`:provider 已报 usage(成功,或质量拒绝类失败——message_stop
 *   已到,沉没成本实报);
 * - `unknown_after_send`:请求已进入发送流程但无 usage(网络失败/超时/中断
 *   ——中断可能发生在 HTTP 发出之前,适配器边界不可分辨,保守归入本态);
 * - `not_sent`:未发出请求(nothing_to_compact 计划性 no-op)。
 */
type CompactionBillingStatus = 'reported' | 'unknown_after_send' | 'not_sent';
interface CompactionRoundSuccess {
    ok: true;
    /** 模型产出的摘要正文(未加前导句) */
    summaryText: string;
    /** 拟替换历史的摘要 user 消息(前导句 + 摘要正文) */
    summaryMessage: IRMessage;
    /** 压缩后的新消息数组:[摘要, 任务锚点?, ...pinned 区间原序, ...保留尾段] */
    messages: IRMessage[];
    /** 被单独保留的任务锚点在**原数组**中的 index(计划透传;未提取则缺席) */
    keptAnchorIndex?: number;
    /**
     * 被移除消息的 index 闭区间 [first, last](session.compacted 事件体现契约
     * 形态);pinned 挖洞导致的非连续细节见 removedIndices(RFC 草案建议契约
     * 增补,见任务报告)。
     */
    removedRange: [number, number];
    /** 被移除消息的精确 index 清单(原数组坐标,升序) */
    removedIndices: number[];
    /** 候选区内整体保留的 pinned 消息数 */
    keptPinnedCount: number;
    /** 压缩 round 自身的 usage(计成本;不入上下文账本锚点) */
    compactionUsage?: IRUsage;
    /** 压缩 round 的 stop 原因(诊断) */
    stopReason: string;
    /**
     * T-CTX14b(⑤ P0-1 finished.summaryEstimatedTokens):拟入历史的摘要消息
     * 估算 tokens(与膨胀校验同 estimator 口径;成功路径恒产出)。
     */
    summaryEstimatedTokens?: number;
    /**
     * G-A2:压缩输入自救记录(fork 请求自身超出输入预算时的硬淘汰/硬截断;
     * 未触发时缺席)。只改本次 fork 请求载荷,历史不动。
     */
    rescue?: CompactionInputRescue;
    /**
     * CW14-N5:被折叠段证据落盘观测(spill 注入且 put 成功才在场;落盘
     * 失败如实缺席,fail-open 不影响压缩主链)。
     */
    segmentSpill?: CompactionSegmentSpillDetail;
}
interface CompactionRoundFailure {
    ok: false;
    reason: CompactionFailureReason;
    message: string;
    /**
     * T-CTX14b:失败但 provider 已报的 usage(质量拒绝类失败——truncated/
     * malformed/bloated/empty/unexpected_tool_use 在 message_stop 之后判定,
     * usage 在场即沉没成本实报;网络失败/超时通常缺席)。
     */
    usage?: IRUsage;
    /** T-CTX14b:计费状态三态(语义见 CompactionBillingStatus) */
    billingStatus?: CompactionBillingStatus;
    /**
     * T-CTX14b(⑤ §2.4 atRiskInputTokens):本次压缩 fork 请求输入侧的本地
     * 估算(system 段 + 请求 messages;**不含 tools**——estimator 无工具
     * 定义口径,与 ContextView 测量同限界,见 ledger.ts tools 注释)。
     * 口径注记:经调用方注入的 estimator(manager 注入校准后估算器)。
     * billingStatus='not_sent' 时缺席(未发出请求无投入)。
     */
    atRiskInputTokens?: number;
    /** T-CTX14b:model_error 失败的底层错误类别(IRErrorKind 原样) */
    errorKind?: IRErrorKind;
    /**
     * G-A2:压缩输入自救记录(自救之后压缩仍失败时随失败结局带出——投入
     * 与动作如实归档;未触发时缺席)。
     */
    rescue?: CompactionInputRescue;
}
/**
 * 摘要质量校验配置(压缩成功前的替换门禁)。
 * 缺省阈值:九段标题命中 ≥6(弱校验起步,
 * 容忍模型措辞漂移,误杀率进遥测后再收紧)+ 长度下限 500 字符(防
 * 退化输出);膨胀拒绝(rejectBloat)与模板结构无关,缺省恒开。
 */
interface SummaryValidationOptions {
    /** 九段标题最少命中数(大小写不敏感子串匹配);缺省 DEFAULT_SUMMARY_MIN_SECTION_HITS */
    minSectionHits?: number;
    /** 摘要正文最短长度(字符);缺省 DEFAULT_SUMMARY_MIN_CHARS */
    minChars?: number;
    /** estimator(摘要消息) ≥ estimator(被移除区) 时拒绝替换;缺省 true */
    rejectBloat?: boolean;
}
/**
 * G-A2 — 压缩输入自救记录(动作、腾出 tokens、折叠条数;经结局透传落
 * context-events)。全部数值为注入 estimator 口径(不含 tools,与
 * atRiskInputTokens 同限界)。
 */
interface CompactionInputRescue {
    /**
     * 生效的压缩输入预算(tokens)。= 注入预算(manager 形态 contextWindow −
     * 压缩输出 maxTokens)扣减实发请求工具定义段估算后的净额(KA-01)——
     * 与 inputTokensBefore/After 同为「messages+system」口径,直接可比。
     */
    inputBudgetTokens: number;
    /** 救援前的压缩输入估算(system 段 + 请求 messages) */
    inputTokensBefore: number;
    /** 救援后(= 实发请求)的压缩输入估算 */
    inputTokensAfter: number;
    /** 腾出的 tokens(before − after) */
    freedTokens: number;
    /**
     * fold = 折叠旧 tool_result 已够塞下;fold_truncate = 折叠之外还叠加了
     * 「保留近期轮次」的头部硬截断;truncate = 无可折叠(纯文本前缀等),
     * 只做了硬截断。
     */
    action: 'fold' | 'truncate' | 'fold_truncate';
    /** 被原位折叠的 tool_result 块数 */
    foldedCount: number;
    /** 被硬截断的头部消息数(仅 fork 请求侧;历史与压缩计划不动) */
    truncatedMessageCount: number;
}

/**
 * OPT-05 — 工具结果生命周期:统一 Result budget + 落盘存根(doc/07 §3.3/§3.6③)。
 *
 * 三个消费面共用本模块的常量、存根协议与纯函数:
 * 1. 入史 clamp(query/run-query.ts):tool_result 回填对话史前按预算收束——
 *    超预算内容经注入的 persister 落盘,上下文中放 `<persisted-output>` 存根
 *    (模型可用 Read 工具按 path 恢复全文);拿不到 persister 时退化为
 *    `<truncated-output>` 纯截断标注;
 * 2. microcompact(context/microcompact.ts):旧轮大结果淘汰存根复用同一
 *    落盘协议与存根识别;
 * 3. resume replacement(cli 装配层):恢复装配时对 journal 中超预算的旧结果
 *    做相同替换(落盘文件在则引用 path,不在则截断标注)。
 *
 * 硬约束:
 * - 存根是给模型看的协议性文本(恒英文,不走 i18n);
 * - 替换只动 tool_result 的 content,callId/isError/块结构一概不动——
 *   tool_use/tool_result 配对不变量天然保持;
 * - 落盘/路径解析全部经注入闭包,本模块零 IO(kernel 不硬编会话目录;
 *   目录约定由装配层实现,见 cli sessions/tool-results.ts);
 * - 确定性:同输入(含 persister 返回的 path)必产出同存根字节——resume
 *   replacement 据此保持缓存前缀字节稳定(doc/07 §3.3 content-replacement)。
 */

/**
 * tool_result 块的窄化别名(与 query/types.ts 的 IRToolResultBlock 同形)。
 * 本地定义避免 context → query 的反向依赖(query/types 已 import 本目录)。
 */
type ToolResultBlock$1 = Extract<IRBlock, {
    t: 'tool_result';
}>;
/** 落盘负载:toolCallId 定文件名,content 是结果全文(text 项按换行拼接) */
interface PersistToolResultPayload {
    toolCallId: string;
    content: string;
}
/**
 * 落盘 writer 注入缝:cli 装配层落到会话工件目录(与 journal 同源;
 * CW13-N4 起内容寻址 `<sessionDir>/spill/<hash>.txt`),kernel 不感知具体
 * 路径。返回 undefined = 不可用/写失败,调用方退化为纯截断标注;实现应
 * 自行吞掉 IO 错误(抛错同样按不可用处理,见 persistToolResultSafely)。
 */
type ToolResultPersister = (payload: PersistToolResultPayload) => {
    path: string;
} | undefined;
interface ToolResultBudgetOptions {
    /**
     * 单条 tool_result 的内联预算(字符);默认 DEFAULT_TOOL_RESULT_BUDGET_CHARS。
     * 设为 Number.POSITIVE_INFINITY 可显式关闭 clamp(不推荐——复现「长会话
     * 上下文糊化」)。
     */
    maxChars?: number;
    /** 落盘 writer;缺省退化为纯截断标注(不落盘) */
    persist?: ToolResultPersister;
    /**
     * CW13-N4 — 会话级 spill store(内容寻址外置存储;spill-store.ts)。
     * 本选项对象是查询环→Task→子代理的既有透传链,store 顺链下行供
     * 非 clamp 消费方取用:剪枝原文落盘(MicrocompactRequest.spill)、
     * 子代理回传超帽全文落盘(agents/summary)。clamp/淘汰自身仍走
     * persist 缝(装配层以同一 store 实现 persist,两缝同盘)。
     */
    spill?: SpillStore;
}

/**
 * OPT-05 — microcompact:旧轮工具结果的原位淘汰(doc/07 §3.2/§3.6⑤,纯函数)。
 *
 * 语义:上下文压力越过 microcompact 水位(thresholds.microcompactAt,显著
 * 低于整体 compact 触发线)时,把旧轮次的大 tool_result **原位**替换为落盘
 * 存根——「换 content,不动结构」:消息数与块序完全不变,tool_use/tool_result
 * 配对不变量天然保持。淘汰自旧向新,直到估算水位降回停止线或候选耗尽;
 * 最近 keepRecent 条结果与小结果(< minChars)不参与(近场上下文是模型的
 * 工作记忆,淘汰它们得不偿失);pinned 消息豁免(见
 * MicrocompactPlanOptions.isPinned 注释)。
 *
 * 与整体 compact 的分工(doc/07 §3.2 流水线序):result budget(入史 clamp)
 * → microcompact(本模块)→ autocompact(LLM 摘要)。microcompact 零模型
 * 调用、零丢结构,是 compact 之前的低成本回收档。
 *
 * 本模块只提供纯的计划/存根化/应用函数;水位判定、estimator 选量与锚点
 * 治理由 ContextManager.microcompact 缝合(见 manager.ts)。
 */

/** 淘汰候选(消息/块坐标 + 体量;自旧向新有序) */
interface MicrocompactCandidate {
    messageIndex: number;
    blockIndex: number;
    callId: string;
    /** 结果全文字符数(text 项拼接口径) */
    chars: number;
}
/** 一条已定案的淘汰:候选坐标 + 存根化后的块 + 落盘路径(成功时) */
interface ToolResultEviction {
    candidate: MicrocompactCandidate;
    /** 存根化后的块(callId/isError/非 text 内容项与原块一致) */
    block: ToolResultBlock$1;
    persistedPath?: string;
}

/**
 * CW11-W2 — 无模型剪枝(doc/58 §四 W2 #6;dsh pruner 同款默认值):
 * 历史中较老的**可再生**工具结果超过门槛(8192 字符)→ 原位收束为
 * 头 4096 + 尾 1024 + 标记行,零模型调用、零丢结构(「换 content 不动
 * 结构」,与 microcompact 淘汰同纪律)。
 *
 * 与 microcompact 淘汰(microcompact.ts)的分工:剪枝是**温和档**——内容
 * 主体仍在场(头+尾共 5K),适合「还可能被引用但全文冗余」的中老结果;
 * 淘汰是**回收档**——内容离场只留存根(落盘可取回)。同一屏障内剪枝先行
 * (先温和后激进),剪后仍超水位才轮到淘汰。剪后产物 ≈5.2K,仍 ≥ 淘汰
 * 门槛(2K),后续屏障可继续淘汰,两档接力不冲突。
 *
 * 缓存权衡纪律(doc/58 拍板「最重要」):剪枝改史必破前缀缓存——
 * - **触发合流**:仅在 manager.microcompact 屏障内执行(该时刻本来就要付
 *   缓存重建成本),恒不独立高频触发;
 * - **批量执行**:一次屏障内全部合格候选一起剪;
 * - **决策冻结**:剪后字节是(原文, 常量)的纯函数——同输入恒同字节,
 *   剪一次即定格(产物 < 门槛,天然幂等),重复屏障不再改写。
 *
 * 白名单纪律(恒不静默丢内容的根):只剪**可再生**工具的结果——文件可
 * 重读(Read)、搜索可重跑(Grep/Glob/List)、命令可重跑(Shell)、网页可
 * 重取(WebFetch/WebSearch)。标记恒注明原始规模 + 取回途径(重跑同参
 * 调用)。用户消息、assistant 文本/结论、非白名单工具(Task 子代理产出
 * 不可廉价再生;MCP 动态工具副作用未知;Http 可能非幂等)恒不剪。
 *
 * resume 边界(CW13-N4 闭环;W2 已知限界的处置):剪枝时原文落 spill store
 * 的 **prune 命名空间**(spill-store.ts;`prune-<hash>.txt`,与淘汰重演的
 * content 空间查找面隔离),标记携真实落盘路径(取回承诺从「重跑工具」升级
 * 为「读落盘文件」,剪枝选量语义恒不动);恢复装配以 replayToolResultPrunes
 * 重演——「prune 文件在场 = 该内容曾被剪枝」,重剪回同一字节(决策冻结),
 * 2K–50K 区间不再全文回灌。spill 缺席/落盘失败时保持 W2 原态:标记为
 * 「重跑工具」形态、resume 回灌、下一屏障重剪同字节(fail-open 已知限界)。
 */

interface ToolResultPruneOptions {
    /** 最近 N 条 tool_result 恒不剪(与淘汰同口径同默认;近场是工作记忆) */
    keepRecentToolResults?: number;
    /** 剪枝门槛(字符);默认 PRUNE_MIN_RESULT_CHARS(8192) */
    minChars?: number;
    /** 保留头部字符数;默认 PRUNE_HEAD_CHARS(4096) */
    headChars?: number;
    /** 保留尾部字符数;默认 PRUNE_TAIL_CHARS(1024) */
    tailChars?: number;
    /** 可再生工具白名单;默认 DEFAULT_PRUNABLE_TOOL_NAMES */
    prunableToolNames?: ReadonlySet<string>;
    /** pinned 消息豁免(与 microcompact 同款:pin 承诺完整保留,剪枝掏空即违约) */
    isPinned?: (message: IRMessage) => boolean;
    /**
     * CW13-N4 — 剪枝原文落盘(spill store 的 prune 命名空间)。在场时每条
     * 入选原文先 put 再构造标记:成功 → 标记携真实取回路径(Read 直读);
     * 失败/缺席 → W2 原态标记(重跑工具),恒不指向不存在的文件(A2)。
     */
    spill?: SpillStore;
}
/** 一条已定案的剪枝:坐标 + 剪后块(copy-on-write 替换用)+ 观测口径 */
interface ToolResultPrune {
    messageIndex: number;
    blockIndex: number;
    callId: string;
    /** 归属工具名(tool_call 配对块解出;观测/标记用) */
    toolName: string;
    /** 原文字符数(text 项拼接口径) */
    originalChars: number;
    /** 剪后文本字符数 */
    prunedChars: number;
    /** 剪后块(callId/isError/非 text 内容项与原块一致) */
    block: ToolResultBlock$1;
    /** CW13-N4:原文落盘路径(spill 成功才在场;观测/断言口径) */
    spilledPath?: string;
}

/**
 * P-CTX3 — L3 工具结果分级衰减(doc/34 §3.3/§3.4 机制 2,TCG/2 灰度第一步;
 * 纯函数)。
 *
 * 语义:microcompact(OPT-05)的**选量策略升级**——不再「自旧向新」逐块
 * 淘汰,而是给每个候选算一个三维衰减分(龄 × 体积 × 被后续同参调用取代),
 * 按分值从高到低折叠:大体积、久远、已被重新获取的结果先于其他候选被原位
 * 存根化。折叠机体(存根字节/落盘/坐标替换/resume 重演)与 microcompact
 * 完全同源(evictToolResultBlock / applyToolResultEvictions / 落盘在场性
 * 重演)——本模块只换「选谁、按什么序」,不发明第二套折叠。
 *
 * 三维衰减分(v1 价值函数;权重是**设计选择**,待 W3 KPI 校准,刻意不开
 * 用户旋钮防知识旋钮泛滥——方案面只开 enabled + hysteresisTokens +
 * errorRetention 三位):
 * - ageRank ∈ [0,1]:按全部 tool_result 的出现序归一,最旧 = 1(越久远
 *   越像已消化的工作记忆,折叠损失小);
 * - sizeRank ∈ (0,1]:候选字符数 ÷ 候选最大字符数,最大 = 1(同等衰减度
 *   下优先折叠大块——同样回收量折叠更少块,信息损失更少);
 * - superseded ∈ {0,1}:后续存在**同名同参**(canonical JSON)tool_call
 *   → 旧结果已被更新副本取代,折叠最安全(全文另有落盘,新副本在后)。
 * score = 0.45×ageRank + 0.35×sizeRank + 0.4×superseded;并列取更旧者先
 * (确定性:同输入必同序)。
 *
 * P-CTX5 K20(doc/35 机制 8)— 错误证据保留:errorRetention 开启时,
 * isError=true 且未被取代的候选 score × (1 − 0.5) 后折(失败结果是自纠
 * 证据);被取代的错误恒不阻尼(新副本在后,证据零损失)。门关 = 现状
 * 评分逐字节零漂移。
 *
 * 保护圈与 microcompact 恒等(近场工作记忆不折叠):最近 keepRecent 条
 * tool_result 按条数整体豁免(即便 superseded)、全文 < minChars 不折叠、
 * 已存根块不重复折叠。
 *
 * 滞回(hysteresisTokens,doc/34 §3.4 机制 4 思想在 L3 的应用):触达
 * microcompactAt 线才动手,但一旦动手就折到 `线 − 滞回` 之下——每次改写
 * 历史都付一次 provider 缓存前缀重建,滞回带拉开两次改写的间距,把
 * 「贴线徘徊、屏屏重写」的抖动摊平。滞回消费在 manager.microcompact
 * (选量停止水位),本模块只导出缺省常量。
 */

/**
 * L3 衰减配置(manager 构造级 compaction.toolResultDecay / 方案参数展开
 * 产物)。缺席或 enabled=false = 现状 microcompact 逐字节不变(P-CTX3
 * 灰度纪律:baseline 恒关)。
 */
interface ToolResultDecayConfig {
    enabled: boolean;
    /** 折叠停止水位下探量(tokens);缺省 DEFAULT_DECAY_HYSTERESIS_TOKENS */
    hysteresisTokens?: number;
    /**
     * P-CTX5 K20 — 错误证据保留门;缺席/false = 现状评分(isError 不参与,
     * 零漂移)。true 时未被取代的错误结果按 DECAY_ERROR_RETENTION_DAMP
     * 阻尼后折。
     */
    errorRetention?: boolean;
}

/**
 * CW11-W3(doc/58 W3 #11)— 预算自感知提醒载荷。档位闩与数值取整在
 * ContextManager.takeContextBudgetReminder(每档至多一次;千位向下取整),
 * 本模块只做确定性排版:同 payload 恒同字节,不读时钟不掺 locale。
 */
interface ContextBudgetPayload {
    /** 触发档位:low = 剩余 ≤25%;critical = 剩余 ≤10%(相对 autoCompactAt) */
    tier: 'low' | 'critical';
    /** 剩余 tokens(相对自动压缩线;已向下取整到千位,≥0) */
    remainingTokens: number;
}

interface ThresholdConfig {
    /** provider 声明的上下文窗口(tokens),如 200_000 */
    contextWindow: number;
    /** 压缩摘要 round 的输出预算(压缩请求的 maxTokens 来源);默认 20_000 */
    compactOutputBudget?: number;
    /** 配置的窗口预留区;默认 20_000 */
    configuredReserve?: number;
    /** 自动压缩触发余量;默认 13_000 */
    autoCompactMargin?: number;
    /** 警戒余量;默认 20_000 */
    warningMargin?: number;
    /** 阻塞余量;默认 3_000 */
    blockingMargin?: number;
    /**
     * microcompact 触发余量(OPT-05);默认 40_000。
     * 不变量:必须 > autoCompactMargin——否则
     * 「原位淘汰先于整体 compact」的分层失效,resolveThresholds 违约 throw
     * (此前静默失效:两档在同一屏障点相继触发,低成本先行档形同虚设)。
     */
    microcompactMargin?: number;
    /**
     * 自动压缩比例触发线(相对 effectiveWindow 的占比,取值域
     * (0, 1]);默认 DEFAULT_AUTO_COMPACT_RATIO(0.93,出处见该常量)。
     * autoCompactAt = min(绝对余量线, ⌊effectiveWindow × ratio⌋) 取更早者;
     * 传 1 即比例线恒不早于 effectiveWindow,等效关闭比例触发。
     */
    autoCompactRatio?: number;
    /**
     * 批κ B1 — microcompact 单次回收量下限(tokens;显式旋钮恒胜缺省公式,
     * 出处与公式见 MICROCOMPACT_RECOVERY_FLOOR_* 常量注)。0 = 旧形态
     * (停止线 = 触发线,逐轮小截断)逃生舱;负数/非有限 throw。
     * 触发线恒不动(doc/58 零漂移纪律),仅触发时的回收幅度变化。
     */
    microcompactRecoveryFloorTokens?: number;
}
/**
 * G-A1 — 自适应推导的诊断标记(doc/34 §2 G-A1「自适应被触发时在产出中暴露
 * 标记」)。仅当现状代数对该输入产出**违反不变量**的触发线(effectiveWindow
 * ≤ 0 / 触发线非正 / 失序)时在场;数学上健康的输入恒缺席(零漂移锚)。
 * 消费方:kernel 内部零消费(触发语义只读触发线本身);装配层据此发 warn
 * 诊断(cli context-scheme.ts schemeThresholdSanityNotice)。
 */
interface ThresholdAdaptation {
    /**
     * 绝对量(summaryReserve/margins)的比例降级系数(≤ 1;= 1 表示绝对量
     * 本可装下,仅触发线失序被级联钳制)。
     */
    scale: number;
    /** 现状代数的绝对深度需求:summaryReserve + microcompactMargin(tokens) */
    requiredDepthTokens: number;
    /** 允许的最大深度:⌊contextWindow × ADAPTIVE_MAX_DEPTH_FRACTION⌋(tokens) */
    maxDepthTokens: number;
    /** 比例降级后仍有失序/非正触发线,已按「micro < warning < auto < blocking」级联钳制 */
    orderingClamped: boolean;
}
/** 解析后的绝对触发线(全部为「上下文占用 tokens」维度的可比数字) */
interface ResolvedThresholds {
    contextWindow: number;
    /** min(compactOutputBudget, configuredReserve)(自适应降级后为降级值) */
    summaryReserve: number;
    /** contextWindow - summaryReserve;恒 > 0(G-A1 不变量) */
    effectiveWindow: number;
    /** ≥ 此值应触发自动压缩 */
    autoCompactAt: number;
    /** ≥ 此值进入警戒区(UI 水位提示) */
    warningAt: number;
    /** ≥ 此值阻塞新输入(必须先压缩/清理) */
    blockingAt: number;
    /** ≥ 此值应触发 microcompact 旧结果淘汰(OPT-05;显著低于 autoCompactAt) */
    microcompactAt: number;
    /**
     * 批κ B1 — microcompact 淘汰停止线(= max(0, microcompactAt − 回收量下限);
     * 恒 ≤ microcompactAt):触线才动手,动手即清到本线之下——「少次大块」,
     * 摊薄缓存前缀重建频次。manager.microcompact 缺省停止水位消费本线
     * (显式 targetTokens / L3 衰减滞回更深者仍胜,语义见彼处)。
     */
    microcompactStopAt: number;
    /** 压缩 round 的输出预算(透传给压缩执行器;预留区被降级时同步收窄) */
    compactOutputBudget: number;
    /** G-A1 自适应诊断标记:健康输入恒缺席;在场 = 推导被自适应/钳制修正过 */
    adaptation?: ThresholdAdaptation;
}
/** 水位区带(严重度递增;doc/07 §3.1 的四段水位) */
type WaterlineZone = 'ok' | 'warning' | 'auto_compact' | 'blocking';
interface WaterlineAssessment {
    zone: WaterlineZone;
    /** 相对 effectiveWindow 的水位百分比(0-100+,超限可 >100;effectiveWindow=0 时按 100 处理) */
    usedPercent: number;
    /** 距自动压缩触发线的余量(负数=已越线) */
    tokensUntilAutoCompact: number;
    /** 距阻塞线的余量(负数=已越线) */
    tokensUntilBlocking: number;
    shouldWarn: boolean;
    shouldAutoCompact: boolean;
    shouldBlock: boolean;
    /**
     * ≥ microcompactAt:建议先做旧结果淘汰(OPT-05)。不新增 zone 值——
     * microcompact 是动作触发位而非展示区带(zone 联合已被表面层消费,
     * 扩值会无谓波及 UI;水位远低于 warning 时触发也不该改变展示区带)。
     */
    shouldMicrocompact: boolean;
}

/**
 * 压缩触发方(T-CTX14a 拆出 'reactive':真溢出恢复此前被写成 auto,埋点
 * 无从分辨主动水位压缩与被动溢出自救,⑤ 明文要求三分)。
 * 熔断语义:manual 是用户显式意志,不受熔断压制、失败不计熔断;auto 与
 * reactive 的失败**都计入**连续失败熔断——沿拆分前现状(reactive 彼时以
 * auto 入计),reactive 失败同样证明压缩链路故障,语义不变。
 */
type CompactionTrigger = 'auto' | 'manual' | 'reactive';
/**
 * T-CTX14b — 阈值快照(观测口径):started 事件行自包含阈值材料,方案
 * 切换(阈值整组变更)后跨行仍可比;水位区带由消费侧以 beforeTokens +
 * 本快照重算(assessWaterline 纯函数),事件不落 zone 冗余。
 */
interface CompactionThresholdsDetail {
    contextWindow: number;
    effectiveWindow: number;
    microcompactAt: number;
    autoCompactAt: number;
    warningAt: number;
    blockingAt: number;
}
/** T-CTX14b — 压缩计划明细(⑤ P0-1 plan 字段组;nothing_to_compact 无计划) */
interface CompactionPlanDetail {
    /** 候选折叠区终点(消息 [0, cutIndex) 为处置对象) */
    cutIndex: number;
    /** 计划移除的消息数 */
    removedCount: number;
    /** 任务锚点单独保留数(0/1) */
    keptAnchorCount: number;
    /** pinned round 整体保留的消息数 */
    keptPinnedCount: number;
    /** 保留最近完整 round 数(生效配置值) */
    keepRecentRounds: number;
}
/**
 * P-CTX4 K15 — 锚点层观测明细(方案门 anchorLayer 启用且计划落定时在场;
 * 纯观测口径,不参与决策)。extracted 是本次扫描新登记数,kept/pinned 是
 * 进入本次 digest 的注册表全量,evictedWeakest 是本次预算淘汰数。
 */
interface CompactionAnchorsDetail {
    kept: number;
    pinned: number;
    extracted: number;
    evictedWeakest: number;
    digestTokens: number;
}
/**
 * 单次压缩尝试的观测材料(manager.compact 恒产出,随 CompactOutcome
 * 返回)。成功结局的 started/finished 事件由统一应用器据此签发(签发权分布
 * 见 CompactionObserver 注释);compactionId 与摘要哨兵 uuid 同源,审计链
 * 可互相定位。
 */
interface CompactionObservation {
    /** 单次压缩执行的关联 id(started/finished 配对;= 摘要哨兵 uuid) */
    compactionId: string;
    /** 尝试起点(Date.now 口径;迁挂后事件签发时机后移,真实起点以此为准) */
    startedAtMs: number;
    /** 墙钟时长(ms;compact 入口到结局返回,观测口径不参与决策) */
    durationMs: number;
    /**
     * 重试链:上一次**失败**压缩(非 no-op)的 compactionId。任意压缩成功后
     * 链清空;nothing_to_compact 计划性 no-op 不推进也不打断(与熔断链同语义)。
     * manager 生命周期内有效(跨 runQuery 存续依赖会话级 manager 注入)。
     */
    retryOf?: string;
    /** 会话级屏障单调序号(noteBarrier 计数;「3 个屏障内」重试窗口判定) */
    barrierSeq: number;
    /** 压缩 fork 模型标识(降档后如实归因) */
    provider: string;
    model: string;
    /** 阈值快照(见 CompactionThresholdsDetail) */
    thresholds: CompactionThresholdsDetail;
    /** 计划明细(nothing_to_compact 时缺席) */
    plan?: CompactionPlanDetail;
    /** 锚点层明细(anchorLayer 门启用且计划落定时在场;缺省缺席) */
    anchors?: CompactionAnchorsDetail;
    /**
     * P-CTX4 K16:压缩时刻的分桶校准态(方案门 bucketedCalibration 启用时
     * 在场;基线恒缺席)。KPI 归因材料:本次压缩的计划/膨胀校验用的就是
     * 该桶因子口径的估算。
     */
    calibration?: CompactionCalibrationDetail;
}
/**
 * T-CTX14b — microcompact 应用观测材料(⑤ P0-3):baseline 策略随
 * GovernanceTransform 携带,统一应用器在 stub 变换应用后签发 applied 事件;
 * contract-v0.15(RFC-CTX12-1)起同一材料也是 `session.microcompacted`
 * 协议事件的载荷源(应用器组装,两者载荷同源)。
 */
interface MicrocompactObservation {
    /** 淘汰前估算占用(tokens;measurementBefore 口径) */
    beforeTokens: number;
    /** 淘汰后全量本地估算(锚点已重置) */
    afterTokens: number;
    /** 估算口径回收量(Σ 每块存根化前后估算差) */
    estimatedRecoveredTokens: number;
    /** 存根化块数 */
    evictedCount: number;
    /** 被淘汰块原文总字符 */
    originalChars: number;
    /** 存根后总字符 */
    stubChars: number;
    /** 全文落盘成功块数 */
    persistedCount: number;
    /** 落盘失败/无 writer 的纯淘汰块数 */
    persistFailedCount: number;
    /**
     * 同步执行墙钟耗时(ms;contract-v0.15,RFC-CTX12-1):产出 stub 变换的
     * 策略围绕 manager.microcompact 计时——`session.microcompacted` 事件
     * durationMs 的数据源。观测口径,不参与决策;缺席时事件按 0 兜底。
     */
    durationMs?: number;
    /**
     * P-CTX3(L3 分级衰减,纯追加可选键):本次折叠中「被后续同名同参调用
     * 取代」的块数。在场 = 衰减档选量(toolResultDecay 启用);缺席 = 现状
     * 自旧向新选量。KPI 归因用(衰减 vs 位置序的折叠构成),不参与决策。
     */
    decaySupersededFolded?: number;
    /**
     * P-CTX3:本次生效的滞回下探量(tokens;停止水位 = microcompactAt −
     * 本值)。仅衰减档在场;缺席 = 现状停止线。
     */
    decayHysteresisTokens?: number;
    /**
     * P-CTX4 K14(机制 3,纯追加可选键):本次折叠以**劣化升级档**执行
     * (端点感知门启用且探针判劣化——保护圈放宽到 DEGRADED_ESCALATED_*)。
     * 缺席 = 常规保护圈。KPI 归因用,不参与决策;`session.microcompacted`
     * 协议事件按键点名不携带本键(契约面零变更,P-CTX3 同纪律)。
     */
    degradedEscalated?: boolean;
    /**
     * P-CTX5 K21(doc/35 机制 9,纯追加可选键):折叠时刻的前缀缓存命中率
     * EWMA(recordUsage 权威 usage 滚动观测)——「本次改写破掉的缓存价值」
     * 归因材料。缺席 = 会话尚无带缓存计量的 usage 观测。KPI 口径,不参与
     * 本键的决策(推迟决策在 baseline 策略,见 cacheAwareRewrite)。
     */
    cacheHitRatio?: number;
    /**
     * CW11-W2 无模型剪枝归因(纯追加可选键三件套;doc/58 W2 #6):同屏障
     * 「先剪后淘」中剪枝档的块数/字符节省/估算回收量。contract-v0.18
     * (RFC-N5-1,CW14-N5)起 `session.microcompacted` 协议事件增携
     * prunedBlocks/pruneRecoveredTokens 分账键(数据源即本材料),纯剪枝
     * 屏障(evictedCount=0)一并签发——CW11-W2 登记的表面可见性缺口收口。
     * 缺席 = 本屏障零剪枝。
     */
    prunedCount?: number;
    /** 剪枝档字符节省合计(Σ 原文 − 剪后) */
    prunedSavedChars?: number;
    /** 剪枝档估算回收量(tokens;与 estimatedRecoveredTokens 分账) */
    pruneRecoveredTokens?: number;
}
/**
 * P-CTX4 K14(机制 3)— 压缩延迟观测事件:端点感知门启用、探针判劣化、
 * 升级折叠后仍越 autoCompact 线且非 blocking 闸门时,baseline 策略**延迟**
 * 本屏障的模型压缩(directive=nothing)并签发本事件。纯观测(kernel 公共
 * API,非 protocol 事件);装配层落 `context.compaction.deferred` 行。
 * 快照字段为签发时刻的探针材料(归因用)。
 * P-CTX5 K21:延迟原因扩 'cache_hot'(缓存感知门判高命中,推迟本屏障
 * microcompact 原位折叠;材料 = cacheHitRatio)。
 */
interface CompactionDeferredEvent {
    trigger: CompactionTrigger;
    /** 延迟时刻的估算占用(tokens) */
    beforeTokens: number;
    /** 延迟原因:端点劣化(K14,延迟模型压缩)/ 缓存热(K21,推迟折叠) */
    reason: 'endpoint_degraded' | 'cache_hot';
    /** 探针快照材料(reason='endpoint_degraded' 在场即归因) */
    errorRate?: number;
    p95Ms?: number;
    samples?: number;
    /** K21:签发时刻的缓存命中率 EWMA(reason='cache_hot' 恒在场) */
    cacheHitRatio?: number;
    /** 子代理归因标识(语义见 CompactionStartedEvent.agentId) */
    agentId?: string;
}
/**
 * 折叠机制标记:'breaker_fallback' = blocking×熔断保底
 * 硬截断(无模型、无网络;GovernanceTransform.mechanism 经应用器透传)。
 * 缺席 = 常规模型压缩。观测口径,不参与决策。
 */
type CompactionFoldMechanism = 'breaker_fallback';
/** 压缩 started 事件载荷(非 manager 机制的最小面只有 compactionId / trigger 两项) */
interface CompactionStartedEvent {
    compactionId: string;
    trigger: CompactionTrigger;
    /** 折叠机制标记(缺席 = 常规模型压缩) */
    mechanism?: CompactionFoldMechanism;
    /** 压缩前估算占用(tokens;manager 机制在场) */
    beforeTokens?: number;
    /** 压缩前六路分解 */
    beforeBreakdown?: LedgerBreakdown;
    /**
     * 测量口径注记:true = 锚点权威 usage + 尾部估算,false = 全量本地估算。
     * 同口径压缩比只能取 anchored=false 样本。
     */
    beforeAnchored?: boolean;
    estimatorProfileId?: string;
    /** 真实起点(迁挂后签发时机后移,行 ts ≈ 结局时刻;起点看本字段) */
    startedAtMs?: number;
    thresholds?: CompactionThresholdsDetail;
    plan?: CompactionPlanDetail;
    /** 锚点层明细(anchorLayer 门启用时在场;语义见 CompactionAnchorsDetail) */
    anchors?: CompactionAnchorsDetail;
    /** 分桶校准明细(bucketedCalibration 门启用时在场;语义见 CompactionCalibrationDetail) */
    calibration?: CompactionCalibrationDetail;
    provider?: string;
    model?: string;
    retryOf?: string;
    barrierSeq?: number;
    /**
     * 子代理归因标识(agent:<agentId> 的 id 半边)。kernel 签发方
     * 恒不落本键;子代理运行器以包装 observer 注入(与父会话事件区分),
     * 缺席 = 父会话事件。四事件载荷同语义(下同)。
     */
    agentId?: string;
}
/** 压缩 finished 事件载荷(outcome 缺席 = 非 manager 折叠机制的最小面) */
interface CompactionFinishedEvent {
    compactionId: string;
    trigger: CompactionTrigger;
    /** 折叠机制标记(缺席 = 常规模型压缩) */
    mechanism?: CompactionFoldMechanism;
    /** 结局明细(manager 机制在场;含 observation / atRisk 扩字段) */
    outcome?: CompactOutcome;
    /** 压缩 round 墙钟时长(ms;观测口径,不参与任何决策) */
    durationMs?: number;
    /** 非 manager 折叠机制(应用器最小观测面)的移除消息数 */
    foldedRemovedCount?: number;
    /** 子代理归因标识(语义见 CompactionStartedEvent.agentId) */
    agentId?: string;
}
/** microcompact 应用事件载荷(cachePrefixInvalidated 恒 true:改写历史必然重建缓存前缀,即 cache epoch 边界) */
interface MicrocompactAppliedEvent extends MicrocompactObservation {
    trigger: CompactionTrigger;
    cachePrefixInvalidated: true;
    /** 子代理归因标识(语义见 CompactionStartedEvent.agentId) */
    agentId?: string;
}
/** 工具结果入史 clamp 事件载荷(50K 统一预算;批级聚合) */
interface ToolResultsClampedEvent {
    /** 本批被收束的 tool_result 块数 */
    clampedCount: number;
    /** 被收束块的原文总字符 */
    originalChars: number;
    /** 收束后(存根)总字符 */
    retainedChars: number;
    /** 全文落盘成功块数 */
    persistedCount: number;
    /** 生效的单块内联预算(字符) */
    budgetChars: number;
    /** 子代理归因标识(语义见 CompactionStartedEvent.agentId) */
    agentId?: string;
}
/**
 * 压缩生命周期只读观测缝(kernel 公共 API,非 protocol 事件)。
 *
 * 签发权分布:
 * - **成功结局**:统一应用器(governance-applier)在折叠变换应用后签发
 *   started/finished——应用器是所有方案效果的必经之门,任何策略机制的
 *   折叠都被同一观测面覆盖;manager.compact 直调方自行消费
 *   outcome.observation(材料恒在场)。
 * - **失败/no-op 结局**:ContextManager.compact 返回面签发(它们不经
 *   应用器);started 时机同样后移到结局已知处(真实起点看 startedAtMs)。
 * - microcompact 应用与入史 clamp:onMicrocompactApplied(应用器)/
 *   onToolResultsClamped(查询环收束缝)。
 * 回调异常由签发方捕获吞掉(fail-open,不影响压缩主链),消费侧(装配层
 * writer)亦应自行 fail-open。
 * trigger 语义:auto(轮间水位)/ manual(/compact 与空闲直压)/ reactive
 * (真溢出恢复)。
 */
interface CompactionObserver {
    onCompactionStarted?(event: CompactionStartedEvent): void;
    onCompactionFinished?(event: CompactionFinishedEvent): void;
    /** microcompact 存根化应用观测 */
    onMicrocompactApplied?(event: MicrocompactAppliedEvent): void;
    /** 工具结果入史 clamp 计数观测 */
    onToolResultsClamped?(event: ToolResultsClampedEvent): void;
    /**
     * 压缩延迟观测(纯追加可选回调):端点劣化时 baseline 策略跳过本屏障的
     * 模型压缩。签发方 = 策略 assess(同步);回调异常由签发方吞掉
     * (fail-open 同全家纪律)。
     */
    onCompactionDeferred?(event: CompactionDeferredEvent): void;
    /**
     * 压缩 fork 请求的估算配对观测(purpose='compaction',
     * compactionId 与本观测缝生命周期事件同 id 关联)。manager 经
     * CompactionRoundRequest.requestMeasurement 包装透传执行器,fork 请求
     * 构造后提取特征、terminal 后合并 usage 回调一次。
     */
    onRequestMeasured?(event: RequestMeasuredEvent): void;
}
interface ContextManagerCompactionOptions {
    /** 摘要指令模板(注入缝);默认 DEFAULT_COMPACT_INSTRUCTION */
    instructionTemplate?: string;
    /** 摘要消息前导句(注入缝);默认 DEFAULT_SUMMARY_PREAMBLE */
    summaryPreamble?: string;
    /**
     * 压缩 round 模型调用超时(ms)。缺省 90_000;独立于主查询超时——压缩是
     * 可失败的辅助调用,不得吃满主查询预算。
     * 语义(进展感知):空闲闸——流无进展 timeoutMs 才判死;
     * 生成推进中受 × COMPACTION_PROGRESS_HARD_CAP_FACTOR 硬上限封顶,不再
     * 以总时长误杀(出处见 DEFAULT_COMPACTION_TIMEOUT_MS 注释)。
     */
    timeoutMs?: number;
    /** 保留最近完整 round 数;默认 2 */
    keepRecentRounds?: number;
    /**
     * 首条用户消息(任务锚点)恒保留不参与折叠。
     * 默认 false(直接构造的 manager 沿历史行为);查询环自建的 manager 默认开启。
     */
    keepFirstUserMessage?: boolean;
    /**
     * 压缩生命周期观测缝(装配层注入,消费写 context-events.jsonl)。
     * 缺省不观测,行为与未接缝逐字节一致。
     */
    observer?: CompactionObserver;
    /**
     * 摘要质量校验(结构 + 膨胀;透传执行器)。缺省启用 v2 九段
     * 规格;`false` 全关——注入自定义 instructionTemplate(非九段结构)时
     * 的逃生门,默认模板下不应关闭。
     */
    summaryValidation?: SummaryValidationOptions | false;
    /**
     * 转录回查路径提示——装配层传会话 journal 的磁盘
     * 路径(字符串,或求值闭包:纪元轮换后 journal 目录随 sink.currentSessionId
     * 变化,闭包形态使摘要恒指向压缩时刻的**当前**转录文件)。在场时摘要
     * 消息尾部追加回查段(compaction.buildTranscriptLookbackSection);缺省/
     * 闭包返回 undefined/空串 = 不追加,行为与从前逐字节一致。闭包抛错按无
     * hint 处理(fail-open:回查是增强,不得破坏压缩主链)。
     * 取值链与 timeoutMs 同构:CompactRequest.transcriptHint(请求级)>
     * 本构造级配置。
     */
    transcriptHint?: string | (() => string | undefined);
    /**
     * microcompact 选量策略(分级衰减)的灰度门。缺席/enabled=false =
     * 现状自旧向新选量,逐字节零漂移
     * (baseline 方案恒缺席);启用后按三维衰减分(龄×体积×被取代)选序,
     * 并以 hysteresisTokens 下探停止水位(摊薄缓存前缀重建频次)。
     * 取值链:MicrocompactRequest.decay(请求级)> 本构造级配置。
     */
    toolResultDecay?: ToolResultDecayConfig;
    /**
     * 熔断半开探测指数退避门。缺席/false =
     * 现状固定间隔(AUTO_COMPACT_HALF_OPEN_BARRIERS,基线恒缺席零漂移);
     * true 时探测间隔 = HALF_OPEN × 2^min(熔断后连败数, 指数硬帽)
     * (3→6→12→24 屏障),防劣化端点每 3 屏障固定烧一次探测超时;探测
     * 成功清零照常恢复。方案门 endpointAwareCompaction 的 manager 半边。
     */
    halfOpenBackoff?: boolean;
    /**
     * 锚点层灰度门。缺席/enabled=false
     * = 现状(压缩请求不拼锚点摘要,逐字节零漂移;/pin 管理面在 manager API
     * 上恒可用,但无消费)。启用后压缩计划落定时对将折叠区抽取锚点、拼
     * digest 追加进摘要附加指令(锚点是摘要的「不得稀释」清单),预算超限
     * 按最弱分持久淘汰。budgetTokens 缺省 DEFAULT_ANCHOR_BUDGET_TOKENS。
     */
    anchorLayer?: {
        enabled: boolean;
        budgetTokens?: number;
    };
    /**
     * 估算-校准闭环灰度门。缺席/
     * enabled=false = 现状单标量 EWMA(压缩后重置,逐字节零漂移)。
     * 启用后三件事(细节见 calibration.ts 模块头):校准因子按尾部内容特征
     * 分桶(CJK/JSON/混排/纯文本)、校准态跨压缩持久(压缩成功仅失效配对
     * 基线)、水位评估按桶置信度加安全边际(低置信宁可早压;
     * confidenceMarginRatio 缺省 DEFAULT_CONFIDENCE_MARGIN_RATIO=0.1)。
     * 门开/关均仅训练固定面相容的相邻实发输入差分；首轮或固定面
     * 变化后的全量估算不能把 system/tools 的误差训练成消息密度。
     */
    bucketedCalibration?: {
        enabled: boolean;
        confidenceMarginRatio?: number;
    };
    /**
     * 压缩段回查节门(fold 迁移证据保全的**模型可见半边**;新
     * 行为开关化)。缺席/false = 摘要字节现状零漂移;true 且请求携 spill 且
     * 段落盘成功时,摘要尾部追加回查节(buildSegmentLookbackSection,指向
     * 被折叠段的落盘投影)。段落盘本身(非模型可见)不受本门控制——spill
     * 在场即执行(证据保全恒不挑时机)。
     */
    segmentLookback?: boolean;
}
/**
 * 压缩后派生态失效清单条目。压缩改变「模型已经看过
 * 什么」这一全局事实,一切以此为前提的派生态(差分基线/校准态/签名缓存)
 * 必须在压缩成功后同步失效,否则出现「模型引用它已看不见的内容」类幽灵
 * bug。集中一份清单统一执行(而非散落各处),失效点可枚举、可锁测。
 */
interface PostCompactInvalidation {
    /**
     * 登记名(观测与锁测断言用;内置成员:`ledger.anchor` /
     * `attachments.signatures` / `estimator.calibration`)。外部登记建议
     * 带命名空间前缀(如 `reminders.firstScreenBaselines`)。
     */
    id: string;
    /** 失效动作(同步;抛错被清单执行器吞掉——fail-open,不破坏压缩收尾) */
    run: () => void;
}
interface ContextManagerOptions {
    /** 阈值代数配置(contextWindow 必填,其余走 doc/07 §3.1 默认) */
    thresholds: ThresholdConfig;
    /** token 估算器(可替换缝);默认「字符 ÷ 系数 + 消息定额」实现 */
    estimator?: TokenEstimator;
    /** 压缩 round 的模型客户端(注入缝);不启用压缩的场景可缺省 */
    client?: ModelClient;
    compaction?: ContextManagerCompactionOptions;
    attachments?: AttachmentRegistryOptions;
}
/** assess 产出:测量 + 阈值 + 水位 + 熔断后的最终触发建议 */
interface ContextAssessment {
    measurement: ContextMeasurement;
    thresholds: ResolvedThresholds;
    waterline: WaterlineAssessment;
    /** 连续自动压缩失败次数(成功清零) */
    consecutiveAutoCompactFailures: number;
    /** 熔断中(连续失败 ≥ AUTO_COMPACT_FAILURE_FUSE):压制自动压缩建议 */
    autoCompactSuppressed: boolean;
    /** 最终建议 = waterline.shouldAutoCompact && !autoCompactSuppressed */
    shouldAutoCompact: boolean;
    /**
     * P-CTX4 K16:置信度安全边际明细(方案门 bucketedCalibration 启用时在场,
     * 基线恒缺席)。在场时 waterline 各触发位按
     * `measurement.contextTokens + marginTokens` 判定(决策口径;measurement
     * 本身如实不动)——低置信宁可早压,不越界。
     */
    calibration?: AssessmentCalibrationDetail;
}
/** manager 层压缩请求(round 粒度计划与执行参数由本类代算) */
interface CompactRequest {
    view: ContextView;
    /** 已报摘要用量入辅助账后同步通知；取消等待方可保留已知费用。 */
    onUsage?: (usage: IRUsage) => void;
    /** 压缩 fork 缺省同模型;调用方可显式降档 */
    model: ResolvedModel;
    trigger: CompactionTrigger;
    signal?: AbortSignal;
    temperature?: number;
    /** fork 采样参数;与 IR 同形含 off 位(显式思考关断须原样穿透) */
    thinking?: {
        budget?: number;
        off?: boolean;
    };
    /**
     * 覆盖压缩输出预算。缺省 = thresholds.compactOutputBudget;调用方应传
     * min(模型 maxOutput, compactOutputBudget)(summaryReserve 语义——模型
     * 能力位在装配层,本类不感知 provider capability)。
     */
    maxTokens?: number;
    /** 用户附加摘要指令(/compact [instructions]);追加在模板后,只调焦点 */
    instructions?: string;
    /** 本次压缩调用超时(ms);覆盖 compaction.timeoutMs 配置 */
    timeoutMs?: number;
    /**
     * 本次压缩的转录回查路径提示;覆盖 compaction.transcriptHint
     * 构造级配置(取值链与 timeoutMs 同构)。装配层通常经
     * QueryCompactionOptions.transcriptHint 直达构造级配置,本请求级位
     * 保留给调用方显式覆盖。
     */
    transcriptHint?: string | (() => string | undefined);
    /**
     * fold 迁移证据保全存储(spill kind='compaction-segment'
     * 接线):在场时被折叠段的确定性渲染落 spill content 空间(microcompact
     * 请求的 spill 同源同store,baseline 会话透传)。缺席 = 不落盘。
     * 模型可见回查节另由构造级 segmentLookback 门控制。
     */
    spill?: SpillStore;
    /**
     * 压缩前钩子(装配层注入;典型 = 落 pre_compaction 上下文快照)。
     * 时机:计划落定(有可压内容)之后、压缩
     * fork 请求发出之前——no-op 结局不调用(无可压不白落快照),PreCompact
     * hook 阻断径亦不达此处。manager 只调用不知快照:返回值的 checkpointId
     * 原样冒泡到结局(成功/失败两形皆携,失败时已落快照保留);钩子抛错 →
     * 失败结局 reason='before_compact_failed',请求不发出,历史不变。
     */
    beforeCompact?: (view: ContextView) => Promise<{
        checkpointId?: string;
    } | void>;
}
/** 压缩成功:执行器产出 + 压缩前后账本测量(session.compacted 事件数据源) */
interface CompactOutcomeSuccess extends CompactionRoundSuccess {
    trigger: CompactionTrigger;
    measurementBefore: ContextMeasurement;
    measurementAfter: ContextMeasurement;
    /**
     * beforeCompact 钩子返回的快照 id(压缩前完整上下文的可恢复拷贝);
     * 钩子缺席/未返回 id 时缺席。session.compacted 事件与 journal
     * compact_boundary 记录据此携 checkpointId。
     */
    checkpointId?: string;
    /**
     * 压缩执行 id 冒泡:与观测材料
     * observation.compactionId、摘要哨兵 uuid、meta.compactionId 同源——
     * `session.compacted` 事件与 journal `compact_boundary` 记录的关联键由此
     * 冒给签发/写入方。类型层可选,防破字面量构造方(observation 同款纪律);
     * manager.compact 与 hardTrim 运行时恒产出。
     */
    compactionId?: string;
    /**
     * 观测材料(类型层可选,防破字面量构造方;manager.compact 运行时
     * 恒产出——CostBucketSnapshot.cacheMetrics 同款纪律)。成功结局的
     * started/finished 事件由统一应用器据此签发。例外:hardTrim 结局
     * **恒缺席**本字段(零模型投入,无 provider/model/durationMs 可归因),
     * 观测走应用器最小面 + mechanism 标记。
     */
    observation?: CompactionObservation;
}
interface CompactOutcomeFailure extends CompactionRoundFailure {
    trigger: CompactionTrigger;
    measurementBefore: ContextMeasurement;
    /**
     * 本次失败后的连续自动失败计数。manual 失败不计入;nothing_to_compact
     * 是计划性 no-op,既不推进也不打断连续失败链。
     */
    consecutiveAutoCompactFailures: number;
    /** 观测材料(可选性理由同 CompactOutcomeSuccess.observation) */
    observation?: CompactionObservation;
    /**
     * beforeCompact 已落的快照 id——压缩失败不回滚已落的盘,
     * 结局携 id 供调用方决定(before_compact_failed 时恒缺席:钩子未成功)。
     */
    checkpointId?: string;
}
type CompactOutcome = CompactOutcomeSuccess | CompactOutcomeFailure;
/**
 * G-A7(P-CTX2 K9)— 无模型硬截断请求:压缩计划同 compact(自适应两级
 * 粒度、pinned/锚点保留),但摘要位由**截断占位存根**充当——零模型、零
 * 网络。消费方 = baseline 策略的 blocking×熔断保底(压缩服务熔断打开时
 * 跳过模型压缩,直接硬截断腾窗口)。结局复用 CompactOutcomeSuccess 形态
 * (stopReason='breaker_fallback';无 compactionUsage/observation——零模型
 * 投入、无 provider/model 可归因,不伪造观测材料)。
 */
interface HardTrimRequest {
    view: ContextView;
    trigger: CompactionTrigger;
    /** CW14-N5:fold 证据保全存储(语义同 CompactRequest.spill;熔断保底同为折叠) */
    spill?: SpillStore;
}
/** microcompact 请求(OPT-05;水位判定由调用方做,本类只负责选量与应用) */
interface MicrocompactRequest {
    view: ContextView;
    /** 落盘 writer(RunQueryOptions.toolResultBudget.persist 透传);缺省纯淘汰标记 */
    persist?: ToolResultPersister;
    /**
     * 淘汰停止水位(tokens):估算占用降到该值以下即停。缺省
     * thresholds.microcompactAt(降回触发线之下;已存根化的块不再是候选,
     * 天然免于同一屏障的重复触发)。
     */
    targetTokens?: number;
    /** 最近 N 条 tool_result 不参与;默认 DEFAULT_MICROCOMPACT_KEEP_RECENT_TOOL_RESULTS */
    keepRecentToolResults?: number;
    /** 淘汰门槛(字符);默认 DEFAULT_MICROCOMPACT_MIN_RESULT_CHARS */
    minChars?: number;
    /**
     * P-CTX3 — L3 衰减档请求级覆盖(测试/直调面);缺席回落构造级
     * compaction.toolResultDecay。显式给 targetTokens 时滞回不叠加
     * (显式停止线胜出,语义见 microcompact 注释)。
     */
    decay?: ToolResultDecayConfig;
    /**
     * CW11-W2 无模型剪枝覆盖(测试/直调面):enabled=false 关闭本屏障剪枝;
     * 其余键透传 planToolResultPrunes(缺席用 entry-budgets 默认:门槛 8192、
     * 头 4096、尾 1024、白名单 DEFAULT_PRUNABLE_TOOL_NAMES)。缺席 = 默认
     * 启用——剪枝与淘汰同屏障合流,缓存重建成本一次付清(doc/58 拍板)。
     */
    prune?: {
        enabled?: boolean;
    } & Pick<ToolResultPruneOptions, 'minChars' | 'headChars' | 'tailChars' | 'prunableToolNames'>;
    /**
     * CW13-N4 — 会话级 spill store(RunQueryOptions.toolResultBudget.spill
     * 透传):在场时剪枝原文落 prune 命名空间、标记携真实取回路径(resume
     * 剪枝重演的判据);缺席保持 W2 原态(标记为重跑工具形态)。
     */
    spill?: SpillStore;
}
/** microcompact 结果:无候选/无需处置(剪枝+淘汰双空)时 evicted=false,输入不被触碰 */
type MicrocompactOutcome = {
    evicted: false;
    measurementBefore: ContextMeasurement;
} | {
    evicted: true;
    /** 处置后的新消息数组(未触碰的消息保持原引用;调用方就地替换历史) */
    messages: IRMessage[];
    /** 实际淘汰清单(现状自旧向新;衰减档按衰减分从高到低);可为空(仅剪枝屏障) */
    evictions: ToolResultEviction[];
    /** 估算口径的**淘汰**回收量(Σ 每块存根化前后估算差;事件 recoveredTokens 同口径) */
    estimatedRecoveredTokens: number;
    /**
     * CW11-W2 无模型剪枝清单(同屏障先剪后淘;自旧向新)。坐标与
     * evictions 可能重叠(先剪后又被淘汰——淘汰终局,剪枝中间态),
     * 消费方以 evictions 坐标优先。可为空(无合格候选/已关闭)。
     */
    prunes: ToolResultPrune[];
    /** 估算口径的**剪枝**回收量(与 estimatedRecoveredTokens 分账,互不重叠) */
    pruneRecoveredTokens: number;
    measurementBefore: ContextMeasurement;
    /** 处置后的全量本地估算(锚点已失效重置,见 microcompact 注释) */
    measurementAfter: ContextMeasurement;
    /**
     * P-CTX3 — 衰减档观测材料(纯追加):在场 = 本次以 L3 衰减选量。
     * supersededFoldedCount = 折叠块中被后续同名同参调用取代者;
     * hysteresisTokens = 生效的停止水位下探量。
     */
    decay?: {
        supersededFoldedCount: number;
        hysteresisTokens: number;
    };
};
/**
 * 上下文管理器完整版。可独立于查询环调用(hermetic 测试用脚本化 client);
 * 状态仅四件:账本(锚点+累计)、附件注册表、pinned 引用集、熔断计数。
 */
declare class ContextManager {
    #private;
    /** ARC07：观察实际压缩执行/生成器收尾；仅取消等待，不取消底层清理。 */
    settle(options?: ResourceSettleOptions): Promise<ResourceSettlementResult>;
    constructor(options: ContextManagerOptions);
    /** 解析后的阈值(只读;供状态栏/斜杠命令展示) */
    get thresholds(): ResolvedThresholds;
    /**
     * 附件注册表观测快照(只读;/context 展示与压缩诊断,不属于七接口)。
     * 完整快照(在场附件数/逐条 TTL 剩余/估算 tokens/预算),
     * 旧形态 {round, injectedBytes} 是其结构子集,消费方零迁移。
     */
    get attachmentStats(): AttachmentStats;
    /** nothing_to_compact no-op 累计(只读观测;压缩生命周期埋点消费) */
    get noopCompactCount(): number;
    /**
     * EWMA 校准因子(只读观测;1 = 未校准或刚重置)。
     * bucketedCalibration 门开时标量路径不更新(恒 1),分桶态看 calibrationState()。
     */
    get calibrationFactor(): number;
    /**
     * 校准态快照(只读观测;/context 展示与锁测消费)。
     * 门关:buckets 恒空数组 + factor = 标量因子(单标量 EWMA 现状态)。
     */
    calibrationState(): CalibrationSnapshot;
    /** 跨 manager 重建搬运出口(driver 切方案携带;切模不携带) */
    exportCalibration(): CalibrationSnapshot;
    /**
     * 搬运入口:**仅门开时生效**(门关 no-op——基线标量路径的
     * 重建归零语义是既定行为,导入会构成漂移)。因子按钳制域收
     * 口、观测数取非负整数(防手工快照越界);配对基线不搬(旧测量对旧
     * 历史,新实例首次 measure 自然重建)。
     */
    importCalibration(snapshot: CalibrationSnapshot): void;
    /**
     * 登记压缩后必须失效/重置的外部派生态(装配层调用;如
     * reminder 首屏差分基线)。压缩成功后按「内置清单 → 登记序」统一执行;
     * run 抛错被吞(fail-open),不影响压缩收尾与其余清单项。
     */
    registerPostCompactInvalidation(entry: PostCompactInvalidation): void;
    /** 失效清单登记名快照(观测/锁测断言;含内置三件) */
    get postCompactInvalidationIds(): readonly string[];
    /**
     * 派生态失效清单的公开执行入口(统一应用器消费:非 baseline
     * 策略的历史折叠变换应用后,由应用器调用本方法统一失效锚点/附件签名/
     * 校准态与外部登记项)。baseline 的 compact/microcompact 路径**不经**
     * 本入口——manager 内建执行时序在 measurementAfter 之前(压缩后测量
     * 必须基于失效后的干净状态),应用器侧重复执行会清空刚建立的校准配对
     * 基线(校准链漂移),故 baseline 变换标记 invalidations='strategy'。
     */
    runPostCompactInvalidations(): void;
    /**
     * 屏障点计时(半开熔断的时基):查询环每个压缩屏障点调用一次。
     * 熔断压制期间每计满 AUTO_COMPACT_HALF_OPEN_BARRIERS 个屏障,assess 放行
     * 一次探测压缩(成功清零熔断计数恢复正常,失败继续压制);任何 auto 压缩
     * 尝试(含探测与 no-op)都会清零本计时,压制期的失败信息因此有界
     * (至多每 N 个屏障一次)。非压制期本计时无消费方,推进无副作用。
     */
    noteBarrier(): void;
    /**
     * 观测缝只读出口:查询环/空闲直压据此把 observer 交给统一
     * 应用器(成功结局签发)与工具结果收束缝(clamp 计数)。外部注入 manager
     * 形态下构造方持有的观测缝经此对查询环可达。
     */
    get compactionObserver(): CompactionObserver | undefined;
    /**
     * 登记一轮完整 usage 并推进附件 TTL。有效 receipt 才更新测量锚点和
     * 对应 EWMA；旧无 receipt 调用仍累计、仍可全量治理，不补绑新输入。
     * 校准读取 receipt 冻结的旧 authority，后来的测量/新锚点不会串用。
     */
    recordUsage(entry: RoundUsageInput): void;
    /** 请求观测与固定面使用同一基础估算器，尤其外部注入manager时。 */
    get requestEstimator(): TokenEstimator;
    /** 主模型/客户端绑定改变时旧tokenizer观测不能沿用。 */
    bindRequestModel(model: ResolvedModel, client: ModelClient): void;
    /** 在治理前捕获固定输入，后续压缩/输出预算/实际发送均使用同一副本。 */
    prepareRequestBasis(view: ContextView): RequestBasis;
    prepareSentRequest(input: {
        view: ContextView;
        measurement: ContextMeasurement;
        tailDelta?: {
            rawTokens: number;
            tokens: number;
        };
        ephemeral?: boolean;
    }): SentRequestReceipt;
    discardSentRequest(receipt: SentRequestReceipt): void;
    /**
     * 请求固定输入（如 system 段）变化后，旧权威 usage 不再代表当前前缀。
     * 只失效测量锚点和待配对校准基线，使下一次 measure 全量计入新 system；
     * 已学习密度因子、累计用量、附件/TTL、历史 pin、压缩熔断均保留。
     * 不等同历史压缩，不能运行 postCompact 失效清单；调用方须先判断实际输入已变化，
     * 在下一轮 measure/runQuery 前调用，执行中的一轮不可改写其请求基准。
     */
    invalidateRequestBasis(): void;
    /**
     * 当前缓存命中率 EWMA 只读出口(null = 尚无观测)。消费方:
     * baseline 策略缓存感知门 + microcompact 观测材料。
     */
    cacheHitRatio(): number | null;
    /**
     * 测量当前上下文占用:锚点权威计量 + 本地估算尾部,六路分解。
     * 消息尾部经校准因子微调，system/tools 保持基础估算。
     * 本次测量独立留基线，实际发送方 prepareSentRequest 后才可配对 usage。
     * bucketedCalibration 门开:估算前按 ledger 同一锚点判定取尾部范围并归桶
     * (classifyTailBucket),应用缝随之切到该桶因子;基线记录归桶与锚点
     * 口径供观测入账。门关零触碰(#lastBucket 不更新,分桶 Map 恒空)。
     */
    measure(view: ContextView): ContextMeasurement;
    /**
     * 请求装配后新增尾材料的只读计额。只比较受影响尾消息，
     * 使用当前测量已选定的校准因子；不刷新桶/配对基线/锚点，也不全量 measure。
     * before 缺席表示新增一条消息，按账本同口径包含消息定额。
     */
    measureRequestTailDelta(before: IRMessage | undefined, after: IRMessage, measurement?: ContextMeasurement): {
        rawTokens: number;
        tokens: number;
    };
    estimateRequestTailDelta(before: IRMessage | undefined, after: IRMessage, measurement?: ContextMeasurement): number;
    /**
     * 水位评估:测量 → 阈值代数 → 区带/触发建议;熔断中压制自动压缩建议。
     * 半开探测:压制期间每隔 AUTO_COMPACT_HALF_OPEN_BARRIERS 个屏障点
     * (noteBarrier 计时)放行一次探测压缩——探测成功由 compact 清零计数
     * 恢复正常,失败继续压制。本方法只读(计时推进在 noteBarrier/compact)。
     */
    assess(view: ContextView): ContextAssessment;
    /**
     * 以既有测量做阈值评估(不重新 measure):同一
     * 屏障内 microcompact 之后的 compact 判定复用其 measurementAfter,消除
     * 「同屏障二次全量估算」——第二次估算与淘汰选量投影可能相互矛盾,
     * 淘汰刚回收完又立刻整体压缩的同屏障双压由此根治。熔断/半开语义与
     * assess 完全一致(同为只读;计时推进在 noteBarrier/compact)。
     * bucketedCalibration 门开:水位判定按 contextTokens + 置信度安全边际
     * (「低置信留更大边际」——桶内观测不足时尾部估算加临时边际,宁可早压
     * 不越界;观测饱和边际归零)。边际只进决策,measurement 如实不动;
     * 明细随 assessment.calibration 在场。门关零漂移(边际恒缺席)。
     */
    assessMeasurement(measurement: ContextMeasurement): ContextAssessment;
    /**
     * G-A7 补完(实施审计 KA-02)— 熔断压制态的只读暴露:不测量、不推进
     * 任何计时(reactive 径的零测量纪律得以保持——校准配对基线不被多余
     * 测量刷新)。策略层据此对 reactive 真溢出自救同样走无模型保底,而非
     * 在熔断压制期把 fork 打向劣化端点烧一次压缩超时。半开探测屏障本值
     * 如实为 false(探测照常走真实模型压缩,恢复节律不变)。
     */
    autoCompactSuppressed(): boolean;
    /**
     * 决定附件注入方式:首见(或 TTL 过期)→ inject;TTL 内同内容(含不同
     * 来源名)→ reference 引用化;session 字节预算耗尽 → rejected_budget。
     */
    ingestAttachment(input: AttachmentInput): AttachmentDecision;
    /**
     * X3-3 C3(K-6)— 附件预算首拒 advisory 一次性闩(session 生命周期恰
     * 一次;语义见 AttachmentRegistry.takeBudgetAdvisory)。查询环在
     * rejected_budget 裁决后消费,签发一次性可恢复 turn.error。
     */
    takeAttachmentBudgetAdvisory(): boolean;
    /**
     * CW11-W2(doc/58 W2 #7)— 压缩熔断首开 advisory 一次性闩:连续自动
     * 失败达 AUTO_COMPACT_FAILURE_FUSE(熔断已开)且本会话尚未提示过时
     * 返回 true 并封口——查询环据此签发恰一次用户可见提示(i18n)。此后
     * 半开探测/复跳恒不再提示(CC 生产事故的反面教训是无休止重试刷屏;
     * 持续观测归 /context 与 doctor 失败链统计)。纯读熔断计数,不推进
     * 任何计时/测量。
     */
    takeCompactionBreakerAdvisory(): boolean;
    /**
     * CW11-W3(doc/58 W3 #11)— 预算自感知提醒档位判定与一次性闩。
     *
     * 语义:剩余额度 = autoCompactAt − 占用(相对**自动压缩线**——那是模型
     * 实际可用的工作预算,越过即历史折叠;不用物理窗口作分母,越过 blocking
     * 线之前预算早已被压缩线吃掉)。剩余/autoCompactAt ≤ 25%(low)/ ≤10%
     * (critical)各触发恰一次;直落 10% 时只发 critical 一条并同时封 low 档
     * (单屏障恒至多一条)。压缩成功后两档复位(见 #budgetReminderFired)。
     *
     * 字节纪律:剩余数向下取整到千位(CONTEXT_BUDGET_REMINDER_ROUND_TOKENS)
     * 且钳 ≥0——产出字节 = f(测量, 常量),无时间戳/随机量;每档一次的闩
     * 保证同会话恒不因水位波动重复注入。autoCompactAt ≤ 0(退化钳制窗)无
     * 预算语义,恒不提醒;autoCompactAt < 启用下限(20K)同样恒不提醒——
     * 提醒自身 ~100 tokens,极小预算下注入本身即可观挤兑(玩具窗实测把
     * 水位推回压缩线引发压缩连锁),成本占比论证见 entry-budgets 常量注释。
     * 占用入参由查询环钳制点透传(同屏障同一测量,不新增 measure 调用)。
     */
    takeContextBudgetReminder(contextTokens: number): ContextBudgetPayload | undefined;
    /**
     * 标记消息为 pinned:压缩时其所在完整 round 整体保留(round 粒度,保配对)。
     *
     * **对象身份契约**:pin 按消息对象引用标记(WeakSet),
     * 换新对象即丢标——microcompact 存根替换径已明文豁免 pinned(pin 承诺完整
     * 保留,见 #microcompact planOptions);但查询环 meta 合并径(run-query 末条
     * user 消息整体换新对象)未防,**末条 user 消息的 pin 可能因 meta 合并
     * 静默失效**。现状 pin()/unpin() 无生产调用方(全仓仅测试),按设计债
     * 登记不改行为;若未来接线生产消费方,改法二选一:meta 合并改就地追加
     * 块(保引用),或 pin 改按消息身份键(非引用)标记。
     */
    pin(message: IRMessage): void;
    unpin(message: IRMessage): void;
    isPinned(message: IRMessage): boolean;
    /**
     * 手动锚点登记(/pin <text>):过短/空文本返回 null;重复登记升级为
     * 手动源(用户显式确认抽取锚点)并回报 duplicate=true。新鲜度取当前
     * 会话 round;估算用 base 估算器(登记时一次性,与附件注册表同纪律)。
     */
    pinAnchor(text: string): {
        entry: AnchorEntry;
        duplicate: boolean;
    } | null;
    /** 解除锚点(/unpin <id>);false = 无此 id */
    unpinAnchor(id: string): boolean;
    /** 锚点清单快照(登记时序;/pin 无参列表与观测消费) */
    anchors(): AnchorEntry[];
    /** 跨 manager 重建搬运出口(driver 切模/切方案携带;换历史不携带) */
    exportAnchors(): AnchorEntry[];
    /** 跨 manager 重建搬运入口(语义见 AnchorRegistry.importEntries) */
    importAnchors(entries: ReadonlyArray<AnchorEntry>): void;
    /**
     * 旧轮工具结果的原位处置:**先剪后淘**两档接力(CW11-W2)——
     * ① 剪枝档:白名单可再生结果超门槛(8192)原位收束为头 4096+尾 1024+
     *    标记(tool-result-prune.ts;批量执行,全部合格候选一次剪完);
     * ② 淘汰档:剪后仍越停止水位时,自旧向新把大 tool_result 替换为落盘
     *    存根,直到估算占用降到 targetTokens 之下或候选耗尽。
     * 两档均「换 content 不动结构」,配对不变量与消息坐标全部保持;零模型
     * 调用。同一块可先剪后淘(淘汰终局);仅剪枝无淘汰同样 evicted=true
     * (历史已改写,调用方须换新数组并承付缓存重建)。
     *
     * 成本注记(设计代价,调用方须知):改写历史必然使 provider 缓存前缀
     * 失效——触发一次付一次缓存重建,换取窗口回收;触发水位(microcompactAt,
     * 默认 effectiveWindow-40K)显著早于 compact 线,两次改写间有充足摊销
     * 区间。剪枝与淘汰同屏障合流正是缓存权衡纪律(doc/58 拍板):本来就要
     * 付缓存重建的时刻顺带剪,恒不独立触发。
     *
     * 锚点治理:淘汰成功后重置测量锚点——锚点 usage 的权威 input 计入了被
     * 淘汰的旧内容,继续挂锚会把已删除字节再计一遍;重置后退化为全量本地
     * 估算(measurementAfter 口径),下一轮 recordUsage 以真实 usage 重新挂锚。
     * 附件签名不重置:附件内容在 user 文本块中,不受 tool_result 淘汰影响。
     *
     * 选量口径:逐候选以 estimator 差值(原块 - 存根块)累减「投影占用」
     * (现状自旧向新;衰减档按衰减分从高到低);measurementBefore 为锚点
     * 口径时该投影是近似(provider 计量 ≠ 本地估算),方向正确即可——
     * 目标是回收,不是精确制导。
     *
     * P-CTX3 衰减档(request.decay > 构造级 compaction.toolResultDecay;
     * 双缺省/enabled=false = 停止线走 B1 缺省):
     * - 候选与序:planDecayCandidates(三维衰减分,保护圈与现状恒等);
     * - 停止水位:未显式给 targetTokens 时 = min(B1 停止线, microcompactAt −
     *   hysteresisTokens)取更深者——触线才动手,动手即深清,摊薄缓存前缀
     *   重建频次;显式 targetTokens 原样尊重(直调面语义明确);
     * - outcome.decay 观测材料随 evicted=true 在场。
     *
     * 批κ B1(代拍① 2026-08-27,doc/80 §四 B1②「少次大块」缺省化):缺省
     * 停止水位自 microcompactAt(降回触发线即停 = 逐轮小截断,每轮增长 2-6K
     * 即再触发再改写,反复付前缀重建)换 thresholds.microcompactStopAt
     * (触发线 − 回收量下限;200K 窗 = 140K−20K,1M 窗按占比 ≈−88K;公式与
     * 出处见 thresholds.ts)。触发线恒不动,仅回收幅度变化;实际回收仍受
     * 候选面(keepRecent 窗外 ≥2K 的旧结果)自然封顶,候选耗尽即停。
     */
    microcompact(request: MicrocompactRequest): MicrocompactOutcome;
    /**
     * 执行一次压缩:制定 round 粒度计划 → 注入的 ModelClient 打一轮完整
     * API round → 产出摘要消息、压缩后消息数组与 session.compacted 所需数据。
     * 成功后:测量锚点重置(旧 anchorIndex 失效)、附件签名清空(引用目标
     * 已被摘要替换)、自动熔断计数清零、校准态重置。失败(含无
     * 可压缩)不改动任何输入。
     * 观测缝:观测材料(CompactionObservation)恒随 outcome
     * 返回;**成功结局的 started/finished 由统一应用器签发**(折叠效果的
     * 必经之门),失败/no-op 结局不经应用器、保留本方法返回面签发(回调
     * 异常吞掉,fail-open 不影响压缩主链)。直调本方法的消费方(不经应用器)
     * 对成功结局自行消费 outcome.observation。
     *
     * **非重入契约**:compact/microcompact 的 await 窗口
     * 无重入护栏——并发调用会交错破坏账本/校准基线/派生态失效清单的时序。
     * 互斥责任在装配层:查询环屏障点单点调用、空闲直压与查询环互斥(driver
     * 纪律),现状全部调用面守住。第三方直调本 API 须自行保证同一实例上
     * compact/microcompact 不并发;kernel 刻意不加 in-flight 拒斥位(单线程
     * 消费是既有装配不变量,防御性加锁属无谓开销)。
     */
    compact(request: CompactRequest): Promise<CompactOutcome>;
    /**
     * G-A7(P-CTX2 K9,C-07 修复)— 无模型硬截断:计划同 compact(自适应
     * 两级粒度 + pinned/锚点保留),摘要位以截断占位存根充当,**零模型、零
     * 网络、同步完成**。无可截断(计划 null)返回 null,任何输入不动。
     *
     * 与 compact 的熔断语义差异(刻意):
     * - **不清零**连续失败计数——硬截断不是「压缩链路恢复健康」的证据,
     *   熔断保持打开,半开探测节律(noteBarrier 计时)不受影响;
     * - **不消耗**半开放行额度(#barriersSinceAutoCompactAttempt 不清零)
     *   ——本方法不打模型,半开计时语义是「距上次真实尝试的屏障数」;
     * - 不入 noopCompactCount / 重试链锚(那是模型压缩链的观测)。
     * 派生态失效清单(锚点/附件签名/校准态)与 compact 成功路径同序执行
     * (先失效后测量);观测经统一应用器最小面 + transform.mechanism 标记
     * 签发(无 provider/model 可归因,不伪造观测材料)。
     */
    hardTrim(request: HardTrimRequest): CompactOutcomeSuccess | null;
}

/**
 * 读文件闭包(装配层注入缝,与 ToolResultPersister 先例同构):返回现时
 * 文件内容;undefined = 不可读(被删/权限/二进制),调用方跳过该文件。
 * 实现应自行吞掉 IO 错误(抛错同样按不可读处理,见 planFileRestore)。
 */
type RestoreFileReader = (filePath: string) => {
    content: string;
} | undefined;

/** 健康快照(探针产物;treatments 消费 degraded,其余为观测归因材料) */
interface EndpointHealthSnapshot {
    degraded: boolean;
    /** 窗口内判据样本数(KA-05:aborted 剔除后的口径;分母/p95/下限同源) */
    samples: number;
    /** 窗口内错误率(error+timeout 占判据样本比;判据样本 0 时为 0) */
    errorRate: number;
    /** 窗口内耗时 p95(ms;判据样本 0 时缺席) */
    p95Ms?: number;
}
/**
 * 端点健康探针(治理侧消费缝):返回压缩目标端点的当前快照;undefined =
 * 探针失明(端点未知/聚合器未接),治理按健康处理(fail-open)。
 * 实现方(装配层)自行绑定目标 endpointKey 与时钟。
 */
type EndpointHealthProbe = () => EndpointHealthSnapshot | undefined;

/**
 * T-CTX04a — 上下文治理策略契约(doc/optimize/24 §2 出入口契约的定稿形态)。
 *
 * @experimental 本模块全部接口为 kernel 公共 API(非 protocol 契约),标记
 * experimental:允许随后续策略进场演进(24 号 §5 风险登记「接口过拟合」的
 * 对价),扩值/改形走 kernel API 评审(22 号卡级),不受 protocol 冻结约束。
 *
 * 概念模型(24 号 §1):
 * - 策略(Strategy)= 治理机制的实现;会话(GovernanceSession)= 策略的
 *   会话级实例(与查询环/manager 生命周期对齐)。
 * - 入口 = 查询环固定点位(§2.1 表):屏障点评估(assess)、工具结果落地
 *   (onToolResult)、溢出反应(assess reactive 语境)、手动触发(assess
 *   manual 语境 → execute)、生命周期(onLifecycleEvent)。
 * - 出口 = 封闭变换集(TransformOp)+ 统一应用器(governance-applier.ts):
 *   策略不直接持有消息数组可变引用,只产出变换数据;任何方案的效果必经
 *   应用器落地(围栏 1「出口不可绕过」)。
 *
 * TransformOp 封闭集定形记录:
 * - `replaceWithSummary`:压缩折叠(消费方 = baseline compact);
 * - `stubToolResult`:tool_result 原位存根化(消费方 = baseline microcompact);
 * - `insertSyntheticPair`:合成 tool 对注入(消费方 = baseline 压缩后文件
 *   重建);
 * - `removeRange`:整消息区间移除(消费方 = trivial-trim 玩具策略;也是
 *   时间型 microcompact/trim 类研究项机制的基础操作)。
 * 初稿成员 `insertReminder` 裁掉:无真实消费方——reminder 注入走查询环
 * 屏障缝(非治理变换);PreCompact hook 的指令注入走 directive 输入
 * 面(GovernanceDirective.instructions),不是消息变换。
 * 枚举以 TRANSFORM_OP_KINDS 快照锁测封口,扩值走 kernel API 评审。
 */

/** tool_result 块的窄化别名(与 query/types.ts IRToolResultBlock 同构) */
type ToolResultBlock = Extract<IRBlock, {
    t: 'tool_result';
}>;
/**
 * 整消息区间移除:messages[start, end) 整体删除。调用方须保证移除边界落在
 * 配对安全位置(应用器以配对计数校验兜底)。
 */
interface RemoveRangeOp {
    op: 'removeRange';
    /** 起点(含) */
    start: number;
    /** 终点(不含);须 > start 且 ≤ 消息数 */
    end: number;
}
/**
 * 压缩折叠:候选前缀 [0, cutIndex) 折叠为摘要——removedIndices 移除、
 * keptAnchorIndex(任务锚点)与 keptPinnedIndices(pinned 保留)前移,
 * 应用后数组 = [summaryMessage, 锚点?, ...pinned(升序), ...原 cutIndex 起
 * 尾段]。三组 index 必须恰构成 [0, cutIndex) 的不相交划分(应用器校验;
 * 折叠是全前缀处置,不允许「未声明去向」的消息静默丢失)。
 */
interface ReplaceWithSummaryOp {
    op: 'replaceWithSummary';
    /** 候选折叠区终点:消息 [0, cutIndex) 为处置对象 */
    cutIndex: number;
    /** 移除的消息 index(升序;非空) */
    removedIndices: readonly number[];
    /** 单独保留前移的任务锚点 index(首条用户消息保留策略;缺席 = 无锚点提取) */
    keptAnchorIndex?: number;
    /** 整体保留前移的 pinned 消息 index(升序;可为空) */
    keptPinnedIndices: readonly number[];
    /** 摘要消息(新前缀首条;不得含 tool_call/tool_result 块——配对安全) */
    summaryMessage: IRMessage;
}
/**
 * tool_result 原位存根化(OPT-05 microcompact 语义):「换 content 不动
 * 结构」——replacement 必须与原块同 callId(配对不变量),消息数与块序
 * 不变。被触碰的消息以新对象落位(copy-on-write),未触碰消息保持原引用。
 *
 * pin 契约注意:应用器没有 pin 视图(pin
 * WeakSet 所有权在 ContextManager),不校验目标消息是否 pinned——copy-on-write
 * 换新对象会使按旧引用登记的 pin 标记静默失效(压缩「整 round 保留」承诺
 * 随之丢失)。策略产出本 op 前应自行豁免 pinned 消息(baseline 经
 * manager.microcompact 的候选规划 isPinned 豁免;直产 op 的自定义策略同责)。
 */
interface StubToolResultOp {
    op: 'stubToolResult';
    messageIndex: number;
    blockIndex: number;
    /** 存根化后的块(callId 必须与原块一致) */
    replacement: ToolResultBlock;
}
/**
 * 合成 tool 对注入(压缩后文件重建):在 index 处插入
 * [call(assistant tool_call), result(user tool_result)] 两条消息。call 的
 * tool_call id 序列必须与 result 的 tool_result callId 序列一致(对内自闭
 * 配对,插入任何位置不破坏外部配对)。
 */
interface InsertSyntheticPairOp {
    op: 'insertSyntheticPair';
    /** 插入位(0 ≤ index ≤ 当前消息数;两条消息插在该位之前) */
    index: number;
    call: IRMessage;
    result: IRMessage;
}
/**
 * 封闭变换操作集(@experimental)。ops 序列按序应用:每个 op 的 index 坐标
 * 以**前序 op 应用后的数组状态**为准(顺序语义,与应用器实现一致)。
 */
type TransformOp = RemoveRangeOp | ReplaceWithSummaryOp | StubToolResultOp | InsertSyntheticPairOp;
/**
 * 统一失败形态(沿 CompactionFailureReason 枚举;
 * auto 计熔断/manual 报错的归类由策略引擎内部完成,查询环只消费 message)。
 */
interface GovernanceFailure {
    reason: CompactionFailureReason;
    message: string;
}
/**
 * 执行后处置建议(fail-fast 类):查询环在事件与 PostCompact hook 之后消费
 * ——以 `turn.error`(scope/message,recoverable=false)前置
 * `turn.aborted`(reason)收口。现状词表:scope ∈ {'compaction',
 * blockingFailFastScope('no_progress')},reason 恒 'prompt_too_long'
 * (无进展保护 / blocking 失败分型)。
 */
interface GovernanceVerdict {
    scope: string;
    message: string;
    reason: TerminalReason;
}
/**
 * 治理变换(execute 产物)。@experimental
 *
 * 失败(failure 在场)时 ops 必须为空(应用器拒绝混载);no-op(如
 * microcompact 无候选)= ops 为空且无 failure。
 */
interface GovernanceTransform {
    /** 封闭变换操作(统一应用器的唯一入口);失败/no-op 时为空数组 */
    ops: readonly TransformOp[];
    /** 治理自身成本(压缩 fork usage;账本单列,沿 compactionUsage 先例) */
    usage?: IRUsage;
    /** 统一失败形态(auto 计熔断/manual 报错已由策略引擎归类) */
    failure?: GovernanceFailure;
    /**
     * 结局明细(现状 CompactOutcome 形态):manual 悬诺(CompactNowResult)
     * 兑现与 PostCompact hook 载荷(summaryText/removedCount)的数据源。
     * 处理 manual 指令的策略应在成功/失败两径都填充;缺席时查询环按
     * 「无结局明细」降级(manual 悬诺以 turn_ended 拒绝、PostCompact 不分发)。
     */
    outcome?: CompactOutcome;
    /** 执行后处置建议(fail-fast;缺席 = 继续本轮) */
    verdict?: GovernanceVerdict;
    /**
     * 派生态失效清单(PostCompactInvalidation)的执行方:
     * - 'applier'(缺省):统一应用器在 ops 应用后执行注入的失效闭包
     *   (查询环注入 manager.runPostCompactInvalidations);
     * - 'strategy':策略引擎已在 execute 内部完成——baseline 经
     *   ContextManager.compact/microcompact 的内建清单执行(时序在
     *   measurementAfter 之前,应用器不得重复执行,否则校准配对基线被
     *   二次清空,校准链漂移)。
     */
    invalidations?: 'applier' | 'strategy';
    /**
     * microcompact 观测材料——产出 stubToolResult 变换
     * 的策略随变换携带(baseline 自 MicrocompactOutcome 投影),统一应用器
     * 在 stub 变换应用后据此签发 `onMicrocompactApplied`。缺席 = 不签发
     * (非 microcompact 语义的 stub 机制不被冒名观测,如实)。
     */
    microcompact?: MicrocompactObservation;
    /**
     * G-A7(P-CTX2 K9)— 折叠机制标记:'breaker_fallback' = blocking×熔断
     * 保底硬截断(无模型)。应用器把它透传进 `session.compacted` 事件体与
     * started/finished 观测事件(context-events 落盘可辨识,表面层据此渲染
     * 专用文案)。缺席 = 常规模型压缩。
     */
    mechanism?: 'breaker_fallback';
}
/** assess 输入快照(屏障点语境;view.messages 为查询环live数组的只读视图) */
interface GovernanceSnapshot {
    view: ContextView;
    /** 手动压缩请求在场(/compact 已排队到本屏障) */
    manual: boolean;
    /** 真溢出 reactive 恢复语境(413 后回屏障强制压缩) */
    reactive: boolean;
}
/**
 * 治理指令(assess 产物;词表 nothing | microcompact | compact
 * | block)。compact 指令的 instructions 由查询环在 PreCompact hook 分发后
 * 注入(manual 用户指令在前、hook additionalContext 在后
 * ——hook 指令注入位在 directive 输入面)。
 */
type GovernanceDirective = {
    kind: 'nothing';
} | {
    kind: 'microcompact';
} | {
    kind: 'compact';
    trigger: CompactionTrigger;
    /**
     * blocking 末段闸门语境(auto 径已越阻塞线的强制压缩):
     * execute 据此产出「成功但无进展 → fail-fast」verdict。
     */
    blockingGate?: boolean;
    /**
     * 熔断保底标记:压缩熔断压制中由
     * assess 置位,execute 据此**跳过模型压缩**、走无模型硬截断保底
     * (manager.hardTrim)——不再每屏障硬等压缩超时。覆盖两径:
     * blockingGate 命中与 reactive 真溢出自救(压制期 fork 注定打向
     * 劣化端点,保底后主查询重试照常)。熔断闭合时恒缺席
     * (行为与现状逐字节一致)。
     */
    breakerFallback?: boolean;
    /**
     * reactive 语境标记(与 trigger 正交:manual 请求与 reactive 待决
     * 同屏障并发时 trigger='manual' 但语境仍是 reactive——无进展保护
     * 按语境判,沿现状语义)。
     */
    reactiveContext?: boolean;
    /** 摘要附加指令(查询环合并 manual 用户指令与 PreCompact hook 注入后填充) */
    instructions?: string;
    /**
     * 压缩前钩子(查询环自 QueryCompactionOptions.beforeCompact 组装
     * 后经本输入面注入,与 instructions 同位;baseline 原样透传
     * CompactRequest.beforeCompact,语义见彼处)。
     */
    beforeCompact?: (view: ContextView) => Promise<{
        checkpointId?: string;
    } | void>;
} | {
    kind: 'block';
    verdict: GovernanceVerdict;
};
/**
 * 生命周期事件(生命周期行 + 屏障计时):
 * - 'barrier':查询环每个压缩屏障点恰发一次(baseline 据此推进半开熔断
 *   计时 noteBarrier,并失效同屏障 microcompact 复用缓存);
 * - setModel/preloadHistory/resetHistory/switchScheme:生命周期
 *   事件表词表预留——现行装配层对这四径一律整实例重建 manager 与会话,
 *   事件不经此面分发;跨会话存续型策略进场时启用。
 */
type GovernanceLifecycleEvent = {
    kind: 'barrier';
} | {
    kind: 'setModel';
} | {
    kind: 'preloadHistory';
} | {
    kind: 'resetHistory';
} | {
    kind: 'switchScheme';
};
/** 单次成功调用的文件触达清单(与 query/types.ts TouchedFileEntry 同构) */
interface GovernanceTouchedFileEntry {
    callId: string;
    paths: readonly string[];
}
/**
 * 工具结果落地视图(「工具结果落地」点位):一批 tool_result 回填
 * 进消息序列前(已过预算收束的入史形态)。baseline 消费
 * touchedFiles 维护文件触达台账;results 供未来工具结果治理类
 * 机制观察,当前无消费方。
 */
interface GovernanceToolResultView {
    results: readonly ToolResultBlock[];
    touchedFiles?: readonly GovernanceTouchedFileEntry[];
}
/** execute 的调用上下文(逐次传入;view 与 assess 快照同源) */
interface GovernanceExecuteContext {
    view: ContextView;
    signal?: AbortSignal;
    /** 终帧已报的摘要费用；查询取消可先于 execute 返回，不得丢弃已知用量。 */
    onUsage?: (usage: IRUsage) => void;
}
/**
 * 治理会话(策略的会话级实例;与 manager 生命周期对齐)。@experimental
 *
 * 屏障协议(查询环调用序,行为事实源 = run-query.ts 压缩屏障):
 * 1. onLifecycleEvent({kind:'barrier'}) 恰一次;
 * 2. assess(snapshot) 第一问;
 * 3. 得 microcompact 指令 → execute → 应用器落地 → assess **复问一次**
 *    (每屏障至多一次 microcompact;复问不得再产 microcompact——baseline
 *    以同屏障复用 measurementAfter 实现);
 * 4. 得 compact 指令 → PreCompact hook(查询环)→ execute → 应用器落地
 *    → 事件/悬诺/PostCompact hook → verdict 消费;
 * 5. 得 block 指令 → 查询环 fail-fast。
 */
interface GovernanceSession {
    /** 生命周期事件(见 GovernanceLifecycleEvent 词表) */
    onLifecycleEvent(event: GovernanceLifecycleEvent): void;
    /** 屏障点/溢出反应/手动触发的统一评估入口(语境经 snapshot 区分) */
    assess(snapshot: GovernanceSnapshot): GovernanceDirective;
    /** 工具结果落地点位(可选;baseline 消费 touchedFiles 记台账) */
    onToolResult?(view: GovernanceToolResultView): void;
    /** 执行指令产出变换(只接受 microcompact/compact 指令) */
    execute(directive: GovernanceDirective, context: GovernanceExecuteContext): Promise<GovernanceTransform>;
    /**
     * 本屏障内对**当前历史形态**的最近一次水位评估(可选)。
     * 查询环输出预算钳制点(IR 构造前)复用其 measurement 计算窗口余量,
     * 避免同屏障多余的全量估算遍(三遍结构锁的口径延伸)与
     * 校准配对基线被重复刷新。
     * 契约:返回的评估必须对应 assess/execute 协议走完后的消息数组现状
     * (microcompact 后 = measurementAfter 口径;compact 成功后 = 压缩后
     * measurementAfter 口径);无该屏障评估(manual/reactive 语境零测量、
     * auto=false)返回 null,查询环自行测量一次。方法缺席 = 同 null。
     */
    latestAssessment?(): ContextAssessment | null;
}

/**
 * SC-15(serve 并发审计 S-21;doc/111 §二 L5)— 内核级零依赖指标注册表。
 *
 * 五形态原则(doc/111 §〇-7):计数器/仪表/直方图的核与内核计数点落 kernel,
 * TUI / Headless / serve / acp / SDK 全部经 runQuery 同受益——serve 只在其上
 * 叠加传输层指标与 `GET /metrics` 端点(server/src/observability)。
 *
 * 形态:
 * - `counter(name, help, labelNames?)` / `gauge(...)` / `histogram(name, help,
 *   buckets, labelNames?)` / `summary(name, help, { quantiles, window }, labelNames?)`:
 *   同名再取即返回既有实例(get-or-create;类型、标签名、桶/分位/窗口不合即抛
 *   ——同一进程内多处装配共享 defaultMetrics 时不得静默漂移);
 * - 观测面(inc/set/observe)恒不抛:标签缺键补空串、多键忽略、非有限值忽略
 *   ——计数点分布在查询环热路径,观测缺陷不得反噬主链;
 * - `onCollect(fn)`:采集钩子,snapshot()/renderOpenMetrics 前逐一调用(把
 *   瞬时量写进 gauge;钩子异常吞掉);返回退订函数;
 * - `snapshot()`:结构化只读快照(TUI doctor / SDK stats 直读);
 * - `renderOpenMetrics(registries, { format? })`:两种 exposition 同一渲染器
 *   (SC-37,doc/118 §11.3 单一事实源):
 *     · `openmetrics-1.0`(缺省;serve 现用):`# TYPE` 先 `# HELP` 后、counter
 *       族名去 `_total` 而样本带、末行 `# EOF`;
 *     · `prometheus-0.0.4`(tansrd 现用):`# HELP` 先 `# TYPE` 后、`# TYPE` 名 =
 *       样本名(counter 带 `_total`)、无 `# EOF`;
 *   标签值转义、直方图 `_bucket{le}`/`_count`/`_sum`、summary `{quantile}`/
 *   `_count`/`_sum` 两形态同体;多注册表合并渲染(同一对象去重、同名族先到先得)。
 *
 * summary 型(SC-37 加法):滑动窗口最近 `window` 个观测(环形覆盖),分位取
 * 最近邻法(`nearestRankQuantile`,与 tansrd 既有 `quantileOf` 同式:空窗口 0),
 * `_sum`/`_count` 为全量累计(窗口外仍计)——这正是 tansrd `tansr_run_duration_ms`
 * 的既有语义,搬入内核不改口径。
 *
 * 纪律:
 * - 名称前缀 `tansr_`(kernel 计数 `tansr_kernel_*`,serve `tansr_serve_*`);
 *   进程级标准名(如 process_resident_memory_bytes)是唯一例外;
 * - **恒不携高基数标签**:令牌、消息内容、endUserId、sessionId、toolCallId 等
 *   恒不做 label(endUser 维度只做直方图/top-k,不做 label);
 * - 抽包共享(`@tansr/observability`,G11)不做:tansrd 直接依赖 kernel 公共出口
 *   (L3 可依赖 L2,kernel 恒不反向依赖 tansrd)。
 */
/** 标签集(键 = 注册时声明的 labelNames;值恒字符串) */
type MetricLabels = Readonly<Record<string, string>>;
/** 单条样本(counter/gauge) */
interface ScalarSeriesSnapshot {
    labels: Record<string, string>;
    value: number;
}
/** 直方图样本(累积桶) */
interface HistogramSeriesSnapshot {
    labels: Record<string, string>;
    count: number;
    sum: number;
    /** 与注册 buckets 同序的累积计数(不含 +Inf;+Inf = count) */
    buckets: number[];
}
/** summary 样本(滑窗分位 + 全量累计) */
interface SummarySeriesSnapshot {
    labels: Record<string, string>;
    /** 全量累计观测数(不随窗口滚动) */
    count: number;
    /** 全量累计观测和 */
    sum: number;
    /** 与注册 quantiles 同序的分位值(滑窗最近邻法;空窗口 0) */
    quantiles: number[];
}
type MetricSnapshot = {
    kind: 'counter' | 'gauge';
    name: string;
    help: string;
    labelNames: readonly string[];
    series: ScalarSeriesSnapshot[];
} | {
    kind: 'histogram';
    name: string;
    help: string;
    labelNames: readonly string[];
    buckets: readonly number[];
    series: HistogramSeriesSnapshot[];
} | {
    kind: 'summary';
    name: string;
    help: string;
    labelNames: readonly string[];
    quantiles: readonly number[];
    window: number;
    series: SummarySeriesSnapshot[];
};
interface MetricsSnapshot {
    /** 采集时刻(epoch ms) */
    at: number;
    metrics: MetricSnapshot[];
}
interface CounterMetric {
    readonly kind: 'counter';
    readonly name: string;
    readonly help: string;
    readonly labelNames: readonly string[];
    /** 累加:`inc(labels?, delta?)` 或无标签简写 `inc(delta)`(delta 缺省 1;负数/非有限值忽略) */
    inc(labels?: MetricLabels, delta?: number): void;
    inc(delta: number): void;
    /**
     * 以外部累计源同步绝对值(node_exporter ConstMetric 语义):被观测对象自持
     * 累计计数(如 TurnEndNotifier.stats().delivered)时在采集钩子里同步。
     */
    set(value: number, labels?: MetricLabels): void;
    get(labels?: MetricLabels): number;
}
interface GaugeMetric {
    readonly kind: 'gauge';
    readonly name: string;
    readonly help: string;
    readonly labelNames: readonly string[];
    set(value: number, labels?: MetricLabels): void;
    /** `inc(labels?, delta?)` 或无标签简写 `inc(delta)`;dec 同形 */
    inc(labels?: MetricLabels, delta?: number): void;
    inc(delta: number): void;
    dec(labels?: MetricLabels, delta?: number): void;
    dec(delta: number): void;
    get(labels?: MetricLabels): number;
}
interface HistogramMetric {
    readonly kind: 'histogram';
    readonly name: string;
    readonly help: string;
    readonly labelNames: readonly string[];
    /** 升序桶上界(不含 +Inf) */
    readonly buckets: readonly number[];
    observe(value: number, labels?: MetricLabels): void;
    get(labels?: MetricLabels): {
        count: number;
        sum: number;
        buckets: number[];
    } | undefined;
}
/** summary 注册选项(分位升序且 ∈ [0,1];window = 滑窗容量,正整数) */
interface SummaryOptions {
    quantiles: readonly number[];
    window: number;
}
interface SummaryMetric {
    readonly kind: 'summary';
    readonly name: string;
    readonly help: string;
    readonly labelNames: readonly string[];
    /** 升序分位(渲染 `quantile` 标签值 = String(q)) */
    readonly quantiles: readonly number[];
    /** 滑窗容量(最近 N 个观测) */
    readonly window: number;
    observe(value: number, labels?: MetricLabels): void;
    /** 该系列的全量累计与当前滑窗分位(未观测过的标签系列 undefined) */
    get(labels?: MetricLabels): {
        count: number;
        sum: number;
        quantiles: number[];
    } | undefined;
}
type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;
interface MetricsRegistry {
    counter(name: string, help: string, labelNames?: readonly string[]): CounterMetric;
    gauge(name: string, help: string, labelNames?: readonly string[]): GaugeMetric;
    histogram(name: string, help: string, buckets: readonly number[], labelNames?: readonly string[]): HistogramMetric;
    /** SC-37:滑窗分位 summary(语义见文件头) */
    summary(name: string, help: string, options: SummaryOptions, labelNames?: readonly string[]): SummaryMetric;
    /** 按名取已注册指标(未注册 undefined) */
    get(name: string): Metric | undefined;
    /** 采集钩子(snapshot/render 前调用;返回退订函数) */
    onCollect(fn: () => void): () => void;
    /** 结构化快照(先跑采集钩子) */
    snapshot(): MetricsSnapshot;
    /** 清空全部指标与钩子(测试用;生产恒不调) */
    reset(): void;
}

/**
 * 查询环显式状态机(显式状态 + while(true),非递归)。
 *
 * 七态语义:
 * - idle:               runQuery 已创建、事件流尚未开始消费;
 * - assembling:         组装下一次模型请求(唯一注入屏障点:排队输入与上一轮
 *                       tool_result 都只在进入本态时消费);
 * - streaming:          模型流式调用进行中;
 * - awaiting_permission:工具执行被权限询问挂起(由 ToolExecutor 信号驱动,
 *                       permission 决策本身是调度器/权限引擎的职责);
 * - executing_tools:    工具批执行中;
 * - compacting:         上下文压缩(轮间屏障点的阈值自动触发/
 *                       compactNow 手动/真溢出 reactive 三路都经本态);
 * - terminated:         终态,任何再迁移都是编程错误。
 */
declare const KERNEL_STATES: readonly ["idle", "assembling", "streaming", "awaiting_permission", "executing_tools", "compacting", "terminated"];
/** 查询环状态机的状态取值(KERNEL_STATES 成员)。 */
type KernelState = (typeof KERNEL_STATES)[number];

/** 预约式输入目标:绑定当前句柄；session/租户/historyEpoch 由宿主校验。 */
interface QueryInputTarget {
    readonly turnId: string;
}
interface QueryInputSubmission {
    readonly inputId: string;
    readonly text: string;
    readonly target?: QueryInputTarget;
}
type QueryInputRejectCode = 'invalid_input' | 'turn_mismatch' | 'input_conflict' | 'injection_limit' | 'turn_closed';
type QueryInputReason = TerminalReason | 'input_cancelled' | 'iterator_closed';
interface QueryInputReceipt {
    readonly inputId: string;
    readonly turnId: string;
    readonly ordinal: number;
    readonly revision: number;
    readonly source: 'legacy' | 'strict';
    /** consumed 仅证明已加入历史，不证明模型收到/回答或历史已经耐久写入。 */
    readonly state: 'reserved' | 'accepted' | 'consumed' | 'closed' | 'cancelled';
    readonly reason?: QueryInputReason;
}
interface QueryInputReservation {
    receipt(): QueryInputReceipt;
    /** 同步内存接纳；宿主不得据此声称 durable。重复提交返回原状态。 */
    commit(): QueryInputReceipt;
    /** 只取消尚未 commit 的 reservation；已接纳输入由本轮正常消费/终止裁定。 */
    cancel(): QueryInputReceipt;
    /** consumed/closed/cancelled 的最终凭据；不是整个查询的真实资源完成屏障。 */
    readonly completion: Promise<QueryInputReceipt>;
}
type QueryInputReservationResult = {
    readonly status: 'reserved';
    readonly reservation: QueryInputReservation;
} | {
    readonly status: 'duplicate';
    readonly receipt: QueryInputReceipt;
    readonly completion: Promise<QueryInputReceipt>;
} | {
    readonly status: 'closed';
    readonly code: QueryInputRejectCode;
} | {
    readonly status: 'rejected';
    readonly code: QueryInputRejectCode;
};

/**
 * 查询环对外类型:runQuery 选项/句柄、四计数、ToolExecutor 执行缝。
 *
 * 设计原则:client 与 executor 都是注入接口——查询环只负责
 * "收集 tool_call 块 → 交给 executor → 拿回 tool_result 回填下一轮 messages";
 * 权限、并发、实际执行全部是 executor(调度器)的职责。
 */

/** tool_result 块的窄化别名(executor 回填结果的元素类型) */
type IRToolResultBlock = Extract<IRBlock, {
    t: 'tool_result';
}>;
/**
 * 从模型流收集到的一次完整工具调用提案。
 * args 为 tool_args_delta 拼装并 JSON.parse 后的值;解析失败时 args 为
 * `{ $raw, $parseError }` 包装对象,并同步设置 argsParseError(executor 可
 * 据此直接产出错误 tool_result,不必再猜参数形状)。
 */
interface ProposedToolCall {
    /** 模型侧调用 id(tool_result.callId 必须与之配对) */
    id: string;
    name: string;
    args: unknown;
    /** 参数 JSON 解析失败时的错误信息 */
    argsParseError?: string;
    /** 该调用在 assistant 消息中的块 index(事件关联/诊断用) */
    blockIndex: number;
}
/** 执行器上下文:查询环传给 executor 的最小集合 */
interface ToolExecutionContext {
    /** 子查询实际收尾结算；先登记占位，业务事件结束后再兑现。不会等待在逻辑工具结果中。 */
    registerResource?: (work: Promise<ResourceSettlementResult>) => void;
    /** 工具/调度真实Promise；硬超时仅结束业务观察，不能摘除尚在飞的底层操作。 */
    registerOperation?: (work: Promise<unknown>) => void;
    sessionId: string;
    turnId: string;
    /** 全链贯穿的中断信号(《07》§1.5) */
    signal: AbortSignal;
    /** 当前工具轮次(1 起) */
    toolRound: number;
    /**
     * 当前查询消息的快照 getter:调用刻浅拷贝
     * ——元素(IRMessage)不可变引用,数组本体与查询环解耦,后续轮次的
     * push 不进快照。Task 工具在派生时点经 ToolContext 冻结「父上下文快照」
     * 作裁决语境;嵌套派生天然各级自取(子查询环自己的消息)。可选——
     * 第三方最小执行器/直调场景可缺省,裁决链特性静默不可用。
     */
    transcript?: () => readonly IRMessage[];
}
/**
 * 执行器产出项:
 * - `event`:协议事件体(tool.started/progress/output.delta/completed/failed/
 *   permission.* 等),由查询环补包络(seq/ts/source='tool')后转正发出;
 * - `state`:状态信号,驱动查询环在 executing_tools ↔ awaiting_permission
 *   之间迁移(必须成对签发;执行器结束时若仍处 awaiting_permission,查询环
 *   自动归位到 executing_tools)。
 */
type ToolExecutorYield = {
    t: 'event';
    body: EventBody;
} | {
    t: 'state';
    state: 'awaiting_permission' | 'executing_tools';
};
/**
 * 单次成功调用的文件触达清单(调度器按 Tool.touchedPathsOf /
 * mutatedPathsOf 声明位采集,仅对非 isError 结果产出)。
 */
interface TouchedFileEntry {
    callId: string;
    /** 声明位产出的绝对路径集(touched ∪ mutated,去重) */
    paths: readonly string[];
}
/** 执行器最终结果 */
interface ToolExecutionOutcome {
    /**
     * 与 calls 等长、按输入序逐一配对的 tool_result 块(《07》§1.6 ④:严格
     * 输入序回填;乱序/缺配对视为编程错误,查询环直接 throw)。
     * aborted=true 时允许为不完整前缀。
     */
    results: IRToolResultBlock[];
    /** 执行器因 signal 主动提前收尾(查询环据此以 aborted_tools 终止) */
    aborted?: boolean;
    /**
     * 本批**成功**调用的文件触达清单(查询环压缩后文件重建的台账
     * 数据源)。可选能力位——第三方最小实现可缺省,查询环按台账为空处理
     * (重建功能静默无候选,行为不变)。
     */
    touchedFiles?: readonly TouchedFileEntry[];
}
/**
 * 工具执行缝(调度器落地本接口;另有测试用 SequentialToolExecutor)。
 * 契约:execute 对一批 calls 负责到底——permission 询问、并发调度、超时、
 * discard 都在实现内;查询环只消费 yield 的事件/状态信号并等待最终 outcome。
 */
interface ToolExecutor {
    execute(calls: ProposedToolCall[], ctx: ToolExecutionContext): AsyncGenerator<ToolExecutorYield, ToolExecutionOutcome, undefined>;
}
/**
 * 查询环压缩接线选项(RunQueryOptions.compaction;提供即启用)。
 *
 * 两种注入形态:
 * - `manager`:装配层持有的跨轮 ContextManager(账本锚点/附件签名/熔断计数
 *   跨 runQuery 存续)。提供时其余自建字段全部忽略(阈值/保留策略以 manager
 *   构造配置为准)。
 * - 缺省:查询环按下列字段自建(生命周期 = 本次查询;测量退化为全量本地
 *   估算,保守可用)。contextWindow 取 thresholds.contextWindow,缺省回退
 *   RunQueryOptions.contextWindowTokens;两者皆缺是编程错误(启用压缩必须
 *   知道窗口大小)。
 */
interface QueryCompactionOptions {
    /** 跨轮共享的 ContextManager(优先;提供时下列自建字段忽略) */
    manager?: ContextManager;
    /**
     * 自建路径:阈值配置。缺省口径见 doc/07 §3.1(200K 窗口下自动触发线
     * = effectiveWindow(180K)- 13K = 167K,约 effectiveWindow 的 92%)。
     */
    thresholds?: Partial<ThresholdConfig>;
    /** 自建路径:摘要模型客户端;缺省复用主 client(fork 同模型,doc/07 §3.2) */
    client?: ModelClient;
    /**
     * 压缩 fork 的模型标识(OPT-10 降档;CompactRequest.model 留口的注入面):
     * 与摘要客户端**成对注入**——client 发什么 wire 请求由本字段决定,两者
     * 必须指向同一模型(manager 注入形态下与 manager 持有的 client 成对)。
     * 缺省 = 主模型(fork 同模型,doc/07 §3.2)。压缩 round 自身的
     * cost.usage.updated 以本字段归因(byModel 分桶独立可见)。
     * 分层铁律:kernel 不解析别名——fast 档解析在 cli 装配层(providers/
     * registry 事实),此处只接受已解析的 (provider, model) 标识。
     */
    model?: ResolvedModel;
    /**
     * 自建路径:token 估算器注入缝。
     * 例外注记:压缩后文件重建的预算估算(run-query 注入点)也消费
     * 本字段,且**不受**「manager 在场忽略自建字段」通则约束——manager 内部
     * 估算器为私有不可达,重建预算独立取本字段(缺省回退默认估算器);两者
     * 口径偏差由 H2 帽(min(20K, 压缩回收量-1))兜底,方向安全。
     */
    estimator?: TokenEstimator;
    /** 自建路径:保留最近 N 轮(round 粒度;单 round 超长时退化为折叠单元粒度);默认 2 */
    keepRecentRounds?: number;
    /** 自建路径:首条用户消息(任务锚点)恒保留;默认 true */
    keepFirstUserMessage?: boolean;
    /** 自建路径:摘要指令模板/前导句注入缝 */
    instructionTemplate?: string;
    summaryPreamble?: string;
    /**
     * 轮间自动触发开关;默认 true。false 时仅手动(compactNow)与真溢出
     * reactive 恢复两条路径生效。
     */
    auto?: boolean;
    /**
     * 装配层注入的当前压缩模型 maxOutput 上限(来源 =
     * cli 侧静态侧表,官方值带出处)。
     * 压缩输出预算 = min(maxOutputTokens ?? 20_000, thresholds.compactOutputBudget);
     * 不得再与会话 options.maxTokens 钳制(否则摘要会被静默截断)。
     */
    maxOutputTokens?: number;
    /**
     * 上下文治理只读观测缝(压缩生命周期 + microcompact 应用 +
     * 入史 clamp 计数)。kernel 公共 API(非 protocol);装配层消费写
     * context-events.jsonl。签发权分布见 CompactionObserver 注释
     * (成功结局经统一应用器;失败/no-op 在 manager 返回面)。回调异常不得
     * 影响压缩主链(fail-open,由消费侧自行捕获)。
     */
    observer?: CompactionObserver;
    /**
     * 压缩前钩子(「compactNow 把选项传下」的注入面;装配层
     * 落 pre_compaction 快照)。查询环在压缩屏障点组装为 CompactRequest.
     * beforeCompact(经 GovernanceDirective 输入面,与 instructions 同位)交
     * manager 调用;compactNow({ checkpoint }) 的选项经 context.checkpoint 抵达
     * (false 则本次不调用)。auto/reactive 压缩同样调用(context.checkpoint
     * 缺席,装配层按自身缺省决定)。缺席 = 不接线(现状零漂移)。
     * 注意:本字段由查询环消费(非 manager 构造集)——`manager` 注入形态下同样
     * 生效。装配层直调 ContextManager.compact(空闲直压)时应自行设置
     * CompactRequest.beforeCompact,本字段不覆盖该径。
     */
    beforeCompact?: QueryBeforeCompactHook;
    /**
     * 压缩后文件重建的读文件闭包(kernel 零文件 IO,
     * 装配层注入,与 toolResultBudget.persist 先例同构)。在场时查询环维护
     * Read/Edit/Write 触达台账,压缩成功后把最近触达 top-3 文件以合成 tool
     * 对 + `<system-reminder>` 注入摘要之后、保留尾段之前(预算:单文件 5K /
     * 总 20K tokens,常量出处见 context/file-restore.ts)。
     * 缺席 = 功能静默关闭(不记台账、不注入),行为与现状逐字节一致。
     * 注意:本字段由查询环消费(非 manager 构造集)——`manager` 注入形态下
     * 与自建形态同样生效,不受「manager 在场忽略自建字段」语义约束。
     * 本闭包由内置 baseline 治理会话消费(台账与注入随策略),
     * 注入语义与生命周期不变。
     */
    restoreFileReader?: RestoreFileReader;
    /**
     * 自建路径的压缩 round 模型调用超时(ms)。映射为
     * manager 构造级 timeoutMs(取值链:CompactRequest 请求级 > 本构造级 >
     * kernel 90s 缺省)——装配层方案 manager 级参数自此不再需要
     * compact 包装缝。quirk 下限换算(max(90s, minTimeoutMs))仍是装配层
     * 注入前的责任。`manager` 注入形态下忽略(与其余自建字段同语义)。
     */
    timeoutMs?: number;
    /**
     * 自建路径的转录回查路径提示(字符串或求值闭包;
     * 语义见 ContextManagerCompactionOptions.transcriptHint)。映射为 manager
     * 构造级配置(请求级覆盖仍胜出)。`manager` 注入形态下忽略。
     */
    transcriptHint?: string | (() => string | undefined);
    /**
     * P-CTX3:自建路径的 L3 工具结果分级衰减配置(doc/34 §3.4 机制 2;语义
     * 见 ContextManagerCompactionOptions.toolResultDecay)。映射为 manager
     * 构造级配置。缺席 = 关(现状 microcompact 零漂移);方案参数
     * toolResultDecay/decayHysteresisTokens 经策略展开落此位。
     * `manager` 注入形态下忽略(与其余自建字段同语义)。
     */
    toolResultDecay?: ToolResultDecayConfig;
    /**
     * P-CTX4 K14:端点感知压缩门(doc/34 §3.4 机制 3+4;方案参数
     * endpointAwareCompaction 经策略展开落此位)。生效面两半:manager 构造级
     * halfOpenBackoff(半开探测指数退避)+ baseline 会话 endpointAware
     * (劣化升级折叠与延迟决策,消费下方 endpointHealthProbe)。缺席 = 关
     * (现状零漂移)。`manager` 注入形态下 backoff 半边随外部 manager 构造,
     * 本键只驱动会话半边。
     */
    endpointAware?: {
        enabled: boolean;
    };
    /**
     * 压缩 fork 思考旋钮(2026-08-25 拍板;方案参数 compactionThinking 经
     * 策略展开落此位)。'off' = fork 显式关思考(摘要任务思考增益低,
     * Codex compact_model_reasoning_effort 同哲学——降配不换模);缺席/
     * 'inherit' = 继承主请求 thinking(现状零漂移)。门判在查询环
     * governance 组装点(run-query):'off' 的落线形态取决于下方
     * thinkingOffSupported 能力位。
     */
    thinkingMode?: 'inherit' | 'off';
    /**
     * 压缩模型「思考可关」实证能力位(装配层随 maxOutputTokens
     * 同通道穿入:压缩模型解析后 capability.reasoning===true 且
     * thinkingOptional===true 的白名单实证,RFC-M3 B2 词表)。消费点 =
     * thinkingMode='off' 的落线分派:
     * - true → fork 请求显式注 `thinking:{off:true}`(适配器按方言关断)——
     *   RFC-M3 B2 已实证 openai 兼容面思考模型**缺省仍开思考**,单纯省略
     *   thinking 字段是静默失效;
     * - 缺席/false(未实证端点/非思考模型)→ 保持省略字段。**已知限界**
     *   (据实登记,恒不猜):未实证的思考模型此形态下 fork 是否思考随
     *   上游缺省(可能仍开思考)——显式 off 参数对未实证方言有 400 风险,
     *   保守方向与 aux-model mainFastModeEligible 白名单制同律;非思考模型
     *   省略即正确(无思考可关,发关断参数徒增方言 400 风险)。
     */
    thinkingOffSupported?: boolean;
    /**
     * P-CTX4 K14:端点健康探针(装配事实,非方案参数——attempt 传输观测的
     * 滚动聚合快照闭包,目标 = 压缩链路主端点)。仅 endpointAware.enabled
     * 时被消费;缺席 = 劣化判定失明回落现状(fail-open)。
     */
    endpointHealthProbe?: EndpointHealthProbe;
    /**
     * P-CTX5 K21:缓存感知改写节律门(doc/35 机制 9;方案参数
     * cacheAwareRewrite 经策略展开落此位)。仅 baseline 会话策略半边消费
     * ——高命中率(EWMA ≥ CACHE_HIT_DEFER_THRESHOLD)且水位非紧急时推迟
     * microcompact 原位改写(改写必破缓存前缀);命中率材料由 manager
     * recordUsage 恒观测(纯观测,门关零行为)。缺席 = 关(现状零漂移)。
     * `manager` 注入形态下同样生效(本键消费方是 baseline 会话,非 manager
     * 构造集)。
     */
    cacheAwareRewrite?: {
        enabled: boolean;
    };
    /**
     * P-CTX5 K22:预算自觉注入门(doc/35 机制 10;方案参数 budgetAwareness
     * 经策略展开落此位)。消费方 = 查询环请求构造点:门开且本屏障有占用
     * 估算时,请求**副本**尾部注入 `<context-budget …/>` 协议块(模型自主
     * 收敛材料;不入 journal 正史/不进压缩候选/resume 重演恒重算,论证见
     * budget-awareness.ts)。缺席 = 关(请求体字节零漂移)。`manager` 注入
     * 形态下同样生效(消费方是查询环,非 manager 构造集)。
     */
    budgetAwareness?: {
        enabled: boolean;
    };
    /**
     * P-CTX4 K15:锚点层 L1 门(doc/34 §3.4 机制 1;方案参数 anchorLayer/
     * anchorBudgetTokens 经策略展开落此位)。映射为 manager 构造级配置
     * (语义见 ContextManagerCompactionOptions.anchorLayer)。缺席 = 关
     * (现状零漂移);`manager` 注入形态下忽略(锚点层随外部 manager 构造)。
     */
    anchorLayer?: {
        enabled: boolean;
        budgetTokens?: number;
    };
    /**
     * P-CTX4 K16:估算-校准闭环门(doc/34 §3.4 机制 5;方案参数
     * bucketedCalibration/confidenceMarginRatio 经策略展开落此位)。映射为
     * manager 构造级配置(语义见 ContextManagerCompactionOptions.
     * bucketedCalibration)。缺席 = 关(单标量校准语义零漂移);`manager`
     * 注入形态下忽略(校准配置随外部 manager 构造)。
     */
    bucketedCalibration?: {
        enabled: boolean;
        confidenceMarginRatio?: number;
    };
    /**
     * CW14-N5:压缩段回查节门(方案参数 compactionSegmentLookback 经策略
     * 展开落此位)。映射为 manager 构造级配置(语义见
     * ContextManagerCompactionOptions.segmentLookback)。缺席 = 关(摘要
     * 字节零漂移);`manager` 注入形态下忽略(随外部 manager 构造)。
     */
    segmentLookback?: {
        enabled: boolean;
    };
    /**
     * 治理策略会话注入缝(@experimental)。缺省 = 内置 baseline
     * 策略包装本查询解析出的 ContextManager(行为与策略化前逐字节一致)。
     * 注入时查询环五点位改经注入会话,ContextManager 仍作
     * 账本/测量引擎由查询环持有(recordUsage/compactNow 守卫不变)。
     * 注入面限装配层(围栏 3);会话生命周期由注入方管理。
     */
    session?: GovernanceSession;
    /**
     * 自建路径的附件注册表参数(TTL 轮数/session 字节
     * 预算)。附件三态裁决(注入/引用化/预算拒绝)的调用方:TUI @file 引用
     * (装配层 session-driver)与查询环诊断类元注入(reminder 径)。
     * `manager` 注入形态下忽略(与其余自建字段同语义——注册表随 manager
     * 构造,见 ContextManagerOptions.attachments)。
     */
    attachments?: AttachmentRegistryOptions;
}

/** compactNow 的可选参数(/compact [instructions] 透传) */
interface CompactNowOptions {
    /** 用户附加摘要指令:追加在指令模板后,引导摘要焦点(不替换模板) */
    instructions?: string;
    /**
     * K-5(doc/116 §4.2 / doc/117 K-5)— 压缩前上下文快照选项:
     * - `false`:本次不调用 QueryCompactionOptions.beforeCompact(显式关);
     * - `true` / `{ label? }`:调用钩子并把本值原样传入(label 为快照标签);
     * - 缺席:钩子仍被调用、context.checkpoint 缺席——是否落快照由装配层
     *   自身缺省决定(SDK/serve 缺省 true)。
     * 并发 compactNow 合流时后到者胜(与 instructions 同律)。钩子未接线
     * (QueryCompactionOptions.beforeCompact 缺席)时本选项无效果。
     */
    checkpoint?: boolean | {
        label?: string;
    };
}
/** K-5:查询环调用 QueryCompactionOptions.beforeCompact 时的语境 */
interface QueryBeforeCompactContext {
    trigger: CompactionTrigger;
    /** compactNow 传入的 checkpoint 选项(auto/reactive 或未传时缺席;false 不达钩子) */
    checkpoint?: boolean | {
        label?: string;
    };
}
/**
 * K-5:装配层注入的压缩前钩子(典型 = writeCheckpoint 落 pre_compaction 快照)。
 * 由查询环按屏障点语境组装为 CompactRequest.beforeCompact 交 manager 调用
 * (计划落定后、fork 请求发出前;无可压不调用)。返回 checkpointId 即冒泡到
 * CompactOutcome / CompactNowResult / session.compacted 事件;抛错 → 本次压缩
 * 失败 reason='before_compact_failed',历史不变。
 */
type QueryBeforeCompactHook = (view: ContextView, context: QueryBeforeCompactContext) => Promise<{
    checkpointId?: string;
} | void>;
/** compactNow 的拒绝原因(排队都排不上/被显式拦下的场景) */
type CompactNowRejectReason = 
/** RunQueryOptions 未提供 compaction(压缩缝未接) */
'not_configured'
/** 本轮已终态(或排队后直到终态都未再经过屏障点):轮间压缩请走 ContextManager.compact */
 | 'turn_ended'
/**
 * 历史为空,无可压缩(装配层空闲直压路径专用;内核 compactNow 不产
 * 本值——运行中轮的 messages 恒非空)。
 */
 | 'empty_history'
/**
 * PreCompact hook 阻断本次压缩(exit 2 / decision=deny|block)。
 * 显式协议行为而非故障——hook 作者对压缩行使否决权,历史未改动。
 */
 | 'hook_blocked';
/** compactNow 的结算结果(在下一个屏障点执行后兑现) */
type CompactNowResult = 
/** K-5:checkpointId = beforeCompact 钩子落的压缩前快照 id(与 outcome.checkpointId 同值;缺席 = 未落) */
{
    status: 'compacted';
    outcome: CompactOutcomeSuccess;
    checkpointId?: string;
}
/** 失败时已落的快照不回滚(D-11 A):id 见 outcome.checkpointId */
 | {
    status: 'failed';
    outcome: CompactOutcomeFailure;
} | {
    status: 'rejected';
    reason: CompactNowRejectReason;
};
/** 四计数分离(《07》§1.6 ①:恢复重试必须可观测,不得混进 turn 计数) */
interface QueryCounters {
    /** 模型调用次数(每次进入 streaming +1,重试也计入) */
    modelTurns: number;
    /** 工具执行轮次(每批工具 +1) */
    toolRounds: number;
    /** 连续可恢复错误数(任何一次成功流式响应清零) */
    consecutiveErrors: number;
    /** 注入屏障已消费的旧 enqueue 输入条数；strict input 按凭据独立核对，避免宿主 slice 错位。 */
    queueInjections: number;
    /**
     * CW11-W3(doc/58 W3 #7)— 触帽升档重试次数(遥测:每次废弃截断响应并
     * 升档重发 +1)。纯追加可选字段:缺席 = 0(旧消费方/测试替身零迁移);
     * kernel 查询环恒初始化并如实累计。
     */
    outputCapEscalations?: number;
}
/** runQuery 返回句柄(《07》§1.6 ⑨:排队输入只经 enqueueUserInput 进入屏障) */
interface QueryHandle {
    /** 事件流:protocol 完整事件(包络+负载),seq 单调 */
    events: AsyncGenerator<KernelEvent, void, undefined>;
    /**
     * 等待已经启动的查询及模型/工具生成器真实收尾，不消费事件、不中止。
     * 终态事件仅代表逻辑结束；timeout/cancelled保留实际在飞工作，可再次等待。
     * runQuery恒提供；第三方旧句柄可缺席，此时调用方只能证明其既有迭代器合同。
     */
    settle?(options?: ResourceSettleOptions): Promise<ResourceSettlementResult>;
    /**
     * 注入用户输入:流式期间不打断当前模型调用,统一在下一次 assembling 前
     * 的屏障点消费;终态后调用为无害空操作(运行时竞态,非编程错误)。
     */
    enqueueUserInput(text: string): void;
    /** 预约式输入(加法能力)；旧句柄可缺席。目标为本轮，不隐式创建后续轮。 */
    reserveUserInput?(input: QueryInputSubmission): QueryInputReservationResult;
    inputReceipts?(): readonly QueryInputReceipt[];
    inputTarget?(): QueryInputTarget & {
        readonly open: boolean;
    };
    /**
     * 立即中断;reason 缺省时按当下状态推导(streaming→aborted_streaming 等)。
     * 显式 reason = 「外部中止来源」注入缝(RFC-SC-1 R3,contract-v0.21):驱动层
     * 按来源指定终局词(serve 每轮墙钟 'timeout'、注册仓孤儿策略 'client_gone'
     * 等),kernel 原样签发进 turn.aborted;不传 = 现状零漂移(TUI/headless/acp)。
     */
    abort(reason?: TerminalReason): void;
    /** 当前状态(可随时查询) */
    state(): KernelState;
    /** 四计数快照 */
    counters(): QueryCounters;
    /**
     * 消息历史快照(深拷贝;含 initialMessages 与本次查询累计的
     * user/assistant/tool_result 消息)。多轮会话装配(TUI/serve)在终态后
     * 取走,作为下一次 runQuery 的 initialMessages——事件流不承载完整消息体,
     * 历史保真以此为唯一出口。压缩成功后快照即压缩后形态。
     */
    messages(): IRMessage[];
    /**
     * 手动压缩(/compact 接线语义):请求排队到下一个轮间屏障点执行
     * (运行中轮不可就地压缩——流式/工具期间历史正在生长,折叠边界无从落定),
     * 返回的 promise 在屏障点执行后兑现;并发调用合流到同一次执行。
     * 未接压缩缝立即拒绝 not_configured;已终态(或排队后直到终态未再经过
     * 屏障点)拒绝 turn_ended——轮与轮之间的手动压缩由装配层直接走
     * ContextManager.compact(本句柄生命周期只覆盖单轮)。
     * 注意:promise 由事件流消费驱动兑现,须与 events 消费并发等待。
     * 可选能力位:runQuery 恒提供;第三方最小实现(测试假句柄等)可缺省,
     * 消费方以 `handle.compactNow?.()` 探测。
     * options.instructions:并发调用合流时后到者胜(用户最新意图)。
     */
    compactNow?(options?: CompactNowOptions): Promise<CompactNowResult>;
}

/**
 * 权限缝最小接口。
 *
 * 权限引擎与调度器分层开发,本目录不得 import permissions/;这里只定义调度器
 * 需要的最小决策接口,集成适配由装配层完成。语义:
 * - decide 返回 allow → 直接执行;deny → 签发 tool.permission.decided 并产出
 *   isError tool_result;ask → 经 awaiting_permission 状态往返询问 askUser;
 * - 未注入 askUser 时 ask 降级为 deny(headless 场景,source 记为 'policy');
 *   contract-v0.8 注记:dontAsk 模式是同一 fail-closed 语义的一等模式化
 *   (引擎 decide 内先降、归因 'mode' 且保留 matchedRule),该模式下引擎不再
 *   产出 ask,本降级分支自然不触达——两机制叠加不冲突,降级保留为无询问面
 *   的兜底(hook 升格的 ask 等门面级 ask 仍经此路);
 * - 未注入 PermissionGate 时全放行(向后兼容既有测试与早期集成)。
 */

/** 门面决策:decision 三态 + 决策来源(全部落审计,见 protocol DecisionSource) */
interface GateDecision {
    decision: PermissionDecision;
    source: DecisionSource;
    /**
     * 命中的规则原文(contract-v0.2):引擎侧
     * PermissionDecisionResult.matchedRule 的透传位,调度器原样落进
     * tool.permission.decided 事件体;无规则命中(模式短路/兜底 ask)时缺省。
     */
    matchedRule?: string;
    /**
     * 入参替换(PreToolUse hooks 的 updatedInput):
     * 存在时调度器以此覆盖 call.args 执行(询问对话框同样展示替换后入参,
     * 用户看到的即将执行的真实参数)。仅门面(L4 装配)可产出;引擎侧无此位。
     */
    updatedArgs?: Record<string, unknown>;
    /**
     * 裁决理由(自由文本;恒不进 tool.permission.decided 事件,契约零改动)。
     * - **deny**(deny-and-continue;source='classifier' 的收紧、hook 收紧、
     *   hard-safety 等):调度器把理由并入 isError tool_result 文本回喂模型——
     *   模型据此调整路线继续本轮;
     * - **ask**(姿态 rejectEffect='ask';source='classifier'):裁决人
     *   判为危险但升到询问面——调度器把本决策整体作 askUser 第三参
     *   `decision` 透传,询问面据 `reason` 呈现「裁决人判为危险:…」供用户
     *   终审;该 ask 终局为 deny(用户拒 / 无询问通道地板)时理由同样进
     *   deny-and-continue 文本(拒绝 ≠ 信息灭失)。非分类器 ask 无本键。
     * 引擎侧 PermissionDecisionResult.reason 经装配层网关(cli permission-gate
     * / sdk permission)逐出口透传至此。
     */
    reason?: string;
    /**
     * 命中规则所在层(归因;仅规则命中携带)。字面量联合与 kernel
     * permissions/types.ts 的 RuleLayerName 逐字对齐——本目录不 import
     * permissions/(分层铁律),结构兼容由装配层保证。询问面据此
     * 显示项目来源(仓库 deny/ask 即时生效,但用户须看见是谁在约束)。
     */
    sourceLayer?: 'policy' | 'projectLocal' | 'projectShared' | 'user';
    /**
     * 派生裁决链语境:子代理 ask 经父裁决后
     * endorse/escalate 上升到用户终审时,执行器把逐级裁决留痕挂在此位——
     * 终审弹卡呈现完整责任链(「父 X 为子 Y 的操作 Z 担保,理由 W,责任人
     * X」)。仅裁决链路径携带;主代理直接询问恒缺省。
     */
    adjudication?: {
        /** 逐级裁决条目(单层派生恒一级;递归派生为多级) */
        chain: readonly AdjudicationChainEntry[];
        /** true = 父担保上报(endorse);false = 父不能决上升(escalate) */
        endorsed: boolean;
        /** 发起 ask 的子代理身份(弹卡「子 Y」位) */
        childAgentId: string;
        /** 派生时的任务标签(弹卡语境:这个子代理是干什么的) */
        childDescription: string;
    };
    /**
     * 分类器裁决意见段(审计词表归一):引擎**真实模型
     * 咨询**归一意见后经装配层网关透传至此(结构与 kernel permissions/
     * types.ts 的 PermissionAdjudicationEntry 同构——本目录不 import
     * permissions/,结构兼容由装配层保证,sourceLayer 同例)。执行器把本段
     * 并入决策记录 adjudicationChain(与 Task 链共存时分类器条目在前);
     * 纯审计位,恒不参与执行语义;不进 tool.permission.decided 事件。
     */
    classifierAdjudication?: AdjudicationChainEntry;
}
/**
 * 门判定提示位:执行器按会话形态附带的判定语境——分类器软化
 * 抑制(auto × 裁决链 × 父终审开时,子代理调用的 safe→allow 让位父终审;
 * 方向纯收紧)。适配器(cli permission-gate)透传给引擎 DecideInput;
 * 旧实现忽略第二参数即向后兼容(hints 只收紧不放宽,忽略 = 维持现状
 * 分类器全权,无安全回退面)。
 */
interface GateDecideHints {
    suppressClassifierSoften?: boolean;
    /**
     * 回退重判位:执行器在
     * 裁决链全员结构性失败时对**同一 tool_use_id** 发起分类器回退重判——
     * 首判已跑过完整门(PreToolUse hooks / PermissionRequest 收紧缝 / 会话
     * 事件记账),重判置此位令门跳过全部副作用面,只走 engine.decide +
     * 分类器咨询(软化链与引擎判定保留):hooks 不双跑、判定以首判替换后
     * 入参为准(判定依据与执行参数恒一致)。判定语义(engine + classifier)
     * 恒不变,只裁旁路;旧实现忽略 = 复跑完整门(副作用重复但方向不宽,
     * 无安全回退面)。
     */
    fallbackRedecide?: boolean;
    /**
     * 审批桥执行前重判位:人批(异步审批
     * 挑战获批)后的重判只为捕捉**等待期策略漂移**——引擎管线重跑,副作用
     * 面跳过与 fallbackRedecide 同律,且**分类器咨询恒跳过**:首判已真实
     * 咨询过一次(意见段随首判 GateDecision 入审计),人批权级高于分类器
     * 建议位,只收紧语义下二次咨询徒耗共享预算、且 unsafe 改判会否决已获
     * 人批(权级倒置),意见段还落不进审计(桥只回传 allow/deny 二值)。
     * 旧实现忽略 = 现状(二次咨询照跑;方向不宽,无安全回退面)。
     */
    approvalRedecide?: boolean;
}
/** 权限门:调度器在每次工具执行前调用 decide,取 allow / deny / ask 结构化决策。 */
interface PermissionGate {
    decide(call: ProposedToolCall, hints?: GateDecideHints): GateDecision | Promise<GateDecision>;
}
/**
 * 询问回调:表面层(TUI/headless 编排)注入;resolve 为用户的最终选择。
 * signal:调用方(调度器)的中断信号——回合 Esc/中止时表面层据此撤回
 * 询问对话框(不撤回则残留幽灵对话框,堵塞后续对话框队列)。
 * decision:触发本次询问的门面决策(归因展示;matchedRule/sourceLayer
 * 供对话框呈现「哪条规则、来自哪层」;'ask' 姿态下 source='classifier' +
 * reason 供呈现「裁决人判为危险:…」)。旧实现忽略第三参数即向后兼容。
 */
type AskUserCallback = (call: ProposedToolCall, signal?: AbortSignal, decision?: GateDecision) => Promise<'allow' | 'deny'>;

/**
 * 裁决路由器(AskRouter):ask 终局出口的单一路由策略。
 *
 * 背景:权限引擎产出 ask 终局后,出路
 * 此前散落三处——主代理经 askUser 弹卡(TUI/K11 远程审批同为 askUser 的
 * 装配变体)、子代理无通道降 deny、headless 无通道降 deny。本文件把
 * 「往哪去」收敛为一个纯函数,调度器按目标执行:
 * - `parent-adjudication`:派生裁决链(子代理执行器专属)——ask
 *   先由「派生时点上下文中的父代理」裁决(reject/endorse/escalate);
 * - `user-dialog`:本级询问通道(askUser 回调:TUI 弹卡 / K11 挑战投递 /
 *   ACP requestPermission);
 * - `floor-deny`:fail-closed 地板——链的尽头无人时恒 deny,
 *   永不 fail-open。
 *
 * 优先序即安全序:裁决器在场必先走链(链顶仍可能是 user-dialog 或地板);
 * 语境缺省(两者皆无)恒落地板。本函数不感知权限模式——模式门禁在引擎
 * (deny 面不进本路由,INV-D3),模式对链的收窄(dontAsk 不触达用户等)
 * 由装配层经「是否注入 adjudicator/topAskUser」表达(kernel 零模式感知)。
 */

/**
 * 裁决产出途径(审计归因,INV-D4/INV-D6):
 * - `model`:真实模型裁决;
 * - `invalid_output`:模型输出非法(空/非 JSON/未知 verdict/缺字段/超长)
 *   → 恒 escalate,不默认担保;
 * - `timeout` / `error`:查询超时或异常 → 恒 escalate(fail-safe 向上);
 * - `budget_exhausted` / `breaker_open`:共享咨询预算耗尽 / 分类器熔断
 *   在场(B-2)→ 不起查询直通 escalate(链顶按模式落用户或地板)。
 */
type AdjudicationVia = 'model' | 'invalid_output' | 'timeout' | 'error' | 'budget_exhausted' | 'breaker_open';

/**
 * 单级裁决留痕(审计链条目;decisions.jsonl 与终审弹卡共用此形):
 * 统一咨询意见(verdict + reason,reason 为模型原话、结构性出口为固定
 * 英文短语)+ 审计扩展(责任人/途径/耗时)。
 */
interface AdjudicationChainEntry extends AdjudicationOpinion {
    /** 裁决人身份:`agent:<parentAgentId>` 或 `main`(主代理) */
    adjudicator: string;
    via: AdjudicationVia;
    elapsedMs: number;
}
/** 裁决器输出:链条目本体(执行器据 verdict 分流,整条进审计) */
type AdjudicationVerdict = AdjudicationChainEntry;
/** 裁决请求:子代理的 ask 事实包 */
interface AdjudicationRequest {
    /** 子代理的工具调用(hooks 入参替换后的真实执行形) */
    call: ProposedToolCall;
    /** 引擎 ask 归因(matchedRule/sourceLayer 进裁决语境与审计) */
    gate: GateDecision;
}
/**
 * 父裁决器:子代理执行器在 ask 终局调用;实现(agents/adjudication.ts)
 * 持有派生时点父上下文快照 + 父模型 client,单轮低配额查询产出三出口。
 * 契约:**永不 throw、永不 fail-open**——一切异常收敛为 escalate 条目。
 */
type ParentAdjudicator = (request: AdjudicationRequest, signal?: AbortSignal) => Promise<AdjudicationVerdict>;
/**
 * 远程裁决人档预算超限处置指令(budgets 机制位):gate
 * 产出的结构化超限出口——装配层按生效档 escalation.mode 定向('parent'
 * → escalate 上交链顶、'reject' → reject 拒绝该派生请求),reason 为审计
 * 留痕(裁决器原样落链条目,via='budget_exhausted' 归因)。
 */
interface AdjudicationBudgetDirective {
    outcome: 'escalate' | 'reject';
    reason: string;
}
/**
 * 共享咨询预算 gate(分类器同池 + 远程档预算):装配层组合权限引擎公共口
 * (分类器同池预算 + 熔断状态)与远程裁决人档 budgets(maxRounds/maxUsd)。
 * `ok` 才起裁决查询;'budget_exhausted'/'breaker_open' = 结构性 escalate
 * (via 同名);结构化指令 = 远程档预算超限,按 outcome 落 verdict
 * (via='budget_exhausted')。
 */
type AdjudicationBudgetGate = () => 'ok' | 'budget_exhausted' | 'breaker_open' | AdjudicationBudgetDirective;

/** MF-1 条目类型闭集(doc/40 §2.1;'unknown' 为观测面诚实归桶,非第五类) */
declare const MEMORY_ENTRY_TYPES: readonly ["user", "feedback", "project", "reference"];
/**
 * TMEM/3 C4(doc/74 §C4)— 写观测条目类型:四类闭集 + 'unknown'。
 * 'unknown' 收:索引文件写入(索引单行条目的类型归属不可靠,恒不猜)、
 * 无 frontmatter 正文、`type:` 值在四类之外。
 */
type MemoryEntryType = (typeof MEMORY_ENTRY_TYPES)[number] | 'unknown';
/** 写观测载荷(装配层 context.memory.write 行数据源;全数值+路径,恒无正文) */
interface MemoryWriteObservation {
    /** 声明目标绝对路径 */
    path: string;
    /** 写后正文 UTF-8 字节(索引文件为剥离口径;主题文件为原文口径) */
    bytes: number;
    /** 写后物理行数(口径同上) */
    lines: number;
    /** 目标是否索引文件 MEMORY.md */
    indexFile: boolean;
    /** 索引双帽 ≥90%(主题文件恒 false) */
    nearLimit: boolean;
    /** 索引双帽超 100%(主题文件恒 false) */
    overLimit: boolean;
    /**
     * TMEM/3 C4:条目类型(写入正文 frontmatter `type:` 提取;savedByType
     * 聚合取材面)。可选纯追加——旧构造缺席按 'unknown' 消费。
     */
    entryType?: MemoryEntryType;
}
/**
 * 记忆写上下文(ToolContext.memoryWrite;调度器自执行器选项透传)。
 * dirs 为门开时的记忆目录绝对路径集;缺席/空集 = 门关零触发。
 */
interface MemoryWriteContext {
    dirs: readonly string[];
    /** 路径比对大小写语义(缺省 win32 不敏感;测试注入) */
    caseInsensitivePaths?: boolean;
    /** 写观测回调(fire-and-forget;抛错被工具侧吞掉) */
    onWrite?: (info: MemoryWriteObservation) => void;
}

/**
 * grep 轮次聚合埋点(一期统计 agent 单任务 grep
 * 轮次,为二期「语义索引开启信号」提供数据支撑——开启信号词表:仓库
 * >1000 文件 / 跨仓检索 / 概念性查询占比高 / grep 往返超阈值)。
 *
 * 挂载与取用路径(不新增契约事件):
 * - DispatchingToolExecutor 每会话持有一个实例(可注入),经
 *   ToolContext.searchAggregator 注入工具执行上下文;
 * - 每次 executor.execute()(= 一个工具轮次)调 beginRound();
 * - Grep 工具每次执行 record() 一条样本;
 * - 表面层/查询环在 turn 结束经 executor.searchAggregator.snapshot()
 *   只读导出,或 drain() 导出并清零(turn 粒度归账由持有方决定)。
 */
interface GrepCallSample {
    /** 工具轮次序号(executor.execute() 递增;直调场景恒 0) */
    round: number;
    /** 查询模式长度(码元数,长度分布的原始样本) */
    patternLength: number;
    /** 输出模式(content / files_with_matches / count) */
    mode: string;
    /** 命中规模(匹配行总数) */
    matches: number;
    filesScanned: number;
    truncated: boolean;
    /** 实际执行引擎(js / rg;错误早退时缺省) */
    engine?: string;
    isError: boolean;
    durationMs: number;
}
interface GrepRoundReport {
    /** 样本覆盖的调用总数(含被丢弃样本) */
    calls: number;
    /** 出现过 Grep 调用的轮次数 */
    rounds: number;
    errorCalls: number;
    truncatedCalls: number;
    totalMatches: number;
    /** 模式长度分布(无样本时 undefined) */
    patternLength?: {
        min: number;
        max: number;
        avg: number;
    };
    /** 引擎使用计数(如 { js: 3, rg: 12 }) */
    engines: Record<string, number>;
    samples: readonly GrepCallSample[];
    /** 超样本上限被丢弃的样本数(计数仍进 calls 等聚合值) */
    droppedSamples: number;
}
declare class GrepRoundAggregator {
    #private;
    /** 进入新一个工具轮次(调度器每次 execute() 调用一次) */
    beginRound(): void;
    record(sample: Omit<GrepCallSample, 'round'>): void;
    snapshot(): GrepRoundReport;
    /** 导出并清零(轮次计数一并归零;turn 粒度归账用) */
    drain(): GrepRoundReport;
}

/**
 * 工具运行时契约(kernel 内部,预先冻结供并行任务面向接口编程)。
 * 设计要点:工具只产出结构化数据,渲染由表面层按事件类型注册;
 * isReadOnly/isConcurrencySafe 强制静态声明,供调度器与
 * 权限引擎使用,不允许运行期才暴露。
 */

/**
 * Read 去重窗口:最近一次成功文本读取的请求与规模快照。
 * 同键(offset/limit 归一后)+ mtime 未变的重复读 → 一句桩文本替代全文
 * 重发(CC 实测 18% 的 Read 是重复读)。一次性语义:命中
 * 即清除本窗口,紧接着的再次同读放行全文——防「早前结果已被 microcompact
 * 淘汰时模型无路取回」死角(桩绝不连发)。
 */
interface ReadDedupWindow {
    /** 归一化后的起始行(缺省补 1) */
    offset: number;
    /** 归一化后的行数上限(缺省补 READ_MAX_LINES) */
    limit: number;
    /** 读取时的文件总行数 */
    totalLines: number;
    /** 实际返回的行区间(1 起含端点);未返回任何行时为 null */
    returnedRange: [number, number] | null;
}
/** Read 工具记录、Edit/Write 校验的跨调用文件状态(mtime 失效检测) */
interface FileReadState {
    mtimeMs: number;
    /**
     * 读取 / 写入时的内容快照哈希(sha256 hex;写入点:Read 整读
     * 与流式分页全流、Write / Edit 写后皆登记)。Write / Edit 写前在 mtime 律之外
     * 再以全文哈希比对——mtime 未变而内容已变亦拒。缺席 = 该登记无全文可计(旧
     * 登记 / 图片读),守卫只按 mtime。
     */
    contentHash?: string;
    /** 最近一次成功文本读取的去重窗口(Write/Edit 登记与图片读取不携带) */
    lastRead?: ReadDedupWindow;
}
/**
 * 工具执行上下文:由调度器在每次 execute 前注入——工作目录、取消信号、事件发射口、
 * 会话级文件读取状态,以及若干可选的注入缝(fs 世界、检索聚合器、裁决语境、记忆写回)。
 */
interface ToolContext {
    /** Retain a nested query's actual cleanup; this does not delay its business result or cancel it. */
    registerResource?: (work: Promise<ResourceSettlementResult>) => void;
    cwd: string;
    signal: AbortSignal;
    /** 发结构化事件(tool.progress / tool.output.delta 等),包络由调度器补 */
    emit: (body: EventBody) => void;
    /** 会话级共享:path → 读取状态 */
    fileReadState: Map<string, FileReadState>;
    /**
     * 执行世界 fs 缝:工具的一切文件系统副作用经此面(缺省
     * defaultFs = node:fs/promises 直通薄壳,行为与直用逐字节一致)。可选——
     * 直调/最小执行器缺省时工具以 fsOf(ctx) 落缺省世界;调度器恒注入。
     * 权限判定不经此面(gate.decide 恒先于工具 execute,红线 3)。
     */
    fs?: FsLike;
    /**
     * 本次调用的 toolCallId(contract-v0.1 增补):由调度器注入,
     * 工具据此构造 tool.progress / tool.output.delta 负载。可选——直调场景可缺省。
     */
    toolCallId?: string;
    /**
     * 检索轮次聚合器:调度器会话级注入,Grep 工具
     * 逐调用记样本;可选——直调场景可缺省,埋点静默不记。
     */
    searchAggregator?: GrepRoundAggregator;
    /**
     * 当前查询消息的快照 getter:调度器从 ToolExecutionContext
     * 透传;Task 工具在派生时点调用一次,冻结「父上下文快照」作派生裁决链
     * 的裁决语境。可选——直调/最小执行器缺省时
     * 裁决链静默不可用(escalate 语义不受影响,只是无从起裁决查询)。
     */
    transcript?: () => readonly IRMessage[];
    /**
     * 本执行器的裁决人链(递归上升):子代理执行器在场时
     * 由调度器注入([直接父, 祖父, …] 由近及远,各级持自己的派生时点快照)。
     * Task 工具派生下一级时以 [本级新裁决器, ...本链] 延长——孙的 ask 经
     * 子→主逐级上升。主执行器恒缺省(子链即单级)。
     */
    adjudicationAncestors?: readonly ParentAdjudicator[];
    /**
     * 记忆写上下文:门开时调度器自
     * 执行器选项透传——Write/Edit 据此触发真实目标含入复核、写前秘密扫描
     * 与索引写后体检。缺省 = 门关,工具行为与现状逐字节一致。
     */
    memoryWrite?: MemoryWriteContext;
}
/** 工具结果的单个内容块:文本,或 base64 编码的图片。 */
type ToolResultContent = {
    t: 'text';
    text: string;
} | {
    t: 'image';
    mime: string;
    data: string;
};
/** 工具执行结果:回给模型的内容块、业务级失败标记与给表面层渲染器的结构化数据。 */
interface ToolResult {
    /** 回给模型的内容 */
    content: ToolResultContent[];
    isError?: boolean;
    /** 给表面层渲染器的结构化数据(按工具名注册渲染,不含 ANSI/UI 逻辑) */
    data?: unknown;
}
/** 工具效应词表(应用协议 v1;冻结四值——「批量」是调用属性由参数判,不入表) */
declare const TOOL_EFFECTS: readonly ["irreversible", "financial", "external", "affects-others"];
type ToolEffect = (typeof TOOL_EFFECTS)[number];
/**
 * 工具定义:名称、模型可见描述、zod 参数 schema、只读 / 并发安全等静态声明与 execute 实现。
 * 工具只产出结构化数据,渲染归表面层;权限判定由调度器在 execute 之前完成。
 */
interface Tool<Args = unknown> {
    /** 唯一名(进模型 prompt 与权限规则,如 "Read"/"Shell") */
    name: string;
    /** 模型可见描述(英文) */
    description: string;
    /**
     * 模型可见短态描述(英文;一句话 + 参数签名要点)。可选
     * 资产位:装配层分段预算分配器(cli assembly/section-budget.ts)在工具
     * 段预算压力下以短态替换 description 进请求;缺席/门关恒用 description
     * (请求字节与现状逐字节一致)。执行语义与本字段无关。
     */
    shortDescription?: string;
    /** 参数 schema(zod;经 zod-to-json-schema 或手写 JSON Schema 暴露给模型由网关层处理) */
    inputSchema: z.ZodType<Args>;
    /** 只读工具可并发、可在 plan 模式放行(声明即契约,调度器强制) */
    isReadOnly: boolean;
    /**
     * 效应声明(应用协议 v1):开发者对本工具副作用性质的
     * 自述——`irreversible`(不可逆)/ `financial`(资金流动)/ `external`
     * (触达外部系统或第三方)/ `affects-others`(影响其他用户或租户)。
     * **信号不是闸门**:只进裁决人语境(`<tool>` 段)与遥测标签,不参与任何
     * 确定性判定,半径面(F9)定义与本位无关——误报漏报只影响裁决质量,不
     * 制造放行路径。缺席 = 未声明(语境渲染 "(none declared)")。
     */
    effects?: readonly ToolEffect[];
    /** 并发安全(false 的工具调度器串行执行) */
    isConcurrencySafe: boolean;
    /**
     * Q4-24 — 同名自并发组上限(可选):≥2 时,本工具的多个调用可**彼此**
     * 并发(上限 = 本值,超出按输入序 FIFO 排队),与其他一切工具仍互斥
     * (组员启动前排空非组员 in-flight,非组员启动前排空组;「写工具执行
     * 期间父侧无并发读写」的既有保证只在组内松动)。缺席/1/非法值 = 现状
     * 独占串行,调度语义字节零漂移。仅对非 (isReadOnly && isConcurrencySafe)
     * 的工具有意义(并发读路径不消费本位)。当前唯一消费方:Task(方案键
     * taskConcurrency ≥2 时经 TaskToolConfig.concurrency 注入;子代理彼此
     * 隔离——独立 executor/registry/fileReadState,归属由 agent.* 与 cost 事件
     * 的 agentId/toolUseId 键控判别,不依赖「一次一飞」顺序假设)。
     * Q4-24b:本位允许以 getter 落位(Task 函数配置)——调度器在每次调用
     * 评估时点读取,方案热更新即时生效;静态数字声明语义不变。
     */
    selfConcurrency?: number;
    /**
     * 每调用硬超时覆盖(毫秒;缺省用调度器统一值 120s)。
     * POSITIVE_INFINITY = 免硬超时——仅限以用户注意力为界的交互工具
     * (AskUser:与权限询问同语义,等多久由用户定),取消链仍可随时终止。
     */
    timeoutMs?: number;
    /**
     * Q4-13 提权声明位:true = 本工具的调用可携带 `escalate: true` 请求
     * 沙箱旁路提权(当前仅 Shell)。调度器据此对提权请求实施「同轮一次性
     * 计数」与「gate 放行 → ask」兜底升档(permissions/escalation.ts 单一
     * 事实源;红线 4:提权绝不静默放行)。缺省 undefined = 不参与提权语义。
     */
    supportsEscalation?: boolean;
    /**
     * 文件写改声明位(OPT-13,doc/07 §4.8⑥):返回本次调用将改写的文件
     * 绝对路径集,调度器据此在执行前采集 pre-image(file_checkpoint)。
     * 约定:args 畸形或路径非法时返回 [](工具执行时自会报错);只声明
     * 确定性可知的目标(Shell 等副作用不可静态预知的工具不声明)。
     */
    mutatedPathsOf?(args: unknown): string[];
    /**
     * 文件读取触达声明位(与 mutatedPathsOf 同构的只读侧):返回
     * 本次调用将读取的文件绝对路径集。调度器在调用**成功**后采集(与
     * mutatedPathsOf 合并)进 ToolExecutionOutcome.touchedFiles,作查询环
     * 压缩后文件重建的触达台账数据源。约定同 mutatedPathsOf:args 畸形或
     * 路径非法返回 [];只声明确定性可知的单文件目标(Glob/Grep 等结果集
     * 不定的工具不声明)。
     */
    touchedPathsOf?(args: unknown): string[];
    execute(args: Args, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * 会话待办台账(内存态,不做持久化)。
 *
 * 设计要点:
 * - `TodoItem` 形状与 protocol `plan.todo.updated` 事件的 items 对齐
 *   (id/content/status 三字段;status 在事件侧是宽松 string,本侧收窄为枚举);
 * - 依赖注入:`onChange` 由工厂(内核会话装配处)注入,store 本身不发事件、
 *   不落盘——外部在回调里接线 `plan.todo.updated` 事件与(未来的)持久化;
 * - 所有对外暴露的数组/对象均为副本,防止调用方或回调持引用后污染内部状态。
 */
/** 待办状态全集(as const 元组,供 zod enum 与类型共用一份事实源) */
declare const TODO_STATUSES: readonly ["pending", "in_progress", "completed", "cancelled"];
type TodoStatus = (typeof TODO_STATUSES)[number];
interface TodoItem {
    id: string;
    content: string;
    status: TodoStatus;
}
/**
 * merge 输入:按 id 定位,已知 id 只覆盖给定字段(未给字段保留原值);
 * 未知 id 追加为新项,此时 content 与 status 必须齐全(TodoWrite 工具
 * 的 schema 恒为全量,不会触发缺字段路径;此约束仅防御其他内部调用方)。
 */
type TodoPatch = {
    id: string;
} & Partial<Omit<TodoItem, 'id'>>;
interface TodoStoreOptions {
    /** 变更回调:replace/merge 每次调用后触发一次,载荷为变更后完整列表的独立副本 */
    onChange?: (items: TodoItem[]) => void;
}
declare class TodoStore {
    #private;
    constructor(options?: TodoStoreOptions);
    /** 当前列表(副本;修改返回值不影响内部状态) */
    list(): TodoItem[];
    /** 全量替换(含替换为空 = 清空台账),返回变更后快照 */
    replace(items: readonly TodoItem[]): TodoItem[];
    /**
     * 按 id 合并:已知 id 原位覆盖给定字段;未知 id 按提交顺序追加到尾部。
     * 返回变更后快照。未知 id 缺 content/status 视为调用方契约错误,抛 TypeError。
     */
    merge(patches: readonly TodoPatch[]): TodoItem[];
}

/** 会话级输入的目标绑定:历史纪元 + 当前轮句柄,二者皆须与宿主现状一致。 */
interface SessionInputTarget {
    readonly historyEpoch: string;
    readonly turnId: string;
}
/** 会话级输入内容:纯文本,或仅含 text 块的块数组(图片等不受理)。 */
type SessionInputContent = {
    readonly text: string;
} | {
    readonly blocks: readonly {
        readonly t: 'text';
        readonly text: string;
    }[];
};
/** 一次会话级输入提交:幂等 inputId、目标绑定、内容与期望的确认级别。 */
interface SessionInputSubmission {
    readonly inputId: string;
    readonly target: SessionInputTarget;
    readonly content: SessionInputContent;
    readonly ack?: 'memory' | 'durable';
}
/** 会话级输入凭据:在查询输入凭据之上附会话 id、历史纪元与耐久性级别(仅 memory)。 */
interface SessionInputReceipt extends QueryInputReceipt {
    readonly sessionId: string;
    readonly historyEpoch: string;
    readonly durability: 'memory';
}
/** 会话级输入的拒绝码:查询层拒绝码之外增纪元不符、不支持的确认级别 / 内容 / 输入形态。 */
type SessionInputRejectCode = QueryInputRejectCode | 'epoch_mismatch' | 'durable_unsupported' | 'content_unsupported' | 'input_unsupported';
/** 会话级输入提交的结果:accepted 携凭据;closed / rejected 携拒绝码。 */
type SessionInputResult = {
    readonly outcome: 'accepted';
    readonly receipt: SessionInputReceipt;
} | {
    readonly outcome: 'closed' | 'rejected';
    readonly code: SessionInputRejectCode;
};
/** 会话级输入能力声明:宿主据此得知受理的内容形态、确认级别、凭据保留窗口与当前目标。 */
interface SessionInputCapabilities {
    readonly version: 1;
    readonly text: boolean;
    readonly textBlocks: boolean;
    readonly image: false;
    readonly memoryAck: boolean;
    readonly durableAck: false;
    readonly receiptRetention: 'current-and-last-turn';
    readonly target: SessionInputTarget | null;
}

/**
 * 测试用顺序工具执行器(ToolExecutor 的最小实现)。
 *
 * 定位:给查询环测试与早期集成提供确定性执行器;不做并发/权限/超时,
 * 那些是调度器的职责。按输入序逐个执行,产出 tool.started /
 * tool.completed / tool.failed 事件,并以严格输入序回填 tool_result。
 */

interface SequentialToolResult {
    content: IRToolContent[];
    isError?: boolean;
    /** 结构化渲染数据(contract-v0.3:随 tool.completed 透传;可缺省) */
    data?: unknown;
}
/** 顺序执行器的单工具处理函数:收参数与执行上下文,返回文本 / 错误 / 结构化数据结果。 */
type SequentialToolHandler = (args: unknown, ctx: ToolExecutionContext) => SequentialToolResult | Promise<SequentialToolResult>;
/** 测试与早期集成用的确定性工具执行器:按输入序逐个执行,不做并发 / 权限 / 超时。 */
declare class SequentialToolExecutor implements ToolExecutor {
    #private;
    constructor(handlers: Map<string, SequentialToolHandler> | Record<string, SequentialToolHandler>);
    execute(calls: ProposedToolCall[], ctx: ToolExecutionContext): AsyncGenerator<ToolExecutorYield, ToolExecutionOutcome, undefined>;
}

/**
 * PolicyBundle 数据结构与解析(集中策略分发接缝)。
 *
 * 设计依据:
 * - doc/06 §5 接缝③:权限引擎的 policy 规则源与 PolicyBundle 数据结构
 *   (含签名验证字段)一期定义——本期只落数据结构/装载/验证接缝,
 *   不做网络分发与真实验签(装载见 rule-source.ts,验证见 verify.ts);
 * - doc/06 §3.3:预留 policy 规则源,优先级最高(对应引擎层模型的
 *   policy 层,即配置五层中的 managed 层,见 config/permissions.ts 映射)。
 *
 * 为什么不进 protocol 包:bundle 是内核内部/企业面结构,尚未冻结;
 * protocol 已打 contract-v0 tag,变更须走 RFC。若二期确认 bundle 需跨
 * 表面层/SDK 消费,再按 RFC 升入契约(草案见任务报告)。
 *
 * 校验姿势:全对象 strict(未知键即拒绝)——bundle 是机器分发的策略
 * 工件,未知键宁可整体拒绝装载也不静默剥离(fail-closed;与用户手写
 * 配置的 strip+告警语义刻意不同,后者容错优先)。
 */

declare const PolicyBundleSchema: z.ZodObject<{
    meta: z.ZodObject<{
        /** bundle 全局唯一标识(引擎装载按 id 去重) */
        id: z.ZodString;
        /** 版本令牌(语义由签发方定义;引擎只记录,不比较新旧) */
        version: z.ZodString;
        /** 签发时刻,ISO-8601 且须带 Z 或时区偏移(如 2026-07-24T00:00:00Z) */
        issuedAt: z.ZodString;
        /** 签发方标识(企业/组织名或其内部标识符) */
        issuer: z.ZodString;
        /** 目标受众标识(企业/组织/机群;managed 锚声明 audience 时精确比对) */
        audience: z.ZodOptional<z.ZodString>;
        /**
         * 前向回滚单调序号(05 §15 v2.3:撤回坏策略 = 更高 sequence 重签发旧
         * 内容;客户端拒绝激活低于本地 high-water 的束)。**缺席视为 0**:
         * 旧格式束参与比较而非豁免——若「无 sequence 即不参与 high-water」,
         * 删掉该字段就能绕过回滚保护,fail-closed 方向是取最低值参与。
         */
        sequence: z.ZodOptional<z.ZodNumber>;
        /** 生效窗起点(含);缺席 = 即刻生效 */
        notBefore: z.ZodOptional<z.ZodString>;
        /** 过期时刻(不含);缺席 = 永不过期。过期处置见装载状态机(LKG/冻结) */
        expiresAt: z.ZodOptional<z.ZodString>;
        /**
         * 撤销声明:同 id 束的已撤销 sequence 列表(累积吸收进本地状态,
         * 被撤序号不得再激活/回落)。与 high-water 单调有重叠(高序重签发
         * 天然压制低序),独立价值在离线跳版场景:客户端从未见过撤销版本的
         * 后继时,名单仍能阻止 LKG 回落到被撤序号(防御纵深)。
         */
        revokedSequences: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        version: string;
        issuedAt: string;
        issuer: string;
        expiresAt?: string | undefined;
        sequence?: number | undefined;
        audience?: string | undefined;
        notBefore?: string | undefined;
        revokedSequences?: number[] | undefined;
    }, {
        id: string;
        version: string;
        issuedAt: string;
        issuer: string;
        expiresAt?: string | undefined;
        sequence?: number | undefined;
        audience?: string | undefined;
        notBefore?: string | undefined;
        revokedSequences?: number[] | undefined;
    }>;
    rules: z.ZodObject<{
        allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ask: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    }>;
    signature: z.ZodOptional<z.ZodObject<{
        /** 签名算法标识(如 'ed25519';验签按 alg 精确分发) */
        alg: z.ZodString;
        /** 验签公钥标识(支撑密钥轮换与多密钥并行分发) */
        keyId: z.ZodString;
        /** 签名值(编码约定由算法定义,通常 base64;验签器自行解码) */
        value: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        value: string;
        alg: string;
        keyId: string;
    }, {
        value: string;
        alg: string;
        keyId: string;
    }>>;
}, "strict", z.ZodTypeAny, {
    meta: {
        id: string;
        version: string;
        issuedAt: string;
        issuer: string;
        expiresAt?: string | undefined;
        sequence?: number | undefined;
        audience?: string | undefined;
        notBefore?: string | undefined;
        revokedSequences?: number[] | undefined;
    };
    rules: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    };
    signature?: {
        value: string;
        alg: string;
        keyId: string;
    } | undefined;
}, {
    meta: {
        id: string;
        version: string;
        issuedAt: string;
        issuer: string;
        expiresAt?: string | undefined;
        sequence?: number | undefined;
        audience?: string | undefined;
        notBefore?: string | undefined;
        revokedSequences?: number[] | undefined;
    };
    rules: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    };
    signature?: {
        value: string;
        alg: string;
        keyId: string;
    } | undefined;
}>;
type PolicyBundle = z.infer<typeof PolicyBundleSchema>;

/**
 * PolicyBundle 签名验证接缝(桩语义;接口形状按真实验签设计)。
 *
 * 语义(doc/06 §5 接缝③;OPT-11 起验签接通):
 * - 无签名:默认 unverified 直通;unsignedPolicy='reject' 时拒绝
 *   (企业模式可据此配置「只接受签名策略」);
 * - 有签名:按 signature.alg 在注入的验签器表中精确分发;不注入验签器时
 *   签名 bundle 恒返回 unsupported(附 alg/keyId 与原因)。OPT-11 提供
 *   ed25519 内置实现(verify-ed25519.ts),信任材料(公钥表)仍由装配层
 *   注入——本模块与引擎保持零信任材料状态。
 *
 * fail-closed:验签器判 false 或抛错均 rejected,永不降级放行。
 */

/** 验证结论四值 */
type BundleVerification = 'verified' | 'unverified' | 'unsupported' | 'rejected';
type VerifyReason = 
/** 无签名(unverified 直通时也回带,便于审计区分「验过」与「免验」) */
'unsigned'
/** 无签名且策略要求签名 */
 | 'unsigned_rejected'
/** 无验签器可处理该算法(本期签名 bundle 恒走此路) */
 | 'alg_unsupported'
/** 验签器判定签名不匹配 */
 | 'signature_invalid'
/** 验签器抛错(按无效处理,fail-closed) */
 | 'verifier_error';
interface VerifyResult {
    status: BundleVerification;
    /** status='verified' 时无原因码,其余各值均回带 */
    reason?: VerifyReason;
    /** 签名存在时回带 alg/keyId,供审计与排障归因 */
    alg?: string;
    keyId?: string;
}
/** 单算法验签器(二期实现位:ed25519/RSA-PSS/… 按 alg 各注册一个) */
interface BundleSignatureVerifier {
    /** 算法标识,与 signature.alg 精确匹配 */
    readonly alg: string;
    /**
     * 验签:payload 为待验字节(signaturePayload 的 UTF-8 编码);keyId 供
     * 实现方解析公钥(轮换分发);value 为 signature.value 原文(解码策略由
     * 算法定义)。返回 true=有效,false=不匹配;抛错按 verifier_error 处理。
     */
    verify(input: {
        payload: Uint8Array;
        keyId: string;
        value: string;
    }): boolean;
}
interface VerifyBundleOptions {
    /** 无签名 bundle 的处置:缺省 'accept'(unverified 直通) */
    unsignedPolicy?: 'accept' | 'reject';
    /** 验签器表(按 alg 分发);缺省为空(签名 bundle 一律 unsupported) */
    verifiers?: readonly BundleSignatureVerifier[];
}

/**
 * 权限引擎:判定管线 + 会话决策缓存 + 审计事件体构造。
 *
 * 判定管线(严格度降序,最严格者胜):
 *   0. hard-safety 层(绝对禁止面,hard-safety.ts):秘密外发组合
 *      谓词(secret.access + network.egress 同调用)与审计篡改/删除——先于
 *      deny 规则与 bypass,任何 allow/auto/bypass/分类器 safe/审批凭证不可
 *      中和(INV-2,§8.5 优先级格最高位);内置子集恒启用(不随基线开关);
 *   1. deny 规则(含用户会话缓存的 deny)——永远最高;
 *   2. plan 模式对非只读工具 deny(模式 deny 强于 ask 规则);
 *   2.5 受信层 ask 规则(policy/user;位于 bypass 之前,「显式 ask
 *      bypass 不可越」,INV-3):显式审批义务在 bypass 下照常询问(无人入口
 *      下游降 deny);auto 下分类器对显式配置 ask 只可收紧不可软化;**项目层
 *      ask 延后至 §4.9**(INV-4:仓库字节 ask 收紧向,不得遮蔽基线 deny);
 *   3. bypassPermissions 放行(仅当目标可安全解析;不可解析时 deny 规则
 *      无从验证,保守降级为 ask);灾难基线(rm -rf / 族、
 *      mkfs、dd 直写设备)不随 bypass 直通——转 ask(TUI 确认;无人入口由
 *      下游降 deny),归因 'builtin' + 灾难规则 raw,配置 allow 不可中和;
 *      随基线开关解除(灾难基线有 break-glass,与 hard-safety 恒 deny 分级);
 *   4.5 内置安全基线 deny(OPT-04,baseline.ts):压过其后一切放行,但让位于
 *      配置 deny/ask 与 bypass;任一配置层显式 allow 命中即跳过(会话缓存
 *      allow 不算);基线例外命中只中和 deny,继续走后续管线;
 *   4.7 protected paths 强制 ask(protected-paths.ts):Write/Edit 落
 *      `.git`/`.tansr` 任一路径段或家目录 shell rc / git 配置 → ask
 *      (source='builtin',matchedRule=`protected-path(...)`)——快路径、
 *      allow 规则、会话缓存全部压不过;auto 下该 ask 照常进分类器终裁;
 *      与基线同开关;
 *   4.8 会话污点收紧(跨调用窄实现):同会话读过秘密面后,
 *      egress/publish 动作恒 ask(压过快路径/allow/缓存,分类器不软化);
 *   4.9 项目层 ask 收紧叠加(INV-4):projectLocal/projectShared 的 ask
 *      在基线/deny/保护面/污点之后求值——只把本应放行降为 ask,绝不遮蔽
 *      deny(仓库字节永不把基线 deny 松成可批准 ask);bypass 下不生效;
 *   4.93 TMEM/3 批β P2-5 治理簿记内栅(doc/79 §二 M1-8):carve-out 目录
 *      顶层的治理簿记文件(名单事实源 tools/files/memory-health.ts:
 *      pending-invites.json/lock/consolidation.json/origin.json)Write/Edit
 *      恒不免询问——降 ask(source='builtin',matchedRule=
 *      `memory-bookkeeping(<名>)`);先于 4.95 压过 carve-out 与第 5 段
 *      快路径;fork/子代理执行器无询问通道即落 deny;pending-anchors.md
 *      刻意不入栅(/pin 与 promote 通道);缺省(无 carve-out 缝)零行为;
 *   4.95 TMEM/1 记忆写 carve-out(doc/38 §4.2 写回-1②):门开时注入的
 *      记忆目录内 Write/Edit → 具名放行 memory_carve_out;一切显式收紧
 *      (deny/ask 规则、基线、保护面、污点)先行;秘密面文件名(无锚
 *      matchesSecretFace)不入 carve-out(维持兜底 ask);缺省零行为;
 *   5. plan 只读放行 / acceptEdits 与 auto 的工作区快路径(A 档对齐,
 *      workspace-fast-path.ts):工作区内 Write/Edit 与文件系统命令自动放行,
 *      auto 另放行工作区内只读路径工具;不命中快路径落后续管线,绝不产 deny;
 *   6. allow 规则(保守匹配;Shell 要求每一段至少被某条 allow 覆盖);
 *      **auto 模式丢弃宽 allow 规则**(broad-allow.ts):授予任意代码
 *      执行的规则(`Shell`/`Shell(*)`/`Shell(bash *)` 类)求值期过滤,
 *      窄规则保留;基线 4.5 段的配置 allow 中和与第 7 段会话缓存同口径;
 *   7. 用户会话缓存 allow(auto 下同样过滤宽规则);
 *   7.5 R0 内建只读放行(read-only-commands.ts):模式无关的结构
 *      放行,替代原兜底 ask——①Shell 只读命令集(git status/rg/ls 类,
 *      全套守卫 + 秘密探针:内容读取实参命中基线秘密面产 deny,与
 *      Read .env 同权;搜索实参命中/探针候选不可解析则回落 ask);
 *      ②isReadOnly 路径工具(Read/Glob/Grep/List)目标规范可解析(非
 *      UNC)**且在工作区内**即免询(工作区外读维持兜底 ask,与 7.5②
 *      正文 pathInsideRoot 一致)。位于规则/缓存之后:用户显式 allow 的归因优先
 *      (放行结果同向,先后无安全差);deny/ask 规则、基线、保护面、
 *      污点恒在其前。归因 source='builtin'、matchedRule=`read-only(...)`;
 *      plan 在第 2 段对完整 R0 资格(结构 + 探针全过)豁免非只读 deny,
 *      放行仍走第 5 段 plan 出口(归因 mode,plan 语义不变);
 *   8. 兜底 ask。
 *   8.5 Shell 提权升档(Q4-13,escalation.ts):Shell 调用带 escalate:true
 *      (模型对 isolation_denied 失败的显式提权重试)时,管线 0-8 放行
 *      (allow)出口升档为 ask(归因 'builtin' + escalation(sandbox-bypass))
 *      ——本来静默放行(快路径/allow 规则/缓存/R0)的改为触发人审询问,
 *      提权绝不静默放行(红线 4);deny/ask 出口原样(deny 恒不可越);
 *      分类器软化面豁免(consultClassifier,可收紧不可软化);
 *   9. dontAsk 终裁变换(contract-v0.8,RFC-OPT18-1):管线产出 ask 时一律
 *      降 deny——「headless 无询问通道时调度器把 ask 降 deny」这一 fail-closed
 *      语义的一等模式化(两者叠加不冲突:引擎已产 deny,调度器降级分支不再
 *      触达)。归因 source='mode',matchedRule 保留(命中的 ask 规则是本次
 *      拒绝的诱因);deny/allow 出口原样,基线与 deny 规则语义不变。
 *
 * auto 模式(contract-v0.8 起):= default
 * + 管线第 5 段工作区快路径 + 第 6/7 段宽 allow 丢弃 + would-ask 的分类器
 * 终裁(consultClassifier 异步缝,块单姿态 + 熔断语义见该方法注释)。
 * 分类器未注入时残余 would-ask 维持 ask(交询问面)。
 *
 * 规则层合并:不在层内先算结果再合并,而是按严格度分阶段跨层扫描
 * (所有层的 deny → 所有层的 ask → 所有层的 allow),天然等价于最严格者胜;
 * 层优先级只决定命中归因顺序(policy 层命中 source='policy',余 'rule')。
 *
 * 引擎零 IO、无 UI:询问由调度器执行,用户选择"本会话总是允许"后
 * 经 recordUserDecision() 回写缓存,后续命中 source='user'。
 */

/** 单 bundle 装载结果(status='skipped' 时 reason 必有) */
interface PolicyBundleLoadOutcome {
    bundleId: string;
    status: 'loaded' | 'skipped';
    reason?: 'verify_rejected' | 'verify_unsupported' | 'duplicate_id';
    /** 装载期验证结论(含 alg/keyId 归因,见 verify.ts) */
    verification: VerifyResult;
    /** bundle 内 DSL 不可解析而被忽略的规则条数(与配置层同语义:忽略但可观测) */
    invalidRuleCount: number;
}
/** 已装载 bundle 清单条目(getLoadedPolicyBundles 查询用) */
interface LoadedPolicyBundleRecord {
    id: string;
    version: string;
    issuer: string;
    issuedAt: string;
    /** 装载期验证结论(本期取值恒为 unverified;二期验签落地后可为 verified) */
    verification: BundleVerification;
    /** 实际注入 policy 层的规则条数(不含 DSL 不可解析被忽略者) */
    ruleCounts: {
        allow: number;
        deny: number;
        ask: number;
    };
    /** 来源标识(装载方传入,如本地策略目录路径;缺省不落键) */
    source?: string;
    /** 生命周期元数据透出(T-K19b 面板;束未声明即不落键) */
    sequence?: number;
    notBefore?: string;
    expiresAt?: string;
}
interface LoadPolicyBundlesOptions {
    /** 签名验证选项(透传 verifyBundle;缺省:无签名 unverified 直通) */
    verify?: VerifyBundleOptions;
    /** 来源标识,记入已装载清单供归因(如 'localDir:<path>') */
    source?: string;
}
declare class PermissionEngine {
    private mode;
    private readonly ruleSets;
    /** 规则编译结果按 cwd 缓存(路径模式的相对锚定依赖 cwd) */
    private readonly compiledByCwd;
    private readonly sessionCache;
    /** 已装载 PolicyBundle 清单(装载可观测性的事实源) */
    private readonly loadedBundles;
    /** 内置安全基线(OPT-04;关闭时两组皆空,判定段整体短路) */
    private readonly baselineDeny;
    private readonly baselineExceptions;
    /** 灾难基线(与基线同开关):bypass 分支单独匹配,命中转 ask */
    private readonly disasterBaselineDeny;
    /** protected paths(与基线同开关;家目录不可规范解析时仅剩段保护) */
    private readonly protectedPathsEnabled;
    private readonly homeCanonical;
    /** TMEM/1 carve-out(4.95 段):canonical + 大小写折叠后的记忆目录集;空集 = 缝不在场 */
    private readonly memoryCarveOutDirs;
    private readonly memoryCarveOutCaseInsensitive;
    /** hard-safety 追加面(内置子集恒启用,本配置只追加 egress/审计目录) */
    private readonly hardSafetyConfig;
    /** 会话污点(跨调用窄实现):秘密面被读取后置真,egress/publish 恒 ask */
    private secretTainted;
    /** LLM 权限分类器(OPT-18;缺省不注入 = 无分类器路径) */
    private readonly classifierConfig;
    /** 分类器熔断状态(3 连拒 30min 冷却 / 会话累计 20 拒停用) */
    private classifierDenyTotal;
    private classifierDenyStreak;
    private classifierBreakerUntil;
    /** 累计跳闸次数(K19f 指标口;人工复位不清零——历史是历史) */
    private classifierTripCount;
    /** 分类器咨询预算记账(计实际模型咨询;耗尽后直通 ask) */
    private classifierConsultCount;
    private classifierBudgetNotified;
    /** 分类器窄缓存(仅只读输入的 safe 裁定;键全字段) */
    private readonly classifierCache;
    private classifierCacheHits;
    private classifierCacheMisses;
    constructor(config?: PermissionEngineConfig);
    getMode(): PermissionMode;
    setMode(mode: PermissionMode): void;
    /**
     * 调度器在用户选择"本会话总是允许/拒绝"后回写。
     * rule 为 DSL 形态(如 `Shell(git *)`);cwd 用于路径模式锚定。
     * 非法规则静默忽略(调度器侧应先校验)。
     */
    recordUserDecision(rule: string, behavior: RuleBehavior, cwd: string): void;
    /**
     * 按规则原文移除会话层 allow 缓存(P1-11:/grants revoke 即时生效——
     * 授权经 recordUserDecision 注入会话层,撤销必须同会话拔除,不能等重启)。
     * 只移除 allow(deny 是用户收紧,撤销授权不得顺手放松);返回移除条数。
     */
    revokeUserDecision(rule: string): number;
    /**
     * 装载 PolicyBundle 规则集为 policy 层规则(集中策略分发接缝)。
     *
     * - 验证不通过(rejected/unsupported)或 meta.id 已装载过的 bundle
     *   整体跳过,返回值携带原因(装载可观测性);
     * - 装入的规则参与既有跨层扫描:layer='policy' → 归因 source='policy',
     *   合并语义与构造期 layers.policy 完全一致(最严格者胜,层级只影响
     *   归因;插入位置见 insertPolicyRule 的层序不变量);
     * - DSL 不可解析的规则忽略并计数(与 collectRules 同语义,不猜测语义);
     * - 不装载任何 bundle 时引擎行为与从前逐字节一致(只增不改)。
     */
    loadPolicyBundles(bundles: readonly PolicyBundle[], options?: LoadPolicyBundlesOptions): PolicyBundleLoadOutcome[];
    /** 已装载 bundle 清单(防御性拷贝;装载可观测性查询口) */
    getLoadedPolicyBundles(): LoadedPolicyBundleRecord[];
    /** 纯判定:不发事件、不询问,产出结构化决策供调度器消费 */
    decide(input: DecideInput): PermissionDecisionResult;
    /** 管线 0–8 段(default 语义的公共主体;dontAsk 的第 9 段变换在 decide) */
    private decideBase;
    /** 管线 1–8 段(第 0 段 hard-safety 由 decideBase 包裹) */
    private decideStages;
    /**
     * R0 Shell 只读判定(管线 7.5 段与 plan 豁免共用)。返回:
     * - allow(source='builtin',matchedRule=`read-only(<段标签>)`):结构
     *   入围且探针全过;
     * - deny(source='builtin',matchedRule=`read-only-probe(<实参>)`):结构
     *   入围但**内容读取类**实参命中基线秘密面——`cat .env` 与 `Read .env`
     *   同权被拦(探针复用 matchBaseline 的 Read 探身口径,与快路径守卫
     *   同源:含基线例外中和、配置 allow 中和、基线开关/整体替换语义);
     * - null:不入围 / 搜索类实参命中秘密面 / 探针候选不可规范解析或出
     *   工作区(红线级包含纪律:内容/搜索面不得静默越界)——回落原判定链
     *   (兜底 ask),绝不因守卫产 deny。
     */
    private readOnlyShellVerdict;
    /**
     * 秘密探针(R0 内容/搜索面实参):
     * - 'blocked':不可规范解析(UNC、ADS 冒号、DOS 短名 `~N`、控制字符)
     *   或解析后出工作区——调用方整条回落原链(fail-to-ask,不猜测语义;
     *   工作区包含与路径工具 R0 同一红线纪律);
     * - 'secret':命中基线秘密面(Read 探身走 matchBaseline,口径与
     *   FastPathGuard.isProtectedContentPath 一致——含例外/配置 allow 中和,
     *   基线关闭或整体替换时随之放行/改判,用户显式决策优先);
     * - 'clean':可安全放行的实参。
     */
    private probeSecretArg;
    /** 工作区根的规范形(R0 包含判定用;cwd 不可规范解析时返回 null = 不放行) */
    private workspaceRoot;
    /**
     * LLM 分类器终裁口(contract-v0.8 auto 模式起):
     * - base 非 ask 或未注入分类器 → **同步**原样返回(零开销直通,调用方的
     *   同步快路径不受影响;auto 未注入分类器时,快路径外的输入与 default
     *   逐字节一致——工作区快路径本身在 decide 内,不依赖分类器);
     * - **auto-only 缺省**:非 auto 模式同步直通 ask——询问面本就有
     *   人裁,不花模型钱;`tightenOutsideAuto=true` 才咨询,且只收紧
     *   (softenToAllow 非 auto 恒 false,safe 维持 ask);
     * - **窄缓存**:只读输入的 safe 裁定按全字段键复用
     *   (免咨询;资格守卫仍每次现算);写改类输入不查不存;
     * - **调用预算**:实际模型咨询计数达 callBudget(缺省 200)后
     *   同步直通 ask(超限改询问;onBudgetExhausted 单次上报);
     * - **熔断先行**:分类器 reject 连续 3 次 → 30min
     *   冷却(期满自动复位,连拒计数清零);会话累计 20 次 → 本会话停用。
     *   记账按裁决人 reject 计,与 rejectEffect 落地形无关(doc/113)。熔断
     *   期间同步原样返回 ask(交回询问面;headless 按既有语义降 deny)。
     *   跳闸时经 config.onBreakerTrip 单次上报(内核零 IO);任何非 reject 的
     *   咨询终局(safe/unsure/超时/抛错)都会清零连拒计数——期间用户注意力
     *   已经或即将介入;人工恢复口见 resetClassifierBreaker
     *   (「批准即恢复」:两档皆复位,仅交互面用户显式批准后可调);
     * - base 为 ask 且注入了分类器 → 异步咨询:
     *   · `unsafe` → 收紧,source 记 'classifier'(RFC-OPT18-3 专属审计归因),
     *     matchedRule 保留,**reason 携带分类器理由**;落地形按
     *     config.rejectEffect(doc/113 §二):缺省 'deny'(deny-and-continue:
     *     调度器并入 isError tool_result 回喂模型),'ask' 升到询问面交用户
     *     终审(询问面缺席由调度器地板降 deny)——收紧在**一切模式**下生效
     *     (OPT-18 既有机制语义不变);
     *   · `safe` → 仅 auto 模式(RFC-OPT18-1)且**生效资格档半径覆盖该调用
     *     面**时(SOFTEN_RADIUS[resolveTier()][face],档位
     *     解析闭包每次咨询现算)放行为 allow,source 记 'classifier',reason
     *     同携带;且须通过与模式放行同级的资格守卫(目标可解析、路径非
     *     UNC、内置基线复查不命中——ask 规则命中时管线 4.5 段未评估,
     *     分类器放行不得成为基线旁路),任一守卫不过即维持 ask。
     *     非 auto 模式 safe 恒维持 ask(**分类器绝不放行**的既有铁律只对 auto
     *     松动,且 deny 规则/基线永不受软化——deny 路径根本不进本方法);
     *   · `unsure`/超时/抛错 → 维持 ask 原样(fail-degrade,不改变既有语义)。
     * - Shell 工具附命令结构树(command-structure.ts);注入了 transcript
     *   提供器且切片非空时附当前轮用户请求(注入防御语义见 classifier.ts)。
     * - 模式在咨询发起时定格(异步窗口内 setMode 不追溯本次终裁)。
     */
    consultClassifier(input: DecideInput, base: PermissionDecisionResult): PermissionDecisionResult | Promise<PermissionDecisionResult>;
    /**
     * 共享咨询预算消耗口:权限分类器与派生裁决查询
     * **共用同一预算池**(callBudget 上限 + 同一计数器)——两类模型咨询
     * 合计不超预算,避免两个口子各自失控。false = 预算耗尽(调用方按各自
     * 方向安全语义降级:分类器直通 ask,裁决查询结构性 escalate);耗尽
     * 通知单次上报(与分类器路径同一 notified 位)。未注入分类器的会话
     * 用缺省预算(裁决查询仍受约束,不因分类器缺席而不限)。
     */
    tryConsumeSharedConsult(): boolean;
    /**
     * 生效资格档解析:解析闭包在场即**现算**(装配层合成
     * min(entry, ceiling, override);闭包抛错 → 'none',词表外脏值由
     * softenRadiusAllows 安全查表兜底——一切异常朝严);闭包缺席
     * 恒 'none'(无任命即无软化面;早先的布尔位 qualifiedForAllow 已拆除)。
     */
    private resolveClassifierTier;
    /**
     * 生效资格档公共查询口:派生裁决链的 auto 父终审
     * 半径与分类器软化共用**同一资格链事实源**(「换裁决人不换半径」)
     * ——装配层经此口取生效档喂执行器的 endorseFinalizeTier。未注入分类器
     * 配置 = 'none'(无在册资格即无自动化裁决面,半径 0);解析异常朝严
     * (resolveClassifierTier 已兜 'none')。每次调用现算(validUntil 越期/
     * 天花板/会话覆盖变更即刻生效,与咨询路径同谓词)。
     */
    getEffectiveQualificationTier(): EffectiveQualificationTier;
    /** 窄缓存统计快照(命中率数据;自检面消费) */
    getClassifierCacheStats(): ClassifierCacheStats;
    /**
     * 咨询用量快照(/permissions 状态面板消费,零 IO):budget =
     * 生效预算(与 consultClassifier 记账同一裁决:config.callBudget ??
     * 缺省;非有限值 = 不限)。未注入分类器时如实返回零咨询 + 缺省预算。
     */
    getClassifierUsage(): ClassifierUsage;
    /**
     * 窄缓存键(键全字段):**仅只读输入**入围(写入/删除/
     * 发布/权限修改不得复用 safe 缓存——isReadOnly 非 true 一律返回 null,
     * 即不查不存);键 = 工具 + 规范化参数 + cwd + 模式 + 版本标签(装配层
     * 以协议指纹+stage 模型对构造)+ 策略束集(id+version)+ transcript
     * 切片(用户新输入即上下文世代翻转,旧 safe 不再命中)。
     */
    private classifierCacheKey;
    /** 缓存查取(过期即删;命中/未命中计数) */
    private classifierCacheLookup;
    /** 缓存写入(TTL + 容量双上限;超容逐最旧插入) */
    private classifierCacheStore;
    /** 熔断状态快照(测试与状态面查询口;不触发冷却复位) */
    getClassifierBreakerState(): ClassifierBreakerState;
    /**
     * 熔断人工复位口(T-K19a「批准即恢复」,doc/07 §5.6):两档皆复位——
     * 冷却清零 + 'session' 停用解除,连拒/总拒计数归零重新记账(复位后
     * 再 3 连拒照常再跳闸,onBreakerTrip 照常再上报)。内核零 IO:审计与
     * 「谁有权复位」由表面层裁决——仅 TUI 在用户显式批准后调用;
     * headless/serve/acp 无恢复通道(fail-closed),不得接线本口。
     */
    resetClassifierBreaker(): void;
    /** 熔断在场判定(冷却期满顺带复位;'session' 不自动复位,仅人工口可解) */
    private classifierBreakerActive;
    /**
     * 分类器 reject 记账 + 阈值跳闸(total 阈值优先于 consecutive 归因)。
     * 记账口径 = 裁决人 reject(unsafe)次数,与 rejectEffect 落地形无关
     * (doc/113 §二);快照字段名 totalDenies/consecutiveDenies 沿用既有词表
     * (查询口契约不动),语义即「拒绝计数」。
     */
    private recordClassifierReject;
    private adjudicateByClassifier;
    /**
     * auto 模式 safe 放行的资格守卫(与管线第 5 段模式放行同一安全模型):
     * - 目标不可解析 → 不放行(引擎不变量「不可解析目标永不自动放行」——
     *   未闭合引号/可疑空白等本身就是走私痕迹,分类器裁定不豁免);
     * - 路径目标非规范解析(UNC 等)→ 不放行(doc/07 §5.3:防 SMB/DNS
     *   侧信道,模式级放行不覆盖,分类器放行同属自动放行);
     * - 内置基线复查命中 → 不放行(管线 4.5 段在 ask 规则**之后**——ask 规则
     *   命中即返回时基线未评估;default 模式下该 ask 由用户注意力把关,auto
     *   模式换成分类器终裁,故放行前必须补一次基线判定,否则
     *   `ask:['Read']` + 读 `.env` 会让 safe 裁定静默穿透基线)。
     * 任一守卫不过均维持 ask(交回询问面;headless 无询问面时按既有语义降 deny)。
     *
     * T-K23c 起公开(16 §4.3「守卫存活」分母/17 L17 单源锁):评估 harness
     * 以引擎实例的本口计算切片守卫存活位,禁止自带第二实现——引擎判定与
     * 考试分母同源,考试恰好覆盖执照。判定依赖实例态(基线规则/配置层
     * allow 中和),故为实例方法而非纯函数。
     */
    classifierAllowEligible(input: DecideInput): boolean;
    /**
     * allow 侧有效规则集:auto 模式丢弃授予任意代码执行的宽规则
     * (broad-allow.ts 谓词),窄规则保留;其余模式原集直通。求值期过滤,
     * 不改写配置——退出 auto 即恢复。管线第 6 段与基线 4.5 段的配置 allow
     * 中和统一走本口(第 7 段会话缓存在 matchCache 内同口径过滤)。
     */
    private effectiveAllowRules;
    /**
     * auto 模式下被丢弃的宽 allow 规则清单(层归因 + 原文;可见性口)。
     * 丢弃是求值期行为(effectiveAllowRules 过滤,配置不改写),此前对用户
     * 完全静默——「规则写了却不生效」必须可见,否则用户会误判配置生效面。
     * 非 auto 模式恒空:只报告实际发生的丢弃,不报告假设。
     */
    getDroppedBroadAllowRules(): {
        layer: RuleLayerName;
        rule: string;
    }[];
    /**
     * 把 bundle 规则插入对应行为集的 policy 段:所有既存 policy 规则之后、
     * 首条更低层规则之前。collectRules 按 RULE_LAYER_ORDER 构造,数组天然
     * 满足「policy 段在头部」的层序不变量;deny/ask 侧扫描按数组序做命中
     * 归因(matchRestrict 首中即返),归因正确性依赖此不变量,故不能尾插。
     */
    private insertPolicyRule;
    /**
     * ask 规则按信任层分位视图(INV-4):受信层(policy/user)在 §2.5 先于
     * bypass/基线求值(显式审批义务,INV-3);项目层(projectLocal/projectShared)
     * 在 §4.9 后于基线/保护面/污点求值——只收紧不遮蔽 deny。按需过滤而非
     * 构造期快照:loadPolicyBundles 运行期注入 policy ask(insertPolicyRule),
     * 快照会漏后装规则;filter 稳定,保持数组层序 → matchRestrict 归因不变。
     */
    private askRules;
    /**
     * TMEM/3 批β P2-5 — 簿记内栅命中(§4.93):canonical(posix)候选恰为
     * 某 carve-out 目录**顶层**受栅簿记文件时返回规范名,否则 null。名单与
     * 顶层限定语义在 tools/files/memory-health.ts(单一事实源);本方法只做
     * 引擎路径空间的前缀切分(memoryCarveOutDirs 构造期已 canonical+折叠,
     * 候选同折)。
     */
    private memoryBookkeepingFenceHit;
    /**
     * TMEM/1 carve-out 前缀包含(4.95 段):canonical(posix)形态的边界
     * 前缀比对——等于目录本身或位于其子树;大小写语义随构造期折叠标志。
     */
    private memoryCarveOutCovers;
    /**
     * 基线判定(管线 4.5 段):返回命中的基线规则原文,null 表示基线不拦。
     * 判定为合取:基线 deny 命中 && 无基线例外中和 && 无配置层显式 allow 覆盖。
     * 求值顺序(deny → 例外 → 配置 allow)只为省扫描:绝大多数请求不碰基线,
     * 不必为其扫 allow 集。
     * - none 目标无 specifier 语义,unresolvable 本就永不自动放行,均跳过;
     * - 例外用 deny/ask 侧激进匹配:中和面必须盖住基线 deny 的命中面
     *   (`.ENV.EXAMPLE`、尾点变体等归一形态),否则例外形同虚设;
     * - 配置 allow 用与管线第 6 步同一套保守聚合(matchAllow):配置本会放行
     *   的目标,基线不预先拦截;会话缓存 allow 刻意不看(设计定死)。
     */
    private matchBaseline;
    /**
     * 灾难基线匹配(bypass 分支专用)。命中返回灾难规则 raw,否则
     * null。与 matchBaseline 的区别:①只扫灾难子集(不含秘密面);②**不做
     * 配置 allow 中和**——bypass 本身即宽放行意图,灾难地板不容 allow 抵消
     * (否则 `allow:['Shell']` + bypass 又放走 rm -rf /);③无例外面。
     */
    private matchDisasterBaseline;
    private compiled;
    /**
     * deny/ask 侧扫描:按层优先级顺序,首个命中即返回(归因到最高层)。
     * 工具名判定统一走 ruleMatchesTool(精确相等 + MCP 服务器级通配;
     * 匹配语义全部落在 rules.ts,引擎只做接线)。
     */
    private matchRestrict;
    /**
     * allow 侧扫描:Shell 目标要求每一段至少被某条 allow 规则(保守匹配)覆盖,
     * 归因取覆盖第一段的规则;其余目标任一规则命中即放行。
     * 工具名判定统一走 ruleMatchesTool:`mcp__srv__*` 在 allow 侧
     * 命中该服务器全部工具——是工具级规则语义(命中全部调用),与 deny/ask
     * 侧工具名判定相同;不对称公理只作用于 specifier 内容匹配(通配规则
     * 恒无 specifier,不触及)。
     */
    private matchAllow;
    /** 会话缓存扫描:deny 用激进匹配,allow 用保守匹配(与规则同侧同语义) */
    private matchCache;
}

/**
 * 裁决姿态推导的**唯一**实现。
 *
 * 不变量(「单点收敛」):「裁决人判危险的落地形(rejectEffect)」只有
 * 一个推导函数,住 kernel;cli 四入口 / 两会话工厂、sdk 令牌档、serve /v2 平台内置形
 * 三形只传**事实**(询问通道在场性、显式覆盖),不再各写字面表。此前三份副本:
 * sdk `adjudication/assemble.ts` 与 server `v2/adjudication.ts` 逐字相同的三元式,
 * cli 却按「入口表面」查静态表(TUI ask / headless·acp·serve deny)——而 askUser
 * 在场性对 serve(/v2 权限桥 / K11 审批)与 acp(requestPermission)是**逐会话**事实,
 * 静态表把「接了通道的 serve 会话」一律判 deny。
 *
 * 姿态词表(表面属性,不是应用属性):
 * - `human-in-loop`(A 人在环):裁决人判危险 → 升到询问面(rejectEffect 'ask',携理由
 *   交用户终审;用户拒即 deny;机器恒不代批);
 * - `headless`(B 无人环):判危险 → deny(deny-and-continue,理由回喂模型)。
 *
 * 本文件零 IO、零副作用(只引类型);显式 A × 无通道的 fail-fast 由调用方按各自文案裁
 * (sdk 既有 invalid_options 文案不变),推导函数不抛。另提供
 * `modeUnderAdjudicator({ posture, tier })`——裁决人在场时的权限模式的**唯一**推导
 * (sdk `assembleTooling` / serve `platform-session-factory` 同源)。
 */

/** 裁决姿态词表 */
declare const ADJUDICATION_POSTURES: readonly ["human-in-loop", "headless"];
/** 裁决姿态:'human-in-loop' 危险判定升到询问面由用户终审;'headless' 危险判定直接 deny 并回喂模型。 */
type AdjudicationPosture = (typeof ADJUDICATION_POSTURES)[number];

/**
 * Http 工具 URL 安全边线:协议白名单 + 私网/保留地址字面量拒绝 +
 * 解析后 IP 复核(SSRF DNS 重绑定缓解)+ socket 级 pin 终局闸
 * (dispatcher.ts)。
 *
 * 三层分工:
 * - **字面量层**(validateHttpUrl,零网络):WHATWG URL 解析器已把十进制/
 *   十六进制/八进制 IPv4 简写归一为点分十进制(如 http://2130706433/ →
 *   127.0.0.1),混淆形态天然被覆盖;判定 `isPrivateHostLiteral` **单源**
 *   于 `net/egress-guard.ts`(表 `net/egress-literals.ts`;与 WebFetch url-guard 同一份,
 *   此前本文件子集表缺 192.0.0/24、198.18/15、fec0::/10、NAT64,该漂移自此闭合);
 * - **解析层**(checkResolvedAddresses):域名主机在
 *   连接前经 dns.lookup 解析,任一解析地址落私网/保留段即拒(fail-closed;
 *   attacker 域指向 127.0.0.1/169.254.169.254 的经典 SSRF 自此被拦)——
 *   早拦层,连接前确定性拒绝且错误归因明确;
 * - **socket 层**(dispatcher.ts 的 pin,2026-08-26):undici Agent
 *   connect.lookup 钩子让建连实际使用的解析结果逐条过同一
 *   isPrivateHostLiteral 判定——校验的 IP 与连接的 IP 是同一次 lookup
 *   的产物,作为终局闸。
 *
 * 三层 × 代理决策的复合工厂 = `net/egress-dispatcher.ts` `createEgressDispatcher`
 * (Http / hooks / WebFetch / ASR 下载六消费点同一实例)。
 *
 * **竞态登记更新(2026-08-26,socket pin 落地)**:上一批登记的残余——
 * 「复核解析与 fetch 内部解析是两次独立 lookup,TTL=0 逐查翻转应答的
 * 重绑定服务仍有竞态窗口」——已闭合:建连处 pin 消除了 TOCTOU 窗,
 * 解析层降格为纵深防御的早拦。剩余边界(IP 字面量径 net 层零 lookup
 * 故 pin 不触发、由字面量层裁;缺省 fetch 统一 undici.fetch 的缘由;
 * 注入 fetchImpl 的责任面)据实登记于 dispatcher.ts 头注。allow_private
 * 显式开关同时放行三层(企业内网 API 场景)。
 */

/** 单条解析结果(node:dns lookup all:true 的消费子集) */
interface ResolvedHostAddress {
    address: string;
    family: number;
}
/** 主机解析注入缝(测试 hermetic;缺省真实 dns.promises.lookup) */
type HostAddressLookup = (hostname: string) => Promise<readonly ResolvedHostAddress[]>;
type ResolvedAddressCheck = {
    ok: true;
} | {
    ok: false;
    error: string;
};

type WebUrlCheck = {
    ok: true;
    url: URL;
} | {
    ok: false;
    reason: string;
};

interface EgressCheckOptions {
    /** 本次调用显式放行私网(Http `allow_private` / hooks `allowPrivateUrls`) */
    allowPrivate?: boolean;
}
type EgressAdmission = {
    ok: true;
    url: URL;
    dispatcher: Dispatcher;
}
/** literal / resolve = 守卫拒;dispatch = 代理 dispatcher 构造失败(坏代理 URL 等,不出网) */
 | {
    ok: false;
    layer: 'literal' | 'resolve' | 'dispatch';
    error: string;
};
interface EgressClient {
    /** 出站 fetch(undici.fetch;与 dispatcher 同版本) */
    readonly fetch: typeof fetch$1;
    /** 代理决策 × pin 复合后的 dispatcher(代理命中 → ProxyAgent;否则 pin;allowPrivate → 裸) */
    dispatcherFor(url: URL, options?: EgressCheckOptions): Dispatcher;
    /** 字面量层(协议 / 凭据 / 私网字面量;base 供重定向 Location 相对解析) */
    checkUrl(raw: string, base?: URL, options?: EgressCheckOptions): WebUrlCheck;
    /** 解析层(域名全量解析,任一地址落表即拒;IP 字面量与 allowPrivate 跳过) */
    checkResolved(url: URL, options?: EgressCheckOptions): Promise<ResolvedAddressCheck>;
    /** 字面量 + 解析两层一次过并取 dispatcher(消费点便捷口;重定向逐跳同调) */
    admit(raw: string, base?: URL, options?: EgressCheckOptions): Promise<EgressAdmission>;
}

/**
 * 工具注册表:name → Tool 的注册与查找。
 *
 * 未知工具名的处理不在这里 throw:调度器据查找结果直接产出 isError
 * tool_result(信息给模型,英文),保证查询环不因模型幻觉工具名而崩溃。
 * 同名重复注册是装配期编程错误,立刻 throw 暴露。
 */

declare class ToolRegistry {
    #private;
    /** 注册工具;同名重复注册直接 throw(装配期编程错误) */
    register<Args>(tool: Tool<Args>): void;
    /**
     * 移除工具(MCP 单服务器重连需先摘旧桥接工具)。不存在返回 false
     * 不 throw——清理路径对「已不在」宽容幂等(与 register 的装配期严苛相对)。
     */
    unregister(name: string): boolean;
    get(name: string): Tool | undefined;
    has(name: string): boolean;
    /** 已注册工具名(按注册序) */
    names(): string[];
    get size(): number;
}

/**
 * 项目 ask 注意力预算。
 *
 * 动机:项目层(projectLocal/projectShared)可写 ask 规则且即时生效,
 * 恶意/失控仓库可用海量 ask 淹没用户注意力(提示风暴)。「收紧
 * 即时生效」不豁免注意力预算——低可信来源可制造的询问量必须有界,否则
 * 「收紧」本身成为注意力耗竭攻击面。「显示来源」只解决归因,不解决
 * 疲劳——预算才是结构性回应。
 *
 * 辖域:**仅项目来源 ask**(GateDecision.sourceLayer === 'projectLocal' |
 * 'projectShared' 且携带 matchedRule)。policy/user/builtin 来源与无
 * sourceLayer 的 ask 一律不受影响(恒 proceed、不计预算);缺 matchedRule
 * 的项目 ask 无去重键,同样直通不计(项目 ask 必带 matchedRule,防御性直通)。
 *
 * 三段语义(调度器权限缝接线,见 dispatching-tool-executor.ts):
 * - **聚合去重**:去重键 = sourceLayer + '\0' + matchedRule + '\0' + toolName
 *   (规则 specifier 即目标类,05「同规则同目标类」);键已有用户答复则重放
 *   (allow 与 deny 都重放),不再弹询问、不耗预算。归因记 'user'——重放的
 *   就是用户对同一问题的既有答复(引擎会话缓存同先例);
 * - **会话预算**:实际弹出的询问计数(recordPrompt),达到 maxPrompts 后
 *   该来源后续 ask 转 exhausted → 调度器 deny-and-continue,归因记 'policy'
 *   (headless 无询问面降级同先例:结构性拒绝而非用户选择);
 * - **汇总通报**:首次越限触发 onExhausted 恰一次(回调抛错吞掉——通报失败
 *   不改判定);此后每次 exhausted 拒绝累计进 denied 聚合(同键合并计数),
 *   summary getter 随时可取(通报组件用)。
 *
 * 与引擎会话缓存(PermissionEngine.recordUserDecision)的关系:缓存是用户
 * **显式**「本会话总是」的选择回写(命中后引擎直接产出 allow/deny,不再到
 * ask);本预算是询问面的**结构性**去重与限量(用户未做总是性承诺时仍不被
 * 同一问题反复轰炸)。两者互不替代:缓存命中则根本不产出 ask,预算只对
 * 真正到达询问面的 ask 生效。
 */

/** 受辖来源层(项目层;与 GateDecision.sourceLayer 的项目子集对齐) */
type ProjectAskSourceLayer = 'projectLocal' | 'projectShared';
/** 预算耗尽后被拒 ask 的聚合条目(同键合并计数) */
interface ProjectAskBudgetDeniedEntry {
    sourceLayer: ProjectAskSourceLayer;
    rule: string;
    toolName: string;
    count: number;
}
/** 汇总通报载荷(onExhausted 收到触发时刻快照;summary getter 取实时快照) */
interface ProjectAskBudgetSummary {
    /** 实际弹出过的询问数(去重重放与非项目 ask 不计) */
    promptCount: number;
    /** exhausted 后被结构性拒绝的 ask 聚合(同键合并) */
    denied: ProjectAskBudgetDeniedEntry[];
}
/** evaluate 三态判定 */
type ProjectAskBudgetVerdict = {
    kind: 'proceed';
} | {
    kind: 'reuse';
    answer: 'allow' | 'deny';
} | {
    kind: 'exhausted';
};
interface ProjectAskAttentionBudgetOptions {
    /** 会话内实际弹询问的上限;缺省 10,必须为 ≥1 的整数 */
    maxPrompts?: number;
    /** 首次越限的一次性汇总通报回调;抛错被吞(通报失败不改判定) */
    onExhausted?: (summary: ProjectAskBudgetSummary) => void;
}
/**
 * 项目 ask 注意力预算(会话级,与 DispatchingToolExecutor 同生命周期)。
 * 用法(调度器 ask 分支、askUser 在场时):
 * evaluate → proceed 则 recordPrompt 后照常询问、答复后 recordAnswer;
 * reuse 则直接重放答复;exhausted 则 deny-and-continue。
 */
declare class ProjectAskAttentionBudget {
    #private;
    constructor(options?: ProjectAskAttentionBudgetOptions);
    /**
     * 判定一次到达询问面的 ask:
     * - 非辖域(非项目来源 / 缺 matchedRule)→ proceed(照常询问,不计预算);
     * - 键已有答复 → reuse(去重命中不耗预算,预算耗尽后同样重放);
     * - 预算已尽 → exhausted(本次拒绝计入 denied 聚合;首次越限触发通报);
     * - 其余 → proceed。
     */
    evaluate(outcome: GateDecision, toolName: string): ProjectAskBudgetVerdict;
    /** 实际弹询问前计数(非辖域 no-op:非项目 ask 不耗预算) */
    recordPrompt(outcome: GateDecision, toolName: string): void;
    /** 用户答复后登记去重键(非辖域 no-op) */
    recordAnswer(outcome: GateDecision, toolName: string, answer: 'allow' | 'deny'): void;
    /** 实时汇总快照(通报组件随时可取;返回副本,持有方不可反向篡改台账) */
    get summary(): ProjectAskBudgetSummary;
}

/**
 * 决策归因记录(INV-8):每个经权限门**终局解决**的工具调用产出
 * 一条内部 DecisionRecord——含 allow(此前 allow 无事件不可见,是归因链的
 * 主缺口);deny/ask 路径与既有 tool.permission.decided 事件并行产记录,
 * 事件面零改动(不动 protocol 词表;source 细化的事件流版本另走协议评审)。
 *
 * 分层定位:本文件属 dispatch 目录,遵守分层铁律不 import permissions/;
 * 记录携带的是门面(GateDecision)已有信息 + 调用身份 + 目标摘要投影。
 * 落盘、脱敏(INV-10)、策略快照标识与模式富化由装配层写入器负责
 * (cli/assembly/decision-records.ts)——内核只产结构,不做 IO。
 *
 * 完整率口径(「归因完整率」):分母 = 经门判定且**终局解决**
 * (allow/deny 落定)的调用;询问期间被中断(Esc/abort)的调用无终局,
 * 不产记录、不进分母。gateDecision 与 decision 两字段并存可答「门面初判
 * 是什么、最终谁拍板」:如 gateDecision='ask' + decision='allow' +
 * source='user' 即用户在对话框放行;gateDecision='allow' + source='user'
 * 则是引擎会话缓存重放(无对话框),两者可区分。
 */

/** 单调用决策记录(内核产出形态;落盘富化见装配层写入器) */
interface ToolDecisionRecord {
    callId: string;
    toolName: string;
    /** 终局判定(ask 经用户答复/降级/预算重放后的最终值) */
    decision: 'allow' | 'deny';
    /**
     * 终局归因(protocol DecisionSource 词表):门面初判为 allow/deny 时
     * 即门面 source;ask 经用户答复为 'user',headless 降级为 'policy',
     * K16 预算重放为 'user'、预算耗尽为 'policy'——与 decided 事件同词。
     */
    source: DecisionSource;
    /** 门面初判(三态;与 decision 并存供归因分辨,见文件头) */
    gateDecision: 'allow' | 'deny' | 'ask';
    /** 命中规则所在真实层(透传;规则命中才有) */
    sourceLayer?: 'policy' | 'projectLocal' | 'projectShared' | 'user';
    /** 命中规则原文(含 baseline/protected-path/hard-safety 伪规则) */
    matchedRule?: string;
    /** 分类器/门面理由(deny-and-continue 的 reason 透传) */
    reason?: string;
    /** 目标摘要(参数投影原文;**未脱敏**,写入器落盘前过 redactDeep) */
    targetSummary?: string;
    /**
     * 派生裁决链留痕(INV-D4):子代理 ask 经裁决链时逐级
     * {adjudicator, verdict, reason, via, elapsedMs};reason **未脱敏**,
     * 写入器落盘前过 redactDeep(同 targetSummary 纪律)。旧记录无此字段,
     * 读侧(/explain、doctor)按缺省空态兼容。仅裁决链路径落键。
     */
    adjudicationChain?: readonly AdjudicationChainEntry[];
}
/**
 * 记录回调(调度器 onDecision 选项):实现方不得 throw——调度器虽兜底
 * 吞错,但记录失败应由写入器自身计数上报(stats),不是靠异常。
 */
type OnToolDecision = (record: ToolDecisionRecord) => void;

/**
 * 文件 pre-image 采集缝(OPT-13):写改类工具执行前,以其 mutatedPathsOf
 * 声明的路径集调用。实现方(装配层)负责读盘存 checkpoint;不得 throw
 * (采集失败自行上报,绝不让写工具因采集问题失败)。
 */
type CaptureFileCheckpoints = (paths: readonly string[]) => Promise<void> | void;
/**
 * TM-12 触达观测缝(doc/38 §4.7 召回二档):每批 execute() 收尾、触达采集
 * (#collectTouchedFiles,仅非 isError 结果)完成后,以「工具名 × 路径集」
 * 逐调用回调。旁路观测:回调抛错被吞,绝不影响结果回填;缺省 = 不观测,
 * 零行为零开销(门关字节零漂移)。
 */
interface ToolTouchObservation {
    toolName: string;
    paths: readonly string[];
}
type OnFilesTouched = (entries: readonly ToolTouchObservation[]) => void;
/**
 * 派生裁决链接线:子代理执行器
 * 专属——ask 终局路由到父裁决链(reject/endorse/escalate 逐级)而非静默降
 * deny。主代理执行器恒不注入(routeAsk 自然走 user-dialog/floor-deny 现状
 * 路径)。
 */
interface ExecutorAdjudicationOptions {
    /**
     * 裁决人链(递归上升)——由近及远:[直接父, 祖父, …]。
     * 每级持**自己的**派生时点快照(agents/adjudication.ts);escalate 逐级
     * 上升,任何级 reject 即终局,endorse 直达链顶(default 上报终审 / auto
     * 半径内就地生效);链尽 = 链顶通道(topAskUser)或地板。
     */
    adjudicators: readonly ParentAdjudicator[];
    /**
     * 链顶终审通道:装配层询问回调**同一实例**(TUI 弹卡 / K11 挑战投递)。
     * endorse/escalate 经此上升用户终审(弹卡呈现责任链);缺席 = 链顶无人,
     * 落 fail-closed 地板。dontAsk「不上升到用户」语义由装配层以
     * 不注入本位表达(kernel 零模式感知)。
     */
    topAskUser?: AskUserCallback;
    /**
     * auto 半径内父终审:
     * **endorse 出口时点**求值(运行时,会话中切模式即时生效)。null = 无
     * 终审权(default/dontAsk:endorse 恒上报链顶);档位值 = auto 形态,
     * endorse 仅在该档软化半径内就地生效(半径事实源 = 资格链 SOFTEN_RADIUS,
     * 换裁决人不换半径;'none' 档半径恒空 = 全额上升)。半径外的 endorse
     * 自动转 escalate 继续上升(face 是调用属性,逐级同判,链顶恒用户)。
     * kernel 零模式感知:auto 与门开关的判定在装配层谓词内。
     */
    endorseFinalizeTier?: () => EffectiveQualificationTier | null;
    /**
     * 分类器软化抑制谓词(裁决位切换的另半场):真值时子代理调用经门
     * hints 关闭分类器 safe→allow(收紧方向保留)——auto 下自动化裁决位由
     * 分类器让位父终审,不出现双放行位。装配层以「auto × 门开」表达;缺省 =
     * 分类器全权(链不可用形态的回退)。
     */
    suppressClassifierSoften?: () => boolean;
    /** 子代理身份(终审弹卡责任链呈现 + 审计) */
    childAgentId: string;
    /** 派生时任务标签(弹卡语境) */
    childDescription: string;
}
interface DispatchingToolExecutorOptions {
    registry: ToolRegistry;
    /** ToolContext.cwd;默认 process.cwd() */
    cwd?: string;
    /** 并发安全调用的数量上限;默认 8,必须 ≥1 */
    maxConcurrency?: number;
    /** 每调用统一硬超时(毫秒);默认 120_000。测试可注入短超时 */
    defaultTimeoutMs?: number;
    /**
     * 硬超时后独占槽(inFlight)的释放宽限(毫秒)。超时即刻回喂
     * 模型 / 签发 tool.failed(模型面不等),但**槽位**待工具 promise settle 或宽限
     * 到期二者先至才释放——此前超时即释放,不接 signal 的工具仍在写盘时下一独占
     * 写工具已启动(交叠写)。宽限到期仍未结束的操作可能与后续读写交叠；本机制不持有
     * 跨 executor/会话的世界锁，也不终止任意 JS Promise。缺省 TIMEOUT_RELEASE_GRACE_MS;0 = 不等。
     */
    timeoutReleaseGraceMs?: number;
    /**
     * 权限缝(INV-12,构造期强制):一切工具执行必须过门。直接构造
     * 缺门抛错;明知无门的场景(纯调度/超时语义等不含权限断言的测试)用
     * createUnsafeExecutorWithoutGate() 显式绕过。
     */
    permissionGate?: PermissionGate;
    /** 权限询问回调;缺省时 ask 降级为 deny(headless 场景) */
    askUser?: AskUserCallback;
    /**
     * 派生裁决链:注入即 ask 终局优先路由父裁决(routeAsk
     * 优先序);缺省 = 现状(askUser 有无二分)。仅子代理执行器(subagent-
     * runner)在特性开启时注入。
     */
    adjudication?: ExecutorAdjudicationOptions;
    /**
     * 项目 ask 注意力预算:仅辖项目来源
     * (sourceLayer=projectLocal/projectShared)的 ask——同规则同工具聚合去重、
     * 会话预算超限转 deny-and-continue。缺省 undefined = 特性关闭,行为与既有
     * 完全一致。仅在 askUser 在场时参与(headless 降级路径不适用)。
     */
    projectAskBudget?: ProjectAskAttentionBudget;
    /**
     * 决策归因记录缝(INV-8):每个经门**终局解决**(allow/deny 落定)
     * 的调用恰回调一次——含 allow(此前 allow 无事件不可见);询问期间被中断
     * 的调用无终局,不回调。回调抛错被吞(记录失败由写入器自身计数上报)。
     * 缺省 undefined = 不记录;无门执行器(测试)自然无记录。
     */
    onDecision?: OnToolDecision;
    /**
     * 文件 checkpoint 采集缝(OPT-13);缺省不采集。await 在工具执行前完成
     * ——pre-image 必须先于写落盘;写工具本就独占串行,不新增阻塞面。
     */
    captureFileCheckpoints?: CaptureFileCheckpoints;
    /** 时钟注入(durationMs 计算);默认 Date.now */
    now?: () => number;
    /**
     * grep 轮次聚合器;缺省自建(会话级)。持有方 turn 结束经
     * executor.searchAggregator.snapshot()/drain() 导出(不新增契约事件)。
     */
    searchAggregator?: GrepRoundAggregator;
    /**
     * TMEM/1 记忆写上下文(TM-2/TM-3;doc/38 §4.2):门开时装配层注入记忆
     * 目录集与观测回调——透传 ToolContext.memoryWrite(Write/Edit 触发含入
     * 复核/秘密扫描/写后体检),并使 pre-image 采集守卫启用记忆含入轴。
     * 缺省 = 门关,一切行为与现状逐字节一致。
     */
    memoryWrite?: MemoryWriteContext;
    /**
     * TM-12 触达观测缝;仅 autoMemory 门开时由装配层注入(paths 触发召回)。
     * 缺省 undefined = 不观测,与既有行为逐字节一致。
     */
    onFilesTouched?: OnFilesTouched;
    /**
     * Q4-6(EW-1)执行世界 fs 缝:注入即换世界——透传 ToolContext.fs(工具
     * 文件面副作用)并用于 pre-image 采集前的真实目标守卫(与工具同世界)。
     * 缺省 defaultFs(node:fs/promises 直通薄壳,行为与直用逐字节一致)。
     * 权限判定(gate.decide)不经此面且恒先于工具 execute(红线 3)。
     */
    fs?: FsLike;
    /**
     * SC-15:指标注册表注入缝(tansr_kernel_tool_executions_total{result} /
     * tansr_kernel_tool_duration_ms 写入处)。注入优先,缺省进程级 defaultMetrics
     * (与 RunQueryOptions.metrics 同律);只计数,零调度逻辑改动。
     */
    metrics?: MetricsRegistry;
}
declare class DispatchingToolExecutor implements ToolExecutor {
    #private;
    constructor(options: DispatchingToolExecutorOptions);
    /** grep 轮次聚合器(只读访问点;导出路径见 GrepRoundAggregator 文档) */
    get searchAggregator(): GrepRoundAggregator;
    /** 本实例的工具执行 cwd(ToolContext.cwd 同值;装配层核对/回报用) */
    get cwd(): string;
    /**
     * W-1(doc/116 §3.7 D-7 / doc/117 W-1)— 以新 cwd 派生执行器:返回**新实例**,
     * 本实例零改动(`#cwd` 恒 readonly——「cwd 是构造期常量」的不变量以实例替换而非
     * 原地赋值守住;装配层在空闲期换掉持有的引用即完成切换)。
     *
     * - 共享:registry(同一工具对象;派生后向 registry 注册的工具两侧同见)、
     *   fileReadState(Read→Edit 漂移校验表;键为绝对规范路径,与 cwd 无关)、
     *   searchAggregator(会话级 grep 轮次聚合)以及其余全部构造选项(askUser /
     *   onDecision / captureFileCheckpoints / memoryWrite / fs / metrics …);
     * - 按新 cwd 重算:ToolContext.cwd、pre-image 采集前的真实目标守卫(checkRealTarget
     *   工作区双锚)、软化半径判定 classifySoftenFace——三处皆按调用期以 `#cwd` 计算,
     *   无跨调用缓存,新实例即新锚;
     * - 权限门:**缺省沿用**同一 gate 对象。sdk / cli 网关皆以构造期 cwd 锚定规则路径与
     *   工作区快路径(permission.ts「必须与 executor 的 cwd 一致」),装配层须以
     *   `overrides.permissionGate` 同步换门(引擎实例可复用:compiledByCwd 按 cwd 键、
     *   分类器窄缓存键含 cwd;会话缓存 recordUserDecision 条目锚定记录时 cwd——绝对规范
     *   模式,方向收紧不放宽);
     * - Q4-13 同轮提权名额随新实例复位(切换只在空闲期,下一轮 turnId 本就翻新);
     * - 无门实例(createUnsafeExecutorWithoutGate 产物)派生仍无门且不再 throw INV-12——
     *   无门点位在源实例构造时已审计,派生不新增绕过面。
     */
    withCwd(cwd: string, overrides?: Pick<DispatchingToolExecutorOptions, 'permissionGate'>): DispatchingToolExecutor;
    execute(calls: ProposedToolCall[], ctx: ToolExecutionContext): AsyncGenerator<ToolExecutorYield, ToolExecutionOutcome, undefined>;
}

declare const JournalManifestSegmentSchema: z.ZodObject<{
    /** 段序号(1 起,连续) */
    n: z.ZodNumber;
    /** 段文件相对会话目录的路径(恒 segments/NNNNNN.jsonl;posix 分隔) */
    file: z.ZodString;
    firstSeq: z.ZodNumber;
    lastSeq: z.ZodNumber;
    records: z.ZodNumber;
    bytes: z.ZodNumber;
    /** 段末记录哈希(下一段首记录 previousHash 必等于此;跨段链校验锚点) */
    lastHash: z.ZodString;
    /** ISO-8601(pending 时为登记时刻) */
    sealedAt: z.ZodString;
    /** 两阶段状态(doc/117 K-2 崩溃安全要求;doc/116 §3.4 形之上的加法字段) */
    status: z.ZodEnum<["pending", "sealed"]>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "sealed";
    bytes: number;
    n: number;
    firstSeq: number;
    lastSeq: number;
    records: number;
    lastHash: string;
    sealedAt: string;
    file: string;
}, {
    status: "pending" | "sealed";
    bytes: number;
    n: number;
    firstSeq: number;
    lastSeq: number;
    records: number;
    lastHash: string;
    sealedAt: string;
    file: string;
}>;
type JournalManifestSegment = z.infer<typeof JournalManifestSegmentSchema>;
/** 封段阈值选项(D-5:16 MiB / 5000 记录;enabled 缺省 true) */
interface SegmentationOptions {
    enabled?: boolean;
    maxBytes?: number;
    maxRecords?: number;
}

/** 核警告(store 层经 onStoreWarning / turn.error 等出线;码集加法) */
interface SessionStoreCoreWarning {
    code: 'store_prefix_mismatch' | 'store_pending_rewrite';
    message: string;
    detail?: Record<string, unknown>;
}

/**
 * 会话历史分层存储 · 调用契约(接口先冻)。
 *
 * 这里只有**运行时接口**;持久化数据契约(段条目 / 清单)在 protocol `storage.ts`
 * (contract-v0.22)。分层核接在既有段层之上(journal/{writer,reader,manifest}.ts:
 * 写侧 `onSegmentSealed` 钩子 → 上传不可变段;读侧 `segmentSource` 钩子 → 本地段缺席时回源),
 * 热层本地盘恒为耐久性地板,冷层只承接封存后不可变的段 / 快照 / 附件。
 *
 * 两级接口对上层同一类型:
 * - 一级 `SegmentBlobStore`(字节对象:put/get/head/list/delete;S3 / OSS / COS / MinIO / GCS /
 *   Azure / GridFS / 文件系统皆此级;引擎内置分层核把分段/编码/清单提交/热盘 LRU/重试全做掉);
 * - 二级 `SessionHistoryStore`(自管布局:KV / 关系库;引擎只调 store / load / listSessions / remove)。
 * 适配器唯一要遵守的错误约定 = `StoreError.kind` 四类;其他异常一律按 transient。
 * 边界:键对适配器不透明、体为字节流、不假设 list 一致性、幂等靠 sha256、取消靠 AbortSignal;
 * 加密 / 驻留地 / 访问控制归开发者(`transform` 挂点)。
 */

type StoreErrorKind = 'transient' | 'permanent' | 'not_found' | 'precondition_failed';
/** 构造 StoreError 时的附加信息:原始异常与 transient 类的重试建议。 */
interface StoreErrorOptions {
    cause?: unknown;
    /** transient 时的重试建议(如 429 Retry-After 换算 ms) */
    retryAfterMs?: number;
}
/**
 * - transient:网络错 / 5xx / 429 / 超时 → 引擎按重试预算退避重试,超预算记 store.commit_failed,热层继续兜底
 * - permanent:403/400 / 对象损坏 / 校验失败 → 停止对该会话上传并告警;载入侧映射 /v2 store_corrupted
 * - not_found:键 / 会话不存在(get / load;head 用 null)→ resume 404
 * - precondition_failed:CAS 不匹配(412)→ 本写者放弃(多副本切换保护),不重试
 */
declare class StoreError extends Error {
    readonly kind: StoreErrorKind;
    readonly retryAfterMs: number | undefined;
    constructor(kind: StoreErrorKind, message: string, options?: StoreErrorOptions);
}
/** 任意异常 → StoreError(非 StoreError 一律 transient) */
declare function toStoreError(error: unknown): StoreError;
/** 字节对象的元数据:体积、内容类型、sha256 内容寻址与可选的生命周期 / 标签 / CAS 令牌。 */
interface BlobMeta {
    bytes: number;
    /** 'application/x-ndjson' | 'application/gzip' | 'application/zstd' | 'application/json' */
    contentType: string;
    /** hex;内容寻址;put 幂等判据 */
    sha256: string;
    /** 生命周期提示;不是删除承诺 */
    expiresAt?: string;
    /** 如 { tenant, sessionId, kind:'segment'|'manifest'|'checkpoint'|'attachment' };引擎只写不读 */
    tags?: Record<string, string>;
    /**
     * 条件写 CAS 令牌(与 PutResult.etag 同一口径,不透明)。`capabilities.conditionalPut:true`
     * 的适配器须在 head / list 返回(引擎据此对既有清单 ifMatch);其他适配器可缺席。
     */
    etag?: string;
}
/** 含 end;缺省到尾 */
interface ByteRange {
    start: number;
    end?: number;
}
/** SegmentBlobStore.put 的选项:取消信号与条件写(ifNoneMatch / ifMatch)令牌。 */
interface PutOptions {
    signal?: AbortSignal;
    /** 仅 capabilities.conditionalPut 时引擎会传 */
    ifNoneMatch?: '*';
    /** etag CAS(清单重写);仅 capabilities.conditionalPut 时引擎会传 */
    ifMatch?: string;
}
/** SegmentBlobStore.put 的结果;支持条件写的适配器回传新 etag。 */
interface PutResult {
    etag?: string;
}
/** SegmentBlobStore.list 的单条结果:键与元数据。 */
interface BlobListEntry {
    key: string;
    meta: BlobMeta;
}
/** 字节对象存储适配器的能力声明;引擎据此决定一致性等待、条件写、分段阈值与批量删除。 */
interface BlobStoreCapabilities {
    /** 写后立即 head/get/list 是否保证可见 */
    consistency: 'strong' | 'eventual';
    /** 支持 ifNoneMatch:'*' 与 ifMatch(etag) */
    conditionalPut: boolean;
    rangeGet: boolean;
    /** 单对象上限(Redis 512 MiB、DynamoDB 400 KiB、S3 5 TiB);引擎据此钳段阈值 */
    maxObjectBytes: number;
    list: 'prefix' | 'none';
    /** 一次 delete 可接受的键数;缺省 1 */
    batchDelete?: number;
}
/**
 * 一级存储接口:字节对象的 put / get / head / list / delete。
 * S3 / OSS / COS / MinIO / GCS / Azure / GridFS / 文件系统皆此级;分段、编码、清单提交、
 * 热盘 LRU 与重试由引擎内置分层核完成,适配器只需守 StoreError 四类错误约定。
 */
interface SegmentBlobStore {
    readonly capabilities: BlobStoreCapabilities;
    /** 至少一次、按 meta.sha256 幂等(同键同哈希重复 put 必须成功且无副作用) */
    put(key: string, body: ReadableStream<Uint8Array>, meta: BlobMeta, opts?: PutOptions): Promise<PutResult>;
    /** 返回的流由引擎消费与关闭;适配器不得整段读入内存 */
    get(key: string, range?: ByteRange, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    /** 不存在 → null(不抛) */
    head(key: string, signal?: AbortSignal): Promise<BlobMeta | null>;
    /** 允许最终一致;引擎只用于 gc 与盘点 */
    list(prefix: string, cursor?: string, signal?: AbortSignal): AsyncIterable<BlobListEntry>;
    /** 不存在不算错 */
    delete(keys: readonly string[], signal?: AbortSignal): Promise<void>;
}
/** 二级存储中一条会话的元数据(列表 / 索引条目)。 */
interface StoredSessionMeta {
    sessionId: string;
    endUserKey: string;
    volumeId: string;
    generation: number;
    createdAt: string;
    updatedAt: string;
    lastSeq: number;
    title?: string;
    platformSessionId?: string;
    /**
     * 一级冷层经 `SessionIndexStore` 提交时,现行冷清单对象的规范键(每次提交写唯一、
     * 不可变的新对象,index 的 CAS 即提交点)。条件写路径 / 二级冷层缺席。实现方按不透明串存取。
     */
    manifestKey?: string;
}
/** SessionHistoryStore.store 的入参:新封存段(可空)与含本段后的新清单,附代际 CAS 期望值。 */
interface StoreInput {
    sessionId: string;
    endUserKey: string;
    volumeId: string;
    /** null = 仅清单变更(如附件 / 快照登记) */
    segment: {
        entry: SegmentEntry;
        body: ReadableStream<Uint8Array>;
    } | null;
    /** 含本段后的新清单 */
    manifest: SegmentManifest;
    /** = manifest.generation − 1;不匹配须抛 precondition_failed */
    expectedGeneration: number;
    signal?: AbortSignal;
}
/** SessionHistoryStore.load 的查询:会话定位与可选的 seq 区间。 */
interface LoadQuery {
    sessionId: string;
    endUserKey: string;
    fromSeq?: number;
    toSeq?: number;
    signal?: AbortSignal;
}
/** SessionHistoryStore.load 的结果:清单 + 惰性的段体迭代器。 */
interface LoadResult {
    manifest: SegmentManifest;
    /**
     * 按 n 升序,只含区间内的段;体为编码后字节(引擎按 entry.codec 解码并校验链)。
     * 须**惰性**:引擎常只取 manifest 不迭代(读清单 / 定位卷),实现应在迭代时才打开段体。
     */
    segments: AsyncIterable<{
        entry: SegmentEntry;
        body: ReadableStream<Uint8Array>;
    }>;
}
/**
 * 二级存储接口:自管布局(KV / 关系库)的会话历史存取。
 * 引擎只调 store / load / listSessions / remove,分段与清单由实现方自行落位。
 */
interface SessionHistoryStore {
    store(input: StoreInput): Promise<void>;
    /** null = 不存在 */
    load(query: LoadQuery): Promise<LoadResult | null>;
    listSessions(endUserKey: string, cursor?: string, signal?: AbortSignal): AsyncIterable<StoredSessionMeta>;
    remove(sessionId: string, endUserKey: string, signal?: AbortSignal): Promise<void>;
}
/** 可选的会话索引存储:为多副本共享元数据,或为不支持条件写的对象存储提供 CAS 提交点。 */
interface SessionIndexStore {
    /** expectedGeneration 不匹配须抛 precondition_failed */
    upsert(meta: StoredSessionMeta, expectedGeneration?: number): Promise<void>;
    get(endUserKey: string, sessionId: string): Promise<StoredSessionMeta | null>;
    list(endUserKey: string, cursor?: string): AsyncIterable<StoredSessionMeta>;
    remove(endUserKey: string, sessionId: string): Promise<void>;
}
/** 段体上传 / 下载前后的字节流变换挂点(加密、脱敏等由开发者自带)。 */
interface StreamTransform {
    /** 开发者自带加密 / 脱敏;引擎不做密码学 */
    encode(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>;
    decode(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>;
}
/** 分层存储策略:冷层编码、热盘保留、上传并发 / 重试预算、载入预取与流变换。 */
interface SegmentedStorePolicy {
    /** 冷层封存段编码;缺省 'jsonl+gzip'(zstd 仅 Node ≥ 22.15 可用) */
    codec?: SegmentCodec;
    /** 热盘保留:触顶 → store.hot_full 事件 + readiness 红;恒不删未上传段 */
    hotRetention?: {
        maxBytes?: number;
        keepRecentSegments?: number;
    };
    /** 上传:缺省 async / 并发 4 / 重试预算 8 次、退避封顶 60 s */
    upload?: {
        mode?: 'async' | 'sync';
        concurrency?: number;
        retryBudget?: {
            attempts: number;
            maxBackoffMs: number;
        };
    };
    /** 载入:缺省只预取 1 个尾段(压缩后通常 = 摘要 + 尾段) */
    restore?: {
        prefetchTailSegments?: number;
    };
    transform?: StreamTransform;
    /** 规范键 → 适配器键(不得破坏唯一性) */
    keyMapper?: (canonicalKey: string) => string;
    /** 规范键首段;缺省 'default' */
    tenant?: string;
}
/** 缺省值单点(doc/119 §八 D-1/D-2/D-3) */
declare const SEGMENTED_STORE_DEFAULTS: {
    readonly codec: SegmentCodec;
    readonly upload: {
        readonly mode: "async";
        readonly concurrency: 4;
        readonly retryBudget: {
            readonly attempts: 8;
            readonly maxBackoffMs: 60000;
        };
    };
    readonly restore: {
        readonly prefetchTailSegments: 1;
    };
    readonly tenant: "default";
};
/** 一级 / 二级判别(二级以 store/load 方法为准) */
declare function isSessionHistoryStore(cold: SegmentBlobStore | SessionHistoryStore): cold is SessionHistoryStore;

/** 内存存储的构造选项:可选的能力自述覆写。 */
interface MemoryBlobStoreOptions {
    /** 覆写能力自述(测试用,如模拟无条件写后端) */
    capabilities?: Partial<BlobStoreCapabilities>;
}
/** 创建纯内存的 SegmentBlobStore;附 size / keys() 供测试直读。 */
declare function createMemoryBlobStore(options?: MemoryBlobStoreOptions): SegmentBlobStore & {
    /** 测试直读 */
    readonly size: number;
    keys(): string[];
};

/** 文件系统冷层存储的构造选项:根目录与可选的能力自述覆写。 */
interface FsBlobStoreOptions {
    /** 根目录(不存在则首次操作创建);只作冷层 */
    dir: string;
    /** 覆写能力自述(测试用,如模拟无条件写后端;行为不随之变——一致性测试套据此揭示「自述不实」) */
    capabilities?: Partial<BlobStoreCapabilities>;
}
/** 创建以本地目录为后端的 SegmentBlobStore(双树布局、原子条件写、原生 Range 读);只作冷层。 */
declare function createFsBlobStore(options: FsBlobStoreOptions): SegmentBlobStore;

/** 一致性测试套的运行选项:体量 / 内存预算 / 最终一致窗口 / 隔离前缀 / 并发数 / 清理与取消。 */
interface StorageConformanceOptions {
    /** 大对象体量;缺省 16 MiB(正式认证建议 1 GiB) */
    largeObjectBytes?: number;
    /** 大对象 put / get 各自允许的 RSS 峰值增量;缺省 64 MiB */
    rssBudgetBytes?: number;
    /** list 最终一致可见窗口;0 = 须立即可见;缺省 0 */
    eventualConsistencyMs?: number;
    /** 隔离前缀;缺省 `conformance-<random>` */
    keyPrefix?: string;
    /** 并发封存用例的键数;缺省 16 */
    concurrency?: number;
    /** 结束时不清理(排障) */
    keepObjects?: boolean;
    signal?: AbortSignal;
}
/** 单个一致性用例的结果:id、是否通过、说明文本、是否因能力不适用而跳过、耗时。 */
interface StorageConformanceCase {
    id: string;
    passed: boolean;
    detail: string;
    /** 因能力自述不适用而跳过(计 passed) */
    skipped?: boolean;
    durationMs: number;
}
/** 一致性测试套的整体报告:逐用例结果、总判定、被测存储的能力自述与起止信息。 */
interface StorageConformanceReport {
    cases: StorageConformanceCase[];
    /** 全部用例 passed */
    passed: boolean;
    capabilities: BlobStoreCapabilities;
    startedAt: string;
    durationMs: number;
}
/** 对一个 SegmentBlobStore 跑完十类一致性用例并返回报告;全部对象落在隔离前缀下,结束时尽力清理。 */
declare function runStorageConformance(store: SegmentBlobStore, options?: StorageConformanceOptions): Promise<StorageConformanceReport>;

/**
 * 混沌包装器 `createChaosBlobStore(inner, faults)`——把任一 `SegmentBlobStore` 包成
 * 会出故障的后端,供一致性测试套 / 对抗验收注入:
 *
 *   failPut              put 立即失败(true / 按键谓词 / 前 N 次),kind = putErrorKind(缺省 transient)
 *   failPutAfterBytes    put 消费体到 N 字节后失败(连接中断;体已部分读出,不得留半对象)
 *   putErrorKind         注入的 put 失败分类(transient | permanent | not_found | precondition_failed)
 *   eventualListLagMs    list 对「最近 lag 毫秒内 put 的键」不可见(最终一致);capabilities.consistency 报 eventual
 *   dropListEntries      list 丢项(按键谓词 / 概率 0–1)
 *   corruptSegmentKeys   get 对匹配键返回翻转首字节的体(篡改)
 *   abortMidStream       get 的流在首块之后以 transient 出错(下载中断)
 *   latencyMs            每次调用前延迟(定值 / [min,max] 均匀)
 *
 * `faults` 对象**按引用持有**,测试可运行时翻转(如愈合 failPut 观察追平);`stats` 记各类注入次数。
 * 不改语义的调用原样透传;内层错误原样上抛(不二次包装)。
 */

/** 按键选择注入目标:布尔整体开关,或对键求值的谓词。 */
type KeyPredicate = boolean | ((key: string) => boolean);
/** 混沌故障配置;对象按引用持有,测试可在运行时翻转各项。 */
interface ChaosFaults {
    /** put 立即失败:true / 按键谓词 / 数字 = 前 N 次 put 失败 */
    failPut?: KeyPredicate | number;
    /** put 读体至 N 字节后失败(不留半对象) */
    failPutAfterBytes?: number;
    /** 注入的 put 失败分类;缺省 transient */
    putErrorKind?: StoreErrorKind;
    /** transient 时附带的 retryAfterMs 提示 */
    retryAfterMs?: number;
    /** list 对最近 lag 毫秒内 put 的键不可见 */
    eventualListLagMs?: number;
    /** list 丢项:按键谓词 / 概率(0–1) */
    dropListEntries?: KeyPredicate | number;
    /** get 返回篡改体(首字节翻转)的键 */
    corruptSegmentKeys?: KeyPredicate;
    /** get 流在首块后以 transient 出错 */
    abortMidStream?: KeyPredicate;
    /** 每次调用前延迟 */
    latencyMs?: number | {
        min: number;
        max: number;
    };
}
/** 混沌包装器的注入计数与各操作调用次数。 */
interface ChaosStats {
    putFailures: number;
    putTruncated: number;
    listHidden: number;
    listDropped: number;
    corruptedGets: number;
    abortedGets: number;
    calls: Record<'put' | 'get' | 'head' | 'list' | 'delete', number>;
}
/** 被混沌包装后的存储:暴露故障配置、注入统计与内层存储。 */
interface ChaosBlobStore extends SegmentBlobStore {
    readonly faults: ChaosFaults;
    readonly stats: ChaosStats;
    readonly inner: SegmentBlobStore;
}
/** 把任一 SegmentBlobStore 包成按 faults 注入故障的存储;不改语义的调用原样透传,内层错误原样上抛。 */
declare function createChaosBlobStore(inner: SegmentBlobStore, faults?: ChaosFaults, now?: () => number): ChaosBlobStore;

/** 会话身份(冷层键形 `<tenant>/<endUserKey>/<sessionId>/<volumeId>/…` 与清单分域所需)+ 热层目录 */
interface ColdSessionRef {
    sessionId: string;
    /** sha256(endUserId) 前 16 hex(doc/98 §九);sdk 单租户形态 'local' */
    endUserKey: string;
    /** 本地热层会话目录(`manifest.json`、`segments/NNNNNN.jsonl`、`journal.jsonl` 所在) */
    sessionDir: string;
}
/** 会话身份(不含热层目录;remove / gc 用) */
type ColdSessionId = Pick<ColdSessionRef, 'sessionId' | 'endUserKey'>;
/** 冷层运行统计:上传积压、热盘占用、累计提交数与就绪位。 */
interface ColdTierStats {
    /** 待上传 / 待提交段数与字节(积压;两条告警线之一) */
    backlogSegments: number;
    backlogBytes: number;
    /** 热盘上本地段文件占用(已提交 + 未提交;经 bind 的会话口径) */
    hotBytes: number;
    /** 进程内累计已提交段数 */
    committedSegments: number;
    /** 就绪(热盘未触顶);`false` → 准入应拒新建(overloaded) */
    ready: boolean;
}
/**
 * 结构化事件(可映射为 serve 日志事件 / onStoreError):
 * - `store.segment_sealed`:收到封段通知,已入队(热层事实);
 * - `store.segment_committed`:段 put 成功且冷清单 CAS 已提交(冷层事实;可逐出);
 * - `store.commit_failed`:一次上传 / 提交失败(`gaveUp` = 重试预算耗尽或 permanent /
 *   precondition_failed 放弃;此后该段留在热盘、积压可见);
 * - `store.hot_full`:热盘触顶(ready → false);`store.hot_recovered`:回落;
 * - `store.evicted`:已提交段的本地文件被逐出;
 * - `store.orphan_gc`:孤儿对象清理(段已 put、清单未引用)。
 */
type ColdTierEvent = {
    type: 'store.segment_sealed';
    session: ColdSessionRef;
    segment: JournalManifestSegment;
} | {
    type: 'store.segment_committed';
    session: ColdSessionRef;
    segment: JournalManifestSegment;
    key: string;
    bytes: number;
    generation: number;
} | {
    type: 'store.commit_failed';
    session: ColdSessionRef;
    segment: JournalManifestSegment | null;
    error: StoreError;
    attempts: number;
    gaveUp: boolean;
} | {
    type: 'store.hot_full';
    hotBytes: number;
    maxBytes: number;
} | {
    type: 'store.hot_recovered';
    hotBytes: number;
    maxBytes: number;
} | {
    type: 'store.evicted';
    session: ColdSessionRef;
    segment: JournalManifestSegment;
    bytes: number;
} | {
    type: 'store.orphan_gc';
    session: ColdSessionId;
    deleted: string[];
};
/** 冷层结构化事件的 type 取值集合。 */
type ColdTierEventType = ColdTierEvent['type'];

declare const ContextCheckpointTriggerSchema: z.ZodEnum<["manual", "pre_compaction", "pre_clear", "pre_restore"]>;
type ContextCheckpointTrigger = z.infer<typeof ContextCheckpointTriggerSchema>;
/** 快照头部(旁挂 .meta.json 的全部内容 = 快照体去掉 messages) */
declare const ContextCheckpointMetaSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    /** ULID(时间有序,列举即时间线);兼作文件名段 */
    checkpointId: z.ZodString;
    sessionId: z.ZodString;
    /** ISO-8601 */
    createdAt: z.ZodString;
    trigger: z.ZodEnum<["manual", "pre_compaction", "pre_clear", "pre_restore"]>;
    /** 开发者/用户标签(≤ 120 字) */
    label: z.ZodOptional<z.ZodString>;
    /** 快照时工作目录(恢复时对账用) */
    cwd: z.ZodString;
    model: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        model: string;
    }, {
        provider: string;
        model: string;
    }>>;
    /** 快照时上下文估算 */
    tokens: z.ZodOptional<z.ZodObject<{
        estimated: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        estimated: number;
    }, {
        estimated: number;
    }>>;
    /** pre_compaction 时指向本次压缩(与 session.compacted 对账) */
    compactionId: z.ZodOptional<z.ZodString>;
    messageCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    cwd: string;
    checkpointId: string;
    trigger: "manual" | "pre_compaction" | "pre_clear" | "pre_restore";
    messageCount: number;
    schemaVersion: 1;
    createdAt: string;
    compactionId?: string | undefined;
    label?: string | undefined;
    model?: {
        provider: string;
        model: string;
    } | undefined;
    tokens?: {
        estimated: number;
    } | undefined;
}, {
    sessionId: string;
    cwd: string;
    checkpointId: string;
    trigger: "manual" | "pre_compaction" | "pre_clear" | "pre_restore";
    messageCount: number;
    schemaVersion: 1;
    createdAt: string;
    compactionId?: string | undefined;
    label?: string | undefined;
    model?: {
        provider: string;
        model: string;
    } | undefined;
    tokens?: {
        estimated: number;
    } | undefined;
}>;
type ContextCheckpointMeta = z.infer<typeof ContextCheckpointMetaSchema>;
/** 快照对象(逻辑形:messages 为可直接作 initialMessages 的内联 IR 历史) */
declare const ContextCheckpointSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    /** ULID(时间有序,列举即时间线);兼作文件名段 */
    checkpointId: z.ZodString;
    sessionId: z.ZodString;
    /** ISO-8601 */
    createdAt: z.ZodString;
    trigger: z.ZodEnum<["manual", "pre_compaction", "pre_clear", "pre_restore"]>;
    /** 开发者/用户标签(≤ 120 字) */
    label: z.ZodOptional<z.ZodString>;
    /** 快照时工作目录(恢复时对账用) */
    cwd: z.ZodString;
    model: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        model: string;
    }, {
        provider: string;
        model: string;
    }>>;
    /** 快照时上下文估算 */
    tokens: z.ZodOptional<z.ZodObject<{
        estimated: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        estimated: number;
    }, {
        estimated: number;
    }>>;
    /** pre_compaction 时指向本次压缩(与 session.compacted 对账) */
    compactionId: z.ZodOptional<z.ZodString>;
    messageCount: z.ZodNumber;
} & {
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        blocks: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
            t: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "text";
            text: string;
        }, {
            t: "text";
            text: string;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"thinking">;
            text: z.ZodString;
            signature: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        }, {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"opaque">;
            provider: z.ZodString;
            payload: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            t: "opaque";
            provider: string;
            payload?: unknown;
        }, {
            t: "opaque";
            provider: string;
            payload?: unknown;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"tool_call">;
            id: z.ZodString;
            name: z.ZodString;
            args: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        }, {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"tool_result">;
            callId: z.ZodString;
            content: z.ZodArray<z.ZodDiscriminatedUnion<"t", [z.ZodObject<{
                t: z.ZodLiteral<"text">;
                text: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                t: "text";
                text: string;
            }, {
                t: "text";
                text: string;
            }>, z.ZodObject<{
                t: z.ZodLiteral<"image">;
                mime: z.ZodString;
                data: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                t: "image";
                mime: string;
                data: string;
            }, {
                t: "image";
                mime: string;
                data: string;
            }>]>, "many">;
            isError: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        }, {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        }>, z.ZodObject<{
            t: z.ZodLiteral<"image">;
            mime: z.ZodString;
            data: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            t: "image";
            mime: string;
            data: string;
        }, {
            t: "image";
            mime: string;
            data: string;
        }>]>, "many">;
        meta: z.ZodOptional<z.ZodObject<{
            kind: z.ZodOptional<z.ZodEnum<["compaction_summary"]>>;
            compactionId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        }, {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }, {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    messages: {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }[];
    sessionId: string;
    cwd: string;
    checkpointId: string;
    trigger: "manual" | "pre_compaction" | "pre_clear" | "pre_restore";
    messageCount: number;
    schemaVersion: 1;
    createdAt: string;
    compactionId?: string | undefined;
    label?: string | undefined;
    model?: {
        provider: string;
        model: string;
    } | undefined;
    tokens?: {
        estimated: number;
    } | undefined;
}, {
    messages: {
        role: "user" | "assistant";
        blocks: ({
            t: "text";
            text: string;
        } | {
            t: "thinking";
            text: string;
            signature?: string | undefined;
        } | {
            t: "opaque";
            provider: string;
            payload?: unknown;
        } | {
            t: "tool_call";
            id: string;
            name: string;
            args?: unknown;
        } | {
            t: "tool_result";
            callId: string;
            content: ({
                t: "text";
                text: string;
            } | {
                t: "image";
                mime: string;
                data: string;
            })[];
            isError?: boolean | undefined;
        } | {
            t: "image";
            mime: string;
            data: string;
        })[];
        meta?: {
            kind?: "compaction_summary" | undefined;
            compactionId?: string | undefined;
        } | undefined;
    }[];
    sessionId: string;
    cwd: string;
    checkpointId: string;
    trigger: "manual" | "pre_compaction" | "pre_clear" | "pre_restore";
    messageCount: number;
    schemaVersion: 1;
    createdAt: string;
    compactionId?: string | undefined;
    label?: string | undefined;
    model?: {
        provider: string;
        model: string;
    } | undefined;
    tokens?: {
        estimated: number;
    } | undefined;
}>;
type ContextCheckpoint = z.infer<typeof ContextCheckpointSchema>;
/** writeCheckpoint 的输入:机械字段(schemaVersion/messageCount)由本模块填充 */
type ContextCheckpointInput = Omit<ContextCheckpoint, 'schemaVersion' | 'messageCount'>;
/**
 * R-3(doc/117 R-3)— 快照保留策略:写入时按两者淘汰(先按龄再按数;皆缺省不限)。
 * 龄以**本次写入快照的 createdAt** 为基准(调用方的「现在」;kernel 不读时钟——确定性、
 * 可测),`createdAt < 基准 − maxAgeDays` 的既有快照淘汰;随后仍超 `max` 则按 checkpointId
 * 升序(ULID = 时间序)淘汰最旧至 `max` 条,不分 trigger(D-4 A)。被淘汰快照的附件经
 * 引用计数 GC(见 deleteCheckpoint)。
 */
interface CheckpointRetention {
    /** 同会话快照数上限(缺省不限) */
    max?: number;
    /** 同会话快照最长保留天数(可为小数;缺省不限) */
    maxAgeDays?: number;
}
/**
 * 导出体格式判别(自包含字节形):`{ format, checkpoint, attachments }`——`checkpoint` 为落盘形
 * (image 块以 `$ref:'sha256:<hex>'` 引用,不内联字节;messageCount 等头部字段齐全),
 * `attachments` 为 sha256hex → base64 字节(快照引用的全部图像,导入端逐项校验摘要)。
 * 纯函数,不触盘:sdk `exportCheckpoint` / serve `GET …/export` 以 CheckpointStore.get 的逻辑形
 * 喂入;导入端反向为 ContextCheckpointInput 交 writeCheckpoint / CheckpointStore.put。
 */
declare const CHECKPOINT_EXPORT_FORMAT: "tansr-checkpoint/1";

/**
 * 交互通道抽象:AskUser 工具与表面层之间的依赖注入缝。
 *
 * 设计要点:
 * - kernel 不知道"怎么问用户":TUI 注册对话框实现,headless
 *   缺省注入 UnavailableChannel(工具据此产出"自行决策并继续"的降级文案);
 * - `ask` 必须尊重 AbortSignal;即使实现忽略 signal,AskUser 工具侧也会兜底
 *   竞争 abort(见 ask-tool.ts),保证取消链贯穿;
 * - QueueChannel 供测试/编程式调用预置答案,行为完全确定。
 */
/** 单个可选项(id 进答案,label 给用户看/回给模型) */
interface QuestionOption {
    id: string;
    label: string;
}
/** AskUser 工具向用户提出的单个问题:提示语、至少两个可选项、是否允许多选。 */
interface Question {
    id: string;
    prompt: string;
    /** 至少 2 个选项(由 AskUser 工具 schema 强制) */
    options: QuestionOption[];
    /** true 允许多选;缺省单选 */
    allowMultiple?: boolean;
}
/** 用户对单个问题的回答:选中的选项 id 集合与可选的自由文本。 */
interface Answer {
    questionId: string;
    /** 选中的 option id 集合(单选题至多 1 个;可为空但需伴随 freeText) */
    selectedOptionIds: string[];
    /** 用户补充的自由文本(可与选项并存) */
    freeText?: string;
}
/** 交互通道:表面层实现「怎么问用户」,AskUser 工具经此提问;headless 场景注入不可用通道即降级。 */
interface PromptChannel {
    /**
     * 向用户提出一批问题,resolve 为对应答案。
     * - signal 中止 → reject(AbortError 形状);
     * - 通道不可用 → reject ChannelUnavailableError。
     */
    ask(questions: readonly Question[], signal: AbortSignal): Promise<Answer[]>;
}
/**
 * 测试/编程用通道:预置答案批次队列,每次 ask 出队一批;
 * 队列空 → reject(暴露测试脚本与实际提问次数不匹配)。
 */
declare class QueueChannel implements PromptChannel {
    #private;
    constructor(batches?: readonly (readonly Answer[])[]);
    /** 追加一批预置答案(对应未来的一次 ask) */
    enqueue(answers: readonly Answer[]): void;
    /** 剩余批次数(测试断言用) */
    get pending(): number;
    ask(_questions: readonly Question[], signal: AbortSignal): Promise<Answer[]>;
}
/** headless 缺省通道:任何提问立即失败,由 AskUser 工具转成降级 isError 文案 */
declare class UnavailableChannel implements PromptChannel {
    ask(_questions: readonly Question[], _signal: AbortSignal): Promise<Answer[]>;
}

/**
 * Web 搜索后端接口(可插拔)。
 *
 * 命名为 WebSearchProvider(而非 SearchProvider)以避开
 * 预留给代码检索(语义索引)的 SearchProvider
 * 名字空间——kernel 顶层出口是 `export *`,同名必撞。
 */
/** 单条搜索结果(结构化;渲染归表面层) */
interface WebSearchResultItem {
    title: string;
    url: string;
    snippet: string;
}
/** provider 收到的查询(maxResults 已被工具层夹紧到上限) */
interface WebSearchQuery {
    query: string;
    maxResults: number;
}
interface WebSearchProviderContext {
    /** 工具层合成的取消信号(ctx.signal + 工具内部超时) */
    signal: AbortSignal;
}
/**
 * 搜索后端契约:
 * - 返回结构化结果数组(可多于 maxResults,工具层会截断);
 * - 失败以 throw 表达(工具层捕获并转结构化错误);错误消息中**不得**
 *   出现密钥原文(实现方自行脱敏,内置 HTTP provider 见 http-search-provider.ts);
 * - 必须尊重 signal(至少把它传给底层 I/O)。
 */
interface WebSearchProvider {
    /** 后端名(进 ToolResult.data 供渲染与审计;如 "http") */
    readonly name: string;
    search(query: WebSearchQuery, context: WebSearchProviderContext): Promise<WebSearchResultItem[]>;
}

/**
 * 子代理定义(命名专家代理):公共类型与常量。
 *
 * 设计要点:
 * - `.tansr/agents/*.md` 自定义子代理 + 命名专家模板
 *   (数字员工心智,Amp 启示);
 * - `.claude/agents/*.md` 兼容形态(frontmatter name/description
 *   必填 + tools/model 等),覆盖顺序「越近越强」;
 * - 发现顺序 内置 → 用户(~/.tansr)→ 项目(.tansr),
 *   同名覆盖越近越强(与 skills/commands 一致);
 * - 安全铁律:定义中的 tools 白名单只在父 toolset 上做收窄,绝不引入
 *   父集合没有的工具(权限单调收缩)。
 *
 * 容错铁律(与 skills 同款):坏 frontmatter 单文件降级跳过 + 结构化诊断,
 * 不拖垮整体发现;诊断只携带名字/路径/键名等元信息,不携带文件正文内容。
 */

/** 代理定义来源(优先级升序:builtin < user < project,越近越强) */
type AgentSourceName = 'builtin' | 'user' | 'project';
/**
 * 子代理定义:内置模板与 `.tansr/agents/*.md` 文件的同构对象。
 * 文件形态:YAML frontmatter(name/description/tools/model)+ 正文 = system prompt。
 */
interface AgentDefinition {
    /** 规范名 = 文件基名(不含 .md;builtin 为常量名);Task.subagent_type 按此名调用 */
    name: string;
    /** 何时使用(给父模型看;拼进 Task 工具描述,英文为宜) */
    description: string;
    /** 子代理 system prompt(文件正文;必非空) */
    systemPrompt: string;
    /**
     * 工具白名单(可选):在父 toolset 上收窄,缺省 = 继承父 toolset 全部。
     * 空数组 = 纯文本子代理。名单里不存在于父集合的名字被丢弃(可观测),
     * 绝不放宽——白名单不能引入父 toolset 没有的工具。
     */
    tools?: readonly string[];
    /** 模型别名覆写(可选):经 TaskToolConfig.resolveModel 通路解析(三档 tier 或装配层注册的别名) */
    model?: string;
    /**
     * 权限档声明(可选):**仅 serve 会话档案(SessionInit.profile)消费**
     * ——serve 工厂按 managed 上界裁决后注入逐会话引擎;Task 子代理恒继承父
     * PermissionGate(INV-6),不读本位。词表 = protocol PERMISSION_MODES;
     * 项目来源定义声明扩权档(auto/acceptEdits/bypassPermissions)在解析期
     * 忽略 + 诊断(INV-4:仓库字节面不得扩权,收紧档照常生效)。
     */
    permissionMode?: PermissionMode;
    source: AgentSourceName;
    /** 定义文件绝对路径(builtin 无) */
    file?: string;
}

/**
 * 子代理机制公共类型与常量。
 *
 * 设计要点:
 * - 子代理 = 同一查询环的隔离实例(createSubagentContext 范式)——
 *   隔离消息历史、独立 agentId、父 abort 传播到同步子代理、非交互(不向用户提问);
 * - Amp 式命名专家子代理的分工心智:通用 Task 工具之上
 *   叠加 `.tansr/agents/*.md` 自定义定义;
 * - protocol 冻结:事件走既有 agent.spawned/progress/completed;agentId 注入
 *   事件包络的落点是自由字符串字段 `source`(形如 `agent:<agentId>`,对齐
 *   Claude Code `querySource: 'agent:...'`),不改包络 schema。
 *
 * 分层:本目录只依赖 protocol 类型与 kernel 内既有公共出口(query/types、
 * tools/dispatch、tools/types),不触碰 run-query/dispatch/context 内部。
 */

/**
 * 模型降档/覆写注入缝:kernel 不依赖 providers registry,由装配层(cli
 * assembly)传入 别名 → ResolvedModel 的映射。别名可为三档 tier(Task 参数
 * 面仍锁 SUBAGENT_MODEL_TIERS 枚举),也可为自定义代理定义声明的任意模型
 * 别名(别名合法性由装配层解析器裁决)。未注入时别名请求被忽略
 * (沿用父模型,结果 data 里以 modelTierIgnored 标注,不静默)。
 */
type SubagentModelResolver = (alias: string, parentModel: ResolvedModel) => ResolvedModel;
/**
 * 子模型上下文窗口解析缝:kernel 不依赖 providers registry,由
 * 装配层以 `registry.resolveAlias('<provider>/<model>').capability.maxContext`
 * 类闭包实现。入参是**已解析的子模型**(可能经 tier 降档,与父不同);返回
 * undefined = 窗口未知(运行器据此静默禁用子代理压缩装配,与四入口驱动
 * 「窗口未知禁用压缩」守卫同语义)。
 */
type SubagentContextWindowResolver = (model: ResolvedModel) => number | undefined;
/**
 * 工具集双面:registry 为执行面,toolDefs 为模型可见面(JSON Schema 由装配层
 * 生成,kernel 不做 zod→JSON Schema 转换)。两面按 name 配对。
 */
interface SubagentToolset {
    registry: ToolRegistry;
    toolDefs: IRToolDef[];
}

/**
 * 子代理记忆写围栏材料(MemoryWriteContext 的判定子集;刻意不携 onWrite
 * ——观测回调是主执行器写链的半边,拒绝壳不产生写观测)。
 */
type SubagentMemoryWriteFence = Pick<MemoryWriteContext, 'dirs' | 'caseInsensitivePaths'>;

/**
 * 子→父通知(report/settled 两通道)。宿主按头注「投递保证协议」消费:
 * 先 journal enqueue、再注入父屏障、父消费后 ack。notificationId 为配对键
 * (enqueue/ack 同携;resume 重投按其幂等)。
 */
type ContinuableNotification = {
    channel: 'report';
    agentId: string;
    notificationId: string;
    /** 子说的话(已剥控制序列 + 裁剪;与 agent.report.message 同源) */
    message: string;
    /** 唤醒请求(A1 只如实透传;闲唤醒门控在 A2) */
    wake: boolean;
} | {
    channel: 'settled';
    agentId: string;
    notificationId: string;
    /** 结算 outcome(TerminalReason 词表) */
    outcome: string;
    /** 纪元最终文本(已剥控制序列 + 裁剪;无产出为空串) */
    summary: string;
};

/** 后台运行的结算载荷(Task 工具组装;runner 只负责投递与落盘) */
interface TaskBackgroundSettlement {
    /** raw 终局原因(TerminalReason 词表;通知 payload outcome 位保真) */
    outcome: string;
    /** 注入父会话的结算正文(五态头 + 部分成果标记 + 摘要 + 统计,已拼好) */
    summary: string;
    /** 输出文件全文(markdown;缺省 = summary) */
    fileContents: string;
}
interface TaskBackgroundRunnerOptions {
    /**
     * 跨轮事件出口(装配层注入 driver 级 emit,与 ContinuableAgentManager
     * 同一出口):后台子代理的 agent.* 与 cost.usage.updated 经此进会话账。
     */
    emit: (body: EventBody) => void;
    /**
     * settlement 通知出口(装配层注入 AgentNotificationsBridge.deliver):
     * 投递保证协议(journal enqueue → 注入 → ack)在宿主侧,与常驻子代理
     * 同一条管道。拒绝被兜住并以 agent.progress 上浮(恒不静默)。
     */
    onNotification: (notification: ContinuableNotification) => void | Promise<void>;
    /**
     * 落盘注入缝(测试确定性);缺省 node:fs/promises mkdir+writeFile。
     * Q4-6(EW-1)豁免记录:后台报告落盘与 ShellOutputSink 同类——脱离
     * ToolContext 生命周期的宿主侧产物,不经 FsLike 缝。
     */
    writeFileImpl?: (filePath: string, contents: string) => Promise<void>;
    /** 通知 id 生成注入(测试确定性);缺省 randomUUID */
    generateNotificationId?: () => string;
}
/** AUD-F3 — launch 同步结果:容量拒绝以结构化形态回喂 Task 工具(不 throw) */
type TaskBackgroundLaunchResult = {
    launched: true;
} | {
    launched: false;
    reason: 'capacity';
    inFlight: number;
    limit: number;
};
/** AUD-F3 — 在飞任务快照(/agents 后台节的 list 数据源) */
interface TaskBackgroundTaskInfo {
    agentId: string;
    description: string;
    /** 起跑时刻(epoch ms;launch 受理时点) */
    startedAtMs: number;
    /** running = 在跑;aborting = kill 已下达、等 settle */
    status: 'running' | 'aborting';
}
declare class TaskBackgroundRunner {
    #private;
    constructor(options: TaskBackgroundRunnerOptions);
    /**
     * 会话级关停信号(drain 时以 shutdown 品牌载荷 abort)。AUD-F3:运行
     * 信号已改逐任务派生(launch 把 per-task signal 交给 run 闭包),本
     * getter 只余「会话是否在拆除」的观测语义。
     */
    get signal(): AbortSignal;
    /** 跨轮事件出口透出(run 闭包给 runSubagent 的 emitToParent 用) */
    emit(body: EventBody): void;
    /** 在飞后台运行数(测试断言面) */
    get size(): number;
    /** AUD-F3:在飞任务快照(agentId/描述/起跑时刻/状态;插入序) */
    list(): TaskBackgroundTaskInfo[];
    /**
     * AUD-F3 取消原语:按 agentId 单点 abort(user_interrupt 品牌)。终局走
     * 既有结算路径——runSubagent 软停收束,settle 写盘/通知照发(outcome
     * aborted 保真)。未知/已收束 agentId 返回 false(呈现层如实反馈)。
     */
    kill(agentId: string): boolean;
    /**
     * 登记一次后台运行。run 闭包由 Task 工具构造(内含 runSubagent 全特性
     * 路径,signal 取 launch 派生的逐任务信号);同步返回,结算异步投递。
     * AUD-F3:在飞达硬帽时同步返回结构化拒绝(不 throw——容量是运行期
     * 常态而非编程错误,Task 工具据此回喂模型)。
     */
    launch(input: {
        agentId: string;
        description: string;
        outputFile: string;
        run: (signal: AbortSignal) => Promise<TaskBackgroundSettlement>;
    }): TaskBackgroundLaunchResult;
    /** Child ownership survives business settlement and removal from the task list. */
    registerResource(work: Promise<ResourceSettlementResult>): void;
    /** Physical completion; drain retains its existing shutdown/business contract. */
    settleResources(options?: ResourceSettleOptions): Promise<ResourceSettlementResult>;
    /**
     * 拆除(会话退出优雅收尾):关准入 → abort 全部在飞(shutdown 保真)→
     * 等收束。拆除期不写盘不通知。幂等。
     */
    drain(): Promise<void>;
}

/**
 * 成本感知子代理分派策略。
 *
 * 职责:Task 子代理**无显式模型请求**时的档位路由——「实时价 × 能力档」,
 * 对标差异化:五家硬编码降档(CC→Haiku),tansr 按平台实时价目取经济档。
 *
 * 档位语义(任务类 → 档位):
 * - 探索/检索类(内置 code-reviewer,只读四件套)→ 'economy':经济档 =
 *   装配层注入的有序候选链(bundle 已定价 chat 档最低价者 → fast 别名),
 *   全部不可得回落 inherit;
 * - 主编码/通用(通用子代理、test-runner、docs-writer)→ 'inherit':恒随
 *   父会话模型;
 * - **新增/未知类型缺省 'inherit'(fail-safe)**:映射表查无此名恒不降档;
 * - 分类/裁决类辅助任务(权限分类器/裁决人/压缩/标题/记忆抽取)的 fast
 *   纪律是**既有旁路装配**,不经本模块,恒不动。
 *
 * 优先级铁律(恒不覆写显式指定):
 * 1. 调用参数 `model`(用户/父模型显式请求)——策略恒不适用;
 * 2. 代理定义 `model`(定义作者显式覆写)——策略恒不适用;
 * 3. 本策略(类型映射 → 经济档候选链);
 * 4. inherit(父模型,现状)。
 *
 * 关断开关(A5 公理):policy.enabled=false 或装配层不注入 policy =
 * 策略整体关闭,回落现状(inherit 一切);缺省开。装配层另有 env 逃生口
 * (cli assembly/subagent-dispatch.ts,TANSR_SUBAGENT_DISPATCH=0)。
 *
 * wire 安全守卫:子代理缺省复用**父查询环 client**(endpoint 绑定构造),
 * 跨 provider 的模型名会被发到父端点(wire 语义破坏)。同 provider 候选
 * 直接生效;跨 provider 候选(CW18-N6b)经装配层注入的独立 client 构造缝
 * economyClientFor 放行——守卫防的是「用 A 家 client 发 B 家模型」的错发,
 * B 家模型配上 B 家 client 即无错发;构造缝缺席或该候选不可构造(凭据
 * 缺席等,缝返回 undefined)时照旧逐个跳过、全败回落 inherit(显式请求
 * 径不受此限——既有 resolveModel 语义原样)。恒不把父 client 凭据错用于
 * 他家端点:跨 provider 候选要么配自家 client 要么被跳过,无第三态。
 *
 * 分层铁律:kernel 不解析别名、不读 bundle——经济档候选由装配层注入
 * (SubagentDispatchPolicy.economyCandidates,派生时点求值 = 实时价)。
 *
 * 装载期不变式(W2 entry-budgets 同族建制,常量集中本文件、恒不写进
 * entry-budgets 本体——上下文预算与分派策略分文件):模块顶层执行
 * assertDispatchPolicyInvariants(),映射表改坏在进程启动/首个测试就炸。
 */

/** 经济档候选来源:'pricing' = bundle 已定价 chat 最低价;'fast_alias' = 价目不可得回落 fast 别名 */
type SubagentEconomyBasis = 'pricing' | 'fast_alias';
/** 经济档候选(装配层产出;链序 = 回落序) */
interface SubagentEconomyCandidate {
    model: ResolvedModel;
    basis: SubagentEconomyBasis;
}
/**
 * 分派策略注入面(TaskToolConfig.dispatchPolicy;嵌套派生经 config 展开
 * 自动继承)。缺席 = 策略未装配 = 现状(inherit 一切)。
 */
interface SubagentDispatchPolicy {
    /** A5 关断开关:false = 策略整体关闭回落现状;缺省 true(开) */
    enabled?: boolean;
    /**
     * 经济档有序候选链(**派生时点**求值——bundle 配置热刷新后新派生即见
     * 新价;doc/61「实时价」语义)。缺席/空链 = 经济档不可得(回落 inherit)。
     */
    economyCandidates?: () => readonly SubagentEconomyCandidate[];
    /**
     * CW18-N6b — BYOK 跨 provider 经济档独立 client 构造缝:候选 provider ≠
     * 父模型 provider 时,决策单点经本缝为候选取其所属 provider 的独立
     * client(装配层按该 provider 配置构造——baseUrl/方言/鉴权 env 与主装配
     * 同源同律)。返回 undefined = 该候选不可构造(如凭据缺席),fail-safe
     * 跳过落回落链下一位;抛错 = 编程性异常(装配层契约:结构化构造失败
     * 恒收敛为 undefined,不上抛)。缺席 = 旧语义恒旧:跨 provider 候选
     * 一律被 wire 守卫跳过。同 provider 候选恒不经本缝(复用父 client)。
     */
    economyClientFor?: (model: ResolvedModel) => ModelClient | undefined;
}

/**
 * 派生裁决链装配段:装配层按会话
 * 形态与权限模式注入;缺席 = 现状(子代理 ask 落 fail-closed 地板)。
 */
interface TaskAdjudicationConfig {
    /**
     * 动态启用谓词——**派生时点**求值(会话中切模式即时生效):装配层绑
     * 权限模式(仅 default 走链)与 env 逃生口
     * (TANSR_DELEGATION_ADJUDICATION=0 关闭)。false = 本次派生
     * 不建链(子代理 ask 回地板)。
     */
    enabled: () => boolean;
    /**
     * 链顶终审通道:装配层询问回调**同一实例**(TUI 弹卡 / K11 挑战投递)。
     * dontAsk(「不要问我」禁止上升到用户)与 headless 无通道时不注入——
     * endorse/escalate 落地板,净效果 = 现状,只多父裁决理由留痕。
     */
    askUser?: AskUserCallback;
    /** 共享咨询预算/熔断 gate(与权限分类器同池;装配层组合引擎公共口) */
    budget?: AdjudicationBudgetGate;
    /**
     * auto 半径内父终审档:endorse 出口时点
     * 求值;null = 无终审权(default/dontAsk),档位 = auto 且门开(半径 =
     * 资格链 SOFTEN_RADIUS,'none' 档半径恒空)。装配层以「模式 × 门开 ×
     * 引擎生效档」组合;缺省恒 null(无父终审形态)。
     */
    endorseFinalizeTier?: () => EffectiveQualificationTier | null;
    /**
     * 分类器软化抑制谓词:真值时子代理调用的 safe→allow 让位父终审
     * (经门 hints 收紧;unsafe→deny 保留)。装配层以「auto × 门开」表达;
     * 缺省 = 分类器全权(回退形态)。
     */
    suppressClassifierSoften?: () => boolean;
    /**
     * 裁决模型覆写(远程治理档):client 与 model **成对**注入——换档
     * 可能换适配器/鉴权面,分层铁律下 kernel 不解析别名,由装配层从 bundle
     * adjudicator.modelHandle 经 registry 解析后成对交付。缺省 = 父查询环
     * client + parentModel(缓存热前缀形态);覆写档的裁决查询
     * 前缀不再与父主会话共缓存——治理档语义(平台指定裁决人)优先于该优化。
     */
    model?: {
        client: ModelClient;
        model: ResolvedModel;
    };
    /**
     * 裁决查询 usage 回报缝(budgets.maxUsd 计量半边):
     * 每次真实裁决查询的 provider usage 回调一次,装配层累计会话内裁决
     * 成本估算(与 budget gate 的远程档预算检查组成消费闭环)。嵌套派生
     * 经 config 展开继承同一回调——各级裁决查询同入会话账。缺省零开销。
     */
    onQueryUsage?: (usage: IRUsage) => void;
    /** 裁决查询输出预算;缺省 512 */
    maxTokens?: number;
    /** 裁决查询超时(毫秒);缺省 30_000 */
    timeoutMs?: number;
}
interface TaskToolConfig {
    /** 模型客户端(通常与父查询环共享实例) */
    client: ModelClient;
    /**
     * 子代理 system 段(装配层可复用 assembleSystem 产物)。函数形态
     * (OPT-16 遗留收口):派生时取值而非创建期快照——输出风格等 system
     * 热切换后,新派生的通用子代理拿到当前 system(命名专家仍用定义正文,
     * 不受影响);数组形态维持既有快照语义(headless/serve/acp 的 system
     * 会话内静态,两形态等价)。
     */
    system: IRSystemSegment[] | (() => IRSystemSegment[]);
    /** 父工具集双面(registry + toolDefs 按 name 配对;由装配层构造) */
    toolset: SubagentToolset;
    /** 父模型(未降档时子代理沿用) */
    parentModel: ResolvedModel;
    maxTokens: number;
    sessionId: string;
    /** 父权限门(子代理同实例沿用,不得放宽);缺省全放行(与调度器一致) */
    permissionGate?: PermissionGate;
    /** 子执行器 cwd;缺省取执行时 ToolContext.cwd */
    cwd?: string;
    /** 模型降档映射注入缝(装配层从 provider registry 三档别名构造) */
    resolveModel?: SubagentModelResolver;
    /**
     * CW13-N6 — 成本感知分派策略(agents/dispatch-policy.ts):无显式模型
     * 请求时按「类型→档位」映射与经济档候选链路由;显式请求(调用参数
     * model / 定义 model)恒最优先恒不覆写。缺席 = 现状(inherit 一切);
     * enabled=false = 关断开关(A5)。嵌套派生经 config 展开自动继承。
     */
    dispatchPolicy?: SubagentDispatchPolicy;
    /** 硬排除集覆盖;缺省 DEFAULT_SUBAGENT_EXCLUDED_TOOLS */
    excludedTools?: readonly string[];
    /** 子代理 modelTurns 预算;缺省 DEFAULT_SUBAGENT_MAX_TURNS */
    subagentMaxTurns?: number;
    /**
     * Q4-24 — 同轮 Task 并发上限(方案键 taskConcurrency 的装配落点):≥2 时
     * 本工厂在工具声明面落 selfConcurrency(调度器同名自并发组语义,见模块
     * 头注释);缺省/1/非法值不落键 = 独占串行,与既往字节零漂移。嵌套派生
     * 经 config 展开自动继承——每级子代理的执行器各自持上限 N(深度门与
     * 白名单单调收缩不因并发改变)。
     *
     * Q4-24b(2026-08-27)函数形态 = 活读:调度器 selfConcurrencyOf 在每次
     * 调用评估时点经 getter 取现值——方案远端热更新、运行期 /scheme 切换
     * 即时生效,不再启动期冻结(缘起:平台方案携键但启动装配吃到刷新前
     * 快照,并发整程冻结 1、重启才愈)。数字形态语义与既往逐字节一致;
     * 函数返回值同判据(非整数/<2 视同独占),嵌套派生同 config 展开继承
     * 同一 getter(各级读数同源)。
     */
    concurrency?: number | (() => number);
    /** 子执行器每工具调用硬超时(毫秒) */
    childToolTimeoutMs?: number;
    /** 文件 checkpoint 采集缝(OPT-13;与父执行器同一实例,嵌套派生自动继承) */
    captureFileCheckpoints?: CaptureFileCheckpoints;
    /** 决策归因记录缝(T-K10a;与父执行器同一回调,嵌套派生自动继承) */
    onDecision?: OnToolDecision;
    /** 摘要裁剪上限(tokens,测试注入);缺省 SUBAGENT_SUMMARY_MAX_TOKENS */
    summaryMaxTokens?: number;
    /** 持有本实例的代理深度:主代理装配传 0(缺省);嵌套实例由本工厂自动 +1 */
    depth?: number;
    /** 持有本实例的代理 agentId(主代理缺省;进 agent.spawned.parentAgentId) */
    parentAgentId?: string;
    /** 子事件观测缝(独立 turnId/seq、source=`agent:<agentId>`);嵌套层共用 */
    onChildEvent?: (event: KernelEvent) => void;
    /** agentId 生成注入(测试确定性);缺省 randomUUID */
    generateAgentId?: () => string;
    /** 时钟注入;缺省 Date.now */
    now?: () => number;
    /**
     * 子代理压缩装配(注入纪律与守卫语义见
     * SubagentRunOptions.compaction):装配层传父方案展开产物同款的查询级
     * 字段(不得含 manager/session);observer 由运行器按派生期 agentId
     * 包装注入。嵌套派生经 config 展开自动继承(孙代理同组参数、各自
     * agentId 标识)。缺省 = 现状(子代理无压缩)。
     */
    compaction?: QueryCompactionOptions;
    /** 子模型窗口解析缝(嵌套派生自动继承) */
    resolveContextWindow?: SubagentContextWindowResolver;
    /**
     * 工具结果预算透传:persist 应与父会话同一闭包实例(落同一
     * 会话 tool-results 目录,子代理大结果父会话可回查);嵌套派生自动继承。
     */
    toolResultBudget?: ToolResultBudgetOptions;
    /**
     * 可用命名专家目录:内置模板 + 已发现自定义,装配层经
     * discoverAgents 合并注入(项目层同名优先)。缺省 = 无命名代理
     * (subagent_type 一律未知名错误,工具描述不列清单)。
     */
    agents?: readonly AgentDefinition[];
    /**
     * 派生裁决链:注入即子代理 ask 经父裁决链(派生时点快照 +
     * 三出口 + 终审弹卡);缺省 = 现状地板。嵌套派生经 config 展开自动
     * 继承——孙代理的裁决人是子代理(其 Task 实例在子查询环内执行,快照
     * 取子查询环消息,各级天然自取)。
     */
    adjudication?: TaskAdjudicationConfig;
    /**
     * P1-B(2026-08-25 代拍板;doc/60 §3.3 隔离纪律)— McpDiscover 子代理
     * 换装工厂:生效集含 McpDiscover 时,派生前以本工厂产物同名替换——
     * 装配层闭包 lazy-manager,产 `createMcpDiscoverTool(manager.forToolset(子
     * 生效集))` 子视图绑定实例,子代理内的展开只写子代理自己的
     * registry/toolDefs,恒不写回父。**材料缺席即摘除**(nestedTask 同款
     * 防御位:父实例直透会把展开写进父工具面 = 隔离违规 + 子代理调不动的
     * 虚假承诺;装配层恒注入,缺席仅出现在未接线的测试装配)。嵌套派生经
     * config 展开自动继承(孙代理换装绑孙生效集,视图链递归安全)。
     */
    mcpDiscover?: (toolset: SubagentToolset) => Tool;
    /**
     * TMEM/3 批β P1-A① — 记忆写围栏嵌套透传位:主代理实例恒缺席(围栏
     * 材料在派生时点自 ToolContext.memoryWrite 取现值,门开即有,零装配
     * 接线);嵌套实例经本位持有冻结围栏(子执行器无 memoryWrite 上下文
     * 可读,{...config} 展开自动继承)。求值序 ctx 优先(活值)。
     */
    memoryWriteFence?: SubagentMemoryWriteFence;
    /**
     * TC-C1 — Task 后台档位材料(**方案键 continuableAgents 门控**,装配层
     * 仅门开时注入,与 SpawnAgent 同门):在场且本实例 depth=0(主代理)时
     * 暴露 run_in_background 参数;缺席/嵌套实例不暴露(schema 与描述均无
     * 此参,幻觉传入被 z.object 剥除 → 恒前台),现状零漂移。后台运行沿用
     * runSubagent 全特性路径,仅生命周期/事件/通知出口换 runner 域(kimi
     * root-only 同律:后台派生仅主代理——嵌套后台的 settlement 会注入主
     * 会话而其直接父是一次性子代理,归属失真,模型层禁)。
     */
    background?: TaskBackgroundConfig;
}
/** TC-C1 — Task 后台档位装配段(runner 为会话级单例,出口接线见其选项) */
interface TaskBackgroundConfig {
    runner: TaskBackgroundRunner;
}

/**
 * SpeechToText(ASR)内置工具骨架(自 sdk platform/speech-to-text-tool.ts
 * 迁入——参数 schema / 常量 / 描述正文 / 文本投影逐字迁入)。
 *
 * 音频上行**不入 IR 块**(协议冻结面零触碰):`audio` 位携 data:audio/*;base64 URI
 * 或 http(s) URL,由提供方取字节上行;产物是文本,天然回到 IR 文本世界。
 */

/**
 * 客户端硬超时缺省(毫秒;kernel Tool.timeoutMs 位;doc/123 B-2「asr 120s」)。
 * 转写为秒级任务(60 s 音频常 < 10 s),120 s 覆盖长音频 + 网关前置 + 回传;
 * 与 kernel 120s 统一档同值,显式声明只为口径可见可覆盖。
 */
declare const SPEECH_TO_TEXT_TOOL_TIMEOUT_MS = 120000;
/** SpeechToText 工具参数 schema:模型(可省)、待转写音频(data URI 或 http(s) URL)、语言提示与说话人分离开关。 */
declare const SpeechToTextArgsSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    audio: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    diarize: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    audio: string;
    model?: string | undefined;
    language?: string | undefined;
    diarize?: boolean | undefined;
}, {
    audio: string;
    model?: string | undefined;
    language?: string | undefined;
    diarize?: boolean | undefined;
}>;
/** SpeechToText 工具的已校验参数类型(SpeechToTextArgsSchema 推导)。 */
type SpeechToTextArgs = z.infer<typeof SpeechToTextArgsSchema>;

/**
 * TextToSpeech(TTS)内置工具骨架(自 sdk platform/text-to-speech-tool.ts
 * 迁入——参数 schema / 常量 / 描述正文 / 文本投影逐字迁入)。
 *
 * 产物形:`audio: { url? | b64?, mime, format, durationMs?, sampleRate? }`——URL 托管形原样
 * 透出、内联形以 b64 透出;消费方按 `url ?? b64` 取用。本骨架加落盘缝:`audio.b64` 在场且
 * `artifactSink` 在场 → 落盘并写 `audio.path` 加法键(sdk 恒不接 sink,data 逐字不变;serve 接
 * `exposePath:false` 的 sink——落盘但空串返回,path 不出线;描述落盘句随 `sinkExposesPath`
 * 三态)。
 */

/**
 * 客户端硬超时缺省(毫秒;kernel Tool.timeoutMs 位;doc/123 B-2「tts 60s」)。
 * 合成为秒级(18 字符 ≈ 1–3 s),60 s 覆盖长文 + 网关前置 + 回传;显式声明盖过
 * kernel 120s 统一档(合成不该等两分钟——超时即告知用户而非空等)。
 */
declare const TEXT_TO_SPEECH_TOOL_TIMEOUT_MS = 60000;
/** 平台缺省字数帽(doc/123 §3.2「≤ maxChars,缺省帽 2000」;约束缺席时描述用) */
declare const TEXT_TO_SPEECH_DEFAULT_MAX_CHARS = 2000;
/** 输出格式词表(家族不受理的格式按面档回落,如 dashscope 恒 wav) */
declare const TEXT_TO_SPEECH_FORMATS: readonly ["wav", "mp3"];
/** TextToSpeech 工具参数 schema:模型(可省)、待朗读文本、音色 id 与输出格式。 */
declare const TextToSpeechArgsSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    input: z.ZodEffects<z.ZodString, string, string>;
    voice: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodEnum<["wav", "mp3"]>>;
}, "strip", z.ZodTypeAny, {
    input: string;
    model?: string | undefined;
    format?: "wav" | "mp3" | undefined;
    voice?: string | undefined;
}, {
    input: string;
    model?: string | undefined;
    format?: "wav" | "mp3" | undefined;
    voice?: string | undefined;
}>;
/** TextToSpeech 工具的已校验参数类型(TextToSpeechArgsSchema 推导)。 */
type TextToSpeechArgs = z.infer<typeof TextToSpeechArgsSchema>;

/**
 * VideoGen 内置工具骨架(imagegen.ts 同构镜像,自 sdk
 * platform/videogen-tool.ts 迁入——参数 schema / 常量 / 描述正文 / 文本投影逐字迁入)。
 * 视频无业界标准 BYO wire,提供方仅平台径(sdk)或自定义注入。
 */

/** 时长 wire 帽(秒;与网关 TwpVideogenRequestSchema 同值;超模型帽由后端再钳)。 */
declare const VIDEOGEN_TOOL_MAX_DURATION = 30;
/**
 * 客户端硬超时缺省(毫秒;kernel Tool.timeoutMs 位)= 服务端轮询预算 600s
 * (tansr-api VIDEOGEN_DEFAULT_TIMEOUT_MS,解出层全模型恒用此值)+ 60s 余量
 * (请求上行/网关前置[认证/限流/配额/预扣]/响应回传)。/t1/videogen 系服务端
 * 同步长等——客户端必须等到服务端先出结论(成功或 upstream_timeout 退款),
 * 恒不先掐:客户端先超时会复现「服务端成功结算而智能体无产出」的有扣无产
 * (2026-09-01 定谳:kling-v3 实测 122-185s,kernel 120s 缺省档下结构性必超时,
 * 三笔 ¥2.40 计 ¥7.20 有扣无产)。
 */
declare const VIDEOGEN_TOOL_TIMEOUT_MS = 660000;
/** VideoGen 工具参数 schema:模型(可省)、正负提示词、时长、画幅比、种子与图生视频的首帧图。 */
declare const VideoGenArgsSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    prompt: z.ZodEffects<z.ZodString, string, string>;
    negativePrompt: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    ratio: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    model?: string | undefined;
    duration?: number | undefined;
    seed?: number | undefined;
    negativePrompt?: string | undefined;
    ratio?: string | undefined;
    imageUrls?: string[] | undefined;
}, {
    prompt: string;
    model?: string | undefined;
    duration?: number | undefined;
    seed?: number | undefined;
    negativePrompt?: string | undefined;
    ratio?: string | undefined;
    imageUrls?: string[] | undefined;
}>;
/** VideoGen 工具的已校验参数类型(VideoGenArgsSchema 推导)。 */
type VideoGenArgs = z.infer<typeof VideoGenArgsSchema>;

/**
 * 媒体工具族提供方缝与工具选项(媒体能力内核化)。
 *
 * 四工具(ImageGen / VideoGen / SpeechToText / TextToSpeech)自 sdk 平台工具迁入为 kernel
 * 内置工具(先例:WebSearch + WebSearchProvider 缝)。切法:**工具骨架进 kernel**
 * (参数 schema / 描述装配 / 超时 / 错误纪律 / data 组装 / 产物落盘缝),**执行后端是缝**——
 * sdk 供平台提供方(令牌闭包 / 任务径轮询 / 网关错误信封 → MediaProviderError + hint 表),
 * kernel 自带 openai-compatible BYO 三件,cli 按 env / 平台段择一注入。
 *
 * 提供方契约(四件同律):
 * - `name` 进审计与描述装配,**恒不进 ToolResult.data**(产物形逐字 = protocol media.ts,不加键);
 * - `models` 三态:缺席 = 授权集未知(描述回落通用指引)/ `[]` = 未配置(描述如实注明)/
 *   非空 = 自列(顺位第一 = `model` 缺省时的生效模型);
 * - 成功返回 Outcome(= protocol *Data 去 errorCode;model 位以提供方回显为准,呈现真实所用模型);
 * - 失败以 throw 表达:`MediaProviderError{ code, message, hint?, taskId? }` 由工具层归一为
 *   isError 结构化结果(data.errorCode = code);其它异常 → `provider_error`;
 * - 必须尊重 `ctx.signal`(工具层合成的 ctx.signal + 工具内部超时);信号触发后仍可 throw
 *   `MediaProviderError`(如平台任务径以 `task_pending` + taskId 交出找回径)——工具层给
 *   一段结算宽限再判超时/中断(见 errors.ts runMediaProvider)。
 */

interface MediaProviderContext {
    /** 工具层合成的取消信号(ctx.signal + 工具内部超时);提供方至少把它传给底层 I/O */
    signal: AbortSignal;
}
/** ImageGen 成功产出(= ImageGenData 去 errorCode;taskId 仅平台任务径在场) */
interface ImageGenOutcome {
    model: string;
    images: Array<{
        url: string;
    }>;
    imageCount: number;
    taskId?: string;
}
interface ImageGenProvider {
    /** 'tansr' | 'openai-compatible' | 自定义(进审计,不进 data) */
    readonly name: string;
    /** 缺席 = 集未知(描述回落通用指引);[] = 未配置(描述如实) */
    readonly models?: readonly ImageModelDescriptor[];
    generate(args: ImageGenArgs, ctx: MediaProviderContext): Promise<ImageGenOutcome>;
}
/** VideoGen 成功产出(= VideoGenData 去 errorCode) */
interface VideoGenOutcome {
    model: string;
    videos: Array<{
        url: string;
    }>;
    videoCount: number;
    billedSeconds: number;
    taskId?: string;
}
interface VideoGenProvider {
    readonly name: string;
    readonly models?: readonly VideoModelDescriptor[];
    generate(args: VideoGenArgs, ctx: MediaProviderContext): Promise<VideoGenOutcome>;
}
/** SpeechToText 成功产出(= TranscriptData 去 errorCode) */
type TranscriptOutcome = Omit<TranscriptData, 'errorCode'>;
interface SpeechToTextProvider {
    readonly name: string;
    readonly models?: readonly SpeechToTextModelDescriptor[];
    transcribe(args: SpeechToTextArgs, ctx: MediaProviderContext): Promise<TranscriptOutcome>;
}
/** TextToSpeech 成功产出(= SpeechData 去 errorCode,audio 必在场;url 与 b64 至少一者在场) */
type SpeechOutcome = Omit<SpeechData, 'errorCode'> & {
    audio: SpeechAudio;
};
interface TextToSpeechProvider {
    readonly name: string;
    readonly models?: readonly TextToSpeechModelDescriptor[];
    synthesize(args: TextToSpeechArgs, ctx: MediaProviderContext): Promise<SpeechOutcome>;
}

/**
 * ImageGen 内置工具骨架(媒体能力内核化;自 sdk platform/imagegen-tool.ts
 * 迁入——参数 schema / 常量 / 描述正文 / 文本投影逐字迁入,网关径(令牌头 / 任务径轮询 /
 * 错误信封 / hint 表)留在 sdk 平台提供方)。
 *
 * 工具骨架职责(四件同律):① provider null → 结构化 `imagegen_not_configured`;② 描述 = 固定
 * 正文 + 授权集自列(describe.ts);③ withTimeout(ctx.signal, timeoutMs) 合成信号交提供方;
 * ④ MediaProviderError → isError + data.errorCode = code + message + (hint ?? 通用指引)+ taskId
 * 透出,其它异常 → provider_error,超时 / 中断 → timeout / aborted;⑤ 成功 → data 逐字按
 * protocol ImageGenData 组装(提供方 name 恒不进 data),文本投影逐字沿 sdk 现形;⑥ 计费副作用
 * 真实存在——恒不声明只读 / 并发安全(effects 沿 sdk 现值 external,信号非闸门)。
 */

/** 生成张数 wire 帽(与网关 TwpImagegenRequestSchema 同值;超模型帽由后端再钳)。 */
declare const IMAGEGEN_TOOL_MAX_N = 4;
/**
 * 客户端硬超时缺省(毫秒;kernel Tool.timeoutMs 位)= 服务端生成预算 120s
 * (tansr-api IMAGEGEN_DEFAULT_TIMEOUT_MS,解出层全模型恒用此值——含 classic
 * 万相异步任务与 mj_task midjourney 任务轮询长径)+ 60s 余量(videogen 同口径:
 * 请求上行/网关前置/响应回传)。kernel 统一档同为 120s、对服务端预算零余量——
 * 任务径跑满预算时客户端恒先掐(同 videogen 的有扣无产形态,窗口更短),故
 * 显式声明盖过。
 */
declare const IMAGEGEN_TOOL_TIMEOUT_MS = 180000;
/** ImageGen 工具参数 schema:模型(可省,取授权集首项)、正负提示词、尺寸、张数、种子与可选输入图。 */
declare const ImageGenArgsSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    prompt: z.ZodEffects<z.ZodString, string, string>;
    negativePrompt: z.ZodOptional<z.ZodString>;
    size: z.ZodOptional<z.ZodString>;
    n: z.ZodOptional<z.ZodNumber>;
    seed: z.ZodOptional<z.ZodNumber>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    model?: string | undefined;
    n?: number | undefined;
    size?: string | undefined;
    seed?: number | undefined;
    negativePrompt?: string | undefined;
    imageUrls?: string[] | undefined;
}, {
    prompt: string;
    model?: string | undefined;
    n?: number | undefined;
    size?: string | undefined;
    seed?: number | undefined;
    negativePrompt?: string | undefined;
    imageUrls?: string[] | undefined;
}>;
/** ImageGen 工具的已校验参数类型(ImageGenArgsSchema 推导)。 */
type ImageGenArgs = z.infer<typeof ImageGenArgsSchema>;

/**
 * MCP 结构化错误。
 *
 * 所有 transport/桥接失败都收敛为 McpError:code 供程序分支与审计,
 * message 为英文(可能进 tool_result 回给模型,仓库约定模型可见文案英文),
 * rpc 字段保留服务端 JSON-RPC error 原文(code/message/data)。
 */
type McpErrorCode = 
/** 进程 spawn 失败 / HTTP 连接建立失败 */
'connect_failed'
/** initialize 往返失败(超时/形态错) */
 | 'handshake_failed'
/** 服务端答复的协议版本不在降级链内,连接已断开 */
 | 'version_unsupported'
/** 连接已关闭(进程退出/流关闭/显式 close 后调用) */
 | 'transport_closed'
/** HTTP session 失效(404):须重新 initialize,本连接已作废 */
 | 'session_expired'
/** 请求超时 */
 | 'timeout'
/** 请求被外部 AbortSignal 取消 */
 | 'aborted'
/** 服务端返回 JSON-RPC error(rpc 字段携带原文) */
 | 'server_error'
/** 对端消息不符合 JSON-RPC/MCP 形态 */
 | 'protocol_error'
/** HTTP 非 2xx(非 404 session 语义)或响应类型不可用 */
 | 'http_error'
/**
 * SC-31:连接治理层拒收——连接池全部成员在飞达帽且排队队列已满,或写侧
 * 待写字节超帽(背压)。请求未发出,可安全稍后重试。
 */
 | 'overloaded';

/**
 * MCP 双端公共类型与协议常量。
 *
 * 设计要点:
 * - 版本策略:客户端声明 2025-11-25,降级链覆盖 2025-06-18/2025-03-26
 *   (SUPPORTED 集即降级链——服务端回什么版本,在集合内就接受,否则断开);
 * - session 与 initialize/initialized 握手全部封装在 transport 内部,上层
 *   (工具桥/attach)只见 McpConnection 五方法——这是应对 2026-07-28
 *   无状态化(移除握手与 Mcp-Session-Id)的架构接缝:届时只改 transport 层;
 * - 自研 server 收不到 MCP-Protocol-Version 头时按 2025-03-26 假定
 *   (本期 server 只做 stdio,常量先冻结供 HTTP server 卡使用)。
 */

/** 客户端/服务端身份声明(initialize 的 clientInfo/serverInfo) */
interface McpPeerInfo {
    name: string;
    version: string;
}
type McpTransportKind = 'stdio' | 'http';
type McpConnectionState = 'ready' | 'closed';
/** 单次请求选项(signal 与 timeout 合成后驱动取消传播) */
interface McpRequestOptions {
    signal?: AbortSignal;
    /** 覆盖连接级默认请求超时(毫秒) */
    timeoutMs?: number;
}
/** 连接关闭完成的证据级别:传输层真实完成,或仅依据连接器的 close promise。 */
type McpCloseEvidenceLevel = 'transport-completion' | 'connector-close-promise';
/**
 * MCP 连接(transport 层对上唯一面孔)。
 * 握手(initialize/initialized)、版本协商、session 头都发生在 connect 工厂
 * 内部;返回的连接恒处 ready 态,closed 后一切请求以结构化 McpError 拒绝。
 */
interface McpConnection {
    readonly serverName: string;
    readonly transport: McpTransportKind;
    /** 协商定格的协议版本 */
    readonly protocolVersion: string;
    readonly serverInfo: McpPeerInfo | undefined;
    readonly serverCapabilities: Record<string, unknown>;
    /**
     * CW17-M2A(doc/60 §3.4)— initialize 返回的 server instructions,拾取时
     * 已过 2K 帽+消毒(stream-connection validateInitializeResult)。恒不进
     * 系统提示;注入时机 = 该 server 首次被 McpDiscover 展开(走消息流增量,
     * 可压缩可淘汰)。服务端未提供时为 undefined。
     */
    readonly instructions?: string;
    readonly state: McpConnectionState;
    /** JSON-RPC 请求;取消经 opts.signal → cancel 通知 + 本地拒绝 */
    request(method: string, params?: Record<string, unknown>, opts?: McpRequestOptions): Promise<unknown>;
    /** JSON-RPC 通知(单向) */
    notify(method: string, params?: Record<string, unknown>): Promise<void>;
    /** 幂等关闭:失败所有 in-flight、释放底层资源(stdio 杀进程 / http 发 DELETE) */
    close(): Promise<void>;
    /** 加法完成层;只等待本地传输资源,不承诺远端服务终止。 */
    settleClose?(): Promise<void>;
}
/**
 * 工具集双面(与 agents/types.ts SubagentToolset 同形,结构兼容 cli 装配层的
 * BuiltToolSet):registry 为执行面,toolDefs 为模型可见面。MCP 桥接工具的
 * inputSchema 是远端 JSON Schema 原样透传,不走 zod→JSON Schema 转换,
 * 因此本模块直接产出 IRToolDef 推入 toolDefs。
 */
interface McpToolset {
    registry: ToolRegistry;
    toolDefs: IRToolDef[];
}
/**
 * MCP 结构化观测事件(注入观察者形态——附着发生在装配期,先于会话事件包络)。
 * contract-v0.4 起其中五型已契约化为 KernelEvent mcp.* 事件族,
 * 由表面层装配处映射进会话事件流(cli assembly/mcp-events.ts);log 与
 * cancel_sent 刻意只走本回调不进契约。表面层按 type 映射 kernel.mcp.* i18n 键。
 *
 * SC-31 增三型(reconnecting / reconnected / reconnect_exhausted):连接治理
 * 层的自动重连生命周期;contract-v0.21(RFC-SC-3,SC-45)起**已契约化**为
 * KernelEvent mcp.* 三型(字段以本回调形为准、逐字段同名;cli
 * assembly/mcp-events.ts 映射即契约化,与 connected/closed、discovered/
 * catalog_updated 同先例)。重连成功本身仍由既有 `mcp.connected` 表达
 * (每次成功握手一枚),`mcp.reconnected` 是附加的治理层注记。
 */
type McpClientEvent = {
    type: 'mcp.connected';
    server: string;
    transport: McpTransportKind;
    protocolVersion: string;
    serverInfo?: McpPeerInfo;
} | {
    type: 'mcp.connect_failed';
    server: string;
    code: McpErrorCode;
    message: string;
} | {
    type: 'mcp.closed';
    server: string;
    reason: 'closed' | 'server_exit' | 'error';
    detail?: string;
} | {
    /** 服务端发起 elicitation,本期策略:结构化拒绝(action=decline)+ 本事件可观测 */
    type: 'mcp.elicitation_declined';
    server: string;
    mode: 'form' | 'url';
    message?: string;
} | {
    type: 'mcp.log';
    server: string;
    level: string;
    message: string;
} | {
    type: 'mcp.cancel_sent';
    server: string;
    requestId: string | number;
} | {
    type: 'mcp.tool_skipped';
    server: string;
    tool: string;
    reason: 'duplicate_name' | 'invalid_name';
} | {
    /**
     * CW17-M2A(doc/60 §4.4;契约化候 RFC-M2/W2)— 发现与展开审计:
     * phase='catalog' 为装配期目录建立(source 区分目录来自缓存或现连
     * 发现,tools 为远端工具名);phase='expand' 为展开动作把 def 拉进
     * 模型上下文(tools 为桥接名,folds 为 64 字符帽折叠映射,可审计)。
     */
    type: 'mcp.discovered';
    server: string;
    phase: 'catalog' | 'expand';
    source: 'catalog-cache' | 'live';
    tools: string[];
    durationMs: number;
    folds?: Array<{
        tool: string;
        bridged: string;
    }>;
} | {
    /**
     * CW17-M2A(doc/60 §3.3/§4.4;契约化候 RFC-M2/W2)— 目录缓存演进:
     * 连接后真实 tools/list 与缓存 diff 的计数(本会话目录段与 toolDefs
     * 恒不动,下会话生效——该语义要能对账)。
     */
    type: 'mcp.catalog_updated';
    server: string;
    added: number;
    removed: number;
    changed: number;
} | {
    /**
     * SC-31:某成员连接意外断开(或重连尝试失败)后已排定下一次自动重连。
     * attempt = 即将进行的第几次尝试(1 起);delayMs = 退避等待(含抖动);
     * connection = 池内成员序号(0 起;缺省池 1 恒 0)。
     */
    type: 'mcp.reconnecting';
    server: string;
    connection: number;
    attempt: number;
    delayMs: number;
} | {
    /** SC-31:成员连接自动重连成功(第 attempt 次尝试;downtimeMs = 断开至恢复墙钟) */
    type: 'mcp.reconnected';
    server: string;
    connection: number;
    attempt: number;
    downtimeMs: number;
} | {
    /** 达到 reconnect.maxAttempts,该成员停止自动重连(手动重连可复位) */
    type: 'mcp.reconnect_exhausted';
    server: string;
    connection: number;
    attempts: number;
};
/** MCP 客户端事件观察者:接收连接 / 重连 / 发现等结构化事件(表面层日志与状态面消费)。 */
type McpEventObserver = (event: McpClientEvent) => void;

/** stdio 服务器配置(mcpServers 段的 stdio 形态,已经 config.ts 校验) */
interface McpStdioServerConfig {
    transport: 'stdio';
    command: string;
    args?: string[];
    /** 追加进子进程环境(在 baseEnv 之上覆盖) */
    env?: Record<string, string>;
    cwd?: string;
    enabled?: boolean;
}

/** HTTP 服务器配置(mcpServers 段的 http 形态,已经 config.ts 校验) */
interface McpHttpServerConfig {
    transport: 'http';
    url: string;
    /** 附加请求头(authorization 等;`${VAR}` 引用在 attach 层已解析) */
    headers?: Record<string, string>;
    enabled?: boolean;
}
/** fetch 注入缝(默认 globalThis.fetch;hermetic 测试可注入) */
type HttpFetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
}) => Promise<Response>;

/** 重连状态投影(桥接工具文案与 /mcp 呈现的数据源) */
interface McpReconnectStatus {
    /** 有成员断开且自动重连仍在进行(排定或尝试中) */
    reconnecting: boolean;
    /** 最近一次/即将进行的尝试序号(1 起;各槛位取最大) */
    attempt: number;
    /** 距下一次尝试的毫秒(尝试正在进行中时缺席) */
    nextRetryMs?: number;
    /** 全部断开成员都已放弃(达 maxAttempts) */
    exhausted: boolean;
}

/**
 * Hooks 引擎类型契约。
 *
 * 设计要点:
 * - 权威事件名单(SessionStart/UserPromptSubmit/PreToolUse/
 *   PostToolUse/Stop/SessionEnd 六事件起步;后增 2 个权限专属
 *   事件 PermissionRequest/PermissionDenied,共八),command 与 http 两种
 *   执行体;
 * - command 为子进程 exec-form(argv 数组,不走 shell),
 *   stdin JSON / exit code / stdout JSON 协议,默认 60s 超时;http 为
 *   POST JSON、禁重定向 + URL policy + header secret allowlist;PreToolUse
 *   可返回 {decision: allow|deny|ask, updatedInput} 参与权限管线;每个 hook
 *   有稳定 ID(source+event+matcher+configHash);并行执行、结果按配置优先级
 *   稳定排序应用;
 * - stdin 公共字段 snake_case(session_id/cwd/hook_event_name +
 *   事件特有字段);exit 0=成功(stdout 作结构化响应)、2=阻断
 *   (stderr 作原因)、其他非零=非阻断错误(fail-open,单 hook 失败不拦路)。
 *
 * 本模块零运行时逻辑(除 zod schema 常量);执行体与引擎见同目录其余文件。
 */

/**
 * 十个生命周期事件(权威名单 + 增补;顺序即文档口径,无运行时含义)。
 * PermissionRequest/PermissionDenied 为后增的权限专属事件
 * (事件名沿 CC 词汇,生态迁移零歧义;语义与 CC 分岔——hook 只能收紧,
 * 永不放行/代批,见 cli 装配层接线)。
 * PreCompact/PostCompact 为后增的压缩生命周期事件——
 * 事件词表在 kernel,零契约变更;protocol `HooksSectionSchema`(契约的
 * 规范性描述)仍为八键,配置抽取走**原始层对象**(extractHooksSection 先
 * 于 schema 消费,KNOWN_KEYS 由本词表派生),两新事件的配置即刻可达;
 * schema 键补齐待协议评审后回迁。
 * 本常量同时是 hooks 配置段的事件键白名单(config.ts KNOWN_KEYS 遍历
 * 同一词表)。
 */
declare const HOOK_EVENTS: readonly ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PermissionDenied", "PostToolUse", "Stop", "PreCompact", "PostCompact", "SessionEnd"];
type HookEventName = (typeof HOOK_EVENTS)[number];
/**
 * 执行体配置。command 是 exec-form:argv 数组直接 spawn,不经系统 shell
 * (doc/06 §3.4 对 Claude Code shell 形态的修正——杜绝 hook 配置本身成为
 * 注入面);http 的 headers 值支持 `${ENV_NAME}` 整值引用形态,执行期从
 * 注入的环境解析,解析值全程按秘密脱敏(见 http-runner.ts)。
 */
type HookExecutorConfig = {
    type: 'command';
    /** argv 数组,首元素为可执行文件路径/名 */
    command: readonly string[];
    /** 单 hook 超时覆盖(毫秒);缺省用引擎默认 60s */
    timeoutMs?: number;
} | {
    type: 'http';
    /** 端点(仅 http/https;私网字面量默认拒绝,见 http-runner.ts) */
    url: string;
    /** 附加请求头;值恰为 `${VAR}` 形态时经环境解析并脱敏 */
    headers?: Readonly<Record<string, string>>;
    timeoutMs?: number;
};
/** 装配后的单个 hook 条目(已定稳定 ID 与来源层) */
interface HookEntry {
    /** 稳定 ID:`{layer}:{event}:{matcher|*}:{configHash8}`(doc/06 §3.4) */
    id: string;
    /** 来源配置层(managed/projectLocal/projectShared/user) */
    layer: ConfigLayerName;
    event: HookEventName;
    /** 触发过滤器源文本;undefined = 全匹配(matcher.ts 编译语义) */
    matcher?: string;
    executor: HookExecutorConfig;
}
/** hooks 段分层抽取产物(条目已按层优先级稳定排序、跨层同构去重) */
interface LoadedHooks {
    byEvent: Partial<Record<HookEventName, readonly HookEntry[]>>;
    /** managed 层声明的「禁用一切 hooks」(下层声明被忽略,doc/07 §6.2) */
    disableAllHooks: boolean;
    /** managed 层声明的「仅 managed 层 hooks 生效」 */
    allowManagedHooksOnly: boolean;
}
/** 权限终局归因所在层(线上 snake_case 键名见事件分支) */
type HookPermissionSourceLayer = 'policy' | 'projectLocal' | 'projectShared' | 'user';
/** 事件输入(业务字段;公共字段与 hook_event_name 由引擎组装) */
type HookEventInput = {
    event: 'SessionStart';
    source: 'startup' | 'resume' | 'clear';
} | {
    event: 'UserPromptSubmit';
    prompt: string;
} | {
    event: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
} | {
    /**
     * 权限门完整判定产出 ask 终局后、询问面呈现前恰一次。
     * tool_input 由装配层过 redactDeep(INV-10,秘密不进 hook 入参);
     * 结构化响应仅 deny|block 被消费(收紧为 deny-and-continue),allow 忽略 +
     * 告警、updatedInput 不消费(INV-11:hook 永不放行/代批)。
     */
    event: 'PermissionRequest';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
    /** ask 终局归因四元组(与挑战载荷同粒度) */
    gate: {
        decision: 'ask';
        source: string;
        matched_rule?: string;
        source_layer?: HookPermissionSourceLayer;
    };
} | {
    /**
     * deny 终局落定后 fire-and-forget 纯通知(覆盖引擎
     * deny/hook 收紧/分类器 unsafe/降级/预算耗尽/审批拒绝超时/用户手拒
     * ——与 decisions.jsonl 同源同覆盖面)。响应不消费;字段已脱敏。
     */
    event: 'PermissionDenied';
    tool_name: string;
    tool_use_id: string;
    decision: 'deny';
    source: string;
    matched_rule?: string;
    source_layer?: HookPermissionSourceLayer;
    reason?: string;
} | {
    event: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
    tool_response: unknown;
    duration_ms: number;
} | {
    event: 'Stop';
    stop_reason?: string;
} | {
    /**
     * 压缩计划落定、历史替换前恰一次。trigger 沿 CC
     * 双值词表(auto/manual;kernel 内部 reactive 对 hook 呈现为 auto,
     * 生态脚本零改动可复用);matcher 以 trigger 为比较对象(SessionStart
     * 按 source 同法)。响应消费:exit 2 / decision=deny|block 阻断本次
     * 压缩(显式协议行为,非故障——auto 径跳过压缩照发请求,manual 悬诺
     * hook_blocked 兑现,reactive 径按压缩失败同径终局);additionalContext
     * → 摘要附加指令(与 manual 用户指令的合并次序:用户在前 hook 在后,
     * 见 query/run-query.ts 压缩点)。
     */
    event: 'PreCompact';
    trigger: 'auto' | 'manual';
    /** manual /compact 的用户附加指令(在场时透传;auto 恒缺席) */
    custom_instructions?: string;
} | {
    /**
     * 历史替换成功后恰一次的纯通知(响应不消费;
     * fail-open,失败/超时不影响已完成的压缩)。载荷给足外部审计/联动:
     * 摘要全文 + 被折叠移除的消息数。
     */
    event: 'PostCompact';
    trigger: 'auto' | 'manual';
    summary_text: string;
    removed_count: number;
} | {
    event: 'SessionEnd';
    reason: string;
};
/**
 * 结构化响应 schema(stdout JSON / http 响应 JSON)。
 * - decision:PreToolUse 消费 allow/deny/ask(参与权限管线);
 *   `block` 为通用阻断(等价 deny;其余事件仅认 block/deny 为阻断);
 * - updatedInput:PreToolUse 专用,替换工具入参(经权限管线透传);
 * - additionalContext:注入下一轮上下文的附加文本(调用方接线为 attachment);
 * - continue:false 表达「阻止继续」(Stop hook 语义;调用方消费);
 * - reason / stopReason:阻断/停止原因(用户与审计可见,注意脱敏)。
 * 未知键剥离(strip),响应坏形不阻断(fail-open,见 runner)。
 */
declare const HookOutputSchema: z.ZodObject<{
    decision: z.ZodOptional<z.ZodEnum<["allow", "deny", "ask", "block"]>>;
    updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    additionalContext: z.ZodOptional<z.ZodString>;
    continue: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodString>;
    stopReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stopReason?: string | undefined;
    reason?: string | undefined;
    decision?: "block" | "allow" | "deny" | "ask" | undefined;
    updatedInput?: Record<string, unknown> | undefined;
    additionalContext?: string | undefined;
    continue?: boolean | undefined;
}, {
    stopReason?: string | undefined;
    reason?: string | undefined;
    decision?: "block" | "allow" | "deny" | "ask" | undefined;
    updatedInput?: Record<string, unknown> | undefined;
    additionalContext?: string | undefined;
    continue?: boolean | undefined;
}>;
type HookOutput = z.infer<typeof HookOutputSchema>;
/**
 * 单 hook 终态五分类:
 * - ok:exit 0 / HTTP 2xx,结构化响应(若有)已解析;
 * - blocked:exit 2(stderr 为 reason)或响应 decision=deny|block;
 * - error:非阻断失败(其他非零 exit / spawn 失败 / 网络失败 / 非 2xx /
 *   重定向 / header 解析失败)——fail-open,不拦断主流程;
 * - timeout:60s(或覆盖值)内未完成,进程已杀/请求已断——fail-open;
 * - aborted:外部 AbortSignal 取消(整批取消场景)。
 */
type HookExecutionStatus = 'ok' | 'blocked' | 'error' | 'timeout' | 'aborted';
/** 执行体产物(runner 返回;engine 补 hookId 后进 HookExecution) */
interface RunnerOutcome {
    status: HookExecutionStatus;
    /** 结构化响应(校验通过时;文本已脱敏) */
    output?: HookOutput;
    /** blocked 时的原因(exit 2 的 stderr / 响应 reason;已脱敏) */
    reason?: string;
    /** error/timeout 的诊断文本(已脱敏;永不含凭据值) */
    detail?: string;
    /** command 执行体的退出码(信号终止/spawn 失败为 null;http 无此字段) */
    exitCode?: number | null;
    /** http 执行体的响应状态码 */
    httpStatus?: number;
    durationMs: number;
}
/** 单 hook 执行记录(按配置优先级稳定排序后进 HookRunResult) */
interface HookExecution extends RunnerOutcome {
    hookId: string;
}
/** PreToolUse 权限聚合(叠加进权限管线;语义见 engine.ts aggregatePreToolUse) */
interface PreToolUseAggregate {
    /**
     * 最严格者胜:任一 deny|block → deny;否则任一 ask → ask;否则任一
     * allow → allow;全部无意见 → undefined(hooks 对本次调用不表态)。
     */
    decision?: 'allow' | 'deny' | 'ask';
    /** 决定性 hook 的稳定 ID(decision 非 undefined 时存在) */
    decidedBy?: string;
    /** deny 时的原因(取按序首个 deny 的 reason) */
    reason?: string;
    /** 按配置优先级取首个提供者;冲突时高优先层胜(doc/07 §6.5 冲突规则) */
    updatedInput?: Record<string, unknown>;
    /** updatedInput 提供者的稳定 ID */
    updatedInputBy?: string;
    /** 多个 hook 都给了 updatedInput(被忽略者见 executions 明细) */
    updatedInputConflict?: boolean;
}
/** 一次事件触发的整体结果 */
interface HookRunResult {
    event: HookEventName;
    /** 按配置优先级稳定排序(非完成时间序,doc/06 §3.4) */
    executions: readonly HookExecution[];
    /** 任一 hook 阻断(blocked);Stop 事件调用方据此产出 stop_hook_prevented */
    blocked: boolean;
    /** 按序首个阻断者的原因(已脱敏) */
    blockReason?: string;
    /** 按序首个阻断者的稳定 ID */
    blockedBy?: string;
    /** 各 hook 的 additionalContext,按配置优先级序(调用方转 attachment) */
    additionalContexts: readonly string[];
    /** 仅 PreToolUse 事件存在 */
    preToolUse?: PreToolUseAggregate;
}

/**
 * kernel 侧配置 schema(合并后的整体校验)。
 *
 * 以冻结的 protocol TansrConfigSchema(contract-v0)为基底组合而来,仅放宽
 * 一处、扩充零处——protocol 本身不动:
 *
 * 1. providers.*.capability 放宽为「深部分覆盖」形态(全字段可省、无默认值
 *    填充)。冻结版 capability 是完整 CapabilitySchema:maxContext 必填且
 *    parse 会填充默认值——分层配置里只写局部 capability 是常态,完整校验
 *    既误报又会让「schema 默认值」冒充「用户显式配置」,压掉 providers
 *    registry 的内置默认表(见 packages/providers/src/registry/
 *    capability-merge.ts 头注;RFC 草案见任务报告)。本形态与
 *    @tansr/providers 的 CapabilityOverride 逐字段对齐,合并产物可直接充当
 *    RegistryConfig。
 * 2. permissions 段:contract-v0.6 起 protocol 已规范性承载(RFC-G1-2,
 *    PermissionsSectionSchema)。运行期不变:它在合并前被逐层抽出
 *    (permissions.ts),从不进入本 schema 的校验对象。
 *
 * 未知键语义:z.object 默认 strip——未知键(含误写入配置的密钥值字段)在
 * parse 时被剥离出最终 config 对象;告警诊断由 validate.ts 的原始/产物树
 * 对比产生(告警不失败)。
 */

/** 合并后配置的校验 schema(基底为冻结的 TansrConfigSchema) */
declare const MergedTansrConfigSchema: z.ZodObject<{
    $schemaVersion: z.ZodDefault<z.ZodLiteral<1>>;
    modelAliases: z.ZodDefault<z.ZodObject<{
        main: z.ZodOptional<z.ZodString>;
        fast: z.ZodOptional<z.ZodString>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    }, {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    }>>;
    fallbacks: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
    locale: z.ZodOptional<z.ZodString>;
    hooks: z.ZodOptional<z.ZodObject<{
        SessionStart: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PreToolUse: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PostToolUse: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        Stop: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        SessionEnd: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        PermissionDenied: z.ZodOptional<z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"command">;
                command: z.ZodArray<z.ZodString, "many">;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }, {
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"http">;
                url: z.ZodString;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                timeoutMs: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            }>]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }, {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }>, "many">>;
        disableAllHooks: z.ZodOptional<z.ZodBoolean>;
        allowManagedHooksOnly: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        SessionStart?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PreToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PostToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        Stop?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        SessionEnd?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionRequest?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionDenied?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    }, {
        SessionStart?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PreToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PostToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        Stop?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        SessionEnd?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionRequest?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionDenied?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    }>>;
    mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<"transport", [z.ZodObject<{
        pool: z.ZodOptional<z.ZodObject<{
            connections: z.ZodOptional<z.ZodNumber>;
            maxInflightPerConnection: z.ZodOptional<z.ZodNumber>;
            queueTimeoutMs: z.ZodOptional<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }>>;
        reconnect: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            initialBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxAttempts: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strict", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }>>;
        load: z.ZodOptional<z.ZodEnum<["lazy", "eager"]>>;
        toolAllowlist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        transport: z.ZodLiteral<"stdio">;
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }>, z.ZodObject<{
        pool: z.ZodOptional<z.ZodObject<{
            connections: z.ZodOptional<z.ZodNumber>;
            maxInflightPerConnection: z.ZodOptional<z.ZodNumber>;
            queueTimeoutMs: z.ZodOptional<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }, {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        }>>;
        reconnect: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            initialBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxBackoffMs: z.ZodOptional<z.ZodNumber>;
            maxAttempts: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strict", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }, {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        }>>;
        load: z.ZodOptional<z.ZodEnum<["lazy", "eager"]>>;
        toolAllowlist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        transport: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }, {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }>]>>>;
    permissions: z.ZodOptional<z.ZodObject<{
        allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ask: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        defaultMode: z.ZodOptional<z.ZodEnum<["default", "acceptEdits", "plan", "bypassPermissions", "auto", "dontAsk"]>>;
        disableBaselineProtection: z.ZodOptional<z.ZodBoolean>;
        classifier: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            tightenOutsideAuto: z.ZodOptional<z.ZodBoolean>;
            callBudget: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"off">]>>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        }, {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        }>>;
        recommendedRules: z.ZodOptional<z.ZodBoolean>;
        projectAskBudget: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"off">]>>;
    }, "strip", z.ZodTypeAny, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    }>>;
    ui: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodEnum<["dark", "light", "high-contrast", "colorblind"]>>;
    }, "strip", z.ZodTypeAny, {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    }, {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    }>>;
    budget: z.ZodOptional<z.ZodObject<{
        maxUsd: z.ZodOptional<z.ZodNumber>;
        maxTotalTokens: z.ZodOptional<z.ZodNumber>;
        onExceeded: z.ZodDefault<z.ZodEnum<["block", "warn"]>>;
    }, "strip", z.ZodTypeAny, {
        onExceeded: "block" | "warn";
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
    }, {
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
        onExceeded?: "block" | "warn" | undefined;
    }>>;
    verify: z.ZodOptional<z.ZodObject<{
        command: z.ZodOptional<z.ZodString>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    }, {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    }>>;
    effort: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "max"]>>;
    outputStyle: z.ZodOptional<z.ZodString>;
    audit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        dir: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    }>>;
    policy: z.ZodOptional<z.ZodObject<{
        trust: z.ZodOptional<z.ZodObject<{
            keys: z.ZodRecord<z.ZodString, z.ZodString>;
            unsignedPolicy: z.ZodOptional<z.ZodEnum<["accept", "reject"]>>;
        }, "strip", z.ZodTypeAny, {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        }, {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    }, {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    }>>;
    sandbox: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["off", "on", "required"]>>;
        allowWrite: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        network: z.ZodOptional<z.ZodEnum<["allow", "deny"]>>;
    }, "strip", z.ZodTypeAny, {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    }, {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    }>>;
    workspaceTrust: z.ZodOptional<z.ZodObject<{
        enforce: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enforce?: boolean | undefined;
    }, {
        enforce?: boolean | undefined;
    }>>;
    semanticIndex: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        repoId: z.ZodOptional<z.ZodString>;
        branch: z.ZodOptional<z.ZodString>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    }, {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    }>>;
    telemetry: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>>;
} & {
    providers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        protocol: z.ZodEnum<["anthropic", "openai", "openai-responses", "twp"]>;
        baseUrl: z.ZodString;
        auth: z.ZodOptional<z.ZodObject<{
            env: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            env: string;
        }, {
            env: string;
        }>>;
        models: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        pricing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            inputPerMillion: z.ZodNumber;
            cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
            outputPerMillion: z.ZodNumber;
            peakMultiplier: z.ZodOptional<z.ZodNumber>;
            tiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                upToInputTokens: z.ZodOptional<z.ZodNumber>;
                inputPerMillion: z.ZodNumber;
                cachedInputPerMillion: z.ZodOptional<z.ZodNumber>;
                outputPerMillion: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }, {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }>>>;
    } & {
        capability: z.ZodOptional<z.ZodObject<{
            maxContext: z.ZodOptional<z.ZodNumber>;
            effectiveContext: z.ZodOptional<z.ZodNumber>;
            maxOutput: z.ZodOptional<z.ZodNumber>;
            reasoning: z.ZodOptional<z.ZodBoolean>;
            thinkingOptional: z.ZodOptional<z.ZodBoolean>;
            vision: z.ZodOptional<z.ZodBoolean>;
            inputModalities: z.ZodOptional<z.ZodObject<{
                image: z.ZodOptional<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
                document: z.ZodOptional<z.ZodEnum<["supported", "rejected", "silently_dropped"]>>;
            }, "strip", z.ZodTypeAny, {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            }, {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            }>>;
            toolChoice: z.ZodOptional<z.ZodBoolean>;
            promptCaching: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodEnum<["explicit", "implicit", "ignored"]>>;
                minCacheableTokens: z.ZodOptional<z.ZodNumber>;
                ttlSeconds: z.ZodOptional<z.ZodNumber>;
                maxBreakpoints: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            }, {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            }>>;
            thinking: z.ZodOptional<z.ZodObject<{
                toggleValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                budgetTokens: z.ZodOptional<z.ZodEnum<["honored", "ignored"]>>;
                effortParam: z.ZodOptional<z.ZodString>;
                mustEchoBack: z.ZodOptional<z.ZodBoolean>;
                cannotDisable: z.ZodOptional<z.ZodBoolean>;
                signatureShape: z.ZodOptional<z.ZodEnum<["opaque", "always_empty", "absent"]>>;
            }, "strip", z.ZodTypeAny, {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            }, {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            }>>;
            sampling: z.ZodOptional<z.ZodObject<{
                temperature: z.ZodOptional<z.ZodObject<{
                    min: z.ZodOptional<z.ZodNumber>;
                    max: z.ZodOptional<z.ZodNumber>;
                    minExclusive: z.ZodOptional<z.ZodBoolean>;
                    maxExclusive: z.ZodOptional<z.ZodBoolean>;
                    clampEpsilon: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                }, {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                }>>;
                temperatureRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
                temperatureFixed: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            }, {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            }>>;
            modelModifiers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            defaultContextWithoutModifier: z.ZodOptional<z.ZodNumber>;
            quirks: z.ZodOptional<z.ZodObject<{
                unknownModelFallback: z.ZodOptional<z.ZodBoolean>;
                claudeModelNameMapping: z.ZodOptional<z.ZodBoolean>;
                systemRoleInMessages: z.ZodOptional<z.ZodBoolean>;
                stopSequences: z.ZodOptional<z.ZodEnum<["honored", "misreported_end_turn", "ignored"]>>;
                streamUsageLocation: z.ZodOptional<z.ZodEnum<["message_delta", "message_start", "both"]>>;
                countTokensEndpoint: z.ZodOptional<z.ZodBoolean>;
                modelsEndpoint: z.ZodOptional<z.ZodBoolean>;
                minTimeoutMs: z.ZodOptional<z.ZodNumber>;
                maxTokensExcludesReasoning: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            }, {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            }>>;
            hostedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            background: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        }, {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        models: Record<string, string>;
        auth?: {
            env: string;
        } | undefined;
        capability?: {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        auth?: {
            env: string;
        } | undefined;
        models?: Record<string, string> | undefined;
        capability?: {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }>>>;
    context: z.ZodOptional<z.ZodObject<{
        /** 全局默认活动方案 id;缺省 baseline-memory(TM-17 转正)。会话级覆盖走 --context-scheme 旗标 */
        activeScheme: z.ZodOptional<z.ZodString>;
        /** 用户自定义方案表(id → 条目);内置 id(baseline 等)不可覆盖 */
        schemes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            /** 展示名;缺省用方案 id */
            displayName: z.ZodOptional<z.ZodString>;
            /** 成熟度档;用户方案缺省 experimental(围栏 4:非 production 激活警示) */
            stage: z.ZodOptional<z.ZodEnum<["production", "experimental", "test"]>>;
            /** 出处说明(围栏 6 机器化;缺省「settings 用户定义」) */
            origin: z.ZodOptional<z.ZodString>;
            /** 派生基底方案 id(delta 维护;仅元数据,W1 不做参数继承) */
            parentId: z.ZodOptional<z.ZodString>;
            /** 治理参数(语义校验在装配层;形状上只要求对象) */
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        activeScheme?: string | undefined;
        schemes?: Record<string, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }> | undefined;
    }, {
        activeScheme?: string | undefined;
        schemes?: Record<string, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }> | undefined;
    }>>;
    usageReporting: z.ZodOptional<z.ZodObject<{
        /** 缺省 true(D4 缺省开);false = 隐私档(不采集不上报,会话元数据如实记关) */
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
    }, {
        enabled?: boolean | undefined;
    }>>;
    model: z.ZodOptional<z.ZodObject<{
        /** /model 选定的别名或 ref(provider/model);TUI 选择器持久化落点 */
        selected: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        selected?: string | undefined;
    }, {
        selected?: string | undefined;
    }>>;
    window: z.ZodOptional<z.ZodObject<{
        /** 按模型的窗口档位选定(tokens);键 = 模型 handle(解析后 modelName) */
        byModel: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        byModel?: Record<string, number> | undefined;
    }, {
        byModel?: Record<string, number> | undefined;
    }>>;
    network: z.ZodOptional<z.ZodObject<{
        /**
         * twp SSE 帧间 idle 超时(毫秒;缺省适配器内建 150_000——C7 与 api
         * 上游 TTFB 预算 120s 咬合,推导见 providers twp adapter)。整流单闸
         * 退役后的主存活判据:帧间距不超此值,长推理流恒不误杀;连接/响应头档
         * 沿 ModelCallOptions.timeoutMs 既有可配面,不在本键。
         */
        twpIdleTimeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        twpIdleTimeoutMs?: number | undefined;
    }, {
        twpIdleTimeoutMs?: number | undefined;
    }>>;
    update: z.ZodOptional<z.ZodObject<{
        /**
         * 更新通道:stable/beta 正常检查;none = 禁用检查(企业内网/自管分发)。
         * 缺省按构建通道/版本后缀推导(check.ts channelFromVersion)。
         */
        channel: z.ZodOptional<z.ZodEnum<["stable", "beta", "none"]>>;
        /**
         * 企业锁版本:在场即门控短路(/update 只告知不给升级指引,--install
         * 恒拒;fail-closed 语义与 env 形态一致)。
         */
        pinnedVersion: z.ZodOptional<z.ZodString>;
        /**
         * manifest 数据源地址(企业内网/自托管;`{channel}` 占位替换)。在场即
         * 优先于 npm registry;形态 = scripts/release/pack-sea.mjs 产物。
         * 须为 `https://` 绝对 URL——`http:` / `file:` / 相对形
         * 在 schema 层即拒(抽取器 `invalid_value` 剥离回退低层 / 缺席;远程 org 下发经同一
         * schema 收口),与 cli 发布 URL 门(release-trust.ts `insecure_scheme`)双闸同向。
         */
        manifestUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        /** false = 退出更新检查(TANSR_NO_UPDATE_CHECK=1 的配置化持久形态) */
        checkEnabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        channel?: "none" | "stable" | "beta" | undefined;
        pinnedVersion?: string | undefined;
        manifestUrl?: string | undefined;
        checkEnabled?: boolean | undefined;
    }, {
        channel?: "none" | "stable" | "beta" | undefined;
        pinnedVersion?: string | undefined;
        manifestUrl?: string | undefined;
        checkEnabled?: boolean | undefined;
    }>>;
    storage: z.ZodOptional<z.ZodObject<{
        /** 会话持久化根目录(`~` 展开与相对路径解析在装配层;身份仓子径规则不变) */
        sessionsDir: z.ZodOptional<z.ZodString>;
        /** 上下文快照根目录(缺省与会话同居 `<sessionDir>/checkpoints`) */
        checkpointsDir: z.ZodOptional<z.ZodString>;
        /** 压缩 / 清空前自动落 pre_* 快照(缺省 true) */
        autoCheckpointBeforeCompact: z.ZodOptional<z.ZodBoolean>;
        /** journal 封段阈值(缺省启用 kernel 缺省阈值) */
        segmentation: z.ZodOptional<z.ZodObject<{
            /** 缺省 true;false = 卷不封段(旧单卷布局) */
            enabled: z.ZodOptional<z.ZodBoolean>;
            /** 活段字节阈值(缺省 kernel DEFAULT_SEGMENT_MAX_BYTES = 16 MiB) */
            maxBytes: z.ZodOptional<z.ZodNumber>;
            /** 活段记录数阈值(缺省 kernel DEFAULT_SEGMENT_MAX_RECORDS = 5000) */
            maxRecords: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        }, {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        }>>;
        /**
         * R-3(doc/117 R-3):快照保留策略(cli 快照 store 消费;kernel writeCheckpoint
         * `retention` 同形:先按龄 maxAgeDays 淘汰,再按数 max 淘汰最旧;皆缺省不限)
         */
        checkpoints: z.ZodOptional<z.ZodObject<{
            /** 同会话(卷)快照数上限 */
            max: z.ZodOptional<z.ZodNumber>;
            /** 快照最长保留天数(可为小数) */
            maxAgeDays: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        }, {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        checkpoints?: {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        } | undefined;
        sessionsDir?: string | undefined;
        checkpointsDir?: string | undefined;
        autoCheckpointBeforeCompact?: boolean | undefined;
        segmentation?: {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        } | undefined;
    }, {
        checkpoints?: {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        } | undefined;
        sessionsDir?: string | undefined;
        checkpointsDir?: string | undefined;
        autoCheckpointBeforeCompact?: boolean | undefined;
        segmentation?: {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        } | undefined;
    }>>;
    http: z.ZodOptional<z.ZodObject<{
        /**
         * 模型经 Http 工具 auth(bearer.env / basic.userEnv|passEnv / header.env)与 hooks http 执行体
         * header `${VAR}` 引用可带走的环境变量名单;缺席 = 不限(个人场景),在场(含空数组)即名单外
         * 引用结构化拒 `auth_env_not_allowed`(不发请求,不回显值)。
         */
        allowedAuthEnvVars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allowedAuthEnvVars?: string[] | undefined;
    }, {
        allowedAuthEnvVars?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    $schemaVersion: 1;
    providers: Record<string, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        models: Record<string, string>;
        auth?: {
            env: string;
        } | undefined;
        capability?: {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }>;
    modelAliases: {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    };
    fallbacks: Record<string, string[]>;
    telemetry: {
        enabled: boolean;
    };
    model?: {
        selected?: string | undefined;
    } | undefined;
    budget?: {
        onExceeded: "block" | "warn";
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
    } | undefined;
    network?: {
        twpIdleTimeoutMs?: number | undefined;
    } | undefined;
    policy?: {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    } | undefined;
    locale?: string | undefined;
    http?: {
        allowedAuthEnvVars?: string[] | undefined;
    } | undefined;
    hooks?: {
        SessionStart?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PreToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PostToolUse?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        Stop?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        SessionEnd?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionRequest?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        PermissionDenied?: {
            hooks: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[];
            matcher?: string | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    } | undefined;
    mcpServers?: Record<string, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    } | {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }> | undefined;
    permissions?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    } | undefined;
    ui?: {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    } | undefined;
    verify?: {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    effort?: "max" | "low" | "medium" | "high" | undefined;
    outputStyle?: string | undefined;
    audit?: {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    } | undefined;
    sandbox?: {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    } | undefined;
    workspaceTrust?: {
        enforce?: boolean | undefined;
    } | undefined;
    semanticIndex?: {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    } | undefined;
    window?: {
        byModel?: Record<string, number> | undefined;
    } | undefined;
    context?: {
        activeScheme?: string | undefined;
        schemes?: Record<string, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }> | undefined;
    } | undefined;
    usageReporting?: {
        enabled?: boolean | undefined;
    } | undefined;
    update?: {
        channel?: "none" | "stable" | "beta" | undefined;
        pinnedVersion?: string | undefined;
        manifestUrl?: string | undefined;
        checkEnabled?: boolean | undefined;
    } | undefined;
    storage?: {
        checkpoints?: {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        } | undefined;
        sessionsDir?: string | undefined;
        checkpointsDir?: string | undefined;
        autoCheckpointBeforeCompact?: boolean | undefined;
        segmentation?: {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        } | undefined;
    } | undefined;
}, {
    model?: {
        selected?: string | undefined;
    } | undefined;
    budget?: {
        maxUsd?: number | undefined;
        maxTotalTokens?: number | undefined;
        onExceeded?: "block" | "warn" | undefined;
    } | undefined;
    network?: {
        twpIdleTimeoutMs?: number | undefined;
    } | undefined;
    policy?: {
        trust?: {
            keys: Record<string, string>;
            unsignedPolicy?: "accept" | "reject" | undefined;
        } | undefined;
    } | undefined;
    locale?: string | undefined;
    http?: {
        allowedAuthEnvVars?: string[] | undefined;
    } | undefined;
    hooks?: {
        SessionStart?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        UserPromptSubmit?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PreToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PostToolUse?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        Stop?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        SessionEnd?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionRequest?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        PermissionDenied?: {
            matcher?: string | undefined;
            hooks?: ({
                type: "command";
                command: string[];
                timeoutMs?: number | undefined;
            } | {
                type: "http";
                url: string;
                timeoutMs?: number | undefined;
                headers?: Record<string, string> | undefined;
            })[] | undefined;
        }[] | undefined;
        disableAllHooks?: boolean | undefined;
        allowManagedHooksOnly?: boolean | undefined;
    } | undefined;
    $schemaVersion?: 1 | undefined;
    providers?: Record<string, {
        protocol: "anthropic" | "openai" | "openai-responses" | "twp";
        baseUrl: string;
        auth?: {
            env: string;
        } | undefined;
        models?: Record<string, string> | undefined;
        capability?: {
            thinking?: {
                toggleValues?: string[] | undefined;
                budgetTokens?: "ignored" | "honored" | undefined;
                effortParam?: string | undefined;
                mustEchoBack?: boolean | undefined;
                cannotDisable?: boolean | undefined;
                signatureShape?: "opaque" | "always_empty" | "absent" | undefined;
            } | undefined;
            maxContext?: number | undefined;
            effectiveContext?: number | undefined;
            maxOutput?: number | undefined;
            reasoning?: boolean | undefined;
            thinkingOptional?: boolean | undefined;
            vision?: boolean | undefined;
            inputModalities?: {
                image?: "supported" | "rejected" | "silently_dropped" | undefined;
                document?: "supported" | "rejected" | "silently_dropped" | undefined;
            } | undefined;
            toolChoice?: boolean | undefined;
            promptCaching?: {
                mode?: "explicit" | "implicit" | "ignored" | undefined;
                minCacheableTokens?: number | undefined;
                ttlSeconds?: number | undefined;
                maxBreakpoints?: number | undefined;
            } | undefined;
            sampling?: {
                temperature?: {
                    min?: number | undefined;
                    max?: number | undefined;
                    minExclusive?: boolean | undefined;
                    maxExclusive?: boolean | undefined;
                    clampEpsilon?: number | undefined;
                } | undefined;
                temperatureRange?: [number, number] | undefined;
                temperatureFixed?: number | undefined;
            } | undefined;
            modelModifiers?: string[] | undefined;
            defaultContextWithoutModifier?: number | undefined;
            quirks?: {
                stopSequences?: "ignored" | "honored" | "misreported_end_turn" | undefined;
                unknownModelFallback?: boolean | undefined;
                claudeModelNameMapping?: boolean | undefined;
                systemRoleInMessages?: boolean | undefined;
                streamUsageLocation?: "message_start" | "message_delta" | "both" | undefined;
                countTokensEndpoint?: boolean | undefined;
                modelsEndpoint?: boolean | undefined;
                minTimeoutMs?: number | undefined;
                maxTokensExcludesReasoning?: boolean | undefined;
            } | undefined;
            hostedTools?: string[] | undefined;
            background?: boolean | undefined;
        } | undefined;
        pricing?: Record<string, {
            inputPerMillion: number;
            outputPerMillion: number;
            cachedInputPerMillion?: number | undefined;
            peakMultiplier?: number | undefined;
            tiers?: {
                inputPerMillion: number;
                outputPerMillion: number;
                upToInputTokens?: number | undefined;
                cachedInputPerMillion?: number | undefined;
            }[] | undefined;
        }> | undefined;
    }> | undefined;
    modelAliases?: {
        reasoning?: string | undefined;
        main?: string | undefined;
        fast?: string | undefined;
    } | undefined;
    fallbacks?: Record<string, string[]> | undefined;
    mcpServers?: Record<string, {
        transport: "stdio";
        command: string;
        args?: string[] | undefined;
        cwd?: string | undefined;
        env?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    } | {
        transport: "http";
        url: string;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
        pool?: {
            connections?: number | undefined;
            maxInflightPerConnection?: number | undefined;
            queueTimeoutMs?: number | undefined;
        } | undefined;
        reconnect?: {
            enabled?: boolean | undefined;
            initialBackoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            maxAttempts?: number | null | undefined;
        } | undefined;
        load?: "lazy" | "eager" | undefined;
        toolAllowlist?: string[] | undefined;
    }> | undefined;
    permissions?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
        classifier?: {
            enabled?: boolean | undefined;
            tightenOutsideAuto?: boolean | undefined;
            callBudget?: number | "off" | undefined;
        } | undefined;
        defaultMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk" | undefined;
        disableBaselineProtection?: boolean | undefined;
        recommendedRules?: boolean | undefined;
        projectAskBudget?: number | "off" | undefined;
    } | undefined;
    ui?: {
        theme?: "dark" | "light" | "high-contrast" | "colorblind" | undefined;
    } | undefined;
    verify?: {
        command?: string | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    effort?: "max" | "low" | "medium" | "high" | undefined;
    outputStyle?: string | undefined;
    audit?: {
        enabled?: boolean | undefined;
        dir?: string | undefined;
    } | undefined;
    sandbox?: {
        network?: "allow" | "deny" | undefined;
        mode?: "off" | "on" | "required" | undefined;
        allowWrite?: string[] | undefined;
    } | undefined;
    workspaceTrust?: {
        enforce?: boolean | undefined;
    } | undefined;
    semanticIndex?: {
        url?: string | undefined;
        timeoutMs?: number | undefined;
        repoId?: string | undefined;
        branch?: string | undefined;
        topK?: number | undefined;
    } | undefined;
    telemetry?: {
        enabled?: boolean | undefined;
    } | undefined;
    window?: {
        byModel?: Record<string, number> | undefined;
    } | undefined;
    context?: {
        activeScheme?: string | undefined;
        schemes?: Record<string, {
            params?: Record<string, unknown> | undefined;
            origin?: string | undefined;
            displayName?: string | undefined;
            stage?: "test" | "production" | "experimental" | undefined;
            parentId?: string | undefined;
        }> | undefined;
    } | undefined;
    usageReporting?: {
        enabled?: boolean | undefined;
    } | undefined;
    update?: {
        channel?: "none" | "stable" | "beta" | undefined;
        pinnedVersion?: string | undefined;
        manifestUrl?: string | undefined;
        checkEnabled?: boolean | undefined;
    } | undefined;
    storage?: {
        checkpoints?: {
            max?: number | undefined;
            maxAgeDays?: number | undefined;
        } | undefined;
        sessionsDir?: string | undefined;
        checkpointsDir?: string | undefined;
        autoCheckpointBeforeCompact?: boolean | undefined;
        segmentation?: {
            enabled?: boolean | undefined;
            maxBytes?: number | undefined;
            maxRecords?: number | undefined;
        } | undefined;
    } | undefined;
}>;
type MergedTansrConfig = z.infer<typeof MergedTansrConfigSchema>;

/**
 * 配置五层合并:公共类型与常量。
 *
 * 五层优先级(高 → 低):
 *   managed(企业托管,本期占位)
 *   > projectLocal(<项目>/.tansr/settings.local.json)
 *   > projectShared(<项目>/.tansr/settings.json)
 *   > user(~/.tansr/settings.json,可被 TANSR_CONFIG_DIR 改目录)
 *   > builtin(内置默认,全部来自 schema 默认值)。
 *
 * 密钥铁律:配置只携带 auth.env(环境变量名)。本子系统的
 * 任何输出——config 对象、diagnostics、sources——都不得包含配置文件中字段的
 * 「值」:诊断只描述键路径与值的 JSON 类型;JSONC 解析错误只携带行列号,
 * 不携带 V8 错误消息(其中可能内嵌原文片段)。
 *
 * i18n:诊断为纯结构化数据(code + params),渲染由表面层按 code 映射 i18n 键
 * (AGENTS.md「工具只产出结构化数据」铁律;键清单见任务报告)。
 */

/** 配置层名(与权限引擎的 RuleLayerName 是两套概念,映射见 permissions.ts) */
type ConfigLayerName = 'managed' | 'projectLocal' | 'projectShared' | 'user' | 'builtin';
type ConfigDiagnosticSeverity = 'error' | 'warning' | 'info';
type ConfigDiagnosticCode = 
/** JSONC 语法错误,该层整体跳过(params 可含 line/column) */
'parse_error'
/** 文件存在但读取失败(非 ENOENT),该层整体跳过 */
 | 'read_error'
/** 文件根不是 JSON 对象,该层整体跳过 */
 | 'not_object'
/** 未知键:告警不失败,合并结果中剥离该键 */
 | 'unknown_key'
/** 已知键类型错误:该键从来源层剥离,回退更低层的值 */
 | 'invalid_value'
/** 合并后仍缺必填字段:所在条目整体剥离(如 providers.<id> 缺 baseUrl) */
 | 'missing_required'
/** $schemaVersion 不受支持(非整数 / 高于当前 / 无迁移链),该层整体跳过 */
 | 'schema_version_unsupported'
/** 迁移已应用(信息级;迁移只发生在内存,不回写文件) */
 | 'migration_applied'
/** 迁移器抛错,该层整体跳过(失败不阻断启动,doc/02 §7.6) */
 | 'migration_failed'
/** permissions 规则元素非字符串(剥离)或不可解析(保留但引擎会忽略) */
 | 'permission_rule_invalid'
/** permissions.defaultMode 非法,忽略该层的 defaultMode */
 | 'permission_mode_invalid'
/** permissions.defaultMode 声明的模式不被该配置层尊重(扩权模式 auto/acceptEdits/bypassPermissions 仅 user/managed 可声明;忽略该层声明) */
 | 'permission_mode_layer_ignored'
/** permissions 段的扩权键(disableBaselineProtection=true / classifier.*)出现在项目层,忽略该层声明 */
 | 'permission_setting_layer_ignored'
/** 项目层 allow 规则冻结不进引擎(项目字节面不得扩权;deny/ask 照常),params.count 为冻结条数 */
 | 'permission_project_allow_frozen'
/** 仅 managed 层被尊重的段(policy/workspaceTrust)出现在下层,忽略(contract-v0.8) */
 | 'managed_section_ignored'
/** 仅 user/managed 层被尊重的 memory 段出现在项目层,忽略(TMEM/1 防克隆即提权) */
 | 'memory_section_layer_ignored'
/** 仅 user/managed 层被尊重的 http 段(凭据出线名单)出现在项目层,忽略(防克隆即放宽名单) */
 | 'http_section_layer_ignored'
/** 仅 user/managed 层被尊重的 sandbox 段出现在项目层,忽略(段策略表 user-managed 律;项目层 allowWrite / network 皆为加宽方向) */
 | 'sandbox_section_layer_ignored'
/** 仅 user/managed 层被尊重的 update 段出现在项目层,忽略(项目层 manifestUrl / channel:none / pinnedVersion 皆可劫持更新链) */
 | 'update_section_layer_ignored'
/** 键属已退役词表,兼容窗内照常生效(info 级劝导;RFC-U4 迁移单——现仅 permissions.classifier,新词表键随拍板引入后升 warning 携指引) */
 | 'key_deprecated'
/** 兜底:多轮降级后仍不可用,整体回退内置默认 */
 | 'config_unusable'
/** hooks 段/事件条目/执行体形态错误,剔除所在粒度 */
 | 'hook_invalid_value'
/** hooks 段下未知键(告警不失败) */
 | 'hook_unknown_key'
/** matcher 非法(超长/正则编译失败),条目剔除 */
 | 'hook_matcher_invalid'
/** managed 专属控制键出现在下层,忽略 */
 | 'hook_control_ignored'
/** http 执行体 url 非 http/https 或不可解析,条目剔除 */
 | 'hook_url_invalid'
/** mcpServers 段/条目形态错误,剔除所在粒度 */
 | 'mcp_invalid_value'
/** 服务器条目内未知键(告警不失败,键已剥离) */
 | 'mcp_unknown_key'
/** 服务器名不符合命名约束,条目剔除 */
 | 'mcp_server_name_invalid'
/** 条目 schema 校验失败,条目剔除 */
 | 'mcp_server_invalid'
/** 跨层同名被高层覆盖(信息级) */
 | 'mcp_server_shadowed'
/** pool/reconnect 子键类型错或越界,子键剔除(条目其余部分照常生效) */
 | 'mcp_governance_invalid'
/** pool.connections 超上限钳到上限(params.max) */
 | 'mcp_governance_clamped';
/** 配置加载诊断条目:严重级别、诊断码、归因层与键路径;只含键名与类型信息,永不含配置值。 */
interface ConfigDiagnostic {
    severity: ConfigDiagnosticSeverity;
    code: ConfigDiagnosticCode;
    /** 问题归因到的配置层 */
    layer: ConfigLayerName;
    /** 配置键路径(段以 . 连接,数组下标为数字段);只含键名,永不含值 */
    path?: string;
    /** 来源文件绝对路径(builtin 层无) */
    file?: string;
    /**
     * 结构化参数,供表面层插值渲染。约定:expected/received 只描述类型或
     * schema 侧的期望摘要(枚举选项、上下界),永不携带配置原值。
     */
    params?: Record<string, string | number>;
}
/** 文件系统注入缝:测试用内存假实现,不碰真实用户目录 */
interface ConfigFileSystem {
    /** 按 utf8 读文件;不存在时抛 { code: 'ENOENT' } 形态错误 */
    readFile(filePath: string): Promise<string>;
    /** 目录存在性探测(项目根 .tansr 发现用) */
    directoryExists(dirPath: string): Promise<boolean>;
}
/** loadConfig 的选项:项目 / 用户 / managed 各层的发现起点与平台判定,以及 env / fs 注入缝。 */
interface LoadConfigOptions {
    /** 项目发现起点,默认 process.cwd() */
    cwd?: string;
    /** 用户层根,默认 os.homedir() */
    homedir?: string;
    /** 环境变量注入缝(只读 TANSR_CONFIG_DIR / PROGRAMDATA,不读任何密钥值) */
    env?: Record<string, string | undefined>;
    /** 文件系统注入缝,默认包装 node:fs/promises */
    fs?: ConfigFileSystem;
    /** managed 层候选路径的平台判定,默认 process.platform */
    platform?: NodeJS.Platform;
    /** managed 层候选路径覆盖(企业托管本期占位:仅按既知路径读取) */
    managedPaths?: readonly string[];
    /** 项目根向上发现的上边界(含);默认走到文件系统根 */
    boundary?: string;
    /**
     * Q4-5(T5):随结果返回各合并参与层的只读快照(layers 键)。缺省 false
     * = 现行为字节不变(纯加法诊断缝,doctor --dump-config 消费)。
     */
    captureLayers?: boolean;
}
/** 项目层被冻结的 allow 规则(按层保留原文,供确认面/未来 Grant 消费) */
interface FrozenProjectAllow {
    layer: 'projectLocal' | 'projectShared';
    rules: string[];
    /** 来源文件绝对路径(可判定时携带;符号链接/嵌入形态一律按仓库来源处理) */
    file?: string;
}
/**
 * permissions 段的装配产物:各层规则数组按层保留(不跨层合并),
 * 键名即权限引擎的 RuleLayerName——可整体喂给 PermissionEngineConfig.layers,
 * 最严格者胜的合并语义由引擎在判定期执行。
 * 项目层 allow 不进 layers(见 frozenProjectAllow),deny/ask 照常。
 */
interface LoadedPermissions {
    layers: Partial<Record<RuleLayerName, PermissionRules>>;
    /** 最高优先层声明的 defaultMode(managed 声明即锁定);供引擎 mode 初值 */
    defaultMode?: PermissionMode;
    /**
     * defaultMode 的声明层(与 defaultMode 同步落定):layer='managed'
     * 即构成 per-profile 权限档裁决的上界锚——serve 会话档案的 permissionMode
     * 只能比它紧,不得越过(消费在 cli serve 工厂 resolveProfilePermissionMode)。
     */
    defaultModeLayer?: ConfigLayerName;
    /**
     * 最高优先层声明的内置基线开关(contract-v0.7,RFC-OPT4-1;true=关闭)。
     * 分层语义与 defaultMode 同:managed 显式声明 false 即锁定基线开启;
     * 供引擎构造 `baseline.enabled = !(disableBaselineProtection ?? false)`。
     */
    disableBaselineProtection?: boolean;
    /**
     * 最高优先层声明的 LLM 分类器开关(contract-v0.8,RFC-OPT18-2;
     * permissions.classifier.enabled)。分层语义与 defaultMode 同;消费在
     * cli assembly/permission-classifier.ts(TANSR_PERMISSION_CLASSIFIER
     * 显式设置时整体接管,env 缺席才读本键)。仅 user/managed 层被尊重。
     */
    classifierEnabled?: boolean;
    /**
     * 分类器治理位两键(contract-v0.13,RFC-WE-2;permissions.classifier.
     * {tightenOutsideAuto,callBudget})。层限与 classifierEnabled 同(项目层
     * classifier 子段整段忽略);对应 env(TANSR_CLASSIFIER_TIGHTEN_OUTSIDE_
     * AUTO / TANSR_CLASSIFIER_BUDGET)保留为最高优先覆盖,消费在 cli
     * assembly/permission-classifier.ts resolveClassifierGovernance。
     */
    classifierTightenOutsideAuto?: boolean;
    /** ≥1 = 每会话咨询上限;'off' = 不限;undefined = 内核缺省 */
    classifierCallBudget?: number | 'off';
    /**
     * stage 输出 token 预算两键(2026-08-25 拍板 C 案本地层;permissions.
     * classifier.{stage1MaxTokens,stage2MaxTokens})。≥1 整数,无 'off'
     * (流式输出必须有限上限);层限同 classifier 段(仅 user/managed)。
     * 覆写 = 协议变体:生效值卷入协议指纹,旧评估证据机械失效(如实呈现,
     * 任命即授照不阻断)。消费在 cli assembly/permission-classifier.ts;
     * 池下发层候池 schema 演进并案(doc/49 当日登记)。
     */
    classifierStage1MaxTokens?: number;
    classifierStage2MaxTokens?: number;
    /**
     * 出厂规则包装载开关(contract-v0.13,RFC-WE-2;permissions.
     * recommendedRules)。仅 user/managed 层被尊重(卸出厂 ask 包属扩权向);
     * env TANSR_RECOMMENDED_RULES 最高优先。消费在 cli assembly/policy.ts。
     */
    recommendedRules?: boolean;
    /**
     * 项目 ask 注意力预算(contract-v0.13,RFC-WE-2;permissions.
     * projectAskBudget)。≥1 改上限 / 'off' 关闭;仅 user/managed 层被尊重
     * (预算防的就是项目层提示风暴);env TANSR_PROJECT_ASK_BUDGET 最高优先。
     * 消费在 cli assembly/ask-budget.ts。
     */
    projectAskBudget?: number | 'off';
    /**
     * 项目层(projectLocal/projectShared)声明的 allow 规则冻结清单——
     * 不进引擎(引擎侧 collectRules 同口径二重保险),deny/ask 不受影响。
     * 消费方(TUI 启动诊断汇总、未来的 Grant 确认面)据此展示;
     * 无冻结项时不落键。
     */
    frozenProjectAllow?: FrozenProjectAllow[];
}
/**
 * policy 段的逐层抽取产物(contract-v0.8,RFC-OPT11-2;仅 managed 层被尊重)。
 * managed 层原文**不在 kernel 校验**:形状裁决归消费方(cli assembly/policy.ts)
 * ——若 kernel 校验失败即剥离,坏材料会静默退回「无信任材料」的放行语义,
 * 违背 fail-closed(消费方须能看见「声明过但损坏」并拒绝一切 bundle)。
 */
interface LoadedPolicySection {
    /** managed 层 policy 段原文(未声明缺席;消费方 schema 校验,坏 → fail-closed) */
    managed?: unknown;
    /** 声明了 policy 段但被忽略的低层(优先级降序;消费面示警归因) */
    ignoredLayers: ConfigLayerName[];
}
/** workspaceTrust 段的逐层抽取产物(contract-v0.8,RFC-OPT12-2;仅 managed 层被尊重) */
interface LoadedWorkspaceTrust {
    /** managed 层声明的 enforce(非布尔已剥离并诊断);undefined = 未声明(缺省现状语义) */
    enforce?: boolean;
    /** 声明了 workspaceTrust 段但被忽略的低层(优先级降序) */
    ignoredLayers: ConfigLayerName[];
}
/**
 * TMEM/3 C1(doc/74)— `memory.inviteGate` 三态:
 * - 'off'(缺省)= 全模型机械门(现状);
 * - 'on' = 全模型收门(无邀请轮跳提取 fork);
 * - { models } = 按模型白名单收门(`provider/model` 句柄;当轮主模型不在
 *   单即机械门)。
 * 生效判定与 env kill switch(TANSR_MEMORY_INVITE_GATE=off 凌驾一切)在
 * cli 装配层 resolveMemoryInviteGate;本层只管抽取与形状。
 */
type MemoryInviteGateSetting = 'off' | 'on' | {
    models: string[];
};
/**
 * memory 段的逐层抽取产物(TMEM/1 TM-5;user/managed 两层被尊重,项目层
 * 忽略——autoMemory 开启即开记忆目录 carve-out 写面,防克隆即提权,见
 * memory-section.ts)。TMEM/3 批 C/批 E(doc/74/75)纯增四键,全部缺省关:
 * 抽取只存合法原始值,钳制/env 凌驾在 cli 装配层 resolveMemoryXxx 单点。
 */
interface LoadedMemorySection {
    /** M1 自动记忆显式开关(managed > user;非布尔已剥离);undefined = 未声明(方案桶裁决) */
    autoMemory?: boolean;
    /** C1 内容门(managed > user;形损已剥离);undefined = 未声明(缺省 'off' 机械门) */
    inviteGate?: MemoryInviteGateSetting;
    /** inviteGate 生效值的来源层(doctor 生效来源行材料;与 inviteGate 同在同缺席) */
    inviteGateLayer?: 'managed' | 'user';
    /** C2 背压轮距原始值(≥0 整数;0=关);生效钳制(下限 5)在 resolveMemoryBackpressureInterval */
    backpressureInterval?: number;
    /** E2 邀请轮截断开关('off' 缺省);undefined = 未声明 */
    extractionTruncation?: 'off' | 'on';
    /** E2 截断近轮数 K 原始值(≥1 整数);生效钳制([1,20])在 resolveMemoryTruncation */
    truncationRecentRounds?: number;
    /** 声明了 memory 段但被忽略的项目层(优先级降序) */
    ignoredLayers: ConfigLayerName[];
}
/** http 段生效值的来源层(doctor 归因;远程 org 下发时为 'remote') */
type HttpSectionLayer = 'managed' | 'user' | 'remote';
/**
 * http 段的逐层抽取产物(user/managed 两层被尊重,项目层忽略——名单放宽即
 * 凭据出线面放宽,防克隆即提权,见 http-section.ts)。名单只存合法原始值,消费在
 * kernel `resolveHttpAuth(allowlist)`(Http 工具)与 `HookEngine({ http: { allowedHeaderEnvVars } })`
 * (hooks http 执行体),两处同一个键。
 */
interface LoadedHttpSection {
    /** 可被模型经 HTTP 出网点带走的环境变量名单;undefined = 未声明(不限,现状) */
    allowedAuthEnvVars?: readonly string[];
    /** allowedAuthEnvVars 生效值的来源层(与其同在同缺席) */
    allowedAuthEnvVarsLayer?: HttpSectionLayer;
    /** 声明了 http 段但被忽略的项目层(优先级降序) */
    ignoredLayers: ConfigLayerName[];
}
/**
 * sandbox.mode 生效值的来源层(doctor 归因 + kernel env 方向律输入):
 * - `managed` = **地板**——TANSR_SANDBOX 只能比它更严(`resolveSandboxSettings` 归因 `env-suppressed`);
 * - `user` = 个人缺省——env 可任意压掉(排查 / CI 逃生阀,types.ts:161 头注意图不变);
 * - `remote` = 远程 org 常规下发(cli remote-settings 叠加;走 user 层语义——锁定下发时 env 已在
 *   装配期被剔除,钉值恒胜,无需 kernel 再判方向)。
 */
type SandboxModeLayer = 'managed' | 'user' | 'remote';
/**
 * sandbox 段的逐层抽取产物(user / managed 两层被尊重,项目层忽略——`allowWrite` /
 * `network:'allow'` 只有加宽方向,`mode` 可被项目层解除,皆属「项目字节面不得扩权」)。
 * 形状与 protocol SandboxSectionSchema 逐键对齐(kernel sandbox/types.ts SandboxSectionInput 直接
 * 消费:`resolveShellSandbox({ section: loaded.sandbox })`);逐键高层胜(managed > user),
 * 不跨层并集。
 */
interface LoadedSandboxSection {
    mode?: 'off' | 'on' | 'required';
    /** mode 生效值的来源层(与 mode 同在同缺席;env 方向律与 doctor 归因材料) */
    modeLayer?: SandboxModeLayer;
    /** 追加写根(高层胜整体覆盖;相对路径按 cwd 解析在 resolveSandboxSettings) */
    allowWrite?: readonly string[];
    /** allowWrite 生效值的来源层(cli 远程半层叠加判「常规不越 managed」的依据) */
    allowWriteLayer?: SandboxModeLayer;
    network?: 'allow' | 'deny';
    /** network 生效值的来源层(同上) */
    networkLayer?: SandboxModeLayer;
    /** 声明了 sandbox 段但被忽略的项目层(优先级降序) */
    ignoredLayers: ConfigLayerName[];
}
/** update.manifestUrl 生效值的来源层(更新确认卡显示来源层消费;远程下发 = 'remote') */
type UpdateManifestUrlLayer = 'managed' | 'user' | 'remote';
/**
 * update 段的逐层抽取产物(user / managed 两层被尊重,项目层忽略——
 * 项目层 `manifestUrl` 指向自建 manifest = 更新链劫持,`channel:'none'` 可禁用安全更新,
 * `pinnedVersion` 可钉住有漏洞旧版,无「收紧」语义可言,整段项目层不可见)。形状与 kernel
 * UpdateSectionSchema 逐键对齐,cli update/check.ts 以 `ConfigUpdateSection` 形消费(结构兼容)。
 * 四 env(TANSR_UPDATE_*)维持逐键最高优先覆盖(表 env:'override';远程锁定时 cli 剔除)。
 */
interface LoadedUpdateSection {
    channel?: 'stable' | 'beta' | 'none';
    /** channel 生效值的来源层(cli 远程半层叠加判「常规不越 managed」的依据) */
    channelLayer?: UpdateManifestUrlLayer;
    pinnedVersion?: string;
    pinnedVersionLayer?: UpdateManifestUrlLayer;
    manifestUrl?: string;
    /** manifestUrl 生效值的来源层(与 manifestUrl 同在同缺席;C 路确认卡显示来源层的接口位) */
    manifestUrlLayer?: UpdateManifestUrlLayer;
    checkEnabled?: boolean;
    checkEnabledLayer?: UpdateManifestUrlLayer;
    /** 声明了 update 段但被忽略的项目层(优先级降序) */
    ignoredLayers: ConfigLayerName[];
}
/**
 * loadConfig 顶层产物:合并配置 + 按层保留的 permissions + 装配后的 hooks。
 * 契约的原始 permissions / hooks / mcpServers / policy / workspaceTrust 段
 * (contract-v0.6/v0.3/v0.4/v0.8)、http 段与 sandbox / update 段在合并前
 * 被逐层抽取(段策略表 section-policy.ts),从不进入合并产物——此处以装配产物顶替同名键
 * (Omit 隔离两形态)。
 */
interface LoadedConfig extends Omit<MergedTansrConfig, 'permissions' | 'hooks' | 'mcpServers' | 'policy' | 'workspaceTrust' | 'http' | 'sandbox' | 'update'> {
    permissions: LoadedPermissions;
    /** hooks 段分层抽取产物(可直接喂 HookEngineOptions.hooks) */
    hooks: LoadedHooks;
    /** mcpServers 段分层抽取产物(可直接喂 attachMcpTools) */
    mcpServers: McpServerEntry[];
    /** policy 段分层抽取产物(contract-v0.8;仅 managed 层被尊重,见 managed-sections.ts) */
    policy: LoadedPolicySection;
    /** workspaceTrust 段分层抽取产物(contract-v0.8;仅 managed 层被尊重) */
    workspaceTrust: LoadedWorkspaceTrust;
    /** memory 段分层抽取产物(TMEM/1;user/managed 被尊重,项目层忽略,见 memory-section.ts) */
    memory: LoadedMemorySection;
    /** http 段分层抽取产物(user/managed 被尊重,项目层忽略,远程 org 可下发,见 http-section.ts) */
    http: LoadedHttpSection;
    /** sandbox 段分层抽取产物(user/managed 被尊重,项目层忽略,env 对 managed 只收紧,见 sandbox-section.ts) */
    sandbox: LoadedSandboxSection;
    /** update 段分层抽取产物(user/managed 被尊重,项目层忽略,见 update-section.ts) */
    update: LoadedUpdateSection;
}

/**
 * mcpServers 配置段的容错抽取(仿 hooks 在 contract 化前的先例)。
 *
 * 段形态(kernel 扩展):
 *   "mcpServers": {
 *     "<name>": {
 *       "transport": "stdio",
 *       "command": "node", "args": ["server.mjs"],
 *       "env": { "API_KEY": "${MY_API_KEY}" },   // 值支持整值 ${VAR} 引用
 *       "cwd": "C:/srv", "enabled": true
 *     },
 *     "<name2>": {
 *       "transport": "http",
 *       "url": "https://mcp.corp.example/mcp",
 *       "headers": { "authorization": "${MCP_CORP_TOKEN}" }
 *     }
 *   }
 *
 * 语义:
 * - 抽取发生在五层深合并之前:从各层原始对象上「弹出」mcpServers 键
 *   (delete,与 permissions/hooks 同法——深合并与未知键扫描不再见到它),
 *   本卡不改 config/load.ts,接线 diff 由集成人应用(见任务报告);
 * - 跨层同名:高层胜(managed → projectLocal → projectShared → user),
 *   被覆盖的低层条目产 info 诊断;
 * - 容错:段/条目形态错 → 诊断 + 按最小粒度剔除,坏配置永不拖垮装配;
 * - 密钥铁律:诊断只含键路径与类型信息,永不携带配置值(env/headers 的值
 *   可能是凭据);服务器名进诊断 params(名字非值,可安全展示)。
 *
 * 契约对齐(contract-v0.4):protocol McpServersSectionSchema
 * 已收录本段形态(规范性描述);本模块保持容错抽取语义不变(坏条目剔除 +
 * 诊断,不整段失败,不以契约 schema 的 parse 失败为准——hooks 同先例)。
 *
 * SC-44(contract-v0.21,RFC-SC-2 R5)— 逐台连接治理键 `pool` / `reconnect`
 * 的**子键粒度**容错:两键组在进条目 schema 之前先经 sanitizeGovernanceKeys
 * 逐子键校验——类型错/越界子键剔除(其余子键与条目照常生效)+ 诊断
 * `mcp_governance_invalid`;`pool.connections` 超上限钳到 16 + 诊断
 * `mcp_governance_clamped`;子键未知按既有 `mcp_unknown_key` 告警剔除。
 * 坏治理键永不拖垮所在服务器条目(它只影响连接治理,不影响能否连接)。
 * 缺省语义(键缺席)由 governance.ts / lazy-manager 补,本层不落任何默认值
 * ——undefined 与显式值可区分,配置指纹只反映用户写了什么。
 */

/**
 * CW17-M2A(doc/60 §2.2,D9 拍板)— 懒加载增量键(transport 无关,连接层
 * 不消费,lazy-manager 消费):
 * - `load`:'lazy'(缺省)| 'eager'(逃生舱:装配期连接+全量展开;恒不缺省);
 * - `toolAllowlist`:server 内工具白名单——目录与发现都只见名单内(源头
 *   控量,先于一切帽);空数组 = 零工具可见。
 */
interface McpServerLazyOptions {
    load?: 'lazy' | 'eager';
    toolAllowlist?: string[];
}
type McpServerLoadMode = NonNullable<McpServerLazyOptions['load']>;
/**
 * SC-44(contract-v0.21,RFC-SC-2)— 逐台连接治理键(transport 无关,连接层
 * 不消费,governance.ts 合并后喂连接池):
 * - `pool`:connections 1–16(有会话态的服务器恒 1)/ maxInflightPerConnection
 *   ≥1 / queueTimeoutMs ≥0;
 * - `reconnect`:enabled / initialBackoffMs ≥100 / maxBackoffMs ≥100 /
 *   maxAttempts ≥1 | null(null = 无限)。
 * 形以 protocol 导出类型为准(kernel 抽取层与契约同字面量);全可选、不落缺省。
 */
interface McpServerGovernanceOptions {
    pool?: McpServerPoolConfig;
    reconnect?: McpServerReconnectConfig;
}
/** 单台 MCP 服务器的完整配置:stdio 或 http 传输形 + 懒连接选项 + 连接池 / 重连治理。 */
type McpServerConfig = (McpStdioServerConfig | McpHttpServerConfig) & McpServerLazyOptions & McpServerGovernanceOptions;
/** 抽取产物条目(attachMcpTools 的输入形态) */
interface McpServerEntry {
    name: string;
    config: McpServerConfig;
    /** 归因层(独立解析场景可缺省) */
    layer?: ConfigLayerName;
    file?: string;
}

/**
 * CW17-M2A — MCP 工具目录:目录模型、三级帽常量、消毒、目录段渲染(doc/60 §3.2/§3.6/§4.3)。
 *
 * 目录段是懒加载形态的模型可见「能力清单」:每个懒加载 server 一节,每工具
 * 一行 `name — 一句话`;完整 schema 恒不在此(McpDiscover 按需展开)。段落
 * 语义(装配层 W2 消费):IRSystemSegment{ label:'mcp', cacheable:true },
 * 恒排 system 段序末位 + 独立缓存断点(Δ2:目录是 per-user 内容,不得污染
 * 前部跨用户共享前缀)。段文本在装配期定格,会话内字节冻结(§3.7)。
 *
 * 防注入(§4.3):远端 description/工具名是不受信输入,写入上下文前一律
 * 消毒——压平换行、剥控制字符、转义 `<system-reminder>`/`<memory-file>` 与
 * 本段边界标签字面量(skills 索引段同款,context/escape.ts 复用)。
 *
 * 帽常量集中本文件一处(§3.6 装载期校验:dsh fail-fast 样板)——模块装载
 * 即跑不变式,违反即 throw(编程错误早爆,不进运行期分支)。
 */

/** 目录条目(单工具):name 已过发现面校验,oneLiner 已消毒已帽 */
interface McpCatalogToolEntry {
    name: string;
    oneLiner: string;
}
/** 目录条目(单 server) */
interface McpCatalogServerEntry {
    server: string;
    tools: McpCatalogToolEntry[];
}

/**
 * 共享连接/发现逻辑(内部模块,不进公共出口)。
 *
 * 自 attach.ts 平移:`${VAR}` 整值环境引用解析、elicitation 感知的
 * 服务端请求处理器、建连(establishMcpConnection)与 tools/list 全量发现
 * (discoverAllowedMcpTools)两步。eager 路径(attach)与懒连接管理器
 * (lazy-manager)共用,消灭双实现。
 *
 * 本波增量:
 * - `toolAllowlist` 源头过滤(§2.2):发现产物先过白名单再进任何下游
 *   (目录/展开/缓存都只见名单内)——控量先于一切帽;
 * - `connectFactory` 注入缝(§六):测试 hermetic 注入回环连接;未来
 *   「平台托管 MCP」形态的技术接缝(代码零预铺,缝天然存在)。注入时
 *   `${VAR}` 解析与 transport 分派整体旁路,工厂全权。
 *
 * SC-31:建连与发现拆为两步——连接池(pool.ts)逐成员建连(每成员独立
 * 事件观察者,池借此感知成员断开),工具发现只在主成员就位钩子里跑一次;
 * `pool` / `metrics` / `maxPendingWriteBytes` 三个治理选项经本选项面透传。
 */

/**
 * 连接工厂建连上下文(SC-31):slot = 池内成员序号(缺省池 1 恒 0);
 * onEvent = 该成员的事件观察者——工厂产出的连接若能出事件,应路由到此
 * (池借此感知成员断开;不路由时池退回懒检出:调用撞见 closed 才感知)。
 */
interface McpConnectFactoryContext {
    slot: number;
    onEvent: McpEventObserver;
}
/** 连接工厂注入缝(§六平台链路预留;测试 hermetic 用;第二参可忽略) */
type McpConnectFactory = (entry: McpServerEntry, context: McpConnectFactoryContext) => Promise<McpConnection>;

/** 懒连接状态词(/mcp 呈现与审计的投影源;词表见文件头状态机) */
type McpLazyServerState = 'disabled' | 'idle' | 'connecting' | 'ready' | 'disconnected' | 'failed' | 'closed';
interface McpSkippedTool {
    tool: string;
    reason: 'duplicate_name' | 'invalid_name';
}
/** 单 server 状态投影(McpServerItemData 加法与 attach 适配的共同数据源) */
interface McpServerLazyStatus {
    name: string;
    transport: McpTransportKind;
    state: McpLazyServerState;
    loadMode: McpServerLoadMode;
    /** 目录条目数(目录段所见;eager server 恒 0——工具已全量在 tools 数组) */
    catalogToolCount: number;
    /** 已展开桥接工具数 */
    loadedToolCount: number;
    /** 已展开桥接工具名(注册序) */
    tools: string[];
    skippedTools: McpSkippedTool[];
    /** 目录来源(idle/ready 时有:缓存命中或装配期现连发现) */
    catalogSource?: 'cache' | 'live';
    protocolVersion?: string;
    serverInfo?: McpPeerInfo;
    error?: {
        code: McpErrorCode;
        message: string;
    };
    /** SC-31:连接池规模与就绪成员数(曾建池时有;缺省池 total 恒 1) */
    connections?: {
        total: number;
        ready: number;
    };
    /** SC-31:有成员断开时的自动重连状态(全员就绪时缺席) */
    reconnect?: McpReconnectStatus;
}
/** 单工具展开产物 */
interface McpExpandedTool {
    remoteName: string;
    bridgedName: string;
    /** 顶层参数要点(McpDiscover 结果面;schema 降级时为固定提示语) */
    paramsSummary: string;
    /** schema 超 8K 帽降级保可见(Δ3) */
    schemaDegraded: boolean;
}
type McpExpandStatus = 'ok' | 'unknown_server' | 'disabled' | 'connect_failed' | 'closed';
/** McpDiscover 执行面的展开结果 */
interface McpExpandOutcome {
    server: string;
    status: McpExpandStatus;
    /** 本次新注册 */
    loaded: McpExpandedTool[];
    /** 请求了但已展开(幂等短答面) */
    alreadyLoaded: string[];
    /** 请求了但现连发现集合里没有 */
    unknownTools: string[];
    /** 注册面冲突跳过 */
    skipped: McpSkippedTool[];
    /** server instructions(该 server 首次展开时携带一次;已帽已消毒) */
    instructions?: string;
    /** status ≠ 'ok' 时的结构化错误 */
    error?: {
        code: McpErrorCode;
        message: string;
    };
}
interface McpEnsureConnectedResult {
    ok: boolean;
    error?: {
        code: McpErrorCode;
        message: string;
    };
}
/**
 * 展开视图(McpDiscover 消费的最小面;P1-B):expand 写入视图绑定的
 * toolset,snapshot 的 loadedToolCount/tools 反映视图自己的展开记录。
 * McpLazyManager 自身即主视图(绑定构造 toolset)。
 */
interface McpExpandView {
    /** 全部 server 状态投影(输入序;展开计数按本视图) */
    snapshot(): McpServerLazyStatus[];
    /** 展开注册(McpDiscover 执行面;tools 缺省 = 该 server 全部) */
    expand(server: string, tools?: readonly string[]): Promise<McpExpandOutcome>;
}
interface McpLazyManager extends McpExpandView {
    /** 目录条目(装配期定格,会话内字节冻结;只含懒加载 server) */
    readonly catalog: readonly McpCatalogServerEntry[];
    /** 确保连接(idle/disconnected/failed → connecting → ready;幂等,单飞) */
    ensureConnected(name: string): Promise<McpEnsureConnectedResult>;
    /** 显式重连(就地重绑不摘 def);未声明名返回 null */
    reconnect(name: string): Promise<McpServerLazyStatus | null>;
    /** 断开全部连接并进入 closed 终态(幂等) */
    closeAll(): Promise<void>;
    /** 实际本地释放完成;失败保留资源,可显式再次调用。 */
    settleClose(): Promise<void>;
    /** 声明的完成证据层;只有settleClose成功后才表示该层已完成。 */
    readonly cleanupEvidence: readonly McpCloseEvidenceLevel[];
    /**
     * 子代理展开视图(P1-B,doc/60 §3.3):expand 只写入参 toolset(子代理
     * 生效集副本),恒不写回主视图;连接/目录/缓存共享,def 对象跨视图同一。
     */
    forToolset(toolset: McpToolset): McpExpandView;
}

/**
 * 内核侧价格表:内置条目 + refreshPricing() 注入缝。
 *
 * 分层铁律(AGENTS.md):kernel(L2)不得 import providers(L1)实现。本表在
 * kernel 侧独立内置,形态与 providers/src/registry/capability-defaults.ts 的
 * pricing 对齐(同源自 doc/10 §4.1,同为 protocol PricingSchema 形态),但零
 * import 关系;providers 侧价目变更须同步本表(两处注释互指)。
 *
 * 索引粒度 = (provider, model) 二元组(W0 Spike③ 实证:MaaS 聚合工作空间同一
 * endpoint 路由多厂商,见 spikes/endpoint/REPORT.md §四.5),大小写不敏感。
 *
 * 数据溯源(逐条注释;查不到的价目一律登记为「已收录无价」条目,不编造——
 * 缺价降级路径会记 usage 不记金额并产结构化诊断):doc/10 §4.1 旗舰编码模型
 * 价位参考(¥/百万 token,输入未命中/命中/输出)。
 *
 * 来源优先级:user(用户配置)> refreshed(运行期在线刷新)> builtin(内置)。
 * 在线刷新不覆盖用户显式配置;同层重复 refresh 为 last-write-wins。
 */

/**
 * 内核成本计价形态:protocol Pricing 的结构超集——增补可选缓存写入价
 * (显式缓存创建溢价:Anthropic 型 1.25×/1h 2×,doc/02 §8.1、doc/80 §一;
 * 百炼显式面创建 125%——qwen3.7-max 官方价目页有 15 CNY/M 明码,doc/110 A4
 * 补录;隐式面 kimi/deepseek/glm 官方无写价 SKU(doc/80 §2.3「写免费」),
 * 该键恒不填)。填值纪律:只填文件内注释或 doc/80 §一价表已有官方出处的
 * 行,恒不臆造;缺席时 tracker 写量按 inputPerMillion 回退计(见 tracker.ts)。
 * protocol Pricing 值可直接赋值本类型;contract-v0.5(RFC-B3-3)起 Pricing 原生
 * 携带可选 tiers 阶梯,本形态自动继承(tracker 选档消费见 selectPricingTier)。
 */
interface CostPricing extends Pricing {
    /** 缓存写入价(¥或$/百万 token);缺省时缓存写入按 inputPerMillion 计 */
    cacheWriteInputPerMillion?: number;
}
/**
 * 币种词表 v1:国内试点两币种,ISO 4217 代码。
 * 扩词表走 RFC(与 tansrd budget.currency 同词表同节奏);金额聚合按币种
 * 分桶(tracker.ts),严禁跨币种直加——归一呈现是报表层职责(记账汇率)。
 */
declare const PRICING_CURRENCIES: readonly ["USD", "CNY"];
type PricingCurrency = (typeof PRICING_CURRENCIES)[number];
/**
 * refreshPricing 的更新单元。
 * pricing 三态:对象 = 设置价目;undefined(缺省)= 登记「已收录无价」条目;
 * null = 清除该来源层的条目(恢复下层生效)。
 */
interface PricingUpdate {
    providerId: string;
    modelName: string;
    /**
     * 缺省 'CNY'——kernel 面「缺省 = 现状语义零变化」:本表内置与
     * 注入缺省皆为人民币价,与 tansrd budget.pricing 的缺省
     * 'USD'(其现状 = USD/百万 token 语义)各自守现状,不互相迁就。
     */
    currency?: PricingCurrency;
    pricing?: CostPricing | null;
    /** 名义价标注(语义见 PricingEntry.nominal);缺省 = 真实价 */
    nominal?: boolean;
    note?: string;
}

/**
 * command 执行体:子进程 exec-form + stdin/exit-code/stdout 协议。
 *
 * 协议:
 * - spawn(argv[0], argv[1..]) 直接执行,不经系统 shell(exec-form——hook
 *   配置本身不构成 shell 注入面);
 * - stdin 一次性写入完整 JSON 事件载荷后关闭;
 * - exit 0 → 成功:stdout 若为 JSON 对象则解析为结构化响应(HookOutputSchema,
 *   strip 未知键;响应自身可携带 decision=deny|block 表达 JSON 形态阻断);
 *   非 JSON / 空 stdout 视为「无结构化响应的成功」;
 * - exit 2 → 阻断:stderr(截断后)作为阻断原因;
 * - 其他非零 → 非阻断错误(fail-open:单 hook 挂了不拦断主流程);
 * - spawn 失败(ENOENT/EACCES)→ 非阻断错误;
 * - 超时(默认 60s,可条目级覆盖)→ 杀进程,fail-open 计 timeout;
 * - 外部 AbortSignal → 杀进程,计 aborted(整批取消场景)。
 *
 * 超时与外部信号经 withTimeout 合成一条信号贯穿(与 Http 工具同法);
 * 进程终止用 kill(SIGTERM)+ 宽限后 SIGKILL 两段——hook 进程约定为单进程
 * 短任务,不做 Shell 工具级的进程树击杀(那套为交互式 shell 深树设计)。
 *
 * 注入缝(两个,择一):
 * - spawn(Q4-7 执行世界 SpawnLike,经 hook 引擎构造参数注入;缺省
 *   defaultSpawn——卫生段 cleanSensitiveEnv + node spawn 直通);
 * - spawnImpl(node spawn 同形函数,既有测试缝保留)——注入假实现全程零
 *   真实进程,**直通不经卫生段**(假实现本就不落真实环境);真实子进程
 *   冒烟用 process.execPath -e 短脚本单独覆盖。两者同时注入时 spawn 优先。
 */

type SpawnImpl = typeof spawn;
interface CommandHookRunnerOptions {
    /**
     * Q4-7(EW-2)执行世界 spawn 缝(缺省 defaultSpawn,含 env 卫生段;
     * 经 HookEngineOptions.command 即引擎构造参数注入)
     */
    spawn?: SpawnLike;
    /** spawn 注入缝(node spawn 同形;测试假实现,直通不经卫生段) */
    spawnImpl?: SpawnImpl;
    /** hook 进程环境(默认 process.env;测试注入隔离环境) */
    env?: Record<string, string | undefined>;
    /** exit→close 兜底宽限毫秒(K-1;缺省 EXIT_CLOSE_GRACE_MS,测试注入短值) */
    exitCloseGraceMs?: number;
}

interface HttpHookRunnerOptions {
    /**
     * 出网客户端(三层 SSRF × 代理复合,net/egress-dispatcher.ts)。缺省按
     * env(+ lookupImpl)就地构造;cli 五入口 / sdk / mcp-serve 装配层传进程级同一实例
     * (`new HookEngine({ http: { client } })`)。
     */
    client?: EgressClient;
    /**
     * fetch 注入缝(默认 client.fetch = undici.fetch——与 socket pin dispatcher 同版本,
     * 缘由见 dispatcher.ts 头注;注入方若发真实网络须认得 init.dispatcher)
     */
    fetchImpl?: typeof fetch;
    /**
     * 环境记录(默认 process.env):解析 header 的 `${VAR}` 引用;client 缺席时亦作
     * 代理三变量读取源
     */
    env?: Record<string, string | undefined>;
    /**
     * header 可引用的环境变量名 allowlist;undefined = 不限制(个人场景),
     * 配置后(含空数组)引用名单外变量按错误处理(企业 managed 层锁定用)。
     */
    allowedHeaderEnvVars?: readonly string[];
    /** 显式允许私网/环回端点(默认拒绝;企业内网 hook 端点场景) */
    allowPrivateUrls?: boolean;
    /**
     * 主机解析注入缝(解析后 IP 复核层 + socket pin 同一桩,与 Http 工具同一
     * guard;缺省真实 dns lookup)。测试注入假解析器保持零真实网络;client 在场时忽略。
     */
    lookupImpl?: HostAddressLookup;
}

/**
 * HookEngine:匹配 → 并行执行 → 按配置优先级稳定排序应用。
 *
 * 关键语义:
 * - 匹配:PreToolUse/PostToolUse 以 tool_name 为比较对象,
 *   SessionStart 以 source,其余事件 matcher 视为全匹配;编译结果按配置代
 *   缓存(MatcherCache 随引擎实例);
 * - 并行执行但**结果按配置优先级稳定排序应用**(修正 Claude Code
 *   按完成时间的竞态):executions/blocked 归因/additionalContexts/PreToolUse
 *   聚合全部按 LoadedHooks 的装配序(层优先级降序 → 层内配置序);
 * - 事件(protocol contract-v0.2 现有三形):hook.triggered 逐 hook 启动前
 *   按序签发;hook.completed / hook.blocked 在整批完成后按序签发——牺牲
 *   完成实时性换取事件流的确定性(与「稳定排序应用」同一取舍);
 * - fail-open:error/timeout 不构成阻断;只有 exit 2 或结构化响应
 *   decision=deny|block 计 blocked;
 * - PreToolUse 聚合:最严格者胜
 *   (deny > ask > allow),无意见时 undefined——hook 的 allow 只能表达
 *   「hooks 不反对」,是否越过询问由权限引擎的规则链定夺(hook allow 仍受
 *   deny/ask 规则限制);updatedInput 按配置优先级
 *   取首个提供者,冲突记 updatedInputConflict;
 * - 脱敏:redactSecrets 注入的全局秘密值(如 provider key)在 reason/detail/
 *   响应文本字段中统一遮蔽(http 执行体的 header 凭据已在 runner 内脱敏)。
 */

interface HookEngineOptions {
    /** 分层抽取产物(config.ts extractHooksSection) */
    hooks: LoadedHooks;
    /** 载荷 session_id */
    sessionId: string;
    /** command 执行体的工作目录与载荷 cwd(默认 process.cwd()) */
    cwd?: string;
    /** 载荷 transcript_path(会话 journal 路径;可缺省) */
    transcriptPath?: string;
    /** 载荷 permission_mode(权限引擎当前模式;可缺省) */
    permissionMode?: string;
    /** 默认超时(毫秒;缺省 60_000,条目 timeoutMs 覆盖) */
    defaultTimeoutMs?: number;
    /** hook.triggered/completed/blocked 事件出口(包络由调用方补;缺省丢弃) */
    emit?: (body: EventBody) => void;
    /** 全局脱敏值(如 provider key);所有 outcome 文本字段统一遮蔽 */
    redactSecrets?: readonly string[];
    /** command 执行体注入缝 */
    command?: CommandHookRunnerOptions;
    /** http 执行体注入缝 */
    http?: HttpHookRunnerOptions;
}
interface HookRunOptions {
    /** 外部取消信号(整批 hook 一起取消) */
    signal?: AbortSignal;
}
declare class HookEngine {
    #private;
    constructor(options: HookEngineOptions);
    /** 事件是否有已注册且命中的 hook(调用方可先探测再组装载荷) */
    hasHooks(event: HookEventName, matchValue?: string): boolean;
    /**
     * 触发一次事件:命中 hook 并行执行,结果按配置优先级稳定排序应用。
     * 引擎自身永不 throw 业务错误——一切失败降级为 execution.status(fail-open)。
     */
    run(input: HookEventInput, options?: HookRunOptions): Promise<HookRunResult>;
}

/**
 * Skills 子系统:公共类型与常量。
 *
 * 设计要点:
 * - Skills(SKILL.md 兼容,项目/用户/内置三源发现,按需注入);
 * - 发现顺序 内置 → 用户(~/.tansr)→ 项目(.tansr),同名覆盖
 *   「越近越强」;技能索引注入系统提示(名称+触发描述),正文按需加载;
 * - 模型只见名称/description/whenToUse 轻量索引,正文按需加载
 *   (上下文经济,Claude Code 已验证路线);
 * - 参照配置子系统:诊断为纯结构化数据(code + params),渲染由表面层
 *   按 code 映射 i18n 键;fs/env/homedir/platform 全注入缝,测试 hermetic。
 *
 * 容错铁律:坏 frontmatter 单技能降级跳过,不拖垮整体发现;
 * 诊断永不携带 frontmatter 字段「值」之外的文件正文内容(路径/目录名/键名
 * 与截断长度等元信息可携带——技能名与路径本就注入模型,不属密钥面)。
 */
/** 技能来源(优先级升序:builtin < user < project,越近越强) */
type SkillSourceName = 'builtin' | 'user' | 'project';
/** 已注册技能条目(轻量索引面;正文不驻留,按需经 SkillRegistry.loadBody 读取) */
interface SkillEntry {
    /** 规范名 = 目录名(builtin 为注入名);Skill 工具按此名调用 */
    name: string;
    /** 触发描述(必填;已截断至上限、剥控制字符) */
    description: string;
    /**
     * description 的多语言变体(frontmatter `description-<locale>`);
     * 键为规范化 BCP47 标签,值同 description 清洗/截断口径。消费端经
     * i18n pickLocalizedText 按「精确 → 主语言 → 无后缀缺省」回退链取值。
     * 无变体声明时字段缺席(向后兼容:旧文件产出逐字节不变)。
     */
    descriptionVariants?: Readonly<Record<string, string>>;
    /** 触发时机补充(frontmatter whenToUse / when-to-use;可缺席) */
    whenToUse?: string;
    /** 工具白名单声明(frontmatter allowed-tools / allowedTools;本期仅透出,P1 插件/子代理消费) */
    allowedTools?: readonly string[];
    /** 其余 frontmatter 标量/数组键(前向兼容透出;嵌套结构已剥离) */
    metadata: Readonly<Record<string, string | readonly string[]>>;
    source: SkillSourceName;
    /** 技能目录绝对路径(正文内相对引用的锚点;builtin 无) */
    dir?: string;
    /** SKILL.md 绝对路径(builtin 无) */
    file?: string;
    /** builtin 源的内联全文(含 frontmatter;file 场景无——正文按需读盘) */
    inlineContent?: string;
}
/** 文件系统注入缝:测试用内存假实现,不碰真实用户目录 */
interface SkillsFileSystem {
    /** 按 utf8 读文件;不存在时抛 { code: 'ENOENT' } 形态错误 */
    readFile(filePath: string): Promise<string>;
    /** 目录存在性探测(项目根 .tansr 上溯发现用) */
    directoryExists(dirPath: string): Promise<boolean>;
    /** 列举直接子目录名(不含文件);目录不存在时抛 { code: 'ENOENT' } */
    listSubdirectories(dirPath: string): Promise<string[]>;
}

type SkillBodyResult = {
    ok: true;
    entry: SkillEntry;
    /** 剥离 frontmatter 后的技能指引正文(已 trim;超预算截断) */
    body: string;
    truncated: boolean;
} | {
    ok: false;
    /** not_found=名称未注册;file_gone=发现后文件被删;read_error=读取失败 */
    reason: 'not_found' | 'file_gone' | 'read_error';
    entry?: SkillEntry;
    errno?: string;
};
interface SkillRegistryOptions {
    /** 文件系统注入缝(与发现期同一实现);默认包装 node:fs/promises */
    fs?: SkillsFileSystem;
    /** 正文单技能字节上限,默认 SKILL_BODY_MAX_BYTES */
    bodyMaxBytes?: number;
}
/**
 * 技能注册表:discoverSkills 产物的查询接口。
 * 名称解析:精确命中优先,其次大小写不敏感(模型转写容错)。
 */
declare class SkillRegistry {
    private readonly entries;
    private readonly byExactName;
    private readonly byLowerName;
    private readonly fs;
    private readonly bodyMaxBytes;
    constructor(skills: readonly SkillEntry[], options?: SkillRegistryOptions);
    /** 注册面(发现期已按名字典序稳定排序) */
    list(): readonly SkillEntry[];
    get(name: string): SkillEntry | undefined;
    /** 正文按需加载:执行期才读盘(builtin 从内联全文剥取) */
    loadBody(name: string): Promise<SkillBodyResult>;
    /** 技能目录绝对路径(正文相对引用锚点;builtin 无) */
    static baseDirOf(entry: SkillEntry): string | undefined;
}

/**
 * defineTool:开发者函数注册面(环1)。
 *
 * 「注册即说明书」:一次声明同时产出模型可见 schema 与
 * 人读文档;两档参数声明——
 * - `parameters`:JSON 参数表(低门槛档),SDK 内转 zod;
 * - `schema`:zod 直给(高级档);
 * 二选一,同给在定义点 fail-fast(编程错误不留到运行期)。
 *
 * 返回值归一(宽容归一):
 * - 字符串 → 原文直落 ToolResult 文本;
 * - 其余可序列化值 → JSON.stringify(undefined 归一 null);
 * - handler 抛错 → isError 结构化结果携 message(智能体可自纠,恒不炸查询环)。
 *
 * guide 长文:挂在返回对象的 `guide` 字段(kernel Tool 契约之外的 SDK 元
 * 数据位),装配层(toolset)聚合注入 system 的「Tool usage guide」段;
 * kernel 不读该字段,registry 注册直接可用。
 */

/** JSON 参数表的单参数声明(低门槛档;嵌套经 items/properties 递归) */
interface ToolParameterSpec {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    /** 模型可见的参数说明(进 JSON Schema description) */
    description?: string;
    /** true = 可缺省;缺省必填 */
    optional?: boolean;
    /** type='array' 的元素声明;缺省任意元素 */
    items?: ToolParameterSpec;
    /** type='object' 的属性表;缺省任意键值对象 */
    properties?: Record<string, ToolParameterSpec>;
}
/** defineTool 的声明形态(parameters 与 schema 二选一;都缺 = 无参数工具) */
interface DefineToolOptions<Args = Record<string, unknown>> {
    /** 工具名(进模型 prompt 与权限规则;非空、无空白) */
    name: string;
    /** 模型可见说明(何时调用、做什么;双受众同一份) */
    description: string;
    /** JSON 参数表档:key → 参数声明 */
    parameters?: Record<string, ToolParameterSpec>;
    /** zod 直给档(高级;与 parameters 互斥) */
    schema?: z.ZodType<Args>;
    /** 只读声明(true = 可并发、plan 模式放行);缺省 false(保守按写工具对待) */
    readOnly?: boolean;
    /**
     * 效应声明(应用协议 v1):`irreversible`(不可逆)/
     * `financial`(资金流动)/ `external`(触达外部系统或第三方)/ `affects-others`
     * (影响其他用户或租户)。信号不是闸门——只进裁决人语境与遥测,不改任何
     * 确定性判定;词表外值声明期 fail-fast。缺省未声明。
     */
    effects?: readonly ToolEffect[];
    /** 长文使用指南(装配期聚合注入 system 段;非模型 schema 面) */
    guide?: string;
    /** 业务实现:args 已过 schema 校验;返回任意可序列化值或字符串 */
    handler: (args: Args, ctx: ToolContext) => unknown | Promise<unknown>;
}
/**
 * defineTool 产物:kernel Tool 契约 + SDK 侧 guide 元数据。可直接放进
 * `tools.custom` 数组;kernel registry 注册时多余字段恒被忽略。
 */
interface DefinedTool<Args = unknown> extends Tool<Args> {
    /** 使用指南长文(S-B3 装配期聚合注入 system;缺席不注入) */
    guide?: string;
}
/**
 * 注册一个开发者函数为智能体工具。声明期校验(名称/参数档互斥)fail-fast
 * 同步抛 TansrSdkError;运行期 handler 抛错归一为 isError 结果(不炸会话)。
 */
declare function defineTool<Args = Record<string, unknown>>(options: DefineToolOptions<Args>): DefinedTool<Args>;

/** defineSkill 的声明形态(SDK 合成 SKILL.md frontmatter) */
interface DefineSkillOptions {
    /** 技能名(1-64,字母数字开头,余者字母数字/连字符/下划线) */
    name: string;
    /** 触发描述(进轻量索引;模型据此决定何时装载) */
    description: string;
    /** 触发时机补充(进索引行的 use when 段) */
    whenToUse?: string;
    /** 技能指引正文(= SKILL.md 正文;点名调用 Skill 工具时才进上下文) */
    instructions: string;
}
/** defineSkill 产物(kernel BuiltinSkillInput 同形:name + SKILL.md 全文) */
interface DefinedSkill {
    name: string;
    /** 合成的 SKILL.md 全文(frontmatter + 正文;与文件形态同格式同解析) */
    content: string;
}
/** skills 装配入口(CreateSessionOptions.skills) */
interface SdkSkillsOptions {
    /** 程序内注入(defineSkill 产物;内联零盘面) */
    custom?: readonly DefinedSkill[];
    /**
     * 目录装载:每项是技能容器目录(`<dir>/<name>/SKILL.md`)。相对路径按
     * 进程 cwd 解析(Electron 随包资产建议传绝对路径);目录不存在装配期
     * fail-fast。
     */
    dirs?: readonly string[];
    /** 文件系统注入缝(hermetic 测试用假件;缺省真实现) */
    fs?: SkillsFileSystem;
}
/**
 * 声明一个技能:合成 SKILL.md 全文(name/description/whenToUse 进
 * frontmatter,instructions 为正文)。声明期校验 fail-fast。
 */
declare function defineSkill(options: DefineSkillOptions): DefinedSkill;
/** skills 装配产物(assembleTooling 消费;进阶用法可直取) */
interface AssembledSkills {
    registry: SkillRegistry;
    /** Skill 工具(注册面非空才产出;空材料 = null,不装无意义工具) */
    tool: Tool | null;
    /** 轻量索引段(空注册面 = null,调用方跳过) */
    indexSegment: IRSystemSegment | null;
}
/**
 * skills 装配:custom(内联)+ dirs(目录)→ SkillRegistry + Skill 工具 +
 * 索引段。恒零发现(见文件头);dirs 目录不存在 fail-fast 携修复指引。
 */
declare function assembleSdkSkills(options: SdkSkillsOptions): Promise<AssembledSkills>;

/**
 * MCP 外接:开发者把业界现成 MCP 服务器资产挂给
 * 智能体;kernel 客户端全套现成(连接/懒加载管理/桥接/McpDiscover),
 * SDK 只补**连接生命周期持有者**(McpHost)。
 *
 * 双档持有(一份实现):
 * - 应用级:`createMcpHost({ servers })` → 跨会话复用连接(Electron 主
 *   进程常驻场景,stdio 子进程不反复拉起);`host.dispose()` 收口;
 * - 会话级(糖):`createSession({ mcp: { servers } })` = 内部临时 host,
 *   会话 close 时自动 dispose。
 *
 * 配置零发明:servers 条目直采 kernel McpServerConfig 判别联合(stdio:
 * command/args/env/cwd;http: url/headers;共用 enabled/load/toolAllowlist)
 * ——与 CLI 及业界 mcpServers 惯例同形。SDK 面是开发者显式配置,坏条目
 * fail-fast(区别于五层配置文件的容错剔除纪律——那是「坏文件不拖垮
 * 装配」,这里是编程错误应即时暴露)。
 *
 * 会话装配(attachSdkMcp;kernel 懒加载语义照单全收):
 * - manager 惰性 init(首个会话触发,单飞;连接/目录/桥接件池 host 级
 *   共享),会话工具面恒经 forToolset 子视图(P1-B 隔离纪律:展开只写
 *   本会话 registry/toolDefs);
 * - eager server(load:'eager')装配期全量展开进会话工具面;
 * - lazy server(缺省)目录段(<available-mcp-tools>)进 system +
 *   McpDiscover 元工具按需展开(load 键语义照 kernel);
 * - 桥接工具 `mcp__<server>__<tool>` 进既有 registry 天然过权限门
 *   (isReadOnly 恒 false 保守;SDK 无询问通道下执行需开发者显式
 *   permission.rules.allow 或 askUser 回调——第三方副作用不缺省放行,
 *   与 cli headless 同律);toolAllowlist 每服务器白名单 kernel 现成。
 *
 * 受 `tools.mcp` 能力位(裁剪判定在 assembly.ts;位关而材料在场 fail-fast)。
 */

/** createMcpHost 选项(servers 为主体;其余是超时/观测/测试注入缝) */
interface McpHostOptions {
    /**
     * 服务器表:名字 → kernel McpServerConfig(transport 判别联合)。名字
     * 进桥接工具名 `mcp__<name>__<tool>` 与权限规则面(禁 `__`)。
     */
    servers: Record<string, McpServerConfig>;
    /** 每服务器握手超时(毫秒);缺省 kernel 10s */
    connectTimeoutMs?: number;
    /** 连接级默认请求超时(tools/list 等;毫秒);缺省 kernel 60s */
    requestTimeoutMs?: number;
    /** 桥接工具每调用硬超时覆盖(毫秒;缺省调度器统一 120s) */
    toolTimeoutMs?: number;
    /** stdio close 后强杀前宽限(毫秒) */
    killGraceMs?: number;
    /** initialize 声明的客户端身份 */
    clientInfo?: McpPeerInfo;
    /** `${VAR}` 引用与 stdio 子进程环境的取值源;缺省 process.env */
    baseEnv?: Record<string, string | undefined>;
    /** http transport 的 fetch 注入缝(测试) */
    fetchImpl?: HttpFetchLike;
    /** 结构化观测缝(mcp.connected/connect_failed/discovered 等) */
    onEvent?: McpEventObserver;
    /** 连接工厂注入缝(hermetic 测试桩连接;缺省真 transport) */
    connectFactory?: McpConnectFactory;
}
/**
 * MCP 连接生命周期持有者。manager 惰性构造(首个会话装配触发,单飞);
 * dispose 幂等断开全部连接(等待在飞 init 收尾后 closeAll,不留半启动
 * 进程)。跨会话共享:连接/目录/桥接件池 host 级一份,会话工具面各自
 * 经 forToolset 子视图展开。
 */
declare class McpHost {
    #private;
    /** pending时仅描述能力层;dispose完成后才表示已等待此层。 */
    get cleanupEvidence(): readonly {
        resource: 'mcp';
        level: McpCloseEvidenceLevel;
    }[];
    constructor(options: McpHostOptions);
    /** 惰性 init 单飞(内部/进阶面;host 主视图绑哑工具面,会话恒经子视图) */
    manager(): Promise<McpLazyManager>;
    /**
     * 断开全部连接并终结 host(幂等;二次调用无害空操作)。init 在飞时
     * 等其收尾再断(不留半启动子进程/连接句柄)。
     */
    dispose(): Promise<void>;
}
/** 应用级 MCP host(跨会话复用连接;dispose 收口)。构造校验 fail-fast。 */
declare function createMcpHost(options: McpHostOptions): McpHost;
/** CreateSessionOptions.mcp 双形态:host 实例(应用级)或选项对象(会话级临时 host) */
type McpSessionOption = McpHost | McpHostOptions;
/** 会话装配产物(attachSdkMcpWithDiscover 返回形;attachSdkMcp 保持既有返回形) */
interface SdkMcpAttachment {
    /** 目录段(null = 无段;调用方 push 进 systemSegments) */
    segment: IRSystemSegment | null;
    /**
     * 子代理 McpDiscover 换装工厂(与 cli 同形):入参 = 子代理派生期生效集,产物 = 绑定
     * `manager.forToolset(生效集)` 子视图的 McpDiscover 实例(展开只写子代理自己的 registry/toolDefs,
     * 恒不写回父)。McpDiscover 已注册(懒目录非空)时在场;调用方接进 TaskToolConfig.mcpDiscover——
     * 缺席时 kernel task-tool 会把 McpDiscover 并入排除集静默摘除(子代理无 MCP 展开面)。
     */
    discoverToolFactory?: (toolset: McpToolset) => Tool;
}
/**
 * 会话装配(assembleTooling 消费):eager 全量展开进会话工具面;lazy
 * 目录段 + McpDiscover 注册(目录空则两者皆免——「目录可见才有展开
 * 承诺」,不装无意义元工具)。返回目录段 + 子代理换装工厂。
 */
declare function attachSdkMcpWithDiscover(host: McpHost, toolset: McpToolset): Promise<SdkMcpAttachment>;
/**
 * 既有出口(已发版签名不变):= `attachSdkMcpWithDiscover(...).segment`。自装配的进阶消费方若要让
 * Task 子代理保有 McpDiscover,改用 attachSdkMcpWithDiscover 并把 discoverToolFactory 接进 Task 配置。
 */
declare function attachSdkMcp(host: McpHost, toolset: McpToolset): Promise<IRSystemSegment | null>;

/** runAgent 缺省 maxTokens(与 TUI/serve 驱动对齐;单一事实源 kernel DEFAULT_OUTPUT_CAP_TOKENS,值 8192) */
declare const DEFAULT_MAX_TOKENS = 8192;
/**
 * `runAgent` 的选项(注入档):调用方自带 `client` / `model`,可选自带工具定义与执行器、系统提示、
 * 历史前缀;其余为查询环护栏(轮数 / 工具轮 / 连续错误)、压缩接线与采样参数直通。
 */
interface RunAgentOptions {
    /** 模型客户端(调用方自带;测试可传 scripted client) */
    client: ModelClient;
    /** 送 wire 的模型标识 */
    model: ResolvedModel;
    /** 单轮输入(追加在 initialMessages 之后作最后一条 user 消息) */
    prompt?: string;
    /** 历史前缀(多轮续跑/恢复);与 prompt 至少给一个非空 */
    initialMessages?: readonly IRMessage[];
    /** 系统提示;缺省空 */
    system?: IRSystemSegment[];
    /** 模型可见工具定义;缺省空 */
    tools?: IRToolDef[];
    /**
     * 工具执行缝;缺省 fail-safe 空执行器(任何工具调用产出结构化
     * unknown_tool 失败结果,查询环照常回填继续,不 throw)。
     */
    executor?: ToolExecutor;
    /** 缺省 8192 */
    maxTokens?: number;
    /** 缺省 randomUUID() */
    sessionId?: string;
    /** 外部中断信号(全链透传:模型流 / 工具执行 / 压缩均立即响应) */
    signal?: AbortSignal;
    /** modelTurns 上限(防失控;缺省不设) */
    maxTurns?: number;
    /** toolRounds 上限;缺省不设 */
    maxToolRounds?: number;
    /** 连续可恢复错误熔断上限;缺省 3(内核缺省) */
    maxConsecutiveErrors?: number;
    /** 模型上下文窗口 token 数(水位分母;缺省事件不落键) */
    contextWindowTokens?: number;
    /** 模型输出上限 capability.maxOutput(查询环事前钳制 maxTokens;缺省不钳) */
    maxOutputTokens?: number;
    /** 上下文压缩接线(提供即启用;kernel 压缩语义直通) */
    compaction?: QueryCompactionOptions;
    /** 采样参数直通 */
    temperature?: number;
    thinking?: {
        budget?: number;
    };
    stopSequences?: string[];
}
/** prompt/initialMessages 归一为查询环的 initialMessages(至少一条,fail-fast) */
declare function resolveInitialMessages(prompt: string | undefined, initialMessages: readonly IRMessage[] | undefined): IRMessage[];
/**
 * 启动一次查询环,返回内核句柄(事件流惰性执行,首次 next() 才开始)。
 * 选项非法以 TansrSdkError('invalid_options') 同步抛出。
 */
declare function runAgent(options: RunAgentOptions): QueryHandle;

/**
 * capability 合并器。
 *
 * 合并优先级(低 → 高):
 *   CapabilitySchema 字段默认值 < 内置默认表 (provider, model) 条目 < 用户配置 ProviderProfile.capability
 *
 * 合并语义:
 * - 标量与数组:显式出现(非 undefined)即整体覆盖(数组不做拼接);
 * - 嵌套对象(promptCaching/thinking/sampling/quirks):逐键合并,用户未提的键保留内置值;
 * - 合并结果必经 CapabilitySchema.parse 校验(非法值抛 ZodError,不静默吞掉)。
 *
 * 契约注记:protocol 冻结版的 ProviderProfileSchema.capability
 * 是完整 CapabilitySchema——经 schema parse 后默认值被填充,无法区分「用户显式写的默认值」
 * 与「schema 补的默认值」。本模块因此以 CapabilityOverride(深部分形态)为合并输入,
 * 上游应传入未经 parse 默认填充的原始覆盖对象;完整 Capability 对象在类型上兼容本形态。
 *
 * 扩展位(hostedTools/background):contract-v0.4 起并入
 * CapabilitySchema(可选、无默认值——缺省 undefined 即「未声明」,合并产物
 * 不多出键),早先的 providers 侧过渡扩展 schema 退役。
 *
 * contract-v0.5 别名归一(本模块单点,逐层进行——保证高层显式声明压过低层):
 * - vision ↔ inputModalities.image 双向同步(RFC-B3-1):层内声明了
 *   inputModalities.image 则 vision 派生(image==='supported');只声明 vision
 *   则回填 image(true→supported,false→rejected——布尔表达不了
 *   silently_dropped,取保守拒绝态);同层两者冲突时以 inputModalities 为准
 *   (新形态权威,vision 是待退役的派生别名)。
 * - temperatureRange 元组 → sampling.temperature 对象(RFC-B3-2):层内只声明
 *   元组时归一为 {min, max} 双闭对象(开端点标记/clampEpsilon 由 schema 默认
 *   补齐);已声明 temperature 对象则对象权威,元组仅作输入别名保留。
 * - temperature 对象在 sampling 段内按**整体值**覆盖(合法域是原子事实,
 *   不做跨层逐字段缝合——半个域没有意义)。
 */

/** 合并产物类型。v0.4 起扩展位已在契约内,保留别名以稳定既有引用面。 */
type ProviderCapability = Capability;
/** 温度合法域对象的深部分形态(schema 有默认值,声明时可只写部分字段) */
interface TemperatureDomainOverride {
    min?: number;
    max?: number;
    minExclusive?: boolean;
    maxExclusive?: boolean;
    clampEpsilon?: number;
}
/** sampling 段的深部分形态(temperature 为嵌套对象,需独立部分化) */
interface SamplingOverride {
    temperature?: TemperatureDomainOverride;
    temperatureRange?: [number, number];
    temperatureFixed?: number;
}
/** Capability 的深部分覆盖形态:所有字段可省略,嵌套对象亦为部分形态 */
interface CapabilityOverride {
    maxContext?: number;
    /** TMEM/2 CB-1:实测质量拐点窗口;undefined = 未实证(消费方沿标称) */
    effectiveContext?: number;
    /** contract-v0.15(RFC-CTX12-3):单次响应输出上限;undefined = 未知/未实证 */
    maxOutput?: number;
    /** RFC-M3 B2:思考模型标记(目录 reasoning 键直通);undefined = 未声明恒保守 */
    reasoning?: boolean;
    /** RFC-M3 B2:思考可关性(实证登记;undefined = 未实证恒保守不支持 fast 形态) */
    thinkingOptional?: boolean;
    vision?: boolean;
    /** contract-v0.5(RFC-B3-1):输入形态三态;undefined = 未声明(≠声明拒绝) */
    inputModalities?: Partial<Capability['inputModalities']>;
    toolChoice?: boolean;
    promptCaching?: Partial<Capability['promptCaching']>;
    thinking?: Partial<Capability['thinking']>;
    sampling?: SamplingOverride;
    modelModifiers?: string[];
    defaultContextWithoutModifier?: number;
    quirks?: Partial<Capability['quirks']>;
    /** 扩展位:hosted 工具单列(数组整体覆盖不拼接,与 modelModifiers 同语义) */
    hostedTools?: string[];
    /** 扩展位:背景模式能力 */
    background?: boolean;
}
/** imageInputMode 的返回三态(= protocol InputModalityMode,重导出以稳定消费面引用) */
type ImageInputMode = InputModalityMode;

/**
 * twp/1 线协议纯函数半边(契约源 = tansr-api
 * src/contract/twp.ts 的 TypeBox 定义,以其为单源对表)。
 *
 * 出站:IRRequest → { model, thread, tools, params, meta, cache?, stream }。
 * - thread = role + blocks 自有语法:system 段落逐段成 text 块;
 *   text→{t:'text',v} / tool_call→{t:'tool_use',id,name,input} /
 *   tool_result→{t:'tool_result',toolUseId,v,isError};
 * - 缓存语义(CW11-W1 缓存生命线,与直连 anthropic/mapping.ts 三件套 1:1
 *   同构):system text 块 `cacheable: true` 位 + 请求级 `cache.skipWrite`
 *   (IR skipCacheWrite)/`cache.key`(平台会话 id 亲和键);消息尾随轮
 *   断点的等价物在 api 侧 buildAnthropic 按方言补打(CLI 不感知上游方言)。
 *   发送门 = features 含 'prompt-cache'(contract.ts sendableTwpCacheHints
 *   单点);门关恒不落键,出线字节与既有恒同(旧服 strict schema 零 400);
 * - image(CW2-L10 K3,api M3 加法;CW4 P0-1 剥离径废除):sendImages 门开
 *   (features 含 image-input 且模型 inputModalities.image==='supported',
 *   单点 contract.ts sendableTwpImages)且属 **user 消息**时 →
 *   {t:'image',mime,v:base64}(api 校验:仅 user 径受理,assistant 携图
 *   400);门关或非 user 角色 **恒硬错**(throw TwpImageWireError,整次
 *   请求不发出不计费)——wire 层是最后防线不是降级点,旧「静默剥图照发
 *   文本」径已废除(doc/51 原则 5「降级恒显式」;显式拒绝的用户呈现半边
 *   在 TUI 发送谓词前门)。tool_result 内嵌图片项恒占位降级
 *   [image omitted: <mime>]——api TwpToolResultBlock.v 未扩,CW3 后
 *   敞口,见 doc/49 CW3 候排项②「tool_result 内嵌图片 twp 径恒占位(api
 *   契约扩展)」;占位实态由 CW3 M6 E2E(cli test/wire/twp-image-e2e)锁定;
 * - thinking/opaque 无 twp/1 v1 载荷位:出线丢弃(方言差异收敛在网关,
 *   服务端按各厂商 must_echo_back 语义回填;载荷位扩展属 twp/1 v2 双侧
 *   契约议题——CW3 后敞口,销账登记见 doc/report/CW3-M6 终报);
 * - meta.requestId:幂等键。传输幂等键在场(RetryingModelClient 注入)
 *   时跨 attempt 恒同号且 adapter 复用首次序列化字节(服务端指纹
 *   恒一致);缺席(裸适配器/SDK 直用)每次调用新 ULID;
 * - params 只落 IR 有值的键(maxTokens/temperature/stop),消毒在服务端。
 *
 * 入站:t.close.stop 枚举 → kernel 归一 stopReason;t.err/HTTP 错误码 →
 * IRErrorKind;t.usage → IRUsage;非流单 JSON → IRStreamEvent 序列。
 */

/** t.usage 计量帧(§4.4;cost/currency/balanceAfter 供状态栏成本/余额段旁路) */
interface TwpUsageFrame {
    inTokens: number;
    outTokens: number;
    cacheRTokens: number;
    cacheWTokens: number;
    cost?: string;
    currency?: string;
    balanceAfter?: string;
    /**
     * 长尾计量维度桶(CW8 B3 RFC,B4 服务端定稿):非零正整数才携带,含
     * `obs_` 前缀观测位(非计费);恒不含四主键 in/out/cache_r/cache_w
     * (服务端 schema 拒,入站再防御性剔除)。缺席 = 本笔无长尾维度。
     */
    dims?: Record<string, number>;
    /**
     * 缓存净省费(CW8 B3 RFC 裁决 16):DECIMAL 串,= readSaved −
     * writePremium,**可为负**;≠0 才携带。币种随帧内 currency(与 cost
     * 同帧原子,无关联歧义)。
     */
    saved?: string;
    /**
     * 批ζ(doc/79 P2-11 观测面)— 服务端估算结算标志(api P0-6a TwpUsage
     * 可选加法键;实报行恒缺席):true = 本笔计量为服务端保守估算(上游
     * 缺报/断链补账),金额已按估算实结。此前解析层静默丢弃,CLI 观测面
     * 把估算账当实报账呈现——如实计量优先于好看,透传不粉饰。
     */
    estimated?: true;
    /**
     * 估算成因(estimated 在场才随行;词表随 api ESTIMATED_REASONS 演进,
     * 原样透传不做端侧枚举收窄:upstream_usage_missing=上游整帧缺报全额
     * 估算,output_truncated=断链输出按已透传内容估算)。
     */
    estimatedReason?: string;
}
/** t.warn 提示帧(balance_low 沿状态栏余额预警既有位;其余码透传消费方) */
interface TwpWarnFrame {
    code: string;
    message: string;
}
/**
 * 平台错误帧旁路(t.err 与 HTTP ApiError 信封两径共缝;display-only,
 * 不改 IR 错误流)。requestId = 本次 exchange 的客户端请求号锚——信封
 * `error.detail.requestId`(幂等错误的客户端键回显)优先,缺席落
 * 适配器实发值;信封顶层 `error.requestId` 是服务端 trace id,刻意不用作锚。
 * detail = 信封 `error.detail` 原样透传(idempotency_conflict 按
 * `replayable`/`via` 区分「载荷不一致」与「已完成不可重放」两族语义)。
 */
interface TwpErrorFrame {
    code: string;
    message: string;
    requestId: string;
    detail?: Record<string, unknown>;
}

/**
 * 重试退避策略(纯函数,不含 IO/时钟/随机全局态)。
 *
 * 算法:
 * - 指数退避:上界 = min(maxMs, baseMs · 2^attempt);
 * - full jitter:延迟 = random() · 上界,均匀落在 [0, 上界](AWS 建议形态,
 *   把并发重试的「羊群效应」打散);
 * - Retry-After(SC-22 重试惊群修复,serve 并发审计 C-05):存在时取
 *   max(jitter 后退避值, retryAfterMs + rand(0, max(minMs, ratio × retryAfterMs)))
 *   ——服务端指令仍是权威下界(新形恒 ≥ retryAfterMs,不被 maxMs 截断:截断只
 *   会让下一次请求必然再吃一个 429),但**叠加**一段与 RA 成比例的随机延后
 *   (缺省 minMs 1 s / ratio 20%)。旧形 max(jittered, RA) 下 RA 恒胜、jitter
 *   失效:平台固定 60 s 限流窗触顶后全部会话在下一分钟整点同刻重发成锯齿;新形
 *   把重发时刻散布在 [RA, RA + max(1 s, 0.2·RA)]。**语义变化如实登记**(G9 附):
 *   等待均值上抬 max(0.5 s, 0.1·RA),不再整点对齐;`retryAfterJitter: false`
 *   可回到旧形。
 *
 * 随机源经 options.random 注入(默认 Math.random);注入 `() => 1` 可复现
 * 无 jitter 的纯指数退避(RA 在场时为 RA + 抖动上界),注入 `() => 0` 可复现
 * 下界 0(RA 在场时恰为 RA)。
 */
/** Retry-After 叠加抖动配置:抖动上界 = max(minMs, ratio × retryAfterMs) */
interface RetryAfterJitterConfig {
    minMs?: number;
    ratio?: number;
}
/**
 * 耐心档(R-2,doc/77 §五 R 组 2)— 连接类(connect/network)专项策略:
 * codex UnboundedConnectionRetries(5s→60s 翻倍等网络恢复)的有限墙钟
 * 改良——不占常规 maxAttempts 预算,但受 wallMs 墙钟熔断(拒绝无感挂死,
 * 超预算即抛面),且退避睡眠恒可被用户信号打断。
 */
interface PatientPolicyConfig {
    /** 首次退避(毫秒);缺省 5s */
    initialMs?: number;
    /** 退避封顶(毫秒);缺省 60s */
    capMs?: number;
    /** 墙钟预算(毫秒,自首个耐心档失败起计);缺省 180s */
    wallMs?: number;
}
/** RetryingModelClient 的策略配置(全部可选,缺省见 DEFAULT_RETRY_POLICY) */
interface RetryPolicyConfig {
    baseMs?: number;
    maxMs?: number;
    /** 最大尝试总数(含首次);1 = 从不重试 */
    maxAttempts?: number;
    /** 随机源注入缝(传给 nextDelayMs 的 full jitter) */
    random?: () => number;
    /** 耐心档覆写(connect/network 类;缺省 DEFAULT_PATIENT_POLICY) */
    patient?: PatientPolicyConfig;
    /**
     * SC-22:Retry-After 叠加抖动(缺省开启 minMs 1 s / ratio 0.2;false = 旧形
     * max(jittered, RA) 整点对齐)。两档共用。
     */
    retryAfterJitter?: RetryAfterJitterConfig | false;
    /**
     * SC-22:耐心档 equal jitter(延迟 = rand(0.5, 1.0) × 翻倍基值;缺省 true)。
     * 不早于基值一半(等墙场景不空转)、不晚于基值(墙钟语义与旧形同界);
     * false = 旧形确定性翻倍序列。
     */
    patientJitter?: boolean;
}

/**
 * SC-22 — per-origin 熔断器(circuit breaker):连续 N 终败开路 T 秒,半开放行 1 探测。
 *
 * 三态:
 * - closed:正常放行;记连续失败数,达 failureThreshold → open(记 openedAt);
 *   任一成功清零;
 * - open:请求快速失败(`upstream_breaker_open`,携 retryAfterMs = 开路剩余时长,
 *   零字节出网);开路满 openMs 后惰性转 half_open(下一次 tryAcquire 时判定,
 *   无定时器);
 * - half_open:恰放行 1 个探测请求,其余请求仍快速失败(retryAfterMs 取
 *   probeRetryAfterMs);探测成功 → closed(失败计数清零),失败 → 重新 open。
 *
 * 「终败」口径由调用方(governor.fetch)裁定后经 onSuccess/onFailure/onNeutral
 * 回报:响应头到达且状态 < 500 = 成功(4xx 是请求问题不是 origin 劣化,429 亦
 * 不计);状态 ≥ 500 或 fetch 抛非中止类错误 = 失败;调用方中止(AbortError)/
 * 在隔离舱等待期被拒 = 中性(不改计数,半开探测名额归还)。
 *
 * 缺省纪律:缺席 = 不建熔断器(governor 层缺省不设);建器后 failureThreshold
 * 缺省 5、openMs 缺省 30 s(建议值,候 G9 决策)。
 */

type BreakerState = 'closed' | 'open' | 'half_open';

/**
 * SC-22(serve 并发审计 S-16 / S-03 serve 半场)— UpstreamGovernor 拒绝的结构化错误。
 *
 * 治理层在 fetch 之前拒绝请求(隔离舱满/排队超时/熔断开路/已关闭)时,以本
 * 错误从 `governor.fetch` 抛出——**零字节出网**。四适配器的连接失败归一点
 * (twp/openai/openai-responses `#connectionFailure`、anthropic `fetchFailureToIR`)
 * 先经 `upstreamGovernorErrorToIR` 识别,得到结构化 IR 错误事件,再交重试层
 * 按既有分档路由;不识本错误的调用方(裸 fetch 直用)拿到的仍是带 `code` /
 * `origin` / `retryAfterMs` 字段的 Error。
 *
 * IR kind 词表冻结在 protocol(IRErrorKindSchema),无法新增 `upstream_saturated`
 * 专属值——按「最近似 kind」映射并登记(决策项):
 * - saturated / queue_timeout → `rate_limited`(本地节流;常规档 + full jitter,
 *   与服务端 429 同路由);
 * - breaker_open → `server`(上游被判劣化;携 retryAfterMs = 开路剩余时长,
 *   常规档按其为下界退避,半开探测窗口后重发);
 * - closed → `server` 且 recoverable=false(进程收口期,不再重试)。
 * 结构化码随 message 前缀(`upstream_<reason>: …`)透出,呈现层可据此区分。
 *
 * origin 标签纪律:恒为 `host[:port]`,恒不含路径/查询/凭据。
 */

/** 治理层拒绝原因词表(指标标签 reason 同源;有界) */
declare const UPSTREAM_REJECT_REASONS: readonly ["saturated", "queue_timeout", "breaker_open", "closed"];
type UpstreamRejectReason = (typeof UPSTREAM_REJECT_REASONS)[number];

/**
 * SC-22(S-16 重试放大)— 进程级重试预算:滑窗内重试数 ≤ 请求数 × 比例。
 *
 * 语义(Finagle RetryBudget 形态的滑窗简化):
 * - `noteRequest()`:每个逻辑请求(RetryingModelClient 每次 stream() 的首次
 *   attempt)入账一次;
 * - `tryAcquireRetry()`:重试决策点询问——窗内 `retries + 1 ≤ requests × ratio
 *   + minRetries` 则记账放行(true),否则拒绝(false,调用方按终败处理,不再
 *   重发);
 * - 滑窗按 `windowMs / BUCKETS` 分桶滚动,过期桶惰性剔除;零定时器。
 *
 * 缺省纪律:缺席 = 不建预算(governor 层缺省不设,重试层零漂移);建预算时
 * windowMs 缺省 10 s、ratio 缺省 10%、minRetries 缺省 0(严格按比例——低流量
 * 窗口内单请求 = 0 次重试配额,是否给 floor 候 G9 决策;Finagle 缺省
 * minRetriesPerSec=10 的取舍见终报)。
 *
 * 为何进程级:平台劣化时各会话独立重试即「N 会话 × maxAttempts」放大;预算
 * 以全进程口径限住重发总量,是隔离舱/熔断之外的第三道闸(熔断看连续失败、
 * 预算看重试占比,两者互补)。
 */

interface RetryBudgetStats {
    windowMs: number;
    ratio: number;
    minRetries: number;
    /** 窗内请求数 / 已放行重试数 */
    requests: number;
    retries: number;
    /** 累计(自建起):放行 / 拒绝 */
    allowedTotal: number;
    deniedTotal: number;
}
interface RetryBudget {
    noteRequest(): void;
    /** 重试放行判定(放行即记账) */
    tryAcquireRetry(): boolean;
    stats(): RetryBudgetStats;
}

/**
 * SC-22(serve 并发审计 S-16 / S-03 serve 半场;doc/111 §二 L6)— UpstreamGovernor:
 * 进程级上游治理层,落 providers(L1)共享层,五形态经 `buildModelClient` /
 * `ProviderRegistry` 的可选注入缝同受益。
 *
 * 组合件(per-origin,origin = `host[:port]`,恒不含路径/查询/凭据):
 *   令牌桶(token-bucket.ts)→ 熔断器(breaker.ts)→ 隔离舱(bulkhead.ts)→ 下层 fetch
 * 外加进程级重试预算(retry-budget.ts,经 RetryingModelClient 决策点消费)与
 * 重试抖动增量(retryPolicy,经 FallbackModelClient/RetryingModelClient 的
 * RetryPolicyConfig 消费)。
 *
 * `fetch` 包装顺序与理由:
 *   ① 熔断预检(同步,零等待):开路即快速失败——不消耗令牌、不占队列;
 *   ② 令牌桶 acquire(可能排队等待,尊重 init.signal);
 *   ③ 熔断 tryAcquire(等待期间可能刚开路;半开态在此取唯一探测名额);
 *   ④ 隔离舱 acquire(可能排队;被拒/中止时归还探测名额 onNeutral);
 *   ⑤ 下层 fetch(dispatcher 在场时附 init.dispatcher);响应头到达即回报熔断
 *      (≥ 500 失败、其余成功;抛错非中止类失败、中止类中性);
 *   ⑥ 响应体以跟踪流包装:体读完/出错/被取消 → 释放隔离舱名额(流式会话一条
 *      长连接占一个名额,直到流终结);null 体立即释放。
 * 排队期被 abort:立即出队并按调用方意图抛 AbortError(不计拒绝)。
 *
 * 缺省纪律(全部治理位缺省不设):bulkhead.maxConcurrent Infinity、breaker /
 * tokenBucket / retryBudget 缺席不建——`createUpstreamGovernor()` 空选项下 fetch
 * 透传零漂移(请求 input/init **原样**交给下层;仅响应体多一层跟踪流以计
 * inflight)。唯一缺省即开的行为 = 重试抖动(retry/policy.ts,与 governor 是否
 * 在场无关,如实登记 G9 附)。
 *
 * 观测:`stats()` per-origin + 全局汇总;`onEvent` 钩子(upstream.rejected /
 * breaker.opened / breaker.half_open / breaker.closed / retry.budget_denied,
 * 异常吞掉)。分层铁律:本件不 import kernel,指标由上层(serve observability
 * `governorStats` 缝)采集写 MetricsRegistry。`close()`:拒绝全部排队者、清定时
 * 器;在飞请求不中止(其释放为无害空操作)。
 */

type UpstreamRejectedCounts = Record<UpstreamRejectReason, number>;
interface UpstreamOriginStats {
    origin: string;
    /** 隔离舱在飞(响应体未终结的请求数) */
    inflight: number;
    /** 隔离舱等待队列长度 */
    queued: number;
    /** 令牌桶等待队列长度 */
    tokenQueued: number;
    /** 累计排队等待后取得令牌的次数 */
    tokenWaits: number;
    /** 熔断态('disabled' = 未建熔断器) */
    breakerState: BreakerState | 'disabled';
    /** 指标口径 0/1/2(disabled 亦 0) */
    breakerStateCode: number;
    breakerOpenedTotal: number;
    /** 累计交给下层 fetch 的请求数 */
    requests: number;
    /** 累计按熔断口径记为失败的请求数(≥ 500 / 非中止类抛错) */
    failures: number;
    rejected: UpstreamRejectedCounts;
}
interface UpstreamGovernorLimits {
    maxConcurrent: number;
    maxQueue: number;
    queueTimeoutMs: number;
    breaker: {
        failureThreshold: number;
        openMs: number;
    } | null;
    tokenBucket: {
        ratePerMinute: number;
        burst: number;
    } | null;
    retryBudget: {
        windowMs: number;
        ratio: number;
        minRetries: number;
    } | null;
}
interface UpstreamGovernorStats {
    closed: boolean;
    origins: UpstreamOriginStats[];
    totals: {
        inflight: number;
        queued: number;
        tokenQueued: number;
        tokenWaits: number;
        requests: number;
        failures: number;
        rejected: UpstreamRejectedCounts;
        /** 重试预算拒绝(按终败处理)的重试次数;预算缺席恒 0 */
        retriesBudgeted: number;
        /** 重试预算放行的重试次数;预算缺席恒 0 */
        retriesAllowed: number;
    };
    retryBudget?: RetryBudgetStats;
    limits: UpstreamGovernorLimits;
}
interface UpstreamGovernor {
    /** 治理后的 fetch(下层 = options.fetch ?? globalThis.fetch) */
    readonly fetch: typeof fetch;
    /** 以指定下层 fetch 另包一枚治理 fetch(共享同一份 per-origin 状态) */
    wrapFetch(inner: typeof fetch): typeof fetch;
    /** 进程级重试预算(缺席 = 未配置;RetryingModelClient 消费) */
    readonly retryBudget: RetryBudget | undefined;
    /** 重试策略增量(jitter 覆写;FallbackModelClient.retry 合并消费) */
    readonly retryPolicy: RetryPolicyConfig;
    stats(): UpstreamGovernorStats;
    close(): void;
    readonly closed: boolean;
}

/**
 * 别名/ref → (provider, model, capability, pricing) 解析(纯函数,不碰环境变量)。
 *
 * 解析顺序:
 * 1. 输入含斜杠 → 按 ref(provider/modelOrRole)直接解析;
 * 2. 否则按别名查 config.modelAliases(三档 main/fast/reasoning 或任意自定义键),
 *    其值再按 ref 解析;
 * 3. ref 的 modelOrRole 先查 ProviderProfile.models 角色别名,查不到按字面模型名。
 *
 * capability = 内置默认表 (provider, model) 条目 < 用户 profile.capability 深合并;
 * pricing = 用户 profile.pricing[modelName] > 内置默认表条目(用户优先)。
 */

/**
 * Registry 输入形态:与 TansrConfig 同构,但 capability 放宽为深部分覆盖
 * (CapabilityOverride)——经 TansrConfigSchema.parse 的完整配置结构上兼容本形态,
 * 未经 parse 的原始覆盖对象(能区分「用户显式写」与「schema 默认」)同样可用。
 * 契约缺口详见 capability-merge.ts 头注与任务报告 RFC 草案。
 */
interface RegistryProviderProfile extends Omit<ProviderProfile, 'capability'> {
    capability?: CapabilityOverride;
    /**
     * 逐模型能力覆盖(键 = 角色别名映射后的最终模型名):远程 bundle
     * 的 models[].capabilities 落点(profile 级 capability 表达不了同 provider
     * 下多模型差异)。合并序:内置默认 < profile.capability < 本表条目。
     * 可选字段,存量配置(kernel 五层产物/env 通路)零改动即兼容。
     */
    modelCapabilities?: Record<string, CapabilityOverride>;
}
/**
 * hooks / mcpServers 段(contract-v0.3/v0.4)与 registry 无关且形态多变
 * (kernel 抽取产物与契约段两形并存),一并 Omit——LoadedConfig 可直接充当
 * 本形态而不把这两段误带进 provider 解析面。
 */
interface RegistryConfig extends Omit<TansrConfig, 'providers' | 'hooks' | 'mcpServers'> {
    providers: Record<string, RegistryProviderProfile>;
}
/** resolveAlias / fallbacksFor 的输出单元(重试/切换的输入) */
interface ResolvedProviderModel {
    providerId: string;
    providerProfile: RegistryProviderProfile;
    /** 经 profile.models 角色别名映射后的最终模型名(送 wire 的值) */
    modelName: string;
    /** 内置默认 < 用户配置 合并并经 schema 校验后的能力位(含 hostedTools/background 扩展位) */
    capability: ProviderCapability;
    /**
     * P-CTX2 K8(G-A6,C-06)— 三层(内置默认 < profile.capability <
     * modelCapabilities)中**显式声明**的 maxContext。undefined = 全部缺席,
     * 此时 capability.maxContext 为 FALLBACK_MAX_CONTEXT 工程兜底、不代表
     * 能力事实——「能力未知不放行」守卫(压缩降档)消费本值而非合并产物。
     */
    declaredMaxContext?: number;
    /** 用户 profile.pricing 优先,其次内置默认表;两处都没有则缺省 */
    pricing?: Pricing;
}

/**
 * ModelClient 工厂:按 profile.protocol 分派 Anthropic/OpenAI 适配器。
 *
 * 密钥来源:profile.auth.env 指定的环境变量(env 记录可注入,测试不碰真实环境)。
 * 安全铁律:缺 key 抛 MissingApiKeyError——错误对象携带 env 变量名,值绝不出现;
 * key 一经读出只进适配器请求头,不落日志、不进错误消息。
 *
 * 凭据每请求重解析:构造期只做 fail-fast 探测(缺 key 即抛,值即弃,
 * 用法错误照旧首字节前暴露);适配器收到的是**解析函数**而非密钥值——每次
 * stream()/listModels() 的请求构造点重新从 env 记录取值,换密钥零重启达下一次
 * 请求。twp 档 keyId 与 SK 同为解析函数,适配器在同一同步节拍取双头(半新半旧
 * 结构性不可能)。env 注入缝(测试假记录)语义保留:解析函数闭包持有的正是
 * 注入的记录对象,测试改记录键值即模拟密钥轮换。
 */

/**
 * twp 档专属构造选项:profile.auth.env 只承载 ApiKey 单值,ApiKeyId
 * 与计量/提示旁路回调经本缝注入(CLI 装配层 → ProviderRegistry → createClient)。
 * keyId 缺席时回退 env TANSR_KEY_ID(非交互逃生口与 login env 位同名)。
 */
interface TwpClientOptions {
    keyId?: string;
    /** meta.client 标识(CLI 注入 name/version) */
    client?: {
        name: string;
        version: string;
    };
    /**
     * meta.sessionId 动态供给(平台会话 id):每次 exchange 请求构造
     * 时点取值。装配层供给客户端铸造 ULID(构造期铸造,
     * 首笔恒在场;恒同值,404 回落径清除);返回 undefined =
     * 未接线(离线/逃生)如实缺席,服务端按认证头归账不受影响。
     */
    sessionId?: () => string | undefined;
    /** t.usage 计量帧旁路(cost/balanceAfter → 状态栏成本/余额段) */
    onUsage?: (frame: TwpUsageFrame) => void;
    /** t.warn 提示帧旁路(balance_low 沿状态栏余额预警既有位) */
    onWarn?: (warn: TwpWarnFrame) => void;
    /**
     * 平台错误帧旁路(t.err 与 HTTP ApiError 信封的错误码;display-only)
     * ——CLI 装配层归一 idempotency_conflict 等码的 i18n 呈现。
     */
    onPlatformError?: (frame: TwpErrorFrame) => void;
    /** 非流形态开关(stream:false 单 JSON;缺省流式) */
    stream?: boolean;
    /**
     * 交换前钩子——每次 exchange 发出前 await(CLI 装配注入
     * 「配置陈旧则重拉 /t1/config」;异常吞掉不阻交换,缺席零行为变化)。
     */
    beforeExchange?: () => void | Promise<void>;
    /**
     * SSE 帧间 idle 超时(毫秒;缺省 170s——与 api 上游
     * connect+TTFB 预算咬合,见 twp adapter DEFAULT_TWP_IDLE_TIMEOUT_MS
     * 推导)。CLI 装配层从 settings network.twpIdleTimeoutMs 注入;缺席 =
     * 适配器内建缺省。
     */
    idleTimeoutMs?: number;
    /**
     * 服务端能力串供给(心跳响应 features 缓存;
     * 请求时点取值)。仅语义能力三门消费(prompt-cache/
     * image-input/reasoning-off,单点 twp/contract.ts);meta.purpose 不再
     * 消费此面(值级门退役,词表成员单判恒发)。
     */
    features?: () => readonly string[] | undefined;
    /**
     * 图片输入三态供给覆写缝(测试/特殊装配用)。缺席时
     * 构造点按本次解析的模型 capability 直绑 imageInputMode——每个 client
     * 实例各绑各的模型,切模重建自动跟随;与 features 含 'image-input'
     * 构成双判发送门(单点 sendableTwpImages),任一不满足恒不发图。
     */
    imageInput?: () => ImageInputMode | undefined;
    /**
     * 自持面签名三头开关(缺省 true)。令牌档等
     * 装配以 fetch 包装剥除双头与签名三头时,可置 false 跳过每请求的 HMAC 与
     * 头物化(签名注定被剥,算了也白算);是否被剥除 providers 侧不可判定,
     * 由装配层(sdk/platform、serve 平台形)按其 fetch 包装形态决定。
     */
    signRequests?: boolean;
    /**
     * 整请求墙钟(含流;ms)构造级缺省。调用级 ModelCallOptions.totalTimeoutMs
     * (kernel queryTimeouts 透传)优先;两者皆缺席 = 不设总闸(现状零漂移)。
     * 网关形态建议 10 min 由装配层传。
     */
    totalTimeoutMs?: number;
}
interface CreateClientOptions {
    /** 环境变量记录注入缝(默认 process.env);测试传假记录,不读真实环境 */
    env?: Record<string, string | undefined>;
    /** fetch 注入缝,透传给适配器构造参数;单测以假 fetch 断言构造行为 */
    fetchImpl?: typeof fetch;
    /** 附加请求头,透传给适配器 */
    defaultHeaders?: Record<string, string>;
    /** twp 档专属选项(其余协议忽略) */
    twp?: TwpClientOptions;
    /**
     * SC-22:上游治理层(隔离舱/熔断/令牌桶;进程级一枚,五形态装配可选注入)。
     * 在场时 fetchImpl 链最外层包 `governor.wrapFetch(fetchImpl ?? globalThis.fetch)`
     * ——适配器 → governor(令牌桶/熔断/隔离舱)→ 既有 fetch 包装(鉴权续期/
     * 重签)→ 网络;排队等待发生在重签之前,签名时间戳恒新鲜。缺席零漂移。
     */
    governor?: UpstreamGovernor;
}

/**
 * ProviderRegistry:TansrConfig → 别名解析 / capability 协商 / 客户端工厂 / fallback 链。
 *
 * 注:对外接线统一在 packages/providers/src/index.ts 完成,本目录不自行挂接。
 */

interface ProviderRegistryOptions {
    /** 环境变量记录注入缝(默认 process.env),透传给 createClient */
    env?: Record<string, string | undefined>;
    /** fetch 注入缝,透传给适配器;单测断言构造行为、不发真实请求 */
    fetchImpl?: typeof fetch;
    /** twp 档专属选项(keyId/计量与提示旁路回调),透传给 createClient */
    twp?: CreateClientOptions['twp'];
    /** SC-22:上游治理层(进程级一枚),透传给 createClient 包在 fetch 链最外层;缺席零漂移 */
    governor?: CreateClientOptions['governor'];
}
declare class ProviderRegistry {
    #private;
    constructor(config: RegistryConfig, options?: ProviderRegistryOptions);
    /**
     * 别名(main/fast/reasoning 或自定义)或 ref(provider/model)→ 解析结果。
     * 别名未配置抛 UnknownAliasError;provider 不存在抛 UnknownProviderError。
     */
    resolveAlias(alias: 'main' | 'fast' | 'reasoning' | string): ResolvedProviderModel;
    /** 按 profile.protocol 构造 AnthropicAdapter / OpenAIChatAdapter;缺 key 抛 MissingApiKeyError */
    createClient(resolved: ResolvedProviderModel, options?: CreateClientOptions): ModelClient;
    /** SC-22:装配层读回注入的治理层(buildAliasClient 取 retryBudget/retryPolicy 增量) */
    get governor(): CreateClientOptions['governor'];
    /**
     * 别名的有序 fallback 链(链首为别名自身;循环引用抛 CyclicFallbackError)。
     * 只解析不重试——实际切换由 FallbackModelClient 执行。
     */
    fallbacksFor(alias: string): ResolvedProviderModel[];
}

/**
 * provider 数据边界(fail-closed)。
 *
 * 威胁模型:fallback 链在「未向下游放行内容」的失败(含 auth/invalid_request
 * 工厂失败)后前进到下一 entry——若私有端点(如内网 vLLM)后面配置了公有
 * provider,私有端点的认证/协议错误会把同一敏感请求原文送往公有 fallback。
 *
 * 强制语义(契约承载位 = contract-v0.13 的 Playbook 两字段):
 * - `providerAllowlist` 在场(非空)→ 恒强制:目标 providerId ∉ 集合即在
 *   **选择时刻**被拒(不构造 client、零字节出站),与数据等级无关;
 * - allowlist 缺席时按数据等级:`dataClassification` 缺席按 internal 兜底;
 *   public/internal 不设限(现状回归);**sensitive 触发
 *   fail-closed——fallback 恒不得越出链首(首选)provider**(同 provider 的
 *   模型降档仍可;跨 provider 一律拒)。裁决:sensitive+无 allowlist
 *   取「拒绝越出首选」而非「拒绝启动」——单 provider 的敏感 Playbook 留在
 *   自己声明的 provider 上没有边界风险,风险只在「离开」;不可验证目标的
 *   「拒绝启动」语义由编排面(orchestrator agent 步预检)承担。
 *
 * 本模块只做纯判定(工具只产出结构化数据铁律);拒绝的执行点在
 * FallbackModelClient(选择时刻)与 buildAliasClient(链首装配期 fail-fast)。
 */
type DataClassification = 'public' | 'internal' | 'sensitive';
/** 边界拒绝的结构化归因(审计消费位:原因/目标/数据等级) */
interface ProviderBoundaryDenial {
    /** 被拒目标 providerId */
    providerId: string;
    /** 判定时生效的数据等级(缺席已按 internal 兜底) */
    dataClassification: DataClassification;
    /**
     * provider-not-allowlisted:显式 allowlist 之外;
     * sensitive-cross-provider:sensitive 无 allowlist,越出首选 provider。
     */
    reason: 'provider-not-allowlisted' | 'sensitive-cross-provider';
    /** 判定时的许可集(allowlist 原文,或 sensitive 锚定的首选 provider 单集) */
    allowedProviders: readonly string[];
}

/**
 * 单次尝试的事件泵:透传上游 ModelClient 流,同时做三件事——
 *
 * 1. prelude 缓冲:message_start 不算「内容块」(铁律:重试只允许发生在
 *    未产出任何内容块之前)。把它缓冲到首个内容事件一起放行;尝试在未出内容时
 *    失败则直接丢弃——下游要么恰好见到一次 message_start,要么见到裸 [error] 流
 *    (与适配器 HTTP 级错误的产出形态一致,见 anthropic/adapter.ts)。
 * 2. 终局归类:一次尝试归为 success / aborted / error_pre_content /
 *    error_post_content 四种,error 事件本体原样保留,供上层重试判定或透传;
 *    error 事件是流的语义终点(protocol/client.ts),其后不再消费上游。
 * 3. idle watchdog(可选):对上游 next() 悬而未决的时长计时,超 idleMs 未见
 *    下一事件 → abort 本次尝试并归一为可恢复 network 错误。计的是 provider
 *    静默时长;下游消费慢不计入(计时不覆盖 yield 之后消费方的处理区间)。
 *
 * 本模块是 RetryingModelClient / FallbackModelClient 的共用内部机件,
 * 不经 retry/index.ts 对外导出。
 */

/** error 分支事件(与 anthropic/errors.ts 的同名类型同构,避免跨目录耦合本地重declare) */
type IRErrorEvent = Extract<IRStreamEvent, {
    t: 'error';
}>;

/**
 * FallbackModelClient:按 fallback 链(expandFallbacks 的输出)逐个
 * 尝试 provider 的 ModelClient 组合器。
 *
 * 切换语义:
 * - 按 entries 顺序尝试;某 entry 在「未向下游放行任何内容」时最终失败
 *   (不可恢复错误,或经重试包裹耗尽 maxAttempts)→ 前进到下一 entry;
 * - 一旦某 entry 已流出内容 → 提交(committed),之后不再切换(避免重复输出),
 *   其后的错误事件原样透传;
 * - 全链耗尽 → 产出最后一个 entry 的 error 事件;
 * - message_start 由事件泵缓冲:落选 entry 的 message_start 不会泄漏给下游,
 *   下游至多见到最终命中 entry 的一次 message_start。
 *
 * 命中通知:onProviderSelected 每次 stream() 至多回调一次,告知最终命中(或
 * 全链耗尽时最后出错)的 providerId/index——上层据 index>0 自行发
 * cost.provider.switched 事件,本包不发任何事件(工具只产出结构化数据铁律)。
 * 用户中断(options.signal)→ 静默结束且不回调(无 provider 被命中)。
 *
 * 注入缝:createClient 工厂(单测传假工厂,不构造真适配器、不发真网络);
 * 每 entry 的 client 惰性创建并缓存(未轮到的 entry 不要求密钥)。Q4-4 起
 * 缓存的适配器实例持凭据**解析函数**而非密钥值(registry/client.ts)——
 * 实例缓存不连带密钥值,密钥轮换后同一缓存实例的下一次请求即用新值。
 * 工厂 throw
 * (如 registry 的 MissingApiKeyError)归一为不可恢复 error 后照常前进——
 * fallback 链的弹性目标优先于 fail-fast;链上全部工厂都失败时该归一错误
 * 就是「最后一个 entry 的 error 事件」。client.stream() 自身的 throw 仍原样
 * 传播(编程性错误,protocol/client.ts 约定)。
 *
 * wrapRetry(默认 true):每个 entry 的 client 自动包 RetryingModelClient
 * (共享 retry/idleMs/sleep/timers 配置)——链级语义即「entry 内先重试,
 * 耗尽再切换」;传 false 则 createClient 的返回值按原样使用(调用方自行
 * 决定重试策略,此时本层不含 idle watchdog)。
 *
 * 跨调用语义(OPT-15 核对锁定):每次 stream() 恒从链首(index 0)开始
 * 尝试——上一次切换到 fallback 不产生粘滞游标,同一会话的下一用户轮仍
 * 先试主模型(与 Claude Code 的 fallback 语义一致);#clients 仅是实例
 * 缓存,不构成位置状态。有测试锁定(fallback.test.ts「跨轮非粘滞」)。
 *
 * 数据边界:options.boundary 在场时,每个 entry 在选择时刻
 * 过 evaluateProviderBoundary(boundary.ts)——越界目标不构造 client、零
 * 字节出站,以 boundaryDenial 结构化轨迹计入 failures;全链无在界 entry
 * 即以最后一条边界拒绝作为耗尽错误收束(不可恢复),绝不静默换供应商。
 */

/** 链上某 entry 的最终失败记录(重试耗尽后的最后一错,或工厂失败的归一错误) */
interface FallbackFailure {
    providerId: string;
    modelName: string;
    /** entries 内序号 */
    index: number;
    error: IRErrorEvent;
    /**
     * 该 entry 在选择时刻被数据边界拒绝(未构造 client、零字节出站)。
     * 缺席 = 常规失败(重试耗尽/工厂失败)。审计消费位:原因/目标/数据等级。
     */
    boundaryDenial?: ProviderBoundaryDenial;
}
/** 一次 stream() 的最终命中通报(至多一次;用户中断不通报) */
interface FallbackSelection {
    providerId: string;
    modelName: string;
    /** entries 内序号;>0 即相对链首发生过切换 */
    index: number;
    entry: ResolvedProviderModel;
    /**
     * served:该 entry 承接了本次响应(已出内容或干净完流;后续即使出错也不再切换);
     * exhausted:全链耗尽,产出的错误事件出自该(最后一个)entry。
     */
    outcome: 'served' | 'exhausted';
    /**
     * 之前(含 exhausted 时自身)各 entry 的失败轨迹,按链序排列——上层组装
     * cost.provider.switched 的 from/reason 所需信息全在此(served 且 index>0 时
     * failures 至少一条;index=0 时为空数组)。
     */
    failures: readonly FallbackFailure[];
    /**
     * boundary 选项在场时的生效数据等级(缺席声明已按 internal 兜底);
     * 未配置 boundary 时不落键。上层审计「fallback 原因/目标/数据等级」取数位。
     */
    dataClassification?: DataClassification;
}

/**
 * CheckpointStore:上下文快照的可注入存储接口 + 缺省本地文件实现。
 *
 * 定位与 SessionStore 同款:CheckpointStore 四方法是 SDK 快照
 * 存储的**唯一承诺面**;kernel 快照原语(writeCheckpoint/readCheckpoint/
 * listCheckpoints/deleteCheckpoint)只经 createFileCheckpointStore 内部消费,恒不经
 * SDK 出口导出。开发者自建 DB/对象存储实现四方法即可注入 createSession 的
 * `checkpoints.store`。
 *
 * 快照 = 某时刻完整 IR 历史的自包含只读拷贝(JSON 拷贝,非归档旧卷):
 * - 可列举(list 只读头部 meta,恒不携 messages)、可恢复(AgentSession.restore)、
 *   可删除;checkpointId 为 ULID(时间有序,list 升序即时间线);
 * - `put` 写前配对治理(断尾 tool_call 合成 isError 占位),读回即可直接作
 *   initialMessages;
 * - 文件实现恒 durable 写(temp + fsync + rename),半写文件恒不可见;
 * - 保留策略:缺省不限;`retention: { max?, maxAgeDays? }`(`max` 为
 *   `retention.max` 别名)——先按龄再按数、到顶按 checkpointId 升序淘汰最旧,**不分 trigger**
 *   (manual 与 pre_* 同律),**刚写入者恒保留**(`max:0` 留 1)。淘汰律单点 = kernel
 *   `planCheckpointRetention`:文件 / 同居形态由 kernel 在写后施行;自建 store 经
 *   `withCheckpointRetention` 包装以同一计划经 list + delete 施行(两包对同一 max 恒同一淘汰器)。
 *
 * 目录模型:根目录恒显式或由会话 store 派生,SDK 恒不隐式扫用户目录。
 * - `createFileCheckpointStore({ dir })`:<dir>/<sessionId>/<checkpointId>.json
 *   (+ 旁挂 .meta.json + attachments/<sha256>);独立生命周期,不随会话删除;
 * - 缺省同居(createSession 未给 checkpoints.store/dir 且 store 为
 *   createFileSessionStore 产物):<sessionDir>/checkpoints/<sessionId>/…——随
 *   store.delete(sessionId) 一并消失(file-store.ts 提供,见其 `checkpoints` 成员)。
 */

/** 快照触发源:manual(checkpoint())/ pre_compaction / pre_clear / pre_restore */
type CheckpointTrigger = ContextCheckpointTrigger;
/**
 * 快照头部(list/put 返回面;恒不含 messages):schemaVersion / checkpointId /
 * sessionId / createdAt / trigger / label? / cwd / model? / tokens? / compactionId? /
 * messageCount。
 */
type CheckpointMeta = ContextCheckpointMeta;
/** 快照对象(get 返回面):头部 + 完整 IR 历史(image 块已内联,可直接作 initialMessages) */
type Checkpoint = ContextCheckpoint;
/**
 * put 的输入:开发者/装配层提供身份与内容字段,机械字段(schemaVersion /
 * messageCount)由存储实现填充。AgentSession 内部铸 checkpointId(ULID)。
 */
type CheckpointInput = ContextCheckpointInput;
/**
 * 快照存储接口(自建实现注入 `createSession({ checkpoints: { store } })`)。实现纪律:
 * - `put` 须配对治理后落盘,返回的 meta.messageCount 为治理后消息数;
 * - `list` 恒不携 messages,按 checkpointId 升序(= 时间序)返回;不存在的会话返回 `[]`;
 * - `get` 不存在返回 null;存储损坏恒结构化 throw(恒不静默回残缺快照);
 * - `delete` 幂等(目标不存在不抛)。
 */
interface CheckpointStore {
    /** 写入快照(durable);返回头部 meta */
    put(cp: CheckpointInput): Promise<CheckpointMeta>;
    /** 读取快照(不存在 → null;损坏结构化 throw) */
    get(sessionId: string, checkpointId: string): Promise<Checkpoint | null>;
    /** 列举某会话全部快照的头部(恒无内容;checkpointId 升序) */
    list(sessionId: string): Promise<CheckpointMeta[]>;
    /** 删除快照(幂等) */
    delete(sessionId: string, checkpointId: string): Promise<void>;
}
/** `createFileCheckpointStore` 的选项:快照根目录 + 可选保留策略 */
interface CreateFileCheckpointStoreOptions {
    /** 快照根目录(显式传入,恒不隐式扫用户目录);布局 <dir>/<sessionId>/<checkpointId>.json */
    dir: string;
    /** 同会话快照数上限;到顶按时间序淘汰最旧,不分 trigger(缺省不限)。= `retention.max` 别名(同给时 retention 优先) */
    max?: number;
    /** 保留策略:`max` / `maxAgeDays` 并集,kernel 在写后施行;刚写入者恒保留 */
    retention?: CheckpointRetention;
}
/**
 * 缺省文件实现工厂(包 kernel K-1 原语):
 *   <dir>/<sessionId>/<checkpointId>.json         快照体
 *   <dir>/<sessionId>/<checkpointId>.meta.json    旁挂头部(list 只读此件)
 *   <dir>/<sessionId>/attachments/<sha256hex>     image 字节(内容寻址,快照自包含)
 * 独立目录 = 独立生命周期(不随会话删除);会话同居形态由 createFileSessionStore
 * 的 `checkpoints` 成员提供(同一实现、根目录按会话派生)。
 */
declare function createFileCheckpointStore(options: CreateFileCheckpointStoreOptions): CheckpointStore;

/**
 * SessionStore 可注入存储接口。
 *
 * 定位:SDK 会话存储的**唯一承诺面**(kernel journal 原语恒不经
 * SDK 出口导出,FileSessionStore 只作内部消费)。「存哪」被本接口抽象掉——
 * 本地文件(createFileSessionStore)、开发者自建 DB、平台托管(后续)
 * 三态同形,createSession 的 resume/store 双字段恒不随存储后端变化。
 *
 * 概念收敛:对外「会话」= AgentSession 逻辑会话,一个
 * sessionId 一段历史;存储内部的卷/纪元轮换是实现细节,list 面恒按逻辑
 * 会话呈现。
 */

/** 会话存储登记行(元数据半边;内容经 get 另取,list 恒不携内容) */
interface SessionRecordMeta {
    /** 逻辑会话 id(= AgentSession.sessionId;缺省 UUID 形制,可显式供给) */
    sessionId: string;
    /** ISO-8601 创建时间 */
    createdAt: string;
    /** ISO-8601 最近提交时间(list 排序锚) */
    updatedAt: string;
    /** 会话标题(缺省 = 首条用户输入截断;可显式供给) */
    title?: string;
    /**
     * 平台会话 id(ULID 26 位 Crockford):令牌档 createSession
     * per-AgentSession 铸造并经 twp meta.sessionId 出线,ULID↔内核 UUID 映射
     * 落在此键——平台侧会话行(归因/续租/亲和)与本地记录互认的桥。
     * resume 径**沿用**此键——缓存键/粘性/归因跨 resume 延续;旧记录无键时 resume 铸新并补录。
     */
    platformSessionId?: string;
    /** 开发者自留元数据域(SDK 恒不消费其内容) */
    meta?: Record<string, unknown>;
    /**
     * 会话**当前**工作目录(meta.json `cwd`):建档写入 createSession 的会话 cwd(server 份
     * AgentStoredSessionMeta.cwd 同笔),setCwd 切换后经 recordCwdChange 改写为新值;
     * resume 对账锚。旧记录亦有本键(值为当时进程 cwd)。
     */
    cwd?: string;
    /**
     * cwd 中途切换史(meta.json `cwdHistory`,原文 JSON 扩展键,platformSessionId 同法):
     * 按切换序追加,`cwdHistory[0].from` 即创建期 cwd。未切换过的会话无本键。
     */
    cwdHistory?: readonly SessionCwdChange[];
    /**
     * 本会话由哪个会话的哪份快照 fork 而来(store.fork 建档时记入
     * meta.json `forkedFrom`,kernel SessionMetaSchema 可选位;createFileSessionStore 读出)。
     * 直建 / resume / 五方法回落径 fork 出的会话缺席。列举面据此呈现血缘;SDK 恒不据此改行为。
     */
    forkedFrom?: {
        sessionId: string;
        checkpointId: string;
    };
}
/** 一次 cwd 切换记录(SessionStore.recordCwdChange 入参 / meta.cwdHistory 元素同形) */
interface SessionCwdChange {
    /** ISO-8601 切换时刻 */
    at: string;
    /** 切换前 cwd(绝对路径) */
    from: string;
    /** 切换后 cwd(绝对路径;切换后 meta.cwd 同值) */
    to: string;
}
/** create 登记参数(sessionId 缺省由 store 铸造 UUID) */
interface SessionStoreCreateInit {
    sessionId?: string;
    title?: string;
    /**
     * 平台会话 ULID(令牌档装配注入;重复登记时以新值对账更新——resume 恒沿用已存值,
     * 故在场值只会是同值或旧记录无键的首次补录)
     */
    platformSessionId?: string;
    meta?: Record<string, unknown>;
    /**
     * 会话工作目录(server 份 create init.cwd 同笔):首次建档写入 meta.cwd;缺席沿
     * process.cwd() 旧值;既有记录恒不改写(创建期事实,切换走 recordCwdChange)。
     */
    cwd?: string;
}
/** commit 附带信息(与 CreateSessionOptions.onHistoryCommit 的 meta 同形) */
interface SessionStoreCommitMeta {
    /**
     * true = 历史前缀被就地改写(session.compacted 压缩折叠 /
     * session.microcompacted 存根化),已存内容不再与之对齐——实现方不得按
     * 长度增量追加,须整卷轮换(demo persistence 先例)。
     */
    readonly rewritten: boolean;
    /**
     * 改写原因(compaction = 压缩折叠 / clear = 清空 / restore = 自快照
     * 恢复);缺席 = 非改写,或改写仅来自存根化。实现方只需消费 rewritten,本位为
     * 可解释性/审计用(如 cli 卷首 compact_boundary.trigger 同义)。
     */
    readonly reason?: 'compaction' | 'clear' | 'restore';
}
/** get 终值(meta + 完整历史;resume 径另过配对治理,见 session.ts) */
interface SessionRecord {
    meta: SessionRecordMeta;
    messages: IRMessage[];
}
/** store.fork 输入(AgentSession.fork / createSession({ fork }) 经此落新会话记录) */
interface SessionStoreForkInput {
    /** 源会话 id(= checkpoint.sessionId;源会话记录恒不改) */
    sourceSessionId: string;
    /** 作为新会话初始历史的快照(逻辑形,image 已内联;CheckpointStore.get 产物) */
    checkpoint: Checkpoint;
    /** 新会话 id;缺省由 store 铸造 UUID */
    newSessionId?: string;
    /** 新会话工作目录(记入 meta;缺省沿源会话 = AgentSession 当前 cwd) */
    cwd: string;
    /** 新会话标题(缺省与 create 同律:首条用户输入截断) */
    title?: string;
}
/**
 * 会话存储接口(五方法为承诺面,其余成员纯加法可选)。实现纪律:
 * - commit 的 rewritten=true 须整卷轮换(语义见 SessionStoreCommitMeta);
 * - 存储损坏恒结构化报错(throw),恒不静默返回残缺历史(改坏存储文件须报错不静默);
 * - list 恒不携消息内容(枚举是元数据面);
 * - create 幂等(同 sessionId 重复登记返回既有记录,platformSessionId
 *   以新值对账更新——resume 后的 AgentSession **沿用**记录已存
 *   平台 ULID,本对账写只在旧记录无键时补录新铸值)。
 */
interface SessionStore {
    /** 建会话(登记 meta;id 由 store 铸造或调用方供给;幂等) */
    create(init: SessionStoreCreateInit): Promise<SessionRecordMeta>;
    /** 取单会话(meta + 完整历史;不存在返回 null;损坏结构化 throw) */
    get(sessionId: string): Promise<SessionRecord | null>;
    /** 列会话(按 updatedAt 倒序;恒无内容) */
    list(filter?: {
        limit?: number;
    }): Promise<SessionRecordMeta[]>;
    /** 轮末提交(对接 onHistoryCommit;rewritten=true 须整卷轮换) */
    commit(sessionId: string, history: readonly IRMessage[], meta: SessionStoreCommitMeta): Promise<void>;
    /** 删除/归档(FileSessionStore = 目录删除;平台实现 = 归档语义) */
    delete(sessionId: string): Promise<void>;
    /**
     * 可选:历史分页读——消息索引口径(offset = IRMessage[]
     * 下标,limit = 至少返回的消息数),不暴露段/游标。实现纪律:
     * - 返回切片恒**配对完整**:start 向前对齐到 ≤ offset 的干净边界(结果 `offset`
     *   如实回填对齐后的起点),end 向后对齐到 ≥ offset+limit 的干净边界(limit 是
     *   下限,为凑齐工具轮可多返回);`total` 为该会话全量消息数;
     * - 会话不存在返回 null;存储损坏结构化 throw(与 get 同律);
     * - `limit: 0` 合法 = 只取 total(实现应避免为此全量装载);
     * - createFileSessionStore 以段清单跳读实现(readTail,只装尾部所需段);自建 store
     *   不实现即由 readHistoryPage() 回落 `get` 全量切片(五方法承诺不变,本成员纯加法)。
     * 与 server v2 store 同构双份(server 份多 endUserId 首参)。
     */
    getHistoryPage?(sessionId: string, page: {
        offset: number;
        limit: number;
    }): Promise<{
        messages: IRMessage[];
        total: number;
        offset: number;
        nextOffset: number;
    } | null>;
    /**
     * 可选(同居缺省):store 自带的、与会话同生命周期的快照存储。
     * createSession 在 `checkpoints.store` / `checkpoints.dir` 皆缺席时取之作为快照
     * 落点(createFileSessionStore 提供:<sessionDir>/checkpoints,随 delete 一并
     * 消失);自建 store 不提供即 = 快照未接线(相关方法结构化拒绝,恒不静默)。
     * 五方法承诺不变(本成员为纯加法)。
     */
    readonly checkpoints?: CheckpointStore;
    /**
     * 可选:登记一次 cwd 中途切换——实现须把 `meta.cwd` 改写为
     * `change.to` 并把 change 追加到 `meta.cwdHistory`(切换即刻、与历史提交无关;不改
     * updatedAt)。会话不存在结构化 throw(session_not_found)。createFileSessionStore 以
     * meta.json 原文读-改-写实现;自建 store 不实现即 = 切换不落盘(AgentSession.setCwd
     * 照常成功,仅无持久化记录——五方法承诺不变,本成员纯加法)。
     * 与 server v2 store 同构双份(server 份多 endUserId 首参)。
     */
    recordCwdChange?(sessionId: string, change: SessionCwdChange): Promise<void>;
    /**
     * 可选:自快照 fork 出新会话记录——源会话恒不改;新会话历史 =
     * 快照 messages(实现方须配对治理,kernel 原语内置);新会话不被打开(调用方随后 resume)。
     * createFileSessionStore 经 kernel forkSessionFromCheckpoint 落地(新卷首记录 kind='fork' +
     * meta.forkedFrom + 附件按 sha 复制);自建 store 不实现即由 AgentSession.fork 回落五方法
     * (create + commit 全量历史)——功能同在,只无血缘记录(五方法承诺不变,本成员纯加法)。
     */
    fork?(input: SessionStoreForkInput): Promise<{
        sessionId: string;
    }>;
    /**
     * 可选(server 份 `ServeAgentSessionStore.flush` 同笔):等待在飞提交 settle 与冷层上传
     * 队列排空(进程退出前调用可保证封存段已上传 / 冷清单已提交)。无冷层 = 等在飞 settle 后即 `true`;超时 / 中止
     * `false`(热层已耐久,只是冷层积压未清)。createFileSessionStore 提供；自建 store 不实现仅表示无全局 flush 能力，
     * 不表示其 commit 同步。AgentSession.drain 缺省只等本会话真实提交；flushStore:true 才调用借用 store 的全局
     * flush，调用可能同时等待其他会话。SDK 观察预算包住整个 Promise，不把观察者的取消传给共享 flush。
     */
    flush?(options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<boolean>;
    /**
     * 可选(server 份同笔):就绪探针——分层存储热盘触顶(`policy.hotRetention.maxBytes`,已提交
     * 段逐出后仍越帽)→ `{ ready:false, reason:'store_hot_full' }`,否则 `{ ready:true }`。宿主据此拒新建 / 摘流。
     * 缺席 = 恒就绪(本成员纯加法)。
     */
    readiness?(): {
        ready: boolean;
        reason?: string;
    };
}

/**
 * `AgentSession.drain()` 的选项:`timeoutMs` 观察预算(缺省 30 秒;Infinity = 不限)、`signal` 只取消
 * 观察者不取消共享工作、`flushStore` 是否顺带调用借用 store 的全局 flush、`retryPersistence` 是否
 * 重试此前失败的持久化提交。
 */
interface SessionDrainOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
    flushStore?: boolean;
    retryPersistence?: boolean;
}
/** 生命周期失败发生的阶段(查询环 / 空闲操作 / 存储提交 / 历史回调 / cwd 提交 / store flush / MCP 关闭 / 装配回滚) */
type SessionLifecyclePhase = 'query' | 'idle_operation' | 'store_commit' | 'history_callback' | 'cwd_commit' | 'store_flush' | 'mcp_close' | 'assembly_rollback';
/** 一条生命周期失败事实:操作序号、阶段、稳定码、原始错误与是否已被后续操作修复 */
interface SessionLifecycleFailure {
    operationId: number;
    phase: SessionLifecyclePhase;
    code: string;
    cause: unknown;
    recovered: boolean;
}
/**
 * `drain()` 的结果:终态(`completed` / `failed` / `timeout` / `cancelled`)、是否已关闭、各类在飞计数、
 * 失败清单(窗口滚动淘汰,`failureCount` 为总数、`omittedFailures` 为被淘汰条数)与清理证据。
 */
interface SessionDrainResult {
    status: 'completed' | 'failed' | 'timeout' | 'cancelled';
    closed: boolean;
    pending: {
        query: number;
        idleOperations: number;
        commits: number;
        cleanup: number;
        storeFlush: number;
    };
    failures: readonly SessionLifecycleFailure[];
    failureCount: number;
    omittedFailures: number;
    cleanupEvidence: readonly {
        resource: 'mcp';
        level: 'transport-completion' | 'connector-close-promise';
    }[];
}
/** 可等待清理完成的句柄(`SdkLifecycleError.cleanup` 携带;`drain()` 等待在飞释放并返回结果) */
interface SdkCleanupHandle {
    drain(options?: Pick<SessionDrainOptions, 'timeoutMs' | 'signal'>): Promise<SessionDrainResult>;
}
/** 诊断可滚动淘汰；各阶段未修复失败事实独立保留，不因窗口滚动消失。 */
declare class LifecycleLedger {
    #private;
    operation(): number;
    fail(operationId: number, phase: SessionLifecyclePhase, cause: unknown, code?: string): void;
    recover(phase: SessionLifecyclePhase, through?: number): void;
    get failed(): boolean;
    omitFailures(count: number): void;
    snapshot(): Pick<SessionDrainResult, 'failures' | 'failureCount' | 'omittedFailures'>;
}
/** 会话与单轮装配复用所有权、真实在飞操作及显式重试边界。 */
declare class OwnedResources implements SdkCleanupHandle {
    #private;
    readonly ledger: LifecycleLedger;
    add(release: () => Promise<void>, evidence?: () => SessionDrainResult['cleanupEvidence']): void;
    get pending(): number;
    get inFlight(): Promise<void> | undefined;
    get evidence(): SessionDrainResult['cleanupEvidence'];
    dispose(): Promise<void>;
    drain(options?: Pick<SessionDrainOptions, 'timeoutMs' | 'signal'>): Promise<SessionDrainResult>;
    rollback(cause: unknown): Promise<never>;
}

/** 平台业务段的组合策略；不表示模型指令或权限的强制优先级。 */
type SystemPromptPolicy = 'fallback' | 'prepend';
/** 本轮生效的业务提示词组合事实:采用的策略与 system 段来源(无 / 仅平台 / 仅 SDK / 平台+SDK) */
interface ApplicationPromptInfo {
    readonly policy: SystemPromptPolicy;
    readonly source: 'none' | 'platform' | 'sdk' | 'platform+sdk';
}
/**
 * SDK／serve 共用的业务提示词选择器。旧 bundle 缺策略时使用 fallback。
 * prepend 下显式 [] 也保留平台段；无平台正文时照用 SDK 段。
 * 只复制段，不自动裁决文本矛盾或按相似内容去重。
 */
declare function resolveApplicationSystem(platform: {
    systemPrompt?: string;
    systemPromptPolicy?: SystemPromptPolicy;
}, system?: readonly IRSystemSegment[]): {
    system: IRSystemSegment[];
    info: ApplicationPromptInfo;
};

/**
 * SDK 跨仓契约 v1(与平台 api 仓同构持份;双仓 schema 同笔改,单边改动即违约)。
 * 消费面:令牌档装配(令牌头 / bundle capabilities 段解析)、能力位裁剪、令牌换发服务的请求响应形态。
 * zod 定义与 api 仓逐字段一致。
 */
/** SDK 跨仓契约版本号(与平台 api 仓同构持份的版本锚) */
declare const APP_SDK_CONTRACT_VERSION = "v1";
/** app_user 令牌传输头(独立头,恒不与 Bearer PAT / AKSK 双头混用;入 logger 脱敏清单) */
declare const HEADER_APP_TOKEN = "x-tansr-app-token";
/** 终端用户标识 zod schema(END_USER_ID_RE) */
declare const EndUserIdSchema: z.ZodString;
/** POST /v1/app-tokens 请求体:终端用户标识 + 可选 TTL(秒,[60, 86400]) */
declare const AppTokenRequestSchema: z.ZodObject<{
    endUserId: z.ZodString;
    ttlSeconds: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    endUserId: string;
    ttlSeconds?: number | undefined;
}, {
    endUserId: string;
    ttlSeconds?: number | undefined;
}>;
/** POST /v1/app-tokens 请求体类型 */
type AppTokenRequest = z.infer<typeof AppTokenRequestSchema>;
/** POST /v1/app-tokens 响应体:令牌本体、过期时刻、appId 与回显的终端用户标识 */
declare const AppTokenResponseSchema: z.ZodObject<{
    token: z.ZodString;
    /** ISO-8601 */
    expiresAt: z.ZodString;
    /** = api_keys.public_id */
    appId: z.ZodString;
    endUserId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expiresAt: string;
    token: string;
    endUserId: string;
    appId: string;
}, {
    expiresAt: string;
    token: string;
    endUserId: string;
    appId: string;
}>;
/** POST /v1/app-tokens 响应体类型 */
type AppTokenResponse = z.infer<typeof AppTokenResponseSchema>;
/**
 * App 能力位段形态(控制台 capabilities 配置;null = 平台缺省档 DEFAULT_APP_CAPABILITIES)。
 * 模型面恒不入本 schema:沿用既有模型目录授权(单一事实源)。
 * 顶层 `.strip()`:段内加法键(如日后的 `quota` / `models` 面)剥除不炸。
 */
declare const AppCapabilitiesSchema: z.ZodObject<{
    tools: z.ZodObject<{
        read: z.ZodBoolean;
        write: z.ZodBoolean;
        edit: z.ZodBoolean;
        glob: z.ZodBoolean;
        grep: z.ZodBoolean;
        list: z.ZodBoolean;
        shell: z.ZodBoolean;
        /** 预留位:kernel 现无独立进程工具,SDK 侧恒随 shell 联动(shell=false ⇒ 本位无效) */
        process: z.ZodBoolean;
        webFetch: z.ZodBoolean;
        webSearch: z.ZodBoolean;
        http: z.ZodBoolean;
        todoWrite: z.ZodBoolean;
        askUser: z.ZodBoolean;
        /** 统管 Task/SpawnAgent/AgentFollowup/AgentReport 家族四工具 */
        agent: z.ZodBoolean;
        skills: z.ZodBoolean;
        mcp: z.ZodBoolean;
        /** 环1:defineTool 函数注册表总开关 */
        customTools: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        http: boolean;
        agent: boolean;
        glob: boolean;
        shell: boolean;
        grep: boolean;
        list: boolean;
        read: boolean;
        write: boolean;
        askUser: boolean;
        mcp: boolean;
        skills: boolean;
        edit: boolean;
        process: boolean;
        webFetch: boolean;
        webSearch: boolean;
        todoWrite: boolean;
        customTools: boolean;
    }, {
        http: boolean;
        agent: boolean;
        glob: boolean;
        shell: boolean;
        grep: boolean;
        list: boolean;
        read: boolean;
        write: boolean;
        askUser: boolean;
        mcp: boolean;
        skills: boolean;
        edit: boolean;
        process: boolean;
        webFetch: boolean;
        webSearch: boolean;
        todoWrite: boolean;
        customTools: boolean;
    }>;
    platform: z.ZodObject<{
        imageGen: z.ZodBoolean;
        videoGen: z.ZodBoolean;
        webSearch: z.ZodBoolean;
        speechToText: z.ZodDefault<z.ZodBoolean>;
        textToSpeech: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        webSearch: boolean;
        imageGen: boolean;
        videoGen: boolean;
        speechToText: boolean;
        textToSpeech: boolean;
    }, {
        webSearch: boolean;
        imageGen: boolean;
        videoGen: boolean;
        speechToText?: boolean | undefined;
        textToSpeech?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tools: {
        http: boolean;
        agent: boolean;
        glob: boolean;
        shell: boolean;
        grep: boolean;
        list: boolean;
        read: boolean;
        write: boolean;
        askUser: boolean;
        mcp: boolean;
        skills: boolean;
        edit: boolean;
        process: boolean;
        webFetch: boolean;
        webSearch: boolean;
        todoWrite: boolean;
        customTools: boolean;
    };
    platform: {
        webSearch: boolean;
        imageGen: boolean;
        videoGen: boolean;
        speechToText: boolean;
        textToSpeech: boolean;
    };
}, {
    tools: {
        http: boolean;
        agent: boolean;
        glob: boolean;
        shell: boolean;
        grep: boolean;
        list: boolean;
        read: boolean;
        write: boolean;
        askUser: boolean;
        mcp: boolean;
        skills: boolean;
        edit: boolean;
        process: boolean;
        webFetch: boolean;
        webSearch: boolean;
        todoWrite: boolean;
        customTools: boolean;
    };
    platform: {
        webSearch: boolean;
        imageGen: boolean;
        videoGen: boolean;
        speechToText?: boolean | undefined;
        textToSpeech?: boolean | undefined;
    };
}>;
/** App 能力位(`tools` 环2 工具位 + `platform` 环3 平台位;装配期「App 有没有」的事实源) */
type AppCapabilities = z.infer<typeof AppCapabilitiesSchema>;
/** 平台缺省档(保守值)。= 进程内拓扑(embedded)缺省档,见契约 2.4。 */
declare const DEFAULT_APP_CAPABILITIES: AppCapabilities;
/**
 * 客户端可选扩展声明头(只在 bundle 拉取与 heartbeat 出线;值 = CLIENT_FEATURES 逗号分隔的列表形,
 * RFC 9110 §5.6.1;平台侧按逗号切分、trim、小写比对,词表外词元忽略)。
 */
declare const HEADER_CLIENT_FEATURES = "x-tansr-client-features";
/**
 * 本 SDK 可理解的可选 bundle 扩展词表:
 * - `platform-audio`:`capabilities.platform.speechToText/textToSpeech` + `platformModels.speechToText/textToSpeech`。
 */
declare const CLIENT_FEATURES: readonly ["platform-audio"];
/** 客户端可选扩展词元(CLIENT_FEATURES 的元素类型) */
type ClientFeature = (typeof CLIENT_FEATURES)[number];
/** 环2 工具位键(`AppCapabilities.tools` 的键) */
type CapabilityToolKey = keyof AppCapabilities['tools'];
/** 环3 平台位键(`AppCapabilities.platform` 的键) */
type CapabilityPlatformKey = keyof AppCapabilities['platform'];
/** 工具位键闭集(17;自 schema shape 派生,恒不第二份手写) */
declare const CAPABILITY_TOOL_KEYS: readonly CapabilityToolKey[];
/** 平台位键闭集(5;含音频两位 speechToText/textToSpeech) */
declare const CAPABILITY_PLATFORM_KEYS: readonly CapabilityPlatformKey[];
/** SDK/serve 应用平台类型词表(客户端可选集 = 全集;装置键无词位) */
declare const APP_PLATFORMS: readonly ["desktop", "mobile", "server"];
/** 应用平台类型(desktop / mobile / server;语义见 AppPlatformSchema) */
type AppPlatform = (typeof APP_PLATFORMS)[number];
/**
 * 应用平台类型:desktop=桌面应用(Electron 等,@tansr/sdk 进程内,文件工具=终端用户的盘);
 * mobile=移动应用(Android/iOS,经开发者会话服务 /v2,环2 文件/命令/出网族固定关);
 * server=服务端应用(Node 后端,@tansr/sdk 进程内)。CLI 装置绑定键不在应用控制面,platform 恒 null。
 */
declare const AppPlatformSchema: z.ZodEnum<["desktop", "mobile", "server"]>;
/** 能力拓扑:embedded = harness 跑在 SDK 进程内;hosted = harness 跑在开发者会话服务(serve /v2) */
type CapabilityTopology = 'embedded' | 'hosted';
/** 平台类型 → 能力拓扑(desktop / server 进程内 embedded;mobile 经会话服务 hosted) */
declare const APP_PLATFORM_TOPOLOGY: Readonly<Record<AppPlatform, CapabilityTopology>>;
/** 一种能力拓扑的位面档:可勾选的工具位 / 平台位与行值缺席时的缺省档 */
interface CapabilityTopologyProfile {
    /** 适用工具位(可勾选、可为 true);表外位 = 固定关(写面拒真、读面归一 false) */
    readonly tools: readonly CapabilityToolKey[];
    /** 适用平台位 */
    readonly platform: readonly CapabilityPlatformKey[];
    /** 行值 NULL 时的缺省档 */
    readonly defaults: AppCapabilities;
}
/** 两种能力拓扑的位面档(embedded 全位可勾选;hosted 只开 todoWrite / askUser / customTools / webSearch 与平台位) */
declare const CAPABILITY_TOPOLOGIES: Readonly<Record<CapabilityTopology, CapabilityTopologyProfile>>;
/** 平台类型 → 拓扑;NULL(装置键/未指配)→ null */
declare function topologyOf(platform: AppPlatform | null): CapabilityTopology | null;
/**
 * 「一位恰对应一件内置工具」的能力位 → kernel 工具名(与 kernel 各工具 `name` 字面逐字同;
 * sdk 不 import kernel 工具模块取名,一致性由 sdk 契约锁测钉住)。不在表内的位不是单件工具:
 * customTools(clientTools 独立通路)、agent(Task 派生 + 子代理工具面)、skills / mcp(动态
 * 工具族)、process(Shell 进程控制子面)。
 */
declare const CAPABILITY_BIT_TOOL_NAMES: Readonly<{
    readonly tools: Readonly<Partial<Record<CapabilityToolKey, string>>>;
    readonly platform: Readonly<Partial<Record<CapabilityPlatformKey, string>>>;
}>;
/**
 * 某拓扑可勾选位对应的内置工具名全集(去重,序 = 拓扑表工具位序 → 平台位序;与 serve 平台
 * 内置形装配序 TodoWrite → AskUser → WebSearch → ImageGen → VideoGen → SpeechToText →
 * TextToSpeech 同序)。= 该拓扑下控制台**可能开出**的内置工具上界;非单件工具位不计入。
 */
declare function topologyToolUniverse(topology: CapabilityTopology): readonly string[];
/**
 * hosted 拓扑(移动应用经开发者会话服务 /v2)可勾选位全集对应的工具名 —— serve
 * `capabilitiesProfile:'mobile-default'` 档的**唯一**上界来源:
 * TodoWrite, AskUser, WebSearch, ImageGen, VideoGen, SpeechToText, TextToSpeech。
 * customTools 位经 clientTools 独立通路,不在此列。
 */
declare function hostedToolUniverse(): readonly string[];
/**
 * 行值 NULL 时的缺省档。platform NULL(装置键/存量未回填)→ 进程内缺省档 = 既有 DEFAULT_APP_CAPABILITIES:
 * bundle 对 CLI 键的 capabilities 段字节零漂移(应用配置不对 CLI 适配的机器化表达)。
 */
declare function defaultAppCapabilities(platform: AppPlatform | null): AppCapabilities;
/**
 * 零能力档:`defaultAppCapabilities(platform)` 且 `tools` 全 false——
 * `parseAppBundle` 对 capabilities 段**整段坏形**(位非 boolean / 段非对象)的回落值(真 fail-closed:owner 关掉
 * 的位恒不因坏形被打开;hosted 应用回落 hosted 档而非 embedded 档)。平台位随拓扑缺省档(今日皆 false)。
 * 段**缺席**不走此档(旧平台 / 装置键径不发段 = 进程内缺省档,零漂移)。
 */
declare function zeroAppCapabilities(platform: AppPlatform | null): AppCapabilities;
/** 写面校验:本平台固定关位却为 true 的位名(`tools.x` / `platform.x` 形);非空即 400。 */
declare function inapplicableTrueBits(caps: AppCapabilities, platform: AppPlatform): string[];
/**
 * 固定关位归一(读面防御 + 改型再归一):表外位强制 false,返回被强制关闭的位名(审计/确认门用)。
 * platform NULL → 不归一(无拓扑可依,原档原样)。
 */
declare function normalizeAppCapabilitiesForPlatform(caps: AppCapabilities, platform: AppPlatform | null): {
    value: AppCapabilities;
    forcedOff: string[];
};
/** 裁决人资质档词表(平台裁决人池档位同构) */
declare const ADJUDICATOR_TIERS: readonly ["low", "medium", "high"];
/** 裁决人资质档(low / medium / high;缺席 = none 只收紧不软化) */
type AdjudicatorTier = (typeof ADJUDICATOR_TIERS)[number];
/** 裁决人资质档 zod schema */
declare const AdjudicatorTierSchema: z.ZodEnum<["low", "medium", "high"]>;
/** 套餐档(test 测试期 / small 小规模 / medium 中规模 / large 较大规模);个人档 = 无套餐行 */
declare const PLAN_TIERS: readonly ["test", "small", "medium", "large"];
/** 套餐档位(PLAN_TIERS 的元素类型) */
type PlanTier = (typeof PLAN_TIERS)[number];
/** 套餐档位 zod schema */
declare const PlanTierSchema: z.ZodEnum<["test", "small", "medium", "large"]>;
/** 档位上限快照(api billing/plan-tiers.ts PlanCaps 同形;授档时快照,读时恒读快照) */
declare const PlanCapsSchema: z.ZodObject<{
    /** 并发会话上限(软帽;硬帽 = floor(×1.1)) */
    concurrency: z.ZodNumber;
    /** 应用数上限(active app-scope 键) */
    apps: z.ZodNumber;
    /** 组织成员上限(仅 org owner 生效) */
    orgMembers: z.ZodNumber;
    /** 月度不同终端用户帽(仅 test = 100;null = 不限) */
    monthlyEndUsers: z.ZodNullable<z.ZodNumber>;
    /** 可登记出口 IP 进网关档 */
    gatewayLane: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    concurrency: number;
    apps: number;
    orgMembers: number;
    monthlyEndUsers: number | null;
    gatewayLane: boolean;
}, {
    concurrency: number;
    apps: number;
    orgMembers: number;
    monthlyEndUsers: number | null;
    gatewayLane: boolean;
}>;
/** 档位上限快照类型 */
type PlanCaps = z.infer<typeof PlanCapsSchema>;
/** active 生效 / grace 到期宽限(14 天窗内放行)/ lapsed 出窗回落 test 上限(tier 即 test,原档见 lapsedFrom) */
declare const PLAN_STATUSES: readonly ["active", "grace", "lapsed"];
/** 套餐状态(PLAN_STATUSES 的元素类型) */
type PlanStatus = (typeof PLAN_STATUSES)[number];
/** 套餐状态 zod schema */
declare const PlanStatusSchema: z.ZodEnum<["active", "grace", "lapsed"]>;
/** bundle 顶层 `plan` 段形态:档位、上限快照、状态、到期时刻与回落前原档(不 `.strict()`,未知键剥除) */
declare const AppBundlePlanSchema: z.ZodObject<{
    tier: z.ZodEnum<["test", "small", "medium", "large"]>;
    caps: z.ZodObject<{
        /** 并发会话上限(软帽;硬帽 = floor(×1.1)) */
        concurrency: z.ZodNumber;
        /** 应用数上限(active app-scope 键) */
        apps: z.ZodNumber;
        /** 组织成员上限(仅 org owner 生效) */
        orgMembers: z.ZodNumber;
        /** 月度不同终端用户帽(仅 test = 100;null = 不限) */
        monthlyEndUsers: z.ZodNullable<z.ZodNumber>;
        /** 可登记出口 IP 进网关档 */
        gatewayLane: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        concurrency: number;
        apps: number;
        orgMembers: number;
        monthlyEndUsers: number | null;
        gatewayLane: boolean;
    }, {
        concurrency: number;
        apps: number;
        orgMembers: number;
        monthlyEndUsers: number | null;
        gatewayLane: boolean;
    }>;
    status: z.ZodEnum<["active", "grace", "lapsed"]>;
    /** ISO-8601;grace/lapsed 时为已过去的到期时刻 */
    expiresAt: z.ZodString;
    lapsedFrom: z.ZodOptional<z.ZodEnum<["test", "small", "medium", "large"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "grace" | "lapsed";
    expiresAt: string;
    tier: "medium" | "small" | "large" | "test";
    caps: {
        concurrency: number;
        apps: number;
        orgMembers: number;
        monthlyEndUsers: number | null;
        gatewayLane: boolean;
    };
    lapsedFrom?: "medium" | "small" | "large" | "test" | undefined;
}, {
    status: "active" | "grace" | "lapsed";
    expiresAt: string;
    tier: "medium" | "small" | "large" | "test";
    caps: {
        concurrency: number;
        apps: number;
        orgMembers: number;
        monthlyEndUsers: number | null;
        gatewayLane: boolean;
    };
    lapsedFrom?: "medium" | "small" | "large" | "test" | undefined;
}>;
/** owner 生效套餐投影(bundle 顶层 `plan` 段;纯呈现位,硬执行恒在服务端) */
type AppBundlePlan = z.infer<typeof AppBundlePlanSchema>;
/**
 * 套餐错误码八枚(与平台错误码注册表同名)。
 * 状态码镜份供开发者面分支;`PlatformRequestError.platformCode` / twp 错误信封 `code` 对表外未知码
 * 恒原样透传,本表只是命名锚,恒不作白名单过滤。
 */
declare const PLAN_ERROR_CODES: readonly ["plan_required", "plan_tier_insufficient", "plan_concurrency_exceeded", "plan_end_users_exceeded", "plan_apps_exceeded", "plan_members_exceeded", "plan_gate_unavailable", "refund_not_eligible"];
/** 套餐错误码(PLAN_ERROR_CODES 的元素类型) */
type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];
/** 八码 → 平台 HTTP 状态(平台错误码注册表镜份) */
declare const PLAN_ERROR_HTTP_STATUS: Readonly<Record<PlanErrorCode, number>>;
/** 是否为套餐错误码(PLAN_ERROR_CODES 词表内) */
declare function isPlanErrorCode(code: string): code is PlanErrorCode;
/** 平台套餐错误 detail 里的升级链接(api `planUpgradeUrl` = 控制台套餐页);缺席 / 非串 = undefined */
declare function planUpgradeUrlOf(detail: Record<string, unknown> | undefined): string | undefined;
/**
 * 开发者面指引文案(英文,SDK 对外错误面同 errors.ts 纪律不走 i18n):按码给出「下一步做什么」——
 * 购买 / 升档类指向 `detail.upgradeUrl`(控制台套餐页),并发类说明只拒新会话并读 `retryAfterSec`,
 * 守门故障类按短暂重试。非套餐码返回 undefined(调用方沿用原文案)。
 */
declare function planErrorGuidance(code: string, detail?: Record<string, unknown>): string | undefined;

/**
 * bundle 模型计价段(每百万 token 的价格,DECIMAL 字符串,与平台 `/t1/config` 下发形一致)。
 * 宿主可据此喂本地价格簿做会话级预算闸门;服务端用量帧恒为计费权威,本地估算只作闸门 / 展示口径。
 */
interface AppBundleModelPricing {
    currency: string;
    inPerMillion: string;
    outPerMillion: string;
    cacheReadPerMillion: string;
    cacheWritePerMillion: string;
}
/** bundle 内单模型条目(SDK 消费子集) */
interface AppBundleModel {
    handle: string;
    /**
     * 上游模型标识(仅供展示;实际调用恒经平台通道,wire 上的 model 值 = handle)。
     * 令牌档下平台不下发本字段,故为可选:缺席 / 空串 / 非字符串一律按键缺席处理,条目本身保留。
     */
    modelId?: string;
    displayName: string;
    /**
     * 原始厂商(法人 / 品牌名,如 'Anthropic')。模型切换器「厂商 → 系列」两级分组呈现的一级维;
     * 旧 bundle 缺键或平台未校准时为 null(呈现面回落平铺,恒不猜测)。
     */
    manufacturer: string | null;
    /** 模型族(系列名);「厂商 → 系列」两级分组的二级维;平台未提供时为 null */
    family: string | null;
    /** 上游协议标识(仅供展示;方言转换收敛在网关,消费恒经平台通道) */
    protocol: string;
    capabilities: Record<string, unknown>;
    contextWindow: number | null;
    /** 计价段;缺键 / 坏形状 = null,恒不猜价 */
    pricing: AppBundleModelPricing | null;
}

/**
 * 授权媒体模型条目的公共字段:`model` = 规范 handle(可直接用作 `/t1/<face>` 的 model 位);`displayName`
 * 与 handle 异名时会附注到工具描述;`outputHosting` = 产出托管地(overseas / domestic / inline,缺席 = 未探知)。
 * 平台恒不下发价格 / 成本 / 供应商内部信息。等于 `MediaModelDescriptor` 去掉 constraints——四个媒体面
 * 按各自约束类型特化为下方四个别名;constraints 缺席 / 坏形状 = undefined,回落通用描述,恒不臆造。
 */
type AppBundleMediaModel = Omit<MediaModelDescriptor<unknown>, 'constraints'>;
/** 授权图像模型条目(bundle `platformModels.imageGen` 行形,含图像受理约束) */
type AppBundleImageModel = ImageModelDescriptor;
/** 授权视频模型条目(bundle `platformModels.videoGen` 行形,含视频受理约束) */
type AppBundleVideoModel = VideoModelDescriptor;
/** 授权语音识别模型条目(bundle `platformModels.speechToText` 行形,含音频受理约束) */
type AppBundleSpeechToTextModel = SpeechToTextModelDescriptor;
/** 授权语音合成模型条目(bundle `platformModels.textToSpeech` 行形,含合成受理约束) */
type AppBundleTextToSpeechModel = TextToSpeechModelDescriptor;
/**
 * 授权媒体模型集(bundle `platformModels` 段):顺序 = 平台下发的稳定序,**顺位第一即工具 / 网关未指定
 * model 时的生效模型**;空数组 = 平台未配置(如实呈现,恒不猜名)。语音识别与语音合成是两个独立面,
 * 键名用全词 `speechToText` / `textToSpeech`(wire 面对应 `/t1/asr`、`/t1/tts`)。
 */
interface AppBundlePlatformModels {
    imageGen: AppBundleImageModel[];
    videoGen: AppBundleVideoModel[];
    speechToText: AppBundleSpeechToTextModel[];
    textToSpeech: AppBundleTextToSpeechModel[];
}
/**
 * bundle 生效裁决人档(平台控制台为 App 任命的裁决人;取 bundle `adjudicators[0]`,缺席回落旧形单数键
 * `adjudicator`)。SDK 令牌档与 serve 据此装配权限分类器裁决人:
 * - `modelHandle`:绑定的裁决模型(bundle 目录内 handle);缺席 = 跟随会话主模型(裁决质量优先,
 *   且与主模型共享前缀缓存);
 * - `tier`:资质档(平台任命档位与组织天花板取交);缺席 / 词表外 = undefined → 装配按 'none'
 *   (只收紧不软化,恒不臆造资格);
 * - `callBudget`:每会话裁决咨询预算(组织治理 → 应用覆写);与宿主 `adjudication.callBudget` 取 **min**,
 *   宿主只能收紧;缺席 / 非正整数 = 不落键 → kernel 缺省 200;
 * - `budgets` / `escalation`:宽松记录(键集随平台演进)。分类器面消费其中 `budgets.maxUsd` / `maxCny`
 *   (按裁决模型同币价目折算为 callBudget 上界,恒不造汇率)与 `escalation.mode:'reject'`(姿态覆写为
 *   headless);其余键属派生裁决链语义;
 * - `locked`:企业策略包锁定位(纯呈现,未知取值容忍)。
 */
interface AppBundleAdjudicator {
    profileId: string;
    modelHandle?: string;
    budgets: Record<string, unknown>;
    escalation: Record<string, unknown>;
    locked?: true;
    tier?: AdjudicatorTier;
    callBudget?: number;
    /**
     * 该档评估证据的协议指纹(平台下发的 `evaluation.fingerprint`)。只用于漂移通报:与 SDK 编译内置的
     * 应用协议指纹不等时发 `adjudicator_evidence_drifted`,不改 tier(任命即授照,证据不是权力)。
     * 缺席 = 平台未下发,不通报。
     */
    evidenceFingerprint?: string;
}
/**
 * bundle 上下文方案段(平台 `contextScheme` 非 null 分支)。SDK 只做**形状级**解析透传(四键之外的
 * 加法键剥除不炸);真消费在 kernel `contextSchemeToSchemeOptions(bundle.contextScheme)`——参数域校验、
 * 键映射、坏形归因 `contextScheme_unparsed` 皆在 kernel,本模块恒不映射方案键。
 * - `schemeId` 必要非空;`stage` 词表外按 experimental 收敛(朝警示方向,安全);
 * - `scheme` 非对象 = 整段 null(平台必填对象;缺席 / 坏形恒不臆造方案);
 * - `locked`:仅字面 true 记锁定位(企业策略包锁定段标记,呈现位)。
 * 与 kernel `BundleContextScheme` 同形(`locked` 收窄为 `true` 字面)。
 */
interface AppBundleContextScheme {
    schemeId: string;
    stage: 'production' | 'experimental';
    scheme: Record<string, unknown>;
    locked?: true;
}
/**
 * bundle 组织治理段的 SDK 消费子集(`governance.sessionRetentionDays`;owner 径下发,组织配置了才发键)。
 * SDK 只做**形状级**透传:`sessionRetentionDays` 为正整数才落键,缺席 / 坏形 = 键缺席(恒不臆造保留期);
 * 真消费在 serve 平台会话工厂(会话保留期缺省 30 天,配置了即改读本值)。段内其余键
 * (org / licenseStatus / softLock / budgets)是 CLI 宿主语义,SDK 不读。
 */
interface AppBundleGovernance {
    /** 组织会话保留天数(整数 ≥ 1;上限 3650 由平台校验);缺席 = 平台未配 / 令牌径剥段 / 旧平台 → 消费方自持缺省 */
    sessionRetentionDays?: number;
}
/** 应用身份段 SDK 消费子集(应用协议 `<app>` 段的数据源;缺席字段为 null) */
interface AppBundleIdentity {
    name: string | null;
    /** 应用用途(控制台可选字段,bundle `app.purpose`) */
    purpose: string | null;
}
/** bundle-for-app 的 SDK 消费子集 */
interface AppBundle {
    /** 应用业务提示词；与 SDK system 的选择／拼接由 systemPromptPolicy 决定。 */
    systemPrompt?: string;
    systemPromptPolicy?: SystemPromptPolicy;
    models: AppBundleModel[];
    aliases: Record<string, string>;
    /**
     * App 能力位(平台控制台按 App 配置的工具位 / 平台位)。段缺席 = 进程内缺省档 DEFAULT_APP_CAPABILITIES
     * (旧平台 / 装置键径);整段坏形 = 零能力档 `zeroAppCapabilities(platform)`(真 fail-closed,此时
     * `capabilitiesIssues` 非 null)。
     */
    capabilities: AppCapabilities;
    /**
     * capabilities 段整段坏形时的 zod 问题清单(段在场却解析失败——位非 boolean / 段非对象);null = 段解析成功
     * 或段缺席。装配期(`assemblePlatformModel`)据此经 onWarn 通报 `capabilities_unparsed{ detail.issues }`
     * (随 bundle 缓存,每次装配都通报,每会话可见)。段内未知键被剥除**不算**坏形。
     */
    capabilitiesIssues: ZodIssue[] | null;
    /**
     * 授权媒体模型集(四键 imageGen / videoGen / speechToText / textToSpeech):工具描述与装配 system 段的
     * 自取数据源——集成方恒不手配模型名。旧 bundle 无段 / 无键 = 空集如实(缺席恒不臆造)。
     */
    platformModels: AppBundlePlatformModels;
    /**
     * 应用平台类型(bundle `app.platform`)。消费方据此判自身装配形态是否与拓扑相符(不符只提示不拒——
     * 能力位已按拓扑归一,安全由位保证)。缺席(旧平台 / 装置绑定键径恒缺键)或词表外 = null(未知,恒不臆造)。
     */
    platform: AppPlatform | null;
    /** 应用身份(应用协议 `<app>` 段)——name 现行键,purpose 可选键 */
    app: AppBundleIdentity;
    /**
     * 生效裁决人档(`adjudicators[0]` ?? `adjudicator`)。平台底档恒在(两级皆空回落平台内置缺省档),故正常
     * bundle 恒非 null;null = 段缺席 / 坏形状(旧平台)→ 令牌档无裁决人,权限行为维持现状(default 模式,
     * 无分类器路径)——朝严方向,无安全回退面。
     */
    adjudicator: AppBundleAdjudicator | null;
    /**
     * owner 生效套餐投影(bundle **顶层** `plan` 键)。null = 键缺席(个人无套餐 / 旧平台)或坏形状(任一字段
     * 类型 / 枚举不符即整段 null,恒不臆造档位)。纯呈现 / 开发者面语境位:并发 / 应用数等硬限制恒在服务端
     * 执行(429 / 400 信封),SDK 恒不据此本地判限。
     */
    plan: AppBundlePlan | null;
    /**
     * 上下文方案段(bundle 顶层 `contextScheme`,平台必填 nullable)。null = 平台未配 / 令牌径中性 null /
     * 旧平台 / 坏形。在场即透传宿主:serve 平台内置形以 kernel `contextSchemeToSchemeOptions` 化为压缩方案
     * 选项;SDK 自身恒不映射方案键。
     */
    contextScheme: AppBundleContextScheme | null;
    /**
     * 组织治理段 SDK 子集(bundle 顶层 `governance`,owner 径)。恒为对象:`sessionRetentionDays` 在场且为
     * 正整数才落键;段缺席(令牌径剥段 / 旧平台 / 组织未配)/ 坏形 = `{}`。透传宿主(serve 会话保留期),
     * SDK 自身零消费。
     */
    governance: AppBundleGovernance;
}
/** 平台 provider 档名(与 cli TANSR_PROVIDER_ID 同值;registry 键与别名前缀) */
declare const TANSR_PROVIDER_ID = "tansr";
/**
 * 令牌档 registry 的 ApiKey 占位环境变量(readApiKey 非空校验的哑值通道;
 * 真实鉴权头由 createAppTokenFetch 包装覆写,令牌恒不进 registry env)。
 */
declare const APP_TOKEN_PLACEHOLDER_ENV = "TANSR_SDK_APP_TOKEN_TIER";
/** 占位值(剥头包装失守时线上出现的也只是本哑值,不是令牌) */
declare const APP_TOKEN_PLACEHOLDER_VALUE = "app-token-tier";
/**
 * bundle 计价段 → kernel 价格簿注入行(可喂 `refreshPricing`,供本地成本估算 / 预算闸门)。
 * 币种走白名单(USD / CNY),其余币种如实跳过(不猜币种不误标);DECIMAL 串 → 数值,必要价 NaN 整条丢弃;
 * 缓存读价 > 0 才落 cachedInputPerMillion,缓存写价 > 0 才落 cacheWriteInputPerMillion。
 * 键 = (tansr, handle),与平台计量事件的 provider / model 同口径。
 */
declare function appBundlePricingUpdates(bundle: AppBundle): PricingUpdate[];
/**
 * bundle 载荷 → SDK 消费子集。顶层形状非法返回 null(调用方结构化报错);条目级损坏逐条跳过。
 * - capabilities 段:缺席 → 进程内缺省档;整段坏形 → 零能力档 + `capabilitiesIssues`(真 fail-closed);
 * - platformModels 段:缺席(旧平台)/ 坏形状 = 四空集如实(图像 / 视频 / 语音识别 / 语音合成)——媒体工具据此
 *   如实注明未配置,恒不猜模型名;**顺序恒保持下发序**(顺位第一即缺省);
 * - app.platform:缺席 / 词表外 = null;
 * - adjudicator:清单首个可解析档 ?? 单数键;皆无 = null(无裁决人,权限行为维持现状);
 * - plan(顶层):缺席(个人无套餐 / 旧平台)/ 坏形 = null,旧 bundle 零行为变化;
 * - contextScheme:形状级透传,缺席 / null / 坏形 = null,方案键不在此映射;
 * - governance.sessionRetentionDays:形状级透传,正整数才落键,段缺席 / 坏形 = `{}`。
 */
declare function parseAppBundle(raw: unknown): AppBundle | null;
/**
 * bundle → 令牌档 RegistryConfig:单一 tansr 档(twp/1,占位鉴权变量)+
 * 别名表(目录裸名自动别名最低层,显式 aliases 压过)。恒零本地配置 IO。
 */
declare function appBundleRegistryConfig(bundle: AppBundle, baseUrl: string): RegistryConfig;

/** 缺省 TTL(与平台 /t1/config 的 max-age=60 同值;响应 max-age 更短时取更短) */
declare const DEFAULT_BUNDLE_CACHE_TTL_MS = 60000;
/** `createBundleCache` 的选项:fetch 注入、TTL 上界与两类条目帽(全部可选) */
interface CreateBundleCacheOptions {
    /** 缺省 fetch(resolve 入参 fetchImpl 优先;皆缺席用全局 fetch) */
    fetchImpl?: typeof fetch;
    /**
     * TTL 上界 / 缺省 ms(缺省 60_000):有效 TTL = min(响应 max-age, ttlMs);响应无
     * max-age 用 ttlMs。0 = 每次都条件重拉(304 只花一次往返,仍免重解析)。
     */
    ttlMs?: number;
    /** bundle 条目帽(缺省 16;LRU) */
    maxEntries?: number;
    /** features 条目帽(缺省 100_000;LRU) */
    maxFeatureEntries?: number;
    now?: () => number;
}
/** bundle 投影的径别维——令牌径(app_user 投影)/ 主凭据径(owner 投影) */
type BundleCacheScope = 'app_user' | 'owner';
/** 缺省径别(sdk `fetchAppBundle` 恒携 x-tansr-app-token = 令牌径) */
declare const DEFAULT_BUNDLE_CACHE_SCOPE: BundleCacheScope;
/** `BundleCache.resolve` 的入参:平台地址与令牌,外加缓存键的 appId / 径别 / features 维与 heartbeat 会话 id */
interface BundleCacheResolveInput {
    baseUrl: string;
    token: string;
    fetchImpl?: typeof fetch;
    /** 缓存键的应用维;缺席退化 per-baseUrl 单条目(见文件头) */
    appId?: string;
    /** 首次触发 heartbeat 时随体携带(命中缓存时不出线) */
    sessionId?: string;
    /**
     * 缓存键的径别维(缺省 'app_user');宿主以主凭据径(自带 AK/SK 头的 fetchImpl)拉 owner 投影并与
     * 令牌径共享同一实例时传 'owner'——同 (baseUrl, appId) 两径各得各投影,恒不串档。
     */
    scope?: BundleCacheScope;
    /**
     * 本次拉取声明的客户端 features(出线头 x-tansr-client-features;缺省 CLIENT_FEATURES 常量)。键含其指纹:
     * 声明变 → 平台投影变 → 键变 → 重拉;bundle 与 heartbeat 同携同值(平台 bundleEtag 按头分档)。
     */
    clientFeatures?: readonly string[];
}
/** `BundleCache.resolve` 的产物:解析后的 bundle、可复用的 registry 配置、etag、TWP 能力串与归档信号 */
interface ResolvedBundle {
    bundle: AppBundle;
    /** 按 etag 复用的 registry 配置对象(ProviderRegistry 构造只存引用) */
    registryConfig: RegistryConfig;
    etag: string | undefined;
    /** TWP 能力串(heartbeat features;undefined = 门全关同现状) */
    features: readonly string[] | undefined;
    /**
     * 本次 resolve 触发的 heartbeat 收到 410 `session_archived` 且归档的正是本调用携带的
     * `sessionId`(或信封未指明 id)→ 回带该 id;命中缓存 / 去重合并 / 归档的是他人会话 = 缺席。
     * 消费方停该会话心跳、铸新 id、下轮 exchange 开新会话。
     */
    archivedSessionId?: string;
}
/** `BundleCache.stats()` 计数快照(bundle / features 两类条目的命中、重拉与失效计数) */
interface BundleCacheStats {
    entries: number;
    /** bundle 时效内命中 */
    hits: number;
    /** bundle 首拉(无条目) */
    misses: number;
    /** bundle 过期后条件重拉次数 */
    revalidations: number;
    /** 条件重拉得 304 续期次数 */
    notModified: number;
    /** 同键并发合并到在飞请求的次数(bundle + features) */
    inflightDedup: number;
    featureEntries: number;
    featureHits: number;
    featureMisses: number;
    /** heartbeat `bundleEtag` 与条目 etag 不同而触发的条目级失效次数 */
    etagInvalidations: number;
}
/** bundle 条目键(与 resolve 入参同形;appId 缺席 = per-baseUrl 退化条目;scope / clientFeatures 缺省同 resolve) */
interface BundleCacheKey {
    baseUrl: string;
    appId?: string;
    scope?: BundleCacheScope;
    clientFeatures?: readonly string[];
}
/** per-app bundle / features 缓存(由 `createBundleCache` 创建;可跨会话共享一个实例) */
interface BundleCache {
    /** 取 bundle(+ registryConfig)与 features;命中零上游往返 */
    resolve(input: BundleCacheResolveInput): Promise<ResolvedBundle>;
    /**
     * 无参:清空全部条目(bundle + features;下次 resolve 无条件重拉,既有 etag 一并丢弃)。
     * 带键:只把该 (baseUrl, appId, scope, featuresFingerprint) 的 bundle 条目标记过期——etag 保留,下次
     * resolve 走 If-None-Match 条件重拉(304 续期 / 200 换新);features 条目不动;键无条目 = 零动作。
     */
    invalidate(target?: BundleCacheKey): void;
    stats(): BundleCacheStats;
}
/**
 * features 声明指纹 = sha256(声明列表逗号串,与出线头 x-tansr-client-features 值同源) 前 8 hex。
 * 缺省 CLIENT_FEATURES 常量(同进程恒一,不裂条目);声明变即指纹变。
 */
declare function featuresFingerprintOf(clientFeatures?: readonly string[]): string;
/**
 * bundle 条目键(四维:base(已去尾斜杠)/ appId / scope / featuresFingerprint;与 resolveBundle 内部键同形)。
 * 导出供测试断言键形;消费方不应依赖串形。
 */
declare function bundleKey(base: string, appId: string | undefined, scope: BundleCacheScope, featuresFingerprint: string): string;
/**
 * ETag 值归一(比对用):去弱标记 `W/` 与两侧引号、去首尾空白。/t1/config 响应头是带引号的
 * `"<etag>"`,heartbeat `bundleEtag` 由 api 以同一计算函数给出(带不带引号属 api 序列化面),
 * 归一后比对两形皆稳。
 */
declare function normalizeEtagValue(value: string): string;
/**
 * 创建 per-app bundle / features 缓存(语义见文件头)。一个实例可被同进程内多个会话共享:
 * 同键并发 resolve 只出网一次,过期后带 If-None-Match 条件重拉,heartbeat 回带的 bundleEtag 触发条目级失效。
 */
declare function createBundleCache(options?: CreateBundleCacheOptions): BundleCache;

/**
 * 平台提示帧(TWP t.warn 同形):平台对非致命降级
 * 的结构化告知(思考不可用/余额预警等),恒不代表请求失败。
 */
interface PlatformWarning {
    code: string;
    message: string;
    /**
     * 结构化语境(可选):如 `capabilities_unparsed` 携 `{ issues: ZodIssue[] }`。平台 t.warn 帧不携本键;
     * `onPlatformWarning` 子集通道只交付 code / message,`onWarning`(SdkWarning.detail)全量交付。
     */
    detail?: Record<string, unknown>;
}
/** 令牌档装配选项(createSession/query 的 token 档字段投影) */
interface AssemblePlatformModelOptions {
    /** app_user 短期令牌(开发者服务端经 POST /v1/app-tokens 换发) */
    token: string;
    /** 平台 API 基址(如 https://api.example.com;/t1 前缀由装配追加) */
    baseUrl: string;
    /** 模型别名(bundle aliases/目录 handle);缺省 'main' */
    model?: string;
    /** fetch 注入缝(bundle 拉取与 twp 交换共用;测试桩网关) */
    fetchImpl?: typeof fetch;
    /** fallback 链最终命中通报(session 装配合成 cost.provider.switched) */
    onProviderSelected?: (selection: FallbackSelection) => void;
    /**
     * 平台 t.warn 提示帧旁路(thinking_unavailable_on_face / balance_low 等):平台的结构化告知经此到达
     * 开发者,不静默蒸发;经既有 registry twp 选项缝透传。
     */
    onWarn?: (warn: PlatformWarning) => void;
    /**
     * twp meta.sessionId 动态供给(平台会话 id,ULID 形制;经 ProviderRegistry twp 选项缝透传)。
     * createSession 令牌档 per-AgentSession 铸造一枚注入;缺席 = meta.sessionId 如实不携带
     * (归账兜底在认证头),query 单轮档现维持缺席。
     */
    sessionId?: () => string | undefined;
    /**
     * 归档会话心跳(410 `session_archived`)旁路:装配期心跳报告「本会话 id 已被平台归档」——消费方
     * (createSession)据此**停止对该 id 的心跳、不重试**,并铸新平台会话 id,下轮 exchange 以新 id 开新会话
     * (exchange 首见幂等登记)。入参 = 被归档的会话 id(平台信封 `detail.sessionId`;缺席回落本次心跳携带的 id;
     * 皆缺席 undefined)。缺席 = 410 与其它非 2xx 同为静默失败(features 门关),行为现状。
     */
    onSessionArchived?: (sessionId: string | undefined) => void;
    /**
     * bundle/features 进程级缓存(createBundleCache):在场时 bundle 与 features 经缓存取得
     * (TTL = 响应 max-age 与 ttlMs 取小;过期后 If-None-Match 条件重拉;同键并发只一次出网),
     * 命中即零上游往返;缺席 = 逐会话拉取(零漂移)。serve 平台内置形缺省接一枚;SDK 端侧多会话同 app 可自接。
     */
    bundleCache?: BundleCache;
    /**
     * 缓存键的应用维(令牌所属 app 的公开标识):同一进程对同一 baseUrl 混用多个 app 的令牌时必须传,
     * 否则缓存退化为 per-baseUrl 单条目(首个令牌拉到的 bundle 被后续会话复用)。app_user 令牌本体不暴露
     * appId,故无法自推。
     */
    appId?: string;
}
/** 令牌档装配产物:fallback 链 client、解析出的模型、bundle 装配的 registry 与 bundle 各段的 SDK 消费子集 */
interface AssembledPlatformModel {
    client: ModelClient;
    model: ResolvedModel;
    contextWindowTokens?: number;
    maxOutputTokens?: number;
    /** bundle 装配的 registry(setModel 别名热切换与 Task resolveModel 复用) */
    registry: ProviderRegistry;
    /** bundle capabilities 段(工具裁剪的事实源;缺席时为平台缺省档) */
    capabilities: AppCapabilities;
    /**
     * bundle 授权媒体模型集(初始化即取,媒体工具装配自取的数据源——集成方零手配)。旧平台无段 = 空集如实。
     */
    platformModels: AppBundlePlatformModels;
    /**
     * bundle 计价 → kernel 价格簿注入行((tansr, handle) 键,USD/CNY 白名单;appBundlePricingUpdates 语义)。
     * 消费方(serve 平台内置形)经 PricingBook.refreshPricing(rows, 'refreshed') 喂 CostTracker,
     * 会话级 budget 闸的金额维自此对 tansr 模型出数。无计价段 = 空数组。
     */
    pricingUpdates: PricingUpdate[];
    /**
     * 应用平台类型(bundle `app.platform`)。消费方据此判装配形态与能力拓扑是否相符(进程内 SDK 装配 vs
     * 会话服务 serve);不符只提示不拒。旧平台缺键 / 装置绑定键径 = null(未知,恒不臆造)。
     */
    platform: AppPlatform | null;
    /**
     * bundle 生效裁决人档(SDK 令牌档 / serve 装配分类器裁决人的任命来源)。null = 段缺席(旧平台)→
     * 无裁决人,行为现状。
     */
    adjudicator: AppBundleAdjudicator | null;
    /** 应用身份(应用协议 `<app>` 段:name / purpose;缺席字段 null) */
    app: AppBundleIdentity;
    systemPrompt?: string;
    systemPromptPolicy?: SystemPromptPolicy;
    /**
     * owner 生效套餐投影(bundle 顶层 `plan`)。null = 个人无套餐 / 旧平台 / 坏形。开发者面语境位
     * (宿主日志 / 排障);硬执行恒在服务端,SDK 恒不本地判限。
     */
    plan: AppBundlePlan | null;
    /**
     * bundle 上下文方案段(形状级透传)。宿主(serve 平台内置形)以 kernel
     * `contextSchemeToSchemeOptions(platform.contextScheme)` 化为压缩方案选项接 `compactionManagerOptions`;
     * null = 平台未配 / 令牌径中性 null / 旧平台 / 坏形 → 压缩沿入口缺省。SDK 恒不在此映射方案键
     * (单函数住 kernel)。
     */
    contextScheme: AppBundleContextScheme | null;
    /**
     * bundle 组织治理段 SDK 子集(形状级透传)。宿主(serve 平台会话工厂)读 `governance.sessionRetentionDays ?? 30`
     * 作会话保留期缺省(`sessions.retention.maxAgeDays`);`{}` = 平台未配 / 令牌径剥段 / 旧平台 / 坏形 →
     * 宿主自持缺省。SDK 自身零消费。
     */
    governance: AppBundleGovernance;
}
/**
 * SDK 通用告警:平台提示帧(`source:'platform'`,
 * PlatformWarning 同 code/message)与 SDK 自身的非致命提示(`source:'sdk'`:
 * `cwd_mismatch_on_restore` / `cwd_mismatch_on_resume` 等)统一形。恒不代表请求失败;
 * `detail` 为结构化语境(路径 / id 等),呈现策略归开发者。code 为自由串(端侧未知 code 兜底)。
 */
interface SdkWarning {
    source: 'platform' | 'sdk';
    code: string;
    message: string;
    detail?: Record<string, unknown>;
}
/**
 * 令牌头注入 fetch 包装:剥 AK/SK 双头与签名三头(值只是占位哑值,但
 * 恒不出线),注入 x-tansr-app-token。令牌只活在本闭包。
 */
declare function createAppTokenFetch(token: string, inner?: typeof fetch): typeof fetch;
/**
 * POST /t1/heartbeat 一次的解析结果。
 * features 与 bundleEtag 两键彼此独立解析:任一缺席/坏类型只让自己回 undefined。
 */
interface TwpHeartbeatResult {
    /** TWP 能力串;失败 / 缺席 / 非数组 = undefined(门全关同现状) */
    features: readonly string[] | undefined;
    /**
     * 平台此刻该 App `GET /t1/config` 的 ETag(与 /t1/config 响应头同一计算函数)。
     * 缺席(旧平台)/ 非字符串 / 空串 = undefined → 消费方不动。
     */
    bundleEtag: string | undefined;
    /**
     * HTTP 410 信封 `{ error: { code: 'session_archived', detail: { sessionId } } }` —— 平台已归档
     * 本次心跳携带的会话(`DELETE /t1/sessions/:id` / 租约过期)。`sessionId` = 信封 detail 值,缺席回落
     * 请求携带的 id。消费方:停该会话心跳、不重试、下轮 exchange 开新会话。非 410 / 非该码 = 缺席。
     */
    archived?: {
        sessionId: string | undefined;
    };
}
/**
 * SDK 令牌档 heartbeat:POST /t1/heartbeat(令牌头鉴权),响应 features 数组即 TWP 能力串
 * (决定思考档位等可选能力是否出线);同一响应的 `bundleEtag`(bundle 失效订阅锚)顺手解析。
 * HTTP 失败 / 网络错 / 非 JSON 恒静默回双 undefined(fail-open 到现状,恒不阻装配、恒不炸会话)。
 *
 * `x-tansr-client-features` 与 bundle 拉取同值出线——平台按该头计算 `bundleEtag`(分档形各异),
 * 漏头即恒指缺省档 etag,与本 SDK 缓存的声明档 etag 恒不等 → 每次心跳重拉。
 */
declare function fetchTwpHeartbeat(base: string, token: string, fetchImpl: typeof fetch, sessionId?: string, 
/** 声明的客户端 features(缺省 CLIENT_FEATURES;与 bundle 拉取同携同值——平台 bundleEtag 按头分档) */
clientFeatures?: readonly string[]): Promise<TwpHeartbeatResult>;
/**
 * features 能力串取得(既有出口;= `fetchTwpHeartbeat(...).features`,行为逐字节不变)。
 * 失败恒静默回 undefined = 门关(fail-open 到现状)。
 */
declare function fetchTwpFeatures(base: string, token: string, fetchImpl: typeof fetch, sessionId?: string): Promise<readonly string[] | undefined>;
/** GET /t1/config 的一次结果:bundle(304 时 null,仅条件请求径)+ 缓存元信息 */
interface FetchedAppBundle {
    /** 解析后的 bundle;304 Not Modified 时 null(调用方沿用既有条目) */
    bundle: AppBundle | null;
    status: number;
    /** 响应 ETag(原样,含引号/弱标记;下次条件请求原样回送) */
    etag: string | undefined;
    /** 响应 Cache-Control max-age(ms);缺席 undefined */
    maxAgeMs: number | undefined;
}
/** Cache-Control 头 → max-age(ms);no-store/no-cache/缺席/非法 → undefined(调用方用缺省) */
declare function parseCacheControlMaxAgeMs(header: string | null): number | undefined;
/**
 * 拉 bundle(GET {baseUrl}/t1/config,令牌头鉴权)并解析;失败一律
 * TansrSdkError('assembly_failed') 携修复指引。ifNoneMatch 在场即条件请求
 * (平台支持 ETag/304),304 返回 bundle=null 由缓存续期。既有逐会话拉取径
 * (assemblePlatformModel 无 bundleCache)与缓存径共用本函数——单一拉取实现。
 *
 * 恒携 `x-tansr-client-features`(缺省 `platform-audio`)——声明本 SDK 可理解的可选 bundle 扩展词表,
 * 平台据此分档下发(缺头 = 旧 SDK,只下发基础键)。声明值进 bundle 缓存键指纹,条件重拉同携
 * (平台侧 ETag 按实际下发形计算);serve 托管拓扑经同一函数自动继承。bundle 拉取与 heartbeat
 * 同携同值(平台侧 bundleEtag 按头分档计算,见 fetchTwpHeartbeat 注);exchange 不携(与 bundle 形无关)。
 */
declare function fetchAppBundle(base: string, token: string, fetchImpl: typeof fetch, ifNoneMatch?: string, 
/** 声明的客户端 features(缺省 CLIENT_FEATURES;缓存键指纹与本头同源) */
clientFeatures?: readonly string[]): Promise<FetchedAppBundle>;
/**
 * 令牌档一站式:拉 bundle(GET {baseUrl}/t1/config,令牌头鉴权)→ 解析
 * models/aliases/capabilities → registry 轻装配 → 别名 client。装配失败
 * 一律 TansrSdkError('assembly_failed') 携修复指引。
 *
 * SC-24(serve 并发审计 S-14/C-02/C-13):options.bundleCache 在场时 bundle +
 * features 经进程级缓存取得(TTL 取响应 max-age、过期后 If-None-Match 条件重拉、
 * 同键并发只一次出网),命中即零上游往返跳到组装;缺席 = 逐会话拉取现状(零漂移)。
 * registry 仍逐会话构造(fetch 包装/sessionId/onWarn 皆会话私有;构造本身只存引用,
 * 便宜),RegistryConfig 对象随缓存条目按 etag 复用。
 */
declare function assemblePlatformModel(options: AssemblePlatformModelOptions): Promise<AssembledPlatformModel>;

/**
 * 环2 内置工具词表:前 12 名与 AppCapabilities.tools 的工具位同名;媒体四名
 * 工具位 = AppCapabilities.platform 同名位。
 */
type BuiltinToolName = 'read' | 'write' | 'edit' | 'glob' | 'grep' | 'list' | 'shell' | 'webFetch' | 'webSearch' | 'http' | 'todoWrite' | 'askUser' | PlatformCapabilityName;
/**
 * 媒体四名(BuiltinToolName 子集;与 AppCapabilities.platform 同名——webSearch 位仍在能力契约
 * 但恒不在此词表)。兼作 `tools.platform` 兼容别名词表;speechToText / textToSpeech 为两独立面
 * (/t1/asr、/t1/tts)。
 */
type PlatformCapabilityName = 'imageGen' | 'videoGen' | 'speechToText' | 'textToSpeech';
/** 三环工具入口(CreateSessionOptions.tools / ManagedQueryOptions.tools) */
interface SdkToolsOptions {
    /**
     * 环2 内置工具选择(词表:read/write/edit/glob/grep/list/shell/webFetch/
     * webSearch/http/todoWrite/askUser + 媒体四名 imageGen/videoGen/speechToText/
     * textToSpeech)。缺席 = 装配能力位放行的全部本地内置工具(**媒体四名恒不在缺省
     * 全集**);空数组 = 零内置(纯自定义工具场景)。显式列出位关工具报可读错。
     * webSearch 双门:除工具位外还需令牌档材料 + platform.webSearch 位
     * (后端恒平台通道,SDK 恒不 BYO)——缺席选择时通道不备静默不装,显式选择
     * 即 fail-fast 分因可读错。媒体四名:工具位 = capabilities.platform.<name>,
     * 后端恒平台提供方——位关 / 令牌档材料缺席(托管/注入档)显式选择即 fail-fast 可读错。
     */
    builtin?: readonly string[];
    /**
     * @deprecated 兼容别名:词表 imageGen/videoGen/speechToText/textToSpeech
     * 与 tools.builtin 同名四值等价——等价并入 builtin 选择集(同名同描述同 schema 同序),
     * 校验与文案不变(位关恒 fail-fast;材料缺席 fail-fast 指引令牌档)。新写法请用
     * tools.builtin。webSearch 已并入 tools.builtin,此处显式列出报迁移指引。
     */
    platform?: readonly string[];
    /** 环1 自定义工具(defineTool 产物;kernel Tool 形态直给亦可) */
    custom?: readonly Tool[];
}
/**
 * 平台通道装配材料(令牌档专属):baseUrl/token 来自会话令牌档,令牌只穿透进
 * 提供方闭包(恒不进工具定义/toolDefs)。WebSearch 平台后端与媒体四工具平台提供方同一材料闸。
 * 托管/注入档无平台网关连接,恒缺席。
 */
interface PlatformToolContext {
    baseUrl: string;
    token: string;
    /** fetch 注入缝(测试桩网关;缺省全局 fetch) */
    fetchImpl?: typeof fetch;
    /**
     * bundle 授权媒体模型集(媒体池化顺位取用):令牌档装配自
     * assemblePlatformModel 随取随注——媒体四工具描述自列授权集(顺位第一 =
     * model 缺省生效模型),集成方零手配。缺席(注入档测试直构等)= 工具描述按
     * 未知集处理(仍可显式点名)。
     */
    platformModels?: AppBundlePlatformModels;
}
/** `buildSdkToolSet` 的输入:三环工具选择 + 能力位档 + 各内置工具所需材料(交互通道 / 平台材料 / 出网客户端 …) */
interface BuildSdkToolSetOptions {
    /** 三环工具入口;缺席 = 只装能力位放行的内置工具 */
    tools?: SdkToolsOptions;
    /** 能力位档;缺省 DEFAULT_APP_CAPABILITIES(令牌档由 bundle 供给) */
    capabilities?: AppCapabilities;
    /** AskUser 交互通道;缺省 UnavailableChannel(结构化降级,不挂起) */
    promptChannel?: PromptChannel;
    /** TodoWrite 台账;缺省自建(会话级内存态);onChange 由 session 装配注入 */
    store?: TodoStore;
    /** 平台通道材料(令牌档注入;缺席 = 显式选择媒体四名即 fail-fast 指引令牌档) */
    platformContext?: PlatformToolContext;
    /**
     * 装配期告警回调(通用告警通道,createSession 注入 `warn`):目前只出
     * `tools_platform_deprecated`(`tools.platform` 兼容别名弃用提示,每次装配一条,
     * `detail.names` = 别名里的媒体名)。缺席 = 静默(低阶 runAgent / query 径无通道)。
     */
    onWarning?: (warning: SdkWarning) => void;
    /**
     * 出网客户端(三层 SSRF × 代理复合;WebFetch / Http 同经此出网)。缺省进程级
     * 共享实例(sdkEgressClient);宿主 / 测试可注入。
     */
    egress?: EgressClient;
    /**
     * Http 工具 auth 可引用的环境变量名单(托管档 = 配置段 `http.allowedAuthEnvVars`,
     * assembleTooling 以 `httpAllowlistForTool(loaded.http)` 展开传入,与 HookEngine
     * `allowedHeaderEnvVars` 同一键)。缺席 = 不限(令牌 / 注入档无本地配置来源;hard-safety 兜底)。
     */
    allowedAuthEnvVars?: readonly string[];
    /**
     * Read 图片分支的模型能力谓词(kernel 门 2)。装配层把**当前**会话
     * 模型的 imageInputMode 以 getter 注入(setModel 热切换即时生效;取值在工具执行时点);
     * 缺席 = 未接线 = Read 图片径 fail-closed 恒拒并如实说明「capability: unknown」。
     */
    imageInput?: () => InputModalityMode | undefined;
}
/** `tools.platform` 兼容别名弃用提示的告警码(source 'sdk',经 onWarning / sdk.notice 回落) */
declare const TOOLS_PLATFORM_DEPRECATED_CODE = "tools_platform_deprecated";
/** `buildSdkToolSet` 的产物:kernel 工具注册表 + 送模型的工具定义 + custom 工具 guide 聚合段 */
interface SdkToolSet {
    registry: ToolRegistry;
    toolDefs: IRToolDef[];
    /** custom 工具 guide 聚合段(无 guide 时 null;调用方追加到 system 尾) */
    guideSegment: IRSystemSegment | null;
}
/** Tool.inputSchema(zod)→ IRToolDef 三字段(剥 $schema 元字段省 token) */
declare function toToolDef(tool: Tool): IRToolDef;
/**
 * builtin 选择集裁剪:显式选择逐名校验(未知名/位关 fail-fast),缺席按
 * 能力位静默过滤全集。返回按固定装配序排列(去重)。
 * 媒体四名(D-M4):位 = capabilities.platform.<name>;缺席选择(全集档)恒不装——
 * 位开亦然(既有 App 不因位开而突然多四个计费工具;工具定义进每次 prompt 有 token 成本)。
 */
declare function resolveBuiltinSelection(selection: readonly string[] | undefined, capabilities: AppCapabilities): BuiltinToolName[];
/**
 * platform 兼容别名解出(D-M3;校验 + 装配序):未知名/位关恒 fail-fast 可读错(文案逐字沿
 * 迁移前);返回按 PLATFORM_NAMES 固定序去重的选择集——buildSdkToolSet 将其**等价并入 builtin
 * 选择集**(同名同描述同 schema 同序同材料闸,A-1),恒不 fail-fast(与 S-WS2 webSearch 迁移
 * 指引不同:imageGen/videoGen 已随 @tansr/sdk@0.10.0 tools.platform 发布,下一版不应破坏)。
 */
declare function resolvePlatformSelection(selection: readonly string[] | undefined, capabilities: AppCapabilities): PlatformCapabilityName[];
/** guide 段的语义标签(IRSystemSegment.label;skills 索引段同款纪律) */
declare const TOOL_GUIDE_LABEL = "tool-guides";
/**
 * custom 工具 guide 聚合段(「Tool usage guide」;无任何 guide 返回 null,
 * 空 text 段对部分 provider 非法,与 skills 索引段跳过语义一致)。guide
 * 文本来自开发者(与 system 选项同权,非终端不受信输入),不做转义。
 */
declare function buildToolGuideSegment(custom: readonly Tool[]): IRSystemSegment | null;
/**
 * 聚合工具集:三环入口 + 能力位裁剪 → { registry, toolDefs, guideSegment }。
 * registry(执行面)与 toolDefs(模型可见面)来自同一数组,名字集合恒一致;
 * custom 同名冲突由 registry 注册 throw 暴露(装配期编程错误)。
 */
declare function buildSdkToolSet(options?: BuildSdkToolSetOptions): SdkToolSet;

/**
 * SDK 托管装配:五层配置 → ProviderRegistry → fallback 链 client,以及「权限引擎 → hooks → 工具集 →
 * 权限门 → 调度执行器」的工装一站式(assembleTooling,createSession 与托管 query 共用,两处语义恒一致)。
 *
 * 全部经 @tansr/kernel 与 @tansr/providers 公共 API 完成,不 import @tansr/cli。客户端形态与 cli 同源:
 * 链装配由 providers buildAliasClient 单源承载——fallbacksFor(alias) 有序链包 FallbackModelClient,每 entry
 * 自动套 RetryingModelClient(entry 内先重试,耗尽再切换);链首 client 立即构造(缺 key / 未知 provider
 * 在装配期结构化抛出,而非首次 stream 的流内错误)。
 *
 * 与 cli 的裁剪差异:不含 TANSR_TEST_* 环境变量回退通路——SDK 托管档只认五层配置文件或注入的 config。
 */

/** 托管档单轮 modelTurns 护栏缺省(失控保护;与 serve 对齐) */
declare const DEFAULT_MAX_TURNS = 200;
/** `assembleManagedModel` 的选项:模型别名与配置来源 / 注入缝(全部可选,缺省 = 当前目录五层配置 + 'main') */
interface AssembleManagedModelOptions {
    /** 模型别名(main/fast/reasoning/自定义)或 ref(provider/model);缺省 'main' */
    model?: string;
    /** 项目层配置发现起点;缺省 process.cwd() */
    cwd?: string;
    /** 环境变量注入缝(配置路径变量与 API key 读取共用);缺省 process.env */
    env?: Record<string, string | undefined>;
    /** fetch 注入缝(透传协议适配器;测试不发真实请求) */
    fetchImpl?: typeof fetch;
    /** 已装载配置注入缝:提供时跳过 loadConfig(调用方自管配置来源) */
    config?: LoadedConfig;
    /** loadConfig 其余注入缝(fs/homedir/platform;测试 hermetic 用) */
    loadOptions?: Omit<LoadConfigOptions, 'cwd' | 'env'>;
    /** fallback 链最终命中通报(session 装配据此合成 cost.provider.switched) */
    onProviderSelected?: (selection: FallbackSelection) => void;
}
/** `assembleManagedModel` 的产物:fallback 链 client、解析出的模型及装配所用 registry / 配置 / 诊断 */
interface AssembledManagedModel {
    client: ModelClient;
    model: ResolvedModel;
    /** provider capability.maxContext(水位分母;能力表缺省时不落) */
    contextWindowTokens?: number;
    /** provider capability.maxOutput(查询环事前钳制 maxTokens 的上界;未实证不落) */
    maxOutputTokens?: number;
    /** 装配所用 registry(setModel 别名热切换与后续解析复用同一 config) */
    registry: ProviderRegistry;
    /** 五层合并产物(permissions/hooks 段的唯一事实源) */
    loaded: LoadedConfig;
    /** 配置装载诊断(结构化;呈现与否由调用方决定) */
    configDiagnostics: ConfigDiagnostic[];
}
/**
 * registry + 别名 → fallback 链 client 与解析结果(setModel 热切换复用)。
 * 链装配由 @tansr/providers buildAliasClient 单源承载;本函数保留 SDK 专属职责:错误包装
 * (TansrSdkError `assembly_failed`)与 ResolvedModel / contextWindowTokens 投影。
 */
declare function buildClientFromRegistry(registry: ProviderRegistry, aliasOrRef: string, onProviderSelected?: (selection: FallbackSelection) => void): {
    client: ModelClient;
    model: ResolvedModel;
    contextWindowTokens?: number;
    maxOutputTokens?: number;
};
/** 五层配置(或注入 config)→ registry → 别名 client(托管档一站式) */
declare function assembleManagedModel(options?: AssembleManagedModelOptions): Promise<AssembledManagedModel>;
/**
 * FallbackSelection → cost.provider.switched 事件体。构造逻辑住 @tansr/providers providerSwitchedEventBody
 * (cli / sdk 双端单源);保留原函数名维持 SDK 消费面不变。
 */
declare function providerSwitchedBody(selection: FallbackSelection): EventBody | null;
/** `createSession` / `query` 的权限选项:模式、附加规则与询问回调(缺省全部沿五层配置 / fail-closed) */
interface PermissionOptions {
    /**
     * 权限模式;缺省取五层配置 defaultMode(注入档缺省 'default')。令牌档装配了裁决人时模式由 kernel
     * `modeUnderAdjudicator` 推导。与本位同现:显式 `adjudication` 选项 × mode → fail-fast invalid_options
     * (真矛盾);缺省注入的 bundle 裁决人 × mode → 不装裁决人、按本位自管模式 + 通报
     * `adjudicator_skipped_by_mode`(兼容旧版输入);要静默自管请传 `adjudication: { enabled: false }`。
     */
    mode?: PermissionMode;
    /** 附加规则:并入 user 层,与配置规则按「最严格者胜」合并 */
    rules?: PermissionRules;
    /**
     * 权限询问回调(SDK 使用方自己实现交互面);缺省无 → 调度器把 ask
     * 降级为 deny(fail-closed,与 serve 同策略),tool.permission.decided
     * (source='policy')事件可观测。
     */
    askUser?: AskUserCallback;
}
/**
 * `assembleTooling` 的裁决人材料——决定权限模式所需的事实(姿态 × 资格档)随分类器配置一并传入,
 * 模式推导住 kernel `modeUnderAdjudicator`(sdk / serve 同源)。
 * 形状 = `AssembledBundleAdjudicator` 的 `{ config → classifier, posture, tier }` 三件。
 */
interface AssembleToolingAdjudication {
    /** kernel 分类器配置(assembleBundleAdjudicator 产物,治理旋钮已叠加) */
    classifier: PermissionClassifierConfig;
    /** 生效姿态(bundle escalation.mode:'reject' 覆写后) */
    posture: AdjudicationPosture;
    /** 生效资格档(bundle tier ?? 'none';none = 裁决人对 safe 零软化权) */
    tier: EffectiveQualificationTier;
    /**
     * 开发者是否**显式**给了 `adjudication` 选项(`PreparedAdjudication.explicit`)。与 `permission.mode`
     * 同现时:显式 → 真矛盾 fail-fast;缺省注入(令牌档 bundle 裁决人恒在 = 平台底档)→ 不装裁决人、
     * 模式按 `permission.mode` 自管 + 通报 `adjudicator_skipped_by_mode`——使 `createSession({ token,
     * permission: { mode } })` 这类旧版合法输入不因裁决人引入而变为 throw。
     */
    explicit: boolean;
}
/** `assembleTooling` 的选项:cwd / 会话归属 / 配置 + 工具、能力位、skills、MCP、权限与裁决人材料 */
interface AssembleToolingOptions {
    /** 私有所有权移交：query在回滚开始接管资源及统一观察预算；session保留缺省回滚。 */
    onRollback?: (resources: OwnedResources, cause: unknown) => never;
    /** 权限规则路径锚定与工具执行 cwd(两者必须一致) */
    cwd: string;
    /** hooks 引擎的会话归属 */
    sessionId: string;
    /** 五层配置(permissions/hooks 段来源);注入档无配置为 null(hooks 不装) */
    loaded: LoadedConfig | null;
    /** 三环工具入口(内置 / 自定义 / 平台;缺席 = 装配能力位放行的全部内置工具) */
    tools?: SdkToolsOptions;
    /** 能力位档;缺省 DEFAULT_APP_CAPABILITIES(令牌档由 bundle 供给) */
    capabilities?: AppCapabilities;
    /** 环3 平台工具材料(令牌档由 createSession/query 注入,其余档恒缺席) */
    platformContext?: PlatformToolContext;
    /** skills 注入(受 skills 能力位——位关而材料在场 fail-fast) */
    skills?: SdkSkillsOptions;
    /** MCP 外接(host 实例 = 应用级共享,选项对象 = 会话级临时 host) */
    mcp?: McpSessionOption;
    /** AskUser 工具交互通道;缺省 UnavailableChannel(结构化降级,不挂起) */
    promptChannel?: PromptChannel;
    permission?: PermissionOptions;
    /**
     * 裁决人:kernel 分类器配置 + 生效姿态 + 生效资格档(assembleBundleAdjudicator 产物三件,治理旋钮已叠加)。
     * 在场即 PermissionEngine({ mode: modeUnderAdjudicator({ posture, tier }), classifier })——模式由 kernel
     * 单点推导(无人环姿态 × tier none 不切 auto,维持 default;其余 auto):「本应 ask」的调用经裁决人终裁
     * (判危险按 rejectEffect 落 ask/deny,判安全且资格半径覆盖 → allow);与 `permission.mode` 同现 fail-fast。
     * 缺席 = 现状(无分类器路径,模式沿 permission.mode / 配置缺省)。
     */
    adjudication?: AssembleToolingAdjudication;
    /**
     * 装配层合成事件出口(hook 可观测事件 / todo 台账变更)。createSession
     * 接会话队列(重打包络入流);单轮 query 托管档省略——合成事件丢弃,
     * gate 决策语义不受影响(hooks 仍参与决策,仅损失 hook.* 可观测事件)。
     */
    emit?: (body: EventBody, source: string) => void;
    /** 告警通道(createSession 注入;装配期非致命提示如 `tools_platform_deprecated` 经此出;缺席静默) */
    warn?: (warning: SdkWarning) => void;
    /**
     * 每次经门终局的审计记录出口(kernel 执行器 `onDecision` 缝;`ToolDecisionRecord` 与 cli `decisions.jsonl`
     * 行同形,含**机器放行** classifier / mode)。缺省实现:`source === 'classifier'` 的记录经 `warn` 通报
     * `permission_decided`(平台源;令牌档无本地盘,事件流已由 kernel 门面 `decided{allow}` 帧覆盖,本缝是
     * 开发者审计半边);传自己的写入器即接管;传 `() => {}` 即静默。
     */
    onDecision?: (record: ToolDecisionRecord) => void;
    /**
     * 出网客户端(三层 SSRF 防护 × 代理复合)——WebFetch / Http 与托管档 hooks http 执行体同经此出网。
     * 缺省进程级共享实例(sdkEgressClient);宿主 / 测试可注入。
     */
    egress?: EgressClient;
    /**
     * Read 工具图片分支的模型能力谓词。createSession / query 以会话**当前**模型的 imageInputMode 绑 getter
     * (setModel 热切换即时生效);缺席 = 未接线 = 图片径 fail-closed 恒拒并如实说明未接线。
     */
    imageInput?: () => InputModalityMode | undefined;
}
/** `assembleTooling` 的产物:执行器、工具定义 / 注册表、权限门、装配层 system 段与 cwd 重绑能力 */
interface AssembledTooling {
    executor: ToolExecutor;
    /** 模型可见工具定义(与 executor 的 registry 名字集合恒一致) */
    toolDefs: IRToolDef[];
    /** 工具注册表(与 toolDefs 名字集合恒一致;Task 子代理附着面) */
    registry: ToolRegistry;
    /** 权限门(Task 子代理沿用同实例) */
    permissionGate: PermissionGate;
    /** 装配层合成 system 段(guide 等;调用方追加到用户 system 尾部) */
    systemSegments: IRSystemSegment[];
    /** 生效能力位(agent 位等后续装配消费) */
    capabilities: AppCapabilities;
    /** 会话收口回调(会话级临时 MCP host 的 dispose;应用级 host 恒缺席) */
    onEnded?: () => Promise<void>;
    /** 内部所有权载体，会话与单轮 query 装配共享同一真实在飞清理。 */
    ownedResources?: OwnedResources;
    /**
     * Task 子代理 McpDiscover 换装工厂(MCP 懒目录非空时在场;与 cli 同形)。调用方接进 attachSdkTaskTool 的
     * `mcpDiscover`:子代理生效集含 McpDiscover 时派生期换装为绑定子视图的实例(展开只写子代理自己的工具面);
     * 缺席 = kernel 防御性摘除(子代理无 MCP 展开面)。
     */
    mcpDiscover?: (toolset: McpToolset) => Tool;
    /**
     * 按新 cwd 重建 cwd 锚定的三件——PreToolUse HookEngine(command 执行体 cwd 与载荷 cwd)、权限门
     * (规则路径锚定 / 工作区快路径)、执行器(kernel withCwd 派生:registry / fileReadState / searchAggregator
     * 共享)。权限引擎实例复用(会话缓存 / 分类器熔断与预算 / 已装载策略束跨切换存续;规则编译按 cwd 键缓存
     * 无陈旧面)。返回新实例,既有实例零改动;调用方(AgentSession.setCwd)在空闲期替换持有引用。
     * 多次调用自最近一次派生。
     */
    rebindCwd: (cwd: string) => {
        executor: DispatchingToolExecutor;
        permissionGate: PermissionGate;
    };
}
/**
 * 工装一站式:权限引擎(五层规则 + options 附加规则)→ hooks(PreToolUse
 * 参与 gate)→ 工具集(能力位裁剪 + skills 装配)→ 权限门 → 调度执行器。
 * askUser 缺省缺席 → 调度器把 ask 降级 deny(fail-closed)。skills 装配
 * 含目录发现,故本函数异步。
 */
declare function assembleTooling(options: AssembleToolingOptions): Promise<AssembledTooling>;

/**
 * 分类器协议表面:`coding` = 编码代理协议(CLI 各入口;本文件的指令文本);`app` = 应用表面协议
 * (SDK 令牌档 / serve 平台会话;指令文本在 prompts-app.ts)。表面决定「裁决人看什么、按什么判」,
 * 姿态决定「裁决结果如何落地」,两者正交。
 */
type ClassifierProtocol = 'coding' | 'app';
/** 两阶段合计咨询超时(引擎强制;单阶段场景余量只多不少) */
declare const TWO_STAGE_TIMEOUT_MS = 15000;
/**
 * 超时策略:咨询超时的全部行为参数。当前生效的是总预算与首字对冲两维;stage1CapMs(快筛硬顶)与
 * stage2MinReserveMs(复审最小保留量)字段已占位,序列化器显式记 `none`,机制实现随预算矩阵定案
 * 一体落地(评估与生产同构)。
 */
interface ClassifierTimeoutPolicy {
    totalMs: number;
    stage1CapMs?: number;
    stage2MinReserveMs?: number;
    /**
     * 首字对冲上限(协议 v4;探针实证端点首字延迟双峰——多数在 1–3.3 s,少数停滞 6–22 s 且与我方并发
     * 无关——同一请求的停滞彼此独立,对冲把「双双停滞」压到 p²)。首事件超过本值仍未到达即并行再发一份
     * 同请求,先到 message_stop 者胜。
     */
    firstEventCapMs?: number;
    /** 对冲形态:'same-handle' = 同句柄同请求再发一份;缺席 = 不对冲 */
    hedge?: 'same-handle';
    /**
     * 每分类器实例(= 每会话)对冲次数上限(协议 v5):实证形态下约四成咨询会对冲,成本 ×1.4
     * ——耗尽后不再对冲(首字停滞回到截止 → unsure 交人,方向安全),遥测单列。缺席 = 不限。
     */
    hedgeBudget?: number;
}
/**
 * 现行超时策略(单一事实源):总预算 15 s 不变(A 姿态体验上限);首字对冲
 * 5 s(P1 实证健康端点首字 p90 ≈ 3.3 s,停滞态起于 6.4 s——5 s 落在两峰之间;
 * V8 那晚首字中位 4.5 s 时约四成咨询会对冲,代价 token ×1.4,换的是 G5 主体);
 * 对冲会话上限 40(callBudget 缺省 200 × 健康态对冲率 ≈ 5–17% 的上界)。
 */
declare const CLASSIFIER_TIMEOUT_POLICY: ClassifierTimeoutPolicy;
/**
 * 超时策略规范化序列化(指纹分量;缺席字段显式 `none` 保持规范形):
 * 任何超时行为变更——总预算、stage cap/保留量、首字对冲——都会改变指纹,
 * 既有资格机械失效(堵审计发现的指纹缝:此前改 TWO_STAGE_TIMEOUT_MS
 * 不动指纹,超时行为可在资格有效期内静默漂移)。
 * v2(协议 v4):追加 firstEventCap / hedge 两分量。
 */
declare function serializeTimeoutPolicy(policy: ClassifierTimeoutPolicy): string;
/**
 * stage token 预算覆写(kernel 自配置 permissions.classifier.{stage1MaxTokens,stage2MaxTokens} 投影)。
 * 覆写 = 协议变体:生效值卷入协议指纹(fingerprintFor 现算),旧评估证据机械失效(钉指纹纪律的既有语义);
 * 单阶段形态吃 stage2MaxTokens(输出形制与 stage2 同型同额)。
 */
interface ClassifierStageBudgetOverrides {
    stage1MaxTokens?: number;
    stage2MaxTokens?: number;
}
/**
 * 两阶段协议指纹现算(分量全集;预算参数化):
 * 缺省实参 = 编译内缺省预算,产值 === CLASSIFIER_PROTOCOL_FINGERPRINT。
 */
declare function classifierProtocolFingerprintFor(stage1MaxTokens?: number, stage2MaxTokens?: number): string;
/**
 * 协议指纹:两阶段协议的全部行为成分——指令文本、解析正则(含思考剥离)、输出预算、**超时策略**——的
 * sha256 前 16 位。资格名单条目钉住此值:任何提示词/解析器/预算/超时改动都会改变指纹,旧资格**机械失效**
 * (无须人工记得 bump 版本号),重评后才可重新登记。危险类别清单已内嵌于两段指令文本。新值恒以运行时
 * 计算为准。本值 = 缺省预算指纹;预算覆写场景以 classifierProtocolFingerprintFor 现算值为准。
 * 自 cli 迁入 sdk 时搬迁前后值逐字节相等(cli/sdk 双卷钉值)。
 */
declare const CLASSIFIER_PROTOCOL_FINGERPRINT: string;
/**
 * 单阶段协议指纹现算(预算参数化;单阶段吃 stage2MaxTokens 同额语义):
 * 缺省实参产值 === SINGLE_STAGE_PROTOCOL_FINGERPRINT。
 */
declare function singleStageProtocolFingerprintFor(maxTokens?: number): string;
/**
 * 单阶段协议指纹(与两阶段指纹互异):单阶段候选的资格绑定键
 * ——stage1=stage2=同一句柄 × 本指纹。共用硬化/超时策略/思考剥离分量
 * (同一治理域;单阶段解析走 parseStage2Output,思考剥离同样生效),
 * 指令/解析/预算分量独立。新值恒以运行时计算为准。本值 = 缺省预算
 * 指纹;预算覆写场景以 singleStageProtocolFingerprintFor 现算值为准。
 */
declare const SINGLE_STAGE_PROTOCOL_FINGERPRINT: string;
/** stage1 产出 → 是否拦截;不可解析回 null(fail-degrade 交 unsure);先剥思考段 */
declare function parseStage1Output(raw: string): 'yes' | 'no' | null;
/** 三值判词(协议 v5):block = 拦;clear = 放;ask = 交人(→ unsure + escalatedByModel) */
type ParsedVerdict = 'block' | 'clear' | 'ask';
/**
 * stage2 / 单阶段产出 → 三值判词 + 理由;不可解析回 null(fail-degrade 交 unsure);先剥思考段。
 * `block` 布尔位保留(= verdict==='block')供既有消费方零漂移。
 */
declare function parseStage2Output(raw: string): {
    verdict: ParsedVerdict;
    block: boolean;
    reason: string;
} | null;
/**
 * 引擎事实段 `<engine-facts>`(协议 v4):把权限引擎已算出的结论级事实(shell 各段是否只读 / 重定向 /
 * 注入痕迹、路径是否在工作区内、规避信号等)渲染成裁决人可读的行,模型据此判断而不必自行推演。
 * 事实来自 kernel describeTargetFacts(引擎与 harness 同一函数);段内措辞冻结(模型可见)。
 * 缺席不渲染空段(旧宿主 / 未注入零漂移)。
 */
declare function renderEngineFacts(facts: ClassifierTargetFacts): string[];
/**
 * 应用语境段渲染(应用协议 v1):`<app>` 与 `<tool>` 是
 * 开发者/平台声明的事实,置于一切数据载荷之前。缺席字段显式 "(not declared)"
 * ——语境缺席本身让准则退回保守。
 */
declare function renderAppContext(app: ClassifierAppContext | undefined, tool: ClassifierToolMeta | undefined, toolName: string): string[];
/** `renderCallPayloadDetailed` 的选项:协议表面 + 应用语境 */
interface RenderPayloadOptions {
    /** 协议表面(缺省 coding = 现行段序 + engine-facts) */
    protocol?: ClassifierProtocol;
    /** 应用语境(应用协议;`input.app ?? 装配闭包`,调用方已合并) */
    app?: ClassifierAppContext;
}
/**
 * 工具调用载荷(两阶段/单阶段共用;policy 语境 / 引擎事实 / transcript 有则附,
 * 显式标注数据语义)+ 截断事实。段序:应用协议 `<app>` `<tool>` 先于一切;
 * 随后 `<policy-context>` → `<engine-facts>`(v4)→ `<user-request>` → `<tool-call>`。
 */
declare function renderCallPayloadDetailed(input: ClassifierInput, options?: RenderPayloadOptions): {
    payload: string;
    truncated: boolean;
};
/** 阶段 prompt 渲染(stage 1 偏拦快筛 / stage 2 复审纠偏;评估/测试消费口) */
declare function renderClassifierStagePrompt(stage: 1 | 2, input: ClassifierInput): string;

/**
 * 分类器裁决人档 — 核心(两阶段 / 单阶段状态机、模型调用面、fail-degrade、观测遥测、脱敏、
 * 窄缓存版本标签)。与 CLI 共用**同一份**实现:SDK 令牌档与 serve 平台内置形皆消费本模块(单源多入口)。
 *
 * 分层与注入面(sdk 恒不 import cli):
 * - **stage 模型调用面**:`ClassifierStageHandle`(client + 已解析 model + temperatureFixed / thinkingOff
 *   能力位)——cli 的辅助模型结构兼容直传;SDK/serve 以 bundle registry 别名解析后构造同形句柄;
 * - **资格解析闭包注入**:`resolveTier: () => EffectiveQualificationTier`——CLI 沿裁决人池任命 ×
 *   managed/env 天花板 × 会话覆盖三源合成;SDK/serve 沿 bundle `adjudicator.tier`(缺席按 'none' =
 *   只收紧不软化)。本核心不含任何任命/天花板数学,只把闭包原样喂给 kernel resolveQualificationTier;
 * - **治理旋钮不在此**:启用开关、tightenOutsideAuto、callBudget 属宿主配置面(cli env/五层配置;
 *   SDK `adjudication` 选项)——宿主在返回体上叠加;stage token 预算覆写以 `budgets` 参数注入
 *   (协议变体 → 指纹现算)。
 *
 * 协议语义(与 cli 原实现逐字节同构;详见 prompts.ts 头注):
 * - stage1 偏拦快筛(fast 档;`no` → safe)→ stage2 独立复审(缺省 main 档;确认 → unsafe 携理由,
 *   推翻 → safe);单阶段一次直出;
 * - **fail-degrade 恒为 unsure**:模型错误/流异常/产出不可解析/句柄现值缺席一律回 unsure
 *   (引擎侧 = 维持 ask,绝不因分类器故障放行或误拦);
 * - 硬化:秘密脱敏后入 prompt(redactDeep,尾 4 位保形);args/结构树被截时 safe 降 unsure
 *   (unsafe 收紧不受限);
 * - 观测遥测:逐阶段观测型终态 + 计时 + 五路用量;不可解析分支附脱敏定长 rawDigest;
 *   只记计时/枚举/用量,不落 thinking 正文;
 * - 活值供给:`liveStages` 在场时每次咨询起点取 stage 句柄现值(单次咨询内同代取值防撕裂),
 *   缓存版本标签随现值现算;
 * - 窄缓存版本标签 = 协议指纹 × stage 模型对(kernel 缓存键分量)。
 */

/**
 * 装配形态二值:两阶段(快筛 + 复审,缺省生产形态)/ 单阶段(一次调用直出)。形态在**装配期定格**
 * (选定后 classify 闭包不变);形态是协议形制非模型身份,由宿主按评估证据选择(SDK/serve 缺省两阶段)。
 */
type ClassifierAssemblyMode = 'two-stage' | 'single-stage';
/**
 * stage 模型调用句柄(裁决人档的模型调用面):已解析客户端 + (provider, model)标识 + 请求构造所需
 * 能力位。cli 的辅助模型结构是本形的超集,直传即可;SDK/serve 以 bundle registry 解析 `modelHandle` /
 * 主模型后构造同形句柄。
 */
interface ClassifierStageHandle {
    client: ModelClient;
    model: ResolvedModel;
    /**
     * capability.sampling.temperatureFixed 透出:厂商固定温度的模型(如 kimi 系 openai 面「only 1 allowed」,
     * t=0 直接 400)——请求构造**省略 temperature 参数**采用厂商固定值(providers 契约「透传不改写」,
     * 规避只能在请求构造端做)。
     */
    temperatureFixed?: number;
    /**
     * fast 形态思考关断标记——true 时请求恒带 `thinking: { off: true }`(适配器按方言显式关断);
     * 仅「主模型 fast 形态 × 思考模型实证可关」产生本标记,独立 fast 模型恒缺席 = 出线字节零漂移。
     */
    thinkingOff?: true;
}
/**
 * stage 档现值对:liveStages 供给器的返回形态。fast 缺席 = 档位现值不可用(咨询即 unsure 交人工,
 * fail-degrade 既有方向);stage2 缺席回退 fast(启动装配同律)。
 */
interface ClassifierLiveStages {
    fast?: ClassifierStageHandle;
    stage2?: ClassifierStageHandle;
}
/** 当前轮用户 prompt 记录器(裁决人意图对齐信号源;由 `createClassifierTranscriptRecorder` 创建) */
interface ClassifierTranscriptRecorder {
    /** 轮起跑登记:覆盖式记录当前轮用户 prompt(截断 + 条数上限) */
    noteTurn(prompts: readonly string[]): void;
    /** 同轮真实用户补充输入；保留首条任务及最新意图，不重置轮。 */
    noteInput(prompts: readonly string[]): void;
    /** 提供器(直接喂 PermissionClassifierConfig.transcript);空时 undefined */
    transcript(): ClassifierTranscript | undefined;
}
/**
 * 创建 transcript 记录器:只保留**当前轮**的用户 prompt(意图对齐信号的
 * 主体;历史轮不保留——低 token 铁律 + 注入面最小化)。助手文本与工具
 * 结果由构造排除(记录器只接 prompt 参数,无其他入口)。
 */
declare function createClassifierTranscriptRecorder(): ClassifierTranscriptRecorder;
/** 分类器核心构造选项(宿主负责启用裁决、治理旋钮与资格合成;此处只收产物) */
interface CreateBlockListClassifierOptions {
    /** stage1 快筛档句柄(装配期快照;liveStages 在场时仅作缓存标签/回退基线) */
    fast: ClassifierStageHandle;
    /**
     * stage2 复审档(缺省 main 档):复审是质量敏感的一半,花对钱;缺席回退 fast(测试与降级形态——
     * SDK/serve 无 fast 别名时两阶段皆 main 即此形态,如实降级)。
     */
    stage2?: ClassifierStageHandle;
    /**
     * stage 档活值供给器——每次咨询起点取现值(单次咨询内 stage1/stage2 同刻取值防撕裂),模型切换后
     * 下一次咨询即用新档;缓存版本标签随现值现算(kernel 键失配 = 旧模型时代裁定不跨代回放)。
     * 缺席 = 启动快照语义(零漂移)。装配形态与协议指纹仍装配期定格。
     */
    liveStages?: () => ClassifierLiveStages;
    /**
     * 资格解析闭包(kernel resolveQualificationTier 直喂):返回当前生效档,引擎**每次咨询现算**。
     * CLI 注入三源合成器(min(任命 entry, ceiling, override));SDK/serve 注入 bundle `tier` 常量闭包
     * (缺席 `() => 'none'` = 只收紧不软化)。闭包抛错/词表外值由 kernel 按 'none' 兜底(fail-closed)。
     */
    resolveTier: () => EffectiveQualificationTier;
    /**
     * stage token 预算覆写:覆写 = 协议变体,生效指纹随之现算(缓存键与证据解释同源换算);
     * 单阶段吃 stage2MaxTokens。
     */
    budgets?: ClassifierStageBudgetOverrides;
    /**
     * 装配形态:缺省 'two-stage';'single-stage' 时 createBlockListClassifier
     * 分派到 createSingleStageClassifier(一次调用直出,单阶段协议指纹)。
     */
    mode?: ClassifierAssemblyMode;
    /**
     * 协议表面:缺省 'coding'(编码代理协议,CLI 各入口,零漂移);'app' = 应用表面协议
     * (SDK 令牌档 / serve)——只定义单阶段形态,与 two-stage 组合直接抛错而非静默回退编码提示词。
     */
    protocol?: ClassifierProtocol;
    /**
     * 应用语境(应用协议;bundle `app.name` / `app.purpose`)。装配期闭包
     * 常量;`classify(input)` 以 `input.app ?? options.app` 合并——评估 harness
     * 逐例注入以变换语境三态,生产由本位补齐。
     */
    app?: ClassifierAppContext;
    /**
     * 请求估算配对观测缝(purpose='classifier';本地估算 × 服务端用量配对)。每次 stage 调用
     * (两阶段至多 2 行/咨询,单阶段 1 行)各回调一次;缺省不观测。
     */
    requestMeasurement?: RequestMeasurementObserver;
}
/**
 * 分类器核心产物 = kernel PermissionClassifierConfig 的档内部分(classifier /
 * timeoutMs / resolveQualificationTier / cacheVersionTag 四键恒在场);宿主在
 * 其上叠加治理旋钮(tightenOutsideAuto / callBudget / rejectEffect)、transcript
 * 提供器与 onBreakerTrip 等通知面后直接进 PermissionEngineConfig.classifier。
 */
interface BlockListClassifierConfig extends Pick<PermissionClassifierConfig, 'classifier'> {
    timeoutMs: number;
    resolveQualificationTier: () => EffectiveQualificationTier;
    cacheVersionTag: string | (() => string);
}
/**
 * 按装配形态分派构造(缺省两阶段;'single-stage' 委托单阶段构造)。宿主
 * 的启用裁决、治理旋钮、资格合成均在调用前完成——本函数只收注入面产物。
 */
declare function createBlockListClassifier(options: CreateBlockListClassifierOptions): BlockListClassifierConfig;
/**
 * 两阶段分类器核心(生产缺省形态):stage1 fast 快筛 → stage2 复审。
 * 返回体四键(classifier / timeoutMs / resolveQualificationTier /
 * cacheVersionTag)直接进 PermissionEngineConfig.classifier;宿主叠加治理
 * 旋钮、transcript 提供器与 onBreakerTrip 通知面。
 */
declare function createTwoStageClassifier(options: CreateBlockListClassifierOptions): BlockListClassifierConfig;
/**
 * 单阶段分类器核心(由评估形态升格为生产形态):一次调用直出结论 + 理由(stage2 输出形制,
 * parseStage2Output 解析),同用脱敏/截断禁 safe/fail-degrade/遥测口径。裁决档 = stage2 ?? fast
 * (质量敏感档,与两阶段复审档一致)。
 */
declare function createSingleStageClassifier(options: CreateBlockListClassifierOptions): BlockListClassifierConfig;

/**
 * SDK 裁决人装配:令牌档把 bundle 生效裁决人档(控制台「裁决人」页签的任命——任命即授照)装配成
 * kernel PermissionClassifierConfig,注入 PermissionEngine({ mode:'auto', classifier })。
 *
 * 姿态(表面属性,不是应用属性):
 * - `human-in-loop`(人在环):裁决人判危险 → 升到询问面(携理由交用户终审,用户拒即 deny;机器恒不代批);
 * - `headless`(无人环):判危险 → deny(deny-and-continue,理由回喂模型)。
 * 缺省按询问通道推导:`permission.askUser` 在场 → 人在环,缺席 → 无人环;显式人在环而无 askUser →
 * 装配期 fail-fast(恒不出现「选了人在环却一律 deny」的自相矛盾)。
 *
 * 模型(裁决模型 = modelHandle ?? 会话主模型):复审档 = bundle `adjudicator.modelHandle` 经 registry 目录
 * 自动别名解析,缺席 / 目录外回落会话主模型(回落如实通报);快筛档 = bundle `fast` 别名,缺席即复用复审档
 * (两阶段同模型,如实降级;思考模型实证可关时以 thinkingOff 形态跑快筛)。计费归 App(与会话模型同径)。
 *
 * 资格:`adjudicator.tier`(平台任命档位与组织天花板取交)作常量闭包喂 kernel resolveQualificationTier;
 * 缺席 = 'none' = 只收紧不软化。safe→allow 软化半径恒由 kernel SOFTEN_RADIUS(档 × 调用面)单源裁决,
 * 本模块不含任何半径数学。
 *
 * 通知面:预算耗尽 / 熔断跳闸经 onWarn 以平台提示帧形制上报(createSession / query 的 onPlatformWarning 缝;
 * 码 `adjudicator_budget_exhausted` / `adjudicator_breaker_tripped`),恒不静默蒸发。
 *
 * 治理位:bundle 生效裁决人档的三件治理位在分类器面**生效**——
 * - `escalation.mode:'reject'` → 姿态覆写为 headless(判危险 deny-and-continue,不上升终端用户;宿主显式
 *   human-in-loop 被覆写时通报 `adjudicator_posture_overridden`);
 * - `callBudget` → 每会话咨询预算的 bundle 侧值;
 * - `budgets.maxUsd` / `maxCny` → 与裁决模型**同币**价目折算为咨询次数上界(保守 token 估算,恒不造汇率;
 *   价目缺席 / 币种不匹配 = 金额径不可折算,通报 `adjudicator_budget_unenforced` 而非静默);
 * 生效 callBudget = min(bundle callBudget, 金额折算, 宿主 `adjudication.callBudget`)——**宿主只能收紧**;
 * 三者皆缺席 = kernel 缺省 200。推导单点 = resolveAdjudicatorGovernance(sdk / serve 皆经
 * assembleBundleAdjudicator 走同一函数)。
 *
 * 分层:恒 kernel / providers / protocol,恒不 import cli。
 */

/**
 * 每次裁决咨询的**保守** token 估算(金额 → 次数折算用):输入 = 应用协议 system 段 +
 * 工具描述 / 入参(脱敏)+ 当前轮请求切片的上界;输出 = 单阶段 maxTokens。真实用量恒
 * 更低 → 折算只可能偏严(次数更少 → 更早直通 ask),方向安全;恒不作计费口径。
 */
declare const ADJUDICATION_CONSULT_TOKEN_ESTIMATE: Readonly<{
    input: 4096;
    output: 1024;
}>;
/** 金额折算明细(诊断 / 测试面) */
interface AdjudicatorMoneyFold {
    currency: PricingCurrency;
    /** 预算键(maxUsd / maxCny)纳额 */
    maxNano: number;
    /** 单次咨询估算纳额(ADJUDICATION_CONSULT_TOKEN_ESTIMATE × 同币价目) */
    perConsultNano: number;
    /** 折算次数 = floor(maxNano / perConsultNano)(可为 0:预算不够一次咨询即全部直通 ask) */
    calls: number;
}
/** `resolveAdjudicatorGovernance` 的输入:bundle 裁决人档 + 宿主给的姿态 / 预算 + 折算金额所需的模型与价目 */
interface AdjudicatorGovernanceInput {
    adjudicator: AppBundleAdjudicator;
    /** 宿主显式 / 通道推导的姿态 */
    posture: AdjudicationPosture;
    /** 宿主显式给了 posture(被 bundle 覆写时才值得通报) */
    postureExplicit?: boolean;
    /** 宿主 callBudget(已校验;只能收紧) */
    callBudget?: number;
    /** 实际裁决模型(stage2;价目查表键) */
    model?: ResolvedModel;
    /** bundle 价目(AssembledPlatformModel.pricingUpdates);缺席 = 金额径不折算 */
    pricing?: readonly PricingUpdate[];
}
/** `resolveAdjudicatorGovernance` 的产物:生效姿态 / 咨询预算及其来源、金额折算明细与待上报的通报 */
interface AdjudicatorGovernance {
    posture: AdjudicationPosture;
    /** 'bundle' = escalation.mode:'reject' 覆写;'host' = 宿主 / 推导值原样 */
    postureSource: 'host' | 'bundle';
    /** 生效每会话咨询预算;缺席 = kernel 缺省 */
    callBudget?: number;
    /** 取 min 的来源(诊断);缺席 = 三源皆缺席 */
    callBudgetSource?: 'host' | 'bundle' | 'money';
    /** 金额折算明细(折算成立时在场) */
    moneyFold?: AdjudicatorMoneyFold;
    /** 通报(调用方经 onWarn 上报) */
    notices: AdjudicationWarning[];
}
/**
 * bundle 治理位 → 生效姿态 / 咨询预算(纯函数,零 IO;sdk `assembleBundleAdjudicator`
 * 与 serve 同一入口)。规则:
 * - 姿态:`escalation.mode === 'reject'` → headless 覆写(宿主显式 A 被覆写 → 通报);
 * - callBudget = min(bundle `callBudget`, 金额折算次数, 宿主 callBudget),宿主只能收紧;
 * - 金额折算:裁决模型在 bundle 价目内且币种与预算键匹配(USD→maxUsd / CNY→maxCny)才
 *   折算;预算键在场而价目缺席 / 币种不匹配 → `adjudicator_budget_unenforced` 通报
 *   (恒不造汇率、恒不静默);预算键坏形同通报。
 */
declare function resolveAdjudicatorGovernance(input: AdjudicatorGovernanceInput): AdjudicatorGovernance;

/**
 * `createSession` / `query` 令牌档的裁决人选项。缺席 = 全缺省:
 * bundle 裁决人在场即装配,姿态按 askUser 推导,预算沿 kernel 缺省(200 / 会话)。
 */
interface AdjudicationOptions {
    /**
     * 姿态显式覆盖:'human-in-loop' 需 `permission.askUser` 在场(缺席 fail-fast
     * invalid_options);'headless' 恒可用。缺席 = 按询问通道推导。
     */
    posture?: AdjudicationPosture;
    /**
     * 每会话裁决咨询预算(计实际发起的模型咨询;耗尽后直通 ask——方向安全,
     * A 交用户 / B 降 deny)。≥1 整数,或 Number.POSITIVE_INFINITY = 不限;
     * 缺席 = kernel 缺省。
     */
    callBudget?: number;
    /**
     * false = 本会话不装裁决人(权限行为回到 default 模式现状:非只读工具
     * 兜底 ask → askUser 或降 deny)。缺省 true。
     */
    enabled?: boolean;
    /**
     * 终端用户身份:开发者提供的不透明标识(你的系统里的用户 id / 账号名;不要传令牌或密钥)。
     * 裁决人据以比对工具参数中的归属字段——「用户要求」不授权他人记录;缺席时归属无法确立的
     * 他人记录读会被交回你的 askUser。非空字符串,≤ 120 字符。
     */
    endUser?: string;
}
/** 平台提示帧形制(与 platform/client.ts PlatformWarning 同形;本模块不依赖其文件) */
interface AdjudicationWarning {
    code: string;
    message: string;
}
/**
 * 「bundle 无裁决人段 × 宿主显式给了 adjudication 选项」时的通报(码 `adjudicator_unavailable`)。
 * SDK 与 serve **同码同文案**的单一事实源:`assembleTokenTierAdjudicator` 与 serve 平台裁决人解析两处出线逐字同此。
 */
declare const ADJUDICATOR_UNAVAILABLE_WARNING: Readonly<AdjudicationWarning>;
/**
 * **开发者向**裁决人通报码:只走宿主通道(sdk `onPlatformWarning` / `onWarning`;serve `onPlatformWarning` /
 * 结构化日志),**恒不下发终端用户设备**(serve 的 `server.platform.warning` 帧不携带;serve 侧受众规则以本集为准,
 * 新增码时先加此处)。`adjudicator_posture_overridden`(控制台 escalation reject 覆写宿主显式人在环)与
 * `adjudicator_budget_unenforced`(金额预算不可折算)皆为控制台 × 宿主配置面事实,终端用户无可行动,同律归入。
 * 其余 `adjudicator_*`(如 `adjudicator_model_unavailable`)与 `adjudicator_skipped_by_mode` 同为开发者面装配期通报;
 * SDK 单进程无「端上」之分。
 */
declare const DEVELOPER_ONLY_ADJUDICATOR_WARNING_CODES: readonly string[];
/** 选项形状校验(fail-fast 编程错误;api 位用于报错前缀) */
declare function validateAdjudicationOptions(api: string, options: AdjudicationOptions | undefined): void;
/**
 * 姿态推导:显式覆盖优先;人在环而无询问通道 fail-fast(`invalid_options`);缺席按 askUser 在场与否推导
 * (在场 → 人在环,缺席 → 无人环)。推导本体 = kernel `derivePosture`(cli / serve 同源),本函数只加 SDK 的
 * fail-fast 文案。
 */
declare function resolveAdjudicationPosture(api: string, options: AdjudicationOptions | undefined, askUserPresent: boolean): AdjudicationPosture;
/**
 * registry 别名/ref → stage 句柄(client + 已解析 model + 请求构造能力位)。
 * 不可解析(别名缺席 / provider 未知 / 缺 key)返回 undefined 交调用方回落;
 * 非 registry 结构化错误(编程错误)原样上抛。
 * - temperatureFixed:厂商固定温度模型(kimi 系)省略 temperature 参数;
 * - thinkingOff(仅 fast 形态请求):思考模型实证可关(reasoning ∧ thinkingOptional)时快筛请求显式关断思考
 *   ——快筛 64 token 预算下 reasoning 耗尽即不可解析(白名单制;能力未实证不发,恒不猜)。
 */
declare function resolveStageHandle(registry: ProviderRegistry, aliasOrRef: string, role: 'fast' | 'review'): ClassifierStageHandle | undefined;
/** `assembleBundleAdjudicator` 的输入:令牌档 registry、会话主模型、bundle 裁决人档与宿主给的姿态 / 预算 / 通知面 */
interface AssembleBundleAdjudicatorOptions {
    /** 令牌档 registry(bundle 装配产物;stage 模型经其别名/ref 解析) */
    registry: ProviderRegistry;
    /** 会话主模型(modelHandle 缺席 / 不可解析时的裁决模型) */
    mainModel: ResolvedModel;
    /** bundle 生效裁决人档(parseAppBundle 产物) */
    adjudicator: AppBundleAdjudicator;
    /**
     * 应用语境(应用协议 `<app>` 段;bundle `app.name` / `app.purpose`)。缺席
     * = 两字段皆 null(渲染 "(not declared)",准则退回保守)。
     */
    app?: ClassifierAppContext;
    /**
     * 宿主显式 / 通道推导的姿态。bundle `escalation.mode:'reject'` 覆写为 headless
     * (返回值 `posture` 为生效姿态,调用方据其推导权限模式)。
     */
    posture: AdjudicationPosture;
    /** 宿主显式给了 posture(被 bundle 覆写时通报 `adjudicator_posture_overridden`);缺省 false */
    postureExplicit?: boolean;
    /**
     * 宿主每会话咨询预算(已校验)。只能**收紧**:与 bundle `callBudget` / 金额折算取 min;
     * 缺席且 bundle 无治理位 = kernel 缺省。
     */
    callBudget?: number;
    /**
     * bundle 价目(AssembledPlatformModel.pricingUpdates):`budgets.maxUsd` / `maxCny`
     * 折算 callBudget 上界的同币单价源;缺席 = 金额径不可折算(在场预算键则通报)。
     */
    pricing?: readonly PricingUpdate[];
    /** 通知面(预算耗尽 / 熔断跳闸 / 绑定模型不可解析回落 / 治理位覆写与不可执行) */
    onWarn: (warning: AdjudicationWarning) => void;
    /** 请求估算配对观测缝(purpose='classifier';每次裁决咨询的本地估算 × 服务端用量配对);缺省不观测 */
    requestMeasurement?: RequestMeasurementObserver;
}
/** `assembleBundleAdjudicator` 的产物:可直接注入 PermissionEngine 的分类器配置及其生效姿态 / 资格档 / 模型对 */
interface AssembledBundleAdjudicator {
    /** 直接进 PermissionEngineConfig.classifier(治理旋钮已叠加) */
    config: PermissionClassifierConfig;
    /** 生效姿态(bundle escalation.mode:'reject' 覆写后;调用方据此推导权限模式) */
    posture: AdjudicationPosture;
    /** 生效资格档(bundle tier ?? 'none') */
    tier: EffectiveQualificationTier;
    /** 实际装配的 stage 模型对(诊断/测试面) */
    stage1: ResolvedModel;
    stage2: ResolvedModel;
    /** 轮起跑回填当前轮用户 prompt(宿主在每轮开始时调用 noteTurn) */
    transcript: ClassifierTranscriptRecorder;
    /**
     * bundle 治理位消费明细(姿态 / 预算来源与金额折算;诊断 / 测试面)。
     * assembleBundleAdjudicator 恒填;可选只为宿主测试桩手构产物时零随动。
     */
    governance?: AdjudicatorGovernance;
}
/**
 * bundle 生效裁决人档 → kernel 分类器配置(两阶段 block-list 核心 + 治理旋钮)。
 * 恒返回可用配置:复审档回落链 modelHandle → 主模型,主模型是会话已装配的
 * 别名,解析恒成立(失败即 registry 编程错误,原样上抛)。
 */
declare function assembleBundleAdjudicator(options: AssembleBundleAdjudicatorOptions): AssembledBundleAdjudicator;
/** 入口前置裁决产物(同步、零 IO;bundle 拉取前即 fail-fast) */
interface PreparedAdjudication {
    /** 宿主显式 / 通道推导姿态(bundle escalation.mode:'reject' 在装配后半场可覆写为 headless) */
    posture: AdjudicationPosture;
    /** 宿主显式给了 posture(被 bundle 覆写时通报) */
    postureExplicit: boolean;
    /** 宿主 callBudget(已校验;只能收紧 bundle 侧值) */
    callBudget?: number;
    /** 终端用户身份(应用协议 v2 `<app>` end-user 行;已校验) */
    endUser?: string;
    /** 开发者显式给了 adjudication 选项(bundle 无裁决人段时据此决定是否通报) */
    explicit: boolean;
}
/**
 * 入口前置裁决:
 * - 令牌档:缺省启用(bundle 裁决人恒在 = 平台底档);`enabled:false` → undefined(现状);
 * - 托管/注入档:无 bundle 即无任命来源,`adjudication` 在场属误用 fail-fast
 *   (静默忽略会让开发者以为裁决人在生效);缺席 → undefined;
 * - 选项形状与姿态在此校验/推导(A 无 askUser 在拉 bundle 之前就报)。
 */
declare function prepareAdjudication(input: {
    api: string;
    options: AdjudicationOptions | undefined;
    tokenTier: boolean;
    askUserPresent: boolean;
}): PreparedAdjudication | undefined;
/**
 * 令牌档装配后半场:bundle 裁决人段在场 → 装配;缺席(旧平台 / 坏形状)→ undefined = 现状,开发者显式
 * 配置了 adjudication 时经 onWarn 如实通报(`adjudicator_unavailable`),恒不静默。bundle 治理位
 * (callBudget / budgets 金额 / escalation.mode)在此半场生效——`assembled.pricingUpdates`
 * (AssembledPlatformModel 同名键)在场即为金额折算的同币单价源。
 */
declare function assembleTokenTierAdjudicator(prepared: PreparedAdjudication | undefined, assembled: {
    registry: ProviderRegistry;
    model: ResolvedModel;
    adjudicator: AppBundleAdjudicator | null;
    /** 应用身份(bundle `app.name`/`app.purpose`;缺席 = 两字段 null) */
    app?: ClassifierAppContext;
    /** bundle 价目(金额预算 → 咨询次数折算的同币单价源;缺席 = 金额径不折算) */
    pricingUpdates?: readonly PricingUpdate[];
}, onWarn: (warning: AdjudicationWarning) => void, requestMeasurement?: RequestMeasurementObserver): AssembledBundleAdjudicator | undefined;

/**
 * SDK 结构化错误。
 *
 * 契约:SDK 永不 process.exit、不吞 reject——装配期/选项期错误以本类型同步 throw(code 可编程分支);
 * 运行期模型错误经事件流(turn.error / turn.aborted)表达,与内核语义一致,不在此重复。
 * 面向开发者的 API 错误消息用英文(非终端用户可见面)。
 */
/** 错误码(SDK 对外 API 的稳定分支面) */
type SdkErrorCode = 
/** 选项组合非法(编程错误:如 prompt 与 initialMessages 均缺失) */
'invalid_options'
/** 托管装配失败(模型别名解析/缺 key/配置不可用;cause 携带底层结构化错误) */
 | 'assembly_failed'
/** App 能力位关闭而被显式选择(消息含控制台修复指引) */
 | 'capability_disabled'
/** 会话已关闭后仍调用会改变状态的方法 */
 | 'session_closed'
/** resume 目标会话在 store 中不存在 */
 | 'session_not_found'
/** 会话存储损坏(中段损坏/哈希链断裂/坏 payload;恒不静默返回残缺历史) */
 | 'session_store_corrupted'
/**
 * 快照存储未接线:createSession 未给 checkpoints.store/dir
 * 且会话 store 不提供同居快照存储,却调用了 checkpoint()/listCheckpoints()/
 * deleteCheckpoint() 或显式要求 compact({ checkpoint: true })
 */
 | 'checkpoints_not_wired'
/** 快照存储损坏(非 JSON / schema 不符 / 身份与路径不一致;恒不静默回残缺快照) */
 | 'checkpoint_store_corrupted'
/**
 * 运行中轮次调用了空闲期专属的改写方法(checkpoint()/deleteCheckpoint();
 * compact()/restore() 以结果联合 rejected:'turn_running' 表达,不抛)
 */
 | 'turn_running'
/** fork()/exportCheckpoint() 指名的快照在本会话下不存在(返回形无 rejected 位,结构化 throw) */
 | 'checkpoint_not_found'
/**
 * importCheckpoint() 的字节不是合法导出体(format / schema / 附件 sha256 / 消息形任一不过;
 * 篡改即拒,不落半成品)
 */
 | 'checkpoint_import_invalid'
/**
 * fork() 需要会话存储安放新会话,而 createSession 未给 store(fork 的产物是 store 里的一条
 * 新会话记录,开发者随后以 createSession({ resume: { sessionId, store } }) 打开)
 */
 | 'session_store_not_wired'
/**
 * 令牌档平台直连方法(session.platform.transcribe / speak)的平台请求
 * 失败——网关拒绝(HTTP 非 2xx,携网关错误码)或请求未达平台(网络错)。抛出形为
 * PlatformRequestError(TansrSdkError 子类):`status` / `platformCode` / `platformMessage`
 * 携网关事实,开发者按 platformCode(asr_not_configured / model_not_authorized …)分支
 */
 | 'platform_request_failed'
/** 可等待生命周期中的提交或资源收口失败；保留原始失败及继续回收入口。 */
 | 'lifecycle_failed';
/** SDK 结构化错误基类:`code` 是稳定的可编程分支面,`cause` 携带底层错误(如有) */
declare class TansrSdkError extends Error {
    readonly code: SdkErrorCode;
    constructor(code: SdkErrorCode, message: string, options?: {
        cause?: unknown;
    });
}

/**
 * 生命周期收口失败(`lifecycle_failed` / 装配期 `assembly_failed`):`failures` 逐项列出失败阶段与码,
 * `errors` 为对应原始错误;`cleanup` 在场时可再次调用以继续回收未收口的资源。
 */
declare class SdkLifecycleError extends TansrSdkError {
    readonly failures: readonly SessionLifecycleFailure[];
    readonly errors: readonly unknown[];
    readonly cleanup: SdkCleanupHandle | undefined;
    constructor(code: 'lifecycle_failed' | 'assembly_failed', failures: readonly SessionLifecycleFailure[], options?: {
        cause?: unknown;
        cleanup?: SdkCleanupHandle;
    });
}

/** Common to both query tiers; these options never trigger tooling assembly. */
interface QueryLifecycleOptions {
    /** Default 30 seconds. Bounds cleanup observation, not model execution. */
    cleanupTimeoutMs?: number;
    /** Required error channel when AsyncIteratorClose preserves a consumer's own throw. */
    onLifecycleError?: (error: SdkLifecycleError) => void;
}

/** 托管/令牌档单轮选项(工具/权限缝与 CreateSessionOptions 同名同义) */
interface ManagedQueryOptions extends QueryLifecycleOptions {
    /** 模型别名(main/fast/reasoning/自定义)或 ref(provider/model);缺省 'main' */
    model?: string;
    /** 单轮输入(追加在 initialMessages 之后作最后一条 user 消息) */
    prompt?: string;
    /** 历史前缀(续跑/恢复);与 prompt 至少给一个非空 */
    initialMessages?: readonly IRMessage[];
    /** 业务提示词：平台 fallback 策略下显式值（含 []）覆盖；prepend 策略保留平台段在前。创建时固定。 */
    system?: IRSystemSegment[];
    /** 业务段选定后追加的宿主指南，不触发平台默认覆盖；权限与工具指南仍独立装配。 */
    systemAppend?: IRSystemSegment[];
    /** app_user 短期令牌(开发者服务端换发;模型与能力位由 bundle 供给) */
    token?: string;
    /** 平台 API 基址(令牌档必填,如 https://api.example.com) */
    baseUrl?: string;
    /**
     * 平台提示帧承接(S-ARCH;语义同 CreateSessionOptions.onPlatformWarning):
     * 缺席缺省 console.warn 每码一次,在场即全量接管。
     */
    onPlatformWarning?: (warning: PlatformWarning) => void;
    /** 项目层配置发现起点与工具 cwd;缺省 process.cwd() */
    cwd?: string;
    /** 环境变量注入缝;缺省 process.env */
    env?: Record<string, string | undefined>;
    /** fetch 注入缝(透传协议适配器) */
    fetchImpl?: typeof fetch;
    /** 已装载配置注入缝:提供时跳过 loadConfig */
    config?: LoadedConfig;
    /** loadConfig 其余注入缝(fs/homedir/platform;测试 hermetic 用) */
    loadOptions?: Omit<LoadConfigOptions, 'cwd' | 'env'>;
    /**
     * 三环工具入口(S-B3):builtin(环2 内置,词表逐名)/ platform(环3
     * 平台能力,现只校验位)/ custom(环1 defineTool 产物)。缺席 = 装配
     * 能力位放行的全部内置工具;`tools: { builtin: [] }` = 零内置。
     */
    tools?: SdkToolsOptions;
    /** 显式技能材料；缺席时不扫描CLI技能目录。与createSession同义。 */
    skills?: SdkSkillsOptions;
    /** 显式MCP材料；配置对象为本次自有，McpHost实例为借用。 */
    mcp?: McpSessionOption;
    /** SDK装配警告；平台子集仍沿onPlatformWarning旧出口。 */
    onWarning?: (warning: SdkWarning) => void;
    /** 能力位档;缺省 DEFAULT_APP_CAPABILITIES(令牌档由 bundle 供给) */
    capabilities?: AppCapabilities;
    /** AskUser 工具交互通道;缺省 UnavailableChannel(结构化降级,不挂起) */
    promptChannel?: PromptChannel;
    /** 权限模式与确认通道(语义同 CreateSessionOptions.permission) */
    permission?: PermissionOptions;
    /** 裁决人(仅令牌档;语义同 CreateSessionOptions.adjudication) */
    adjudication?: AdjudicationOptions;
    /** 缺省 8192 */
    maxTokens?: number;
    /** 缺省 randomUUID() */
    sessionId?: string;
    /** 外部中断信号(全链透传:模型流 / 工具执行 / 压缩均立即响应) */
    signal?: AbortSignal;
    /** modelTurns 护栏;缺省 200(托管便捷面失控保护,与 serve 对齐) */
    maxTurns?: number;
    /** toolRounds 上限;缺省不设 */
    maxToolRounds?: number;
    /** 连续可恢复错误熔断上限;缺省 3(内核缺省) */
    maxConsecutiveErrors?: number;
    /**
     * 上下文压缩:缺省 {}(自动压缩,仅上下文窗口已知时
     * 生效——阈值代数依赖窗口,与 TUI/serve 同守卫);false 显式禁用。
     */
    compaction?: QueryCompactionOptions | false;
    /** 采样参数直通 */
    temperature?: number;
    thinking?: {
        budget?: number;
    };
    stopSequences?: string[];
}
/**
 * `query` 的选项:注入档(`RunAgentOptions` + `systemAppend` + 生命周期选项;不接 skills / mcp)
 * 或托管档(`ManagedQueryOptions`,`model` 为别名字符串),以 `client` 在场与否分流。
 */
type QueryOptions = (RunAgentOptions & Pick<ManagedQueryOptions, 'systemAppend'> & QueryLifecycleOptions & {
    skills?: never;
    mcp?: never;
}) | ManagedQueryOptions;
/** query 的终值(末尾 turn.completed/turn.aborted 事件之外的结构化结算) */
interface QueryResult {
    /** 终态原因(与末尾 turn.* 事件的 reason 一致) */
    reason: TerminalReason;
    /** 最后一条 assistant 消息的纯文本拼接(无 assistant 消息时为空串) */
    finalText: string;
    /** 最后一条 assistant 消息(中断极早时可能缺失) */
    finalMessage?: IRMessage;
    /** 完整消息历史快照(深拷贝;可直接作下次 initialMessages 续跑) */
    messages: IRMessage[];
    /** 全轮累计 usage(cost.usage.updated 求和;模型未报 usage 时缺失) */
    usage?: IRUsage;
    /** 内核四计数快照 */
    counters: QueryCounters;
}
/** 五路 usage 求和(可选字段任一侧出现即累计;与 cli headless 同口径) */
declare function accumulateUsage(total: IRUsage | undefined, next: IRUsage): IRUsage;
/**
 * 单轮查询:事件逐条 yield,终态后 return QueryResult。同步可判的选项错误
 * 在调用点同步抛 TansrSdkError('invalid_options')——不推迟到首次 next()
 * (异步生成器体惰性执行,校验放体内会让编程错误漂移到消费点);托管装配
 * 错误天然异步,在首次 next() 以 TansrSdkError('assembly_failed') reject。
 */
declare function query(options: QueryOptions): AsyncGenerator<KernelEvent, QueryResult, undefined>;

/**
 * 媒体异步任务客户端(四面媒体工具共用):
 * POST {base}/t1/{face}/tasks 提交即返 taskId → GET {base}/t1/{face}/tasks/{id}
 * 短请求轮询至终态——工具不再对网关长挂单请求(旧同步径的断连/超时丢结果
 * 形态就此拆除:预算耗尽/中断时 taskId 在手,产出可找回,服务端照跑照扣不亏)。
 *
 * 兼容:旧版生产无任务端点——提交径 404 即判「路由缺席」返回 fallback_sync,
 * 调用方回落旧同步径(行为与 0.4.1 逐字同款)并缓存判定(每会话仅探测一次)。
 * 404 恒只可能是路由缺席:任务端点在场时提交拒绝恒为 400/401/402/403/429/5xx
 * (预备链校验错在提交响应即时可见,恒不产 404)。
 *
 * 轮询纪律:间隔取服务端建议拍(提交/查询响应 pollIntervalMs;videogen 5s /
 * imagegen 2s,更密只耗网关 key 级限流额度不提速);瞬态失败(网络抖动/5xx)
 * 恒不弃任务(结果已在途,弃 = 白扣),续轮询至预算;401/403/404 系终局拒
 * (令牌过期/越权/任务窗外)即止。预算 = 工具声明 timeoutMs 减安全余量
 * (恒先于 kernel 执行器强杀返回,超时错误里 taskId 与找回径可达智能体)。
 */
/**
 * 媒体面词表(URL 模板 `/t1/${face}/tasks` 自动跟随):图像 / 视频 + 音频两面
 * `asr`(语音转文字)/ `tts`(文字转语音)——音频不是「一个面的两种参数」,
 * ASR 与 TTS 各为独立面(输入输出模态相反、计量量纲不同),任务径
 * `/t1/{asr,tts}/tasks[/:id]` 与 imagegen 同构。
 */
type MediaTaskFace = 'videogen' | 'imagegen' | 'asr' | 'tts';

/**
 * 平台媒体错误 hint 单源表:四面提供方(imagegen / videogen / speech-to-text / text-to-speech)的网关
 * 错误码 → 修复指引,一码一行。
 * - **单源**:四面表并在此,受众差异只在 `forbidden` / `insufficient_balance` / `model_not_authorized`
 *   三码(其余码两档同文);
 * - **受众**:`'app'`(sdk 令牌档 / serve 平台内置形,缺省:App 开发者口径,如「console → app → capabilities」)/
 *   `'user'`(cli 登录态装置键径:钱包 / 平台管理员口径,恒不出现「app developer」);
 * - **词表外 → `undefined`**:kernel `formatMediaProviderError` 对 `hint === undefined` 回落 `MEDIA_GENERIC_HINT`
 *   (与 BYO 径同律);显式 `''` 仍 = 无指引(意外响应形保留)。
 * 文案纪律同 sdk errors.ts:英文、面向智能体(下一步做什么),不走 i18n。
 */

/** hint 受众档:app = App 开发者(sdk / serve 令牌档);user = 登录态终端用户(cli 装置键径) */
type MediaHintAudience = 'app' | 'user';
/** 面名词表 = 网关面(`/t1/<face>`;media-task-client 同源) */
type MediaHintFace = MediaTaskFace;
/**
 * 网关错误码 → 智能体可读修复指引(首空格 + 一句;kernel 拼接形 `<face> failed (<code>): <message>.<hint>`)。
 * 词表外 → `undefined`(kernel 回落通用指引)。`audience` 缺省 `'app'`(sdk / serve 文案逐字不变)。
 */
declare function hintFor(face: MediaHintFace, code: string, audience?: MediaHintAudience): string | undefined;

/**
 * 平台媒体提供方公共径:四面 ImageGen / VideoGen / SpeechToText / TextToSpeech 平台提供方共用的
 * 网关调用壳。
 *
 * 切法(先例 websearch-provider.ts):工具骨架(参数 schema / 描述装配 / 超时 / 错误纪律 / data 组装)
 * 在 kernel 环2 `tools/media`,sdk 只供**执行后端** = kernel 四提供方缝的平台实现(name 'tansr')。
 * 本模块承担四面同律的网关径,面差(URL 面名 / 轮询拍 / hint 表 / 找回径尾注 / 中断主语)由
 * `PlatformMediaFace` 描述,四个 `*-provider.ts` 只做 args → payload 与响应体 → Outcome。
 *
 * 网关径:
 * - 任务径先行:POST {base}/t1/{face}/tasks 提交即返 taskId → 短请求轮询至终态(media-task-client);
 *   旧版生产无任务端点(404)自动回落 POST {base}/t1/{face} 同步径,判定按提供方实例(= 工具实例
 *   = 会话)缓存,不再逐次探测;
 * - 预算 = `timeoutMs`(与工具 Tool.timeoutMs 同值;薄封装同源传入),任务径内扣安全余量得轮询
 *   截止——恒先于 kernel 骨架 withTimeout / 执行器强杀返回,`task_pending` 携 taskId 与找回径可达
 *   智能体(服务端照跑照扣,断连不亏)。
 *
 * 错误纪律(kernel MediaProviderError 契约):网关错误信封 / 任务失败终态 → `MediaProviderError{ code,
 * message, hint, taskId }`(码逐字透传;hint = `options.hintOf?.(code) ?? hintFor(face, code, audience)`——
 * 单源表 `media-hints.ts`,受众档 `audience` 缺省 `'app'`;**词表外码 → `undefined`** 让 kernel 回落
 * 通用指引,与 BYO 径同律);预算耗尽 → `task_pending` + taskId;中断而 taskId 在手 → `aborted` +
 * taskId + 找回径;提交前中断 → AbortError 原样上抛(骨架按信号 reason 归 timeout / aborted);
 * 网络失败 → 普通 Error(骨架归 `provider_error`)。令牌本体只活在闭包。
 *
 * 鉴权承载:`token` 在场 → 任务径提交 / 轮询与同步径三处请求头恒携 `x-tansr-app-token`(SDK 令牌档);
 * `token` 缺席 → **不发该头**,鉴权全由注入的 `fetchImpl` 承载(cli 装置键径 = tansrFetch AK/SK 双头 +
 * /t1 签名三头)。除头之外一切(任务径先行 / 404 回落 / 信封归一 / hint 表)两径逐字同款。
 */

/** 平台提供方名(kernel 提供方缝 `name`;进审计与描述装配,恒不进 ToolResult.data)。 */
declare const PLATFORM_MEDIA_PROVIDER_NAME = "tansr";
/** 四面平台提供方共用材料(`models` 位由各面选项追加)。 */
interface PlatformMediaProviderOptions {
    /** 平台 API 基址(/t1 前缀由本提供方追加)。 */
    baseUrl: string;
    /**
     * app_user 短期令牌(只活在本闭包,恒不进工具定义/日志)。缺席 = 不发 `x-tansr-app-token` 头,
     * 鉴权由注入的 `fetchImpl` 承载(cli 装置键径:tansrFetch 双头 + /t1 签名三头)。
     */
    token?: string;
    /** fetch 注入缝(测试桩网关;缺省全局 fetch)。 */
    fetchImpl?: typeof fetch;
    /**
     * 客户端预算(毫秒;= 工具声明 timeoutMs,薄封装同源传入):任务径内扣安全余量得轮询截止,
     * 恒先于骨架超时返回 `task_pending` 携 taskId。缺省各面 *_TOOL_TIMEOUT_MS。
     */
    timeoutMs?: number;
    /**
     * 错误 hint 受众档——`'app'`(缺省;sdk 令牌档 / serve 平台内置形:App 开发者口径)/
     * `'user'`(cli 登录态装置键径:钱包 / 平台管理员口径,恒不出现「app developer」)。单源表 `media-hints.ts hintFor`。
     */
    audience?: MediaHintAudience;
    /**
     * hint 覆写缝——按码返回指引即用之(`''` = 显式无指引);返回 `undefined` 回落单源表;表外仍 `undefined`
     * → kernel 通用指引。宿主(cli 活性门 / 自建提供方)按需覆写个别码,不必复制整表。
     */
    hintOf?: (code: string) => string | undefined;
}

/** `createPlatformSpeechToTextProvider` 的材料:公共网关材料 + 授权 ASR 模型集 */
interface CreatePlatformSpeechToTextProviderOptions extends PlatformMediaProviderOptions {
    /**
     * 授权 ASR 模型集(bundle platformModels.speechToText,装配循环自取):骨架描述自列(顺位第一 =
     * model 缺省生效模型),constraints 在场时逐模型拼受理约束注记(格式/时长帽/语种/说话人分离);
     * 空数组 = 平台未配置(如实注明,恒不猜名);缺席 = 集未知,描述回落通用指引。
     */
    models?: readonly AppBundleSpeechToTextModel[];
}
/**
 * 成功体归一(网关 /t1/asr 响应形 → TranscriptData;同步端点响应体与异步任务 result 同形,双径
 * 共用;serve /v2 直连端点与 session.platform.transcribe 亦经此单点)。`text` 非串 = 意外响应 →
 * null(调用方按结构化错误处置)。坏分段逐条剔除;计量/售价位(usage/cost/currency)刻意不进
 * Data 形——端侧恒无金额。
 */
declare function parseTranscriptData(raw: unknown, modelRef: string, taskId?: string): TranscriptData | null;
/** 平台语音转文字提供方(kernel SpeechToTextProvider 契约;一枚实例 = 一枚工具 = 一个会话)。 */
declare function createPlatformSpeechToTextProvider(options: CreatePlatformSpeechToTextProviderOptions): SpeechToTextProvider;

/** 平台工具材料(与平台提供方选项同形;`timeoutMs` 缺省 SPEECH_TO_TEXT_TOOL_TIMEOUT_MS;`token` 本层恒必填)。 */
type CreateSpeechToTextToolOptions = CreatePlatformSpeechToTextProviderOptions & {
    token: string;
};
/**
 * 环3 平台语音转文字工具 = kernel SpeechToText 骨架 + 平台提供方(name 'tansr')。计费副作用真实
 * 存在(按音频秒/音频 token 扣 App 余额)——骨架恒不声明只读/并发安全。
 */
declare function createSpeechToTextTool(options: CreateSpeechToTextToolOptions): Tool<SpeechToTextArgs>;

/** `createPlatformTextToSpeechProvider` 的材料:公共网关材料 + 授权 TTS 模型集 */
interface CreatePlatformTextToSpeechProviderOptions extends PlatformMediaProviderOptions {
    /**
     * 授权 TTS 模型集(bundle platformModels.textToSpeech,装配循环自取):骨架描述自列(顺位第一 =
     * model 缺省生效模型),constraints 在场时逐模型拼音色表/格式/字数帽注记;空数组 = 平台未配置
     * (如实注明,恒不猜名);缺席 = 集未知。
     */
    models?: readonly AppBundleTextToSpeechModel[];
}
/**
 * 成功体归一(网关 /t1/tts 响应形 → SpeechData;同步端点响应体与异步任务 result 同形,双径共用;
 * serve /v2 直连端点与 session.platform.speak 亦经此单点)。`audio` 缺 mime 或 url/b64 皆缺 = 意外
 * 响应 → null;`format` 缺席自 mime 推导(audio/mpeg → mpeg)。计量/售价位(cost/currency/
 * outputHosting)刻意不进 Data 形——端侧恒无金额。
 */
declare function parseSpeechData(raw: unknown, modelRef: string, taskId?: string): SpeechData | null;
/** 平台文字转语音提供方(kernel TextToSpeechProvider 契约;一枚实例 = 一枚工具 = 一个会话)。 */
declare function createPlatformTextToSpeechProvider(options: CreatePlatformTextToSpeechProviderOptions): TextToSpeechProvider;

/** 平台工具材料(与平台提供方选项同形;`timeoutMs` 缺省 TEXT_TO_SPEECH_TOOL_TIMEOUT_MS;`token` 本层恒必填)。 */
type CreateTextToSpeechToolOptions = CreatePlatformTextToSpeechProviderOptions & {
    token: string;
};
/**
 * 环3 平台文字转语音工具 = kernel TextToSpeech 骨架 + 平台提供方(name 'tansr')。计费副作用真实
 * 存在(按字符扣 App 余额)——骨架恒不声明只读/并发安全。
 */
declare function createTextToSpeechTool(options: CreateTextToSpeechToolOptions): Tool<TextToSpeechArgs>;

/**
 * 平台音频直连客户端:
 * `session.platform.transcribe(...)` / `session.platform.speak(...)` 的实现件——
 * **纯 HTTP 客户端**,经令牌档材料(baseUrl / token / fetchImpl,与环3 工具的
 * PlatformToolContext 同源)直打 `POST {baseUrl}/t1/asr` / `POST {baseUrl}/t1/tts`,
 * **不进会话历史、不进事件流**(App 自决是否把转写文本作为下一条用户输入、是否
 * 把助手回复送去合成播放)。
 *
 * 为何与环3 工具并立:图像/视频只有工具链,因为它们是「智能体产出」;语音天然
 * 是**用户输入 / 助手输出的载体**——只有工具链会把「说一句话」变成一次智能体工具调用
 * (既慢又贵),直连是开发者需求优先的直接答案。
 *
 * 错误语义(与工具「恒不 throw」刻意相反,是 HTTP 直连的进程内类比):网关拒绝 /
 * 请求未达平台恒 **throw PlatformRequestError**(TansrSdkError 子类,code
 * `platform_request_failed`,携 `status` / `platformCode` / `platformMessage`)——直连的
 * 产物就是文本 / 音频本体,以「空转写 + errorCode」回给调用方极易被误用(把空串当
 * 输入发出去),抛错逼迫处理;成功形归一为 TranscriptData / SpeechData(与工具 data
 * 形同型同源解析,计量/售价位不进形——端侧恒无金额)。
 *
 * 径:直连恒走同步端点(不走任务径)——交互式语音 UX(麦克风 → 文本 / 回复 →
 * 播放)以最低时延为要;长音频异步转写候后批。
 *
 * serve /v2 直连端点复用本文件的 `requestPlatformAudio`(状态码 + 体
 * 透传)与两工具模块的 parse 单点,三处(工具 / SDK 直连 / serve 代打)一形。
 */

/** 音频两面(MediaTaskFace 子集;URL = `/t1/${face}`) */
type PlatformAudioFace = Extract<MediaTaskFace, 'asr' | 'tts'>;
/** 直连 transcribe 入参(与网关 POST /t1/asr 请求体同形;audio = data:audio/*;base64 URI 或 http(s) URL) */
interface TranscribeInput {
    audio: string;
    /** 缺席 = 授权集顺位第一(与工具 / 网关同律) */
    model?: string;
    language?: string;
    /** 说话人分离(仅 diarize 家族受理;不受理 → 网关 400 bad_request 可解释) */
    diarize?: boolean;
    /** 领域提示(可选) */
    prompt?: string;
}
/** 直连 speak 入参(与网关 POST /t1/tts 请求体同形) */
interface SpeakInput {
    input: string;
    model?: string;
    /** 缺席 = 面档 defaultVoice;非面档音色 → 网关 400(列出可选音色) */
    voice?: string;
    format?: 'wav' | 'mp3';
    speed?: number;
}
/** 直连单次调用的可选项 */
interface PlatformAudioCallOptions {
    /** 中断信号(App 取消录音上传 / 停止播放请求) */
    signal?: AbortSignal;
}
/** 令牌档平台直连面(AgentSession.platform 挂载点) */
interface PlatformAudioClient {
    /** 语音转文字:POST /t1/asr → TranscriptData;失败 throw PlatformRequestError */
    transcribe(input: TranscribeInput, options?: PlatformAudioCallOptions): Promise<TranscriptData>;
    /** 文字转语音:POST /t1/tts → SpeechData(audio 恒在场);失败 throw PlatformRequestError */
    speak(input: SpeakInput, options?: PlatformAudioCallOptions): Promise<SpeechData>;
}
/** `createPlatformAudioClient` 的材料:平台基址、app_user 令牌与可选 fetch 注入 */
interface CreatePlatformAudioClientOptions {
    /** 平台 API 基址(/t1 前缀由本客户端追加) */
    baseUrl: string;
    /** app_user 短期令牌(只活在闭包;serve 代打径喂占位哑值、由刷新 fetch 覆写头) */
    token: string;
    /** fetch 注入缝(测试桩网关 / serve 刷新 fetch;缺省全局 fetch) */
    fetchImpl?: typeof fetch;
}
/**
 * 平台直连请求失败(code `platform_request_failed`):`status` = 网关 HTTP 状态
 * (0 = 请求未达平台,网络错);`platformCode` = 网关错误码(音频两端点的错误码族:
 * asr_not_configured / tts_not_configured / *_quota_exceeded / model_not_authorized /
 * bad_request / upstream_error / forbidden …;非 JSON 体降级 `http_<status>`;网络错
 * `network_error`);`platformMessage` = 网关人话(或网络错 message)。
 */
declare class PlatformRequestError extends TansrSdkError {
    readonly status: number;
    readonly platformCode: string;
    readonly platformMessage: string;
    constructor(face: PlatformAudioFace, status: number, platformCode: string, platformMessage: string, cause?: unknown);
}
/** 网关往返结果(serve 代打径透传用;恒不 throw) */
type PlatformAudioResponse = {
    readonly kind: 'response';
    readonly status: number;
    readonly body: unknown;
} | {
    readonly kind: 'transport_error';
    readonly message: string;
};
/** `requestPlatformAudio` 的入参:基址、面(asr / tts)、已白名单化的请求体与鉴权头值 */
interface RequestPlatformAudioOptions {
    baseUrl: string;
    face: PlatformAudioFace;
    /** 请求体(与对应网关端点请求体同形;调用方已白名单化) */
    payload: unknown;
    /** 鉴权头值(app_user 令牌;serve 径可为占位哑值——刷新 fetch 后写胜) */
    token: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
}
/**
 * 同步端点一次往返:POST {baseUrl}/t1/{asr|tts},JSON 进 JSON 出;体解析失败按 null
 * (调用方以 http_<status> 兜底);网络错归一 transport_error。恒不 throw。
 */
declare function requestPlatformAudio(options: RequestPlatformAudioOptions): Promise<PlatformAudioResponse>;
/** 网关错误信封 → 稳定码 + 人话(工具 gatewayError 同形;serve 透传径同用) */
declare function platformErrorOf(body: unknown, status: number): {
    code: string;
    message: string;
};
/** 令牌档直连客户端(createSession 令牌档在 AgentSession.platform 挂载;亦可独立构造) */
declare function createPlatformAudioClient(options: CreatePlatformAudioClientOptions): PlatformAudioClient;
/**
 * 托管 / 注入档的 fail-fast 占位(imageGen 工具选择同律:静默缺面无人知因):
 * 两方法恒抛 invalid_options 指引改用令牌档。
 */
declare function createUnavailablePlatformAudioClient(): PlatformAudioClient;

/**
 * 历史分页公共件(消息索引口径:offset =
 * IRMessage[] 下标,limit = 至少返回的消息数;不暴露段/游标/manifest)。
 *
 * - `sliceHistoryPage`:全量消息上的分页切片,经 alignHistoryPage 配对边界对齐——
 *   AgentSession.history() 活跃径、file-store 整卷已装载径、readHistoryPage 回落径三处
 *   同一实现(serve v2 活跃会话 historySnapshot 切片可直接复用);
 * - `readHistoryPage`:**休眠会话**(未起 AgentSession)的分页读——store.getHistoryPage
 *   在场即用(createFileSessionStore = 段清单跳读),缺席回落 `get` 全量切片(自建
 *   store 只实现五方法即可享有同一读面)。
 *
 * 缺省语义:offset 缺省 0;limit 缺省 = 全量(与 messages()/get 字节等价);limit 0 =
 * 只取 total;offset ≥ total → 空页且 offset 回填 total。
 */

/** history()/readHistoryPage 选项(消息索引口径) */
interface HistoryPageOptions {
    /** 起始消息下标(缺省 0;非负整数,越界 → 空页) */
    offset?: number;
    /** 至少返回的消息数(缺省全量;0 = 只取 total;为凑齐工具轮可多返回) */
    limit?: number;
}
/** history()/readHistoryPage/getHistoryPage 结果(配对完整的切片 + 分页游标) */
interface HistoryPage {
    /** 配对完整的切片(两端皆干净边界) */
    messages: IRMessage[];
    /** 全量消息数 */
    total: number;
    /** 切片首元素的绝对下标(≤ 请求 offset;向前对齐时回填对齐后的值) */
    offset: number;
    /** 下一页起点(原始下标空间 = 对齐后终点;空页 = 回填的 offset)。翻页恒用它推进——出流投影可能剔除页内消息,offset + messages.length 不可靠 */
    nextOffset: number;
}
/**
 * 全量消息上的分页切片(配对边界对齐)。limit 缺席 = 到末尾;序列自身不自包含(源历史
 * 含孤儿 tool_result,只可能来自损坏/外部写入)时退原样窗口——分页不修历史。
 */
declare function sliceHistoryPage(messages: readonly IRMessage[], offset: number, limit: number | undefined): HistoryPage;
/**
 * 休眠会话分页读:store.getHistoryPage 在场且 limit 给定 → 交给 store(段跳读);
 * 否则 `get` 全量后切片(limit 缺席 = 全量,本就要整卷)。会话不存在 → null。
 */
declare function readHistoryPage(store: SessionStore, sessionId: string, options?: HistoryPageOptions): Promise<HistoryPage | null>;

/**
 * `createSession` 的选项。三档模型来源互斥:令牌档(`token` + `baseUrl`,模型与能力位由平台 bundle 供给)/
 * 托管档(`model` 为别名字符串,五层配置装配)/ 注入档(`client` + `model` 对象,零配置零 IO);
 * 其余为工具与权限、会话参数、持久化与快照 / 恢复 / fork 三组可选项。
 */
interface CreateSessionOptions {
    /** Actual user input incorporation; not acceptance or a new turn. */
    onInputsConsumed?: (texts: readonly string[]) => void;
    /**
     * 模型档(三档判定):
     * - 字符串(别名/ref)→ 托管模式(五层配置)或令牌模式(bundle 别名,
     *   token 在场时);缺省 'main';
     * - ResolvedModel 对象 → 注入模式,必须与 client 成对提供。
     */
    model?: string | ResolvedModel;
    /** 注入模式的模型客户端(与 model 对象成对;测试传 scripted client) */
    client?: ModelClient;
    /** 注入模式的上下文窗口(托管模式自 capability.maxContext 取,忽略本值) */
    contextWindowTokens?: number;
    /** 注入模式的输出上限(maxTokens 事前钳制上界;托管模式自 capability.maxOutput 取,忽略本值) */
    maxOutputTokens?: number;
    /**
     * app_user 短期令牌(开发者服务端换发;终端分发形态)。在场即令牌档:
     * 模型与能力位由平台 bundle 供给,恒零本地配置 IO(config/loadOptions/
     * capabilities 均不可同给)。
     */
    token?: string;
    /** 平台 API 基址(令牌档必填,如 https://api.example.com) */
    baseUrl?: string;
    /**
     * 平台提示帧承接(仅令牌档产生;其余档恒不触发)。平台以 t.warn 结构化告知非致命降级
     * (如 thinking_unavailable_on_face:思考被请求而当前供应商面无从外露,回答照常仅无思考;
     * balance_low:余额预警)。缺席时缺省承接 = console.warn 每码一次(告知恒不静默蒸发);
     * 提供回调即全量接管(不去重,原始帧逐一交付,呈现策略归开发者)。
     */
    onPlatformWarning?: (warning: PlatformWarning) => void;
    /**
     * 通用告警通道:平台提示帧(`source:'platform'`,与 onPlatformWarning 同源同 code)与 SDK 自身非致命提示
     * (`source:'sdk'`:`cwd_mismatch_on_restore` / `cwd_mismatch_on_resume`)统一汇入。与 onPlatformWarning
     * 同给时平台告警各到一次不重复(后者是已发版的平台子集通道,恒不收 sdk 源)。缺席时:平台源按
     * onPlatformWarning / console.warn 现状回落;sdk 源回落为 `turn.error{scope:'sdk.notice',
     * recoverable:true}` 入事件流(提示不丢)。
     */
    onWarning?: (warning: SdkWarning) => void;
    /**
     * 权限终局审计记录出口(kernel `onDecision` 缝;`ToolDecisionRecord` 与 cli `decisions.jsonl` 行同形,
     * 含机器放行 classifier / mode)。缺省:裁决人终局(source 'classifier')经 `onWarning` / `onPlatformWarning`
     * 通报 `permission_decided`;传自己的写入器即接管,传 `() => {}` 静默。事件流本身已携
     * `tool.permission.decided{allow|deny, decisionSource}`(含机器放行),本缝是审计半边。
     */
    onDecision?: (record: ToolDecisionRecord) => void;
    /** 项目层配置发现起点与工具 cwd;缺省 process.cwd() */
    cwd?: string;
    /** 环境变量注入缝;缺省 process.env */
    env?: Record<string, string | undefined>;
    /** fetch 注入缝(透传协议适配器) */
    fetchImpl?: typeof fetch;
    /** 已装载配置注入缝:提供时跳过 loadConfig */
    config?: LoadedConfig;
    /** loadConfig 其余注入缝(fs/homedir/platform;测试 hermetic 用) */
    loadOptions?: Omit<LoadConfigOptions, 'cwd' | 'env'>;
    /**
     * 三环工具入口:builtin(环2 内置,词表逐名)/ platform(环3 平台能力,现只校验位)/ custom
     * (环1 defineTool 产物)。缺席 = 装配能力位放行的全部内置工具;`tools: { builtin: [] }` = 零内置。
     */
    tools?: SdkToolsOptions;
    /** 能力位档;缺省 DEFAULT_APP_CAPABILITIES(令牌档由 bundle 供给) */
    capabilities?: AppCapabilities;
    /**
     * skills 注入:custom(defineSkill 内联)+ dirs(<name>/SKILL.md 目录)。SDK 恒零发现
     * (不扫 ~/.tansr 与 cwd);受 skills 能力位。
     */
    skills?: SdkSkillsOptions;
    /**
     * MCP 外接:McpHost 实例 = 应用级共享(跨会话复用连接,生命周期归调用方 dispose);
     * { servers } 选项对象 = 会话级临时 host,会话 close 时自动断连收口。受 mcp 能力位。
     */
    mcp?: McpSessionOption;
    /** AskUser 工具交互通道;缺省 UnavailableChannel(结构化降级,不挂起) */
    promptChannel?: PromptChannel;
    permission?: PermissionOptions;
    /**
     * 裁决人(仅令牌档):bundle 生效裁决人档缺省即装配——「本应 ask」的工具调用先经裁决人:判危险按姿态落地
     * (人在环 → 经 permission.askUser 携理由交用户终审;无人环 → deny 理由回喂模型),判安全且资格半径覆盖 →
     * 放行,缺省安全的操作恒不送裁决人。姿态缺省按 askUser 在场推导;`enabled:false` 回到 default 模式现状;
     * 与 permission.mode 同现 fail-fast。托管/注入档无任命来源,传本位 fail-fast。
     */
    adjudication?: AdjudicationOptions;
    /** 业务提示词：平台 fallback 策略下显式值（含 []）覆盖；prepend 策略保留平台段在前。SDK 段创建时固定；平台正文和策略在每个新轮前自动刷新。 */
    system?: IRSystemSegment[];
    /** 业务段选定后追加的宿主指南，不触发平台默认覆盖；权限与工具指南仍独立装配。 */
    systemAppend?: IRSystemSegment[];
    /** 缺省 8192 */
    maxTokens?: number;
    /**
     * 思考生成(**生成面**旋钮;呈现面走 SessionView 的 delivery 选项,两旋钮
     * 正交):逐轮透传 IRRequest.thinking(budget = 思考 token 预算,按模型
     * 方言映射)。缺省缺席 = 不注入(沿模型/适配器缺省,多数模型即不产思考)。
     * 会话中可经 setThinking 动态换,下一轮生效。
     */
    thinking?: {
        budget?: number;
    };
    /** 单轮 modelTurns 护栏;缺省 200(与 serve 对齐) */
    maxTurnsPerQuery?: number;
    /** 缺省 randomUUID() */
    sessionId?: string;
    /** 会话级中断信号:abort 即 close(运行中轮先优雅中止,尾部事件不丢) */
    signal?: AbortSignal;
    /**
     * 上下文压缩(kernel 自动压缩):缺省 {}(自动压缩,仅上下文窗口已知的轮生效——阈值代数依赖窗口,
     * 与 TUI/serve 同守卫);false 显式禁用。
     */
    compaction?: QueryCompactionOptions | false;
    /** 历史预载(恢复场景):后续轮以「预载历史 + 新 user 消息」起步 */
    initialMessages?: readonly IRMessage[];
    /**
     * 可注入持久化缝(形态对齐 cli 的 onHistoryCommit):每轮终态收口(历史快照已就位)
     * 时捕获全量历史深拷贝，按会话提交顺序回调，存到哪由开发者决定。缺省缺席 = 纯内存
     * 零变化(SDK 恒不引入任何隐式落盘)。
     * meta.rewritten:本轮历史前缀被就地改写(session.compacted 压缩折叠,
     * 或 session.microcompacted 旧 tool_result 原位存根化——SDK 无 CLI 的
     * journal 存根重演机制,对落盘方两者同为「已存内容不再与内存对齐」),
     * 落盘方不得按长度增量追加,须整卷轮换。
     * 回调抛错(含异步 reject)恒不破会话主流程:吞错并合成
     * turn.error(scope='sdk.persistence')入事件流;事件流已终结时退化
     * console.warn(错误不静默消失)。rewritten 提交失败后,下一次提交恒再以 rewritten:true 交付
     * (存储与回调独立内存位),落盘方不会只凭「本轮无改写」走增量径而留下「旧前缀 + 新尾巴」拼接体。
     * idle()/session.ended 仍不等异步提交；需要真实完成使用 drain()/closeAsync()。
     * 回调中不得等待本会话 drain()，否则会等待回调自身；retryPersistence 不重放回调。
     */
    onHistoryCommit?: (history: readonly IRMessage[], meta: HistoryCommitMeta) => void | Promise<void>;
    /**
     * 一等恢复:自 store 取回历史与 meta 预载(与 initialMessages 互斥;
     * sessionId 同给时必须与 resume.sessionId 一致)。resume 径内置配对治理
     * (`repairHistoryPairing`):断尾 tool_call 补 isError 占位、孤儿
     * tool_result 截断到干净边界——kernel 对 initialMessages 原样收不校验,
     * 治理保证 wire 恒不 400。目标不存在抛 TansrSdkError('session_not_found');
     * 存储损坏由 store.get 结构化上抛(恒不静默)。
     */
    resume?: {
        sessionId: string;
        store: SessionStore;
    };
    /**
     * 在场时自动接管会话登记(store.create,幂等;令牌档的平台会话 ULID
     * 映射随登记落 SessionRecordMeta)与每轮落卷(store.commit;
     * store 先行、onHistoryCommit 回调后行,失败面同 sdk.persistence 吞错
     * 纪律)。与 resume 正交:续存一个恢复的会话把同一 store 同时传两处。
     * 缺席 = 纯内存零变化(SDK 恒不引入任何隐式落盘)。
     */
    store?: SessionStore;
    /**
     * 上下文快照:完整上下文的自包含只读拷贝,可列举 / 可恢复 / 可删除。落点三选一:`store`
     * (自建 CheckpointStore)> `dir`(独立目录,独立生命周期)> 缺省同居——会话 `store` 自带的
     * `checkpoints`(createFileSessionStore = <sessionDir>/checkpoints,随会话删除)。三者皆缺 =
     * 快照未接线:checkpoint()/listCheckpoints()/deleteCheckpoint() 抛 `checkpoints_not_wired`,
     * restore() 返回 `rejected:'store_not_wired'`,compact() 缺省不落快照(显式 `checkpoint:true` 才抛)。
     */
    checkpoints?: SessionCheckpointOptions;
    /**
     * fork 快捷形 = `fork()` + `resume`:以 `store` 里源会话 `sessionId` 的快照 `checkpointId` 建出新会话
     * 记录(源会话零改动)并立即打开它;新会话事件流紧随 session.created 签发
     * `session.forked{ sourceSessionId, checkpointId, sessionId }`。
     * 须与 `store` 同给(新会话落在该 store);与 `resume` / `initialMessages` 互斥(同给 fail-fast
     * `invalid_options`,先于任何 IO);`sessionId` 同给时 = 新会话 id。快照经与 `checkpoints`
     * 选项同一落点解析读取(store > dir > 会话 store 同居);快照不存在抛 `checkpoint_not_found`。
     */
    fork?: {
        sessionId: string;
        checkpointId: string;
    };
}
/** createSession.checkpoints 选项(缺省值随注) */
interface SessionCheckpointOptions {
    /** 自建快照存储(与 dir 互斥;同给抛 invalid_options) */
    store?: CheckpointStore;
    /** 独立快照根目录(createFileCheckpointStore({ dir });与 store 互斥) */
    dir?: string;
    /** compact()/自动压缩前自动落 pre_compaction 快照;缺省 true */
    autoBeforeCompact?: boolean;
    /**
     * 历史清空前自动落 pre_clear 快照;缺省 true。**预留位**:AgentSession 当前无
     * 清空入口(TUI /clear 归 cli sink 自有钩子),本项在场只作类型/缺省登记。
     */
    autoBeforeClear?: boolean;
    /**
     * 同会话快照数上限;到顶按时间序淘汰最旧,不分 trigger(缺省不限)。= `retention.max`
     * 别名(同给时 `retention` 优先)。刚写入者恒保留(`max:0` 留 1)。
     */
    max?: number;
    /**
     * 保留策略(与 kernel `CheckpointRetention` 同形):`max` / `maxAgeDays` 并集,先按龄再按数;
     * store / dir / 同居三形态同一淘汰律(kernel `planCheckpointRetention`)。
     */
    retention?: CheckpointRetention;
}
/** onHistoryCommit 附带信息(落盘方决定增量追加还是整卷轮换) */
interface HistoryCommitMeta {
    /** true = 历史前缀被就地改写(压缩折叠/存根化),已存内容不再与之对齐 */
    readonly rewritten: boolean;
    /**
     * 改写原因(S-2 加法;rewritten=true 时可在场):compaction = 压缩折叠(compact()
     * 直压或轮内自动压缩)/ clear = 历史清空 / restore = 自快照恢复(restore())。
     * 缺席 = 非改写提交,或改写只来自 microcompact 存根化(不在本词表)。
     */
    readonly reason?: HistoryRewriteReason;
}
/** 历史改写原因词表(HistoryCommitMeta.reason / SessionStoreCommitMeta.reason 同形) */
type HistoryRewriteReason = 'compaction' | 'clear' | 'restore';
/** compact() 选项 */
interface CompactOptions {
    /** 用户附加摘要指令(追加在指令模板后,只调焦点) */
    instructions?: string;
    /**
     * 压缩前是否落 pre_compaction 快照:缺席 = 按 checkpoints.autoBeforeCompact
     * (缺省 true;快照未接线时缺省不落);false = 本次不落;true / { label } =
     * 落(未接线抛 checkpoints_not_wired,零副作用)。
     */
    checkpoint?: boolean | {
        label?: string;
    };
}
/** compact() 结果联合(compacted / rejected / failed;failed 形亦携失败前已落的快照 id) */
type CompactResult = {
    status: 'compacted';
    /** 压缩执行 id(与 session.compacted.compactionId / 摘要 meta.compactionId 同源) */
    compactionId: string;
    /** 被移除消息的 index 闭区间(压缩前坐标) */
    removedRange: [number, number];
    /** 压缩前快照 id(落了才在场) */
    checkpointId?: string;
} | {
    status: 'rejected';
    /**
     * turn_running = 运行中(不排队,await idle() 后重试)/ empty_history = 历史为空 /
     * not_configured = compaction:false 或上下文窗口未知 / hook_blocked = PreCompact
     * hook 否决(SDK 无查询 hooks 面,保留为联合成员)
     */
    reason: 'turn_running' | 'empty_history' | 'not_configured' | 'hook_blocked';
} | {
    status: 'failed';
    /** kernel 压缩失败原因(nothing_to_compact / model_error / before_compact_failed …) */
    reason: CompactionFailureReason;
    /** 失败前已落的快照不回滚,id 随结果交付 */
    checkpointId?: string;
};
/** checkpoint() 选项 */
interface CheckpointOptions {
    /** 开发者/用户标签(≤ 120 字) */
    label?: string;
}
/** restore() 选项 */
interface RestoreOptions {
    /** 恢复前是否先落 pre_restore 快照;缺省 true */
    checkpoint?: boolean;
}
/** restore() 结果联合(restored / rejected) */
type RestoreResult = {
    status: 'restored';
    checkpointId: string;
    /** 恢复前历史消息数 */
    fromMessages: number;
    /** 恢复后历史消息数(= 快照 messageCount) */
    toMessages: number;
    /** 恢复前自动落的 pre_restore 快照 id(options.checkpoint !== false 时在场) */
    preRestoreCheckpointId?: string;
} | {
    status: 'rejected';
    /**
     * turn_running = 运行中 / not_found = 本会话下无此快照 / session_mismatch = 快照
     * 属于别的会话(跨会话恢复 = 越界;请用 fork)/ store_not_wired = 快照存储未接线
     */
    reason: 'turn_running' | 'not_found' | 'session_mismatch' | 'store_not_wired';
};
/** fork() 选项 */
interface ForkOptions {
    /** 新会话标题(记入 store 会话 meta;缺省与建会同律取首条用户输入截断) */
    label?: string;
    /** 新会话工作目录(记入 store 会话 meta;缺省沿本会话 cwd) */
    cwd?: string;
}
/** fork() 结果:新会话 id(未打开;以 createSession({ resume: { sessionId, store } }) 打开) */
interface ForkResult {
    sessionId: string;
}
/** importCheckpoint() 选项 */
interface ImportCheckpointOptions {
    /** 标签覆写(≤ 120 字);缺席沿用导出体内 label */
    label?: string;
}
/** 装配期解析后的快照接线(AgentSession 持有;null = 未接线) */
interface ResolvedCheckpoints {
    readonly store: CheckpointStore;
    readonly autoBeforeCompact: boolean;
    readonly autoBeforeClear: boolean;
}
/**
 * setCwd() 结果联合:changed = 已切换(from/to 为切换前后的绝对路径;to 与 from 相同时
 * 亦回 changed,零副作用);rejected 四拒绝码沿 kernel resolveSessionCwd(not_absolute /
 * not_found / not_directory / not_allowed)+ turn_running(运行中不切、不排队)。
 */
type SetCwdResult = {
    status: 'changed';
    from: string;
    to: string;
} | {
    status: 'rejected';
    reason: 'turn_running' | 'not_absolute' | 'not_found' | 'not_directory' | 'not_allowed';
};
/** 会话当前模型档(client 与 model 恒成对;窗口/输出上限随组走) */
interface ModelBinding {
    client: ModelClient;
    model: ResolvedModel;
    contextWindowTokens?: number;
    /** capability.maxOutput(查询环事前钳制 maxTokens 的上界) */
    maxOutputTokens?: number;
}
/** setModel 的注入档参数(client 与 model 必须成对更换) */
interface SetModelBinding {
    client: ModelClient;
    model: ResolvedModel;
    /** 新模型的上下文窗口;不传则清空(宁缺毋错,与 TUI 驱动同语义) */
    contextWindowTokens?: number;
    /** 新模型的输出上限(maxTokens 事前钳制上界);不传则清空(同窗口的宁缺毋错纪律) */
    maxOutputTokens?: number;
}
/** AgentSession 构造参数(createSession 装配产物;不对外) */
interface AgentSessionInit {
    binding: ModelBinding;
    executor: ToolExecutor;
    system: IRSystemSegment[];
    applicationPrompt?: ApplicationPromptInfo;
    prepareApplicationPrompt?: (signal: AbortSignal) => Promise<{
        system: IRSystemSegment[];
        info: ApplicationPromptInfo;
    }>;
    tools: IRToolDef[];
    cwd: string;
    sessionId: string;
    maxTokens: number;
    thinking: {
        budget?: number;
    } | undefined;
    maxTurnsPerQuery: number;
    compaction: QueryCompactionOptions | undefined;
    initialMessages: readonly IRMessage[];
    /** 托管/令牌模式的 registry(setModel 字符串档);注入模式为 null */
    registry: ProviderRegistry | null;
    onHistoryCommit: ((history: readonly IRMessage[], meta: HistoryCommitMeta) => void | Promise<void>) | undefined;
    /** 会话收口回调(session.ended 后调用;临时 MCP host dispose 等) */
    onEnded?: () => Promise<void>;
    ownedResources?: OwnedResources;
    /** 快照接线(装配期解析;null = 未接线) */
    checkpoints: ResolvedCheckpoints | null;
    /** 轮起跑回调(裁决人 transcript 记录器回填当前轮用户 prompt) */
    onTurnStart?: (prompts: readonly string[]) => void;
    onInputsConsumed?: (texts: readonly string[]) => void;
    /**
     * 按新 cwd 重建执行器(装配层 rebindCwd:权限门 / hooks 同步换新,registry 与
     * 会话级执行态共享);setCwd 成功即以返回值替换 #executor。
     */
    rebindCwd: (cwd: string) => ToolExecutor;
    /**
     * cwd 切换落盘缝(store.recordCwdChange 在场时由 createSession 接线;缺席 = 不落盘)。
     * 失败按 sdk.persistence 吞错纪律入事件流,恒不破切换本身。
     */
    onCwdChanged?: (change: SessionCwdChange) => void | Promise<void>;
    /** 告警通道(createSdkWarningChannel 产物;sdk 源提示经此汇入 onWarning 或回落 sdk.notice) */
    warn: (warning: SdkWarning) => void;
    hasWarningHandler?: boolean;
    /** 会话存储(fork() 安放新会话记录;缺席 = fork() 抛 session_store_not_wired) */
    store?: SessionStore;
    /**
     * 令牌档平台直连材料(与环3 工具 PlatformToolContext 同源:baseUrl / token / fetchImpl);
     * 在场即挂载 session.platform 直连客户端,缺席(托管/注入档)= fail-fast 占位
     * (调用即 invalid_options 指引令牌档,imageGen 工具选择同律)。
     */
    platformContext?: PlatformToolContext;
}
/**
 * 多轮会话句柄(纯 headless,无 UI;由 `createSession` 创建)。`send()` 提交输入(空闲起新轮,运行中经注入
 * 屏障并入下一轮),`events` 为可多消费者的会话事件流,`messages()` / `history()` 读历史快照;另提供
 * 手动压缩 / 快照 / 恢复 / fork、`setModel` / `setThinking` / `setCwd` 空闲期热切换、`interrupt()` 与幂等
 * `close()`。
 */
declare class AgentSession {
    #private;
    get applicationPrompt(): ApplicationPromptInfo;
    constructor(init: AgentSessionInit);
    get sessionId(): string;
    /**
     * 平台直连面(令牌档):`platform.transcribe({ audio, model?, language? })` /
     * `platform.speak({ input, voice?, model?, format? })`——纯 HTTP 客户端直打
     * `/t1/asr`、`/t1/tts`,**不进会话历史、不进事件流**(App 自决是否把转写作为下一条
     * 输入、是否播放合成音频);失败 throw PlatformRequestError(携网关错误码)。托管/
     * 注入档无平台连接:调用即 invalid_options 指引令牌档(fail-fast,恒不静默)。
     */
    get platform(): PlatformAudioClient;
    /**
     * 会话事件流(async iterable;**多消费者广播**,2026-09-02 起)。每次 for-await 即一个
     * 独立订阅者:SessionView 泵、Narrator、宿主自建循环可同时挂,各得全量事件、互不争抢;
     * 首订阅者收到会话创建以来的积压,晚订阅者自订阅点起。跨轮连续,close() 后以
     * session.ended 收尾并正常终结(各订阅者排空后 for-await 自然退出)。
     */
    get events(): AsyncIterable<KernelEvent>;
    /** 当前模型档快照 */
    currentModel(): ResolvedModel;
    running(): boolean;
    inputCapabilities(): SessionInputCapabilities;
    getInputTarget(): SessionInputTarget | null;
    submitInput(input: SessionInputSubmission): Promise<SessionInputResult>;
    getInputStatus(inputId: string, target: SessionInputTarget): SessionInputReceipt | null;
    /** 会话历史快照(深拷贝;可直接作恢复/续跑的 initialMessages) */
    messages(): IRMessage[];
    /**
     * 历史分页读:消息索引口径的 [offset, offset+limit) 切片,
     * 与 messages() 同一投影口径(同一份历史快照、同为深拷贝;运行中亦可读,返回轮起
     * 时的历史)。切片恒**配对完整**:起点向前对齐到干净边界并回填 `offset`,终点向后
     * 对齐(limit 是下限,为凑齐工具轮可多返回几条)。缺省全量 = 与 messages() 字节等价;
     * `limit: 0` 只取 total;offset 越界 → 空页且 offset 回填 total。休眠会话(未起
     * AgentSession)请用 readHistoryPage(store, sessionId, page)。
     */
    history(options?: HistoryPageOptions): Promise<HistoryPage>;
    /**
     * 提交输入:空闲起新轮;运行中经内核注入屏障(下一 assembling 前消费,
     * 自然终态未消费的旧注入结转为下一轮开场输入；中断/硬限制不结转)。close 后调用属编程错误,
     * 结构化 throw(不静默吞输入)。
     */
    send(prompt: string): void;
    /** 中断当前轮(优雅:事件流走到 turn.aborted);空闲/已关闭为无害空操作 */
    interrupt(): void;
    /**
     * 模型切换(对后续轮生效;运行中轮不受影响):
     * - 字符串(别名/ref):仅托管模式可用,经装配期 registry 重新解析构造
     *   (解析失败抛 TansrSdkError('assembly_failed'),会话状态不变);
     * - SetModelBinding:client 与 model 成对更换(跨 provider 时旧 client
     *   不可复用);contextWindowTokens 不传则清空(宁缺毋错)。
     */
    setModel(next: string | SetModelBinding): void;
    /**
     * 动态切换思考生成(生成面旋钮,setModel 同形制):下一轮生效,运行中轮
     * 不受影响。undefined = 回到不注入(模型缺省);呈现面(思考显示与否)
     * 走 SessionView delivery,两旋钮正交互不推导。
     */
    setThinking(thinking: {
        budget?: number;
    } | undefined): void;
    /**
     * 关闭会话(幂等):空闲立即收口(session.ended + 流终结);运行中先
     * abort,收口推迟到泵终态——中止轮的尾部事件(turn.aborted 等)不丢失。
     */
    close(): void;
    /** 排空当前轮(含结转连锁起的新轮)与空闲期操作链:close/断言前等待终态收口 */
    idle(): Promise<void>;
    /**
     * 手动压缩:对当前历史执行一次 manual 压缩,成功即就地替换历史、
     * 推 session.compacted / cost.usage.updated 事件、以 { rewritten:true, reason:
     * 'compaction' } 提交落盘。压缩前缺省先落 pre_compaction 快照(可关;快照 id 随
     * 结果与事件体交付);压缩失败快照保留。
     * - 运行中 → rejected:'turn_running'(不排队;await idle() 后重试——显式优于隐式);
     * - 历史为空 → rejected:'empty_history';compaction:false 或窗口未知 → 'not_configured';
     * - 并发 compact()/restore()/checkpoint() 按到达序串行;期间 send() 缓冲到操作链排空。
     * close 后调用 throw session_closed(编程错误,与 send 同律)。
     */
    compact(options?: CompactOptions): Promise<CompactResult>;
    /**
     * 手动快照(trigger='manual'):把当前完整历史写成自包含只读拷贝,返回头部 meta;
     * 落盘后推 session.checkpointed 事件。运行中 throw turn_running(历史归内核所有,
     * 空闲期快照才是完整上下文);未接线 throw checkpoints_not_wired。
     */
    checkpoint(options?: CheckpointOptions): Promise<CheckpointMeta>;
    /** 列举本会话全部快照头部(checkpointId 升序 = 时间线;只读,运行中亦可) */
    listCheckpoints(): Promise<CheckpointMeta[]>;
    /**
     * 自快照恢复(同会话就地换史):空闲校验 → 读快照 → sessionId
     * 对账 → (可选)pre_restore 快照 → 以快照 messages 替换历史(与 resume 预载同径:
     * 配对治理 + 深拷贝)→ 推 session.restored → { rewritten:true, reason:'restore' } 提交
     * 落盘(整卷轮换)。同一快照连续恢复两次,第二次历史字节等价、仍换卷(不做无变化
     * 短路,可解释优先)。快照 cwd ≠ 会话 cwd 时不改 cwd,推 turn.error(scope=
     * 'sdk.notice',recoverable)提示 cwd_mismatch_on_restore。
     */
    restore(checkpointId: string, options?: RestoreOptions): Promise<RestoreResult>;
    /** 删除本会话的一份快照(幂等);运行中 throw turn_running;未接线 throw checkpoints_not_wired */
    deleteCheckpoint(checkpointId: string): Promise<void>;
    /**
     * 自本会话的一份快照 fork 出**新会话**(源会话零改动;不隐式打开新会话——显式优于隐式):
     * 读快照 → `store.fork`(createFileSessionStore:kernel 原语,新卷首记录 kind='fork' +
     * meta.forkedFrom + 附件按 sha 复制;自建 store 缺该法回落 create + commit 全量历史)→ 返回
     * `{ sessionId }`,开发者随后 `createSession({ resume: { sessionId, store } })` 打开(或一步到位
     * 用 `createSession({ fork: { sessionId, checkpointId }, store })`)。`label` = 新会话标题、`cwd` =
     * 新会话工作目录(缺省沿本会话)。不签发事件(`session.forked` 在新会话首次打开时由快捷形签发)。
     * 失败面(结构化 throw):未接线快照 `checkpoints_not_wired` / 未给会话 store
     * `session_store_not_wired` / 快照不存在 `checkpoint_not_found` / close 后 `session_closed`。
     */
    fork(checkpointId: string, options?: ForkOptions): Promise<ForkResult>;
    /**
     * 导出本会话的一份快照为自包含字节(UTF-8 JSON `{ format:'tansr-checkpoint/1', checkpoint,
     * attachments: { [sha256]: base64 } }`;image 字节内联进 attachments,快照体以 $ref 引用)。
     * 只读,运行中 / close 后皆可(与 listCheckpoints 同律)。快照不存在 throw `checkpoint_not_found`。
     */
    exportCheckpoint(checkpointId: string): Promise<Uint8Array>;
    /**
     * 把 exportCheckpoint() 产物(本会话或他会话 / 他机导出)导入为**本会话**的一份新快照:
     * 校验 format / schema / 每附件 sha256 / 每 $ref 皆有附件 / 消息形(任一不过 throw
     * `checkpoint_import_invalid`,不落半成品;校验先于入队,零副作用)→ 身份改写(sessionId = 本会话;
     * checkpointId 重铸;trigger 'manual';createdAt 现时;label 覆写或沿用;cwd / model / tokens 沿用;
     * compactionId 剥除)→ `store.put` → 推 `session.checkpointed`(每次快照落盘皆签发)。
     * 不触本会话历史(导入的是快照,之后可 restore()/fork());close 后 throw `session_closed`。
     * put 入空闲期串行链——与 checkpoint / restore / deleteCheckpoint 同链按到达序执行(避免与删除的附件 GC
     * 并发造成共享附件误删);运行中的轮不受影响(本方法不触历史,链内不校验 turn_running)。
     */
    importCheckpoint(bytes: Uint8Array, options?: ImportCheckpointOptions): Promise<CheckpointMeta>;
    /**
     * 装配层合成事件入流(hooks emit / provider 切换 / todo 台账):包络本地
     * 补齐,seq 与内核事件共用同一会话计数器。内部使用;不属公开 API 面。
     */
    pushBody(body: EventBody, source: string): void;
    /** 等查询生成器实际收尾与提交；不得从本会话 history callback 内调用并等待。 */
    drain(options?: SessionDrainOptions): Promise<SessionDrainResult>;
    /** 信号/超时仅约束观察，逻辑 close 仍即时生效；非法选项在 close 前拒绝。 */
    closeAsync(options?: SessionDrainOptions): Promise<SessionDrainResult>;
    /** 会话当前工作目录(session.created.cwd 起,随 setCwd 改写) */
    cwd(): string;
    /**
     * 切换会话工作目录(空闲期;运行中 → rejected:'turn_running',不排队)。校验经 kernel
     * resolveSessionCwd(绝对 / 存在 / 目录;SDK 面由本机开发者亲手给出,恒等 resolve 策略——与
     * CLI `--cwd` 同律,不设白名单闸);通过即:按新 cwd 重建执行器 + 权限门 + PreToolUse hooks
     * (装配层 rebindCwd;registry / 已读文件表 / grep 聚合共享;权限引擎实例复用)→ 改写会话
     * cwd(快照 meta.cwd、恢复对账锚、Task 子代理 ToolContext.cwd 随之)→ 推 session.cwd_changed
     * {from,to} → 落盘 store.recordCwdChange(meta.cwd 改写 + cwdHistory 追加;缺席不落)。
     * 与 compact()/restore() 同一空闲期串行链(期间 send() 缓冲)。目标与当前相同:零副作用回
     * changed(不推事件、不落盘)。不重跑 loadConfig(项目层配置不随 cwd 变;已知限界,详见 SDK 技术手册)。
     */
    setCwd(dir: string): Promise<SetCwdResult>;
}
/**
 * 创建多轮会话。托管模式(model 为别名字符串)含异步配置装载;注入模式
 * (client + model 对象)零 IO——统一返回 Promise,调用方一律 await。
 * 装配失败以 TansrSdkError 结构化抛出(不 process.exit)。
 */
declare function createSession(options?: CreateSessionOptions): Promise<AgentSession>;

/** `createFileSessionStore` 的选项:存储根目录 + 可选封段阈值、冷层分层存储与可观测回调 */
interface CreateFileSessionStoreOptions {
    /** 存储根目录(显式传入,恒不隐式扫用户目录;Electron 场景传 userData) */
    dir: string;
    /**
     * 卷内动态封段阈值(缺省 16 MiB / 5000 记录)。缺席 = 按缺省
     * 阈值**启用**;`{ enabled: false }` = 恒单卷(旧布局)。只影响写侧文件布局:读侧
     * 汇合透明,无 manifest 的旧目录零迁移可读。
     */
    segmentation?: SegmentationOptions;
    /**
     * 冷层(server 份 `CreateServeAgentSessionStoreOptions.cold` 同名):一级
     * `SegmentBlobStore`(S3 / OSS / COS / MinIO / GCS / 文件系统 …:五个字节方法,引擎内置分段 / 编码 / 清单提交 /
     * 热盘 LRU / 重试)或二级 `SessionHistoryStore`(KV / 关系库自管布局)。**缺席 = 仅热层 = 今日行为字节等价**
     * (此时 `index` / `policy` / `metrics` 无效)。
     */
    cold?: SegmentBlobStore | SessionHistoryStore;
    /**
     * 多副本共享会话元 / 无条件写冷层的 CAS 落点。一级冷层 `capabilities.conditionalPut:false` 或
     * `list:'none'` 时**必填**,否则构造期 fail-fast 抛出。
     */
    index?: SessionIndexStore;
    /**
     * 分层策略(`codec` / `hotRetention` / `upload` / `restore` / `transform` / `keyMapper` / `tenant`);
     * 缺省见 kernel `SEGMENTED_STORE_DEFAULTS`。`hotRetention.maxBytes` 触顶 → `readiness()` 红 + `store.hot_full` 事件。
     */
    policy?: SegmentedStorePolicy;
    /** `tansr_kernel_store_*` 指标族注册表;缺省 kernel defaultMetrics */
    metrics?: MetricsRegistry;
    /** 冷层事件原样回调(`store.segment_sealed` / `store.segment_committed` / `store.commit_failed` / `store.hot_full` …);回调抛错被吞 */
    onStoreEvent?: (event: ColdTierEvent) => void;
    /**
     * 冷层**放弃**的上传 / 清单提交通报(重试预算耗尽的 transient、permanent、
     * precondition_failed)。热层已 ack,恒不抛给调用方——该段留在热盘、下次 bind 对账补传。回调抛错被吞。
     */
    onStoreError?: (sessionId: string, error: StoreError) => void;
    /**
     * store 核警告出口——`store_prefix_mismatch`(增量径前缀失配 → 已整卷轮换)/
     * `store_pending_rewrite`(上次 rewritten 提交未成 → 本次整卷轮换)。缺席静默(轮换本身恒执行,警告只为可观测)。
     */
    onStoreWarning?: (warning: SessionStoreCoreWarning) => void;
}
/** 单租户形态的冷层分域键(server 份为 sha256(endUserId) 前 16 hex) */
declare const LOCAL_END_USER_KEY = "local";

/**
 * 缺省文件实现工厂。目录布局(kernel journal 原语同款):
 *   <dir>/sessions/<sessionId>/{journal.jsonl, meta.json, lock, attachments/}
 *   <dir>/sessions/<sessionId>/checkpoints/<sessionId>/<checkpointId>.json(S-1 同居快照,
 *     经 `checkpoints` 成员暴露;随会话目录删除)
 *   <dir>/index.jsonl(SC-27 列表索引;缓存可删可重建)
 */
declare function createFileSessionStore(options: CreateFileSessionStoreOptions): SessionStore;

/**
 * SessionView 状态投影器(核心纯 reducer):KernelEvent 流 →
 * 可直接渲染的视图模型(渲染数据管道层1)。
 *
 * 设计不变量(恒守):
 * 1. 纯函数投影:reduce(state, event) => state,无第二事实源、无 IO;
 * 2. 零 node: 依赖、状态快照 structuredClone-safe(Electron IPC 直传,
 *    将来 webui 形态在浏览器侧复用同一投影器);
 * 3. 框架无关核心(订阅回调形态由 session-view.ts 泵壳承载,不绑 React)。
 *
 * 语义对齐 TUI 渲染归约器(packages/tui/src/render/model.ts,只读参照,
 * 按契约重写纯函数版):增量拼接 / 工具全生命周期状态机 / 轮次边界 /
 * 未知事件静默容忍(协议向前兼容铁律)。与 TUI 的结构差异:视图以消息
 * 为单位(UIMessage.parts),工具调用作为 part 嵌入所属 assistant 消息并
 * 全生命周期原位更新(TUI <Static> 的 append-only 约束不适用本模型),
 * 因此 msg.retracted 对已定稿块可真撤销(TUI 只能 no-op 容忍)。
 *
 * assistant 消息边界推导(协议无显式消息分界事件):块 index 是单次模型
 * 调用内索引(kernel consumeModelStream 逐调用重建局部计数),故「同
 * index 在当前消息重现」即新一次模型调用开始;辅以「主流 cost.usage.updated
 * 到达 / tool.started」封口信号(注入屏障场景两次调用间可无工具事件,
 * message_stop 的 usage 事件恒在)。
 *
 * 事实流之外的唯一补充入口是 appendUserMessage(用户输入不经内核事件流,
 * 与 TUI appendUserLine 同先例):纯函数、由宿主显式调用,reducer 自身
 * 恒不合成 user 消息。
 */

/** 会话即时状态(状态机推导见 deriveStatus;'error' = 最近终态轮以模型错误收场) */
type SessionViewStatus = 'idle' | 'thinking' | 'responding' | 'tooling' | 'awaiting_permission' | 'compacting' | 'error';
/** 文本呈现档:'stream' 流式增量(缺省)| 'final' 块定稿整段一次性落 part */
type TextDeliveryMode = 'stream' | 'final';
/** 思考呈现档:'stream'(缺省)| 'final' | 'off' 恒不物化(状态派生仍见 thinking) */
type ThinkingDeliveryMode = 'stream' | 'final' | 'off';
/**
 * 呈现档选项(呈现方式做成会话选项交给开发者选):
 * 恒只影响 text/thinking part 的物化时机与在场性——状态机派生(thinking/
 * responding 等)与工具卡(本就一次性整卡)恒不受档位影响。缺省全 'stream'
 * = 既有行为零漂移。
 */
interface SessionViewDeliveryOptions {
    /** 文本:'stream'(缺省)边收边显 | 'final' 整段生成完一次性显示 */
    readonly text?: TextDeliveryMode;
    /**
     * 思考:'stream'(缺省)| 'final' 整段定稿一次性 | 'off' 恒不落视图
     * (宿主仍可据 status==='thinking' 做「正在思考」占位)。此为呈现面开关;
     * 生成面(是否产生思考/预算)走请求选项 thinking:{budget/off},两旋钮正交。
     */
    readonly thinking?: ThinkingDeliveryMode;
}
/** SessionView 构造选项(initialSessionViewState / createSessionView / viewStateFromHistory 同形) */
interface SessionViewOptions {
    readonly delivery?: SessionViewDeliveryOptions;
}
/** 解析后的呈现档(随 internal 落状态,resume 重建径同一份配置继续生效) */
interface DeliveryConfig {
    readonly text: TextDeliveryMode;
    readonly thinking: ThinkingDeliveryMode;
}
/** 工具调用 part 全生命周期状态('aborted' = 轮终态时仍未收口的残留工具) */
type ToolCallPartStatus = 'proposed' | 'awaiting_permission' | 'running' | 'completed' | 'failed' | 'denied' | 'aborted';
/** 消息内的文本片段(流式期间随 msg.text.delta 增长) */
interface UITextPart {
    readonly type: 'text';
    /** msg.text.delta 已拼接文本(流式期间增量增长) */
    readonly text: string;
}
/** 消息内的思考片段(delivery.thinking = 'off' 时恒不出现) */
interface UIThinkingPart {
    readonly type: 'thinking';
    /** msg.thinking.delta 已拼接文本 */
    readonly text: string;
}
/** 嵌在 assistant 消息里的工具调用卡(全生命周期原位更新:proposed → … → 终态) */
interface UIToolCallPart {
    readonly type: 'toolCall';
    /** 协议 toolCallId */
    readonly id: string;
    readonly name: string;
    /** tool.proposed 携带的调用参数(渲染方按工具名解读) */
    readonly args?: unknown;
    readonly status: ToolCallPartStatus;
    /** tool.completed 的结构化渲染数据(ToolResult.data 透传位) */
    readonly result?: unknown;
    /** tool.completed 的模型可见文本投影(ToolResult content) */
    readonly resultText?: string;
    /** tool.failed 的错误分类(协议五枚举,原样透传) */
    readonly errorType?: string;
    readonly errorMessage?: string;
    readonly durationMs?: number;
}
/** 消息片段三型:文本 / 思考 / 工具调用卡 */
type UIMessagePart = UITextPart | UIThinkingPart | UIToolCallPart;
/** 视图消息(user 或 assistant;assistant 消息由 parts 依序组成,可直接渲染) */
interface UIMessage {
    /** 视图内单调 id(`msg-<n>`;React key 可直接用) */
    readonly id: string;
    readonly role: 'user' | 'assistant';
    readonly parts: readonly UIMessagePart[];
}
/** 进行中工具的活跃状态(终态后移出 activeTools,终态数据看消息 part) */
type ActiveToolStatus = 'proposed' | 'awaiting_permission' | 'running';
/** 进行中工具的活跃视图(`SessionViewState.activeTools` 元素;进度与输出尾部只在此处) */
interface ToolCallView {
    readonly id: string;
    readonly name: string;
    readonly args?: unknown;
    readonly status: ActiveToolStatus;
    /** 最近一条 tool.progress 消息 */
    readonly progressMessage?: string;
    /** tool.output.delta 聚合尾部(超限保尾,上限 OUTPUT_TAIL_MAX_CHARS) */
    readonly outputTail: string;
}
/** 待办条目视图(plan.todo.* 事件的投影) */
interface TodoView {
    readonly id: string;
    readonly content: string;
    readonly status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}
/**
 * usage 累计(cost.usage.updated 事件口径):token 数 = inputTokens +
 * outputTokens + cacheRead + cacheCreation 四路直加(exclusive 口径,
 * 协议 IRUsage 注释;reasoningOutputTokens 不另加,防与 output 重叠双算)。
 * 累计含全部签发方(压缩轮/子代理/标题等辅助用量一并如实计入)。
 */
interface UsageView {
    /** 本轮累计(turn.started 清零) */
    readonly turnTokens: number;
    /** 会话累计 */
    readonly sessionTokens: number;
    /** cost.usage.updated 事件次数 */
    readonly requests: number;
}
/** 最近一次失败(`SessionViewState.lastError`):turn.error{recoverable:false} 或泵壳源故障的投影 */
interface ErrorView {
    /** turn.error 的 errorKind 透传(词表锚定 IRErrorKind;可缺席) */
    readonly code?: string;
    readonly message: string;
    /** turn.error 的 scope(错误链路归属;可缺席 = 非 turn.error 来源) */
    readonly scope?: string;
    /**
     * turn.error 的 recoverable 镜 payload(protocol `events.ts` 位必填):
     * 落到 lastError 的恒是失败形 = `false`(`true` 的咨询帧进 `SessionView.notices`,恒不到此处);
     * 泵壳源故障(markSourceFailure)同为 `false`。必填而非可选——三端 reducer 同键同金样
     * (protocol `test/fixtures/golden/turn-error-{recoverable,fatal}.json`)。
     */
    readonly recoverable: boolean;
    /**
     * turn.error 的 detail 透传(加法可选):机器可判事实,首个取值
     * `{ scope: 'plan' }` = 开发者套餐配额拒绝(与 HTTP 面 `error.detail.scope` 同键同值;端侧
     * `ErrorEnvelope.scope` 同一读法)。缺席 = 无附加事实。
     */
    readonly detail?: Record<string, unknown>;
}
/**
 * 咨询通报:`turn.error{recoverable:true}` 的归约形——kernel 的
 * 咨询帧(压缩熔断暂停 / sdk.notice 弃用提示 / sdk.persistence 落卷失败 / serve store_commit_failed …)
 * 不是失败,归 `notices` 而不污染 lastError。字段恒自 wire 派生,不发明词:
 * - seq / at = 事件包络 seq / ts;
 * - code = errorKind,errorKind 缺席回落 scope;
 * - detail = `turn.error.detail` 透传(首个取值套餐配额 `{ scope: 'plan' }`);缺席即键缺席。
 */
interface SessionNotice {
    readonly seq: number;
    readonly scope: string;
    readonly code: string;
    readonly message: string;
    readonly at: number;
    readonly detail?: unknown;
}
/** notices 有界上限(FIFO,最旧先出;跨轮累积,turn.started 不清——M-08) */
declare const SESSION_NOTICES_MAX = 20;
/** 可直接渲染的视图快照(不可变;每次变更整树换新引用) */
interface SessionViewState {
    readonly status: SessionViewStatus;
    readonly messages: readonly UIMessage[];
    readonly activeTools: readonly ToolCallView[];
    readonly todos: readonly TodoView[];
    readonly usage: UsageView;
    /** 最近一条失败形 turn.error(recoverable:false / 缺席)或泵壳源故障;turn.started 清位 */
    readonly lastError?: ErrorView;
    /** 咨询通报(recoverable:true 帧),有界 SESSION_NOTICES_MAX FIFO,跨轮累积 */
    readonly notices: readonly SessionNotice[];
}
/** 当前流式 assistant 消息内的单块登记 */
interface BlockTracking {
    readonly blockType: string;
    /** 消息 parts 内位置(text/thinking 与已认领 tool_call 块;未建 part 缺席) */
    readonly partIndex?: number;
    readonly open: boolean;
    /** tool_call 块定稿后由 tool.proposed 回填 */
    readonly toolCallId?: string;
    /**
     * 'final' 呈现档的块内缓冲(delta 恒入此不落 part,块定稿一次性物化;
     * 键在场 = 本块走 final 档;定稿/撤销后恒清)
     */
    readonly buffer?: string;
}
/** 当前流式 assistant 消息追踪(null = 下一个块开新消息) */
interface CurrentMessageTracking {
    readonly messageId: string;
    /** 块 index → 登记(index 重现 = 新一次模型调用 = 新消息) */
    readonly blocks: Readonly<Record<number, BlockTracking>>;
    /** 本消息所属模型调用已收尾(主流 usage / tool.started):下一块恒开新消息 */
    readonly sealed: boolean;
}
interface ViewInternalState {
    /** 呈现档配置(构造期定格;turn/settle 恒不重置) */
    readonly delivery: DeliveryConfig;
    readonly running: boolean;
    /** session.compacted/microcompacted 置位,下一个被处理事件清位(status 往返) */
    readonly compacting: boolean;
    /** 最近终态轮以 model_error 收场(status='error' 判据);turn.started 清 */
    readonly lastTurnFailed: boolean;
    readonly nextMessageSeq: number;
    readonly current: CurrentMessageTracking | null;
    /** 最近定稿且未被 tool.proposed 认领的 tool_call 块 index */
    readonly pendingToolBlockIndex: number | null;
    /** toolCallId → 所在消息 id(part 原位更新定位) */
    readonly toolMessages: Readonly<Record<string, string>>;
}
/**
 * reducer 全量状态 = 公开视图 + 内部簿记(两半都是纯数据、structuredClone-
 * safe;泵壳只对外暴露 view 半边)。
 */
interface SessionViewReducerState {
    readonly view: SessionViewState;
    readonly internal: ViewInternalState;
}
/** 工具输出尾部聚合上限(与 TUI OUTPUT_TAIL_MAX_CHARS 同值同语义) */
declare const OUTPUT_TAIL_MAX_CHARS = 4000;
/** 初始 reducer 状态(空视图 + 按 options 解析的呈现档);`createSessionView` / 自建泵壳的起点 */
declare function initialSessionViewState(options?: SessionViewOptions): SessionViewReducerState;
/**
 * 纯函数投影:reduce(state, event) => state。
 * 未消费的事件(未知 kind / 与视图无关的 kind / 乱序孤儿)返回原引用
 * ——泵壳据引用相等跳过订阅通知。
 */
declare function reduceSessionView(state: SessionViewReducerState, event: KernelEvent): SessionViewReducerState;
/**
 * 用户输入落消息(纯函数;宿主在 send() 时显式调用,与 TUI appendUserLine
 * 同先例)。用户输入不经内核事件流(协议无 user 输入事件),reducer 自身
 * 恒不合成 user 消息——本函数是唯一补充入口,由宿主决定是否使用。
 */
declare function appendUserMessage(state: SessionViewReducerState, text: string): SessionViewReducerState;
/**
 * 动态切换呈现档(纯函数;随时可切):
 * 恒**块粒度**生效——已开启的块沿其 block.start 时捕获的形态收尾(缓冲/
 * 占位/不物化已定格在块登记,恒不中途变形),新块即用新档。恒不追溯已
 * 物化 part;切 thinking:'off' 要既有思考即刻消失用 stripThinkingParts 配套。
 * 档位相同恒返回原引用(泵壳零通知)。
 */
declare function setSessionViewDelivery(state: SessionViewReducerState, delivery: SessionViewDeliveryOptions): SessionViewReducerState;
/**
 * 思考 part 全量剔除(纯函数,追溯型配套件):切到 thinking:'off' 时宿主
 * 调用本函数让**既有**思考即刻从视图消失(内核历史恒不动,仅视图面;切回
 * 后恒不能从视图自身复原——宿主自持历史者可经 viewStateFromHistory 重建)。
 * 滤后空 parts 的非当前消息整条移除;当前流式消息恒保留(空壳与既有同律,
 * 块登记 partIndex 随删位重映射,被删思考块失联 partIndex 后续 delta 恒
 * 原引用跳过)。无思考 part 时恒返回原引用。
 */
declare function stripThinkingParts(state: SessionViewReducerState): SessionViewReducerState;
/**
 * 泵壳专用:事件源自身故障(自定义 AsyncIterable 抛错)时的终局错误面
 * ——比静默悬挂诚实。AgentSession.events 不抛,本路径只对自定义源可达。
 */
declare function markSourceFailure(state: SessionViewReducerState, error: unknown): SessionViewReducerState;

/**
 * viewStateFromHistory — 自历史重建视图的入口(resume / attach 恢复链的一步;
 * 与 tansr-android :core 同名 Kotlin 实现逐语义对齐,
 * 双端金样卷(test/view-golden)锁一致性,重录恒双仓同笔)。
 *
 * 语义:治理后历史快照(IRMessage[],pairing 已保证配对完整)→ 定稿消息
 * 投影(无流式簿记):
 * - text/thinking 空文本不建 part(与 reducer「空块定稿即删」同律);
 * - tool_call 与 tool_result 按 callId 全卷配对(后写者胜):有 tool_result 按
 *   isError 落 completed/failed,resultText = tool_result 的 text 项拼接(空则缺席);
 *   无 tool_result(断尾)落 aborted;
 * - 纯 tool_result 消息不落 user 气泡(tool_result 是协议载体不是用户话语);
 *   tool_result/opaque/image 与未知块型恒不建 part,空消息整条跳过;
 * - 消息 id 单调续接(msg-1…),internal.nextMessageSeq 随之推进——重建后
 *   新增消息恒不撞 id;其余内部簿记与视图字段取初始态(status='idle')。
 */

declare function viewStateFromHistory(messages: readonly IRMessage[], options?: SessionViewOptions): SessionViewReducerState;

/**
 * 事件泵(view 内部共享;session-view 与 narrator 同用)。
 *
 * 输入档二选一(结构化判定,零对 session.ts 的运行时依赖):
 * - AsyncIterable<KernelEvent>:直接消费;
 * - { events: AsyncIterable<KernelEvent> }(AgentSession 形):消费 .events。
 *
 * 2026-09-02 起 AgentSession.events 系多消费者广播(每次 for-await 一个独立订阅者):
 * 同一会话上同时挂 SessionView 与 Narrator(或宿主自身的 for-await)恒不再需要扇出;
 * 本泵直接消费 session.events 即可(旧 fanout 写法仍兼容——多一层无害)。
 *
 * dispose 停泵:置标志 + best-effort 调用迭代器 return()(async generator
 * 的 finally 释放上游);已挂起的 next() 由 return 排队语义收口。
 */

/** AgentSession 的结构化最小面(鸭子形;避免 view 层依赖 session 模块) */
interface SessionEventSource {
    readonly events: AsyncIterable<KernelEvent>;
}
/** 视图 / 叙述器可接的事件源:KernelEvent 异步流,或带 `events` 的 AgentSession 形对象 */
type SessionViewSource = AsyncIterable<KernelEvent> | SessionEventSource;

/** 会话视图句柄(由 `createSessionView` 创建):不可变快照 + 订阅 + 用户消息入账 + 呈现档切换 + 停泵 */
interface SessionView {
    /** 当前视图快照(不可变;每次变更换新引用) */
    readonly state: SessionViewState;
    /** 订阅状态变更;返回退订函数 */
    subscribe(listener: (state: SessionViewState) => void): () => void;
    /**
     * 用户消息入 transcript(事件流无用户输入事件,须宿主显式调用——通常与
     * session.send(text) 同时;底层即 reducer 纯函数)。
     * dispose 后为无害空操作。
     */
    appendUserMessage(text: string): void;
    /**
     * 动态切换呈现档(块粒度生效:开启中的块按其起始档收尾,新块即用新档)。
     * 切 thinking:'off' 时既有思考 part 一并即刻剔除(视图不变量:off ⇒ 视图
     * 恒无思考;内核历史不动,切回后仅影响后续块)。dispose 后为无害空操作。
     */
    setDelivery(delivery: SessionViewDeliveryOptions): void;
    /** 停泵并清空订阅(幂等);state 冻结在最后快照 */
    dispose(): void;
}
/**
 * 把事件源(AgentSession 或任意 KernelEvent 异步流)接到纯 reducer 上,得到可订阅的视图句柄:
 * 每个被消费的事件换一次不可变快照并扇出通知;`options.delivery` 决定文本 / 思考的呈现档。
 */
declare function createSessionView(source: SessionViewSource, options?: SessionViewOptions): SessionView;

/** 叙述详细度(累进):quiet 轮次级 / normal + 工具级 / verbose + delta 摘要与权限细节 */
type NarratorVerbosity = 'quiet' | 'normal' | 'verbose';
/** `createNarrator` 的选项:详细度 + 行出口 */
interface NarratorOptions {
    /** 缺省 'normal' */
    verbosity?: NarratorVerbosity;
    /** 行出口(逐行交付;回调抛错被吞——叙述不反噬事件消费) */
    onLine: (line: string) => void;
}
/** 叙述器句柄(由 `createNarrator` 创建;只有停泵一件事) */
interface Narrator {
    /** 停泵(释放上游迭代器);幂等 */
    dispose(): void;
}
/**
 * 挂一个叙述器到事件源(AgentSession 或任意 KernelEvent 异步流):逐事件按详细度产出英文日志行
 * 交给 `onLine`;内部借 reducer 投影做上下文,自身无 IO。用完 `dispose()` 停泵。
 */
declare function createNarrator(source: SessionViewSource, options: NarratorOptions): Narrator;

/**
 * 携 `x-tansr-app-token` 的请求收到 401 且信封 `error.code` 在此集合内(且 `detail.reason` 不在
 * `APP_TOKEN_TRANSIENT_REASONS`)→ 持有方失效缓存令牌并重铸恰一次。只对令牌径生效(同码在 Bearer 面另有含义)。
 */
declare const TOKEN_INVALIDATING_CODES: readonly ["unauthorized"];
/** 令牌径失效码(TOKEN_INVALIDATING_CODES 成员类型) */
type TokenInvalidatingCode = (typeof TOKEN_INVALIDATING_CODES)[number];
/** 令牌径 401 `unauthorized` 信封 `detail.reason` 词表(api `src/auth/app-token.ts` 失效形各标其一)。 */
declare const APP_TOKEN_REJECT_REASONS: readonly ["revoked", "expired", "invalid", "unknown_app", "missing", "check_unavailable"];
/** 令牌径 401 信封 `detail.reason` 的取值(APP_TOKEN_REJECT_REASONS 成员类型) */
type AppTokenRejectReason = (typeof APP_TOKEN_REJECT_REASONS)[number];
/** 词表中的瞬态子集:收到此 reason **不**失效缓存、**不**重铸(平台校验依赖不可用,重铸无益)。 */
declare const APP_TOKEN_TRANSIENT_REASONS: readonly ["check_unavailable"];
/** `code` 是否令牌径失效码(TOKEN_INVALIDATING_CODES 成员判) */
declare function isTokenInvalidatingCode(code: string): code is TokenInvalidatingCode;
/** `reason` 是否瞬态(不失效、不重铸);缺席 / 词表外 = false(按失效处置,与 api 端同向) */
declare function isTransientAppTokenReason(reason: unknown): boolean;

/** `createPlatformImageGenProvider` 的材料:公共网关材料 + 授权图像模型集 */
interface CreatePlatformImageGenProviderOptions extends PlatformMediaProviderOptions {
    /**
     * 授权图像模型集(bundle platformModels.imageGen,装配循环自取):骨架描述自列(顺位
     * 第一 = model 缺省生效模型),constraints 在场时逐模型拼受理约束注记;空数组 = 平台未配置
     * (描述如实注明,恒不猜名);缺席 = 集未知(注入档直构/旧径),描述回落通用指引。
     */
    models?: readonly AppBundleImageModel[];
}
/** 平台图像生成提供方(kernel ImageGenProvider 契约;一枚实例 = 一枚工具 = 一个会话)。 */
declare function createPlatformImageGenProvider(options: CreatePlatformImageGenProviderOptions): ImageGenProvider;

/**
 * 平台工具材料(baseUrl / token / fetchImpl? / models? / timeoutMs?;与平台提供方选项同形——
 * `timeoutMs` 缺省 IMAGEGEN_TOOL_TIMEOUT_MS,恒不回落 kernel 120s 统一档)。`token` 在本层**恒必填**
 * (SDK 令牌档恒有令牌;只有提供方层对 cli 装置键径放开可缺席)。
 */
type CreateImageGenToolOptions = CreatePlatformImageGenProviderOptions & {
    token: string;
};
/**
 * 环3 平台图像生成工具 = kernel ImageGen 骨架 + 平台提供方(name 'tansr')。计费副作用真实存在
 * (按张扣 App 余额)——骨架恒不声明只读/并发安全。
 */
declare function createImageGenTool(options: CreateImageGenToolOptions): Tool<ImageGenArgs>;

/** `createPlatformVideoGenProvider` 的材料:公共网关材料 + 授权视频模型集 */
interface CreatePlatformVideoGenProviderOptions extends PlatformMediaProviderOptions {
    /**
     * 授权视频模型集(bundle platformModels.videoGen,装配循环自取):骨架描述自列(顺位
     * 第一 = model 缺省生效模型),constraints 在场时逐模型拼受理约束注记(时长域/i2v 首帧/比例域);
     * 空数组 = 平台未配置(如实注明恒不猜名);缺席 = 集未知,描述回落通用指引。
     */
    models?: readonly AppBundleVideoModel[];
}
/** 平台视频生成提供方(kernel VideoGenProvider 契约;一枚实例 = 一枚工具 = 一个会话)。 */
declare function createPlatformVideoGenProvider(options: CreatePlatformVideoGenProviderOptions): VideoGenProvider;

/** 平台工具材料(与平台提供方选项同形;`timeoutMs` 缺省 VIDEOGEN_TOOL_TIMEOUT_MS;`token` 本层恒必填)。 */
type CreateVideoGenToolOptions = CreatePlatformVideoGenProviderOptions & {
    token: string;
};
/**
 * 环3 平台视频生成工具 = kernel VideoGen 骨架 + 平台提供方(name 'tansr')。计费副作用真实存在
 * (按秒扣 App 余额,分钟级长任务)——骨架恒不声明只读/并发安全。
 */
declare function createVideoGenTool(options: CreateVideoGenToolOptions): Tool<VideoGenArgs>;

/**
 * 平台联网搜索后端(kernel WebSearchProvider 实现):SDK 恒不暴露 BYO 档,内核态 WebSearch
 * 直接走平台。
 *
 * 形态注记:SDK 里联网搜索恒一件工具 = kernel 环2 'WebSearch',后端恒为本 provider(平台通道)。
 * BYO(TANSR_WEBSEARCH_ENDPOINT/KEY 环境变量后端)在 SDK 装配面恒不存在——终端持搜索商密钥
 * 即 appkey 防盗模型要消灭的反模式;可解释可审计面恒在平台(逐笔用量事件、预扣结算闭环、
 * endUserId 归因、失败零计费)。
 *
 * wire 契约:POST /t1/websearch {query, max_results} snake_case;响应 {results:[{title,url,snippet}]}
 * (供应商方言已在网关归一;供应商身份恒匿名)。按次计量计费归 App(pricePerCall;开发者对终端
 * 如何转售自主,计量计费分离)。
 *
 * 错误纪律:WebSearchProvider 契约以 throw 表达失败——kernel search-tool 捕获转 provider_error
 * 结构化错误(不炸查询环),错误消息携网关错误码与修复指引;令牌只活在闭包,查询文本平台侧
 * 恒不落日志不落库,SDK 侧同样恒不打印。
 */

/** 后端名(进 kernel WebSearch 的 ToolResult.data.provider,供渲染与审计)。 */
declare const PLATFORM_SEARCH_PROVIDER_NAME = "tansr-platform";
/** `createPlatformSearchProvider` 的材料:平台基址、app_user 令牌与可选 fetch 注入 */
interface CreatePlatformSearchProviderOptions {
    /** 平台 API 基址(令牌档会话档;/t1 前缀由本 provider 追加)。 */
    baseUrl: string;
    /** app_user 短期令牌(只活在本闭包,恒不进工具定义/日志)。 */
    token: string;
    /** fetch 注入缝(测试桩网关;缺省全局 fetch)。 */
    fetchImpl?: typeof fetch;
}
/**
 * 平台联网搜索 provider(kernel WebSearchProvider 契约):经令牌档 fetch 打
 * 平台网关,平台代调搜索供应商池(加权选池 + 故障转移),按次计费归 App。
 * 结果条目做最小映射(title/url 非字符串剔除,snippet 缺席补空串);上限
 * 截断、URL 卫生、去重恒由 kernel search-tool 层收口(不信任 provider 同律)。
 */
declare function createPlatformSearchProvider(options: CreatePlatformSearchProviderOptions): WebSearchProvider;

/** `createSdkPermissionGate` 的选项:规则路径锚定目录 + 可选 PreToolUse hooks 引擎 */
interface CreateSdkPermissionGateOptions {
    /** 权限规则的路径锚定目录;必须与 executor 的 cwd 一致 */
    cwd: string;
    /** PreToolUse hooks 引擎;缺省不参与决策 */
    hooks?: HookEngine;
}
/**
 * 把 kernel 权限引擎装成执行器可用的 PermissionGate:每次工具调用先经 hooks(如有)再经引擎裁决,
 * 工具元数据(描述 / 效应声明 / 只读位)随咨询透传给分类器;Skill / TodoWrite 等只读工具按既有纪律放行。
 */
declare function createSdkPermissionGate(engine: PermissionEngine, registry: ToolRegistry, options: CreateSdkPermissionGateOptions): PermissionGate;

/** 工具集双面引用(registry 执行面 + toolDefs 模型可见面;push 对引用可见) */
interface SdkToolsetRef {
    registry: ToolRegistry;
    toolDefs: IRToolDef[];
}
/** attachSdkTaskTool 的装配材料(TaskToolConfig 的 SDK 消费子集) */
type AttachSdkTaskToolConfig = Omit<TaskToolConfig, 'toolset' | 'agents'>;
/**
 * Task 工具注入:必须在工具集聚合之后、runQuery 之前调用一次;重复调用
 * 由 registry 同名注册冲突 throw 暴露(装配期编程错误,fail-fast)。
 */
declare function attachSdkTaskTool(toolset: SdkToolsetRef, config: AttachSdkTaskToolConfig): void;
/**
 * 三档降档解析闭包(cli 同款裁决):registry 在场(托管档五层配置 /
 * 令牌档 bundle)按别名如实解析,失败沿用父模型(kernel 结果 data 的
 * modelTierIgnored 标注);注入档无 registry 返回 undefined(别名请求
 * 被 kernel 忽略并标注,不静默)。
 */
declare function subagentModelResolverOf(registry: ProviderRegistry | null): SubagentModelResolver | undefined;

/**
 * 空闲直压公共件:轮间(无运行中查询环)对当前
 * 历史执行一次 manual 压缩,与 cli `tui/session-driver.ts` `#runIdleCompact` 同律
 * (同一 manager.compact 请求形态、同一 maxTokens 公式、同一应用器/事件体组装),
 * 抽成纯装配件供 SDK `AgentSession.compact()` 与 serve v2(V-1 `POST …/compact`,
 * 空闲径)去重消费。
 *
 * 本件**不**做的事(归调用方):
 * - 空闲判定 / 空历史判定 / 未配置判定(拒绝形态各面自定);
 * - PreCompact/PostCompact hook 分发(SDK 无查询 hooks 面;serve/TUI 自行分发);
 * - 历史替换、事件包络与签发、落盘提交(rewritten)——本件只返回新历史数组与
 *   已组装的事件体(EventBody[]),调用方按自身事件面补包络推流。
 *
 * 快照接线:`beforeCompact` 原样透传 CompactRequest.beforeCompact(K-5)——manager 于
 * 计划落定后、fork 请求发出前调用;抛错 → 失败结局 reason='before_compact_failed',
 * 历史不变;返回的 checkpointId 冒泡到 outcome 与 session.compacted 事件体(D-11 A:
 * 失败结局同携 id,已落的盘不回滚)。
 */

/** 空闲直压输入(调用方已完成空闲/非空/已配置三判定) */
interface IdleCompactionInput {
    /** 执行压缩的 manager(SDK:resolveCompactionManager 产物;serve/TUI:会话级实例) */
    manager: ContextManager;
    /** 压缩配置(取 model 降档与 maxOutputTokens;其余字段已在 manager 构造时消费) */
    compaction: QueryCompactionOptions;
    /** 当前上下文视图(messages 为压缩前完整历史;本件不改写入参数组) */
    view: ContextView;
    /** 会话主模型(compaction.model 缺席时压缩 fork 与 usage 归因的回退) */
    model: ResolvedModel;
    /** 上下文窗口(cost.usage.updated 水位分母;缺席不产水位) */
    contextWindowTokens?: number;
    /** 用户附加摘要指令(compact({ instructions })) */
    instructions?: string;
    signal?: AbortSignal;
    /** 压缩前钩子(装配层落 pre_compaction 快照;K-5 CompactRequest.beforeCompact 形) */
    beforeCompact?: (view: ContextView) => Promise<{
        checkpointId?: string;
    } | void>;
}
/** 空闲直压结局:`compacted`(新历史 + 待签发事件体)或 `failed`(失败结局 + 已报成本事件体;历史不变) */
type IdleCompactionResult = {
    status: 'compacted';
    outcome: CompactOutcomeSuccess;
    /** 压缩后的新历史(与 outcome.messages 逐元素同引用;调用方自行深拷贝/替换) */
    messages: IRMessage[];
    /** 依序组装的协议事件体(session.compacted 在前、cost.usage.updated 在后;调用方补包络签发) */
    events: EventBody[];
} | {
    status: 'failed';
    outcome: CompactOutcomeFailure;
    events: EventBody[];
};
/**
 * 空闲直压主体(与 TUI #runIdleCompact 同律):
 * 1. `manager.compact({ trigger:'manual', maxTokens: min(compaction.maxOutputTokens ?? 20K,
 *    thresholds.compactOutputBudget), model: compaction.model ?? 主模型, instructions?,
 *    beforeCompact? })`——不得再与会话 maxTokens 钳制(P01 静默截断根因);
 * 2. 成功 → 统一应用器(围栏 1「出口不可绕过」)自 outcome 反推 replaceWithSummary
 *    变换,产出新历史与 session.compacted / cost.usage.updated 事件体(与查询环屏障点
 *    逐字段同形;派生态失效已由 manager.compact 内建执行,invalidations='strategy');
 * 3. 失败 → 原样返回失败结局与已报成本事件；不改历史、不签发成功压缩事件。
 */
declare function runIdleCompaction(input: IdleCompactionInput): Promise<IdleCompactionResult>;

/**
 * resume 径历史配对治理(SDK 内同构实现)。
 *
 * 与 cli/src/sessions/pairing.ts 同构双份:目标不变量、断尾合成、
 * 中段截断三段语义逐条对齐,仅剥 @tansr/i18n 依赖(SDK 面向开发者的占位
 * 文案用英文,errors.ts 同豁免)。共享装配包收敛落地时两份下沉合一,
 * 本文件届时退役为 re-export。
 *
 * 目标不变量:治理后的 IRMessage[] 可直接作下一轮 runQuery 的
 * initialMessages——每个 assistant tool_call 都有配对 tool_result,且不存在
 * 无主(孤儿)tool_result;否则双协议请求体必 400。kernel 对 initialMessages
 * 原样收不校验(run-query.ts 直铺),坏配对会直送 wire——resume 径以本治理
 * 兜住开发者存储的两类磁盘现实:
 * - 断尾:整轮多条记录逐条落盘,中途断电只留下前缀 —— 尾部 assistant 的
 *   tool_call 失配。策略:按中断语义合成占位 tool_result 补齐(不丢内容);
 * - 中段异常(孤儿 tool_result 等,只可能来自损坏/外部写入端):无法靠补齐
 *   修复,截断到最后一个「配对干净」的消息边界,绝不静默送出坏历史。
 */

/** 分页窗口经配对边界对齐后的切片区间(绝对下标,end 开区间) */
interface AlignedHistoryPage {
    /** 对齐后的起点(≤ 请求 offset;向前对齐到配对干净边界) */
    start: number;
    /** 对齐后的终点(≥ min(offset + limit, length);向后对齐到配对干净边界) */
    end: number;
}
/**
 * 历史分页边界对齐:消息索引口径的窗口
 * [offset, offset + limit) 扩到配对干净的边界。「干净边界」= 该长度的前缀内每个
 * assistant tool_call 都已见到配对 tool_result(无 open 调用)——两端皆干净的切片
 * 自身必配对完整,可直接作视图/initialMessages。
 * - start 向前(更早)取 ≤ offset 的最大干净边界(0 恒干净);
 * - end 向后(更晚)取 ≥ min(offset + limit, length) 的最小干净边界;尾部 tool_call
 *   悬而未决(源历史本身断尾)时无此边界,取 length——分页只切不合成占位;
 * - limit 是**下限**:为凑齐工具轮,返回区间可比 limit 长。
 * 返回 null = 序列内出现无主 tool_result(其 tool_call 在序列之前,序列不自包含),
 * 调用方须扩大装载范围(file-store 段跳读据此再装一段)。offset/limit 越界按 length
 * 钳制;非整数向下取整;负数按 0。
 */
declare function alignHistoryPage(messages: readonly IRMessage[], offset: number, limit: number): AlignedHistoryPage | null;

/** 应用单阶段指令(一次直出结论 + 理由;两行格式与编码协议同型) */
declare const APP_SINGLE_STAGE_INSTRUCTION: string;
/**
 * 应用单阶段协议指纹现算(预算参数化;缺省实参产值 === APP_SINGLE_STAGE_PROTOCOL_FINGERPRINT)。
 * 分量:应用指令 + 共用解析器/思考剥离 + 预算 + 硬化 + 超时策略(含对冲)+
 * 温度分量 + 应用载荷版本 + 结算分量。
 */
declare function appSingleStageProtocolFingerprintFor(maxTokens?: number): string;
/** 应用单阶段协议指纹(资格证据 / 缓存标签 / 报告 summary 的键;值以运行时计算为准) */
declare const APP_SINGLE_STAGE_PROTOCOL_FINGERPRINT: string;

/**
 * `prepareApplicationPromptTurn` 的输入:先异步预检(`prepare`,如刷新应用提示词)、成功后再以选定的
 * system 段起真正的一轮(`start`);预检失败按 `errorMessage` 出 turn.error 并保留既有历史。
 */
interface ApplicationPromptTurnOptions {
    sessionId: string;
    /** 预检失败时原样保留的既有历史；本轮尚未送往模型的输入不记入。 */
    history: readonly IRMessage[];
    prepare: (signal: AbortSignal) => Promise<IRSystemSegment[]>;
    /** 每轮最多调用一次；此后工具循环始终消费该轮选定的 system。 */
    start: (system: IRSystemSegment[]) => QueryHandle;
    errorMessage: (error: unknown) => string;
    errorScope?: string;
    /** 预检绝对上限，缺省30秒；即使自定义fetch忽略取消，也能收束本轮。 */
    prepareTimeoutMs?: number;
}
/**
 * 把「异步预检 → 起轮」包成一个同步返回的 QueryHandle:预检期间的排队输入 / 取消原样接管,
 * 预检超时(缺省 30 秒)或失败以 turn.started → turn.error → turn.aborted 收束本轮,恒不悬挂。
 */
declare function prepareApplicationPromptTurn(options: ApplicationPromptTurnOptions): QueryHandle;

/** 仅刷新应用提示词字段；模型、工具和权限仍由原会话装配管理。 */
interface ApplicationPromptSnapshot {
    systemPrompt?: string;
    systemPromptPolicy?: SystemPromptPolicy;
}
/**
 * 每会话独立条件核验，绕过装配缓存：平台保存后下一轮即采用新值，不等缓存 TTL。
 * 失败／取消不覆盖上一验证标记，并拒绝本轮；不能静默使用旧提示词发模型请求。
 */
declare function createApplicationPromptRefresher(options: {
    baseUrl: string;
    token: string;
    fetchImpl?: typeof fetch;
    initial: ApplicationPromptSnapshot;
    etag?: string;
}): (signal: AbortSignal) => Promise<ApplicationPromptSnapshot>;

export { ADJUDICATION_CONSULT_TOKEN_ESTIMATE, ADJUDICATION_POSTURES, ADJUDICATOR_TIERS, ADJUDICATOR_UNAVAILABLE_WARNING, APP_PLATFORMS, APP_PLATFORM_TOPOLOGY, APP_SDK_CONTRACT_VERSION, APP_SINGLE_STAGE_INSTRUCTION, APP_SINGLE_STAGE_PROTOCOL_FINGERPRINT, APP_TOKEN_PLACEHOLDER_ENV, APP_TOKEN_PLACEHOLDER_VALUE, APP_TOKEN_REJECT_REASONS, APP_TOKEN_TRANSIENT_REASONS, AdjudicatorTierSchema, AgentSession, AppBundlePlanSchema, AppCapabilitiesSchema, AppPlatformSchema, AppTokenRequestSchema, AppTokenResponseSchema, CAPABILITY_BIT_TOOL_NAMES, CAPABILITY_PLATFORM_KEYS, CAPABILITY_TOOL_KEYS, CAPABILITY_TOPOLOGIES, CHECKPOINT_EXPORT_FORMAT, CLASSIFIER_PROTOCOL_FINGERPRINT, CLASSIFIER_TIMEOUT_POLICY, CLIENT_FEATURES, DEFAULT_APP_CAPABILITIES, DEFAULT_BUNDLE_CACHE_SCOPE, DEFAULT_BUNDLE_CACHE_TTL_MS, DEFAULT_MAX_TOKENS, DEFAULT_MAX_TURNS, DEVELOPER_ONLY_ADJUDICATOR_WARNING_CODES, EndUserIdSchema, HEADER_APP_TOKEN, HEADER_CLIENT_FEATURES, IMAGEGEN_TOOL_MAX_N, IMAGEGEN_TOOL_TIMEOUT_MS, ImageGenArgsSchema, ImageGenDataSchema, LOCAL_END_USER_KEY, McpHost, OUTPUT_TAIL_MAX_CHARS, PLAN_ERROR_CODES, PLAN_ERROR_HTTP_STATUS, PLAN_STATUSES, PLAN_TIERS, PLATFORM_MEDIA_PROVIDER_NAME, PLATFORM_SEARCH_PROVIDER_NAME, PlanCapsSchema, PlanStatusSchema, PlanTierSchema, PlatformRequestError, QueueChannel, SEGMENTED_STORE_DEFAULTS, SESSION_NOTICES_MAX, SINGLE_STAGE_PROTOCOL_FINGERPRINT, SPEECH_TO_TEXT_TOOL_TIMEOUT_MS, SdkLifecycleError, SequentialToolExecutor, SpeechAudioSchema, SpeechDataSchema, SpeechToTextArgsSchema, StoreError, TANSR_PROVIDER_ID, TEXT_TO_SPEECH_DEFAULT_MAX_CHARS, TEXT_TO_SPEECH_FORMATS, TEXT_TO_SPEECH_TOOL_TIMEOUT_MS, TOKEN_INVALIDATING_CODES, TOOLS_PLATFORM_DEPRECATED_CODE, TOOL_GUIDE_LABEL, TWO_STAGE_TIMEOUT_MS, TansrSdkError, TextToSpeechArgsSchema, TranscriptDataSchema, TranscriptSegmentSchema, UnavailableChannel, VIDEOGEN_TOOL_MAX_DURATION, VIDEOGEN_TOOL_TIMEOUT_MS, VideoGenArgsSchema, VideoGenDataSchema, accumulateUsage, alignHistoryPage, appBundlePricingUpdates, appBundleRegistryConfig, appSingleStageProtocolFingerprintFor, appendUserMessage, assembleBundleAdjudicator, assembleManagedModel, assemblePlatformModel, assembleSdkSkills, assembleTokenTierAdjudicator, assembleTooling, attachSdkMcp, attachSdkMcpWithDiscover, attachSdkTaskTool, buildClientFromRegistry, buildSdkToolSet, buildToolGuideSegment, bundleKey, classifierProtocolFingerprintFor, createAppTokenFetch, createApplicationPromptRefresher, createBlockListClassifier, createBundleCache, createChaosBlobStore, createClassifierTranscriptRecorder, createFileCheckpointStore, createFileSessionStore, createFsBlobStore, createImageGenTool, createMcpHost, createMemoryBlobStore, createNarrator, createPlatformAudioClient, createPlatformImageGenProvider, createPlatformSearchProvider, createPlatformSpeechToTextProvider, createPlatformTextToSpeechProvider, createPlatformVideoGenProvider, createSdkPermissionGate, createSession, createSessionView, createSingleStageClassifier, createSpeechToTextTool, createTextToSpeechTool, createTwoStageClassifier, createUnavailablePlatformAudioClient, createVideoGenTool, defaultAppCapabilities, defineSkill, defineTool, featuresFingerprintOf, fetchAppBundle, fetchTwpFeatures, fetchTwpHeartbeat, hintFor, hostedToolUniverse, inapplicableTrueBits, initialSessionViewState, isPlanErrorCode, isRenderableArtifact, isSessionHistoryStore, isTokenInvalidatingCode, isTransientAppTokenReason, markSourceFailure, normalizeAppCapabilitiesForPlatform, normalizeEtagValue, parseAppBundle, parseCacheControlMaxAgeMs, parseMediaArtifact, parseSpeechData, parseStage1Output, parseStage2Output, parseTranscriptData, planErrorGuidance, planUpgradeUrlOf, platformErrorOf, prepareAdjudication, prepareApplicationPromptTurn, providerSwitchedBody, query, readHistoryPage, reduceSessionView, renderAppContext, renderCallPayloadDetailed, renderClassifierStagePrompt, renderEngineFacts, requestPlatformAudio, resolveAdjudicationPosture, resolveAdjudicatorGovernance, resolveApplicationSystem, resolveBuiltinSelection, resolveInitialMessages, resolvePlatformSelection, resolveStageHandle, runAgent, runIdleCompaction, runStorageConformance, serializeTimeoutPolicy, setSessionViewDelivery, singleStageProtocolFingerprintFor, sliceHistoryPage, stripThinkingParts, subagentModelResolverOf, toStoreError, toToolDef, topologyOf, topologyToolUniverse, validateAdjudicationOptions, viewStateFromHistory, zeroAppCapabilities };
export type { ActiveToolStatus, AdjudicationOptions, AdjudicationPosture, AdjudicationWarning, AdjudicatorGovernance, AdjudicatorGovernanceInput, AdjudicatorMoneyFold, AdjudicatorTier, AlignedHistoryPage, Answer, AppBundle, AppBundleAdjudicator, AppBundleContextScheme, AppBundleGovernance, AppBundleImageModel, AppBundleMediaModel, AppBundleModel, AppBundleModelPricing, AppBundlePlan, AppBundlePlatformModels, AppBundleSpeechToTextModel, AppBundleTextToSpeechModel, AppBundleVideoModel, AppCapabilities, AppPlatform, AppTokenRejectReason, AppTokenRequest, AppTokenResponse, ApplicationPromptInfo, ApplicationPromptSnapshot, ApplicationPromptTurnOptions, AskUserCallback, AssembleBundleAdjudicatorOptions, AssembleManagedModelOptions, AssemblePlatformModelOptions, AssembleToolingAdjudication, AssembleToolingOptions, AssembledBundleAdjudicator, AssembledManagedModel, AssembledPlatformModel, AssembledSkills, AssembledTooling, AttachSdkTaskToolConfig, AudioAsrConstraints, AudioTtsConstraints, BlobListEntry, BlobMeta, BlobStoreCapabilities, BlockListClassifierConfig, BuildSdkToolSetOptions, BuiltinToolName, BundleCache, BundleCacheKey, BundleCacheResolveInput, BundleCacheScope, BundleCacheStats, ByteRange, Capability, CapabilityPlatformKey, CapabilityToolKey, CapabilityTopology, CapabilityTopologyProfile, ChaosBlobStore, ChaosFaults, ChaosStats, Checkpoint, CheckpointInput, CheckpointMeta, CheckpointOptions, CheckpointRetention, CheckpointStore, CheckpointTrigger, ClassifierAssemblyMode, ClassifierLiveStages, ClassifierProtocol, ClassifierStageBudgetOverrides, ClassifierStageHandle, ClassifierTimeoutPolicy, ClassifierTranscriptRecorder, ClientFeature, StoredSessionMeta as ColdStoredSessionMeta, ColdTierEvent, ColdTierEventType, ColdTierStats, CompactNowOptions, CompactNowResult, CompactOptions, CompactResult, CompactionFailureReason, ConfigDiagnostic, CreateBlockListClassifierOptions, CreateBundleCacheOptions, CreateFileCheckpointStoreOptions, CreateFileSessionStoreOptions, CreateImageGenToolOptions, CreatePlatformAudioClientOptions, CreatePlatformImageGenProviderOptions, CreatePlatformSearchProviderOptions, CreatePlatformSpeechToTextProviderOptions, CreatePlatformTextToSpeechProviderOptions, CreatePlatformVideoGenProviderOptions, CreateSdkPermissionGateOptions, CreateSessionOptions, CreateSpeechToTextToolOptions, CreateTextToSpeechToolOptions, CreateVideoGenToolOptions, DecisionSource, DefineSkillOptions, DefineToolOptions, DefinedSkill, DefinedTool, DeliveryConfig, ErrorView, EventBody, EventEnvelope, FetchedAppBundle, ForkOptions, ForkResult, FsBlobStoreOptions, GateDecision, HistoryCommitMeta, HistoryPage, HistoryPageOptions, HistoryRewriteReason, HookOutcomeStatus, IRBlock, IRErrorKind, IRMessage, IRRequest, IRRole, IRStreamEvent, IRSystemSegment, IRToolContent, IRToolDef, IRToolResultBlock, IRUsage, IdleCompactionInput, IdleCompactionResult, ImageGenArgs, ImageGenData, ImageModelConstraints, ImageModelDescriptor, ImportCheckpointOptions, Integrity, JournalKind, JournalRecord, KernelEvent, KernelState, KeyPredicate, LoadConfigOptions, LoadQuery, LoadResult, LoadedConfig, ManagedQueryOptions, McpClientEvent, McpConnectFactory, McpConnection, McpEventObserver, McpHostOptions, McpServerConfig, McpSessionOption, MediaArtifact, MediaHintAudience, MediaHintFace, MediaModelDescriptor, MediaOutputHosting, MemoryBlobStoreOptions, ModelCallOptions, ModelClient, Narrator, NarratorOptions, NarratorVerbosity, PermissionDecision, PermissionGate, PermissionMode, PermissionOptions, PermissionRules, PlanCaps, PlanErrorCode, PlanStatus, PlanTier, PlatformAudioCallOptions, PlatformAudioClient, PlatformAudioFace, PlatformAudioResponse, PlatformCapabilityName, PlatformMediaProviderOptions, PlatformToolContext, PlatformWarning, PreparedAdjudication, Pricing, PromptCachingMode, PromptChannel, ProposedToolCall, ProtocolKind, ProviderProfile, PutOptions, PutResult, QueryBeforeCompactContext, QueryBeforeCompactHook, QueryCompactionOptions, QueryCounters, QueryHandle, QueryLifecycleOptions, QueryOptions, QueryResult, ResourceSettleOptions as QuerySettleOptions, ResourceSettlementResult as QuerySettlement, ResourceSettlementFailure as QuerySettlementFailure, Question, QuestionOption, RenderPayloadOptions, RequestPlatformAudioOptions, ResolvedBundle, ResolvedModel, RestoreOptions, RestoreResult, RunAgentOptions, SdkCleanupHandle, SdkErrorCode, SdkMcpAttachment, SdkSkillsOptions, SdkToolSet, SdkToolsOptions, SdkToolsetRef, SdkWarning, SegmentBlobStore, SegmentationOptions, SegmentedStorePolicy, SequentialToolHandler, SequentialToolResult, SessionCheckpointOptions, SessionCwdChange, SessionDrainOptions, SessionDrainResult, SessionEventSource, SessionHistoryStore, SessionIndexStore, SessionInputCapabilities, SessionInputContent, SessionInputReceipt, SessionInputRejectCode, SessionInputResult, SessionInputSubmission, SessionInputTarget, SessionLifecycleFailure, SessionLifecyclePhase, SessionNotice, SessionRecord, SessionRecordMeta, SessionStore, SessionStoreCommitMeta, SessionStoreCreateInit, SessionStoreForkInput, SessionView, SessionViewDeliveryOptions, SessionViewOptions, SessionViewReducerState, SessionViewSource, SessionViewState, SessionViewStatus, SetCwdResult, SetModelBinding, SkillsFileSystem, SpeakInput, SpeechAudio, SpeechData, SpeechToTextArgs, SpeechToTextModelDescriptor, StorageConformanceCase, StorageConformanceOptions, StorageConformanceReport, StoreErrorKind, StoreErrorOptions, StoreInput, StoredSessionMeta, StreamTransform, SystemPromptPolicy, TansrConfig, TerminalReason, TextDeliveryMode, TextToSpeechArgs, TextToSpeechModelDescriptor, ThinkingDeliveryMode, TodoView, TokenInvalidatingCode, Tool, ToolCallPartStatus, ToolCallView, ToolContext, ToolErrorType, ToolExecutionContext, ToolExecutionOutcome, ToolExecutor, ToolExecutorYield, ToolParameterSpec, ToolResult, ToolResultContent, TranscribeInput, TranscriptData, TranscriptSegment, TwpHeartbeatResult, UIMessage, UIMessagePart, UITextPart, UIThinkingPart, UIToolCallPart, UsageView, VideoGenArgs, VideoGenData, VideoModelConstraints, VideoModelDescriptor, Visibility };
