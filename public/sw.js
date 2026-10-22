// Cache version — bump this string to invalidate ALL old caches on next deploy
const CACHE_VER  = '75hard-v59';
const ASSET_CACHE = `${CACHE_VER}-assets`;  // hashed JS/CSS — cache-first (immutable)
const HTML_CACHE  = `${CACHE_VER}-html`;    // index.html — network-first (always fresh)
const STATIC_CACHE = `${CACHE_VER}-static`; // icons, manifest — stale-while-revalidate

const ALL_CACHES = [ASSET_CACHE, HTML_CACHE, STATIC_CACHE];

// Not a versioned cache: this one holds the install id / active profile the app
// mirrors in for the push handler to read. It must SURVIVE activation, or every
// deploy would wipe the only thing that lets a received push be reported back,
// and delivery confirmation would silently stop working.
const IDENTITY_CACHE = 'forge-identity';
const PRESERVED_CACHES = [IDENTITY_CACHE];

// ── Install: precache the static shell. We intentionally do NOT call
//    skipWaiting() here. On a device that already has an active SW, this new
//    worker stays in the "waiting" state until the app explicitly asks it to
//    activate (via the SKIP_WAITING message from the update banner / Check for
//    Updates). Keeping the worker in "waiting" is what makes update detection
//    reliable — registration.waiting is a real, observable signal instead of
//    being skipped past instantly. (The very first SW on a page has no active
//    worker to wait behind, so it still activates immediately for new users.)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(c =>
      c.addAll(['/manifest.json', '/icon.svg', '/icon-apple.svg'])
    )
  );
});

// ── Activate: delete every cache that doesn't belong to this version, then
//    claim all clients so this worker controls the open pages immediately.
//    The page reloads itself on 'controllerchange' (see swUtils) only when the
//    user initiated the update, so claiming here never causes a surprise reload
//    on first install.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k) && !PRESERVED_CACHES.includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy depends on request type
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  // API responses are never cached. /api/push/status is a GET, and under the
  // stale-while-revalidate fallback below it was being answered from cache —
  // so the diagnostics panel could report a scheduler run, a queued test or a
  // delivery confirmation from minutes ago as if it were current. Diagnostics
  // that can lie are worse than none.
  if (url.pathname.startsWith('/api/')) return;

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

// ── Message: the ONLY place skipWaiting() is called. The app sends
//    SKIP_WAITING from the intended update path (update banner tap /
//    "Apply Update" in Settings) to activate the waiting worker on demand.
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

// ── Push: display server-sent notifications ──────────────────────────────────
// Payload: { title, body, tag, renotify, view, confirm: { label, tag } }
//
// iOS requires a visible notification for every push delivered to an installed
// PWA, so showNotification is always called — a push that shows nothing can get
// the subscription revoked.
//
// When the payload carries `confirm`, the handler also reports back to
// /api/push/delivered. That report is the ONLY real evidence the push reached
// the device: the push service returning 201 means accepted, not delivered.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '⚔️ Forge';

  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(title, {
        body: data.body || '',
        // A test push carries a unique tag so it cannot be collapsed into an
        // older notification and silently appear to have never arrived.
        tag: data.tag || 'forge-push',
        renotify: data.renotify === true,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { view: data.view || 'today' },
      });
    } catch {
      // Still try to confirm receipt — the push DID arrive even if the display
      // failed, and that distinction matters when diagnosing.
    }

    if (data.confirm) {
      try {
        const ids = await readInstallIdentity();
        if (ids) {
          await fetch('/api/push/delivered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              installId: ids.installId,
              profileId: ids.profileId,
              label: data.confirm.label || null,
              tag: data.confirm.tag || data.tag || null,
            }),
          });
        }
      } catch {
        // Confirmation is best-effort: never let it break the notification.
      }
    }
  })());
});

// The SW has no access to localStorage, so the app mirrors the install id and
// active profile into a Cache entry it can read. Written by the app on every
// subscribe/sync (see notificationUtils.publishInstallIdentity).
async function readInstallIdentity() {
  try {
    const cache = await caches.open(IDENTITY_CACHE);
    const res = await cache.match('/__forge_identity');
    if (!res) return null;
    const json = await res.json();
    return json?.installId && json?.profileId ? json : null;
  } catch {
    return null;
  }
}

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
