const CACHE_NAME = 'gnl1z-v1';

// Core structural assets to precache for offline support
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event: Precaches core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Cleans up any stale legacy caches left by previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing legacy cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Store validation engines STRICTLY require this.
// Uses a Network-First strategy for core logic, falling back to cache if offline.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests (skip mutations, Supabase API calls, etc.)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-First strategy with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone it and save/update it in our cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails (Offline mode), try pulling from local cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a major application route fails offline, return the main index.html shell
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
