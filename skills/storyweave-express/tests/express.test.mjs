import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Producer and adapter assertions use the same canonical contract after runtime extraction.
import { buildBentoDocument, parseBentoDocument, spliceBentoDocument } from '../../../src/bento/document.mjs';
import { validateOutputManifest } from '../../../src/core/artifact.mjs';

const manifest = {
  format: 'storyweave/slides', version: 1, producer: 'storyweave-imagegen', kind: 'image', title: '测试', entry: 'index.html',
  canvas: { width: 2048, height: 1152 }, slides: [{ id: 's01', role: 'cover', source: 'slides/s01.png', notes: 'note' }],
};

const canonicalHtmlManifest = {
  format: 'storyweave/slides', version: 2, producer: 'storyweave-html', kind: 'html', title: 'Canonical', entry: 'index.html',
  canvas: { width: 1280, height: 720 }, theme_ref: 'editorial/paper-magazine', contract_version: 1,
  slides: [{ id: 's01', role: 'cover', source: 'slides/s01.html', render_recipe_ref: 'editorial/paper-magazine/render-paper-editorial-hero', render_recipe_sha256: '0'.repeat(64) }],
};

test('Skill triggers only for packaging completed producer artifacts', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /storyweave-output\.json/);
  // Routing depends on completed, verified input rather than the old wording of a scope disclaimer.
  const description = skill.match(/^description: (.+)$/mu)?.[1] ?? '';
  assert.match(description, /completed StoryWeave HTML pages or Imagegen slide images/u);
  assert.match(description, /passed current producer QA/u);
});

test('adapter accepts the shared manifest and emits one full-page image per slide', () => {
  assert.equal(validateOutputManifest(manifest).valid, true);
  const document = buildBentoDocument(manifest, ['data:image/png;base64,AA==']);
  assert.equal(document.format, 'bento/slides');
  assert.equal(document.slides[0].elements.length, 1);
  assert.deepEqual(document.slides[0].elements[0], { id: 's01-page', type: 'image', x: 0, y: 0, w: 2048, h: 1152, rotation: 0, opacity: 1, src: 'data:image/png;base64,AA==', fit: 'fill', radius: 0 });
});

test('adapter accepts canonical HTML version 2 manifests', () => {
  assert.equal(validateOutputManifest(canonicalHtmlManifest).valid, true);
  const document = buildBentoDocument(canonicalHtmlManifest, ['data:image/png;base64,AA==']);
  assert.equal(document.meta.theme_ref, 'editorial/paper-magazine');
  assert.equal(document.meta.source_manifest_version, 2);
});

test('Bento splicing preserves docId and escapes hostile text', () => {
  const shell = '<script type="application/bento+json" id="bento-doc">{}</script>';
  const previous = { ...buildBentoDocument(manifest, ['data:image/png;base64,AA==']), docId: 'stable' };
  const next = buildBentoDocument({ ...manifest, title: '</script>' }, ['data:image/png;base64,AA=='], previous);
  const output = spliceBentoDocument(shell, next, previous);
  assert.equal(parseBentoDocument(output).docId, 'stable');
  assert.doesNotMatch(output, /<\/script><\/script>/i);
});
