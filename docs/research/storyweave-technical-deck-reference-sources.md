# 技术分享整页参考的外部来源

本次在 grapeot/nbp_slides 之外筛到 2 个可供扩充的系列，以及 3 张可补入现有系列的内容页，共 7 张。它们均已在浏览器打开原图检查。没有找到足以证明每个系列都覆盖观点、流程、对比和数据的外部样张集合，缺少的职责保留为空。

## 可取用的内容页

主要来源是 [nomie7/nano-banana-slides-prompter](https://github.com/nomie7/nano-banana-slides-prompter/tree/038abe6506de020a807e94106d009c120e40ad55)。作者将这些图片称为本工具生成提示词的 sample slides。项目说明使用 Nano Banana Pro，但没有逐图运行记录，不能进一步确认具体版本。

| 系列 | 实际内容页 | 职责 | 使用判断 |
| --- | --- | --- | --- |
| 黑金技术运行叙事 | [六阶段 AI 工作流](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample15.jpeg)、[手工上下文与 CLAUDE.md 对照](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample25.png) | 流程、对比 | 中央透明计算核心、复杂电缆与有序芯片结构为解释提供具体插画。保留为新系列，缺观点和数据页。 |
| 角色引导技术讲解 | [CIA 三支柱](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample24.png)、[被动防御与主动狩猎](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample22.png) | 观点、对比 | 角色、立体建筑和场景比喻共同承担内容讲解。两页的角色与配色并不完全连续，属于方法参考，缺流程和数据页。 |
| 手绘知识分享补充 | [防御措施与威胁演进](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample21.png) | 对比 | 连续盾牌图、威胁扩散图和人物讲解可以补现有手绘风格的比较页。 |
| 暖色技术讲义补充 | [CLAUDE.md 放置策略](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample26.png) | 观点与结构说明 | 等距目录空间显示父子目录、优先级和继承范围。它不是时间顺序流程，不能仅因存在箭头就标为流程页。 |
| 深色霓虹系统补充 | [Explore、Plan、Code、Commit](https://raw.githubusercontent.com/nomie7/nano-banana-slides-prompter/038abe6506de020a807e94106d009c120e40ad55/docs/samples/sample20.jpeg) | 流程 | 中央开发者与环绕界面形成完整技术场景，四个阶段在顶部连贯推进。 |

这些图中的性能数值、效果百分比与产品行为只是样张内容，不能继承为项目事实。正式演讲需放大必要标签，减少小字。可编辑文字、步骤和真实数值仍交给 HTML/SVG；整页生图的价值来自连续插画、人物、材质和空间。

作者公开的是[工具系统提示词](https://github.com/nomie7/nano-banana-slides-prompter/blob/038abe6506de020a807e94106d009c120e40ad55/server/src/prompts/system.ts)，没有每张样图的原始请求。仓库许可为 GPL-3.0，本批只记录作者和来源链接，不复制运行代码或重新授权原图。

## 多页图库的实际筛选

[JuneYaooo/gpt-image2-ppt-skills](https://github.com/JuneYaooo/gpt-image2-ppt-skills/tree/2d57ef8127b83e8232a1be4e9515f0b3cc9fc91e) 将 [Slidecraft Template Gallery](https://slidecraft-template-gallery.vercel.app/)列为官方预览入口。实际访问时显示 215 个模板，“科技”筛选得到 5 套。仓库更新说明中的模板总量与此时在线展示量不相同，不以 README 的数量代替在线可取用图片数量。

在 [Spatial Glass](https://slidecraft-template-gallery.vercel.app/templates/gradient-glass)与 [Dark Aurora](https://slidecraft-template-gallery.vercel.app/templates/dark-aurora)中，五张预览分别是封面、目录、关键观点、内容布局和总结。具体查看关键观点与内容布局原图后，两套都以卡片、图标、数字和普通柱图或折线图为主体。玻璃装饰物和光弧背景不足以让整页栅格化，因此没有为补齐数据职责而将它们收录。

| 其他来源 | 实际查验 | 处理 |
| --- | --- | --- |
| [nexu-io/codex-slides](https://github.com/nexu-io/codex-slides/tree/dbc2a5992e937760e9ce8e587e11729f970881cb) | `nb-engineering-blueprint-grid.jpg` 是 1000×1000 的四个实体物件剖面拼图。 | 保留为来源研究，不当作 16:9 演讲内容页。 |
| [AAAAAAAJ/slides](https://github.com/AAAAAAAJ/slides) | 作者说明前 11 个样例来自 Seedream 4.0，新增 8 个来自 Nano Banana 2 / Pro；新增样式的中英文入口暂时复用同一张图。 | 不能将两个语言入口计为两张内容页。普通网格、卡片和字体排版继续归 HTML。 |
| [coderj001/notebooklm-infographic-style-libary](https://github.com/coderj001/notebooklm-infographic-style-libary/tree/c752c32dfb9654f485b0cb2150eb9259b816b326) | 实看水彩三页、技术拼贴与 Anti-Gravity 三页。水彩主要为封面、章节和收尾；其他页面多为原生文字、公式或简单图形。 | 未把封面数量当作内容覆盖。单张透明结构插画不能证明新多页系列。 |
| [op7418/NanoBanana-PPT-Skills](https://github.com/op7418/NanoBanana-PPT-Skills/tree/0c18b9abde04ad42f4f62c7e9ead346b7bb39260) | 仓库声明两套风格，但未提供可直接取用的本地内容页图片集合。 | 保留提示词来源，不增加实际参考图数量。 |

机器可读候选保存于 [candidates.json](../../tmp/presentation-expansion/external-sources/candidates.json)。[exclusions.json](../../tmp/presentation-expansion/external-sources/exclusions.json)记录已查看但未收录的具体图片与原因。候选各页保存原图、职责、尺寸、来源和视觉检查状态。
