'use client';
import { useEffect, useState, type RefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextLayerBuilder } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import { pdfLibrary } from '@/lib/pdf';
import { textGeometry, type TextGeometry } from '@/lib/text-layer';

export default function useTextLayer(
  doc: PDFDocumentProxy,
  number: number,
  width: number,
  painted: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const [rendered, setRendered] = useState<{
    doc: PDFDocumentProxy;
    number: number;
    width: number;
    geometry: TextGeometry;
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    const container = containerRef.current;
    setRendered(undefined);
    if (!painted || !container) return;
    let cancelled = false;
    let layer: TextLayerBuilder | undefined;
    setError('');
    void (async () => {
      const [page] = await Promise.all([doc.getPage(number), pdfLibrary()]);
      const { TextLayerBuilder } =
        await import('pdfjs-dist/legacy/web/pdf_viewer.mjs');
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      container.replaceChildren();
      container.style.setProperty('--scale-factor', String(viewport.scale));
      container.style.setProperty(
        '--total-scale-factor',
        String(viewport.scale),
      );
      layer = new TextLayerBuilder({ pdfPage: page });
      container.appendChild(layer.div);
      // The upstream type marks image placeholders as required, but the
      // text-only rendering path accepts their omission.
      await layer.render({ viewport } as Parameters<
        TextLayerBuilder['render']
      >[0]);
      if (!cancelled)
        setRendered({
          doc,
          number,
          width,
          geometry: textGeometry(
            container,
            Array.from(layer.div.querySelectorAll('span')),
            number,
            base.width,
            base.height,
          ),
        });
    })().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
      layer?.cancel();
      container.replaceChildren();
    };
  }, [doc, number, width, painted, containerRef]);
  const geometry =
    painted &&
    rendered?.doc === doc &&
    rendered.number === number &&
    rendered.width === width
      ? rendered.geometry
      : undefined;
  return { geometry, error };
}
