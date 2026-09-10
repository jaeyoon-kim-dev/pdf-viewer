import { database } from '@/db';
import { json, mutationGuard, validId } from '@/lib/server';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rejected = mutationGuard(request);
  if (rejected) return rejected;
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Invalid paper.' }, 400);
  let body: { title?: unknown; tags?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: 'Too many tags.' }, 400);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.length > 300 ||
    !Array.isArray(body.tags) ||
    body.tags.length > 30 ||
    body.tags.some((t) => typeof t !== 'string' || !t.trim() || t.length > 50)
  )
    return json(
      { error: 'Use a title and up to 30 tags of 50 characters each.' },
      400,
    );
  const tags = [...new Set(body.tags.map((t) => t.trim().toLowerCase()))];
  const result = await database()
    .prepare('UPDATE papers SET title = ?, tags = ? WHERE id = ?')
    .bind(body.title.trim(), JSON.stringify(tags), id)
    .run();
  return result.meta.changes
    ? json({ ok: true })
    : json({ error: 'Paper not found.' }, 404);
}
