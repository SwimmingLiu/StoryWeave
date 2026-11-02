# 独立 Skill 包体积优化验证

四个 Skill 的必需运行文件合计从 1,981,958 字节降到 1,578,614 字节，减少 403,344 字节，约 20.4%。四包仍分别携带自己的应用代码与资源。HTML、core 源码保持原字节，九份 HTML 与十六张双视口截图前后逐字节一致。

## 缩减来源

| 修改 | 原有开销 | 当前处理 |
| --- | --- | --- |
| Bento 随包资源 | Express 与全局包各保存 677,480 字节原始 HTML | 官方原稿集中在 `vendor/bento/`，两包各保存 503,893 字节 Brotli，解压后核对官方 SHA |
| 适配器 core | 两包各带未使用的内容审批、主题模块与合同 | 按入口依赖删除这些副本 |
| HTML 运行模块 | 携带 CLI 未导入的 `html/assets.mjs` | 从生成运行包删除，源码保留供实际调用者使用 |
| 生成 JSON | 输出 schema、运行清单和包配置含格式空白 | 使用紧凑序列化，字段和值保持一致 |

`runtime/<source-relative-path>` 布局保持，模块没有转换。两个生成器继续各自携带需要的公共核心。没有共享全局运行时、相邻 Skill 导入、硬链接去重或启动时解包目录。

依赖由构建专用的 Node 语法解析器提取，不执行源码。静态 import、多行、side-effect import 和 re-export 均有检查；新增计算式导入、裸第三方依赖、越界路径、符号链接和缺失模块会拒绝打包。现有 `optionalDependency()` 仍只负责已经解析的第三方加载。

## 同口径的文件字节

运行文件口径包含 installer、CLI、runtime、schema、合同及必需素材，包含 `draft` 使用的 `content-v4.example.json`。它排除文档、`assets/examples/`、测试和第三方依赖。完整安装口径另外包含文档与示例，按照安装器实际复制范围统计。

| Skill | 运行文件，优化前 | 运行文件，优化后 | 完整安装，优化前 | 完整安装，优化后 |
| --- | ---: | ---: | ---: | ---: |
| storyweave-html | 260,198 | 246,045 | 611,888 | 597,735 |
| storyweave-imagegen | 239,496 | 229,204 | 27,643,909 | 27,633,617 |
| storyweave-express | 741,632 | 551,841 | 748,083 | 558,599 |
| storyweave | 740,632 | 551,524 | 746,962 | 557,854 |
| 合计 | 1,981,958 | 1,578,614 | 29,750,842 | 29,347,805 |

运行文件约为 `1.89 MiB → 1.51 MiB`。完整安装目录减少约 1.35%，Imagegen 的约 27 MB 主题示例仍是主要部分。本轮保留示例与主题，没有以删除图片放大缩减比例。

此前记录的 1,978,900 字节采用较窄口径，排除了必需的 `content-v4.example.json`，且对应当时文件状态。本表使用本轮修改前保存的基线和同一脚本重新计数，不将历史值直接作为本轮分母。文件大小统计不包含文件系统块开销、第三方依赖、仓库外的用户缓存或构建工具本身；`vendor/` 是开发源文件，不进入四个安装目录。

[scripts/measure-packages.mjs](../../scripts/measure-packages.mjs)可以重现计数。[前后清单与逐组差异](../../tmp/package-optimization/size-comparison.json)保存本次结果。另将四包分别安装后实际计数，全部与完整安装口径相等，[安装字节记录](../../tmp/package-optimization/installed-size-proof.json)保留结果；临时安装已删除。后续编辑随包文档后完整安装总量会随文件字节变化。

## 行为、安装与画面

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 完整回归 | 116 项通过，失败和跳过为零 | [测试日志](../../tmp/package-optimization/full-tests.log) |
| 打包一致性 | `package-skills.mjs --check` 返回零差异 | [打包器](../../scripts/package-skills.mjs) |
| Bento 资源 | 恢复字节与官方原稿一致，损坏、截断和伪造原稿拒绝使用 | [资源测试](../../tests/packaging/bento-shell.test.mjs) |
| 更新与缓存 | 缓存、显式 HTML、下载文件名和普通 HTML 更新路径通过回归 | 同上 |
| 四包独立安装 | 分别安装在不同根目录，在 checkout 外运行；全局包旁没有 Express | [安装回归](../../tests/packaging/packages.test.mjs)与[分发证据](../../tmp/verification/package-full-mvxnmez5/evidence/distribution/summary.json) |
| HTML 文件 | 入口与八张独立页逐字节一致 | [优化前哈希](../../tmp/package-optimization/before/html-hashes.json)、[优化后哈希](../../tmp/package-optimization/after/html-hashes.json) |
| HTML 画面 | 八张桌面、八张移动截图逐字节一致，生产者 QA 无 finding | 同上，以及[前后截图](../../tmp/package-optimization/) |
| HTML 与 core 源码 | 十四个模块哈希保持一致 | [源码对比](../../tmp/package-optimization/unchanged-source.json) |
| 七类用户路径 | 全部通过，清理 `work/` 后再次校验证据哈希 | [完整报告](../../tmp/package-optimization/verification-report.json) |

运行 ID 为 `package-full-mvxnmez5`。验证包含 HTML 编写、播放、主题重规划、已有真实 Imagegen 结果检查、直接与全局 Bento、案例引用和分发。Imagegen 路径没有在本轮重新调用生图服务。

独立安装显式复用已有第三方 Playwright，未声称在全新机器安装第三方依赖。验证使用已可用的 Node 24.22.1，未修改本机全局 Skill 或 Homebrew。所有 `tmp/` 证据由 Git 忽略，移交 checkout 时应保留副本或重新运行[验证 Skill](../../.agents/skills/verify-storyweave/SKILL.md)。

## Imagegen 主题核对

上轮源码重构没有扩充仓库主题。全局安装版已从四套扩至六套，新增 `systems/white-cyan-wave` 和 `systems/silver-glass`；仓库仍是四套。所有样式均为 `candidate`，代表图不能证明全部方案已完成视觉验收。完整差异见[主题核对](storyweave-imagegen-theme-inventory.md)。
