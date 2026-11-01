// Presentation-specific adaptation of unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.
// https://github.com/heydamir/unslop/tree/1d13095e4bef6ad6c74f1dd828d84c4ba309a4dc
import { freezeJson } from './hash.mjs';

export const VISUAL_POLICY_VERSION = '1.0.0';
export const VISUAL_POLICY = freezeJson({
  version: VISUAL_POLICY_VERSION,
  source: { name: 'unslop', author: 'Damir Sokolovsky (@heydamir)', license: 'CC-BY-4.0', url: 'https://github.com/heydamir/unslop', revision: '1d13095e4bef6ad6c74f1dd828d84c4ba309a4dc', adaptation: 'Presentation generation from approved content; not the upstream UI token system.' },
  principles: [
    'Choose visual form from the approved claim, information and audience. The theme supplies the visual language; it must not change factual meaning or relationships.',
    'Give the claim, its evidence or its relationship one clear focal hierarchy. Keep supporting surfaces and details quiet; rich material belongs to the content that needs it.',
    'Use an image only when its subject helps explain this particular claim. Describe that connection in one concrete sentence before selecting a subject; do not invent an object or metaphor to fill space.',
    'Keep colors, scale, proximity and arrows meaningful. Give neutral alternatives equal visual weight; never turn an unsupported emphasis into an apparent recommendation.',
    'Generic glossy shapes, AI robots or brains, decorative badges, glows, gradients and repeated cards are review signals, not a default design vocabulary. Use them only with a concrete content or chosen-medium reason.',
    'Preserve a clear existing reading path when repairing a local defect. Different themes may share the same useful composition; changing direction, adding visual variety or deleting color is not an improvement by itself.',
    'The page must still explain its claim without decorative effects. Keep required text readable, align related information, and let whitespace show grouping rather than separate related items.',
  ],
  review: [
    'Inspect actual generated pages for claim support, reading order, relationships, composition and content-specific imagery, then inspect the full deck for coherence and rhythm.',
    'For revisions, compare the actual baseline and candidate at the same scale. Any worse dimension blocks acceptance; uninspected or uncertain output stays unreviewed. Compilation and geometry do not establish visual quality.',
  ],
});

// This is a grounded generation instruction, never a model-written claim that a visual audit already passed.
export function createVisualIntent(slide) {
  const type = slide.content?.type ?? ({ data: 'metrics', 'two-column': 'comparison' }[slide.role] ?? slide.role ?? 'statement');
  const representation = {
    statement: 'Make the approved statement the focus. Add an image only if its subject explains that statement; a text-led page is complete without a decorative object.',
    comparison: 'Show the approved alternatives against their shared comparison axes. Align corresponding values and keep neutral columns equal in color, weight and area; do not invent a winning option.',
    metrics: 'Set each approved value beside its own unit, label and source. Use comparable scale only when units permit it. Do not invent trends, progress, sparklines or success indicators.',
    process: 'Compose the approved steps and directional edges as the process itself. Make entry, order and branching easy to follow; use a loop only when an approved edge actually returns.',
    graph: 'Show the approved nodes and edges as the subject. Make direction, branching and merging legible with short clear paths; style changes must not add edges, false groups or an unrelated illustration.',
  }[type] ?? 'Make the approved text and its actual information relationship the subject. Use the selected medium without adding an unrelated scene or factual detail.';
  return {
    policy_version: VISUAL_POLICY_VERSION,
    basis: 'approved-content',
    claim: slide.claim,
    content_type: type,
    representation,
    preserve: ['approved text and facts', 'authored order and relationships', 'clear existing reading paths'],
    review_status: 'required',
  };
}

export function visualGenerationInstructions(slide) {
  const intent = createVisualIntent(slide);
  return [
    `Visual meaning and generation policy ${VISUAL_POLICY_VERSION} (instructions, not visible copy):`,
    `Information form: ${intent.content_type}. ${intent.representation}`,
    // Keep the compiled brief focused; repeating the full audit rubric competes with the page's actual composition.
    'Build one clear focal hierarchy from this claim and its evidence. Keep supporting surfaces quiet; reserve rich color, material and detail for content that needs them.',
    'Use topic-specific imagery only when it explains this claim in one concrete sentence. A text-led page or authored diagram needs no extra object. Do not default to glossy blobs, AI brains, robots, glowing grids, badges or repeated cards.',
    'Preserve clear existing reading paths when fixing local defects. Different themes may share a useful composition. Make spacing show grouping, keep labels beside their objects, and keep required copy readable.',
    'If a theme fragment requests an unrelated prop or decorative effect, omit that fragment while preserving its relevant palette, typography and medium. Do not replace it with another generic decoration.',
    'These instructions add no visible text. Render only the approved verbatim list. A theme example, plausible sample data or a generated product view cannot supply new facts.',
  ].join('\n');
}
