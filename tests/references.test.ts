import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReferences,
  referenceHotspots,
  numberLabels,
  resolveReferenceLink,
} from '../lib/references.ts';
import type { PageText } from '../lib/pdf.ts';
function page(n: number, values: string[]): PageText {
  const lines = values.map((text, i) => ({
    text,
    page: n,
    x: 0.1,
    y: 0.1 + i * 0.05,
    w: 0.8,
    h: 0.02,
  }));
  const words = lines.flatMap((l, line) =>
    l.text.split(' ').map((text, i) => ({
      text,
      line,
      x: 0.1 + i * 0.05,
      y: l.y,
      w: 0.045,
      h: 0.02,
    })),
  );
  return { lines, words, width: 600, height: 800 };
}
void test('references retain source page, merge continuation lines, and recognize figure captions', () => {
  const refs = extractReferences([
    page(1, ['The finding is shown in Fig. 1.', 'Figure 1: A useful diagram.']),
    page(2, [
      'References',
      '[1] Smith, A. A study of reading.',
      'Journal of Reading, 2024. 10.1000/example',
      '[2] Jones, B. Another paper.',
    ]),
  ]);
  assert.equal(refs.length, 3);
  assert.equal(refs[0].kind, 'figure');
  assert.equal(refs[1].page, 2);
  assert.match(refs[1].text, /Journal of Reading/);
  assert.equal(refs[2].label, '2');
});
void test('numeric citation ranges are bounded and mapped to multiple preview items', () => {
  assert.deepEqual(numberLabels('1, 3–5; 9'), ['1', '3', '4', '5', '9']);
  assert.deepEqual(numberLabels('1-9999, 7-2, abc'), []);
  const body = page(1, ['Compare [1, 2] for details.']);
  const refs = extractReferences([
    page(2, [
      'References',
      '[1] Smith, A. First paper.',
      '[2] Lee, B. Second paper.',
    ]),
  ]);
  const spots = referenceHotspots(body, refs);
  assert.equal(spots.length, 1);
  assert.equal(spots[0].references.length, 2);
});
void test('captions and bibliography entries do not open themselves', () => {
  const p = page(1, [
    'Figure 1: Caption.',
    'References',
    '[1] Smith, A. First paper.',
  ]);
  const spots = referenceHotspots(p, extractReferences([p]));
  assert.equal(spots.length, 0);
});
void test('author-year references resolve without relying on numeric links', () => {
  const refs = extractReferences([
    page(2, ['References', 'Smith, A. (2024). A useful study.']),
  ]);
  const spots = referenceHotspots(
    page(1, ['As Smith (2024) explains this.']),
    refs,
  );
  assert.equal(spots[0].references[0].label, 'Smith');
});

void test('standalone footer numbers never become citation hotspots', () => {
  const refs = extractReferences([
    page(2, ['References', '[1] Smith, A. First paper.']),
  ]);
  const footer = page(1, ['[1]']);
  footer.lines[0].y = 0.91;
  footer.words[0].y = 0.91;
  assert.equal(referenceHotspots(footer, refs).length, 0);
  assert.equal(
    resolveReferenceLink(refs, 2, refs[0].y, '1', 'cite.1', {
      x: 0.5,
      y: 0.91,
      w: 0.02,
      h: 0.02,
    }),
    undefined,
  );
});
void test('internal page and section navigation is not converted into a reference', () => {
  const refs = extractReferences([
    page(2, ['References', '[1] Smith, A. First paper.']),
  ]);
  const bounds = { x: 0.4, y: 0.4, w: 0.05, h: 0.02 };
  assert.equal(
    resolveReferenceLink(refs, 2, refs[0].y, '1', 'section.1', bounds),
    undefined,
  );
  assert.equal(
    resolveReferenceLink(refs, 2, undefined, '1', 'page.2', bounds),
    undefined,
  );
  assert.equal(
    resolveReferenceLink(refs, 2, refs[0].y + 0.15, '[1]', 'cite.1', bounds),
    undefined,
  );
  assert.equal(
    resolveReferenceLink(refs, 2, refs[0].y, 'Introduction', '', bounds),
    undefined,
  );
});
void test('explicit citation destinations and matching labels retain genuine previews', () => {
  const refs = extractReferences([
    page(2, ['References', '[1] Smith, A. First paper.']),
  ]);
  const bounds = { x: 0.4, y: 0.91, w: 0.05, h: 0.02 };
  assert.equal(
    resolveReferenceLink(
      refs,
      2,
      refs[0].y,
      '[1]',
      'cite.Smith',
      bounds,
      'See [1] for details.',
    )?.id,
    refs[0].id,
  );
  assert.equal(
    resolveReferenceLink(refs, 2, refs[0].y, '[1]', '', { ...bounds, y: 0.4 })
      ?.id,
    refs[0].id,
  );
});
