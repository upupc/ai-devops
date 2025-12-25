# AI DevOps Agent

基于 Claude Agent SDK 的多轮对话 AI Agent Web 应用，提供 Chat 对话和 Agent 工作台两种模式。

## 功能特性

### Chat 模式 (`/chat`)
- **智能对话助手**: 与 Claude AI 进行多轮对话
- **会话管理**: 支持创建、切换、删除会话
- **Markdown 渲染**: 支持代码高亮和格式化输出
- **模型选择**: 支持 Haiku 4.5、Sonnet 4.5、Opus 4.5 三种模型

### Agent 工作台 (`/agent`)
- **工作区系统**: 独立的工作区目录，作为 Agent 的工作根目录
- **会话管理**: 每个工作区可包含多个会话，支持创建、切换、删除
- **三栏布局**: 聊天面板 | 文件浏览器 | 代码编辑器
- **文件浏览**: 树形结构展示和管理工作区文件
- **代码编辑**: 集成 Monaco Editor，支持语法高亮和实时保存
- **Agent 工具**: 支持文件读写、命令执行等操作
- **数据持久化**: 使用 SQLite 存储工作区、会话和消息数据
- **可调整面板**: 支持拖拽调整面板宽度

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端框架 | Next.js 15.1 (App Router) |
| UI 组件库 | Ant Design 5.22.6 |
| AI SDK | @anthropic-ai/claude-agent-sdk 0.1.76 |
| AI SDK | @anthropic-ai/sdk 0.71.2 |
| MCP SDK | @modelcontextprotocol/sdk 1.25.1 |
| 代码编辑器 | Monaco Editor 4.6.0 |
| Markdown 渲染 | react-markdown 10.1.0 |
| 代码高亮 | react-syntax-highlighter 16.1.0 |
| 数据库 | SQLite (better-sqlite3 12.5.0) |
| 运行时 | React 19.0 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Next.js 应用                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  前端 (React 19 + Ant Design 5)                                                  │
│  ┌──────────────┬────────────────┬─────────────────┬───────────────────────┐    │
│  │HomePage      │   ChatPage     │ AgentPage       │ WorkspaceSelector    │    │
│  │(入口选择)    │   (/chat)      │ (/agent)        │ (工作区选择)         │    │
│  └──────────────┴────────────────┴─────────────────┴───────────────────────┘    │
│  ┌──────────────┬────────────────┬─────────────────┐                            │
│  │ChatPanel     │FileBrowserPanel│ WorkspacePanel  │                            │
│  │(聊天面板)    │  (文件浏览器)   │  (代码编辑器)    │                            │
│  └──────────────┴────────────────┴─────────────────┘                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  后端 (Next.js API Routes)                                                       │
│  ├── /api/chat              - 聊天消息处理 (SSE)                                  │
│  ├── /api/sessions          - 会话管理                                            │
│  ├── /api/sessions/:id      - 单个会话操作                                         │
│  ├── /api/sessions/:id/messages - 消息历史                                       │
│  ├── /api/workspaces        - 工作区管理                                          │
│  ├── /api/workspaces/:id    - 单个工作区操作                                      │
│  ├── /api/workspaces/:id/sessions - 工作区会话列表                               │
│  ├── /api/workspaces/init   - 初始化默认工作区                                    │
│  └── /api/files             - 文件操作                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  核心服务层                                                                         │
│  ├── chat-session.ts        - 聊天会话管理 (业务层)                               │
│  ├── agent-client.ts        - Agent 客户端封装 (SDK层)                            │
│  ├── session-store.ts       - 会话/工作区存储                                     │
│  ├── file-service.ts        - 文件服务                                            │
│  ├── agent-tools.ts         - Agent 工具定义                                     │
│  ├── store.tsx              - 全局状态管理 (Context + Reducer)                    │
│  └── database.ts            - SQLite 数据库                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  数据存储                                                                           │
│  ├── .data/ai-devops.db     - SQLite 数据库文件                                   │
│  ├── workspaces/            - 工作区文件存储                                      │
│  └── setting-template/      - 工作区模板 (含 .mcp.json)                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-devops/
├── src/
│   ├── app/                                # Next.js App Router
│   │   ├── api/                            # API 路由
│   │   │   ├── chat/
│   │   │   │   └── route.ts                # 聊天 API (SSE 流式响应)
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts                # 获取/创建会话
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts            # 获取/删除单个会话
│   │   │   │       └── messages/
│   │   │   │           └── route.ts        # 获取会话消息
│   │   │   ├── workspaces/
│   │   │   │   ├── route.ts                # 获取/创建工作区
│   │   │   │   ├── init/
│   │   │   │   │   └── route.ts            # 初始化默认工作区
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts            # 获取/更新/删除工作区
│   │   │   │       └── sessions/
│   │   │   │           └── route.ts        # 获取/创建工作区会话
│   │   │   └── files/
│   │   │       ├── route.ts                # 获取文件树/创建文件
│   │   │       └── [...path]/
│   │   │           └── route.ts            # 读取/更新/删除文件
│   │   ├── chat/
│   │   │   ├── page.tsx                    # Chat 页面
│   │   │   └── chat.module.css             # Chat 页面样式
│   │   ├── agent/
│   │   │   └── page.tsx                    # Agent 工作台页面
│   │   ├── layout.tsx                      # 根布局
│   │   ├── page.tsx                        # 首页 (入口选择)
│   │   └── globals.css                     # 全局样式
│   ├── components/                         # React 组件
│   │   ├── ChatPanel/                      # 聊天面板组件
│   │   │   ├── index.tsx
│   │   │   └── ChatPanel.module.css
│   │   ├── FileBrowserPanel/               # 文件浏览面板组件
│   │   │   ├── index.tsx
│   │   │   └── FileBrowserPanel.module.css
│   │   ├── WorkspacePanel/                 # 工作区面板组件 (代码编辑器)
│   │   │   ├── index.tsx
│   │   │   └── WorkspacePanel.module.css
│   │   └── WorkspaceSelector/              # 工作区选择器组件
│   │       ├── index.tsx
│   │       └── WorkspaceSelector.module.css
│   ├── lib/                                # 核心库
│   │   ├── agent-client.ts                 # Agent 客户端封装
│   │   │                                    # - MessageQueue 类 (消息队列)
│   │   │                                    # - AgentSession 类 (SDK 封装)
│   │   │                                    # - 空闲超时管理 (30秒)
│   │   ├── agent-tools.ts                  # Agent 工具定义与执行
│   │   │                                    # - read_file, write_file, execute_command
│   │   │                                    # - 命令白名单校验
│   │   ├── chat-session.ts                 # 聊天会话管理 (业务层)
│   │   │                                    # - ChatSession 类
│   │   │                                    # - 消息广播机制
│   │   ├── database.ts                     # SQLite 数据库
│   │   │                                    # - 表结构初始化
│   │   │                                    # - WAL 模式
│   │   ├── logger.ts                       # 日志服务 (winston)
│   │   │                                    # - 支持控制台和文件输出
│   │   │                                    # - 支持日志级别配置
│   │   ├── file-service.ts                 # 文件服务
│   │   │                                    # - 文件树构建
│   │   │                                    # - 路径安全校验
│   │   │                                    # - 敏感文件保护
│   │   ├── session-store.ts                # 会话/工作区存储
│   │   │                                    # - CRUD 操作
│   │   │                                    # - 目录复制
│   │   ├── store.tsx                       # 全局状态管理
│   │   │                                    # - AppState 接口
│   │   │                                    # - AppAction 类型
│   │   │                                    # - appReducer
│   │   │                                    # - AppProvider Context
│   │   └── types/
│   │       └── agent.ts                    # Agent 相关类型定义
│   └── types/                              # TypeScript 类型定义
│       └── index.ts                        # 核心类型
│           # Workspace, Session, Message
│           # ToolCall, FileNode, OpenFile
├── .data/                                  # 数据目录 (gitignore)
│   └── ai-devops.db                        # SQLite 数据库
├── workspaces/                             # 工作区文件存储 (gitignore)
├── setting-template/                       # 工作区模板
│   ├── .mcp.json                           # MCP 服务器配置
│   ├── CLAUDE.md                           # Claude 指令
│   └── AGENTS.md                           # OpenSpec 指令
├── openspec/                               # OpenSpec 规格文档
├── next.config.js                          # Next.js 配置
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 环境要求

