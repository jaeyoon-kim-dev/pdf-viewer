export type FitMode = 'width' | 'page' | 'custom';
export function fittedWidth(
  width: number,
  height: number,
  aspect: number,
  two: boolean,
  verticalInset = 78,
) {
  const availableWidth = Math.max(
    40,
    (width - 48 - (two ? 16 : 0)) / (two ? 2 : 1),
  );
  return {
    width: availableWidth,
    page: Math.max(40, height - verticalInset) / aspect,
  };
}
export function clampZoom(value: number) {
  return Math.max(25, Math.min(400, value));
}
export function zoomShortcut(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  key: string;
}) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  if (['+', '='].includes(e.key)) return 'in';
  if (['-', '_'].includes(e.key)) return 'out';
  if (e.key === '0') return 'reset';
  return null;
}

export function wheelZoomFactor(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
) {
  const pixels =
    deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1);
  return Math.exp(-Math.max(-300, Math.min(300, pixels)) * 0.002);
}
