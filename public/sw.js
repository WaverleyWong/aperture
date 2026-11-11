// Bumped from aperture-v1 so the old cache — which may hold a login page or a
// redirect stored under "/" — is dropped on activate.
const CACHE_NAME = "aperture-v2";

// "/" is deliberately NOT precached. cache.addAll() fetches with redirect
// "follow" and no way to inspect the result, so installing while logged out
// would store the /login page under "/".
const PRECACHE_URLS = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Only store a response that really is the thing that was asked for.
//
// - status 200 excludes 401s and opaque redirects (which report status 0)
// - type "basic" keeps it to same-origin, non-redirected responses
// - redirected catches a followed redirect to /login, which would otherwise be
//   cached under the original URL — e.g. an RSC prefetch after the session ends
function isCacheable(response) {
  return response.status === 200 && response.type === "basic" && !response.redirected;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses or the gate itself.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/login") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(response)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
