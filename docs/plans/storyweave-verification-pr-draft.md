# 统一共享核心、原生 HTML 版式与可验证交付

## 背景与行为变化

两个生成器和展示入口曾重复维护公共规则，HTML 由字符串通用骨架生成，旧 QA 难以证明文件仍是已检查版本。现在批准内容单独保存，HTML 与 Imagegen 分别规划视觉，所有展示入口都核对当前生产者文件。

## 变更

- 将内容 schema、主题公共合同、产物校验和文件指纹集中到 `src/core/`，生成器使用 schema 4 内容与 schema 1 私有计划。v4 换主题保留确认内容，旧项目继续显式兼容。
- 实现比较、方向流程、指标、关系图与观点的原生 HTML 页面，检查独立页及画廊逐页的双视口、准确文字与关系，修复焦点下空格双触发。
- 建立本地案例索引、项目内参考捕获、HTML 应用记录和 Imagegen 实际工具输入与结果收集。当前案例明确是生成验证样本。
- 生产者 QA 绑定输入与页面字节，Bento 单独写适配报告。全局 Skill 内置 Bento，不依赖相邻 Express。
- 由权威源码生成自包含运行包与校验清单，安装更新保留备份。验证 Skill 覆盖七类公开用户路径，保存 CLI、浏览器与清理后证据。

## 验证与限制

`npm test` 的 106 项测试通过，失败和跳过均为零。独立安装回归的 3 项通过，四包使用不同根目录，命令工作目录位于 checkout 外；第三方 Playwright 通过明确的 `NODE_PATH` 提供。包一致性入口为 `npm run check:packages`。完整用户路径按[验证 Skill](../../.agents/skills/verify-storyweave/SKILL.md)运行，最终结果以当前源码指纹的报告为准。

八页同内容旧版基线位于 [`tmp/refactor-evidence/before/`](../../tmp/refactor-evidence/before/)。真实附图调用保存在 [`imagegen-live-01/`](../../tmp/refactor-evidence/imagegen-live-01/)，包含输入、实际调用记录、返回 PNG 与通过的生产者 QA。返回尺寸 `1672×941` 与请求 `2048×1152` 不同，QA 保留一项尺寸 warning；图片已视觉复核，未执行 OCR。目录由 Git 忽略，需要另行保存或重新生成。

七类完整用户路径全部通过，另一次缺图路径如实返回 `needs-images`；两次运行均清理工作区并重新校验证据。HTML 与 Imagegen 的 HTML、PNG、PDF、PPTX 导出，以及两个 Bento 适配输出均已验证。[验证记录](storyweave-refactor-validation.md)保留运行 ID、源码指纹、八页同内容前后截图和逐页目视判断。

固定八页语料的浏览器 QA 中位耗时由约 9.11 秒降到 1.19 秒，主要减少固定等待。构建区间重叠，未判断稳定差异。独立运行包合计约由 0.94 MiB 增至 1.89 MiB，未达到初拟体积预算，主要来自全局包自带 Bento。优秀人工案例收录与规则提炼仍单独推进；Agent 的视觉评分不等于用户审美确认。

最终检查另发现本机 Homebrew 的旧 Node 与新版 simdjson 链接不匹配。已有独立 Node 24.22.1 上的全套 106 项、doctor 与证据哈希复验均通过，运行入口见验证记录。
