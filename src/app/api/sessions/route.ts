import { NextRequest, NextResponse } from "next/server";
import {
    getAllSessions,
    createSession,
    createWorkspaceAndSession,
    getWorkspace
} from "@/lib/session-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SessionsAPI");

/**
 * GET /api/sessions - 获取所有会话
 */
export async function GET() {
    try {
        const sessions = getAllSessions()
        return NextResponse.json({ sessions })
    } catch (error) {
        logger.error('获取会话列表失败', { error })
        return NextResponse.json(
            { error: '获取会话列表失败' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/sessions - 创建新会话
 * 支持两种模式：
 * 1. 提供 workspaceId: 在指定工作区下创建会话
 * 2. 不提供 workspaceId: 同时创建工作区和会话
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, workspaceId } = body

        if (workspaceId) {
            // 在指定工作区下创建会话
            const workspace = getWorkspace(workspaceId)
            if (!workspace) {
                return NextResponse.json(
                    { error: '工作区不存在' },
                    { status: 404 }
                )
            }
            const session = createSession(workspaceId, name)
            return NextResponse.json({ session, workspace })
        } else {
            // 同时创建工作区和会话（向后兼容）
            const result = await createWorkspaceAndSession(name)
            return NextResponse.json(result)
        }
    } catch (error) {
        logger.error('创建会话失败', { error })
        return NextResponse.json(
            { error: '创建会话失败' },
            { status: 500 }
        )
    }
}
