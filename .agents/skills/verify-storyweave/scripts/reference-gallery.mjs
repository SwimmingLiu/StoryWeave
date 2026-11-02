#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, cp, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const save = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function snapshot(proof, page, name, action, expected) {
  const state = await page.evaluate(() => ({
    status: document.querySelector('[role="status"]').textContent,
    category: document.querySelector('[data-filter][aria-pressed="true"]').dataset.filter,
    role: document.querySelector('[data-role][aria-pressed="true"]').dataset.role,
    query: document.querySelector('input').value,
    empty: !document.querySelector('.empty').hidden,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    styles: [...document.querySelectorAll('article')].filter((card) => !card.hidden).map((card) => ({
      id: card.id,
      pages: [...card.querySelectorAll('[data-page]')].filter((item) => !item.hidden).map((item) => item.dataset.page),
      open: [...card.querySelectorAll('[data-page]')].filter((item) => !item.hidden && item.open).map((item) => item.dataset.page),
    })),
  }));
  await page.screenshot({ path: join(proof.directory, `${name}.png`), animations: 'disabled' });
  proof.actions.push({ action, expected, state, screenshot: `${name}.png` });
  await save(join(proof.directory, 'actions.json'), proof.actions);
  assert.deepEqual(state.styles, expected, action);
  const count = expected.reduce((total, style) => total + style.pages.length, 0);
  assert.equal(state.status, `显示 ${expected.length} 种风格 · ${count} 张内容页`);
  assert.equal(state.empty, expected.length === 0);
  assert(!state.overflow, 'Gallery must fit the viewport horizontally');
}

