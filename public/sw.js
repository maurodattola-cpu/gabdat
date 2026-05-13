const CACHE_NAME = "my-class-v34";
const APP_ROOT = new URL("./", self.registration.scope).pathname;
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}styles.css?v=34`,
  `${APP_ROOT}app.js?v=34`,
  `${APP_ROOT}manifest.webmanifest?v=34`,
  `${APP_ROOT}icon.svg?v=34`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match(APP_ROOT)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, copy));
        return response;
      }).catch(() => caches.match(APP_ROOT))
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match(APP_ROOT)))
  );
});
