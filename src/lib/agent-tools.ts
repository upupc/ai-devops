import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { readFile, writeFile } from "./file-service";
import { getWorkspace } from "./session-store";

const execAsync = promisify(exec)

/**
 * 命令白名单
 */
const ALLOWED_COMMANDS = [
    'ls', 'cat', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv',
    'npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3',
    'git', 'curl', 'wget', 'head', 'tail', 'wc', 'grep', 'find',
    'pwd', 'which', 'env', 'date', 'whoami'
]

/**
 * 命令执行超时时间 (毫秒)
 */
const COMMAND_TIMEOUT = 30000

/**
 * 工具定义
 */
export const agentTools = [
    {
        name: 'read_file',
        description: '读取工作区中的文件内容。使用此工具查看文件的具体内容。',
        input_schema: {
            type: 'object' as const,
            properties: {
                path: {
                    type: 'string',
                    description: '文件的相对路径，例如: src/index.ts'
                }
            },
            required: ['path']
        }
    },
    {
        name: 'write_file',
        description: '创建或修改工作区中的文件。使用此工具写入或更新文件内容。',
        input_schema: {
            type: 'object' as const,
            properties: {
                path: {
                    type: 'string',
                    description: '文件的相对路径，例如: src/utils.ts'
                },
                content: {
                    type: 'string',
                    description: '要写入的文件内容'
                }
            },
            required: ['path', 'content']
        }
    },
    {
        name: 'execute_command',
        description: '在工作区目录中执行终端命令。仅支持安全的命令如 ls, npm, node 等。',
        input_schema: {
            type: 'object' as const,
            properties: {
                command: {
                    type: 'string',
                    description: '要执行的命令，例如: ls -la 或 npm install lodash'
                }
            },
            required: ['command']
        }
    }
]

/**
 * 校验命令是否安全
 */
function validateCommand(command: string): boolean {
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]

    // 检查是否在白名单中
    if (!ALLOWED_COMMANDS.includes(cmd)) {
        return false
    }

    // 检查危险参数
    const dangerousPatterns = [
        /rm\s+(-rf?|--recursive)\s+\//, // rm -rf /
        />\s*\//, // 重定向到根目录
        /;\s*rm/, // 链式 rm 命令
        /\|\s*rm/, // 管道到 rm
        /`.*`/, // 命令替换
        /\$\(.*\)/, // 命令替换
    ]

    return !dangerousPatterns.some(pattern => pattern.test(command))
}

/**
 * 执行工具调用
 */
export async function executeToolCall(
    workspaceId: string,
    toolName: string,
    toolInput: Record<string, unknown>
): Promise<{ result: string; fileChanged: boolean }> {
    const workspace = getWorkspace(workspaceId)
    if (!workspace) {
        return { result: '错误: 工作区不存在', fileChanged: false }
    }

    try {
        switch (toolName) {
            case 'read_file': {
                const filePath = toolInput.path as string
                const content = await readFile(workspaceId, filePath)
                if (content === null) {
                    return { result: `错误: 文件不存在 - ${filePath}`, fileChanged: false }
                }
                return { result: content, fileChanged: false }
            }

            case 'write_file': {
                const filePath = toolInput.path as string
                const content = toolInput.content as string
                const success = await writeFile(workspaceId, filePath, content)
                if (!success) {
                    return { result: `错误: 写入文件失败 - ${filePath}`, fileChanged: false }
                }
                return { result: `成功写入文件: ${filePath}`, fileChanged: true }
            }

            case 'execute_command': {
                const command = toolInput.command as string

                if (!validateCommand(command)) {
                    return { result: '错误: 命令被拒绝，不在允许的命令列表中', fileChanged: false }
                }

                try {
                    const { stdout, stderr } = await execAsync(command, {
                        cwd: workspace.path,
                        timeout: COMMAND_TIMEOUT,
                        maxBuffer: 1024 * 1024, // 1MB
                        env: {
                            ...process.env,
                            PATH: process.env.PATH,
                        }
                    })

                    const output = stdout || stderr || '(命令执行成功，无输出)'

                    // 检查是否有文件变更
                    const fileChangingCommands = ['touch', 'mkdir', 'rm', 'cp', 'mv', 'npm', 'npx']
                    const hasFileChange = fileChangingCommands.some(cmd =>
                        command.startsWith(cmd) || command.includes(` ${cmd} `)
                    )

                    return { result: output, fileChanged: hasFileChange }
                } catch (error) {
                    if (error instanceof Error) {
                        if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
                            return { result: '错误: 命令执行超时', fileChanged: false }
                        }
                        return { result: `命令执行错误: ${error.message}`, fileChanged: false }
                    }
                    return { result: '命令执行失败', fileChanged: false }
                }
            }

            default:
                return { result: `错误: 未知工具 - ${toolName}`, fileChanged: false }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : '工具执行失败'
        return { result: `错误: ${message}`, fileChanged: false }
    }
}
