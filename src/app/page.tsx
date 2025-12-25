'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'



/**
 * 首页 - 默认跳转到 Agent 工作台
 */
export default function HomePage() {
    const router = useRouter()

    useEffect(() => {
        router.push('/agent')
    }, [router])

    return null
}
