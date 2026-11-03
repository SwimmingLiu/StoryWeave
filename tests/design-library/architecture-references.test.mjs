import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  await writeFile(join(root, 'changed.png'), 'changed bytes');
  const first = catalog.cases[0].pages[0];
  await writeFile(join(root, 'cache.json'), JSON.stringify({ catalog_sha256: createHash('sha256').update(bytes).digest('hex'), images: { [first.url]: { path: 'changed.png' } } }));
  await assert.rejects(buildGallery({ cacheRoot: root, output: join(root, 'offline') }), /Cached original changed/u);
});
