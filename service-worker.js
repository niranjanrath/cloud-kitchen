const CACHE_NAME = "cloud-kitchen-v2";

// Paths are relative to the service worker's own location, so this keeps
// working when hosted at a GitHub Pages project subpath (e.g. /repo-name/).
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./items.json",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/img/veg-biryani.svg",
  "./assets/img/paneer-butter-masala.svg",
  "./assets/img/chicken-curry.svg",
  "./assets/img/butter-chicken.svg",
  "./assets/img/dal-makhani.svg",
  "./assets/img/garlic-naan.svg",
  "./assets/img/french-fries.svg",
  "./assets/img/papad.svg",
  "./assets/img/masala-chai.svg",
  "./assets/img/mango-lassi.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET requests, with a network fallback and
// a background cache refresh (stale-while-revalidate style).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
