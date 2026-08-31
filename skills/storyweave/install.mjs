#!/usr/bin/env node
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const exists = async (path) => stat(path).then(() => true, () => false);

async function detectRoot() {
  if (flag('--dir')) return flag('--dir');
  const candidates = [
    process.env.CODEX_HOME && join(process.env.CODEX_HOME, 'skills'),
    join(homedir(), '.agents', 'skills'),
    join(homedir(), '.claude', 'skills'),
  ].filter(Boolean);
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return candidates[0];
}

try {
  const root = await detectRoot();
  const destination = join(root, basename(source));
  console.log(destination);
  if (args.includes('--dry-run')) process.exit(0);
  if (await exists(destination)) {
    if (!args.includes('--force')) throw new Error(`Destination exists: ${destination}. Use --force to replace it.`);
    await rm(destination, { recursive: true, force: true });
  }
  await mkdir(root, { recursive: true });
  await cp(source, destination, { recursive: true, filter: (path) => !path.includes('/node_modules/') && !path.endsWith('/.DS_Store') });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