async function observeGallery(proof, services, catalog, offline, cache) {
  const sorted = [...catalog.cases].sort((a, b) => Number(b.technical_priority) - Number(a.technical_priority));
  const expected = (category = 'all', role = 'all', query = '') => sorted.filter((item) => {
    const search = [item.id, item.title, item.description, item.creator, item.presentation_fit, ...item.pages.map((page) => page.title)].join(' ').toLowerCase();
    return (category === 'all' || item.category === category) && search.includes(query.toLowerCase());
  }).map((item) => ({ id: item.id, pages: item.pages.filter((page) => role === 'all' || page.roles.includes(role)).map((page) => page.id) }))
    .filter((item) => item.pages.length).map((item) => ({ ...item, open: item.pages.slice(0, 1) }));
  await services.withBrowser(proof, async (page) => {
    // A fresh offline context proves embedded content without relying on the browser's HTTP cache.
    // Bounded waits let withBrowser close its own browser when an image or UI state never arrives.
    page.setDefaultTimeout(15000);
    await page.context().setOffline(true);
    for (const [viewport, size] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      await page.goto(pathToFileURL(join(offline, 'index.html')).href);
      await page.locator('article').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('article [data-page]:first-child img')]
        .every((image) => image.complete && image.naturalWidth > 0));
      await snapshot(proof, page, `${viewport}-initial`, 'Open offline gallery with network disabled', expected());
      const decoded = [];
      for (const style of sorted) for (const item of style.pages) {
        const detail = page.locator(`#${style.id} [data-page="${item.id}"]`);
        if (!(await detail.evaluate((element) => element.open))) await detail.locator('summary').click();
        const picture = detail.locator('img');
        await picture.scrollIntoViewIfNeeded();
        await picture.evaluate(async (image) => { await image.decode(); });
        const state = await picture.evaluate((image) => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight,
          loading: image.loading, frame: image.closest('[data-image-frame]').dataset.state,
          rect: { width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height } }));
        const filename = `${viewport}-${style.id}-${item.id}.png`;
        await detail.screenshot({ path: join(proof.directory, filename), animations: 'disabled' });
        proof.actions.push({ action: 'Expand and decode actual content page offline', id: `${style.id}/${item.id}`, state, screenshot: filename });
        await save(join(proof.directory, 'actions.json'), proof.actions);
        assert(state.complete && state.width === item.width && state.height === item.height && state.frame === 'ready');
        assert.equal(state.loading, 'eager');
        assert(state.rect.width > 100 && Math.abs(state.rect.width / state.rect.height - 16 / 9) < 0.04);
        decoded.push(`${style.id}/${item.id}`);
      }
      await save(join(proof.directory, `${viewport}-decoded.json`), decoded);
      const select = async (category, role, query, name) => {
        await page.locator(`[data-filter="${category}"]`).click();
        await page.locator(`[data-role="${role}"]`).click();
        await page.getByRole('searchbox', { name: '搜索主题' }).fill(query);
        await snapshot(proof, page, `${viewport}-${name}`, `Select ${category}/${role}; search ${query}`, expected(category, role, query));
      };
      for (const role of catalog.roles) await select('all', role.id, '', `role-${role.id}`);
      for (const category of catalog.categories) await select(category.id, 'all', '', `category-${category.id}`);
      const combination = catalog.categories.find((category) => sorted.some((item) => item.category === category.id && item.pages.some((entry) => entry.roles.includes('data'))));
      await select(combination.id, 'data', '', 'category-and-data');
      const searchable = sorted.find((item) => item.pages.length > 1);
      await select('all', 'all', searchable.pages[1].title, 'page-content-search');
      await select('all', 'data', 'verification-no-such-reference-7f4a', 'empty');
      await select('all', 'all', '', 'reset');
      const first = page.locator('article').first().locator('[data-page]').first();
      await first.locator('.image-open').click();
      const dialog = page.getByRole('dialog', { name: '参考图大图' });
      await dialog.waitFor({ state: 'visible' });
      // Several references share dimensions; matching width alone would accept the wrong zoom image.
      const zoom = await dialog.locator('img').evaluate(async (image) => {
        await image.decode();
        const clicked = document.querySelector('article [data-page] .image-open img');
        return { width: image.naturalWidth, height: image.naturalHeight, alt: image.alt,
          same_source: image.currentSrc === clicked.currentSrc, same_alt: image.alt === clicked.alt };
      });
      zoom.source_sha256 = hash(await first.locator('img').getAttribute('src'));
      await page.screenshot({ path: join(proof.directory, `${viewport}-zoom.png`) });
      proof.actions.push({ action: 'Open zoom through image button', state: zoom, screenshot: `${viewport}-zoom.png` });
      assert.equal(zoom.width, sorted[0].pages[0].width);
      assert.equal(zoom.height, sorted[0].pages[0].height);
      assert(zoom.same_source && zoom.same_alt, 'Zoom must show the image the user clicked');
      await dialog.locator('[data-close]').click();
      await dialog.waitFor({ state: 'hidden' });
      await first.locator('.image-open').click();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      proof.actions.push({ action: 'Close zoom using close button and Escape', state: { dialog_visible: false } });
      await save(join(proof.directory, 'actions.json'), proof.actions);
    }
    assert.deepEqual(proof.network_requests, [], 'Offline gallery must not issue HTTP requests');
    proof.entry_points.push('offline gallery desktop/mobile', 'all images expanded and decoded offline', 'category/role/search combination and empty reset', 'zoom close and Escape');
  });

  await services.withBrowser(proof, async (page) => {
    page.setDefaultTimeout(15000);
    const pages = sorted.flatMap((item) => item.pages);
    const first = pages[0];
    let attempts = 0;
    const boundary = [];
    proof.expected_image_failures = [first.url];
    // Replace only the existing external image boundary; the page and retry UI remain production code.
    await page.context().route('https://**/*', async (route) => {
      const url = route.request().url();
      const record = cache.images[url];
      boundary.push({ url, action: url === first.url && attempts === 0 ? 'abort-first-image' : 'fulfill-verified-cache' });
      // Eager requests run concurrently; persist their collected log only from the serial driver below.
      assert(record, `Unexpected network resource: ${url}`);
      if (url === first.url && ++attempts === 1) return route.abort('failed');
      await route.fulfill({ path: join(services.cache, record.path), contentType: record.mime });
    });
    await page.goto(pathToFileURL(join(services.repo, 'skills/storyweave-imagegen/assets/reference-library/index.html')).href);
    const frame = page.locator('article').first().locator('[data-image-frame]').first();
    await page.waitForFunction(() => document.querySelector('[data-image-frame]').dataset.state === 'error');
    await save(join(proof.directory, 'image-boundary.json'), boundary);
    await frame.locator('[data-retry]').waitFor({ state: 'visible' });
    await page.screenshot({ path: join(proof.directory, 'image-error.png') });
    proof.actions.push({ action: 'Abort one external image request', state: { image_state: await frame.getAttribute('data-state'), attempts }, screenshot: 'image-error.png' });
    await save(join(proof.directory, 'actions.json'), proof.actions);
    await frame.locator('[data-retry]').click();
    await page.waitForFunction(() => document.querySelector('[data-image-frame]').dataset.state === 'ready');
    await save(join(proof.directory, 'image-boundary.json'), boundary);
    assert.equal(attempts, 2, 'Retry must issue another image request');
    await frame.locator('img').evaluate((image) => image.decode());
    await page.screenshot({ path: join(proof.directory, 'image-retry.png') });
    proof.actions.push({ action: 'Retry through the public button', state: { image_state: await frame.getAttribute('data-state'), attempts }, screenshot: 'image-retry.png' });
    await save(join(proof.directory, 'actions.json'), proof.actions);
    proof.entry_points.push('remote gallery external-image failure and retry');
    proof.limitations.push('Retry uses intercepted image requests with verified source bytes; live remote host availability is not verified.');
  });
}

