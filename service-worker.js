/* Curio service worker
   - App shell + pool.json are precached so Random, Daily, Saved work fully offline.
   - Live API calls (Semantic Scholar) are never cached here; they just pass through.
   Bump CACHE when you redeploy new files (e.g. after regenerating pool.json). */

const CACHE = "curio-v1";
const SHELL = [
  "./",
  "./index.html",
  "./pool.json",
  "./manifest.webmanifest",
  "./icons/favicon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept the live science API — let the browser handle it directly.
  if (url.hostname.includes("semanticscholar.org")) return;

  // Same-origin app shell: cache-first, fall back to network.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        }).catch(() => hit)
      )
    );
  }
});
