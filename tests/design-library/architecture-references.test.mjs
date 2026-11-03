import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import test from 'node:test';
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
