const CACHE_NAME = "beyond-bot-cache-v2" // Increment cache version to force refresh
const urlsToCache = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  // Removed other static assets that might not exist
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
  // Skip caching for API requests
  if (event.request.url.includes("/api/")) {
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

          // Clone the response
          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            // Don't cache API requests or auth endpoints
            if (!event.request.url.includes("/api/") && !event.request.url.includes("/auth/")) {
              cache.put(event.request, responseToCache)
            }
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
