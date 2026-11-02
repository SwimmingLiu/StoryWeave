import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import test from 'node:test';
import {
  BENTO_ASSET_NAME,
  BENTO_BUNDLED_ASSET_NAME,
  BENTO_RELEASE_API,
  bentoStatus,
  inspectBentoShell,
  readBentoShell,
  resolveBentoShell,
  updateBento,
} from '../../src/bento/shell.mjs';

const official = await readFile(new URL('../../vendor/bento/Bento_Slides.bento.html', import.meta.url));
const source = JSON.parse(await readFile(new URL('../../vendor/bento/SOURCE.json', import.meta.url), 'utf8'));
const packed = brotliCompressSync(official);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-bento-shell-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillRoot = join(root, 'skill');
  const cacheDir = join(root, 'cache');
  const assets = join(skillRoot, 'assets/bento');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, BENTO_BUNDLED_ASSET_NAME), packed);
  await writeFile(join(assets, 'SOURCE.json'), JSON.stringify(source));
  return { root, skillRoot, cacheDir, assets, bundledPath: join(assets, BENTO_BUNDLED_ASSET_NAME) };
}

test('Brotli shell restores the exact official bytes and reports stored and decoded sizes', async (t) => {
  const { bundledPath } = await fixture(t);
  const loaded = await readBentoShell(bundledPath);
  assert.deepEqual(Buffer.from(loaded.html), official);
  assert.equal(loaded.sha256, source.sha256);
  assert.equal(loaded.bytes, official.length);
  assert.equal(loaded.stored_bytes, packed.length);
  assert(loaded.stored_bytes < loaded.bytes);
  assert.equal(loaded.compression, 'br');
  assert.equal(loaded.format, 'bento/slides');
  assert.equal(loaded.document_present, false);
  const inspected = await inspectBentoShell(bundledPath);
  assert(!Object.hasOwn(inspected, 'html'), 'Status must not print the full runtime HTML');
  const { html, ...metadata } = loaded;
  assert.deepEqual(inspected, metadata);
});

test('offline bundle selection and status verify the restored official identity', async (t) => {
  const { skillRoot, cacheDir, bundledPath } = await fixture(t);
  let requests = 0;
  const selected = await resolveBentoShell({ skillRoot, cacheDir, update: 'off', fetchImpl: async () => { requests += 1; throw new Error('Unexpected network request'); } });
  assert.equal(selected.path, bundledPath);
  assert.equal(selected.source, 'bundled');
  assert.equal(selected.sha256, source.sha256);
  assert.equal(selected.compression, 'br');
  assert.equal(selected.update_status, 'disabled-bundled');
  assert.equal(requests, 0);
  const status = await bentoStatus({ skillRoot, cacheDir });
  assert.equal(status.bundled.sha256, source.sha256);
  assert.equal(status.bundled.stored_bytes, packed.length);
  assert.equal(status.cached, null);
});

test('corrupt and truncated bundles fail without using an uncompressed sibling', async (t) => {
  const { skillRoot, cacheDir, assets, bundledPath } = await fixture(t);
  await writeFile(join(assets, BENTO_ASSET_NAME), official);
  for (const invalid of [Buffer.from('not a Brotli runtime'), packed.subarray(0, 16)]) {
    await writeFile(bundledPath, invalid);
    await assert.rejects(readBentoShell(bundledPath));
    await assert.rejects(resolveBentoShell({ skillRoot, cacheDir, update: 'off' }));
    await assert.rejects(bentoStatus({ skillRoot, cacheDir }));
  }
});

test('validly recompressed modifications cannot inherit the official source identity', async (t) => {
  const { skillRoot, cacheDir, bundledPath, assets } = await fixture(t);
  const changed = Buffer.concat([official, Buffer.from('\n<!-- changed runtime -->')]);
  await writeFile(bundledPath, brotliCompressSync(changed));
  assert.equal((await inspectBentoShell(bundledPath)).sha256, hash(changed));
  await assert.rejects(resolveBentoShell({ skillRoot, cacheDir, update: 'off' }), /official source SHA-256/u);
  await assert.rejects(bentoStatus({ skillRoot, cacheDir }), /official source SHA-256/u);
  await writeFile(bundledPath, packed);
  await writeFile(join(assets, 'SOURCE.json'), '{}');
  await assert.rejects(resolveBentoShell({ skillRoot, cacheDir, update: 'off' }), /official source SHA-256/u);
});

