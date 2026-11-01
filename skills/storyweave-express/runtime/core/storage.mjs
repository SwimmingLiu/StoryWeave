import { rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function writeAtomic(path, value) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, value);
    await rename(temporary, path);
  } catch (error) {
    // Failed writes must not leave temporary copies beside the project source.
    await rm(temporary, { force: true });
    throw error;
  }
}

export function writeJsonAtomic(path, value) {
  return writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextAtomic(path, value) {
  return writeAtomic(path, value);
}

export function writeBytesAtomic(path, bytes) {
  return writeAtomic(path, bytes);
}
