import { sha256 } from './themes.mjs';
import { validateOutputManifest } from '../core/artifact.mjs';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const RENDERER_VERSION = '2.2.0';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function token(value, fallback = '') {
  return String(value ?? fallback).replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function tokens(theme = {}) {
  return theme.tokens ?? {
    background: '#F3F4EF', surface: '#FFFFFF', text: '#172019', muted: '#59645C',
    accent: '#146C5A', support: '#C58C2B', line: '#D3D9D1', radius: '6px',
    heading: "Inter, 'Noto Sans SC', system-ui, sans-serif",
    body: "Inter, 'Noto Sans SC', system-ui, sans-serif",
  };
}

function schemeId(source, canonical) {
  return canonical ? source.visual_scheme_ref?.split('/').at(-1) ?? 'hero' : 'legacy';
}

function assetMap(assets) {
  if (assets instanceof Map) return assets;
  const entries = Array.isArray(assets)
    ? assets.map((asset) => [asset.id, asset])
    : Object.entries(assets ?? {});
  return new Map(entries);
}

function safeAssetPath(value) {
  const path = String(value ?? '').trim();
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes(':')) return null;
  return path;
}

function assetMarkup(source, { assets = new Map(), assetBasePath = '' } = {}) {
  const refs = Array.isArray(source.asset_refs) ? source.asset_refs : [];
  const ref = refs.find((item) => item.slot === 'hero') ?? refs[0];
  if (!ref) return '';
  const registry = assetMap(assets);
  const asset = registry.get(ref.asset_id) ?? ref;
  const path = safeAssetPath(asset?.path ?? ref.path);
  if (!path) return '';
  const src = [assetBasePath, path].filter(Boolean).join('/');
  const fit = ['cover', 'contain', 'fill'].includes(ref.fit) ? ref.fit : 'cover';
  const focal = ref.focal_point && Number.isFinite(ref.focal_point.x) && Number.isFinite(ref.focal_point.y)
    ? `object-position:${Math.round(ref.focal_point.x * 100)}% ${Math.round(ref.focal_point.y * 100)}%;`
    : '';
  const caption = ref.caption ? `<figcaption>${escapeHtml(ref.caption)}</figcaption>` : '';
  return `<figure class="media-frame slot-${token(ref.slot, 'hero')}" data-storyweave-asset-slot="${escapeHtml(ref.slot)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(ref.alt ?? asset?.alt ?? source.claim)}" style="object-fit:${fit};${focal}">${caption}</figure>`;
}

function svgText(value, x, y, { fill, size = 18, weight = 600, anchor = 'start', family = "Inter, 'Noto Sans SC', system-ui, sans-serif" } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeHtml(value)}</text>`;
}

function svgRect(x, y, width, height, { fill, stroke, radius = 2, opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="${opacity}"/>`;
}

