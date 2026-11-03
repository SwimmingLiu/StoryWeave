#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderCasebook } from './render-generated-casebook.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourcePath = join(repo, 'design-library/application-architecture-references/catalog.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const escape = (text) => String(text).replace(/[&<>"']/gu, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]);

export function validateCatalog(catalog) {
  assert.equal(catalog.schema_version, 1);
  assert(Array.isArray(catalog.cases) && catalog.cases.length, 'Expected architecture cases');
  const ids = new Set();
  const urls = new Set();
  const curationCodes = new Set();
  for (const item of catalog.cases) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.id) && !ids.has(item.id), 'Duplicate or invalid architecture case');
    ids.add(item.id);
    for (const key of ['title', 'category', 'kind', 'creator', 'description', 'selection_note', 'limits', 'license_note', 'generation_note']) assert(typeof item[key] === 'string' && item[key].trim(), `Missing ${key}: ${item.id}`);
    assert(['html', 'imagegen'].includes(item.target), `Unknown render route: ${item.id}`);
    assert(['project', 'sample', 'teaching', 'ai-example', 'visual-reference', 'generated-example'].includes(item.kind), `Unknown reference kind: ${item.id}`);
    assert.equal(item.target === 'imagegen', ['visual-reference', 'generated-example'].includes(item.kind), 'Source architecture and AI whiteboard examples stay on the HTML route');
    assert.equal(item.imagegen_reference_eligible, item.target === 'imagegen', `A structural reference cannot enter Imagegen: ${item.id}`);
    if (item.target === 'html') assert.equal(item.theme_ref, null, 'HTML references do not create Imagegen themes');
    else assert(typeof item.theme_ref === 'string' && item.theme_ref.includes('/'), 'Imagegen examples must link to an existing theme');
    if (item.kind === 'generated-example') {
      assert(/^[A-Z][1-9][0-9]*$/u.test(item.curation?.code) && !curationCodes.has(item.curation.code), 'Generated choices need distinct readable codes');
      curationCodes.add(item.curation.code);
      assert(item.curation.family?.trim() && item.curation.reason?.trim() && typeof item.curation.representative === 'boolean' && typeof item.curation.selected === 'boolean', 'Generated choices need similarity groups and an explicit selection state');
    }
    assert.equal(new URL(item.source_url).protocol, 'https:');
    assert(Array.isArray(item.pages) && item.pages.length, `Missing figures: ${item.id}`);
    const pageIds = new Set();
    for (const page of item.pages) {
      assert(page.id && !pageIds.has(page.id) && page.title?.trim(), 'Expected a distinct, named original figure');
      pageIds.add(page.id);
      assert.equal(new URL(page.url).protocol, 'https:');
      assert(!urls.has(page.url), 'An original figure cannot count twice');
      urls.add(page.url);
      assert(Number.isInteger(page.width) && page.width > 0 && Number.isInteger(page.height) && page.height > 0, 'Expected original dimensions');
      assert(/^[a-f0-9]{64}$/u.test(page.sha256), 'Expected original byte hash');
      assert(page.roles?.includes('architecture'), 'Every case must actually explain architecture');
      assert.equal(page.review?.method, 'actual-image', 'Use an actual-image observation, not a fabricated browser record');
      assert.equal(page.review?.reviewed_sha256, page.sha256, 'Review must bind the actual original bytes');
      assert(page.review?.notes?.trim(), 'Record the observed organization and limitations');
      // Generated examples need their shipped source and invocation record; a remote URL alone cannot establish provenance.
      if (item.kind === 'generated-example') assert(page.local_asset && page.provenance && page.prompt, `Missing generated evidence: ${item.id}`);
    }
  }
  return catalog;
}

async function localFile(path) {
  const actual = await realpath(resolve(repo, path));
  assert(actual.startsWith(`${repo}${sep}`), 'Local reference escaped the repository');
  return actual;
}

