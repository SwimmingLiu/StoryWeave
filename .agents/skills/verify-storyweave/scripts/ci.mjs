#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const helper = join(repo, '.agents/skills/verify-storyweave/scripts/verify.mjs');
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const runId = args.includes('--run-id') ? option('--run-id') : undefined;
const cache = args.includes('--reference-cache') ? option('--reference-cache') : undefined;
const features = ['html-authoring', 'html-playback', 'themes', 'imagegen', 'bento', 'design-library', 'reference-gallery', 'distribution'];

if (args.includes('--help')) {
  console.log('ci.mjs --run-id UNIQUE_ID --reference-cache ABSOLUTE_DIRECTORY');
} else {
  assert(runId && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(runId), 'Supply a unique --run-id');
  assert(cache && isAbsolute(cache), 'Supply --reference-cache with an absolute original-image cache directory');
  const logRoot = join(repo, 'tmp/ci', runId);
  await mkdir(logRoot, { recursive: true });
  const commands = [];
  const results = {};
  const save = (name, value) => writeFile(join(logRoot, name), `${JSON.stringify(value, null, 2)}\n`);
  async function invoke(parameters, expectedExit = 0) {
    const record = { command: [process.execPath, helper, ...parameters], started_at: new Date().toISOString() };
    try {
      const output = await execute(process.execPath, [helper, ...parameters], { cwd: repo, timeout: 480000, maxBuffer: 16 * 1024 * 1024 });
      Object.assign(record, { exit_code: 0, stdout: output.stdout, stderr: output.stderr });
    } catch (error) {
      Object.assign(record, { exit_code: error.code ?? null, signal: error.signal ?? null, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message });
    }
    commands.push(record);
    await save('commands.json', commands);
    console.log(`${parameters.slice(0, 2).join(' ')}: exit ${record.exit_code}`);
    if (record.exit_code !== expectedExit) console.error(record.stdout, record.stderr);
    assert.equal(record.exit_code, expectedExit, `Unexpected exit: ${parameters.join(' ')}`);
    return JSON.parse(record.stdout);
  }
  let launched = false;
  let failure;
  let finalReport;
  try {
    await invoke(['doctor', '--json']);
    await invoke(['launch', '--run-id', runId]);
    launched = true;
    for (const feature of features) {
      const parameters = ['drive', feature, '--run-id', runId];
      if (feature === 'html-authoring') parameters.push('--compatibility');
      if (feature === 'reference-gallery') parameters.push('--reference-cache', cache);
      // No paid generation runs in CI; the actual missing-image gate must return both the expected exit and state.
      const expected = feature === 'imagegen' ? 'needs-images' : 'pass';
      const result = await invoke(parameters, feature === 'imagegen' ? 3 : 0);
      assert.equal(result.status, expected, `Unexpected ${feature} state`);
      results[feature] = result;
    }
  } catch (error) {
    failure = error;
    try { await invoke(['doctor', '--json']); } catch (doctorError) { console.error(doctorError.message); }
  } finally {
    if (launched) {
      try {
        await invoke(['cleanup', '--run-id', runId]);
        finalReport = await invoke(['report', '--run-id', runId], failure ? 1 : 3);
        assert.equal(finalReport.work_exists, false, 'Cleanup must remove owned work');
        assert.equal(finalReport.cleaned_up, true);
        for (const feature of features) assert.equal(finalReport.features[feature].status, feature === 'imagegen' ? 'needs-images' : 'pass');
      } catch (error) { failure ??= error; }
    }
    const summary = { technical_ci_pass: !failure && Object.keys(results).length === features.length,
      run_id: runId, revision: process.env.GITHUB_SHA ?? null, results, report: finalReport,
      limitations: ['Imagegen checks compilation and the missing-image gate, not a paid generation call.',
        'Automated browser and byte checks do not complete human visual acceptance.'], error: failure?.stack };
    await save('summary.json', summary);
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
      `StoryWeave technical verification: **${summary.technical_ci_pass ? 'passed' : 'failed'}**\n\nRun: \`${runId}\`\n\nImagegen generation and human visual acceptance remain separate.\n`, { flag: 'a' });
    if (failure) { console.error(failure.stack); process.exitCode = 1; }
  }
}
