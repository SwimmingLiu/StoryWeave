#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = await readFile(join(root, 'design-library/presentation-references/catalog.json'), 'utf8');
const catalog = JSON.parse(source);
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); if (index < 0) return null; if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value.`); return resolve(args[index + 1]); };
const cacheRoot = option('--cache');
const customOutput = option('--out');
if (Boolean(cacheRoot) !== Boolean(customOutput)) throw new Error('Use --cache and --out together for an offline viewer.');
const output = customOutput ?? join(root, 'skills/storyweave-imagegen/assets/reference-library');
if (cacheRoot && output.startsWith(`${join(root, 'skills')}${sep}`)) throw new Error('Keep offline image exports outside the distributed Skills.');
const check = process.argv.includes('--check');
const escape = (text) => String(text).replace(/[&<>"']/gu, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]);
const categories = new Map(catalog.categories.map(({ id, label }) => [id, label]));
// A style-level label hid which image supported a role. Keep evidence and filtering on each content page.
const roles = new Map(catalog.roles.map(({ id, label }) => [id, label]));
const requiredRoles = catalog.required_roles;
const ids = new Set();
const imageUrls = new Set();
const coverage = [];

if (catalog.schema_version !== 2 || requiredRoles.some((role) => !roles.has(role))) throw new Error('Expected a version 2 page catalog with known required roles.');

// Remote availability did not guarantee that a local gallery could load images. Offline exports embed verified original bytes.
const imageInputs = new Map();
if (cacheRoot) {
  const cache = JSON.parse(await readFile(join(cacheRoot, 'cache.json'), 'utf8'));
  if (cache.catalog_sha256 !== createHash('sha256').update(source).digest('hex')) throw new Error('Refresh the image cache for this catalog.');
  await Promise.all(catalog.cases.flatMap((item) => item.pages).map(async (page) => {
    const record = cache.images[page.url];
    if (!record) throw new Error(`Missing offline image: ${page.title}`);
    const path = await realpath(resolve(cacheRoot, record.path));
    if (!path.startsWith(`${cacheRoot}${sep}`)) throw new Error('Offline image escapes its cache.');
    const bytes = await readFile(path);
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error(`Offline image changed: ${page.title}`);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(record.mime) || record.width !== page.width || record.height !== page.height) throw new Error(`Offline image metadata differs: ${page.title}`);
    imageInputs.set(page.url, `data:${record.mime};base64,${bytes.toString('base64')}`);
  }));
}

for (const item of catalog.cases) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate style: ${item.id}`);
  ids.add(item.id);
  if (!categories.has(item.category)) throw new Error(`Unknown category: ${item.id}`);
  for (const key of ['title', 'description', 'presentation_fit', 'visual_language', 'html_boundary', 'creator', 'provenance_note', 'license_note']) {
    if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`Missing ${key}: ${item.id}`);
  }
  if (!item.pages?.length) throw new Error(`Missing content pages: ${item.id}`);
  const pageIds = new Set();
  for (const page of item.pages) {
    if (!page.id || pageIds.has(page.id)) throw new Error(`Duplicate or missing page ID: ${item.id}`);
    pageIds.add(page.id);
    if (!Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width <= 0 || page.height <= 0 || Math.abs(page.width / page.height / (16 / 9) - 1) > 0.02) throw new Error(`Expected landscape slide: ${item.id}/${page.id}`);
    if (imageUrls.has(page.url)) throw new Error(`An image cannot count as two references: ${page.url}`);
    imageUrls.add(page.url);
    if (!page.roles?.length || new Set(page.roles).size !== page.roles.length || page.roles.some((role) => !roles.has(role) || !page.role_notes?.[role]?.trim())) throw new Error(`Missing observed role evidence: ${item.id}/${page.id}`);
    if (page.visual_review?.status !== 'inspected' || page.visual_review?.method !== 'browser' || !page.html_assessment?.trim()) throw new Error(`Missing visual selection evidence: ${item.id}/${page.id}`);
    for (const key of ['title', 'creator', 'provenance_note', 'license_note']) {
      if (typeof page[key] !== 'string' || !page[key].trim()) throw new Error(`Missing page ${key}: ${item.id}/${page.id}`);
    }
    for (const url of [page.url, page.source_url, page.prompt_url]) {
      if (new URL(url).protocol !== 'https:') throw new Error(`Expected HTTPS source: ${item.id}/${page.id}`);
    }
  }
  const counts = Object.fromEntries([...roles.keys()].map((role) => [role, item.pages.filter((page) => page.roles.includes(role)).length]));
  coverage.push({ id: item.id, title: item.title, pages: item.pages.length, role_counts: counts, missing_roles: requiredRoles.filter((role) => !counts[role]) });
}

