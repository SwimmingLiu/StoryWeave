# StoryWeave

制作 16:9 演示文稿的 Agent Skill 集合。共享核心保存确认内容，HTML 和 Imagegen 分别生成原生页面或整页图片，通过 QA 后交给 Bento 包装与展示。

| Skill | 用途 | 交付物 |
| --- | --- | --- |
| [storyweave](skills/storyweave/SKILL.md) | 组织内容、选择生成器、推进交付 | 完整演示流程 |
| [storyweave-html](skills/storyweave-html/SKILL.md) | 技术分享、流程、对比和准确数据 | 可编辑的原生 HTML、SVG 与图表 |
| [storyweave-imagegen](skills/storyweave-imagegen/SKILL.md) | 插画、材质、场景及完整视觉叙事 | 整页 PNG、离线 HTML 画廊，可导出 PDF/PPTX |
| [storyweave-express](skills/storyweave-express/SKILL.md) | 将已有产物包装为 Bento | 调整页序、备注与播放 |

四个 Skill 可独立运行。权威实现位于 `src/`，分发时按依赖生成自包含 `runtime/`；Bento 使用随包的无损压缩壳。HTML 保留原生文字和图形，当前 Bento 与 PPTX 每页使用一张图片。

## 使用

需要 Node.js 20 以上。从仓库运行 CLI 时，先安装开发依赖与浏览器：

```bash
npm ci
npx playwright install chromium
node skills/storyweave-html/scripts/ppt.mjs draft ./my-deck --theme-ref systems/ink-blue-grid
```

编辑草稿并按已有授权确认内容后，继续构建和交付：

```bash
node skills/storyweave-html/scripts/ppt.mjs approve ./my-deck
node skills/storyweave-html/scripts/ppt.mjs build ./my-deck
node skills/storyweave-html/scripts/ppt.mjs qa ./my-deck --json
node skills/storyweave/scripts/orchestrate.mjs ./my-deck --no-bento-update --json
```

安装为 Agent Skill 时，运行 `node skills/<skill-name>/install.mjs`。`--dir` 指定安装根目录，`--force` 更新前保留备份；安装后按对应 Skill 的 `scripts/package.json` 安装所需第三方依赖。

确认内容保存在 `deck_spec.json`，两个生成器分别使用自己的视觉计划。换主题保留确认内容，修改内容或产物后重新 QA。旧 v2/v3 项目仍可读取，使用 `migrate-content` 显式迁移。

## Imagegen 主题与参考图

生成器提供 **6 套候选主题**：纸面编辑、白底电路、参数化波纹、银白玻璃、朱红海报、日常电影。完整引用与适用场景见[主题目录](skills/storyweave-imagegen/references/themes.md)，实际效果见[六主题预览](skills/storyweave-imagegen/assets/examples/theme-previews/index.html)。

[分享稿参考图库](skills/storyweave-imagegen/assets/reference-library/index.html)另收录 **18 种风格、41 张内容页**，可按观点、流程、对比、数据和架构筛选。它提供选风格的参考，不自动增加生成配方；纯 HTML 排版即可实现的案例归入 [HTML 参考目录](design-library/html-template-references/README.md)。联网版从来源加载原图，私有离线查看方法见[参考图说明](skills/storyweave-imagegen/references/presentation-cases.md)。

```bash
node skills/storyweave-imagegen/scripts/ppt.mjs draft ./image-deck --theme systems/white-cyan-wave --scope authoring
```

Imagegen CLI 编译逐页任务，由 Agent 调用真实生图工具，再收集结果与逐页复核。主题仍为 candidate；编译通过不代表图片文字、构图或视觉质量已通过。

## 开发与评测

```bash
npm run package:skills
npm run check:packages
npm test
npm run doctor
```

[GitHub Actions CI](https://github.com/SwimmingLiu/StoryWeave/actions/workflows/ci.yml)在 push、PR 和手动评测时运行完整测试及八项功能验收，保留日志、截图和 trace。每次评测都核对对应提交的 CI 结果，PR 合并前要求 `Verification` 成功。付费生图与人工视觉评审分别记录，CI 不代填接受结论。运行与证据说明见 [CI 文档](docs/ci.md)。

[系统架构](docs/architecture/storyweave-target-architecture.md) · [重构与验收](docs/plans/storyweave-refactor-plan.md) · [包体积优化](docs/plans/storyweave-package-size-validation.md) · [验证 Skill](.agents/skills/verify-storyweave/SKILL.md)
