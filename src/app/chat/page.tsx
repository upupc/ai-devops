'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import {
    PlusOutlined,
    MessageOutlined,
    DeleteOutlined,
    AppstoreOutlined
} from '@ant-design/icons'
import { message as antMessage, Popconfirm, Spin, Button } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import ChatComposer, { ChatMessage } from '@/components/ChatComposer'
import styles from './chat.module.css'

// 类型定义
interface Workspace {
    id: string
    name: string
    path: string
    username?: string
    gitToken?: string
    gitRepo?: string
    llmApiToken?: string
    llmBaseUrl?: string
    createdAt: string
    updatedAt: string
}

interface Session {
    id: string
    name: string
    workspaceId: string
    model?: string
    createdAt: string
    updatedAt: string
}

// Claude Logo 组件
function ClaudeLogo({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#D97757"/>
            <path d="M21.25 18.5L16 8.5L10.75 18.5H13.5L16 13.5L18.5 18.5H21.25Z" fill="white"/>
            <path d="M16 20.5L13.5 18.5H18.5L16 20.5Z" fill="white"/>
        </svg>
    )
}

// Chat 页面内容组件（使用 useSearchParams）
function ChatContent() {
    const searchParams = useSearchParams()
    const workspaceIdFromUrl = searchParams.get('workspaceId')

    // 状态管理
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSession, setCurrentSession] = useState<Session | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)

    // 切换工作区时加载会话列表
    useEffect(() => {
        if (currentWorkspace) {
            fetchSessions(currentWorkspace.id)
            setCurrentSession(null)
            setMessages([])
        }
    }, [currentWorkspace])

    // 切换会话时加载消息
    useEffect(() => {
        if (currentSession && messages.length === 0) {
            fetchMessages(currentSession.id)
        }
    }, [currentSession])

    // 初始化工作区
    useEffect(() => {
        initWorkspace()
    }, [])

    // 初始化工作区
    const initWorkspace = async () => {
        try {
            setIsInitializing(true)
            if (workspaceIdFromUrl) {
                const response = await apiFetch(`/api/workspaces/${workspaceIdFromUrl}`)
                if (response.ok) {
                    const data = await response.json()
                    setCurrentWorkspace(data.workspace)
                } else {
                    antMessage.error('工作区不存在，请检查链接或选择其他工作区')
                }
            } else {
                setCurrentWorkspace(null)
            }
        } catch (error) {
            console.error('Failed to init workspace:', error)
            antMessage.error('加载工作区失败')
        } finally {
            setIsInitializing(false)
        }
    }

    const fetchSessions = async (workspaceId: string) => {
        try {
            const response = await apiFetch(`/api/workspaces/${workspaceId}/sessions`)
            if (response.ok) {
                const data = await response.json()
                setSessions(data.sessions || [])
            }
        } catch (error) {
            console.error('Failed to fetch sessions:', error)
        }
    }

    const fetchMessages = async (sessionId: string) => {
        try {
            const response = await apiFetch(`/api/sessions/${sessionId}/messages`)
            if (response.ok) {
                const data = await response.json()
                const msgs = (data.messages || []).map((m: ChatMessage) => ({
                    id: m.id,
                    sessionId: m.sessionId,
                    role: m.role,
                    content: m.content,
                    createdAt: m.createdAt,
                }))
                setMessages(msgs)
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error)
        }
    }

    const createSession = useCallback(async (): Promise<string | null> => {
        if (!currentWorkspace) {
            antMessage.warning('请先选择工作区')
            return null
        }

        try {
            const response = await apiFetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: currentWorkspace.id,
                    name: `对话 ${sessions.length + 1}`,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const session = data.session || data
                setSessions(prev => [session, ...prev])
                setCurrentSession(session)
                setMessages([])
                return session.id
            }
        } catch (error) {
            console.error('Failed to create session:', error)
            antMessage.error('创建会话失败')
        }
        return null
    }, [currentWorkspace, sessions.length])

    const deleteSession = async (sessionId: string) => {
        try {
            const response = await apiFetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setSessions(prev => prev.filter(s => s.id !== sessionId))
                if (currentSession?.id === sessionId) {
                    setCurrentSession(null)
                    setMessages([])
                }
                antMessage.success('会话已删除')
            }
        } catch (error) {
            console.error('Failed to delete session:', error)
            antMessage.error('删除会话失败')
        }
    }

    /**
     * 添加消息
     */
    const handleAddMessage = useCallback((msg: ChatMessage) => {
        setMessages(prev => [...prev, msg])
    }, [])

    /**
     * 更新消息
     */
    const handleUpdateMessage = useCallback((id: string, content: string) => {
        setMessages(prev =>
            prev.map(m =>
                m.id === id ? { ...m, content: m.content + content } : m
            )
        )
    }, [])

    /**
     * 设置加载状态
     */
    const handleSetLoading = useCallback((loading: boolean) => {
        setIsLoading(loading)
    }, [])

    /**
     * 空状态内容
     */
    const emptyContent = (
        <div className={styles.emptyState}>
            <ClaudeLogo size={48} />
            <h2>有什么我可以帮助你的吗？</h2>
            <p>开始一段新的对话，让我为你解答问题。</p>
        </div>
    )

    // 初始化加载状态
    if (isInitializing) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <Spin size="large" />
                    <p>正在初始化...</p>
                </div>
            </div>
        )
    }

    // 没有工作区时的提示
    if (!currentWorkspace) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <ClaudeLogo size={64} />
                    <h2>请先选择或创建工作区</h2>
                    <p>您需要先创建一个工作区或从工作区选择页面进入。</p>
                    <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                        <Link href="/agent">
                            <Button type="primary" size="large">
                                选择工作区
                            </Button>
                        </Link>
                        <Link href="/agent">
                            <Button size="large">
                                创建工作区
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // 渲染
    return (
        <div className={styles.container}>
            {/* 左侧边栏 */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <button className={styles.newChatButton} onClick={createSession}>
                        <PlusOutlined />
                        <span>新建对话</span>
                    </button>
                    <Link
                        href={currentWorkspace ? `/agent?workspaceId=${currentWorkspace.id}` : '/agent'}
                        className={styles.agentModeButton}
                        target="_blank"
                    >
                        <AppstoreOutlined />
                        <span>Agent 模式</span>
                    </Link>
                </div>

                {/* 会话列表 */}
                <div className={styles.sessionList}>
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className={`${styles.sessionItem} ${currentSession?.id === session.id ? styles.active : ''}`}
                            onClick={() => setCurrentSession(session)}
                        >
                            <MessageOutlined className={styles.sessionIcon} />
                            <span className={styles.sessionName}>{session.name}</span>
                            <Popconfirm
                                title="确定删除这个对话吗？"
                                onConfirm={(e) => {
                                    e?.stopPropagation()
                                    deleteSession(session.id)
                                }}
                                okText="删除"
                                cancelText="取消"
                            >
                                <button
                                    className={styles.deleteButton}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <DeleteOutlined />
                                </button>
                            </Popconfirm>
                        </div>
                    ))}
                </div>
            </aside>

            {/* 主聊天区域 */}
            <main className={styles.main}>
                <ChatComposer
                    messages={messages}
                    isLoading={isLoading}
                    sessionId={currentSession?.id || null}
                    onAddMessage={handleAddMessage}
                    onUpdateMessage={handleUpdateMessage}
                    onSetLoading={handleSetLoading}
                    onCreateSession={createSession}
                    onSendError={() => antMessage.error('发送消息失败')}
                    disabled={!currentWorkspace}
                    placeholder={currentSession ? '有什么我可以帮助你的吗？' : '直接输入以开始新对话'}
                    enableMarkdown
                    emptyContent={emptyContent}
                    disclaimer="Claude 可能会犯错。请核实重要信息。"
                    variant="full"
                />
            </main>
        </div>
    )
}

// Chat 页面默认导出（用 Suspense 包裹）
export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <Spin size="large" />
                    <p>正在加载...</p>
                </div>
            </div>
        }>
            <ChatContent />
        </Suspense>
    )
}
