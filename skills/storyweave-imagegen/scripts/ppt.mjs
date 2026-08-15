#!/usr/bin/env node
import { access, copyFile, cp, mkdir, readFile, rename } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { approveOutline, createOutline, migrateOutline, renderOutlinePreview, validateOutline } from './lib/outline.mjs';
import {
  IMAGEGEN_MODE,
  DEFAULT_MODEL,
  DEFAULT_QUALITY,
  DEFAULT_SIZE,
  compileImageJobs,
  createStoryweaveOutput,
  createGenerationManifest,
  inspectGeneratedImage,
  refreshManifest,
  validateManifest,
} from './lib/imagegen.mjs';
import { renderImageDeck } from './lib/render.mjs';
import { writeJsonAtomic, writeTextAtomic } from './lib/storage.mjs';
import { openThemeCatalog } from './lib/themes.mjs';

const require = createRequire(import.meta.url);
const skillRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const themePath = join(skillRoot, 'assets', 'themes', 'image-themes.json');
const themeRoot = join(skillRoot, 'assets', 'themes');

const HELP = `storyweave-imagegen

Commands:
  draft <dir> [--theme architecture/style] [--title text] [--scope active|authoring]
  themes [--all] [--style architecture/style] [--json]
  approve <dir> [--theme architecture/style]
  migrate <dir> --to 3 --language zh-CN [--scope authoring]
  prompts <dir> [--model imagegen] [--size 2048x1152] [--quality medium]
  review <dir> --slide slide-id --pass|--fail [--notes text]
  build <dir> [--out path]
  qa <dir> [--json]
  export <dir> --format html|png|pdf|pptx
  doctor [--json]

Imagegen produces one complete 16:9 rasterized slide per page. The text is rendered by Imagegen and is not object-level editable.
`;

function flag(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasFlag(args, name) { return args.includes(name); }

async function exists(path) { return access(path).then(() => true, () => false); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function loadThemes() { return readJson(themePath); }
async function loadThemeCatalog(scope = 'active') { return openThemeCatalog(themeRoot, { scope }); }

function safeSlug(value) {
  return String(value ?? 'presentation').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 80) || 'presentation';
}

async function loadProject(root) {
  const deck = await readJson(join(root, 'deck_spec.json'));
  const manifest = await refreshManifest(root, await readJson(join(root, 'generation_manifest.json')));
  return { deck, manifest };
}

async function writeJobs(root, jobs) {
  const lines = jobs.map((job) => JSON.stringify(job)).join('\n');
  await writeTextAtomic(join(root, 'imagegen-jobs.jsonl'), lines ? `${lines}\n` : '');
}

async function moveIfPresent(source, target) {
  if (await exists(source)) await rename(source, target);
}

async function migrateProject(root, args) {
  if (flag(args, '--to') !== '3') throw new Error('migrate currently supports only --to 3.');
  const draftPath = join(root, 'outline_draft.json');
  const draft = await readJson(draftPath);
  const deckPath = join(root, 'deck_spec.json');
  const oldDeck = await exists(deckPath) ? await readJson(deckPath) : null;
  const sourceTheme = draft.theme_ref ?? draft.theme ?? oldDeck?.theme_ref ?? oldDeck?.theme;
  const catalog_scope = flag(args, '--scope', flag(args, '--catalog-scope', 'authoring'));
  const catalog = await loadThemeCatalog(catalog_scope);
  const migrated = migrateOutline(draft, { theme_ref: sourceTheme, language: flag(args, '--language'), themes: catalog, catalog_scope });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(root, `_migration_backup/v2-${stamp}`);
  await mkdir(backup, { recursive: true });
  for (const name of ['outline_draft.json', 'outline_preview.html', 'deck_spec.json', 'generation_manifest.json', 'imagegen-jobs.jsonl', 'storyweave-output.json', 'qa_report.json', 'index.html']) {
    await moveIfPresent(join(root, name), join(backup, name));
  }
  await moveIfPresent(join(root, 'slides'), join(backup, 'slides'));
  await moveIfPresent(join(root, 'dist'), join(backup, 'dist'));
  await writeJsonAtomic(draftPath, migrated);
  await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(migrated));
  console.log(JSON.stringify({ migrated: draftPath, theme_ref: migrated.theme_ref, backup }, null, 2));
}

