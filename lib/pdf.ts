import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { Rect } from './model';
export type Word = Rect & { text: string; line: number };
export type Line = Rect & { text: string; page: number };
export type PageText = {
  words: Word[];
  lines: Line[];
  width: number;
  height: number;
};
export async function pdfLibrary() {
  const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdf.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.legacy.min.mjs';
  return pdf;
}
export async function loadPdf(data: Uint8Array) {
  const pdf = await pdfLibrary();
  return pdf.getDocument({
    data,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
  }).promise;
}
type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
// PDF.js 6 getTextContent uses ReadableStream async iteration, which Safari
// before 26.4 does not provide, even with PDF.js's legacy JavaScript build.
export async function readPageText(page: PDFPageProxy): Promise<TextContent> {
  if (page.isPureXfa) return page.getTextContent();
  const reader = (
    page.streamTextContent() as ReadableStream<TextContent>
  ).getReader();
  const content: TextContent = {
    items: [],
    styles: Object.create(null),
    lang: null,
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      content.lang ??= value.lang;
      Object.assign(content.styles, value.styles);
      content.items.push(...value.items);
    }
    return content;
  } finally {
    reader.releaseLock();
  }
}
const cache = new WeakMap<PDFDocumentProxy, Map<number, Promise<PageText>>>();
export function pageText(doc: PDFDocumentProxy, n: number): Promise<PageText> {
  let pages = cache.get(doc);
  if (!pages) {
    pages = new Map();
    cache.set(doc, pages);
  }
  if (!pages.has(n)) pages.set(n, extractPage(doc, n));
  return pages.get(n)!;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
async function extractPage(
  doc: PDFDocumentProxy,
  n: number,
): Promise<PageText> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1 });
  const pdf = await pdfLibrary();
  const content = await readPageText(page);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const words: Word[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const t = pdf.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(t[2], t[3]);
    const style = content.styles[item.fontName];
    const ascent = style?.ascent ?? 0.8;
    ctx.font = `${fontHeight}px ${style?.fontFamily || 'serif'}`;
    const measure = Math.max(1, ctx.measureText(item.str).width);
    const width = item.width * viewport.scale;
    for (const m of item.str.matchAll(/\S+/g)) {
      const offset =
        ctx.measureText(item.str.slice(0, m.index)).width / measure;
      const ratio = ctx.measureText(m[0]).width / measure;
      words.push({
        text: m[0],
        line: 0,
        x: clamp((t[4] + offset * width) / viewport.width),
        y: clamp((t[5] - ascent * fontHeight) / viewport.height),
        w: clamp((ratio * width) / viewport.width),
        h: clamp(fontHeight / viewport.height),
      });
    }
  }
  return layoutWords(words, n, viewport.width, viewport.height);
}
export function layoutWords(
  words: Word[],
  n: number,
  width: number,
  height: number,
): PageText {
  // Preserve PDF content reading order, grouping adjacent runs into lines.
  const lines: Line[] = [];
  for (const word of words) {
    let line = lines[lines.length - 1];
    if (
      !line ||
      Math.abs(line.y - word.y) > word.h * 0.5 ||
      word.x < line.x - 0.02 ||
      word.x - (line.x + line.w) > 0.12
    ) {
      line = { x: word.x, y: word.y, w: word.w, h: word.h, text: '', page: n };
      lines.push(line);
    }
    word.line = lines.length - 1;
    line.text += (line.text ? ' ' : '') + word.text;
    line.w = Math.max(line.w, word.x + word.w - line.x);
    line.h = Math.max(line.h, word.y + word.h - line.y);
  }
  return { words, lines, width, height };
}
type WordLine = {
  indices: number[];
  left: number;
  right: number;
  top: number;
  bottom: number;
};
const wordLines = new WeakMap<Word[], WordLine[]>();
function indexedLines(words: Word[]) {
  const cached = wordLines.get(words);
  if (cached) return cached;
  const groups = new Map<number, WordLine>();
  words.forEach((word, index) => {
    let line = groups.get(word.line);
    if (!line) {
      line = {
        indices: [],
        left: word.x,
        right: word.x + word.w,
        top: word.y,
        bottom: word.y + word.h,
      };
      groups.set(word.line, line);
    }
    line.indices.push(index);
    line.left = Math.min(line.left, word.x);
    line.right = Math.max(line.right, word.x + word.w);
    line.top = Math.min(line.top, word.y);
    line.bottom = Math.max(line.bottom, word.y + word.h);
  });
  const lines = [...groups.values()];
  wordLines.set(words, lines);
  return lines;
}
export function hitWord(words: Word[], x: number, y: number, nearest = false) {
  if (nearest) {
    // Horizontal distance must not pull the endpoint onto a different line.
    // For aligned columns, horizontal distance breaks the vertical tie.
    let closest: WordLine | undefined;
    let vertical = Infinity,
      horizontal = Infinity;
    for (const line of indexedLines(words)) {
      const dy = Math.max(line.top - y, 0, y - line.bottom);
      const dx = Math.max(line.left - x, 0, x - line.right);
      if (dy < vertical || (dy === vertical && dx < horizontal)) {
        closest = line;
        vertical = dy;
        horizontal = dx;
      }
    }
    let best = -1,
      distance = Infinity;
    for (const index of closest?.indices || []) {
      const word = words[index];
      const dx = Math.max(word.x - x, 0, x - word.x - word.w);
      if (dx < distance) {
        best = index;
        distance = dx;
      }
    }
    return best;
  }
  let best = -1;
  let distance = Infinity;
  words.forEach((w, i) => {
    const dx = Math.max(w.x - x, 0, x - w.x - w.w),
      dy = Math.max(w.y - y, 0, y - w.y - w.h);
    const d = dx * dx + dy * dy * 4;
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return distance < 0.000015 ? best : -1;
}
export function selectWords(words: Word[], start: number, end: number) {
  const selected = words.slice(Math.min(start, end), Math.max(start, end) + 1);
  const rects: Rect[] = [];
  let previousLine = -1;
  for (const word of selected) {
    if (word.line !== previousLine) {
      rects.push({ x: word.x, y: word.y, w: word.w, h: word.h });
      previousLine = word.line;
    } else {
      const r = rects[rects.length - 1];
      r.w = Math.max(r.w, word.x + word.w - r.x);
    }
  }
  return { quote: selected.map((w) => w.text).join(' '), rects };
}
export async function renderCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  width: number,
) {
  const base = page.getViewport({ scale: 1 });
  const scale = width / base.width;
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewport.width * dpr);
  canvas.height = Math.round(viewport.height * dpr);
  return page.render({ canvas, viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
}
