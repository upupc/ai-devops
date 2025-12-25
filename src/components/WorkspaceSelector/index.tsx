'use client'

import React, { useState, useEffect } from 'react'
import {
    Card,
    List,
    Button,
    Typography,
    Modal,
    Input,
    Empty,
    message,
    Dropdown,
    Space,
    Spin
} from 'antd'
import {
    PlusOutlined,
    FolderOutlined,
    DeleteOutlined,
    MoreOutlined,
    ArrowRightOutlined
} from '@ant-design/icons'
import { useAppState } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { Workspace, Session } from '@/types'
import styles from './WorkspaceSelector.module.css'

const { Title, Text } = Typography

/**
 * 工作区选择器组件
 * 用于选择或创建工作区
 */
export default function WorkspaceSelector() {
    const { state, dispatch } = useAppState()
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    const { workspaces } = state

    /**
     * 加载工作区列表
     */
    useEffect(() => {
        loadWorkspaces()
    }, [])

    const loadWorkspaces = async () => {
        try {
            setLoading(true)
            const response = await apiFetch('/api/workspaces')
            if (response.ok) {
                const data = await response.json()
                dispatch({ type: 'SET_WORKSPACES', payload: data.workspaces })
            }
        } catch {
            message.error('加载工作区列表失败')
        } finally {
            setLoading(false)
        }
    }

    /**
     * 创建新工作区
     */
    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            message.warning('请输入工作区名称')
            return
        }

        try {
            setCreating(true)
            const response = await apiFetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWorkspaceName }),
            })

            if (!response.ok) throw new Error('创建工作区失败')

            const data = await response.json()
            dispatch({ type: 'ADD_WORKSPACE', payload: data.workspace })
            setNewWorkspaceName('')
            setIsCreateModalVisible(false)
            message.success('工作区创建成功')

            // 自动进入新创建的工作区
            handleSelectWorkspace(data.workspace)
        } catch {
            message.error('创建工作区失败')
        } finally {
            setCreating(false)
        }
    }

    /**
     * 选择工作区并进入
     */
    const handleSelectWorkspace = async (workspace: Workspace) => {
        try {
            // 设置当前工作区
            dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: workspace })
            dispatch({ type: 'RESET_SESSION_STATE' })

            // 加载该工作区的会话列表
            const sessionsRes = await apiFetch(`/api/workspaces/${workspace.id}/sessions`)
            let sessions: Session[] = []
            if (sessionsRes.ok) {
                const sessionsData = await sessionsRes.json()
                sessions = sessionsData.sessions
            }

            // 如果没有会话，创建默认会话
            if (sessions.length === 0) {
                const createRes = await apiFetch(`/api/workspaces/${workspace.id}/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: '默认会话' }),
                })
                if (createRes.ok) {
                    const createData = await createRes.json()
                    sessions = [createData.session]
                }
            }

            dispatch({ type: 'SET_SESSIONS', payload: sessions })

            // 选中最近的会话（第一个）
            if (sessions.length > 0) {
                const latestSession = sessions[0]
                dispatch({ type: 'SET_CURRENT_SESSION', payload: latestSession.id })

                // 加载该会话的消息
                const messagesRes = await apiFetch(`/api/sessions/${latestSession.id}/messages`)
                if (messagesRes.ok) {
                    const messagesData = await messagesRes.json()
                    dispatch({ type: 'SET_MESSAGES', payload: messagesData.messages })
                }
            }

            // 加载文件树
            const filesRes = await apiFetch(`/api/files?workspaceId=${workspace.id}`)
            if (filesRes.ok) {
                const filesData = await filesRes.json()
                dispatch({ type: 'SET_FILE_TREE', payload: filesData.tree })
            }
        } catch {
            message.error('进入工作区失败')
        }
    }

    /**
     * 删除工作区
     */
    const handleDeleteWorkspace = async (workspaceId: string) => {
        Modal.confirm({
            title: '确认删除',
            content: '删除工作区将同时删除所有会话和文件，确定要删除吗？',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const response = await apiFetch(`/api/workspaces/${workspaceId}`, {
                        method: 'DELETE',
                    })

                    if (!response.ok) throw new Error('删除工作区失败')

                    dispatch({ type: 'DELETE_WORKSPACE', payload: workspaceId })
                    message.success('工作区已删除')
                } catch {
                    message.error('删除工作区失败')
                }
            },
        })
    }

    /**
     * 格式化日期
     */
    const formatDate = (date: Date | string) => {
        const d = new Date(date)
        return d.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Title level={3}>选择工作区</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                >
                    创建工作区
                </Button>
            </div>

            {workspaces.length === 0 ? (
                <div className={styles.emptyContainer}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无工作区"
                    >
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsCreateModalVisible(true)}
                        >
                            创建第一个工作区
                        </Button>
                    </Empty>
                </div>
            ) : (
                <List
                    grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
                    dataSource={workspaces}
                    renderItem={(workspace: Workspace) => (
                        <List.Item>
                            <Card
                                className={styles.workspaceCard}
                                hoverable
                                onClick={() => handleSelectWorkspace(workspace)}
                                actions={[
                                    <Button
                                        key="enter"
                                        type="link"
                                        icon={<ArrowRightOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleSelectWorkspace(workspace)
                                        }}
                                    >
                                        进入
                                    </Button>,
                                    <Dropdown
                                        key="more"
                                        menu={{
                                            items: [
                                                {
                                                    key: 'delete',
                                                    label: '删除',
                                                    icon: <DeleteOutlined />,
                                                    danger: true,
                                                    onClick: (e) => {
                                                        e.domEvent.stopPropagation()
                                                        handleDeleteWorkspace(workspace.id)
                                                    },
                                                },
                                            ],
                                        }}
                                        trigger={['click']}
                                    >
                                        <Button
                                            type="text"
                                            icon={<MoreOutlined />}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Dropdown>,
                                ]}
                            >
                                <Card.Meta
                                    avatar={<FolderOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                                    title={workspace.name}
                                    description={
                                        <Space direction="vertical" size={0}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                创建于: {formatDate(workspace.createdAt)}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                更新于: {formatDate(workspace.updatedAt)}
                                            </Text>
                                        </Space>
                                    }
                                />
                            </Card>
                        </List.Item>
                    )}
                />
            )}

            {/* 创建工作区对话框 */}
            <Modal
                title="创建工作区"
                open={isCreateModalVisible}
                onOk={handleCreateWorkspace}
                onCancel={() => setIsCreateModalVisible(false)}
                okText="创建"
                cancelText="取消"
                confirmLoading={creating}
            >
                <Input
                    placeholder="请输入工作区名称"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onPressEnter={handleCreateWorkspace}
                    autoFocus
                />
            </Modal>
        </div>
    )
}
