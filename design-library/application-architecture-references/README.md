# 应用架构讲解参考

[查看全部案例](index.html)。当前 18 个案例：16 个结构讲解参考进入 HTML Skill，2 个浅色等距参考进入 Imagegen Skill。图解保留原始比例；长图宜拆页讲解。

项目维护图、可运行示例、作者教学模型和 AI 生成示例分别标注。它们用于研究组件分组、服务边界、主调用链与数据流，不作为某家公司当前生产架构的完整证明。普通方框连线不计为 Imagegen 风格。

| 案例 | 路由 | 可借鉴内容 | 来源 |
| --- | --- | --- | --- |
| Slack：连接建立与服务发现 | HTML / SVG | 客户端与网关、频道服务之间的连接建立。 | [Slack Engineering](https://slack.engineering/real-time-messaging/) |
| Slack：一条消息的路径 | HTML / SVG | 按消息经过的服务组织讲解，突出主调用链。 | [Slack Engineering](https://slack.engineering/real-time-messaging/) |
| Slack：事件分发 | HTML / SVG | 区分事件来源、分发层和客户端接收路径。 | [Slack Engineering](https://slack.engineering/real-time-messaging/) |
| Discord：请求合并服务 | HTML / SVG | 在存储前增加服务层，解释如何减少重复请求。 | [Discord Engineering](https://discord.com/blog/how-discord-stores-trillions-of-messages) |
| Uber：网关与公开/私有接口边界 | HTML / SVG | 通过领域边界和网关减少跨服务依赖的讲解方法。 | [Uber Engineering](https://www.uber.com/gb/en/blog/microservice-architecture/) |
| AWS：航空订票示例应用 | HTML / SVG | 联合展示用户入口、业务域、异步工作流与存储。 | [AWS Compute Blog](https://aws.amazon.com/blogs/compute/building-well-architected-serverless-applications-introduction/) |
| Google：Online Boutique 电商微服务 | HTML / SVG | 以购物链路讲清前端、结账、支付、购物车、推荐及服务调用。 | [Google Cloud](https://github.com/GoogleCloudPlatform/microservices-demo/tree/c7cb6d5bfd6ea3aed768634ebbcb98cb7a523712) |
| RAGFlow：应用与知识处理架构 | HTML / SVG | 展示入口、API、文档处理、检索、模型和存储等系统边界。 | [InfiniFlow / RAGFlow](https://github.com/infiniflow/ragflow) |
| Netflix：总体架构教学图 | HTML / SVG | 从客户端到后端、存储和内容交付的分层总览。 | [ByteByteGo](https://bytebytego.com/guides/netflixs-overall-architecture/) |
| YouTube：视频处理与编码 | HTML / SVG | 在流程中展开集群、服务器和加速卡的空间层次。 | [ByteByteGo](https://bytebytego.com/guides/how-does-youtube-handle-massive-video-content-upload/) |
| 聊天应用：在线与离线消息 | HTML / SVG | 用编号路径和分支讲解消息存储、同步及推送。 | [ByteByteGo](https://bytebytego.com/guides/how-do-we-design-a-chat-application-like-whatsapp-facebook-messenger-or-discord/) |
| 搜索引擎：采集、索引与查询 | HTML / SVG | 区分离线索引构建与在线查询路径。 | [ByteByteGo](https://bytebytego.com/guides/how-do-search-engines-work/) |
| 支付系统：执行、钱包与账本 | HTML / SVG | 通过业务职责和外部支付边界组织调用关系。 | [ByteByteGo](https://bytebytego.com/guides/payment-system/) |
| 浅色等距：AI 数据处理 | Imagegen 插画 | 观察有标注的组件与路径如何融入浅色空间；仅借鉴视觉组织。 | [Icograms](https://icograms.com/templates/1248/ai-data-processing) |
| 浅色等距：网络层次 | Imagegen 插画 | 观察有标注的组件与路径如何融入浅色空间；仅借鉴视觉组织。 | [Icograms](https://icograms.com/templates/291/network-diagram-1) |
| AI 案例：企业银行应用架构 | HTML / SVG | 评估有明确组件与关系的 AI 生成架构讲解图。 | [ArcadeAI / Blueprint MCP](https://github.com/ArcadeAI/blueprint-mcp) |
| AI 案例：LangGraph 架构学习卡 | HTML / SVG | 评估有明确组件与关系的 AI 生成架构讲解图。 | [ArcadeAI / Blueprint MCP](https://github.com/ArcadeAI/blueprint-mcp) |
| Google：Bank of Anthos 银行示例应用 | HTML / SVG | 浅色服务分区适合讲解金融应用的入口、账户与交易边界。 | [GoogleCloudPlatform/bank-of-anthos](https://github.com/GoogleCloudPlatform/bank-of-anthos/tree/db35fea9fd090150e2398106aadb475576f80d94) |

Bank of Anthos 与 Online Boutique 的两张 Apache-2.0 原图随 HTML Skill 分发，保留许可文本、原图哈希与固定版本来源。其余原图只链接来源，不复制到分发包；ByteByteGo 的非商业、禁止演绎许可、Icograms 模板版权和其他来源限制保留在目录中。

从仓库根目录更新或校验目录：

```bash
node scripts/build-architecture-reference-gallery.mjs
npm run check:architecture-references
```

私有离线查看复用原图缓存，每张图均核对已查看原图的哈希。导出目录应放在分发 Skill 之外：

```bash
python3 scripts/cache-presentation-references.py --catalog design-library/application-architecture-references/catalog.json --cache ./tmp/application-reference-cache
node scripts/build-architecture-reference-gallery.mjs --cache ./tmp/application-reference-cache --out ./tmp/application-reference-offline
```

CI 检查生成副本、原图字节、双视口实际显示、分类、搜索、放大和浅色主题选择。技术检查不自动判断新图的审美，也不调用图片服务。
