import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceBySessionId } from "@/lib/session-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("WorkspaceAPI");

interface Params {
    params: Promise<{ id: string }>
}

/**
 * GET /api/sessions/:id/workspace - 获取会话的工作区
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const workspace = getWorkspaceBySessionId(id)

        if (!workspace) {
            return NextResponse.json(
                { error: '工作区不存在' },
                { status: 404 }
            )
        }

        return NextResponse.json({ workspace })
    } catch (error) {
        logger.error('获取工作区失败', { error })
        return NextResponse.json(
            { error: '获取工作区失败' },
            { status: 500 }
        )
    }
}
