# Bento 展示包装

通过全局工作流与直接 Express 包装已验证产物，核对顺序、备注和实际首图显示。

## Sub-features

- `bento-orchestrate` 使用全局包内置的 Bento 构建与 QA。
- `bento-direct` 使用独立 Express build 与 qa。
- `bento-document` 核对页数、ID、顺序、备注与全画布图片。
- `bento-view` 打开两份 Bento，确认首页实际可见。

## How to get to it (user POV)

生产者 build 与 qa 通过后，运行 `skills/storyweave/scripts/orchestrate.mjs`，或使用 `skills/storyweave-express/scripts/ppt.mjs build` 与 qa。两条入口都重新校验生产者的当前文件绑定，生成独立适配报告。打开返回的 `dist/*.bento.html`。

## Driving it with verify-storyweave

完成 doctor 与 launch，保留 `VERIFY_RUN_ID`。helper 创建 HTML 样本并运行浏览器 QA，Bento 使用本次空缓存。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive bento --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

commands 中的全局与直接 Express 路径同时使用本次 `STORYWEAVE_BENTO_CACHE_DIR` 和 `--no-bento-update`。`bento-shell.json` 分别记录随附 `.html.br` 存储哈希、恢复后的官方原稿哈希与缓存位置，文档 `meta.bento_runtime` 记录实际 shell 来源。

helper 核对页面 ID、顺序和备注，每页仅一个全画布图片，并对比包装前后源 HTML 哈希。生产者 QA 保留，适配器报告另存于 `qa/<output-id>.adapter-report.json`。

浏览器打开两份 Bento，等待 Slideshow 按钮和 `.ed-stage .bento-slide .bento-el-image img` 可见，图片 decode 后核对 src 与文档首页相同、宽度大于 300 像素、比例为 16:9。`bento-1.png`、`bento-2.png`、actions 与 trace 保留实际首屏证据。

## Gotchas

- 只有 `--no-bento-update` 仍可能读取用户缓存，必须同时隔离缓存目录。
- HTML 包装为图片，Bento 不还原文字、表格和形状对象。
- 适配 qa 同时检查文档与浏览器首图，不等于全部页面逐页播放已验证。
- Slideshow 按钮只作为就绪标记，helper 未点击，也未操作编辑功能。
- 直接 Express 与全局入口分别报告，不能用一个替代另一个的结果。
- 适配通过只证明包装一致和首图显示。上游视觉评测若退步或未完成，Bento pass 不会使其变为视觉通过；总报告继续保留上游结论。
