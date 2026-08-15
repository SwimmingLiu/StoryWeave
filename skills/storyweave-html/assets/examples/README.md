# Storyweave HTML 示例

`storyweave-demo/` 是纯 HTML 示例：包含演示入口、逐页独立 HTML 和标准输出 manifest，不调用 Imagegen。

生成一个新的示例：

```bash
node scripts/ppt.mjs draft /tmp/storyweave-html-demo --title "AI 原生知识工作流"
node scripts/ppt.mjs approve /tmp/storyweave-html-demo --theme editorial
node scripts/ppt.mjs build /tmp/storyweave-html-demo
node scripts/ppt.mjs qa /tmp/storyweave-html-demo --json
```
