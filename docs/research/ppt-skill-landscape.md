# PPT 生成 Skill 竞品研究与整合建议

> 研究日期：2026-07-19  
> 证据范围：仅使用各项目仓库的 README、SKILL.md、参考文档和源码等一手资料。链接固定到核查时的 commit。  
> 标注规则：**事实**表示仓库明确声明或源码可验证；**推断**表示根据实现作出的保守判断；**未找到**表示在核查材料中没有找到对应能力，不能据此断言项目永远不支持。

## 一、先给结论

这 14 个项目不是同一类产品，不能简单地把功能相加。它们可分为六层：

| 层 | 代表项目 | 核心价值 |
|---|---|---|
| 内容与论证 | academic-pptx-skill、editable-leadership-pptx | 把材料变成适合演讲/决策的叙事，而不是只做排版 |
| 风格发现与模板 | frontend-slides、beautiful-html-templates、html-ppt、GordenPPTSkill | 风格路由、预览选择、版式和模板资产 |
| 原生可编辑 PPTX | anthropics/skills pptx、ppt-master、presentation-skill、MiniMax pptx-generator | PptxGenJS、OOXML、DrawingML、模板填充、图表与 QA |
| HTML 演示 | guizang-ppt-skill、html-ppt-skill、frontend-slides、beautiful-html-templates | 动画、交互、演讲者视图、网页分享 |
| HTML 编辑与 PPTX 导出桥 | dashi-ppt-skill | 结构化页面组件、浏览器内修改与持久化、HTML/PDF/可编辑 PPTX 导出 |
| 整页图片式 | codex-ppt-skill、wuming-cyan-circuit-launch-ppt | 用生图模型获得最高视觉自由度，但页内元素不可编辑 |

因此，更好的 Skill 应先明确**交付契约**，而不是把所有实现混在一条流水线里：

1. `editable-html`：默认交付；可离线演示，并能在本机浏览器持续修改文字、布局属性和图片。
2. `exported-pptx`：从同一 HTML/状态导出的派生产物；尽量保持文本和基础对象可编辑，并披露截图回退。
3. `visual-image`：仅在用户明确选择时使用整页生图；适合概念发布和视觉叙事，但页内元素不可编辑。

结合用户当前目标，第一版应把 `editable-html` 设为唯一主 renderer，以简洁单页、浏览器修改和插图为核心。“原生文本/图表 + 可选 AI 主视觉”应作为资产策略，不再作为另一套 renderer。关键事实不能只存在于 AI 图片里，生成图必须可删除、可替换、可追溯。

## 二、14 个项目逐项对比

### 1. guizang-ppt-skill

