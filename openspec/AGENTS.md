# OpenSpec 使用说明

面向使用 OpenSpec 进行**规格驱动开发（Spec-driven Development）**的 AI 编码助手的说明。

## TL;DR 快速检查清单

* 搜索已有工作：`openspec spec list --long`、`openspec list`（全文搜索仅使用 `rg`）
* 决定范围：新增能力 vs 修改现有能力
* 选择唯一的 `change-id`：kebab-case、动词开头（`add-`、`update-`、`remove-`、`refactor-`）
* 脚手架：`proposal.md`、`tasks.md`、`design.md`（如需要），以及受影响能力的增量 specs
* 编写增量：使用 `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`；每个需求至少包含一个 `#### Scenario:`
* 校验：`openspec validate [change-id] --strict` 并修复问题
* 请求审批：在提案获批前**不要开始实现**

## 三阶段工作流

### 阶段 1：创建变更

在以下情况需要创建提案：

* 新增功能或能力
* 破坏性变更（API、Schema）
* 架构或模式变更
* 性能优化（会改变行为）
* 安全模式更新

触发示例：

* "帮我创建一个变更提案"
* "帮我规划一个变更"
* "帮我创建一个提案"
* "我想创建一个 spec 提案"
* "我想创建一个 spec"

宽松匹配指引：

* 包含以下之一：`proposal`、`change`、`spec`
* 且包含以下之一：`create`、`plan`、`make`、`start`、`help`

**无需创建提案的情况**：

* 修复 Bug（恢复既定行为）
* 拼写、格式、注释
* 依赖升级（非破坏性）
* 配置变更
* 现有行为的测试

**工作流**

1. 查看 `openspec/project.md`、`openspec list`、`openspec list --specs` 以理解当前上下文。
2. 选择唯一的动词开头 `change-id`，并在 `openspec/changes/<id>/` 下创建 `proposal.md`、`tasks.md`、可选的 `design.md`，以及 specs 增量。
3. 使用 `## ADDED|MODIFIED|REMOVED Requirements` 编写 spec 增量，并为每个需求至少提供一个 `#### Scenario:`。
4. 运行 `openspec validate <id> --strict`，在分享提案前解决所有问题。

### 阶段 2：实现变更

将以下步骤作为 TODO 跟踪，并逐项完成。

1. **阅读 proposal.md** —— 理解要构建的内容
2. **阅读 design.md**（若存在）—— 评审技术决策
3. **阅读 tasks.md** —— 获取实现清单
4. **按顺序实现任务** —— 依次完成
5. **确认完成** —— 在更新状态前确保 `tasks.md` 中所有条目均完成
6. **更新清单** —— 完成后将所有任务标记为 `- [x]`
7. **审批门禁** —— 在提案评审通过前不要开始实现

### 阶段 3：归档变更

部署后，创建单独 PR 以：

* 将 `changes/[name]/` → `changes/archive/YYYY-MM-DD-[name]/`
* 若能力发生变化，更新 `specs/`
* 仅工具链变更可使用 `openspec archive <change-id> --skip-specs --yes`（务必显式传入 change ID）
* 运行 `openspec validate --strict` 确认归档后通过校验

## 开始任何任务之前

**上下文检查清单：**

* [ ] 阅读 `specs/[capability]/spec.md` 中的相关 specs
* [ ] 检查 `changes/` 中是否存在冲突的待处理变更
* [ ] 阅读 `openspec/project.md` 了解约定
* [ ] 运行 `openspec list` 查看活跃变更
* [ ] 运行 `openspec list --specs` 查看已有能力

**创建 Specs 之前：**

* 始终检查能力是否已存在
* 优先修改现有 specs，避免重复
* 使用 `openspec show [spec]` 查看当前状态
* 若需求不明确，在搭建脚手架前先询问 1–2 个澄清问题

### 搜索指引

* 枚举 specs：`openspec spec list --long`（脚本可用 `--json`）
* 枚举 changes：`openspec list`（或 `openspec change list --json`，已弃用但可用）
* 查看详情：

  * Spec：`openspec show <spec-id> --type spec`（筛选可用 `--json`）
  * Change：`openspec show <change-id> --json --deltas-only`
* 全文搜索（使用 ripgrep）：`rg -n "Requirement:|Scenario:" openspec/specs`

## 快速开始

### CLI 命令

```bash
# 核心命令
openspec list                  # 列出活跃变更
openspec list --specs          # 列出规格
openspec show [item]           # 显示变更或规格
openspec validate [item]       # 校验变更或规格
openspec archive <change-id> [--yes|-y]   # 部署后归档（非交互加 --yes）

# 项目管理
openspec init [path]           # 初始化 OpenSpec
openspec update [path]         # 更新说明文件

# 交互模式
openspec show                  # 交互选择
openspec validate              # 批量校验

# 调试
openspec show [change] --json --deltas-only
openspec validate [change] --strict
```

### 命令参数

* `--json` - 机器可读输出
* `--type change|spec` - 消歧义
* `--strict` - 全量校验
* `--no-interactive` - 禁用提示
* `--skip-specs` - 归档时不更新 specs
* `--yes`/`-y` - 跳过确认（非交互归档）

