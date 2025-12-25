'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import {
    PlusOutlined,
    MessageOutlined,
    DeleteOutlined,
    LoadingOutlined,
    ClockCircleOutlined,
    ArrowUpOutlined,
    DownOutlined,
    AppstoreOutlined
} from '@ant-design/icons'
import { message as antMessage, Popconfirm, Spin, Input, Button, Select } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from './chat.module.css'

// 类型定义
interface Workspace {
    id: string
    name: string
    path: string
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

interface Message {
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
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

// Markdown 渲染组件
function MarkdownContent({ content }: { content: string }) {
    return (
        <ReactMarkdown
            components={{
                code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !className
                    return isInline ? (
                        <code className={styles.inlineCode} {...props}>
                            {children}
                        </code>
                    ) : (
                        <SyntaxHighlighter
                            style={oneDark}
                            language={match ? match[1] : 'text'}
                            PreTag="div"
                            customStyle={{
                                margin: '12px 0',
                                borderRadius: '8px',
                                fontSize: '14px',
                            }}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    )
                },
                p({ children }) {
                    return <p className={styles.paragraph}>{children}</p>
                },
                ul({ children }) {
                    return <ul className={styles.list}>{children}</ul>
                },
                ol({ children }) {
                    return <ol className={styles.list}>{children}</ol>
                },
                li({ children }) {
                    return <li className={styles.listItem}>{children}</li>
                },
                h1({ children }) {
                    return <h1 className={styles.heading1}>{children}</h1>
                },
                h2({ children }) {
                    return <h2 className={styles.heading2}>{children}</h2>
                },
                h3({ children }) {
                    return <h3 className={styles.heading3}>{children}</h3>
                },
                blockquote({ children }) {
                    return <blockquote className={styles.blockquote}>{children}</blockquote>
                },
                a({ href, children }) {
                    return <a href={href} className={styles.link} target="_blank" rel="noopener noreferrer">{children}</a>
                },
            }}
        >
            {content}
        </ReactMarkdown>
    )
}

// 默认工作区配置
const DEFAULT_WORKSPACE_ID = 'default_chat'
const DEFAULT_WORKSPACE_NAME = 'Claude Chat'

// Chat 页面内容组件（使用 useSearchParams）
function ChatContent() {
    const searchParams = useSearchParams()
    const workspaceIdFromUrl = searchParams.get('workspaceId')

    // 状态管理
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSession, setCurrentSession] = useState<Session | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')

    // 滚动到底部
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    // 初始化默认工作区
    useEffect(() => {
        initDefaultWorkspace()
    }, [])

    // 切换工作区时加载会话列表
    useEffect(() => {
        if (currentWorkspace) {
            fetchSessions(currentWorkspace.id)
            setCurrentSession(null)
            setMessages([])
        }
    }, [currentWorkspace])

    // 切换会话时加载消息（仅当会话存在且消息列表为空时）
    useEffect(() => {
        if (currentSession && messages.length === 0) {
            fetchMessages(currentSession.id)
        }
    }, [currentSession])

    // 消息更新时滚动到底部
    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    // 初始化默认工作区
    const initDefaultWorkspace = async () => {
        try {
            setIsInitializing(true)
            // 如果 URL 中指定了 workspaceId，使用该 ID，否则使用默认的
            const targetWorkspaceId = workspaceIdFromUrl || DEFAULT_WORKSPACE_ID
            const response = await apiFetch('/api/workspaces/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: targetWorkspaceId,
                    name: workspaceIdFromUrl ? undefined : DEFAULT_WORKSPACE_NAME,
                }),
            })

            if (response.ok) {
                const workspace = await response.json()
                setCurrentWorkspace(workspace)
            } else {
                antMessage.error('初始化工作区失败')
            }
        } catch (error) {
            console.error('Failed to init workspace:', error)
            antMessage.error('初始化工作区失败')
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
                setMessages(data.messages || [])
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error)
        }
    }

    const createSession = async () => {
        if (!currentWorkspace) {
            antMessage.warning('请先选择工作区')
            return
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
                return session
            }
        } catch (error) {
            console.error('Failed to create session:', error)
            antMessage.error('创建会话失败')
        }
    }

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

    // 发送消息
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return

        let activeSession = currentSession
        let isNewSession = false
        if (!activeSession) {
            // 如果没有当前会话，先创建一个
            activeSession = await createSession()
            if (!activeSession) {
                return
            }
            isNewSession = true
            setCurrentSession(activeSession)
        }

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            sessionId: activeSession.id,
            role: 'user',
            content: inputValue.trim(),
            createdAt: new Date().toISOString(),
        }

        setMessages(prev => [...prev, userMessage])
        setInputValue('')
        setIsLoading(true)

        // 创建占位的 AI 消息
        const assistantMessageId = `assistant-${Date.now()}`
        const assistantMessage: Message = {
            id: assistantMessageId,
            sessionId: activeSession.id,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMessage])

        try {
            const response = await apiFetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: activeSession.id,
                    message: userMessage.content,
                    model: selectedModel,
                }),
            })

            if (!response.ok) {
                throw new Error('Chat request failed')
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response body')
            }

            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()

                if (done) break

                buffer += decoder.decode(value, { stream: true })

                // 处理 SSE 数据
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)

                        if (data === '[DONE]') {
                            continue
                        }

                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.content) {
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === assistantMessageId
                                            ? { ...m, content: m.content + parsed.content }
                                            : m
                                    )
                                )
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error)
            antMessage.error('发送消息失败')
            // 移除空的 AI 消息
            setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
        } finally {
            setIsLoading(false)
        }
    }

    // 键盘事件处理
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

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
                {/* 聊天消息区域 */}
                <div className={styles.messagesContainer}>
                    <div className={styles.messagesWrapper}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <ClaudeLogo size={48} />
                                <h2>有什么我可以帮助你的吗？</h2>
                                <p>开始一段新的对话，让我为你解答问题。</p>
                            </div>
                        ) : (
                            messages.map(message => (
                                <div
                                    key={message.id}
                                    className={`${styles.messageRow} ${message.role === 'user' ? styles.userRow : styles.assistantRow}`}
                                >
                                    {message.role === 'assistant' && (
                                        <div className={styles.avatar}>
                                            <ClaudeLogo size={28} />
                                        </div>
                                    )}
                                    <div className={`${styles.messageContent} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
                                        {message.role === 'user' ? (
                                            <p>{message.content}</p>
                                        ) : (
                                            message.content ? (
                                                <MarkdownContent content={message.content} />
                                            ) : (
                                                <div className={styles.thinkingIndicator}>
                                                    <span>思考中</span>
                                                    <span className={styles.thinkingDots}>
                                                        <span />
                                                        <span />
                                                        <span />
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* 底部输入区域 */}
                <div className={styles.composerContainer}>
                    <div className={styles.composer}>
                        <Input.TextArea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={currentSession ? '有什么我可以帮助你的吗？' : '直接输入以开始新对话'}
                            autoSize={{ minRows: 3, maxRows: 10 }}
                            disabled={!currentWorkspace || isLoading}
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
                                    disabled={!currentWorkspace || isLoading || !inputValue.trim()}
                                    className={styles.sendButton}
                                    aria-label="发送"
                                />
                            </div>
                        </div>
                    </div>
                    <p className={styles.disclaimer}>
                        Claude 可能会犯错。请核实重要信息。
                    </p>
                </div>
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
