import { canonicalJson, freezeJson, hashValue } from './hash.mjs';
import { PAGE_ROLES } from './theme-contract.mjs';

export const CONTENT_SCHEMA_VERSION = 4;
export const PLAN_SCHEMA_VERSION = 1;
const ID = /^[A-Za-z0-9_-]+$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const optionalText = (value) => value === undefined || typeof value === 'string';
const strings = (value, minimum = 0) => Array.isArray(value) && value.length >= minimum && value.every(text);
const narrativeKeys = ['opening', 'problem', 'insight', 'method', 'action'];
const contentTextKeys = ['title', 'audience', 'purpose', 'central_message', 'language'];
const slideTextKeys = ['claim', 'purpose', 'transition'];
const statuses = ['draft', 'approved'];
const readingModes = ['speaker-led', 'reading-first'];
const textField = { type: 'string' };
const nonemptyTextField = { type: 'string', minLength: 1, pattern: '\\S' };
const idField = { type: 'string', pattern: ID.source };
const textArrayField = { type: 'array', items: nonemptyTextField };
const nodeArrayField = {
  type: 'array', minItems: 1,
  items: { type: 'object', required: ['id', 'label'], properties: { id: idField, label: nonemptyTextField, detail: textField }, additionalProperties: true },
};
const edgeArrayField = {
  type: 'array',
  items: { type: 'object', required: ['from', 'to'], properties: { from: idField, to: idField, label: textField }, additionalProperties: true },
};

function relations(content, items, prefix, errors) {
  if (!Array.isArray(items) || items.length === 0) { errors.push(`${prefix} needs at least one node.`); return; }
  const ids = new Set();
  for (const item of items) {
    if (!record(item) || !text(item.id) || !ID.test(item.id) || ids.has(item.id) || !text(item.label) || !optionalText(item.detail)) errors.push(`${prefix} has an invalid or duplicate node.`);
    ids.add(item?.id);
  }
  if (!Array.isArray(content.edges)) { errors.push(`${prefix} edges must be explicit.`); return; }
  for (const edge of content.edges) if (!record(edge) || !ids.has(edge.from) || !ids.has(edge.to) || !optionalText(edge.label)) errors.push(`${prefix} edge endpoints must reference its nodes.`);
}

// The same field registry rejects unknown visible data and produces both generators' schemas.
const shapes = Object.fromEntries(Object.entries({
  statement: {
    fields: { body: textArrayField, kicker: textField, attribution: textField },
    required: ['body'],
    validate: (value, prefix, errors) => {
      if (!strings(value.body) || !optionalText(value.kicker) || !optionalText(value.attribution)) errors.push(`${prefix} statement needs a body string array and optional text.`);
    },
    visible: (value) => [...(value.kicker ? [value.kicker] : []), value.title, ...value.body, ...(value.attribution ? [value.attribution] : [])],
  },
  comparison: {
    fields: {
      columns: { ...textArrayField, minItems: 2 },
      rows: { type: 'array', minItems: 1, items: { type: 'object', required: ['label', 'values'], properties: { label: nonemptyTextField, values: textArrayField }, additionalProperties: true } },
    },
    required: ['columns', 'rows'],
    validate: (value, prefix, errors) => {
      if (!strings(value.columns, 2)) errors.push(`${prefix} comparison needs at least two column labels.`);
      if (!Array.isArray(value.rows) || value.rows.length === 0 || value.rows.some((row) => !record(row) || !text(row.label) || !strings(row.values) || row.values.length !== value.columns?.length)) errors.push(`${prefix} comparison rows must match the column count.`);
    },
    visible: (value) => [value.title, ...value.columns, ...value.rows.flatMap((row) => [row.label, ...row.values])],
  },
  process: {
    fields: { steps: nodeArrayField, edges: edgeArrayField },
    required: ['steps', 'edges'],
    validate: (value, prefix, errors) => relations(value, value.steps, prefix, errors),
    visible: (value) => [value.title, ...value.steps.flatMap((step) => [step.label, ...(step.detail ? [step.detail] : [])]), ...value.edges.flatMap((edge) => edge.label ? [edge.label] : [])],
  },
  metrics: {
    fields: {
      metrics: { type: 'array', minItems: 1, items: { type: 'object', required: ['value', 'unit', 'label', 'source'], properties: { value: nonemptyTextField, unit: textField, label: nonemptyTextField, source: nonemptyTextField }, additionalProperties: true } },
      body: textArrayField,
    },
    required: ['metrics'],
    validate: (value, prefix, errors) => {
      if (!Array.isArray(value.metrics) || value.metrics.length === 0 || value.metrics.some((metric) => !record(metric) || !text(metric.value) || typeof metric.unit !== 'string' || !text(metric.label) || !text(metric.source))) errors.push(`${prefix} metrics need a value, unit, label and source.`);
      if (value.body !== undefined && !strings(value.body)) errors.push(`${prefix} metrics body must be a string array.`);
    },
    visible: (value) => [value.title, ...value.metrics.flatMap((metric) => [metric.value, ...(metric.unit ? [metric.unit] : []), metric.label, metric.source]), ...(value.body ?? [])],
  },
  graph: {
    fields: { nodes: nodeArrayField, edges: edgeArrayField },
    required: ['nodes', 'edges'],
    validate: (value, prefix, errors) => relations(value, value.nodes, prefix, errors),
    visible: (value) => [value.title, ...value.nodes.flatMap((node) => [node.label, ...(node.detail ? [node.detail] : [])]), ...value.edges.flatMap((edge) => edge.label ? [edge.label] : [])],
  },
}).map(([type, shape]) => [type, {
  ...shape,
  fields: { type: { const: type }, title: nonemptyTextField, ...shape.fields },
  required: ['type', 'title', ...shape.required],
}]));

