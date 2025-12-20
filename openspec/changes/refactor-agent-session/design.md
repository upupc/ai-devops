# 技术设计: refactor-agent-session

## 1. 架构概览

### 1.1 当前架构问题

```
当前架构:
┌─────────────────────────────────────────────────┐
│                 agent-service.ts                 │
│  ┌─────────────────────────────────────────┐    │
│  │  V2 Session 管理                         │    │
│  │  - unstable_v2_createSession            │    │
│  │  - unstable_v2_resumeSession            │    │
│  │  - appToSessionStore (Map)              │    │
│  │  - appToAgentSessionIdStore (Map)       │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  消息处理                                 │    │
│  │  - extractTextFromMessage()             │    │
│  │  - hasToolUse()                         │    │
│  │  - detectFileChanged()                  │    │
│  │  - getToolCallInfo()                    │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  流式响应                                 │    │
│  │  - sendMessageToAgent()                 │    │
│  │  - StreamCallback                       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              session-manager.ts                  │
│  - Session/Workspace/Message 存储               │
│  - Agent 清理回调 (耦合)                         │
└─────────────────────────────────────────────────┘

问题:
1. agent-service.ts 职责过多
2. 使用非稳定 V2 API
3. 没有消息队列机制
4. session-manager 与 agent 耦合
```

### 1.2 目标架构

```
目标架构:
┌─────────────────────────────────────────────────┐
│                  API Layer                       │
│              (route.ts 保持不变)                  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              chat-session.ts                     │
│  ChatSession 类                                  │
│  - 业务逻辑编排                                   │
│  - 订阅者管理                                     │
│  - SDK 消息处理                                   │
│  - 消息持久化                                     │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼                           ▼
┌───────────────────┐   ┌───────────────────────┐
│  agent-client.ts  │   │   session-store.ts    │
│                   │   │                       │
│  AgentSession 类  │   │  - sessionStore       │
│  - MessageQueue   │   │  - workspaceStore     │
│  - query() 调用   │   │  - messageStore       │
│  - 流式输出       │   │                       │
└───────────────────┘   └───────────────────────┘

优势:
1. 单一职责
2. 使用稳定 API (query + Streaming Input)
3. 支持消息队列
4. 解耦存储和 Agent 逻辑
```

## 2. 核心组件设计

### 2.1 MessageQueue 类

```typescript
// src/lib/agent-client.ts

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
};

class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  /**
   * 推送消息到队列
   * 如果有等待的消费者，直接传递；否则入队
   */
  push(content: string): void {
    const msg: UserMessage = {
      type: "user",
      message: { role: "user", content },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  /**
   * 异步迭代器实现
   * 支持 for await...of 消费消息
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<UserMessage>((resolve) => {
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
  }
}
```

### 2.2 AgentSession 类

```typescript
// src/lib/agent-client.ts

import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `你是一个 AI 开发助手...`;

export class AgentSession {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<SDKMessage> | null = null;

  constructor(options?: AgentSessionOptions) {
    // 使用 Streaming Input 模式启动 query
    this.outputIterator = query({
      prompt: this.queue as AsyncIterable<UserMessage>,
      options: {
        maxTurns: options?.maxTurns ?? 100,
        model: options?.model ?? "claude-sonnet-4-20250514",
        allowedTools: options?.allowedTools ?? [
          "Read", "Write", "Edit", "Bash",
          "Glob", "Grep"
        ],
        systemPrompt: options?.systemPrompt ?? SYSTEM_PROMPT,
        cwd: options?.cwd,
      },
    })[Symbol.asyncIterator]();
  }

  /**
   * 发送消息到 Agent
   */
  sendMessage(content: string): void {
    this.queue.push(content);
  }

  /**
   * 获取输出流
   */
  async *getOutputStream(): AsyncGenerator<SDKMessage> {
    if (!this.outputIterator) {
      throw new Error("Session not initialized");
    }
    while (true) {
      const { value, done } = await this.outputIterator.next();
      if (done) break;
      yield value;
    }
  }

  /**
   * 关闭会话
   */
  close(): void {
    this.queue.close();
  }
}
```

### 2.3 ChatSession 类

