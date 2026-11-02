# HTML 主题目录

canonical 主题按 Architecture、Style 和 Visual scheme 三层组织。整套 deck 选择一个 `architecture/style`，每页再根据角色解析 scheme。

schema 4 的 `plans/html.json` 保存解析后的主题、字阶、逐页 scheme、`layout_id` 和节奏。内容结构选择 DOM 与 SVG 骨架，主题调整配色与字型。产物继续记录 `render_recipe_ref`、`render_recipe_sha256` 和 `motion_recipe_ref`。旧 v3 保留其原配方与审批语义。

| Theme ref | 空间语法 | 状态 |
|---|---|---|
| `editorial/paper-magazine` | 出版物式非对称版面、纸面留白和规则线 | active |
| `systems/white-cyan-circuit` | 节点、路径、分组和青蓝校准线 | active |
| `systems/ink-blue-grid` | 瑞士网格、克莱因蓝强调和模块化技术图解 | active |
| `campaign/bold-poster` | 高对比色块、强主张和单一传播主体 | active |
| `cinematic/natural-film` | 镜框、方向性光线、空间纵深和安静字幕区 | active |

每个 active style 都为 `cover`、`section`、`statement`、`image-hero`、`two-column`、`comparison`、`process`、`data`、`quote` 和 `closing` 声明唯一默认 scheme。v4 计划解析具体 scheme，不保留 `auto`；批准内容不持有视觉主题。

当前五套 style 的结构倾向分别是：`editorial` 使用纸面分栏和规则线，`systems/white-cyan-circuit` 使用校准网格、路径和节点，`systems/ink-blue-grid` 使用瑞士网格、克莱因蓝强调和模块化图解，`campaign` 使用错位色块和强主张，`cinematic` 使用镜框、字幕安全区和连续场景。v4 主题共享信息结构的布局实现，再用字型、配色、线条与明暗处理形成主题差异。

原有 8 个主题 ID 继续沿 legacy 渲染路径构建。`editorial` 和 `brand-bold` 有确定迁移建议，但只有运行 `migrate` 才会写入 canonical 引用；其他旧主题要求显式选择目标。未知主题不会回退到默认值。
