# Imagegen 任务与图片交付

将确认内容编译为逐页任务，分别检查真实生成、图片复核与已有产物交付。

## Sub-features

- `image-jobs` 运行 draft、approve 与 prompts，核对任务和准确文字。
- `image-missing-gate` 实测 status 与 build 的 needs-images、退出码 3 和缺失页 ID。
- `image-generate` Agent 调用真实工具，按任务附图并保存调用记录。
- `image-collect` 通过 record-result 收集返回图片和证据，再逐页 review。
- `image-deliver` 对已有完整图片项目执行 build 与 qa。

## How to get to it (user POV)

通过 `skills/storyweave-imagegen/scripts/ppt.mjs` 创建并批准内容，prompts 写出 `imagegen-jobs.jsonl`。Agent 调用真实工具，将任务的 `tool_input.referenced_image_paths` 作为附件，保存日志和结果 receipt。执行 record-result，再查看图片并 review。全部通过后 build、qa 和 export。

## Driving it with verify-storyweave

完成 doctor 与 launch，保留 `VERIFY_RUN_ID`。缺少真实图片时只运行任务路径：

```bash
node .agents/skills/verify-storyweave/scripts/verify.mjs drive imagegen --run-id "$VERIFY_RUN_ID"
node .agents/skills/verify-storyweave/scripts/verify.mjs report --run-id "$VERIFY_RUN_ID"
```

<!-- Compilation alone did not prove that the product refused delivery with missing images. -->
项目证据保存批准内容、私有计划、任务与生成清单。helper 核对任务 ID、`visible_text` 与 `text_policy` 对应批准稿，再实际执行 status 与 build，要求 needs-images、退出码 3、缺失 ID 对应全部页，而且 index.html 与 storyweave-output.json 尚未生成。`missing-image-gate.json` 保存观察结果；此状态不记为完整图片功能通过。

已有真实生成并逐页复核的项目时，给 drive 增加 `--source-project <absolute-path>`，使用新的运行 ID。helper 将内容、图片、计划、捕获参考、调用证据和任务复制到自有项目，执行 build 与 qa，再核对输入文件未被修改。

## Gotchas

- helper 不调用图片服务，也不执行 record-result 或独立视觉复核。导入路径只证明已有产物。
- 导入路径不打开图片画廊，没有浏览器 trace。生成调用、实际附图与视觉质量需要另附真实证据。
- 当前没有 OCR，QA 不保证文字准确；必须查看真实图片，复核乱码、额外文字、裁切和主题。
- Review 绑定 PNG 字节，标记不代替查看图片，fixture 不代替真实生图。
- 各种 export 格式在此未执行，保持未验证，不能从 build 与 qa 扩大通过范围。
