---
allowed-tools: Bash(mkdir *), Bash(cd *), Bash(git init), Bash(git remote:*), Bash(git pull:*)
description: 初始化一个新的工作空间，包括目录创建、Git 仓库克隆和基础配置设置。此命令用于快速创建标准化的工作环境。
---
# init-workspace 命令

## 功能说明

初始化一个新的工作空间，包括目录创建、Git 仓库克隆和基础配置设置。此命令用于快速创建标准化的工作环境。

## 约束条件
禁止删除任何文件和目录

## 命令格式

```bash
/init-workspace
```

## 参数说明
从上下文中获取参数
- path: 工作空间路径
- gitRepo: Git 仓库 URL
- username: Git 用户名
- gitToken: Git 令牌


## 使用示例

```bash
# 初始化工作空间
/init-workspace
```

## 执行步骤

### 1. 输入参数验证

验证所有必需参数是否提供，检查路径格式和仓库 URL 格式的有效性。
- Git 仓库 URL 必须包含用户名和令牌数据
- 如果Git仓库URL不符合要求，提示用户重新输入Git仓库URL

### 2. 创建工作空间目录
禁止删除任何文件和目录
```bash
# 创建目录（如果不存在）
mkdir -p <path>
cd <path>
```

### 3. Git 仓库初始化
使用username、gitToken和gitRepo构造含有用户名和令牌信息的Git仓库URL
```bash
# 创建目录并初始化 Git
cd <path>
git init

git remote set-url origin <含验证信息的Git仓库URL>

# 拉取最新代码
git pull origin master
```

### 4. 初始化spec-kit

```bash
# 创建目录并初始化 Git
cd <path>
npm i -g git+http://<username>:<gitToken>@gitlab.alibaba-inc.com/alibaba.com-ai-coding/claude-marketplace.git
spec-kit init --no-upgrade
```

### 4. 环境配置

- 设置工作空间权限
- 初始化配置文件
- 创建必要的子目录结构

## 错误处理

### 常见错误及解决方案

1. **路径已存在**
   - 错误：工作空间路径已存在且非空
   - 解决：提供新的路径或删除现有目录

2. **Git 认证失败**
   - 错误：用户名或令牌无效
   - 解决：检查 Git 仓库 URL 中的认证信息

3. **网络连接失败**
   - 错误：无法访问 Git 仓库
   - 解决：检查网络连接和仓库地址

4. **权限不足**
   - 错误：无法创建目录或克隆仓库
   - 解决：检查文件系统权限

## 返回值

### 成功响应

```json
{
  "status": "success",
  "message": "工作空间初始化成功",
  "workspace": {
    "path": "/Users/workspace/my-project",
    "gitRepo": "http://gitlab.alibaba-inc.com/team/my-project.git",
    "branch": "master",
    "username": "user123"
  }
}
```

### 错误响应

```json
{
  "status": "error",
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

## 注意事项

- 确保提供的路径具有写入权限
- Git 仓库 URL 中的令牌应具有足够的权限
- 建议在空目录下初始化工作空间
- 初始化过程可能需要几分钟时间（取决于仓库大小）


