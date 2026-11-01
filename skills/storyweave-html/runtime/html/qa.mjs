import { access, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { optionalDependency } from '../core/resources.mjs';
import { writeJsonAtomic } from '../core/storage.mjs';

const exists = (path) => access(path).then(() => true, () => false);
const normalize = (value) => String(value).replace(/\s+/gu, ' ').trim();

async function settle(page) {
  await page.locator('.stage').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
  });
}

async function inspectPage(page, expectedChrome) {
  return page.evaluate((chrome) => {
    const slide = document.querySelector('[data-storyweave-slide].active');
    const stage = document.querySelector('.stage')?.getBoundingClientRect();
    const bounds = (rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    // Geometry is measured in 1280x720 design units, including on a 390px portrait viewport.
    const scale = stage ? stage.width / 1280 : 1;
    const outside = (rect) => stage && (rect.left < stage.left - scale || rect.top < stage.top - scale || rect.right > stage.right + scale || rect.bottom > stage.bottom - 12 * scale);
    const painted = (element) => {
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const elements = [...(slide?.querySelectorAll('[data-storyweave-content]') ?? [])].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && painted(element);
    });
    const unmarked = [];
    if (document.body) {
      // Entry-page overlays can add claims outside the slide, including ones with forged content markers.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = node.textContent.replace(/\s+/gu, ' ').trim();
        const parent = node.parentElement;
        if (!value || !parent || !painted(parent)) continue;
        const inSlide = slide?.contains(parent);
        if (inSlide && parent.closest('[data-storyweave-content]')) continue;
        const counter = inSlide && parent.matches('.counter') && parent.textContent.replace(/\s+/gu, ' ').trim() === chrome.counter;
        const step = inSlide && parent.matches('.step-index') && parent.parentElement?.matches('.process-rail > li') && chrome.steps[parent.parentElement.dataset.nodeId] === value;
        const navigation = chrome.navigation && parent.parentElement === document.body && ((parent.matches('button.nav.prev[aria-label="上一页"]') && value === '‹') || (parent.matches('button.nav.next[aria-label="下一页"]') && value === '›'));
        if (counter || step || navigation) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) unmarked.push(value);
      }
    }
    const regions = [...(slide?.querySelectorAll('[data-storyweave-region]') ?? [])].map((element) => ({ name: element.dataset.storyweaveRegion, rect: element.getBoundingClientRect() }));
    const overlaps = [];
    for (let index = 0; index < regions.length; index += 1) {
      for (const next of regions.slice(index + 1)) {
        const current = regions[index];
        const a = current.rect;
        const b = next.rect;
        if (Math.max(a.left, b.left) < Math.min(a.right, b.right) && Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom) && !slide?.classList.contains('role-image-hero')) overlaps.push(`${current.name}:${next.name}`);
      }
    }
    const nodes = [...(slide?.querySelectorAll('.relationship-node') ?? [])].map((node) => ({ id: node.dataset.nodeId, rect: node.getBoundingClientRect() }));
    const nodeOverlaps = [];
    for (let index = 0; index < nodes.length; index += 1) {
      for (const next of nodes.slice(index + 1)) {
        const a = nodes[index].rect;
        const b = next.rect;
        if (Math.max(a.left, b.left) < Math.min(a.right, b.right) && Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom)) nodeOverlaps.push(`${nodes[index].id}:${next.id}`);
      }
    }
    const title = slide?.querySelector('h1');
    const titleStyle = title && getComputedStyle(title);
    // Measure glyph rows for all native copy; title-only checks missed isolated “源” and “度”.
    const measureText = (element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || Number.parseFloat(getComputedStyle(element).fontSize) * 1.4;
      const rows = [];
      const glyphs = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        let offset = 0;
        for (const character of node.textContent) {
          const range = document.createRange();
          range.setStart(node, offset);
          offset += character.length;
          range.setEnd(node, offset);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !character.trim()) continue;
          const center = rect.top + rect.height / 2;
          let row = rows.find((item) => Math.abs(item.center - center) < lineHeight * scale * .4);
          if (!row) { row = { center, text: '' }; rows.push(row); }
          row.text += character;
          glyphs.push(rect);
        }
      }
      return { rows: rows.map((row) => row.text), glyphs };
    };
    const measurements = new Map([...elements, ...(slide?.querySelectorAll('.step-index') ?? [])].map((element) => [element, measureText(element)]));
    const titleRows = measurements.get(title)?.rows ?? [];
    const copyRows = elements.filter((element) => element !== title).map((element) => ({ kind: element.dataset.storyweaveContent, text: element.textContent, rows: measurements.get(element).rows }));
    const splitWords = [...(slide?.querySelectorAll('[data-storyweave-word]') ?? [])].filter((element) => measureText(element).rows.length > 1).map((element) => element.textContent);
    const connectionCollisions = [];
    const connectionEndpoints = [];
    for (const edge of slide?.querySelectorAll('.relationship-connections [data-edge-from][data-edge-to]') ?? []) {
      const path = edge.querySelector('path');
      const length = path?.getTotalLength() ?? 0;
      const matrix = path?.getScreenCTM();
      const field = edge.closest('svg').parentElement;
      const byId = new Map([...field.querySelectorAll('[data-node-id]')].map((node) => [node.dataset.nodeId, node]));
      const fromNode = byId.get(edge.dataset.edgeFrom);
      const toNode = byId.get(edge.dataset.edgeTo);
      const screenPoint = (position) => { const point = path.getPointAtLength(position); return new DOMPoint(point.x, point.y).matrixTransform(matrix); };
      const distance = (point, element) => {
        if (!element) return Infinity;
        const r = (element.querySelector('.step-anchor') ?? element).getBoundingClientRect();
        return Math.hypot(Math.max(r.left - point.x, 0, point.x - r.right), Math.max(r.top - point.y, 0, point.y - r.bottom)) / scale;
      };
      const fromDistance = length && matrix ? distance(screenPoint(0), fromNode) : null;
      const toDistance = length && matrix ? distance(screenPoint(length), toNode) : null;
      connectionEndpoints.push({ from: edge.dataset.edgeFrom, to: edge.dataset.edgeTo, length, from_distance: fromDistance, to_distance: toDistance });
      if (!length || !matrix) continue;
      const obstacles = [...measurements].filter(([element]) => !edge.contains(element)).flatMap(([element, item]) => item.glyphs.map((rect) => ({ name: element.dataset.storyweaveContent ?? 'step-index', rect })));
      // An edge may also cross an unrelated card without touching its text.
      for (const node of field.querySelectorAll('.relationship-node')) if (node !== fromNode && node !== toNode) obstacles.push({ name: `node:${node.dataset.nodeId}`, rect: node.getBoundingClientRect() });
      const hits = new Set();
      for (let position = 0; position <= length; position += 4) {
        const point = screenPoint(position);
        for (const { name, rect } of obstacles) if (point.x > rect.left - 2 * scale && point.x < rect.right + 2 * scale && point.y > rect.top - 2 * scale && point.y < rect.bottom + 2 * scale) hits.add(name);
      }
      if (hits.size) connectionCollisions.push({ from: edge.dataset.edgeFrom, to: edge.dataset.edgeTo, obstacles: [...hits] });
    }
    const titleRect = title?.getBoundingClientRect();
    const next = slide?.querySelector('.layout-body, .statement-body');
    const nextRect = next?.getBoundingClientRect();
    const separatedHorizontally = titleRect && nextRect && (nextRect.left >= titleRect.right - scale || titleRect.left >= nextRect.right - scale);
    const nativeOverlaps = [];
    for (const [index, current] of elements.entries()) for (const other of elements.slice(index + 1)) {
      if (current.contains(other) || other.contains(current)) continue;
      const a = current.getBoundingClientRect();
      const b = other.getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > scale && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > scale) nativeOverlaps.push(`${current.dataset.storyweaveContent}:${other.dataset.storyweaveContent}`);
    }
    const images = [...(slide?.querySelectorAll('.asset-figure img') ?? [])].map((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      const sourceScale = style.objectFit === 'contain' ? Math.min(image.clientWidth / image.naturalWidth, image.clientHeight / image.naturalHeight) : Math.max(image.clientWidth / image.naturalWidth, image.clientHeight / image.naturalHeight);
      const [x, y] = style.objectPosition.split(' ').map((value) => Number.parseFloat(value) / 100);
      const cropWidth = image.clientWidth / (image.naturalWidth * sourceScale);
      const cropHeight = image.clientHeight / (image.naturalHeight * sourceScale);
      return { asset_id: image.closest('figure').dataset.assetId, fit: style.objectFit, focal_point: { x, y }, width: rect.width / scale, height: rect.height / scale,
        visible_source: { x: Math.max(0, (1 - cropWidth) * x), y: Math.max(0, (1 - cropHeight) * y), width: Math.min(1, cropWidth), height: Math.min(1, cropHeight) } };
    });
    return {
      id: slide?.dataset.slideId,
      count: document.querySelectorAll('[data-storyweave-slide]').length,
      active_count: document.querySelectorAll('[data-storyweave-slide].active').length,
      layout_id: slide?.dataset.layoutId,
      theme_ref: document.querySelector('meta[name="storyweave-theme-ref"]')?.content,
      legacy_theme: document.querySelector('meta[name="storyweave-legacy-theme"]')?.content,
      content_revision: document.querySelector('meta[name="storyweave-content-revision"]')?.content,
      stage: stage ? bounds(stage) : null,
      text: slide?.innerText ?? '',
      leaf_text: elements.map((element) => element.textContent?.replace(/\s+/gu, ' ').trim()).filter(Boolean),
      unmarked_text: unmarked,
      comparison: {
        columns: [...(slide?.querySelectorAll('.comparison-matrix thead th[scope="col"]') ?? [])].map((column) => column.textContent),
        rows: [...(slide?.querySelectorAll('.comparison-matrix tbody > tr') ?? [])].map((row) => ({ label: row.querySelector('th[scope="row"]')?.textContent ?? '', values: [...row.querySelectorAll('td')].map((cell) => cell.textContent) })),
      },
      metrics: [...(slide?.querySelectorAll('.metric-entry') ?? [])].map((entry) => ({ value: entry.querySelector('[data-storyweave-content="metric-value"]')?.textContent ?? '', unit: entry.querySelector('[data-storyweave-content="metric-unit"]')?.textContent ?? '', label: entry.querySelector('[data-storyweave-content="metric-label"]')?.textContent ?? '', source: entry.querySelector('.metric-source')?.textContent ?? '' })),
      nodes: [...(slide?.querySelectorAll('[data-node-id]') ?? [])].map((node) => ({ id: node.dataset.nodeId, label: node.querySelector('[data-storyweave-content="node-label"]')?.textContent ?? '', detail: node.querySelector('[data-storyweave-content="body"]')?.textContent ?? '' })),
      edges: [...(slide?.querySelectorAll('[data-edge-from][data-edge-to]') ?? [])].map((edge) => ({ from: edge.dataset.edgeFrom, to: edge.dataset.edgeTo, label: edge.querySelector('[data-storyweave-content="edge-label"]')?.textContent ?? '' })),
      outside: elements.filter((element) => outside(element.getBoundingClientRect())).map((element) => element.dataset.storyweaveContent),
      font_sizes: elements.map((element) => ({ kind: element.dataset.storyweaveContent, size: Number.parseFloat(getComputedStyle(element).fontSize) })),
      font_weights: elements.map((element) => ({ kind: element.dataset.storyweaveContent, weight: Number.parseFloat(getComputedStyle(element).fontWeight) })),
      title_weight: Number.parseFloat(titleStyle?.fontWeight),
      title_size: Number.parseFloat(titleStyle?.fontSize),
      title_rows: titleRows,
      copy_rows: copyRows,
      split_words: splitWords,
      connection_collisions: connectionCollisions,
      connection_endpoints: connectionEndpoints,
      comparison_styles: [...(slide?.querySelectorAll('.comparison-matrix tbody > tr') ?? [])].map((row) => [...row.querySelectorAll('td')].map((cell) => ({ color: getComputedStyle(cell).color, weight: getComputedStyle(cell).fontWeight }))),
      composition: slide?.dataset.composition,
      title_body_gap: titleRect && nextRect ? (separatedHorizontally ? Math.max(nextRect.left - titleRect.right, titleRect.left - nextRect.right) : nextRect.top - titleRect.bottom) / scale : null,
      content_bottom: elements.length ? Math.max(...elements.map((element) => (element.getBoundingClientRect().bottom - stage.top) / scale), ...[...(slide?.querySelectorAll('.asset-figure') ?? [])].map((element) => (element.getBoundingClientRect().bottom - stage.top) / scale)) : 0,
      native_overlaps: nativeOverlaps,
      images,
      nav_overlaps: [...document.querySelectorAll('button.nav')].flatMap((button) => {
        const nav = button.getBoundingClientRect();
        return elements.filter((element) => { const r = element.getBoundingClientRect(); return Math.max(nav.left, r.left) < Math.min(nav.right, r.right) && Math.max(nav.top, r.top) < Math.min(nav.bottom, r.bottom); }).map((element) => element.dataset.storyweaveContent);
      }),
      title_lines: titleStyle ? Math.round(title.getBoundingClientRect().height / (Number.parseFloat(titleStyle.lineHeight) * (stage.width / 1280))) : 0,
      title_length: title?.textContent?.length ?? 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      region_overlaps: overlaps,
      node_overlaps: nodeOverlaps,
      broken_assets: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')),
    };
  }, expectedChrome);
}

