# 独立 Skill 的运行文件打包

## 问题与调用方式

四个公开入口继续使用原命令。每个 Skill 自带所需代码和资源，分别安装到不同根目录后运行。安装、doctor、HTML 构建和 Bento 包装不要求额外的共享目录。

```bash
node scripts/package-skills.mjs
node scripts/package-skills.mjs --check
node scripts/measure-packages.mjs
node skills/storyweave/install.mjs --dir <install-root>
```

打包器当前按目录复制，两个适配包因此带入未使用的内容和主题模块。官方 Bento shell 没有默认文档可裁剪，大部分字节属于必需的内嵌运行时。其字节和功能需要完整保留。

## 入口决定运行模块

`collectRuntimeFiles(sourceRoot, entries)` 返回各 CLI 入口可达的本地模块列表。构建专用子进程启用 Node 的 `vm.SourceTextModule`，只编译和读取静态依赖，不链接或执行应用代码。静态 import、side-effect import 和 re-export 使用 Node 自身的语法解析。

当前唯一的动态导入位于 `core/resources.mjs`，用于加载已解析的第三方依赖。该已知边界保留；其他动态导入在构建时拒绝，避免漏掉计算得到的本地依赖。裸第三方静态依赖也拒绝，运行时继续通过现有可选依赖边界加载。

打包后仍保留 `runtime/<source-relative-path>`，不转换模块内容。`import.meta.url`、主题合同位置及可选依赖解析语义保持一致。只有依赖闭包需要主题合同时，包内才保存公共主题合同。公开输出 schema 仍作为协议资料交付。

## Bento 原稿与运行资源各有身份

`vendor/bento/` 保存一份逐字节保留的官方 HTML 与来源记录。Express 和全局 Skill 各自携带一份 `.html.br`，通过 Node 标准库解压。Bento 模块校验解压后的官方 SHA，再将恢复的 HTML 交给现有包装逻辑。

| 数据 | 身份与用途 |
| --- | --- |
| `vendor/bento/Bento_Slides.bento.html` | 官方原稿，保留内嵌代码与通知 |
| `assets/bento/Bento_Slides.bento.html.br` | 每包独立的运行资源，`source-manifest` 校验其压缩字节 |
| `assets/bento/SOURCE.json` | 官方原稿的来源与 SHA，校验解压后字节 |
| 用户缓存及显式 HTML | 沿用已有 HTML 格式和更新语义 |

`readBentoShell(path)` 负责读取与无损恢复；`inspectBentoShell(path)` 报告解压字节、存储字节与合同信息。包装层使用该读取入口，不直接将压缩文件当作 HTML。打包器同时清除旧的原始副本和过期合同，`--check` 能识别残留。

## 方案选择

采用入口闭包作为基础，合入独立 Brotli Bento 资源和生成 JSON 的紧凑序列化。Node 语法解析替代宽泛的依赖正则，减少遗漏依赖的可能。HTML 渲染源码、主题 recipe、用户素材和内容模板保持原值。

Laziness Protocol 用于先删除未使用模块；Build the Lever 用于把依赖和体积检查写成可重跑工具。Prove It Works 要求解压哈希一致、四包独立运行，以及九份 HTML 和十六张双视口截图前后一致。

| 其他方案 | 未采用原因 |
| --- | --- |
| 共享全局 core 或 Bento 缓存 | 安装包产生相邻目录和共享状态依赖 |
| 源码归档后解包 | 最终安装字节恢复，启动解包还增加写权限与并发状态 |
| 单文件转换或自定义加载器 | 改变资源定位，增加构建依赖或运行协议 |
| 删除 Bento 内嵌 CSS、JS | 这些数据属于编辑运行时，不能据此缩减功能 |

本轮保留每个独立包都需要的公共模块副本。减少的是无用模块和资源存储开销，不以硬链接或共享缓存计算去重收益。示例和文档继续保留，体积报告同时列出必需运行文件与完整安装目录。
