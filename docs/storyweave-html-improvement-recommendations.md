# StoryWeave HTML 改进建议汇总

## 文档目的

这份文档汇总 `guizang-ppt-skill`、`ppt-master` 和 `frontend-slides` 三个 Skill 对 StoryWeave HTML 的可借鉴做法，并将它们转换成当前仓库可以执行的改进项。

建议基于以下固定版本的源码和文档：

| Skill | 固定版本 | 主要参考 |
| --- | --- | --- |
| guizang-ppt-skill | `c91369c449d34755d320a8b81d0734000d99d1ab` | 两套 HTML 模板、主题规则、页面骨架、Presenter 模式和校验脚本 |
| ppt-master | `65bb2eca59a36270819caba377097910c4466c6e` | 路由、Design Spec、Spec Lock、SVG 页面源和 PPTX 导出流程 |
| frontend-slides | `9906a34d640d2111f724544cbc50f7f130569ae1` | 风格预览、Bold Template、固定舞台、动效和 HTML 编辑流程 |

完整的源码比较见 [三个演示文稿 Skill 的设计与视觉逻辑](research/presentation-skill-design-comparison.md)。本文只保留与 StoryWeave HTML 实现直接相关的结论。

## 一、结论先行

StoryWeave HTML 已经具备一个可靠的主题合同层：canonical 主题使用 `architecture/style` 引用，审批会固化逐页 `visual_scheme_ref`，构建会校验主题和 deck 指纹，legacy 主题仍然可以兼容构建，页面也能独立打开。这些能力暂时不需要推翻。

当前最大的缺口在渲染层：四个 active style 的 `role_defaults` 使用同一组 scheme，`html.mjs` 对 canonical 页面生成的 DOM 骨架基本相同，主题差异主要由颜色、字体和少量 CSS 覆盖产生。`visual_brief`、`visual_anchor_id`、`continuity_group`、`hierarchy` 和 `density` 已经写进输入模型，但没有充分影响最终页面；素材登记也还没有形成“页面—图片槽位—裁切策略”的完整关系。

因此，下一阶段的目标不应是继续增加主题名称，而是让现有四套主题在不依赖颜色的情况下也能被辨认。优先级应放在四件事上：

1. 让 visual scheme 变成真正的页面渲染配方。
2. 让图片和其他素材在大纲阶段成为页面结构的一部分。
3. 让 16:9 舞台和几何检查成为稳定的输出基础。
4. 让阅读密度、页面节奏和语义动效真正进入规划与渲染。

## 二、当前 HTML 的基础和缺口

### 已经值得保留的部分

- `outline_draft.json` 和 `deck_spec.json` 已经分开承担草稿与审批后结果。
- `catalog.json` 已经建立 architecture、style、scheme 和 legacy migration 的关系。
- `resolveTheme()`、`resolveVisualPlan()` 和 `migrateOutline()` 提供了清晰的主题解析与迁移 seam。
- canonical build 已经拒绝未解析的 `auto`、跨主题 scheme、过期主题配方和过期 deck manifest。
- `index.html` 与 `slides/<slide-id>.html` 都是可独立打开的完整 HTML 页面。
- 素材 registry 已经记录哈希、尺寸、来源、许可证和生成事实边界。
- 结构、几何、浏览器和 manifest QA 已经能够阻断一部分错误。

### 当前需要解决的缺口

