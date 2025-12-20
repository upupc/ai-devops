import { NextRequest, NextResponse } from "next/server";
import { getAllSessions, createSession } from "@/lib/session-store";

/**
 * GET /api/sessions - 获取所有会话
 */
export async function GET() {
    try {
        const sessions = getAllSessions()
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
 * POST /api/sessions - 创建新会话
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name } = body

        const result = await createSession(name)
        return NextResponse.json(result)
    } catch (error) {
        console.error('创建会话失败:', error)
        return NextResponse.json(
            { error: '创建会话失败' },
            { status: 500 }
        )
    }
}
