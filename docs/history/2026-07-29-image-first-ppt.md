# Image-first PPT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current PPT Skill to an image-first workflow with a mandatory content-draft gate, eight prompt-based themes, 24 generated sample slides, and image-only preview/export behavior.

**Architecture:** Keep the current skill directory for compatibility, but make `outline_draft.json` and `deck_spec.json` the source models and full-slide PNG files the visual output. A focused image-first library validates drafts, compiles theme-aware prompts, creates generation manifests, and renders image-only HTML; legacy editable HTML remains migration reference only.

**Tech Stack:** Node.js ES modules, Node test runner, JSON schemas, `$imagegen` fallback CLI with `gpt-image-2`, Playwright for browser QA, static HTML.

---

### Task 1: Content Draft Gate and Prompt Compiler

**Files:**
- Create: `skills/presentation/create-editable-ppt/scripts/lib/image-first.mjs`
- Create: `skills/presentation/create-editable-ppt/assets/themes/image-themes.json`
- Create: `skills/presentation/create-editable-ppt/schemas/outline_draft.schema.json`
- Create: `skills/presentation/create-editable-ppt/schemas/generation_manifest.schema.json`
- Create: `skills/presentation/create-editable-ppt/tests/image-first.test.mjs`

- [ ] **Step 1: Write the failing tests**

Test that `validateOutlineDraft()` rejects a draft without `central_message` or `narrative`, that `approveOutlineDraft()` produces a `deck_spec.json`-compatible model, and that `compileDeckPrompts()` emits one `productivity-visual` prompt per slide with exact text, 16:9 constraints, theme recipe, no-watermark rule, and deterministic output names.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/image-first.test.mjs`

Expected: FAIL because `scripts/lib/image-first.mjs` does not exist.

- [ ] **Step 3: Implement the minimal content and prompt APIs**

Export these functions:

```js
export function validateOutlineDraft(draft) {}
export function approveOutlineDraft(draft, themeId) {}
export function compileSlidePrompt(slide, theme, options = {}) {}
export function compileDeckPrompts(deck, themes, options = {}) {}
export function createGenerationManifest(deck, jobs, options = {}) {}
export function renderOutlinePreview(draft) {}
export function renderImageDeck(deck, manifest) {}
```

Use `2048x1152`, `medium`, and `gpt-image-2` defaults. Make every theme recipe define art direction, composition grammar, palette, typography mood, imagery, materials, anchors, and avoid rules.

- [ ] **Step 4: Run the focused and existing tests**

Run: `node --test tests/image-first.test.mjs tests/model.test.mjs tests/render.test.mjs`

Expected: all pass.

### Task 2: Image-first CLI and Skill Contract

**Files:**
- Modify: `skills/presentation/create-editable-ppt/scripts/ppt.mjs`
- Modify: `skills/presentation/create-editable-ppt/tests/cli.test.mjs`
- Modify: `skills/presentation/create-editable-ppt/SKILL.md`
- Modify: `skills/presentation/create-editable-ppt/agents/openai.yaml`
- Modify: `skills/presentation/create-editable-ppt/references/workflow.md`
- Modify: `skills/presentation/create-editable-ppt/references/architecture.md`
- Modify: `skills/presentation/create-editable-ppt/references/themes.md`
- Modify: `skills/presentation/create-editable-ppt/references/assets.md`
- Modify: `skills/presentation/create-editable-ppt/references/qa-export.md`

- [ ] **Step 1: Replace CLI expectations with failing image-first tests**

Require the command surface `draft`, `approve`, `prompts`, `render`, `qa`, `export`, and `doctor`. Assert that `draft` creates `outline_draft.json` plus `outline_preview.html`; `approve` creates `deck_spec.json`; `prompts` creates `generation_manifest.json`; and `render` refuses missing slide images.

- [ ] **Step 2: Run CLI tests and verify RED**

Run: `node --test tests/cli.test.mjs`

Expected: FAIL because the image-first commands are absent.

- [ ] **Step 3: Implement the CLI and rewrite the Skill contract**

Make the default path content draft -> approval -> prompt compilation -> `$imagegen` -> image review -> image-only export. Remove visible editable text from documented behavior. Keep key detection redacted and support standard `OPENAI_API_KEY`, primary `OPENAI_SUB_*`, and fallback `OPENAI_SUB_FALLBAK_*` configuration.

- [ ] **Step 4: Verify CLI and contract**

Run: `node --test tests/cli.test.mjs tests/image-first.test.mjs`

Expected: all pass.

### Task 3: Build the 24-job Theme Sample

**Files:**
- Create: `skills/presentation/create-editable-ppt/scripts/build-image-showcase.mjs`
- Create: `skills/presentation/create-editable-ppt/tests/image-showcase.test.mjs`
- Create: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/outline_draft.json`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/generation_manifest.json`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/slides/*.png`

