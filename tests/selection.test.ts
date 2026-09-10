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
  assert.equal(hitWord(words, 0.8, 0.15, true), 1);
});
