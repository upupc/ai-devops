# 文件浏览器规格

## 概述

文件浏览器展示工作区的文件结构，提供文件操作功能，并与编辑器联动。

## ADDED Requirements

### Requirement: REQ-FB-001 文件树展示

系统 MUST 以树形结构展示工作区的文件和目录。

#### Scenario: 显示文件树

**Given** 用户切换到一个会话
**When** 工作区加载完成
**Then** 文件浏览器显示工作区的文件树结构
**And** 目录显示为可展开的节点
**And** 文件显示文件类型图标

#### Scenario: 展开折叠目录

**Given** 文件树中存在目录
**When** 用户点击目录节点
**Then** 目录展开显示子内容或已展开的目录折叠

#### Scenario: 空工作区提示

**Given** 工作区目录为空
**When** 文件浏览器加载
**Then** 显示"工作区为空"提示
**And** 提供创建文件的快捷入口

### Requirement: REQ-FB-002 文件选择与联动

文件浏览器 MUST 与编辑器联动。

#### Scenario: 单击选择文件

**Given** 文件浏览器显示文件列表
**When** 用户单击一个文件
**Then** 文件被选中高亮
**And** 文件不自动在编辑器中打开

#### Scenario: 双击打开文件

**Given** 文件浏览器显示文件列表
**When** 用户双击一个文件
**Then** 文件在编辑器中打开
**And** 编辑器切换到该文件标签页

### Requirement: REQ-FB-003 文件操作

系统 MUST 支持基本的文件操作。

#### Scenario: 创建新文件

**Given** 用户在文件浏览器中
**When** 用户右键点击目录并选择"新建文件"
**Then** 在该目录下创建新文件
**And** 文件名进入编辑状态

#### Scenario: 创建新目录

**Given** 用户在文件浏览器中
**When** 用户右键点击目录并选择"新建文件夹"
**Then** 在该目录下创建新文件夹
**And** 文件夹名进入编辑状态

#### Scenario: 重命名文件

**Given** 用户选中一个文件或目录
**When** 用户右键选择"重命名"或按 F2
**Then** 文件名进入编辑状态
**And** 用户输入新名称后按 Enter 确认

#### Scenario: 删除文件

**Given** 用户选中一个文件或目录
**When** 用户右键选择"删除"或按 Delete
**Then** 系统显示确认对话框
**And** 确认后删除文件或目录

### Requirement: REQ-FB-004 右键菜单

文件浏览器 MUST 提供右键上下文菜单。

#### Scenario: 文件右键菜单

**Given** 用户在文件上右键点击
**When** 右键菜单显示
**Then** 菜单包含打开、重命名、删除、复制路径选项

#### Scenario: 目录右键菜单

**Given** 用户在目录上右键点击
**When** 右键菜单显示
**Then** 菜单包含新建文件、新建文件夹、重命名、删除、复制路径选项

#### Scenario: 空白区域右键菜单

**Given** 用户在文件浏览器空白区域右键点击
**When** 右键菜单显示
**Then** 菜单包含新建文件、新建文件夹、刷新选项

### Requirement: REQ-FB-005 文件状态同步

文件浏览器 MUST 与实际文件系统保持同步。

#### Scenario: Agent创建文件后同步

**Given** Agent 通过工具创建了新文件
**When** 工具执行完成
**Then** 文件浏览器自动刷新
**And** 新文件显示在文件树中

#### Scenario: Agent修改文件后同步

**Given** Agent 通过工具修改了文件
**And** 该文件在编辑器中打开
**When** 工具执行完成
**Then** 编辑器显示文件已被外部修改
**And** 提供重新加载选项

#### Scenario: Agent删除文件后同步

**Given** Agent 通过工具删除了文件
**And** 该文件在编辑器中打开
**When** 工具执行完成
**Then** 文件从文件树中移除
**And** 编辑器关闭该文件标签页

### Requirement: REQ-FB-006 文件类型识别

系统 MUST 根据文件扩展名显示对应图标。

#### Scenario: 显示文件类型图标

**Given** 文件树中有不同类型的文件
**When** 文件树渲染完成
**Then** TypeScript 文件显示 TypeScript 图标
**And** JavaScript 文件显示 JavaScript 图标
**And** Markdown 文件显示 Markdown 图标
**And** JSON 文件显示 JSON 图标
**And** 其他文件显示通用文件图标

## 交叉引用

- 参见 [workspace/spec.md](../workspace/spec.md) - 文件打开到编辑器
- 参见 [chat/spec.md](../chat/spec.md) - Agent 工具调用触发文件变更
