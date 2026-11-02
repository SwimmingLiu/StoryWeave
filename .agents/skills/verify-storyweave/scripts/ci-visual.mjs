#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { arch, platform } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { writeLayoutStudy } from '../../../../scripts/html-layout-study.mjs';
import { createVisualIntent, VISUAL_POLICY_VERSION } from '../../../../src/core/visual-policy.mjs';
import { pageAxes, readCalibration, setAxes } from './visual-review.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const baselineRoot = join(repo, '.agents/skills/verify-storyweave/fixtures/visual-baseline');
const cli = join(repo, 'skills/storyweave-html/scripts/ppt.mjs');
const execute = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = (value) => hash(JSON.stringify(value));
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const exists = (path) => access(path).then(() => true, () => false);
const themes = [['editorial', 'editorial/paper-magazine'], ['swiss', 'systems/ink-blue-grid']];
const expectedIds = themes.flatMap(([name]) => Array.from({ length: 8 }, (_, index) => `${name}/s${String(index + 1).padStart(2, '0')}`));
const substantive = (value) => typeof value === 'string' && value.trim().length > 0 && !/^(TODO|pending|待评|未查看)$/iu.test(value.trim());
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const safeImage = (path) => typeof path === 'string' && /^projects\/(editorial|swiss)\/qa\/screenshots\/s0[1-8]\.png$/u.test(path);
const baselinePath = '.agents/skills/verify-storyweave/fixtures/visual-baseline';

function validateCapture(capture) {
  const { fingerprint: stored, ...body } = capture;
  assert.equal(fingerprint(body), stored, 'Capture metadata changed');
  assert.equal(capture.schema_version, 1);
  assert.deepEqual(capture.pages.map(({ id }) => id), expectedIds, 'Capture all sixteen pages in stable order');
  for (const page of capture.pages) {
    assert(safeImage(page.image) && /^[a-f0-9]{64}$/u.test(page.sha256));
    assert.equal(page.image, `projects/${page.id.split('/')[0]}/qa/screenshots/${page.id.split('/')[1]}.png`);
    assert(substantive(page.content_revision) && substantive(page.claim) && Array.isArray(page.exact_text));
  }
}

