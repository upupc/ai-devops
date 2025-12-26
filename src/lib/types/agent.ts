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
    /** 工作区ID */
    workspaceId?: string;
}

/**
 * 广播消息 - 用户消息
 */
export interface UserMessageBroadcast {
    id:string;
    type: "user_message";
    content: string;
    sessionId: string;
}

/**
 * 广播消息 - 助手消息
 */
export interface AssistantMessageBroadcast {
    id:string;
    type: "assistant_message";
    content: string;
    sessionId: string;
}

/**
 * 广播消息 - 工具调用
 */
export interface ToolUseBroadcast {
    id:string;
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
    id:string;
    type: "result";
    success: boolean;
    sessionId: string;
    cost?: number;
    duration?: number;
    tokens?: number;
}

/**
 * 广播消息 - 错误
 */
export interface ErrorBroadcast {
    id:string;
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

export type SubscriberMessage = {
    id: string;
    type:string;
    content?:string;
    toolName?:string;
    toolInput?:string;
    cost?:number;
    duration?:number;
    error?:string;
    tokens?: number;
}
/**
 * 订阅者接口
 */
export interface Subscriber {
    send(message: SubscriberMessage): void;
    readyState: number;
    OPEN: number;
}
