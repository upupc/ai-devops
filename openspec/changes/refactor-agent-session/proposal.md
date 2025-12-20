# 变更提案: refactor-agent-session

## 概述

重构 `src/lib` 目录下的 Agent 对话代码和 Session 管理代码，采用 Claude Agent SDK 推荐的 **Streaming Input 模式**，使架构更加清晰、可维护，并符合 SDK 最佳实践。

## 背景

### 当前状态

现有代码使用 Claude Agent SDK 的 **V2 Preview 接口**（`unstable_v2_createSession`/`unstable_v2_resumeSession`），存在以下问题：

1. **使用非稳定 API**: 当前使用 `unstable_v2_*` 接口，这些接口可能会变化
2. **架构分散**: Session 管理逻辑分布在 `agent-service.ts` 和 `session-manager.ts` 两个文件中
3. **职责混乱**:
   - `agent-service.ts` 同时处理 Session 创建、消息发送、流式响应
   - `session-manager.ts` 混合了应用层 Session 和工作区管理
4. **缺少消息队列**: 当前实现不支持消息队列机制，无法处理并发消息
5. **代码复杂度高**: 大量类型断言和手动消息处理

### 目标状态

采用 SDK 推荐的 **Streaming Input 模式**，参考示例代码重构为：

1. **单一职责的 AgentSession 类**: 封装与 Claude Agent 的所有交互
2. **消息队列机制**: 支持消息排队和顺序处理
3. **清晰的分层**:
   - `agent-client.ts` - 底层 SDK 交互
   - `chat-session.ts` - 业务层会话管理
   - `session-store.ts` - 会话和工作区存储

## 影响范围

### 涉及文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/lib/agent-service.ts` | 删除/重写 | 拆分为 `agent-client.ts` |
| `src/lib/session-manager.ts` | 重构 | 重命名为 `session-store.ts`，专注存储 |
| `src/lib/agent-client.ts` | 新建 | 封装 Agent SDK 交互 |
| `src/lib/chat-session.ts` | 新建 | 业务层会话管理 |
| `src/lib/types/agent.ts` | 新建 | Agent 相关类型定义 |
| `src/app/api/chat/route.ts` | 修改 | 适配新接口 |

### 涉及规格

- `chat` - 多轮对话相关需求
- `workspace` - 工作区管理相关需求

## 设计要点

### 1. 采用 Streaming Input 模式

使用 SDK 官方推荐的 `query()` 函数配合 AsyncGenerator：

```typescript
// 消息队列作为 AsyncIterable 传入
const response = query({
  prompt: messageQueue, // AsyncIterable<UserMessage>
  options: {
    maxTurns: 100,
    model: "claude-sonnet-4-20250514",
    allowedTools: ["Read", "Write", "Edit", "Bash"],
    systemPrompt: SYSTEM_PROMPT
  }
});
```

### 2. 消息队列机制

实现 `MessageQueue` 类支持：
- 异步消息推送
- 消息顺序处理
- 会话关闭

### 3. 分层架构

```
┌─────────────────────────────────────────┐
│           API Routes (route.ts)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         ChatSession (chat-session.ts)    │
│  - 业务逻辑                               │
│  - 消息存储                               │
│  - 订阅管理                               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       AgentSession (agent-client.ts)     │
│  - SDK 交互                              │
│  - 消息队列                               │
│  - 流式输出                               │
└─────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          SessionStore (session-store.ts) │
│  - Session 存储                          │
│  - Workspace 存储                        │
│  - Message 存储                          │
└─────────────────────────────────────────┘
```

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| API 兼容性变化 | 中 | 保持原有 API 路由接口不变 |
| 数据丢失 | 低 | 当前为内存存储，重启即丢失 |
| 功能回退 | 低 | 增量实现，逐步替换 |

## 追踪信息

- **Aone 需求**: 暂无追踪链接
- **提案日期**: 2025-12-20
- **状态**: 待审批