## 目录结构

```
openspec/
├── project.md              # 项目约定
├── specs/                  # 当前事实 —— 已构建内容
│   └── [capability]/       # 单一聚焦能力
│       ├── spec.md         # 需求与场景
│       └── design.md       # 技术模式
├── changes/                # 提案 —— 将要变更的内容
│   ├── [change-name]/
│   │   ├── proposal.md     # 原因、内容、影响
│   │   ├── tasks.md        # 实现清单
│   │   ├── design.md       # 技术决策（可选；见准则）
│   │   └── specs/          # 规格增量
│   │       └── [capability]/
│   │           └── spec.md # ADDED/MODIFIED/REMOVED
│   └── archive/            # 已完成变更
```

## 创建变更提案

### 决策树

```
新请求？
├─ 恢复既有规格行为的 Bug？ → 直接修复
├─ 拼写/格式/注释？ → 直接修复
├─ 新功能/能力？ → 创建提案
├─ 破坏性变更？ → 创建提案
├─ 架构变更？ → 创建提案
└─ 不明确？ → 创建提案（更安全）
```

### 提案结构

1. **创建目录：** `changes/[change-id]/`（kebab-case、动词开头、唯一）

2. **编写 proposal.md：**

```markdown
# Change：[变更的简要描述]

## Why
[1–2 句话描述问题或机会]

## What Changes
- [变更要点列表]
- [破坏性变更用 **BREAKING** 标注]

## Impact
- 受影响 specs：[能力列表]
- 受影响代码：[关键文件/系统]
```

3. **创建 spec 增量：** `specs/[capability]/spec.md`

```markdown
## ADDED Requirements
### Requirement: 新功能
系统 SHALL 提供……

#### Scenario: 成功场景
- **WHEN** 用户执行某操作
- **THEN** 期望结果

## MODIFIED Requirements
### Requirement: 现有功能
[完整的已修改需求]

## REMOVED Requirements
### Requirement: 旧功能
**原因**：[为何移除]
**迁移**：[如何处理]
```

若影响多个能力，在 `changes/[change-id]/specs/<capability>/spec.md` 下分别创建（每个能力一个文件）。

4. **创建 tasks.md：**

```markdown
## 1. Implementation
- [ ] 1.1 创建数据库结构
- [ ] 1.2 实现 API 接口
- [ ] 1.3 添加前端组件
- [ ] 1.4 编写测试
```

5. **在需要时创建 design.md：**
   满足以下任一条件则创建 `design.md`，否则可省略：

* 跨模块/多服务的变更或新的架构模式
* 新的外部依赖或显著的数据模型变更
* 安全、性能或迁移复杂度
* 需要在编码前明确技术决策的歧义

最小 `design.md` 模板：

```markdown
## Context
[背景、约束、相关方]

## Goals / Non-Goals
- 目标：[...]
- 非目标：[...]

## Decisions
- 决策：[做什么以及为什么]
- 备选方案：[选项与理由]

## Risks / Trade-offs
- [风险] → 缓解措施

## Migration Plan
[步骤、回滚]

## Open Questions
- [...]
```

## Spec 文件格式

### 关键：Scenario 格式

**正确**（使用 #### 标题）：

```markdown
#### Scenario: 用户登录成功
- **WHEN** 提供有效凭证
- **THEN** 返回 JWT Token
```

**错误**（不要使用项目符号或加粗）：

```markdown
- **Scenario: 用户登录**  ❌
**Scenario**: 用户登录     ❌
### Scenario: 用户登录      ❌
```

每个需求**必须**至少包含一个 Scenario。

### 需求措辞

* 规范性需求使用 SHALL/MUST（除非有意使用 should/may）

### 增量操作类型

* `## ADDED Requirements` —— 新能力
* `## MODIFIED Requirements` —— 行为变更
* `## REMOVED Requirements` —— 废弃能力
* `## RENAMED Requirements` —— 重命名

标题匹配基于 `trim(header)` —— 忽略空白。

#### 何时使用 ADDED vs MODIFIED

* ADDED：引入可独立存在的新能力/子能力。若变更是正交的（例如新增“斜杠命令配置”），优先使用 ADDED。
* MODIFIED：改变既有需求的行为、范围或验收标准。**必须粘贴完整的已更新需求内容**（标题 + 所有场景）。归档时会用你提供的内容**整体替换**旧需求；部分增量会导致细节丢失。
* RENAMED：仅名称变化时使用。若同时改变行为，使用 RENAMED（名称）+ MODIFIED（内容，使用新名称）。

常见陷阱：使用 MODIFIED 新增关注点但未包含旧文本，归档时会丢失细节。若并非显式修改既有需求，请在 ADDED 下新增需求。

正确编写 MODIFIED 的步骤：

1. 在 `openspec/specs/<capability>/spec.md` 中定位既有需求。
2. 复制完整需求块（从 `### Requirement: ...` 到其所有场景）。
3. 粘贴到 `## MODIFIED Requirements` 下并编辑以反映新行为。
4. 确保标题文本完全匹配（忽略空白），并至少保留一个 `#### Scenario:`。

