---
name: storyweave-imagegen
description: Create full-slide rasterized 16:9 presentations with Imagegen, or maintain their StoryWeave themes. Use when whole-slide images are the intended output or when updating presentation theme references.
---

# StoryWeave Imagegen

使用真实生图工具生成完整 16:9 页面，包括背景、图像、文字和版式。PNG 是视觉源，修改通过重生成受影响页面完成。HTML 画廊、PDF 和 PPTX 都以整页图片交付。

当前有 23 套候选生成主题，包含四套由已选原创架构图提炼的手绘与玻璃主题；原有 19 套主题保持兼容。18 种外部参考风格对应 14 个生成方向，参考图库保留 41 张原始内容页。主题与架构参考图分别记录和计数。

## 浅色选择与应用架构

未指定明暗时优先选浅色青蓝、银白玻璃、手绘白板或与内容匹配的明亮插画。深色蓝图、霓虹、黑金、黑板、暗室设备与夜景像素仅在用户明确选择时使用；保留原主题 ID。

大型应用先看[浅色架构视觉参考](assets/application-architecture-references/index.html)与[已选原创案例](assets/application-architecture-references/generated-cases/index.html)。案例保留实际组件、服务边界、主调用链和数据流，先确定这些关系，再安排材质与空间；不用通用齿轮、风景岛或三个大图标代替架构。普通方框连线交给 HTML/SVG，插画不得增删已批准关系。来源图只是参考，不能继承其中的数值或概括性结论。

架构图按内容安排空间，外轮廓、阴影、标签与箭头留在完整边缘内。可复用图解的标题与说明优先放在图外；整页生成按 `exact_text` 保留实际提供的标题和必要标签，避免固定标题带与自动副标题挤压图解。

## 按任务选择流程

- 制作或修改演示时使用下方 schema 4 工作流，沿用已有明确授权；要求先看预览时再等待该预览的反馈。
- 选择演讲或技术分享的视觉方向时，先看[内容页参考](references/presentation-cases.md)及[参考图库](assets/reference-library/index.html)，按观点、流程、对比、数据或架构筛选。
- 查看、优化或新增主题时读[主题维护方法](references/theme-authoring.md)，检查 recipe 与编译结果。仅维护主题不需创建演示或生图。
- 选主题时读[主题目录](references/themes.md)，使用 catalog 的完整引用；演讲参考图库与生成配方分别计数。

## 职责与状态

核心保存 schema 4 的确认内容，Imagegen 保存 schema 1 的 `plans/imagegen.json`，负责构图、任务编译、结果收集、复核状态与图片 QA。Agent 调用生图工具；CLI 不调用图片 API，不执行 OCR。运行实现位于 `runtime/core/`、`runtime/imagegen/` 和 `runtime/design-library/`。

新草稿默认使用 v4，`--schema 3` 可显式创建旧 canonical 草稿。已有 v2、v3 项目继续读取，`migrate-content` 将文字保留到 v4 草稿，并报告需要作者补齐的结构。

## 生成与复核

<!-- Theme fragments could supply generic props even when the actual page needed only an authored graph or statement. -->
开始前必读[视觉生成规则](references/visual-generation.md)。先确定对象如何解释批准主张，再选择媒介、光线和构图；没有图片职责时直接表达文字或图解。计划与任务保存 `visual_intent`，真实提示词按内容类型加入语义约束。主题中的无关道具可以省略，不能以通用隐喻填空或引入假数字。

1. 检查资料、受众、用途、语言、场景与页数。事实记录来源，资料不足时缩短范围或标记待补。
2. 编辑 `outline_draft.json`，确认叙事、逐页主张、结构化内容、来源与备注。沿用用户明确给出的制作授权；要求先看预览时先取得该预览的反馈。
3. 运行 `approve`，保存确认内容与绑定 `contentRevision` 的视觉计划。`exact_text` 由内容投影生成。
4. 运行 `prompts` 编译逐页任务，默认请求 `2048x1152`、`medium`。任务中包含准确文字、构图约束与参考用途。
5. Agent 逐页调用内置 `image_gen`，将 `tool_input.referenced_image_paths` 作为实际附件传入。保留真实工具参数、返回图片和无凭证日志。
6. 用 `record-result --receipt` 收集实际结果。检查图片文字、裁切、额外元素、对比度与主题，再用 `review --pass` 保存复核结论。
7. 全部页面复核后执行 `build`、`qa`，再导出或交给 Bento。

