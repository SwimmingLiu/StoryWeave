import assert from 'node:assert/strict';
import test from 'node:test';

import { approveOutline, createOutline, migrateOutline, replanOutline, validateOutline } from '../scripts/lib/outline.mjs';
import { compileImageJobs, createGenerationManifest, IMAGEGEN_MODE, validateManifest } from '../scripts/lib/imagegen.mjs';
import { openThemeCatalog } from '../scripts/lib/themes.mjs';

const themeRoot = new URL('../assets/themes/', import.meta.url).pathname;

test('theme catalog exposes candidate styles only in authoring scope', async () => {
  const active = await openThemeCatalog(themeRoot, { scope: 'active' });
  const authoring = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  assert.deepEqual(active.list(), []);
  assert.deepEqual(authoring.list({ includeAll: true }).map((item) => item.ref), [
    'editorial/paper-magazine',
    'systems/white-cyan-circuit',
    'campaign/bold-poster',
    'cinematic/natural-film',
  ]);
  assert.throws(() => active.getStyle('systems/white-cyan-circuit'), (error) => error.code === 'theme.inactive');
  assert.throws(() => authoring.getStyle('campaign/anything'), (error) => error.code === 'theme_ref.unknown');
});

test('all ten page roles resolve through each candidate style without mutating the slide', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  for (const theme_ref of [
    'editorial/paper-magazine',
    'systems/white-cyan-circuit',
    'campaign/bold-poster',
    'cinematic/natural-film',
  ]) {
    const outline = createOutline('角色覆盖', { theme_ref, catalog_scope: 'authoring' });
    for (const slide of outline.slides) {
      const before = structuredClone(slide);
      const plan = catalog.resolveVisualPlan({ phase: 'approve', theme_ref, slide });
      assert.match(plan.visual_scheme_ref, new RegExp(`^${theme_ref}/`));
      assert.notEqual(plan.visual_scheme_ref, 'auto');
      assert.deepEqual(slide, before);
    }
    assert.equal(validateOutline(outline).valid, true);
  }
});

test('resolver blocks planned themes, cross-style schemes and incompatible layouts', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  const slide = createOutline('兼容性', { theme_ref: 'systems/white-cyan-circuit', catalog_scope: 'authoring' }).slides[3];
  assert.throws(() => catalog.resolveVisualPlan({ phase: 'approve', theme_ref: 'campaign/anything', slide }), (error) => error.code === 'theme_ref.unknown' || error.code === 'theme.planned');
  assert.throws(() => catalog.resolveVisualPlan({ phase: 'approve', theme_ref: 'systems/white-cyan-circuit', slide: { ...slide, visual_scheme_ref: 'editorial/paper-magazine/editorial-diagram' } }), (error) => error.code === 'visual_scheme.cross_theme');
  assert.throws(() => catalog.resolveVisualPlan({ phase: 'approve', theme_ref: 'systems/white-cyan-circuit', slide: { ...slide, layout_plan: { ...slide.layout_plan, visual_zone: ['top-left'] } } }), (error) => error.code === 'layout.zone_overlap');
});

test('approve and prompt compilation persist resolved scheme and title treatment', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  const outline = createOutline('分层 Prompt', { theme_ref: 'systems/white-cyan-circuit', catalog_scope: 'authoring' });
  const deck = approveOutline(outline, { mode: IMAGEGEN_MODE, themes: catalog });
  assert.equal(deck.status, 'approved');
  assert.ok(deck.slides.every((slide) => slide.visual_scheme_ref !== 'auto'));
  const jobs = compileImageJobs(deck, catalog);
  assert.match(jobs[0].prompt, /Theme architecture:/);
  assert.match(jobs[0].prompt, /Theme style:/);
  assert.match(jobs[0].prompt, /Visual scheme:/);
  assert.match(jobs[0].prompt, /Title treatment:/);
  assert.match(jobs[0].prompt, /exact-text-in-image|verbatim/);
  assert.doesNotMatch(jobs[0].prompt, /preview_image|preview_image|代表图/);
  const manifest = createGenerationManifest(deck, jobs);
  assert.equal(manifest.schema_version, 3);
  assert.match(manifest.theme_recipe_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.deck_spec_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.slides[0].visual_scheme_sha256, /^[a-f0-9]{64}$/);
  const pending = validateManifest(manifest, deck, catalog);
  assert.equal(pending.valid, false);
  const stale = structuredClone(manifest);
  stale.theme_recipe_sha256 = '0'.repeat(64);
  const staleCheck = validateManifest(stale, deck, catalog);
  assert.ok(staleCheck.findings.some((item) => item.code === 'manifest.recipe_stale'));
});

