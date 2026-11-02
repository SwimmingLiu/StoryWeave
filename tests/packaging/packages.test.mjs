import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const names = ['storyweave-html', 'storyweave-imagegen', 'storyweave-express', 'storyweave'];
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const node = (script, args, options = {}) => execute(process.execPath, [script, ...args], { maxBuffer: 8 * 1024 * 1024, ...options });

test('generated Skill runtimes match their canonical sources', async () => {
  await node(join(repo, 'scripts/package-skills.mjs'), ['--check'], { cwd: repo });
});

test('four separately installed Skills run outside the checkout without sibling code', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const working = join(root, 'working');
  await mkdir(working);
  const requireHtml = createRequire(join(repo, 'skills/storyweave-html/scripts/package.json'));
  // The isolated installation supplies a third-party browser dependency explicitly, never repository application modules.
  const dependencyRoot = dirname(dirname(requireHtml.resolve('playwright/package.json')));
  const env = { ...process.env, NODE_PATH: dependencyRoot, STORYWEAVE_BENTO_CACHE_DIR: join(root, 'bento-cache') };
  const options = { cwd: working, env };
  const installed = {};
  const cli = {};
  for (const name of names) {
    const installRoot = join(root, name);
    installed[name] = join(installRoot, name);
    await node(join(repo, 'skills', name, 'install.mjs'), ['--dir', installRoot], options);
    assert.deepEqual(await readdir(installRoot), [name]);
    cli[name] = join(installed[name], 'scripts', name === 'storyweave' ? 'orchestrate.mjs' : 'ppt.mjs');
    const doctor = JSON.parse((await node(cli[name], ['doctor', '--json'], options)).stdout);
    assert(doctor.node.supported);
    const inventory = await json(join(installed[name], 'runtime/source-manifest.json'));
    for (const file of inventory.files) assert.equal(hash(await readFile(join(installed[name], file.path))), file.sha256);
    if (name === 'storyweave' || name === 'storyweave-express') {
      // Independent adapters need producer verification, but must not carry the generators' unused content and theme code.
      assert(!inventory.files.some((file) => ['runtime/core/content.mjs', 'runtime/core/theme-contract.mjs', 'contracts/storyweave-theme/v1/contract.json'].includes(file.path)));
      const bentoAssets = await readdir(join(installed[name], 'assets/bento'));
      assert.deepEqual(bentoAssets.sort(), ['Bento_Slides.bento.html.br', 'SOURCE.json']);
    }
    const entries = await readdir(installed[name]);
    assert(!entries.includes('design-library'), 'A Skill installs only selected reference resources, not the raw case library');
  }
  const html = join(working, 'html');
  await node(cli['storyweave-html'], ['draft', html, '--theme-ref', 'systems/ink-blue-grid'], options);
  const draft = await json(join(html, 'outline_draft.json'));
  draft.slides = draft.slides.filter((slide) => ['comparison', 'metrics'].includes(slide.content.type));
  draft.page_count = draft.slides.length;
  await writeFile(join(html, 'outline_draft.json'), JSON.stringify(draft));
  await node(cli['storyweave-html'], ['approve', html], options);
  await node(cli['storyweave-html'], ['build', html], options);
  const htmlQa = JSON.parse((await node(cli['storyweave-html'], ['qa', html, '--json'], options)).stdout);
  assert(htmlQa.export_ready && htmlQa.visual_review === 'browser' && htmlQa.summary.degraded === 0);

  const image = join(working, 'imagegen');
  await node(cli['storyweave-imagegen'], ['draft', image], options);
  const imageDraft = await json(join(image, 'outline_draft.json'));
  imageDraft.slides = imageDraft.slides.slice(0, 1);
  imageDraft.page_count = 1;
  await writeFile(join(image, 'outline_draft.json'), JSON.stringify(imageDraft));
  await node(cli['storyweave-imagegen'], ['approve', image], options);
  await node(cli['storyweave-imagegen'], ['prompts', image], options);
  await assert.rejects(node(cli['storyweave-imagegen'], ['status', image, '--json'], options), (error) => error.code === 3 && JSON.parse(error.stdout).status === 'needs-images');
  await mkdir(join(image, 'slides'), { recursive: true });
  await cp(join(repo, 'skills/storyweave-html/assets/examples/storyweave-demo/qa/screenshots/s01.png'), join(image, 'slides/s01.png'));
  await node(cli['storyweave-imagegen'], ['review', image, '--slide', 's01', '--pass', '--notes', 'Distribution contract fixture only; no image generation or design-quality claim.'], options);
  await node(cli['storyweave-imagegen'], ['build', image], options);
  const imageQa = JSON.parse((await node(cli['storyweave-imagegen'], ['qa', image, '--json'], options)).stdout);
  assert(imageQa.export_ready && imageQa.summary.blocking === 0);

  const beforeQa = await readFile(join(html, 'qa_report.json'));
  await node(cli['storyweave-express'], ['build', html, '--no-bento-update'], options);
  const adapterQa = JSON.parse((await node(cli['storyweave-express'], ['qa', html, '--json'], options)).stdout);
  assert(adapterQa.export_ready && adapterQa.visual_review === 'browser');
  assert.deepEqual(await readFile(join(html, 'qa_report.json')), beforeQa);
  const delivery = JSON.parse((await node(cli.storyweave, [image, '--no-bento-update', '--json'], options)).stdout);
  assert.equal(delivery.producer.name, 'storyweave-imagegen');
  assert.equal(delivery.bento.qa.blocking, 0);
  assert.equal(delivery.bento.qa.degraded, 0);
  assert.match(await readFile(delivery.bento.output, 'utf8'), /application\/bento\+json/u);
});

test('installer rejects damaged packages before replacement and preserves a forced-install backup', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-installer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source/storyweave');
  const destinationRoot = join(root, 'installed');
  const destination = join(destinationRoot, 'storyweave');
  await cp(join(repo, 'skills/storyweave'), source, { recursive: true, filter: (path) => !relative(join(repo, 'skills/storyweave'), path).split('/').some((part) => ['node_modules', 'tests'].includes(part)) });
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'user-owned.txt'), 'existing installation');
  const modulePath = join(source, 'runtime/core/hash.mjs');
  const original = await readFile(modulePath);
  await writeFile(modulePath, `${original}\n// damaged package\n`);
  await assert.rejects(node(join(source, 'install.mjs'), ['--dir', destinationRoot, '--force']), /Packaged source was modified/u);
  assert.equal(await readFile(join(destination, 'user-owned.txt'), 'utf8'), 'existing installation');
  assert.deepEqual(await readdir(destinationRoot), ['storyweave']);
  await writeFile(modulePath, original);
  await node(join(source, 'install.mjs'), ['--dir', destinationRoot, '--force']);
  const backup = (await readdir(destinationRoot)).find((entry) => entry.startsWith('.storyweave.backup-'));
  assert(backup);
  assert.equal(await readFile(join(destinationRoot, backup, 'user-owned.txt'), 'utf8'), 'existing installation');
  await assert.rejects(node(join(destination, 'install.mjs'), ['--dir', destinationRoot, '--force']), /already running/u);
  const dryRoot = join(root, 'dry-install');
  await node(join(source, 'install.mjs'), ['--dir', dryRoot, '--dry-run']);
  await assert.rejects(readdir(dryRoot), { code: 'ENOENT' });
});
