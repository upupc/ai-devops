---
name: OpenSpec：提案
description: 搭建新的 OpenSpec 变更并严格校验。
category: OpenSpec
tags: [openspec, change]
---
<!-- OPENSPEC:START -->
**防护栏**
- 优先直接、最小化的实现；仅在被要求或明确需要时增加复杂度。
- 保持改动紧贴请求的结果。
- 如需更多 OpenSpec 约定或说明，可参考 `openspec/AGENTS.md`（位于 `openspec/` 目录；若不可见，先运行 `ls openspec` 或 `openspec update`）。
- 识别任何模糊或不明确的细节，在改动文件前先提出澄清问题。
- 提案阶段不要编写代码，只创建设计文档（proposal.md、tasks.md、design.md 及规格增量）；实现工作放在批准后的 apply 阶段完成。

**步骤**
1. 审阅 `openspec/project.md`，运行 `openspec list` 与 `openspec list --specs`，并查看相关代码或文档（例如通过 `rg`/`ls`），以当前行为为基线记录需澄清的空缺。
2. 获取 Aone 需求（强烈建议）：
   a) 若用户未提供 Aone 链接，**主动询问**并说明需要用于打标和过程观测。需求链接示例：
      - https://project.aone.alibaba-inc.com/v2/project/2089294/req/76636267
      - https://aione.alibaba-inc.com/v2/project/2124735/sprint/513273#activeTab=Workitem&openWorkitemIdentifier=76702813
      其中 `76636267` 或 `76702813` 为工作项 ID，需从链接中提取。
   b) **将 Aone 链接记录到相关文档中**，并在获取链接后解析工作项 ID，使用 Bash 工具运行 `aone-issue-helper` 脚本获取需求详情：
      ```bash
      node .claude/skills/aone-issue-helper/scripts/dist/comment-issue.mjs save --issue-id <Aone工作项ID> --dir project-artifacts/docs/yuque-docs
      ```
   c) 立即读取获取到的 Aone 需求文档详情，分析需求内容中是否包含语雀/钉钉文档链接（域名 `aliyuque.antfin.com` / `yuque.alibaba-inc.com` / `alidocs.dingtalk.com` 等）。
   d) 若包含语雀/钉钉文档链接，使用 Bash 工具运行 `yuque-doc-fetcher` 脚本拉取文档：
      ```bash
      node .claude/skills/yuque-doc-fetcher/scripts/dist/fetch-doc.mjs --url "<文档URL>" --output project-artifacts/docs/yuque-docs --filename "<文件名>"
      ```
      多份文档依次调用直至全部落地为 Markdown。`--filename` 参数可选，默认使用文档标题。
   e) 拿到 Aone Issue ID 后，在提案关键节点使用 Bash 工具运行 `aone-issue-helper` 脚本添加评论（避免重复）：
      ```bash
      # 获取评论（确认是否已评论）
      node .claude/skills/aone-issue-helper/scripts/dist/comment-issue.mjs get --issue-id <AoneID>
      # 添加评论
      node .claude/skills/aone-issue-helper/scripts/dist/comment-issue.mjs add --issue-id <AoneID> --content "AICoding-PRD"
      ```
   f) 向用户确认需求背景、目标、核心描述的准确性。
   g) 若用户确实无法提供 Aone 链接，基于直接描述继续，但需在 `proposal.md` 中说明缺少追踪链接。
3. 选定唯一且以动词开头的 `change-id`，在 `openspec/changes/<id>/` 下生成 `proposal.md`、`tasks.md`，必要时生成 `design.md`。
4. 将变更映射为具体能力或需求，将多范围工作拆分为关系清晰、顺序明确的规格增量。
5. 若方案跨多系统、引入新模式或需先讨论取舍，在 `design.md` 中记录架构思考与权衡。
6. 在 `changes/<id>/specs/<capability>/spec.md` 中撰写规格增量（每个能力一个目录），使用 `## ADDED|MODIFIED|REMOVED Requirements`，每条需求至少包含一个 `#### Scenario:`，相关时进行能力交叉引用。
7. 将 `tasks.md` 写成有序的小型、可验证工作项列表，包含验证（测试、工具），并突出依赖或可并行项。
8. 使用 `openspec validate <id> --strict` 校验，解决所有问题后再分享提案。

**参考**
- 校验失败时，可用 `openspec show <id> --json --deltas-only` 或 `openspec show <spec> --type spec` 查看细节。
- 在撰写新需求前，用 `rg -n "Requirement:|Scenario:" openspec/specs` 检索已有需求。
- 通过 `rg <keyword>`、`ls` 或直接读文件了解代码现状，确保提案贴合现有实现。
<!-- OPENSPEC:END -->
