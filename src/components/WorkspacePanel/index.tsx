'use client'

import React, { useEffect, useCallback } from 'react'
import { Tabs, Empty, message, Button, Spin } from 'antd'
import { CloseOutlined, SaveOutlined } from '@ant-design/icons'
import dynamic from 'next/dynamic'
import { useAppState } from '@/lib/store'
import styles from './WorkspacePanel.module.css'

// 动态导入 Monaco Editor 以避免 SSR 问题
const Editor = dynamic(
    () => import('@monaco-editor/react'),
    {
        ssr: false,
        loading: () => (
            <div className={styles.editorLoading}>
                <Spin tip="加载编辑器..." />
            </div>
        )
    }
)

/**
 * 根据文件扩展名获取语言
 */
function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        json: 'json',
        md: 'markdown',
        py: 'python',
        html: 'html',
        css: 'css',
        scss: 'scss',
        less: 'less',
        yaml: 'yaml',
        yml: 'yaml',
        xml: 'xml',
        sh: 'shell',
        bash: 'shell',
        sql: 'sql',
        go: 'go',
        rs: 'rust',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        h: 'c',
        hpp: 'cpp',
    }
    return languageMap[ext || ''] || 'plaintext'
}

/**
 * 工作区面板组件
 */
export default function WorkspacePanel() {
    const { state, dispatch } = useAppState()
    const { workspace, openFiles, activeFilePath } = state

    /**
     * 保存文件
     */
    const handleSaveFile = useCallback(async (path: string) => {
        const file = openFiles.find(f => f.path === path)
        if (!file || !workspace) return

        try {
            const response = await fetch(`/api/files/${encodeURIComponent(path)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    content: file.content,
                }),
            })

            if (!response.ok) throw new Error('保存文件失败')

            dispatch({ type: 'MARK_FILE_SAVED', payload: path })
            message.success('文件保存成功')
        } catch {
            message.error('保存文件失败')
        }
    }, [openFiles, workspace, dispatch])

    /**
     * 关闭文件
     */
    const handleCloseFile = (path: string) => {
        const file = openFiles.find(f => f.path === path)
        if (file?.modified) {
            message.warning('文件已修改，请先保存')
            return
        }
        dispatch({ type: 'CLOSE_FILE', payload: path })
    }

    /**
     * 切换标签页
     */
    const handleTabChange = (key: string) => {
        dispatch({ type: 'SET_ACTIVE_FILE', payload: key })
    }

    /**
     * 编辑文件内容
     */
    const handleEditorChange = (value: string | undefined, path: string) => {
        if (value !== undefined) {
            dispatch({
                type: 'UPDATE_FILE_CONTENT',
                payload: { path, content: value },
            })
        }
    }

    /**
     * 键盘快捷键
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (activeFilePath) {
                    handleSaveFile(activeFilePath)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activeFilePath, handleSaveFile])

    if (!workspace) {
        return (
            <div className={styles.emptyContainer}>
                <Empty description="请选择或创建一个会话以开始使用工作区" />
            </div>
        )
    }

    if (openFiles.length === 0) {
        return (
            <div className={styles.emptyContainer}>
                <Empty description="从右侧文件浏览器中选择文件进行编辑" />
            </div>
        )
    }

    const tabItems = openFiles.map(file => ({
        key: file.path,
        label: (
            <span className={styles.tabLabel}>
                {file.modified && <span className={styles.modifiedDot}>●</span>}
                {file.path.split('/').pop()}
                <CloseOutlined
                    className={styles.closeIcon}
                    onClick={(e) => {
                        e.stopPropagation()
                        handleCloseFile(file.path)
                    }}
                />
            </span>
        ),
        children: (
            <div className={styles.editorContainer}>
                <Editor
                    height="100%"
                    language={getLanguageFromPath(file.path)}
                    value={file.content}
                    onChange={(value) => handleEditorChange(value, file.path)}
                    theme="vs-light"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>
        ),
    }))

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <Button
                    type="text"
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={() => activeFilePath && handleSaveFile(activeFilePath)}
                    disabled={!activeFilePath || !openFiles.find(f => f.path === activeFilePath)?.modified}
                >
                    保存
                </Button>
            </div>
            <Tabs
                activeKey={activeFilePath || undefined}
                onChange={handleTabChange}
                type="card"
                size="small"
                items={tabItems}
                className={styles.tabs}
            />
        </div>
    )
}
