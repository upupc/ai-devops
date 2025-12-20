# 设计文档：构建多轮对话 Agent 应用

## 1. 架构设计

### 1.1 整体架构

采用 Next.js 前后端一体化架构，所有服务部署在同一端口上。

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (浏览器)                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    React 应用                              │ │
│  │  ┌─────────────┬───────────────────┬─────────────────┐   │ │
│  │  │  ChatPanel  │  WorkspacePanel   │ FileBrowserPanel │   │ │
│  │  └──────┬──────┴─────────┬─────────┴────────┬────────┘   │ │
│  │         │                │                  │             │ │
│  │         ▼                ▼                  ▼             │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │              状态管理 (Context/Zustand)              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP/SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js 服务端                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    API Routes                              │ │
│  │  ┌────────────┬───────────────┬─────────────────────────┐ │ │
│  │  │ /api/chat  │ /api/workspace │      /api/files        │ │ │
│  │  └─────┬──────┴───────┬───────┴────────────┬────────────┘ │ │
│  │        │              │                    │              │ │
│  │        ▼              ▼                    ▼              │ │
│  │  ┌───────────┐  ┌───────────┐      ┌───────────────┐     │ │
│  │  │  Agent    │  │ Workspace │      │  FileSystem   │     │ │
│  │  │  Service  │  │  Manager  │      │   Service     │     │ │
│  │  └─────┬─────┘  └───────────┘      └───────────────┘     │ │
│  │        │                                    │             │ │
│  └────────┼────────────────────────────────────┼─────────────┘ │
│           │                                    │               │
│           ▼                                    ▼               │
│  ┌─────────────────┐                ┌─────────────────────┐   │
│  │ Claude Agent SDK│                │   本地文件系统       │   │
│  └─────────────────┘                │   (workspaces/)     │   │
│                                     └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技术选型理由

| 技术 | 选型理由 |
|------|----------|
| **Next.js App Router** | 支持 RSC、流式渲染、API Routes 一体化，简化部署 |
| **Ant Design** | 企业级 UI 组件库，组件丰富，符合 PRD 要求 |
| **Claude Agent SDK v2** | 官方 SDK，send/receive 模式更清晰，便于多轮对话 |
| **Monaco Editor** | VS Code 同款编辑器，功能强大，生态完善 |
| **Zustand** | 轻量级状态管理，API 简洁，性能优秀 |

## 2. 数据模型设计

### 2.1 核心实体

```typescript
// 会话
interface Session {
  id: string;                    // 会话 ID
  name: string;                  // 会话名称
  workspaceId: string;           // 关联的工作区 ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  claudeSessionId?: string;      // Claude SDK 会话 ID
}

// 消息
interface Message {
  id: string;                    // 消息 ID
  sessionId: string;             // 所属会话 ID
  role: 'user' | 'assistant';    // 角色
  content: string;               // 消息内容
  toolCalls?: ToolCall[];        // 工具调用（如果有）
  createdAt: Date;               // 创建时间
}

// 工具调用
interface ToolCall {
  id: string;                    // 工具调用 ID
  name: string;                  // 工具名称
  input: Record<string, any>;    // 输入参数
  output?: string;               // 输出结果
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// 工作区
interface Workspace {
  id: string;                    // 工作区 ID
  sessionId: string;             // 关联的会话 ID
  path: string;                  // 工作区路径
  createdAt: Date;               // 创建时间
}

// 文件节点
interface FileNode {
  name: string;                  // 文件名
  path: string;                  // 相对路径
  type: 'file' | 'directory';    // 类型
  children?: FileNode[];         // 子节点（目录时）
  size?: number;                 // 文件大小
  modifiedAt?: Date;             // 修改时间
}
```

### 2.2 状态管理

