# HTML 工作流

资料检查 → Storyboard → 用户确认 → 主题审批 → 逐页 HTML 构建 → 浏览器 Review → 导出。

Storyboard 是构建门。每页只保留一个主张，并列出准确文字、证据、页面角色和转场。用户确认前不构建最终 HTML 页面。

构建时同时写入演示入口、逐页独立 HTML 和 `storyweave-output.json`。浏览器 Review 使用 manifest 中的页面路径和固定画布，逐页检查资源、溢出、空白与主题一致性。

