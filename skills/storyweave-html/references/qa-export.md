# QA 与导出

结构检查：legacy manifest 使用 `storyweave/slides` version 1，canonical manifest 使用 version 2；页面 ID 唯一；每页路径存在；独立页包含 `data-storyweave-slide`、正确的 `data-slide-id` 和主题身份。canonical 输出还要校验主题、scheme、渲染器和 deck 指纹。

浏览器检查：桌面 16:9 画布和移动浏览视口下无空白、页面级溢出、资源断裂、标题遮挡、不可读字号或主题漂移。固定舞台必须按同一比例整体缩放，不得在移动视口重排。检查还包括 copy/visual 区域重叠、内容离开舞台、标题与首个内容块间距、底部导航安全线和声明素材的实际加载状态。浏览器不可用时只允许 degraded 结果。

HTML 是内容母版。PNG、PDF 与 PPTX 是渲染派生物；PPTX 不承诺对象级可编辑。Bento 包装应在 producer QA 通过后进行，并单独检查页数、单页图片元素和 JSON 文档完整性。
