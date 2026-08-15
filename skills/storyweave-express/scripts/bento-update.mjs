import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const BENTO_RELEASE_API = 'https://api.github.com/repos/nyblnet/bento/releases/latest';
export const BENTO_RELEASE_PAGE = 'https://github.com/nyblnet/bento/releases/latest';
export const BENTO_RELEASE_URL = 'https://bento.page/releases/slides/Bento_Slides.bento.html';
export const BENTO_ASSET_NAME = 'Bento_Slides.bento.html';
export const BENTO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const BENTO_BLOCK = /(<script\b(?=[^>]*\btype=["']application\/bento\+json["'])(?=[^>]*\bid=["']bento-doc["'])[^>]*>)([\s\S]*?)(<\/script>)/gi;

function defaultCacheDir() {
  return process.env.STORYWEAVE_BENTO_CACHE_DIR
    || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'storyweave', 'bento');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function exists(path) {
  return access(path).then(() => true, () => false);
}

async function writeBinaryAtomic(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, bytes);
  await rename(temporary, path);
}

async function writeJsonAtomic(path, value) {
  await writeBinaryAtomic(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

function blockMatches(html) {
  return [...String(html).matchAll(BENTO_BLOCK)];
}

export function validateBentoShell(html) {
  const matches = blockMatches(html);
  if (matches.length !== 1) throw new Error(`Expected exactly one Bento document block, found ${matches.length}`);
  const body = matches[0][2].trim();
  if (!body) return { format: 'bento/slides', version: 1, document_present: false };
  let document;
  try { document = JSON.parse(body); } catch (error) { throw new Error(`Bento shell document block is invalid JSON: ${error.message}`); }
  if (document.format !== 'bento/slides') throw new Error(`Bento shell has unsupported format: ${document.format ?? 'missing'}`);
  if (document.version !== 1) throw new Error(`Bento shell has unsupported document version: ${document.version ?? 'missing'}`);
  return { format: document.format, version: document.version, document_present: true };
}

export async function inspectBentoShell(path) {
  const bytes = await readFile(path);
  const shell = bytes.toString('utf8');
  const contract = validateBentoShell(shell);
  return { path: resolve(path), bytes: bytes.length, sha256: sha256(bytes), ...contract };
}

async function trustedCacheInfo(shellPath, metadata) {
  if (!(await exists(shellPath))) return null;
  try {
    const info = await inspectBentoShell(shellPath);
    if (metadata?.sha256 && info.sha256 !== metadata.sha256) return null;
    return info;
  } catch {
    return null;
  }
}

export function parseReleasePayload(payload) {
  const asset = payload?.assets?.find((candidate) => candidate.name === BENTO_ASSET_NAME);
  if (!payload?.tag_name || !asset?.browser_download_url) throw new Error('Latest Bento release has no Bento_Slides.bento.html asset.');
  return {
    release_tag: payload.tag_name,
    release_name: payload.name ?? payload.tag_name,
    published_at: payload.published_at ?? null,
    source_url: asset.browser_download_url,
    release_page: BENTO_RELEASE_PAGE,
    sha256: String(asset.digest ?? '').replace(/^sha256:/i, '') || null,
  };
}

async function request(fetchImpl, url, options, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return fetchImpl(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Bento network request timed out after ${timeoutMs} ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLatestRelease(fetchImpl, timeoutMs) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable; cannot check for Bento updates.');
  const response = await request(fetchImpl, BENTO_RELEASE_API, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'storyweave-html',
    },
  }, timeoutMs);
  if (!response.ok) throw new Error(`Bento release check failed with HTTP ${response.status}.`);
  return parseReleasePayload(await response.json());
}

async function downloadRelease(release, fetchImpl, timeoutMs) {
  const response = await request(fetchImpl, release.source_url, {
    headers: { accept: 'application/octet-stream', 'user-agent': 'storyweave-html' },
  }, timeoutMs);
  if (!response.ok) throw new Error(`Bento download failed with HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (release.sha256 && actualHash !== release.sha256) throw new Error(`Bento download hash mismatch: expected ${release.sha256}, got ${actualHash}.`);
  validateBentoShell(bytes.toString('utf8'));
  return { bytes, sha256: actualHash };
}

export async function updateBento({
  cacheDir = defaultCacheDir(),
  fetchImpl = globalThis.fetch,
  force = false,
  now = Date.now(),
  ttlMs = BENTO_CACHE_TTL_MS,
  timeoutMs = 10_000,
} = {}) {
  const directory = resolve(cacheDir);
  const shellPath = join(directory, BENTO_ASSET_NAME);
  const metadataPath = join(directory, 'release.json');
  const metadata = await readJson(metadataPath);
  const cachedInfo = await trustedCacheInfo(shellPath, metadata);
  const cacheUsable = Boolean(cachedInfo);
  const checkedAt = Date.parse(metadata?.checked_at ?? '') || 0;
  if (!force && cacheUsable && metadata?.release_tag && now - checkedAt < ttlMs) {
    return { status: 'cached', path: shellPath, cache_dir: directory, ...metadata };
  }

  const release = await fetchLatestRelease(fetchImpl, timeoutMs);
  if (!force && cacheUsable && metadata?.sha256 && metadata.sha256 === release.sha256) {
    const refreshed = { ...metadata, ...release, checked_at: new Date(now).toISOString() };
    await writeJsonAtomic(metadataPath, refreshed);
    return { status: 'current', path: shellPath, cache_dir: directory, ...refreshed };
  }

  const downloaded = await downloadRelease(release, fetchImpl, timeoutMs);
  const refreshed = {
    schema_version: 1,
    asset: BENTO_ASSET_NAME,
    ...release,
    sha256: downloaded.sha256,
    checked_at: new Date(now).toISOString(),
    retrieved_at: new Date(now).toISOString(),
  };
  await writeBinaryAtomic(shellPath, downloaded.bytes);
  await writeJsonAtomic(metadataPath, refreshed);
  return { status: metadata?.release_tag ? 'updated' : 'installed', path: shellPath, cache_dir: directory, ...refreshed };
}

export async function resolveBentoShell({
  skillRoot,
  explicitPath = null,
  update = 'auto',
  force = false,
  cacheDir = defaultCacheDir(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  const bundledPath = join(skillRoot, 'assets', 'bento', BENTO_ASSET_NAME);
  if (explicitPath) {
    const info = await inspectBentoShell(explicitPath);
    return { ...info, source: 'explicit', update_status: 'skipped', release_tag: null, source_url: null, checked_at: null, warning: null };
  }

  let updateResult = null;
  let updateError = null;
  if (update !== 'off') {
    try { updateResult = await updateBento({ cacheDir, fetchImpl, force, timeoutMs }); } catch (error) { updateError = error; }
  }

  const candidate = updateResult?.path ?? join(resolve(cacheDir), BENTO_ASSET_NAME);
  if (await exists(candidate)) {
    const cachedMetadata = await readJson(join(resolve(cacheDir), 'release.json'));
    const info = await trustedCacheInfo(candidate, cachedMetadata);
    if (info) return {
      ...info,
      source: updateResult ? 'cache' : 'cache-offline',
      update_status: updateResult?.status ?? 'offline-cache',
      release_tag: updateResult?.release_tag ?? cachedMetadata?.release_tag ?? null,
      source_url: updateResult?.source_url ?? cachedMetadata?.source_url ?? BENTO_RELEASE_URL,
      checked_at: updateResult?.checked_at ?? cachedMetadata?.checked_at ?? null,
      warning: updateError?.message ?? null,
    };
  }

  const info = await inspectBentoShell(bundledPath);
  return {
    ...info,
    source: 'bundled',
    update_status: updateError ? 'offline-bundled' : 'disabled-bundled',
    release_tag: null,
    source_url: BENTO_RELEASE_URL,
    checked_at: null,
    warning: updateError?.message ?? null,
  };
}

export async function bentoStatus({ skillRoot, cacheDir = defaultCacheDir() } = {}) {
  const bundledPath = join(skillRoot, 'assets', 'bento', BENTO_ASSET_NAME);
  const cachedPath = join(resolve(cacheDir), BENTO_ASSET_NAME);
  const metadata = await readJson(join(resolve(cacheDir), 'release.json'));
  const cachedInfo = await trustedCacheInfo(cachedPath, metadata);
  return {
    bundled: await inspectBentoShell(bundledPath),
    cached: cachedInfo ? { ...cachedInfo, ...metadata, trusted: true } : (await exists(cachedPath) ? { path: cachedPath, trusted: false, metadata } : null),
    cache_dir: resolve(cacheDir),
    latest_api: BENTO_RELEASE_API,
    latest_download: BENTO_RELEASE_URL,
  };
}
