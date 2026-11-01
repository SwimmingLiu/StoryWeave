import { isThemeCatalog } from './themes.mjs';

export const MODES = Object.freeze({ IMAGEGEN: 'imagegen', AI_IMAGE: 'ai-image', HTML: 'html' });
export const NARRATIVE_KEYS = Object.freeze(['opening', 'problem', 'insight', 'method', 'action']);
export const PAGE_ROLES = Object.freeze(['cover', 'section', 'statement', 'image-hero', 'two-column', 'comparison', 'process', 'data', 'quote', 'closing']);
export const LAYOUT_ZONES = Object.freeze(['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']);
export const LAYOUT_DENSITIES = Object.freeze(['low', 'medium', 'high']);
export const LEGACY_THEME_MIGRATIONS = Object.freeze({
  editorial: 'editorial/paper-magazine',
  'wuming-cyan-circuit': 'systems/white-cyan-circuit',
});

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return structuredClone(value);
}

function defaultLayout(role) {
  const shared = { visual_zone: ['center', 'right'], hierarchy: ['headline', 'visual-anchor'], density: 'low' };
  if (role === 'closing') return { text_safe_zone: 'bottom-left', visual_zone: ['right'], hierarchy: ['closing-claim', 'visual-anchor'], density: 'low' };
  if (role === 'statement' || role === 'quote') return { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['statement', 'visual-anchor'], density: 'low' };
  if (role === 'two-column' || role === 'comparison') return { text_safe_zone: 'top-left', ...shared, hierarchy: ['comparison-conclusion', 'parallel-fields'], density: 'medium' };
  if (role === 'process' || role === 'data') return { text_safe_zone: 'top-left', ...shared, hierarchy: ['headline', 'system-groups', 'relationship-paths'], density: 'medium' };
  if (role === 'image-hero') return { text_safe_zone: 'top-left', ...shared, hierarchy: ['caption', 'visual-anchor'], density: 'low' };
  return { text_safe_zone: 'top-left', ...shared };
}

function defaultAnchor(themeRef) {
  const ref = String(themeRef ?? '');
  if (ref.startsWith('systems/')) return 'calibration-line';
  if (ref.startsWith('campaign/')) return 'campaign-mark';
  if (ref.startsWith('cinematic/')) return 'film-frame';
  return 'oxide-rule';
}

export function defaultLayoutForRole(role) {
  return defaultLayout(role);
}

function createV3Slide([id, role, claim, exact_text, purpose], index, themeRef, anchorId) {
  return {
    id,
    role,
    purpose,
    claim,
    exact_text,
    evidence: [],
    visual_brief: [
      'A quiet network of notes and paths with generous negative space',
      'Scattered fragments becoming a connected field of context',
      'A visual shift from isolated stacks to connected pathways',
      'Four clear stages moving through one continuous path',
      'Repeated reuse represented as a small signal becoming a durable system',
      'One focused workflow moving forward with calm visual momentum',
    ][index] ?? 'A restrained visual metaphor with generous negative space',
    visual_scheme_ref: 'auto',
    visual_anchor_id: anchorId ?? defaultAnchor(themeRef),
    continuity_group: index > 0 ? 'knowledge-flow' : 'cover',
    layout_plan: defaultLayout(role),
    transition: id === 's06' ? '结束' : '进入下一层叙事',
  };
}

