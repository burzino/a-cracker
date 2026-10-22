// Offline copy of the app shell and data. Every GET is network-first: freshness comes from the network,
// and the cache is only read when a request fails. CACHE_NAME only decides which offline copy is kept.

// The app bundle (assets/*.js, assets/*.css) has hashed names that change on every build, so it is not
// listed here: it is cached at runtime the first time it is fetched successfully.
const CACHE_NAME = 'price-tracker-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(event));
});

// Only successful responses are cached, so an error page never replaces the last good snapshot.
async function networkFirst(event) {
  const { request } = event;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
    }
    return response;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}
