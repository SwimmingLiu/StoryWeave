import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { hashBytes } from '../../../src/core/hash.mjs';
import { optionalDependency } from '../../../src/core/resources.mjs';
import { createHtmlPlan, validateHtmlPlan } from '../../../src/html/plan.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide, validateHtmlManifest } from '../../../src/html/render.mjs';
import { approveOutline, createOutline } from '../../../src/html/outline.mjs';
import { resolveTheme } from '../../../src/html/themes.mjs';

const run = promisify(execFile);
const cli = new URL('../scripts/ppt.mjs', import.meta.url);
const fixture = JSON.parse(await readFile(new URL('../../../tests/fixtures/visual/outline_v4.json', import.meta.url), 'utf8'));
const approved = () => approveContent(structuredClone(fixture));
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

test('structured content selects distinct comparison, process, metrics and graph page structures', async (t) => {
  const content = approved();
  const plan = await createHtmlPlan(content, { theme_ref: 'systems/ink-blue-grid' });
  assert.equal(validateHtmlPlan(content, plan).valid, true);
  assert.deepEqual(plan.slides.slice(2, 6).map((page) => page.layout_id), ['comparison-matrix', 'process-linear', 'metric-ledger', 'relationship-map']);
  const pages = content.slides.map((slide, index) => renderHtmlSlide(content, slide, index, plan));
  assert.match(pages[2], /<table class="comparison-matrix"/u);
  assert.match(pages[3], /<ol class="process-rail"/u);
  assert.match(pages[4], /<div class="metric-ledger"/u);
  assert.match(pages[5], /<div class="relationship-map"/u);
  // Word-preserving spans split HTML source strings; verify the browser's text projection instead of serialization.
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  const browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const [index, slide] of content.slides.entries()) {
    await page.setContent(pages[index]);
    const actual = await page.locator('[data-storyweave-slide]').innerText();
    for (const line of slide.exact_text) assert(actual.replace(/\s+/gu, ' ').includes(line.replace(/\s+/gu, ' ')), `Missing confirmed text ${line}`);
  }
});

test('visual replanning preserves approved facts and changes output identity', async () => {
  const content = approved();
  const before = JSON.stringify(content);
  const first = await createHtmlPlan(content, { theme_ref: 'systems/ink-blue-grid' });
  const second = await createHtmlPlan(content, { theme_ref: 'editorial/paper-magazine' });
  assert.equal(JSON.stringify(content), before);
  assert.equal(first.contentRevision, second.contentRevision);
  assert.notEqual(first.plan_sha256, second.plan_sha256);
  const firstManifest = createHtmlManifest(content, first);
  assert.equal(validateHtmlManifest(firstManifest, content, first).valid, true);
  assert.equal(validateHtmlManifest(firstManifest, content, second).valid, false);
});

test('a loop layout needs an explicit feedback relationship', async () => {
  const draft = structuredClone(fixture);
  const process = draft.slides[3].content;
  const linear = await createHtmlPlan(approveContent(draft));
  assert.equal(linear.slides[3].layout_id, 'process-linear');
  await assert.rejects(createHtmlPlan(approveContent(draft), { references: [{ case_id: 'example', page_id: 'p1', purpose: 'layout', application: { field: 'layout_id', value: 'process-loop', slide_id: 's04' } }] }), /feedback/u);
  process.edges.push({ from: 'deliver', to: 'collect', label: '反馈' });
  const content = approveContent(draft);
  const loop = await createHtmlPlan(content);
  assert.equal(loop.slides[3].layout_id, 'process-loop');
  const html = renderHtmlSlide(content, content.slides[3], 3, loop);
  assert.match(html, /data-edge-from="deliver" data-edge-to="collect"/u);
  assert.match(html, />反馈<\/text>/u);
});

