import type { Annotation, Rect } from '@/lib/model';

export default function HighlightLayer({
  annotations,
  selection = [],
  thumbnail = false,
}: {
  annotations: Annotation[];
  selection?: Rect[];
  thumbnail?: boolean;
}) {
  return (
    <svg
      className={`highlight-layer ${thumbnail ? 'thumbnail-highlights' : ''}`}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {annotations
        .filter((a) => a.kind === 'highlight' || (a.kind === 'note' && a.quote))
        .map((a) =>
          a.rects.map((r, i) => (
            <rect
              key={`${a.id}-${i}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={a.color}
              fillOpacity={0.35}
            />
          )),
        )}
      {selection.map((r, i) => (
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
    </svg>
  );
}
