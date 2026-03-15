// ============================================================
// TYG POS — Service Worker
// Provides offline resilience for staff pages.
// Uses a network-first strategy for API calls (never stale),
// and cache-first for static assets.
// ============================================================

const CACHE_VERSION = 'tyg-pos-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Pages to precache for offline access
const PRECACHE_PAGES = [
  '/login',
  '/kitchen',
  '/admin/dashboard',
  '/admin/orders',
];

// Static assets to cache (Next.js injects _next/ paths)
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.png', '.svg', '.ico'];

// ── Install: precache key pages ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Cache offline fallback page
      try {
        await cache.addAll(PRECACHE_PAGES);
      } catch {
        // Non-fatal — pages may require auth
      }
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('tyg-pos-') && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: smart caching strategy ────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // API routes: network-first, short timeout, no cache on failure
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, 4000));
    return;
  }

  // Static assets (_next/static): cache-first, long-lived
  if (url.pathname.startsWith('/_next/static/') ||
      STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // HTML pages: network-first with offline fallback
  event.respondWith(networkFirstWithFallback(event.request));
});

// ── Strategies ────────────────────────────────────────────────

async function networkFirst(request, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch {
    clearTimeout(timeout);
    // Return cached version if available
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to login page for navigation requests
    const loginCache = await caches.match('/login');
    return loginCache ?? new Response('Offline — please reconnect', { status: 503 });
  }
}
