# 持续集成与评测

[CI 工作流](../.github/workflows/ci.yml)在每次 push、PR 和手动触发时运行。使用 Ubuntu 24.04、Node.js 24、Python 3.12，Node 依赖由根目录锁文件固定，Pillow 版本由验证 Skill 固定。浏览器与依赖从干净环境安装。

| 阶段 | 检查内容 |
| --- | --- |
| 生成资产 | 四个 Skill 的 runtime 与权威源码一致，参考图库 catalog、HTML 和覆盖统计一致 |
| 完整测试 | 核心、案例库、各生成器、适配器、独立分发和视觉评审判定回归 |
| HTML | 公开草稿、审批、构建、浏览器 QA、双视口、播放、主题重规划和 v2/v3 兼容 |
| HTML 视觉回归 | 杂志、瑞士风各 8 页的真实浏览器截图、批准稿不变、图片布局、连线与比较权重，以及已评审基线比较 |
| 参考图库 | 从原来源准备全量图片；核对字节、解码、离线内嵌、双视口逐图显示、筛选、大图及错误重试 |
| 适配与安装 | 全局 Bento、直接 Express、生产者保护及四包独立安装的真实业务路径 |
| Imagegen | 编译任务及准确文字，缺图时 status/build 必须返回 needs-images 和退出码 3 |

图库下载最多尝试三次，每次复用已校验成功的原图。最终缺图或损坏时任务失败，不跳过图库来使 CI 通过。原图可用性依赖外部来源；错误日志保留具体来源。重试交互另在外部图片请求边界注入一次失败，它不代表实时服务器可用性。

每次评测完成前都检查对应提交的 CI。新提交推送后自动执行；已有分支的重复评测可手动运行：

```bash
gh workflow run ci.yml --ref <branch>
gh run list --workflow ci.yml --branch <branch>
gh run watch <run-id> --exit-status
```

核对运行详情中的提交 SHA，不能把旧提交的成功用于当前代码。PR 合并前要求最新提交的 `Verification` 成功；仓库主分支规则将该检查作为合并条件。

可复用入口是 `npm run verify:ci -- --run-id <unique-id> --reference-cache <absolute-directory>`。它串行驱动八个功能，单独断言 Imagegen 的预期缺图结果，结束或失败时清理自有工作目录，再重新读取报告核对证据哈希。任一意外退出、未执行功能或证据不一致都会使 CI 失败。

自动化通过表示本次技术路径、明确的缺图门和固定 HTML 样张的已评审截图匹配。它不证明本次调用了图片服务、执行了 OCR，或接受了任意项目的新画面。八项功能报告中的 needs-images 与未运行的人工验收继续保留，固定样张的视觉结果单列在 `tmp/visual-ci/result.json`。

每次运行以 `storyweave-verification-<run-id>-<attempt>` 保留 14 天 artifact。失败时也上传测试日志、命令、报告、截图与 trace；临时缓存和内嵌完整原图的离线 HTML不上传。下载后可查看 `tmp/ci/<evaluation-run-id>/summary.json` 与各功能的 summary、actions 和 trace。

## 两套八页的视觉回归

<!-- The original CI exercised technical fixtures but never compared the actual sixteen-page visual sample. -->
`npm run verify:visual -- check --out <absolute-directory>` 从公开八页内容创建杂志、瑞士风两套项目，通过公开 CLI 批准、重规划、构建和 QA。样本审批只服务测试；真实项目仍按已有授权确认内容。两种主题共用内容修订，视觉修改前后批准稿字节一致。桌面与竖屏覆盖独立页、画廊的每页，另检查分流汇合方向、连线端点、断词、中性比较权重及布局示意素材。

共享基线位于 `.agents/skills/verify-storyweave/fixtures/visual-baseline/`，记录 CI 截图、内容、主题、环境与署名观察。`review.json` 覆盖 16 页的主张、阅读、关系、构图、素材，以及两套的连贯性和节奏。只有全部已查看且没有失败、不确定或阻断装饰问题时才能保存基线；用户拒绝过的相同 s06 图片不能改判。

本次截图、内容、视觉策略和渲染环境与基线一致时为 `accepted-baseline`。任一变化或缺少基线时为 `needs-review`，退出码 4，使 `Verification` 失败。差异不自动表示退步或改善，也不自动更新基线。浏览器或几何失败同样阻断。

每次运行另保留 `storyweave-html-visual-<run-id>-<attempt>` artifact，包含两套完整 HTML、桌面与竖屏截图、`contact-sheet.html`、逐页 `comparison.html`、`capture.json`、`result.json` 和 `review-template.json`。下载后打开对照，实际查看每页与整套，再填写模板。评审者声明熟悉程度，不能把模板中的图片哈希视为已经看图。

```bash
gh run download <run-id> --name storyweave-html-visual-<run-id>-<attempt> --dir ./visual-evidence
node .agents/skills/verify-storyweave/scripts/ci-visual.mjs accept --capture ./visual-evidence --review ./filled-review.json
git add .agents/skills/verify-storyweave/fixtures/visual-baseline
git commit -m "test: update reviewed HTML visual baseline"
git push
```

`accept` 只接受来自 GitHub Actions 的真实截图，核对图片哈希、评审绑定与全部维度。提交更新后必须重跑新提交的 CI。不能因构建成功、像素差异很小或为了合并而填写通过；存在退步时先修复页面。人工 A/B 判断的细则见[视觉评测参考](../.agents/skills/verify-storyweave/references/visual-review.md)。
