#!/usr/bin/env node
import { createRequire } from 'node:module';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { bentoStatus, resolveBentoShell, updateBento } from './bento-update.mjs';
import { buildBentoDocument, imageDataUri, parseBentoDocument, spliceBentoDocument, validateOutputManifest } from './bento.mjs';

const require = createRequire(import.meta.url);
const skillRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HELP = `storyweave-express

Commands:
  build <producer-project> [--out presentation.bento.html] [--no-bento-update]
  qa <producer-project> [--file presentation.bento.html] [--json]
  bento status|update [--force] [--json]
  doctor [--json]

Consumes storyweave-output.json from storyweave-html or storyweave-imagegen.
`;

function flag(args, name, fallback = undefined) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }
function hasFlag(args, name) { return args.includes(name); }
async function exists(path) { return access(path).then(() => true, () => false); }
async function optional(name) { try { return await import(name); } catch { try { return require(name); } catch { return null; } } }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

async function rasterizeHtml(root, manifest) {
  const loaded = await optional('playwright');
  if (!loaded) throw new Error('Playwright is required to package HTML slides for Bento.');
  const chromium = loaded.chromium ?? loaded.default?.chromium;
  const browser = await chromium.launch({ headless: true });
  const cache = join(root, '.storyweave-express');
  await mkdir(cache, { recursive: true });
  const paths = [];
  try {
    const page = await browser.newPage({ viewport: manifest.canvas, deviceScaleFactor: 2 });
    for (const slide of manifest.slides) {
      const source = resolve(root, slide.source);
      if (!(await exists(source))) throw new Error(`Missing HTML slide: ${slide.source}`);
      await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts?.ready);
      const target = join(cache, `${slide.id}.png`);
      await page.screenshot({ path: target });
      paths.push(target);
    }
  } finally { await browser.close(); }
  return paths;
}

async function resolveImages(root, manifest) {
  const paths = manifest.kind === 'html' ? await rasterizeHtml(root, manifest) : manifest.slides.map((slide) => resolve(root, slide.source));
  for (const path of paths) if (!(await exists(path))) throw new Error(`Missing slide asset: ${path}`);
  return Promise.all(paths.map(imageDataUri));
}

async function build(root, args) {
  const manifest = await readJson(join(root, 'storyweave-output.json'));
  const validation = validateOutputManifest(manifest);
  if (!validation.valid) throw new Error(validation.findings.map((item) => item.message).join(' '));
  const output = resolve(flag(args, '--out', join(root, 'dist', `${String(manifest.title ?? 'presentation').replace(/[^\p{L}\p{N}_-]+/gu, '-')}.bento.html`)));
  const shellInfo = await resolveBentoShell({ skillRoot, update: hasFlag(args, '--no-bento-update') ? 'off' : 'auto', force: hasFlag(args, '--force-bento-update') });
  const shell = await readFile(shellInfo.path, 'utf8');
  let previous = null;
  if (await exists(output)) { try { previous = parseBentoDocument(await readFile(output, 'utf8')); } catch {} }
  const images = await resolveImages(root, manifest);
  const document = buildBentoDocument(manifest, images, previous);
  document.meta.bento_runtime = { source: shellInfo.source, sha256: shellInfo.sha256, release_tag: shellInfo.release_tag ?? null };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, spliceBentoDocument(shell, document, previous), 'utf8');
  return { output, manifest, document };
}

async function qa(root, args) {
  const manifest = await readJson(join(root, 'storyweave-output.json'));
  const findings = [...validateOutputManifest(manifest).findings];
  const defaultPath = join(root, 'dist', `${String(manifest.title ?? 'presentation').replace(/[^\p{L}\p{N}_-]+/gu, '-')}.bento.html`);
  const output = resolve(flag(args, '--file', defaultPath));
  if (!(await exists(output))) findings.push({ severity: 'blocking', code: 'bento.missing', message: 'Build the Bento presentation first.' });
  else {
    try {
      const document = parseBentoDocument(await readFile(output, 'utf8'));
      if (document.slides.length !== manifest.slides.length) findings.push({ severity: 'blocking', code: 'bento.slide_count', message: 'Bento slide count differs from source manifest.' });
      for (const slide of document.slides) if (slide.elements?.length !== 1 || slide.elements[0]?.type !== 'image') findings.push({ severity: 'blocking', code: 'bento.slide_shape', slide_id: slide.id, message: 'Express slides must contain one full-page image.' });
    } catch (error) { findings.push({ severity: 'blocking', code: 'bento.invalid', message: error.message }); }
  }
  const summary = { blocking: findings.filter((item) => item.severity === 'blocking').length, warning: findings.filter((item) => item.severity === 'warning').length };
  return { schema_version: 1, adapter: 'storyweave-express', source_producer: manifest.producer, export_ready: summary.blocking === 0, summary, findings };
}

async function main(args) {
  const command = args[0];
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(HELP); return 0; }
  if (command === 'bento') { const action = args[1] ?? 'status'; const result = action === 'update' ? await updateBento({ force: hasFlag(args, '--force') }) : await bentoStatus({ skillRoot }); console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2)); return 0; }
  if (command === 'doctor') { const status = await bentoStatus({ skillRoot }); const report = { node: { version: process.versions.node, supported: Number(process.versions.node.split('.')[0]) >= 20 }, bento: { bundled: Boolean(status.bundled), format: 'bento/slides' }, html_adapter: { playwright: Boolean(await optional('playwright')) } }; console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.node.supported && report.bento.bundled ? 0 : 1; }
  const root = resolve(args[1] ?? '.');
  if (command === 'build') { const result = await build(root, args); console.log(result.output); return 0; }
  if (command === 'qa') { const report = await qa(root, args); console.log(JSON.stringify(report, null, hasFlag(args, '--json') ? 0 : 2)); return report.export_ready ? 0 : 2; }
  throw new Error(`Unknown command: ${command}`);
}

try { const code = await main(process.argv.slice(2)); if (typeof code === 'number') process.exitCode = code; }
catch (error) { console.error(error.message); process.exitCode = 1; }
