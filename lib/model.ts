export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number; pressure: number };
export type Paper = {
  id: string;
  title: string;
  filename: string;
  pages: number;
  bytes: number;
  createdAt: string;
  tags: string[];
};
export type EntityType = {
  id: string;
  name: string;
  color: string;
  revision: number;
};
export type Annotation = {
  id: string;
  paperId: string;
  page: number;
  kind: 'highlight' | 'underline' | 'note' | 'ink';
  quote: string;
  note: string;
  types: string[];
  rects: Rect[];
  points: Point[];
  color: string;
  createdAt: string;
  revision: number;
  resolved?: boolean;
};
export type Article = {
  title: string;
  authors: string;
  year: string;
  venue?: string;
  doi?: string;
  abstract?: string;
  url?: string;
  pdf?: string;
  match: 'doi' | 'candidate' | 'unresolved';
  raw: string;
};
export type Reading = {
  id: string;
  paperId: string;
  page: number;
  reference: string;
  article: Article;
  note: string;
  createdAt: string;
  revision: number;
};
export type LibraryData = {
  papers: Paper[];
  annotations: Annotation[];
  types: EntityType[];
  readings: Reading[];
};
export type RecordKind = 'annotations' | 'types' | 'readings';
export type SavedRecord = Annotation | EntityType | Reading;
export const DEFAULT_TYPES: EntityType[] = [
  { id: 'phrase', name: 'Phrases', color: '#7c3aed', revision: 0 },
  { id: 'question', name: 'Questions', color: '#d97706', revision: 0 },
];
export const EMPTY_LIBRARY: LibraryData = {
  papers: [],
  annotations: [],
  types: DEFAULT_TYPES,
  readings: [],
};
export const sourceHref = (
  item: { paperId: string; page: number; id?: string },
  annotation = true,
) =>
  `/papers/${item.paperId}?page=${item.page}${annotation && item.id ? `&annotation=${item.id}` : ''}`;
export function safeUrl(value?: string) {
  try {
    const u = new URL(value || '');
    return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
