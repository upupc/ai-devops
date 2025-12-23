'use client'

import { Layout, Typography, Card, Row, Col } from 'antd'
import { RobotOutlined, MessageOutlined, CodeOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Header, Content } = Layout

/**
 * 首页 - 应用入口选择页面
 */
export default function HomePage() {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                background: '#001529'
            }}>
                <RobotOutlined style={{ fontSize: 24, color: '#fff', marginRight: 12 }} />
                <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
                    AI DevOps
                </Typography.Title>
            </Header>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
                background: '#f5f5f5'
            }}>
                <Row gutter={[48, 48]} style={{ maxWidth: 2000, width: '100%' }}>
                    <Col xs={24} sm={12}>
                        <Link href="/chat" style={{ textDecoration: 'none' }}>
                            <Card
                                hoverable
                                style={{ height: 480, textAlign: 'center' }}
                                styles={{ body: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '100%'
                                }}}
                            >
                                <MessageOutlined style={{ fontSize: 72, color: '#1890ff', marginBottom: 24 }} />
                                <Typography.Title level={3} style={{ margin: 0 }}>
                                    Chat
                                </Typography.Title>
                                <Typography.Text type="secondary" style={{ marginTop: 12, fontSize: 16 }}>
                                    智能对话助手
                                </Typography.Text>
                            </Card>
                        </Link>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Link href="/agent" style={{ textDecoration: 'none' }}>
                            <Card
                                hoverable
                                style={{ height: 480, textAlign: 'center' }}
                                styles={{ body: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '100%'
                                }}}
                            >
                                <CodeOutlined style={{ fontSize: 72, color: '#52c41a', marginBottom: 24 }} />
                                <Typography.Title level={3} style={{ margin: 0 }}>
                                    Agent
                                </Typography.Title>
                                <Typography.Text type="secondary" style={{ marginTop: 12, fontSize: 16 }}>
                                    AI DevOps 工作台
                                </Typography.Text>
                            </Card>
                        </Link>
                    </Col>
                </Row>
            </Content>
        </Layout>
    )
}
