const CACHE_NAME = "my-pwa-cache-v1";
const ASSETS = [
  "/",                     // serves index.html on Vercel
  "/index.html",
  "/manifest.json",
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Handle Web Share Target (POST request)
  if (event.request.method === "POST" && url.pathname === "/") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll("shared_files");

          const fileDataArray = [];
          for (const file of files) {
            if (file instanceof File) {
              fileDataArray.push({
                name: file.name,
                type: file.type,
                buffer: await file.arrayBuffer(),
              });
            }
          }

          self.latestSharedFiles = fileDataArray;
          return Response.redirect("/?share=true", 303);
        } catch (err) {
          return new Response("Failed to process share target locally.", {
            status: 500,
          });
        }
      })()
    );
    return;
  }

  // 2. Handle GET requests (Network-first with dynamic cache update & offline fallback)
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Online: update cache with a clone of the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline: serve cached file or fall back to index.html
          return caches.match(event.request).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            return caches.match("/index.html");
          });
        })
    );
  }
});
