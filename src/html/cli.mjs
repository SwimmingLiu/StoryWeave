#!/usr/bin/env node
import { access, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashBytes as bytesHash } from '../core/hash.mjs';

import { approveOutline, createOutline, migrateOutline, renderOutlinePreview, replanOutline, validateOutline } from './outline.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide, validateHtmlManifest } from './render.mjs';
import { openThemeCatalog, requireTheme, resolveTheme, sha256, THEMES, THEME_CONTRACT } from './themes.mjs';
import { writeJsonAtomic, writeTextAtomic } from '../core/storage.mjs';

import { approveContent, assertApprovedContent, validateContent, visibleText } from '../core/content.mjs';
import { createArtifactBinding, readVerifiedArtifact, validateOutputManifest } from '../core/artifact.mjs';
import { optionalDependency, resolveSkillRoot } from '../core/resources.mjs';
import { createHtmlPlan, assertCurrentHtmlPlan } from './plan.mjs';
import { inspectHtmlProject } from './qa.mjs';
import { selectReferences } from '../design-library/library.mjs';

const skillRoot = resolveSkillRoot('storyweave-html');
const HELP = `storyweave-html

Commands:
  draft <dir> [--title text] [--theme-ref architecture/style] [--schema 2|3|4]
  themes [--json]
  approve <dir> (--theme legacy-id | --theme-ref architecture/style)
  preview <dir> [--theme-ref architecture/style] [--count 3] [--out path]
  migrate <dir> [--theme-ref architecture/style]
  migrate-content <dir> --theme-ref architecture/style
  replan <dir> --theme-ref architecture/style [--library path --references selection.json]
  build <dir> [--out path]
  qa <dir> [--json]
  export <dir> --format html|png|pdf|pptx
  doctor [--json]

Produces standalone HTML slides with no external presentation runtime.
`;

function flag(args, name, fallback = undefined) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }
function hasFlag(args, name) { return args.includes(name); }
async function exists(path) { return access(path).then(() => true, () => false); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function safeSlug(value) { return String(value ?? 'presentation').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 80) || 'presentation'; }
async function optional(name) { return optionalDependency(name, 'storyweave-html'); }

function safeAssetPath(value) {
  const path = String(value ?? '').trim();
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes(':')) return null;
  return path;
}

async function loadAssets(root, deck) {
  const manifestPath = join(root, 'asset_manifest.json');
  const registry = await exists(manifestPath) ? await readJson(manifestPath) : { assets: [] };
  const assets = new Map((registry.assets ?? []).map((asset) => [asset.id, asset]));
  for (const slide of deck.slides ?? []) {
    for (const ref of slide.asset_refs ?? []) {
      const asset = assets.get(ref.asset_id) ?? ref;
      const path = safeAssetPath(asset.path ?? ref.path);
      if (!asset || !path) throw new Error(`Slide ${slide.id} references an invalid asset path for ${ref.asset_id ?? 'unknown'}.`);
      if (!(await exists(resolve(root, path)))) throw new Error(`Slide ${slide.id} references a missing asset: ${path}.`);
      if (!assets.has(ref.asset_id)) assets.set(ref.asset_id, { ...ref, path });
    }
  }
  return assets;
}

async function referencesFor(root, args, previous = []) {
  const path = flag(args, '--references');
  if (!path) return previous;
  const data = await readJson(resolve(path));
  const selections = Array.isArray(data) ? data : data.references;
  if (!Array.isArray(selections)) throw new Error('--references must point to an array or an object with a references array.');
  const library = flag(args, '--library');
  if (library) return selectReferences(resolve(library), selections, { projectRoot: root });
  for (const reference of selections) {
    if (!reference.path) continue;
    const safe = safeAssetPath(reference.path);
    if (!safe) throw new Error('Direct reference resources must be project-relative. Use --library to capture a case resource.');
    if (bytesHash(await readFile(resolve(root, safe))) !== reference.sha256) throw new Error(`Reference resource changed: ${safe}`);
  }
  return selections;
}

