import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { createHtmlManifest, renderHtmlDeck, validateHtmlManifest } from '../scripts/lib/html.mjs';
import { approveOutline, createOutline, migrateOutline, replanOutline, validateOutline } from '../scripts/lib/outline.mjs';
import { openThemeCatalog, PAGE_ROLES, requireTheme, resolveTheme, THEME_CONTRACT } from '../scripts/lib/themes.mjs';

const run = promisify(execFile);
const cli = new URL('../scripts/ppt.mjs', import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

test('shared theme contract copies are identical', async () => {
  const root = await json(new URL('../../../contracts/storyweave-theme/v1/contract.json', import.meta.url));
  const html = await json(new URL('../assets/themes/contract.json', import.meta.url));
  const imagegen = await json(new URL('../../storyweave-imagegen/assets/themes/contract.json', import.meta.url));
  assert.deepEqual(html, root);
  assert.deepEqual(imagegen, root);
  assert.equal(THEME_CONTRACT.contract_version, 1);
});

test('all active HTML styles resolve all ten page roles', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  assert.deepEqual(catalog.list().map((item) => item.ref), [
    'editorial/paper-magazine',
    'systems/white-cyan-circuit',
    'campaign/bold-poster',
    'cinematic/natural-film',
  ]);
  for (const style of catalog.list()) {
    for (const role of PAGE_ROLES) {
      const slide = { id: `${role}-slide`, role, visual_scheme_ref: 'auto' };
      const before = structuredClone(slide);
      const plan = catalog.resolveVisualPlan({ phase: 'approve', theme_ref: style.ref, slide });
      assert.match(plan.visual_scheme_ref, new RegExp(`^${style.ref}/`));
      assert.match(plan.theme_recipe_sha256, /^[a-f0-9]{64}$/);
      assert.match(plan.visual_scheme_sha256, /^[a-f0-9]{64}$/);
      assert.match(plan.render_recipe_ref, new RegExp(`^${style.ref}/render-`));
      assert.match(plan.render_recipe_sha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(slide, before);
    }
  }
});

test('legacy resolution is explicit and unknown themes never fall back', () => {
  assert.equal(resolveTheme('editorial').kind, 'legacy-compatible');
  assert.equal(resolveTheme('magazine').legacy_theme_id, 'editorial');
  assert.equal(resolveTheme('academic').kind, 'needs-selection');
  assert.equal(resolveTheme('editorial/paper-magazine').kind, 'canonical');
  assert.equal(resolveTheme('editoriall').kind, 'unknown');
  assert.throws(() => requireTheme('editoriall'), (error) => error.code === 'theme_ref.unknown');
});

test('resolver blocks cross-theme schemes and conflicting layout zones', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  assert.throws(() => catalog.resolveVisualPlan({ theme_ref: 'editorial/paper-magazine', slide: { id: 'x', role: 'cover', visual_scheme_ref: 'systems/white-cyan-circuit/hero' } }), (error) => error.code === 'visual_scheme.cross_theme');
  assert.throws(() => catalog.resolveVisualPlan({ theme_ref: 'editorial/paper-magazine', slide: { id: 'x', role: 'cover', visual_scheme_ref: 'auto', layout_plan: { text_safe_zone: 'left', visual_zone: ['left'], hierarchy: ['headline'], density: 'low' } } }), (error) => error.code === 'layout.zone_overlap');
});

test('v3 approval freezes schemes and manifest detects stale decks', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  const outline = createOutline('Canonical HTML', { theme_ref: 'systems/white-cyan-circuit' });
  const deck = approveOutline(outline, { mode: 'html', themes: catalog });
  const theme = requireTheme(deck.theme_ref, { catalog });
  assert.equal(validateOutline(deck, { approved: true }).valid, true);
  assert.ok(deck.slides.every((slide) => slide.visual_scheme_ref !== 'auto'));
  const html = renderHtmlDeck(deck, theme);
  assert.match(html, /data-theme-ref="systems\/white-cyan-circuit"/);
  assert.match(html, /scheme-columns/);
  assert.match(html, /scheme-flow/);
  const manifest = createHtmlManifest(deck, theme);
  assert.equal(validateHtmlManifest(manifest, deck).valid, true);
  assert.ok(deck.slides.every((slide) => slide.render_recipe_ref && slide.render_recipe_sha256));
  const changed = structuredClone(deck);
  changed.slides[0].claim = 'changed';
  assert.ok(validateHtmlManifest(manifest, changed).findings.some((item) => item.code === 'manifest.deck_stale'));
});

test('migration preserves content and requires a choice for ambiguous legacy themes', async () => {
  const catalog = await openThemeCatalog(null, { scope: 'active' });
  const source = createOutline('Legacy HTML');
  source.theme = 'editorial';
  source.slides[0].sources = [{ url: 'https://example.com' }];
  source.slides[0].speaker_notes = 'Keep this note';
  const migrated = migrateOutline(source, { themes: catalog });
  assert.equal(migrated.theme_ref, 'editorial/paper-magazine');
  assert.deepEqual(migrated.slides[0].exact_text, source.slides[0].exact_text);
  assert.deepEqual(migrated.slides[0].sources, source.slides[0].sources);
  assert.equal(migrated.slides[0].speaker_notes, source.slides[0].speaker_notes);
  assert.ok(migrated.slides.every((slide) => slide.visual_scheme_ref === 'auto'));
  const ambiguous = { ...source, theme: 'academic' };
  assert.throws(() => migrateOutline(ambiguous, { themes: catalog }), /显式选择/);
  assert.equal(migrateOutline(ambiguous, { theme_ref: 'editorial/paper-magazine', themes: catalog }).theme_ref, 'editorial/paper-magazine');
  const replanned = replanOutline(migrated, { theme_ref: 'campaign/bold-poster', themes: catalog });
  assert.equal(replanned.status, 'draft');
  assert.equal(replanned.slides[0].speaker_notes, 'Keep this note');
});

test('v3 CLI produces canonical standalone output and fingerprints', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyweave-html-v3-'));
  await run(process.execPath, [cli.pathname, 'draft', project, '--theme-ref', 'campaign/bold-poster']);
  await run(process.execPath, [cli.pathname, 'approve', project, '--theme-ref', 'campaign/bold-poster']);
  await run(process.execPath, [cli.pathname, 'build', project]);
  const manifest = JSON.parse(await readFile(join(project, 'storyweave-output.json'), 'utf8'));
  const page = await readFile(join(project, 'slides', 's01.html'), 'utf8');
  assert.equal(manifest.version, 2);
  assert.equal(manifest.theme_ref, 'campaign/bold-poster');
  assert.match(manifest.deck_spec_sha256, /^[a-f0-9]{64}$/);
  assert.match(page, /storyweave-theme-ref/);
  assert.match(page, /data-visual-scheme-ref="campaign\/bold-poster\/hero"/);
});
