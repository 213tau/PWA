self.addEventListener('install', (event) => {

console.log('Service Worker installed.');

self.skipWaiting();

});

self.addEventListener('activate', (event) => {

console.log('Service Worker activated.');

});

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

});

// Fetch event: serve cached files if offline

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept POST to /share-target.html
  if (event.request.method === "POST" && url.pathname === "/share-target.html") {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();

        const files = formData.getAll("file"); // includes images / PDFs
        const title = formData.get("title");
        const text = formData.get("text");
        const sharedUrl = formData.get("url");

        // Send data to your app
        const clientsList = await self.clients.matchAll({ type: "window" });
        for (const client of clientsList) {
          client.postMessage({
            type: "share",
            title,
            text,
            url: sharedUrl,
            files: files.map(f => ({
              name: f.name,
              type: f.type,
              size: f.size
            }))
          });
        }

        // Respond with a redirect so user lands in your UI
        return Response.redirect("/?shared=true", 303);
      })()
    );
    return; // stop here so it doesn’t hit the server
  }

  // Normal cache-first fetch
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});

