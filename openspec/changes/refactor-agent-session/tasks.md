# 任务清单: refactor-agent-session

## 阶段 1: 基础设施准备

- [ ] **T1.1** 创建类型定义文件 `src/lib/types/agent.ts`
  - 定义 `UserMessage` 类型
  - 定义 `AgentMessage` 类型
  - 定义 `StreamCallback` 接口
  - 验证: TypeScript 编译通过

- [ ] **T1.2** 创建 `MessageQueue` 类
  - 实现异步迭代器接口
  - 实现 `push()` 方法
  - 实现 `close()` 方法
  - 验证: 单元测试通过

## 阶段 2: Agent 客户端重构

- [ ] **T2.1** 创建 `src/lib/agent-client.ts`
  - 实现 `AgentSession` 类
  - 使用 `query()` 函数配合 Streaming Input
  - 实现 `sendMessage()` 方法
  - 实现 `getOutputStream()` 方法
  - 验证: 能够发送消息并接收响应

- [ ] **T2.2** 配置 Agent 参数
  - 设置 `systemPrompt`
  - 设置 `allowedTools`
  - 设置 `maxTurns`
  - 设置 `model`
  - 验证: Agent 功能正常

## 阶段 3: Session 存储重构

- [ ] **T3.1** 重构 `session-manager.ts` 为 `session-store.ts`
  - 移除 Agent 相关逻辑
  - 保留纯存储功能
  - 更新导出接口
  - 验证: 存储功能正常

- [ ] **T3.2** 更新存储数据结构
  - Session 存储
  - Workspace 存储
  - Message 存储
  - 验证: CRUD 操作正常

## 阶段 4: 业务层会话管理

- [ ] **T4.1** 创建 `src/lib/chat-session.ts`
  - 实现 `ChatSession` 类
  - 管理 `AgentSession` 生命周期
  - 处理消息存储
  - 实现订阅者广播
  - 验证: 业务逻辑正常

- [ ] **T4.2** 实现 SDK 消息处理
  - 处理 `assistant` 消息
  - 处理 `result` 消息
  - 处理工具调用消息
  - 处理错误消息
  - 验证: 所有消息类型处理正确

## 阶段 5: API 适配

- [ ] **T5.1** 更新 `src/app/api/chat/route.ts`
  - 适配新的 ChatSession 接口
  - 保持 API 兼容性
  - 验证: API 调用正常

- [ ] **T5.2** 更新其他依赖文件
  - 更新 import 路径
  - 删除废弃代码
  - 验证: 无编译错误

## 阶段 6: 测试与验收

- [ ] **T6.1** 功能测试
  - 创建会话测试
  - 发送消息测试
  - 多轮对话测试
  - 工具调用测试
  - 验证: 所有功能正常

- [ ] **T6.2** 清理工作
  - 删除 `agent-service.ts`
  - 删除无用代码
  - 更新文档
  - 验证: 代码整洁

## 依赖关系

```
T1.1 ──┬──> T2.1 ──> T2.2 ──┐
       │                     │
T1.2 ──┘                     ├──> T4.1 ──> T4.2 ──> T5.1 ──> T5.2 ──> T6.1 ──> T6.2
                             │
T3.1 ──> T3.2 ───────────────┘
```

## 可并行任务

- T1.1 和 T1.2 可并行
- T2.x 和 T3.x 可并行
- T6.1 和 T6.2 需顺序执行

## 验收标准

1. **功能完整**: 所有现有功能保持正常
2. **代码质量**: TypeScript 编译无错误
3. **架构清晰**: 职责分离，层次清晰
4. **SDK 兼容**: 使用官方推荐的 Streaming Input 模式
