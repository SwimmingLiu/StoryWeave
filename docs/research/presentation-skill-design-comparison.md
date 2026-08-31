# 三个演示文稿 Skill 的设计与视觉逻辑

## 调研范围

本文分析三个公开仓库的固定版本：

| Skill | 固定提交 | 提交日期 | 主要产物 |
| --- | --- | --- | --- |
| [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | [`c91369c`](https://github.com/op7418/guizang-ppt-skill/tree/c91369c449d34755d320a8b81d0734000d99d1ab) | 2026-08-07 | 带演讲者模式的横向 HTML 演示 |
| [ppt-master](https://github.com/hugohe3/ppt-master) | [`65bb2eca`](https://github.com/hugohe3/ppt-master/tree/65bb2eca59a36270819caba377097910c4466c6e) | 2026-08-22 | 可编辑的原生 PPTX，以及模板工作区 |
| [frontend-slides](https://github.com/zarazhangrui/frontend-slides) | [`9906a34`](https://github.com/zarazhangrui/frontend-slides/tree/9906a34d640d2111f724544cbc50f7f130569ae1) | 2026-06-23 | 固定舞台的单文件 HTML 演示 |

分析依据包括各仓库的 `SKILL.md`、工作流文档、模板、视觉索引、运行时代码、转换脚本和校验脚本。README 中的产品描述只用于理解作者意图，能力边界以源码和工作流为准。

## 结论摘要

这三个 Skill 对“生成演示文稿”采用了三种不同的理解：

| Skill | 一句话概括 | 它首先解决的问题 |
| --- | --- | --- |
| guizang-ppt-skill | 有明确作者审美的演讲系统 | 如何稳定地产出像同一位设计师完成、并且可以直接上台使用的网页演示 |
| ppt-master | 演示文稿编译与生产系统 | 如何把内容、设计意图、模板结构和 PowerPoint 对象组织成可验证、可编辑的 PPTX |
| frontend-slides | 视觉试样驱动的共同设计流程 | 用户说不清审美时，如何通过三张真实预览找到视觉方向，再扩展成完整 HTML 演示 |

它们的差别不只是输出格式不同。guizang-ppt-skill 通过限制选择保护风格；ppt-master 通过分离语义、设计和执行阶段控制复杂度；frontend-slides 通过视觉比较让用户参与审美决策。

## guizang-ppt-skill

### 系统如何设计

guizang-ppt-skill 不是 Markdown 到 PPT 的自动转换器。它由三部分组成：

1. `SKILL.md` 规定需求澄清、叙事规划、主题选择、页面生成和检查顺序。
2. `references/` 提供主题、组件、页面骨架、图片槽位和演讲者模式契约。
3. 两个 seed HTML 提供导航、动效、WebGL/ASCII 背景、演讲者视图和观众屏同步；校验脚本检查生成结果。

官方流程是先选择 Style A 或 Style B，再复制对应的完整模板，从登记的页面骨架中选择合适结构并替换内容，最后执行静态检查、浏览器渲染检查和演讲排练。[需求与生成流程](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/SKILL.md#L67-L100)明确要求先确认风格、受众、时长、素材、图片和主题色；[模板复制步骤](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/SKILL.md#L177-L193)说明两个 HTML 已经包含完整运行时。

因此，它更接近“Agent 执行的设计规约”，而不是一个输入内容后自动求解版式的程序。Agent 仍需要理解内容、选择页面类型、填写 HTML、观察页面并迭代。

### 核心理念

第一条理念是用约束保护设计质量。主题不能任意输入 HEX，Style B 的正文页不能临时发明结构，图片必须先选择标准槽位，页面底部需要给导航留下安全区。作者默认 Agent 容易在局部调整中破坏整套风格，所以把经验写成硬规则和 validator。[Swiss layout lock](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/references/swiss-layout-lock.md#L1-L18)直接限制正文页使用登记的 S01–S22 版式。

第二条理念是把 deck 看成有节奏的演讲，而不是一组独立页面。电子杂志风要求 light、dark 和 hero 页面交替；瑞士风要求长 deck 覆盖足够多的不同结构。每 3–4 页出现一个 hero、章节页或 statement 页，承担停顿、转折和重新聚焦的作用。[主题节奏规则](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/SKILL.md#L279-L291)禁止连续三页以上使用同一明暗主题。

第三条理念是把观众页面和演讲者讲述分成两条信息通道。页面只保留当前结论、结构和证据；备注补充背景、例子、判断依据和转场。稳定的 `data-slide-id` 用来关联备注，避免页面重排后备注串页。[演讲备注契约](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/references/presenter-mode.md#L32-L72)把 `purpose`、`talk`、`transition` 和时长作为独立字段。

第四条理念是动效需要表达页面语义。流水线逐步点亮、KPI 柱生长、时间线节点依次出现、环路描线，都对应信息关系；不是为所有页面套同一种淡入。[Swiss 动效注册表](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/assets/template-swiss.html#L2761-L2822)为不同页面结构指定不同 recipe。

### 视觉逻辑

它包含两套彼此独立的视觉语言。

#### Style A：电子杂志与电子墨水

- 字体承担层级：衬线大标题和金句建立情绪，非衬线正文承担说明，等宽字体标记编号和元数据。
- 色彩围绕 ink 与 paper 展开，同一套主题在明暗页面间切换。
- 图片是主要叙事材料，不是卡片装饰；版式优先保证人物、截图和主体不被错误裁切。
- WebGL 流体、等高线和色散只在 hero 页明显出现，普通内容页降低存在感。
- 页面节奏来自封面、章节幕封、数据大字报、大引用、问题页和内容页的交替。

作者将这套逻辑概括为“克制、结构、字体层级、图片和 hero 节奏”。对应原则见 [`SKILL.md`](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/SKILL.md#L594-L603)。视觉效果接近编辑杂志：重点来自字号、字体变化、图片和留白，而不是大量圆角卡片与阴影。

#### Style B：瑞士国际主义

- 全程无衬线；大字使用轻字重，小字提高字重，形成“越大越细、越小越粗”的阶梯。
- 一份 deck 只有一个高饱和 accent，不能同时混用 IKB 蓝、柠檬黄和安全橙。
- 所有元素依附网格，强调左对齐、非对称留白、直角色块和 1px hairline。
- 禁止渐变、阴影和圆角，避免退化成常见的 PowerPoint 卡片风格。
- 页面先映射到时间线、三层结构、循环、矩阵、数据塔、规格表等信息模型，再填入内容。
- 图片被视为证据块，先确定 S22、S15 或 S16 的槽位和比例，再处理素材。

这套逻辑追求“结构显性化”。颜色只建立焦点，hairline 负责分层，留白建立张力，动效展示结构形成的顺序。对应视觉原则见 [`SKILL.md`](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/SKILL.md#L605-L615)。

### 演讲运行时

演讲者模式是这个 Skill 的另一项主要设计。按 `P` 后，当前窗口成为控制台并打开观众窗口；控制台显示当前页、下一页、备注、计时和排练记录。它还支持自动翻页、激光笔、圈选、黑屏、白屏、冻结和观众屏重连。同步同时使用 `postMessage`、`BroadcastChannel` 和 `storage` 事件，并维护心跳和恢复状态。[同步实现](https://github.com/op7418/guizang-ppt-skill/blob/c91369c449d34755d320a8b81d0734000d99d1ab/assets/template.html#L1132-L1187)说明它把现场故障恢复也当作产品能力。

### 取舍

它获得了统一审美、明确页面节奏和完整演讲体验，代价是品牌自由度和布局自由度较低。它不适合大表格、培训型高密度课件和多人协作编辑。仓库虽称为单文件 HTML，但网络字体、Lucide、Motion fallback、MapLibre 或外部图片仍可能形成运行时依赖；“单文件”更准确地指主要演示逻辑集中在一个 HTML 中。

## ppt-master

### 系统如何设计

ppt-master 把演示文稿生成设计成一组有明确入口、阶段和产物所有权的工作流。顶层先路由到四种 artifact lifecycle：Generate PPTX、Create Template、Fill Native PPTX、Enhance Native PPTX。每条路线拥有独立的前置条件、修改方式和输出合同，不能同时加载多个顶层流程。[路由矩阵](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/workflows/routing.md#L29-L36)体现了这种划分。

默认生成路线大致是：

`材料 → 事实研究 → 项目初始化 → 模板候选 → 沟通与模板确认 → 完整方案 → 图片获取 → SVG 页面 → 质量检查 → PPTX 导出`

这条流程不是为了增加步骤，而是把几类容易混淆的问题分开：事实从哪里来、这份演示要改变受众什么、视觉系统是什么、哪些属性必须保持稳定、页面如何实现、最终 PPTX 是否可编辑和有效。

### 核心理念

第一条理念是让不同工件只负责一种真相。

- `design_spec.md` 保存受众、沟通目的、内容策略、色彩、字体、页面清单、图片和备注要求。
- `spec_lock.md` 只投影跨页稳定的执行锚点，例如画布、核心色彩、字体角色、页面节奏、图片路径和模板结构。
- `svg_output/` 是页面视觉的完整源：页面上能看到的文字、图像、形状和图表 fallback 都必须在 SVG 中存在。
- PPTX 导出器把 SVG 映射为 DrawingML 和其他原生对象，不允许在导出阶段凭空补充页面内容。

这项边界在 [SVG page-design contract](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/workflows/generate-pptx.md#L28-L39)中有明确说明。它接近编译器的分层：Design Spec 是设计意图，Spec Lock 是稳定接口，SVG 是页面中间表示，PPTX 是编译结果。

第二条理念是把“如何论证”和“画面长什么样”分开。PPT Master 将 mode 定义为论证方式，将 visual style 定义为形状语言、装饰密度、留白节奏、字体性格和表面质感；颜色和图片渲染又分别管理。[Visual Styles Index](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/references/visual-styles/_index.md#L1-L10)明确要求 visual style 不决定页面载体和图片来源。

第三条理念是让模板的可复用内容拥有清楚边界。它把模板拆成四类独立合同：

| 模板类型 | 负责的内容 |
| --- | --- |
| Brand | 颜色、字体、Logo、语气和图标风格 |
| Style | 沟通方法、视觉语言、构图节奏和信息表达 |
| Layout | 与品牌无关的 Master/Layout、页面类型、槽位和 SVG roster |
| Deck | 具有身份、结构和固定应用场景的完整演示家族 |

这四类不是继承层级。对应边界见 [Template Resources](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/templates/README.md#L3-L33)。这种拆分允许一个项目组合企业 Brand、通用 Layout 和某种 Style，同时保持谁覆盖谁的规则明确。

第四条理念是先表示关系，再选择视觉形式。页面结构从 `order`、`link`、`parent`、`membership`、`contrast`、`overlap` 等关系原子开始，再按 spine → nodes → connectors → labels → garnish 的顺序实现。对齐、分区和邻近已经能表达关系时，不增加连接线；装饰被放在最后，并且删除装饰后信息仍应成立。[Shape composition grammar](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/references/executor-structure.md#L9-L52)说明了这套视觉构造方法。

### 视觉逻辑

ppt-master 没有单一的作者风格。它的视觉逻辑是一组互相独立、最后组合的轴：

1. 沟通任务决定 mode 和页面顺序。
2. visual style 决定轮廓、空间、边界、质感和字体性格。
3. Brand 或项目规则决定颜色、字体和标识。
4. Layout/Deck 决定是否存在可复用的 PowerPoint Master、Layout 和 placeholder。
5. 页面内容决定使用照片、插图、原生形状、图表还是表格。
6. Executor 根据关系语义完成最终构图，并保留对 PowerPoint 原生对象的转换能力。

当前视觉目录包含 Swiss minimal、editorial、data journalism、brutalist、zine、paper cut、dark tech、blueprint、ink wash 等 18 类风格，但它们是生成词汇，不是固定页面菜单。系统先根据受众任务、观看距离、信息密度、载体和交付后的编辑需求选择，再只读取选中的详细规则。[选择边界](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/references/visual-styles/_index.md#L75-L104)说明行业或关键词不能直接决定风格。

共享视觉标准偏向清楚的层级、对齐、留白、自然换行和最轻的有效边界。边界强度按“间距/对齐 → 细线/括号 → 色块 → 描边 → 填充面板 → 浮层”递进；只有语义需要时才提高边界强度。这使它能够使用卡片、阴影或复杂形状，但不把这些形式设为默认答案。

### 质量控制与原生 PPTX

PPT Master 要求主 Agent 逐页手工构造 SVG。第一页完成后执行 first-page gate，用它判断方法层偏差；其余页面连续生成，完成后执行 final quality gate。[第一页与最终检查](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/workflows/generate-pptx.md#L705-L737)避免在每个小修改后反复运行检查器。

最终导出读取 `svg_output/`，将支持的形状、文本、公式、图表和表格映射为 PowerPoint 对象，生成 PPTX 并执行 package postflight。[导出契约](https://github.com/hugohe3/ppt-master/blob/65bb2eca59a36270819caba377097910c4466c6e/skills/ppt-master/workflows/generate-pptx.md#L821-L866)要求最终质量报告与当前 SVG 匹配，否则导出失败。其目标是让 PPTX 中的内容尽量保持原生可编辑，而不是把整页截图放进 PowerPoint。

### 取舍

它的优势是原生 PPTX、可编辑对象、品牌/风格/布局复用、明确的模板边界和强验证链路。代价是工作流很重：默认路线有两阶段用户确认、Design Spec、Spec Lock、图片准备、SVG authoring、多个质量门和 postflight。对快速制作一份网页演示来说，这些步骤显得过度；对需要长期维护、企业模板、原生编辑和可审计交付的项目，它们能减少隐式假设。

## frontend-slides

### 系统如何设计

frontend-slides 是一套“Agent 设计导演 + 浏览器交付协议”。它没有一个统一的 deck 编译器；主要资产是 Skill 工作流、基础舞台 CSS、HTML 参考架构、12 个安全预设、34 个 Bold Design System、动效参考和导出脚本。

新建演示时，流程先确认用途、页数、素材和内容密度。若用户提供图片，Agent 先检查图片可用性，让图片与文字共同决定页面大纲，而不是在文字排完后再补图片。[图片参与大纲](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md#L114-L126)体现了这种共同设计方式。

随后生成三张真实封面预览：一个安全预设、至少一个 Bold Template 和一个 wildcard。预览必须使用真实演示内容，不能出现“Option A”“模板”或内部工作流标签。用户选中后，Agent 才读取选定的完整设计文档并扩展全套页面。[风格探索流程](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md#L130-L198)是整个系统的中心。

### 核心理念

第一条理念是 show, don't tell。它假设非设计师难以准确描述字体、空间和气氛，但能够比较三张实际页面。因此用户做的是视觉判断，不是抽象参数配置。

第二条理念是避免平均化的生成设计。规则要求选用有性格的字体、占主导的颜色、清楚的 accent、能够形成氛围的背景和少量高影响动效；同时明确排斥系统字体、白底紫色渐变、通用卡片阵列和缺少语境的设计。[Design Aesthetics](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md#L18-L36)要求每份演示提出一条明确的视觉论点。

第三条理念是渐进披露。Bold Template Pack 不会把 34 套完整设计规则同时加载给模型。Agent 先读取含 mood、tone、best_for、avoid_for、formality、density 和 scheme 的紧凑索引；候选阶段只读 `preview.md`；用户选中后只读取一个 `design.md`。这样可以减少上下文占用和多套视觉语法混用。[模板加载规则](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/bold-template-pack/README.md#L6-L26)说明了这一过程。

第四条理念是把演讲稿和阅读稿当成两种密度问题。低密度模式强调一页一个观点、大字号和 1–3 个要点；高密度模式使用网格、表格、标注和 4–6 个结构化模块。如果内容放不下，应拆页而不是继续缩小字号。[密度模式](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md#L54-L63)把这项选择放在内容发现阶段。

### 视觉逻辑

frontend-slides 的视觉系统由三层组成：

1. 12 个安全预设提供字体、色值、版式和 signature elements，保证有一条稳定路径。
2. 34 个 Bold Design System 提供更具体的视觉世界，例如 Retro Windows、Retro Zine、Editorial Tri-Tone、8-Bit Orbit、Vellum 和 Raw Grid。
3. wildcard 允许 Agent 根据当前内容设计一套新系统，但必须能够扩展到章节、内容、引用、比较和收尾页面。

选定风格后，Agent 保留字体角色、色板、装饰词汇、间距节奏、网格和组件语法，但不复制模板示例内容。模板在这里不是母版页面集合，而是一份设计 recipe。一个设计系统可以把 grotesque 用于结构、italic serif 用于强调、mono 用于元数据，也可以把窗口 chrome、纸张标签、pill 或 halftone 设为贯穿全 deck 的共同语法。

动效也按感受组织：电影感对应慢淡入、缩放与视差；科技感对应 glow、glitch、粒子和网格；专业感使用短而克制的转场；编辑感偏向文字错峰和图文交错。[动效映射](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/animation-patterns.md#L5-L51)更像创意提示，而不是 guizang-ppt-skill 那样按页面语义锁定 recipe。

### 固定舞台与交付

所有页面在 1920×1080 舞台中设计，浏览器只对整个舞台等比缩放；手机也不重排内容，允许出现黑边。[Fixed Stage Rules](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md#L38-L52)把导演构图的一致性放在网页响应式阅读之前。

最终 HTML 支持键盘、触控、滚轮、页码和默认内联编辑。编辑模式使用 `contenteditable` 和 localStorage，用户可以直接修改文字并保存。PDF 导出则通过浏览器逐页截图，因此动画、交互和可访问文本层不会进入 PDF。

### 取舍

它的优势是审美探索直观、风格范围广、浏览器动效自由、交付轻量。代价是最终质量较依赖 Agent：`html-template.md` 中部分导航函数仍是占位参考，仓库没有完整视觉回归测试系统；每份生成结果仍需要截图检查溢出和面板重叠。PPTX 转换只提取普通文本、图片和备注再重新设计，不保留原母版、图表语义、SmartArt、动画或几何位置。[PPTX 提取脚本](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/scripts/extract-pptx.py#L18-L75)体现了这个边界。

## 横向比较

| 维度 | guizang-ppt-skill | ppt-master | frontend-slides |
| --- | --- | --- | --- |
| 设计控制方式 | 固定两套作者风格，并用硬规则限制偏移 | 将沟通、视觉、品牌、结构和执行拆成独立合同 | 先生成三张视觉试样，让用户选择或混合 |
| “风格”的含义 | 一整套不可混用的字体、颜色、布局、动效和节奏 | 一个独立视觉轴，只负责形状、空间、质感与字体性格 | 一份可扩展的 recipe，由 token、字体角色、组件和气氛组成 |
| 内容到版式 | 从 10 个叙事页型或锁定的 S01–S22 中选择 | 先表示关系和页面任务，再由 Executor 构造 SVG 或套用显式 Layout | 根据选定视觉系统自由设计各页面，但必须保持同一语法 |
| 防止风格漂移 | 禁止项、固定主题、版式编号、语义动效和 validator | Design Spec、Spec Lock、模板合同、第一页/最终质量门 | 渐进加载单一 `design.md`，并通过截图 QA 检查 |
| 动效 | 页面语义驱动，Motion/WebGL 与 presenter runtime 深度结合 | 可选的 PowerPoint 转场、对象动画、音频和视频阶段 | 氛围驱动，以 CSS 动效和浏览器交互为主 |
| 编辑方式 | 修改 HTML；演讲备注可在控制台维护 | PowerPoint 中编辑原生文本、形状、图表、表格和模板结构 | 浏览器内联编辑 HTML 文字，保存到 localStorage 或文件 |
| 现场能力 | 最完整：演讲者视图、观众屏、排练、计时、标注和恢复 | 侧重 PPTX 生产；现场能力主要交给 PowerPoint | 基础导航、触控、speaker notes 事件和可选网页交互 |
| 适用任务 | 风格鲜明的现场分享、发布会和观点型演讲 | 企业 PPTX、可编辑交付、模板复用、数据和长期维护 | 需要快速探索风格的网页 pitch、talk、教学和创意分享 |

## 如何理解三者的视觉路线

如果把三个系统放在一条轴上，左侧是“设计师已经决定风格”，右侧是“和用户共同发现风格”，中间是“把视觉决策拆成可组合的工程合同”：

`guizang-ppt-skill：风格纪律 → ppt-master：设计系统工程 → frontend-slides：视觉共同设计`

guizang-ppt-skill 最像一本带运行时的品牌手册。它回答“怎样始终做出这种味道”。

ppt-master 最像编译器和出版生产系统。它回答“怎样把复杂意图可靠地变成原生、可编辑、可验证的 PowerPoint”。

frontend-slides 最像设计工作坊。它回答“当用户不知道自己喜欢什么时，怎样通过真实视觉样本找到方向并继续设计”。

三者没有统一的优劣顺序。选择取决于最终交付：现场演讲优先考虑 guizang-ppt-skill；原生 PPTX、企业模板和可维护性优先考虑 ppt-master；网页动效、快速试风格和轻量分享优先考虑 frontend-slides。
