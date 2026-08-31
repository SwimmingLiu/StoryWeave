import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const legacyThemes = JSON.parse(readFileSync(new URL('../../assets/themes/themes.json', import.meta.url), 'utf8'));
const catalogData = JSON.parse(readFileSync(new URL('../../assets/themes/catalog.json', import.meta.url), 'utf8'));
export const THEME_CONTRACT = Object.freeze(JSON.parse(readFileSync(new URL('../../assets/themes/contract.json', import.meta.url), 'utf8')));

export const PAGE_ROLES = Object.freeze([...THEME_CONTRACT.page_roles]);
export const LAYOUT_ZONES = Object.freeze([...THEME_CONTRACT.layout_zones]);
export const LAYOUT_DENSITIES = Object.freeze([...THEME_CONTRACT.layout_densities]);
export const CATALOG_SCOPES = Object.freeze([...THEME_CONTRACT.catalog_scopes]);
export const THEME_STATUSES = Object.freeze([...THEME_CONTRACT.theme_statuses]);

const ROLE_SET = new Set(PAGE_ROLES);
const ZONE_SET = new Set(LAYOUT_ZONES);
const DENSITY_SET = new Set(LAYOUT_DENSITIES);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalize(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const THEMES = Object.freeze(Object.fromEntries(
  Object.entries(legacyThemes).map(([id, theme]) => [id, Object.freeze({
    ...theme,
    id,
    mode: 'html',
    kind: 'legacy',
    use: theme.use ?? theme.label,
    source_refs: theme.aliases ?? [],
  })]),
));

export class ThemeResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ThemeResolutionError';
    this.code = code;
    this.details = details;
    this.diagnostics = [{ severity: 'blocking', code, message, ...details }];
  }
}

function statusAllowed(status, scope) {
  if (status === 'planned') return false;
  return scope === 'active' ? status === 'active' : status === 'active' || status === 'candidate';
}

function normalizeThemeRef(ref) {
  return present(ref) && new RegExp(THEME_CONTRACT.theme_ref_pattern).test(ref) ? ref.split('/') : null;
}

function normalizeSchemeRef(ref) {
  return present(ref) && new RegExp(THEME_CONTRACT.visual_scheme_ref_pattern).test(ref) ? ref.split('/') : null;
}