| 缺口 | 现状 | 影响 |
| --- | --- | --- |
| 主题渲染深度不足 | 不同 style 主要共用 `.copy`、`.art`、`.columns`、`.steps` 和 `.metrics` | 主题换色后仍像同一套模板，architecture 的空间语法没有落地 |
| scheme 没有成为配方 | scheme 主要决定 class 和少量布局覆盖 | `visual_scheme_ref` 变成标识字段，而不是可执行设计选择 |
| 页面元数据未充分消费 | `hierarchy`、`density`、`continuity_group` 和 `visual_brief` 很少进入 renderer | 规划信息和最终视觉之间存在断层 |
| 素材关系不完整 | registry 有资产记录，但 slide 没有明确 asset slot、裁切和焦点 | `image-hero` 无法稳定表达真实图片，图片难以参与大纲设计 |
| 舞台模型需要统一 | manifest 是 `1280×720`，CSS 同时使用 viewport 比例和 `clamp()` | 桌面、移动和导出时的构图规则不够明确 |
| QA 偏结构，视觉指标较少 | 能检查页面存在、主题身份和页面级溢出 | 标题间距、面板重叠、底部安全线和最小可读尺寸仍缺少系统测量 |
| 互动能力较轻 | runtime 只有前后翻页、键盘翻页和计数器 | 还没有可选的 speaker view、节奏控制或语义动效层 |

## 三、三个 Skill 各自应该吸收什么

### 1. 吸收 guizang-ppt-skill：设计纪律和演讲节奏

值得吸收的不是它的完整 HTML 模板，而是它把审美判断写成可执行约束的方式：

- 主题由有限的视觉系统组成，避免任意颜色和局部样式破坏整体。
- 页面由内容形状和叙事节奏决定，而不是每页都重复同一卡片结构。
- 动效需要解释内容关系，例如流程点亮、时间线展开和数据增长。
- Presenter、观众屏、计时和恢复属于播放层，不应污染页面生产源。
- 校验不止检查 DOM，还要检查真实渲染后的标题间距、底部安全区、页面空白和元素越界。

对 StoryWeave 的对应动作：

1. 把 `visual_scheme_ref` 映射到实际的 render recipe，而不是只映射到 CSS class。
2. 在 `RenderPlan` 中增加可选的 `motion_recipe_ref`，为流程、数据和对比页提供语义动效入口。
3. 把 viewer/presenter 作为消费 `storyweave-output.json` 的独立模块，保留当前 producer 的播放器无关性。
4. 将标题间距、内容高度、底部安全线和页面级重叠加入浏览器 QA。

不建议直接复制：完整的双窗口 Presenter runtime、WebGL 背景、两套封闭模板和大量现场控制按钮。它们适合独立播放层，不适合作为 StoryWeave HTML producer 的默认依赖。

### 2. 吸收 ppt-master：产物所有权和设计系统分层

值得吸收的是它对复杂性的分层，而不是照搬完整的 PPTX 工作流：

- 内容、设计意图、跨页稳定约束、页面源和导出结果分别拥有自己的职责。
- `mode`、visual style、Brand、Layout、Deck 互相独立，减少“主题名同时代表颜色、场景和版式”的歧义。
- 页面先识别关系和信息任务，再选择形状、网格、图表或表格。
- 页面视觉源必须包含所有可见内容，导出阶段不能凭空补内容。
- 质量门应在首个页面和全部页面两个层级工作，并且能验证来源是否过期。

对 StoryWeave 的对应动作：

1. 保持 `outline_draft` / `deck_spec` 作为现有输入与执行合同，不额外引入一对 Design Spec / Spec Lock 文件。
2. 在审批后生成一个内存中的 `RenderPlan`，把主题、scheme、布局、素材槽位、节奏和动效整理成一个小接口。
3. 让 renderer module 隐藏每个 style 的复杂实现，CLI 和 manifest 只处理稳定字段。
4. 为页面关系增加轻量语义字段，例如顺序、对照、分组、层级和焦点，不把这些判断埋在 CSS 选择器里。
5. 保留 deck、theme、scheme 和 renderer 的指纹，确保主题实现变化能触发重建。

不建议直接复制：默认路线的两阶段确认、完整的 `design_spec.md` / `spec_lock.md` 文件体系，以及为原生 PPTX 设计的 SVG-to-DrawingML 结构。StoryWeave 当前目标是独立 HTML；重复建立同样的文档层会增加接口数量，却不一定提升 HTML 质量。

### 3. 吸收 frontend-slides：视觉试样和渐进披露