async function verifySelectedReferences(root, plan) {
  // QA can run after a reference edit without another build, so both boundaries verify the captured resource identity.
  for (const reference of plan.references) {
    if (!reference.path) continue;
    const path = safeAssetPath(reference.path);
    if (!path) throw new Error(`Selected reference must be project-relative: ${reference.case_id}/${reference.page_id}.`);
    if (bytesHash(await readFile(resolve(root, path))) !== reference.sha256) throw new Error(`Selected reference changed: ${reference.case_id}/${reference.page_id}. Replan before building.`);
  }
}

function assetReferences(draftOrPlan) {
  return Object.fromEntries((draftOrPlan?.slides ?? []).map((slide) => [slide.id, slide.asset_refs ?? []]));
}

async function createStructuredDraft(title, theme_ref, args) {
  const draft = await readJson(join(skillRoot, 'assets', 'content-v4.example.json'));
  return {
    ...draft, title, status: 'draft', schema_version: 4, theme_ref,
    reading_mode: flag(args, '--reading-mode', draft.reading_mode),
    language: flag(args, '--language', draft.language),
  };
}

function previewOutline(content) {
  if (content.schema_version !== 4) return renderOutlinePreview(content);
  return renderOutlinePreview({ ...content, slides: content.slides.map((slide) => ({ ...slide, exact_text: visibleText(slide), visual_brief: `内容类型 ${slide.content.type}` })) });
}

async function approveStructuredProject(root, draft, args) {
  const pending = (draft.migration?.unresolved ?? []).filter((item) => draft.slides.find((slide) => slide.id === item.slide_id)?.content.type === 'statement');
  if (pending.length && !hasFlag(args, '--accept-text-only')) throw new Error(`Complete structured relationships on ${pending.map((item) => item.slide_id).join(', ')} or explicitly approve with --accept-text-only.`);
  const content = approveContent(draft);
  const theme_ref = flag(args, '--theme-ref', draft.theme_ref ?? 'systems/ink-blue-grid');
  const plan = await createHtmlPlan(content, { theme_ref, catalog_scope: flag(args, '--catalog-scope', draft.catalog_scope ?? 'active'), references: await referencesFor(root, args), assetRefs: assetReferences(draft) });
  await mkdir(join(root, 'plans'), { recursive: true });
  await writeJsonAtomic(join(root, 'deck_spec.json'), content);
  await writeJsonAtomic(join(root, 'plans', 'html.json'), plan);
  const migrationPath = join(root, 'content_migration_report.json');
  if (await exists(migrationPath)) {
    const report = await readJson(migrationPath);
    await writeJsonAtomic(migrationPath, { ...report, status: 'complete', resolved_content_revision: content.revision, text_only_accepted: pending.length > 0 });
  }
  return content;
}

async function buildStructuredProject(root, content, args) {
  assertApprovedContent(content);
  const plan = await readJson(join(root, 'plans', 'html.json'));
  await assertCurrentHtmlPlan(content, plan);
  const pageInput = { slides: content.slides.map((slide, index) => ({ ...slide, asset_refs: plan.slides[index].asset_refs })) };
  const assets = await loadAssets(root, pageInput);
  await verifySelectedReferences(root, plan);
  const output = resolve(flag(args, '--out', join(root, 'index.html')));
  const entry = relative(root, output);
  if (!entry || isAbsolute(entry) || entry === '..' || entry.startsWith('../')) throw new Error('HTML build output must remain inside the producer project.');
  await mkdir(dirname(output), { recursive: true });
  await mkdir(join(root, 'slides'), { recursive: true });
  await writeTextAtomic(output, renderHtmlDeck(content, plan, { assets, assetBasePath: relative(dirname(output), root) }));
  for (const [index, slide] of content.slides.entries()) await writeTextAtomic(join(root, 'slides', `${slide.id}.html`), renderHtmlSlide(content, slide, index, plan, { assets, assetBasePath: '..' }));
  const manifest = { ...createHtmlManifest(content, plan), entry };
  await writeJsonAtomic(join(root, 'storyweave-output.json'), manifest);
  await writeJsonAtomic(join(root, 'generation_manifest.json'), {
    schema_version: 2, producer: 'storyweave-html', renderer_version: manifest.renderer_version,
    content_revision: content.revision, plan_sha256: plan.plan_sha256, theme_ref: plan.theme_ref,
    references: plan.references, reference_applications: plan.reference_applications,
    slides: manifest.slides.map((slide) => ({ id: slide.id, output_path: slide.source, layout_id: slide.layout_id, status: 'built', text_policy: 'native-html-text' })),
  });
  return { output, manifest };
}

