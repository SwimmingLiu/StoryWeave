import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateReview, pageAxes, readCalibration, verifyPacket } from '../scripts/visual-review.mjs';

const skill = dirname(dirname(fileURLToPath(import.meta.url)));
const calibration = await readCalibration();
const example = calibration.cases[0];
const packet = { fingerprint: 'reviewed-packet', origin: 'retained-browser-evidence', files: [{ path: 'A.png', sha256: example.before.sha256 }, { path: 'B.png', sha256: example.candidate.sha256 }], items: [{ id: 'editorial/s06', kind: 'page', axes: pageAxes, images: { A: ['A.png'], B: ['B.png'] } }] };
const key = { candidates: { 'editorial/s06': 'B' } };
function review() {
  return { schema_version: 1, packet_fingerprint: packet.fingerprint, reviewer: { name: 'Test reviewer', kind: 'human', familiarity: 'Known calibration fixture; no claim of independent blindness' }, items: [{ id: 'editorial/s06', inspected: ['A', 'B'], axes: Object.fromEntries(pageAxes.map((axis) => [axis, { preferred: 'tie', observation: 'Both actual captures retain this evaluated property.' }])), slop: { findings: [], observation: 'No additional decorative filler is asserted by this test.' } }] };
}

test('zero technical findings cannot override the exact user-rejected visual example', () => {
  const input = review();
  for (const value of Object.values(input.items[0].axes)) value.preferred = 'B';
  const result = evaluateReview(packet, key, input, calibration);
  assert.equal(result.status, 'regressed');
  assert.equal(result.release_ready, false);
  assert.equal(result.improvement_claim, false);
  assert.equal(result.items[0].user_vetoes[0].authority, 'explicit-user-feedback');
});

test('an improvement on four axes cannot average away one worse relationship', () => {
  const input = review();
  for (const value of Object.values(input.items[0].axes)) value.preferred = 'B';
  input.items[0].axes.relationships.preferred = 'A';
  const result = evaluateReview(packet, key, input, { cases: [] });
  assert.equal(result.status, 'regressed');
  assert.deepEqual(result.items[0].losses, ['relationships']);
});

test('equal versions are unchanged and do not establish an improvement claim', () => {
  const result = evaluateReview(packet, key, review(), { cases: [] });
  assert.equal(result.status, 'accepted');
  assert.equal(result.items[0].verdict, 'unchanged');
  assert.equal(result.improvement_claim, false);
});

test('a supported gain with no losses establishes improvement', () => {
  const input = review(); input.items[0].axes.reading.preferred = 'B';
  const result = evaluateReview(packet, key, input, { cases: [] });
  assert.equal(result.status, 'accepted');
  assert.equal(result.improvement_claim, true);
});

test('missing pages and uncertain judgments stay unreviewed', () => {
  const input = review(); input.items = [];
  assert.equal(evaluateReview(packet, key, input, { cases: [] }).status, 'needs-review');
  const uncertain = review(); uncertain.items[0].axes.meaning.preferred = 'uncertain';
  assert.equal(evaluateReview(packet, key, uncertain, { cases: [] }).status, 'needs-review');
});

test('inspection of only one side and unexplained choices are rejected', () => {
  const input = review(); input.items[0].inspected = ['B'];
  assert.throws(() => evaluateReview(packet, key, input, { cases: [] }), /Both actual/);
  const empty = review(); empty.items[0].axes.composition.observation = '';
  assert.throws(() => evaluateReview(packet, key, empty, { cases: [] }), /actual visual evidence/);
});

test('missing axes and duplicate or unrelated pages cannot satisfy coverage', () => {
  const input = review(); delete input.items[0].axes.specificity;
  assert.throws(() => evaluateReview(packet, key, input, { cases: [] }), /required visual axis/);
  const duplicate = review(); duplicate.items.push(duplicate.items[0]);
  assert.throws(() => evaluateReview(packet, key, duplicate, { cases: [] }), /Duplicate/);
  const unknown = review(); unknown.items[0].id = 'unknown';
  assert.throws(() => evaluateReview(packet, key, unknown, { cases: [] }), /unknown/);
});

test('blocking visual filler cannot be hidden by a tie on other axes', () => {
  const input = review(); input.items[0].slop.findings.push({ pattern: 'unrelated visual', side: 'B', severity: 'blocking', observation: 'The illustration gives no evidence for the approved claim.' });
  assert.equal(evaluateReview(packet, key, input, { cases: [] }).status, 'regressed');
});

test('review of a different screenshot packet is stale', () => {
  const input = review(); input.packet_fingerprint = 'older-packet';
  assert.throws(() => evaluateReview(packet, key, input, { cases: [] }), /another packet/);
});

test('changing actual screenshot bytes invalidates the retained evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'storyweave-visual-review-'));
  try {
    const path = join(directory, 'A.png');
    await copyFile(join(skill, 'fixtures', example.before.path), path);
    const mapping = { candidates: {}, inputs: [] };
    const keyBytes = Buffer.from(JSON.stringify(mapping));
    await writeFile(join(directory, 'key.json'), keyBytes);
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const body = { schema_version: 1, key_sha256: digest(keyBytes), files: [{ path: 'A.png', sha256: digest(await readFile(path)) }], items: [] };
    await writeFile(join(directory, 'packet.json'), JSON.stringify({ ...body, fingerprint: digest(JSON.stringify(body)) }));
    await verifyPacket(join(directory, 'packet.json'));
    await writeFile(path, 'changed pixels');
    await assert.rejects(verifyPacket(join(directory, 'packet.json')), /screenshot changed/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
