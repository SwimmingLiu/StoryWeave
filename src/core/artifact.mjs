import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { canonicalJson, freezeJson, hashBytes, hashValue } from './hash.mjs';

export const OUTPUT_VARIANTS = freezeJson([
  { version: 1, producer: 'storyweave-html', kind: 'html' },
  { version: 1, producer: 'storyweave-imagegen', kind: 'image' },
  { version: 2, producer: 'storyweave-html', kind: 'html' },
]);
const ID_PATTERN = '^[A-Za-z0-9_-]+$';
const PATH_PATTERN = '^(?!/)(?!.*[\\\\:\\u0000-\\u001f])(?!.*(?:^|/)\\.\\.?(?:/|$))(?!.*//).+$';
const SHA256 = /^[a-f0-9]{64}$/u;
const id = new RegExp(ID_PATTERN, 'u');
const safePath = new RegExp(PATH_PATTERN, 'u');
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function isProjectPath(value) {
  return nonempty(value) && safePath.test(value) && !isAbsolute(value);
}

export function validateOutputManifest(manifest) {
  const findings = [];
  const block = (code, message, slideId) => findings.push({ severity: 'blocking', code, message, ...(slideId ? { slide_id: slideId } : {}) });
  if (!record(manifest)) return { valid: false, findings: [{ severity: 'blocking', code: 'manifest.object', message: 'Producer manifest must be an object.' }] };
  if (manifest.format !== 'storyweave/slides') block('manifest.format', 'Expected storyweave/slides.');
  if (!OUTPUT_VARIANTS.some((variant) => Object.entries(variant).every(([key, value]) => manifest[key] === value))) block('manifest.variant', 'Unsupported producer, kind and version combination.');
  if (!nonempty(manifest.title)) block('manifest.title', 'Producer manifest must have a title.');
  const { width, height } = manifest.canvas ?? {};
  const integerCanvas = Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0;
  if (!integerCanvas || BigInt(width) * 9n !== BigInt(height) * 16n) block('manifest.canvas', 'Canvas must use positive integer dimensions with a 16:9 aspect ratio.');
  if (manifest.entry !== undefined && !isProjectPath(manifest.entry)) block('manifest.entry', 'Entry must be a safe project-relative file path.');
  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) block('manifest.slides', 'Producer manifest needs at least one slide.');
  const ids = new Set();
  for (const slide of Array.isArray(manifest.slides) ? manifest.slides : []) {
    if (!record(slide)) { block('manifest.slide', 'Each slide must be an object.'); continue; }
    if (!nonempty(slide.id) || !id.test(slide.id) || ids.has(slide.id)) block('manifest.slide_id', 'Slide IDs must be safe and unique.', slide.id);
    ids.add(slide.id);
    if (!isProjectPath(slide.source)) block('manifest.source', 'Slide source must be a safe project-relative file path.', slide.id);
  }
  return { valid: findings.length === 0, findings };
}

export function parseOutputManifest(value) {
  const manifest = typeof value === 'string' ? JSON.parse(value) : value;
  const result = validateOutputManifest(manifest);
  if (!result.valid) throw new Error(result.findings.map((finding) => `${finding.code}: ${finding.message}`).join(' '));
  return JSON.parse(canonicalJson(manifest));
}

export function outputSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://storyweave.local/contracts/output.schema.json',
    title: 'StoryWeave producer output', type: 'object',
    required: ['format', 'version', 'producer', 'kind', 'title', 'canvas', 'slides'],
    oneOf: OUTPUT_VARIANTS.map((variant) => ({ properties: Object.fromEntries(Object.entries(variant).map(([key, value]) => [key, { const: value }])) })),
    properties: {
      format: { const: 'storyweave/slides' },
      version: { enum: [...new Set(OUTPUT_VARIANTS.map((variant) => variant.version))] },
      producer: { enum: [...new Set(OUTPUT_VARIANTS.map((variant) => variant.producer))] },
      kind: { enum: [...new Set(OUTPUT_VARIANTS.map((variant) => variant.kind))] },
      title: { type: 'string', minLength: 1, pattern: '\\S' },
      canvas: { type: 'object', required: ['width', 'height'], properties: Object.fromEntries(['width', 'height'].map((key) => [key, { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }])) },
      entry: { type: 'string', pattern: PATH_PATTERN },
      slides: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'source'], properties: { id: { type: 'string', pattern: ID_PATTERN }, source: { type: 'string', pattern: PATH_PATTERN }, role: { type: 'string' }, notes: { type: 'string' } }, additionalProperties: true } },
    },
    $comment: 'The runtime boundary also enforces an exact 16:9 canvas, unique slide IDs, existing files and project containment.',
    additionalProperties: true,
  };
}

