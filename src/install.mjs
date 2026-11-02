#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { access, cp, mkdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const exists = (path) => access(path).then(() => true, () => false);

try {
  const root = resolve(flag('--dir') ?? join(homedir(), '.agents', 'skills'));
  const destination = join(root, basename(source));
  if (await exists(destination) && await realpath(destination) === await realpath(source)) throw new Error('This Skill is already running from the requested installation directory.');
  if (await exists(destination) && !args.includes('--force')) throw new Error(`Destination exists: ${destination}. Use --force to replace it.`);
  const manifest = JSON.parse(await readFile(join(source, 'runtime', 'source-manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    if (!entry.path || entry.path.startsWith('/') || entry.path.split(/[\\/]/u).includes('..')) throw new Error('Invalid packaged runtime path.');
    const bytes = await readFile(join(source, entry.path));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Packaged source was modified: ${entry.path}`);
  }
  console.log(destination);
  if (!args.includes('--dry-run')) {
    await mkdir(root, { recursive: true });
    const temporary = join(root, `.${basename(source)}.install-${randomUUID()}`);
    let backup;
    try {
      await cp(source, temporary, { recursive: true, filter: (path) => !relative(source, path).split(/[\\/]/u).some((part) => ['node_modules', '.DS_Store', 'tests'].includes(part)) });
      // Copy first so a failed update cannot remove the user's installed Skill.
      if (await exists(destination)) {
        backup = join(root, `.${basename(source)}.backup-${randomUUID()}`);
        await rename(destination, backup);
      }
      try { await rename(temporary, destination); }
      catch (error) { if (backup) await rename(backup, destination); throw error; }
      if (backup) console.log(`Previous installation preserved at ${backup}`);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
