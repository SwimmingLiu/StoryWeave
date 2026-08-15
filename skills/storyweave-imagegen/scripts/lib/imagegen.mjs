import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { isThemeCatalog, legacyThemePlan, sha256 } from './themes.mjs';

export const IMAGEGEN_MODE = 'imagegen';
export const DEFAULT_SIZE = '2048x1152';
export const DEFAULT_QUALITY = 'medium';
export const DEFAULT_MODEL = 'imagegen';
export const DEFAULT_RETRY_LIMIT = 2;

const ROLES = new Set(['cover', 'section', 'statement', 'image-hero', 'two-column', 'comparison', 'process', 'data', 'quote', 'closing']);

function escapePrompt(value) {
  return String(value ?? '').replaceAll('\n', ' ').trim();
}

function promptLines(label, values) {
  return `${label}:\n${values.map((value, index) => `${index + 1}. "${escapePrompt(value)}"`).join('\n')}`;
}

function parseSize(value) {
  const match = String(value ?? '').match(/^(\d+)x(\d+)$/i);
  if (!match) throw new Error(`Invalid image size: ${value}. Use WIDTHxHEIGHT.`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0 || width > 3840 || height > 3840) throw new Error(`Unsupported image size: ${value}.`);
  return { width, height, value: `${width}x${height}` };
}

function exactText(slide) {
  return (slide.exact_text ?? []).map((line) => String(line ?? '').trim()).filter(Boolean);
}

function safeVisualBrief(slide) {
  const copy = new Set(exactText(slide));
  const brief = escapePrompt(slide.visual_brief ?? slide.media_brief ?? '');
  if (brief && ![...copy].some((line) => brief.includes(line))) return brief;
  return 'A restrained visual metaphor that supports the slide claim without adding factual detail';
}

function isResolvedPlan(value) {
  return Boolean(value?.visual_scheme_ref && value?.prompt_fragments && value?.style && value?.visual_scheme);
}

function resolvePlanForPrompt(slide, themeOrPlan, options = {}) {
  if (isResolvedPlan(themeOrPlan)) return themeOrPlan;
  if (isThemeCatalog(themeOrPlan)) {
    const themeRef = options.theme_ref ?? options.themeRef;
    if (!themeRef) throw new Error('A full theme_ref is required when compiling with a theme catalog.');
    return themeOrPlan.resolveVisualPlan({ phase: 'prompt', theme_ref: themeRef, slide });
  }
  return legacyThemePlan(themeOrPlan, slide);
}

function layoutText(value) {
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '').trim();
}

