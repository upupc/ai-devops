import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, deleteFile } from '@/lib/file-service'

interface Params {
    params: Promise<{ path: string[] }>
}

/**
 * GET /api/files/:path - 读取文件内容
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { path: pathSegments } = await params
        const filePath = pathSegments.join('/')
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')

        if (!workspaceId) {
            return NextResponse.json(
                { error: '缺少 workspaceId 参数' },
                { status: 400 }
            )
        }

        const content = await readFile(workspaceId, filePath)

        if (content === null) {
            return NextResponse.json(
                { error: '文件不存在' },
                { status: 404 }
            )
        }

        return NextResponse.json({ content, encoding: 'utf-8' })
    } catch (error) {
        console.error('读取文件失败:', error)
        const message = error instanceof Error ? error.message : '读取文件失败'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/files/:path - 更新文件内容
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { path: pathSegments } = await params
        const filePath = pathSegments.join('/')
        const body = await request.json()
        const { workspaceId, content } = body

        if (!workspaceId) {
            return NextResponse.json(
                { error: '缺少 workspaceId 参数' },
                { status: 400 }
            )
        }

        const success = await writeFile(workspaceId, filePath, content)

        if (!success) {
            return NextResponse.json(
                { error: '写入文件失败' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('更新文件失败:', error)
        const message = error instanceof Error ? error.message : '更新文件失败'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/files/:path - 删除文件
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { path: pathSegments } = await params
        const filePath = pathSegments.join('/')
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')

        if (!workspaceId) {
            return NextResponse.json(
                { error: '缺少 workspaceId 参数' },
                { status: 400 }
            )
        }

        const success = await deleteFile(workspaceId, filePath)

        if (!success) {
            return NextResponse.json(
                { error: '删除文件失败' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('删除文件失败:', error)
        const message = error instanceof Error ? error.message : '删除文件失败'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
