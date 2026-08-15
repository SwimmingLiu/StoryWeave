# Storyweave Imagegen 示例

这是同一份“AI 原生知识工作流” Storyboard 的 `launch-tech` 图片主题示例。仓库只保留草稿、审批结果、完整页面提示词和 manifest；未在当前 Imagegen 会话中生成并复核的 PNG 不会伪装成完成品。

生成后将每页图片保存为 `slides/<slide-id>.png`，查看实际图片并运行：

```bash
node scripts/ppt.mjs review <project-dir> --slide s01 --pass --notes "通过"
node scripts/ppt.mjs build <project-dir>
node scripts/ppt.mjs qa <project-dir> --json
```
