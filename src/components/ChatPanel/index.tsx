'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
    List,
    Input,
    Button,
    Typography,
    Space,
    Dropdown,
    Modal,
    message,
    Spin,
    Avatar,
    Empty,
    Divider
} from 'antd'
import {
    SendOutlined,
    PlusOutlined,
    DeleteOutlined,
    MoreOutlined,
    UserOutlined,
    RobotOutlined,
    LoadingOutlined
} from '@ant-design/icons'
import { useAppState } from '@/lib/store'
import { Message, Session } from '@/types'
import styles from './ChatPanel.module.css'

const { TextArea } = Input
const { Text } = Typography

/**
 * 聊天面板组件
 */
export default function ChatPanel() {
    const { state, dispatch } = useAppState()
    const [inputValue, setInputValue] = useState('')
    const [newSessionName, setNewSessionName] = useState('')
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const { sessions, currentSessionId, messages, isLoading } = state

    /**
     * 滚动到最新消息
     */
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    /**
     * 创建新会话
     */
    const handleCreateSession = async () => {
        if (!newSessionName.trim()) {
            message.warning('请输入会话名称')
            return
        }

        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSessionName }),
            })

            if (!response.ok) throw new Error('创建会话失败')

            const data = await response.json()
            dispatch({ type: 'ADD_SESSION', payload: data.session })
            dispatch({ type: 'SET_CURRENT_SESSION', payload: data.session.id })
            dispatch({ type: 'SET_WORKSPACE', payload: data.workspace })
            dispatch({ type: 'SET_MESSAGES', payload: [] })
            dispatch({ type: 'SET_FILE_TREE', payload: null })

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

            // 获取会话消息
            const messagesRes = await fetch(`/api/sessions/${sessionId}/messages`)
            if (messagesRes.ok) {
                const messagesData = await messagesRes.json()
                dispatch({ type: 'SET_MESSAGES', payload: messagesData.messages })
            }

            // 获取工作区信息
            const workspaceRes = await fetch(`/api/sessions/${sessionId}/workspace`)
            if (workspaceRes.ok) {
                const workspaceData = await workspaceRes.json()
                dispatch({ type: 'SET_WORKSPACE', payload: workspaceData.workspace })

                // 获取文件树
                if (workspaceData.workspace) {
                    const filesRes = await fetch(`/api/files?workspaceId=${workspaceData.workspace.id}`)
                    if (filesRes.ok) {
                        const filesData = await filesRes.json()
                        dispatch({ type: 'SET_FILE_TREE', payload: filesData.tree })
                    }
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
            content: '删除会话将同时删除相关的工作区和所有文件，确定要删除吗？',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/sessions/${sessionId}`, {
                        method: 'DELETE',
                    })

                    if (!response.ok) throw new Error('删除会话失败')

                    dispatch({ type: 'DELETE_SESSION', payload: sessionId })
                    if (currentSessionId === sessionId) {
                        dispatch({ type: 'SET_MESSAGES', payload: [] })
                        dispatch({ type: 'SET_WORKSPACE', payload: null })
                        dispatch({ type: 'SET_FILE_TREE', payload: null })
                    }
                    message.success('会话已删除')
                } catch {
                    message.error('删除会话失败')
                }
            },
        })
    }

    /**
     * 发送消息
     */
    const handleSendMessage = async () => {
        if (!inputValue.trim()) return
        if (!currentSessionId) {
            message.warning('请先创建或选择一个会话')
            return
        }

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            sessionId: currentSessionId,
            role: 'user',
            content: inputValue,
            createdAt: new Date(),
        }

        dispatch({ type: 'ADD_MESSAGE', payload: userMessage })
        setInputValue('')
        dispatch({ type: 'SET_LOADING', payload: true })

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    message: inputValue,
                }),
            })

            if (!response.ok) throw new Error('发送消息失败')

            // 处理流式响应
            const reader = response.body?.getReader()
            if (!reader) throw new Error('无法读取响应')

            const assistantMessage: Message = {
                id: `msg_${Date.now()}_assistant`,
                sessionId: currentSessionId,
                role: 'assistant',
                content: '',
                createdAt: new Date(),
            }
            dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage })

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') return

                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.content) {
                                dispatch({
                                    type: 'UPDATE_MESSAGE',
                                    payload: { id: assistantMessage.id, content: parsed.content },
                                })
                            }
                            if (parsed.fileChanged) {
                                // 刷新文件树
                                refreshFileTree()
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                })
            }
        } catch {
            message.error('发送消息失败')
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
        }
    }

    /**
     * 刷新文件树
     */
    const refreshFileTree = async () => {
        if (!state.workspace) return
        try {
            const response = await fetch(`/api/files?workspaceId=${state.workspace.id}`)
            if (response.ok) {
                const data = await response.json()
                dispatch({ type: 'SET_FILE_TREE', payload: data.tree })
            }
        } catch {
            // 忽略错误
        }
    }

    /**
     * 处理键盘事件
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    /**
     * 渲染消息内容
     */
    const renderMessageContent = (msg: Message) => {
        return (
            <div className={styles.messageContent}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                    {msg.content}
                </pre>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className={styles.toolCalls}>
                        {msg.toolCalls.map(tool => (
                            <div key={tool.id} className={styles.toolCall}>
                                <Text type="secondary">工具调用: {tool.name}</Text>
                                {tool.output && (
                                    <pre className={styles.toolOutput}>{tool.output}</pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* 会话列表区域 */}
            <div className={styles.sessionHeader}>
                <Text strong>会话列表</Text>
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                >
                    新建
                </Button>
            </div>

            <div className={styles.sessionList}>
                {sessions.length === 0 ? (
                    <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <List
                        size="small"
                        dataSource={sessions}
                        renderItem={(session: Session) => (
                            <List.Item
                                className={`${styles.sessionItem} ${session.id === currentSessionId ? styles.active : ''}`}
                                onClick={() => handleSelectSession(session.id)}
                                actions={[
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
                                                        handleDeleteSession(session.id)
                                                    },
                                                },
                                            ],
                                        }}
                                        trigger={['click']}
                                    >
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<MoreOutlined />}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Dropdown>,
                                ]}
                            >
                                <Text ellipsis style={{ flex: 1 }}>{session.name}</Text>
                            </List.Item>
                        )}
                    />
                )}
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* 消息列表区域 */}
            <div className={styles.messagesContainer}>
                {!currentSessionId ? (
                    <div className={styles.emptyChat}>
                        <Empty description="请选择或创建一个会话开始对话" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className={styles.emptyChat}>
                        <Empty description="开始新对话吧" />
                    </div>
                ) : (
                    <div className={styles.messagesList}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.messageItem} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                            >
                                <Avatar
                                    size="small"
                                    icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                                    style={{
                                        backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                                        flexShrink: 0,
                                    }}
                                />
                                <div className={styles.messageBubble}>
                                    {renderMessageContent(msg)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className={styles.loadingIndicator}>
                                <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                                <Text type="secondary" style={{ marginLeft: 8 }}>正在思考...</Text>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 输入区域 */}
            <div className={styles.inputContainer}>
                <Space.Compact style={{ width: '100%' }}>
                    <TextArea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={currentSessionId ? "输入消息，按 Enter 发送..." : "请先选择一个会话"}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={!currentSessionId || isLoading}
                        style={{ resize: 'none' }}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleSendMessage}
                        disabled={!currentSessionId || isLoading || !inputValue.trim()}
                    />
                </Space.Compact>
            </div>

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
