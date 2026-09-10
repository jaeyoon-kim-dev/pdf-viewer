export type ReadingPosition = {
  page: number;
  x: number;
  y: number;
  updatedAt: number;
};
export function validPosition(value: unknown): value is ReadingPosition {
  if (!value || typeof value !== 'object') return false;
  const p = value as ReadingPosition;
  return (
    Number.isInteger(p.page) &&
    p.page > 0 &&
    Number.isFinite(p.updatedAt) &&
    p.updatedAt > 0 &&
    [p.x, p.y].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1,
    )
  );
}
export function rememberSource(
  item: { paperId: string; page: number; id?: string },
  annotation = true,
) {
  try {
    sessionStorage.setItem(
      `paperthread-source-${item.paperId}`,
      JSON.stringify({
        page: item.page,
        annotation: annotation ? item.id : undefined,
      }),
    );
  } catch {}
}
