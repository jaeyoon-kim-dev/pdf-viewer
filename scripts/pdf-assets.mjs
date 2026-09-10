import { relative, join } from 'node:path';
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
await mkdir('public/pdfjs', { recursive: true });
await cp(
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'public/pdfjs/pdf.worker.legacy.min.mjs',
);
for (const name of ['cmaps', 'standard_fonts', 'wasm'])
  await cp(`node_modules/pdfjs-dist/${name}`, `public/pdfjs/${name}`, {
    recursive: true,
  });

const assets = (
  await readdir('public/pdfjs', { recursive: true, withFileTypes: true })
)
  .filter((e) => e.isFile() && e.name !== 'assets.json')
  .map((e) => '/' + relative('public', join(e.parentPath, e.name)));
await writeFile('public/pdfjs/assets.json', JSON.stringify(assets));
