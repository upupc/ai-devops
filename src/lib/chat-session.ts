/**
 * Chat Session 模块
 * 业务层会话管理，协调 AgentSession 和存储
 */

import { AgentSession } from "./agent-client";
import * as store from "./session-store";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BroadcastMessage, Subscriber } from "./types/agent";
import type {BetaMessage as APIAssistantMessage} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import * as crypto from "crypto";
import {SDKAssistantMessageError} from "@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes";
import { createLogger } from "./logger";

const logger = createLogger("ChatSession");

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
    private modelId: string | undefined;
    private subscribers: Set<Subscriber> = new Set();
    private isListening = false;

    constructor(sessionId: string, workspaceId: string, workspacePath: string, agentSessionId?: string, modelId?: string) {
        this.sessionId = sessionId;
        this.workspaceId = workspaceId;
        this.workspacePath = workspacePath;
        this.agentSessionId = agentSessionId;
        this.modelId = modelId;
    }

    /**
     * 发送用户消息
     */
    sendMessage(model: string, content: string): void {
        let nextModelId:string|undefined = model;
        if (model && model !== this.modelId) {
            this.modelId = model;
            store.updateSession(this.sessionId, { model: model });
        }else{
            nextModelId = this.modelId;
        }

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
                sessionId: this.agentSessionId,
                model: nextModelId,
            });
        }

        // 4. 发送到 Agent
        try{
            this.agentSession.sendMessage(nextModelId, content);
        }catch (error){
            logger.error("发送消息失败: sessionId={}, error={}", { sessionId: this.sessionId, error });
            this.broadcastError((error as Error).message);
        }


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
            logger.error("监听 Agent 输出失败: sessionId={}", { sessionId: this.sessionId, error });
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
                if(logger.isDebugEnabled()){
                    logger.debug("助手消息: sessionId={}, content={}", { sessionId: this.sessionId, content: JSON.stringify(message.message.content) });
                }
                break;
            case "result":
                this.handleResultMessage(message);
                if(logger.isDebugEnabled()){
                    if(message.subtype === "success"){
                        logger.debug("对话完成: sessionId={}, result={}", { sessionId: this.sessionId, result: message.result });
                    }else{
                        logger.debug("对话异常: sessionId={}, subtype={}, errors={}", { sessionId: this.sessionId, subtype: message.subtype, errors: JSON.stringify(message.errors) });
                    }
                }
                break;
            case "system":
                logger.info("系统消息: sessionId={}, subtype={}", { sessionId: this.sessionId, subtype: message.subtype });
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

        if(isSuccess){
            this.broadcast({
                type: "result",
                success: isSuccess,
                sessionId: this.sessionId,
                cost: message.total_cost_usd,
                duration: message.duration_ms,
            });
        }else{
            this.broadcast({
                type: "error",
                error: JSON.stringify(message.errors),
                sessionId: this.sessionId,
            });
        }

        // 如果是错误，记录错误信息
        if (!isSuccess && "errors" in message && message.errors) {
            logger.error("对话结果错误: sessionId={}, errors={}", { sessionId: this.sessionId, errors: message.errors });
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
                logger.error("广播消息失败", { error });
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
    chatSession = new ChatSession(
        sessionId,
        workspace.id,
        workspace.path,
        session.agentSessionId,
        session.model
    );
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