export async function driveReferenceGallery(proof, services) {
  const { repo, command, program } = services;
  const builder = join(repo, 'scripts/build-presentation-reference-gallery.mjs');
  await command(proof, builder, ['--check']);
  const catalog = await json(join(repo, 'design-library/presentation-references/catalog.json'));
  const installed = join(proof.work, 'installed');
  await command(proof, join(repo, 'skills/storyweave-imagegen/install.mjs'), ['--dir', installed]);
  proof.entry_points.push('isolated Imagegen install reference assets');
  if (!services.cache || !isAbsolute(services.cache)) {
    const error = new Error('Supply --reference-cache with an absolute directory containing original images and cache.json; verification never downloads missing images.');
    error.code = 'reference.cache_missing';
    error.route = 'reference-gallery --reference-cache';
    throw error;
  }
  services.cache = await realpath(services.cache);
  await access(join(services.cache, 'cache.json'));
  const cache = await json(join(services.cache, 'cache.json'));
  const inputsBefore = {};
  for (const name of ['cache.json', ...Object.values(cache.images).map((record) => record.path)]) inputsBefore[name] = hash(await readFile(join(services.cache, name)));
  await program(proof, 'python3', [join(repo, 'scripts/cache-presentation-references.py'), '--cache', services.cache, '--check']);
  const offline = join(proof.work, 'offline');
  await command(proof, builder, ['--cache', services.cache, '--out', offline]);
  await command(proof, builder, ['--cache', services.cache, '--out', offline, '--check']);
  await program(proof, 'python3', [join(dirname(fileURLToPath(import.meta.url)), 'audit-reference-gallery.py'), '--repo', repo,
    '--cache', services.cache, '--offline', offline, '--installed', join(installed, 'storyweave-imagegen'), '--out', join(proof.directory, 'image-integrity.json')]);
  for (const [name, digest] of Object.entries(inputsBefore)) assert.equal(hash(await readFile(join(services.cache, name))), digest, 'Reference verification must preserve its input cache');
  await save(join(proof.directory, 'input-cache-hashes.json'), inputsBefore);
  await cp(offline, join(proof.directory, 'offline-viewer'), { recursive: true });
  proof.entry_points.push('distributed gallery check', 'read-only cache image decode', 'offline gallery build/check', 'embedded image bytes and role counts', 'installed lightweight reference hashes');
  proof.limitations.push('Image-byte checks do not establish browser visibility, visual design quality, provenance or license grants.');
  await observeGallery(proof, services, catalog, offline, cache);
}