function svgLine(x1, y1, x2, y2, { stroke, width = 2, dash = '' } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

function svgCircle(cx, cy, radius, { fill, stroke, width = 1.5 } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function visualMarkup(source, theme) {
  const spec = source.visual_spec;
  if (!spec?.type) return '';
  const t = tokens(theme);
  const labels = Array.isArray(spec.labels) ? spec.labels : [];
  const accent = t.accent;
  const support = t.support;
  const line = t.line;
  const text = t.text;
  const muted = t.muted;
  const surface = t.surface;
  const type = spec.type;
  let body = '';

  if (type === 'request') {
    body += svgLine(44, 44, 44, 454, { stroke: accent, width: 3 });
    labels.slice(0, 5).forEach((label, index) => {
      const y = 28 + index * 86;
      body += svgCircle(44, y + 24, index === labels.length - 1 ? 10 : 7, { fill: index === labels.length - 1 ? accent : surface, stroke: accent, width: 2 });
      body += svgRect(76, y, 450, 50, { fill: surface, stroke: index === labels.length - 1 ? accent : line, radius: 2 });
      body += svgText(label, 98, y + 31, { fill: text, size: 18, weight: index === labels.length - 1 ? 700 : 550 });
      if (index < 4) body += svgLine(44, y + 32, 44, y + 86, { stroke: line, width: 2 });
    });
  } else if (type === 'decision-lanes') {
    labels.slice(0, 5).forEach((label, index) => {
      const y = 22 + index * 86;
      const active = index === (spec.highlightIndex ?? 3);
      body += svgRect(46, y, 494, 58, { fill: active ? accent : surface, stroke: active ? accent : line, radius: 2 });
      body += svgCircle(70, y + 29, 8, { fill: active ? surface : accent, stroke: active ? surface : accent, width: 1 });
      body += svgText(label, 94, y + 36, { fill: active ? surface : text, size: 17, weight: active ? 700 : 550 });
      if (index < 4) body += svgLine(70, y + 58, 70, y + 86, { stroke: line, width: 1.5 });
    });
  } else if (type === 'architecture-stack') {
    const stack = labels.slice(0, 6);
    stack.forEach((label, index) => {
      const y = 18 + index * 70;
      const active = index === 1;
      body += svgRect(64 + (index % 2) * 18, y, 432 - (index % 2) * 36, 48, { fill: active ? accent : surface, stroke: active ? accent : line, radius: 2 });
      body += svgText(label, 88 + (index % 2) * 18, y + 30, { fill: active ? surface : text, size: 17, weight: active ? 700 : 600 });
      if (index < stack.length - 1) body += svgLine(280, y + 48, 280, y + 70, { stroke: accent, width: 2 });
    });
    body += svgCircle(280, 244, 32, { fill: 'none', stroke: support, width: 2 });
  } else if (type === 'runtime-loop') {
    const points = [[300, 70], [500, 238], [300, 406], [100, 238]];
    labels.slice(0, 4).forEach((label, index) => {
      const [x, y] = points[index];
      const next = points[(index + 1) % points.length];
      body += svgLine(x, y, next[0], next[1], { stroke: index === 2 ? support : line, width: 3 });
      body += svgCircle(x, y, 36, { fill: index === 2 ? accent : surface, stroke: index === 2 ? accent : accent, width: 2 });
      body += svgText(String(index + 1).padStart(2, '0'), x, y + 6, { fill: index === 2 ? surface : accent, size: 16, weight: 800, anchor: 'middle' });
      const tx = x + (x < 200 ? -20 : x > 400 ? 20 : 0);
      const ty = y + (y < 120 ? -54 : y > 350 ? 70 : 6);
      body += svgText(label, tx, ty, { fill: text, size: 16, weight: 600, anchor: x < 200 ? 'end' : x > 400 ? 'start' : 'middle' });
    });
    body += svgCircle(300, 238, 54, { fill: 'none', stroke: accent, width: 1.5 });
  } else if (type === 'retrieval-gate') {
    labels.slice(0, 4).forEach((label, index) => {
      const x = index < 3 ? 32 + index * 174 : 220;
      const y = index < 3 ? 64 : 310;
      const w = index < 3 ? 150 : 260;
      const active = index === 3;
      body += svgRect(x, y, w, active ? 64 : 76, { fill: active ? accent : surface, stroke: active ? accent : line, radius: 2 });
      body += svgText(label, x + w / 2, y + (active ? 39 : 45), { fill: active ? surface : text, size: 16, weight: 650, anchor: 'middle' });
      if (index < 2) body += svgLine(x + 150, y + 38, x + 174, y + 38, { stroke: accent, width: 2 });
    });
    body += svgLine(300, 140, 300, 302, { stroke: accent, width: 2, dash: '5 6' });
    body += svgCircle(300, 238, 22, { fill: surface, stroke: accent, width: 2 });
    body += svgLine(290, 238, 298, 246, { stroke: accent, width: 3 });
    body += svgLine(298, 246, 312, 228, { stroke: accent, width: 3 });
  } else if (type === 'tool-contract') {
    labels.slice(0, 4).forEach((label, index) => {
      const y = 32 + index * 100;
      const active = index === 2;
      body += svgRect(34, y, 532, 64, { fill: active ? accent : surface, stroke: active ? accent : line, radius: 2 });
      body += svgCircle(62, y + 32, 10, { fill: active ? surface : accent, stroke: active ? surface : accent, width: 1 });
      body += svgText(label, 88, y + 39, { fill: active ? surface : text, size: 17, weight: active ? 700 : 600 });
      if (index < 3) body += svgLine(300, y + 64, 300, y + 100, { stroke: index === 1 ? support : line, width: 2, dash: index === 1 ? '4 5' : '' });
    });
    body += svgRect(470, 206, 62, 58, { fill: 'none', stroke: support, radius: 2 });
    body += svgCircle(501, 232, 10, { fill: 'none', stroke: support, width: 2 });
  } else if (type === 'state-rails') {
    labels.slice(0, 3).forEach((label, index) => {
      const y = 90 + index * 130;
      body += svgLine(62, y, 536, y, { stroke: index === 1 ? accent : line, width: index === 1 ? 3 : 2 });
      body += svgCircle(92, y, 16, { fill: index === 1 ? accent : surface, stroke: accent, width: 2 });
      body += svgCircle(506, y, 16, { fill: surface, stroke: index === 2 ? support : accent, width: 2 });
      body += svgText(label, 124, y + 6, { fill: text, size: 18, weight: 650 });
      body += svgLine(126, y + 26, 470, y + 26, { stroke: line, width: 1, dash: '3 6' });
    });
  } else if (type === 'handoff') {
    body += svgLine(52, 112, 420, 112, { stroke: accent, width: 3 });
    body += svgLine(420, 112, 420, 320, { stroke: support, width: 3, dash: '6 6' });
    body += svgLine(420, 320, 530, 320, { stroke: accent, width: 3 });
    body += svgCircle(52, 112, 12, { fill: surface, stroke: accent, width: 2 });
    body += svgCircle(420, 112, 12, { fill: accent, stroke: accent, width: 2 });
    body += svgCircle(420, 320, 12, { fill: support, stroke: support, width: 2 });
    body += svgCircle(530, 320, 12, { fill: surface, stroke: accent, width: 2 });
    labels.slice(0, 4).forEach((label, index) => {
      const x = index < 2 ? 48 : 292;
      const y = index % 2 === 0 ? 52 : 182;
      body += svgRect(x, y, 210, 52, { fill: surface, stroke: index === 2 ? support : line, radius: 2 });
      body += svgText(label, x + 105, y + 31, { fill: text, size: 15, weight: 600, anchor: 'middle' });
    });
  } else if (type === 'risk-control') {
    labels.slice(0, 4).forEach((label, index) => {
      const x = index % 2 === 0 ? 34 : 316;
      const y = index < 2 ? 42 : 250;
      body += svgRect(x, y, 250, 132, { fill: surface, stroke: index === 1 ? support : line, radius: 2 });
      body += svgCircle(x + 34, y + 34, 12, { fill: index === 1 ? support : accent, stroke: index === 1 ? support : accent, width: 1 });
      body += svgText(String(index + 1).padStart(2, '0'), x + 34, y + 40, { fill: surface, size: 13, weight: 800, anchor: 'middle' });
      body += svgText(label, x + 62, y + 40, { fill: text, size: 15, weight: 650 });
      body += svgLine(x + 24, y + 82, x + 226, y + 82, { stroke: line, width: 1 });
      body += svgCircle(x + 34, y + 104, 5, { fill: accent, stroke: accent, width: 1 });
    });
    body += svgRect(250, 184, 100, 54, { fill: 'none', stroke: accent, radius: 2 });
  } else if (type === 'metric-grid') {
    labels.slice(0, 4).forEach((label, index) => {
      const x = index % 2 === 0 ? 34 : 316;
      const y = index < 2 ? 48 : 258;
      body += svgRect(x, y, 250, 140, { fill: surface, stroke: line, radius: 2 });
      body += svgText(label, x + 24, y + 38, { fill: accent, size: 24, weight: 800 });
      body += svgLine(x + 24, y + 66, x + 226, y + 66, { stroke: line, width: 1 });
      body += svgLine(x + 24, y + 106, x + 188 - index * 20, y + 106, { stroke: accent, width: 8 });
      body += svgCircle(x + 214, y + 106, 5, { fill: support, stroke: support, width: 1 });
    });
  } else if (type === 'rollout') {
    body += svgLine(52, 248, 536, 248, { stroke: line, width: 3 });
    labels.slice(0, 4).forEach((label, index) => {
      const x = 72 + index * 150;
      body += svgCircle(x, 248, 22, { fill: index === 2 ? accent : surface, stroke: index === 2 ? accent : accent, width: 2 });
      body += svgText(String(index + 1).padStart(2, '0'), x, 254, { fill: index === 2 ? surface : accent, size: 14, weight: 800, anchor: 'middle' });
      body += svgLine(x, 270, x, 306, { stroke: line, width: 1 });
      body += svgCircle(x, 326, 5, { fill: support, stroke: support, width: 1 });
    });
    body += svgRect(208, 360, 184, 52, { fill: surface, stroke: support, radius: 2 });
    body += svgCircle(238, 386, 11, { fill: 'none', stroke: support, width: 2 });
    body += svgLine(246, 378, 254, 386, { stroke: support, width: 2 });
  } else if (type === 'closing-route') {
    body += svgLine(48, 380, 492, 128, { stroke: accent, width: 4 });
    body += svgLine(492, 128, 492, 330, { stroke: support, width: 3, dash: '7 7' });
    body += svgLine(492, 330, 548, 330, { stroke: support, width: 3 });
    body += svgCircle(48, 380, 16, { fill: surface, stroke: accent, width: 2 });
    body += svgCircle(492, 128, 16, { fill: accent, stroke: accent, width: 2 });
    body += svgCircle(548, 330, 16, { fill: surface, stroke: support, width: 2 });
    body += svgRect(112, 326, 176, 54, { fill: surface, stroke: line, radius: 2 });
  }
  return `<svg class="visual-svg visual-${token(type, 'custom')}" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;
}

function copy(source, canonical) {
  const lines = source.exact_text?.length ? source.exact_text : [source.claim ?? ''];
  const title = `<h1 data-storyweave-content="title">${escapeHtml(lines[0])}</h1>`;
  if (source.role === 'process') {
    return `${title}<ol class="steps" data-storyweave-content="process">${lines.slice(1).map((line, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(line)}</li>`).join('')}</ol>`;
  }
  if (source.role === 'comparison' || source.role === 'two-column') {
    return `${title}<div class="columns" data-storyweave-content="columns">${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
  }
  if (source.role === 'data') {
    const metrics = source.metrics?.length
      ? source.metrics.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`)
      : lines.slice(1).map((line) => `<div><strong>${escapeHtml(line)}</strong></div>`);
    return `${title}<div class="metrics" data-storyweave-content="metrics">${metrics.join('')}</div>`;
  }
  if (source.role === 'quote') return `<blockquote data-storyweave-content="quote">${title}${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</blockquote>`;
  if (canonical && source.role === 'image-hero') return `${title}<p class="caption" data-storyweave-content="caption">${escapeHtml(lines[1] ?? source.claim)}</p>`;
  return `${title}${lines.slice(1).map((line) => `<p data-storyweave-content="support">${escapeHtml(line)}</p>`).join('')}`;
}

function slideMarkup(source, index, total, theme, { active = false, assets = new Map(), assetBasePath = '', readingMode = 'speaker-led' } = {}) {
  const canonical = theme.kind === 'canonical';
  const role = source.role ?? 'statement';
  const scheme = schemeId(source, canonical);
  const recipe = source.render_recipe_ref?.split('/').at(-1) ?? `${theme.architecture_id ?? 'legacy'}-${scheme}`;
  const motion = source.motion_recipe_ref?.split('/').at(-1) ?? 'none';
  const rhythm = source.page_rhythm ?? 'dense';
  const media = assetMarkup(source, { assets, assetBasePath });
  const visual = visualMarkup(source, theme);
  const customType = source.visual_spec?.type ? token(source.visual_spec.type, 'custom') : '';
  const customWide = visual && ['process', 'two-column', 'comparison', 'data'].includes(role);
  const tone = source.visual_spec?.tone ? token(source.visual_spec.tone, 'light') : '';
  const attributes = canonical
    ? ` data-theme-ref="${escapeHtml(theme.theme_ref)}" data-architecture="${escapeHtml(theme.architecture_id)}" data-visual-scheme-ref="${escapeHtml(source.visual_scheme_ref)}" data-render-recipe-ref="${escapeHtml(source.render_recipe_ref ?? '')}" data-render-recipe-sha256="${escapeHtml(source.render_recipe_sha256 ?? '')}" data-motion-recipe-ref="${escapeHtml(source.motion_recipe_ref ?? '')}" data-text-zone="${escapeHtml(source.layout_plan?.text_safe_zone)}" data-density="${escapeHtml(source.layout_plan?.density)}" data-reading-mode="${escapeHtml(source.reading_mode ?? readingMode)}" data-page-rhythm="${escapeHtml(source.page_rhythm ?? '')}"`
    : ` data-legacy-theme-id="${escapeHtml(theme.legacy_theme_id ?? theme.id)}" data-migration-status="${escapeHtml(theme.migration_status)}"`;
  const customClass = `${visual ? ` has-custom-visual custom-visual-${customType}${customWide ? ' custom-wide' : ''}` : ''}${tone ? ` tone-${tone}` : ''}`;
  return `<section class="slide role-${escapeHtml(role)} scheme-${escapeHtml(scheme)} recipe-${token(recipe, 'default')} motion-${token(motion, 'none')} rhythm-${token(rhythm, 'dense')}${media ? ' has-media' : ''}${customClass}${active ? ' active' : ''}" data-storyweave-slide data-slide-id="${escapeHtml(source.id)}" data-slide-index="${index}"${attributes}><div class="art" data-storyweave-region="visual" aria-hidden="true">${media}${visual}<i></i><i></i><i></i><b></b></div><div class="copy" data-storyweave-region="copy">${copy(source, canonical)}</div><span class="counter">${index + 1} / ${total}</span></section>`;
}

// Legacy copy extended 19px into the visual region; reserve a gap without changing canonical overrides or authored text.
function baseCss(theme) {
  const t = tokens(theme);
  return `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${t.background};color:${t.text};font-family:${t.body};letter-spacing:0}body{display:grid;place-items:center}.stage-viewport{position:relative;width:100vw;height:100vh;overflow:hidden;display:grid;place-items:center;background:${t.background}}.stage{position:absolute;left:50%;top:50%;margin-left:-${WIDTH / 2}px;margin-top:-${HEIGHT / 2}px;flex:none;width:${WIDTH}px;height:${HEIGHT}px;transform-origin:center center}.deck{width:${WIDTH}px;height:${HEIGHT}px}.stage[data-reading-mode="reading-first"] .copy p,.stage[data-reading-mode="reading-first"] .copy li,.stage[data-reading-mode="reading-first"] .columns p,.stage[data-reading-mode="reading-first"] .metrics>div{font-size:24px;line-height:1.32}.slide[data-page-rhythm="anchor"] .copy h1{font-size:72px}.slide[data-page-rhythm="breathing"] .copy{padding-top:16px}.slide[data-page-rhythm="dense"] .copy h1{font-size:56px}.slide{display:none;position:absolute;inset:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${t.background};border:1px solid ${t.line}}.slide.active,.single .slide{display:block}.copy{position:absolute;z-index:2;left:96px;top:86px;width:624px;height:548px;display:flex;flex-direction:column;justify-content:center}.copy h1{margin:0 0 28px;font-family:${t.heading};font-size:64px;line-height:1.06;letter-spacing:0}.copy p,.copy li{font-size:28px;line-height:1.4;color:${t.muted}}.copy ol{margin:0;padding:0;list-style:none}.columns,.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.columns p,.metrics>div{margin:0;padding:20px;border:1px solid ${t.line};background:${t.surface};border-radius:${t.radius}}.metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.metrics strong,.metrics span{display:block}.metrics strong{font-size:42px;color:${t.accent}}.art{position:absolute;z-index:1;right:64px;top:86px;width:448px;height:548px;border:1px solid ${t.line};background:${t.surface};overflow:hidden;border-radius:${t.radius}}.art:before,.art:after,.art i,.art b{content:"";position:absolute}.art:before{width:62%;aspect-ratio:1;right:-8%;top:8%;border:18px solid ${t.accent};border-radius:50%;opacity:.82}.art:after{width:54%;aspect-ratio:1;left:-16%;bottom:-8%;background:${t.support};border-radius:50%;opacity:.72}.art i:nth-child(1){width:72%;height:3px;left:10%;top:52%;background:${t.text};transform:rotate(-17deg)}.art i:nth-child(2){width:20px;height:20px;left:25%;top:24%;background:${t.accent};border-radius:50%}.art i:nth-child(3){width:36px;height:36px;right:18%;bottom:17%;border:8px solid ${t.text};border-radius:50%}.media-frame{position:absolute;z-index:3;inset:0;margin:0;display:flex;flex-direction:column;background:${t.surface}}.media-frame img{display:block;width:100%;height:100%;min-height:0}.media-frame figcaption{position:absolute;left:18px;right:18px;bottom:18px;padding:8px 10px;background:${t.text};color:${t.surface};font-size:16px;line-height:1.2}.art.has-media>i,.art.has-media>b{opacity:.15}.counter{position:absolute;z-index:3;right:18px;bottom:14px;padding:5px 8px;background:${t.text};color:${t.surface};font:12px system-ui}.nav{position:fixed;z-index:9;top:50%;width:42px;height:42px;border:0;border-radius:50%;background:${t.text};color:${t.surface};font-size:24px;cursor:pointer;transform:translateY(-50%)}.nav.prev{left:12px}.nav.next{right:12px}@keyframes sw-rise{from{transform:translateY(18px);opacity:.7}to{transform:translateY(0);opacity:1}}@keyframes sw-node{from{transform:translateX(-12px);opacity:.55}to{transform:translateX(0);opacity:1}}@keyframes sw-stamp{from{transform:scale(.96);opacity:.7}to{transform:scale(1);opacity:1}}@keyframes sw-focus{from{transform:scale(1.02);opacity:.7}to{transform:scale(1);opacity:1}}.canonical .slide.active.motion-quiet-stagger [data-storyweave-content],.canonical .slide.active.motion-none [data-storyweave-content]{animation:sw-rise .42s ease-out both}.canonical .slide.active.motion-node-trace .steps li{animation:sw-node .42s ease-out both}.canonical .slide.active.motion-node-trace .steps li:nth-child(2){animation-delay:.08s}.canonical .slide.active.motion-node-trace .steps li:nth-child(3){animation-delay:.16s}.canonical .slide.active.motion-node-trace .steps li:nth-child(4){animation-delay:.24s}.canonical .slide.active.motion-block-stamp .columns p,.canonical .slide.active.motion-block-stamp .metrics>div{animation:sw-stamp .34s ease-out both}.canonical .slide.active.motion-block-stamp .columns p:nth-child(2),.canonical .slide.active.motion-block-stamp .metrics>div:nth-child(2){animation-delay:.08s}.canonical .slide.active.motion-block-stamp .columns p:nth-child(3),.canonical .slide.active.motion-block-stamp .metrics>div:nth-child(3){animation-delay:.16s}.canonical .slide.active.motion-slow-focus .art,.canonical .slide.active.motion-slow-focus .copy{animation:sw-focus .9s ease-out both}@media(prefers-reduced-motion:reduce){.canonical [class*="motion-"] [data-storyweave-content],.canonical [class*="motion-"] .steps li,.canonical [class*="motion-"] .columns p,.canonical [class*="motion-"] .metrics>div,.canonical [class*="motion-"] .copy{animation:none!important}}@media print{body{display:block;overflow:visible}.stage-viewport{display:block;width:${WIDTH}px;height:auto;overflow:visible}.stage{position:relative;left:auto;top:auto;margin:0;transform:none!important;width:${WIDTH}px;height:auto}.deck{height:auto}.slide{display:block;position:relative;inset:auto;width:${WIDTH}px;height:${HEIGHT}px;page-break-after:always}.nav,.counter{display:none}}`;
}

function canonicalCss(theme) {
  const t = tokens(theme);
  return `.canonical .slide{border:0}.canonical .copy{left:77px;width:614px}.canonical .copy h1{max-width:100%}.canonical .scheme-hero .copy,.canonical .scheme-closing .copy{width:640px}.canonical .scheme-visual .copy{top:auto;bottom:58px;height:auto;width:538px;justify-content:flex-end}.canonical .scheme-visual .art{top:50px;right:77px;width:794px;height:518px}.canonical .scheme-columns .copy{left:90px;top:58px;width:1100px;height:604px;justify-content:flex-start}.canonical .scheme-columns .copy h1{font-size:48px;margin-bottom:36px}.canonical .scheme-columns .art{display:none}.canonical .scheme-flow .copy,.canonical .scheme-data .copy{left:90px;top:58px;width:1100px;height:604px;justify-content:flex-start}.canonical .scheme-flow .copy h1,.canonical .scheme-data .copy h1{font-size:48px}.canonical .scheme-flow .art,.canonical .scheme-data .art{display:none}.canonical .steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:auto!important;margin-bottom:auto!important}.canonical .steps li{position:relative;min-height:150px;padding:22px 14px;border-top:4px solid ${t.accent};background:${t.surface};color:${t.text}}.canonical .steps li span{display:block;margin-bottom:18px;color:${t.accent};font:700 13px system-ui}.canonical blockquote{margin:0;padding-left:28px;border-left:6px solid ${t.accent}}.canonical .role-cover,.canonical .role-closing{background:${t.text};color:${t.surface}}.canonical .role-cover .copy p,.canonical .role-closing .copy p{color:${t.surface};opacity:.82}.canonical .role-cover .art,.canonical .role-closing .art{background:transparent;border-color:${t.accent}}.canonical[data-architecture="editorial"] .art{border-width:0 0 0 8px;background:${t.surface}}.canonical[data-architecture="editorial"] .art:before{border-radius:0;border-width:2px}.canonical[data-architecture="systems"] .art{background:${t.surface};border:1px solid ${t.accent}}.canonical[data-architecture="systems"] .art:before{border-width:3px;border-radius:0}.canonical[data-architecture="systems"] .art:after{width:3px;height:82%;left:34%;bottom:8%;border-radius:0;background:${t.accent}}.canonical[data-architecture="campaign"] .art{border:3px solid ${t.text};box-shadow:16px 16px 0 ${t.accent}}.canonical[data-architecture="campaign"] .art:before,.canonical[data-architecture="campaign"] .art:after{border-radius:0}.canonical[data-architecture="cinematic"] .slide{box-shadow:inset 0 0 0 10px ${t.line}}.canonical[data-architecture="cinematic"] .art{border:0;background:${t.surface};box-shadow:inset 0 -70px 0 ${t.background}}.canonical[data-architecture="cinematic"] .art:before{border-color:${t.support};opacity:.5}.canonical[data-architecture="cinematic"] .counter{background:transparent;border:1px solid ${t.line}}`;
}

function architectureOverrides(theme) {
  const t = tokens(theme);
  if (theme.architecture_id === 'editorial') return `.canonical[data-architecture="editorial"] .scheme-flow .steps{grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid ${t.line};padding-top:18px}.canonical[data-architecture="editorial"] .scheme-flow .steps li{border-top:0;border-left:3px solid ${t.accent};background:transparent;padding:18px 18px 18px 20px}.canonical[data-architecture="editorial"] .scheme-data .metrics>div{background:${t.surface};border-width:1px 0 0;border-color:${t.accent}}.canonical[data-architecture="editorial"] .scheme-columns .columns p{border-top:3px solid ${t.accent};border-left:0;border-right:0;border-bottom:0;border-radius:0}`;
  if (theme.architecture_id === 'systems') return `.canonical[data-architecture="systems"] .slide:not(.role-cover):not(.role-closing){background-image:linear-gradient(${t.line} 1px,transparent 1px),linear-gradient(90deg,${t.line} 1px,transparent 1px);background-size:32px 32px;background-position:90px 58px;background-blend-mode:multiply}.canonical[data-architecture="systems"] .scheme-flow .steps{position:relative;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;padding-left:24px;border-left:3px solid ${t.accent}}.canonical[data-architecture="systems"] .scheme-flow .steps li{min-height:160px;border-top:0;border-bottom:1px solid ${t.line};border-left:1px solid ${t.accent};background:transparent}.canonical[data-architecture="systems"] .scheme-flow .steps li:not(:last-child):after{content:"";position:absolute;right:-7px;top:50%;width:12px;height:12px;background:${t.accent};transform:translateY(-50%)}.canonical[data-architecture="systems"] .scheme-data .metrics{grid-template-columns:repeat(3,minmax(0,1fr));border-top:3px solid ${t.accent};padding-top:18px}.canonical[data-architecture="systems"] .scheme-data .metrics>div{border:0;border-left:1px solid ${t.line};border-radius:0;background:transparent}`;
  if (theme.architecture_id === 'campaign') return `.canonical[data-architecture="campaign"] .scheme-hero .copy h1,.canonical[data-architecture="campaign"] .scheme-closing .copy h1{font-family:${t.heading};font-size:78px;line-height:.98;text-transform:none}.canonical[data-architecture="campaign"] .scheme-columns .columns p{border:0;border-radius:0;background:${t.text};color:${t.surface};font-weight:700;min-height:126px}.canonical[data-architecture="campaign"] .scheme-columns .columns p:nth-child(2){background:${t.accent}}.canonical[data-architecture="campaign"] .scheme-flow .steps{gap:0}.canonical[data-architecture="campaign"] .scheme-flow .steps li{border:0;border-radius:0;background:${t.accent};color:${t.surface};min-height:142px}.canonical[data-architecture="campaign"] .scheme-flow .steps li:nth-child(even){background:${t.text}}.canonical[data-architecture="campaign"] .scheme-flow .steps li span{color:${t.surface};font-size:18px}`;
  if (theme.architecture_id === 'cinematic') return `.canonical[data-architecture="cinematic"] .scheme-hero .copy,.canonical[data-architecture="cinematic"] .scheme-closing .copy{bottom:72px;top:auto;height:auto}.canonical[data-architecture="cinematic"] .scheme-hero .copy h1,.canonical[data-architecture="cinematic"] .scheme-closing .copy h1{font-size:70px;line-height:1}.canonical[data-architecture="cinematic"] .scheme-columns .columns p{background:${t.surface};border:0;border-left:4px solid ${t.accent};border-radius:0}.canonical[data-architecture="cinematic"] .scheme-flow .steps{grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;border-bottom:1px solid ${t.line};padding-bottom:16px}.canonical[data-architecture="cinematic"] .scheme-flow .steps li{border-top:0;border-left:1px solid ${t.line};background:${t.surface};min-height:148px}.canonical[data-architecture="cinematic"] .scheme-data .metrics>div{background:transparent;border:0;border-bottom:1px solid ${t.line};border-radius:0}`;
  return '';
}

function customVisualCss(theme) {
  const t = tokens(theme);
  const base = `.canonical .slide.has-custom-visual .art{display:block;background:transparent;border:0;overflow:visible;border-radius:0}.canonical .slide.has-custom-visual .art:before,.canonical .slide.has-custom-visual .art:after,.canonical .slide.has-custom-visual .art>i,.canonical .slide.has-custom-visual .art>b{display:none}.canonical .slide.has-custom-visual .visual-svg{display:block;width:100%;height:100%;overflow:visible}.canonical .slide.custom-wide .copy{left:82px;top:58px;width:520px;height:604px;justify-content:flex-start}.canonical .slide.custom-wide .copy h1{font-size:42px;line-height:1.06;margin-bottom:24px}.canonical .slide.custom-wide .copy p,.canonical .slide.custom-wide .copy li{font-size:22px;line-height:1.28}.canonical .slide.custom-wide .columns{grid-template-columns:1fr;gap:10px;margin-top:0}.canonical .slide.custom-wide .columns p{min-height:52px;padding:14px 16px;border:1px solid ${t.line};background:${t.surface};border-radius:2px}.canonical .slide.custom-wide .steps{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:0!important;margin-bottom:0!important}.canonical .slide.custom-wide .steps li{min-height:126px;padding:18px 14px;border-top:3px solid ${t.accent};font-size:22px;line-height:1.18}.canonical .slide.custom-wide .steps li span{margin-bottom:12px}.canonical .slide.custom-wide .metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:0}.canonical .slide.custom-wide .metrics>div{min-height:122px;padding:16px;border:1px solid ${t.line};background:${t.surface};border-radius:2px}.canonical .slide.custom-wide .metrics strong{font-size:32px}.canonical .slide.custom-wide .metrics span{font-size:20px;line-height:1.22}.canonical .slide.custom-wide .art{right:64px;top:116px;width:588px;height:480px}.canonical .slide.custom-wide .visual-svg{width:100%;height:100%}`;
  const toneRules = `.canonical .slide.tone-dark{background:${t.text};color:${t.surface}}.canonical .slide.tone-dark .copy h1{color:${t.surface}}.canonical .slide.tone-dark .copy p,.canonical .slide.tone-dark .copy li{color:rgba(255,255,255,.78)}.canonical .slide.tone-dark .columns p,.canonical .slide.tone-dark .metrics>div{background:${t.surface};color:${t.text};border-color:${t.surface}}.canonical .slide.tone-dark .steps li{background:${t.surface};color:${t.text};border-color:${t.accent}}.canonical .slide.tone-dark .art{background:transparent}.canonical[data-theme-ref="systems/ink-blue-grid"] .slide:not(.role-cover):not(.role-closing):not(.tone-dark){background-image:linear-gradient(${t.line} 1px,transparent 1px),linear-gradient(90deg,${t.line} 1px,transparent 1px);background-size:40px 40px;background-position:90px 58px;background-blend-mode:multiply}.canonical[data-theme-ref="systems/ink-blue-grid"] .slide.tone-dark{background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:40px 40px;background-position:90px 58px}`;
  return base + toneRules;
}

function fixedStageRuntime() {
  return `(()=>{const stage=document.querySelector('.stage');if(!stage)return;const fit=()=>{const scale=Math.min(innerWidth/${WIDTH},innerHeight/${HEIGHT});stage.style.transform='scale('+scale+')';stage.dataset.scale=String(scale)};fit();addEventListener('resize',fit,{passive:true})})();`;
}

function navigationRuntime() {
  // A focused navigation button also reacts natively to Space; prevent that second action when the deck shortcut handles it.
  return `(()=>{const slides=[...document.querySelectorAll('[data-storyweave-slide]')];let current=Math.max(0,slides.findIndex((slide)=>slide.classList.contains('active')));const show=(next)=>{if(!slides.length)return;slides[current]?.classList.remove('active');current=(next+slides.length)%slides.length;slides[current]?.classList.add('active')};document.querySelector('.prev')?.addEventListener('click',()=>show(current-1));document.querySelector('.next')?.addEventListener('click',()=>show(current+1));addEventListener('keydown',(event)=>{if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(['ArrowRight','PageDown',' ','ArrowLeft','PageUp','Home','End'].includes(event.key))event.preventDefault();if(['ArrowRight','PageDown',' '].includes(event.key))show(current+1);if(['ArrowLeft','PageUp'].includes(event.key))show(current-1);if(event.key==='Home')show(0);if(event.key==='End')show(slides.length-1)})})();`;
}

function shell(title, language, theme, body, script = '') {
  const canonical = theme.kind === 'canonical';
  const identity = canonical
    ? `<meta name="storyweave-theme-ref" content="${escapeHtml(theme.theme_ref)}"><meta name="storyweave-contract-version" content="${escapeHtml(theme.contract_version)}">`
    : `<meta name="storyweave-legacy-theme" content="${escapeHtml(theme.legacy_theme_id ?? theme.id)}"><meta name="storyweave-migration-status" content="${escapeHtml(theme.migration_status)}">`;
  const classes = canonical ? `canonical architecture-${escapeHtml(theme.architecture_id)}` : 'legacy';
  const data = canonical ? `data-architecture="${escapeHtml(theme.architecture_id)}" data-theme-ref="${escapeHtml(theme.theme_ref)}"` : `data-legacy-theme-id="${escapeHtml(theme.legacy_theme_id ?? theme.id)}"`;
  const styles = baseCss(theme) + (canonical ? canonicalCss(theme) + architectureOverrides(theme) + customVisualCss(theme) : '');
  return `<!doctype html><html lang="${escapeHtml(language ?? 'zh-CN')}" class="${classes}" ${data}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="storyweave-producer" content="storyweave-html"><meta name="storyweave-canvas" content="${WIDTH}x${HEIGHT}">${identity}<title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`;
}

export function renderHtmlDeck(deck, theme, options = {}) {
  const slides = deck.slides.map((slide, index) => slideMarkup(slide, index, deck.slides.length, theme, { active: index === 0, assets: options.assets, assetBasePath: options.assetBasePath ?? '', readingMode: deck.reading_mode ?? 'speaker-led' })).join('');
  const body = `<div class="stage-viewport"><main class="deck stage" data-reading-mode="${escapeHtml(deck.reading_mode ?? 'speaker-led')}">${slides}</main></div><button class="nav prev" aria-label="上一页">‹</button><button class="nav next" aria-label="下一页">›</button>`;
  return shell(deck.title, deck.language, theme, body, `${fixedStageRuntime()}${navigationRuntime()}`);
}

export function renderHtmlSlide(deck, source, index, theme, options = {}) {
  const body = `<div class="stage-viewport"><main class="deck stage" data-reading-mode="${escapeHtml(deck.reading_mode ?? 'speaker-led')}">${slideMarkup(source, index, deck.slides.length, theme, { active: true, assets: options.assets, assetBasePath: options.assetBasePath ?? '..', readingMode: deck.reading_mode ?? 'speaker-led' })}</main></div>`;
  return shell(`${deck.title} · ${index + 1}`, deck.language, theme, body, fixedStageRuntime());
}

export function createHtmlManifest(deck, theme) {
  const canonical = deck.schema_version === 3 && theme?.kind === 'canonical';
  const manifest = {
    format: 'storyweave/slides', version: canonical ? 2 : 1, producer: 'storyweave-html', kind: 'html',
    title: deck.title, canvas: { width: WIDTH, height: HEIGHT }, entry: 'index.html', renderer_version: RENDERER_VERSION,
    reading_mode: deck.reading_mode ?? 'speaker-led',
    slides: deck.slides.map((slide) => ({ id: slide.id, role: slide.role, source: `slides/${slide.id}.html`, claim: slide.claim, notes: slide.speaker_notes ?? slide.claim, page_rhythm: slide.page_rhythm ?? null, asset_refs: slide.asset_refs ?? [] })),
  };
  if (canonical) {
    manifest.contract_version = deck.contract_version;
    manifest.theme_ref = deck.theme_ref;
    manifest.theme_recipe_sha256 = deck.theme_recipe_sha256;
    manifest.deck_spec_sha256 = sha256(deck);
    manifest.slides = manifest.slides.map((slide, index) => ({ ...slide, visual_scheme_ref: deck.slides[index].visual_scheme_ref, visual_scheme_sha256: deck.slides[index].visual_scheme_sha256, render_recipe_ref: deck.slides[index].render_recipe_ref, render_recipe_sha256: deck.slides[index].render_recipe_sha256, motion_recipe_ref: deck.slides[index].motion_recipe_ref }));
  } else {
    manifest.legacy_theme_id = theme?.legacy_theme_id ?? theme?.id ?? deck.theme;
    manifest.migration_status = theme?.migration_status ?? 'needs-selection';
  }
  return manifest;
}

export function validateHtmlManifest(manifest, deck = null) {
  // Shared wire validation owns producer/kind pairs, paths and page IDs; this module only checks legacy HTML recipe identity.
  const common = validateOutputManifest(manifest);
  if (!common.valid) return common;
  const findings = [];
  if (manifest?.producer !== 'storyweave-html' || manifest?.kind !== 'html') findings.push({ severity: 'blocking', code: 'manifest.producer', message: 'Expected an HTML producer manifest.' });
  if (manifest?.version === 2) {
    if (!Number.isInteger(manifest.contract_version)) findings.push({ severity: 'blocking', code: 'manifest.contract_version', message: 'Canonical output needs a contract version.' });
    if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(manifest.theme_ref ?? '')) findings.push({ severity: 'blocking', code: 'manifest.theme_ref', message: 'Canonical output needs theme_ref.' });
    for (const field of ['theme_recipe_sha256', 'deck_spec_sha256']) if (!/^[a-f0-9]{64}$/.test(manifest[field] ?? '')) findings.push({ severity: 'blocking', code: `manifest.${field}`, message: `${field} is missing or malformed.` });
    if (manifest.slides.some((slide) => !/^[a-f0-9]{64}$/.test(slide.visual_scheme_sha256 ?? '') || !slide.visual_scheme_ref || !slide.render_recipe_ref || !/^[a-f0-9]{64}$/.test(slide.render_recipe_sha256 ?? ''))) findings.push({ severity: 'blocking', code: 'manifest.visual_scheme', message: 'Every canonical slide needs visual and render recipes with hashes.' });
    if (deck && manifest.deck_spec_sha256 !== sha256(deck)) findings.push({ severity: 'blocking', code: 'manifest.deck_stale', message: 'The approved deck changed after HTML was built.' });
    if (deck && manifest.theme_recipe_sha256 !== deck.theme_recipe_sha256) findings.push({ severity: 'blocking', code: 'manifest.theme_stale', message: 'The theme recipe changed after HTML was built.' });
    if (deck && manifest.slides.some((slide, index) => slide.visual_scheme_ref !== deck.slides[index]?.visual_scheme_ref || slide.visual_scheme_sha256 !== deck.slides[index]?.visual_scheme_sha256 || slide.render_recipe_ref !== deck.slides[index]?.render_recipe_ref || slide.render_recipe_sha256 !== deck.slides[index]?.render_recipe_sha256)) findings.push({ severity: 'blocking', code: 'manifest.scheme_stale', message: 'A slide visual or render recipe changed after HTML was built.' });
  }
  return { valid: findings.every((item) => item.severity !== 'blocking'), findings };
}
