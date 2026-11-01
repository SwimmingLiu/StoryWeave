import { validateOutputManifest } from '../core/artifact.mjs';
import { sha256 } from './themes.mjs';
import { HTML_RENDERER_VERSION, validateHtmlPlan } from './plan.mjs';
import * as legacy from './legacy.mjs';
import { htmlStyles } from './styles.mjs';
import { escapeHtml, typesetText } from './typography.mjs';
import { drawConnections } from './diagram.mjs';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const RENDERER_VERSION = HTML_RENDERER_VERSION;

const token = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/gu, '-');
const text = (value, kind = 'body', tag = 'p', attributes = '') => `<${tag} data-storyweave-content="${kind}" ${attributes}>${typesetText(value)}</${tag}>`;

function title(content, className = '') {
  const length = [...content.title].length;
  // Titles and body copy now share the same short-word policy without changing approved text.
  return `<h1 class="${className} ${length > 32 ? 'title-long' : ''}" data-storyweave-content="title">${typesetText(content.title, 'title-word')}</h1>`;
}

function assetFigure(page, options, caption) {
  const reference = page.asset_refs?.find((asset) => asset.slot === 'hero') ?? page.asset_refs?.[0];
  if (!reference) return '';
  const asset = options.assets?.get?.(reference.asset_id) ?? reference;
  const path = asset.path ?? reference.path;
  const src = [options.assetBasePath, path].filter(Boolean).join('/');
  const focal = reference.focal_point ?? { x: 0.5, y: 0.5 };
  const slot = page.asset_slots?.find((item) => item.asset_id === reference.asset_id);
  // Visual metadata cannot add visible facts; the approved statement attribution is the sole figure caption.
  return `<figure class="asset-figure" data-storyweave-asset-slot="${escapeHtml(reference.slot ?? 'hero')}" data-asset-id="${escapeHtml(reference.asset_id)}" style="--image-ratio:${(slot?.aspect_ratio ?? '4:3').replace(':', '/')}"><img src="${escapeHtml(src)}" alt="${escapeHtml(reference.alt ?? asset.alt ?? '')}" style="object-fit:${slot?.fit ?? (reference.fit === 'contain' ? 'contain' : 'cover')};object-position:${Number(focal.x) * 100}% ${Number(focal.y) * 100}%">${caption ? text(caption, 'caption', 'figcaption') : ''}</figure>`;
}

function statement(slide, page, options) {
  const content = slide.content;
  const figure = assetFigure(page, options, content.attribution);
  const body = (content.body ?? []).map((line) => text(line)).join('');
  const kicker = content.kicker ? text(content.kicker, 'kicker', 'p', 'class="kicker"') : '';
  const attribution = content.attribution && !figure ? text(content.attribution, 'caption', 'p', 'class="attribution"') : '';
  return `<div class="statement-composition${figure ? ' has-image' : ''}" data-storyweave-region="copy"><div class="statement-copy">${kicker}${page.layout_id === 'quote' ? `<blockquote>${title(content)}<div class="statement-body">${body}</div></blockquote>` : `${title(content)}<div class="statement-body">${body}</div>`}${attribution}</div>${figure}</div>`;
}

// An image gets a real layout slot, while its title and explanatory copy remain approved native text.
function imageHero(slide, page, options) {
  const content = slide.content;
  return `<header class="slide-head" data-storyweave-region="title">${content.kicker ? text(content.kicker, 'kicker', 'p', 'class="kicker"') : ''}${title(content)}</header><main class="layout-body image-hero-body" data-storyweave-region="content">${assetFigure(page, options, content.attribution)}<div class="image-copy">${(content.body ?? []).map((line) => text(line)).join('')}</div></main>`;
}

function comparison(slide) {
  const content = slide.content;
  return `<header class="slide-head" data-storyweave-region="title">${title(content)}</header><main class="comparison-body layout-body" data-storyweave-region="content"><table class="comparison-matrix"><colgroup><col class="comparison-axis">${content.columns.map(() => '<col>').join('')}</colgroup><thead><tr><th aria-hidden="true"></th>${content.columns.map((column) => text(column, 'column-label', 'th', 'scope="col"')).join('')}</tr></thead><tbody>${content.rows.map((row) => `<tr>${text(row.label, 'row-label', 'th', 'scope="row"')}${row.values.map((value) => text(value, 'comparison-value', 'td')).join('')}</tr>`).join('')}</tbody></table></main>`;
}

function metrics(slide) {
  const content = slide.content;
  // Several authored notes share one flow container instead of competing for the same absolute bottom edge.
  const notes = content.body?.length ? `<div class="metric-notes">${content.body.map((line) => text(line, 'body', 'p', 'class="metric-note"')).join('')}</div>` : '';
  return `<header class="slide-head" data-storyweave-region="title">${title(content)}</header><main class="metrics-body layout-body" data-storyweave-region="content"><div class="metric-ledger" style="--metric-count:${content.metrics.length}">${content.metrics.map((metric) => `<article class="metric-entry"><div class="metric-number">${text(metric.value, 'metric-value', 'span')}${text(metric.unit, 'metric-unit', 'span')}</div>${text(metric.label, 'metric-label', 'h2')}${text(metric.source, 'caption', 'p', 'class="metric-source"')}</article>`).join('')}</div>${notes}</main>`;
}

