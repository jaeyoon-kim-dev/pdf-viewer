const VERSION = 'paperthread-shell-v1';
const PAPERS = 'paperthread-pdfs-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']))); });
self.addEventListener('activate', event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('paperthread-shell-') && k !== VERSION).map(k => caches.delete(k)))), self.clients.claim()])); });
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/api\/papers\/[^/]+\/file$/.test(url.pathname)) {
    event.respondWith(caches.open(PAPERS).then(async cache => (await cache.match(url.pathname)) || fetch(req))); return;
  }
  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc') || req.headers.has('rsc')) return;
  const navigation = req.mode === 'navigate';
  if (!navigation && !/\.(js|mjs|css|woff2?|svg|png|bcmap|ttf|wasm)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION); const key = navigation ? url.pathname : req;
    try { const response = await fetch(req); if (response.ok && !response.redirected) await cache.put(key, response.clone()); return response; }
    catch { const cached = await cache.match(key); if (cached) return cached; return new Response(navigation ? 'This page is not available offline yet. Reconnect and open the paper once before downloading it for offline use.' : 'Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  })());
});
