"use client"

import { useState } from "react"
import { Menu, X, Sparkles } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import { useAuth0 } from "@auth0/auth0-react"
import Image from "next/image"

interface ChatHeaderProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  onToggleDiscover: () => void
}

export function ChatHeader({ onToggleSidebar, isSidebarOpen, onToggleDiscover }: ChatHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth0()
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  return (
    <header className="flex items-center justify-between p-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center">
          <div className="w-8 h-8 relative flex items-center justify-center">
            <Image src="/logo-black.svg" alt="Beyond-Bot.ai Logo" width={32} height={32} className="dark:invert" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDiscover}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles size={16} />
          <span>Discover Agents</span>
        </button>

        {/* Debug button - only in development */}
        {process.env.NODE_ENV === "development" && (
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          >
            Debug
          </button>
        )}

        {/* Debug info panel */}
        {showDebugInfo && (
          <div className="fixed top-14 right-4 z-50 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-xs max-w-xs">
            <h4 className="font-bold mb-2">Auth Debug Info:</h4>
            <p>isAuthenticated: {isAuthenticated ? "true" : "false"}</p>
            <p>isLoading: {isLoading ? "true" : "false"}</p>
            <button
              onClick={() => {
                // Force auth state refresh
                localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated")
                window.location.reload()
              }}
              className="mt-2 px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Reset Auth State
            </button>
          </div>
        )}

        <UserProfile />
      </div>
    </header>
  )
}
