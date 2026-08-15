# open-kimi-ppt-skill 学习归档

这是从 `acnlie/open-kimi-ppt-skill` 固定提交 `c32890fe0985bdf668f2722fed30f1010bdf24c9` 获取的本地学习材料，不是 `storyweave` 的运行时依赖。

## 已获取内容

- `examples/dji-pocket4/`：18 页 DJI Osmo Pocket 4 产品解读，包含 `.pptd`、逐页 `.page`、媒体和 PPTX。
- `examples/xiaomi-yu7-ppt-animation/`：8 页小米 YU7 产品介绍，包含页内入场动画示例。
- `examples/yu7-ppt/`：8 页小米 YU7 视觉版产品介绍。
- `showcase-images/`：仓库 README 中的在线编辑、PPTX 导出和多模型案例截图。
- `source/`：原始 Skill、PPTD 格式、主题目录和许可证。

## 值得吸收的思想

1. **中间格式优先**：用 YAML 的 PPTD 描述主题、页面和元素，把内容生成与 PPTX 导出解耦。每页独立文件，便于局部修改和重试。
2. **双交付物**：同时保留可编辑项目和 PPTX 成品，而不是只交付一张图片或一个不可维护的 HTML。
3. **真实可编辑元素**：文字、形状、图片、表格、图表和动画都保持对象级结构，导出后仍可在 PowerPoint/WPS 中修改。
4. **导出前视觉质检**：先导出每页图片和总览图，检查遮挡、出界、对比度、溢出、变形和排版一致性，修复后再导出 PPTX。
5. **主题是设计系统**：主题不仅是颜色，还包含字体层级、页面骨架、信息密度、组件规则、禁用项和适用场景。仓库主目录 30 套、补充目录 14 套，共 44 套主题。
6. **页面类型驱动内容**：封面、章节、指标、对比、流程、证据、总结和结尾使用不同骨架，不把所有内容都塞进同一种卡片布局。
7. **本地编辑边界明确**：编辑器只在用户明确授权的项目目录内读写，项目资源相对路径化，避免生成结果依赖隐藏的全局状态。

## 对 Storyweave 的借鉴边界

Storyweave 可以吸收 PPTD 的“逐页中间层”、主题设计系统、页面类型约束、动画元数据和导出前视觉 QA；但不直接复制 Kimi 的网页编辑器、远程通信协议或反向工程实现。

StoryWeave 当前拆分为两个独立生产者：`storyweave-imagegen` 负责整页生图，`storyweave-html` 负责完整 HTML 页面；`storyweave-express` 仅在需要时包装为 Bento。PPTD 案例用于学习页面结构、内容密度和主题配方，不作为生产模板直接复用。

## 使用提示

优先阅读 `source/SKILL.md`、`source/theme.md` 和 `source/pptd.md`，再对照三个案例的 `.pptd` 与 `pages/`。案例中的品牌、产品图片、数据和文案仅用于学习，不应未经授权复制到新的交付物中。
