import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/session-store";
import { deleteChatSession } from "@/lib/chat-session";

interface Params {
    params: Promise<{ id: string }>
}

/**
 * GET /api/sessions/:id - 获取单个会话
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const session = getSession(id)

        if (!session) {
            return NextResponse.json(
                { error: '会话不存在' },
                { status: 404 }
            )
        }

        return NextResponse.json({ session })
    } catch (error) {
        console.error('获取会话失败:', error)
        return NextResponse.json(
            { error: '获取会话失败' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/sessions/:id - 删除会话
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        // 先清理 ChatSession
        deleteChatSession(id);
        // 再删除存储数据
        await deleteSession(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("删除会话失败:", error);
        return NextResponse.json(
            { error: "删除会话失败" },
            { status: 500 }
        );
    }
}
