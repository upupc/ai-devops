import { NextRequest, NextResponse } from "next/server";
import { getAllWorkspaces, createWorkspace } from "@/lib/session-store";

/**
 * GET /api/workspaces - 获取所有工作区
 */
export async function GET() {
    try {
        const workspaces = getAllWorkspaces()
        return NextResponse.json({ workspaces })
    } catch (error) {
        console.error('获取工作区列表失败:', error)
        return NextResponse.json(
            { error: '获取工作区列表失败' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/workspaces - 创建新工作区
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name } = body

        const workspace = await createWorkspace(name)
        return NextResponse.json({ workspace })
    } catch (error) {
        console.error('创建工作区失败:', error)
        return NextResponse.json(
            { error: '创建工作区失败' },
            { status: 500 }
        )
    }
}
