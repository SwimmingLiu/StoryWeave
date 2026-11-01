import { assertApprovedContent } from '../core/content.mjs';
import { openThemeCatalog, resolveTheme, sha256 } from './themes.mjs';
import { planDiagram } from './diagram.mjs';
import { createVisualIntent, VISUAL_POLICY } from '../core/visual-policy.mjs';

// Content-driven diagram planning replaces the user-rejected theme-only direction; old v4 plans must replan.
export const HTML_RENDERER_VERSION = '4.3.0';
export const LAYOUTS = Object.freeze({
  statement: ['statement', 'statement-split', 'image-hero', 'cover-split', 'closing-statement', 'quote'],
  comparison: ['comparison-matrix'],
  process: ['process-linear', 'process-loop', 'process-network'],
  metrics: ['metric-ledger'],
  graph: ['relationship-map'],
});

const present = (value) => typeof value === 'string' && value.trim().length > 0;
const clone = (value) => structuredClone(value);

function cycleIn(nodes, edges) {
  const visiting = new Set();
  const visited = new Set();
  const next = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) next.get(edge.from).push(edge.to);
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if (next.get(id).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}

export function defaultLayout(slide) {
  const content = slide.content;
  if (content.type === 'statement') {
    if (slide.role === 'cover' || slide.role === 'section') return 'cover-split';
    if (slide.role === 'closing') return 'closing-statement';
    if (slide.role === 'quote') return 'quote';
    return 'statement';
  }
  if (content.type === 'comparison') return 'comparison-matrix';
  if (content.type === 'metrics') return 'metric-ledger';
  if (content.type === 'graph') return 'relationship-map';
  if (cycleIn(content.steps, content.edges)) return 'process-loop';
  const linear = content.edges.length === content.steps.length - 1 && content.edges.every((edge, index) => edge.from === content.steps[index].id && edge.to === content.steps[index + 1].id);
  return linear ? 'process-linear' : 'process-network';
}

function capacityErrors(content) {
  const errors = [];
  for (const slide of content.slides) {
    const item = slide.content;
    const counts = { comparison: item.rows?.length, process: item.steps?.length, metrics: item.metrics?.length, graph: item.nodes?.length };
    const limits = { comparison: 5, process: 6, metrics: 4, graph: 8 };
    if (counts[item.type] > limits[item.type]) errors.push(`${slide.id}: ${item.type} exceeds this layout's ${limits[item.type]} item capacity. Split the page or choose a different information shape.`);
    if (item.type === 'comparison' && item.columns.length > 4) errors.push(`${slide.id}: comparison supports at most four columns.`);
    if (item.type === 'statement' && (item.body?.length ?? 0) > 5) errors.push(`${slide.id}: statement supports at most five body paragraphs.`);
    if ([...item.title].length > 90) errors.push(`${slide.id}: title exceeds the three-line title capacity. Revise the title before approval.`);
  }
  return errors;
}

function initialTone(slide, index, architecture) {
  if (slide.role === 'cover') return architecture === 'editorial' ? 'light' : 'dark';
  if (slide.role === 'closing') return architecture === 'cinematic' ? 'dark' : 'accent';
  if (slide.content.type === 'metrics' && architecture !== 'editorial') return 'dark';
  return index > 0 && index % 5 === 0 && architecture === 'cinematic' ? 'dark' : 'light';
}

// These two existing themes have distinct composition systems; other themes retain their current styling.
function visualSystem(themeRef) {
  return themeRef === 'editorial/paper-magazine' ? 'magazine' : themeRef === 'systems/ink-blue-grid' ? 'swiss' : 'standard';
}

function plannedLayout(slide, system, assets) {
  if (slide.content.type === 'statement' && !['cover', 'closing', 'section', 'quote'].includes(slide.role)) {
    if (assets.some((asset) => asset.slot === 'hero')) return 'image-hero';
    if (system === 'swiss' && (slide.content.body?.length ?? 0) >= 2 && [...slide.content.title].length <= 24) return 'statement-split';
  }
  return defaultLayout(slide);
}