function buildCatalog(data, scope) {
  if (data.schema_version !== 3 || data.contract_version !== THEME_CONTRACT.contract_version) throw new Error('HTML theme catalog and shared contract versions do not match.');
  if (!CATALOG_SCOPES.includes(scope)) throw new Error(`Unsupported theme catalog scope: ${scope}`);
  const architectures = new Map();
  const styles = new Map();
  const schemes = new Map(Object.entries(data.schemes ?? {}));
  for (const architecture of data.architectures ?? []) {
    if (!present(architecture.id) || !THEME_STATUSES.includes(architecture.status)) throw new Error('Invalid theme architecture entry.');
    architectures.set(architecture.id, clone(architecture));
    for (const style of architecture.styles ?? []) {
      const parts = normalizeThemeRef(style.ref);
      if (!parts || parts[0] !== architecture.id || !THEME_STATUSES.includes(style.status)) throw new Error(`Invalid theme style: ${style.ref ?? 'missing'}`);
      if (!style.tokens || !style.role_defaults || !style.render_recipe?.id || ['surface', 'layout', 'content_structure', 'image_policy', 'motion'].some((field) => !present(style.render_recipe[field]))) throw new Error(`Theme style ${style.ref} is missing tokens, role defaults, or render recipe.`);
      for (const role of PAGE_ROLES) {
        const scheme = schemes.get(style.role_defaults[role]);
        if (!scheme?.roles?.includes(role)) throw new Error(`Theme style ${style.ref} has no valid default scheme for ${role}.`);
      }
      styles.set(style.ref, { ...clone(style), architecture_id: architecture.id, architecture: clone(architecture) });
    }
  }

  function getStyle(theme_ref, { enforceScope = true } = {}) {
    const parts = normalizeThemeRef(theme_ref);
    if (!parts) throw new ThemeResolutionError('theme_ref.invalid', `Theme reference must use architecture/style: ${theme_ref ?? 'missing'}`);
    const style = styles.get(theme_ref);
    if (!style) throw new ThemeResolutionError('theme_ref.unknown', `Unknown HTML theme style: ${theme_ref}`, { theme_ref });
    if (enforceScope && !statusAllowed(style.status, scope)) {
      const code = style.status === 'planned' ? 'theme.planned' : 'theme.inactive';
      throw new ThemeResolutionError(code, `Theme style ${theme_ref} is not available in ${scope} scope.`, { theme_ref, status: style.status, scope });
    }
    return clone(style);
  }

  function resolveVisualPlan({ phase = 'approve', theme_ref, slide }) {
    if (!slide || !ROLE_SET.has(slide.role)) throw new ThemeResolutionError('visual_scheme.role_unsupported', `Unsupported page role: ${slide?.role ?? 'missing'}`);
    const style = getStyle(theme_ref);
    const requested = slide.visual_scheme_ref ?? 'auto';
    const schemeId = requested === 'auto' ? style.role_defaults[slide.role] : normalizeSchemeRef(requested)?.[2];
    if (!schemeId) throw new ThemeResolutionError('visual_scheme_ref.invalid', `Invalid visual scheme reference: ${requested}`);
    if (requested !== 'auto') {
      const parts = normalizeSchemeRef(requested);
      if (`${parts[0]}/${parts[1]}` !== theme_ref) throw new ThemeResolutionError('visual_scheme.cross_theme', `Visual scheme ${requested} belongs to another theme.`, { theme_ref, visual_scheme_ref: requested });
    }
    const scheme = schemes.get(schemeId);
    const visual_scheme_ref = `${theme_ref}/${schemeId}`;
    if (!scheme) throw new ThemeResolutionError('visual_scheme.unknown', `Unknown visual scheme: ${visual_scheme_ref}`);
    if (!scheme.roles.includes(slide.role)) throw new ThemeResolutionError('visual_scheme.role_unsupported', `Visual scheme ${visual_scheme_ref} does not support ${slide.role}.`);

    const layout = clone(slide.layout_plan ?? scheme.layout_defaults);
    if (!ZONE_SET.has(layout?.text_safe_zone) || !Array.isArray(layout?.visual_zone) || layout.visual_zone.some((zone) => !ZONE_SET.has(zone))) throw new ThemeResolutionError('layout.zone.invalid', `Slide ${slide.id ?? 'unknown'} contains an invalid layout zone.`);
    if (layout.visual_zone.includes(layout.text_safe_zone)) throw new ThemeResolutionError('layout.zone_overlap', `Slide ${slide.id ?? 'unknown'} uses the same text and visual zone.`);
    if (!DENSITY_SET.has(layout.density)) throw new ThemeResolutionError('layout.density.invalid', `Slide ${slide.id ?? 'unknown'} contains an invalid density.`);
    const constraints = scheme.layout_constraints;
    if (!constraints.text_safe_zones.includes(layout.text_safe_zone) || layout.visual_zone.some((zone) => !constraints.visual_zones.includes(zone)) || !constraints.densities.includes(layout.density)) throw new ThemeResolutionError('layout.constraint_mismatch', `Slide ${slide.id ?? 'unknown'} layout is incompatible with ${visual_scheme_ref}.`);
    if (!Array.isArray(layout.hierarchy) || layout.hierarchy.length === 0) throw new ThemeResolutionError('layout.hierarchy.invalid', `Slide ${slide.id ?? 'unknown'} needs a hierarchy.`);
    if (phase === 'build' && requested === 'auto') throw new ThemeResolutionError('visual_scheme.auto_unresolved', `Approved slide ${slide.id ?? 'unknown'} still uses auto.`);

    const architecture = architectures.get(style.architecture_id);
    const render_recipe_ref = `${theme_ref}/render-${style.render_recipe.id}-${schemeId}`;
    const render_recipe = {
      ...clone(style.render_recipe),
      ref: render_recipe_ref,
      theme_ref,
      role: slide.role,
      scheme_id: schemeId,
      visual_scheme_ref,
    };
    const motion_recipe_ref = `${theme_ref}/motion-${style.render_recipe.motion}`;
    const themeRecipe = {
      contract_version: THEME_CONTRACT.contract_version,
      theme_ref,
      architecture: { id: architecture.id, spatial_grammar: architecture.spatial_grammar },
      style: { ref: style.ref, tokens: style.tokens, role_defaults: style.role_defaults, render_recipe: style.render_recipe },
    };
    const schemeRecipe = { contract_version: THEME_CONTRACT.contract_version, visual_scheme_ref, ...scheme };
    return {
      theme_ref,
      architecture_ref: architecture.id,
      visual_scheme_ref,
      requested_visual_scheme_ref: requested,
      style: clone(style),
      architecture: clone(architecture),
      visual_scheme: clone(scheme),
      render_recipe_ref,
      render_recipe,
      motion_recipe_ref,
      layout_plan: layout,
      theme_recipe: themeRecipe,
      theme_recipe_sha256: sha256(themeRecipe),
      visual_scheme_sha256: sha256(schemeRecipe),
      render_recipe_sha256: sha256({ contract_version: THEME_CONTRACT.contract_version, ...render_recipe }),
      diagnostics: [],
    };
  }

  function list({ includeAll = false } = {}) {
    return [...styles.values()].filter((style) => includeAll || statusAllowed(style.status, scope)).map((style) => ({ ref: style.ref, label: style.label, status: style.status, architecture_id: style.architecture_id }));
  }

  return Object.freeze({ scope, contract_version: data.contract_version, catalog: clone(data), architectures, styles, schemes, getStyle, list, resolveVisualPlan });
}

