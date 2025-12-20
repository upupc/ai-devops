/**
 * 会话存储模块
 * 负责 Session、Workspace 和 Message 的存储管理
 */

import { Session, Workspace, Message } from "@/types";
import fs from "fs/promises";
import path from "path";

/**
 * 内存存储
 */
const sessionStore = new Map<string, Session>();
const workspaceStore = new Map<string, Workspace>();
const messageStore = new Map<string, Message[]>();

/**
 * 工作区根目录
 */
const WORKSPACES_ROOT = path.join(process.cwd(), "workspaces");

/**
 * 生成唯一 ID
 */
export function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取所有会话
 */
export function getAllSessions(): Session[] {
    return Array.from(sessionStore.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 获取单个会话
 */
export function getSession(sessionId: string): Session | undefined {
    return sessionStore.get(sessionId);
}

/**
 * 创建新会话
 */
export async function createSession(name: string): Promise<{ session: Session; workspace: Workspace }> {
    const sessionId = generateId();
    const workspaceId = generateId();

    const session: Session = {
        id: sessionId,
        name: name || `会话 ${sessionStore.size + 1}`,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const workspacePath = path.join(WORKSPACES_ROOT, sessionId);

    const workspace: Workspace = {
        id: workspaceId,
        sessionId,
        path: workspacePath,
        createdAt: new Date()
    };

    // 创建工作区目录
    await fs.mkdir(workspacePath, { recursive: true });

    sessionStore.set(sessionId, session);
    workspaceStore.set(workspaceId, workspace);
    messageStore.set(sessionId, []);

    return { session, workspace };
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    const workspace = workspaceStore.get(session.workspaceId);
    if (workspace) {
        // 删除工作区目录
        try {
            await fs.rm(workspace.path, { recursive: true, force: true });
        } catch {
            // 忽略删除错误
        }
        workspaceStore.delete(session.workspaceId);
    }

    messageStore.delete(sessionId);
    sessionStore.delete(sessionId);
}

/**
 * 获取会话的工作区
 */
export function getWorkspaceBySessionId(sessionId: string): Workspace | undefined {
    const session = sessionStore.get(sessionId);
    if (!session) return undefined;
    return workspaceStore.get(session.workspaceId);
}

/**
 * 获取工作区
 */
export function getWorkspace(workspaceId: string): Workspace | undefined {
    return workspaceStore.get(workspaceId);
}

/**
 * 获取会话消息
 */
export function getSessionMessages(sessionId: string): Message[] {
    return messageStore.get(sessionId) || [];
}

/**
 * 添加消息
 */
export function addMessage(sessionId: string, message: Omit<Message, "id" | "createdAt">): Message {
    const messages = messageStore.get(sessionId) || [];

    const newMessage: Message = {
        ...message,
        id: generateId(),
        createdAt: new Date()
    };

    messages.push(newMessage);
    messageStore.set(sessionId, messages);

    // 更新会话时间
    const session = sessionStore.get(sessionId);
    if (session) {
        session.updatedAt = new Date();
        sessionStore.set(sessionId, session);
    }

    return newMessage;
}

/**
 * 更新消息
 */
export function updateMessage(sessionId: string, messageId: string, content: string): void {
    const messages = messageStore.get(sessionId);
    if (!messages) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex >= 0) {
        messages[messageIndex].content += content;
        messageStore.set(sessionId, messages);
    }
}