test('explicit uncompressed HTML remains independent of bundled resources and updates', async (t) => {
  const { root, skillRoot, cacheDir, bundledPath } = await fixture(t);
  await rm(bundledPath);
  const explicitPath = join(root, 'explicit.html');
  const html = '<!doctype html><script type="application/bento+json" id="bento-doc">{"format":"bento/slides","version":1,"slides":[]}</script>';
  await writeFile(explicitPath, html);
  let requests = 0;
  const selected = await resolveBentoShell({ skillRoot, cacheDir, explicitPath, fetchImpl: async () => { requests += 1; throw new Error('Unexpected network request'); } });
  assert.equal(selected.source, 'explicit');
  assert.equal(selected.update_status, 'skipped');
  assert.equal(selected.path, explicitPath);
  assert.equal(selected.compression, 'none');
  assert.equal(selected.stored_bytes, Buffer.byteLength(html));
  assert.equal((await readBentoShell(explicitPath)).html, html);
  assert.equal(requests, 0);
});

test('verified plain HTML cache remains preferred with updates disabled or a fresh release', async (t) => {
  const { skillRoot, cacheDir } = await fixture(t);
  await mkdir(cacheDir);
  const cached = Buffer.concat([official, Buffer.from('\n<!-- verified cached release -->')]);
  const path = join(cacheDir, BENTO_ASSET_NAME);
  await writeFile(path, cached);
  await writeFile(join(cacheDir, 'release.json'), JSON.stringify({ release_tag: 'cached-release', sha256: hash(cached), checked_at: new Date().toISOString() }));
  const offline = await resolveBentoShell({ skillRoot, cacheDir, update: 'off' });
  assert.equal(offline.path, path);
  assert.equal(offline.source, 'cache-offline');
  assert.equal(offline.sha256, hash(cached));
  assert.equal(offline.compression, 'none');
  let requests = 0;
  const fresh = await resolveBentoShell({ skillRoot, cacheDir, fetchImpl: async () => { requests += 1; throw new Error('Unexpected network request'); } });
  assert.equal(fresh.path, path);
  assert.equal(fresh.source, 'cache');
  assert.equal(fresh.update_status, 'cached');
  assert.equal(requests, 0);
  const status = await bentoStatus({ skillRoot, cacheDir });
  assert.equal(status.cached.trusted, true);
  assert.equal(status.cached.sha256, hash(cached));
});

test('invalid cache and unavailable updates fall back to the verified compressed bundle', async (t) => {
  const { skillRoot, cacheDir, bundledPath } = await fixture(t);
  await mkdir(cacheDir);
  const invalidCache = Buffer.concat([official, Buffer.from('\n<!-- unverified cache change -->')]);
  const path = join(cacheDir, BENTO_ASSET_NAME);
  await writeFile(path, invalidCache);
  await writeFile(join(cacheDir, 'release.json'), JSON.stringify({ release_tag: 'stale-release', sha256: source.sha256 }));
  let requests = 0;
  const selected = await resolveBentoShell({ skillRoot, cacheDir, fetchImpl: async () => { requests += 1; throw new Error('Offline fixture'); } });
  assert.equal(selected.path, bundledPath);
  assert.equal(selected.source, 'bundled');
  assert.equal(selected.update_status, 'offline-bundled');
  assert.equal(selected.warning, 'Offline fixture');
  assert.equal(selected.sha256, source.sha256);
  assert.equal(requests, 1);
  assert.deepEqual(await readFile(path), invalidCache);
  assert.equal((await bentoStatus({ skillRoot, cacheDir })).cached.trusted, false);
});

test('release updates still store verified plain HTML under the existing cache filename', async (t) => {
  const { cacheDir } = await fixture(t);
  const download = 'https://example.invalid/releases/Bento_Slides.bento.html';
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url === BENTO_RELEASE_API) return { ok: true, json: async () => ({ tag_name: 'fixture-release', assets: [{ name: BENTO_ASSET_NAME, browser_download_url: download, digest: `sha256:${source.sha256}` }] }) };
    assert.equal(url, download);
    return { ok: true, arrayBuffer: async () => Uint8Array.from(official).buffer };
  };
  const updated = await updateBento({ cacheDir, fetchImpl });
  assert.equal(updated.status, 'installed');
  assert.equal(updated.path, join(cacheDir, BENTO_ASSET_NAME));
  assert.deepEqual(await readFile(updated.path), official);
  assert.equal((await inspectBentoShell(updated.path)).compression, 'none');
  assert.deepEqual(requested, [BENTO_RELEASE_API, download]);
  const reused = await updateBento({ cacheDir, fetchImpl });
  assert.equal(reused.status, 'cached');
  assert.deepEqual(requested, [BENTO_RELEASE_API, download]);
});
