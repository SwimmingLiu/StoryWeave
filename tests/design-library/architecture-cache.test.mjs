import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const repo = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repo, 'scripts/cache-presentation-references.py');
const catalog = JSON.parse(await readFile(join(repo, 'design-library/application-architecture-references/catalog.json'), 'utf8'));
const original = catalog.cases.find((item) => item.kind === 'generated-example').pages[0];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('unpublished generated originals prepare an offline cache without a remote request and remain read-only', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-local-original-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = await readFile(join(repo, original.local_asset));
  const fixture = join(root, 'catalog.json');
  const cache = join(root, 'cache');
  const page = { ...original, url: 'https://127.0.0.1:1/unpublished.png' };
  await writeFile(fixture, JSON.stringify({ cases: [{ pages: [page] }] }));
  const result = JSON.parse((await execute('python3', [script, '--catalog', fixture, '--cache', cache])).stdout);
  assert.equal(result.result, 'pass');
  assert.equal(result.downloaded, 0);
  assert.equal(result.copied_local, 1);
  const manifest = await readFile(join(cache, 'cache.json'));
  const record = JSON.parse(manifest).images[page.url];
  assert.equal(digest(await readFile(join(cache, record.path))), page.sha256);
  await execute('python3', [script, '--catalog', fixture, '--cache', cache, '--check']);
  assert.deepEqual(await readFile(join(cache, 'cache.json')), manifest);
  assert.deepEqual(await readFile(join(repo, page.local_asset)), source);
});

test('local originals require matching byte bindings and cannot escape through absolute paths, traversal or symlinks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-unsafe-original-'));
  await mkdir(join(repo, 'tmp'), { recursive: true });
  const links = await mkdtemp(join(repo, 'tmp/architecture-source-boundary-'));
  t.after(() => Promise.all([root, links].map((path) => rm(path, { recursive: true, force: true }))));
  const outside = join(root, 'outside.png');
  await writeFile(outside, await readFile(join(repo, original.local_asset)));
  const link = join(links, 'outside.png');
  await symlink(outside, link);
  const cases = [
    { sha256: '0'.repeat(64), expected: /differs from the inspected original/u },
    { sha256: null, expected: /requires an inspected byte hash/u },
    { local_asset: outside, expected: /repository-relative/u },
    { local_asset: relative(repo, outside), expected: /escaped the repository/u },
    { local_asset: relative(repo, link), expected: /escaped the repository/u },
  ];
  for (const [index, { expected, ...changes }] of cases.entries()) {
    const fixture = join(root, `catalog-${index}.json`);
    await writeFile(fixture, JSON.stringify({ cases: [{ pages: [{ ...original, ...changes, url: 'https://127.0.0.1:1/unpublished.png' }] }] }));
    await assert.rejects(execute('python3', [script, '--catalog', fixture, '--cache', join(root, `cache-${index}`)]), (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(result.images, 0);
      assert.equal(result.downloaded, 0);
      assert.match(result.errors[0].error, expected);
      return true;
    });
  }
});
