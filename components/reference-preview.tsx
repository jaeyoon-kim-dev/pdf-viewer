'use client';
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import {
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { Reference } from '@/lib/references';
import { safeUrl, type Article, type Reading } from '@/lib/model';
import { renderCanvas } from '@/lib/pdf';
import { useLibrary } from '@/lib/store';
export default function ReferencePreview({
  references,
  doc,
  paperId,
  sourcePage,
  onClose,
}: {
  references: Reference[];
  doc: PDFDocumentProxy;
  paperId: string;
  sourcePage: number;
  onClose: () => void;
}) {
  const { data, save } = useLibrary();
  const [index, setIndex] = useState(0);
  const reference = references[index];
  const [article, setArticle] = useState<Article>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullPage, setFullPage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState('');
  const saved = data.readings.find(
    (r) =>
      r.paperId === paperId &&
      r.page === sourcePage &&
      r.reference === reference.text,
  );
  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    setImage('');
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
      setArticle(saved?.article || fallback);
      setLoading(true);
      void fetch(`/api/citation?q=${encodeURIComponent(reference.text)}`, {
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error('Metadata unavailable');
          return r.json();
        })
        .then((a) => {
          if (!cancelled) setArticle(a as Article);
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
  }, [reference, doc, saved?.article]);
  async function toggle(checked: boolean) {
    if (!article) return;
    setBusy(true);
    try {
      if (!checked && saved) await save('readings', saved, true);
      else if (checked && !saved) {
        const reading: Reading = {
          id: crypto.randomUUID(),
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="reference-dialog">
        <div className="eyebrow">
          {reference.kind === 'citation'
            ? 'REFERENCE PREVIEW'
            : 'FIGURE & TABLE PREVIEW'}
        </div>
        <DialogTitle>
          {reference.kind === 'citation'
            ? article?.title || reference.label
            : reference.label}
        </DialogTitle>
        <DialogDescription>
          {reference.kind === 'citation'
            ? [article?.authors, article?.year].filter(Boolean).join(' · ') ||
              'Bibliographic information'
            : `Linked page ${reference.page}. Your reading position stays on page ${sourcePage}.`}
        </DialogDescription>
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
        {loading && (
          <output className="muted">
            {reference.kind === 'citation'
              ? 'Looking up article information…'
              : 'Rendering preview…'}
          </output>
        )}
        {reference.kind === 'citation' ? (
          <>
            <div className="citation-body">
              {article?.abstract ? (
                <p>{article.abstract}</p>
              ) : (
                !loading && (
                  <p className="muted">
                    No abstract is available from the metadata provider.
                  </p>
                )
              )}
              {article?.match === 'candidate' && (
                <p className="match-note">
                  Possible match from Crossref. Check the title against the
                  original reference below.
                </p>
              )}
              {article?.match === 'unresolved' && !loading && (
                <p className="match-note">
                  Could not identify this article reliably. You can still save
                  the original reference.
                </p>
              )}
              <details>
                <summary>Original reference</summary>
                <p>{reference.text}</p>
              </details>
            </div>
            <div className="button-row">
              {safeUrl(article?.url) && (
                <a
                  className="secondary-button"
                  href={safeUrl(article?.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Article page
                  <ArrowUpRight size={16} />
                </a>
              )}
              {safeUrl(article?.pdf) && (
                <a
                  className="secondary-button"
                  href={safeUrl(article?.pdf)}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF link
                  <ArrowUpRight size={16} />
                </a>
              )}
            </div>
            <label className="read-later-toggle" htmlFor="read-later-switch">
              <Bookmark size={20} />
              <span>
                <strong>Read later</strong>
                <small>
                  Keep this article and a link to where you found it.
                </small>
              </span>
              <Switch
                id="read-later-switch"
                checked={!!saved}
                disabled={busy}
                onCheckedChange={toggle}
              />
            </label>
            <p className="muted citation-attribution">
              Article metadata: Crossref. Availability varies by publisher.
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
      </DialogContent>
    </Dialog>
  );
}
