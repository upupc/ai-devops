/**
 * 会话存储模块
 * 使用 better-sqlite3 进行 Session、Workspace 和 Message 的持久化存储
 */

import { Session, Workspace, Message, ToolCall } from "@/types";
import { db, WorkspaceRow, SessionRow, MessageRow } from "./database";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

/**
 * 工作区根目录
 */
const WORKSPACES_ROOT = path.join(process.cwd(), "workspaces");

/**
 * 设置模板源目录
 */
const SETTING_TEMPLATE_SOURCE = path.join(process.cwd(), "setting-template");

/**
 * 生成唯一 ID
 */
export function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 确保工作区根目录存在
 */
function ensureWorkspacesRoot(): void {
    if (!fs.existsSync(WORKSPACES_ROOT)) {
        fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
    }
}

/**
 * 递归复制目录
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
    await fsPromises.mkdir(dest, { recursive: true });
    const entries = await fsPromises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fsPromises.copyFile(srcPath, destPath);
        }
    }
}

// ==================== Workspace 操作 ====================

/**
 * 将数据库行转换为 Workspace 对象
 */
function rowToWorkspace(row: WorkspaceRow): Workspace {
    return {
        id: row.id,
        name: row.name,
        path: row.path,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
    };
}

/**
 * 获取所有工作区
 */
export function getAllWorkspaces(): Workspace[] {
    const stmt = db.prepare(`
        SELECT * FROM workspaces ORDER BY updated_at DESC
    `);
    const rows = stmt.all() as WorkspaceRow[];
    return rows.map(rowToWorkspace);
}

/**
 * 获取单个工作区
 */
export function getWorkspace(workspaceId: string): Workspace | undefined {
    const stmt = db.prepare(`SELECT * FROM workspaces WHERE id = ?`);
    const row = stmt.get(workspaceId) as WorkspaceRow | undefined;
    return row ? rowToWorkspace(row) : undefined;
}

/**
 * 创建新工作区
 * 创建独立目录并复制 setting-template 内容
 */
export async function createWorkspace(name: string): Promise<Workspace> {
    ensureWorkspacesRoot();

    const workspaceId = generateId();
    const workspacePath = path.join(WORKSPACES_ROOT, workspaceId);
    const now = new Date().toISOString();

    // 创建工作区目录
    await fsPromises.mkdir(workspacePath, { recursive: true });

    // 复制 setting-template 内容到工作区目录
    if (fs.existsSync(SETTING_TEMPLATE_SOURCE)) {
        await copyDirectory(SETTING_TEMPLATE_SOURCE, workspacePath);
    }

    // 插入数据库
    const stmt = db.prepare(`
        INSERT INTO workspaces (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(workspaceId, name || `工作区 ${Date.now()}`, workspacePath, now, now);

    return {
        id: workspaceId,
        name: name || `工作区 ${Date.now()}`,
        path: workspacePath,
        createdAt: new Date(now),
        updatedAt: new Date(now)
    };
}

/**
 * 更新工作区
 */
export function updateWorkspace(workspaceId: string, updates: Partial<Pick<Workspace, 'name'>>): Workspace | undefined {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) return undefined;

    const now = new Date().toISOString();
    const newName = updates.name ?? workspace.name;

    const stmt = db.prepare(`
        UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newName, now, workspaceId);

    return {
        ...workspace,
        name: newName,
        updatedAt: new Date(now)
    };
}

/**
 * 删除工作区（同时删除所有关联的 session）
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) return;

    // 删除工作区目录
    try {
        await fsPromises.rm(workspace.path, { recursive: true, force: true });
    } catch {
        // 忽略删除错误
    }

    // 删除数据库记录（级联删除 sessions 和 messages）
    const stmt = db.prepare(`DELETE FROM workspaces WHERE id = ?`);
    stmt.run(workspaceId);
}

// ==================== Session 操作 ====================

/**
 * 将数据库行转换为 Session 对象
 */
function rowToSession(row: SessionRow): Session {
    return {
        id: row.id,
        name: row.name,
        workspaceId: row.workspace_id,
        agentSessionId: row.agent_session_id || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
    };
}

/**
 * 获取所有会话
 */
