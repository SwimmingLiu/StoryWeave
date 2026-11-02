# HTML 内容、来源与信息关系

每页保留一个明确主张。标题与逐页主张组成叙事，事实、引语和推断分别说明依据。公开数据记录来源、口径、单位与日期；未确认的占位内容留在草稿，不直接上页。

## 结构化内容

| `content.type` | 字段 | 关系 |
| --- | --- | --- |
| `statement` | `title`、`body`，可选 `kicker`、`attribution` | 单一主张、正文或引语 |
| `comparison` | `title`、`columns`、`rows[].label` 与 `values` | 每行值与相同的比较列对应 |
| `process` | `title`、`steps`、`edges` | 步骤与明确方向，边端点使用步骤 ID |
| `metrics` | `title`、`metrics[].value`、`unit`、`label`、`source`，可选 `body` | 指标、单位与事实来源 |
| `graph` | `title`、`nodes`、`edges` | 节点与显式关系，边可有确认标签 |

`role` 表示沟通任务，例如 cover、statement、comparison、process、data 或 closing；`content.type` 表示信息结构。两者不相互替代，布局不能为得到循环图而补造一条反馈边。

core 的批准操作从结构化字段投影 `exact_text`，这份派生列表是页面允许的可见内容。不要手工维护第二份文案。来源、备注和叙事参考属于内容修订，视觉主题与素材布局属于生成器计划。

## 阅读模式与容量

`reading_mode` 使用 `speaker-led` 或 `reading-first`。前者正文以 60 个中英文字符作为复核提醒，内容过密时先拆页或放入备注，不机械截断。

HTML 计划根据内容结构生成 `anchor`、`breathing` 或 `dense` 的 `page_rhythm`。计划对正文段落、比较行列、步骤、指标和节点数量设置容量限制，超出时报告页面，作者调整内容或版式后再构建。

## 事实与设计参考

项目事实保存在 evidence 与 sources，叙事方法使用独立的 `narrativeReferences`。视觉参考进入私有计划并写明具体应用，不提供本项目的数字、品牌、人物或论断。案例库更新不自动改变既有批准内容。

素材槽位与图片元信息见 [HTML 素材](assets.md)。图注必须来自确认内容，不能通过计划字段添加额外页面文字。
