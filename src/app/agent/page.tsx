'use client'

import { Layout, Typography, Button, Space, Spin } from 'antd'
import { RobotOutlined, ArrowLeftOutlined, FolderOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState, useEffect, useRef } from 'react'
import ChatPanel from '@/components/ChatPanel'
import WorkspacePanel from '@/components/WorkspacePanel'
import FileBrowserPanel from '@/components/FileBrowserPanel'
import WorkspaceSelector from '@/components/WorkspaceSelector'
import { AppProvider, useAppState } from '@/lib/store'

const { Header } = Layout

/**
 * 主内容区域组件
 */
function MainContent() {
    const { state, dispatch } = useAppState()
    const { currentWorkspace } = state
    const [isInitializing, setIsInitializing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef<{
        type: 'left' | 'middle' | null
        startX: number
        startLeft: number
        startMiddle: number
    }>({
        type: null,
        startX: 0,
        startLeft: 0,
        startMiddle: 0
    })
    const [panelWidths, setPanelWidths] = useState({
        left: 630,
        middle: 220
    })
    const minLeftWidth = 320
    const minMiddleWidth = 180
    const minRightWidth = 360
    const resizerWidth = 6

    const handleResizeStart = (type: 'left' | 'middle', event: React.MouseEvent) => {
        dragStateRef.current = {
            type,
            startX: event.clientX,
            startLeft: panelWidths.left,
            startMiddle: panelWidths.middle
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', handleResizeMove)
        window.addEventListener('mouseup', handleResizeEnd)
    }

    const handleResizeMove = (event: MouseEvent) => {
        const container = containerRef.current
        const dragState = dragStateRef.current
        if (!container || !dragState.type) {
            return
        }

        const containerWidth = container.getBoundingClientRect().width
        const availableWidth = containerWidth - resizerWidth * 2
        const delta = event.clientX - dragState.startX

        if (dragState.type === 'left') {
            let nextLeft = dragState.startLeft + delta
            const maxLeft = availableWidth - dragState.startMiddle - minRightWidth
            nextLeft = Math.min(Math.max(nextLeft, minLeftWidth), maxLeft)
            setPanelWidths({
                left: nextLeft,
                middle: dragState.startMiddle
            })
            return
        }

        let nextMiddle = dragState.startMiddle + delta
        const maxMiddle = availableWidth - dragState.startLeft - minRightWidth
        nextMiddle = Math.min(Math.max(nextMiddle, minMiddleWidth), maxMiddle)
        setPanelWidths({
            left: dragState.startLeft,
            middle: nextMiddle
        })
    }

    const handleResizeEnd = () => {
        dragStateRef.current.type = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
    }

    /**
     * 返回工作区选择页面
     */
    const handleBackToWorkspaces = () => {
        dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: null })
        dispatch({ type: 'RESET_SESSION_STATE' })
    }

    /**
     * 初始化工作区数据
     */
    useEffect(() => {
        const initializeWorkspace = async () => {
            if (currentWorkspace) {
                setIsInitializing(true)
                try {
                    // 并行加载会话和文件树
                    const [sessionsRes, filesRes] = await Promise.all([
                        fetch(`/api/workspaces/${currentWorkspace.id}/sessions`),
                        fetch(`/api/files?workspaceId=${currentWorkspace.id}`)
                    ])

                    if (sessionsRes.ok) {
                        const sessionsData = await sessionsRes.json()
                        dispatch({ type: 'SET_SESSIONS', payload: sessionsData.sessions || [] })
                    }

                    if (filesRes.ok) {
                        const filesData = await filesRes.json()
                        dispatch({ type: 'SET_FILE_TREE', payload: filesData.tree })
                    }
                } catch (error) {
                    console.error('Failed to initialize workspace:', error)
                } finally {
                    setIsInitializing(false)
                }
            }
        }

        initializeWorkspace()
    }, [currentWorkspace, dispatch])

    // 未选择工作区时显示工作区选择页面
    if (!currentWorkspace) {
        return (
            <div style={{ height: 'calc(100vh - 64px)', width: '100%' }}>
                <WorkspaceSelector />
            </div>
        )
    }

    // 已选择工作区时显示会话页面
    return (
        <>
            {/* 工作区导航栏 */}
            <div style={{
                height: 40,
                background: '#fafafa',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
            }}>
                <Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBackToWorkspaces}
                    >
                        返回
                    </Button>
                    <span style={{ color: '#999' }}>|</span>
                    <FolderOutlined style={{ color: '#1890ff' }} />
                    <Typography.Text strong>{currentWorkspace.name}</Typography.Text>
                </Space>
            </div>

            {/* 三栏布局: 聊天面板 | 文件浏览器 | 编辑器面板 */}
            {isInitializing ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'calc(100vh - 104px)',
                    width: '100%',
                    background: '#fff'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                        <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
                            正在加载工作区数据...
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    height: 'calc(100vh - 104px)',
                    width: '100%'
                }}
                ref={containerRef}
                >
                    <div style={{
                        background: '#fff',
                        borderRight: '1px solid #f0f0f0',
                        overflow: 'hidden',
                        width: panelWidths.left,
                        minWidth: minLeftWidth
                    }}>
                        <ChatPanel />
                    </div>
                    <div
                        onMouseDown={(event) => handleResizeStart('left', event)}
                        style={{
                            width: resizerWidth,
                            cursor: 'col-resize',
                            background: '#f0f0f0'
                        }}
                    />
                    <div style={{
                        background: '#fff',
                        borderRight: '1px solid #f0f0f0',
                        overflow: 'hidden',
                        width: panelWidths.middle,
                        minWidth: minMiddleWidth
                    }}>
                        <FileBrowserPanel />
                    </div>
                    <div
                        onMouseDown={(event) => handleResizeStart('middle', event)}
                        style={{
                            width: resizerWidth,
                            cursor: 'col-resize',
                            background: '#f0f0f0'
                        }}
                    />
                    <div style={{
                        background: '#f5f5f5',
                        overflow: 'hidden',
                        flex: 1,
                        minWidth: minRightWidth
                    }}>
                        <WorkspacePanel />
                    </div>
                </div>
            )}
        </>
    )
}

export default function AgentPage() {
    return (
        <AppProvider>
            <Layout style={{ height: '100vh' }}>
                <Header style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    background: '#001529'
                }}>
                    <RobotOutlined style={{ fontSize: 24, color: '#fff', marginRight: 12 }} />
                    <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
                        AI DevOps Agent
                    </Typography.Title>
                </Header>
                <MainContent />
            </Layout>
        </AppProvider>
    )
}
