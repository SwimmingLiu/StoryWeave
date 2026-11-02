# HTML 视觉细节修订验收记录

renderer 4.2.0 已修复正文短词拆行与孤字、流程箭头贴近编号、中性比较的单列高亮。杂志风使用侧栏图文和纵向系统图，瑞士风使用通栏图片和横向系统图。图片改为同组标题、图块与文字条的布局示意，直接说明已批准的密度与留白主题。文字、数据、备注与关系边保持原批准内容。

## 样张与批准稿

[两套新 8 页样张和前后对照](../../comparisons/html-visual-refinement-20261101/README.md)保留修改前的真实 4.1.0 产物，再以 4.2.0 重新规划和构建。修改前来源是 `comparisons/html-visual-20261101/after/`，其文件在本轮开始前复制到新对照目录的 before；没有以新渲染器伪造旧版本。

| 风格 | 批准稿 SHA-256，前后相同 | 最终 QA |
| --- | --- | --- |
| 杂志 | `3daee76d6b673895739b42dd3595ad8d204e4c8a00650c8387054abb5c29228e` | browser；blocking 0、warning 0、degraded 0 |
| 瑞士 | `452fc787c8fd7b5f0397ebc1e2f56ea8f357118aabaab947ed1f6e3d32125cf9` | browser；blocking 0、warning 0、degraded 0 |

两套内容 revision 均为 `1708b64e44e41252474c745c3c583b322b1de6694f706704070da3a40998182a`。公开 replan 前后与最终交付均检查批准稿字节。独立验收重新生成的计划、画廊及 16 个独立 HTML 与样张目录逐文件相同。

## 逐页人工复核

主代理亲自查看全部 16 页桌面截图、16 页竖屏截图及整套缩略图；以下记录对应修订后实际产物。

| 页 | 杂志风 | 瑞士风 |
| --- | --- | --- |
| s01 封面 | 衬线标题、深色纸面与正文留白完整，页码清楚 | 蓝色封面、轻字重标题与细线形成独立视觉锚点 |
| s02 论点 | 标题与错列说明形成阅读顺序，没有孤字 | 左右分区明确，三条说明均完整，竖线没有压住文字 |
| s03 比较 | 两个数据列使用相同文字颜色和字重，保留比较轴 | HTML 与 Imagegen 两列视觉等权，横线和列对齐正常 |
| s04 流程 | 箭头在方形锚点轨道内，避开 01–03 编号与标题 | 独立轨道保持左到右方向，箭头不碰编号或正文 |
| s05 指标 | 纵向数字账单保留数值、单位与来源 | 横向三项指标对齐，数值与单位未挤压来源 |
| s06 系统 | 纵向三层结构与瑞士风明显不同，四条批准边完整 | 横向分流与汇合清楚，“事实来源”保持完整词组 |
| s07 图片 | 左侧说明、右侧两种排布；“内容密度”保持完整 | 两幅宽图与下方两列说明配合，正文没有孤立的“度” |
| s08 收尾 | 深色衬线大标题与居中正文收束整套，文字完整 | 蓝白对开与封面呼应，标题和说明分区清楚 |

两视口保持相同内容和关系，图像主体完整。390×844 是固定 1280×720 舞台的等比缩略预览，正文随之缩小；本轮没有改变原定的页面模型，也不把它评为小屏阅读版。字体实测来自 macOS 的 Songti SC、PingFang SC 等回退链，未证明其他操作系统的字体替换效果。

## QA 与回归

新增真实浏览器检查覆盖所有原生文案的字符行、短词跨行、正文孤字、连接线与文字或无关节点的相交、端点脱离、neutral 比较列权重及实际 composition。QA 状态保存实际测量，阈值未降低。破坏性回归用例分别制造孤字与拆词、单列高亮、箭头覆盖编号及路径脱离，均能阻断交付；原内容顺序、关系、来源绑定等检查继续保留。

