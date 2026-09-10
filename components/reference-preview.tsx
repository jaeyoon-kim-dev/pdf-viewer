'use client';
import { createId } from '@/lib/id';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import {
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Quote,
  Copy,
  Search,
} from 'lucide-react';
import { PopoverTitle, PopoverDescription } from '@/components/ui/popover';
import ReaderPopover from './reader-popover';
import type { ReaderAnchor } from '@/lib/popover-anchor';
import { bibtex, scholarSearch } from '@/lib/citation-format';
import { Switch } from '@/components/ui/switch';
import type { Reference } from '@/lib/references';
import { safeUrl, type Article, type Reading } from '@/lib/model';
import { renderCanvas } from '@/lib/pdf';
import { useLibrary } from '@/lib/store';
const articleCache = new Map<string, Article>();
export default function ReferencePreview({
  references,
  doc,
  paperId,
  sourcePage,
  onClose,
  anchor,
}: {
  references: Reference[];
  doc: PDFDocumentProxy;
  paperId: string;
  sourcePage: number;
  onClose: () => void;
  anchor?: ReaderAnchor;
}) {
  const { data, save } = useLibrary();
  const [index, setIndex] = useState(0);
  const reference = references[index];
  const [article, setArticle] = useState<Article>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullPage, setFullPage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<'cite' | 'reference' | null>(null);
  const [format, setFormat] = useState<'original' | 'bibtex'>('original');
  const [copyStatus, setCopyStatus] = useState('');
  const citation =
    format === 'bibtex' && article ? bibtex(article) : reference.text;
  const saved = data.readings.find(
    (r) =>
      r.paperId === paperId &&
      r.page === sourcePage &&
      r.reference === reference.text,
  );
  const savedArticleRef = useRef(saved?.article);
  useEffect(() => {
    savedArticleRef.current = saved?.article;
  }, [saved?.article]);
  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    setImage('');
    setExpanded(false);
    setSection(null);
    setCopyStatus('');
    setFullPage(false);
    setError('');
    setArticle(undefined);
    const controller = new AbortController();
    if (reference.kind === 'citation') {
      const fallback: Article = {
        title: reference.text.slice(0, 2000),
        raw: reference.text,
        authors: '',
        year: '',
        match: 'unresolved',
      };
      const cached =
        articleCache.get(reference.text) ||
        (savedArticleRef.current?.match !== 'unresolved'
          ? savedArticleRef.current
          : undefined);
      setArticle(cached || fallback);
      if (cached) {
        setLoading(false);
        return () => controller.abort();
      }
      setLoading(true);
      void fetch(`/api/citation?q=${encodeURIComponent(reference.text)}`, {
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error('Metadata unavailable');
          return r.json();
        })
        .then((a) => {
          if (!cancelled) {
            setArticle(a as Article);
            if ((a as Article).match !== 'unresolved') {
              articleCache.set(reference.text, a as Article);
              if (articleCache.size > 100)
                articleCache.delete(articleCache.keys().next().value!);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(true);
      void doc
        .getPage(reference.page)
        .then(async (page) => {
          const canvas = document.createElement('canvas');
          if (cancelled) return;
          task = await renderCanvas(page, canvas, 650);
          await task.promise;
          if (!cancelled) setImage(canvas.toDataURL('image/png'));
        })
        .catch(() => {
          if (!cancelled) setError('Could not render the linked page.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
      controller.abort();
      task?.cancel();
    };
  }, [reference, doc]);
  async function toggle(checked: boolean) {
    if (!article) return;
    setBusy(true);
    try {
      if (!checked && saved) await save('readings', saved, true);
      else if (checked && !saved) {
        const reading: Reading = {
          id: createId(),
          paperId,
          page: sourcePage,
          reference: reference.text,
          article,
          note: '',
          createdAt: new Date().toISOString(),
          revision: 0,
        };
        await save('readings', reading);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ReaderPopover
      anchor={anchor}
      onClose={onClose}
      className="reference-preview-popover"
    >
      <div className="scholar-card-header">
        {reference.kind === 'citation'
          ? `[${reference.label}]`
          : reference.label}
      </div>
      <PopoverTitle className="scholar-card-title">
        {reference.kind === 'citation' && safeUrl(article?.url) ? (
          <a href={safeUrl(article?.url)} target="_blank" rel="noreferrer">
            {article?.title || reference.label}
          </a>
        ) : reference.kind === 'citation' ? (
          loading ? (
            'Loading article details…'
          ) : (
            article?.title || reference.label
          )
        ) : (
          reference.label
        )}
      </PopoverTitle>
      <PopoverDescription className="scholar-card-meta">
        {reference.kind === 'citation'
          ? [
              article?.authors,
              [article?.venue, article?.year].filter(Boolean).join(', '),
            ]
              .filter(Boolean)
              .join(' — ') ||
            (loading
              ? 'Fetching authors and publication…'
              : 'Original bibliography entry')
          : `Page ${reference.page}`}
      </PopoverDescription>
      {references.length > 1 && (
        <div className="button-row">
          <button
            className="icon-button"
            disabled={index === 0}
            aria-label="Previous reference"
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft />
          </button>
          <span>
            {index + 1} / {references.length}
          </span>
          <button
            className="icon-button"
            disabled={index === references.length - 1}
            aria-label="Next reference"
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      )}
      <output className="preview-loading-status" aria-live="polite">
        {loading
          ? reference.kind === 'citation'
            ? 'Looking up article information…'
            : 'Rendering preview…'
          : 'Preview ready'}
      </output>
      {reference.kind === 'citation' ? (
        <>
          <div className="scholar-card-abstract" aria-busy={loading}>
            {loading && !article?.abstract ? (
              <div className="preview-loading-lines" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : article?.abstract ? (
              <>
                <p className={expanded ? '' : 'abstract-collapsed'}>
                  {article.abstract}
                </p>
                <button
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              </>
            ) : (
              !loading && (
                <p className="muted">
                  Abstract unavailable. The original reference is available
                  below.
                </p>
              )
            )}
          </div>
          {article?.match === 'candidate' && (
            <p className="scholar-match-note">
              Possible title match · verify against the original reference.
            </p>
          )}
          <div className="scholar-card-actions">
            <label className="scholar-read-later" htmlFor="read-later-switch">
              <Bookmark size={15} />
              Read later
              <Switch
                id="read-later-switch"
                checked={!!saved}
                disabled={busy || !article}
                onCheckedChange={toggle}
              />
            </label>
            <button
              aria-expanded={section === 'cite'}
              onClick={() => setSection(section === 'cite' ? null : 'cite')}
            >
              <Quote size={15} />
              Cite
            </button>
            <a
              href={scholarSearch(article, reference.text)}
              target="_blank"
              rel="noreferrer"
            >
              <Search size={15} />
              Search Scholar
            </a>
          </div>
          <div className="scholar-card-access">
            {safeUrl(article?.pdf) && (
              <a
                className="scholar-pdf-link"
                href={safeUrl(article?.pdf)}
                target="_blank"
                rel="noreferrer"
              >
                [PDF] {new URL(safeUrl(article?.pdf)!).hostname}
                <ArrowUpRight size={14} />
              </a>
            )}
            {safeUrl(article?.url) && (
              <a href={safeUrl(article?.url)} target="_blank" rel="noreferrer">
                Article page
                <ArrowUpRight size={14} />
              </a>
            )}
            <button
              aria-expanded={section === 'reference'}
              onClick={() =>
                setSection(section === 'reference' ? null : 'reference')
              }
            >
              See in References
            </button>
          </div>
          {section === 'reference' && (
            <section
              className="scholar-card-detail"
              aria-label="Original bibliography entry"
            >
              <strong>
                [{reference.label}] · Bibliography, page {reference.page}
              </strong>
              <p>{reference.text}</p>
            </section>
          )}
          {section === 'cite' && (
            <section className="scholar-card-detail" aria-label="Copy citation">
              <label>
                Citation format{' '}
                <select
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value as 'original' | 'bibtex');
                    setCopyStatus('');
                  }}
                >
                  <option value="original">Original reference</option>
                  <option value="bibtex">BibTeX</option>
                </select>
              </label>
              <textarea
                aria-label="Citation text"
                readOnly
                rows={5}
                value={citation}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(citation);
                    setCopyStatus('Copied');
                  } catch {
                    setCopyStatus(
                      'Select the citation text above and copy it.',
                    );
                  }
                }}
              >
                <Copy size={14} />
                Copy citation
              </button>
              <output>{copyStatus}</output>
              {format === 'bibtex' && (
                <small>
                  Generated from available metadata; check before citing.
                </small>
              )}
            </section>
          )}
          <p className="scholar-card-attribution">
            Metadata: Crossref · Search Scholar opens a new tab.
          </p>
        </>
      ) : (
        <>
          <div className={`figure-preview ${fullPage ? 'full-page' : ''}`}>
            {image && (
              <img
                src={image}
                alt={`Page containing ${reference.label}`}
                style={
                  fullPage
                    ? undefined
                    : {
                        marginTop: `${-Math.max(0, reference.y - 0.45) * 100}%`,
                      }
                }
              />
            )}
          </div>
          <p className="muted">{reference.text}</p>
          <button
            className="text-button"
            onClick={() => setFullPage(!fullPage)}
          >
            {fullPage ? 'Show figure area' : 'Show entire linked page'}
          </button>
          <p className="muted">
            The figure area is estimated from its caption or PDF destination.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </ReaderPopover>
  );
}
