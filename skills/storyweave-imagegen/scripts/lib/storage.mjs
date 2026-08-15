import { rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writeJsonAtomic(path, value) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

export async function writeTextAtomic(path, value) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, path);
}
