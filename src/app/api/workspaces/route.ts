import { NextRequest, NextResponse } from "next/server";
import { getAllWorkspaces, createWorkspace, getWorkspaceByName } from "@/lib/session-store";

/**
 * GET /api/workspaces - 获取所有工作区
 */
export async function GET() {
    try {
        const workspaces = getAllWorkspaces()
        return NextResponse.json({ workspaces })
    } catch (error) {
        console.error('获取工作区列表失败:', error)
        return NextResponse.json(
            { error: '获取工作区列表失败' },
            { status: 500 }
        )
    }
}

/**
 * 从 Git 仓库地址中提取项目名
 * @param gitRepo Git 仓库地址
 * @returns 项目名
 */
function extractProjectNameFromGitRepo(gitRepo: string): string {
    try {
        // 移除末尾的 .git 后缀
        let url = gitRepo.replace(/\.git$/, '');

        // 解析 URL 获取路径部分
        let pathname = '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            pathname = urlObj.pathname;
        } else if (url.includes('@')) {
            // SSH 格式: git@github.com:user/repo.git
            const parts = url.split(':');
            if (parts.length > 1) {
                pathname = parts[1];
            }
        } else {
            pathname = url;
        }

        // 移除前导斜杠并获取最后一部分
        const segments = pathname.replace(/^\//, '').split('/');
        return segments[segments.length - 1] || '未命名项目';
    } catch {
        return '未命名项目';
    }
}

/**
 * POST /api/workspaces - 创建新工作区
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, username, gitToken, gitRepo, llmApiToken, llmBaseUrl } = body

        // 如果提供了 git_repo，自动提取项目名作为工作区名称
        let workspaceName = name;
        if (gitRepo && !workspaceName) {
            workspaceName = extractProjectNameFromGitRepo(gitRepo);
        }

        const finalName = workspaceName || '未命名工作区';

        // 检查是否已存在同名工作区
        const existingWorkspace = getWorkspaceByName(finalName);
        if (existingWorkspace) {
            return NextResponse.json(
                { error: `工作区 "${finalName}" 已存在，请使用其他名称` },
                { status: 400 }
            )
        }

        const workspace = await createWorkspace(
            finalName,
            undefined,
            username,
            gitToken,
            gitRepo,
            llmApiToken,
            llmBaseUrl
        )
        return NextResponse.json({ workspace })
    } catch (error) {
        console.error('创建工作区失败:', error)
        return NextResponse.json(
            { error: '创建工作区失败' },
            { status: 500 }
        )
    }
}
