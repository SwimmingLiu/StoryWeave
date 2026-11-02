#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { outputSchema } from '../src/core/artifact.mjs';
import { contentSchema } from '../src/core/content.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const args = process.argv.slice(2);
const selected = args.includes('--skill') ? args[args.indexOf('--skill') + 1] : null;
const profiles = {
  'storyweave-html': { entry: 'html/cli.mjs', cli: 'ppt.mjs', example: true, visualGuidance: true, dependencies: { playwright: '^1.54.0', pptxgenjs: '^4.0.1' } },
  'storyweave-imagegen': { entry: 'imagegen/cli.mjs', cli: 'ppt.mjs', example: true, visualGuidance: true, dependencies: { playwright: '^1.54.0', pptxgenjs: '^4.0.1' } },
  'storyweave-express': { entry: 'bento/cli.mjs', cli: 'ppt.mjs', bento: true, dependencies: { playwright: '^1.54.0' } },
  storyweave: { entry: 'workflow/cli.mjs', cli: 'orchestrate.mjs', bento: true, visualGuidance: true, dependencies: { playwright: '^1.54.0' } },
};
if (selected && !profiles[selected]) throw new Error(`Unknown Skill: ${selected}`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const changes = [];
const compact = (value) => `${JSON.stringify(value)}\n`;
const activeProfiles = Object.entries(profiles).filter(([name]) => !selected || name === selected);
// Directory copies pulled unused content/theme code into both adapters. Node parses the exact entry closure without executing it.
const graph = JSON.parse((await promisify(execFile)(process.execPath, ['--experimental-vm-modules', '--no-warnings', join(root, 'scripts/runtime-dependencies.mjs'), join(root, 'src'), JSON.stringify(activeProfiles.map(([, profile]) => profile.entry))], { maxBuffer: 4 * 1024 * 1024 })).stdout);
let bento;
if (activeProfiles.some(([, profile]) => profile.bento)) {
  const [raw, provenance] = await Promise.all(['Bento_Slides.bento.html', 'SOURCE.json'].map((file) => readFile(join(root, 'vendor/bento', file))));
  if (hash(raw) !== JSON.parse(provenance.toString('utf8')).sha256) throw new Error('The canonical Bento source differs from its recorded upstream SHA.');
  bento = { raw, provenance, compressed: brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }) };
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (/\.(mjs|json)$/u.test(entry.name)) result.push(path);
  }
  return result.sort();
}

async function emit(path, bytes, source) {
  const current = await readFile(path).catch(() => null);
  if (!current?.equals(Buffer.from(bytes))) {
    changes.push(relative(root, path));
    if (!check) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); }
  }
  return { path, source, sha256: hash(bytes) };
}