function pageGeometry(slide, layout, system) {
  const length = [...slide.content.title].length;
  const anchor = ['cover-split', 'closing-statement', 'quote'].includes(layout);
  const split = layout === 'statement-split';
  const image = layout === 'image-hero';
  const size = image ? (length > 32 ? 48 : 64) : split ? 76 : anchor ? (length > 32 ? 58 : 96) : length > 32 ? 48 : 64;
  return {
    gutter: system === 'magazine' ? 80 : 64,
    grid_columns: system === 'magazine' ? 12 : 16,
    grid_gap: system === 'magazine' ? 24 : 16,
    title_size: size,
    title_weight: system === 'swiss' ? 300 : system === 'magazine' ? 600 : 500,
    title_max_lines: length > 32 ? 3 : 2,
    title_body_gap: anchor ? 40 : image ? 40 : 48,
    content_safe_bottom: 80,
  };
}

function assetSlots(page) {
  return page.asset_refs.map((asset) => ({
    asset_id: asset.asset_id, slot: asset.slot ?? 'hero',
    aspect_ratio: page.layout_id === 'image-hero' ? (page.composition === 'image-strip' ? '4:1' : '21:9') : '4:3',
    fit: asset.fit === 'contain' ? 'contain' : 'cover',
    focal_point: clone(asset.focal_point ?? { x: .5, y: .5 }),
    subject_safe_area: clone(asset.subject_safe_area ?? null),
  }));
}

function finishPage(slide, page, system) {
  page.geometry = pageGeometry(slide, page.layout_id, system);
  // Theme-specific image treatments remain choices to review, not proof that one composition is better.
  page.composition = page.layout_id === 'image-hero'
    ? system === 'magazine' ? 'image-editorial' : system === 'swiss' && [...slide.content.title].length <= 52 && (slide.content.body ?? []).join('').length <= 100 ? 'image-strip' : 'image-columns'
    : page.layout_id;
  page.diagram = planDiagram(slide.content, page.layout_id);
  if (page.diagram) page.composition = `diagram-${page.diagram.flow}`;
  page.comparison_emphasis = slide.content.type === 'comparison' ? 'neutral' : null;
  page.asset_slots = assetSlots(page);
  page.visual_intent = createVisualIntent(slide);
}

function composeVisualPages(content, pages, system) {
  let run = 0;
  let previous;
  for (const [index, page] of pages.entries()) {
    const slide = content.slides[index];
    if (system !== 'standard') {
      page.tone = slide.role === 'cover' ? (system === 'swiss' ? 'accent' : 'dark')
        : slide.role === 'closing' ? (system === 'swiss' ? 'light' : 'dark')
          : slide.role === 'quote' || slide.content.type === 'metrics' ? 'dark' : 'light';
      // Change visual emphasis on existing content; never invent a section or claim to create rhythm.
      if (page.tone === previous && run >= 2 && !['cover', 'closing'].includes(slide.role)) page.tone = page.tone === 'light' ? 'dark' : 'light';
    }
    run = page.tone === previous ? run + 1 : 1;
    previous = page.tone;
    page.page_rhythm = ['cover', 'closing', 'section'].includes(slide.role) ? 'anchor'
      : ['metrics', 'statement'].includes(slide.content.type) ? 'breathing' : 'dense';
    finishPage(slide, page, system);
  }
}

