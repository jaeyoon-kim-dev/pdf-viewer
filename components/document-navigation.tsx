'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import HighlightLayer from './highlight-layer';
import { X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Annotation } from '@/lib/model';
import { renderCanvas } from '@/lib/pdf';
type Outline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;
function Thumbnail({
  doc,
  page,
  current,
  annotations,
  onSelect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  current: boolean;
  annotations: Annotation[];
  onSelect: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [aspect, setAspect] = useState(1.414);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      {
        root: button.current?.closest('.document-navigation-content'),
        rootMargin: '180px',
      },
    );
    if (button.current) observer.observe(button.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    const target = canvas.current;
    void doc
      .getPage(page)
      .then(async (pdfPage) => {
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: 1 });
        setAspect(viewport.height / viewport.width);
        task = await renderCanvas(pdfPage, target, 140);
        if (cancelled) {
          task.cancel();
          return;
        }
        await task.promise;
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'RenderingCancelledException')
          setError(true);
      });
    return () => {
      cancelled = true;
      task?.cancel();
      target.width = 0;
      target.height = 0;
    };
  }, [doc, page, active]);
  return (
    <button
      ref={button}
      className="page-thumbnail"
      aria-label={`Go to page ${page}, ${annotations.length} annotations`}
      aria-current={current ? 'page' : undefined}
      onClick={onSelect}
    >
      <div className="thumbnail-sheet" style={{ height: 140 * aspect }}>
        <canvas ref={canvas} aria-hidden="true" />
        <HighlightLayer annotations={annotations} thumbnail />
        <svg
          className="thumbnail-annotations"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {annotations.map((a) => (
            <g key={a.id}>
              {a.kind === 'note' && !a.quote && a.rects[0] ? (
                <rect
                  x={a.rects[0].x}
                  y={a.rects[0].y}
                  width={0.06}
                  height={0.045}
                  rx={0.007}
                  fill={a.color}
                  stroke="#665522"
                  strokeWidth={0.003}
                />
              ) : (
                a.rects.map((r, i) =>
                  a.kind === 'underline' ? (
                    <line
                      key={i}
                      x1={r.x}
                      y1={r.y + r.h}
                      x2={r.x + r.w}
                      y2={r.y + r.h}
                      stroke={a.color}
                      strokeWidth={0.006}
                    />
                  ) : (
                    <rect
                      key={i}
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      fill={a.color}
                      fillOpacity={0}
                    />
                  ),
                )
              )}
              {a.points.length > 0 && (
                <polyline
                  points={a.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={0.004}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          ))}
        </svg>
        {error && <span>Preview unavailable</span>}
      </div>
      <span>
        {page}
        {annotations.length > 0 && (
          <small className="thumbnail-count">
            {' '}
            · {annotations.length} notes
          </small>
        )}
      </span>
    </button>
  );
}
export default function DocumentNavigation({
  doc,
  page,
  onNavigate,
  onClose,
  annotations,
}: {
  doc: PDFDocumentProxy;
  page: number;
  onNavigate: (page: number) => void;
  onClose: () => void;
  annotations: Annotation[];
}) {
  const [tab, setTab] = useState('contents');
  const byPage = useMemo(() => {
    const pages = new Map<number, Annotation[]>();
    for (const annotation of annotations)
      pages.set(annotation.page, [
        ...(pages.get(annotation.page) || []),
        annotation,
      ]);
    return pages;
  }, [annotations]);
  const [outline, setOutline] = useState<Outline>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void doc
      .getOutline()
      .then((items) => {
        if (!cancelled) setOutline(items || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not read the document outline.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);
  async function navigate(item: Outline[number]) {
    try {
      const destination =
        typeof item.dest === 'string'
          ? await doc.getDestination(item.dest)
          : item.dest;
      if (!destination)
        throw new Error('This outline entry has no page destination.');
      const target =
        typeof destination[0] === 'number'
          ? destination[0]
          : await doc.getPageIndex(destination[0]);
      onNavigate(target + 1);
    } catch {
      setError('Could not locate that outline entry.');
    }
  }
  function entries(items: Outline, depth = 0) {
    return (
      <ul className="outline-entries">
        {items.map((item, index) => (
          <li key={`${index}-${item.title}`}>
            {item.items?.length && depth < 12 ? (
              <details>
                <summary>
                  <button onClick={() => navigate(item)} disabled={!item.dest}>
                    {item.title}
                  </button>
                </summary>
                {entries(item.items, depth + 1)}
              </details>
            ) : (
              <button onClick={() => navigate(item)} disabled={!item.dest}>
                {item.title}
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <aside className="document-sidebar" aria-label="Document navigation">
      <div className="sidebar-heading">
        <strong>Document</strong>
        <button
          className="icon-button"
          aria-label="Hide document navigation"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="document-navigation-tabs">
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="document-navigation-content">
        {tab === 'contents' ? (
          <>
            {loading ? (
              <p>Loading contents…</p>
            ) : outline.length ? (
              entries(outline)
            ) : (
              <p>
                No table of contents is embedded in this PDF. Use Pages to
                browse.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        ) : (
          <div className="page-thumbnails">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <Thumbnail
                key={i + 1}
                doc={doc}
                page={i + 1}
                current={page === i + 1}
                annotations={byPage.get(i + 1) || []}
                onSelect={() => onNavigate(i + 1)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
