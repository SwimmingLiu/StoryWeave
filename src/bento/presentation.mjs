import { createHash } from 'node:crypto';
import { access, mkdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readVerifiedArtifact } from '../core/artifact.mjs';
import { optionalDependency, resolveSkillRoot } from '../core/resources.mjs';
import { writeJsonAtomic, writeTextAtomic } from '../core/storage.mjs';
import { buildBentoDocument, imageDataUri, parseBentoDocument, spliceBentoDocument } from './document.mjs';
import { readBentoShell, resolveBentoShell } from './shell.mjs';

const exists = (path) => access(path).then(() => true, () => false);
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const digest = (value) => createHash('sha256').update(value).digest('hex');
const slug = (value) => String(value ?? 'presentation').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'presentation';
export const defaultOutput = (root, manifest) => join(root, 'dist', `${slug(manifest.title)}.bento.html`);

async function protectProducerFiles(artifact, target) {
  const protectedPaths = ['storyweave-output.json', 'qa_report.json', ...artifact.binding.files.map((file) => file.path)];
  const protectedFiles = new Set(await Promise.all(protectedPaths.map((path) => realpath(resolve(artifact.root, path)))));
  const resolvedTarget = await realpath(target).catch((error) => { if (error.code === 'ENOENT') return resolve(target); throw error; });
  // --out used to overwrite index.html before the later stale-QA check could reject it.
  if (protectedFiles.has(resolvedTarget)) throw new Error('Bento output would overwrite a producer source or QA file. Choose a separate output path.');
}

async function pageImages(artifact) {
  const { root, manifest, binding } = artifact;
  if (manifest.kind === 'image') return manifest.slides.map((slide) => resolve(root, slide.source));
  const directory = join(root, '.storyweave-express');
  await mkdir(directory, { recursive: true });
  const indexPath = join(directory, 'cache.json');
  const previous = await exists(indexPath) ? await json(indexPath).catch(() => ({ pages: [] })) : { pages: [] };
  const resources = binding.files.filter((file) => file.role === 'input' && !/\.jsonl?$/u.test(file.path));
  const pages = [];
  let browser;
  try {
    for (const slide of manifest.slides) {
      const source = await readFile(resolve(root, slide.source));
      const key = digest(Buffer.concat([source, Buffer.from(JSON.stringify({ canvas: manifest.canvas, resources, rasterizer: 2 }))]));
      const path = join(directory, `${slide.id}-${key.slice(0, 20)}.png`);
      const cached = previous.pages?.find((item) => item.id === slide.id && item.key === key);
      if (!(cached && await exists(path) && digest(await readFile(path)) === cached.sha256)) {
        if (!browser) {
          const loaded = await optionalDependency('playwright', 'storyweave-express');
          if (!loaded) throw new Error('Playwright is required to package native HTML pages.');
          browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true });
        }
        const page = await browser.newPage({ viewport: manifest.canvas, deviceScaleFactor: 2, reducedMotion: 'reduce' });
        try {
          await page.goto(pathToFileURL(resolve(root, slide.source)).href, { waitUntil: 'load' });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
          });
          await page.screenshot({ path, animations: 'disabled' });
        } finally { await page.close(); }
      }
      pages.push({ id: slide.id, key, path, sha256: digest(await readFile(path)) });
    }
  } finally { await browser?.close(); }
  // Old screenshots were keyed only by page ID and could survive a source edit.
  await writeJsonAtomic(indexPath, { schema_version: 1, pages });
  return pages.map((page) => page.path);
}

export async function buildPresentation(project, { output, update = 'auto', forceUpdate = false } = {}) {
  const root = resolve(project);
  // Every entry point now attests the same producer files, including direct Express use.
  const artifact = await readVerifiedArtifact(root);
  const target = resolve(output ?? defaultOutput(root, artifact.manifest));
  await protectProducerFiles(artifact, target);
  const shellInfo = await resolveBentoShell({ skillRoot: resolveSkillRoot('storyweave-express'), update, force: forceUpdate });
  const loadedShell = await readBentoShell(shellInfo.path);
  // A compressed bundle must be restored and remain the bytes inspected before packaging.
  if (loadedShell.sha256 !== shellInfo.sha256) throw new Error('Bento shell changed after inspection. Retry packaging.');
  const shell = loadedShell.html;
  let previous = null;
  if (await exists(target)) previous = await readFile(target, 'utf8').then(parseBentoDocument).catch(() => null);
  const images = await Promise.all((await pageImages(artifact)).map(imageDataUri));
  const current = await readVerifiedArtifact(root);
  if (current.binding.fingerprint !== artifact.binding.fingerprint) throw new Error('Producer files changed while packaging; rerun producer QA.');
  const document = buildBentoDocument(artifact.manifest, images, previous);
  document.meta.source_artifact_fingerprint = artifact.binding.fingerprint;
  document.meta.bento_runtime = { source: shellInfo.source, sha256: shellInfo.sha256, release_tag: shellInfo.release_tag ?? null };
  await mkdir(dirname(target), { recursive: true });
  await writeTextAtomic(target, spliceBentoDocument(shell, document, previous));
  return { output: target, manifest: artifact.manifest, document };
}

