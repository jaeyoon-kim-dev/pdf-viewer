import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const papers = sqliteTable('papers', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  filename: text('filename').notNull(),
  pages: integer('pages').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: text('created_at').notNull(),
  tags: text('tags').notNull().default('[]'),
});
export const records = sqliteTable(
  'records',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    paperId: text('paper_id').references(() => papers.id),
    payload: text('payload').notNull(),
    revision: integer('revision').notNull().default(1),
    deleted: integer('deleted').notNull().default(0),
  },
  (t) => [index('idx_records_kind_paper').on(t.kind, t.paperId)],
);
