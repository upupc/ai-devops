# agent-tools Specification

## Purpose
TBD - created by archiving change build-agent-app. Update Purpose after archive.
## Requirements
### Requirement: REQ-TOOL-001 文件读取工具

Agent MUST 能够读取工作区中的文件内容。

#### Scenario: 读取存在的文件

**Given** 工作区中存在文件 `src/index.ts`
**When** Agent 调用 `read_file` 工具
**Then** 工具返回文件的完整内容
**And** 返回格式为纯文本字符串

#### Scenario: 读取不存在的文件

**Given** 工作区中不存在文件 `src/missing.ts`
**When** Agent 调用 `read_file` 工具
**Then** 工具返回错误信息表示文件不存在

#### Scenario: 读取目录外的文件

**Given** Agent 尝试读取工作区外的文件
**When** Agent 调用 `read_file` 工具访问工作区外路径
**Then** 工具返回错误信息表示访问被拒绝
**And** 不执行实际文件读取操作

### Requirement: REQ-TOOL-002 文件写入工具

Agent MUST 能够创建或修改工作区中的文件。

#### Scenario: 创建新文件

**Given** 工作区中不存在目标文件
**When** Agent 调用 `write_file` 工具
**Then** 在工作区创建新文件
**And** 文件内容为传入的内容
**And** 文件浏览器自动刷新显示新文件

#### Scenario: 修改已有文件

**Given** 工作区中存在目标文件
**When** Agent 调用 `write_file` 工具
**Then** 文件内容被更新为新内容
**And** 如果文件在编辑器中打开则提示用户文件已被修改

#### Scenario: 自动创建父目录

**Given** 工作区中不存在目标文件的父目录
**When** Agent 调用 `write_file` 工具
**Then** 自动创建父目录
**And** 创建目标文件

#### Scenario: 写入目录外的文件

**Given** Agent 尝试写入工作区外的文件
**When** Agent 调用 `write_file` 工具访问工作区外路径
**Then** 工具返回错误信息表示访问被拒绝
**And** 不执行实际文件写入操作

### Requirement: REQ-TOOL-003 命令执行工具

Agent MUST 能够在工作区中执行终端命令。

#### Scenario: 执行允许的命令

**Given** 用户询问工作区中有哪些文件
**When** Agent 调用 `execute_command` 工具执行 ls 命令
**Then** 在工作区目录中执行命令
**And** 返回命令输出结果

#### Scenario: 执行npm命令

**Given** 用户请求安装依赖
**When** Agent 调用 `execute_command` 工具执行 npm install
**Then** 在工作区目录中执行 npm install
**And** 返回安装日志

#### Scenario: 执行禁止的命令

**Given** Agent 尝试执行危险命令
**When** Agent 调用 `execute_command` 工具执行危险命令
**Then** 工具返回错误信息表示命令被拒绝
**And** 不执行实际命令

#### Scenario: 命令执行超时

**Given** Agent 执行一个长时间运行的命令
**When** 命令执行时间超过超时限制
**Then** 命令被终止
**And** 返回超时错误信息

### Requirement: REQ-TOOL-004 工具调用UI反馈

系统 MUST 向用户展示工具调用的过程和结果。

#### Scenario: 显示工具调用开始

**Given** Agent 决定调用工具
**When** 工具调用开始
**Then** 聊天界面显示正在执行的工具名称
**And** 显示工具调用参数

#### Scenario: 显示工具执行结果

**Given** 工具执行完成
**When** 工具返回结果
**Then** 聊天界面显示工具执行结果
**And** 成功显示绿色图标失败显示红色图标

#### Scenario: 显示工具调用链

**Given** Agent 连续调用多个工具
**When** 所有工具执行完成
**Then** 按调用顺序展示所有工具及其结果
**And** 最后显示 Agent 的总结响应

### Requirement: REQ-TOOL-005 安全约束

所有工具 MUST 遵守安全约束。

#### Scenario: 路径校验

**Given** 任何文件操作工具被调用
**When** 工具接收到路径参数
**Then** 验证路径是否在工作区目录内
**And** 验证路径不包含目录遍历字符

#### Scenario: 命令白名单

**Given** 命令执行工具被调用
**When** 工具接收到命令参数
**Then** 检查命令是否在白名单中
**And** 拒绝不在白名单中的命令

#### Scenario: 敏感文件保护

**Given** 文件操作工具被调用
**When** 目标文件为敏感文件如 env 或 credentials
**Then** 返回错误信息表示无法操作敏感文件

