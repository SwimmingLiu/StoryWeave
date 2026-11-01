#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesignIndex, readDesignLibrary, searchCases } from '../src/design-library/library.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const position = args.indexOf(name); return position < 0 ? fallback : args[position + 1]; };
const root = resolve(option('--root', join(repository, 'design-library')));

try {
  const command = args[0] ?? 'build';
  if (command === 'build' || command === 'check') {
    const expected = `${JSON.stringify(await buildDesignIndex(root), null, 2)}\n`;
    if (command === 'check') {
      if (await readFile(join(root, 'index.json'), 'utf8') !== expected) throw new Error('Design index is stale. Run index-design-library.mjs build.');
      console.log('Design index matches case metadata.');
    } else {
      await writeFile(join(root, 'index.json'), expected);
      console.log(join(root, 'index.json'));
    }
  } else if (command === 'search') {
    const index = await readDesignLibrary(root);
    const results = searchCases(index, { tags: option('--tags', '').split(',').filter(Boolean), role: option('--role'), audience: option('--audience'), density: option('--density') });
    console.log(JSON.stringify(results, null, 2));
  } else if (command === 'inspect') {
    const index = await readDesignLibrary(root);
    const item = index.cases.find((entry) => entry.id === args[1]);
    if (!item) throw new Error(`Unknown design case: ${args[1] ?? 'missing'}.`);
    console.log(JSON.stringify({ ...item, analysis: await readFile(join(root, item.analysis_path), 'utf8') }, null, 2));
  } else if (['help', '--help', '-h'].includes(command)) console.log('index-design-library.mjs build|check|search|inspect [case-id] [--root path] [--tags a,b] [--role role] [--audience audience] [--density level]');
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
