'use client'

import { Layout, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import ChatPanel from '@/components/ChatPanel'
import WorkspacePanel from '@/components/WorkspacePanel'
import FileBrowserPanel from '@/components/FileBrowserPanel'
import { AppProvider } from '@/lib/store'

const { Header, Sider, Content } = Layout

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
                <Layout style={{ height: 'calc(100vh - 64px)' }}>
                    <Sider
                        width={320}
                        style={{
                            background: '#fff',
                            borderRight: '1px solid #f0f0f0'
                        }}
                    >
                        <ChatPanel />
                    </Sider>
                    <Content style={{ background: '#f5f5f5' }}>
                        <WorkspacePanel />
                    </Content>
                    <Sider
                        width={280}
                        style={{
                            background: '#fff',
                            borderLeft: '1px solid #f0f0f0'
                        }}
                    >
                        <FileBrowserPanel />
                    </Sider>
                </Layout>
            </Layout>
        </AppProvider>
    )
}