export function compileSlidePrompt(slide, themeOrPlan, options = {}) {
  const plan = resolvePlanForPrompt(slide, themeOrPlan, options);
  const theme = plan.style ?? plan.theme ?? themeOrPlan;
  const scheme = plan.visual_scheme ?? {};
  if (!theme?.id && !plan.theme_ref) throw new Error('An image theme recipe is required.');
  const copy = exactText(slide);
  if (!copy.length) throw new Error(`Slide ${slide.id ?? 'unknown'} has no exact visible text.`);
  const role = ROLES.has(slide.role) ? slide.role : 'statement';
  const audience = escapePrompt(options.audience || 'professional Chinese-speaking audience');
  const fragments = plan.prompt_fragments ?? {};
  const architecture = fragments.architecture ?? {};
  const style = fragments.style ?? {};
  const visual = fragments.visual_scheme ?? {};
  const titleTreatment = visual.title_treatment ?? plan.title_treatment ?? {};
  const layoutPlan = slide.layout_plan ?? {};
  const prompt = [
    'Use case: productivity-visual',
    'Asset type: complete rasterized presentation slide, not a background asset and not a collage.',
    `Primary request: create one polished 16:9 presentation slide for the ${role} page.`,
    `Communication purpose: ${escapePrompt(slide.purpose)}`,
    `Single claim: ${escapePrompt(slide.claim)}`,
    `Audience: ${audience}`,
    `Theme architecture: ${escapePrompt(plan.architecture_ref || plan.theme_ref)}; spatial grammar = ${escapePrompt(architecture.spatial_grammar || 'organize one clear spatial relationship')}; reading order = ${escapePrompt(architecture.reading_order || 'follow the primary visual relationship')}; density strategy = ${escapePrompt(architecture.density_strategy || 'keep secondary detail sparse')}; deck rhythm = ${escapePrompt(architecture.deck_rhythm || 'alternate focused and quiet pages')}.`,
    `Theme style: ${escapePrompt(plan.theme_ref)}; art direction = ${escapePrompt(style.art_direction || theme.art_direction)}; palette = ${escapePrompt(style.palette || theme.palette)}; typography = ${escapePrompt(style.typography || theme.typography)}; materials = ${escapePrompt(style.materials || theme.materials)}; text layout = ${escapePrompt(style.text_layout || theme.text_layout)}.`,
    `Visual scheme: ${escapePrompt(plan.visual_scheme_ref)}; composition = ${escapePrompt(visual.composition || scheme.composition || theme.composition)}; imagery = ${escapePrompt(visual.imagery || scheme.imagery || theme.imagery)}; requirements = ${escapePrompt((visual.requirements ?? scheme.requirements ?? []).join('; '))}.`,
    `Title treatment: ${escapePrompt(JSON.stringify(titleTreatment))}; a page may use a medium conclusion, statement, caption or integrated text instead of an oversized title.`,
    `Frozen layout plan: text safe zone = ${escapePrompt(layoutText(layoutPlan.text_safe_zone || 'left'))}; visual zone = ${escapePrompt(layoutText(layoutPlan.visual_zone || ['right'] ))}; hierarchy = ${escapePrompt(layoutText(layoutPlan.hierarchy || ['headline', 'visual anchor']))}; density = ${escapePrompt(layoutPlan.density || 'low')}.`,
    `Scene and visual brief: ${safeVisualBrief(slide)}`,
    promptLines('Text (verbatim; render every line exactly once, with correct Chinese characters and punctuation)', copy),
    `Evidence constraints (do not turn evidence into extra visible labels unless it is also in exact_text): ${escapePrompt(JSON.stringify(slide.evidence ?? []))}`,
    'Typography: use the specified Chinese type pairing and a readable hierarchy; keep line breaks intentional; do not force every page into a giant headline and do not shrink text to fit.',
    `Text safety: ${escapePrompt(style.contrast || theme.contrast || 'keep copy on a quiet, high-contrast field')}; no face, object, highlight, grid, or light path may pass behind the letters.`,
    'Information boundary: use only the supplied visible text; do not invent metrics, labels, citations, UI, logos, product screens, names, dates, or claims.',
    'Constraints: render the complete slide as one finished image; preserve a clear visual hierarchy; keep generous margins; use one dominant visual anchor; no editable UI; no watermark; no logo.',
    `Avoid: ${[...(visual.avoid ?? scheme.avoid ?? []), ...(theme.avoid ?? []), 'extra words', 'misspelled Chinese', 'gibberish', 'tiny labels', 'dense card grids', 'busy detail behind text', 'decorative pseudo-data'].join('; ')}.`,
    `Continuity anchor: ${escapePrompt(plan.visual_anchor_id ?? slide.visual_anchor_id ?? `${theme.id}-anchor`)}; continuity group: ${escapePrompt(slide.continuity_group ?? `${theme.id}-deck`)}.`,
  ].join('\n');
  return prompt;
}

function deckHashInput(deck) {
  const copy = structuredClone(deck);
  delete copy.approved_at;
  return copy;
}

export function compileImageJobs(deck, themeOrCatalog, options = {}) {
  if (deck?.status !== 'approved') throw new Error('Content draft must be approved before image generation.');
  if (deck.mode !== IMAGEGEN_MODE) throw new Error('Image jobs require the storyweave-imagegen mode.');
  const size = parseSize(options.size ?? DEFAULT_SIZE);
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (!['low', 'medium', 'high', 'auto'].includes(quality)) throw new Error(`Unsupported image quality: ${quality}`);
  const model = options.model ?? DEFAULT_MODEL;
  return (deck.slides ?? []).map((slide, index) => {
    const plan = isThemeCatalog(themeOrCatalog)
      ? themeOrCatalog.resolveVisualPlan({ phase: 'prompt', theme_ref: deck.theme_ref, slide })
      : legacyThemePlan(themeOrCatalog, slide);
    const prompt = compileSlidePrompt(slide, plan, { ...options, audience: deck.audience });
    return {
      id: slide.id,
      index: index + 1,
      role: slide.role,
      theme: plan.theme_ref,
      theme_ref: plan.theme_ref,
      visual_scheme_ref: plan.visual_scheme_ref,
      theme_recipe_sha256: plan.theme_recipe_sha256,
      visual_scheme_sha256: plan.visual_scheme_sha256,
      mode: IMAGEGEN_MODE,
      asset_role: 'complete-slide',
      text_policy: 'exact-text-in-image',
      visible_text: exactText(slide),
      canvas: { width: size.width, height: size.height, aspect_ratio: '16:9' },
      composition: {
        text_safe_zone: plan.layout_plan?.text_safe_zone ?? 'theme-defined quiet field',
        visual_zone: plan.layout_plan?.visual_zone ?? ['right'],
        focal_anchor: plan.visual_anchor_id ?? slide.visual_anchor_id ?? `${plan.theme_ref}-anchor`,
        density: plan.layout_plan?.density ?? 'low-to-medium',
        contrast: plan.style?.contrast ?? 'controlled',
        title_treatment: plan.title_treatment ?? null,
      },
      prompt,
      model,
      size: size.value,
      quality,
      use_case: 'productivity-visual',
      retry_limit: options.retry_limit ?? DEFAULT_RETRY_LIMIT,
      out: `slides/${slide.id}.png`,
      prompt_sha256: createHash('sha256').update(prompt).digest('hex'),
    };
  });
}

