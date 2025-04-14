"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  // Check if the app is already installed
  const checkIfInstalled = () => {
    if (typeof window === "undefined") return false

    // Check if in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true) {
      return true
    }

    // Check localStorage to see if user dismissed the banner
    const dismissed = localStorage.getItem("pwa-install-dismissed")
    const dismissedTime = dismissed ? Number.parseInt(dismissed, 10) : 0

    // If dismissed in the last 7 days, consider it as not wanting to install
    if (dismissedTime && Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
      return true
    }

    return false
  }

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined") return

    // Set initial installed state
    setIsInstalled(checkIfInstalled())

    // Register service worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").then(
          (registration) => {
            console.log("ServiceWorker registration successful with scope: ", registration.scope)
          },
          (err) => {
            console.log("ServiceWorker registration failed: ", err)
          },
        )
      })
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      // Show the install banner
      setShowInstallBanner(true)

      // Store the event in localStorage for access from other components
      localStorage.setItem("pwaInstallPrompt", "available")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Make the prompt handler available globally
    ;(window as any).triggerPWAInstall = () => {
      if (deferredPrompt) {
        handleInstallClick()
        return true
      }
      return false
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallBanner(false)
      localStorage.setItem("pwa-installed", "true")
      console.log("PWA was installed")
    }

    window.addEventListener("appinstalled", handleAppInstalled)

    // Cleanup
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [deferredPrompt]) // Include deferredPrompt in dependencies

  const handleInstallClick = () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt")
        setIsInstalled(true)
        localStorage.setItem("pwa-installed", "true")
      } else {
        console.log("User dismissed the install prompt")
        // Store dismissal time
        localStorage.setItem("pwa-install-dismissed", Date.now().toString())
      }
      // Clear the saved prompt since it can't be used again
      setDeferredPrompt(null)
      setShowInstallBanner(false)
      localStorage.removeItem("pwaInstallPrompt")
    })
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("pwa-install-dismissed", Date.now().toString())
    }
  }

  // Don't show if already installed or banner shouldn't be shown
  if (isInstalled || !showInstallBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-card border border-primary/20 rounded-lg shadow-lg p-4 z-50 max-w-md mx-auto">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-full">
          <Download size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-medium">Install Beyond-Bot.ai</h3>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Install this app on your device for quick access even when you're offline.
          </p>
          <button
            onClick={handleInstallClick}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            <span>Install App</span>
          </button>
        </div>
      </div>
    </div>
  )
}
