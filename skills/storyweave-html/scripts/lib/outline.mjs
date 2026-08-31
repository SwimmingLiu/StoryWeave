import { isThemeCatalog, LAYOUT_DENSITIES, LAYOUT_ZONES, PAGE_ROLES, resolveTheme } from './themes.mjs';

export const MODES = Object.freeze({ HTML: 'html' });
export const NARRATIVE_KEYS = Object.freeze(['opening', 'problem', 'insight', 'method', 'action']);
const ASSET_SLOTS = new Set(['hero', 'supporting', 'background', 'logo', 'evidence']);

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function defaultLayout(role) {
  if (role === 'cover' || role === 'section' || role === 'statement') return { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['headline', 'support', 'visual-anchor'], density: 'low' };
  if (role === 'image-hero') return { text_safe_zone: 'bottom-left', visual_zone: ['center', 'right'], hierarchy: ['visual-anchor', 'caption'], density: 'low' };
  if (role === 'two-column' || role === 'comparison') return { text_safe_zone: 'top', visual_zone: ['left', 'right'], hierarchy: ['headline', 'parallel-fields'], density: 'medium' };
  if (role === 'process') return { text_safe_zone: 'top-left', visual_zone: ['center', 'right'], hierarchy: ['headline', 'stages', 'direction'], density: 'medium' };
  if (role === 'data') return { text_safe_zone: 'top-left', visual_zone: ['center', 'right'], hierarchy: ['headline', 'metric', 'evidence'], density: 'medium' };
  if (role === 'quote') return { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['quote', 'attribution', 'visual-anchor'], density: 'low' };
  return { text_safe_zone: 'bottom-left', visual_zone: ['right'], hierarchy: ['closing-claim', 'support', 'visual-anchor'], density: 'low' };
}

function defaultPageRhythm(role) {
  if (role === 'cover' || role === 'closing' || role === 'section') return 'anchor';
  if (role === 'statement' || role === 'quote' || role === 'image-hero') return 'breathing';
  return 'dense';
}

function baseSlides() {
  return [
    ['s01', 'cover', 'AI 原生知识工作流', ['AI 原生知识工作流', '让上下文持续产生价值'], '建立主题与核心判断'],
    ['s02', 'statement', '问题不是信息太少，而是上下文不断丢失', ['信息很多，上下文却在丢失', '资料散落', '判断失联', '行动断点'], '明确问题'],
    ['s03', 'comparison', '从文件堆积转向上下文复用', ['从文件堆积，转向上下文复用', '过去：保存结果', '现在：保存判断过程'], '提出转变'],
    ['s04', 'process', '四个动作构成闭环', ['四个动作构成闭环', '收集现场', '建立关联', '形成判断', '推进行动'], '解释方法'],
    ['s05', 'data', '价值来自复用次数，而不是文件数量', ['价值 = 上下文质量 × 复用次数', '一次整理，多次调用'], '给出价值判断'],
    ['s06', 'closing', '先重做一条高频流程', ['先重做一条高频流程', '把上下文、判断和行动连起来'], '给出行动建议'],
  ];
}

function slideFromTuple([id, role, claim, exact_text, purpose], index) {
  return {
    id,
    role,
    claim,
    exact_text,
    purpose,
    evidence: [],
    visual_brief: [
      'A quiet network of notes and paths with generous negative space',
      'Scattered fragments becoming a connected field of context',
      'A visual shift from isolated stacks to connected pathways',
      'Four clear stages moving through one continuous path',
      'Repeated reuse represented as a small signal becoming a durable system',
      'One focused workflow moving forward with calm visual momentum',
    ][index] ?? 'A restrained visual metaphor with generous negative space',
    transition: id === 's06' ? '结束' : '进入下一层叙事',
    visual_anchor_id: 'deck-anchor',
    continuity_group: index > 0 ? 'knowledge-flow' : 'cover',
    page_rhythm: defaultPageRhythm(role),
  };
}

