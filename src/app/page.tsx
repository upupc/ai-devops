'use client'

import { Layout, Typography, Button, Space } from 'antd'
import { RobotOutlined, ArrowLeftOutlined, FolderOutlined } from '@ant-design/icons'
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

    /**
     * 返回工作区选择页面
     */
    const handleBackToWorkspaces = () => {
        dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: null })
        dispatch({ type: 'RESET_SESSION_STATE' })
    }

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
            <div style={{
                display: 'grid',
                gridTemplateColumns: '420px 200px 1fr',
                height: 'calc(100vh - 104px)',
                width: '100%'
            }}>
                <div style={{
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    overflow: 'hidden'
                }}>
                    <ChatPanel />
                </div>
                <div style={{
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    overflow: 'hidden'
                }}>
                    <FileBrowserPanel />
                </div>
                <div style={{
                    background: '#f5f5f5',
                    overflow: 'hidden'
                }}>
                    <WorkspacePanel />
                </div>
            </div>
        </>
    )
}

export default function Home() {
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
