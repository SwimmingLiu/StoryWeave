# HTML 内容生成

将确认后的结构化内容生成可独立打开的 HTML，并核对页面文字、关系与当前产物 QA。

## Sub-features

- `html-draft` 创建结构化草稿与可阅读预览。
- `html-approve` 保存内容修订与独立 HTML 计划。
- `html-build` 生成画廊、独立页面和产物清单。
- `html-qa` 在真实浏览器检查全部独立页和画廊逐页的双视口呈现。
- `html-visual` 使用明确基线检查两种风格，分别记录技术 QA 与逐页视觉改善、持平、退步或未评测。
- `html-compatibility` 通过公开 v2、v3 路径验证旧内容的生成与播放。

## How to get to it (user POV)

使用 `skills/storyweave-html/scripts/ppt.mjs` 的 draft、approve、build 和 qa。带 `--theme-ref` 的草稿默认采用 schema 4，编辑 content 后打开 `outline_preview.html`，取得用户确认再批准。成稿从 `index.html` 或 `slides/*.html` 打开。

## Driving it with verify-storyweave

完成 doctor 与 launch，保留 `VERIFY_RUN_ID`。验证只批准 helper 的示例输入，不自动确认真实用户内容。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive html-authoring --run-id "$VERIFY_RUN_ID" --theme-ref editorial/paper-magazine
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

从 `commands.json` 核对草稿、审批、构建与 QA。项目证据包含 `outline_draft.json`、`deck_spec.json`、`plans/html.json`、独立页面、画廊、清单与报告。v4 批准前后的结构化 content 一致，`exact_text` 由批准内容投影，ID 与页序保持。

生产者 QA 检查独立页及画廊逐页的桌面和移动呈现。helper 另在 `1280×720` 与 `390×844` 打开每个独立页，核对可见文字、主题和 ID。`actions.json`、`s01-desktop.png`、`s01-mobile.png`、`gallery-before-desktop.png`、trace 与 `contact-sheet.html` 保留可查看证据。

<!-- The original default draft had no image and could not reach the new image-hero or subject-crop checks. -->
本轮视觉验收给 drive 添加 `--visual-baseline <absolute-path> --layout-study --compatibility`。基线准备方法见 Skill 的 Drive。`visual-editorial/` 与 `visual-swiss/` 保留旧项目和新项目，通过公开 replan 保留批准稿字节与修订；新产物要求 browser、blocking/degraded 为零，并通过 HTML export 重新核对绑定。`--layout-study` 仅替换副本的视觉素材，不改批准稿。带图预览逐页通过键盘打开，图片应实际加载。

计划选择 image-hero、statement-split 等匹配内容的版式。中文短词按语言分词保持同一行，准确文字投影继续逐字核对。QA 测量标题实际字符行、孤字行尾、字号字重、标题间距、文字重叠、底部 80px、导航遮挡、图片比例及焦点和主体裁切。`visual-comparisons.json` 保存两套内容与绑定，`visual-before-after.html` 提供 16 组逐页对照；人工查看字体、素材与整套疏密后记录判断。

<!-- Fixed directions rewarded a known visual regression; geometry must match the chosen plan without prescribing novelty. -->
正文 QA 检查孤字、短词拆行、连线与文字或无关节点相交、端点脱离，以及 neutral 比较列的颜色和字重。`layout-qa-states.json` 保留双视口原始测量。构图、方向和图片比例记录实际选择并核对计划与 DOM，不预设哪种方向更好。当前实现的杂志纵向选择仍作为产品行为记录，其视觉收益需要独立比较；版式种类数量只证明样本覆盖。

按[视觉评测参考](../references/visual-review.md)查看 `visual-review/review-sheet.html` 的全部页面及整套视图，再填写评审模板并运行 assess。每个维度有实际截图依据；未看或不确定为 unreviewed，任一维度退步阻断接受。用户拒绝的 s06 原图对作为固定反例。`summary.status: pass` 表示技术路径通过，不能覆盖 `visual_acceptance: regressed` 或 needs-review。

`compatibility-v2/` 与 `compatibility-v3/` 分别通过 draft、approve、build、qa，再驱动双视口按钮、键盘和独立页。它们不替代迁移功能验收。

<!-- Technical QA now produces a separate visual packet; omitting that review would hide an unfinished acceptance gate. -->
视觉基线驱动成功后，`html-authoring/visual-review/` 保存 `packet.json`、`review-template.json`、`review-sheet.html` 和 A/B 图片，初始状态为 needs-review。查看实际图片，将模板复制到独立文件，按含义、阅读、关系、构图、内容针对性逐页判断，再评整套连贯性与节奏。填写真实评审人和熟悉程度，不预填接受结论。

```bash
node .agents/skills/verify-storyweave/scripts/visual-review.mjs assess --packet "tmp/verification/$VERIFY_RUN_ID/evidence/html-authoring/visual-review/packet.json" --input <absolute-filled-review-path> --out "tmp/verification/$VERIFY_RUN_ID/evidence/visual-assessment"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

report 分别列出技术功能状态与 `visual_acceptance`。退步、blocking 问题或相同像素命中已记录的用户否决会返回 regressed；不确定或缺项保持 needs-review，完成且没有退步才是 accepted。`improvement_claim` 还需要至少一项改善。该 A/B 包仅比较桌面图片，标签本身不代表独立盲评，也不替代移动视口与播放验收。

## Gotchas

- draft 创建示例，不证明 Agent 已理解真实资料。
- 默认路径不打开草稿预览或执行导出。视觉选项执行主题预览与 HTML 导出；outline_preview、PNG、PDF 和 PPTX 导出仍未覆盖。
- 浏览器不可用的 degraded 报告不能作为交付通过。要求 browser、blocking 为零、degraded 为零和当前文件绑定。
- 内容与几何通过不代替字体、构图和全套节奏的人工评审。
- 技术 pass 或退出码 0 不代表视觉 accepted；交付还需查看 report 的 `release_ready`。
- HTML 是原生编辑源，当前图片式 PPTX 和 Bento 不保留文字与形状对象。