test('theme switching preserves content and discards compiled visual decisions', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  const source = createOutline('主题切换', { theme_ref: 'editorial/paper-magazine', catalog_scope: 'authoring' });
  source.slides[0].speaker_notes = '保留讲稿';
  const next = replanOutline(source, { theme_ref: 'systems/white-cyan-circuit', themes: catalog });
  assert.equal(next.status, 'draft');
  assert.equal(next.theme_ref, 'systems/white-cyan-circuit');
  assert.equal(next.slides[0].claim, source.slides[0].claim);
  assert.deepEqual(next.slides[0].exact_text, source.slides[0].exact_text);
  assert.equal(next.slides[0].speaker_notes, '保留讲稿');
  assert.equal(next.slides[0].visual_scheme_ref, 'auto');
  assert.equal(validateOutline(next).valid, true);
});

test('campaign and cinematic candidate styles resolve their representative schemes', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  const campaign = createOutline('传播案例', { theme_ref: 'campaign/bold-poster', catalog_scope: 'authoring' });
  const cinematic = createOutline('影像案例', { theme_ref: 'cinematic/natural-film', catalog_scope: 'authoring' });
  const campaignPlan = catalog.resolveVisualPlan({ phase: 'approve', theme_ref: campaign.theme_ref, slide: campaign.slides[0] });
  const cinematicPlan = catalog.resolveVisualPlan({ phase: 'approve', theme_ref: cinematic.theme_ref, slide: cinematic.slides[0] });
  assert.equal(campaignPlan.visual_scheme_ref, 'campaign/bold-poster/poster-claim');
  assert.equal(cinematicPlan.visual_scheme_ref, 'cinematic/natural-film/film-opening');
  assert.equal(validateOutline(campaign).valid, true);
  assert.equal(validateOutline(cinematic).valid, true);
});

test('v2 migration maps only deterministic legacy themes and requires language', async () => {
  const catalog = await openThemeCatalog(themeRoot, { scope: 'authoring' });
  const v2 = { ...createOutline('旧项目'), schema_version: 2, theme: 'editorial' };
  delete v2.catalog_scope;
  delete v2.language;
  delete v2.canvas;
  delete v2.theme_ref;
  v2.slides = v2.slides.map((slide) => {
    const next = { ...slide, layout_plan: { text_safe_zone: 'left', visual_zone: 'right', hierarchy: 'headline', density: 'low' } };
    delete next.visual_scheme_ref;
    delete next.visual_anchor_id;
    delete next.continuity_group;
    return next;
  });
  assert.throws(() => migrateOutline(v2, { themes: catalog }), /语言标签/);
  const migrated = migrateOutline(v2, { themes: catalog, language: 'zh-CN' });
  assert.equal(migrated.schema_version, 3);
  assert.equal(migrated.theme_ref, 'editorial/paper-magazine');
  assert.equal(migrated.status, 'draft');
  assert.ok(migrated.slides.every((slide) => slide.visual_scheme_ref === 'auto'));
  assert.throws(() => migrateOutline({ ...v2, theme: 'launch-tech' }, { themes: catalog, language: 'zh-CN' }), /没有确定的 v3 映射/);
});