// The browser resolves ports from real boxes; no fixed half-width can cover all fonts and compositions.
function connectionMarkup(edges, marker, { width = 1088, height = 350, flow = 'across' } = {}) {
  return `<svg class="relationship-connections" viewBox="0 0 ${width} ${height}" data-flow="${flow}" aria-label="${escapeHtml(edges.length)} 条已确认关系" role="img"><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>${edges.map((edge) => `<g data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}"><path d="M0,0 L0,0" fill="none" stroke="currentColor" stroke-width="2" marker-end="url(#${marker})"/>${edge.label ? `<text x="0" y="0" text-anchor="middle" data-storyweave-content="edge-label">${escapeHtml(edge.label)}</text>` : ''}</g>`).join('')}</svg>`;
}

function relationship(slide, page) {
  const content = slide.content;
  const diagram = page.diagram;
  const authored = new Map((content.steps ?? content.nodes).map((node) => [node.id, node]));
  return `<header class="slide-head" data-storyweave-region="title">${title(content)}</header><main class="relationship-body layout-body" data-storyweave-region="content"><div class="relationship-map" style="--diagram-height:${diagram.height}px;--node-width:${diagram.node_width}px">${connectionMarkup(content.edges, `arrow-${token(slide.id)}`, diagram)}${diagram.nodes.map((position) => {
    const node = authored.get(position.id);
    return `<article class="relationship-node" data-node-id="${escapeHtml(node.id)}" style="left:${position.x / diagram.width * 100}%;top:${position.y / diagram.height * 100}%">${text(node.label, 'node-label', 'h2')}${node.detail ? text(node.detail, 'body') : ''}</article>`;
  }).join('')}</div></main>`;
}

function linearProcess(slide) {
  const content = slide.content;
  const count = content.steps.length;
  return `<header class="slide-head" data-storyweave-region="title">${title(content)}</header><main class="process-body layout-body" data-storyweave-region="content">${connectionMarkup(content.edges, `arrow-${token(slide.id)}`, { flow: 'rail' })}<ol class="process-rail" style="--step-count:${count}">${content.steps.map((step, index) => `<li data-node-id="${escapeHtml(step.id)}"><span class="step-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="step-anchor" aria-hidden="true"></span>${text(step.label, 'node-label', 'h2')}${step.detail ? text(step.detail, 'body') : ''}</li>`).join('')}</ol></main>`;
}

const layoutRenderers = Object.freeze({
  statement, 'statement-split': statement, 'image-hero': imageHero, 'cover-split': statement, 'closing-statement': statement, quote: statement,
  'comparison-matrix': comparison, 'metric-ledger': metrics,
  'process-linear': linearProcess, 'process-loop': relationship, 'process-network': relationship, 'relationship-map': relationship,
});

function slideMarkup(content, slide, index, plan, options) {
  const page = plan.slides[index];
  const active = options.active ? ' active' : '';
  const geometry = page.geometry;
  // A longer title reserves its rows before content placement; CSS does not silently shrink approved copy.
  const lines = Math.min(geometry.title_max_lines, Math.ceil([...slide.content.title].length * geometry.title_size / (1280 - 2 * geometry.gutter)));
  const bodyTop = Math.max(240, 72 + lines * geometry.title_size * 1.16 + geometry.title_body_gap + (slide.content.kicker ? 59 : 0));
  const metricSize = slide.content.type === 'metrics' && slide.content.metrics.length === 4 ? 80 : 104;
  return `<section class="slide layout-${token(page.layout_id)} tone-${page.tone}${active}" style="--gutter:${geometry.gutter}px;--title-size:${geometry.title_size}px;--title-weight:${geometry.title_weight};--title-gap:${geometry.title_body_gap}px;--body-top:${bodyTop}px;--metric-size:${metricSize}px" data-storyweave-slide data-slide-id="${escapeHtml(slide.id)}" data-slide-index="${index}" data-layout-id="${page.layout_id}" data-composition="${page.composition}" data-page-rhythm="${page.page_rhythm}" data-theme-ref="${escapeHtml(plan.theme_ref)}" data-content-revision="${content.revision}">${layoutRenderers[page.layout_id](slide, page, options)}<span class="counter">${String(index + 1).padStart(2, '0')} / ${String(content.slides.length).padStart(2, '0')}</span></section>`;
}

// Style rules live beside the renderer so the browser and standalone pages share one fixed-stage system.
const styles = htmlStyles;

