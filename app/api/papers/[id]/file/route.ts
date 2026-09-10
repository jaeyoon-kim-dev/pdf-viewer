import { database, files } from '@/db';
import { json, validId } from '@/lib/server';
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Invalid paper ID.' }, 400);
  const paper = await database()
    .prepare('SELECT id FROM papers WHERE id = ?')
    .bind(id)
    .first();
  if (!paper) return json({ error: 'Paper not found.' }, 404);
  const file = await files().get(`${id}.pdf`);
  if (!file) return json({ error: 'PDF not found.' }, 404);
  return new Response(file.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.size),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
    },
  });
}