function applyReferences(plan, references, content) {
  const applications = [];
  for (const [index, reference] of references.entries()) {
    if (!present(reference.case_id) || !present(reference.page_id) || !present(reference.purpose)) throw new Error(`Reference ${index + 1} needs a case_id, page_id and explicit purpose.`);
    if (reference.path && !/^[a-f0-9]{64}$/u.test(reference.sha256 ?? '')) throw new Error(`Reference ${reference.case_id}/${reference.page_id} needs its resource SHA-256.`);
    const application = reference.application;
    if (!application) continue;
    const page = application.slide_id ? plan.slides.find((slide) => slide.id === application.slide_id) : null;
    if (application.slide_id && !page) throw new Error(`Reference application targets unknown slide ${application.slide_id}.`);
    if (application.field === 'layout_id') {
      if (!page || !LAYOUTS[page.content_type].includes(application.value)) throw new Error(`Reference layout ${application.value} is incompatible with ${application.slide_id ?? 'the deck'}.`);
      const authored = content.slides.find((slide) => slide.id === page.id).content;
      if (application.value === 'process-loop' && !cycleIn(authored.steps, authored.edges)) throw new Error(`${page.id}: a loop reference cannot invent a feedback relationship.`);
      page.layout_id = application.value;
    } else if (application.field === 'tone') {
      if (!page || !['light', 'dark', 'accent'].includes(application.value)) throw new Error('A tone reference must name a slide and a supported tone.');
      page.tone = application.value;
    } else if (application.field === 'accent') {
      if (!/^#[a-f0-9]{6}$/iu.test(application.value ?? '')) throw new Error('A palette reference must supply a six-digit accent color.');
      plan.theme.tokens.accent = application.value;
    } else if (['heading_font', 'body_font'].includes(application.field)) {
      if (!present(application.value) || /[<>;{}]/u.test(application.value)) throw new Error('A typography reference must supply a local font-family list.');
      plan.typography[application.field] = application.value;
    } else throw new Error(`Unsupported HTML reference application field: ${application.field}`);
    applications.push({ case_id: reference.case_id, page_id: reference.page_id, purpose: reference.purpose, application: clone(application), status: 'applied' });
  }
  return applications;
}

function planHash(plan) {
  const { plan_sha256, created_at, ...stable } = plan;
  return sha256(stable);
}

export async function createHtmlPlan(content, { theme_ref = 'systems/ink-blue-grid', catalog_scope = 'active', references = [], assetRefs = {} } = {}) {
  assertApprovedContent(content);
  const capacity = capacityErrors(content);
  if (capacity.length) throw new Error(capacity.join('\n'));
  const catalog = await openThemeCatalog(null, { scope: catalog_scope });
  const style = catalog.getStyle(theme_ref);
  const resolved = resolveTheme(theme_ref, { catalog });
  if (resolved.kind !== 'canonical') throw new Error(`A structured HTML plan requires a canonical theme: ${theme_ref}`);
  const serif = style.architecture_id === 'editorial' || style.architecture_id === 'cinematic';
  const system = visualSystem(theme_ref);
  const plan = {
    schema_version: 1,
    producer: 'storyweave-html',
    contentRevision: content.revision,
    renderer_version: HTML_RENDERER_VERSION,
    theme_ref,
    catalog_scope,
    contract_version: catalog.contract_version,
    theme_source_sha256: sha256(style),
    visual_system: system,
    visual_policy: clone(VISUAL_POLICY),
    theme: { kind: 'canonical', theme_ref, architecture_id: style.architecture_id, label: style.label, tokens: clone(style.tokens) },
    typography: {
      heading_font: serif ? "'Songti SC', 'Noto Serif CJK SC', Georgia, serif" : "'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
      body_font: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
      body_size: content.reading_mode === 'reading-first' ? 24 : 28,
      caption_size: 16,
      heading_weight: system === 'swiss' ? 300 : serif ? 600 : 500,
      body_weight: 400,
      caption_weight: 500,
      title_break_policy: 'chinese-word-boundaries',
      copy_break_policy: 'chinese-word-boundaries',
    },
    references: clone(references),
    slides: content.slides.map((slide, index) => {
      const scheme = catalog.resolveVisualPlan({ theme_ref, slide: { role: slide.role, visual_scheme_ref: 'auto' } });
      return ({
      id: slide.id,
      content_type: slide.content.type,
      visual_scheme_ref: scheme.visual_scheme_ref,
      visual_scheme_sha256: scheme.visual_scheme_sha256,
      layout_id: plannedLayout(slide, system, assetRefs[slide.id] ?? []),
      tone: initialTone(slide, index, style.architecture_id),
      page_rhythm: ['cover', 'closing', 'section'].includes(slide.role) ? 'anchor' : slide.content.type === 'statement' ? 'breathing' : 'dense',
      asset_refs: clone(assetRefs[slide.id] ?? []),
      });
    }),
  };
  composeVisualPages(content, plan.slides, system);
  plan.reference_applications = applyReferences(plan, references, content);
  // A selected reference may change layout identity; its measured contract must follow that final choice.
  for (const [index, page] of plan.slides.entries()) {
    // Reference-driven layout changes also change image proportions; keeping the old slot made valid references fail QA.
    finishPage(content.slides[index], page, system);
  }
  plan.theme_recipe_sha256 = sha256({ theme: plan.theme, typography: plan.typography, contract_version: plan.contract_version, reference_applications: plan.reference_applications });
  plan.plan_sha256 = planHash(plan);
  return plan;
}

export function validateHtmlPlan(content, plan) {
  const errors = [];
  try { assertApprovedContent(content); } catch (error) { errors.push(error.message); }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { valid: false, errors: [...errors, 'HTML plan must be an object.'] };
  if (plan?.schema_version !== 1 || plan?.producer !== 'storyweave-html') errors.push('Expected an HTML plan schema 1.');
  if (plan?.contentRevision !== content?.revision) errors.push('HTML plan belongs to another approved content revision.');
  if (plan?.renderer_version !== HTML_RENDERER_VERSION) errors.push('HTML renderer changed; replan before building.');
  // A valid hash of an older plan must not omit the shared generation policy or the content it is meant to express.
  if (sha256(plan.visual_policy ?? null) !== sha256(VISUAL_POLICY)) errors.push('Visual generation policy changed; replan before building.');
  if (!plan?.theme || plan.theme.theme_ref !== plan.theme_ref || !plan?.typography) errors.push('HTML plan is missing its resolved theme or typography.');
  if (plan?.plan_sha256 !== planHash(plan ?? {})) errors.push('HTML plan changed after planning; replan before building.');
  if (plan?.theme_recipe_sha256 !== sha256({ theme: plan?.theme, typography: plan?.typography, contract_version: plan?.contract_version, reference_applications: plan?.reference_applications })) errors.push('HTML theme snapshot is stale.');
  if (!Array.isArray(plan?.slides) || plan.slides.length !== content?.slides?.length) errors.push('HTML plan page count differs from the approved content.');
  for (const [index, page] of (Array.isArray(plan.slides) ? plan.slides : []).entries()) {
    const slide = content?.slides?.[index];
    if (!page || typeof page !== 'object') { errors.push(`HTML plan page ${index + 1} must be an object.`); continue; }
    if (page.id !== slide?.id || page.content_type !== slide?.content?.type || !LAYOUTS[page.content_type]?.includes(page.layout_id)) errors.push(`HTML plan has an incompatible layout or page identity at ${index + 1}.`);
    if (slide && sha256(page.visual_intent ?? null) !== sha256(createVisualIntent(slide))) errors.push(`Visual intent is stale for ${page.id}; replan it.`);
    if (!['light', 'dark', 'accent'].includes(page.tone)) errors.push(`HTML plan has an unsupported tone at ${index + 1}.`);
    if (page.layout_id === 'process-loop' && slide?.content?.type === 'process' && !cycleIn(slide.content.steps, slide.content.edges)) errors.push(`${page.id}: a loop layout needs an explicit cycle in the approved content.`);
    if (page.layout_id === 'image-hero' && !page.asset_refs?.some((asset) => asset.slot === 'hero')) errors.push(`${page.id}: an image-hero layout requires a bound hero asset.`);
    if (slide && JSON.stringify(page.geometry) !== JSON.stringify(pageGeometry(slide, page.layout_id, plan.visual_system))) errors.push(`${page.id}: layout geometry differs from the current visual contract.`);
    for (const slot of page.asset_slots ?? []) {
      const focal = slot.focal_point;
      const safe = slot.subject_safe_area;
      if (!focal || ![focal.x, focal.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) errors.push(`${page.id}: image focal points must be normalized coordinates.`);
      if (safe && (![safe.x, safe.y, safe.width, safe.height].every(Number.isFinite) || safe.x < 0 || safe.y < 0 || safe.width <= 0 || safe.height <= 0 || safe.x + safe.width > 1 || safe.y + safe.height > 1)) errors.push(`${page.id}: image subject safe area must lie within the source image.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function assertCurrentHtmlPlan(content, plan) {
  const check = validateHtmlPlan(content, plan);
  if (!check.valid) throw new Error(check.errors.join('\n'));
  const catalog = await openThemeCatalog(null, { scope: plan.catalog_scope });
  if (sha256(catalog.getStyle(plan.theme_ref)) !== plan.theme_source_sha256) throw new Error('The selected theme changed; replan without changing the approved content.');
  return plan;
}
