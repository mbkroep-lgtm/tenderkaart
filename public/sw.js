// Service worker: maakt de kaart installeerbaar als app.
// Altijd eerst het netwerk (zodat je de nieuwste tenders ziet); zonder verbinding de laatst bekende versie.
const CACHE = 'tenderkaart-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/admin')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (url.pathname === '/' || /\.(html|js|css|svg|png|webmanifest)$/.test(url.pathname) || url.pathname === '/api/tenders')) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('/')))
  );
});
