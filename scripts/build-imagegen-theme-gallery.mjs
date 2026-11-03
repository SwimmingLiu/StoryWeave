#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'skills/storyweave-imagegen/assets/examples/theme-previews');
const themeRoot = join(repo, 'skills/storyweave-imagegen/assets/themes');
const assetsRoot = await realpath(join(themeRoot, '..'));
const catalog = JSON.parse(await readFile(join(repo, 'skills/storyweave-imagegen/assets/themes/catalog.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'provenance.json'), 'utf8'));
const styles = catalog.architectures.flatMap((architecture) => architecture.styles);
const records = new Map(provenance.previews.map((record) => [record.theme_ref, record]));
assert.equal(records.size, provenance.previews.length, 'Duplicate preview provenance');
assert.deepEqual([...records.keys()].sort(), styles.map((style) => style.ref).sort(), 'Every selectable theme needs an actual preview');
const escape = (text) => String(text).replace(/[&<>"']/gu, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Selected architecture seeds already ship in the Skill; resolve contained asset paths instead of duplicating their PNGs.
async function previewAsset(path) {
  assert(typeof path === 'string' && !isAbsolute(path), `Unsafe preview path: ${path}`);
  const actual = await realpath(resolve(root, path));
  assert(actual.startsWith(`${assetsRoot}${sep}`), 'Preview evidence escaped the standalone Skill assets');
  return actual;
}
async function verifyPng(path, record) {
  const bytes = await readFile(path);
  assert.equal(hash(bytes), record.image_sha256, `Image bytes changed: ${path}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Expected actual PNG');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], record.actual_size);
  assert(Math.abs(record.actual_size[0] / record.actual_size[1] / (16 / 9) - 1) < 0.02);
}
const cards = [];
// The previous gallery led with dark materials despite a light-background preference; keep every stable ID but make selection explicit.
for (const style of [...styles].sort((a, b) => Number(b.recommendation === 'preferred') - Number(a.recommendation === 'preferred'))) {
  assert(['light', 'dark', 'bold'].includes(style.appearance), `Missing theme appearance: ${style.ref}`);
  assert(['preferred', 'optional'].includes(style.recommendation), `Missing recommendation: ${style.ref}`);
  const record = records.get(style.ref);
  assert(record.file.endsWith('.png'), `Expected PNG preview: ${record.file}`);
  const imagePath = await previewAsset(record.file);
  await verifyPng(imagePath, record);
  assert.equal(await realpath(resolve(themeRoot, style.preview.cover)), imagePath);
  if (record.prompt) assert.equal(hash(await readFile(await previewAsset(record.prompt))), record.prompt_sha256, `Preview prompt changed: ${style.ref}`);
  const id = style.ref.replace('/', '--');
  cards.push(`<article id="${escape(id)}" data-appearance="${style.appearance}"${style.appearance === 'light' ? '' : ' hidden'}><a href="${escape(record.file)}"><img src="${escape(record.file)}" alt="${escape(style.label)}" width="${record.actual_size[0]}" height="${record.actual_size[1]}" loading="lazy"></a><div><h2>${escape(style.label)}</h2><code>${escape(style.ref)}</code><p>${style.appearance === 'dark' ? '深色备选' : style.appearance === 'bold' ? '高饱和封面备选' : style.recommendation === 'preferred' ? '浅色优先' : '浅色备选'} · ${record.page_type === 'architecture-seed' ? '架构主题参考图' : record.visible_text ? '同内容流程样张' : '样式参考'} · candidate</p></div></article>`);
}
// The README poster and local comparison links must survive a fresh checkout too.
const poster = JSON.parse(await readFile(join(repo, 'docs/assets/storyweave-introduction.provenance.json'), 'utf8'));
await verifyPng(join(repo, 'docs/assets/storyweave-introduction.png'), poster);
assert.equal(hash(await readFile(join(repo, 'docs/assets', poster.prompt))), poster.prompt_sha256);
const readme = await readFile(join(repo, 'README.md'), 'utf8');
for (const [, path] of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gu)) if (!/^https?:/u.test(path)) await readFile(join(repo, path));
const lightCount = styles.filter((style) => style.appearance === 'light').length;
const darkCount = styles.filter((style) => style.appearance === 'dark').length;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imagegen 主题预览 · StoryWeave</title><style>
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f1f5f7;color:#203441;font:16px/1.65 system-ui}main{max-width:1600px;margin:auto;padding:36px 24px}h1{margin:0 0 12px}header p{max-width:1080px;color:#526b7a;margin:0 0 18px}a{color:#176482}nav{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 12px}button{font:inherit;cursor:pointer;border:1px solid #bdd1dc;border-radius:7px;background:white;color:#315e72;padding:8px 14px}button[aria-pressed=true]{background:#dfedf3;border-color:#72a4b9}.count{color:#647e8d;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#fff;border:1px solid #d5e1e7;border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain}article div{padding:18px 22px}h2{font-size:23px;margin:0 0 4px}code{color:#3e6283}article p{margin:8px 0 0;color:#657484;font-size:14px}:focus-visible{outline:3px solid #2884ac;outline-offset:3px}@media(max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body><main><header><h1>Imagegen 主题预览</h1><p>${styles.length} 套候选主题，默认展示浅色方向。深色与高饱和主题保留为显式备选。流程样张用于观察材质；复杂应用的组件与调用关系另看<a href="../../application-architecture-references/index.html">浅色架构参考</a>，整套演示仍按实际内容复核。</p></header><nav aria-label="主题明暗"><button data-theme-filter="light" aria-pressed="true">浅色优先 · ${lightCount}</button><button data-theme-filter="all" aria-pressed="false">全部主题 · ${styles.length}</button><button data-theme-filter="dark" aria-pressed="false">深色备选 · ${darkCount}</button></nav><p class="count" role="status">显示 ${lightCount} 套主题</p><section class="grid">${cards.join('')}</section></main><script>
const cards=[...document.querySelectorAll('article[data-appearance]')];const filters=[...document.querySelectorAll('[data-theme-filter]')];const select=(choice)=>{for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.themeFilter===choice));for(const card of cards)card.hidden=choice!=='all'&&card.dataset.appearance!==choice;document.querySelector('[role=status]').textContent='显示 '+cards.filter(card=>!card.hidden).length+' 套主题';};for(const button of filters)button.addEventListener('click',()=>select(button.dataset.themeFilter));const followAnchor=()=>{const selected=cards.find(card=>card.id===decodeURIComponent(location.hash.slice(1)));if(selected)select(selected.dataset.appearance==='bold'?'all':selected.dataset.appearance);};addEventListener('hashchange',followAnchor);followAnchor();
</script></body></html>\n`;
const target = join(root, 'index.html');
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), html, 'Rebuild the theme preview gallery');
else await writeFile(target, html);
console.log(JSON.stringify({ mode: process.argv.includes('--check') ? 'check' : 'build', themes: styles.length, preview_hashes_verified: records.size }));