test('reference selection is distinct from a change actually applied to HTML planning', async () => {
  const content = approved();
  const selected = { case_id: 'example', page_id: 'p1', purpose: 'palette' };
  const first = await createHtmlPlan(content, { references: [selected] });
  assert.equal(first.references.length, 1);
  assert.deepEqual(first.reference_applications, []);
  const second = await createHtmlPlan(content, { references: [{ ...selected, application: { field: 'accent', value: '#914B20' } }] });
  assert.equal(second.reference_applications[0].status, 'applied');
  assert.match(renderHtmlDeck(content, second), /--brand:#914B20/u);
});

test('image captions use the approved statement attribution once', async (t) => {
  const draft = structuredClone(fixture);
  draft.slides[0].content.attribution = 'StoryWeave 仓库验证样本';
  const content = approveContent(draft);
  const assetRefs = { s01: [{ asset_id: 'hero', path: 'media/hero.png', slot: 'hero', caption: 'Unapproved plan-only caption' }] };
  const plan = await createHtmlPlan(content, { assetRefs });
  const html = renderHtmlSlide(content, content.slides[0], 0, plan);
  // Caption words may use native grouping spans; the observable caption and its occurrence count remain the contract.
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  const browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(html);
  assert.equal(await page.locator('figcaption').textContent(), draft.slides[0].content.attribution);
  assert.equal((await page.locator('.slide').textContent()).split(draft.slides[0].content.attribution).length - 1, 1);
  assert.doesNotMatch(html, /Unapproved plan-only caption/u);
});

test('HTML plans reject stale content, mutated theme choices and excessive layout capacity', async () => {
  const content = approved();
  const plan = await createHtmlPlan(content);
  const changed = structuredClone(plan);
  changed.slides[2].tone = 'dark';
  assert.equal(validateHtmlPlan(content, changed).valid, false);
  const draft = structuredClone(fixture);
  draft.slides[0].content.body.push('新文字');
  assert.equal(validateHtmlPlan(approveContent(draft), plan).valid, false);
  const overfull = structuredClone(fixture);
  overfull.slides[4].content.metrics.push(...overfull.slides[4].content.metrics);
  await assert.rejects(createHtmlPlan(approveContent(overfull)), /capacity/u);
});

test('focused Space advances once for both structured and legacy galleries', async (context) => {
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  if (!loaded) return context.skip('Playwright is not installed');
  const browser = await (loaded.chromium ?? loaded.default.chromium).launch({ headless: true });
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-navigation-'));
  try {
    const structured = approved();
    const plan = await createHtmlPlan(structured);
    const old = approveOutline(createOutline(), { mode: 'html', theme: 'editorial' });
    for (const [name, html] of [['structured', renderHtmlDeck(structured, plan)], ['legacy', renderHtmlDeck(old, resolveTheme('editorial'))]]) {
      const path = join(directory, `${name}.html`);
      await writeFile(path, html);
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(pathToFileURL(path).href);
      await page.getByRole('button', { name: '下一页' }).click();
      await page.getByRole('button', { name: '上一页' }).click();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-storyweave-slide].active').getAttribute('data-slide-id'), 's02');
      await page.close();
    }
  } finally { await browser.close(); await rm(directory, { recursive: true, force: true }); }
});

test('multiple metric notes occupy distinct readable rows', async (context) => {
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  if (!loaded) return context.skip('Playwright is not installed');
  const browser = await (loaded.chromium ?? loaded.default.chromium).launch({ headless: true });
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-metric-notes-'));
  try {
    const draft = structuredClone(fixture);
    draft.slides[4].content.body = ['页面内容保留原生文字。', '版式调整使用独立计划。'];
    const content = approveContent(draft);
    const plan = await createHtmlPlan(content);
    const path = join(directory, 'metrics.html');
    await writeFile(path, renderHtmlSlide(content, content.slides[4], 4, plan));
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(path).href);
    await page.evaluate(() => document.fonts.ready);
    const notes = page.locator('.metric-note');
    assert.equal(await notes.count(), 2);
    const first = await notes.nth(0).boundingBox();
    const second = await notes.nth(1).boundingBox();
    assert(second.y >= first.y + first.height + 4);
    assert(second.y + second.height <= 720 - 24);
  } finally { await browser.close(); await rm(directory, { recursive: true, force: true }); }
});

