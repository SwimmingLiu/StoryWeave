---
name: storyweave-express
description: Package completed Storyweave HTML pages or Imagegen slide images into a Bento presentation for editing slide order, notes, visibility, and delivery. Use only when the user already has a storyweave-output.json producer artifact and explicitly wants Bento presentation or packaging.
---

# Storyweave Express

读取已有的 `storyweave-output.json`，把逐页 HTML 或图片包装为 `.bento.html`。本 Skill 只负责展示适配，不策划内容、不改写文案、不生成视觉主题。

## 输入与输出

- 输入格式固定为 `storyweave/slides` version 1。
- `kind: html` 时，用浏览器按 manifest 指定画布逐页渲染 HTML，再作为整页图片写入 Bento。
- `kind: image` 时，直接读取 manifest 中的逐页图片。
- 输出为 `.bento.html`，每页仅包含一个全画布 image element；源 HTML 或源图片仍是内容母版。
- HTML 在源文件中可编辑，进入 Bento 后不承诺对象级编辑。Bento 负责顺序、显隐、复制、备注和展示。

## 必经流程

1. 定位生产者项目根目录及 `storyweave-output.json`，验证格式、版本、页面 ID、画布和资源路径。
2. 不接受未完成的 Storyboard、Imagegen job 或任意网页目录来猜测页面；缺少标准 manifest 时停止并报告。
3. HTML 输入必须逐页独立打开。使用 Playwright 在固定画布下等待页面与字体加载，再截图；不修改源 HTML。
4. 图片输入必须可读且比例匹配。不得拉伸错误比例的图片来掩盖问题。
5. 验证 Bento shell 的来源与 SHA-256，只替换唯一的 `#bento-doc` JSON 块。
6. 覆盖已有输出时保留 `docId` 和 Bento 拥有的未知字段；页面 ID 沿用输入 manifest。
7. 运行 `qa`，确认页数一致、每页只有一个全画布图片、资源已内嵌且 Bento 文档可解析。

## 异常与兜底

- manifest 缺失、格式错误、页面 ID 重复或资源缺失：拒绝构建。
- HTML 输入缺少 Playwright：报告依赖缺失；不要退化为不受控的网页截图工具。
- Bento shell 缺失、多个 `#bento-doc`、格式错误或校验失败：拒绝写入。
- 单页渲染失败：只重试该页；不得跳过后仍声称完整交付。
- 网络不可用：仅使用已校验缓存或 Skill 附带的 Bento shell。

## 命令

```bash
node scripts/ppt.mjs build <producer-project> --out <presentation.bento.html>
node scripts/ppt.mjs qa <producer-project> --file <presentation.bento.html> --json
node scripts/ppt.mjs bento status --json
node scripts/ppt.mjs bento update --force --json
node scripts/ppt.mjs doctor --json
```

## 参考文件

- `references/contract.md`：`storyweave/slides` version 1 输入协议。
- `references/workflow.md`：HTML 栅格化、图片读取、Bento 构建和更新顺序。
- `assets/bento/SOURCE.json`：随附 Bento shell 的来源与校验信息。
