"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"
import { PWAInstallGuide } from "./pwa-install-guide"

export function PostLoginPWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined") return

    // Check if we should show the prompt
    const checkPromptConditions = () => {
      // Don't show if already installed
      if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true) {
        return false
      }

      // Don't show if user has dismissed recently
      const dismissed = localStorage.getItem("post-login-pwa-dismissed")
      if (dismissed && Date.now() - Number.parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
        return false
      }

      // Don't show if user has seen it recently
      const lastSeen = localStorage.getItem("post-login-pwa-seen")
      if (lastSeen && Date.now() - Number.parseInt(lastSeen, 10) < 24 * 60 * 60 * 1000) {
        return false
      }

      // Check if install prompt is available
      return localStorage.getItem("pwaInstallPrompt") === "available"
    }

    // Show the prompt after a short delay
    const timer = setTimeout(() => {
      if (checkPromptConditions()) {
        setShowPrompt(true)
        localStorage.setItem("post-login-pwa-seen", Date.now().toString())
      }
    }, 3000) // 3 seconds after login

    return () => clearTimeout(timer)
  }, [])

  const handleInstall = () => {
    // Try to use the global install trigger
    if (typeof window !== "undefined" && (window as any).triggerPWAInstall) {
      const success = (window as any).triggerPWAInstall()
      if (success) {
        setShowPrompt(false)
        return
      }
    }

    // If the direct install didn't work, show the guide
    setShowInstallGuide(true)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("post-login-pwa-dismissed", Date.now().toString())
    }
  }

  if (!showPrompt) {
    return showInstallGuide ? <PWAInstallGuide onClose={() => setShowInstallGuide(false)} /> : null
  }

  return (
    <div className="fixed top-4 right-4 bg-card border border-primary/20 rounded-lg shadow-lg p-4 z-50 max-w-md">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-full">
          <Download size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-medium">Install Beyond-Bot.ai App</h3>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Install our app for a better experience and offline access. It only takes a few seconds!
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              <span>Install</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