test('canonical CLI separates approved content, HTML planning, fresh QA and exports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-v4-cli-'));
  try {
    const node = (...args) => run(process.execPath, [cli.pathname, ...args], { maxBuffer: 8 * 1024 * 1024 });
    await node('draft', directory, '--theme-ref', 'systems/ink-blue-grid');
    const draft = JSON.parse(await readFile(join(directory, 'outline_draft.json'), 'utf8'));
    assert.equal(draft.schema_version, 4);
    assert.equal(draft.slides.length, 8);
    await node('approve', directory, '--theme-ref', 'systems/ink-blue-grid');
    const before = await readFile(join(directory, 'deck_spec.json'), 'utf8');
    await node('replan', directory, '--theme-ref', 'editorial/paper-magazine');
    assert.equal(await readFile(join(directory, 'deck_spec.json'), 'utf8'), before);
    await node('build', directory);
    await assert.rejects(node('export', directory, '--format', 'html'), /QA|qa_report/u);
    const qa = JSON.parse((await node('qa', directory, '--json')).stdout);
    assert.equal(qa.export_ready, true);
    assert.equal(qa.visual_review, 'browser');
    assert.match(qa.artifact_binding.fingerprint, /^[a-f0-9]{64}$/u);
    await node('export', directory, '--format', 'html');
    const source = join(directory, 'slides/s01.html');
    await writeFile(source, `${await readFile(source, 'utf8')}\n<!-- changed source -->`);
    await assert.rejects(node('export', directory, '--format', 'html'), /changed|stale|binding/u);
    const html = await readFile(source, 'utf8');
    for (const added of [
      '<p data-storyweave-content="body">额外但未经确认的主张</p>',
      '<p aria-hidden="true">未标记但仍可见的额外主张</p>',
    ]) {
      await writeFile(source, html.replace('<span class="counter">', `${added}<span class="counter">`));
      await assert.rejects(node('qa', directory, '--json'));
      const rejected = JSON.parse(await readFile(join(directory, 'qa_report.json'), 'utf8'));
      assert.equal(rejected.export_ready, false);
      assert(rejected.findings.some((finding) => finding.code === 'browser.unapproved_text'));
    }
    await writeFile(source, html);
    const gallery = join(directory, 'index.html');
    const originalGallery = await readFile(gallery, 'utf8');
    await writeFile(gallery, originalGallery.replace('<span class="counter">', '<p>只出现在入口页面的额外主张</p><span class="counter">'));
    await assert.rejects(node('qa', directory, '--json'));
    const rejectedGallery = JSON.parse(await readFile(join(directory, 'qa_report.json'), 'utf8'));
    assert(rejectedGallery.findings.some((finding) => finding.surface === 'gallery' && finding.code === 'browser.unapproved_text'));
    await writeFile(gallery, originalGallery);
    const processPage = join(directory, 'slides/s04.html');
    await writeFile(processPage, (await readFile(processPage, 'utf8')).replace(/data-edge-to="[^"]+"/u, 'data-edge-to="unknown"'));
    await assert.rejects(node('qa', directory, '--json'));
    const rejectedRelationship = JSON.parse(await readFile(join(directory, 'qa_report.json'), 'utf8'));
    assert(rejectedRelationship.findings.some((finding) => finding.code === 'browser.relationships'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI captures selected design references and applies only their explicit visual decisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-v4-references-'));
  try {
    const node = (...args) => run(process.execPath, [cli.pathname, ...args], { maxBuffer: 8 * 1024 * 1024 });
    const library = new URL('../../../design-library', import.meta.url).pathname;
    const selectionPath = join(directory, 'selection.json');
    const selection = {
      case_id: 'storyweave-knowledge-flow', page_id: 's03', purpose: 'palette',
      application: { field: 'accent', value: '#914B20' },
    };
    await writeFile(selectionPath, JSON.stringify([selection]));
    await node('draft', directory, '--theme-ref', 'systems/ink-blue-grid');
    await node('approve', directory, '--theme-ref', 'systems/ink-blue-grid');
    const before = await readFile(join(directory, 'deck_spec.json'), 'utf8');
    await node('replan', directory, '--library', library, '--references', selectionPath);
    assert.equal(await readFile(join(directory, 'deck_spec.json'), 'utf8'), before);
    const plan = JSON.parse(await readFile(join(directory, 'plans/html.json'), 'utf8'));
    assert.equal(plan.references.length, 1);
    const reference = plan.references[0];
    assert.match(reference.path, /^references\/storyweave-knowledge-flow-s03-[a-f0-9]{12}\.png$/u);
    const captured = await readFile(join(directory, reference.path));
    assert.equal(hashBytes(captured), reference.sha256);
    assert.equal(plan.reference_applications[0].status, 'applied');
    await node('build', directory);
    assert.match(await readFile(join(directory, 'slides/s03.html'), 'utf8'), /--brand:#914B20/u);
    const generation = JSON.parse(await readFile(join(directory, 'generation_manifest.json'), 'utf8'));
    assert.deepEqual(generation.references, plan.references);
    await writeFile(join(directory, reference.path), Buffer.concat([captured, Buffer.from('changed')]));
    await assert.rejects(node('build', directory), /Selected reference changed/u);
    await assert.rejects(node('qa', directory, '--json'));
    const rejected = JSON.parse(await readFile(join(directory, 'qa_report.json'), 'utf8'));
    assert.equal(rejected.export_ready, false);
    assert(rejected.findings.some((finding) => /Selected reference changed/u.test(finding.message)));
    await assert.rejects(node('replan', directory, '--library', join(directory, 'missing-library'), '--references', selectionPath), /Unknown case page/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('explicit content migration preserves original text and refuses to invent structured relations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-v4-migration-'));
  try {
    const node = (...args) => run(process.execPath, [cli.pathname, ...args], { maxBuffer: 8 * 1024 * 1024 });
    await node('draft', directory, '--schema', '3', '--theme-ref', 'editorial/paper-magazine');
    const original = JSON.parse(await readFile(join(directory, 'outline_draft.json'), 'utf8'));
    await assert.rejects(node('migrate-content', directory, '--theme-ref', 'editorial/paper-magazine'), (error) => error.code === 3);
    const migrated = JSON.parse(await readFile(join(directory, 'outline_draft.json'), 'utf8'));
    const report = JSON.parse(await readFile(join(directory, 'content_migration_report.json'), 'utf8'));
    assert.equal(report.text_preserved, true);
    assert(report.unresolved.some((item) => item.original_role === 'process'));
    assert.deepEqual(migrated.slides[3].content.body, original.slides[3].exact_text.slice(1));
    await assert.rejects(node('approve', directory, '--theme-ref', 'editorial/paper-magazine'), /relationships/u);
    await node('approve', directory, '--theme-ref', 'editorial/paper-magazine', '--accept-text-only');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
