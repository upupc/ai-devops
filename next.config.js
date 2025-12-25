/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    transpilePackages: ['antd', '@ant-design/icons'],
}

module.exports = nextConfig
