# HTML 同内容视觉样张

本目录是明确标注的验收样例，内容取自仓库 `content-v4.example.json`，图片为本轮原创折纸 SVG 插画。数字表示仓库已有生成路径和画布参数，不是业务 KPI。两种风格都覆盖封面、观点、对照、流程、数据、系统图、图片主视觉和收尾。

[杂志风 8 页](after/editorial/index.html) · [瑞士风 8 页](after/swiss/index.html) · [优化前整套](before/contact-sheet.html) · [优化后整套](after/contact-sheet.html)

`before/` 在本轮修改前由 renderer 4.0 生成，`after/` 由 renderer 4.1 重新规划与构建。每种风格的批准稿前后逐字节一致，两套内容的 revision 都是 `1708b64e44e41252474c745c3c583b322b1de6694f706704070da3a40998182a`。旧图片页的标题超出容量，原 QA 各有 4 个 blocking；新两套均为 browser、blocking 0、warning 0、degraded 0。

每套项目保留批准稿、计划、实际页面、素材、清单、QA、双视口截图、浏览器动作与 trace。手工修改页面后重新运行 QA；原报告不批准后续编辑。

本轮正式验收位于 `tmp/verification/html-visual-20261101-a04/evidence/`，包含逐页前后对照、公开 CLI、双视口播放及 v2/v3 兼容证据。生成前后对照的可复用入口为：

```bash
node scripts/html-visual-samples.mjs --phase before --out <absolute-path>
# 在修改渲染器并同步运行包后执行：
node scripts/html-visual-samples.mjs --phase after --out <absolute-path>
```
