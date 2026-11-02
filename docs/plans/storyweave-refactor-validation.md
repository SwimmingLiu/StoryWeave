# StoryWeave 重构验证记录

共享核心、两个生成器、Bento 适配器和独立分发已通过行为验证。八页同内容对比显示，比较轴、流程方向、指标归属和关系图已经形成各自的页面结构。运行包合计体积增加，未达到初拟的 1.1 倍预算。

本文保留首轮重构的数据与运行 ID。后续[独立包体积优化](storyweave-package-size-validation.md)已将必需运行文件从约 1.89 MiB 降到 1.51 MiB，HTML 和双视口截图保持逐字节一致；当前体积以该记录为准。

## 行为与交付

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 完整自动化回归 | 106 项通过，失败、跳过均为零 | [npm test 日志](../../tmp/refactor-evidence/npm-test.log) |
| 独立 Node 复验 | Node 24.22.1 上同一套 106 项再次通过，doctor 正常 | [复验日志](../../tmp/refactor-evidence/tests-bundled-runtime.log)、[doctor](../../tmp/refactor-evidence/runtime-doctor.json) |
| 生成运行包一致性 | `node scripts/package-skills.mjs --check` 返回零差异 | [打包器](../../scripts/package-skills.mjs) |
| 七类公开用户路径 | 全部通过，源码指纹在操作前后一致 | [完整报告](../../tmp/refactor-evidence/verification-summary.json) |
| 验证清理 | 两次运行均删除 `work/`，保留证据并重新校验哈希 | [验证命令记录](../../tmp/refactor-evidence/verification-commands.json) |
| 缺图状态 | 独立的 Imagegen 编译检查返回 `needs-images`，退出码 3 | [编译路径报告](../../tmp/verification/refactor-prompts-mvxm7jke/evidence/imagegen/summary.json) |
| 独立安装 | 四包分别安装到不同根目录，在 checkout 外运行；3 项分发测试通过 | [分发路径报告](../../tmp/verification/refactor-full-mvxm7jke/evidence/distribution/summary.json) |
| 真实图片交付 | 已保存真实附图调用，现有图片通过生成器 QA 与 Bento QA | [真实调用项目](../../tmp/refactor-evidence/imagegen-live-01/) |
| 格式导出 | HTML 八页和 Imagegen 一页均完成 HTML、PNG、PDF、PPTX 导出 | [交付结果与文件哈希](../../tmp/refactor-evidence/final-proof.json) |

完整运行 ID 为 `refactor-full-mvxm7jke`，覆盖 HTML 编写、播放、主题、Imagegen、Bento、案例索引和独立分发。源码指纹为 `74f684b63eb7f4977e97273547bc2e2b320f20969cdbf48e9a392bbc5b26f1c3`。

Imagegen 的完整路径检查导入了已有真实生成项目。本次 helper 没有再次调用图片服务；实际调用保存在该项目的请求、日志、返回图片和 receipt 中。图片请求为 `2048×1152`，返回为 `1672×941`，生产者保留一项尺寸 warning，Bento 适配检查无 warning。图片经过目视核对，未执行 OCR。

独立安装验证显式通过 `NODE_PATH` 提供已有的第三方 Playwright。应用代码、合同、主题与 Bento 均来自各自安装包，全局包所在目录没有相邻 Express。该项不代表全新机器上的依赖安装验证。格式导出另在本机安装了 Imagegen 声明的可选依赖与对应 Chromium，HTML 浏览器也已恢复并重新验证。

## 同内容的视觉对比

[完整前后对比](../../tmp/refactor-evidence/before-after.html)包含八页截图，并可点击打开原始 HTML。[整套缩略图](../../tmp/refactor-evidence/after-contact-sheet.html)用于查看连续页面的层级与节奏。

两侧使用冻结的相同内容与 `systems/ink-blue-grid` 主题。旧侧是原渲染器对该内容的 v3 文字投影，新侧使用 v4 的明确比较、步骤、指标和节点关系。检查已确认两侧 `exact_text` 展开顺序相同。

| 页面 | 旧版表现 | 当前表现 |
| --- | --- | --- |
| s01 封面 | 产品名占主位，右侧抽象图形与本页主张关联较弱 | 主张成为主标题，产品名降为眉题 |
| s02 观点 | 通用图形压缩文字区域 | 标题与三条说明形成单一阅读顺序 |
| s03 比较 | 文字交错分布于两列，缺少共同的比较轴 | HTML 与 Imagegen 按相同的三行维度对齐 |
| s04 流程 | 步骤与说明分别编号，形成六个平级项 | 三个步骤各自包含说明，并保留两条明确方向 |
| s05 指标 | 数值、单位、标签与来源拆散，底部文字可读性不足 | 三项指标分别组织数值、单位、标签与来源 |
| s06 关系 | 节点与详情摊成列表 | 原生 SVG 连线表达一份内容、两个生成器和交付的关系 |
| s07 长标题 | 装饰图形挤压标题区域 | 保留文字大小并平衡断行，修复末行单字 |
| s08 收尾 | 标题与通用图形争用空间 | 主张与行动说明集中呈现，蓝底区分收尾 |

以下为本次 Agent 目视评审的主观评分，采用方案中的每项 0 至 2 分，供复核截图时使用。

