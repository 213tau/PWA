const CACHE_NAME = "my-pwa-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/service-worker.js",
  "/script.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: cache assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: cleanup old caches (optional but recommended)
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
  console.log("Service Worker activated.");
});

// Fetch: always serve index.html when offline
self.addEventListener("fetch", event => {
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache updated response
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return res;
        })
        .catch(() =>
          // If offline → return cached file (index.html or requested asset)
          caches.match(event.request).then(res =>
            res || caches.match("/index.html")
          )
        )
    );
  }
});
