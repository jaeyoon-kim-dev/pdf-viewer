import { database } from '@/db';
import { json, mutationGuard, validId } from '@/lib/server';
import { validPosition } from '@/lib/reading-position';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Invalid paper.' }, 400);
  const db = database();
  if (
    !(await db.prepare('SELECT id FROM papers WHERE id = ?').bind(id).first())
  )
    return json({ error: 'Paper not found.' }, 404);
  const row = await db
    .prepare('SELECT payload FROM reading_positions WHERE paper_id = ?')
    .bind(id)
    .first<{ payload: string }>();
  return json(row ? JSON.parse(row.payload) : null);
}
export async function PUT(request: Request, context: Context) {
  const rejected = mutationGuard(request);
  if (rejected) return rejected;
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Invalid paper.' }, 400);
  let value: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1000)
      return json({ error: 'Position is too large.' }, 400);
    value = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (!validPosition(value))
    return json({ error: 'Invalid reading position.' }, 400);
  const db = database();
  const paper = await db
    .prepare('SELECT pages FROM papers WHERE id = ?')
    .bind(id)
    .first<{ pages: number }>();
  if (!paper) return json({ error: 'Paper not found.' }, 404);
  if (value.page > paper.pages)
    return json({ error: 'Page is outside this PDF.' }, 400);
  await db
    .prepare(
      'INSERT INTO reading_positions (paper_id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(paper_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at WHERE excluded.updated_at >= reading_positions.updated_at',
    )
    .bind(id, JSON.stringify(value), value.updatedAt)
    .run();
  return json({ ok: true });
}
