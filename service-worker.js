const CACHE_NAME = "my-pwa-cache-v1";
const DB_NAME = "share-target-db";
const STORE_NAME = "sharedFiles";

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

// Helper: Open IndexedDB inside Service Worker
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper: Save files to IndexedDB
async function saveFiles(files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    files.forEach(file => store.add(file));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Helper: Get files from IndexedDB and clear them out
async function getAndClearFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const files = request.result;
      store.clear();
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

// Listen for messages from index.html to fetch stored files from IndexedDB
self.addEventListener("message", async (event) => {
  if (event.data && event.data.action === "GET_SHARED_FILES") {
    try {
      const files = await getAndClearFiles();
      event.ports[0].postMessage({ files });
    } catch (err) {
      console.error("Failed to retrieve shared files from IndexedDB:", err);
      event.ports[0].postMessage({ files: [] });
    }
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

 // 1. Handle Web Share Target (POST request)
  if (event.request.method === "POST" && url.pathname === "/") {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const shared = [];

        for (const file of form.getAll("shared_files")) {
          shared.push({
            name: file.name,
            type: file.type,
            buffer: await file.arrayBuffer()
          });
        }

        await saveFiles(shared);
        return Response.redirect("/?share=true", 303);
      } catch (err) {
        console.error("Share Target Error:", err);
        return new Response("Share failed:\n" + err.message, { status: 500 });
      }
    })());
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
