# StoryWeave

StoryWeave 是一组面向 16:9 演示文稿的独立 Skill。内容生产与展示适配分开：HTML 和 Imagegen 可以各自完成交付，Express 只在需要 Bento 包装时使用。

## Skills

| Skill | 作用 | 主要输出 |
|---|---|---|
| [storyweave-html](./skills/storyweave-html/SKILL.md) | 生成可编辑的独立 HTML 页面 | 逐页 HTML、离线画廊、`storyweave-output.json` |
| [storyweave-imagegen](./skills/storyweave-imagegen/SKILL.md) | 用 Imagegen 生成完整图片页面 | 逐页 PNG、离线画廊、图片式 PDF/PPTX |
| [storyweave-express](./skills/storyweave-express/SKILL.md) | 把已有 HTML 或图片页面包装为 Bento | `.bento.html` |

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
└── docs/         # 研究资料、迁移记录和历史设计
```

三个 Skill 的演示与预览资源位于各自的 `assets/examples/`，仓库根目录不保存生成结果或打包产物。

`docs/` 中的内容用于研究、迁移和历史追溯，不参与 Skill 运行。
