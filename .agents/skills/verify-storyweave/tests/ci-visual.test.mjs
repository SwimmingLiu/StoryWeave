import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assessBaseline, assessBaselineTransition, compareBaseline, readCapture, readGitBaseline } from '../scripts/ci-visual.mjs';
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
function paired() {
  const { capture: previous, review } = fixtures();
  const candidate = revise(previous, (body) => { body.pages[5].sha256 = fingerprint('new graph capture'); });
  review.capture_fingerprint = candidate.fingerprint;
  review.baseline_capture_fingerprint = previous.fingerprint;
  for (const item of review.items) {
    item.baseline_inspected_sha256 = [...item.inspected_sha256];
    if (item.id === 'editorial/s06') item.inspected_sha256 = [candidate.pages[5].sha256];
    if (item.id === 'editorial/whole-set') item.inspected_sha256 = candidate.pages.slice(0, 8).map((page) => page.sha256);
    for (const axis of Object.values(item.axes)) Object.assign(axis, { preferred: 'tie', comparison_observation: 'Synthetic comparison of the actual baseline and candidate' });
  }
  return { previous, candidate, review };
}

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

test('a baseline update requires both images and cannot average away a worse axis', () => {
  const { previous, candidate, review } = paired();
  assert.equal(assessBaseline(candidate, review, calibration, previous).status, 'accepted');
  for (const axis of Object.values(review.items[5].axes)) axis.preferred = 'candidate';
  review.items[5].axes.relationships.preferred = 'baseline';
  assert.equal(assessBaseline(candidate, review, calibration, previous).status, 'regressed');
  review.items[5].axes.relationships.preferred = 'uncertain';
  assert.equal(assessBaseline(candidate, review, calibration, previous).status, 'needs-review');
  delete review.items[5].axes.relationships.preferred;
  assert.throws(() => assessBaseline(candidate, review, calibration, previous), /Compare both versions/);
});

test('a baseline update rejects stale evidence and comparisons with changed content or environment', () => {
  const { previous, candidate, review } = paired();
  const wrongReview = structuredClone(review);
  wrongReview.baseline_capture_fingerprint = 'older baseline';
  assert.throws(() => assessBaseline(candidate, wrongReview, calibration, previous), /another baseline/);
  const wrongImages = structuredClone(review);
  wrongImages.items[5].baseline_inspected_sha256 = [fingerprint('different baseline pixels')];
  assert.throws(() => assessBaseline(candidate, wrongImages, calibration, previous), /baseline images/);
  const differentContent = revise(candidate, (body) => { body.pages[5].content_revision = 'changed content'; });
  const contentReview = { ...review, capture_fingerprint: differentContent.fingerprint };
  assert.throws(() => assessBaseline(differentContent, contentReview, calibration, previous), /same approved content/);
  const differentEnvironment = revise(candidate, (body) => { body.environment.playwright = 'different browser'; });
  const environmentReview = { ...review, capture_fingerprint: differentEnvironment.fingerprint };
  assert.throws(() => assessBaseline(differentEnvironment, environmentReview, calibration, previous), /same render environment/);
});

test('CI checks a changed baseline against the previous review even when the accept command was bypassed', () => {
  const { previous, candidate, review } = paired();
  const previousReview = fixtures().review;
  const unpaired = structuredClone(review);
  delete unpaired.baseline_capture_fingerprint;
  assert.throws(() => assessBaselineTransition(candidate, unpaired, previous, previousReview, calibration), /another baseline/);
  review.items[5].axes.relationships.preferred = 'baseline';
  const regression = assessBaselineTransition(candidate, review, previous, previousReview, calibration);
  assert.equal(regression.status, 'regressed');
  assert.deepEqual(regression.items[5].failed_axes, ['relationships']);
  review.items[5].axes.relationships.preferred = 'uncertain';
  const pending = assessBaselineTransition(candidate, review, previous, previousReview, calibration);
  assert.equal(pending.status, 'needs-review');
  assert.deepEqual(pending.items[5].uncertain_axes, ['relationships']);
  review.items[5].axes.relationships.preferred = 'tie';
  assert.equal(assessBaselineTransition(candidate, review, previous, previousReview, calibration).status, 'accepted');
  const tampered = structuredClone(previousReview);
  tampered.items[0].axes.meaning.observation = 'A changed observation for the same pixels.';
  assert.throws(() => assessBaselineTransition(previous, tampered, previous, previousReview, calibration), /another baseline/);
});

test('a new reference needs a real context change and an explicit reason', () => {
  const { previous, candidate, review } = paired();
  const previousReview = fixtures().review;
  review.baseline_reset = { previous_capture_fingerprint: previous.fingerprint, reason: 'The approved fixture content changed.' };
  assert.throws(() => assessBaselineTransition(candidate, review, previous, previousReview, calibration), /cannot be reset/);
  const different = revise(candidate, (body) => { body.pages[5].content_revision = 'new approved content'; });
  review.capture_fingerprint = different.fingerprint;
  const result = assessBaselineTransition(different, review, previous, previousReview, calibration);
  assert.equal(result.status, 'accepted');
  assert.equal(result.comparison, 'new-reference');
  assert.equal(result.improvement_claim, false);
  review.baseline_reset.reason = '';
  assert.throws(() => assessBaselineTransition(different, review, previous, previousReview, calibration), /why the visual reference changed/);
});

test('the previous Git revision supplies a complete baseline bound to its actual PNG bytes', async () => {
  const ref = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const baseline = await readGitBaseline(ref);
  assert.equal(baseline.capture.pages.length, 16);
  assert.equal(assessBaseline(baseline.capture, baseline.review, calibration).status, 'accepted');
});
