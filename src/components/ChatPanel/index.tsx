'use client'

import React, { useState } from 'react'
import {
    Input,
    Button,
    Modal,
    message,
    Empty,
    Select
} from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
} from '@ant-design/icons'
import { useAppState } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { Message, Session } from '@/types'
import ChatComposer, { ChatMessage, StreamEvent } from '@/components/ChatComposer'
import styles from './ChatPanel.module.css'

/**
 * 聊天面板组件
 */
export default function ChatPanel() {
    const { state, dispatch } = useAppState()
    const [newSessionName, setNewSessionName] = useState('')
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)

    const { sessions, currentSessionId, messages, isLoading, currentWorkspace } = state

    /**
     * 创建新会话（在当前工作区下）
     */
    const handleCreateSession = async () => {
        if (!newSessionName.trim()) {
            message.warning('请输入会话名称')
            return
        }

        if (!currentWorkspace) {
            message.warning('请先选择工作区')
            return
        }

        try {
            const response = await apiFetch(`/api/workspaces/${currentWorkspace.id}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSessionName }),
            })

            if (!response.ok) throw new Error('创建会话失败')

            const data = await response.json()
            dispatch({ type: 'ADD_SESSION', payload: data.session })
            dispatch({ type: 'SET_CURRENT_SESSION', payload: data.session.id })
            dispatch({ type: 'SET_MESSAGES', payload: [] })

            setNewSessionName('')
            setIsCreateModalVisible(false)
            message.success('会话创建成功')
        } catch {
            message.error('创建会话失败')
        }
    }

    /**
     * 切换会话
     */
    const handleSelectSession = async (sessionId: string) => {
        if (sessionId === currentSessionId) return

        try {
            dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionId })

            const messagesRes = await apiFetch(`/api/sessions/${sessionId}/messages`)
            if (messagesRes.ok) {
                const messagesData = await messagesRes.json()
                dispatch({ type: 'SET_MESSAGES', payload: messagesData.messages })
            }

            if (currentWorkspace) {
                const filesRes = await apiFetch(`/api/files?workspaceId=${currentWorkspace.id}`)
                if (filesRes.ok) {
                    const filesData = await filesRes.json()
                    dispatch({ type: 'SET_FILE_TREE', payload: filesData.tree })
                }
            }
        } catch {
            message.error('切换会话失败')
        }
    }

    /**
     * 删除会话
     */
    const handleDeleteSession = async (sessionId: string) => {
        Modal.confirm({
            title: '确认删除',
            content: '删除会话将删除所有对话记录，确定要删除吗？',
            onOk: async () => {
                try {
                    const response = await apiFetch(`/api/sessions/${sessionId}`, {
                        method: 'DELETE',
                    })

                    if (!response.ok) throw new Error('删除会话失败')

                    dispatch({ type: 'DELETE_SESSION', payload: sessionId })
                    if (currentSessionId === sessionId) {
                        dispatch({ type: 'SET_MESSAGES', payload: [] })
                    }
                    message.success('会话已删除')
                } catch {
                    message.error('删除会话失败')
                }
            },
        })
    }

    /**
     * 刷新文件树
     */
    const refreshFileTree = async () => {
        if (!currentWorkspace) return
        try {
            const response = await apiFetch(`/api/files?workspaceId=${currentWorkspace.id}`)
            if (response.ok) {
                const data = await response.json()
                dispatch({ type: 'SET_FILE_TREE', payload: data.tree })
            }
        } catch {
            // 忽略错误
        }
    }

    /**
     * 添加消息
     */
    const handleAddMessage = (msg: ChatMessage) => {
        const fullMessage: Message = {
            id: msg.id,
            sessionId: msg.sessionId,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || Date.now()),
        }
        dispatch({ type: 'ADD_MESSAGE', payload: fullMessage })
    }

    /**
     * 更新消息
     */
    const handleUpdateMessage = (id: string, content: string) => {
        dispatch({ type: 'UPDATE_MESSAGE', payload: { id, content } })
    }

    /**
     * 设置加载状态
     */
    const handleSetLoading = (loading: boolean) => {
        dispatch({ type: 'SET_LOADING', payload: loading })
    }

    /**
     * 处理流式事件
     */
    const handleStreamEvent = (event: StreamEvent) => {
        if (event.fileChanged) {
            refreshFileTree()
        }
    }

    /**
     * 空状态内容
     */
    const emptyContent = !currentSessionId ? (
        <Empty description="请选择或创建一个会话开始对话" />
    ) : (
        <Empty description="开始新对话吧" />
    )

    /**
     * 转换消息格式（包含 toolCalls）
     */
    const chatMessages: ChatMessage[] = messages.map((m: Message) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.map(t => ({
            id: t.id,
            name: t.name,
            input: t.input,
            output: t.output,
            status: t.status,
        })),
        createdAt: m.createdAt,
    }))

    return (
        <div className={styles.container}>
            {/* 会话选择区域 */}
            <div className={styles.sessionHeader}>
                <Select
                    value={currentSessionId || undefined}
                    onChange={handleSelectSession}
                    placeholder="选择会话"
                    style={{ flex: 1 }}
                    options={sessions.map((session: Session) => ({
                        value: session.id,
                        label: session.name,
                    }))}
                    popupRender={(menu) => (
                        <>
                            {menu}
                            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button
                                    type="link"
                                    icon={<PlusOutlined />}
                                    onClick={() => setIsCreateModalVisible(true)}
                                    style={{ width: '100%', textAlign: 'left' }}
                                >
                                    新建会话
                                </Button>
                            </div>
                        </>
                    )}
                />
                <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                    disabled={!currentSessionId}
                    onClick={() => currentSessionId && handleDeleteSession(currentSessionId)}
                    title="删除当前会话"
                />
            </div>

            {/* 聊天消息和输入区域 */}
            <ChatComposer
                messages={chatMessages}
                isLoading={isLoading}
                sessionId={currentSessionId}
                onAddMessage={handleAddMessage}
                onUpdateMessage={handleUpdateMessage}
                onSetLoading={handleSetLoading}
                onStreamEvent={handleStreamEvent}
                onSendError={() => message.error('发送消息失败')}
                disabled={!currentSessionId}
                placeholder={currentSessionId ? '有什么我可以帮助你的吗？' : '请先选择一个会话'}
                emptyContent={emptyContent}
                workspace={currentWorkspace}
                showInitButton={true}
                variant="compact"
                className={styles.chatComposer}
                enableMarkdown={true}
            />

            {/* 新建会话对话框 */}
            <Modal
                title="新建会话"
                open={isCreateModalVisible}
                onOk={handleCreateSession}
                onCancel={() => setIsCreateModalVisible(false)}
                okText="创建"
                cancelText="取消"
            >
                <Input
                    placeholder="请输入会话名称"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    onPressEnter={handleCreateSession}
                />
            </Modal>
        </div>
    )
}