RENAMED 示例：

```markdown
## RENAMED Requirements
- FROM: `### Requirement: Login`
- TO: `### Requirement: User Authentication`
```

## 故障排查

### 常见错误

**“Change must have at least one delta”**

* 检查 `changes/[name]/specs/` 是否存在 `.md` 文件
* 确认文件包含操作前缀（如 `## ADDED Requirements`）

**“Requirement must have at least one scenario”**

* 确认使用 `#### Scenario:`（4 个 #）
* 不要使用项目符号或加粗作为场景标题

**场景解析静默失败**

* 必须严格使用 `#### Scenario: Name`
* 使用 `openspec show [change] --json --deltas-only` 调试

### 校验建议

```bash
# 始终使用严格模式
openspec validate [change] --strict

# 调试增量解析
openspec show [change] --json | jq '.deltas'

# 检查特定需求
openspec show [spec] --json -r 1
```

## 顺畅路径脚本

```bash
# 1) 探索当前状态
openspec spec list --long
openspec list
# 可选全文搜索：
# rg -n "Requirement:|Scenario:" openspec/specs
# rg -n "^#|Requirement:" openspec/changes

# 2) 选择 change id 并创建脚手架
CHANGE=add-two-factor-auth
mkdir -p openspec/changes/$CHANGE/{specs/auth}
printf "## 为什么\n...\n\n## 变更内容\n- ...\n\n## 影响\n- ...\n" > openspec/changes/$CHANGE/proposal.md
printf "## 1. 实现\n- [ ] 1.1 ...\n" > openspec/changes/$CHANGE/tasks.md

# 3) 添加增量（示例）
cat > openspec/changes/$CHANGE/specs/auth/spec.md << 'EOF'
## ADDED Requirements
### Requirement: 双因素认证
用户 MUST 在登录时提供第二因子。

#### Scenario: 需要 OTP
- **WHEN** 提供有效凭证
- **THEN** 需要 OTP 挑战
EOF

# 4) 校验
openspec validate $CHANGE --strict
```

## 多能力示例

```
openspec/changes/add-2fa-notify/
├── proposal.md
├── tasks.md
└── specs/
    ├── auth/
    │   └── spec.md   # ADDED：双因素认证
    └── notifications/
        └── spec.md   # ADDED：OTP 邮件通知
```

`auth/spec.md`

```markdown
## ADDED Requirements
### Requirement: 双因素认证
...
```

`notifications/spec.md`

```markdown
## ADDED Requirements
### Requirement: OTP 邮件通知
...
```

## 最佳实践

### 简单优先

* 新增代码默认 <100 行
* 在证明不足之前使用单文件实现
* 无明确理由不引入框架
* 选择朴素、成熟的模式

### 复杂度触发器

仅在以下情况下引入复杂度：

* 性能数据表明当前方案过慢
* 明确规模需求（>1000 用户、>100MB 数据）
* 多个已验证用例需要抽象

### 清晰引用

* 代码位置使用 `file.ts:42`
* 引用 specs 使用 `specs/auth/spec.md`
* 关联变更与 PR

### 能力命名

* 动词-名词：`user-auth`、`payment-capture`
* 单一目的
* 10 分钟可理解规则
* 若描述需要 “AND”，请拆分

### Change ID 命名

* kebab-case，简短且描述性强：`add-two-factor-auth`
* 优先动词前缀：`add-`、`update-`、`remove-`、`refactor-`
* 确保唯一；若已占用，追加 `-2`、`-3`

## 工具选择指南

| 任务      | 工具   | 原因   |
| ------- | ---- | ---- |
| 按模式查找文件 | Glob | 快速匹配 |
| 搜索代码内容  | Grep | 高效正则 |
| 读取指定文件  | Read | 直接访问 |
| 探索未知范围  | Task | 多步调查 |

## 错误恢复

### 变更冲突

1. 运行 `openspec list` 查看活跃变更
2. 检查是否有重叠 specs
3. 与变更负责人协调
4. 考虑合并提案

### 校验失败

1. 使用 `--strict`
2. 查看 JSON 输出细节
3. 核对 spec 文件格式
4. 确认场景格式正确

### 上下文缺失

1. 先读 project.md
2. 查看相关 specs
3. 回顾近期归档
4. 询问澄清

## 快速参考

### 阶段标识

* `changes/` —— 已提案，未构建
* `specs/` —— 已构建并部署
* `archive/` —— 已完成变更

### 文件用途

* `proposal.md` —— 为什么与做什么
* `tasks.md` —— 实现步骤
* `design.md` —— 技术决策
* `spec.md` —— 需求与行为

### CLI 要点

```bash
openspec list              # 当前进行中？
openspec show [item]       # 查看详情
openspec validate --strict # 是否正确？
openspec archive <change-id> [--yes|-y]  # 标记完成（自动化加 --yes）
```

记住：Specs 是事实。Changes 是提案。保持同步。
