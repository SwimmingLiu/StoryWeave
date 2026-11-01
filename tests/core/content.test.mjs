import assert from 'node:assert/strict';
import test from 'node:test';
import { approveContent, assertApprovedContent, contentRevision, contentSchema, validateContent, visibleText } from '../../src/core/content.mjs';

function draft(content = { type: 'statement', title: 'Confirm content', body: ['Preserve supplied facts.'] }) {
  return {
    schema_version: 4, status: 'draft', title: 'A caller presentation', audience: 'Project authors', purpose: 'Explain a workflow', central_message: 'Content and visual plans have different owners.',
    language: 'en', canvas: '16:9', reading_mode: 'speaker-led', page_count: 1,
    narrative: { opening: 'A concrete claim.', problem: 'A concrete obstacle.', insight: 'A useful relation.', method: 'Explicit steps.', action: 'An action.' },
    narrativeReferences: [{ case_id: 'sample-case', purpose: 'narrative order' }],
    slides: [{ id: 's01', role: 'statement', claim: 'Use the authored relationship.', purpose: 'Explain the relationship.', evidence: [], sources: ['Project brief'], notes: 'Speaker note', transition: 'Continue', content }],
  };
}

test('approval preserves authored content while deriving the visible text', () => {
  const input = draft({ type: 'statement', kicker: 'WORKFLOW', title: 'Confirm content', body: ['Preserve supplied facts.'], attribution: 'Project brief' });
  const before = structuredClone(input);
  const approved = approveContent(input);
  assert.deepEqual(input, before);
  assert.equal(approved.status, 'approved');
  assert.deepEqual(approved.slides[0].exact_text, ['WORKFLOW', 'Confirm content', 'Preserve supplied facts.', 'Project brief']);
  assert.deepEqual(approved.slides[0].sources, ['Project brief']);
  assert.equal(approved.slides[0].notes, 'Speaker note');
  assert.equal(approved.narrativeReferences[0].case_id, 'sample-case');
  assert.throws(() => approved.slides[0].content.body.push('Unapproved fact'), TypeError);
  assert.equal(assertApprovedContent(approved).revision, approved.revision);
});

test('visual authoring choices and approval time do not revise facts', () => {
  const input = draft();
  input.theme_ref = 'editorial/paper-magazine';
  input.slides[0].layout_id = 'some-layout';
  input.slides[0].exact_text = ['A stale authoring projection'];
  const first = approveContent(input, { approvedAt: '2026-01-01T00:00:00.000Z' });
  input.theme_ref = 'systems/ink-blue-grid';
  input.slides[0].layout_id = 'another-layout';
  const second = approveContent(input, { approvedAt: '2026-01-02T00:00:00.000Z' });
  assert.equal(second.revision, first.revision);
  assert.equal(contentRevision(input), first.revision);
  assert.equal(first.theme_ref, undefined);
  assert.equal(first.slides[0].layout_id, undefined);
  assert.notEqual(second.approved_at, first.approved_at);
  assert.deepEqual(first.slides[0].exact_text, ['Confirm content', 'Preserve supplied facts.']);
});

test('fact, source, relationship and speaker-note edits each change the approved revision', () => {
  const original = draft({ type: 'process', title: 'Two steps', steps: [{ id: 'a', label: 'Collect' }, { id: 'b', label: 'Confirm' }], edges: [{ from: 'a', to: 'b' }] });
  const revision = approveContent(original).revision;
  for (const mutate of [
    (value) => { value.slides[0].content.title = 'Changed title'; },
    (value) => { value.slides[0].sources.push('Additional source'); },
    (value) => { value.slides[0].content.edges.push({ from: 'b', to: 'a', label: 'Feedback' }); },
    (value) => { value.slides[0].notes = 'Changed speaker note'; },
  ]) {
    const edited = structuredClone(original);
    mutate(edited);
    assert.notEqual(approveContent(edited).revision, revision);
  }
});

test('comparison, process, graph and metrics project only their authored visible fields', () => {
  const cases = [
    [{ type: 'comparison', title: 'Compare', columns: ['A', 'B'], rows: [{ label: 'Owner', values: ['Author', 'Renderer'] }] }, ['Compare', 'A', 'B', 'Owner', 'Author', 'Renderer']],
    [{ type: 'process', title: 'Flow', steps: [{ id: 'a', label: 'Collect', detail: 'Keep evidence' }, { id: 'b', label: 'Confirm' }], edges: [{ from: 'a', to: 'b', label: 'Next' }] }, ['Flow', 'Collect', 'Keep evidence', 'Confirm', 'Next']],
    [{ type: 'graph', title: 'Graph', nodes: [{ id: 'a', label: 'Author' }, { id: 'b', label: 'Page', detail: 'Native HTML' }], edges: [{ from: 'a', to: 'b', label: 'creates' }] }, ['Graph', 'Author', 'Page', 'Native HTML', 'creates']],
    [{ type: 'metrics', title: 'Canvas', metrics: [{ value: '1280', unit: 'px', label: 'Width', source: 'Project contract' }], body: ['Use a fixed stage.'] }, ['Canvas', '1280', 'px', 'Width', 'Project contract', 'Use a fixed stage.']],
  ];
  for (const [content, expected] of cases) {
    const authored = draft(content);
    assert.equal(validateContent(authored).valid, true);
    assert.deepEqual(visibleText(authored.slides[0]), expected);
    assert.deepEqual(visibleText(authored), expected);
    assert.deepEqual(approveContent(authored).slides[0].exact_text, expected);
  }
});

