# StoryWeave 视觉参考来源与生成方式

先按图像的实际内容选择生成方式。字体、配色、网格、卡片、表格、图表和普通流程使用 HTML、CSS、SVG。Imagegen 的主演示参考按整页筛选，需能承载标题、主张、内容分组与讲解关系，并体现连续技术插画、手绘、水墨、玻璃光照或黏土等视觉方法。独立物体与知识插画另存为配图资料。来源库称为 AI 图片库，不足以证明其中每个案例都适合整页生图。

[八种 HTML 原图画廊](../../tmp/research-theme-sources/visual-gallery/index.html)包含黑白编辑、森林纸张、手写便签、色块粗边框、日式复古、复古窗口、像素霓虹与柔和编辑。它们全部有可运行的 HTML 模板。全部 34 组的来源和分类保存在 [HTML 参考目录](../../design-library/html-template-references/README.md)，Imagegen 不收录这些模板预览。第三方截图保留在研究目录。

## 优先采用的 Skills 与模板

| 来源 | 可获取的材料 | 制作方式与用途 | 许可与适用范围 |
| --- | --- | --- | --- |
| [Beautiful HTML Templates](https://github.com/zarazhangrui/beautiful-html-templates) | 34 套模板，每套有设计说明、HTML、3 张截图和索引 | 全部归 HTML。包括 Pin & Paper、Sakura Chroma、Retro Windows、BlockFrame 和 Monochrome | 仓库 MIT；复制文件时保留许可，外部图片与字体按各自来源处理 |
| [Frontend Slides](https://github.com/zarazhangrui/frontend-slides) | 12 种预设、样式选择流程和 HTML 演示规则 | Swiss Modern、Notebook Tabs、Paper & Ink、Neon Cyber、Pastel Geometry 均优先由 HTML 实现 | MIT；保留可编辑文字和原生动效 |
| [Baoyu Skills](https://github.com/jimliu/baoyu-skills) | [slide-deck](https://github.com/jimliu/baoyu-skills/tree/main/skills/baoyu-slide-deck) 有 17 份样式文件；[infographic](https://github.com/jimliu/baoyu-skills/tree/main/skills/baoyu-infographic) 有 22 份样式、21 份布局文件 | 黑板文字、地铁图和网格归 HTML。只筛选有复杂主体的手绘教学、折纸剖面或黏土场景 | MIT；逐张判断，不能把样式与布局的组合数称为新增主题数 |
| [PPT Master](https://github.com/hugohe3/ppt-master) | [14 种任务与叙事方法](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/templates/styles/styles_index.json)、7 套布局集合、33 类 SVG 图表索引 | 补技术深讲、科研说明、商务决策和工作坊的页面组织。优先取 16:9 的 `presentation_core` 与 `editorial_bleed` | MIT；这些方法不等于 14 套视觉配色。其他比例布局需要改造后才能使用 |
| [Theme Factory](https://github.com/anthropics/skills/tree/main/skills/theme-factory) | 10 套字体与配色组合 | 用作主题配色和字型的备选来源，补森林、暖色、复古与中性色系 | 该 Skill 的 [LICENSE.txt](https://github.com/anthropics/skills/blob/main/skills/theme-factory/LICENSE.txt) 为 Apache-2.0；不是 10 套完整页面系统 |

本地 `frontend-slides` 已包含上述 34 套模板的索引。另有 [dreamid27/frontend-slides](https://github.com/dreamid27/frontend-slides) 整理 88 种结构布局与相同的 34 套模板，可补页型，但不能将复用的模板再计为新增主题。已安装的 [Guizang PPT](https://github.com/op7418/guizang-ppt-skill) 提供瑞士排版与电子杂志方向，和现有部分主题接近；其 AGPL-3.0 实现与本项目运行代码分开评估，不直接整体复制。

## 开源主题和图片案例库

| 来源 | 可获取的材料 | 建议补充方向 | 许可与取用方式 |
| --- | --- | --- | --- |
| [Slidev 官方主题与社区画廊](https://sli.dev/resources/theme-gallery) | [官方仓库](https://github.com/slidevjs/themes)列出 default、seriph、shibainu、bricks、apple-basic，附布局、示例与截图；社区目录提供更多主题 | `apple-basic` 的舞台极简、`bricks` 的几何色块、`shibainu` 的分区变化 | 根 [README](https://github.com/slidevjs/themes#license)明确代码 MIT，图片和素材 CC BY-NC-SA 4.0。不能将图片统一按代码许可重新分发 |
| [Marpstyle](https://github.com/cunhapaulo/marpstyle) | Socrates、Plato、Orwell、Jobs 等 CSS 主题、PNG 预览和完整示例 PDF | 学术讲座、书籍式排版、衬线长文与简洁报告 | [MIT](https://github.com/cunhapaulo/marpstyle/blob/main/LICENSE)；字体和示例中的第三方图片保留各自来源 |
| [reveal.js 主题](https://revealjs.com/themes/) | 官方列出 black、white、league、beige、night、serif、simple、solarized、moon、dracula、sky、blood，共 12 种；每种有独立样式表 | 深色代码、Solarized、衬线讲座与简洁高对比 | [MIT](https://github.com/hakimel/reveal.js/blob/master/LICENSE)；适合提取配色与字阶，不能把 12 个 CSS 主题直接当成 12 个完整 Imagegen 方案 |
| [Metropolis](https://github.com/matze/mtheme) | LaTeX Beamer 主题、完整 demo、表格、公式和图表页 | 克制的科研演讲、章节进度、图表重点和公式留白 | 官方 [demo PDF](https://ctan.math.illinois.edu/macros/latex/contrib/beamer-contrib/themes/metropolis/demo/demo.pdf)明确主题为 CC BY-SA 4.0；不需要把 LaTeX 引入项目运行时 |
| [Awesome GPT4o Images](https://github.com/jamez-bondos/awesome-gpt4o-images) | 原图、生成图、提示词及分类案例 | 海报、信息图、字体、图解、材质和图片编辑方法；先筛与知识分享有关的案例 | [LICENSE](https://github.com/jamez-bondos/awesome-gpt4o-images/blob/main/LICENSE)对原创内容声明 CC BY 4.0，并列有 `NOTICE-openai.md` 与单案例 `ATTRIBUTION.yml` 例外，按条目核对 |
| [YouMind Nano Banana Pro Prompts](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts) | 带预览与提示词的分类库，可筛教学、手绘、等距、水彩、水墨和图表 | 按实际图片筛选剖面、微缩场景与生物插画；普通图表归 HTML | 汇编声明 [CC BY 4.0](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/main/LICENSE)，README 说明材料来自社区。保留原作者与原帖，不能由汇编许可推定全部第三方图片的授权 |
| [Awesome Nano Banana Images](https://github.com/PicoTrex/Awesome-Nano-Banana-images) | 文档转流程图、文章转 PPT、手绘等距、历史报纸、角色关系、黑板粉笔等实际案例 | 补课堂分享、关系说明和故事页；适合作为发现来源的第二批材料 | README 标记 CC BY 4.0，而 [LICENSE](https://github.com/PicoTrex/Awesome-Nano-Banana-images/blob/main/LICENSE)正文为 Apache-2.0，存在不一致。先保留链接与分析，确定具体条目许可后再复制图片 |

图片库中的提示词记录了其他模型或版本上的案例，不能直接作为当前 Imagegen 效果证明。保留具体构图、媒介和文字要求，删去无关的模型参数，再用本项目内容实际生成和复核。模型以原作者或官方案例的明确归因为准，仓库名称不能证明图片版本。

## 先检查具体页面，再确定主题

以下页面提供了明确的构图样本，归入 HTML 参考侧。可借鉴页面职责与节奏，布局使用原生结构，图片素材独立处理。

| 样本 | 值得提取的方法 | 需要验证的差异 |
| --- | --- | --- |
| [Slidev Bricks 的 cover、items、fact、quote](https://github.com/slidevjs/themes/tree/main/packages/theme-bricks) | 同一几何语言对应不同页面职责，避免每页都使用同一标题骨架 | 大色块与中文正文的密度、对比和安全区 |
| [Slidev Apple Basic 的标题、照片、statement、fact](https://github.com/slidevjs/themes/tree/main/packages/theme-apple-basic) | 用低密度页面强调主张，单图、数字和引语有不同布局 | 图片留白、标题长度，以及连续多页是否显得单调 |
| [Marpstyle Plato 与 Orwell 示例](https://github.com/cunhapaulo/marpstyle#available-marpstyle-themes) | 科研讲座与衬线阅读稿的字阶、正文区与章节组织 | 中文字体替换，演讲模式下拆分密集正文 |
| [Metropolis 的表格、公式和图表页](https://ctan.math.illinois.edu/macros/latex/contrib/beamer-contrib/themes/metropolis/demo/demo.pdf) | 同一套留白与重点规则覆盖学术内容 | 用 HTML/SVG 保留原始数字、公式和几何关系；复杂科研插图按独立素材处理 |

真实演讲应整套保存上下文。[Apple 的 Presenting Design Work](https://developer.apple.com/videos/play/wwdc2018/811/)提供视频、逐字稿和完整 PDF；[Addy Osmani 的 Orchestrating Coding Agents](https://talks.addy.ie/oreilly-codecon-march-2026/overview/)提供 HTML、PDF 和讲者备注。它们适合分析开场、转场、逐步解释和收尾，原页面的开放访问不等于可以作为通用图片素材重新分发。

## 扩充演讲与分享稿的整页参考

主演示参考采用 [presentation-references](../../design-library/presentation-references/catalog.json)，现有 18 种视觉方向、41 张实际内容页，17 种具有多页参考。新增方向包括黑金运行叙事、角色引导技术讲解、协作白板、银白玻璃技术叙事、用户旅程分镜、漫画工程叙事、复古立体开发者、场景式平面图解、柔和彩绘讲解和像素世界流程。

来源包括 Baoyu Slide Deck、历史 nbp_slides、作者当前的 [presentation_skill](https://github.com/grapeot/presentation_skill)及 [nomie7/nano-banana-slides-prompter](https://github.com/nomie7/nano-banana-slides-prompter)。目录分别保存固定版本、页面来源、提示词范围和视觉查验。样式适配模型或项目级模型声明不等于逐图运行证明。

[页型覆盖](../../skills/storyweave-imagegen/assets/reference-library/coverage.json)按实际图片生成。现有观点 15 页、流程 21 页、对比 11 页、数据 8 页及架构 9 页，一页确实承担多种职责时可进入多个筛选，但图片总数只计算一次。水墨黑板与协作白板已包含观点、流程、对比和数据。其他组显示实际缺口，黑板粉笔仍只有一张可用横向内容页。

技术网格流程框、档案纸卡、普通指标卡、单纯换配色的仪表盘和封面继续归 HTML 参考或来源研究。原图从来源加载，运行包只携带目录与静态页面；不引入上游生成框架。扩成生成主题前，使用同一份中文内容检查各类页面及整套连续性，现有主题规则保持各自版本。