export function contentSchema() {
  return structuredClone({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://storyweave.local/contracts/content_v4.schema.json',
    title: 'StoryWeave structured content', type: 'object',
    required: ['schema_version', 'status', ...contentTextKeys, 'canvas', 'narrative', 'page_count', 'slides'],
    properties: {
      schema_version: { const: CONTENT_SCHEMA_VERSION }, status: { enum: statuses },
      ...Object.fromEntries(contentTextKeys.map((key) => [key, nonemptyTextField])),
      canvas: { const: '16:9' }, reading_mode: { enum: readingModes },
      narrative: { type: 'object', required: narrativeKeys, properties: Object.fromEntries(narrativeKeys.map((key) => [key, nonemptyTextField])), additionalProperties: true },
      narrativeReferences: { type: 'array', items: { type: 'object' }, description: 'Optional narrative reference metadata, separate from generator visual plans. Included in the content revision.' },
      page_count: { type: 'integer', minimum: 1 },
      revision: { type: 'string', pattern: SHA256.source, description: 'Derived by approveContent from authored facts, relationships, sources, notes and narrative references. Visual plans, approval time and exact_text do not affect this hash.' },
      approved_at: { ...textField, description: 'Time assigned by approveContent. It does not affect the content revision.' },
      slides: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', required: ['id', 'role', ...slideTextKeys, 'evidence', 'content'],
          properties: {
            id: idField, role: { enum: PAGE_ROLES },
            ...Object.fromEntries(slideTextKeys.map((key) => [key, nonemptyTextField])),
            evidence: { type: 'array' }, sources: { type: 'array' }, notes: textField, speaker_notes: textField,
            content: { oneOf: Object.values(shapes).map((shape) => ({ type: 'object', required: shape.required, properties: shape.fields, additionalProperties: false })) },
            exact_text: { type: 'array', items: textField, description: 'Visible text projected by approveContent from the structured content. assertApprovedContent rejects edits or stale projections.' },
          },
          additionalProperties: true,
        },
      },
    },
    $comment: 'validateContent also enforces page_count against slides, unique slide and node IDs, comparison row values against columns, and edge endpoints against node IDs. assertApprovedContent additionally requires approved status, a matching revision and matching derived exact_text. Draft visual metadata is allowed but excluded from the approved snapshot.',
    additionalProperties: true,
  });
}

