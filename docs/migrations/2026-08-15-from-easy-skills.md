# 从 easy-skills 迁移 StoryWeave

迁移日期：2026-08-15。

## 路径映射

| 原路径（easy-skills） | 新路径（StoryWeave） |
|---|---|
| `skills/presentation/storyweave-html/` | `skills/storyweave-html/` |
| `skills/presentation/storyweave-imagegen/` | `skills/storyweave-imagegen/` |
| `skills/presentation/storyweave-express/` | `skills/storyweave-express/` |
| `docs/ppt-skill-implementation-audit.md` | `docs/implementation-audit.md` |
| `docs/ppt-skill-design.html`、`.pdf` | `docs/history/ppt-skill-design.*` |
| `docs/superpowers/plans/`、`docs/superpowers/specs/` 中的 PPT 历史方案 | `docs/history/` |
| `docs/ppt-skill-landscape.md`、`research/bento-source-findings.md`、`research/wuming-vs-storyweave.md` | `docs/research/` |
| `artifacts/open-kimi-ppt-skill/` | `docs/research/vendor/open-kimi-ppt-skill/` |
| `artifacts/ai-customer-service-architecture/` | `examples/ai-customer-service-architecture/` |
| `artifacts/storyweave-wuming-theme-comparison-20260815/` | `examples/wuming-theme-comparison-20260815/` |
| `artifacts/AI_full_chain_delivery_annual_review.*` | `examples/ai-full-chain-delivery-annual-review/` |
| `artifacts/storyweave/*.skill` | `dist/skills/` |

迁移检查发现原 `.skill` 包仍包含拆分前的文件。旧包已转存到 `dist/legacy/pre-migration/`；`dist/skills/` 已按当前源码重新生成 HTML、Imagegen、Express 三个包。

## 运行时安装

`~/.agents/skills/storyweave-*` 是已安装的运行时副本，不属于 `easy-skills` 源码。迁移时保留这些副本，防止当前会话中的 Skill 失效；后续使用本仓库各 Skill 的 `install.mjs --force` 更新。

## 回滚

迁移使用同一磁盘上的文件移动，没有删除内容。需要回滚时，按上表反向移动即可。两个仓库均未自动提交。
