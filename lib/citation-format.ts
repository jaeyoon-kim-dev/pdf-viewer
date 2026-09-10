import type { Article } from './model';
const singleLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim();
export function bibtex(article: Article): string {
  const escape = (value: string) =>
    singleLine(value).replace(/[\\{}%&#_$]/g, (character) => `\\${character}`);
  const fields = [
    ['title', article.title],
    ['author', article.authors.split(', ').filter(Boolean).join(' and ')],
    ['year', article.year],
    ['journal', article.venue],
    ['doi', article.doi],
    ['url', article.url],
  ].filter((field): field is [string, string] => !!field[1]);
  return `@${article.venue ? 'article' : 'misc'}{reference,\n${fields.map(([key, value]) => `  ${key} = {${escape(value)}}`).join(',\n')}\n}`;
}
export function scholarSearch(article?: Article, original = '') {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(article?.doi || (article?.match !== 'unresolved' && article?.title) || original)}`;
}
