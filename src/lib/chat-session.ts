/**
 * Chat Session 模块
 * 业务层会话管理，协调 AgentSession 和存储
 */

import { AgentSession } from "./agent-client";
import * as store from "./session-store";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BroadcastMessage, Subscriber } from "./types/agent";

/**
 * 活跃的 ChatSession 实例缓存
 */
const activeSessions = new Map<string, ChatSession>();

/**
 * Chat Session 类
 * 管理单个会话的业务逻辑
 */
export class ChatSession {
    public readonly sessionId: string;
    public readonly workspaceId: string;
    private workspacePath: string;
    private agentSessionId: string | undefined;
    private agentSession: AgentSession | null = null;
    private subscribers: Set<Subscriber> = new Set();
    private isListening = false;

    constructor(sessionId: string, workspaceId: string, workspacePath: string, agentSessionId?: string) {
        this.sessionId = sessionId;
        this.workspaceId = workspaceId;
        this.workspacePath = workspacePath;
        this.agentSessionId = agentSessionId;
    }

    /**
     * 发送用户消息
     */
    sendMessage(content: string): void {
        // 1. 存储用户消息
        store.addMessage(this.sessionId, {
            sessionId: this.sessionId,
            role: "user",
            content
        });

        // 2. 广播用户消息
        this.broadcast({
            type: "user_message",
            content,
            sessionId: this.sessionId
        });

        // 3. 确保 AgentSession 已创建
        if (!this.agentSession) {
            this.agentSession = new AgentSession({
                cwd: this.workspacePath,
                sessionId: this.agentSessionId
            });
        }

        // 4. 发送到 Agent
        this.agentSession.sendMessage(content);

        // 5. 开始监听响应（如果还没开始）
        if (!this.isListening) {
            this.startListening();
        }
    }

    /**
     * 启动监听 Agent 输出
     */
    private async startListening(): Promise<void> {
        if (this.isListening || !this.agentSession) return;
        this.isListening = true;

        try {
            for await (const message of this.agentSession.getOutputStream()) {
                // 保存 AgentSession 的 sessionId
                this.saveAgentSessionIdIfNeeded();
                this.handleSDKMessage(message);
            }
        } catch (error) {
            console.error(`ChatSession ${this.sessionId} error:`, error);
            this.broadcastError((error as Error).message);
        } finally {
            this.isListening = false;
        }
    }

    /**
     * 保存 AgentSession 的 sessionId（如果尚未保存）
     */
    private saveAgentSessionIdIfNeeded(): void {
        if (!this.agentSession || this.agentSessionId) return;

        const newSessionId = this.agentSession.getSessionId();
        if (newSessionId) {
            this.agentSessionId = newSessionId;
            store.updateSession(this.sessionId, { agentSessionId: newSessionId });
        }
    }

    /**
     * 处理 SDK 消息
     */
    private handleSDKMessage(message: SDKMessage): void {
        switch (message.type) {
            case "assistant":
                this.handleAssistantMessage(message);
                break;
            case "result":
                this.handleResultMessage(message);
                break;
            case "system":
                // 系统消息可以用于日志或调试
                console.log(`[System] ${this.sessionId}:`, message.subtype);
                break;
        }
    }

    /**
     * 处理助手消息
     */
    private handleAssistantMessage(message: SDKMessage & { type: "assistant" }): void {
        const content = message.message.content;

        if (typeof content === "string") {
            // 字符串内容
            store.addMessage(this.sessionId, {
                sessionId: this.sessionId,
                role: "assistant",
                content
            });
            this.broadcast({
                type: "assistant_message",
                content,
                sessionId: this.sessionId
            });
        } else if (Array.isArray(content)) {
            // 数组内容（包含多个 block）
            content.forEach((block) => {
                if (block.type === "text") {
                    // 文本块
                    store.addMessage(this.sessionId, {
                        sessionId: this.sessionId,
                        role: "assistant",
                        content: block.text
                    });
                    this.broadcast({
                        type: "assistant_message",
                        content: block.text,
                        sessionId: this.sessionId
                    });
                } else if (block.type === "tool_use") {
                    // 工具调用块
                    this.broadcast({
                        type: "tool_use",
                        toolName: block.name,
                        toolId: block.id,
                        toolInput: block.input,
                        sessionId: this.sessionId
                    });
                }
            });
        }
    }

    /**
     * 处理结果消息
     */
    private handleResultMessage(message: SDKMessage & { type: "result" }): void {
        const isSuccess = message.subtype === "success";

        this.broadcast({
            type: "result",
            success: isSuccess,
            sessionId: this.sessionId,
            cost: message.total_cost_usd,
            duration: message.duration_ms
        });

        // 如果是错误，记录错误信息
        if (!isSuccess && "errors" in message && message.errors) {
            console.error(`ChatSession ${this.sessionId} result error:`, message.errors);
        }
    }

    /**
     * 添加订阅者
     */
    subscribe(subscriber: Subscriber): void {
        this.subscribers.add(subscriber);
    }

    /**
     * 移除订阅者
     */
    unsubscribe(subscriber: Subscriber): void {
        this.subscribers.delete(subscriber);
    }

    /**
     * 检查是否有订阅者
     */
    hasSubscribers(): boolean {
        return this.subscribers.size > 0;
    }

    /**
     * 广播消息给所有订阅者
     */
    private broadcast(message: BroadcastMessage): void {
        const messageStr = JSON.stringify(message);
        this.subscribers.forEach((subscriber) => {
            try {
                if (subscriber.readyState === subscriber.OPEN) {
                    subscriber.send(messageStr);
                }
            } catch (error) {
                console.error("Broadcast error:", error);
                this.subscribers.delete(subscriber);
            }
        });
    }

    /**
     * 广播错误消息
     */
    private broadcastError(error: string): void {
        this.broadcast({
            type: "error",
            error,
            sessionId: this.sessionId
        });
    }

    /**
     * 关闭会话
     */
    close(): void {
        if (this.agentSession) {
            this.agentSession.close();
            this.agentSession = null;
        }
        this.subscribers.clear();
    }
}

/**
 * 获取或创建 ChatSession
 */
export function getOrCreateChatSession(sessionId: string): ChatSession | null {
    // 检查缓存
    let chatSession = activeSessions.get(sessionId);
    if (chatSession) {
        return chatSession;
    }

    // 获取会话
    const session = store.getSession(sessionId);
    if (!session) {
        return null;
    }

    // 获取工作区（cwd 指向 workspace 的独立目录）
    const workspace = store.getWorkspace(session.workspaceId);
    if (!workspace) {
        return null;
    }

    // 创建新的 ChatSession，cwd 指向 workspace 的独立目录，传入保存的 agentSessionId
    chatSession = new ChatSession(sessionId, workspace.id, workspace.path, session.agentSessionId);
    activeSessions.set(sessionId, chatSession);

    return chatSession;
}

/**
 * 删除 ChatSession
 */
export function deleteChatSession(sessionId: string): void {
    const chatSession = activeSessions.get(sessionId);
    if (chatSession) {
        chatSession.close();
        activeSessions.delete(sessionId);
    }
}

/**
 * 获取活跃的 ChatSession
 */
export function getActiveChatSession(sessionId: string): ChatSession | undefined {
    return activeSessions.get(sessionId);
}
