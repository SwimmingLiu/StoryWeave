# 图片主题目录

当前有 **23 套候选生成主题**。新增四套主题来自已选原创架构图，保留其媒介和材料处理；原有 19 套主题及完整引用继续兼容。18 种外部内容页参考仍对应 14 个主题方向。各主题都有实际参考预览；新增四张是架构参考图，原有流程样张使用共同内容，分别记录来源与观察。

[全部主题预览](../assets/examples/theme-previews/index.html) · [外部内容页参考](presentation-cases.md) · [逐项映射](../assets/themes/reference-theme-map.json)

## 默认选择

[主题预览](../assets/examples/theme-previews/index.html)默认展示 16 套浅色方向，6 套深色主题通过“深色备选”显式查看；高饱和朱红海报在“全部主题”中保留。主题 ID、配方与旧项目保持兼容，未晋升的主题仍为 candidate。

大型应用的参考与短流程样张分开。先看[浅色应用架构插画](../assets/application-architecture-references/index.html)，确认服务边界、主调用链与异步路径；再选择材质。流程样张证明单页媒介效果，不证明已覆盖复杂架构。

[原创架构案例册](../assets/application-architecture-references/generated-cases/index.html)提供 8 张可离线比较的实际图片，默认显示已选的 A1、A2、D1、D4，分别对应下方四个新增主题。工程手绘适合表现分层流程与共享依赖；图鉴剖面适合展开计算、存储和加工设备；青蓝实体与银白玻璃适合产品结构、应用方案和技术发布。青蓝发布页可将视觉集中到一个主产品，再用剖面或少量功能近景解释能力。

架构内容图的标题与说明优先由演示页承载。图内用组件、分组和方向表达内容，围绕主调用链安排空间；为外轮廓、阴影、标签与箭头保留完整边缘，避免分组铭牌遮住连线。选用参考时仍需核对本页实际关系。

## 新增架构主题

| 案例 | 主题引用 | 主要表达 |
| --- | --- | --- |
| A1 · 知识问答 | `knowledge/watercolor-machinery` | 细蓝笔触、薄荷与淡紫水彩、内容相关的设备剖面 |
| A2 · 搜索平台 | `knowledge/engineering-workshop` | 清楚透视、工程线稿、部件构造与完整外围留白 |
| D1 · 视频平台 | `systems/glass-pipeline` | 银白玻璃剖面、青蓝主链、相互独立的处理与存储支路 |
| D4 · 内容推荐 | `systems/lavender-feedback` | 透明玻璃、淡紫反馈轨道与清楚的方向、交叉隔离 |

这些配方从参考图提炼材质、笔触和连接处理，组件、分支、回流与标题由当前内容决定。每套覆盖十种既有页型，状态为 `candidate`，通过 `--scope authoring` 使用。原图生成早于配方定义，是设计参考，不能作为新配方全部页型或整套演示的通过证明。

## 可选择的主题

| 架构 | 名称 | 完整引用 |
| --- | --- | --- |
| 编辑叙事 | 纸面编辑 | `editorial/paper-magazine` |
| 系统蓝图 | 白底电路 | `systems/white-cyan-circuit` |
| 系统蓝图 | 参数化波纹 | `systems/white-cyan-wave` |
| 系统蓝图 | 银白玻璃 | `systems/silver-glass` |
| 系统蓝图 | 银白玻璃管线 | `systems/glass-pipeline` |
| 系统蓝图 | 淡紫玻璃反馈 | `systems/lavender-feedback` |
| 系统蓝图 | 技术蓝图 | `systems/engineering-blueprint` |
| 系统蓝图 | 暖色电路 | `systems/warm-circuit` |
| 系统蓝图 | 霓虹系统 | `systems/neon-network` |
| 系统蓝图 | 黑金运行 | `systems/black-gold` |
| 品牌传播 | 朱红海报 | `campaign/bold-poster` |
| 影像叙事 | 日常电影 | `cinematic/natural-film` |
| 知识讲解 | 粉笔黑板 | `knowledge/chalkboard` |
| 知识讲解 | 手绘白板 | `knowledge/sketch-notes` |
| 知识讲解 | 淡彩机械手绘 | `knowledge/watercolor-machinery` |
| 知识讲解 | 工程线稿工坊 | `knowledge/engineering-workshop` |
| 知识讲解 | 水墨方法论 | `knowledge/ink-method` |
| 实体隐喻 | 黏土流程 | `tactile/clay-workflow` |
| 实体隐喻 | 复古设备 | `tactile/retro-device` |
| 绘画叙事 | 角色彩绘 | `illustrated/storybook-guide` |
| 绘画叙事 | 漫画工程 | `illustrated/comic-engineering` |
| 绘画叙事 | 场景系统图 | `illustrated/panoramic-system` |
| 绘画叙事 | 像素世界 | `illustrated/pixel-world` |

