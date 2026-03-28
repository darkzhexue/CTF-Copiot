---
name: "Thesis Chapter Draft"
description: "Use when generating graduation thesis chapter drafts for this project, including system design, architecture description, intelligent agent workflow, RAG process, technical route, implementation details, innovation points, and limitations. Trigger phrases: 论文正文, 章节草稿, 系统设计, 技术路线, RAG流程, 智能体设计."
argument-hint: "描述你要写的章节，例如：写一节毕业论文正文，介绍本项目的智能体设计、前后端架构与RAG知识库实现。"
agent: "Thesis Project Explainer"
---
请基于当前项目的真实实现，为用户生成适合毕业论文正文的章节草稿。

要求：
- 只基于仓库中已经实现的内容写作，不虚构模块、实验或部署方案。
- 使用正式、学术化的中文表达，适合直接作为毕业论文初稿。
- 说明“为什么这样设计”，不要只罗列功能点。
- 当内容涉及系统设计时，优先从整体架构、模块职责、交互流程、关键实现细节逐层展开。
- 当内容涉及 RAG 时，明确说明导入、索引、检索、引用回答的完整链路。
- 当内容涉及智能体时，说明消息流、交互模式、工具能力边界与工程化取舍。
- 必要时区分：已实现功能、可配置项、局限性、后续优化方向。

输出格式：
1. 章节标题
2. 正文内容（分自然段，必要时可带二级小节）
3. 结尾总结段

如果用户没有说明章节类型，默认按“毕业论文正文”来写。
