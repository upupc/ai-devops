'use client'

import React, { useRef, useEffect, useState, ReactNode } from 'react'
import { Input, Button, Select, Empty, message } from 'antd'
import {
    PlusOutlined,
    ClockCircleOutlined,
    ArrowUpOutlined,
    LoadingOutlined,
    DownOutlined
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { apiFetch } from '@/lib/api'
import styles from './ChatComposer.module.css'
import {SubscriberMessage} from "@/lib/types/agent";
import { ToolCall } from '@/types'
import CommandPalette, { QuickCommand } from '@/components/CommandPalette'

const { TextArea } = Input

/**
 * 工作区信息类型（用于初始化按钮等功能）
 */
export interface WorkspaceInfo {
    id: string
    name: string
    path: string
    username?: string
    gitToken?: string
    gitRepo?: string
}

/**
 * 消息类型
 */
export interface ChatMessage {
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    toolCalls?: ToolCall[]
    createdAt?: Date | string
}

/**
 * 流式数据事件
 */
export interface StreamEvent {
    content?: string
    toolCall?: ToolCall
    fileChanged?: boolean
}

/**
 * 模型选项
 */
const MODEL_OPTIONS = [
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5' },
    { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5' },
]

/**
 * ChatComposer 组件属性
 */
export interface ChatComposerProps {
    /** 消息列表 */
    messages: ChatMessage[]
    /** 是否正在加载 */
    isLoading: boolean
    /** 当前会话 ID */
    sessionId: string | null
    /** 添加消息回调 */
    onAddMessage: (message: ChatMessage) => void
    /** 更新消息回调 */
    onUpdateMessage: (id: string, content: string) => void
    /** 设置加载状态回调 */
    onSetLoading: (loading: boolean) => void
    /** 创建会话回调（可选，当 sessionId 为 null 时调用） */
    onCreateSession?: () => Promise<string | null>
    /** 流式数据事件回调（可选，用于处理 toolCall、fileChanged 等） */
    onStreamEvent?: (event: StreamEvent, messageId: string) => void
    /** 发送成功回调（可选） */
    onSendSuccess?: () => void
    /** 发送失败回调（可选） */
    onSendError?: (error: Error) => void
    /** 是否禁用输入 */
    disabled?: boolean
    /** 输入框占位符 */
    placeholder?: string
    /** 是否启用 Markdown 渲染（默认 false） */
    enableMarkdown?: boolean
    /** 自定义空状态内容 */
    emptyContent?: ReactNode
    /** 当前工作区信息（用于初始化按钮等功能） */
    workspace?: WorkspaceInfo | null
    /** 是否显示初始化按钮（默认 false） */
    showInitButton?: boolean
    /** 底部免责声明 */
    disclaimer?: string
    /** 样式变体: compact 紧凑型(用于面板), full 全屏型(用于页面) */
    variant?: 'compact' | 'full'
    /** 自定义类名 */
    className?: string
}

/**
 * Markdown 渲染组件
 */
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

/**
 * 通用聊天消息和输入组件
 *
 * 内部封装了消息发送、流式响应处理、消息渲染等逻辑
 */
export default function ChatComposer({
    messages,
    isLoading,
    sessionId,
    onAddMessage,
    onUpdateMessage,
    onSetLoading,
    onCreateSession,
    onStreamEvent,
    onSendSuccess,
    onSendError,
    disabled = false,
    placeholder = '有什么我可以帮助你的吗？',
    enableMarkdown = false,
    emptyContent,
    workspace,
    showInitButton = false,
    disclaimer,
    variant = 'compact',
    className,
}: ChatComposerProps) {
    const [inputValue, setInputValue] = useState('')
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    /**
     * 构造包含验证信息的 Git 仓库 URL
     */
    const constructAuthUrl = (ws: WorkspaceInfo): string => {
        if (!ws.username || !ws.gitToken || !ws.gitRepo) {
            return ''
        }

        const repoUrl = ws.gitRepo
        const protocolMatch = repoUrl.match(/^(https?):\/\//)
        const protocol = protocolMatch ? protocolMatch[1] : 'http'
        const urlWithoutProtocol = repoUrl.replace(/^https?:\/\//, '')

        return `${protocol}://${ws.username}:${ws.gitToken}@${urlWithoutProtocol}`
    }

    /**
     * 处理初始化工作区按钮点击
     */
    const handleInitWorkspace = async () => {
        if (!workspace) {
            message.warning('请先选择一个工作区')
            return
        }
        if (!sessionId) {
            message.warning('请先创建或选择一个会话')
            return
        }

        const initMessage = "/init-workspace";

        if (disabled || isLoading) {
            message.warning('正在发送消息，请稍后...')
            return;
        }
        await doSendMessage(initMessage);
    }

    /**
     * 滚动到最新消息
     */
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const doSendMessage = async (content: string) =>{
        let activeSessionId = sessionId
        if (!activeSessionId) {
            if (onCreateSession) {
                activeSessionId = await onCreateSession()
                if (!activeSessionId) return
            } else {
                return
            }
        }

        // 创建用户消息
        const userMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            sessionId: activeSessionId,
            role: 'user',
            content: content,
            createdAt: new Date(),
        }
        onAddMessage(userMessage)
        onSetLoading(true)

        // 创建助手消息占位
        // const assistantMessage: ChatMessage = {
        //     id: `msg_${Date.now()}_assistant`,
        //     sessionId: activeSessionId,
        //     role: 'assistant',
        //     content: '',
        //     createdAt: new Date(),
        // }
        // onAddMessage(assistantMessage)

        try {
            const response = await apiFetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    sessionId: activeSessionId,
                    message: content,
                    model: selectedModel,
                }),
            })

            if (!response.ok) throw new Error('发送消息失败')

            const reader = response.body?.getReader()
            if (!reader) throw new Error('无法读取响应')

            const decoder = new TextDecoder()
            let buffer = ''
            let lastMessageId = '';

            while (true) {
                const {done, value} = await reader.read()
                if (done) break

                buffer += decoder.decode(value, {stream: true})
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') return

                        try {
                            const parsed = JSON.parse(data) as SubscriberMessage

                            switch (parsed.type) {
                                case "user_message":
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'user',
                                        content: parsed.content as string,
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                                case "assistant_message":
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'assistant',
                                        content: parsed.content as string,
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                                case "tool_use":
                                    // const toolCallInput = JSON.stringify(parsed.toolInput)
                                    // const toolMsg = `调用工具:${parsed.toolName}(${toolCallInput})`
                                    // onUpdateMessage(lastMessageId, toolMsg)
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'assistant',
                                        content:'',
                                        toolCalls:[
                                            {
                                                id: parsed.id,
                                                name: parsed.toolName||'',
                                                input: JSON.parse(parsed.toolInput||'{}'),
                                                status: 'running'
                                            }
                                        ],
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                                case "result":
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'assistant',
                                        content: `对话完成：成本:\$${Number(parsed.cost).toFixed(2)} 耗时:${(Number(parsed.duration) / 1000).toFixed(2)}s Tokens:${(Number(parsed.tokens) / 1000).toFixed(2)}K`,
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                                case "error":
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'assistant',
                                        content: `处理失败：${parsed.error}`,
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                                default:
                                    onAddMessage({
                                        id: parsed.id,
                                        sessionId: activeSessionId,
                                        role: 'assistant',
                                        content: `处理失败：${JSON.stringify(parsed)}`,
                                        createdAt: new Date(),
                                    });
                                    lastMessageId = parsed.id;
                                    break;
                            }

                            // 通知父组件处理其他事件
                            if (onStreamEvent) {
                                onStreamEvent(parsed, lastMessageId)
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                })
            }


            onSendSuccess?.()
        } catch (error) {
            onSendError?.(error as Error)
        } finally {
            onSetLoading(false);
            console.log('onSetLoading false')
        }
    }

    /**
     * 发送消息
     */
    const handleSendMessage = async () => {
        if (!inputValue.trim() || disabled || isLoading) return

        const content = inputValue.trim()
        setInputValue('')

        // 确定会话 ID
        await doSendMessage(content);
    }

    /**
     * 处理键盘事件
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // 如果命令面板打开，使用方向键和Enter导航
        if (showCommandPalette) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape') {
                // 让CommandPalette处理这些按键
                return
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    /**
     * 处理输入框内容变化 - 检测是否显示命令面板
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setInputValue(value)

        // 检测是否以/开头且命令面板未显示
        if (value === '/' && !showCommandPalette && workspace) {
            setShowCommandPalette(true)
        }
    }

    /**
     * 选择快捷指令
     */
    const handleSelectCommand = (command: QuickCommand) => {
        // 使用命令的完整内容
        setInputValue(command.name.trim())
        // 聚焦输入框
        setTimeout(() => {
            textareaRef.current?.focus()
        }, 100)
    }

    /**
     * 关闭命令面板
     */
    const handleCloseCommandPalette = () => {
        setShowCommandPalette(false)
    }

    /**
     * 渲染消息内容
     */
    const renderMessageContent = (msg: ChatMessage) => {
        // 用户消息：纯文本
        if (msg.role === 'user') {
            return (
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                    {msg.content}
                </pre>
            )
        }

        // 助手消息：根据配置决定是否使用 Markdown 渲染
        const contentElement = enableMarkdown ? (
            <MarkdownContent content={msg.content} />
        ) : (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                {msg.content}
            </pre>
        )

        // 渲染工具调用信息（markdown 代码块格式）
        const toolCallsElement = msg.toolCalls && msg.toolCalls.length > 0 ? (
            <div className={styles.toolCalls}>
                {msg.toolCalls.map(tool => {
                    const inputStr = tool.input ? JSON.stringify(tool.input, null, 2) : '';
                    const markdownContent = `调用工具:\n\`\`\`shell\n${tool.name}(${inputStr})\n\`\`\``;
                    return (
                        <div key={tool.id} className={styles.toolCall}>
                            <MarkdownContent content={markdownContent} />
                        </div>
                    );
                })}
            </div>
        ) : null

        return (
            <>
                {contentElement}
                {toolCallsElement}
            </>
        )
    }

    /**
     * 默认空状态
     */
    const defaultEmptyContent = (
        <Empty description="开始新对话吧" />
    )

    const containerClass = [
        styles.container,
        variant === 'full' ? styles.fullVariant : styles.compactVariant,
        className,
    ].filter(Boolean).join(' ')

    return (
        <div className={containerClass}>
            {/* 消息列表区域 */}
            <div className={styles.messagesContainer}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        {emptyContent || defaultEmptyContent}
                    </div>
                ) : (
                    <div className={styles.messagesWrapper}>
                        <div className={styles.messagesList}>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}
                                >
                                    <div className={`${styles.messageContent} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
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
                                    <span className={styles.thinkingText}>思考中...</span>
                                </div>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 输入区域 */}
            <div className={styles.composerContainer}>
                {/* 快捷工具栏 */}
                {showInitButton && (
                    <div className={styles.quickToolbar}>
                        <Button
                            type="text"
                            disabled={isLoading}
                            onClick={handleInitWorkspace}
                        >
                            初始化空间
                        </Button>
                    </div>
                )}

                <div className={styles.composer}>
                    <TextArea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        autoSize={{ minRows: variant === 'full' ? 3 : 2, maxRows: 10 }}
                        disabled={disabled || isLoading}
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
                                options={MODEL_OPTIONS}
                                className={styles.modelSelect}
                                variant="borderless"
                                suffixIcon={<DownOutlined />}
                                disabled={isLoading}
                                popupMatchSelectWidth={false}
                            />
                            <Button
                                type="text"
                                icon={isLoading ? <LoadingOutlined spin /> : <ArrowUpOutlined />}
                                onClick={handleSendMessage}
                                disabled={disabled || isLoading || !inputValue.trim() || (!sessionId && !onCreateSession)}
                                className={styles.sendButton}
                                aria-label="发送"
                            />
                        </div>
                    </div>
                </div>

                {/* 免责声明 */}
                {disclaimer && (
                    <p className={styles.disclaimer}>{disclaimer}</p>
                )}
            </div>

            {/* 快捷指令面板 */}
            {workspace && (
                <CommandPalette
                    visible={showCommandPalette}
                    onClose={handleCloseCommandPalette}
                    onSelect={handleSelectCommand}
                    workspacePath={workspace.path}
                />
            )}
        </div>
    )
}