export function validateContent(content) {
  const errors = [];
  if (!record(content)) return { valid: false, errors: ['Content must be an object.'] };
  if (content.schema_version !== CONTENT_SCHEMA_VERSION) errors.push('Content schema_version must be 4.');
  if (!statuses.includes(content.status)) errors.push('Content status must be draft or approved.');
  for (const key of contentTextKeys) if (!text(content[key])) errors.push(`Content ${key} must be nonempty text.`);
  if (content.canvas !== '16:9') errors.push('Content canvas must be 16:9.');
  if (content.reading_mode !== undefined && !readingModes.includes(content.reading_mode)) errors.push('Unknown reading_mode.');
  if (!record(content.narrative) || narrativeKeys.some((key) => !text(content.narrative[key]))) errors.push('Narrative needs opening, problem, insight, method and action.');
  if (content.narrativeReferences !== undefined && (!Array.isArray(content.narrativeReferences) || content.narrativeReferences.some((reference) => !record(reference)))) errors.push('Narrative references must be a separate record array.');
  if (!Array.isArray(content.slides) || content.slides.length === 0) errors.push('Content needs at least one slide.');
  if (!Number.isInteger(content.page_count) || content.page_count !== content.slides?.length) errors.push('page_count must match the authored slides.');
  const ids = new Set();
  for (const [index, slide] of (Array.isArray(content.slides) ? content.slides : []).entries()) {
    const prefix = `Slide ${index + 1}`;
    if (!record(slide)) { errors.push(`${prefix} must be an object.`); continue; }
    if (!text(slide.id) || !ID.test(slide.id) || ids.has(slide.id)) errors.push(`${prefix} needs a safe unique ID.`);
    ids.add(slide.id);
    if (!PAGE_ROLES.includes(slide.role)) errors.push(`${prefix} has an unknown communication role.`);
    for (const key of slideTextKeys) if (!text(slide[key])) errors.push(`${prefix} ${key} must be nonempty text.`);
    if (!Array.isArray(slide.evidence)) errors.push(`${prefix} evidence must be an array.`);
    if (slide.sources !== undefined && !Array.isArray(slide.sources)) errors.push(`${prefix} sources must be an array.`);
    if (!optionalText(slide.notes) || !optionalText(slide.speaker_notes)) errors.push(`${prefix} notes must be text.`);
    const value = slide.content;
    const shape = record(value) && Object.hasOwn(shapes, value.type) ? shapes[value.type] : null;
    if (!shape) { errors.push(`${prefix} needs a supported structured content type.`); continue; }
    if (!text(value.title)) errors.push(`${prefix} content title must be nonempty text.`);
    if (Object.keys(value).some((key) => !Object.hasOwn(shape.fields, key))) errors.push(`${prefix} contains unsupported ${value.type} content fields.`);
    shape.validate(value, prefix, errors);
  }
  return { valid: errors.length === 0, errors };
}

export function visibleText(value) {
  if (Array.isArray(value.slides)) return value.slides.flatMap((slide) => visibleText(slide));
  const content = value.content ?? value;
  const shape = Object.hasOwn(shapes, content.type) ? shapes[content.type] : null;
  if (!shape) throw new Error(`Unknown structured content type: ${content.type}`);
  return shape.visible(content);
}

function contentSnapshot(content) {
  const snapshot = Object.fromEntries(['title', 'audience', 'purpose', 'central_message', 'narrative', 'language', 'canvas'].map((key) => [key, structuredClone(content[key])]));
  return {
    schema_version: CONTENT_SCHEMA_VERSION, ...snapshot,
    reading_mode: content.reading_mode ?? 'speaker-led',
    narrativeReferences: structuredClone(content.narrativeReferences ?? []),
    page_count: content.slides.length,
    slides: content.slides.map((slide) => ({
      ...Object.fromEntries(['id', 'role', 'claim', 'purpose', 'evidence', 'sources', 'notes', 'speaker_notes', 'transition', 'content'].filter((key) => slide[key] !== undefined).map((key) => [key, structuredClone(slide[key])])),
      sources: structuredClone(slide.sources ?? []),
    })),
  };
}

export function contentRevision(content) {
  return hashValue(contentSnapshot(content));
}

export function approveContent(draft, { approvedAt = new Date().toISOString() } = {}) {
  const result = validateContent(draft);
  if (!result.valid) throw new Error(result.errors.join(' '));
  const snapshot = contentSnapshot(draft);
  // Visual choices are a generator plan; they cannot revise approved facts.
  return freezeJson({
    ...snapshot, status: 'approved', revision: hashValue(snapshot), approved_at: approvedAt,
    slides: snapshot.slides.map((slide) => ({ ...slide, exact_text: visibleText(slide) })),
  });
}

export function assertApprovedContent(content) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.errors.join(' '));
  if (content.status !== 'approved') throw new Error('Content has not been approved.');
  if (!SHA256.test(content.revision) || content.revision !== contentRevision(content)) throw new Error('Approved content revision does not match its authored facts.');
  for (const slide of content.slides) if (!Array.isArray(slide.exact_text) || canonicalJson(slide.exact_text) !== canonicalJson(visibleText(slide))) throw new Error(`Approved visible text does not match the structured content on ${slide.id}.`);
  return freezeJson(structuredClone(content));
}