export function createOutline(title = 'AI 原生知识工作流', options = {}) {
  if (typeof options === 'string') options = { theme_ref: options };
  const theme_ref = options.theme_ref ?? 'editorial/paper-magazine';
  const catalog_scope = options.catalog_scope ?? options.scope ?? 'authoring';
  const anchorId = options.visual_anchor_id ?? options.anchor_id ?? defaultAnchor(theme_ref);
  return {
    schema_version: 3,
    status: 'draft',
    catalog_scope,
    title,
    audience: '产品团队、知识工作者与组织管理者',
    purpose: '说明 AI 原生知识工作流的核心变化与行动路径',
    page_count: 6,
    central_message: '把散落的信息、判断和行动接成一条能持续复用的工作流。',
    narrative: {
      opening: '信息越来越多，但上下文仍在不断丢失。',
      problem: '资料、判断与行动分散在不同工具和短期记忆中。',
      insight: '真正需要积累的是可复用的上下文，而不是更多文件。',
      method: '通过收集、关联、判断、行动形成闭环。',
      action: '先改造一条高频流程，再逐步扩展。',
    },
    language: options.language ?? 'zh-CN',
    canvas: '16:9',
    theme_ref,
    slides: [
      ['s01', 'cover', 'AI 原生知识工作流', ['AI 原生知识工作流', '让上下文持续产生价值'], '建立主题与核心判断'],
      ['s02', 'statement', '问题不是信息太少，而是上下文不断丢失', ['信息很多，上下文却在丢失', '资料散落', '判断失联', '行动断点'], '明确问题'],
      ['s03', 'comparison', '从文件堆积转向上下文复用', ['从文件堆积，转向上下文复用', '过去：保存结果', '现在：保存判断过程'], '提出转变'],
      ['s04', 'process', '四个动作构成闭环', ['四个动作构成闭环', '收集现场', '建立关联', '形成判断', '推进行动'], '解释方法'],
      ['s05', 'data', '价值来自复用次数，而不是文件数量', ['价值 = 上下文质量 × 复用次数', '一次整理，多次调用'], '给出价值判断'],
      ['s06', 'closing', '先重做一条高频流程', ['先重做一条高频流程', '把上下文、判断和行动连起来'], '给出行动建议'],
    ].map((slide, index) => createV3Slide(slide, index, theme_ref, anchorId)),
  };
}

function validateCommon(outline, errors) {
  if (!outline || typeof outline !== 'object') return ['Storyboard 必须是对象'];
  for (const [field, label] of [['title', '标题'], ['audience', '受众'], ['purpose', '目的'], ['central_message', '中心含义']]) {
    if (!present(outline[field])) errors.push(`缺少${label}`);
  }
  for (const key of NARRATIVE_KEYS) if (!present(outline.narrative?.[key])) errors.push(`叙事逻辑缺少 ${key}`);
  if (!Number.isInteger(outline.page_count) || outline.page_count < 1) errors.push('页数必须是正整数');
  if (!Array.isArray(outline.slides) || outline.slides.length === 0) errors.push('至少需要一页');
  if (Array.isArray(outline.slides) && outline.page_count !== outline.slides.length) errors.push('页数与逐页内容不一致');
  const ids = new Set();
  for (const [index, slide] of (outline.slides ?? []).entries()) {
    const prefix = `第 ${index + 1} 页`;
    if (!present(slide?.id) || ids.has(slide.id) || !/^[A-Za-z0-9_-]+$/.test(slide.id ?? '')) errors.push(`${prefix}的 ID 缺失、重复或格式不正确`);
    ids.add(slide?.id);
    if (!PAGE_ROLES.includes(slide?.role)) errors.push(`${prefix}的角色无效`);
    if (!present(slide?.claim)) errors.push(`${prefix}缺少单页主张`);
    if (!Array.isArray(slide?.exact_text) || slide.exact_text.length === 0 || slide.exact_text.some((line) => !present(line))) errors.push(`${prefix}缺少准确文字`);
    if (!present(slide?.purpose)) errors.push(`${prefix}缺少页面目的`);
    if (!present(slide?.visual_brief)) errors.push(`${prefix}缺少视觉构思`);
    if (!present(slide?.transition)) errors.push(`${prefix}缺少转场说明`);
    if (!Array.isArray(slide?.evidence)) errors.push(`${prefix}的 evidence 必须是数组`);
  }
}

