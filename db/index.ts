import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, createReadStream, createWriteStream } from 'node:fs';
import { stat, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const root = resolve(process.env.DATA_DIR || './data');
const state = globalThis as typeof globalThis & {
  __paperthreadDb?: DatabaseSync;
};
function connection() {
  if (!state.__paperthreadDb) {
    mkdirSync(root, { recursive: true });
    const db = new DatabaseSync(join(root, 'paperthread.sqlite'));
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
    );
    state.__paperthreadDb = db;
  }
  return state.__paperthreadDb;
}
// Small prepared-statement interface keeps SQL and route logic independent of hosting.
export function database() {
  return {
    prepare(sql: string) {
      const statement = connection().prepare(sql);
      const bound = (values: (string | number | null)[]) => ({
        bind: (...args: (string | number | null)[]) => bound(args),
        async all<T = Record<string, unknown>>() {
          return { results: statement.all(...values) as T[] };
        },
        async first<T = Record<string, unknown>>() {
          return statement.get(...values) as T | undefined;
        },
        async run() {
          const result = statement.run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
      });
      return bound([]);
    },
  };
}
function filePath(key: string) {
  if (!/^[a-zA-Z0-9_-]+\.pdf$/.test(key)) throw new Error('Invalid file key.');
  return join(root, 'pdfs', key);
}
export function files() {
  return {
    async put(
      key: string,
      stream: ReadableStream<Uint8Array>,
      _metadata?: unknown,
    ) {
      mkdirSync(join(root, 'pdfs'), { recursive: true });
      const target = filePath(key);
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      try {
        await pipeline(
          Readable.fromWeb(
            stream as import('node:stream/web').ReadableStream<Uint8Array>,
          ),
          createWriteStream(temporary, { flags: 'wx' }),
        );
        await rename(temporary, target);
      } catch (e) {
        await rm(temporary, { force: true });
        throw e;
      }
    },
    async get(key: string) {
      const path = filePath(key);
      try {
        const info = await stat(path);
        return {
          body: Readable.toWeb(
            createReadStream(path),
          ) as ReadableStream<Uint8Array>,
          size: info.size,
        };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(key: string) {
      await rm(filePath(key), { force: true });
    },
  };
}
