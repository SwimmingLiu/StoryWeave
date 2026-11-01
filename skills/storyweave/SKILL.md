---
name: storyweave
description: Orchestrate StoryWeave presentation work from content discovery through HTML or Imagegen production, quality checks, automatic Bento packaging, and in-app presentation. Use when users ask to create, compare, regenerate, preview, package, or show a StoryWeave presentation, or when the output should be displayed or edited in Bento.
---

# StoryWeave 全局编排

StoryWeave 使用一份确认内容、两个生成器和一个 Bento 展示适配器。`storyweave-html` 生成原生 HTML，`storyweave-imagegen` 生成整页图片。本 Skill 推进内容确认、工具调用和交付，随包的 `runtime/bento/` 负责包装；独立 `storyweave-express` 也可消费相同产物。

## 选择生成路径

| 用户目标 | 生产 Skill | 交付路径 |
| --- | --- | --- |
| 需要原生文字、图形、表格或 SVG 编辑 | `$storyweave-html` | 草稿、确认、HTML 计划、构建、浏览器 QA、Bento |
| 需要整页图片构图或图片式交付 | `$storyweave-imagegen` | 草稿、确认、图片计划、任务、真实生成与复核、构建、QA、Bento |
| 已有标准产物，需要展示或排序 | 本 Skill 或 `$storyweave-express` | 核对当前生产者 QA、包装、适配 QA |
| 明确要求原始页面交付 | 对应生产 Skill | 完成生产者 QA 后交付 HTML 或图片画廊 |

按编辑与表达需求选择生成器。默认在生产者 QA 通过后继续包装 Bento。内容理解和图片服务调用由 Agent 执行，`orchestrate.mjs` 只消费已经完成的生产者项目。

## 确认内容

检查主题、受众、用途、语言、展示场景、预计页数与资料缺口。写出中心含义、叙事、逐页主张、事实来源、结构化内容和备注，再取得用户确认。事实来自项目材料；设计参考单独记录，不把案例数字或论断写入新项目。

新结构化项目使用 schema 4 的 `deck_spec.json`。核心从内容生成 `exact_text` 和 `revision`，HTML 与 Imagegen 各自保存绑定修订的 schema 1 计划。只改主题或版式时运行所属生成器的 `replan`；修改文字、来源或关系时回到草稿重新确认。

## 运行生产者

在确认草稿后运行 HTML 路径：

```bash
node <storyweave-html>/scripts/ppt.mjs draft <project> --theme-ref systems/ink-blue-grid
node <storyweave-html>/scripts/ppt.mjs approve <project> --theme-ref systems/ink-blue-grid
node <storyweave-html>/scripts/ppt.mjs build <project>
node <storyweave-html>/scripts/ppt.mjs qa <project> --json
```

`draft` 创建示例输入，Agent 先替换为本项目内容。`plans/html.json` 保存视觉计划，确认内容保存在 `deck_spec.json`。HTML 浏览器检查必须执行，blocking 与 degraded 均为零。

Imagegen 使用逐页任务和复核：

```bash
node <storyweave-imagegen>/scripts/ppt.mjs draft <project> --theme editorial/paper-magazine
node <storyweave-imagegen>/scripts/ppt.mjs approve <project> --theme editorial/paper-magazine
node <storyweave-imagegen>/scripts/ppt.mjs prompts <project>
# Agent 按任务调用 image_gen，并保存真实调用日志、返回图片和 receipt。
node <storyweave-imagegen>/scripts/ppt.mjs record-result <project> --receipt <actual-result.json>
node <storyweave-imagegen>/scripts/ppt.mjs review <project> --slide s01 --pass --notes "实际图片复核结论"
node <storyweave-imagegen>/scripts/ppt.mjs build <project>
node <storyweave-imagegen>/scripts/ppt.mjs qa <project> --json
```

为每页重复结果收集和复核。任务的 `tool_input.referenced_image_paths` 是实际待传参考图，不能用提示词中的图名代替附件。内置 `image_gen` 优先；不可用或失败时直接使用已安装 `image-gen-rightcodes` 的 `imagegen-cli` 回退。使用已配置的 `OPENAI_SUB_*`，不索取另一套密钥，不把凭证写入项目或日志。

`needs-images` 表示缺图，`needs-review` 表示图片齐全但尚未复核。`review --pass` 记录所见图片字节，不能代替查看真实图片；当前不执行 OCR。

## 包装与展示 Bento

生产者完成构建与 QA 后调用随包工作流：

```bash
node scripts/orchestrate.mjs <project> --no-bento-update --json
```

工作流重新读取 `storyweave-output.json`、`qa_report.json` 和实际文件，核对格式、producer、kind、版本、ID、画布、路径与 `artifact_binding`。只有当前文件对应已通过的生产者 QA，才进入 Bento。

全局包自带 core、Bento 和 shell，无需相邻 Express。HTML 按固定画布截图，Imagegen 直接复用 PNG；Bento 每页为一张全画布图片，保留 ID、顺序和备注。适配器另写 `qa/<output-id>.adapter-report.json`，保留生产者报告与原始页面。

打开返回的 `.bento.html`，核对实际显示。应用提供 `open_in_codex` 时可使用该入口，否则使用用户指定浏览器。Bento 的顺序、显隐和备注编辑不等于 HTML 文字与形状对象编辑。

## 处理失败

| 情况 | 恢复动作 |
| --- | --- |
| 内容尚未确认或确认稿已被改写 | 回到草稿确认，不跳过审批 |
| 计划、参考或规则过期 | 保留确认内容，重新规划，再构建和 QA |
| 缺图或复核失败 | 补齐真实结果或重生成受影响页面，再复核 |
| QA blocking、degraded 或文件指纹不匹配 | 修复生产者并重新 QA |
| manifest 缺失、路径越界或页面 ID 重复 | 修复生产者清单，不按目录猜测页面 |
| Bento 截图、shell 或适配 QA 失败 | 保留生产者，修复适配器后重新包装 |

## 完成标准

生成器完成自己的构建与当前文件 QA，产物清单通过公共校验。默认路径另有通过的 Bento 适配报告与实际展示证据。原始页面交付按用户选择结束。缺少前提或未执行的入口按实际状态报告，不能用合同 fixture 证明真实生图质量。

运行实现位于 `runtime/core/`、`runtime/bento/` 与 `runtime/workflow/`。仓库开发只修改权威源码并重新打包，不手改运行副本。
