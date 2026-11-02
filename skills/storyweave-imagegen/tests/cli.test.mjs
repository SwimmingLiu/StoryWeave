import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const repo = resolve(new URL('../../..', import.meta.url).pathname);
const cli = join(repo, 'skills/storyweave-imagegen/scripts/ppt.mjs');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

async function node(...args) {
  try { return { ...await execute(process.execPath, [cli, ...args], { cwd: repo, maxBuffer: 4 * 1024 * 1024 }), code: 0 }; }
  catch (error) { return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.code }; }
}

async function project(t, options = []) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-image-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const drafted = await node('draft', root, ...options);
  assert.equal(drafted.code, 0, drafted.stderr);
  const approved = await node('approve', root);
  assert.equal(approved.code, 0, approved.stderr);
  return root;
}

test('public modern CLI produces typed tasks and honestly stops before images', async (t) => {
  const root = await project(t);
  const content = await json(join(root, 'deck_spec.json'));
  const plan = await json(join(root, 'plans/imagegen.json'));
  assert.equal(content.schema_version, 4);
  assert.equal(plan.contentRevision, content.revision);
  assert.equal(content.slides.length, 8);
  assert.equal((await node('prompts', root)).code, 0);
  const status = await node('status', root, '--json');
  assert.equal(status.code, 3);
  assert.equal(JSON.parse(status.stdout).status, 'needs-images');
  assert.equal((await node('build', root)).code, 3);
  const qa = await node('qa', root, '--json');
  assert.equal(qa.code, 2);
  assert.equal(JSON.parse(qa.stdout).export_ready, false);
});

test('public replan changes only private visual plan and keeps approved content bytes', async (t) => {
  const root = await project(t);
  const before = await readFile(join(root, 'deck_spec.json'), 'utf8');
  const oldPlan = await json(join(root, 'plans/imagegen.json'));
  const result = await node('replan', root, '--theme', 'systems/white-cyan-circuit');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(join(root, 'deck_spec.json'), 'utf8'), before);
  const next = await json(join(root, 'plans/imagegen.json'));
  assert.notEqual(next.plan_sha256, oldPlan.plan_sha256);
  assert.equal(next.contentRevision, oldPlan.contentRevision);
});

test('explicit schema3 CLI keeps the legacy six-page project path available', async (t) => {
  const root = await project(t, ['--schema', '3']);
  assert.equal((await json(join(root, 'deck_spec.json'))).schema_version, 3);
  assert.equal((await node('prompts', root)).code, 0);
  assert.equal((await json(join(root, 'generation_manifest.json'))).slides.length, 6);
});

test('public record-result retains actual call records and resets only one image review', async (t) => {
  const root = await project(t);
  const selections = join(root, 'selections.json');
  await writeFile(selections, JSON.stringify([{ case_id: 'storyweave-knowledge-flow', page_id: 's03', purpose: 'layout', slide_id: 's03' }]));
  assert.equal((await node('plan', root, '--library', join(repo, 'design-library'), '--references', selections)).code, 0);
  assert.equal((await node('prompts', root)).code, 0);
  const jobs = (await readFile(join(root, 'imagegen-jobs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const input = jobs[2].tool_input.referenced_image_paths[0];
  assert.equal(typeof input, 'string');
  const output = join(root, 'fixture-returned.png');
  await copyFile(join(repo, 'skills/storyweave-html/assets/examples/storyweave-demo/qa/screenshots/s03.png'), output);
  const log = join(root, 'fixture-tool-call.json');
  await writeFile(log, JSON.stringify({ tool: 'image_gen', arguments: { referenced_image_paths: [input] }, result: { path: output }, fixture: true }));
  const receipt = join(root, 'fixture-receipt.json');
  await writeFile(receipt, JSON.stringify({ slide_id: 's03', tool: 'image_gen', reference_mode: 'attached', tool_call: { log_path: log }, output_path: output }));
  const recorded = await node('record-result', root, '--receipt', receipt);
  assert.equal(recorded.code, 0, recorded.stderr);
  const reviewed = await node('review', root, '--slide', 's03', '--pass', '--notes', 'Contract fixture only; no service or aesthetic claim.');
  assert.equal(reviewed.code, 0, reviewed.stderr);
  const manifest = await json(join(root, 'generation_manifest.json'));
  assert.equal(manifest.slides[2].reference_delivery.status, 'attached');
  assert.equal(manifest.slides[2].reference_delivery.evidence_status, 'recorded');
  assert.equal(manifest.slides[2].visual_review, 'pass');
  assert.equal(manifest.slides[0].visual_review, 'pending');
  assert.equal((await node('status', root)).code, 3);
});

test('reviewed image fixtures build public delivery with byte-bound QA and reject a stale export', async (t) => {
  const root = await project(t);
  assert.equal((await node('prompts', root)).code, 0);
  const jobs = (await readFile(join(root, 'imagegen-jobs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  await mkdir(join(root, 'slides'), { recursive: true });
  for (const job of jobs) {
    await copyFile(join(repo, 'skills/storyweave-html/assets/examples/storyweave-demo/qa/screenshots/s01.png'), join(root, job.out));
    const review = await node('review', root, '--slide', job.id, '--pass', '--notes', 'Contract fixture only.');
    assert.equal(review.code, 0, review.stderr);
  }
  const build = await node('build', root);
  assert.equal(build.code, 0, build.stderr);
  const qa = await node('qa', root, '--json');
  assert.equal(qa.code, 0, qa.stderr || qa.stdout);
  const report = JSON.parse(qa.stdout);
  assert.equal(report.export_ready, true);
  assert.match(report.artifact_binding.fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal((await node('export', root, '--format', 'html')).code, 0);
  const slidePath = join(root, jobs[0].out);
  await writeFile(slidePath, Buffer.concat([await readFile(slidePath), Buffer.from('changed bytes')]));
  const stale = await node('export', root, '--format', 'html');
  assert.notEqual(stale.code, 0);
  assert.match(stale.stderr, /stale|changed|fingerprint|binding/iu);
});
