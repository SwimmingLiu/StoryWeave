import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { createHtmlPlan } from '../../../src/html/plan.mjs';
import { inspectHtmlProject } from '../../../src/html/qa.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide } from '../../../src/html/render.mjs';

test('browser QA rejects page overlays and reassigned comparison or metric values', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-qa-structure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const draft = JSON.parse(await readFile(new URL('../../../tests/fixtures/visual/outline_v4.json', import.meta.url), 'utf8'));
  draft.slides = draft.slides.filter((slide) => ['comparison', 'metrics'].includes(slide.content.type));
  draft.page_count = draft.slides.length;
  const content = approveContent(draft);
  const plan = await createHtmlPlan(content, { theme_ref: 'systems/ink-blue-grid' });
  const manifest = createHtmlManifest(content, plan);
  await mkdir(join(root, 'slides'));
  const gallery = renderHtmlDeck(content, plan);
  const pages = content.slides.map((slide, index) => renderHtmlSlide(content, slide, index, plan));
  const save = async (entry, slides) => {
    await writeFile(join(root, manifest.entry), entry);
    await Promise.all(manifest.slides.map((slide, index) => writeFile(join(root, slide.source), slides[index])));
  };
  await save(gallery, pages);
  const baseline = await inspectHtmlProject(root, manifest, content);
  assert.equal(baseline.mode, 'browser', 'This regression requires a real browser');
  assert.deepEqual(baseline.findings, []);

  const comparison = content.slides[0].content;
  const metrics = content.slides[1].content;
  assert.notEqual(comparison.rows[0].values[0], comparison.rows[0].values[1]);
  assert.notEqual(metrics.metrics[0].value, metrics.metrics[1].value);
  const swap = (html, first, second) => first && second ? html.replace(first, '__SWAP__').replace(second, first).replace('__SWAP__', second) : html;
  const changed = (html) => {
    // Word-preserving spans changed serialization; swap actual complete cells to keep the association regression meaningful.
    const cells = [...html.matchAll(/<td data-storyweave-content="comparison-value"[^>]*>[\s\S]*?<\/td>/gu)].slice(0, 2).map((match) => match[0]);
    const numbers = metrics.metrics.map((metric) => `<span data-storyweave-content="metric-value" >${metric.value}</span>`);
    return swap(swap(html, cells[0], cells[1]), numbers[0], numbers[1]);
  };
  const overlay = '<div style="position:fixed;left:100px;top:500px;z-index:9999">未经确认的额外结论</div><div data-storyweave-content="body" style="position:fixed;left:100px;top:550px;z-index:9999">伪装成已标记内容的额外结论</div>';
  await save(changed(gallery).replace('</body>', `${overlay}</body>`), pages.map(changed));
  const rejected = await inspectHtmlProject(root, manifest, content);
  assert(rejected.findings.some((finding) => finding.code === 'browser.unapproved_text' && finding.surface === 'gallery'));
  for (const slide of manifest.slides) {
    for (const surface of ['gallery', 'standalone']) {
      assert(rejected.findings.some((finding) => finding.code === 'browser.content_structure' && finding.slide_id === slide.id && finding.surface === surface), `${slide.id} ${surface} must reject reassigned values`);
    }
  }
});
