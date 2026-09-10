import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pageText, hitWord, selectWords } from '../lib/pdf.ts';
import { extractReferences, referenceHotspots } from '../lib/references.ts';

void test('selection and citation hotspots work without Safari stream async iteration', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    ReadableStream.prototype,
    Symbol.asyncIterator,
  );
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => createCanvas(1, 1) },
  });
  const task = getDocument({
    data: new Uint8Array(
      await readFile(new URL('./fixtures/sample.pdf', import.meta.url)),
    ),
    useSystemFonts: true,
  });
  try {
    const doc = await task.promise;
    const first = await doc.getPage(1);
    // Reproduce the upstream failure before checking our compatibility path.
    await assert.rejects(first.getTextContent(), TypeError);
    const pages = await Promise.all([1, 2, 3].map((n) => pageText(doc, n)));
    const word = pages[0].words.find((w) => w.text === 'phrase.')!;
    assert.ok(word);
    const index = hitWord(
      pages[0].words,
      word.x + word.w / 2,
      word.y + word.h / 2,
    );
    assert.ok(index >= 0);
    assert.equal(selectWords(pages[0].words, index, index).quote, 'phrase.');
    const references = extractReferences(pages);
    assert.ok(
      referenceHotspots(pages[0], references).some((spot) =>
        spot.references.some((r) => r.kind === 'citation'),
      ),
    );
  } finally {
    await task.destroy();
    if (descriptor)
      Object.defineProperty(
        ReadableStream.prototype,
        Symbol.asyncIterator,
        descriptor,
      );
    else Reflect.deleteProperty(ReadableStream.prototype, Symbol.asyncIterator);
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
