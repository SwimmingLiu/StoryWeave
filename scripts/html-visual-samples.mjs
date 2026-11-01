#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { writeLayoutStudy } from './html-layout-study.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(repo, 'skills/storyweave-html/scripts/ppt.mjs');
const require = createRequire(cli);
const execute = promisify(execFile);
const args = process.argv.slice(2);
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = resolve(flag('--out', join(repo, 'comparisons/html-visual-20261101')));
const phase = flag('--phase', 'after');
assert(['before', 'after'].includes(phase), 'Use --phase before|after');
const baseline = resolve(flag('--baseline', out));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const commands = [];
await mkdir(join(out, phase), { recursive: true });

async function command(parameters, allowFailure = false) {
  let record;
  try {
    const result = await execute(process.execPath, [cli, ...parameters], { cwd: repo, maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
    record = { args: parameters, exit_code: 0, ...result };
  } catch (error) {
    record = { args: parameters, exit_code: error.code, stdout: error.stdout, stderr: error.stderr };
    if (!allowFailure) throw error;
  } finally {
    if (record) commands.push(record);
    await save(join(out, phase, 'commands.json'), commands);
  }
  return record;
}

// This existing eight-page content is an acceptance sample, not a business case or measured KPI.
const sample = await readJson(join(repo, 'skills/storyweave-html/assets/content-v4.example.json'));
sample.slides[6].asset_refs = [{ asset_id: 'paper-study', path: 'assets/paper-study.svg', slot: 'hero', fit: 'cover', focal_point: { x: .5, y: .5 }, subject_safe_area: { x: .3, y: .25, width: .4, height: .5 }, alt: '折叠纸张的原创几何插画' }];
const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="720" viewBox="0 0 1680 720"><rect width="1680" height="720" fill="#d9d1bf"/><path d="M0 580 1680 180V720H0Z" fill="#ccc2af"/><path d="m460 360 370-180 410 200-370 180Z" fill="#222b39" opacity=".13"/><path d="m440 320 390-185 410 200-390 185Z" fill="#f6f1e8"/><path d="m440 320 390-185 10 370Z" fill="#e8dfd0"/><path d="m830 135 410 200-400 170Z" fill="#fffcf6"/><path d="m670 330 160-75 185 90-175 80Z" fill="#27475a"/><path d="m830 255 185 90-175 80Z" fill="#436c7d"/><path d="m500 350 130 64M1060 390l110-52" fill="none" stroke="#b6aa98" stroke-width="3"/></svg>';
const themes = [['editorial', 'editorial/paper-magazine'], ['swiss', 'systems/ink-blue-grid']];
const results = [];
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, theme] of themes) {
    const project = join(out, phase, name);
    await mkdir(project, { recursive: true });
    if (phase === 'before') {
      await command(['draft', project, '--theme-ref', theme]);
      await writeFile(join(project, 'outline_draft.json'), JSON.stringify({ ...sample, theme_ref: theme }, null, 2) + '\n');
      await mkdir(join(project, 'assets'), { recursive: true });
      await writeFile(join(project, 'assets/paper-study.svg'), artwork);
      await command(['approve', project, '--theme-ref', theme]);
    } else {
      const original = join(baseline, 'before', name);
      for (const file of ['outline_draft.json', 'deck_spec.json', 'plans', 'assets']) await cp(join(original, file), join(project, file), { recursive: true });
      // The earlier decorative paper did not support the claim; opt in to a visual-only layout study.
      if (args.includes('--layout-study')) await writeLayoutStudy(project, name === 'editorial' ? 'magazine' : 'swiss');
      await command(['replan', project, '--theme-ref', theme]);
      assert.deepEqual(await readFile(join(project, 'deck_spec.json')), await readFile(join(original, 'deck_spec.json')), 'Visual optimization must preserve approved content bytes');
    }
    await command(['build', project]);
    await command(['qa', project, '--json'], phase === 'before');
    const qa = await readJson(join(project, 'qa_report.json'));
    if (phase === 'after') assert(qa.export_ready && qa.visual_review === 'browser' && qa.summary.blocking === 0 && qa.summary.degraded === 0, JSON.stringify(qa.findings));
    const deck = await readJson(join(project, 'deck_spec.json'));
    const manifest = await readJson(join(project, 'storyweave-output.json'));
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    const actions = [];
    try {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto(pathToFileURL(join(project, 'index.html')).href);
        for (const [index, slide] of manifest.slides.entries()) {
          if (index) await page.keyboard.press('ArrowRight');
          await page.evaluate(() => document.fonts.ready);
          const state = await page.locator('.slide.active').evaluate((element) => ({ id: element.dataset.slideId, layout: element.dataset.layoutId, text: element.innerText }));
          const screenshot = `gallery-${slide.id}-${viewport.width}.png`;
          await page.screenshot({ path: join(project, screenshot), animations: 'disabled' });
          actions.push({ input: index ? 'ArrowRight' : 'Open index.html', expected_id: slide.id, state, viewport, screenshot });
          await save(join(project, 'actions.json'), actions);
          assert.equal(state.id, slide.id);
        }
      }
    } finally { await context.tracing.stop({ path: join(project, 'trace.zip') }); await context.close(); }
    results.push({ name, theme_ref: theme, content_revision: deck.revision, approved_sha256: hash(await readFile(join(project, 'deck_spec.json'))), qa: { visual_review: qa.visual_review, ...qa.summary, export_ready: qa.export_ready }, artifact_binding: qa.artifact_binding });
  }
} finally { await browser.close(); }
await save(join(out, phase, 'summary.json'), results);
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
await writeFile(join(out, phase, 'contact-sheet.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>HTML 视觉验收样张 · ${phase}</title><style>body{margin:32px;background:#e8e7e3;color:#18212d;font:16px system-ui}section{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}img{width:100%;display:block}figure{margin:0}figcaption{padding:8px 0}</style><h1>HTML 视觉验收样张 · ${phase}</h1>${themes.map(([name, ref]) => `<h2>${escape(ref)}</h2><section>${sample.slides.map((slide) => `<figure><a href="${name}/slides/${slide.id}.html"><img src="${name}/qa/screenshots/${slide.id}.png" alt="${slide.id}"></a><figcaption>${slide.id}</figcaption></figure>`).join('')}</section>`).join('')}</html>`);
if (phase === 'after') await writeFile(join(out, 'before-after.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>HTML 同内容视觉修订对照</title><style>body{margin:24px;background:#e8e7e3;color:#18212d;font:16px system-ui}section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px 0}</style><h1>HTML 同内容视觉修订对照</h1>${themes.map(([name, ref]) => `<h2>${escape(ref)}</h2>${sample.slides.map(({ id }) => `<section><figure><img src="before/${name}/qa/screenshots/${id}.png" alt="${id} 修订前"><figcaption>${id} 修订前</figcaption></figure><figure><img src="after/${name}/qa/screenshots/${id}.png" alt="${id} 修订后"><figcaption>${id} 修订后</figcaption></figure></section>`).join('')}`).join('')}</html>`);
console.log(JSON.stringify({ out, phase, results: results.map(({ artifact_binding, ...value }) => value) }));
