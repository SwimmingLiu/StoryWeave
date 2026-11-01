import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { optionalDependency, resolveSkillRoot } from '../../src/core/resources.mjs';
import { writeBytesAtomic, writeJsonAtomic, writeTextAtomic } from '../../src/core/storage.mjs';

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-core-io-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('atomic writers expose complete JSON, text and binary files without temporary leftovers', async (t) => {
  const root = await directory(t);
  await writeJsonAtomic(join(root, 'data.json'), { content: 'confirmed' });
  await writeTextAtomic(join(root, 'page.html'), '<main>Native content</main>');
  const bytes = Buffer.from([0, 128, 255, 10]);
  await writeBytesAtomic(join(root, 'image.bin'), bytes);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data.json'), 'utf8')), { content: 'confirmed' });
  assert.equal(await readFile(join(root, 'page.html'), 'utf8'), '<main>Native content</main>');
  assert.deepEqual(await readFile(join(root, 'image.bin')), bytes);
  assert.deepEqual((await readdir(root)).sort(), ['data.json', 'image.bin', 'page.html']);
});

test('failed atomic replacement keeps the destination and removes its temporary payload', async (t) => {
  const root = await directory(t);
  await mkdir(join(root, 'existing-directory'));
  await assert.rejects(() => writeTextAtomic(join(root, 'existing-directory'), 'Cannot replace a directory'));
  assert.deepEqual(await readdir(root), ['existing-directory']);
});

test('canonical resource lookup identifies the selected Skill without cwd assumptions', () => {
  assert.equal(resolveSkillRoot('storyweave-html'), resolve('skills/storyweave-html'));
  assert.equal(resolveSkillRoot('storyweave-imagegen'), resolve('skills/storyweave-imagegen'));
  assert.throws(() => resolveSkillRoot('../outside'), /Invalid Skill name/u);
});

test('a workflow package can resolve its bundled adapter and local optional dependencies', async (t) => {
  const root = await directory(t);
  const installed = join(root, 'Workflow #1');
  const core = join(installed, 'runtime/core');
  const dependency = join(installed, 'scripts/node_modules/fixture-dependency');
  await mkdir(core, { recursive: true });
  await mkdir(dependency, { recursive: true });
  await writeFile(join(installed, 'SKILL.md'), '# Workflow package');
  await writeFile(join(installed, 'scripts/package.json'), '{"type":"module"}');
  await writeFile(join(dependency, 'package.json'), '{"name":"fixture-dependency","type":"module","exports":"./index.mjs"}');
  await writeFile(join(dependency, 'index.mjs'), 'export const installedValue = 42;');
  await copyFile(new URL('../../src/core/resources.mjs', import.meta.url), join(core, 'resources.mjs'));
  const resources = await import(pathToFileURL(join(core, 'resources.mjs')).href);
  assert.equal(resources.resolveSkillRoot('storyweave-express'), await realpath(installed));
  assert.equal((await resources.optionalDependency('fixture-dependency', 'storyweave-express')).installedValue, 42);
  assert.equal(await resources.optionalDependency('missing-fixture-dependency', 'storyweave-express'), null);
  const broken = join(installed, 'scripts/node_modules/broken-fixture-dependency');
  await mkdir(broken);
  await writeFile(join(broken, 'package.json'), '{"name":"broken-fixture-dependency","type":"module","exports":"./index.mjs"}');
  await writeFile(join(broken, 'index.mjs'), 'throw new Error("Installed dependency failed");');
  await assert.rejects(() => resources.optionalDependency('broken-fixture-dependency', 'storyweave-express'), /Installed dependency failed/u);
});

test('absent source optional dependencies are reported as absent', async () => {
  assert.equal(await optionalDependency('definitely-not-a-storyweave-module', 'storyweave-html'), null);
});
