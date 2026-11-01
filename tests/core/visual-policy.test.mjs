import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approveContent } from '../../src/core/content.mjs';
import { hashValue } from '../../src/core/hash.mjs';
import { createHtmlPlan, validateHtmlPlan } from '../../src/html/plan.mjs';
import { planDiagram } from '../../src/html/diagram.mjs';
import { compileImageJobs } from '../../src/imagegen/imagegen.mjs';
import { assertImagePlan, compilePlannedImageJobs, planImagegen } from '../../src/imagegen/plan.mjs';
import { openThemeCatalog } from '../../src/imagegen/themes.mjs';
import { createOutline, approveOutline } from '../../src/imagegen/outline.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/visual/outline_v4.json', import.meta.url), 'utf8'));
const content = approveContent(fixture);
const catalog = await openThemeCatalog(new URL('../../skills/storyweave-imagegen/assets/themes', import.meta.url).pathname, { scope: 'authoring' });
const themes = ['editorial/paper-magazine', 'systems/white-cyan-circuit'];

test('both image themes compile the actual information form without a default metaphor or added visible copy', () => {
  const before = JSON.stringify(content);
  for (const theme_ref of themes) {
    const plan = planImagegen(content, catalog, { theme_ref });
    const jobs = compilePlannedImageJobs(content, plan);
    for (const [index, job] of jobs.entries()) {
      assert.deepEqual(job.visible_text, content.slides[index].exact_text);
      assert.equal(job.visual_intent.claim, content.slides[index].claim);
      assert.equal(job.visual_intent.review_status, 'required');
      assert(!job.prompt.includes('A restrained visual metaphor'));
      assert(job.prompt.includes('If a theme fragment requests an unrelated prop'));
    }
    const comparison = jobs.find((job) => job.visual_intent.content_type === 'comparison');
    const graph = jobs.find((job) => job.visual_intent.content_type === 'graph');
    const metrics = jobs.find((job) => job.visual_intent.content_type === 'metrics');
    assert.match(comparison.prompt, /neutral columns equal/u);
    assert.match(graph.prompt, /branching and merging legible/u);
    assert.match(graph.prompt, /Approved information structure:.*"edges"/u);
    assert.match(metrics.prompt, /Do not invent trends, progress, sparklines/u);
  }
  assert.equal(JSON.stringify(content), before, 'Visual policy cannot rewrite approved content');
});

test('theme changes preserve the wide DAG reading path and only real feedback edges create a loop', async () => {
  const graph = content.slides.find((slide) => slide.content.type === 'graph');
  const a = await createHtmlPlan(content, { theme_ref: 'editorial/paper-magazine' });
  const b = await createHtmlPlan(content, { theme_ref: 'systems/ink-blue-grid' });
  const magazine = a.slides.find((slide) => slide.id === graph.id);
  const swiss = b.slides.find((slide) => slide.id === graph.id);
  assert.equal(magazine.diagram.flow, 'across');
  assert.deepEqual(magazine.diagram, swiss.diagram, 'A palette name cannot rotate an authored relationship');
  const positions = new Map(magazine.diagram.nodes.map((node) => [node.id, node]));
  for (const edge of graph.content.edges) assert(positions.get(edge.from).x < positions.get(edge.to).x);
  const loop = structuredClone(graph.content);
  loop.edges.push({ from: loop.nodes.at(-1).id, to: loop.nodes[0].id, label: '' });
  assert.equal(planDiagram(loop, 'relationship-map').flow, 'loop');
  assert.equal(magazine.visual_intent.review_status, 'required');
});

test('a rehashed HTML plan still cannot omit the generation policy or alter its approved claim', async () => {
  const plan = await createHtmlPlan(content, { theme_ref: 'editorial/paper-magazine' });
  assert.equal(validateHtmlPlan(content, plan).valid, true);
  const omitted = structuredClone(plan); delete omitted.visual_policy;
  delete omitted.plan_sha256; omitted.plan_sha256 = hashValue(omitted);
  assert(validateHtmlPlan(content, omitted).errors.some((error) => error.includes('Visual generation policy')));
  const stale = structuredClone(plan); stale.slides[0].visual_intent.claim = 'unapproved claim';
  delete stale.plan_sha256; stale.plan_sha256 = hashValue(stale);
  assert(validateHtmlPlan(content, stale).errors.some((error) => error.includes('Visual intent is stale')));
});

test('old or altered image policies require replan even with a recomputed plan checksum', () => {
  const original = planImagegen(content, catalog, { theme_ref: themes[0] });
  const stale = structuredClone(original); delete stale.visual_policy;
  delete stale.plan_sha256; stale.plan_sha256 = hashValue(stale);
  assert.throws(() => assertImagePlan(content, stale), /Visual generation policy changed/u);
  const altered = structuredClone(original); altered.slides[0].visual_intent.review_status = 'pass';
  delete altered.plan_sha256; altered.plan_sha256 = hashValue(altered);
  assert.throws(() => assertImagePlan(content, altered), /Visual intent is stale/u);
});

test('legacy image tasks also use claim-related generation instructions without adding visible copy', () => {
  const theme = { id: 'editorial', art_direction: 'editorial print', palette: 'paper and ink', anchors: ['red rule'], avoid: [] };
  const deck = approveOutline(createOutline(), { mode: 'imagegen', theme: theme.id });
  const jobs = compileImageJobs(deck, theme);
  assert.deepEqual(jobs.map((job) => job.visible_text), deck.slides.map((slide) => slide.exact_text));
  assert(jobs.every((job) => job.prompt.includes('Do not default to glossy blobs')));
  assert(jobs.every((job) => job.visual_intent.review_status === 'required'));
});
