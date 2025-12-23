/**
 * 工作区接口定义
 * Workspace 是独立的工作空间，可以包含多个 Session
 */
export interface Workspace {
    id: string
    name: string
    /** 工作区独立目录路径，作为 claude agent 的工作根目录 */
    path: string
    createdAt: Date
    updatedAt: Date
}

/**
 * 会话接口定义
 * Session 属于某个 Workspace，一个 Workspace 可以有多个 Session
 */
export interface Session {
    id: string
    name: string
    workspaceId: string
    agentSessionId?: string  // claude-agent-sdk 会话 ID
    model?: string
    createdAt: Date
    updatedAt: Date
}

/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant'

/**
 * 工具调用状态
 */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * 工具调用接口
 */
export interface ToolCall {
    id: string
    name: string
    input: Record<string, unknown>
    output?: string
    status: ToolCallStatus
}

/**
 * 消息接口定义
 */
export interface Message {
    id: string
    sessionId: string
    role: MessageRole
    content: string
    toolCalls?: ToolCall[]
    createdAt: Date
}

/**
 * 文件节点类型
 */
export type FileNodeType = 'file' | 'directory'

/**
 * 文件节点接口
 */
export interface FileNode {
    name: string
    path: string
    type: FileNodeType
    children?: FileNode[]
    size?: number
    modifiedAt?: Date
}

/**
 * 打开的文件信息
 */
export interface OpenFile {
    path: string
    content: string
    modified: boolean
}
