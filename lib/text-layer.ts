import { layoutWords, type Word, type PageText } from './pdf.ts';
export type TextGeometry = { text: PageText; ranges: Range[] };

/** Measure real PDF.js DOM text, including its font scaling and transforms. */
export function textGeometry(
  container: HTMLElement,
  spans: HTMLElement[],
  page: number,
  width: number,
  height: number,
): TextGeometry {
  const box = container.getBoundingClientRect();
  const words: Word[] = [],
    ranges: Range[] = [];
  for (const span of spans) {
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) continue;
    for (const match of (node.textContent || '').matchAll(/\S+/g)) {
      const range = document.createRange();
      range.setStart(node, match.index!);
      range.setEnd(node, match.index! + match[0].length);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height || !box.width || !box.height) continue;
      const clamp = (n: number) => Math.max(0, Math.min(1, n));
      const left = clamp((r.left - box.left) / box.width);
      const top = clamp((r.top - box.top) / box.height);
      const right = clamp((r.right - box.left) / box.width);
      const bottom = clamp((r.bottom - box.top) / box.height);
      if (right <= left || bottom <= top) continue;
      words.push({
        text: match[0],
        line: 0,
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
      });
      ranges.push(range);
    }
  }
  return { text: layoutWords(words, page, width, height), ranges };
}

/** Strict overlap avoids including the word merely touching a selection edge. */
export function selectedWordRange(
  selection: Range,
  words: Range[],
): [number, number] | undefined {
  if (selection.collapsed) return;
  const start = selection.cloneRange(),
    end = selection.cloneRange();
  start.collapse(true);
  end.collapse(false);
  let first = -1,
    last = -1;
  words.forEach((word, index) => {
    const a = word.cloneRange(),
      b = word.cloneRange();
    a.collapse(true);
    b.collapse(false);
    if (
      start.compareBoundaryPoints(Range.START_TO_START, b) < 0 &&
      end.compareBoundaryPoints(Range.START_TO_START, a) > 0
    ) {
      if (first < 0) first = index;
      last = index;
    }
  });
  return first < 0 ? undefined : [first, last];
}

export function wordRange(
  words: Range[],
  first: number,
  last: number,
): Range | undefined {
  const a = words[Math.min(first, last)],
    b = words[Math.max(first, last)];
  if (!a || !b) return;
  const range = a.cloneRange();
  range.setEnd(b.endContainer, b.endOffset);
  return range;
}

// iPadOS can identify as Macintosh; touch capability distinguishes that case.
export function nativeMouseSelection(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
) {
  return !(
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  );
}
