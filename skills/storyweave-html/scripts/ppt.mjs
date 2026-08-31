#!/usr/bin/env node
import { createRequire } from 'node:module';
import { access, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { approveOutline, createOutline, migrateOutline, renderOutlinePreview, replanOutline, validateOutline } from './lib/outline.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide, validateHtmlManifest } from './lib/html.mjs';
import { openThemeCatalog, requireTheme, resolveTheme, sha256, THEMES, THEME_CONTRACT } from './lib/themes.mjs';
import { writeJsonAtomic, writeTextAtomic } from './lib/storage.mjs';

const require = createRequire(import.meta.url);
const HELP = `storyweave-html

Commands:
  draft <dir> [--title text] [--theme-ref architecture/style]
  themes [--json]
  approve <dir> (--theme legacy-id | --theme-ref architecture/style)
  preview <dir> [--theme-ref architecture/style] [--count 3] [--out path]
  migrate <dir> [--theme-ref architecture/style]
  replan <dir> --theme-ref architecture/style
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
async function optional(name) { try { return await import(name); } catch { try { return require(name); } catch { return null; } } }

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

async function buildProject(root, args) {
  const deck = await readJson(join(root, 'deck_spec.json'));
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
  if (draft.schema_version !== 3) throw new Error('Theme previews require a canonical v3 outline.');
  const catalog = await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') });
  const requested = flag(args, '--theme-ref', draft.theme_ref);
  const available = catalog.list().map((item) => item.ref);
  const refs = [requested, ...available.filter((ref) => ref !== requested)].filter(Boolean).slice(0, Number(flag(args, '--count', '3')) || 3);
  const assets = await loadAssets(root, draft);
  const outputDir = resolve(flag(args, '--out', join(root, 'preview')));
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (const ref of refs) {
    const deck = approveOutline({ ...draft, theme_ref: ref }, { mode: 'html', theme_ref: ref, themes: catalog, catalog_scope: catalog.scope });
    const theme = resolveTheme(ref, { catalog });
    const output = join(outputDir, `${safeSlug(ref)}.html`);
    await writeTextAtomic(output, renderHtmlDeck(deck, theme, { assets, assetBasePath: '' }));
    files.push({ theme_ref: ref, output });
  }
  return { outputDir, files };
}

async function reviewHtml(root, manifest) {
  const findings = [];
  for (const slide of manifest.slides) {
    const path = resolve(root, slide.source);
    if (!(await exists(path))) { findings.push({ severity: 'blocking', code: 'slide.missing', slide_id: slide.id, message: `Missing ${slide.source}.` }); continue; }
    const html = await readFile(path, 'utf8');
    if (!html.includes('data-storyweave-slide') || !html.includes(`data-slide-id="${slide.id}"`)) findings.push({ severity: 'blocking', code: 'slide.contract', slide_id: slide.id, message: 'HTML page does not expose the Storyweave slide markers.' });
  }
  const loaded = await optional('playwright');
  if (!loaded) return { mode: 'degraded', findings: [...findings, { severity: 'degraded', code: 'browser.unavailable', message: 'Playwright is unavailable; visual review was skipped.' }], screenshots: [] };
  const chromium = loaded.chromium ?? loaded.default?.chromium;
  const browser = await chromium.launch({ headless: true });
  const screenshots = [];
  try {
    await mkdir(join(root, 'qa', 'screenshots'), { recursive: true });
    for (const viewport of [{ id: 'desktop', ...manifest.canvas }, { id: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      for (const slide of manifest.slides) {
        await page.goto(pathToFileURL(resolve(root, slide.source)).href, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(500);
        const state = await page.evaluate(() => {
          const slide = document.querySelector('[data-storyweave-slide]');
          const stage = document.querySelector('.stage');
          const stageRect = stage?.getBoundingClientRect();
          const regions = [...document.querySelectorAll('[data-storyweave-region]')].map((element) => ({
            name: element.dataset.storyweaveRegion,
            rect: element.getBoundingClientRect(),
          })).filter((item) => item.rect.width > 0 && item.rect.height > 0);
          const pairs = [];
          const intentionalOverlay = slide?.classList.contains('role-image-hero');
          for (let index = 0; index < regions.length; index += 1) {
            for (let next = index + 1; next < regions.length; next += 1) {
              const a = regions[index].rect;
              const b = regions[next].rect;
              const overlaps = Math.max(a.left, b.left) < Math.min(a.right, b.right) && Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
              const allowed = intentionalOverlay && new Set([regions[index].name, regions[next].name]).size === 2 && new Set([regions[index].name, regions[next].name]).has('copy') && new Set([regions[index].name, regions[next].name]).has('visual');
              if (overlaps && !allowed) pairs.push(`${regions[index].name}:${regions[next].name}`);
            }
          }
          const title = slide?.querySelector('[data-storyweave-content="title"]');
          const firstContent = slide?.querySelector('.copy>ol,.copy>.columns,.copy>.metrics,.copy>p,.copy>blockquote p');
          const titleRect = title?.getBoundingClientRect();
          const contentRect = firstContent?.getBoundingClientRect();
          const scale = stageRect?.width ? stageRect.width / 1280 : 1;
          const contentBottom = regions.reduce((max, item) => Math.max(max, item.rect.bottom), stageRect?.top ?? 0);
          const outOfBounds = regions.filter((item) => stageRect && (item.rect.left < stageRect.left - 1 || item.rect.right > stageRect.right + 1 || item.rect.top < stageRect.top - 1 || item.rect.bottom > stageRect.bottom + 1)).map((item) => item.name);
          const fonts = [...(slide?.querySelectorAll('[data-storyweave-content="title"],.copy>p,.copy>ol>li,.copy>.columns>p,.copy>.metrics>div') ?? [])].map((element) => Number.parseFloat(getComputedStyle(element).fontSize)).filter(Number.isFinite);
          const brokenAssets = [...(slide?.querySelectorAll('[data-storyweave-asset-slot] img') ?? [])].filter((image) => !image.complete || image.naturalWidth === 0).length;
          return {
            count: document.querySelectorAll('[data-storyweave-slide]').length,
            overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
            theme_ref: document.querySelector('meta[name="storyweave-theme-ref"]')?.content,
            legacy_theme_id: document.querySelector('meta[name="storyweave-legacy-theme"]')?.content,
            stage: stageRect ? { width: stageRect.width, height: stageRect.height } : null,
            scale,
            overlapPairs: pairs,
            outOfBounds,
            titleGap: titleRect && contentRect ? contentRect.top - titleRect.bottom : null,
            contentBottom,
            stageBottom: stageRect?.bottom ?? null,
            minFontSize: fonts.length ? Math.min(...fonts) : null,
            brokenAssets,
          };
        });
        if (state.count !== 1) findings.push({ severity: 'blocking', code: 'browser.slide_count', slide_id: slide.id, viewport: viewport.id, message: 'Standalone page must contain exactly one slide.' });
        if (state.overflow) findings.push({ severity: 'warning', code: 'browser.overflow', slide_id: slide.id, viewport: viewport.id, message: `Page overflows the ${viewport.id} viewport.` });
        if (state.overlapPairs.length) findings.push({ severity: 'blocking', code: 'browser.visual_overlap', slide_id: slide.id, viewport: viewport.id, message: `Visual regions overlap: ${state.overlapPairs.join(', ')}.` });
        if (state.outOfBounds.length) findings.push({ severity: 'blocking', code: 'browser.visual_bounds', slide_id: slide.id, viewport: viewport.id, message: `Visual regions leave the fixed stage: ${state.outOfBounds.join(', ')}.` });
        if (state.stage && (Math.abs(state.stage.width - 1280 * state.scale) > 2 || Math.abs(state.stage.height - 720 * state.scale) > 2)) findings.push({ severity: 'blocking', code: 'browser.stage_geometry', slide_id: slide.id, viewport: viewport.id, message: 'Fixed stage geometry is inconsistent with the 16:9 canvas.' });
        if (state.contentBottom !== null && state.stageBottom !== null && state.contentBottom > state.stageBottom - (12 * state.scale)) findings.push({ severity: 'blocking', code: 'browser.nav_safe', slide_id: slide.id, viewport: viewport.id, message: 'Visual content enters the bottom navigation safety area.' });
        if (state.titleGap !== null && state.titleGap < (12 * state.scale)) findings.push({ severity: 'warning', code: 'browser.title_gap', slide_id: slide.id, viewport: viewport.id, message: 'Title and first content block are too close.' });
        if (state.minFontSize !== null && state.minFontSize < 16) findings.push({ severity: 'warning', code: 'browser.font_size', slide_id: slide.id, viewport: viewport.id, message: 'Primary copy uses a font size below 16px on the fixed stage.' });
        if (state.brokenAssets) findings.push({ severity: 'blocking', code: 'browser.asset_broken', slide_id: slide.id, viewport: viewport.id, message: `${state.brokenAssets} declared asset image(s) failed to load.` });
        if (manifest.version === 2 && state.theme_ref !== manifest.theme_ref) findings.push({ severity: 'blocking', code: 'browser.theme_ref', slide_id: slide.id, viewport: viewport.id, message: 'Standalone page does not expose its canonical theme_ref.' });
        if (manifest.version === 1 && state.legacy_theme_id !== manifest.legacy_theme_id) findings.push({ severity: 'blocking', code: 'browser.legacy_theme', slide_id: slide.id, viewport: viewport.id, message: 'Standalone page does not expose its legacy theme ID.' });
        const screenshot = join(root, 'qa', 'screenshots', `${slide.id}${viewport.id === 'desktop' ? '' : '-mobile'}.png`);
        await page.screenshot({ path: screenshot });
        screenshots.push(screenshot);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  return { mode: 'browser', findings, screenshots };
}

async function exportProject(root, format) {
  const deck = await readJson(join(root, 'deck_spec.json'));
  const manifest = await readJson(join(root, 'storyweave-output.json'));
  const dist = join(root, 'dist');
  await mkdir(dist, { recursive: true });
  if (format === 'html') {
    const target = join(dist, `${safeSlug(deck.title)}.html`);
    await copyFile(join(root, manifest.entry), target);
    await cp(join(root, 'slides'), join(dist, 'slides'), { recursive: true });
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
      const target = join(dist, `${String(index + 1).padStart(2, '0')}-${slide.id}.png`);
      await page.screenshot({ path: target });
      pngs.push(target);
    }
    if (format === 'pdf') {
      const pdfPage = await browser.newPage({ viewport: manifest.canvas });
      await pdfPage.goto(pathToFileURL(join(root, manifest.entry)).href, { waitUntil: 'load' });
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

async function main(args) {
  const command = args[0];
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(HELP); return 0; }
  if (command === 'doctor') { const report = { node: { version: process.versions.node, supported: Number(process.versions.node.split('.')[0]) >= 20 }, output: { standalone_html: true }, theme_contract: { version: THEME_CONTRACT.contract_version } }; console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.node.supported ? 0 : 1; }
  if (command === 'themes') { const catalog = await openThemeCatalog(null, { scope: flag(args, '--catalog-scope', 'active') }); const result = { canonical: catalog.list({ includeAll: hasFlag(args, '--all') }), legacy: Object.values(THEMES).map(({ id, label, use, aliases }) => ({ id, label, use, aliases, resolution: resolveTheme(id, { catalog }).kind })) }; console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2)); return 0; }
  const root = resolve(args[1] ?? '.');
  if (command === 'draft') { await mkdir(root, { recursive: true }); const theme_ref = flag(args, '--theme-ref'); const reading_mode = flag(args, '--reading-mode', 'speaker-led'); const draftOptions = theme_ref ? { theme_ref, catalog_scope: flag(args, '--catalog-scope', 'active'), language: flag(args, '--language', 'zh-CN'), reading_mode } : { reading_mode }; const draft = createOutline(flag(args, '--title', 'AI 原生知识工作流'), draftOptions); if (theme_ref) { const catalog = await openThemeCatalog(null, { scope: draft.catalog_scope }); catalog.getStyle(theme_ref); } await writeJsonAtomic(join(root, 'outline_draft.json'), draft); await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(draft)); console.log(join(root, 'outline_preview.html')); return 0; }
  if (command === 'preview') { const result = await previewProject(root, args); console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2)); return 0; }
  if (command === 'approve') { let draft = await readJson(join(root, 'outline_draft.json')); if (draft.schema_version === 3) { const requested = flag(args, '--theme-ref', draft.theme_ref); const scope = flag(args, '--catalog-scope', draft.catalog_scope ?? 'active'); const catalog = await openThemeCatalog(null, { scope }); if (requested !== draft.theme_ref) draft = replanOutline(draft, { theme_ref: requested, themes: catalog, catalog_scope: scope }); const deck = approveOutline(draft, { mode: 'html', theme_ref: requested, themes: catalog, catalog_scope: scope }); await writeJsonAtomic(join(root, 'deck_spec.json'), deck); console.log(join(root, 'deck_spec.json')); return 0; } const requested = flag(args, '--theme'); if (!requested) throw new Error('Legacy approval requires --theme.'); const theme = requireTheme(requested); if (theme.kind === 'canonical') throw new Error('Use --theme-ref for a canonical theme.'); const deck = approveOutline(draft, { mode: 'html', theme: theme.legacy_theme_id }); await writeJsonAtomic(join(root, 'deck_spec.json'), deck); console.log(join(root, 'deck_spec.json')); return 0; }
  if (command === 'migrate') { const original = await readJson(join(root, 'outline_draft.json')); const existingDeck = await exists(join(root, 'deck_spec.json')) ? await readJson(join(root, 'deck_spec.json')) : null; const source = original.theme || !existingDeck?.theme ? original : { ...original, theme: existingDeck.theme }; const scope = flag(args, '--catalog-scope', 'active'); const catalog = await openThemeCatalog(null, { scope }); const migrated = migrateOutline(source, { theme_ref: flag(args, '--theme-ref'), themes: catalog, language: flag(args, '--language', 'zh-CN'), catalog_scope: scope }); await writeJsonAtomic(join(root, 'outline_draft.v2.json'), original); await writeJsonAtomic(join(root, 'outline_draft.json'), migrated); await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(migrated)); console.log(join(root, 'outline_draft.json')); return 0; }
  if (command === 'replan') { const source = await readJson(join(root, 'outline_draft.json')); const theme_ref = flag(args, '--theme-ref'); if (!theme_ref) throw new Error('replan requires --theme-ref.'); const scope = flag(args, '--catalog-scope', source.catalog_scope ?? 'active'); const catalog = await openThemeCatalog(null, { scope }); const next = replanOutline(source, { theme_ref, themes: catalog, catalog_scope: scope }); await writeJsonAtomic(join(root, 'outline_draft.json'), next); await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(next)); console.log(join(root, 'outline_draft.json')); return 0; }
  if (command === 'prompts') throw new Error('storyweave-html does not generate image prompts.');
  if (command === 'build' || command === 'render' || command === 'bundle') { const result = await buildProject(root, args); console.log(result.output); return 0; }
  if (command === 'qa') { const draft = await readJson(join(root, 'outline_draft.json')); const deck = await readJson(join(root, 'deck_spec.json')); const outline = validateOutline(draft); const manifest = await readJson(join(root, 'storyweave-output.json')); const contract = validateHtmlManifest(manifest, deck); const visual = await reviewHtml(root, manifest); const findings = [...outline.errors.map((message) => ({ severity: 'blocking', code: 'outline.invalid', message })), ...contract.findings, ...visual.findings]; const summary = { blocking: findings.filter((item) => item.severity === 'blocking').length, warning: findings.filter((item) => item.severity === 'warning').length, degraded: findings.filter((item) => item.severity === 'degraded').length }; const report = { schema_version: 1, producer: 'storyweave-html', export_ready: summary.blocking === 0, summary, visual_review: visual.mode, findings }; await writeJsonAtomic(join(root, 'qa_report.json'), report); console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.export_ready ? 0 : 2; }
  if (command === 'export') { const format = flag(args, '--format', 'html'); if (!['html', 'png', 'pdf', 'pptx'].includes(format)) throw new Error(`Unsupported export format: ${format}`); const files = await exportProject(root, format); console.log(JSON.stringify({ format, files }, null, 2)); return 0; }
  throw new Error(`Unknown command: ${command}`);
}

try { const code = await main(process.argv.slice(2)); if (typeof code === 'number') process.exitCode = code; }
catch (error) { console.error(error.message); process.exitCode = 1; }
