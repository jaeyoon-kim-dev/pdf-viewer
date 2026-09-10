import test from 'node:test';
import assert from 'node:assert/strict';
import { hitWord, selectWords, type Word } from '../lib/pdf.ts';
const words: Word[] = [
  { text: 'Hello', line: 0, x: 0.1, y: 0.1, w: 0.1, h: 0.02 },
  { text: 'world', line: 0, x: 0.21, y: 0.1, w: 0.1, h: 0.02 },
  { text: 'again', line: 1, x: 0.1, y: 0.15, w: 0.1, h: 0.02 },
];
void test('forward and reverse drags produce identical text anchors', () => {
  assert.deepEqual(selectWords(words, 0, 2), selectWords(words, 2, 0));
  const selected = selectWords(words, 0, 2);
  assert.equal(selected.quote, 'Hello world again');
  assert.equal(selected.rects.length, 2);
  assert.equal(selected.rects[0].w, 0.21);
});
void test('text hit testing separates a text drag from margin navigation', () => {
  assert.equal(hitWord(words, 0.12, 0.11), 0);
  assert.equal(hitWord(words, 0.01, 0.01), -1);
  assert.equal(hitWord(words, 0.8, 0.15, true), 2);
});

void test('drag endpoints follow the pointer line even beyond short line endings', () => {
  const end = hitWord(words, 0.95, 0.16, true);
  assert.equal(end, 2);
  assert.equal(selectWords(words, 0, end).quote, 'Hello world again');
  assert.equal(hitWord(words, 0.01, 0.16, true), 2);
  assert.equal(hitWord(words, 0.95, 0.11, true), 1);
  assert.equal(hitWord(words, 0.15, 0.11, true), 0);
  assert.equal(hitWord([], 0.5, 0.5, true), -1);
});
void test('aligned columns choose the column under the pointer', () => {
  const columns = [
    ...words,
    { text: 'right', line: 2, x: 0.6, y: 0.15, w: 0.2, h: 0.02 },
  ];
  assert.equal(hitWord(columns, 0.65, 0.16, true), 3);
  assert.equal(hitWord(columns, 0.15, 0.16, true), 2);
});
