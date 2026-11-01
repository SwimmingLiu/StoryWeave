# HTML 视觉计划与版式

`editorial/paper-magazine` 使用宋体标题、宽窄错列和纵向数字账单；`systems/ink-blue-grid` 使用轻字重无衬线、16 列网格、锚点色封面与对开收尾。两者共用结构化内容，计划分别保存布局、字体、色调、密度与图片槽位。

| 内容 | 自动选择条件 | 布局 |
| --- | --- | --- |
| 封面、章节、收尾、引用 | 对应 statement 角色 | cover-split、closing-statement、quote |
| 观点 | 瑞士风、至少两段正文、标题至多 24 字 | statement-split |
| 图片主视觉 | 普通 statement 显式绑定 hero 资产 | image-hero |
| 对照、数据 | 明确比较轴或指标来源 | comparison-matrix、metric-ledger |
| 流程、关系 | 只有批准的节点与边；显式循环才用 loop | process-linear、process-loop、process-network、relationship-map |

舞台固定为 1280×720。杂志风采用 80px 边距与 12 列网格，瑞士风采用 64px 边距与 16 列网格。标题按长度和版式使用 48–96px，正文至少 24px，图注至少 16px。页面底部保留 80px；主标题与内容间距通常为 48px，封面及图片页为 40px。计划 `slides[].geometry` 保存适用于该页的值，浏览器按舞台设计单位检查，竖屏不改变字号与布局。

<!-- The previous shared image box and title-only wrapping missed visual differences and body orphans. -->
杂志图片主视觉采用正文侧栏与右侧 21:9 图片。瑞士风在标题至多 52 字、正文至多 100 字时使用 4:1 通栏图片和下方双列说明，容量较大时回到分栏图文。普通配图使用 4:3。计划的 `composition` 与 `asset_slots` 记录实际选择。

中文短词保护覆盖标题、正文、比较表和节点说明，保持准确文字不变。中性对照各数据列使用相同文字颜色与字重。流程连线使用独立轨道，按实际 DOM 节点边界绘制；杂志风的三层小型无环图采用上下构图，其他关系图根据批准的拓扑布局。

`asset_refs` 可明确 `fit`、归一化 `focal_point` 和 `subject_safe_area`，例如：

```json
{
  "asset_id": "scene",
  "path": "assets/scene.png",
  "slot": "hero",
  "fit": "cover",
  "focal_point": { "x": 0.5, "y": 0.5 },
  "subject_safe_area": { "x": 0.3, "y": 0.25, "width": 0.4, "height": 0.5 },
  "alt": "素材实际内容的简短描述"
}
```

需要完整保留文字的截图使用 `contain`。图注只取批准的 attribution。QA 核对比例、焦点、裁切后的主体区域、中文实际行框、正文孤字、短词拆行、字号字重、文字重叠、标题间距、底部留白和导航遮挡。连线检查采样路径与文字、编号及非端点节点的碰撞，并测量端点到节点的距离；neutral 对照检查各列文字的颜色与字重。它也继续检查内容结构及 artifact_binding；自动通过后仍需查看逐页图与整套缩略图。

升级至 renderer 4.2 后，旧 v4 计划需要运行 `replan`，随后 `build` 和 `qa`。批准稿的字节与 content revision 保持不变。v2、v3 继续使用原渲染器。
