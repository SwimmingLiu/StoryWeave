---
name: storyweave
description: Orchestrate StoryWeave presentation work from content discovery through HTML or Imagegen production, quality checks, automatic Bento packaging, and in-app presentation. Use when users ask to create, compare, regenerate, preview, package, or show a StoryWeave presentation, or when the output should be displayed or edited in Bento.
---

# StoryWeave 全局编排

StoryWeave 是一个分层的演示文稿工作流：`storyweave-html` 负责可编辑的原生 HTML，`storyweave-imagegen` 负责整页图片式页面，`storyweave-express` 负责把已完成的标准产物包装进 Bento。这个 Skill 负责路由、状态检查和交付编排，不替代三个生产 Skill 的内容与视觉判断。

## 第一性原理

遵守下面四条原则：

1. **内容只有一个事实源**：标题、主张、准确文字、证据和备注来自 outline/deck；Bento 只能展示，不重新解释内容。
2. **生产与展示分离**：HTML 或 PNG 是生产者产物，Bento 是展示适配器。展示失败不能修改生产者源文件。
3. **通过标准 manifest 交接**：只有 `storyweave-output.json` 通过校验后，才能进入 Express；不要根据网页目录、文件名或截图猜测页面。
4. **每个阶段都可验证**：先验证输入和 QA，再执行下一阶段；任何失败都报告具体项目、页面和恢复动作，不静默降级。

## 路由规则

| 用户目标 | 生产 Skill | 交付路径 |
| --- | --- | --- |
| 需要可编辑文字、形状、表格、图表和逐页 HTML | `$storyweave-html` | HTML draft → approve → build → qa → Express → Bento |
| 需要整页视觉、图片优先或强情绪画面 | `$storyweave-imagegen` | Imagegen draft → approve → prompts → 生成/复核 → build → qa → Express → Bento |
| 已有 HTML 或 Imagegen 标准产物，只需要展示、排序或包装 | `$storyweave-express` | manifest 校验 → Bento build → Bento QA |
| 用户明确要求不包装 Bento | 对应生产 Skill | 完成生产者 QA 后停止，并说明未执行展示适配 |

未明确选择时，按交付目标判断：需要对象级编辑和可审计文字时优先 HTML；需要图片内排版、完整画面或图片式 PPTX 时优先 Imagegen。只要生产者 QA 通过，默认继续调用 Express 构建 Bento；用户明确关闭展示适配时才跳过。

## 标准工作流

### 1. 先确定内容和交付目标

确认主题、受众、用途、语言、预计页数、是否需要图片、是否需要对象级编辑，以及是否要在 Bento 中展示。资料不足时缩短范围或标记缺口，不补造事实。

如果用户要求写稿，先完成事实材料和 Storyboard，再生成页面。不要让视觉主题反过来决定未经证实的内容。

### 2. 运行一个生产 Skill

HTML 路径遵循 `$storyweave-html` 的审批门：

```bash
node <storyweave-html>/scripts/ppt.mjs draft <project> --theme-ref <architecture/style>
node <storyweave-html>/scripts/ppt.mjs approve <project> --theme-ref <architecture/style>
node <storyweave-html>/scripts/ppt.mjs build <project>
node <storyweave-html>/scripts/ppt.mjs qa <project> --json
```

Imagegen 路径遵循 `$storyweave-imagegen` 的逐页生成和复核门：

```bash
node <storyweave-imagegen>/scripts/ppt.mjs draft <project> --theme <architecture/style> --scope authoring
node <storyweave-imagegen>/scripts/ppt.mjs approve <project> --theme <architecture/style>
node <storyweave-imagegen>/scripts/ppt.mjs prompts <project>
# 按 imagegen-jobs.jsonl 调用 $imagegen，保存到 slides/<slide-id>.png
node <storyweave-imagegen>/scripts/ppt.mjs review <project> --slide <slide-id> --pass
node <storyweave-imagegen>/scripts/ppt.mjs build <project>
node <storyweave-imagegen>/scripts/ppt.mjs qa <project> --json
```

Imagegen 请求必须先走内置 `image_gen`；只有内置路径不可用或失败时，才按用户级路由调用 `image-gen-rightcodes` 的 `imagegen-cli`。不得请求 `OPENAI_API_KEY`，不得把 `OPENAI_SUB_*` 值写入项目或日志。

### 3. 自动包装进 Bento

生产者 `qa` 返回通过后，调用本 Skill 附带的编排脚本：

```bash
node <storyweave>/scripts/orchestrate.mjs <project> --no-bento-update --json
```

该脚本会：