export function getAllSessions(): Session[] {
    const stmt = db.prepare(`
        SELECT * FROM sessions ORDER BY updated_at DESC
    `);
    const rows = stmt.all() as SessionRow[];
    return rows.map(rowToSession);
}

/**
 * 获取工作区的所有会话
 */
export function getSessionsByWorkspaceId(workspaceId: string): Session[] {
    const stmt = db.prepare(`
        SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC
    `);
    const rows = stmt.all(workspaceId) as SessionRow[];
    return rows.map(rowToSession);
}

/**
 * 获取单个会话
 */
export function getSession(sessionId: string): Session | undefined {
    const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
    const row = stmt.get(sessionId) as SessionRow | undefined;
    return row ? rowToSession(row) : undefined;
}

/**
 * 在指定工作区下创建新会话
 */
export function createSession(workspaceId: string, name: string): Session {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
    }

    const sessionId = generateId();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO sessions (id, name, workspace_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(sessionId, name || `会话 ${Date.now()}`, workspaceId, now, now);

    // 更新工作区的 updated_at
    const updateWorkspaceStmt = db.prepare(`
        UPDATE workspaces SET updated_at = ? WHERE id = ?
    `);
    updateWorkspaceStmt.run(now, workspaceId);

    return {
        id: sessionId,
        name: name || `会话 ${Date.now()}`,
        workspaceId,
        createdAt: new Date(now),
        updatedAt: new Date(now)
    };
}

/**
 * 创建工作区和会话（便捷方法，保持向后兼容）
 */
export async function createWorkspaceAndSession(name: string): Promise<{ workspace: Workspace; session: Session }> {
    const workspace = await createWorkspace(name);
    const session = createSession(workspace.id, name);
    return { workspace, session };
}

/**
 * 更新会话
 */
export function updateSession(sessionId: string, updates: Partial<Pick<Session, 'name' | 'agentSessionId'>>): Session | undefined {
    const session = getSession(sessionId);
    if (!session) return undefined;

    const now = new Date().toISOString();
    const newName = updates.name ?? session.name;
    const newAgentSessionId = updates.agentSessionId ?? session.agentSessionId;

    const stmt = db.prepare(`
        UPDATE sessions SET name = ?, agent_session_id = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newName, newAgentSessionId || null, now, sessionId);

    return {
        ...session,
        name: newName,
        agentSessionId: newAgentSessionId,
        updatedAt: new Date(now)
    };
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): void {
    const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
    stmt.run(sessionId);
}

/**
 * 获取会话所属的工作区
 */
export function getWorkspaceBySessionId(sessionId: string): Workspace | undefined {
    const session = getSession(sessionId);
    if (!session) return undefined;
    return getWorkspace(session.workspaceId);
}

// ==================== Message 操作 ====================

/**
 * 将数据库行转换为 Message 对象
 */
function rowToMessage(row: MessageRow): Message {
    return {
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) as ToolCall[] : undefined,
        createdAt: new Date(row.created_at)
    };
}

/**
 * 获取会话消息
 */
export function getSessionMessages(sessionId: string): Message[] {
    const stmt = db.prepare(`
        SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
    `);
    const rows = stmt.all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
}

/**
 * 添加消息
 */
export function addMessage(sessionId: string, message: Omit<Message, "id" | "createdAt">): Message {
    const session = getSession(sessionId);
    if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

    const messageId = generateId();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO messages (id, session_id, role, content, tool_calls, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        messageId,
        sessionId,
        message.role,
        message.content,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        now
    );

    // 更新会话的 updated_at
    const updateSessionStmt = db.prepare(`
        UPDATE sessions SET updated_at = ? WHERE id = ?
    `);
    updateSessionStmt.run(now, sessionId);

    return {
        id: messageId,
        sessionId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        createdAt: new Date(now)
    };
}

/**
 * 更新消息内容（用于流式追加）
 */
export function updateMessage(sessionId: string, messageId: string, content: string): void {
    const stmt = db.prepare(`
        UPDATE messages SET content = content || ? WHERE id = ? AND session_id = ?
    `);
    stmt.run(content, messageId, sessionId);
}

/**
 * 删除会话的所有消息
 */
export function deleteSessionMessages(sessionId: string): void {
    const stmt = db.prepare(`DELETE FROM messages WHERE session_id = ?`);
    stmt.run(sessionId);
}
