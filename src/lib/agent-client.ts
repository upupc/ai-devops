/**
 * Agent 客户端模块
 * 封装与 Claude Agent SDK 的交互
 */

import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSessionOptions } from "./types/agent";
import * as fs from "fs";
import * as path from "path";
import {Query} from "@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes";
import { createLogger } from "./logger";
import { getWorkspace } from "@/lib/session-store";
import {Mutex} from 'async-mutex';

const logger = createLogger("AgentClient");
const mutex = new Mutex();
/**
 * 消息队列类
 * 实现异步迭代器接口，支持消息排队和顺序处理
 */
class MessageQueue {
    private messages: SDKUserMessage[] = [];
    private waiting: ((msg: SDKUserMessage) => void) | null = null;
    private closed = false;

    /**
     * 推送消息到队列
     * 如果有等待的消费者，直接传递；否则入队
     */
    push(content: string): void {
        const msg: SDKUserMessage = {
            type: "user",
            session_id: "",
            parent_tool_use_id: null,
            message: {
                role: "user",
                content
            }
        };

        if (this.waiting) {
            // 有消费者在等待，直接传递
            this.waiting(msg);
            this.waiting = null;
        } else {
            // 没有等待的消费者，消息入队
            this.messages.push(msg);
        }
    }

    /**
     * 异步迭代器实现
     * 支持 for await...of 消费消息
     */
    async *[Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
        while (!this.closed) {
            if (this.messages.length > 0) {
                // 队列中有消息，直接返回
                yield this.messages.shift()!;
            } else {
                // 队列为空，等待新消息
                yield await new Promise<SDKUserMessage>((resolve) => {
                    this.waiting = resolve;
                });
            }
        }
    }

    /**
     * 关闭队列
     */
    close(): void {
        this.closed = true;
        // 如果有等待的消费者，需要让它退出
        if (this.waiting) {
            // 发送一个空消息让迭代器退出
            this.waiting({
                type: "user",
                session_id: "",
                parent_tool_use_id: null,
                message: { role: "user", content: "" }
            });
            this.waiting = null;
        }
    }

    /**
     * 检查队列是否已关闭
     */
    isClosed(): boolean {
        return this.closed;
    }
}

/**
 * Agent 会话类
 * 封装与 Claude Agent 的所有交互
 */
export class AgentSession {
    private options: AgentSessionOptions | undefined;
    private queue = new MessageQueue();
    private outputIterator: AsyncIterator<SDKMessage> | null = null;
    private sessionId: string | null = null;
    private queryResult: Query | null = null;
    private lastMessageTime: number = Date.now();
    private timeoutId: NodeJS.Timeout | null = null;
    private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 15分钟
    private idleTimedOut = false; // 是否因空闲超时终止
    private abortController: AbortController|null = null;

    constructor(options?: AgentSessionOptions) {
        this.options = options;
    }

    public async init() {
        this.abortController = new AbortController();
        this.queryResult = await this.createQuery(this.options);
        this.outputIterator = this.queryResult[Symbol.asyncIterator]();
        this.idleTimedOut = false;
        this.resetIdleTimer();
    }

    /**
     * 重置空闲计时器
     */
    private resetIdleTimer(): void {
        this.lastMessageTime = Date.now();

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.timeoutId = setTimeout(async () => {
            await this.handleIdleTimeout();
        }, this.IDLE_TIMEOUT);
    }

    /**
     * 处理空闲超时
     */
    private async handleIdleTimeout(): Promise<void> {
        if (this.queryResult) {
            this.idleTimedOut = true;
            await this.queryResult.interrupt();
            if(!this.abortController?.signal.aborted){
                this.abortController?.abort('idle timeout');
            }
            this.outputIterator?.return?.();
            this.abortController = null;
            this.queryResult = null;
            this.outputIterator = null;
        }
    }

    /**
     * 重新创建 query
     */
    private async recreateQuery(options?: AgentSessionOptions): Promise<void> {
        // 清理旧的 AbortController
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.options = {...this.options, ...options};

        // 创建新的 query
        await this.init();
    }