export async function openThemeCatalog(_themeRoot, { scope = 'active' } = {}) {
  return buildCatalog(catalogData, scope);
}

export function isThemeCatalog(value) {
  return Boolean(value && value.styles instanceof Map && typeof value.resolveVisualPlan === 'function');
}

function legacyByIdOrAlias(id) {
  if (THEMES[id]) return THEMES[id];
  return Object.values(THEMES).find((theme) => theme.aliases?.includes(id)) ?? null;
}

export function resolveTheme(id, { scope = 'active', catalog } = {}) {
  const selectedCatalog = catalog ?? buildCatalog(catalogData, scope);
  if (normalizeThemeRef(id)) {
    try {
      const style = selectedCatalog.getStyle(id);
      return { kind: 'canonical', migration_status: 'canonical', id, theme_ref: id, architecture_id: style.architecture_id, label: style.label, tokens: clone(style.tokens), style, contract_version: selectedCatalog.contract_version };
    } catch (error) {
      return { kind: 'unknown', migration_status: 'unknown', id, error };
    }
  }
  const legacy = legacyByIdOrAlias(id);
  if (!legacy) return { kind: 'unknown', migration_status: 'unknown', id, error: new ThemeResolutionError('theme_ref.unknown', `Unknown HTML theme: ${id ?? 'missing'}`) };
  const migration = catalogData.legacy_migrations[legacy.id] ?? { status: 'needs-selection', suggestions: [] };
  return {
    ...clone(legacy),
    kind: migration.status === 'deterministic' ? 'legacy-compatible' : 'needs-selection',
    migration_status: migration.status,
    legacy_theme_id: legacy.id,
    suggested_theme_ref: migration.theme_ref ?? null,
    suggestions: clone(migration.suggestions ?? (migration.theme_ref ? [migration.theme_ref] : [])),
    contract_version: selectedCatalog.contract_version,
  };
}

export function requireTheme(id, options = {}) {
  const result = resolveTheme(id, options);
  if (result.kind === 'unknown') throw result.error;
  return result;
}

export function themeCss() {
  return Object.values(THEMES).map((theme) => {
    const t = theme.tokens;
    return `.deck[data-theme="${theme.id}"] {\n` +
      `  --slide-bg: ${t.background}; --surface: ${t.surface}; --text: ${t.text};\n` +
      `  --muted: ${t.muted}; --accent: ${t.accent}; --support: ${t.support};\n` +
      `  --line: ${t.line}; --radius: ${t.radius}; --heading: ${t.heading}; --body: ${t.body};\n` +
      `}`;
  }).join('\n');
}
