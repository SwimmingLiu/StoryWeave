import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export function resolveSkillRoot(skillName) {
  if (!/^[a-z0-9-]+$/u.test(skillName)) throw new Error(`Invalid Skill name: ${skillName}`);
  const sourcePackage = join(packageRoot, 'skills', skillName);
  if (existsSync(join(sourcePackage, 'SKILL.md'))) return sourcePackage;
  // Bundled adapters can run inside a differently named workflow package.
  if (existsSync(join(packageRoot, 'SKILL.md'))) return packageRoot;
  throw new Error(`Cannot locate ${skillName} resources from ${packageRoot}.`);
}

export async function optionalDependency(name, skillName) {
  const require = createRequire(join(resolveSkillRoot(skillName), 'scripts', 'package.json'));
  let path;
  try { path = require.resolve(name); }
  catch (error) {
    const installed = require.resolve.paths(name)?.some((directory) => existsSync(join(directory, name)));
    if (error.code === 'MODULE_NOT_FOUND' && !installed) return null;
    throw error;
  }
  // Import errors from an installed dependency are defects, not an absent option.
  return import(pathToFileURL(path).href);
}
