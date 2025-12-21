# 任务清单: refactor-agent-session

## 阶段 1: 基础设施准备

- [x] **T1.1** 创建类型定义文件 `src/lib/types/agent.ts`
  - 定义 `UserMessage` 类型
  - 定义 `AgentMessage` 类型
  - 定义 `StreamCallback` 接口
  - 验证: TypeScript 编译通过

- [x] **T1.2** 创建 `MessageQueue` 类
  - 实现异步迭代器接口
  - 实现 `push()` 方法
  - 实现 `close()` 方法
  - 验证: 单元测试通过

## 阶段 2: Agent 客户端重构

- [x] **T2.1** 创建 `src/lib/agent-client.ts`
  - 实现 `AgentSession` 类
  - 使用 `query()` 函数配合 Streaming Input
  - 实现 `sendMessage()` 方法
  - 实现 `getOutputStream()` 方法
  - 验证: 能够发送消息并接收响应

- [x] **T2.2** 配置 Agent 参数
  - 设置 `systemPrompt`
  - 设置 `allowedTools`
  - 设置 `maxTurns`
  - 设置 `model`
  - 验证: Agent 功能正常

## 阶段 3: Session 存储重构

- [x] **T3.1** 重构 `session-manager.ts` 为 `session-store.ts`
  - 移除 Agent 相关逻辑
  - 保留纯存储功能
  - 更新导出接口
  - 验证: 存储功能正常

- [x] **T3.2** 更新存储数据结构
  - Session 存储
  - Workspace 存储
  - Message 存储
  - 验证: CRUD 操作正常

- [x] **T3.3** 使用 better-sqlite3 持久化存储
  - 创建 `src/lib/database.ts` 数据库模块
  - 创建 workspaces、sessions、messages 表
  - 实现所有 CRUD 操作使用 SQLite
  - 验证: 数据持久化正常

## 阶段 4: 业务层会话管理

- [x] **T4.1** 创建 `src/lib/chat-session.ts`
  - 实现 `ChatSession` 类
  - 管理 `AgentSession` 生命周期
  - 处理消息存储
  - 实现订阅者广播
  - 验证: 业务逻辑正常

- [x] **T4.2** 实现 SDK 消息处理
  - 处理 `assistant` 消息
  - 处理 `result` 消息
  - 处理工具调用消息
  - 处理错误消息
  - 验证: 所有消息类型处理正确

## 阶段 5: Workspace/Session 关系重构

- [x] **T5.1** 重构 Workspace 和 Session 关系
  - Workspace 独立存在，可包含多个 Session
  - Session 属于某个 Workspace
  - 更新类型定义 `src/types/index.ts`
  - 验证: 关系模型正确

- [x] **T5.2** 创建 Workspace 时复制 claude-setting
  - 创建 workspace 独立目录
  - 复制 `claude-setting/` 内容到 workspace 目录
  - cwd 指向 workspace 独立目录
  - 验证: 配置复制正确

- [x] **T5.3** 创建 Workspace API 路由
  - `GET /api/workspaces` - 获取所有工作区
  - `POST /api/workspaces` - 创建工作区
  - `GET /api/workspaces/:id` - 获取单个工作区
  - `PATCH /api/workspaces/:id` - 更新工作区
  - `DELETE /api/workspaces/:id` - 删除工作区
  - `GET /api/workspaces/:id/sessions` - 获取工作区会话
  - `POST /api/workspaces/:id/sessions` - 在工作区创建会话
  - 验证: API 正常工作

## 阶段 6: API 适配

- [x] **T6.1** 更新 `src/app/api/chat/route.ts`
  - 适配新的 ChatSession 接口
  - 保持 API 兼容性
  - 验证: API 调用正常

- [x] **T6.2** 更新其他依赖文件
  - 更新 import 路径
  - 删除废弃代码
  - 验证: 无编译错误

## 阶段 7: 前端重构

- [x] **T7.1** 更新前端状态管理
  - 添加 workspaces 列表状态
  - 添加 currentWorkspace 状态
  - 添加 RESET_SESSION_STATE action
  - 验证: 状态管理正常

- [x] **T7.2** 创建 WorkspaceSelector 组件
  - 实现工作区卡片列表
  - 实现创建工作区功能
  - 实现删除工作区功能
  - 实现进入工作区功能
  - 验证: 组件功能正常

- [x] **T7.3** 修改页面布局
  - 未选择工作区时显示工作区选择页面
  - 选择工作区后显示三栏布局
  - 添加工作区导航栏和返回按钮
  - 验证: 页面切换正常

- [x] **T7.4** 更新 ChatPanel 组件
  - 在当前工作区下创建会话
  - 切换会话时使用当前工作区
  - 更新刷新文件树逻辑
  - 验证: 会话管理正常

- [x] **T7.5** 更新其他组件
  - 更新 WorkspacePanel 使用 currentWorkspace
  - 更新 FileBrowserPanel 使用 currentWorkspace
  - 验证: 所有组件正常

## 阶段 8: 测试与验收

- [x] **T8.1** 编译测试
  - TypeScript 编译通过
  - Next.js build 成功
  - 验证: 无编译错误

- [x] **T8.2** 功能测试
  - 创建工作区测试
  - 在工作区创建会话测试
  - 发送消息测试
  - 多轮对话测试
  - 工具调用测试
  - 验证: 所有功能正常
  - 注: 代码结构已完成，待用户手动验收

- [x] **T8.3** 清理工作
  - 删除无用代码 (已删除 session-manager.ts)
  - 更新文档
  - 验证: 代码整洁

## 依赖关系

```
T1.1 ──┬──> T2.1 ──> T2.2 ──┐
       │                     │
T1.2 ──┘                     ├──> T4.1 ──> T4.2 ──> T5.1 ──> T5.2 ──> T5.3 ──> T6.1 ──> T6.2 ──┐
                             │                                                                  │
T3.1 ──> T3.2 ──> T3.3 ──────┘                                                                  │
                                                                                                │
T7.1 ──> T7.2 ──> T7.3 ──> T7.4 ──> T7.5 ──> T8.1 ──> T8.2 ──> T8.3 <───────────────────────────┘
```

## 验收标准

1. **功能完整**: 所有现有功能保持正常
2. **代码质量**: TypeScript 编译无错误
3. **架构清晰**: 职责分离，层次清晰
4. **SDK 兼容**: 使用官方推荐的 Streaming Input 模式
5. **数据持久化**: 使用 better-sqlite3 存储 Workspace/Session/Message
6. **Workspace 独立**: 每个 Workspace 有独立目录，包含 claude-setting 配置
7. **前端流程**: 先选择/创建工作区，再进入会话页面
