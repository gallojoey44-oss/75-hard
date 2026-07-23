// Cache version — bump this string to invalidate ALL old caches on next deploy
const CACHE_VER  = '75hard-v20';
const ASSET_CACHE = `${CACHE_VER}-assets`;  // hashed JS/CSS — cache-first (immutable)
const HTML_CACHE  = `${CACHE_VER}-html`;    // index.html — network-first (always fresh)
const STATIC_CACHE = `${CACHE_VER}-static`; // icons, manifest — stale-while-revalidate

const ALL_CACHES = [ASSET_CACHE, HTML_CACHE, STATIC_CACHE];

// ── Install: skipWaiting immediately so this SW takes over from any old version
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(c =>
      c.addAll(['/manifest.json', '/icon.svg', '/icon-apple.svg'])
    )
  );
  self.skipWaiting();
});

// ── Activate: delete every cache that doesn't belong to this version,
//    claim all clients, then notify them to reload so they get fresh HTML/assets
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      })
  );
});

// ── Fetch: strategy depends on request type
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  // Hashed Vite assets (e.g. /assets/index-abc123.js) — immutable, cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request, ASSET_CACHE));
    return;
  }

  // index.html and navigation requests — network-first so updates are instant
  const isNavigation = event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isNavigation) {
    event.respondWith(networkFirst(event.request, HTML_CACHE));
    return;
  }

  // Everything else (manifest, icons, sw.js itself) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
});

// ── Message: app can send SKIP_WAITING to activate the waiting SW
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ────────────────────────────────────────────────────────────────
// Strategy helpers
// ────────────────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline — open the app when connected.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response?.ok) {
      caches.open(cacheName).then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response('', { status: 503 });
}

// ────────────────────────────────────────────────────────────────
// Notifications & Web Push
// ────────────────────────────────────────────────────────────────

// ── Push: display server-sent notifications (payload: {title, body, tag, view})
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '⚔️ Forge';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'forge-push',       // same tag replaces instead of stacking
      renotify: false,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { view: data.view || 'today' },
    })
  );
});

// ── Notification click: focus the app (or open it) and navigate to the right page
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const view = event.notification.data?.view || 'today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          client.postMessage({ type: 'FORGE_NAVIGATE', view });
          return client.focus();
        }
      }
      return self.clients.openWindow(`/?view=${encodeURIComponent(view)}`);
    })
  );
});
