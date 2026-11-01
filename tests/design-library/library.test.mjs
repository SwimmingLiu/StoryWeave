import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDesignIndex, readDesignLibrary, searchCases, selectReferences } from '../../src/design-library/library.mjs';

const execute = promisify(execFile);

async function example(t) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-library-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const library = join(root, 'design-library');
  await mkdir(join(library, 'cases', 'example'), { recursive: true });
  await mkdir(join(root, 'images'));
  await writeFile(join(root, 'images', 'a.png'), 'reference-a');
  await writeFile(join(root, 'images', 'b.png'), 'reference-b');
  const source = { id: 'example', title: 'A complete two-page fixture', source: { kind: 'test-fixture', path: 'design-library/cases/example/source.json' }, author: null, page_count: 2, tags: ['process', 'editorial'], roles: ['cover', 'process'], audiences: ['engineering'], density: 'medium', pages: [{ id: 'a', order: 1, role: 'cover', path: 'images/a.png' }, { id: 'b', order: 2, role: 'process', path: 'images/b.png' }] };
  await writeFile(join(library, 'cases', 'example', 'source.json'), JSON.stringify(source));
  await writeFile(join(library, 'cases', 'example', 'analysis.md'), '# Example\n\n## Narrative\nA claim followed by a process.\n\n## Visual\nA contrasting pair.\n');
  return { root, library, source };
}

test('index preserves whole-case order and searches metadata without replacing project content', async (t) => {
  const { library } = await example(t);
  const index = await buildDesignIndex(library);
  assert.deepEqual(index.cases[0].pages.map((page) => page.id), ['a', 'b']);
  assert.equal(index.cases[0].author, null);
  assert.equal(searchCases(index, { tags: ['editorial'], role: 'process', audience: 'engineering' }).length, 1);
  assert.equal(searchCases(index, { tags: ['unknown'] }).length, 0);
  assert.equal(searchCases(index, { density: 'high' }).length, 0);
});

test('selection captures only chosen image bytes and retains purpose/application provenance', async (t) => {
  const { root, library } = await example(t);
  const project = join(root, 'project');
  const selected = await selectReferences(library, [{ case_id: 'example', page_id: 'b', purpose: 'diagram', slide_id: 's04', application: { layout: 'process' } }], { projectRoot: project });
  assert.equal(selected.length, 1);
  assert.match(selected[0].path, /^references\/example-b-[a-f0-9]{12}\.png$/u);
  assert.equal(await readFile(join(project, selected[0].path), 'utf8'), 'reference-b');
  assert.equal(selected[0].source_path, 'images/b.png');
  assert.deepEqual(selected[0].application, { layout: 'process' });
  assert.equal(selected[0].slide_id, 's04');
  assert.match(selected[0].sha256, /^[a-f0-9]{64}$/u);
  assert.equal(await readFile(join(root, 'images', 'b.png'), 'utf8'), 'reference-b');
});

test('missing optional library stays empty, but explicit missing pages fail', async (t) => {
  const { root, library } = await example(t);
  assert.deepEqual((await readDesignLibrary(join(root, 'missing'))).cases, []);
  await assert.rejects(selectReferences(library, [{ case_id: 'example', page_id: 'missing', purpose: 'layout' }]), /Unknown case page/u);
  await assert.rejects(selectReferences(library, [{ case_id: 'example', page_id: 'a', purpose: 'facts' }]), /purpose/u);
});

test('index rejects incomplete order, traversal and resource symlink escape', async (t) => {
  const { root, library, source } = await example(t);
  const path = join(library, 'cases', 'example', 'source.json');
  await writeFile(path, JSON.stringify({ ...source, pages: [source.pages[1], source.pages[0]] }));
  await assert.rejects(buildDesignIndex(library), /page order/u);
  await writeFile(path, JSON.stringify({ ...source, pages: [{ ...source.pages[0], path: '../secret.png' }, source.pages[1]] }));
  await assert.rejects(buildDesignIndex(library), /safe project-relative/u);
  const outside = await mkdtemp(join(tmpdir(), 'storyweave-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'image.png'), 'outside');
  await symlink(join(outside, 'image.png'), join(root, 'images', 'outside.png'));
  await writeFile(path, JSON.stringify({ ...source, pages: [{ ...source.pages[0], path: 'images/outside.png' }, source.pages[1]] }));
  await assert.rejects(buildDesignIndex(library), /escapes/u);
});

test('public index build/check catches metadata drift and search exposes complete context', async (t) => {
  const { library, source } = await example(t);
  const script = new URL('../../scripts/index-design-library.mjs', import.meta.url).pathname;
  await execute(process.execPath, [script, 'build', '--root', library]);
  await execute(process.execPath, [script, 'check', '--root', library]);
  const result = await execute(process.execPath, [script, 'search', '--root', library, '--tags', 'process']);
  assert.equal(JSON.parse(result.stdout)[0].pages.length, 2);
  await writeFile(join(library, 'cases', 'example', 'source.json'), JSON.stringify({ ...source, title: 'Changed title' }));
  await assert.rejects(execute(process.execPath, [script, 'check', '--root', library]), /stale/u);
  await assert.rejects(selectReferences(library, [{ case_id: 'example', page_id: 'a', purpose: 'layout' }]), /stale/u);
});

test('reference capture refuses a linked destination instead of writing outside its project', async (t) => {
  const { root, library } = await example(t);
  const project = join(root, 'project');
  const outside = join(root, 'outside');
  await mkdir(project); await mkdir(outside);
  await symlink(outside, join(project, 'references'));
  await assert.rejects(selectReferences(library, [{ case_id: 'example', page_id: 'a', purpose: 'layout' }], { projectRoot: project }), /must stay/u);
});
