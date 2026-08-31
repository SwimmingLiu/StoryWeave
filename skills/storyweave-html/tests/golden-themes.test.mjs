import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

import { PAGE_ROLES } from '../scripts/lib/themes.mjs';

const run = promisify(execFile);
const cli = new URL('../scripts/ppt.mjs', import.meta.url);
const themes = ['editorial/paper-magazine', 'systems/white-cyan-circuit', 'campaign/bold-poster', 'cinematic/natural-film'];
const layouts = {
  cover: { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['headline', 'support', 'visual-anchor'], density: 'low' },
  section: { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['headline', 'support', 'visual-anchor'], density: 'low' },
  statement: { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['headline', 'support', 'visual-anchor'], density: 'low' },
  'image-hero': { text_safe_zone: 'bottom-left', visual_zone: ['center', 'right'], hierarchy: ['visual-anchor', 'caption'], density: 'low' },
  'two-column': { text_safe_zone: 'top', visual_zone: ['left', 'right'], hierarchy: ['headline', 'parallel-fields'], density: 'medium' },
  comparison: { text_safe_zone: 'top', visual_zone: ['left', 'right'], hierarchy: ['headline', 'parallel-fields'], density: 'medium' },
  process: { text_safe_zone: 'top-left', visual_zone: ['center', 'right'], hierarchy: ['headline', 'stages', 'direction'], density: 'medium' },
  data: { text_safe_zone: 'top-left', visual_zone: ['center', 'right'], hierarchy: ['headline', 'metric', 'evidence'], density: 'medium' },
  quote: { text_safe_zone: 'left', visual_zone: ['right'], hierarchy: ['quote', 'attribution', 'visual-anchor'], density: 'low' },
  closing: { text_safe_zone: 'bottom-left', visual_zone: ['right'], hierarchy: ['closing-claim', 'support', 'visual-anchor'], density: 'low' },
};

test('every active HTML style builds a ten-role golden deck', async () => {
  for (const themeRef of themes) {
    const project = await mkdtemp(join(tmpdir(), 'storyweave-golden-'));
    const draft = {
      schema_version: 3,
      status: 'draft',
      catalog_scope: 'active',
      title: `Golden ${themeRef}`,
      audience: '测试读者',
      purpose: '验证主题页面结构',
      page_count: PAGE_ROLES.length,
      central_message: '验证每个主题覆盖所有页面角色。',
      narrative: { opening: '开始', problem: '问题', insight: '判断', method: '方法', action: '行动' },
      language: 'zh-CN',
      canvas: '16:9',
      theme_ref: themeRef,
      reading_mode: 'speaker-led',
      slides: PAGE_ROLES.map((role, index) => ({
        id: `s${String(index + 1).padStart(2, '0')}`,
        role,
        purpose: `验证 ${role}`,
        claim: `${role} 页面主张`,
        exact_text: [`${role} 页面主张`, `示例内容 ${index + 1}`],
        evidence: [],
        visual_brief: 'A restrained structural test page with a clear visual anchor',
        visual_scheme_ref: 'auto',
        visual_anchor_id: `${themeRef.split('/')[0]}-anchor`,
        continuity_group: 'golden',
        page_rhythm: role === 'cover' || role === 'closing' ? 'anchor' : 'dense',
        layout_plan: layouts[role],
        transition: '继续',
      })),
    };
    await writeFile(join(project, 'outline_draft.json'), `${JSON.stringify(draft, null, 2)}\n`);
    await run(process.execPath, [cli.pathname, 'approve', project, '--theme-ref', themeRef]);
    await run(process.execPath, [cli.pathname, 'build', project]);
    const qa = await run(process.execPath, [cli.pathname, 'qa', project, '--json']);
    const report = JSON.parse(qa.stdout);
    assert.deepEqual(report.summary, { blocking: 0, warning: 0, degraded: 0 });
    const page = await readFile(join(project, 'slides', 's04.html'), 'utf8');
    assert.match(page, new RegExp(`data-theme-ref="${themeRef.replace('/', '\\/')}"`));
    assert.match(page, /data-render-recipe-ref=/);
    assert.match(page, /class="stage-viewport"/);
  }
});
