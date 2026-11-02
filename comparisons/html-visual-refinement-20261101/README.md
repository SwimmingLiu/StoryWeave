# HTML 视觉细节修订样张

两套各 8 页，沿用上一轮批准内容。修订前保留 renderer 4.1.0 的最终版本，修订后使用 4.2.0。

| 查看内容 | 入口 |
| --- | --- |
| 逐页前后对照，共 16 组 | [before-after.html](before-after.html) |
| 杂志风，8 页播放 | [after/editorial/index.html](after/editorial/index.html) |
| 瑞士风，8 页播放 | [after/swiss/index.html](after/swiss/index.html) |
| 新版整套缩略图 | [after/contact-sheet.html](after/contact-sheet.html) |
| 修订前整套缩略图 | [before/contact-sheet.html](before/contact-sheet.html) |
| 逐页人工判断与完整验收记录 | [验收记录](../../docs/plans/html-visual-refinement-validation.md) |

本轮修复正文和节点的孤字、流程箭头与编号擦碰、中性比较的单列强调，并增加两种系统图和图片页的构图差异。新图片用相同信息块的排布说明阅读顺序与密度；没有加入文字、数据或新的关系边。

两套批准稿在修订前后逐字节一致，内容 revision 均为 `1708b64e44e41252474c745c3c583b322b1de6694f706704070da3a40998182a`。两套最终 QA 均为 browser，blocking、warning、degraded 均为 0。主代理已亲自逐页查看桌面与竖屏截图。竖屏继续等比显示固定 16:9 舞台，用于整页预览。

完整验证使用 `html-visual-refinement-20261101-r01`；清理后证据、截图、动作与 trace 均保留。121 项回归测试全部通过，935 份运行证据与 17 份产物绑定复核通过。交付文件哈希见 [delivery-manifest.json](delivery-manifest.json)。
