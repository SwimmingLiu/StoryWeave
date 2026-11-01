# StoryWeave HTML 与三个参考 Skill 的页面设计差距审计

本文保留审计时的页面与旧渲染实现结论。旧实现现在位于 `src/html/legacy.mjs`，当前结构化链路见[系统架构](../architecture/storyweave-target-architecture.md)。

> 审计日期：2026 年 9 月 3 日  
> 对象：`skills/storyweave-html` 当前 renderer、`AI Agent 客服` 14 页演示，以及 `guizang-ppt-skill`、`ppt-master`、`frontend-slides` 的公开实现。  
> 结论范围：本文讨论页面设计、排版、信息呈现和生成流程，不评价三个 Skill 的商业适用性。

## 一、结论

当前 StoryWeave HTML 的基础合同已经比较完整：有 storyboard、主题审批、固定舞台、独立页面、manifest、浏览器 QA 和 Bento 派生流程。但页面质量仍明显落后于三个参考 Skill，原因不在“颜色选得不够好”，而在于**设计决策没有进入 renderer**。

目前的输入已经记录了 `visual_scheme_ref`、`layout_plan`、`page_rhythm`、`visual_brief` 和 `exact_text`，但 `html.mjs` 仍主要按 `role` 选择五种通用骨架：标题、段落、两列、四步列表或指标卡。结果是：

- 不同页面只有内容变化，空间关系基本不变；
- 不同主题主要通过颜色、字体和背景网格区分；
- 规划阶段写下的视觉意图没有转化为页面结构；
- 标题字号、正文密度、卡片边界和页面节奏没有形成一套可执行的设计系统；
- 页面看起来像“内容放入组件”，而不是针对信息任务完成构图。

三个参考 Skill 的优势正好相反：它们先决定页面的**信息模型、视觉层级、空间语法和节奏**，再填充文字。需要补的是这条从计划到 renderer 的中间层，而不是继续增加几个颜色主题。

## 二、差距总表

| 维度 | 参考 Skill 的做法 | StoryWeave 当前做法 | 直接影响 |
| --- | --- | --- | --- |
| 页面骨架 | guizang 有 22 个登记版式；frontend-slides 用设计系统扩展 cover、statement、timeline、diagram、grid、closing 等结构；ppt-master 按页面信息任务和关系构图 | 10 个 role 最终收敛到 `hero`、`columns`、`flow`、`data`、`quote`、`closing` 几个通用 scheme | 大多数页面像同一个模板，无法形成页面节奏 |
| 内容模型 | 每种版式有自己的字段：KPI、年份、描述、图注、卡片说明、关系标签等 | `exact_text` 是字符串数组，renderer 再按 role 猜测字符串位置 | 内容只能被压成标题和卡片，难以呈现证据、层级和关系 |
| 字体系统 | 外部 Skill 区分 display、body、mono、kicker、caption，并按观看距离设置字号和字重 | `Inter + Noto Sans SC + system-ui` 共用；页面默认标题 56–72px，正文 28px；没有稳定的 mono/meta 层 | 中文标题显得厚，页面缺少大字、正文、注释之间的层级差 |
| 标题策略 | Swiss 规则按中文字符数决定 1 行、2 行和 3 行字号；复杂页会重写标题或换版式 | 只在 CSS 里按 `page_rhythm` 改 `h1` 大小，不判断标题长度和语义断行 | 容易出现标题过重、换行尴尬或标题挤压主体 |
| 网格与对齐 | guizang Swiss 采用 16 列 grid、统一内容轴、固定 gap 和安全区 | 当前只用左右绝对定位；`copy` 和 `art` 的宽度由几个全局规则控制 | 页面之间没有可复用的横向轴和局部网格 |
| 卡片边界 | 参考 Skill 先用间距、hairline、tint，再按语义使用 filled panel；同页只保留一个 accent 焦点 | `.columns p`、`.metrics > div`、`.steps li` 默认都带描边或填充 | 视觉权重平均，内容块变成重复的“网页卡片” |
| 主题节奏 | guizang 强制 light / dark / hero 交替，3–4 页出现一次 anchor；frontend-slides 允许风格系统有独立的 atmosphere 和 signature device | 14 页中除封面和收尾外，绝大多数页面共享同一浅色网格背景 | 长 deck 观看时没有停顿、转折和重新聚焦 |
| 图解方式 | ppt-master 先识别 order、contrast、membership、hierarchy，再画 spine、nodes、connectors、labels；guizang 要求 SVG 只画几何、标签用 HTML | 当前 `visual_brief` 不参与布局；新增 SVG 只能作为 `art` 的附加内容 | 图形和文字没有共同的阅读顺序，容易出现左右重复和装饰化图解 |
| 图片与素材 | 图片先参与大纲和版式选择，绑定 S22/S15/S16 等槽位，比例和焦点固定 | 资产 registry 已存在，但没有真实素材时页面统一使用 CSS 几何占位 | 画面缺少内容型视觉锚点，技术页容易显得空 |
| 动效 | guizang 把动效绑定到页面语义：timeline 点亮、bar 生长、loop 描线；frontend-slides 用一次完整的入场编排形成感受 | 当前只有 `sw-rise`、`sw-node`、`sw-stamp`、`sw-focus` 四组通用动画；自定义 SVG 基本静态 | 动效没有补充信息关系，页面更像静态报告 |
| 页面 chrome | guizang 有 `chrome-min`、页码、章节、演讲者视图、下一页和计时；frontend-slides 有控制层和编辑入口 | producer 只有上一页、下一页和计数器 | 页面身份、章节和信息来源不够明确 |
| 预览与审美确认 | frontend-slides 先生成 3 张真实页面预览，让用户看完再选风格 | `preview` 会生成主题 HTML，但没有明确的 style discovery 和用户选择门 | 用户只能看到抽象主题名，无法在构图阶段纠偏 |
| 质量门 | guizang 有 layout lock 和 Swiss validator；ppt-master 有 first-page gate、SVG checker 和 final quality gate | 当前 QA 主要检查 DOM、边界、溢出、重叠、字号和 manifest | “结构合法”不等于“视觉成立”，页面丑的时候 QA 仍可能通过 |

