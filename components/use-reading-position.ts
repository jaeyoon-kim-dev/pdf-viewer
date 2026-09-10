'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { validPosition, type ReadingPosition } from '@/lib/reading-position';
export default function useReadingPosition(
  paperId: string,
  scroller: RefObject<HTMLDivElement | null>,
  currentPage: RefObject<number>,
  restored: RefObject<boolean>,
) {
  const [initial, setInitial] = useState<ReadingPosition | null>();
  const pending = useRef<ReadingPosition | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const key = `paperthread-position-${paperId}`;
  const endpoint = `/api/papers/${paperId}/position`;
  const flush = useCallback(async () => {
    const value = pending.current;
    if (!value) return;
    try {
      const result = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
        keepalive: true,
      });
      if (result.ok && pending.current?.updatedAt === value.updatedAt)
        pending.current = undefined;
    } catch {
      /* The local copy is retried on reconnect or reopening. */
    }
  }, [endpoint]);
  const capture = useCallback(() => {
    if (!restored.current || !scroller.current) return;
    const page = document
      .getElementById(`page-${currentPage.current}`)
      ?.querySelector('.pdf-page');
    if (!page) return;
    const rect = page.getBoundingClientRect(),
      viewport = scroller.current.getBoundingClientRect();
    const value = {
      page: currentPage.current,
      x: Math.max(0, Math.min(1, (viewport.left - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (viewport.top - rect.top) / rect.height)),
      updatedAt: Date.now(),
    };
    pending.current = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [restored, scroller, currentPage, key]);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      capture();
      void flush();
    }, 600);
  }, [capture, flush]);
  const handlers = useRef({ capture, flush, schedule });
  useEffect(() => {
    handlers.current = { capture, flush, schedule };
  });
  useEffect(() => {
    let cancelled = false;
    let cached: ReadingPosition | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (validPosition(value)) cached = value;
    } catch {}
    void fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const remote = await response.json();
        if (cancelled) return;
        const newest =
          validPosition(remote) &&
          (!cached || remote.updatedAt >= cached.updatedAt)
            ? remote
            : cached;
        setInitial(newest);
        if (newest === cached && cached) {
          pending.current = cached;
          void handlers.current.flush();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInitial(cached);
          if (cached) pending.current = cached;
        }
      });
    const save = () => {
      handlers.current.capture();
      void handlers.current.flush();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const online = () => {
      void handlers.current.flush();
    };
    window.addEventListener('pagehide', save);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      save();
      window.removeEventListener('pagehide', save);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [key, endpoint]);
  return { initial, schedule };
}