function textFindings(state, slide, structured) {
  if (!structured) return { missing: (slide.exact_text ?? []).filter((value) => !normalize(state.text).includes(normalize(value))), unexpected: [] };
  const available = new Map();
  for (const value of state.leaf_text.map(normalize)) available.set(value, (available.get(value) ?? 0) + 1);
  const missing = [];
  for (const expected of (slide.exact_text ?? []).map(normalize).filter(Boolean)) {
    if (!available.get(expected)) missing.push(expected);
    else available.set(expected, available.get(expected) - 1);
  }
  // A complete projection also rejects appended claims or duplicate labels that preserve all original words.
  const unexpected = [...available].filter(([, count]) => count > 0).flatMap(([value, count]) => Array(count).fill(value));
  return { missing, unexpected };
}

export async function inspectHtmlProject(root, manifest, content, plan = null) {
  const findings = [];
  const screenshots = [];
  const states = [];
  const galleryStates = [];
  for (const slide of manifest.slides) {
    const path = resolve(root, slide.source);
    if (!(await exists(path))) findings.push({ severity: 'blocking', code: 'slide.missing', slide_id: slide.id, message: `Missing ${slide.source}.` });
    else if (!(await readFile(path, 'utf8')).includes(`data-slide-id="${slide.id}"`)) findings.push({ severity: 'blocking', code: 'slide.contract', slide_id: slide.id, message: 'Standalone slide identity is missing.' });
  }
  const loaded = await optionalDependency('playwright', 'storyweave-html');
  if (!loaded) return { mode: 'degraded', findings: [...findings, { severity: 'degraded', code: 'browser.unavailable', message: 'Install Playwright to perform final HTML QA.' }], screenshots, states };
  let browser;
  try { browser = await (loaded.chromium ?? loaded.default?.chromium).launch({ headless: true }); }
  catch (error) { return { mode: 'degraded', findings: [...findings, { severity: 'degraded', code: 'browser.unavailable', message: error.message }], screenshots, states }; }
  const directory = join(root, 'qa', 'screenshots');
  await mkdir(directory, { recursive: true });
  const chromeFor = (index, navigation = false) => ({
    navigation,
    counter: `${String(index + 1).padStart(2, '0')} / ${String(manifest.slides.length).padStart(2, '0')}`,
    steps: Object.fromEntries((content.slides[index].content?.steps ?? []).map((step, stepIndex) => [step.id, String(stepIndex + 1).padStart(2, '0')])),
  });
  const reviewState = (state, index, viewport, surface) => {
    const slide = manifest.slides[index];
    const add = (code, message) => findings.push({ severity: 'blocking', code, slide_id: slide.id, viewport, surface, message });
    const pageCount = surface === 'gallery' ? manifest.slides.length : 1;
    if (state.id !== slide.id || state.count !== pageCount || state.active_count !== 1) add('browser.slide_identity', 'The page must show exactly its declared active slide.');
    if (!state.stage || Math.abs(state.stage.width / state.stage.height - 16 / 9) > 0.01) add('browser.stage_geometry', 'The stage must preserve 16:9.');
    if (state.overflow) add('browser.overflow', 'Page causes viewport scrolling.');
    if (state.outside.length) add('browser.text_bounds', `Native content leaves the stage: ${state.outside.join(', ')}.`);
    if (state.region_overlaps.length) add('browser.region_overlap', `Main regions overlap: ${state.region_overlaps.join(', ')}.`);
    if (state.node_overlaps.length) add('browser.node_overlap', `Relationship nodes overlap: ${state.node_overlaps.join(', ')}. Split the diagram or reduce its density.`);
    if (state.broken_assets.length) add('browser.asset_broken', 'One or more declared images failed to load.');
    if (manifest.version === 2 && state.theme_ref !== manifest.theme_ref) add('browser.theme_ref', 'Rendered theme differs from the manifest.');
    const structured = content.schema_version === 4;
    const { missing, unexpected } = textFindings(state, content.slides[index], structured);
    if (missing.length) add('browser.visible_text', `Confirmed text is missing: ${missing.join(' | ')}`);
    // Actual visible text is reviewed even when an editor omits the renderer's content marker or adds aria-hidden.
    if (structured && (unexpected.length || state.unmarked_text.length)) add('browser.unapproved_text', `Native content is absent from the approved text projection: ${[...unexpected, ...state.unmarked_text].join(' | ')}`);
    if (structured) {
      if (state.content_revision !== content.revision) add('browser.content_revision', 'Rendered content revision differs from the approved content.');
      const authored = content.slides[index].content;
      // A word multiset cannot detect values assigned to the wrong column, metric or node.
      const comparisonShape = (comparison) => ({ columns: comparison.columns.map(normalize), rows: comparison.rows.map((row) => ({ label: normalize(row.label), values: row.values.map(normalize) })) });
      if (authored.type === 'comparison' && JSON.stringify(comparisonShape(state.comparison)) !== JSON.stringify(comparisonShape(authored))) add('browser.content_structure', 'Rendered comparison columns, row labels or cell associations differ from the approved content.');
      if (authored.type === 'metrics') {
        const metricShape = (metrics) => metrics.map((metric) => ['value', 'unit', 'label', 'source'].map((key) => normalize(metric[key] ?? '')));
        if (JSON.stringify(metricShape(state.metrics)) !== JSON.stringify(metricShape(authored.metrics))) add('browser.content_structure', 'Rendered metric values, units, labels or sources differ from the approved content.');
      }
      if (['process', 'graph'].includes(authored.type)) {
        // Labels alone cannot prove a diagram: the rendered node identities and edge endpoints must preserve authored relationships.
        const signatures = (items, keys) => items.map((item) => JSON.stringify(keys.map((key) => normalize(item[key] ?? '')))).sort();
        const expectedNodes = signatures(authored.steps ?? authored.nodes, ['id', 'label', 'detail']);
        const expectedEdges = signatures(authored.edges, ['from', 'to', 'label']);
        if (JSON.stringify(signatures(state.nodes, ['id', 'label', 'detail'])) !== JSON.stringify(expectedNodes) || JSON.stringify(signatures(state.edges, ['from', 'to', 'label'])) !== JSON.stringify(expectedEdges)) add('browser.relationships', 'Rendered node identities, details or directional relationships differ from the approved content.');
      }
      if (state.title_lines > (state.title_length > 32 ? 3 : 2)) add('browser.title_capacity', 'Title exceeds its line capacity.');
      if (state.font_sizes.some(({ kind, size }) => Number.isFinite(size) && size < (['caption', 'kicker'].includes(kind) ? 16 : 24))) add('browser.font_size', 'Primary copy must be at least 24px and captions at least 16px on the fixed stage.');
      const pagePlan = plan?.slides[index];
      if (pagePlan?.geometry) {
        const geometry = pagePlan.geometry;
        if (state.title_rows.length > geometry.title_max_lines) add('browser.title_capacity', 'Measured glyph rows exceed this layout’s title capacity.');
        if (state.title_rows.length > 1 && state.title_rows.some((row) => [...row.replace(/[\p{P}\p{Z}]/gu, '')].length <= 1)) add('browser.title_orphan', 'A title line contains only one meaningful character. Choose a wider title slot or replan.');
        if (state.native_overlaps.length) add('browser.native_overlap', `Native text overlaps: ${state.native_overlaps.join(', ')}.`);
        const orphanCopy = state.copy_rows.filter((copy) => copy.rows.length > 1 && [...copy.text.matchAll(/\p{Script=Han}/gu)].length >= 4 && copy.rows.some((row) => /^[\p{Script=Han}\p{P}\p{Z}]+$/u.test(row) && [...row.replace(/[\p{P}\p{Z}]/gu, '')].length === 1));
        if (orphanCopy.length) add('browser.copy_orphan', `Native copy contains an isolated Chinese character: ${orphanCopy.map((copy) => copy.text).join(' | ')}`);
        if (state.split_words.length) add('browser.word_split', `Short Chinese words split across rows: ${state.split_words.join(' | ')}`);
        if (state.connection_collisions.length) add('browser.connection_collision', `Connections cross text, step numbers or unrelated cards: ${JSON.stringify(state.connection_collisions)}`);
        if (state.connection_endpoints.some((edge) => edge.length < 1 || edge.from_distance < 4 || edge.from_distance > 20 || edge.to_distance < 4 || edge.to_distance > 20 || edge.from_distance === null || edge.to_distance === null)) add('browser.connection_endpoint', 'A connection is missing or detached from its authored node boundary.');
        if (pagePlan.comparison_emphasis === 'neutral' && state.comparison_styles.some((row) => row.some((style) => style.color !== row[0]?.color || style.weight !== row[0]?.weight))) add('browser.comparison_emphasis', 'A neutral comparison must give its data columns equal text color and weight.');
        if (state.composition !== pagePlan.composition) add('browser.composition', 'Rendered composition differs from the visual plan.');
        if (state.content_bottom > 720 - geometry.content_safe_bottom + 1) add('browser.bottom_safe_area', `Content reaches y=${Math.round(state.content_bottom)}; this layout reserves ${geometry.content_safe_bottom}px at the bottom.`);
        if (state.nav_overlaps.length) add('browser.navigation_safe_area', 'Gallery navigation obscures native content.');
        if (state.title_body_gap !== null && state.title_body_gap < geometry.title_body_gap - 1) add('browser.title_gap', `Title/content gap is ${Math.round(state.title_body_gap)}px; this layout needs ${geometry.title_body_gap}px.`);
        if (['swiss', 'magazine'].includes(plan.visual_system) && (state.title_size > geometry.title_size + 1 || state.title_weight !== geometry.title_weight)) add('browser.title_typography', 'Title size or weight differs from the visual plan.');
        if (state.font_weights.some(({ kind, weight }) => ['body', 'caption', 'kicker'].includes(kind) && weight < (kind === 'body' ? plan.typography.body_weight : plan.typography.caption_weight))) add('browser.copy_weight', 'Body or small text is lighter than the planned readability threshold.');
        for (const slot of pagePlan.asset_slots) {
          const image = state.images.find((item) => item.asset_id === slot.asset_id);
          if (!image) { add('browser.asset_slot', `Image slot ${slot.asset_id} is absent.`); continue; }
          const [width, height] = slot.aspect_ratio.split(':').map(Number);
          if (Math.abs(image.width / image.height - width / height) > .02 || image.fit !== slot.fit || Math.abs(image.focal_point.x - slot.focal_point.x) > .01 || Math.abs(image.focal_point.y - slot.focal_point.y) > .01) add('browser.asset_slot', 'Image ratio, fit or focal point differs from the visual plan.');
          const safe = slot.subject_safe_area;
          const visible = image.visible_source;
          if (safe && (safe.x < visible.x - .01 || safe.y < visible.y - .01 || safe.x + safe.width > visible.x + visible.width + .01 || safe.y + safe.height > visible.y + visible.height + .01)) add('browser.asset_crop', 'The image crop cuts into its declared subject safe area.');
        }
      }
    }
  };
  try {
    for (const viewport of [{ id: 'desktop', width: 1280, height: 720 }, { id: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      for (const [index, slide] of manifest.slides.entries()) {
        if (!(await exists(resolve(root, slide.source)))) continue;
        await page.goto(pathToFileURL(resolve(root, slide.source)).href, { waitUntil: 'load' });
        await settle(page);
        const state = await inspectPage(page, chromeFor(index));
        states.push({ slide_id: slide.id, viewport: viewport.id, ...state });
        reviewState(state, index, viewport.id, 'standalone');
        const screenshot = join(directory, `${slide.id}${viewport.id === 'desktop' ? '' : '-mobile'}.png`);
        await page.screenshot({ path: screenshot, animations: 'disabled' });
        screenshots.push(screenshot);
      }
      // The delivered entry can be hand edited independently of standalone pages; inspect every active gallery page too.
      await page.goto(pathToFileURL(join(root, manifest.entry)).href, { waitUntil: 'load' });
      await page.keyboard.press('Home');
      for (const [index, slide] of manifest.slides.entries()) {
        if (index > 0) await page.keyboard.press('ArrowRight');
        await settle(page);
        const state = await inspectPage(page, chromeFor(index, true));
        galleryStates.push({ slide_id: slide.id, viewport: viewport.id, ...state });
        reviewState(state, index, viewport.id, 'gallery');
      }
      if (errors.length) findings.push(...errors.map((message) => ({ severity: 'blocking', code: 'browser.error', viewport: viewport.id, message })));
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(join(root, manifest.entry)).href, { waitUntil: 'load' });
    await settle(page);
    const first = manifest.slides[0].id;
    const second = manifest.slides[1]?.id ?? first;
    const currentId = () => page.locator('[data-storyweave-slide].active').getAttribute('data-slide-id');
    const navigation = [];
    for (const [name, action, expected] of [
      ['next-button', () => page.getByRole('button', { name: '下一页' }).click(), second],
      ['previous-button', () => page.getByRole('button', { name: '上一页' }).click(), first],
      ['focused-space', () => page.keyboard.press('Space'), second],
      ['home', () => page.keyboard.press('Home'), first],
      ['end', () => page.keyboard.press('End'), manifest.slides.at(-1).id],
    ]) {
      const before = await currentId();
      await action();
      const actual = await currentId();
      navigation.push({ action: name, before, expected, actual });
      if (actual !== expected) findings.push({ severity: 'blocking', code: 'browser.navigation', message: `${name} showed ${actual}, expected ${expected}.` });
    }
    await writeJsonAtomic(join(root, 'qa', 'navigation.json'), navigation);
    await page.close();
  } finally { await browser.close(); }
  await writeJsonAtomic(join(root, 'qa', 'browser-states.json'), states);
  await writeJsonAtomic(join(root, 'qa', 'gallery-states.json'), galleryStates);
  return { mode: 'browser', findings, screenshots, states };
}
