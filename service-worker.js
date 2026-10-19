// service-worker.js - Caché, PWA offline y Background Sync de cola
const CACHE_NAME = "yonke-pos-cache-v6";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.png",
  "./js/cloud_config.js",
  "./js/local_store.js",
  "./js/sync_engine.js",
  "./js/db.js",
  "./js/excel_sync.js",
  "./js/excel_import.worker.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn("Recurso opcional no cacheado:", asset);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isLocalJs = url.pathname.includes("/js/") || url.pathname.endsWith("index.html");
  if (isLocalJs) {
    e.respondWith(
      fetch(e.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => cachedResponse);
    })
  );
});

self.addEventListener("sync", (e) => {
  if (e.tag === "yonke-sync-queue") {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "YONKE_BACKGROUND_SYNC" });
        });
      })
    );
  }
});