固定版本：[82fe5ae](https://github.com/op7418/guizang-ppt-skill/tree/82fe5ae129e8c2a12e1155fcabed6703342749d6)

- **功能（事实）**：生成单文件、横向翻页 HTML 演示；支持键盘、滚轮、触屏、ESC 索引、Motion One 动效、WebGL/canvas 背景、低性能静态模式；另含 PPT 配图、截图美化、多平台封面和瑞士风静态校验器。[README](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/README.md) · [SKILL.md](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/SKILL.md) · [校验器](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/scripts/validate-swiss-deck.mjs)
- **风格（事实）**：两套封闭视觉系统：A「电子杂志 × 电子墨水」，有 5 套主题和 10 种布局；B「瑞士国际主义」，有 IKB、柠檬黄、柠檬绿、安全橙 4 套锚点色和 22 个锁定版式。两套风格不可混用。[主题 A](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/references/themes.md) · [主题 B](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/references/themes-swiss.md)
- **PPT 类型（事实）**：线下分享、行业讲话、私享会、AI 产品发布、demo day、观点/人文叙事、产品与方法论分析；不适合大表格、高密度培训课件和多人协作编辑。
- **原理（事实）**：复制完整 HTML 种子模板，按预定义布局骨架填充内容；CSS、翻页 JS、WebGL shader 和动画 runtime 已内嵌；图片绑定到比例明确的槽位；最后人工浏览并运行规则校验。核心交付不是 `.pptx`。[README 的 HTML 原理说明](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/README.md#为什么是-html-ppt)
- **图片生成（事实）**：**可选，不是必需**。仓库明确提到 Codex 中可用 `GPT-Image 2.0` / `GPT-M 2.0` 生成照片、信息图、流程图、系统关系图和 UI 情景图，也可完全不生成图片。[配图提示词](https://github.com/op7418/guizang-ppt-skill/blob/82fe5ae129e8c2a12e1155fcabed6703342749d6/references/image-prompts.md)
- **边界（事实）**：README 明确说当前主流程不导出 PPTX；可把 HTML 当视觉稿再转换，但不是现有能力。

### 2. GordenPPTSkill

固定版本：[7d4a61c](https://github.com/GordenSun/GordenPPTSkill/tree/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33)

- **功能（事实）**：从内置中文 `.pptx` 模板或用户模板选页、替换文字、更新原生 chart 数据并输出可编辑 PPTX；提供文本容量估算、出框提示、同级字号约束、模板渲染预览和增量更新机制。[SKILL.md](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/SKILL.md) · [构建脚本](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/scripts/build_pptx.py)
- **风格（事实）**：当前模板索引列出 21 套，包括极简商务、党政红、卡通教学、Y2K 酸性、多彩几何、大厂/麦肯锡、架构图、数据可视化、运营汇报、竞聘述职和三种学术开题风格。[模板索引](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/templates/INDEX.md)
- **PPT 类型（事实）**：年度/季度总结、商务提案、述职竞聘、开题答辩、教学课件、党政教育、架构/流程、运营、财务/销售/HR、咨询战略、数据可视化。
- **原理（事实）**：模板目录用 `detail.json` 描述每页角色、文本 slot、容量、字号层级和图表；AI 写 `edits.json`；`python-pptx` 复制所选页面并修改 XML/文字/原生 chart，尽量不动原排版；LibreOffice + Poppler 渲染 PNG 做目测 QA。[编辑 schema](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/references/pptx-edit-schema.md) · [工作流](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/references/workflow.md)
- **图片生成（未找到）**：没有 AI 生图后端或模型绑定。模板中的图片和设计被保留，图片型图表只能保留或整张替换。
- **注意（事实）**：仓库和内置模板声明仅限个人学习研究、禁止商业用途；这会直接影响整合和分发。[README](https://github.com/GordenSun/GordenPPTSkill/blob/7d4a61cbd8363b92e4a30784f8ca460a0a2b0a33/README.md)

### 3. html-ppt-skill

固定版本：[f3a8435](https://github.com/lewislulu/html-ppt-skill/tree/f3a8435d3901697d5ac5e64d356c933637e43107)

- **功能（事实）**：纯静态 HTML/CSS/JS 演示；36 主题、15 套完整 deck、31 种单页布局、27 个 CSS 动画、20 个 Canvas FX；支持键盘导航、主题轮换、总览、notes 抽屉和带当前页/下一页/逐字稿/计时器的演讲者窗口；可用 headless Chrome 导出 PNG。[中文 README](https://github.com/lewislulu/html-ppt-skill/blob/f3a8435d3901697d5ac5e64d356c933637e43107/README.zh-CN.md) · [SKILL.md](https://github.com/lewislulu/html-ppt-skill/blob/f3a8435d3901697d5ac5e64d356c933637e43107/SKILL.md)
- **风格（事实）**：36 个 CSS token 主题，包括 minimal-white、editorial-serif、soft-pastel、sharp-mono、Catppuccin、Dracula、Tokyo Night、Nord、Solarized、neo-brutalism、glassmorphism、Bauhaus、Swiss Grid、terminal-green、小红书白、Blueprint、Memphis、Cyberpunk、Y2K、Vaporwave、日式极简、corporate-clean、academic-paper、news-broadcast、pitch-deck-vc、magazine-bold 等。[主题目录](https://github.com/lewislulu/html-ppt-skill/blob/f3a8435d3901697d5ac5e64d356c933637e43107/references/themes.md)
- **PPT 类型（事实）**：投资人 pitch、产品发布、技术分享、周报、小红书 3:4 图文、教学模块、带逐字稿的演讲；另有技术图谱、架构蓝图、安全警示、生活方式等完整视觉 deck。[完整 deck 目录](https://github.com/lewislulu/html-ppt-skill/blob/f3a8435d3901697d5ac5e64d356c933637e43107/references/full-decks.md)
- **原理（事实）**：`base.css` 提供共享 token/组件，单主题 CSS 覆盖 token，单页 HTML 提供布局，runtime 通过 class 切换管理页面；演讲者预览使用加载同一 deck 的 iframe 和 `BroadcastChannel`/`postMessage` 同步，避免重复渲染。
- **图片生成（未找到）**：无 AI 生图流程或指定模型。支持用户图片、image hero/grid 和 CSS 占位视觉；没有图片也能完整运行。
- **输出边界（事实）**：主交付是 HTML，可导出 PNG；仓库未提供原生可编辑 PPTX 导出。

### 4. ppt-master

固定版本：[8876ff3](https://github.com/hugohe3/ppt-master/tree/8876ff320d0b19a04b62f0600dae99c49c7693e5)

- **功能（事实）**：从 PDF、DOCX、网页、PPTX、表格等输入生成原生可编辑 PPTX；支持生成新 deck、创建 Brand/Layout/Deck 模板工作区、填充原生 PPTX、增强现有 PPTX；可生成图表/表格、转场、元素动画、备注、音频旁白和视频相关产物。[README](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/README_CN.md) · [路由规则](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/skills/ppt-master/workflows/routing.md)
- **风格（事实）**：不是固定风格库，默认自由设计，也支持显式模板工作区。官方示例展示杂志/建筑摄影、新闻财经仪表盘、瑞士网格、毛玻璃 SaaS、孟菲斯波普、Risograph Zine 等；这些是示例，不是完整风格上限。[示例区](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/README_CN.md)
- **PPT 类型（事实）**：商务汇报、论文精读、研究/学术、发布会、数据新闻、模板填充和旧 deck 美化；画布还覆盖 16:9、4:3、小红书、朋友圈/IG、Story/TikTok、微信头图、Banner 和 A4。[画布规格](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/skills/ppt-master/references/canvas-formats.md)
- **原理（事实）**：先做材料抽取和 Strategist 设计规范，再由 Executor 手写每页 `svg_output/`；转换器将 SVG 中的文本、形状、图片、图表/表格映射为 DrawingML/原生对象并输出 `.pptx`；另有 Fill Native PPTX 的 OOXML 路线。工作流明确区分 Generate、Create Template、Fill Native PPTX、Enhance Native PPTX 四条生命周期。[生成管线](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/skills/ppt-master/workflows/generate-pptx.md)
- **图片生成（事实）**：**可选，但官方推荐高视觉要求场景使用**。AI 生图脚本支持 Gemini、OpenAI 兼容、MiniMax、Qwen、智谱、豆包 Seedream、ModelScope、Stability、BFL FLUX、Ideogram、SiliconFlow、fal.ai、Replicate、OpenRouter；当前默认示例包括 `gpt-image-2` 和 `gemini-3.1-flash-image-preview`。另可搜索 Openverse、Wikimedia、Pexels、Pixabay。[图片生成说明](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/skills/ppt-master/references/image-generator.md) · [后端注册源码](https://github.com/hugohe3/ppt-master/blob/8876ff320d0b19a04b62f0600dae99c49c7693e5/skills/ppt-master/scripts/image_gen.py)
- **边界（事实）**：AI 图片不是 PPTX 的生成原理；它只是 SVG 页面中的一种素材。标准输出仍是可编辑 DrawingML。

### 5. frontend-slides

固定版本：[9906a34](https://github.com/zarazhangrui/frontend-slides/tree/9906a34d640d2111f724544cbc50f7f130569ae1)

- **功能（事实）**：从零生成单文件 HTML 演示，或提取 `.pptx` 的文字、图片、备注并重设计成网页；先生成 3 个真实标题页预览让用户选风格；支持浏览器内联编辑、动画、响应式等比缩放、Vercel 部署和 PDF 导出。[README](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/README.md) · [SKILL.md](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md)
- **风格（事实）**：12 个安全预设：Bold Signal、Electric Studio、Creative Voltage、Dark Botanical、Notebook Tabs、Pastel Geometry、Split Pastel、Vintage Editorial、Neon Cyber、Terminal Green、Swiss Modern、Paper & Ink；另整合 beautiful-html-templates 的 34 个 bold design systems，并允许第 3 个预览是自生成 wildcard。[风格预设](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/STYLE_PRESETS.md) · [bold 索引](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/bold-template-pack/selection-index.json)
- **PPT 类型（事实）**：pitch、talk、发布、教学、叙事型演示；也能把任意 PPTX 转成同内容/顺序/图片/备注的 HTML deck。内容密度显式分为 speaker-led 低密度与 reading/self-contained 高密度。
- **原理（事实）**：先解析内容和图片，再从安全预设、bold index 和自定义设计中生成 3 个独立 HTML 预览；选定后只加载一个完整设计 recipe，生成固定 1920×1080 舞台并统一缩放；PPTX 转换使用 `python-pptx` 提取而不是保留原生对象。[PPTX 提取脚本](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/scripts/extract-pptx.py)
- **图片生成（未找到）**：支持用户提供图片和无图 CSS 视觉，但没有 AI 生图模型/API。PPTX 转换会保留并复用原图。
- **输出边界（事实）**：输出 HTML；PDF 是 Playwright 对每页截图后合成的静态产物，不是可编辑 PPTX。[PDF 脚本](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/scripts/export-pdf.sh)

### 6. beautiful-html-templates

固定版本：[e5e204f](https://github.com/zarazhangrui/beautiful-html-templates/tree/e5e204fb1f3b06290846e7dcd7aceddabeceec8c)

- **功能（事实）**：这是 HTML slide 模板库和 agent 操作手册，不是完整的通用 Skill runtime。`index.json` 用 mood、occasion、tone、formality、density、scheme、best_for 等元数据帮助 agent 匹配 3 个候选；选定后克隆模板、替换内容，并按同一设计系统扩展缺失版式。[AGENTS.md](https://github.com/zarazhangrui/beautiful-html-templates/blob/e5e204fb1f3b06290846e7dcd7aceddabeceec8c/AGENTS.md) · [index.json](https://github.com/zarazhangrui/beautiful-html-templates/blob/e5e204fb1f3b06290846e7dcd7aceddabeceec8c/index.json)
- **风格（事实）**：34 套：8-Bit Orbit、Biennale Yellow、BlockFrame、Blue Professional、Bold Poster、Broadside、Capsule、Cartesian、Cobalt Grid、Coral、Creative Mode、Daisy Days、Editorial Forest、Editorial Tri-Tone、Emerald Editorial、Grove、Long Table、Mat、Monochrome、Neo-Grid Bold、People's Platform、Pin & Paper、Pink Script、Playful、Raw Grid、Retro Windows、Retro Zine、Sakura Chroma、Scatterbrain、Signal、Soft Editorial、Stencil & Tablet、Studio、Vellum。[README gallery](https://github.com/zarazhangrui/beautiful-html-templates/blob/e5e204fb1f3b06290846e7dcd7aceddabeceec8c/README.md)
- **PPT 类型（事实）**：模板元数据覆盖 founder/investor pitch、board/consulting、研究综合、品牌宣言、文化/艺术、发布会、课程、季度复盘、社区/生活方式等；模板被定义为“tone”，不是行业专用模板。
- **原理（事实）**：先按元数据筛选，再用用户真实标题生成 3 个封面预览；选中后把模板作为封闭视觉系统扩展，禁止跨模板拼接；HTML 运行方式随模板保留，部分使用共享 `deck-stage.js`。
- **图片生成（未找到）**：没有 AI 生图服务；仅规定替换同尺寸图片占位符。没有图片的模板也可依靠 CSS/排版成立。
- **边界（事实）**：它不负责 PPTX 解析、原生 PPTX 输出、内容研究或通用 QA 管线，适合作为上层 Skill 的风格资产包。

### 7. codex-ppt-skill

固定版本：[c54ccdf](https://github.com/ningzimu/codex-ppt-skill/tree/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834)

- **功能（事实）**：把文章、报告、论文、笔记或大纲转为整页图片式 PPT；包含大纲确认、风格/后端确认、单页样张审批、逐页生成、强制素材映射、逐页状态、QA/局部重绘、演讲稿与备注写入、PPTX 组装和个人风格库。[SKILL.md](https://github.com/ningzimu/codex-ppt-skill/blob/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834/skills/codex-ppt/SKILL.md)
- **风格（事实）**：12 种：清爽专业、创意杂志、电子墨水杂志、数据仪表盘、复古扁平插画、手绘技术解释、手绘白板、温暖手工、科研答辩、麦肯锡、党政红、教学课件；也可从图片/PDF/PPT/PPTX 分析并保存个人风格。[README](https://github.com/ningzimu/codex-ppt-skill/blob/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834/README.md)
- **PPT 类型（事实）**：技术分享、科研/论文答辩、教学、数据仪表盘、党政汇报、杂志式强视觉演示等。
- **原理（事实）**：每页必须由确定的生图后端生成一张完整 16:9 位图；`assemble_ppt.py` 再把整页图嵌入 PPTX，并写入 `speech.md` 备注。页面内部元素默认不可编辑。[组装脚本](https://github.com/ningzimu/codex-ppt-skill/blob/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834/skills/codex-ppt/scripts/assemble_ppt.py)
- **图片生成（事实）**：**必需**。优先 Codex `image_gen` / OpenClaw `image_generate`；CLI fallback 默认 `gpt-image-2`，支持 OpenAI 兼容接口、AtlasCloud 和自定义模型；真透明背景建议 `gpt-image-1.5`。[后端选择](https://github.com/ningzimu/codex-ppt-skill/blob/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834/skills/codex-ppt/docs/backend-selection.md) · [CLI fallback](https://github.com/ningzimu/codex-ppt-skill/blob/c54ccdff86abf61d4aef7672bd0c4a5fa5c7c834/skills/codex-ppt/docs/cli-api-fallback.md)
- **未找到**：没有使用 “Chat Image” 或 “Image Two” 作为正式服务名；仓库明确写的是 `gpt-image-2` 和 host 的 image tool。

### 8. academic-pptx-skill

固定版本：[9f2b703](https://github.com/Gabberflast/academic-pptx-skill/tree/9f2b703ffe8d1449851617665ab1ffb3516d54ac)

- **功能（事实）**：它是学术内容/叙事规范层，不是独立 PPTX 引擎。核心包括 action title、SCR/漏斗/答案先行结构、ghost deck test、每页一个论点/展品、图上直接标结论、页内引用和参考文献、学术专项 QA。[SKILL.md](https://github.com/Gabberflast/academic-pptx-skill/blob/9f2b703ffe8d1449851617665ab1ffb3516d54ac/SKILL.md) · [内容指南](https://github.com/Gabberflast/academic-pptx-skill/blob/9f2b703ffe8d1449851617665ab1ffb3516d54ac/content_guidelines.md)
- **风格（事实）**：`Structured Argument`（学术默认）和 `Visual / Narrative`（科普、非专业受众、活动演讲）。默认白底、单一无衬线、最多三色、无装饰图标、内容页不使用满版背景图。
- **PPT 类型（事实）**：会议论文报告、seminar、硕博答辩、论文章节、基金汇报、实验室会议、受邀讲座、政策简报、咨询式研究汇报、公众科学传播。
- **原理（事实）**：先规划逐页论证和 exhibit，再与 Anthropic 内置 PPTX skill 协作完成技术生成；技术依赖沿用 PptxGenJS、markitdown、LibreOffice、Poppler。[README](https://github.com/Gabberflast/academic-pptx-skill/blob/9f2b703ffe8d1449851617665ab1ffb3516d54ac/README.md)
- **图片生成（事实）**：**不需要**，没有指定生图模型/API；还明确反对装饰性 stock image、clip art，要求尽量从论文数据重绘图表。

### 9. anthropics/skills 中的 pptx

固定版本：[fa0fa64](https://github.com/anthropics/skills/tree/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/pptx)

- **功能（事实）**：通用 PPTX/POTX 创建、读取、解析、编辑、模板填充、拆分/合并、增删重排、备注与评论；提供缩略图、复制页、孤立资源清理、LibreOffice 转换及 OOXML/关系/图表校验。[SKILL.md](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/pptx/SKILL.md)
- **风格（事实）**：无固定模板库；给出 Midnight Executive、Forest & Moss、Coral Energy、Warm Terracotta、Ocean Gradient、Charcoal Minimal、Teal Trust、Berry & Cream、Sage Calm、Cherry Bold 等配色方向，并提供通用排版规则。
- **PPT 类型（事实）**：行业不受限的通用 deck、pitch deck 和模板型演示。
- **原理（事实）**：新建主要使用 PptxGenJS；已有 PPTX/POTX 通过解包 ZIP、编辑 OOXML、重新打包；markitdown 读取内容，自带脚本校验。PowerPoint 有原生形式时优先保留可编辑对象。
- **图片生成（未找到）**：没有独立 AI 生图服务或指定模型。图像、icon、背景可作为素材；图标可经 SVG/Sharp 转 PNG。

### 10. editable-leadership-pptx

固定版本：[392d404](https://github.com/CamelKing1997/editable-leadership-pptx/tree/392d4043f63c38aaae748fbeea34ae563d114925)

- **功能（事实）**：创建/修订完全可编辑的 16:9 领导层 PPT；从项目仓库、实验输出、模型和评估数据抽取证据，制作前后对比、图表、架构图；支持旧 deck 重制和渲染/溢出/越界/字体/素材格式 QA。[SKILL.md](https://github.com/CamelKing1997/editable-leadership-pptx/blob/392d4043f63c38aaae748fbeea34ae563d114925/SKILL.md)
- **风格（事实）**：默认 white-first、flat、低饱和、留白充分、文本极简；封面/结尾可谨慎用深色品牌背景；另有 premium `Apple-Keynote aesthetic`。[executive 规则](https://github.com/CamelKing1997/editable-leadership-pptx/blob/392d4043f63c38aaae748fbeea34ae563d114925/references/executive-pptx-rules.md) · [Apple Keynote](https://github.com/CamelKing1997/editable-leadership-pptx/blob/392d4043f63c38aaae748fbeea34ae563d114925/references/apple-keynote-aesthetic.md)
- **PPT 类型（事实）**：领导层/业务进展汇报、执行层决策材料、技术证明页、项目/模型更新，也支持把截图式 deck 重做为可编辑 PPT。
- **原理（事实）**：不强制单一引擎，可用已有生成器、PptxGenJS、Python 或混合链路；文本、形状、时间线、状态和简单图表保持原生，复杂图表/显著性图/架构图才转 PNG/SVG；交付前必须真实渲染检查。
- **图片生成（未找到）**：没有 AI 生图模型或 API；图片主要来自现有素材或真实数据生成的复杂图表/图示。

### 11. presentation-skill

固定版本：[3a22eed](https://github.com/sirilsengolraj-source/presentation-skill/tree/3a22eed290fa2205b6a1e2de5549b4429c5fffd0)

- **功能（事实）**：从 prompt、`outline.json`、本地数据或保存的 workspace 创建、编辑、重设计、渲染和验证可编辑 PPTX；有 16 种内容版式、13 套 preset、8 种 deck grammar、约 2,200 条风格描述语料、311 个可组合 style atom 和三层 QA。[README](https://github.com/sirilsengolraj-source/presentation-skill/blob/3a22eed290fa2205b6a1e2de5549b4429c5fffd0/README.md) · [SKILL.md](https://github.com/sirilsengolraj-source/presentation-skill/blob/3a22eed290fa2205b6a1e2de5549b4429c5fffd0/SKILL.md)
- **风格（事实）**：13 presets：executive-clinical、bold-startup-narrative、data-heavy-boardroom、sunset-investor、forest-research、midnight-neon、paper-journal、arctic-minimal、charcoal-safety、lavender-ops、warm-terracotta、lab-report、editorial-minimal。8 grammars：Answer Pyramid、Evidence Plate、Care Pathway、Editorial Spread、Thesis Stage、Operating Grid、Public Docket、Telemetry Canvas。[设计哲学](https://github.com/sirilsengolraj-source/presentation-skill/blob/3a22eed290fa2205b6a1e2de5549b4429c5fffd0/references/design_philosophy.md)
- **PPT 类型（事实）**：lab/clinical/scientific report、board memo、investor update、policy brief、editorial brief，以及数据图表、表格、科学图版 deck。
- **原理（事实）**：`outline.json` 是源代码；脚本把语义角色路由到 preset、variant 和 composition grammar；主要用 PptxGenJS 生成可编辑对象，Python renderer 用于 legacy/niche 情况；几何、渲染和 placeholder QA 通过后交付。
- **图片生成（事实）**：**可选**。若使用 generated imagery，必须记录 `prompt/model/purpose`，且删除图片不能破坏叙事；没有绑定特定供应商或模型，真实数据图/原图优先。

### 12. MiniMax-AI/skills 中的 pptx-generator

固定版本：[60aaae5](https://github.com/MiniMax-AI/skills/tree/60aaae52bb2af8162732751a4332f62a5fef518b/skills/pptx-generator)

- **功能（事实）**：读取/分析 PPTX、从模板编辑、从零创建；markitdown 读取、OOXML 模板编辑、PptxGenJS 新建；逐页 JS 模块生成后统一编译，并包含主题合同、页码、字体/间距/图表规则和 QA。[SKILL.md](https://github.com/MiniMax-AI/skills/blob/60aaae52bb2af8162732751a4332f62a5fef518b/skills/pptx-generator/SKILL.md)
- **风格（事实）**：4 种几何/留白 recipe：Sharp & Compact、Soft & Balanced、Rounded & Spacious、Pill & Airy；18 套配色覆盖 Modern & Wellness、Business & Authority、Vintage & Academic、Vibrant & Tech、Tech & Night、Education & Charts、Elegant & Fashion、Pure Tech Blue、Platinum White Gold 等。[设计系统](https://github.com/MiniMax-AI/skills/blob/60aaae52bb2af8162732751a4332f62a5fef518b/skills/pptx-generator/references/design-system.md)
- **PPT 类型（事实）**：封面、目录、章节、内容、总结五种页面骨架；场景覆盖企业、年报、金融、政府、学术、教育、市场、产品发布、品牌、旅游、医疗。[页面类型](https://github.com/MiniMax-AI/skills/blob/60aaae52bb2af8162732751a4332f62a5fef518b/skills/pptx-generator/references/slide-types.md)
- **原理（事实）**：每页导出 `createSlide(pres, theme)`，`compile.js` 加载各页模块并由 PptxGenJS 生成 16:9 PPTX；现有模板走 XML 修改。
- **图片生成（未找到）**：可插入普通图片，但没有 AI 生图服务、模型或 API 规定，也没有绑定 MiniMax 自家图片模型。

### 13. wuming-cyan-circuit-launch-ppt

固定版本：[20915a2](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/tree/20915a2dcf775f937b53258007d09a5412c8d2ff)

- **功能（事实）**：将长内容压缩为短标题、短标签和少量说明，生成一张 16:9「青蓝电路发布会 PPT」风格图片；也可只输出生图 prompt。[SKILL.md](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/SKILL.md)
- **风格（事实）**：仅一套：白/浅蓝高留白，青蓝、蓝绿、深蓝灰，电路线、HUD 圆环、编号节点、细线连接、线性图标、轻量几何；排除暗黑霓虹、赛博海报、密集大屏和设备广告。
- **PPT 类型（事实）**：单页封面、目录、流程、对比、矩阵、架构、数据概览、观点总结；适合产品发布、会议封面、技术概念、AI/Skills 方法论。
- **原理（事实）**：LLM 先提炼内容和组织 prompt，再调用 `imagegen` skill / 内置 `image_gen` 生成位图。
- **图片生成（事实）**：直接出图时**必需**；用户只要 prompt 时不调用。没有指定底层图片模型。
- **边界（事实）**：仓库只生成一张 PPT 风格图片，没有组装多页 `.pptx` 的代码，不能视为完整 PPT 生成器。[README](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/README.md)

### 14. dashi-ppt-skill

固定版本：[fdbb145](https://github.com/chuspeeism/dashi-ppt-skill/tree/fdbb145517ea0e289000aef9b7906bcb3e0cd19a)

- **功能（事实）**：把自然语言需求整理成 JSON 计划，从预置页面组件中选页并生成可离线打开的 HTML deck；浏览器内可点击改字、替换/拖入图片和视频、调组件数量/布局/配色/重点、选择 9 种转场、拖拽排序、跳过/删除/复制页面，并导出 HTML、截图式 PDF 和可编辑 PPTX。仓库登记了 12 套主题、1020 个页面组件和 8576 个控件；后两项可由 12 个主题 metadata 汇总验证。[README](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/README.md) · [SKILL.md](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/SKILL.md) · [主题注册](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/src/components/themes/index.jsx)
- **风格（事实）**：轻拟态、炫光紫绿、深浅代码、玻璃糖果、色谱图表、深色图谱、冷白调研、黑金实验、深蓝杂志、金色指数、高能增长、声波霓虹 12 套。主题 metadata 还给出适用场景和受众，可用于风格路由；例如冷白调研对应调研/白皮书/竞品/学术政策表达，深蓝杂志对应品牌故事/人物访谈/企业形象册。[冷白调研 metadata](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/src/components/themes/theme07/metadata.js) · [深蓝杂志 metadata](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/src/components/themes/theme09/metadata.js)
- **PPT 类型（事实）**：行业研究、融资复盘、竞品分析、趋势报告、项目汇报、方案展示、路演、内部培训；页面角色覆盖封面、目录、章节、指标、趋势、对比、分布、关系、案例、图像、流程、风险、行动、结果和结尾，并内置雷达、瀑布、矩形树图、漏斗、热力图、桑基图、甘特图及 SWOT、波特五力、PEST、商业模式画布、双钻等版式。[页面角色](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/src/deckComposer.jsx)
- **原理（事实）**：`goal.json` 以 `themePack + slides[].layout + slides[].props` 表示 deck；layout registry 将每页映射到 React 主题组件，构建脚本把组件 runtime、view model 和资产写入静态 `index.html`。默认策略是“锁模板填文案”，只改公开 props，不让 Agent 自由手写 slide HTML。导出时以 Playwright 打开真实 DOM，再用 PptxGenJS 做逐节点映射；复杂区域走截图回退，同时从 live DOM 重新抽取文字，因此文字仍可编辑，但不能保证 HTML 的全部交互/视觉在 PPTX 中都保持原生。[Goal schema](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/references/goal-spec.schema.json) · [view model](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/src/view-model/index.jsx) · [导出说明](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/packages/html-deck-to-pptx/README.md)
- **在线修改（事实）**：这是本机预览服务中的浏览器编辑，不是云端多人协作。编辑状态包含 `slideOrder / skippedSlides / deletedSlides / duplicatedSlides / text / props`；小草稿写入 `localStorage`，含大媒体时回退 IndexedDB；预览服务通过 `/api/save-deck-state` 把状态原子回写进 `index.html` 的 view-model JSON，上传的 data URL 媒体会落到 `assets/user-media/`。`file://` 可编辑但不能把改动自动写回文件；局域网页面只允许浏览，导出接口仅本机可用。[持久化源码](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/scripts/persist-deck-state.mjs) · [预览服务路由](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/scripts/serve-preview-https.mjs)
- **图片生成（事实）**：**可选且只作为素材来源**。用户必须明确要求生图；Codex 环境调用宿主 `image-gen`，生成图片先落入本次 deck，再写入公开媒体槽。仓库未绑定具体图片模型或 API，也不允许把空槽或伪造路径当作交付结果。[媒体工作流](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/SKILL.md#媒体工作流)
- **Codex / QoderWork 集成（事实与未找到）**：npm 安装器会自动探测 `~/.codex/skills`、`~/.claude/skills`、`~/.agents/skills` 和 `~/.config/agents/skills`，也支持 `--dir <skills-root>`；`agents/openai.yaml` 提供 Codex/OpenAI Skill 的展示名、图标和默认 prompt。因此 Codex 是明确支持的 Skill 目录安装，不是独立浏览器插件。[安装器](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/npm-dist/install.mjs) · [OpenAI metadata](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/agents/openai.yaml) **未找到** QoderWork 名称、专用 manifest 或已实测声明；若 QoderWork 能读取标准 `SKILL.md`、读写文件并执行 Node/shell，可用 `--dir` 指向其 skills 目录是合理推断，但不能标为已验证支持。
- **许可证（事实）**：仓库主体是 AGPL-3.0；但 `project/packages/html-deck-to-pptx` 当前是专有组件，只能作为 Dashi Skill 的集成部分使用，禁止单独提取、复制、修改或用于其他产品。其 README 中仍出现 MIT/open-core 的旧描述，与当前 LICENSE 冲突；整合判断应以目录 LICENSE 和根 README 的明确例外为准。[根许可证](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/LICENSE) · [导出引擎许可证](https://github.com/chuspeeism/dashi-ppt-skill/blob/fdbb145517ea0e289000aef9b7906bcb3e0cd19a/skills/dashi-ppt/project/packages/html-deck-to-pptx/LICENSE)

## 三、图片生成依赖总表

| 项目 | AI 生图地位 | 明确模型/服务 | 结论 |
|---|---|---|---|
| guizang-ppt-skill | 可选集成 | `GPT-Image 2.0`、`GPT-M 2.0` | 无图也能生成 HTML deck |
| GordenPPTSkill | 未集成 | 未找到 | 模板图保留/替换，不负责生图 |
| html-ppt-skill | 未集成 | 未找到 | 用户图片或 CSS/Canvas 视觉 |
| ppt-master | 可选、成熟集成 | OpenAI `gpt-image-2`、Gemini、MiniMax、Qwen、GLM-Image、Seedream、FLUX 等 | 生图是素材来源，不是 PPTX 原理 |
| frontend-slides | 未集成 | 未找到 | 用户图或 CSS 视觉；PPTX 原图可提取 |
| beautiful-html-templates | 未集成 | 未找到 | 纯模板库 |
| codex-ppt-skill | **必需** | host `image_gen` / `image_generate`；fallback `gpt-image-2` | 每页都是生成位图 |
| academic-pptx-skill | 不需要 | 未找到 | 偏好真实研究图表，反对装饰 stock 图 |
| anthropics pptx | 不需要 | 未找到 | 通用 PPTX 底座 |
| editable-leadership-pptx | 不需要 | 未找到 | 真实数据和可编辑对象优先 |
| presentation-skill | 可选、供应商无关 | 未指定 | 要求记录 prompt/model/purpose |
| MiniMax pptx-generator | 不需要 | 未找到 | 普通图片素材可插入 |
| wuming | 直接出图时**必需** | host `imagegen`，底层模型未指定 | 只生成单页位图或 prompt |
| dashi-ppt-skill | 可选、按用户意图 | Codex host `image-gen`；未绑定模型/API | 图片写入 HTML 媒体槽，HTML/编辑/PPTX 导出均不依赖生图 |

关于用户示例里的名称：这些仓库明确出现的是 `gpt-image-2`、`GPT-Image 2.0`、`GPT-M 2.0` 或 host 的 `image_gen`。**未找到 “Chat Image” 或 “Image Two” 作为统一、正式的后端名**，整合时不应把口语称呼硬编码成 provider。

## 四、如何整合成更好的 PPT Skill

### 4.1 用统一中间表示隔离“内容、设计、编辑状态和导出”

用户已明确选择 HTML-first。建议用 `deck_spec.yaml`/JSON 保存 Agent 生成的内容与版式意图，再用独立的 `editor_state.json`（或嵌入 HTML 的 JSON block）保存浏览器修改；不要让模型直接手写整份 HTML，也不要把编辑结果只留在 DOM：

```yaml
deck:
  title: "..."
  audience: "executives"
  purpose: "decision"
  output_mode: "editable-html"
  canvas: "ppt169"
  density: "speaker-led"
  style_id: "executive-editorial"
slides:
  - id: s01
    role: cover
    claim: "一句话结论"
    evidence: []
    layout: hero
    assets: [img_cover]
    speaker_notes: "..."
assets:
  img_cover:
    source: generated
    prompt: "..."
    model: "gpt-image-2"
    purpose: hero
    removable: true
editor_state:
  slide_order: [s01]
  deleted_slides: []
  text_overrides: {}
  prop_overrides: {}
```

第一版只需要一个 HTML renderer，其他格式是 exporter，而不是平行维护的三套页面实现：

| 模块 | 借鉴来源 | 输出 |
|---|---|---|
| `html-renderer` | html-ppt + frontend-slides + guizang + dashi | 可离线演示、可在浏览器编辑的 HTML deck |
| `html-editor` | dashi | 文本、props、图片、排序/复制/删除及持久化 |
| `pptx-exporter` | 自研 DOM→PptxGenJS/OOXML；参考 Dashi 的行为边界 | 尽可能可编辑的 `.pptx`，并报告回退为图片的区域 |
| `pdf/image-exporter` | frontend-slides + dashi | 静态 PDF/逐页 PNG |

这样只维护一套页面语义、主题 token 和编辑模型。未来如确有整页生图需求，再新增 `image-deck` 兼容层；不能让它成为默认路径，也不能把不可编辑页面伪装成可编辑 PPTX。

### 4.2 把工作流拆成 8 个清晰阶段

1. **Intake**：识别输入类型、受众、用途、时长、语言、画布、编辑性要求。
2. **Strategist**：从 academic-pptx 和 leadership skill 吸收 action title、答案先行、证据链、每页一个论点、引用规则。
3. **Outline gate**：先确认逐页 `claim + evidence + exhibit`，再做视觉。
4. **Density gate**：默认 speaker-led，每页只保留一个结论、一个主要视觉和最少支撑文字；只有用户明确要求自读型报告才提高密度。
5. **Style discovery**：借鉴 frontend-slides/beautiful-html，只生成 3 个使用真实标题的封面预览，不让用户面对几十个名称盲选。
6. **Asset planning**：每张图片明确 `user/search/generated/chart/icon` 来源、比例、许可、用途、替代文本和是否承载事实。
7. **Render + edit**：先生成 1-2 页代表性样张；确认后批量生成，并通过本机服务把浏览器编辑可靠回写到 deck。
8. **QA + export**：结构校验、溢出/越界、字体、图片缺失、占位符、引用、事实、视觉截图；导出 PPTX 时另做对象可编辑率和包校验。

### 4.3 风格系统不要做成“大列表”，要做成可检索元数据

可以吸收 beautiful-html 的 `mood / tone / formality / density / scheme / best_for / avoid_for`，再加 PPT 特有维度：

- `output_modes`：该风格支持 html、pptx-export、pdf、image-first 哪些交付形式。
- `canvas`：16:9、4:3、3:4、1:1 等。
- `content_fit`：数据、学术、产品、叙事、教学、党政、品牌。
- `layout_coverage`：cover、agenda、section、data、comparison、timeline、architecture、image、closing。
- `asset_dependency`：none / user-image / search / generation-required。
- `editability_score` 与 `density_range`。
- `license` 与 `provenance`。

用户只看到三个真实预览；Skill 内部才使用完整索引排序。选定设计系统后应像 frontend-slides 一样**只加载一个 recipe**，禁止跨模板拼接。

风格去重不能只按名称。建议把现有 Skill 的风格拆成 `palette + typography + geometry + surface + imagery + motion + density` 七类 token，做语义指纹后聚类。例如 Swiss Grid / Swiss Modern 合并为一个 family，Terminal Green / 代码风合并为一个 family，杂志/Editorial 系列合并为一个 family，再保留不同 recipe 作为 variant。第一版应只重做 6-8 个有明确差异的自有 family，不直接复制第三方 CSS、模板、预览图或版式源码；每个 family 记录来源启发和许可证审计结果。

### 4.4 图片模块采用策略接口，不绑定一个模型

```text
asset request
  -> user asset (优先)
  -> data visualization / programmatic diagram
  -> licensed image search
  -> AI generation
  -> CSS/shape fallback
```

建议借鉴 ppt-master 的 provider registry 和 presentation-skill 的追溯字段。统一接口至少记录：`provider`、`model`、`prompt`、`seed/reference`、`aspect_ratio`、`license`、`purpose`、`text_policy`、`fact_bearing`。

关键规则：

- 学术图、财务图、业务数据图优先程序化重绘，不用生图模型“画数据”。
- AI 图默认不承载唯一事实；关键文字和数字使用原生文本。
- 生图后端不可用时，默认的 `editable-html` 仍应以用户图片、程序化图形或纯版式降级；只有用户明确选择的 `visual-image` 模式才应中止并报错。
- 先按版式槽位确定比例，再生成图片。
- 对整页图片模式，必须在开始前提示“页内元素不可编辑”。

### 4.5 QA 应分为机器检查和视觉检查

整合各仓库后可形成六层 QA：

1. **内容**：每页是否有明确 claim，是否有无来源数字、残留占位符、重复结论。
2. **几何**：越界、重叠、文本溢出、安全边距、最小字号。
3. **设计系统**：颜色/font/token、同级字号、布局白名单、图片槽位和比例。
4. **资产**：缺图、坏链接、低分辨率、许可/署名、prompt/model 元数据。
5. **真实渲染**：逐页截图 + montage；代码校验不能替代视觉检查。
6. **编辑/导出**：刷新后编辑仍存在，媒体已落盘且路径可迁移；PPTX 检查文本/形状/图片对象数量、截图回退比例、OOXML relationship、孤立资源和打开/重存测试。

### 4.6 能力应以模块安装，而不是写成一个巨型 SKILL.md

建议目录：

```text
ppt-skill/
├── SKILL.md                  # 路由、全局契约、渐进加载
├── schemas/                  # deck_spec / style / asset / QA
├── workflows/
│   ├── generate.md
│   ├── fill-template.md
│   ├── redesign.md
│   └── enhance.md
├── strategists/
│   ├── academic.md
│   ├── executive.md
│   ├── pitch.md
│   └── teaching.md
├── renderers/
│   └── html/
├── editor/
│   ├── state-schema.json
│   ├── persistence/
│   └── media-slots/
├── exporters/
│   ├── pptx/
│   ├── pdf/
│   └── images/
├── styles/
│   ├── index.json
│   └── <style-id>/design.md
├── assets/
│   ├── search.md
│   ├── generation.md
│   └── providers/
└── qa/
    ├── semantic.md
    ├── geometry.md
    ├── visual.md
    └── package.md
```

主 `SKILL.md` 只负责路由和不可违背的契约；选定 workflow、strategist、style 和 exporter 后再渐进读取相应文件。这一点可直接借鉴 ppt-master 的 route authority 和 frontend-slides 的 progressive disclosure。Dashi 的“锁模板填公开 props”也值得采用：Agent 只写受 schema 约束的文案、数据和媒体槽，不直接修改主题组件源码。

## 五、建议的实施顺序

### Phase 1：先做简洁、可编辑的 HTML MVP

- 输入 Markdown/文档/大纲。
- 输出 `deck_spec.json` + 可离线打开的 HTML deck；每页默认一个结论、一个视觉、极少正文。
- 只做 8 个通用 layout：cover、section、statement、image-hero、two-column、data、comparison、closing。
- 先做 6 个去重后的自有 style family，例如 executive-clean、academic-structured、editorial、swiss-grid、code-terminal、launch-tech。
- 用 token + recipe + 公开 props 渲染页面，支持改字、换图、组件 props 调整、页面排序/复制/删除。
- 建立本机预览服务与自动保存；文件离线打开时至少保留浏览器草稿，并明确何时尚未写回文件。
- 做真实渲染、溢出、占位符、媒体路径和编辑持久化校验。

### Phase 2：加入风格发现、插图和主题迁移

- 建立 style metadata schema 和三个封面预览流程。
- 支持本地图片拖入/替换、媒体槽裁切和相对路径落盘。
- 将同一 deck 的语义 role/props 映射到另一主题的兼容 layout，实现整套换风格，而不是直接换 CSS 后祈祷布局成立。
- 把主题版权、来源、商用许可写进索引；**不要直接打包 Gorden 的非商用模板，也不要复制 Dashi 的主题组件或专有导出引擎**。

### Phase 3：加入可选生图与 PPTX 导出

- 先支持用户图片、程序化图表、开放许可搜索。
- 再接 provider-neutral AI image adapter。
- 每张生成图保存 manifest；生成后进入普通媒体槽，可替换/删除/局部重生成，不重做整套 PPT。
- 自研或采用许可证兼容的 HTML→PPTX 导出器；优先映射文本、形状、图片和简单图表，复杂视觉允许局部截图回退，并输出可编辑率/回退报告。

### Phase 4：补充高级演示与导入能力

- 加入演讲者视图、notes、动效和发布部署。
- 支持导入已有 PPTX 的文字、图片和备注后重设计为 HTML；不承诺保留原始对象级布局。
- 整页 image-first 只作为明确可选模式，使用 codex-ppt 的样张审批、逐页状态和组装逻辑，并在开始前提示不可编辑边界。

## 六、最值得直接借鉴的设计

| 设计 | 来源 | 为什么值得保留 |
|---|---|---|
| 先论证、后视觉；action title + exhibit | academic-pptx | 避免“好看但没有观点” |
| 三个真实封面预览 | frontend-slides / beautiful-html | 用户更容易用视觉做选择 |
| 模板 slot schema + 容量/字号层级 | GordenPPTSkill | 模板填充更稳定 |
| route authority + 渐进加载 | ppt-master | 控制巨型 Skill 的上下文和分支复杂度 |
| `outline.json`/grammar/style atom | presentation-skill | 内容角色与视觉规则可组合、可测试 |
| 通用 PPTX/OOXML 工具底座 | anthropics pptx / MiniMax | 不必重复造读写和校验轮子 |
| 样张审批 + page status + 局部重绘 | codex-ppt-skill | 昂贵生图任务可控、可恢复 |
| 演讲者视图 + 逐字稿 | html-ppt | HTML 演示的差异化价值 |
| `layout + props` 数据模型、浏览器编辑和自动保存 | dashi-ppt-skill | HTML 产物本身就是可持续修改的工作台 |
| DOM 逐节点导出 + 局部截图/文字回抽的降级思想 | dashi-ppt-skill | 兼顾 HTML 表现力与 PPTX 可编辑性；实现必须自研或取得许可 |
| 真实数据与可编辑性优先 | editable-leadership | 决策型 PPT 的可信度底线 |
| 生图 provider registry + 图片搜索降级 | ppt-master | 避免锁死在单一模型或 API |

## 七、最终建议

第一版不要追求“支持 100 种风格和所有输出”。按当前目标，最有竞争力的切入点是：

> **以 deck spec + editor state 为核心，默认生成内容简洁、可在浏览器持续修改的 HTML PPT；主题先语义去重再重做为自有 token/recipe，图片生成只是可替换媒体槽的一种来源，并通过独立 exporter 输出尽可能可编辑的 PPTX。**

这条路线同时吸收了 wuming 的低密度和生图简洁性、HTML Skills 的动效与交互，以及 Dashi 的结构化组件和浏览器编辑闭环，但不会继承整页图片不可修改、HTML 内容过密或千页模板难维护的问题。真正的产品壁垒不是主题数量，而是简洁内容策略、主题去重后的稳定布局契约、可靠持久化、可替换资产和透明的 PPTX 导出降级。
