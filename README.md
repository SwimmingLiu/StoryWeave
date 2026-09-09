# StoryWeave

StoryWeave 是一组面向 16:9 演示文稿的独立 Skill。内容生产与展示适配分开：HTML 和 Imagegen 可以各自完成交付，Express 负责 Bento 包装；全局 `storyweave` Skill 负责路由、QA 和自动交接。

## Skills

| Skill | 作用 | 主要输出 |
|---|---|---|
| [storyweave](./skills/storyweave/SKILL.md) | 统筹内容生产、QA、Bento 包装和展示 | producer → Bento 交接结果 |
| [storyweave-html](./skills/storyweave-html/SKILL.md) | 生成可编辑的独立 HTML 页面 | 逐页 HTML、离线画廊、`storyweave-output.json` |
| [storyweave-imagegen](./skills/storyweave-imagegen/SKILL.md) | 用 Imagegen 生成完整图片页面 | 逐页 PNG、离线画廊、图片式 PDF/PPTX |
| [storyweave-express](./skills/storyweave-express/SKILL.md) | 把已有 HTML 或图片页面包装为 Bento | `.bento.html` |

## Imagegen 主题

Imagegen 使用主题架构组织空间、样式定义材质与色彩、单页方案确定构图。当前提供六套候选样式，使用 `--scope authoring` 制作。图片默认保留简洁主标题和必要内容，主题不自动添加说明性小字；用户提供的文字按 `exact_text` 保留。

| 主题 | 完整引用 | 视觉方向 |
|---|---|---|
| 纸面编辑 | `editorial/paper-magazine` | 裁切摄影、宋体标题与干净纸边组成的编辑叙事 |
| 白底电路 | `systems/white-cyan-circuit` | 冷白底、精细圆环与低对比度电路纹样 |
| 参数化波纹 | `systems/white-cyan-wave` | 浅蓝平滑曲线、稀疏粒子与清晰的信息层级 |
| 银白玻璃 | `systems/silver-glass` | 通透玻璃模块、银白空间与钴蓝重点 |
| 朱红海报 | `campaign/bold-poster` | 朱红色场、大字与单一实物主体组成的传播画面 |
| 日常电影 | `cinematic/natural-film` | 自然曝光、可信动作与连续镜头组成的场景叙事 |

下列图片用于识别样式，各页面仍需核验实际文字、关系和数值。

| 纸面编辑 | 白底电路 |
|---|---|
| ![纸面编辑](skills/storyweave-imagegen/assets/examples/theme-previews/editorial--paper-magazine.png) | ![白底电路](skills/storyweave-imagegen/assets/examples/theme-previews/systems--white-cyan-circuit.png) |

| 参数化波纹 | 银白玻璃 |
|---|---|
| ![参数化波纹](skills/storyweave-imagegen/assets/examples/theme-previews/systems--white-cyan-wave.png) | ![银白玻璃](skills/storyweave-imagegen/assets/examples/theme-previews/systems--silver-glass.png) |

| 朱红海报 | 日常电影 |
|---|---|
| ![朱红海报](skills/storyweave-imagegen/assets/examples/theme-previews/campaign--bold-poster.png) | ![日常电影](skills/storyweave-imagegen/assets/examples/theme-previews/cinematic--natural-film.png) |

[主题目录](skills/storyweave-imagegen/references/themes.md) · [离线参考图画廊](skills/storyweave-imagegen/assets/examples/theme-previews/index.html)

在仓库根目录查看主题或创建候选主题草稿：

```bash
node skills/storyweave-imagegen/scripts/ppt.mjs themes --all --json
node skills/storyweave-imagegen/scripts/ppt.mjs draft ./my-deck --theme systems/white-cyan-wave --scope authoring --title "演示标题"
```

## 安装

安装到当前 Agent Skill 目录：

```bash
node skills/storyweave/install.mjs --force
node skills/storyweave-html/install.mjs --force
node skills/storyweave-imagegen/install.mjs --force
node skills/storyweave-express/install.mjs --force
```

使用 `--dir <skills-root>` 可以指定安装目录。安装器会忽略 `node_modules` 和 `.DS_Store`。

## 验证

```bash
node --test tests/integration/storyweave-all-skills.test.mjs
node --test skills/storyweave-html/tests/*.test.mjs
node --test skills/storyweave-imagegen/tests/*.test.mjs
node --test skills/storyweave-express/tests/*.test.mjs
```

生产者 QA 通过后，可以由全局编排 Skill 自动包装并校验 Bento：

```bash
node skills/storyweave/scripts/orchestrate.mjs <producer-project> --json
```

## 目录

```text
StoryWeave/
├── skills/       # 四个可独立安装的 Skill
└── docs/         # 研究资料、迁移记录和历史设计
```

三个生产/适配 Skill 的演示与预览资源位于各自的 `assets/examples/`；全局 `storyweave` Skill 提供编排脚本。仓库根目录不保存生成结果或打包产物。

`docs/` 中的内容用于研究、迁移和历史追溯，不参与 Skill 运行。
