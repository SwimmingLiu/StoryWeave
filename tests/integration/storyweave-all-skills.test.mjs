import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { parseBentoDocument, spliceBentoDocument } from '../../src/bento/document.mjs';

const run = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const htmlCli = join(repoRoot, 'skills/storyweave-html/scripts/ppt.mjs');
const imagegenCli = join(repoRoot, 'skills/storyweave-imagegen/scripts/ppt.mjs');
const orchestrator = join(repoRoot, 'skills/storyweave/scripts/orchestrate.mjs');

async function node(script, ...args) {
  return run(process.execPath, [script, ...args], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const kind = Buffer.from(type, 'ascii');
  const body = Buffer.concat([kind, data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), 8 + data.length);
  return chunk;
}

function solidPng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize, 255);
  for (let row = 0; row < height; row += 1) raw[row * rowSize] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function buildHtmlProject() {
  const project = await mkdtemp(join(tmpdir(), 'storyweave-all-html-'));
  await node(htmlCli, 'draft', project, '--theme-ref', 'systems/white-cyan-circuit', '--title', 'HTML 集成测试');
  await node(htmlCli, 'approve', project, '--theme-ref', 'systems/white-cyan-circuit');
  await node(htmlCli, 'build', project);
  const qa = await node(htmlCli, 'qa', project, '--json');
  assert.equal(JSON.parse(qa.stdout).export_ready, true);
  return project;
}

async function buildImagegenProject() {
  const project = await mkdtemp(join(tmpdir(), 'storyweave-all-imagegen-'));
  await node(imagegenCli, 'draft', project, '--schema', '3', '--theme', 'editorial/paper-magazine', '--scope', 'authoring', '--title', 'Imagegen 集成测试');
  await node(imagegenCli, 'approve', project, '--theme', 'editorial/paper-magazine', '--scope', 'authoring');
  await node(imagegenCli, 'prompts', project, '--model', 'integration-test');
  const jobs = (await readFile(join(project, 'imagegen-jobs.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  await mkdir(join(project, 'slides'), { recursive: true });
  const png = solidPng(2048, 1152);
  for (const job of jobs) {
    await writeFile(join(project, job.out), png);
    await node(imagegenCli, 'review', project, '--slide', job.id, '--pass', '--notes', 'Deterministic integration fixture');
  }
  await node(imagegenCli, 'build', project);
  const qa = await node(imagegenCli, 'qa', project, '--json');
  assert.equal(JSON.parse(qa.stdout).export_ready, true);
  return project;
}

async function orchestrate(project) {
  const result = await node(orchestrator, project, '--no-bento-update', '--json');
  const payload = JSON.parse(result.stdout);
  // Legacy and structured producers may have different page counts; delivery follows the manifest.
  const manifest = JSON.parse(await readFile(join(project, 'storyweave-output.json'), 'utf8'));
  assert.equal(payload.producer.slides, manifest.slides.length);
  assert.equal(payload.bento.qa.blocking, 0);
  assert.equal(payload.bento.qa.warning, 0);
  assert.equal(payload.bento.qa.degraded, 0);
  await access(payload.bento.output);
  return payload;
}

test('global StoryWeave orchestrator packages canonical HTML into Bento', async () => {
  const project = await buildHtmlProject();
  const result = await orchestrate(project);
  assert.equal(result.producer.name, 'storyweave-html');
  assert.equal(result.producer.version, 2);
  const bento = await readFile(result.bento.output, 'utf8');
  assert.match(bento, /application\/bento\+json/);
});

test('global StoryWeave orchestrator packages Imagegen output into Bento', async () => {
  const project = await buildImagegenProject();
  const result = await orchestrate(project);
  assert.equal(result.producer.name, 'storyweave-imagegen');
  assert.equal(result.producer.version, 1);
  const bento = await readFile(result.bento.output, 'utf8');
  assert.match(bento, /application\/bento\+json/);
});

test('global Skill documents all three routes and the standard handoff', async () => {
  const skill = await readFile(join(repoRoot, 'skills/storyweave/SKILL.md'), 'utf8');
  assert.match(skill, /storyweave-html/);
  assert.match(skill, /storyweave-imagegen/);
  assert.match(skill, /storyweave-express/);
  // The routing description preserves automatic packaging even when the explanatory prose changes.
  assert.match(skill.match(/^description: (.+)$/mu)?.[1] ?? '', /automatic Bento packaging/);
  assert.match(skill, /storyweave-output\.json/);
});


test('direct Express and global workflow reject the same changed producer artifact', async () => {
  const project = await buildImagegenProject();
  const manifestPath = join(project, 'storyweave-output.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const first = join(project, manifest.slides[0].source);
  await writeFile(first, Buffer.concat([await readFile(first), Buffer.from('changed after QA')]));
  for (const script of [join(repoRoot, 'skills/storyweave-express/scripts/ppt.mjs'), orchestrator]) {
    const parameters = script === orchestrator ? [project, '--no-bento-update', '--json'] : ['build', project, '--no-bento-update'];
    await assert.rejects(node(script, ...parameters), /stale|changed after inspection/i);
  }
});

test('direct packaging preserves producer QA and writes a separate adapter report', async () => {
  const project = await buildImagegenProject();
  const before = await readFile(join(project, 'qa_report.json'), 'utf8');
  const result = await orchestrate(project);
  assert.equal(await readFile(join(project, 'qa_report.json'), 'utf8'), before);
  await access(result.bento.report);
  const report = JSON.parse(await readFile(result.bento.report, 'utf8'));
  assert.equal(report.export_ready, true);
  assert.equal(report.visual_review, 'browser');
});

test('Bento output paths cannot overwrite producer inputs', async () => {
  const project = await buildImagegenProject();
  const entry = join(project, 'index.html');
  const before = await readFile(entry);
  await assert.rejects(node(join(repoRoot, 'skills/storyweave-express/scripts/ppt.mjs'), 'build', project, '--out', entry, '--no-bento-update'), /overwrite a producer/);
  assert.deepEqual(await readFile(entry), before);
});

test('adapter QA rejects transparent full-page images', async () => {
  const project = await buildImagegenProject();
  const result = await orchestrate(project);
  const html = await readFile(result.bento.output, 'utf8');
  const document = parseBentoDocument(html);
  document.slides[0].elements[0].opacity = 0;
  await writeFile(result.bento.output, spliceBentoDocument(html, document, document));
  await assert.rejects(node(join(repoRoot, 'skills/storyweave-express/scripts/ppt.mjs'), 'qa', project, '--file', result.bento.output, '--json'), (error) => {
    const qa = JSON.parse(error.stdout);
    return qa.export_ready === false && qa.findings.some((finding) => finding.code === 'bento.slide_shape');
  });
});
