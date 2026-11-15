/* Köd Koronája – offline gyorsítótár. A fájllistát a build tölti ki. */
const VERSION = '__VERSION__';
const CACHE = `kod-koronaja-${VERSION}`;
const PRECACHE = "__PRECACHE__";

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(Array.isArray(PRECACHE) ? PRECACHE : ['./']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('kod-koronaja-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const store = res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return res;
  };
  // Az oldal betöltésekor előbb a hálózatról kérjük a friss változatot; a gyorsítótár csak
  // akkor lép be, ha nincs kapcsolat. Így egy új kiadás azonnal megjelenik.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(store)
        .catch(() => caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(hit => hit || caches.match('./index.html', { ignoreVary: true }))),
    );
    return;
  }
  // A többi fájl neve a tartalmától függ (hash), ezért ezek biztonsággal jöhetnek a gyorsítótárból.
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(hit => hit || fetch(req).then(store).catch(() => Response.error())),
  );
});
