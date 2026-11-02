# StoryWeave 产物与 QA 协议

`storyweave-output.json` 描述已完成页面，公共规则由 `runtime/core/artifact.mjs` 维护。

```json
{
	"format": "storyweave/slides",
	"version": 1,
	"producer": "storyweave-html",
	"kind": "html",
	"title": "标题",
	"canvas": { "width": 1280, "height": 720 },
	"entry": "index.html",
	"slides": [
		{ "id": "s01", "role": "cover", "source": "slides/s01.html", "claim": "主张", "notes": "备注" }
	]
}
```

| version | producer | kind |
| --- | --- | --- |
| 1 | `storyweave-html` | `html` |
| 1 | `storyweave-imagegen` | `image` |
| 2 | `storyweave-html` | `html` |

v2 携带 canonical HTML 的主题、scheme 与渲染指纹。内容 schema 4 与计划 schema 1 不改变这份交接协议版本。

路径相对生产者项目解析，不能通过 `..`、绝对路径或符号链接越出项目。画布使用正整数 16:9 尺寸，页面 ID 稳定且唯一，消费者按清单顺序读取。

项目另有生产者 `qa_report.json`，要求 `export_ready: true`、blocking 与 degraded 为零，以及有效 `artifact_binding`。绑定包含清单哈希、输入、入口、页面与整体指纹。展示入口重新读取实际文件验证一致性，缺少绑定或旧 QA 时要求重新检查。

适配结果使用 `qa/<output-id>.adapter-report.json`，记录源生产者指纹、Bento 输出哈希与检查结果。适配报告不替代生产者报告。
