---
name: verify-storyweave
description: 验证 StoryWeave 的公开 CLI、HTML 双视口与播放、主题重规划、Imagegen 任务、设计参考、参考图库、Bento 和独立分发。在修改内容合同、生成器、版式、主题、图片显示、QA、展示适配器或打包后，用真实浏览器和可保留证据检查用户路径。
---

# 验证 StoryWeave

从仓库根目录执行。先读[功能地图](features/README.md)，再读受影响功能。公开 CLI 是操作入口，离线 HTML 是浏览器入口；用户项目和仓库示例只作为只读输入。

<!-- Local-only evaluation left browser coverage unfinished; every evaluation now includes its exact-commit CI run. -->
每次评测都需要运行[GitHub Actions CI](../../../.github/workflows/ci.yml)，记录同一提交的运行链接与结论。新提交 push 或 PR 自动触发；已有分支用 `gh workflow run ci.yml --ref <branch>` 重跑，等待最新提交的 `Verification` 成功。CI 失败、取消、未执行或仍有未提交改动时，不报告该代码已通过。具体覆盖与 artifact 见[CI 说明](../../../docs/ci.md)。

<!-- Different compositions previously passed as improvements despite the user's s06 counterexample. -->
生成、优化或复核视觉内容前，先读[视觉语义评测与生成前检查](references/visual-review.md)。记录问题和最小改动，保留已有清楚构图；生成后按同内容前后截图逐页评测。技术 QA、版式数量和主题差异均不作为审美改善结论。

## Launch

StoryWeave 使用短命令，无常驻服务、端口、数据库或登录步骤。要求 Node.js 20 以上，以及 HTML 运行包能解析的 Playwright 和 Chromium。缺少依赖时执行：

```bash
npm install --prefix skills/storyweave-html/scripts
npm exec --prefix skills/storyweave-html/scripts -- playwright install chromium
```

修改源码后先重新打包，随后创建唯一运行 ID：

```bash
npm run package:skills
VERIFY_RUN_ID="verify-$(date -u +%Y%m%dT%H%M%SZ)-$$"
node .agents/skills/verify-storyweave/scripts/verify.mjs doctor
node .agents/skills/verify-storyweave/scripts/verify.mjs launch --run-id "$VERIFY_RUN_ID"
```

后续命令复用返回的 `run_id`。新终端恢复同值，不重新生成。ID 长度为 1 至 80，首字符是字母或数字，其余可含连字符与下划线。已存在目录不作为新运行使用。

各功能使用 `tmp/verification/<run-id>/work/<feature>/`，同一运行内串行驱动。并行运行使用不同 ID。验证样本的自动审批不代替真实项目的用户确认。

<!-- Product QA also launches local browsers; recording a policy denial only in chat left nested commands unguarded. -->
执行环境明确阻止本地页面浏览时，在 launch 中记录限制。该运行会在浏览器或间接启动浏览器的命令前停止，保留已完成的 CLI 证据，并返回 `not-run`。限制存在期间，使用本地服务、其他浏览器或自动化脚本访问相同页面仍属于同一阻塞。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs launch --run-id "$VERIFY_RUN_ID" --browser-policy blocked --browser-block-reason "当前工具策略阻止本地 HTML 浏览"
```

正常 launch 不带这些选项。必须按实际策略选择，不能为通过验证而移除限制。

## Doctor

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs doctor --json
```

只读预检核对 Node、公开入口、Playwright、Chromium、源码身份与生成包一致性。包检查相当于 `package-skills.mjs --check`，不自动修复副本。doctor 不创建运行目录，也不证明页面已经通过检查。

首次驱动和异常后运行 doctor。失败后先清理本次工作，修复后用新的运行 ID 重验。浏览器状态异常但进程健康时重新打开已知页面或重新启动上下文，不能在未知状态继续。

## Drive

先驱动 HTML 主路径：

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive html-authoring --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs drive html-playback --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

其余 ID 为 `themes`、`imagegen`、`bento`、`design-library`、`reference-gallery` 和 `distribution`，使用相同命令形状。主题可传 `--theme-ref editorial/paper-magazine`。同一功能在一个运行中执行一次；再次执行、源码变化或清理后继续验证时创建新运行。

