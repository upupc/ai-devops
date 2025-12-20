'use client'

import React, { useState } from 'react'
import {
    Tree,
    Empty,
    Typography,
    Dropdown,
    Modal,
    Input,
    message,
    Button
} from 'antd'
import {
    FolderOutlined,
    FolderOpenOutlined,
    FileOutlined,
    FileTextOutlined,
    FileMarkdownOutlined,
    SettingOutlined,
    ReloadOutlined,
    PlusOutlined,
    DeleteOutlined,
    EditOutlined
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useAppState } from '@/lib/store'
import { FileNode } from '@/types'
import styles from './FileBrowserPanel.module.css'

const { Text } = Typography

/**
 * 获取文件图标
 */
function getFileIcon(name: string, isDirectory: boolean): React.ReactNode {
    if (isDirectory) {
        return <FolderOutlined style={{ color: '#faad14' }} />
    }

    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'ts':
        case 'tsx':
            return <FileTextOutlined style={{ color: '#3178c6' }} />
        case 'js':
        case 'jsx':
            return <FileTextOutlined style={{ color: '#f7df1e' }} />
        case 'json':
            return <SettingOutlined style={{ color: '#cbcb41' }} />
        case 'md':
            return <FileMarkdownOutlined style={{ color: '#083fa1' }} />
        case 'css':
        case 'scss':
        case 'less':
            return <FileTextOutlined style={{ color: '#264de4' }} />
        default:
            return <FileOutlined />
    }
}

/**
 * 将 FileNode 转换为 Ant Design Tree 的 DataNode
 */
function convertToTreeData(node: FileNode): DataNode {
    const isLeaf = node.type === 'file'
    return {
        key: node.path,
        title: node.name,
        icon: ({ expanded }: { expanded?: boolean }) =>
            node.type === 'directory'
                ? (expanded ? <FolderOpenOutlined style={{ color: '#faad14' }} /> : <FolderOutlined style={{ color: '#faad14' }} />)
                : getFileIcon(node.name, false),
        isLeaf,
        children: node.children?.map(convertToTreeData),
    }
}

/**
 * 文件浏览面板组件
 */
