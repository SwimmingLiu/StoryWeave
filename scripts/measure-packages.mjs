#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['storyweave-html', 'storyweave-imagegen', 'storyweave-express', 'storyweave'];
const omitted = new Set(['node_modules', 'tests', '.DS_Store']);
const runtimeRoots = new Set(['scripts', 'runtime', 'schemas', 'contracts', 'assets']);

async function files(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (omitted.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path, base));
    else if (entry.isFile()) result.push({ path: relative(base, path), bytes: (await stat(path)).size });
    else throw new Error(`Package measurements require regular files: ${path}`);
  }
  return result;
}

const skills = [];
for (const name of names) {
  const inventory = await files(join(root, 'skills', name));
  const groups = { core: 0, bento: 0, bento_assets: 0, other_runtime: 0, contracts: 0, schemas: 0, scripts: 0, other_assets: 0, installer: 0, authoring_examples: 0, documentation: 0 };
  for (const file of inventory) {
    const path = file.path;
    const group = path.startsWith('assets/examples/') ? 'authoring_examples'
      : path.startsWith('runtime/core/') ? 'core'
      : path.startsWith('runtime/bento/') ? 'bento'
      : path.startsWith('assets/bento/') ? 'bento_assets'
      : path.startsWith('runtime/') ? 'other_runtime'
      : path.startsWith('contracts/') ? 'contracts'
      : path.startsWith('schemas/') ? 'schemas'
      : path.startsWith('scripts/') ? 'scripts'
      : path.startsWith('assets/') ? 'other_assets'
      : path === 'install.mjs' ? 'installer' : 'documentation';
    groups[group] += file.bytes;
  }
  const runtime = inventory.filter((file) => (file.path === 'install.mjs' || runtimeRoots.has(file.path.split('/')[0])) && !file.path.startsWith('assets/examples/'));
  // Draft reads content-v4.example.json at runtime; its name does not make it optional authoring material.
  const previousScope = runtime.filter((file) => !file.path.split('/').some((part) => part.includes('.example.')));
  skills.push({ name, runtime_bytes: runtime.reduce((sum, file) => sum + file.bytes, 0), previous_scope_bytes: previousScope.reduce((sum, file) => sum + file.bytes, 0), installable_bytes: inventory.reduce((sum, file) => sum + file.bytes, 0), groups });
}
console.log(JSON.stringify({ schema_version: 1, unit: 'file-content bytes; no filesystem allocation overhead', exclusions: ['node_modules', 'tests', '.DS_Store'], runtime_scope: 'installer, CLI, generated modules, schemas, contracts and assets required at runtime; includes draft templates; excludes assets/examples and documentation', installable_scope: 'all files copied by the installer before third-party dependencies', skills, totals: Object.fromEntries(['runtime_bytes', 'previous_scope_bytes', 'installable_bytes'].map((key) => [key, skills.reduce((sum, skill) => sum + skill[key], 0)])) }, null, 2));
