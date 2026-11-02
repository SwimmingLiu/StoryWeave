import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createArtifactBinding, isProjectPath, outputSchema, parseOutputManifest, readVerifiedArtifact, validateOutputManifest, verifyArtifactBinding } from '../../src/core/artifact.mjs';

function manifest() {
  return { format: 'storyweave/slides', version: 2, producer: 'storyweave-html', kind: 'html', title: 'Approved presentation', canvas: { width: 1280, height: 720 }, entry: 'index.html', slides: [{ id: 's01', source: 'slides/s01.html', notes: 'Keep this note.' }] };
}

async function project(t) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-core-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'slides'));
  await writeFile(join(root, 'slides/s01.html'), '<main>Approved words</main>');
  await writeFile(join(root, 'index.html'), '<a href="slides/s01.html">Open</a>');
  await writeFile(join(root, 'deck_spec.json'), '{"revision":"approved-revision"}');
  const output = manifest();
  await writeFile(join(root, 'storyweave-output.json'), JSON.stringify(output, null, 2));
  const binding = await createArtifactBinding(root, output, { inputs: ['deck_spec.json'] });
  const qa = { export_ready: true, summary: { blocking: 0, degraded: 0 }, findings: [], artifact_binding: binding };
  await writeFile(join(root, 'qa_report.json'), JSON.stringify(qa));
  return { root, output, binding, qa };
}

test('manifest boundary accepts supported producer pairs and preserves page order and metadata', () => {
  const output = manifest();
  output.slides.push({ id: 's02', source: 'slides/s02.html', notes: 'Second note' });
  assert.deepEqual(parseOutputManifest(JSON.stringify(output)), output);
  for (const variant of [{ version: 1, producer: 'storyweave-html', kind: 'html' }, { version: 1, producer: 'storyweave-imagegen', kind: 'image' }]) assert.equal(validateOutputManifest({ ...output, ...variant }).valid, true);
});

test('manifest boundary rejects wrong producer pairs, duplicate IDs and non16:9 canvases', () => {
  for (const patch of [
    { producer: 'storyweave-imagegen' }, { version: 3 }, { producer: 'unknown' }, { kind: 'image' },
    { canvas: { width: 1280, height: 721 } }, { canvas: { width: '1280', height: 720 } }, { canvas: { width: 0, height: 0 } },
    { slides: [{ id: 's01', source: 'slides/s01.html' }, { id: 's01', source: 'slides/s02.html' }] },
    { slides: [{ id: 'unsafe/id', source: 'slides/s01.html' }] }, { title: ' ' },
  ]) assert.equal(validateOutputManifest({ ...manifest(), ...patch }).valid, false, JSON.stringify(patch));
  assert.equal(validateOutputManifest(null).valid, false);
  assert.equal(validateOutputManifest({ ...manifest(), slides: [null] }).valid, false);
});

test('only project-relative paths can cross the manifest boundary', () => {
  for (const path of ['../outside.png', '/outside.png', 'C:/outside.png', 'slides/../outside.png', 'slides/./s01.html', 'slides\\s01.html', 'slides//s01.html', 'https://example.com/slide.png', 'slide\nname.png']) {
    assert.equal(isProjectPath(path), false, path);
    assert.throws(() => parseOutputManifest({ ...manifest(), entry: path }));
    assert.throws(() => parseOutputManifest({ ...manifest(), slides: [{ id: 's01', source: path }] }));
  }
  assert.equal(isProjectPath('slides/My page.html'), true);
});

test('schema producer alternatives describe the same supported public formats', () => {
  const schema = outputSchema();
  const variants = schema.oneOf.map((entry) => Object.fromEntries(Object.entries(entry.properties).map(([key, value]) => [key, value.const])));
  assert.deepEqual(variants, [{ version: 1, producer: 'storyweave-html', kind: 'html' }, { version: 1, producer: 'storyweave-imagegen', kind: 'image' }, { version: 2, producer: 'storyweave-html', kind: 'html' }]);
  for (const variant of variants) assert.equal(validateOutputManifest({ ...manifest(), ...variant }).valid, true);
});

