# AI DevOps Agent

基于 Claude Agent SDK 的多轮对话 AI Agent Web 应用。

## 功能特性

- **多轮对话**: 支持与 AI Agent 进行连续的多轮对话
- **会话管理**: 创建、切换、删除对话会话
- **工作区系统**: 每个会话拥有独立的工作区目录
- **文件浏览**: 树形结构展示和管理工作区文件
- **代码编辑**: 集成 Monaco Editor，支持语法高亮
- **Agent 工具**: 支持文件读写、代码编辑、命令执行等操作

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端框架 | Next.js 15 (App Router) |
| UI 组件库 | Ant Design 5 |
| AI SDK | @anthropic-ai/claude-agent-sdk (V2 Preview) |
| 代码编辑器 | Monaco Editor |
| 运行时 | React 19 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 应用                            │
├─────────────────────────────────────────────────────────────┤
│  前端 (React + Ant Design)                                   │
│  ┌─────────────┬───────────────────┬─────────────────┐      │
│  │   聊天框     │      工作区        │    文件浏览器    │      │
│  │  (Chat)     │   (Workspace)     │  (FileBrowser)  │      │
│  └─────────────┴───────────────────┴─────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  后端 (Next.js API Routes)                                   │
│  ├── /api/chat           - 聊天消息处理                      │
│  ├── /api/sessions       - 会话管理                          │
│  └── /api/files          - 文件操作                          │
├─────────────────────────────────────────────────────────────┤
│  Claude Agent SDK (V2)                                       │
│  ├── unstable_v2_createSession  - 创建会话                   │
│  ├── unstable_v2_resumeSession  - 恢复会话                   │
│  └── session.send/stream        - 多轮对话                   │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-devops/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API 路由
│   │   │   ├── chat/             # 聊天 API
│   │   │   ├── sessions/         # 会话管理 API
│   │   │   └── files/            # 文件操作 API
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 首页
│   ├── components/               # React 组件
│   │   ├── ChatPanel/            # 聊天面板
│   │   ├── WorkspacePanel/       # 工作区面板
│   │   └── FileBrowserPanel/     # 文件浏览面板
│   ├── lib/                      # 工具库
│   │   ├── agent-service.ts      # Agent 服务
│   │   ├── session-manager.ts    # 会话管理
│   │   ├── file-service.ts       # 文件服务
│   │   └── store.tsx             # 状态管理
│   └── types/                    # TypeScript 类型
├── workspaces/                   # 工作区文件存储
├── openspec/                     # 规格文档
├── package.json
└── tsconfig.json
```

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
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

## Agent 工具能力

Agent 支持以下工具：

| 工具 | 功能 |
|------|------|
| Read | 读取工作区中的文件内容 |
| Write | 创建或修改文件 |
| Edit | 编辑现有文件的指定部分 |
| Bash | 在工作区中执行终端命令 |
| Glob | 按模式搜索文件 |
| Grep | 搜索文件内容 |

## API 接口

### 会话管理

- `POST /api/sessions` - 创建新会话
- `GET /api/sessions` - 获取所有会话
- `GET /api/sessions/:id` - 获取单个会话
- `DELETE /api/sessions/:id` - 删除会话

### 聊天

- `POST /api/chat` - 发送消息（SSE 流式响应）

### 文件操作

- `GET /api/files` - 获取文件树
- `POST /api/files` - 创建文件/目录
- `GET /api/files/[...path]` - 读取文件
- `PUT /api/files/[...path]` - 更新文件
- `DELETE /api/files/[...path]` - 删除文件

## 开发说明

### Claude Agent SDK V2

本项目使用 Claude Agent SDK V2 Preview 接口，基于 `session.send()`/`session.stream()` 模式实现多轮对话：

```typescript
import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk'

// 创建会话
const session = unstable_v2_createSession({ model: 'claude-sonnet-4-20250514' })

// 发送消息
await session.send('Hello!')

// 接收流式响应
for await (const msg of session.stream()) {
    // 处理响应
}

// 关闭会话
session.close()
```

### Ant Design + React 19

使用 `@ant-design/v5-patch-for-react-19` 补丁包解决兼容性问题。

## 许可证

MIT
