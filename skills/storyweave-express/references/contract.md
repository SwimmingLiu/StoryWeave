# Storyweave 输出协议

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

`kind` 只能是 `html` 或 `image`。所有路径相对 manifest 所在目录解析。页面 ID 必须稳定且唯一；消费者不得根据文件名重新排序。