async function checkGeneratedEvidence(item, page, bytes) {
  const path = await localFile(page.provenance);
  const directory = dirname(path);
  const read = async (name) => {
    const file = await localFile(relative(repo, resolve(directory, name)));
    assert(file.startsWith(`${directory}${sep}`), 'Generated evidence must stay inside its standalone asset directory');
    return readFile(file);
  };
  const evidence = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(evidence.schema_version, 1);
  assert(evidence.source.tool && Object.hasOwn(evidence.source, 'model_id'), 'Disclose the tool and whether a model ID was reported');
  assert.equal(hash(await read(evidence.content_spec.path)), evidence.content_spec.sha256, 'Generated content spec changed');
  assert.equal(hash(await read(evidence.visual_intent.path)), evidence.visual_intent.sha256, 'Generated visual intent changed');
  const content = JSON.parse(await read(evidence.content_spec.path)).cases.find((entry) => entry.id === item.id);
  const record = evidence.images.find((entry) => entry.id === item.id);
  assert(content && record, `Missing generated image record: ${item.id}`);
  assert.equal(hash(await read(record.output.path)), hash(bytes), 'Generated record points to another image');
  for (const key of ['sha256', 'width', 'height']) assert.equal(record.output[key], page[key], `Generated ${key} changed`);
  assert.equal(record.output.bytes, bytes.length);
  for (const attempt of record.attempts) assert.equal(hash(await read(attempt.prompt)), attempt.prompt_sha256, 'Generated prompt changed');
  assert.equal(record.attempts.at(-1).output_sha256, page.sha256, 'Selected generated attempt changed');
  assert.equal(await localFile(page.prompt), await localFile(relative(repo, resolve(directory, record.attempts.at(-1).prompt))), 'Selected prompt changed');
  // Bind actual authored observations to the pixels and content; these checks never infer or fill visual acceptance.
  assert.equal(record.review.method, 'actual-image');
  assert.equal(record.review.status, 'accepted-for-reference');
  assert.equal(record.review.reviewed_sha256, page.sha256);
  assert.equal(record.review.content_spec_sha256, evidence.content_spec.sha256);
  const selection = JSON.parse(await read('selection.json'));
  assert.equal(selection.selected.some((entry) => entry.id === item.id), item.curation.selected, 'Casebook selection changed');
  if (item.curation.selected) assert.equal(record.derived_theme_ref, item.theme_ref, 'Selected theme no longer matches its source image');
  assert.deepEqual(record.review.observed_nodes, content.nodes);
  assert.deepEqual(record.review.observed_edges, content.edges);
  assert(record.review.notes && record.review.text && record.review.composition && record.review.limits);
}