| 维度 | 旧版 | 当前 | 判断依据 |
| --- | --- | --- | --- |
| 主张聚焦 | 1 | 2 | 封面与收尾的主张获得明确主位 |
| 信息关系 | 0 | 2 | 比较轴、步骤、指标归属和分支均可直接阅读 |
| 字体层级 | 1 | 2 | 主指标、标题、正文与来源形成不同层级，长标题没有末行单字 |
| 素材表达 | 1 | 1 | 已核对原生图形与 SVG；固定语料没有照片或品牌资产，不外推到这类素材构图 |
| 全套节奏 | 1 | 2 | 深色封面与指标页、浅色解释页、强调色收尾形成差异 |
| 合计 | 4 | 9 | 达到本轮固定语料的视觉评审目标；评分不是客观质量指标或用户审美确认 |

浏览器另检查了 `1280×720` 与 `390×844` 视口的独立页和画廊。生产者 QA 的 blocking、warning、degraded 均为零。三处审查发现的问题已增加回归：检查期间参考文件改变、幻灯片外额外文字，以及比较值被换到错误列。指标和节点详情也核对归属。

## 耗时与运行包体积

计时在 Apple M4、10 核、Node.js 24.7.0 上执行。两侧使用相同的 Playwright、Chromium、八页文字和主题，各预热一次，再交替执行五次。机器有背景负载，运行前 1 分钟负载约 6.57，结束约 5.79。[原始采样与 CPU profile 摘要](../../tmp/refactor-evidence/benchmark/result.json)记录环境、范围和限制。

| 操作 | 旧版中位耗时 | 当前中位耗时 | 旧版范围 | 当前范围 | 判断 |
| --- | --- | --- | --- | --- | --- |
| 构建 | 38.97 ms | 46.83 ms | 36.73 至 74.04 ms | 42.33 至 67.66 ms | 区间重叠，无法据此判断稳定差异 |
| 浏览器 QA | 9.11 s | 1.19 s | 9.04 至 9.43 s | 1.15 至 1.67 s | 本语料的等待时间减少 |

旧 QA 为 16 次独立页检查各固定等待 500 ms，仅此即占 8 秒。当前等待字体与有限动画完成，另外检查 16 个画廊状态和导航。独立的 Node CPU profile 显示旧 QA 主要处于等待。两侧工作范围有所不同，因此该结果说明实际用户路径的耗时变化，不代表纯渲染算法加速，也不包含外部生图、Bento 或导出。

构建中位数约为旧版 1.202 倍，位于初拟 1.2 倍阈值边缘且低于本次波动，未据此判定预算通过。QA 耗时低于 1.2 倍预算。

运行包统计包含 scripts、runtime、schema、合同、安装器与运行素材，排除第三方依赖、示例、测试、文档和证据。旧值使用改造前捕获的代码与 schema，加上未变的主题和 Bento 素材；新值包含四包各自的运行副本。

| 安装包 | 旧版字节数 | 当前字节数 |
| --- | --- | --- |
| storyweave-html | 131,006 | 254,571 |
| storyweave-imagegen | 149,649 | 242,065 |
| storyweave-express | 702,353 | 741,632 |
| storyweave | 6,409 | 740,632 |
| 合计 | 989,417 | 1,978,900 |

合计约 `0.94 MiB → 1.89 MiB`，未达到初拟 1.1 倍预算。增量主要来自全局 Skill 新增的独立 Bento 实现与 677,480 字节 shell，其余来自共享内容、计划、引用和 QA 能力。当前实现保留独立分发边界，核心只依赖 Node 标准库，没有新增服务、框架或数据库。该选择降低源码重复维护与安装耦合，不能描述为运行包变小。

## 保留与重现证据

所有截图、命令、产物、trace 与采样位于 Git 忽略的 `tmp/`。交接 checkout 时需保留这些目录，或按[验证 Skill](../../.agents/skills/verify-storyweave/SKILL.md)重新执行。缺图、主题不匹配和浏览器依赖缺失的早期尝试仍保留，最终通过记录使用上文列出的运行 ID。

最终环境检查发现 Homebrew 的 `simdjson` 链接指向 5.1.0，而 Node 24.7.0 仍要求旧 ABI 的 `libsimdjson.26.dylib`。旧库仍在 3.13.0 目录，默认 `node` 因链接不匹配暂时不能启动。以上计时与完整路径运行在故障出现前已完成。随后使用本机已有的独立 Node 24.22.1 完成全套测试、doctor 与清理后证据哈希[复验](../../tmp/refactor-evidence/runtime-report-recheck.json)，源码指纹一致。

本机可使用已验证的独立运行时执行项目命令：

```bash
/Users/swimmingliu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node .agents/skills/verify-storyweave/scripts/verify.mjs doctor --json
/Users/swimmingliu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node skills/storyweave-html/scripts/ppt.mjs doctor --json
```

这是本机运行时的替代入口。正常安装的 Node.js 20 以上仍是项目的通用运行前提；Homebrew 的默认 Node 安装需要单独修复。

优秀人工案例收录、新内容上的方法验证与规则提炼仍是独立工作。当前案例库只有明确标记的生成验证样本。
