'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from 'antd'
import type { InputRef } from 'antd'
import { apiFetch } from '@/lib/api'
import styles from './CommandPalette.module.css'

/**
 * 快捷指令类型（与API接口保持一致）
 */
export interface QuickCommand {
    id: string
    name: string
    description: string
    type: 'command' | 'skill'
    content: string
    triggerWords?: string[]
}

/**
 * 命令面板组件属性
 */
export interface CommandPaletteProps {
    /** 是否显示命令面板 */
    visible: boolean
    /** 隐藏命令面板 */
    onClose: () => void
    /** 选择命令回调 */
    onSelect: (command: QuickCommand) => void
    /** 当前工作区路径 */
    workspacePath: string
}

/**
 * 命令面板组件
 *
 * 在输入框第一个字符为/时显示快捷指令选择面板
 */
export default function CommandPalette({
    visible,
    onClose,
    onSelect,
    workspacePath,
}: CommandPaletteProps) {
    const [searchText, setSearchText] = useState('')
    const [commands, setCommands] = useState<QuickCommand[]>([])
    const [filteredCommands, setFilteredCommands] = useState<QuickCommand[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<InputRef>(null)
    const listRef = useRef<HTMLDivElement>(null)

    /**
     * 加载快捷指令
     */
    const loadCommands = useCallback(async () => {
        if (!workspacePath) return

        setIsLoading(true)
        try {
            const response = await apiFetch(`/api/commands?workspacePath=${encodeURIComponent(workspacePath)}`)
            if (response.ok) {
                const data = await response.json()
                setCommands(data.commands || [])
            }
        } catch {
            console.error('加载快捷指令失败')
        } finally {
            setIsLoading(false)
        }
    }, [workspacePath])

    /**
     * 筛选命令
     */
    useEffect(() => {
        if (!searchText) {
            setFilteredCommands(commands)
        } else {
            const lowerSearch = searchText.toLowerCase()
            const filtered = commands.filter(cmd => {
                // 搜索名称（去掉/前缀）
                const nameWithoutSlash = cmd.name.startsWith('/') ? cmd.name.slice(1) : cmd.name
                return (
                    nameWithoutSlash.toLowerCase().includes(lowerSearch) ||
                    cmd.description.toLowerCase().includes(lowerSearch) ||
                    cmd.triggerWords?.some(w => w.toLowerCase().includes(lowerSearch))
                )
            })
            setFilteredCommands(filtered)
        }
        setSelectedIndex(0)
    }, [searchText, commands])

    /**
     * 显示时加载命令并聚焦输入框
     */
    useEffect(() => {
        if (visible) {
            loadCommands()
            setSearchText('')
            setSelectedIndex(0)
            // 延迟聚焦，确保DOM已渲染
            setTimeout(() => {
                inputRef.current?.focus()
            }, 50)
        }
    }, [visible, loadCommands])

    /**
     * 处理键盘导航
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const items = filteredCommands
        const maxIndex = items.length - 1

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0))
                scrollToIndex(selectedIndex < maxIndex ? selectedIndex + 1 : 0)
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex))
                scrollToIndex(selectedIndex > 0 ? selectedIndex - 1 : maxIndex)
                break
            case 'Enter':
                e.preventDefault()
                if (items[selectedIndex]) {
                    handleSelect(items[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                onClose()
                break
        }
    }

    /**
     * 滚动到指定索引
     */
    const scrollToIndex = (index: number) => {
        if (listRef.current) {
            const items = listRef.current.querySelectorAll('[data-command-item]')
            if (items[index]) {
                items[index].scrollIntoView({ block: 'nearest' })
            }
        }
    }

    /**
     * 选择命令
     */
    const handleSelect = (command: QuickCommand) => {
        onSelect(command)
        onClose()
    }

    if (!visible) {
        return null
    }

    // 按类型分组
    const commandList = filteredCommands.filter(c => c.type === 'command')
    const skillList = filteredCommands.filter(c => c.type === 'skill')

    return (
        <div className={styles.paletteOverlay} onClick={onClose}>
            <div className={styles.palette} onClick={e => e.stopPropagation()}>
                <Input
                    ref={inputRef}
                    className={styles.searchInput}
                    placeholder="输入命令或技能名称..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    bordered={false}
                />

                <div className={styles.divider} />

                {isLoading ? (
                    <div className={styles.loadingState}>加载中...</div>
                ) : filteredCommands.length === 0 ? (
                    <div className={styles.emptyState}>
                        {searchText ? '未找到匹配的命令' : '暂无快捷指令'}
                    </div>
                ) : (
                    <div className={styles.commandList} ref={listRef}>
                        {/* 命令列表 */}
                        {commandList.length > 0 && (
                            <>
                                <div className={styles.sectionTitle}>命令</div>
                                {commandList.map((cmd, index) => {
                                    const globalIndex = filteredCommands.indexOf(cmd)
                                    return (
                                        <div
                                            key={cmd.id}
                                            data-command-item
                                            className={`${styles.commandItem} ${globalIndex === selectedIndex ? styles.selected : ''}`}
                                            onClick={() => handleSelect(cmd)}
                                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                                        >
                                            <div className={`${styles.commandIcon} ${styles.command}`}>
                                                /
                                            </div>
                                            <div className={styles.commandInfo}>
                                                <div className={styles.commandName}>{cmd.name}</div>
                                                <div className={styles.commandDescription}>{cmd.description}</div>
                                            </div>
                                            <div className={styles.commandShortcut}>
                                                <span className={styles.kbd}>↵</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        )}

                        {/* 技能列表 */}
                        {skillList.length > 0 && (
                            <>
                                <div className={styles.sectionTitle}>技能</div>
                                {skillList.map((cmd, index) => {
                                    const globalIndex = filteredCommands.indexOf(cmd)
                                    return (
                                        <div
                                            key={cmd.id}
                                            data-command-item
                                            className={`${styles.commandItem} ${globalIndex === selectedIndex ? styles.selected : ''}`}
                                            onClick={() => handleSelect(cmd)}
                                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                                        >
                                            <div className={`${styles.commandIcon} ${styles.skill}`}>
                                                {cmd.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={styles.commandInfo}>
                                                <div className={styles.commandName}>{cmd.name}</div>
                                                <div className={styles.commandDescription}>{cmd.description}</div>
                                            </div>
                                            <div className={styles.commandShortcut}>
                                                <span className={styles.kbd}>↵</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
