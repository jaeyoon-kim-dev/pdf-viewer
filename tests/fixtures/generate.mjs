import { writeFile } from 'node:fs/promises';
const streams = [
  'BT /F1 20 Tf 60 740 Td (A fixture for connected reading) Tj 0 -36 Td /F1 12 Tf (Drag across this sentence to collect a useful phrase.) Tj 0 -25 Td (See Figure 1 and citation [1] without leaving this page.) Tj ET',
  'BT /F1 18 Tf 60 740 Td (Results) Tj ET 0.2 0.4 0.8 RG 60 300 m 500 300 l S 60 300 m 60 650 l S 70 330 m 180 390 l 280 440 l 400 580 l S BT /F1 12 Tf 60 270 Td (Figure 1: Reading progress across repeated sessions.) Tj ET',
  'BT /F1 18 Tf 60 740 Td (References) Tj /F1 12 Tf 0 -40 Td ([1] Test, A. Connected reading and useful phrases.) Tj 0 -20 Td (Journal of Example Research. 2024.) Tj ET',
];
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>',
];
for (let i = 0; i < 3; i++) {
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents ${4 + i * 2} 0 R${i === 0 ? ' /Annots [10 0 R 11 0 R]' : ''} >>`,
  );
  objects.push(
    `<< /Length ${Buffer.byteLength(streams[i])} >>\nstream\n${streams[i]}\nendstream`,
  );
}
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
objects.push(
  '<< /Type /Annot /Subtype /Link /Rect [82 675 135 690] /Dest [5 0 R /XYZ 60 640 null] /Border [0 0 0] >>',
);
objects.push(
  '<< /Type /Annot /Subtype /Link /Rect [190 675 212 690] /Dest [7 0 R /XYZ 60 700 null] /Border [0 0 0] >>',
);
let pdf = '%PDF-1.7\n';
const offsets = [0];
objects.forEach((obj, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1))
  pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await writeFile(new URL('sample.pdf', import.meta.url), pdf);
