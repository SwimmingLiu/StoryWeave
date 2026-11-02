import { access, copyFile, mkdir, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { assertApprovedContent, visibleText } from '../core/content.mjs';
import { writeJsonAtomic } from '../core/storage.mjs';
import { defaultLayoutForRole } from './outline.mjs';
import { compileImageJob, createGenerationManifest, IMAGEGEN_MODE, inspectGeneratedImage } from './imagegen.mjs';
import { sha256 } from './themes.mjs';
import { createVisualIntent, VISUAL_POLICY } from '../core/visual-policy.mjs';

const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = (path) => access(path).then(() => true, () => false);
const planInput = (plan) => { const copy = structuredClone(plan); delete copy.plan_sha256; delete copy.created_at; return copy; };

function compactRecipe(plan) {
  // Dropping anchors silently replaced a non-first selection with the first prompt fragment in v4 jobs.
  const style = Object.fromEntries(['id', 'art_direction', 'palette', 'typography', 'materials', 'text_layout', 'contrast', 'avoid', 'anchors'].filter((name) => plan.style[name] !== undefined).map((name) => [name, plan.style[name]]));
  return { theme_ref: plan.theme_ref, visual_scheme_ref: plan.visual_scheme_ref, architecture_ref: plan.architecture_ref, style, visual_scheme: plan.visual_scheme, title_treatment: plan.title_treatment, layout_plan: plan.layout_plan, visual_anchor_id: plan.visual_anchor_id, prompt_fragments: plan.prompt_fragments, theme_recipe_sha256: plan.theme_recipe_sha256, visual_scheme_sha256: plan.visual_scheme_sha256 };
}

export function planImagegen(content, catalog, { theme_ref, references = [] } = {}) {
  assertApprovedContent(content);
  const style = catalog.getStyle(theme_ref);
  const slides = content.slides.map((slide) => {
    const input = { ...slide, exact_text: visibleText(slide), visual_scheme_ref: 'auto', visual_brief: `Express the authored ${slide.content.type} relationships without adding facts.`, visual_anchor_id: style.default_anchor_id, continuity_group: 'approved-content', layout_plan: defaultLayoutForRole(slide.role) };
    const resolved = catalog.resolveVisualPlan({ phase: 'approve', theme_ref, slide: input });
    // Freeze the approved meaning alongside the recipe so a theme cannot silently become the page's subject.
    return { id: slide.id, role: slide.role, visual_intent: createVisualIntent(slide), visual_scheme_ref: resolved.visual_scheme_ref, recipe: compactRecipe(resolved), references: references.filter((reference) => !reference.slide_id || reference.slide_id === slide.id) };
  });
  const plan = { schema_version: 1, producer: 'storyweave-imagegen', contentRevision: content.revision, visual_policy: structuredClone(VISUAL_POLICY), theme_ref, catalog_scope: catalog.scope, references: structuredClone(references), slides };
  return { ...plan, plan_sha256: sha256(planInput(plan)) };
}

export function assertImagePlan(content, plan, catalog = null) {
  assertApprovedContent(content);
  if (plan?.schema_version !== 1 || plan.producer !== 'storyweave-imagegen' || plan.contentRevision !== content.revision) throw new Error('Image plan does not match the approved content revision. Replan it.');
  if (!Array.isArray(plan.slides) || !Array.isArray(plan.references)) throw new Error('Image plan requires ordered slides and reference selections.');
  if (plan.plan_sha256 !== sha256(planInput(plan))) throw new Error('Image plan fingerprint is stale. Replan it.');
  // Prompt-policy changes invalidate old tasks even when their original recipe and approved copy are unchanged.
  if (sha256(plan.visual_policy ?? null) !== sha256(VISUAL_POLICY)) throw new Error('Visual generation policy changed. Replan it.');
  if (JSON.stringify(plan.slides.map((slide) => slide.id)) !== JSON.stringify(content.slides.map((slide) => slide.id))) throw new Error('Image plan page sequence does not match approved content.');
  for (const [index, slide] of content.slides.entries()) if (sha256(plan.slides[index].visual_intent ?? null) !== sha256(createVisualIntent(slide))) throw new Error(`Visual intent is stale for ${slide.id}. Replan it.`);
  if (catalog) {
    for (const [index, slide] of content.slides.entries()) {
      const stored = plan.slides[index];
      const fresh = catalog.resolveVisualPlan({ phase: 'prompt', theme_ref: plan.theme_ref, slide: { ...slide, exact_text: visibleText(slide), visual_brief: `Express the authored ${slide.content.type} relationships without adding facts.`, visual_scheme_ref: stored.visual_scheme_ref, layout_plan: stored.recipe.layout_plan, visual_anchor_id: stored.recipe.visual_anchor_id, continuity_group: 'approved-content' } });
      if (fresh.theme_recipe_sha256 !== stored.recipe.theme_recipe_sha256 || fresh.visual_scheme_sha256 !== stored.recipe.visual_scheme_sha256) throw new Error(`Image recipe is stale for ${slide.id}. Replan it.`);
    }
  }
  return plan;
}

export function compilePlannedImageJobs(content, plan, options = {}) {
  assertImagePlan(content, plan);
  return content.slides.map((slide, index) => {
    const visual = plan.slides[index];
    const projected = { ...slide, exact_text: visibleText(slide), layout_plan: visual.recipe.layout_plan, visual_anchor_id: visual.recipe.visual_anchor_id, continuity_group: 'approved-content', visual_brief: `Use this authored relationship model: ${JSON.stringify(slide.content)}. Reference images supply design methods, never additional facts or text.` };
    const job = compileImageJob(projected, visual.recipe, index, { ...options, audience: content.audience });
    const references = structuredClone(visual.references);
    const files = [...new Set(references.map((reference) => options.projectRoot ? resolve(options.projectRoot, reference.path) : reference.path))];
    const prompt = `${job.prompt}\nApproved information structure: ${JSON.stringify(slide.content)}. Use its relationships for composition; render only the verbatim text list, never JSON keys, node IDs or metadata.\nReference purposes: ${references.map((reference) => `${reference.case_id}/${reference.page_id}: ${reference.purpose}`).join('; ') || 'none'}. Use only approved project text and facts.`;
    const prompt_sha256 = hashBytes(prompt);
    const task_sha256 = sha256({ prompt_sha256, model: job.model, size: job.size, quality: job.quality, references });
    return { ...job, prompt, prompt_sha256, task_sha256, contentRevision: content.revision, plan_sha256: plan.plan_sha256, reference_images: references, tool_input: { referenced_image_paths: files } };
  });
}

export function createPlannedGenerationManifest(content, plan, jobs) {
  const proxy = { ...content, schema_version: 3, mode: IMAGEGEN_MODE, theme_ref: plan.theme_ref, catalog_scope: plan.catalog_scope };
  const manifest = createGenerationManifest(proxy, jobs);
  return { ...manifest, schema_version: 4, contentRevision: content.revision, plan_sha256: plan.plan_sha256, slides: manifest.slides.map((slide, index) => ({ ...slide, task_sha256: jobs[index].task_sha256, reference_selection: structuredClone(jobs[index].reference_images), reference_delivery: { status: 'not-recorded', evidence_status: 'missing', attached: [] } })) };
}

export function validatePlannedManifest(manifest, content, plan) {
  const findings = [];
  const add = (code, message, slide_id, severity = 'blocking') => findings.push({ severity, code, ...(slide_id ? { slide_id } : {}), message });
  try { assertImagePlan(content, plan); } catch (error) { add('plan.invalid', error.message); return { valid: false, findings }; }
  if (!Array.isArray(manifest?.slides)) { add('manifest.slides', 'Generation manifest requires an ordered slide array.'); return { valid: false, findings }; }
  if (manifest?.schema_version !== 4 || manifest.mode !== IMAGEGEN_MODE || manifest.contentRevision !== content.revision || manifest.plan_sha256 !== plan.plan_sha256) add('manifest.plan', 'Generation manifest does not match approved content and the current image plan.');
  if (JSON.stringify(manifest?.slides?.map((slide) => slide.id)) !== JSON.stringify(content.slides.map((slide) => slide.id))) add('manifest.page_count', 'Generation manifest must retain the approved page order.');
  for (const [index, slide] of (manifest?.slides ?? []).entries()) {
    const planned = plan.slides[index];
    if (!planned || slide.visual_scheme_ref !== planned.visual_scheme_ref || slide.text_policy !== 'exact-text-in-image') add('manifest.recipe', 'Image task does not match the frozen visual recipe.', slide.id);
    if (planned) {
      const job = compilePlannedImageJobs(content, plan, { model: slide.model, size: slide.size, quality: slide.quality })[index];
      if (slide.task_sha256 !== job.task_sha256 || slide.prompt_sha256 !== job.prompt_sha256 || sha256(slide.reference_selection ?? null) !== sha256(planned.references)) add('manifest.task', 'Image task inputs changed; prepare jobs before reusing its result.', slide.id);
    }
    if (slide.status !== 'pass' || slide.visual_review !== 'pass') add('asset.not_reviewed', 'Every image must pass explicit visual review before delivery.', slide.id);
    if (!/^[a-f0-9]{64}$/u.test(slide.review_sha256 ?? '')) add('asset.review_hash', 'Review must identify the actual image bytes.', slide.id);
    if (slide.reference_delivery?.output_sha256 && slide.reference_delivery.output_sha256 !== slide.current_image_sha256) add('reference.output_mismatch', 'The current image is not the output identified by the tool-call receipt.', slide.id);
    if (planned?.references.length && slide.reference_delivery?.evidence_status !== 'recorded') add('reference.evidence_missing', 'Selected image references need an actual tool-call receipt.', slide.id);
    if (planned?.references.length && ['prompt-only', 'unsupported'].includes(slide.reference_delivery?.status)) add('reference.not_attached', `References were ${slide.reference_delivery.status}; they are not recorded as attached images.`, slide.id, 'warning');
  }
  return { valid: findings.every((item) => item.severity !== 'blocking'), findings };
}

function containedPath(projectRoot, path) {
  const resolved = resolve(projectRoot, path);
  const delta = relative(resolve(projectRoot), resolved);
  if (delta === '..' || delta.startsWith('../') || isAbsolute(delta)) throw new Error(`Project reference escapes the project: ${path}.`);
  return resolved;
}

export async function verifyPlanReferences(projectRoot, plan) {
  const base = await realpath(projectRoot);
  for (const reference of plan.references) {
    const path = await realpath(containedPath(projectRoot, reference.path));
    const delta = relative(base, path);
    if (delta === '..' || delta.startsWith('../') || isAbsolute(delta) || hashBytes(await readFile(path)) !== reference.sha256) throw new Error(`Selected reference changed: ${reference.case_id}/${reference.page_id}. Replan it.`);
  }
}

function imageInputPaths(record) {
  const values = record?.arguments?.referenced_image_paths ?? record?.input?.referenced_image_paths ?? record?.input_images;
  if (!Array.isArray(values)) throw new Error('Tool-call record must contain the actual input image path list.');
  return values.map((value) => typeof value === 'string' ? value : value.path);
}

function assertPublicEvidence(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, field] of Object.entries(value)) {
    if (/^(authorization|api[_-]?key|password|secret|access_token|refresh_token|OPENAI_SUB_.*KEY)$/iu.test(key)) throw new Error('Tool-call evidence must omit credentials before collection.');
    assertPublicEvidence(field);
  }
}

