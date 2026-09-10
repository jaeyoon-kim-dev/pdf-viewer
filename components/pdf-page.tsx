'use client';
import {
  elementAnchor,
  rectAnchor,
  type ReaderAnchor,
} from '@/lib/popover-anchor';
import { StickyNote } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Annotation, Point } from '@/lib/model';
import {
  pageText,
  renderCanvas,
  hitWord,
  selectWords,
  type PageText,
} from '@/lib/pdf';
import {
  referenceHotspots,
  resolveReferenceLink,
  type Reference,
  type Hotspot,
} from '@/lib/references';
type Props = {
  doc: PDFDocumentProxy;
  number: number;
  width: number;
  fitHeight?: number;
  defaultAspect: number;
  annotations: Annotation[];
  references: Reference[];
  pen: boolean;
  placingMemo?: boolean;
  selected?: string;
  layout: string;
  draft?: Annotation;
  onSelect: (
    value: Partial<Annotation> & { page: number },
    anchor?: ReaderAnchor,
  ) => void;
  onEdit: (a: Annotation, anchor?: ReaderAnchor) => void;
  onPreview: (r: Reference[], anchor?: ReaderAnchor) => void;
  onPage: (delta: number) => void;
  onZoom: (ratio: number) => void;
};
type Gesture = {
  id: number;
  start: Point;
  last: Point;
  startClient: { x: number; y: number };
  lastClient: { x: number; y: number };
  word: number;
  end: number;
  kind: 'pending' | 'select' | 'scroll' | 'ink';
  points: Point[];
  moved: boolean;
  annotation?: Annotation;
};
export default function PdfPage(props: Props) {
  const { doc, number, annotations, references, pen, layout } = props;
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [text, setText] = useState<PageText>();
  const width = props.fitHeight
    ? props.fitHeight / (text ? text.height / text.width : props.defaultAspect)
    : props.width;
  const [error, setError] = useState('');
  const [painted, setPainted] = useState(false);
  const [nativeSpots, setNativeSpots] = useState<Hotspot[]>([]);
  const [selection, setSelection] = useState<ReturnType<typeof selectWords>>();
  const [ink, setInk] = useState<Point[]>([]);
  const gesture = useRef<Gesture | undefined>(undefined);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const selectedId = props.selected;
  const hasSelected = annotations.some((a) => a.id === selectedId);
  useEffect(() => {
    if (painted && selectedId && hasSelected)
      document
        .getElementById(`annotation-${selectedId}`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [painted, selectedId, hasSelected]);
  const height = text
    ? (width * text.height) / text.width
    : width * props.defaultAspect;
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setActive(entry.isIntersecting);
        }
      },
      { rootMargin: '350px', threshold: [0, 0.25] },
    );
    if (wrapper.current) io.observe(wrapper.current);
    return () => io.disconnect();
  }, [number]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void pageText(doc, number)
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [doc, number, active]);
  useEffect(() => {
    if (!active || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setPainted(false);
    void doc
      .getPage(number)
      .then(async (page) => {
        if (cancelled || !canvas.current) return;
        task = await renderCanvas(page, canvas.current, width);
        if (cancelled) {
          task.cancel();
          return;
        }
        await task.promise;
        if (!cancelled) setPainted(true);
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'RenderingCancelledException')
          setError(String(e));
      });
    const targetCanvas = canvas.current;
    return () => {
      cancelled = true;
      task?.cancel();
      if (targetCanvas) {
        targetCanvas.width = 0;
        targetCanvas.height = 0;
      }
    };
  }, [doc, number, width, active]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const links = await page.getAnnotations();
      const sourceText = await pageText(doc, number);
      const spots: Hotspot[] = [];
      for (const link of links) {
        if (!link.dest && !link.url) continue;
        const [x1, y1, x2, y2] = [
          ...viewport.convertToViewportPoint(link.rect[0], link.rect[1]),
          ...viewport.convertToViewportPoint(link.rect[2], link.rect[3]),
        ];
        const bounds = {
          x: Math.min(x1, x2) / viewport.width,
          y: Math.min(y1, y2) / viewport.height,
          w: Math.abs(x2 - x1) / viewport.width,
          h: Math.abs(y2 - y1) / viewport.height,
        };
        const label = sourceText.words
          .filter(
            (word) =>
              word.x + word.w > bounds.x &&
              word.x < bounds.x + bounds.w &&
              word.y + word.h > bounds.y &&
              word.y < bounds.y + bounds.h,
          )
          .map((word) => word.text)
          .join(' ');
        let reference: Reference | undefined;
        if (link.dest) {
          try {
            const dest =
              typeof link.dest === 'string'
                ? await doc.getDestination(link.dest)
                : link.dest;
            if (!dest) continue;
            const target =
              (typeof dest[0] === 'number'
                ? dest[0]
                : await doc.getPageIndex(dest[0])) + 1;
            const targetPage = await doc.getPage(target);
            const vp = targetPage.getViewport({ scale: 1 });
            const mode = dest[1]?.name;
            const top =
              mode === 'XYZ'
                ? dest[3]
                : mode === 'FitH' || mode === 'FitBH'
                  ? dest[2]
                  : mode === 'FitR'
                    ? dest[5]
                    : undefined;
            const y =
              typeof top === 'number'
                ? Math.max(
                    0,
                    Math.min(
                      1,
                      vp.convertToViewportPoint(0, top)[1] / vp.height,
                    ),
                  )
                : undefined;
            reference = resolveReferenceLink(
              references,
              target,
              y,
              label,
              typeof link.dest === 'string' ? link.dest : '',
              bounds,
              sourceText.lines
                .filter(
                  (line) =>
                    line.y + line.h > bounds.y &&
                    line.y < bounds.y + bounds.h &&
                    line.x + line.w > bounds.x &&
                    line.x < bounds.x + bounds.w,
                )
                .map((line) => line.text)
                .join(' '),
            );
          } catch {
            continue;
          }
        } else if (
          /^https?:\/\/(?:dx\.)?doi\.org\/|^https?:\/\/(?:export\.)?arxiv\.org\//i.test(
            link.url,
          )
        )
          reference = {
            id: link.url,
            label: 'Cited article',
            text: link.url,
            page: number,
            y: 0,
            kind: 'citation',
          };
        if (!reference) continue;
        spots.push({
          ...bounds,
          references: [reference],
        });
      }
      if (!cancelled) setNativeSpots(spots);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, number, references, active]);
  const spots = useMemo(
    () => [
      ...nativeSpots,
      ...(text
        ? referenceHotspots(text, references).filter(
            (s) =>
              !nativeSpots.some(
                (n) => Math.abs(n.x - s.x) < 0.02 && Math.abs(n.y - s.y) < 0.01,
              ),
          )
        : []),
    ],
    [nativeSpots, text, references],
  );
  const point = (e: React.PointerEvent): Point => {
    const r = wrapper.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      pressure: e.pressure || 0.5,
    };
  };
  const scroll = () =>
    wrapper.current?.closest('.reader-scroll') as HTMLElement | null;
  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    if (gesture.current?.kind === 'ink' && e.pointerType === 'touch') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size > 1) {
      gesture.current = undefined;
      setSelection(undefined);
      setInk([]);
      const ps = [...pointers.current.values()];
      pinch.current = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      return;
    }
    const p = point(e);
    const word = text ? hitWord(text.words, p.x, p.y) : -1;
    const annotation = annotations.find((a) =>
      a.rects.some(
        (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
      ),
    );
    gesture.current = {
      id: e.pointerId,
      start: p,
      last: p,
      startClient: { x: e.clientX, y: e.clientY },
      lastClient: { x: e.clientX, y: e.clientY },
      word,
      end: word,
      kind:
        pen && !props.placingMemo && e.pointerType !== 'touch'
          ? 'ink'
          : 'pending',
      points: [p],
      moved: false,
      annotation,
    };
    setSelection(undefined);
    setInk([]);
    e.preventDefault();
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size > 1) {
      const ps = [...pointers.current.values()];
      const dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (pinch.current) props.onZoom(dist / pinch.current);
      pinch.current = dist;
      return;
    }
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const p = point(e);
    const dx = e.clientX - g.startClient.x,
      dy = e.clientY - g.startClient.y;
    if (Math.hypot(dx, dy) > 5) g.moved = true;
    if (g.kind === 'pending' && g.moved)
      g.kind =
        !props.placingMemo &&
        g.word >= 0 &&
        (e.pointerType === 'mouse' || Math.abs(dx) >= Math.abs(dy) * 0.65)
          ? 'select'
          : 'scroll';
    if (g.kind === 'select' && text) {
      g.end = hitWord(text.words, p.x, p.y, true);
      setSelection(selectWords(text.words, g.word, g.end));
    }
    if (g.kind === 'ink') {
      if (g.points.length < 9000) {
        const events = e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent];
        const box = wrapper.current!.getBoundingClientRect();
        for (const ev of events)
          g.points.push({
            x: Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width)),
            y: Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height)),
            pressure: ev.pressure || 0.5,
          });
      }
      setInk([...g.points]);
    }
    if (g.kind === 'scroll') {
      const el = scroll();
      if (el) {
        el.scrollTop -= e.clientY - g.lastClient.y;
        if (layout === 'horizontal')
          el.scrollLeft -= e.clientX - g.lastClient.x;
      }
    }
    g.last = p;
    g.lastClient = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g && g.id !== e.pointerId) return;
    if (g && g.id === e.pointerId) {
      if (props.placingMemo && !g.moved) {
        const p = point(e);
        const rect = {
          x: Math.min(0.98, p.x),
          y: Math.min(0.98, p.y),
          w: 0.02,
          h: 0.02,
        };
        props.onSelect(
          { page: number, kind: 'note', rects: [rect] },
          wrapper.current ? rectAnchor(wrapper.current, rect) : undefined,
        );
      } else if (g.kind === 'ink' && g.points.length > 1)
        props.onSelect({
          page: number,
          kind: 'ink',
          points: g.points,
          color: '#60a5fa',
        });
      else if (g.kind === 'select' && text) {
        const selection = selectWords(text.words, g.word, g.end);
        const rect = text.words[g.end] || selection.rects.at(-1);
        props.onSelect(
          { page: number, ...selection },
          rect && wrapper.current
            ? rectAnchor(wrapper.current, rect)
            : undefined,
        );
      } else if (!g.moved && g.annotation)
        props.onEdit(
          g.annotation,
          wrapper.current && g.annotation.rects[0]
            ? rectAnchor(wrapper.current, g.annotation.rects[0])
            : undefined,
        );
      else if (
        g.kind === 'scroll' &&
        ['single', 'two'].includes(layout) &&
        Math.abs(e.clientX - g.startClient.x) > 70 &&
        Math.abs(e.clientX - g.startClient.x) >
          Math.abs(e.clientY - g.startClient.y) * 1.5
      )
        props.onPage(e.clientX < g.startClient.x ? 1 : -1);
    }
    gesture.current = undefined;
    setSelection(undefined);
    setInk([]);
  }
  function cancel(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (gesture.current && gesture.current.id !== e.pointerId) return;
    gesture.current = undefined;
    setSelection(undefined);
    setInk([]);
  }
  return (
    <div className="pdf-page-shell" style={{ width }} id={`page-${number}`}>
      <div
        ref={wrapper}
        className={`pdf-page ${props.placingMemo ? 'placing-memo' : ''}`}
        style={{ width, height }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`PDF page ${number}`}
      >
        <canvas
          ref={canvas}
          className="pdf-canvas"
          style={{ opacity: painted && active ? 1 : 0 }}
          aria-label={`Rendered PDF page ${number}`}
        />
        {(!painted || !active) && (
          <div className="page-placeholder">{error || `Page ${number}`}</div>
        )}
        {active && text && text.words.length === 0 && (
          <div className="page-text-notice">
            No selectable text on this page. Use Memo, Question, or Handwriting
            above.
          </div>
        )}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="annotation-overlay"
          aria-hidden="true"
        >
          {annotations.map((a) => (
            <g
              key={a.id}
              id={`annotation-${a.id}`}
              className={props.selected === a.id ? 'focused-annotation' : ''}
            >
              {(a.kind === 'note' && !a.quote ? [] : a.rects).map((r, i) =>
                a.kind === 'underline' ? (
                  <line
                    key={i}
                    x1={r.x}
                    y1={r.y + r.h}
                    x2={r.x + r.w}
                    y2={r.y + r.h}
                    stroke={a.color}
                    strokeWidth={0.0025}
                  />
                ) : (
                  <rect
                    key={i}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={a.color}
                    fillOpacity={0.32}
                  />
                ),
              )}
              {a.points.length > 0 && (
                <polyline
                  points={a.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={0.0025}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          ))}
          {(
            selection?.rects ||
            (props.draft?.page === number ? props.draft.rects : [])
          )?.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="#60a5fa"
              fillOpacity={0.4}
            />
          ))}
          {ink.length > 0 && (
            <polyline
              points={ink.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={0.0025}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        {annotations
          .filter((a) => a.kind === 'note' && !a.quote && a.rects.length > 0)
          .map((a) => (
            <button
              key={a.id}
              className="sticky-memo-pin"
              aria-label={`Open sticky memo: ${a.note.slice(0, 80) || 'Note'}`}
              title={a.note.slice(0, 120) || 'Open sticky memo'}
              style={{
                left: `${a.rects[0].x * 100}%`,
                top: `${a.rects[0].y * 100}%`,
                background: a.color,
              }}
              onClick={(e) => props.onEdit(a, elementAnchor(e.currentTarget))}
            >
              <StickyNote size={17} />
            </button>
          ))}
        {spots.map((spot, i) => (
          <button
            key={i}
            className="reference-hotspot"
            aria-label={`Preview ${spot.references.map((r) => r.label).join(', ')}`}
            style={{
              left: `${spot.x * 100}%`,
              top: `${spot.y * 100}%`,
              width: `${spot.w * 100}%`,
              height: `${spot.h * 100}%`,
            }}
            onClick={(e) =>
              props.onPreview(spot.references, elementAnchor(e.currentTarget))
            }
          />
        ))}
        <div className="sr-only">
          {text?.lines.map((line, i) => (
            <p key={i}>{line.text}</p>
          ))}
        </div>
      </div>
      <div className="page-label">{number}</div>
    </div>
  );
}