```typescript
// src/lib/chat-session.ts

import { AgentSession } from "./agent-client";
import { sessionStore } from "./session-store";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export class ChatSession {
  public readonly sessionId: string;
  private agentSession: AgentSession;
  private subscribers: Set<Subscriber> = new Set();
  private isListening = false;

  constructor(sessionId: string, workspacePath: string) {
    this.sessionId = sessionId;
    this.agentSession = new AgentSession({
      cwd: workspacePath,
    });
  }

  /**
   * 发送用户消息
   */
  sendMessage(content: string): void {
    // 1. 存储用户消息
    sessionStore.addMessage(this.sessionId, {
      role: "user",
      content,
    });

    // 2. 广播用户消息
    this.broadcast({
      type: "user_message",
      content,
      sessionId: this.sessionId,
    });

    // 3. 发送到 Agent
    this.agentSession.sendMessage(content);

    // 4. 开始监听响应
    if (!this.isListening) {
      this.startListening();
    }
  }

  /**
   * 启动监听 Agent 输出
   */
  private async startListening(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;

    try {
      for await (const message of this.agentSession.getOutputStream()) {
        this.handleSDKMessage(message);
      }
    } catch (error) {
      this.broadcastError((error as Error).message);
    }
  }

  /**
   * 处理 SDK 消息
   */
  private handleSDKMessage(message: SDKMessage): void {
    if (message.type === "assistant") {
      this.handleAssistantMessage(message);
    } else if (message.type === "result") {
      this.handleResultMessage(message);
    }
  }

  /**
   * 处理助手消息
   */
  private handleAssistantMessage(message: SDKAssistantMessage): void {
    const content = message.message.content;

    if (Array.isArray(content)) {
      content.forEach((block) => {
        if (block.type === "text") {
          // 存储并广播文本
          sessionStore.addMessage(this.sessionId, {
            role: "assistant",
            content: block.text,
          });
          this.broadcast({
            type: "assistant_message",
            content: block.text,
            sessionId: this.sessionId,
          });
        } else if (block.type === "tool_use") {
          // 广播工具调用
          this.broadcast({
            type: "tool_use",
            toolName: block.name,
            toolId: block.id,
            toolInput: block.input,
            sessionId: this.sessionId,
          });
        }
      });
    }
  }

  /**
   * 处理结果消息
   */
  private handleResultMessage(message: SDKResultMessage): void {
    this.broadcast({
      type: "result",
      success: message.subtype === "success",
      sessionId: this.sessionId,
      cost: message.total_cost_usd,
      duration: message.duration_ms,
    });
  }

  // ... 订阅管理方法
}
```

### 2.4 SessionStore

```typescript
// src/lib/session-store.ts

import type { Session, Workspace, Message } from "@/types";

/**
 * 会话存储（内存实现）
 */
const sessionStore = new Map<string, Session>();
const workspaceStore = new Map<string, Workspace>();
const messageStore = new Map<string, Message[]>();

export const sessionStore = {
  // Session CRUD
  getSession(id: string): Session | undefined { ... },
  createSession(name: string): Promise<{ session: Session; workspace: Workspace }> { ... },
  deleteSession(id: string): Promise<void> { ... },
  getAllSessions(): Session[] { ... },

  // Workspace
  getWorkspace(sessionId: string): Workspace | undefined { ... },

  // Messages
  getMessages(sessionId: string): Message[] { ... },
  addMessage(sessionId: string, message: Omit<Message, 'id' | 'timestamp'>): Message { ... },
};
```

## 3. 数据流

### 3.1 发送消息流程

```
User Input
    │
    ▼
┌─────────────────┐
│   API Route     │  POST /api/chat
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ChatSession    │  chatSession.sendMessage(content)
│  .sendMessage() │
└────────┬────────┘
         │
         ├─────────────────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  SessionStore   │   │  AgentSession   │
│  .addMessage()  │   │  .sendMessage() │
└─────────────────┘   └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  MessageQueue   │
                      │  .push()        │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  query()        │
                      │  (SDK)          │
                      └─────────────────┘
```

### 3.2 接收响应流程

```
┌─────────────────┐
│  query()        │  AsyncGenerator<SDKMessage>
│  (SDK)          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AgentSession   │  getOutputStream()
│  .stream()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ChatSession    │  handleSDKMessage()
│  .listen()      │
└────────┬────────┘
         │
         ├─────────────────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  SessionStore   │   │  Broadcast      │
│  .addMessage()  │   │  (WebSocket)    │
└─────────────────┘   └─────────────────┘
```

## 4. 类型定义

```typescript
// src/lib/types/agent.ts

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Agent 会话配置
 */
export interface AgentSessionOptions {
  model?: string;
  maxTurns?: number;
  allowedTools?: string[];
  systemPrompt?: string;
  cwd?: string;
}

/**
 * 用户消息
 */
export interface UserMessage {
  type: "user";
  message: {
    role: "user";
    content: string;
  };
}

/**
 * 广播消息类型
 */
export type BroadcastMessage =
  | { type: "user_message"; content: string; sessionId: string }
  | { type: "assistant_message"; content: string; sessionId: string }
  | { type: "tool_use"; toolName: string; toolId: string; toolInput: unknown; sessionId: string }
  | { type: "result"; success: boolean; sessionId: string; cost?: number; duration?: number }
  | { type: "error"; error: string; sessionId: string };

/**
 * 订阅者接口
 */
export interface Subscriber {
  send(message: string): void;
  readyState: number;
  OPEN: number;
}
```

## 5. 迁移策略

### 5.1 渐进式迁移

1. **阶段 1**: 创建新文件，不修改现有代码
2. **阶段 2**: 在 API 层添加切换开关
3. **阶段 3**: 验证新实现功能正确
4. **阶段 4**: 删除旧实现

### 5.2 兼容性保证

- API 路由接口保持不变
- WebSocket 消息格式保持不变
- 存储数据结构保持不变

## 6. 测试策略

### 6.1 单元测试

- MessageQueue 测试
- AgentSession 测试（mock SDK）
- ChatSession 测试（mock AgentSession）
- SessionStore 测试

### 6.2 集成测试

- 完整消息流程测试
- 多轮对话测试
- 并发消息测试
- 错误处理测试
