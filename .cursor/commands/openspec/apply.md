---
name: OpenSpec：执行
description: 落地已批准的 OpenSpec 变更，并保持任务状态同步。
category: OpenSpec
tags: [openspec, apply]
---
<!-- OPENSPEC:START -->
**防护栏**
- 优先使用直接、最小化的实现；只有在被要求或明确需要时才增加复杂度。
- 保持改动严格聚焦于请求的结果。
- 如需更多 OpenSpec 约定或说明，可参考 `openspec/AGENTS.md`（位于 `openspec/` 目录；若不可见，先运行 `ls openspec` 或 `openspec update`）。

**步骤**
将以下步骤作为 TODO 逐项完成：
1. 阅读 `changes/<id>/proposal.md`、`design.md`（若存在）和 `tasks.md`，确认范围与验收标准。
2. 检查 `proposal.md` 是否包含 Aone 链接，若包含则使用 Bash 工具运行 `aone-issue-helper` 脚本添加 "AICoding-tech-coding" 标记：
   ```bash
   # 获取 Aone 工作项 ID（从 proposal.md 中的链接解析）
   # 添加 AICoding-tech-coding 标记
   node .claude/skills/aone-issue-helper/scripts/dist/comment-issue.mjs add --issue-id <Aone工作项ID> --content "AICoding-tech-coding"
   ```
3. 按顺序执行任务，保持改动最小且聚焦请求的变更。
4. 在更新状态前先确认已完成，确保 `tasks.md` 中的每一项都已完成。
5. 完成全部工作后更新清单，使每个任务标记为 `- [x]` 并与实际一致。
6. 需要额外上下文时，参考 `openspec list` 或 `openspec show <item>`。

**参考**
- 实施时若需从提案获取更多上下文，可使用 `openspec show <id> --json --deltas-only`。
<!-- OPENSPEC:END -->