- Node.js 18+
- npm
- Claude API Key

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env.local` 文件：

```env
ANTHROPIC_API_KEY=your_api_key_here

# 日志配置
# 日志级别: error, warn, info, http, verbose, debug, silly
LOG_LEVEL=info
# 日志目录路径 (留空则仅输出到控制台)
LOG_DIR=
```

从 https://console.anthropic.com/ 获取 API Key。

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm run start
```

## 数据模型

### Workspace (工作区)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 工作区名称 |
| path | string | 工作区目录路径 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

### Session (会话)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 会话名称 |
| workspaceId | string | 所属工作区 ID |
| agentSessionId | string? | Agent SDK 会话 ID |
| model | string? | 选用的模型 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

### Message (消息)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| sessionId | string | 所属会话 ID |
| role | 'user' \| 'assistant' | 消息角色 |
| content | string | 消息内容 |
| toolCalls | ToolCall[]? | 工具调用记录 |
| createdAt | Date | 创建时间 |

### ToolCall (工具调用)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 工具调用 ID |
| name | string | 工具名称 |
| input | Record\<string, unknown\> | 工具输入参数 |
| output | string? | 工具输出结果 |
| status | 'pending' \| 'running' \| 'completed' \| 'failed' | 执行状态 |

## Agent 工具

