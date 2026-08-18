# `wuming-cyan-circuit-launch-ppt` 与 Storyweave 对照研究

研究日期：2026-08-15。目标仓库按 `main` 当前提交 `20915a2dcf775f937b53258007d09a5412c8d2ff`（2026-06-18，提交信息为 `Restore README QR codes`）核验。固定快照目录见 [GitHub tree](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/tree/20915a2dcf775f937b53258007d09a5412c8d2ff)。

## 结论

`wuming-cyan-circuit-launch-ppt` 是一个面向 CodeX 的单页整图生图 Skill：模型先把长内容压缩成短标题、短标签和少量说明，再调用 `imagegen`/内置 `image_gen` 生成一张 16:9 横版图片。它的卖点是固定的「青蓝电路发布会 PPT」视觉配方，不是多页演示文档管线。仓库没有模型 ID、像素尺寸、生成脚本、PPTX/Bento 组装器、编辑器源文件或 QA manifest。

StoryWeave 当前由三个独立 Skill 组成：`storyweave-html` 生成可编辑 HTML 页面，`storyweave-imagegen` 生成包含文字和版式的完整图片页面，`storyweave-express` 可选地把两种结果包装为 Bento。两者可以组合：把 Wuming 的白底青蓝、电路线和 HUD 圆环作为 StoryWeave Imagegen 的主题配方，同时保留 Storyboard、逐字文案、逐页 Review 和标准输出 manifest。

## 目标仓库目录与证据

GitHub 的完整树在 [commit tree](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/tree/20915a2dcf775f937b53258007d09a5412c8d2ff)；截至该快照只有下列 7 个文件，没有 `scripts/`、`package.json`、`schemas/` 或生成结果目录。

| 路径 | 类型/作用 | 关键事实 | 来源 |
|---|---|---|---|
| `README.md` | 使用说明、效果图、仓库结构 | 说明只支持 CodeX；示例调用是“生成一张 16:9 青蓝电路发布会 PPT 风格图片”，也支持明确要求“只给提示词” | [README.md](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/README.md) |
| `SKILL.md` | Skill 元数据、风格规则、Prompt Template、出图/避免项 | 默认调用 `imagegen` skill / 内置 `image_gen`；规定内容提炼、页面形态、文字限制和负面约束 | [SKILL.md](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/SKILL.md) |
| `agents/openai.yaml` | CodeX 展示信息 | 展示名“青蓝电路发布会PPT”；默认 Prompt 调用 `$wuming-cyan-circuit-launch-ppt` 并要求生成 16:9 图片 | [agents/openai.yaml](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/agents/openai.yaml) |
| `assets/preview.png` | 唯一视觉样例 | 预览图；从远端下载后核验为 PNG，1672×941，约 16:9 | [assets/preview.png](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/assets/preview.png) |
| `assets/qrcode-wechat-official.jpg` | 作者/公众号二维码 | README 的“关注与交流群”表格使用，不是生成管线配置 | [assets/qrcode-wechat-official.jpg](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/assets/qrcode-wechat-official.jpg) |
| `assets/qrcode-wechat-group.jpg` | 微信群二维码 | README 的“关注与交流群”表格使用，不是生成管线配置 | [assets/qrcode-wechat-group.jpg](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/assets/qrcode-wechat-group.jpg) |

## Wuming 的生成合同

### 模型、尺寸和调用入口

| 项目 | 仓库明确内容 | 未提供的内容 |
|---|---|---|
| 模型 | `SKILL.md` 只写“调用 `imagegen` skill / 内置 `image_gen` 工具”。用户说“生成图片”“直接出图”“画一张”“配图”“PPT 图”“演示页”时调用 `image_gen`。 | 没有模型名称、供应商、API 地址、密钥配置、质量档位、重试次数或 seed；模型选择由宿主的 `imagegen` 能力决定。 |
| 尺寸 | README、`SKILL.md` Prompt Template 和 `agents/openai.yaml` 均要求 `16:9` 横版 PPT 风格图片。 | 没有生成像素尺寸、DPI、压缩格式、文件命名或导出参数。预览 PNG 的 1672×941 只是样例资源尺寸，不能当作生成 API 的固定输出尺寸。 |
| 输出分支 | 默认整理提示词并出图；用户明确说“只给提示词”时只输出完整提示词、不调用图片生成。 | 没有脚本将结果保存为 PPTX、Bento、PDF 或可编辑对象。仓库也没有输出 manifest 或结果校验文件。 |

### 整页提示词模板

