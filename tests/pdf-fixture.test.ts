import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pageText } from '../lib/pdf.ts';
import { extractReferences } from '../lib/references.ts';
void test('real PDF fixture exposes text, figures, references, and internal destinations', async () => {
  const previous = globalThis.document;
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
    assert.equal(doc.numPages, 3);
    const pages = await Promise.all([1, 2, 3].map((n) => pageText(doc, n)));
    assert.ok(pages[0].words.some((w) => w.text === 'phrase.'));
    const refs = extractReferences(pages);
    assert.equal(refs.filter((r) => r.kind === 'figure').length, 1);
    assert.equal(refs.filter((r) => r.kind === 'citation').length, 1);
    const links = await (await doc.getPage(1)).getAnnotations();
    assert.equal(links.length, 2);
    assert.equal(await doc.getPageIndex(links[0].dest[0]), 1);
  } finally {
    await task.destroy();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: previous,
    });
  }
});
