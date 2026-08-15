export const MODES = Object.freeze({ HTML: 'html' });
export const NARRATIVE_KEYS = Object.freeze(['opening', 'problem', 'insight', 'method', 'action']);

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createOutline(title = 'AI 原生知识工作流') {
  return {
    schema_version: 2,
    status: 'draft',
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
    slides: [
      ['s01', 'cover', 'AI 原生知识工作流', ['AI 原生知识工作流', '让上下文持续产生价值'], '建立主题与核心判断'],
      ['s02', 'statement', '问题不是信息太少，而是上下文不断丢失', ['信息很多，上下文却在丢失', '资料散落', '判断失联', '行动断点'], '明确问题'],
      ['s03', 'comparison', '从文件堆积转向上下文复用', ['从文件堆积，转向上下文复用', '过去：保存结果', '现在：保存判断过程'], '提出转变'],
      ['s04', 'process', '四个动作构成闭环', ['四个动作构成闭环', '收集现场', '建立关联', '形成判断', '推进行动'], '解释方法'],
      ['s05', 'data', '价值来自复用次数，而不是文件数量', ['价值 = 上下文质量 × 复用次数', '一次整理，多次调用'], '给出价值判断'],
      ['s06', 'closing', '先重做一条高频流程', ['先重做一条高频流程', '把上下文、判断和行动连起来'], '给出行动建议'],
    ].map(([id, role, claim, exact_text, purpose], index) => ({
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
    })),
  };
}

export function validateOutline(outline) {
  const errors = [];
  if (!outline || typeof outline !== 'object') return { valid: false, errors: ['Storyboard 必须是对象'] };
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
    if (!present(slide?.id) || ids.has(slide.id)) errors.push(`${prefix}的 ID 缺失或重复`);
    ids.add(slide?.id);
    if (!present(slide?.role)) errors.push(`${prefix}缺少角色`);
    if (!present(slide?.claim)) errors.push(`${prefix}缺少单页主张`);
    if (!Array.isArray(slide?.exact_text) || slide.exact_text.length === 0 || slide.exact_text.some((line) => !present(line))) errors.push(`${prefix}缺少准确文字`);
    if (!present(slide?.purpose)) errors.push(`${prefix}缺少页面目的`);
    if (!present(slide?.visual_brief)) errors.push(`${prefix}缺少视觉构思`);
    if (!present(slide?.transition)) errors.push(`${prefix}缺少转场说明`);
  }
  return { valid: errors.length === 0, errors };
}

export function approveOutline(outline, { mode, theme }) {
  const check = validateOutline(outline);
  if (!check.valid) throw new Error(check.errors.join('；'));
  if (!Object.values(MODES).includes(mode)) throw new Error(`未知模式：${mode}`);
  if (!theme) throw new Error('缺少主题');
  return { ...structuredClone(outline), status: 'approved', mode, theme, approved_at: new Date().toISOString() };
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
  const slides = (outline.slides ?? []).map((slide, index) => `<article><div class="number">第 ${index + 1} 页</div><div><small>${escapeHtml(slide.role)}</small><h2>${escapeHtml(slide.claim)}</h2><p>${escapeHtml(slide.purpose)}</p><ul>${(slide.exact_text ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p class="meta">视觉：${escapeHtml(slide.visual_brief)} · 衔接：${escapeHtml(slide.transition)}</p></div></article>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(outline.title)} 内容草稿</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f3ef;color:#172019;font-family:system-ui,'Noto Sans SC',sans-serif;letter-spacing:0}header,main{max-width:1100px;margin:auto;padding:40px 28px}header{padding-bottom:20px}h1{font-size:42px;margin:0 0 14px}.lead{font-size:24px;line-height:1.5;border-left:5px solid #146c5a;padding-left:20px}.narrative{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:0;list-style:none}.narrative li{background:#fff;border-top:3px solid #146c5a;padding:16px}.narrative strong,.narrative span{display:block}.narrative strong{text-transform:uppercase;font-size:11px;color:#647068;margin-bottom:8px}article{display:grid;grid-template-columns:110px 1fr;gap:24px;background:#fff;border:1px solid #d8ddd7;margin:14px 0;padding:24px}.number{font-weight:700;color:#146c5a}article h2{font-size:27px;margin:4px 0 8px}article p{line-height:1.6}.meta{color:#667068;font-size:13px}@media(max-width:760px){.narrative{grid-template-columns:1fr}article{grid-template-columns:1fr}h1{font-size:32px}}</style></head><body><header><h1>${escapeHtml(outline.title)} · Storyboard</h1><p class="lead"><strong>中心含义：</strong>${escapeHtml(outline.central_message)}</p><h2>叙事逻辑</h2><ol class="narrative">${narrative}</ol></header><main>${slides}</main></body></html>`;
}
