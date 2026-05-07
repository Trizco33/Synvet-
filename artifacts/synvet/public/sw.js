// Synvet PWA service worker — minimal offline shell.
// Cache name is auto-versioned at build time (see vite.config.ts swVersionPlugin).
const VERSION = "__BUILD_VERSION__";
const CACHE = `synvet-shell-${VERSION}`;

self.addEventListener("install", (event) => {
  // Activate immediately; do not pre-cache anything (avoid stale HTML/JS).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("synvet-shell-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never intercept API calls.
  if (url.pathname.includes("/api/")) return;

  // Navigation: network-only when online, cache fallback only when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep a copy of the latest shell for offline fallback only.
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((m) => m ?? caches.match("./"))),
    );
  }
});

// Allow the page to trigger an immediate activation.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
