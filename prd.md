# 任务
构建一个agent app, 可以进行多轮对话

# 需求
- 前端页面分位三部分，左侧为聊天框，中间为workspace，右侧为workspace的文件浏览
- 在后端使用claude-agent-sdk构建多轮对话的agent

## 技术栈
- Next.js
- claude-agent-sdk
    - 使用教程：https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
- antd
    - 通过"Ant Design Components" MCP查询使用方法

## 约束
- 使用前后端一体架构，部署在同一个端口上
- 前端组件使用antd组件
- agent使用claude-agent-sdk构建