# 原创架构案例册

[打开选图册](index.html)。默认展示已选的 A1 知识问答、A2 搜索、D1 视频、D4 推荐，并保留其他四张备选。可按风格筛选、放大、勾选并导出选图结果。全部 8 张图片离线显示；页面标题与说明放在图外。

| 编号 | 案例 | 绘画或材质 | 组件 / 关系 | 图片与最终提示词 |
| --- | --- | --- | --- | --- |
| A1 | 知识问答 | 细线手绘与淡彩 | 12 / 11 | [原图](rag-sketch.png) · [提示词](prompts/rag-sketch.prompt.txt) |
| A2 | 搜索平台 | 工程手绘 | 12 / 11 | [原图](search-sketch.png) · [最终修订](prompts/search-sketch.frame-edit.prompt.txt) |
| B1 | 数据分析 | 图鉴式设备剖面 | 12 / 12 | [原图](analytics-atlas.png) · [最终修订](prompts/analytics-atlas.layout-edit.prompt.txt) |
| C1 | 即时消息 | 黏土与哑光陶瓷 | 12 / 12 | [原图](messaging-clay.png) · [最终修订](prompts/messaging-clay.edit.prompt.txt) |
| D1 | 视频平台 | 银白玻璃剖面 | 12 / 12 | [原图](video-glass.png) · [最终修订](prompts/video-glass.content-edit.prompt.txt) |
| D2 | 订单履约 | 青蓝实体与货架剖面 | 12 / 12 | [原图](fulfillment-cyan.png) · [提示词](prompts/fulfillment-cyan.prompt.txt) |
| D3 | 电商交易 | 青蓝玻璃与陶瓷 | 14 / 13 | [原图](ecommerce-cyan.png) · [提示词](prompts/ecommerce-cyan.prompt.txt) |
| D4 | 内容推荐 | 银白与淡紫玻璃 | 12 / 13 | [原图](recommendation-glass.png) · [提示词](prompts/recommendation-glass.prompt.txt) |

这些原创教学模型由 Codex 内置 `image_gen.imagegen` 实际生成，共 14 次生成与局部修订调用。工具返回的原图均为 1672×941，保留原始 PNG 字节；请求比例为 16:9，实际像素比例略有差异。具体模型 ID 未由工具披露。

[generation.json](generation.json)保存全部调用的实际提示词哈希、输出哈希、选用版本，以及视觉模型逐图查看后的中文、组件、箭头、裁切、布局与限制观察。[content-spec.json](content-spec.json)保存组件和精确有向关系；[visual-intent.json](visual-intent.json)保存生成前的表达任务。评审者同时参与制作，记录不作为独立人工评审或 整套演示验收。CI 只核对绑定和浏览行为。

图解主体可沿工程手账、科普图鉴、青蓝产品结构与银白剖面继续扩展。演讲页按具体主张选择整图、局部放大或分步讲解；外缘较紧和反馈交叉等限制见逐图记录。

已选案例对应四套新增主题，完整引用见 [主题目录](../../../references/themes.md)，选择记录见 [selection.json](selection.json)。

图片、提示词与记录按随附 [MIT 许可](LICENSE)分发。
