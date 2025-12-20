import { NextRequest, NextResponse } from 'next/server'
import {
    getFileTree,
    readFile,
    writeFile,
    createDirectory,
    deleteFile
} from '@/lib/file-service'

/**
 * GET /api/files - 获取文件树
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')

        if (!workspaceId) {
            return NextResponse.json(
                { error: '缺少 workspaceId 参数' },
                { status: 400 }
            )
        }

        const tree = await getFileTree(workspaceId)
        return NextResponse.json({ tree })
    } catch (error) {
        console.error('获取文件树失败:', error)
        return NextResponse.json(
            { error: '获取文件树失败' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/files - 创建文件或目录
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, path, type, content } = body

        if (!workspaceId || !path || !type) {
            return NextResponse.json(
                { error: '缺少必要参数' },
                { status: 400 }
            )
        }

        let success = false
        if (type === 'directory') {
            success = await createDirectory(workspaceId, path)
        } else {
            success = await writeFile(workspaceId, path, content || '')
        }

        if (!success) {
            return NextResponse.json(
                { error: '创建失败' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('创建文件失败:', error)
        const message = error instanceof Error ? error.message : '创建失败'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