Agent 支持以下工具：

| 工具 | 功能 | 说明 |
|------|------|------|
| read_file | 读取文件 | 读取工作区中的文件内容 |
| write_file | 写入文件 | 创建或修改文件 |
| execute_command | 执行命令 | 在工作区中执行终端命令 |

### 命令白名单

出于安全考虑，`execute_command` 工具仅支持以下命令：

```
ls, cat, echo, mkdir, touch, rm, cp, mv,
npm, npx, node, python, python3, pip, pip3,
git, curl, wget, head, tail, wc, grep, find,
pwd, which, env, date, whoami
```

### 敏感文件保护

以下文件类型受保护，无法通过工具读写：

```
.env, .env.local, credentials, secrets, .git
```

## API 接口

### 工作区管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/workspaces | 获取所有工作区 |
| POST | /api/workspaces | 创建新工作区 |
| GET | /api/workspaces/:id | 获取单个工作区 |
| PATCH | /api/workspaces/:id | 更新工作区名称 |
| DELETE | /api/workspaces/:id | 删除工作区 |
| POST | /api/workspaces/init | 获取或创建指定 ID 的工作区 |

### 工作区会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/workspaces/:id/sessions | 获取工作区的所有会话 |
| POST | /api/workspaces/:id/sessions | 在工作区下创建新会话 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions | 获取所有会话 |
| POST | /api/sessions | 创建新会话 |
| GET | /api/sessions/:id | 获取单个会话 |
| DELETE | /api/sessions/:id | 删除会话 |
| GET | /api/sessions/:id/messages | 获取会话消息 |

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat | 发送消息 (SSE 流式响应) |

### 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/files | 获取文件树 |
| POST | /api/files | 创建文件/目录 |
| GET | /api/files/[...path] | 读取文件内容 |
| PUT | /api/files/[...path] | 更新文件内容 |
| DELETE | /api/files/[...path] | 删除文件/目录 |

## 配置文件

### next.config.js

```javascript
module.exports = {
    transpilePackages: ['antd', '@ant-design/icons'],
}
```

配置 Next.js 转译 Ant Design 组件以支持 React 19。

### .mcp.json (工作区模板)

工作区创建时会复制此配置，包含 MCP 服务器设置：

- `context7`: 文档检索服务
- `amap-maps-streamableHTTP`: 高德地图服务

### CLAUDE.md (工作区模板)

设置 AI 助手使用中文回复，引用项目指令文件。

## 架构设计要点

### 1. Streaming Input 模式

`agent-client.ts` 使用 Claude Agent SDK 的 Streaming Input 模式：

- `MessageQueue` 类实现异步迭代器，支持消息排队和顺序处理
- `AgentSession` 类封装 SDK 交互，支持会话恢复和空闲超时管理
- 空闲超时默认 30 秒，超时后自动重新创建 query

### 2. 会话管理架构

`chat-session.ts` 提供业务层会话管理：

- `ChatSession` 类协调 `AgentSession` 和数据存储
- 消息广播机制支持多订阅者 (SSE 连接)
- 自动保存 `agentSessionId` 以支持会话恢复

### 3. 状态管理

`store.tsx` 使用 React Context + Reducer 模式：

- 集中管理工作区、会话、消息、文件树状态
- 支持跨组件状态共享
- 类型安全的 Action 派发

### 4. 文件安全

`file-service.ts` 实现多层安全防护：

- 路径校验：防止目录遍历攻击
- 敏感文件保护：禁止读取敏感配置文件
- 路径沙箱：确保操作限制在工作区目录内

### 5. 数据库设计

`database.ts` 使用 better-sqlite3：

- WAL 模式提升并发性能
- 外键级联删除
- 索引优化查询性能
- 自动迁移 model 字段

## 许可证

MIT