值得吸收的是它把风格选择从抽象标签变成真实页面比较：

- 用户先看三张真实封面或代表性页面，再决定视觉方向。
- 候选模板先读轻量索引，选定后才读完整设计规则，减少上下文污染。
- 低密度演讲和高密度阅读是不同的版式问题。
- 固定 16:9 舞台保证网页、截图和导出保持同一构图。
- 视觉系统由字体角色、色板、网格、组件、表面和动效共同组成，不能只换主题色。

对 StoryWeave 的对应动作：

1. 增加可选的 theme preview：同一份 outline 生成三张真实风格预览，预览内容来自当前 deck，而不是显示“主题选项卡片”。
2. 在 catalog 中增加 style 的摘要元数据，完整 renderer 规则只在主题已经选定后加载。
3. 在 deck 级输入增加 `reading_mode` 或等价字段，让 `speaker-led` 与 `reading-first` 影响页数、文字量和结构选择。
4. 将 16:9 舞台从视觉偏好提升为输出契约，移动端只做整体缩放，不临时重排页面。

不建议直接复制：`contenteditable + localStorage` 的无约束编辑。它会绕过 `exact_text`、审批状态、deck hash 和 manifest 指纹。后续如果增加浏览器编辑，应生成结构化 patch，写回 deck 源并重新审批或重建。

## 四、目标架构

现有 `resolveVisualPlan()` 是合适的 seam。建议在它之后增加一个内部 `RenderPlan` 接口，让页面生产模块只面对少量稳定字段：

```text
outline_draft
    → approve
    → RenderPlan
        ├─ theme_ref / architecture_id
        ├─ visual_scheme_ref / render_recipe_ref
        ├─ layout_plan / reading_mode
        ├─ asset_slots
        ├─ page_rhythm
        └─ motion_recipe_ref
    → style renderer
    → fixed 16:9 HTML
    → geometry and browser QA
    → storyweave-output.json
                         ↘ optional viewer / presenter
```

### `RenderPlan` 的建议职责

- 把 canonical theme 和逐页 scheme 解析成确定的 render recipe。
- 校验文字区、视觉区、层级和密度是否冲突。
- 将页面需要的资产与具体 slot 关联起来。
- 记录页面节奏，例如 `anchor`、`dense`、`breathing`，供 deck 级规划和 QA 使用。
- 为需要动效的页面提供语义 recipe；没有动效时保持静态 HTML。
- 不负责生成事实、不改变 `exact_text`、不决定业务内容，也不直接管理 Presenter 状态。

### renderer module 的建议边界

renderer module 应该负责：

- 根据 `role + render_recipe_ref` 选择 DOM 结构；
- 选择标题、正文、元数据和指标的字体与尺寸层级；
- 将 layout plan 映射为安全区、网格和内容容器；
- 将 asset slot 映射为图片、图表、表格或原生 SVG；
- 输出可独立打开的 slide HTML。

renderer module 不应该负责：

- 自动改写用户文案；
- 从素材名称猜测事实；
- 在 build 阶段临时选择主题或 scheme；
- 把 viewer/presenter 状态写回页面源；
- 用整页截图替代可编辑的 HTML 内容。

## 五、分优先级的改进项

### P0：先让主题和页面真的不同

| 改进项 | 具体工作 | 完成判断 |
| --- | --- | --- |
| Style × Role render recipe | 为 `editorial`、`systems`、`campaign`、`cinematic` 先实现 `cover`、`comparison`、`process`、`data`、`closing` 五类高频页面的不同 DOM/布局配方 | 不看颜色，仅看结构也能辨认至少两组主题差异 |
| 资产槽位合同 | 在 slide schema 增加 `asset_refs` 或等价字段，包含 `asset_id`、`slot`、`fit`、`crop`、`focal_point`、`caption` 和 `alt` | `image-hero` 能真实渲染登记图片，错误资产或缺失槽位会被阻断 |
| 固定舞台 | 统一内部画布尺寸。可以继续使用当前 `1280×720`，也可以迁移到 `1920×1080`，但要统一 manifest、CSS、QA 和导出规则 | 桌面、手机和导出使用同一构图，不靠 viewport 临时改排版 |
| 几何 QA | 增加内部元素重叠、标题与首个内容块间距、底部导航安全线、内容高度、字体最小值和空白比例检查 | QA 能指出具体 slide、viewport、元素和像素差，而不只报告“有溢出” |
| Golden role deck | 每个 active style 生成覆盖十种 role 的固定样例，保存结构和截图基线 | 主题晋升由结构差异和浏览器截图共同决定 |

