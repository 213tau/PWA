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

  if (event.request.method === "POST" && url.pathname === "/share-target.html") {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();

        const sharedTitle = formData.get("title");
        const sharedText = formData.get("text");
        const sharedUrl = formData.get("url");

        // Handle files
        const files = formData.getAll("file"); // may be multiple
        const fileInfos = [];

        for (const file of files) {
          if (file && file.name) {
            // Store or forward to your app
            fileInfos.push({
              name: file.name,
              type: file.type,
              size: file.size
            });

            // Example: put in Cache Storage
            const cache = await caches.open("shared-files");
            await cache.put(
              `/uploads/${file.name}`,
              new Response(file, { headers: { "Content-Type": file.type } })
            );
          }
        }

        // Notify app windows
        const clientsList = await self.clients.matchAll({ type: "window" });
        for (const client of clientsList) {
          client.postMessage({
            type: "share",
            title: sharedTitle,
            text: sharedText,
            url: sharedUrl,
            files: fileInfos
          });
        }

        // Redirect user into the app
        return Response.redirect("/?shared=true", 303);
      })()
    );
    return;
  }

  // Fallback: cache or fetch
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});

