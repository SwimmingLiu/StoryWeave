---
name: storyweave-imagegen
description: Create full-slide rasterized 16:9 presentations with Imagegen, or maintain their Storyweave themes. Use when whole-slide images are the intended output; not for object-editable slides or ordinary image assets.
---

# Storyweave Imagegen

用 `$imagegen` 生成包含背景、配图、文字和版式的完整 16:9 页面。图片是最终视觉源；修改回到逐页文字与提示词后重生成。主交付物为 PNG、离线 HTML 画廊和 `storyweave-output.json`，PDF/PPTX 按需导出，页面对象不可单独编辑。

## 按任务选择流程

- 制作或修改演示：按下方流程执行；已有项目只处理受影响页面。
- 查看、优化或新增主题：读 [主题维护方法](references/theme-authoring.md)，检查相关 recipe 与编译结果。仅维护主题时无需创建 Storyboard、审批或生图。
- 选主题时读 [主题目录](references/themes.md)，使用 `assets/themes/catalog.json` 的完整引用。只加载所选架构、样式和本页方案的设计说明；v2 兼容读取保留在旧目录。

## 制作演示

1. 用已有资料确定受众、目的、语言、页数和逐页主张，生成 `outline_draft.json` 与 `outline_preview.html`。`exact_text` 列出全部可见文字；证据支持事实，`layout_plan` 明确文字安全区、视觉区、层级和密度。
2. 根据用户已给出的授权定稿。已明确要求直接制作、采用所给文字或自行决定的，继续执行；仅要求预览，或缺失的信息会改变事实、页数等明确约束时，展示具体草稿并询问缺口。`approve` 记录可编译状态，不能替代用户授权。详见 [工作流](references/workflow.md)。
3. 运行 `prompts`，按 `imagegen-jobs.jsonl` 生成整页图。默认目标为 `2048x1152`、`medium`、16:9；实际参数以当前工具支持为准。内置 `image_gen` 优先，失败或不可用时按当前用户持久路由调用 `image-gen-rightcodes` 的 `imagegen-cli`，沿用已有授权；不索取或输出密钥。
4. 检查图片完整性、比例、实际文字、可读性、事实图形、裁切和主题一致性，记录逐页 review。通过后运行 `build`、`qa`，交付画廊和 manifest；导出检查见 [QA 与导出](references/qa-export.md)。

## 页面契约

- `exact_text` 是唯一可见文字来源，包括数字、图注和署名；数据关系由资料支撑，不从主题示例补充事实。
- 图片文案默认只保留主标题与必要标签、数值和单位；不自动添加说明性副标题、眉题或页脚小字。生成来源和验证说明记录在图片外；已提供的必要事实限定不得悄悄删除，采用用户授权的精简文案后再编译。
- 文字使用项目语言，保持可读断行与对比；主题元素避开文字安全区。
- 架构负责空间组织，样式负责颜色、材质与锚点，方案负责单页构图与标题处理。同一 deck 保持样式连续，逐页节奏随内容变化。
- 保留稳定文件名、prompt hash 和生成记录。失败只重试受影响页面，默认重试上限为 2；仍失败则报告具体问题并保留可用产物。记录格式见 [图片资产](references/assets.md)。
- 资料不足时先完成有依据的内容；需要改变用户明确约束时再询问。派生格式无法验证时保留 PNG、manifest 和 QA 记录，并说明限制。

## 命令

在 Skill 目录运行；候选主题制作使用 `--scope authoring`，状态含义见主题目录。

```bash
node scripts/ppt.mjs themes --json
node scripts/ppt.mjs themes --all --json
node scripts/ppt.mjs themes --style systems/white-cyan-circuit --json
node scripts/ppt.mjs draft <project-dir> --theme systems/white-cyan-circuit --scope authoring --title "标题"
node scripts/ppt.mjs approve <project-dir> --theme systems/white-cyan-circuit --scope authoring
node scripts/ppt.mjs prompts <project-dir>
node scripts/ppt.mjs review <project-dir> --slide s01 --pass --notes "文字和构图通过"
node scripts/ppt.mjs build <project-dir>
node scripts/ppt.mjs qa <project-dir> --json
node scripts/ppt.mjs export <project-dir> --format html|png|pdf|pptx
```
