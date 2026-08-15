import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { approveOutline, createOutline } from '../scripts/lib/outline.mjs';
import {
  IMAGEGEN_MODE,
  compileImageJobs,
  createStoryweaveOutput,
  createGenerationManifest,
  imageDimensions,
  inspectGeneratedImage,
} from '../scripts/lib/imagegen.mjs';

const themes = {
  id: 'editorial',
  label: '编辑叙事',
  art_direction: 'premium independent magazine spread',
  composition: 'asymmetric editorial spread with generous negative space',
  palette: 'paper ivory, carbon black, oxide red',
  typography: 'large Chinese serif headline',
  imagery: 'documentary editorial photography',
  materials: 'uncoated paper grain',
  anchors: ['oxide-red marker'],
  avoid: ['website cards'],
  text_layout: 'headline in a quiet upper-left field',
  contrast: 'paper field with dark text',
};

test('imagegen jobs create complete-slide prompts with exact text and strict defaults', () => {
  const outline = createOutline('测试演示');
  const deck = approveOutline(outline, { mode: IMAGEGEN_MODE, theme: themes.id });
  const jobs = compileImageJobs(deck, themes);
  assert.equal(jobs.length, outline.slides.length);
  assert.equal(jobs[0].size, '2048x1152');
  assert.equal(jobs[0].quality, 'medium');
  assert.equal(jobs[0].asset_role, 'complete-slide');
  assert.equal(jobs[0].text_policy, 'exact-text-in-image');
  assert.match(jobs[0].prompt, /complete rasterized presentation slide/);
  assert.match(jobs[0].prompt, /Frozen layout plan/);
  assert.match(jobs[0].prompt, /AI 原生知识工作流/);
  assert.match(jobs[0].prompt, /no watermark/);
  assert.doesNotMatch(jobs[0].prompt, /html overlay/i);
});

test('manifest requires visual review before export', () => {
  const outline = createOutline();
  const deck = approveOutline(outline, { mode: IMAGEGEN_MODE, theme: themes.id });
  const jobs = compileImageJobs(deck, themes);
  const manifest = createGenerationManifest(deck, jobs);
  assert.equal(manifest.mode, IMAGEGEN_MODE);
  assert.equal(manifest.slides[0].status, 'prepared');
});

test('completed image producer exposes the adapter-neutral Storyweave manifest', () => {
  const deck = approveOutline(createOutline(), { mode: IMAGEGEN_MODE, theme: themes.id });
  const manifest = createGenerationManifest(deck, compileImageJobs(deck, themes));
  const output = createStoryweaveOutput(deck, manifest);
  assert.equal(output.format, 'storyweave/slides');
  assert.equal(output.producer, 'storyweave-imagegen');
  assert.equal(output.kind, 'image');
  assert.equal(output.slides[0].source, 'slides/s01.png');
  assert.equal(JSON.stringify(output).toLowerCase().includes('bento'), false);
});

test('image dimensions accept a valid 2048x1152 PNG and reject a wrong ratio', async () => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-imagegen-'));
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
  png.writeUInt32BE(2048, 16);
  png.writeUInt32BE(1152, 20);
  const good = join(root, 's01.png');
  await writeFile(good, png);
  assert.deepEqual(imageDimensions(png, good), { width: 2048, height: 1152, format: 'png' });
  assert.equal((await inspectGeneratedImage(good, '2048x1152')).valid, true);
  const bad = join(root, 's02.png');
  const badPng = Buffer.from(png);
  badPng.writeUInt32BE(1000, 16);
  await writeFile(bad, badPng);
  assert.equal((await inspectGeneratedImage(bad, '2048x1152')).valid, false);
});
