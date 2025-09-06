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

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Handle Web Share Target POST
  if (event.request.method === "POST" && url.pathname === "/share-target.html") {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const imageFile = formData.get("media");
      const title = formData.get("title") || "";
      const text = formData.get("text") || "";
      const sharedUrl = formData.get("url") || "";

      // Use object URL (temporary) or save in IndexedDB for persistence
      const imageUrl = imageFile ? URL.createObjectURL(imageFile) : "";

      const newPageUrl =
        `/share-target.html?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(sharedUrl)}&image=${encodeURIComponent(imageUrl)}`;

      // Focus or open client window
      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clientList.length > 0) {
        clientList[0].navigate(newPageUrl);
        clientList[0].focus();
      } else {
        return Response.redirect(newPageUrl, 303);
      }

      return new Response(null, { status: 200 });
    })());
    return; // exit early so offline handler doesn’t run
  }

  // Default: offline caching for GET
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(res => res || caches.match("/offline.html"))
      )
    );
  }
});


