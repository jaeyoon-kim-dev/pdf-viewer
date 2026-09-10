import { database } from '@/db';
import { DEFAULT_TYPES, type LibraryData } from '@/lib/model';
import { json } from '@/lib/server';
export async function GET() {
  const db = database();
  const [papers, records] = await Promise.all([
    db
      .prepare(
        'SELECT id, title, filename, pages, bytes, tags, created_at AS createdAt FROM papers ORDER BY created_at DESC',
      )
      .all(),
    db
      .prepare('SELECT kind, payload, revision FROM records WHERE deleted = 0')
      .all<{ kind: string; payload: string; revision: number }>(),
  ]);
  const data: LibraryData = {
    papers: papers.results.map((p) => ({
      ...p,
      tags: JSON.parse(String(p.tags)),
    })) as unknown as LibraryData['papers'],
    annotations: [],
    types: [...DEFAULT_TYPES],
    readings: [],
  };
  for (const row of records.results) {
    if (
      row.kind !== 'annotations' &&
      row.kind !== 'types' &&
      row.kind !== 'readings'
    )
      continue;
    const value = { ...JSON.parse(row.payload), revision: row.revision };
    const array = data[row.kind] as { id: string }[];
    const existing = array.findIndex((x) => x.id === value.id);
    if (existing >= 0) array[existing] = value;
    else array.push(value);
  }
  return json(data);
}