async function replanStructuredProject(root, draft, args) {
  const content = await readJson(join(root, 'deck_spec.json'));
  assertApprovedContent(content);
  const previous = await readJson(join(root, 'plans', 'html.json'));
  const theme_ref = flag(args, '--theme-ref', previous.theme_ref);
  const plan = await createHtmlPlan(content, { theme_ref, catalog_scope: flag(args, '--catalog-scope', previous.catalog_scope), references: await referencesFor(root, args, previous.references), assetRefs: assetReferences(previous) });
  await writeJsonAtomic(join(root, 'plans', 'html.json'), plan);
  await writeJsonAtomic(join(root, 'outline_draft.json'), { ...draft, theme_ref });
  return plan;
}

async function migrateContentProject(root, args) {
  const source = await readJson(join(root, 'outline_draft.json'));
  if (![2, 3].includes(source.schema_version)) throw new Error('migrate-content accepts an existing v2 or v3 outline.');
  const theme_ref = flag(args, '--theme-ref', source.theme_ref);
  if (!theme_ref) throw new Error('Content migration requires an explicit canonical --theme-ref.');
  const catalog = await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') });
  catalog.getStyle(theme_ref);
  const sourceCheck = validateOutline(source);
  if (!sourceCheck.valid) throw new Error(sourceCheck.errors.join(' '));
  const unresolved = source.slides.filter((slide) => ['comparison', 'two-column', 'process', 'data'].includes(slide.role)).map((slide) => ({ slide_id: slide.id, original_role: slide.role, reason: 'Complete explicit comparison axes, relationships or metric units and sources before structured approval.' }));
  const draft = {
    ...Object.fromEntries(['title', 'audience', 'purpose', 'central_message', 'narrative', 'reading_mode'].filter((key) => source[key] !== undefined).map((key) => [key, source[key]])),
    schema_version: 4, status: 'draft', language: flag(args, '--language', source.language ?? 'zh-CN'), canvas: '16:9', theme_ref,
    narrativeReferences: [], page_count: source.slides.length,
    slides: source.slides.map((slide) => ({
      ...Object.fromEntries(['id', 'role', 'claim', 'purpose', 'evidence', 'sources', 'notes', 'speaker_notes', 'transition', 'asset_refs'].filter((key) => slide[key] !== undefined).map((key) => [key, slide[key]])),
      content: { type: 'statement', title: slide.exact_text[0], body: slide.exact_text.slice(1) },
    })),
    migration: { source_schema_version: source.schema_version, unresolved },
  };
  const backup = `outline_draft.v${source.schema_version}.${sha256(source).slice(0, 12)}.json`;
  if (!(await exists(join(root, backup)))) await writeJsonAtomic(join(root, backup), source);
  const report = { source_schema_version: source.schema_version, target_schema_version: 4, original_backup: backup, status: unresolved.length ? 'needs-structure' : 'complete', text_preserved: source.slides.every((slide, index) => JSON.stringify(slide.exact_text) === JSON.stringify(visibleText(draft.slides[index]))), unresolved };
  await writeJsonAtomic(join(root, 'content_migration_report.json'), report);
  await writeJsonAtomic(join(root, 'outline_draft.json'), draft);
  await writeTextAtomic(join(root, 'outline_preview.html'), previewOutline(draft));
  return report;
}