const sorted = [...catalog.cases].sort((a, b) => Number(b.technical_priority) - Number(a.technical_priority));
const cards = sorted.map((item) => {
  const summary = coverage.find((entry) => entry.id === item.id);
  const search = [item.id, item.title, item.description, item.creator, item.presentation_fit, ...item.pages.map((page) => page.title)].join(' ').toLowerCase();
  const pages = item.pages.map((page, position) => `<details class="page" data-page="${escape(page.id)}" data-roles="${escape(page.roles.join(' '))}"${position === 0 ? ' open' : ''}>
<summary>${escape(page.title)}<span>${escape(page.roles.map((role) => roles.get(role)).join(' · '))}</span></summary>
<div class="image-frame" data-image-frame data-state="pending"><button class="image-open" aria-label="放大 ${escape(page.title)}"><img src="${escape(imageInputs.get(page.url) ?? page.url)}" alt="${escape(item.title)} · ${escape(page.title)}" width="${page.width}" height="${page.height}" loading="${position === 0 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer"></button><p class="loading-message">正在加载图片…</p><div class="image-error" hidden>图片未能加载。<button data-retry>重试</button> · <a href="${escape(page.url)}" target="_blank" rel="noreferrer">查看原图</a></div></div>
<div class="page-copy"><p>${escape(Object.entries(page.role_notes).map(([role, note]) => `${roles.get(role)}：${note}`).join(' '))}</p><a href="${escape(page.source_url)}" target="_blank" rel="noreferrer">本页来源 ↗</a> · <a href="${escape(page.prompt_url)}" target="_blank" rel="noreferrer">${page.prompt_scope === 'tool-system-prompt' ? '工具提示词' : '提示词或视觉规范'} ↗</a></div></details>`).join('');
  return `<article id="${escape(item.id)}" data-category="${escape(item.category)}" data-search="${escape(search)}">
<div class="copy"><p class="category">${escape(categories.get(item.category))}${item.technical_priority ? ' · 技术分享优先' : ''} · ${item.pages.length} 张内容页</p><h2>${escape(item.title)}</h2><p>${escape(item.description)}</p><p class="fit">${escape(item.presentation_fit)}</p>
<div class="coverage" aria-label="页型覆盖">${requiredRoles.map((role) => `<span data-covered="${Boolean(summary.role_counts[role])}">${escape(roles.get(role))} ${summary.role_counts[role]}</span>`).join('')}</div>
${summary.missing_roles.length ? `<p class="gaps">待补 · ${escape(summary.missing_roles.map((role) => roles.get(role)).join('、'))}</p>` : '<p class="complete">已包含四类内容页</p>'}</div>
<div class="pages">${pages}</div><div class="copy foot"><details><summary>视觉语言与应用范围</summary><p>${escape(item.visual_language)}</p><p>${escape(item.html_boundary)}</p><p>${escape(item.limits)}</p><p>${escape(item.creator)} · ${escape(item.provenance_note)}</p><p>${escape(item.license_note)}</p><a href="${escape(item.case_url)}" target="_blank" rel="noreferrer">样式来源 ↗</a>${item.successor_url ? ` · <a href="${escape(item.successor_url)}" target="_blank" rel="noreferrer">作者当前项目 ↗</a>` : ''}</details></div></article>`;
}).join('\n');

