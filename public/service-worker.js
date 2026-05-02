// IMPORTANT: never cache Next.js HTML or build artifacts. Hashed chunks disappear
// after deployments, so stale HTML can point browsers at files that no longer exist.
const CACHE_NAME = "beyond-bot-cache-v4"
const urlsToCache = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

// Install service worker and cache static assets
self.addEventListener("install", (event) => {
  // Force activation of the new service worker
  self.skipWaiting()

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error("Failed to cache resources:", error)
        // Continue with installation even if caching fails
        return Promise.resolve()
      }),
  )
})

// Activate service worker and clean up old caches
self.addEventListener("activate", (event) => {
  // Take control of all clients immediately
  event.waitUntil(clients.claim())

  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
})

// Serve cached content when offline
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Ignore browser-extension and other non-http(s) schemes. Cache Storage cannot
  // store those requests and will throw "Request scheme ... is unsupported".
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return
  }

  // Skip API/auth requests, non-GET requests, navigation HTML, and Next build assets.
  // These must always come from the network to avoid stale deployments.
  if (
    event.request.method !== "GET" ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.startsWith("/_next/") ||
    event.request.mode === "navigate" ||
    event.request.destination === "document"
  ) {
    return
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response
        }
        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Avoid caching JS/CSS bundles (stale deployments).
          if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
      })
      .catch(() => {
        // If both cache and network fail, show a fallback page for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match("/offline.html")
        }
      }),
  )
})