function validateV3(outline) {
  const errors = [];
  validateCommon(outline, errors);
  if (outline.schema_version !== 3) errors.push('v3 Storyboard 的 schema_version 必须为 3');
  if (outline.status !== 'draft') errors.push('v3 Storyboard 的状态必须是 draft');
  if (!['active', 'authoring'].includes(outline.catalog_scope)) errors.push('catalog_scope 必须是 active 或 authoring');
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(outline.theme_ref ?? '')) errors.push('theme_ref 必须使用完整的 architecture/style 引用');
  if (!present(outline.language)) errors.push('缺少语言标签');
  if (outline.canvas !== '16:9') errors.push('画布必须是 16:9');
  for (const [index, slide] of (outline.slides ?? []).entries()) {
    const prefix = `第 ${index + 1} 页`;
    if (!present(slide?.visual_scheme_ref) || (slide.visual_scheme_ref !== 'auto' && !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(slide.visual_scheme_ref))) errors.push(`${prefix}的 visual_scheme_ref 必须是 auto 或完整引用`);
    if (!present(slide?.visual_anchor_id)) errors.push(`${prefix}缺少 visual_anchor_id`);
    if (!present(slide?.continuity_group)) errors.push(`${prefix}缺少 continuity_group`);
    const layout = slide?.layout_plan;
    if (!layout || !LAYOUT_ZONES.includes(layout.text_safe_zone)) errors.push(`${prefix}的 text_safe_zone 无效`);
    const visualZones = Array.isArray(layout?.visual_zone) ? layout.visual_zone : null;
    if (!visualZones?.length || visualZones.some((zone) => !LAYOUT_ZONES.includes(zone))) errors.push(`${prefix}的 visual_zone 必须是有效九宫格数组`);
    if (visualZones?.includes(layout?.text_safe_zone)) errors.push(`${prefix}的 text_safe_zone 与 visual_zone 不能重叠`);
    if (!Array.isArray(layout?.hierarchy) || layout.hierarchy.length === 0 || layout.hierarchy.some((item) => !present(item))) errors.push(`${prefix}的 hierarchy 必须是非空字符串数组`);
    if (!LAYOUT_DENSITIES.includes(layout?.density)) errors.push(`${prefix}的 density 无效`);
    if (slide.visual_scheme_ref !== 'auto' && !slide.visual_scheme_ref.startsWith(`${outline.theme_ref}/`)) errors.push(`${prefix}的视觉方案必须属于当前主题样式`);
  }
  return { valid: errors.length === 0, errors };
}

