import { database } from '@/db';
import { DEFAULT_TYPES } from '@/lib/model';
import { json, mutationGuard, validId } from '@/lib/server';
import { validKind, validateRecord } from '@/lib/validation';
type Context = { params: Promise<{ kind: string; id: string }> };
export async function GET(_request: Request, context: Context) {
  const { kind, id } = await context.params;
  if (!validKind(kind) || !validId(id))
    return json({ error: 'Invalid record.' }, 400);
  const row = await database()
    .prepare('SELECT revision FROM records WHERE id = ? AND kind = ?')
    .bind(id, kind)
    .first();
  return json(row || { revision: 0 });
}
async function change(request: Request, context: Context, deleted: boolean) {
  const rejected = mutationGuard(request);
  if (rejected) return rejected;
  const { kind, id } = await context.params;
  if (!validKind(kind) || !validId(id))
    return json({ error: 'Invalid record.' }, 400);
  if (Number(request.headers.get('content-length')) > 1000000)
    return json({ error: 'Annotation is too large.' }, 413);
  let value: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1000000)
      return json({ error: 'Annotation is too large.' }, 413);
    value = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (!validateRecord(kind, id, value))
    return json({ error: 'Invalid annotation or collection data.' }, 400);
  if (deleted && kind === 'types')
    return json(
      {
        error:
          'Collection types cannot be removed while they may be referenced.',
      },
      400,
    );
  const db = database();
  let paperId: string | null = null;
  if ('paperId' in value) {
    paperId = value.paperId;
    const paper = await db
      .prepare('SELECT pages FROM papers WHERE id = ?')
      .bind(paperId)
      .first<{ pages: number }>();
    if (!paper || value.page > paper.pages)
      return json({ error: 'Source page not found.' }, 400);
  }
  if ('types' in value) {
    const types = await db
      .prepare("SELECT id FROM records WHERE kind = 'types' AND deleted = 0")
      .all<{ id: string }>();
    const valid = new Set(
      [...DEFAULT_TYPES, ...types.results].map((x) => x.id),
    );
    if (value.types.some((t) => !valid.has(t)))
      return json({ error: 'Save the collection type before using it.' }, 400);
  }
  const current = await db
    .prepare(
      'SELECT kind, paper_id, revision, payload, deleted FROM records WHERE id = ?',
    )
    .bind(id)
    .first<{
      kind: string;
      paper_id: string | null;
      revision: number;
      payload: string;
      deleted: number;
    }>();
  if (current && (current.kind !== kind || current.paper_id !== paperId))
    return json({ error: 'A source record cannot be reassigned.' }, 409);
  if (
    current &&
    current.payload === JSON.stringify(value) &&
    current.deleted === Number(deleted)
  )
    return json({ ...value, revision: current.revision });
  if ((current?.revision || 0) !== value.revision)
    return json(
      {
        error:
          'This item changed on another device. Your local edit is retained. Resolve the conflict from sync status.',
      },
      409,
    );
  const revision = value.revision + 1;
  const result = await db
    .prepare(
      'INSERT INTO records (id,kind,paper_id,payload,revision,deleted) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, deleted=excluded.deleted WHERE records.revision = ?',
    )
    .bind(
      id,
      kind,
      paperId,
      JSON.stringify(value),
      revision,
      deleted ? 1 : 0,
      value.revision,
    )
    .run();
  if (!result.meta.changes)
    return json(
      { error: 'A newer edit exists. Your local edit is retained.' },
      409,
    );
  return json({ ...value, revision });
}
export const PUT = (r: Request, c: Context) => change(r, c, false);
export const DELETE = (r: Request, c: Context) => change(r, c, true);