async function qaProject(root) {
  const content = await readJson(join(root, 'deck_spec.json'));
  const manifest = await readJson(join(root, 'storyweave-output.json'));
  const plan = content.schema_version === 4 ? await readJson(join(root, 'plans', 'html.json')) : null;
  const findings = [];
  const contentCheck = content.schema_version === 4 ? validateContent(content) : validateOutline(content, { approved: content.schema_version === 3 });
  findings.push(...contentCheck.errors.map((message) => ({ severity: 'blocking', code: 'content.invalid', message })));
  const common = validateOutputManifest(manifest);
  const contract = common.valid ? validateHtmlManifest(manifest, content, plan) : common;
  findings.push(...contract.findings);
  if (plan && contentCheck.valid) {
    try { await assertCurrentHtmlPlan(content, plan); await verifySelectedReferences(root, plan); }
    catch (error) { findings.push({ severity: 'blocking', code: 'plan.stale', message: error.message }); }
  }
  const report = { schema_version: 2, producer: 'storyweave-html', export_ready: false, visual_review: 'not-run', summary: {}, findings };
  let inputPaths = [];
  let before;
  // Browser checks and export approval must refer to the same bytes even when an author edits a page during QA.
  if (common.valid) {
    try {
      inputPaths = ['deck_spec.json', 'generation_manifest.json'];
      if (plan) inputPaths.push('plans/html.json', ...plan.references.filter((reference) => reference.path).map((reference) => reference.path));
      if (await exists(join(root, 'asset_manifest.json'))) inputPaths.push('asset_manifest.json');
      const pages = plan?.slides ?? content.slides;
      const assets = await loadAssets(root, { slides: pages });
      for (const page of pages) for (const reference of page.asset_refs ?? []) inputPaths.push((assets.get(reference.asset_id) ?? reference).path ?? reference.path);
      before = await createArtifactBinding(root, manifest, { inputs: inputPaths });
    } catch (error) { findings.push({ severity: 'blocking', code: 'artifact.binding', message: error.message }); }
  }
  // Browser measurements use the validated plan's capacities and image slots, not hand-editable DOM claims.
  const visual = before && contract.valid && contentCheck.valid ? await inspectHtmlProject(root, manifest, content, plan) : { mode: 'not-run', findings: [] };
  report.visual_review = visual.mode;
  findings.push(...visual.findings);
  if (before) {
    try {
      report.artifact_binding = await createArtifactBinding(root, manifest, { inputs: inputPaths });
      if (report.artifact_binding.fingerprint !== before.fingerprint) findings.push({ severity: 'blocking', code: 'artifact.changed_during_qa', message: 'Producer files changed during browser QA; rerun QA on a stable artifact.' });
    } catch (error) { findings.push({ severity: 'blocking', code: 'artifact.binding', message: error.message }); }
  }
  report.summary = { blocking: findings.filter((item) => item.severity === 'blocking').length, warning: findings.filter((item) => item.severity === 'warning').length, degraded: findings.filter((item) => item.severity === 'degraded').length };
  // A structurally valid document is not a final HTML proof when the real browser check did not run.
  report.export_ready = report.summary.blocking === 0 && report.summary.degraded === 0 && visual.mode === 'browser';
  await writeJsonAtomic(join(root, 'qa_report.json'), report);
  return report;
}

