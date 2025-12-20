import { NextRequest, NextResponse } from "next/server";
import { getSessionMessages } from "@/lib/session-store";

interface Params {
    params: Promise<{ id: string }>
}

/**
 * GET /api/sessions/:id/messages - 获取会话消息
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const messages = getSessionMessages(id)
        return NextResponse.json({ messages })
    } catch (error) {
        console.error('获取消息失败:', error)
        return NextResponse.json(
            { error: '获取消息失败' },
            { status: 500 }
        )
    }
}
