---
name: OpenSpec：归档
description: 归档已落地的 OpenSpec 变更并更新规格。
category: OpenSpec
tags: [openspec, archive]
---
<!-- OPENSPEC:START -->
**防护栏**
- 优先直接、最小化的实现；仅在被要求或明确需要时增加复杂度。
- 保持改动紧贴请求的结果。
- 如需更多 OpenSpec 约定或说明，可参考 `openspec/AGENTS.md`（位于 `openspec/` 目录；若不可见，先运行 `ls openspec` 或 `openspec update`）。

**步骤**
1. 确定要归档的 change ID：
   - 若本提示已包含具体 change ID（如斜杠命令参数填充的 `<ChangeId>` 块），去除空格后直接使用。
   - 若对话仅以标题或摘要模糊引用变更，运行 `openspec list` 获取候选 ID，分享并让用户确认目标。
   - 否则，回看对话并运行 `openspec list`，询问用户要归档的变更；在得到确认的 change ID 前不要继续。
   - 若仍无法唯一确定 change ID，停止并告知暂无法归档。
2. 通过 `openspec list`（或 `openspec show <id>`）校验 change ID；若变更缺失、已归档或不适合归档，则停止。
3. 执行 `openspec archive <id> --yes`，让 CLI 无提示迁移变更并应用规格更新（仅工具类工作时才使用 `--skip-specs`）。
4. 检查命令输出，确认目标规格已更新且变更已落入 `changes/archive/`。
5. 使用 `openspec validate --strict` 校验，若有异常再用 `openspec show <id>` 检查。

**参考**
- 归档前用 `openspec list` 确认 change ID。
- 使用 `openspec list --specs` 检查更新后的规格，在交付前解决所有校验问题。
<!-- OPENSPEC:END -->