async function buildProject(root, args) {
  const deck = await readJson(join(root, 'deck_spec.json'));
  // Approved content and visual plans are separate in v4; old decks keep their original renderer.
  if (deck.schema_version === 4) return buildStructuredProject(root, deck, args);
  if (deck.mode !== 'html') throw new Error('storyweave-html only builds HTML decks.');
  if (deck.status !== 'approved') throw new Error('storyweave-html only builds approved decks.');
  const deckCheck = validateOutline(deck, { approved: deck.schema_version === 3 });
  if (!deckCheck.valid) throw new Error(deckCheck.errors.join('；'));
  let theme;
  if (deck.schema_version === 3) {
    if (deck.contract_version !== THEME_CONTRACT.contract_version) throw new Error('The approved deck uses an incompatible theme contract version.');
    if (sha256(deck.theme_recipe) !== deck.theme_recipe_sha256) throw new Error('The approved deck theme snapshot is corrupted.');
    if (deck.theme_recipe.theme_ref !== deck.theme_ref || deck.theme_recipe.style?.ref !== deck.theme_ref) throw new Error('The approved deck theme snapshot does not match theme_ref.');
    const catalog = await openThemeCatalog(null, { scope: deck.catalog_scope ?? 'active' });
    const current = resolveTheme(deck.theme_ref, { catalog });
    if (current.kind === 'canonical') {
      theme = current;
      for (const slide of deck.slides) {
        const plan = catalog.resolveVisualPlan({ phase: 'build', theme_ref: deck.theme_ref, slide });
        if (plan.theme_recipe_sha256 !== deck.theme_recipe_sha256 || plan.visual_scheme_sha256 !== slide.visual_scheme_sha256 || plan.render_recipe_ref !== slide.render_recipe_ref || plan.render_recipe_sha256 !== slide.render_recipe_sha256) throw new Error(`Theme or render recipe is stale for slide ${slide.id}. Re-approve the deck.`);
      }
    } else {
      theme = {
        kind: 'canonical',
        migration_status: 'canonical',
        id: deck.theme_ref,
        theme_ref: deck.theme_ref,
        architecture_id: deck.theme_recipe.architecture.id,
        label: deck.theme_ref,
        tokens: deck.theme_recipe.style.tokens,
        contract_version: deck.contract_version,
        source: 'approved-snapshot',
      };
    }
  } else {
    theme = requireTheme(deck.theme);
    if (theme.kind === 'canonical') throw new Error('A legacy deck requires a legacy theme ID.');
  }
  const assets = await loadAssets(root, deck);
  const output = resolve(flag(args, '--out', join(root, 'index.html')));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(join(root, 'slides'), { recursive: true });
  await writeTextAtomic(output, renderHtmlDeck(deck, theme, { assets, assetBasePath: '' }));
  for (const [index, slide] of deck.slides.entries()) await writeTextAtomic(join(root, 'slides', `${slide.id}.html`), renderHtmlSlide(deck, slide, index, theme, { assets, assetBasePath: '..' }));
  const manifest = createHtmlManifest(deck, theme);
  await writeJsonAtomic(join(root, 'storyweave-output.json'), manifest);
  await writeJsonAtomic(join(root, 'generation_manifest.json'), {
    schema_version: manifest.version, producer: manifest.producer, mode: 'html', renderer_version: manifest.renderer_version,
    ...(manifest.version === 2 ? { contract_version: manifest.contract_version, theme_ref: manifest.theme_ref, theme_recipe_sha256: manifest.theme_recipe_sha256, deck_spec_sha256: manifest.deck_spec_sha256 } : { legacy_theme_id: manifest.legacy_theme_id, migration_status: manifest.migration_status }),
    slides: manifest.slides.map((slide) => ({ id: slide.id, role: slide.role, output_path: slide.source, status: 'pass', asset_role: 'complete-html-page', text_policy: 'native-html-text', ...(slide.visual_scheme_ref ? { visual_scheme_ref: slide.visual_scheme_ref, visual_scheme_sha256: slide.visual_scheme_sha256, render_recipe_ref: slide.render_recipe_ref, render_recipe_sha256: slide.render_recipe_sha256, motion_recipe_ref: slide.motion_recipe_ref } : {}), ...(slide.page_rhythm ? { page_rhythm: slide.page_rhythm } : {}), ...(slide.asset_refs?.length ? { asset_refs: slide.asset_refs } : {}) })),
  });
  return { output, manifest };
}

