# 架构边界

`outline_draft.json` 保存确认前的叙事，`deck_spec.json` 保存审批后的内容与主题。`index.html` 是演示入口，`slides/<slide-id>.html` 是可独立打开和编辑的完整页面。

`storyweave-output.json` 只描述已完成产物：固定画布、页面顺序、稳定 ID、角色、notes 和相对资源路径。它不包含播放器状态，也不要求消费者使用特定展示技术。

HTML 源文件是内容母版。PNG、PDF 和 PPTX 都是浏览器渲染得到的派生物。

