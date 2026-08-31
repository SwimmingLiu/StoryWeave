# HTML 素材

- 用户提供的非公开图片可以使用相对路径或 data URI；交付前确认离线可访问。
- 公开图片记录 URL、许可证、作者和检索日期。
- 字体优先使用可靠的本机或随项目提供的字体栈；网络字体不可作为离线交付的唯一来源。
- SVG、图表和表格保持为 HTML 原生内容，不用截图替代事实性结构。

## 素材槽位

页面通过 `asset_refs` 声明素材使用关系。每个引用至少包含 `asset_id` 和 `slot`，可选字段包括 `fit`、`crop`、`focal_point`、`alt` 和 `caption`。`asset_id` 优先解析到项目根目录的 `asset_manifest.json`；没有 registry 时可以提供项目相对 `path`。

允许的槽位为 `hero`、`supporting`、`background`、`logo` 和 `evidence`。路径必须是项目相对路径，不能指向绝对路径或通过 `..` 离开项目目录。图片主视觉默认不改变页面文字；素材缺失时 build 直接失败。
