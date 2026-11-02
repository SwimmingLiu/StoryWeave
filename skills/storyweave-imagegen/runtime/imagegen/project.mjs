import { access, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { approveContent, assertApprovedContent, validateContent, visibleText } from '../core/content.mjs';
import { createArtifactBinding, parseOutputManifest } from '../core/artifact.mjs';
import { resolveSkillRoot } from '../core/resources.mjs';
import { writeJsonAtomic, writeTextAtomic } from '../core/storage.mjs';
import { selectReferences } from '../design-library/library.mjs';
import { createStoryweaveOutput, inspectGeneratedImage, refreshManifest } from './imagegen.mjs';
import { assertImagePlan, collectImageResult, compilePlannedImageJobs, createPlannedGenerationManifest, planImagegen, validatePlannedManifest, verifyPlanReferences } from './plan.mjs';
import { openThemeCatalog } from './themes.mjs';
import { renderImageDeck } from './render.mjs';
import { renderOutlinePreview } from './outline.mjs';

const exists = (path) => access(path).then(() => true, () => false);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const themeRoot = () => join(resolveSkillRoot('storyweave-imagegen'), 'assets', 'themes');
const catalogFor = (scope) => openThemeCatalog(themeRoot(), { scope });

function preview(content, themeRef) {
  return renderOutlinePreview({ ...content, theme_ref: themeRef, slides: content.slides.map((slide) => ({ ...slide, exact_text: visibleText(slide), visual_brief: `Authored ${slide.content.type} content`, visual_scheme_ref: 'auto' })) });
}

export async function createStructuredDraft(root, { title, theme_ref = 'editorial/paper-magazine', catalog_scope = 'authoring' } = {}) {
  const catalog = await catalogFor(catalog_scope);
  catalog.getStyle(theme_ref);
  const content = await readJson(join(resolveSkillRoot('storyweave-imagegen'), 'assets', 'content-v4.example.json'));
  const draft = { ...content, status: 'draft', theme_ref, catalog_scope, ...(title ? { title } : {}) };
  await mkdir(root, { recursive: true });
  await writeJsonAtomic(join(root, 'outline_draft.json'), draft);
  await writeTextAtomic(join(root, 'outline_preview.html'), preview(draft, theme_ref));
  return draft;
}

async function resolveReferences(root, referencesFile, libraryRoot, previous = []) {
  if (!referencesFile) return previous;
  const selections = await readJson(resolve(referencesFile));
  const library = libraryRoot ? resolve(libraryRoot) : resolve(resolveSkillRoot('storyweave-imagegen'), '../../design-library');
  return selectReferences(library, selections, { projectRoot: root });
}

export async function approveStructuredProject(root, options = {}) {
  const draft = await readJson(join(root, 'outline_draft.json'));
  const content = approveContent(draft);
  const themeRef = options.theme_ref ?? draft.theme_ref ?? 'editorial/paper-magazine';
  const scope = options.catalog_scope ?? draft.catalog_scope ?? 'authoring';
  const catalog = await catalogFor(scope);
  const references = await resolveReferences(root, options.references_file, options.library_root);
  const plan = planImagegen(content, catalog, { theme_ref: themeRef, references });
  await mkdir(join(root, 'plans'), { recursive: true });
  await writeJsonAtomic(join(root, 'deck_spec.json'), content);
  await writeJsonAtomic(join(root, 'plans', 'imagegen.json'), plan);
  return { content, plan };
}

export async function replanStructuredProject(root, options = {}) {
  const content = await readJson(join(root, 'deck_spec.json'));
  assertApprovedContent(content);
  const current = await readJson(join(root, 'plans', 'imagegen.json'));
  const catalog = await catalogFor(options.catalog_scope ?? current.catalog_scope);
  const references = await resolveReferences(root, options.references_file, options.library_root, current.references);
  const plan = planImagegen(content, catalog, { theme_ref: options.theme_ref ?? current.theme_ref, references });
  await writeJsonAtomic(join(root, 'plans', 'imagegen.json'), plan);
  return plan;
}

export async function loadStructuredProject(root) {
  const content = await readJson(join(root, 'deck_spec.json'));
  const plan = await readJson(join(root, 'plans', 'imagegen.json'));
  const catalog = await catalogFor(plan.catalog_scope);
  assertImagePlan(content, plan, catalog);
  await verifyPlanReferences(root, plan);
  return { content, plan };
}

export async function prepareStructuredJobs(root, options = {}) {
  const { content, plan } = await loadStructuredProject(root);
  const jobs = compilePlannedImageJobs(content, plan, { ...options, projectRoot: root });
  const manifest = createPlannedGenerationManifest(content, plan, jobs);
  const previous = await exists(join(root, 'generation_manifest.json')) ? await readJson(join(root, 'generation_manifest.json')) : null;
  // Recompiling one changed page must not discard valid image reviews on other pages.
  if (previous?.schema_version === 4 && previous.contentRevision === content.revision) {
    for (const [index, slide] of manifest.slides.entries()) {
      const old = previous.slides.find((item) => item.id === slide.id);
      if (old?.task_sha256 === slide.task_sha256) manifest.slides[index] = { ...old, ...slide, status: old.status, visual_review: old.visual_review, attempts: old.attempts, ...(old.review_sha256 ? { review_sha256: old.review_sha256 } : {}), ...(old.reviewed_at ? { reviewed_at: old.reviewed_at } : {}), ...(old.review_notes ? { review_notes: old.review_notes } : {}), ...(old.reference_delivery ? { reference_delivery: old.reference_delivery } : {}), ...(old.output_sha256 ? { output_sha256: old.output_sha256 } : {}) };
    }
  }
  await mkdir(join(root, 'slides'), { recursive: true });
  await writeJsonAtomic(join(root, 'generation_manifest.json'), manifest);
  await writeTextAtomic(join(root, 'imagegen-jobs.jsonl'), `${jobs.map((job) => JSON.stringify(job)).join('\n')}\n`);
  return { jobs, manifest, status: 'needs-images' };
}

export async function recordStructuredResult(root, receiptPath) {
  const { content, plan } = await loadStructuredProject(root);
  const manifest = await readJson(join(root, 'generation_manifest.json'));
  const path = resolve(receiptPath);
  return collectImageResult(root, content, plan, manifest, await readJson(path), { receiptRoot: dirname(path) });
}

export async function structuredStatus(root) {
  const manifest = await refreshManifest(root, await readJson(join(root, 'generation_manifest.json')));
  const missing = manifest.slides.filter((slide) => !['generated', 'pass'].includes(slide.status)).map((slide) => slide.id);
  const pendingReview = manifest.slides.filter((slide) => slide.status === 'generated').map((slide) => slide.id);
  return { status: missing.length ? 'needs-images' : pendingReview.length ? 'needs-review' : 'ready-for-qa', missing, pending_review: pendingReview, manifest };
}

export async function buildStructuredProject(root, { output } = {}) {
  const { content, plan } = await loadStructuredProject(root);
  const state = await structuredStatus(root);
  if (state.status !== 'ready-for-qa') return state;
  const check = validatePlannedManifest(state.manifest, content, plan);
  if (!check.valid) throw new Error(check.findings.map((item) => item.message).join(' '));
  await writeJsonAtomic(join(root, 'generation_manifest.json'), state.manifest);
  const entry = join(root, 'index.html');
  await writeTextAtomic(entry, renderImageDeck(content, state.manifest));
  const target = output ? resolve(output) : entry;
  if (target !== entry) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(entry, target);
    if (dirname(target) !== resolve(root)) await cp(join(root, 'slides'), join(dirname(target), 'slides'), { recursive: true });
  }
  const manifest = createStoryweaveOutput(content, state.manifest);
  manifest.content_revision = content.revision;
  manifest.plan_sha256 = plan.plan_sha256;
  parseOutputManifest(manifest);
  await writeJsonAtomic(join(root, 'storyweave-output.json'), manifest);
  return { status: 'built', output: target, manifest };
}