### P1：让规划字段真正影响生成

| 改进项 | 具体工作 | 完成判断 |
| --- | --- | --- |
| 阅读模式 | 增加 `speaker-led` / `reading-first`，影响文字提醒线、页数、卡片数量和备注策略 | 同一 outline 在两种模式下具有不同但可解释的页面密度 |
| 页面节奏 | 让 `continuity_group` 和新增 `page_rhythm` 驱动 hero、正文、对比和收束页的安排 | 连续页面不会全部使用同一结构；节奏字段能在 manifest 或 QA 中追踪 |
| Theme preview | 增加预览命令或预览入口，生成三张使用真实 deck 内容的风格页 | 用户选择的是页面效果，不是抽象主题名称；预览不泄露内部元数据 |
| 语义动效 | 为 flow、data、comparison 和 image-hero 定义少量 `motion_recipe_ref` | 动效表达顺序、增长、对照或焦点；`prefers-reduced-motion` 下仍可读 |
| 角色级 renderer | 补齐 `section`、`image-hero`、`two-column`、`quote` 的真实结构，不再全部回落到通用方案 | 十种 role 都有明确的结构契约和对应截图 |

### P2：补充消费层能力

| 改进项 | 具体工作 | 完成判断 |
| --- | --- | --- |
| 独立 viewer | 让 viewer 消费 manifest 和逐页 HTML，提供总览、跳页、URL 定位和打印 | producer 不携带播放器状态，viewer 可以独立升级 |
| 可选 presenter | 在 viewer 之上增加当前页、下一页、notes 和计时 | Presenter 是独立消费者，不改变 HTML 页面源和 manifest 合同 |
| 结构化编辑 | 浏览器编辑生成 patch，回写 deck 源并触发重新构建 | 编辑结果不会绕过 exact_text、审批和指纹机制 |
| 主题开发工具 | 增加 `golden`、`preview`、`compare` 或等价命令 | 新 style 有固定样例、截图和差异报告，不依赖人工记忆 |

## 六、明确不引入的内容

以下内容在参考 Skill 中有价值，但不适合直接进入当前 HTML producer：

1. **完整 PPT Master 文档体系**：当前 `outline_draft`、`deck_spec`、theme snapshot 和 manifest 已经承担了大部分同类职责，再添加 `design_spec` / `spec_lock` 会形成重复的执行接口。
2. **完整 Presenter runtime**：双窗口、计时、标注和观众屏恢复应该放在独立 viewer/presenter 模块，不能让每个页面 renderer 都承担这些状态。
3. **无约束的浏览器直接编辑**：不能只依赖 `localStorage` 保存文字变化；编辑必须回到结构化源文件。
4. **继续扩充主题数量**：在四个 active style 还共用页面骨架时，增加更多 style 只会扩大维护面，不能解决视觉趋同。
5. **整页截图作为主题实现**：HTML 的文字、形状、表格、图表和 SVG 仍应保持原生可编辑；截图只能作为导出或视觉基线。
6. **把所有装饰都当作结构**：应先表达顺序、对照、分组和层级，只有确实承担信息关系的线、节点和容器才进入 renderer。

## 七、实施路线

### 阶段 0：建立基线