async function markReview(root, args) {
  const { manifest } = await loadProject(root);
  const id = flag(args, '--slide');
  const slide = manifest.slides.find((item) => item.id === id);
  if (!slide) throw new Error(`Unknown slide: ${id ?? 'missing'}`);
  const passed = hasFlag(args, '--pass');
  const failed = hasFlag(args, '--fail');
  if (passed === failed) throw new Error('Choose exactly one of --pass or --fail.');
  slide.visual_review = passed ? 'pass' : 'fail';
  slide.status = passed ? 'pass' : 'revise';
  slide.review_notes = flag(args, '--notes', null);
  slide.reviewed_at = new Date().toISOString();
  await writeJsonAtomic(join(root, 'generation_manifest.json'), manifest);
  console.log(`${id}: ${slide.visual_review}`);
}

async function optional(name) {
  try { return await import(name); } catch {
    try { return require(name); } catch { return null; }
  }
}

async function exportProject(root, format) {
  const { deck, manifest } = await loadProject(root);
  const themeCatalog = deck.schema_version === 3 && manifest.schema_version === 3 ? await loadThemeCatalog(deck.catalog_scope ?? 'active') : null;
  const check = validateManifest(manifest, deck, themeCatalog);
  if (!check.valid) throw new Error(`Export blocked: ${check.findings.map((item) => item.message).join(' ')}`);
  const dist = join(root, 'dist');
  await mkdir(dist, { recursive: true });
  const indexPath = join(root, 'index.html');
  if (!(await exists(indexPath))) throw new Error('Build the image deck before export.');
  if (format === 'html') {
    const target = join(dist, `${safeSlug(deck.title)}.html`);
    await copyFile(indexPath, target);
    await cp(join(root, 'slides'), join(dist, 'slides'), { recursive: true });
    await writeJsonAtomic(join(dist, 'export-report.json'), { schema_version: 1, format, source: indexPath, files: [target], object_editability: 'rasterized-image-only' });
    return [target];
  }
  if (format === 'png') {
    const files = [];
    for (const [index, slide] of manifest.slides.entries()) {
      const target = join(dist, `${String(index + 1).padStart(2, '0')}-${slide.id}.png`);
      await copyFile(join(root, slide.output_path), target);
      files.push(target);
    }
    await writeJsonAtomic(join(dist, 'export-report.json'), { schema_version: 1, format, source: indexPath, files, object_editability: 'rasterized-image-only' });
    return files;
  }
  if (format === 'pptx') {
    const pptxgen = await optional('pptxgenjs');
    if (!pptxgen) throw new Error('PptxGenJS is required for PPTX export. Install dependencies in scripts/.');
    const PptxGenJS = pptxgen.default ?? pptxgen;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = deck.title;
    pptx.subject = deck.purpose;
    for (const slide of manifest.slides) {
      const page = pptx.addSlide();
      page.addImage({ path: join(root, slide.output_path), x: 0, y: 0, w: 13.333, h: 7.5 });
      const source = deck.slides.find((item) => item.id === slide.id);
      page.addNotes?.(`${source?.claim ?? ''}\n${source?.exact_text?.join('\n') ?? ''}`);
    }
    const target = join(dist, `${safeSlug(deck.title)}.pptx`);
    await pptx.writeFile({ fileName: target });
    await writeJsonAtomic(join(dist, 'export-report.json'), { schema_version: 1, format, source: indexPath, files: [target], object_editability: 'rasterized-image-only' });
    return [target];
  }
  const playwright = await optional('playwright');
  if (!playwright) throw new Error('Playwright is required for PDF export. Install dependencies in scripts/.');
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(indexPath).href, { waitUntil: 'load' });
    await page.waitForTimeout(100);
    if (format === 'pdf') {
      const target = join(dist, `${safeSlug(deck.title)}.pdf`);
      await page.addStyleTag({ content: '.slide{display:block!important;page-break-after:always}.deck{display:block!important;height:auto!important}button,.slide span{display:none!important}' });
      await page.pdf({ path: target, width: '1600px', height: '900px', printBackground: true });
      await writeJsonAtomic(join(dist, 'export-report.json'), { schema_version: 1, format, source: indexPath, files: [target], object_editability: 'rasterized-image-only' });
      return [target];
    }
  } finally {
    await browser.close();
  }
  throw new Error(`Unsupported export format: ${format}`);
}

