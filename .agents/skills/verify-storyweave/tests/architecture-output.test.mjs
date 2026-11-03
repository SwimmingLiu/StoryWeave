import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/architecture-references.mjs', import.meta.url));

test('architecture verification rejects existing work and cache overlap before browser launch or cleanup', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-architecture-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = join(root, 'cache');
  const existing = join(root, 'existing');
  await mkdir(cache);
  await writeFile(join(cache, 'cache.json'), '{}');
  await mkdir(join(existing, 'offline-viewer'), { recursive: true });
  const sentinel = join(existing, 'offline-viewer', 'keep.txt');
  await writeFile(sentinel, 'prior interrupted run');
  const alias = join(root, 'linked-existing');
  await symlink(existing, alias, 'dir');
  for (const output of [existing, alias]) {
    await assert.rejects(execute(process.execPath, [script, '--cache', cache, '--out', output]), (error) => /EEXIST/u.test(error.stderr));
    assert.equal(await readFile(sentinel, 'utf8'), 'prior interrupted run');
    assert.deepEqual(await readdir(existing), ['offline-viewer']);
  }
  await assert.rejects(execute(process.execPath, [script, '--cache', cache, '--out', join(cache, 'evidence')]), (error) => /must not overlap/u.test(error.stderr));
  assert.deepEqual(await readdir(cache), ['cache.json']);
});
