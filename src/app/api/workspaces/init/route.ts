import { NextRequest, NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/session-store";

/**
 * POST /api/workspaces/init - 获取或创建指定 ID 的工作区
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, name } = body

        if (!id) {
            return NextResponse.json(
                { error: '工作区 ID 不能为空' },
                { status: 400 }
            )
        }

        const workspace = await getOrCreateWorkspace(id, name || id)
        return NextResponse.json(workspace)
    } catch (error) {
        console.error('初始化工作区失败:', error)
        return NextResponse.json(
            { error: '初始化工作区失败' },
            { status: 500 }
        )
    }
}
