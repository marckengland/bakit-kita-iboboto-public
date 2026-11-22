/**
 * Service Worker for Bakit Kita Iboboto PWA
 * Implements offline functionality with caching strategies
 * Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `bkib-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `bkib-dynamic-${CACHE_VERSION}`;
const API_CACHE = `bkib-api-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = ["/offline", "/manifest.json"];

// These responses require a fresh server review check, including explicit caches.
function isCaseBearingPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/politicians" ||
    pathname.startsWith("/politicians/") ||
    /^\/api\/(?:v1\/)?politicians(?:\/|$)/.test(pathname) ||
    pathname.startsWith("/api/search") ||
    pathname === "/compare" ||
    pathname.startsWith("/api/compare")
  );
}
async function expireCaseResponses() {
  for (const name of await caches.keys()) {
    if (!name.startsWith("bkib-")) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (isCaseBearingPath(new URL(request.url).pathname)) await cache.delete(request);
    }
  }
}

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS).then(async () => {
        // The offline HTML shell needs its own static bundles after a cold navigation.
        const shell = await cache.match("/offline");
        const html = await shell.text();
        const assets = [...html.matchAll(/(?:src|href)="([^"<>]+)"/g)]
          .map((match) => new URL(match[1].replaceAll("&amp;", "&"), self.location.origin))
          .filter(
            (url) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith("/_next/static/") &&
              /\.(?:js|css)$/.test(url.pathname)
          );
        await Promise.all(
          assets.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Offline shell asset unavailable");
            if (!/no-store/i.test(response.headers.get("Cache-Control") || ""))
              await cache.put(url, response);
          })
        );
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(expireCaseResponses().then(() => self.clients.claim()));
  // Take control of all pages immediately
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  if (isCaseBearingPath(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => {
        if (request.mode === "navigate")
          return (
            (await caches.match("/offline")) ||
            new Response("Case details require an online review check.", { status: 503 })
          );
        return new Response(
          JSON.stringify({ error: "Case details require an online review check.", offline: true }),
          {
            status: 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }
        );
      })
    );
    return;
  }

  // API requests - Network first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets - Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Dynamic pages - Network first with cache fallback
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse.ok &&
      !/no-store/i.test(networkResponse.headers.get("Cache-Control") || "")
    ) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("[SW] Cache-first fetch failed:", error);
    return new Response("Offline", { status: 503 });
  }
}

// Network-first strategy for API and dynamic content
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse.ok &&
      !/no-store/i.test(networkResponse.headers.get("Cache-Control") || "")
    ) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("[SW] Network-first falling back to cache:", request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline");
    }
    return new Response(JSON.stringify({ error: "Offline", offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Check if request is for a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".webp",
    ".avif",
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

// Handle messages from the main thread
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case "CACHE_POLITICIAN_PROFILE":
      console.log("[SW] Profile response caching withheld; an online review check is required.");
      event.waitUntil(expireCaseResponses());
      if (event.ports?.[0])
        event.ports[0].postMessage({ cached: false, reason: "online-review-required" });
      break;
    case "GET_CACHED_PROFILES":
      getCachedProfiles().then((profiles) => {
        event.ports[0].postMessage({ profiles });
      });
      break;
    case "REMOVE_CACHED_PROFILE":
      removeCachedProfile(payload.politicianId);
      break;
    case "SYNC_PROFILES":
      syncCachedProfiles();
      break;
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "CLEAR_ALL_CACHES":
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          console.log("[SW] All caches cleared");
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        });
      });
      break;
  }
});

// Saved biography cards live in IndexedDB, not response caches.
async function getCachedProfiles() {
  return [];
}

// Remove a cached politician profile
async function removeCachedProfile(politicianId) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const profileUrl = `/api/politicians/${politicianId}`;
  await cache.delete(profileUrl);
  console.log("[SW] Removed cached profile:", politicianId);
}

// Sync cached profiles when back online
async function syncCachedProfiles() {
  await expireCaseResponses();
  const clients = await self.clients.matchAll();
  // Notify clients that sync is complete
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_COMPLETE" });
  });
}

// Background sync for queued actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-profiles") {
    event.waitUntil(syncCachedProfiles());
  }
});

// Push notification handling (for future use)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      data: data.url,
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
