# StoryWeave 综合测试任务

`storyweave-all-skills.test.mjs` 验证三个 Skill 的标准交接：

1. `storyweave-html` 生成 canonical HTML，完成 build/qa，并输出 version 2 manifest；
2. `storyweave-imagegen` 生成 prompts，使用确定性的 16:9 PNG fixture 模拟已通过复核的页面，完成 build/qa；
3. `storyweave` 读取两个 producer manifest，自动调用 `storyweave-express`，构建并检查 Bento 文件。

测试不会调用真实图片生成 API，也不会联网更新 Bento shell。它验证的是文件协议、页面数量、路径、版本、Bento JSON 和适配器行为；真实 Imagegen 质量仍需按 `storyweave-imagegen` 流程逐页目视复核。

运行：

```bash
node --test tests/integration/storyweave-all-skills.test.mjs
```
