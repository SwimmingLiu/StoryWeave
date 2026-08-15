# Storyweave Imagegen 示例

示例使用同一份“AI 原生知识工作流” Storyboard，展示主题样式和视觉方案如何生成完整页面。仓库只保存可复现的草稿和生成任务，不把未经当前 Imagegen 会话复核的图片伪装成完成品；旧的四主题目录仍作为 v2 兼容资料保留。

生成一个本地示例：

```bash
node scripts/ppt.mjs draft /tmp/storyweave-imagegen-demo --theme systems/white-cyan-circuit --scope authoring --title "AI 原生知识工作流"
node scripts/ppt.mjs approve /tmp/storyweave-imagegen-demo --theme systems/white-cyan-circuit --scope authoring
node scripts/ppt.mjs prompts /tmp/storyweave-imagegen-demo
```

然后按 `imagegen-jobs.jsonl` 逐页调用 `$imagegen`，把结果写到 `slides/`，查看图片后用 `review` 标记通过，再运行 `build` 和 `qa`。
