# Bento Native PPT Skill Implementation Plan

> Superseded by the three-skill implementation: `storyweave-html` and `storyweave-imagegen` are independent producers; `storyweave-express` is the optional Bento adapter. Keep this file as historical context only. Do not use its old paths, combined mode contract, or producer-owned Bento architecture for new work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old eight-theme presentation runtime with two independent `ai-image` and `html` workflows that both author real, editable `bento/slides` documents.

**Architecture:** An approved outline feeds a mode-specific composer, then a shared Bento document builder replaces only the plaintext `#bento-doc` block in a validated shell. Source-theme inventories retain every upstream theme and map them to deduplicated, original recipes; image generation remains isolated to `ai-image`, while `html` emits native Bento elements.

**Tech Stack:** Node.js 20 ESM, JSON Schema, Node test runner, Playwright, PptxGenJS, Bento v1 document JSON, `imagegen` for image mode.

---

### Task 1: Lock the new contract with failing tests

**Files:**
- Modify: `skills/presentation/create-editable-ppt/tests/skill-contract.test.mjs`
- Create: `skills/presentation/create-editable-ppt/tests/theme-inventory.test.mjs`
- Create: `skills/presentation/create-editable-ppt/tests/bento-document.test.mjs`

- [ ] **Step 1: Replace the old mode contract test**

Assert that `SKILL.md` names only `ai-image` and `html`, requires `#bento-doc`, and does not expose the eight retired IDs or `image-ppt-doc`.

```js
test('skill exposes only Bento-native ai-image and html modes', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /ai-image/);
  assert.match(skill, /`html`/);
  assert.match(skill, /#bento-doc/);
  assert.doesNotMatch(skill, /image-first|pure-html|image-ppt-doc|business-minimal|premium-dark/);
});
```

- [ ] **Step 2: Add inventory and Bento format tests**

```js
test('every source theme maps to one canonical recipe in the same mode', async () => {
  const catalog = await loadThemeCatalog();
  for (const mode of ['ai-image', 'html']) {
    const inventory = await loadThemeInventory(mode);
    const aliases = new Map(catalog[mode].flatMap(theme => theme.aliases.map(alias => [alias, theme.id])));
    assert.equal(aliases.size, inventory.themes.length);
    for (const source of inventory.themes) assert.ok(aliases.has(source.key), source.key);
  }
});

test('Bento block escaping prevents literal script termination', () => {
  const html = spliceBentoDocument(shell, { ...minimalDoc(), title: '</script><p>bad</p>' });
  assert.doesNotMatch(extractBentoBlock(html), /<\/script>/i);
  assert.equal(parseBentoDocument(html).title, '</script><p>bad</p>');
});
```

- [ ] **Step 3: Run the focused tests and record RED**

Run:

```bash
cd skills/presentation/create-editable-ppt/scripts
npm test -- ../tests/skill-contract.test.mjs ../tests/theme-inventory.test.mjs ../tests/bento-document.test.mjs
```

Expected: FAIL because inventories and Bento document APIs do not exist and the old mode names remain.

### Task 2: Add complete source-theme inventories

**Files:**
- Create: `skills/presentation/create-editable-ppt/references/image-theme-inventory.json`
- Create: `skills/presentation/create-editable-ppt/references/html-theme-inventory.json`
- Create: `skills/presentation/create-editable-ppt/schemas/theme_inventory.schema.json`
- Create: `skills/presentation/create-editable-ppt/scripts/lib/theme-catalog.mjs`

- [ ] **Step 1: Define the inventory schema**

Require `snapshot_date`, repositories with fixed `commit`, and themes with stable `key`, `source_id`, `name`, `traits`, `best_for`, `evidence_url`.

```json
{
  "required": ["schema_version", "mode", "snapshot_date", "repositories", "themes"],
  "properties": {
    "mode": { "enum": ["ai-image", "html"] },
    "themes": {
      "type": "array",
      "items": {
        "required": ["key", "repository", "source_id", "name", "traits", "evidence_url"]
      }
    }
  }
}
```

- [ ] **Step 2: Populate the image inventory**

Include all named themes and template records from the six requested repositories. Preserve JuneYaooo's complete source IDs, including its initial, distilled, and Xiamu Lingzi collections, rather than collapsing them in the inventory.

- [ ] **Step 3: Populate the HTML inventory**

Include the 12 frontend presets, 34 beautiful templates, 4 visual-explainer presets, open-codesign deck families, 36 html-ppt themes plus 15 full-deck families, 5 open-slide themes, 12 Dashi themes, and baoyu-design's explicit style directions. Record Bento as an output/editor dependency, not a theme source.

- [ ] **Step 4: Implement inventory loading and duplicate checks**

