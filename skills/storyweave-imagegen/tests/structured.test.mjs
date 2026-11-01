import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { openThemeCatalog } from '../../../src/imagegen/themes.mjs';
import { assertImagePlan, collectImageResult, compilePlannedImageJobs, createPlannedGenerationManifest, planImagegen, validatePlannedManifest, verifyPlanReferences } from '../../../src/imagegen/plan.mjs';
import { refreshManifest } from '../../../src/imagegen/imagegen.mjs';
import { selectReferences } from '../../../src/design-library/library.mjs';

const repo = resolve(new URL('../../..', import.meta.url).pathname);
const fixture = JSON.parse(await readFile(join(repo, 'tests/fixtures/visual/outline_v4.json'), 'utf8'));
const catalog = await openThemeCatalog(join(repo, 'skills/storyweave-imagegen/assets/themes'), { scope: 'authoring' });
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function context(t, { references = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-structured-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = approveContent(fixture);
  const selected = references ? await selectReferences(join(repo, 'design-library'), [{ case_id: 'storyweave-knowledge-flow', page_id: 's03', purpose: 'layout', slide_id: 's03' }], { projectRoot: root }) : [];
  const plan = planImagegen(content, catalog, { theme_ref: 'editorial/paper-magazine', references: selected });
  const jobs = compilePlannedImageJobs(content, plan, { projectRoot: root });
  const manifest = createPlannedGenerationManifest(content, plan, jobs);
  return { root, content, plan, jobs, manifest };
}

async function outputFixture(root, name = 'returned.png') {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(2048, 16); bytes.writeUInt32BE(1152, 20);
  const path = join(root, name);
  await writeFile(path, bytes);
  return path;
}

test('image plans bind shared content while visual replanning preserves approved revision', async (t) => {
  const { content, plan, jobs } = await context(t);
  const alternative = planImagegen(content, catalog, { theme_ref: 'systems/white-cyan-circuit' });
  assert.equal(plan.contentRevision, content.revision);
  assert.equal(alternative.contentRevision, content.revision);
  assert.notEqual(plan.plan_sha256, alternative.plan_sha256);
  assert.deepEqual(jobs.map((job) => job.visible_text), content.slides.map((slide) => slide.exact_text));
  assert.match(jobs[3].prompt, /Approved information structure.*"edges"/u);
  const changed = structuredClone(plan); changed.slides[0].recipe.style.palette = 'unapproved';
  assert.throws(() => assertImagePlan(content, changed), /fingerprint/u);
});

test('tasks carry actual tool input paths for selected page-purpose records', async (t) => {
  const { root, plan, jobs } = await context(t, { references: true });
  assert.equal(jobs[0].reference_images.length, 0);
  assert.equal(jobs[2].reference_images[0].purpose, 'layout');
  assert.equal(jobs[2].tool_input.referenced_image_paths[0], join(root, plan.references[0].path));
  await verifyPlanReferences(root, plan);
  await writeFile(join(root, plan.references[0].path), 'changed reference');
  await assert.rejects(verifyPlanReferences(root, plan), /changed/u);
});

test('result collection requires actual log attachments and changes only the returned page', async (t) => {
  const { root, content, plan, manifest } = await context(t, { references: true });
  const returned = await outputFixture(root);
  const reference = join(root, plan.references[0].path);
  const log = join(root, 'call.json');
  await writeFile(log, JSON.stringify({ tool: 'image_gen', arguments: { referenced_image_paths: [reference] }, result: { path: returned } }));
  const next = await collectImageResult(root, content, plan, manifest, { slide_id: 's03', tool: 'image_gen', reference_mode: 'attached', tool_call: { log_path: log, id: 'fixture-call' }, output_path: returned });
  assert.equal(next.slides[2].reference_delivery.status, 'attached');
  assert.equal(next.slides[2].reference_delivery.evidence_status, 'recorded');
  assert.equal(next.slides[2].reference_delivery.attached[0].sha256, plan.references[0].sha256);
  assert.equal(next.slides[2].visual_review, 'pending');
  assert.equal(next.slides[0].status, 'prepared');
  assert.equal(next.slides[2].reference_delivery.output_sha256, hash(await readFile(returned)));
  assert.equal(validatePlannedManifest(next, content, plan).valid, false);
});

test('a path in a receipt or prompt cannot stand in for an attached image', async (t) => {
  const { root, content, plan, manifest } = await context(t, { references: true });
  const returned = await outputFixture(root);
  const log = join(root, 'call.json');
  await writeFile(log, JSON.stringify({ tool: 'image_gen', arguments: { referenced_image_paths: [] }, result: { path: returned } }));
  const receipt = { slide_id: 's03', tool: 'image_gen', reference_mode: 'attached', tool_call: { log_path: log }, output_path: returned };
  await assert.rejects(collectImageResult(root, content, plan, manifest, receipt), /match the selected/u);
  await assert.rejects(collectImageResult(root, content, plan, manifest, { ...receipt, tool_call: {} }), /actual tool-call/u);
  const next = await collectImageResult(root, content, plan, manifest, { ...receipt, reference_mode: 'prompt-only' });
  assert.equal(next.slides[2].reference_delivery.status, 'prompt-only');
  assert.deepEqual(next.slides[2].reference_delivery.attached, []);
  assert.equal(validatePlannedManifest(next, content, plan).valid, false);
});

test('collection rejects credential-bearing logs without copying them into project evidence', async (t) => {
  const { root, content, plan, manifest } = await context(t, { references: true });
  const returned = await outputFixture(root);
  const log = join(root, 'call-with-private-headers.json');
  await writeFile(log, JSON.stringify({ tool: 'image_gen', arguments: { referenced_image_paths: [join(root, plan.references[0].path)] }, headers: { Authorization: 'fixture-private-value' }, result: { path: returned } }));
  await assert.rejects(collectImageResult(root, content, plan, manifest, { slide_id: 's03', tool: 'image_gen', reference_mode: 'attached', tool_call: { log_path: log }, output_path: returned }), /omit credentials/u);
});

test('replacing reviewed image bytes resets review instead of inheriting pass', async (t) => {
  const { root, manifest } = await context(t);
  await mkdir(join(root, 'slides'));
  const path = await outputFixture(join(root, 'slides'), 's01.png');
  manifest.slides[0].visual_review = 'pass';
  manifest.slides[0].review_sha256 = hash(await readFile(path));
  manifest.slides[0].status = 'pass';
  const altered = Buffer.concat([await readFile(path), Buffer.from('new bytes')]);
  await writeFile(path, altered);
  const refreshed = await refreshManifest(root, manifest);
  assert.equal(refreshed.slides[0].visual_review, 'pending');
  assert.equal(refreshed.slides[0].status, 'generated');
});