<!-- Default drafts contain no hero asset and could not prove the new image layout or old schema compatibility. -->
HTML 视觉改动另需同内容基线。修改源码前，可用 `node scripts/html-visual-samples.mjs --phase before --out <absolute-path>` 保存两套 8 页样张。基线目录包含 `before/editorial` 与 `before/swiss` 的批准稿、计划、素材、页面和截图。已有可信基线时直接使用；缺少修改前版本时如实记录未覆盖，不能用当前渲染器补做并称为优化前。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive html-authoring --run-id "$VERIFY_RUN_ID" --visual-baseline <absolute-path> --compatibility
```

`--visual-baseline` 在本次工作目录复制只读基线，通过 replan、build、qa、preview 和 export 驱动两种风格，不重复审批。检查相同内容修订、批准稿字节、独立布局、图片槽位与当前 artifact_binding。`--compatibility` 另以公开 CLI 创建 v2、v3，驱动它们的双视口画廊和独立页。两个选项仅用于 html-authoring，入口与证据分别记录，不把默认无素材路径扩大为视觉全覆盖。

<!-- A comparison HTML and browser pass did not require anyone to judge whether a candidate became worse. -->
视觉 drive 还在 `evidence/html-authoring/visual-review/` 生成图片绑定、A/B 视图与空评审模板，初始状态为 needs-review。按视觉评测参考实际查看各页及整套，填写模板的每个维度、两侧查看记录与具体观察，保留评审者熟悉程度。评审文件放在 scratch，再收录为独立证据：

```bash
node .agents/skills/verify-storyweave/scripts/visual-review.mjs assess --packet "tmp/verification/$VERIFY_RUN_ID/evidence/html-authoring/visual-review/packet.json" --input <absolute-review-json> --out "tmp/verification/$VERIFY_RUN_ID/evidence/visual-assessment"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

需要重新评测既有两套样张时，使用下面的只读输入路径。它要求 `before/{editorial,swiss}` 与 `after/{editorial,swiss}`，核对当前生产者绑定和批准稿字节。输出明确标为 retained-browser-evidence；它不启动浏览器，不补称新一轮浏览器验证。

```bash
node .agents/skills/verify-storyweave/scripts/visual-review.mjs prepare --comparison-root <absolute-comparison-root> --out "tmp/verification/$VERIFY_RUN_ID/evidence/visual-assessment"
node .agents/skills/verify-storyweave/scripts/visual-review.mjs assess --packet "tmp/verification/$VERIFY_RUN_ID/evidence/visual-assessment/packet.json" --input <absolute-review-json> --out "tmp/verification/$VERIFY_RUN_ID/evidence/visual-assessment"
```

prepare 成功建立待评包时返回 4；assess/report 在 regressed 时返回 1、needs-review 时返回 4、accepted 时返回 0。生成模板不是完成评审。图片、批准稿或绑定发生变化后重新准备新包，旧评审不能复用；用户已拒绝的相同 PNG 字节不能被代理改判为改善。

<!-- Decorative paper could not demonstrate the density claim; the opt-in study changes only copied visual inputs. -->
本轮八页样张可追加 `--layout-study`。它仅在视觉基线副本中，用原生 SVG 展示相同标题、图块与八条文字的疏密变化，再公开 replan。准备和重规划前后均核对批准稿字节，原基线不变。`layout-qa-states.json` 保留正文行、短词、连线端点与比较列样式；图片及系统图的 composition 同时核对计划与实际 DOM。

helper 在驱动前后检查源码指纹，包含权威 `src/` 与生成 `runtime/`。开始前漂移会拒绝执行，运行中漂移记录 `source.changed` 并使结果为 fail。验收先检查该字段。

HTML 使用 `1280×720` 与 `390×844` 视口，通过公开按钮、键盘与独立页面操作，观察活动页 ID。播放路径在两种视口记录焦点按钮、空格前后状态、首尾循环与截图。不得设置内部页码或 active class 制造成功。v4 主题路径优先在杂志和瑞士风之间重规划，逐字节核对批准内容，直接重新构建，不重复审批。

<!-- A static diagram screenshot did not cover the resize/show hooks that redraw its paths. -->
播放另通过 Home 和方向键进入流程及关系图页，离开后返回，在活动图解页直接缩放至竖屏再恢复。每步保存已批准边、实际路径、端点边界距离和截图。竖屏保持固定 16:9 舞台，是缩略预览；双视口通过不代表小屏正文适合直接阅读。

Imagegen 默认验证草稿、确认、任务编译、status 与缺图 build，缺图返回 `needs-images`，退出码 3。已有真实生成并逐页复核的项目可通过 `--source-project <absolute-path>` 复制到本次工作区，检查现有图片、计划、参考与调用记录。helper 本身不调用图片服务、不执行 OCR，也不独立复核图像质量。