1. 读取并校验 `storyweave-output.json`；
2. 检查 producer、kind、版本、页面 ID、路径和画布；
3. 调用 `storyweave-express` 构建 `.bento.html`；
4. 运行 Express QA，确认页数一致、每页只有一个全画布图片、Bento 文档可解析；
5. 返回 producer 与 Bento 的路径、版本、页数和 QA 摘要。

canonical HTML version 2 和 Imagegen/legacy version 1 都可以进入 Express。HTML 页面在 Bento 中会被固定画布截图后作为整页图片；源 HTML 仍是可编辑母版，Bento 不承诺把它还原成对象级 HTML。

### 4. 展示结果

拿到 Bento 输出后，使用应用的 `open_in_codex` 打开生成的 `.bento.html`，或在用户指定的浏览器中打开它。展示层出现问题时，先检查 Bento QA 和 producer manifest，再回到对应生产 Skill 修复；不要直接编辑 Bento 内嵌 JSON 来掩盖生产问题。

## 生产路径的选择依据

### 选择 HTML

HTML 适合：

- 文字、表格、图表、流程和 SVG 需要保持原生可编辑；
- 需要逐页独立入口、稳定页面 ID、主题迁移和 manifest 指纹；
- 需要把素材、证据和页面结构分开管理；
- 页面可以由固定舞台和 CSS/SVG 结构表达。

HTML 不应把整页截图作为主题实现，也不应在 build 阶段临时猜测缺失的 theme、scheme 或素材。

### 选择 Imagegen

Imagegen 适合：

- 图片、空间、光线和整页构图是主要表达载体；
- 文字可以在图片内一次性定稿，且不要求对象级编辑；
- 需要强情绪、发布会或视觉叙事式页面。

Imagegen 页面中的文字必须来自 `exact_text`，数据和事实必须有来源。生成图片不是事实来源；发现乱码、额外文字、裁切错误或主题漂移时，只重生成受影响页面。

### 选择 Express

Express 只消费完成的标准 manifest。它不负责策划、改写文案、重新选择主题或补生成图片。HTML version 2 允许 canonical theme/scheme/render recipe 元数据继续传递到 Bento `meta`；页面本身仍以整页图片展示。

## 失败处理

| 失败 | 处理 |
| --- | --- |
| Storyboard 或 deck 未审批 | 停在生产 Skill 的审批门，先补齐用户确认和准确文字 |
| producer QA 有 blocking | 不调用 Express；修复对应 producer 源后重新 build/qa |
| manifest 缺失或版本不支持 | 报告项目路径和期望格式，不猜测网页或图片目录 |
| 页面文件缺失或 ID 重复 | 修复 producer manifest/输出，保持稳定 ID |
| Bento shell 不可用 | 使用 Express 的可信缓存或随附 shell；无法验证时保留 producer 产物并报告 |
| 单页截图失败 | 只重试对应页面；不得跳过后声称 Bento 完整 |
| Bento QA 失败 | 保留 producer 不变，修复 Express 输入或 shell 后重新包装 |

## 产物关系

```text
outline_draft.json
        ↓ approve
deck_spec.json
        ↓ producer build
index.html / slides/* / storyweave-output.json
        ↓ producer qa 通过
storyweave-express
        ↓
dist/<title>.bento.html
        ↓ Bento QA
展示 / 编辑页面顺序 / 演示
```

`storyweave-output.json` 是两个生产 Skill 与 Express 之间的唯一交接面。`deck_spec.json`、HTML 源文件和 PNG 是生产者的母版；`.bento.html` 是展示派生物。

## 完成标准

只有同时满足以下条件，才可以报告 StoryWeave 任务完成：

- 选择的 producer 已完成自己的 build 和 QA；
- `storyweave-output.json` 的 producer、kind、版本、页面 ID、画布和路径通过校验；
- 默认路径下 Express 已构建 Bento，或用户明确要求跳过并记录原因；
- Bento QA 无 blocking，页面数量与 producer manifest 一致；
- 展示入口已打开，或已明确报告无法打开的环境原因；
- 没有把 Bento 展示结果当作 HTML/Imagegen 源文件，也没有虚构对象级可编辑能力。

## 综合测试

仓库中的综合测试任务位于 `tests/integration/storyweave-all-skills.test.mjs`。它用一个 canonical HTML 项目、一个 Imagegen 合同 fixture 和 Express/Bento 适配分别验证三个 Skill 的交接，不调用真实图片生成服务，避免把网络或账号状态混入合同测试。

```bash
node --test tests/integration/storyweave-all-skills.test.mjs
```

若要测试真实 Imagegen，再单独按照 `$storyweave-imagegen` 的流程替换 fixture，并逐页完成 `review --pass`；真实图片生成失败不能被合同 fixture 的通过结果掩盖。
