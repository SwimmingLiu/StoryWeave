# 设计案例检索与参考应用

检索案例，在 HTML 规划中使用具体参考，核对所选页在项目内的捕获与哈希。

## Sub-features

- `case-index` 检查生成索引与案例元信息一致。
- `case-search` 按标签检索完整案例。
- `case-inspect` 查看完整页序、分析文本、案例类型与未知作者。
- `case-reference` 在批准 HTML 时指定案例页、用途与实际应用。
- `case-capture` 将参考图片捕获到项目并核对字节哈希。

## How to get to it (user POV)

从仓库根目录运行 `node scripts/index-design-library.mjs search --tags comparison`，使用 inspect 查看案例分析。将案例 ID、页 ID、用途与 HTML `application` 写入选择 JSON，再通过 HTML `approve` 或 `replan` 的 `--library` 和 `--references` 参数传入。

生成计划的 `references` 指向项目内图片，`reference_applications` 记录实际布局、色调、强调色或字体决定。之后正常构建、QA 并打开页面。

## Driving it with verify-storyweave

先完成 doctor 与 launch，保留 `VERIFY_RUN_ID`，确保案例索引和所引用截图可读。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive design-library --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

<!-- A default comparison layout alone could not show that a selected reference changed the page. -->
检查 commands 中的索引 check、标签 search、inspect 和带引用的 HTML 审批。`search.json`、`inspect.json` 保存完整上下文，`selected-reference.json` 保存捕获记录。计划应包含 `storyweave-knowledge-flow/s03`、比较布局及深色 tone 的 applied 记录，参考路径位于项目内，文件哈希与记录一致。

浏览器的 s03 应实际显示 tone-dark；默认浅色对照页因此产生可观察的变化。选择与应用分别断言，不凭相同的默认布局截图推断应用成功。

浏览器继续核对实际 HTML，保留逐页截图、trace 与整套缩略图。入口与结果以 summary 为准。

## Gotchas

- 当前案例是六页仓库生成截图，类型为 `generated-verification-example`，作者未知。它不代表优秀人工案例或已验证设计规则。
- 只选中参考页不表示实际应用，HTML application 必须说明具体决定。
- 本路径证明 HTML 引用，不证明 Imagegen 实际附图，也不证明案例方法适用于新内容。
- 案例库不自动下载远程资源，也不随各 Skill 安装。已捕获项目可以独立保留所用图片。

<!-- The external slide gallery has separate delivery and display contracts; it is now a mapped drive. -->
演讲与分享稿的外部内容页由 [reference-gallery](reference-gallery.md) 单独验证。本路径继续验证 HTML 的项目内参考捕获与实际应用。
