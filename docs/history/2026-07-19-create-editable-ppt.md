# Image-first PPT 实施计划

> 目标：把现有 PPT Skill 的主题与内容策略收敛为整页生图流程，并保留可修改的 JSON/manifest 入口。

## 任务

- [x] 盘点八个去重主题与参考 Skill 的视觉语法。
- [x] 写入中心含义、叙事逻辑、逐页主张的内容草稿 Gate。
- [x] 实现 `outline_draft` 校验、批准、主题 prompt 编译和 generation manifest。
- [x] 以 `imagegen` 为必需子 Skill，支持内置工具和用户明确授权的 CLI fallback。
- [x] 移除可见 editable text overlay，渲染器只消费整页图片。
- [x] 参考 Bento 实现单文件离线 bundle：JSON source of truth、data URI 资产、统一 runtime、稳定视觉锚点。
- [x] 生成八主题、三页共用内容的 24 条 imagegen 任务，并保留本地回退素材的来源标记。
- [x] 建立桌面/移动画廊与逐主题翻页 QA。
- [ ] imagegen 账户恢复 active plan 后，重新执行 24 个任务并通过逐页视觉 Review。

## 验证命令

```bash
node --test skills/presentation/create-editable-ppt/tests/*.test.mjs
node skills/presentation/create-editable-ppt/scripts/ppt.mjs doctor --json
node skills/presentation/create-editable-ppt/scripts/verify-image-showcase.mjs \
  --root skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase \
  --url http://127.0.0.1:4190
```
