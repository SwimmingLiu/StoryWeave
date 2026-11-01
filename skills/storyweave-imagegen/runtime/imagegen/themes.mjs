import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const PAGE_ROLES = Object.freeze([
  'cover',
  'section',
  'statement',
  'image-hero',
  'two-column',
  'comparison',
  'process',
  'data',
  'quote',
  'closing',
]);

export const ZONES = Object.freeze([
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
]);

export const DENSITIES = Object.freeze(['low', 'medium', 'high']);
export const CATALOG_SCOPES = Object.freeze(['active', 'authoring']);
export const THEME_STATUSES = Object.freeze(['active', 'candidate', 'planned']);

const ROLE_SET = new Set(PAGE_ROLES);
const ZONE_SET = new Set(ZONES);
const DENSITY_SET = new Set(DENSITIES);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalJson(value) {
  return canonicalize(value);
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalize(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export class ThemeResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ThemeResolutionError';
    this.code = code;
    this.diagnostics = [{ severity: 'blocking', code, message, ...details }];
    this.details = details;
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to load theme catalog file ${path}: ${error.message}`);
  }
}

function assertCatalog(catalog) {
  if (!isObject(catalog) || catalog.schema_version !== 3 || !Array.isArray(catalog.architectures)) {
    throw new Error('Theme catalog must be schema_version 3 with an architectures array.');
  }
}

function assertStatus(status, label) {
  if (!THEME_STATUSES.includes(status)) throw new Error(`${label} has unsupported status: ${status ?? 'missing'}`);
}

function normalizeRef(ref) {
  if (!present(ref)) return null;
  const parts = String(ref).split('/');
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  return parts;
}

function normalizeSchemeRef(ref) {
  if (!present(ref)) return null;
  const parts = String(ref).split('/');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  return parts;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function normalizeLayoutConstraints(constraints = {}) {
  return {
    text_safe_zones: normalizeList(constraints.text_safe_zones ?? constraints.text_safe_zone),
    visual_zones: normalizeList(constraints.visual_zones ?? constraints.visual_zone),
    densities: normalizeList(constraints.densities ?? constraints.density),
  };
}

function normalizeLayoutPlan(layoutPlan = {}) {
  const textSafeZone = layoutPlan.text_safe_zone;
  const visualZone = layoutPlan.visual_zone;
  const hierarchy = layoutPlan.hierarchy;
  const density = layoutPlan.density;
  return {
    text_safe_zone: textSafeZone,
    visual_zone: Array.isArray(visualZone) ? [...visualZone] : visualZone,
    hierarchy: Array.isArray(hierarchy) ? [...hierarchy] : hierarchy,
    density,
  };
}

function validateLayoutPlan({ theme_ref, visual_scheme_ref, slide, scheme }) {
  const layout = normalizeLayoutPlan(slide.layout_plan);
  if (!ZONE_SET.has(layout.text_safe_zone)) {
    throw new ThemeResolutionError('layout.text_safe_zone.invalid', `Invalid text_safe_zone for ${slide.id ?? 'slide'}: ${layout.text_safe_zone}`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (!Array.isArray(layout.visual_zone) || layout.visual_zone.length === 0 || layout.visual_zone.some((zone) => !ZONE_SET.has(zone))) {
    throw new ThemeResolutionError('layout.visual_zone.invalid', `Invalid visual_zone for ${slide.id ?? 'slide'}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (!Array.isArray(layout.hierarchy) || layout.hierarchy.length === 0 || layout.hierarchy.some((item) => !present(item))) {
    throw new ThemeResolutionError('layout.hierarchy.invalid', `layout_plan.hierarchy must be a non-empty string array for ${slide.id ?? 'slide'}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (!DENSITY_SET.has(layout.density)) {
    throw new ThemeResolutionError('layout.density.invalid', `Invalid density for ${slide.id ?? 'slide'}: ${layout.density}`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (layout.visual_zone.includes(layout.text_safe_zone)) {
    throw new ThemeResolutionError('layout.zone_overlap', `text_safe_zone and visual_zone overlap for ${slide.id ?? 'slide'}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  const constraints = normalizeLayoutConstraints(scheme.layout_constraints);
  const unknownConstraintZone = [...constraints.text_safe_zones, ...constraints.visual_zones].find((zone) => !ZONE_SET.has(zone));
  if (unknownConstraintZone) {
    throw new ThemeResolutionError('scheme.layout_constraints.invalid', `Scheme ${visual_scheme_ref} contains an invalid zone: ${unknownConstraintZone}.`, { theme_ref, visual_scheme_ref });
  }
  if (constraints.densities.some((item) => !DENSITY_SET.has(item))) {
    throw new ThemeResolutionError('scheme.layout_constraints.invalid', `Scheme ${visual_scheme_ref} contains an invalid density.`, { theme_ref, visual_scheme_ref });
  }
  if (constraints.text_safe_zones.length && !constraints.text_safe_zones.includes(layout.text_safe_zone)) {
    throw new ThemeResolutionError('layout.text_safe_zone.unsupported', `Scheme ${visual_scheme_ref} does not support text_safe_zone ${layout.text_safe_zone}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (constraints.visual_zones.length && layout.visual_zone.some((zone) => !constraints.visual_zones.includes(zone))) {
    throw new ThemeResolutionError('layout.visual_zone.unsupported', `Scheme ${visual_scheme_ref} does not support the requested visual_zone.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  if (constraints.densities.length && !constraints.densities.includes(layout.density)) {
    throw new ThemeResolutionError('layout.density.unsupported', `Scheme ${visual_scheme_ref} does not support density ${layout.density}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
  }
  return layout;
}

function assertSlide(slide, phase) {
  if (!isObject(slide)) throw new ThemeResolutionError('slide.invalid', 'A slide object is required.');
  if (!ROLE_SET.has(slide.role)) throw new ThemeResolutionError('slide.role.invalid', `Unsupported page role: ${slide.role ?? 'missing'}`, { slide_id: slide.id });
  if (!Array.isArray(slide.exact_text) || slide.exact_text.length === 0 || slide.exact_text.some((line) => !present(line))) {
    throw new ThemeResolutionError('slide.exact_text.invalid', `Slide ${slide.id ?? 'unknown'} must provide a non-empty exact_text array.`, { slide_id: slide.id });
  }
  if (!Array.isArray(slide.evidence)) throw new ThemeResolutionError('slide.evidence.invalid', `Slide ${slide.id ?? 'unknown'} must provide an evidence array.`, { slide_id: slide.id });
  if (!present(slide.visual_brief)) throw new ThemeResolutionError('slide.visual_brief.invalid', `Slide ${slide.id ?? 'unknown'} must provide visual_brief.`, { slide_id: slide.id });
  if (!isObject(slide.layout_plan)) throw new ThemeResolutionError('slide.layout_plan.invalid', `Slide ${slide.id ?? 'unknown'} must provide layout_plan.`, { slide_id: slide.id });
  if (phase === 'prompt' && slide.visual_scheme_ref === 'auto') {
    throw new ThemeResolutionError('visual_scheme.auto_unresolved', `Prompt compilation cannot use auto for slide ${slide.id ?? 'unknown'}.`, { slide_id: slide.id });
  }
}

function themeRecipeHashInput(architecture, style, theme_ref) {
  return {
    schema_version: 3,
    theme_ref,
    architecture: {
      id: architecture.id,
      spatial_grammar: architecture.spatial_grammar,
      reading_order: architecture.reading_order,
      density_strategy: architecture.density_strategy,
      deck_rhythm: architecture.deck_rhythm,
    },
    style: {
      architecture_id: style.architecture_id,
      id: style.id,
      art_direction: style.art_direction,
      palette: style.palette,
      typography: style.typography,
      materials: style.materials,
      anchors: style.anchors,
      default_anchor_id: style.default_anchor_id,
      text_layout: style.text_layout,
      contrast: style.contrast,
      avoid: style.avoid,
    },
  };
}

function visualSchemeHashInput(scheme, visual_scheme_ref) {
  return {
    schema_version: 3,
    visual_scheme_ref,
    roles: scheme.roles,
    default_anchor_id: scheme.default_anchor_id,
    composition: scheme.composition,
    imagery: scheme.imagery,
    title_treatment: scheme.title_treatment,
    layout_constraints: scheme.layout_constraints,
    requirements: scheme.requirements,
    avoid: scheme.avoid,
  };
}

function promptFragments(architecture, style, scheme, layout, slide, theme_ref, visual_scheme_ref) {
  return {
    architecture: {
      spatial_grammar: architecture.spatial_grammar,
      reading_order: architecture.reading_order,
      density_strategy: architecture.density_strategy,
      deck_rhythm: architecture.deck_rhythm,
    },
    style: {
      art_direction: style.art_direction,
      palette: style.palette,
      typography: style.typography,
      materials: style.materials,
      anchors: (style.anchors ?? []).map((anchor) => anchor.prompt ?? anchor.id).filter(Boolean),
      text_layout: style.text_layout,
      contrast: style.contrast,
    },
    visual_scheme: {
      composition: scheme.composition,
      imagery: scheme.imagery,
      requirements: scheme.requirements ?? [],
      avoid: scheme.avoid ?? [],
      title_treatment: scheme.title_treatment ?? null,
    },
    layout: clone(layout),
    safety: {
      exact_text_only: true,
      no_extra_words: true,
      no_invented_metrics_or_citations: true,
      no_unprovided_ui_brand_or_identity: true,
      text_safe_zone: layout.text_safe_zone,
      metadata_excluded: true,
    },
    refs: { theme_ref, visual_scheme_ref },
    slide_brief: slide.visual_brief,
  };
}

function styleStatusAllowed(status, scope) {
  if (status === 'planned') return false;
  if (scope === 'active') return status === 'active';
  return status === 'active' || status === 'candidate';
}

export async function openThemeCatalog(themeRoot, { scope = 'active' } = {}) {
  if (!CATALOG_SCOPES.includes(scope)) throw new Error(`Unsupported theme catalog scope: ${scope}`);
  const root = resolve(themeRoot);
  const catalog = await readJson(join(root, 'catalog.json'));
  assertCatalog(catalog);
  const architectureMap = new Map();
  const styleMap = new Map();
  for (const metadata of catalog.architectures) {
    if (!isObject(metadata) || !present(metadata.id) || !present(metadata.file)) throw new Error('Every theme architecture needs an id and file.');
    assertStatus(metadata.status, `Architecture ${metadata.id}`);
    if (architectureMap.has(metadata.id)) throw new Error(`Duplicate theme architecture: ${metadata.id}`);
    const architecture = await readJson(join(root, metadata.file));
    if (architecture.id !== metadata.id) throw new Error(`Architecture file id mismatch for ${metadata.id}.`);
    const declaredStyles = Array.isArray(metadata.styles) ? metadata.styles : [];
    const expectedArchitectureStatus = declaredStyles.some((style) => style.status === 'active')
      ? 'active'
      : declaredStyles.some((style) => style.status === 'candidate') ? 'candidate' : 'planned';
    if (metadata.status !== expectedArchitectureStatus) throw new Error(`Architecture ${metadata.id} status ${metadata.status} does not match its style statuses (${expectedArchitectureStatus}).`);
    architectureMap.set(metadata.id, { ...architecture, catalog: clone(metadata) });
    const styles = declaredStyles;
    for (const styleMetadata of styles) {
      if (!isObject(styleMetadata) || !present(styleMetadata.ref) || !present(styleMetadata.file)) throw new Error(`Architecture ${metadata.id} has an invalid style entry.`);
      const [architectureId, styleId] = String(styleMetadata.ref).split('/');
      if (architectureId !== metadata.id || !styleId) throw new Error(`Style ref ${styleMetadata.ref} does not belong to ${metadata.id}.`);
      if (styleMap.has(styleMetadata.ref)) throw new Error(`Duplicate theme style: ${styleMetadata.ref}`);
      assertStatus(styleMetadata.status, `Style ${styleMetadata.ref}`);
      const style = await readJson(join(root, styleMetadata.file));
      if (style.architecture_id !== metadata.id || style.id !== styleId) throw new Error(`Style file id mismatch for ${styleMetadata.ref}.`);
      if (!isObject(style.schemes)) throw new Error(`Style ${styleMetadata.ref} must define schemes.`);
      const styleAnchorIds = new Set((style.anchors ?? []).map((anchor) => typeof anchor === 'string' ? anchor : anchor.id));
      if (!styleAnchorIds.has(style.default_anchor_id)) throw new Error(`Style ${styleMetadata.ref} has an invalid default_anchor_id.`);
      for (const [schemeId, scheme] of Object.entries(style.schemes)) {
        if (!isObject(scheme) || !present(scheme.label) || !present(scheme.summary) || !present(scheme.preview_image) || !Array.isArray(scheme.roles) || !scheme.roles.length || !present(scheme.composition) || !present(scheme.imagery) || !isObject(scheme.layout_constraints) || !Array.isArray(scheme.requirements) || !Array.isArray(scheme.avoid)) {
          throw new Error(`Visual scheme ${metadata.id}/${styleId}/${schemeId} is missing required recipe fields.`);
        }
        if (scheme.preview_image.startsWith('/') || scheme.roles.some((role) => !ROLE_SET.has(role))) throw new Error(`Visual scheme ${metadata.id}/${styleId}/${schemeId} contains an absolute preview path or unsupported page role.`);
        if (!styleAnchorIds.has(scheme.default_anchor_id)) throw new Error(`Visual scheme ${metadata.id}/${styleId}/${schemeId} has an invalid default_anchor_id.`);
      }
      styleMap.set(styleMetadata.ref, { ...style, status: styleMetadata.status, catalog: clone(styleMetadata), architecture: architectureMap.get(metadata.id) });
    }
  }

  function getStyle(theme_ref, { enforceScope = true } = {}) {
    const parts = normalizeRef(theme_ref);
    if (!parts) throw new ThemeResolutionError('theme_ref.invalid', `Theme reference must be architecture/style: ${theme_ref ?? 'missing'}`);
    const style = styleMap.get(theme_ref);
    if (!style) {
      const architecture = architectureMap.get(parts[0]);
      if (architecture?.catalog?.status === 'planned') throw new ThemeResolutionError('theme.planned', `Theme architecture ${parts[0]} is planned and cannot be resolved.`, { theme_ref, status: 'planned', scope });
      throw new ThemeResolutionError('theme_ref.unknown', `Unknown theme style: ${theme_ref}`, { theme_ref });
    }
    if (enforceScope && !styleStatusAllowed(style.status, scope)) {
      const code = style.status === 'planned' ? 'theme.planned' : 'theme.inactive';
      throw new ThemeResolutionError(code, `Theme style ${theme_ref} is not available in ${scope} scope.`, { theme_ref, status: style.status, scope });
    }
    return style;
  }

  function resolveVisualPlan({ phase = 'prompt', theme_ref, slide }) {
    if (!['draft', 'approve', 'prompt'].includes(phase)) throw new Error(`Unsupported theme resolution phase: ${phase}`);
    assertSlide(slide, phase);
    const style = getStyle(theme_ref);
    const architecture = style.architecture;
    const requested = slide.visual_scheme_ref ?? 'auto';
    let schemeId = requested;
    if (requested === 'auto') {
      schemeId = style.role_defaults?.[slide.role];
      if (!present(schemeId)) throw new ThemeResolutionError('catalog.role_default.missing', `Theme ${theme_ref} has no default visual scheme for role ${slide.role}.`, { theme_ref, role: slide.role });
    }
    const schemeParts = normalizeSchemeRef(requested === 'auto' ? `${theme_ref}/${schemeId}` : requested);
    if (!schemeParts) {
      throw new ThemeResolutionError('visual_scheme_ref.invalid', `Visual scheme reference must belong to ${theme_ref}: ${requested}`, { theme_ref, visual_scheme_ref: requested, slide_id: slide.id });
    }
    if (schemeParts[0] !== theme_ref.split('/')[0] || schemeParts[1] !== theme_ref.split('/')[1]) {
      throw new ThemeResolutionError('visual_scheme.cross_theme', `Visual scheme ${requested} belongs to another theme style.`, { theme_ref, visual_scheme_ref: requested, slide_id: slide.id });
    }
    const visual_scheme_ref = schemeParts.join('/');
    const scheme = style.schemes[schemeParts[2]];
    if (!scheme) throw new ThemeResolutionError('visual_scheme.unknown', `Unknown visual scheme: ${visual_scheme_ref}`, { theme_ref, visual_scheme_ref });
    if (!Array.isArray(scheme.roles) || !scheme.roles.includes(slide.role)) {
      throw new ThemeResolutionError('visual_scheme.role_unsupported', `Visual scheme ${visual_scheme_ref} does not support role ${slide.role}.`, { theme_ref, visual_scheme_ref, role: slide.role, slide_id: slide.id });
    }
    const anchorIds = new Set((style.anchors ?? []).map((anchor) => typeof anchor === 'string' ? anchor : anchor.id));
    const anchor = slide.visual_anchor_id ?? scheme.default_anchor_id ?? style.default_anchor_id;
    if (!present(anchor) || !anchorIds.has(anchor)) {
      throw new ThemeResolutionError('visual_anchor.invalid', `Visual anchor ${anchor ?? 'missing'} is not defined by ${theme_ref}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
    }
    const layout = validateLayoutPlan({ theme_ref, visual_scheme_ref, slide, scheme });
    if (phase === 'prompt' && requested === 'auto') {
      throw new ThemeResolutionError('visual_scheme.auto_unresolved', `Prompt compilation requires a resolved visual scheme for slide ${slide.id ?? 'unknown'}.`, { theme_ref, visual_scheme_ref, slide_id: slide.id });
    }
    const themeRecipe = themeRecipeHashInput(architecture, style, theme_ref);
    const schemeRecipe = visualSchemeHashInput(scheme, visual_scheme_ref);
    return {
      theme_ref,
      architecture_ref: architecture.id,
      visual_scheme_ref,
      requested_visual_scheme_ref: requested,
      architecture: clone(architecture),
      style: clone(style),
      visual_scheme: clone(scheme),
      theme: clone(style),
      title_treatment: clone(scheme.title_treatment ?? null),
      layout_plan: clone(layout),
      visual_anchor_id: anchor,
      prompt_fragments: promptFragments(architecture, style, scheme, layout, slide, theme_ref, visual_scheme_ref),
      safety: clone(promptFragments(architecture, style, scheme, layout, slide, theme_ref, visual_scheme_ref).safety),
      theme_recipe_hash_input: themeRecipe,
      visual_scheme_hash_input: schemeRecipe,
      theme_recipe_sha256: sha256(themeRecipe),
      visual_scheme_sha256: sha256(schemeRecipe),
      diagnostics: [],
    };
  }

  function tryResolveVisualPlan(args) {
    try {
      return { ok: true, plan: resolveVisualPlan(args), diagnostics: [] };
    } catch (error) {
      return { ok: false, plan: null, diagnostics: clone(error.diagnostics ?? [{ severity: 'blocking', code: 'theme.resolve.failed', message: error.message }]) };
    }
  }

  function list({ includeAll = false } = {}) {
    return [...styleMap.values()]
      .filter((style) => includeAll || styleStatusAllowed(style.status, 'active'))
      .map((style) => ({
        ref: `${style.architecture_id}/${style.id}`,
        architecture_id: style.architecture_id,
        id: style.id,
        label: style.catalog?.label ?? style.id,
        summary: style.catalog?.summary ?? style.art_direction,
        status: style.status,
        tags: clone(style.catalog?.tags ?? []),
        preview: clone(style.catalog?.preview ?? {}),
      }));
  }

  function listArchitectures({ includeAll = false } = {}) {
    return [...architectureMap.values()]
      .filter((architecture) => includeAll || architecture.catalog?.status === 'active')
      .map((architecture) => ({ ...clone(architecture.catalog), architecture_id: architecture.id }));
  }

  return Object.freeze({
    root,
    scope,
    catalog: clone(catalog),
    architectures: architectureMap,
    styles: styleMap,
    getStyle,
    getTheme: getStyle,
    list,
    listArchitectures,
    resolveVisualPlan,
    tryResolveVisualPlan,
    themeRecipeHashInput,
    visualSchemeHashInput,
  });
}

export function isThemeCatalog(value) {
  return Boolean(value && typeof value.resolveVisualPlan === 'function' && value.styles instanceof Map);
}

export function legacyThemePlan(theme, slide) {
  if (!theme?.id) throw new Error('An image theme recipe is required.');
  return {
    theme_ref: theme.id,
    visual_scheme_ref: slide.visual_scheme_ref ?? `${theme.id}/legacy`,
    architecture_ref: null,
    architecture: { id: theme.id, spatial_grammar: '', reading_order: '', density_strategy: '', deck_rhythm: '' },
    style: clone(theme),
    theme: clone(theme),
    visual_scheme: {
      id: 'legacy',
      composition: theme.composition,
      imagery: theme.imagery,
      title_treatment: { mode: 'hero', scale: 'medium-to-large', placement: 'left' },
      requirements: [],
      avoid: theme.avoid ?? [],
      layout_constraints: {},
    },
    title_treatment: { mode: 'hero', scale: 'medium-to-large', placement: 'left' },
    layout_plan: clone(slide.layout_plan ?? {}),
    visual_anchor_id: slide.visual_anchor_id ?? `${theme.id}-anchor`,
    prompt_fragments: {
      architecture: {},
      style: { art_direction: theme.art_direction, palette: theme.palette, typography: theme.typography, materials: theme.materials, anchors: theme.anchors ?? [], text_layout: theme.text_layout, contrast: theme.contrast },
      visual_scheme: { composition: theme.composition, imagery: theme.imagery, requirements: [], avoid: theme.avoid ?? [], title_treatment: { mode: 'hero', scale: 'medium-to-large', placement: 'left' } },
      layout: clone(slide.layout_plan ?? {}),
      safety: { exact_text_only: true, no_extra_words: true, no_invented_metrics_or_citations: true, no_unprovided_ui_brand_or_identity: true, text_safe_zone: slide.layout_plan?.text_safe_zone, metadata_excluded: true },
      refs: { theme_ref: theme.id, visual_scheme_ref: slide.visual_scheme_ref ?? `${theme.id}/legacy` },
      slide_brief: slide.visual_brief,
    },
    theme_recipe_sha256: sha256(theme),
    visual_scheme_sha256: sha256({ id: 'legacy', theme: theme.id }),
  };
}
