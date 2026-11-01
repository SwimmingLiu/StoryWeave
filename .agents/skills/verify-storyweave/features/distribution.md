# 独立 Skill 安装与运行

将四个 Skill 分别安装到独立根目录，使用安装包自己的应用代码与资源完成 HTML 和 Bento 路径。

## Sub-features

- `package-integrity` 核对源码生成的包清单与实际字节。
- `package-install` 将 HTML、Imagegen、Express 与全局 Skill 安装到独立根目录。
- `installed-doctor` 使用各安装包自己的公开入口执行 doctor。
- `installed-production` 执行已安装 HTML 的生产链和内置 Bento 的全局工作流。

## How to get to it (user POV)

从仓库运行 `node skills/<skill>/install.mjs --dir <root>`。在安装后的 Skill 中安装所需第三方依赖，再运行 `scripts/ppt.mjs` 或全局 `scripts/orchestrate.mjs`。全局包装已有生产者项目时，自带 Bento，不要求相邻 Express。

开发阶段用 `npm run package:skills` 生成运行副本，`npm run check:packages` 校验一致性。修改权威源码后重新打包，不直接修改 runtime。

## Driving it with verify-storyweave

先完成 doctor 与 launch，保留 `VERIFY_RUN_ID`。HTML 的 Playwright 与 Chromium 必须已可用。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive distribution --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

helper 使用四个独立安装根目录，分别执行 doctor，核对 `runtime/source-manifest.json` 的文件字节，确认包中没有原始案例库。各包按入口依赖保存运行模块；两个适配包各自携带压缩 Bento，不依赖相邻安装。证据保存各包 source manifest。

<!-- Reference assets are outside the runtime manifest, so installed bytes require their own check. -->
Imagegen 的 `assets/reference-library/` 另核对三份文件的名称、安装前后哈希和总字节，要求没有原图文件及 `data:image/` 内嵌内容。结果保存在 `installed-reference-assets.json`，图库交互由 [reference-gallery](reference-gallery.md) 覆盖。

<!-- The old drive ran only doctors for installed Imagegen and Express, leaving their business resources untested. -->
已安装 HTML 执行 draft、approve、build 与浏览器 QA；已安装 Imagegen 执行 draft、approve、prompts、status 和缺图 build；已安装 Express 执行 build 与 qa；独立全局包使用自带 Bento 包装 HTML 项目。查看 commands 中的实际安装路径，以及页面、QA、任务、Bento 和浏览器证据。

`summary.json.dependency_setup` 记录通过 `NODE_PATH` 使用的预装第三方 Playwright。应用模块、主题与 shell 来自安装包，第三方依赖来自明确记录的环境。

## Gotchas

- 本路径没有重新安装 Playwright，不能声称验证了全新依赖安装或无网络安装。
- Imagegen 安装路径只证明编译与缺图门，未调用图片服务、收集结果或独立复核；Express 证明 build 与 qa，编辑器交互仍未覆盖。
- 四包使用独立安装根目录，不能让全局包从同一目录中的 Express 获得隐式帮助。
- 安装器的 `--force` 保留旧版备份，本路径的空目录安装不覆盖该更新行为。
- 清理只删除本次安装与工作目录，证据和输入生产者项目继续保留。
