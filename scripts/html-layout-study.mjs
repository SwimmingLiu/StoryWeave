#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This acceptance artwork depicts the same title, image and eight text bars rearranged with more space.
// It adds no words, measurements, relationship edges or claims to the approved presentation.
function artwork(system) {
  const [width, height] = system === 'swiss' ? [1920, 480] : [1680, 720];
  const paper = system === 'swiss' ? '#fafaf8' : '#f1ece2';
  const accent = system === 'swiss' ? '#002fa7' : '#9b5542';
  const panel = (x, ordered) => {
    const y = height * .06;
    const w = width * .445;
    const h = height * .88;
    const imageX = ordered ? .55 : .06;
    const textX = ordered ? .06 : .54;
    const top = ordered ? .35 : .24;
    return `<g transform="translate(${x},${y})"><rect width="${w}" height="${h}" fill="#fffdfa" stroke="#c7c3ba" stroke-width="2"/><rect x="${w * .06}" y="${h * .1}" width="${w * .66}" height="${h * (ordered ? .095 : .05)}" fill="${ordered ? accent : '#77766e'}"/><rect x="${w * imageX}" y="${h * top}" width="${w * .39}" height="${h * (ordered ? .5 : .61)}" fill="${ordered ? '#d4d9d5' : '#d7d5ce'}"/><path d="M${w * (imageX + .04)},${h * (top + .42)} L${w * (imageX + .17)},${h * (top + .16)} L${w * (imageX + .35)},${h * (top + .42)}Z" fill="${ordered ? accent : '#aaa79d'}"/>${[.95, .88, 1, .74, .93, .81, .98, .7].map((length, index) => `<rect x="${w * textX}" y="${h * (top + index * (ordered ? .06 : .043))}" width="${w * .37 * length}" height="${h * .017}" fill="${ordered ? '#4b4b44' : '#aaa79d'}"/>`).join('')}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${paper}"/>${panel(width * .035, false)}${panel(width * .52, true)}</svg>`;
}

export async function writeLayoutStudy(project, system) {
  assert(['magazine', 'swiss'].includes(system), 'Use magazine or swiss');
  const planPath = join(project, 'plans/html.json');
  const draftPath = join(project, 'outline_draft.json');
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  const draft = JSON.parse(await readFile(draftPath, 'utf8'));
  const page = plan.slides.find((slide) => slide.id === 's07');
  const source = draft.slides.find((slide) => slide.id === 's07');
  assert(draft.slides.length === 8 && source?.content.type === 'statement' && page, 'Use the eight-page visual acceptance sample');
  const asset = { asset_id: 'layout-study', path: 'assets/layout-study.svg', slot: 'hero', fit: 'cover', focal_point: { x: .5, y: .5 }, subject_safe_area: { x: .03, y: .05, width: .94, height: .9 }, alt: '同组标题、图片与正文信息块在拥挤和疏朗版式中的排布示意' };
  await mkdir(join(project, 'assets'), { recursive: true });
  await writeFile(join(project, asset.path), artwork(system));
  page.asset_refs = [asset];
  source.asset_refs = [asset];
  // Replan consumes these visual inputs and signs a fresh plan; approved deck_spec.json is never opened for writing.
  await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
  await writeFile(draftPath, JSON.stringify(draft, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeLayoutStudy(resolve(process.argv[2]), process.argv[3]);
}