```js
export async function loadThemeInventory(mode, root = skillRoot) {
  const file = mode === 'ai-image' ? 'image-theme-inventory.json' : 'html-theme-inventory.json';
  const data = JSON.parse(await readFile(join(root, 'references', file), 'utf8'));
  const keys = data.themes.map(theme => theme.key);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate ${mode} source theme key`);
  return data;
}
```

- [ ] **Step 5: Run inventory tests**

Expected: inventory schema and unique-key tests pass; alias coverage remains RED until Task 3.

### Task 3: Build deduplicated mode-specific theme recipes

**Files:**
- Replace: `skills/presentation/create-editable-ppt/assets/themes/image-themes.json`
- Delete: `skills/presentation/create-editable-ppt/assets/themes/themes.json`
- Create: `skills/presentation/create-editable-ppt/assets/themes/theme-catalog.json`
- Create: `skills/presentation/create-editable-ppt/schemas/theme_catalog.schema.json`
- Modify: `skills/presentation/create-editable-ppt/scripts/lib/theme-catalog.mjs`
- Test: `skills/presentation/create-editable-ppt/tests/theme-inventory.test.mjs`

- [ ] **Step 1: Add canonical recipes and aliases**

Each recipe must carry mode-specific instructions rather than only palette tokens.

```json
{
  "id": "editorial-ink",
  "mode": "ai-image",
  "aliases": ["guizang:theme-paper", "codex:electronic-ink", "gpt-image2:editorial-mono"],
  "palette": ["paper", "ink", "one restrained accent"],
  "typography": "serif display, sans body, mono metadata",
  "composition": "asymmetric editorial spread with controlled image crop",
  "image_prompt_recipe": { "materials": ["paper grain", "ink flow"], "forbid": ["UI cards", "neon"] }
}
```

- [ ] **Step 2: Enforce same-mode, exactly-once coverage**

`validateThemeCatalog()` must reject missing aliases, duplicate aliases, unknown aliases, cross-mode aliases, recipes with identical visual fingerprints, and retired IDs.

- [ ] **Step 3: Run catalog tests and verify GREEN**

Run the focused theme tests. Expected: all source entries are mapped exactly once, no old eight-theme IDs remain, and every recipe has provenance.

### Task 4: Implement the Bento shell and document boundary

**Files:**
- Create: `skills/presentation/create-editable-ppt/assets/bento/Bento_Slides.bento.html`
- Create: `skills/presentation/create-editable-ppt/assets/bento/SOURCE.json`
- Create: `skills/presentation/create-editable-ppt/scripts/lib/bento-document.mjs`
- Replace: `skills/presentation/create-editable-ppt/schemas/image_ppt_doc.schema.json` with `schemas/bento_slides.schema.json`
- Test: `skills/presentation/create-editable-ppt/tests/bento-document.test.mjs`

- [ ] **Step 1: Vendor a pinned, MIT Bento shell**

Use the release corresponding to the audited Bento commit or build it from that commit. Record repository, commit, version, SHA-256, license and retrieval date in `SOURCE.json`. Confirm it contains one plaintext `id="bento-doc"` block.

- [ ] **Step 2: Implement parse and splice APIs**

```js
const BENTO_BLOCK = /(<script\b[^>]*\btype=["']application\/bento\+json["'][^>]*\bid=["']bento-doc["'][^>]*>)([\s\S]*?)(<\/script>)/gi;

export function extractBentoBlock(html) {
  const matches = [...html.matchAll(BENTO_BLOCK)];
  if (matches.length !== 1) throw new Error(`Expected one #bento-doc block, found ${matches.length}`);
  return matches[0][2];
}
export function parseBentoDocument(html) { return JSON.parse(extractBentoBlock(html)); }
export function spliceBentoDocument(shell, doc) {
  const matches = [...shell.matchAll(BENTO_BLOCK)];
  if (matches.length !== 1) throw new Error(`Expected one #bento-doc block, found ${matches.length}`);
  const body = JSON.stringify(doc).replaceAll('<', '\\u003c');
  return shell.slice(0, matches[0].index) + matches[0][1] + body + matches[0][3] + shell.slice(matches[0].index + matches[0][0].length);
}
```

Reject zero or multiple blocks, a non-`bento/slides` document, literal `</script>` in the body, missing size/theme/slides, and changed `docId` during edit.

- [ ] **Step 3: Implement minimal document construction**

Fresh documents omit `docId`; existing documents preserve it. All slides receive stable IDs, notes, background, transition and elements.

- [ ] **Step 4: Run Bento tests and shell conformance checks**

Expected: round-trip preserves unknown fields, hostile text parses safely, and the shell outside `#bento-doc` is byte-identical.

### Task 5: Rewrite outline approval and mode pipelines

**Files:**
- Replace: `skills/presentation/create-editable-ppt/scripts/lib/image-first.mjs` with `scripts/lib/outline.mjs`
- Delete: `skills/presentation/create-editable-ppt/scripts/lib/pure-html.mjs`
- Create: `skills/presentation/create-editable-ppt/scripts/lib/ai-image.mjs`
- Create: `skills/presentation/create-editable-ppt/scripts/lib/html-composer.mjs`
- Modify: `skills/presentation/create-editable-ppt/schemas/outline_draft.schema.json`
- Modify: `skills/presentation/create-editable-ppt/schemas/deck_spec.schema.json`
- Test: `skills/presentation/create-editable-ppt/tests/outline.test.mjs`
- Test: `skills/presentation/create-editable-ppt/tests/ai-image.test.mjs`
- Test: `skills/presentation/create-editable-ppt/tests/html-composer.test.mjs`

- [ ] **Step 1: Write failing mode-boundary tests**

```js
assert.deepEqual(compileImageJobs(htmlDeck, catalog), []);
assert.throws(() => composeHtmlDeck(imageDeck, catalog), /html mode required/);
assert.equal(approveOutline(draft, { mode: 'ai-image' }).status, 'approved');
```

- [ ] **Step 2: Move draft validation into `outline.mjs`**

Require central message, five-part narrative, expected page count, and per-page claim, exact text, evidence, visual brief and transition. Approval must fail for unresolved blocking evidence.

- [ ] **Step 3: Implement AI image jobs**

Each job includes exact visible text, canonical theme recipe, page role, visual brief, content safety constraints, continuity anchors, model/size/quality and deterministic output path.

- [ ] **Step 4: Implement native Bento HTML composition**

Map cover/section/statement/process/comparison/data/quote/closing to Bento text, shape, svg, table or chart elements. Use stable semantic IDs and Morph only when an element meaning continues across pages. Do not emit image jobs or raster page backgrounds.

- [ ] **Step 5: Verify focused RED-GREEN cycles**

Run each new test before and after its implementation; record that the expected missing API or wrong-mode failure occurred before GREEN.

### Task 6: Rewrite the CLI around Bento output

**Files:**
- Replace: `skills/presentation/create-editable-ppt/scripts/ppt.mjs`
- Delete: `skills/presentation/create-editable-ppt/scripts/lib/bundle.mjs`
- Delete: `skills/presentation/create-editable-ppt/scripts/lib/render.mjs`
- Modify: `skills/presentation/create-editable-ppt/tests/cli.test.mjs`

- [ ] **Step 1: Define the new CLI surface**

```text
draft <dir> --title <text>
themes --mode ai-image|html [--json]
approve <dir> --mode ai-image|html --theme <id>
prompts <dir> [--model ... --size ... --quality ...]
build <dir> [--bento-shell path] [--out path]
qa <dir> --json
export <dir> --format png|pdf|pptx
doctor --json
```

- [ ] **Step 2: Add failing end-to-end CLI tests**

Assert HTML mode writes zero jobs and native elements; image mode blocks build until all PNGs pass; both produce `.bento.html` with `format:"bento/slides"`; unknown theme/mode and unapproved draft fail.

- [ ] **Step 3: Implement commands with small library calls**

Keep argument parsing in `ppt.mjs`; all document, theme, outline and mode behavior stays in focused modules. `build` copies the shell then splices only the Bento block.

- [ ] **Step 4: Run CLI tests**

Expected: no `image-first`, `pure-html`, `bundle`, `image-ppt-doc` or old theme IDs appear in help or output.

### Task 7: Rebuild QA and derived exports

**Files:**
- Replace: `skills/presentation/create-editable-ppt/scripts/lib/qa.mjs`
- Modify: `skills/presentation/create-editable-ppt/scripts/lib/export.mjs`
- Modify: `skills/presentation/create-editable-ppt/scripts/lib/browser-qa.mjs`
- Modify: `skills/presentation/create-editable-ppt/schemas/qa_report.schema.json`
- Test: `skills/presentation/create-editable-ppt/tests/browser-qa.test.mjs`
- Test: `skills/presentation/create-editable-ppt/tests/export.test.mjs`

- [ ] **Step 1: Add differentiated QA tests**

Check evidence and units for data pages, aligned dimensions for comparisons, sequence for processes, exact text/crop for image pages, element bounds/overlap/editability for HTML pages, asset references and docId preservation for the final file.

- [ ] **Step 2: Render the real Bento document in Playwright**

Open the `.bento.html`, wait for the Bento runtime, verify slide count, editor availability, navigation, no console errors, no blank page, and desktop/mobile framing. Capture screenshots as QA evidence.

- [ ] **Step 3: Implement exports from the Bento master**

PNG and PDF use browser rendering. PPTX places each rendered page as a full-slide image and writes notes; the export report states `object_editability: false` and points back to the Bento master.

- [ ] **Step 4: Run export and browser tests**

Expected: all formats match page count; no exporter claims editable PowerPoint objects.

### Task 8: Rewrite the Skill and progressive references

**Files:**
- Replace: `skills/presentation/create-editable-ppt/SKILL.md`
- Modify: `skills/presentation/create-editable-ppt/agents/openai.yaml`
- Replace: `skills/presentation/create-editable-ppt/references/architecture.md`
- Replace: `skills/presentation/create-editable-ppt/references/workflow.md`
- Replace: `skills/presentation/create-editable-ppt/references/themes.md`
- Replace: `skills/presentation/create-editable-ppt/references/assets.md`
- Replace: `skills/presentation/create-editable-ppt/references/qa-export.md`
- Modify: `skills/presentation/create-editable-ppt/tests/skill-contract.test.mjs`

- [ ] **Step 1: Keep `SKILL.md` concise and imperative**

Document the outline approval gate, two mutually exclusive modes, theme picker, imagegen configuration reminder, Bento master, selective regeneration, QA and export boundaries. Route detailed inventories and schemas to references.

- [ ] **Step 2: Regenerate agent metadata**

Set display name and prompt to Bento-native PPT generation; remove `HTML-assisted`, `image-first` and `pure-html` language.

- [ ] **Step 3: Run Skill validation**

```bash
rtk python3 /Users/swimmingliu/data/研究生/学校各类事务/毕业论文/.claude/skills/.system/skill-creator/scripts/quick_validate.py skills/presentation/create-editable-ppt
```

Expected: `Skill is valid!`.

### Task 9: Replace old examples with Bento theme showcases

**Files:**
- Delete: `skills/presentation/create-editable-ppt/assets/examples/image-theme-showcase/`
- Delete: `skills/presentation/create-editable-ppt/assets/examples/theme-showcase/`
- Delete: `skills/presentation/create-editable-ppt/assets/examples/pure-html-demo/`
- Delete: `skills/presentation/create-editable-ppt/assets/examples/nimbus/`
- Create: `skills/presentation/create-editable-ppt/assets/examples/bento-image-theme-showcase/`
- Create: `skills/presentation/create-editable-ppt/assets/examples/bento-html-theme-showcase/`
- Create: `skills/presentation/create-editable-ppt/scripts/build-bento-showcases.mjs`
- Test: `skills/presentation/create-editable-ppt/tests/showcase.test.mjs`

- [ ] **Step 1: Generate one common approved narrative**

Use the same central message and exact text for all themes so visual comparisons are meaningful. The HTML showcase uses native Bento elements only.

- [ ] **Step 2: Generate AI-image previews with `imagegen`**

Read the imagegen skill first, verify only that local variables are set, generate one page per canonical image theme, and record prompt/model/status without secrets. Failed pages remain failed; no placeholder may be marked as generated.

- [ ] **Step 3: Build both `.bento.html` showcases**

Each canonical theme receives a page, notes, provenance metadata and a matching catalog entry. The image deck embeds generated PNGs; the HTML deck contains no generated image assets.

- [ ] **Step 4: Browser-review both showcases**

Check every page at desktop and mobile viewports; use pixel checks to reject blank pages and screenshots to review framing, readable text and overlap.

### Task 10: Remove obsolete implementation and complete verification

**Files:**
- Delete obsolete schemas, scripts, tests and generated artifacts that reference old modes or old theme IDs.
- Modify only presentation files and the new design/plan docs; preserve unrelated worktree changes.

- [ ] **Step 1: Search for retired contracts**

```bash
rtk rg -n "image-first|pure-html|image-ppt-doc|business-minimal|launch-tech|data-consulting|brand-bold|premium-dark" skills/presentation/create-editable-ppt
```

Expected: no runtime contract or canonical recipe matches. An inventory entry may retain an upstream source ID only when the provenance record requires its exact original name.

- [ ] **Step 2: Run the full test suite**

```bash
cd skills/presentation/create-editable-ppt/scripts
rtk npm test
```

Expected: zero failures.

- [ ] **Step 3: Run fresh validation and browser checks**

Validate the Skill, both inventories, both Bento documents, page counts, asset references and screenshots. Reopen the final files from `file://` and make one reversible edit through the Bento editor.

- [ ] **Step 4: Forward-test the Skill**

Give a fresh worker the Skill path and a realistic request without describing the expected implementation. Verify it creates the outline gate, chooses one mode, uses a catalog theme, and produces a real Bento document rather than a custom viewer.

- [ ] **Step 5: Commit and push scoped changes**

Stage only the rebuilt presentation Skill and the two superpowers docs. Review `git diff --cached`, commit with a scoped message, push `codex/image-first-ppt`, and leave unrelated worktree changes untouched.
