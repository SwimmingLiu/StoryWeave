# HTML 播放与缩放

在画廊中用按钮和键盘切页，检查焦点、首尾循环与独立页面缩放。

## Sub-features

- `play-buttons` 检查前后页按钮、活动 ID 与首尾循环。
- `play-keys` 检查前后翻页键、空格、Home 与 End。
- `play-focus` 在导航按钮保留焦点时按空格，只前进一页。
- `play-standalone` 在桌面与移动视口独立打开单页。
- `play-diagrams` 在流程及关系图页离开、返回和缩放，检查实际连线仍连接已批准节点。

## How to get to it (user POV)

打开 `index.html`，使用“上一页”“下一页”。ArrowRight、PageDown 和空格前进，ArrowLeft 与 PageUp 后退，Home 与 End 到达首尾。`slides/*.html` 提供没有导航的独立页。

## Driving it with verify-storyweave

完成 doctor 与 launch，保留 `VERIFY_RUN_ID`，只操作本次 helper 创建的项目。

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive html-playback --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

观察 `[data-storyweave-slide].active` 的 `data-slide-id`。按按钮、方向键、PageDown、PageUp、空格、End、首尾循环与 Home 的实际顺序核对状态。空格前导航按钮仍持有焦点，从 s01 前进到 s02，不能触发两次。

<!-- The old action loop neither recorded focus nor exercised the mobile gallery. -->
`actions.json` 在断言前记录动作、视口、焦点、预期和实际 ID，保留 `button-next-desktop.png`、`key-space-mobile.png`、`key-end-desktop.png` 与 trace。两种视口各自从已知首页执行相同动作。空格前断言“上一页”按钮仍持有焦点。

单个动作或状态断言失败后保留失败截图，重新 doctor，再重新打开画廊并以公开键盘恢复已知页面，继续可达路径。无法恢复时结束失败驱动。差异进入 `summary.json.findings`，整条功能仍为 fail。

独立页使用 `1280×720` 与 `390×844`，检查主题、内容、单页身份与无导航按钮，保留逐页截图和缩略图。

<!-- The previous resize occurred on a text closing page and could not prove dynamic arrow geometry. -->
图解路径通过 Home 和 ArrowRight 进入有批准边的流程页与关系图页，ArrowRight 离开、ArrowLeft 返回，再在该页直接执行 `1280×720 → 390×844 → 1280×720`。`diagram-<id>-enter.png`、`-return.png`、`-mobile.png`、`-desktop-restored.png` 和 actions 记录每步状态。已显示边须与批准边一致，路径长度大于零，两端到真实节点或方形锚点边界的距离为 4–20 个舞台单位。截图与状态在断言前保存；失败后结束该驱动、doctor 并清理。

## Gotchas

- 两视口通过鼠标点击和键盘驱动；未模拟触摸或滚轮，不能声称覆盖手势。
- 不得设置 active class 或内部页码代替用户翻页。
- 旧基线的焦点下空格双触发已修复，仍保留原动作作为回归条件，不移走焦点使其通过。
- 没有滚动条不足以证明内容完整，需核对文字、边界与截图。
- 截图前等待字体和有限动效稳定，避免把过渡状态当成缺字。
- 竖屏按原要求缩放固定 16:9 舞台，用于整页预览；本检查不声称正文在小屏上可直接阅读。
- v2、v3 播放由 html-authoring 的 `--compatibility` 选项驱动，默认 v4 播放通过不扩大为旧版兼容通过。
