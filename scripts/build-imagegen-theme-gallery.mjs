#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'skills/storyweave-imagegen/assets/examples/theme-previews');
const catalog = JSON.parse(await readFile(join(repo, 'skills/storyweave-imagegen/assets/themes/catalog.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'provenance.json'), 'utf8'));
const styles = catalog.architectures.flatMap((architecture) => architecture.styles);
const records = new Map(provenance.previews.map((record) => [record.theme_ref, record]));
assert.equal(records.size, provenance.previews.length, 'Duplicate preview provenance');
assert.deepEqual([...records.keys()].sort(), styles.map((style) => style.ref).sort(), 'Every selectable theme needs an actual preview');
const escape = (text) => String(text).replace(/[&<>"']/gu, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function verifyPng(path, record) {
  const bytes = await readFile(path);
  assert.equal(hash(bytes), record.image_sha256, `Image bytes changed: ${path}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Expected actual PNG');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], record.actual_size);
  assert(Math.abs(record.actual_size[0] / record.actual_size[1] / (16 / 9) - 1) < 0.02);
}
const cards = [];
for (const style of styles) {
  const record = records.get(style.ref);
  assert(/^[a-z0-9-]+\.png$/u.test(record.file), `Unsafe preview path: ${record.file}`);
  await verifyPng(join(root, record.file), record);
  assert.equal(style.preview.cover, `../examples/theme-previews/${record.file}`);
  if (record.prompt) assert.equal(hash(await readFile(join(root, record.prompt))), record.prompt_sha256, `Preview prompt changed: ${style.ref}`);
  const id = style.ref.replace('/', '--');
  cards.push(`<article id="${escape(id)}"><a href="${escape(record.file)}"><img src="${escape(record.file)}" alt="${escape(style.label)}" width="${record.actual_size[0]}" height="${record.actual_size[1]}" loading="lazy"></a><div><h2>${escape(style.label)}</h2><code>${escape(style.ref)}</code><p>${record.visible_text ? '同内容流程样张' : '样式参考'} · candidate</p></div></article>`);
}
// The README poster and local comparison links must survive a fresh checkout too.
const poster = JSON.parse(await readFile(join(repo, 'docs/assets/storyweave-introduction.provenance.json'), 'utf8'));
await verifyPng(join(repo, 'docs/assets/storyweave-introduction.png'), poster);
assert.equal(hash(await readFile(join(repo, 'docs/assets', poster.prompt))), poster.prompt_sha256);
const readme = await readFile(join(repo, 'README.md'), 'utf8');
for (const [, path] of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gu)) if (!/^https?:/u.test(path)) await readFile(join(repo, path));
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imagegen 主题预览 · StoryWeave</title><style>*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#162636;font:16px/1.6 system-ui}main{max-width:1600px;margin:auto;padding:36px 24px}h1{margin:0 0 12px}header p{color:#526275;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#fff;border:1px solid #d5dde4;border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain}article div{padding:18px 22px}h2{font-size:23px;margin:0 0 4px}code{color:#3e6283}article p{margin:8px 0 0;color:#657484;font-size:14px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style></head><body><main><header><h1>Imagegen 主题预览</h1><p>${styles.length} 套候选主题。新增流程样张使用同一份内容，便于比较材质、绘画与场景语言。点击图片查看原图；整套演示仍按实际内容复核。</p></header><section class="grid">${cards.join('')}</section></main></body></html>\n`;
const target = join(root, 'index.html');
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), html, 'Rebuild the theme preview gallery');
else await writeFile(target, html);
console.log(JSON.stringify({ mode: process.argv.includes('--check') ? 'check' : 'build', themes: styles.length, preview_hashes_verified: records.size }));
