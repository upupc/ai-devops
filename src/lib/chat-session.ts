/**
 * Chat Session 模块
 * 业务层会话管理，协调 AgentSession 和存储
 */

import { AgentSession } from "./agent-client";
import * as store from "./session-store";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {BroadcastMessage, Subscriber, SubscriberMessage} from "./types/agent";
import type {BetaMessage as APIAssistantMessage} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import * as crypto from "crypto";
import {NonNullableUsage, SDKAssistantMessageError} from "@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes";
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
    async sendMessage(model: string, content: string): Promise<void> {
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
        // this.broadcast({
        //     id: crypto.randomUUID(),
        //     type: "user_message",
        //     content,
        //     sessionId: this.sessionId
        // });

        // 3. 确保 AgentSession 已创建
        if (!this.agentSession) {
            this.agentSession = new AgentSession({
                cwd: this.workspacePath,
                sessionId: this.agentSessionId,
                model: nextModelId,
                workspaceId: this.workspaceId
            });
            await this.agentSession.init();
        }

        // 4. 发送到 Agent
        try{
            await this.agentSession.sendMessage(nextModelId, content);
        }catch (error){
            logger.error("发送消息失败: ", { sessionId: this.sessionId, error });
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
            logger.error("监听 Agent 输出失败: ", { sessionId: this.sessionId, error });
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
                    logger.debug("助手消息: ", { sessionId: message.session_id, content: JSON.stringify(message.message.content) });
                }
                break;
            case "result":
                this.handleResultMessage(message);
                if(logger.isDebugEnabled()){
                    if(message.subtype === "success"){
                        logger.debug("对话完成: ", { sessionId: message.session_id, result: message.result });
                    }else{
                        logger.debug("对话异常: ", { sessionId: message.session_id, subtype: message.subtype, errors: JSON.stringify(message.errors) });
                    }
                }
                break;
            case "system":
                logger.info("系统消息:", { sessionId: message.session_id, subtype: message.subtype });
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
                content:content
            });
            this.broadcast({
                id: message.uuid,
                type: "assistant_message",
                content:content,
                sessionId: this.sessionId
            });
        } else if (Array.isArray(content)) {
            // 数组内容（包含多个 block）
            content.forEach((block) => {
                switch (block.type) {
                    case "text":
                        // 文本块
                        store.addMessage(this.sessionId, {
                            sessionId: this.sessionId,
                            role: "assistant",
                            content: block.text
                        });
                        this.broadcast({
                            id: message.uuid,
                            type: "assistant_message",
                            content: block.text,
                            sessionId: this.sessionId
                        });
                        break;
                    case "thinking":
                        // 文本块
                        store.addMessage(this.sessionId, {
                            sessionId: this.sessionId,
                            role: "assistant",
                            content: block.thinking
                        });
                        this.broadcast({
                            id: message.uuid,
                            type: "assistant_message",
                            content: block.thinking,
                            sessionId: this.sessionId
                        });
                        break;
                    case "tool_use":
                        // 工具调用块
                        // 工具调用块
                        this.broadcast({
                            id: message.uuid,
                            type: "tool_use",
                            toolName: block.name,
                            toolId: block.id,
                            toolInput: block.input,
                            sessionId: this.sessionId
                        });
                        break;
                    default:
                        break;
                }

            });
        }
    }

    private calculateTotalTokens(usage: NonNullableUsage): number {
        // 基础 token 消耗
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;

        // 缓存相关 token（这些通常已包含在 input_tokens 中，不需要重复计算）
        // cache_creation_input_tokens - 用于创建缓存的输入 token
        // cache_read_input_tokens - 从缓存读取的输入 token

        // 总消耗 = 输入 + 输出
        return inputTokens + outputTokens;
    }
    /**
     * 处理结果消息
     */
    private handleResultMessage(message: SDKMessage & { type: "result" }): void {
        const isSuccess = message.subtype === "success";

        if(isSuccess){
            this.broadcast({
                id: message.uuid,
                type: "result",
                success: isSuccess,
                sessionId: this.sessionId,
                cost: message.total_cost_usd,
                duration: message.duration_ms,
                tokens:this.calculateTotalTokens(message.usage)
            });
        }else{
            this.broadcast({
                id: message.uuid,
                type: "error",
                error: JSON.stringify(message.errors),
                sessionId: this.sessionId,
            });
        }

        // 如果是错误，记录错误信息
        if (!isSuccess && "errors" in message && message.errors) {
            logger.error("对话结果错误: ", { sessionId: this.sessionId, errors: message.errors });
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
        this.subscribers.forEach((subscriber) => {
            try {
                if (subscriber.readyState === subscriber.OPEN) {
                    subscriber.send(this.createSubscriberMessage(message));
                }
            } catch (error) {
                logger.error("广播消息失败", { error });
                this.subscribers.delete(subscriber);
            }
        });
    }

    private createSubscriberMessage(message:BroadcastMessage):SubscriberMessage{
        switch(message.type){
            case "user_message":
            case "assistant_message":return {
                    id:message.id,
                    type: message.type,
                    content: message.content,
                };
            case "tool_use":return {
                id:message.id,
                type: message.type,
                toolName: message.toolName,
                toolInput: JSON.stringify(message.toolInput)
            };
            case "result":return {
                id:message.id,
                type: message.type,
                cost: message.cost,
                duration: message.duration,
                tokens: message.tokens
            };
            case "error":return {
                id:message.id,
                type: message.type,
                error: message.error
            };
            default:return {
                id:'',
                type: 'error',
                error: '未知消息类型'
            };
        }
    }

    /**
     * 广播错误消息
     */
    private broadcastError(error: string): void {
        this.broadcast({
            id: crypto.randomUUID(),
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
