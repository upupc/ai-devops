import { NextRequest, NextResponse } from 'next/server'
import { uploadFiles } from '@/lib/file-service'

/**
 * POST /api/files/upload - 上传文件或文件夹
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const workspaceId = formData.get('workspaceId') as string
        const targetPath = (formData.get('targetPath') as string) || ''

        if (!workspaceId) {
            return NextResponse.json(
                { error: '缺少 workspaceId 参数' },
                { status: 400 }
            )
        }

        // 获取所有上传的文件
        const files: Array<{ path: string; name: string; content: Buffer }> = []
        const entries = Array.from(formData.entries())

        for (const [key, value] of entries) {
            // 跳过非文件字段
            if (key === 'workspaceId' || key === 'targetPath') {
                continue
            }

            if (value instanceof File) {
                const bytes = await value.arrayBuffer()
                const buffer = Buffer.from(bytes)

                // key 格式可能是 "file" 或 "files[path/to/file]"
                let filePath = value.name
                if (key.startsWith('files[') && key.endsWith(']')) {
                    // 文件夹上传时的路径格式: files[path/to/file.txt]
                    filePath = key.slice(6, -1)
                }

                files.push({
                    path: filePath,
                    name: value.name,
                    content: buffer,
                })
            }
        }

        if (files.length === 0) {
            return NextResponse.json(
                { error: '没有上传文件' },
                { status: 400 }
            )
        }

        const result = await uploadFiles(workspaceId, targetPath, files)

        return NextResponse.json({
            success: true,
            uploaded: result.success,
            failed: result.failed,
        })
    } catch (error) {
        console.error('上传文件失败:', error)
        const message = error instanceof Error ? error.message : '上传失败'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
