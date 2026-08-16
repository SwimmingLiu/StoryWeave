# 图片主题目录

StoryWeave 的主题分为三层：主题架构决定整套 deck 的空间组织和阅读节奏，主题样式决定字体、颜色、材质和全局锚点，视觉方案决定单页的构图、媒介和标题处理。一套 deck 只选择一个主题样式，每页从该样式支持当前页面职责的方案中选择一个。

当前目录中的四套样式仍处于 `candidate` 状态，用于主题制作和 golden deck QA。普通项目使用 `active` scope；候选主题需要在草稿和批准命令中显式使用 `--scope authoring`。四套样式都已有基础 showcase；补充 coverage deck 用于验证其余视觉方案。

| 完整引用 | 视觉组织 | 适合内容 | 当前状态 |
|---|---|---|---|
| `editorial/paper-magazine` | 纸面、裁切图片、编辑式留白和有限色块 | 行业观点、品牌故事、人物、出版物式图解 | `candidate` |
| `systems/white-cyan-circuit` | 节点、路径、分组、浅色技术场和青蓝信号 | AI 架构、流程、系统关系、概念界面和数据关系 | `candidate` |
| `campaign/bold-poster` | 单一传播主体、平面色块、清晰主张和产品构图 | 发布、品牌传播、商品主视觉和产品叙事 | `candidate` |
| `cinematic/natural-film` | 自然光、镜头纵深、人物动作和安静留白 | 场景叙事、交接、空间体验和人物关系 | `candidate` |

每套候选样式包含代表性视觉方案。编辑叙事提供 `magazine-cover`、`editorial-statement`、`documentary-hero`、`profile-feature`、`editorial-diagram`、`comparison-spread` 和 `collage-scene`；系统蓝图提供 `keynote-cover`、`system-map`、`circuit-flow`、`data-overview`、`comparison-matrix`、`signal-quote`、`ui-concept` 和 `isometric-space`；品牌传播提供 `poster-claim`、`product-studio`、`campaign-comparison`、`campaign-flow`、`campaign-data` 和 `campaign-signal`；影像叙事提供 `film-opening`、`human-moment`、`film-comparison`、`film-journey`、`film-evidence` 和 `quiet-ending`。

方案中的 `title_treatment` 只规定本页标题的处理方式。它可以是 `hero`、`statement`、`caption` 或 `integrated`，所以 PPT 不需要每页都放一个超大标题。`exact_text` 仍是页面唯一可见文字来源，方案名称、摘要、预览图和装饰性编号不会进入生成提示词。

Awesome 的图片分类用于帮助选择主题架构，不直接变成全局主题。UI、图表和系统关系优先使用 `systems`；出版物、摄影、插画和人物叙事优先使用 `editorial`；品牌传播、商品和海报优先使用 `campaign`；建筑、场景和沉浸式写实画面优先使用 `cinematic`。真实产品 UI、品牌资产、人物身份和有来源的数据继续使用用户提供的素材或经过确认的资料。

旧版 `business-minimal`、`editorial`、`launch-tech` 和 `premium-dark` 仍保存在 `image-themes.json` 以及旧样例中，供 v2 项目兼容读取。v3 resolver 不会把这些短 ID 静默改写成新引用；迁移应使用明确的项目级迁移流程。
