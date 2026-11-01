---
name: storyweave-express
description: Package completed StoryWeave HTML pages or Imagegen slide images into a Bento presentation for editing slide order, notes, visibility, and delivery. Use when a storyweave-output.json producer artifact has passed current producer QA and the user wants Bento presentation or packaging.
---

# StoryWeave Express

把通过当前生产者 QA 的 HTML 或图片包装为 `.bento.html`，保留页面 ID、顺序和备注。内容策划、视觉生成与源页面修改归生产者负责。运行实现位于 `runtime/core/` 和 `runtime/bento/`。

## 输入与输出

输入是项目根目录中的 `storyweave-output.json`、`qa_report.json` 与实际页面。公共核心验证清单与 `artifact_binding`，直接 Express 和全局编排使用同一规则。旧报告缺少绑定，或页面、计划、素材与报告不一致时，先重新运行生产者 QA。

清单支持 `storyweave/slides` v1 的 HTML、Imagegen，以及 v2 的 canonical HTML。所有资源路径相对项目解析，ID 稳定唯一，画布为 16:9。

`kind: html` 时用浏览器按固定画布截图，缓存绑定页面、素材与渲染条件，输出绑定生产者指纹；`kind: image` 时直接读取 PNG。Bento 每页只有一张全画布图片，HTML 的文字与形状对象编辑能力保留在源文件中。

## 包装与检查

1. 定位生产者项目，读取并验证公共清单、当前 QA 和文件指纹。
2. 按清单页序截图 HTML 或读取图片，等待字体和资源就绪，不修改源文件。
3. 校验 Bento shell 来源与 SHA-256，只替换唯一的 `#bento-doc` JSON 块。
4. 写入 Bento 文档。覆盖已有输出时保留 `docId` 和适配器支持的未知字段。
5. 运行 `qa`，核对页数、ID、顺序、备注、内嵌资源和全画布图片。
6. 打开输出，查看实际页面显示，再交付路径与检查结果。

适配 QA 写入 `qa/<output-id>.adapter-report.json`，不覆盖生产者 `qa_report.json`。HTML v2 的主题、scheme 和 render recipe 元数据继续传入 Bento `meta`，页面仍为图片。

## 命令

从本 Skill 目录运行：

```bash
node scripts/ppt.mjs build <producer-project> --out <presentation.bento.html> --no-bento-update
node scripts/ppt.mjs qa <producer-project> --file <presentation.bento.html> --json
node scripts/ppt.mjs bento status --json
node scripts/ppt.mjs bento update --force --json
node scripts/ppt.mjs doctor --json
```

网络不可用时使用已校验缓存或随附 shell。验证隔离缓存时，同时设置本次工作目录的 `STORYWEAVE_BENTO_CACHE_DIR` 和 `--no-bento-update`；只有后者仍可能读取用户缓存。

## 失败处理

manifest 无效、生产者 QA 过期、路径越界、缺页或重复 ID 时拒绝构建。缺少 Playwright 时报告依赖，保留生产者产物。shell 缺失、校验失败或多个 `#bento-doc` 时拒绝写入。单页截图失败后修复该页，完整交付不能跳页。

适配失败只重做包装与适配检查。源 HTML、PNG 和生产者报告保持作为恢复依据。文档可解析不等于浏览器已正确展示；Bento 自身的编辑和播放交互按实际执行范围单独验证。

## 参考文件

| 文档 | 内容 |
| --- | --- |
| [contract](references/contract.md) | 公共产物协议与当前 QA 绑定 |
| [workflow](references/workflow.md) | 栅格化、缓存、构建和报告所有权 |
| [shell 来源](assets/bento/SOURCE.json) | 随附 shell 的来源与校验信息 |
