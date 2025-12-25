import { NextRequest, NextResponse } from "next/server";
import { getWorkspace, updateWorkspace, deleteWorkspace } from "@/lib/session-store";
import { deleteChatSession } from "@/lib/chat-session";

interface Params {
    params: Promise<{ id: string }>
}

/**
 * GET /api/workspaces/:id - 获取单个工作区
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const workspace = getWorkspace(id)

        if (!workspace) {
            return NextResponse.json(
                { error: '工作区不存在' },
                { status: 404 }
            )
        }

        return NextResponse.json({ workspace })
    } catch (error) {
        console.error('获取工作区失败:', error)
        return NextResponse.json(
            { error: '获取工作区失败' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/workspaces/:id - 更新工作区
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name, username, gitToken, gitRepo } = body

        const workspace = updateWorkspace(id, {
            name,
            username,
            gitToken,
            gitRepo
        })

        if (!workspace) {
            return NextResponse.json(
                { error: '工作区不存在' },
                { status: 404 }
            )
        }

        return NextResponse.json({ workspace })
    } catch (error) {
        console.error('更新工作区失败:', error)
        return NextResponse.json(
            { error: '更新工作区失败' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/workspaces/:id - 删除工作区（同时删除所有关联会话）
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params

        // 先清理所有相关的 ChatSession
        const { getSessionsByWorkspaceId } = await import("@/lib/session-store")
        const sessions = getSessionsByWorkspaceId(id)
        sessions.forEach(session => deleteChatSession(session.id))

        // 删除工作区（级联删除 sessions 和 messages）
        await deleteWorkspace(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('删除工作区失败:', error)
        return NextResponse.json(
            { error: '删除工作区失败' },
            { status: 500 }
        )
    }
}