`design-library` 驱动索引检查、标签检索、HTML 引用审批、参考捕获哈希与浏览器。`distribution` 将四个包安装到独立根目录，检查包清单，执行已安装 HTML 与全局 Bento。它显式通过 `NODE_PATH` 复用预装第三方 Playwright 并记录来源，不代表重新安装依赖。

<!-- File decoding alone missed the blank gallery; byte integrity and visible UI now have separate evidence. -->
`reference-gallery` 需要 Python 3、Pillow 和已准备好的原图缓存。缓存只读，helper 不下载远程图片。缺少缓存时先按产品文档准备，再传入绝对路径：

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive reference-gallery --run-id "$VERIFY_RUN_ID" --reference-cache <absolute-cache-directory>
```

该路径检查分发资产、独立 Imagegen 安装、缓存解码、离线构建和内嵌字节，再在断网浏览器中展开每张内容图，驱动分类、页型、搜索组合、空状态及大图关闭。另用生产页面拦截一个已有图片请求，验证错误与重试；这段不证明来源服务器实时可用。浏览器被阻止时，`image-integrity.json` 可通过，功能整体仍为 `not-run`。

## Evidence

证据位于 `tmp/verification/<run-id>/evidence/<feature>/`。读取 `summary.json` 与总报告，`entry_points` 表示实际覆盖的入口。结果使用 pass、fail、needs-images 和 not-run，后三者不表示通过。drive 与 report 的退出码分别为 0、1、3、4；总报告优先返回 fail，其次 not-run，再次 needs-images。未执行的功能也使总报告返回 4。

| 证据 | 内容 |
| --- | --- |
| `commands.json` | CLI、stdout、stderr 与退出码 |
| `actions.json` | 实际浏览器动作、预期与实际状态、截图 |
| `trace.zip`、`trace-2.zip` | 不同浏览器上下文的轨迹，列于 summary 的 traces |
| `project/` | 本次输入、批准稿、计划、页面、清单、QA 与相关引用证据 |
| `summary.json` | 入口、结果、findings、源码与产物指纹、限制 |
| `contact-sheet.html` | 已保存桌面逐页截图的整套缩略图 |
| `visual-before-after.html`、`visual-comparisons.json` | 启用视觉基线后的逐页前后对照、内容与产物绑定 |
| `visual-review/packet.json`、`key.json`、`review-sheet.html` | 同内容 A/B 图片、哈希、批准语义与逐页及整套评测入口 |
| `visual-assessment/review.json`、`assessment.json` | 署名视觉观察、改善/持平/退步/未评测，以及不能被平均抵消的退步结论 |
| `visual-assessment/assessment.html` | 原版与候选的逐页图片、结论及每项视觉依据 |
| `image-integrity.json`、`input-cache-hashes.json` | 图库逐图解码、内嵌与原图哈希、角色计数、安装资产与只读输入 |
| `offline-viewer/`、`desktop-decoded.json`、`mobile-decoded.json` | 离线原产物与实际浏览器逐图显示记录，后两项只在浏览器执行后存在 |
| `image-boundary.json`、`image-error.png`、`image-retry.png` | 外部图片边界的一次失败、公开重试动作与恢复证据 |
| `html-authoring/visual-review/`、`visual-assessment/` | A/B 评审包、填写后的 review 与绑定当前图片的 assessment，见 HTML 功能地图 |

截图和状态在断言前保存，失败动作也留下证据。播放检查收集动作差异并继续其余路径，只要 findings 非空，整条功能仍为 fail。`report` 重新读取证据并核对哈希。

每个功能开始时重新 doctor。播放动作异常后先保存截图和状态，再 doctor，并用公开页面与键盘恢复已知状态；无法恢复时结束失败驱动并清理。嵌套视觉与兼容路径使用独立证据子目录，截图和 trace 不互相覆盖。

HTML 最终检查要求真实浏览器、`visual_review: browser`、blocking 与 degraded 为零。生产者 `artifact_binding` 必须与当前文件一致。Bento 另存适配报告；分发另存包清单与第三方依赖来源。

<!-- A newly added visual assessment is separate from technical exit codes and must be read explicitly. -->
report 的 `visual_acceptance` 单列视觉结果。顶层 `release_ready` 需要所有技术功能 pass 且视觉 accepted；没有视觉评审包时保持 false。技术退出码 0 不能代替该交付判断，填写和绑定方法见 [HTML 功能](features/html-authoring.md)。

自动检查证明内容、几何与交付行为。主张、字体、素材和节奏需要查看相同内容的前后截图，按[实施方案](../../../docs/plans/storyweave-refactor-plan.md)记录人工判断。Imagegen 合同 fixture、纯色图、复核标记和导入项目不能证明本次真实生成；helper 不判别图片是否来自 fixture。

<!-- Perceptual acceptance is separate from producer visual_review: browser and cannot be inferred from it. -->
总报告的 `visual_acceptance` 单独说明视觉评测。缺评为 needs-review，任一页或整套退步为 regressed，均使相关总报告不能成功退出。`accepted` 只表示视觉没有退步；全部持平时 `improvement_claim` 仍为 false。总 `release_ready` 还要求本轮所有功能实际通过，不能用视觉通过掩盖未运行的浏览器路径。

## Cleanup

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs cleanup --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

结束或失败后均执行清理。helper 关闭自己启动的浏览器，cleanup 只删除本次拥有的 `work/`，保留 `run.json` 与 `evidence/`。重新打开报告、截图和 trace，确认哈希和文件仍有效。不要按名称批量终止浏览器或删除用户项目、缓存与仓库示例。

## Helpers

可执行入口为 [scripts/verify.mjs](scripts/verify.mjs)，提供 doctor、launch、drive、cleanup 与 report。

CI 可执行入口为 [scripts/ci.mjs](scripts/ci.mjs)：`npm run verify:ci -- --run-id <unique-id> --reference-cache <absolute-directory>`。它驱动全部八项功能，明确检查 Imagegen 预期缺图门，清理后核对证据。依赖由根目录 package-lock.json 与 [requirements-ci.txt](scripts/requirements-ci.txt)固定；CI 不会自动重打包来修复未提交的生成副本。

<!-- Source links alone did not prove original architecture figures displayed; the new helper records browser evidence separately from aesthetic review. -->
应用架构与浅色选择另由 [scripts/architecture-references.mjs](scripts/architecture-references.mjs) 验证：先按独立 catalog 准备只读缓存，再执行 `npm run verify:architecture-references -- --cache <absolute-cache-directory> --out <fresh-evidence-directory>`。双视口显示、筛选、放大、空状态及主题明暗选择的范围见[图库功能](features/reference-gallery.md)。已有本地浏览器限制时，该入口同样不能绕过限制；独立 CI 保留结果。

CI 另运行 [scripts/ci-visual.mjs](scripts/ci-visual.mjs)：`npm run verify:visual -- check --out <absolute-directory>`。它生成两套八页样张、双视口 QA 与逐页和整套基线对照。变化或缺少已评审基线返回 needs-review 和退出码 4；相同内容、环境与截图才继承已有视觉判断。CI 还读取 PR 目标提交或 push 前提交的旧基线，防止直接编辑文件绕过比较。artifact 和显式 `accept --capture <directory> --review <file>` 更新流程见 [CI 文档](../../../docs/ci.md)。更新时必须实际查看两边的 16 页及两套，对每个维度记录比较和截图依据；任一退步或不确定阻断接受。用户拒绝的 s06 相同图片始终阻断。

视觉评测入口为 [scripts/visual-review.mjs](scripts/visual-review.mjs)，提供 prepare、assess 与 report。其回归可用 `node --test .agents/skills/verify-storyweave/tests/visual-review.test.mjs` 执行；测试覆盖退步不能平均抵消、相同用户反例不能改判、缺评和陈旧截图不能通过。

图库驱动内部使用 [scripts/reference-gallery.mjs](scripts/reference-gallery.mjs)；它是导入模块，通过 `drive reference-gallery` 执行。独立字节审计入口为 [scripts/audit-reference-gallery.py](scripts/audit-reference-gallery.py)，由 drive 调用，也可针对已有产物重验：

```bash
python3 .agents/skills/verify-storyweave/scripts/audit-reference-gallery.py --repo "$PWD" --cache <absolute-cache-directory> --offline <absolute-offline-directory> --installed <absolute-installed-skill-directory> --out <absolute-json-path>
```

审计输出的 `browser_verified` 固定为 false。文件可解码、计数相符与真实页面显示是不同验收结果。

视觉评审入口为 [scripts/visual-review.mjs](scripts/visual-review.mjs)，命令为 `node .agents/skills/verify-storyweave/scripts/visual-review.mjs assess --packet <packet-path> --input <filled-review-path> --out <evidence/visual-assessment-path>`。评审必须来自实际查看图片的判断，不能用技术检查结果自动填写。

Bento 子进程同时设置本次工作目录的 `STORYWEAVE_BENTO_CACHE_DIR` 与 `--no-bento-update`。只有后者仍可能读取用户缓存。功能、命令或浏览器入口变化后，用 `/maintain-verification-skill` 更新地图，并重新驱动受影响路径。
