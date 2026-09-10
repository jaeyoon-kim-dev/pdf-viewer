import { DatabaseSync } from 'node:sqlite';
import { mkdir, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(process.env.DATA_DIR || './data');
const destination = resolve(
  process.argv[2] ||
    `backups/${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
await mkdir(destination, { recursive: true });
const db = new DatabaseSync(join(root, 'paperthread.sqlite'));
try {
  db.prepare('VACUUM INTO ?').run(join(destination, 'paperthread.sqlite'));
} finally {
  db.close();
}
// PDFs are immutable and cannot be deleted through the app. A few extra files
// uploaded after the database snapshot are harmless on restore.
await cp(join(root, 'pdfs'), join(destination, 'pdfs'), {
  recursive: true,
}).catch((e) => {
  if (e.code !== 'ENOENT') throw e;
});
console.log(`Backup written to ${destination}`);
