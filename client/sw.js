const CACHE = 'bt-static-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/views.css',
  '/js/app.js',
  '/js/store.js',
  '/js/api.js',
  '/js/dom.js',
  '/js/derive.js',
  '/js/i18n.js',
  '/js/views/header.js',
  '/js/views/filters.js',
  '/js/views/transactions.js',
  '/js/views/batch-edit-modal.js',
  '/js/views/rules-panel.js',
  '/js/views/category-manager.js',
  '/js/views/dashboard.js',
  '/js/views/joint-split.js',
  '/js/views/savings.js',
  '/shared/dates.js',
  '/shared/categorize.js',
  '/shared/csv.js',
  '/vendor/chart.umd.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bt-static-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const CACHEABLE_API = [/^\/api\/bootstrap$/, /^\/api\/accounts\/[^/]+\/data$/];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.some(re => re.test(url.pathname))) {
      event.respondWith(networkFirst(event.request));
    }
    return;
  }

  event.respondWith(networkFirst(event.request, url.pathname === '/' || !url.pathname.includes('.') ? '/index.html' : null));
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}
