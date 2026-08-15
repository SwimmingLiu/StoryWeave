import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { addAsset, listAssets, registerGeneratedAsset, removeAsset } from '../scripts/lib/assets.mjs';

const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ppt-assets-'));
  await mkdir(join(root, 'media'));
  await writeFile(join(root, 'asset_manifest.json'), JSON.stringify({ schema_version: 1, assets: [] }));
  const source = join(root, 'source.png');
  await writeFile(source, png1x1);
  return { root, source };
}

test('imports files, records aspect metadata, and deduplicates content hashes', async () => {
  const { root, source } = await fixture();
  const first = await addAsset(root, source, { purpose: 'Product view', source: 'user' });
  const second = await addAsset(root, source, { purpose: 'Duplicate' });
  assert.equal(first.asset.id, second.asset.id);
  assert.equal(first.asset.width, 1);
  assert.equal(first.asset.height, 1);
  assert.equal(first.asset.aspect_ratio, 1);
  assert.equal((await listAssets(root)).length, 1);
});

test('warns when non-user imagery lacks license metadata', async () => {
  const { root, source } = await fixture();
  const result = await addAsset(root, source, { purpose: 'Search result', source: 'search' });
  assert.ok(result.warnings.some((item) => item.code === 'asset.license.missing'));
});

test('records provider-neutral generation provenance and fact-bearing policy', async () => {
  const { root, source } = await fixture();
  const result = await registerGeneratedAsset(root, source, {
    purpose: 'Conceptual hero',
    prompt: 'Abstract workflow, no text',
    provider: 'host-imagegen',
    model: 'unspecified',
    fact_bearing: false,
  });
  assert.equal(result.asset.source, 'generated');
  assert.equal(result.asset.generation.provider, 'host-imagegen');
  assert.equal(result.asset.fact_bearing, false);
});

test('rejects nonexistent files and removes registry plus managed media', async () => {
  const { root, source } = await fixture();
  await assert.rejects(() => addAsset(root, join(root, 'missing.png'), {}), /not found/i);
  const { asset } = await addAsset(root, source, { purpose: 'Temporary' });
  assert.equal(await removeAsset(root, asset.id), true);
  assert.deepEqual(await listAssets(root), []);
  const manifest = JSON.parse(await readFile(join(root, 'asset_manifest.json'), 'utf8'));
  assert.equal(manifest.assets.length, 0);
});