function commonOutline(title) {
  return {
    status: 'draft',
    title,
    audience: '产品团队、知识工作者与组织管理者',
    purpose: '说明 AI 原生知识工作流的核心变化与行动路径',
    reading_mode: 'speaker-led',
    page_count: 6,
    central_message: '把散落的信息、判断和行动接成一条能持续复用的工作流。',
    narrative: {
      opening: '信息越来越多，但上下文仍在不断丢失。',
      problem: '资料、判断与行动分散在不同工具和短期记忆中。',
      insight: '真正需要积累的是可复用的上下文，而不是更多文件。',
      method: '通过收集、关联、判断、行动形成闭环。',
      action: '先改造一条高频流程，再逐步扩展。',
    },
    slides: baseSlides().map(slideFromTuple),
  };
}

export function createOutline(title = 'AI 原生知识工作流', options = {}) {
  if (typeof options === 'string') options = { theme_ref: options };
  const outline = commonOutline(title);
  if (!options.theme_ref) return { schema_version: 2, ...outline, reading_mode: options.reading_mode ?? outline.reading_mode };
  const architecture = options.theme_ref.split('/')[0];
  return {
    schema_version: 3,
    ...outline,
    catalog_scope: options.catalog_scope ?? 'active',
      language: options.language ?? 'zh-CN',
      canvas: '16:9',
      theme_ref: options.theme_ref,
      reading_mode: options.reading_mode ?? outline.reading_mode,
      slides: outline.slides.map((slide) => ({
        ...slide,
        visual_scheme_ref: 'auto',
        visual_anchor_id: `${architecture}-anchor`,
        layout_plan: defaultLayout(slide.role),
        page_rhythm: slide.page_rhythm ?? defaultPageRhythm(slide.role),
      })),
  };
}

function validateCommon(outline, errors) {
  if (!outline || typeof outline !== 'object') return ['Storyboard 必须是对象'];
  for (const [field, label] of [['title', '标题'], ['audience', '受众'], ['purpose', '目的'], ['central_message', '中心含义']]) if (!present(outline[field])) errors.push(`缺少${label}`);
  for (const key of NARRATIVE_KEYS) if (!present(outline.narrative?.[key])) errors.push(`叙事逻辑缺少 ${key}`);
  if (!Number.isInteger(outline.page_count) || outline.page_count < 1) errors.push('页数必须是正整数');
  if (!Array.isArray(outline.slides) || outline.slides.length === 0) errors.push('至少需要一页');
  if (Array.isArray(outline.slides) && outline.page_count !== outline.slides.length) errors.push('页数与逐页内容不一致');
  const ids = new Set();
  for (const [index, slide] of (outline.slides ?? []).entries()) {
    const prefix = `第 ${index + 1} 页`;
    if (!present(slide?.id) || ids.has(slide.id) || !/^[A-Za-z0-9_-]+$/.test(slide.id ?? '')) errors.push(`${prefix}的 ID 缺失、重复或格式错误`);
    ids.add(slide?.id);
    if (!PAGE_ROLES.includes(slide?.role)) errors.push(`${prefix}的角色无效`);
    if (!present(slide?.claim)) errors.push(`${prefix}缺少单页主张`);
    if (!Array.isArray(slide?.exact_text) || slide.exact_text.length === 0 || slide.exact_text.some((line) => !present(line))) errors.push(`${prefix}缺少准确文字`);
    if (!present(slide?.purpose)) errors.push(`${prefix}缺少页面目的`);
    if (!present(slide?.visual_brief)) errors.push(`${prefix}缺少视觉构思`);
    if (!present(slide?.transition)) errors.push(`${prefix}缺少转场说明`);
    if (!Array.isArray(slide?.evidence)) errors.push(`${prefix}的 evidence 必须是数组`);
    if (slide?.asset_refs !== undefined && (!Array.isArray(slide.asset_refs) || slide.asset_refs.some((ref) => !present(ref?.asset_id) || !ASSET_SLOTS.has(ref?.slot)))) errors.push(`${prefix}的 asset_refs 无效`);
  }
  return errors;
}

