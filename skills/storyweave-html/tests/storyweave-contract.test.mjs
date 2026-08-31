import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide, validateHtmlManifest } from '../scripts/lib/html.mjs';
import { approveOutline, createOutline, validateOutline } from '../scripts/lib/outline.mjs';
import { openThemeCatalog, resolveTheme } from '../scripts/lib/themes.mjs';

const run = promisify(execFile);
const cli = new URL('../scripts/ppt.mjs', import.meta.url);

test('Skill contract is standalone HTML with no presentation adapter dependency', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  const metadata = await readFile(new URL('../agents/openai.yaml', import.meta.url), 'utf8');
  assert.match(skill, /name: storyweave-html/);
  assert.match(skill, /完整的 16:9 HTML 页面/);
  assert.doesNotMatch(skill, /Bento/i);
  assert.match(metadata, /standalone editable HTML/);
});

test('renderer creates a deck and independently openable slide pages', () => {
  const draft = createOutline('HTML 测试');
  const deck = approveOutline(draft, { mode: 'html', theme: 'editorial' });
  const theme = resolveTheme('editorial');
  const html = renderHtmlDeck(deck, theme);
  const page = renderHtmlSlide(deck, deck.slides[0], 0, theme);
  assert.match(html, /data-storyweave-slide/);
  assert.match(page, /data-slide-id="s01"/);
  assert.doesNotMatch(html, /application\/bento\+json/);
  assert.doesNotMatch(page, /imagegen/i);
});

test('canonical renderer emits a fixed stage and render recipe metadata', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  const draft = createOutline('Canonical stage', { theme_ref: 'systems/white-cyan-circuit' });
  const deck = approveOutline(draft, { mode: 'html', themes: catalog });
  const theme = resolveTheme(deck.theme_ref, { catalog });
  const html = renderHtmlDeck(deck, theme);
  assert.match(html, /class="stage-viewport"/);
  assert.match(html, /width:1280px;height:720px/);
  assert.match(html, /data-render-recipe-ref="systems\/white-cyan-circuit\/render-/);
  assert.match(html, /data-reading-mode="speaker-led"/);
  assert.match(html, /data-page-rhythm="anchor"/);
});

test('renderer maps an asset slot to a relative image without changing page text', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  const draft = createOutline('Asset slot', { theme_ref: 'editorial/paper-magazine' });
  draft.slides[0].asset_refs = [{ asset_id: 'hero-asset', slot: 'hero', fit: 'contain', crop: 'no-crop', alt: '示例图片', caption: '来源说明' }];
  const deck = approveOutline(draft, { mode: 'html', themes: catalog });
  const theme = resolveTheme(deck.theme_ref, { catalog });
  const page = renderHtmlSlide(deck, deck.slides[0], 0, theme, { assets: new Map([['hero-asset', { id: 'hero-asset', path: 'media/hero.png' }]]) });
  assert.match(page, /src="\.\.\/media\/hero\.png"/);
  assert.match(page, /data-storyweave-asset-slot="hero"/);
  assert.match(page, /object-fit:contain/);
  assert.match(page, /示例图片/);
});

test('producer manifest is adapter-neutral and points to complete HTML pages', () => {
  const deck = approveOutline(createOutline(), { mode: 'html', theme: 'editorial' });
  const manifest = createHtmlManifest(deck);
  assert.equal(validateHtmlManifest(manifest).valid, true);
  assert.equal(manifest.format, 'storyweave/slides');
  assert.equal(manifest.kind, 'html');
  assert.equal(manifest.slides[0].source, 'slides/s01.html');
  assert.equal(JSON.stringify(manifest).toLowerCase().includes('bento'), false);
});

test('CLI builds standalone HTML and standard output manifest', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyweave-html-'));
  await run(process.execPath, [cli.pathname, 'draft', project, '--title', 'CLI 测试', '--reading-mode', 'reading-first']);
  const draft = JSON.parse(await readFile(join(project, 'outline_draft.json'), 'utf8'));
  assert.equal(draft.reading_mode, 'reading-first');
  await run(process.execPath, [cli.pathname, 'approve', project, '--theme', 'academic']);
  await run(process.execPath, [cli.pathname, 'build', project]);
  await access(join(project, 'index.html'));
  await access(join(project, 'slides', 's01.html'));
  const manifest = JSON.parse(await readFile(join(project, 'storyweave-output.json'), 'utf8'));
  assert.equal(manifest.producer, 'storyweave-html');
  assert.equal(manifest.slides.length, 6);
});

test('CLI produces three real theme previews from one canonical outline', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyweave-preview-'));
  await run(process.execPath, [cli.pathname, 'draft', project, '--theme-ref', 'editorial/paper-magazine']);
  const preview = await run(process.execPath, [cli.pathname, 'preview', project, '--json']);
  const result = JSON.parse(preview.stdout);
  assert.equal(result.files.length, 3);
  for (const file of result.files) await access(file.output);
});

test('outline rejects a page without exact visible text', () => {
  const outline = createOutline();
  outline.slides[0].exact_text = [];
  assert.equal(validateOutline(outline).valid, false);
});
