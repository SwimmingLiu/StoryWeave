---
name: storyweave-imagegen
description: Create concise 16:9 presentations as polished full-slide images with Imagegen. Use for themed keynotes, product launches, visual narratives, or image-first PNG, HTML gallery, PDF, and PPTX delivery where each page is intentionally rasterized.
---

# Storyweave Imagegen

使用 `$imagegen` 一次生成每个完整的 16:9 页面，包括背景、配图、文字和版式。图片是最终视觉源；修改通过重新生成指定页面完成。

## 边界

- 只负责内容策划、完整页面生图、图片 QA 和图片式导出。
- 不把图片与另一层文字或排版混合成同一页面。
- 主交付物是逐页 PNG、离线 HTML 画廊和 `storyweave-output.json`；PDF/PPTX 为可选派生物。
- 页面内文字、图表和装饰不承诺对象级可编辑。
- 主题从 `assets/themes/catalog.json` 选择，按「主题架构 → 主题样式 → 视觉方案」解析；旧 `image-themes.json` 只用于 v2 项目的兼容读取。
- 优先使用 `$imagegen` 的默认内置路径；只有用户明确选择 CLI/API 时才使用 CLI 回退。不要索取、输出或写入密钥。

## 必经流程

1. 检查资料、受众、目的、语言、展示场景和预期页数。非公开事实由用户提供；公开事实记录来源、口径和日期。
2. 生成 `outline_draft.json` 和 `outline_preview.html`，包含中心含义、五段叙事、页数、逐页主张、准确文字、视觉构思、冻结的文字安全区与转场。
3. 用户确认页数和逐页文字前，不调用 `$imagegen`。`exact_text` 是封闭清单。
4. 审批后运行 `prompts`，为每页编译完整页面提示词。默认使用 `2048x1152`、`medium` 和 `16:9`。
5. 按 `imagegen-jobs.jsonl` 逐页调用 `$imagegen`。保留稳定文件名和 manifest；失败只重试失败页。
6. 检查尺寸、比例、损坏状态、主题一致性、文字准确性、主体裁切和对比度，并记录逐页 Review。
7. 所有页面通过复核后运行 `build`，生成离线画廊和标准输出 manifest，再运行 `qa`。
8. 修改时只重生成指定页面，保留未修改页面的 prompt hash、文件名和视觉锚点。

## 页面规则

- 每页只讲一个主张；标题写结论，不写空泛栏目名。
- 先确定完整页面，再生成图片；不要先做背景图再叠加另一套页面结构。
- 提示词必须要求完整成稿、清晰中文、合理断行和投影可读字号，不得添加额外标签、Logo、水印或伪造数据。
- 文字区位于主题规定的安静区域；主体、脸部、高频纹理和高亮不能穿过文字。
- 数据、引用和事实性图表必须由用户资料或公开来源支撑。
- 跨页保持相同的色彩、材质、镜头语法和视觉锚点。

## 异常与兜底

- 资料不足以支撑目标页数：给出更短页数和证据缺口，等待确认。
- `$imagegen` 失败：记录页面、prompt hash、尝试次数和错误；达到上限后标记 `failed`。
- 比例错误、文字疑似乱码、主体遮挡标题、对比不足、多余文字或主题漂移：标记 `revise`，针对单一问题重生成。
- 浏览器或导出依赖不可用：保留 PNG、manifest 和 QA 报告，明确未验证的派生格式。

## 命令

```bash
node scripts/ppt.mjs draft <project-dir> --theme systems/white-cyan-circuit --scope authoring --title "标题"
node scripts/ppt.mjs themes --json
node scripts/ppt.mjs themes --all --json
node scripts/ppt.mjs themes --style systems/white-cyan-circuit --json
node scripts/ppt.mjs approve <project-dir> --theme systems/white-cyan-circuit
node scripts/ppt.mjs prompts <project-dir>
node scripts/ppt.mjs migrate <project-dir> --to 3 --language zh-CN
# 按 imagegen-jobs.jsonl 调用 $imagegen，将结果保存到 slides/<slide-id>.png
node scripts/ppt.mjs review <project-dir> --slide s01 --pass --notes "文字和构图通过"
node scripts/ppt.mjs build <project-dir>
node scripts/ppt.mjs qa <project-dir> --json
node scripts/ppt.mjs export <project-dir> --format html|png|pdf|pptx
```

## 参考文件

- `references/workflow.md`：资料检查、Storyboard 确认、逐页生成和重试顺序。
- `references/themes.md`：图片主题及来源映射。
- `references/assets.md`：图片命名、来源、尺寸和生成记录。
- `references/qa-export.md`：图片比例、文字、构图和导出检查。