for (const [name, profile] of activeProfiles) {
  const skill = join(root, 'skills', name);
  const inventory = [];
  // Standalone producers previously lacked the shared generation guidance that existed only in repository QA notes.
  if (profile.visualGuidance) inventory.push(await emit(join(skill, 'references/visual-generation.md'), await readFile(join(root, 'docs/architecture/visual-generation.md')), 'docs/architecture/visual-generation.md'));
  const needsThemeContract = graph[profile.entry].includes('core/theme-contract.mjs');
  if (needsThemeContract) inventory.push(await emit(join(skill, 'contracts/storyweave-theme/v1/contract.json'), await readFile(join(root, 'contracts/storyweave-theme/v1/contract.json')), 'contracts/storyweave-theme/v1/contract.json'));
  for (const module of graph[profile.entry]) {
    const source = join(root, 'src', module);
    inventory.push(await emit(join(skill, 'runtime', module), await readFile(source), relative(root, source)));
  }
  const wrapper = `#!/usr/bin/env node\n// Runtime copies are generated from src; edit the canonical source and repackage.\nimport { main } from '../runtime/${profile.entry}';\ntry { process.exitCode = await main(process.argv.slice(2)) ?? 0; }\ncatch (error) { console.error(error.message); process.exitCode = 1; }\n`;
  inventory.push(await emit(join(skill, 'scripts', profile.cli), wrapper, 'scripts/package-skills.mjs'));
  inventory.push(await emit(join(skill, 'install.mjs'), await readFile(join(root, 'src/install.mjs')), 'src/install.mjs'));
  const packageJson = { name: `${name}-runtime`, private: true, type: 'module', engines: { node: '>=20' }, scripts: { test: 'node --test ../tests/*.test.mjs', doctor: `node ${profile.cli} doctor --json` }, optionalDependencies: profile.dependencies };
  inventory.push(await emit(join(skill, 'scripts/package.json'), compact(packageJson), 'scripts/package-skills.mjs'));
  if (name !== 'storyweave') inventory.push(await emit(join(skill, 'schemas/storyweave_output.schema.json'), compact(outputSchema()), 'src/core/artifact.mjs#outputSchema'));
  if (profile.example) {
    inventory.push(await emit(join(skill, 'assets/content-v4.example.json'), await readFile(join(root, 'tests/fixtures/visual/outline_v4.json')), 'tests/fixtures/visual/outline_v4.json'));
    inventory.push(await emit(join(skill, 'assets/themes/contract.json'), await readFile(join(root, 'contracts/storyweave-theme/v1/contract.json')), 'contracts/storyweave-theme/v1/contract.json'));
    inventory.push(await emit(join(skill, 'schemas/content_v4.schema.json'), compact(contentSchema()), 'src/core/content.mjs#contentSchema'));
  }
  if (profile.bento) {
    inventory.push(await emit(join(skill, 'assets/bento/Bento_Slides.bento.html.br'), bento.compressed, 'vendor/bento/Bento_Slides.bento.html#brotli-quality-11'));
    inventory.push(await emit(join(skill, 'assets/bento/SOURCE.json'), bento.provenance, 'vendor/bento/SOURCE.json'));
  }
  const manifest = { schema_version: 1, generator: 'scripts/package-skills.mjs', skill: name, files: inventory.map((entry) => ({ path: relative(skill, entry.path), source: entry.source, sha256: entry.sha256 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
  const manifestPath = join(skill, 'runtime/source-manifest.json');
  await emit(manifestPath, compact(manifest), 'scripts/package-skills.mjs');
  const expected = new Set([...inventory.map((entry) => entry.path), manifestPath]);
  for (const path of await files(join(skill, 'runtime')).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error))) {
    if (!expected.has(path)) { changes.push(`${relative(root, path)} (obsolete)`); if (!check) await rm(path); }
  }
  // Removing generated runtime alone left the old uncompressed shell and unused adapter contracts in installations.
  const obsoleteAssets = [
    ...(!needsThemeContract ? ['contracts/storyweave-theme/v1/contract.json'] : []),
    ...(profile.bento ? ['assets/bento/Bento_Slides.bento.html'] : []),
  ];
  for (const asset of obsoleteAssets) {
    const path = join(skill, asset);
    const bytes = await readFile(path).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (!bytes) continue;
    if (asset.endsWith('.html') && !bytes.equals(bento.raw)) throw new Error(`Obsolete Bento source differs from vendor/bento: ${path}. Reconcile it before packaging.`);
    changes.push(`${relative(root, path)} (obsolete)`);
    if (!check) await rm(path);
  }
  if (!check) {
    await chmod(join(skill, 'install.mjs'), 0o755);
    await chmod(join(skill, 'scripts', profile.cli), 0o755);
  }
}
if (check && changes.length) { console.error(`Generated Skill files differ from canonical sources:\n${changes.join('\n')}`); process.exitCode = 1; }
else console.log(JSON.stringify({ mode: check ? 'check' : 'package', changed: changes.length, skills: selected ? [selected] : Object.keys(profiles) }));