export function createGenerationManifest(deck, jobs) {
  if (deck?.schema_version === 3) {
    return {
      schema_version: 3,
      title: deck.title,
      mode: IMAGEGEN_MODE,
      catalog_scope: deck.catalog_scope,
      theme_ref: deck.theme_ref,
      theme_recipe_sha256: jobs[0]?.theme_recipe_sha256 ?? null,
      deck_spec_sha256: sha256(deckHashInput(deck)),
      provider: 'imagegen',
      canvas: '16:9',
      slides: jobs.map((job) => ({
        id: job.id,
        index: job.index,
        role: job.role,
        visual_scheme_ref: job.visual_scheme_ref,
        visual_scheme_sha256: job.visual_scheme_sha256,
        prompt_sha256: job.prompt_sha256,
        model: job.model,
        size: job.size,
        quality: job.quality,
        output_path: job.out,
        status: 'prepared',
        attempts: 0,
        error: null,
        asset_role: 'complete-slide',
        text_policy: 'exact-text-in-image',
        visual_review: 'pending',
      })),
    };
  }
  return {
    schema_version: 1,
    title: deck.title,
    mode: IMAGEGEN_MODE,
    theme: deck.theme,
    provider: 'imagegen',
    canvas: '16:9',
    slides: jobs.map((job) => ({
      id: job.id,
      index: job.index,
      role: job.role,
      theme: job.theme,
      prompt_sha256: job.prompt_sha256,
      model: job.model,
      size: job.size,
      quality: job.quality,
      output_path: job.out,
      status: 'prepared',
      attempts: 0,
      error: null,
      asset_role: 'complete-slide',
      text_policy: 'exact-text-in-image',
      visual_review: 'pending',
    })),
  };
}

async function fileExists(path) {
  return access(path).then(() => true, () => false);
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    const sof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
    if (sof.includes(marker) && length >= 7) return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3), format: 'jpeg' };
    offset += length;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3), format: 'webp' };
  return null;
}

export function imageDimensions(bytes, path = '') {
  const ext = extname(path).toLowerCase();
  return (ext === '.png' && pngDimensions(bytes)) || (['.jpg', '.jpeg'].includes(ext) && jpegDimensions(bytes)) || (ext === '.webp' && webpDimensions(bytes)) || pngDimensions(bytes) || jpegDimensions(bytes) || webpDimensions(bytes);
}

export async function inspectGeneratedImage(path, expectedSize) {
  if (!(await fileExists(path))) return { valid: false, code: 'asset.missing', message: `Generated slide image is missing: ${path}` };
  const bytes = await readFile(path);
  const dimensions = imageDimensions(bytes, path);
  if (!dimensions) return { valid: false, code: 'asset.invalid', message: `Unsupported or damaged slide image: ${path}` };
  const [expectedWidth, expectedHeight] = String(expectedSize ?? DEFAULT_SIZE).split('x').map(Number);
  const ratio = dimensions.width / dimensions.height;
  const expectedRatio = expectedWidth / expectedHeight;
  if (Math.abs(ratio - expectedRatio) > 0.002) return { valid: false, code: 'asset.aspect_ratio', message: `${path} is ${dimensions.width}x${dimensions.height}; expected a 16:9 image.` };
  if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
    return { valid: true, warning: { code: 'asset.size.mismatch', message: `${path} is ${dimensions.width}x${dimensions.height}; expected ${expectedSize}.` }, dimensions };
  }
  return { valid: true, dimensions };
}

export async function refreshManifest(root, manifest) {
  for (const slide of manifest.slides ?? []) {
    const result = await inspectGeneratedImage(resolve(root, slide.output_path), slide.size);
    if (result.valid) {
      slide.status = slide.visual_review === 'pass' ? 'pass' : 'generated';
      slide.attempts = Math.max(1, slide.attempts ?? 0);
      slide.error = null;
      if (result.warning) slide.warning = result.warning.message;
    } else if (slide.status === 'generated' || slide.status === 'pass') {
      slide.status = 'prepared';
      slide.error = result.message;
    }
  }
  return manifest;
}