export async function imageProjectInputs(root, plan, generation) {
  const inputs = ['deck_spec.json', 'plans/imagegen.json', 'generation_manifest.json', ...plan.references.map((reference) => reference.path), ...generation.slides.map((slide) => slide.reference_delivery?.log_path).filter(Boolean)];
  return [...new Set(inputs)];
}

async function verifyCallEvidence(root, plan, generation) {
  const findings = [];
  for (const slide of generation.slides) {
    const delivery = slide.reference_delivery;
    if (delivery?.evidence_status !== 'recorded') continue;
    try {
      const path = delivery.log_path;
      if (isAbsolute(path) || path.split('/').includes('..')) throw new Error('Tool-call evidence must stay in the project.');
      const actual = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
      if (actual !== delivery.log_sha256) throw new Error('Tool-call evidence changed after collection.');
      const expected = plan.slides.find((item) => item.id === slide.id).references;
      if (delivery.status === 'attached' && [...new Set(expected.map((reference) => reference.sha256))].sort().join(',') !== [...new Set(delivery.attached.map((reference) => reference.sha256))].sort().join(',')) throw new Error('Recorded attachment hashes no longer match the selected references.');
    } catch (error) { findings.push({ severity: 'blocking', code: 'reference.evidence_invalid', slide_id: slide.id, message: error.message }); }
  }
  return findings;
}