async function main(args) {
  const command = args[0];
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(HELP); return 0; }
  if (command === 'themes') {
    const catalog = await loadThemeCatalog('authoring');
    const includeAll = hasFlag(args, '--all');
    const styleRef = flag(args, '--style');
    if (styleRef) {
      const style = catalog.getStyle(styleRef);
      const rows = Object.entries(style.schemes).map(([id, scheme]) => ({
        kind: 'visual-scheme',
        ref: `${styleRef}/${id}`,
        id,
        label: scheme.label,
        summary: scheme.summary,
        roles: scheme.roles,
        preview_image: scheme.preview_image,
        title_treatment: scheme.title_treatment,
      }));
      console.log(JSON.stringify(rows, null, hasFlag(args, '--json') ? 0 : 2));
      return 0;
    }
    const rows = includeAll
      ? [
        ...catalog.list({ includeAll: true }).map((item) => ({ kind: 'style', ...item })),
        ...catalog.listArchitectures({ includeAll: true }).filter((item) => !catalog.catalog.architectures.find((arch) => arch.id === item.id)?.styles?.length).map((item) => ({ kind: 'architecture', id: item.id, label: item.label, summary: item.summary, status: item.status })),
      ]
      : catalog.list().map((item) => ({ kind: 'style', ...item }));
    console.log(JSON.stringify(rows, null, hasFlag(args, '--json') ? 0 : 2));
    return 0;
  }
  if (command === 'doctor') {
    const major = Number(process.versions.node.split('.')[0]);
    const variables = ['OPENAI_SUB_BASE_URL', 'OPENAI_SUB_KEY', 'OPENAI_SUB_IMAGE_MODEL', 'OPENAI_SUB_FALLBAK_BASE_URL', 'OPENAI_SUB_FALLBAK_KEY', 'OPENAI_SUB_FALLBAK_IMAGE_MODEL'];
    const configuration = Object.fromEntries(variables.map((name) => [name, Boolean(process.env[name])]));
    const report = { node: { version: process.versions.node, supported: major >= 20 }, imagegen: { provider: 'imagegen skill', built_in: 'host-dependent', cli_fallback_variables: configuration, setup: 'Set imagegen configuration locally; never paste keys into chat or project files.' } };
    console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2));
    return report.node.supported ? 0 : 1;
  }
  const root = resolve(args[1] ?? '.');
  if (command === 'migrate') { await migrateProject(root, args); return 0; }
  if (command === 'draft') {
    await mkdir(root, { recursive: true });
    const theme_ref = flag(args, '--theme', 'editorial/paper-magazine');
    const catalog_scope = flag(args, '--scope', flag(args, '--catalog-scope', 'authoring'));
    const catalog = await loadThemeCatalog(catalog_scope);
    const style = catalog.getStyle(theme_ref);
    const draft = createOutline(flag(args, '--title', 'AI 原生知识工作流'), { theme_ref, catalog_scope, visual_anchor_id: style.default_anchor_id });
    await writeJsonAtomic(join(root, 'outline_draft.json'), draft);
    await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(draft));
    console.log(join(root, 'outline_preview.html'));
    return 0;
  }
  if (command === 'approve') {
    const draft = await readJson(join(root, 'outline_draft.json'));
    if (draft.schema_version === 3) {
      const requested = flag(args, '--theme', draft.theme_ref);
      const catalog_scope = flag(args, '--scope', flag(args, '--catalog-scope', draft.catalog_scope ?? 'active'));
      const catalog = await loadThemeCatalog(catalog_scope);
      catalog.getStyle(requested);
      const deck = approveOutline(draft, { mode: IMAGEGEN_MODE, theme_ref: requested, themes: catalog, catalog_scope });
      await writeJsonAtomic(join(root, 'deck_spec.json'), deck);
      console.log(join(root, 'deck_spec.json'));
      return 0;
    }
    const themes = await loadThemes();
    const requested = flag(args, '--theme');
    const theme = themes[requested] ?? Object.values(themes).find((item) => item.aliases?.includes(requested));
    if (!theme) throw new Error(`Unknown image theme: ${requested ?? 'missing'}`);
    const deck = approveOutline(draft, { mode: IMAGEGEN_MODE, theme: theme.id });
    await writeJsonAtomic(join(root, 'deck_spec.json'), deck);
    console.log(join(root, 'deck_spec.json'));
    return 0;
  }
  if (command === 'prompts') {
    const deck = await readJson(join(root, 'deck_spec.json'));
    const theme = deck.schema_version === 3
      ? await loadThemeCatalog(deck.catalog_scope ?? 'active')
      : (await loadThemes())[deck.theme];
    if (!theme) throw new Error(`Unknown image theme: ${deck.theme_ref ?? deck.theme ?? 'missing'}`);
    const jobs = compileImageJobs(deck, theme, { model: flag(args, '--model', DEFAULT_MODEL), size: flag(args, '--size', DEFAULT_SIZE), quality: flag(args, '--quality', DEFAULT_QUALITY) });
    await mkdir(join(root, 'slides'), { recursive: true });
    await writeJsonAtomic(join(root, 'generation_manifest.json'), createGenerationManifest(deck, jobs));
    await writeJobs(root, jobs);
    console.log(`${jobs.length} image jobs prepared`);
    return 0;
  }
  if (command === 'review') { await markReview(root, args); return 0; }
  if (command === 'build') {
    const { deck, manifest } = await loadProject(root);
    const missing = manifest.slides.filter((slide) => !['generated', 'pass'].includes(slide.status));
    if (missing.length) throw new Error(`Missing generated slide images: ${missing.map((slide) => slide.id).join(', ')}`);
    await writeJsonAtomic(join(root, 'generation_manifest.json'), manifest);
    const output = resolve(flag(args, '--out', join(root, 'index.html')));
    await writeTextAtomic(output, renderImageDeck(deck, manifest));
    await writeJsonAtomic(join(root, 'storyweave-output.json'), createStoryweaveOutput(deck, manifest));
    console.log(output);
    return 0;
  }
  if (command === 'qa') {
    const draft = await readJson(join(root, 'outline_draft.json'));
    const { deck, manifest } = await loadProject(root);
    const outline = validateOutline(draft);
    const report = { schema_version: deck.schema_version === 3 ? 3 : 1, export_ready: false, mode: deck.mode, theme: deck.theme ?? deck.theme_ref, theme_ref: deck.theme_ref, catalog_scope: deck.catalog_scope, summary: { blocking: 0, warning: 0 }, findings: [] };
    if (!outline.valid) report.findings.push(...outline.errors.map((message) => ({ severity: 'blocking', code: 'outline.invalid', message })));
    const themeCatalog = deck.schema_version === 3 && manifest.schema_version === 3 ? await loadThemeCatalog(deck.catalog_scope ?? 'active') : null;
    const manifestCheck = validateManifest(manifest, deck, themeCatalog);
    report.findings.push(...manifestCheck.findings);
    for (const slide of manifest.slides ?? []) {
      const result = await inspectGeneratedImage(resolve(root, slide.output_path), slide.size);
      if (!result.valid) report.findings.push({ severity: 'blocking', code: result.code, slide_id: slide.id, message: result.message });
      if (result.warning) report.findings.push({ severity: 'warning', code: result.warning.code, slide_id: slide.id, message: result.warning.message });
    }
    if (!(await exists(join(root, 'index.html'))) || !(await exists(join(root, 'storyweave-output.json')))) report.findings.push({ severity: 'warning', code: 'build.missing', message: 'Run build after generated assets are available.' });
    report.summary.blocking = report.findings.filter((item) => item.severity === 'blocking').length;
    report.summary.warning = report.findings.filter((item) => item.severity === 'warning').length;
    report.export_ready = report.summary.blocking === 0;
    await writeJsonAtomic(join(root, 'qa_report.json'), report);
    console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2));
    return report.export_ready ? 0 : 2;
  }
  if (command === 'export') {
    const format = flag(args, '--format', 'html');
    if (!['html', 'png', 'pdf', 'pptx'].includes(format)) throw new Error(`Unsupported export format: ${format}`);
    const files = await exportProject(root, format);
    console.log(JSON.stringify({ format, files }, null, 2));
    return 0;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  const code = await main(process.argv.slice(2));
  if (typeof code === 'number') process.exitCode = code;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
