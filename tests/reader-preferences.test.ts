import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validPosition } from '../lib/reading-position.ts';
import { annotationPreferences } from '../lib/annotation-preferences.ts';

void test('reading positions require a real page and normalized finite offsets', () => {
  const p = { page: 2, x: 0, y: 1, updatedAt: 200 };
  assert.equal(validPosition(p), true);
  for (const invalid of [
    null,
    {},
    { ...p, page: 0 },
    { ...p, page: 1.5 },
    { ...p, x: Infinity },
    { ...p, y: -1 },
    { ...p, updatedAt: NaN },
  ]) {
    assert.equal(validPosition(invalid), false);
  }
});
void test('tooltip preferences exclude note content and unsupported collection types', () => {
  assert.deepEqual(
    annotationPreferences(
      JSON.stringify({
        color: '#aabbcc',
        kind: 'underline',
        types: ['question', 'idea', 'phrase', 'question'],
        note: 'private',
        quote: 'source',
      }),
    ),
    { color: '#aabbcc', kind: 'underline', types: ['question', 'phrase'] },
  );
  for (const raw of ['null', '{broken', '{}', '{"color":"red","kind":"ink"}'])
    assert.deepEqual(annotationPreferences(raw), {});
});
