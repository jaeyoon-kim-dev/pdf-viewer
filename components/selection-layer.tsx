'use client';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import type { Annotation, Rect } from '@/lib/model';
import { selectWords, type Word } from '@/lib/pdf';
import { frameQueue } from '@/lib/frame-queue';
import HighlightLayer from './highlight-layer';

export type SelectionLayerHandle = {
  select: (
    words: Word[],
    start: number,
    end: number,
    immediate?: boolean,
  ) => void;
  clear: () => void;
};
const noAnnotations: Annotation[] = [];
type Range = { words: Word[]; start: number; end: number };

export default function SelectionLayer({
  ref,
  draft,
  nativeContainer,
}: {
  ref: Ref<SelectionLayerHandle>;
  draft?: Rect[];
  nativeContainer?: RefObject<HTMLDivElement | null>;
}) {
  const [nativeActive, setNativeActive] = useState(false);
  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      setNativeActive(
        !!selection &&
          !selection.isCollapsed &&
          !!nativeContainer?.current?.contains(selection.anchorNode) &&
          !!nativeContainer.current.contains(selection.focusNode),
      );
    };
    document.addEventListener('selectionchange', update);
    update();
    return () => document.removeEventListener('selectionchange', update);
  }, [nativeContainer]);
  const previousDraft = useRef(draft);
  useEffect(() => {
    if (previousDraft.current && !draft) {
      const selection = window.getSelection();
      if (selection && nativeContainer?.current?.contains(selection.anchorNode))
        selection.removeAllRanges();
    }
    previousDraft.current = draft;
  }, [draft, nativeContainer]);
  const [rects, setRects] = useState<Rect[]>();
  const last = useRef<Range | undefined>(undefined);
  const [queue] = useState(() =>
    frameQueue<Range>((range) =>
      setRects(selectWords(range.words, range.start, range.end).rects),
    ),
  );
  useEffect(() => () => queue.clear(), [queue]);
  useImperativeHandle(
    ref,
    () => ({
      select(words, start, end, immediate = false) {
        if (
          last.current?.words === words &&
          last.current.start === start &&
          last.current.end === end
        )
          return;
        const range = { words, start, end };
        last.current = range;
        if (immediate) {
          queue.clear();
          setRects(selectWords(words, start, end).rects);
        } else queue.push(range);
      },
      clear() {
        queue.clear();
        last.current = undefined;
        setRects(undefined);
      },
    }),
    [queue],
  );
  return (
    <div style={{ visibility: nativeActive ? 'hidden' : undefined }}>
      <HighlightLayer annotations={noAnnotations} selection={rects ?? draft} />
    </div>
  );
}
