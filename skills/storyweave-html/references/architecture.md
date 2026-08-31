# 架构边界

`outline_draft.json` 保存确认前的叙事，`deck_spec.json` 保存审批后的内容与主题。审批同时固化逐页 `visual_scheme_ref`、`render_recipe_ref`、布局、页面节奏和可选素材槽位。`index.html` 是演示入口，`slides/<slide-id>.html` 是可独立打开和编辑的完整页面。

`storyweave-output.json` 只描述已完成产物：固定画布、页面顺序、稳定 ID、角色、notes、阅读模式、页面节奏、素材槽位和相对资源路径。canonical 输出还记录合同版本、主题、scheme、render recipe hash、渲染器版本和 deck hash；legacy 输出记录旧主题 ID 与迁移状态。它不包含播放器状态，也不要求消费者使用特定展示技术。

HTML 源文件是内容母版。PNG、PDF 和 PPTX 都是浏览器渲染得到的派生物；Bento 包装属于独立的展示适配器，不改变 HTML 源。
