/**
 * Agent 客户端模块
 * 封装与 Claude Agent SDK 的交互
 */

import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSessionOptions } from "./types/agent";
import * as fs from "fs";
import * as path from "path";
import {Query} from "@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes";

/**
 * 系统提示词
 */
const DEFAULT_SYSTEM_PROMPT = `你是一个 AI 开发助手，可以帮助用户在工作区中进行文件操作和代码开发。

你有以下工具可以使用：
1. Read - 读取文件内容
2. Write - 创建或修改文件
3. Edit - 编辑现有文件
4. Bash - 执行终端命令
5. Glob - 搜索文件
6. Grep - 搜索文件内容

使用规则：
- 在执行任何文件操作前，先使用 Read 了解当前内容
- 写入文件时提供完整的文件内容
- 执行命令时只使用安全的命令
- 用中文与用户交流
- 对用户的问题给出清晰、有帮助的回答

请帮助用户完成开发任务。`;

/**
 * 默认允许的工具列表
 */
const DEFAULT_ALLOWED_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep"
];

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
    private queue = new MessageQueue();
    private outputIterator: AsyncIterator<SDKMessage> | null = null;
    private sessionId: string | null = null;
    private queryResult: Query | null = null;

    constructor(options?: AgentSessionOptions) {
        // 使用 Streaming Input 模式启动 query
        // 将消息队列作为 AsyncIterable 传入

        // 读取工作空间目录下的 SYSTEM.md 作为系统提示词
        let systemPrompt: { type: 'preset'; preset: 'claude_code' } | string = {
            type: 'preset',
            preset: 'claude_code'
        };

        if (options?.cwd) {
            const systemMdPath = path.join(options.cwd, "SYSTEM.md");
            try {
                if (fs.existsSync(systemMdPath)) {
                    const content = fs.readFileSync(systemMdPath, "utf-8").trim();
                    if (content) {
                        systemPrompt = content;
                    }
                }
            } catch (error) {
                // 读取失败时使用默认值，忽略错误
                console.error("Failed to read SYSTEM.md:", error);
            }
        }

        // 优先使用传入的model参数，否则使用默认值
        const model = options?.model || "claude-sonnet-4-5-20250929";

        const queryResult = query({
            prompt: this.queue as AsyncIterable<SDKUserMessage>,
            options: {
                maxTurns: options?.maxTurns ?? 100,
                model: model,
                systemPrompt: systemPrompt,
                cwd: options?.cwd,
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions:true,
                tools: {
                    type: "preset",
                    preset: "claude_code",
                },
                settingSources: ["project"],
                resume: options?.sessionId as any,
                stderr: data => console.log(data),
            }
        });

        this.queryResult = queryResult;
        this.outputIterator = queryResult[Symbol.asyncIterator]();
    }

    /**
     * 发送消息到 Agent
     */
    sendMessage(model:string|undefined,content: string): void {
        if (this.queue.isClosed()) {
            throw new Error("Session is closed");
        }
        if(model){
            this.queryResult?.setModel(model);
        }
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
            const { value, done } = await this.outputIterator.next();
            if (done) break;

            // 保存 session_id
            if (value.session_id && !this.sessionId) {
                this.sessionId = value.session_id;
            }

            yield value;
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
}
