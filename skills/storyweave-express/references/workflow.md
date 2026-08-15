# Express 工作流

验证 manifest → 解析相对资源 → HTML 逐页截图或读取图片 → 内嵌 data URI → 构建 Bento 文档 → 保留已有 `docId` → QA。

HTML 截图固定使用 manifest 的画布；图片输入必须匹配同一宽高比。每个 Bento 页面只放一个全画布 image element，避免适配器重新解释生产者版式。