export async function qaStructuredProject(root) {
  // Persist status before binding, then reload for acceptance so preparation cannot hide a concurrent image edit.
  const prepared = await refreshManifest(root, await readJson(join(root, 'generation_manifest.json')));
  await writeJsonAtomic(join(root, 'generation_manifest.json'), prepared);
  const built = await exists(join(root, 'index.html')) && await exists(join(root, 'storyweave-output.json'));
  const discoveredPlan = await readJson(join(root, 'plans', 'imagegen.json'));
  const manifest = built ? await readJson(join(root, 'storyweave-output.json')) : null;
  // A final hash alone approved references changed after validation. Bind before every acceptance check and compare afterwards.
  const before = built ? await createArtifactBinding(root, manifest, { inputs: await imageProjectInputs(root, discoveredPlan, prepared) }) : null;
  const { content, plan } = await loadStructuredProject(root);
  const generation = await refreshManifest(root, await readJson(join(root, 'generation_manifest.json')));
  const findings = [...validatePlannedManifest(generation, content, plan).findings, ...await verifyCallEvidence(root, plan, generation)];
  for (const slide of generation.slides) {
    const check = await inspectGeneratedImage(join(root, slide.output_path), slide.size);
    if (!check.valid) findings.push({ severity: 'blocking', code: check.code, slide_id: slide.id, message: check.message });
    if (check.warning) findings.push({ severity: 'warning', code: check.warning.code, slide_id: slide.id, message: check.warning.message });
  }
  if (!built) findings.push({ severity: 'blocking', code: 'build.missing', message: 'Build the reviewed image pages before delivery.' });
  if (built) {
    try {
      const after = await createArtifactBinding(root, manifest, { inputs: await imageProjectInputs(root, plan, generation) });
      if (before.fingerprint !== after.fingerprint) throw new Error('Project files or inputs changed during Imagegen QA. Rerun QA.');
    } catch (error) { findings.push({ severity: 'blocking', code: 'artifact.changed_during_qa', message: error.message }); }
  }
  const summary = { blocking: findings.filter((item) => item.severity === 'blocking').length, warning: findings.filter((item) => item.severity === 'warning').length, degraded: 0 };
  const report = { schema_version: 1, producer: 'storyweave-imagegen', mode: 'imagegen', export_ready: summary.blocking === 0, content_revision: content.revision, plan_sha256: plan.plan_sha256, summary, findings };
  if (built) report.artifact_binding = before;
  await writeJsonAtomic(join(root, 'qa_report.json'), report);
  return report;
}

export async function migrateStructuredProject(root) {
  const source = await readJson(join(root, 'outline_draft.json'));
  if (source.schema_version === 4) throw new Error('This project already uses structured content.');
  const draft = { schema_version: 4, status: 'draft', title: source.title, audience: source.audience, purpose: source.purpose, page_count: source.slides.length, central_message: source.central_message, narrative: source.narrative, language: source.language ?? 'zh-CN', canvas: '16:9', reading_mode: 'speaker-led', theme_ref: source.theme_ref, catalog_scope: source.catalog_scope ?? 'authoring', narrativeReferences: source.narrativeReferences ?? [], slides: source.slides.map((slide) => ({ id: slide.id, role: slide.role, claim: slide.claim, purpose: slide.purpose, evidence: slide.evidence ?? [], sources: slide.sources ?? [], ...(slide.speaker_notes ? { speaker_notes: slide.speaker_notes } : {}), transition: slide.transition ?? '', content: { type: 'statement', title: slide.exact_text[0], body: slide.exact_text.slice(1) } })) };
  const validation = validateContent(draft);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const backup = join(root, `outline_draft.pre-v4-${Date.now()}.json`);
  await copyFile(join(root, 'outline_draft.json'), backup);
  const report = { source_version: source.schema_version, target_version: 4, backup, visible_text_preserved: JSON.stringify(visibleText(draft)) === JSON.stringify(source.slides.flatMap((slide) => slide.exact_text)), pending_structure: source.slides.filter((slide) => ['comparison', 'two-column', 'process', 'data'].includes(slide.role)).map((slide) => ({ slide_id: slide.id, message: 'Text remains a statement. Author explicit comparisons, steps, metrics or relations before selecting the corresponding structure.' })) };
  await writeJsonAtomic(join(root, 'outline_draft.json'), draft);
  await writeJsonAtomic(join(root, 'content-migration-report.json'), report);
  await writeTextAtomic(join(root, 'outline_preview.html'), preview(draft, draft.theme_ref));
  return report;
}