    async createQuery(options?: AgentSessionOptions) {
        const release = await mutex.acquire();
        try{
            return await this.doCreateQuery(options);
        }finally {
            release();
        }
    }

    async doCreateQuery(options?: AgentSessionOptions) {

        const workspace = getWorkspace(options?.workspaceId as string);
        const claudeConfigPath = path.join(workspace?.path as string, ".claude");
        // 使用 Streaming Input 模式启动 query
        // 将消息队列作为 AsyncIterable 传入

        // 读取工作空间目录下的 SYSTEM.md 作为系统提示词
        let systemPrompt: { type: "preset"; preset: "claude_code"; append?: string|undefined } | string = {
            type: 'preset',
            preset: 'claude_code',
            append: `You must answer the questions in Chinese.
            <global_paramters>
            ${JSON.stringify(workspace)}
            </global_paramters>
            `
        };

        if (options?.cwd) {
            const systemMdPath = path.join(options.cwd, "SYSTEM.md");
            try {
                if (fs.existsSync(systemMdPath)) {
                    const content = fs.readFileSync(systemMdPath, "utf-8").trim();
                    if (content) {
                        systemPrompt.append += content;
                    }
                }
            } catch (error) {
                logger.warn("读取 SYSTEM.md 失败", { error });
            }
        }
        // 优先使用传入的model参数，否则使用默认值
        const model = options?.model || "claude-sonnet-4-5-20250929";

        try{
            process.env.CLAUDE_CONFIG_DIR=claudeConfigPath;
            return await query({
                prompt: this.queue as AsyncIterable<SDKUserMessage>,
                options: {
                    maxTurns: options?.maxTurns ?? 100,
                    model: model,
                    systemPrompt: systemPrompt,
                    cwd: options?.cwd,
                    permissionMode: "bypassPermissions",
                    allowDangerouslySkipPermissions: true,
                    tools: {
                        type: "preset",
                        preset: "claude_code",
                    },
                    settingSources: ["project"],
                    resume: options?.sessionId as any,
                    stderr: data => logger.error("claude-agent-sdk", { data }),
                    abortController: this.abortController as any
                }
            });
        }finally {
            delete process.env.CLAUDE_CONFIG_DIR;
        }
    }

    /**
     * 发送消息到 Agent
     */
    async sendMessage(model:string|undefined,content: string): Promise<void> {
        if (this.queue.isClosed()) {
            throw new Error("Session is closed");
        }

        // 检查当前 query 是否已取消
        if (this.idleTimedOut) {
            logger.info("检测到 query 已取消，重新创建 query");
            await this.recreateQuery({model:model,...this.options});
        } else if (model) {
            // 只有在 query 未取消时才尝试设置模型
            this.queryResult?.setModel(model);
        }

        // 重置空闲计时器
        this.resetIdleTimer();

        // 推送消息到队列
        this.queue.push(content);
    }

    /**
     * 获取输出流
     * 返回 AsyncGenerator 供调用方消费
     */
    async *getOutputStream(): AsyncGenerator<SDKMessage> {
        if (!this.outputIterator) {
            throw new Error("Session not initialized");
        }

        while (true) {
            try {
                const { value, done } = await this.outputIterator.next();
                if (done) break;
                // 保存 session_id
                if (value.session_id && !this.sessionId) {
                    this.sessionId = value.session_id;
                }

                // 重置空闲计时器
                this.resetIdleTimer();

                yield value;
            } catch (error) {
                logger.warn("Claude Query 因空闲超时被终止", { sessionId: this.sessionId, error });
                await this.handleIdleTimeout();
                return;
            }
        }
    }

    /**
     * 获取 SDK Session ID
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * 关闭会话
     */
    close(): void {
        this.queue.close();
    }

    isIdleTimedOut(): boolean {
        return this.idleTimedOut;
    }
}
