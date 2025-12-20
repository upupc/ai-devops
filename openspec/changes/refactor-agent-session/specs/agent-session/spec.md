# agent-session Specification Delta

## Purpose

定义 Agent 会话管理的核心需求，包括 Agent 客户端封装、消息队列机制和会话生命周期管理。

## ADDED Requirements

### Requirement: REQ-AS-001 Streaming Input 模式

系统 MUST 使用 Claude Agent SDK 的 Streaming Input 模式与 Agent 进行交互。

#### Scenario: 使用 AsyncGenerator 发送消息

**Given** 系统已创建 AgentSession
**When** 调用 `sendMessage(content)` 方法
**Then** 消息被推入 MessageQueue
**And** SDK 的 `query()` 函数通过 AsyncIterable 接收消息
**And** 开始异步处理

#### Scenario: 流式接收响应

**Given** Agent 正在处理消息
**When** Agent 产生响应
**Then** 响应通过 AsyncGenerator 流式返回
**And** 调用方可以通过 `getOutputStream()` 逐条接收

### Requirement: REQ-AS-002 消息队列机制

系统 MUST 实现消息队列支持消息排队和顺序处理。

#### Scenario: 消息入队

**Given** AgentSession 已创建
**When** 连续调用多次 `sendMessage()`
**Then** 消息按顺序入队
**And** Agent 按顺序处理消息

#### Scenario: 消息等待

**Given** 消息队列为空
**When** Agent 尝试获取下一条消息
**Then** Agent 阻塞等待直到有新消息
**Or** 队列关闭时结束等待

#### Scenario: 队列关闭

**Given** AgentSession 正在运行
**When** 调用 `close()` 方法
**Then** 消息队列关闭
**And** Agent 停止处理
**And** 资源被释放

### Requirement: REQ-AS-003 Agent 配置

系统 MUST 支持配置 Agent 参数。

#### Scenario: 配置工作目录

**Given** 创建新的 AgentSession
**When** 指定 `cwd` 参数
**Then** Agent 在指定目录下执行文件操作

#### Scenario: 配置允许的工具

**Given** 创建新的 AgentSession
**When** 指定 `allowedTools` 参数
**Then** Agent 只能使用指定的工具

#### Scenario: 配置系统提示词

**Given** 创建新的 AgentSession
**When** 指定 `systemPrompt` 参数
**Then** Agent 使用指定的系统提示词

### Requirement: REQ-AS-004 SDK 消息处理

系统 MUST 正确处理 SDK 返回的各类消息。

#### Scenario: 处理文本响应

**Given** Agent 返回文本消息
**When** 消息类型为 `assistant`
**And** content 包含 `text` 块
**Then** 提取文本内容
**And** 存储并广播给订阅者

#### Scenario: 处理工具调用

**Given** Agent 返回工具调用消息
**When** 消息类型为 `assistant`
**And** content 包含 `tool_use` 块
**Then** 提取工具名称和参数
**And** 广播工具调用信息给订阅者

#### Scenario: 处理结果消息

**Given** Agent 完成处理
**When** 消息类型为 `result`
**Then** 提取执行结果状态
**And** 提取费用和耗时信息
**And** 广播结果给订阅者

#### Scenario: 处理错误消息

**Given** Agent 处理过程中发生错误
**When** 消息包含错误信息
**Then** 提取错误详情
**And** 广播错误给订阅者
**And** 记录错误日志

### Requirement: REQ-AS-005 会话生命周期

系统 MUST 正确管理 AgentSession 的生命周期。

#### Scenario: 创建会话

**Given** 需要与 Agent 交互
**When** 创建新的 AgentSession
**Then** 初始化 MessageQueue
**And** 启动 SDK query
**And** 准备接收消息

#### Scenario: 关闭会话

**Given** AgentSession 正在运行
**When** 调用 `close()` 方法
**Then** 关闭 MessageQueue
**And** 等待当前消息处理完成
**And** 释放所有资源

#### Scenario: 会话清理

**Given** 用户删除会话
**When** 触发会话清理
**Then** 关闭对应的 AgentSession
**And** 删除相关存储数据
**And** 通知所有订阅者

## Cross-references

- 参考 `chat` 规格中的多轮对话需求 (REQ-CHAT-001)
- 参考 `workspace` 规格中的工作区管理需求 (REQ-WS-001)
