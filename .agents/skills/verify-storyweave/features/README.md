# StoryWeave 功能验证地图

先读[验证 Skill](../SKILL.md)，再选择对应功能。地图描述用户入口，报告记录本次实际覆盖范围。

## 运行前提

使用 Node.js 20 以上、Playwright 与 Chromium。从仓库根目录先检查生成包，执行 doctor 与 launch，保留唯一 `VERIFY_RUN_ID`。同一运行串行驱动，各功能使用自己的工作目录；不同运行使用不同 ID。仓库示例与真实项目只作为只读输入。

## 功能索引

<!-- The plain authoring fixture does not cover images; optional visual and compatibility routes have explicit evidence. -->
| 功能 ID | 用户入口 | 完成结果 |
| --- | --- | --- |
| [html-authoring](html-authoring.md) | draft、approve、build、qa、独立 HTML；视觉基线与旧版兼容选项 | 内容与页面一致；可另验两种视觉系统、图片、v2/v3 |
| [html-playback](html-playback.md) | 画廊按钮、翻页键、首尾键与独立页 | 活动 ID 按动作变化，焦点下空格只前进一页，缩放保留内容 |
| [themes](themes.md) | themes、preview、replan、build、qa | v4 换主题保留批准稿字节，重建后声明新主题 |
| [imagegen](imagegen.md) | 任务、status、缺图 build；真实工具调用、record-result、review、qa | 编译与缺图门实测，真实图片交付单独记录 |
| [bento](bento.md) | 全局编排、直接 Express、Bento 文件 | 生产者 QA 当前有效，顺序与备注保留，首图实际显示 |
| [design-library](design-library.md) | 案例索引与检索、HTML 引用审批 | 所选页捕获到项目，哈希可核对，参考应用可追溯 |
| [reference-gallery](reference-gallery.md) | 演讲参考图库、缓存校验、离线导出与筛选 | 每张原图字节可核对，离线实际显示、组合筛选与错误恢复另有浏览器证据 |
| [distribution](distribution.md) | 四包独立安装、doctor 与各自业务入口 | HTML、Imagegen 缺图门、Express、全局 Bento 使用本包资源 |

## 证据规则

`commands.json` 保存命令与退出码，`actions.json` 保存浏览器动作和状态，`project/` 保存项目副本，`summary.json` 保存入口、结果、findings、限制与指纹。浏览器路径保存截图和编号 trace，HTML 逐页桌面图汇入 `contact-sheet.html`。

pass 只覆盖 `entry_points`。not-run、fail、needs-images 分别表示未执行、失败和缺少真实图片，均不能当作完整功能通过。前提不足时保留原因与实际尝试入口。任务编译不等于图片服务调用，已有图片检查不等于本次生成，视觉质量另需复核。

<!-- Browser geometry and visual improvement were conflated in the previous delivery. -->
视觉改动先读[生成前检查与视觉评测](../references/visual-review.md)。技术状态与 `visual_acceptance` 分别报告；后者为 needs-review 或 regressed 时不能宣称优化完成。相同批准稿、逐页 A/B、整套节奏、截图哈希及用户反例都进入评测证据，不用平均分掩盖退步。

<!-- Partial runs formerly exited successfully, so automation could accept missing browser coverage. -->
drive 与 report 用退出码 1 表示失败、3 表示缺图、4 表示未完成；总报告中任一未执行功能均不能得到退出码 0。工具策略限制需在 launch 记录为 `--browser-policy blocked --browser-block-reason <原因>`，此后间接启动浏览器的 QA 与适配命令同样停止。

<!-- Visual review is a separately bound result; technical success does not establish design acceptance. -->
`report.visual_acceptance` 记录人工视觉结果，`release_ready` 仅在全部技术功能 pass 且视觉 accepted 时为 true。视觉基线评审包与填写入口见 [html-authoring](html-authoring.md)，未评审时保留 needs-review 或 not-run。

## 运行结束

helper 在驱动前后核对源码与运行副本。运行中漂移记录 `source.changed` 并使结果失败。修复后先 doctor，再用新运行重验。清理后 report 重新验证证据哈希；报告、产物、截图与 trace 保留，work 被移除。
