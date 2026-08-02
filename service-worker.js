/* ============================================
   service-worker.js — offline app shell caching
   + Firebase Cloud Messaging background handler
   (kept in this SAME file, not a separate
   firebase-messaging-sw.js, so there's only one
   service worker controlling this site's scope).
   Bump CACHE_NAME whenever files change to force
   devices to pick up the new version.
   ============================================ */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');
importScripts('./assets/js/firebase-config.js');

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || 'Get Gorgeous';
    const options = {
      body: (payload.notification && payload.notification.body) || '',
      icon: './assets/icons/icon-192.png',
    };
    self.registration.showNotification(title, options);
  });
} catch (e) { /* Firebase not configured yet — push just won't work until it is */ }

const CACHE_NAME = 'get-gorgeous-v16';

const APP_SHELL = [
  './index.html',
  './install.html',
  './home.html',
  './dashboard.html',
  './customers.html',
  './customer-profile.html',
  './billing.html',
  './inventory.html',
  './appointments.html',
  './expenses.html',
  './staff.html',
  './marketing.html',
  './whatsapp-queue.html',
  './reports.html',
  './settings.html',
  './manifest.json',
  './assets/css/base.css',
  './assets/css/home.css',
  './assets/css/dashboard.css',
  './assets/css/customers.css',
  './assets/css/customer-profile.css',
  './assets/css/billing.css',
  './assets/css/inventory.css',
  './assets/css/appointments.css',
  './assets/css/expenses.css',
  './assets/css/staff.css',
  './assets/css/marketing.css',
  './assets/css/whatsapp-queue.css',
  './assets/css/reports.css',
  './assets/css/settings.css',
  './assets/js/db.js',
  './assets/js/device-id.js',
  './assets/js/device-guard.js',
  './assets/js/app-config.js',
  './assets/js/shell.js',
  './assets/js/pin-guard.js',
  './assets/js/sync.js',
  './assets/js/reminders.js',
  './assets/js/firebase-config.js',
  './assets/js/push-notify.js',
  './assets/js/settings.js',
  './assets/js/customers.js',
  './assets/js/customer-profile.js',
  './assets/js/billing.js',
  './assets/js/inventory.js',
  './assets/js/appointments.js',
  './assets/js/expenses.js',
  './assets/js/staff.js',
  './assets/js/marketing.js',
  './assets/js/queue.js',
  './assets/js/reports.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
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
        .catch(() => caches.match('./home.html'));
    })
  );
});
