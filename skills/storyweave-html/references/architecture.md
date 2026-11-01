# HTML 文件与模块职责

| 文件 | 所有者与内容 |
| --- | --- |
| `outline_draft.json` | 作者或 Agent 编辑叙事、事实、结构化内容、来源与备注 |
| `deck_spec.json` | 核心保存 schema 4 批准快照、`revision` 与派生的 `exact_text` |
| `plans/html.json` | HTML 保存 schema 1 计划，绑定内容修订，记录布局、主题、字阶、素材与参考应用 |
| `generation_manifest.json` | HTML 保存构建结果、布局与引用记录 |
| `index.html`、`slides/<slide-id>.html` | HTML 画廊与可独立打开的原生页面 |
| `storyweave-output.json` | 交接画布、顺序、ID、角色、备注、相对路径与渲染元信息 |
| `qa_report.json` | HTML 检查结果与实际文件的 `artifact_binding` |

`runtime/core/` 处理确认内容、公共合同与文件身份。`runtime/html/plan.mjs` 生成私有视觉计划，`render.mjs` 渲染 v4，`legacy.mjs` 保留旧版结构，`qa.mjs` 进行浏览器检查。`runtime/design-library/` 负责检索和捕获设计参考。

canonical HTML 仍输出 manifest v2，旧 HTML 输出 v1。schema 4 的内容版本不改变产物协议主版本。公共清单不保存播放器状态，Bento 消费当前文件通过 QA 的产物并单独保存适配报告。

HTML 是原生编辑源。PNG、PDF、图片式 PPTX 和 Bento 都是派生输出，不能将派生图片重新当作 HTML 文字与形状对象。
