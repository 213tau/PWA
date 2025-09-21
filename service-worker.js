const CACHE_NAME = "my-pwa-cache-v1";
const ASSETS = [
  "/",                     // serves index.html on Vercel
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: cache all
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activate immediately
});

// Activate: cleanup old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim(); // control all clients immediately
});

// Fetch handler
self.addEventListener("fetch", event => {
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Online: update cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline: serve cached file
          return caches.match(event.request)
            .then(cachedRes => {
              // If the requested file is cached → return it
              if (cachedRes) return cachedRes;
              // Otherwise → always fall back to index.html
              return caches.match("/index.html");
            });
        })
    );
  }
});
