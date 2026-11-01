import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { optionalDependency } from '../../../src/core/resources.mjs';
import { approveContent } from '../../../src/core/content.mjs';
import { createHtmlPlan } from '../../../src/html/plan.mjs';
import { inspectHtmlProject } from '../../../src/html/qa.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide } from '../../../src/html/render.mjs';

test('Chinese title wrapping preserves short words and the exact approved title text', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-title-words-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const draft = JSON.parse(await readFile(new URL('../assets/content-v4.example.json', import.meta.url), 'utf8'));
  draft.slides = [draft.slides[1]];
  draft.page_count = 1;
  const content = approveContent(draft);
  const plan = await createHtmlPlan(content, { theme_ref: 'systems/ink-blue-grid' });
  const output = join(root, 'index.html');
  await writeFile(output, renderHtmlDeck(content, plan));
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  const browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(output).href);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h1').textContent(), content.slides[0].content.title);
  const word = page.locator('.title-word').filter({ hasText: '关系' });
  assert.equal(await word.count(), 1);
  assert.equal(await word.evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size; }), 1, 'A short Chinese word must stay on one line');
});

test('the public legacy v2 route keeps copy and visual regions separate in both viewports', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-v2-geometry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const execute = promisify(execFile);
  const cli = new URL('../scripts/ppt.mjs', import.meta.url).pathname;
  for (const args of [['draft', root, '--schema', '2'], ['approve', root, '--theme', 'editorial'], ['build', root]]) await execute(process.execPath, [cli, ...args]);
  const qa = JSON.parse((await execute(process.execPath, [cli, 'qa', root, '--json'])).stdout);
  assert.equal(qa.visual_review, 'browser');
  assert(qa.export_ready && qa.summary.blocking === 0 && qa.summary.degraded === 0);
});

test('a layout reference replans the image slot and nested theme previews retain local images', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-visual-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = new URL('../scripts/ppt.mjs', import.meta.url).pathname;
  const execute = promisify(execFile);
  const command = (...args) => execute(process.execPath, [cli, ...args]);
  await command('draft', root, '--theme-ref', 'systems/ink-blue-grid');
  const draft = JSON.parse(await readFile(join(root, 'outline_draft.json'), 'utf8'));
  draft.slides = [draft.slides[1]];
  draft.page_count = 1;
  draft.slides[0].asset_refs = [{ asset_id: 'local', slot: 'hero', path: 'local.svg', fit: 'contain' }];
  await writeFile(join(root, 'local.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="720"><rect width="1680" height="720" fill="#d4c7b2"/></svg>');
  await writeFile(join(root, 'outline_draft.json'), JSON.stringify(draft));
  const selection = join(root, 'selection.json');
  await writeFile(selection, JSON.stringify([{ case_id: 'acceptance', page_id: 'statement', purpose: 'layout', application: { field: 'layout_id', slide_id: 's02', value: 'statement' } }]));
  await command('approve', root, '--theme-ref', 'systems/ink-blue-grid', '--references', selection);
  const approved = await readFile(join(root, 'deck_spec.json'));
  const plan = JSON.parse(await readFile(join(root, 'plans/html.json'), 'utf8'));
  assert.equal(plan.slides[0].asset_slots[0].aspect_ratio, '4:3');
  await command('build', root);
  const qa = JSON.parse((await command('qa', root, '--json')).stdout);
  assert(qa.export_ready && qa.summary.blocking === 0);
  const previews = JSON.parse((await command('preview', root, '--out', join(root, 'nested/preview'), '--count', '1', '--json')).stdout);
  const playwright = await optionalDependency('playwright', 'storyweave-html');
  const browser = await (playwright.chromium ?? playwright.default?.chromium).launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(pathToFileURL(previews.files[0].output).href);
  const image = page.locator('.asset-figure img');
  await image.evaluate((element) => element.decode());
  assert(await image.evaluate((element) => element.naturalWidth === 1680));
  assert.deepEqual(await readFile(join(root, 'deck_spec.json')), approved);
});

test('browser rejects cramped titles, changed type weight and a crop that removes the bound subject', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-visual-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const draft = JSON.parse(await readFile(new URL('../assets/content-v4.example.json', import.meta.url), 'utf8'));
  draft.slides = [draft.slides[1], draft.slides[6]];
  draft.page_count = draft.slides.length;
  const content = approveContent(draft);
  const plan = await createHtmlPlan(content, { theme_ref: 'editorial/paper-magazine', assetRefs: {
    s07: [{ asset_id: 'subject', slot: 'hero', path: 'subject.svg', fit: 'cover', focal_point: { x: .5, y: .5 }, subject_safe_area: { x: .35, y: .35, width: .3, height: .3 } }],
  } });
  const manifest = createHtmlManifest(content, plan);
  await mkdir(join(root, 'slides'));
  await writeFile(join(root, 'subject.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="720"><rect x="588" y="252" width="504" height="216" fill="#25485a"/></svg>');
  const options = { assetBasePath: '..' };
  const pages = content.slides.map((slide, index) => renderHtmlSlide(content, slide, index, plan, options));
  await writeFile(join(root, 'index.html'), renderHtmlDeck(content, plan));
  for (const [index, slide] of manifest.slides.entries()) await writeFile(join(root, slide.source), pages[index]);
  const baseline = await inspectHtmlProject(root, manifest, content, plan);
  assert.equal(baseline.mode, 'browser', 'Real browser coverage is required');
  assert.deepEqual(baseline.findings, []);

  const damage = '.layout-statement .statement-copy{row-gap:0!important}h1{font-weight:900!important}.asset-figure img{aspect-ratio:1!important;object-position:0% 0%!important}';
  for (const [index, slide] of manifest.slides.entries()) await writeFile(join(root, slide.source), pages[index].replace('</style>', `${damage}</style>`));
  const rejected = await inspectHtmlProject(root, manifest, content, plan);
  for (const code of ['browser.title_gap', 'browser.title_typography', 'browser.asset_slot', 'browser.asset_crop', 'browser.bottom_safe_area']) {
    assert(rejected.findings.some((finding) => finding.code === code), `Missing observable rejection: ${code}`);
  }
  assert(rejected.findings.some((finding) => finding.viewport === 'mobile'), 'Portrait scaling must retain the same design-unit checks');
  assert.deepEqual(content.slides.map((slide) => slide.content), draft.slides.map((slide) => slide.content), 'The visual path must preserve authored facts');
});