## 三、从源码看，差距集中在哪里

### 1. renderer 只有一个内容入口

`src/html/legacy.mjs` 保留的旧 `copy()`按照 `role` 分支：

- `process` → 一个 `<ol class="steps">`；
- `comparison` / `two-column` → 一个两列 `.columns`；
- `data` → 一个三列 `.metrics`；
- 其他角色 → 一个标题加若干段落。

`slideMarkup()` 再把它放进统一的 `.copy` 和 `.art`。这意味着即使审批阶段已经得到不同的 `render_recipe_ref`，renderer 仍没有根据 recipe 选择不同的 DOM 结构。

参考实现把“页面角色”当作入口，把“页面信息模型”当作下一层入口。例如同样是 process，可以是纵向 timeline、横向 pipeline、loop diagram 或四步 cards；同样是 data，可以是 KPI tower、ledger、bar chart 或 tech spec。当前 StoryWeave 缺少这层选择。

### 2. theme catalog 写了空间语法，但没有实现空间语法

`catalog.json` 已经写了：

- systems：节点、路径、分组和校准线；
- editorial：纸面分栏和规则线；
- campaign：错位色块和强主张；
- cinematic：镜框、方向性光线和字幕安全区。

但这些描述大多只在 `architectureOverrides()` 中变成几条 CSS 覆盖。`.scheme-columns`、`.scheme-flow`、`.scheme-data` 仍然共享同一套内容排列。主题因此表现为“同一骨架换皮”，没有形成各自的构图语法。

### 3. 字号存在，但没有类型比例

当前 CSS 只有几档全局字号：

```text
anchor h1: 72px
base h1: 64px
dense h1: 56px
body: 28px
reading-first body: 24px
```

这不是完整的 typography system。参考 Skill 至少会区分：

```text
display / hero / statement
section title
page title
lead
body / card body
caption / source
mono / kicker / page chrome
```

每一层还要同时决定字号、字重、行高、字距、颜色和与相邻元素的距离。没有这套比例，标题和正文即使单独看都可读，放在一起仍然没有明确的视觉优先级。

### 4. 内容字段不足，导致信息只能“平铺”

`exact_text` 作为封闭的可见文字清单是有价值的，但它不能同时承担内容建模职责。当前页面缺少以下稳定字段：

- `kicker`：页眉或章节身份；
- `lead`：标题下面的一句解释；
- `body`：一段连续说明；
- `items`：带标题、描述、编号和状态的并列项；
- `diagram`：节点、关系、方向和焦点；
- `metrics`：值、单位、标签、来源和比较基线；
- `caption` / `source`：图表、图片和证据说明；
- `layout_id`：具体页面骨架，而不只是 role。

参考 Skill 不是把所有内容都写成更多字符串，而是给不同的信息形状分配不同载体。当前 deck 即使增加了 SVG，也仍然在左右两边重复同一组文字，因为内容模型没有告诉 renderer 哪些是主内容、哪些是图解标签、哪些是说明。

### 5. 页面节奏没有进入 deck 级规划

