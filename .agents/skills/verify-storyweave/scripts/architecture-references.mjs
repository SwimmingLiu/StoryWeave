#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { buildGallery } from '../../../../scripts/build-architecture-reference-gallery.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const option = (name) => { const index = process.argv.indexOf(name); assert(index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `Missing ${name}`); return resolve(process.argv[index + 1]); };
const requestedOutput = option('--out');
const output = join(await realpath(dirname(requestedOutput)), basename(requestedOutput));
const cacheRoot = await realpath(option('--cache'));
const cacheBefore = await readFile(join(cacheRoot, 'cache.json'));
assert(output !== cacheRoot && !output.startsWith(`${cacheRoot}${sep}`) && !cacheRoot.startsWith(`${output}${sep}`), 'Evidence and input cache must not overlap');
// A missing summary did not establish ownership; exclusive creation protects incomplete runs and unrelated work from cleanup.
await mkdir(output);
const work = join(output, 'offline-viewer');
const catalog = JSON.parse(await readFile(join(repo, 'design-library/application-architecture-references/catalog.json'), 'utf8'));
const themeCatalog = JSON.parse(await readFile(join(repo, 'skills/storyweave-imagegen/assets/themes/catalog.json'), 'utf8'));
const styles = themeCatalog.architectures.flatMap((item) => item.styles);
const actions = [];
const save = (name, value) => writeFile(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
let browser;
let context;
let failure;
try {
  await buildGallery({ cacheRoot, output: work });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Embedded originals make large DOM snapshots redundant; retain actual actions and screenshots instead.
  await context.tracing.start({ screenshots: true, snapshots: false, sources: false });
  await context.route(/^https?:/u, (route) => route.abort());
  const page = await context.newPage();
  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(pathToFileURL(join(work, 'index.html')).href);
    for (const item of catalog.cases) for (const original of item.pages) {
      const card = page.locator(`[data-case="${item.id}"][data-page="${original.id}"]`);
      await card.scrollIntoViewIfNeeded();
      const picture = card.locator('[data-figure]');
      await picture.evaluate((image) => image.decode());
      const state = await picture.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight, displayed: image.getBoundingClientRect().width > 0 }));
      actions.push({ action: 'display-original', viewport: viewport.id, case_id: item.id, page_id: original.id, state });
      await save('actions.json', actions);
      assert.deepEqual([state.width, state.height], [original.width, original.height]);
      assert(state.displayed, `Original is hidden: ${item.id}`);
    }
    await page.getByRole('button', { name: '放大', exact: false }).first().click();
    assert(await page.getByRole('dialog').isVisible());
    await page.getByRole('dialog').locator('img').evaluate((image) => image.decode());
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    for (const target of ['html', 'imagegen']) {
      await page.getByRole('button', { name: target === 'html' ? 'HTML 架构讲解' : 'Imagegen 视觉参考', exact: true }).click();
      const visibleCases = await page.locator('article:visible').evaluateAll((cards) => [...new Set(cards.map((card) => card.dataset.case))]);
      assert.equal(visibleCases.length, catalog.cases.filter((item) => item.target === target).length);
    }
    // A mixed Imagegen subset hid the new originals among remote references; exercise the dedicated comparison filter too.
    await page.locator('[data-filter="generated"]').click();
    assert.equal(await page.locator('article:visible').count(), catalog.cases.filter((item) => item.kind === 'generated-example').length);
    await page.getByRole('searchbox', { name: '搜索架构案例' }).fill('__no_architecture_match__');
    assert.equal(await page.locator('article:visible').count(), 0);
    assert(await page.locator('[data-empty]').isVisible());
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: '全部案例', exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${viewport.id}.png`) });
    actions.push({ action: 'filters-zoom-and-empty-state', viewport: viewport.id, status: 'pass' });
    await save('actions.json', actions);
  }
  // The private embedded viewer cannot prove the shipped casebook is self-contained; open its actual local assets offline.
  const generated = catalog.cases.filter((item) => item.kind === 'generated-example');
  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(pathToFileURL(join(repo, 'skills/storyweave-imagegen/assets/application-architecture-references/generated-cases/index.html')).href);
    const selected = generated.filter((item) => item.curation.selected);
    assert.equal(await page.locator('article:visible').count(), selected.length);
    await page.screenshot({ path: join(output, `shortlist-${viewport.id}.png`), fullPage: true });
    // Start from the explicit user selection, then exercise a disposable export without changing the saved selection.
    assert.deepEqual((await page.locator('[data-pick]:checked').evaluateAll((inputs) => inputs.map((input) => input.value))).sort(), selected.map((item) => item.id).sort());
    for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck();
    assert(await page.locator('[data-export]').isDisabled());
    const firstPick = page.getByRole('checkbox').first();
    const firstId = await firstPick.getAttribute('value');
    await firstPick.check();
    await page.locator('[data-filter="selected"]').click();
    assert.equal(await page.locator('article:visible').count(), 1);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export]').click()]);
    const selectedFixture = join(output, `selection-fixture-${viewport.id}.json`);
    await download.saveAs(selectedFixture);
    assert.deepEqual(JSON.parse(await readFile(selectedFixture, 'utf8')).selected.map((item) => item.id), [firstId]);
    await firstPick.uncheck();
    assert(await page.locator('[data-empty]').isVisible());
    for (const family of new Set(generated.map((item) => item.curation.family))) {
      await page.getByRole('button', { name: family, exact: true }).click();
      assert.equal(await page.locator('article:visible').count(), generated.filter((item) => item.curation.family === family).length);
    }
    await page.locator('[data-filter="all"]').click();
    assert.equal(await page.locator('article:visible').count(), generated.length);
    actions.push({ action: 'shortlist-families-pick-and-export-fixture', viewport: viewport.id, status: 'pass' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Generated casebook overflows the viewport');
    for (const item of generated) {
      const card = page.locator(`[data-case="${item.id}"]`);
      await card.scrollIntoViewIfNeeded();
      const picture = card.locator('[data-figure]');
      await picture.evaluate((image) => image.decode());
      const state = await picture.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
      assert.deepEqual([state.width, state.height], [item.pages[0].width, item.pages[0].height]);
      await card.screenshot({ path: join(output, `generated-${viewport.id}-${item.id}.png`) });
      await card.locator('[data-zoom]').click();
      const dialog = page.getByRole('dialog');
      assert(await dialog.isVisible());
      await dialog.locator('img').evaluate((image) => image.decode());
      await page.keyboard.press('Escape');
      assert(!await dialog.isVisible());
      actions.push({ action: 'shipped-generated-display-and-zoom', viewport: viewport.id, case_id: item.id, state });
      await save('actions.json', actions);
    }
  }
  // The new recipes reuse selected architecture assets; verify those relative image paths through the actual theme gallery too.
  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(pathToFileURL(join(repo, 'skills/storyweave-imagegen/assets/examples/theme-previews/index.html')).href);
    assert.equal(await page.locator('article:visible').count(), styles.filter((style) => style.appearance === 'light').length);
    for (const style of styles.filter((entry) => entry.source_case)) {
      const card = page.locator(`#${style.ref.replace('/', '--')}`);
      await card.scrollIntoViewIfNeeded();
      const picture = card.locator('img');
      await picture.evaluate((image) => image.decode());
      const state = await picture.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
      const original = catalog.cases.find((entry) => entry.id === style.source_case).pages[0];
      assert.deepEqual([state.width, state.height], [original.width, original.height]);
      await card.screenshot({ path: join(output, `theme-${viewport.id}-${style.ref.replace('/', '--')}.png`) });
      actions.push({ action: 'selected-theme-preview', viewport: viewport.id, theme_ref: style.ref, state });
      await save('actions.json', actions);
    }
  }
  await page.getByRole('button', { name: /^全部主题/u }).click();
  assert.equal(await page.locator('article:visible').count(), styles.length);
  await page.getByRole('button', { name: /^深色备选/u }).click();
  assert.equal(await page.locator('article:visible').count(), styles.filter((style) => style.appearance === 'dark').length);
  await page.goto(`${pathToFileURL(join(repo, 'skills/storyweave-imagegen/assets/examples/theme-previews/index.html')).href}#systems--black-gold`);
  await page.locator('#systems--black-gold').waitFor({ state: 'visible' });
  assert(await page.locator('#systems--black-gold').isVisible(), 'An explicitly selected dark theme must remain reachable');
  actions.push({ action: 'light-default-and-explicit-dark-selection', status: 'pass' });
  await save('actions.json', actions);
  await buildGallery({ check: true, cacheRoot, output: work });
  assert.deepEqual(await readFile(join(cacheRoot, 'cache.json')), cacheBefore, 'Do not modify the supplied image cache');
} catch (error) {
  failure = error;
  await save('failure.json', { message: error.message });
} finally {
  if (context) await context.tracing.stop({ path: join(output, 'trace.zip') }).catch(() => {});
  if (browser) await browser.close();
  // Private embedded originals are transient inputs; retain reports and browser evidence, not the offline payload.
  await rm(work, { recursive: true, force: true });
  await save('summary.json', { status: failure ? 'fail' : 'pass', cases: catalog.cases.length, viewports: ['desktop', 'mobile'], actions: actions.length, input_cache_sha256: createHash('sha256').update(cacheBefore).digest('hex'), paid_generation: 'not-run', aesthetic_acceptance: 'not-inferred-from-browser-QA', offline_payload_removed: true });
}
if (failure) throw failure;
console.log(JSON.stringify({ status: 'pass', cases: catalog.cases.length, evidence: output }));
