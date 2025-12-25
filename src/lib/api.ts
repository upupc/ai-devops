/**
 * API 请求辅助函数
 * 自动添加 basePath 前缀
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/**
 * 获取完整的 API 路径
 */
export function getApiPath(path: string): string {
    // 如果路径已经是完整路径或以 basePath 开头，直接返回
    if (path.startsWith('http') || path.startsWith(BASE_PATH)) {
        return path
    }
    // 移除开头的斜杠并拼接 basePath
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return BASE_PATH ? `${BASE_PATH}${cleanPath}` : cleanPath
}

/**
 * 封装的 fetch 函数，自动添加 basePath
 */
export async function apiFetch(
    path: string,
    options?: RequestInit
): Promise<Response> {
    return fetch(getApiPath(path), options)
}