## 参考风格如何归并

| 参考风格 | 生成主题 |
| --- | --- |
| 技术蓝图 | 技术蓝图 · `systems/engineering-blueprint` |
| 暖色电路讲义 | 暖色电路 · `systems/warm-circuit` |
| 黑板粉笔讲解 | 粉笔黑板 · `knowledge/chalkboard` |
| 手绘知识分享、协作白板策略 | 手绘白板 · `knowledge/sketch-notes` |
| 水墨黑板方法论 | 水墨方法论 · `knowledge/ink-method` |
| 深色霓虹系统 | 霓虹系统 · `systems/neon-network` |
| 黏土流程讲解 | 黏土流程 · `tactile/clay-workflow` |
| 复古立体开发者 | 复古设备 · `tactile/retro-device` |
| 用户旅程分镜、柔和彩绘讲解、角色引导技术讲解 | 角色彩绘 · `illustrated/storybook-guide` |
| 漫画工程叙事 | 漫画工程 · `illustrated/comic-engineering` |
| 场景式平面图解 | 场景系统图 · `illustrated/panoramic-system` |
| 像素世界流程 | 像素世界 · `illustrated/pixel-world` |
| 黑金技术运行叙事 | 黑金运行 · `systems/black-gold` |
| 极光玻璃产品讲解、银白玻璃技术叙事 | 银白玻璃 · `systems/silver-glass` |

手绘知识分享与协作白板共用笔触和轻量批注，保留独立的白板流程方案。用户旅程、柔和彩绘和角色引导共用连续角色叙事，保留分镜方案。极光玻璃与银白玻璃共用材质和光照，极光作为 `aurora-capabilities` 方案；其余差异明确的媒介独立成主题。

## 方案与连续性

每套主题覆盖观点、流程、对比、数据，并支持封面、章节、图片主视觉、引文和收尾。架构决定阅读顺序，样式决定配色、字体、材质和连续性锚点，方案决定本页构图。一套演示保持样式连续，逐页组织由真实内容决定。

粉笔、水墨、黏土、像素和漫画属于不同的绘画语言；技术蓝图、暖色电路、霓虹与黑金分别处理精密线描、纸上讲解、信号关系和运行场景。主题名称不规定默认道具，预览里的齿轮、电脑或人物不自动进入新项目。

数据方案使用共同基线、准确比例和直接标签，材质插画位于图表之外。普通代码、卡片、表格和精确图表优先使用 HTML/SVG；材质或角色不能改写事实和定量关系。

全部主题仍为 `candidate`。新增预览证明单张流程页的实际效果，不代表每个页型或整套演示均通过视觉验收。CLI 草稿默认使用 authoring scope，也可显式传入 `--scope authoring`；active scope 只返回已晋升主题。主题维护见 [theme-authoring](theme-authoring.md)。

旧 v2 的 `business-minimal`、`editorial`、`launch-tech`、`premium-dark` 保持兼容，短 ID 不静默改写成新主题。按项目使用 `migrate` 或 `migrate-content` 显式迁移。
