# HTML 视觉优化验收记录

本轮在现有 v4 内容与计划分离的架构上改进 HTML 表达。杂志风采用衬线标题、错列正文、纵向数字账单和深浅节奏；瑞士风采用轻字重无衬线、16 列内容轴、锚点色封面与对开收尾。新增 image-hero，将图片比例、焦点和主体安全区写入计划。中文短词在原生标题中保持同一行，批准文字保持完整。

QA 使用真实 Chromium 测量桌面与竖屏中的实际字符行、字号字重、间距、文字重叠、底部安全区、导航遮挡和图片裁切。检查继续绑定内容结构、主题计划及实际文件。测试还证明缩小间距、改变标题字重或裁掉声明主体会被阻断。

参考为 [guizang-ppt-skill 的 c91369c 版本](https://github.com/op7418/guizang-ppt-skill/tree/c91369c449d34755d320a8b81d0734000d99d1ab)，已核对 AGPL-3.0。参考模板、布局说明、lock、checklist 与校验器用于方法学习，产品实现独立编写。原模板的杂志插槽为空，浏览器观察时在外置副本插入其原始布局示例；瑞士模板直接观察原有封面和收尾。原文件哈希、浏览器状态和参考截图保存在 `/Users/swimmingliu/data/storyweave-design-cases/guizang-c91369c/`，原始参考不进入 Skill 运行包。

## 样张与人工复核

[两套样张与前后整套入口](../../comparisons/html-visual-20261101/README.md)沿用已有示例内容，覆盖八种信息任务。图片是原创 SVG 插画；指标来自仓库参数。两种风格的内容 revision 相同，每套批准稿在前后版本逐字节一致。优化前图片页标题超容量，QA 各有 4 个 blocking；最终两套均为 browser、blocking 0、warning 0、degraded 0。

逐页及整套对照确认：封面和收尾形成视觉锚点；杂志风的数字账单与瑞士风的横向指标存在构图差异；对照与关系页保持原列轴和关系边；长标题与图片分区，主体完整；实际截图中的“关系”“真实”保持同一行。390×844 保留 16:9 等比舞台，页面内容及字重关系与桌面一致。

本地字体使用 macOS 的 Songti SC、PingFang SC 与 Helvetica Neue 等回退链。本轮未复核 Windows/Linux 的实际字体替换，也未以照片或文字密集截图验证所有裁切情况。

## 验收结果

最终运行是 `html-visual-20261101-a04`，证据位于 `tmp/verification/html-visual-20261101-a04/evidence/`。七个功能分别由只读源码代理核对，协调员串行驱动。产品修复阶段与验收 Skill 维护阶段分开；维护改动只在 `.agents/skills/verify-storyweave/`。

| 功能 | 结果 | 本次实测 |
| --- | --- | --- |
| HTML authoring | pass | 两套带图 8 页、replan 保留批准稿、带图 preview、HTML export、双视口独立页、v2/v3 |
| HTML playback | pass | 两视口按钮、方向键、翻页键、焦点空格、首尾循环、Home/End |
| Themes | pass | 目录、三主题首页预览、杂志与瑞士风重规划、批准稿哈希不变 |
| Imagegen | needs-images | draft、approve、prompts、status 和缺图 build；退出码 3，交付文件未生成 |
| Bento | pass | 全局与直接 Express、实际首图、顺序、备注、生产者 QA 保留 |
| Design library | pass | check、search、inspect、捕获哈希、applied 记录与实际深色页面 |
| Distribution | pass | 四个独立安装根、各包 doctor 与清单；已安装 HTML、Imagegen 缺图门、Express 和全局 Bento |

120 项回归测试全部通过。doctor 使用 Node 24.22.2、Playwright 1.62.1 和 Chromium。默认 Node 的 Homebrew 动态库缺失，验证命令临时选择已安装的可用 Node，没有修改系统配置。分发验证显式复用预装第三方 Playwright，应用模块与资源来自各安装包。

最终运行完成 report → cleanup → report，work 目录已移除，901 份验收文件哈希复核通过。早期失败运行 a01 的 v2 容器重叠证据也已保留并清理；该问题通过调整产品容器边界修复，未降低 QA 门槛。a02、a03 为中间验证，均完成清理。

## 包体积与边界

使用同一个 `scripts/measure-packages.mjs` 测量文件内容 bytes，排除 node_modules、tests 和 .DS_Store。runtime 包含安装器、CLI、运行模块、合同、schema 与必需素材，排除文档和 authoring examples。

| Skill | runtime 修改前 | runtime 修改后 | 变化 | installable 修改前 → 修改后 |
| --- | ---: | ---: | ---: | ---: |
| storyweave-html | 246,045 | 264,307 | +18,262 | 597,735 → 618,489 |
| storyweave-imagegen | 229,204 | 271,514 | +42,310 | 27,633,617 → 27,678,533 |
| storyweave-express | 551,841 | 551,841 | 0 | 558,599 → 558,599 |
| storyweave | 551,524 | 551,524 | 0 | 557,854 → 557,854 |

HTML 的 runtime 增量约 17.8 KiB，来自计划、渲染与浏览器检查。Imagegen 的同期增量来自另一个会话的主题素材与文档，已保留，未归入本轮 HTML 改动。四包通过仓库打包机制同步，没有添加运行时依赖或覆盖全局安装的 Skill。

本轮未调用真实图片服务，未执行 record-result、独立图片 review、OCR 或图片导出；图片 fixture 与 SVG 不作为生图证据。PNG/PDF/PPTX 导出、主题迁移、触摸和滚轮、Bento 编辑及逐页 Slideshow 未纳入本轮真实驱动。设计库现有案例仍是生成的验证样本，不代表人工案例策展已完成。

维护结果为 changed，交付本地代码、更新后的验收 Skill、样张与 PR 草稿。初始工作区已有大量未提交及未跟踪的架构改动；本轮没有将这些改动混入提交，也未发布、推送或创建远端 PR。
