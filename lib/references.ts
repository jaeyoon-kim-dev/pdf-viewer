import type { Line, PageText } from './pdf';
import type { Rect } from './model';
export type Reference = {
  id: string;
  label: string;
  text: string;
  page: number;
  y: number;
  kind: 'citation' | 'figure' | 'table';
};
export type Hotspot = Rect & { references: Reference[] };
export function extractReferences(pages: PageText[]): Reference[] {
  const result: Reference[] = [];
  let bibliography = false;
  let current: Reference | undefined;
  for (const page of pages) {
    for (const line of page.lines) {
      if (
        /^(references|bibliography|literature cited)\s*$/i.test(
          line.text.trim(),
        )
      ) {
        bibliography = true;
        current = undefined;
        continue;
      }
      if (
        bibliography &&
        /^(appendix|supplementary|acknowledg)/i.test(line.text)
      ) {
        bibliography = false;
        current = undefined;
      }
      const figure = line.text.match(
        /^(Fig(?:ure)?\.?|Table)\s+(\d+[a-z]?)\s*[.:]/i,
      );
      if (figure) {
        result.push({
          id: `${figure[1].toLowerCase().startsWith('tab') ? 'table' : 'figure'}-${figure[2].toLowerCase()}`,
          label: `${figure[1]} ${figure[2]}`,
          text: line.text,
          page: line.page,
          y: line.y,
          kind: figure[1].toLowerCase().startsWith('tab') ? 'table' : 'figure',
        });
      }
      if (!bibliography) continue;
      const numbered = line.text.match(
        /^\s*(?:\[(\d{1,4})\]|(\d{1,4})[.)])\s+(.+)/,
      );
      const authorStart =
        /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ž’'-]+,\s/.test(line.text) &&
        /\b(?:19|20)\d{2}[a-z]?\b/.test(line.text);
      if (numbered || authorStart) {
        const label = numbered
          ? numbered[1] || numbered[2]
          : line.text.match(/^[^,]+/)![0];
        current = {
          id: `ref-${label}-${line.page}-${line.y}`,
          label,
          text: numbered ? numbered[3] : line.text,
          page: line.page,
          y: line.y,
          kind: 'citation',
        };
        result.push(current);
      } else if (
        current &&
        current.text.length < 9000 &&
        !/^\d+$/.test(line.text)
      )
        current.text += ' ' + line.text;
    }
  }
  return result;
}
export function numberLabels(value: string): string[] {
  const labels: string[] = [];
  for (const part of value.split(/[,;]/)) {
    const match = part.trim().match(/^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/);
    if (!match) continue;
    const lo = +match[1],
      hi = +(match[2] || match[1]);
    if (hi < lo || hi - lo > 30) continue;
    for (let i = lo; i <= hi; i++) labels.push(String(i));
  }
  return labels;
}
export function referenceHotspots(
  page: PageText,
  references: Reference[],
): Hotspot[] {
  const spots: Hotspot[] = [];
  for (let l = 0; l < page.lines.length; l++) {
    const line = page.lines[l];
    const patterns = [
      ...line.text.matchAll(
        /\[([\d\s,;–-]+)\]|\b(?:Fig(?:ure)?\.?|Table)\s+\d+[a-z]?|\b[A-Z][A-Za-z’'-]+(?:\s+et\s+al\.?)?\s*\(?,?\s*(?:19|20)\d{2}[a-z]?\)?/g,
      ),
    ];
    for (const match of patterns) {
      let found: Reference[] = [];
      if (match[1])
        found = references.filter(
          (r) =>
            r.kind === 'citation' && numberLabels(match[1]).includes(r.label),
        );
      else if (/^(Fig|Table)/i.test(match[0])) {
        const number = match[0].match(/\d+[a-z]?/i)?.[0].toLowerCase();
        found = references.filter(
          (r) =>
            r.id ===
            `${/^Table/i.test(match[0]) ? 'table' : 'figure'}-${number}`,
        );
      } else {
        const author = match[0].split(/\s/)[0];
        const year = match[0].match(/(?:19|20)\d{2}/)?.[0];
        found = references.filter(
          (r) =>
            r.kind === 'citation' &&
            r.text.includes(author) &&
            !!year &&
            r.text.includes(year),
        );
      }
      // Do not turn bibliography entries or captions into self-previews.
      found = found.filter(
        (r) => r.page !== line.page || Math.abs(r.y - line.y) > 0.015,
      );
      if (!found.length) continue;
      const words = page.words.filter((w) => w.line === l);
      let offset = 0;
      const selected = words.filter((w) => {
        const begin = offset;
        offset += w.text.length + 1;
        return offset > match.index! && begin < match.index! + match[0].length;
      });
      if (!selected.length) continue;
      const x = selected[0].x;
      const last = selected[selected.length - 1];
      spots.push({
        x,
        y: line.y,
        w: last.x + last.w - x,
        h: line.h,
        references: found,
      });
    }
  }
  return spots;
}
export function nearestReference(refs: Reference[], page: number, y: number) {
  return refs
    .filter((r) => r.page === page)
    .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0];
}
export function destinationExcerpt(lines: Line[], y: number): string {
  return lines
    .filter((l) => l.y >= y - 0.015)
    .slice(0, 7)
    .map((l) => l.text)
    .join(' ');
}
