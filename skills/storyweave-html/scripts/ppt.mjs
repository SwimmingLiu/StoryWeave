#!/usr/bin/env node
import { createRequire } from 'node:module';
import { access, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { approveOutline, createOutline, renderOutlinePreview, validateOutline } from './lib/outline.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide, validateHtmlManifest } from './lib/html.mjs';
import { THEMES, resolveTheme } from './lib/themes.mjs';
import { writeJsonAtomic, writeTextAtomic } from './lib/storage.mjs';

const require = createRequire(import.meta.url);
const HELP = `storyweave-html

Commands:
  draft <dir> [--title text]
  themes [--json]
  approve <dir> --theme theme-id
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

async function buildProject(root, args) {
  const deck = await readJson(join(root, 'deck_spec.json'));
  if (deck.mode !== 'html') throw new Error('storyweave-html only builds HTML decks.');
  const theme = resolveTheme(deck.theme);
  const output = resolve(flag(args, '--out', join(root, 'index.html')));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(join(root, 'slides'), { recursive: true });
  await writeTextAtomic(output, renderHtmlDeck(deck, theme));
  for (const [index, slide] of deck.slides.entries()) await writeTextAtomic(join(root, 'slides', `${slide.id}.html`), renderHtmlSlide(deck, slide, index, theme));
  const manifest = createHtmlManifest(deck);
  await writeJsonAtomic(join(root, 'storyweave-output.json'), manifest);
  await writeJsonAtomic(join(root, 'generation_manifest.json'), {
    schema_version: 1, producer: manifest.producer, mode: 'html', theme: theme.id,
    slides: manifest.slides.map((slide) => ({ id: slide.id, role: slide.role, output_path: slide.source, status: 'pass', asset_role: 'complete-html-page', text_policy: 'native-html-text' })),
  });
  return { output, manifest };
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
    const page = await browser.newPage({ viewport: manifest.canvas });
    await mkdir(join(root, 'qa', 'screenshots'), { recursive: true });
    for (const slide of manifest.slides) {
      await page.goto(pathToFileURL(resolve(root, slide.source)).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts?.ready);
      const state = await page.evaluate(() => ({ count: document.querySelectorAll('[data-storyweave-slide]').length, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight }));
      if (state.count !== 1) findings.push({ severity: 'blocking', code: 'browser.slide_count', slide_id: slide.id, message: 'Standalone page must contain exactly one slide.' });
      if (state.overflow) findings.push({ severity: 'warning', code: 'browser.overflow', slide_id: slide.id, message: 'Page overflows the fixed canvas.' });
      const screenshot = join(root, 'qa', 'screenshots', `${slide.id}.png`);
      await page.screenshot({ path: screenshot });
      screenshots.push(screenshot);
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
  if (command === 'doctor') { const report = { node: { version: process.versions.node, supported: Number(process.versions.node.split('.')[0]) >= 20 }, output: { standalone_html: true } }; console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.node.supported ? 0 : 1; }
  if (command === 'themes') { console.log(JSON.stringify(Object.values(THEMES).map(({ id, label, use, aliases }) => ({ id, label, use, aliases })), null, hasFlag(args, '--json') ? 0 : 2)); return 0; }
  const root = resolve(args[1] ?? '.');
  if (command === 'draft') { await mkdir(root, { recursive: true }); const draft = createOutline(flag(args, '--title', 'AI 原生知识工作流')); await writeJsonAtomic(join(root, 'outline_draft.json'), draft); await writeTextAtomic(join(root, 'outline_preview.html'), renderOutlinePreview(draft)); console.log(join(root, 'outline_preview.html')); return 0; }
  if (command === 'approve') { const draft = await readJson(join(root, 'outline_draft.json')); const requested = flag(args, '--theme'); if (!requested || (!THEMES[requested] && !Object.values(THEMES).some((theme) => theme.aliases?.includes(requested)))) throw new Error('A known theme is required.'); const theme = resolveTheme(requested); const deck = approveOutline(draft, { mode: 'html', theme: theme.id }); await writeJsonAtomic(join(root, 'deck_spec.json'), deck); console.log(join(root, 'deck_spec.json')); return 0; }
  if (command === 'prompts') throw new Error('storyweave-html does not generate image prompts.');
  if (command === 'build' || command === 'render' || command === 'bundle') { const result = await buildProject(root, args); console.log(result.output); return 0; }
  if (command === 'qa') { const draft = await readJson(join(root, 'outline_draft.json')); const outline = validateOutline(draft); const manifest = await readJson(join(root, 'storyweave-output.json')); const contract = validateHtmlManifest(manifest); const visual = await reviewHtml(root, manifest); const findings = [...outline.errors.map((message) => ({ severity: 'blocking', code: 'outline.invalid', message })), ...contract.findings, ...visual.findings]; const summary = { blocking: findings.filter((item) => item.severity === 'blocking').length, warning: findings.filter((item) => item.severity === 'warning').length, degraded: findings.filter((item) => item.severity === 'degraded').length }; const report = { schema_version: 1, producer: 'storyweave-html', export_ready: summary.blocking === 0, summary, visual_review: visual.mode, findings }; await writeJsonAtomic(join(root, 'qa_report.json'), report); console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.export_ready ? 0 : 2; }
  if (command === 'export') { const format = flag(args, '--format', 'html'); if (!['html', 'png', 'pdf', 'pptx'].includes(format)) throw new Error(`Unsupported export format: ${format}`); const files = await exportProject(root, format); console.log(JSON.stringify({ format, files }, null, 2)); return 0; }
  throw new Error(`Unknown command: ${command}`);
}

try { const code = await main(process.argv.slice(2)); if (typeof code === 'number') process.exitCode = code; }
catch (error) { console.error(error.message); process.exitCode = 1; }
