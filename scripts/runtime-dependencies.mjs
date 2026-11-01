#!/usr/bin/env node
import { isBuiltin } from 'node:module';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const dynamicImport = /\bimport(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*\(/gu;

function checkDynamicBoundary(source, path) {
  const imports = [...source.matchAll(dynamicImport)];
  if (!imports.length) return;
  // The application currently has one computed import for resolved third-party dependencies; new dynamic boundaries must be explicit.
  if (path !== 'core/resources.mjs' || imports.length !== 1 || !/^import\s*\(\s*pathToFileURL\(path\)\.href\s*\)/u.test(source.slice(imports[0].index))) {
    throw new Error(`Unsupported dynamic import in ${path}. Use static imports or the core optionalDependency boundary.`);
  }
}

export async function collectRuntimeFiles(sourceRoot, entries) {
  if (typeof vm.SourceTextModule !== 'function') throw new Error('Run the dependency helper with --experimental-vm-modules.');
  if (!Array.isArray(entries) || !entries.length || entries.some((entry) => typeof entry !== 'string' || !entry)) throw new Error('Runtime entries must be nonempty relative module paths.');
  const root = await realpath(sourceRoot);
  const dependencies = new Map();
  const inside = (path) => { const offset = relative(root, path); return !isAbsolute(offset) && offset !== '..' && !offset.startsWith(`..${sep}`); };
  async function locate(path) {
    if (!inside(path)) throw new Error(`Runtime import escapes src: ${path}`);
    const actual = await realpath(path);
    if (!inside(actual) || actual !== path) throw new Error(`Runtime modules must be regular source paths: ${path}`);
    if (!(await stat(path)).isFile() || !['.mjs', '.json'].includes(extname(path))) throw new Error(`Unsupported runtime module: ${path}`);
    return path;
  }
  async function visit(path, visited) {
    if (visited.has(path)) return;
    visited.add(path);
    if (!dependencies.has(path)) {
      const bytes = await readFile(path);
      const paths = [];
      if (extname(path) === '.json') JSON.parse(bytes.toString('utf8'));
      else {
        const source = bytes.toString('utf8');
        const module = new vm.SourceTextModule(source, { identifier: pathToFileURL(path).href });
        checkDynamicBoundary(source, relative(root, path).split(sep).join('/'));
        for (const specifier of module.dependencySpecifiers) {
          if (isBuiltin(specifier)) continue;
          if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw new Error(`Unsupported bare runtime dependency ${specifier} in ${relative(root, path)}.`);
          paths.push(await locate(fileURLToPath(new URL(specifier, pathToFileURL(path)))));
        }
      }
      dependencies.set(path, paths);
    }
    for (const dependency of dependencies.get(path)) await visit(dependency, visited);
  }
  const result = {};
  for (const entry of entries) {
    if (isAbsolute(entry)) throw new Error(`Runtime entry must be relative: ${entry}`);
    const visited = new Set();
    await visit(await locate(resolve(root, entry)), visited);
    result[entry] = [...visited].map((path) => relative(root, path).split(sep).join('/')).sort();
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceRoot, entries] = process.argv.slice(2);
  if (!sourceRoot || !entries) throw new Error('The dependency helper requires a source root and JSON entry list.');
  console.log(JSON.stringify(await collectRuntimeFiles(sourceRoot, JSON.parse(entries))));
}
