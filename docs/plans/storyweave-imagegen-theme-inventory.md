# Imagegen 主题在仓库与全局安装中的差异

上轮仓库源码重构没有扩充 Imagegen 主题。仓库目录和四份现有样式文件与该仓库的 HEAD 一致；用户全局安装版则已经扩充了两套样式。

| 范围 | 架构 | 候选样式 | 方案条目 | active 样式 |
| --- | --- | --- | --- | --- |
| 当前仓库 | 4 | 4 | 27 | 0 |
| 当前全局安装版 | 4 | 6 | 43 | 0 |

两套新增样式均属于 `systems` 架构：

| 新增完整引用 | 视觉选择 | 方案 |
| --- | --- | --- |
| `systems/white-cyan-wave` | 浅蓝参数化曲线、稀疏粒子和留白 | 8 个，复用系统主题的构图类别 |
| `systems/silver-glass` | 银白玻璃模块、钴蓝重点和软阴影 | 8 个，复用系统主题的构图类别 |

其余四套的引用 ID 保持为 `editorial/paper-magazine`、`systems/white-cyan-circuit`、`campaign/bold-poster`、`cinematic/natural-film`。全局版调整了名称与 recipe，显示为纸面编辑、白底电路、朱红海报和日常电影。四种架构仍为编辑叙事、系统蓝图、品牌传播和影像叙事。

两处 resolver 已实际解析全部方案及十类角色的默认选择。全局六张代表图均存在，文件哈希与保存的记录一致。每套样式共用一张代表图，这些记录不能证明 43 个方案都已完成实际生图和视觉验收。所有样式仍为 `candidate`，制作时使用 `--scope authoring`。

全局版保留旧 v3 CLI 与 `scripts/lib/`，仓库已经使用 v4 内容和独立 runtime。两处需要按模块与主题分别迁移，不能直接用仓库包覆盖全局包，否则新增主题会被旧目录替换。本轮体积优化保留两处主题各自状态。

本机可在[全局主题目录](/Users/swimmingliu/.agents/skills/storyweave-imagegen/references/themes.md)与[六套预览画廊](/Users/swimmingliu/.agents/skills/storyweave-imagegen/assets/examples/theme-previews/index.html)查看当前安装版。[核对记录](../../tmp/package-optimization/theme-inventory.json)保存目录、recipe、方案解析与预览哈希。
