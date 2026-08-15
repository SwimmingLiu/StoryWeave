# 主题架构视觉冒烟测试

本目录在运行代码重构前比较两套候选主题样式。测试复用 `storyweave-imagegen-demo` 中已经批准的三页内容，并保持两套主题的 `exact_text` 一致。

测试包含封面、观点和流程三种页面职责。流程页增加一组标题层级变体，用来验证页面能否依靠图形和内容关系传达主张，而不是固定使用超大标题。

| 页面职责 | `editorial/paper-magazine` | `systems/white-cyan-circuit` |
|---|---|---|
| `cover` | `magazine-cover` | `keynote-cover` |
| `statement` | `editorial-statement` | `signal-quote` |
| `process / headline-led` | `editorial-diagram` | `circuit-flow` |
| `process / visual-led` | `editorial-diagram` | `circuit-flow` |

`headline-led` 保留明显的页面标题，作为基线；`visual-led` 将标题降为辅助说明，让阶段名称、路径和空间关系承担主要叙事。两种处理都必须完整表达页面主张。

生成图只用于主题方案评估。两套候选通过多页 QA 前仍保持 `candidate`，不会修改当前活动主题目录。

## 查看结果

- [两套主题对比](comparison_gallery.html)
- [Storyboard](outline_preview.html)
- [评审记录](comparison_review.md)
- [Editorial 播放画廊](editorial-paper-magazine/index.html)
- [Systems 播放画廊](systems-white-cyan-circuit/index.html)

两套主题共生成 8 张 PNG。内置 Imagegen 返回的实际尺寸为 `1672x941`，比例检查通过；与默认 `2048x1152` 的差异记录为 QA 警告。
