# Imagegen 生成与结果收集

1. 编辑 schema 4 草稿，写入叙事、逐页主张、结构化内容、事实来源与备注，取得用户确认。
2. 执行 `approve`，保存 `deck_spec.json` 与 `plans/imagegen.json`。只改主题或参考时使用 `replan`，保留确认内容。
3. 执行 `prompts`，读取 `imagegen-jobs.jsonl` 中的准确文字、构图与工具输入。
4. Agent 调用真实 `image_gen`，按 `tool_input.referenced_image_paths` 附图。内置工具失败或不可用时使用已配置 `image-gen-rightcodes` 回退。
5. 保存实际工具调用记录与返回图片，执行 `record-result --receipt`。
6. 查看图片，核对文字、可读性、裁切、额外元素、主题与节奏，再执行 `review --pass` 或 `--fail`。
7. 图片齐全且复核通过后，执行 `build`、`qa`，再导出或包装 Bento。

## 保存实际调用与 receipt

调用日志由实际参数与结果形成，移除凭证后保存。以下路径代表真实输入与返回文件，不是可填空的执行证明。

```json
{
	"tool": "image_gen",
	"arguments": {
		"referenced_image_paths": ["/absolute/project/references/selected-page.png"]
	},
	"result": { "path": "/absolute/returned-slide.png" }
}
```

将输出和调用日志交给结果收集：

```json
{
	"slide_id": "s03",
	"tool": "image_gen",
	"reference_mode": "attached",
	"tool_call": { "log_path": "/absolute/tool-call.json" },
	"output_path": "/absolute/returned-slide.png"
}
```

```bash
node scripts/ppt.mjs record-result <project> --receipt <actual-result.json>
node scripts/ppt.mjs review <project> --slide s03 --pass --notes "实际图片复核结论"
```

`reference_mode` 使用实际对应的 `attached`、`prompt-only` 或 `unsupported`。结果收集核对日志中附件的路径与选中参考字节，复制图片和证据到项目内，将复核设为待检查。计划中的参考列表不代替实际输入，receipt 也不构成独立供应商证明。

## 修改受影响页面

`status` 区分 `needs-images`、`needs-review` 和 `ready-for-qa`。缺图时状态与构建退出码为 3，待复核为 2。重新编译保留任务指纹未变页面的有效结果与复核，变化页面重新生成。

图片复核按“文字准确、文字可读、主体与裁切、主题、节奏”检查，针对具体问题重生成该页。替换 PNG 后旧 Review 不再有效。当前没有 OCR，真实图像必须由 Agent 或用户查看。