function runtime(navigation) {
  return `(()=>{${drawConnections.toString()};const stage=document.querySelector('.stage');const fit=()=>{stage.style.transform='scale('+Math.min(innerWidth/1280,innerHeight/720)+')';drawConnections()};fit();addEventListener('resize',fit,{passive:true});document.fonts.ready.then(drawConnections);${navigation ? `const slides=[...document.querySelectorAll('[data-storyweave-slide]')];let current=0;const show=next=>{slides[current].classList.remove('active');current=(next+slides.length)%slides.length;slides[current].classList.add('active');drawConnections()};document.querySelector('.prev').addEventListener('click',()=>show(current-1));document.querySelector('.next').addEventListener('click',()=>show(current+1));addEventListener('keydown',event=>{if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;const keys=['ArrowRight','PageDown',' ','ArrowLeft','PageUp','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();if(['ArrowRight','PageDown',' '].includes(event.key))show(current+1);else if(['ArrowLeft','PageUp'].includes(event.key))show(current-1);else show(event.key==='Home'?0:slides.length-1)})` : ''}})();`;
}

function shell(content, plan, body, navigation) {
  return `<!doctype html><html lang="${escapeHtml(content.language ?? 'zh-CN')}" data-architecture="${escapeHtml(plan.theme.architecture_id)}" data-visual-system="${escapeHtml(plan.visual_system)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="storyweave-producer" content="storyweave-html"><meta name="storyweave-theme-ref" content="${escapeHtml(plan.theme_ref)}"><meta name="storyweave-canvas" content="1280x720"><meta name="storyweave-content-revision" content="${content.revision}"><title>${escapeHtml(content.title)}</title><style>${styles(plan)}</style></head><body><div class="stage-viewport"><main class="stage" data-reading-mode="${content.reading_mode ?? 'speaker-led'}">${body}</main></div>${navigation ? '<button class="nav prev" aria-label="上一页">‹</button><button class="nav next" aria-label="下一页">›</button>' : ''}<script>${runtime(navigation)}</script></body></html>`;
}

export function renderHtmlDeck(content, planOrTheme, options = {}) {
  if (content.schema_version !== 4) return legacy.renderHtmlDeck(content, planOrTheme, options);
  return shell(content, planOrTheme, content.slides.map((slide, index) => slideMarkup(content, slide, index, planOrTheme, { ...options, active: index === 0 })).join(''), true);
}

export function renderHtmlSlide(content, source, index, planOrTheme, options = {}) {
  if (content.schema_version !== 4) return legacy.renderHtmlSlide(content, source, index, planOrTheme, options);
  return shell(content, planOrTheme, slideMarkup(content, source, index, planOrTheme, { ...options, active: true }), false);
}

export function createHtmlManifest(content, planOrTheme) {
  if (content.schema_version !== 4) return legacy.createHtmlManifest(content, planOrTheme);
  const plan = planOrTheme;
  return {
    format: 'storyweave/slides', version: 2, producer: 'storyweave-html', kind: 'html', title: content.title,
    canvas: { width: WIDTH, height: HEIGHT }, entry: 'index.html', renderer_version: HTML_RENDERER_VERSION,
    contract_version: plan.contract_version, theme_ref: plan.theme_ref, theme_recipe_sha256: plan.theme_recipe_sha256,
    deck_spec_sha256: sha256(content), content_revision: content.revision, plan_sha256: plan.plan_sha256,
    reading_mode: content.reading_mode ?? 'speaker-led',
    slides: content.slides.map((slide, index) => {
      const page = plan.slides[index];
      return { id: slide.id, role: slide.role, source: `slides/${slide.id}.html`, claim: slide.claim, notes: slide.speaker_notes ?? slide.notes ?? slide.claim, layout_id: page.layout_id, page_rhythm: page.page_rhythm, asset_refs: page.asset_refs, visual_scheme_ref: page.visual_scheme_ref, visual_scheme_sha256: page.visual_scheme_sha256, render_recipe_ref: `${plan.theme_ref}/render-v4-${page.layout_id}`, render_recipe_sha256: sha256({ page, typography: plan.typography, renderer: plan.renderer_version }), motion_recipe_ref: `${plan.theme_ref}/motion-none` };
    }),
  };
}

export function validateHtmlManifest(manifest, content = null, plan = null) {
  if (content?.schema_version !== 4) return legacy.validateHtmlManifest(manifest, content);
  const common = validateOutputManifest(manifest);
  if (!common.valid) return common;
  const findings = [];
  if (manifest.producer !== 'storyweave-html' || manifest.kind !== 'html') findings.push({ severity: 'blocking', code: 'manifest.producer', message: 'Expected an HTML producer manifest.' });
  if (manifest.content_revision !== content.revision || manifest.deck_spec_sha256 !== sha256(content)) findings.push({ severity: 'blocking', code: 'manifest.content_stale', message: 'Approved content changed after building.' });
  if (plan) {
    const check = validateHtmlPlan(content, plan);
    findings.push(...check.errors.map((message) => ({ severity: 'blocking', code: 'plan.invalid', message })));
    if (manifest.plan_sha256 !== plan.plan_sha256 || manifest.theme_recipe_sha256 !== plan.theme_recipe_sha256) findings.push({ severity: 'blocking', code: 'manifest.plan_stale', message: 'The HTML plan changed after building.' });
  }
  if (manifest.slides.length !== content.slides.length || manifest.slides.some((slide, index) => slide.id !== content.slides[index]?.id)) findings.push({ severity: 'blocking', code: 'manifest.pages', message: 'Manifest page identity or order changed.' });
  return { valid: findings.length === 0, findings };
}
