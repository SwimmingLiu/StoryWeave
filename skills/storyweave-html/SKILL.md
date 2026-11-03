---
name: storyweave-html
description: Create concise 16:9 presentations as standalone, editable HTML pages with native text, shapes, charts, tables, SVG, CSS, and user-provided images. Use for reports, defenses, training decks, process explanations, and data-heavy briefings when HTML is the desired final page format.
---

# StoryWeave HTML

将确认内容生成可独立打开的 16:9 HTML 页面。文字、形状、SVG、表格和用户素材保留原生编辑能力，PNG、PDF、PPTX 是派生输出。

## 职责与状态

核心保存 schema 4 的确认内容与修订，HTML 保存 schema 1 的 `plans/html.json`，负责版式、字体、素材、构建和浏览器 QA。Bento 包装由展示适配器执行。运行实现位于 `runtime/core/`、`runtime/html/` 和 `runtime/design-library/`。

带 `--theme-ref` 的新草稿默认使用 schema 4。无主题参数的旧 `draft` 路径继续创建 v2；`--schema 3` 显式创建旧 canonical 草稿。v2、v3 保持原渲染语义，使用 `migrate-content` 显式迁入 v4。

## 生成页面

<!-- The previous workflow checked geometry after build but had no required semantic design pass before layout. -->
开始前必读[视觉生成规则](references/visual-generation.md)，明确主张、阅读顺序、图片用途和最小修改。保留已有清楚的关系，允许不同主题共用构图。HTML 计划的 `visual_policy` 与 `visual_intent` 保存内容职责，不能把字段存在当作视觉已通过。

1. 检查资料、受众、用途、语言、阅读模式和页数。记录缺口，不补造事实。
2. 创建并编辑 `outline_draft.json`，打开 `outline_preview.html` 核对叙事、主张、来源、结构化内容与备注。
3. 取得用户确认后执行 `approve`，写入 `deck_spec.json` 与 `plans/html.json`。
4. 用 `content.type` 表达比较、流程、指标、关系或观点，由 `layout_id` 选择实际 DOM 与 SVG 骨架。主题控制配色与字体，计划保存节奏和素材槽位。
5. 运行 `build`，生成 `index.html`、独立 `slides/<slide-id>.html` 和 `storyweave-output.json`。
6. 运行 `qa`，检查独立页与画廊逐页的桌面、移动呈现，再查看截图与整套缩略图。
7. 修复阻断问题后导出，或把当前已通过 QA 的产物交给 Bento。

`approve` 从结构化字段生成 `exact_text`，不维护第二份可编辑文字。比较明确列与行，流程和关系图明确节点与边，指标包含值、单位、标签与来源。布局不得补造反馈边、数字、标签、Logo 或说明。

## 使用设计参考

案例库通过本地标签索引检索完整案例。先确定整套风格，再选少量相关页面，使用 `--library <path> --references <selection.json>` 传给 `approve` 或 `replan`。选中页面被捕获到项目 `references/` 并保存哈希。

HTML 参考的 `application` 指明实际决定，支持 `layout_id`、`tone`、`accent`、`heading_font` 和 `body_font`。计划写入 `reference_applications`。仅选中参考页不表示已应用，案例事实也不进入本项目内容。完整案例库不随 Skill 安装。

## 修改与页面规则

v4 只改主题或参考时运行 `replan`，确认稿保持原字节，不重复审批。随后重新构建和 QA。修改文字、来源或信息关系时，编辑草稿并重新取得确认。v3 的 `replan` 仍遵循旧重新审批流程。

页面使用固定 `1280×720` 舞台，竖屏整体等比缩放。容量不足时拆页或调整内容，不静默截断或缩小文字。素材槽位明确 `asset_id`、`fit`、裁切、焦点与替代文本，图注来自确认内容。

每个独立页面包含 `data-storyweave-slide` 与稳定 `data-slide-id`。手工修改 HTML 后旧 QA 和截图缓存失效；要在下次构建保留排版改动，应将决定写回计划生成逻辑或版式实现。

## 检查与导出

浏览器 QA 核对准确文字、额外可见文字、关系边、舞台、资源、主题与参考哈希。要求 `visual_review: browser`，blocking 与 degraded 为零。浏览器不可用时只记录 degraded，不声称完成视觉验收。

`qa_report.json` 的 `artifact_binding` 绑定确认稿、计划、素材、参考、清单与实际页面。导出和 Bento 交接重新核对字节，旧报告不能批准改动后的页面。自动几何检查不代替主张、字体、素材和全套节奏的人工判断。

<!-- Local browser restrictions left rebuilt samples unreviewed; repository CI now captures and gates their real pixels. -->
仓库开发使用 GitHub Actions 的 `Verification` 评测。它生成杂志、瑞士风各 8 页，完成双视口 QA，再与逐页看图确认的基线比较。画面、内容、视觉策略或环境变化时为 `needs-review`，检查失败并保留对照和评审模板；逐页与整套复核后显式更新基线，再运行新提交的 CI。固定样张相同截图继承已有判断，不代表任意新项目已通过视觉验收。独立安装包仍需对实际项目运行 QA 和看图复核，具体边界见 [qa-export](references/qa-export.md)。

HTML 保留原生编辑能力。当前图片式 PPTX 和 Bento 每页一张图片；缺少某个导出依赖时保留 HTML，报告该格式尚未完成。

## 命令

从本 Skill 目录运行：

```bash
node scripts/ppt.mjs draft <project> --title "标题" --theme-ref systems/ink-blue-grid
node scripts/ppt.mjs themes --json
node scripts/ppt.mjs preview <project> --count 3 --json
node scripts/ppt.mjs approve <project> --theme-ref systems/ink-blue-grid
node scripts/ppt.mjs replan <project> --theme-ref editorial/paper-magazine
node scripts/ppt.mjs build <project>
node scripts/ppt.mjs qa <project> --json
node scripts/ppt.mjs export <project> --format html
```

旧项目迁移分别使用主题迁移与内容迁移：

```bash
node scripts/ppt.mjs migrate <project> --theme-ref systems/white-cyan-circuit
node scripts/ppt.mjs migrate-content <project> --theme-ref systems/white-cyan-circuit
```

## 参考文件

<!-- The previous theme reference did not describe the measured layout contract or image subject safety. -->
| 文档 | 内容 |
| --- | --- |
| [workflow](references/workflow.md) | 确认、规划、构建与复核 |
| [content](references/content.md) | 内容结构、可见文字与来源 |
| [architecture](references/architecture.md) | 文件与模块所有权 |
| [themes](references/themes.md) | 主题选择与旧版兼容 |
| [visual-layouts](references/visual-layouts.md) | 杂志与瑞士风、标题容量、网格、图片裁切与安全区 |
| [assets](references/assets.md) | 素材与字体约束 |
| [qa-export](references/qa-export.md) | 浏览器检查、产物绑定与导出 |

## 应用架构参考

需要讲解大型应用时，读[应用架构资料](assets/application-architecture-references/index.html)。按真实职责、主调用链、同步与异步边界组织原生 HTML/SVG；参考图不作为生产架构全貌，也不继承未经项目资料确认的关系或数字。
