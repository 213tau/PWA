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

event.respondWith(

caches.match(event.request).then((response) => {

  return response || fetch(event.request);

})

);

});

Can you tell what you changed