```typescript
// 全局状态
interface AppState {
  // 会话状态
  sessions: Session[];
  currentSessionId: string | null;

  // 消息状态
  messages: Message[];
  isLoading: boolean;

  // 工作区状态
  workspace: Workspace | null;
  fileTree: FileNode | null;

  // 编辑器状态
  openFiles: string[];
  activeFile: string | null;
  fileContents: Record<string, string>;
  modifiedFiles: Set<string>;
}
```

## 3. API 设计

### 3.1 聊天 API

```typescript
// POST /api/chat
// 发送消息并获取 Agent 响应
interface ChatRequest {
  sessionId: string;
  message: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  toolCalls?: ToolCall[];
}

// GET /api/chat/stream
// SSE 流式响应
// Event: message - 消息片段
// Event: tool_call - 工具调用开始
// Event: tool_result - 工具调用结果
// Event: done - 完成
```

### 3.2 会话 API

```typescript
// GET /api/sessions
// 获取所有会话
interface SessionsResponse {
  sessions: Session[];
}

// POST /api/sessions
// 创建新会话
interface CreateSessionRequest {
  name?: string;
}

interface CreateSessionResponse {
  session: Session;
  workspace: Workspace;
}

// DELETE /api/sessions/:id
// 删除会话
```

### 3.3 文件 API

```typescript
// GET /api/files?workspaceId=xxx
// 获取文件树
interface FileTreeResponse {
  tree: FileNode;
}

// GET /api/files/:path?workspaceId=xxx
// 读取文件内容
interface FileContentResponse {
  content: string;
  encoding: string;
}

// POST /api/files
// 创建文件
interface CreateFileRequest {
  workspaceId: string;
  path: string;
  content?: string;
  type: 'file' | 'directory';
}

// PUT /api/files/:path
// 更新文件内容
interface UpdateFileRequest {
  workspaceId: string;
  content: string;
}

// DELETE /api/files/:path?workspaceId=xxx
// 删除文件
```

## 4. Agent 工具设计

### 4.1 工具定义

```typescript
const tools = [
  {
    name: 'read_file',
    description: '读取工作区中的文件内容',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件相对路径'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: '创建或修改工作区中的文件',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件相对路径'
        },
        content: {
          type: 'string',
          description: '文件内容'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'execute_command',
    description: '在工作区中执行终端命令',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令'
        }
      },
      required: ['command']
    }
  }
];
```

### 4.2 安全策略

```typescript
// 路径安全校验
function validatePath(workspacePath: string, filePath: string): boolean {
  const absolutePath = path.resolve(workspacePath, filePath);
  // 确保路径在工作区内
  return absolutePath.startsWith(workspacePath);
}

// 命令白名单
const ALLOWED_COMMANDS = [
  'ls', 'cat', 'echo', 'mkdir', 'touch', 'rm',
  'npm', 'node', 'python', 'pip',
  'git', 'curl', 'wget'
];

function validateCommand(command: string): boolean {
  const cmd = command.split(' ')[0];
  return ALLOWED_COMMANDS.includes(cmd);
}
```

## 5. 组件设计

### 5.1 组件层次

```
App
├── Layout
│   ├── Sider (可调整宽度)
│   │   └── ChatPanel
│   │       ├── SessionList
│   │       ├── MessageList
│   │       │   └── MessageItem
│   │       │       └── ToolCallDisplay
│   │       └── MessageInput
│   ├── Content
│   │   └── WorkspacePanel
│   │       ├── EditorTabs
│   │       └── MonacoEditor
│   └── Sider (可调整宽度)
│       └── FileBrowserPanel
│           ├── FileTree
│           └── FileActions
└── GlobalModals
    ├── CreateSessionModal
    └── ConfirmDeleteModal
```

### 5.2 关键组件 Props

