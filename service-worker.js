/* ============================================
   service-worker.js — offline app shell caching
   Bump CACHE_NAME whenever files change to force
   the tablet to pick up the new version.
   ============================================ */

const CACHE_NAME = 'get-gorgeous-v4';

const APP_SHELL = [
  './index.html',
  './dashboard.html',
  './customers.html',
  './customer-profile.html',
  './billing.html',
  './inventory.html',
  './appointments.html',
  './expenses.html',
  './staff.html',
  './marketing.html',
  './reports.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/db.js',
  './assets/js/shell.js',
  './assets/js/customers.js',
  './assets/js/customer-profile.js',
  './assets/js/billing.js',
  './assets/js/inventory.js',
  './assets/js/appointments.js',
  './assets/js/expenses.js',
  './assets/js/staff.js',
  './assets/js/marketing.js',
  './assets/js/reports.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell files; network-first fallback for everything else (e.g. Google Fonts, future API calls)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./dashboard.html'));
    })
  );
});