async function canonicalDestination(path) {
  try { return await realpath(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return join(await canonicalDestination(dirname(path)), basename(path));
  }
}

export async function buildGallery({ check = false, cacheRoot = null, output = null } = {}) {
  assert.equal(Boolean(cacheRoot), Boolean(output), 'Use --cache and --out together for a private offline viewer');
  // A lexical prefix missed equal paths and linked ancestors, allowing private originals into distributed Skills.
  const outputDirectory = output ? await canonicalDestination(resolve(output)) : null;
  const skillsDirectory = await realpath(join(repo, 'skills'));
  if (outputDirectory) assert(outputDirectory !== skillsDirectory && !outputDirectory.startsWith(`${skillsDirectory}${sep}`), 'Offline originals stay outside distributed Skills');
  // Resolve both sides before writing so exporting cannot modify a supplied read-only cache through an alias.
  const cacheDirectory = cacheRoot ? await realpath(cacheRoot) : null;
  if (cacheDirectory) assert(outputDirectory !== cacheDirectory && !outputDirectory.startsWith(`${cacheDirectory}${sep}`), 'Offline output must stay outside the input cache');
  const source = await readFile(sourcePath);
  const catalog = validateCatalog(JSON.parse(source));
  const themeCatalog = JSON.parse(await readFile(join(repo, 'skills/storyweave-imagegen/assets/themes/catalog.json'), 'utf8'));
  const themes = new Set(themeCatalog.architectures.flatMap((entry) => entry.styles.map((style) => style.ref)));
  for (const item of catalog.cases.filter((entry) => entry.target === 'imagegen')) assert(themes.has(item.theme_ref), `Unknown architecture theme: ${item.theme_ref}`);
  const cache = cacheDirectory ? JSON.parse(await readFile(join(cacheDirectory, 'cache.json'), 'utf8')) : null;
  if (cache) assert.equal(cache.catalog_sha256, hash(source), 'Refresh the architecture cache for this catalog');
  const images = new Map();
  for (const item of catalog.cases) for (const page of item.pages) {
    if (page.local_asset) {
      const bytes = await readFile(await localFile(page.local_asset));
      assert.equal(hash(bytes), page.sha256, `Local original changed: ${item.id}`);
      if (item.kind === 'generated-example') await checkGeneratedEvidence(item, page, bytes);
      if (item.license_path) await readFile(await localFile(item.license_path));
    }
    if (cache) {
      const record = cache.images[page.url];
      assert(record, `Missing cached original: ${item.id}`);
      const path = await realpath(resolve(cacheDirectory, record.path));
      assert(path.startsWith(`${cacheDirectory}${sep}`), 'Cached original escaped its directory');
      const bytes = await readFile(path);
      assert.equal(hash(bytes), page.sha256, `Cached original changed: ${item.id}`);
      assert.equal(record.sha256, page.sha256);
      assert.equal(record.bytes, bytes.length);
      assert.equal(record.width, page.width);
      assert.equal(record.height, page.height);
      assert(['image/png', 'image/jpeg', 'image/webp'].includes(record.mime));
      images.set(page.url, `data:${record.mime};base64,${bytes.toString('base64')}`);
    }
  }
  const targets = outputDirectory ? [[outputDirectory, catalog.cases]] : [
    [dirname(sourcePath), catalog.cases],
    [join(repo, 'skills/storyweave-html/assets/application-architecture-references'), catalog.cases.filter((item) => item.target === 'html')],
    [join(repo, 'skills/storyweave-imagegen/assets/application-architecture-references'), catalog.cases.filter((item) => item.target === 'imagegen')],
    // A dedicated local-image edition lets readers compare the complete generated set without external image servers.
    [join(repo, 'skills/storyweave-imagegen/assets/application-architecture-references/generated-cases'), catalog.cases.filter((item) => item.kind === 'generated-example')],
  ];
  for (const [directory, cases] of targets) {
    const subset = { ...catalog, cases };
    const figures = [...cases].sort((a, b) => Number(Boolean(b.curation?.selected)) - Number(Boolean(a.curation?.selected)) || Number(b.kind === 'generated-example') - Number(a.kind === 'generated-example')).flatMap((item) => item.pages.map((page) => {
      const src = images.get(page.url) ?? (page.local_asset ? relative(directory, resolve(repo, page.local_asset)).split(sep).join('/') : page.url);
      const license = item.license_path ? `<a href="${escape(relative(directory, resolve(repo, item.license_path)).split(sep).join('/'))}">许可文本</a>` : '';
      return `<article data-case="${escape(item.id)}" data-page="${escape(page.id)}" data-target="${item.target}" data-kind="${item.kind}" data-search="${escape([item.title, item.category, item.creator, item.description, item.theme_ref ?? ''].join(' ').toLowerCase())}"><div class="frame"><button data-zoom aria-label="放大 ${escape(item.title)}"><img data-figure src="${escape(src)}" alt="${escape(item.title)}" width="${page.width}" height="${page.height}" loading="eager" referrerpolicy="no-referrer"></button><p data-error hidden>图片未能加载。<button data-retry>重试</button> · <a href="${escape(page.url)}" target="_blank" rel="noreferrer">原图</a></p></div><div class="copy"><p class="tag">${item.target === 'imagegen' ? 'Imagegen · 插画与空间表达' : 'HTML / SVG · 架构讲解'} · ${escape(item.category)}</p><h2>${escape(item.title)}</h2><p>${escape(item.selection_note)}</p><details><summary>用途与来源</summary><p>${escape(item.limits)}</p><p>${escape(item.generation_note)}</p><p>${escape(item.license_note)}</p></details><p class="links"><a href="${escape(item.source_url)}" target="_blank" rel="noreferrer">${escape(item.creator)} · 来源 ↗</a>${license}${page.provenance ? `<a href="${escape(relative(directory, resolve(repo, page.provenance)).split(sep).join('/'))}">生成与逐图观察</a><a href="${escape(relative(directory, resolve(repo, page.prompt)).split(sep).join('/'))}">提示词</a>` : ''}</p></div></article>`;
    })).join('');
    // Similar media overwhelmed comparison; the generated edition starts with one representative per family and leaves selection to the reader.
    const html = cases.every((item) => item.kind === 'generated-example') ? renderCasebook({ cases, assetUrl: (path) => relative(directory, resolve(repo, path)).split(sep).join('/'), imageUrl: (page) => images.get(page.url) ?? relative(directory, resolve(repo, page.local_asset)).split(sep).join('/') }) : `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>应用架构讲解参考 · StoryWeave</title><style>
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f5f7f8;color:#243746;font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1560px;margin:auto;padding:36px 28px}h1{font-size:34px;line-height:1.25;margin:0 0 14px}header p{max-width:1080px;color:#587080}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}button,input{font:inherit;border:1px solid #c8d8df;border-radius:7px;background:#fff;color:#28516a;padding:8px 13px}button{cursor:pointer}button[aria-pressed=true]{background:#e2f0f5;border-color:#77a9bd}input{margin-left:auto;min-width:250px}a{color:#176284;text-underline-offset:4px}:focus-visible{outline:3px solid #2884ac;outline-offset:3px}.count{color:#6c7f8d;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:start}article{background:white;border:1px solid #dce5e9;border-radius:10px;overflow:hidden}.frame{min-height:230px;border-bottom:1px solid #edf1f3}.frame>button{display:block;width:100%;padding:12px;border:0;border-radius:0;background:white}.frame img{display:block;width:100%;height:310px;object-fit:contain;background:white}article[data-kind="generated-example"] .frame img{height:auto;aspect-ratio:16/9}.frame>p{margin:10px 18px}.copy{padding:20px 24px}.tag{font-size:12px;color:#507b8d;margin:0 0 8px}h2{font-size:22px;line-height:1.4;margin:0 0 12px}.copy p{margin:10px 0}.copy>p:not(.tag){font-size:14px;color:#566b7a}details{font-size:13px;color:#677e8c}summary{cursor:pointer}.links{display:flex;gap:20px;flex-wrap:wrap}dialog{border:1px solid #c8d8df;border-radius:10px;background:#fff;width:min(96vw,1700px);max-height:96vh;padding:48px 16px 16px}dialog::backdrop{background:#15344499}dialog img{display:block;width:100%;max-height:83vh;object-fit:contain}dialog button{position:absolute;right:12px;top:9px}footer{font-size:13px;color:#69808d;margin-top:28px}@media(max-width:820px){main{padding:24px 16px}.grid{grid-template-columns:1fr}h1{font-size:28px}input{width:100%;margin:0}.frame img{height:280px}.copy{padding:18px}}
</style></head><body><main><header><h1>${cases.every((item) => item.kind === 'generated-example') ? '原创架构案例册' : '应用架构讲解参考'}</h1><p>浅色、清楚组件与关系优先。普通方框连线适合 HTML / SVG；连续插画和实体空间用于 Imagegen。原图保持自身比例，竖版长图按讲解任务拆页。</p></header><nav aria-label="案例筛选"><button data-filter="all" aria-pressed="true">全部案例</button>${cases.some((item) => item.kind === 'generated-example') ? `<button data-filter="generated" aria-pressed="false">原创生成 · ${cases.filter((item) => item.kind === 'generated-example').length}</button>` : ''}${[...new Set(cases.map((item) => item.target))].map((target) => `<button data-filter="${target}" aria-pressed="false">${target === 'html' ? 'HTML 架构讲解' : 'Imagegen 视觉参考'}</button>`).join('')}<input type="search" aria-label="搜索架构案例" placeholder="搜索应用、场景或来源"></nav><p class="count" role="status">显示 ${cases.length} 个案例</p><section class="grid">${figures}</section><p data-empty hidden>没有匹配的案例。</p><footer>${cache ? '原图已内嵌，可离线查看。' : '外部原图需要联网；随包图片可直接查看。'}<a href="catalog.json">案例目录</a> · 逐图观察用于选参考，不代替具体项目的事实核对与视觉验收。</footer></main><dialog aria-label="架构图大图"><button data-close>关闭</button><img alt=""></dialog><script>
const cards=[...document.querySelectorAll('[data-case]')];const filters=[...document.querySelectorAll('[data-filter]')];const search=document.querySelector('input');const update=()=>{const target=document.querySelector('[data-filter][aria-pressed=true]').dataset.filter;const text=search.value.trim().toLowerCase();for(const card of cards)card.hidden=(target!=='all'&&(target==='generated'?card.dataset.kind!=='generated-example':card.dataset.target!==target))||!card.dataset.search.includes(text);const count=new Set(cards.filter(card=>!card.hidden).map(card=>card.dataset.case)).size;document.querySelector('[role=status]').textContent='显示 '+count+' 个案例';document.querySelector('[data-empty]').hidden=count!==0;};for(const button of filters)button.addEventListener('click',()=>{for(const current of filters)current.setAttribute('aria-pressed',String(current===button));update();});search.addEventListener('input',update);const dialog=document.querySelector('dialog');const large=dialog.querySelector('img');document.querySelector('[data-close]').addEventListener('click',()=>dialog.close());for(const card of cards){const picture=card.querySelector('[data-figure]');const error=card.querySelector('[data-error]');const state=()=>{error.hidden=Boolean(picture.naturalWidth);};picture.addEventListener('load',state);picture.addEventListener('error',state);if(picture.complete)state();card.querySelector('[data-retry]').addEventListener('click',()=>{error.hidden=true;picture.src=picture.src;});card.querySelector('[data-zoom]').addEventListener('click',()=>{if(picture.naturalWidth){large.src=picture.src;large.alt=picture.alt;dialog.showModal();}});}
</script></body></html>\n`;
    const outputs = [['index.html', html]];
    if (directory !== dirname(sourcePath)) outputs.push(['catalog.json', `${JSON.stringify(subset, null, 2)}\n`]);
    for (const [name, text] of outputs) {
      const path = join(directory, name);
      if (check) assert.equal(await readFile(path, 'utf8'), text, `Rebuild architecture references: ${relative(repo, path)}`);
      else { await mkdir(directory, { recursive: true }); await writeFile(path, text); }
    }
  }
  return { mode: check ? 'check' : 'build', cases: catalog.cases.length, html: catalog.cases.filter((item) => item.target === 'html').length, imagegen: catalog.cases.filter((item) => item.target === 'imagegen').length, offline: Boolean(cache) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const value = (name) => { const index = process.argv.indexOf(name); if (index < 0) return null; assert(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `Missing ${name}`); return resolve(process.argv[index + 1]); };
  console.log(JSON.stringify(await buildGallery({ check: process.argv.includes('--check'), cacheRoot: value('--cache'), output: value('--out') })));
}
