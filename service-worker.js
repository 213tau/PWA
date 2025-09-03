const CACHE_NAME = "my-pwa-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/service-worker.js",
  "/script.js",
  "/share-target.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install event: cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated.");
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ✅ Handle POST to share-target.html → redirect to GET
  if (url.pathname === "/share-target.html" && event.request.method === "POST") {
    event.respondWith(Response.redirect("/share-target.html"));
    return;
  }

  // ✅ Don’t interfere with non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // ✅ Serve cached content, fallback to network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});