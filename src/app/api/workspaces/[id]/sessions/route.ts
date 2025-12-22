import { NextRequest, NextResponse } from "next/server";
import { getWorkspace, getSessionsByWorkspaceId, createSession } from "@/lib/session-store";

interface Params {
    params: Promise<{ id: string }>
}

/**
 * GET /api/workspaces/:id/sessions - 获取工作区的所有会话
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

        const sessions = getSessionsByWorkspaceId(id)
        return NextResponse.json({ sessions })
    } catch (error) {
        console.error('获取会话列表失败:', error)
        return NextResponse.json(
            { error: '获取会话列表失败' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/workspaces/:id/sessions - 在工作区下创建新会话
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name } = body

        const workspace = getWorkspace(id)
        if (!workspace) {
            return NextResponse.json(
                { error: '工作区不存在' },
                { status: 404 }
            )
        }

        const session = createSession(id, name)
        return NextResponse.json({ session, workspace })
    } catch (error) {
        console.error('创建会话失败:', error)
        return NextResponse.json(
            { error: '创建会话失败' },
            { status: 500 }
        )
    }
}
