# Bento 包装与检查流程

1. 通过公共核心读取当前已验证产物，核对生产者 QA 与实际文件。
2. 按清单页序截图 HTML 或读取 PNG。HTML 等待字体、资源与动效稳定，采用清单画布。
3. 校验 shell 来源与 SHA-256，把页面图片内嵌为 data URI，写入唯一的 `#bento-doc`。
4. 保留页面 ID、顺序和备注。覆盖已有输出时沿用 `docId` 和适配器支持的未知字段。
5. 重新确认生产者未变化，检查 Bento 文档和浏览器首图显示，写入独立适配报告。

HTML 截图保存在项目 `.storyweave-express/`。缓存键包含页面字节、声明的非 JSON 素材字节、画布和栅格化版本，复用时再核对 PNG 哈希。改动页面或资源后重新生成截图。

Bento 文档绑定生产者指纹，每页为一个不透明、无旋转、全画布图片。QA 核对页数、顺序、备注和图像内容，浏览器核对首页图片可解码、完整可见且与文档相同。它不代替逐页播放与编辑功能的交互验证。

`build` 写入 `.bento.html`，`qa` 另写 `qa/<output-id>.adapter-report.json`。全局工作流组合构建与检查，自带相同适配实现。所有路径保留生产者 HTML、PNG、清单与 `qa_report.json`。

随包 shell 保存为 `assets/bento/Bento_Slides.bento.html.br`。读取时由 Node 标准库无损恢复，并核对 `SOURCE.json` 中官方原稿的 SHA；损坏文件拒绝使用。生成的 `.bento.html` 仍可独立打开。用户缓存、显式 HTML 和在线更新继续使用普通 HTML 文件。
