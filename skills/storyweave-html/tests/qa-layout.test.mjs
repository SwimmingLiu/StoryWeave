import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { createHtmlPlan } from '../../../src/html/plan.mjs';
import { createHtmlManifest, renderHtmlDeck, renderHtmlSlide } from '../../../src/html/render.mjs';
import { inspectHtmlProject } from '../../../src/html/qa.mjs';

test('real browser QA rejects broken copy, biased comparisons, number collisions and detached edges', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-layout-qa-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const draft = JSON.parse(await readFile(new URL('../assets/content-v4.example.json', import.meta.url), 'utf8'));
  draft.slides = [draft.slides[2], draft.slides[3], draft.slides[5]];
  draft.page_count = draft.slides.length;
  const content = approveContent(draft);
  const frozen = JSON.stringify(content);
  const plan = await createHtmlPlan(content, { theme_ref: 'editorial/paper-magazine' });
  const manifest = createHtmlManifest(content, plan);
  const gallery = renderHtmlDeck(content, plan);
  const pages = content.slides.map((slide, index) => renderHtmlSlide(content, slide, index, plan));
  await mkdir(join(root, 'slides'));
  const save = async (css = '', script = '') => {
    await writeFile(join(root, 'index.html'), gallery);
    for (const [index, slide] of manifest.slides.entries()) await writeFile(join(root, slide.source), pages[index].replace('</style>', `${css}</style>`).replace('</body>', `${script}</body>`));
  };
  await save();
  const baseline = await inspectHtmlProject(root, manifest, content, plan);
  assert.equal(baseline.mode, 'browser');
  assert.deepEqual(baseline.findings, []);
  assert(baseline.states.some((state) => state.connection_endpoints.length > 0));

  for (const [css, script, codes] of [
    ['.relationship-node[data-node-id="core"] p{width:24px!important}.relationship-node[data-node-id="core"] .copy-word{white-space:normal!important}', '', ['browser.copy_orphan', 'browser.word_split']],
    ['.comparison-matrix tbody td:last-child{color:#002fa7!important}', '', ['browser.comparison_emphasis']],
    ['.step-anchor{transform:translateY(-68px)}', '', ['browser.connection_collision']],
    ['', '<script>document.fonts.ready.then(()=>{for(const path of document.querySelectorAll(".process-body g[data-edge-from] > path"))path.setAttribute("d","M0,0L1,1")})</script>', ['browser.connection_endpoint']],
  ]) {
    await save(css, script);
    const qa = await inspectHtmlProject(root, manifest, content, plan);
    for (const code of codes) for (const viewport of ['desktop', 'mobile']) assert(qa.findings.some((finding) => finding.code === code && finding.viewport === viewport), `${code} must reject the damaged page at ${viewport}`);
    assert.equal(JSON.stringify(content), frozen, 'QA must never repair or rewrite approved content');
  }
});
