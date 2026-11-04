const CACHE_NAME = "hyperion-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/");
      if (!response.ok) throw new Error("Could not cache the Hyperion app shell.");
      const html = await response.clone().text();
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s>]+/g) ?? [])];
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/", response);
      await Promise.all([...assets, "/manifest.webmanifest", "/icon.svg"].map((asset) => cache.add(asset)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await caches.open(CACHE_NAME).then((cache) => cache.put("/", response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          if (cached) return cached;
          return new Response("Hyperion Core is offline and this app shell has not been cached yet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response.ok) return response;
          return caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, response.clone()).then(() => response),
          );
        });
      }),
    );
  }
});
