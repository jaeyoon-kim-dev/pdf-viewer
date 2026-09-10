import type { RecordKind, SavedRecord } from './model';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.length <= max;
const unit = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export function validateRecord(
  kind: string,
  id: string,
  value: unknown,
): value is SavedRecord {
  if (
    !object(value) ||
    value.id !== id ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 0
  )
    return false;
  if (kind === 'types')
    return (
      text(value.name, 50) &&
      !!(value.name as string).trim() &&
      /^#[\da-f]{6}$/i.test(String(value.color))
    );
  if (
    !text(value.paperId, 100) ||
    !Number.isInteger(value.page) ||
    (value.page as number) < 1 ||
    !text(value.note, 30000) ||
    !text(value.createdAt, 50)
  )
    return false;
  if (kind === 'readings')
    return (
      text(value.reference, 10000) &&
      object(value.article) &&
      text(value.article.title, 2000) &&
      text(value.article.raw, 10000) &&
      text(value.article.authors, 3000) &&
      text(value.article.year, 20) &&
      (value.article.doi === undefined || text(value.article.doi, 500)) &&
      (value.article.abstract === undefined ||
        text(value.article.abstract, 15000)) &&
      (value.article.url === undefined || text(value.article.url, 3000)) &&
      (value.article.pdf === undefined || text(value.article.pdf, 3000)) &&
      ['doi', 'candidate', 'unresolved'].includes(String(value.article.match))
    );
  if (
    kind !== 'annotations' ||
    !['highlight', 'underline', 'note', 'ink'].includes(String(value.kind)) ||
    !text(value.quote, 30000) ||
    !/^#[\da-f]{6}$/i.test(String(value.color))
  )
    return false;
  if (
    !Array.isArray(value.types) ||
    value.types.length > 50 ||
    !value.types.every((t) => text(t, 100))
  )
    return false;
  if (
    !Array.isArray(value.rects) ||
    value.rects.length > 10000 ||
    !value.rects.every(
      (r) => object(r) && unit(r.x) && unit(r.y) && unit(r.w) && unit(r.h),
    )
  )
    return false;
  if (
    !Array.isArray(value.points) ||
    value.points.length > 10000 ||
    !value.points.every(
      (p) => object(p) && unit(p.x) && unit(p.y) && unit(p.pressure),
    )
  )
    return false;
  return value.resolved === undefined || typeof value.resolved === 'boolean';
}
export function validKind(kind: string): kind is RecordKind {
  return ['annotations', 'types', 'readings'].includes(kind);
}
