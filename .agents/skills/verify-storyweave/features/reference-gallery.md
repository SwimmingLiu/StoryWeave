# 演讲与分享稿参考图库

按主题与内容职责选择实际演示内容页，支持联网查看来源图和私有离线导出。

## Sub-features

- `gallery-delivery` 核对权威 catalog、分发 HTML、覆盖统计与独立安装后的资产字节。
- `gallery-cache` 逐图解码原图缓存，检查尺寸、哈希与输入只读。
- `gallery-offline` 通过公开构建命令导出内嵌原图，核对每张内嵌字节，断网打开双视口页面。
- `gallery-filter` 验证主题、观点、流程、对比、数据、架构和搜索组合，自动展开实际匹配页并显示空状态。
- `gallery-display` 每种视口逐张展开、解码并截图，核对首图直接加载、展开转 eager 和画面比例。
- `gallery-retry-zoom` 图片失败时显示重试，通过按钮重新请求；点击图片放大后可用关闭按钮或 Escape 退出。
- `architecture-routing` 应用架构资料按 HTML 与 Imagegen 分发，保留原始比例、来源、许可与已查看原图哈希。
- `light-selection` 主题页默认浅色，用户可显式查看全部主题、深色主题及旧主题的直接链接。

## How to get to it (user POV)

分发入口是 `skills/storyweave-imagegen/assets/reference-library/index.html`。本地文字和筛选可离线使用，来源图片需要联网。每种风格显示实际页型覆盖；同一张图具有多个职责也只计一张。

通过 `python3 scripts/cache-presentation-references.py --cache <directory>` 准备原图缓存，再运行 `node scripts/build-presentation-reference-gallery.mjs --cache <directory> --out <offline-directory>` 导出私有离线页面。图片内嵌在导出的 HTML，来源链接仍指向原作者页面。离线产物保存在分发包之外。

## Driving it with verify-storyweave

先完成 doctor 与 launch，准备 Python 3、Pillow、只读原图缓存和可打开本地 HTML 的浏览器环境：

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive reference-gallery --run-id "$VERIFY_RUN_ID" --reference-cache <absolute-cache-directory>
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

helper 先检查分发产物，在隔离目录安装 Imagegen，运行缓存 `--check`、离线 build/check 和逐图字节审计。它不下载图片；输入缓存前后哈希必须一致。`image-integrity.json` 保存实际图片数、尺寸、解码结果、角色统计、分发文件与安装哈希。预期数量来自当前 catalog，扩充图库时不需修改常量。

真实浏览器使用 `1280×720` 与 `390×844`，新上下文断网打开离线产物，逐张通过 summary 展开。每张图保存 naturalWidth、naturalHeight、加载状态、边界和截图。筛选通过 `[data-filter]`、`[data-role]` 与 `搜索主题` 操作，核对数量、实际显示页、自动展开页和无结果状态；重置后恢复全图库。

点击 `.image-open` 打开 `参考图大图`，分别使用 `[data-close]` 与 Escape 关闭。另以联网版生产页面拦截外部图片边界，第一次请求失败，重试返回已校验原图，核对 error → ready 与实际第二次请求。该路径没有实时访问外部图片服务器。

查看 summary、commands、actions、trace、双视口逐图截图、`image-boundary.json` 和 `offline-viewer/`。cleanup 后重新 report，核对全部证据哈希且工作目录消失。

## Gotchas

- 浏览器策略阻止本地页面时，在 launch 记录 blocked 与具体原因，功能返回 not-run/退出码 4。字节审计通过不能替代浏览器显示通过。
- 缓存缺失、过期或损坏会阻止完成；helper 不修复输入缓存，不以少量成功图片降低验收数量。
- 参考目录可能有许可与连续性限制。校验来源字段和可解码图片，不等于授予许可、证明来源真实性或完成设计质量复核。
- 主题参考不自动变成生成器的可选配方；图库数量和实际生成主题数量分别统计。
- 原图内嵌会增大私有离线 HTML。分发包仅含 catalog、coverage 与远程引用 HTML；独立安装必须保留这一边界。
- 截图和自动几何检查不证明技术内容、中文字形或演讲节奏合格，仍需查看实际图片。

## 应用架构资料与浅色选择

新入口为 `design-library/application-architecture-references/index.html`；两个生成器各自携带对应子集的 `assets/application-architecture-references/index.html`。普通方框连线和 AI 白板示例归 HTML，连续插画与实体空间参考归 Imagegen。

CI 用 `scripts/cache-presentation-references.py --catalog design-library/application-architecture-references/catalog.json` 准备独立缓存，核对原图尺寸与已查看字节。随后运行：

```bash
npm run verify:architecture-references -- --cache <absolute-cache-directory> --out <fresh-evidence-directory>
```

独立浏览器在 `1440×900` 与 `390×844` 逐图解码并核对显示、放大、HTML/Imagegen 筛选及搜索空状态，另检查主题页浅色默认、深色显式选择和直接链接。结束后复核离线产物和输入缓存，清理内嵌原图 HTML，保留 summary、actions、截图和 trace。浏览器失败阻断；不代填新画面的审美结论。

当前环境若已明确禁止本地 HTML 浏览，仍按 Skill 的 Launch 规则保留限制，不直接运行这个浏览器入口绕过；交由独立 GitHub Actions 验证。