test('QA attests the actual manifest, gallery, pages and explicit input files', async (t) => {
  const { root, output, binding, qa } = await project(t);
  const verified = await readVerifiedArtifact(root);
  assert.equal(verified.root, await realpath(root));
  assert.deepEqual(verified.manifest, output);
  assert.deepEqual(binding.files.map(({ path, role }) => ({ path, role })), [{ path: 'deck_spec.json', role: 'input' }, { path: 'index.html', role: 'entry' }, { path: 'slides/s01.html', role: 'page' }]);
  assert.deepEqual((await verifyArtifactBinding(root, output, qa)).binding, binding);
  assert.equal(Object.isFrozen(verified.manifest.slides), true);
});

for (const [name, path, replacement] of [
  ['page', 'slides/s01.html', '<main>Changed words</main>'],
  ['gallery', 'index.html', '<p>Changed gallery</p>'],
  ['approved input', 'deck_spec.json', '{"revision":"different-revision"}'],
]) test(`changing the ${name} invalidates previously passing QA`, async (t) => {
  const { root } = await project(t);
  await writeFile(join(root, path), replacement);
  await assert.rejects(() => readVerifiedArtifact(root), /stale/u);
});

test('even changed manifest bytes require fresh QA', async (t) => {
  const { root, output, qa } = await project(t);
  await writeFile(join(root, 'storyweave-output.json'), `${JSON.stringify(output, null, 2)}\n`);
  await assert.rejects(() => verifyArtifactBinding(root, output, qa), /stale/u);
});

test('artifact binding refuses a supplied manifest different from the on-disk output', async (t) => {
  const { root, output } = await project(t);
  await assert.rejects(() => createArtifactBinding(root, { ...output, title: 'Different title' }), /does not match/u);
});

test('input order and repeated paths do not create different bindings', async (t) => {
  const { root, output } = await project(t);
  await writeFile(join(root, 'asset.json'), '{"source":"fixture"}');
  const first = await createArtifactBinding(root, output, { inputs: ['asset.json', 'deck_spec.json', 'asset.json'] });
  const next = await createArtifactBinding(root, output, { inputs: ['deck_spec.json', 'asset.json'] });
  assert.equal(next.fingerprint, first.fingerprint);
});

test('QA readiness cannot be asserted by an export flag alone', async (t) => {
  const { root, output, qa } = await project(t);
  for (const patch of [
    { export_ready: false }, { summary: { blocking: 1, degraded: 0 } }, { summary: { blocking: 0, degraded: 1 } },
    { summary: { blocking: 0, degraded: null } }, { findings: [null] }, { findings: [{ severity: 'unknown' }] },
    { findings: [{ severity: 'degraded' }] }, { findings: [{ severity: 'blocking' }] }, { artifact_binding: undefined },
    { artifact_binding: { ...qa.artifact_binding, fingerprint: '0'.repeat(64) } },
  ]) await assert.rejects(() => verifyArtifactBinding(root, output, { ...qa, ...patch }));
});

test('file boundary rejects escaped symlinks but accepts links inside the project', async (t) => {
  const { root, output } = await project(t);
  const outside = await mkdtemp(join(tmpdir(), 'storyweave-core-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'outside.json'), '{"outside":true}');
  await symlink(join(outside, 'outside.json'), join(root, 'outside-link.json'));
  await assert.rejects(() => createArtifactBinding(root, output, { inputs: ['outside-link.json'] }), /escapes/u);
  await symlink(join(root, 'deck_spec.json'), join(root, 'inside-link.json'));
  const binding = await createArtifactBinding(root, output, { inputs: ['inside-link.json'] });
  assert.equal(binding.files.find((file) => file.path === 'inside-link.json').sha256.length, 64);
});

test('missing declared inputs cannot produce verified output', async (t) => {
  const { root, output } = await project(t);
  await assert.rejects(() => createArtifactBinding(root, output, { inputs: ['missing.json'] }), /ENOENT/u);
  await assert.rejects(() => createArtifactBinding(root, output, { inputs: ['../escape'] }), /safe project-relative/u);
  await rm(join(root, 'slides/s01.html'));
  await assert.rejects(() => readVerifiedArtifact(root), /ENOENT/u);
});
