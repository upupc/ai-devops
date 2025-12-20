import '@ant-design/v5-patch-for-react-19'
import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import './globals.css'

export const metadata: Metadata = {
    title: 'AI DevOps Agent',
    description: '基于 Claude Agent SDK 的多轮对话 AI Agent 应用',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN">
            <body>
                <AntdRegistry>{children}</AntdRegistry>
            </body>
        </html>
    )
}
