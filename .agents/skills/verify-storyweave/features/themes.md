# 主题预览与重规划

查看同内容的多主题预览，改变视觉计划，同时保留确认内容。

## Sub-features

- `theme-list` 列出当前 canonical 与 legacy 主题。
- `theme-preview` 打开最多三份主题预览的首页。
- `theme-replan` 更新 v4 视觉计划，保留批准稿字节。
- `theme-rebuild` 不重复审批内容，重新构建与 QA 后声明新主题。
- `theme-visual-system` 区分纸面杂志与瑞士风的字体、网格、论点对开、数字账单、图片、系统图和收尾构图。

## How to get to it (user POV)

使用 HTML 的 `themes --json`、`preview` 和 `replan --theme-ref`。schema 4 项目随后直接 build 与 qa；旧 v3 重规划仍需 approve，旧主题迁移使用显式 migrate。内容变动始终需要重新确认。

## Driving it with verify-storyweave

完成 doctor 与 launch，保留 `VERIFY_RUN_ID`，从当前 catalog 选择可用主题。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive themes --run-id "$VERIFY_RUN_ID" --theme-ref editorial/paper-magazine
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

commands 中包含 themes、preview、replan、build 与 qa。`themes.json` 保存主题目录，`theme-preview-1.png` 等保存预览首屏。重规划前后核对 ID、主张、证据、来源、备注与结构化内容；v4 的 `deck_spec.json` 保持原字节，并记录 `build without content reapproval` 入口。

<!-- Catalog order previously selected white-cyan and skipped the Swiss body layouts. -->
默认从 editorial/paper-magazine 重规划至 systems/ink-blue-grid；反向或其他起点优先选择杂志风。`theme-replan.json` 保存批准稿哈希、content revision、visual_system 与逐页计划，`before-replan/` 保留旧主题产物和截图。

<!-- Visual plan versions and copy policies change independently from the approved content revision. -->
重建清单与页面的 `meta[name="storyweave-theme-ref"]` 声明新主题。预览和重建使用不同浏览器上下文，分别保留编号 trace；完整内容核对与 `contact-sheet.html` 在重建路径保存。renderer 版本变化后的旧计划先 replan，批准内容保持不变；当前为 4.3.0。新计划须声明每页 composition、标题与正文断词策略，以及 neutral 比较权重。

<!-- Theme-only rotation caused the rejected s06; current DAG geometry preserves the same reading path across themes. -->
默认主题 fixture 无图片；图片比例与构图由 html-authoring 的视觉基线选项覆盖。杂志图片为 `image-editorial / 21:9`；短标题和适量正文的瑞士图片为 `image-strip / 4:1`，其余为 image-columns。非循环系统图在两种主题中均按批准层级从左到右展开，只有真实循环边使用 loop。`theme-replan.json.pages` 与实际 DOM 保存 composition 和逐页视觉意图，计划保存共享视觉生成策略。

<!-- Different theme skeletons are current behavior, not a requirement or proof that either is easier to read. -->
上述构图描述当前实现，不是视觉接受条件。主题可以共用清楚的图解方向；不得为拉开主题差异降低阅读性。视觉改动按相同内容前后逐页及整套评测，任一退步单独阻断，不能凭 composition 不同或主题名称正确判为改善。

## Gotchas

- 主题数量来自当前 catalog，不固定数量验收。
- helper 只打开最多三份预览的首页，不逐页比较所有预览。
- v4 只改视觉不重复内容审批，v3 保留原重新审批语义，不能混用。
- 此路径不执行旧主题 migrate，不能据此声称已验证迁移。
- 预览可打开不证明主题满足视觉目标，仍需查看版式、字阶与节奏。
