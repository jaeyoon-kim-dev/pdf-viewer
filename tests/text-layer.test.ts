import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMouseSelection, selectedWordRange } from '../lib/text-layer.ts';

// A range double with ordered scalar positions isolates overlap/snapping rules
// from browser layout. Real PDF.js text-layer alignment still needs browser QA.
class TestRange {
  static START_TO_START = 0;
  start: number;
  end: number;
  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
  get collapsed() {
    return this.start === this.end;
  }
  cloneRange() {
    return new TestRange(this.start, this.end);
  }
  collapse(start: boolean) {
    if (start) this.end = this.start;
    else this.start = this.end;
  }
  compareBoundaryPoints(_how: number, other: TestRange) {
    return Math.sign(this.start - other.start);
  }
}
void test('whole-word snapping excludes untouched adjacent words', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Range');
  Object.defineProperty(globalThis, 'Range', {
    configurable: true,
    value: TestRange,
  });
  try {
    const words = [
      new TestRange(0, 5),
      new TestRange(6, 11),
      new TestRange(12, 17),
    ] as unknown as Range[];
    const selected = (a: number, b: number) =>
      selectedWordRange(new TestRange(a, b) as unknown as Range, words);
    assert.deepEqual(selected(2, 8), [0, 1]);
    assert.deepEqual(selected(6, 11), [1, 1]);
    assert.deepEqual(selected(5, 12), [1, 1]);
    assert.deepEqual(selected(2, 15), [0, 2]);
    assert.equal(selected(7, 7), undefined);
    assert.equal(selected(18, 20), undefined);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Range', previous);
    else Reflect.deleteProperty(globalThis, 'Range');
  }
});
void test('iPad desktop identity never enables native mouse selection', () => {
  assert.equal(nativeMouseSelection('Safari Macintosh', 'MacIntel', 0), true);
  assert.equal(nativeMouseSelection('Safari Macintosh', 'MacIntel', 5), false);
  assert.equal(nativeMouseSelection('Safari iPad', 'iPad', 5), false);
  assert.equal(nativeMouseSelection('Safari iPhone', 'iPhone', 5), false);
  assert.equal(nativeMouseSelection('Chrome Windows', 'Win32', 0), true);
});