test('relationship endpoints and node identities must be explicit and valid', () => {
  for (const content of [
    { type: 'process', title: 'Flow', steps: [{ id: 'a', label: 'Collect' }], edges: [{ from: 'a', to: 'unknown' }] },
    { type: 'process', title: 'Flow', steps: [{ id: 'a', label: 'Collect' }], edges: undefined },
    { type: 'graph', title: 'Graph', nodes: [{ id: 'a', label: 'One' }, { id: 'a', label: 'Two' }], edges: [] },
  ]) assert.equal(validateContent(draft(content)).valid, false);
  const cycle = draft({ type: 'process', title: 'Explicit feedback', steps: [{ id: 'a', label: 'Collect' }, { id: 'b', label: 'Check' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] });
  assert.deepEqual(approveContent(cycle).slides[0].content.edges, cycle.slides[0].content.edges);
});

test('content boundary rejects inconsistent axes, missing sources and unknown data shapes', () => {
  for (const content of [
    { type: 'comparison', title: 'Compare', columns: ['A', 'B'], rows: [{ label: 'Owner', values: ['Only one'] }] },
    { type: 'metrics', title: 'Metric', metrics: [{ value: '2', unit: 'paths', label: 'Generators' }] },
    { type: 'statement', title: 'Title', body: ['Body'], unexpectedVisibleText: 'Lost text' },
    { type: 'unknown', title: 'Unknown' },
    { type: 'constructor', title: 'Unknown prototype key' },
  ]) {
    const input = draft(content);
    assert.equal(validateContent(input).valid, false);
    assert.throws(() => approveContent(input));
  }
  const wrongCount = draft();
  wrongCount.page_count = 2;
  assert.equal(validateContent(wrongCount).valid, false);
});

test('approved files cannot change facts or the derived text without new confirmation', () => {
  const approved = approveContent(draft());
  const changedFact = structuredClone(approved);
  changedFact.slides[0].content.body[0] = 'Changed fact';
  assert.throws(() => assertApprovedContent(changedFact), /revision/u);
  const changedText = structuredClone(approved);
  changedText.slides[0].exact_text[1] = 'Unapproved text';
  assert.throws(() => assertApprovedContent(changedText), /visible text/u);
  assert.throws(() => assertApprovedContent(draft()), /not been approved/u);
});

test('ordinary JSON key order does not create a new content revision', () => {
  const first = draft();
  const reversed = Object.fromEntries(Object.entries(first).reverse());
  assert.equal(contentRevision(reversed), contentRevision(first));
});

test('exported schema and the runtime boundary agree on discriminated content and required authored fields', () => {
  const schema = JSON.parse(JSON.stringify(contentSchema()));
  const variants = schema.properties.slides.items.properties.content.oneOf;
  const examples = [
    [{ type: 'statement', title: 'Claim', body: [] }, 'body'],
    [{ type: 'comparison', title: 'Compare', columns: ['A', 'B'], rows: [{ label: 'Owner', values: ['Author', 'Renderer'] }] }, 'columns'],
    [{ type: 'process', title: 'Flow', steps: [{ id: 'a', label: 'Collect' }], edges: [] }, 'edges'],
    [{ type: 'metrics', title: 'Count', metrics: [{ value: '2', unit: '', label: 'Generators', source: 'Project contract' }] }, 'metrics'],
    [{ type: 'graph', title: 'Graph', nodes: [{ id: 'a', label: 'Author' }], edges: [] }, 'nodes'],
  ];
  assert.equal(schema.properties.schema_version.const, 4);
  assert.deepEqual(variants.map((variant) => variant.properties.type.const).sort(), examples.map(([content]) => content.type).sort());
  for (const [content, requiredField] of examples) {
    const variant = variants.find((candidate) => candidate.properties.type.const === content.type);
    assert.equal(validateContent(draft(content)).valid, true);
    assert.equal(variant.required.includes(requiredField), true, content.type);
    assert.equal(variant.additionalProperties, false, content.type);
    assert.equal(Object.keys(content).every((key) => Object.hasOwn(variant.properties, key)), true, content.type);
    const missing = structuredClone(content);
    delete missing[requiredField];
    assert.equal(validateContent(draft(missing)).valid, false, content.type);
    assert.equal(validateContent(draft({ ...content, extraVisibleText: 'Unowned' })).valid, false, content.type);
  }
});

test('schema exports preserve optional narrative metadata and cannot mutate the shared contract', () => {
  const schema = contentSchema();
  const input = draft();
  delete input.narrativeReferences;
  assert.equal(validateContent(input).valid, true);
  assert.equal(schema.required.includes('narrativeReferences'), false);
  assert.equal(schema.properties.narrativeReferences.items.type, 'object');
  schema.properties.status.enum.push('unconfirmed');
  schema.properties.slides.items.properties.content.oneOf[0].properties.lostText = { type: 'string' };
  assert.equal(contentSchema().properties.status.enum.includes('unconfirmed'), false);
  assert.equal(validateContent({ ...input, status: 'unconfirmed' }).valid, false);
  assert.equal(Object.hasOwn(contentSchema().properties.slides.items.properties.content.oneOf[0].properties, 'lostText'), false);
});