```typescript
// ChatPanel
interface ChatPanelProps {
  sessionId: string | null;
  onSessionChange: (id: string) => void;
}

// WorkspacePanel
interface WorkspacePanelProps {
  workspaceId: string | null;
  activeFile: string | null;
  onFileChange: (path: string) => void;
  onFileSave: (path: string, content: string) => void;
}

// FileBrowserPanel
interface FileBrowserPanelProps {
  workspaceId: string | null;
  fileTree: FileNode | null;
  onFileSelect: (path: string) => void;
  onFileCreate: (path: string, type: 'file' | 'directory') => void;
  onFileDelete: (path: string) => void;
}
```

## 6. 流程设计

### 6.1 用户发送消息流程

```
用户输入消息
      │
      ▼
前端发送 POST /api/chat
      │
      ▼
后端接收消息，获取/创建 Claude Session
      │
      ▼
调用 session.send(message)
      │
      ▼
遍历 session.receive() 获取响应
      │
      ├─────────────────────────────────────┐
      │                                     │
      ▼                                     ▼
  文本响应                              工具调用
      │                                     │
      ▼                                     ▼
  流式返回给前端                       执行工具
      │                                     │
      │                                     ▼
      │                              返回工具结果
      │                                     │
      │                                     ▼
      │                              Agent 继续响应
      │                                     │
      ▼                                     │
前端更新消息列表 ◄──────────────────────────┘
      │
      ▼
如果有文件变更，刷新文件树
```

### 6.2 工作区初始化流程

```
用户创建新会话
      │
      ▼
后端生成会话 ID 和工作区 ID
      │
      ▼
在 workspaces/ 下创建工作区目录
      │
      ▼
初始化 Claude Session
      │
      ▼
返回会话和工作区信息
      │
      ▼
前端切换到新会话
      │
      ▼
加载空的文件树
```

## 7. 权衡与决策

### 7.1 状态管理方案选择

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| React Context | 内置，无需额外依赖 | 大型应用性能问题 | - |
| Redux | 生态完善，调试工具强 | 样板代码多 | - |
| **Zustand** | 轻量，API 简洁 | 生态较小 | ✅ 选用 |

**决策理由**：应用规模适中，Zustand 的简洁 API 能够满足需求，减少开发复杂度。

### 7.2 流式响应方案选择

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **SSE** | HTTP 协议，简单易实现 | 单向通信 | ✅ 选用 |
| WebSocket | 双向通信 | 需要额外配置 | - |
| Polling | 兼容性好 | 延迟高，资源浪费 | - |

**决策理由**：Agent 响应是单向的，SSE 完全满足需求且实现简单。

### 7.3 会话存储方案选择

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **内存** | 简单，无需额外依赖 | 重启丢失数据 | ✅ MVP 阶段选用 |
| SQLite | 轻量级持久化 | 需要额外依赖 | 后续优化 |
| Redis | 高性能，支持分布式 | 部署复杂 | - |

**决策理由**：MVP 阶段优先验证功能，后续根据需要添加持久化。

## 8. 安全考虑

### 8.1 文件系统安全

1. **路径遍历防护**：所有文件操作都校验路径是否在工作区内
2. **敏感文件保护**：禁止访问 `.env`、`credentials` 等敏感文件
3. **文件大小限制**：限制单个文件读写大小（如 5MB）

### 8.2 命令执行安全

1. **命令白名单**：只允许执行预定义的安全命令
2. **参数过滤**：过滤危险参数（如 `rm -rf /`）
3. **执行超时**：设置命令执行超时时间（如 30 秒）
4. **沙箱执行**：后续可考虑使用 Docker 容器隔离

### 8.3 API 安全

1. **输入校验**：所有 API 输入进行严格校验
2. **速率限制**：限制 API 调用频率
3. **CORS 配置**：正确配置跨域策略

## 9. 性能优化策略

1. **文件树懒加载**：只加载展开的目录
2. **编辑器按需加载**：Monaco Editor 动态导入
3. **消息虚拟列表**：大量消息时使用虚拟滚动
4. **SSE 连接复用**：避免频繁建立连接
5. **文件内容缓存**：缓存已打开文件的内容
