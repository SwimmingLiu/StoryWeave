# 图片主题目录

演讲与分享稿的内容页样张见[演示主题案例](presentation-cases.md)。参考案例与下列生成主题分别计数。

StoryWeave 的主题分为三层：主题架构决定整套 deck 的空间组织和阅读节奏，主题样式决定字体、颜色、材质和全局锚点，视觉方案决定单页的构图、媒介和标题处理。一套 deck 只选择一个主题样式，每页从该样式支持当前页面职责的方案中选择一个。

当前目录包含四种架构、六套候选样式，均处于 `candidate` 状态。系统蓝图包括白底电路、参数化波纹和银白玻璃；代表图见[浅色青蓝主题画廊](../assets/examples/theme-previews/index.html)。这些图片确认了单页风格，其他页面职责仍需按实际内容复核。新 CLI 草稿默认使用 `authoring` scope，审批沿用草稿范围；也可显式传入 `--scope active` 限定已晋升主题。允许规划候选主题不代表主题已经通过视觉评审。现有预览用于检查代表性页面，其余方案覆盖仍需逐项复核。

| 完整引用 | 视觉组织 | 适合内容 | 当前状态 |
|---|---|---|---|
| `editorial/paper-magazine`（纸面编辑） | 干净纸边、宋体标题、裁切摄影与印刷图解 | 行业观点、品牌故事、人物、出版物式图解 | `candidate` |
| `systems/white-cyan-circuit`（白底电路） | 冷白底、精细圆环与低对比度电路纹样 | AI 架构、流程、系统关系和数据关系 | `candidate` |
| `systems/white-cyan-wave`（参数化波纹） | 浅蓝平滑曲线、稀疏粒子与清晰的信息层级 | AI 架构、流程、系统关系和数据关系 | `candidate` |
| `systems/silver-glass`（银白玻璃） | 通透玻璃模块、银白空间与钴蓝重点 | AI 架构、流程、系统关系和数据关系 | `candidate` |
| `campaign/bold-poster`（朱红海报） | 单一朱红色场、强字级对比、实物裁切与硬光投影 | 发布、品牌传播、商品主视觉和产品叙事 | `candidate` |
| `cinematic/natural-film`（日常电影） | 自然曝光、真实动作、连续镜头与环境留白 | 场景叙事、交接、空间体验和人物关系 | `candidate` |

每套候选样式包含代表性视觉方案。编辑叙事提供 `magazine-cover`、`editorial-statement`、`documentary-hero`、`profile-feature`、`editorial-diagram`、`comparison-spread` 和 `collage-scene`；系统蓝图提供 `keynote-cover`、`system-map`、`circuit-flow`、`data-overview`、`comparison-matrix`、`signal-quote`、`ui-concept` 和 `isometric-space`；品牌传播提供 `poster-claim`、`product-studio`、`campaign-comparison`、`campaign-flow`、`campaign-data` 和 `campaign-signal`；影像叙事提供 `film-opening`、`human-moment`、`film-comparison`、`film-journey`、`film-evidence` 和 `quiet-ending`。

方案中的 `title_treatment` 只规定本页标题的处理方式。它可以是 `hero`、`statement`、`caption` 或 `integrated`，所以 PPT 不需要每页都放一个超大标题。`exact_text` 仍是页面唯一可见文字来源，方案名称、摘要、预览图和装饰性编号不会进入生成提示词。

Awesome 的图片分类用于帮助选择主题架构，不直接变成全局主题。UI、图表和系统关系优先使用 `systems`；出版物、摄影、插画和人物叙事优先使用 `editorial`；品牌传播、商品和海报优先使用 `campaign`；建筑、场景和沉浸式写实画面优先使用 `cinematic`。真实产品 UI、品牌资产、人物身份和有来源的数据继续使用用户提供的素材或经过确认的资料。

旧版 `business-minimal`、`editorial`、`launch-tech` 和 `premium-dark` 仍保存在 `image-themes.json` 中，供 v2 项目兼容读取。v3 resolver 不会把这些短 ID 静默改写成新引用；迁移应使用明确的项目级迁移流程。

## 选择与连续性

浅色青蓝系列共享冷白背景、蓝色重点、深色文字和低对比度装饰。`systems/white-cyan-circuit` 使用细圆环与边缘电路纹样，并保留旧引用兼容；`systems/white-cyan-wave` 使用平滑参数化曲线和稀疏粒子；`systems/silver-glass` 使用通透模块、银白边缘和柔和阴影。一套演示选择一种样式并保持连续，用户明确要求对照时可以逐页比较。中心圆环与三个节点属于本次样张的构图，后续页面仍按真实关系选择流程、比较或数据布局。

纸面编辑适合观点、人物和研究叙事。摄影裁切、标题字级和印刷色建立辨识度，纸纹保持轻微。选择它时，应为逐页内容提供具体摄影或图解对象；目录中的笔记本样张不是后续页面的默认主体。

朱红海报适合发布与传播。默认采用朱红、暖白、墨黑，单页保留一种主色。主张页可以放大文字，流程和数据页需要保留标签与比例。用户给出品牌配色时使用品牌色，并在同一套演示中保持连续。

日常电影适合空间、人物关系与行动叙事。时间、光源、动作和地点从内容确定；夜景仍可使用，但保留中间调。数据页给平面图表独立的中性区域，摄影只提供情境。人物与地点需要跨页一致时使用确认过的参考图。

各方案的完整 ID、角色、安全区与 `candidate` 状态保持有效。各方案预览共用所属样式的当前代表图，用于识别风格，不代表每个方案均已完成视觉验收。六套当前图片见[主题画廊](../assets/examples/theme-previews/index.html)。

## 图片文字与当前预览

各主题默认采用一个简洁主标题和必要内容标签、数值及单位。用户已提供的副标题等文字属于 `exact_text`，完整保留；主题不自行新增文字层级。生成来源与复核结果记录在图片外。

纸面编辑通过明确摄影裁切、宋体与干净纸边建立层次；朱红海报通过主体尺度、色块和投影形成传播焦点；日常电影通过自然光、具体动作和景别变化推进内容。标题与图像各有清楚区域，分析页优先保证关系与数值可读。

浅色系列代表图沿用本次已确认内容，用于比较材质、纹样与明暗关系。数据页仍要求正投影、共同基线和准确端点，背景装饰不得参与数值编码。