function inside(root, path) {
  const offset = relative(root, path);
  return offset !== '..' && !offset.startsWith('../') && !offset.startsWith('..\\') && !isAbsolute(offset);
}

async function projectFile(root, path) {
  if (!isProjectPath(path)) throw new Error(`Unsafe project path: ${path}`);
  const target = await realpath(resolve(root, path));
  if (!inside(root, target)) throw new Error(`Project path escapes through a symlink: ${path}`);
  if (!(await stat(target)).isFile()) throw new Error(`Project source must be a file: ${path}`);
  return target;
}

export async function createArtifactBinding(projectRoot, value, { inputs = [] } = {}) {
  const root = await realpath(resolve(projectRoot));
  const manifest = parseOutputManifest(value);
  if (!Array.isArray(inputs) || inputs.some((path) => !isProjectPath(path))) throw new Error('Artifact inputs must be safe project-relative file paths.');
  const manifestBytes = await readFile(await projectFile(root, 'storyweave-output.json'));
  if (canonicalJson(parseOutputManifest(manifestBytes.toString('utf8'))) !== canonicalJson(manifest)) throw new Error('Producer manifest file does not match the supplied manifest.');
  const paths = new Map();
  for (const path of inputs) paths.set(path, 'input');
  if (manifest.entry) paths.set(manifest.entry, 'entry');
  for (const slide of manifest.slides) paths.set(slide.source, 'page');
  const files = [];
  for (const [path, role] of [...paths].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    const bytes = await readFile(await projectFile(root, path));
    files.push({ path, sha256: hashBytes(bytes), role });
  }
  const body = { schema_version: 1, manifest_sha256: hashBytes(manifestBytes), files };
  return freezeJson({ ...body, fingerprint: hashValue(body) });
}

function checkQa(report) {
  if (!record(report) || report.export_ready !== true || !record(report.summary) || report.summary.blocking !== 0 || (report.summary.degraded !== undefined && report.summary.degraded !== 0)) throw new Error('Producer QA is not ready; rerun producer QA without blocking or degraded checks.');
  if (report.findings !== undefined && !Array.isArray(report.findings)) throw new Error('QA findings must be an array.');
  if ((report.findings ?? []).some((finding) => !record(finding) || !['blocking', 'degraded', 'warning', 'info'].includes(finding.severity))) throw new Error('QA findings must have a recognized severity.');
  if ((report.findings ?? []).some((finding) => finding?.severity === 'blocking' || finding?.severity === 'degraded')) throw new Error('Producer QA contains blocking or degraded findings.');
  const binding = report.artifact_binding;
  if (!record(binding) || binding.schema_version !== 1 || !SHA256.test(binding.fingerprint) || !SHA256.test(binding.manifest_sha256) || !Array.isArray(binding.files) || binding.files.length === 0) throw new Error('Producer QA has no valid artifact binding; rerun producer QA.');
  const paths = new Set();
  for (const file of binding.files) {
    if (!record(file) || !isProjectPath(file.path) || !SHA256.test(file.sha256) || !['page', 'entry', 'input'].includes(file.role) || paths.has(file.path)) throw new Error('Producer QA artifact binding contains invalid file records.');
    paths.add(file.path);
  }
  return binding;
}

export async function verifyArtifactBinding(projectRoot, manifest, qaReport) {
  const expected = checkQa(qaReport);
  const current = await createArtifactBinding(projectRoot, manifest, { inputs: expected.files.filter((file) => file.role === 'input').map((file) => file.path) });
  if (current.fingerprint !== expected.fingerprint || current.manifest_sha256 !== expected.manifest_sha256 || canonicalJson(current.files) !== canonicalJson(expected.files)) throw new Error('Producer QA is stale; files or inputs changed after inspection. Rerun producer QA.');
  return freezeJson({ root: await realpath(resolve(projectRoot)), manifest: parseOutputManifest(manifest), binding: current });
}

export async function readVerifiedArtifact(projectRoot) {
  const root = await realpath(resolve(projectRoot));
  const [manifest, qa] = await Promise.all(['storyweave-output.json', 'qa_report.json'].map(async (path) => JSON.parse(await readFile(await projectFile(root, path), 'utf8'))));
  return verifyArtifactBinding(root, manifest, qa);
}
