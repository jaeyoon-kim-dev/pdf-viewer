export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export function mutationGuard(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'Cross-origin changes are not allowed.' }, 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return json({ error: 'Cross-site changes are not allowed.' }, 403);
  return null;
}
export const validId = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
