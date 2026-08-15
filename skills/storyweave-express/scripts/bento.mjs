import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const BLOCK = /(<script\b(?=[^>]*\btype=["']application\/bento\+json["'])(?=[^>]*\bid=["']bento-doc["'])[^>]*>)([\s\S]*?)(<\/script>)/gi;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function match(html) {
  const matches = [...String(html).matchAll(BLOCK)];
  if (matches.length !== 1) throw new Error(`Expected exactly one #bento-doc block, found ${matches.length}.`);
  return matches[0];
}

export function parseBentoDocument(html) {
  const document = JSON.parse(match(html)[2]);
  if (document.format !== 'bento/slides' || document.version !== 1) throw new Error('Unsupported Bento document.');
  return document;
}

export function spliceBentoDocument(shell, document, previous = null) {
  if (document.format !== 'bento/slides' || document.version !== 1) throw new Error('Invalid Bento document.');
  if (previous?.docId && previous.docId !== document.docId) throw new Error('Existing Bento docId must be preserved.');
  const found = match(shell);
  const body = JSON.stringify(document, null, 2).replaceAll('<', '\\u003c');
  return `${shell.slice(0, found.index)}${found[1]}${body}${found[3]}${shell.slice(found.index + found[0].length)}`;
}

export async function imageDataUri(path) {
  const extension = extname(path).toLowerCase();
  if (!MIME[extension]) throw new Error(`Unsupported slide image: ${path}`);
  const bytes = await readFile(path);
  if (!bytes.length) throw new Error(`Empty slide image: ${path}`);
  return `data:${MIME[extension]};base64,${bytes.toString('base64')}`;
}

export function buildBentoDocument(manifest, images, previous = null) {
  const width = Number(manifest.canvas?.width ?? 1280);
  const height = Number(manifest.canvas?.height ?? 720);
  return {
    ...(previous ?? {}), format: 'bento/slides', version: 1,
    ...(previous?.docId ? { docId: previous.docId } : {}),
    title: manifest.title, size: { width, height },
    theme: { background: '#000000', color: '#FFFFFF', accent: '#FFFFFF', fontFamily: 'system-ui' },
    slides: manifest.slides.map((slide, index) => ({
      id: slide.id, name: slide.role ?? `slide-${index + 1}`, background: '#000000', transition: index ? 'fade' : 'none', notes: slide.notes ?? slide.claim ?? '',
      elements: [{ id: `${slide.id}-page`, type: 'image', x: 0, y: 0, w: width, h: height, rotation: 0, opacity: 1, src: images[index], fit: 'fill', radius: 0 }],
    })),
    assets: {},
    meta: { ...(previous?.meta ?? {}), generator: 'storyweave-express', source_producer: manifest.producer, source_kind: manifest.kind, source_format: manifest.format },
  };
}

export function validateOutputManifest(manifest) {
  const findings = [];
  if (manifest?.format !== 'storyweave/slides' || manifest?.version !== 1) findings.push({ severity: 'blocking', code: 'manifest.format', message: 'Expected storyweave/slides version 1.' });
  if (!['html', 'image'].includes(manifest?.kind)) findings.push({ severity: 'blocking', code: 'manifest.kind', message: 'Manifest kind must be html or image.' });
  if (!Array.isArray(manifest?.slides) || !manifest.slides.length) findings.push({ severity: 'blocking', code: 'manifest.slides', message: 'Manifest needs at least one slide.' });
  for (const slide of manifest?.slides ?? []) if (!slide.id || !slide.source) findings.push({ severity: 'blocking', code: 'manifest.slide', message: 'Every slide needs id and source.' });
  return { valid: findings.length === 0, findings };
}
