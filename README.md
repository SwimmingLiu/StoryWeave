# StoryWeave

StoryWeave 是一组面向 16:9 演示文稿的独立 Skill。内容生产与展示适配分开：HTML 和 Imagegen 可以各自完成交付，Express 只在需要 Bento 包装时使用。

## Skills

| Skill | 作用 | 主要输出 |
|---|---|---|
| [storyweave-html](./skills/storyweave-html/SKILL.md) | 生成可编辑的独立 HTML 页面 | 逐页 HTML、离线画廊、`storyweave-output.json` |
| [storyweave-imagegen](./skills/storyweave-imagegen/SKILL.md) | 用 Imagegen 生成完整图片页面 | 逐页 PNG、离线画廊、图片式 PDF/PPTX |
| [storyweave-express](./skills/storyweave-express/SKILL.md) | 把已有 HTML 或图片页面包装为 Bento | `.bento.html` |

## 主题 showcase

当前目录有四套可运行的候选主题样式。每套主题都有基础案例和补充 coverage：基础案例用于快速了解主题，coverage 用同一场景验证该主题下的细化视觉方案。全部 15 张 coverage 页面都经过人工视觉校验，评分不低于 95/100，并保留离线画廊、标准输出和逐页 QA 记录。

| 主题样式 | 代表场景 | 细化视觉方案覆盖 | 入口 |
|---|---|---|---|
| `editorial/paper-magazine` | 客服体验从一次回答延伸为连续关系 | 纪录主视觉、人物特写、对照跨页、编辑拼贴 | [基础案例](./examples/theme-showcase/editorial-customer-journey/README.md) · [基础画廊](./examples/theme-showcase/editorial-customer-journey/comparison_gallery.html) · [coverage 画廊](./examples/theme-showcase/editorial-customer-journey-coverage/comparison_gallery.html) |
| `systems/white-cyan-circuit` | AI 客服的节点、路径和运营治理关系 | 连续回路、数据概览、信号判断、概念界面、等距技术空间 | [基础案例](./examples/theme-showcase/systems-ai-customer-service/README.md) · [基础画廊](./examples/theme-showcase/systems-ai-customer-service/comparison_gallery.html) · [coverage 画廊](./examples/theme-showcase/systems-ai-customer-service-coverage/comparison_gallery.html) |
| `campaign/bold-poster` | AI 客服发布与产品主张 | 行动路径、传播数据、传播信号 | [基础案例](./examples/theme-showcase/campaign-ai-customer-service-launch/README.md) · [基础画廊](./examples/theme-showcase/campaign-ai-customer-service-launch/comparison_gallery.html) · [coverage 画廊](./examples/theme-showcase/campaign-ai-customer-service-coverage/comparison_gallery.html) |
| `cinematic/natural-film` | 夜间值班与客服交接 | 双场景对照、行动旅程、现场证据 | [基础案例](./examples/theme-showcase/cinematic-night-operations/README.md) · [基础画廊](./examples/theme-showcase/cinematic-night-operations/comparison_gallery.html) · [coverage 画廊](./examples/theme-showcase/cinematic-night-operations-coverage/comparison_gallery.html) |

coverage 的完整素材位于 [`examples/theme-showcase/`](./examples/theme-showcase/)；每个 coverage 目录都包含 `README.md`、`comparison_review.md`、离线 `comparison_gallery.html`、逐页 PNG、`storyweave-output.json` 和 `qa_report.json`。

## 安装

安装到当前 Agent Skill 目录：

```bash
rtk node skills/storyweave-html/install.mjs --force
rtk node skills/storyweave-imagegen/install.mjs --force
rtk node skills/storyweave-express/install.mjs --force
```

使用 `--dir <skills-root>` 可以指定安装目录。安装器会忽略 `node_modules` 和 `.DS_Store`。

## 验证

```bash
rtk node --test skills/storyweave-html/tests/*.test.mjs
rtk node --test skills/storyweave-imagegen/tests/*.test.mjs
rtk node --test skills/storyweave-express/tests/*.test.mjs
```

## 目录

```text
StoryWeave/
├── skills/       # 三个可独立安装的 Skill
├── docs/         # 当前审计、研究资料和历史设计
├── examples/     # Storyboard、生成结果和对照案例
└── dist/skills/  # 已打包的 .skill 文件
```

`dist/skills/` 中的三个包由当前源码重新生成；迁移前的旧包保存在 `dist/legacy/pre-migration/`，仅供追溯。

当前实现说明见 [实施审计](./docs/implementation-audit.md)。早期合并式架构保存在 `docs/history/`，仅用于追溯，不作为当前实现依据。