当前有 `page_rhythm: anchor | dense | breathing`，但它主要影响单页 CSS，不能决定：

- 哪一页应该成为章节幕封；
- 哪一页应该改成 statement；
- 哪一页应该使用 dark / light 反转；
- 哪几页属于同一 continuity group；
- 连续页面是否重复了同一种主体结构。

guizang 的节奏规则和 frontend-slides 的 density 模式都把这些判断放在生成前，而不是等到 CSS 阶段补救。

## 四、为什么参考页面看起来“字体更好、内容更满、布局更稳”

### 字体更好，不只是字号更大

参考页面通常同时满足四点：

1. 大标题使用具有性格的 display 字体或明确的轻字重；
2. 中文标题先控制字符数和行数，再决定字号；
3. 正文、caption、mono metadata 形成清楚的字重和尺寸阶梯；
4. 同一页只有一个主要标题，其余文本通过位置和留白降级。

当前页面使用单一 sans-serif 族，标题通常是 56–72px 的粗体，正文也是较大的同一风格字体，导致每一层都在争夺注意力。解决办法不是把所有文字再放大，而是建立 display / body / meta 的角色差异。

### 内容更满，不是因为塞了更多字

参考页面的“满”来自结构：

- 一个主张有一个明确载体；
- 复杂关系由轴线、节点、层级和分区承担；
- 辅助文字放在正确的 caption、source 或 note 区域；
- 每个页面都有一个强视觉锚点，剩余空间才成为留白。

当前页面的空，主要来自 `visual_brief` 没有转化成结构，内容也没有分出主次。右侧的几何图形因此只能承担装饰作用。

### 布局更稳，不是因为用了更多 absolute position

参考 Skill 先建立内容轴、网格、slot 和安全区，再放置文字和图形。局部可以使用绝对定位，但它必须服从已定义的 grid。当前 renderer 的绝对定位是全局的：`.copy` 和 `.art` 都由少量宽高规则控制，页面之间没有真正的局部网格，也没有按照信息权重分配空间。

### 好看来自节奏，而不是每页都“完整”

参考页面允许某一页只留下一个大判断、一个图、一个数据或一个章节标题。完整信息放到下一页或 speaker notes。当前 14 页几乎每页都在同时承担标题、清单、解释和图解，所以看起来既不够简洁，也不够完整。

## 五、建议的改造顺序

### P0：重做 renderer 接口

新增一个页面级 `layout_id` 和结构化 `content`，保留 `exact_text` 作为最终可见文字审计清单：

```json
{
  "role": "process",
  "layout_id": "systems/loop-diagram",
  "content": {
    "title": "Agent 的循环决策",
    "lead": "每次工具调用后重新读取结果",
    "steps": [
      {"title": "目标", "body": "改址"},
      {"title": "依据", "body": "物流与规则"},
      {"title": "动作", "body": "预览变更"},
      {"title": "结果", "body": "等待确认"}
    ]
  }
}
```

renderer 根据 `layout_id` 选择唯一 DOM 结构，而不是继续按 role 猜测字符串位置。

### P0：建立真正的 typography system

至少定义：

- `display-xl`、`display-lg`、`title`、`lead`、`body`、`card`、`caption`、`mono`；
- 中文标题按字符数和行数选择字号；
- 大字使用较轻字重，小字使用较高字重；
- 每个 style 的 display / body / mono 字体明确加载，不能只写 system fallback；
- 标题、正文、图解和页码使用同一内容轴。

### P0：把主题节奏和页面角色分开

`role` 表示沟通任务；`layout_id` 表示页面骨架；`tone` 表示 light / dark / accent；`page_rhythm` 表示 anchor / dense / breathing。四者不能继续混成一个 scheme。

首批建议实现 8 个页面骨架：

| layout_id | 适用内容 |
| --- | --- |
| `cover-split` | 封面与主题判断 |
| `statement` | 一句中心判断 |
| `scenario-strip` | 假设请求或用户旅程 |
| `four-cards` | 四个并列能力或风险 |
| `loop-diagram` | Agent 循环、反馈和恢复 |
| `system-stack` | 六层架构或三层系统 |
| `duo-compare` | 传统方案与 Agent 边界 |
| `metric-ledger` | 指标、验收和发布门槛 |

### P1：按参考 Skill 的方式做 style discovery

为同一份 outline 生成三张真正的首屏或代表页：

1. Swiss IKB：黑白纸面、克莱因蓝、16 列网格、轻字重、直角色块；
2. Editorial：纸面、衬线标题、规则线、图片或证据块；
3. Dark tech：深色底、单一高亮色、循环或系统图。

