'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
    Input,
    Button,
    Typography,
    Modal,
    message,
    Avatar,
    Empty,
    Select
} from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    UserOutlined,
    RobotOutlined,
    LoadingOutlined,
    ClockCircleOutlined,
    ArrowUpOutlined,
    DownOutlined
} from '@ant-design/icons'
import { useAppState } from '@/lib/store'
import { apiFetch } from '@/lib/api'
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
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')

    const { sessions, currentSessionId, messages, isLoading, currentWorkspace } = state
    const [isInitializing, setIsInitializing] = useState(false)

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

            // 获取会话消息
            const messagesRes = await apiFetch(`/api/sessions/${sessionId}/messages`)
            if (messagesRes.ok) {
                const messagesData = await messagesRes.json()
                dispatch({ type: 'SET_MESSAGES', payload: messagesData.messages })
            }

            // 刷新文件树（工作区已经选定）
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
            const response = await apiFetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    message: inputValue,
                    model: selectedModel,
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
                                <div className={styles.thinkingDots}>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                                <Text type="secondary" style={{ marginLeft: 8 }}>正在思考...</Text>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 输入区域 */}
            <div className={styles.composerContainer}>
                <div className={styles.composer}>
                    <TextArea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={currentSessionId ? '有什么我可以帮助你的吗？' : '请先选择一个会话'}
                        autoSize={{ minRows: 3, maxRows: 10 }}
                        disabled={!currentSessionId || isLoading}
                        className={styles.composerTextarea}
                    />
                    <div className={styles.composerFooter}>
                        <div className={styles.composerLeft}>
                            <Button
                                type="text"
                                icon={<PlusOutlined />}
                                className={styles.composerIconButton}
                                disabled={isLoading}
                                title="添加（敬请期待）"
                            />
                            <Button
                                type="text"
                                icon={<ClockCircleOutlined />}
                                className={styles.composerIconButton}
                                disabled={isLoading}
                                title="历史（敬请期待）"
                            />
                        </div>
                        <div className={styles.composerRight}>
                            <Select
                                value={selectedModel}
                                onChange={setSelectedModel}
                                options={[
                                    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
                                    { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5' },
                                    { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5' },
                                ]}
                                className={styles.modelSelect}
                                bordered={false}
                                suffixIcon={<DownOutlined />}
                                disabled={isLoading}
                                popupMatchSelectWidth={false}
                            />
                            <Button
                                type="text"
                                icon={isLoading ? <LoadingOutlined spin /> : <ArrowUpOutlined />}
                                onClick={handleSendMessage}
                                disabled={!currentSessionId || isLoading || !inputValue.trim()}
                                className={styles.sendButton}
                                aria-label="发送"
                            />
                        </div>
                    </div>
                </div>
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
