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

self.addEventListener('fetch', event => {
  // Only intercept POST requests to /share-target.html
  if (
    event.request.method === 'POST' &&
    new URL(event.request.url).pathname === '/share-target.html'
  ) {
    event.respondWith(
      (async () => {
        // Get the form data
        const formData = await event.request.formData();
        // Get the image file
        const imageFile = formData.get('media');
        // Optionally get other fields (title, text, url)
        const title = formData.get('title');
        const text = formData.get('text');
        const url = formData.get('url');

        // Save to IndexedDB, cache, or pass using clients.openWindow with a query string
        // Here, we'll open a window and pass info in URL (simple demo)
        const imageUrl = URL.createObjectURL(imageFile);
        const newPageUrl =
          `/share-target.html?image=${encodeURIComponent(imageUrl)}&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        // Open your share target page with the image
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.navigate(newPageUrl);
          client.focus();
          break;
        }
        // Respond with a simple HTML
        return Response.redirect(newPageUrl, 303);
      })()
    );
  }
});