async function previewProject(root, args) {
  const draft = await readJson(join(root, 'outline_draft.json'));
  if (![3, 4].includes(draft.schema_version)) throw new Error('Theme previews require a canonical v3 or v4 outline.');
  const catalog = await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') });
  const requested = flag(args, '--theme-ref', draft.theme_ref);
  const available = catalog.list().map((item) => item.ref);
  const refs = [requested, ...available.filter((ref) => ref !== requested)].filter(Boolean).slice(0, Number(flag(args, '--count', '3')) || 3);
  const assets = await loadAssets(root, draft);
  const outputDir = resolve(flag(args, '--out', join(root, 'preview')));
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (const ref of refs) {
    const deck = draft.schema_version === 4 ? approveContent(draft) : approveOutline({ ...draft, theme_ref: ref }, { mode: 'html', theme_ref: ref, themes: catalog, catalog_scope: catalog.scope });
    const theme = draft.schema_version === 4 ? await createHtmlPlan(deck, { theme_ref: ref, catalog_scope: catalog.scope, references: await referencesFor(root, args), assetRefs: assetReferences(draft) }) : resolveTheme(ref, { catalog });
    const output = join(outputDir, `${safeSlug(ref)}.html`);
    // Preview files live in a subdirectory; image paths must be relative to each output, as in build.
    await writeTextAtomic(output, renderHtmlDeck(deck, theme, { assets, assetBasePath: relative(dirname(output), root) }));
    files.push({ theme_ref: ref, output });
  }
  return { outputDir, files };
}

