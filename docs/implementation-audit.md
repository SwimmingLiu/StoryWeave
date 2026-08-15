# Storyweave 三 Skill 实施审计

当前实现包含两个独立生产者和一个可选展示适配器：

| Skill | 负责内容 | 图片与文字 | 编辑边界 |
|---|---|---|---|
| `storyweave-html` | 独立 HTML 页面、文字、形状、图表、表格与用户素材 | 不调用 Imagegen；HTML 源文件可编辑 | `index.html` 与逐页 HTML 是内容母版 |
| `storyweave-imagegen` | Imagegen 完整页面生成 | 每页一张 16:9 图片，文字与视觉一起生成 | 通过重新生成指定页修改；PPTX/PDF 为图片式导出 |
| `storyweave-express` | 将已完成 HTML 或图片页面包装到 Bento | 不生产内容；每页作为整页图片适配 | `.bento.html` 负责顺序、备注与展示 |

## 图像链路修复

- 默认规格统一为 `2048x1152`、`medium`、`16:9`，不再使用 `1536x1024`。
- 提示词从“无文字图片槽位”改为“完整 rasterized presentation slide”，同时传入页面目的、单页主张、主题构图、跨页锚点和 `exact_text`。
- 主题按「主题架构 → 主题样式 → 视觉方案」解析。当前目录保留 `editorial/paper-magazine` 和 `systems/white-cyan-circuit` 两套候选样式；`campaign` 与 `cinematic` 只有规划元数据。旧四主题目录只用于 v2 项目兼容读取。
- 每页必须通过尺寸、文件完整性和人工/模型视觉 Review；文字乱码、主体侵入文字区、对比不足、额外文字和主题漂移都会阻止导出。
- Imagegen 失败只重试失败页，不使用占位图；未复核页面不能标记 `pass`。

## 验证结果

- 三个 Skill 均通过 `skill-creator` quick validation。
- `storyweave-html` 独立生成 HTML；`storyweave-imagegen` 独立生成图片；两者都写出 `storyweave-output.json`。
- `storyweave-express` 只消费标准输出 manifest；生产者不依赖 Bento，也不依赖该适配器才能交付。
