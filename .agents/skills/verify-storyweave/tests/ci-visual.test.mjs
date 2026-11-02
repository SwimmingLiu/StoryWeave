import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assessBaseline, compareBaseline, readCapture } from '../scripts/ci-visual.mjs';
import { pageAxes, readCalibration, setAxes } from '../scripts/visual-review.mjs';

const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const signed = (body) => ({ ...body, fingerprint: fingerprint(body) });
const calibration = await readCalibration();
function fixtures() {
  const capture = signed({ schema_version: 1, environment: { platform: 'linux', arch: 'x64', playwright: 'locked' }, visual_policy_version: '1', pages: ['editorial', 'swiss'].flatMap((name) => Array.from({ length: 8 }, (_, i) => ({ id: `${name}/s0${i + 1}`, image: `projects/${name}/qa/screenshots/s0${i + 1}.png`, sha256: fingerprint(`${name}/${i}`), theme_ref: name, content_revision: 'fixed-content', content_type: 'statement', claim: 'Approved claim', exact_text: ['Approved claim'] }))) });
  const review = { schema_version: 1, capture_fingerprint: capture.fingerprint, reviewer: { name: 'Test reviewer', kind: 'agent', familiarity: 'Synthetic metadata only; no production visual judgment' }, items: [
    ...capture.pages.map((page) => ({ id: page.id, inspected_sha256: [page.sha256], axes: Object.fromEntries(pageAxes.map((axis) => [axis, { status: 'pass', observation: 'Synthetic test observation for this axis' }])), slop: { findings: [], observation: 'Synthetic test finding, not a production acceptance' } })),
    ...['editorial', 'swiss'].map((name) => ({ id: `${name}/whole-set`, inspected_sha256: capture.pages.filter((page) => page.id.startsWith(`${name}/`)).map((page) => page.sha256), axes: Object.fromEntries(setAxes.map((axis) => [axis, { status: 'pass', observation: 'Synthetic set observation' }])), slop: { findings: [], observation: 'Synthetic set finding' } })),
  ] };
  return { capture, review };
}
function revise(capture, edit) { const { fingerprint: _, ...body } = structuredClone(capture); edit(body); return signed(body); }

test('only identical reviewed content, pixels, policy and environment inherit baseline acceptance', () => {
  const { capture, review } = fixtures();
  assert.equal(compareBaseline(capture, capture, review, calibration).status, 'accepted-baseline');
  assert.equal(compareBaseline(capture, capture, review, calibration).improvement_claim, false);
  for (const edit of [
    (body) => { body.pages[5].sha256 = fingerprint('changed capture'); },
    (body) => { body.pages[5].content_revision = 'changed approved content'; },
    (body) => { body.environment.playwright = 'different browser version'; },
    (body) => { body.visual_policy_version = 'new policy'; },
  ]) assert.equal(compareBaseline(revise(capture, edit), capture, review, calibration).status, 'needs-review');
  assert.equal(compareBaseline(capture, null, null, calibration).status, 'needs-review');
});

test('missing, uncertain or failing page and whole-deck judgments cannot approve a baseline', () => {
  for (const edit of [
    (review) => { review.items.pop(); },
    (review) => { review.items[0].axes.meaning.status = 'uncertain'; },
    (review) => { review.items.at(-1).axes.rhythm.status = 'fail'; },
    (review) => { review.items[0].slop.findings.push({ severity: 'blocking', pattern: 'Unrelated filler', observation: 'Synthetic blocking finding' }); },
  ]) {
    const { capture, review } = fixtures(); edit(review);
    assert.notEqual(assessBaseline(capture, review, calibration).status, 'accepted');
    assert.notEqual(compareBaseline(capture, capture, review, calibration).status, 'accepted-baseline');
  }
});

test('rehashed screenshot metadata still requires its own actual-image review', () => {
  const { capture, review } = fixtures();
  const changed = revise(capture, (body) => { body.pages[0].sha256 = fingerprint('new pixels'); });
  assert.throws(() => assessBaseline(changed, review, calibration), /another capture/);
  review.capture_fingerprint = changed.fingerprint;
  assert.throws(() => assessBaseline(changed, review, calibration), /actual images/);
  review.items[0].inspected_sha256 = [changed.pages[0].sha256];
  assert.throws(() => assessBaseline(changed, review, calibration), /actual images/); // Whole-set inspection must change too.
});

test('the exact user-rejected s06 can never become an accepted baseline', () => {
  const { capture, review } = fixtures();
  const rejected = revise(capture, (body) => { body.pages[5].sha256 = calibration.cases[0].candidate.sha256; });
  review.capture_fingerprint = rejected.fingerprint;
  review.items[5].inspected_sha256 = [rejected.pages[5].sha256];
  review.items[16].inspected_sha256 = rejected.pages.slice(0, 8).map((page) => page.sha256);
  assert.equal(assessBaseline(rejected, review, calibration).status, 'regressed');
});

test('the committed sixteen-page baseline has intact actual PNGs and complete bound observations', async () => {
  const root = fileURLToPath(new URL('../fixtures/visual-baseline/', import.meta.url));
  const capture = await readCapture(root);
  const review = JSON.parse(await readFile(new URL('../fixtures/visual-baseline/review.json', import.meta.url), 'utf8'));
  assert.equal(capture.origin, 'github-actions-browser');
  assert.equal(assessBaseline(capture, review, calibration).status, 'accepted');
  assert.equal(compareBaseline(capture, capture, review, calibration).status, 'accepted-baseline');
});
