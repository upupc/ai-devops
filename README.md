# AI DevOps Agent

基于 Claude Agent SDK 的多轮对话 AI Agent Web 应用。

## 功能特性

- **多轮对话**: 支持与 AI Agent 进行连续的多轮对话
- **工作区系统**: 独立的工作区目录，作为 Agent 的工作根目录
- **会话管理**: 每个工作区可包含多个会话，支持创建、切换、删除
- **文件浏览**: 树形结构展示和管理工作区文件
- **代码编辑**: 集成 Monaco Editor，支持语法高亮
- **Agent 工具**: 支持文件读写、命令执行等操作
- **数据持久化**: 使用 SQLite 存储工作区、会话和消息数据

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端框架 | Next.js 15 (App Router) |
| UI 组件库 | Ant Design 5 |
| AI SDK | @anthropic-ai/claude-agent-sdk |
| 代码编辑器 | Monaco Editor |
| 数据库 | SQLite (better-sqlite3) |
| 运行时 | React 19 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 应用                            │
├─────────────────────────────────────────────────────────────┤
│  前端 (React + Ant Design)                                   │
│  ┌──────────────┬────────────────┬─────────────────┐        │
│  │ WorkspacePanel│   ChatPanel    │ FileBrowserPanel│        │
│  │  (工作区选择)  │   (聊天对话)    │   (文件浏览)    │        │
│  └──────────────┴────────────────┴─────────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  后端 (Next.js API Routes)                                   │
│  ├── /api/chat              - 聊天消息处理 (SSE)              │
│  ├── /api/sessions          - 会话管理                       │
│  ├── /api/sessions/:id      - 单个会话操作                    │
│  └── /api/files             - 文件操作                       │
├─────────────────────────────────────────────────────────────┤
│  核心服务层                                                   │
│  ├── chat-session.ts        - 聊天会话管理                    │
│  ├── agent-client.ts        - Agent 客户端                   │
│  ├── session-store.ts       - 会话存储                       │
│  ├── file-service.ts        - 文件服务                       │
│  └── database.ts            - SQLite 数据库                  │
├─────────────────────────────────────────────────────────────┤
│  数据存储                                                     │
│  ├── .data/ai-devops.db     - SQLite 数据库文件               │
│  └── workspaces/            - 工作区文件存储                  │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-devops/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API 路由
│   │   │   ├── chat/                 # 聊天 API (SSE)
│   │   │   ├── files/                # 文件操作 API
│   │   │   └── sessions/             # 会话管理 API
│   │   │       └── [id]/             # 单个会话操作
│   │   │           ├── messages/     # 消息历史
│   │   │           └── workspace/    # 工作区信息
│   │   ├── layout.tsx                # 根布局
│   │   └── page.tsx                  # 首页
│   ├── components/                   # React 组件
│   │   ├── ChatPanel/                # 聊天面板
│   │   ├── FileBrowserPanel/         # 文件浏览面板
│   │   ├── WorkspacePanel/           # 工作区面板
│   │   └── WorkspaceSelector/        # 工作区选择器
│   ├── lib/                          # 核心库
│   │   ├── agent-client.ts           # Agent 客户端封装
│   │   ├── agent-tools.ts            # Agent 工具定义
│   │   ├── chat-session.ts           # 聊天会话管理
│   │   ├── database.ts               # SQLite 数据库
│   │   ├── file-service.ts           # 文件服务
│   │   ├── session-store.ts          # 会话存储
│   │   ├── store.tsx                 # 全局状态管理
│   │   └── types/                    # 内部类型
│   └── types/                        # TypeScript 类型定义
│       └── index.ts                  # 核心类型
├── .data/                            # 数据目录 (gitignore)
│   └── ai-devops.db                  # SQLite 数据库
├── workspaces/                       # 工作区文件存储 (gitignore)
├── openspec/                         # OpenSpec 规格文档
├── package.json
└── tsconfig.json
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
```

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
| agentSessionId | string | Agent SDK 会话 ID |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

### Message (消息)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| sessionId | string | 所属会话 ID |
| role | 'user' \| 'assistant' | 消息角色 |
| content | string | 消息内容 |
| toolCalls | ToolCall[] | 工具调用记录 |
| createdAt | Date | 创建时间 |

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

## API 接口

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions | 获取所有会话 |
| POST | /api/sessions | 创建新会话 |
| GET | /api/sessions/:id | 获取单个会话 |
| DELETE | /api/sessions/:id | 删除会话 |
| GET | /api/sessions/:id/messages | 获取会话消息 |
| GET | /api/sessions/:id/workspace | 获取会话工作区 |

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

## 许可证

MIT
