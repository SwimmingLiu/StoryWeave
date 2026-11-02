# StoryWeave 设计案例库

案例库以完整案例保存来源、作者、页序、页面资源及可获得的演讲文本和视频时点。同一案例分别分析叙事与视觉，并记录适用内容、受众、密度和限制。

`cases/<case-id>/source.json` 保存元信息，`analysis.md` 保存分析，`index.json` 由元信息生成。页面资源路径相对案例库的父目录解析，适合关联仓库已有页面或截图。原始 PDF、视频与外部来源可以作为元信息链接保存；图片选择不自动下载远程文件。

```bash
node scripts/index-design-library.mjs build
node scripts/index-design-library.mjs check
node scripts/index-design-library.mjs search --tags workflow --role comparison
node scripts/index-design-library.mjs inspect storyweave-knowledge-flow
```

检索返回完整案例上下文。选择参考时，再明确案例 ID、页 ID 和用途。用途可为 `narrative`、`palette`、`layout`、`diagram`、`typography` 或 `rhythm`；可选 `slide_id` 将视觉参考限制到当前项目的一页。

```json
[
	{ "case_id": "storyweave-knowledge-flow", "page_id": "s03", "purpose": "layout", "slide_id": "s03" }
]
```

生成器将选中的图片复制到项目 `references/` 并记录哈希。HTML 计划记录引用影响的布局决定，Imagegen 任务另外提供待传入工具的图片路径。选中了图片不等于工具实际收到图片，实际调用记录与结果需要由 Agent 交回生成器保存。

案例入库不自动创建主题。方法在新内容中通过适用性验证后，才提炼到现有叙事、architecture、style 或 visual scheme 规则。原稿和完整图片集合不进入每个 Skill 的运行包。

当前仅有一个标明为生成验证样本的案例，用于验证机制。后续收录真实演讲时，未知作者、文本或时间点保留为空，不补造来源。

`html-template-references/` 保存已有 HTML 源文件的 34 组模板索引。`presentation-references/` 保存演讲与分享稿的整页样张、样式说明与提示词链接。两者独立于上述完整案例索引；选定原图后，再按完整案例格式捕获到项目。`ai-teaching-references/` 为独立知识插画的研究存档。

## Imagegen 引用与结果交接

新项目默认使用 schema 4，批准内容与私有图片计划分别保存。指定案例库与选择文件后，`plan` 将所选图片捕获到项目，再由 `prompts` 输出实际工具输入路径。

```bash
node skills/storyweave-imagegen/scripts/ppt.mjs draft /tmp/storyweave-image-example
node skills/storyweave-imagegen/scripts/ppt.mjs approve /tmp/storyweave-image-example
node skills/storyweave-imagegen/scripts/ppt.mjs plan /tmp/storyweave-image-example --library design-library --references selections.json
node skills/storyweave-imagegen/scripts/ppt.mjs prompts /tmp/storyweave-image-example
node skills/storyweave-imagegen/scripts/ppt.mjs status /tmp/storyweave-image-example --json
```

`imagegen-jobs.jsonl` 中的 `reference_images` 记录选择和用途，`tool_input.referenced_image_paths` 提供待传给工具的绝对路径。Agent 按内置工具优先、已配置 CLI 回退的路由调用工具；生成器不发起另一套图片 API 请求。

实际调用日志保存工具名称、真正传入的图片列表和返回图片路径。以下是日志格式，路径值由真实调用填写。

```json
{
	"tool": "image_gen",
	"arguments": { "referenced_image_paths": ["/tmp/storyweave-image-example/references/selected-page.png"] },
	"result": { "path": "/tmp/returned-slide.png" }
}
```

结果收集需要单独的 receipt。`reference_mode` 使用 `attached`、`prompt-only` 或 `unsupported`，与实际请求对应。

```json
{
	"slide_id": "s03",
	"tool": "image_gen",
	"reference_mode": "attached",
	"tool_call": { "log_path": "/tmp/tool-call.json" },
	"output_path": "/tmp/returned-slide.png"
}
```

```bash
node skills/storyweave-imagegen/scripts/ppt.mjs record-result /tmp/storyweave-image-example --receipt /tmp/result-receipt.json
node skills/storyweave-imagegen/scripts/ppt.mjs review /tmp/storyweave-image-example --slide s03 --pass --notes "记录实际图片复核结论"
```

收集操作核对真实请求记录中的附图路径与已选图片字节，复制结果和日志，随后将该页复核状态设为 pending。日志必须移除凭证。仅填写 receipt 不能独立证明服务执行，复核仍要保留可查看的实际调用证据和真实图片。

缺少图片时，`status` 与 `build` 返回 `needs-images` 和退出码 3；图片齐全但尚未复核时返回 `needs-review`。原始 v2、v3 项目继续读取，`draft --schema 3` 可创建兼容样本。修改主题只重做计划，已确认内容修订保持不变。