function validateV2(outline) {
  const errors = [];
  validateCommon(outline, errors);
  for (const [index, slide] of (outline.slides ?? []).entries()) {
    const prefix = `第 ${index + 1} 页`;
    for (const key of ['text_safe_zone', 'visual_zone', 'hierarchy', 'density']) if (!present(slide?.layout_plan?.[key])) errors.push(`${prefix}缺少布局计划 ${key}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateOutline(outline) {
  if (!outline || typeof outline !== 'object') return { valid: false, errors: ['Storyboard 必须是对象'] };
  return outline.schema_version === 3 ? validateV3(outline) : validateV2(outline);
}

export function approveOutline(outline, { mode, theme, theme_ref, themes, catalog, catalog_scope } = {}) {
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  if (mode !== MODES.IMAGEGEN) throw new Error(`storyweave-imagegen 只支持 imagegen 模式：${mode ?? '未提供'}`);
  const selectedCatalog = themes ?? catalog;
  if (outline.schema_version !== 3) {
    if (!theme) throw new Error('缺少主题');
    return { ...clone(outline), status: 'approved', mode, output_mode: 'full-slide-image', theme: typeof theme === 'string' ? theme : theme.id, approved_at: new Date().toISOString() };
  }
  const selectedThemeRef = theme_ref ?? (typeof theme === 'string' ? theme : null) ?? outline.theme_ref;
  if (!present(selectedThemeRef)) throw new Error('缺少完整主题引用');
  const result = clone(outline);
  result.theme_ref = selectedThemeRef;
  result.catalog_scope = catalog_scope ?? outline.catalog_scope;
  if (selectedCatalog && isThemeCatalog(selectedCatalog)) {
    result.slides = result.slides.map((slide) => {
      const plan = selectedCatalog.resolveVisualPlan({ phase: 'approve', theme_ref: selectedThemeRef, slide });
      return { ...slide, visual_scheme_ref: plan.visual_scheme_ref, visual_anchor_id: plan.visual_anchor_id, layout_plan: plan.layout_plan };
    });
  } else if (result.slides.some((slide) => slide.visual_scheme_ref === 'auto')) {
    // Keep the pre-v3 flat-theme call shape usable for existing projects and tests.
    // A full v3 reference still requires the catalog resolver so that status,
    // role support and layout constraints cannot be bypassed.
    if (selectedThemeRef.includes('/') && !(theme && typeof theme === 'object')) {
      throw new Error('v3 approve 需要通过 openThemeCatalog 提供主题解析器。');
    }
    result.slides = result.slides.map((slide) => ({ ...slide, visual_scheme_ref: `${selectedThemeRef}/legacy` }));
  }
  result.status = 'approved';
  result.mode = mode;
  result.output_mode = 'full-slide-image';
  result.approved_at = new Date().toISOString();
  return result;
}

/**
 * Re-plan a draft for another theme style. Content fields remain intact while
 * every visual field is regenerated and the result returns to draft status.
 */
export function replanOutline(outline, { theme_ref, themes, catalog, catalog_scope = 'authoring' } = {}) {
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  const selectedCatalog = themes ?? catalog;
  if (!isThemeCatalog(selectedCatalog)) throw new Error('主题切换需要通过 openThemeCatalog 提供主题解析器。');
  if (!present(theme_ref)) throw new Error('主题切换需要完整的 theme_ref。');
  const themeDefaultAnchor = selectedCatalog.getStyle(theme_ref).default_anchor_id ?? defaultAnchor(theme_ref);
  const next = clone(outline);
  next.schema_version = 3;
  next.status = 'draft';
  next.catalog_scope = catalog_scope;
  next.theme_ref = theme_ref;
  next.language = next.language ?? 'zh-CN';
  next.canvas = '16:9';
  next.slides = next.slides.map((slide, index) => {
    const visual = {
      id: slide.id,
      role: slide.role,
      purpose: slide.purpose,
      claim: slide.claim,
      exact_text: [...slide.exact_text],
      evidence: clone(slide.evidence ?? []),
      visual_brief: slide.visual_brief,
      visual_scheme_ref: 'auto',
      visual_anchor_id: themeDefaultAnchor,
      continuity_group: index === 0 ? 'cover' : 'main',
      layout_plan: defaultLayout(slide.role),
      transition: slide.transition,
    };
    if (slide.sources) visual.sources = clone(slide.sources);
    if (slide.speaker_notes) visual.speaker_notes = slide.speaker_notes;
    const plan = selectedCatalog.resolveVisualPlan({ phase: 'draft', theme_ref, slide: visual });
    return { ...visual, visual_anchor_id: plan.visual_anchor_id, layout_plan: plan.layout_plan };
  });
  delete next.mode;
  delete next.output_mode;
  delete next.approved_at;
  return next;
}

export const switchTheme = replanOutline;

export function migrateOutline(outline, { theme_ref, themes, catalog, language, catalog_scope = 'authoring' } = {}) {
  if (!outline || outline.schema_version === 3) throw new Error('migrateOutline expects a v2 outline draft.');
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  const selectedCatalog = themes ?? catalog;
  if (!isThemeCatalog(selectedCatalog)) throw new Error('迁移需要通过 openThemeCatalog 提供主题解析器。');
  const oldTheme = theme_ref ?? outline.theme_ref ?? outline.theme;
  const mappedTheme = LEGACY_THEME_MIGRATIONS[oldTheme] ?? oldTheme;
  if (!present(language)) throw new Error('v2 项目缺少语言标签，请通过 --language 提供。');
  if (!present(mappedTheme) || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(mappedTheme)) {
    throw new Error(`旧主题 ${oldTheme ?? 'missing'} 没有确定的 v3 映射，请先选择新的主题样式。`);
  }
  const themeDefaultAnchor = selectedCatalog.getStyle(mappedTheme).default_anchor_id ?? defaultAnchor(mappedTheme);
  const seed = {
    schema_version: 3,
    status: 'draft',
    catalog_scope,
    title: outline.title,
    audience: outline.audience,
    purpose: outline.purpose,
    page_count: outline.page_count,
    central_message: outline.central_message,
    narrative: clone(outline.narrative),
    language,
    canvas: '16:9',
    theme_ref: mappedTheme,
    slides: outline.slides.map((slide, index) => {
      const next = {
        id: slide.id,
        role: slide.role,
        purpose: slide.purpose,
        claim: slide.claim,
        exact_text: [...slide.exact_text],
        evidence: clone(slide.evidence ?? []),
        visual_brief: slide.visual_brief,
        visual_scheme_ref: 'auto',
        visual_anchor_id: themeDefaultAnchor,
        continuity_group: index === 0 ? 'cover' : 'main',
        layout_plan: defaultLayout(slide.role),
        transition: slide.transition ?? (index === outline.slides.length - 1 ? '结束' : '进入下一层叙事'),
      };
      if (slide.sources) next.sources = clone(slide.sources);
      if (slide.speaker_notes) next.speaker_notes = slide.speaker_notes;
      return next;
    }),
  };
  const migrated = replanOutline(seed, { theme_ref: mappedTheme, themes: selectedCatalog, catalog_scope });
  migrated.status = 'draft';
  return migrated;
}

export function visibleText(outline) {
  return (outline.slides ?? []).flatMap((slide) => slide.exact_text ?? []);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderOutlinePreview(outline) {
  const narrative = NARRATIVE_KEYS
    .map((key) => `<li><strong>${key}</strong><span>${escapeHtml(outline.narrative?.[key])}</span></li>`)
    .join('');
  const slides = (outline.slides ?? []).map((slide, index) => `<article><div class="number">第 ${index + 1} 页</div><div><small>${escapeHtml(slide.role)} · ${escapeHtml(slide.visual_scheme_ref ?? 'auto')}</small><h2>${escapeHtml(slide.claim)}</h2><p>${escapeHtml(slide.purpose)}</p><ul>${(slide.exact_text ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p class="meta">视觉：${escapeHtml(slide.visual_brief)} · 布局：${escapeHtml(JSON.stringify(slide.layout_plan ?? {}))} · 衔接：${escapeHtml(slide.transition)}</p></div></article>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(outline.title)} 内容草稿</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f3ef;color:#172019;font-family:system-ui,'Noto Sans SC',sans-serif;letter-spacing:0}header,main{max-width:1100px;margin:auto;padding:40px 28px}header{padding-bottom:20px}h1{font-size:42px;margin:0 0 14px}.lead{font-size:24px;line-height:1.5;border-left:5px solid #146c5a;padding-left:20px}.narrative{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:0;list-style:none}.narrative li{background:#fff;border-top:3px solid #146c5a;padding:16px}.narrative strong,.narrative span{display:block}.narrative strong{text-transform:uppercase;font-size:11px;color:#647068;margin-bottom:8px}article{display:grid;grid-template-columns:110px 1fr;gap:24px;background:#fff;border:1px solid #d8ddd7;margin:14px 0;padding:24px}.number{font-weight:700;color:#146c5a}article h2{font-size:27px;margin:4px 0 8px}article p{line-height:1.6}.meta{color:#667068;font-size:13px}@media(max-width:760px){.narrative{grid-template-columns:1fr}article{grid-template-columns:1fr}h1{font-size:32px}}</style></head><body><header><h1>${escapeHtml(outline.title)} · Storyboard</h1><p class="lead"><strong>中心含义：</strong>${escapeHtml(outline.central_message)}</p><p>主题样式：${escapeHtml(outline.theme_ref)} · 目录范围：${escapeHtml(outline.catalog_scope)}</p><h2>叙事逻辑</h2><ol class="narrative">${narrative}</ol></header><main>${slides}</main></body></html>`;
}