121 项回归测试全部通过，无失败、跳过或取消。完整日志保存在本轮证据的 `context/tests-full.log`。运行环境为 Node 24.22.2、Playwright 1.62.1 和 Chromium。默认 Node 的 Homebrew 动态库缺失，命令临时使用可用的 Node 24，没有改动系统配置。

## 完整用户路径

验收 Skill 维护结果为 changed。七份功能地图分别经过只读源码代理核对；主代理串行驱动所有功能，亲自完成视觉复核。维护阶段仅修改 `.agents/skills/verify-storyweave/`，产品代码与回归在此前完成。

最终 run-id 为 `html-visual-refinement-20261101-r01`，证据位于 [evidence](../../tmp/verification/html-visual-refinement-20261101-r01/evidence/)。源码与生成包在整个运行中保持同一指纹 `6c31cf04e1d1dc1415f71cf8f1952f81498fde13f401f0eac1a4a3a6b0a7729b`。

| 功能 | 结果 | 实际覆盖 |
| --- | --- | --- |
| HTML authoring | pass | 同内容两套带图 8 页、批准稿字节、带图 preview、HTML export、双视口逐页、v2/v3 |
| HTML playback | pass | 两视口按钮与键盘、保留焦点的空格、首尾循环；活动流程与系统图离开返回、竖屏缩放及恢复 |
| Themes | pass | 目录、三主题首页预览、杂志至瑞士重规划、批准稿字节、正文断词与 composition |
| Imagegen | needs-images | 任务编译，status/build 以退出码 3 返回缺图，交付文件未生成 |
| Bento | pass | 全局与直接 Express、顺序备注、真实首图、生产者 QA 不变 |
| Design library | pass | check/search/inspect、捕获哈希、applied 记录及实际深色 DOM |
| Distribution | pass | 四个隔离安装根、manifest 与 doctor；已安装 HTML、Imagegen 缺图门、Express 和全局 Bento |

图解播放每一步保留实际路径、批准边、屏幕端点及节点边界。两套样张共测得 96 个端点距离值，均为 8 或 10 个舞台单位，位于 4–20 的验收区间内。该路径以 Home、方向键和真实 viewport resize 驱动，没有写入内部页码或 active class。

最终执行 report → cleanup → report，work 目录已移除。935 份运行证据哈希和 17 份前后产物绑定均重新验证；截图、动作和 trace 保留。最终交付清单另覆盖样张、上下文、源文件快照及本地草稿。

## 包体积

使用同一个 `scripts/measure-packages.mjs`，按文件内容 bytes 测量。runtime 包含安装器、CLI、模块、合同、schema 和必需素材，排除文档与 authoring examples；两种口径均排除 node_modules、tests、.DS_Store。

| Skill | runtime 修改前 | runtime 修改后 | 变化 | installable 修改前 → 修改后 |
| --- | ---: | ---: | ---: | ---: |
| storyweave-html | 264,307 | 275,440 | +11,133 | 618,489 → 630,478 |
| storyweave-imagegen | 266,987 | 430,874 | +163,887 | 27,674,081 → 27,839,019 |
| storyweave-express | 551,841 | 551,841 | 0 | 558,599 → 558,599 |
| storyweave | 551,524 | 551,524 | 0 | 557,854 → 557,854 |

本轮 HTML runtime 增加约 10.9 KiB，来自通用中文排版、节点测量与新增 QA。Imagegen 的同期增量是其他会话的素材与文档变化，本轮保留这些改动，未将其归入 HTML 实现。四包通过仓库打包机制同步，最终 `package-skills.mjs --check` 的 changed 为 0，未新增运行时依赖或更新全局 Skill。

本轮未进行真实 Imagegen 调用、record-result、OCR、独立图片 review、PNG/PDF/PPTX 导出、触摸与滚轮、主题迁移、参考画廊、Bento 编辑或逐页 Slideshow。独立安装显式复用预装 Playwright，未重新安装第三方依赖。工作区既有和并行改动均保留；没有提交、推送、远端 PR 或发布。
