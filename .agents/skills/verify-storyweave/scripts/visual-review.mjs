#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { access, copyFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVerifiedArtifact } from '../../../../src/core/artifact.mjs';

const calibrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/visual-regression.json');
export const pageAxes = ['meaning', 'reading', 'relationships', 'composition', 'specificity'];
export const setAxes = ['coherence', 'rhythm'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const save = (path, data) => writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
const exists = (path) => access(path).then(() => true, () => false);
const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const fingerprint = (value) => hash(JSON.stringify(value));
const substantive = (text) => typeof text === 'string' && text.trim().length > 0 && !/^(TODO|待评|未查看|pending)$/iu.test(text.trim());

export async function readCalibration() {
  const cases = await json(calibrationPath);
  for (const entry of cases.cases) for (const side of ['before', 'candidate']) {
    const image = resolve(dirname(calibrationPath), entry[side].path);
    assert.equal(hash(await readFile(image)), entry[side].sha256, 'The retained user regression example changed');
  }
  return cases;
}

async function verifiedInput(project) {
  const value = await readVerifiedArtifact(project);
  const deck = await json(join(project, 'deck_spec.json'));
  return { root: await realpath(project), binding: value.binding.fingerprint, approved_sha256: hash(await readFile(join(project, 'deck_spec.json'))), revision: deck.revision, deck };
}

// A browser pass proves geometry. This packet preserves actual pixels and approved meaning for a separate judgment.
export async function prepareVisualReview({ directory, projects, origin, sourceFingerprint = null }) {
  assert(origin === 'fresh-browser-drive' || origin === 'retained-browser-evidence', 'Declare whether captures are fresh or retained');
  assert(!(await exists(join(directory, 'packet.json'))), 'Use a new visual-review directory');
  await mkdir(join(directory, 'images'), { recursive: true });
  const seed = randomBytes(16).toString('hex');
  const items = [];
  const files = [];
  const key = { schema_version: 1, candidates: {}, inputs: [] };
  for (const [groupIndex, project] of projects.entries()) {
    const before = await verifiedInput(project.before);
    const candidate = await verifiedInput(project.candidate);
    assert.equal(before.approved_sha256, candidate.approved_sha256, 'Visual comparisons require byte-identical approval');
    assert.equal(before.revision, candidate.revision);
    assert.deepEqual(before.deck.slides.map(({ id }) => id), candidate.deck.slides.map(({ id }) => id));
    const setImages = { before: [], candidate: [] };
    for (const [index, slide] of candidate.deck.slides.entries()) {
      const id = `${project.name}/${slide.id}`;
      const candidateSide = (index + groupIndex + Number.parseInt(seed[0], 16)) % 2 ? 'A' : 'B';
      const images = {};
      for (const [side, input] of [['before', before], ['candidate', candidate]]) {
        const label = side === 'candidate' ? candidateSide : candidateSide === 'A' ? 'B' : 'A';
        const original = join(input.root, 'qa/screenshots', `${slide.id}.png`);
        const bytes = await readFile(original);
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Review actual PNG captures');
        assert.equal(bytes.readUInt32BE(16), 1280);
        assert.equal(bytes.readUInt32BE(20), 720);
        const path = `images/${groupIndex}-${index}-${label}.png`;
        await copyFile(original, join(directory, path));
        files.push({ path, sha256: hash(bytes) });
        images[label] = [path];
        setImages[side].push(path);
      }
      items.push({ id, kind: 'page', style: project.name, viewport: { width: 1280, height: 720 }, axes: pageAxes, content_type: slide.content?.type ?? slide.role, claim: slide.claim, exact_text: slide.exact_text, images });
      key.candidates[id] = candidateSide;
    }
    const setId = `${project.name}/whole-set`;
    const side = groupIndex % 2 ? 'A' : 'B';
    items.push({ id: setId, kind: 'set', style: project.name, axes: setAxes, images: { [side]: setImages.candidate, [side === 'A' ? 'B' : 'A']: setImages.before } });
    key.candidates[setId] = side;
    key.inputs.push({ name: project.name, before: { ...before, deck: undefined }, candidate: { ...candidate, deck: undefined } });
  }
  await save(join(directory, 'key.json'), key);
  const body = { schema_version: 1, origin, source_fingerprint: sourceFingerprint, seed, key_sha256: hash(await readFile(join(directory, 'key.json'))), files, items };
  const packet = { ...body, fingerprint: fingerprint(body) };
  await save(join(directory, 'packet.json'), packet);
  await save(join(directory, 'review-template.json'), { schema_version: 1, packet_fingerprint: packet.fingerprint, reviewer: { name: '', kind: 'agent', familiarity: 'State prior knowledge of these versions; randomized labels are not proof of an independent blind study.' }, items: items.map(({ id, axes }) => ({ id, inspected: [], axes: Object.fromEntries(axes.map((axis) => [axis, { preferred: 'uncertain', observation: '' }])), slop: { findings: [], observation: '' } })) });
  const figures = (paths, label) => `<div class="side"><h3>${label}</h3><div class="${paths.length > 1 ? 'set' : ''}">${paths.map((path) => `<img src="${escape(path)}" alt="${escape(label)}">`).join('')}</div></div>`;
  await writeFile(join(directory, 'review-sheet.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>视觉比较 A/B</title><style>body{margin:24px;background:#e8e7e3;color:#18212d;font:16px system-ui}section{margin:40px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{display:block;width:100%}.set{display:grid;grid-template-columns:1fr 1fr;gap:8px}p{max-width:100ch}</style><h1>视觉比较 A/B</h1><p>按批准主张比较阅读、关系、构图与语义。A/B 随机交替，不给新版本加分。先记录逐页判断，再看整套节奏。</p>${items.map((item) => `<section><h2>${escape(item.id)}</h2><p>${escape(item.claim ?? '同一组页面的层级、节奏与视觉语言')}</p><div class="pair">${figures(item.images.A, 'A')}${figures(item.images.B, 'B')}</div></section>`).join('')}</html>`);
  return { status: 'needs-review', packet: join(directory, 'packet.json'), fingerprint: packet.fingerprint, items: items.length, origin };
}

export async function verifyPacket(packetPath) {
  const directory = dirname(packetPath);
  const packet = await json(packetPath);
  const { fingerprint: stored, ...body } = packet;
  assert.equal(fingerprint(body), stored, 'Visual packet changed');
  const keyBytes = await readFile(join(directory, 'key.json'));
  assert.equal(hash(keyBytes), packet.key_sha256, 'A/B mapping changed');
  const key = JSON.parse(keyBytes);
  for (const file of packet.files) {
    assert(!isAbsolute(file.path) && !file.path.split('/').includes('..'), 'Review assets must stay in the packet');
    assert.equal(hash(await readFile(join(directory, file.path))), file.sha256, `Review screenshot changed: ${file.path}`);
  }
  for (const input of key.inputs) for (const side of ['before', 'candidate']) {
    const current = await verifiedInput(input[side].root);
    assert.equal(current.binding, input[side].binding, 'Reviewed producer artifact is stale');
    assert.equal(current.approved_sha256, input[side].approved_sha256);
  }
  return { packet, key };
}

// Never average away a regression, and never let an agent reverse a user's verdict on the exact same pixels.
export function evaluateReview(packet, key, review, calibration) {
  assert.equal(review.schema_version, 1);
  assert.equal(review.packet_fingerprint, packet.fingerprint, 'Review belongs to another packet');
  assert(substantive(review.reviewer?.name) && ['agent', 'human'].includes(review.reviewer.kind));
  assert(substantive(review.reviewer.familiarity), 'State evaluator familiarity and independence limits');
  const indexed = new Map();
  for (const item of review.items) { assert(!indexed.has(item.id), 'Duplicate visual review'); indexed.set(item.id, item); }
  assert([...indexed.keys()].every((id) => packet.items.some((item) => item.id === id)), 'Review contains unknown pages');
  const results = [];
  for (const item of packet.items) {
    const assessment = indexed.get(item.id);
    if (!assessment) { results.push({ id: item.id, verdict: 'unreviewed', reasons: ['No visual assessment'] }); continue; }
    assert.deepEqual([...assessment.inspected].sort(), ['A', 'B'], 'Both actual versions must be inspected');
    assert.deepEqual(Object.keys(assessment.axes).sort(), [...item.axes].sort(), 'Review every required visual axis');
    const candidate = key.candidates[item.id];
    const losses = [];
    const wins = [];
    let uncertain = false;
    for (const axis of item.axes) {
      const value = assessment.axes[axis];
      assert(['A', 'B', 'tie', 'uncertain'].includes(value.preferred));
      assert(substantive(value.observation), `Explain actual visual evidence for ${item.id}/${axis}`);
      if (value.preferred === 'uncertain') uncertain = true;
      else if (value.preferred === candidate) wins.push(axis);
      else if (value.preferred !== 'tie') losses.push(axis);
    }
    assert(Array.isArray(assessment.slop?.findings) && substantive(assessment.slop.observation), 'Audit visual filler and template signals');
    const slop = assessment.slop.findings.filter((finding) => {
      assert(substantive(finding.pattern) && substantive(finding.observation));
      assert(['A', 'B', 'both'].includes(finding.side) && ['blocking', 'advisory'].includes(finding.severity));
      return finding.severity === 'blocking' && ['both', candidate].includes(finding.side);
    });
    const vetoes = [];
    if (item.kind === 'page') {
      const digest = (label) => packet.files.find((file) => file.path === item.images[label][0]).sha256;
      for (const example of calibration.cases) if (example.id === item.id && digest(candidate) === example.candidate.sha256 && digest(candidate === 'A' ? 'B' : 'A') === example.before.sha256) vetoes.push({ id: example.id, authority: 'explicit-user-feedback', observation: example.observation });
    }
    const verdict = losses.length || slop.length || vetoes.length ? 'regressed' : uncertain ? 'unreviewed' : wins.length ? 'improved' : 'unchanged';
    results.push({ id: item.id, verdict, wins, losses, candidate_side: candidate, slop, user_vetoes: vetoes, assessment });
  }
  const status = results.some(({ verdict }) => verdict === 'regressed') ? 'regressed' : results.some(({ verdict }) => verdict === 'unreviewed') ? 'needs-review' : 'accepted';
  return { schema_version: 1, packet_fingerprint: packet.fingerprint, origin: packet.origin, status, release_ready: status === 'accepted', improvement_claim: status === 'accepted' && results.some(({ verdict }) => verdict === 'improved'), summary: Object.fromEntries(['improved', 'unchanged', 'regressed', 'unreviewed'].map((verdict) => [verdict, results.filter((item) => item.verdict === verdict).length])), reviewer: review.reviewer, items: results, limits: ['Semantic judgments are supplied by the named reviewer, not computed from pixels or geometry.', 'Desktop 1280x720 comparisons; portrait geometry and playback remain separate.', 'Existing producer QA does not prove a new browser session ran in this maintenance pass.'] };
}

export async function recordReview({ packetPath, inputPath, directory }) {
  const { packet, key } = await verifyPacket(packetPath);
  const review = await json(inputPath);
  const result = evaluateReview(packet, key, review, await readCalibration());
  await mkdir(directory, { recursive: true });
  assert(!(await exists(join(directory, 'assessment.json'))), 'Retain the prior assessment; prepare a new run for another candidate');
  await save(join(directory, 'review.json'), review);
  await save(join(directory, 'assessment.json'), { packet_path: relative(directory, packetPath), review_sha256: hash(await readFile(join(directory, 'review.json'))), result });
  return result;
}

export async function readVisualAssessment(directory) {
  if (!(await exists(join(directory, 'assessment.json')))) return { status: 'needs-review', release_ready: false, improvement_claim: false };
  const receipt = await json(join(directory, 'assessment.json'));
  const { packet, key } = await verifyPacket(resolve(directory, receipt.packet_path));
  const bytes = await readFile(join(directory, 'review.json'));
  assert.equal(hash(bytes), receipt.review_sha256, 'Recorded visual review changed');
  const current = evaluateReview(packet, key, JSON.parse(bytes), await readCalibration());
  assert.deepEqual(current, receipt.result, 'Visual verdict changed after recording');
  return current;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const index = args.indexOf(name); assert(index >= 0 && args[index + 1] && !args[index + 1].startsWith('--'), `${name} requires a value`); return resolve(args[index + 1]); };
  if (args[0] === 'prepare') {
    const comparison = flag('--comparison-root');
    return prepareVisualReview({ directory: flag('--out'), projects: ['editorial', 'swiss'].map((name) => ({ name, before: join(comparison, 'before', name), candidate: join(comparison, 'after', name) })), origin: 'retained-browser-evidence' });
  }
  if (args[0] === 'assess') return recordReview({ packetPath: flag('--packet'), inputPath: flag('--input'), directory: flag('--out') });
  if (args[0] === 'report') return readVisualAssessment(flag('--dir'));
  throw new Error('Use prepare --comparison-root PATH --out PATH | assess --packet PATH --input PATH --out PATH | report --dir PATH');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'regressed' ? 1 : result.status === 'needs-review' ? 4 : 0;
  } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
