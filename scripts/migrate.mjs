import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.env.DATA_DIR || './data');
await mkdir(root, { recursive: true });
const db = new DatabaseSync(join(root, 'paperthread.sqlite'));
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
);
db.exec(
  'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)',
);
try {
  for (const name of (await readdir('drizzle'))
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(join('drizzle', name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const previous = db
      .prepare('SELECT checksum FROM schema_migrations WHERE name = ?')
      .get(name);
    if (previous) {
      if (previous.checksum !== hash)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(
        name,
        hash,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
      console.log(`Applied ${name}`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
} finally {
  db.close();
}