export function validateManifest(manifest, deck, themeCatalog = null) {
  const findings = [];
  if (!manifest || manifest.mode !== IMAGEGEN_MODE) findings.push({ severity: 'blocking', code: 'manifest.mode', message: 'Generation manifest is not an imagegen manifest.' });
  if (manifest?.slides?.length !== deck?.slides?.length) findings.push({ severity: 'blocking', code: 'manifest.page_count', message: 'Manifest page count does not match the approved storyboard.' });
  if (manifest?.schema_version === 3 || deck?.schema_version === 3) {
    if (manifest?.schema_version !== 3) findings.push({ severity: 'blocking', code: 'manifest.schema_version', message: 'A v3 deck requires a v3 generation manifest.' });
    if (manifest?.catalog_scope !== deck?.catalog_scope) findings.push({ severity: 'blocking', code: 'manifest.catalog_scope', message: 'Manifest catalog_scope does not match the approved storyboard.' });
    if (manifest?.theme_ref !== deck?.theme_ref) findings.push({ severity: 'blocking', code: 'manifest.theme_ref', message: 'Manifest theme_ref does not match the approved storyboard.' });
    if (!/^[a-f0-9]{64}$/.test(manifest?.theme_recipe_sha256 ?? '')) findings.push({ severity: 'blocking', code: 'manifest.theme_recipe_hash', message: 'Manifest theme_recipe_sha256 is missing or malformed.' });
    const expectedDeckHash = sha256(deckHashInput(deck));
    if (manifest?.deck_spec_sha256 !== expectedDeckHash) findings.push({ severity: 'blocking', code: 'manifest.deck_spec_hash', message: 'Manifest deck_spec_sha256 does not match the approved storyboard.' });
  }
  const deckSlides = new Map((deck?.slides ?? []).map((slide) => [slide.id, slide]));
  for (const slide of manifest?.slides ?? []) {
    if (slide.text_policy !== 'exact-text-in-image') findings.push({ severity: 'blocking', code: 'manifest.text_policy', slide_id: slide.id, message: 'Imagegen slides must render exact text inside the complete slide image.' });
    const source = deckSlides.get(slide.id);
    if (manifest?.schema_version === 3 && (!source || slide.visual_scheme_ref !== source.visual_scheme_ref || !/^[a-f0-9]{64}$/.test(slide.visual_scheme_sha256 ?? '') || !/^[a-f0-9]{64}$/.test(slide.prompt_sha256 ?? ''))) {
      findings.push({ severity: 'blocking', code: 'manifest.visual_recipe', slide_id: slide.id, message: 'Manifest visual scheme or prompt fingerprint does not match the approved storyboard.' });
    }
    if (manifest?.schema_version === 3 && themeCatalog && isThemeCatalog(themeCatalog) && source) {
      try {
        const plan = themeCatalog.resolveVisualPlan({ phase: 'prompt', theme_ref: deck.theme_ref, slide: source });
        if (manifest.theme_recipe_sha256 !== plan.theme_recipe_sha256 || slide.visual_scheme_sha256 !== plan.visual_scheme_sha256) {
          findings.push({ severity: 'blocking', code: 'manifest.recipe_stale', slide_id: slide.id, message: 'Manifest theme or visual scheme fingerprint is stale; recompile prompts before reusing the image.' });
        }
      } catch (error) {
        findings.push({ severity: 'blocking', code: error.code ?? 'manifest.recipe_invalid', slide_id: slide.id, message: error.message });
      }
    }
    if (slide.status !== 'pass') findings.push({ severity: 'blocking', code: 'asset.not_reviewed', slide_id: slide.id, message: 'Every generated slide must pass visual review before delivery.' });
  }
  return { valid: findings.every((item) => item.severity !== 'blocking'), findings };
}

export function createStoryweaveOutput(deck, manifest) {
  const firstSize = parseSize(manifest.slides?.[0]?.size ?? DEFAULT_SIZE);
  return {
    format: 'storyweave/slides', version: 1, producer: 'storyweave-imagegen', kind: 'image',
    title: deck.title, canvas: { width: firstSize.width, height: firstSize.height }, entry: 'index.html',
    slides: manifest.slides.map((slide, index) => ({
      id: slide.id, role: slide.role, source: slide.output_path,
      claim: deck.slides?.[index]?.claim ?? '',
      notes: deck.slides?.[index]?.speaker_notes ?? deck.slides?.[index]?.claim ?? '',
    })),
  };
}
