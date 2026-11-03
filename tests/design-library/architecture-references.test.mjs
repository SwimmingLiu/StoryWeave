import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildGallery, validateCatalog } from '../../scripts/build-architecture-reference-gallery.mjs';

const bytes = await readFile(new URL('../../design-library/application-architecture-references/catalog.json', import.meta.url));
const catalog = JSON.parse(bytes);

test('architecture references preserve portrait originals and distinguish AI examples from illustration themes', () => {
  validateCatalog(catalog);
  assert(catalog.cases.some((item) => item.pages.some((page) => page.height > page.width)));
  assert(catalog.cases.some((item) => item.kind === 'ai-example' && item.target === 'html'));
  for (const item of catalog.cases.filter((item) => item.target === 'imagegen')) assert.equal(item.imagegen_reference_eligible, true);
});

test('a structural figure cannot become an Imagegen style by changing both route flags', () => {
  const changed = structuredClone(catalog);
  const item = changed.cases.find((entry) => entry.target === 'html');
  item.target = 'imagegen';
  item.imagegen_reference_eligible = true;
  item.theme_ref = 'illustrated/panoramic-system';
  assert.throws(() => validateCatalog(changed), /stay on the HTML route/u);
});

test('stale observations and duplicate originals cannot satisfy architecture curation', () => {
  const stale = structuredClone(catalog);
  stale.cases[0].pages[0].sha256 = 'a'.repeat(64);
  assert.throws(() => validateCatalog(stale), /Review must bind/u);
  const repeated = structuredClone(catalog);
  repeated.cases[1].pages[0].url = repeated.cases[0].pages[0].url;
  assert.throws(() => validateCatalog(repeated), /cannot count twice/u);
});

test('generated cases require local images, exact prompts and a bound invocation record', async () => {
  const changed = structuredClone(catalog);
  delete changed.cases.find((item) => item.kind === 'generated-example').pages[0].provenance;
  assert.throws(() => validateCatalog(changed), /Missing generated evidence/u);
  await buildGallery({ check: true });
});

test('the generated casebook ships its images and prompts in a standalone Imagegen installation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-generated-casebook-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../../skills/storyweave-imagegen/install.mjs', import.meta.url)), '--dir', root]);
  const directory = join(root, 'storyweave-imagegen/assets/application-architecture-references/generated-cases');
  const evidence = JSON.parse(await readFile(join(directory, 'generation.json'), 'utf8'));
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  assert(!html.includes('src="https://'), 'The generated edition must display without remote originals');
  for (const image of evidence.images) {
    assert.equal(createHash('sha256').update(await readFile(join(directory, image.output.path))).digest('hex'), image.output.sha256);
    for (const attempt of image.attempts) assert.equal(createHash('sha256').update(await readFile(join(directory, attempt.prompt))).digest('hex'), attempt.prompt_sha256);
  }
  // New theme previews reuse these originals; installed recipes must resolve them and compile through the public CLI without repository siblings.
  const installed = join(root, 'storyweave-imagegen');
  const themeRoot = join(installed, 'assets/themes');
  const themes = JSON.parse(await readFile(join(themeRoot, 'catalog.json'), 'utf8'));
  const execute = promisify(execFile);
  for (const style of themes.architectures.flatMap((item) => item.styles).filter((item) => item.source_case)) {
    const preview = resolve(themeRoot, style.preview.cover);
    assert(preview.startsWith(`${installed}${sep}`));
    const image = evidence.images.find((item) => item.id === style.source_case);
    assert.equal(createHash('sha256').update(await readFile(preview)).digest('hex'), image.output.sha256);
    const cli = join(installed, 'scripts/ppt.mjs');
    const project = join(root, style.ref.replace('/', '--'));
    await execute(process.execPath, [cli, 'draft', project, '--theme', style.ref, '--scope', 'authoring', '--title', '新主题合同检查']);
    await execute(process.execPath, [cli, 'approve', project]);
    await execute(process.execPath, [cli, 'prompts', project]);
    const plan = JSON.parse(await readFile(join(project, 'plans/imagegen.json'), 'utf8'));
    assert.equal(plan.theme_ref, style.ref);
    await assert.rejects(execute(process.execPath, [cli, 'status', project, '--json']), (error) => error.code === 3 && JSON.parse(error.stdout).status === 'needs-images');
  }
});

test('an offline architecture viewer refuses cache bytes different from the viewed original', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-architecture-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cacheRoot = join(root, 'cache');
  await mkdir(cacheRoot);
  await writeFile(join(cacheRoot, 'changed.png'), 'changed bytes');
  const first = catalog.cases[0].pages[0];
  await writeFile(join(cacheRoot, 'cache.json'), JSON.stringify({ catalog_sha256: createHash('sha256').update(bytes).digest('hex'), images: { [first.url]: { path: 'changed.png' } } }));
  await assert.rejects(buildGallery({ cacheRoot, output: join(root, 'offline') }), /Cached original changed/u);
});

test('offline originals cannot enter distributed Skills through equal or linked output paths, or modify the cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-architecture-boundary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skills = fileURLToPath(new URL('../../skills', import.meta.url));
  const alias = join(root, 'linked-skill');
  await symlink(skills, alias, 'dir');
  await assert.rejects(buildGallery({ cacheRoot: root, output: skills }), /outside distributed Skills/u);
  await assert.rejects(buildGallery({ cacheRoot: root, output: join(alias, 'private-export') }), /outside distributed Skills/u);
  await assert.rejects(buildGallery({ cacheRoot: root, output: join(root, 'private-export') }), /outside the input cache/u);
});
