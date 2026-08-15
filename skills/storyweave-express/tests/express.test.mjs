import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildBentoDocument, parseBentoDocument, spliceBentoDocument, validateOutputManifest } from '../scripts/bento.mjs';

const manifest = {
  format: 'storyweave/slides', version: 1, producer: 'storyweave-imagegen', kind: 'image', title: '测试',
  canvas: { width: 2048, height: 1152 }, slides: [{ id: 's01', role: 'cover', source: 'slides/s01.png', notes: 'note' }],
};

test('Skill triggers only for packaging completed producer artifacts', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /storyweave-output\.json/);
  assert.match(skill, /不策划内容、不改写文案、不生成视觉主题/);
});

test('adapter accepts the shared manifest and emits one full-page image per slide', () => {
  assert.equal(validateOutputManifest(manifest).valid, true);
  const document = buildBentoDocument(manifest, ['data:image/png;base64,AA==']);
  assert.equal(document.format, 'bento/slides');
  assert.equal(document.slides[0].elements.length, 1);
  assert.deepEqual(document.slides[0].elements[0], { id: 's01-page', type: 'image', x: 0, y: 0, w: 2048, h: 1152, rotation: 0, opacity: 1, src: 'data:image/png;base64,AA==', fit: 'fill', radius: 0 });
});

test('Bento splicing preserves docId and escapes hostile text', () => {
  const shell = '<script type="application/bento+json" id="bento-doc">{}</script>';
  const previous = { ...buildBentoDocument(manifest, ['data:image/png;base64,AA==']), docId: 'stable' };
  const next = buildBentoDocument({ ...manifest, title: '</script>' }, ['data:image/png;base64,AA=='], previous);
  const output = spliceBentoDocument(shell, next, previous);
  assert.equal(parseBentoDocument(output).docId, 'stable');
  assert.doesNotMatch(output, /<\/script><\/script>/i);
});