- [ ] **Step 1: Write and run a failing showcase test**

Require eight themes, three roles per theme (`cover`, `process`, `closing`), 24 unique prompt jobs, exact shared content, semantic filenames, and no embedded secrets.

Run: `node --test tests/image-showcase.test.mjs`

Expected: FAIL because the builder does not exist.

- [ ] **Step 2: Implement the showcase builder**

Generate the approved content draft, `deck_spec.json`, generation manifest, CLI JSONL input, and an image-only gallery shell. Do not create editable slide markup.

- [ ] **Step 3: Run a dry-run and inspect prompts**

Run: `node scripts/build-image-showcase.mjs assets/examples/image-theme-showcase --prepare`

Expected: 24 jobs, all `2048x1152`, `medium`, `gpt-image-2`, and no missing exact-text fields.

- [ ] **Step 4: Generate images with the confirmed CLI fallback**

Run the bundled `$imagegen` `generate-batch` command through the local `imagegen-cli` configuration wrapper. Use the primary redacted configuration first and the configured fallback only after a failed or timed-out primary request.

- [ ] **Step 5: Record generation results**

Update only status, output path, model, quality, dimensions, attempt count, and error summary in `generation_manifest.json`; never persist keys, bearer tokens, base URLs, or signed URLs.

### Task 4: Gallery and Visual QA

**Files:**
- Create: `skills/presentation/create-editable-ppt/scripts/verify-image-showcase.mjs`
- Modify: `skills/presentation/create-editable-ppt/tests/image-showcase.test.mjs`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/index.html`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/gallery-desktop.png`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/gallery-mobile.png`
- Generate: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/qa_report.json`

- [ ] **Step 1: Add failing gallery assertions**

Assert 24 image cards, eight theme groups, three role filters, no `contenteditable`, no broken image paths, and no horizontal overflow at 1440px or 390px.

- [ ] **Step 2: Render and verify the browser gallery**

Use Playwright to capture desktop and mobile screenshots and record broken-image, overflow, missing-title, and card-count findings.

- [ ] **Step 3: Inspect every generated slide**

Check exact Chinese text, absence of unexpected words/watermarks, 16:9 dimensions, theme fit, composition, contrast, cropping, and cross-slide consistency. Re-run only failed pages with a targeted prompt adjustment.

- [ ] **Step 4: Re-run visual verification**

Run: `node scripts/verify-image-showcase.mjs assets/examples/image-theme-showcase`

Expected: 24 cards, zero broken images, zero overflow, and all slides marked pass.

### Task 5: Full Verification, Commit, and Push

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-image-first-ppt.md`

- [ ] **Step 1: Validate the Skill and run all tests**

Run: `node --test tests/*.test.mjs`

Run: `python3 /Users/swimmingliu/data/研究生/学校各类事务/毕业论文/.claude/skills/.system/skill-creator/scripts/quick_validate.py skills/presentation/create-editable-ppt`

Expected: all tests pass and `Skill is valid!`.

- [ ] **Step 2: Scan for secrets and stale editable-first language**

Run targeted searches for `OPENAI_*KEY` values, bearer tokens, signed URLs, `contenteditable`, `browser-editable`, and `editable text`. Permit variable names and migration notes only; reject secret values or default editable-first instructions.

- [ ] **Step 3: Commit only scoped files**

Stage the PPT Skill, image-first sample assets, and this plan. Leave unrelated README changes, deleted subagent skills, `.DS_Store` files, and other user files untouched.

- [ ] **Step 4: Push the feature branch**

Push `codex/image-first-ppt` to the configured remote and report the branch and preview URL.
