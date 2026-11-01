# 持续集成与评测

[CI 工作流](../.github/workflows/ci.yml)在每次 push、PR 和手动触发时运行。使用 Ubuntu 24.04、Node.js 24、Python 3.12，Node 依赖由根目录锁文件固定，Pillow 版本由验证 Skill 固定。浏览器与依赖从干净环境安装。

| 阶段 | 检查内容 |
| --- | --- |
| 生成资产 | 四个 Skill 的 runtime 与权威源码一致，19 套主题预览与生成记录哈希一致，参考图库 catalog、HTML 和覆盖统计一致 |
| 完整测试 | 核心、案例库、各生成器、适配器、独立分发和视觉评审判定回归 |
| HTML | 公开草稿、审批、构建、浏览器 QA、双视口、播放、主题重规划和 v2/v3 兼容 |
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

自动化通过表示本次技术路径和明确的缺图门通过。它不证明本次调用了图片服务、执行了 OCR，或人工接受了视觉效果。整体报告的 needs-images 与 `visual_acceptance: not-run` 继续保留；CI 不将它们改写为产品全部通过。人工 A/B 评审按[验证 Skill](../.agents/skills/verify-storyweave/SKILL.md)执行，相关评测也需记录同一提交的 CI 链接。

每次运行以 `storyweave-verification-<run-id>-<attempt>` 保留 14 天 artifact。失败时也上传测试日志、命令、报告、截图与 trace；临时缓存和内嵌完整原图的离线 HTML 不上传。下载后可查看 `tmp/ci/<evaluation-run-id>/summary.json` 与各功能的 summary、actions 和 trace。