const statistics = { styles: ids.size, content_pages: imageUrls.size, by_role: Object.fromEntries([...roles.keys()].map((role) => [role, catalog.cases.flatMap((item) => item.pages).filter((page) => page.roles.includes(role)).length])), multi_page_styles: coverage.filter((item) => item.pages > 1).length, complete_styles: coverage.filter((item) => !item.missing_roles.length).length };

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>演讲与分享稿主题参考 · StoryWeave</title><style>
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f3f5f7;color:#233248;font:16px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1660px;margin:auto;padding:40px}h1{font-size:34px;line-height:1.25;font-weight:650;margin:0 0 14px}header p{max-width:1000px;color:#5d6e80;margin:0}a{color:#155ca2;text-underline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 12px;align-items:center}button,input{font:inherit;border:1px solid #c9d3df;border-radius:8px;background:#fff;padding:9px 14px;color:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#185b9b;border-color:#185b9b;color:#fff}input{margin-left:auto;min-width:250px;max-width:100%}:focus-visible{outline:3px solid #1679c9;outline-offset:3px}.roles{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.roles button{padding:6px 12px;font-size:14px}.count{color:#66778a;font-size:14px;margin:14px 0 20px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:start}article{min-width:0;background:white;border:1px solid #d8e0e9;border-radius:12px;overflow:hidden}img{width:100%;height:auto;aspect-ratio:16/9;display:block;object-fit:contain;background:#e8edf3}.image-frame{position:relative;min-height:150px;aspect-ratio:16/9;background:#e8edf3}.image-open{display:block;width:100%;border:0;padding:0;background:transparent}.loading-message,.image-error{position:absolute;inset:0;display:grid;place-content:center;text-align:center;margin:0;padding:20px;color:#52687c;font-size:14px;background:#e8edf3}.loading-message{display:none}.image-frame[data-state=loading] .loading-message{display:grid}.image-frame[data-state=error] .image-open{visibility:hidden}.image-error{display:block;padding-top:20%}.image-error button{padding:4px 10px}dialog{border:0;padding:44px 12px 12px;background:#152033;width:min(96vw,1700px);max-height:96vh;border-radius:10px}dialog::backdrop{background:#000c}dialog img{max-height:85vh;width:100%;height:auto;object-fit:contain;background:#152033}dialog button{position:absolute;right:12px;top:8px;padding:3px 12px}.copy{padding:20px 24px}.category{color:#66788b;font-size:13px;margin:0 0 5px}h2{font-size:24px;line-height:1.35;margin:0 0 10px;font-weight:600}.copy p{margin:0 0 12px}.fit{color:#52687c;font-size:14px}.coverage{display:flex;gap:8px;flex-wrap:wrap}.coverage span{font-size:12px;border:1px solid #c9dcec;border-radius:20px;color:#245c8d;padding:3px 9px;background:#f1f7fd}.coverage [data-covered=false]{color:#8993a0;background:#f8f9fb;border-style:dashed}.gaps,.complete{margin:8px 0 0!important;font-size:12px;color:#7c858f}.complete{color:#397561}.pages{padding:0 16px}details{font-size:14px;color:#5c6e80}summary{cursor:pointer;color:#275f96}details p{margin-top:10px}.page{border-top:1px solid #e2e7ee}.page>summary{padding:12px 8px;font-weight:550}.page>summary span{float:right;font-size:12px;font-weight:400;color:#718194}.page-copy{padding:4px 8px 16px;font-size:12px}.foot{padding-top:16px}.foot>details{border-top:1px solid #e2e7ee;padding-top:12px}footer{margin:28px 0 0;font-size:14px;color:#66778a}footer a{margin-right:16px}.empty{font-size:18px;color:#5d6e80;margin:36px 0}@media(max-width:850px){main{padding:22px 16px}.grid{grid-template-columns:1fr}h1{font-size:28px}input{margin:4px 0 0;width:100%}nav{gap:7px}button{padding:8px 10px}.copy{padding:18px}.page>summary span{float:none;display:block;padding-left:15px}}
</style></head><body><main><header><h1>演讲与分享稿主题参考</h1><p>从实际内容页选择整套演示的视觉方向。技术原理、概念说明、方法步骤与观点分享各有适合的画面组织。</p></header>
<nav aria-label="筛选主题"><button data-filter="all" aria-pressed="true">全部风格</button>${catalog.categories.map(({ id, label }) => `<button data-filter="${escape(id)}" aria-pressed="false">${escape(label)}</button>`).join('')}<input type="search" aria-label="搜索主题" placeholder="搜索主题、场景或页面内容"></nav>
<div class="roles" role="group" aria-label="筛选页型"><button data-role="all" aria-pressed="true">全部页型</button>${[...roles].map(([id, label]) => `<button data-role="${escape(id)}" aria-pressed="false">${escape(label)}</button>`).join('')}</div>
<p class="count" role="status">显示 ${statistics.styles} 种风格 · ${statistics.content_pages} 张内容页</p><section class="grid" aria-label="演示主题参考">${cards}</section><p class="empty" hidden>没有匹配的主题或内容页。</p>
<footer>展开内容页，点击图片放大。${cacheRoot ? '图片已内嵌，可离线查看。' : '原图需要联网加载。'}<a href="catalog.json">来源目录</a><a href="coverage.json">页型覆盖</a><a href="${cacheRoot ? 'presentation-cases.md' : '../../references/presentation-cases.md'}">参考使用方法</a></footer></main><dialog aria-label="参考图大图"><button data-close>关闭</button><img alt=""></dialog><script>
const cards=[...document.querySelectorAll('article')];
const buttons=[...document.querySelectorAll('[data-filter]')];
const roleButtons=[...document.querySelectorAll('[data-role]')];
const input=document.querySelector('input');
// Style tags previously left an unrelated first image open. Select matching pages before expanding a preview.
const update=()=>{const category=document.querySelector('[data-filter][aria-pressed="true"]').dataset.filter;const role=document.querySelector('[data-role][aria-pressed="true"]').dataset.role;const query=input.value.trim().toLowerCase();let count=0;let pageCount=0;for(const card of cards){const pages=[...card.querySelectorAll('[data-page]')];const matching=pages.filter(page=>role==='all'||page.dataset.roles.split(' ').includes(role));card.hidden=(category!=='all'&&card.dataset.category!==category)||!card.dataset.search.includes(query)||!matching.length;for(const page of pages){page.hidden=!matching.includes(page);page.open=page===matching[0];}if(!card.hidden){count++;pageCount+=matching.length;}}document.querySelector('[role="status"]').textContent='显示 '+count+' 种风格 · '+pageCount+' 张内容页';document.querySelector('.empty').hidden=count!==0;};
for(const button of buttons)button.addEventListener('click',()=>{for(const current of buttons)current.setAttribute('aria-pressed',String(current===button));update();});
for(const button of roleButtons)button.addEventListener('click',()=>{for(const current of roleButtons)current.setAttribute('aria-pressed',String(current===button));update();});
input.addEventListener('input',update);
// Closed details and failed remote requests previously produced silent blank panels. Load on expansion and expose failures.
for(const page of document.querySelectorAll('[data-page]'))page.addEventListener('toggle',()=>{if(page.open)page.querySelector('img').loading='eager';});
const dialog=document.querySelector('dialog');
const zoomImage=dialog.querySelector('img');
document.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
for(const frame of document.querySelectorAll('[data-image-frame]')){const picture=frame.querySelector('img');const failure=frame.querySelector('.image-error');const state=(value)=>{frame.dataset.state=value;failure.hidden=value!=='error';};picture.addEventListener('load',()=>state('ready'));picture.addEventListener('error',()=>state('error'));frame.querySelector('[data-retry]').addEventListener('click',()=>{state('loading');picture.loading='eager';picture.src=picture.src;});frame.querySelector('.image-open').addEventListener('click',()=>{if(picture.naturalWidth){zoomImage.src=picture.src;zoomImage.alt=picture.alt;dialog.showModal();}});state(picture.complete?(picture.naturalWidth?'ready':'error'):'loading');}
</script></body></html>
`;

const coverageJson = `${JSON.stringify({ schema_version: 1, totals: statistics, styles: coverage }, null, 2)}\n`;
for (const [name, bytes] of [['catalog.json', source], ['index.html', html], ['coverage.json', coverageJson]]) {
  const path = join(output, name);
  if (check) {
    if (await readFile(path, 'utf8') !== bytes) throw new Error(`Reference assets differ: ${name}`);
  } else {
    await mkdir(output, { recursive: true });
    await writeFile(path, bytes);
  }
}
if (cacheRoot && !check) await writeFile(join(output, 'presentation-cases.md'), (await readFile(join(root, 'skills/storyweave-imagegen/references/presentation-cases.md'), 'utf8')).replaceAll('../assets/reference-library/', ''));
console.log(JSON.stringify({ mode: check ? 'check' : 'build', ...statistics, embedded_images: imageInputs.size, output }));