function validateScreenshot(bytes, page) {
  assert.equal(hash(bytes), page.sha256, `Reviewed screenshot changed: ${page.id}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1280);
  assert.equal(bytes.readUInt32BE(20), 720);
}

export async function readCapture(directory) {
  const capture = await json(join(directory, 'capture.json'));
  validateCapture(capture);
  for (const page of capture.pages) validateScreenshot(await readFile(join(directory, page.image)), page);
  return capture;
}

// A baseline edited directly in a pull request must still be checked against the target revision's real images.
export async function readGitBaseline(ref) {
  assert(/^[a-f0-9]{40}$/u.test(ref), 'CI baseline reference must be a commit SHA');
  const path = `${baselinePath}/capture.json`;
  const options = { cwd: repo, maxBuffer: 16 * 1024 * 1024 };
  const entry = await execute('git', ['ls-tree', '--name-only', ref, '--', path], options);
  if (!entry.stdout.trim()) return null;
  const read = async (file) => (await execute('git', ['show', `${ref}:${baselinePath}/${file}`], { ...options, encoding: 'buffer' })).stdout;
  const capture = JSON.parse((await read('capture.json')).toString('utf8'));
  validateCapture(capture);
  const screenshots = {};
  for (const page of capture.pages) {
    const bytes = await read(page.image);
    validateScreenshot(bytes, page);
    screenshots[page.image] = bytes;
  }
  return { capture, review: JSON.parse((await read('review.json')).toString('utf8')), screenshots };
}

function reviewItems(capture) {
  return [
    ...capture.pages.map((page) => ({ id: page.id, axes: pageAxes, images: [page.sha256] })),
    ...themes.map(([name]) => ({ id: `${name}/whole-set`, axes: setAxes, images: capture.pages.filter((page) => page.id.startsWith(`${name}/`)).map((page) => page.sha256) })),
  ];
}

function comparable(capture, previous) {
  return fingerprint(capture.environment) === fingerprint(previous.environment)
    && capture.pages.every((page, index) => page.content_revision === previous.pages[index].content_revision
      && page.theme_ref === previous.pages[index].theme_ref);
}

// A candidate that looks acceptable alone can still be worse than the existing baseline.
export function assessBaseline(capture, review, calibration = { cases: [] }, previous = null) {
  validateCapture(capture);
  assert.equal(review.schema_version, 1);
  assert.equal(review.capture_fingerprint, capture.fingerprint, 'Review belongs to another capture');
  assert(substantive(review.reviewer?.name) && ['human', 'agent'].includes(review.reviewer.kind));
  assert(substantive(review.reviewer.familiarity), 'Declare prior knowledge and review limits');
  const items = reviewItems(capture);
  const hasPairedReview = Boolean(previous || (review.baseline_capture_fingerprint && !review.baseline_reset));
  if (review.baseline_reset) {
    assert.equal(review.baseline_reset.previous_capture_fingerprint, review.baseline_capture_fingerprint);
    assert(substantive(review.baseline_reset.reason), 'Explain why the visual reference changed');
  }
  let priorItems;
  if (previous) {
    validateCapture(previous);
    assert.equal(review.baseline_capture_fingerprint, previous.fingerprint, 'Review belongs to another baseline');
    assert.deepEqual(capture.environment, previous.environment, 'Compare both versions in the same render environment');
    for (const [index, page] of capture.pages.entries()) {
      assert.equal(page.content_revision, previous.pages[index].content_revision, 'Visual comparison requires the same approved content');
      assert.equal(page.theme_ref, previous.pages[index].theme_ref, 'Visual comparison requires the same theme');
    }
    priorItems = new Map(reviewItems(previous).map((item) => [item.id, item]));
  }
  const indexed = new Map();
  for (const item of review.items) {
    assert(!indexed.has(item.id) && items.some(({ id }) => id === item.id), 'Duplicate or unknown visual review');
    indexed.set(item.id, item);
  }
  const results = items.map((item) => {
    const row = indexed.get(item.id);
    if (!row) return { id: item.id, status: 'needs-review' };
    assert.deepEqual([...row.inspected_sha256].sort(), [...item.images].sort(), `Inspect the actual images for ${item.id}`);
    if (hasPairedReview) {
      assert(Array.isArray(row.baseline_inspected_sha256), `Inspect the baseline images for ${item.id}`);
      assert.equal(row.baseline_inspected_sha256.length, item.images.length, `Inspect every baseline image for ${item.id}`);
      assert(row.baseline_inspected_sha256.every((sha) => /^[a-f0-9]{64}$/u.test(sha)), `Record baseline image hashes for ${item.id}`);
      if (previous) assert.deepEqual([...row.baseline_inspected_sha256].sort(), [...priorItems.get(item.id).images].sort(), `Inspect the baseline images for ${item.id}`);
    }
    assert.deepEqual(Object.keys(row.axes).sort(), [...item.axes].sort());
    for (const value of Object.values(row.axes)) assert(['pass', 'fail', 'uncertain'].includes(value.status) && substantive(value.observation), `Explain each visual axis for ${item.id}`);
    if (hasPairedReview) for (const value of Object.values(row.axes)) assert(['baseline', 'candidate', 'tie', 'uncertain'].includes(value.preferred) && substantive(value.comparison_observation), `Compare both versions on each visual axis for ${item.id}`);
    assert(Array.isArray(row.slop?.findings) && substantive(row.slop.observation));
    for (const finding of row.slop.findings) assert(['blocking', 'advisory'].includes(finding.severity) && substantive(finding.pattern) && substantive(finding.observation));
    const veto = calibration.cases.some((entry) => entry.id === item.id && entry.candidate.sha256 === item.images[0]);
    // A stored comparison remains binding even when a later push has no access to the older baseline.
    const failedAxes = Object.entries(row.axes).filter(([, { status, preferred }]) => status === 'fail' || (hasPairedReview && preferred === 'baseline')).map(([axis]) => axis);
    const uncertainAxes = Object.entries(row.axes).filter(([, { status, preferred }]) => status === 'uncertain' || (hasPairedReview && preferred === 'uncertain')).map(([axis]) => axis);
    const blockingSlop = row.slop.findings.filter(({ severity }) => severity === 'blocking');
    const failed = veto || failedAxes.length || blockingSlop.length;
    return { id: item.id, status: failed ? 'regressed' : uncertainAxes.length ? 'needs-review' : 'accepted', failed_axes: failedAxes, uncertain_axes: uncertainAxes, blocking_slop: blockingSlop, user_veto: veto };
  });
  return { status: results.some(({ status }) => status === 'regressed') ? 'regressed' : results.some(({ status }) => status === 'needs-review') ? 'needs-review' : 'accepted', items: results };
}

export function assessBaselineTransition(capture, review, previous, previousReview, calibration) {
  const current = assessBaseline(capture, review, calibration);
  if (!previous) return current;
  assert.equal(assessBaseline(previous, previousReview, calibration).status, 'accepted', 'The previous baseline must have a complete review');
  if (capture.fingerprint === previous.fingerprint && fingerprint(review) === fingerprint(previousReview)) return current;
  assert.equal(review.baseline_capture_fingerprint, previous.fingerprint, 'Review belongs to another baseline');
  if (review.baseline_reset) {
    assert(!comparable(capture, previous), 'A comparable baseline cannot be reset to avoid paired review');
    assert.equal(review.baseline_reset.previous_capture_fingerprint, previous.fingerprint);
    assert(substantive(review.baseline_reset.reason), 'Explain why the visual reference changed');
    return { ...current, comparison: 'new-reference', improvement_claim: false };
  }
  return assessBaseline(capture, review, calibration, previous);
}

export function compareBaseline(capture, baseline, review, calibration) {
  validateCapture(capture);
  if (!baseline) return { status: 'needs-review', changed: expectedIds, reason: 'No reviewed baseline' };
  const assessment = assessBaseline(baseline, review, calibration);
  if (assessment.status !== 'accepted') return { ...assessment, changed: expectedIds, reason: 'Baseline is not fully reviewed' };
  const sameEnvironment = fingerprint(capture.environment) === fingerprint(baseline.environment);
  const samePolicy = capture.visual_policy_version === baseline.visual_policy_version;
  const changed = capture.pages.filter((page, index) => {
    const original = baseline.pages[index];
    return !sameEnvironment || !samePolicy || ['id', 'theme_ref', 'content_revision', 'claim', 'content_type', 'exact_text', 'sha256'].some((key) => fingerprint(page[key]) !== fingerprint(original[key]));
  }).map(({ id }) => id);
  // Exact reviewed pixels may inherit a prior judgment; a changed page is pending, never automatically worse or better.
  return { status: changed.length ? 'needs-review' : 'accepted-baseline', changed, reason: changed.length ? 'Pixels, content, policy or browser environment changed' : 'All sixteen captures match the reviewed baseline', baseline_capture: baseline.fingerprint, baseline_reviewer: review.reviewer, improvement_claim: false };
}

async function writeReport(directory, capture, result, hasBaseline) {
  await save(join(directory, 'result.json'), { ...result, capture_fingerprint: capture.fingerprint, ci_run_url: capture.ci_run_url, source_revision: capture.source_revision });
  const image = (src, label) => `<figure><figcaption>${label}</figcaption><img src="${escape(src)}" alt="${label}"></figure>`;
  const label = (id) => result.changed.includes(id) ? '待复核' : result.comparison_changed.includes(id) ? '已评审变更' : '基线一致';
  const sections = capture.pages.map((page) => `<section><h2>${escape(page.id)} · ${label(page.id)}</h2><p>${escape(page.claim)}</p><div class="pair">${hasBaseline ? image(`baseline/${page.image}`, '已评审基线') : '<p>尚无已评审基线</p>'}${image(page.image, '本次 CI')}</div></section>`).join('');
  // Single-page pairs could not show a regression in the rhythm of the complete deck.
  const sets = themes.map(([name]) => {
    const pages = capture.pages.filter((page) => page.id.startsWith(`${name}/`));
    const grid = (prefix, label) => `<figure><figcaption>${label}</figcaption><div class="set">${pages.map((page) => `<img src="${escape(prefix + page.image)}" alt="${escape(page.id)}">`).join('')}</div></figure>`;
    return `<section><h2>${name} · 整套</h2><div class="pair">${hasBaseline ? grid('baseline/', '已评审基线') : '<p>尚无已评审基线</p>'}${grid('', '本次 CI')}</div></section>`;
  }).join('');
  await writeFile(join(directory, 'comparison.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HTML 视觉回归</title><style>body{margin:24px;background:#eeeae3;color:#24221f;font:16px/1.6 system-ui}section{margin:36px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.set{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}img{display:block;width:100%}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>HTML 视觉回归 · ${escape(result.status)}</h1><p>比较同内容、同环境的实际截图。画面变化需要实际复核；像素差异不表示审美退步或改善。</p>${sections}${sets}</html>`);
  await writeFile(join(directory, 'contact-sheet.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>两套八页样张</title><style>body{margin:24px;background:#eeeae3;font:16px system-ui}.set{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0}img{width:100%}</style><h1>两套八页样张</h1>${themes.map(([name]) => `<h2>${name}</h2><div class="set">${capture.pages.filter((page) => page.id.startsWith(`${name}/`)).map((page) => image(page.image, page.id)).join('')}</div>`).join('')}</html>`);
}

async function captureSamples(directory) {
  assert(!await exists(join(directory, 'capture.json')), 'Use a new CI evidence directory');
  await mkdir(directory, { recursive: true });
  const commands = [];
  async function command(parameters) {
    let record;
    try {
      const output = await execute(process.execPath, [cli, ...parameters], { cwd: repo, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
      record = { args: parameters, exit_code: 0, ...output };
      return output.stdout;
    } catch (error) {
      record = { args: parameters, exit_code: error.code, stdout: error.stdout, stderr: error.stderr };
      throw error;
    } finally {
      if (record) commands.push(record);
      await save(join(directory, 'commands.json'), commands);
    }
  }
  const sample = await json(join(repo, 'skills/storyweave-html/assets/content-v4.example.json'));
  const pages = [];
  const projects = [];
  for (const [name, theme] of themes) {
    const project = join(directory, 'projects', name);
    await command(['draft', project, '--theme-ref', theme]);
    await save(join(project, 'outline_draft.json'), { ...sample, theme_ref: theme });
    await save(join(project, 'visual-intent.json'), { audience: sample.audience, purpose: sample.purpose, reading_mode: sample.reading_mode, medium: theme, imagery: 's07 uses the same title, image and text blocks to illustrate space allocation; other pages use their authored information.', slides: sample.slides.map(createVisualIntent) });
    await command(['approve', project, '--theme-ref', theme]);
    const approved = await readFile(join(project, 'deck_spec.json'));
    await writeLayoutStudy(project, name === 'editorial' ? 'magazine' : 'swiss');
    await command(['replan', project, '--theme-ref', theme]);
    assert.deepEqual(await readFile(join(project, 'deck_spec.json')), approved, 'Visual-only changes must preserve approved bytes');
    await command(['build', project]);
    const qa = JSON.parse(await command(['qa', project, '--json']));
    assert(qa.export_ready && qa.visual_review === 'browser' && qa.summary.blocking === 0 && qa.summary.degraded === 0, JSON.stringify(qa.findings));
    const deck = await json(join(project, 'deck_spec.json'));
    const plan = await json(join(project, 'plans/html.json'));
    assert.deepEqual(await readFile(join(project, 'deck_spec.json')), approved, 'Build and QA must preserve approved bytes');
    assert.equal(plan.visual_policy.version, VISUAL_POLICY_VERSION);
    assert(plan.slides.every((page) => page.visual_intent.review_status === 'required'), 'A generated plan cannot claim a visual pass');
    assert.equal(deck.slides.length, 8);
    assert.equal(plan.slides.find(({ content_type }) => content_type === 'graph').diagram.flow, 'across', 'A wide DAG keeps its readable branch/merge path');
    assert.equal(plan.slides.find(({ id }) => id === 's07').asset_slots[0].asset_id, 'layout-study');
    for (const file of ['browser-states.json', 'gallery-states.json']) {
      const states = await json(join(project, 'qa', file));
      assert.equal(states.length, 16, 'All eight pages need independent/gallery checks at both viewports');
      for (const state of states) {
        assert.deepEqual(state.split_words, []);
        assert.deepEqual(state.connection_collisions, []);
        for (const edge of state.connection_endpoints) for (const key of ['from_distance', 'to_distance']) assert(edge[key] >= 4 && edge[key] <= 20);
        for (const styles of state.comparison_styles) assert(styles.every((style) => style.color === styles[0].color && style.weight === styles[0].weight));
      }
    }
    for (const slide of deck.slides) {
      const image = `projects/${name}/qa/screenshots/${slide.id}.png`;
      pages.push({ id: `${name}/${slide.id}`, theme_ref: theme, content_revision: deck.revision, content_type: slide.content.type, claim: slide.claim, exact_text: slide.exact_text, image, sha256: hash(await readFile(join(directory, image))) });
    }
    projects.push({ name, approved_sha256: hash(approved), artifact_binding: qa.artifact_binding, qa: qa.summary });
  }
  assert.equal(pages[0].content_revision, pages[8].content_revision);
  const require = createRequire(cli);
  const body = { schema_version: 1, origin: process.env.GITHUB_RUN_ID ? 'github-actions-browser' : 'local-browser', source_revision: process.env.GITHUB_SHA ?? null, ci_run_url: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null, visual_policy_version: VISUAL_POLICY_VERSION, environment: { platform: platform(), arch: arch(), playwright: require('playwright/package.json').version, viewport: { width: 1280, height: 720 } }, projects, pages };
  const capture = { ...body, fingerprint: fingerprint(body) };
  await save(join(directory, 'capture.json'), capture);
  await readCapture(directory);
  return capture;
}

function reviewTemplate(capture, baseline) {
  const before = baseline && new Map(reviewItems(baseline).map((item) => [item.id, item]));
  const reset = baseline && !comparable(capture, baseline);
  return {
    schema_version: 1,
    capture_fingerprint: capture.fingerprint,
    ...(baseline && { baseline_capture_fingerprint: baseline.fingerprint }),
    ...(reset && { baseline_reset: { previous_capture_fingerprint: baseline.fingerprint, reason: '' } }),
    reviewer: { name: '', kind: 'agent', familiarity: '' },
    items: reviewItems(capture).map((item) => ({
      id: item.id,
      inspected_sha256: item.images,
      ...(baseline && { baseline_inspected_sha256: before.get(item.id).images }),
      axes: Object.fromEntries(item.axes.map((axis) => [axis, {
        status: 'uncertain',
        observation: '',
        ...(baseline && !reset && { preferred: 'uncertain', comparison_observation: '' }),
      }])),
      slop: { findings: [], observation: '' },
    })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const index = args.indexOf(name); assert(index >= 0 && args[index + 1] && !args[index + 1].startsWith('--'), `${name} requires a path`); return resolve(args[index + 1]); };
  if (args.includes('--help')) return { usage: 'ci-visual.mjs check --out DIR | accept --capture DIR --review FILE' };
  if (args[0] === 'accept') {
    const source = flag('--capture');
    const capture = await readCapture(source);
    assert.equal(capture.origin, 'github-actions-browser', 'Use actual GitHub Actions captures for the shared baseline');
    const review = await json(flag('--review'));
    const calibration = await readCalibration();
    // A new candidate must be judged against the same baseline that was captured in the CI artifact.
    const hasPrevious = await exists(join(baselineRoot, 'capture.json'));
    const previous = hasPrevious ? await readCapture(baselineRoot) : null;
    if (previous) {
      assert.equal(assessBaseline(previous, await json(join(baselineRoot, 'review.json')), calibration).status, 'accepted', 'The existing baseline must have a complete review');
      const capturedBaseline = await readCapture(join(source, 'baseline'));
      assert.equal(capturedBaseline.fingerprint, previous.fingerprint, 'The baseline changed after this comparison was captured');
    }
    assert.equal(assessBaselineTransition(capture, review, previous, previous ? await json(join(baselineRoot, 'review.json')) : null, calibration).status, 'accepted', 'Every page and set must be reviewed without regressions or uncertainty');
    // Only an explicit, fully reviewed update writes the repository baseline; CI check never refreshes it.
    for (const page of capture.pages) {
      const target = join(baselineRoot, page.image);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(source, page.image), target);
    }
    await save(join(baselineRoot, 'capture.json'), capture);
    await save(join(baselineRoot, 'review.json'), review);
    return { status: 'baseline-updated', capture_fingerprint: capture.fingerprint, directory: baselineRoot };
  }
  assert.equal(args[0], 'check', 'Use check or accept');
  const directory = flag('--out');
  assert(isAbsolute(directory));
  const capture = await captureSamples(directory);
  const hasBaseline = await exists(join(baselineRoot, 'capture.json'));
  let baseline = null;
  let review = null;
  let baselineError;
  if (hasBaseline) {
    // A corrupt proposed baseline should still produce a comparison against the trusted previous revision.
    try {
      baseline = await readCapture(baselineRoot);
      review = await json(join(baselineRoot, 'review.json'));
    } catch (error) {
      baseline = null;
      baselineError = error;
    }
  }
  const calibration = await readCalibration();
  if (process.env.GITHUB_ACTIONS) assert(process.env.CI_VISUAL_BASE_REF, 'CI must identify the previous baseline revision');
  const previous = process.env.CI_VISUAL_BASE_REF ? await readGitBaseline(process.env.CI_VISUAL_BASE_REF) : null;
  let result;
  try {
    if (baselineError) throw baselineError;
    const transition = baseline && assessBaselineTransition(baseline, review, previous?.capture, previous?.review, calibration);
    result = transition && transition.status !== 'accepted' ? { status: transition.status, changed: expectedIds, reason: 'The changed baseline has a regression or incomplete comparison', review_items: transition.items.filter((item) => item.status !== 'accepted') } : compareBaseline(capture, baseline, review, calibration);
  } catch (error) {
    result = { status: 'needs-review', changed: expectedIds, reason: `Invalid baseline transition: ${error.message}` };
  }
  const changedBaseline = previous && (!baseline || previous.capture.fingerprint !== baseline.fingerprint || fingerprint(previous.review) !== fingerprint(review));
  const reference = changedBaseline ? previous.capture : baseline;
  if (changedBaseline) {
    // Preserve the target branch's prior PNGs when the proposed baseline itself changed.
    for (const [path, bytes] of Object.entries(previous.screenshots)) {
      const target = join(directory, 'baseline', path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    await save(join(directory, 'baseline/capture.json'), previous.capture);
    await save(join(directory, 'baseline/review.json'), previous.review);
  } else if (baseline) await cp(baselineRoot, join(directory, 'baseline'), { recursive: true });
  result.comparison_changed = reference ? capture.pages.filter((page, index) => page.sha256 !== reference.pages[index].sha256).map(({ id }) => id) : expectedIds;
  // The comparison template can bind both versions only after the baseline is known.
  await save(join(directory, 'review-template.json'), reviewTemplate(capture, reference));
  await writeReport(directory, capture, result, Boolean(reference));
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `\nHTML visual regression: **${result.status}**\n\nTwo eight-page decks; changed pages: ${result.changed.length}. Download the visual artifact for comparison.html, capture.json and review-template.json.\n`, { flag: 'a' });
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'needs-review' ? 4 : result.status === 'regressed' ? 1 : 0;
  } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
