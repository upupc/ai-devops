/**
 * Agent 相关类型定义
 */

/**
 * Agent 会话配置选项
 */
export interface AgentSessionOptions {
    /** 模型名称 */
    model?: string;
    /** 最大对话轮数 */
    maxTurns?: number;
    /** 允许使用的工具列表 */
    allowedTools?: string[];
    /** 系统提示词 */
    systemPrompt?: string;
    /** 工作目录 */
    cwd?: string;
    /** 会话ID */
    sessionId?: string;
}

/**
 * 用户消息格式（SDK 要求的格式）
 */
export interface UserMessage {
    type: "user";
    message: {
        role: "user";
        content: string;
    };
}

/**
 * 广播消息 - 用户消息
 */
export interface UserMessageBroadcast {
    type: "user_message";
    content: string;
    sessionId: string;
}

/**
 * 广播消息 - 助手消息
 */
export interface AssistantMessageBroadcast {
    type: "assistant_message";
    content: string;
    sessionId: string;
}

/**
 * 广播消息 - 工具调用
 */
export interface ToolUseBroadcast {
    type: "tool_use";
    toolName: string;
    toolId: string;
    toolInput: unknown;
    sessionId: string;
}

/**
 * 广播消息 - 结果
 */
export interface ResultBroadcast {
    type: "result";
    success: boolean;
    sessionId: string;
    cost?: number;
    duration?: number;
}

/**
 * 广播消息 - 错误
 */
export interface ErrorBroadcast {
    type: "error";
    error: string;
    sessionId: string;
}

/**
 * 广播消息联合类型
 */
export type BroadcastMessage =
    | UserMessageBroadcast
    | AssistantMessageBroadcast
    | ToolUseBroadcast
    | ResultBroadcast
    | ErrorBroadcast;

/**
 * 订阅者接口
 */
export interface Subscriber {
    send(message: string): void;
    readyState: number;
    OPEN: number;
}
