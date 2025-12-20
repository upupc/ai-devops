import fs from "fs/promises";
import path from "path";
import { FileNode } from "@/types";
import { getWorkspace } from "./session-store";

/**
 * 敏感文件列表
 */
const SENSITIVE_FILES = ['.env', '.env.local', 'credentials', 'secrets', '.git']

/**
 * 校验路径是否安全
 */
export function validatePath(workspacePath: string, filePath: string): boolean {
    // 检查是否包含目录遍历
    if (filePath.includes('..')) {
        return false
    }

    const absolutePath = path.resolve(workspacePath, filePath)
    return absolutePath.startsWith(workspacePath)
}

/**
 * 检查是否为敏感文件
 */
export function isSensitiveFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase()
    return SENSITIVE_FILES.some(sensitive =>
        fileName === sensitive || fileName.startsWith(sensitive)
    )
}

/**
 * 获取文件树
 */
export async function getFileTree(workspaceId: string): Promise<FileNode | null> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) return null

    const buildTree = async (dirPath: string, basePath: string = ''): Promise<FileNode> => {
        const name = path.basename(dirPath)
        const relativePath = basePath || name

        try {
            const stat = await fs.stat(dirPath)

            if (stat.isDirectory()) {
                const entries = await fs.readdir(dirPath)
                const children: FileNode[] = []

                for (const entry of entries) {
                    // 跳过隐藏文件和敏感文件
                    if (entry.startsWith('.') || isSensitiveFile(entry)) {
                        continue
                    }

                    const childPath = path.join(dirPath, entry)
                    const childRelativePath = basePath ? `${basePath}/${entry}` : entry

                    try {
                        const childNode = await buildTree(childPath, childRelativePath)
                        children.push(childNode)
                    } catch {
                        // 跳过无法访问的文件
                    }
                }

                // 排序：目录在前，文件在后，按名称字母顺序
                children.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1
                    }
                    return a.name.localeCompare(b.name)
                })

                return {
                    name,
                    path: relativePath,
                    type: 'directory',
                    children,
                    modifiedAt: stat.mtime,
                }
            } else {
                return {
                    name,
                    path: relativePath,
                    type: 'file',
                    size: stat.size,
                    modifiedAt: stat.mtime,
                }
            }
        } catch {
            return {
                name,
                path: relativePath,
                type: 'directory',
                children: [],
            }
        }
    }

    return buildTree(workspace.path, '')
}

/**
 * 读取文件内容
 */
export async function readFile(workspaceId: string, filePath: string): Promise<string | null> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) return null

    if (!validatePath(workspace.path, filePath)) {
        throw new Error('访问被拒绝: 路径超出工作区范围')
    }

    if (isSensitiveFile(filePath)) {
        throw new Error('访问被拒绝: 无法读取敏感文件')
    }

    const absolutePath = path.join(workspace.path, filePath)

    try {
        const content = await fs.readFile(absolutePath, 'utf-8')
        return content
    } catch {
        return null
    }
}

/**
 * 写入文件内容
 */
export async function writeFile(
    workspaceId: string,
    filePath: string,
    content: string
): Promise<boolean> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) return false

    if (!validatePath(workspace.path, filePath)) {
        throw new Error('访问被拒绝: 路径超出工作区范围')
    }

    if (isSensitiveFile(filePath)) {
        throw new Error('访问被拒绝: 无法写入敏感文件')
    }

    const absolutePath = path.join(workspace.path, filePath)

    // 创建父目录
    const parentDir = path.dirname(absolutePath)
    await fs.mkdir(parentDir, { recursive: true })

    await fs.writeFile(absolutePath, content, 'utf-8')
    return true
}

/**
 * 创建目录
 */
export async function createDirectory(
    workspaceId: string,
    dirPath: string
): Promise<boolean> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) return false

    if (!validatePath(workspace.path, dirPath)) {
        throw new Error('访问被拒绝: 路径超出工作区范围')
    }

    const absolutePath = path.join(workspace.path, dirPath)
    await fs.mkdir(absolutePath, { recursive: true })
    return true
}

/**
 * 删除文件或目录
 */
export async function deleteFile(
    workspaceId: string,
    filePath: string
): Promise<boolean> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) return false

    if (!validatePath(workspace.path, filePath)) {
        throw new Error('访问被拒绝: 路径超出工作区范围')
    }

    if (isSensitiveFile(filePath)) {
        throw new Error('访问被拒绝: 无法删除敏感文件')
    }

    const absolutePath = path.join(workspace.path, filePath)

    try {
        const stat = await fs.stat(absolutePath)
        if (stat.isDirectory()) {
            await fs.rm(absolutePath, { recursive: true })
        } else {
            await fs.unlink(absolutePath)
        }
        return true
    } catch {
        return false
    }
}
