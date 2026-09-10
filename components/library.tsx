'use client';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  Upload,
  Quote,
  CircleHelp,
  Bookmark,
  ArrowUpRight,
  Search,
  Plus,
  Tags,
  Download,
  FileText,
} from 'lucide-react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { useLibrary, exportLibrary } from '@/lib/store';
import { rememberSource } from '@/lib/reading-position';
import { sourceHref, safeUrl, type Paper, type Annotation } from '@/lib/model';
import { loadPdf } from '@/lib/pdf';
import SyncStatus from './sync-status';
import { AddType } from './type-picker';
import AnnotationEditor from './annotation-editor';
import PaperDetails from './paper-details';
import Pwa from './pwa';
export default function Library() {
  const { data, loaded, refresh, save } = useLibrary();
  const [tab, setTab] = useState('papers');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Annotation>();
  const [paperEdit, setPaperEdit] = useState<Paper>();
  const paperMap = useMemo(
    () => new Map(data.papers.map((p) => [p.id, p])),
    [data.papers],
  );
  const allTags = [...new Set(data.papers.flatMap((p) => p.tags))].sort();
  const papers = data.papers.filter(
    (p) =>
      (!tag || p.tags.includes(tag)) &&
      `${p.title} ${p.tags.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const annotations = data.annotations.filter(
    (a) =>
      (tab === 'all' || a.types.includes(tab)) &&
      `${a.quote} ${a.note} ${paperMap.get(a.paperId)?.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const readings = data.readings.filter((r) =>
    `${r.article.title} ${r.note} ${r.reference}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const groups = new Map<string, typeof readings>();
  for (const r of readings) {
    const key =
      r.article.doi?.toLowerCase() ||
      r.article.title.toLowerCase().replace(/\W/g, '');
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      setError('Choose a PDF under 40 MB.');
      return;
    }
    setError('');
    setBusy('Checking PDF…');
    let doc;
    try {
      doc = await loadPdf(new Uint8Array(await file.arrayBuffer()));
      const metadata = await doc.getMetadata();
      const title = (metadata.info as { Title?: string }).Title;
      const form = new FormData();
      form.set('file', file);
      form.set('pages', String(doc.numPages));
      form.set(
        'title',
        title && title.trim() && title !== 'untitled'
          ? title
          : file.name.replace(/\.pdf$/i, ''),
      );
      setBusy('Uploading paper…');
      const response = await fetch('/api/papers', {
        method: 'POST',
        body: form,
      });
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { error?: string }).error ||
            'Upload failed.',
        );
      const paper = (await response.json()) as Paper;
      await refresh();
      window.location.assign(`/papers/${paper.id}`);
    } catch (e) {
      setError(
        navigator.onLine
          ? `Could not upload: ${e instanceof Error ? e.message : String(e)}`
          : 'Reconnect to upload a PDF.',
      );
    } finally {
      await doc?.loadingTask.destroy();
      setBusy('');
    }
  }
  return (
    <main className="library-shell">
      <header className="site-header">
        <a className="brand" href="/">
          <BookOpen size={23} />
          Paperthread
        </a>
        <div className="header-actions">
          <Pwa />
          <SyncStatus />
        </div>
      </header>
      <div className="library-content">
        <div className="eyebrow">YOUR READING SPACE</div>
        <div className="title-row">
          <div>
            <h1>
              Library<span className="title-count">{data.papers.length}</span>
            </h1>
            <p className="muted">Papers, and the ideas you take from them.</p>
          </div>
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={() => exportLibrary(data)}
            >
              <Download size={16} />
              Export
            </button>
            <label className={`primary-button ${busy ? 'disabled' : ''}`}>
              <Upload size={17} />
              {busy || 'Upload PDF'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={!!busy}
                hidden
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList variant="line" className="collection-tabs">
            <TabsTrigger value="papers">
              <BookOpen />
              Papers
            </TabsTrigger>
            <TabsTrigger value="all">All annotations</TabsTrigger>
            {data.types.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.id === 'phrase' ? (
                  <Quote />
                ) : t.id === 'question' ? (
                  <CircleHelp />
                ) : (
                  <span className="type-dot" style={{ background: t.color }} />
                )}{' '}
                {t.name}
                <span className="tab-count">
                  {
                    data.annotations.filter((a) => a.types.includes(t.id))
                      .length
                  }
                </span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="readings">
              <Bookmark />
              Read later
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="filter-row">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search library"
              placeholder={
                tab === 'papers'
                  ? 'Search papers or tags…'
                  : 'Search collected thoughts…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <AddType />
          {tab === 'papers' && allTags.length > 0 && (
            <NativeSelect
              aria-label="Filter by paper tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <NativeSelectOption value="">All tags</NativeSelectOption>
              {allTags.map((t) => (
                <NativeSelectOption key={t}>{t}</NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!loaded ? (
          <p className="loading-state">Opening your library…</p>
        ) : tab === 'papers' ? (
          papers.length ? (
            <div className="paper-grid">
              {papers.map((p) => (
                <article className="paper-card" key={p.id}>
                  <a href={`/papers/${p.id}`} className="paper-card-main">
                    <div className="paper-card-top">
                      <FileText size={26} />
                      <span>PDF · {p.pages} pages</span>
                      <ArrowUpRight size={17} />
                    </div>
                    <h2>{p.title}</h2>
                    <p className="muted">
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      · {(p.bytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </a>
                  <div className="paper-card-bottom">
                    <div className="tag-list">
                      {p.tags.map((t) => (
                        <button
                          className="tag"
                          key={t}
                          onClick={() => setTag(t)}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Edit tags for ${p.title}`}
                      onClick={() => setPaperEdit(p)}
                    >
                      <Tags size={17} />
                    </button>
                  </div>
                  <div className="paper-annotation-count">
                    {data.annotations.filter((a) => a.paperId === p.id).length}{' '}
                    annotations
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              className="empty-library"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) void upload(e.dataTransfer.files[0]);
              }}
            >
              <EmptyHeader>
                <EmptyMedia>
                  <BookOpen size={38} />
                </EmptyMedia>
                <EmptyTitle className="empty-title">
                  {query || tag
                    ? 'No matching papers.'
                    : 'Your next paper starts here.'}
                </EmptyTitle>
                <EmptyDescription>
                  {query || tag
                    ? 'Try another title or tag.'
                    : 'Drop a PDF here or upload one above. Read, annotate, and follow references without losing your place.'}
                </EmptyDescription>
              </EmptyHeader>
              <span className="muted">
                Every paper gets a permanent link <ArrowUpRight size={14} />
              </span>
            </Empty>
          )
        ) : tab === 'readings' ? (
          groups.size ? (
            <div className="collection-grid">
              {[...groups.entries()].map(([key, entries]) => {
                const r = entries[0];
                return (
                  <article className="thought-card" key={key}>
                    <div className="eyebrow">
                      READ LATER {r.article.year && `· ${r.article.year}`}
                    </div>
                    <h2>{r.article.title}</h2>
                    <p className="muted">{r.article.authors}</p>
                    {safeUrl(r.article.url) && (
                      <a
                        className="text-button"
                        href={safeUrl(r.article.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Article details
                        <ArrowUpRight size={15} />
                      </a>
                    )}
                    <div className="source-list">
                      {entries.map((source) => (
                        <a
                          key={source.id}
                          href={sourceHref(source, false)}
                          onClick={() => rememberSource(source, false)}
                        >
                          <BookOpen size={14} />
                          {paperMap.get(source.paperId)?.title} · p.{' '}
                          {source.page}
                        </a>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          for (const item of entries)
                            await save('readings', item, true);
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      Remove from Read later
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty className="empty-library">
              <EmptyHeader>
                <EmptyMedia>
                  <Bookmark size={32} />
                </EmptyMedia>
                <EmptyTitle>No papers saved for later.</EmptyTitle>
                <EmptyDescription>
                  Tap a citation while reading and turn on Read later in its
                  preview.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : annotations.length ? (
          <div className="collection-grid">
            {annotations.map((a) => (
              <article className="thought-card" key={a.id}>
                <div className="thought-label">
                  <span style={{ background: a.color }} className="type-dot" />
                  {a.kind}
                  {a.resolved && <span className="tag">Resolved</span>}
                  <button className="text-button" onClick={() => setEdit(a)}>
                    Edit
                  </button>
                </div>
                {a.quote && <blockquote>{a.quote}</blockquote>}
                {a.note && <p className="thought-note">{a.note}</p>}
                {!a.note && !a.quote && (
                  <p className="muted">Handwritten annotation</p>
                )}
                <div className="tag-list">
                  {a.types.map((id) => (
                    <span className="tag" key={id}>
                      {data.types.find((t) => t.id === id)?.name}
                    </span>
                  ))}
                </div>
                <a
                  className="source-link"
                  href={sourceHref(a)}
                  onClick={() => rememberSource(a)}
                >
                  <BookOpen size={15} />
                  <span>
                    {paperMap.get(a.paperId)?.title} · p. {a.page}
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              </article>
            ))}
          </div>
        ) : (
          <Empty className="empty-library">
            <EmptyHeader>
              <EmptyMedia>
                <Plus size={32} />
              </EmptyMedia>
              <EmptyTitle>No thoughts collected here yet.</EmptyTitle>
              <EmptyDescription>
                Select text or add a page note while reading, then choose a
                collection type.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <footer className="library-footer">
          <span>Paperthread · A place for connected reading</span>
          <span>On iPad: Share → Add to Home Screen</span>
        </footer>
      </div>
      {edit && (
        <AnnotationEditor
          key={edit.id}
          annotation={edit}
          onClose={() => setEdit(undefined)}
        />
      )}{' '}
      {paperEdit && (
        <PaperDetails
          paper={paperEdit}
          onClose={() => setPaperEdit(undefined)}
        />
      )}
    </main>
  );
}
