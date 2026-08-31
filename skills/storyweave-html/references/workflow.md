# HTML 工作流

资料检查 → Storyboard → 用户确认 → 主题、逐页 scheme 与 render recipe 审批 → 逐页 HTML 构建 → 浏览器 Review → 导出。

Storyboard 是构建门。每页只保留一个主张，并列出准确文字、证据、页面角色、页面节奏、素材槽位和转场。用户确认前不构建最终 HTML 页面。

canonical Storyboard 使用 v3 schema。审批会固化 `theme_ref`、逐页 `visual_scheme_ref`、`render_recipe_ref`、布局、页面节奏和配方 hash；构建阶段拒绝 `auto`、跨主题 scheme、缺失素材和过期配方。legacy v2 项目继续使用原主题和原页面结构，迁移时另存 `outline_draft.v2.json`。

构建时同时写入演示入口、逐页独立 HTML 和 `storyweave-output.json`。页面使用固定 `1280×720` 舞台整体等比缩放。浏览器 Review 使用 manifest 中的页面路径，在桌面与移动视口逐页检查资源、溢出、空白、主题引用、内部区域重叠、标题间距、底部安全线和独立打开能力。