- 选定一份固定 outline，覆盖十种 role 和至少一张真实图片；
- 为四个 active style 生成当前版本截图；
- 记录当前 renderer、manifest、浏览器 QA 和测试结果；
- 确定内部舞台使用 `1280×720` 还是 `1920×1080`，不保留两套隐含口径。

### 阶段 1：完成 P0

- 先实现 editorial 和 systems 的 role-level recipes；
- 接通 asset slot 和 `image-hero`；
- 增加固定舞台与几何 QA；
- 生成两套主题的 golden role deck，确认 renderer 接口是否足够深。

### 阶段 2：扩展到四套主题

- 为 campaign 和 cinematic 实现与自身空间语法匹配的 recipes；
- 为四套主题补齐十种 role 的默认方案；
- 更新 manifest，使 render recipe、素材槽位和页面节奏可追踪；
- 运行桌面、移动和独立页 QA，并保存截图基线。

### 阶段 3：补规划和动效

- 增加阅读模式和页面节奏；
- 增加三张真实页面的主题预览；
- 为流程、数据和对比页加入语义动效及静态 fallback；
- 让 `density`、`continuity_group` 和 `hierarchy` 参与 renderer 选择。

### 阶段 4：按需增加 viewer/presenter

- 先把总览、跳页和 URL 定位做成独立 viewer；
- 再根据真实演讲需求增加 notes、下一页和计时；
- 若需要浏览器编辑，先定义结构化 patch 和重建流程，再实现界面。

## 八、验收标准

### 主题与渲染

- 四个 active style 在十种 role 上都有唯一、可说明的 render recipe；
- 至少五类高频页面在不同 style 下拥有不同的结构或空间语法，而不只是颜色变化；
- `approve` 后每页都得到确定的 `visual_scheme_ref` 和 render recipe 指纹；
- build 不会在运行时猜测缺失的主题、scheme 或素材。

### 素材

- 每个已使用的素材都有来源、许可证或生成记录；
- 每个图片页面都有明确 slot、比例、裁切、焦点和替代文本；
- 事实性图表、表格和用户截图不被生成图片替代；
- 缺失素材会报告具体页面和 slot，而不是静默使用装饰占位。

### 舞台与 QA

- manifest、CSS、浏览器截图和导出使用同一内部画布尺寸；
- 桌面、移动和独立页没有页面级溢出、空白页和资源断裂；
- QA 能报告元素重叠、标题间距、底部安全线、字体可读性和主题身份；
- reduced-motion 或无动效环境下，页面仍然显示完整内容。

### 兼容性

- legacy 主题继续按原路径构建，现有内容和视觉结构不被隐式迁移；
- canonical 主题切换只修改视觉计划，不修改标题、页面 ID、角色、准确文字、证据和备注；
- viewer/presenter 的加入不会改变 `storyweave-output.json` 的 producer 边界；
- 现有主题、资产、合同和迁移测试保持通过，并新增 golden deck 和几何 QA 测试。

## 九、需要先做的三个决策

1. **舞台尺寸**：继续以 `1280×720` 为内部坐标，还是统一到 `1920×1080`。关键不是选哪一个，而是停止 manifest、CSS 和导出之间的双重口径。
2. **素材是否进入第一阶段**：如果要让主题真正具备图片逻辑，应在 P0 同时完成 asset slot；如果当前只做原生文字和几何页面，可以先实现 recipes，再接图片。
3. **Presenter 是否属于 StoryWeave**：建议保留为独立消费者。只有在真实演讲场景出现稳定需求后，再确定其 notes、计时、观众屏和同步协议。

## 参考

- [三个演示文稿 Skill 的设计与视觉逻辑](research/presentation-skill-design-comparison.md)
- [StoryWeave HTML Skill](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/SKILL.md)
- [HTML 主题目录](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/assets/themes/catalog.json)
- [HTML 渲染器](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/scripts/lib/html.mjs)
- [HTML 主题解析器](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/scripts/lib/themes.mjs)
- [HTML 工作流](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/references/workflow.md)
