# QA 与导出

结构检查：manifest 为 `storyweave/slides` version 1；页面 ID 唯一；每页路径存在；独立页包含 `data-storyweave-slide` 与正确的 `data-slide-id`。

浏览器检查：固定 16:9 画布下无空白、溢出、资源断裂、标题遮挡、不可读字号或主题漂移。浏览器不可用时只允许 degraded 结果。

HTML 是内容母版。PNG、PDF 与 PPTX 是渲染派生物；PPTX 不承诺对象级可编辑。