export default function FileBrowserPanel() {
    const { state, dispatch } = useAppState()
    const { workspace, fileTree } = state

    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [createType, setCreateType] = useState<'file' | 'directory'>('file')
    const [createPath, setCreatePath] = useState('')
    const [newName, setNewName] = useState('')
    const [selectedPath, setSelectedPath] = useState<string | null>(null)

    /**
     * 刷新文件树
     */
    const refreshFileTree = async () => {
        if (!workspace) return

        try {
            const response = await fetch(`/api/files?workspaceId=${workspace.id}`)
            if (!response.ok) throw new Error('获取文件列表失败')

            const data = await response.json()
            dispatch({ type: 'SET_FILE_TREE', payload: data.tree })
            message.success('文件列表已刷新')
        } catch {
            message.error('刷新文件列表失败')
        }
    }

    /**
     * 打开文件
     */
    const handleOpenFile = async (path: string) => {
        if (!workspace) return

        try {
            const response = await fetch(`/api/files/${encodeURIComponent(path)}?workspaceId=${workspace.id}`)
            if (!response.ok) throw new Error('读取文件失败')

            const data = await response.json()
            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    path,
                    content: data.content,
                    modified: false,
                },
            })
        } catch {
            message.error('打开文件失败')
        }
    }

    /**
     * 创建文件或目录
     */
    const handleCreate = async () => {
        if (!workspace || !newName.trim()) {
            message.warning('请输入名称')
            return
        }

        const fullPath = createPath ? `${createPath}/${newName}` : newName

        try {
            const response = await fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    path: fullPath,
                    type: createType,
                    content: createType === 'file' ? '' : undefined,
                }),
            })

            if (!response.ok) throw new Error('创建失败')

            await refreshFileTree()
            setCreateModalVisible(false)
            setNewName('')
            message.success(`${createType === 'file' ? '文件' : '文件夹'}创建成功`)
        } catch {
            message.error('创建失败')
        }
    }

    /**
     * 删除文件或目录
     */
    const handleDelete = async (path: string) => {
        if (!workspace) return

        Modal.confirm({
            title: '确认删除',
            content: `确定要删除 ${path} 吗？`,
            onOk: async () => {
                try {
                    const response = await fetch(
                        `/api/files/${encodeURIComponent(path)}?workspaceId=${workspace.id}`,
                        { method: 'DELETE' }
                    )

                    if (!response.ok) throw new Error('删除失败')

                    await refreshFileTree()
                    dispatch({ type: 'CLOSE_FILE', payload: path })
                    message.success('删除成功')
                } catch {
                    message.error('删除失败')
                }
            },
        })
    }

    /**
     * 选择节点
     */
    const handleSelect: TreeProps['onSelect'] = (selectedKeys) => {
        if (selectedKeys.length > 0) {
            setSelectedPath(selectedKeys[0] as string)
        }
    }

    /**
     * 双击打开文件
     */
    const handleDoubleClick = (_e: React.MouseEvent, node: DataNode) => {
        if (node.isLeaf) {
            handleOpenFile(node.key as string)
        }
    }

    /**
     * 右键菜单项
     */
    const getContextMenuItems = (node: DataNode) => {
        const isDirectory = !node.isLeaf
        const path = node.key as string

        const items = []

        if (!node.isLeaf) {
            items.push({
                key: 'open',
                label: '打开',
                onClick: () => handleOpenFile(path),
            })
        }

        if (isDirectory) {
            items.push(
                {
                    key: 'newFile',
                    label: '新建文件',
                    icon: <PlusOutlined />,
                    onClick: () => {
                        setCreateType('file')
                        setCreatePath(path)
                        setCreateModalVisible(true)
                    },
                },
                {
                    key: 'newFolder',
                    label: '新建文件夹',
                    icon: <FolderOutlined />,
                    onClick: () => {
                        setCreateType('directory')
                        setCreatePath(path)
                        setCreateModalVisible(true)
                    },
                }
            )
        }

        items.push(
            { type: 'divider' as const },
            {
                key: 'delete',
                label: '删除',
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => handleDelete(path),
            }
        )

        return items
    }

    if (!workspace) {
        return (
            <div className={styles.emptyContainer}>
                <Empty description="请选择或创建一个会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
        )
    }

    const treeData = fileTree ? [convertToTreeData(fileTree)] : []

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Text strong>文件浏览器</Text>
                <div className={styles.actions}>
                    <Button
                        type="text"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setCreateType('file')
                            setCreatePath('')
                            setCreateModalVisible(true)
                        }}
                        title="新建文件"
                    />
                    <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={refreshFileTree}
                        title="刷新"
                    />
                </div>
            </div>

            <div className={styles.treeContainer}>
                {treeData.length === 0 || (fileTree && (!fileTree.children || fileTree.children.length === 0)) ? (
                    <div className={styles.emptyTree}>
                        <Empty
                            description="工作区为空"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        >
                            <Button
                                type="primary"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setCreateType('file')
                                    setCreatePath('')
                                    setCreateModalVisible(true)
                                }}
                            >
                                创建文件
                            </Button>
                        </Empty>
                    </div>
                ) : (
                    <Tree
                        showIcon
                        defaultExpandAll
                        treeData={treeData}
                        onSelect={handleSelect}
                        selectedKeys={selectedPath ? [selectedPath] : []}
                        titleRender={(node) => (
                            <Dropdown
                                menu={{ items: getContextMenuItems(node as DataNode) }}
                                trigger={['contextMenu']}
                            >
                                <span
                                    onDoubleClick={(e) => handleDoubleClick(e, node as DataNode)}
                                    className={styles.treeNodeTitle}
                                >
                                    {node.title as React.ReactNode}
                                </span>
                            </Dropdown>
                        )}
                    />
                )}
            </div>

            {/* 创建文件/目录对话框 */}
            <Modal
                title={`新建${createType === 'file' ? '文件' : '文件夹'}`}
                open={createModalVisible}
                onOk={handleCreate}
                onCancel={() => {
                    setCreateModalVisible(false)
                    setNewName('')
                }}
                okText="创建"
                cancelText="取消"
            >
                <Input
                    placeholder={`请输入${createType === 'file' ? '文件' : '文件夹'}名称`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onPressEnter={handleCreate}
                    prefix={createType === 'file' ? <FileOutlined /> : <FolderOutlined />}
                />
                {createPath && (
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        位置: {createPath}/
                    </Text>
                )}
            </Modal>
        </div>
    )
}
