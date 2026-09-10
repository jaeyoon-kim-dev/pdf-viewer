import { json } from '@/lib/server';
import { safeUrl, type Article } from '@/lib/model';
type CrossrefWork = {
  title?: string[];
  DOI?: string;
  URL?: string;
  author?: { given?: string; family?: string }[];
  published?: { 'date-parts'?: number[][] };
  abstract?: string;
  link?: Record<string, string>[];
};
export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get('q') || '').trim();
  if (raw.length < 8 || raw.length > 10000)
    return json({ error: 'A complete reference is needed.' }, 400);
  const fallback: Article = {
    title: raw.slice(0, 2000),
    raw,
    authors: '',
    year: '',
    match: 'unresolved',
  };
  const doi = raw
    .match(/10\.\d{4,9}\/[\w.\-;()/:]+/i)?.[0]
    .replace(/[.,;]+$/, '');
  try {
    const endpoint = doi
      ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
      : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(raw.slice(0, 1500))}&rows=1`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Paperthread/0.1 (personal scholarly PDF reader)',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      return json({
        ...fallback,
        reason: 'Metadata service is temporarily unavailable.',
      });
    const data = (await response.json()) as {
      message: CrossrefWork & { items?: CrossrefWork[] };
    };
    const work = doi ? data.message : data.message.items?.[0];
    if (!work?.title?.[0]) return json(fallback);
    const title = String(work.title[0]);
    const titleWords = title.toLowerCase().match(/[a-z]{3,}/g) || [];
    const overlap =
      titleWords.filter((t: string) => raw.toLowerCase().includes(t)).length /
      Math.max(1, titleWords.length);
    if (!doi && (titleWords.length < 3 || overlap < 0.65))
      return json(fallback);
    const article: Article = {
      title: title.slice(0, 2000),
      raw,
      doi: work.DOI,
      authors: (work.author || [])
        .map((a: { given?: string; family?: string }) =>
          [a.given, a.family].filter(Boolean).join(' '),
        )
        .join(', ')
        .slice(0, 3000),
      year: String(work.published?.['date-parts']?.[0]?.[0] || ''),
      abstract: work.abstract
        ? String(work.abstract)
            .replace(/<[^>]*>/g, '')
            .slice(0, 15000)
        : undefined,
      url: safeUrl(work.DOI ? `https://doi.org/${work.DOI}` : work.URL),
      pdf: safeUrl(
        work.link?.find(
          (x: Record<string, string>) =>
            x['content-type'] === 'application/pdf',
        )?.URL,
      ),
      match: doi ? 'doi' : 'candidate',
    };
    return json(article);
  } catch {
    return json({
      ...fallback,
      reason:
        'Metadata lookup is unavailable. The original reference is preserved.',
    });
  }
}
