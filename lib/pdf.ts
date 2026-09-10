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
  const content = await page.getTextContent();
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
  return { words, lines, width: viewport.width, height: viewport.height };
}
export function hitWord(words: Word[], x: number, y: number, nearest = false) {
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
  return nearest || distance < 0.000015 ? best : -1;
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
