import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { approveContent } from '../../../src/core/content.mjs';
import { readVerifiedArtifact } from '../../../src/core/artifact.mjs';
import { openThemeCatalog } from '../../../src/imagegen/themes.mjs';
import { collectImageResult, compilePlannedImageJobs, createPlannedGenerationManifest, planImagegen } from '../../../src/imagegen/plan.mjs';
import { buildStructuredProject, qaStructuredProject } from '../../../src/imagegen/project.mjs';

const repo = resolve(new URL('../../..', import.meta.url).pathname);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (path, value) => fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

async function reviewedProject(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'storyweave-imagegen-qa-binding-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const draft = JSON.parse(await fs.readFile(join(repo, 'tests/fixtures/visual/outline_v4.json'), 'utf8'));
  draft.slides = [draft.slides.find((slide) => slide.id === 's03')];
  draft.page_count = 1;
  const content = approveContent(draft);
  const bytes = await fs.readFile(join(repo, 'skills/storyweave-html/assets/examples/storyweave-demo/qa/screenshots/s03.png'));
  await fs.mkdir(join(root, 'references'));
  await fs.mkdir(join(root, 'plans'));
  const reference = join(root, 'references/layout.png');
  const returned = join(root, 'returned.png');
  await fs.writeFile(reference, bytes);
  await fs.writeFile(returned, bytes);
  const references = [{ case_id: 'qa-regression', page_id: 'comparison', purpose: 'layout', slide_id: 's03', path: 'references/layout.png', sha256: hash(bytes) }];
  const catalog = await openThemeCatalog(join(repo, 'skills/storyweave-imagegen/assets/themes'), { scope: 'authoring' });
  const plan = planImagegen(content, catalog, { theme_ref: 'editorial/paper-magazine', references });
  const jobs = compilePlannedImageJobs(content, plan, { projectRoot: root });
  const generation = createPlannedGenerationManifest(content, plan, jobs);
  await writeJson(join(root, 'deck_spec.json'), content);
  await writeJson(join(root, 'plans/imagegen.json'), plan);
  const log = join(root, 'fixture-call.json');
  await writeJson(log, { tool: 'image_gen', arguments: { referenced_image_paths: [reference] }, result: { path: returned }, fixture: true });
  const recorded = await collectImageResult(root, content, plan, generation, { slide_id: 's03', tool: 'image_gen', reference_mode: 'attached', tool_call: { log_path: log }, output_path: returned });
  recorded.slides[0].visual_review = 'pass';
  recorded.slides[0].review_sha256 = hash(bytes);
  await writeJson(join(root, 'generation_manifest.json'), recorded);
  assert.equal((await buildStructuredProject(root)).status, 'built');
  assert.equal((await qaStructuredProject(root)).export_ready, true);
  await readVerifiedArtifact(root);
  return { root, reference };
}

async function mutateDuringRead(predicate, mutation, drive) {
  const originalRead = fs.readFile;
  let changed = false;
  fs.readFile = async (path, ...args) => {
    const value = await originalRead(path, ...args);
    if (!changed && predicate(String(path), value)) {
      changed = true;
      await mutation();
    }
    return value;
  };
  syncBuiltinESMExports();
  try {
    const result = await drive().then((report) => ({ report }), (error) => ({ error }));
    assert.equal(changed, true, 'The concurrent edit must occur during the real QA path.');
    if (result.error) assert.match(result.error.message, /changed|stale|fingerprint/iu);
    else {
      assert.equal(result.report.export_ready, false, 'QA must not approve bytes that changed during inspection.');
      assert.ok(result.report.summary.blocking > 0);
    }
  } finally {
    fs.readFile = originalRead;
    syncBuiltinESMExports();
  }
}

test('Imagegen QA rejects a reference edited while its tool-call evidence is inspected', async (t) => {
  const { root, reference } = await reviewedProject(t);
  let referenceRead = false;
  await mutateDuringRead(
    (path) => {
      if (path.endsWith('/references/layout.png')) referenceRead = true;
      return referenceRead && path.startsWith(join(root, 'evidence/imagegen'));
    },
    () => fs.appendFile(reference, '\nconcurrent-reference-edit\n'),
    () => qaStructuredProject(root),
  );
  await assert.rejects(readVerifiedArtifact(root), /stale|not ready/iu);
});

test('Imagegen QA rejects reviewed image bytes changed after the preparation refresh', async (t) => {
  const { root } = await reviewedProject(t);
  await mutateDuringRead(
    (path) => path === join(root, 'plans/imagegen.json'),
    () => fs.appendFile(join(root, 'slides/s03.png'), '\nconcurrent-image-edit\n'),
    () => qaStructuredProject(root),
  );
  await assert.rejects(readVerifiedArtifact(root), /stale|not ready/iu);
});
