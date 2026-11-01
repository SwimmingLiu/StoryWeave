# HTML 构建与修改流程

1. 创建草稿，编辑叙事、逐页主张、来源、备注和 `content`。打开草稿预览，取得用户确认。
2. 执行 `approve --theme-ref <architecture/style>`。schema 4 的批准内容写入 `deck_spec.json`，视觉计划写入 `plans/html.json`。
3. 执行 `build`，生成画廊、独立 HTML、生成清单和 `storyweave-output.json`。
4. 执行 `qa`，查看独立页与画廊逐页的桌面、移动截图，检查主张、关系与整套节奏。
5. 解决 blocking 与 degraded，说明 warning 后导出或交给 Bento。

结构化内容决定信息关系，HTML 计划决定布局、字阶、主题、素材槽位与节奏。构建验证 `contentRevision`、计划哈希、规则版本与参考资源，不在构建时猜测缺失的内容。

只改主题或参考时执行 `replan`，再构建和 QA。v4 保留批准内容字节，不重复确认。改动文字、来源、备注或信息关系时重新编辑草稿并取得用户确认。

旧 v2、v3 保持原渲染语义，v3 `replan` 后仍需重新审批。`migrate` 处理主题迁移，`migrate-content` 保留原稿并创建 v4 草稿，报告比较、流程与指标所需的待补结构。补齐后再确认。
