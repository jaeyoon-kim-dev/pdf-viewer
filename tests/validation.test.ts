import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../lib/validation.ts';
import { safeUrl, sourceHref } from '../lib/model.ts';
const annotation = {
  id: 'a',
  paperId: 'paper',
  revision: 0,
  page: 1,
  note: 'Why?',
  quote: 'Evidence',
  kind: 'highlight',
  color: '#facc15',
  types: ['question'],
  rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }],
  points: [],
  createdAt: '2026-09-10',
};
void test('annotations and user-defined collection types validate', () => {
  assert.equal(validateRecord('annotations', 'a', annotation), true);
  assert.equal(
    validateRecord('types', 'ideas', {
      id: 'ideas',
      name: 'Ideas',
      color: '#0d9488',
      revision: 0,
    }),
    true,
  );
});
void test('rejects malformed coordinates, source pages, revisions, and colors', () => {
  for (const patch of [
    { page: 0 },
    { revision: -1 },
    { color: 'url(evil)' },
    { rects: [{ x: NaN, y: 0, w: 0, h: 0 }] },
    { points: [{ x: 2, y: 0, pressure: 0.5 }] },
    { note: 'x'.repeat(30001) },
    { types: [null] },
  ])
    assert.equal(
      validateRecord('annotations', 'a', { ...annotation, ...patch }),
      false,
    );
  assert.equal(validateRecord('annotations', 'other', annotation), false);
  assert.equal(validateRecord('annotations', 'a', null), false);
});
void test('source URLs identify both paper and annotation, with a citation-only variant', () => {
  assert.equal(sourceHref(annotation), '/papers/paper?page=1&annotation=a');
  assert.equal(sourceHref(annotation, false), '/papers/paper?page=1');
});
void test('untrusted metadata URLs cannot execute code', () => {
  assert.equal(safeUrl('javascript:alert(1)'), undefined);
  assert.equal(safeUrl('data:text/html,hello'), undefined);
  assert.equal(
    safeUrl('https://doi.org/10.1000/example'),
    'https://doi.org/10.1000/example',
  );
});
