"use client"

export async function refreshCache() {
  if (typeof window === "undefined") return

  // Clear all caches
  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
      console.log("All caches cleared")
    } catch (err) {
      console.error("Error clearing caches:", err)
    }
  }

  // Unregister service workers
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
      console.log("Service workers unregistered")
    } catch (err) {
      console.error("Error unregistering service workers:", err)
    }
  }

  // Reload the page
  window.location.reload()
}