function validateV2(outline) {
  const errors = validateCommon(outline, []);
  if (outline.schema_version !== 2) errors.push('legacy Storyboard 的 schema_version 必须为 2');
  return { valid: errors.length === 0, errors };
}

function validateV3(outline, { approved = false } = {}) {
  const errors = validateCommon(outline, []);
  if (outline.schema_version !== 3) errors.push('v3 Storyboard 的 schema_version 必须为 3');
  if (!['active', 'authoring'].includes(outline.catalog_scope)) errors.push('catalog_scope 必须是 active 或 authoring');
  if (!present(outline.language)) errors.push('缺少语言标签');
  if (outline.canvas !== '16:9') errors.push('画布必须是 16:9');
  if (outline.reading_mode !== undefined && !['speaker-led', 'reading-first'].includes(outline.reading_mode)) errors.push('reading_mode 必须是 speaker-led 或 reading-first');
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(outline.theme_ref ?? '')) errors.push('theme_ref 必须使用 architecture/style 引用');
  for (const [index, slide] of (outline.slides ?? []).entries()) {
    const prefix = `第 ${index + 1} 页`;
    if (!present(slide.visual_scheme_ref) || (slide.visual_scheme_ref !== 'auto' && !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(slide.visual_scheme_ref))) errors.push(`${prefix}的 visual_scheme_ref 无效`);
    if (approved && slide.visual_scheme_ref === 'auto') errors.push(`${prefix}仍使用 auto visual scheme`);
    if (approved && (!present(slide.render_recipe_ref) || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(slide.render_recipe_ref))) errors.push(`${prefix}缺少 render_recipe_ref`);
    if (approved && !/^[a-f0-9]{64}$/.test(slide.render_recipe_sha256 ?? '')) errors.push(`${prefix}缺少 render_recipe_sha256`);
    if (approved && (!present(slide.motion_recipe_ref) || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(slide.motion_recipe_ref))) errors.push(`${prefix}缺少 motion_recipe_ref`);
    if (slide.visual_scheme_ref !== 'auto' && !slide.visual_scheme_ref.startsWith(`${outline.theme_ref}/`)) errors.push(`${prefix}的 visual scheme 不属于当前主题`);
    if (!present(slide.visual_anchor_id)) errors.push(`${prefix}缺少 visual_anchor_id`);
    if (!present(slide.continuity_group)) errors.push(`${prefix}缺少 continuity_group`);
    if (slide.page_rhythm !== undefined && !['anchor', 'dense', 'breathing'].includes(slide.page_rhythm)) errors.push(`${prefix}的 page_rhythm 无效`);
    const layout = slide.layout_plan;
    if (!LAYOUT_ZONES.includes(layout?.text_safe_zone)) errors.push(`${prefix}的 text_safe_zone 无效`);
    if (!Array.isArray(layout?.visual_zone) || layout.visual_zone.length === 0 || layout.visual_zone.some((zone) => !LAYOUT_ZONES.includes(zone))) errors.push(`${prefix}的 visual_zone 无效`);
    if (layout?.visual_zone?.includes(layout.text_safe_zone)) errors.push(`${prefix}的文字区和视觉区重叠`);
    if (!Array.isArray(layout?.hierarchy) || layout.hierarchy.length === 0) errors.push(`${prefix}缺少 hierarchy`);
    if (!LAYOUT_DENSITIES.includes(layout?.density)) errors.push(`${prefix}的 density 无效`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateOutline(outline, options = {}) {
  if (!outline || typeof outline !== 'object') return { valid: false, errors: ['Storyboard 必须是对象'] };
  return outline.schema_version === 3 ? validateV3(outline, options) : validateV2(outline);
}

export function approveOutline(outline, { mode, theme, theme_ref, themes, catalog, catalog_scope } = {}) {
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  if (mode !== MODES.HTML) throw new Error(`storyweave-html 只支持 html 模式：${mode ?? '未提供'}`);
  if (outline.schema_version === 2) {
    if (!theme) throw new Error('legacy 审批缺少主题');
    const resolved = resolveTheme(typeof theme === 'string' ? theme : theme.id);
    if (resolved.kind === 'canonical' || resolved.kind === 'unknown') throw new Error('legacy 审批需要旧主题 ID');
    return { ...clone(outline), status: 'approved', mode, theme: resolved.legacy_theme_id, approved_at: new Date().toISOString() };
  }

  const selectedCatalog = themes ?? catalog;
  if (!isThemeCatalog(selectedCatalog)) throw new Error('v3 approve 需要 openThemeCatalog 提供主题解析器。');
  const selectedThemeRef = theme_ref ?? outline.theme_ref;
  const result = clone(outline);
  result.theme_ref = selectedThemeRef;
  result.catalog_scope = catalog_scope ?? outline.catalog_scope;
  let themeRecipe = null;
  result.slides = result.slides.map((slide) => {
    const plan = selectedCatalog.resolveVisualPlan({ phase: 'approve', theme_ref: selectedThemeRef, slide });
    themeRecipe ??= plan.theme_recipe;
    return { ...slide, visual_scheme_ref: plan.visual_scheme_ref, render_recipe_ref: plan.render_recipe_ref, render_recipe_sha256: plan.render_recipe_sha256, motion_recipe_ref: plan.motion_recipe_ref, layout_plan: plan.layout_plan, visual_scheme_sha256: plan.visual_scheme_sha256, page_rhythm: slide.page_rhythm ?? defaultPageRhythm(slide.role) };
  });
  result.contract_version = selectedCatalog.contract_version;
  result.theme_recipe = themeRecipe;
  result.theme_recipe_sha256 = selectedCatalog.resolveVisualPlan({ phase: 'approve', theme_ref: selectedThemeRef, slide: outline.slides[0] }).theme_recipe_sha256;
  result.status = 'approved';
  result.mode = mode;
  result.output_mode = 'standalone-html';
  result.approved_at = new Date().toISOString();
  return result;
}

function visualReset(slide, theme_ref, index) {
  return {
    ...clone(slide),
    visual_scheme_ref: 'auto',
    visual_anchor_id: `${theme_ref.split('/')[0]}-anchor`,
    continuity_group: slide.continuity_group ?? (index === 0 ? 'cover' : 'main'),
    layout_plan: defaultLayout(slide.role),
    page_rhythm: slide.page_rhythm ?? defaultPageRhythm(slide.role),
  };
}

export function replanOutline(outline, { theme_ref, themes, catalog, catalog_scope = 'active' } = {}) {
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  const selectedCatalog = themes ?? catalog;
  if (!isThemeCatalog(selectedCatalog)) throw new Error('主题切换需要 openThemeCatalog 提供主题解析器。');
  selectedCatalog.getStyle(theme_ref);
  const next = clone(outline);
  next.schema_version = 3;
  next.status = 'draft';
  next.catalog_scope = catalog_scope;
  next.language ??= 'zh-CN';
  next.canvas = '16:9';
  next.theme_ref = theme_ref;
  next.slides = next.slides.map((slide, index) => visualReset(slide, theme_ref, index));
  for (const field of ['theme', 'mode', 'output_mode', 'approved_at', 'contract_version', 'theme_recipe', 'theme_recipe_sha256']) delete next[field];
  next.slides = next.slides.map((slide) => {
    const clean = { ...slide };
    delete clean.render_recipe_ref;
    delete clean.render_recipe_sha256;
    delete clean.motion_recipe_ref;
    delete clean.visual_scheme_sha256;
    return clean;
  });
  return next;
}

export const switchTheme = replanOutline;

export function migrateOutline(outline, { theme_ref, themes, catalog, language = 'zh-CN', catalog_scope = 'active' } = {}) {
  if (!outline || outline.schema_version !== 2) throw new Error('migrateOutline 只接受 v2 outline。');
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  const selectedCatalog = themes ?? catalog;
  if (!isThemeCatalog(selectedCatalog)) throw new Error('迁移需要 openThemeCatalog 提供主题解析器。');
  const oldTheme = outline.theme;
  const legacy = oldTheme ? resolveTheme(oldTheme, { catalog: selectedCatalog }) : null;
  const selectedThemeRef = theme_ref ?? (legacy?.migration_status === 'deterministic' ? legacy.suggested_theme_ref : null);
  if (!selectedThemeRef) throw new Error(`旧主题 ${oldTheme ?? 'missing'} 需要显式选择新的 theme_ref。`);
  selectedCatalog.getStyle(selectedThemeRef);
  const seed = {
    ...clone(outline),
    schema_version: 3,
    status: 'draft',
    catalog_scope,
    language,
    canvas: '16:9',
    theme_ref: selectedThemeRef,
    slides: outline.slides.map((slide, index) => visualReset(slide, selectedThemeRef, index)),
  };
  delete seed.theme;
  return replanOutline(seed, { theme_ref: selectedThemeRef, themes: selectedCatalog, catalog_scope });
}

export function visibleText(outline) {
  return (outline.slides ?? []).flatMap((slide) => slide.exact_text ?? []);
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderOutlinePreview(outline) {
  const narrative = NARRATIVE_KEYS.map((key) => `<li><strong>${key}</strong><span>${escapeHtml(outline.narrative?.[key])}</span></li>`).join('');
  const slides = (outline.slides ?? []).map((slide, index) => `<article><div class="number">第 ${index + 1} 页</div><div><small>${escapeHtml(slide.role)}</small><h2>${escapeHtml(slide.claim)}</h2><p>${escapeHtml(slide.purpose)}</p><ul>${(slide.exact_text ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p class="meta">视觉：${escapeHtml(slide.visual_brief)} · 衔接：${escapeHtml(slide.transition)}</p></div></article>`).join('');
  const theme = outline.theme_ref ? `<p>主题：${escapeHtml(outline.theme_ref)} · ${escapeHtml(outline.catalog_scope)}</p>` : '<p>主题将在审批时选择</p>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(outline.title)} 内容草稿</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f3ef;color:#172019;font-family:system-ui,'Noto Sans SC',sans-serif;letter-spacing:0}header,main{max-width:1100px;margin:auto;padding:40px 28px}header{padding-bottom:20px}h1{font-size:42px;margin:0 0 14px}.lead{font-size:24px;line-height:1.5;border-left:5px solid #146c5a;padding-left:20px}.narrative{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:0;list-style:none}.narrative li{background:#fff;border-top:3px solid #146c5a;padding:16px}.narrative strong,.narrative span{display:block}.narrative strong{text-transform:uppercase;font-size:11px;color:#647068;margin-bottom:8px}article{display:grid;grid-template-columns:110px 1fr;gap:24px;background:#fff;border:1px solid #d8ddd7;margin:14px 0;padding:24px}.number{font-weight:700;color:#146c5a}article h2{font-size:27px;margin:4px 0 8px}article p{line-height:1.6}.meta{color:#667068;font-size:13px}@media(max-width:760px){.narrative{grid-template-columns:1fr}article{grid-template-columns:1fr}h1{font-size:32px}}</style></head><body><header><h1>${escapeHtml(outline.title)} · Storyboard</h1><p class="lead"><strong>中心含义：</strong>${escapeHtml(outline.central_message)}</p>${theme}<h2>叙事逻辑</h2><ol class="narrative">${narrative}</ol></header><main>${slides}</main></body></html>`;
}
