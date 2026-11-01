import { createHash } from 'node:crypto';
import { access, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const PURPOSES = new Set(['narrative', 'palette', 'layout', 'diagram', 'typography', 'rhythm']);
const IMAGES = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const exists = (path) => access(path).then(() => true, () => false);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a nonempty string.`);
  return value;
}

function id(value, field) {
  text(value, field);
  if (!ID.test(value)) throw new Error(`${field} has an invalid ID.`);
  return value;
}

function safeRelative(value, field) {
  text(value, field);
  if (isAbsolute(value) || value.includes('\\') || value.includes(':') || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`${field} must be a safe project-relative path.`);
  return value;
}

function tags(values, field) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value.trim())) throw new Error(`${field} must contain strings.`);
  return [...new Set(values)].sort();
}

export function validateCase(source) {
  id(source?.id, 'case.id');
  text(source.title, 'case.title');
  if (!source.source || typeof source.source !== 'object' || Array.isArray(source.source)) throw new Error(`Case ${source.id} needs source attribution.`);
  text(source.source.kind, 'case.source.kind');
  text(source.source.path ?? source.source.url, 'case.source.path or url');
  const pages = source.pages;
  if (!Array.isArray(pages) || !pages.length || source.page_count !== pages.length) throw new Error(`Case ${source.id} must retain its declared full page sequence.`);
  const ids = new Set();
  pages.forEach((page, index) => {
    id(page.id, 'page.id');
    if (ids.has(page.id) || page.order !== index + 1) throw new Error(`Case ${source.id} has duplicate IDs or an invalid page order.`);
    ids.add(page.id);
    safeRelative(page.path, 'page.path');
    if (page.role !== undefined) text(page.role, 'page.role');
    if (page.title !== undefined) text(page.title, 'page.title');
  });
  return { ...source, tags: tags(source.tags ?? [], 'case.tags'), roles: tags(source.roles ?? pages.map((page) => page.role).filter(Boolean), 'case.roles'), audiences: tags(source.audiences ?? [], 'case.audiences') };
}

export async function buildDesignIndex(libraryRoot) {
  const root = resolve(libraryRoot);
  const casesRoot = join(root, 'cases');
  const cases = [];
  if (await exists(casesRoot)) {
    for (const entry of (await readdir(casesRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (!entry.isDirectory()) continue;
      const sourcePath = join(casesRoot, entry.name, 'source.json');
      const source = validateCase(await readJson(sourcePath));
      if (source.id !== entry.name) throw new Error(`Case folder ${entry.name} must match case.id ${source.id}.`);
      if (cases.some((item) => item.id === source.id)) throw new Error(`Duplicate case ID: ${source.id}.`);
      const analysisPath = join(casesRoot, entry.name, 'analysis.md');
      const analysis = await readFile(analysisPath, 'utf8');
      if (!analysis.trim()) throw new Error(`Case ${source.id} has no narrative and visual analysis.`);
      for (const page of source.pages) await resolveResource(root, page.path);
      cases.push({ ...source, metadata_path: `cases/${source.id}/source.json`, metadata_sha256: digest(await readFile(sourcePath)), analysis_path: `cases/${source.id}/analysis.md`, analysis_sha256: digest(analysis) });
    }
  }
  return { schema_version: 1, resource_base: '..', cases };
}

export async function readDesignLibrary(libraryRoot) {
  const root = resolve(libraryRoot);
  if (!(await exists(root))) return { schema_version: 1, resource_base: '..', cases: [] };
  const path = join(root, 'index.json');
  if (!(await exists(path))) return buildDesignIndex(root);
  const index = await readJson(path);
  if (index.schema_version !== 1 || index.resource_base !== '..' || !Array.isArray(index.cases)) throw new Error('Unsupported design library index. Rebuild it from case metadata.');
  const seen = new Set();
  for (const item of index.cases) {
    validateCase(item);
    if (seen.has(item.id)) throw new Error(`Duplicate case ID: ${item.id}.`);
    seen.add(item.id);
    safeRelative(item.metadata_path, 'metadata_path');
    safeRelative(item.analysis_path, 'analysis_path');
  }
  return index;
}

export function searchCases(index, { tags: requested = [], role, audience, density } = {}) {
  return index.cases.filter((item) => requested.every((tag) => item.tags.includes(tag)) && (!role || item.roles.includes(role)) && (!audience || item.audiences.includes(audience)) && (!density || item.density === density));
}

async function resolveResource(libraryRoot, pagePath) {
  const base = await realpath(dirname(resolve(libraryRoot)));
  const path = await realpath(resolve(base, safeRelative(pagePath, 'page.path')));
  const fromBase = relative(base, path);
  if (fromBase === '..' || fromBase.startsWith('../') || isAbsolute(fromBase)) throw new Error(`Reference resource escapes the library project: ${pagePath}.`);
  return path;
}

export async function selectReferences(libraryRoot, selections, { projectRoot } = {}) {
  if (!Array.isArray(selections)) throw new Error('Reference selections must be an array.');
  const index = await readDesignLibrary(libraryRoot);
  const selected = [];
  const seen = new Set();
  for (const selection of selections) {
    id(selection.case_id, 'reference.case_id');
    id(selection.page_id, 'reference.page_id');
    if (!PURPOSES.has(selection.purpose)) throw new Error(`Unknown reference purpose: ${selection.purpose}.`);
    if (selection.slide_id !== undefined) id(selection.slide_id, 'reference.slide_id');
    const key = [selection.case_id, selection.page_id, selection.purpose, selection.slide_id ?? '*'].join('/');
    if (seen.has(key)) throw new Error(`Duplicate reference selection: ${key}.`);
    seen.add(key);
    const item = index.cases.find((entry) => entry.id === selection.case_id);
    const page = item?.pages.find((entry) => entry.id === selection.page_id);
    if (!page) throw new Error(`Unknown case page: ${selection.case_id}/${selection.page_id}.`);
    if (digest(await readFile(join(libraryRoot, item.metadata_path))) !== item.metadata_sha256 || digest(await readFile(join(libraryRoot, item.analysis_path))) !== item.analysis_sha256) throw new Error(`Design index is stale for ${item.id}. Rebuild it from case metadata.`);
    const sourcePath = await resolveResource(libraryRoot, page.path);
    if (!IMAGES.has(extname(sourcePath).toLowerCase())) throw new Error(`Reference page needs an image: ${page.path}. Render the source page before selection.`);
    const bytes = await readFile(sourcePath);
    const sha256 = digest(bytes);
    let path = sourcePath;
    if (projectRoot) {
      const filename = `${item.id}-${page.id}-${sha256.slice(0, 12)}${extname(sourcePath).toLowerCase()}`;
      await mkdir(resolve(projectRoot), { recursive: true });
      const project = await realpath(projectRoot);
      const directory = join(project, 'references');
      await mkdir(directory, { recursive: true });
      if (await realpath(directory) !== directory) throw new Error('Captured reference directory must stay in the project.');
      const target = join(directory, filename);
      try { await writeFile(target, bytes, { flag: 'wx' }); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if ((await lstat(target)).isSymbolicLink() || digest(await readFile(target)) !== sha256) throw new Error('Existing captured reference does not match the selected bytes.');
      }
      path = `references/${filename}`;
    }
    selected.push({ case_id: item.id, page_id: page.id, purpose: selection.purpose, ...(selection.slide_id ? { slide_id: selection.slide_id } : {}), ...(selection.application ? { application: structuredClone(selection.application) } : {}), path, sha256, source_path: page.path, case_revision: item.metadata_sha256, analysis_revision: item.analysis_sha256 });
  }
  return selected;
}
