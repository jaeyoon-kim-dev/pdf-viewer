'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  PanelRight,
  PenLine,
  StickyNote,
  Download,
  Tags,
  Link2,
  ArrowLeft,
  Search,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { useLibrary } from '@/lib/store';
import { loadPdf, pageText } from '@/lib/pdf';
import { extractReferences, type Reference } from '@/lib/references';
import type { Annotation } from '@/lib/model';
import PdfPage from './pdf-page';
import AnnotationEditor from './annotation-editor';
import ReferencePreview from './reference-preview';
import PaperDetails from './paper-details';
import SyncStatus from './sync-status';
import Pwa from './pwa';
import { registerReaderTools } from '@/lib/webmcp';
type Layout = 'continuous' | 'single' | 'two' | 'horizontal';
export default function Reader({ paperId }: { paperId: string }) {
  const { data, loaded, save } = useLibrary();
  const paper = data.papers.find((p) => p.id === paperId);
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [aspect, setAspect] = useState(1.414);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [layout, setLayout] = useState<Layout>('continuous');
  const [theme, setTheme] = useState('light');
  const [pen, setPen] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [panelTab, setPanelTab] = useState('notes');
  const [width, setWidth] = useState(850);
  const [editing, setEditing] = useState<Annotation>();
  const [selected, setSelected] = useState<string>();
  const [preview, setPreview] = useState<{
    refs: Reference[];
    source: number;
  }>();
  const [details, setDetails] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [indexProgress, setIndexProgress] = useState(0);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<{ page: number; text: string }[]>([]);
  const [offline, setOffline] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const currentPage = useRef(1);
  const initialPage = useRef(1);
  const initialLinkApplied = useRef(false);
  const annotations = data.annotations
    .filter((a) => a.paperId === paperId)
    .sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = Number(params.get('page'));
    initialPage.current = Number.isInteger(p) && p > 0 ? p : 1;
    setPage(initialPage.current);
    currentPage.current = initialPage.current;
    setSelected(params.get('annotation') || undefined);
    try {
      const prefs = JSON.parse(
        localStorage.getItem('paperthread-view') || '{}',
      );
      if (['continuous', 'single', 'two', 'horizontal'].includes(prefs.layout))
        setLayout(prefs.layout);
      if (['light', 'dark', 'sepia'].includes(prefs.theme))
        setTheme(prefs.theme);
      if (typeof prefs.zoom === 'number')
        setZoom(Math.max(50, Math.min(200, prefs.zoom)));
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return () => document.documentElement.classList.remove('dark');
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'paperthread-view',
        JSON.stringify({ layout, theme, zoom }),
      );
    } catch {}
  }, [layout, theme, zoom]);
  useEffect(() => {
    let cancelled = false;
    let document: PDFDocumentProxy | undefined;
    setError('');
    void fetch(`/api/papers/${paperId}/file`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'Paper not found.'
              : 'Could not open the PDF. Reconnect if it is not downloaded.',
          );
        document = await loadPdf(new Uint8Array(await response.arrayBuffer()));
        if (cancelled) {
          await document.loadingTask.destroy();
          return;
        }
        const viewport = (await document.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(viewport.height / viewport.width);
        setDoc(document);
        setPage((p) => Math.min(p, document!.numPages));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    if ('caches' in window)
      void caches
        .open('paperthread-pdfs-v1')
        .then((c) => c.match(`/api/papers/${paperId}/file`))
        .then((r) => setOffline(!!r));
    return () => {
      cancelled = true;
      void document?.loadingTask.destroy();
    };
  }, [paperId]);
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void (async () => {
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return;
        pages.push(await pageText(doc, n));
        if (cancelled) return;
        setIndexProgress(n);
        if (n % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!cancelled) setReferences(extractReferences(pages));
    })().catch(() => {
      if (!cancelled)
        setMessage(
          'Some text could not be indexed. Existing PDF links remain available.',
        );
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);
  useEffect(() => {
    if (!scroller.current) return;
    const resize = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    resize.observe(scroller.current);
    return () => resize.disconnect();
  }, [doc, sidebar]);
  const goto = useCallback(
    (requested: number, mark?: string) => {
      if (!doc) return;
      const n = Math.max(1, Math.min(doc.numPages, requested));
      setPage(n);
      currentPage.current = n;
      setSelected(mark);
      const params = new URLSearchParams({ page: String(n) });
      if (mark) params.set('annotation', mark);
      history.replaceState(history.state, '', `${location.pathname}?${params}`);
      if (layout === 'continuous' || layout === 'horizontal')
        requestAnimationFrame(() =>
          document.getElementById(`page-${n}`)?.scrollIntoView({
            block: 'start',
            inline: 'start',
            behavior: 'instant',
          }),
        );
      else scroller.current?.scrollTo({ top: 0, left: 0 });
    },
    [doc, layout],
  );
  useEffect(() => {
    if (!doc || initialLinkApplied.current) return;
    initialLinkApplied.current = true;
    const timer = setTimeout(
      () =>
        goto(
          initialPage.current,
          new URLSearchParams(location.search).get('annotation') || undefined,
        ),
      200,
    );
    return () => clearTimeout(timer);
  }, [doc, goto]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[role="dialog"]',
        ) ||
        editing ||
        preview
      )
        return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goto(currentPage.current + (layout === 'two' ? 2 : 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goto(currentPage.current - (layout === 'two' ? 2 : 1));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [goto, layout, editing, preview]);
  const create = useCallback(
    (value: Partial<Annotation> & { page: number }) => {
      const a: Annotation = {
        id: crypto.randomUUID(),
        paperId,
        kind: 'highlight',
        quote: '',
        note: '',
        types: [],
        rects: [],
        points: [],
        color: '#facc15',
        createdAt: new Date().toISOString(),
        revision: 0,
        ...value,
      };
      if (a.kind === 'ink')
        void save('annotations', a)
          .then(() =>
            setMessage(
              'Stroke saved. Add a note or collection from the annotations panel.',
            ),
          )
          .catch((e) => {
            setError(String(e));
            setEditing(a);
          });
      else setEditing(a);
    },
    [paperId, save],
  );
  useEffect(
    () =>
      registerReaderTools({
        paperId,
        getPages: () => doc?.numPages || 0,
        navigate: (n) => goto(n),
        addNote: async (n, note) => {
          const a: Annotation = {
            id: crypto.randomUUID(),
            paperId,
            page: n,
            kind: 'note',
            quote: '',
            note,
            types: [],
            rects: [],
            points: [],
            color: '#facc15',
            createdAt: new Date().toISOString(),
            revision: 0,
          };
          await save('annotations', a);
          return a.id;
        },
      }),
    [doc, goto, paperId, save],
  );
  async function searchPaper(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!doc || !search.trim()) {
      setMatches([]);
      return;
    }
    const result = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const t = await pageText(doc, n);
      const line = t.lines.find((l) =>
        l.text.toLowerCase().includes(search.toLowerCase()),
      );
      if (line) result.push({ page: n, text: line.text });
    }
    setMatches(result);
    setPanelTab('search');
    setSidebar(true);
  }
  async function downloadOffline() {
    if (process.env.NODE_ENV !== 'production') {
      setMessage(
        'Offline installation is available in the production build: npm run build, then npm start.',
      );
      return;
    }
    if (!doc || !('caches' in window)) {
      setError('Offline storage requires HTTPS or localhost.');
      return;
    }
    setMessage('Downloading for offline reading…');
    try {
      const cache = await caches.open('paperthread-pdfs-v1');
      const url = `/api/papers/${paperId}/file`;
      const bytes = await doc.getData();
      await cache.put(
        url,
        new Response(bytes.slice().buffer as ArrayBuffer, {
          headers: { 'Content-Type': 'application/pdf' },
        }),
      );
      const shell = await caches.open('paperthread-shell-v1');
      const route = await fetch(location.pathname);
      if (!route.ok || route.redirected)
        throw new Error('Could not save the reader page.');
      await shell.put(location.pathname, route);
      const resources = performance
        .getEntriesByType('resource')
        .map((r) => new URL(r.name))
        .filter(
          (u) =>
            u.origin === location.origin &&
            /\.(js|mjs|css|woff2?|bcmap|ttf|wasm)$/.test(u.pathname),
        );
      await Promise.all(
        [...new Set(resources.map((u) => u.href))].map(async (url) => {
          if (!(await shell.match(url))) await shell.add(url);
        }),
      );
      const pdfAssets = (await (
        await fetch('/pdfjs/assets.json')
      ).json()) as string[];
      for (let i = 0; i < pdfAssets.length; i += 8)
        await Promise.all(
          pdfAssets.slice(i, i + 8).map(async (url) => {
            if (!(await shell.match(url))) await shell.add(url);
          }),
        );
      if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
      if (navigator.storage?.persist) await navigator.storage.persist();
      setOffline(true);
      setMessage('Paper saved for offline reading on this device.');
    } catch (e) {
      setError(`Could not finish the offline download: ${String(e)}`);
    }
  }
  const pageWidth =
    (Math.max(
      220,
      Math.min(
        920,
        (width - (layout === 'two' ? 64 : 48)) / (layout === 'two' ? 2 : 1),
      ),
    ) *
      zoom) /
    100;
  const visiblePages = doc
    ? layout === 'single'
      ? [page]
      : layout === 'two'
        ? [page, ...(page < doc.numPages ? [page + 1] : [])]
        : Array.from({ length: doc.numPages }, (_, i) => i + 1)
    : [];
  return (
    <main className={`reader theme-${theme}`}>
      <header className="reader-header">
        <a className="back-link" href="/" aria-label="Back to library">
          <ArrowLeft size={20} />
        </a>
        <a className="reader-brand" href="/">
          <BookOpen size={21} />
        </a>
        <div className="reader-paper-title">
          <strong>{paper?.title || 'Opening paper…'}</strong>
          <div className="tag-list">
            {paper?.tags.map((tag) => (
              <span className="tag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="header-actions">
          <Pwa />
          <SyncStatus />
          <button
            className="icon-button"
            aria-label="Paper details and tags"
            onClick={() => setDetails(true)}
          >
            <Tags size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Copy paper link"
            onClick={async () => {
              try {
                const link = new URL(location.pathname, location.origin);
                link.searchParams.set('page', String(currentPage.current));
                await navigator.clipboard.writeText(link.href);
                setMessage('Paper link copied.');
              } catch {
                setMessage(
                  'Use the address bar to copy this paper’s unique link.',
                );
              }
            }}
          >
            <Link2 size={18} />
          </button>
        </div>
      </header>
      <div className="reader-toolbar">
        <div className="button-row page-controls">
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => goto(page - (layout === 'two' ? 2 : 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <label className="page-input">
            <input
              aria-label="Page number"
              key={page}
              defaultValue={page}
              type="number"
              min={1}
              max={doc?.numPages || 1}
              onBlur={(e) => goto(Number(e.target.value) || 1)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            <span>/ {doc?.numPages || '—'}</span>
          </label>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={!doc || page >= doc.numPages}
            onClick={() => goto(page + (layout === 'two' ? 2 : 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <NativeSelect
          aria-label="Page layout"
          value={layout}
          onChange={(e) => {
            const value = e.target.value as Layout;
            setLayout(value);
            if (value === 'continuous' || value === 'horizontal')
              setTimeout(
                () =>
                  document
                    .getElementById(`page-${page}`)
                    ?.scrollIntoView({ block: 'start', inline: 'start' }),
                0,
              );
          }}
        >
          <NativeSelectOption value="continuous">
            Continuous vertical
          </NativeSelectOption>
          <NativeSelectOption value="horizontal">
            Continuous horizontal
          </NativeSelectOption>
          <NativeSelectOption value="single">Single page</NativeSelectOption>
          <NativeSelectOption value="two">Two pages</NativeSelectOption>
        </NativeSelect>
        <div className="button-row zoom-controls">
          <button
            className="icon-button"
            aria-label="Zoom out"
            disabled={zoom <= 50}
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
          >
            <Minus size={16} />
          </button>
          <button
            className="zoom-value"
            title="Fit width"
            onClick={() => setZoom(100)}
          >
            {Math.round(zoom)}%
          </button>
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={zoom >= 200}
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <Plus size={16} />
          </button>
        </div>
        <NativeSelect
          aria-label="Reading theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <NativeSelectOption value="light">Light</NativeSelectOption>
          <NativeSelectOption value="sepia">Sepia</NativeSelectOption>
          <NativeSelectOption value="dark">Dark</NativeSelectOption>
        </NativeSelect>
        <div className="toolbar-spacer" />
        <label className="pen-switch" htmlFor="pen-enabled">
          <PenLine size={17} />
          <span>Pen</span>
          <Switch id="pen-enabled" checked={pen} onCheckedChange={setPen} />
        </label>
        <button
          className="icon-button"
          aria-label="Add page memo"
          title="Add page memo"
          disabled={!doc}
          onClick={() => create({ page, kind: 'note' })}
        >
          <StickyNote size={18} />
        </button>
        <button
          className={`icon-button ${offline ? 'is-active' : ''}`}
          aria-label={
            offline ? 'Downloaded for offline use' : 'Download for offline use'
          }
          title={
            offline ? 'Downloaded for offline use' : 'Download for offline use'
          }
          disabled={!doc}
          onClick={downloadOffline}
        >
          <Download size={18} />
        </button>
        <button
          className={`icon-button ${sidebar ? 'is-active' : ''}`}
          aria-label="Toggle annotations panel"
          aria-pressed={sidebar}
          onClick={() => setSidebar(!sidebar)}
        >
          <PanelRight size={19} />
        </button>
      </div>
      <div className="reader-body">
        <div
          ref={scroller}
          className={`reader-scroll layout-${layout}`}
          onScroll={() => {
            if (
              !doc ||
              !['continuous', 'horizontal'].includes(layout) ||
              !scroller.current
            )
              return;
            const box = scroller.current.getBoundingClientRect();
            const pages =
              scroller.current.querySelectorAll<HTMLElement>('.pdf-page-shell');
            let nearest = page,
              distance = Infinity;
            pages.forEach((el) => {
              const r = el.getBoundingClientRect();
              const d =
                layout === 'horizontal'
                  ? Math.abs(r.left - box.left - 24)
                  : Math.abs(r.top - box.top - 24);
              if (d < distance) {
                nearest = Number(el.id.replace('page-', ''));
                distance = d;
              }
            });
            if (nearest !== currentPage.current) {
              currentPage.current = nearest;
              setPage(nearest);
            }
          }}
        >
          <div className="page-track">
            {visiblePages.map((n) => (
              <PdfPage
                key={n}
                doc={doc!}
                number={n}
                width={pageWidth}
                defaultAspect={aspect}
                annotations={annotations.filter((a) => a.page === n)}
                references={references}
                pen={pen}
                selected={selected}
                layout={layout}
                onSelect={create}
                onEdit={setEditing}
                onPreview={(refs) => setPreview({ refs, source: n })}
                onPage={(delta) =>
                  goto(currentPage.current + delta * (layout === 'two' ? 2 : 1))
                }
                onZoom={(ratio) =>
                  setZoom((z) => Math.max(50, Math.min(200, z * ratio)))
                }
              />
            ))}
            {!doc && (
              <div className="reader-loading">
                {error || 'Opening PDF…'}
                {error && (
                  <a className="secondary-button" href="/">
                    Return to library
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {sidebar && (
          <aside className="reader-sidebar">
            <div className="sidebar-heading">
              <strong>Paper notebook</strong>
              <button
                className="icon-button"
                aria-label="Close panel"
                onClick={() => setSidebar(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form className="search-box paper-search" onSubmit={searchPaper}>
              <Search size={16} />
              <input
                aria-label="Search within paper"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find in paper…"
              />
              <button className="icon-button" type="submit" aria-label="Find">
                <ChevronRight size={16} />
              </button>
            </form>
            <Tabs
              value={panelTab}
              onValueChange={(value) => setPanelTab(String(value))}
            >
              <TabsList variant="line" className="panel-tabs">
                <TabsTrigger value="notes">
                  Annotations <span>{annotations.length}</span>
                </TabsTrigger>
                <TabsTrigger value="refs">References</TabsTrigger>
                {panelTab === 'search' && (
                  <TabsTrigger value="search">Results</TabsTrigger>
                )}
              </TabsList>
            </Tabs>
            <div className="sidebar-items">
              {panelTab === 'notes' ? (
                annotations.length ? (
                  annotations.map((a) => (
                    <article
                      className={`sidebar-note ${selected === a.id ? 'selected' : ''}`}
                      key={a.id}
                    >
                      <button
                        className="note-location"
                        onClick={() => goto(a.page, a.id)}
                      >
                        <span
                          className="type-dot"
                          style={{ background: a.color }}
                        />
                        Page {a.page} · {a.kind}
                        <ChevronRight size={14} />
                      </button>
                      {a.quote && <blockquote>{a.quote}</blockquote>}
                      {a.note && <p>{a.note}</p>}
                      <div className="tag-list">
                        {a.types.map((id) => (
                          <span className="tag" key={id}>
                            {data.types.find((t) => t.id === id)?.name}
                          </span>
                        ))}
                        {a.resolved && <span className="tag">Resolved</span>}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setEditing(a)}
                      >
                        Edit note & collections
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="sidebar-empty">
                    <StickyNote size={27} />
                    <h2>Think in the margins.</h2>
                    <p>
                      Drag across text to highlight, underline, or collect a
                      thought. Every annotation can hold a note.
                    </p>
                    <button
                      className="secondary-button"
                      disabled={!doc}
                      onClick={() => create({ page, kind: 'note' })}
                    >
                      Add page memo
                    </button>
                  </div>
                )
              ) : panelTab === 'refs' ? (
                <>
                  {doc && indexProgress < doc.numPages && (
                    <p className="muted">
                      Finding references · page {indexProgress} / {doc.numPages}
                    </p>
                  )}
                  {references.map((r) => (
                    <button
                      className="reference-list-item"
                      key={r.id}
                      onClick={() => setPreview({ refs: [r], source: page })}
                    >
                      <span className="tag">{r.label}</span>
                      <p>{r.text}</p>
                    </button>
                  ))}
                  {doc &&
                    indexProgress === doc.numPages &&
                    !references.length && (
                      <p className="muted">
                        No references were recognized automatically. Existing
                        links in the PDF can still be previewed. Scanned pages
                        need OCR before text can be recognized.
                      </p>
                    )}
                </>
              ) : matches.length ? (
                matches.map((m) => (
                  <button
                    className="reference-list-item"
                    key={m.page}
                    onClick={() => goto(m.page)}
                  >
                    <strong>Page {m.page}</strong>
                    <p>{m.text}</p>
                  </button>
                ))
              ) : (
                <p className="muted">No matching text found.</p>
              )}
            </div>
          </aside>
        )}
      </div>
      <footer className="reader-status">
        <span>
          {message ||
            (pen
              ? 'Pen draws · fingers select text or scroll'
              : 'Drag across text to annotate · swipe vertically to scroll')}
        </span>
        {message && (
          <button aria-label="Dismiss message" onClick={() => setMessage('')}>
            <X size={14} />
          </button>
        )}
        <span className="status-right">
          {loaded && paper ? `${paper.pages} pages` : ''}
        </span>
      </footer>
      {error && doc && (
        <div className="reader-error" role="alert">
          {error}
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {editing && (
        <AnnotationEditor
          key={editing.id}
          annotation={editing}
          onClose={() => setEditing(undefined)}
        />
      )}{' '}
      {preview && doc && (
        <ReferencePreview
          key={preview.refs.map((r) => r.id).join('|')}
          doc={doc}
          paperId={paperId}
          sourcePage={preview.source}
          references={preview.refs}
          onClose={() => setPreview(undefined)}
        />
      )}{' '}
      {details && paper && (
        <PaperDetails paper={paper} onClose={() => setDetails(false)} />
      )}
    </main>
  );
}
