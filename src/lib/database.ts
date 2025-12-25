/**
 * SQLite 数据库模块
 * 使用 better-sqlite3 进行数据持久化
 */

import Database from "better-sqlite3";
import path from "path";

/**
 * 数据库文件路径
 */
const DB_PATH = path.join(process.cwd(), ".data", "ai-devops.db");

/**
 * 全局数据库实例（避免 HMR 导致多次初始化）
 */
const globalForDb = globalThis as unknown as {
    db: Database.Database | undefined;
};

/**
 * 获取数据库实例
 */
function getDatabase(): Database.Database {
    if (!globalForDb.db) {
        // 确保数据目录存在
        const fs = require("fs");
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // 创建数据库连接
        globalForDb.db = new Database(DB_PATH);

        // 启用 WAL 模式以提高并发性能
        globalForDb.db.pragma("journal_mode = WAL");

        // 初始化表结构
        initializeTables(globalForDb.db);
    }
    return globalForDb.db;
}

/**
 * 初始化数据库表结构
 */
function initializeTables(db: Database.Database): void {
    // 创建 workspaces 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            username TEXT,
            git_token TEXT,
            git_repo TEXT,
            llm_api_token TEXT,
            llm_base_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    // 创建 sessions 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            agent_session_id TEXT,
            model TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
    `);

    // 创建 messages 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            tool_calls TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    `);

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at DESC);
    `);

    ensureSessionModelColumn(db);
    ensureWorkspaceGitColumns(db);
}

/**
 * 确保 sessions 表包含 model 字段（兼容旧库）
 */
function ensureSessionModelColumn(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
    const hasModelColumn = columns.some((column) => column.name === "model");
    if (!hasModelColumn) {
        db.exec(`ALTER TABLE sessions ADD COLUMN model TEXT`);
    }
}

/**
 * 确保 workspaces 表包含 git 相关字段（兼容旧库）
 */
function ensureWorkspaceGitColumns(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(workspaces)").all() as { name: string }[];
    const columnsMap = new Map(columns.map((c) => [c.name, true]));

    // 如果所有列都已存在，说明是新创建的表，无需迁移
    const hasAllColumns = columnsMap.has("username") &&
                         columnsMap.has("git_token") &&
                         columnsMap.has("git_repo") &&
                         columnsMap.has("llm_api_token") &&
                         columnsMap.has("llm_base_url");

    if (hasAllColumns) {
        return;
    }

    // 添加缺失的列
    if (!columnsMap.has("username")) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN username TEXT`);
    }

    // 处理 private_token -> git_token 迁移
    if (columnsMap.has("private_token") && !columnsMap.has("git_token")) {
        // 重命名 private_token 为 git_token
        db.exec(`ALTER TABLE workspaces RENAME COLUMN private_token TO git_token`);
    } else if (!columnsMap.has("git_token")) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN git_token TEXT`);
    }

    if (!columnsMap.has("git_repo")) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN git_repo TEXT`);
    }

    // 添加新的 LLM 相关字段
    if (!columnsMap.has("llm_api_token")) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN llm_api_token TEXT`);
    }
    if (!columnsMap.has("llm_base_url")) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN llm_base_url TEXT`);
    }
}

/**
 * 数据库行类型定义
 */
export interface WorkspaceRow {
    id: string;
    name: string;
    path: string;
    username: string | null;
    git_token: string | null;
    git_repo: string | null;
    llm_api_token: string | null;
    llm_base_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface SessionRow {
    id: string;
    name: string;
    workspace_id: string;
    agent_session_id: string | null;
    model: string | null;
    created_at: string;
    updated_at: string;
}

export interface MessageRow {
    id: string;
    session_id: string;
    role: "user" | "assistant";
    content: string;
    tool_calls: string | null;
    created_at: string;
}

/**
 * 导出数据库实例
 */
export const db = getDatabase();

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
    if (globalForDb.db) {
        globalForDb.db.close();
        globalForDb.db = undefined;
    }
}
