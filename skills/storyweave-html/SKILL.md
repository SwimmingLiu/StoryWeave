---
name: storyweave-html
description: Create concise 16:9 presentations as standalone, editable HTML pages with native text, shapes, charts, tables, SVG, CSS, and user-provided images. Use for reports, defenses, training decks, process explanations, and data-heavy briefings when HTML is the desired final page format.
---

# Storyweave HTML

生成完整的 16:9 HTML 页面。文字、形状、SVG、图表、表格和用户素材都由 HTML/CSS 表达；交付物可独立打开、修改和演示。

## 边界

- 只负责内容策划、HTML 页面生成、页面 QA 和导出。
- 不调用 `$imagegen`，也不把整页截图当作 HTML 编辑源。
- 主交付物是 `index.html`、逐页 `slides/<slide-id>.html` 和 `storyweave-output.json`。
- PNG、PDF、PPTX 是从 HTML 页面渲染出的派生物，不替代 HTML 源文件。
- 从 `assets/themes/themes.json` 选择一个主题家族并保持跨页一致。

## 必经流程

1. 检查资料、受众、目的、语言、展示场景和预计页数。资料不足时缩短页数或标记缺口，不补造事实。
2. 生成 `outline_draft.json` 和 `outline_preview.html`，写明中心含义、五段叙事、逐页主张、准确文字、证据、页面角色和转场。
3. 用户确认页数与逐页主张后运行 `approve --theme <id>`；未确认前不构建最终页面。
4. 使用 HTML/CSS/SVG 的原生能力表达信息。流程、比较、数字和引用使用对应结构，不退化为长段文字。
5. 运行 `build`，同时生成演示入口、逐页独立 HTML 和标准输出 manifest。不要依赖某个后续播放器才能打开页面。
6. 先做结构与几何检查，再在浏览器中逐页截图 Review。阻断项未解决时不导出。
7. 修改时保留稳定的 slide ID；只调整受影响页面，不让视觉结果反向改变已确认文案。

## 页面规则

- 一页只表达一个主张；标题写结论，不写空泛栏目名。
- `exact_text` 是封闭列表。页面不增加标签、数字、Logo、水印或模型自造说明。
- 页面必须在固定 16:9 画布内完整呈现；资料过多时拆页或放入 notes，不缩小字号硬塞。
- 用户图片只用于明确的图片槽位，不能替代数据证据。公开素材记录来源、许可证和检索日期。
- 每页独立 HTML 必须包含 `data-storyweave-slide` 和稳定的 `data-slide-id`，并能在没有演示入口的情况下单独打开。

## 异常与兜底

- 上传资料缺失或不可读：记录缺失项与受影响页面，继续处理可读材料。
- 文本溢出、元素越界、重叠、页面空白、资源断裂或主题漂移：标记 `revise`，修复后再交付。
- 浏览器不可用：允许完成静态检查，但把视觉 Review 标为 `degraded`，不能声称通过。
- 导出依赖缺失：保留 HTML 与 manifest，只报告对应派生格式不可用。

## 命令

```bash
node scripts/ppt.mjs draft <project-dir> --title "标题"
node scripts/ppt.mjs themes --json
node scripts/ppt.mjs approve <project-dir> --theme editorial
node scripts/ppt.mjs build <project-dir>
node scripts/ppt.mjs qa <project-dir> --json
node scripts/ppt.mjs export <project-dir> --format html|png|pdf|pptx
```

## 参考文件

- `references/workflow.md`：Storyboard 确认、HTML 构建和 Review 顺序。
- `references/architecture.md`：页面文件与标准输出 manifest 的边界。
- `references/themes.md`：HTML 主题家族。
- `references/assets.md`：图片、字体和 data URI 约束。
- `references/qa-export.md`：结构、浏览器检查与导出规则。

