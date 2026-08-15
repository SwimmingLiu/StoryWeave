import { createHash } from 'node:crypto';
import { copyFile, readFile, stat, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { writeJsonAtomic } from './storage.mjs';

const MANIFEST = 'asset_manifest.json';

async function manifest(root) {
  return JSON.parse(await readFile(join(root, MANIFEST), 'utf8'));
}

function dimensions(bytes, extension) {
  if (extension === '.png' && bytes.length >= 24 && bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  return {};
}

function warningsFor(asset) {
  const warnings = [];
  if (['search', 'generated'].includes(asset.source) && !asset.license) {
    warnings.push({ code: 'asset.license.missing', severity: 'warning', asset_id: asset.id, message: 'License metadata is missing.' });
  }
  if (asset.source === 'generated' && asset.fact_bearing) {
    warnings.push({ code: 'asset.generated.fact_bearing', severity: 'blocking', asset_id: asset.id, message: 'Generated imagery cannot carry factual evidence.' });
  }
  return warnings;
}

export async function addAsset(root, filePath, options = {}) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Asset file not found: ${filePath}`);
  }
  const bytes = await readFile(filePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const extension = extname(filePath).toLowerCase() || '.bin';
  const registry = await manifest(root);
  const duplicate = registry.assets.find((item) => item.sha256 === sha256);
  if (duplicate) return { asset: duplicate, warnings: warningsFor(duplicate), deduplicated: true };

  const relativePath = `media/${sha256}${extension}`;
  await copyFile(filePath, join(root, relativePath));
  const size = dimensions(bytes, extension);
  const asset = {
    id: options.id || `asset-${sha256.slice(0, 12)}`,
    path: relativePath,
    source: options.source || 'user',
    purpose: options.purpose || basename(filePath),
    fact_bearing: Boolean(options.fact_bearing),
    sha256,
    original_name: basename(filePath),
    ...(size.width ? { ...size, aspect_ratio: Number((size.width / size.height).toFixed(4)) } : {}),
    ...(options.alt ? { alt: options.alt } : {}),
    ...(options.license ? { license: options.license } : {}),
    ...(options.source_url ? { source_url: options.source_url } : {}),
    ...(options.generation ? { generation: options.generation } : {}),
  };
  registry.assets.push(asset);
  await writeJsonAtomic(join(root, MANIFEST), registry);
  return { asset, warnings: warningsFor(asset), deduplicated: false };
}

export function registerGeneratedAsset(root, filePath, options = {}) {
  return addAsset(root, filePath, {
    ...options,
    source: 'generated',
    generation: {
      provider: options.provider || 'host',
      model: options.model || 'unspecified',
      prompt: options.prompt || '',
      generated_at: options.generated_at || new Date().toISOString(),
    },
  });
}

export async function listAssets(root) {
  return (await manifest(root)).assets;
}

export async function removeAsset(root, id) {
  const registry = await manifest(root);
  const asset = registry.assets.find((item) => item.id === id);
  if (!asset) return false;
  registry.assets = registry.assets.filter((item) => item.id !== id);
  await writeJsonAtomic(join(root, MANIFEST), registry);
  if (asset.path?.startsWith('media/')) {
    await unlink(join(root, asset.path)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  return true;
}