`SKILL.md` 的 `Prompt Template` 是一份完整的整页生图提示词，而不是结构化 deck JSON。其槽位和约束如下（原文路径：[SKILL.md#prompt-template](https://github.com/chujianyun/wuming-cyan-circuit-launch-ppt/blob/20915a2dcf775f937b53258007d09a5412c8d2ff/SKILL.md#prompt-template)）：

| 提示词段落 | 要求 |
|---|---|
| 图片类型与比例 | “生成一张 16:9 横版 PPT 风格图片”，风格名为「青蓝电路发布会 PPT」 |
| 主题/核心表达 | `[用户主题]` 与 `[用一句话概括这张图要讲清的内容]` |
| 页面结构 | 根据内容自然选择封面、流程、对比、矩阵、架构、数据概览或观点总结；不要照搬预览图 |
| 主要内容 | `[提炼后的短标题、短标签和必要说明]`；长文先压缩 |
| 视觉风格 | 白色或极浅蓝背景、高留白；青蓝、蓝绿、深蓝灰；浅青、淡蓝、白色高光、少量渐变；电路线、HUD 圆环、编号节点、细线连接、线性图标、轻量几何 |
| 文字要求 | 中文短标题和短标签为主，清晰可读；不要长段落、密集小字或乱码 |
| 限制 | 不要水印、账号名、Logo、真实品牌资产、版权角色、真实人物；不复制参考图完整文案；不遮挡文字、图形和装饰；避免暗黑霓虹、复杂芯片照片、赛博海报、密集大屏、真实设备广告 |

这里的文字要求属于“整张图片中的文字要求”：Wuming 没有另行输出 `exact_text`、文本框或图层 JSON。提示词要求模型直接在成图中绘制短标题/标签；因此文字可读性由生图模型负责，不能像 Bento 原生文本那样单独编辑。

### 内容范围与视觉样例

`SKILL.md` 允许的内容场景包括产品发布、会议封面、技术概念、AI/Skills 方法论、流程步骤、目录和科技观点说明；页面形态可以是封面、目录、流程、对比、矩阵、架构、数据概览或观点总结。长内容的处理规则是先理解、分组和压缩，避免把整段文字塞进画面。

`assets/preview.png` 是仓库唯一的演示输出。图中可见的样例文案为“装更多龙虾解决不了问题”“你需要挖掘工作场景，打造并持续优化 Skills”，中心模块“打造持续优化的 Skills / 场景驱动”，底部三个节点“挖掘工作场景”“沉淀可复用技能”“持续迭代优化”。画面采用白底、蓝青电路线、中央 HUD 圆环和 01/02/03 编号节点，能说明目标视觉系统，但 `SKILL.md` 明确要求新图不要复制其文案、圆环位置或装饰细节。

### 是否支持编辑

仓库目录中没有 `.pptx`、`.bento.html`、HTML/CSS 编辑器、逐页 JSON、素材 manifest 或重绘脚本。结合“输出一张 16:9 图片”的 README 和整页生图 Prompt，可确认交付边界是扁平图像；仓库没有对象级编辑流程。若要改字或改版式，当前仓库只给出重新提炼 Prompt 后再生成这一条路径（这是由仓库缺少编辑源文件推得的操作结论，不是额外 API 承诺）。

## 与本地 Storyweave 的对照

本节引用工作区中的实现，便于决定是直接使用 Wuming，还是把它作为 Storyweave 的视觉配方：

| 维度 | Wuming (`wuming-cyan-circuit-launch-ppt`) | StoryWeave |
|---|---|---|
| 主要交付 | 一张 16:9 青蓝电路发布会风格图片；也可只输出 Prompt | HTML 或完整页面 PNG；PDF/PPTX 和 Bento 是可选派生物 |
| 内容规划 | LLM 临时提炼短标题、标签和少量说明；无草稿文件或确认门 | `outline_draft.json` → 用户确认 → `deck_spec.json`；每页一个主张和封闭的准确文字清单 |
| 图片模式 | 整页图片，Prompt 允许/要求图中有短中文文字 | `storyweave-imagegen` 同样生成完整图片页，并增加主题配方、稳定文件名、manifest 和逐页 Review |
| 非图片模式 | 没有 | `storyweave-html` 不调用 Imagegen，文字、图表、形状、SVG 和用户图片保留在 HTML 中 |
| 主题系统 | 单一固定青蓝电路配方，依据内容选择单页结构 | HTML 与 Imagegen 分别管理主题；一份 deck 只使用一个主题和一组连续性锚点 |
| 生成/构建脚本 | 无脚本 | 两个生产者分别提供 `draft`、`approve`、`build`、`qa`、`export`；Imagegen 另有 `prompts` |
| 数据格式 | Markdown 指令和自由文本 Prompt | Storyboard、deck spec、generation manifest、QA report 和 `storyweave-output.json` |
| 编辑性 | 未提供图层或对象级编辑源；成图后需重生成 | HTML 页面可以修改；Imagegen 页面通过重生成指定页修改；Express 只负责 Bento 包装 |
| 事实/QA | 只规定不编造品牌资产、人物、Logo、乱码等图像约束；无结构或浏览器 QA | 有资料缺口记录、用户确认门、结构校验、图片/浏览器 Review 和导出规则 |
| 示例资源 | 1 张 `preview.png`，2 张公众号/微信群二维码 | 三个 Skill 自带示例；仓库不保存生成结果和对照案例 |

Storyweave 的关键实现入口：

- [`skills/storyweave-html/SKILL.md`](../../skills/storyweave-html/SKILL.md)：完整 HTML 页面生产合同和 CLI。
- [`skills/storyweave-imagegen/SKILL.md`](../../skills/storyweave-imagegen/SKILL.md)：完整图片页面生产合同、主题、提示词编译和 Review 门。
- [`skills/storyweave-express/SKILL.md`](../../skills/storyweave-express/SKILL.md)：消费 `storyweave-output.json` 并包装为 Bento。

## 可行的组合方式

1. **需要单张宣传/封面图**：直接调用 Wuming。它的输入和输出都很短，适合“主题 → 一张图”的任务；但应把交付理解为位图，不承诺可编辑 PPT。
2. **需要多页且希望直接改文字和结构**：使用 `storyweave-html`。把 Wuming 的留白、青蓝线条和节点语言实现为 HTML 主题，不把关键信息画进位图。
3. **需要多页整图视觉**：使用 `storyweave-imagegen`。保留 Wuming 的色系、材质、图形语言和负面约束，并把页面允许出现的文字冻结到 `exact_text`；修改时只重生成失败页。
4. **模型/尺寸配置**：不要从 Wuming 仓库推断模型或像素尺寸。组合进 StoryWeave 时由宿主 Imagegen 配置决定模型；Wuming 仓库本身只给出 16:9 比例。
