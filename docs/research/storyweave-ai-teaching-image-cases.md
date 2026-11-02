# StoryWeave 教学绘图案例参考

这里保存独立知识插画的调研结果，适合检索部件剖面、生物结构和微缩场景等配图方法。演讲与分享稿的整页风格参考保存在 [presentation-references](../../design-library/presentation-references/catalog.json)，Skill 入口使用该目录。

下列 9 项保留实际图片、公开提示词与来源归因。它们提供独立绘图的视觉方法；解剖、工程尺寸、物种信息和地图位置需依据教学材料确认。原作者未确认具体版本时，模型名称保留为 Nano Banana。

## 可收录案例

| 案例 ID | 实际画面与教学用途 | 模型证据 | 原图与提示词 |
| --- | --- | --- | --- |
| `openai-coffee-machine` | 自动咖啡机的内部部件、管道与工作过程。中央写实剖面适合解释部件如何协作。 | OpenAI 官方文档分别提供 GPT Image 2.5 Sunburst 与 Flare 的实际输出。 | [Sunburst 原图](https://developers.openai.com/images/platform/guides/image-prompting/infographic-coffee-machine-gpt-image-2-5-sunburst.webp) · [Flare 原图](https://developers.openai.com/images/platform/guides/image-prompting/infographic-coffee-machine-gpt-image-2-5-flare.webp) · [官方提示词](https://developers.openai.com/api/docs/guides/image-prompting#explain-a-process-visually) |
| `sunburst-watch-exploded` | 虚构机械腕表的分层爆炸图，显示玻璃、金属、齿轮与皮革的空间层级。 | wuyoscar 公开记录使用 `gpt-image-2.5-sunburst` 的生成请求和输出。属于作者记录。 | [原图](https://raw.githubusercontent.com/wuyoscar/GPT-Image2-Skill/main/docs/technical-illustration/meridian8-sunburst.png) · [生成记录](https://github.com/wuyoscar/GPT-Image2-Skill/blob/main/docs/sunburst-samples.md) · [No. 113 提示词](https://github.com/wuyoscar/GPT-Image2-Skill/blob/main/skills/gpt-image/references/gallery-technical-illustration.md) |
| `sunburst-toy-cutaway` | 复古机器人玩具一半保留涂装，一半透明展示弹簧、齿轮、电池与扬声器。 | PopNow 明确将本图标为 GPT Image 2.5 Sunburst 实际生成，并区分原始 Nano Banana 提示词与重绘输出。属于平台声明。 | [原图](https://media.popnow.ai/prompts/templates/toy-xray-cutaway-b2b4b9d7.webp) · [提示词与生成设置](https://popnow.ai/prompts/toy-xray-cutaway) |
| `edu-wind-turbine-cutaway` / YouMind 19396 | 风机全景连接机舱剖面、传动轴、齿轮箱、发电机与电网。适合讲解能量转换和机械传动。 | Gagan Singh 原帖明确写 Gemini Nano Banana Pro。属于作者声明。 | [原图](https://cms-assets.youmind.com/media/1778486141781_1gh8iz_HH7wWN9bMAAKY3p.jpg) · [作者原帖与完整提示词](https://x.com/GaganSingh8u/status/2053342755791999091) · [汇编记录](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/e2e90168be2a2d13c5195a0bb463c466e4720455/README.md#L2103) |
| `edu-renaissance-flamingo-anatomy` / YouMind 7022 | 单腿站立的火烈鸟，以石墨排线、透明组织和骨架叠层呈现。适合介绍自然学观察与结构分层。 | Brendan Graetz 原帖写 nano banana prompt。汇编归入 Pro，但原帖没有确认具体版本。 | [原图](https://cms-assets.youmind.com/media/1768977372426_bjk9g6_G_FG87xXEAAnMEK.jpg) · [作者原帖与完整提示词](https://x.com/bguiz/status/2013469317548134903) · [汇编记录](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/3320772b2ad433b6315f6a733e5d00918fce4a86/README.md#L3467) |
| `edu-culinary-science-diorama` / YouMind 6666 | 巧克力微缩实验箱把原料、加工状态、质地样本、实验台和研究人员放在同一模型中。适合食品加工与材料观察课。 | Gadgetify 原帖明确表示使用 Nano banana Pro 绘制巧克力和焦糖。 | [原图](https://cms-assets.youmind.com/media/1768804323526_yo8sqc_G-1VmdxWgAAhdsk.jpg) · [作者原帖与完整提示词](https://x.com/Gdgtify/status/2012873106348482898) · [汇编记录](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/4f4bdafea682eb1c9383f8d55e21f97fa354edb7/README.md#L3812) |
| `edu-orchid-mantis-fieldboard` / YouMind 7050 图 1 | 兰花螳螂观察板包含雌雄形态、生命周期、栖息地与花朵拟态场景。适合把标本观察和生态环境联系起来。 | Alexandra Aisling 原帖明确写 Nano Banana Pro, Species Board, in Firefly。 | [原图](https://cms-assets.youmind.com/media/1769063173711_oz6u5l_G_M6E2MWQAUsAka.jpg) · [具体案例](https://x.com/AllaAisling/status/2014017858607399325/photo/1) · [原帖与完整提示词](https://x.com/AllaAisling/status/2014017858607399325) · [汇编记录](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/413e9703bb3f9909c62a4812936ad2490ee63d0d/README.md#L3205) |
| `edu-diamond-production-diorama` / YouMind 4808 | 地图桌面上的 S 形输送带连接钻石开采、加工和珠宝零售。物料随工序变化，适合产业链教学。 | Gadgetify 原帖明确写 Nano Banana Pro，并指定 diamond ring。原图展示钻石，提示词模板也支持咖啡等商品。 | [原图](https://cms-assets.youmind.com/media/1767682202355_t27yr6_G9y3TexW8AAKh1K.jpg) · [作者原帖与完整提示词](https://x.com/Gdgtify/status/2007968286462681240) · [汇编记录](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/d51b7d3c707e8dc466d2721616b59a37cdfd65c9/README.md#L2854) |
| `edu-car-half-cutaway` / PicoTrex 80 | 汽车保留一侧外壳，另一侧暴露座舱和机械结构。适合说明外形与内部布置的对应关系。 | Will Oldgram 的 2025 年 9 月原帖写 Nano Banana，没有具体版本。需要输入汽车参考图。 | [原图](https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/images/case80/output.png) · [作者原帖与完整提示词](https://x.com/old_pgmrs_will/status/1966053092371444029) · [汇编记录](https://github.com/PicoTrex/Awesome-Nano-Banana-images/blob/main/README.md#L2843) |

## Imagegen 与 HTML 的分工

| 案例 | Imagegen 生成的重点 | HTML/SVG 保留的部分 |
| --- | --- | --- |
| 咖啡机原理 | 内部部件、透明水箱、管路与金属材质。 | 标题、部件标签、步骤与数值。 |
| 机械表爆炸图 | 不同材质的复杂零件、分层和统一透视。 | 零件名称、编号、尺寸表。案例腕表和规格属于虚构设计。 |
| 玩具剖面 | 同一对象的涂装外壳与连续透明内部。 | 五个标签、引线与部件说明。案例不能证明真实玩具的装配或电路。 |
| 风机剖面 | 外壳剖切、齿轮与绕组、部件遮挡和机械空间关系。 | 标题、编号、部件名称、引出线和能量流箭头。 |
| 火烈鸟解剖 | 连续的羽毛、组织透明层、骨架和手绘排线。 | 讲解文字、局部放大框与结构标注。 |
| 食品实验箱 | 食材质地、微缩人物、实验器材和实体模型箱。 | 加工阶段名称、样本标签、对比数据。原图小标签存在不可读字符，教学正文需重新排版。 |
| 螳螂观察板 | 生物细节插画、花朵拟态场景、标本纸和木框材质。 | 三栏布局、地图图例、物种信息与状态标签。AI 画面不能证明真实野外记录或保护等级。 |
| 钻石产业链 | 开采、加工和商店剖面形成的连续微缩场景，以及输送带中物料的变化。 | 阶段标题、编号、流程说明与真实贸易数据。地图是场景底座，不代表已核实的贸易路线。 |
| 汽车半剖面 | 原照片的材质延续、同视角的外壳剥离和内部空间补全。 | 部件名称、局部高亮、引出线和改绘前后对比。原图未验证为对应车型的真实机械布置。 |

这些案例也适合混合制作。生成器只处理具有绘画价值的主体，HTML 负责文字与交互。这样既能保留视觉效果，也能降低整页文字被栅格化后的修改成本。

## 未进入本批参考的候选

| 上游案例 | 实际查验结果 | 处理 |
| --- | --- | --- |
| [OpenAI：细胞呼吸](https://developers.openai.com/api/docs/guides/image-prompting#create-scientific-and-educational-visuals) | 官方提供 GPT Image 2.5 输出，但实际画面主要是流程卡、箭头、简单图标与简化线粒体轮廓。 | 使用 HTML/SVG 保留文字和关系的可编辑性。AI 生成来源不改变这一判断。 |
| [YouMind 1519：人类细胞图](https://x.com/_simonsmith/status/1998828165951635545) | 原帖实际比较 Nano Banana Pro 与作者推测为 GPT Image 2 的 hazel-gen-2，并写明两者都有问题。 | 模型归因包含推测，保留为研究链接。不能据汇编分类给两张图统一标注模型。 |
| [YouMind 19196：眼睛与耳朵信息图](https://x.com/Minahil42298354/status/2052994086013976969) | [眼睛原图](https://cms-assets.youmind.com/media/1778397994859_vkz6wn_HH2zOPuWQAAg5jW.jpg)出现与主题不一致的 liver health 等文字，外层又包含大量普通信息卡。 | 不作为教学成图参考。可编辑布局也应交给 HTML。 |
| [YouMind 5354：发光解剖图组](https://x.com/umesh_ai/status/2009610203654947155) | 四张图分别是手、鲨鱼、章鱼和膝关节，含拟真诊断读数和科幻系统标签。汇编中的鲨鱼标题不能代表整组。 | 可另作发光线框的风格研究，本批不把它当作已验证的教学解剖图。 |
| [YouMind 12519：科学理论立体化](https://x.com/Gdgtify/status/2034606814503780798) | 原帖是 Seedream 4.5 与 Nano Banana Pro 的比较。公式升起成立体建筑属于概念隐喻，各图模型身份未逐一确认。 | 模型对照与视觉隐喻保留为研究链接。 |
| [YouMind 4604：实验笔记中的科学发现](https://x.com/Vishnudxe/status/2007676371460600021) | 汇编有图片和提示词，但原帖当前显示账号被停用。 | 原始模型声明无法复核，暂不收录。 |
| [PicoTrex 76：期货教学涂鸦](https://x.com/op7418/status/1961811274683310110) | [实际图片](https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/images/case76/output.png)解释的是期货合约，主体为标题、文字卡、时钟、人物小图与箭头。 | 适合 HTML/SVG；手绘边框和简单图标不构成使用整页 Imagegen 的理由。 |

## 来源与复用

OpenAI 案例来自官方文档，保留官方原图和提示词链接。wuyoscar 仓库根许可为 MIT，其公开记录说明腕表尺寸与规格属于虚构设计。PopNow 将玩具案例标为 Sunburst 重绘输出，原始 Nano Banana 提示词的归因与新图分开记录；平台图片只保留来源链接。

[YouMind 汇编的 LICENSE](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/main/LICENSE)声明 CC BY 4.0，README 同时说明材料来自社区。各原帖未见逐图授权，本批保留作者、原帖、提示词和远程预览，第三方原图不复制进 Skill。

PicoTrex 的 [README](https://github.com/PicoTrex/Awesome-Nano-Banana-images/blob/main/README.md)与 [LICENSE](https://github.com/PicoTrex/Awesome-Nano-Banana-images/blob/main/LICENSE)分别给出 CC BY 4.0 与 Apache-2.0。汽车案例同样仅保留来源索引。

完整机器可读条目保存于 [catalog.json](../../design-library/ai-teaching-references/catalog.json)，包含案例 ID、图片地址、原帖、提示词地址、模型证据、生成价值和 HTML 分工。该目录作为研究存档保留；演示主题画廊由 `node scripts/build-presentation-reference-gallery.mjs` 生成。