async function exportProject(root, format) {
  const deck = await readJson(join(root, 'deck_spec.json'));
  // Exports must refer to the files that actually passed QA, including hand-edited HTML pages.
  const { manifest } = await readVerifiedArtifact(root);
  const dist = join(root, 'dist');
  await mkdir(dist, { recursive: true });
  if (format === 'html') {
    const target = join(dist, `${safeSlug(deck.title)}.html`);
    await copyFile(join(root, manifest.entry), target);
    await cp(join(root, 'slides'), join(dist, 'slides'), { recursive: true });
    const registry = await exists(join(root, 'asset_manifest.json')) ? await readJson(join(root, 'asset_manifest.json')) : { assets: [] };
    const assets = new Map(registry.assets.map((asset) => [asset.id, asset]));
    for (const slide of manifest.slides) for (const reference of slide.asset_refs ?? []) {
      const path = safeAssetPath((assets.get(reference.asset_id) ?? reference).path ?? reference.path);
      if (!path) throw new Error(`Invalid export asset on ${slide.id}.`);
      await mkdir(dirname(join(dist, path)), { recursive: true });
      await copyFile(join(root, path), join(dist, path));
    }
    return [target];
  }
  const loaded = await optional('playwright');
  if (!loaded) throw new Error('Playwright is required for PNG/PDF/PPTX export.');
  const chromium = loaded.chromium ?? loaded.default?.chromium;
  const browser = await chromium.launch({ headless: true });
  const pngs = [];
  try {
    const page = await browser.newPage({ viewport: manifest.canvas, deviceScaleFactor: 2 });
    for (const [index, slide] of manifest.slides.entries()) {
      await page.goto(pathToFileURL(resolve(root, slide.source)).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const target = join(dist, `${String(index + 1).padStart(2, '0')}-${slide.id}.png`);
      await page.screenshot({ path: target, animations: 'disabled' });
      pngs.push(target);
    }
    if (format === 'pdf') {
      const pdfPage = await browser.newPage({ viewport: manifest.canvas });
      await pdfPage.goto(pathToFileURL(join(root, manifest.entry)).href, { waitUntil: 'load' });
      // The interactive gallery hides inactive slides; print lays out each original page once without changing source files.
      await pdfPage.addStyleTag({ content: `@page{size:${manifest.canvas.width}px ${manifest.canvas.height}px;margin:0}html,body{width:${manifest.canvas.width}px!important;height:auto!important;overflow:visible!important}.stage-viewport{display:block!important;width:${manifest.canvas.width}px!important;height:auto!important;overflow:visible!important}.stage{position:static!important;margin:0!important;transform:none!important;width:${manifest.canvas.width}px!important;height:auto!important}.slide{display:block!important;position:relative!important;inset:auto!important;width:${manifest.canvas.width}px!important;height:${manifest.canvas.height}px!important;break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}.nav{display:none!important}*{animation:none!important}` });
      await pdfPage.evaluate(() => document.fonts.ready);
      const target = join(dist, `${safeSlug(deck.title)}.pdf`);
      await pdfPage.pdf({ path: target, width: `${manifest.canvas.width}px`, height: `${manifest.canvas.height}px`, printBackground: true });
      return [target];
    }
  } finally { await browser.close(); }
  if (format === 'png') return pngs;
  const loadedPptx = await optional('pptxgenjs');
  if (!loadedPptx) throw new Error('PptxGenJS is required for PPTX export.');
  const PptxGenJS = loadedPptx.default ?? loadedPptx;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  for (const [index, path] of pngs.entries()) { const page = pptx.addSlide(); page.addImage({ path, x: 0, y: 0, w: 13.333, h: 7.5 }); page.addNotes?.(manifest.slides[index].notes ?? ''); }
  const target = join(dist, `${safeSlug(deck.title)}.pptx`);
  await pptx.writeFile({ fileName: target });
  return [target];
}

export async function main(args) {
  const command = args[0];
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(HELP); return 0; }
  if (command === 'doctor') {
    const report = { node: { version: process.versions.node, supported: Number(process.versions.node.split('.')[0]) >= 20 }, output: { standalone_html: true, content_schema: 4, plan_schema: 1 }, theme_contract: { version: THEME_CONTRACT.contract_version } };
    console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2));
    return report.node.supported ? 0 : 1;
  }
  if (command === 'themes') {
    const catalog = await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') });
    const result = { canonical: catalog.list({ includeAll: hasFlag(args, '--all') }), legacy: Object.values(THEMES).map(({ id, label, use, aliases }) => ({ id, label, use, aliases, resolution: resolveTheme(id, { catalog }).kind })) };
    console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2));
    return 0;
  }
  const root = resolve(args[1] ?? '.');
  if (command === 'draft') {
    const requested = flag(args, '--theme-ref');
    const schema = Number(flag(args, '--schema', requested ? '4' : '2'));
    if (![2, 3, 4].includes(schema)) throw new Error('Supported HTML content schemas are 2, 3 and 4.');
    const theme_ref = requested ?? (schema > 2 ? 'systems/ink-blue-grid' : null);
    if (theme_ref) (await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') })).getStyle(theme_ref);
    const title = flag(args, '--title', schema === 4 ? 'StoryWeave 内容与表达' : 'AI 原生知识工作流');
    const reading_mode = flag(args, '--reading-mode', 'speaker-led');
    const draft = schema === 4 ? await createStructuredDraft(title, theme_ref, args) : createOutline(title, schema === 3 ? { theme_ref, catalog_scope: flag(args, '--catalog-scope', 'active'), language: flag(args, '--language', 'zh-CN'), reading_mode } : { reading_mode });
    await mkdir(root, { recursive: true });
    await writeJsonAtomic(join(root, 'outline_draft.json'), draft);
    await writeTextAtomic(join(root, 'outline_preview.html'), previewOutline(draft));
    console.log(join(root, 'outline_preview.html'));
    return 0;
  }
  if (command === 'preview') {
    const result = await previewProject(root, args);
    console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2));
    return 0;
  }
  if (command === 'approve') {
    let draft = await readJson(join(root, 'outline_draft.json'));
    if (draft.schema_version === 4) await approveStructuredProject(root, draft, args);
    else if (draft.schema_version === 3) {
      const requested = flag(args, '--theme-ref', draft.theme_ref);
      const scope = flag(args, '--catalog-scope', draft.catalog_scope ?? 'active');
      const catalog = await openThemeCatalog(null, { scope });
      if (requested !== draft.theme_ref) draft = replanOutline(draft, { theme_ref: requested, themes: catalog, catalog_scope: scope });
      const deck = approveOutline(draft, { mode: 'html', theme_ref: requested, themes: catalog, catalog_scope: scope });
      await writeJsonAtomic(join(root, 'deck_spec.json'), deck);
    } else {
      const requested = flag(args, '--theme');
      if (!requested) throw new Error('Legacy approval requires --theme.');
      const theme = requireTheme(requested);
      if (theme.kind === 'canonical') throw new Error('Use --theme-ref for a canonical theme.');
      await writeJsonAtomic(join(root, 'deck_spec.json'), approveOutline(draft, { mode: 'html', theme: theme.legacy_theme_id }));
    }
    console.log(join(root, 'deck_spec.json'));
    return 0;
  }
  if (command === 'migrate-content') {
    const result = await migrateContentProject(root, args);
    console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2));
    return result.status === 'needs-structure' ? 3 : 0;
  }
  if (command === 'migrate') {
    const original = await readJson(join(root, 'outline_draft.json'));
    const existingDeck = await exists(join(root, 'deck_spec.json')) ? await readJson(join(root, 'deck_spec.json')) : null;
    const source = original.theme || !existingDeck?.theme ? original : { ...original, theme: existingDeck.theme };
    const scope = flag(args, '--catalog-scope', 'active');
    const catalog = await openThemeCatalog(null, { scope });
    const migrated = migrateOutline(source, { theme_ref: flag(args, '--theme-ref'), themes: catalog, language: flag(args, '--language', 'zh-CN'), catalog_scope: scope });
    await writeJsonAtomic(join(root, 'outline_draft.v2.json'), original);
    await writeJsonAtomic(join(root, 'outline_draft.json'), migrated);
    await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(migrated));
    console.log(join(root, 'outline_draft.json'));
    return 0;
  }
  if (command === 'replan') {
    const source = await readJson(join(root, 'outline_draft.json'));
    if (source.schema_version === 4) {
      await replanStructuredProject(root, source, args);
    } else {
      const theme_ref = flag(args, '--theme-ref');
      if (!theme_ref) throw new Error('replan requires --theme-ref.');
      const scope = flag(args, '--catalog-scope', source.catalog_scope ?? 'active');
      const catalog = await openThemeCatalog(null, { scope });
      await writeJsonAtomic(join(root, 'outline_draft.json'), replanOutline(source, { theme_ref, themes: catalog, catalog_scope: scope }));
    }
    await writeTextAtomic(join(root, 'outline_preview.html'), previewOutline(await readJson(join(root, 'outline_draft.json'))));
    console.log(join(root, source.schema_version === 4 ? 'plans/html.json' : 'outline_draft.json'));
    return 0;
  }
  if (command === 'prompts') throw new Error('storyweave-html does not generate image prompts.');
  if (['build', 'render', 'bundle'].includes(command)) {
    const result = await buildProject(root, args);
    console.log(result.output);
    return 0;
  }
  if (command === 'qa') {
    const report = await qaProject(root);
    console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2));
    return report.export_ready ? 0 : 2;
  }
  if (command === 'export') {
    const format = flag(args, '--format', 'html');
    if (!['html', 'png', 'pdf', 'pptx'].includes(format)) throw new Error(`Unsupported export format: ${format}`);
    const files = await exportProject(root, format);
    await readVerifiedArtifact(root);
    console.log(JSON.stringify({ format, files }, null, 2));
    return 0;
  }
  throw new Error(`Unknown command: ${command}`);
}
