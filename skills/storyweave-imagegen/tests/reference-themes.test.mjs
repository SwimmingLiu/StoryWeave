import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { openThemeCatalog } from '../../../src/imagegen/themes.mjs';
import { compilePlannedImageJobs, planImagegen } from '../../../src/imagegen/plan.mjs';

const root = new URL('../assets/themes/', import.meta.url);
const catalog = await openThemeCatalog(root.pathname, { scope: 'authoring' });

test('every curated reference direction maps to a selectable real recipe and existing scheme', async () => {
  const references = JSON.parse(await readFile(new URL('../../../design-library/presentation-references/catalog.json', import.meta.url)));
  const mapping = JSON.parse(await readFile(new URL('reference-theme-map.json', root)));
  assert.equal(mapping.mappings.length, references.cases.length);
  assert.deepEqual([...new Set(mapping.mappings.map((item) => item.reference_id))].sort(), references.cases.map((item) => item.id).sort());
  assert.equal(catalog.list({ includeAll: true }).length, mapping.generated_themes);
  assert.equal(new Set(mapping.mappings.map((item) => item.theme_ref)).size, mapping.mapped_theme_directions);
  for (const item of mapping.mappings) {
    const style = catalog.getStyle(item.theme_ref);
    assert(style.schemes[item.scheme_ref.split('/')[2]], `Missing mapped scheme: ${item.scheme_ref}`);
  }
});

test('every selectable recipe compiles the same approved v4 content without changing visible facts', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../../tests/fixtures/visual/outline_v4.json', import.meta.url)));
  const content = approveContent(fixture);
  const before = structuredClone(content);
  for (const { ref } of catalog.list({ includeAll: true })) {
    const plan = planImagegen(content, catalog, { theme_ref: ref });
    const jobs = compilePlannedImageJobs(content, plan);
    assert.deepEqual(jobs.map((job) => job.visible_text), content.slides.map((slide) => slide.exact_text));
    assert(jobs.every((job) => job.prompt.length > 0 && job.text_policy === 'exact-text-in-image'));
    assert.deepEqual(content, before, `Theme ${ref} changed approved content`);
  }
});

// A three-step preview must not force arbitrary approved graphs or wider comparisons into its sample topology.
test('reference-derived prompts preserve branched graphs and three-column comparisons', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../../tests/fixtures/visual/outline_v4.json', import.meta.url)));
  const comparison = fixture.slides.find((slide) => slide.content.type === 'comparison');
  comparison.purpose = '比较三种页面表达';
  comparison.content.columns.push('SVG');
  for (const row of comparison.content.rows) row.values.push('独立矢量图形');
  const content = approveContent(fixture);
  const graph = content.slides.find((slide) => slide.content.type === 'graph');
  assert.equal(graph.content.nodes.length, 4);
  assert.equal(graph.content.edges.length, 4);
  const mapping = JSON.parse(await readFile(new URL('reference-theme-map.json', root)));
  // Selected architecture seeds must not freeze their example topology into the newly authored recipes.
  for (const ref of new Set([...mapping.mappings, ...mapping.selected_architecture_themes].map((item) => item.theme_ref))) {
    const jobs = compilePlannedImageJobs(content, planImagegen(content, catalog, { theme_ref: ref }));
    const graphJob = jobs.find((job) => job.id === graph.id);
    assert(graphJob.prompt.includes(JSON.stringify(graph.content)));
    assert.doesNotMatch(graphJob.prompt, /single left-to-right dependency|three (?:successive|distinct|content-defined|actual|purposeful)|discovering, changing and verifying/iu, ref);
    const compareJob = jobs.find((job) => job.id === comparison.id);
    assert.deepEqual(compareJob.visible_text, content.slides.find((slide) => slide.id === comparison.id).exact_text);
    assert.doesNotMatch(compareJob.prompt, /two equal-scale illustrated situations/iu, ref);
  }
});