内置工具不可用或失败时，立即使用已安装 `image-gen-rightcodes` 的 `imagegen-cli`，沿用已授权的用户级路由。仅使用配置的 `OPENAI_SUB_*`，不索取 `OPENAI_API_KEY`，不把凭证写入项目或调用日志。

## 设计参考与实际输入

参考图库按实际内容页记录职责与覆盖缺口。原图联网加载，展开后可放大，失败时可重试；私有离线导出内嵌原图，具体命令见[参考图说明](references/presentation-cases.md)。原图缓存不进入分发包，纯 HTML 网格、卡片、表格和代码排版不作为 Imagegen 风格案例。

使用 `--library <path> --references <selection.json>` 选择案例页。生成器捕获所选图片到项目 `references/`，计划记录案例、页面、用途与哈希。完整案例库不随 Skill 安装。

选择记录与实际工具附件分别保存。Prompt 提到图名、目录内存在图片或手工填写“已附图”均不能证明工具收到图片。`reference_mode` 使用实际对应的 `attached`、`prompt-only` 或 `unsupported`，由结果收集核对调用记录。receipt 格式见[工作流](references/workflow.md)。

## 修改与失败处理

v4 换主题或参考时运行 `replan`，保留确认内容。重新编译任务后，只保留任务指纹仍一致页面的有效结果与复核；变化的页面重新生成。改动文字、来源或关系则回到草稿重新确认。

`status` 区分 `needs-images`、`needs-review` 和 `ready-for-qa`。缺图时 `status` 与 `build` 返回退出码 3，图片齐全但待复核时返回 2。`record-result` 不自动批准图片，复核绑定实际 PNG 字节；替换图片使旧复核与 QA 失效。

乱码、多余文字、主体遮挡、错误裁切或主题漂移标为 revise，重生成受影响页面。尺寸与请求不一致时保留 QA warning，并说明实际尺寸。`review --pass` 是复核记录，不能代替查看真实图像。

## 命令

从本 Skill 目录运行，先编辑草稿并取得确认，再执行审批与生成：

```bash
node scripts/ppt.mjs draft <project> --theme editorial/paper-magazine --title "标题"
node scripts/ppt.mjs themes --all --json
node scripts/ppt.mjs approve <project> --theme editorial/paper-magazine
node scripts/ppt.mjs replan <project> --theme systems/white-cyan-circuit
node scripts/ppt.mjs prompts <project>
# Agent 调用真实工具，保存日志、返回图片与 receipt。
node scripts/ppt.mjs record-result <project> --receipt <actual-result.json>
node scripts/ppt.mjs review <project> --slide s01 --pass --notes "实际图片复核结论"
node scripts/ppt.mjs status <project> --json
node scripts/ppt.mjs build <project>
node scripts/ppt.mjs qa <project> --json
node scripts/ppt.mjs export <project> --format png
```

每页分别收集和复核。旧主题迁移使用 `migrate <project> --to 3 --language zh-CN`，内容迁移使用 `migrate-content <project>`。

## 交付条件

生产者 QA 绑定当前内容、计划、参考、实际调用记录、清单与图片。导出和 Bento 会重新核对文件身份。完整生成需要真实工具记录和逐页图片复核，合同 fixture 或提示词编译通过不代表文字与视觉质量达标。缺少导出依赖时保留 PNG 与已有报告，按实际入口报告结果。

## 参考文件

| 文档 | 内容 |
| --- | --- |
| [workflow](references/workflow.md) | 确认、任务、真实调用与 receipt |
| [themes](references/themes.md) | 23 套主题、架构参考、风格归并与旧版兼容 |
| [theme-authoring](references/theme-authoring.md) | 主题维护与编译检查 |
| [assets](references/assets.md) | 图片、来源和生成记录 |
| [qa-export](references/qa-export.md) | 图片身份、视觉复核与格式边界 |
