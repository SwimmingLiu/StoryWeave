#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siblingRoot = resolve(skillRoot, '..');
const expressCli = join(siblingRoot, 'storyweave-express', 'scripts', 'ppt.mjs');

function flag(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasFlag(args, name) { return args.includes(name); }
async function exists(path) { return access(path).then(() => true, () => false); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

function supportedManifest(manifest) {
  if (manifest?.format !== 'storyweave/slides') return false;
  if (manifest.version === 1) return ['storyweave-html', 'storyweave-imagegen'].includes(manifest.producer) && ['html', 'image'].includes(manifest.kind);
  return manifest.version === 2 && manifest.producer === 'storyweave-html' && manifest.kind === 'html';
}

function outputPath(project, manifest, args) {
  const explicit = flag(args, '--out');
  if (explicit) return resolve(explicit);
  const slug = String(manifest.title ?? 'presentation').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-');
  return join(project, 'dist', `${slug || 'presentation'}.bento.html`);
}

async function orchestrate(project, args) {
  const root = resolve(project);
  const manifestPath = join(root, 'storyweave-output.json');
  if (!(await exists(manifestPath))) throw new Error(`Missing producer manifest: ${manifestPath}`);
  const manifest = await readJson(manifestPath);
  if (!supportedManifest(manifest)) throw new Error('Unsupported StoryWeave producer manifest. Expected storyweave/slides version 1 or canonical HTML version 2.');
  const producerQaPath = join(root, 'qa_report.json');
  if (!(await exists(producerQaPath))) throw new Error(`Producer QA report is required before Bento packaging: ${producerQaPath}`);
  const producerQa = await readJson(producerQaPath);
  if (producerQa.export_ready !== true || producerQa.summary?.blocking > 0) throw new Error('Producer QA has not passed; fix the producer output before Bento packaging.');
  if (!Array.isArray(manifest.slides) || !manifest.slides.length) throw new Error('Producer manifest must contain at least one slide.');
  const ids = new Set();
  for (const slide of manifest.slides) {
    if (!slide.id || ids.has(slide.id)) throw new Error(`Producer manifest has a missing or duplicate slide ID: ${slide.id ?? 'missing'}.`);
    ids.add(slide.id);
    if (!slide.source) throw new Error(`Producer manifest slide ${slide.id} has no source path.`);
    if (!(await exists(resolve(root, slide.source)))) throw new Error(`Producer manifest slide ${slide.id} points to a missing source: ${slide.source}.`);
  }
  if (!(await exists(expressCli))) throw new Error(`storyweave-express is not installed beside storyweave: ${expressCli}`);
  const out = outputPath(root, manifest, args);
  const expressArgs = [expressCli, 'build', root, '--out', out];
  if (hasFlag(args, '--no-bento-update')) expressArgs.push('--no-bento-update');
  const built = await run(process.execPath, expressArgs, { maxBuffer: 4 * 1024 * 1024 });
  const qa = await run(process.execPath, [expressCli, 'qa', root, '--file', out, '--json'], { maxBuffer: 4 * 1024 * 1024 });
  const qaReport = JSON.parse(qa.stdout);
  if (!qaReport.export_ready) throw new Error(`Bento QA failed: ${qaReport.findings.map((item) => item.message).join(' ')}`);
  return {
    producer: { name: manifest.producer, kind: manifest.kind, version: manifest.version, project: root, slides: manifest.slides.length },
    bento: { output: out, qa: qaReport.summary, express_stdout: built.stdout.trim() },
  };
}

async function main(args) {
  const raw = args[0] ?? 'orchestrate';
  if (['help', '-h', '--help'].includes(raw)) {
    console.log('Usage: node scripts/orchestrate.mjs orchestrate <producer-project> [--out path] [--no-bento-update] [--json]');
    return 0;
  }
  const explicitCommand = raw === 'orchestrate';
  const project = explicitCommand ? args[1] : args[0];
  if (!project) throw new Error('A producer project directory is required.');
  const result = await orchestrate(project, explicitCommand ? args.slice(2) : args.slice(1));
  console.log(JSON.stringify(result, null, hasFlag(args, '--json') ? 0 : 2));
  return 0;
}

try {
  const code = await main(process.argv.slice(2));
  if (typeof code === 'number') process.exitCode = code;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
