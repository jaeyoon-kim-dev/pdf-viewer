import { database } from '@/db';
import { json } from '@/lib/server';
export async function GET() {
  try {
    await database()
      .prepare('SELECT count(*) AS count FROM schema_migrations')
      .first();
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'unavailable' }, 503);
  }
}
