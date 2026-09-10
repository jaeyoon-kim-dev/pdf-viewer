import test from 'node:test';
import assert from 'node:assert/strict';
import { bibtex, scholarSearch } from '../lib/citation-format.ts';
import { validateRecord } from '../lib/validation.ts';
import type { Article } from '../lib/model.ts';
const article: Article = {
  title: 'A {study} & results',
  authors: 'Ada Example, Ben Example',
  year: '2024',
  venue: 'Research Journal',
  doi: '10.1234/example',
  raw: 'Original reference',
  match: 'doi',
};
void test('citation export escapes BibTeX fields and preserves publication metadata', () => {
  const output = bibtex(article);
  assert.ok(output.startsWith('@article{reference,'));
  assert.ok(output.includes('A \\{study\\} \\& results'));
  assert.ok(output.includes('Ada Example and Ben Example'));
  assert.ok(output.includes('journal = {Research Journal}'));
  assert.ok(bibtex({ ...article, venue: undefined }).startsWith('@misc'));
});
void test('Scholar search uses a DOI or the original unresolved reference', () => {
  assert.equal(
    new URL(scholarSearch(article)).searchParams.get('q'),
    article.doi,
  );
  assert.equal(
    new URL(
      scholarSearch(
        { ...article, match: 'unresolved', doi: undefined },
        'Original & reference',
      ),
    ).searchParams.get('q'),
    'Original & reference',
  );
});
void test('saved article publication metadata has bounded validation', () => {
  const record = {
    id: 'r',
    paperId: 'p',
    page: 1,
    revision: 0,
    note: '',
    createdAt: '2026-09-10',
    reference: 'Original',
    article,
  };
  assert.equal(validateRecord('readings', 'r', record), true);
  assert.equal(
    validateRecord('readings', 'r', {
      ...record,
      article: { ...article, venue: 42 },
    }),
    false,
  );
  assert.equal(
    validateRecord('readings', 'r', {
      ...record,
      article: { ...article, venue: 'x'.repeat(2001) },
    }),
    false,
  );
});