预览中只出现真实 deck 文案，不出现“主题选项”“模板”“预览”等内部词。先让用户选择构图方向，再生成全套页面。

### P1：加入 deck 级视觉验收

现有浏览器 QA 继续保留，再补充：

- 主题节奏：连续三页不得复用同一主体结构；
- 标题长度与断行；
- display / body / meta 的字号比例；
- 主视觉面积和视觉权重；
- 卡片边界是否承担语义；
- 同页是否出现重复标签；
- 页面缩略图下是否仍能识别主张和焦点。

### P2：再做 viewer / presenter / 编辑

演讲者视图、计时、观众屏同步和浏览器编辑有价值，但它们不能替代页面 renderer。当前页面还没有建立稳定的 layout 和 typography 之前，继续增加播放功能不会解决视觉问题。

## 六、针对当前 Agent 客服 deck 的具体调整

下一版不应继续沿用“标题 + 左侧卡片 + 右侧图形”的统一构图。建议改成以下节奏：

| 页 | 页面任务 | 建议骨架 | 视觉重点 |
| ---: | --- | --- | --- |
| 1 | 主题判断 | `cover-split` | 黑底大标题 + 一条服务路径 |
| 2 | 假设请求 | `scenario-strip` | 用户一句话、五个决策节点 |
| 3 | 方案边界 | `duo-compare` | FAQ / 规则 / RPA / Agent / 人工五条能力轨道 |
| 4 | 请求执行 | `horizontal-timeline` | 身份 → 规则 → 预览 → 提交 / 转交 |
| 5 | 架构 | `system-stack` | 六层结构，不再重复两组卡片 |
| 6 | 运行循环 | `loop-diagram` | 目标 → 依据 → 工具 → 结果，强调回到决策 |
| 7 | 知识检索 | `filter-gate` | 来源、范围、权限三道过滤器 |
| 8 | 工具契约 | `tech-spec` | 查询 / 预览 / 提交三类接口与授权边界 |
| 9 | 状态 | `three-rails` | 会话、业务、审批三条事实来源 |
| 10 | 人工转交 | `handoff-packet` | 触发条件、交接包、人工动作、恢复 |
| 11 | 安全 | `four-cards` | 四类风险与四道工程控制 |
| 12 | 验收 | `metric-ledger` | 结果、过程、体验、风险四组证据 |
| 13 | MVP | `horizontal-timeline` | 选流程、定契约、影子运行、小流量 |
| 14 | 决策 | `closing-manifesto` | 只保留三个需要今天决定的问题 |

这组调整的重点是改变页面的信息载体和节奏，而不是继续增加卡片或装饰。

## 七、当前版本的判断

当前 `systems/ink-blue-grid` 改版已经比最初的白底青蓝版本更接近 Swiss 方向：有黑底节点页、单一 IKB accent、固定舞台和原生 SVG 图解。但它仍然只是**通用 renderer 上的局部增强**，没有达到三个参考 Skill 的页面设计水平。

要缩小差距，最先应当做的是：

1. 用 `layout_id + structured content` 替代 role 对字符串数组的猜测；
2. 让每个 layout 拥有自己的 grid、字体比例、边界和动效；
3. 在 deck 级别安排 dark / light / statement / diagram 的节奏；
4. 用真实页面预览完成风格确认；
5. 将缩略图识别度和视觉权重纳入 QA。

如果不先完成这五件事，继续加主题色、加 SVG 装饰或加播放器功能，页面仍会停留在“结构通过、视觉普通”的状态。

## 参考

- [StoryWeave HTML Skill](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/SKILL.md)
- [StoryWeave legacy HTML renderer](/Users/swimmingliu/data/github-proj/StoryWeave/src/html/legacy.mjs)
- [HTML theme catalog](/Users/swimmingliu/data/github-proj/StoryWeave/skills/storyweave-html/assets/themes/catalog.json)
- [Three presentation Skill comparison](/Users/swimmingliu/data/github-proj/StoryWeave/docs/research/presentation-skill-design-comparison.md)
- [StoryWeave HTML improvement recommendations](/Users/swimmingliu/data/github-proj/StoryWeave/docs/storyweave-html-improvement-recommendations.md)
- [guizang-ppt-skill Swiss layout rules](/Users/swimmingliu/.agents/skills/guizang-ppt-skill/references/layouts-swiss.md)
- [frontend-slides design rules](/Users/swimmingliu/.agents/skills/frontend-slides/SKILL.md)
- [ppt-master shared visual standards](/Users/swimmingliu/.agents/skills/ppt-master/references/shared-standards-core.md)
