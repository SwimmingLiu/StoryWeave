# HTML 主题目录

canonical 主题按 Architecture、Style 和 Visual scheme 三层组织。整套 deck 选择一个 `architecture/style`，每页再根据角色解析 scheme。

每个 canonical style 还声明一个 `render_recipe`。它描述页面表面、布局语法、内容结构、图片策略和动效家族；审批后会为每页生成 `render_recipe_ref`、`render_recipe_sha256` 和 `motion_recipe_ref`。renderer 必须消费这些字段，不能只根据颜色和字体生成一套共同骨架。

| Theme ref | 空间语法 | 状态 |
|---|---|---|
| `editorial/paper-magazine` | 出版物式非对称版面、纸面留白和规则线 | active |
| `systems/white-cyan-circuit` | 节点、路径、分组和青蓝校准线 | active |
| `campaign/bold-poster` | 高对比色块、强主张和单一传播主体 | active |
| `cinematic/natural-film` | 镜框、方向性光线、空间纵深和安静字幕区 | active |

每个 active style 都为 `cover`、`section`、`statement`、`image-hero`、`two-column`、`comparison`、`process`、`data`、`quote` 和 `closing` 声明唯一默认 scheme。审批后，`deck_spec.json` 中不能保留 `auto`。

当前四套 style 的结构倾向分别是：`editorial` 使用纸面分栏和规则线，`systems` 使用校准网格、路径和节点，`campaign` 使用错位色块和强主张，`cinematic` 使用镜框、字幕安全区和连续场景。它们共享页面角色，不共享页面实现。

原有 8 个主题 ID 继续沿 legacy 渲染路径构建。`editorial` 和 `brand-bold` 有确定迁移建议，但只有运行 `migrate` 才会写入 canonical 引用；其他旧主题要求显式选择目标。未知主题不会回退到默认值。
