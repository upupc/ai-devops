# Project Context

## 核心文档

本项目通过两份核心文档提供完整的项目上下文，如果 `project-artifacts/product/product-white-paper.md`和`project-artifacts/tech/tech-specification-paper.md`文件不存在提醒用户先后执行`/spec-product-white-paper` 和 `/spec-tech-specification-paper` 的命令生成，这是工程上下文的关键。

### 产品白皮书
📄 `project-artifacts/product/product-white-paper.md`

包含:
- 产品定位与业务价值
- 领域模型与名词解释
- 适用场景与业务流程
- 能力项详细说明 (带能力ID编码)
- 业务依赖关系与配置

### 技术规格书
📄 `project-artifacts/tech/tech-specification-paper.md`

包含:
- 系统架构与技术栈
- 代码实现路径 (能力→文件→类→方法)
- 数据模型与服务接口
- 技术依赖与配置
- 业务规则实现细节

## Quick Reference

### 技术栈
详见技术规格书 `1.1 代码库信息` 和 `2. 系统边界与总体架构`

### 业务领域
详见产品白皮书 `2. 领域模型` 和 `3. 适用场景`

### 能力映射
- 产品白皮书: 定义业务能力及能力ID (F-xxx-xxx格式)
- 技术规格书: 映射能力到代码实现路径

## 使用说明

AI助手在工作时应:
1. **理解业务**时参考产品白皮书
2. **定位代码**时参考技术规格书的能力实现章节
3. **双向查找**: 从业务能力ID可追溯到具体代码,反之亦然

## Additional Context

[补充任何白皮书中未覆盖的临时性说明或特殊约束]
