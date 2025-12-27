import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import path from 'path'
import fs from 'fs'

const logger = createLogger('CommandsAPI')

/**
 * 解析YAML front matter
 */
function parseFrontMatter(content: string): { metadata: Record<string, unknown>; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
        return { metadata: {}, body: content }
    }

    const frontMatter = match[1]
    const body = match[2]

    // 解析YAML
    const metadata: Record<string, unknown> = {}
    frontMatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim()
            const value = line.slice(colonIndex + 1).trim()
            // 处理简单值
            if (value === 'true') {
                metadata[key] = true
            } else if (value === 'false') {
                metadata[key] = false
            } else if (value.startsWith('[') && value.endsWith(']')) {
                // 数组
                metadata[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/,/g, ''))
            } else if (value.startsWith('"') && value.endsWith('"')) {
                metadata[key] = value.slice(1, -1)
            } else if (value.startsWith("'") && value.endsWith("'")) {
                metadata[key] = value.slice(1, -1)
            } else {
                metadata[key] = value
            }
        }
    })

    return { metadata, body }
}

/**
 * 快捷指令类型
 */
export interface QuickCommand {
    id: string
    name: string
    description: string
    type: 'command' | 'skill'
    triggerWords?: string[]
}

/**
 * 从目录中读取所有命令/技能文件
 */
function readCommandsFromDir(dirPath: string, type: 'command' | 'skill'): QuickCommand[] {
    const commands: QuickCommand[] = []

    if (!fs.existsSync(dirPath)) {
        return commands
    }

    // 读取commands目录（单个.md文件）
    if (type === 'command') {
        const files = fs.readdirSync(dirPath)
        files.forEach(file => {
            if (file.endsWith('.md')) {
                const filePath = path.join(dirPath, file)
                try {
                    const content = fs.readFileSync(filePath, 'utf-8')
                    const { metadata } = parseFrontMatter(content)

                    const name = file.replace('.md', '')
                    const description = (metadata.description as string) || ''

                    commands.push({
                        id: `cmd_${file.replace('.md', '')}`,
                        name: `/${name}`,
                        description,
                        type: 'command'
                    })
                } catch {
                    logger.warn('读取命令文件失败', { file })
                }
            }
        })
    }

    // 读取skills目录（包含SKILL.md的目录）
    if (type === 'skill') {
        const dirs = fs.readdirSync(dirPath)
        dirs.forEach(dir => {
            const skillDir = path.join(dirPath, dir)
            if (fs.statSync(skillDir).isDirectory()) {
                const skillFilePath = path.join(skillDir, 'SKILL.md')
                if (fs.existsSync(skillFilePath)) {
                    try {
                        const content = fs.readFileSync(skillFilePath, 'utf-8')
                        const { metadata } = parseFrontMatter(content)

                        const name = (metadata.name as string) || dir
                        const description = (metadata.description as string) || ''

                        // 从description中提取触发词
                        const triggerWords: string[] = []
                        const triggerWordMatch = description.match(/触发词[：:]\s*([^\n]+)/)
                        if (triggerWordMatch) {
                            triggerWords.push(...triggerWordMatch[1].split(/[、,]/).map(w => w.trim()))
                        }

                        commands.push({
                            id: `skill_${dir}`,
                            name: triggerWords.length > 0 ? triggerWords[0] : name,
                            description,
                            type: 'skill',
                            triggerWords,
                        })
                    } catch {
                        logger.warn('读取技能文件失败', { dir })
                    }
                }
            }
        })
    }

    return commands
}

/**
 * GET /api/commands - 获取快捷指令列表
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspacePath = searchParams.get('workspacePath')

        if (!workspacePath) {
            return NextResponse.json(
                { error: '缺少 workspacePath 参数' },
                { status: 400 }
            )
        }

        const claudeDir = path.join(workspacePath, '.claude')
        const commands: QuickCommand[] = []

        // 读取commands
        const commandsDir = path.join(claudeDir, 'commands')
        commands.push(...readCommandsFromDir(commandsDir, 'command'))

        // 读取skills
        const skillsDir = path.join(claudeDir, 'skills')
        commands.push(...readCommandsFromDir(skillsDir, 'skill'))

        logger.info('获取快捷指令成功', {
            workspacePath,
            commandCount: commands.filter(c => c.type === 'command').length,
            skillCount: commands.filter(c => c.type === 'skill').length,
        })

        return NextResponse.json({ commands })
    } catch (error) {
        logger.error('获取快捷指令失败', { error })
        return NextResponse.json(
            { error: '获取快捷指令失败' },
            { status: 500 }
        )
    }
}