export async function collectImageResult(projectRoot, content, plan, manifest, receipt, { receiptRoot = projectRoot } = {}) {
  assertImagePlan(content, plan);
  await verifyPlanReferences(projectRoot, plan);
  const index = manifest.slides.findIndex((slide) => slide.id === receipt?.slide_id);
  if (index < 0) throw new Error(`Unknown image result slide: ${receipt?.slide_id ?? 'missing'}.`);
  if (!['image_gen', 'imagegen-cli'].includes(receipt.tool)) throw new Error('Result tool must be image_gen or imagegen-cli.');
  if (!['attached', 'prompt-only', 'unsupported'].includes(receipt.reference_mode)) throw new Error('Choose attached, prompt-only or unsupported for reference_mode.');
  if (typeof receipt.tool_call?.log_path !== 'string') throw new Error('Result needs the actual tool-call log path.');
  const logPath = resolve(receiptRoot, receipt.tool_call.log_path);
  const logBytes = await readFile(logPath);
  const call = JSON.parse(logBytes.toString('utf8'));
  assertPublicEvidence(call);
  if (call.tool !== receipt.tool) throw new Error('Tool-call log does not identify the receipt tool.');
  const inputPaths = imageInputPaths(call).map((path) => resolve(receiptRoot, path));
  const requested = plan.slides[index].references;
  const expectedPaths = [...new Set(requested.map((reference) => resolve(projectRoot, reference.path)))];
  if (receipt.reference_mode === 'attached') {
    if (!expectedPaths.length || JSON.stringify([...new Set(inputPaths)].sort()) !== JSON.stringify(expectedPaths.sort())) throw new Error('Actual attached image paths must match the selected references.');
  } else if (inputPaths.length) throw new Error('Prompt-only or unsupported records cannot declare attached images.');
  const attached = [];
  for (const path of inputPaths) {
    const bytes = await readFile(path);
    const sha256 = hashBytes(bytes);
    const selected = requested.find((reference) => resolve(projectRoot, reference.path) === path && reference.sha256 === sha256);
    if (!selected) throw new Error('An actual input image differs from the selected reference bytes.');
    attached.push({ path: selected.path, sha256 });
  }
  const source = resolve(receiptRoot, receipt.output_path ?? '');
  if (!receipt.output_path || !(await exists(source))) throw new Error('Result output_path must name the returned image file.');
  const image = await inspectGeneratedImage(source, manifest.slides[index].size);
  if (!image.valid) throw new Error(image.message);
  const outputHash = hashBytes(await readFile(source));
  const logOutput = call.output_path ?? call.result?.path;
  if (typeof logOutput !== 'string' || resolve(receiptRoot, logOutput) !== source) throw new Error('Tool-call log must link the returned image path to this result.');
  const target = containedPath(projectRoot, manifest.slides[index].output_path);
  await mkdir(join(projectRoot, 'slides'), { recursive: true });
  if (source !== target) await copyFile(source, target);
  const evidenceDirectory = join(projectRoot, 'evidence', 'imagegen', receipt.slide_id);
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = join(evidenceDirectory, `${hashBytes(logBytes).slice(0, 16)}.json`);
  await copyFile(logPath, evidencePath);
  const next = structuredClone(manifest);
  const prior = next.slides[index];
  next.slides[index] = { ...prior, status: 'generated', visual_review: 'pending', attempts: (prior.attempts ?? 0) + 1, output_sha256: outputHash, reference_delivery: { status: receipt.reference_mode, evidence_status: 'recorded', tool: receipt.tool, ...(receipt.tool_call.id ? { tool_call_id: receipt.tool_call.id } : {}), log_path: relative(projectRoot, evidencePath).split('\\').join('/'), log_sha256: hashBytes(logBytes), attached, output_sha256: outputHash, limitation: 'The receipt preserves observed call records; it does not independently attest the provider execution or visual quality.' } };
  delete next.slides[index].review_sha256;
  delete next.slides[index].reviewed_at;
  delete next.slides[index].review_notes;
  await writeJsonAtomic(join(projectRoot, 'generation_manifest.json'), next);
  return next;
}