export async function inspectPresentation(project, { output } = {}) {
  const root = resolve(project);
  const artifact = await readVerifiedArtifact(root);
  const target = resolve(output ?? defaultOutput(root, artifact.manifest));
  const findings = [];
  const issue = (code, message, slide_id) => findings.push({ severity: 'blocking', code, message, ...(slide_id ? { slide_id } : {}) });
  let document;
  let outputHash;
  let browser;
  const outputId = `${slug(basename(target, '.bento.html'))}-${digest(target).slice(0, 8)}`;
  const reportPath = join(root, 'qa', `${outputId}.adapter-report.json`);
  try {
    const bytes = await readFile(target);
    outputHash = digest(bytes);
    document = parseBentoDocument(bytes.toString('utf8'));
    if (document.meta?.source_artifact_fingerprint !== artifact.binding.fingerprint) issue('bento.stale', 'Bento was built from a different producer artifact.');
    if (document.slides.length !== artifact.manifest.slides.length) issue('bento.slide_count', 'Bento slide count differs from the producer.');
    const expectedImages = await Promise.all((await pageImages(artifact)).map(imageDataUri));
    for (const [index, slide] of document.slides.entries()) {
      const original = artifact.manifest.slides[index];
      const element = slide.elements?.[0];
      if (!original || slide.id !== original.id) issue('bento.order', 'Page IDs or order changed during packaging.', slide.id);
      if (slide.notes !== (original?.notes ?? original?.claim ?? '')) issue('bento.notes', 'Speaker notes differ from the producer.', slide.id);
      if (slide.elements?.length !== 1 || element?.type !== 'image' || element.x !== 0 || element.y !== 0 || element.w !== artifact.manifest.canvas.width || element.h !== artifact.manifest.canvas.height || element.opacity !== 1 || element.rotation !== 0 || element.fit !== 'fill' || element.radius !== 0) issue('bento.slide_shape', 'Each page must be exactly one opaque, unrotated, full-canvas image.', slide.id);
      if (element?.src !== expectedImages[index]) issue('bento.image_content', 'The displayed image differs from the producer page.', slide.id);
    }
    const loaded = await optionalDependency('playwright', 'storyweave-express');
    if (!loaded) findings.push({ severity: 'degraded', code: 'browser.unavailable', message: 'Playwright is required for final Bento display verification.' });
    else if (!findings.some((item) => item.severity === 'blocking')) {
      browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (error) => issue('browser.error', error.message));
      await page.goto(pathToFileURL(target).href, { waitUntil: 'load' });
      await page.getByRole('button', { name: 'Slideshow', exact: true }).waitFor({ state: 'visible' });
      const image = page.locator('.ed-stage .bento-slide .bento-el-image img');
      await image.waitFor({ state: 'visible' });
      await image.evaluate((node) => node.decode());
      if (await image.getAttribute('src') !== document.slides[0].elements[0].src) issue('browser.wrong_image', 'Bento does not display its first producer page.');
      const display = await image.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        let opacity = 1;
        for (let current = node; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
        return { opacity, width: rect.width, height: rect.height, inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight };
      });
      // Playwright visibility alone still accepts transparent or transformed images.
      if (display.opacity < 0.99 || display.width < 300 || Math.abs(display.width / display.height - 16 / 9) > 0.01 || !display.inViewport) issue('browser.image_bounds', 'The producer image must be opaque and fully visible on the Bento stage.');
      await mkdir(join(root, 'qa', outputId), { recursive: true });
      await page.screenshot({ path: join(root, 'qa', outputId, 'bento.png'), animations: 'disabled' });
      if (digest(await readFile(target)) !== outputHash) issue('bento.changed', 'Bento changed while it was inspected.');
    }
  } catch (error) { issue('bento.invalid', error.message); }
  finally { await browser?.close(); }
  const current = await readVerifiedArtifact(root);
  if (current.binding.fingerprint !== artifact.binding.fingerprint) issue('producer.changed', 'Producer files changed during adapter QA.');
  const summary = Object.fromEntries(['blocking', 'warning', 'degraded'].map((level) => [level, findings.filter((item) => item.severity === level).length]));
  const report = { schema_version: 1, adapter: 'storyweave-express', source_producer: artifact.manifest.producer, source_artifact_fingerprint: artifact.binding.fingerprint, output_sha256: outputHash, output: target, visual_review: summary.degraded ? 'degraded' : 'browser', export_ready: summary.blocking === 0 && summary.degraded === 0, summary, findings };
  // Adapter evidence has its own owner and cannot replace the producer's QA report.
  await mkdir(dirname(reportPath), { recursive: true });
  await writeJsonAtomic(reportPath, report);
  return { ...report, report_path: reportPath };
}

export async function packagePresentation(project, options = {}) {
  const built = await buildPresentation(project, options);
  const qa = await inspectPresentation(project, { output: built.output });
  if (!qa.export_ready) throw new Error(`Bento QA failed: ${qa.findings.map((item) => item.message).join(' ')}`);
  return { ...built, qa };
}
